import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium,expect } from '@playwright/test';
import { database,scope,actorId,input } from '../tests/helpers/assignment-overlap-fixture.js';
import { prepareTaskAssignment,planTaskAssignment } from '../src/lib/task-assignments.js';
import { reviewTaskAssignment,planReviewedTaskAssignment } from '../src/lib/assignment-overlap-review.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/assignment-planner-recovery-ui');
mkdirSync(out,{recursive:true});
let db=database(),readFailure=503,foreignSource=false,loseResponse=false;
const calls=[],errors=[];
const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import Planner from'./src/app/dashboard/execution/assignment-planner';import './src/app/globals.css';
function App(){const[saved,setSaved]=useState(null);return saved?<output data-testid="saved">{JSON.stringify(saved)}</output>:<Planner organizationId="org-a" projectId="project-a" tasks={[{id:'task-a',title:'Mampostería',type:'TASK',revision:3}]} focusedTask={{id:'task-a'}} onClose={()=>{throw Error('Unexpected close')}} onSaved={setSaved}/>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'test-links',setup(api){api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={event=>onNavigate?.(event)}/>} `}));}}]});
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname.startsWith('/api/')){
    try{
      assert.equal(req.headers['x-obrasaas-project'],scope.projectId);assert.equal(req.headers['x-obrasaas-organization'],scope.organizationId);
      let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):null;
      calls.push({path:url.pathname,method:req.method,body,key:req.headers['idempotency-key']});
      if(req.method==='GET'){
        if(readFailure){json(res,{error:'Consulta no disponible durante este ensayo.',code:readFailure===403?'PERMISSION_REQUIRED':'SOURCE_UNAVAILABLE'},readFailure);return;}
        const source=await prepareTaskAssignment(db.prisma,{scope,taskId:'task-a'});if(foreignSource)source.context={...scope,projectId:'foreign'};json(res,source);return;
      }
      if(url.pathname.endsWith('/review')){json(res,await reviewTaskAssignment(db.prisma,{scope,input:body}));return;}
      assert.equal(url.pathname,'/api/execution/assignments');assert.equal(req.method,'POST');
      const result=await planReviewedTaskAssignment(db.prisma,{scope,actorId,operationKey:req.headers['idempotency-key'],input:body});
      if(loseResponse){loseResponse=false;json(res,{error:'Respuesta perdida después de confirmar.'},503);return;}
      json(res,result,result.replayed?200:201);
    }catch(error){json(res,{error:error.message,code:error.code},error.status||500);}return;
  }
  if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844},locale:'es-AR'});
  page.on('pageerror',error=>errors.push(error.message));const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url);let modal=page.getByRole('dialog',{name:'Planificar asignación'});
  await expect(modal.getByRole('alert')).toContainText('Consulta no disponible');await expect(modal.getByRole('button',{name:'Volver a consultar la actividad'})).toBeEnabled();
  assert.equal(calls.filter(row=>row.method==='POST').length,0);
  readFailure=0;await modal.getByRole('button',{name:'Volver a consultar la actividad'}).click();await expect(modal.getByRole('button',{name:'Una cuadrilla',exact:true})).toBeEnabled();
  await modal.getByRole('button',{name:'Una cuadrilla',exact:true}).click();await modal.getByRole('combobox',{name:'Responsable de la asignación'}).selectOption('team-a');
  await modal.getByLabel('Inicio previsto',{exact:true}).fill(input.startsOn);await modal.getByLabel('Fin previsto',{exact:true}).fill(input.endsOn);
  const reason='Se coordina esta cuadrilla conservando el borrador.';
  async function review(){await modal.getByRole('button',{name:'Revisar coincidencias',exact:true}).click();await expect(modal.getByText('Requiere coordinación',{exact:true})).toBeVisible();await modal.getByLabel('Explicación de coordinación').fill(reason);await modal.getByRole('checkbox').check();}
  await review();
  await planTaskAssignment(db.prisma,{scope,actorId,operationKey:'existing-request-001',input:{...input,ownerKind:'TEAM',ownerId:'team-a'}});
  await modal.getByRole('button',{name:'Confirmar planificación',exact:true}).click();await expect(modal.getByRole('alert')).toContainText('Ya existe una asignación');
  await expect(modal.getByLabel('Inicio previsto',{exact:true})).toBeEnabled();await expect(modal.getByLabel('Explicación de coordinación')).toHaveValue(reason);await expect(modal.getByRole('checkbox')).not.toBeChecked();
  await expect(modal.getByRole('button',{name:'Confirmar planificación',exact:true})).toBeDisabled();assert.equal(db.state.rows.length,1);assert.equal(db.state.audits.length,1);
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});await modal.getByRole('alert').scrollIntoViewIfNeeded();const box=await modal.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'editable-conflict-'+width+'.png')});}
  await modal.getByLabel('Inicio previsto',{exact:true}).fill('2026-10-01');await modal.getByLabel('Fin previsto',{exact:true}).fill('2026-10-03');await review();
  db.state.task.revision=4;
  await modal.getByRole('button',{name:'Confirmar planificación',exact:true}).click();await expect(modal.getByRole('button',{name:'Actualizar actividad y responsables'})).toBeVisible();
  await expect(modal.getByLabel('Inicio previsto',{exact:true})).toBeDisabled();const writesBefore=calls.filter(row=>row.path==='/api/execution/assignments'&&row.method==='POST').length;
  readFailure=503;await modal.getByRole('button',{name:'Actualizar actividad y responsables'}).click();await expect(modal.getByRole('button',{name:'Volver a consultar la actividad'})).toBeVisible();
  readFailure=0;await modal.getByRole('button',{name:'Volver a consultar la actividad'}).click();await expect(modal.getByLabel('Inicio previsto',{exact:true})).toHaveValue('2026-10-01');
  await expect(modal.getByLabel('Fin previsto',{exact:true})).toHaveValue('2026-10-03');await expect(modal.getByLabel('Explicación de coordinación')).toHaveValue(reason);await expect(modal.getByRole('combobox',{name:'Responsable de la asignación'})).toHaveValue('team-a');
  await expect(modal.getByRole('region',{name:'Revisar planificación'})).toContainText('Versión de la actividad: 4');await expect(modal.getByRole('checkbox')).not.toBeChecked();
  assert.equal(calls.filter(row=>row.path==='/api/execution/assignments'&&row.method==='POST').length,writesBefore);
  await review();await modal.getByRole('button',{name:'Confirmar planificación',exact:true}).click();await expect(page.getByTestId('saved')).toBeVisible();assert.equal(db.state.rows.length,2);assert.equal(db.state.audits.length,2);
  const firstWrites=calls.filter(row=>row.path==='/api/execution/assignments'&&row.method==='POST');assert.equal(firstWrites.length,3);assert.equal(new Set(firstWrites.map(row=>row.key)).size,3);
  // A committed write whose response is lost must keep its exact request, unlike a confirmed rejection.
  db=database();loseResponse=true;calls.length=0;await page.goto(url);modal=page.getByRole('dialog',{name:'Planificar asignación'});
  await expect(modal.getByRole('combobox',{name:'Responsable de la asignación'})).toBeVisible();await modal.getByRole('combobox',{name:'Responsable de la asignación'}).selectOption('worker-a');
  await modal.getByLabel('Inicio previsto',{exact:true}).fill(input.startsOn);await modal.getByLabel('Fin previsto',{exact:true}).fill(input.endsOn);
  await modal.getByRole('button',{name:'Revisar coincidencias',exact:true}).click();await expect(modal.getByText('Sin coincidencias detectadas en esta revisión',{exact:true})).toBeVisible();await modal.getByRole('checkbox').check();
  await modal.getByRole('button',{name:'Confirmar planificación',exact:true}).click();await expect(modal.getByRole('button',{name:'Verificar el mismo intento'})).toBeVisible();
  await expect(modal.getByLabel('Inicio previsto',{exact:true})).toBeDisabled();await expect(modal.getByRole('region',{name:'Recuperar consulta de planificación'})).toHaveCount(0);
  await modal.getByRole('button',{name:'Verificar el mismo intento'}).click();await expect(page.getByTestId('saved')).toBeVisible();
  const retries=calls.filter(row=>row.path==='/api/execution/assignments'&&row.method==='POST');assert.equal(retries.length,2);assert.equal(retries[0].key,retries[1].key);assert.deepEqual(retries[0].body,retries[1].body);assert.equal(db.state.rows.length,1);assert.equal(db.state.audits.length,1);
  for(const scenario of ['forbidden','foreign']){readFailure=scenario==='forbidden'?403:0;foreignSource=scenario==='foreign';await page.goto(url);modal=page.getByRole('dialog',{name:'Planificar asignación'});await expect(modal.getByRole('alert')).toBeVisible();await expect(modal.getByRole('region',{name:'Recuperar consulta de planificación'})).toHaveCount(0);await expect(modal.getByRole('button',{name:'Confirmar planificación',exact:true})).toBeDisabled();}
  assert.deepEqual(errors,[]);
  const proof={status:'PASS',environment:'real-react-components-and-domain-services-with-controlled-database-and-HTTP',retryReadInPlace:true,knownDuplicateEditable:true,refreshSourcePreservesDraft:true,refreshCannotWrite:true,renewedReviewAndConsent:true,uncertainWriteSameKeyAndBody:true,foreignAndForbiddenSourceBlocked:true,widths:[320,390,768,1280],pageErrors:0,clerkVerified:false,productionDeployed:false};
  writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
