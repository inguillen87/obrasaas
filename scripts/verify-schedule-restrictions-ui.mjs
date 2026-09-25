import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { readTaskRestrictionStatus } from '../src/lib/task-restriction-status.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/schedule-restrictions-ui');mkdirSync(out,{recursive:true});
const blocker={id:'blocker-a',projectId:'project-a',taskId:'task-a',title:'Faltante de material de ensayo',description:'Restricción sintética para verificar navegación y resolución.',status:'OPEN',severity:'CRITICAL',ownerWorkerId:'worker-a',revision:0,dueAt:'2026-09-18T12:00:00Z',createdAt:'2026-09-18T10:00:00Z',updatedAt:'2026-09-18T10:00:00Z'};
const tasks=[{id:'task-a',title:'Mampostería · Norte',type:'TASK'},{id:'task-b',title:'Terminaciones · Sur',type:'TASK'}];
const ganttTasks=Object.fromEntries(tasks.map(task=>[task.id,{name:task.title,assignee:'Sin asignar',progress:10,duration:6,startDay:1,revision:2,dependencies:[]} ]));
const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{usePathname}from'next/navigation';import Panel from './src/app/dashboard/schedule-field-panel';import Gantt from './src/app/dashboard/gantt-planner';import Execution from './src/app/dashboard/execution/execution-client';import './src/app/globals.css';
function App(){const[status,setStatus]=useState(null),path=usePathname();return <main><p>ENSAYO LOCAL · DATOS SINTÉTICOS</p>{path==='/dashboard/execution'?<Execution initialData={{teams:[],assignments:[],blockers:[${JSON.stringify(blocker)}]}} workers={[{id:'worker-a',name:'Responsable de ensayo'}]} tasks={${JSON.stringify(tasks)}} focusedTask={${JSON.stringify(tasks[0])}} organizationId="org-a" projectId="project-a" permissions={{canManage:true,canReadTasks:true}}/>:<><Panel organizationId="org-a" projectId="project-a" onSnapshot={setStatus}/><Gantt canManage={false} canonicalMode tasks={${JSON.stringify(ganttTasks)}} fieldWorkers={[]} project={{id:'project-a',name:'Obra sintética',startsAt:'2026-09-18'}} fieldStatus={status}/></>}</main>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
const navigation=`import{useSyncExternalStore}from'react';const subscribe=fn=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)};const useURL=()=>useSyncExternalStore(subscribe,()=>location.href);export function usePathname(){return new URL(useURL()).pathname}export function useSearchParams(){return new URL(useURL()).searchParams}`;
const link=`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={event=>{onNavigate?.(event);if(!event.defaultPrevented){event.preventDefault();history.pushState({},'',href);window.dispatchEvent(new Event('popstate'));}}}/>} `;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,platform:'browser',format:'esm',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'next-fixture',setup(api){api.onResolve({filter:/^next\/(navigation|link)$/},args=>({path:args.path,namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path.endsWith('link')?link:navigation,loader:'jsx',resolveDir:root}));}}]});
let denied=false;const reads=[],writes=[],errors=[];
async function snapshot(taskId){
 const selected=taskId?tasks.filter(task=>task.id===taskId):tasks;
 const restrictionMap=await readTaskRestrictionStatus({projectBlocker:{groupBy:async({where})=>where.taskId.in.includes('task-a')?[{taskId:'task-a',status:blocker.status,severity:blocker.severity,_count:{_all:1},_min:{dueAt:blocker.dueAt},_max:{updatedAt:blocker.updatedAt}}]:[]}}, {organizationId:'org-a',projectId:'project-a',taskIds:selected.map(task=>task.id),now:new Date('2026-09-19T12:00:00Z')});
 const result={organizationId:'org-a',projectId:'project-a',projectName:'Obra sintética',canReadMeasurements:true,unassignedParts:0,page:{limit:50,hasMore:false,nextAfter:null},tasks:selected.map(task=>({...task,operationalProgress:10,revision:2,evidence:{total:2,approved:1,pending:1,rejected:0},reports:{total:1,approved:1,pending:0,rejected:0},measured:{percent:'20.0000',completed:'20',baseline:'100',unit:'M2',revision:1},restrictions:restrictionMap.get(task.id)}))};
 return {...result,version:createHash('sha256').update(JSON.stringify(result)).digest('hex'),checkedAt:new Date().toISOString()};
}
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://fixture');
 if(url.pathname==='/api/schedule/field-status'){
  reads.push({project:req.headers['x-obrasaas-project'],org:req.headers['x-obrasaas-organization']});if(denied)return json(res,{error:'Acceso revocado'},403);
  const data=await snapshot(url.searchParams.get('taskId'));res.setHeader('ETag','"field-'+data.version+'"');return json(res,data);
 }
 if(url.pathname==='/api/execution/blockers/blocker-a'&&req.method==='PATCH'){
  let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{const input=JSON.parse(body);writes.push(input);assert.equal(input.expectedRevision,blocker.revision);assert.equal(input.status,'RESOLVED');assert.equal(req.headers['x-obrasaas-project'],'project-a');assert.equal(req.headers['x-obrasaas-organization'],'org-a');Object.assign(blocker,{status:'RESOLVED',resolution:input.resolution,revision:blocker.revision+1,updatedAt:new Date().toISOString()});json(res,{blocker});});return;
 }
 if(url.pathname==='/bundle.js'||url.pathname==='/bundle.css'){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial;--border-color:#334155;--text-secondary:#94a3b8}body{padding:8px}main>p{padding:12px;font-size:12px}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000}});const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port+'/dashboard?tab=sec-gantt');
 const panel=page.getByRole('region',{name:'Evidencia y avance en el cronograma'}),risk=page.getByRole('region',{name:'Restricciones de Mampostería · Norte'});
 await expect(risk.getByText('1 restricción activa',{exact:true})).toBeVisible();await expect(risk.getByText('Prioridad crítica: 1')).toBeVisible();await expect(risk.getByText(/Hay un plazo registrado vencido/)).toBeVisible();
 await expect(page.getByText('1 restricción activa · prioridad crítica · plazo vencido',{exact:true})).toBeVisible();
 await panel.getByRole('checkbox',{name:'Mostrar sólo tarjetas con restricciones'}).check();await expect(panel.getByRole('heading',{name:'Terminaciones · Sur'})).toHaveCount(0);
 await panel.getByRole('checkbox',{name:'Mostrar sólo tarjetas con restricciones'}).uncheck();await expect(panel.getByRole('heading',{name:'Terminaciones · Sur'})).toBeVisible();
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:1000});const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.equal(await panel.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
  if([390,1280].includes(width))await panel.screenshot({path:resolve(out,'gantt-restrictions-'+width+'.png')});
 }
 assert.equal(writes.length,0);await risk.getByRole('link',{name:'Ver responsables y seguimiento'}).click();assert.equal(new URL(page.url()).searchParams.get('taskId'),'task-a');
 const card=page.locator('#blocker-blocker-a');await expect(card.getByText('Responsable de ensayo',{exact:true})).toBeVisible();await expect(page.getByText('Restricciones de: Mampostería · Norte',{exact:true})).toBeVisible();
 await card.getByRole('button',{name:'Preparar resolución'}).click();await card.getByRole('textbox',{name:'Resolución de Faltante de material de ensayo'}).fill('Se verificó la provisión para el ensayo. No representa una compra real.');
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('link',{name:'Volver a la actividad del Gantt'}).click();assert.equal(new URL(page.url()).pathname,'/dashboard/execution');assert.equal(writes.length,0);
 await card.getByRole('checkbox').check();await card.getByRole('button',{name:'Confirmar resolución'}).click();await expect(card.getByRole('region',{name:'Resolución registrada'})).toBeVisible();assert.equal(writes.length,1);
 await page.getByRole('link',{name:'Volver a la actividad del Gantt'}).click();
 await expect(risk.getByText('Sin restricciones activas registradas',{exact:true})).toBeVisible();await expect(risk.getByText('1 resueltas · 0 canceladas',{exact:true})).toBeVisible();await expect(risk.getByText(/plazo registrado vencido/)).toHaveCount(0);
 await expect(panel.getByText('10%',{exact:true})).toBeVisible();await expect(panel.getByText('20%',{exact:true})).toBeVisible();await expect(page.getByText('1 restricción activa · prioridad crítica · plazo vencido',{exact:true})).toHaveCount(0);
 denied=true;await panel.getByRole('button',{name:'Actualizar ahora'}).click();await expect(panel.getByRole('alert')).toHaveText('Acceso revocado');await expect(risk).toHaveCount(0);
 assert.ok(reads.every(read=>read.project==='project-a'&&read.org==='org-a'));assert.deepEqual(errors,[]);
 const proof={result:'PASS',environment:'real-components-and-restriction-aggregation-with-synthetic-HTTP-and-identity',taskSignals:true,pageOnlyFilter:true,exactTaskNavigation:true,reviewBeforeResolution:true,unsavedResolutionProtected:true,resolutionRemovesActiveRisk:true,progressUnchanged:true,deniedContextClearsPanel:true,widths:[320,390,768,1280],resolutionRequests:writes.length,pageErrors:errors.length};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
