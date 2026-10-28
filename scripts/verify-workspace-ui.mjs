import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {projectPreparationSnapshot} from '../src/app/(identity)/cuenta/project-preparation-format.mjs';
import {respondClosedCompanySubscription} from './lib/company-subscription-ui-fixture.mjs';
import {copyPlanDocumentCurveFixture} from './lib/plan-document-curve-fixture-copy.mjs';

// Browser-only acceptance of the real component with intercepted synthetic API
// responses. This is NOT proof of a production login, employee or WhatsApp event.
assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV);
assert.ok([undefined,'onboarding-epoch','guide-observation','guide-http-denial','portfolio-access-race','workbench','gantt-volume','confirmed-progress','confirmed-progress-planning','confirmed-progress-unloaded','confirmed-progress-snapshots','navigation','post-progress','post-conflicts','post-creation'].includes(process.env.WORKSPACE_UI_SCENARIO));
const root=process.cwd(),evidence=path.join(root,'.vercel/workspace-evidence');
mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/workspace-ui-')),app=path.join(fixture,'src/app'),components=path.join(app,'(identity)/cuenta');
mkdirSync(components,{recursive:true});mkdirSync(path.join(fixture,'src/lib'),{recursive:true});copyFileSync(path.join(root,'src/lib/worker-channel-consent-policy.mjs'),path.join(fixture,'src/lib/worker-channel-consent-policy.mjs'));
mkdirSync(path.join(fixture,'src/lib/whatsapp'),{recursive:true});copyFileSync(path.join(root,'src/lib/whatsapp/tenant-workspace-policy.js'),path.join(fixture,'src/lib/whatsapp/tenant-workspace-policy.js'));
const sourceManifest=[];
sourceManifest.push({path:'scripts/lib/company-subscription-ui-fixture.mjs',sha256:createHash('sha256').update(readFileSync(new URL('./lib/company-subscription-ui-fixture.mjs',import.meta.url))).digest('hex')});
const entitlementPath='src/lib/company-entitlement.mjs';copyFileSync(path.join(root,entitlementPath),path.join(fixture,entitlementPath));assert.deepEqual(readFileSync(path.join(root,entitlementPath)),readFileSync(path.join(fixture,entitlementPath)));sourceManifest.push({path:entitlementPath,sha256:createHash('sha256').update(readFileSync(path.join(fixture,entitlementPath))).digest('hex')});
const officeIdentityPath='src/lib/identity-return-path.mjs';copyFileSync(path.join(root,officeIdentityPath),path.join(fixture,officeIdentityPath));assert.deepEqual(readFileSync(path.join(root,officeIdentityPath)),readFileSync(path.join(fixture,officeIdentityPath)));sourceManifest.push({path:officeIdentityPath,sha256:createHash('sha256').update(readFileSync(path.join(fixture,officeIdentityPath))).digest('hex')});
copyFileSync(path.join(root,'src/lib/geo.js'),path.join(fixture,'src/lib/geo.js'));
copyFileSync(path.join(root,'src/lib/field-media-privacy.mjs'),path.join(fixture,'src/lib/field-media-privacy.mjs'));
sourceManifest.push({path:'src/lib/geo.js',sha256:createHash('sha256').update(readFileSync(path.join(fixture,'src/lib/geo.js'))).digest('hex')});
for(const file of readdirSync(path.join(root,'src/app/(identity)/cuenta')).filter(name=>/\.(js|mjs|css)$/.test(name))){copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(components,file));sourceManifest.push({path:'src/app/(identity)/cuenta/'+file,sha256:createHash('sha256').update(readFileSync(path.join(components,file))).digest('hex')});}
const phoneFormatPath='src/lib/company-phone-format.mjs';copyFileSync(path.join(root,phoneFormatPath),path.join(fixture,phoneFormatPath));assert.deepEqual(readFileSync(path.join(root,phoneFormatPath)),readFileSync(path.join(fixture,phoneFormatPath)));sourceManifest.push({path:phoneFormatPath,sha256:createHash('sha256').update(readFileSync(path.join(root,phoneFormatPath))).digest('hex')});
const harnessSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
for(const file of ["src/lib/whatsapp/tenant-workspace-policy.js","src/lib/worker-channel-consent-policy.mjs","src/lib/field-media-privacy.mjs"])sourceManifest.push({path:file,sha256:createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')});
for(const file of ['voice-progress-draft.mjs','procurement-quantity.js','progress-measurement-quantity.js','task-progress-measurement.js','capture-quality-policy.mjs']){const source='src/lib/'+file,destination=path.join(fixture,source);copyFileSync(path.join(root,source),destination);assert.deepEqual(readFileSync(path.join(root,source)),readFileSync(destination));sourceManifest.push({path:source,sha256:createHash('sha256').update(readFileSync(destination)).digest('hex')});}
assert.equal(new Set(sourceManifest.map(row=>row.path)).size,sourceManifest.length);
const documentCurveSourceManifest=[];
const {fixtureTransforms:documentCurveFixtureTransforms}=copyPlanDocumentCurveFixture({root,fixture,components:path.join(components),sourceManifest:documentCurveSourceManifest});
for(const ref of documentCurveSourceManifest){const existing=sourceManifest.find(row=>row.path===ref.path);if(existing)assert.equal(existing.sha256,ref.sha256,'Original document dependency source hash');else sourceManifest.push(ref);}
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-workspace-ui-fixture',private:true}));
// Next's development indicator overlaps the mobile load-more button; exclude
// that development-only overlay while preserving compilation/runtime errors.
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};\n`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:16,background:'#0b1c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useState} from 'react';import {OnboardingGuide} from './(identity)/cuenta/onboarding-guide';import {AccountWorkspace} from './(identity)/cuenta/workspace-client';import {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';const token=async()=>{if(window.__failNextToken){window.__failNextToken=false;throw new Error('private SDK diagnostic');}if(window.__holdToken)await new Promise(resolve=>{window.__resolveToken=resolve;});return 'synthetic-active-tab-A';};export default function Page(){const [visible,setVisible]=useState(true),[observation,setObservation]=useState(null);const observed=useCallback(value=>{window.__guideObservation=value;setObservation(value);},[]);if(typeof window!=='undefined')window.__prepareWorkspaceReference=body=>browserRecoveryJournal.prepare('/api/identity/task-creation',{method:'POST',body:JSON.stringify(body)});if(typeof window!=='undefined')window.__workspaceReferences=value=>browserRecoveryJournal.list(value);return <main style={{maxWidth:1000,margin:'0 auto'}}><OnboardingGuide orgId="org_fixture" orgRole="org:admin" observation={observation}/><button onClick={()=>setVisible(false)}>Desmontar ensayo</button>{visible?<AccountWorkspace getSessionToken={token} onGuideObservation={observed}/>:<p>Ensayo desmontado</p>}</main>}`);
const port=3108,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='';for(const stream of [server.stdout,server.stderr])stream.on('data',value=>{serverLog=(serverLog+value.toString()).slice(-20000);});
let browser;const checks=[],pageErrors=[];
const scope='a'.repeat(64),revision='2026-09-30T12:00:00.123456';
const baseTask=()=>({id:'task-a',title:'Mampostería · sector norte',status:'IN_PROGRESS',progress:37,startsOn:'2026-10-01',endsOn:'2026-10-05',revision});
const text=page=>page.evaluate(()=>document.body.innerText);
async function click(page,label){const handle=await page.evaluateHandle(name=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===name),label);const element=handle.asElement();assert.ok(element,'Missing button '+label);await element.click();await handle.dispose();}
async function waitText(page,value){await page.waitForFunction(expected=>document.body.innerText.includes(expected),{timeout:15000},value);}
async function respondClosedHomeDecisions(request,{origin,scope,projectId,allowed,reads,phase}){
 const url=new URL(request.url());if(url.origin!==origin||url.pathname!=='/api/identity/operations-status')return false;
 assert.equal(allowed,true);assert.equal(request.method(),'GET');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
 assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope','view']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),projectId);assert.equal(url.searchParams.get('view'),'decisions');
 reads.push({phase,method:'GET',projectId,scope,view:'decisions'});
 const body={scope,projectId,view:'decisions',observedAt:'2026-10-28T00:00:00.000Z',proposals:{pending:0},inventory:{canManage:true,pendingCounts:{consumptions:0,adjustments:0}}};
 await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});return true;
}
const homeDecisionsResponse=page=>page.waitForResponse(response=>{const url=new URL(response.url());return url.origin===origin&&url.pathname==='/api/identity/operations-status'&&response.request().method()==='GET'&&url.searchParams.get('scope')===scope&&url.searchParams.get('projectId')==='p-a'&&url.searchParams.get('view')==='decisions';},{timeout:15000});
async function confirmedHomeDecisions(page,pending){
 assert.equal((await pending).status(),200);
 await page.waitForFunction(()=>{const button=document.querySelector('section[aria-labelledby="home-decisions-title"] button');return button?.textContent==='Actualizar pendientes'&&!button.disabled;},{timeout:15000});
}
async function fill(page,taskId='task-a'){
 await page.waitForFunction(id=>{const button=[...document.querySelectorAll('[data-task-id]')].find(element=>element.dataset.taskId===id)?.querySelector('button');return button?.disabled===false&&button.getClientRects().length;},{timeout:15000},taskId);
 const handle=await page.evaluateHandle(id=>[...document.querySelectorAll('[data-task-id]')].find(element=>element.dataset.taskId===id)?.querySelector('button'),taskId);
 const button=handle.asElement();assert.ok(button,'Missing planning button for '+taskId);assert.equal(await button.evaluate(element=>element.textContent.trim()),'Planificar fechas');await button.click();await handle.dispose();
 const editor='form[aria-labelledby="schedule-edit-title"]';
 await page.waitForFunction(selector=>{const form=document.querySelector(selector),dates=[...(form?.querySelectorAll('input[type="date"]')||[])];return Boolean(form?.getClientRects().length)&&dates.length===2&&dates.every(element=>!element.disabled&&element.getClientRects().length);},{timeout:15000},editor);
 assert.equal(await page.$$eval(editor+' input[type="date"]',elements=>elements.length),2);
 await page.$eval(editor+' input[type="date"]',(element)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,'2026-10-07');element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.$$eval(editor+' input[type="date"]',elements=>{const element=elements[1];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,'2026-10-15');element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.type(editor+' textarea','Reprogramación revisada en reunión de obra.');
}
const workspaceNav='nav[aria-label="Navegación de la obra"]';
async function showWorkspaceSection(page,id){
 await page.waitForSelector(workspaceNav);await page.waitForFunction((nav,target)=>[...(document.querySelector(nav+' select')?.options||[])].some(option=>option.value===target),{timeout:15000},workspaceNav,id);
 const already=await page.evaluate(target=>{const node=document.getElementById(target),screen=node?.closest('[data-workspace-screen]');return Boolean(node?.getClientRects().length)&&Boolean(screen)&&!screen.hidden;},id);
 if(already)return;
 const picker=await page.$(workspaceNav+' select');assert.ok(picker,'Missing native section picker');
 if(await picker.evaluate(node=>node.getClientRects().length>0)){
  assert.ok(await picker.evaluate((node,target)=>[...node.options].some(option=>option.value===target),id),'Section unavailable in the canonical picker: '+id);await page.select(workspaceNav+' select',id);
 }else{
  const selector=workspaceNav+' a[href="#'+id+'"]',link=await page.$(selector);assert.ok(link,'Missing authorized section link: '+id);
  if(await link.evaluate(node=>Boolean(node.closest('details')&&!node.closest('details').open))){const summary=await link.evaluateHandle(node=>node.closest('details')?.querySelector('summary'));assert.ok(summary.asElement(),'Missing configuration disclosure');await page.locator(workspaceNav+' details summary').click();await summary.dispose();await page.waitForFunction(target=>document.querySelector('nav[aria-label="Navegación de la obra"] a[href="#'+target+'"]')?.closest('details')?.open===true,{},id);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
  await page.locator(selector).click();await link.dispose();
 }
 await picker.dispose();await page.waitForFunction(target=>{const node=document.getElementById(target),screen=node?.closest('[data-workspace-screen]');return Boolean(node?.getClientRects().length)&&Boolean(screen)&&!screen.hidden&&document.activeElement?.id===target;},{timeout:15000},id);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
const toolsNav=workspaceNav;
async function showGuide(page){const toggle=await page.$('section[aria-labelledby="onboarding-guide-title"] button[aria-controls="onboarding-guide-content"]');assert.ok(toggle);await toggle.focus();if(await toggle.evaluate(node=>node.getAttribute('aria-expanded')==='false'))await toggle.click();await page.waitForSelector('#onboarding-guide-content');}
async function toggleTools(page,opened,activation='click'){
 const summary=await page.$(toolsNav+' details summary');assert.ok(summary);
 if(await summary.evaluate((node,value)=>node.closest('details').open===value,opened))return;
 if(activation==='click')await page.locator(toolsNav+' details summary').click();else{await summary.focus();await page.keyboard.press(activation);}
 await page.waitForFunction(value=>document.querySelector('nav[aria-label="Navegación de la obra"] details')?.open===value,{},opened);
}
async function narrowToolsBeforeOriginalTraversal(page,width,requests,posts,homeDecisionReads=[],homeAllowed=false){
 const before=requests.length,homeBefore=homeDecisionReads.length,forms=await page.$$eval('form',nodes=>nodes.length),picker=toolsNav+' select',desktop=toolsNav+' > div';
 await page.evaluate(()=>{window.__mobileNavigation=document.querySelector('nav[aria-label="Navegación de la obra"]');window.__mobileForms=[...document.querySelectorAll('form')];window.__mobileGroups=document.querySelector('nav[aria-label="Navegación de la obra"] select');});
 assert.equal(await page.$eval(picker,node=>node.tagName),'SELECT');assert.equal(await page.$eval(desktop,node=>node.getClientRects().length>0),width>=1100);assert.equal(await page.$eval(picker,node=>node.getClientRects().length>0),width<1100);
 if(width<1100){assert.ok(await page.$eval(picker,node=>node.getBoundingClientRect().height>=44));for(const activation of ['Enter','Space','click']){if(activation==='click')await page.click(picker);else{await page.focus(picker);await page.keyboard.press(activation);}await page.keyboard.press('Escape');await page.select(picker,'schedule-title');await page.waitForFunction(()=>document.querySelector('[data-workspace-screen="cronograma"]')?.hidden===false);assert.ok(await page.$eval('[data-workspace-screen="cronograma"]',node=>node.getClientRects().length>0));
  // Returning to Inicio intentionally refreshes its closed, read-only counts.
  // Observe that one response; keyboard/pointer/orientation must do nothing else.
  const homeResponse=homeAllowed?homeDecisionsResponse(page):null;await page.select(picker,'workspace-home-title');await page.waitForFunction(()=>document.querySelector('[data-workspace-screen="inicio"]')?.hidden===false);if(homeResponse)await confirmedHomeDecisions(page,homeResponse);assert.equal(await page.$eval('[data-workspace-screen="cronograma"]',node=>node.getClientRects().length>0),false);
 }}
 await page.setViewport({width:1099,height:1000});assert.equal(await page.$eval(desktop,node=>node.getClientRects().length>0),false);await page.setViewport({width:1100,height:1000});assert.ok(await page.$eval(desktop,node=>node.getClientRects().length>0));assert.equal(await page.$eval(picker,node=>node.getClientRects().length>0),false);await page.setViewport({width:1099,height:1000});assert.equal(await page.$eval(desktop,node=>node.getClientRects().length>0),false);
 await page.setViewport({width:1280,height:1000});await page.focus(toolsNav+' details summary');await page.evaluate(()=>{window.__mobileFocusedGroup=document.activeElement;});await page.setViewport({width:320,height:1000});await page.waitForFunction(()=>document.querySelector('nav[aria-label="Navegación de la obra"] select')?.checkVisibility());assert.equal(await page.evaluate(()=>window.__mobileFocusedGroup.isConnected),true);assert.ok(await page.$eval(picker,node=>node.getClientRects().length>0));await page.focus(picker);assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('nav[aria-label="Navegación de la obra"] select')),true);
 await page.setViewport({width,height:1000});if(width>=1100)await toggleTools(page,true);assert.ok(await page.$eval(width<1100?picker:desktop,node=>node.getClientRects().length>0));assert.equal(await page.evaluate(()=>document.querySelector('nav[aria-label="Navegación de la obra"]')===window.__mobileNavigation&&document.querySelector('nav[aria-label="Navegación de la obra"] select')===window.__mobileGroups&&window.__mobileForms.every(node=>node.isConnected)),true);assert.equal(await page.$$eval('form',nodes=>nodes.length),forms);const expectedHomeReads=homeAllowed&&width<1100?3:0;assert.equal(homeDecisionReads.length-homeBefore,expectedHomeReads);assert.equal(requests.length-before,expectedHomeReads);assert.ok(requests.slice(before).every(row=>row.method==='GET'&&row.path==='/api/identity/operations-status'));assert.equal(posts.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('mobile-tools-native-keyboard-pointer-breakpoint-focused-orientation-no-unmount-only-explicit-home-reads-'+width);
}
async function assertClosedPendingNavigation(page,width,id,requests,posts){
 const before=requests.length,postCount=posts.length;
 await page.evaluate(()=>{const nodes=[...document.querySelectorAll('form input,form textarea,[data-plan-import] fieldset input,[data-plan-import] textarea,[data-plan-import] input[type=checkbox]')];window.__pendingNavigationDraft={nodes,values:nodes.map(node=>({value:node.value,checked:node.checked,disabled:node.disabled})),forms:[...document.querySelectorAll('form')]};});
 if(width>=1100)await toggleTools(page,false);const pendingLink=toolsNav+' [role="status"] a[href="#'+id+'"]';await page.waitForSelector(pendingLink);assert.ok(await page.$eval(pendingLink,node=>node.getClientRects().length>0&&node.getBoundingClientRect().height>=44));if(width<1100)assert.equal(await page.$eval(toolsNav+' select',node=>node.getClientRects().length>0),true);
 assert.ok(await page.evaluate(()=>window.__pendingNavigationDraft.nodes.length>0));await page.focus(pendingLink);await page.keyboard.press('Enter');await page.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('aria-current')==='page',{},pendingLink);await page.waitForFunction(target=>document.activeElement.id===target,{},id);assert.equal(await page.evaluate(()=>document.activeElement.id),id);assert.equal(await page.evaluate(()=>location.hash),'#'+id);assert.equal(await page.$eval(pendingLink,node=>node.getAttribute('aria-current')),'page');
 if(width>=1100){await toggleTools(page,true,'Space');await toggleTools(page,false,'Enter');}
 assert.equal(await page.evaluate(()=>window.__pendingNavigationDraft.nodes.every(node=>node.isConnected)&&window.__pendingNavigationDraft.forms.every(node=>node.isConnected)),true);assert.deepEqual(await page.evaluate(()=>window.__pendingNavigationDraft.nodes.map(node=>({value:node.value,checked:node.checked,disabled:node.disabled}))),await page.evaluate(()=>window.__pendingNavigationDraft.values));assert.equal(requests.length,before);assert.equal(posts.length,postCount);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
async function mobileImportNavigationScenario(width,uncertain){
 const mode=uncertain?'mobile-import-uncertain':'mobile-import-ready',context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[],draft={id:'mobile-plan-draft',revision:3,status:'READY',existingTaskCount:1,source:{contentType:'application/pdf',bytes:42,sha256:'c'.repeat(64)},sourceAvailable:true,rows:[{title:'Fundaciones sintéticas',startsOn:'2026-10-08',endsOn:'2026-10-10',evidence:'Fila 1 del archivo sintético',uncertainty:''}],warnings:[],failure:null,createdAt:'2026-10-06T00:00:00Z',updatedAt:'2026-10-06T00:00:00Z',decision:null};
 await page.setRequestInterception(true);page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}if(!url.pathname.startsWith('/api/'))return request.continue();requests.push({method:request.method(),path:url.pathname,query:url.search});assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');let body,status=200;
  if(url.pathname==='/api/identity/workspace'){assert.equal(request.method(),'GET');if(!url.search)body={scope,organizationName:'Empresa sintética de navegación de importación',role:'DIRECTOR',roleLabel:'Director de obra',canManageIntegrations:false,canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};else{assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');body={scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Director de obra',canPlanSchedule:true,tasks:[baseTask()],totalTasks:1,nextCursor:null};}}
  else if(url.pathname==='/api/identity/project-preparation'){assert.equal(request.method(),'GET');assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');body=projectPreparationSnapshot({scope,projectId:'p-a',canManage:true,revision:0,detailsDigest:'b'.repeat(64),name:'Obra de prueba A',clientName:'',address:'',teams:[],slots:[],startStatus:'TO_CONFIRM',declarationOnly:true},{scope,projectId:'p-a'});}
  else{assert.equal(url.pathname,'/api/identity/plan-import');if(request.method()==='GET'){assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.has('operationId'),false,'Navigation never consults an uncertain reference automatically');if(url.searchParams.has('draftId')){assert.equal(url.searchParams.get('draftId'),draft.id);body={scope,projectId:'p-a',draft};}else body={scope,projectId:'p-a',canApprove:true,drafts:[draft],truncated:false};}else{assert.ok(uncertain);assert.equal(request.method(),'POST');const input=JSON.parse(request.postData());posts.push(input);assert.equal(posts.length,1);assert.equal(input.action,'APPLY');assert.equal(input.scope,scope);assert.equal(input.projectId,'p-a');assert.equal(input.draftId,draft.id);assert.equal(input.expectedRevision,3);assert.equal(input.reason,'Correcciones sintéticas conservadas al navegar.');assert.equal(input.rows[0].title,'Fundaciones corregidas para revisión');status=503;body={code:'PLAN_IMPORT_UNCONFIRMED'};}}
  await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa sintética de navegación de importación');await page.evaluate(()=>[...document.querySelectorAll('button')].find(node=>node.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="project-preparation-title"]')?.getAttribute('aria-busy')==='false');await showWorkspaceSection(page,'schedule-title');await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});await click(page,'Importar PDF, imagen o Excel');await page.waitForFunction(label=>[...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent.trim()===label&&button.disabled===false),{timeout:15000},'Para revisar · 2026-10-06 · 1 tareas');await click(page,'Para revisar · 2026-10-06 · 1 tareas');await waitText(page,'Compará cada fila con el archivo');
  await page.$eval('[data-plan-import] fieldset input:not([type])',node=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'Fundaciones corregidas para revisión');node.dispatchEvent(new Event('input',{bubbles:true}));});await page.$$eval('[data-plan-import] fieldset input[type=date]',nodes=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [index,node] of nodes.entries()){setter.call(node,index?'2026-10-13':'2026-10-12');node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));}});await page.type('[data-plan-import] textarea','Correcciones sintéticas conservadas al navegar.');await (await page.$$('[data-plan-import] input[type=checkbox]')).at(-1).click();
  if(uncertain){await click(page,'Aplicar 1 tareas');await waitText(page,'La confirmación no llegó.');assert.equal(posts.length,1);}else assert.equal(posts.length,0);
  await page.waitForNetworkIdle({idleTime:100,timeout:15000});const referencesBefore=await page.evaluate(value=>window.__workspaceReferences(value),scope);if(uncertain){assert.equal(referencesBefore.length,1);assert.equal(referencesBefore[0].resource,'plan-import');assert.equal(referencesBefore[0].operationId,posts[0].operationId);}else assert.deepEqual(referencesBefore,[]);
  const canonicalTask=await page.$eval('[data-task-id="task-a"]',node=>node.innerText),requestCount=requests.length;await assertClosedPendingNavigation(page,width,'plan-import-title',requests,posts);assert.deepEqual(await page.evaluate(value=>window.__workspaceReferences(value),scope),referencesBefore);assert.equal(await page.$eval('[data-task-id="task-a"]',node=>node.innerText),canonicalTask);assert.equal(await page.$eval('[data-plan-import] textarea',node=>node.value),'Correcciones sintéticas conservadas al navegar.');assert.equal(requests.length,requestCount);assert.equal(posts.length,uncertain?1:0);assert.equal(await page.$eval('#workspace-refresh',node=>node.disabled),true);checks.push(mode+'-pending-outside-fold-keeps-nodes-dates-reason-checks-canonical-task-and-same-reference-'+width);
 }catch(error){await page.screenshot({path:path.join(evidence,mode+'-failure-'+width+'.png'),fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
}
async function scenario(mode,width=390){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 // Other screens remain mounted with their own disabled recovery inputs. The
 // schedule oracle must inspect all three controls of this operation's form.
 const editor='form[aria-labelledby="schedule-edit-title"]',controls=editor+' input,'+editor+' textarea';
 page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let record=null,applications=0,statusChecks=0;
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());
   if(url.origin!==origin){if(url.protocol==='data:'||url.protocol==='blob:')return request.continue();return request.abort();}
   if(url.pathname!=='/api/identity/workspace')return request.continue();
   assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   requests.push({method:request.method(),query:url.search});
   let body,status=200;
   if(request.method()==='POST'){
    const payload=JSON.parse(request.postData());posts.push(payload);
    assert.equal(payload.scope,scope);assert.equal(payload.taskId,'task-a');assert.equal(payload.projectId,'p-a');assert.equal(payload.expectedRevision,revision);
    assert.equal(payload.startsOn,'2026-10-07');assert.equal(payload.endsOn,'2026-10-15');
    assert.deepEqual(Object.keys(payload).sort(),['operationId','projectId','taskId','scope','expectedRevision','startsOn','endsOn','reason'].sort());
    if(mode==='not-arrived'&&posts.length===1){await request.abort('failed');return;}
    else if(mode==='rollback'&&posts.length===1){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED',saved:false};}
    else if(mode==='conflict'){status=409;body={code:'SCHEDULE_REVISION_CHANGED',saved:false};record=null;}
    else {
     record={scope,saved:true,replayed:false,task:{...baseTask(),startsOn:payload.startsOn,endsOn:payload.endsOn,revision:'2026-10-01T12:00:00.111111'},receipt:{id:'workspace_schedule_'+ 'b'.repeat(64),taskId:'task-a',recordedAt:'2026-10-01T12:00:00.111111',before:{startsOn:'2026-10-01',endsOn:'2026-10-05'},after:{startsOn:payload.startsOn,endsOn:payload.endsOn}}};applications++;
     if(mode==='uncertain'){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED',saved:false};}else body=record;
    }
   }else if(url.searchParams.has('operationId')){
    statusChecks++;assert.equal(url.searchParams.get('operationId'),posts[0].operationId);body=record?{scope,state:'RECORDED',saved:true,receipt:record.receipt,task:record.task}:{scope,state:'NOT_OBSERVED',definitive:false};
   }else if(!url.search){
    if(mode==='denied'){status=403;body={code:'WORKSPACE_MEMBERSHIP_REQUIRED'};}
    else body={scope,organizationName:'Organización de prueba sintética',role:mode==='readonly'?'AUDITOR':'SITE_MANAGER',roleLabel:mode==='readonly'?'Auditor':'Jefe de obra',canPlanSchedule:mode!=='readonly',projects:[{id:'p-a',name:'Obra de prueba A'},...(['race','draft-cancel','rollback','not-arrived'].includes(mode)?[{id:'p-b',name:'Obra de prueba B'}]:[])],projectsTruncated:false};
   }else{
    const projectId=url.searchParams.get('projectId');assert.equal(url.searchParams.get('scope'),scope);
    if(mode==='race'&&projectId==='p-a')await new Promise(resolve=>setTimeout(resolve,600));
    body={scope,project:{id:projectId,name:projectId==='p-b'?'Obra de prueba B':'Obra de prueba A',status:'ACTIVE'},roleLabel:mode==='readonly'?'Auditor':'Jefe de obra',canPlanSchedule:mode!=='readonly',tasks:mode==='empty'?[]:[projectId==='p-b'?{...baseTask(),id:'task-b',title:'Tarea visible de la última obra'}:record?.task||baseTask()],totalTasks:mode==='empty'?0:1,nextCursor:null};
   }
   await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){if(!request.isInterceptResolutionHandled()){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});
 if(mode==='denied'){await waitText(page,'pertenencia vigente');assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);checks.push('membership-denial-has-no-fake-data');await context.close();return;}
 await waitText(page,'Organización de prueba sintética');
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());
 if(mode==='race'){
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());
  await showWorkspaceSection(page,'schedule-title');await waitText(page,'Tarea visible de la última obra');await new Promise(resolve=>setTimeout(resolve,700));assert.ok(!(await text(page)).includes('Mampostería'));checks.push('stale-project-response-never-replaces-current-scope');await context.close();return;
 }
 await showWorkspaceSection(page,'schedule-title');
 if(mode==='empty'){await waitText(page,'no tiene tareas registradas');assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);checks.push('empty-project-does-not-create-tasks-or-gantt-bars');await context.close();return;}
 await showWorkspaceSection(page,'schedule-title');await waitText(page,'Mampostería');await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Horizontal overflow at '+width);
 assert.ok((await text(page)).includes('37 %'));
  if(mode==='readonly'){assert.equal(await page.$$eval('button',nodes=>nodes.filter(node=>node.textContent==='Planificar fechas').length),0);checks.push('read-only-role-has-no-schedule-write-control');const before=requests.length;await click(page,'Meses');await page.waitForFunction(()=>document.querySelector('[data-gantt-scroll]').dataset.ganttScale==='MONTHS');assert.equal(requests.length,before);assert.equal(posts.length,0);checks.push('read-only-gantt-zoom-is-local-without-business-write-'+width);await context.close();return;}
 if(mode==='success')await page.screenshot({path:path.join(evidence,`workspace-${width}.png`),fullPage:true});
 await showWorkspaceSection(page,'schedule-title');await fill(page);assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')).every(b=>b.disabled)));assert.deepEqual(await page.$$eval(controls,nodes=>nodes.map(node=>node.disabled)),[false,false,false]);
 if(mode==='sdk-unavailable')await page.evaluate(()=>{window.__failNextToken=true;});
 if(mode==='unmount-token')await page.evaluate(()=>{window.__holdToken=true;});
 if(mode==='draft-cancel'){await click(page,'Cancelar');await page.waitForFunction(selector=>!document.querySelector(selector),{},editor);assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')).every(b=>!b.disabled)));assert.equal(posts.length,0);checks.push('schedule-draft-locks-project-and-refresh-until-explicit-cancel');await context.close();return;}
 await click(page,'Confirmar planificación');
 if(mode==='sdk-unavailable'){
  await waitText(page,'No se pudo renovar tu sesión');assert.equal(posts.length,0);
  assert.equal(await page.$eval(editor+' textarea',e=>e.value),'Reprogramación revisada en reunión de obra.');
  assert.deepEqual(await page.$$eval(controls,nodes=>nodes.map(node=>node.disabled)),[false,false,false]);
  assert.ok(!(await text(page)).includes('Comprobar guardado'));assert.ok(!(await text(page)).includes('private SDK diagnostic'));
  await click(page,'Confirmar planificación');await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cambio confirmado');assert.equal(posts.length,1);
  checks.push('unsent-session-failure-preserves-editable-schedule-and-allows-explicit-retry');
 }else if(mode==='unmount-token'){
  await page.waitForFunction(()=>typeof window.__resolveToken==='function');await click(page,'Desmontar ensayo');await waitText(page,'Ensayo desmontado');
  await page.evaluate(()=>{window.__holdToken=false;window.__resolveToken();});await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(posts.length,0);await page.waitForFunction(()=>window.__guideObservation===null);assert.equal(await page.$eval('[data-guide-observation]',node=>node.dataset.guideObservation),'UNOBSERVED');checks.push('unmounted-schedule-never-dispatches-late-token-post');checks.push('unmounted-workspace-clears-guide-observation');await context.close();return;
 }else if(mode==='uncertain'){
  await waitText(page,'no confirmó el guardado');assert.equal(posts.length,1);
  assert.equal(await page.$$eval('button',nodes=>nodes.find(node=>node.textContent==='Actualizar').disabled),true);
  const mobileReferences=await page.evaluate(value=>window.__workspaceReferences(value),scope);await assertClosedPendingNavigation(page,width,'schedule-edit-title',requests,posts);assert.deepEqual(await page.evaluate(value=>window.__workspaceReferences(value),scope),mobileReferences);checks.push('uncertain-schedule-pending-outside-fold-keeps-original-reference-and-draft-'+width);
  await click(page,'Comprobar guardado');await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cambio confirmado');assert.equal(posts.length,1);checks.push('uncertain-save-recovers-receipt-without-reposting');
 }else if(['rollback','not-arrived'].includes(mode)){
  await waitText(page,'no confirmó el guardado');assert.equal(posts.length,1);assert.equal(applications,0);
  assert.ok(!(await text(page)).includes('Reintentar la misma planificación'));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')).every(b=>b.disabled)));
  assert.deepEqual(await page.$$eval(controls,nodes=>nodes.map(node=>node.disabled)),[true,true,true]);
  await click(page,'Comprobar guardado');await waitText(page,'No se observa un recibo todavía');assert.equal(posts.length,1);assert.equal(statusChecks,1);
  assert.ok(await page.$eval(editor+' textarea',e=>e.disabled));assert.equal(await page.$eval(editor+' textarea',e=>e.value),'Reprogramación revisada en reunión de obra.');
  if(mode==='rollback'){
   await page.evaluate(()=>{window.__failNextToken=true;});await click(page,'Reintentar la misma planificación');await waitText(page,'Conservamos el intento anterior');
   assert.equal(posts.length,1);assert.ok(await page.$eval(editor+' textarea',e=>e.disabled));assert.ok((await text(page)).includes('Comprobar guardado'));
   checks.push('unsent-retry-keeps-the-previous-uncertain-operation-and-original-draft');
  }
  await click(page,'Reintentar la misma planificación');await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cambio confirmado');assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);assert.equal(applications,1);
  assert.ok((await text(page)).includes('37 %'));assert.ok((await text(page)).includes('2026-10-07 → 2026-10-15'));checks.push(mode+'-schedule-checked-then-exact-retry-once');
 }else if(mode==='conflict'){
  await waitText(page,'Otra persona modificó la tarea');assert.ok(!(await text(page)).includes('Cambio confirmado'));assert.equal(posts.length,1);checks.push('stale-revision-does-not-show-a-success-receipt');
 }else{
  await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cambio confirmado');assert.ok((await text(page)).includes('2026-10-07 → 2026-10-15'));assert.ok((await text(page)).includes('37 %'));assert.equal(posts.length,1);checks.push('planned-dates-receipt-and-unchanged-progress-'+width);
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Overflow after edit at '+width);
 assert.ok(requests.every(request=>['GET','POST'].includes(request.method)));
 await context.close();
}
async function scheduleConflictScenario(mode,width=390){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode:'schedule-conflict-'+mode,width,message:error.message}));
 const project={id:'p-a',name:'Obra de conflicto sintética',status:'ACTIVE'},target={...baseTask(),id:'task-z',title:'Tarea de segunda página'};
 const firstRevision='2026-10-01T10:00:00.123456',secondRevision='2026-10-02T10:00:00.123456';
 let currentTask={...target,title:'Título vigente de la tarea consultada',startsOn:'2026-10-02',endsOn:'2026-10-06',revision:firstRevision,...(mode==='get-failed'?{status:'EN_PROCESO',progress:37.5}:{})};
 const initialPage=[baseTask(),...Array.from({length:99},(_,index)=>({...baseTask(),id:'task-b-'+String(index).padStart(3,'0'),title:'Partida anterior de la página '+index}))],pageCursor=initialPage.at(-1).id;
 const posts=[],directedReads=[],receiptReads=[],pageReadLedger=[];let applications=0,savedTask=null,pageReadPhase='INITIAL',explicitCursorPending=false;
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(url.pathname!=='/api/identity/workspace')return request.continue();
   assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');let body,status=200;
   if(request.method()==='POST'){
    const p=JSON.parse(request.postData());posts.push(p);assert.equal(p.scope,scope);assert.equal(p.projectId,project.id);assert.equal(p.taskId,target.id);
    assert.equal(p.startsOn,'2026-10-07');assert.equal(p.endsOn,'2026-10-15');assert.equal(p.reason,'Reprogramación revisada en reunión de obra.');
    assert.deepEqual(Object.keys(p).sort(),['operationId','projectId','taskId','scope','expectedRevision','startsOn','endsOn','reason'].sort());
    if(mode==='retry-conflict'&&posts.length===1){assert.equal(p.expectedRevision,revision);status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED',saved:false};}
    else if(posts.length===(mode==='retry-conflict'?2:1)){assert.equal(p.expectedRevision,revision);status=409;body={code:'SCHEDULE_REVISION_CHANGED',saved:false};}
    else if(mode==='changed-again'&&posts.length===2){assert.equal(p.expectedRevision,firstRevision);currentTask={...currentTask,startsOn:'2026-10-03',endsOn:'2026-10-08',revision:secondRevision};status=409;body={code:'SCHEDULE_REVISION_CHANGED',saved:false};}
    else{assert.equal(p.expectedRevision,currentTask.revision);applications++;body={scope,saved:true,replayed:false,task:{...currentTask,startsOn:p.startsOn,endsOn:p.endsOn,revision:'2026-10-03T10:00:00.123456'},receipt:{id:'workspace_schedule_'+'b'.repeat(64),taskId:target.id,recordedAt:'2026-10-03T10:00:00.123456',before:{startsOn:currentTask.startsOn,endsOn:currentTask.endsOn},after:{startsOn:p.startsOn,endsOn:p.endsOn}}};savedTask=body.task;}
   }else if(url.searchParams.has('taskId')){
    assert.equal(request.method(),'GET');assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope','taskId']);assert.equal(url.searchParams.get('projectId'),project.id);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('taskId'),target.id);directedReads.push(url.search);
    if(mode==='get-failed'&&directedReads.length===1){status=503;body={saved:false,code:'WORKSPACE_OPERATION_UNCONFIRMED'};}
    else if(mode==='missing'){status=404;body={saved:false,code:'WORKSPACE_TASK_UNAVAILABLE'};}
    else if(mode==='denied-401'||mode==='denied-403'){status=mode==='denied-401'?401:403;body={saved:false,code:status===401?'SESSION_REQUIRED':'WORKSPACE_PROJECT_UNAVAILABLE'};}
    else body={scope:mode==='foreign-scope'?'b'.repeat(64):scope,project:mode==='foreign-project'?{...project,id:'p-foreign'}:project,canPlanSchedule:mode!=='read-only',task:mode==='foreign-task'?{...currentTask,id:'task-foreign'}:currentTask};
   }else if(url.searchParams.has('operationId')){
    receiptReads.push(url.search);assert.equal(mode,'retry-conflict');assert.equal(url.searchParams.get('operationId'),posts[0].operationId);body={scope,state:'NOT_OBSERVED',definitive:false};
   }else if(url.searchParams.get('portfolio')==='1')body={scope,organizationName:'Empresa sintética de conflicto',role:'SITE_MANAGER',projects:[],nextCursor:null};
   else if(!url.search)body={scope,organizationName:'Empresa sintética de conflicto',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:true,canManageIntegrations:false,projects:[project],projectsTruncated:false};
   else{assert.equal(request.method(),'GET');assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),project.id);const cursor=url.searchParams.get('afterTask');assert.ok(cursor===null||cursor===pageCursor);assert.deepEqual([...url.searchParams.keys()].sort(),cursor?['afterTask','projectId','scope']:['projectId','scope']);const kind=cursor&&explicitCursorPending?'EXPLICIT_CURSOR':cursor?'RETAINED_CURSOR':'BASE';if(kind==='EXPLICIT_CURSOR')explicitCursorPending=false;pageReadLedger.push({phase:pageReadPhase,kind,query:url.search});body={scope,project,roleLabel:'Jefe de obra',canPlanSchedule:true,tasks:cursor?[savedTask||target]:initialPage,totalTasks:101,nextCursor:cursor?null:pageCursor};}
   await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode:'schedule-conflict-'+mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 const closeScenario=async()=>{writeFileSync(path.join(evidence,'workspace-conflict-page-ledger-'+mode+'-'+width+'.json'),JSON.stringify({mode,width,pageReadLedger,directedReads,receiptReads,posts:posts.length},null,2));await context.close();};
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,project.name);await click(page,project.name+'Abrir obra');
 await showWorkspaceSection(page,'schedule-title');await waitText(page,'Mampostería');await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});pageReadPhase='EXPLICIT_APPEND';explicitCursorPending=true;await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await waitText(page,target.title);await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});assert.equal(explicitCursorPending,false);assert.equal(pageReadLedger.filter(row=>row.kind==='EXPLICIT_CURSOR').length,1);pageReadPhase='DIRECTED_REVIEW';await showWorkspaceSection(page,'schedule-title');await fill(page,target.id);
 const marker={operationId:'22222222-2222-4222-8222-222222222222',projectId:project.id,scope,title:'Histórico sintético que no debe borrarse',startsOn:'',endsOn:''};
 await page.evaluate(body=>window.__prepareWorkspaceReference(body),marker);
 const references=()=>page.evaluate(value=>window.__workspaceReferences(value),scope),history=await references();assert.equal(history.length,1);assert.equal(history[0].operationId,marker.operationId);
 const editor='form[aria-labelledby="schedule-edit-title"]';
 const preserved=async()=>{assert.deepEqual(await page.$$eval(editor+' input[type="date"]',nodes=>nodes.map(node=>node.value)),['2026-10-07','2026-10-15']);assert.equal(await page.$eval(editor+' textarea',node=>node.value),'Reprogramación revisada en reunión de obra.');assert.equal(await page.$eval('#workspace-refresh',node=>node.disabled),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));};
 await click(page,'Confirmar planificación');
 if(mode==='retry-conflict'){
  await waitText(page,'no confirmó el guardado');assert.equal(posts.length,1);assert.equal((await references()).length,2);
  await click(page,'Comprobar guardado');await waitText(page,'No se observa un recibo todavía');assert.equal(receiptReads.length,1);await click(page,'Reintentar la misma planificación');await waitText(page,'La tarea cambió antes de guardar');assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);assert.equal(await page.$$eval(editor+' button',nodes=>nodes.some(node=>node.textContent==='Comprobar guardado')),false);
 }else await waitText(page,'La tarea cambió antes de guardar');
 const rejectedPosts=posts.length;assert.equal(applications,0);await preserved();assert.deepEqual(await references(),history);assert.equal(await page.$eval(editor+' button[type="submit"]',node=>node.disabled),true);assert.equal(directedReads.length,0);
 if(mode==='unmount-token'){
  await page.evaluate(()=>{window.__holdToken=true;});await click(page,'Consultar revisión actual');await page.waitForFunction(()=>typeof window.__resolveToken==='function');await click(page,'Desmontar ensayo');await waitText(page,'Ensayo desmontado');await page.evaluate(()=>{window.__holdToken=false;window.__resolveToken();});await page.waitForFunction(()=>window.__guideObservation===null);assert.equal(directedReads.length,0);assert.equal(posts.length,rejectedPosts);assert.deepEqual(await references(),history);checks.push('schedule-conflict-unmounted-token-cannot-query-or-restore-draft-'+width);await closeScenario();return;
 }
 async function consult(expectedStatus=200,expectedRevision=firstRevision){
  const pending=page.waitForResponse(response=>{const url=new URL(response.url());return url.origin===origin&&url.pathname==='/api/identity/workspace'&&response.request().method()==='GET'&&url.searchParams.get('projectId')===project.id&&url.searchParams.get('scope')===scope&&url.searchParams.get('taskId')===target.id&&url.searchParams.size===3;},{timeout:15000});
  await click(page,'Consultar revisión actual');const response=await pending;assert.equal(response.status(),expectedStatus);
  if(expectedStatus===401||expectedStatus===403){await page.waitForFunction(selector=>!document.querySelector(selector),{},editor);return;}
  if(expectedStatus===200&&!mode.startsWith('foreign-')&&mode!=='read-only')await page.waitForFunction(value=>document.querySelector('[data-schedule-consulted-revision]')?.textContent===value,{timeout:15000},expectedRevision);
  else await page.waitForFunction(()=>document.querySelector('[data-schedule-conflict] [role="status"]')?.textContent.length>0);
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-schedule-conflict] button')].some(node=>node.textContent==='Consultar revisión actual'&&!node.disabled));assert.equal(posts.length,rejectedPosts);assert.deepEqual(await references(),history);
 }
 const status=mode==='get-failed'?503:mode==='missing'?404:mode==='denied-401'?401:mode==='denied-403'?403:200;
 await consult(status);
 if(mode==='denied-401'||mode==='denied-403'){assert.ok(!(await text(page)).includes(target.title));assert.ok(!(await text(page)).includes('Reprogramación revisada en reunión de obra.'));assert.equal(applications,0);assert.deepEqual(await references(),history);checks.push('schedule-conflict-'+mode+'-hides-private-draft-without-clearing-history-'+width);await closeScenario();return;}
 await preserved();
 if(mode==='missing'||mode.startsWith('foreign-')||mode==='read-only'){
  assert.equal(await page.$eval(editor+' button[type="submit"]',node=>node.disabled),true);assert.equal(await page.$(editor+' input[type="checkbox"]'),null);assert.equal(applications,0);
  if(mode.startsWith('foreign-'))assert.ok(!(await text(page)).includes('Título vigente de la tarea consultada'));
  await click(page,'Cancelar');await page.waitForFunction(selector=>!document.querySelector(selector),{},editor);assert.equal(posts.length,rejectedPosts);assert.deepEqual(await references(),history);checks.push('schedule-conflict-'+mode+'-keeps-draft-blocks-post-and-allows-explicit-cancel-'+width);await closeScenario();return;
 }
 if(mode==='get-failed'){assert.equal(await page.$eval(editor+' button[type="submit"]',node=>node.disabled),true);await consult();await preserved();}
 assert.equal(await page.$eval(editor+' input[type="checkbox"]',node=>node.checked),false);assert.equal(await page.$eval(editor+' button[type="submit"]',node=>node.disabled),true);assert.ok((await page.$eval('[data-schedule-conflict]',node=>node.innerText)).includes('2026-10-02 → 2026-10-06'));
 await page.click(editor+' input[type="checkbox"]');await page.waitForFunction(selector=>!document.querySelector(selector+' button[type="submit"]').disabled,{},editor);await click(page,'Confirmar planificación');
 if(mode==='changed-again'){
  await waitText(page,'La tarea cambió antes de guardar');await page.waitForFunction(()=>!document.querySelector('[data-schedule-consulted-revision]'));assert.equal(posts.length,2);assert.equal(posts[1].expectedRevision,firstRevision);assert.notEqual(posts[1].operationId,posts[0].operationId);assert.equal(applications,0);await preserved();assert.equal(await page.$(editor+' input[type="checkbox"]'),null);assert.deepEqual(await references(),history);
  const before=posts.length;const pending=page.waitForResponse(response=>{const url=new URL(response.url());return url.origin===origin&&url.pathname==='/api/identity/workspace'&&response.request().method()==='GET'&&url.searchParams.get('projectId')===project.id&&url.searchParams.get('scope')===scope&&url.searchParams.get('taskId')===target.id;},{timeout:15000});
  await click(page,'Consultar revisión actual');assert.equal((await pending).status(),200);await page.waitForFunction(value=>document.querySelector('[data-schedule-consulted-revision]')?.textContent===value,{},secondRevision);await page.waitForFunction(()=>[...document.querySelectorAll('[data-schedule-conflict] button')].some(node=>node.textContent==='Consultar revisión actual'&&!node.disabled));assert.equal(posts.length,before);await preserved();assert.equal(await page.$eval(editor+' input[type="checkbox"]',node=>node.checked),false);assert.equal(await page.$eval(editor+' button[type="submit"]',node=>node.disabled),true);
  await page.click(editor+' input[type="checkbox"]');await page.waitForFunction(selector=>!document.querySelector(selector+' button[type="submit"]').disabled,{},editor);await click(page,'Confirmar planificación');
 }
 await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cambio confirmado');assert.equal(applications,1);assert.equal(posts.length,mode==='changed-again'||mode==='retry-conflict'?3:2);assert.equal(posts.at(-1).expectedRevision,mode==='changed-again'?secondRevision:firstRevision);assert.notEqual(posts.at(-1).operationId,posts[0].operationId);assert.deepEqual(await references(),history);assert.equal(await page.$(editor),null);const targetProgress=await page.$eval('[data-task-id="task-z"]',node=>({text:node.innerText,bars:[...node.querySelectorAll('[role="progressbar"]')].map(bar=>Number(bar.getAttribute('aria-valuenow')))}));if(mode==='get-failed'){assert.deepEqual(targetProgress.bars,[]);assert.ok(targetProgress.text.includes('Requiere revisión'));}else assert.deepEqual(targetProgress.bars,[currentTask.progress]);assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',node=>Number(node.getAttribute('aria-valuenow'))),37);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 checks.push('schedule-conflict-'+mode+'-later-page-directed-get-preserves-draft-requires-new-review-and-keeps-history-'+width);await closeScenario();
}
async function navigationScenario(role,width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode:'navigation-'+role,width,message:error.message}));
 const requests=[],posts=[],subscriptionReads=[],homeDecisionReads=[],administrator=role==='ADMIN';let preparationReads=0,participantReads=0,phase='INITIAL';
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();
   requests.push({method:request.method(),path:url.pathname,query:url.search,phase});
   if(request.method()!=='GET'){posts.push(request.postData());throw new Error('Navigation must not mutate a business record');}
   assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   if(await respondClosedCompanySubscription(request,{origin,scope,authorization:'Bearer synthetic-active-tab-A',allowed:administrator,reads:subscriptionReads}))return;
   if(await respondClosedHomeDecisions(request,{origin,scope,projectId:'p-a',allowed:administrator,reads:homeDecisionReads,phase}))return;
   if(['/api/identity/project-creation','/api/identity/office-review'].includes(url.pathname)){
    assert.equal(administrator,true);assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');
    const body=url.pathname==='/api/identity/project-creation'?{scope,projectId:'p-a',canCreate:true}:{scope,projectId:'p-a',canManage:true,channels:[],invitations:[],candidates:[],truncated:false,candidatesLimited:false};
    await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});return;
   }
   if(url.pathname==='/api/identity/project-preparation'){
    assert.equal(administrator,true);assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(++preparationReads,1);
    const body=projectPreparationSnapshot({scope,projectId:'p-a',canManage:true,revision:0,detailsDigest:'b'.repeat(64),name:'Obra de prueba A',clientName:'',address:'',teams:[],slots:[],startStatus:'TO_CONFIRM',declarationOnly:true},{scope,projectId:'p-a'});
    await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});return;
   }
   if(url.pathname==='/api/identity/participants'){assert.equal(++participantReads,1);assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify({scope,projectId:'p-a',canManage:administrator,canInvite:administrator,canManageOfficeRoles:administrator,existingAccounts:[],records:[],privacyNotice:{version:'synthetic-navigation-notice',text:'Ensayo sin documentos ni permisos reales'}})});return;}
   assert.equal(url.pathname,'/api/identity/workspace');
   const tasks=Array.from({length:25},(_,index)=>index===0?baseTask():{...baseTask(),id:'task-nav-'+index,title:'Tarea de ensayo '+index});
   const body=!url.search?{scope,organizationName:'Empresa de ensayo de navegación',role,roleLabel:administrator?'Administrador':'Auditor',canManageIntegrations:administrator,canPlanSchedule:administrator,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false}:{scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:administrator?'Administrador':'Auditor',canPlanSchedule:administrator,tasks,totalTasks:tasks.length,nextCursor:null};
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode:'navigation-'+role,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo de navegación');
 assert.equal(subscriptionReads.length,administrator?1:0,'Only the administrator automatically consults closed subscription status');
 const initialHomeResponse=administrator?homeDecisionsResponse(page):null;
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());
 if(initialHomeResponse)await confirmedHomeDecisions(page,initialHomeResponse);assert.equal(homeDecisionReads.length,administrator?1:0);
 await page.waitForSelector(workspaceNav);
 const nav=workspaceNav;
 if(administrator){await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="project-preparation-title"]')?.getAttribute('aria-busy')==='false');assert.equal(preparationReads,1);}else{assert.equal(preparationReads,0);assert.equal(await page.$('section[aria-labelledby="project-preparation-title"]'),null);}
 await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});await showGuide(page);assert.ok(await page.$('#onboarding-guide-title'));
 const expected=['workspace-home-title','schedule-title','field-title','inventory-title','participant-title','worker-channel-title','workspace-recovery-title',...(administrator?['project-preparation-title','project-creation-title','site-register-title','purchase-title','own-company-number-title','own-company-templates-title','company-channel-title','customer-whatsapp-title','customer-meta-title','customer-inbox-title','template-send-title','constructor-crm-title','demo-pilot-title','operation-status-title','office-review-admin-title','company-subscription-title']:[])];
 const anchors=await page.$$eval(nav+' a[href^="#"]',elements=>elements.map(element=>element.hash.slice(1)));
 assert.deepEqual([...new Set(anchors)].sort(),expected.sort());
 assert.equal(await page.$eval(nav,element=>[...element.querySelectorAll('a[href^="#"]')].every(link=>document.getElementById(link.hash.slice(1)))),true);
 phase='NATIVE_PICKER_AND_ORIENTATION';await narrowToolsBeforeOriginalTraversal(page,width,requests,posts,homeDecisionReads,administrator);
 const groups=await page.$$(nav+' details');if(width>=1100){for(const group of groups){assert.ok(await group.$eval('summary',element=>element.getBoundingClientRect().height>=44));if(!await group.evaluate(element=>element.open))await page.locator(nav+' details summary').click();}}else assert.ok(await page.$eval(nav+' select',element=>element.getBoundingClientRect().height>=44));
 const projectRead=row=>{if(row.path!=='/api/identity/workspace'||!row.query)return false;const url=new URL(origin+row.path+row.query);assert.equal(row.method,'GET');assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');return true;};const nonProjectReads=()=>requests.filter(row=>!projectRead(row));
 const initialRequestCount=nonProjectReads().length,initialHomeReads=homeDecisionReads.length,initialFormCount=await page.$$eval('form',elements=>elements.length);
 phase='NAVIGATION_TRAVERSAL';for(const id of expected){const homeResponse=administrator&&id==='workspace-home-title'?homeDecisionsResponse(page):null;await showWorkspaceSection(page,id);if(homeResponse)await confirmedHomeDecisions(page,homeResponse);await page.waitForFunction(target=>document.activeElement.id===target,{},id);assert.equal(await page.evaluate(()=>document.activeElement.id),id);assert.equal(await page.evaluate(()=>location.hash),'#'+id);}
 await page.waitForNetworkIdle({idleTime:100,timeout:15000});assert.equal(participantReads,1);assert.equal(homeDecisionReads.length,initialHomeReads+Number(administrator));assert.equal(nonProjectReads().length,initialRequestCount+participantReads+Number(administrator));assert.equal(posts.length,0);assert.equal(await page.$$eval('form',elements=>elements.length),initialFormCount);
 phase='KEYBOARD_NAVIGATION';if(width<1100){const homeResponse=administrator?homeDecisionsResponse(page):null;await showWorkspaceSection(page,'workspace-home-title');if(homeResponse)await confirmedHomeDecisions(page,homeResponse);await page.focus(nav+' select');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');}else{const keyboard=await page.$(nav+' a[href="#schedule-title"]');await keyboard.focus();await page.keyboard.press('Enter');}await page.waitForFunction(()=>document.activeElement.id==='schedule-title');assert.equal(await page.evaluate(()=>document.activeElement.id),'schedule-title');
 const expectedHomeReads=initialHomeReads+Number(administrator)+Number(administrator&&width<1100),expectedNonProjectReads=initialRequestCount+participantReads+expectedHomeReads-initialHomeReads;assert.equal(homeDecisionReads.length,expectedHomeReads);assert.equal(nonProjectReads().length,expectedNonProjectReads);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 checks.push('navigation-authorized-canonical-destinations-keyboard-only-canonical-reads-'+role+'-'+width);
 await (await page.$(nav)).screenshot({path:path.join(evidence,'workspace-navigation-'+role+'-'+width+'.png')});
 if(administrator){
  await click(page,'Planificar fechas');await page.waitForSelector('#schedule-edit-title');await page.waitForFunction(()=>document.activeElement.id==='schedule-edit-title',{timeout:15000});
  assert.equal(await page.evaluate(()=>document.activeElement.id),'schedule-edit-title');
  const editorGeometry=await page.$eval('#schedule-edit-title',element=>{const rect=element.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,viewportHeight:innerHeight,scrollY};});
  await page.screenshot({path:path.join(evidence,'workspace-editor-opening-'+width+'.png'),fullPage:false});
  assert.ok(editorGeometry.top>=0&&editorGeometry.top<editorGeometry.viewportHeight,JSON.stringify(editorGeometry));
  await page.type('textarea','Planificación de ensayo que debe conservarse.');
  await showWorkspaceSection(page,'worker-channel-title');
  await page.locator(nav+' a[href="#schedule-edit-title"]').click();await page.waitForFunction(()=>document.activeElement.id==='schedule-edit-title',{timeout:15000});
  assert.equal(await page.evaluate(()=>document.activeElement.id),'schedule-edit-title');
  assert.equal(await page.$eval('textarea',element=>element.value),'Planificación de ensayo que debe conservarse.');
  assert.equal(homeDecisionReads.length,expectedHomeReads);assert.equal(nonProjectReads().length,expectedNonProjectReads);assert.equal(posts.length,0);
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(button=>button.textContent==='Actualizar'||button.textContent.includes('Obra de prueba B')).every(button=>button.disabled)));
  await assertClosedPendingNavigation(page,width,'schedule-edit-title',requests,posts);
  checks.push('long-schedule-editor-focus-and-pending-navigation-preserve-draft-'+width);
  await page.screenshot({path:path.join(evidence,'workspace-pending-editor-'+width+'.png'),fullPage:false});
  await (await page.$(nav)).screenshot({path:path.join(evidence,'workspace-pending-navigation-'+width+'.png')});
  await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('#schedule-edit-title'));
  assert.equal(await page.$(nav+' a[href="#schedule-edit-title"]'),null);
  assert.equal(posts.length,0);checks.push('cancel-clears-pending-navigation-without-mutation-'+width);
 }
 assert.equal(homeDecisionReads.length,administrator?(width<1100?6:2):0);assert.equal(nonProjectReads().length,expectedNonProjectReads);writeFileSync(path.join(evidence,'workspace-navigation-request-ledger-'+role+'-'+width+'.json'),JSON.stringify({role,width,requests,posts:posts.length,participantReads,preparationReads,homeDecisionReads},null,2));await context.close();
}
const workbenchControl={search:'input[aria-label="Buscar tareas"]',status:'select[aria-label="Estado de las tareas"]',planning:'select[aria-label="Planificación de las tareas"]',order:'select[aria-label="Orden de las tareas"]'};
const workbenchTasks=()=>[
 {...baseTask(),id:'wb-mamp-a',title:'Mampostería planta baja',progress:40,startsOn:'2026-10-05',endsOn:'2026-10-09'},
 {...baseTask(),id:'wb-mamp-b',title:'Mampostería sector norte',status:'BACKLOG',progress:0,startsOn:null,endsOn:null},
 {...baseTask(),id:'wb-finished',title:'Acabado de fachada',status:'DONE',progress:100,startsOn:'2026-10-01',endsOn:'2026-10-04'},
 {...baseTask(),id:'wb-invalid-dates',title:'Instalación eléctrica',status:'BLOCKED',progress:30,startsOn:'2026-10-09',endsOn:'2026-10-03'},
 {...baseTask(),id:'wb-unknown-status',title:'Revisión de estructura',status:'PAUSED_LEGACY',progress:45,startsOn:null,endsOn:null},
 {...baseTask(),id:'wb-invalid-progress',title:'Avance pendiente de revisión',progress:140,startsOn:'2026-10-11',endsOn:'2028-03-02'},
];
const workbenchTaskIds=page=>page.$$eval('[data-schedule-workbench] [data-task-id]',elements=>elements.map(element=>element.dataset.taskId));
async function waitWorkbenchTasks(page,expected){await page.waitForFunction(ids=>JSON.stringify([...document.querySelectorAll('[data-schedule-workbench] [data-task-id]')].map(element=>element.dataset.taskId))===JSON.stringify(ids),{timeout:15000},expected);}
async function searchWorkbench(page,value){await page.$eval(workbenchControl.search,element=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,'');element.dispatchEvent(new Event('input',{bubbles:true}));});if(value)await page.type(workbenchControl.search,value);}
async function workbenchScenario(width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000,hasTouch:width<768});
 const mode='workbench';page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let phase='initial-load';
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();
   requests.push({method:request.method(),path:url.pathname,query:url.search,phase});
   if(request.method()!=='GET'){posts.push(request.postData());throw new Error('Schedule filters must not mutate a business record');}
   assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   let body;
   if(!url.search)body={scope,organizationName:'Empresa de ensayo del cronograma',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false};
   else{
    assert.equal(url.searchParams.get('scope'),scope);assert.ok(!url.searchParams.has('operationId'));
    const projectId=url.searchParams.get('projectId'),cursor=url.searchParams.get('afterTask');
    assert.ok(['p-a','p-b'].includes(projectId));
    let tasks,totalTasks,nextCursor;
    if(projectId==='p-b'){assert.equal(cursor,null);tasks=[{...baseTask(),id:'wb-project-b',title:'Tarea propia de la obra B'}];totalTasks=3;nextCursor=null;}
    else if(cursor){
     assert.equal(cursor,'controlled-page-2');
     tasks=[{...workbenchTasks()[0],progress:41,revision:'2026-10-02T10:00:00.654321'},{...baseTask(),id:'wb-page-two-match',title:'Mampostería acceso',progress:15,startsOn:'2026-09-28',endsOn:'2026-10-02'},{...baseTask(),id:'wb-page-two-other',title:'Zanjeo del perímetro',status:'BACKLOG',progress:0,startsOn:'2026-10-15',endsOn:'2026-10-20'}];totalTasks=8;nextCursor=null;
    }else{tasks=workbenchTasks();totalTasks=8;nextCursor='controlled-page-2';}
    body={scope,project:{id:projectId,name:projectId==='p-a'?'Obra de prueba A':'Obra de prueba B',status:'ACTIVE'},roleLabel:'Jefe de obra',canPlanSchedule:true,tasks,totalTasks,nextCursor};
   }
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode,width,phase,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo del cronograma');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());
  await showWorkspaceSection(page,'schedule-title');
  await page.waitForSelector('[data-schedule-workbench]');await waitWorkbenchTasks(page,workbenchTasks().map(task=>task.id));
  await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='STALE',{timeout:15000});
  const initialRequests=requests.length;
  // These six deliberately malformed/legacy rows test defensive rendering.
  // Their background read is rejected; it must not silently sanitize the UI.
  const assertLocalControls=()=>{assert.equal(posts.length,0);assert.equal(requests.filter(row=>new URL(origin+row.path+row.query).searchParams.has('afterTask')).length,0);assert.ok(requests.slice(initialRequests).every(row=>{const url=new URL(origin+row.path+row.query);return row.method==='GET'&&url.searchParams.get('projectId')==='p-a'&&url.searchParams.get('scope')===scope&&[...url.searchParams.keys()].sort().join('|')==='projectId|scope';}),'Only the unchanged-context background base GET may overlap local controls');};
  assert.equal(await page.$eval(workbenchControl.search,element=>element.type),'search');
  for(const [control,values] of [['status',['ALL','BACKLOG','IN_PROGRESS','DONE','BLOCKED','UNRECOGNIZED']],['planning',['ALL','VALID','MISSING','INVALID']],['order',['REGISTERED','START_ASC','TITLE_ASC']]])assert.deepEqual((await page.$$eval(workbenchControl[control]+' option',elements=>elements.map(element=>element.value))).sort(),values.sort());
  await waitText(page,'Mostrando 6 de 6 tareas cargadas');
  const overview=await page.$eval('#schedule-overview-title',element=>element.parentElement.innerText);
  assert.match(overview,/parcial/i);assert.match(await page.$eval('[data-schedule-workbench]',element=>element.innerText),/tareas cargadas/i);
  assert.ok(!/avance (?:global|promedio)|promedio de avance/i.test(await text(page)));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Initial workbench overflow at '+width);
  await (await page.$('[data-schedule-workbench]')).screenshot({path:path.join(evidence,'workspace-workbench-'+width+'.png')});
  checks.push('workbench-partial-loaded-summary-and-accessible-controls-'+width);

   phase='shared-calendar-and-zoom';
   const timeline='[data-gantt-scroll]';
   assert.equal(await page.$eval(timeline,element=>element.dataset.ganttScale),'WEEKS');
   assert.equal(await page.$eval('[data-gantt-axis] time',element=>element.dateTime),'2026-09-28');
   assert.equal(await page.$$eval('[data-gantt-task-id]',elements=>elements.length),6);
   assert.match(await page.$eval('[data-schedule-gantt]',element=>element.innerText),/Vista parcial: sólo tareas cargadas/);
   for(const id of ['wb-mamp-b','wb-invalid-dates','wb-unknown-status'])assert.equal(await page.$(`[data-gantt-task-id="${id}"] [data-gantt-planned]`),null);
   const geometry=await page.$eval('[data-gantt-task-id="wb-mamp-a"] [data-gantt-planned]',element=>({left:element.offsetLeft,width:element.getBoundingClientRect().width,lane:element.parentElement.getBoundingClientRect().width}));
   assert.ok(Math.abs(geometry.left/geometry.lane-7/84)<.002);assert.ok(Math.abs(geometry.width/geometry.lane-5/84)<.002);
   await click(page,'Días');await page.waitForFunction(()=>document.querySelector('[data-gantt-scroll]').dataset.ganttScale==='DAYS');
   assert.equal(await page.$eval('[data-gantt-axis] time',element=>element.dateTime),'2026-10-01');
   assert.equal(await page.$$eval('[data-gantt-axis] time',elements=>elements.length),28);
   await page.evaluate(()=>[...document.querySelectorAll('[data-schedule-gantt] button')].find(button=>button.textContent==='Meses').focus());await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelector('[data-gantt-scroll]').dataset.ganttScale==='MONTHS');
   assert.equal(await page.$eval('[data-schedule-gantt] button[aria-pressed=true]',element=>element.textContent),'Meses');
   assert.equal(await page.$$eval('[data-gantt-axis] time',elements=>elements.length),12);
   await page.click('button[aria-label="Intervalo siguiente del Gantt"]');await waitText(page,'Intervalo 2 de 2');
   assert.equal(await page.$eval('[data-gantt-axis] time',element=>element.dateTime),'2027-10-01');
   const monthCells=await page.$$eval('[data-gantt-axis] time',elements=>elements.map(element=>({date:element.dateTime,width:element.parentElement.getBoundingClientRect().width})));
   const feb=monthCells.find(cell=>cell.date==='2028-02-01'),jan=monthCells.find(cell=>cell.date==='2028-01-01');assert.ok(feb&&jan);assert.ok(Math.abs(feb.width/jan.width-29/31)<.002);
   assert.equal(await page.$('[data-gantt-task-id="wb-mamp-a"] [data-gantt-planned]'),null);
   assert.match(await page.$eval('[data-gantt-task-id="wb-mamp-a"]',element=>element.innerText),/Fuera de este intervalo/);
   await page.click('button[aria-label="Intervalo anterior del Gantt"]');await click(page,'Semanas');
   await page.waitForFunction(()=>document.querySelector('[data-gantt-scroll]').dataset.ganttScale==='WEEKS');
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
   assert.equal(await page.$eval('[data-schedule-gantt] button',element=>getComputedStyle(element).transitionDuration),'0s');
   assertLocalControls();checks.push('gantt-real-calendar-pointer-keyboard-zoom-leap-month-and-bounded-windows-'+width);

   phase='contained-horizontal-pointer-and-keyboard';
   await page.focus(timeline);await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('[data-gantt-scroll]').scrollLeft>0);
   assert.ok(await page.$eval(timeline,element=>element===document.activeElement&&getComputedStyle(element).outlineStyle!=='none'));
   const stickyBefore=await page.$eval('[data-gantt-task-id="wb-mamp-a"]>div',element=>element.getBoundingClientRect().left);
   await page.keyboard.press('End');const atEnd=await page.$eval(timeline,element=>({left:element.scrollLeft,max:element.scrollWidth-element.clientWidth}));assert.ok(Math.abs(atEnd.left-atEnd.max)<=1);
   const stickyAfter=await page.$eval('[data-gantt-task-id="wb-mamp-a"]>div',element=>element.getBoundingClientRect().left);assert.ok(Math.abs(stickyBefore-stickyAfter)<=1);
   await page.keyboard.press('Home');assert.equal(await page.$eval(timeline,element=>element.scrollLeft),0);
   const box=await (await page.$(timeline)).boundingBox();await page.mouse.move(box.x+box.width-12,box.y+35);await page.mouse.wheel({deltaX:240});await page.waitForFunction(()=>document.querySelector('[data-gantt-scroll]').scrollLeft>0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Gantt page overflow at '+width);
   assert.ok(await page.$eval(timeline,element=>element.scrollWidth>element.clientWidth&&getComputedStyle(element).overflowX==='auto'));
   await page.focus(timeline);await page.keyboard.press('Home');
   await (await page.$('[data-schedule-gantt]')).screenshot({path:path.join(evidence,'workspace-gantt-'+width+'.png')});
   assertLocalControls();checks.push('gantt-contained-pointer-scroll-keyboard-focus-sticky-labels-reduced-motion-'+width);

  phase='accent-and-combined-filters';await searchWorkbench(page,'mamposteria');await waitWorkbenchTasks(page,['wb-mamp-a','wb-mamp-b']);
  await page.select(workbenchControl.status,'IN_PROGRESS');await page.select(workbenchControl.planning,'VALID');await waitWorkbenchTasks(page,['wb-mamp-a']);
   assert.deepEqual(await page.$$eval('[data-gantt-task-id]',elements=>elements.map(element=>element.dataset.ganttTaskId)),['wb-mamp-a']);
  await page.select(workbenchControl.order,'START_ASC');assertLocalControls();await waitText(page,'Mostrando 1 de 6 tareas cargadas');
  checks.push('workbench-accent-insensitive-search-combined-filters-no-business-write-'+width);

  phase='no-matches-and-keyboard-clear';await searchWorkbench(page,'tarea que no existe');await waitWorkbenchTasks(page,[]);await waitText(page,'Mostrando 0 de 6 tareas cargadas');
  await page.evaluate(()=>[...document.querySelectorAll('[data-schedule-workbench] button')].find(button=>button.textContent.trim()==='Limpiar filtros').focus());await page.keyboard.press('Enter');
  await waitWorkbenchTasks(page,workbenchTasks().map(task=>task.id));
  assert.equal(await page.$eval(workbenchControl.search,element=>element.value),'');
  for(const [control,value] of [['status','ALL'],['planning','ALL'],['order','REGISTERED']])assert.equal(await page.$eval(workbenchControl[control],element=>element.value),value);
  assertLocalControls();checks.push('workbench-no-matches-keyboard-clear-restores-loaded-tasks-'+width);

  phase='invalid-data';await page.select(workbenchControl.planning,'INVALID');await waitWorkbenchTasks(page,['wb-invalid-dates']);assert.match(await page.$eval('[data-task-id="wb-invalid-dates"]',element=>element.innerText),/Fechas para revisar/);
  await page.select(workbenchControl.planning,'MISSING');await waitWorkbenchTasks(page,['wb-mamp-b','wb-unknown-status']);
  await page.select(workbenchControl.status,'UNRECOGNIZED');await waitWorkbenchTasks(page,['wb-unknown-status']);
  await click(page,'Limpiar filtros');await waitWorkbenchTasks(page,workbenchTasks().map(task=>task.id));
  const invalidProgress=await page.$eval('[data-task-id="wb-invalid-progress"]',element=>({text:element.innerText,bars:element.querySelectorAll('[role="progressbar"]').length}));
  assert.match(invalidProgress.text,/Requiere revisión/);assert.ok(!invalidProgress.text.includes('140 %'));assert.equal(invalidProgress.bars,0);
  assert.match(await page.$eval('[data-schedule-workbench]',element=>element.innerText),/Datos para revisar:/);assertLocalControls();
  checks.push('workbench-invalid-dates-status-and-progress-require-review-'+width);

  phase='ordering';await page.select(workbenchControl.order,'TITLE_ASC');await waitWorkbenchTasks(page,['wb-finished','wb-invalid-progress','wb-invalid-dates','wb-mamp-a','wb-mamp-b','wb-unknown-status']);
  await page.select(workbenchControl.order,'START_ASC');await waitWorkbenchTasks(page,['wb-finished','wb-mamp-a','wb-invalid-progress','wb-mamp-b','wb-invalid-dates','wb-unknown-status']);
  assertLocalControls();checks.push('workbench-local-title-and-valid-start-date-order-'+width);

  phase='draft-preserved';await page.click('[data-task-id="wb-mamp-a"] button');await page.waitForSelector('#schedule-edit-title');
  await page.type('textarea','Borrador de fechas conservado al filtrar el cronograma.');
  const draftDates=await page.$$eval('form input[type="date"]',elements=>elements.map(element=>element.value));
  await page.select(workbenchControl.status,'DONE');await page.select(workbenchControl.planning,'VALID');await page.select(workbenchControl.order,'TITLE_ASC');await searchWorkbench(page,'acabado');await waitWorkbenchTasks(page,['wb-finished']);
  assert.equal(await page.$eval('textarea',element=>element.value),'Borrador de fechas conservado al filtrar el cronograma.');assert.deepEqual(await page.$$eval('form input[type="date"]',elements=>elements.map(element=>element.value)),draftDates);
  assert.ok(await page.$('#schedule-edit-title'));assert.equal(await page.$('[data-task-id="wb-mamp-a"]'),null);assertLocalControls();
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(button=>button.textContent==='Actualizar'||button.textContent.includes('Obra de prueba B')).every(button=>button.disabled)));
  checks.push('workbench-filter-hidden-card-preserves-root-schedule-draft-'+width);
  await page.screenshot({path:path.join(evidence,'workspace-workbench-draft-'+width+'.png'),fullPage:false});await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('#schedule-edit-title'));

  phase='pagination-with-filters';await click(page,'Limpiar filtros');await searchWorkbench(page,'mamposteria');await page.select(workbenchControl.status,'IN_PROGRESS');await page.select(workbenchControl.planning,'VALID');await page.select(workbenchControl.order,'START_ASC');await waitWorkbenchTasks(page,['wb-mamp-a']);assertLocalControls();
  await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await waitWorkbenchTasks(page,['wb-page-two-match','wb-mamp-a']);
  const cursorReads=requests.filter(row=>new URL(origin+row.path+row.query).searchParams.has('afterTask'));assert.equal(cursorReads.length,1);assert.equal(cursorReads[0].phase,'pagination-with-filters');assert.equal(new URL(origin+cursorReads[0].path+cursorReads[0].query).searchParams.get('afterTask'),'controlled-page-2');assert.equal(posts.length,0);
  assert.equal(await page.$eval(workbenchControl.search,element=>element.value),'mamposteria');for(const [control,value] of [['status','IN_PROGRESS'],['planning','VALID'],['order','START_ASC']])assert.equal(await page.$eval(workbenchControl[control],element=>element.value),value);
  await waitText(page,'Mostrando 2 de 8 tareas cargadas');assert.equal(await page.$$eval('[data-task-id="wb-mamp-a"]',elements=>elements.length),1);assert.match(await page.$eval('[data-task-id="wb-mamp-a"]',element=>element.innerText),/41 %/);
   assert.match(await page.$eval('[data-gantt-task-id="wb-mamp-a"]',element=>element.innerText),/41 % registrado/);
  await click(page,'Limpiar filtros');assert.equal((await workbenchTaskIds(page)).length,8);assert.equal(new Set(await workbenchTaskIds(page)).size,8);assert.equal(requests.filter(row=>new URL(origin+row.path+row.query).searchParams.has('afterTask')).length,1);
  checks.push('workbench-pagination-keeps-filters-and-merges-canonical-task-id-'+width);

  phase='project-reset';await searchWorkbench(page,'mamposteria');await page.select(workbenchControl.status,'IN_PROGRESS');await page.select(workbenchControl.planning,'VALID');await page.select(workbenchControl.order,'TITLE_ASC');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());await waitWorkbenchTasks(page,['wb-project-b']);
  await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});const projectBReads=requests.filter(row=>new URL(origin+row.path+row.query).searchParams.get('projectId')==='p-b');assert.equal(projectBReads.length,2,'Explicit project reset and its confirmed background read');assert.ok(projectBReads.every(row=>row.phase==='project-reset'&&new URL(origin+row.path+row.query).searchParams.get('scope')===scope&&!new URL(origin+row.path+row.query).searchParams.has('afterTask')));assert.equal(posts.length,0);assert.equal(await page.$eval(workbenchControl.search,element=>element.value),'');
  for(const [control,value] of [['status','ALL'],['planning','ALL'],['order','REGISTERED']])assert.equal(await page.$eval(workbenchControl[control],element=>element.value),value);
  await waitText(page,'Mostrando 1 de 1 tareas cargadas');assert.match(await page.$eval('#schedule-overview-title',element=>element.parentElement.innerText),/parcial/i);
   assert.equal(await page.$eval('[data-gantt-scroll]',element=>element.dataset.ganttScale),'WEEKS');assert.match(await page.$eval('[data-schedule-gantt]',element=>element.innerText),/Vista parcial/);
  assert.equal(await page.$$eval('button',elements=>elements.filter(element=>element.textContent.trim()==='Cargar más tareas').length),0);
  const partialResult=await page.$eval('[data-schedule-workbench] [role="status"]',element=>element.innerText);assert.ok(!partialResult.includes('Podés cargar más'));assert.ok(partialResult.includes('Actualizá la consulta y volvé a abrir la obra para comprobar el total.'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Final workbench overflow at '+width);
  const targets=await page.$$eval('[data-schedule-workbench] input,[data-schedule-workbench] select,[data-schedule-workbench] button',elements=>elements.map(element=>({label:element.getAttribute('aria-label')||element.textContent.trim(),height:element.getBoundingClientRect().height,width:element.getBoundingClientRect().width})));assert.ok(targets.length>=5);assert.ok(targets.every(target=>target.height>=44&&target.width>=44),JSON.stringify(targets));
  checks.push('workbench-project-reset-partial-total-and-touch-targets-'+width);
  await (await page.$('[data-schedule-workbench]')).screenshot({path:path.join(evidence,'workspace-workbench-project-b-'+width+'.png')});
 }catch(error){
  await page.screenshot({path:path.join(evidence,'workspace-workbench-failure-'+width+'.png'),fullPage:false}).catch(()=>{});
  writeFileSync(path.join(evidence,'workspace-workbench-failure-'+width+'.json'),JSON.stringify({status:'FAILED',phase,width,message:error.message,requests,postCount:posts.length,body:await text(page).catch(()=>null)},null,2));throw error;
 }finally{await context.close();}
}
async function workbenchCanonicalPaginationScenario(width){
 const mode='workbench-canonical-pagination',context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000,hasTouch:width<768});
 const tasks=Array.from({length:102},(_,index)=>({...baseTask(),id:'canonical-'+String(index).padStart(3,'0'),title:index===10||index===100?'Mampostería canónica '+index:'Otra partida '+index,progress:index%100,startsOn:'2026-10-01',endsOn:'2026-10-05'}));
 const cursor=tasks[99].id,requests=[],posts=[];let phase='INITIAL',manualCursorPending=false;
 page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));await page.setRequestInterception(true);
 page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}if(!url.pathname.startsWith('/api/'))return request.continue();
  assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');if(request.method()!=='GET')posts.push(request.postData());assert.equal(request.method(),'GET','Canonical pagination and filters never write');
  let body,kind='ACCOUNT';if(!url.search)body={scope,organizationName:'Empresa de paginación canónica',role:'AUDITOR',roleLabel:'Auditor',canPlanSchedule:false,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};
  else{
   assert.deepEqual([...url.searchParams.keys()].sort(),url.searchParams.has('afterTask')?['afterTask','projectId','scope']:['projectId','scope']);assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.get('scope'),scope);
   const after=url.searchParams.get('afterTask');assert.ok(after===null||after===cursor);kind=after===null?'BASE':manualCursorPending?'EXPLICIT_CURSOR':'RETAINED_CURSOR';if(kind==='EXPLICIT_CURSOR')manualCursorPending=false;
   body={scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Auditor',canPlanSchedule:false,tasks:after?tasks.slice(100):tasks.slice(0,100),totalTasks:102,nextCursor:after?null:cursor};
  }
  requests.push({method:request.method(),path:url.pathname,query:url.search,phase,kind});await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,phase,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de paginación canónica');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await showWorkspaceSection(page,'schedule-title');await waitText(page,'Mostrando 100 de 100 tareas cargadas');await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});
  assert.equal(requests.filter(row=>row.kind==='ACCOUNT').length,1);assert.equal(requests.filter(row=>row.kind==='BASE').length,2,'Explicit project selection plus its confirmed initial background read');assert.equal(requests.filter(row=>row.kind.includes('CURSOR')).length,0);assert.equal(posts.length,0);
  phase='LOCAL_FILTER';await searchWorkbench(page,'mamposteria');await waitWorkbenchTasks(page,['canonical-010']);await page.select(workbenchControl.status,'IN_PROGRESS');await page.select(workbenchControl.planning,'VALID');await page.select(workbenchControl.order,'START_ASC');assert.equal(requests.filter(row=>row.kind.includes('CURSOR')).length,0);assert.equal(posts.length,0);
  phase='EXPLICIT_APPEND';manualCursorPending=true;await click(page,'Cargar más tareas');await waitWorkbenchTasks(page,['canonical-010','canonical-100']);await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});
  assert.equal(manualCursorPending,false);assert.equal(requests.filter(row=>row.kind==='EXPLICIT_CURSOR').length,1);const append=requests.filter(row=>row.phase==='EXPLICIT_APPEND').map(row=>row.kind);assert.equal(append[0],'EXPLICIT_CURSOR');assert.ok(append.slice(1).every((kind,index)=>kind===(index%2===0?'BASE':'RETAINED_CURSOR')),'Every later cursor must follow a same-scope retained-page base read, never a second explicit append');assert.equal(append.length%2,1);
  assert.equal(await page.$eval(workbenchControl.search,element=>element.value),'mamposteria');for(const [control,value]of [['status','IN_PROGRESS'],['planning','VALID'],['order','START_ASC']])assert.equal(await page.$eval(workbenchControl[control],element=>element.value),value);await waitText(page,'Mostrando 2 de 102 tareas cargadas');assert.equal(posts.length,0);
  phase='CLEAR_FILTERS';await click(page,'Limpiar filtros');await waitWorkbenchTasks(page,tasks.map(task=>task.id));assert.equal(new Set(await workbenchTaskIds(page)).size,102);assert.equal(await page.$$eval('[data-gantt-task-id]',elements=>elements.length),102);assert.equal(await page.$('#schedule-load-more'),null);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  checks.push({mode,width,firstPage:100,loaded:102,canonicalCursor:cursor,nativeCurrentBeforeAppend:true,nativeCurrentAfterAppend:true,requests,posts:posts.length});
 }catch(error){writeFileSync(path.join(evidence,'workspace-canonical-pagination-failure-'+width+'.json'),JSON.stringify({mode,width,phase,requests,posts:posts.length,message:error.message},null,2));throw error;}finally{await context.close();}
}

async function ganttVolumeScenario(width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000,hasTouch:width<768});
 const mode='gantt-volume',requests=[],posts=[];let phase='INITIAL',manualCursorPending=null;page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const tasks=Array.from({length:240},(_,index)=>({...baseTask(),id:'volume-'+String(index).padStart(3,'0'),title:'Partida revisada '+(index+1),progress:index%101,startsOn:'2000-01-01',endsOn:'2100-12-31'}));
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();
   const after=url.searchParams.get('afterTask'),kind=!url.search?'ACCOUNT':after===null?'BASE':manualCursorPending===after?'EXPLICIT_CURSOR':'RETAINED_CURSOR';if(kind==='EXPLICIT_CURSOR')manualCursorPending=null;requests.push({method:request.method(),path:url.pathname,query:url.search,phase,kind});
   if(request.method()!=='GET'){posts.push(request.postData());throw new Error('Gantt volume navigation must not mutate a business record');}
   assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   let body;
   if(!url.search)body={scope,organizationName:'Empresa de volumen sintético',role:'AUDITOR',roleLabel:'Auditor',canPlanSchedule:false,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};
   else{
    assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.get('scope'),scope);
    const cursor=url.searchParams.get('afterTask');assert.ok([null,tasks[99].id,tasks[199].id].includes(cursor));
    const start=cursor===tasks[99].id?100:cursor===tasks[199].id?200:0;
    // Deliberate partial-count case: a previously counted300 has240 rows left.
    // Page shape/cursors remain canonical; the UI must keep its partial warning.
    body={scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Auditor',canPlanSchedule:false,tasks:tasks.slice(start,start+100),totalTasks:300,nextCursor:start===0?tasks[99].id:start===100?tasks[199].id:null};
   }
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 const assertVolumeReads=()=>{assert.equal(posts.length,0);assert.ok(requests.every(row=>row.method==='GET'&&row.path==='/api/identity/workspace'));assert.equal(requests.filter(row=>row.kind==='ACCOUNT').length,1);for(const [name,explicit,cycle]of [['INITIAL',null,['BASE','BASE']],['APPEND_100',tasks[99].id,['BASE','RETAINED_CURSOR']],['APPEND_200',tasks[199].id,['BASE','RETAINED_CURSOR','RETAINED_CURSOR']],['LOCAL_CONTROLS',null,['BASE','RETAINED_CURSOR','RETAINED_CURSOR']]]){const rows=requests.filter(row=>row.phase===name&&row.kind!=='ACCOUNT');if(name==='INITIAL'){assert.deepEqual(rows.map(row=>row.kind),cycle);continue;}if(explicit){assert.equal(rows[0]?.kind,'EXPLICIT_CURSOR');assert.equal(new URL(origin+rows[0].path+rows[0].query).searchParams.get('afterTask'),explicit);assert.equal(rows.filter(row=>row.kind==='EXPLICIT_CURSOR').length,1);}const background=explicit?rows.slice(1):rows;assert.equal(background.length%cycle.length,0,'Complete retained-page read cycles for '+name);assert.ok(background.every((row,index)=>row.kind===cycle[index%cycle.length]));for(const row of rows){const url=new URL(origin+row.path+row.query);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');assert.deepEqual([...url.searchParams.keys()].sort(),row.kind==='BASE'?['projectId','scope']:['afterTask','projectId','scope']);}}};
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de volumen sintético');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());
  await showWorkspaceSection(page,'schedule-title');await waitText(page,'Mostrando 100 de 100 tareas cargadas');await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});
  phase='APPEND_100';manualCursorPending=tasks[99].id;await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await waitText(page,'Mostrando 200 de 200 tareas cargadas');await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});assert.equal(manualCursorPending,null);
  phase='APPEND_200';manualCursorPending=tasks[199].id;await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await waitText(page,'Mostrando 240 de 240 tareas cargadas');await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});assert.equal(manualCursorPending,null);
  assertVolumeReads();assert.equal(posts.length,0);
  assert.equal(await page.$$eval('[data-gantt-task-id]',elements=>elements.length),240);
  assert.equal(await page.$$eval('[data-task-id]',elements=>elements.length),240);
  assert.match(await page.$eval('[data-schedule-gantt]',element=>element.innerText),/Vista parcial: sólo tareas cargadas/);
  assert.match(await page.$eval('#schedule-overview-title',element=>element.parentElement.innerText),/Resumen parcial/);
  assert.match(await page.$eval('[data-schedule-workbench]',element=>element.innerText),/240 de 300 tareas cargadas/);
  assert.equal(await page.$$eval('button',elements=>elements.filter(element=>element.textContent==='Planificar fechas').length),0);
  phase='LOCAL_CONTROLS';for(const [label,scale,maxCells] of [['Días','DAYS',28],['Semanas','WEEKS',12],['Meses','MONTHS',12]]){
   await click(page,label);await page.waitForFunction(expected=>document.querySelector('[data-gantt-scroll]').dataset.ganttScale===expected,{},scale);
   assert.equal(await page.$$eval('[data-gantt-axis] time',elements=>elements.length),maxCells);
   assert.equal(await page.$$eval('[data-gantt-planned]',elements=>elements.length),240);
   assert.ok(await page.$eval('[data-gantt-scroll]',element=>element.scrollWidth<=1800&&element.clientHeight<=480));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Volume Gantt page overflow at '+width);
  }
  await waitText(page,'Intervalo 1 de 101');await page.click('button[aria-label="Intervalo siguiente del Gantt"]');await waitText(page,'Intervalo 2 de 101');
  assert.equal(await page.$eval('[data-gantt-axis] time',element=>element.dateTime),'2001-01-01');
  assert.match(await page.$eval('[data-gantt-task-id="volume-239"]',element=>element.innerText),/37 % registrado/);
  assert.equal(await page.$eval('[data-gantt-task-id="volume-239"] [data-gantt-planned]',element=>element.dataset.continuesBefore),'true');
  assert.equal(await page.$eval('[data-gantt-task-id="volume-239"] [data-gantt-planned]',element=>element.dataset.continuesAfter),'true');
  await page.$eval('[data-gantt-scroll]',element=>{element.scrollTop=element.scrollHeight;});
  const last=await page.$eval('[data-gantt-task-id="volume-239"]',element=>({bottom:element.getBoundingClientRect().bottom,top:element.closest('[data-gantt-scroll]').getBoundingClientRect().top,height:element.closest('[data-gantt-scroll]').clientHeight}));
  assert.ok(last.bottom<=last.top+last.height+2);
  await (await page.$('[data-schedule-gantt]')).screenshot({path:path.join(evidence,'workspace-gantt-volume-'+width+'.png')});
  assertVolumeReads();assert.equal(posts.length,0);
  checks.push('gantt-240-paginated-rows-century-bounded-axis-all-zooms-contained-scroll-partial-readonly-'+width);
 }catch(error){await page.screenshot({path:path.join(evidence,'workspace-gantt-volume-failure-'+width+'.png'),fullPage:false}).catch(()=>{});throw error;}
 finally{await context.close();}
}
async function taskCreateScenario(mode){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width:390,height:1000});page.on('pageerror',error=>pageErrors.push({mode:'taskcreate-'+mode,width:390,message:error.message}));
 const editor='section[aria-label="Crear tarea de la obra"] form';
 const posts=[];let record=null,applications=0,statusChecks=0,scheduleReadsAfterCommit=0,manualReadbackPending=false,phase='INITIAL';const scheduleReadLedger=[];await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!['/api/identity/workspace','/api/identity/task-creation'].includes(url.pathname))return request.continue();assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');let status=200,body;
   if(url.pathname==='/api/identity/workspace'){
    if(!url.search)body={scope,organizationName:'Organización de prueba sintética',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false};
    else {assert.equal(request.method(),'GET');assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.get('scope'),scope);assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);const kind=record&&manualReadbackPending?'CONFIRMED_CREATION_READBACK':'BACKGROUND_BASE';if(kind==='CONFIRMED_CREATION_READBACK'){scheduleReadsAfterCommit++;manualReadbackPending=false;}scheduleReadLedger.push({phase,kind,query:url.search});body={scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Jefe de obra',canPlanSchedule:true,tasks:record?[baseTask(),record.task]:[baseTask()],totalTasks:record?2:1,nextCursor:null};}
   }else if(request.method()==='POST'){
    const input=JSON.parse(request.postData());posts.push(input);assert.deepEqual(Object.keys(input).sort(),['operationId','projectId','scope','title','startsOn','endsOn'].sort());assert.equal(input.projectId,'p-a');assert.equal(input.scope,scope);assert.equal(input.title,'Tarea de ensayo recuperable');assert.equal(input.startsOn,'');assert.equal(input.endsOn,'');
    if(mode==='not-arrived'&&posts.length===1){await request.abort('failed');return;}
    else if(mode==='rollback'&&posts.length===1){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED'};}
    else {applications++;record={scope,created:true,replayed:false,receiptId:'workspace_new_task_'+input.operationId,task:{id:'new-task',title:input.title,status:'BACKLOG',progress:0,startsOn:null,endsOn:null,revision:'2026-10-01T12:00:00.111111'}};manualReadbackPending=true;body=record;if(mode==='uncertain'){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED'};}}
   }else {statusChecks++;assert.equal(url.searchParams.get('operationId'),posts[0].operationId);body=record?{...record,state:'RECORDED'}:{scope,state:'NOT_OBSERVED',definitive:false};}
   await request.respond({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Cache-Control':'no-store'}});
  }catch(error){pageErrors.push({mode:'taskcreate-'+mode,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Organización de prueba sintética');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Obra de prueba A')).click());await showWorkspaceSection(page,'schedule-title');await waitText(page,'Mampostería');await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});phase='CREATION_DRAFT';await showWorkspaceSection(page,'schedule-title');await click(page,'Nueva tarea');await page.type(editor+' input:not([type="date"])','Tarea de ensayo recuperable');assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')||b.textContent==='Planificar fechas').every(b=>b.disabled)));assert.deepEqual(await page.$$eval(editor+' input',nodes=>nodes.map(node=>node.disabled)),[false,false,false]);
 if(mode==='draft-cancel'){await click(page,'Cancelar');await page.waitForFunction(selector=>!document.querySelector(selector)&&[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')||b.textContent==='Planificar fechas').every(b=>!b.disabled),{},editor);assert.equal(posts.length,0);checks.push('taskcreate-draft-locks-project-and-refresh-until-explicit-cancel');writeFileSync(path.join(evidence,'workspace-task-create-read-ledger-'+mode+'.json'),JSON.stringify({mode,scheduleReadLedger,posts:posts.length,applications,statusChecks,scheduleReadsAfterCommit},null,2));await context.close();return;}
 phase='CREATION_COMMAND_AND_RECOVERY';await click(page,'Crear tarea');await waitText(page,'La confirmación no llegó');assert.equal(posts.length,1);
 assert.ok(!(await text(page)).includes('Reintentar la misma creación'));
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')||b.textContent==='Planificar fechas').every(b=>b.disabled)));
 assert.deepEqual(await page.$$eval(editor+' input',nodes=>nodes.map(node=>node.disabled)),[true,true,true]);await click(page,'Comprobar tarea');
 if(mode==='uncertain'){await waitText(page,'Tarea creada y vinculada');assert.equal(posts.length,1);checks.push('taskcreate-uncertain-commit-recovers-without-second-post');}
 else {await waitText(page,'No se observa un recibo todavía');assert.equal(posts.length,1);assert.equal(await page.$eval(editor+' input',e=>e.value),'Tarea de ensayo recuperable');assert.ok(await page.$eval(editor+' input',e=>e.disabled));await click(page,'Reintentar la misma creación');await waitText(page,'Tarea creada y vinculada');assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);checks.push('taskcreate-'+mode+'-checked-then-exact-retry-once');}
 await page.waitForSelector('[data-task-id="new-task"]');await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});assert.equal(manualReadbackPending,false);assert.equal(scheduleReadLedger.filter(row=>row.kind==='CONFIRMED_CREATION_READBACK').length,1);assert.equal(statusChecks,1);assert.equal(applications,1);assert.equal(scheduleReadsAfterCommit,1);assert.equal(await page.$$eval('[data-task-id="new-task"]',nodes=>nodes.length),1);assert.ok((await text(page)).includes('Mostrando 2 de 2 tareas cargadas'));
 const createdProgress=await page.$eval('[data-task-id="new-task"]',element=>({text:element.innerText.replace(/\s+/g,' '),bars:[...element.querySelectorAll('[role="progressbar"]')].map(bar=>bar.getAttribute('aria-valuenow'))}));assert.ok(createdProgress.text.includes('Avance registrado: 0 %'));assert.deepEqual(createdProgress.bars,['0']);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));writeFileSync(path.join(evidence,'workspace-task-create-read-ledger-'+mode+'.json'),JSON.stringify({mode,scheduleReadLedger,posts:posts.length,applications,statusChecks,scheduleReadsAfterCommit},null,2));await context.close();
}
// The live progress reader verifies both the base access stamp and a closed
// review page. These synthetic responses retain the same independent reviewer
// and current proposal revisions; returning the base snapshot for every GET
// would correctly revoke the panel before any concurrent-receipt assertion.
const confirmedProgressAccessStamp='e'.repeat(64);
function confirmedProgressFieldRead(url,field,reads){
 assert.equal(url.pathname,'/api/identity/field-operations');assert.equal(url.searchParams.get('scope'),field.scope);assert.equal(url.searchParams.get('projectId'),field.projectId);
 const section=url.searchParams.get('reviewSection');
 if(section===null){assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);reads.push({kind:'BASE',scope:field.scope,projectId:field.projectId,reviewAccessStamp:field.reviewAccessStamp});return field;}
 assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','reviewAccessStamp','reviewFilter','reviewSection','scope']);assert.equal(section,'PROGRESS');assert.equal(url.searchParams.get('reviewFilter'),'ALL');assert.equal(url.searchParams.get('reviewAccessStamp'),field.reviewAccessStamp);
 assert.ok(field.proposals.length<=100);
 const page={scope:field.scope,projectId:field.projectId,reviewAccessStamp:field.reviewAccessStamp,reviewSection:section,reviewFilter:'ALL',afterReview:null,reviewId:null,records:field.proposals,total:field.proposals.length,nextCursor:null,canReview:field.canReview,canApproveProgress:field.canApproveProgress};
 reads.push({kind:'REVIEW',scope:page.scope,projectId:page.projectId,reviewAccessStamp:page.reviewAccessStamp,records:page.records.map(row=>({id:row.id,status:row.status,revision:row.revision}))});return page;
}
const waitCurrentProgress=page=>page.waitForFunction(()=>document.querySelector('section[aria-labelledby="field-title"] [data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});
async function confirmedProgressScenario(mode,width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode:'confirmed-progress-'+mode,width,message:error.message}));
 const planningMode=mode==='planning',beforeRevision='2026-10-02T09:00:00.000001',afterRevision='2026-10-02T09:00:00.000010',latestRevision='2026-10-02T09:00:00.000020';
 const original={...baseTask(),revision:beforeRevision},created={id:'new-task',title:'Tarea de ensayo concurrente',status:'BACKLOG',progress:0,startsOn:null,endsOn:null,revision:beforeRevision};
 const proposal={id:'proposal-a',taskId:original.id,workerId:'worker-a',summary:'Avance medido sintético',status:'PENDING',revision:planningMode?'2026-10-02T09:00:00.000011':'2026-10-02T09:00:00.000005',progress:50,quantity:null,baseline:null,unit:null,reason:'Medición sintética revisada.',evidenceIds:['evidence-a']};
 const field={scope,projectId:'p-a',reviewAccessStamp:confirmedProgressAccessStamp,projectRevision:beforeRevision,configurationRevision:null,canConfigure:true,canReview:true,canApproveProgress:true,selfWorkers:[],workers:[{id:'worker-a',name:'Participante sintético'}],sectors:[],attendance:[],incidents:[],materialRequests:[],truncated:false,proposals:planningMode?[]:[proposal],evidence:[{id:'evidence-a',taskId:original.id,workerId:'worker-a',title:'Evidencia sintética aprobada',caption:'Fuente sintética de la medición.',status:'APPROVED',revision:beforeRevision,media:{kind:'image',contentType:'image/png',bytes:64,sha256:'b'.repeat(64)},processing:{status:'NOT_REQUESTED'}}]};
 const padding=Array.from({length:98},(_,index)=>({...original,id:'task-b-'+String(index+1).padStart(3,'0'),title:'Tarea de paginación '+(index+1)})),tail={...created,id:'z-tail-task',title:'Última tarea autorizada'};
 const posts=[],projectReads=[],fieldReads=[];let creation=null,heldReadback=null,heldDecision=null,heldPlanning=null,readbackCount=0,preparationReads=0,canonicalTask=original,phase='INITIAL',manualReadbackPending=false,manualCursorPending=false;
 const markPhase=async value=>{phase=value;await page.evaluate(next=>{window.__confirmedProgressPhase=next;},value);};
 const ordered=rows=>[...rows].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),currentTasks=()=>planningMode?[canonicalTask]:ordered([canonicalTask,...padding,tail,...(creation?[created]:[])]);
 const taskPage=(all,cursor=null)=>{const remaining=cursor?all.filter(task=>task.id>cursor):all,rows=remaining.slice(0,100);return {scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Director de obra',canPlanSchedule:true,tasks:rows,totalTasks:all.length,nextCursor:remaining.length>100?rows.at(-1).id:null};};
 const noteRead=(url,kind,body)=>{projectReads.push({phase,kind,query:url.search,scope:url.searchParams.get('scope'),projectId:url.searchParams.get('projectId'),afterTask:url.searchParams.get('afterTask'),rows:body?.tasks.length??null,total:body?.totalTasks??null,nextCursor:body?.nextCursor??null,taskRevision:body?.tasks.find(task=>task.id===original.id)?.revision??null});};
 const assertProjectReads=()=>{assert.equal(projectReads.filter(row=>row.kind==='MANUAL_READBACK').length,planningMode?0:1);assert.equal(projectReads.filter(row=>row.kind==='EXPLICIT_CURSOR').length,planningMode?0:1);let previous=null;for(const row of projectReads){assert.equal(row.scope,scope);assert.equal(row.projectId,'p-a');if(row.kind==='RETAINED_CURSOR'){assert.ok(previous&&['BASE','RETAINED_CURSOR'].includes(previous.kind));assert.equal(row.afterTask,previous.nextCursor);}previous=row;}assert.ok(projectReads.every(row=>row.afterTask===null||row.afterTask===ordered([original,created,...padding]).at(-1).id));};
 const assertProgressTrace=async()=>{const trace=await page.evaluate(()=>window.__confirmedProgressTrace);assert.ok(trace.length>0);if(planningMode){assert.ok(trace.filter(row=>row.phase==='PLANNING_REPLY_RELEASED').every(row=>row.progress===50&&JSON.stringify(row.dates)===JSON.stringify(['2026-10-07','2026-10-15'])),'A late planning receipt cannot transiently roll back current progress or dates');}else{const expected=mode==='readback'?50:70,phases=mode==='readback'?['MANUAL_READBACK_RELEASED','EXPLICIT_CURSOR']:['LATE_DECISION_CALLBACK','EXPLICIT_CURSOR'];assert.ok(trace.filter(row=>phases.includes(row.phase)).every(row=>row.progress===expected&&JSON.stringify(row.dates)===JSON.stringify([original.startsOn,original.endsOn])),'Late responses cannot transiently overwrite the current task');if(mode==='callback')assert.ok(trace.some(row=>row.phase==='MANUAL_READBACK_RELEASED'&&row.progress===70));}return trace;};
 const waitCurrentSchedule=()=>page.waitForFunction(()=>{const visible=[...document.querySelectorAll('[data-worksite-live-refresh]')].filter(node=>node.getClientRects().length);return visible.length===1&&visible[0].dataset.worksiteLiveRefresh==='CURRENT';},{timeout:15000});
 let readbackStarted,decisionStarted,planningStarted;const readbackReady=new Promise(resolve=>{readbackStarted=resolve;}),decisionReady=new Promise(resolve=>{decisionStarted=resolve;}),planningReady=new Promise(resolve=>{planningStarted=resolve;});
 const respond=(request,body)=>request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(url.pathname==='/api/identity/project-preparation'){
    assert.equal(request.method(),'GET');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(++preparationReads,1);
    return respond(request,projectPreparationSnapshot({scope,projectId:'p-a',canManage:true,revision:0,detailsDigest:'b'.repeat(64),name:'Obra de prueba A',clientName:'',address:'',teams:[],slots:[],startStatus:'TO_CONFIRM',declarationOnly:true},{scope,projectId:'p-a'}));
   }
   if(!['/api/identity/workspace','/api/identity/task-creation','/api/identity/field-operations'].includes(url.pathname))return request.continue();
   assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   if(url.pathname==='/api/identity/workspace'){
    if(request.method()==='POST'){
     assert.ok(planningMode);const input=JSON.parse(request.postData());posts.push({path:url.pathname,input});assert.equal(input.scope,scope);assert.equal(input.projectId,'p-a');assert.equal(input.taskId,original.id);assert.equal(input.expectedRevision,beforeRevision);assert.equal(input.startsOn,'2026-10-07');assert.equal(input.endsOn,'2026-10-15');
     const task={...original,startsOn:input.startsOn,endsOn:input.endsOn,revision:afterRevision};canonicalTask=task;
     heldPlanning={request,outcome:{scope,saved:true,replayed:false,task,receipt:{id:'workspace_schedule_'+ 'd'.repeat(64),taskId:original.id,recordedAt:afterRevision,before:{startsOn:original.startsOn,endsOn:original.endsOn},after:{startsOn:task.startsOn,endsOn:task.endsOn}}}};
     // The worker creates this proposal after the planning transaction committed,
     // using the current r1 task even though the director's r1 reply is retained.
     field.proposals=[{...proposal,taskRevision:afterRevision}];planningStarted();return;
    }
    if(!url.search)return respond(request,{scope,organizationName:'Empresa de ensayo concurrente',role:'DIRECTOR',roleLabel:'Director de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false});
    assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');
    const cursor=url.searchParams.get('afterTask');assert.deepEqual([...url.searchParams.keys()].sort(),cursor?['afterTask','projectId','scope']:['projectId','scope']);
    if(creation&&!cursor&&manualReadbackPending){manualReadbackPending=false;heldReadback=request;readbackCount++;noteRead(url,'MANUAL_READBACK',null);readbackStarted();return;}
    const body=taskPage(currentTasks(),cursor),kind=cursor?(manualCursorPending?'EXPLICIT_CURSOR':'RETAINED_CURSOR'):'BASE';if(kind==='EXPLICIT_CURSOR')manualCursorPending=false;noteRead(url,kind,body);return respond(request,body);
   }
   if(request.method()==='GET')return respond(request,confirmedProgressFieldRead(url,field,fieldReads));
   const input=JSON.parse(request.postData());posts.push({path:url.pathname,input});assert.equal(input.scope,scope);assert.equal(input.projectId,'p-a');
   if(url.pathname==='/api/identity/task-creation'){
    assert.equal(input.title,created.title);creation={scope,created:true,replayed:false,receiptId:'workspace_new_task_'+input.operationId,task:created};manualReadbackPending=true;return respond(request,creation);
   }
   assert.equal(input.action,'DECIDE_PROGRESS');assert.equal(input.payload.proposalId,proposal.id);assert.equal(input.payload.revision,proposal.revision);assert.equal(input.payload.decision,'APPROVE');
   field.proposals=[{...proposal,status:'APPLIED',revision:planningMode?latestRevision:afterRevision}];
   const task={...(planningMode?heldPlanning.outcome.task:original),status:'IN_PROGRESS',progress:50,revision:planningMode?latestRevision:afterRevision};canonicalTask=task;
   const outcome={scope,saved:true,replayed:false,receiptId:'field_'+ 'c'.repeat(64),kind:'PROGRESS_DECISION',proposal:field.proposals[0],task};
   heldDecision={request,outcome};decisionStarted();if(mode!=='callback')return respond(request,outcome);
  }catch(error){pageErrors.push({mode:'confirmed-progress-'+mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo concurrente');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');
  await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="project-preparation-title"]')?.getAttribute('aria-busy')==='false',{timeout:15000});assert.equal(preparationReads,1);
  await showWorkspaceSection(page,'schedule-title');await waitCurrentSchedule();await page.evaluate(()=>{window.__confirmedProgressTrace=[];window.__confirmedProgressPhase='INITIAL';window.__confirmedProgressObserver=new MutationObserver(()=>{const row=document.querySelector('[data-task-id="task-a"]');if(row)window.__confirmedProgressTrace.push({phase:window.__confirmedProgressPhase,progress:Number(row.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')),dates:[...row.querySelectorAll('time')].map(time=>time.dateTime)});});window.__confirmedProgressObserver.observe(document.querySelector('section[aria-labelledby="schedule-title"]'),{subtree:true,childList:true,attributes:true});});
  if(planningMode){await markPhase('PLANNING_PENDING');await showWorkspaceSection(page,'schedule-title');await fill(page);await click(page,'Confirmar planificación');await planningReady;}
  await showWorkspaceSection(page,'field-title');await click(page,'Abrir operaciones');await page.waitForSelector('nav[aria-label="Operaciones de campo"]');await click(page,'Avance');await waitText(page,'Decidir propuesta');if(!planningMode){await waitCurrentProgress(page);assert.ok(fieldReads.some(row=>row.kind==='REVIEW'));}
  if(!planningMode){await markPhase('CREATION_READBACK_PENDING');await showWorkspaceSection(page,'schedule-title');await click(page,'Nueva tarea');await page.type('section[aria-label="Crear tarea de la obra"] form input:not([type="date"])',created.title);await click(page,'Crear tarea');await readbackReady;}
  await markPhase('PROGRESS_DECISION');await showWorkspaceSection(page,'field-title');await click(page,'Decidir propuesta');await page.type('section[aria-labelledby="field-title"] form textarea','Aprobación sintética independiente.');await click(page,'Guardar con recibo');await decisionReady;
  if(planningMode){
   await page.waitForFunction(()=>document.querySelector('[data-task-id="task-a"] [role="progressbar"]').getAttribute('aria-valuenow')==='50');
   await markPhase('PLANNING_REPLY_RELEASED');await respond(heldPlanning.request,heldPlanning.outcome);await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cambio confirmado');await waitCurrentSchedule();
   assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),50);
   assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),['2026-10-07','2026-10-15']);
   assert.equal(posts.length,2);assert.equal(readbackCount,0);assert.ok((await text(page)).includes('1 de 1 tareas cargadas'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await showWorkspaceSection(page,'schedule-title');await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,`workspace-confirmed-progress-planning-${width}.png`)});
   assertProjectReads();await assertProgressTrace();checks.push('schedule-delayed-planning-reply-keeps-current-dates-and-progress-'+width);return;
  }
  const readbackTask=mode==='readback'?original:{...original,revision:latestRevision,progress:70};
  if(mode==='readback')await page.waitForFunction(()=>document.querySelector('[data-task-id="task-a"] [role="progressbar"]').getAttribute('aria-valuenow')==='50');
  canonicalTask=mode==='callback'?readbackTask:heldDecision.outcome.task;await markPhase('MANUAL_READBACK_RELEASED');
  // This one retained readback carries its captured task revision. Every later
  // ordinary GET reflects canonicalTask, never this intentionally old reply.
  const capturedPage=taskPage(ordered([readbackTask,created,...padding,tail]));assert.equal(capturedPage.tasks.length,100);assert.equal(capturedPage.nextCursor,capturedPage.tasks.at(-1).id);Object.assign(projectReads.find(row=>row.kind==='MANUAL_READBACK'),{rows:capturedPage.tasks.length,total:capturedPage.totalTasks,nextCursor:capturedPage.nextCursor,taskRevision:readbackTask.revision});await respond(heldReadback,capturedPage);
  await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cronograma actualizado desde los registros de la obra.');
  if(mode==='callback'){await markPhase('LATE_DECISION_CALLBACK');await respond(heldDecision.request,heldDecision.outcome);await showWorkspaceSection(page,'field-title');await waitText(page,'Decisión guardada.');await showWorkspaceSection(page,'schedule-title');}
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Cargar más tareas'&&!button.disabled));
  const expected=mode==='readback'?50:70;
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),expected);
  assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),[original.startsOn,original.endsOn]);
  await waitCurrentSchedule();assert.ok((await text(page)).includes('100 de 101 tareas cargadas'));assert.equal(readbackCount,1);assert.equal(posts.length,2);assert.equal(await page.$('[data-task-id="z-tail-task"]'),null);
  await markPhase('EXPLICIT_CURSOR');manualCursorPending=true;await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await page.waitForSelector('[data-task-id="z-tail-task"]');await waitCurrentSchedule();assert.ok((await text(page)).includes('101 de 101 tareas cargadas'));assert.equal(manualCursorPending,false);assertProjectReads();await assertProgressTrace();
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),expected);assert.equal(posts.length,2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await showWorkspaceSection(page,'schedule-title');await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,`workspace-confirmed-progress-${mode}-${width}.png`)});
  checks.push((mode==='readback'?'schedule-delayed-readback-keeps-confirmed-progress-':'schedule-delayed-decision-callback-keeps-newer-get-')+width);
 }catch(error){await page.screenshot({path:path.join(evidence,`workspace-confirmed-progress-${mode}-failure-${width}.png`),fullPage:false}).catch(()=>{});throw error;}
  finally{const trace=await page.evaluate(()=>window.__confirmedProgressTrace||[]).catch(()=>[]);await page.evaluate(()=>window.__confirmedProgressObserver?.disconnect()).catch(()=>{});writeFileSync(path.join(evidence,`workspace-confirmed-progress-${mode}-${width}-request-ledger.json`),JSON.stringify({mode,width,phase,projectReads,fieldReads,posts,readbackCount,trace},null,2)+'\n');for(const request of [heldReadback,heldDecision?.request,heldPlanning?.request])if(request&&!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});await context.close();}
}
async function unloadedConfirmedProgressScenario(width,decision){
 const mode='confirmed-progress-unloaded-'+decision.toLowerCase(),context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const beforeRevision='2026-10-02T09:00:00.000001',afterRevision='2026-10-02T09:00:00.000010',currentRevision='2026-10-02T09:00:00.000020';
 const original={...baseTask(),revision:beforeRevision},outside={id:'task-outside',title:'Demolición de portería',status:'BACKLOG',progress:0,startsOn:'2026-10-06',endsOn:'2026-10-12',revision:beforeRevision};
 const padding=Array.from({length:99},(_,index)=>({...original,id:'task-b-'+String(index+1).padStart(3,'0'),title:'Tarea cargada de paginación '+(index+1)})),firstPage=[original,...padding],cursor=firstPage.at(-1).id;
 const proposal={id:'proposal-outside',taskId:outside.id,workerId:'worker-a',summary:'Medición de la tarea de otra página',status:'PENDING',revision:'2026-10-02T09:00:00.000005',progress:25,quantity:null,baseline:null,unit:null,reason:'Medición sintética de otro participante.',evidenceIds:['evidence-outside']};
 const field={scope,projectId:'p-a',reviewAccessStamp:confirmedProgressAccessStamp,projectRevision:beforeRevision,configurationRevision:null,canConfigure:true,canReview:true,canApproveProgress:true,selfWorkers:[],workers:[{id:'worker-a',name:'Participante sintético'}],sectors:[],attendance:[],incidents:[],materialRequests:[],truncated:false,proposals:[proposal],evidence:[{id:'evidence-outside',taskId:outside.id,workerId:'worker-a',title:'Evidencia sintética aprobada',caption:'Fuente revisada de otro participante.',status:'APPROVED',revision:beforeRevision,media:{kind:'image',contentType:'image/png',bytes:64,sha256:'b'.repeat(64)},processing:{status:'NOT_REQUESTED'}}]};
 const posts=[],scheduleReads=[],receiptQueries=[],projectReadLedger=[],fieldReads=[];let recorded=null,currentTask=null,preparationReads=0,phase='INITIAL',manualCursorPending=false;
 const markPhase=async value=>{phase=value;await page.evaluate(next=>{window.__unloadedReceiptPhase=next;},value);};
 const taskPage=(tasks,nextCursor)=>({scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Director de obra',canPlanSchedule:true,tasks,totalTasks:101,nextCursor});
 const waitCurrentSchedule=()=>page.waitForFunction(()=>{const visible=[...document.querySelectorAll('[data-worksite-live-refresh]')].filter(node=>node.getClientRects().length);return visible.length===1&&visible[0].dataset.worksiteLiveRefresh==='CURRENT';},{timeout:15000});
 const respond=(request,body,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(url.pathname==='/api/identity/project-preparation'){
    assert.equal(request.method(),'GET');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(++preparationReads,1);
    return respond(request,projectPreparationSnapshot({scope,projectId:'p-a',canManage:true,revision:0,detailsDigest:'b'.repeat(64),name:'Obra de prueba A',clientName:'',address:'',teams:[],slots:[],startStatus:'TO_CONFIRM',declarationOnly:true},{scope,projectId:'p-a'}));
   }
   if(!['/api/identity/workspace','/api/identity/task-creation','/api/identity/field-operations'].includes(url.pathname))return request.continue();
   assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   if(url.pathname==='/api/identity/workspace'){
    assert.equal(request.method(),'GET','A progress decision does not replan or create a task');
    if(!url.search)return respond(request,{scope,organizationName:'Empresa de ensayo paginada',role:'DIRECTOR',roleLabel:'Director de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false});
    assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');scheduleReads.push([...url.searchParams]);
    const after=url.searchParams.get('afterTask');assert.deepEqual([...url.searchParams.keys()].sort(),after?['afterTask','projectId','scope']:['projectId','scope']);
    if(after){assert.equal(decision,'APPROVE');assert.equal(url.searchParams.get('afterTask'),cursor);assert.ok(currentTask);const kind=manualCursorPending?'EXPLICIT_CURSOR':'RETAINED_CURSOR';if(manualCursorPending)manualCursorPending=false;projectReadLedger.push({phase,kind,afterTask:after,scope,projectId:'p-a',rows:1,nextCursor:null});return respond(request,taskPage([currentTask],null));}
    projectReadLedger.push({phase,kind:'BASE',afterTask:null,scope,projectId:'p-a',rows:firstPage.length,nextCursor:cursor});return respond(request,taskPage(firstPage,cursor));
   }
   assert.equal(url.pathname,'/api/identity/field-operations','No task-creation command may be issued');
   if(request.method()==='GET'){
    assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');
    if(url.searchParams.has('operationId')){assert.deepEqual([...url.searchParams.keys()].sort(),['operationId','projectId','scope']);receiptQueries.push(url.searchParams.get('operationId'));assert.ok(recorded);assert.equal(receiptQueries.at(-1),posts[0].operationId);assert.equal(recorded.proposal.progress,25);assert.equal(recorded.task.progress,25);assert.equal(currentTask.progress,50);return respond(request,{state:'RECORDED',...recorded,replayed:true,task:currentTask,decisionTaskSnapshot:recorded.task});}
    return respond(request,confirmedProgressFieldRead(url,field,fieldReads));
   }
   assert.equal(request.method(),'POST');assert.equal(url.search,'');const input=JSON.parse(request.postData());posts.push(input);assert.equal(posts.length,1);assert.equal(input.scope,scope);assert.equal(input.projectId,'p-a');assert.equal(input.action,'DECIDE_PROGRESS');assert.equal(input.payload.proposalId,proposal.id);assert.equal(input.payload.revision,proposal.revision);assert.equal(input.payload.decision,decision);assert.equal(input.payload.reason,'Decisión sintética de otra cuenta responsable.');assert.match(input.operationId,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
   field.proposals=[{...proposal,status:decision==='APPROVE'?'APPLIED':'REJECTED',revision:afterRevision}];
   const task=decision==='APPROVE'?{...outside,status:'IN_PROGRESS',progress:25,revision:afterRevision}:outside;
   // Rejection deliberately returns the unchanged task too: the UI must not infer approval from its presence.
   recorded={scope,saved:true,replayed:false,receiptId:'field_'+ 'c'.repeat(64),kind:'PROGRESS_DECISION',proposal:field.proposals[0],task};
   // An independent later decision and planning are already canonical when the old receipt is read.
   // recoveredOutcome returns the current task and keeps the original receipt snapshot separately.
   currentTask=decision==='APPROVE'?{...outside,status:'BLOCKED',progress:50,revision:currentRevision,startsOn:'2026-10-09',endsOn:'2026-10-16'}:outside;
   return decision==='APPROVE'?respond(request,{code:'FIELD_OPERATION_UNCONFIRMED'},503):respond(request,recorded);
  }catch(error){pageErrors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo paginada');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');
  await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="project-preparation-title"]')?.getAttribute('aria-busy')==='false',{timeout:15000});assert.equal(preparationReads,1);
  assert.equal((await page.$$('[data-task-id="task-outside"]')).length,0);assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),original.progress);
  await showWorkspaceSection(page,'schedule-title');await waitCurrentSchedule();
  await page.evaluate(()=>{window.__unloadedReceiptTrace=[];window.__unloadedReceiptPhase='INITIAL';window.__unloadedReceiptObserver=new MutationObserver(()=>{const receipt=document.querySelector('[data-confirmed-progress="task-outside"]'),task=document.querySelector('[data-task-id="task-outside"]');window.__unloadedReceiptTrace.push({phase:window.__unloadedReceiptPhase,receipt:receipt?.textContent||null,loadedProgress:task?Number(task.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')):null});});window.__unloadedReceiptObserver.observe(document.querySelector('main'),{subtree:true,childList:true,attributes:true});});
  await showWorkspaceSection(page,'field-title');await click(page,'Abrir operaciones');await page.waitForSelector('nav[aria-label="Operaciones de campo"]');await click(page,'Avance');await waitText(page,'Decidir propuesta');await waitCurrentProgress(page);assert.ok(fieldReads.some(row=>row.kind==='REVIEW'));assert.equal(posts.length,0);assert.ok(projectReadLedger.length>0,'The current schedule must have accepted a canonical base page before any decision');assert.ok(projectReadLedger.every(row=>row.phase==='INITIAL'&&row.kind==='BASE'&&row.afterTask===null&&row.scope===scope&&row.projectId==='p-a'&&row.rows===100&&row.nextCursor===cursor),'Before any decision only current-context canonical base reads are allowed; no cursor GET is initiated');
  await showWorkspaceSection(page,'field-title');await click(page,'Decidir propuesta');await page.waitForSelector('section[aria-labelledby="field-title"] form');await page.select('section[aria-labelledby="field-title"] form select',decision);await page.type('section[aria-labelledby="field-title"] form textarea','Decisión sintética de otra cuenta responsable.');assert.equal(posts.length,0);await markPhase('DECISION');await click(page,'Guardar con recibo');
  if(decision==='APPROVE'){await waitText(page,'El resultado quedó sin confirmar.');assert.equal((await page.$$('[data-confirmed-progress]')).length,0);assert.equal(posts.length,1);await markPhase('RECEIPT_RECOVERY');await click(page,'Comprobar guardado');await waitText(page,'Avance aprobado con recibo.');assert.deepEqual(receiptQueries,[posts[0].operationId]);}
  else await waitText(page,'La propuesta fue rechazada.');
  await markPhase('BEFORE_EXPLICIT_CURSOR');await showWorkspaceSection(page,'schedule-title');await waitCurrentSchedule();assert.equal(posts.length,1);assert.equal(projectReadLedger.filter(row=>row.afterTask!==null).length,0);assert.equal((await page.$$('[data-task-id="task-outside"]')).length,0);assert.ok((await text(page)).includes('100 de 101 tareas cargadas'));
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),original.progress);assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),[original.startsOn,original.endsOn]);
  await showWorkspaceSection(page,'field-title');assert.equal(await page.$eval('section[aria-labelledby="field-title"] details code',element=>element.textContent),recorded.receiptId);
  if(decision==='APPROVE'){
   const resultText=await page.$eval('[data-confirmed-progress="task-outside"]',element=>element.textContent);assert.ok(resultText.includes('Demolición de portería')&&resultText.includes('25% de avance aprobado en este recibo')&&resultText.includes('Falta cargar esta tarea'));assert.ok(!resultText.includes('50%'));assert.equal(recorded.proposal.status,'APPLIED');assert.equal(recorded.proposal.progress,25);
   await showWorkspaceSection(page,'field-title');await (await page.$('section[aria-labelledby="field-title"]')).screenshot({path:path.join(evidence,'workspace-unloaded-progress-receipt-'+width+'.png')});
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Ver en el cronograma'&&!button.disabled)&&document.getElementById('schedule-load-more')?.disabled===false);assert.ok(await page.$eval('[data-confirmed-progress="task-outside"] button',element=>element.getBoundingClientRect().height>=44));await page.focus('[data-confirmed-progress="task-outside"] button');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.id==='schedule-load-more');assert.equal(await page.evaluate(()=>document.activeElement?.id),'schedule-load-more');assert.equal(projectReadLedger.filter(row=>row.afterTask!==null).length,0);
   await markPhase('EXPLICIT_CURSOR');manualCursorPending=true;await page.keyboard.press('Enter');await page.waitForSelector('[data-task-id="task-outside"]');assert.equal(manualCursorPending,false);await waitCurrentSchedule();assert.equal(projectReadLedger.filter(row=>row.kind==='EXPLICIT_CURSOR').length,1);assert.ok((await text(page)).includes('101 de 101 tareas cargadas'));await markPhase('CURRENT_LOADED');
   assert.equal(await page.$eval('[data-task-id="task-outside"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),50);assert.deepEqual(await page.$$eval('[data-task-id="task-outside"] time',elements=>elements.map(element=>element.dateTime)),[currentTask.startsOn,currentTask.endsOn]);assert.equal(await page.$eval('[data-task-id="task-outside"] [data-status]',element=>element.dataset.status),'BLOCKED');assert.deepEqual([recorded.task.startsOn,recorded.task.endsOn],[outside.startsOn,outside.endsOn]);assert.notDeepEqual([currentTask.startsOn,currentTask.endsOn],[recorded.task.startsOn,recorded.task.endsOn]);assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),[original.startsOn,original.endsOn]);assert.ok((await page.$eval('[data-confirmed-progress="task-outside"]',element=>element.textContent)).includes('25% de avance aprobado en este recibo'));assert.ok(!(await page.$eval('[data-confirmed-progress="task-outside"]',element=>element.textContent)).includes('50%'));
   await showWorkspaceSection(page,'field-title');await waitText(page,'Esta tarea está cargada en el cronograma.');await page.focus('[data-confirmed-progress="task-outside"] button');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.dataset.taskId==='task-outside');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.taskId),'task-outside');assert.equal(projectReadLedger.filter(row=>row.kind==='EXPLICIT_CURSOR').length,1);assert.equal(posts.length,1);
  }else{assert.equal((await page.$$('[data-confirmed-progress]')).length,0);assert.equal(await page.$$eval('button',buttons=>buttons.filter(button=>button.textContent==='Ver en el cronograma').length),0);const fieldText=await page.$eval('section[aria-labelledby="field-title"]',element=>element.innerText);assert.ok(!fieldText.includes('avance aprobado en este recibo')&&!fieldText.includes('Avance aprobado con recibo.'));assert.deepEqual(receiptQueries,[]);}
  const trace=await page.evaluate(()=>window.__unloadedReceiptTrace);assert.ok(trace.every(row=>!row.receipt||!row.receipt.includes('50%')),'Current50 must never replace historical25 in the receipt');
  if(decision==='APPROVE'){assert.ok(trace.some(row=>row.receipt?.includes('25% de avance aprobado en este recibo')));assert.ok(trace.every(row=>row.loadedProgress===null||['EXPLICIT_CURSOR','CURRENT_LOADED'].includes(row.phase)));}else assert.ok(trace.every(row=>row.receipt===null));
  let previous=null;for(const row of projectReadLedger){if(row.kind==='RETAINED_CURSOR'){assert.ok(previous&&previous.kind==='BASE');assert.equal(row.afterTask,previous.nextCursor);}previous=row;}assert.ok(projectReadLedger.every(row=>row.scope===scope&&row.projectId==='p-a'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await showWorkspaceSection(page,'schedule-title');await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,mode+'-'+width+'.png')});
  checks.push((decision==='APPROVE'?'schedule-unloaded-progress-recovers-same-uuid-historical-25-current-50-and-loads-explicit-cursor-':'schedule-rejected-progress-with-task-does-not-claim-approval-')+width);
 }catch(error){await page.screenshot({path:path.join(evidence,mode+'-failure-'+width+'.png'),fullPage:false}).catch(()=>{});throw error;}
 finally{const trace=await page.evaluate(()=>window.__unloadedReceiptTrace||[]).catch(()=>[]);writeFileSync(path.join(evidence,`workspace-unloaded-progress-${decision}-${width}-request-ledger.json`),JSON.stringify({width,decision,phase,projectReadLedger,fieldReads,posts,receiptQueries,trace},null,2)+'\n');await page.evaluate(()=>window.__unloadedReceiptObserver?.disconnect()).catch(()=>{});await context.close();}
}
async function receiptSnapshotCoverageScenario(width,mode){
 const cases=mode==='invalid-snapshot'?['explicit-null','malformed-progress']:['historical-snapshot'];
 for(const kind of cases)await loadedReceiptSnapshotScenario(width,mode,kind);
 checks.push((mode==='invalid-snapshot'?'schedule-explicit-null-and-malformed-receipt-never-fall-back-to-valid-current-task-':'schedule-loaded-recovered-receipt-25-keeps-current-50-blocker-dates-without-snapshot-write-')+width);
}
async function loadedReceiptSnapshotScenario(width,mode,snapshotCase){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode:'confirmed-progress-snapshots-'+mode,width,message:error.message}));
 const beforeRevision='2026-10-02T09:00:00.000001',decisionRevision='2026-10-02T09:00:00.000010',currentRevision='2026-10-02T09:00:00.000020';
 const original={...baseTask(),status:'BACKLOG',progress:0,revision:beforeRevision},untouched={...baseTask(),id:'task-untouched',title:'Tarea sin decisión nueva',revision:beforeRevision};
 const historicalTask={...original,status:'IN_PROGRESS',progress:25,revision:decisionRevision},currentTask={...original,status:'BLOCKED',progress:50,startsOn:'2026-10-09',endsOn:'2026-10-16',revision:currentRevision};
 const cases=[snapshotCase];
 const proposals=cases.map((kind,index)=>({id:'proposal-snapshot-'+index,taskId:original.id,workerId:'worker-a',summary:'Medición sintética '+kind,status:'PENDING',revision:'2026-10-02T09:00:00.00000'+(index+5),progress:25,quantity:null,baseline:null,unit:null,reason:'Fuente sintética revisada por otra cuenta.',evidenceIds:['evidence-a']}));
 const field={scope,projectId:'p-a',reviewAccessStamp:confirmedProgressAccessStamp,projectRevision:beforeRevision,configurationRevision:null,canConfigure:true,canReview:true,canApproveProgress:true,selfWorkers:[],workers:[{id:'worker-a',name:'Participante sintético'}],sectors:[],attendance:[],incidents:[],materialRequests:[],truncated:false,proposals,evidence:[{id:'evidence-a',taskId:original.id,workerId:'worker-a',title:'Evidencia sintética aprobada',caption:'Evidencia para contrastar el recibo histórico.',status:'APPROVED',revision:beforeRevision,media:{kind:'image',contentType:'image/png',bytes:64,sha256:'b'.repeat(64)},processing:{status:'NOT_REQUESTED'}}]};
 const posts=[],receiptQueries=[],scheduleReads=[],projectReadLedger=[],fieldReads=[];let recorded=null,heldRefresh=null,holdNextRefresh=false,preparationReads=0,phase='INITIAL',readsBeforeRecovery=null;
 const markPhase=async value=>{phase=value;await page.evaluate(next=>{window.__loadedReceiptPhase=next;},value);};
 const waitCurrentSchedule=()=>page.waitForFunction(()=>{const visible=[...document.querySelectorAll('[data-worksite-live-refresh]')].filter(node=>node.getClientRects().length);return visible.length===1&&visible[0].dataset.worksiteLiveRefresh==='CURRENT';},{timeout:15000});
 const respond=(request,body,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(url.pathname==='/api/identity/project-preparation'){
    assert.equal(request.method(),'GET');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(++preparationReads,1);
    return respond(request,projectPreparationSnapshot({scope,projectId:'p-a',canManage:true,revision:0,detailsDigest:'b'.repeat(64),name:'Obra de prueba A',clientName:'',address:'',teams:[],slots:[],startStatus:'TO_CONFIRM',declarationOnly:true},{scope,projectId:'p-a'}));
   }
   if(!['/api/identity/workspace','/api/identity/task-creation','/api/identity/field-operations'].includes(url.pathname))return request.continue();
   assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   if(url.pathname==='/api/identity/workspace'){
    assert.equal(request.method(),'GET','Recovery must not write dates or create schedule rows');
    if(!url.search)return respond(request,{scope,organizationName:'Empresa de ensayo de snapshots',role:'DIRECTOR',roleLabel:'Director de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false});
    assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');scheduleReads.push([...url.searchParams]);projectReadLedger.push({phase,kind:'BASE',scope,projectId:'p-a',afterTask:null,taskRevision:recorded?currentTask.revision:original.revision});
    // A later native read reports current50. Only decisionTaskSnapshot below
    // carries historical25; explicit null and malformed progress stay adversarial.
    return respond(request,{scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Director de obra',canPlanSchedule:true,tasks:[recorded?currentTask:original,untouched],totalTasks:2,nextCursor:null});
   }
   assert.equal(url.pathname,'/api/identity/field-operations','No task creation command may be issued');
   if(request.method()==='GET'){
    assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');
    if(url.searchParams.has('operationId')){
     assert.deepEqual([...url.searchParams.keys()].sort(),['operationId','projectId','scope']);
     assert.ok(recorded);const operationId=url.searchParams.get('operationId');assert.equal(operationId,recorded.input.operationId);receiptQueries.push(operationId);
     const snapshot=recorded.kind==='explicit-null'?null:recorded.kind==='malformed-progress'?{...historicalTask,progress:'25'}:historicalTask;
     const recovery={state:'RECORDED',...recorded.outcome,replayed:true,task:currentTask,decisionTaskSnapshot:snapshot};assert.ok(Object.hasOwn(recovery,'decisionTaskSnapshot'));assert.equal(recovery.task.progress,50);assert.equal(recovery.task.status,'BLOCKED');holdNextRefresh=true;return respond(request,recovery);
    }
    const response=confirmedProgressFieldRead(url,field,fieldReads);
    if(holdNextRefresh&&!url.searchParams.has('reviewSection')){assert.equal(heldRefresh,null);holdNextRefresh=false;heldRefresh=request;return;}
    return respond(request,response);
   }
   assert.equal(request.method(),'POST');assert.equal(url.search,'');const input=JSON.parse(request.postData()),index=posts.length,proposal=proposals[index];assert.ok(proposal);posts.push(input);
   assert.equal(input.scope,scope);assert.equal(input.projectId,'p-a');assert.equal(input.action,'DECIDE_PROGRESS');assert.equal(input.payload.proposalId,proposal.id);assert.equal(input.payload.revision,proposal.revision);assert.equal(input.payload.decision,'APPROVE');assert.equal(input.payload.reason,'Decisión sintética '+cases[index]+'.');assert.match(input.operationId,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
   field.proposals=field.proposals.map(row=>row.id===proposal.id?{...row,status:'APPLIED',revision:decisionRevision}:row);
   const outcome={scope,saved:true,replayed:false,receiptId:'field_'+(index===0?'c':'d').repeat(64),kind:'PROGRESS_DECISION',proposal:field.proposals.find(row=>row.id===proposal.id),task:historicalTask};recorded={input,kind:cases[index],outcome};
   return respond(request,{code:'FIELD_OPERATION_UNCONFIRMED'},503);
  }catch(error){pageErrors.push({mode:'confirmed-progress-snapshots-'+mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 const assertCurrentSchedule=async({pendingRefresh=false}={})=>{
  await markPhase('CURRENT_SCHEDULE');await showWorkspaceSection(page,'schedule-title');
  if(pendingRefresh){
   // The held field GET deliberately keeps the operation pending. Verify the
   // receipt callback while native schedule reads remain paused; waiting for
   // CURRENT here would consume the request timeout and release that lock.
   assert.ok(heldRefresh);await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='PAUSED',{timeout:15000});assert.equal(scheduleReads.length,readsBeforeRecovery,'A held field refresh must not start a native schedule read');
  }else await waitCurrentSchedule();
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),50);assert.equal(await page.$eval('[data-task-id="task-a"] [data-status]',element=>element.dataset.status),'BLOCKED');assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),[currentTask.startsOn,currentTask.endsOn]);
  assert.equal(await page.$eval('[data-task-id="task-untouched"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),untouched.progress);assert.deepEqual(await page.$$eval('[data-task-id="task-untouched"] time',elements=>elements.map(element=>element.dateTime)),[untouched.startsOn,untouched.endsOn]);assert.equal(await page.$$eval('[data-task-id]',elements=>elements.length),2);
  const gantt=await page.$eval('[data-gantt-task-id="task-a"]',(element,dates)=>{const format=new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});return {text:element.innerText,planned:element.querySelector('[data-gantt-planned]')?.getAttribute('aria-label'),dates:dates.map(value=>format.format(new Date(value+'T00:00:00Z')))};},[currentTask.startsOn,currentTask.endsOn]);
  assert.ok(gantt.text.includes('50 % registrado')&&gantt.text.includes('Bloqueada'));assert.ok(gantt.dates.every(value=>gantt.planned?.includes(value)));assert.ok(projectReadLedger.every(row=>row.kind==='BASE'&&row.afterTask===null));assert.ok((await text(page)).includes('2 de 2 tareas cargadas'));
  const trace=await page.evaluate(()=>window.__loadedReceiptTrace);assert.ok(trace.length>0);assert.ok(trace.some(row=>row.progress===50));assert.ok(trace.every(row=>row.progress!==25),'The receipt snapshot must never be written to the already loaded schedule');await showWorkspaceSection(page,'field-title');
 };
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo de snapshots');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="project-preparation-title"]')?.getAttribute('aria-busy')==='false',{timeout:15000});assert.equal(preparationReads,1);
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),0);assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),[original.startsOn,original.endsOn]);
  await showWorkspaceSection(page,'schedule-title');await waitCurrentSchedule();await page.evaluate(()=>{window.__loadedReceiptTrace=[];window.__loadedReceiptPhase='INITIAL';window.__loadedReceiptObserver=new MutationObserver(()=>{const row=document.querySelector('[data-task-id="task-a"]');if(row)window.__loadedReceiptTrace.push({phase:window.__loadedReceiptPhase,progress:Number(row.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')),dates:[...row.querySelectorAll('time')].map(time=>time.dateTime)});});window.__loadedReceiptObserver.observe(document.querySelector('section[aria-labelledby="schedule-title"]'),{subtree:true,childList:true,attributes:true});});
  await showWorkspaceSection(page,'field-title');await click(page,'Abrir operaciones');await page.waitForSelector('nav[aria-label="Operaciones de campo"]');await click(page,'Avance');await waitCurrentProgress(page);assert.ok(fieldReads.some(row=>row.kind==='REVIEW'));
  for(const [index,kind] of cases.entries()){
   await page.waitForSelector('[data-field-proposal="proposal-snapshot-'+index+'"] button');await page.$eval('[data-field-proposal="proposal-snapshot-'+index+'"] button',element=>element.click());await page.waitForSelector('section[aria-labelledby="field-title"] form');await page.select('section[aria-labelledby="field-title"] form select','APPROVE');await page.type('section[aria-labelledby="field-title"] form textarea','Decisión sintética '+kind+'.');await markPhase('DECISION_UNCERTAIN');await click(page,'Guardar con recibo');
   await waitText(page,'El resultado quedó sin confirmar.');assert.equal(posts.length,index+1);assert.equal((await page.$$('[data-confirmed-progress]')).length,0);readsBeforeRecovery=scheduleReads.length;await markPhase('RECOVERY_CALLBACK');await click(page,'Comprobar guardado');await waitText(page,mode==='invalid-snapshot'?'Decisión guardada con recibo. Consultá el estado de la propuesta.':'Avance aprobado con recibo.');
   await page.waitForFunction(()=>document.querySelector('[data-task-id="task-a"] [role="progressbar"]')?.getAttribute('aria-valuenow')==='50');for(let i=0;i<80&&!heldRefresh;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(heldRefresh,'Hold the field refresh to observe the schedule callback separately');assert.equal(scheduleReads.length,readsBeforeRecovery,'The current50 callback is observed before returning to the schedule or any background schedule GET');const callbackTrace=await page.evaluate(()=>window.__loadedReceiptTrace);assert.ok(callbackTrace.some(row=>row.phase==='RECOVERY_CALLBACK'&&row.progress===50),'Current50 must reach the loaded schedule through the receipt callback before native refresh');assert.ok(callbackTrace.every(row=>row.progress!==25));await assertCurrentSchedule({pendingRefresh:true});assert.deepEqual(receiptQueries,posts.map(input=>input.operationId));assert.equal(posts.length,index+1);assert.equal(new Set(posts.map(input=>input.operationId)).size,posts.length);
   assert.equal(await page.$eval('section[aria-labelledby="field-title"] details code',element=>element.textContent),recorded.outcome.receiptId);
   if(mode==='invalid-snapshot'){
    assert.equal((await page.$$('[data-confirmed-progress]')).length,0);assert.equal(await page.$$eval('button',elements=>elements.filter(element=>element.textContent==='Ver en el cronograma').length),0);const fieldText=await page.$eval('section[aria-labelledby="field-title"]',element=>element.innerText);assert.ok(!fieldText.includes('avance aprobado en este recibo')&&!fieldText.includes('Avance aprobado con recibo.'));
   }else{
    const receiptText=await page.$eval('[data-confirmed-progress="task-a"]',element=>element.textContent);assert.ok(receiptText.includes('25% de avance aprobado en este recibo')&&!receiptText.includes('50%')&&receiptText.includes('Esta tarea está cargada en el cronograma.'));assert.ok(await page.$eval('[data-confirmed-progress="task-a"] button',element=>element.disabled));
   }
   const refresh=heldRefresh;heldRefresh=null;await respond(refresh,field);await page.waitForFunction(()=>document.querySelector('nav[aria-label="Operaciones de campo"] button')?.disabled===false);await assertCurrentSchedule();assert.equal(posts.length,index+1);
   if(mode==='loaded-current'){await markPhase('FOCUS_LOADED_TASK');await page.focus('[data-confirmed-progress="task-a"] button');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.dataset.taskId==='task-a');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.taskId),'task-a');assert.ok(projectReadLedger.every(row=>row.kind==='BASE'&&row.afterTask===null));assert.equal(posts.length,1);assert.ok((await page.$eval('[data-confirmed-progress="task-a"]',element=>element.textContent)).includes('25% de avance aprobado en este recibo'));}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await showWorkspaceSection(page,'field-title');await (await page.$('section[aria-labelledby="field-title"]')).screenshot({path:path.join(evidence,'workspace-receipt-'+mode+'-'+kind+'-'+width+'.png')});
  }
  await showWorkspaceSection(page,'schedule-title');await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,'workspace-receipt-'+mode+'-'+snapshotCase+'-schedule-'+width+'.png')});
 }catch(error){await page.screenshot({path:path.join(evidence,'workspace-receipt-'+mode+'-failure-'+width+'.png'),fullPage:false}).catch(()=>{});throw error;}
 finally{const trace=await page.evaluate(()=>window.__loadedReceiptTrace||[]).catch(()=>[]);writeFileSync(path.join(evidence,`workspace-loaded-receipt-${mode}-${snapshotCase}-${width}-request-ledger.json`),JSON.stringify({width,mode,snapshotCase,phase,projectReadLedger,fieldReads,posts,receiptQueries,trace},null,2)+'\n');if(heldRefresh&&!heldRefresh.isInterceptResolutionHandled())await heldRefresh.abort().catch(()=>{});await page.evaluate(()=>window.__loadedReceiptObserver?.disconnect()).catch(()=>{});await context.close();}
}
async function stalePaginationScenario(){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width:390,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode:'stale-pagination',width:390,message:error.message}));
 const beforeRevision='2026-10-02T09:00:00.000001',afterRevision='2026-10-02T09:00:00.000002',original={...baseTask(),revision:beforeRevision},posts=[],requests=[];
 const padding=Array.from({length:99},(_,index)=>({...original,id:'task-b-'+String(index+1).padStart(3,'0'),title:'Tarea de página inicial '+(index+1)})),cursor=padding.at(-1).id,late={...original,id:'z-late-page-task',title:'Tarea añadida por la página tardía'};let canonicalTask=original,phase='INITIAL',manualCursorPending=false;
 const taskPage=(cursorRequest=false)=>({scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Jefe de obra',canPlanSchedule:true,tasks:cursorRequest?[late]:[canonicalTask,...padding],totalTasks:101,nextCursor:cursorRequest?null:cursor});
 const waitCurrentSchedule=()=>page.waitForFunction(()=>{const visible=[...document.querySelectorAll('[data-worksite-live-refresh]')].filter(node=>node.getClientRects().length);return visible.length===1&&visible[0].dataset.worksiteLiveRefresh==='CURRENT';},{timeout:15000});
 let heldPage;const paginationStarted=new Promise(resolve=>{heldPage={resolve,request:null};});
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');const kind=request.method()==='POST'?'POST':!url.search?'ACCOUNT':url.searchParams.has('afterTask')?(manualCursorPending?'EXPLICIT_CURSOR':'RETAINED_CURSOR'):'BASE';requests.push({phase,kind,method:request.method(),query:url.search});let body;
   if(request.method()==='POST'){
    const payload=JSON.parse(request.postData());posts.push(payload);assert.equal(posts.length,1);assert.equal(payload.scope,scope);assert.equal(payload.projectId,'p-a');assert.equal(payload.taskId,original.id);assert.equal(payload.expectedRevision,beforeRevision);assert.equal(payload.startsOn,'2026-10-07');assert.equal(payload.endsOn,'2026-10-15');
    canonicalTask={...original,startsOn:payload.startsOn,endsOn:payload.endsOn,revision:afterRevision};body={scope,saved:true,replayed:false,task:canonicalTask,receipt:{id:'workspace_schedule_'+ 'c'.repeat(64),taskId:original.id,recordedAt:afterRevision,before:{startsOn:original.startsOn,endsOn:original.endsOn},after:{startsOn:payload.startsOn,endsOn:payload.endsOn}}};
   }else if(!url.search)body={scope,organizationName:'Empresa de ensayo de página tardía',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};
   else{
    assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');
    const after=url.searchParams.get('afterTask');assert.deepEqual([...url.searchParams.keys()].sort(),after?['afterTask','projectId','scope']:['projectId','scope']);
    if(after){assert.equal(after,cursor);if(manualCursorPending){manualCursorPending=false;assert.equal(heldPage.request,null);heldPage.request=request;heldPage.resolve();return;}body=taskPage(true);}else body=taskPage();
   }
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode:'stale-pagination',width:390,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo de página tardía');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await showWorkspaceSection(page,'schedule-title');await page.waitForSelector('[data-task-id="task-a"]');
  await waitCurrentSchedule();phase='HELD_EXPLICIT_CURSOR';manualCursorPending=true;await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await paginationStarted;phase='PLANNING_WITH_PAGE_PENDING';await showWorkspaceSection(page,'schedule-title');await fill(page);await click(page,'Confirmar planificación');await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cambio confirmado');assert.equal(posts.length,1);
  // Deliberately adversarial: this single retained cursor response repeats
  // original below the cursor with its old revision. Keep that overlap to prove
  // mergeLoadedTasks cannot roll back the later confirmed planning receipt.
  phase='LATE_PAGE_RELEASED';await heldPage.request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify({...taskPage(true),tasks:[original,late]})});
  await page.waitForSelector('[data-task-id="z-late-page-task"]');await waitCurrentSchedule();phase='CURRENT_AFTER_LATE_PAGE';assert.equal(manualCursorPending,false);assert.equal(await page.$$eval('[data-task-id="task-a"]',elements=>elements.length),1);
  assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),['2026-10-07','2026-10-15']);
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>element.getAttribute('aria-valuenow')),'37');assert.ok((await text(page)).includes('2026-10-07 → 2026-10-15'));assert.ok((await text(page)).includes('Cambio confirmado'));assert.equal(posts.length,1);assert.equal(requests.filter(request=>request.kind==='ACCOUNT').length,1);assert.equal(requests.filter(request=>request.kind==='EXPLICIT_CURSOR').length,1);const retained=requests.filter(request=>['LATE_PAGE_RELEASED','CURRENT_AFTER_LATE_PAGE'].includes(request.phase)&&request.method==='GET');assert.equal(retained.length%2,0);assert.ok(retained.every((request,index)=>request.kind===(index%2===0?'BASE':'RETAINED_CURSOR')),'Post-append native reads must be complete canonical base/cursor cycles, not a repeated held page');assert.ok((await text(page)).includes('101 de 101 tareas cargadas'));
  await showWorkspaceSection(page,'schedule-title');await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,'workspace-workbench-stale-page-390.png')});checks.push('workbench-late-cursor-page-preserves-confirmed-newer-schedule-and-receipt-390');
 }catch(error){await page.screenshot({path:path.join(evidence,'workspace-workbench-stale-page-failure-390.png'),fullPage:false}).catch(()=>{});throw error;}
 finally{writeFileSync(path.join(evidence,'workspace-stale-pagination-request-ledger.json'),JSON.stringify({phase,requests,posts},null,2)+'\n');if(heldPage.request&&!heldPage.request.isInterceptResolutionHandled())await heldPage.request.abort().catch(()=>{});await context.close();}
}

async function onboardingEpochScenario(width){
 const mode='onboarding-epoch',context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 // Keep this epoch-only oracle independent of background refresh. Native refresh
 // timing/visibility is exercised separately by verify-worksite-live-refresh-ui.
 await page.evaluateOnNewDocument(()=>Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'}));
 const posts=[],queries=[];let workspaceReads=0,channelReads=0,heldChannel;let channelStarted;const channelGate=new Promise(resolve=>{channelStarted=resolve;});
 const participant={id:'worker-self',name:'Persona propia',active:true,revision,status:'ACTIVE',self:true,accountLinked:true,invitation:null,permissions:{attendance:true,report:true},kyc:{status:'APPROVED',submissionId:null,images:[]}},channel=()=>({scope,projectId:'p-a',channelReady:true,records:[{workerId:participant.id,name:participant.name,phone:'+15550001001',connectionNumber:'+15550002002',revision,state:'VERIFIED',eligible:true,challenge:null,binding:{id:'binding-'+channelReads,verifiedAt:'2026-10-01T12:00:00.000Z',revokedAt:null}}]});
 await page.setRequestInterception(true);page.on('request',async request=>{try{const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}if(!url.pathname.startsWith('/api/identity/'))return request.continue();assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');if(request.method()==='POST'){posts.push(request.postData());throw Error('Onboarding epoch scenario permits GET only');}queries.push({path:url.pathname,query:url.search});let body;
  if(url.pathname==='/api/identity/workspace'){if(!url.search)body={scope,organizationName:'Empresa de epoch sint\u00e9tico',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};else{assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');workspaceReads++;body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:false,tasks:[baseTask(),...(workspaceReads>1?[{...baseTask(),id:'task-second',title:'Segunda tarea can\u00f3nica'}]:[])],totalTasks:2,nextCursor:workspaceReads===1?'synthetic-task-cursor':null};}}
  else if(url.pathname==='/api/identity/participants')body={scope,projectId:'p-a',canManage:false,canInvite:false,canManageOfficeRoles:false,existingAccounts:[],records:[participant],privacyNotice:{version:'fixture-notice',text:'Ensayo sin documentos'}};
  else if(url.pathname==='/api/identity/worker-channel'){assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');channelReads++;if(channelReads===2){heldChannel=request;channelStarted();return;}body=channel();}
  else if(url.pathname==='/api/identity/task-creation'){assert.equal(url.searchParams.get('operationId'),'11111111-1111-4111-8111-111111111111');assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.get('scope'),scope);body={scope,projectId:'p-a',state:'RECORDED',saved:true,created:true,receiptId:'task-recovery-fixture',task:baseTask()};}
  else throw Error('Unexpected synthetic identity endpoint');await request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});assert.equal(await page.evaluate(()=>innerWidth),width);await waitText(page,'Empresa de epoch sint\u00e9tico');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');await showGuide(page);await showWorkspaceSection(page,'participant-title');await click(page,'Consultar participantes');await page.waitForSelector('[data-onboarding-step="CHANNEL_UNOBSERVED"]');await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculaci\u00f3n');await page.waitForSelector('[data-onboarding-step="CHANNEL_VERIFIED"]');assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),1);await page.waitForFunction(()=>document.querySelector('[data-guide-observation="OBSERVED"]')?.textContent.includes('Tu vínculo personal está vigente'));assert.match(await guideStatus(page),/1 tarea cargada de 2.*Vista parcial/s);
  await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar m\u00e1s tareas');await page.waitForSelector('[data-task-id="task-second"]');await page.waitForSelector('[data-onboarding-step="CHANNEL_UNOBSERVED"]');assert.equal(channelReads,1);assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),0);assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));assert.match(await guideStatus(page),/2 tareas cargadas de 2.*Vista completa/s);
  await page.evaluate(async body=>{await window.__prepareWorkspaceReference(body);},{scope,projectId:'p-a',operationId:'11111111-1111-4111-8111-111111111111'});await showWorkspaceSection(page,'workspace-recovery-title');await waitText(page,'Operaciones por comprobar');await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculaci\u00f3n');await channelGate;await showWorkspaceSection(page,'workspace-recovery-title');await click(page,'Comprobar recibo');await showWorkspaceSection(page,'schedule-title');await page.waitForFunction(()=>document.body.innerText.includes('Cronograma actualizado desde los registros'));assert.equal(workspaceReads,3);
  const oldBody=channel();await heldChannel.respond({status:200,contentType:'application/json',body:JSON.stringify(oldBody)});heldChannel=null;await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Consultar vinculaci\u00f3n'&&!button.disabled));assert.equal(await page.$eval('[data-onboarding-step]',el=>el.dataset.onboardingStep),'CHANNEL_UNOBSERVED');assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),0);assert.equal(channelReads,2);assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculaci\u00f3n');await page.waitForSelector('[data-onboarding-step="CHANNEL_VERIFIED"]');assert.equal(channelReads,3);assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),1);assert.equal(posts.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(evidence,`workspace-onboarding-epoch-${width}.png`),fullPage:true});checks.push({mode,width,workspaceReads,channelReads,posts:posts.length,appendInvalidates:true,lateSnapshotRejected:true,freshExplicitReadRequired:true,backgroundRefreshPrecondition:'document-hidden-for-epoch-only-oracle'});
 }catch(error){console.error(JSON.stringify({diagnostic:'onboarding-epoch-primary-failure',width,message:error.message,stack:error.stack,ui:await page.evaluate(()=>({hash:location.hash,active:document.activeElement?.id,visibleScreens:[...document.querySelectorAll('[data-workspace-screen]')].filter(node=>!node.hidden).map(node=>node.dataset.workspaceScreen)})).catch(()=>null)}));throw error;}finally{if(heldChannel&&!heldChannel.isInterceptResolutionHandled())await heldChannel.abort().catch(()=>{});await context.close();}
}

const guideStatus=page=>page.$eval('[data-guide-observation]',node=>node.textContent);
async function guideObservationScenario(width){
 const mode='guide-observation',context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let failureStatus=null,currentScope=scope,role='SITE_MANAGER',projectReads=0;
 await page.setRequestInterception(true);page.on('request',async request=>{try{const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}if(!url.pathname.startsWith('/api/identity/'))return request.continue();requests.push({path:url.pathname,method:request.method()});assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');if(request.method()!=='GET'){posts.push(request.postData());throw Error('Guide scenario permits GET only');}let status=200,body;
  if(url.pathname==='/api/identity/workspace'){
   if(!url.search)body={scope:currentScope,organizationName:'Empresa de guía sintética',role,roleLabel:role==='SITE_MANAGER'?'Jefe de obra':'Auditor',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false};
   else{assert.equal(url.searchParams.get('scope'),currentScope);const id=url.searchParams.get('projectId');projectReads++;if(failureStatus){status=failureStatus;failureStatus=null;body={code:status===401?'SESSION_REQUIRED':status===403?'WORKSPACE_MEMBERSHIP_REQUIRED':'WORKSPACE_OPERATION_UNCONFIRMED'};}else body={scope:currentScope,project:{id,name:id==='p-a'?'Obra de prueba A':'Obra de prueba B'},canPlanSchedule:false,tasks:[{...baseTask(),id:id+'-task'+projectReads,startsOn:null,endsOn:null}],totalTasks:3,nextCursor:'guide-cursor-'+projectReads};}
  }else if(url.pathname==='/api/identity/worker-channel')body={scope:currentScope,projectId:'p-a',channelReady:true,truncated:false,records:[{workerId:'own-worker',name:'Persona sintética',revision,state:'VERIFIED',eligible:true,binding:{id:'guide-binding',verifiedAt:'2026-10-01T12:00:00Z',revokedAt:null}}]};
  else throw Error('Unexpected guide endpoint '+url.pathname);
  await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await page.waitForFunction(()=>document.querySelector('[data-guide-observation="OBSERVED"]')?.textContent.includes('Empresa consultada'));assert.match(await guideStatus(page),/2 obras asignadas/);assert.match(await guideStatus(page),/abrí una obra/);
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForFunction(()=>window.__guideObservation?.schedule?.loaded===1);await showGuide(page);assert.match(await guideStatus(page),/1 tarea cargada de 3.*Vista parcial.*1 sin fechas/s);
  await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculación');await page.waitForFunction(()=>window.__guideObservation?.channel?.ownLinked===true);assert.match(await guideStatus(page),/Tu vínculo personal está vigente/);
  failureStatus=503;await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await page.waitForSelector('[data-guide-observation="UNOBSERVED"]');assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));assert.ok(!(await guideStatus(page)).includes('1 tarea cargada'));assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),1);
  await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await page.waitForFunction(()=>window.__guideObservation?.schedule?.loaded===2);assert.match(await guideStatus(page),/2 tareas cargadas de 3/);assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());await page.waitForFunction(()=>window.__guideObservation?.projectId==='p-b'&&window.__guideObservation?.schedule?.loaded===1);assert.match(await guideStatus(page),/1 tarea cargada de 3/);assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),1);assert.equal(await page.evaluate(()=>window.__guideObservation.channel),null);
  for(const denial of [401,403]){failureStatus=denial;await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await page.waitForSelector('[data-guide-observation="UNAVAILABLE"]');assert.ok(!(await guideStatus(page)).includes('Empresa consultada'));assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);await click(page,'Actualizar');await page.waitForSelector('[data-guide-observation="OBSERVED"]');assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),null);await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForFunction(()=>window.__guideObservation?.projectId==='p-a');}
  currentScope='b'.repeat(64);role='AUDITOR';await click(page,'Actualizar');await page.waitForFunction(()=>document.querySelector('[data-guide-observation="OBSERVED"]')?.textContent.includes('acceso Auditor'));assert.equal(await page.evaluate(()=>window.__guideObservation.scope),currentScope);assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),null);assert.equal(await page.evaluate(()=>window.__guideObservation.channel),null);assert.ok(!(await guideStatus(page)).includes('tareas cargadas'));assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));assert.equal(posts.length,0);await page.$eval('[data-guide-observation]',node=>{node.closest('details').open=true;});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(evidence,'workspace-guide-state-'+width+'.png'),fullPage:true});checks.push({mode,width,projectReads,requests:requests.length,posts:0,failedReadClears:true,denial401Clears:true,denial403Clears:true,projectSwitchClears:true,roleScopeRefreshClears:true});
 }finally{await context.close();}
}

async function guideHttpDenialScenario(width,action,denial){
 const mode=`guide-http-${action}-${denial}`,context=await browser.createBrowserContext(),page=await context.newPage();
 // Manual HTML-denial oracle: native visible refresh is exercised separately.
 // A hidden document keeps its exact two explicit reads causally independent.
 await page.evaluateOnNewDocument(()=>Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'}));
 await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let denyWorkspace=false,projectReads=0,receiptReads=0;
 await page.setRequestInterception(true);page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}
  if(!url.pathname.startsWith('/api/identity/'))return request.continue();
  requests.push({path:url.pathname,method:request.method()});assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
  if(request.method()!=='GET'){posts.push(request.postData());throw Error('HTML denial fixture permits GET only');}
  let body;
  if(url.pathname==='/api/identity/workspace'){
   if(!url.search)body={scope,organizationName:'Empresa de guía HTTP sintética',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};
   else{assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');projectReads++;
    if(denyWorkspace)return request.respond({status:denial,contentType:'text/html',headers:{'Cache-Control':'no-store'},body:'<html><body>private gateway diagnostic</body></html>'});
    body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:false,tasks:[baseTask()],totalTasks:2,nextCursor:'synthetic-guide-http-cursor'};
   }
  }else if(url.pathname==='/api/identity/worker-channel')body={scope,projectId:'p-a',channelReady:true,truncated:false,records:[{workerId:'own-worker',name:'Persona sintética',revision,state:'VERIFIED',eligible:true,binding:{id:'guide-http-binding',verifiedAt:'2026-10-01T12:00:00Z',revokedAt:null}}]};
  else if(url.pathname==='/api/identity/task-creation'){
   assert.equal(action,'readback');assert.equal(url.searchParams.get('operationId'),'11111111-1111-4111-8111-111111111111');assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.get('scope'),scope);receiptReads++;
   body={scope,projectId:'p-a',state:'RECORDED',saved:true,created:true,receiptId:'guide-http-original-receipt',task:baseTask()};
  }else throw Error('Unexpected HTML denial endpoint '+url.pathname);
  await request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de guía HTTP sintética');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');await showGuide(page);
  await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculación');await page.waitForFunction(()=>window.__guideObservation?.channel?.ownLinked===true);assert.match(await guideStatus(page),/Tu vínculo personal está vigente/);
  denyWorkspace=true;
  if(action==='append'){await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');}
  else{await page.evaluate(body=>window.__prepareWorkspaceReference(body),{scope,projectId:'p-a',operationId:'11111111-1111-4111-8111-111111111111'});await showWorkspaceSection(page,'workspace-recovery-title');await waitText(page,'Operaciones por comprobar');await showWorkspaceSection(page,'workspace-recovery-title');await click(page,'Comprobar recibo');}
  await page.waitForSelector('[data-guide-observation="UNAVAILABLE"]',{timeout:6000});
  assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);assert.equal(await page.$('#worker-channel-title'),null);assert.equal(await page.$('#participant-title'),null);
  assert.equal(await page.$$eval('button',nodes=>nodes.filter(node=>node.textContent.includes('Obra de prueba A')).length),0);
  assert.ok(!(await guideStatus(page)).includes('Empresa consultada'));assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  assert.ok(!(await text(page)).includes('private gateway diagnostic'));assert.ok(!(await text(page)).includes('Unexpected token'));
  assert.equal(projectReads,2);assert.equal(receiptReads,action==='readback'?1:0);assert.equal(posts.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(evidence,`workspace-${mode}-${width}.png`),fullPage:true});
  checks.push({mode,width,projectReads,receiptReads,posts:0,htmlDenialClearsAccount:true,htmlDenialClearsView:true,htmlDenialClearsGuideFacts:true,currentToken:true,backgroundRefreshPrecondition:'document-hidden-for-http-denial-only-oracle'});
 }catch(error){await page.screenshot({path:path.join(evidence,`workspace-${mode}-${width}-failure.png`),fullPage:true}).catch(()=>{});throw error;}
 finally{await context.close();}
}

async function portfolioAccessRaceScenario(width,denial,format,action='project'){
 const mode=`portfolio-access-race-${action}-${denial}-${format}`,context=await browser.createBrowserContext(),page=await context.newPage();
 await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let workspaceReads=0,projectReads=0,portfolioRequest=null,projectRequest=null,scheduleRequest=null;
 const projectRequestLedger=[];let projectReadPhase='INITIAL_PROJECT';
 const refreshedScope='b'.repeat(64);
 const references=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('obrasaas-pending-receipts-v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('references','readonly'),read=tx.objectStore('references').getAll();let rows;read.onsuccess=()=>{rows=read.result;};tx.oncomplete=()=>{db.close();resolve(JSON.stringify(rows));};tx.onerror=()=>{db.close();reject(tx.error);};};}));
 await page.setRequestInterception(true);page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}
  if(!url.pathname.startsWith('/api/identity/'))return request.continue();
  requests.push({path:url.pathname,method:request.method(),query:url.search});assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
  if(request.method()!=='GET'){
   assert.equal(action,'schedule');assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.method(),'POST');
   const payload=JSON.parse(request.postData());assert.equal(payload.scope,scope);assert.equal(payload.taskId,'task-a');assert.equal(payload.projectId,'p-a');assert.equal(payload.expectedRevision,revision);assert.equal(payload.startsOn,'2026-10-07');assert.equal(payload.endsOn,'2026-10-15');posts.push(payload);scheduleRequest=request;return;
  }
  let body;
  if(url.pathname==='/api/identity/workspace'){
   if(!url.search){workspaceReads++;body={scope:workspaceReads===1?scope:refreshedScope,organizationName:workspaceReads===1?'Empresa de acceso sintético':'Empresa recién consultada',role:workspaceReads===1?'SITE_MANAGER':'AUDITOR',roleLabel:workspaceReads===1?'Jefe de obra':'Auditor',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:workspaceReads===1?'p-a':'p-c',name:workspaceReads===1?'Obra de prueba A':'Obra de nueva consulta'},...(workspaceReads===1?[{id:'p-b',name:'Obra de prueba B'}]:[])],projectsTruncated:false};}
   else if(url.searchParams.has('portfolio')){assert.equal(url.searchParams.get('scope'),scope);portfolioRequest=request;return;}
   else{assert.equal(url.searchParams.get('scope'),scope);projectReads++;const projectId=url.searchParams.get('projectId');projectRequestLedger.push({number:projectReads,projectId,scope:url.searchParams.get('scope'),phase:projectReadPhase,queryKeys:[...url.searchParams.keys()].sort()});assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.ok(!['ACCESS_UNAVAILABLE','FRESH_ACCOUNT'].includes(projectReadPhase),'No project-page GET may start after access became unavailable');if(url.searchParams.get('projectId')==='p-b'){assert.equal(action,'project');assert.equal(projectRequestLedger.filter(row=>row.projectId==='p-b').length,1,'Only one canonical request may follow the explicit project-B action');projectRequest=request;return;}assert.equal(url.searchParams.get('projectId'),'p-a');body={scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Jefe de obra',canPlanSchedule:action!=='project',tasks:[baseTask()],totalTasks:1,nextCursor:null};}
  }else if(url.pathname==='/api/identity/worker-channel')body={scope,projectId:'p-a',channelReady:true,truncated:false,records:[{workerId:'own-worker',name:'Persona sintética',revision,state:'VERIFIED',eligible:true,binding:{id:'race-binding',verifiedAt:'2026-10-01T12:00:00Z',revokedAt:null}}]};
  else throw Error('Unexpected portfolio race endpoint '+url.pathname);
  await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de acceso sintético');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');await showGuide(page);
  // The real mounted schedule hook immediately re-reads the selected project.
  // A canonical response must reach CURRENT before beginning the access race.
  await page.waitForFunction(()=>{const live=[...document.querySelectorAll('[data-worksite-live-refresh]')].filter(node=>node.getClientRects().length);return live.length===1&&live[0].dataset.worksiteLiveRefresh==='CURRENT';},{timeout:15000});
  assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),'p-a');assert.equal(projectReads,2);assert.deepEqual(projectRequestLedger.map(row=>({projectId:row.projectId,phase:row.phase})),[{projectId:'p-a',phase:'INITIAL_PROJECT'},{projectId:'p-a',phase:'INITIAL_PROJECT'}]);projectReadPhase='PROJECT_A_BACKGROUND';
  await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculación');await page.waitForFunction(()=>window.__guideObservation?.channel?.ownLinked===true);
  await page.evaluate(body=>window.__prepareWorkspaceReference(body),{scope,projectId:'p-a',operationId:'22222222-2222-4222-8222-222222222222'});await showWorkspaceSection(page,'workspace-recovery-title');await waitText(page,'Operaciones por comprobar');
  const retainedReferences=await references(),observedGeneration=await page.evaluate(()=>window.__guideObservation.generation);assert.ok(retainedReferences.includes('22222222-2222-4222-8222-222222222222'));
  await showWorkspaceSection(page,'workspace-home-title');await click(page,'Consultar resumen');await page.waitForFunction(()=>document.querySelector('#portfolio-overview-title')?.closest('section').getAttribute('aria-busy')==='true');
  for(let i=0;i<80&&!portfolioRequest;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(portfolioRequest,'The portfolio read must be dispatched before the concurrent action');
  if(action==='project'){
   projectReadPhase='CONCURRENT_PROJECT_B';
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());await page.waitForSelector('[data-guide-observation="CONSULTING"]');
   for(let i=0;i<40&&!projectRequest;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(projectRequest,'The project read must be dispatched before access denial');
  }else{
   await showWorkspaceSection(page,'schedule-title');
   // Schedule/token variants can legitimately trigger another native GET A
   // when returning to the schedule. The five-second gap is product behavior,
   // not a guessed new aggregate count. Keep its real CURRENT result visible.
   await page.waitForFunction(()=>{const live=[...document.querySelectorAll('[data-worksite-live-refresh]')].filter(node=>node.getClientRects().length);return live.length===1&&live[0].dataset.worksiteLiveRefresh==='CURRENT';},{timeout:15000});
   assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),'p-a');projectReadPhase='SCHEDULE_OR_TOKEN_PENDING';await fill(page);if(action==='token')await page.evaluate(()=>{window.__holdToken=true;});await click(page,'Confirmar planificación');
   if(action==='token')await page.waitForFunction(()=>typeof window.__resolveToken==='function');
   else{for(let i=0;i<80&&!scheduleRequest;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(scheduleRequest,'The schedule command must be dispatched before access denial');}
  }
  const pendingReferences=await references();if(action==='schedule')assert.ok(pendingReferences.includes(posts[0].operationId));
  await portfolioRequest.respond({status:denial,contentType:format==='html'?'text/html':'application/json',headers:{'Cache-Control':'no-store'},body:format==='html'?'<html><body>private gateway diagnostic</body></html>':JSON.stringify({code:'WORKSPACE_CONTEXT_CHANGED'})});
  await page.waitForSelector('[data-guide-observation="UNAVAILABLE"]',{timeout:6000});
  projectReadPhase='ACCESS_UNAVAILABLE';const projectReadsAtAccessLoss=projectReads;
  assert.ok(await page.$$eval('button',nodes=>nodes.find(node=>node.textContent==='Actualizar')?.disabled===false),'An access denial must allow explicit account refresh');
  assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);assert.equal(await page.$('#worker-channel-title'),null);assert.equal(await page.$('#portfolio-overview-title'),null);
  assert.ok(!(await text(page)).includes('Empresa de acceso sintético'));assert.ok(!(await text(page)).includes('private gateway diagnostic'));assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  assert.ok(await page.evaluate(previous=>window.__guideObservation.generation>previous,observedGeneration));assert.equal(workspaceReads,1);
  // The old project response arrives after access was invalidated. It must not
  // restore private work or an observed guide state, even when cancellation
  // and response delivery race in the browser transport.
  if(action==='project')await projectRequest.respond({status:200,contentType:'application/json',body:JSON.stringify({scope,project:{id:'p-b',name:'Obra privada de respuesta anterior',status:'ACTIVE'},roleLabel:'Jefe de obra',canPlanSchedule:false,tasks:[{...baseTask(),title:'Tarea privada de respuesta anterior'}],totalTasks:1,nextCursor:null})}).catch(()=>{});
  else if(action==='token')await page.evaluate(()=>{window.__holdToken=false;window.__resolveToken();});
  else{const payload=posts[0];await scheduleRequest.respond({status:200,contentType:'application/json',body:JSON.stringify({scope,saved:true,replayed:false,task:{...baseTask(),startsOn:payload.startsOn,endsOn:payload.endsOn,revision:'2026-10-01T12:00:00.111111'},receipt:{id:'workspace_schedule_'+ 'b'.repeat(64),taskId:'task-a',recordedAt:'2026-10-01T12:00:00.111111',before:{startsOn:'2026-10-01',endsOn:'2026-10-05'},after:{startsOn:payload.startsOn,endsOn:payload.endsOn}}})}).catch(()=>{});}
  await new Promise(resolve=>setTimeout(resolve,180));assert.equal(await page.$eval('[data-guide-observation]',node=>node.dataset.guideObservation),'UNAVAILABLE');assert.ok(!(await text(page)).includes('respuesta anterior'));assert.ok(!(await text(page)).includes('Cambio confirmado'));assert.equal(posts.length,action==='schedule'?1:0);
  const survivingReferences=await references();assert.ok(survivingReferences.includes('22222222-2222-4222-8222-222222222222'));if(action==='schedule')assert.equal(survivingReferences,pendingReferences);else if(action==='project')assert.equal(survivingReferences,retainedReferences);
  projectReadPhase='FRESH_ACCOUNT';await click(page,'Actualizar');await waitText(page,'Empresa recién consultada');await page.waitForFunction(expected=>window.__guideObservation?.state==='OBSERVED'&&window.__guideObservation.scope===expected,{},refreshedScope);
  assert.equal(await page.evaluate(()=>window.__guideObservation.channel),null);assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),null);assert.equal(await references(),survivingReferences);assert.equal(workspaceReads,2);assert.equal(projectReads,projectReadsAtAccessLoss,'No project-page GET after access loss or during explicit fresh account lookup');assert.equal(projectRequestLedger.filter(row=>row.projectId==='p-b').length,action==='project'?1:0,'Concurrent project-B action dispatches once, schedule/token never select B');assert.ok(projectRequestLedger.every(row=>row.scope===scope&&['p-a','p-b'].includes(row.projectId)&&!['ACCESS_UNAVAILABLE','FRESH_ACCOUNT'].includes(row.phase)),'Every retained project-page request belongs to the original scope before access loss');assert.equal(posts.length,action==='schedule'?1:0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  checks.push({mode,width,denial,format,action,posts:posts.length,projectReads,projectRequestLedger,projectAReads:projectRequestLedger.filter(row=>row.projectId==='p-a').length,projectBReads:projectRequestLedger.filter(row=>row.projectId==='p-b').length,nativeCurrentBeforeRace:true,nativeCurrentBeforeScheduleOrToken:action!=='project',noProjectReadsAfterAccessLoss:true,refreshUnlocked:true,guideUnavailable:true,lateResponseRejected:true,lateTokenPostBlocked:action==='token',channelSnapshotCleared:true,referencesPreserved:true,explicitFreshScope:true});
 }catch(error){await page.screenshot({path:path.join(evidence,`workspace-${mode}-${width}-failure.png`),fullPage:true}).catch(()=>{});throw error;}
 finally{await context.close();}
}

try{
 let ready=false;
 for(let i=0;i<120;i++){
  if(server.exitCode!==null)throw new Error('Fixture server exited: '+serverLog.slice(-5000));
  let response;try{response=await fetch(origin);}catch{}
  await response?.body?.cancel();
  if(response?.ok){ready=true;break;}
  if(response&&response.status>=500)throw new Error('Fixture page failed with HTTP '+response.status+': '+serverLog.slice(-5000));
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 assert.ok(ready,'Fixture server unavailable: '+serverLog.slice(-5000));
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 if([undefined,'onboarding-epoch','guide-observation'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])await guideObservationScenario(width);
 if([undefined,'onboarding-epoch'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])await onboardingEpochScenario(width);
 if([undefined,'guide-http-denial'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])for(const action of ['append','readback'])for(const denial of [401,403])await guideHttpDenialScenario(width,action,denial);
 if([undefined,'portfolio-access-race'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])for(const denial of [401,403,409]){for(const format of ['html','json'])await portfolioAccessRaceScenario(width,denial,format);for(const action of ['schedule','token'])await portfolioAccessRaceScenario(width,denial,'json',action);}
  if([undefined,'workbench'].includes(process.env.WORKSPACE_UI_SCENARIO)){
   for(const width of [320,390,768,1280]){await workbenchScenario(width);await workbenchCanonicalPaginationScenario(width);}
   await stalePaginationScenario();
   if(process.env.WORKSPACE_UI_SCENARIO==='workbench')for(const width of [320,390])await scenario('readonly',width);
  }
  if([undefined,'gantt-volume'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])await ganttVolumeScenario(width);
 if([undefined,'confirmed-progress','confirmed-progress-planning'].includes(process.env.WORKSPACE_UI_SCENARIO)){const progressModes=process.env.WORKSPACE_UI_SCENARIO==='confirmed-progress-planning'?['planning']:['readback','callback','planning'];for(const width of [390,1280])for(const mode of progressModes)await confirmedProgressScenario(mode,width);if(process.env.WORKSPACE_UI_SCENARIO==='confirmed-progress')await stalePaginationScenario();}
 if([undefined,'confirmed-progress','confirmed-progress-unloaded'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])for(const decision of ['APPROVE','REJECT'])await unloadedConfirmedProgressScenario(width,decision);
 if([undefined,'confirmed-progress','confirmed-progress-snapshots'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])for(const mode of ['loaded-current','invalid-snapshot'])await receiptSnapshotCoverageScenario(width,mode);
 if(process.env.WORKSPACE_UI_SCENARIO==='navigation')for(const width of [320,390,768,1280])for(const role of ['ADMIN','AUDITOR'])await navigationScenario(role,width);
 if([undefined,'post-progress'].includes(process.env.WORKSPACE_UI_SCENARIO)){
  for(const width of [320,390,768,1280])for(const mode of ['changed-again','get-failed','missing','denied-401','denied-403'])await scheduleConflictScenario(mode,width);
  for(const mode of ['foreign-project','foreign-scope','foreign-task','read-only','unmount-token','retry-conflict'])await scheduleConflictScenario(mode,390);
 }
 if([undefined,'post-progress','post-conflicts'].includes(process.env.WORKSPACE_UI_SCENARIO)){
 for(const width of [320,390,768,1280])await scenario('success',width);
 for(const mode of ['readonly','denied','empty','draft-cancel','sdk-unavailable','unmount-token','uncertain','rollback','not-arrived','conflict','race'])await scenario(mode);
 for(const mode of ['draft-cancel','uncertain','rollback','not-arrived'])await taskCreateScenario(mode);
 }
 if([undefined,'post-progress','post-conflicts','post-creation'].includes(process.env.WORKSPACE_UI_SCENARIO)){
 for(const width of [320,390,768,1280])for(const role of ['ADMIN','AUDITOR'])await navigationScenario(role,width);
 for(const width of [320,768,1280])await scenario('uncertain',width);
 for(const width of [320,390,768,1280])for(const uncertain of [false,true])await mobileImportNavigationScenario(width,uncertain);
 }
 assert.deepEqual(pageErrors,[]);
 const proof={status:'PASS',fullSuite:!process.env.WORKSPACE_UI_SCENARIO,focusedScenario:process.env.WORKSPACE_UI_SCENARIO||null,environment:'isolated-browser-with-intercepted-synthetic-api',widths:[320,390,768,1280],checks,pageErrors,sourceManifest,harnessSha256,productionLoginVerified:false,productionDataWritten:false,physicalWhatsAppVerified:false,documentCurveSourceManifest,fixtureTransforms:documentCurveFixtureTransforms};
 writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({status:'FAILED',message:error.message,checks,pageErrors,sourceManifest,harnessSha256,serverLog,documentCurveSourceManifest,fixtureTransforms:documentCurveFixtureTransforms},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(resolve=>setTimeout(resolve,500));assert.equal(path.dirname(path.resolve(fixture)),path.resolve(root,'.vercel'));rmSync(fixture,{recursive:true,force:true});}
