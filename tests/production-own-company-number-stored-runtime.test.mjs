import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnCompanyConnection} from '../src/lib/meta-own-company-connection.mjs';
import {readOwnCompanyPolicy} from '../src/lib/meta-own-company-policy.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../src/lib/company-channel-schema.mjs';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {ownCompanyRuntimeFixture} from './fixtures/own-company-runtime.mjs';

const scope='a'.repeat(64);
const rows=value=>({rows:value});

// Dispatch reads against the existing canonical runtime fixture. The wrapper
// adds the selected project, channel and schema catalog used by discovery;
// the real policy and issuer/audit fence still execute without a database.
async function storedFixture({expired=true}={}){
 const f=await ownCompanyRuntimeFixture();
 if(expired)f.time=Date.parse(f.policy.expiresAt)+1;
 f.member=structuredClone(f.context.member);
 f.session=structuredClone(f.context.session);
 f.request={projectId:f.policy.projectId,scope};
 f.channelState={mode:'COMPANY',revision:2};
 f.calls.length=0;f.queries.length=0;
 f.reads=[];f.operations=[];f.providerCalls=[];
 f.schemaReady=true;f.projectPresent=true;f.channelPresent=true;f.duplicateChannel=false;
 f.afterQuery=null;f.beforeProvider=null;
 const client={async query(sql,args=[]){
  f.reads.push({sql,args});
  assert.match(sql.trim(),/^SELECT\b/i,'discovery and denied commands must not write');
  let result;
  if(sql.includes('FROM public."Project" p JOIN public."Organization" o')){
   result=rows(f.projectPresent&&args[0]===f.policy.projectId&&args[1]===f.policy.organizationId?[{...structuredClone(f.context.project),organizationMetadata:structuredClone(f.controls.organizationMetadata)}]:[]);
  }else if(sql.includes('JOIN public."WhatsAppCompanyChannel" cc')){
   assert.deepEqual(args,[f.request.projectId,f.member.organizationId]);
   const channel={...structuredClone(f.connection),...f.channelState};
   result=rows(f.channelPresent?[channel,...(f.duplicateChannel?[structuredClone(channel)]:[])]:[]);
  }else if(sql.includes("metadata->>'projectId'=$4")){
   // New command UUIDs cannot replay the original activation receipt.
   result=rows([]);
  }else if(sql.includes('to_regclass'))result=rows([{present:f.schemaReady}]);
  else if(sql.includes('information_schema.columns'))result=rows(sql.includes("column_name='catalogFingerprint'")?[{count:1}]:[]);
  else if(sql.includes('FROM public."WhatsAppCompanySchema"'))result=rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]})}]);
  else if(sql.includes('FROM pg_constraint WHERE'))result=rows(args[0].map(conname=>({conname,convalidated:true})));
  else if(sql.includes('FROM pg_index i JOIN pg_class c')&&!sql.includes('pg_get_indexdef'))result=rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));
  else if(sql.includes('FROM pg_trigger WHERE'))result=rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));
  else if(sql.includes('pg_get_constraintdef')||sql.includes('pg_get_indexdef')||sql.includes('pg_get_triggerdef'))result=rows([]);
  else result=await f.client.query(sql,args);
  if(f.afterQuery)await f.afterQuery(sql,args);
  return result;
 }};
 const workspace={async organizationOperation(session,context,writable,callback,archived=false){
  f.operations.push({writable,archived,projectId:context.projectId,scope:context.scope});
  if(context.scope!==scope)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
  if(f.member.officeReviewOnly===true)throw new WorkspaceError('OFFICE_REVIEW_ONLY',403);
  return callback(client,f.member,scope);
 }};
 const provider={async forOwnCapability(...args){f.providerCalls.push('forOwnCapability');if(f.beforeProvider)await f.beforeProvider();return f.provider.forOwnCapability(...args);},async forConnection(){f.providerCalls.push('forConnection');throw new Error('Unexpected credential/provider access');}};
 f.service=createOwnCompanyConnection({workspace,provider,environment:f.environment,now:()=>f.time});
 f.discover=()=>f.service.discover(f.session,f.request);
 return f;
}

function expectedStored(f){return {
 version:1,kind:'OWN_COMPANY_STORED_RUNTIME',
 organization:{id:f.policy.organizationId,name:f.member.organizationName},actor:{id:f.policy.actorId,role:'ADMIN'},
 scope,projectId:f.policy.projectId,readOnly:true,canManage:false,mode:'OWN_COMPANY',
 evidenceOrigin:'STORED_CANONICAL_RUNTIME',observedAt:new Date(f.time).toISOString(),configurationAuthorization:{state:'NOT_CURRENT'},
 channel:{id:f.connection.id,anchorProjectId:f.policy.projectId,revision:f.channelState.revision,mode:'COMPANY',displayPhoneNumber:f.policy.expectedPhoneE164,connectionStatus:'CONNECTED',enabled:true},
 operationalGrant:{version:2,state:'ACTIVE',credentialExpiresAt:f.runtimeGrant.validUntil,roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'},accepted:false,roundTrip:'NOT_VERIFIED',
};}

function assertReadOnly(f){
 assert.deepEqual(f.providerCalls,[]);assert.deepEqual(f.calls,[]);
 assert.ok(f.operations.length>0);assert.ok(f.operations.every(op=>op.writable===false&&op.archived===false));
 assert.ok(f.reads.every(({sql})=>/^SELECT\b/i.test(sql.trim())&&!/\bFOR\s+(SHARE|UPDATE)\b/i.test(sql)));
}

for(const [name,prepare] of [
 ['expired setup window',()=>{}],
 ['a later deployment SHA',f=>{f.time=Date.parse(f.runtimeGrant.issuedAt);f.environment.VERCEL_GIT_COMMIT_SHA='c'.repeat(40);}],
 ['removed import configuration',f=>{delete f.environment.OBRASAAS_META_OWN_COMPANY_POLICY;delete f.environment.OBRASAAS_META_OWN_COMPANY_RELEASE;}],
])test('discovery returns exact stored runtime DTO after '+name+' without provider, decryption or write authority',async()=>{
 const f=await storedFixture();prepare(f);
 delete f.environment.META_CUSTOMER_CREDENTIALS_KEY;delete f.environment.META_OWN_COMPANY_ACCESS_TOKEN;
 assert.equal(readOwnCompanyPolicy(f.environment,f.time),null);
 assert.deepEqual(await f.discover(),expectedStored(f));assertReadOnly(f);
 assert.ok(f.reads.some(({sql})=>sql.includes('FROM public."PlatformUser"')));
 assert.ok(f.reads.some(({sql})=>sql.includes('FROM public."AuditLog"')));
 assert.ok(f.reads.some(({sql})=>sql.includes('FROM public."WhatsAppConnection" c JOIN public."Project" p')));
});

test('current setup discovery continues live provider inspection and does not return the stored variant',async()=>{
 const f=await storedFixture({expired:false});assert.ok(readOwnCompanyPolicy(f.environment,f.time));
 const result=await f.discover();assert.equal(result.canManage,true);assert.equal(result.connectionOwnVerified,true);
 assert.equal(Object.hasOwn(result,'kind'),false);assert.ok(f.providerCalls.length>0);assert.ok(f.calls.length>0);assert.ok(f.calls.every(call=>call.method==='GET'));
});

test('a provider failure under a current setup policy remains a failure rather than stored runtime success',async()=>{
 const f=await storedFixture({expired:false});f.state.failRead='debug_token';
 await assert.rejects(f.discover(),{code:'META_OWN_COMPANY_OWNER_UNCONFIRMED'});assert.deepEqual(f.providerCalls,['forOwnCapability']);
 assert.equal(f.calls.length,1);assert.ok(!f.reads.some(({sql})=>sql.includes('FROM public."PlatformUser"')));
});

test('provider-side expiry after the initial authorized setup snapshot cannot trigger stored fallback',async()=>{
 const f=await storedFixture({expired:false});
 f.beforeProvider=()=>{f.time=Date.parse(f.policy.expiresAt)+1;throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);};
 await assert.rejects(f.discover(),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.deepEqual(f.providerCalls,['forOwnCapability']);
 assert.equal(readOwnCompanyPolicy(f.environment,f.time),null);assert.ok(!f.reads.some(({sql})=>sql.includes('FROM public."PlatformUser"')));
});

test('current setup actor mismatch remains closed before provider access even with a valid stored runtime',async()=>{
 const f=await storedFixture({expired:false});f.member.actorId='another-admin';
 await assert.rejects(f.discover(),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.deepEqual(f.providerCalls,[]);
 assert.ok(!f.reads.some(({sql})=>sql.includes('FROM public."PlatformUser"')));
});

test('current setup declaration mismatch remains closed rather than using stored authority',async()=>{
 const f=await storedFixture({expired:false});f.controls.organizationMetadata={companyPhoneDeclaration:{...f.declaration,revision:2}};
 await assert.rejects(f.discover(),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.deepEqual(f.providerCalls,[]);
});

for(const action of ['CONNECT_OWN_NUMBER','ACTIVATE_OWN_NUMBER'])test('stored readback cannot authorize '+action+' after setup expiry',async()=>{
 const f=await storedFixture();assert.equal((await f.discover()).canManage,false);
 const command={action,operationId:'22222222-2222-4222-8222-222222222222',...f.request,payload:{connectionId:f.connection.id,revision:2,companyPhoneRevision:1,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId,confirmOwnBusiness:true,confirmReplacement:false,...(action==='ACTIVATE_OWN_NUMBER'?{confirmRegistration:false,securityPin:null}:{})}};
 await assert.rejects(f.service.command(f.session,command),{code:'META_OWN_COMPANY_UNAVAILABLE'});assertReadOnly(f);
});

for(const [name,mutate,code='META_OWN_COMPANY_UNAVAILABLE'] of [
 ['caller actor',f=>f.member.actorId='another-admin'],
 ['caller role',f=>f.member.role='DIRECTOR','META_OWN_COMPANY_ADMIN_REQUIRED'],
 ['caller Clerk user',f=>f.session.userId='user_Other'],
 ['caller Clerk organization',f=>f.session.organizationId='org_Other'],
 ['caller Clerk admin role',f=>f.session.organizationRole='org:member','META_OWN_COMPANY_ADMIN_REQUIRED'],
 ['caller tenant',f=>f.member.organizationId='org-b','META_OWN_COMPANY_CONTEXT_CHANGED'],
 ['selected project',f=>f.request.projectId='project-b','META_OWN_COMPANY_CONTEXT_CHANGED'],
 ['current scope',f=>f.request.scope='b'.repeat(64),'WORKSPACE_CONTEXT_CHANGED'],
 ['office reviewer with borrowed canonical ADMIN',f=>{f.member.officeReviewOnly=true;f.member.canonicalRole='ADMIN';},'OFFICE_REVIEW_ONLY'],
 ['inactive issuer',f=>f.controls.issuerActive=false],
 ['revoked issuer ADMIN',f=>f.controls.issuerRole='DIRECTOR'],
 ['changed canonical declaration revision',f=>f.controls.organizationMetadata={companyPhoneDeclaration:{...f.declaration,revision:2}}],
 ['changed canonical declaration number',f=>f.controls.organizationMetadata={companyPhoneDeclaration:{...f.declaration,e164:'+5491100001111'}}],
])test('stored discovery denies '+name+' without importing provider authority',async()=>{
 const f=await storedFixture();mutate(f);await assert.rejects(f.discover(),{code});assertReadOnly(f);
});

for(const [name,mutate,code='META_OWN_COMPANY_UNAVAILABLE'] of [
 ['missing current project',f=>f.projectPresent=false,'META_OWN_COMPANY_CONTEXT_CHANGED'],
 ['missing channel',f=>f.channelPresent=false],
 ['ambiguous channel',f=>f.duplicateChannel=true,'META_OWN_COMPANY_CONNECTION_CONFLICT'],
 ['suspended channel',f=>f.channelState.mode='SUSPENDED'],
 ['prepared channel',f=>f.channelState.mode='PREPARED'],
 ['disabled channel',f=>f.connection.enabled=false],
 ['disconnected channel',f=>f.connection.connectionStatus='DISCONNECTED'],
 ['missing runtime grant',f=>delete f.connection.metadata.ownCompanyRuntime],
 ['v1 runtime grant',f=>f.connection.metadata.ownCompanyRuntime.version=1],
 ['null runtime grant',f=>f.connection.metadata.ownCompanyRuntime=null],
 ['revoked runtime grant',f=>f.connection.metadata.ownCompanyRuntime.state='REVOKED'],
 ['changed runtime origin metadata',f=>f.connection.metadata.ownCompanyRuntime.origin.sourceHead='d'.repeat(40)],
 ['changed original owner proof',f=>f.connection.metadata.ownCompany.ownerVerified=false],
 ['changed ciphertext',f=>f.connection.encryptedAccessToken+='changed'],
 ['missing activation receipt',f=>f.controls.receiptPresent=false],
 ['uncertain activation receipt',f=>f.receipt.metadata.state='PROVIDER_UNKNOWN'],
 ['different activation action',f=>f.receipt.metadata.action='CONNECT_OWN_NUMBER'],
 ['different audit grant',f=>f.receipt.metadata.runtimeGrant.tokenDigest='e'.repeat(64)],
 ['replaced canonical ciphertext',f=>f.controls.current={...structuredClone(f.connection),encryptedAccessToken:f.connection.encryptedAccessToken+'changed'}],
 ['revoked canonical connection',f=>{f.controls.current=structuredClone(f.connection);f.controls.current.metadata.ownCompanyRuntime.state='REVOKED';}],
 ['missing canonical connection',f=>f.controls.current=null],
 ['exact credential expiry',f=>f.time=Date.parse(f.runtimeGrant.validUntil)],
 ['credential expiry passed during canonical fence',f=>f.afterQuery=sql=>{if(sql.includes('FROM public."AuditLog"'))f.time=Date.parse(f.runtimeGrant.validUntil);}],
 ['unavailable channel schema',f=>f.schemaReady=false,'COMPANY_CHANNEL_CATALOG_REQUIRED'],
])test('stored discovery fails closed for '+name,async()=>{
 const f=await storedFixture();mutate(f);await assert.rejects(f.discover(),{code});assertReadOnly(f);
});
