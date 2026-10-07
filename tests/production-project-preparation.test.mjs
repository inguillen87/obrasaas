import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {normalizeProjectPreparation,preparationRoster,preparationText,canPrepareProject,preparationReceiptId} from '../src/lib/project-preparation-policy.mjs';
import {createProjectPreparation} from '../src/lib/project-preparation-store.mjs';
import {createProjectPreparationHandlers} from '../src/lib/project-preparation-http.mjs';
import {projectPreparationSnapshot,projectPreparationDraft,projectPreparationOutcome} from '../src/app/(identity)/cuenta/project-preparation-format.mjs';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';

const scope='a'.repeat(64),operationId=randomUUID(),context={scope,projectId:'project-a'},team={id:'planned_team_'+randomUUID(),label:'Equipo fijo',engagement:'IN_HOUSE',headcount:3,note:'Responsable pendiente',status:'PLANNED'};
const slot={id:'planned_slot_'+randomUUID(),teamId:team.id,label:'Pepito',job:'WORKER',note:'Nombre provisional',provisional:true,status:'PLANNED'};
const payload={expectedRevision:0,expectedDetailsDigest:'b'.repeat(64),name:'Ampliación de Portería',clientName:'UNQ',address:'Roque Sáenz Peña 352, Bernal, Buenos Aires',teams:[team],slots:[slot],reason:'Preparación de equipo previo al inicio'};
const command=(extra={})=>({operationId,...context,action:'SAVE_PREPARATION',payload:structuredClone(payload),...extra});
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Admin',organizationId:'org_A',organizationRole:'org:admin'};
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
function fixture(role='ADMIN'){
 let project={id:'project-a',name:'Original',address:null,metadata:{siteRegister:{revision:12},stock:{synthetic:7}}};const receipts=new Map(),queries=[];
 const client={query:async(sql,args)=>{queries.push(sql);if(sql.startsWith('SELECT id,name,address,metadata'))return {rows:[structuredClone(project)]};if(sql.startsWith('SELECT id,metadata'))return {rows:receipts.has(args[0])?[structuredClone(receipts.get(args[0]))]:[]};if(sql.startsWith('UPDATE public."Project"')){assert.equal(project.name,args[5]);assert.equal(project.address,args[6]);project={...project,name:args[2],address:args[3],metadata:{...project.metadata,projectPreparation:sorted(JSON.parse(args[4]))}};return {rows:[{id:project.id}]};}if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.equal(receipts.has(args[0]),false);receipts.set(args[0],{id:args[0],metadata:sorted(JSON.parse(args[5]))});return {rows:[],rowCount:1};}throw Error('Unexpected SQL');}};
 const workspace={projectOperation:async(_session,_context,writable,callback)=>callback(client,{role,actorId:'admin',organizationId:'company-a'},scope,{id:'project-a'})};
 return {store:createProjectPreparation({workspace}),queries,receipts,get project(){return structuredClone(project);}};
}
function storage(){const rows=new Map();return {rows,get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};}

test('preparation declares planned slots without participant, identity, account or phone fields',()=>{
 const value=normalizeProjectPreparation(command());assert.equal(value.payload.slots[0].provisional,true);assert.equal(value.payload.slots[0].status,'PLANNED');assert.equal(canPrepareProject('DIRECTOR'),true);for(const role of ['SITE_MANAGER','FINANCE','AUDITOR','SUPERADMIN'])assert.equal(canPrepareProject(role),false);
 for(const field of ['workerId','phone','accountId','membershipId','kyc','invitationId'])assert.throws(()=>normalizeProjectPreparation(command({payload:{...payload,slots:[{...slot,[field]:'forbidden'}]}})),{code:'PROJECT_PREPARATION_INPUT_INVALID'});
 for(const extra of [{startsOn:'2026-10-10'},{workerId:'worker-a'},{phone:'+541111111111'}])assert.throws(()=>normalizeProjectPreparation(command({payload:{...payload,...extra}})),{code:'PROJECT_PREPARATION_INPUT_INVALID'});
});
test('normalizes Unicode and whitespace while rejecting control characters and overlong notes',()=>{
 assert.equal(preparationText('  Porte\u0301ria  ',100),'Portéria');for(const value of ['<b>','\u0000','\u202e','\ud800','\udc00'])assert.throws(()=>preparationText(value,100),{code:'PROJECT_PREPARATION_INPUT_INVALID'});
 assert.throws(()=>preparationRoster([{...team,note:'a'.repeat(501)}],[]),{code:'PROJECT_PREPARATION_INPUT_INVALID'});assert.throws(()=>preparationRoster([team],[{...slot,note:'a'.repeat(301)}]),{code:'PROJECT_PREPARATION_INPUT_INVALID'});
});
test('bounds the roster and rejects duplicate places, orphan slots and invented job keys',()=>{
 const places=Array.from({length:51},()=>({...slot,id:'planned_slot_'+randomUUID()}));for(const input of [[[team],places],[[team,team],[]],[[team],[slot,slot]],[[team],[{...slot,teamId:'planned_team_'+randomUUID()}]],[[team],[{...slot,job:'ADMIN'}]],[[{...team,headcount:1}],[slot,{...slot,id:'planned_slot_'+randomUUID()}]],[[{...team,status:'ACTIVE'}],[]]])assert.throws(()=>preparationRoster(...input),{code:'PROJECT_PREPARATION_INPUT_INVALID'});
});
test('cancellation is explicit, reuses its operation UUID and accepts only a confirmed tombstone request',()=>{
 const value=normalizeProjectPreparation(command({operationId:operationId.toUpperCase(),action:'CANCEL_PENDING_PREPARATION',payload:{confirmed:true}}));assert.equal(value.operationId,operationId);assert.deepEqual(value.payload,{confirmed:true});for(const p of [{confirmed:false},{confirmed:true,reason:'extra'}])assert.throws(()=>normalizeProjectPreparation(command({action:'CANCEL_PENDING_PREPARATION',payload:p})),{code:'PROJECT_PREPARATION_INPUT_INVALID'});
});
test('save survives JSONB key ordering, changes only preparation and returns the current independent revision',async()=>{
 const f=fixture(),before=await f.store.read(session,context),input=command({payload:{...payload,expectedDetailsDigest:before.detailsDigest}}),result=await f.store.save(session,input);assert.equal(result.saved,true);assert.equal(result.revision,1);assert.deepEqual(f.project.metadata.siteRegister,{revision:12});assert.deepEqual(f.project.metadata.stock,{synthetic:7});
 assert.equal((await f.store.read(session,context)).clientName,'UNQ');assert.equal(f.queries.some(sql=>/Worker|Task|Membership|StockMovement/.test(sql)),false);assert.match(f.queries.find(sql=>sql.startsWith('UPDATE')),/jsonb_set\(COALESCE\(metadata/);projectPreparationOutcome(result,input);
});
test('same UUID is idempotent, a changed command is rejected and an earlier receipt reports the current snapshot',async()=>{
 const f=fixture(),first=await f.store.read(session,context),input=command({payload:{...payload,expectedDetailsDigest:first.detailsDigest}}),one=await f.store.save(session,input),two=await f.store.save(session,input);assert.equal(two.replayed,true);assert.equal(one.receiptId,two.receiptId);assert.equal(f.receipts.size,1);
 await assert.rejects(f.store.save(session,{...input,payload:{...input.payload,name:'Otro nombre'}}),{code:'PROJECT_PREPARATION_OPERATION_CONFLICT'});
 const next=await f.store.read(session,context);await f.store.save(session,command({operationId:randomUUID(),payload:{...payload,expectedRevision:next.revision,expectedDetailsDigest:next.detailsDigest,name:'Nombre actualizado'}}));const old=await f.store.status(session,{...context,operationId});assert.equal(old.savedPreparationIsCurrent,false);assert.equal(old.name,'Nombre actualizado');assert.equal(old.savedRevision,1);assert.equal(old.revision,2);projectPreparationOutcome(old,input);
});
test('stale preparation revision and changed general details fail without overwriting the namespace',async()=>{
 const f=fixture();await assert.rejects(f.store.save(session,command()),{code:'PROJECT_PREPARATION_REVISION_CHANGED'});assert.equal(f.receipts.size,0);assert.equal(f.project.name,'Original');
 const current=await f.store.read(session,context);await assert.rejects(f.store.save(session,command({payload:{...payload,expectedRevision:1,expectedDetailsDigest:current.detailsDigest}})),{code:'PROJECT_PREPARATION_REVISION_CHANGED'});
});
test('a cancellation receipt blocks a later SAVE using that same UUID and remains recoverable',async()=>{
 const f=fixture(),current=await f.store.read(session,context),cancel=command({action:'CANCEL_PENDING_PREPARATION',payload:{confirmed:true}}),result=await f.store.save(session,cancel);assert.equal(result.state,'CANCELLED');assert.equal(result.projectUpdated,false);assert.equal(result.saved,false);
 await assert.rejects(f.store.save(session,command({payload:{...payload,expectedDetailsDigest:current.detailsDigest}})),{code:'PROJECT_PREPARATION_CANCELLED'});assert.equal(f.project.name,'Original');assert.equal(f.receipts.size,1);assert.equal((await f.store.status(session,{...context,operationId})).state,'CANCELLED');assert.equal((await f.store.save(session,cancel)).receiptId,result.receiptId);
});
test('cancelling an already committed SAVE returns its receipt instead of claiming the data were cancelled',async()=>{
 const f=fixture(),current=await f.store.read(session,context),saved=await f.store.save(session,command({payload:{...payload,expectedDetailsDigest:current.detailsDigest}})),cancelled=await f.store.save(session,command({action:'CANCEL_PENDING_PREPARATION',payload:{confirmed:true}}));assert.equal(cancelled.state,'RECORDED');assert.equal(cancelled.receiptId,saved.receiptId);assert.equal(f.receipts.size,1);
});
test('reads, writes, receipt queries and cancellation all require the module role',async()=>{
 for(const role of ['SITE_MANAGER','FINANCE','AUDITOR']){const {store}=fixture(role);for(const execute of [()=>store.read(session,context),()=>store.status(session,{...context,operationId}),()=>store.save(session,command()),()=>store.save(session,command({action:'CANCEL_PENDING_PREPARATION',payload:{confirmed:true}}))])await assert.rejects(execute(),{code:'PROJECT_PREPARATION_PERMISSION_REQUIRED'});}
});
test('receipt corruption cannot release a pending preparation reference',async()=>{
 const f=fixture();await f.store.save(session,command({action:'CANCEL_PENDING_PREPARATION',payload:{confirmed:true}}));f.receipts.get(preparationReceiptId('admin','project-a',operationId)).metadata.savedRevision=1;await assert.rejects(f.store.status(session,{...context,operationId}),{code:'PROJECT_PREPARATION_INTEGRITY'});
});
test('HTTP boundary requires current identity, exact query, canonical origin, bounded JSON and no-store',async()=>{
 const f=fixture(),handlers=createProjectPreparationHandlers({verify:async()=>session,store:f.store}),url='https://obrasaas.com/api/identity/project-preparation?'+new URLSearchParams(context);const response=await handlers.GET(new Request(url));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('vary'),'Cookie, Authorization');
 for(const suffix of ['&scope='+scope,'&unknown=1','&operationId=bad'])assert.equal((await handlers.GET(new Request(url+suffix))).status,400);
 const badOrigin=await handlers.POST(new Request('https://obrasaas.com/api/identity/project-preparation',{method:'POST',headers:{origin:'https://foreign.example','Content-Type':'application/json'},body:JSON.stringify(command())}));assert.equal(badOrigin.status,403);
 assert.equal((await handlers.GET(new Request(url,{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
 const denied=createProjectPreparationHandlers({verify:async()=>({authenticated:false}),store:f.store});assert.equal((await denied.GET(new Request(url))).status,401);
 const unavailable=createProjectPreparationHandlers({verify:async()=>({authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'}),store:f.store});assert.equal((await unavailable.GET(new Request(url))).status,503);
});
test('browser projection rejects forged identity, wrong context and false proof of cancellation',async()=>{
 const f=fixture(),snapshot=await f.store.read(session,context);projectPreparationSnapshot(snapshot,context);const draft=projectPreparationDraft(snapshot);assert.equal(draft.reason,'');assert.throws(()=>projectPreparationSnapshot({...snapshot,permissionsGranted:true},context));assert.throws(()=>projectPreparationSnapshot(snapshot,{...context,projectId:'other'}));
 const cancelled=await f.store.save(session,command({action:'CANCEL_PENDING_PREPARATION',payload:{confirmed:true}}));projectPreparationOutcome(cancelled,command());for(const change of [{projectUpdated:true},{operationId:randomUUID()},{receiptId:'wrong'},{definitive:false}])assert.throws(()=>projectPreparationOutcome({...cancelled,...change},command()));
});
test('recovery persists only scoped UUID references and validates exact SAVE or CANCELLED outcomes',async()=>{
 const f=fixture(),s=storage(),journal=createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123}),ticket=await journal.prepare('/api/identity/project-preparation',{method:'POST',body:JSON.stringify(command())});assert.deepEqual(Object.keys(ticket.entry).sort(),['version','resource','scope','projectId','operationId','createdAt','action'].sort());const stored=JSON.stringify([...s.rows]);assert.doesNotMatch(stored,/Pepito|UNQ|Roque|clientName|teams|reason|name|note/);
 assert.equal(recoveryResult(ticket.entry,{scope,...context,operationId,action:'SAVE_PREPARATION',state:'CANCELLED',saved:false,definitive:true,receiptId:'invalid',projectUpdated:false}),null);await journal.observe(recoveryQuery(ticket.entry),{scope,...context,operationId,action:'SAVE_PREPARATION',state:'NOT_OBSERVED',saved:false,definitive:false});assert.equal((await journal.list(scope)).length,1);
 const cancel=command({action:'CANCEL_PENDING_PREPARATION',payload:{confirmed:true}}),same=await journal.prepare('/api/identity/project-preparation',{method:'POST',body:JSON.stringify(cancel)});assert.equal(same.existed,true);const result=await f.store.save(session,cancel);await journal.settle(same,result);assert.equal((await journal.list(scope)).length,0);
});
test('recovery blocks a second UUID and ignores denied, foreign or malformed receipt reads',async()=>{
 const s=storage(),journal=createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123}),ticket=await journal.prepare('/api/identity/project-preparation',{method:'POST',body:JSON.stringify(command())});await assert.rejects(journal.prepare('/api/identity/project-preparation',{method:'POST',body:JSON.stringify(command({operationId:randomUUID()}))}),{code:'WORKSPACE_RECOVERY_REQUIRED'});
 for(const result of [{scope,...context,operationId:randomUUID(),action:'SAVE_PREPARATION',state:'CANCELLED',saved:false,definitive:true,receiptId:'project_preparation_'+'a'.repeat(64),projectUpdated:false},{scope,...context,operationId,action:'SAVE_PREPARATION',state:'CANCELLED',saved:false,definitive:true,receiptId:'project_preparation_'+'a'.repeat(64),projectUpdated:false,extra:true}]){await journal.observe(recoveryQuery(ticket.entry),result);assert.equal((await journal.list(scope)).length,1);}
});
