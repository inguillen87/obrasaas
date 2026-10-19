import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {canonicalFixture} from './helpers/field-hours-fixture.mjs';

// Real canonical admission and field GET, with synthetic SQL rows only. The
// JSX below is the actual panel; hooks/transport are controlled, not a browser.
const result=rows=>({rows:structuredClone(rows)});
function fixture(){
 const f=canonicalFixture({role:'DIRECTOR',linked:true}),baseQuery=f.client.query.bind(f.client);
 f.state.project.revision='2026-10-19T12:00:00.000001';
 f.state.project.metadata={fieldOperations:{sectors:[{id:'sector-a',name:'Sector de prueba',latitude:0,longitude:0,radius:100}]}};
 f.state.workers.push(f.own,{id:'worker-other',projectId:f.state.project.id,name:'Otra ficha',active:true});
 f.client.query=async(sql,args=[])=>{
  if(sql.startsWith('SELECT id,name,active,metadata FROM public."Worker"')){
   f.queries.push({sql,args:structuredClone(args)});
   return result(sql.includes("->>'clerkUserId'=$2")?f.state.ownWorkers.filter(row=>row.projectId===args[0]&&row.active&&row.metadata.participant.status==='ACTIVE'&&row.metadata.participant.clerkUserId===args[1]&&row.metadata.participant.kyc.status==='APPROVED'):f.state.workers.filter(row=>row.projectId===args[0]&&row.active).slice(0,101));
  }
  if(sql.includes('FROM public."AttendanceEntry"')){
   f.queries.push({sql,args:structuredClone(args)});
   assert.match(sql,/^SELECT /);assert.doesNotMatch(sql,/FOR (?:UPDATE|SHARE)/);
   if(sql.startsWith('SELECT DISTINCT ON ("workerId")')){
    assert.equal(args[0],f.state.project.id);
    assert.match(sql,/"workerId"=ANY\(\$2::text\[\]\)/);
    assert.match(sql,/metadata->'fieldOperations'->>'version'='1'/);
    assert.match(sql,/ORDER BY "workerId",\(metadata->'fieldOperations'->>'sequence'\)::int DESC,id DESC$/);
    const eligible=f.state.ledger.filter(row=>row.projectId===args[0]&&args[1].includes(row.workerId)&&row.metadata.fieldOperations.version===1);
    return result(args[1].flatMap(id=>eligible.filter(row=>row.workerId===id).sort((a,b)=>b.metadata.fieldOperations.sequence-a.metadata.fieldOperations.sequence||b.id.localeCompare(a.id)).slice(0,1)));
   }
   if(sql.includes(' a JOIN public."Worker"'))return result([]);
   assert.match(sql,/ORDER BY "checkedInAt" DESC,id DESC LIMIT 101$/);
   return result(f.state.ledger.filter(row=>row.projectId===args[0]&&args[1].includes(row.workerId)&&row.metadata.fieldOperations.version===1&&(args[2]===true||row.metadata.fieldOperations.recordedBy===args[3])).sort((a,b)=>b.metadata.fieldOperations.recordedAt.localeCompare(a.metadata.fieldOperations.recordedAt)||b.id.localeCompare(a.id)).slice(0,101));
  }
  if(sql.includes('FROM public."Incident"')||sql.includes("action='material.inventory.moved'")){
   f.queries.push({sql,args:structuredClone(args)});return result([]);
  }
  if(sql.startsWith('SELECT id,summary,status::text AS status,action,result,')&&sql.includes('FROM public."OperationalProposal"')){
   f.queries.push({sql,args:structuredClone(args)});assert.equal(args[0],f.state.project.id);
   assert.match(sql,/WHERE "projectId"=\$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field'/);
   assert.match(sql,/action->>'fieldOperationsVersion'='1'/);return result([]);
  }
  return baseQuery(sql,args);
 };
 f.readField=()=>f.operations.read(f.session,{projectId:f.context.projectId,scope:f.context.scope});
 f.event=({id='own-start',workerId=f.own.id,projectId=f.state.project.id,eventType='CHECK_IN',sequence=1,actor=f.member.actorId,at=0}={})=>({id,workerId,projectId,recordedAt:new Date(Date.UTC(2026,9,19,12,0,at)).toISOString(),metadata:{private:'PRIVATE_UNRELATED_METADATA',fieldOperations:{version:1,eventType,phase:eventType==='BREAK_START'?'ON_BREAK':'WORKING',sequence,recordedAt:new Date(Date.UTC(2026,9,19,12,0,at)).toISOString(),recordedBy:actor,shiftId:'shift-private',sectorName:'PRIVATE_SECTOR',location:{latitude:12.3,longitude:45.6},review:{reason:'PRIVATE_REVIEW'}}}});
 return f;
}
const headsRead=f=>f.queries.filter(row=>row.sql.startsWith('SELECT DISTINCT ON ("workerId")'));

test('the current own head survives one hundred newer worksite events with the POST ordering and a minimal DTO',async()=>{
 const f=fixture(),earlier=f.event({id:'own-a',sequence:7}),latest=f.event({id:'own-z',sequence:7});
 f.state.ledger.push(earlier,latest,...Array.from({length:101},(_,index)=>f.event({id:'other-'+index,workerId:'worker-other',actor:'actor-other',at:index+1})),f.event({id:'foreign-later',projectId:'project-foreign',sequence:99}));
 const page=await f.readField();
 assert.equal(page.attendance.length,100);assert.equal(page.truncated,true);assert.equal(page.attendance.some(row=>row.workerId===f.own.id),false);
 assert.deepEqual(page.selfAttendanceHeads,[{workerId:f.own.id,status:'CURRENT',head:{id:'own-z',eventType:'CHECK_IN',phase:'WORKING',sequence:7,recordedAt:latest.metadata.fieldOperations.recordedAt}}]);
 assert.doesNotMatch(JSON.stringify(page.selfAttendanceHeads),/PRIVATE_|latitude|longitude|recordedBy|review|shiftId|sector/);
 assert.equal(headsRead(f).length,1);assert.deepEqual(headsRead(f)[0].args,[f.state.project.id,[f.own.id]]);
 assert.equal(f.queries[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.queries.at(-1).sql,'ROLLBACK');
});

test('only a confirmed empty source admits EMPTY and malformed or reassigned heads stay unavailable',async()=>{
 const f=fixture();assert.deepEqual((await f.readField()).selfAttendanceHeads,[{workerId:f.own.id,status:'EMPTY',head:null}]);
 for(const change of [row=>row.metadata.fieldOperations.phase='ON_BREAK',row=>row.metadata.fieldOperations.sequence=0,row=>row.metadata.fieldOperations.recordedAt='invalid',row=>row.metadata.fieldOperations.recordedBy='previous-account']){
  const row=f.event();change(row);f.state.ledger=[row];assert.deepEqual((await f.readField()).selfAttendanceHeads,[{workerId:f.own.id,status:'UNAVAILABLE',head:null}]);
 }
 const closed=f.event({eventType:'CHECK_OUT'});f.state.ledger=[closed];assert.equal((await f.readField()).selfAttendanceHeads[0].head.phase,'WORKING','Retain the existing canonical checkout phase');
});

test('revoking the current own attendance permission removes the head without transferring another account history',async()=>{
 const f=fixture();f.state.ledger.push(f.event());assert.equal((await f.readField()).selfAttendanceHeads.length,1);
 f.own.metadata.participant.permissions.attendance=false;const before=headsRead(f).length;assert.deepEqual((await f.readField()).selfAttendanceHeads,[]);assert.equal(headsRead(f).length,before);
 f.own.metadata.participant.permissions.attendance=true;f.own.metadata.participant.clerkUserId='different-account';assert.deepEqual((await f.readField()).selfAttendanceHeads,[]);assert.equal(headsRead(f).length,before);
});

test('membership and scope revocation fail before reading an own head through the canonical project operation',async()=>{
 const f=fixture();await f.readField();const before=headsRead(f).length;
 f.state.kycReview=false;await assert.rejects(f.readField(),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED',status:403});assert.equal(headsRead(f).length,before);f.state.kycReview=true;
 f.state.memberActive=false;await assert.rejects(f.readField(),{code:'WORKSPACE_MEMBERSHIP_REQUIRED',status:403});assert.equal(headsRead(f).length,before);
 f.state.memberActive=true;f.context.scope='f'.repeat(64);await assert.rejects(f.readField(),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});assert.equal(headsRead(f).length,before);
});

const account=new URL('../src/app/(identity)/cuenta/',import.meta.url),lib=new URL('../src/lib/',import.meta.url);
const source=readFileSync(new URL('field-operations-panel.js',account),'utf8').replace(/^import .*;\r?\n/gm,'');
const stateNames=[...source.matchAll(/\[([A-Za-z]+),set[A-Za-z]+\]=useState/g)].map(match=>match[1]);
const importer=(names,file,base=account)=>`import {${names}} from ${JSON.stringify(new URL(file,base).href)};`;
const prefix=`import React from ${JSON.stringify(import.meta.resolve('react'))};
${importer('createWorkspaceRequestLifecycle','workspace-request-lifecycle.mjs')}
${importer('collectRetainedPages,retainedRows,liveContextChanged','workspace-live-read.mjs')}
${importer('FIELD_OVERTIME_RECOVERY_ACTIONS','workspace-recovery-journal.mjs')}
${importer('FIELD_PROGRESS_PENDING_EVENT,fieldReviewPage,mergeFieldReviewRows','field-review-page-view.mjs')}
${importer('fieldMediaAttemptReference,fieldMediaHeldOutcome,fieldMediaHeldMessage,fieldMediaEvidenceHeld,fieldMediaReviewEligible','field-media-held-view.mjs')}
${importer('taskMeasurementView,measurementProposalPreview,measurementProposalPayload,prepareMeasuredVoiceProgress,measuredQuantityLabel,measurementConfirmation,measurementConfirmationMatches','task-progress-measurement-view.mjs')}
${importer('voiceProgressDraftReady,voiceProgressUnitLabel','voice-progress-draft.mjs',lib)}
${importer('validateReportedLocation','geo.js',lib)}
${importer('FIELD_MEDIA_PRIVACY_NOTICE,fieldMediaAnalysisConsent,FIELD_VIDEO_PRIVACY_NOTICE,FIELD_VIDEO_PRIVACY_NOTICE_VERSION,FIELD_VIDEO_AUDIO_PRIVACY_NOTICE,fieldVideoAnalysisConsent','field-media-privacy.mjs',lib)}
let states=[],refs=[],effects=[],pendingEffects=[],stateCursor=0,refCursor=0,effectCursor=0,calls=[],responses=[],lifecycle;
const useState=initial=>{const index=stateCursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return [states[index],next=>{states[index]=typeof next==='function'?next(states[index]):next;}];};
const useRef=initial=>{const index=refCursor++;return refs[index]??(refs[index]={current:initial});};
const useEffect=(callback,deps)=>{const index=effectCursor++,previous=effects[index];if(!previous||deps===undefined||deps.some((value,i)=>value!==previous.deps?.[i]))pendingEffects.push(()=>{previous?.cleanup?.();effects[index]={deps,cleanup:callback()};});};
const useLayoutEffect=useEffect,useWorkspaceRequest=()=>lifecycle.request;
const window={addEventListener(){},removeEventListener(){}};
const useWorksiteLiveRefresh=()=>({status:{state:'IDLE',checkedAt:null,updates:false},check(){throw Error('No live scheduling in attendance fixture');}});
const styles={},WorksiteLiveRefreshStatus=()=>null,WorksiteTaskSelector=()=>null,FieldMediaCapture=()=>null,FieldMediaPreview=()=>null,FieldQrCapture=()=>null,PrivateWorkspaceDownload=()=>null,FieldOvertimeJourney=()=>null,FieldOvertimeForm=()=>null,FieldHoursReportPanel=()=>null,VoiceProgressDraftView=()=>null;
`;
const suffix=`
export function unmount(){for(const effect of effects)effect?.cleanup?.();lifecycle?.abort();}
export function reset(seed,replies=[]){unmount();states=[];refs=[];effects=[];calls=[];responses=[...replies];for(const [name,value]of Object.entries(seed)){const index=${JSON.stringify(stateNames)}.indexOf(name);if(index<0)throw Error('Unknown state '+name);states[index]=value;}
 lifecycle=createWorkspaceRequestLifecycle(async()=> 'synthetic-attendance-token',{fetchImpl:async(url,options)=>{calls.push({url,method:options.method||'GET'});const next=responses.shift();if(!next)throw Error('Unexpected HTTP');return new Response(JSON.stringify(next.body),{status:next.status??200,headers:{'Content-Type':'application/json'}});}});
}
export function render(props){stateCursor=refCursor=effectCursor=0;pendingEffects=[];const tree=FieldOperationsPanelInner(props);for(const effect of pendingEffects)effect();return tree;}
export const snapshot=()=>Object.fromEntries(${JSON.stringify(stateNames)}.map((name,index)=>[name,states[index]]));export const requests=()=>calls;
`;
await loadBindings();
const compiled=await transform(prefix+source+suffix,{filename:'actual-attendance-head-panel.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}}),panel=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const text=tree=>typeof tree==='string'?tree:typeof tree==='number'?String(tree):tree?.props?React.Children.toArray(tree.props.children).map(text).join(''):'';
function nodes(tree,predicate,result=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,result);return result;}
const button=(tree,label)=>{const found=nodes(tree,node=>node.type==='button'&&text(node)===label);assert.equal(found.length,1,'Exactly one '+label);return found[0];};
const props=page=>({projectId:page.projectId,scope:page.scope,getSessionToken:async()=> 'synthetic-attendance-token'});
const attendanceButtons=['Ingreso','Iniciar pausa','Volver de la pausa','Salida'];

test('the actual panel can prepare a checkout for its own head outside the global history window',async()=>{
 const f=fixture(),own=f.event();f.state.ledger.push(own,...Array.from({length:101},(_,index)=>f.event({id:'other-'+index,workerId:'worker-other',actor:'other-account',at:index+1})));
 const page=await f.readField();panel.reset({opened:true,tab:'JOURNEY',data:page});let tree=panel.render(props(page));
 assert.equal(button(tree,'Ingreso').props.disabled,true);assert.equal(button(tree,'Salida').props.disabled,false);assert.equal(button(tree,'Iniciar pausa').props.disabled,false);assert.equal(button(tree,'Volver de la pausa').props.disabled,true);
 button(tree,'Salida').props.onClick();tree=panel.render(props(page));assert.equal(panel.snapshot().draft.payload.expectedEventId,own.id);assert.equal(panel.snapshot().draft.payload.workerId,f.own.id);assert.deepEqual(panel.requests(),[]);panel.unmount();
 own.id='own-pause';Object.assign(own.metadata.fieldOperations,{eventType:'BREAK_START',phase:'ON_BREAK',sequence:2});const paused=await f.readField();panel.reset({opened:true,tab:'JOURNEY',data:paused});tree=panel.render(props(paused));
 assert.equal(button(tree,'Salida').props.disabled,true);assert.equal(button(tree,'Iniciar pausa').props.disabled,true);assert.equal(button(tree,'Volver de la pausa').props.disabled,false);button(tree,'Volver de la pausa').props.onClick();panel.render(props(paused));assert.equal(panel.snapshot().draft.payload.expectedEventId,'own-pause');assert.deepEqual(panel.requests(),[]);panel.unmount();
});

test('missing malformed duplicate and foreign-context head DTOs never infer a fresh check-in from the history page',async()=>{
 const f=fixture();f.state.ledger.push(f.event({eventType:'CHECK_OUT'}));const page=await f.readField();
 for(const mutate of [value=>delete value.selfAttendanceHeads,value=>value.selfAttendanceHeads=[],value=>value.selfAttendanceHeads.push(value.selfAttendanceHeads[0]),value=>value.selfAttendanceHeads[0].head.sequence=0,value=>value.selfAttendanceHeads[0].head.phase='CLOSED',value=>value.selfAttendanceHeads[0]={workerId:f.own.id,status:'UNAVAILABLE',head:null},value=>value.scope='b'.repeat(64),value=>value.projectId='project-foreign']){
  const value=structuredClone(page);mutate(value);panel.reset({opened:true,tab:'JOURNEY',data:value});const tree=panel.render(props(page));for(const label of attendanceButtons)assert.equal(button(tree,label).props.disabled,true,label);assert.match(text(tree),/jornada sin confirmar/);assert.deepEqual(panel.requests(),[]);panel.unmount();
 }
});

test('an explicitly empty own source enables only check-in while an unknown draft cannot submit',async()=>{
 const f=fixture(),page=await f.readField();panel.reset({opened:true,tab:'JOURNEY',data:page});let tree=panel.render(props(page));assert.equal(button(tree,'Ingreso').props.disabled,false);for(const label of attendanceButtons.slice(1))assert.equal(button(tree,label).props.disabled,true,label);
 button(tree,'Ingreso').props.onClick();tree=panel.render(props(page));assert.equal(panel.snapshot().draft.payload.expectedEventId,null);panel.unmount();
 const unknown={...page,selfAttendanceHeads:[]},draft={key:'draft-unknown',action:'ATTENDANCE',payload:{workerId:f.own.id,eventType:'CHECK_IN',expectedEventId:null,sectorId:'sector-a',qrToken:'',location:{latitude:0,longitude:0,accuracy:1,capturedAt:'2026-10-19T12:00:00.000Z',noticeVersion:'field-location-v1'}}};
 panel.reset({opened:true,tab:'JOURNEY',data:unknown,draft});tree=panel.render(props(page));assert.equal(button(tree,'Guardar con recibo').props.disabled,true);await nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});assert.deepEqual(panel.requests(),[]);assert.equal(panel.snapshot().draft.key,draft.key);panel.unmount();
});

test('a denied or wrong-context refresh clears the actual panel head and prepared attendance before another action',async()=>{
 const f=fixture();f.state.ledger.push(f.event());const page=await f.readField();
 for(const response of [{status:403,body:{code:'WORKSPACE_MEMBERSHIP_REQUIRED'}},{body:{...page,scope:'b'.repeat(64)}}]){
  panel.reset({opened:true,tab:'JOURNEY',data:page},[response]);let tree=panel.render(props(page));button(tree,'Salida').props.onClick();tree=panel.render(props(page));assert.ok(panel.snapshot().draft);
  await button(tree,'Actualizar').props.onClick();tree=panel.render(props(page));assert.equal(panel.snapshot().data,null);assert.equal(panel.snapshot().draft,null);assert.equal(nodes(tree,node=>node.type==='button'&&attendanceButtons.includes(text(node))).length,0);assert.deepEqual(panel.requests().map(call=>call.method),['GET']);panel.unmount();
 }
});
