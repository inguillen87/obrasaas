import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/gantt-enterprise-ui');
mkdirSync(out,{recursive:true});
const tasks={
  'task-a':{name:'Excavación bases',assignee:'Ana Pérez',progress:100,duration:3,startDay:1,dependencies:[],dependencySpecs:[],revision:1,status:'DONE'},
  'task-b':{name:'Hormigonado losa',assignee:'Juan Silva',progress:50,duration:3,startDay:5,dependencies:['task-a'],dependencySpecs:[{predecessorId:'task-a',type:'FINISH_TO_START',lagDays:0}],revision:2,status:'IN_PROGRESS'},
  'task-c':{name:'Tablero eléctrico',assignee:'María Gómez',progress:0,duration:2,startDay:5,dependencies:['task-b'],dependencySpecs:[{predecessorId:'task-b',type:'FINISH_TO_START',lagDays:0}],revision:0,status:'READY'},
  'task-d':{name:'Terminaciones PB',assignee:'Sin asignar',progress:0,duration:4,startDay:12,dependencies:[],dependencySpecs:[],revision:0,status:'READY'}
};
const entry=`import React from'react';import{createRoot}from'react-dom/client';import Gantt from'./src/app/dashboard/gantt-planner';createRoot(document.getElementById('root')).render(<React.StrictMode><Gantt canManage={false} canonicalMode={true} tasks={${JSON.stringify(tasks)}} fieldWorkers={[]} project={{id:'p-a',name:'Obra Norte · Ensayo',startsAt:'2026-09-01',endsAt:'2026-09-30'}} fieldStatus={{tasks:[]}}/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'next-link',setup(api){api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,onClick,prefetch,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)onNavigate?.(event);}}/>}`}));}}]});
let requests=[],errors=[];
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://local');requests.push({method:req.method,path:url.pathname});
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;padding:18px;background:#060913;color:#f8fafc;font:16px Arial;--font-heading:Arial;--primary:#f59e0b;--success:#10b981;--danger:#ef4444;--border-color:#334155;--text-primary:#f8fafc;--text-secondary:#94a3b8;--text-muted:#64748b;--bg-card:#0b1120}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 page=await browser.newPage({viewport:{width:1280,height:920},locale:'es-AR'});page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const planner=page.locator('div').filter({has:page.getByRole('heading',{name:'Cronograma & dependencias',level:1})}).first();
 await expect(page.getByRole('heading',{name:'Cronograma & dependencias',level:1})).toBeVisible();
 const metrics=page.getByRole('region',{name:'Indicadores del cronograma'}).getByRole('article');await expect(metrics).toHaveCount(4);
 await expect(metrics.nth(0)).toContainText('38%');await expect(metrics.nth(1)).toContainText('3');await expect(metrics.nth(2)).toContainText('2');await expect(metrics.nth(3)).toContainText('1');
 const before=requests.length;const search=page.getByRole('searchbox',{name:'Buscar',exact:true});
 await search.fill('hormigonado');await expect(page.getByRole('status')).toContainText('2 coincidencias');assert.equal(requests.length,before);
 await expect(page.getByRole('button',{name:/Hormigonado losa/})).toBeVisible();await expect(page.getByRole('button',{name:/Tablero eléctrico/})).toBeVisible();
 const mutedRows=page.locator('[class*="searchMuted"]');await expect(mutedRows).toHaveCount(2);
 await expect.poll(async()=>Number(await mutedRows.first().evaluate(el=>getComputedStyle(el).opacity))).toBeLessThan(0.5);
 await search.fill('');assert.equal(requests.length,before);
 await page.getByRole('button',{name:'Días',exact:true}).click();await expect(page.getByRole('button',{name:'Días',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:920});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow '+width);const scroller=page.locator('[class*="scroller"]').first();assert.ok(await scroller.evaluate(el=>el.scrollWidth>=el.clientWidth));if([390,1280].includes(width))await page.screenshot({path:resolve(out,'gantt-'+width+'.png'),fullPage:true});}
 assert.equal(requests.some(r=>r.path.startsWith('/api/')),false);assert.deepEqual(errors,[]);
 const proof={status:'PASS',environment:'real-GanttPlanner-readonly-canonical-synthetic-catalog',realBusinessData:false,canonicalMode:true,apiRequests:0,searchPreservesGraph:true,widths:[320,390,768,1280],pageErrors:0};
 writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack},null,2));await page?.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();await new Promise(done=>server.close(done));}
