import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { templateWorkbenchFixture, templateScope } from '../tests/helpers/template-workbench-fixture.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/template-catalog-consistency-ui');
mkdirSync(out,{recursive:true});
const fixture=templateWorkbenchFixture();await fixture.provision();fixture.remote[0].status='APPROVED';
const flow={key:'incident-report',title:'Incidencia de obra',description:'Incidencias del frente autorizado.',screenId:'INCIDENT',flowType:'incident',dataApiVersion:'4.0',capabilities:['Evidencia de campo'],runtimeActive:true,remoteDataEndpointReady:true,remote:{id:'987654321012345',status:'PUBLISHED',healthStatus:{blocked:false},validationErrors:[],dataApiVersion:'4.0'}};
const props={...templateScope,companyName:'Empresa de ensayo',projectName:'Obra Norte',canReadInbox:true,internalWorkspace:false,appId:'',configId:'',platformReady:true,pilotImportEnabled:false,initialConnection:{linked:true,enabled:true,connectionStatus:'CONNECTED',whatsappBusinessId:fixture.connection.whatsappBusinessId,displayPhoneNumber:'Número de ensayo'},initialHealth:{checks:{account:{phoneStatus:'REGISTERED',providerStatus:'HEALTHY',scopesVerified:true,tokenStatus:'VALID'}},actions:[]},initialHealthDiagnostics:{},initialFlowCatalog:[flow]};
const entry=`import React from'react';import{createRoot}from'react-dom/client';import Client from'./src/app/dashboard/integrations/integrations-client';import './src/app/globals.css';createRoot(document.getElementById('root')).render(<React.StrictMode><Client {...${JSON.stringify(props)}}/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'unchanged-boundaries',setup(api){
 api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
 api.onResolve({filter:/^\.\/channel-recovery-panel$/},()=>({path:'channel',namespace:'fixture'}));
 api.onResolve({filter:/^\.\/tenant-whatsapp-workspace$/},()=>({path:'workspace',namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'jsx',resolveDir:root,contents:path==='link'?`import React from'react';export default function Link({href,prefetch,onNavigate,...props}){return <a href={href} {...props}/>} `:path==='channel'?`import React,{useEffect}from'react';export default function Channel({organizationId,projectId,onStatus}){useEffect(()=>{onStatus({organizationId,projectId,state:'ready',credential:{blocksProviderActions:false,reauthorizationRequired:false}})},[organizationId,projectId,onStatus]);return <p>Canal sintético verificado para esta prueba</p>}`:`import React,{useEffect}from'react';export default function Workspace({onState}){useEffect(()=>{onState({allowed:true,revision:1})},[onState]);return null}`}));
}}]});
let mode='normal',held=null,healthCalls=0;const calls=[],errors=[];
const json=(res,payload,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(payload));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://local');
 if(url.pathname.startsWith('/api/')){
  calls.push({method:req.method,path:url.pathname});
  if(url.pathname.endsWith('/flows')){json(res,{catalog:[flow],endpoint:{ready:true,keyFingerprint:'f'.repeat(64)}});return;}
  if(url.pathname.endsWith('/health')){healthCalls++;json(res,{error:'No debe verificar Graph por una respuesta obsoleta.'},503);return;}
  if(url.pathname.endsWith('/templates')){
   try{
    assert.equal(req.method,'GET');assert.equal(req.headers['x-obrasaas-organization'],templateScope.organizationId);assert.equal(req.headers['x-obrasaas-project'],templateScope.projectId);
    if(mode==='fail'){json(res,{error:'Consulta de catálogo no disponible.',code:'CATALOG_UNAVAILABLE'},503);return;}
    const payload={context:templateScope,templates:await fixture.sync()};
    if(mode==='hold'||mode==='hold-error'){held={res,payload,error:mode==='hold-error'};mode='normal';return;}
    json(res,payload);
   }catch(error){json(res,{error:error.message,code:error.code},error.status||500);}return;
  }
  json(res,{error:'Unexpected fixture endpoint'},404);return;
 }
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913;color:#f8fafc;padding:16px}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
function release(){if(held){const reply=held;held=null;json(reply.res,reply.error?{error:'Antigua credencial rechazada.',code:'WHATSAPP_GRAPH_RECONNECT_REQUIRED'}:reply.payload,reply.error?409:200);}}
try{
 browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000},locale:'es-AR'});page.on('pageerror',error=>errors.push(error.message));
 const url='http://127.0.0.1:'+server.address().port;
 const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Incidencia de obra',exact:true})});
 const modal=page.getByRole('dialog',{name:'Incidencia de obra'});
 async function openPage(){await page.goto(url);await page.getByText('Formularios y automatizaciones · configuración avanzada',{exact:true}).click();}
 await openPage();await expect(card.getByText('Aprobada por Meta',{exact:true})).toBeVisible();
 await expect(card.getByRole('button',{name:'Formulario operativo',exact:true})).toBeDisabled();await expect(card.getByText('Listo para enviar',{exact:true})).toHaveCount(0);
 mode='fail';await page.getByRole('button',{name:'Sincronizar',exact:true}).click();await expect(page.getByText('Consulta de catálogo no disponible.',{exact:true})).toBeVisible();
 await expect(card.getByText('Aprobada por Meta',{exact:true})).toHaveCount(0);
 await expect(card.getByRole('status',{name:'Estado de plantilla'})).toContainText('Plantilla sin verificar');
 mode='normal';await page.getByRole('button',{name:'Sincronizar',exact:true}).click();await expect(card.getByText('Aprobada por Meta',{exact:true})).toBeVisible();
 for(const staleError of [false,true]){
  fixture.remote[0].status='APPROVED';mode=staleError?'hold-error':'hold';await openPage();
  await expect.poll(()=>Boolean(held)).toBe(true);
  await expect(card.getByRole('status',{name:'Estado de plantilla'})).toContainText('Consultando plantilla');
  fixture.remote[0].status='PAUSED';await card.getByRole('button',{name:'Ver mensaje y plantilla'}).click();
  await expect(modal.getByRole('region',{name:'Estado de la plantilla'})).toContainText('Pausada por Meta');
  await modal.getByRole('button',{name:'Cerrar revisión de plantilla'}).click();
  await expect(card.getByRole('status',{name:'Estado de plantilla'})).toContainText('Pausada por Meta');
  release();await page.waitForTimeout(250);
  await expect(card.getByRole('status',{name:'Estado de plantilla'})).toContainText('Pausada por Meta');
  await expect(card.getByText('Aprobada por Meta',{exact:true})).toHaveCount(0);assert.equal(healthCalls,0);
 }
 mode='normal';fixture.remote[0].status='APPROVED';await page.getByRole('button',{name:'Sincronizar',exact:true}).click();await expect(card.getByText('Aprobada por Meta',{exact:true})).toBeVisible();
 mode='fail';await card.getByRole('button',{name:'Ver mensaje y plantilla'}).click();await expect(modal.getByRole('alert')).toContainText('Consulta de catálogo no disponible.');
 await modal.getByRole('button',{name:'Cerrar revisión de plantilla'}).click();await expect(card.getByRole('status',{name:'Estado de plantilla'})).toContainText('Plantilla sin verificar');
 assert.equal(await card.getByRole('status',{name:'Estado de plantilla'}).locator('.fa-circle-check').count(),0);
 await expect(page.getByText('Flows, Data Endpoint y plantillas sincronizados con la cuenta de WhatsApp.',{exact:true})).toHaveCount(0);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});await card.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'catalog-unverified-'+width+'.png')});}
 mode='normal';fixture.remote[0].category='MARKETING';await page.getByRole('button',{name:'Sincronizar',exact:true}).click();await expect(card.getByRole('status',{name:'Estado de plantilla'})).toContainText('Categoría distinta');assert.equal(await card.getByRole('status',{name:'Estado de plantilla'}).locator('.fa-circle-check').count(),0);
 assert.equal(calls.some(row=>row.method!=='GET'),false);assert.deepEqual(errors,[]);
 const proof={status:'PASS',environment:'real-integrations-client-template-control-and-domain-services-with-controlled-onboarding-HTTP-provider-database',failedRefreshRemovesApproval:true,lateSuccessCannotRestoreOldApproval:true,lateFailureCannotRevokeNewObservation:true,dialogFailureInvalidatesCard:true,staleSyncSuccessRemoved:true,flowReadinessDistinctFromSending:true,unknownStatusNotPresentedAsMissing:true,recategorizedHasNoApprovedIcon:true,widths:[320,390,768,1280],pageErrors:0,realProviderCalls:0,realMessagesSent:0,clerkVerified:false};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({name:error.name,message:error.message},null,2));await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;}
finally{release();await browser?.close();await new Promise(done=>server.close(done));}
