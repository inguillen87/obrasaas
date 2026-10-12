import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {createDevelopmentPilotCapability} from '../src/lib/meta-development-pilot-policy.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {ownCompanyRuntimeFixture} from './fixtures/own-company-runtime.mjs';

const MiB=1024*1024,mediaId='270000001',phoneNumberId='270000002';
const documents=['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel.sheet.macroenabled.12'];
const images=['image/jpeg','image/png','image/webp'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const environment=()=>({NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-plan-source-app-secret-only',META_CONFIG_ID:'270000003',META_GRAPH_API_VERSION:'v25.0',META_CUSTOMER_VERIFY_TOKEN:'synthetic-plan-source-verifier-'.repeat(2),WHATSAPP_CREDENTIALS_ENCRYPTION_KEY:Buffer.alloc(32,23).toString('base64'),META_EMBEDDED_SIGNUP_VERSION:'4',OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1'});

// All Graph, attachment, vault and canonical authority responses are synthetic.
// Unknown requests fail rather than falling back to the network or process.env.
function fixture({mime='application/pdf',bytes=Buffer.from('synthetic plan source'),env=environment(),now=()=>Date.parse('2026-10-09T12:00:00.000Z'),fallback=null}={}){
 const f={bytes,mime,calls:[],chunks:null,afterGraph:null,afterAttachment:null,afterChunk:null,status:200,headers:{'content-type':mime,'content-length':String(bytes.length)}};
 f.item={id:mediaId,url:'https://lookaside.fbsbx.com/whatsapp_business/attachments/synthetic-plan?authorized=1',mime_type:mime,file_size:bytes.length,sha256:hash(bytes)};
 f.input={token:'synthetic-plan-source-token-only',phoneNumberId,mediaId};
 f.provider=createMetaCustomerProvider({environment:env,now,fetchImpl:async(url,options={})=>{
  const parsed=new URL(url);
  if(parsed.hostname==='graph.facebook.com'&&parsed.pathname==='/v25.0/'+mediaId){
   f.calls.push({kind:'graph',url:parsed,options});assert.equal(parsed.searchParams.get('phone_number_id'),f.input.phoneNumberId);assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
   await f.afterGraph?.();return Response.json(f.item);
  }
  if(parsed.hostname==='lookaside.fbsbx.com'){
   f.calls.push({kind:'attachment',url:parsed,options});assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.headers.Authorization,'Bearer '+f.input.token);
   await f.afterAttachment?.();const chunks=f.chunks||[f.bytes];let index=0;
   const stream=new ReadableStream({async pull(controller){if(index===chunks.length){controller.close();return;}controller.enqueue(chunks[index++]);await f.afterChunk?.();}});
   return new Response(stream,{status:f.status,headers:f.headers});
  }
  if(fallback)return fallback(url,options);
  assert.fail('Unexpected synthetic provider request');
 }});
 return f;
}

for(const mime of [...documents,...images])test('dedicated plan download accepts exactly scoped Graph bytes: '+mime,async()=>{
 const f=fixture({mime}),result=await f.provider.downloadPlanSource(f.input);
 assert.deepEqual(result,{bytes:f.bytes,contentType:mime,sha256:hash(f.bytes)});
 assert.deepEqual(f.calls.map(call=>call.kind),['graph','attachment']);assert.equal(f.calls[0].options.headers.Authorization,'Bearer '+f.input.token);
});

for(const mime of documents)test('legacy media still rejects plan document '+mime,async()=>{
 const f=fixture({mime});await assert.rejects(f.provider.downloadMedia({...f.input,purpose:'PLAN_IMPORT'}),{code:'META_CUSTOMER_MEDIA_REJECTED'});assert.deepEqual(f.calls.map(call=>call.kind),['graph']);
});
for(const mime of ['audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/webm','video/mp4','video/webm','application/octet-stream','text/html'])test('plan source never admits '+mime,async()=>{
 const f=fixture({mime});await assert.rejects(f.provider.downloadPlanSource(f.input),{code:'META_CUSTOMER_MEDIA_REJECTED'});assert.equal(f.calls.length,1);
});
test('legacy audio, video and its previous image limit remain available',async()=>{
 for(const mime of ['audio/ogg','video/mp4','image/png']){
  const f=fixture({mime,bytes:Buffer.alloc(2*MiB+1,7)});assert.deepEqual((await f.provider.downloadMedia(f.input)).bytes,f.bytes);
 }
});
test('plan documents permit 3 MiB and plan images permit 2 MiB inclusively',async()=>{
 for(const [mime,size] of [['application/pdf',3*MiB],['image/png',2*MiB]]){const f=fixture({mime,bytes:Buffer.alloc(size,7)});assert.equal((await f.provider.downloadPlanSource(f.input)).bytes.length,size);}
});
for(const [mime,size] of [['application/pdf',3*MiB+1],['image/png',2*MiB+1]])test('Graph size above dedicated plan limit prevents attachment GET: '+mime,async()=>{
 const f=fixture({mime});f.item.file_size=size;await assert.rejects(f.provider.downloadPlanSource(f.input),{code:'META_CUSTOMER_MEDIA_REJECTED'});assert.equal(f.calls.length,1);
});
test('an explicit lower byte limit cannot be widened by metadata or MIME',async()=>{
 const f=fixture();await assert.rejects(f.provider.downloadPlanSource({...f.input,limit:f.bytes.length-1}),{code:'META_CUSTOMER_MEDIA_REJECTED'});assert.equal(f.calls.length,1);
});
test('invalid IDs, limits and guard types reject before Graph',async()=>{
 for(const patch of [{mediaId:'../media'},{phoneNumberId:'invalid'},{limit:0},{limit:3*MiB+1},{limit:1.5},{limit:Infinity},{beforeExternal:true}]){const f=fixture();await assert.rejects(f.provider.downloadPlanSource({...f.input,...patch}),{code:'META_CUSTOMER_MEDIA_INVALID'});assert.equal(f.calls.length,0);}
});
test('Graph identity, empty size and malformed digest cannot initiate attachment GET',async()=>{
 for(const patch of [{id:'270000004'},{file_size:0},{file_size:1.5},{sha256:'invalid'}]){const f=fixture();Object.assign(f.item,patch);await assert.rejects(f.provider.downloadPlanSource(f.input));assert.equal(f.calls.length,1);}
});
for(const url of ['http://lookaside.fbsbx.com/whatsapp_business/attachments/file','https://evil.invalid/whatsapp_business/attachments/file','https://lookaside.fbsbx.com/wrong/file','https://user:password@lookaside.fbsbx.com/whatsapp_business/attachments/file','https://lookaside.fbsbx.com:444/whatsapp_business/attachments/file','https://lookaside.fbsbx.com/whatsapp_business/attachments/file#fragment'])test('rejects noncanonical attachment URL before GET: '+url,async()=>{
 const f=fixture();f.item.url=url;await assert.rejects(f.provider.downloadPlanSource(f.input),{code:'META_CUSTOMER_MEDIA_REJECTED'});assert.equal(f.calls.length,1);
});
test('attachment redirects and MIME disagreement are never returned as source bytes',async()=>{
 for(const kind of ['redirect','mime']){const f=fixture();if(kind==='redirect')f.status=302;else f.headers['content-type']='text/html';await assert.rejects(f.provider.downloadPlanSource(f.input),{code:'META_CUSTOMER_MEDIA_UNCONFIRMED'});assert.equal(f.calls.length,2);}
});
test('content length, truncated/oversized streams and wrong hashes reject unconfirmed bytes',async()=>{
 for(const kind of ['header','short','long','hash']){
  const f=fixture();if(kind==='header')f.headers['content-length']='1';if(kind==='short')f.chunks=[f.bytes.subarray(1)];if(kind==='long')f.chunks=[f.bytes,Buffer.from('x')];if(kind==='hash')f.item.sha256='f'.repeat(64);
  await assert.rejects(f.provider.downloadPlanSource(f.input),{code:'META_CUSTOMER_MEDIA_INTEGRITY'});assert.equal(f.calls.length,2);
 }
});
test('MIME parameters and Graph base64 SHA256 normalize without losing integrity',async()=>{
 const f=fixture({mime:'image/png'});f.item.mime_type='IMAGE/PNG; profile=synthetic';f.headers['content-type']='image/png; profile=synthetic';f.item.sha256=createHash('sha256').update(f.bytes).digest('base64');delete f.headers['content-length'];
 assert.deepEqual(await f.provider.downloadPlanSource(f.input),{bytes:f.bytes,contentType:'image/png',sha256:hash(f.bytes)});
});
for(const boundary of ['Graph','attachment'])test('canonical guard denial before '+boundary+' retains its error and prevents the external call',async()=>{
 const f=fixture(),denied=new WorkspaceError('COMPANY_CHANNEL_CONTEXT_CHANGED',409);let guards=0;
 await assert.rejects(f.provider.downloadPlanSource({...f.input,beforeExternal:async()=>{if(++guards===(boundary==='Graph'?1:2))throw denied;}}),error=>error===denied);
 assert.equal(f.calls.length,boundary==='Graph'?0:1);
});
test('Development Pilot cannot use the new method or legacy media even with a valid opaque capability',async()=>{
 const time=Date.parse('2026-10-09T12:00:00.000Z'),env=environment(),policy={version:1,organizationId:'tenant_Synthetic',actorId:'actor_Synthetic',clerkUserId:'user_Synthetic',clerkOrganizationId:'org_Synthetic',projectId:'project_Synthetic',appId:OBRASAAS_META_CHANNEL.appId,configId:env.META_CONFIG_ID,businessId:'270000004',expectedPhoneE164:'+5491198765432',allowArgentinaMobileAlias:true,issuedAt:new Date(time).toISOString(),expiresAt:new Date(time+3600000).toISOString()};
 env.OBRASAAS_META_DEVELOPMENT_PILOT_POLICY=JSON.stringify(policy);
 const context={member:{actorId:policy.actorId,organizationId:policy.organizationId,role:'ADMIN'},session:{userId:policy.clerkUserId,organizationId:policy.clerkOrganizationId,organizationRole:'org:admin'},project:{id:policy.projectId,organizationId:policy.organizationId}};
 const capability=createDevelopmentPilotCapability(context,env,time);assert.ok(capability);let calls=0;
 const provider=createMetaCustomerProvider({environment:env,pilotCapability:capability,now:()=>time,fetchImpl:()=>{calls++;assert.fail('Development media must stay closed');}});
 for(const method of ['downloadPlanSource','downloadMedia'])await assert.rejects(provider[method]({token:'synthetic-plan-source-token-only',phoneNumberId,mediaId}),{code:'META_DEVELOPMENT_PILOT_ADAPTER_UNAVAILABLE'});
 assert.equal(calls,0);
});

async function ownFixture(){
 const own=await ownCompanyRuntimeFixture(),f=fixture({env:own.environment,now:()=>own.time,fallback:own.fetchImpl});f.input={token:own.token,phoneNumberId:own.policy.phoneNumberId,mediaId};
 const scoped=await f.provider.forConnection({capability:await own.capability(),connection:own.connection,token:own.token,beforeExternal:()=>own.beforeExternal(own.connection)});
 own.calls.length=0;return {own,f,scoped};
}
test('OWN runtime plan download retains the original grant and exact operational connection',async()=>{
 const {own,f,scoped}=await ownFixture(),grant=structuredClone(own.runtimeGrant);assert.deepEqual((await scoped.downloadPlanSource(f.input)).bytes,f.bytes);assert.deepEqual(own.connection.metadata.ownCompanyRuntime,grant);
 assert.equal(own.calls.filter(call=>call.method==='POST').length,0);assert.deepEqual(f.calls.map(call=>call.kind),['graph','attachment']);
 await assert.rejects(scoped.downloadPlanSource({...f.input,phoneNumberId:'270000099'}),{code:'META_OWN_COMPANY_OWNER_UNVERIFIED'});assert.equal(f.calls.length,2);
});
test('OWN runtime plan download still rejects an unbound capability or missing external fence',async()=>{
 const {own,f}=await ownFixture();f.calls.length=0;own.calls.length=0;
 await assert.rejects(f.provider.forConnection({capability:{},connection:own.connection,token:own.token,beforeExternal:()=>own.beforeExternal(own.connection)}),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 await assert.rejects(f.provider.forConnection({capability:await own.capability(),connection:own.connection,token:own.token}),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 assert.equal(f.calls.length,0);assert.equal(own.calls.length,0);
});
for(const stage of ['Graph','attachment','stream'])test('OWN canonical revocation during '+stage+' prevents subsequent download or returning bytes',async()=>{
 const {own,f,scoped}=await ownFixture();own.controls.current=structuredClone(own.connection);
 const revoke=()=>{own.controls.current.enabled=false;};if(stage==='Graph')f.afterGraph=revoke;else if(stage==='attachment')f.afterAttachment=revoke;else f.afterChunk=revoke;
 await assert.rejects(scoped.downloadPlanSource(f.input),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(f.calls.length,stage==='Graph'?1:2);assert.equal(own.calls.filter(call=>call.method==='POST').length,0);
});
test('OWN canonical issuer revocation and expired runtime lease stop plan download before Graph',async()=>{
 for(const reason of ['issuer','lease']){const {own,f,scoped}=await ownFixture();if(reason==='issuer')own.controls.issuerActive=false;else own.time+=60001;await assert.rejects(scoped.downloadPlanSource(f.input),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(f.calls.length,0);}
});
