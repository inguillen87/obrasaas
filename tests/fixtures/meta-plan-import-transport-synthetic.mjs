import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMetaPlanImportTransport} from '../../src/lib/meta-plan-import-transport.mjs';
import {metaPlanImportContextDigest} from '../../src/lib/meta-plan-import-origin.mjs';
import {startMetaPlanImportConversation,continueMetaPlanImportConversation} from '../../src/lib/meta-plan-import-conversation.mjs';
import {createMetaCustomerProvider} from '../../src/lib/meta-customer-provider.mjs';
import {META_CUSTOMER_PROTOCOL} from '../../src/lib/meta-cloud-protocol.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../../src/lib/company-channel-schema.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../../src/lib/meta-customer-credentials.mjs';
import {decodeWorkerChannelProof} from '../../src/lib/worker-channel-identity.mjs';
import {metaCustomerContentDigest} from '../../src/lib/meta-customer-callback.mjs';
import {customerOutboundId} from '../../src/lib/meta-customer-outbound.mjs';
import {metaFieldOperationId} from '../../src/lib/meta-field-bridge.mjs';
import {OBRASAAS_META_CHANNEL} from '../../src/lib/meta-channel-binding.mjs';
import {digest,WorkspaceError} from '../../src/lib/workspace-policy.mjs';

const clone=value=>structuredClone(value),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Real origin/transport/planner/store/provider functions; exclusively in-memory
// canonical SQL, signed synthetic payloads, private Blob and extraction results.
export function metaPlanImportTransportFixture({role='ADMIN',corporate=false,ownAuthority=null,ownCapability=null,usage=null,planAnalyzer=null}={}){
 const environment={...(ownAuthority?.environment||{NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-plan-transport-secret-only',META_CONFIG_ID:'280000003',META_GRAPH_API_VERSION:'v25.0',META_CUSTOMER_VERIFY_TOKEN:'synthetic-plan-transport-verifier-'.repeat(2),META_EMBEDDED_SIGNUP_VERSION:'4',OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1',WHATSAPP_CREDENTIALS_ENCRYPTION_KEY:Buffer.alloc(32,23).toString('base64')}),BLOB_READ_WRITE_TOKEN:'vercel_blob_rw_synthetic',PRIVATE_MEDIA_PROVIDER:'vercel-blob'};
 const member={...(ownAuthority?{...ownAuthority.context.member,clerkUserId:ownAuthority.policy.clerkUserId}:{organizationId:'org-plan-synthetic',actorId:'actor-plan-synthetic',clerkUserId:'user_PlanSynthetic'}),membershipId:'membership-plan-synthetic',role};
 const project={id:ownAuthority?.connection.projectId||'project-plan-synthetic',name:'Obra sintética'},worker={id:'worker-plan-synthetic',phone:'+5491100001111'},channelBinding={id:'binding-plan-synthetic'};
 const token=ownAuthority?.token||'synthetic-plan-transport-token-only',connection=ownAuthority?clone(ownAuthority.connection):{id:'channel-plan-synthetic',organizationId:member.organizationId,projectId:corporate?'anchor-plan-synthetic':project.id,phoneNumberId:'280000001',whatsappBusinessId:'280000002',metadata:{}};
 if(!ownAuthority)connection.encryptedAccessToken=encryptCustomerSecret(token,{organizationId:member.organizationId,projectId:connection.projectId,purpose:META_CUSTOMER_PROTOCOL.credentialPurpose,resourceId:connection.phoneNumberId},environment);
 const projection=corporate?{kind:'FIELD',organizationId:member.organizationId,connectionId:connection.id,projectId:project.id,workerId:worker.id,actorId:member.actorId,membershipId:member.membershipId,assignmentRevision:2,bindingId:channelBinding.id,routeId:'route-plan-synthetic',routeEpoch:3}:null;
 const events=new Map(),routes=new Map(),blobs=new Map(),savedResults=new Map();let audits=new Map();
 const calls={graph:0,attachment:0,get:0,put:0,analyze:0,records:0,pending:0,taskWrites:0,resolves:0,fences:0,sql:[]};
 const controls={assignment:true,restricted:false,failRecordOnce:false,clockOffset:0,hooks:{},graphPatch:{},attachmentBytes:null,providerOverride:null};
 const clock=()=>Date.now()+controls.clockOffset;
 const bytes=Buffer.from('%PDF-1.7\nSynthetic plan source only\n%%EOF'),sha256=hash(bytes),mediaId='280000004';
 const r={member,project,worker,connection,channelBinding,scope:'a'.repeat(64),sourceProjectId:connection.projectId,companyProjection:projection,now:new Date(),ownCompanyCapability:ownCapability};
 function event(label,value){
  const id=META_CUSTOMER_PROTOCOL.eventPrefix+digest(label),payload={wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,field:'messages',type:'message',value:{id:'wamid.SyntheticPlan'+label,from:worker.phone.slice(1),timestamp:String(Math.floor(Date.now()/1000)),...value}},payloadDigest=metaCustomerContentDigest(payload);
  const companyRouting=corporate?{mode:'COMPANY',revision:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT}:undefined;
  const context={organizationId:member.organizationId,projectId:connection.projectId,resourceId:id};
  const row={id,createdAt:new Date(),projectId:connection.projectId,provider:META_CUSTOMER_PROTOCOL.provider,eventType:'message',externalId:digest([payload.wabaId,payload.phoneNumberId,'message',payload.value.id]),status:'PENDING',leaseToken:'lease-plan-synthetic',leaseExpiresAt:new Date(clock()+60000).toISOString(),payload:{version:1,organizationId:member.organizationId,channelId:connection.id,payloadDigest,channelPurpose:META_CUSTOMER_PROTOCOL.purpose,...(companyRouting?{companyRouting}:{}),encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...context,purpose:META_CUSTOMER_PROTOCOL.payloadPurpose},environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:META_CUSTOMER_PROTOCOL.scheme,purpose:META_CUSTOMER_PROTOCOL.purpose,appId:OBRASAAS_META_CHANNEL.appId,organizationId:member.organizationId,channelId:connection.id,payloadDigest,...(companyRouting?{companyRouting}:{})}),{...context,purpose:META_CUSTOMER_PROTOCOL.proofPurpose},environment)}};
  events.set(id,row);if(corporate)routes.set(id,{...clone(projection),sourceEventId:id,payloadDigest});return row;
 }
 const facts=row=>({planImportRole:member.role,planImportReferenceContext:{eventId:row.id,payloadDigest:row.payload.payloadDigest,contextDigest:metaPlanImportContextDigest({...r,event:row}),sourceProjectId:connection.projectId}});
 const started=event('Start',{type:'text',text:{body:'CRONOGRAMA'}}),format=startMetaPlanImportConversation({eventId:started.id,facts:facts(started),now:r.now});
 const selected=event('Format',{type:'interactive',interactive:{type:'list_reply',list_reply:{id:format.reply.sections[0].rows[0].id}}});
 const requested=continueMetaPlanImportConversation({message:decodeWorkerChannelProof(selected,connection,environment).value,state:format.state,eventId:selected.id,facts:facts(selected),now:r.now});
 const fileEvent=event('File',{type:'document',document:{id:mediaId,mime_type:'application/pdf'},context:{id:'wamid.SyntheticPlanFilePrompt'}});
 const notice=continueMetaPlanImportConversation({message:decodeWorkerChannelProof(fileEvent,connection,environment).value,state:requested.state,eventId:fileEvent.id,facts:facts(fileEvent),now:r.now});
 const outboundId=customerOutboundId(fileEvent.id),promptMessageId='wamid.SyntheticPlanNotice';
 const sent={eventId:fileEvent.id,payloadDigest:fileEvent.payload.payloadDigest,organizationId:member.organizationId,channelId:connection.id,to:worker.phone.slice(1),replyTo:decodeWorkerChannelProof(fileEvent,connection,environment).value.id,...(corporate?{targetProjectId:project.id,sourceRouteId:fileEvent.id}:{})};
 function sealOutbound(){const request=clone(sent);events.set(outboundId,{id:outboundId,projectId:connection.projectId,provider:'meta-customer-outbound-v1',payload:{requestDigest:digest(request),encryptedPayload:encryptCustomerSecret(JSON.stringify(request),{organizationId:member.organizationId,projectId:connection.projectId,purpose:'outbound',resourceId:outboundId},environment)},outcome:{state:'STATUS_OBSERVED',messageId:promptMessageId,providerStatus:'delivered'}});}
 sealOutbound();
 const authorizedEvent=event('Authorized',{type:'interactive',interactive:{type:'list_reply',list_reply:{id:notice.reply.sections[0].rows[0].id}},context:{id:promptMessageId}});
 const authorized=continueMetaPlanImportConversation({message:decodeWorkerChannelProof(authorizedEvent,connection,environment).value,state:notice.state,eventId:authorizedEvent.id,facts:facts(authorizedEvent),now:r.now});
 assert.ok(authorized.planImport,'Real planner must authorize the synthetic flow');
 // The production conversation envelope adds the verified channel binding.
 authorized.state.bindingId=channelBinding.id;
 r.event=authorizedEvent;r.proof=decodeWorkerChannelProof(authorizedEvent,connection,environment);
 const observedId='meta_field_'+digest(['meta-field-dispatch-v1',fileEvent.id]);
 audits.set(observedId,{id:observedId,organizationId:member.organizationId,actorId:member.actorId,entityId:worker.id,action:'meta.field.dispatched',metadata:{version:1,projectId:project.id,channelId:connection.id,channelBindingId:channelBinding.id,eventId:fileEvent.id,payloadDigest:fileEvent.payload.payloadDigest,kind:'CONVERSATION',businessApplied:false}});
 const result=rows=>({rows:clone(rows),rowCount:rows.length});
 const client={async query(raw,args=[]){
  const sql=raw.replace(/\s+/g,' ').trim();calls.sql.push(sql);
  if(sql.startsWith('SELECT EXISTS')&&sql.includes("action='office.review.accepted'")){assert.deepEqual(args,[member.organizationId,member.actorId,member.membershipId]);return result(controls.restricted===undefined?[]:[{restricted:controls.restricted}]);}
  if(ownAuthority&&(sql.includes('public."PlatformUser"')||sql.includes('public."WhatsAppConnection"')||sql.includes("action='company.own.number.recorded'")))return ownAuthority.client.query(raw,args);
  if(sql.startsWith('SELECT')&&sql.includes('public."WhatsAppConnection"'))return result(args[0]===connection.id&&args[1]===connection.projectId&&args[2]===connection.organizationId?[connection]:[]);
  if(sql.startsWith('SELECT')&&sql.includes('public."WebhookEvent"')){const row=events.get(args[0]);return result(row&&row.projectId===args[1]&&(!args[2]||row.provider===args[2])?[row]:[]);}
  if(sql.startsWith('SELECT')&&sql.includes('public."WhatsAppCompanyEventRoute"'))return result(routes.has(args[0])?[routes.get(args[0])]:[]);
  if(sql.startsWith('UPDATE public."WebhookEvent"')){const row=events.get(args[0]);if(!row||row.status!=='PENDING'||row.leaseToken!==args[1]||Date.parse(row.leaseExpiresAt)<=clock())return result([]);row.leaseExpiresAt=new Date(clock()+180000).toISOString();return result([{id:row.id}]);}
  if(sql.startsWith('SELECT')&&sql.includes('public."Task"'))return result([]);
  if(sql.startsWith('INSERT INTO public."Task"')){calls.taskWrites++;assert.fail('Transport may never apply tasks');}
  if(sql.startsWith('SELECT')&&sql.includes('public."AuditLog"')){
   let rows=[...audits.values()];if(sql.includes('WHERE id=$1'))rows=rows.filter(row=>row.id===args[0]);
   const action=sql.match(/action='([^']+)'/);if(action)rows=rows.filter(row=>row.action===action[1]);
   for(const [column,key] of [['organizationId','organizationId'],['actorId','actorId'],['entityId','entityId']]){const match=sql.match(new RegExp('"'+column+'"=\\$(\\d+)'));if(match)rows=rows.filter(row=>row[key]===args[Number(match[1])-1]);}
   if(sql.includes("metadata->>'status'='APPLIED'"))rows=rows.filter(row=>row.metadata.status==='APPLIED'&&row.metadata.source.sha256===args[2]);
   return result(rows.map(row=>({id:row.id,actorId:row.actorId,entityId:row.entityId,metadata:row.metadata})));
  }
  if(sql.startsWith('INSERT INTO public."AuditLog"')){const [id,organizationId,actorId,entityId,metadata]=args,action=sql.match(/'((?:plan\.import|meta\.field\.plan)\.[a-z]+)'/)?.[1];assert.ok(action);assert.ok(!audits.has(id),'Unique canonical reservation');audits.set(id,{id,organizationId,actorId,entityId,action,metadata:JSON.parse(metadata)});return result([]);}
  if(sql.startsWith('UPDATE public."AuditLog"')){const [id,metadata,lease,expiry]=args,row=audits.get(id);assert.ok(row);if(lease&&(row.metadata.lease?.token!==lease||row.metadata.lease.expiresAt!==expiry||Date.parse(expiry)<=Date.now()))return result([]);row.metadata=JSON.parse(metadata);return result([{id}]);}
  assert.fail('Unexpected synthetic transport SQL: '+sql);
 }};
 async function within(callback){const before=clone(audits);try{return await callback(client);}catch(error){audits=before;throw error;}}
 async function resolve(_client,_context,_permission,beforeProject){calls.resolves++;if(!controls.assignment)throw new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',403);const current=events.get(authorizedEvent.id);if(current.status!=='PENDING'||current.leaseToken!=='lease-plan-synthetic'||Date.parse(current.leaseExpiresAt)<=clock())throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);if(beforeProject)await beforeProject(client,member,r.scope);return {...r,event:current,proof:decodeWorkerChannelProof(current,connection,environment),now:new Date(clock())};}
 const seal=(current,purpose,id,input)=>encryptCustomerSecret(JSON.stringify(input),{organizationId:current.member.organizationId,projectId:current.project.id,purpose,resourceId:id},environment);
 const unseal=(current,purpose,id,value)=>JSON.parse(decryptCustomerSecret(value,{organizationId:current.member.organizationId,projectId:current.project.id,purpose,resourceId:id},environment));
 const provider=createMetaCustomerProvider({environment,...(ownAuthority?{now:()=>ownAuthority.time}:{}),fetchImpl:async(url,options)=>{
  const parsed=new URL(url);assert.equal(options.redirect,'error');
  if(parsed.hostname==='graph.facebook.com'&&parsed.pathname==='/v25.0/'+mediaId){assert.equal(parsed.searchParams.get('phone_number_id'),connection.phoneNumberId);calls.graph++;await controls.hooks.graph?.();return Response.json({id:mediaId,url:'https://lookaside.fbsbx.com/whatsapp_business/attachments/synthetic-plan',mime_type:'application/pdf',file_size:bytes.length,sha256,...controls.graphPatch});}
  if(parsed.hostname==='graph.facebook.com'&&ownAuthority)return ownAuthority.fetchImpl(url,options);
  assert.equal(parsed.hostname,'lookaside.fbsbx.com');calls.attachment++;await controls.hooks.attachment?.();return new Response(controls.attachmentBytes||bytes,{headers:{'content-type':controls.graphPatch.mime_type||'application/pdf','content-length':String(bytes.length)}});
 }});
 const transport=createMetaPlanImportTransport({within,resolve,saved:async(_client,current)=>savedResults.get(current.event.id)||null,
  async record(_client,current,value){if(controls.failRecordOnce){controls.failRecordOnce=false;throw Error('Synthetic final response loss');}calls.records++;savedResults.set(current.event.id,clone(value));return value;},
  result:(_current,kind,reply,extra={})=>({kind,reply,businessApplied:false,...extra}),seal,unseal,
  async writePending(){calls.pending++;},async commitFence(){calls.fences++;},operationIdFor:metaFieldOperationId,environment,protocol:META_CUSTOMER_PROTOCOL,
  provider:{forConnection:input=>provider.forConnection(input),downloadPlanSource:input=>controls.providerOverride?controls.providerOverride(input):provider.downloadPlanSource(input)},
  async put(path,source,options){calls.put++;assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);await controls.hooks.put?.();blobs.set(path,{bytes:Buffer.from(source),contentType:options.contentType});},
  async get(path,options){calls.get++;assert.equal(options.access,'private');await controls.hooks.get?.();const value=blobs.get(path);if(!value)throw Error('Synthetic source not stored');return {statusCode:200,blob:{url:'https://synthetic.private.blob.vercel-storage.com/'+path,pathname:path,size:value.bytes.length,contentType:value.contentType},stream:new Response(value.bytes).body};},
  usage,analyzer:planAnalyzer||{async analyze(source){calls.analyze++;await controls.hooks.analyzer?.();assert.deepEqual(source.bytes,bytes);return {success:true,provider:'openai',model:'gpt-4o',requestedModel:'gpt-4o',rows:[{title:'Partida sintética',startsOn:null,endsOn:null,evidence:'Fila sintética 1',uncertainty:'Revisar fechas con la fuente'}],warnings:[]};}}
 });
 const context={eventId:authorizedEvent.id,projectId:connection.projectId,channelId:connection.id,payloadDigest:authorizedEvent.payload.payloadDigest,leaseToken:authorizedEvent.leaseToken};
 const prepare=()=>within(async c=>transport.prepare(c,await resolve(),authorized.planImport,authorized.state));
 const recover=()=>within(async c=>transport.recover(c,await resolve()));
 const planDrafts=()=>clone([...audits.values()].filter(row=>row.action==='plan.import.draft'));
 function seedPending(prepared,{status='UPLOADING',expired=false}={}){const id='plan_draft_'+digest([member.actorId,project.id,prepared.operationId]);audits.set(id,{id,organizationId:member.organizationId,actorId:member.actorId,entityId:project.id,action:'plan.import.draft',metadata:{version:1,projectId:project.id,revision:1,status,existingTaskCount:0,source:{contentType:'application/pdf',bytes:bytes.length,sha256,pathname:'synthetic-private-plan'},sourceConfirmed:false,rows:[],warnings:[],consent:{version:authorized.planImport.consent},lease:{token:'pending-plan-lease',expiresAt:new Date(Date.now()+(expired?-1000:600000)).toISOString()},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}});return id;}
 return {r,context,authorized,environment,client,within,transport,prepare,recover,planDrafts,seedPending,calls,controls,events,routes,bytes,sha256,fileEvent,outboundId,sent,sealOutbound,observedId,audits:()=>audits};
}
