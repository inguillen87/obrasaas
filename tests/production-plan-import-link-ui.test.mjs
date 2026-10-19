import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

const accountRoot=new URL('../src/app/(identity)/cuenta/',import.meta.url);
const reactUrl=import.meta.resolve('react'),returnUrl=new URL('../src/lib/identity-return-path.mjs',import.meta.url).href;
const usageHelperUrl=new URL('../src/app/(identity)/cuenta/plan-import-usage-view.mjs',import.meta.url).href;
const source=name=>readFileSync(new URL(name,accountRoot),'utf8').replace(/^import .*;\r?\n/gm,'');
const planId='plan_draft_'+'a'.repeat(64),projectId='project-synthetic',scope='b'.repeat(64);
const props={projectId,scope,initialPlanId:planId,canonicalAccess:true,getSessionToken:()=>assert.fail('Real session provider forbidden')};
const row={title:'Tarea de la fuente',startsOn:null,endsOn:null,evidence:'Fila sintética',uncertainty:'Comparar con la fuente',sourceIssueReviewed:false};
const draft=extra=>({id:planId,revision:1,status:'READY',rows:[{...row}],warnings:[],source:{contentType:'application/pdf',bytes:20,sha256:'c'.repeat(64)},sourceAvailable:false,existingTaskCount:0,...extra});
const listing=(canApprove=true,rows=[])=>({scope,projectId,canApprove,drafts:rows,truncated:false});
const detail=extra=>({scope,projectId,draft:draft(extra)});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function nodes(tree,predicate,result=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,result);return result;}
const fileInput=tree=>{const value=nodes(tree,node=>node.type==='input'&&node.props.type==='file')[0];assert.ok(value);return value;};

const hooks=`
let states=[],refs=[],effects=[],memos=[],layouts=[],pending=[],layoutPending=[],stateCursor=0,refCursor=0,effectCursor=0,memoCursor=0,layoutCursor=0;
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
const useState=initial=>{const i=stateCursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];};
const useRef=initial=>{const i=refCursor++;return refs[i]??(refs[i]={current:initial});};
const useMemo=(factory,deps)=>{const i=memoCursor++;if(!memos[i]||!same(memos[i].deps,deps))memos[i]={value:factory(),deps:[...deps]};return memos[i].value;};
const useCallback=(fn,deps)=>{const i=memoCursor++;if(!memos[i]||!same(memos[i].deps,deps))memos[i]={fn,deps};return memos[i].fn;};
const useEffect=(fn,deps)=>{const i=effectCursor++;if(!effects[i]||!same(effects[i].deps,deps))pending.push({i,fn,deps});};const useLayoutEffect=(fn,deps)=>{const i=layoutCursor++;if(!layouts[i]||!same(layouts[i].deps,deps))layoutPending.push({i,fn,deps});};
const styles={},identityStyles={};
const cursors=()=>{stateCursor=refCursor=effectCursor=memoCursor=layoutCursor=0;pending=[];layoutPending=[];};
export const flushEffects=()=>{const nextLayouts=layoutPending;layoutPending=[];for(const {i,fn,deps} of nextLayouts){layouts[i]?.cleanup?.();layouts[i]={deps:[...deps],cleanup:fn()};}const next=pending;pending=[];for(const {i,fn,deps} of next){effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};}};
export const unmount=()=>{for(const layout of layouts)layout?.cleanup?.();for(const effect of effects)effect?.cleanup?.();layouts=[];effects=[];layoutPending=[];pending=[];};
`;
const stateNames=text=>[...text.matchAll(/\[([A-Za-z]+),set[A-Za-z]+\]=useState/g)].map(match=>match[1]);
function resetExport(names){return `export const reset=(seed={})=>{states=[];refs=[];effects=[];memos=[];layouts=[];pending=[];layoutPending=[];for(const [key,value] of Object.entries(seed)){const i=${JSON.stringify(names)}.indexOf(key);if(i>=0)states[i]=value;}};export const snapshot=()=>Object.fromEntries(${JSON.stringify(names)}.map((key,i)=>[key,states[i]]));`;}
await loadBindings();
async function compile(text,prefix,extra){const result=await transform('import React from '+JSON.stringify(reactUrl)+';import {planImportUsageView,planImportPreservation} from '+JSON.stringify(usageHelperUrl)+';import {planDocumentDraftView,documentCurveReviewValue,documentCurveValuesEqual,DOCUMENT_CURVE_PROFILE,PLAN_CYP_INVESTMENT_PROFILE,planInvestmentDraftView} from '+JSON.stringify(new URL('plan-source-curve.mjs',accountRoot).href)+';import {planPartidaMeasurementCatalog,planPartidaMeasurementRequestCurrent} from '+JSON.stringify(new URL('plan-partida-measurement-preview.mjs',accountRoot).href)+';'+hooks+prefix+text+extra,{filename:'actual-plan-link-components.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});return import('data:text/javascript;base64,'+Buffer.from(result.code).toString('base64'));}

const panelSource=source('plan-import-panel.js');
const panelMocks=`
const FileUp=()=>null,FileCheck2=()=>null,Download=()=>null,TriangleAlert=()=>null,PlanSourceCurve=()=>null,PlanPartidaSourcePreview=()=>null;
const calendarSuggestionBinding=()=>null,buildPlanCalendarSuggestions=()=>null,applyPlanCalendarSuggestions=()=>null;
let events=new Map();const window={addEventListener(name,callback){events.set(name,callback);},removeEventListener(name,callback){if(events.get(name)===callback)events.delete(name);}},document={visibilityState:'visible',addEventListener(){},removeEventListener(){}},sessionStorage={},BroadcastChannel=undefined;
let calls=[],queue=[],journalEntries=[],journalWait=null;
const browserRecoveryJournal={migratePlanImportAttempt:async()=>{if(journalWait)await journalWait;},list:async()=>journalEntries},RECOVERY_EVENT='controlled-recovery';
const recoveryResult=()=>null,planImportCommandDigest=()=>null,planImportUploadFormDigest=()=>null;
const transport=async(url,options={},consume)=>{calls.push({url,method:options.method||'GET',signal:options.signal});if(options.method==='POST')throw Error('Automatic POST forbidden');const next=queue.shift();if(!next)throw Error('Unexpected synthetic request');if(next.wait)await next.wait;if(next.error)throw next.error;return consume({ok:(next.status??200)<400,status:next.status??200,json:async()=>next.data});};
const useWorkspaceRequest=()=>transport;
export const configure=value=>{calls=[];queue=value.queue||[];journalEntries=value.journalEntries||[];journalWait=value.journalWait||null;events=new Map();};export const requests=()=>calls;export const publishJournal=entries=>{journalEntries=entries;events.get(RECOVERY_EVENT)?.();};
`;
const panel=await compile(panelSource,panelMocks,resetExport(stateNames(panelSource))+'export const render=props=>{cursors();return PlanImportPanel(props);};');
function initialize({seed={},queue=[{data:listing()},{data:detail()}],extraProps={},...config}={}){
 panel.reset({open:true,recoveryReady:true,...seed});panel.configure({queue,...config});const currentProps={...props,...extraProps},tree=panel.render(currentProps);return {currentProps,tree};
}
async function complete(fixture){panel.flushEffects();await tick();const tree=panel.render(fixture.currentProps);panel.flushEffects();await tick();return tree;}

test('actual linked panel waits for recovery and current canonical access, then reads list and exact draft with zero POST',async()=>{
 const fixture=initialize();await complete(fixture);const requests=panel.requests();assert.equal(requests.length,2);
 assert.deepEqual(requests.map(value=>value.method),['GET','GET']);assert.equal(new URL(requests[0].url,'https://fixture.invalid').searchParams.get('draftId'),null);assert.equal(new URL(requests[1].url,'https://fixture.invalid').searchParams.get('draftId'),planId);
 for(const call of requests){const query=new URL(call.url,'https://fixture.invalid').searchParams;assert.equal(query.get('scope'),scope);assert.equal(query.get('projectId'),projectId);}
 const state=panel.snapshot();assert.equal(state.draft.id,planId);assert.equal(state.approved,false);assert.equal(state.consent,false);assert.equal(state.attempt,null);assert.equal(state.rows[0].uncertainty,row.uncertainty);assert.equal(state.rows[0].sourceIssueReviewed,false);assert.match(state.message,/decisiones explícitas/);
 panel.render(fixture.currentProps);panel.flushEffects();await tick();assert.equal(panel.requests().length,2);panel.unmount();
});

test('invalid hints, unavailable canonical access and locks never start a linked read',async()=>{
 for(const extraProps of [{initialPlanId:''},{initialPlanId:planId+'\n'},{initialPlanId:'plan_draft_'+'A'.repeat(64)},{initialPlanId:'https://foreign.example'},{canonicalAccess:false},{canonicalAccess:'true'},{locked:true}]){
  const fixture=initialize({extraProps,queue:[]});await complete(fixture);assert.equal(panel.requests().length,0);assert.equal(panel.snapshot().draft,null);panel.unmount();
 }
 const wait=deferred(),fixture=initialize({seed:{recoveryReady:false},journalWait:wait.promise});panel.flushEffects();await tick();assert.equal(panel.requests().length,0);wait.resolve();await tick();panel.render(fixture.currentProps);panel.flushEffects();await tick();assert.equal(panel.requests().length,2);panel.unmount();
});

test('local file, selected draft or unsaved rows remain intact instead of following a URL',async()=>{
 const file=new File(['synthetic-source'],'chosen.pdf',{type:'application/pdf'});
 for(const seed of [{file,consent:true,reason:'Mi motivo'},{draft:draft({id:'existing-draft'}),rows:[{...row,title:'Corrección local'}],reason:'Conservar'},{rows:[{...row,title:'Borrador local'}]}]){
  const fixture=initialize({seed,queue:[]});await complete(fixture);assert.equal(panel.requests().length,0);const state=panel.snapshot();for(const [key,value] of Object.entries(seed))assert.equal(state[key],value);panel.unmount();
 }
});

test('a durable pending attempt prevents URL reads without deleting its reference or retrying it',async()=>{
 const attempt={version:1,resource:'plan-import',operationId:'synthetic-pending',scope,projectId,action:'UPLOAD'};
 const fixture=initialize({seed:{attempt},journalEntries:[attempt],queue:[]});await complete(fixture);assert.equal(panel.requests().length,0);assert.equal(panel.snapshot().attempt,attempt);assert.equal(panel.snapshot().draft,null);panel.unmount();
});

test('an initial sibling lock can release once; later re-renders never replay the linked read',async()=>{
 const fixture=initialize({extraProps:{locked:true}});await complete(fixture);assert.equal(panel.requests().length,0);const unlocked={...fixture.currentProps,locked:false};panel.render(unlocked);panel.flushEffects();await tick();assert.equal(panel.requests().length,2);panel.render(unlocked);panel.flushEffects();await tick();assert.equal(panel.requests().length,2);panel.unmount();
});

test('wrong draft, malformed result, cross-scope or cross-project response preserves an actionable failed consultation',async()=>{
 const variants=[detail({id:'plan_draft_'+'d'.repeat(64)}),detail({rows:null}),detail({revision:0}),detail({source:null}),{...detail(),scope:'e'.repeat(64)},{...detail(),projectId:'other-project'}];
 for(const data of variants){const fixture=initialize({queue:[{data:listing()},{data}]});await complete(fixture);const state=panel.snapshot();assert.equal(state.draft,null);assert.equal(state.rows.length,0);assert.equal(state.approved,false);assert.match(state.message,/volvé a abrir el enlace/);panel.render(fixture.currentProps);panel.flushEffects();await tick();assert.equal(panel.requests().length,2);panel.unmount();}
});

test('a current nonfinancial reviewer may read an ordinary draft but never a private financial one',async()=>{
 let fixture=initialize({queue:[{data:listing(false)},{data:detail()}]});await complete(fixture);assert.equal(panel.snapshot().draft.id,planId);assert.equal(panel.snapshot().canApprove,false);panel.unmount();
 fixture=initialize({queue:[{data:listing(false,[draft({financialSource:true})])},{data:detail({financialSource:true})}]});await complete(fixture);assert.equal(panel.snapshot().draft,null);assert.deepEqual(panel.snapshot().drafts,[]);assert.equal(panel.snapshot().rows.length,0);assert.match(panel.snapshot().message,/permiso actual/);panel.unmount();
});

test('401/403 responses do not expose a draft and preserve GET-only error evidence',async()=>{
 for(const status of [401,403]){
  const fixture=initialize({queue:[{data:listing(true,[draft({financialSource:true})])},{status,data:{code:status===401?'SESSION_REQUIRED':'PLAN_IMPORT_PERMISSION_REQUIRED'}}]});await complete(fixture);assert.equal(panel.snapshot().draft,null);assert.equal(panel.snapshot().canApprove,false);assert.equal(panel.snapshot().drafts.some(value=>value.financialSource===true),false);assert.equal(panel.requests().length,2);assert.ok(panel.requests().every(value=>value.method==='GET'));assert.match(panel.snapshot().message,/volvé a abrir el enlace/);panel.unmount();
 }
});

test('late results cannot fill a changed scope, project, permission context or newly locked workbench',async()=>{
 for(const change of [{scope:'d'.repeat(64)},{projectId:'other-project'},{canonicalAccess:false},{locked:true}]){
  const wait=deferred(),fixture=initialize({queue:[{data:listing()},{data:detail(),wait:wait.promise}]});panel.flushEffects();await tick();assert.equal(panel.requests().length,2);panel.render({...fixture.currentProps,...change});panel.flushEffects();assert.equal(panel.requests()[1].signal.aborted,true);wait.resolve();await tick();assert.equal(panel.snapshot().draft,null);assert.equal(panel.snapshot().rows.length,0);assert.equal(panel.requests().length,2);panel.unmount();
 }
});

test('unmount rejects a late exact-draft response without a new read or mutation',async()=>{
 const wait=deferred(),fixture=initialize({queue:[{data:listing()},{data:detail(),wait:wait.promise}]});panel.flushEffects();await tick();panel.unmount();assert.equal(panel.requests()[1].signal.aborted,true);wait.resolve();await tick();assert.equal(panel.snapshot().draft,null);assert.equal(panel.snapshot().rows.length,0);assert.equal(panel.requests().length,2);assert.ok(fixture.currentProps.canonicalAccess);
});

test('a file picked before the next render invalidates automatic or already pending link work synchronously',async()=>{
 const file=new File(['same-source-bytes'],'retained.pdf',{type:'application/pdf'});
 let fixture=initialize({queue:[]});fileInput(fixture.tree).props.onChange({target:{files:[file]}});panel.flushEffects();await tick();assert.equal(panel.requests().length,0);assert.equal(panel.snapshot().file,file);panel.unmount();
 const wait=deferred();fixture=initialize({queue:[{data:listing()},{data:detail(),wait:wait.promise}]});const captured=fileInput(fixture.tree);panel.flushEffects();await tick();assert.equal(panel.requests().length,2);captured.props.onChange({target:{files:[file]}});assert.equal(panel.requests()[1].signal.aborted,true);wait.resolve();await tick();assert.equal(panel.snapshot().file,file);assert.equal(panel.snapshot().draft,null);assert.equal(panel.snapshot().rows.length,0);assert.equal(await panel.snapshot().file.text(),'same-source-bytes');panel.unmount();
});

test('another pending journal reference wins over a late linked draft',async()=>{
 const wait=deferred(),fixture=initialize({queue:[{data:listing()},{data:detail(),wait:wait.promise}]});panel.flushEffects();await tick();const attempt={version:1,resource:'plan-import',operationId:'new-pending',scope,projectId,action:'EDIT'};
 // Trigger the same-context recovery listener, without changing the request's context.
 panel.publishJournal([attempt]);await tick();assert.equal(panel.snapshot().attempt,attempt);wait.resolve();await tick();assert.equal(panel.snapshot().draft,null);assert.equal(panel.snapshot().attempt,attempt);assert.equal(panel.requests().length,2);assert.ok(fixture.currentProps.canonicalAccess);panel.unmount();
});

const workspaceSource=source('workspace-client.js');
const componentNames=[...readFileSync(new URL('workspace-client.js',accountRoot),'utf8').matchAll(/^import \{([^}]+)\} from/gm)].flatMap(match=>match[1].split(',')).map(value=>value.trim()).filter(value=>/^[A-Z]/.test(value)&&value!=='WorkspaceScreen');
const workspacePrefix=`import {collectRetainedPages,retainedRows} from ${JSON.stringify(new URL('workspace-live-read.mjs',accountRoot).href)};const useWorksiteLiveRefresh=()=>({status:{state:'IDLE',checkedAt:null,updates:false},check(){throw Error('Live refresh is outside the historical plan-link fixture');}});import {workspaceLocationView,workspaceViewAllowed} from ${JSON.stringify(new URL('workspace-view-routing.mjs',accountRoot).href)};const useSyncExternalStore=(_subscribe,_getSnapshot,getServerSnapshot)=>getServerSnapshot();`+`const {WorkspaceScreen,useWorkspaceView,revealWorkspaceDestination}=(()=>{${source('workspace-screen.js').replace(/^export /gm,'')}return {WorkspaceScreen,useWorkspaceView,revealWorkspaceDestination};})();`+componentNames.map(name=>`const ${name}=function ${name}(){return null;};`).join('')+`const transport=async()=>{throw Error('Unexpected workspace HTTP');},useWorkspaceRequest=()=>transport;const portfolioOverviewMatches=()=>false,projectCreationReceiptOutcome=()=>null,participantOnboardingNavigationTarget=()=>null;const calendarDay=value=>value,loadedScheduleOverview=()=>({loaded:0,total:0,partial:false,missingDates:0,invalidDates:0}),mergeLoadedTasks=()=>[],refreshLoadedTasks=()=>[],updateLoadedTask=()=>[];`;
const workspace=await compile(workspaceSource,workspacePrefix,resetExport(stateNames(workspaceSource))+'export const render=props=>{cursors();return AccountWorkspace(props);};');
function workspaceReady(extra={},extraProps={}){
 const account={scope,role:'ADMIN',projects:[{id:projectId,name:'Obra sintética'}]},view={scope,project:{id:projectId,name:'Obra sintética'},canPlanSchedule:true,tasks:[],totalTasks:0,nextCursor:null};workspace.reset({account,view,loading:false,...extra});return workspace.render({getSessionToken:props.getSessionToken,initialProjectId:projectId,initialPlanId:planId,...extraProps});
}
test('actual AccountWorkspace forwards the strict plan hint only to the matching canonically read project',()=>{
 const linked=nodes(workspaceReady(),node=>node.type?.name==='PlanImportPanel')[0];assert.ok(linked);assert.equal(linked.props.initialPlanId,planId);assert.equal(linked.props.canonicalAccess,true);
 for(const initialPlanId of [planId+'\n','plan_draft_'+'A'.repeat(64),'https://foreign.example'])assert.equal(nodes(workspaceReady({}, {initialPlanId}),node=>node.type?.name==='PlanImportPanel')[0].props.initialPlanId,'');
 assert.equal(nodes(workspaceReady({}, {initialProjectId:'other-project'}),node=>node.type?.name==='PlanImportPanel')[0].props.initialPlanId,'');
 const mismatched=nodes(workspaceReady({view:{scope:'d'.repeat(64),project:{id:projectId,name:'Obra'},canPlanSchedule:true,tasks:[],totalTasks:0}}),node=>node.type?.name==='PlanImportPanel')[0];assert.equal(mismatched.props.canonicalAccess,false);
 assert.equal(nodes(workspaceReady({draft:{task:{id:'local-task',title:'Local'}}}),node=>node.type?.name==='PlanImportPanel').length,0);
});

const identitySource=source('workspace-identity.js');
const identityPrefix=`import {identityAccountReturnPath,identitySignInPath,identityWorkspaceProjectHint,identityWorkspacePlanHint} from ${JSON.stringify(returnUrl)};let auth={},params=new URLSearchParams();const useSearchParams=()=>params,useAuth=()=>auth,useOrganization=()=>({organization:null});const Link=()=>null,OrganizationSwitcher=()=>null,AccountWorkspace=function AccountWorkspace(){return null;},CompanyBootstrapPanel=()=>null,ParticipantSelfServicePanel=()=>null,OfficeJoinPanel=()=>null,OnboardingGuide=()=>null,IdentityLoadingNotice=()=>null;export const configure=(nextAuth,nextParams)=>{auth=nextAuth;params=nextParams;};`;
const identity=await compile(identitySource,identityPrefix,resetExport([])+'export const render=()=>{cursors();return WorkspaceIdentityPanel();};export const renderContext=props=>{cursors();return WorkspaceIdentityContext(props);};');
test('actual identity layer forwards the pair through real auth props and blocks anonymous/priority-invitation plan opening',()=>{
 const auth={isLoaded:true,isSignedIn:true,userId:'synthetic-user',sessionId:'synthetic-session',orgId:'synthetic-org',orgRole:'org:member',getToken:()=>assert.fail('Provider forbidden')};
 identity.reset();identity.configure(auth,new URLSearchParams({obra:projectId,plan:planId}));let wrapper=identity.render();assert.equal(wrapper.props.initialPlanId,planId);assert.equal(wrapper.props.returnPath,'/cuenta?obra='+projectId+'&plan='+planId);let children=identity.renderContext(wrapper.props);assert.equal(nodes(children,node=>node.type?.name==='AccountWorkspace')[0].props.initialPlanId,planId);
 identity.reset();identity.configure({...auth,isSignedIn:false},new URLSearchParams({obra:projectId,plan:planId}));wrapper=identity.render();children=identity.renderContext(wrapper.props);assert.equal(nodes(children,node=>node.type?.name==='AccountWorkspace').length,0);
 identity.reset();identity.configure(auth,new URLSearchParams({obra:projectId,plan:planId,participar:'invite_'+'a'.repeat(32)}));wrapper=identity.render();assert.equal(wrapper.props.initialPlanId,'');assert.equal(wrapper.props.returnPath,'/cuenta?participar=invite_'+'a'.repeat(32));
});
