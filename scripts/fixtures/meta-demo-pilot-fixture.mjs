import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {lifecycleEnvironment,lifecycleSchema,lifecyclePng,createControlledLifecycleBlob} from './meta-signup-field-lifecycle-fixture.mjs';
import {OBRASAAS_META_CHANNEL} from '../../src/lib/meta-channel-binding.mjs';

// Synthetic identity, credential and recipient. No request can reach a network.
export const demoSender='5491100001111';
export const demoToken='synthetic-demo-pilot-token-no-provider-access';
export const demoEnvironment={...lifecycleEnvironment,META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_PHONE_NUMBER_ID:OBRASAAS_META_CHANNEL.phoneNumberId,META_WABA_ID:OBRASAAS_META_CHANNEL.wabaId,META_WHATSAPP_ACCESS_TOKEN:demoToken,META_CHANNEL_MODE:'test',META_TEST_ALLOWED_RECIPIENTS:demoSender,META_VERIFY_TOKEN:'synthetic-demo-pilot-verify-token-no-provider-access'};
export const demoSchema=lifecycleSchema+`CREATE TABLE "PurchaseOrder"(id text PRIMARY KEY,"projectId" text REFERENCES "Project");CREATE TABLE "SitePhoto"(id text PRIMARY KEY,"projectId" text REFERENCES "Project");`;
export const demoSession={authenticated:true,verification:'clerk-production-jwt',userId:'user_DemoOwner',organizationId:'org_Demo',organizationRole:'org:admin'};
export const demoParticipant={version:1,status:'ACTIVE',clerkUserId:demoSession.userId,permissions:{attendance:true,report:true},kyc:{version:1,status:'APPROVED',submissionId:'synthetic-kyc',contentHash:'synthetic-image-pair-hash',images:[{id:'document-front'},{id:'selfie'}],review:{decision:'APPROVED',actorId:'demo-reviewer',recordedAt:'2026-10-02T01:00:00Z'}}};
export async function seedDemoPilot(pool){
 await pool.query(`INSERT INTO "Organization" VALUES('demo-org','Synthetic DEMO organization','org_Demo','{}'),('foreign-org','Other synthetic organization','org_Foreign','{}');
 INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('demo-owner','user_DemoOwner','owner@example.invalid'),('demo-reviewer','user_DemoReviewer','reviewer@example.invalid');
 INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES('demo-member','demo-owner','demo-org','ADMIN','org:admin','ACTIVE'),('demo-reviewer-member','demo-reviewer','demo-org','DIRECTOR','org:member','ACTIVE');
 INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES('demo-project','demo-org','Obra sintética de QA','ACTIVE','{}'),('foreign-project','foreign-org','Foreign synthetic worksite','ACTIVE','{}');
 INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES('demo-assignment','demo-project','demo-member','ACTIVE');`);
 await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,metadata) VALUES('demo-worker','demo-project','Synthetic DEMO holder',$1,$2::jsonb)`,['+'+demoSender,JSON.stringify({participant:demoParticipant})]);
 await pool.query(`INSERT INTO "AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES('synthetic-submission','demo-org','demo-owner','participant.operation.recorded','Worker','demo-worker',$1::jsonb),('synthetic-review','demo-org','demo-reviewer','participant.operation.recorded','Worker','demo-worker',$2::jsonb)`,[JSON.stringify({projectId:'demo-project',kind:'KYC_SUBMITTED',submissionId:'synthetic-kyc',contentHash:demoParticipant.kyc.contentHash}),JSON.stringify({projectId:'demo-project',kind:'REVIEW_KYC',submissionId:'synthetic-kyc',decision:'APPROVED'})]);
}
export function demoEnvelope(body,{sender=demoSender,id='wamid.SyntheticDemoInbound_0001',type='text'}={}){return {object:'whatsapp_business_account',entry:[{id:OBRASAAS_META_CHANNEL.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:OBRASAAS_META_CHANNEL.phoneNumberId},messages:[{id,from:sender,timestamp:String(Math.floor(Date.now()/1000)),type,...(type==='text'?{text:{body}}:{[type]:body})}]}}]}]};}
export function signedDemoRequest(payload,environment=demoEnvironment){const body=JSON.stringify(payload);return new Request('https://obrasaas.com/api/webhooks/whatsapp',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+createHmac('sha256',environment.META_APP_SECRET).update(body).digest('hex')},body});}
export function createControlledDemoGraph(){
 const calls=[],messages=new Map(),blob=createControlledLifecycleBlob();let loseSend=false,beforeGet=async()=>{};
 async function fetchImpl(input,options={}){
  const u=new URL(input),method=options.method||'GET',endpoint=u.pathname.slice('/v25.0/'.length);assert.equal(u.protocol,'https:');assert.equal(options.redirect,'error');
  if(u.hostname==='lookaside.fbsbx.com'){assert.equal(u.pathname,'/whatsapp_business/attachments/synthetic-demo.png');assert.equal(method,'GET');assert.equal(options.headers.Authorization,'Bearer '+demoToken);calls.push({method,endpoint:'controlled-private-media'});return new Response(lifecyclePng,{headers:{'Content-Type':'image/png','Content-Length':String(lifecyclePng.length)}});}
  assert.equal(u.hostname,'graph.facebook.com');assert.ok(u.pathname.startsWith('/v25.0/'));calls.push({method,endpoint});
  if(endpoint==='debug_token'){assert.equal(method,'GET');assert.equal(u.searchParams.get('input_token'),demoToken);await beforeGet(endpoint);return Response.json({data:{is_valid:true,app_id:OBRASAAS_META_CHANNEL.appId,expires_at:0,scopes:['whatsapp_business_management','whatsapp_business_messaging'],granular_scopes:[{scope:'whatsapp_business_management',target_ids:[OBRASAAS_META_CHANNEL.wabaId]}]}});}
  assert.equal(options.headers.Authorization,'Bearer '+demoToken);assert.equal(u.searchParams.get('appsecret_proof'),createHmac('sha256',demoEnvironment.META_APP_SECRET).update(demoToken).digest('hex'));
  if(method==='GET')await beforeGet(endpoint);
  if(endpoint===OBRASAAS_META_CHANNEL.wabaId+'/phone_numbers')return Response.json({data:[{id:OBRASAAS_META_CHANNEL.phoneNumberId,status:'CONNECTED',verified_name:'Synthetic Meta TestNumber',display_phone_number:'+15550000000'}]});
  if(endpoint===OBRASAAS_META_CHANNEL.wabaId+'/subscribed_apps'){assert.equal(method,'GET');return Response.json({data:[{whatsapp_business_api_data:{id:OBRASAAS_META_CHANNEL.appId}}]});}
  if(endpoint==='150000099'&&method==='GET'){assert.equal(u.searchParams.get('phone_number_id'),OBRASAAS_META_CHANNEL.phoneNumberId);return Response.json({id:endpoint,url:'https://lookaside.fbsbx.com/whatsapp_business/attachments/synthetic-demo.png',mime_type:'image/png',file_size:lifecyclePng.length,sha256:createHash('sha256').update(lifecyclePng).digest('hex')});}
  assert.equal(endpoint,OBRASAAS_META_CHANNEL.phoneNumberId+'/messages');assert.equal(method,'POST');const body=JSON.parse(options.body);assert.equal(body.to,demoSender);assert.match(body.context.message_id,/^wamid\./);assert.match(body.biz_opaque_callback_data,/^customer_outbound_[a-f0-9]{64}$/);assert.notEqual(body.type,'template');
  const id='wamid.SyntheticDemoReply_'+messages.size;messages.set(body.biz_opaque_callback_data,{id,body});if(loseSend){loseSend=false;throw Error('SYNTHETIC_DEMO_SEND_RESPONSE_LOST');}return Response.json({messages:[{id}]});
 }
 return {fetchImpl,calls,messages,blob,loseNextSend:()=>{loseSend=true;},setBeforeGet:fn=>{beforeGet=fn;},posts:()=>calls.filter(c=>c.method==='POST').length};
}
