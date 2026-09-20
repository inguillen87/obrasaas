import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium,expect } from '@playwright/test';
import { normalizeAssignmentPlan } from '../src/lib/task-assignment-policy.js';
import { reviewedAssignmentInput } from '../src/lib/assignment-overlap-policy.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/task-assignments-ui');mkdirSync(out,{recursive:true});
const tasks=[{id:'task-a',title:'Mampostería · Ensayo Norte',type:'TASK',revision:3}],workers=[{id:'worker-a',name:'Persona de ensayo'}],teams=[{id:'team-a',name:'Cuadrilla de ensayo',status:'ACTIVE',revision:0,members:[]}];
const scope={organizationId:'org-a',projectId:'project-a'};
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import Execution from './src/app/dashboard/execution/execution-client';import './src/app/globals.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><Execution initialData={window.fixture} tasks={${JSON.stringify(tasks)}} workers={${JSON.stringify(workers)}} permissions={{canManage:!location.search.includes('readonly'),canReadTasks:true}} organizationId="org-a" projectId="project-a" focusedTask={${JSON.stringify(tasks[0])}}/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'test-links',setup(api){
  api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
  api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={event=>onNavigate?.(event)}/>} `}));
}}]});
let assignment=null,losePlan=true,loseDecision=true;const calls=[],errors=[];
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname==='/api/execution/assignments'&&req.method==='GET'){
    calls.push({type:'PREPARE',taskId:url.searchParams.get('taskId')});return json(res,{context:scope,task:tasks[0],canCreate:true,owners:{workers,teams,truncated:false}});
  }
  if(url.pathname==='/api/execution/assignments/review'&&req.method==='POST'){
    let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{const plan=normalizeAssignmentPlan(JSON.parse(text));json(res,{context:scope,plan,version:'a'.repeat(64),warnings:false,summary:{overlaps:0,incomplete:0,proposedDatesIncomplete:false,rosterUnverified:false},totalFindings:0,findings:[]});});return;
  }
  if(url.pathname==='/api/execution/assignments'&&req.method==='POST'){
    let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{const input=JSON.parse(text),plan=reviewedAssignmentInput(input).plan,key=req.headers['idempotency-key'];
      calls.push({type:'CREATE',input,key,organization:req.headers['x-obrasaas-organization'],project:req.headers['x-obrasaas-project']});
      const replayed=Boolean(assignment);assignment ||= {id:'assignment-fixture',projectId:'project-a',taskId:plan.taskId,workerId:plan.workerId,teamId:plan.teamId,startsAt:plan.startsAt,endsAt:plan.endsAt,status:'PLANNED',revision:0};
      if(losePlan){losePlan=false;return json(res,{error:'Respuesta interrumpida después de guardar'},503);}json(res,{context:scope,assignment,replayed});});return;
  }
  if(url.pathname==='/api/execution/assignments/assignment-fixture'){
    if(req.method==='GET'){calls.push({type:'READ'});return json(res,{context:scope,assignment});}
    let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{const input=JSON.parse(text);calls.push({type:'DECIDE',input});assert.equal(input.expectedRevision,assignment.revision);
      assignment={...assignment,status:input.status,revision:assignment.revision+1,lastDecision:{status:input.status,revision:assignment.revision+1,note:input.note,at:new Date().toISOString()}};
      if(loseDecision){loseDecision=false;return json(res,{error:'Respuesta de cambio perdida'},503);}json(res,{context:scope,assignment});});return;
  }
  if(url.pathname==='/bundle.js'||url.pathname==='/bundle.css'){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
  const stored=assignment?{...assignment,lastDecision:null}:null;
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial;--bg-main:#060913;--text-primary:#f8fafc;--text-secondary:#94a3b8;--border-color:#334155}body{margin:0;padding:12px;background:#060913}</style><div id="root"></div><script>window.fixture='+JSON.stringify({teams,assignments:stored?[stored]:[],blockers:[]})+'</script><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000},locale:'es-AR'});
  const origin='http://127.0.0.1:'+server.address().port,page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/dashboard/execution?taskId=task-a');
  const board=page.getByRole('region',{name:'Planificación y seguimiento de asignaciones'});
  await board.getByRole('button',{name:'Planificar asignación',exact:true}).click();let modal=page.getByRole('dialog',{name:'Planificar asignación'});
  await expect(modal.getByRole('button',{name:'Cerrar planificación'})).toBeFocused();await modal.getByRole('button',{name:'Cerrar planificación'}).click();assert.equal(calls.filter(c=>c.type==='CREATE').length,0);
  await board.getByRole('button',{name:'Planificar asignación',exact:true}).click();modal=page.getByRole('dialog',{name:'Planificar asignación'});
  await modal.getByRole('button',{name:'Una cuadrilla',exact:true}).click();await modal.getByRole('combobox',{name:'Responsable de la asignación'}).selectOption('team-a');
  await modal.getByLabel('Inicio previsto',{exact:true}).fill('2026-09-21');await modal.getByLabel('Fin previsto',{exact:true}).fill('2026-09-25');
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:width<500?844:1000});const box=await modal.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    if([390,1280].includes(width))await page.screenshot({path:resolve(out,'plan-'+width+'.png')});
  }
  page.once('dialog',dialog=>dialog.dismiss());await modal.getByRole('button',{name:'Volver sin confirmar'}).click();await expect(modal.getByRole('combobox',{name:'Responsable de la asignación'})).toHaveValue('team-a');
  await modal.getByRole('button',{name:'Revisar coincidencias',exact:true}).click();await expect(modal.getByText('Sin coincidencias detectadas en esta revisión',{exact:true})).toBeVisible();
  await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'Confirmar planificación'}).click();
  await expect(modal.getByRole('button',{name:'Verificar el mismo intento'})).toBeVisible();await expect(modal.getByRole('combobox',{name:'Responsable de la asignación'})).toHaveValue('team-a');
  await modal.getByRole('button',{name:'Verificar el mismo intento'}).click();await expect(modal).toHaveCount(0);
  const creates=calls.filter(c=>c.type==='CREATE');assert.equal(creates.length,2);assert.equal(creates[0].key,creates[1].key);assert.deepEqual(creates[0].input,creates[1].input);
  const card=board.getByRole('article',{name:'Asignación de Mampostería · Ensayo Norte'});await expect(card.getByText('Planificada',{exact:true})).toBeVisible();await expect(card.getByText('Cuadrilla de ensayo',{exact:true})).toBeVisible();
  await card.getByRole('button',{name:'Iniciar asignación'}).click();const note=card.getByRole('textbox',{name:'Explicación del cambio de Mampostería · Ensayo Norte'});
  await note.fill('Cuadrilla disponible y responsable informado.');await card.getByRole('checkbox').check();await card.getByRole('button',{name:'Confirmar cambio'}).click();
  await expect(card.getByRole('button',{name:'Consultar estado sin reenviar'})).toBeVisible();await card.getByRole('button',{name:'Consultar estado sin reenviar'}).click();
  await expect(card.getByText('En curso',{exact:true})).toBeVisible();assert.equal(calls.filter(c=>c.type==='DECIDE').length,1);
  await card.getByRole('button',{name:'Finalizar asignación'}).click();await note.fill('Asignación finalizada. El avance físico se verificará por separado.');await card.getByRole('checkbox').check();await card.getByRole('button',{name:'Confirmar cambio'}).click();
  await expect(card.getByText('Finalizada',{exact:true})).toBeVisible();await expect(card.getByRole('button',{name:'Iniciar asignación'})).toHaveCount(0);assert.equal(assignment.revision,2);assert.equal(assignment.startsAt,'2026-09-21T00:00:00.000Z');
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Board overflow at '+width);if([390,1280].includes(width))await board.screenshot({path:resolve(out,'board-'+width+'.png')});}
  await page.reload();await board.getByRole('button',{name:'Consultar última decisión'}).click();await expect(board.getByText('Asignación finalizada. El avance físico se verificará por separado.',{exact:true})).toBeVisible();
  assert.equal(await board.getByRole('link',{name:'Ver actividad en el Gantt →'}).getAttribute('href'),'/dashboard?tab=sec-gantt&fieldTaskId=task-a');
  await page.goto(origin+'/dashboard/execution?readonly=1');await expect(board.getByRole('button',{name:'Planificar asignación',exact:true})).toHaveCount(0);assert.equal(calls.filter(c=>c.type==='DECIDE').length,2);assert.deepEqual(errors,[]);
  const proof={result:'PASS',environment:'real-ExecutionClient-and-assignment-components-with-synthetic-HTTP',prepareWithoutWrite:true,explicitTaskAndOwner:true,identicalPlanRetry:true,lostDecisionRecoveredByRead:true,plannedActiveEnded:true,terminalNoReopen:true,taskDatesUnchanged:true,reloadReadsSavedDecision:true,readOnlyRole:true,widths:[320,390,768,1280],planRequests:creates.length,decisionRequests:2,pageErrors:0};
  writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
