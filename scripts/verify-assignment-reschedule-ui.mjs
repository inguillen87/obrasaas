import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium,expect } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { executionTestConnection } from './lib/execution-test-database.mjs';
const connectionString=executionTestConnection();
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@/'))return next(new URL('../src/'+specifier.slice(2)+(/\.(js|ts|mjs)$/.test(specifier)?'':specifier.startsWith('@/generated/')?'.ts':'.js'),import.meta.url).href,context);return next(specifier,context);}});
const {getAssignmentReschedule,reviewAssignmentReschedule,commitAssignmentReschedule}=await import('../src/lib/assignment-reschedule.js');
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/assignment-reschedule-ui');mkdirSync(out,{recursive:true});
const db=new PrismaClient({adapter:new PrismaPg({connectionString})});
const prefix='replan_ui_'+randomUUID().replaceAll('-',''),id=name=>prefix+'_'+name;
const scope={organizationId:id('org'),projectId:id('work')},actorId=id('actor'),assignmentId=id('assignment'),taskId=id('task'),workerId=id('worker');
const params={scope,actorId,assignmentId},date=day=>new Date('2026-10-'+String(day).padStart(2,'0')+'T00:00:00.000Z');
const calls=[],errors=[];let loseResponse=false,foreign=false,browser,server,originalTask;
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
try {
 await db.platformUser.create({data:{id:actorId,clerkUserId:id('clerk'),primaryEmail:id('mail')+'@invalid.example',fullName:'Actor UI sintético'}});
 await db.organization.create({data:{id:scope.organizationId,name:'Empresa UI',slug:id('slug'),subscriptionPlan:'ENTERPRISE',subscriptionStatus:'ACTIVE'}});
 await db.project.create({data:{id:scope.projectId,organizationId:scope.organizationId,name:'Obra UI',slug:id('project_slug'),status:'ACTIVE'}});
 await db.worker.create({data:{id:workerId,...scope,name:'Persona de ensayo',active:true}});
 for(const suffix of ['','_other']){
  await db.task.create({data:{id:taskId+suffix,projectId:scope.projectId,title:suffix?'Instalaciones · Ensayo':'Mampostería · Ensayo',type:'TASK',metadata:{source:'canonical-task-v1'},progress:10,startsAt:date(1),endsAt:date(3)}});
  await db.taskAssignment.create({data:{id:assignmentId+suffix,projectId:scope.projectId,taskId:taskId+suffix,workerId,status:'PLANNED',startsAt:date(suffix?6:1),endsAt:date(suffix?8:3)}});
 }
 originalTask=await db.task.findUniqueOrThrow({where:{id:taskId}});
 const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import Card from'./src/app/dashboard/execution/assignment-card';import './src/app/globals.css';function App(){const[row,setRow]=useState(window.fixture.assignment);return <main><Card assignment={row} tasks={[window.fixture.task]} workers={[{id:${JSON.stringify(workerId)},name:'Persona de ensayo'}]} teams={[]} organizationId=${JSON.stringify(scope.organizationId)} projectId=${JSON.stringify(scope.projectId)} canManage={!location.search.includes('readonly')} canReadTasks={true} onChanged={setRow}/></main>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
 await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'fixture-link',setup(api){api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:"import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a href={href} {...props}/>;}"}));}}]});
 server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://local');
   if(url.pathname==='/api/execution/assignments/'+assignmentId+'/reschedule'){
    if(req.headers['x-obrasaas-organization']!==scope.organizationId||req.headers['x-obrasaas-project']!==scope.projectId)return json(res,{error:'Contexto inválido'},409);
    let text='';for await(const part of req)text+=part;const input=text?JSON.parse(text):undefined;calls.push({method:req.method,input});
    const result=req.method==='GET'?await getAssignmentReschedule(db,params):req.method==='POST'?await reviewAssignmentReschedule(db,{...params,input}):await commitAssignmentReschedule(db,{...params,input});
    if(req.method==='PATCH'&&loseResponse){loseResponse=false;return json(res,{error:'Respuesta perdida después de guardar'},503);}
    return json(res,foreign?{...result,context:{...scope,projectId:'other'}}:result);
   }
   if(url.pathname==='/bundle.js'||url.pathname==='/bundle.css'){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
   const fixture=await getAssignmentReschedule(db,params);
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial;--assign-bg:#0b1120;--assign-text:#f8fafc;--assign-muted:#94a3b8;--assign-accent:#f59e0b;--assign-border:#334155}body{margin:0;padding:18px;background:#060913;color:#f8fafc}main{max-width:920px;margin:auto}</style><div id="root"></div><script>window.fixture='+JSON.stringify(fixture).replace(/</g,'\\u003c')+'</script><script type="module" src="/bundle.js"></script></html>');
  }catch(error){json(res,{error:error.message,code:error.code},error.status||503);}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:1000},locale:'es-AR'}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const origin='http://127.0.0.1:'+server.address().port;await page.goto(origin);
 await page.getByRole('button',{name:'Reprogramar fechas',exact:true}).click();const modal=page.getByRole('dialog',{name:'Fechas de la asignación'});
 await expect(modal.getByRole('button',{name:'Cerrar fechas de asignación'})).toBeFocused();
 const first=modal.getByLabel('Nuevo inicio previsto',{exact:true}),last=modal.getByLabel('Nuevo fin previsto',{exact:true});
 await expect(first).toBeEnabled();await first.fill('2026-10-02');await last.fill('2026-10-07');
 await expect(modal.getByRole('button',{name:'Guardar reprogramación'})).toBeDisabled();
 await modal.getByRole('button',{name:'Revisar nuevas fechas'}).click();await expect(modal.getByText('Requiere coordinación',{exact:true})).toBeVisible();
 await expect(modal.getByText('1 coincidencias de fechas · 0 con fechas incompletas',{exact:true})).toBeVisible();
 const note=modal.getByRole('textbox',{name:'Motivo de reprogramación'});await note.fill('Reordenamos los trabajos para coordinar el frente norte.');await modal.getByRole('checkbox').check();
 await last.fill('2026-10-08');await expect(modal.getByRole('button',{name:'Guardar reprogramación'})).toBeDisabled();await expect(modal.getByLabel('Resultado de coincidencias')).toHaveCount(0);
 await last.fill('2026-10-07');await modal.getByRole('button',{name:'Revisar nuevas fechas'}).click();await expect(modal.getByText('Requiere coordinación',{exact:true})).toBeVisible();
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});const box=await modal.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'review-'+width+'.png')});}
 page.once('dialog',dialog=>dialog.dismiss());await modal.getByRole('button',{name:'Volver sin cambiar'}).click();await expect(first).toHaveValue('2026-10-02');
 // A real concurrent database change invalidates the reviewed snapshot.
 await db.taskAssignment.update({where:{id:assignmentId+'_other'},data:{revision:{increment:1}}});await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'Guardar reprogramación'}).click();
 await expect(modal.getByRole('button',{name:'Consultar estado sin reenviar'})).toBeVisible();assert.equal(await db.auditLog.count({where:{entityId:assignmentId,action:'execution.task.assignment.rescheduled'}}),0);
 await modal.getByRole('button',{name:'Consultar estado sin reenviar'}).click();await expect(first).toBeEnabled();await expect(first).toHaveValue('2026-10-02');await expect(note).toHaveValue('Reordenamos los trabajos para coordinar el frente norte.');
 await modal.getByRole('button',{name:'Revisar nuevas fechas'}).click();await expect(modal.getByText('Requiere coordinación',{exact:true})).toBeVisible();await modal.getByRole('checkbox').check();loseResponse=true;
 await modal.getByRole('button',{name:'Guardar reprogramación'}).click();await expect(modal.getByRole('button',{name:'Consultar estado sin reenviar'})).toBeVisible();await modal.getByRole('button',{name:'Consultar estado sin reenviar'}).click();await expect(modal).toHaveCount(0);
 assert.equal(calls.filter(row=>row.method==='PATCH').length,2);assert.equal(await db.auditLog.count({where:{entityId:assignmentId,action:'execution.task.assignment.rescheduled'}}),1);
 await expect(page.getByText('02/10/2026 → 07/10/2026',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Reprogramar fechas',exact:true}).click();await expect(modal.getByLabel('Última reprogramación').getByText('Reordenamos los trabajos para coordinar el frente norte.',{exact:true})).toBeVisible();
 for(const width of [390,1280]){await page.setViewportSize({width,height:width<500?844:1000});await page.screenshot({path:resolve(out,'saved-'+width+'.png')});}
 await page.goto(origin+'/?readonly=1');await page.getByRole('button',{name:'Ver fechas y cambios',exact:true}).click();await expect(modal.getByText('Consulta de fechas:',{exact:false})).toBeVisible();await expect(modal.getByRole('button',{name:'Guardar reprogramación'})).toHaveCount(0);
 await modal.getByRole('button',{name:'Cerrar fechas de asignación'}).click();foreign=true;await page.getByRole('button',{name:'Ver fechas y cambios',exact:true}).click();await expect(modal.getByRole('alert')).toContainText('no corresponde');await expect(modal.getByLabel('Nuevo inicio previsto')).toHaveCount(0);
 assert.deepEqual(await db.task.findUniqueOrThrow({where:{id:taskId}}),originalTask);assert.equal(await db.taskAssignment.count({where:{projectId:scope.projectId}}),2);assert.deepEqual(errors,[]);
 const proof={result:'PASS',data:'PostgreSQL 17 real con servicios de aplicación y personas sintéticas',identity:'sesión simulada del fixture; no Clerk',originalAssignmentPreserved:true,reviewInvalidatedByDatabaseChange:true,lostSaveRecoveredByGet:true,plannedDatesSurviveReload:true,taskAndProgressUnchanged:true,readonlyAndForeignContext:true,widths:[320,390,768,1280],patchRequests:2,persistedReplans:1,pageErrors:0};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();if(server)await new Promise(done=>server.close(done));await db.$disconnect();}
