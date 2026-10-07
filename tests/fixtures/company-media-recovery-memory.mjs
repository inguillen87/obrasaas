import assert from 'node:assert/strict';
import {digest} from '../../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret} from '../../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../../src/lib/meta-customer-callback.mjs';
import {OBRASAAS_META_CHANNEL} from '../../src/lib/meta-channel-binding.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../../src/lib/company-channel-schema.mjs';
import {customerOutboundId} from '../../src/lib/meta-customer-outbound.mjs';
import {fieldMediaAnalysisConsent} from '../../src/lib/field-media-privacy.mjs';
import {planMetaFieldConversation} from '../../src/lib/meta-field-conversation.mjs';

// Strict SQL fixture for the real processor and reservation validator. It uses
// the real planner, signed semantic digests and tenant/project AES-GCM AAD.
export function companyMediaRecoveryMemory(){
 const time=Date.parse('2026-10-06T12:00:00Z'),environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,17).toString('base64')};
 const connection={id:'channel-a',projectId:'project-a',organizationId:'org-a',whatsappBusinessId:'130000001',phoneNumberId:'120000001',enabled:true,connectionStatus:'CONNECTED',metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:'org-a',customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE',actorId:'admin-a'},customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null}}};
 connection.encryptedAccessToken=encryptCustomerSecret('synthetic-token-only',{organizationId:'org-a',projectId:'project-a',purpose:'credential',resourceId:connection.phoneNumberId},environment);
 const routing={mode:'COMPANY',revision:4,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT};
 const value=(key,extra)=>({id:'wamid.SyntheticRecovery'+key,from:'5491100001111',timestamp:String(time/1000),...extra});
 const sign=(key,extra)=>{
  const payload={wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,field:'messages',type:'message',value:value(key,extra)},payloadDigest=metaCustomerContentDigest(payload),externalId=digest([payload.wabaId,payload.phoneNumberId,'message',payload.value.id]),id='customer_webhook_'+externalId;
  const aad={organizationId:connection.organizationId,projectId:connection.projectId,resourceId:id};
  return {id,externalId,provider:'meta-customer-v1',eventType:'message',projectId:connection.projectId,status:'PENDING',leaseToken:null,leaseExpiresAt:null,attempts:0,lastError:null,createdAt:new Date(time),payload:{version:1,signatureVerified:true,signatureScheme:'meta-hmac-sha256-v1',organizationId:connection.organizationId,channelId:connection.id,payloadDigest,companyRouting:routing,encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',appId:OBRASAAS_META_CHANNEL.appId,organizationId:connection.organizationId,channelId:connection.id,payloadDigest,companyRouting:routing}),{...aad,purpose:'webhook-proof'},environment)}};
 };
 const promptEvent=sign('Prompt',{type:'text',text:{body:'Synthetic consent choice'}}),bindingEvent=sign('Binding',{type:'text',text:{body:'Synthetic binding code'}}),image={type:'image',context:{id:'wamid.SyntheticConfirmedPrompt'},image:{id:'123456789',mime_type:'image/png',caption:'Synthetic controlled evidence'}};
 const event=sign('Media',image),events=new Map([[event.id,event],[promptEvent.id,promptEvent],[bindingEvent.id,bindingEvent]]);
 const binding={version:1,id:'binding-b',status:'VERIFIED',workerId:'worker-b',projectId:'project-b',organizationId:'org-a',actorId:'person-a',membershipId:'member-a',clerkUserId:'user_SyntheticPerson',senderE164:'+5491100001111',connectionId:connection.id,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,kycSubmissionId:'kyc-b',kycReviewedAt:new Date(time-10000).toISOString(),proofEventId:bindingEvent.id,proofExternalId:bindingEvent.externalId,proofPayloadDigest:bindingEvent.payload.payloadDigest};
 const worker={id:'worker-b',projectId:'project-b',organizationId:'org-a',actorId:'person-a',membershipId:'member-a',clerkUserId:binding.clerkUserId,phone:binding.senderE164,active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:binding.clerkUserId,permissions:{report:true},kyc:{version:1,status:'APPROVED',submissionId:binding.kycSubmissionId,contentHash:'a'.repeat(64),images:[{},{}],review:{decision:'APPROVED',actorId:'independent-reviewer',recordedAt:binding.kycReviewedAt}},channelIdentity:{binding}}}};
 const projectionFor=e=>({sourceEventId:e.id,payloadDigest:e.payload.payloadDigest,organizationId:'org-a',connectionId:'channel-a',kind:'FIELD',routeId:'company_route_synthetic',routeEpoch:3,actorId:'person-a',membershipId:'member-a',projectId:'project-b',workerId:'worker-b',assignmentRevision:2,bindingId:binding.id});
 const projection=projectionFor(event),promptProjection=projectionFor(promptEvent);
 const state={version:1,purpose:'MEDIA',step:'MEDIA',taskId:'task-b',sectorId:'sector-b',bindingId:binding.id,lastEventId:promptEvent.id,expiresAt:new Date(time+900000).toISOString(),analysisConsent:fieldMediaAnalysisConsent(false),analysisConsentEventId:promptEvent.id};
 const planned=planMetaFieldConversation({message:{...value('Media',image)},state,eventId:event.id,facts:{permissions:{report:true}},now:new Date(time)});
 assert.ok(planned.media);
 const key='meta_field_media_'+digest(event.id),prepared={version:1,projectId:'project-b',eventId:event.id,payloadDigest:event.payload.payloadDigest,channelBindingId:binding.id};
 const sealPrepared=input=>{prepared.encryptedInput=encryptCustomerSecret(JSON.stringify(input),{organizationId:'org-a',projectId:'project-b',purpose:'field-media-prepared',resourceId:key},environment);};sealPrepared({media:planned.media,state:planned.state});
 const request={version:1,eventId:promptEvent.id,payloadDigest:promptEvent.payload.payloadDigest,channelId:connection.id,organizationId:'org-a',to:'5491100001111',replyTo:'wamid.SyntheticRecoveryPrompt',message:{type:'text',body:'Synthetic prompt'},targetProjectId:'project-b',sourceRouteId:promptEvent.id},outboundId=customerOutboundId(promptEvent.id);
 const outbound={id:outboundId,payload:{requestDigest:digest(request),encryptedPayload:encryptCustomerSecret(JSON.stringify(request),{organizationId:'org-a',projectId:'project-a',purpose:'outbound',resourceId:outboundId},environment)},outcome:{state:'SENT',messageId:image.context.id}};
 let open=0,clock=time,snapshot=null;const trace=[];
 const rows=values=>({rows:structuredClone(values),rowCount:values.length});
 const fixture={environment,time,event,events,connection,worker,binding,projection,promptProjection,prepared,outbound,request,planned,sealPrepared,trace,owner:{connectionId:'channel-a',anchorProjectId:'project-a',mode:'COMPANY',revision:4,assignmentRevision:2},schemaReady:true,membershipPresent:true,assignmentPresent:true,projectMembershipActive:true,tenantActive:true,projectActive:true,afterQuery:async()=>{},get open(){return open;},set clock(value){clock=value;},get clock(){return clock;}};
 const query=async(sql,args=[])=>{
  trace.push(sql);let result;
  if(sql==='BEGIN'){assert.equal(open,0);snapshot=structuredClone(event);open++;result=rows([]);}
  else if(sql==='COMMIT'){assert.equal(open,1);open--;result=rows([]);}
  else if(sql==='ROLLBACK'){Object.assign(event,snapshot);open=0;result=rows([]);}
  else if(sql.startsWith('SET LOCAL'))result=rows([]);
  else if(sql==='SELECT clock_timestamp() AS now')result=rows([{now:new Date(clock)}]);
  else if(sql.startsWith('SELECT to_regclass'))result=rows([{present:fixture.schemaReady}]);
  else if(sql.includes('FROM information_schema.columns'))result=rows(sql.includes("column_name='catalogFingerprint'")?[{count:1}]:[]);
  else if(sql.includes('FROM public."WhatsAppCompanySchema"'))result=rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]})}]);
  else if(sql.includes('FROM pg_constraint')&&sql.includes('conname=ANY'))result=rows(args[0].map(conname=>({conname,convalidated:true})));
  else if(sql.includes('FROM pg_index')&&sql.includes('c.relname=ANY'))result=rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));
  else if(sql.includes('FROM pg_trigger')&&sql.includes('tgname=ANY'))result=rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));
  else if(sql.includes('FROM pg_attribute')||sql.includes('FROM pg_constraint')||sql.includes('FROM pg_index')||sql.includes('FROM pg_trigger'))result=rows([]);
  else if(sql.includes('FROM public."WhatsAppCompanyChannel"')&&sql.includes('JOIN public."WhatsAppChannelProjectAssignment"'))result=rows(fixture.assignmentPresent&&args[0]===connection.organizationId&&args[1]==='project-b'?[fixture.owner]:[]);
  else if(sql.includes('FROM public."WhatsAppCompanyChannel"'))result=rows(args[0]===connection.id&&args[1]===connection.organizationId?[fixture.owner]:[]);
  else if(sql.includes('FROM public."WhatsAppCompanyEventRoute"'))result=rows(args[0]===event.id&&(!args[1]||args[1]===projection.organizationId&&args[2]===projection.connectionId&&(!args[3]||args[3]===projection.projectId))?[projection]:args[0]===promptEvent.id?[promptProjection]:[]);
  else if(sql.includes('FROM public."Worker" w JOIN'))result=rows(fixture.membershipPresent&&fixture.assignmentPresent&&args.join('|')===['worker-b','project-b','member-a','person-a','channel-a','org-a'].join('|')?[worker]:[]);
  else if(sql.includes('FROM public."Worker" WHERE'))result=rows(args[0]===worker.id&&args[1]===worker.projectId?[worker]:[]);
  else if(sql.includes('FROM public."PlatformUser"'))result=rows(args[0]==='person-a'&&args[1]===worker.clerkUserId?[{id:'person-a',clerkUserId:worker.clerkUserId}]:[]);
  else if(sql.includes('FROM public."TenantMembership" tm JOIN'))result=rows(fixture.tenantActive&&args.join('|')===['member-a','person-a','org-a'].join('|')?[{membershipId:'member-a',actorId:'person-a',organizationId:'org-a',role:'AUDITOR',organizationMetadata:{}}]:[]);
  else if(sql.includes('FROM public."ProjectMembership"'))result=rows(fixture.projectMembershipActive&&args[0]===worker.projectId&&args[1]==='member-a'?[{id:'pm-b'}]:[]);
  else if(sql.includes('FROM public."Project" WHERE'))result=rows(fixture.projectActive&&args[0]===worker.projectId&&args[1]==='org-a'?[{id:worker.projectId}]:[]);
  else if(sql.includes('FROM public."AuditLog"')&&sql.includes("metadata->>'kind'='REVIEW_KYC'"))result=rows([{id:'review-b',metadata:{}}]);
  else if(sql.includes('FROM public."AuditLog"')&&sql.includes("metadata->>'kind'='KYC_SUBMITTED'"))result=rows([{id:'submission-b',metadata:{contentHash:'a'.repeat(64)}}]);
  else if(sql.includes('FROM public."AuditLog"')&&sql.includes("action='worker.channel.identity.recorded'"))result=rows(args.join('|')===['worker_channel_event_'+digest([bindingEvent.id,worker.id]),'org-a','person-a','worker-b'].join('|')?[{metadata:{projectId:'project-b',bindingId:binding.id,proofPayloadDigest:bindingEvent.payload.payloadDigest}}]:[]);
  else if(sql.includes('FROM public."AuditLog"')&&sql.includes("action='meta.field.media.prepared'"))result=rows(args.join('|')===[key,'org-a','person-a','worker-b'].join('|')?[{metadata:fixture.prepared}]:[]);
  else if(sql.includes('FROM public."WhatsAppConnection"'))result=rows(args[0]===connection.id&&args[1]===connection.projectId&&(!args[2]||args[2]===connection.organizationId)?[connection]:[]);
  else if(sql.includes('FROM public."WebhookEvent"')&&sql.includes("provider='meta-customer-outbound-v1'"))result=rows(args[0]===outbound.id&&args[1]===connection.projectId?[outbound]:fixture.currentOutbound&&args[0]===fixture.currentOutbound.id&&args[1]===connection.projectId?[fixture.currentOutbound]:[]);
  else if(sql.includes('FROM public."WebhookEvent" e JOIN public."WhatsAppCompanyEventRoute"'))result=rows(args[0]===event.id&&args[1]===event.projectId&&args[2]===connection.id&&args[3]===projection.organizationId&&args[4]===projection.projectId?[event]:[]);
  else if(sql.startsWith('SELECT id FROM public."WebhookEvent"')){assert.ok(args[2].includes('META_CUSTOMER_PREPARED_MEDIA_AUTHORIZATION_REQUIRED'));result=rows(event.status==='PENDING'&&!args[2].includes(event.lastError)?[{id:event.id}]:[]);}
  else if(sql.includes('FROM public."WebhookEvent"')){const e=events.get(args[0]);result=rows(e&&(!args[1]||args[1]===e.projectId||args[1]===e.provider)&&(!args[2]||args[2]===e.provider)?[e]:[]);}
  else if(sql.startsWith('UPDATE public."WebhookEvent" SET "leaseToken"')){assert.equal(args[0],event.id);event.leaseToken=args[1];event.leaseExpiresAt=args[2];event.attempts++;result=rows([{}]);}
  else if(sql.startsWith('UPDATE public."WebhookEvent" SET outcome=')){
   const matches=args[0]===event.id&&args[1]===event.projectId&&args[2]===event.leaseToken&&args[5]===event.provider&&args[6]===event.payload.channelId&&args[7]===event.payload.payloadDigest&&event.status==='PENDING'&&Date.parse(event.leaseExpiresAt)>clock;
   if(matches){event.outcome=JSON.parse(args[3]);event.lastError=args[4];event.leaseToken=null;event.leaseExpiresAt=null;}result=rows(matches?[{}]:[]);
  }else if(sql.startsWith('UPDATE public."WebhookEvent" SET status=')){
   const matches=args[0]===event.id&&args[1]===event.projectId&&args[2]===event.leaseToken&&event.status==='PENDING'&&Date.parse(event.leaseExpiresAt)>args[5].getTime();
   if(matches){event.status='PROCESSED';event.outcome=JSON.parse(args[3]);event.leaseToken=null;event.leaseExpiresAt=null;event.lastError=null;}result=rows(matches?[{}]:[]);
  }else if(sql.startsWith('UPDATE public."WebhookEvent" SET "lastError"')){
   if(args[0]===event.id&&args[1]===event.leaseToken&&event.status==='PENDING'){event.lastError=args[2];event.leaseToken=null;event.leaseExpiresAt=null;}result=rows([{}]);
  }else throw new Error('Unimplemented recovery fixture SQL: '+sql);
  await fixture.afterQuery(sql,args,result);return result;
 };
 fixture.client={query,release(){assert.equal(open,0);}};fixture.connect=async()=>fixture.client;
 fixture.context=()=>({eventId:event.id,projectId:event.projectId,channelId:connection.id,payloadDigest:event.payload.payloadDigest,leaseToken:event.leaseToken});
 fixture.claim=()=>{event.leaseToken='synthetic-lease';event.leaseExpiresAt=new Date(clock+60000);return fixture.context();};
 return fixture;
}
