import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readdirSync,readFileSync,lstatSync,realpathSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import {projectPreparationSnapshot} from '../src/app/(identity)/cuenta/project-preparation-format.mjs';
import {respondClosedCompanySubscription} from './lib/company-subscription-ui-fixture.mjs';
import {copyPlanDocumentCurveFixture} from './lib/plan-document-curve-fixture-copy.mjs';

// Browser-only acceptance of the real component with intercepted synthetic API
// responses. This is NOT proof of a production login, employee or WhatsApp event.
assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV);
assert.ok([undefined,'onboarding-epoch','guide-observation','guide-http-denial','portfolio-access-race','workbench','gantt-volume','confirmed-progress','confirmed-progress-planning','confirmed-progress-unloaded','confirmed-progress-snapshots','navigation'].includes(process.env.WORKSPACE_UI_SCENARIO));
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
for(const file of ['voice-progress-draft.mjs','progress-measurement-quantity.js','task-progress-measurement.js']){const source='src/lib/'+file,destination=path.join(fixture,source);copyFileSync(path.join(root,source),destination);assert.deepEqual(readFileSync(path.join(root,source)),readFileSync(destination));sourceManifest.push({path:source,sha256:createHash('sha256').update(readFileSync(destination)).digest('hex')});}
assert.equal(new Set(sourceManifest.map(row=>row.path)).size,sourceManifest.length);
const documentCurveSourceManifest=[];
const {fixtureTransforms:documentCurveFixtureTransforms}=copyPlanDocumentCurveFixture({root,fixture,components:path.join(components),sourceManifest:documentCurveSourceManifest});
for(const ref of documentCurveSourceManifest){const existing=sourceManifest.find(row=>row.path===ref.path);if(existing)assert.equal(existing.sha256,ref.sha256,'Original document dependency source hash');else sourceManifest.push(ref);}
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-workspace-ui-fixture',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};\n`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:16,background:'#0b1c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useState} from 'react';import {OnboardingGuide} from './(identity)/cuenta/onboarding-guide';import {AccountWorkspace} from './(identity)/cuenta/workspace-client';import {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';const token=async()=>{if(window.__failNextToken){window.__failNextToken=false;throw new Error('private SDK diagnostic');}if(window.__holdToken)await new Promise(resolve=>{window.__resolveToken=resolve;});return 'synthetic-active-tab-A';};export default function Page(){const [visible,setVisible]=useState(true),[observation,setObservation]=useState(null);const observed=useCallback(value=>{window.__guideObservation=value;setObservation(value);},[]);if(typeof window!=='undefined')window.__prepareWorkspaceReference=body=>browserRecoveryJournal.prepare('/api/identity/task-creation',{method:'POST',body:JSON.stringify(body)});if(typeof window!=='undefined')window.__workspaceReferences=value=>browserRecoveryJournal.list(value);return <main style={{maxWidth:1000,margin:'0 auto'}}><OnboardingGuide orgId="org_fixture" orgRole="org:admin" observation={observation}/><button onClick={()=>setVisible(false)}>Desmontar ensayo</button>{visible?<AccountWorkspace getSessionToken={token} onGuideObservation={observed}/>:<p>Ensayo desmontado</p>}</main>}`);
const port=3108,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true,detached:process.platform!=='win32'});
let serverDrained=false;
const serverClosed=new Promise(resolve=>server.once('close',()=>{serverDrained=true;resolve();}));
async function bounded(promise,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),10000);})]);}finally{clearTimeout(timer);}}
function ownedAlive(child){if(child.exitCode!==null||child.signalCode!==null)return false;try{process.kill(child.pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}}
function ownedClosed(child){return (child.exitCode!==null||child.signalCode!==null)&&child.stdio.every(stream=>!stream||stream.destroyed)?Promise.resolve():new Promise(resolve=>child.once('close',resolve));}
function terminateOwned(child,group=false,signal='SIGKILL'){
 assert.ok(Number.isSafeInteger(child.pid)&&child.pid>0);
 if(process.platform==='win32'){if(!ownedAlive(child))return;const stopped=spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true,timeout:10000});if(stopped.status!==0&&ownedAlive(child))throw Error('OWNED_PROCESS_TREE_CLOSE_FAILED');}
 else if(group){try{process.kill(-child.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}}
 else if(ownedAlive(child))assert.ok(child.kill(signal),'The owned process must receive its shutdown signal');
}
async function stopOwnedBrowser(){
 const child=browser?.process(),closed=child?ownedClosed(child):Promise.resolve();
 try{await bounded(browser?.close(),'OWNED_BROWSER_CLOSE_TIMEOUT');}catch{browser?.disconnect();if(child)terminateOwned(child);}
 if(child&&ownedAlive(child))terminateOwned(child);
 await bounded(closed,'OWNED_BROWSER_DRAIN_TIMEOUT');if(child)assert.equal(ownedAlive(child),false);
}
async function stopHarnessServer(){
 if(serverDrained)return;
 assert.ok(server.spawnargs.includes(fixture),'Only the spawned fixture tree may be stopped');terminateOwned(server,true,'SIGTERM');
 try{await bounded(serverClosed,'OWNED_NEXT_CLOSE_TIMEOUT');}catch(error){terminateOwned(server,true);await bounded(serverClosed,'OWNED_NEXT_FORCE_DRAIN_TIMEOUT');throw error;}
}
function removeOwnedFixture(){
 const parent=path.resolve(root,'.vercel');assert.ok(path.isAbsolute(fixture)&&path.dirname(path.resolve(fixture))===parent);
 assert.equal(lstatSync(parent).isSymbolicLink(),false);assert.equal(lstatSync(fixture).isSymbolicLink(),false);
 const resolvedParent=realpathSync(parent),resolvedFixture=realpathSync(fixture),same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
 assert.ok(same(parent,resolvedParent)&&same(path.resolve(fixture),resolvedFixture));assert.equal(path.dirname(resolvedFixture),resolvedParent);
 rmSync(resolvedFixture,{recursive:true,force:true});assert.equal(existsSync(fixture),false);
}
async function cleanupHarness(){
 const failures=[];for(const stop of [stopOwnedBrowser,stopHarnessServer])try{await stop();}catch(error){failures.push(error);}
 const processesClosed=failures.length===0;if(processesClosed)try{removeOwnedFixture();}catch(error){failures.push(error);}
 const record={processesClosed,fixtureRemoved:!existsSync(fixture),primaryFailure:primaryFailure?.message||null,errors:failures.map(error=>error.message)};writeFileSync(path.join(evidence,'browser-cleanup.json'),JSON.stringify(record,null,2));
 if(failures.length)throw new AggregateError([...(primaryFailure?[primaryFailure]:[]),...failures],'WORKSPACE_UI_CLEANUP_FAILED');
}
let serverLog='';for(const stream of [server.stdout,server.stderr])stream.on('data',value=>{serverLog=(serverLog+value.toString()).slice(-20000);});
let browser,proof,primaryFailure;const checks=[],pageErrors=[];
const scope='a'.repeat(64),revision='2026-09-30T12:00:00.123456';
const baseTask=()=>({id:'task-a',title:'Mampostería · sector norte',status:'IN_PROGRESS',progress:37,startsOn:'2026-10-01',endsOn:'2026-10-05',revision});
const text=page=>page.evaluate(()=>document.body.innerText);
async function click(page,label){const handle=await page.evaluateHandle(name=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===name),label);const element=handle.asElement();assert.ok(element,'Missing button '+label);await element.click();await handle.dispose();}
async function waitText(page,value){await page.waitForFunction(expected=>document.body.innerText.includes(expected),{timeout:15000},value);}
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
async function narrowToolsBeforeOriginalTraversal(page,width,requests,posts){
 const before=requests.length,forms=await page.$$eval('form',nodes=>nodes.length),picker=toolsNav+' select',desktop=toolsNav+' > div';
 await page.evaluate(()=>{window.__mobileNavigation=document.querySelector('nav[aria-label="Navegación de la obra"]');window.__mobileForms=[...document.querySelectorAll('form')];window.__mobileGroups=document.querySelector('nav[aria-label="Navegación de la obra"] select');});
 assert.equal(await page.$eval(picker,node=>node.tagName),'SELECT');assert.equal(await page.$eval(desktop,node=>node.getClientRects().length>0),width>=1100);assert.equal(await page.$eval(picker,node=>node.getClientRects().length>0),width<1100);
 if(width<1100){assert.ok(await page.$eval(picker,node=>node.getBoundingClientRect().height>=44));for(const activation of ['Enter','Space','click']){if(activation==='click')await page.click(picker);else{await page.focus(picker);await page.keyboard.press(activation);}await page.keyboard.press('Escape');await page.select(picker,'schedule-title');await page.waitForFunction(()=>document.querySelector('[data-workspace-screen="cronograma"]')?.hidden===false);assert.ok(await page.$eval('[data-workspace-screen="cronograma"]',node=>node.getClientRects().length>0));await page.select(picker,'workspace-home-title');await page.waitForFunction(()=>document.querySelector('[data-workspace-screen="inicio"]')?.hidden===false);assert.equal(await page.$eval('[data-workspace-screen="cronograma"]',node=>node.getClientRects().length>0),false);}}
 await page.setViewport({width:1099,height:1000});assert.equal(await page.$eval(desktop,node=>node.getClientRects().length>0),false);await page.setViewport({width:1100,height:1000});assert.ok(await page.$eval(desktop,node=>node.getClientRects().length>0));assert.equal(await page.$eval(picker,node=>node.getClientRects().length>0),false);await page.setViewport({width:1099,height:1000});assert.equal(await page.$eval(desktop,node=>node.getClientRects().length>0),false);
 await page.setViewport({width:1280,height:1000});await page.focus(toolsNav+' details summary');await page.evaluate(()=>{window.__mobileFocusedGroup=document.activeElement;});await page.setViewport({width:320,height:1000});await page.waitForFunction(()=>document.querySelector('nav[aria-label="Navegación de la obra"] select')?.checkVisibility());assert.equal(await page.evaluate(()=>window.__mobileFocusedGroup.isConnected),true);assert.ok(await page.$eval(picker,node=>node.getClientRects().length>0));await page.focus(picker);assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('nav[aria-label="Navegación de la obra"] select')),true);
 await page.setViewport({width,height:1000});if(width>=1100)await toggleTools(page,true);assert.ok(await page.$eval(width<1100?picker:desktop,node=>node.getClientRects().length>0));assert.equal(await page.evaluate(()=>document.querySelector('nav[aria-label="Navegación de la obra"]')===window.__mobileNavigation&&document.querySelector('nav[aria-label="Navegación de la obra"] select')===window.__mobileGroups&&window.__mobileForms.every(node=>node.isConnected)),true);assert.equal(await page.$$eval('form',nodes=>nodes.length),forms);assert.equal(requests.length,before);assert.equal(posts.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('mobile-tools-native-keyboard-pointer-breakpoint-focused-orientation-no-unmount-no-requests-'+width);
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
  if(url.pathname==='/api/identity/workspace'){assert.equal(request.method(),'GET');if(!url.search)body={scope,organizationName:'Empresa sintética de navegación de importación',role:'DIRECTOR',roleLabel:'Director de obra',canManageIntegrations:false,canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};else{assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:[baseTask()],totalTasks:1,nextCursor:null};}}
  else if(url.pathname==='/api/identity/project-preparation'){assert.equal(request.method(),'GET');assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');body=projectPreparationSnapshot({scope,projectId:'p-a',canManage:true,revision:0,detailsDigest:'b'.repeat(64),name:'Obra de prueba A',clientName:'',address:'',teams:[],slots:[],startStatus:'TO_CONFIRM',declarationOnly:true},{scope,projectId:'p-a'});}
  else{assert.equal(url.pathname,'/api/identity/plan-import');if(request.method()==='GET'){assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.has('operationId'),false,'Navigation never consults an uncertain reference automatically');if(url.searchParams.has('draftId')){assert.equal(url.searchParams.get('draftId'),draft.id);body={scope,projectId:'p-a',draft};}else body={scope,projectId:'p-a',canApprove:true,drafts:[draft],truncated:false};}else{assert.ok(uncertain);assert.equal(request.method(),'POST');const input=JSON.parse(request.postData());posts.push(input);assert.equal(posts.length,1);assert.equal(input.action,'APPLY');assert.equal(input.scope,scope);assert.equal(input.projectId,'p-a');assert.equal(input.draftId,draft.id);assert.equal(input.expectedRevision,3);assert.equal(input.reason,'Correcciones sintéticas conservadas al navegar.');assert.equal(input.rows[0].title,'Fundaciones corregidas para revisión');status=503;body={code:'PLAN_IMPORT_UNCONFIRMED'};}}
  await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa sintética de navegación de importación');await page.evaluate(()=>[...document.querySelectorAll('button')].find(node=>node.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="project-preparation-title"]')?.getAttribute('aria-busy')==='false');await showWorkspaceSection(page,'schedule-title');await click(page,'Importar PDF, imagen o Excel');await page.waitForFunction(label=>[...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent.trim()===label&&button.disabled===false),{timeout:15000},'Para revisar · 2026-10-06 · 1 tareas');await click(page,'Para revisar · 2026-10-06 · 1 tareas');await waitText(page,'Compará cada fila con el archivo');
  await page.$eval('[data-plan-import] fieldset input:not([type])',node=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'Fundaciones corregidas para revisión');node.dispatchEvent(new Event('input',{bubbles:true}));});await page.$$eval('[data-plan-import] fieldset input[type=date]',nodes=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [index,node] of nodes.entries()){setter.call(node,index?'2026-10-13':'2026-10-12');node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));}});await page.type('[data-plan-import] textarea','Correcciones sintéticas conservadas al navegar.');await (await page.$$('[data-plan-import] input[type=checkbox]')).at(-1).click();
  if(uncertain){await click(page,'Aplicar 1 tareas');await waitText(page,'La confirmación no llegó.');assert.equal(posts.length,1);}else assert.equal(posts.length,0);
  await page.waitForNetworkIdle({idleTime:100,timeout:15000});const referencesBefore=await page.evaluate(value=>window.__workspaceReferences(value),scope);if(uncertain){assert.equal(referencesBefore.length,1);assert.equal(referencesBefore[0].resource,'plan-import');assert.equal(referencesBefore[0].operationId,posts[0].operationId);}else assert.deepEqual(referencesBefore,[]);
  const canonicalTask=await page.$eval('[data-task-id="task-a"]',node=>node.innerText),requestCount=requests.length;await assertClosedPendingNavigation(page,width,'plan-import-title',requests,posts);assert.deepEqual(await page.evaluate(value=>window.__workspaceReferences(value),scope),referencesBefore);assert.equal(await page.$eval('[data-task-id="task-a"]',node=>node.innerText),canonicalTask);assert.equal(await page.$eval('[data-plan-import] textarea',node=>node.value),'Correcciones sintéticas conservadas al navegar.');assert.equal(requests.length,requestCount);assert.equal(posts.length,uncertain?1:0);assert.equal(await page.$eval('#workspace-refresh',node=>node.disabled),true);checks.push(mode+'-pending-outside-fold-keeps-nodes-dates-reason-checks-canonical-task-and-same-reference-'+width);
 }catch(error){await page.screenshot({path:path.join(evidence,mode+'-failure-'+width+'.png'),fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
}
async function scenario(mode,width=390){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
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
    body={scope,project:{id:projectId,name:projectId==='p-b'?'Obra de prueba B':'Obra de prueba A'},canPlanSchedule:mode!=='readonly',tasks:mode==='empty'?[]:[projectId==='p-b'?{...baseTask(),id:'task-b',title:'Tarea visible de la última obra'}:baseTask()],totalTasks:mode==='empty'?0:1,nextCursor:null};
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
 await showWorkspaceSection(page,'schedule-title');await waitText(page,'Mampostería');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Horizontal overflow at '+width);
 assert.ok((await text(page)).includes('37 %'));
  if(mode==='readonly'){assert.equal(await page.$$eval('button',nodes=>nodes.filter(node=>node.textContent==='Planificar fechas').length),0);checks.push('read-only-role-has-no-schedule-write-control');const before=requests.length;await click(page,'Meses');await page.waitForFunction(()=>document.querySelector('[data-gantt-scroll]').dataset.ganttScale==='MONTHS');assert.equal(requests.length,before);assert.equal(posts.length,0);checks.push('read-only-gantt-zoom-is-local-without-business-write-'+width);await context.close();return;}
 if(mode==='success')await page.screenshot({path:path.join(evidence,`workspace-${width}.png`),fullPage:true});
 await showWorkspaceSection(page,'schedule-title');await fill(page);assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')).every(b=>b.disabled)));assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input,form textarea')].every(e=>!e.disabled)));
 if(mode==='sdk-unavailable')await page.evaluate(()=>{window.__failNextToken=true;});
 if(mode==='unmount-token')await page.evaluate(()=>{window.__holdToken=true;});
 if(mode==='draft-cancel'){await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('form'));assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')).every(b=>!b.disabled)));assert.equal(posts.length,0);checks.push('schedule-draft-locks-project-and-refresh-until-explicit-cancel');await context.close();return;}
 await click(page,'Confirmar planificación');
 if(mode==='sdk-unavailable'){
  await waitText(page,'No se pudo renovar tu sesión');assert.equal(posts.length,0);
  assert.equal(await page.$eval('textarea',e=>e.value),'Reprogramación revisada en reunión de obra.');
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input,form textarea')].every(e=>!e.disabled)));
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
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input,form textarea')].every(e=>e.disabled)));
  await click(page,'Comprobar guardado');await waitText(page,'No se observa un recibo todavía');assert.equal(posts.length,1);assert.equal(statusChecks,1);
  assert.ok(await page.$eval('textarea',e=>e.disabled));assert.equal(await page.$eval('textarea',e=>e.value),'Reprogramación revisada en reunión de obra.');
  if(mode==='rollback'){
   await page.evaluate(()=>{window.__failNextToken=true;});await click(page,'Reintentar la misma planificación');await waitText(page,'Conservamos el intento anterior');
   assert.equal(posts.length,1);assert.ok(await page.$eval('textarea',e=>e.disabled));assert.ok((await text(page)).includes('Comprobar guardado'));
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
 const posts=[],directedReads=[],receiptReads=[];let applications=0;
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
    else{assert.equal(p.expectedRevision,currentTask.revision);applications++;body={scope,saved:true,replayed:false,task:{...currentTask,startsOn:p.startsOn,endsOn:p.endsOn,revision:'2026-10-03T10:00:00.123456'},receipt:{id:'workspace_schedule_'+'b'.repeat(64),taskId:target.id,recordedAt:'2026-10-03T10:00:00.123456',before:{startsOn:currentTask.startsOn,endsOn:currentTask.endsOn},after:{startsOn:p.startsOn,endsOn:p.endsOn}}};}
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
   else{assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),project.id);body={scope,project,canPlanSchedule:true,tasks:url.searchParams.has('afterTask')?[target]:[baseTask()],totalTasks:2,nextCursor:url.searchParams.has('afterTask')?null:'task-a'};}
   await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode:'schedule-conflict-'+mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,project.name);await click(page,project.name+'Abrir obra');
 await showWorkspaceSection(page,'schedule-title');await waitText(page,'Mampostería');await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await waitText(page,target.title);await showWorkspaceSection(page,'schedule-title');await fill(page,target.id);
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
  await page.evaluate(()=>{window.__holdToken=true;});await click(page,'Consultar revisión actual');await page.waitForFunction(()=>typeof window.__resolveToken==='function');await click(page,'Desmontar ensayo');await waitText(page,'Ensayo desmontado');await page.evaluate(()=>{window.__holdToken=false;window.__resolveToken();});await page.waitForFunction(()=>window.__guideObservation===null);assert.equal(directedReads.length,0);assert.equal(posts.length,rejectedPosts);assert.deepEqual(await references(),history);checks.push('schedule-conflict-unmounted-token-cannot-query-or-restore-draft-'+width);await context.close();return;
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
 if(mode==='denied-401'||mode==='denied-403'){assert.ok(!(await text(page)).includes(target.title));assert.ok(!(await text(page)).includes('Reprogramación revisada en reunión de obra.'));assert.equal(applications,0);assert.deepEqual(await references(),history);checks.push('schedule-conflict-'+mode+'-hides-private-draft-without-clearing-history-'+width);await context.close();return;}
 await preserved();
 if(mode==='missing'||mode.startsWith('foreign-')||mode==='read-only'){
  assert.equal(await page.$eval(editor+' button[type="submit"]',node=>node.disabled),true);assert.equal(await page.$(editor+' input[type="checkbox"]'),null);assert.equal(applications,0);
  if(mode.startsWith('foreign-'))assert.ok(!(await text(page)).includes('Título vigente de la tarea consultada'));
  await click(page,'Cancelar');await page.waitForFunction(selector=>!document.querySelector(selector),{},editor);assert.equal(posts.length,rejectedPosts);assert.deepEqual(await references(),history);checks.push('schedule-conflict-'+mode+'-keeps-draft-blocks-post-and-allows-explicit-cancel-'+width);await context.close();return;
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
 checks.push('schedule-conflict-'+mode+'-later-page-directed-get-preserves-draft-requires-new-review-and-keeps-history-'+width);await context.close();
}
async function navigationScenario(role,width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode:'navigation-'+role,width,message:error.message}));
 const requests=[],posts=[],subscriptionReads=[],administrator=role==='ADMIN';let preparationReads=0,participantReads=0;
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();
   requests.push({method:request.method(),path:url.pathname,query:url.search});
   if(request.method()!=='GET'){posts.push(request.postData());throw new Error('Navigation must not mutate a business record');}
   assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   if(await respondClosedCompanySubscription(request,{origin,scope,authorization:'Bearer synthetic-active-tab-A',allowed:administrator,reads:subscriptionReads}))return;
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
   const body=!url.search?{scope,organizationName:'Empresa de ensayo de navegación',role,roleLabel:administrator?'Administrador':'Auditor',canManageIntegrations:administrator,canPlanSchedule:administrator,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false}:{scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:administrator,tasks,totalTasks:tasks.length,nextCursor:null};
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode:'navigation-'+role,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo de navegación');
 assert.equal(subscriptionReads.length,administrator?1:0,'Only the administrator automatically consults closed subscription status');
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());
 await page.waitForSelector(workspaceNav);
 const nav=workspaceNav;
 if(administrator){await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="project-preparation-title"]')?.getAttribute('aria-busy')==='false');assert.equal(preparationReads,1);}else{assert.equal(preparationReads,0);assert.equal(await page.$('section[aria-labelledby="project-preparation-title"]'),null);}
 await showGuide(page);assert.ok(await page.$('#onboarding-guide-title'));
 const expected=['workspace-home-title','schedule-title','field-title','inventory-title','participant-title','worker-channel-title','workspace-recovery-title',...(administrator?['project-preparation-title','project-creation-title','site-register-title','purchase-title','own-company-number-title','own-company-templates-title','company-channel-title','customer-whatsapp-title','customer-meta-title','customer-inbox-title','template-send-title','constructor-crm-title','demo-pilot-title','operation-status-title','office-review-admin-title','company-subscription-title']:[])];
 const anchors=await page.$$eval(nav+' a[href^="#"]',elements=>elements.map(element=>element.hash.slice(1)));
 assert.deepEqual([...new Set(anchors)].sort(),expected.sort());
 assert.equal(await page.$eval(nav,element=>[...element.querySelectorAll('a[href^="#"]')].every(link=>document.getElementById(link.hash.slice(1)))),true);
 await narrowToolsBeforeOriginalTraversal(page,width,requests,posts);
 const groups=await page.$$(nav+' details');if(width>=1100){for(const group of groups){assert.ok(await group.$eval('summary',element=>element.getBoundingClientRect().height>=44));if(!await group.evaluate(element=>element.open))await page.locator(nav+' details summary').click();}}else assert.ok(await page.$eval(nav+' select',element=>element.getBoundingClientRect().height>=44));
 const initialRequestCount=requests.length,initialFormCount=await page.$$eval('form',elements=>elements.length);
 for(const id of expected){await showWorkspaceSection(page,id);await page.waitForFunction(target=>document.activeElement.id===target,{},id);assert.equal(await page.evaluate(()=>document.activeElement.id),id);assert.equal(await page.evaluate(()=>location.hash),'#'+id);}
 await page.waitForNetworkIdle({idleTime:100,timeout:15000});assert.equal(participantReads,1);assert.equal(requests.length,initialRequestCount+participantReads);assert.equal(posts.length,0);assert.equal(await page.$$eval('form',elements=>elements.length),initialFormCount);
 if(width<1100){await showWorkspaceSection(page,'workspace-home-title');await page.focus(nav+' select');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');}else{const keyboard=await page.$(nav+' a[href="#schedule-title"]');await keyboard.focus();await page.keyboard.press('Enter');}await page.waitForFunction(()=>document.activeElement.id==='schedule-title');assert.equal(await page.evaluate(()=>document.activeElement.id),'schedule-title');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 checks.push('navigation-authorized-canonical-destinations-keyboard-no-requests-'+role+'-'+width);
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
  assert.equal(requests.length,initialRequestCount+participantReads);assert.equal(posts.length,0);
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(button=>button.textContent==='Actualizar'||button.textContent.includes('Obra de prueba B')).every(button=>button.disabled)));
  await assertClosedPendingNavigation(page,width,'schedule-edit-title',requests,posts);
  checks.push('long-schedule-editor-focus-and-pending-navigation-preserve-draft-'+width);
  await page.screenshot({path:path.join(evidence,'workspace-pending-editor-'+width+'.png'),fullPage:false});
  await (await page.$(nav)).screenshot({path:path.join(evidence,'workspace-pending-navigation-'+width+'.png')});
  await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('#schedule-edit-title'));
  assert.equal(await page.$(nav+' a[href="#schedule-edit-title"]'),null);
  assert.equal(posts.length,0);checks.push('cancel-clears-pending-navigation-without-mutation-'+width);
 }
 await context.close();
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
 const requestFacts=rows=>rows.map(({method,path,query})=>({method,path,query}));
 const projectRead=(projectId,cursor=null)=>({method:'GET',path:'/api/identity/workspace',query:'?'+new URLSearchParams({projectId,scope,...(cursor?{afterTask:cursor}:{})})});
 // This rendering fixture intentionally includes malformed progress, short
 // pages and incomplete canonical metadata. Live refresh must reject it
 // without replacing the loaded tasks or accepting its invalid protocol.
 const waitLiveRejection=async()=>{await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='STALE',{timeout:15000});assert.match(await page.$eval('[data-worksite-live-refresh]',element=>element.innerText),/No pudimos actualizar esta consulta\. Conservamos los datos/);};
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();
   requests.push({phase,method:request.method(),path:url.pathname,query:url.search});
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
    body={scope,project:{id:projectId,name:projectId==='p-a'?'Obra de prueba A':'Obra de prueba B'},canPlanSchedule:true,tasks,totalTasks,nextCursor};
   }
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode,width,phase,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo del cronograma');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());
  await showWorkspaceSection(page,'schedule-title');
  await page.waitForSelector('[data-schedule-workbench]');await waitWorkbenchTasks(page,workbenchTasks().map(task=>task.id));
  await waitLiveRejection();
  assert.deepEqual(requestFacts(requests),[{method:'GET',path:'/api/identity/workspace',query:''},projectRead('p-a'),projectRead('p-a')],'Opening the project includes its one eligible live read');
  const initialRequests=requests.length;let localRequestBaseline=initialRequests;
  const assertLocalControls=()=>{assert.equal(requests.length,localRequestBaseline);assert.equal(posts.length,0);};
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
  checks.push('workbench-accent-insensitive-search-combined-filters-no-requests-'+width);

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
  await page.screenshot({path:path.join(evidence,'workspace-workbench-draft-'+width+'.png'),fullPage:false});
  phase='draft-cancel-live-resume';const beforeCancel=requests.length;await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('#schedule-edit-title'));await waitLiveRejection();
  assert.deepEqual(requestFacts(requests.slice(beforeCancel)),[projectRead('p-a')],'Cancelling the draft resumes one canonical live eligibility read');assert.equal(posts.length,0);localRequestBaseline=requests.length;

  phase='pagination-with-filters';await click(page,'Limpiar filtros');await searchWorkbench(page,'mamposteria');await page.select(workbenchControl.status,'IN_PROGRESS');await page.select(workbenchControl.planning,'VALID');await page.select(workbenchControl.order,'START_ASC');await waitWorkbenchTasks(page,['wb-mamp-a']);assertLocalControls();
  const beforePagination=requests.length;await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await waitWorkbenchTasks(page,['wb-page-two-match','wb-mamp-a']);
  // The new generation rechecks the retained pages. Its first response is
  // deliberately invalid for the canonical live-page protocol, so it must
  // stop there and leave the explicitly merged task unchanged.
  await waitLiveRejection();const paginationRequests=requests.slice(beforePagination);
  assert.deepEqual(requestFacts(paginationRequests),[projectRead('p-a','controlled-page-2'),projectRead('p-a')],'One explicit append plus one rejected canonical live read');
  assert.equal(new URL(origin+paginationRequests[0].path+paginationRequests[0].query).searchParams.get('afterTask'),'controlled-page-2');assert.equal(posts.length,0);
  const afterPagination=requests.length;
  assert.equal(await page.$eval(workbenchControl.search,element=>element.value),'mamposteria');for(const [control,value] of [['status','IN_PROGRESS'],['planning','VALID'],['order','START_ASC']])assert.equal(await page.$eval(workbenchControl[control],element=>element.value),value);
  await waitText(page,'Mostrando 2 de 8 tareas cargadas');assert.equal(await page.$$eval('[data-task-id="wb-mamp-a"]',elements=>elements.length),1);assert.match(await page.$eval('[data-task-id="wb-mamp-a"]',element=>element.innerText),/41 %/);
   assert.match(await page.$eval('[data-gantt-task-id="wb-mamp-a"]',element=>element.innerText),/41 % registrado/);
  await click(page,'Limpiar filtros');assert.equal((await workbenchTaskIds(page)).length,8);assert.equal(new Set(await workbenchTaskIds(page)).size,8);assert.equal(requests.length,afterPagination);
  checks.push('workbench-pagination-keeps-filters-and-merges-canonical-task-id-'+width);

  phase='project-reset';await searchWorkbench(page,'mamposteria');await page.select(workbenchControl.status,'IN_PROGRESS');await page.select(workbenchControl.planning,'VALID');await page.select(workbenchControl.order,'TITLE_ASC');
  const beforeProject=requests.length;await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());await waitWorkbenchTasks(page,['wb-project-b']);await waitLiveRejection();
  assert.deepEqual(requestFacts(requests.slice(beforeProject)),[projectRead('p-b'),projectRead('p-b')],'Project selection and its one eligible live read stay in the new project');assert.equal(new URL(origin+requests.at(-1).path+requests.at(-1).query).searchParams.get('projectId'),'p-b');assert.equal(posts.length,0);assert.equal(await page.$eval(workbenchControl.search,element=>element.value),'');
  for(const [control,value] of [['status','ALL'],['planning','ALL'],['order','REGISTERED']])assert.equal(await page.$eval(workbenchControl[control],element=>element.value),value);
  await waitText(page,'Mostrando 1 de 1 tareas cargadas');assert.match(await page.$eval('#schedule-overview-title',element=>element.parentElement.innerText),/parcial/i);
   assert.equal(await page.$eval('[data-gantt-scroll]',element=>element.dataset.ganttScale),'WEEKS');assert.match(await page.$eval('[data-schedule-gantt]',element=>element.innerText),/Vista parcial/);
  assert.equal(await page.$$eval('button',elements=>elements.filter(element=>element.textContent.trim()==='Cargar más tareas').length),0);
  const partialResult=await page.$eval('[data-schedule-workbench] [role="status"]',element=>element.innerText);assert.ok(!partialResult.includes('Podés cargar más'));assert.ok(partialResult.includes('Actualizá la consulta y volvé a abrir la obra para comprobar el total.'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Final workbench overflow at '+width);
  const targets=await page.$$eval('[data-schedule-workbench] input,[data-schedule-workbench] select,[data-schedule-workbench] button',elements=>elements.map(element=>({label:element.getAttribute('aria-label')||element.textContent.trim(),height:element.getBoundingClientRect().height,width:element.getBoundingClientRect().width})));assert.ok(targets.length>=5);assert.ok(targets.every(target=>target.height>=44&&target.width>=44),JSON.stringify(targets));
  checks.push('workbench-project-reset-partial-total-and-touch-targets-'+width);
  await (await page.$('[data-schedule-workbench]')).screenshot({path:path.join(evidence,'workspace-workbench-project-b-'+width+'.png')});
  writeFileSync(path.join(evidence,'workspace-workbench-requests-'+width+'.json'),JSON.stringify({width,initialRequests,requests,posts:posts.length,canonicalLiveFixtureRejected:true},null,2));
 }catch(error){
  await page.screenshot({path:path.join(evidence,'workspace-workbench-failure-'+width+'.png'),fullPage:false}).catch(()=>{});
  writeFileSync(path.join(evidence,'workspace-workbench-failure-'+width+'.json'),JSON.stringify({status:'FAILED',phase,width,message:error.message,requests,postCount:posts.length,body:await text(page).catch(()=>null)},null,2));throw error;
 }finally{await context.close();}
}
async function ganttVolumeScenario(width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000,hasTouch:width<768});
 const mode='gantt-volume',requests=[],posts=[];page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const projectRead=(cursor=null)=>({method:'GET',path:'/api/identity/workspace',query:'?'+new URLSearchParams({projectId:'p-a',scope,...(cursor?{afterTask:cursor}:{})})});
 const expectedRequests=[{method:'GET',path:'/api/identity/workspace',query:''},projectRead(),projectRead(),projectRead('volume-page-2'),projectRead(),projectRead('volume-page-3'),projectRead()];
 // This rendering fixture is deliberately incomplete for the canonical live
 // protocol. Each new page resumes one live read, which must reject it and
 // preserve the explicitly loaded rows rather than promote it to CURRENT.
 const waitLiveRejection=async expectedCount=>{
  await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='STALE',{timeout:15000});
  assert.match(await page.$eval('[data-worksite-live-refresh]',element=>element.innerText),/No pudimos actualizar esta consulta\. Conservamos los datos/);
  await page.waitForNetworkIdle({idleTime:100,concurrency:0,timeout:15000});
  assert.equal(await page.$eval('[data-worksite-live-refresh]',element=>element.dataset.worksiteLiveRefresh),'STALE');
  assert.match(await page.$eval('[data-worksite-live-refresh]',element=>element.innerText),/No pudimos actualizar esta consulta\. Conservamos los datos/);
  assert.deepEqual(requests,expectedRequests.slice(0,expectedCount));assert.equal(posts.length,0);
 };
 const tasks=Array.from({length:240},(_,index)=>({...baseTask(),id:'volume-'+String(index).padStart(3,'0'),title:'Partida revisada '+(index+1),progress:index%101,startsOn:'2000-01-01',endsOn:'2100-12-31'}));
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();
   requests.push({method:request.method(),path:url.pathname,query:url.search});
   if(request.method()!=='GET'){posts.push(request.postData());throw new Error('Gantt volume navigation must not mutate a business record');}
   assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   let body;
   if(!url.search)body={scope,organizationName:'Empresa de volumen sintético',role:'AUDITOR',roleLabel:'Auditor',canPlanSchedule:false,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};
   else{
    assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.get('scope'),scope);
    const cursor=url.searchParams.get('afterTask');assert.ok([null,'volume-page-2','volume-page-3'].includes(cursor));
    const start=cursor==='volume-page-2'?100:cursor==='volume-page-3'?200:0;
    body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:false,tasks:tasks.slice(start,start+100),totalTasks:300,nextCursor:start===0?'volume-page-2':start===100?'volume-page-3':null};
   }
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de volumen sintético');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());
  await showWorkspaceSection(page,'schedule-title');await waitText(page,'Mostrando 100 de 100 tareas cargadas');await waitLiveRejection(3);
  await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await waitText(page,'Mostrando 200 de 200 tareas cargadas');await waitLiveRejection(5);
  await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await waitText(page,'Mostrando 240 de 240 tareas cargadas');await waitLiveRejection(7);
  assert.deepEqual(requests,expectedRequests);assert.equal(posts.length,0);
  assert.equal(await page.$$eval('[data-gantt-task-id]',elements=>elements.length),240);
  assert.equal(await page.$$eval('[data-task-id]',elements=>elements.length),240);
  assert.match(await page.$eval('[data-schedule-gantt]',element=>element.innerText),/Vista parcial: sólo tareas cargadas/);
  assert.match(await page.$eval('#schedule-overview-title',element=>element.parentElement.innerText),/Resumen parcial/);
  assert.match(await page.$eval('[data-schedule-workbench]',element=>element.innerText),/240 de 300 tareas cargadas/);
  assert.equal(await page.$$eval('button',elements=>elements.filter(element=>element.textContent==='Planificar fechas').length),0);
  for(const [label,scale,maxCells] of [['Días','DAYS',28],['Semanas','WEEKS',12],['Meses','MONTHS',12]]){
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
  await page.waitForNetworkIdle({idleTime:100,concurrency:0,timeout:15000});
  assert.deepEqual(requests,expectedRequests,'Gantt zoom, interval and scroll controls must not make additional requests');assert.equal(posts.length,0);
  checks.push('gantt-240-paginated-rows-century-bounded-axis-all-zooms-contained-scroll-partial-readonly-'+width);
 }catch(error){await page.screenshot({path:path.join(evidence,'workspace-gantt-volume-failure-'+width+'.png'),fullPage:false}).catch(()=>{});throw error;}
 finally{await context.close();}
}
async function taskCreateScenario(mode){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width:390,height:1000});page.on('pageerror',error=>pageErrors.push({mode:'taskcreate-'+mode,width:390,message:error.message}));
 const posts=[];let record=null,applications=0,statusChecks=0,scheduleReadsAfterCommit=0;await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!['/api/identity/workspace','/api/identity/task-creation'].includes(url.pathname))return request.continue();assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');let status=200,body;
   if(url.pathname==='/api/identity/workspace'){
    if(!url.search)body={scope,organizationName:'Organización de prueba sintética',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false};
    else {assert.equal(url.searchParams.get('projectId'),'p-a');if(record)scheduleReadsAfterCommit++;body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:record?[baseTask(),record.task]:[baseTask()],totalTasks:record?2:1,nextCursor:null};}
   }else if(request.method()==='POST'){
    const input=JSON.parse(request.postData());posts.push(input);assert.deepEqual(Object.keys(input).sort(),['operationId','projectId','scope','title','startsOn','endsOn'].sort());assert.equal(input.projectId,'p-a');assert.equal(input.scope,scope);assert.equal(input.title,'Tarea de ensayo recuperable');assert.equal(input.startsOn,'');assert.equal(input.endsOn,'');
    if(mode==='not-arrived'&&posts.length===1){await request.abort('failed');return;}
    else if(mode==='rollback'&&posts.length===1){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED'};}
    else {applications++;record={scope,created:true,replayed:false,receiptId:'workspace_new_task_'+input.operationId,task:{id:'new-task',title:input.title,status:'BACKLOG',progress:0,startsOn:null,endsOn:null,revision:'2026-10-01T12:00:00.111111'}};body=record;if(mode==='uncertain'){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED'};}}
   }else {statusChecks++;assert.equal(url.searchParams.get('operationId'),posts[0].operationId);body=record?{...record,state:'RECORDED'}:{scope,state:'NOT_OBSERVED',definitive:false};}
   await request.respond({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Cache-Control':'no-store'}});
  }catch(error){pageErrors.push({mode:'taskcreate-'+mode,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Organización de prueba sintética');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Obra de prueba A')).click());await showWorkspaceSection(page,'schedule-title');await waitText(page,'Mampostería');await showWorkspaceSection(page,'schedule-title');await click(page,'Nueva tarea');await page.type('form input:not([type="date"])','Tarea de ensayo recuperable');assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')||b.textContent==='Planificar fechas').every(b=>b.disabled)));assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input')].every(e=>!e.disabled)));
 if(mode==='draft-cancel'){await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('form')&&[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')||b.textContent==='Planificar fechas').every(b=>!b.disabled));assert.equal(posts.length,0);checks.push('taskcreate-draft-locks-project-and-refresh-until-explicit-cancel');await context.close();return;}
 await click(page,'Crear tarea');await waitText(page,'La confirmación no llegó');assert.equal(posts.length,1);
 assert.ok(!(await text(page)).includes('Reintentar la misma creación'));
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')||b.textContent==='Planificar fechas').every(b=>b.disabled)));
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input')].every(e=>e.disabled)));await click(page,'Comprobar tarea');
 if(mode==='uncertain'){await waitText(page,'Tarea creada y vinculada');assert.equal(posts.length,1);checks.push('taskcreate-uncertain-commit-recovers-without-second-post');}
 else {await waitText(page,'No se observa un recibo todavía');assert.equal(posts.length,1);assert.equal(await page.$eval('form input',e=>e.value),'Tarea de ensayo recuperable');assert.ok(await page.$eval('form input',e=>e.disabled));await click(page,'Reintentar la misma creación');await waitText(page,'Tarea creada y vinculada');assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);checks.push('taskcreate-'+mode+'-checked-then-exact-retry-once');}
 await page.waitForSelector('[data-task-id="new-task"]');assert.equal(statusChecks,1);assert.equal(applications,1);assert.equal(scheduleReadsAfterCommit,1);assert.equal(await page.$$eval('[data-task-id="new-task"]',nodes=>nodes.length),1);assert.ok((await text(page)).includes('Mostrando 2 de 2 tareas cargadas'));
 const createdProgress=await page.$eval('[data-task-id="new-task"]',element=>({text:element.innerText.replace(/\s+/g,' '),bars:[...element.querySelectorAll('[role="progressbar"]')].map(bar=>bar.getAttribute('aria-valuenow'))}));assert.ok(createdProgress.text.includes('Avance registrado: 0 %'));assert.deepEqual(createdProgress.bars,['0']);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
}
// These directors have no owned participant identity. Match reviewAccess()'s
// producer preimage; task/proposal/schedule revisions do not rotate authority.
function progressReviewFixture(field,{name,getPhase,phases}){
 assert.deepEqual(field.selfWorkers,[]);assert.equal(field.canReview,true);assert.equal(field.canApproveProgress,true);
 field.reviewAccessStamp=createHash('sha256').update(JSON.stringify(['field-review-access-v1',field.scope,field.projectId,true,true,[]])).digest('hex');
 const facts=[],allowedPhases=new Set(phases);let assertedFactCount=null;
 const inspect=(request,url)=>{
  const fact={phase:getPhase(),method:request.method(),path:url.pathname,query:url.search,authorization:request.headers().authorization};facts.push(fact);
  assert.ok(allowedPhases.has(fact.phase),'Field request outside an explicit scenario phase');assert.equal(fact.path,'/api/identity/field-operations');assert.equal(fact.authorization,'Bearer synthetic-active-tab-A');
  if(fact.method==='POST'){assert.equal(url.search,'');fact.kind='DECIDE_PROGRESS';return {kind:fact.kind};}
  assert.equal(fact.method,'GET');assert.equal(url.searchParams.get('scope'),field.scope);assert.equal(url.searchParams.get('projectId'),field.projectId);
  const keys=[...url.searchParams.keys()].sort();
  if(url.searchParams.has('operationId')){assert.deepEqual(keys,['operationId','projectId','scope']);fact.kind='RECEIPT';fact.operationId=url.searchParams.get('operationId');return {kind:fact.kind};}
  const access={reviewAccessStamp:field.reviewAccessStamp,canReview:field.canReview,canApproveProgress:field.canApproveProgress};
  fact.access={...access};fact.proposals=field.proposals.map(({id,status,revision})=>({id,status,revision}));
  if(!url.searchParams.has('reviewSection')){assert.deepEqual(keys,['projectId','scope']);fact.kind='BASE';return {kind:fact.kind,body:field};}
  assert.deepEqual(keys,['projectId','reviewAccessStamp','reviewFilter','reviewSection','scope']);assert.equal(url.searchParams.get('reviewAccessStamp'),field.reviewAccessStamp);assert.equal(url.searchParams.get('reviewSection'),'PROGRESS');assert.equal(url.searchParams.get('reviewFilter'),'ALL');
  assert.ok(facts.slice(0,-1).some(row=>row.kind==='BASE'),'A review read must follow a base authority snapshot');
  const expected={scope:field.scope,projectId:field.projectId,reviewAccessStamp:field.reviewAccessStamp,reviewSection:'PROGRESS',reviewFilter:'ALL'};
  const body={...expected,afterReview:null,reviewId:null,records:field.proposals.map(row=>({...row})),total:field.proposals.length,nextCursor:null,canReview:field.canReview,canApproveProgress:field.canApproveProgress};
  fact.kind='PROGRESS_ALL';fact.access={...access};return {kind:fact.kind,body};
 };
 const waitCurrent=async page=>{
  await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="field-title"] [data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='CURRENT',{timeout:15000});
  assert.deepEqual(facts.map(row=>row.kind),['BASE','BASE','PROGRESS_ALL'],'Opening Avance must complete BASE then the live BASE and canonical PROGRESS/ALL before any command');
 };
 const assertComplete=operationIds=>{
  assert.equal(facts[0]?.kind,'BASE');assert.equal(facts.filter(row=>row.method==='POST').length,1,'Exactly one field decision POST, without replay');
  assert.deepEqual(facts.filter(row=>row.kind==='RECEIPT').map(row=>row.operationId),operationIds);
  for(const fact of facts){assert.ok(allowedPhases.has(fact.phase));if(fact.access)assert.deepEqual(fact.access,{reviewAccessStamp:field.reviewAccessStamp,canReview:true,canApproveProgress:true});}
  assertedFactCount=facts.length;
 };
 const write=()=>writeFileSync(path.join(evidence,name+'-field-ledger.json'),JSON.stringify({schema:'workspace-progress-field-fixture-ledger.v1',phases,authorityPreimage:['field-review-access-v1',field.scope,field.projectId,true,true,[]],assertedFactCount,complete:assertedFactCount!==null&&assertedFactCount===facts.length,facts},null,2)+'\n');
 return {facts,inspect,waitCurrent,assertComplete,write};
}
async function confirmedProgressScenario(mode,width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode:'confirmed-progress-'+mode,width,message:error.message}));
 const planningMode=mode==='planning',beforeRevision='2026-10-02T09:00:00.000001',afterRevision='2026-10-02T09:00:00.000010',latestRevision='2026-10-02T09:00:00.000020';
 const original={...baseTask(),revision:beforeRevision},created={id:'new-task',title:'Tarea de ensayo concurrente',status:'BACKLOG',progress:0,startsOn:null,endsOn:null,revision:beforeRevision};
 const proposal={id:'proposal-a',taskId:original.id,workerId:'worker-a',summary:'Avance medido sintético',status:'PENDING',revision:planningMode?'2026-10-02T09:00:00.000011':'2026-10-02T09:00:00.000005',progress:50,quantity:null,baseline:null,unit:null,reason:'Medición sintética revisada.',evidenceIds:['evidence-a']};
 const field={scope,projectId:'p-a',projectRevision:beforeRevision,configurationRevision:null,canConfigure:true,canReview:true,canApproveProgress:true,selfWorkers:[],workers:[{id:'worker-a',name:'Participante sintético'}],sectors:[],attendance:[],incidents:[],materialRequests:[],truncated:false,proposals:planningMode?[]:[proposal],evidence:[{id:'evidence-a',taskId:original.id,workerId:'worker-a',title:'Evidencia sintética aprobada',caption:'Fuente sintética de la medición.',status:'APPROVED',revision:beforeRevision,media:{kind:'image',contentType:'image/png',bytes:64,sha256:'b'.repeat(64)},processing:{status:'NOT_REQUESTED'}}]};
 const scheduleFacts=[];let phase='initial-project';
 const fieldFixture=progressReviewFixture(field,{name:'workspace-confirmed-progress-'+mode+'-'+width,getPhase:()=>phase,phases:planningMode?['planning-held','planning-live']:['field-before-command','creation-form-live','creation-readback-held','field-decision-callback','confirmed-readback-live',...(mode==='callback'?['confirmed-callback-navigation-live']:[]),'explicit-pagination-live']});
 const projectQuery=cursor=>'?'+new URLSearchParams({projectId:'p-a',scope,...(cursor?{afterTask:cursor}:{})});
 const expectedPhaseReads=new Map();
 const assertPhaseReads=cursors=>{const expected=cursors.map(cursor=>({phase,method:'GET',path:'/api/identity/workspace',query:cursor==='ACCOUNT'?'':projectQuery(cursor)}));assert.deepEqual(scheduleFacts.filter(row=>row.phase===phase),expected);if(expectedPhaseReads.has(phase))assert.deepEqual(expectedPhaseReads.get(phase),expected);expectedPhaseReads.set(phase,expected);};
 const assertAllSchedulePhases=()=>{assert.deepEqual(scheduleFacts.filter(row=>!expectedPhaseReads.has(row.phase)),[],'Every workspace GET must belong to an asserted phase');for(const [name,expected]of expectedPhaseReads)assert.deepEqual(scheduleFacts.filter(row=>row.phase===name),expected,'No later GET may escape an already asserted phase '+name);};
 const waitRejectedLive=async()=>{await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='STALE',{timeout:15000});await page.waitForNetworkIdle({idleTime:100,concurrency:0,timeout:15000});assert.equal(await page.$eval('[data-worksite-live-refresh]',el=>el.dataset.worksiteLiveRefresh),'STALE');assert.match(await page.$eval('[data-worksite-live-refresh]',el=>el.innerText),/No pudimos actualizar esta consulta\. Conservamos los datos/);};
 // Observe each real live GET before its trigger; cancellation drains a failed action's waiter.
 const observeScheduleLiveRead=()=>{
  const expectedPhase=phase,abort=new AbortController();
  const request=page.waitForRequest(request=>{
   const url=new URL(request.url());
   if(url.origin!==origin||request.method()!=='GET'||url.pathname!=='/api/identity/workspace'||url.search!==projectQuery(null))return false;
   assert.equal(phase,expectedPhase);assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');return true;
  },{timeout:15000,signal:abort.signal});
  request.catch(()=>{});
  return {request,cancel:()=>abort.abort()};
 };
 const posts=[];let creation=null,heldReadback=null,heldDecision=null,heldPlanning=null,readbackCount=0,preparationReads=0;
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
     const task={...original,startsOn:input.startsOn,endsOn:input.endsOn,revision:afterRevision};
     heldPlanning={request,outcome:{scope,saved:true,replayed:false,task,receipt:{id:'workspace_schedule_'+ 'd'.repeat(64),taskId:original.id,recordedAt:afterRevision,before:{startsOn:original.startsOn,endsOn:original.endsOn},after:{startsOn:task.startsOn,endsOn:task.endsOn}}}};
     // The worker creates this proposal after the planning transaction committed,
     // using the current r1 task even though the director's r1 reply is retained.
     field.proposals=[{...proposal,taskRevision:afterRevision}];planningStarted();return;
    }
    assert.equal(request.method(),'GET');scheduleFacts.push({phase,method:request.method(),path:url.pathname,query:url.search});
    if(!url.search)return respond(request,{scope,organizationName:'Empresa de ensayo concurrente',role:'DIRECTOR',roleLabel:'Director de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false});
    assert.equal(request.method(),'GET');assert.deepEqual([...url.searchParams.keys()].sort(),url.searchParams.has('afterTask')?['afterTask','projectId','scope']:['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');
    // Hold only the creation's explicit canonical readback. Later first-page
    // live reads get the unchanged, deliberately incomplete rendering fixture.
    if(creation&&!url.searchParams.has('afterTask')&&readbackCount===0){assert.equal(phase,'creation-readback-held');assert.equal(heldReadback,null);heldReadback=request;readbackCount++;readbackStarted();return;}
    const tasks=url.searchParams.has('afterTask')?[{...created,id:'tail-task',title:'Última tarea autorizada'}]:[original];
    return respond(request,{scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks,totalTasks:creation?3:1,nextCursor:null});
   }
   if(url.pathname==='/api/identity/field-operations'){const read=fieldFixture.inspect(request,url);if(request.method()==='GET'){assert.notEqual(read.kind,'RECEIPT','This scenario never recovers a receipt');return respond(request,read.body);}}
   assert.equal(request.method(),'POST');assert.equal(url.search,'');
   const input=JSON.parse(request.postData());posts.push({path:url.pathname,input});assert.equal(input.scope,scope);assert.equal(input.projectId,'p-a');
   if(url.pathname==='/api/identity/task-creation'){
    assert.equal(input.title,created.title);creation={scope,created:true,replayed:false,receiptId:'workspace_new_task_'+input.operationId,task:created};return respond(request,creation);
   }
   assert.equal(input.action,'DECIDE_PROGRESS');assert.equal(input.payload.proposalId,proposal.id);assert.equal(input.payload.revision,proposal.revision);assert.equal(input.payload.decision,'APPROVE');
   field.proposals=[{...proposal,status:'APPLIED',revision:planningMode?latestRevision:afterRevision}];
   const task={...(planningMode?heldPlanning.outcome.task:original),status:'IN_PROGRESS',progress:50,revision:planningMode?latestRevision:afterRevision};
   const outcome={scope,saved:true,replayed:false,receiptId:'field_'+ 'c'.repeat(64),kind:'PROGRESS_DECISION',proposal:field.proposals[0],task};
   heldDecision={request,outcome};decisionStarted();if(mode!=='callback')return respond(request,outcome);
  }catch(error){pageErrors.push({mode:'confirmed-progress-'+mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo concurrente');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');
  await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="project-preparation-title"]')?.getAttribute('aria-busy')==='false',{timeout:15000});assert.equal(preparationReads,1);
  await waitRejectedLive();assertPhaseReads(['ACCOUNT',null,null]);phase='field-before-command';
  if(planningMode){phase='planning-held';await showWorkspaceSection(page,'schedule-title');await fill(page);await click(page,'Confirmar planificación');await planningReady;}
  await showWorkspaceSection(page,'field-title');await click(page,'Abrir operaciones');await page.waitForSelector('nav[aria-label="Operaciones de campo"]');await click(page,'Avance');await waitText(page,'Decidir propuesta');
  if(planningMode){await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="field-title"] [data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='PAUSED',{timeout:15000});assert.deepEqual(fieldFixture.facts.map(row=>row.kind),['BASE']);}else await fieldFixture.waitCurrent(page);
  assertPhaseReads([]);
  if(!planningMode){phase='creation-form-live';await showWorkspaceSection(page,'schedule-title');await waitRejectedLive();assertPhaseReads([null]);await click(page,'Nueva tarea');await page.type('section[aria-label="Crear tarea de la obra"] form input:not([type="date"])',created.title);phase='creation-readback-held';await click(page,'Crear tarea');await readbackReady;assertPhaseReads([null]);phase='field-decision-callback';}
  await showWorkspaceSection(page,'field-title');await click(page,'Decidir propuesta');await page.type('section[aria-labelledby="field-title"] form textarea','Aprobación sintética independiente.');await click(page,'Guardar con recibo');await decisionReady;
  if(planningMode){
   await page.waitForFunction(()=>document.querySelector('[data-task-id="task-a"] [role="progressbar"]').getAttribute('aria-valuenow')==='50');
   assertPhaseReads([]);phase='planning-live';await respond(heldPlanning.request,heldPlanning.outcome);await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cambio confirmado');await waitRejectedLive();assertPhaseReads([null]);
   assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),50);
   assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),['2026-10-07','2026-10-15']);
   assert.equal(posts.length,2);assert.equal(readbackCount,0);assert.ok((await text(page)).includes('1 de 1 tareas cargadas'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await showWorkspaceSection(page,'schedule-title');await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,`workspace-confirmed-progress-planning-${width}.png`)});
   assertAllSchedulePhases();fieldFixture.assertComplete([]);assert.deepEqual(posts.map(row=>row.path),['/api/identity/workspace','/api/identity/field-operations']);checks.push('schedule-delayed-planning-reply-keeps-current-dates-and-progress-'+width);return;
  }
  const readbackTask=mode==='readback'?original:{...original,revision:latestRevision,progress:70};
  if(mode==='readback')await page.waitForFunction(()=>document.querySelector('[data-task-id="task-a"] [role="progressbar"]').getAttribute('aria-valuenow')==='50');
  assertPhaseReads([]);phase='confirmed-readback-live';await respond(heldReadback,{scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:[readbackTask,created],totalTasks:3,nextCursor:created.id});
  await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cronograma actualizado desde los registros de la obra.');
  if(mode==='callback'){
   // Confirmation clears the pending field operation while the schedule is visible.
   const callbackRead=observeScheduleLiveRead();
   try{await respond(heldDecision.request,heldDecision.outcome);await callbackRead.request;await waitRejectedLive();assertPhaseReads([null]);}
   finally{callbackRead.cancel();await callbackRead.request.catch(()=>{});}
   phase='confirmed-callback-navigation-live';
   await showWorkspaceSection(page,'field-title');await waitText(page,'Decisión guardada.');
   // Returning to the schedule enables its separate live check.
   const navigationRead=observeScheduleLiveRead();
   try{await showWorkspaceSection(page,'schedule-title');await navigationRead.request;}
   finally{navigationRead.cancel();await navigationRead.request.catch(()=>{});}
  }
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Cargar más tareas'&&!button.disabled));
  await waitRejectedLive();assertPhaseReads([null]);
  const expected=mode==='readback'?50:70;
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),expected);
  assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),[original.startsOn,original.endsOn]);
  assert.ok((await text(page)).includes('2 de 3 tareas cargadas'));assert.equal(readbackCount,1);assert.equal(posts.length,2);
  phase='explicit-pagination-live';await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await page.waitForSelector('[data-task-id="tail-task"]');await waitRejectedLive();assertPhaseReads([created.id,null]);assert.ok((await text(page)).includes('3 de 3 tareas cargadas'));
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),expected);assert.equal(posts.length,2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await showWorkspaceSection(page,'schedule-title');await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,`workspace-confirmed-progress-${mode}-${width}.png`)});
  assertAllSchedulePhases();fieldFixture.assertComplete([]);assert.deepEqual(posts.map(row=>row.path),['/api/identity/task-creation','/api/identity/field-operations']);checks.push((mode==='readback'?'schedule-delayed-readback-keeps-confirmed-progress-':'schedule-delayed-decision-callback-keeps-newer-get-')+width);
 }catch(error){error.workspaceUiDiagnostic={mode:'confirmed-progress-'+mode,width,phase,scheduleFacts,fieldFacts:fieldFixture.facts,readbackCount,preparationReads,postPaths:posts.map(row=>row.path)};await page.screenshot({path:path.join(evidence,`workspace-confirmed-progress-${mode}-failure-${width}.png`),fullPage:false}).catch(()=>{});throw error;}
 finally{for(const request of [heldReadback,heldDecision?.request,heldPlanning?.request])if(request&&!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});await context.close();fieldFixture.write();}
}
async function unloadedConfirmedProgressScenario(width,decision){
 const mode='confirmed-progress-unloaded-'+decision.toLowerCase(),context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const beforeRevision='2026-10-02T09:00:00.000001',afterRevision='2026-10-02T09:00:00.000010',currentRevision='2026-10-02T09:00:00.000020',cursor='unloaded-progress-cursor';
 const original={...baseTask(),revision:beforeRevision},outside={id:'task-outside',title:'Demolición de portería',status:'BACKLOG',progress:0,startsOn:'2026-10-06',endsOn:'2026-10-12',revision:beforeRevision};
 const proposal={id:'proposal-outside',taskId:outside.id,workerId:'worker-a',summary:'Medición de la tarea de otra página',status:'PENDING',revision:'2026-10-02T09:00:00.000005',progress:25,quantity:null,baseline:null,unit:null,reason:'Medición sintética de otro participante.',evidenceIds:['evidence-outside']};
 const field={scope,projectId:'p-a',projectRevision:beforeRevision,configurationRevision:null,canConfigure:true,canReview:true,canApproveProgress:true,selfWorkers:[],workers:[{id:'worker-a',name:'Participante sintético'}],sectors:[],attendance:[],incidents:[],materialRequests:[],truncated:false,proposals:[proposal],evidence:[{id:'evidence-outside',taskId:outside.id,workerId:'worker-a',title:'Evidencia sintética aprobada',caption:'Fuente revisada de otro participante.',status:'APPROVED',revision:beforeRevision,media:{kind:'image',contentType:'image/png',bytes:64,sha256:'b'.repeat(64)},processing:{status:'NOT_REQUESTED'}}]};
 const scheduleFacts=[];let phase='initial-project';
 const fieldFixture=progressReviewFixture(field,{name:mode+'-'+width,getPhase:()=>phase,phases:['field-decision-callback','inspect-unloaded-schedule','receipt-navigation-live','explicit-unloaded-pagination-live','loaded-task-navigation-live','final-schedule']});
 const projectQuery=cursor=>'?'+new URLSearchParams({projectId:'p-a',scope,...(cursor?{afterTask:cursor}:{})});
 const expectedPhaseReads=new Map();
 const assertPhaseReads=cursors=>{const expected=cursors.map(cursor=>({phase,method:'GET',path:'/api/identity/workspace',query:cursor==='ACCOUNT'?'':projectQuery(cursor)}));assert.deepEqual(scheduleFacts.filter(row=>row.phase===phase),expected);if(expectedPhaseReads.has(phase))assert.deepEqual(expectedPhaseReads.get(phase),expected);expectedPhaseReads.set(phase,expected);};
 const assertAllSchedulePhases=()=>{assert.deepEqual(scheduleFacts.filter(row=>!expectedPhaseReads.has(row.phase)),[],'Every workspace GET must belong to an asserted phase');for(const [name,expected]of expectedPhaseReads)assert.deepEqual(scheduleFacts.filter(row=>row.phase===name),expected,'No later GET may escape an already asserted phase '+name);};
 const waitRejectedLive=async()=>{await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='STALE',{timeout:15000});await page.waitForNetworkIdle({idleTime:100,concurrency:0,timeout:15000});assert.equal(await page.$eval('[data-worksite-live-refresh]',el=>el.dataset.worksiteLiveRefresh),'STALE');assert.match(await page.$eval('[data-worksite-live-refresh]',el=>el.innerText),/No pudimos actualizar esta consulta\. Conservamos los datos/);};
 // Every workspace GET is retained. The cursor ledger counts every append
 // separately; selection and live first-page reads are fenced by phase.
 const posts=[],cursorReads=[],receiptQueries=[];let recorded=null,currentTask=null,preparationReads=0;
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
    scheduleFacts.push({phase,method:request.method(),path:url.pathname,query:url.search});
    if(!url.search)return respond(request,{scope,organizationName:'Empresa de ensayo paginada',role:'DIRECTOR',roleLabel:'Director de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false});
    assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');assert.deepEqual([...url.searchParams.keys()].sort(),url.searchParams.has('afterTask')?['afterTask','projectId','scope']:['projectId','scope']);if(url.searchParams.has('afterTask'))cursorReads.push({phase,method:request.method(),path:url.pathname,query:url.search});
    if(url.searchParams.has('afterTask')){assert.equal(decision,'APPROVE');assert.equal(url.searchParams.get('afterTask'),cursor);assert.ok(currentTask);return respond(request,{scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:[currentTask],totalTasks:2,nextCursor:null});}
    return respond(request,{scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:[original],totalTasks:2,nextCursor:cursor});
   }
   assert.equal(url.pathname,'/api/identity/field-operations','No task-creation command may be issued');
   const fieldRead=fieldFixture.inspect(request,url);
   if(request.method()==='GET'){
    if(url.searchParams.has('operationId')){receiptQueries.push(url.searchParams.get('operationId'));assert.ok(recorded);assert.equal(receiptQueries.at(-1),posts[0].operationId);assert.equal(recorded.proposal.progress,25);assert.equal(recorded.task.progress,25);assert.equal(currentTask.progress,50);return respond(request,{state:'RECORDED',...recorded,replayed:true,task:currentTask,decisionTaskSnapshot:recorded.task});}
    return respond(request,fieldRead.body);
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
  await waitRejectedLive();assertPhaseReads(['ACCOUNT',null,null]);phase='field-decision-callback';
  assert.equal((await page.$$('[data-task-id="task-outside"]')).length,0);assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),original.progress);
  await showWorkspaceSection(page,'field-title');await click(page,'Abrir operaciones');await page.waitForSelector('nav[aria-label="Operaciones de campo"]');await click(page,'Avance');await waitText(page,'Decidir propuesta');await fieldFixture.waitCurrent(page);assert.equal(posts.length,0);assert.equal(cursorReads.length,0);
  await showWorkspaceSection(page,'field-title');await click(page,'Decidir propuesta');await page.waitForSelector('section[aria-labelledby="field-title"] form');await page.select('section[aria-labelledby="field-title"] form select',decision);await page.type('section[aria-labelledby="field-title"] form textarea','Decisión sintética de otra cuenta responsable.');assert.equal(posts.length,0);await click(page,'Guardar con recibo');
  if(decision==='APPROVE'){await waitText(page,'El resultado quedó sin confirmar.');assert.equal((await page.$$('[data-confirmed-progress]')).length,0);assert.equal(posts.length,1);await click(page,'Comprobar guardado');await waitText(page,'Avance aprobado con recibo.');assert.deepEqual(receiptQueries,[posts[0].operationId]);}
  else await waitText(page,'La propuesta fue rechazada.');
  assertPhaseReads([]);phase='inspect-unloaded-schedule';await showWorkspaceSection(page,'schedule-title');await waitRejectedLive();assertPhaseReads([null]);assert.equal(posts.length,1);assert.equal(cursorReads.length,0);assert.equal((await page.$$('[data-task-id="task-outside"]')).length,0);assert.ok((await text(page)).includes('1 de 2 tareas cargadas'));
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),original.progress);assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),[original.startsOn,original.endsOn]);
  await showWorkspaceSection(page,'field-title');assert.equal(await page.$eval('section[aria-labelledby="field-title"] details code',element=>element.textContent),recorded.receiptId);
  if(decision==='APPROVE'){
   const resultText=await page.$eval('[data-confirmed-progress="task-outside"]',element=>element.textContent);assert.ok(resultText.includes('Demolición de portería')&&resultText.includes('25% de avance aprobado en este recibo')&&resultText.includes('Falta cargar esta tarea'));assert.ok(!resultText.includes('50%'));assert.equal(recorded.proposal.status,'APPLIED');assert.equal(recorded.proposal.progress,25);
   await showWorkspaceSection(page,'field-title');await (await page.$('section[aria-labelledby="field-title"]')).screenshot({path:path.join(evidence,'workspace-unloaded-progress-receipt-'+width+'.png')});
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Ver en el cronograma'&&!button.disabled)&&document.getElementById('schedule-load-more')?.disabled===false);assert.ok(await page.$eval('[data-confirmed-progress="task-outside"] button',element=>element.getBoundingClientRect().height>=44));phase='receipt-navigation-live';await page.focus('[data-confirmed-progress="task-outside"] button');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.id==='schedule-load-more');await waitRejectedLive();assertPhaseReads([null]);assert.equal(await page.evaluate(()=>document.activeElement?.id),'schedule-load-more');assert.equal(cursorReads.length,0);
   phase='explicit-unloaded-pagination-live';await page.keyboard.press('Enter');await page.waitForSelector('[data-task-id="task-outside"]');await waitRejectedLive();assertPhaseReads([cursor,null]);assert.equal(cursorReads.length,1);assert.ok((await text(page)).includes('2 de 2 tareas cargadas'));
   assert.equal(await page.$eval('[data-task-id="task-outside"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),50);assert.deepEqual(await page.$$eval('[data-task-id="task-outside"] time',elements=>elements.map(element=>element.dateTime)),[currentTask.startsOn,currentTask.endsOn]);assert.equal(await page.$eval('[data-task-id="task-outside"] [data-status]',element=>element.dataset.status),'BLOCKED');assert.deepEqual([recorded.task.startsOn,recorded.task.endsOn],[outside.startsOn,outside.endsOn]);assert.notDeepEqual([currentTask.startsOn,currentTask.endsOn],[recorded.task.startsOn,recorded.task.endsOn]);assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),[original.startsOn,original.endsOn]);assert.ok((await page.$eval('[data-confirmed-progress="task-outside"]',element=>element.textContent)).includes('25% de avance aprobado en este recibo'));assert.ok(!(await page.$eval('[data-confirmed-progress="task-outside"]',element=>element.textContent)).includes('50%'));
   await showWorkspaceSection(page,'field-title');await waitText(page,'Esta tarea está cargada en el cronograma.');phase='loaded-task-navigation-live';await page.focus('[data-confirmed-progress="task-outside"] button');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.dataset.taskId==='task-outside');await waitRejectedLive();assertPhaseReads([null]);assert.equal(await page.evaluate(()=>document.activeElement?.dataset.taskId),'task-outside');assert.equal(cursorReads.length,1);assert.equal(posts.length,1);
  }else{assert.equal((await page.$$('[data-confirmed-progress]')).length,0);assert.equal(await page.$$eval('button',buttons=>buttons.filter(button=>button.textContent==='Ver en el cronograma').length),0);const fieldText=await page.$eval('section[aria-labelledby="field-title"]',element=>element.innerText);assert.ok(!fieldText.includes('avance aprobado en este recibo')&&!fieldText.includes('Avance aprobado con recibo.'));assert.deepEqual(receiptQueries,[]);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));phase='final-schedule';await showWorkspaceSection(page,'schedule-title');await waitRejectedLive();assertPhaseReads(decision==='APPROVE'?[]:[null]);await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,mode+'-'+width+'.png')});
  assert.equal(cursorReads.length,decision==='APPROVE'?1:0);assertAllSchedulePhases();fieldFixture.assertComplete(decision==='APPROVE'?[posts[0].operationId]:[]);checks.push((decision==='APPROVE'?'schedule-unloaded-progress-recovers-same-uuid-historical-25-current-50-and-loads-explicit-cursor-':'schedule-rejected-progress-with-task-does-not-claim-approval-')+width);
 }catch(error){error.workspaceUiDiagnostic={mode,width,phase,scheduleFacts,fieldFacts:fieldFixture.facts,cursorReads,receiptQueries,posts:posts.length};await page.screenshot({path:path.join(evidence,mode+'-failure-'+width+'.png'),fullPage:false}).catch(()=>{});throw error;}
 finally{await context.close();fieldFixture.write();}
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
 const field={scope,projectId:'p-a',projectRevision:beforeRevision,configurationRevision:null,canConfigure:true,canReview:true,canApproveProgress:true,selfWorkers:[],workers:[{id:'worker-a',name:'Participante sintético'}],sectors:[],attendance:[],incidents:[],materialRequests:[],truncated:false,proposals,evidence:[{id:'evidence-a',taskId:original.id,workerId:'worker-a',title:'Evidencia sintética aprobada',caption:'Evidencia para contrastar el recibo histórico.',status:'APPROVED',revision:beforeRevision,media:{kind:'image',contentType:'image/png',bytes:64,sha256:'b'.repeat(64)},processing:{status:'NOT_REQUESTED'}}]};
 const scheduleFacts=[];let phase='initial-project';
 const fieldFixture=progressReviewFixture(field,{name:'workspace-receipt-'+mode+'-'+snapshotCase+'-'+width,getPhase:()=>phase,phases:['field-recovery-callback','snapshot-held-callback','snapshot-released-live','receipt-navigation-live','final-snapshot-schedule']});
 const projectQuery=cursor=>'?'+new URLSearchParams({projectId:'p-a',scope,...(cursor?{afterTask:cursor}:{})});
 const expectedPhaseReads=new Map();
 const assertPhaseReads=cursors=>{const expected=cursors.map(cursor=>({phase,method:'GET',path:'/api/identity/workspace',query:cursor==='ACCOUNT'?'':projectQuery(cursor)}));assert.deepEqual(scheduleFacts.filter(row=>row.phase===phase),expected);if(expectedPhaseReads.has(phase))assert.deepEqual(expectedPhaseReads.get(phase),expected);expectedPhaseReads.set(phase,expected);};
 const assertAllSchedulePhases=()=>{assert.deepEqual(scheduleFacts.filter(row=>!expectedPhaseReads.has(row.phase)),[],'Every workspace GET must belong to an asserted phase');for(const [name,expected]of expectedPhaseReads)assert.deepEqual(scheduleFacts.filter(row=>row.phase===name),expected,'No later GET may escape an already asserted phase '+name);};
 const waitRejectedLive=async()=>{await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='STALE',{timeout:15000});await page.waitForNetworkIdle({idleTime:100,concurrency:0,timeout:15000});assert.equal(await page.$eval('[data-worksite-live-refresh]',el=>el.dataset.worksiteLiveRefresh),'STALE');assert.match(await page.$eval('[data-worksite-live-refresh]',el=>el.innerText),/No pudimos actualizar esta consulta\. Conservamos los datos/);};
 // All workspace GETs remain in scheduleFacts; no first-only counter.
 const posts=[],receiptQueries=[];let recorded=null,heldRefresh=null,holdNextRefresh=false,preparationReads=0;
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
    scheduleFacts.push({phase,method:request.method(),path:url.pathname,query:url.search});
    if(!url.search)return respond(request,{scope,organizationName:'Empresa de ensayo de snapshots',role:'DIRECTOR',roleLabel:'Director de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false});
    assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');
    return respond(request,{scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:[original,untouched],totalTasks:2,nextCursor:null});
   }
   assert.equal(url.pathname,'/api/identity/field-operations','No task creation command may be issued');
   const fieldRead=fieldFixture.inspect(request,url);
   if(request.method()==='GET'){
    if(url.searchParams.has('operationId')){
     assert.ok(recorded);const operationId=url.searchParams.get('operationId');assert.equal(operationId,recorded.input.operationId);receiptQueries.push(operationId);
     const snapshot=recorded.kind==='explicit-null'?null:recorded.kind==='malformed-progress'?{...historicalTask,progress:'25'}:historicalTask;
     const recovery={state:'RECORDED',...recorded.outcome,replayed:true,task:currentTask,decisionTaskSnapshot:snapshot};assert.ok(Object.hasOwn(recovery,'decisionTaskSnapshot'));assert.equal(recovery.task.progress,50);assert.equal(recovery.task.status,'BLOCKED');holdNextRefresh=true;return respond(request,recovery);
    }
    if(holdNextRefresh){assert.equal(fieldRead.kind,'BASE','Retain the explicit confirmed() base refresh, never a review page');assert.equal(heldRefresh,null);holdNextRefresh=false;heldRefresh=request;return;}
    return respond(request,fieldRead.body);
   }
   assert.equal(request.method(),'POST');assert.equal(url.search,'');const input=JSON.parse(request.postData()),index=posts.length,proposal=proposals[index];assert.ok(proposal);posts.push(input);
   assert.equal(input.scope,scope);assert.equal(input.projectId,'p-a');assert.equal(input.action,'DECIDE_PROGRESS');assert.equal(input.payload.proposalId,proposal.id);assert.equal(input.payload.revision,proposal.revision);assert.equal(input.payload.decision,'APPROVE');assert.equal(input.payload.reason,'Decisión sintética '+cases[index]+'.');assert.match(input.operationId,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
   field.proposals=field.proposals.map(row=>row.id===proposal.id?{...row,status:'APPLIED',revision:decisionRevision}:row);
   const outcome={scope,saved:true,replayed:false,receiptId:'field_'+(index===0?'c':'d').repeat(64),kind:'PROGRESS_DECISION',proposal:field.proposals.find(row=>row.id===proposal.id),task:historicalTask};recorded={input,kind:cases[index],outcome};
   return respond(request,{code:'FIELD_OPERATION_UNCONFIRMED'},503);
  }catch(error){pageErrors.push({mode:'confirmed-progress-snapshots-'+mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 const assertCurrentSchedule=async liveExpected=>{
  phase=liveExpected?'snapshot-released-live':'snapshot-held-callback';await showWorkspaceSection(page,'schedule-title');if(liveExpected)await waitRejectedLive();else await page.waitForSelector('[data-worksite-live-refresh="PAUSED"]',{timeout:15000});assertPhaseReads(liveExpected?[null]:[]);
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),50);assert.equal(await page.$eval('[data-task-id="task-a"] [data-status]',element=>element.dataset.status),'BLOCKED');assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),[currentTask.startsOn,currentTask.endsOn]);
  assert.equal(await page.$eval('[data-task-id="task-untouched"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),untouched.progress);assert.deepEqual(await page.$$eval('[data-task-id="task-untouched"] time',elements=>elements.map(element=>element.dateTime)),[untouched.startsOn,untouched.endsOn]);assert.equal(await page.$$eval('[data-task-id]',elements=>elements.length),2);
  const gantt=await page.$eval('[data-gantt-task-id="task-a"]',(element,dates)=>{const format=new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});return {text:element.innerText,planned:element.querySelector('[data-gantt-planned]')?.getAttribute('aria-label'),dates:dates.map(value=>format.format(new Date(value+'T00:00:00Z')))};},[currentTask.startsOn,currentTask.endsOn]);
  assert.ok(gantt.text.includes('50 % registrado')&&gantt.text.includes('Bloqueada'));assert.ok(gantt.dates.every(value=>gantt.planned?.includes(value)));assert.ok((await text(page)).includes('2 de 2 tareas cargadas'));
  const trace=await page.evaluate(()=>window.__loadedReceiptTrace);assert.ok(trace.length>0);assert.ok(trace.some(row=>row.progress===50));assert.ok(trace.every(row=>row.progress!==25),'The receipt snapshot must never be written to the already loaded schedule');await showWorkspaceSection(page,'field-title');
 };
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo de snapshots');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="project-preparation-title"]')?.getAttribute('aria-busy')==='false',{timeout:15000});assert.equal(preparationReads,1);
  await waitRejectedLive();assertPhaseReads(['ACCOUNT',null,null]);phase='field-recovery-callback';
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>Number(element.getAttribute('aria-valuenow'))),0);assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),[original.startsOn,original.endsOn]);
  await page.evaluate(()=>{window.__loadedReceiptTrace=[];window.__loadedReceiptObserver=new MutationObserver(()=>{const row=document.querySelector('[data-task-id="task-a"]');if(row)window.__loadedReceiptTrace.push({progress:Number(row.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')),dates:[...row.querySelectorAll('time')].map(time=>time.dateTime)});});window.__loadedReceiptObserver.observe(document.querySelector('section[aria-labelledby="schedule-title"]'),{subtree:true,childList:true,attributes:true});});
  await showWorkspaceSection(page,'field-title');await click(page,'Abrir operaciones');await page.waitForSelector('nav[aria-label="Operaciones de campo"]');await click(page,'Avance');await fieldFixture.waitCurrent(page);
  for(const [index,kind] of cases.entries()){
   await page.waitForSelector('[data-field-proposal="proposal-snapshot-'+index+'"] button');await page.$eval('[data-field-proposal="proposal-snapshot-'+index+'"] button',element=>element.click());await page.waitForSelector('section[aria-labelledby="field-title"] form');await page.select('section[aria-labelledby="field-title"] form select','APPROVE');await page.type('section[aria-labelledby="field-title"] form textarea','Decisión sintética '+kind+'.');await click(page,'Guardar con recibo');
   await waitText(page,'El resultado quedó sin confirmar.');assert.equal(posts.length,index+1);assert.equal((await page.$$('[data-confirmed-progress]')).length,0);await click(page,'Comprobar guardado');await waitText(page,mode==='invalid-snapshot'?'Decisión guardada con recibo. Consultá el estado de la propuesta.':'Avance aprobado con recibo.');
   await page.waitForFunction(()=>document.querySelector('[data-task-id="task-a"] [role="progressbar"]')?.getAttribute('aria-valuenow')==='50');for(let i=0;i<80&&!heldRefresh;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(heldRefresh,'Hold the field refresh to observe the schedule callback separately');assertPhaseReads([]);await assertCurrentSchedule(false);assert.deepEqual(receiptQueries,posts.map(input=>input.operationId));assert.equal(posts.length,index+1);assert.equal(new Set(posts.map(input=>input.operationId)).size,posts.length);
   assert.equal(await page.$eval('section[aria-labelledby="field-title"] details code',element=>element.textContent),recorded.outcome.receiptId);
   if(mode==='invalid-snapshot'){
    assert.equal((await page.$$('[data-confirmed-progress]')).length,0);assert.equal(await page.$$eval('button',elements=>elements.filter(element=>element.textContent==='Ver en el cronograma').length),0);const fieldText=await page.$eval('section[aria-labelledby="field-title"]',element=>element.innerText);assert.ok(!fieldText.includes('avance aprobado en este recibo')&&!fieldText.includes('Avance aprobado con recibo.'));
   }else{
    const receiptText=await page.$eval('[data-confirmed-progress="task-a"]',element=>element.textContent);assert.ok(receiptText.includes('25% de avance aprobado en este recibo')&&!receiptText.includes('50%')&&receiptText.includes('Esta tarea está cargada en el cronograma.'));assert.ok(await page.$eval('[data-confirmed-progress="task-a"] button',element=>element.disabled));
   }
   const refresh=heldRefresh;heldRefresh=null;await respond(refresh,field);await page.waitForFunction(()=>document.querySelector('nav[aria-label="Operaciones de campo"] button')?.disabled===false);await assertCurrentSchedule(true);assert.equal(posts.length,index+1);
   if(mode==='loaded-current'){phase='receipt-navigation-live';await page.focus('[data-confirmed-progress="task-a"] button');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.dataset.taskId==='task-a');await waitRejectedLive();assertPhaseReads([null]);assert.equal(await page.evaluate(()=>document.activeElement?.dataset.taskId),'task-a');assert.equal(posts.length,1);assert.ok((await page.$eval('[data-confirmed-progress="task-a"]',element=>element.textContent)).includes('25% de avance aprobado en este recibo'));}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await showWorkspaceSection(page,'field-title');await (await page.$('section[aria-labelledby="field-title"]')).screenshot({path:path.join(evidence,'workspace-receipt-'+mode+'-'+kind+'-'+width+'.png')});
  }
  phase='final-snapshot-schedule';await showWorkspaceSection(page,'schedule-title');await waitRejectedLive();assertPhaseReads([null]);await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,'workspace-receipt-'+mode+'-'+snapshotCase+'-schedule-'+width+'.png')});assertAllSchedulePhases();fieldFixture.assertComplete(posts.map(input=>input.operationId));
 }catch(error){error.workspaceUiDiagnostic={mode,width,snapshotCase,phase,scheduleFacts,fieldFacts:fieldFixture.facts,receiptQueries,posts:posts.length};await page.screenshot({path:path.join(evidence,'workspace-receipt-'+mode+'-failure-'+width+'.png'),fullPage:false}).catch(()=>{});throw error;}
 finally{if(heldRefresh&&!heldRefresh.isInterceptResolutionHandled())await heldRefresh.abort().catch(()=>{});await page.evaluate(()=>window.__loadedReceiptObserver?.disconnect()).catch(()=>{});await context.close();fieldFixture.write();}
}
async function stalePaginationScenario(){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width:390,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode:'stale-pagination',width:390,message:error.message}));
 const beforeRevision='2026-10-02T09:00:00.000001',afterRevision='2026-10-02T09:00:00.000002',original={...baseTask(),revision:beforeRevision},posts=[],requests=[];
 let phase='initial-load';
 const waitLiveRejection=async()=>{await page.waitForFunction(()=>document.querySelector('[data-worksite-live-refresh]')?.dataset.worksiteLiveRefresh==='STALE',{timeout:15000});assert.match(await page.$eval('[data-worksite-live-refresh]',element=>element.innerText),/No pudimos actualizar esta consulta\. Conservamos los datos/);};
 let heldPage;const paginationStarted=new Promise(resolve=>{heldPage={resolve,request:null};});
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');requests.push({phase,method:request.method(),query:url.search});let body;
   if(request.method()==='POST'){
    const payload=JSON.parse(request.postData());posts.push(payload);assert.equal(posts.length,1);assert.equal(payload.scope,scope);assert.equal(payload.projectId,'p-a');assert.equal(payload.taskId,original.id);assert.equal(payload.expectedRevision,beforeRevision);assert.equal(payload.startsOn,'2026-10-07');assert.equal(payload.endsOn,'2026-10-15');
    body={scope,saved:true,replayed:false,task:{...original,startsOn:payload.startsOn,endsOn:payload.endsOn,revision:afterRevision},receipt:{id:'workspace_schedule_'+ 'c'.repeat(64),taskId:original.id,recordedAt:afterRevision,before:{startsOn:original.startsOn,endsOn:original.endsOn},after:{startsOn:payload.startsOn,endsOn:payload.endsOn}}};
   }else if(!url.search)body={scope,organizationName:'Empresa de ensayo de página tardía',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};
   else{
    assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');
    if(url.searchParams.has('afterTask')){assert.equal(url.searchParams.get('afterTask'),'held-page');heldPage.request=request;heldPage.resolve();return;}
    body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:[original],totalTasks:2,nextCursor:'held-page'};
   }
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode:'stale-pagination',width:390,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo de página tardía');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await showWorkspaceSection(page,'schedule-title');await page.waitForSelector('[data-task-id="task-a"]');
  await waitLiveRejection();const projectQuery='?'+new URLSearchParams({projectId:'p-a',scope});
  assert.deepEqual(requests,[{phase:'initial-load',method:'GET',query:''},{phase:'initial-load',method:'GET',query:projectQuery},{phase:'initial-load',method:'GET',query:projectQuery}],'The initial synthetic project read includes one rejected live validation');
  phase='held-pagination';await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await paginationStarted;await showWorkspaceSection(page,'schedule-title');await fill(page);
  phase='confirm-newer-schedule';await click(page,'Confirmar planificación');await showWorkspaceSection(page,'schedule-title');await waitText(page,'Cambio confirmado');assert.equal(posts.length,1);
  phase='late-page-return';
  await heldPage.request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify({scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:[original,{...original,id:'late-page-task',title:'Tarea añadida por la página tardía'}],totalTasks:2,nextCursor:null})});
  await page.waitForSelector('[data-task-id="late-page-task"]');assert.equal(await page.$$eval('[data-task-id="task-a"]',elements=>elements.length),1);
  assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),['2026-10-07','2026-10-15']);
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>element.getAttribute('aria-valuenow')),'37');assert.ok((await text(page)).includes('2026-10-07 → 2026-10-15'));assert.ok((await text(page)).includes('Cambio confirmado'));assert.equal(posts.length,1);await waitLiveRejection();
  assert.deepEqual(requests.filter(request=>request.method==='GET'),[{phase:'initial-load',method:'GET',query:''},{phase:'initial-load',method:'GET',query:projectQuery},{phase:'initial-load',method:'GET',query:projectQuery},{phase:'held-pagination',method:'GET',query:projectQuery+'&afterTask=held-page'},{phase:'late-page-return',method:'GET',query:projectQuery}],'The late append and rejected live validation must stay in the exact project and phases');
  writeFileSync(path.join(evidence,'workspace-workbench-stale-page-requests-390.json'),JSON.stringify({requests,postCount:posts.length,confirmedDatesRetained:true,receiptRetained:true},null,2));
  await showWorkspaceSection(page,'schedule-title');await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,'workspace-workbench-stale-page-390.png')});checks.push('workbench-late-cursor-page-preserves-confirmed-newer-schedule-and-receipt-390');
 }catch(error){await page.screenshot({path:path.join(evidence,'workspace-workbench-stale-page-failure-390.png'),fullPage:false}).catch(()=>{});writeFileSync(path.join(evidence,'workspace-workbench-stale-page-failure-390.json'),JSON.stringify({phase,message:error.message,requests,postCount:posts.length},null,2));throw error;}
 finally{if(heldPage.request&&!heldPage.request.isInterceptResolutionHandled())await heldPage.request.abort().catch(()=>{});await context.close();}
}

async function onboardingEpochScenario(width){
 const mode='onboarding-epoch',context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const posts=[],queries=[],workspaceQueries=[];let workspaceReads=0,channelReads=0,receiptReads=0,receiptObserved=false,heldChannel,stage='account';let channelStarted;const channelGate=new Promise(resolve=>{channelStarted=resolve;});
 const firstTask=baseTask(),secondTask={...baseTask(),id:'task-second',title:'Segunda tarea can\u00f3nica'},firstPage=Array.from({length:100},(_,index)=>index===0?firstTask:{...baseTask(),id:'task-loaded-'+String(index).padStart(3,'0')}),taskCursor=firstPage.at(-1).id;
 const participant={id:'worker-self',name:'Persona propia',active:true,revision,status:'ACTIVE',self:true,accountLinked:true,invitation:null,permissions:{attendance:true,report:true},kyc:{status:'APPROVED',submissionId:null,images:[]}},channel=()=>({scope,projectId:'p-a',channelReady:true,records:[{workerId:participant.id,name:participant.name,phone:'+15550001001',connectionNumber:'+15550002002',revision,state:'VERIFIED',eligible:true,challenge:null,binding:{id:'binding-'+channelReads,verifiedAt:'2026-10-01T12:00:00.000Z',revokedAt:null}}]});
 await page.setRequestInterception(true);page.on('request',async request=>{try{const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}if(!url.pathname.startsWith('/api/identity/'))return request.continue();assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');if(request.method()==='POST'){posts.push(request.postData());throw Error('Onboarding epoch scenario permits GET only');}queries.push({path:url.pathname,query:url.search});let body;
  if(url.pathname==='/api/identity/workspace'){if(!url.search)body={scope,organizationName:'Empresa de epoch sint\u00e9tico',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};else{assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');const cursor=url.searchParams.get('afterTask');assert.deepEqual([...url.searchParams.keys()].sort(),cursor===null?['projectId','scope']:['afterTask','projectId','scope']);if(cursor!==null)assert.equal(cursor,taskCursor);workspaceReads++;workspaceQueries.push({cursor,receiptObserved});
   // Entering the schedule also performs legitimate live GETs. The server's
   // page and the receipt readback depend on their inputs, never call order.
   body={scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Jefe de obra',canPlanSchedule:false,tasks:cursor!==null?[secondTask]:firstPage,totalTasks:101,nextCursor:cursor!==null?null:taskCursor};}}
  else if(url.pathname==='/api/identity/participants')body={scope,projectId:'p-a',canManage:false,canInvite:false,canManageOfficeRoles:false,existingAccounts:[],records:[participant],privacyNotice:{version:'fixture-notice',text:'Ensayo sin documentos'}};
  else if(url.pathname==='/api/identity/worker-channel'){assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');channelReads++;if(channelReads===2){heldChannel=request;channelStarted();return;}body=channel();}
  else if(url.pathname==='/api/identity/task-creation'){assert.equal(url.searchParams.get('operationId'),'11111111-1111-4111-8111-111111111111');assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.get('scope'),scope);assert.deepEqual([...url.searchParams.keys()].sort(),['operationId','projectId','scope']);receiptReads++;assert.equal(receiptReads,1);receiptObserved=true;body={scope,projectId:'p-a',state:'RECORDED',saved:true,created:true,receiptId:'task-recovery-fixture',task:firstTask};}
  else throw Error('Unexpected synthetic identity endpoint');await request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});assert.equal(await page.evaluate(()=>innerWidth),width);await waitText(page,'Empresa de epoch sint\u00e9tico');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');stage='initial-channel';await showGuide(page);await showWorkspaceSection(page,'participant-title');await click(page,'Consultar participantes');await page.waitForSelector('[data-onboarding-step="CHANNEL_UNOBSERVED"]');await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculaci\u00f3n');await page.waitForSelector('[data-onboarding-step="CHANNEL_VERIFIED"]');assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),1);await page.waitForFunction(()=>document.querySelector('[data-guide-observation="OBSERVED"]')?.textContent.includes('Tu vínculo personal está vigente'));assert.match(await guideStatus(page),/100 tareas cargadas de 101.*Vista parcial/s);
  stage='append-page';await showWorkspaceSection(page,'schedule-title');const beforeAppendReads=workspaceQueries.length;await click(page,'Cargar m\u00e1s tareas');await page.waitForSelector('[data-task-id="task-second"]');await page.waitForSelector('[data-onboarding-step="CHANNEL_UNOBSERVED"]');assert.ok(workspaceQueries.slice(beforeAppendReads).some(read=>read.cursor===taskCursor&&!read.receiptObserved),'Appending requires the current second-page cursor, not a background first-page refresh');assert.equal(receiptReads,0);assert.equal(channelReads,1);assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),0);assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));assert.match(await guideStatus(page),/101 tareas cargadas de 101.*Vista completa/s);
  stage='receipt-readback';await page.evaluate(async body=>{await window.__prepareWorkspaceReference(body);},{scope,projectId:'p-a',operationId:'11111111-1111-4111-8111-111111111111'});await showWorkspaceSection(page,'workspace-recovery-title');await waitText(page,'Operaciones por comprobar');await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculaci\u00f3n');await channelGate;await showWorkspaceSection(page,'workspace-recovery-title');await click(page,'Comprobar recibo');await showWorkspaceSection(page,'schedule-title');await page.waitForFunction(()=>document.body.innerText.includes('Cronograma actualizado desde los registros'));assert.equal(receiptReads,1);assert.ok(workspaceQueries.some(read=>read.receiptObserved&&read.cursor===null),'The confirmed receipt must be followed by a current first-page readback');assert.deepEqual(await page.$$eval('[data-task-id]',els=>els.map(el=>el.dataset.taskId).sort()),firstPage.map(task=>task.id).sort());assert.match(await guideStatus(page),/100 tareas cargadas de 101.*Vista parcial/s);await page.waitForFunction(()=>document.getElementById('schedule-load-more')?.disabled===false);
  stage='late-channel-response';const oldBody=channel();await heldChannel.respond({status:200,contentType:'application/json',body:JSON.stringify(oldBody)});heldChannel=null;await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Consultar vinculaci\u00f3n'&&!button.disabled));assert.equal(await page.$eval('[data-onboarding-step]',el=>el.dataset.onboardingStep),'CHANNEL_UNOBSERVED');assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),0);assert.equal(channelReads,2);assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  stage='fresh-channel-read';await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculaci\u00f3n');await page.waitForSelector('[data-onboarding-step="CHANNEL_VERIFIED"]');assert.equal(channelReads,3);assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),1);assert.equal(posts.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(evidence,`workspace-onboarding-epoch-${width}.png`),fullPage:true});checks.push({mode,width,workspaceReads,channelReads,posts:posts.length,appendInvalidates:true,lateSnapshotRejected:true,freshExplicitReadRequired:true});
 }catch(error){const diagnostic={diagnostic:'onboarding-epoch-primary-failure',stage,width,message:error.message,stack:String(error.stack).slice(0,4000),ui:await page.evaluate(()=>({hash:location.hash,active:document.activeElement?.id,navigationPresent:Boolean(document.querySelector('nav[aria-label="Navegación de la obra"]')),visibleScreens:[...document.querySelectorAll('[data-workspace-screen]')].filter(node=>!node.hidden).map(node=>node.dataset.workspaceScreen),guideObservation:window.__guideObservation,guideText:document.querySelector('[data-guide-observation]')?.textContent.slice(0,1800)})).catch(()=>null)};error.workspaceUiDiagnostic=diagnostic;console.error(JSON.stringify(diagnostic));await page.screenshot({path:path.join(evidence,`workspace-onboarding-epoch-failure-${width}.png`),fullPage:false}).catch(()=>{});throw error;}finally{if(heldChannel&&!heldChannel.isInterceptResolutionHandled())await heldChannel.abort().catch(()=>{});await context.close();}
}

const guideStatus=page=>page.$eval('[data-guide-observation]',node=>node.textContent);
async function guideObservationScenario(width){
 const mode='guide-observation',context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[],retiredScopeResponses=[];let failureStatus=null,currentScope=scope,retiredScope=null,role='SITE_MANAGER',projectReads=0,stage='account';
 const firstPage=id=>Array.from({length:100},(_,index)=>({...baseTask(),id:id+'-task-'+String(index).padStart(3,'0'),...(index===0?{startsOn:null,endsOn:null}:{})})),tailTask=id=>({...baseTask(),id:id+'-task-tail'});
 await page.setRequestInterception(true);page.on('request',async request=>{try{const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}if(!url.pathname.startsWith('/api/identity/'))return request.continue();requests.push({path:url.pathname,method:request.method()});assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');if(request.method()!=='GET'){posts.push(request.postData());throw Error('Guide scenario permits GET only');}let status=200,body;
  if(url.pathname==='/api/identity/workspace'){
   if(!url.search)body={scope:currentScope,organizationName:'Empresa de guía sintética',role,roleLabel:role==='SITE_MANAGER'?'Jefe de obra':'Auditor',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false};
   else{const requestedScope=url.searchParams.get('scope');if(requestedScope!==currentScope){assert.equal(stage,'role-scope-refresh');assert.equal(retiredScope,scope);assert.equal(requestedScope,retiredScope);assert.equal(currentScope,'b'.repeat(64));assert.equal(role,'AUDITOR');const id=url.searchParams.get('projectId'),cursor=url.searchParams.get('afterTask');assert.ok(['p-a','p-b'].includes(id));assert.deepEqual([...url.searchParams.keys()].sort(),cursor===null?['projectId','scope']:['afterTask','projectId','scope']);if(cursor!==null)assert.equal(cursor,firstPage(id).at(-1).id);const response=request.respond({status:409,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify({code:'WORKSPACE_CONTEXT_CHANGED'})});retiredScopeResponses.push(response);await response;return;}assert.equal(requestedScope,currentScope);const id=url.searchParams.get('projectId');assert.ok(['p-a','p-b'].includes(id));const page=firstPage(id),cursor=url.searchParams.get('afterTask');assert.deepEqual([...url.searchParams.keys()].sort(),cursor===null?['projectId','scope']:['afterTask','projectId','scope']);if(cursor!==null)assert.equal(cursor,page.at(-1).id);projectReads++;if(failureStatus&&cursor!==null){status=failureStatus;failureStatus=null;body={code:status===401?'SESSION_REQUIRED':status===403?'WORKSPACE_MEMBERSHIP_REQUIRED':'WORKSPACE_OPERATION_UNCONFIRMED'};}else body={scope:currentScope,project:{id,name:id==='p-a'?'Obra de prueba A':'Obra de prueba B',status:'ACTIVE'},roleLabel:role==='SITE_MANAGER'?'Jefe de obra':'Auditor',canPlanSchedule:false,tasks:cursor!==null?[tailTask(id)]:page,totalTasks:101,nextCursor:cursor!==null?null:page.at(-1).id};}
  }else if(url.pathname==='/api/identity/worker-channel')body={scope:currentScope,projectId:'p-a',channelReady:true,truncated:false,records:[{workerId:'own-worker',name:'Persona sintética',revision,state:'VERIFIED',eligible:true,binding:{id:'guide-binding',verifiedAt:'2026-10-01T12:00:00Z',revokedAt:null}}]};
  else throw Error('Unexpected guide endpoint '+url.pathname);
  await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await page.waitForFunction(()=>document.querySelector('[data-guide-observation="OBSERVED"]')?.textContent.includes('Empresa consultada'));assert.match(await guideStatus(page),/2 obras asignadas/);assert.match(await guideStatus(page),/abrí una obra/);
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForFunction(()=>window.__guideObservation?.schedule?.loaded===100);await showGuide(page);assert.match(await guideStatus(page),/100 tareas cargadas de 101.*Vista parcial.*1 sin fechas/s);
  stage='channel-read';await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculación');await page.waitForFunction(()=>window.__guideObservation?.channel?.ownLinked===true);assert.match(await guideStatus(page),/Tu vínculo personal está vigente/);
  stage='failed-append-503';await showWorkspaceSection(page,'schedule-title');failureStatus=503;await click(page,'Cargar más tareas');await page.waitForSelector('[data-guide-observation="UNOBSERVED"]');assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));assert.ok(!(await guideStatus(page)).includes('100 tareas cargadas'));assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),100);
  stage='retry-append';await showWorkspaceSection(page,'schedule-title');await click(page,'Cargar más tareas');await page.waitForFunction(()=>window.__guideObservation?.schedule?.loaded===101);assert.match(await guideStatus(page),/101 tareas cargadas de 101/);assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  stage='switch-project-b';await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());await page.waitForFunction(()=>window.__guideObservation?.projectId==='p-b'&&window.__guideObservation?.schedule?.loaded===100);assert.match(await guideStatus(page),/100 tareas cargadas de 101/);assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),100);assert.equal(await page.evaluate(()=>window.__guideObservation.channel),null);
  for(const denial of [401,403]){stage='denied-append-'+denial;await showWorkspaceSection(page,'schedule-title');failureStatus=denial;await click(page,'Cargar más tareas');await page.waitForSelector('[data-guide-observation="UNAVAILABLE"]');assert.ok(!(await guideStatus(page)).includes('Empresa consultada'));assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);await click(page,'Actualizar');await page.waitForSelector('[data-guide-observation="OBSERVED"]');assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),null);await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForFunction(()=>window.__guideObservation?.projectId==='p-a');}
  stage='role-scope-refresh';retiredScope=currentScope;currentScope='b'.repeat(64);role='AUDITOR';await click(page,'Actualizar');await page.waitForFunction(()=>document.querySelector('[data-guide-observation="OBSERVED"]')?.textContent.includes('acceso Auditor'));await page.waitForNetworkIdle({idleTime:0,concurrency:0,timeout:15000});await Promise.all(retiredScopeResponses);assert.equal(await page.evaluate(()=>window.__guideObservation.scope),currentScope);assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),null);assert.equal(await page.evaluate(()=>window.__guideObservation.channel),null);assert.ok(!(await guideStatus(page)).includes('tareas cargadas'));assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));assert.equal(posts.length,0);await page.$eval('[data-guide-observation]',node=>{node.closest('details').open=true;});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(evidence,'workspace-guide-state-'+width+'.png'),fullPage:true});checks.push({mode,width,projectReads,requests:requests.length,posts:0,failedReadClears:true,denial401Clears:true,denial403Clears:true,projectSwitchClears:true,roleScopeRefreshClears:true});
 }catch(error){const diagnostic={diagnostic:'guide-observation-primary-failure',stage,width,message:error.message,stack:String(error.stack).slice(0,4000),requests,ui:await page.evaluate(()=>({hash:location.hash,active:document.activeElement?.id,navigationPresent:Boolean(document.querySelector('nav[aria-label="Navegación de la obra"]')),visibleScreens:[...document.querySelectorAll('[data-workspace-screen]')].filter(node=>!node.hidden).map(node=>node.dataset.workspaceScreen),guideObservation:window.__guideObservation,guideText:document.querySelector('[data-guide-observation]')?.textContent.slice(0,1800)})).catch(()=>null)};error.workspaceUiDiagnostic=diagnostic;console.error(JSON.stringify(diagnostic));await page.screenshot({path:path.join(evidence,`workspace-guide-observation-failure-${width}.png`),fullPage:false}).catch(()=>{});throw error;}finally{await context.close();}
}

async function guideHttpDenialScenario(width,action,denial){
 const mode=`guide-http-${action}-${denial}`,context=await browser.createBrowserContext(),page=await context.newPage();
 await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let denyWorkspace=false,projectReads=0,receiptReads=0,phase='preparation';
 const httpTasks=[baseTask(),...Array.from({length:99},(_,index)=>({...baseTask(),id:'guide-http-task-'+(index+1)}))],httpCursor=httpTasks.at(-1).id;
 await page.setRequestInterception(true);page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}
  if(!url.pathname.startsWith('/api/identity/'))return request.continue();
  requests.push({sequence:requests.length+1,phase,path:url.pathname,method:request.method(),query:url.search});assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
  if(request.method()!=='GET'){posts.push(request.postData());throw Error('HTML denial fixture permits GET only');}
  let body;
  if(url.pathname==='/api/identity/workspace'){
   if(!url.search)body={scope,organizationName:'Empresa de guía HTTP sintética',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};
   else{assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');projectReads++;
    if(denyWorkspace)return request.respond({status:denial,contentType:'text/html',headers:{'Cache-Control':'no-store'},body:'<html><body>private gateway diagnostic</body></html>'});
    body={scope,project:{id:'p-a',name:'Obra de prueba A',status:'ACTIVE'},roleLabel:'Jefe de obra',canPlanSchedule:false,tasks:httpTasks,totalTasks:101,nextCursor:httpCursor};
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
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');await page.waitForSelector('[data-worksite-live-refresh="CURRENT"]');await showGuide(page);
  await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculación');await page.waitForFunction(()=>window.__guideObservation?.channel?.ownLinked===true);assert.match(await guideStatus(page),/Tu vínculo personal está vigente/);
  if(action==='append'){await showWorkspaceSection(page,'schedule-title');await page.waitForSelector('[data-worksite-live-refresh="CURRENT"]');}
  else{await page.evaluate(body=>window.__prepareWorkspaceReference(body),{scope,projectId:'p-a',operationId:'11111111-1111-4111-8111-111111111111'});await showWorkspaceSection(page,'workspace-recovery-title');await waitText(page,'Operaciones por comprobar');}
  await page.waitForNetworkIdle({idleTime:0,concurrency:0,timeout:15000});const preparedProjectReads=projectReads;assert.ok(preparedProjectReads>=1,'A canonical project read must precede the denial action');
  phase='action';denyWorkspace=true;await click(page,action==='append'?'Cargar más tareas':'Comprobar recibo');
  await page.waitForSelector('[data-guide-observation="UNAVAILABLE"]',{timeout:6000});
  assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);assert.equal(await page.$('#worker-channel-title'),null);assert.equal(await page.$('#participant-title'),null);
  assert.equal(await page.$$eval('button',nodes=>nodes.filter(node=>node.textContent.includes('Obra de prueba A')).length),0);
  assert.ok(!(await guideStatus(page)).includes('Empresa consultada'));assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  assert.ok(!(await text(page)).includes('private gateway diagnostic'));assert.ok(!(await text(page)).includes('Unexpected token'));
  const actionProjectReads=requests.filter(request=>request.phase==='action'&&request.path==='/api/identity/workspace'&&new URLSearchParams(request.query).has('projectId'));
  assert.equal(projectReads-preparedProjectReads,1,'The explicit action must make exactly one additional project GET');assert.equal(actionProjectReads.length,1);assert.equal(new URLSearchParams(actionProjectReads[0].query).get('afterTask'),action==='append'?httpCursor:null);assert.equal(receiptReads,action==='readback'?1:0);assert.equal(posts.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(evidence,`workspace-${mode}-${width}.png`),fullPage:true});
  checks.push({mode,width,projectReads,actionProjectReads:actionProjectReads.length,receiptReads,posts:0,htmlDenialClearsAccount:true,htmlDenialClearsView:true,htmlDenialClearsGuideFacts:true,currentToken:true,requests});
 }catch(error){error.workspaceUiDiagnostic={diagnostic:'guide-http-denial-primary-failure',mode,width,phase,projectReads,receiptReads,posts:posts.length,requests};await page.screenshot({path:path.join(evidence,`workspace-${mode}-${width}-failure.png`),fullPage:true}).catch(()=>{});throw error;}
 finally{await context.close();}
}

async function portfolioAccessRaceScenario(width,denial,format,action='project'){
 const mode=`portfolio-access-race-${action}-${denial}-${format}`,context=await browser.createBrowserContext(),page=await context.newPage();
 await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let workspaceReads=0,projectReads=0,portfolioRequest=null,projectRequest=null,scheduleRequest=null,phase='prepare';
 const refreshedScope='b'.repeat(64);
 const references=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('obrasaas-pending-receipts-v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('references','readonly'),read=tx.objectStore('references').getAll();let rows;read.onsuccess=()=>{rows=read.result;};tx.oncomplete=()=>{db.close();resolve(JSON.stringify(rows));};tx.onerror=()=>{db.close();reject(tx.error);};};}));
 await page.setRequestInterception(true);page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}
  if(!url.pathname.startsWith('/api/identity/'))return request.continue();
  requests.push({path:url.pathname,method:request.method(),query:url.search,phase});assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
  if(request.method()!=='GET'){
   assert.equal(action,'schedule');assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.method(),'POST');
   const payload=JSON.parse(request.postData());assert.equal(payload.scope,scope);assert.equal(payload.taskId,'task-a');assert.equal(payload.projectId,'p-a');assert.equal(payload.expectedRevision,revision);assert.equal(payload.startsOn,'2026-10-07');assert.equal(payload.endsOn,'2026-10-15');posts.push(payload);scheduleRequest=request;return;
  }
  let body;
  if(url.pathname==='/api/identity/workspace'){
   if(!url.search){workspaceReads++;body={scope:workspaceReads===1?scope:refreshedScope,organizationName:workspaceReads===1?'Empresa de acceso sintético':'Empresa recién consultada',role:workspaceReads===1?'SITE_MANAGER':'AUDITOR',roleLabel:workspaceReads===1?'Jefe de obra':'Auditor',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:workspaceReads===1?'p-a':'p-c',name:workspaceReads===1?'Obra de prueba A':'Obra de nueva consulta'},...(workspaceReads===1?[{id:'p-b',name:'Obra de prueba B'}]:[])],projectsTruncated:false};}
   else if(url.searchParams.has('portfolio')){assert.equal(url.searchParams.get('scope'),scope);portfolioRequest=request;return;}
   else{assert.equal(url.searchParams.get('scope'),scope);projectReads++;if(url.searchParams.get('projectId')==='p-b'){projectRequest=request;return;}assert.equal(url.searchParams.get('projectId'),'p-a');body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:action!=='project',tasks:[baseTask()],totalTasks:1,nextCursor:null};}
  }else if(url.pathname==='/api/identity/worker-channel')body={scope,projectId:'p-a',channelReady:true,truncated:false,records:[{workerId:'own-worker',name:'Persona sintética',revision,state:'VERIFIED',eligible:true,binding:{id:'race-binding',verifiedAt:'2026-10-01T12:00:00Z',revokedAt:null}}]};
  else throw Error('Unexpected portfolio race endpoint '+url.pathname);
  await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de acceso sintético');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');await showGuide(page);
  await showWorkspaceSection(page,'worker-channel-title');await click(page,'Consultar vinculación');await page.waitForFunction(()=>window.__guideObservation?.channel?.ownLinked===true);
  await page.evaluate(body=>window.__prepareWorkspaceReference(body),{scope,projectId:'p-a',operationId:'22222222-2222-4222-8222-222222222222'});await showWorkspaceSection(page,'workspace-recovery-title');await waitText(page,'Operaciones por comprobar');
  const retainedReferences=await references(),observedGeneration=await page.evaluate(()=>window.__guideObservation.generation);assert.ok(retainedReferences.includes('22222222-2222-4222-8222-222222222222'));
  await showWorkspaceSection(page,'workspace-home-title');await click(page,'Consultar resumen');await page.waitForFunction(()=>document.querySelector('#portfolio-overview-title')?.closest('section').getAttribute('aria-busy')==='true');
  for(let i=0;i<80&&!portfolioRequest;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(portfolioRequest,'The portfolio read must be dispatched before the concurrent action');
  phase='race';
  if(action==='project'){
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());await page.waitForSelector('[data-guide-observation="CONSULTING"]');
   for(let i=0;i<40&&!projectRequest;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(projectRequest,'The project read must be dispatched before access denial');
  }else{
   await showWorkspaceSection(page,'schedule-title');await fill(page);if(action==='token')await page.evaluate(()=>{window.__holdToken=true;});await click(page,'Confirmar planificación');
   if(action==='token')await page.waitForFunction(()=>typeof window.__resolveToken==='function');
   else{for(let i=0;i<80&&!scheduleRequest;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(scheduleRequest,'The schedule command must be dispatched before access denial');}
  }
  const pendingReferences=await references();if(action==='schedule')assert.ok(pendingReferences.includes(posts[0].operationId));
  await portfolioRequest.respond({status:denial,contentType:format==='html'?'text/html':'application/json',headers:{'Cache-Control':'no-store'},body:format==='html'?'<html><body>private gateway diagnostic</body></html>':JSON.stringify({code:'WORKSPACE_CONTEXT_CHANGED'})});
  phase='denied';
  await page.waitForSelector('[data-guide-observation="UNAVAILABLE"]',{timeout:6000});
  assert.ok(await page.$$eval('button',nodes=>nodes.find(node=>node.textContent==='Actualizar')?.disabled===false),'An access denial must allow explicit account refresh');
  assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);assert.equal(await page.$('#worker-channel-title'),null);assert.equal(await page.$('#portfolio-overview-title'),null);
  assert.ok(!(await text(page)).includes('Empresa de acceso sintético'));assert.ok(!(await text(page)).includes('private gateway diagnostic'));assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  assert.ok(await page.evaluate(previous=>window.__guideObservation.generation>previous,observedGeneration));assert.equal(workspaceReads,1);
  // The old project response arrives after access was invalidated. It must not
  // restore private work or an observed guide state, even when cancellation
  // and response delivery race in the browser transport.
  if(action==='project')await projectRequest.respond({status:200,contentType:'application/json',body:JSON.stringify({scope,project:{id:'p-b',name:'Obra privada de respuesta anterior'},canPlanSchedule:false,tasks:[{...baseTask(),title:'Tarea privada de respuesta anterior'}],totalTasks:1,nextCursor:null})}).catch(()=>{});
  else if(action==='token')await page.evaluate(()=>{window.__holdToken=false;window.__resolveToken();});
  else{const payload=posts[0];await scheduleRequest.respond({status:200,contentType:'application/json',body:JSON.stringify({scope,saved:true,replayed:false,task:{...baseTask(),startsOn:payload.startsOn,endsOn:payload.endsOn,revision:'2026-10-01T12:00:00.111111'},receipt:{id:'workspace_schedule_'+ 'b'.repeat(64),taskId:'task-a',recordedAt:'2026-10-01T12:00:00.111111',before:{startsOn:'2026-10-01',endsOn:'2026-10-05'},after:{startsOn:payload.startsOn,endsOn:payload.endsOn}}})}).catch(()=>{});}
  await new Promise(resolve=>setTimeout(resolve,180));assert.equal(await page.$eval('[data-guide-observation]',node=>node.dataset.guideObservation),'UNAVAILABLE');assert.ok(!(await text(page)).includes('respuesta anterior'));assert.ok(!(await text(page)).includes('Cambio confirmado'));assert.equal(posts.length,action==='schedule'?1:0);
  const survivingReferences=await references();assert.ok(survivingReferences.includes('22222222-2222-4222-8222-222222222222'));if(action==='schedule')assert.equal(survivingReferences,pendingReferences);else if(action==='project')assert.equal(survivingReferences,retainedReferences);
  // Live refresh may already have made another authorized read of project A.
  // Fence the denial and explicit refresh instead of assuming a global total.
  const afterDenial=requests.filter(row=>row.phase==='denied'&&row.method==='GET');assert.deepEqual(afterDenial,[],'A denied account must not automatically read projects, channels or refresh itself');
  const selectedProjectReads=requests.filter(row=>row.path==='/api/identity/workspace'&&new URLSearchParams(row.query).get('projectId')==='p-b');assert.equal(selectedProjectReads.length,action==='project'?1:0,'The concurrent project selection must dispatch exactly once');
  phase='refresh';await click(page,'Actualizar');await waitText(page,'Empresa recién consultada');await page.waitForFunction(expected=>window.__guideObservation?.state==='OBSERVED'&&window.__guideObservation.scope===expected,{},refreshedScope);
  const refreshReads=requests.filter(row=>row.phase==='refresh'&&row.method==='GET');assert.deepEqual(refreshReads.map(row=>({method:row.method,path:row.path,query:row.query})),[{method:'GET',path:'/api/identity/workspace',query:''}],'Explicit account refresh must not re-open an old project or channel');
  assert.equal(await page.evaluate(()=>window.__guideObservation.channel),null);assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),null);assert.equal(await references(),survivingReferences);assert.equal(workspaceReads,2);assert.equal(posts.length,action==='schedule'?1:0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  checks.push({mode,width,denial,format,action,posts:posts.length,projectReads,selectedProjectReads:selectedProjectReads.length,readsAfterDenial:afterDenial.length,explicitAccountRefreshes:refreshReads.length,refreshUnlocked:true,guideUnavailable:true,lateResponseRejected:true,lateTokenPostBlocked:action==='token',channelSnapshotCleared:true,referencesPreserved:true,explicitFreshScope:true});
 }catch(error){error.workspaceUiDiagnostic={mode,width,denial,format,action,phase,workspaceReads,projectReads,posts:posts.length,requests};await page.screenshot({path:path.join(evidence,`workspace-${mode}-${width}-failure.png`),fullPage:true}).catch(()=>{});throw error;}
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
   for(const width of [320,390,768,1280])await workbenchScenario(width);
   await stalePaginationScenario();
   if(process.env.WORKSPACE_UI_SCENARIO==='workbench')for(const width of [320,390])await scenario('readonly',width);
  }
  if([undefined,'gantt-volume'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])await ganttVolumeScenario(width);
 if([undefined,'confirmed-progress','confirmed-progress-planning'].includes(process.env.WORKSPACE_UI_SCENARIO)){const progressModes=process.env.WORKSPACE_UI_SCENARIO==='confirmed-progress-planning'?['planning']:['readback','callback','planning'];for(const width of [390,1280])for(const mode of progressModes)await confirmedProgressScenario(mode,width);if(process.env.WORKSPACE_UI_SCENARIO==='confirmed-progress')await stalePaginationScenario();}
 if([undefined,'confirmed-progress','confirmed-progress-unloaded'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])for(const decision of ['APPROVE','REJECT'])await unloadedConfirmedProgressScenario(width,decision);
 if([undefined,'confirmed-progress','confirmed-progress-snapshots'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])for(const mode of ['loaded-current','invalid-snapshot'])await receiptSnapshotCoverageScenario(width,mode);
 if(process.env.WORKSPACE_UI_SCENARIO==='navigation')for(const width of [320,390,768,1280])for(const role of ['ADMIN','AUDITOR'])await navigationScenario(role,width);
 if(!process.env.WORKSPACE_UI_SCENARIO){
  for(const width of [320,390,768,1280])for(const mode of ['changed-again','get-failed','missing','denied-401','denied-403'])await scheduleConflictScenario(mode,width);
  for(const mode of ['foreign-project','foreign-scope','foreign-task','read-only','unmount-token','retry-conflict'])await scheduleConflictScenario(mode,390);
 for(const width of [320,390,768,1280])await scenario('success',width);
 for(const mode of ['readonly','denied','empty','draft-cancel','sdk-unavailable','unmount-token','uncertain','rollback','not-arrived','conflict','race'])await scenario(mode);
 for(const mode of ['draft-cancel','uncertain','rollback','not-arrived'])await taskCreateScenario(mode);
 for(const width of [320,390,768,1280])for(const role of ['ADMIN','AUDITOR'])await navigationScenario(role,width);
 for(const width of [320,768,1280])await scenario('uncertain',width);
 for(const width of [320,390,768,1280])for(const uncertain of [false,true])await mobileImportNavigationScenario(width,uncertain);
 }
 assert.deepEqual(pageErrors,[]);
 proof={status:'PASS',fullSuite:!process.env.WORKSPACE_UI_SCENARIO,focusedScenario:process.env.WORKSPACE_UI_SCENARIO||null,environment:'isolated-browser-with-intercepted-synthetic-api',widths:[320,390,768,1280],checks,pageErrors,sourceManifest,harnessSha256,productionLoginVerified:false,productionDataWritten:false,physicalWhatsAppVerified:false,documentCurveSourceManifest,fixtureTransforms:documentCurveFixtureTransforms};
}catch(error){primaryFailure=error;writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({status:'FAILED',message:error.message,diagnostic:error.workspaceUiDiagnostic||null,checks,pageErrors,sourceManifest,harnessSha256,serverLog,documentCurveSourceManifest,fixtureTransforms:documentCurveFixtureTransforms},null,2));throw error;}
finally{await cleanupHarness();}
writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
