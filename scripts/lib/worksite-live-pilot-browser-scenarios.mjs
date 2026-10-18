import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {PILOT_SCOPE as scope,PILOT_PROJECT as projectId,PILOT_REVISION as initialRevision,PILOT_TASKS} from './worksite-live-pilot-browser-fixture.mjs';

// Synthetic two-context browser proposal. No live authentication, database,
// provider, message, audio analysis or unattended business write is performed.
const clone=value=>JSON.parse(JSON.stringify(value));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function runWorksiteLivePilotBrowser({browser,origin,output,checks,errors,fixtureProof,evidenceSink={}}){
 const tasks=clone(PILOT_TASKS),facts=[],contexts=[],handlerErrors=[],posts=[],png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2l8AAAAASUVORK5CYII=','base64');let sequence=1,phase='initial',denyWorker=false;
 const revision=()=>`2026-10-18T10:00:00.${String(++sequence).padStart(6,'0')}`;
 const evidence=tasks.map(task=>({id:'e-'+task.id,title:'Original sintético '+task.id,taskId:task.id,workerId:'worker-pilot',sectorId:'sector-pilot',caption:'Evidencia sintética privada '+task.id,status:'APPROVED',revision:initialRevision,capturedAt:'2026-10-18T10:00:00.000Z',media:{kind:'image',contentType:'image/png',bytes:png.length,sha256:sha(png)},processing:{status:'NOT_REQUESTED'},review:{decision:'APPROVE',reason:'Original revisado por otra identidad sintética.',recordedAt:'2026-10-18T10:00:00.000Z'}}));
 const proposals=tasks.map((task,index)=>({id:'p-'+task.id,taskId:task.id,workerId:'worker-pilot',summary:'Medición sintética '+task.id,reason:'Propuesta humana sintética '+task.id,status:'PENDING',statusStored:'PENDING',revision:initialRevision,progress:25*(index+1),quantity:null,baseline:null,unit:null,evidenceIds:['e-'+task.id],expiresAt:'2026-12-31T12:00:00.000Z',result:null}));
 evidenceSink.requests=facts;evidenceSink.decisions=posts;
 const stamp=actor=>sha(JSON.stringify(['canonical-pilot-controlled-authority',scope,projectId,actor]));
 const field=actor=>({scope,projectId,projectRevision:initialRevision,reviewAccessStamp:stamp(actor),canConfigure:false,canReview:actor==='reviewer',canApproveProgress:actor==='reviewer',selfWorkers:actor==='worker'?[{id:'worker-pilot',name:'Operario sintético',canReport:true,canAttendance:false}]:[],workers:[{id:'worker-pilot',name:'Operario sintético'}],sectors:[{id:'sector-pilot',name:'Sector sintético'}],attendance:[],evidence:clone(evidence),proposals:clone(proposals),incidents:[],materialRequests:[],truncated:false});
 const workspace=()=>({scope,project:{id:projectId,name:'Piloto sintético compartido',status:'ACTIVE'},tasks:clone(tasks),totalTasks:3,nextCursor:null,canPlanSchedule:false,roleLabel:'DIRECTOR'});
 async function click(page,label,selector='button'){
  await page.waitForFunction((label,selector)=>[...document.querySelectorAll(selector)].some(button=>button.textContent.trim()===label&&!button.disabled),{timeout:20000},label,selector);
  const handle=await page.evaluateHandle((label,selector)=>[...document.querySelectorAll(selector)].find(button=>button.textContent.trim()===label&&!button.disabled),label,selector);await handle.asElement().click();await handle.dispose();
 }
 async function text(page,text,selector='body',timeout=20000){await page.waitForFunction((text,selector)=>document.querySelector(selector)?.innerText.includes(text),{timeout},text,selector);}
 async function stable(page,selector){await page.waitForFunction(selector=>document.querySelector(selector+' [data-worksite-live-refresh="CURRENT"]'),{timeout:20000},selector);}
 async function open(actor){
  const context=await browser.createBrowserContext(),page=await context.newPage();contexts.push(context);await page.setViewport({width:390,height:960});
  await page.evaluateOnNewDocument(actor=>{
   window.__pilotActor=actor;window.__pilotVisible=true;window.__pilotOnline=true;
   // Environmental controls only. Auth remains the normal synthetic bearer path.
   Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__pilotVisible?'visible':'hidden'});
   Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>window.__pilotOnline});
   window.__pilotEnvironment=(visible,online)=>{window.__pilotVisible=visible;window.__pilotOnline=online;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event(online?'online':'offline'));};
  },actor);
  page.on('pageerror',error=>errors.push({mode:'pilot-live-refresh',actor,error:error.message}));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource'))errors.push({mode:'pilot-live-refresh',actor,error:message.text()});});
  await page.setRequestInterception(true);
  page.on('request',async request=>{
   try{
    const url=new URL(request.url());if(url.origin!==origin){if(['blob:','data:'].includes(url.protocol))return request.continue();handlerErrors.push({actor,error:'External request blocked',url:url.origin});return request.abort();}
    if(!url.pathname.startsWith('/api/identity/'))return request.continue();
    const fact={actor,phase,method:request.method(),path:url.pathname,query:Object.fromEntries(url.searchParams),at:Date.now()};facts.push(fact);
    assert.equal(request.headers().authorization,'Bearer synthetic-pilot-'+actor);assert.equal(url.searchParams.get('scope')??(request.postData()?JSON.parse(request.postData()).scope:null),scope);
    const respond=(body,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(clone(body))});
    if(request.method()==='GET'&&url.pathname==='/api/identity/workspace'){assert.equal(url.searchParams.get('projectId'),projectId);assert.deepEqual(Object.keys(fact.query).sort(),['projectId','scope']);return respond(workspace());}
    assert.equal(url.pathname,'/api/identity/field-operations','Only canonical read/decision fixture endpoints are available');
    if(request.method()==='GET'){
     assert.equal(url.searchParams.get('projectId'),projectId);
     if(denyWorker&&actor==='worker')return respond({code:'FIELD_PERMISSION_REQUIRED'},403);
     if(url.searchParams.has('reviewSection')){
      const section=url.searchParams.get('reviewSection'),filter=url.searchParams.get('reviewFilter');assert.equal(url.searchParams.get('reviewAccessStamp'),stamp(actor));assert.ok(['EVIDENCE','PROGRESS'].includes(section));assert.ok(['ALL','PENDING'].includes(filter));assert.equal(url.searchParams.has('afterReview'),false);
      const records=(section==='EVIDENCE'?evidence:proposals).filter(row=>filter==='ALL'||row.status==='PENDING');return respond({scope,projectId,reviewAccessStamp:stamp(actor),reviewSection:section,reviewFilter:filter,afterReview:null,reviewId:null,records,total:records.length,nextCursor:null,canReview:actor==='reviewer',canApproveProgress:actor==='reviewer'});
     }
     assert.deepEqual(Object.keys(fact.query).sort(),['projectId','scope']);return respond(field(actor));
    }
    assert.equal(request.method(),'POST');assert.equal(actor,'reviewer','Participant browser must never auto-submit');
    const command=JSON.parse(request.postData());posts.push(clone(command));assert.equal(command.projectId,projectId);assert.equal(command.scope,scope);assert.equal(command.action,'DECIDE_PROGRESS');assert.match(command.operationId,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    const p=command.payload,proposal=proposals.find(row=>row.id===p.proposalId);assert.ok(proposal);assert.equal(proposal.status,'PENDING');assert.equal(proposal.revision,p.revision);assert.equal(p.decision,'APPROVE');assert.ok(p.reason.trim());
    proposal.status='APPLIED';proposal.statusStored='APPLIED';proposal.revision=revision();proposal.result={decision:'APPROVE',reason:p.reason,recordedAt:'2026-10-18T11:00:00.000Z',taskUpdated:true};
    const task=tasks.find(row=>row.id===proposal.taskId);task.progress=proposal.progress;task.status='IN_PROGRESS';task.revision=revision();
    return respond({scope,saved:true,receiptId:'field_'+command.operationId,kind:'PROGRESS_DECISION',proposal,task});
   }catch(error){handlerErrors.push({actor,error:error.message});try{await request.abort();}catch{/* Request may already be closed. */}}
  });
  await page.goto(origin+'/pilot-live-refresh',{waitUntil:'networkidle0'});await stable(page,'[data-pilot-schedule]');return {page,context};
 }
 try{
  const worker=await open('worker'),reviewer=await open('reviewer');
  await click(reviewer.page,'Ver campo piloto');await click(reviewer.page,'Abrir operaciones','[data-pilot-field] button');await click(reviewer.page,'Avance','[data-pilot-field] button');await stable(reviewer.page,'[data-pilot-field]');
  phase='three-human-decisions';const workspaceBefore=facts.filter(row=>row.actor==='worker'&&row.path==='/api/identity/workspace').length;
  for(let index=0;index<3;index++){
   await click(reviewer.page,'Decidir propuesta','[data-pilot-field] button');await reviewer.page.waitForSelector('form textarea');
   // React's controlled textarea needs native typing, preserving the explicit gesture.
   const area=await reviewer.page.$('form textarea');await area.click();await reviewer.page.keyboard.down('Control');await reviewer.page.keyboard.press('A');await reviewer.page.keyboard.up('Control');await area.type('Revisión humana sintética independiente '+index);await area.dispose();
   await click(reviewer.page,'Guardar con recibo','[data-pilot-field] button');await reviewer.page.waitForFunction(()=>!document.querySelector('form'));
  }
  assert.equal(posts.length,3);assert.equal(new Set(posts.map(row=>row.operationId)).size,3);
  await worker.page.waitForFunction(()=>['a','b','c'].every((name,index)=>document.querySelector('[data-gantt-task-id="task-'+name+'"]')?.innerText.includes(25*(index+1)+' % registrado')),{timeout:65000});
  assert.equal(facts.filter(row=>row.actor==='worker'&&row.path==='/api/identity/workspace').length-workspaceBefore,1,'One active schedule round must refresh all three tasks');
  for(const task of tasks){const old=PILOT_TASKS.find(row=>row.id===task.id);assert.equal(task.startsOn,old.startsOn);assert.equal(task.endsOn,old.endsOn);}
  assert.equal(facts.filter(row=>row.actor==='worker'&&row.path==='/api/identity/field-operations').length,0,'Mounted hidden Field panel must not poll');
  checks.push('pilot-two-actor-three-explicit-decisions-one-schedule-GET-real-Gantt-no-date-inference');

  await click(worker.page,'Ver campo piloto');await click(worker.page,'Abrir operaciones','[data-pilot-field] button');await click(worker.page,'Avance','[data-pilot-field] button');await stable(worker.page,'[data-pilot-field]');
  await worker.page.waitForFunction(()=>[...document.querySelectorAll('[data-pilot-field] article')].filter(node=>node.innerText.includes('Aprobado y aplicado')).length===3);
  await click(worker.page,'Proponer avance','[data-pilot-field] button');const area=await worker.page.$('form textarea');assert.ok(area);await area.type('Borrador humano conservado: revisión de albañilería.');await area.evaluate(node=>{node.focus();node.setSelectionRange(7,20);window.__pilotDraftNode=node.closest('form');});await area.dispose();
  const snapshot=()=>worker.page.evaluate(()=>({sameForm:document.querySelector('form')===window.__pilotDraftNode,fields:[...document.querySelectorAll('form input,form select,form textarea')].map(node=>({tag:node.tagName,type:node.type,value:node.value,checked:node.checked})),focusTag:document.activeElement?.tagName,selection:[document.activeElement?.selectionStart,document.activeElement?.selectionEnd]}));
  const before=await snapshot(),getsBefore=facts.filter(row=>row.actor==='worker'&&row.method==='GET').length;phase='draft-pause';await sleep(52000);assert.deepEqual(await snapshot(),before);assert.equal(facts.filter(row=>row.actor==='worker'&&row.method==='GET').length,getsBefore);assert.equal(posts.length,3);
  checks.push('pilot-real-mounted-draft-form-values-node-focus-cursor-preserved-no-GET-or-POST-for-full-45s-period');
  await click(worker.page,'Cancelar','[data-pilot-field] button');await stable(worker.page,'[data-pilot-field]');

  phase='environment-pause';await worker.page.evaluate(()=>window.__pilotEnvironment(false,false));const paused=facts.filter(row=>row.actor==='worker'&&row.method==='GET').length;await sleep(6000);assert.equal(facts.filter(row=>row.actor==='worker'&&row.method==='GET').length,paused);
  await worker.page.evaluate(()=>{window.__pilotEnvironment(true,true);for(let i=0;i<6;i++)window.dispatchEvent(new Event('focus'));});await stable(worker.page,'[data-pilot-field]');await sleep(6500);
  const resumed=facts.filter(row=>row.actor==='worker'&&row.method==='GET').length-paused;assert.ok(resumed>=2&&resumed<=3,'One bounded field round after repeated focus events');
  checks.push('pilot-controlled-hidden-offline-pause-and-focus-events-coalesce-into-one-2-to-3-GET-round');

  phase='timer-denial';denyWorker=true;const denialStart=facts.length;
  await worker.page.waitForFunction(()=>!document.querySelector('[data-pilot-field] nav[aria-label="Operaciones de campo"]'),{timeout:65000});await text(worker.page,'Tu acceso cambió','[data-pilot-field]');
  assert.equal(await worker.page.$('[data-pilot-field] form'),null);assert.equal(await worker.page.$$eval('[data-pilot-field] [data-field-evidence]',nodes=>nodes.length),0);assert.equal(await worker.page.$eval('[data-pilot-field]',node=>node.innerText.includes('Propuesta humana sintética')),false);
  assert.ok(facts.slice(denialStart).some(row=>row.actor==='worker'&&row.method==='GET'&&row.path==='/api/identity/field-operations'));assert.equal(posts.length,3);
  const deniedReads=facts.filter(row=>row.actor==='worker'&&row.method==='GET').length;await sleep(52000);assert.equal(facts.filter(row=>row.actor==='worker'&&row.method==='GET').length,deniedReads,'No new read during a full 45s + jitter window after current denial');assert.equal(posts.length,3);
  checks.push('pilot-automatic-current-403-clears-private-field-records-and-stops-for-52s-with-no-business-write');
  assert.deepEqual(handlerErrors,[]);assert.deepEqual(errors,[]);
  checks.push('pilot-exact-ledger-three-unique-explicit-decisions-no-external-provider-or-worker-POST');
  const proof={version:1,status:'PASS',checkedAt:new Date().toISOString(),fixtureProof,syntheticOnly:true,participantAndReviewerContexts:2,taskCount:3,actualFieldOperationsPanelMounted:true,actualScheduleWorkbenchMounted:true,canonicalScheduleCallbacksExtractedWithoutTransform:true,accountWorkspaceMounted:false,real45SecondPeriodRetained:true,environmentVisibilityAndOnlineControlled:true,networkScope:'localhost fixture only',requests:facts,decisions:posts.map(row=>({action:row.action,operationId:row.operationId,proposalId:row.payload.proposalId})),datesUnchanged:true,checks:checks.filter(value=>String(value).startsWith('pilot-')),providerCalls:0,metaMessagesSent:0,productionDataWritten:false,realAccountsAccepted:false,pending:['Actual AccountWorkspace integration and browser visibility under the OS.','Late denial after transport abort/body timing remains covered at controller level only.','Canonical transaction contention and two real authenticated accounts.']};
  const target=path.join(output,'browser-pilot-live-refresh-detail-'+Date.now()+'.json');writeFileSync(target,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});return {target,sha256:sha(JSON.stringify(proof,null,2)+'\n'),checks:proof.checks.length};
 }finally{for(const context of contexts)await context.close();}
}
