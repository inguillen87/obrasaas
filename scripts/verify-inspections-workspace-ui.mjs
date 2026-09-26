import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/inspections-workspace-ui');
mkdirSync(out,{recursive:true});
const templates=[
 {key:'SEGURIDAD',title:'Seguridad e higiene',version:1,items:[{key:'item-1',label:'Protecciones colectivas'}]},
 {key:'HORMIGONADO',title:'Pre-hormigonado',version:1,items:[{key:'item-1',label:'Armaduras y recubrimientos según proyecto'}]},
 {key:'ELECTRICA',title:'Instalación eléctrica',version:1,items:[{key:'item-1',label:'Protecciones eléctricas'}]},
];
const records=[
 {id:'i-a',title:'Pre-hormigonado losa',location:'Nivel 2',status:'DRAFT',version:1,templateKey:'HORMIGONADO',createdAt:'2026-09-25T12:00:00.000Z'},
 {id:'i-b',title:'Seguridad semanal',location:'Acceso norte',status:'SUBMITTED',version:2,templateKey:'SEGURIDAD',createdAt:'2026-09-24T12:00:00.000Z'},
 {id:'i-c',title:'Tablero eléctrico',location:'Sala técnica',status:'APPROVED',version:3,templateKey:'ELECTRICA',createdAt:'2026-09-23T12:00:00.000Z'},
 {id:'i-d',title:'Seguridad observada',location:'Andamio sur',status:'OBSERVED',version:4,templateKey:'SEGURIDAD',createdAt:'2026-09-22T12:00:00.000Z'},
 {id:'i-e',title:'Inspección rechazada',location:'Subsuelo',status:'REJECTED',version:2,templateKey:'HORMIGONADO',createdAt:'2026-09-21T12:00:00.000Z'},
];
const entry=`import React from'react';import{createRoot}from'react-dom/client';import Workspace from'./src/app/dashboard/inspections/workspace';import './src/app/globals.css';createRoot(document.getElementById('root')).render(<React.StrictMode><Workspace projectName="Obra Norte · Ensayo" templates={${JSON.stringify(templates)}} canManage={false} canReview={false}/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'next-link',setup(api){api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,onClick,prefetch,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)onNavigate?.(event);}}/>}`}));}}]});
let calls=[],errors=[];
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(body));};
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://local');calls.push({method:req.method,path:url.pathname,query:url.search});
 if(url.pathname==='/api/inspections'&&req.method==='GET')return json(res,{records,hasMore:false,page:0});
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913;color:#f8fafc;font-family:Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000},locale:'es-AR'});page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const shell=page.locator('main,div').filter({has:page.getByRole('heading',{name:'Inspecciones QA/QC'})}).first();
 await expect(page.getByRole('heading',{name:'Inspecciones QA/QC'})).toBeVisible();
 const stats=page.getByRole('region',{name:'Resumen de inspecciones de esta página'}).getByRole('article');await expect(stats).toHaveCount(4);
 await expect(stats.nth(0)).toContainText('5');await expect(stats.nth(1)).toContainText('1');await expect(stats.nth(2)).toContainText('1');await expect(stats.nth(3)).toContainText('2');
 await expect(page.getByText('5 registros en esta página',{exact:true})).toBeVisible();
 const apiCallsBefore=calls.filter(call=>call.path.startsWith('/api/')).length;
 const search=page.getByRole('searchbox',{name:'Buscar',exact:true}),status=page.getByRole('combobox',{name:'Estado',exact:true}),template=page.getByRole('combobox',{name:'Plantilla',exact:true}).first();
 await search.fill('sala tecnica');await expect(page.getByRole('button',{name:/Tablero eléctrico/})).toBeVisible();await expect(page.getByRole('button',{name:/Seguridad semanal/})).toHaveCount(0);
 await search.fill('');await status.selectOption('SUBMITTED');await expect(page.getByRole('button',{name:/Seguridad semanal/})).toBeVisible();await expect(page.getByRole('button',{name:/Pre-hormigonado losa/})).toHaveCount(0);
 await status.selectOption('ALL');await template.selectOption('SEGURIDAD');await expect(page.getByRole('button',{name:/Seguridad semanal/})).toBeVisible();await expect(page.getByRole('button',{name:/Seguridad observada/})).toBeVisible();await expect(page.getByRole('button',{name:/Tablero eléctrico/})).toHaveCount(0);
 await template.selectOption('ALL');await search.fill('sin coincidencias');await expect(page.getByText('No hay inspecciones que coincidan con la búsqueda y los filtros seleccionados.',{exact:true})).toBeVisible();
 assert.equal(calls.filter(call=>call.path.startsWith('/api/')).length,apiCallsBefore);
 assert.equal(calls.some(call=>call.method!=='GET'&&call.path.startsWith('/api/')),false);
 await search.fill('');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:980});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'inspections-'+width+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);
 const proof={status:'PASS',environment:'real-InspectionWorkspace-readonly-controlled-HTTP',syntheticRows:true,initialApiReads:apiCallsBefore,localFilterAdditionalRequests:0,httpWrites:0,widths:[320,390,768,1280],pageErrors:0};
 writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack},null,2));await page?.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();await new Promise(done=>server.close(done));}
