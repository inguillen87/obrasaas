import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { tenantWorkspaceFromMetadata, workspaceAuthorizationState } from '../src/lib/whatsapp/tenant-workspace-policy.js';
const root = fileURLToPath(new URL('../', import.meta.url)), out = resolve(root, '.vercel/tenant-whatsapp-workspace-ui');
mkdirSync(out, { recursive: true });
const entry = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import Setup from './src/app/dashboard/integrations/tenant-whatsapp-workspace';
import Connect from './src/app/dashboard/integrations/whatsapp-connect-experience';
import './src/app/globals.css';import './src/app/platform.css';
function App(){const[projectId,setProjectId]=useState('project-a');const[prepared,setPrepared]=useState(null);const[pin,setPin]=useState('');return <main style={{maxWidth:1120,margin:'auto',padding:16}}>
<button onClick={()=>{setPrepared(null);setProjectId(id=>id==='project-a'?'project-b':'project-a')}}>Cambiar obra de ensayo</button><Setup key={projectId} organizationId="company-a" projectId={projectId} companyName="Constructora de ensayo" onState={setPrepared}/>
<Connect companyName="Constructora de ensayo" projectName={projectId==='project-a'?'Obra Norte':'Obra Sur'} linked={false} configured={true} sdkReady={true} blocked={prepared?.allowed!==true} pin={pin} onPinChange={setPin} onConnect={()=>{window.syntheticMetaRequests=(window.syntheticMetaRequests||0)+1;}}/>
</main>}createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(out, 'bundle.js'), bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic', loader: { '.js':'jsx' }, alias: { '@':resolve(root,'src') }, define: { 'process.env.NODE_ENV':'"development"' }, logLevel:'silent', plugins:[{name:'fixture-links',setup(api){
  api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
  api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...rest}){return <a href={href} {...rest}/>}`}));
}}]});
let stored = null, failNext = false, mode='normal';const profiles=new Map();
const requests=[],errors=[];
const scope={organizationId:'company-a',projectId:'project-a'};
const projects=[{id:'project-a',name:'Obra Norte',status:'ACTIVE'},{id:'project-b',name:'Obra Sur',status:'PLANNING'}];
const responseBody=(projectId)=>({ ...scope,projectId,companyName:'Constructora de ensayo',profileScope:'PROJECT',projectWritable:mode!=='readonly',profile:tenantWorkspaceFromMetadata(profiles.has(projectId)?{whatsappWorkspace:profiles.get(projectId)}:{}),projects:projects.filter(p=>p.id===projectId),projectsTruncated:false,automationActivated:false });
const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://local').pathname;
  if(path==='/api/integrations/whatsapp/workspace'){
    assert.equal(req.headers['x-obrasaas-organization'],'company-a');const projectId=req.headers['x-obrasaas-project'];assert.ok(['project-a','project-b'].includes(projectId));
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    if(req.method==='GET'){res.end(JSON.stringify(mode==='wrong-context'?{...responseBody(projectId),organizationId:'foreign'}:responseBody(projectId)));return;}
    let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{
      const input=JSON.parse(text);assert.equal(input.initialProjectId,projectId);requests.push(input);stored=profiles.get(projectId)||null;
      if(mode==='conflict'){res.statusCode=409;res.end('{"error":"Otro administrador cambió esta preparación."}');return;}
      const replay=Boolean(stored&&stored.assistantName===input.assistantName&&stored.numberMode===input.numberMode&&stored.initialProjectId===input.initialProjectId&&JSON.stringify(stored.useCases)===JSON.stringify(input.useCases));
      if(!replay)stored={...input,schemaVersion:1,revision:(stored?.revision||0)+1,mode:'REVIEW_REQUIRED',ownership:'CUSTOMER',updatedAt:new Date().toISOString()};
      profiles.set(projectId,stored);
      if(failNext){failNext=false;res.statusCode=503;res.end('{"error":"Respuesta incierta; verificá el mismo intento."}');return;}
      const body=responseBody(projectId);res.end(JSON.stringify({...body,unchanged:replay,authorization:workspaceAuthorizationState(body.profile,projectId)}));
    });return;
  }
  if(path==='/bundle.js'||path==='/bundle.css'){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,path.slice(1))));return;}
  res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin);const setup=page.getByRole('region',{name:'Preparación del WhatsApp de tu empresa'});
  await expect(setup.getByLabel('Nombre del asistente',{exact:true})).toHaveValue('Asistente de obra');assert.equal(requests.length,0);
  await expect(page.getByRole('button',{name:'Conectar WhatsApp',exact:true})).toBeDisabled();
  await setup.getByLabel('Nombre del asistente',{exact:true}).fill('Asistente Constructora Norte');
  await setup.getByRole('radio',{name:/Ya uso WhatsApp Business/}).check();
  await setup.getByRole('checkbox',{name:/Prepararé una cuenta/}).check();
  await setup.getByRole('button',{name:'Guardar preparación',exact:true}).click();
  await expect(setup.getByText(/Preparación guardada para esta obra/)).toBeVisible();
  assert.equal(stored.numberMode,'BUSINESS_APP');await expect(page.getByRole('button',{name:'Conectar WhatsApp',exact:true})).toBeDisabled();
  await expect(setup.getByText(/La coexistencia debe habilitarse/)).toBeVisible();
  await setup.getByRole('button',{name:'Editar preparación',exact:true}).click();
  await setup.getByRole('radio',{name:/Número para el asistente/}).check();await setup.getByRole('checkbox',{name:/Prepararé una cuenta/}).check();
  await setup.getByRole('button',{name:'Guardar preparación',exact:true}).click();
  await expect(page.getByRole('button',{name:'Conectar WhatsApp',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Conectar WhatsApp',exact:true}).click();
  await page.getByLabel('PIN de protección',{exact:true}).fill('123456');await page.getByRole('button',{name:'Continuar en Meta',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.syntheticMetaRequests),1);
  await setup.getByRole('button',{name:'Editar preparación',exact:true}).click();
  await setup.getByLabel('Nombre del asistente',{exact:true}).fill('Nuevo nombre no guardado');
  await expect(page.getByRole('button',{name:'Continuar en Meta',exact:true})).toBeDisabled();
  page.once('dialog',dialog=>dialog.dismiss());
  const navigated=await page.evaluate(()=>window.dispatchEvent(new CustomEvent('obrasaas:before-workspace-navigation',{cancelable:true,detail:{kind:'project'}})));
  assert.equal(navigated,false);await expect(setup.getByLabel('Nombre del asistente',{exact:true})).toHaveValue('Nuevo nombre no guardado');
  await setup.getByRole('checkbox',{name:/Prepararé una cuenta/}).check();failNext=true;
  await setup.getByRole('button',{name:'Guardar preparación',exact:true}).click();await expect(setup.getByRole('alert')).toContainText('Respuesta incierta');
  await expect(setup.getByLabel('Nombre del asistente',{exact:true})).toBeDisabled();
  await setup.getByRole('button',{name:'Verificar el mismo intento',exact:true}).click();
  await expect(setup.getByText(/Preparación guardada para esta obra/)).toBeVisible();assert.deepEqual(requests.at(-1),requests.at(-2));assert.equal(stored.revision,3);
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:1100});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
    if(width===390||width===1280)await page.screenshot({path:resolve(out,'tenant-setup-'+width+'.png'),fullPage:true});
  }
  assert.equal(profiles.get('project-a').assistantName,'Nuevo nombre no guardado');
  await page.getByRole('button',{name:'Cambiar obra de ensayo',exact:true}).click();
  await expect(setup.getByLabel('Obra de este número',{exact:true})).toHaveValue('Obra Sur');
  await expect(setup.getByLabel('Nombre del asistente',{exact:true})).toHaveValue('Asistente de obra');
  await expect(page.getByRole('button',{name:'Continuar en Meta',exact:true})).toBeDisabled();
  await setup.getByLabel('Nombre del asistente',{exact:true}).fill('Asistente Sur');
  await setup.getByRole('radio',{name:/Número para el asistente/}).check();await setup.getByRole('checkbox',{name:/Prepararé una cuenta/}).check();
  await setup.getByRole('button',{name:'Guardar preparación',exact:true}).click();
  await expect(setup.getByText('Asistente Sur',{exact:true})).toBeVisible();assert.equal(profiles.get('project-b').revision,1);assert.equal(profiles.get('project-a').revision,3);
  await page.reload();await expect(setup.getByText('Nuevo nombre no guardado',{exact:true})).toBeVisible();
  await setup.getByRole('button',{name:'Editar preparación',exact:true}).click();
  mode='conflict';await setup.getByLabel('Nombre del asistente',{exact:true}).fill('Texto local conservado');
  await setup.getByRole('checkbox',{name:/Prepararé una cuenta/}).check();await setup.getByRole('button',{name:'Guardar preparación',exact:true}).click();
  await expect(setup.getByRole('alert')).toContainText('Otro administrador');await expect(setup.getByLabel('Nombre del asistente',{exact:true})).toHaveValue('Texto local conservado');await page.close();
  mode='wrong-context';const foreign=await context.newPage();foreign.on('pageerror',e=>errors.push(e.message));await foreign.goto(origin);
  await expect(foreign.getByRole('alert')).toContainText('no corresponde al espacio');
  await expect(foreign.getByRole('button',{name:'Conectar WhatsApp',exact:true})).toBeDisabled();await foreign.close();
  mode='readonly';const readonly=await context.newPage();readonly.on('pageerror',e=>errors.push(e.message));await readonly.goto(origin);await expect(readonly.getByRole('button',{name:'Conectar WhatsApp',exact:true})).toBeDisabled();await readonly.close();
  assert.deepEqual(errors,[]);assert.equal(requests.length,6);
  const proof={result:'PASS',environment:'real-preparation-and-connection-components-synthetic-HTTP',companyScopedPersistence:true,noWriteOnLoad:true,sameRequestRecovery:true,guardDirtyChanges:true,unsupportedNumberModeDoesNotLaunchMeta:true,worksiteDestinationFixed:true,independentSitesInSameCompany:true,conflictPreservesDraft:true,wrongTenantResponseRejected:true,reloadRetainsPreparation:true,savedFormCollapses:true,widths:[320,390,768,1280],pageErrors:0,fixtureWrites:requests.length,externalMetaCalls:0,readOnlySiteCannotAuthorize:true};
  writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
