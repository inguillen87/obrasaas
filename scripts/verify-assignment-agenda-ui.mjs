import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/assignment-agenda-ui');
mkdirSync(out,{recursive:true});
const tasks=[{id:'t1',code:'EST-08',title:'Hormigón de planta baja',type:'TASK',revision:3},{id:'t2',code:'MAM-12',title:'Tabiques del ala norte',type:'TASK',revision:3}];
const workers=[{id:'w1',name:'José Álvarez'}],teams=[{id:'c1',name:'Cuadrilla Norte',status:'ACTIVE',revision:0,members:[]}];
const iso=day=>day?day+'T00:00:00.000Z':null;
const row=(id,start,end,extra={})=>({id,projectId:'p1',taskId:'t1',workerId:'w1',teamId:null,status:'PLANNED',revision:0,startsAt:iso(start),endsAt:iso(end),...extra});
const rows=[row('late','2026-09-01','2026-09-20'),row('today','2026-09-23','2026-09-25',{taskId:'t2',status:'ACTIVE'}),
  row('soon','2026-09-25','2026-09-27',{taskId:'t2',workerId:null,teamId:'c1'}),row('later','2026-10-01','2026-10-02'),
  row('undated',null,null),row('invalid','2026-09-30','2026-09-26'),row('closed','2026-09-01','2026-09-02',{status:'ENDED'}),row('foreign','2026-09-01','2026-09-20',{projectId:'p2'})];
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import Board from './src/app/dashboard/execution/assignment-board';import './src/app/globals.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><Board assignments={${JSON.stringify(rows)}} tasks={${JSON.stringify(tasks)}} workers={${JSON.stringify(workers)}} teams={${JSON.stringify(teams)}} permissions={{canManage:!location.search.includes('readonly'),canReadTasks:true}} organizationId="org-a" projectId="p1" timeZone="America/Argentina/Buenos_Aires" agendaDay="2026-09-23" onChanged={()=>{throw new Error('Agenda must not write assignments')}}/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'test-links',setup(api){
  api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
  api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={event=>onNavigate?.(event)}/>} `}));
}}]});
let apiCalls=0;const errors=[];
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname.startsWith('/api/')){apiCalls++;res.writeHead(503);res.end('No API fixture is permitted for the read-only agenda.');return;}
  if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial;--bg-main:#060913;--text-primary:#f8fafc;--text-secondary:#94a3b8;--border-color:#334155}body{margin:0;padding:12px;background:#060913}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:1000},locale:'es-AR'}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));const origin='http://127.0.0.1:'+server.address().port;await page.goto(origin);
  const board=page.getByRole('region',{name:'Planificación y seguimiento de asignaciones'}),agenda=page.getByRole('region',{name:'Agenda de asignaciones',exact:true});
  const cards=board.getByRole('article'),date=agenda.getByLabel('Fecha de referencia de la agenda'),search=board.getByRole('searchbox',{name:'Buscar asignaciones'});
  const tile=name=>agenda.getByRole('button',{name:new RegExp('^'+name)});
  await expect(cards).toHaveCount(7);await expect(date).toHaveValue('2026-09-23');
  await expect(tile('Fin previsto vencido').locator('strong')).toHaveText('1');await expect(tile('Previstas para la fecha').locator('strong')).toHaveText('1');
  await expect(tile('Próximos inicios').locator('strong')).toHaveText('1');await expect(tile('Completar o revisar fechas').locator('strong')).toHaveText('2');
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:width<500?844:1000});await agenda.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal page overflow at '+width);
    assert.equal(await agenda.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'No clipped agenda at '+width);
    for(const button of await agenda.getByRole('button').all()){const box=await button.boundingBox();assert.ok(box.height>=44,'Touch target below 44px');}
    if([390,1280].includes(width))await agenda.screenshot({path:resolve(out,'agenda-'+width+'.png')});
  }
  await tile('Fin previsto vencido').click();await expect(cards).toHaveCount(1);await expect(cards).toContainText('20/09/2026');
  await search.fill('hormigon jose');await expect(cards).toHaveCount(1);await search.fill('sin resultados');await expect(cards).toHaveCount(0);
  await expect(tile('Fin previsto vencido').locator('strong')).toHaveText('1');await board.getByRole('button',{name:'Limpiar filtros',exact:true}).click();await expect(cards).toHaveCount(7);
  await tile('Próximos inicios').click();await search.fill('MAM-12 norte');await expect(cards).toHaveCount(1);await expect(cards).toContainText('Cuadrilla Norte');
  await agenda.getByRole('button',{name:'Mostrar todas las asignaciones'}).click();await tile('Completar o revisar fechas').click();await expect(cards).toHaveCount(2);
  await expect(agenda).toContainText('1 con fechas incompletas · 1 con fechas que requieren revisión');
  await agenda.getByRole('button',{name:'Mostrar todas las asignaciones'}).click();await date.fill('2026-09-27');
  await expect(tile('Fin previsto vencido').locator('strong')).toHaveText('2');await tile('Previstas para la fecha').click();await expect(cards).toHaveCount(1);await expect(cards).toContainText('27/09/2026');
  await date.fill('');await expect(cards).toHaveCount(6);await expect(tile('Fin previsto vencido')).toBeDisabled();await expect(agenda.getByRole('status')).toContainText('No se asumió la fecha del dispositivo');
  await date.fill('2026-09-23');await agenda.getByRole('button',{name:'Mostrar todas las asignaciones'}).click();
  const late=cards.filter({hasText:'20/09/2026'});await late.getByRole('button',{name:'Iniciar asignación'}).click();
  const note=late.getByRole('textbox',{name:'Explicación del cambio de Hormigón de planta baja'});await note.fill('Conservar este borrador antes de filtrar.');
  page.once('dialog',dialog=>dialog.dismiss());await tile('Próximos inicios').click();await expect(cards).toHaveCount(7);await expect(note).toHaveValue('Conservar este borrador antes de filtrar.');
  page.once('dialog',dialog=>dialog.dismiss());await date.fill('2026-09-24');await expect(date).toHaveValue('2026-09-23');await expect(note).toHaveValue('Conservar este borrador antes de filtrar.');
  page.once('dialog',dialog=>dialog.accept());await tile('Próximos inicios').click();await expect(cards).toHaveCount(1);
  await page.goto(origin+'/?readonly');await expect(board.getByRole('button',{name:'Planificar asignación',exact:true})).toHaveCount(0);
  await tile('Fin previsto vencido').click();await expect(cards).toHaveCount(1);await expect(board.getByRole('button',{name:'Iniciar asignación'})).toHaveCount(0);
  assert.equal(apiCalls,0);assert.deepEqual(errors,[]);
  const proof={result:'PASS',environment:'real-React-board-and-controls-with-synthetic-records',widths:[320,390,768,1280],referenceDateFilters:true,accentAndCodeSearch:true,countsBeforeSearch:true,scopeDefense:true,unknownDatesNotInferred:true,draftGuardDismissedAndAccepted:true,auditorHasNoWriteControls:true,apiCalls,writeCalls:0,pageErrors:errors.length,authenticated:false};
  writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log('AGENDA_BROWSER_PROOF '+JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
