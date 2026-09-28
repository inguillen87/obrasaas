import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/libro-obra-ui');mkdirSync(out,{recursive:true});
const logs=[
 {id:'log-a',projectId:'project-a',title:'Hormigonado de losa',summary:'Sector norte, registro real de ensayo controlado.',status:'DRAFT',revision:1,workDate:'2026-09-25',taskId:'task-a'},
 {id:'log-b',projectId:'project-a',title:'Revisión de armadura',summary:'Eje B preparado para inspección.',status:'SUBMITTED',revision:2,workDate:'2026-09-24',taskId:null},
 {id:'log-c',projectId:'project-a',title:'Cierre de encofrado',summary:'Planta baja completada.',status:'APPROVED',revision:3,workDate:'2026-09-23',taskId:'task-c'},
 {id:'log-d',projectId:'project-a',title:'Corrección de replanteo',summary:'Sector sur.',status:'REJECTED',revision:1,workDate:'2026-09-22',taskId:null,rejectionReason:'Falta referencia de eje.'}
];
const data={dailyLogs:logs,evidence:[],timeline:[],page:{limit:50,hasMore:false,nextBefore:null}};
const entry=`import React from'react';import{createRoot}from'react-dom/client';import Progress from'./src/app/dashboard/progress/progress-client';import './src/app/globals.css';createRoot(document.getElementById('root')).render(<React.StrictMode><Progress initialData={${JSON.stringify(data)}} initialVisualAssessments={[]} tasks={[{id:'task-a',title:'Estructura'},{id:'task-c',title:'Encofrado'}]} workers={[]} permissions={{canManage:false,canReadSchedule:true,canReadMeasurements:false,canReviewJournal:false,canReadSourceEvidence:false,canUseReviewedEvidence:false,canUseVisualProgress:false,visualProgressEnabled:false}} projectName="Obra Norte · Ensayo" organizationId="org-a" projectId="project-a" initialWorkDate="2026-09-25"/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'local-link',setup(api){api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,onClick,prefetch,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)onNavigate?.(event);}}/>}`}));}}]});
let calls=[],errors=[];
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://local');calls.push({method:req.method,path:url.pathname});
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#eef3f1;color:#15252c;font-family:Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000},locale:'es-AR'});page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const main=page.getByRole('main');await expect(main.getByRole('heading',{name:'Libro de Obra & evidencia',level:1})).toBeVisible();
 const stats=main.getByRole('region',{name:'Resumen del Libro de Obra'}).getByRole('article');await expect(stats).toHaveCount(4);await expect(stats.nth(0)).toContainText('4');await expect(stats.nth(1)).toContainText('1');await expect(stats.nth(2)).toContainText('1');await expect(stats.nth(3)).toContainText('0');
 const journal=main.locator('#libro-obra-registros');await expect(journal.getByRole('listitem')).toHaveCount(4);const before=calls.length;
 const search=journal.getByRole('searchbox',{name:'Buscar',exact:true}),status=journal.getByRole('combobox',{name:'Estado',exact:true});
 await search.fill('hormigon norte');await expect(journal.getByRole('listitem')).toHaveCount(1);await expect(journal.getByText('Hormigonado de losa',{exact:true})).toBeVisible();assert.equal(calls.length,before);
 await search.fill('');await status.selectOption('SUBMITTED');await expect(journal.getByRole('listitem')).toHaveCount(1);await expect(journal.getByText('Revisión de armadura',{exact:true})).toBeVisible();assert.equal(calls.length,before);
 await status.selectOption('ALL');await search.fill('ninguna coincidencia');await expect(journal.getByText('No hay asientos que coincidan con la búsqueda y el estado seleccionados.',{exact:true})).toBeVisible();assert.equal(calls.length,before);
 await search.fill('');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:980});await main.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'libro-'+width+'.png'),fullPage:true});}
 assert.equal(calls.some(call=>call.path.startsWith('/api/')),false);assert.deepEqual(errors,[]);
 const proof={status:'PASS',environment:'real-ProgressClient-readonly-synthetic-records',realBusinessData:false,localSearchRequests:0,httpWrites:0,widths:[320,390,768,1280],pageErrors:0};
 writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack},null,2));await page?.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();await new Promise(done=>server.close(done));}
