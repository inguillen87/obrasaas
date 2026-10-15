import test from 'node:test';
import assert from 'node:assert/strict';
import {digest} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {refreshLockedWorkerChannelIdentity,resolveCompanyFieldDispatchIdentity,releaseLockedWorkerChannelIdentity} from '../src/lib/worker-channel-identity.mjs';

// Independent atomic-composition cases. The signed source, binding/KYC, company
// selector, FIELD service and opaque refresh are real production modules. SQL
// and concurrency are strict memory fixtures; no native latency claim is made.
import {createHmac as companyComposedHmac} from 'node:crypto';
import {createCompanyChannelBridge as companyComposedCreateBridge} from '../src/lib/company-channel-routing.mjs';
import {metaFieldMediaContextDigest as companyComposedMediaContext,readMetaFieldConversation as companyComposedReadConversation} from '../src/lib/meta-field-bridge.mjs';
import {metaCustomerContentDigest as companyComposedContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT as companyComposedSchema} from '../src/lib/company-channel-schema.mjs';
import {OBRASAAS_META_CHANNEL as companyComposedChannel} from '../src/lib/meta-channel-binding.mjs';
import {customerOutboundId as companyComposedOutboundId} from '../src/lib/meta-customer-outbound.mjs';

function fixture({routeExpiresIn=-1000,fieldExpiresIn=120000,report=true,corruptBodies=false,quote='wamid.composedcurrentprompt123456',promptChange=()=>{},messageAtOffset=0,elapseAfterWorker=0,simulatedSqlMs=0,verificationExpiresIn=null,beforeQuery=()=>{},afterQuery=()=>{}}={}){
 const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,41).toString('base64')},clock=Date.now(),queries=[],writes=[],audits=new Map(),events=new Map(),projections=new Map(),savepoints=new Map();let serial=0,open=0,externalCalls=0,elapsed=0,transactionSerial=10000,transactionId=null;
 const member={actorId:'actor-a',membershipId:'membership-a',organizationId:'organization-a',clerkUserId:'user_Fixture',role:'AUDITOR',clerkRole:'org:member',organizationMetadata:{}},revision='2026-10-15T12:00:00.123456';
 const material={id:'material-a',name:'Cemento',unit:'bolsa',balance:'25.000',active:true};
 const target={id:'project-b',organizationId:member.organizationId,name:'Obra B',status:'ACTIVE',revision,metadata:{fieldOperations:{version:1,sectors:[{id:'sector-b',name:'Sector B'}]},materialInventory:{version:1,catalogVersion:2,materials:[material,{id:'material-b',name:'Arena',unit:'m3',balance:'0.000',active:true}]}}};
 const anchor={id:'project-a',organizationId:member.organizationId,name:'Empresa ancla',status:'ACTIVE',revision,metadata:{}};
 const connection={id:'connection-a',projectId:anchor.id,organizationId:member.organizationId,phoneNumberId:'120000001',whatsappBusinessId:'130000001',enabled:true,connectionStatus:'CONNECTED',encryptedAccessToken:'v2.synthetic-not-used',metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:member.organizationId,customerSubscribed:true,customerVerification:{registered:true,expiresAt:verificationExpiresIn===null?null:new Date(clock+verificationExpiresIn).toISOString(),scopes:['whatsapp_business_management','whatsapp_business_messaging']},customerActivation:{version:1,state:'ACTIVE',actorId:'other-admin'}}};
 const owner={connectionId:connection.id,organizationId:member.organizationId,anchorProjectId:anchor.id,mode:'COMPANY',revision:7,assignmentRevision:2};
 const seal=(value,purpose,id,projectId=anchor.id)=>encryptCustomerSecret(JSON.stringify(value),{organizationId:member.organizationId,projectId,purpose,resourceId:id},environment);
 function signedEvent(label,body,at=clock){
  const payload={wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,field:'messages',type:'message',value:{id:'wamid.composed_'+label,from:'5491100001111',timestamp:String(Math.floor(at/1000)),...body}},externalId=digest([payload.wabaId,payload.phoneNumberId,'message',payload.value.id]),id='customer_webhook_'+externalId,payloadDigest=companyComposedContentDigest(payload),companyRouting={mode:'COMPANY',revision:owner.revision,contract:companyComposedSchema};
  const event={id,projectId:anchor.id,provider:'meta-customer-v1',externalId,eventType:'message',status:'PENDING',createdAt:new Date(at),leaseToken:'lease-'+label,leaseExpiresAt:new Date(clock+60000),payload:{version:1,organizationId:member.organizationId,channelId:connection.id,payloadDigest,companyRouting,encryptedPayload:seal(payload,'webhook',id),encryptedProof:seal({scheme:'meta-hmac-sha256-v1',appId:companyComposedChannel.appId,payloadDigest,channelId:connection.id,organizationId:member.organizationId,companyRouting},'webhook-proof',id)}};
  events.set(id,event);return event;
 }
 const origin=signedEvent('binding_origin_12345678',{type:'text',text:{body:'VINCULAR '+'a'.repeat(43)}},clock-5000),promptEvent=signedEvent('draft_prompt_12345678',{type:'text',text:{body:'Consumo preparado'}},clock-2000);
 const images=[{id:'document-front',kind:'DOCUMENT_FRONT',sha256:'a'.repeat(64),bytes:8,contentType:'image/png'},{id:'selfie',kind:'SELFIE',sha256:'b'.repeat(64),bytes:8,contentType:'image/png'}];
 const kyc={version:1,status:'APPROVED',submissionId:'kyc-b',contentHash:digest(images.map(i=>[i.kind,i.sha256,i.bytes,i.contentType])),images,review:{decision:'APPROVED',actorId:'other-reviewer',recordedAt:'2026-10-01T10:00:00.000Z'}};
 const binding={version:1,id:'binding-b',status:'VERIFIED',workerId:'worker-b',projectId:target.id,organizationId:member.organizationId,actorId:member.actorId,membershipId:member.membershipId,clerkUserId:member.clerkUserId,senderE164:'+5491100001111',connectionId:connection.id,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,kycSubmissionId:kyc.submissionId,kycReviewedAt:kyc.review.recordedAt,proofEventId:origin.id,proofExternalId:origin.externalId,proofPayloadDigest:origin.payload.payloadDigest};
 const worker={id:binding.workerId,projectId:target.id,phone:binding.senderE164,name:'Persona sintética compuesta',active:true,revision,actorId:member.actorId,membershipId:member.membershipId,clerkUserId:member.clerkUserId,organizationId:member.organizationId,assignmentRevision:2,projectName:target.name,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:member.clerkUserId,permissions:{attendance:true,report},kyc,channelIdentity:{binding}}}};
 const senderHmac=companyComposedHmac('sha256',Buffer.from(environment.META_CUSTOMER_CREDENTIALS_KEY,'base64')).update(JSON.stringify(['company-sender-v1',member.organizationId,connection.id,binding.senderE164])).digest('hex'),routeId='company_route_'+digest([member.organizationId,connection.id,senderHmac]);
 const route={id:routeId,organizationId:member.organizationId,connectionId:connection.id,epoch:4,actorId:member.actorId,membershipId:member.membershipId,projectId:target.id,workerId:worker.id,assignmentRevision:2,bindingId:binding.id,encryptedState:seal({phase:'SELECTED',expiresAt:new Date(clock+routeExpiresIn).toISOString()},'company-route',routeId)};
 const projection={sourceEventId:promptEvent.id,payloadDigest:promptEvent.payload.payloadDigest,organizationId:member.organizationId,connectionId:connection.id,kind:'FIELD',routeId,routeEpoch:route.epoch,actorId:member.actorId,membershipId:member.membershipId,projectId:target.id,workerId:worker.id,assignmentRevision:2,bindingId:binding.id};
 projections.set(promptEvent.id,structuredClone(projection));promptChange(projections.get(promptEvent.id));
 const deadline=new Date(clock+fieldExpiresIn).toISOString(),state={version:1,purpose:'CONSUMPTION',step:'CONFIRM',taskId:null,sectorId:'sector-b',materialId:material.id,name:material.name,unit:material.unit,quantity:'2.000',reason:'Para la mezcla del sector de la obra.',catalogHash:digest('old-before-unrelated-B'),nonce:'1'.repeat(20),choices:[{value:'CONFIRM',title:'Guardar'},{value:'CANCEL',title:'Cancelar'}],lastEventId:promptEvent.id,lastMessageTimestamp:String(Math.floor((clock-2000)/1000)),lastReceivedAt:new Date(clock-2000).toISOString(),expiresAt:deadline,bindingId:binding.id};
 worker.metadata.fieldChannelConversation={version:1,lastEventId:state.lastEventId,lastMessageTimestamp:state.lastMessageTimestamp,lastReceivedAt:state.lastReceivedAt,expiresAt:deadline,bindingId:binding.id,encryptedState:seal(state,'field-conversation',worker.id,target.id)};
 const principalDigest=digest(['meta-field-consumption-recovery-v1',companyComposedMediaContext({member,project:target,worker,connection,sourceProjectId:anchor.id,companyProjection:projection,channelBinding:binding})]),errorEvent='customer_webhook_'+digest('composed-catalog-rejection'),error={code:'INVENTORY_CATALOG_CHANGED',eventId:errorEvent,receiptId:'meta_field_'+digest(['meta-field-dispatch-v1',errorEvent])};
 const recovery={version:1,id:digest(['composed-recovery',principalDigest]),contextDigest:principalDigest,deadline,origin:{lastEventId:state.lastEventId,lastMessageTimestamp:state.lastMessageTimestamp,lastReceivedAt:state.lastReceivedAt,nonce:state.nonce,bindingId:state.bindingId},suggestion:{materialId:state.materialId,name:state.name,unit:state.unit,quantity:state.quantity,reason:state.reason,taskId:state.taskId,sectorId:state.sectorId},firstError:error,lastError:error};
 worker.metadata.fieldConsumptionRecovery={version:1,id:recovery.id,contextDigest:principalDigest,deadline,bindingId:binding.id,encryptedState:seal(recovery,'field-consumption-recovery',worker.id,target.id)};
 if(corruptBodies){worker.metadata.fieldChannelConversation.encryptedState='corrupt-private-draft';worker.metadata.fieldConsumptionRecovery.encryptedState='corrupt-private-sidecar';}
 const original=structuredClone(worker.metadata),outboundId=companyComposedOutboundId(promptEvent.id),request={organizationId:member.organizationId,channelId:connection.id,targetProjectId:target.id,sourceRouteId:promptEvent.id};
 events.set(outboundId,{id:outboundId,projectId:anchor.id,provider:'meta-customer-outbound-v1',payload:{requestDigest:digest(request),encryptedPayload:seal(request,'outbound',outboundId)},outcome:{state:'SENT',messageId:'wamid.composedcurrentprompt123456'}});
 const review={id:'review-kyc',actorId:kyc.review.actorId,entityId:worker.id,metadata:{version:1,kind:'REVIEW_KYC',projectId:target.id,submissionId:kyc.submissionId,decision:'APPROVED'}},submission={id:'submit-kyc',actorId:member.actorId,entityId:worker.id,metadata:{version:1,kind:'KYC_SUBMITTED',projectId:target.id,submissionId:kyc.submissionId,contentHash:kyc.contentHash}},bindingAudit={id:'worker_channel_event_'+digest([origin.id,worker.id]),metadata:{projectId:target.id,bindingId:binding.id,proofPayloadDigest:binding.proofPayloadDigest}};
 const rows=values=>({rows:values,rowCount:values.length}),snapshot=()=>structuredClone({worker:worker.metadata,projections:[...projections],audits:[...audits],writes:writes.length}),restore=s=>{worker.metadata=structuredClone(s.worker);projections.clear();for(const [key,value]of s.projections)projections.set(key,structuredClone(value));audits.clear();for(const [key,value]of s.audits)audits.set(key,structuredClone(value));writes.splice(s.writes);};
 async function performQuery(sql,args=[]){
  queries.push({sql,args:structuredClone(args)});
  elapsed+=simulatedSqlMs;
  if(sql==='BEGIN'){assert.equal(open,0);open++;transactionId=String(++transactionSerial);savepoints.clear();savepoints.set('transaction',snapshot());return rows([]);}
  if(sql==='COMMIT'){assert.equal(open,1);open--;transactionId=null;return rows([]);}
  if(sql==='ROLLBACK'){restore(savepoints.get('transaction'));open--;transactionId=null;return rows([]);}
  if(sql.startsWith('SET LOCAL')||sql.startsWith('SELECT pg_advisory'))return rows([]);
  if(sql.startsWith('SAVEPOINT ')){savepoints.set(sql.slice(10),snapshot());return rows([]);}
  if(sql.startsWith('ROLLBACK TO SAVEPOINT ')){const value=savepoints.get(sql.slice(22));assert.ok(value,sql);restore(value);return rows([]);}
  if(sql==='SELECT pg_current_xact_id()::text AS "workerChannelTransactionId"'){assert.equal(open,1);return rows([{workerChannelTransactionId:transactionId}]);}
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(clock+serial+elapsed)}]);
  if(sql==='SELECT clock_timestamp() AS now,pg_current_xact_id()::text AS "workerChannelTransactionId"'){assert.equal(open,1);assert.match(transactionId,/^\d+$/);return rows([{now:new Date(clock+serial+elapsed),workerChannelTransactionId:transactionId}]);}
  if(sql.startsWith('WITH "workerChannelPrincipal" AS MATERIALIZED (')){
   assert.equal(open,1);assert.deepEqual(args.slice(0,6),[member.actorId,member.clerkUserId,member.membershipId,member.organizationId,target.id,worker.id]);if(args[6]!==transactionId)return rows([]);
   assert.match(sql,/FOR SHARE OF u,tm,o,p,pm FOR UPDATE OF w/);assert.match(sql,/ORDER BY a.id FOR SHARE OF a/);
   const k=worker.metadata.participant.kyc,kycProofs=[{...structuredClone(review),reviewProof:true,submissionProof:false,adoptionProof:false},{...structuredClone(submission),reviewProof:false,submissionProof:true,adoptionProof:true}];
   assert.equal(k.channelCapture,undefined,'This composed fixture uses the ordinary account submission path');
   return rows([{user:{id:member.actorId,clerkUserId:member.clerkUserId},member:structuredClone(member),project:structuredClone(target),worker:structuredClone(worker),kycProofs,identityTransactionId:transactionId}]);
  }
  if(sql.startsWith('SELECT id,"projectId",provider,')&&sql.includes('clock_timestamp() AS now,pg_current_xact_id()::text AS "identityTransactionId"')){assert.equal(open,1);const value=events.get(args[0]);assert.deepEqual(args,[value?.id,anchor.id]);return rows(value?[{...structuredClone(value),now:new Date(clock+serial+elapsed),identityTransactionId:transactionId}]:[]);}
  if(sql.includes('to_regclass'))return rows([{present:true,count:1}]);
  if(sql.startsWith('SELECT version,contract,"catalogFingerprint",'))return rows([{version:1,contract:companyComposedSchema,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]}),currentCatalog:{columns:[],keys:[],indexes:[],triggers:[]},catalog:args[1].map(conname=>({conname,convalidated:true})),indexes:args[2].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})),triggers:args[3].map(tgname=>({tgname,tgenabled:'O'}))}]);
  if(sql.includes('FROM public."WhatsAppCompanyChannel" cc JOIN public."WhatsAppChannelProjectAssignment"')){assert.ok(args.includes(member.organizationId));return rows([{...owner}]);}
  if(sql.includes('SELECT w.*')&&sql.includes('FROM public."WhatsAppChannelProjectAssignment"')){assert.deepEqual(args.slice(0,3),[connection.id,member.organizationId,binding.senderE164]);return rows([{...worker}]);}
  if(sql.includes('FROM public."WhatsAppCompanyChannel"')){assert.equal(args[0],connection.id);assert.equal(args[1],member.organizationId);return rows([{...owner}]);}
  if(sql.includes('FROM public."WhatsAppChannelProjectAssignment"')){assert.deepEqual(args.slice(0,3),[connection.id,member.organizationId,target.id]);return rows([{revision:2}]);}
  if(sql.includes('FROM public."WhatsAppConnection"')){if(sql.includes('c.*,p.'))assert.deepEqual(args,[connection.id,anchor.id,member.organizationId]);else assert.deepEqual(args,[connection.id,anchor.id]);return rows([{...connection}]);}
  if(sql.startsWith('INSERT INTO public."WhatsAppCompanyEventRoute"')){assert.ok(!projections.has(args[0]));const keys=['sourceEventId','payloadDigest','organizationId','connectionId','kind','routeId','routeEpoch','actorId','membershipId','projectId','workerId','assignmentRevision','bindingId'];projections.set(args[0],Object.fromEntries(keys.map((key,index)=>[key,args[index]])));writes.push({kind:'route-reservation',id:args[0]});return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."WhatsAppCompanyEventRoute"')){const value=projections.get(args[0]);assert.ok(value);assert.equal(value.payloadDigest,args[2]);value.encryptedResult=args[1];writes.push({kind:'route-result',id:args[0]});return {rows:[],rowCount:1};}
  if(sql.includes('FROM public."WhatsAppCompanyEventRoute"')){if(sql.includes('SELECT EXISTS'))return rows([{pending:false}]);const value=projections.get(args[0]);return rows(value&&(!sql.includes("kind IN ('BINDING','FIELD')")||['BINDING','FIELD'].includes(value.kind))?[value]:[]);}
  if(sql.includes('FROM public."WhatsAppCompanyRoute"')){assert.equal(args[0],routeId);return rows([route]);}
  if(sql.includes('SELECT "eventType"')){assert.equal(events.get(args[0])?.eventType,'message');return rows([{eventType:'message'}]);}
  if(sql.startsWith('UPDATE public."WebhookEvent"')){const value=events.get(args[0]);assert.ok(value);assert.equal(value.leaseToken,args[1]);assert.equal(value.status,'PENDING');return {rows:[],rowCount:value&&new Date(value.leaseExpiresAt).getTime()>clock+serial+elapsed?1:0};}
  if(sql.includes('FROM public."WebhookEvent"')){const value=events.get(args[0]);if(value&&sql.includes('"leaseToken"=$2')){assert.equal(value.leaseToken,args[1]);assert.equal(value.status,'PENDING');if(new Date(value.leaseExpiresAt).getTime()<=clock+serial+elapsed)return rows([]);}else if(value&&sql.includes('"projectId"=$2'))assert.equal(value.projectId,args[1]);return rows(value?[value]:[]);}
  if(sql.includes('FROM public."PlatformUser"')){assert.deepEqual(args,[member.actorId,member.clerkUserId]);return rows([{id:member.actorId,clerkUserId:member.clerkUserId}]);}
  if(sql.includes('FROM public."TenantMembership"')){assert.deepEqual(args,[member.membershipId,member.actorId,member.organizationId]);return rows([{...member}]);}
  if(sql.includes('FROM public."ProjectMembership"')){assert.deepEqual(args,[target.id,member.membershipId]);return rows([{id:'project-membership-b'}]);}
  if(sql.startsWith('UPDATE public."Worker"')){assert.deepEqual(args.slice(0,2),[worker.id,target.id]);if(sql.includes("metadata=metadata-'fieldChannelConversation'-'fieldConsumptionRecovery'")){delete worker.metadata.fieldChannelConversation;delete worker.metadata.fieldConsumptionRecovery;}else{assert.equal(typeof args[2],'string');worker.metadata=JSON.parse(args[2]);}writes.push({kind:'worker',id:worker.id});elapsed+=elapseAfterWorker;return {rows:[],rowCount:1};}
  if(sql.includes('FROM public."Worker"')){if(sql.includes('SELECT w.id,w.')){assert.deepEqual(args.slice(0,2),[target.id,binding.senderE164]);return rows([{...worker}]);}if(sql.includes('WHERE id=$1'))assert.deepEqual(args.slice(0,2),[worker.id,target.id]);else{assert.equal(args[0],target.id);if(sql.includes("metadata->'participant'->>'clerkUserId'=$2"))assert.equal(args[1],member.clerkUserId);}return rows([{...worker}]);}
  if(sql.includes('FROM public."Project"')){const value=args[0]===target.id?target:args[0]===anchor.id?anchor:null;assert.ok(value,'Unknown project '+args[0]);if(args[1]!==undefined)assert.equal(args[1],member.organizationId);return rows([{...value}]);}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.ok(!audits.has(args[0]));const action=/VALUES\(\$1,\$2,\$3,'([^']+)'/.exec(sql)?.[1];assert.ok(action);assert.equal(args[1],member.organizationId);assert.equal(args[2],member.actorId);assert.equal(args[3],worker.id);audits.set(args[0],{id:args[0],action,actorId:args[2],entityId:args[3],metadata:JSON.parse(args[4])});writes.push({kind:'audit',action,id:args[0]});return {rows:[],rowCount:1};}
  if(sql.includes('FROM public."AuditLog"')){if(sql.includes("kind'='REVIEW_KYC'")){assert.deepEqual(args,[member.organizationId,kyc.review.actorId,worker.id,target.id,kyc.submissionId]);return rows([review]);}if(sql.includes("kind'='KYC_SUBMITTED'")){assert.deepEqual(args,[member.organizationId,member.actorId,worker.id,target.id,kyc.submissionId]);return rows([submission]);}if(sql.includes("kind'='CHANNEL_BOUND'")){assert.deepEqual(args,[bindingAudit.id,member.organizationId,member.actorId,worker.id]);return rows([bindingAudit]);}if(sql.includes("action='meta.field.dispatched'")){const value=audits.get(args[0]);return rows(value?[value]:[]);}if(sql.includes("action='meta.field.media.prepared'"))return rows([]);throw Error('Unexpected composed audit SQL: '+sql);}
  if(sql.includes('FROM public."Task"')||sql.includes('FROM public."AttendanceEntry"')||sql.includes('FROM public."OperationalProposal"')||sql.includes('FROM public."Incident"'))return rows([]);
  throw Error('Unexpected composed company/FIELD SQL: '+sql);
 }
 const query=async(sql,args=[])=>{await beforeQuery(sql,args,{worker,member,route,connection,events,projections});const result=await performQuery(sql,args);await afterQuery(sql,args,{worker,member,route,connection,events,projections,advanceClockTo:at=>{const observed=clock+serial+elapsed;assert.ok(Number.isFinite(at)&&at>=observed,'Synthetic SQL time advances monotonically');elapsed+=at-observed;}});return result;};
 const noExternal=async()=>{externalCalls++;throw Error('No provider operation is authorized in composed recovery fixture');},bridge=companyComposedCreateBridge({connect:async()=>({query,release:()=>assert.equal(open,0)}),environment,provider:{downloadMedia:noExternal,sendReply:noExternal}});
 function input(body){serial++;const event=signedEvent('input_'+serial+'_12345678',{type:'text',text:{body},...(quote?{context:{id:quote}}:{})},clock+serial+messageAtOffset);return {eventId:event.id,projectId:anchor.id,channelId:connection.id,payloadDigest:event.payload.payloadDigest,leaseToken:event.leaseToken};}
 async function send(body){const context=input(body),result=await bridge.execute(context);return {result,context};}
 function metrics(){const shapes=new Map();for(const {sql}of queries){const shape=sql.replace(/\s+/g,' ').trim();shapes.set(shape,(shapes.get(shape)||0)+1);}return {boundary:'COMPOSED_MEMORY_QUERY_COUNTS_NOT_NATIVE_LATENCY',totalSql:queries.length,canonicalFieldResolverEntries:queries.filter(q=>q.sql.startsWith('SELECT id,"projectId",provider,"externalId","eventType",status::text AS status,payload,outcome,"createdAt" FROM public."WebhookEvent"')).length,companyEnvelopeEntries:queries.filter(q=>q.sql==='SELECT * FROM public."WebhookEvent" WHERE id=$1').length,estimatedSerialSqlAt225ms:queries.length*225,queryShapes:[...shapes].map(([sql,count])=>({sql,count}))};}
 return {bridge,send,input,client:{query},worker,target,connection,route,member,binding,events,environment,original,queries,writes,projections,audits,deadline,metrics,replay:context=>bridge.execute(context),elapsed:()=>elapsed,external:()=>externalCalls,state:()=>companyComposedReadConversation({worker,member,project:target,channelBinding:binding},environment)};
}

test('signed CONSUMO recovery commits company projection and FIELD receipt in one transaction',async t=>{
 const f=fixture(),sidecar=structuredClone(f.worker.metadata.fieldConsumptionRecovery),{result,context}=await f.send('CONSUMO');
 assert.equal(result.kind,'CONSUMPTION_RECOVERY');assert.equal(result.businessApplied,false);
 assert.equal(f.projections.get(context.eventId).kind,'FIELD');assert.ok(f.projections.get(context.eventId).encryptedResult);
 assert.equal(f.state().step,'CONSUMPTION_MATERIAL');assert.equal(f.state().expiresAt,f.deadline);assert.equal(f.state().quantity,undefined);assert.equal(f.state().unit,undefined);
 assert.deepEqual(f.worker.metadata.fieldConsumptionRecovery,sidecar);assert.equal(f.target.metadata.materialInventory.materials[0].balance,'25.000');
 assert.equal(f.queries.filter(q=>q.sql==='BEGIN').length,1);assert.equal(f.queries.filter(q=>q.sql==='COMMIT').length,1);
 assert.equal(f.metrics().canonicalFieldResolverEntries,0);assert.equal(f.metrics().companyEnvelopeEntries,1);
 assert.equal(f.queries.filter(q=>q.sql==='SELECT pg_current_xact_id()::text AS "workerChannelTransactionId"').length,1);
 assert.ok(f.queries.filter(q=>q.sql.startsWith('WITH "workerChannelPrincipal" AS MATERIALIZED (')).length>=2);
 assert.equal(f.queries.some(q=>q.sql.includes('FROM public."Task"')),false);assert.equal(f.writes.some(w=>w.action==='field.operation.recorded'),false);assert.equal(f.external(),0);
 t.diagnostic(JSON.stringify(f.metrics()));
});

for(const point of ['INSERT INTO public."AuditLog"','UPDATE public."Worker"'])test('atomic rollback removes projection and FIELD effects when '+point+' fails',async()=>{
 let fired=false;const f=fixture({beforeQuery:sql=>{if(sql.startsWith(point)){fired=true;throw Error('synthetic-dispatch-failure');}}});
 const old=structuredClone(f.worker.metadata),before=[...f.projections];
 await assert.rejects(f.send('CONSUMO'),/synthetic-dispatch-failure/);assert.equal(fired,true);
 assert.deepEqual(f.worker.metadata,old);assert.deepEqual([...f.projections],before);assert.equal(f.audits.size,0);assert.equal(f.writes.length,0);
 assert.equal(f.queries.filter(q=>q.sql==='ROLLBACK').length,1);assert.equal(f.queries.some(q=>q.sql==='COMMIT'),false);assert.equal(f.external(),0);
});

test('atomic replay returns the original receipt without replacing its draft or doing a second effect',async()=>{
 const f=fixture(),{result,context}=await f.send('CONSUMO'),old=structuredClone(f.worker.metadata),writes=structuredClone(f.writes),receipt=structuredClone([...f.audits]);
 assert.deepEqual(await f.replay(context),result);assert.deepEqual(f.worker.metadata,old);assert.deepEqual(f.writes,writes);assert.deepEqual([...f.audits],receipt);assert.equal(f.external(),0);
});

for(const key of ['leaseToken','payloadDigest','channelId','projectId'])test('a forged caller context cannot select an atomic principal: '+key,async()=>{
 const f=fixture(),{context}=await f.send('CONSUMO'),before=structuredClone(f.worker.metadata),writes=f.writes.length;
 await assert.rejects(f.replay({...context,[key]:'wrong-context'}),e=>e.code==='META_CUSTOMER_INBOX_LEASE_CHANGED');
 assert.deepEqual(f.worker.metadata,before);assert.equal(f.writes.length,writes);assert.equal(f.external(),0);
});

test('caller resolved objects and opaque-looking properties never mint canonical refresh authority',async()=>{
 const f=fixture(),{context}=await f.send('CONSUMO');
 const fake={kind:'CHANNEL_VERIFIED',member:f.member,worker:f.worker,project:f.target,connection:f.connection,event:f.events.get(context.eventId),channelBinding:f.binding};
 fake[Symbol('canonical-worker-channel-transaction')]={};
 let queries=0;await assert.rejects(refreshLockedWorkerChannelIdentity({query:async()=>{queries++;throw Error('unreachable');}},fake,{environment:f.environment}),e=>e.code==='WORKER_CHANNEL_PARTICIPANT_REQUIRED');assert.equal(queries,0);
 assert.equal(await resolveCompanyFieldDispatchIdentity({query:async()=>{queries++;return{rows:[]};}},{eventId:context.eventId,context,resolved:fake,environment:f.environment}),null);assert.equal(queries,1);
});

for(const change of ['permission','participant','binding','kyc'])test('fresh canonical facts reject changed '+change+' and roll back projection',async()=>{
 let fired=false;const f=fixture({beforeQuery:(sql,args,s)=>{
  if(!fired&&sql.startsWith('WITH "workerChannelPrincipal" AS MATERIALIZED (')){fired=true;
   if(change==='permission')s.worker.metadata.participant.permissions.report=false;
   if(change==='participant')s.worker.metadata.participant.clerkUserId='user_Other';
   if(change==='binding')s.worker.metadata.participant.channelIdentity.binding.id='binding-other';
   if(change==='kyc')s.worker.metadata.participant.kyc.status='SUBMITTED';
  }
 }});const before=structuredClone(f.worker.metadata),projections=structuredClone([...f.projections]);
 await assert.rejects(f.send('CONSUMO'),e=>['WORKER_CHANNEL_PERMISSION_REQUIRED','WORKER_CHANNEL_PARTICIPANT_REQUIRED','WORKER_CHANNEL_BINDING_REQUIRED','WORKER_CHANNEL_KYC_REVIEW_REQUIRED'].includes(e.code));
 assert.equal(fired,true);assert.deepEqual([...f.projections],projections);assert.deepEqual(f.worker.metadata,before);assert.equal(f.writes.length,0);assert.equal(f.external(),0);
});

test('source clock follows all fresh-facts waits and expiry rolls the entire dispatch back',async()=>{
 let fired=false;const f=fixture({afterQuery:(sql,args,s)=>{if(!fired&&sql.startsWith('WITH "workerChannelPrincipal" AS MATERIALIZED (')){fired=true;s.advanceClockTo([...s.events.values()].find(e=>e.leaseToken==='lease-input_1_12345678').leaseExpiresAt.getTime());}}});
 const before=structuredClone(f.worker.metadata),projections=structuredClone([...f.projections]);await assert.rejects(f.send('CONSUMO'),e=>e.code==='META_CUSTOMER_INBOX_LEASE_CHANGED');
 assert.equal(fired,true);assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.projections],projections);assert.equal(f.writes.length,0);assert.equal(f.external(),0);
});

test('replay after report revocation cannot disclose the receipt even with attendance still valid',async()=>{
 const f=fixture(),{context}=await f.send('CONSUMO'),before=structuredClone([...f.audits]),writes=f.writes.length;
 f.worker.metadata.participant.permissions.report=false;assert.equal(f.worker.metadata.participant.permissions.attendance,true);
 await assert.rejects(f.replay(context),e=>e.code==='WORKER_CHANNEL_PERMISSION_REQUIRED');assert.deepEqual([...f.audits],before);assert.equal(f.writes.length,writes);assert.equal(f.external(),0);
});

test('non-CONSUMO FIELD dispatch retains the separate company and cold FIELD transactions',async()=>{
 const f=fixture({routeExpiresIn:120000}),{result}=await f.send('ESTADO');
 assert.equal(result.kind,'CONSUMPTION_RECOVERY');assert.match(result.reply.body,/Obra: Obra B/);assert.deepEqual(f.worker.metadata.fieldChannelConversation,f.original.fieldChannelConversation);
 assert.equal(f.queries.filter(q=>q.sql==='BEGIN').length,2);assert.equal(f.queries.filter(q=>q.sql==='COMMIT').length,2);assert.equal(f.metrics().canonicalFieldResolverEntries,1);
 assert.equal(f.queries.some(q=>q.sql==='SELECT pg_current_xact_id()::text AS "workerChannelTransactionId"'),false);assert.equal(f.external(),0);
});

test('the actual company factory handle cannot cross a transaction even on the same pooled client',async()=>{
 const f=fixture(),context=f.input('CONSUMO');await f.client.query('BEGIN');
 const {resolved}=await resolveCompanyFieldDispatchIdentity(f.client,{eventId:context.eventId,context,environment:f.environment});assert.ok(resolved);
 await f.client.query('COMMIT');await f.client.query('BEGIN');
 try{await assert.rejects(refreshLockedWorkerChannelIdentity(f.client,resolved,{permission:'report',environment:f.environment}),e=>e.code==='WORKER_CHANNEL_PARTICIPANT_REQUIRED');}
 finally{releaseLockedWorkerChannelIdentity(resolved);await f.client.query('ROLLBACK');}
 assert.equal(f.external(),0);
});

test('canonical factory requires the claimed source context before any discovery query',async()=>{
 let reads=0;await assert.rejects(resolveCompanyFieldDispatchIdentity({query:async()=>{reads++;throw Error('unreachable');}},{eventId:'source-event',resolved:{alreadyLocked:true}}),e=>e.code==='META_CUSTOMER_INBOX_LEASE_CHANGED');assert.equal(reads,0);
});
