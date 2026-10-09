import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ownCompanyRuntimeFixture} from './fixtures/own-company-runtime.mjs';
import {createOwnCompanyTemplates,normalizeOwnTemplateCommand} from '../src/lib/meta-own-company-templates.mjs';
import {createMetaCustomerProvider,metaCustomerTransportReady} from '../src/lib/meta-customer-provider.mjs';
import {buildCustomerTemplate} from '../src/lib/meta-customer-templates.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../src/lib/company-channel-schema.mjs';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {ownTemplatesSnapshot,ownTemplatesOutcome,ownTemplateCommand} from '../src/app/(identity)/cuenta/own-company-templates-view.mjs';
import {createWorkspaceRecoveryJournal,recoveryResult,recoveryQuery} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createCompanyChannelHandlers} from '../src/lib/company-channel-http.mjs';
import {createCompanyChannelStore} from '../src/lib/company-channel-store.mjs';

const scope='a'.repeat(64),blueprintKey='open_attendance_reminder';
async function fixture(options={}){
 const f=await ownCompanyRuntimeFixture(),audits=new Map(),sql=[],owner={revision:3,mode:'COMPANY'},state={remote:null,postLost:false,afterLookup:null,commitLost:false,writes:0,commits:0};
 const originalQuery=f.client.query.bind(f.client),rows=value=>({rows:value,rowCount:value.length});
 f.client.query=async(sqlText,args=[])=>{
  sql.push({sql:sqlText,args});
  if(sqlText.includes("to_regclass('public.\"WhatsAppCompanySchema\"')"))return rows([{present:true}]);
  if(sqlText.includes('information_schema.columns'))return rows(sqlText.includes("column_name='catalogFingerprint'")?[{count:1}]:[]);
  if(sqlText.includes('FROM public."WhatsAppCompanySchema"'))return rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]})}]);
  if(sqlText.includes('FROM pg_constraint')&&sqlText.includes('conname=ANY'))return rows(args[0].map(conname=>({conname,convalidated:true})));
  if(sqlText.includes('FROM pg_index')&&sqlText.includes('c.relname=ANY'))return rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));
  if(sqlText.includes('FROM pg_trigger')&&sqlText.includes('tgname=ANY'))return rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));
  if(sqlText.includes('FROM pg_constraint')||sqlText.includes('FROM pg_index')||sqlText.includes('FROM pg_trigger'))return rows([]);
  if(sqlText==='SELECT clock_timestamp() AS now')return rows([{now:new Date(f.time)}]);
  if(sqlText.includes('SELECT c.*,cc.mode')){assert.deepEqual(args,[f.context.project.id,f.context.member.organizationId]);return rows([{...structuredClone(f.connection),ownerRevision:owner.revision,mode:owner.mode,anchorProjectId:f.connection.projectId}]);}
  if(sqlText.includes("action='company.own.template.recorded'"))return rows(audits.has(args[0])?[structuredClone(audits.get(args[0]))]:[]);
  if(sqlText.startsWith('UPDATE public."WhatsAppConnection"')){state.writes++;assert.deepEqual(args.slice(0,2),[f.connection.id,f.connection.projectId]);assert.match(sqlText,/"updatedAt"=clock_timestamp/);f.connection.metadata=JSON.parse(args[2]);return {rowCount:1,rows:[]};}
  if(sqlText.startsWith('INSERT INTO public."AuditLog"')){state.writes++;if(audits.has(args[0]))throw new Error('Duplicate receipt');audits.set(args[0],{id:args[0],metadata:JSON.parse(args[4])});return {rowCount:1,rows:[]};}
  if(sqlText.startsWith('UPDATE public."AuditLog"')){state.writes++;const row=audits.get(args[0]);assert.ok(row);row.metadata={...row.metadata,...JSON.parse(args[1])};return {rowCount:1,rows:[]};}
  return originalQuery(sqlText,args);
 };
 let tail=Promise.resolve();
 const workspace={async integrationProject(session,context,writable,run){
  const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;
  const saved={metadata:structuredClone(f.connection.metadata),audits:structuredClone(audits)};
  try{if(context.scope!==scope||context.projectId!==f.context.project.id)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);const result=await run(f.client,f.context.member,scope,f.context.project);state.commits++;if(state.commitLost){state.commitLost=false;throw Object.assign(new Error('Synthetic lost COMMIT acknowledgement'),{committed:true});}return result;}
  catch(error){if(!error.committed){f.connection.metadata=saved.metadata;audits.clear();for(const [key,value] of saved.audits)audits.set(key,value);}throw error;}
  finally{release();}
 }};
 const fetchImpl=async(url,request={})=>{
  const parsed=new URL(url),path=parsed.pathname.slice('/v25.0/'.length),method=request.method||'GET';
  if(path.endsWith('/message_templates')){
   f.calls.push({path,method});assert.equal(path,f.policy.wabaId+'/message_templates');
   if(method==='POST'){const body=JSON.parse(request.body),definition=buildCustomerTemplate(f.connection,blueprintKey);assert.deepEqual(body,{name:definition.name,language:definition.language,category:definition.category,components:definition.components});state.remote={id:'280000001',...body,status:'PENDING'};if(state.postLost)throw new Error('Synthetic lost provider acknowledgement');return Response.json({id:state.remote.id,status:'PENDING'});}
   assert.equal(parsed.searchParams.get('name'),buildCustomerTemplate(f.connection,blueprintKey).name);if(state.afterLookup)await state.afterLookup();return Response.json({data:state.remote?[structuredClone(state.remote)]:[]});
  }
  return f.fetchImpl(url,request);
 };
 const provider=createMetaCustomerProvider({environment:f.environment,fetchImpl,now:()=>f.time});
 const service=createOwnCompanyTemplates({workspace,provider,environment:f.environment,now:()=>f.time,...options});
 const body=(action,operationId=randomUUID(),recoveryOf=null)=>({scope,projectId:f.context.project.id,action,operationId,payload:{connectionId:f.connection.id,ownerRevision:owner.revision,grantDigest:f.runtimeGrant.grantDigest,...(action==='SUBMIT_OWN_TEMPLATE'?{review:{blueprintKey,expectedName:buildCustomerTemplate(f.connection,blueprintKey).name,contentSha256:buildCustomerTemplate(f.connection,blueprintKey).contentSha256,confirmed:true}}:{blueprintKey}),...(action==='RECOVER_OWN_TEMPLATE'?{recoveryOf}:{})}});
 const send=input=>service.command(f.context.session,input),postCount=()=>f.calls.filter(c=>c.method==='POST').length;
 f.calls.length=0;return Object.assign(f,{audits,sql,owner,state,workspace,provider,service,body,send,postCount});
}

test('OWN management reads only local canonical state, while customer transport, OAuth, templates send and COMPANY capabilities stay closed',async()=>{
 const f=await fixture(),before=f.state.writes,snapshot=await f.service.read(f.context.session,{scope,projectId:f.connection.projectId});
 ownTemplatesSnapshot(snapshot,{scope,projectId:f.connection.projectId});assert.equal(snapshot.sendingAccepted,false);assert.equal(f.state.writes,before);assert.equal(f.calls.length,0);assert.equal(metaCustomerTransportReady(f.provider.readiness()),false);
 const store=createCompanyChannelStore({workspace:f.workspace,ownTemplates:f.service,environment:f.environment});assert.deepEqual(await store.read(f.context.session,{scope,projectId:f.connection.projectId,discovery:'OWN_TEMPLATES'}),snapshot);
 const scoped=await f.provider.forConnection({capability:await f.capability(),connection:f.connection,token:f.token,beforeExternal:()=>f.beforeExternal(f.connection)});f.calls.length=0;
 for(const run of [()=>scoped.findTemplate({token:f.token,wabaId:f.policy.wabaId,name:buildCustomerTemplate(f.connection,blueprintKey).name}),()=>scoped.createTemplate({token:f.token,wabaId:f.policy.wabaId,definition:buildCustomerTemplate(f.connection,blueprintKey)}),()=>scoped.sendTemplate({token:f.token,phoneNumberId:f.policy.phoneNumberId,to:'5491100001111',message:{},correlationId:'customer_outbound_'+'c'.repeat(64)}),()=>scoped.exchange('synthetic-oauth')])await assert.rejects(run);
 assert.equal(f.calls.length,0);
});

test('prepare, exact human review and SUBMITTED readback use one create, fixed definition and immutable original receipt',async()=>{
 const f=await fixture(),prepare=f.body('PREPARE_OWN_TEMPLATE');const p=await f.send(prepare);assert.equal(p.state,'RECORDED');assert.equal(p.submissionState,'DRAFT');assert.equal(f.postCount(),0);
 const submit=f.body('SUBMIT_OWN_TEMPLATE'),result=await f.send(submit);assert.equal(result.providerConfirmed,true);assert.equal(result.providerStatus,'PENDING');assert.equal(result.sendingAccepted,false);assert.equal(f.postCount(),1);
 const saved=structuredClone(f.audits.get(result.receiptId)),replay=await f.send(submit);assert.deepEqual(replay,result);assert.deepEqual(f.audits.get(result.receiptId),saved);assert.equal(f.postCount(),1);
 const writes=f.state.writes,reads=f.calls.length;assert.deepEqual(await f.service.readReceipt(f.context.session,{scope,projectId:submit.projectId,operationId:submit.operationId}),result);assert.equal(f.state.writes,writes);assert.equal(f.calls.length,reads);
 assert.equal((await f.send(f.body('SUBMIT_OWN_TEMPLATE'))).code,'META_OWN_TEMPLATE_RECOVERY_REQUIRED');assert.equal(f.postCount(),1);
});

test('lost provider ACK is recorded honestly and subsequent recovery is GET-only; approved state never permits send',async()=>{
 const f=await fixture();await f.send(f.body('PREPARE_OWN_TEMPLATE'));f.state.postLost=true;
 const submit=f.body('SUBMIT_OWN_TEMPLATE'),unknown=await f.send(submit);assert.equal(unknown.state,'RECORDED');assert.equal(unknown.submissionState,'SUBMISSION_UNKNOWN');assert.equal(unknown.providerConfirmed,false);assert.equal(unknown.providerStatus,null);assert.equal(f.postCount(),1);
 f.state.remote.status='APPROVED';const recovered=await f.send(f.body('RECOVER_OWN_TEMPLATE'));assert.equal(recovered.providerStatus,'APPROVED');assert.equal(recovered.sendingAccepted,false);assert.equal(f.postCount(),1);
 const snapshot=await f.service.read(f.context.session,{scope,projectId:f.connection.projectId});assert.equal(snapshot.workbench.drafts[0].canSend,false);
 const original=f.audits.get(unknown.receiptId);assert.equal(original.metadata.requestDigest,digest(normalizeOwnTemplateCommand(submit)));assert.equal(original.metadata.action,'SUBMIT_OWN_TEMPLATE');
});

test('crash after committed reservation recovers exact original UUID through GET-only observation with provenance preserved',async()=>{
 let crash=true;const f=await fixture({afterReservation:async()=>{if(crash){crash=false;throw new Error('Synthetic process exit');}}});await f.send(f.body('PREPARE_OWN_TEMPLATE'));
 const submit=f.body('SUBMIT_OWN_TEMPLATE');await assert.rejects(f.send(submit));assert.equal(f.postCount(),0);
 const pending=await f.service.readReceipt(f.context.session,{scope,projectId:submit.projectId,operationId:submit.operationId});assert.equal(pending.state,'PROVIDER_STARTED');const original=structuredClone(f.audits.get(pending.receiptId));
 f.state.remote={...buildCustomerTemplate(f.connection,blueprintKey),id:'280000001',status:'APPROVED'};
 const recovery=f.body('RECOVER_OWN_TEMPLATE',submit.operationId,'SUBMIT_OWN_TEMPLATE'),result=await f.send(recovery);assert.equal(result.operationId,submit.operationId);assert.equal(result.action,submit.action);assert.equal(result.state,'RECORDED');assert.equal(result.providerStatus,'APPROVED');assert.equal(f.postCount(),0);
 const prior=f.audits.get(pending.receiptId).metadata;for(const key of ['action','requestDigest','grantDigest','ownerRevision','reservedAt'])assert.deepEqual(prior[key],original.metadata[key]);assert.equal([...f.audits.values()].filter(row=>row.id.startsWith('company_own_template_observation_')).length,1);
 await assert.rejects(f.send(recovery),error=>error.code==='META_OWN_TEMPLATE_OPERATION_CONFLICT');assert.equal(f.postCount(),0);
});

test('concurrent same and new UUID submissions cannot resend an already reserved create',async()=>{
 let release,entered;const gate=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{entered=resolve;});
 const f=await fixture({afterReservation:async()=>{entered();await gate;}});await f.send(f.body('PREPARE_OWN_TEMPLATE'));const submit=f.body('SUBMIT_OWN_TEMPLATE'),first=f.send(submit);await ready;
 const replay=await f.send(submit);assert.equal(replay.state,'PROVIDER_STARTED');assert.equal((await f.send(f.body('SUBMIT_OWN_TEMPLATE'))).code,'META_OWN_TEMPLATE_RECOVERY_REQUIRED');release();await first;assert.equal(f.postCount(),1);
});

test('lost final COMMIT ACK keeps durable result readable and prevents another provider create',async()=>{
 const f=await fixture();await f.send(f.body('PREPARE_OWN_TEMPLATE'));f.state.afterLookup=()=>{if(f.state.remote)f.state.commitLost=true;};const submit=f.body('SUBMIT_OWN_TEMPLATE');await assert.rejects(f.send(submit));assert.equal(f.postCount(),1);const result=await f.service.readReceipt(f.context.session,{scope,projectId:submit.projectId,operationId:submit.operationId});assert.equal(result.state,'RECORDED');await f.send(submit);assert.equal(f.postCount(),1);
});

for(const [name,change] of [
 ['other actor',f=>f.context.member.actorId='other-admin'],['DIRECTOR',f=>f.context.member.role='DIRECTOR'],['Clerk role',f=>f.context.session.organizationRole='org:member'],['Clerk organization',f=>f.context.session.organizationId='org_Other'],['suspended company',f=>f.owner.mode='SUSPENDED'],['inactive issuer',f=>f.controls.issuerActive=false],['wrong declaration',f=>f.controls.organizationMetadata.companyPhoneDeclaration.revision++],['revoked runtime',f=>f.connection.metadata.ownCompanyRuntime.state='REVOKED'],['changed ciphertext',f=>f.connection.encryptedAccessToken+='x'],['missing activation receipt',f=>f.controls.receiptPresent=false],['V1 without V2',f=>delete f.connection.metadata.ownCompanyRuntime],
])test('management records a definite denial for '+name+' without channel or provider mutation',async()=>{const f=await fixture();change(f);const before=structuredClone(f.connection.metadata),body=f.body('PREPARE_OWN_TEMPLATE'),denied=await f.send(body);assert.equal(denied.state,'REJECTED');assert.equal(denied.saved,false);assert.equal(denied.definitive,true);assert.equal(f.calls.length,0);assert.deepEqual(f.connection.metadata,before);assert.equal(f.state.writes,1);assert.deepEqual(await f.service.readReceipt(f.context.session,{scope,projectId:body.projectId,operationId:body.operationId}),denied);});

test('inherited names are outside the definition allowlist before reservation or provider access',async()=>{
 const f=await fixture();for(const blueprintKey of ['constructor','__proto__','toString']){const body=f.body('PREPARE_OWN_TEMPLATE');body.payload.blueprintKey=blueprintKey;await assert.rejects(f.send(body),error=>error.code==='META_CUSTOMER_TEMPLATE_INVALID');assert.throws(()=>buildCustomerTemplate(f.connection,blueprintKey));}
 assert.equal(f.state.writes,0);assert.equal(f.calls.length,0);
});

test('wrong binding, forged review, custom definition or old UUID body conflict are denied without POST',async()=>{
 const f=await fixture();await f.send(f.body('PREPARE_OWN_TEMPLATE'));
 for(const patch of [{connectionId:'other-channel'},{ownerRevision:2},{grantDigest:'c'.repeat(64)}]){const body=f.body('SUBMIT_OWN_TEMPLATE');Object.assign(body.payload,patch);assert.equal((await f.send(body)).state,'REJECTED');}
 for(const patch of [{confirmed:false},{expectedName:'custom_template'},{contentSha256:'c'.repeat(64)}]){const body=f.body('SUBMIT_OWN_TEMPLATE');Object.assign(body.payload.review,patch);assert.equal((await f.send(body)).state,'REJECTED');}
 const first=f.body('PREPARE_OWN_TEMPLATE'),saved=await f.send(first);const altered={...first,payload:{...first.payload,blueprintKey:'participant_invitation'}};await assert.rejects(f.send(altered),error=>error.code==='META_OWN_TEMPLATE_OPERATION_CONFLICT');assert.ok(saved.receiptId);assert.equal(f.postCount(),0);
 for(const patch of [{signupId:randomUUID()},{token:'synthetic-foreign-token'},{actorId:'invented'}])assert.throws(()=>normalizeOwnTemplateCommand({...first,...patch}));
});

test('provider management marker accepts only exact anchor definition and remains unable to send, subscribe, register, OAuth or list arbitrary templates',async()=>{
 const f=await fixture(),capability=await f.capability(),scoped=await f.provider.forOwnTemplateAdministration({capability,connection:f.connection,token:f.token,beforeExternal:()=>f.beforeExternal(f.connection),context:f.context,blueprintKey});f.calls.length=0;
 for(const run of [()=>scoped.templates({token:f.token,wabaId:f.policy.wabaId}),()=>scoped.findTemplate({token:f.token,wabaId:'990000001',name:buildCustomerTemplate(f.connection,blueprintKey).name}),()=>scoped.findTemplate({token:f.token,wabaId:f.policy.wabaId,name:buildCustomerTemplate(f.connection,'participant_invitation').name}),()=>scoped.createTemplate({token:f.token,wabaId:f.policy.wabaId,definition:{...buildCustomerTemplate(f.connection,blueprintKey),bodyText:'invented'}}),()=>scoped.sendTemplate({token:f.token,phoneNumberId:f.policy.phoneNumberId,to:'5491100001111',message:{},correlationId:'customer_outbound_'+'c'.repeat(64)}),()=>scoped.subscribe({token:f.token,wabaId:f.policy.wabaId}),()=>scoped.register({token:f.token,phoneNumberId:f.policy.phoneNumberId,pin:'123456'}),()=>scoped.exchange('synthetic-code')])await assert.rejects(run);
 assert.equal(f.calls.length,0);
});

test('issuer revocation or owner revision change during a lookup aborts before a provider POST',async()=>{
 for(const change of [f=>f.controls.issuerActive=false,f=>f.owner.revision++]){const f=await fixture();await f.send(f.body('PREPARE_OWN_TEMPLATE'));f.state.afterLookup=()=>change(f);await assert.rejects(f.send(f.body('SUBMIT_OWN_TEMPLATE')));assert.equal(f.postCount(),0);assert.equal(f.connection.metadata.ownCompanyTemplateDrafts[blueprintKey].state,'SUBMISSION_STARTED');}
});

test('UI command and durable journal preserve original UUID/createdAt for explicit recovery and require exact receipt before clearing',async()=>{
 const f=await fixture();await f.send(f.body('PREPARE_OWN_TEMPLATE'));const snapshot=await f.service.read(f.context.session,{scope,projectId:f.connection.projectId}),expected={scope,projectId:f.connection.projectId};
 assert.throws(()=>ownTemplateCommand(snapshot,{action:'SUBMIT_OWN_TEMPLATE',blueprintKey},expected));
 const command={...ownTemplateCommand(snapshot,{action:'SUBMIT_OWN_TEMPLATE',blueprintKey,confirmed:true},expected),operationId:randomUUID()},storage=new Map(),adapter={get length(){return storage.size;},key:index=>[...storage.keys()][index],getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},journal=createWorkspaceRecoveryJournal({getStorage:()=>adapter,now:()=>1234});
 const ticket=await journal.prepare('/api/identity/company-channel',{method:'POST',body:JSON.stringify(command)});await journal.settle(ticket,null,new Error('Lost POST ACK'));const original=structuredClone(ticket.entry);
 const recovery=f.body('RECOVER_OWN_TEMPLATE',command.operationId,'SUBMIT_OWN_TEMPLATE'),again=await journal.prepare('/api/identity/company-channel',{method:'POST',body:JSON.stringify(recovery)});assert.deepEqual(again.entry,original);assert.equal(again.entry.createdAt,1234);assert.ok(recoveryQuery(original).includes('operationId='+command.operationId));
 assert.equal(recoveryResult(original,{scope,projectId:command.projectId,saved:true,receiptId:'invented'}),null);
 const receipt={organization:{id:f.policy.organizationId,name:'Synthetic company'},actor:{id:f.policy.actorId,role:'ADMIN'},scope,projectId:command.projectId,operationId:command.operationId,action:command.action,connectionId:command.payload.connectionId,blueprintKey,ownerRevision:snapshot.ownerRevision,grantDigest:snapshot.grantDigest,state:'RECORDED',saved:true,definitive:true,receiptId:'company_own_template_'+'b'.repeat(64),submissionState:'SUBMISSION_UNKNOWN',providerConfirmed:false,sendingAccepted:false};ownTemplatesOutcome(receipt,original);await journal.settle(again,receipt);assert.equal((await journal.list(scope)).length,0);assert.equal(JSON.stringify(original).includes('grantDigest'),false);
});

test('existing company-channel HTTP route exposes narrow discovery and keeps origin, duplicate query and no-store guards',async()=>{
 const f=await fixture(),store=createCompanyChannelStore({workspace:f.workspace,ownTemplates:f.service,environment:f.environment}),h=createCompanyChannelHandlers({verify:async()=>f.context.session,store}),url='https://obrasaas.com/api/identity/company-channel?'+new URLSearchParams({scope,projectId:f.connection.projectId,discovery:'OWN_TEMPLATES'});
 const get=await h.GET(new Request(url));assert.equal(get.status,200);assert.match(get.headers.get('cache-control'),/no-store/);assert.equal(f.state.writes,0);assert.equal(f.calls.length,0);
 assert.equal((await h.GET(new Request(url+'&discovery=OWN_TEMPLATES'))).status,400);
 assert.equal((await h.POST(new Request(url.split('?')[0],{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify(f.body('PREPARE_OWN_TEMPLATE'))}))).status,403);assert.equal(f.state.writes,0);
});
