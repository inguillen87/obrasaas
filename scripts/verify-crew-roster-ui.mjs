import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium,expect } from '@playwright/test';
import { normalizeCrewAddition,normalizeCrewDecision,crewMembershipState } from '../src/lib/crew-membership-policy.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/crew-roster-ui');mkdirSync(out,{recursive:true});
const scope={organizationId:'org-a',projectId:'project-a'},team={id:'team-a',name:'Cuadrilla Norte · Ensayo',revision:2,status:'ACTIVE',members:[]};
const worker={id:'worker-a',name:'Persona de ensayo',active:true};
const entry=`import React from'react';import{createRoot}from'react-dom/client';import Execution from './src/app/dashboard/execution/execution-client';import './src/app/globals.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><Execution initialData={{teams:[${JSON.stringify(team)}],assignments:[],blockers:[]}} tasks={[]} workers={[${JSON.stringify(worker)}]} permissions={{canManage:!location.search.includes('readonly'),canReadTasks:true}} organizationId="org-a" projectId="project-a"/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'test-links',setup(api){api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={e=>onNavigate?.(e)}/>} `}));}}]});
let member=null,loseAddition=true,loseEnd=true,foreign=false;const calls=[],errors=[];
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
function serialized(){return member?{...member,state:crewMembershipState(member,new Date())}:null;}
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://local');const base='/api/execution/teams/team-a/members';
  if(url.pathname===base&&req.method==='GET'){
    const row=serialized(),view=url.searchParams.get('view')||'current';calls.push({type:'LIST',view});const rows=row&&(view==='all'||view==='current'&&row.state==='CURRENT'||view==='past'&&row.state==='ENDED')?[row]:[];
    return json(res,{context:foreign?{...scope,projectId:'other'}:scope,team,members:rows,workers:[worker],workersTruncated:false,writable:true,summary:{current:row?.state==='CURRENT'?1:0,past:row?.state==='ENDED'?1:0,scheduled:0},page:{view,limit:50,hasMore:false,nextAfter:null},checkedAt:new Date().toISOString()});
  }
  if(url.pathname===base&&req.method==='POST'){
    let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{const command=normalizeCrewAddition(JSON.parse(text));const key=req.headers['idempotency-key'];calls.push({type:'ADD',command,key,organization:req.headers['x-obrasaas-organization'],project:req.headers['x-obrasaas-project']});
      const replayed=Boolean(member);member||={id:'member-fixture',projectId:'project-a',teamId:'team-a',workerId:command.workerId,worker:{name:worker.name,active:true},role:command.role,revision:0,startsAt:new Date().toISOString(),endsAt:null,lastDecision:null};
      if(loseAddition){loseAddition=false;return json(res,{error:'Respuesta interrumpida después del alta'},503);}return json(res,{context:scope,member:serialized(),replayed});});return;
  }
  if(url.pathname===base+'/member-fixture'){
    if(req.method==='GET'){calls.push({type:'READ'});return json(res,{context:scope,member:serialized()});}
    let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{const command=normalizeCrewDecision(JSON.parse(text));calls.push({type:'CHANGE',command});assert.equal(command.expectedRevision,member.revision);
      member={...member,revision:member.revision+1,...(command.operation==='END'?{endsAt:new Date().toISOString()}:{role:command.role}),lastDecision:{note:command.note,operation:command.operation,revision:member.revision+1,role:command.role||member.role,at:new Date().toISOString()}};
      if(command.operation==='END'&&loseEnd){loseEnd=false;return json(res,{error:'Respuesta de finalización perdida'},503);}return json(res,{context:scope,member:serialized()});});return;
  }
  if(url.pathname==='/bundle.js'||url.pathname==='/bundle.css'){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial;--bg-main:#060913;--text-primary:#f8fafc;--text-secondary:#94a3b8;--border-color:#334155}body{margin:0;padding:12px;background:#060913}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000},locale:'es-AR'});
  const origin='http://127.0.0.1:'+server.address().port,page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/dashboard/execution');
  await page.getByRole('button',{name:'Ver integrantes',exact:true}).click();const modal=page.getByRole('dialog',{name:'Integrantes de Cuadrilla Norte · Ensayo'});
  await expect(modal.getByRole('button',{name:'Cerrar integrantes'})).toBeFocused();await expect(modal.getByText('No hay participaciones registradas en este filtro. El historial se conserva por separado.',{exact:true})).toBeVisible();
  await modal.getByRole('button',{name:'Cerrar integrantes'}).click();assert.equal(calls.filter(c=>c.type==='ADD').length,0);
  await page.getByRole('button',{name:'Ver integrantes',exact:true}).click();await modal.getByRole('button',{name:'Incorporar integrante',exact:true}).click();
  await modal.getByRole('combobox',{name:'Persona a incorporar'}).selectOption('worker-a');await modal.getByRole('combobox',{name:'Función en la cuadrilla'}).selectOption('LEAD');
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});const box=await modal.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'add-'+width+'.png')});}
  page.once('dialog',dialog=>dialog.dismiss());await modal.getByRole('button',{name:'Volver sin cambiar'}).click();await expect(modal.getByRole('combobox',{name:'Persona a incorporar'})).toHaveValue('worker-a');
  await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'Confirmar incorporación'}).click();await expect(modal.getByRole('button',{name:'Verificar el mismo intento'})).toBeVisible();
  await modal.getByRole('button',{name:'Verificar el mismo intento'}).click();await expect(modal.getByRole('heading',{name:'Persona de ensayo',exact:true})).toBeVisible();
  const additions=calls.filter(c=>c.type==='ADD');assert.equal(additions.length,2);assert.equal(additions[0].key,additions[1].key);assert.deepEqual(additions[0].command,additions[1].command);
  await modal.getByRole('button',{name:'Cambiar función',exact:true}).click();await modal.getByRole('combobox',{name:'Función en la cuadrilla'}).selectOption('MEMBER');
  await modal.getByRole('textbox',{name:'Explicación del cambio de participación'}).fill('Rotación de la coordinación interna.');await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'Confirmar cambio'}).click();
  await expect(modal.getByText('Integrante',{exact:true})).toBeVisible();assert.equal(member.revision,1);
  await modal.getByRole('button',{name:'Finalizar participación',exact:true}).click();await modal.getByRole('textbox',{name:'Explicación del cambio de participación'}).fill('Finaliza su participación en esta cuadrilla, no su legajo.');
  await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'Confirmar cambio'}).click();await expect(modal.getByRole('button',{name:'Consultar estado sin reenviar'})).toBeVisible();
  await modal.getByRole('button',{name:'Consultar estado sin reenviar'}).click();await expect(modal.getByRole('combobox',{name:'Filtro de participaciones'})).toHaveValue('past');await expect(modal.getByText('Finalizada · v2',{exact:true})).toBeVisible();
  assert.equal(calls.filter(c=>c.type==='CHANGE').length,2);await expect(modal.getByRole('button',{name:'Finalizar participación',exact:true})).toHaveCount(0);
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'history-'+width+'.png')});}
  await modal.getByRole('button',{name:'Consultar decisión'}).click();await expect(modal.getByText('Finaliza su participación en esta cuadrilla, no su legajo.',{exact:true})).toBeVisible();await modal.getByRole('button',{name:'Cerrar integrantes'}).click();
  await page.reload();await page.getByRole('button',{name:'Ver integrantes'}).click();await modal.getByRole('combobox',{name:'Filtro de participaciones'}).selectOption('past');await expect(modal.getByText('Finalizada · v2',{exact:true})).toBeVisible();
  await page.goto(origin+'/dashboard/execution?readonly=1');await page.getByRole('button',{name:'Ver integrantes'}).click();await expect(modal.getByRole('combobox',{name:'Filtro de participaciones'})).toBeVisible();await expect(modal.getByRole('button',{name:'Incorporar integrante',exact:true})).toHaveCount(0);
  foreign=true;await modal.getByRole('button',{name:'Actualizar',exact:true}).click();await expect(modal.getByRole('alert')).toContainText('La consulta no corresponde');await expect(modal.getByRole('heading',{name:'Persona de ensayo',exact:true})).toHaveCount(0);
  assert.deepEqual(errors,[]);assert.equal(worker.active,true);assert.ok(additions.every(c=>c.organization==='org-a'&&c.project==='project-a'));
  const proof={result:'PASS',environment:'real-ExecutionClient-roster-components-and-normalizers-with-synthetic-HTTP',readBeforeWrite:true,explicitPersonAndInternalRole:true,identicalAdditionRetry:true,reviewedRoleChange:true,endPreservesHistory:true,lostEndUsesGet:true,noEmploymentOrPermissionsChange:true,discardProtected:true,reloadVerified:true,readOnlyAndForeignContext:true,widths:[320,390,768,1280],additionRequests:2,decisionRequests:2,pageErrors:0};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
