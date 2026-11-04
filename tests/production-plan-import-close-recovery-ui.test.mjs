import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

// Execute the actual panel handlers with the real request lifecycle, command
// digests and recovery journal. Only React scheduling and HTTP are controlled.
const account=new URL('../src/app/(identity)/cuenta/',import.meta.url),source=readFileSync(new URL('plan-import-panel.js',account),'utf8').replace(/^import .*;\r?\n/gm,'');
const budgetSource=readFileSync(new URL('plan-partida-budget-preview.js',account),'utf8').replace(/^import .*;\r?\n/gm,'');
const stateNames=[...source.matchAll(/\[([A-Za-z]+),set[A-Za-z]+\]=useState/g)].map(match=>match[1]),refNames=[...source.matchAll(/([A-Za-z]+)=useRef\(/g)].map(match=>match[1]);
const importFrom=(names,file)=>`import {${names}} from ${JSON.stringify(new URL(file,account).href)};`;
const prefix=`import React from ${JSON.stringify(import.meta.resolve('react'))};
${importFrom('createWorkspaceRequestLifecycle','workspace-request-lifecycle.mjs')}
${importFrom('createWorkspaceRecoveryJournal,recoveryResult,planImportCommandDigest,planImportUploadFormDigest','workspace-recovery-journal.mjs')}
${importFrom('planImportUsageView,planImportPreservation','plan-import-usage-view.mjs')}
${importFrom('planDocumentDraftView,documentCurveReviewValue,documentCurveValuesEqual,DOCUMENT_CURVE_PROFILE,PLAN_CYP_INVESTMENT_PROFILE,planInvestmentDraftView','plan-source-curve.mjs')}
${importFrom('calendarSuggestionBinding,buildPlanCalendarSuggestions,applyPlanCalendarSuggestions','plan-import-calendar-suggestions.mjs')}
${importFrom('planPartidaMeasurementCatalog,planPartidaMeasurementRequestCurrent','plan-partida-measurement-preview.mjs')}
${importFrom('PLAN_BUDGET_SOURCE_PROFILE,PLAN_BUDGET_SOURCE_CONSENT,planPartidaBudgetCatalog,planPartidaBudgetDescriptor,planPartidaBudgetCandidate,validatePlanPartidaBudgetDetail,resolvePlanPartidaBudgetRow,planPartidaBudgetNotices','plan-partida-budget-preview.mjs')}
let states=[],refs=[],stateCursor=0,refCursor=0,calls=[],responses=[],lifecycle,browserRecoveryJournal;
// Restore memo identity and commit layout ownership before invoking actual handlers.
let memos=[],layouts=[],memoCursor=0,layoutCursor=0,layoutQueue=[];
const sameDeps=(left,right)=>Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((value,index)=>Object.is(value,right[index]));
const useMemo=(factory,deps)=>{const index=memoCursor++,previous=memos[index];if(previous&&sameDeps(previous.deps,deps))return previous.value;const value=factory();memos[index]={deps:[...deps],value};return value;};
const useLayoutEffect=(effect,deps)=>{const index=layoutCursor++,previous=layouts[index];if(previous&&sameDeps(previous.deps,deps))return;layoutQueue.push(()=>{previous?.cleanup?.();layouts[index]={deps:[...deps],cleanup:effect()};});};
const resetLayoutHooks=()=>{for(const entry of layouts)entry?.cleanup?.();memos=[];layouts=[];layoutQueue=[];};
const renderWithLayout=(component,props)=>{stateCursor=refCursor=memoCursor=layoutCursor=0;layoutQueue=[];const tree=component(props);for(const commit of layoutQueue)commit();layoutQueue=[];return tree;};
const useState=initial=>{const i=stateCursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];};
const useRef=initial=>{const i=refCursor++;return refs[i]??(refs[i]={current:initial});};
const useEffect=()=>{},useCallback=fn=>fn,useWorkspaceRequest=()=>lifecycle.request;
const styles={},FileUp=()=>null,FileCheck2=()=>null,Download=()=>null,TriangleAlert=()=>null,PlanSourceCurve=()=>null,PlanPartidaSourcePreview=()=>null,RECOVERY_EVENT='controlled-recovery';
`;
const suffix=`
export function reset(seed,responsesForCase){resetLayoutHooks();states=[];refs=[];calls=[];responses=[...responsesForCase];for(const [name,value] of Object.entries(seed))states[${JSON.stringify(stateNames)}.indexOf(name)]=value;
 const records=new Map(),storage={get length(){return records.size;},key:index=>[...records.keys()][index]??null,getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
 browserRecoveryJournal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>1});
 lifecycle=createWorkspaceRequestLifecycle(async()=> 'synthetic-close-recovery-session',{journal:browserRecoveryJournal,fetchImpl:async(url,options)=>{const next=responses.shift();if(!next)throw Error('Unexpected synthetic HTTP');const method=options.method||'GET';if(method!==next.method)throw Error('Unexpected synthetic method');calls.push({url,method,operationId:typeof options.body?.get==='function'?options.body.get('operationId'):typeof options.body==='string'?JSON.parse(options.body).operationId:new URL(url,'http://synthetic.invalid').searchParams.get('operationId')});return new Response(JSON.stringify(next.body),{status:next.status??200,headers:{'Content-Type':'application/json'}});}});
}
export const render=props=>renderWithLayout(PlanImportPanel,props);
export const snapshot=()=>Object.fromEntries(${JSON.stringify(stateNames)}.map((name,i)=>[name,states[i]]));
export const ref=name=>refs[${JSON.stringify(refNames)}.indexOf(name)];
export const requests=()=>calls;
export const durable=scope=>browserRecoveryJournal.list(scope);
`;
await loadBindings();
const compiled=await transform(prefix+budgetSource+source+suffix,{filename:'actual-plan-import-close-recovery.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}}),panel=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const scope='a'.repeat(64),projectId='project-synthetic',props={scope,projectId,getSessionToken:()=>assert.fail('Real session forbidden')};
const row={title:'Corrección local sintética',startsOn:'2026-10-15',endsOn:'2026-10-16',evidence:'Página sintética 1',uncertainty:''};
const originalRow={...row,title:'Título sintético anterior'},draftId='plan_draft_'+'b'.repeat(64),usage=state=>({version:1,receiptId:'organization_usage_'+'c'.repeat(64),state,coverageState:'TRIAL_CURRENT'});
const draft=state=>({id:draftId,revision:1,status:state==='UNKNOWN'?'FAILED':'READY',rows:state==='UNKNOWN'?[]:[originalRow],warnings:[],failure:state==='UNKNOWN'?'AI_REQUEST_UNCONFIRMED':null,source:{contentType:'application/pdf',bytes:40,sha256:'d'.repeat(64)},sourceAvailable:true,existingTaskCount:0,createdAt:'2026-10-12T12:00:00.000Z',updatedAt:'2026-10-12T12:00:00.000Z',usage:usage(state)});
const list=value=>({scope,projectId,canApprove:true,drafts:value?[value]:[],truncated:false});
const absent={scope,projectId,state:'NOT_OBSERVED',definitive:false};
function nodes(tree,predicate,result=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,result);return result;}
const text=tree=>typeof tree==='string'?tree:typeof tree==='number'?String(tree):tree?.props?React.Children.toArray(tree.props.children).map(text).join(''):'';
const button=(tree,label)=>{const matches=nodes(tree,node=>node.type==='button'&&text(node)===label);assert.equal(matches.length,1,'Exactly one '+label);return matches[0];};

async function closeAndRecover({decision=false,pendingUsage=false}={}){
 const file=new File(['%PDF-1.4\n% Synthetic source\n%%EOF\n'],'cronograma-sintetico.pdf',{type:'application/pdf'}),selectedDraft=decision?draft('OBSERVED'):null,bodyDraft=pendingUsage?draft('UNKNOWN'):null;
 const beforeClose=pendingUsage?{scope,projectId,state:'RECORDED',draft:bodyDraft}:absent;
 panel.reset({open:true,recoveryReady:true,canApprove:true,file,consent:true,...(decision?{draft:selectedDraft,rows:[row],reason:'Corrección explícita de la fuente sintética.'}:{})},[
  {method:'POST',status:pendingUsage?200:503,body:pendingUsage?{scope,projectId,saved:true,draft:bodyDraft}:{code:'SYNTHETIC_ACK_LOST'}},
  ...(pendingUsage?[{method:'GET',body:list(bodyDraft)}]:[]),
  {method:'GET',body:beforeClose},...(pendingUsage?[{method:'GET',body:list(bodyDraft)}]:[]),
  {method:'GET',body:list(decision?selectedDraft:bodyDraft)},
  {method:'GET',body:beforeClose},...(pendingUsage?[{method:'GET',body:list(bodyDraft)}]:[]),
 ]);
 let tree=panel.render(props);
 if(decision)await button(tree,'Guardar correcciones').props.onClick();
 else await nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});
 tree=panel.render(props);const firstState=panel.snapshot(),reference=firstState.attempt;assert.ok(reference?.operationId);assert.equal(panel.requests().filter(x=>x.method==='POST').length,1);
 const durable=await panel.durable(scope);assert.equal(durable.length,1);assert.equal(durable[0].operationId,reference.operationId);assert.ok(!JSON.stringify(durable).includes(file.name));
 await button(tree,'Comprobar resultado').props.onClick();tree=panel.render(props);
 if(!pendingUsage)assert.equal(panel.snapshot().retryAllowed,true);
 const payload=panel.ref('attemptPayload').current;assert.ok(payload,'There really was an exact RAM transport before close');
 const staleRetry=pendingUsage?null:button(tree,'Reintentar los mismos datos').props.onClick,work=panel.snapshot();
 button(tree,'Cerrar').props.onClick();const closed=panel.snapshot();assert.equal(closed.open,false);assert.equal(closed.retryAllowed,false);assert.equal(panel.ref('attemptPayload').current,payload);
 assert.equal(closed.file,file);assert.equal(closed.draft,work.draft);assert.deepEqual(closed.rows,work.rows);assert.equal(closed.reason,work.reason);assert.equal(closed.attempt,reference);assert.equal(panel.ref('attemptReference').current,reference);assert.deepEqual(await panel.durable(scope),durable);
 // A retained callback from the closed view must also be unable to resend.
 await staleRetry?.();assert.equal(panel.requests().filter(x=>x.method==='POST').length,1);
 tree=panel.render(props);assert.equal(button(tree,'Importar cronograma o presupuesto').props.id,'plan-import-title');await button(tree,'Importar cronograma o presupuesto').props.onClick();tree=panel.render(props);assert.equal(nodes(tree,node=>node.type==='button'&&text(node)==='Reintentar los mismos datos').length,0);await button(tree,'Comprobar resultado').props.onClick();tree=panel.render(props);
 assert.equal(panel.snapshot().retryAllowed,!pendingUsage);assert.equal(nodes(tree,node=>node.type==='button'&&text(node)==='Reintentar los mismos datos').length,pendingUsage?0:1);assert.equal(panel.ref('attemptPayload').current,payload);assert.equal(panel.snapshot().file,file);assert.deepEqual(panel.snapshot().draft,work.draft);assert.deepEqual(panel.snapshot().rows,work.rows);assert.equal(panel.snapshot().reason,work.reason);assert.equal(panel.snapshot().attempt,reference);assert.deepEqual(await panel.durable(scope),durable);
 // A fresh GET permits only the current render's explicit retry, never an older callback.
 await staleRetry?.();assert.equal(panel.requests().filter(x=>x.method==='POST').length,1);
 assert.equal(panel.requests().filter(x=>x.method==='POST').length,1);assert.ok(panel.requests().filter(x=>x.operationId).every(x=>x.operationId===reference.operationId));assert.ok(panel.requests().slice(1).every(x=>x.method==='GET'));assert.equal(nodes(tree,node=>node.type==='input'&&node.props.type==='file').length,0);
}
test('closing an uncertain upload preserves the exact RAM transport and requires a fresh GET before explicit retry',async()=>{await closeAndRecover();});
test('closing an uncertain correction preserves source rows reason and snapshot while invalidating the old resend callback',async()=>{await closeAndRecover({decision:true});});
test('closing a pending usage observation preserves its exact transport and reference without authorizing any retry',async()=>{await closeAndRecover({pendingUsage:true});});

test('removing a selected local file requires a current confirmation and preserves canonical draft rows and receipt',()=>{
 const file=new File(['synthetic'],'local-selected.pdf',{type:'application/pdf'}),recorded={...draft('OBSERVED'),status:'APPLIED'},receipt='recorded-synthetic-receipt';
 panel.reset({open:true,recoveryReady:true,file,consent:true,draft:recorded,rows:[row],reason:'Retained recorded work',receipt},[]);
 let tree=panel.render(props);button(tree,'Quitar archivo local').props.onClick();tree=panel.render(props);
 assert.equal(panel.snapshot().file,file);assert.equal(panel.requests().length,0);button(tree,'Conservar archivo').props.onClick();assert.equal(panel.snapshot().file,file);
 tree=panel.render(props);button(tree,'Quitar archivo local').props.onClick();tree=panel.render(props);button(tree,'Confirmar quitar archivo local').props.onClick();
 const result=panel.snapshot();assert.equal(result.file,null);assert.equal(result.consent,false);assert.equal(result.draft,recorded);assert.deepEqual(result.rows,[row]);assert.equal(result.reason,'Retained recorded work');assert.equal(result.receipt,receipt);assert.equal(panel.requests().length,0);
});

test('an old local-file confirmation cannot remove a replacement file or run while an attempt is uncertain',()=>{
 const first=new File(['first'],'first.pdf',{type:'application/pdf'}),second=new File(['second'],'second.pdf',{type:'application/pdf'});
 panel.reset({open:true,recoveryReady:true,file:first},[]);let tree=panel.render(props);button(tree,'Quitar archivo local').props.onClick();tree=panel.render(props);const stale=button(tree,'Confirmar quitar archivo local').props.onClick;
 panel.ref('attemptReference').current={scope,projectId,operationId:'aabbddee-0000-4000-8000-000000000001'};stale();assert.equal(panel.snapshot().file,first);assert.equal(panel.requests().length,0);
 panel.ref('attemptReference').current=null;nodes(tree,node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[second]}});stale();assert.equal(panel.snapshot().file,second);assert.equal(panel.snapshot().removeFileRequested,false);assert.equal(panel.requests().length,0);
});
