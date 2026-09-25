import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium,expect } from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/business-profile-ui');mkdirSync(out,{recursive:true});
const empty={configured:false,kind:null,market:null,revision:0,updatedAt:null};
const entry=`import React from'react';import{createRoot}from'react-dom/client';import Panel from'./src/app/dashboard/getting-started/business-profile-panel';import{BUSINESS_PROFILE_KINDS,businessProfilePaths}from'./src/lib/organization-business-profile';import'./src/app/globals.css';
const viewer=location.search.includes('reader');const current=location.search.includes('configured')?{configured:true,kind:'CONSTRUCTOR',market:'PRIVATE',revision:1,updatedAt:null}:${JSON.stringify(empty)};
const paths=Object.fromEntries(BUSINESS_PROFILE_KINDS.map(kind=>[kind.key,businessProfilePaths({kind:kind.key},p=>viewer?p==='org:projects:read':true)]));
createRoot(document.getElementById('root')).render(<React.StrictMode><Panel organizationId="org-a" projectId="project-a" organizationName="Organización de ensayo · Varias obras" initialProfile={current} canManage={!viewer} pathsByKind={paths}/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},logLevel:'silent',plugins:[{name:'link',setup(api){api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={e=>{onNavigate?.(e);if(!e.defaultPrevented){e.preventDefault();history.pushState({},'',href)}}}/>} `}));}}]});
let mode='SUCCESS',stored={...empty},writes=0,lost=false;const requests=[],errors=[];
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 if(path==='/api/tenant/business-profile'){
  let raw='';req.on('data',chunk=>raw+=chunk);req.on('end',()=>{
   assert.equal(req.method,'PATCH');assert.equal(req.headers['x-obrasaas-organization'],'org-a');assert.equal(req.headers['x-obrasaas-project'],'project-a');const input=JSON.parse(raw);requests.push({mode,input});res.setHeader('Content-Type','application/json');
   if(mode==='CONFLICT'){res.statusCode=409;res.end('{"error":"Otro administrador modificó el perfil."}');return;}
   if(stored.kind!==input.kind||stored.market!==input.market){stored={configured:true,kind:input.kind,market:input.market,revision:stored.revision+1,updatedAt:new Date().toISOString()};writes++;}
   if(mode==='LOST'&&!lost){lost=true;res.statusCode=503;res.end('{"error":"Respuesta no confirmada"}');return;}
   res.end(JSON.stringify(mode==='MALFORMED'?{}:{organizationId:mode==='FOREIGN'?'org-b':'org-a',projectId:'project-a',profile:stored,unchanged:mode==='LOST',canManage:true,paths:[]}));
  });return;
 }
 if(path==='/bundle.js'||path==='/bundle.css'){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,path.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{padding:12px;box-sizing:border-box}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try {
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:1000}});
 const origin='http://127.0.0.1:'+server.address().port;
 async function open(suffix=''){const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/dashboard/getting-started'+suffix);return page;}
 async function choose(page){await page.getByRole('radio',{name:/Estudio o arquitecto independiente/}).check();await page.getByRole('radio',{name:'Ambas',exact:true}).check();}
 const page=await open();const panel=page.getByRole('region',{name:'Perfil operativo de la organización'});
 await expect(panel.getByRole('radio')).toHaveCount(9);assert.equal(requests.length,0);
 const save=panel.getByRole('button',{name:'Guardar perfil de la organización',exact:true});await expect(save).toBeDisabled();
 await choose(page);await expect(save).toBeEnabled();
 page.once('dialog',dialog=>dialog.dismiss());await panel.getByRole('link',{name:/Preparar las obras/}).click();
 assert.ok(new URL(page.url()).pathname.endsWith('/getting-started'));await expect(panel.getByRole('radio',{name:'Ambas',exact:true})).toBeChecked();
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow at '+width);if([390,1280].includes(width))await panel.screenshot({path:resolve(out,'business-profile-'+width+'.png')});}
 await save.click();await expect(panel.getByRole('status')).toHaveText('Perfil guardado en la organización. Los roles y permisos no se modificaron.');await expect(save).toBeDisabled();assert.equal(writes,1);
 await page.close();
 const reader=await open('?reader=1&configured=1');const viewer=reader.getByRole('region',{name:'Perfil operativo de la organización'});
 for(const radio of await viewer.getByRole('radio').all())await expect(radio).toBeDisabled();
 await expect(viewer.getByRole('button',{name:'Guardar perfil de la organización'})).toHaveCount(0);
 await expect(viewer.getByRole('link')).toHaveCount(0);await reader.close();
 for(const scenario of ['LOST','MALFORMED','FOREIGN','CONFLICT']){
  mode=scenario;stored={...empty};lost=false;const beforeWrites=writes;
  const trial=await open();const region=trial.getByRole('region',{name:'Perfil operativo de la organización'});await choose(trial);
  await region.getByRole('button',{name:'Guardar perfil de la organización',exact:true}).click();
  await expect(region.getByRole('alert')).toBeVisible();await expect(region.getByRole('radio',{name:'Ambas',exact:true})).toBeChecked();
  if(scenario==='LOST'){
   await region.getByRole('button',{name:'Verificar el mismo intento',exact:true}).click();await expect(region.getByRole('status')).toContainText('Perfil guardado');
   const retry=requests.filter(r=>r.mode==='LOST');assert.equal(retry.length,2);assert.deepEqual(retry[0].input,retry[1].input);assert.equal(writes-beforeWrites,1);
  }else if(scenario==='CONFLICT'){
   await expect(region.getByRole('button',{name:'Guardar perfil de la organización',exact:true})).toBeDisabled();trial.once('dialog',dialog=>dialog.dismiss());await region.getByRole('button',{name:'Consultar versión actual',exact:true}).click();await expect(region.getByRole('radio',{name:'Ambas',exact:true})).toBeChecked();assert.equal(writes,beforeWrites);
  }else{await expect(region.getByRole('status')).toHaveCount(0);await expect(region.getByRole('button',{name:'Verificar el mismo intento',exact:true})).toBeVisible();}
  await trial.close();
 }
 assert.equal(requests.length,6);assert.deepEqual(errors,[]);
 const proof={result:'PASS',environment:'real-profile-component-with-synthetic-identity-and-HTTP',noWriteOnMount:true,sixBusinessKinds:true,threeWorkMarkets:true,roleFilteredLinks:true,readOnlyRole:true,guardedNavigation:true,verifiedSave:true,identicalRetry:true,malformedResponseNotConfirmed:true,conflictPreservesSelection:true,widths:[320,390,768,1280],requests:requests.length,pageErrors:errors.length};
 writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
} finally {await browser?.close();await new Promise(done=>server.close(done));}
