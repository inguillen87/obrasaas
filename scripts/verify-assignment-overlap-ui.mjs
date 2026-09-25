import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium,expect } from '@playwright/test';
import { database,scope } from '../tests/helpers/assignment-overlap-fixture.js';
import { prepareTaskAssignment } from '../src/lib/task-assignments.js';
import { reviewTaskAssignment,planReviewedTaskAssignment } from '../src/lib/assignment-overlap-review.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/assignment-overlap-ui');mkdirSync(out,{recursive:true});
const db=database(),task={id:'task-a',title:'Mampostería · Ensayo',revision:3,type:'TASK'};
db.state.rows.push({id:'peer-a',projectId:'project-a',taskId:'task-b',workerId:'worker-a',teamId:null,status:'PLANNED',revision:0,startsAt:new Date('2026-09-23'),endsAt:new Date('2026-09-27')});
let loseReply=true,foreignReview=false;const calls=[],errors=[];
const entry=`import React,{useState} from'react';import{createRoot}from'react-dom/client';import Planner from'./src/app/dashboard/execution/assignment-planner';import './src/app/globals.css';
function App(){const[open,setOpen]=useState(true),[saved,setSaved]=useState(null);return <><button onClick={()=>setOpen(true)}>Preparar otro ensayo</button>{saved&&<p role="status">Asignación confirmada: {saved.id}</p>}{open&&<Planner organizationId="org-a" projectId="project-a" tasks={[${JSON.stringify(task)}]} focusedTask={${JSON.stringify(task)}} onClose={()=>setOpen(false)} onSaved={row=>{setSaved(row);setOpen(false)}}/>}</>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'test-links',setup(api){
  api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={e=>onNavigate?.(e)}/>} `}));
}}]});
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname==='/api/execution/assignments'&&req.method==='GET'){json(res,await prepareTaskAssignment(db.prisma,{scope,taskId:'task-a'}));return;}
  if(url.pathname.startsWith('/api/execution/assignments')&&req.method==='POST'){
    let text='';for await(const chunk of req)text+=chunk;const input=JSON.parse(text),reviewing=url.pathname.endsWith('/review');
    calls.push({kind:reviewing?'REVIEW':'CREATE',input,key:req.headers['idempotency-key'],project:req.headers['x-obrasaas-project'],organization:req.headers['x-obrasaas-organization']});
    try {
      const result=reviewing?await reviewTaskAssignment(db.prisma,{scope,input}):await planReviewedTaskAssignment(db.prisma,{scope,actorId:'manager-a',operationKey:req.headers['idempotency-key'],input});
      if(reviewing&&foreignReview)result.context={...scope,projectId:'other-project'};
      if(!reviewing&&loseReply){loseReply=false;json(res,{error:'Respuesta perdida después de guardar'},503);return;}
      json(res,result,reviewing||result.replayed?200:201);
    }catch(error){json(res,{error:error.message,code:error.code},error.status||503);}return;
  }
  if(url.pathname==='/bundle.js'||url.pathname==='/bundle.css'){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;padding:12px;background:#060913}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000},locale:'es-AR'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
  const modal=page.getByRole('dialog',{name:'Planificar asignación'}),owner=modal.getByRole('combobox',{name:'Responsable de la asignación'});
  await owner.selectOption('worker-a');await modal.getByLabel('Inicio previsto',{exact:true}).fill('2026-09-21');await modal.getByLabel('Fin previsto',{exact:true}).fill('2026-09-25');
  await expect(modal.getByRole('button',{name:'Confirmar planificación'})).toBeDisabled();
  await modal.getByRole('button',{name:'Revisar coincidencias',exact:true}).click();await expect(modal.getByText('Requiere coordinación',{exact:true})).toBeVisible();
  await expect(modal.getByText('Actividad task-b',{exact:true})).toBeVisible();assert.equal(db.state.audits.length,0);
  const explanation=modal.getByRole('textbox',{name:'Explicación de coordinación'});await expect(modal.getByRole('checkbox')).toBeDisabled();
  await explanation.fill('Se coordinarán los frentes con horarios separados.');await modal.getByRole('checkbox').check();
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});await modal.getByRole('heading',{name:'Coincidencias de planificación'}).scrollIntoViewIfNeeded();const box=await modal.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'review-'+width+'.png')});}
  await modal.getByLabel('Fin previsto',{exact:true}).fill('2026-09-26');await expect(modal.getByRole('button',{name:'Confirmar planificación'})).toBeDisabled();
  await modal.getByRole('button',{name:'Revisar coincidencias',exact:true}).click();await expect(modal.getByText('Requiere coordinación',{exact:true})).toBeVisible();
  await modal.getByRole('checkbox').check();db.state.rows[0].status='ENDED';db.state.rows[0].revision++;
  await modal.getByRole('button',{name:'Confirmar planificación'}).click();await expect(modal.getByRole('alert')).toContainText('Volvé a revisar');
  await expect(owner).toHaveValue('worker-a');await expect(modal.getByLabel('Fin previsto',{exact:true})).toHaveValue('2026-09-26');assert.equal(db.state.audits.length,0);
  await modal.getByRole('button',{name:'Revisar coincidencias',exact:true}).click();await expect(modal.getByText('Sin coincidencias detectadas en esta revisión',{exact:true})).toBeVisible();
  await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'Confirmar planificación'}).click();await expect(modal.getByRole('button',{name:'Verificar el mismo intento'})).toBeVisible();
  await expect(owner).toHaveValue('worker-a');await modal.getByRole('button',{name:'Verificar el mismo intento'}).click();await expect(modal).toHaveCount(0);
  const creates=calls.filter(c=>c.kind==='CREATE');assert.equal(creates.length,3);assert.equal(creates[1].key,creates[2].key);assert.deepEqual(creates[1].input,creates[2].input);
  assert.equal(db.state.rows.length,2);assert.equal(db.state.audits.length,1);assert.equal(db.state.task.revision,3);
  await page.getByRole('button',{name:'Preparar otro ensayo'}).click();await owner.selectOption('worker-a');
  await modal.getByRole('button',{name:'Revisar coincidencias',exact:true}).click();await expect(modal.getByText('Faltan fechas completas en la propuesta. No se puede afirmar disponibilidad.',{exact:true})).toBeVisible();
  await modal.getByRole('button',{name:'Una cuadrilla',exact:true}).click();await owner.selectOption('team-a');await expect(modal.getByRole('button',{name:'Confirmar planificación'})).toBeDisabled();
  foreignReview=true;await modal.getByRole('button',{name:'Revisar coincidencias',exact:true}).click();await expect(modal.getByRole('alert')).toContainText('no corresponde');await expect(modal.getByRole('checkbox')).toBeDisabled();
  assert.ok(calls.every(c=>c.project==='project-a'&&c.organization==='org-a'));assert.deepEqual(errors,[]);
  const proof={result:'PASS',environment:'real-planner-review-and-write-services-with-controlled-database-and-HTTP',reviewIsReadOnly:true,datedConflictShown:true,explicitCoordinationReason:true,fieldChangeInvalidatesReview:true,concurrentChangePreventsWrite:true,uncertainWriteRecoversSameAttempt:true,incompleteDatesNotAvailability:true,foreignReviewRejected:true,taskUnchanged:true,widths:[320,390,768,1280],createRequests:creates.length,logicalCreations:1,pageErrors:0};
  writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
