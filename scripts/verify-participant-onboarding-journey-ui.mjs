import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { projectParticipantOnboarding } from '../src/lib/whatsapp/participant-onboarding-progress.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/participant-onboarding-journey-ui');mkdirSync(out,{recursive:true});
const entry=`import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';
import Contact from './src/app/dashboard/inbox/contact-onboarding-action';
import Review from './src/app/dashboard/team/worker-onboarding-client';
import './src/app/globals.css';import './src/app/platform.css';
function App(){const[url,setUrl]=useState(location.href),[progress,setProgress]=useState({state:'closed'});
async function refresh(){const response=await fetch('/fixture/contact');const data=await response.json();setProgress(data);return data;}
useEffect(()=>{const route=()=>setUrl(location.href);window.addEventListener('popstate',route);return()=>window.removeEventListener('popstate',route)},[]);
useEffect(()=>{if(!url.includes('/dashboard/team'))void refresh()},[url]);
return <main style={{maxWidth:940,margin:'auto',padding:16}}>{url.includes('/dashboard/team')?<Review key={url} organizationId="organization-a" projectId="project-a" projectName="Obra de ensayo · Norte" focusedClaimId={new URL(url).searchParams.get('onboardingClaimId')} canRead={true} canManage={!url.includes('reader=1')}/>:<Contact key={'conversation-a:'+progress.state} conversationId="conversation-a" projectId="project-a" projectName="Obra de ensayo · Norte" canManageOnboarding={!url.includes('reader=1')} canManageIntegrations={true} onboarding={progress} onRefresh={refresh}/>}</main>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'local-navigation',setup(api){
 api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...rest}){return <a {...rest} href={href} onClick={event=>{onNavigate?.(event);if(!event.defaultPrevented){event.preventDefault();history.pushState({},'',href);window.dispatchEvent(new Event('popstate'));}}}/>} `}));
}}]});
const now=new Date().toISOString(),expires=new Date(Date.now()+3600000).toISOString();
let stage='eligible',delivery='accepted',revision=2,loseDecision=true,wrongClaim=false;
const requests=[],errors=[];
const claim=()=>({id:wrongClaim?'other-claim':'claim-a',status:stage==='APPROVED'?'APPROVED':stage==='PENDING'?'PENDING':'SUBMITTED',revision,sender:stage==='APPROVED'?null:'WhatsApp •••• 1234',identity:stage==='APPROVED'?null:{legalName:'Trabajador de ensayo',maskedCuil:'CUIL •••• 0001',privacyNoticeVersion:'fixture-v1'},retention:{state:stage==='APPROVED'?'PURGED':'ACTIVE'},verification:{state:'VERIFIED'},reviewReady:stage==='SUBMITTED',createdAt:now,submittedAt:now,expiresAt:expires,reviewedAt:stage==='APPROVED'?now:null,resolution:stage==='APPROVED'?{workerId:'worker-a'}:null});
function contact(){
 const approved=['APPROVED','REVOKED'].includes(stage);
 return projectParticipantOnboarding({state:stage==='eligible'?'eligible':stage==='APPROVED'?'authorized':stage==='REVOKED'?'conflict':stage==='blocked'?'closed':'already_pending',checkedAt:now,
 capability:{code:stage==='blocked'?'WHATSAPP_REMOTE_HEALTH_EVIDENCE_STALE':'READY',reason:stage==='blocked'?'Verificá el canal antes de invitar.':''},
 invitation:['eligible','blocked'].includes(stage)?null:{claimId:'claim-a',claimStatus:approved?'APPROVED':stage,delivery:stage==='SUBMITTED'?'submitted':delivery,expiresAt:expires},
 currentAccess:stage==='APPROVED'?{workerId:'worker-a',role:'WORKER',verifiedNow:true,checkedAt:now}:null});
}
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://fixture');res.setHeader('Cache-Control','no-store');
 if(url.pathname==='/fixture/contact'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(contact()));return;}
 if(url.pathname==='/api/worker-onboarding/claims'){
   requests.push({method:'GET',kind:'claim',query:url.search});assert.equal(url.searchParams.get('claimId'),'claim-a');assert.equal([...url.searchParams.keys()].length,1);
   assert.equal(req.headers['x-obrasaas-project'],'project-a');assert.equal(req.headers['x-obrasaas-organization'],'organization-a');
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({items:[claim()],nextCursor:null}));return;
 }
 if(url.pathname==='/api/whatsapp/inbox/conversation-a/worker-onboarding'&&req.method==='POST'){
   requests.push({method:'POST',kind:'invite',key:req.headers['idempotency-key']});assert.equal(url.searchParams.get('projectId'),'project-a');assert.ok(req.headers['idempotency-key']);stage='PENDING';
   res.setHeader('Content-Type','application/json');res.end('{"invitation":{"id":"invitation-a"}}');return;
 }
 if(url.pathname==='/api/worker-onboarding/claims/claim-a/decision'&&req.method==='POST'){
   let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{
     const input=JSON.parse(text);requests.push({method:'POST',kind:'decision',key:req.headers['idempotency-key'],input});assert.equal(input.action,'APPROVE');assert.equal(input.expectedRevision,2);
     assert.equal(req.headers['x-obrasaas-project'],'project-a');assert.equal(req.headers['x-obrasaas-organization'],'organization-a');stage='APPROVED';revision=3;
     res.setHeader('Content-Type','application/json');if(loseDecision){loseDecision=false;res.statusCode=503;res.end('{"error":"La respuesta se perdió después de registrar la decisión."}');return;}
     res.end(JSON.stringify({id:'claim-a',projectId:'project-a',revision:3,status:'APPROVED',replayed:true,resolution:{workerId:'worker-a'}}));
   });return;
 }
 if(url.pathname==='/bundle.js'||url.pathname==='/bundle.css'){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000}});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));const origin='http://127.0.0.1:'+server.address().port;
 await page.goto(origin+'/dashboard/inbox');await expect(page.getByRole('button',{name:'Preparar invitación',exact:true})).toBeVisible();
 assert.equal(requests.filter(r=>r.method==='POST').length,0);
 await page.getByRole('button',{name:'Preparar invitación',exact:true}).click();await expect(page.getByRole('button',{name:'Enviar invitación de alta',exact:true})).toBeDisabled();
 await page.getByRole('checkbox',{name:/Confirmo enviar una invitación privada/}).check();assert.equal(requests.filter(r=>r.method==='POST').length,0);
 await page.getByRole('button',{name:'Enviar invitación de alta',exact:true}).click();
 await expect(page.getByText('Esperando los datos del trabajador',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Preparar invitación',exact:true})).toHaveCount(0);
 stage='SUBMITTED';await page.getByRole('button',{name:'Actualizar seguimiento',exact:true}).click();
 await expect(page.getByText('Datos enviados: falta la decisión',{exact:true})).toBeVisible();
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Inbox overflow '+width);if(width===390||width===1280)await page.screenshot({path:resolve(out,'contact-journey-'+width+'.png'),fullPage:true});}
 const review=page.getByRole('link',{name:/Revisar esta alta/});await expect(review).toHaveAttribute('href','/dashboard/team?onboardingClaimId=claim-a#worker-onboarding');await review.click();
 await expect(page.getByText('Alta vinculada a la conversación',{exact:true})).toBeVisible();await expect(page.getByText('Trabajador de ensayo',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Revisar y aprobar',exact:true}).click();
 page.once('dialog',dialog=>dialog.dismiss());const navigated=await page.evaluate(()=>window.dispatchEvent(new CustomEvent('obrasaas:before-workspace-navigation',{cancelable:true,detail:{kind:'project'}})));assert.equal(navigated,false);
 await page.getByRole('button',{name:'Aprobar alta operativa',exact:true}).click();await expect(page.getByRole('alert')).toContainText('respuesta se perdió');
 await expect(page.getByRole('button',{name:'Verificar la misma decisión',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Verificar la misma decisión',exact:true}).click();await expect(page.getByText('La decisión ya estaba registrada. La cola fue reconciliada.',{exact:true})).toBeVisible();
 await expect(page.getByText('Alta operativa aprobada',{exact:true})).toBeVisible();
 const decisions=requests.filter(r=>r.kind==='decision');assert.equal(decisions.length,2);assert.deepEqual(decisions[0],decisions[1]);
 assert.equal(requests.filter(r=>r.kind==='invite').length,1);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Review overflow '+width);if(width===390)await page.screenshot({path:resolve(out,'approved-review-'+width+'.png'),fullPage:true});}
 await page.getByRole('link',{name:'Volver a Bandeja WhatsApp',exact:true}).click();await expect(page.getByText('Participante autorizado en esta obra',{exact:true})).toBeVisible();await expect(page.getByText('Operario',{exact:true})).toBeVisible();
 stage='REVOKED';await page.getByRole('button',{name:'Actualizar seguimiento',exact:true}).click();await expect(page.getByText('Acceso pendiente de revisión',{exact:true})).toBeVisible();
 await expect(page.getByText('Participante autorizado en esta obra',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Preparar invitación',exact:true})).toHaveCount(0);
 stage='blocked';await page.getByRole('button',{name:'Actualizar seguimiento',exact:true}).click();await expect(page.getByRole('link',{name:'Revisar canal en Integraciones',exact:true})).toBeVisible();
 assert.equal(requests.filter(r=>r.method==='POST').length,3);await page.close();
 const reader=await context.newPage();reader.on('pageerror',error=>errors.push(error.message));stage='eligible';await reader.goto(origin+'/dashboard/inbox?reader=1');await expect(reader.getByRole('button',{name:'Preparar invitación',exact:true})).toHaveCount(0);await reader.close();
 const wrong=await context.newPage();wrong.on('pageerror',error=>errors.push(error.message));wrongClaim=true;stage='SUBMITTED';await wrong.goto(origin+'/dashboard/team?onboardingClaimId=claim-a');
 await expect(wrong.getByRole('alert')).toContainText('no corresponde al alta solicitada');await expect(wrong.getByRole('button',{name:'Revisar y aprobar',exact:true})).toHaveCount(0);await wrong.close();
 assert.deepEqual(errors,[]);
 const proof={result:'PASS',environment:'real-contact-and-review-components-with-synthetic-HTTP-and-identity',explicitInvitationConsent:true,invitationWrites:1,pinnedClaimReview:true,returnToInbox:true,exactDecisionRetry:true,decisionWrites:2,historicalApprovalDoesNotOverrideRevocation:true,blockedSetupActionVisible:true,unprivilegedInvitationHidden:true,foreignClaimResponseRejected:true,dirtyNavigationProtected:true,widths:[320,390,768,1280],pageErrors:0,externalMetaCalls:0};
 writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
