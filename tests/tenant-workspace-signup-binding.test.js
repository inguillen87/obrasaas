import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { TenantWorkspaceError, tenantWorkspaceErrorResponse } from '../src/lib/whatsapp/tenant-workspace-policy.js';
const source=fs.readFileSync(new URL('../src/app/api/integrations/whatsapp/embedded-signup/route.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/^export /gm,'');
class AccessError extends Error {} class RequestBodyError extends Error {} class MetaIntegrationError extends Error {} class WhatsAppFlowProvisioningLeaseError extends Error {}
function fixture({prepared=true,changeDuringMeta=false,existing=false}={}){
  const state={revision:1,sequence:[],connection:null,audits:0,released:0};
  const tx={whatsAppConnection:{create:async({data})=>{state.connection={id:'connection-a',...data};return state.connection;}},auditLog:{create:async()=>{state.audits++;return{};}}};
  async function transaction(fn){const snapshot={connection:state.connection,audits:state.audits};try{return await fn(tx);}catch(error){Object.assign(state,snapshot);throw error;}}
  const prisma={whatsAppConnection:{findUnique:async()=>existing?{id:'connection-a',updatedAt:new Date()}:null},$transaction:transaction};
  const dependencies={AccessError,RequestBodyError,MetaIntegrationError,WhatsAppFlowProvisioningLeaseError,tenantWorkspaceErrorResponse,
    assertSignupScreenContext:()=>{},signupScreenContextResponse:()=>null,evidenceContextErrorResponse:()=>null,
    getPlatformAccess:async()=>({organization:{id:'company-a'},project:{id:'project-a'},databaseUserId:'admin-a'}),requireTenantPermission:()=>{},
    accessErrorResponse:()=>Response.json({},{status:403}),requestBodyErrorResponse:()=>Response.json({},{status:400}),readJsonRequest:r=>r.json(),getPrisma:()=>prisma,
    assertTenantWorkspaceAuthorization:async(db,{scope,preparedRevision,lock=false})=>{state.sequence.push(lock?'commit-check':'initial-check');assert.deepEqual(scope,{organizationId:'company-a',projectId:'project-a'});if(!prepared)throw new TenantWorkspaceError('Prepare first','WORKSPACE_REQUIRED',409);if(state.revision!==preparedRevision)throw new TenantWorkspaceError('Changed','WORKSPACE_REVISION_CHANGED',409);},
    completeEmbeddedSignup:async()=>{state.sequence.push('provider');if(changeDuringMeta)state.revision++;return{accessToken:'fixture-opaque',tokenType:'fixture',displayPhoneNumber:'fixture-number',verifiedBusinessName:'Fixture'};},
    encryptCredential:()=> 'fixture-encrypted',credentialLastFour:()=> '0000',buildWhatsAppChannelHealthMetadata:()=>({}),mergeWhatsAppConnectionMetadata:()=>({}),whatsAppConnectionIdentityChanged:()=>false,buildDisabledWhatsAppConnectionData:()=>({}),publicMetaIntegrationFailure:()=>({message:'Provider not confirmed',code:'META_FAILURE',status:503}),
    acquireWhatsAppConnectionLease:async()=>({lease:{id:'lease-a'}}),releaseWhatsAppConnectionLease:async()=>{state.released++;},
    commitWhatsAppConnectionLease:async(db,options)=>transaction(async t=>{const data=options.buildConnectionData({phoneNumberId:'111111',whatsappBusinessId:'222222',metadata:{}});state.connection={id:'connection-a',...data};await options.createAuditLog(t);return{data};}),
  };
  return{state,post:new Function(...Object.keys(dependencies),source+'\nreturn POST;')(...Object.values(dependencies))};
}
const request=(preparedRevision=1)=>new Request('https://obra.test/api/integrations/whatsapp/embedded-signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'fixture-code',whatsappBusinessId:'222222',phoneNumberId:'111111',registrationPin:'123456',preparedRevision})});
test('a direct POST without a prepared company never calls the provider',async()=>{
  const f=fixture({prepared:false});const response=await f.post(request());assert.equal(response.status,409);assert.deepEqual(f.state.sequence,['initial-check']);assert.equal(f.state.connection,null);
});
test('obsolete client revision is denied before exchange',async()=>{
  const f=fixture();const response=await f.post(request(0));assert.equal(response.status,409);assert.deepEqual(f.state.sequence,['initial-check']);
});
for(const existing of [false,true])test('same preparation is checked before provider and inside final transaction: '+existing,async()=>{
  const f=fixture({existing});const response=await f.post(request());assert.equal(response.status,200);assert.deepEqual(f.state.sequence,['initial-check','provider','commit-check']);assert.equal(f.state.audits,1);assert.ok(f.state.connection);
});
for(const existing of [false,true])test('changed preparation after provider return rolls back local connection: '+existing,async()=>{
  const f=fixture({existing,changeDuringMeta:true});const response=await f.post(request());assert.equal(response.status,409);assert.equal(f.state.connection,null);assert.equal(f.state.audits,0);assert.equal(f.state.released,existing?1:0);
  assert.equal((await response.json()).code,'WORKSPACE_REVISION_CHANGED');
});
