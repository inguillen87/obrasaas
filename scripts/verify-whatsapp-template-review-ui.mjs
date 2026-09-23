import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { templateWorkbenchFixture, templateScope, templateFlow } from '../tests/helpers/template-workbench-fixture.js';
import { normalizeTemplateReview, assertTemplateReviewDefinition } from '../src/lib/whatsapp/template-review-policy.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/whatsapp-template-review-ui');
mkdirSync(out,{recursive:true});
let fixture=templateWorkbenchFixture(),mode='normal',submits=0;const errors=[];
const entry=`
import React,{useState} from 'react';
import{createRoot}from'react-dom/client';
import Control from './src/app/dashboard/integrations/template-review-control';
import './src/app/globals.css';
function App(){const[busy,setBusy]=useState(false);return <main><Control flow={${JSON.stringify(templateFlow)}} organizationId="org-a" projectId="project-a" companyName="Constructora de ensayo" projectName="Obra Norte" canReadInbox={true} disabled={busy} onBusy={setBusy}/></main>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'fixture-link',setup(api){
 api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,prefetch,onNavigate,...props}){return <a href={href} {...props}/>} `}));
}}]});
const json=(res,payload,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(payload));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://local');
 if(url.pathname==='/api/integrations/whatsapp/templates'){
  try{
   assert.equal(req.headers['x-obrasaas-organization'],templateScope.organizationId);assert.equal(req.headers['x-obrasaas-project'],templateScope.projectId);
   if(req.method==='GET'){
    if(mode==='read-fail'){json(res,{error:'No se pudo verificar el estado.',code:'READ_UNAVAILABLE'},503);return;}
    const templates=await fixture.sync();json(res,{context:mode==='foreign'?{...templateScope,projectId:'other'}:templateScope,templates});return;
   }
   assert.equal(req.method,'POST');submits++;
   let raw='';for await(const chunk of req)raw+=chunk;
   const review=normalizeTemplateReview(JSON.parse(raw));assertTemplateReviewDefinition(review,fixture.definition());
   if(mode==='changed'){json(res,{error:'El formulario cambió. Consultá nuevamente.',code:'WHATSAPP_TEMPLATE_REVIEW_CHANGED'},409);return;}
   if(mode==='lease'){json(res,{error:'Hay otra operación en curso.',code:'WHATSAPP_FLOW_PROVISIONING_IN_PROGRESS'},409);return;}
   if(mode==='missing-uncertain'){json(res,{error:'Resultado no confirmado.'},503);return;}
   const result=await fixture.provision();
   if(mode==='lost-reply'){json(res,{error:'La respuesta no llegó a confirmarse.'},503);return;}
   json(res,{context:templateScope,result});
  }catch(error){json(res,{error:error.message,code:error.code},error.status||500);}return;
 }
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913;color:#f8fafc}main{padding:24px}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},locale:'es-AR'});page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 const url='http://127.0.0.1:'+server.address().port;
 const modal=page.getByRole('dialog',{name:templateFlow.title}),status=modal.getByRole('region',{name:'Estado de la plantilla'});
 const submit=()=>modal.getByRole('button',{name:'Solicitar aprobación de esta versión',exact:true});
 const refresh=()=>modal.getByRole('button',{name:'Consultar estado en Meta',exact:true});
 async function open(){await page.goto(url);await page.getByRole('button',{name:'Ver mensaje y plantilla'}).click();await expect(status).toContainText('Sin solicitar');}
 async function requestApproval(){await modal.getByRole('checkbox').check();await submit().click();}
 await open();assert.equal(submits,0);assert.equal(fixture.calls.filter(row=>row.method==='POST').length,0);
 await expect(modal).toContainText('Constructora de ensayo');await expect(modal).toContainText('Obra Norte');await expect(modal.getByRole('region',{name:'Vista previa del mensaje'})).toContainText(fixture.definition().bodyText);
 await expect(submit()).toBeDisabled();
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});await modal.getByRole('region',{name:'Vista previa del mensaje'}).scrollIntoViewIfNeeded();const box=await modal.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'template-review-'+width+'.png')});}
 await requestApproval();await expect(status).toContainText('En revisión de Meta');await expect(submit()).toHaveCount(0);assert.equal(submits,1);assert.equal(fixture.remote.length,1);
 fixture.remote[0].status='APPROVED';await refresh().click();await expect(status).toContainText('Aprobada por Meta');await expect(modal.getByRole('link',{name:'Abrir conversaciones →'})).toBeVisible();
 mode='read-fail';await refresh().click();await expect(modal.getByRole('alert')).toContainText('No se pudo verificar');await expect(status).toContainText('Estado pendiente de verificar');await expect(modal.getByRole('link')).toHaveCount(0);
 mode='normal';fixture.remote[0].status='PAUSED';await refresh().click();await expect(status).toContainText('Pausada por Meta');await expect(modal.getByRole('link')).toHaveCount(0);
 fixture.remote[0].status='APPROVED';fixture.remote[0].category='MARKETING';await refresh().click();await expect(status).toContainText('Categoría distinta');await expect(modal.getByRole('link')).toHaveCount(0);
 fixture.remote[0].status='REJECTED';fixture.remote[0].category='UTILITY';fixture.remote[0].rejected_reason='<script>privateAction()</script> motivo de ensayo';
 await refresh().click();await expect(status).toContainText('Rechazada por Meta');await expect(modal.getByRole('region',{name:'Motivo informado por Meta'})).toContainText('<script>privateAction()</script>');assert.equal(await page.locator('script').count(),1);
 fixture=templateWorkbenchFixture();mode='lost-reply';await open();await requestApproval();await expect(modal.getByText(/Solicitud sin confirmar/)).toBeVisible();await expect(submit()).toHaveCount(0);
 const savedName=fixture.remote[0].name,creationCalls=fixture.calls.filter(row=>row.method==='POST').length;
 await modal.getByRole('button',{name:'Cerrar revisión de plantilla'}).click();await expect(modal).toHaveCount(0);
 mode='normal';await page.getByRole('button',{name:'Ver mensaje y plantilla'}).click();await expect(status).toContainText('En revisión de Meta');await expect(modal.getByText(/Solicitud sin confirmar/)).toHaveCount(0);
 assert.equal(fixture.calls.filter(row=>row.method==='POST').length,creationCalls);assert.equal(fixture.remote[0].name,savedName);
 fixture=templateWorkbenchFixture();mode='missing-uncertain';await open();await requestApproval();await expect(modal.getByText(/Solicitud sin confirmar/)).toBeVisible();
 mode='normal';const before=submits;await modal.getByRole('button',{name:'Consultar solicitud sin reenviar'}).click();await expect(status).toContainText('Sin solicitar');await expect(submit()).toHaveCount(0);assert.equal(submits,before);
 for(const scenario of ['lease','changed']){fixture=templateWorkbenchFixture();mode=scenario;await open();await requestApproval();await expect(modal.getByRole('alert')).toBeVisible();await expect(modal.getByText(/Solicitud sin confirmar/)).toHaveCount(0);mode='normal';await refresh().click();await expect(submit()).toBeDisabled();assert.equal(fixture.remote.length,0);}
 mode='foreign';await page.goto(url);await page.getByRole('button',{name:'Ver mensaje y plantilla'}).click();await expect(modal.getByRole('alert')).toContainText('no corresponde');await expect(submit()).toHaveCount(0);await expect(modal.getByRole('region',{name:'Vista previa del mensaje'})).toHaveCount(0);
 assert.deepEqual(errors,[]);
 const proof={status:'PASS',environment:'real-template-control-and-template-services-with-controlled-provider-HTTP-and-database',explicitContentReview:true,noCreateOnRead:true,contextRejected:true,pendingApprovedPausedRejectedAndCategoryChange:true,staleStateNotAdvertisedAsApproved:true,lostResponseRecoveredByReadOnly:true,sameNameNoDuplicate:true,uncertainAbsentCannotResubmit:true,leaseAndChangedReviewRecoverable:true,rejectionRenderedAsText:true,widths:[320,390,768,1280],pageErrors:0,realMetaCalls:0,realMessagesSent:0,clerkVerified:false};
 writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({name:error.name,message:error.message},null,2));throw error;}
finally{await browser?.close();await new Promise(done=>server.close(done));}
