import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {fieldMediaAttemptReference,fieldMediaHeldOutcome} from '../src/app/(identity)/cuenta/field-media-held-view.mjs';

// The production JSX, request lifecycle and durable receipt journal run here.
// React scheduling and HTTP are controlled: no live session/provider/browser
// or municipal/field/human acceptance is implied by this synthetic evidence.
const account=new URL('../src/app/(identity)/cuenta/',import.meta.url),lib=new URL('../src/lib/',import.meta.url);
const source=readFileSync(new URL('field-operations-panel.js',account),'utf8').replace(/^import .*;\r?\n/gm,'');
const stateNames=[...source.matchAll(/\[([A-Za-z]+),set[A-Za-z]+\]=useState/g)].map(match=>match[1]),refNames=[...source.matchAll(/([A-Za-z]+)=useRef\(/g)].map(match=>match[1]);
const importer=(names,file,base=account)=>`import {${names}} from ${JSON.stringify(new URL(file,base).href)};`;
const prefix=`import React from ${JSON.stringify(import.meta.resolve('react'))};
${importer('createWorkspaceRequestLifecycle','workspace-request-lifecycle.mjs')}
${importer('collectRetainedPages,retainedRows,liveContextChanged','workspace-live-read.mjs')}
${importer('createWorkspaceRecoveryJournal,FIELD_OVERTIME_RECOVERY_ACTIONS','workspace-recovery-journal.mjs')}
${importer('ATTENDANCE_CLOSURE_ACTIONS,attendanceClosureViewMatches,attendanceClosurePayload,attendanceClosureOutcome','attendance-closure-view.mjs')}
${importer('fieldMediaAttemptReference,fieldMediaHeldOutcome,fieldMediaHeldMessage,fieldMediaEvidenceHeld,fieldMediaReviewEligible','field-media-held-view.mjs')}
${importer('fieldReviewPage,mergeFieldReviewRows','field-review-page-view.mjs')}
${importer('taskMeasurementView,measurementProposalPreview,measurementProposalPayload,prepareMeasuredVoiceProgress,measuredQuantityLabel,measurementConfirmation,measurementConfirmationMatches','task-progress-measurement-view.mjs')}
${importer('voiceProgressDraftReady,voiceProgressUnitLabel','voice-progress-draft.mjs',lib)}
${importer('validateReportedLocation','geo.js',lib)}
${importer('FIELD_MEDIA_PRIVACY_NOTICE,fieldMediaAnalysisConsent,FIELD_VIDEO_PRIVACY_NOTICE,FIELD_VIDEO_PRIVACY_NOTICE_VERSION,FIELD_VIDEO_AUDIO_PRIVACY_NOTICE,fieldVideoAnalysisConsent','field-media-privacy.mjs',lib)}
let states=[],refs=[],stateCursor=0,refCursor=0,calls=[],responses=[],lifecycle,journal,commitLayout=false,layoutEffects=[];
const useState=initial=>{const i=stateCursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];};
const useRef=initial=>{const i=refCursor++;return refs[i]??(refs[i]={current:initial});};
const useEffect=()=>{},useLayoutEffect=callback=>{if(commitLayout)layoutEffects.push(callback);},useWorkspaceRequest=()=>lifecycle.request;
// Historical held-media cases: live scheduling and sibling hours UI are outside this harness.
const useWorksiteLiveRefresh=()=>({status:{state:'IDLE',checkedAt:null,updates:false},check(){throw Error('Live refresh is outside the held-media fixture');}});
const WorksiteLiveRefreshStatus=()=>null,FieldHoursReportPanel=()=>null;
const WorksiteTaskSelector=()=>null;
const styles={},FieldMediaCapture=()=>null,FieldMediaPreview=()=>null,FieldQrCapture=()=>null,PrivateWorkspaceDownload=()=>null,FieldOvertimeJourney=()=>null,FieldOvertimeForm=()=>null,VoiceProgressDraftView=()=>null;
`;
const suffix=`
export function reset(seed,replies,options={}){states=[];refs=[];calls=[];responses=[...replies];commitLayout=options.commitLayout===true;for(const [name,value]of Object.entries(seed))states[${JSON.stringify(stateNames)}.indexOf(name)]=value;
 const records=new Map(),storage={get length(){return records.size;},key:index=>[...records.keys()][index]??null,getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
 journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>1});
 lifecycle=createWorkspaceRequestLifecycle(async()=> 'synthetic-field-held-session',{journal,fetchImpl:async(url,options)=>{const method=options.method||'GET';const input=method==='POST'?(options.body instanceof FormData?Object.fromEntries(options.body):JSON.parse(options.body)):Object.fromEntries(new URL(url,'https://synthetic.invalid').searchParams);calls.push({url,method,input,body:options.body});const next=responses.shift();if(!next)throw Error('Unexpected synthetic HTTP');if(next.method!==method)throw Error('Unexpected synthetic method');const body=typeof next.body==='function'?next.body(input):next.body;return new Response(JSON.stringify(body),{status:next.status??200,headers:{'Content-Type':'application/json'}});}});
}
export const render=props=>{stateCursor=refCursor=0;layoutEffects=[];const tree=FieldOperationsPanelInner(props);for(const effect of layoutEffects)effect();return tree;};
export const snapshot=()=>Object.fromEntries(${JSON.stringify(stateNames)}.map((name,i)=>[name,states[i]]));
export const requests=()=>calls;
export const durable=scope=>journal.list(scope);
`;
await loadBindings();
const compiled=await transform(prefix+source+suffix,{filename:'actual-field-media-held-ui.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}}),panel=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const scope='a'.repeat(64),projectId='project-synthetic',operationId='abcdefab-1234-4abc-9abc-abcdef123456',evidenceId='evidence-synthetic',revision='2026-10-07T12:00:00.000001';
const reference={projectId,scope,operationId,action:'PROCESS_EVIDENCE',evidenceId};
const evidence={id:evidenceId,title:'Evidencia sintética',taskId:'task-synthetic',workerId:'worker-synthetic',sectorId:'sector-synthetic',caption:'Sólo datos sintéticos.',revision,capturedAt:'2026-10-07T12:00:00.000Z',status:'PENDING',review:null,media:{kind:'image',contentType:'image/png',bytes:100,sha256:'b'.repeat(64)},processing:{status:'MANUAL_REVIEW_REQUIRED',code:'FIELD_MEDIA_PROVIDER_PENDING',humanReviewRequired:true,providerPending:true}};
const postHeld=(operation,code='FIELD_MEDIA_PROVIDER_PENDING')=>({scope,projectId,operationId:operation,action:'PROCESS_EVIDENCE',state:'PROVIDER_PENDING',saved:false,replayed:false,definitive:false,code,retryAfterExpiration:false,evidence:{...evidence,processing:{...evidence.processing,code}}});
const getHeld=(operation,code='FIELD_MEDIA_PROVIDER_PENDING')=>({scope,projectId,operationId:operation,action:'PROCESS_EVIDENCE',state:'PROVIDER_PENDING',saved:false,definitive:false,code,retryAfterExpiration:false,evidenceId,expiresAt:'2026-10-07T12:01:30.000Z',leaseExpired:true});
const data={scope,projectId,canConfigure:false,canReview:true,canApproveProgress:false,selfWorkers:[{id:'worker-synthetic',name:'Ficha sintética',canReport:true}],sectors:[{id:'sector-synthetic',name:'Sector sintético'}],evidence:[{...evidence,processing:{status:'QUEUED'}}],proposals:[],attendance:[],incidents:[],materialRequests:[],journeys:[]};
const draft={key:'synthetic-draft',action:'PROCESS_EVIDENCE',payload:{evidenceId,revision,analysisConsent:{allowed:true,noticeVersion:'field-media-analysis-v1',noticeSha256:'c'.repeat(64)}}};
const props={projectId,scope,tasks:[{id:'task-synthetic',title:'Tarea sintética',revision}],getSessionToken:()=>assert.fail('Live session forbidden')};
function nodes(tree,predicate,result=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,result);return result;}
const text=tree=>typeof tree==='string'?tree:typeof tree==='number'?String(tree):tree?.props?React.Children.toArray(tree.props.children).map(text).join(''):'';
const button=(tree,label)=>{const matches=nodes(tree,node=>node.type==='button'&&text(node)===label);assert.equal(matches.length,1,'Exactly one '+label);return matches[0];};

test('pending response validation requires the exact process attempt and rejects invented completion or another resource',()=>{
 const valid=postHeld(operationId);assert.equal(fieldMediaHeldOutcome(valid,reference).retryAllowed,false);assert.equal(fieldMediaHeldOutcome(getHeld(operationId),reference,{statusOnly:true}).clearAttempt,false);assert.equal(fieldMediaAttemptReference({...reference,action:'REQUEST_MATERIAL'}),null);
 const variants=[{...valid,saved:true},{...valid,receiptId:'invented-receipt'},{...valid,action:'UPLOAD_EVIDENCE'},{...valid,projectId:'foreign-project'},{...valid,scope:'f'.repeat(64)},{...valid,operationId:'abcdefab-1234-4abc-9abc-abcdef123457'},{...valid,retryAfterExpiration:true},{...valid,code:'UNKNOWN_CODE'},{...valid,evidence:{...evidence,id:'foreign-evidence'}},{...valid,evidence:{...evidence,status:'APPROVED'}},{...valid,evidence:{...evidence,processing:{...evidence.processing,status:'ANALYZED_UNREVIEWED'}}},{...valid,evidence:{...evidence,media:{...evidence.media,url:'https://private.invalid'}}}];
 for(const value of variants)assert.equal(fieldMediaHeldOutcome(value,reference),null);
 assert.equal(fieldMediaHeldOutcome({...getHeld(operationId),evidenceId:'foreign-evidence'},reference,{statusOnly:true}),null);
});
for(const code of ['FIELD_MEDIA_PROVIDER_PENDING','ORGANIZATION_USAGE_COVERAGE_EXPIRED'])test('actual panel keeps the original attempt and durable reference after '+code+' without another POST',async()=>{
 panel.reset({opened:true,tab:'EVIDENCE',data,draft},[{method:'POST',body:input=>postHeld(input.operationId,code)},{method:'GET',body:input=>getHeld(input.operationId,code)},{method:'GET',body:{scope,state:'NOT_OBSERVED',definitive:false}}]);
 let tree=panel.render(props);await nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});tree=panel.render(props);const first=panel.snapshot(),body=first.attempt.body;
 assert.equal(first.receipt,null);assert.equal(first.draft,draft);assert.equal(first.retryAllowed,false);assert.equal(first.attempt.providerHeld,true);assert.equal(first.busy,false);assert.equal(button(tree,'Reenviar exactamente el mismo intento').props.disabled,true);assert.match(first.notice,code==='FIELD_MEDIA_PROVIDER_PENDING'?/no se habilitó otro envío/:/cobertura.*venció/i);const refs=await panel.durable(scope);assert.equal(refs.length,1);assert.equal(refs[0].operationId,first.attempt.operationId);assert.doesNotMatch(JSON.stringify(refs),/Sólo datos|analysisConsent|synthetic-field-held-session/);
 const staleRetry=button(tree,'Reenviar exactamente el mismo intento').props.onClick;
 await button(tree,'Comprobar guardado').props.onClick();tree=panel.render(props);assert.equal(panel.snapshot().attempt.body,body);assert.equal(panel.snapshot().retryAllowed,false);assert.equal(panel.requests().at(-1).input.evidenceId,evidenceId);assert.equal(panel.requests().at(-1).input.operationId,first.attempt.operationId);
 await button(tree,'Comprobar guardado').props.onClick();tree=panel.render(props);assert.equal(panel.snapshot().retryAllowed,false);assert.equal(panel.snapshot().attempt.body,body);await staleRetry();assert.equal(panel.requests().filter(r=>r.method==='POST').length,1);assert.equal(panel.requests().slice(1).every(r=>r.method==='GET'),true);assert.deepEqual(await panel.durable(scope),refs);
});
test('invalid pending evidence stays uncertain and never enters a saved or retry state',async()=>{panel.reset({opened:true,tab:'EVIDENCE',data,draft},[{method:'POST',body:input=>({...postHeld(input.operationId),evidence:{...evidence,id:'foreign-evidence'}})}]);let tree=panel.render(props);await nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});tree=panel.render(props);assert.equal(panel.snapshot().receipt,null);assert.equal(panel.snapshot().attempt.action,'PROCESS_EVIDENCE');assert.equal(panel.snapshot().draft,draft);assert.equal(panel.snapshot().retryAllowed,false);assert.equal(button(tree,'Reenviar exactamente el mismo intento').props.disabled,true);assert.equal(panel.requests().length,1);});
test('actual expired pending evidence list offers independent manual review and no new analysis attempt',()=>{panel.reset({opened:true,tab:'EVIDENCE',data:{...data,evidence:[{...evidence,processing:{...evidence.processing,leaseExpired:true,status:'RUNNING'}}]}},[]);let tree=panel.render(props);assert.equal(nodes(tree,node=>node.type==='button'&&/Preparar otro intento|Analizar fotografía/.test(text(node))).length,0);assert.match(text(tree),/Análisis pendiente de confirmar/);assert.doesNotMatch(text(tree),/podés.*preparar otro intento/);panel.reset({opened:true,tab:'EVIDENCE',data:{...data,evidence:[evidence]}},[]);tree=panel.render(props);assert.equal(button(tree,'Revisar evidencia').props.disabled,false);assert.equal(nodes(tree,node=>node.type==='button'&&text(node)==='Analizar fotografía').length,0);});


const attendanceOnly={id:'attendance-only',name:'Sólo jornada',canReport:false,canAttendance:true};
const firstReporter={id:'report-first',name:'Primera ficha de reportes',canReport:true,canAttendance:false};
const secondReporter={id:'report-second',name:'Segunda ficha de reportes',canReport:true,canAttendance:true};
const mixedEvidenceData={...data,selfWorkers:[attendanceOnly,firstReporter,secondReporter]};
const fieldForm=tree=>nodes(tree,node=>node.type==='form')[0];
const reporterSelect=tree=>nodes(fieldForm(tree),node=>node.type==='select')[0];
const syntheticPhoto=()=>new File([new Uint8Array([1,2,3])],'evidencia-sintetica.png',{type:'image/png'});
function prepareEvidence(tree,caption){
 const capture=nodes(tree,node=>typeof node.type==='function'&&node.type.name==='FieldMediaCapture')[0];
 assert(capture,'Actual upload draft exposes the capture component');
 capture.props.onChange(syntheticPhoto());
 nodes(fieldForm(tree),node=>node.type==='textarea')[0].props.onChange({target:{value:caption}});
}

test('attendance-only own fiche explains why field evidence cannot be started',()=>{
 panel.reset({opened:true,tab:'EVIDENCE',data:{...data,selfWorkers:[attendanceOnly]}},[],{commitLayout:true});
 const tree=panel.render(props);
 assert.equal(button(tree,'Adjuntar evidencia').props.disabled,true);
 assert.match(text(tree),/una ficha propia con permiso de reportes/);
 assert.equal(fieldForm(tree),undefined);
 assert.deepEqual(panel.requests(),[]);
});

test('mixed own fiches offer and submit only report-capable selection',async()=>{
 const caption='Foto sintética elegida explícitamente.';
 const saved={scope,kind:'EVIDENCE',saved:true,receiptId:'receipt-evidence-synthetic'};
 panel.reset({opened:true,tab:'EVIDENCE',data:mixedEvidenceData},[{method:'POST',body:saved},{method:'GET',body:mixedEvidenceData}],{commitLayout:true});
 let tree=panel.render(props);
 assert.equal(button(tree,'Adjuntar evidencia').props.disabled,false);
 button(tree,'Adjuntar evidencia').props.onClick();
 tree=panel.render(props);
 assert.equal(reporterSelect(tree).props.value,firstReporter.id);
 assert.deepEqual(nodes(reporterSelect(tree),node=>node.type==='option').map(option=>option.props.value),['',firstReporter.id,secondReporter.id]);
 reporterSelect(tree).props.onChange({target:{value:secondReporter.id}});
 tree=panel.render(props);
 prepareEvidence(tree,caption);
 tree=panel.render(props);
 assert.equal(button(tree,'Guardar con recibo').props.disabled,false);
 await fieldForm(tree).props.onSubmit({preventDefault(){}});
 const posts=panel.requests().filter(request=>request.method==='POST');
 assert.equal(posts.length,1);
 assert.equal(posts[0].url,'/api/identity/field-media');
 assert.equal(posts[0].input.workerId,secondReporter.id);
 assert.equal(posts[0].input.caption,caption);
 assert.equal(posts[0].input.file.name,'evidencia-sintetica.png');
 assert.equal(panel.snapshot().receipt,saved.receiptId);
});

test('changed evidence reporting permission keeps the draft and blocks even its previous submit callback',async()=>{
 const revoked={...mixedEvidenceData,selfWorkers:[attendanceOnly,{...firstReporter,canReport:false},secondReporter]};
 panel.reset({opened:true,tab:'EVIDENCE',data:mixedEvidenceData},[{method:'GET',body:revoked}],{commitLayout:true});
 let tree=panel.render(props);
 button(tree,'Adjuntar evidencia').props.onClick();
 tree=panel.render(props);
 reporterSelect(tree).props.onChange({target:{value:firstReporter.id}});
 tree=panel.render(props);
 prepareEvidence(tree,'No se debe enviar este borrador.');
 tree=panel.render(props);
 const staleSubmit=fieldForm(tree).props.onSubmit, prepared=panel.snapshot().draft;
 assert.equal(button(tree,'Guardar con recibo').props.disabled,false);
 await button(tree,'Abrir operaciones').props.onClick();
 tree=panel.render(props);
 await staleSubmit({preventDefault(){}});
 assert.deepEqual(panel.requests().map(request=>request.method),['GET']);
 assert.equal(reporterSelect(tree).props.value,'');
 assert.equal(button(tree,'Guardar con recibo').props.disabled,true);
 assert.match(text(tree),/La ficha o el permiso de reportes cambió/);
 await fieldForm(tree).props.onSubmit({preventDefault(){}});
 assert.deepEqual(panel.requests().map(request=>request.method),['GET']);
 assert.equal(panel.snapshot().draft,prepared);
 assert.equal(panel.snapshot().attempt,null);
});
