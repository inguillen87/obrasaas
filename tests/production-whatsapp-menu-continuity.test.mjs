import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {planMetaFieldConversation,metaFieldConversationAction,metaInboundCommandText} from '../src/lib/meta-field-conversation.mjs';
import {createCompanyChannelBridge} from '../src/lib/company-channel-routing.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../src/lib/company-channel-schema.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';

// The existing explicit selector fixture is retained as a separate self-contained
// copy. Only this copy adds an actual CONFIRM seed and its canonical route INSERT.
// It stops at the existing controlled FIELD delegation boundary; the real planner
// below independently verifies permission-filtered menu content. No external I/O.
const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,19).toString('base64'),PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-private-storage-only'};
const rows=value=>({rows:value,rowCount:value.length});
function routingFixture(message,{promptChange=()=>{},workerChange=()=>{},requestChange=()=>{},membership=true,assigned=true,routeExpiresIn=120000,fieldExpiresIn=120000,fieldPurpose='MEDIA',routePhase='SELECTED'}={}){
 const member={actorId:'actor-a',membershipId:'membership-a',organizationId:'organization-a',clerkUserId:'user_Fixture',role:'AUDITOR',clerkRole:'org:member',organizationMetadata:{}};
 const connection={id:'connection-a',projectId:'project-a',organizationId:member.organizationId,phoneNumberId:'120000001',whatsappBusinessId:'130000001',enabled:true,connectionStatus:'CONNECTED',encryptedAccessToken:'v2.synthetic-not-used',metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:member.organizationId,customerSubscribed:true,customerVerification:{registered:true,expiresAt:null,scopes:['whatsapp_business_management','whatsapp_business_messaging']},customerActivation:{version:1,state:'ACTIVE',actorId:'other-admin'}}};
 const seal=(value,purpose,id,projectId='project-a')=>encryptCustomerSecret(JSON.stringify(value),{organizationId:member.organizationId,projectId,purpose,resourceId:id},environment);
 function event(id,body){
  const payload={wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,field:'messages',type:'message',value:{id:'wamid.'+id,from:'5491100001111',timestamp:String(Math.floor(Date.now()/1000)),...body}},externalId=digest([payload.wabaId,payload.phoneNumberId,'message',payload.value.id]),key='customer_webhook_'+externalId,payloadDigest=metaCustomerContentDigest(payload),companyRouting={mode:'COMPANY',revision:7,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT};
  return {id:key,projectId:'project-a',provider:'meta-customer-v1',externalId,eventType:'message',status:'PENDING',createdAt:new Date(),leaseToken:'source-lease',leaseExpiresAt:new Date(Date.now()+120000),payload:{version:1,organizationId:member.organizationId,channelId:connection.id,payloadDigest,companyRouting,encryptedPayload:seal(payload,'webhook',key),encryptedProof:seal({scheme:'meta-hmac-sha256-v1',appId:OBRASAAS_META_CHANNEL.appId,payloadDigest,channelId:connection.id,organizationId:member.organizationId,companyRouting},'webhook-proof',key)}};
 }
 const origin=event('origin12345678',{type:'text',text:{body:'VINCULAR '+'a'.repeat(43)}}),current=event('current12345678',message),binding={version:1,id:'binding-b',status:'VERIFIED',workerId:'worker-b',projectId:'project-b',organizationId:member.organizationId,actorId:member.actorId,membershipId:member.membershipId,clerkUserId:member.clerkUserId,senderE164:'+5491100001111',connectionId:connection.id,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,kycSubmissionId:'kyc-b',kycReviewedAt:'2026-10-01T10:00:00Z',proofEventId:origin.id,proofExternalId:origin.externalId,proofPayloadDigest:origin.payload.payloadDigest};
 const worker={id:'worker-b',projectId:'project-b',phone:binding.senderE164,active:true,actorId:member.actorId,membershipId:member.membershipId,clerkUserId:member.clerkUserId,organizationId:member.organizationId,assignmentRevision:2,projectName:'Obra B',metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:member.clerkUserId,permissions:{attendance:false,report:true},kyc:{version:1,status:'APPROVED',submissionId:'kyc-b',contentHash:'fixture-kyc-content',images:[{id:'document-front'},{id:'selfie'}],review:{decision:'APPROVED',actorId:'other-reviewer',recordedAt:binding.kycReviewedAt}},channelIdentity:{binding}}}};
 const routeId='company_route_'+digest([member.organizationId,connection.id,importSenderHmac(connection)]),promptId='customer_webhook_'+digest('durable-field-prompt'),nonce='1'.repeat(20);
 const route={id:routeId,epoch:4,actorId:member.actorId,membershipId:member.membershipId,projectId:worker.projectId,workerId:worker.id,assignmentRevision:2,bindingId:binding.id,encryptedState:seal({phase:routePhase,...(routePhase==='CONFIRM'?{nonce:'3'.repeat(20),choices:[{value:worker.id,assignmentRevision:worker.assignmentRevision,bindingId:binding.id}]}:{}),expiresAt:new Date(Date.now()+routeExpiresIn).toISOString()},'company-route',routeId)};
 const state={purpose:fieldPurpose,step:'MEDIA',taskId:'task-b',sectorId:'sector-b',nonce,choices:[{value:'MEDIA',title:'Enviar evidencia'}],lastEventId:promptId,lastMessageTimestamp:'1',lastReceivedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+fieldExpiresIn).toISOString(),bindingId:binding.id};
 worker.metadata.fieldChannelConversation={version:1,...state,encryptedState:seal(state,'field-conversation',worker.id,worker.projectId)};
 workerChange(worker);
 const prompt={routeId,routeEpoch:route.epoch,workerId:worker.id,projectId:worker.projectId,bindingId:binding.id,actorId:member.actorId,membershipId:member.membershipId};promptChange(prompt);
 const outboundId=customerOutboundId(promptId),request={organizationId:member.organizationId,channelId:connection.id,targetProjectId:worker.projectId,sourceRouteId:promptId};requestChange(request);
 const outbound={id:outboundId,payload:{requestDigest:digest(request),encryptedPayload:seal(request,'outbound',outboundId)},outcome:{messageId:'wamid.currentprompt123456'}},projections=new Map(),queries=[];let io=0;
 async function query(sql,args=[]){
  queries.push(sql);
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL')||sql.startsWith('SELECT pg_advisory'))return rows([]);
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date()}]);
  if(sql.includes('to_regclass'))return rows([{present:true,count:1}]);
  if(sql.startsWith('SELECT\n  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('))return rows([{columns:[],keys:[],indexes:[],triggers:[]}]);
  if(sql.includes('count(*)::int AS count FROM information_schema.columns'))return rows([{count:1}]);
  if(sql.startsWith('SELECT version,contract,"catalogFingerprint",'))return rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]}),currentCatalog:{columns:[],keys:[],indexes:[],triggers:[]},catalog:args[1].map(conname=>({conname,convalidated:true})),indexes:args[2].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})),triggers:args[3].map(tgname=>({tgname,tgenabled:'O'}))}]);
  if(sql.includes('FROM public."WhatsAppCompanySchema"'))return rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]})}]);
  if(sql.includes('SELECT conname,convalidated'))return rows(args[0].map(conname=>({conname,convalidated:true})));
  if(sql.includes('SELECT c.relname,i.indisvalid,i.indisready,i.indisunique FROM pg_index'))return rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));
  if(sql.includes('SELECT tgname,tgenabled FROM pg_trigger'))return rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));
  if(sql.includes('information_schema.columns')||sql.includes('pg_get_constraintdef')||sql.includes('pg_get_indexdef')||sql.includes('pg_get_triggerdef'))return rows([]);
  if(sql.includes('SELECT "eventType"'))throw Object.assign(new Error('Controlled field delegation boundary'),{code:'CONTROLLED_FIELD_DELEGATION'});
  if(sql.includes('FROM public."WebhookEvent"'))return rows(args[0]===current.id?[current]:args[0]===origin.id?[origin]:args[0]===outboundId?[outbound]:[]);
  if(sql.includes('FROM public."WhatsAppConnection"'))return rows([connection]);
  if(sql.includes('SELECT w.*'))return rows([worker]);
  if(sql.includes('FROM public."PlatformUser"'))return rows([{id:member.actorId,clerkUserId:member.clerkUserId}]);
  if(sql.includes('FROM public."TenantMembership"'))return rows(membership?[member]:[]);
  if(sql.includes('FROM public."ProjectMembership"'))return rows(assigned?[{id:'pm-b'}]:[]);
  if(sql.includes('FROM public."Project"'))return rows([{id:args[0],organizationId:member.organizationId,name:'Project '+args[0],status:'ACTIVE',metadata:{}}]);
  if(sql.includes('FROM public."Worker"'))return rows([worker]);
  if(sql.includes('FROM public."AuditLog"'))return rows(sql.includes("kind'='REVIEW_KYC'")?[{id:'review-kyc',metadata:{}}]:sql.includes("kind'='KYC_SUBMITTED'")?[{id:'submit-kyc',metadata:{contentHash:worker.metadata.participant.kyc.contentHash}}]:[{metadata:{projectId:worker.projectId,bindingId:binding.id,proofPayloadDigest:binding.proofPayloadDigest}}]);
  if(sql.includes('FROM public."WhatsAppCompanyChannel"'))return rows([{connectionId:connection.id,anchorProjectId:connection.projectId,mode:'COMPANY',revision:7}]);
  if(sql.includes('FROM public."WhatsAppChannelProjectAssignment"'))return rows([{revision:2}]);
  if(sql.includes('FROM public."WhatsAppCompanyRoute"'))return rows([route]);
  if(sql.includes('FROM public."WhatsAppCompanyEventRoute"'))return rows(sql.includes('SELECT "routeId"')?[prompt]:projections.has(args[0])?[projections.get(args[0])]:[]);
  if(sql.startsWith('INSERT INTO public."WhatsAppCompanyRoute"')){route.epoch=args[6];route.projectId=args[7];route.workerId=args[8];route.assignmentRevision=args[9];route.bindingId=args[10];route.encryptedState=args[11];return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO public."WhatsAppCompanyEventRoute"')){projections.set(args[0],{kind:args[4],projectId:args[9],workerId:args[10]});return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."WhatsAppCompanyEventRoute"')){projections.get(args[0]).encryptedResult=args[1];return {rows:[],rowCount:1};}
  throw Error('Unexpected selector SQL: '+sql);
 }
 const bridge=createCompanyChannelBridge({connect:async()=>({query,release:()=>{}}),environment,provider:{downloadMedia:async()=>{io++;throw Error('No provider I/O authorized');}}});
 return {bridge,context:{eventId:current.id,projectId:current.projectId,channelId:connection.id,payloadDigest:current.payload.payloadDigest,leaseToken:current.leaseToken},projection:()=>projections.get(current.id),io:()=>io,queries,worker,nonce};
}
function importSenderHmac(connection){return createHmac('sha256',Buffer.from(environment.META_CUSTOMER_CREDENTIALS_KEY,'base64')).update(JSON.stringify(['company-sender-v1',connection.organizationId,connection.id,'+5491100001111'])).digest('hex');}

const menuFacts=({attendance=false,report=false,attendanceOnly=false,role='AUDITOR'}={})=>({projectName:'Obra sintética',projectId:'project-b',workerId:'worker-b',permissions:{attendance,report},attendanceOnly,planImportRole:role,latest:null,tasks:[],sectors:[],inventory:{materials:[{id:'material-a',active:true}]},evidence:[],proposals:[]});
for(const [name,options]of [['report only',{report:true}],['attendance only',{attendance:true,attendanceOnly:true}],['both permissions',{attendance:true,report:true}],['neither permission',{}],['administrator',{role:'ADMIN'}],['director',{role:'DIRECTOR'}]])test('accented menu preserves every current planner capability for '+name,()=>{
 const facts=menuFacts(options),plan=body=>planMetaFieldConversation({message:{type:'text',text:{body}},facts,eventId:'synthetic-menu-source'}),baseline=plan('MENU');assert.equal(metaFieldConversationAction('  menú  '),'MENU');assert.deepEqual(plan('  menú  '),baseline);assert.deepEqual(plan('MENÚ'),baseline);
 const titles=baseline.reply.sections.flatMap(section=>section.rows).map(row=>row.title);if(!options.attendance)assert.ok(!titles.includes('Entrada'));if(!options.report)for(const title of ['Enviar evidencia','Proponer consumo','Proponer avance'])assert.ok(!titles.includes(title));if(options.attendanceOnly)assert.ok(!titles.includes('Cronograma y tareas'));assert.ok(!titles.some(title=>/aprobar|administrar|roles|identidad|banco/i.test(title)));if(['ADMIN','DIRECTOR'].includes(options.role))assert.ok(titles.includes('Importar cronograma'));else assert.ok(!titles.includes('Importar cronograma'));
});
for(const body of ['MENU','MENÚ','  menú  '])test('company selector accepts '+body+' as the same current menu before the FIELD boundary',async()=>{
 const f=routingFixture({type:'text',text:{body}},{fieldPurpose:'MENU'}),before=structuredClone(f.worker);await assert.rejects(()=>f.bridge.execute(f.context),{code:'CONTROLLED_FIELD_DELEGATION'});assert.equal(f.projection().kind,'FIELD');assert.deepEqual(f.worker,before);assert.equal(f.io(),0);
});
for(const body of ['MENU','MENÚ'])test('company '+body+' never erases an existing media draft without explicit cancellation',async()=>{
 const f=routingFixture({type:'text',text:{body}}),before=structuredClone(f.worker),result=await f.bridge.execute(f.context);assert.equal(result.kind,'WORKSITE_DRAFT_PENDING');assert.match(result.reply.body,/Conservamos el borrador/);assert.deepEqual(f.worker,before);assert.equal(f.io(),0);
});
for(const body of ['MENU','MENÚ'])test('company '+body+' does not revive an expired worksite selection',async()=>{
 const f=routingFixture({type:'text',text:{body}},{fieldPurpose:'MENU',routeExpiresIn:-1000}),before=structuredClone(f.worker),result=await f.bridge.execute(f.context);assert.equal(result.kind,'WORKSITE_SELECTION_REQUIRED');assert.deepEqual(f.worker,before);assert.equal(f.io(),0);
});
for(const options of [{membership:false},{assigned:false}])test('accented menu keeps revoked '+Object.keys(options)[0]+' closed before dispatch',async()=>{
 const f=routingFixture({type:'text',text:{body:'MENÚ'}},{fieldPurpose:'MENU',...options});await assert.rejects(()=>f.bridge.execute(f.context));assert.equal(f.io(),0);assert.equal(f.projection(),undefined);
});
test('extra text is not normalized into an authorized menu command',async()=>{
 assert.equal(metaFieldConversationAction('MENÚ extra'),null);const f=routingFixture({type:'text',text:{body:'MENÚ extra'}},{fieldPurpose:'MENU'}),result=await f.bridge.execute(f.context);assert.equal(result.kind,'WORKSITE_INPUT_CONTEXT_REQUIRED');assert.equal(f.io(),0);
});
// A greeting typed the way people write it opens the same menu as the exact HOLA; anything
// beyond a greeting keeps its own text so free answers are never read as the menu command.
test('everyday greetings open the menu like HOLA and nothing else is normalized',async()=>{
 for(const body of ['HOLA','hola','Hola!','¡Hola!','hola buenas','Hola, buen día','Buenas tardes','buenos dias','Holaaa','HOLA QUÉ TAL','  hola...  '])assert.equal(metaInboundCommandText(body),'HOLA',body);
 for(const body of ['hola juan','buenas, necesito material','HOLA MENU','hola 2','Holanda','ESTADO','menú'])assert.notEqual(metaInboundCommandText(body),'HOLA',body);
 assert.equal(metaInboundCommandText('menú'),'MENÚ');assert.equal(metaInboundCommandText(undefined),null);assert.equal(metaInboundCommandText(42),null);
 assert.equal(metaFieldConversationAction('Hola!'),'MENU');assert.equal(metaFieldConversationAction('hola buenas'),'MENU');assert.equal(metaFieldConversationAction('hola juan'),null);
 for(const body of ['Hola!','hola buenas']){const f=routingFixture({type:'text',text:{body}},{fieldPurpose:'MENU',routeExpiresIn:-1000}),before=structuredClone(f.worker),result=await f.bridge.execute(f.context);assert.equal(result.kind,'WORKSITE_SELECTION_REQUIRED',body);assert.deepEqual(f.worker,before);assert.equal(f.io(),0);}
 const f=routingFixture({type:'text',text:{body:'hola juan'}},{fieldPurpose:'MENU'}),result=await f.bridge.execute(f.context);assert.equal(result.kind,'WORKSITE_INPUT_CONTEXT_REQUIRED');assert.equal(f.io(),0);
});
test('confirmed company selection describes the separate identity flow without claiming KYC unavailable',async()=>{
 const f=routingFixture({type:'interactive',interactive:{list_reply:{id:'empresa:'+'3'.repeat(20)+':0'}}},{fieldPurpose:'MENU',routePhase:'CONFIRM'}),before=structuredClone(f.worker),result=await f.bridge.execute(f.context);assert.equal(result.kind,'WORKSITE_SELECTED');assert.match(result.reply.body,/La identidad tiene su recorrido separado y no concede permisos/);assert.doesNotMatch(result.reply.body,/KYC.*no están habilitados/);assert.match(result.reply.body,/Flow no está habilitado/);assert.deepEqual(f.worker,before);assert.equal(f.io(),0);
});
test('a loose document still cannot become identity capture or a plan import',async()=>{
 const f=routingFixture({type:'document',document:{id:'150000999',mime_type:'application/pdf'}},{fieldPurpose:'MENU'}),before=structuredClone(f.worker),result=await f.bridge.execute(f.context);assert.equal(result.kind,'COMPANY_ADAPTER_DISABLED');assert.match(result.reply.body,/un archivo suelto no la presenta/);assert.match(result.reply.body,/sólo después de elegir Importar cronograma y responder a su mensaje vigente/);assert.deepEqual(f.worker,before);assert.equal(f.io(),0);
});
