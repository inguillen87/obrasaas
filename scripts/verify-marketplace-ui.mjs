import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/marketplace-ui');mkdirSync(out,{recursive:true});
const props={initialOrders:[
{id:'po-a',number:'OC-100',status:'DRAFT',currency:'ARS',total:'985000',revision:1,supplier:{legalName:'Corralón Álamo'},lines:[{description:'Cemento Portland',unit:'bolsa'}]},
{id:'po-b',number:'OC-101',status:'APPROVED',currency:'USD',total:'2400',revision:3,supplier:{legalName:'Metal Norte'},lines:[{description:'Perfil UPN',unit:'barra'}]},
{id:'po-c',number:'OC-102',status:'SUBMITTED',currency:'ARS',total:'450000',revision:2,supplier:{legalName:'Corralón Álamo'},lines:[{description:'Arena lavada',unit:'m3'}]}
],initialReceipts:[{id:'r1'},{id:'r2'},{id:'r3'}],initialReceiptsTruncated:false,initialLineBalances:[],initialCommitments:[{id:'c1'},{id:'c2'}],
suppliers:[{id:'s1',legalName:'Corralón Álamo',currency:'ARS',paymentTerms:'eCheq 30 días',taxId:'PRIVATE_TAX_CANARY'},{id:'s2',legalName:'Metal Norte',currency:'USD',paymentTerms:'Transferencia'}],
budgetLines:[{id:'bl1',costCode:'MAT-01',description:'Materiales'},{id:'bl2',costCode:'EST-01',description:'Estructura'}],tasks:[],tasksTruncated:false,materialTasks:[],materialTasksTruncated:false,
projectName:'Obra Norte · Ensayo',tenantToday:'2026-09-25',canManage:true,canReadInventory:true,canManageInventory:true,canReadTaskMaterials:true,canManageTaskMaterials:true};
const entry=`import React from'react';import{createRoot}from'react-dom/client';import Client from'./src/app/dashboard/purchases/purchases-client';import './src/app/globals.css';createRoot(document.getElementById('root')).render(<React.StrictMode><Client {...${JSON.stringify(props)}}/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'children',setup(api){
 for(const name of ['receipt-client','supplier-commitments-client','task-material-requirements-client'])api.onResolve({filter:new RegExp('^\\./'+name+'$')},()=>({path:name,namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Stub(){return <section aria-label="${args.path}">Módulo operativo conservado</section>}`}));
}}]});
let calls=[],orders=structuredClone(props.initialOrders);const errors=[];
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://local');
 if(url.pathname==='/api/purchase-orders'){
  let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):null;calls.push({method:req.method,body});
  if(req.method==='GET')return json(res,{purchaseOrders:orders});
  if(body?.operation==='DECIDE'){const row=orders.find(item=>item.id===body.id);row.status=body.status;row.revision++;return json(res,{id:row.id,status:row.status,revision:row.revision});}
  const supplier=props.suppliers.find(row=>row.id===body.supplierId);const created={id:'po-created',number:body.number,status:'DRAFT',currency:body.currency,total:String(Number(body.lines[0].quantity)*Number(body.lines[0].unitPrice)),revision:0,supplier:{legalName:supplier.legalName},lines:body.lines};orders=[created,...orders];return json(res,{purchaseOrder:created});
 }
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913;color:#f8fafc;padding:18px;font-family:Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000},locale:'es-AR'});page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const main=page.getByRole('main');await expect(main.getByRole('heading',{name:'Marketplace & compras',level:1})).toBeVisible();
 const statCards=main.getByRole('region',{name:'Resumen de abastecimiento'}).getByRole('article');await expect(statCards).toHaveCount(5);await expect(statCards.nth(0).getByText('2',{exact:true})).toBeVisible();await expect(statCards.nth(1).getByText('3',{exact:true})).toBeVisible();await expect(statCards.nth(3).getByText('3',{exact:true})).toBeVisible();
 assert.equal((await page.locator('body').innerText()).includes('PRIVATE_TAX_CANARY'),false);
 const search=main.getByRole('searchbox',{name:'Buscar',exact:true}),status=main.getByRole('combobox',{name:'Estado',exact:true});const before=calls.length;
 await search.fill('alamo cemento');await expect(main.getByText(/OC-100/)).toBeVisible();await expect(main.getByText(/OC-101/)).toHaveCount(0);assert.equal(calls.length,before);
 await search.fill('');await status.selectOption('APPROVED');await expect(main.getByText(/OC-101/)).toBeVisible();await expect(main.getByText(/OC-100/)).toHaveCount(0);assert.equal(calls.length,before);
 await status.selectOption('ALL');await expect(main.getByText(/3 de 3/)).toBeVisible();
 await main.getByRole('button',{name:'Preparar orden',exact:true}).click();const form=main.locator('form');await expect(form).toHaveCount(1);const inputs=form.locator('input');await expect(inputs).toHaveCount(4);
 await inputs.nth(0).fill('OC-200');await inputs.nth(1).fill('Aislacion termica');await inputs.nth(2).fill('10');await inputs.nth(3).fill('2500');
 await form.getByRole('button',{name:'Crear borrador',exact:true}).click();await expect(main.getByText('Orden creada como borrador.',{exact:true})).toBeVisible();await expect(main.getByText(/OC-200/)).toBeVisible();
 assert.equal(calls.length,before+1);assert.equal(calls.at(-1).method,'POST');assert.equal(calls.at(-1).body.operation,undefined);assert.equal(calls.at(-1).body.supplierId,'s1');assert.equal(typeof calls.at(-1).body.operationKey,'string');
 const original=main.getByRole('listitem').filter({hasText:'OC-100'});await original.getByRole('button',{name:'Aprobar',exact:true}).click();await expect(original.getByText('Aprobada',{exact:true})).toBeVisible();assert.equal(calls.at(-1).body.operation,'DECIDE');assert.equal(calls.at(-1).body.status,'APPROVED');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:950});await main.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);if([390,1280].includes(width))await main.screenshot({path:resolve(out,'marketplace-'+width+'.png')});}
 assert.deepEqual(errors,[]);const proof={status:'PASS',environment:'real-PurchasesClient-controlled-HTTP-and-real-view-model',realBusinessData:false,syntheticRows:true,searchRequests:0,mutations:calls.length,widths:[320,390,768,1280],pageErrors:0,privateTaxCanaryExposed:false};
 writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack},null,2));await page?.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();await new Promise(done=>server.close(done));}
