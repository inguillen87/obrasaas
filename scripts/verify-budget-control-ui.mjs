import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/budget-control-ui');
mkdirSync(out,{recursive:true});
const budgets=[
  {id:'v3',version:3,status:'DRAFT',currency:'ARS',revision:0,baseVersion:2,lines:[{id:'ars-draft',costCode:'MAT',description:'Materiales',amount:'1800000'}]},
  {id:'v2',version:2,status:'ACTIVE',currency:'USD',revision:4,baseVersion:1,lines:[{id:'usd-active',costCode:'EQ',description:'Equipos',amount:'12500'}]},
  {id:'v1',version:1,status:'SUPERSEDED',currency:'ARS',revision:2,baseVersion:null,lines:[{id:'ars-old',costCode:'OB',description:'Obra',amount:'900000'}]},
];
const rawEntries=[
  {id:'e1',budgetLineId:'usd-active',kind:'ACTUAL',amount:'1200',occurredAt:'2026-09-24T12:00:00.000Z',description:'Equipo importado'},
  {id:'e2',budgetLineId:'ars-old',kind:'ACTUAL',amount:'100000',occurredAt:'2026-09-23T12:00:00.000Z',description:'Material nacional'},
  {id:'e3',budgetLineId:'ars-old',kind:'COMMITMENT',amount:'50000',occurredAt:'2026-09-22T12:00:00.000Z',description:'Compromiso'},
  {id:'e4',budgetLineId:'missing',kind:'FORECAST',amount:'7',occurredAt:'2026-09-21T12:00:00.000Z',description:'Sin línea'},
];
const entry=`import React from'react';import{createRoot}from'react-dom/client';import Budget from'./src/app/dashboard/budgets/budget-client';import Ledger from'./src/app/dashboard/budgets/ledger-summary';import{enrichBudgetEntriesWithCurrency}from'./src/lib/budget-control-view';import './src/app/globals.css';const budgets=${JSON.stringify(budgets)},entries=enrichBudgetEntriesWithCurrency(${JSON.stringify(rawEntries)},budgets);createRoot(document.getElementById('root')).render(<React.StrictMode><Budget initialBudgets={budgets} canManage projectName="Obra Norte · Ensayo"/><Ledger entries={entries}/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
let rows=structuredClone(budgets),calls=[],errors=[];
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname==='/api/budgets'){
    let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):null;calls.push({method:req.method,body});
    if(req.method==='POST'){
      const created={id:'v4',version:4,status:'DRAFT',currency:body.currency,revision:0,baseVersion:3,lines:body.lines.map((line,index)=>({...line,id:'v4-l'+index,amount:String(line.amount)}))};
      rows=[created,...rows];return json(res,{budget:created},201);
    }
    if(req.method==='PATCH'){
      const target=rows.find(row=>row.id===body.id);if(!target||target.revision!==body.expectedRevision)return json(res,{error:'Conflicto controlado'},409);
      for(const row of rows)if(row.status==='ACTIVE')row.status='SUPERSEDED';
      target.status='ACTIVE';target.revision++;return json(res,{status:'ACTIVE',revision:target.revision});
    }
  }
  if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913;color:#f8fafc;padding:18px;font-family:Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser,page;
try{
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
  page=await browser.newPage({viewport:{width:1280,height:1050},locale:'es-AR'});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  const main=page.getByRole('main');
  await expect(main.getByRole('heading',{name:'Presupuesto & costos',level:1})).toBeVisible();
  await expect(main.getByRole('article').filter({hasText:'Versión vigente'})).toContainText('v2');
  await expect(main.getByRole('article').filter({hasText:'Total vigente'})).toContainText('US$');
  const ledger=page.getByRole('region',{name:'Conciliación financiera'});
  await expect(ledger.getByRole('heading',{name:/ARS · 2 movimientos/})).toBeVisible();
  await expect(ledger.getByRole('heading',{name:/USD · 1 movimientos/})).toBeVisible();
  await expect(ledger.getByRole('heading',{name:/Moneda sin resolver · 1 movimientos/})).toBeVisible();
  const ledgerText=await ledger.innerText();assert.ok(ledgerText.includes('100.000'));assert.ok(ledgerText.includes('1.200'));assert.equal(ledgerText.includes('101.200'),false);
  const before=calls.length;
  await main.getByRole('button',{name:'Preparar versión',exact:true}).click();
  await main.getByLabel('Moneda',{exact:true}).fill('ARS');
  await main.getByLabel('Código línea 1',{exact:true}).fill('EST-01');
  await main.getByLabel('Descripción línea 1',{exact:true}).fill('Estructura');
  await main.getByLabel('Monto línea 1',{exact:true}).fill('250000');
  await main.getByRole('button',{name:'Crear borrador',exact:true}).click();
  await expect(main.getByText('Borrador creado; todavía no afecta el presupuesto vigente.',{exact:true})).toBeVisible();
  await expect(main.getByText('Versión 4',{exact:true})).toBeVisible();
  assert.equal(calls.length,before+1);assert.equal(calls.at(-1).method,'POST');assert.equal(calls.at(-1).body.currency,'ARS');assert.equal(calls.at(-1).body.lines[0].amount,250000);
  const v4=main.getByRole('listitem').filter({hasText:'Versión 4'});
  await v4.getByRole('button',{name:'Activar versión',exact:true}).click();
  await expect(v4.getByText('Vigente',{exact:true})).toBeVisible();
  assert.equal(calls.at(-1).method,'PATCH');assert.deepEqual(calls.at(-1).body,{id:'v4',expectedRevision:0});
  await expect(main.getByRole('article').filter({hasText:'Versión vigente'})).toContainText('v4');
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:980});await main.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
    if([390,1280].includes(width))await page.screenshot({path:resolve(out,'budget-'+width+'.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  const proof={status:'PASS',environment:'real-BudgetClient-and-LedgerSummary-controlled-HTTP',syntheticRows:true,mixedCurrenciesSeparated:true,unresolvedCurrencySeparated:true,mutations:calls.length,widths:[320,390,768,1280],pageErrors:0};
  writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){
  writeFileSync(resolve(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack},null,2));
  await page?.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;
}finally{await browser?.close();await new Promise(done=>server.close(done));}
