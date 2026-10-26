import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMetaCustomerProvider,metaCustomerReadiness,metaCustomerScopedTransportReady} from '../src/lib/meta-customer-provider.mjs';
import {createOwnCompanyCapability,createOwnCompanyRuntimeGrant,lockOwnCompanyIssuer,fenceOwnCompanyRuntime,ownCompanyCapabilityKind} from '../src/lib/meta-own-company-policy.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {ownCompanyFixture} from './fixtures/own-company-meta.mjs';

const operation='11111111-1111-4111-8111-111111111111',mediaId='270000001';
const reply=f=>({token:f.token,phoneNumberId:f.policy.phoneNumberId,to:'5491100001111',replyTo:'wamid.syntheticincoming12345',correlationId:'customer_outbound_'+'b'.repeat(64),message:{type:'text',body:'Synthetic canonical runtime reply'}});
async function fixture({dataAccessHours=null,omittedTargets=false}={}){
 const f=ownCompanyFixture({time:Date.parse('2026-10-09T12:00:00.000Z')});
 f.token=f.environment.META_OWN_COMPANY_ACCESS_TOKEN;f.debug.expires_at=(f.time+48*3600000)/1000;f.debug.data_access_expires_at=dataAccessHours===null?0:(f.time+dataAccessHours*3600000)/1000;
 if(omittedTargets)for(const grant of f.debug.granular_scopes)delete grant.target_ids;
 const bytes=Buffer.from('synthetic bounded own-company media'),sha256=createHash('sha256').update(bytes).digest('hex');
 f.media={bytes,sha256,afterMetadata:null,afterAttachment:null,afterChunk:null};
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url),method=options.method||'GET';
  if(parsed.hostname==='graph.facebook.com'&&parsed.pathname==='/v25.0/'+mediaId){
   f.calls.push({path:mediaId,method});assert.equal(parsed.searchParams.get('phone_number_id'),f.policy.phoneNumberId);
   if(f.media.afterMetadata)await f.media.afterMetadata();return Response.json({id:mediaId,url:'https://lookaside.fbsbx.com/whatsapp_business/attachments/synthetic-own-media',mime_type:'image/png',file_size:bytes.length,sha256});
  }
  if(parsed.hostname==='lookaside.fbsbx.com'){
   f.calls.push({path:'attachment',method});if(f.media.afterAttachment)await f.media.afterAttachment();
   const stream=new ReadableStream({async start(controller){if(f.media.afterChunk)await f.media.afterChunk();controller.enqueue(bytes);controller.close();}});
   return new Response(stream,{headers:{'content-type':'image/png','content-length':String(bytes.length)}});
  }
  return f.fetchImpl(url,options);
 };
 f.base=createMetaCustomerProvider({environment:f.environment,fetchImpl,now:()=>f.time});
 f.adminCapability=createOwnCompanyCapability(f.context,f.environment,f.time);f.admin=await f.base.forOwnCapability({capability:f.adminCapability,token:f.token});
 f.inspection=await f.admin.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId});
 const connection={id:'channel-own',organizationId:f.policy.organizationId,projectId:f.policy.projectId,whatsappBusinessId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId,displayPhoneNumber:f.policy.expectedPhoneE164,enabled:true,connectionStatus:'CONNECTED',encryptedAccessToken:encryptCustomerSecret(f.token,{organizationId:f.policy.organizationId,projectId:f.policy.projectId,purpose:'connection',resourceId:f.policy.phoneNumberId},f.environment),metadata:{credentialOrganizationId:f.policy.organizationId,credentialFormat:'tenant-aad-v2',declaredCompanyPhone:{e164:f.policy.expectedPhoneE164,revision:f.policy.companyPhoneRevision},customerSubscribed:true,customerActivation:{state:'ACTIVE'},ownCompany:f.admin.ownProvenance(f.inspection)}};
 const receiptId='company_own_'+digest([f.policy.organizationId,f.policy.actorId,f.policy.projectId,operation]);
 connection.metadata.ownCompanyRuntime=createOwnCompanyRuntimeGrant({capability:f.adminCapability,connection,receiptId,operationId:operation,channelRevision:2,providerAuthority:f.admin.ownOperationalAuthority(f.inspection)},f.environment,f.time);
 f.connection=connection;f.canonical={issuer:true,receipt:true,connection:structuredClone(connection)};
 const client={query:async(sql)=>({rows:sql.includes('public."AuditLog"')?f.canonical.receipt?[{id:receiptId,metadata:{state:'RECORDED',action:'ACTIVATE_OWN_NUMBER',projectId:f.policy.projectId,operationId:operation,connectionId:connection.id,policyDigest:connection.metadata.ownCompany.policyDigest,runtimeGrant:connection.metadata.ownCompanyRuntime}}]:[]:sql.includes('public."WhatsAppConnection"')?f.canonical.connection?[f.canonical.connection]:[]:f.canonical.issuer?[{...f.context.member,organizationMetadata:{companyPhoneDeclaration:f.declaration}}]:[]})};
 f.capability=()=>lockOwnCompanyIssuer(client,connection,{environment:f.environment,now:f.time});
 f.fence=()=>fenceOwnCompanyRuntime(client,connection,{environment:f.environment,now:f.time});
 f.runtime=async()=>f.base.forConnection({capability:await f.capability(),connection,token:f.token,beforeExternal:f.fence});
 f.afterAdministrativeExpiry=()=>{f.time+=5*3600000;f.environment.VERCEL_GIT_COMMIT_SHA='c'.repeat(40);for(const key of ['OBRASAAS_META_OWN_COMPANY_POLICY','OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256','OBRASAAS_META_OWN_COMPANY_RELEASE','META_OWN_COMPANY_ACCESS_TOKEN'])delete f.environment[key];};
 f.calls.length=0;return f;
}

test('runtime v2 uses its canonical receipt/vault after administrative expiry and a new source, with customer/coexistence/development still closed',async()=>{
 const f=await fixture(),globals={META_WHATSAPP_ACCESS_TOKEN:f.environment.META_WHATSAPP_ACCESS_TOKEN,WHATSAPP_TOKEN:f.environment.WHATSAPP_TOKEN};f.afterAdministrativeExpiry();
 assert.equal(ownCompanyCapabilityKind(await f.capability()),'RUNTIME');const scoped=await f.runtime();
 assert.equal(metaCustomerReadiness(f.environment).canLaunchMeta,false);assert.equal(metaCustomerReadiness(f.environment).flows.BUSINESS_APP.available,false);assert.equal(metaCustomerScopedTransportReady(scoped.readiness()),true);assert.equal(scoped.readiness().canLaunchMeta,false);assert.equal(f.environment.OBRASAAS_META_DEVELOPMENT_PILOT_POLICY,undefined);
 assert.equal(await scoped.inspectSubscription({token:f.token,wabaId:f.policy.wabaId}),true);
 assert.ok((await scoped.sendReply(reply(f))).messageId);const media=await scoped.downloadMedia({token:f.token,phoneNumberId:f.policy.phoneNumberId,mediaId});assert.deepEqual(media.bytes,f.media.bytes);assert.equal(media.sha256,f.media.sha256);
 assert.deepEqual({META_WHATSAPP_ACCESS_TOKEN:f.environment.META_WHATSAPP_ACCESS_TOKEN,WHATSAPP_TOKEN:f.environment.WHATSAPP_TOKEN},globals);assert.equal(f.calls.filter(call=>call.method==='POST').length,1);assert.equal(f.calls.filter(call=>call.method==='POST')[0].path,f.policy.phoneNumberId+'/messages');
 assert.ok(f.calls.some(call=>call.path.endsWith('/system_users')));assert.ok(f.calls.some(call=>call.path.endsWith('/owned_apps')));assert.ok(f.calls.some(call=>call.path.endsWith('/owned_whatsapp_business_accounts')));
 await assert.rejects(f.base.forOwnCompany(f.context),error=>error.code==='META_OWN_COMPANY_UNAVAILABLE');
});

test('runtime omitted granular targets still require the current canonical grant, all owned edges and phone before one reply',async()=>{
 const f=await fixture({omittedTargets:true});f.afterAdministrativeExpiry();const scoped=await f.runtime();
 for(const edge of ['system_users','owned_apps','owned_whatsapp_business_accounts'])assert.ok(f.calls.some(call=>call.path===f.policy.businessId+'/'+edge));
 assert.ok(f.calls.some(call=>call.path===f.policy.wabaId+'/phone_numbers'));assert.ok(await scoped.sendReply(reply(f)));assert.equal(f.calls.filter(call=>call.method==='POST').length,1);
 f.calls.length=0;f.canonical.receipt=false;await assert.rejects(f.runtime(),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(f.calls.length,0);
});

for(const edge of ['system_users','owned_apps','owned_whatsapp_business_accounts'])for(const signal of ['missingEdge','pagingEdge'])test('runtime omission rejects '+signal+' '+edge+' without a reply POST',async()=>{
 const f=await fixture({omittedTargets:true});f.afterAdministrativeExpiry();f.state[signal]=edge;
 await assert.rejects(f.runtime(),{code:'META_OWN_COMPANY_OWNER_UNVERIFIED'});assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
});
test('operational authority derives finite debug expiry from the original ADMIN inspection rather than caller fields',async()=>{
 const f=await fixture({dataAccessHours:36}),authority=f.admin.ownOperationalAuthority(f.inspection);
 assert.equal(authority.tokenExpiresAt,new Date(f.debug.expires_at*1000).toISOString());assert.equal(authority.dataAccessExpiresAt,new Date(f.debug.data_access_expires_at*1000).toISOString());assert.equal(f.connection.metadata.ownCompanyRuntime.validUntil,authority.dataAccessExpiresAt);
 f.inspection.expiresAt='2099-01-01T00:00:00.000Z';f.inspection.registered=false;assert.deepEqual(f.admin.ownOperationalAuthority(f.inspection),authority);
 assert.throws(()=>f.admin.ownOperationalAuthority({...f.inspection}),error=>error.code==='META_OWN_COMPANY_OWNER_UNVERIFIED');
 f.time+=60001;assert.throws(()=>f.admin.ownOperationalAuthority(f.inspection));
});
test('registration-phase or superseded inspection cannot create an operational runtime authority',async()=>{
 const f=await fixture(),original=f.inspection;
 const pre=await f.admin.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId,inspectionPhase:'PRE_REGISTRATION'});
 assert.throws(()=>f.admin.ownOperationalAuthority(pre),error=>error.code==='META_OWN_COMPANY_OWNER_UNVERIFIED');assert.throws(()=>f.admin.ownOperationalAuthority(original),error=>error.code==='META_OWN_COMPANY_OWNER_UNVERIFIED');
 f.state.registered=false;const pending=await f.admin.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId});assert.throws(()=>f.admin.ownOperationalAuthority(pending),error=>error.code==='META_OWN_COMPANY_OWNER_UNVERIFIED');assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
});
for(const [name,status] of [['unverified','NOT_VERIFIED'],['missing',undefined],['expired','EXPIRED']])test('ADMIN '+name+' phone verification cannot mint operational authority through a forged inspection DTO',async()=>{
 const f=await fixture();f.calls.length=0;if(status===undefined)delete f.phone.code_verification_status;else f.phone.code_verification_status=status;
 const inspection=await f.admin.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId});
 assert.equal(inspection.registered,true);assert.equal(inspection.platformType,'CLOUD_API');assert.equal(Object.hasOwn(inspection,'phoneCodeVerified'),false);
 assert.throws(()=>f.admin.ownOperationalAuthority(inspection),error=>error.code==='META_OWN_COMPANY_OWNER_UNVERIFIED');
 inspection.phoneCodeVerified=true;inspection.code_verification_status='VERIFIED';
 assert.throws(()=>f.admin.ownOperationalAuthority(inspection),error=>error.code==='META_OWN_COMPANY_OWNER_UNVERIFIED');
 assert.throws(()=>f.admin.ownOperationalAuthority({...inspection}),error=>error.code==='META_OWN_COMPANY_OWNER_UNVERIFIED');
 assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
});
test('runtime capability cannot import, mint provenance/authority, subscribe, register or access templates/coexistence',async()=>{
 const f=await fixture(),capability=await f.capability(),scoped=await f.runtime();f.calls.length=0;
 await assert.rejects(f.base.forOwnCapability({capability,token:f.token}),error=>error.code==='META_OWN_COMPANY_UNAVAILABLE');
 assert.throws(()=>scoped.ownProvenance(f.inspection),error=>error.code==='META_OWN_COMPANY_UNAVAILABLE');assert.throws(()=>scoped.ownOperationalAuthority(f.inspection),error=>error.code==='META_OWN_COMPANY_UNAVAILABLE');
 for(const execute of [()=>scoped.subscribe({token:f.token,wabaId:f.policy.wabaId}),()=>scoped.register({token:f.token,phoneNumberId:f.policy.phoneNumberId,pin:'123456',inspection:f.inspection}),()=>scoped.templates({token:f.token,wabaId:f.policy.wabaId}),()=>scoped.findTemplate({token:f.token,wabaId:f.policy.wabaId,name:'obrasaas_synthetic'}),()=>scoped.createTemplate({token:f.token,wabaId:f.policy.wabaId,definition:{}}),()=>scoped.sendTemplate({...reply(f),message:{}}),()=>scoped.syncAppData({token:f.token,phoneNumberId:f.policy.phoneNumberId,syncType:'history'})])await assert.rejects(execute,error=>error.code==='META_OWN_COMPANY_ADAPTER_UNAVAILABLE');
 await assert.rejects(scoped.exchange('synthetic-code'));assert.equal(f.calls.length,0);
});
for(const [name,alter] of [
 ['foreign connection',f=>({...f.connection,id:'channel-other'})],['foreign tenant',f=>({...f.connection,organizationId:'org-other'})],['foreign phone',f=>({...f.connection,phoneNumberId:'990000001'})],['different credential ciphertext',f=>({...f.connection,encryptedAccessToken:f.connection.encryptedAccessToken+'x'})],['missing provenance',f=>({...f.connection,metadata:{...f.connection.metadata,ownCompany:null}})],['invalid v2 with valid v1',f=>({...f.connection,metadata:{...f.connection.metadata,ownCompanyRuntime:null}})],['revoked grant',f=>({...f.connection,metadata:{...f.connection.metadata,ownCompanyRuntime:{...f.connection.metadata.ownCompanyRuntime,state:'REVOKED'}}})],
])test('runtime refuses '+name+' before a provider GET or fallback',async()=>{const f=await fixture(),capability=await f.capability();await assert.rejects(f.base.forConnection({capability,connection:alter(f),token:f.token}));assert.equal(f.calls.length,0);});
test('serialized capabilities, ADMIN capability on v2 and foreign tokens fail before provider reads',async()=>{
 const f=await fixture(),capability=await f.capability();
 for(const cap of [{},{...capability},f.adminCapability])await assert.rejects(f.base.forConnection({capability:cap,connection:f.connection,token:f.token}));
 await assert.rejects(f.base.forConnection({capability,connection:f.connection,token:'synthetic-foreign-vault-token'}));assert.equal(f.calls.length,0);
 await assert.rejects(f.base.forConnection({capability,connection:f.connection,token:f.token}),error=>error.code==='META_OWN_COMPANY_UNAVAILABLE');assert.equal(f.calls.length,0);
 const scoped=await f.runtime();f.calls.length=0;await assert.rejects(scoped.sendReply({...reply(f),token:'synthetic-foreign-vault-token'}),error=>error.code==='META_OWN_COMPANY_CREDENTIAL_REJECTED');await assert.rejects(scoped.inspect({token:'synthetic-foreign-vault-token',wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId}),error=>error.code==='META_OWN_COMPANY_CREDENTIAL_REJECTED');assert.equal(f.calls.length,0);
});
for(const [name,mutate] of [
 ['revoked token',f=>f.debug.is_valid=false],['different system user',f=>f.debug.user_id='990000001'],['unexpected scope',f=>f.debug.scopes.push('ads_read')],['contradictory granular targets',f=>f.debug.granular_scopes[1].target_ids=['990000001']],['changed token expiry',f=>f.debug.expires_at+=3600],['unknown data access expiry',f=>delete f.debug.data_access_expires_at],['unrepresentable token expiry',f=>f.debug.expires_at=Number.MAX_SAFE_INTEGER],['unrepresentable data access expiry',f=>f.debug.data_access_expires_at=Number.MAX_SAFE_INTEGER],['unowned system user',f=>f.state.missingEdge='system_users'],['unowned app',f=>f.state.missingEdge='owned_apps'],['unowned WABA',f=>f.state.missingEdge='owned_whatsapp_business_accounts'],['paged ownership',f=>f.state.pagingEdge='owned_apps'],['different declared phone',f=>f.phone.display_phone_number='+5491100000001'],['unverified phone',f=>f.phone.code_verification_status='NOT_VERIFIED'],['unregistered phone',f=>f.state.registered=false],['revoked subscription',f=>f.state.subscribed=false],
])test('fresh runtime verification denies '+name+' with zero POST',async()=>{const f=await fixture();f.afterAdministrativeExpiry();mutate(f);await assert.rejects(f.runtime());assert.equal(f.calls.filter(call=>call.method==='POST').length,0);});
test('runtime verification status diagnostics contain only a fixed event and stage despite hostile provider data',async t=>{
 const logs=[];t.mock.method(console,'warn',value=>logs.push(value));
 for(const status of ['NOT_VERIFIED',undefined,'HOSTILE_PROVIDER_DATA']){
  const f=await fixture();if(status===undefined)delete f.phone.code_verification_status;else f.phone.code_verification_status=status==='HOSTILE_PROVIDER_DATA'?[status,f.token,f.policy.expectedPhoneE164,f.policy.phoneNumberId].join('|'):status;
  await assert.rejects(f.runtime(),error=>error.code==='META_OWN_COMPANY_PHONE_REJECTED');assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
 }
 assert.ok(logs.every(value=>typeof value==='string'));assert.deepEqual(logs.map(value=>JSON.parse(value)),Array.from({length:3},()=>({event:'META_OWN_COMPANY_PHONE_REJECTED',version:1,stage:'VERIFICATION_STATUS'})));
});
test('runtime display phone mismatch diagnostics never include the provider display or credentials',async t=>{
 const f=await fixture(),logs=[];t.mock.method(console,'warn',value=>logs.push(value));f.phone.display_phone_number='+5491100000001';f.phone.verified_name='HOSTILE_PROVIDER_NAME|'+f.token;
 await assert.rejects(f.runtime(),error=>error.code==='META_OWN_COMPANY_PHONE_REJECTED');assert.deepEqual(logs.map(value=>JSON.parse(value)),[{event:'META_OWN_COMPANY_PHONE_REJECTED',version:1,stage:'DISPLAY_PHONE_MATCH'}]);assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
});
test('superseded inspection diagnostics preserve rejection before normalizing the stale display', {timeout:5000},async t=>{
 const f=await fixture(),scoped=await f.runtime(),logs=[];t.mock.method(console,'warn',value=>logs.push(value));f.calls.length=0;f.phone.display_phone_number='HOSTILE_STALE_DISPLAY|'+f.token;
 let release,entered;const blocked=new Promise(resolve=>{release=resolve;}),observed=new Promise(resolve=>{entered=resolve;});let first=true;
 f.state.afterRead=async path=>{if(path===f.policy.wabaId+'/phone_numbers'&&first){first=false;entered();await blocked;}};
 const earlier=scoped.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId}),denied=assert.rejects(earlier,error=>error.code==='META_OWN_COMPANY_PHONE_REJECTED');
 try{await observed;f.phone.display_phone_number=f.policy.expectedPhoneE164;await scoped.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId});}finally{release();}
 await denied;assert.deepEqual(logs.map(value=>JSON.parse(value)),[{event:'META_OWN_COMPANY_PHONE_REJECTED',version:1,stage:'INSPECTION_SUPERSEDED'}]);assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
});
test('a failing private phone diagnostic reporter cannot change denials or permit a reply POST',async t=>{
 const warning=t.mock.method(console,'warn',()=>{throw Error('SYNTHETIC_PRIVATE_LOG_FAILURE');});
 for(const kind of ['verification','display']){const f=await fixture();if(kind==='verification')f.phone.code_verification_status='NOT_VERIFIED';else f.phone.display_phone_number='+5491100000001';await assert.rejects(f.runtime(),error=>error.code==='META_OWN_COMPANY_PHONE_REJECTED');assert.equal(f.calls.filter(call=>call.method==='POST').length,0);}
 assert.equal(warning.mock.callCount(),2);
});
test('second debug after ownership cannot change expiry or user and the runtime lease cannot expire during the audit',async()=>{
 for(const scenario of ['debug','lease']){
  const f=await fixture();let reads=0;f.state.afterRead=async path=>{if(scenario==='debug'&&path==='debug_token'&&++reads===2)f.debug.expires_at+=3600;if(scenario==='lease'&&path.endsWith('/owned_apps'))f.time+=60001;};
  await assert.rejects(f.runtime());assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
 }
});
test('canonical suspension, declaration, issuer, receipt or vault change during ownership GET denies effects while the 60-second lease is still valid',async()=>{
 for(const path of ['debug_token','owned_apps'])for(const reason of ['suspension','declaration','issuer','receipt','vault']){
  const f=await fixture(),issuedAt=f.time;
  f.state.afterRead=async observed=>{if(observed==='debug_token'&&path==='debug_token'||observed.endsWith('/owned_apps')&&path==='owned_apps'){
   if(reason==='suspension')f.canonical.connection.enabled=false;if(reason==='declaration')f.declaration.revision+=1;if(reason==='issuer')f.canonical.issuer=false;if(reason==='receipt')f.canonical.receipt=false;if(reason==='vault')f.canonical.connection.encryptedAccessToken+='x';
  }};
  await assert.rejects(f.runtime(),error=>error.code==='META_OWN_COMPANY_UNAVAILABLE');assert.equal(f.time,issuedAt);assert.ok(f.calls.length>0);assert.equal(f.calls.filter(call=>call.method==='POST'||call.path==='attachment').length,0);
 }
});
test('canonical issuer/receipt revocation stops a fresh runtime lease, while finite token/data access expiry stops existing transport',async()=>{
 for(const reason of ['issuer','receipt','token','data']){
  const f=await fixture({dataAccessHours:36}),scoped=await f.runtime();f.calls.length=0;
  if(['issuer','receipt'].includes(reason)){f.canonical[reason]=false;await assert.rejects(f.runtime());}
  else{f.time=Date.parse(reason==='token'?f.connection.metadata.ownCompanyRuntime.tokenExpiresAt:f.connection.metadata.ownCompanyRuntime.dataAccessExpiresAt);await assert.rejects(scoped.sendReply(reply(f)));await assert.rejects(f.runtime());}
  assert.equal(f.calls.length,0);
 }
});
test('runtime attachment GET and returned bytes are denied if canonical guard or request lease fails after an await',async()=>{
 for(const scenario of ['guard','metadata','attachment','stream']){
  const f=await fixture(),scoped=await f.runtime();f.calls.length=0;let guarded=0;
  const beforeExternal=async()=>{if(scenario==='guard'&&++guarded===2)throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);};
  if(scenario==='metadata')f.media.afterMetadata=async()=>{f.time+=60001;};if(scenario==='attachment')f.media.afterAttachment=async()=>{f.time+=60001;};if(scenario==='stream')f.media.afterChunk=async()=>{await Promise.resolve();f.time+=60001;};
  await assert.rejects(scoped.downloadMedia({token:f.token,phoneNumberId:f.policy.phoneNumberId,mediaId,beforeExternal}));
  assert.equal(f.calls.filter(call=>call.path==='attachment').length,['attachment','stream'].includes(scenario)?1:0);assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
 }
});
test('runtime media canonical fence prevents attachment GET or returned bytes after ownership/declaration revocation with a valid lease',async()=>{
 for(const stage of ['metadata','attachment','stream']){
  const f=await fixture(),scoped=await f.runtime(),issuedAt=f.time;f.calls.length=0;
  const revoke=async()=>{f.declaration.revision+=1;};if(stage==='metadata')f.media.afterMetadata=revoke;if(stage==='attachment')f.media.afterAttachment=revoke;if(stage==='stream')f.media.afterChunk=revoke;
  await assert.rejects(scoped.downloadMedia({token:f.token,phoneNumberId:f.policy.phoneNumberId,mediaId}),error=>error.code==='META_OWN_COMPANY_UNAVAILABLE');assert.equal(f.time,issuedAt);assert.equal(f.calls.filter(call=>call.path==='attachment').length,stage==='metadata'?0:1);assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
 }
});
test('runtime rechecks the canonical external guard before reply POST and retains provider uncertainty without replay',async()=>{
 const f=await fixture(),scoped=await f.runtime();f.calls.length=0;
 await assert.rejects(scoped.sendReply({...reply(f),beforeExternal:async()=>{throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);}}),error=>error.code==='META_OWN_COMPANY_UNAVAILABLE');assert.equal(f.calls.length,0);
 f.state.failPost=f.policy.phoneNumberId+'/messages';await assert.rejects(scoped.sendReply(reply(f)),error=>error.code==='META_CUSTOMER_PROVIDER_UNCONFIRMED');assert.equal(f.calls.filter(call=>call.method==='POST').length,1);
});

async function expiredTransportFixture(){
 const f=await fixture();f.phone.code_verification_status='EXPIRED';return f;
}

test('existing ACTIVE OWN runtime transports an exact connected Cloud phone with an expired ownership code after all current checks',async()=>{
 const f=await expiredTransportFixture(),before=structuredClone(f.connection);f.afterAdministrativeExpiry();
 const scoped=await f.runtime();
 assert.deepEqual(f.calls.map(call=>[call.method,call.path]),[['GET','debug_token'],...['system_users','owned_apps','owned_whatsapp_business_accounts'].map(edge=>['GET',f.policy.businessId+'/'+edge]),['GET','debug_token'],['GET',f.policy.wabaId+'/phone_numbers'],['GET',f.policy.wabaId+'/subscribed_apps']]);
 assert.equal(f.calls.filter(call=>call.method==='POST').length,0);assert.equal(scoped.requestCode,undefined);assert.equal(scoped.verifyCode,undefined);
 assert.ok((await scoped.sendReply(reply(f))).messageId);
 assert.deepEqual(f.calls.filter(call=>call.method==='POST'),[{path:f.policy.phoneNumberId+'/messages',method:'POST'}]);
 assert.equal(f.phone.code_verification_status,'EXPIRED');assert.deepEqual(f.connection,before);
});

for(const [name,mutate] of [
 ['pending registration',f=>{f.state.registered=false;}],
 ['non-Cloud platform',f=>{f.phone.platform_type='NOT_APPLICABLE';}],
 ['unknown platform',f=>{f.phone.platform_type='NEW_PLATFORM';}],
 ['missing platform',f=>{delete f.phone.platform_type;}],
 ['business app',f=>{f.phone.is_on_biz_app=true;}],
 ['ambiguous business-app mode',f=>{delete f.phone.is_on_biz_app;}],
 ['different phone ID',f=>{f.phone.id='990000001';}],
 ['different display',f=>{f.phone.display_phone_number='+5491100000001';}],
 ['revoked token',f=>{f.debug.is_valid=false;}],
 ['different system user',f=>{f.debug.user_id='990000001';}],
 ['changed token expiry',f=>{f.debug.expires_at+=3600;}],
 ['changed data access expiry',f=>{f.debug.data_access_expires_at=1;}],
 ['unexpected scope',f=>{f.debug.scopes.push('ads_read');}],
 ['contradictory granular targets',f=>{f.debug.granular_scopes[1].target_ids=['990000001'];}],
 ['unowned system user',f=>{f.state.missingEdge='system_users';}],
 ['unowned app',f=>{f.state.missingEdge='owned_apps';}],
 ['unowned WABA',f=>{f.state.missingEdge='owned_whatsapp_business_accounts';}],
 ['paged ownership',f=>{f.state.pagingEdge='owned_whatsapp_business_accounts';}],
 ['revoked subscription',f=>{f.state.subscribed=false;}],
 ['disabled canonical connection',f=>{f.canonical.connection.enabled=false;}],
 ['revoked canonical grant',f=>{f.canonical.connection.metadata.ownCompanyRuntime.state='REVOKED';}],
 ['changed canonical vault',f=>{f.canonical.connection.encryptedAccessToken+='x';}],
 ['inactive issuer',f=>{f.canonical.issuer=false;}],
 ['missing activation receipt',f=>{f.canonical.receipt=false;}],
 ['changed company phone declaration',f=>{f.declaration.revision+=1;}],
 ['expired credential grant',f=>{f.time=Date.parse(f.connection.metadata.ownCompanyRuntime.validUntil);}],
])test('expired OTP never bypasses '+name,async()=>{
 const f=await expiredTransportFixture();mutate(f);await assert.rejects(f.runtime());assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
});

for(const status of ['DISCONNECTED','UNKNOWN',undefined])test('expired OTP does not authorize raw phone status '+String(status),async()=>{
 const f=await expiredTransportFixture(),original=f.fetchImpl;
 f.fetchImpl=async(url,options)=>{const response=await original(url,options);if(new URL(url).pathname.endsWith('/phone_numbers')){const body=await response.json();if(status===undefined)delete body.data[0].status;else body.data[0].status=status;return Response.json(body);}return response;};
 await assert.rejects(f.runtime(),{code:'META_OWN_COMPANY_PHONE_REJECTED'});assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
});

for(const [step,path,occurrence] of [['initial token','debug_token',1],['system user','system_users',1],['owned app','owned_apps',1],['owned WABA','owned_whatsapp_business_accounts',1],['second token','debug_token',2],['exact phone','phone_numbers',1],['current subscription','subscribed_apps',1]])test('expired transport denies canonical revocation after '+step+' await',async()=>{
 for(const reason of ['connection','declaration','issuer','receipt','vault']){
  const f=await expiredTransportFixture(),issuedAt=f.time;let seen=0,revoked=false;
  f.state.afterRead=async observed=>{if((observed===path||observed.endsWith('/'+path))&&++seen===occurrence){revoked=true;if(reason==='connection')f.canonical.connection.enabled=false;if(reason==='declaration')f.declaration.revision+=1;if(reason==='issuer')f.canonical.issuer=false;if(reason==='receipt')f.canonical.receipt=false;if(reason==='vault')f.canonical.connection.encryptedAccessToken+='x';}};
  await assert.rejects(f.runtime(),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(revoked,true);assert.equal(f.time,issuedAt);assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
 }
});

test('expired transport purpose is consumed and cannot authorize a standalone inspection, a copied factory option or PRE_REGISTRATION',async()=>{
 const f=await expiredTransportFixture(),scoped=await f.runtime();f.calls.length=0;
 await assert.rejects(scoped.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId}),{code:'META_OWN_COMPANY_PHONE_REJECTED'});
 await assert.rejects(scoped.sendReply(reply(f)),{code:'META_OWN_COMPANY_OWNER_UNVERIFIED'});
 await assert.rejects(scoped.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId,inspectionPhase:'PRE_REGISTRATION'}),{code:'META_OWN_COMPANY_PHONE_REJECTED'});
 const capability=await f.capability();
 for(const purpose of [true,'TRANSPORT_OP',{purpose:'TRANSPORT_OP',active:true,claimed:false,capability}]){
  const forged=createMetaCustomerProvider({environment:f.environment,fetchImpl:f.fetchImpl,now:()=>f.time,ownCapability:capability,ownAudit:{},ownFence:f.fence,transportOperation:purpose,ownTransportOperation:purpose});
  await assert.rejects(forged.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId}));
 }
 assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
});

test('expired runtime transport neither enters template administration nor exposes setup or template mutations',async()=>{
 const f=await expiredTransportFixture(),scoped=await f.runtime();f.calls.length=0;
 await assert.rejects(f.base.forOwnTemplateAdministration({capability:await f.capability(),connection:f.connection,token:f.token,beforeExternal:f.fence,context:f.context,blueprintKey:'open_attendance_reminder'}),{code:'META_OWN_COMPANY_PHONE_REJECTED'});
 for(const execute of [()=>scoped.subscribe({token:f.token,wabaId:f.policy.wabaId}),()=>scoped.register({token:f.token,phoneNumberId:f.policy.phoneNumberId,pin:'123456'}),()=>scoped.templates({token:f.token,wabaId:f.policy.wabaId}),()=>scoped.createTemplate({token:f.token,wabaId:f.policy.wabaId,definition:{}}),()=>scoped.sendTemplate({...reply(f),message:{}})])await assert.rejects(execute,{code:'META_OWN_COMPANY_ADAPTER_UNAVAILABLE'});
 assert.ok(f.calls.every(call=>call.method==='GET'&&!call.path.endsWith('/message_templates')));
});

test('expired transport rechecks the final send boundary and never retries an uncertain POST or changes activation evidence',async()=>{
 const f=await expiredTransportFixture(),scoped=await f.runtime(),before=structuredClone(f.connection);f.calls.length=0;
 await assert.rejects(scoped.sendReply({...reply(f),beforeExternal:async()=>{f.canonical.connection.enabled=false;}}),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(f.calls.length,0);
 f.canonical.connection.enabled=true;f.state.failPost=f.policy.phoneNumberId+'/messages';
 await assert.rejects(scoped.sendReply(reply(f)),{code:'META_CUSTOMER_PROVIDER_UNCONFIRMED'});assert.equal(f.calls.filter(call=>call.method==='POST').length,1);assert.deepEqual(f.connection,before);
});
