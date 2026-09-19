// Local-only synthetic browser test. No production endpoint or real WhatsApp send.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'.vercel/pilot-channel-proof-ui');
mkdirSync(out,{recursive:true});
const entry=`import React from 'react';
import{createRoot}from'react-dom/client';
import Panel from './src/app/dashboard/integrations/pilot-channel-proof-panel';
import './src/app/globals.css';
createRoot(document.getElementById('root')).render(<Panel organizationId="org-control" projectId="project-control" targets={[{organizationId:'org-pilot',organizationName:'Empresa de ensayo',projects:[{id:'project-pilot',name:'Obra de ensayo'}]}]}/>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},bundle:true,platform:'browser',format:'esm',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},outfile:resolve(out,'bundle.js'),define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},logLevel:'silent'});
const snapshot={projectId:'project-pilot',organizationId:'org-pilot',projectName:'Obra de ensayo',connectionId:'connection-a',sender:'+1 555 000 0000',inbound:{id:'inbound-a',contactLast4:'0000',canReply:true},reply:null,workersAuthorizedByThisAction:false};
const writes=[],errors=[];
let loseResponse=false,receipt=null;
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 if(path==='/api/integrations/whatsapp/pilot-proof'){
  assert.equal(req.headers['x-obrasaas-organization'],'org-control');
  assert.equal(req.headers['x-obrasaas-project'],'project-control');
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET'){res.end(JSON.stringify({...snapshot,reply:receipt}));return;}
  let body='';req.on('data',chunk=>body+=chunk);
  req.on('end',()=>{
   writes.push(JSON.parse(body));receipt={id:'reply-a',status:'accepted'};
   if(loseResponse){loseResponse=false;res.statusCode=503;res.end('{"error":"Respuesta perdida"}');return;}
   res.end(JSON.stringify({...snapshot,inboundId:'inbound-a',reply:receipt}));
  });return;
 }
 if(path==='/bundle.js'||path==='/bundle.css'){
  res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');
  res.end(readFileSync(resolve(out,path.slice(1))));return;
 }
 res.setHeader('Content-Type','text/html;charset=utf-8');
 res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try {
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',error=>errors.push(error.message));
 const origin='http://127.0.0.1:'+server.address().port;
 await page.goto(origin);
 await page.waitForTimeout(500);
 await page.getByLabel('Empresa y obra para la prueba',{exact:true}).selectOption('project-pilot');
 await page.getByRole('button',{name:'Comprobar recepción y estado',exact:true}).click();
 await expect(page.getByText('Registrado en esta obra',{exact:true})).toBeVisible();
 assert.equal(writes.length,0);
 await expect(page.getByRole('button',{name:'Enviar respuesta de prueba',exact:true})).toBeDisabled();
 await page.getByRole('checkbox').check();
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(width===390)await page.screenshot({path:resolve(out,'pilot-proof-390.png'),fullPage:true});
 }
 loseResponse=true;
 await page.getByRole('button',{name:'Enviar respuesta de prueba',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('Respuesta perdida');
 await expect(page.getByLabel('Empresa y obra para la prueba',{exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Verificar el mismo envío',exact:true}).click();
 assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);
 await expect(page.getByText('Aceptada por Meta',{exact:true})).toBeVisible();
 receipt={id:'reply-a',status:'delivered'};
 await page.getByRole('button',{name:'Comprobar recepción y estado',exact:true}).click();
 await expect(page.getByText('Entregada',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Enviar respuesta de prueba',exact:true})).toHaveCount(0);
 assert.deepEqual(errors,[]);
 const proof={result:'PASS',environment:'real-component-with-loopback-synthetic-HTTP',readDoesNotSend:true,explicitConfirmation:true,identicalRetry:true,deliverySeparateFromAcceptance:true,widths:[320,390,768,1280],pageErrors:0};
 writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
} finally {await browser?.close();await new Promise(done=>server.close(done));}
