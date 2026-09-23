import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { database, scope, actorId, input } from '../tests/helpers/assignment-overlap-fixture.js';
import { prepareTaskAssignment, planTaskAssignment } from '../src/lib/task-assignments.js';
import { reviewTaskAssignment, planReviewedTaskAssignment } from '../src/lib/assignment-overlap-review.js';
import { getAssignmentReschedule, reviewAssignmentReschedule, commitAssignmentReschedule } from '../src/lib/assignment-reschedule.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/assignment-continuity-ui');
mkdirSync(out,{recursive:true});
const db=database(),task={id:'task-a',title:'Mampostería · Ensayo',revision:3,type:'TASK'};
const initial=[['assignment-original','2026-09-01','2026-09-03'],['assignment-peer','2026-09-08','2026-09-10']].map(([id,start,end])=>({id,projectId:scope.projectId,taskId:task.id,workerId:'worker-a',teamId:null,status:'PLANNED',revision:0,startsAt:new Date(start),endsAt:new Date(end)}));
db.state.rows.push(...initial);
let loseReply=true;const calls=[],errors=[];
const entry=`import React,{useState} from'react';import{createRoot}from'react-dom/client';import Board from'./src/app/dashboard/execution/assignment-board';import './src/app/globals.css';
function App(){const[rows,setRows]=useState(${JSON.stringify(initial)});return <Board assignments={rows} tasks={[${JSON.stringify(task)}]} workers={[{id:'worker-a',name:'Persona de ensayo'}]} teams={[]} permissions={{canManage:true,canReadTasks:true}} organizationId="org-a" projectId="project-a" focusedTask={${JSON.stringify(task)}} onChanged={saved=>setRows(prior=>[...prior.filter(row=>row.id!==saved.id),saved])}/>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'test-links',setup(api){
  api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={e=>onNavigate?.(e)}/>} `}));
}}]});
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://local');
 if(url.pathname.startsWith('/api/execution/assignments')){
  try{
   assert.equal(req.headers['x-obrasaas-project'],scope.projectId);assert.equal(req.headers['x-obrasaas-organization'],scope.organizationId);
   let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):null;
   calls.push({method:req.method,path:url.pathname,body,key:req.headers['idempotency-key']});
   const reschedule=url.pathname.match(/^\/api\/execution\/assignments\/([^/]+)\/reschedule$/);
   if(reschedule){const base={scope,actorId,assignmentId:reschedule[1]},fn=req.method==='GET'?getAssignmentReschedule:req.method==='POST'?reviewAssignmentReschedule:commitAssignmentReschedule;json(res,await fn(db.prisma,{...base,input:body}));return;}
   if(req.method==='GET'){json(res,await prepareTaskAssignment(db.prisma,{scope,taskId:task.id}));return;}
   if(url.pathname.endsWith('/review')){json(res,await reviewTaskAssignment(db.prisma,{scope,input:body}));return;}
   const result=await planReviewedTaskAssignment(db.prisma,{scope,actorId,operationKey:req.headers['idempotency-key'],input:body});
   if(loseReply){loseReply=false;const base={scope,actorId,assignmentId:result.assignment.id},raw={expectedRevision:0,startsOn:'2026-09-26',endsOn:'2026-09-30'};
    const review=await reviewAssignmentReschedule(db.prisma,{...base,input:raw});
    await commitAssignmentReschedule(db.prisma,{...base,input:{...raw,reviewVersion:review.version,confirmed:true,note:'Coordinación posterior desde otra sesión de ensayo.'}});
    json(res,{error:'Respuesta perdida después de guardar.'},503);return;}
   json(res,result,result.replayed?200:201);
  }catch(error){json(res,{error:error.message,code:error.code},error.status||503);}return;
 }
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;padding:12px;background:#060913}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000},locale:'es-AR'}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByRole('button',{name:'Planificar asignación',exact:true}).click();
 const planner=page.getByRole('dialog',{name:'Planificar asignación'});
 await planner.getByRole('combobox',{name:'Responsable de la asignación'}).selectOption('worker-a');
 await planner.getByLabel('Inicio previsto',{exact:true}).fill(input.startsOn);await planner.getByLabel('Fin previsto',{exact:true}).fill(input.endsOn);
 await planner.getByRole('button',{name:'Revisar coincidencias',exact:true}).click();
 await expect(planner.getByText('Sin coincidencias detectadas en esta revisión',{exact:true})).toBeVisible();await planner.getByRole('checkbox').check();
 await planner.getByRole('button',{name:'Confirmar planificación'}).click();
 await expect(planner.getByRole('button',{name:'Verificar el mismo intento'})).toBeVisible();
 await planner.getByRole('button',{name:'Verificar el mismo intento'}).click();await expect(planner).toHaveCount(0);
 await expect(page.getByRole('status').filter({hasText:'Sus fechas cambiaron después'})).toBeVisible();
 const recovered=page.getByRole('article').filter({hasText:'26/09/2026'});await expect(recovered).toHaveCount(1);await expect(recovered).toContainText('30/09/2026');
 const creates=calls.filter(row=>row.path==='/api/execution/assignments'&&row.method==='POST');assert.equal(creates.length,2);assert.equal(creates[0].key,creates[1].key);assert.deepEqual(creates[0].body,creates[1].body);assert.equal(db.state.rows.length,3);
 await page.getByRole('article').filter({hasText:'01/09/2026'}).getByRole('button',{name:'Reprogramar fechas'}).click();
 const modal=page.getByRole('dialog',{name:'Fechas de la asignación'}),start=modal.getByLabel('Nuevo inicio previsto'),end=modal.getByLabel('Nuevo fin previsto'),note=modal.getByLabel('Motivo de reprogramación');
 await expect(start).toHaveValue('2026-09-01');await start.fill('2026-09-08');await end.fill('2026-09-10');await note.fill('Conservar este motivo al ajustar la propuesta.');
 await modal.getByRole('button',{name:'Revisar nuevas fechas'}).click();await expect(modal.getByRole('alert')).toContainText('Ya existe una asignación');
 await expect(start).toBeEnabled();await expect(note).toHaveValue('Conservar este motivo al ajustar la propuesta.');await expect(modal.getByRole('button',{name:'Consultar estado sin reenviar'})).toHaveCount(0);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});await modal.getByRole('alert').scrollIntoViewIfNeeded();const box=await modal.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'duplicate-recovery-'+width+'.png')});}
 await start.fill('2026-09-04');await end.fill('2026-09-06');await modal.getByRole('button',{name:'Revisar nuevas fechas'}).click();await expect(modal.getByRole('region',{name:'Resultado de coincidencias'})).toContainText('Sin coincidencias');
 await modal.getByRole('checkbox').check();
 await planTaskAssignment(db.prisma,{scope,actorId,operationKey:'concurrent-fixture-001',input:{...input,startsOn:'2026-09-04',endsOn:'2026-09-06'}});
 const auditsBefore=db.state.audits.length;await modal.getByRole('button',{name:'Guardar reprogramación'}).click();await expect(modal.getByRole('alert')).toContainText('Ya existe una asignación');
 await expect(start).toBeEnabled();await expect(modal.getByRole('checkbox')).not.toBeChecked();assert.equal(db.state.audits.length,auditsBefore);assert.equal(db.state.rows.find(row=>row.id==='assignment-original').revision,0);
 await end.fill('2026-09-07');await modal.getByRole('button',{name:'Revisar nuevas fechas'}).click();await expect(modal.getByRole('region',{name:'Resultado de coincidencias'})).toContainText('Requiere coordinación');
 await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'Guardar reprogramación'}).click();await expect(modal).toHaveCount(0);
 await expect(page.getByRole('article').filter({hasText:'04/09/2026'})).toContainText('07/09/2026');
 assert.equal(db.state.audits.length,auditsBefore+1);assert.equal(db.state.task.revision,3);assert.deepEqual(errors,[]);
 const proof={result:'PASS',environment:'real-components-and-services-with-controlled-HTTP-database-and-identity',creationReplayAfterReschedule:true,currentDatesShownWithoutRestoring:true,duplicateReviewEditable:true,duplicateAtCommitNoWrite:true,reasonPreserved:true,partialOverlapCanBeCoordinated:true,creationRequests:creates.length,logicalCreationsFromPlanner:1,widths:[320,390,768,1280],pageErrors:0,clerkVerified:false,productionDeployed:false};
 writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
