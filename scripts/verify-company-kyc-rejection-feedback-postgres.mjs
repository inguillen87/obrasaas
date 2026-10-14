import assert from 'node:assert/strict';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {Client,Pool} from 'pg';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {createParticipantKycChatAttemptReader} from '../src/lib/participant-kyc-chat-attempt.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {createMetaKycRejection,META_KYC_REJECTION_REPLY} from '../src/lib/meta-kyc-rejection.mjs';
import {META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {createMetaCustomerOutbound,customerOutboundId,customerJobTransaction,recordCustomerOutboundDiagnostic,readCustomerOutboundDiagnostic} from '../src/lib/meta-customer-outbound.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {COMPANY_CHANNEL_SCHEMA_SQL,COMPANY_CHANNEL_SCHEMA_CONTRACT,companyChannelCatalogFingerprint,companyChannelSchemaReady} from '../src/lib/company-channel-schema.mjs';
import {companyKycProjectionId,companyKycProjectionDigest} from '../src/lib/company-channel-kyc.mjs';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL} from './lib/company-channel-disposable-fixture.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';

export const COMPANY_KYC_REJECTION_FEEDBACK_PROOF_VERSION='company-kyc-rejection-feedback-postgres-v1';
export const COMPANY_KYC_REJECTION_SYNTHETIC_REPLY_COUNT=8;
export const COMPANY_KYC_REJECTION_FEEDBACK_CHECKS=Object.freeze([
 'signed-corporate-malformed-and-lowercase-code-without-context-receive-fixed-rejection',
 'fixed-rejection-keeps-private-worker-challenge-permissions-documents-and-business-ledgers-unchanged',
 'valid-format-wrong-code-is-the-same-fixed-rejection-for-registered-and-unknown-senders',
 'unrelated-unsigned-and-foreign-callbacks-never-trigger-a-fixed-rejection',
 'duplicate-signed-event-keeps-original-receipt-and-performs-no-second-send',
 'SEND_UNKNOWN-and-expired-SEND_STARTED-markers-never-repeat-the-transport',
 'current-admin-channel-revision-and-reply-window-fences-deny-before-transport',
 'real-rejection-and-corporate-capture-receipts-observe-exact-signed-status-and-current-reader-authority',
]);

export function companyKycRejectionFeedbackDisposableUrl(environment={}){
 const fail=()=>{throw Object.assign(new Error('COMPANY_KYC_REJECTION_DISPOSABLE_TARGET_REJECTED'),{code:'COMPANY_KYC_REJECTION_DISPOSABLE_TARGET_REJECTED'});};
 let target;try{target=new URL(environment.CUTOVER_TEST_DATABASE_URL);}catch{fail();}
 if(environment.CUTOVER_TEST_DISPOSABLE!=='1'||environment.VERCEL||environment.VERCEL_ENV||environment.VERCEL_TARGET_ENV||!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','localhost'].includes(target.hostname)||!['5432','6549'].includes(target.port)||target.username!=='cutover_test'||target.pathname!=='/obrasaas_cutover_ci'||target.search||target.hash||(target.port==='6549'?target.password!=='':!['','cutover_test'].includes(target.password)))fail();
 return target;
}
const sha=value=>createHash('sha256').update(value).digest('hex');
const ownedDatabase=name=>assert.match(name,/^obrasaas_company_kyc_rejection_[a-f0-9]{32}$/);
const producer='scripts/verify-company-kyc-rejection-feedback-postgres.mjs';
let failureContext={stage:'TARGET_GUARD',checkGroup:null,completedCheckCount:0,poolClosed:false,databaseRemoved:false};
const failureStages=new Set(['TARGET_GUARD','SOURCE_SNAPSHOT','SETUP','CHECK','FINAL_ASSERTIONS','CLEANUP','SOURCE_FENCE','WRITE_PROOF']);
const publicFailureScalars=new Set(['PENDING','PROCESSED','SENT','SEND_UNKNOWN','SEND_STARTED','STATUS_OBSERVED','KYC_REJECTION','KYC_CHAT','KYC_CAPTURE','API_ACCEPTED','READ','UNAVAILABLE','NOT_SUBMITTED','COMPANY','SUSPENDED','ACTIVE','DISABLED','META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED','META_CUSTOMER_OUTBOUND_STATUS_CONFLICT','WORKSPACE_MEMBERSHIP_REQUIRED']);
// Preserve causal fixture diagnostics, never an assertion's object dump, SQL,
// credentials, callback body or environment. Locations are relative source lines.
export function companyKycRejectionFeedbackFailure(error,{root=process.cwd(),context=failureContext}={}){
 const code=/^(?:[A-Z][A-Z0-9_]{1,99}|[0-9]{2}[0-9A-Z]{3})$/.test(error?.code||'')?error.code:'COMPANY_KYC_REJECTION_FIXTURE_UNCONFIRMED';
 const first=typeof error?.message==='string'?error.message.split(/\r?\n/,1)[0]:'';
 const assertionMessage=code!=='ERR_ASSERTION'?null:first.startsWith('Expected values to be')?'Expected values to match.':first.startsWith('The expression evaluated to a falsy value:')?'The required fixture condition was false.':first.startsWith('The input did not match')?'The input did not match the required fixture expression.':first==='CI native evidence requires committed clean source'?first:null;
 const normalizedRoot=path.resolve(root).replaceAll('\\','/'),locations=[];
 for(const raw of String(error?.stack||'').split('\n')){if(!/^\s*at\s/.test(raw))continue;let line;try{line=decodeURIComponent(raw.replaceAll('\\','/'));}catch{continue;}const start=line.indexOf(normalizedRoot+'/');if(start<0)continue;const match=/^((?:src|scripts|tests)\/[^():]+\.(?:mjs|js)):(\d+):(\d+)\)?$/.exec(line.slice(start+normalizedRoot.length+1).trim());if(match&&match[1].length<=240)locations.push(match[1]+':'+match[2]+':'+match[3]);if(locations.length===8)break;}
 const scalar=value=>typeof value==='boolean'||value===null||typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1000000000||typeof value==='string'&&publicFailureScalars.has(value);
 return {version:1,status:'FAIL',code,errorName:['AssertionError','Error','WorkspaceError','TypeError','RangeError','SyntaxError'].includes(error?.name)?error.name:'Error',assertionMessage,locations:[...new Set(locations)],stage:failureStages.has(context?.failedStage||context?.stage)?context.failedStage||context.stage:'TARGET_GUARD',checkGroup:COMPANY_KYC_REJECTION_FEEDBACK_CHECKS.includes(context?.checkGroup)?context.checkGroup:null,completedCheckCount:Number.isInteger(context?.completedCheckCount)&&context.completedCheckCount>=0&&context.completedCheckCount<=8?context.completedCheckCount:0,poolClosed:context?.poolClosed===true,databaseRemoved:context?.databaseRemoved===true,...(code==='ERR_ASSERTION'&&scalar(error.expected)?{expected:error.expected}:{}),...(code==='ERR_ASSERTION'&&scalar(error.actual)?{actual:error.actual}:{})};
}
// Parse every relative import/export and literal dynamic import. This walks .js
// dependencies too; merely copying the producer's direct .mjs imports is unsafe.
export function companyKycRejectionFeedbackSourceFiles(root=process.cwd()){
 const files=new Set(['package.json','package-lock.json']),workspace=path.resolve(root);
 const visit=file=>{
  assert.ok(file.startsWith('src/')||file.startsWith('scripts/'));assert.ok(path.resolve(workspace,file).startsWith(workspace+path.sep));if(files.has(file))return;files.add(file);
  const tree=parse(readFileSync(path.join(workspace,file),'utf8'),{sourceType:'module',plugins:['jsx'],createImportExpressions:true});
  const walk=node=>{if(!node||typeof node!=='object')return;
   const reference=['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)?node.source:node.type==='CallExpression'&&node.callee?.type==='Import'?node.arguments[0]:null;
   if(reference?.type==='StringLiteral'&&reference.value.startsWith('.'))visit(path.posix.normalize(path.posix.join(path.posix.dirname(file),reference.value)));
   if(node.type==='ImportExpression'||node.type==='CallExpression'&&node.callee?.type==='Import')assert.equal(reference?.type,'StringLiteral','Unbounded dynamic import in fixture closure: '+file);
   for(const value of Object.values(node))if(Array.isArray(value))for(const child of value)walk(child);else if(value&&typeof value==='object')walk(value);
  };walk(tree);
 };visit(producer);return [...files].sort();
}

export async function verifyCompanyKycRejectionFeedbackPostgres(environment=process.env){
 // This guard runs before constructing a connector or installing an HTTP trap.
 const target=companyKycRejectionFeedbackDisposableUrl(environment),database='obrasaas_company_kyc_rejection_'+randomUUID().replaceAll('-','');ownedDatabase(database);
 failureContext={stage:'SETUP',checkGroup:null,completedCheckCount:0,poolClosed:false,databaseRemoved:false};
 const admin=new Client({connectionString:target.toString(),connectionTimeoutMillis:5000}),checks=[];
 let connected=false,created=false,removed=false,pool,poolClosed=false,providerCalls=0,syntheticReplyCalls=0,mediaCalls=0,depositCalls=0,outboundReads=0,workerReads=0;
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{providerCalls++;throw new Error('COMPANY_KYC_REJECTION_UNCONTROLLED_HTTP_REJECTED');};
 try{
  await admin.connect();connected=true;assert.equal((await admin.query('SELECT current_database() AS db')).rows[0].db,'obrasaas_cutover_ci');
  ownedDatabase(database);await admin.query(`CREATE DATABASE "${database}"`);created=true;
  const fixtureUrl=new URL(target);fixtureUrl.pathname='/'+database;pool=trackDisposablePool(new Pool({connectionString:fixtureUrl.toString(),max:8,connectionTimeoutMillis:5000}));
  assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db,database);await pool.query(COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL);
  const channelEnvironment={META_APP_SECRET:'synthetic-company-kyc-callback-secret',META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,21).toString('base64')};
  const specs=[{id:'channel-a',projectId:'project-a',organizationId:'org-a',actorId:'owner',wabaId:'990001100000001',phoneId:'990001100000002'},{id:'channel-b',projectId:'project-b',organizationId:'org-b',actorId:'foreign',wabaId:'990001100000003',phoneId:'990001100000004'}];
  for(const channel of specs){
   const operationDigest=digest(['synthetic-company-kyc-activation',channel.id]),metadata={credentialFormat:'tenant-aad-v2',credentialOrganizationId:channel.organizationId,companyRoutingVersion:1,customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE',actorId:channel.actorId,operationDigest},customerVerification:{registered:true,expiresAt:null,scopes:['whatsapp_business_management','whatsapp_business_messaging']}};
   const token=encryptCustomerSecret('synthetic-not-a-provider-token',{organizationId:channel.organizationId,projectId:channel.projectId,purpose:'access-token',resourceId:channel.phoneId},channelEnvironment);
   await pool.query(`INSERT INTO "WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken",metadata) VALUES($1,$2,true,'CONNECTED',$3,$4,$5,$6::jsonb)`,[channel.id,channel.projectId,channel.phoneId,channel.wabaId,token,JSON.stringify(metadata)]);
   await pool.query(`INSERT INTO "AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'integration.whatsapp.customer.activated','WhatsAppConnection',$4,$5::jsonb)`,['activation-'+channel.id,channel.organizationId,channel.actorId,channel.id,JSON.stringify({version:1,projectId:channel.projectId,operationDigest,providerGrantVerified:true,phoneRegistered:true,appSubscribed:true})]);
  }
  await pool.query(COMPANY_CHANNEL_SCHEMA_SQL);await pool.query(`UPDATE "WhatsAppCompanyChannel" SET mode='COMPANY',revision=2`);
  await pool.query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES('project-target','org-a','Synthetic target worksite','ACTIVE','{}');
   INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES('owner-target','project-target','owner-m','ACTIVE'),('person-target','project-target','member','ACTIVE');
   INSERT INTO "WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId",status,revision) VALUES('channel-a','org-a','project-target','ACTIVE',3);
   INSERT INTO "Worker"(id,"projectId",name,phone,active,metadata) VALUES('worker-target','project-target','Synthetic registered worker','+5491100001111',true,'{"siteRegister":{"version":1,"job":"WORKER","source":"responsible-entry","identityStatus":"UNVERIFIED","channelVerified":false},"participant":{"version":1,"status":"ACTIVE","clerkUserId":"user_Person","permissions":{"attendance":false,"report":false},"invitation":null,"kyc":{"version":1,"status":"NOT_SUBMITTED"}}}');`);
  await pool.query(`INSERT INTO "WhatsAppCompanySchema"(id,version,contract,"catalogFingerprint") VALUES(1,1,$1,$2)`,[COMPANY_CHANNEL_SCHEMA_CONTRACT,await companyChannelCatalogFingerprint(pool)]);assert.equal(await companyChannelSchemaReady(pool),true);
  const connect=async()=>{const client=await pool.connect();return {release:broken=>client.release(broken),query:async(sql,args)=>{if(/^SELECT/.test(sql)&&sql.includes('public."WebhookEvent"')&&sql.includes("provider='meta-customer-outbound-v1'"))outboundReads++;if(/^SELECT/.test(sql)&&sql.includes('public."Worker"'))workerReads++;return client.query(sql,args);}};};
  const workspace=createWorkspaceStore({connect}),participants=createParticipantStore({workspace,connect,prepareKycChat:prepareMetaKycChallenge,readKycChatAttempt:createParticipantKycChatAttemptReader(),environment:channelEnvironment});
  const owner={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'},person={...owner,userId:'user_Person',organizationRole:'org:member'};
  const ownerScope=(await workspace.list(owner)).scope,personScope=(await workspace.list(person)).scope;
  const revision=(await pool.query(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Worker" WHERE id='worker-target'`)).rows[0].revision;
  const prepared=await participants.save(owner,{projectId:'project-target',scope:ownerScope,operationId:randomUUID(),action:'PREPARE_KYC_CHAT',payload:{workerId:'worker-target',revision}});assert.equal(prepared.codeUnavailable,false);assert.match(prepared.code,/^IDENTIDAD [A-Za-z0-9_-]{43}$/);
  const businessState=async()=>(await pool.query(`SELECT (SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM "Worker" w) workers,(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM "Project" p) projects,(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM "TenantMembership" m) memberships,(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM "ProjectMembership" m) assignments,(SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY id),'[]'::jsonb) FROM "Incident" i) incidents,(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM "AuditLog" a WHERE "entityType"='Worker') workerReceipts`)).rows[0];
  const noBusinessWrites=async run=>{const before=await businessState();try{return await run();}finally{assert.deepEqual(await businessState(),before);}};
  let transportMode='ACCEPT',reserveHook=async()=>{};const replies=[];
  const provider={async sendReply(options){if(options.beforeExternal)await options.beforeExternal();syntheticReplyCalls++;replies.push({to:options.to,replyTo:options.replyTo,message:options.message,correlationId:options.correlationId});if(transportMode==='UNKNOWN')throw new WorkspaceError('META_CUSTOMER_SEND_UNCONFIRMED',503);return {messageId:'wamid.SyntheticReply'+String(syntheticReplyCalls).padStart(12,'0')};},async downloadMedia(){mediaCalls++;throw new Error('UNEXPECTED_SYNTHETIC_MEDIA');}};
  const bridge=createMetaKycBridge({connect,provider,environment:channelEnvironment,deposit:{async recover(){depositCalls++;throw new Error('UNEXPECTED_SYNTHETIC_DEPOSIT');},async save(){depositCalls++;throw new Error('UNEXPECTED_SYNTHETIC_DEPOSIT');}}});
  const rejection=createMetaKycRejection({connect,provider,environment:channelEnvironment,afterReserve:()=>reserveHook()}),kycOutbound=createMetaKycOutbound({connect,provider,environment:channelEnvironment}),statusOutbound=createMetaCustomerOutbound({connect,provider,environment:channelEnvironment,resolveIdentity:async()=>{throw new Error('UNEXPECTED_FIELD_IDENTITY');}});
  const dispatched=new Map(),processor=createMetaCustomerProcessor({connect,environment:channelEnvironment,authorizationCodes:META_KYC_AUTHORIZATION_CODES,rejectedKyc:rejection.rejection,dispatch:async context=>{const value=await bridge.execute(context);dispatched.set(context.eventId,value);return value;},outbound:{send:(context,reply,options)=>options.purpose==='KYC_REJECTION'?rejection.send(context,reply):kycOutbound.send(context,reply,options),observeStatus:statusOutbound.observeStatus}});
  const inbox=createMetaCustomerInbox({connect,environment:channelEnvironment}),callback=createMetaCustomerCallbackHandlers({inbox,environment:channelEnvironment,schedule:()=>{},reportRejection:()=>{}});
  let sequence=0;const timestamp=()=>String(Math.ceil(Date.now()/1000)+ ++sequence);
  const payload=(value,channel=specs[0],status=false)=>({object:'whatsapp_business_account',entry:[{id:channel.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:channel.phoneId},[status?'statuses':'messages']:[value]}}]}]});
  const record=async(raw,{signed=true,status=200}={})=>{const bytes=Buffer.from(JSON.stringify(raw)),response=await callback.POST(new Request('https://synthetic.invalid/api/meta/customer-callback',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+(signed?createHmac('sha256',channelEnvironment.META_APP_SECRET).update(bytes).digest('hex'):'0'.repeat(64))},body:bytes}));assert.equal(response.status,status);if(status!==200)return null;return 'customer_webhook_'+splitMetaCustomerEvents(raw)[0].externalId;};
  const receive=async(text,{from='5491100001111',channel=specs[0],time=timestamp()}={})=>{const raw=payload({id:'wamid.SyntheticInbound'+randomUUID().replaceAll('-',''),from,timestamp:time,type:'text',text:{body:text}},channel);return {eventId:await record(raw),raw};};
  const process=async eventId=>{const value=await processor.recover({eventIds:[eventId]});assert.equal(value.checked,1);return value.results[0];};
  const outbound=async eventId=>(await pool.query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[customerOutboundId(eventId)])).rows[0];
  const reopen=async(eventId,{clearError=true}={})=>pool.query(`UPDATE "WebhookEvent" SET status='PENDING',"leaseToken"=NULL,"leaseExpiresAt"=NULL,"lastError"=CASE WHEN $2 THEN NULL ELSE "lastError" END WHERE id=$1`,[eventId,clearError]);
  const requestFor=row=>JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:'org-a',projectId:'project-a',purpose:'outbound',resourceId:row.id},channelEnvironment));
  const check=async(index,run)=>{failureContext.stage='CHECK';failureContext.checkGroup=COMPANY_KYC_REJECTION_FEEDBACK_CHECKS[index];await run();checks.push(COMPANY_KYC_REJECTION_FEEDBACK_CHECKS[index]);failureContext.completedCheckCount=checks.length;};let original,unknown,started;
  await check(0,async()=>{for(const text of ['IDENTIDAD short','identidad '+'x'.repeat(43),'IDENTIDAD']){const event=await receive(text),before=workerReads,result=await noBusinessWrites(()=>process(event.eventId));assert.equal(result.processed,true);assert.equal(result.kind,'KYC_REJECTION');assert.equal(result.code,'META_KYC_CHALLENGE_REJECTED');assert.equal(result.businessApplied,false);assert.equal(workerReads,before);const out=await outbound(event.eventId);assert.equal(out.outcome.state,'SENT');assert.deepEqual(requestFor(out).message,META_KYC_REJECTION_REPLY);original=event;}});
  await check(1,async()=>{assert.equal(mediaCalls,0);assert.equal(depositCalls,0);for(const reply of replies){assert.deepEqual(reply.message,META_KYC_REJECTION_REPLY);assert.doesNotMatch(reply.message.body,/5491100001111|worker-target|project-target|user_Person|Synthetic registered|APPROVED|PENDING/);}const row=(await pool.query(`SELECT metadata FROM "Worker" WHERE id='worker-target'`)).rows[0];assert.equal(row.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.equal(row.metadata.participant.kycChatChallenge.status,'PENDING');assert.deepEqual(row.metadata.participant.permissions,{attendance:false,report:false});assert.equal(row.metadata.participant.kycChatConversation,null);assert.equal((await pool.query(`SELECT count(*)::int AS count FROM "WhatsAppCompanyEventRoute"`)).rows[0].count,0);});
  await check(2,async()=>{const wrong=prepared.code.slice(0,-1)+(prepared.code.endsWith('A')?'B':'A');for(const from of ['5491100001111','5491100009999']){const event=await receive(wrong,{from}),result=await noBusinessWrites(()=>process(event.eventId));assert.equal(result.kind,'KYC_REJECTION');assert.equal(result.businessApplied,false);assert.deepEqual(requestFor(await outbound(event.eventId)).message,META_KYC_REJECTION_REPLY);assert.equal(replies.at(-1).to,from);}});
  await check(3,async()=>{const before=syntheticReplyCalls;for(const text of ['HOLA','IDENTIDADother']){const event=await receive(text),result=await noBusinessWrites(()=>process(event.eventId));assert.equal(result.processed,true);assert.notEqual(result.kind,'KYC_REJECTION');assert.equal(await outbound(event.eventId),undefined);}const invalid=payload({id:'wamid.SyntheticUnsigned'+randomUUID().replaceAll('-',''),from:'5491100001111',timestamp:timestamp(),type:'text',text:{body:'IDENTIDAD short'}});await record(invalid,{signed:false,status:403});const foreign=structuredClone(invalid);foreign.entry[0].id='990009900000001';foreign.entry[0].changes[0].value.metadata.phone_number_id='990009900000002';await record(foreign,{status:403});assert.equal(syntheticReplyCalls,before);});
  await check(4,async()=>{const before=syntheticReplyCalls,stored=await outbound(original.eventId);assert.equal(await record(original.raw),original.eventId);const result=await noBusinessWrites(()=>process(original.eventId));assert.equal(result.done,true);assert.equal(syntheticReplyCalls,before);assert.deepEqual(await outbound(original.eventId),stored);});
  await check(5,async()=>{
   transportMode='UNKNOWN';unknown=await receive('IDENTIDAD short');const result=await noBusinessWrites(()=>process(unknown.eventId));assert.equal(result.replyState,'SEND_UNKNOWN');assert.equal((await outbound(unknown.eventId)).outcome.state,'SEND_UNKNOWN');transportMode='ACCEPT';let before=syntheticReplyCalls;await pool.query(`UPDATE "WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE id=$1`,[customerOutboundId(unknown.eventId)]);await reopen(unknown.eventId);assert.equal((await noBusinessWrites(()=>process(unknown.eventId))).replyState,'SEND_UNKNOWN');assert.equal(syntheticReplyCalls,before);
   started=await receive('IDENTIDAD short');let firstDiagnostic;
   reserveHook=async()=>{
    const source=(await pool.query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[started.eventId])).rows[0],marker=await outbound(started.eventId),context={eventId:source.id,projectId:source.projectId,channelId:source.payload.channelId,payloadDigest:source.payload.payloadDigest,leaseToken:source.leaseToken},reserved={id:marker.id,leaseToken:marker.leaseToken,requestDigest:marker.payload.requestDigest,connection:specs[0]},input={reserved,context,phase:'AFTER_RESERVE',code:'META_CUSTOMER_INBOX_LEASE_CHANGED'};
    for(const crossed of [{...input,context:{...context,leaseToken:randomUUID()}},{...input,context:{...context,payloadDigest:'0'.repeat(64)}},{...input,reserved:{...reserved,leaseToken:randomUUID()}},{...input,reserved:{...reserved,requestDigest:'0'.repeat(64)}}])assert.equal(await customerJobTransaction(connect,client=>recordCustomerOutboundDiagnostic(client,crossed)),false);
    for(const mode of ['SOURCE_LEASE','SOURCE_DIGEST','REQUEST_DIGEST','OUTBOUND_LEASE'])await customerJobTransaction(connect,async client=>{
     const wrapped={query:async(sql,args)=>{
      if(sql.startsWith('UPDATE public."WebhookEvent" SET outcome=jsonb_set')){
       if(mode==='SOURCE_LEASE')await client.query(`UPDATE "WebhookEvent" SET "leaseToken"=$2 WHERE id=$1`,[source.id,randomUUID()]);
       if(mode==='SOURCE_DIGEST')await client.query(`UPDATE "WebhookEvent" SET payload=jsonb_set(payload,'{payloadDigest}',to_jsonb($2::text)) WHERE id=$1`,[source.id,'0'.repeat(64)]);
       if(mode==='REQUEST_DIGEST')await client.query(`UPDATE "WebhookEvent" SET payload=jsonb_set(payload,'{requestDigest}',to_jsonb($2::text)) WHERE id=$1`,[marker.id,'0'.repeat(64)]);
       if(mode==='OUTBOUND_LEASE')await client.query(`UPDATE "WebhookEvent" SET "leaseToken"=$2 WHERE id=$1`,[marker.id,randomUUID()]);
      }return client.query(sql,args);
     }};
     assert.equal(await recordCustomerOutboundDiagnostic(wrapped,input),false);assert.equal((await client.query(`SELECT outcome FROM "WebhookEvent" WHERE id=$1`,[marker.id])).rows[0].outcome.diagnostic,undefined);
     await client.query(`UPDATE "WebhookEvent" SET "leaseToken"=$2,payload=$3::jsonb WHERE id=$1`,[source.id,source.leaseToken,JSON.stringify(source.payload)]);await client.query(`UPDATE "WebhookEvent" SET "leaseToken"=$2,payload=$3::jsonb WHERE id=$1`,[marker.id,marker.leaseToken,JSON.stringify(marker.payload)]);
    });
    assert.equal((await outbound(started.eventId)).outcome.diagnostic,undefined);throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
   };
   before=syntheticReplyCalls;assert.equal((await noBusinessWrites(()=>process(started.eventId))).code,'META_CUSTOMER_INBOX_LEASE_CHANGED');reserveHook=async()=>{};assert.equal(syntheticReplyCalls,before);assert.equal((await outbound(started.eventId)).outcome.state,'SEND_STARTED');assert.equal((await pool.query(`SELECT "lastError" FROM "WebhookEvent" WHERE id=$1`,[started.eventId])).rows[0].lastError,'META_CUSTOMER_INBOX_LEASE_CHANGED');
   firstDiagnostic=readCustomerOutboundDiagnostic((await outbound(started.eventId)).outcome.diagnostic);assert.equal(firstDiagnostic.phase,'PROCESSING');assert.equal(firstDiagnostic.code,'META_CUSTOMER_INBOX_LEASE_CHANGED');assert.deepEqual(Object.keys(firstDiagnostic).sort(),['code','phase','recordedAt','version']);
   await pool.query(`UPDATE "WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE id=$1`,[customerOutboundId(started.eventId)]);before=syntheticReplyCalls;await reopen(started.eventId,{clearError:false});assert.equal((await noBusinessWrites(()=>process(started.eventId))).replyState,'SEND_STARTED');assert.equal(syntheticReplyCalls,before);assert.deepEqual(readCustomerOutboundDiagnostic((await outbound(started.eventId)).outcome.diagnostic),firstDiagnostic);assert.equal((await pool.query(`SELECT "lastError" FROM "WebhookEvent" WHERE id=$1`,[started.eventId])).rows[0].lastError,'META_CUSTOMER_INBOX_LEASE_CHANGED');
  });
  await check(6,async()=>{for(const [mutation,restore] of [[`UPDATE "TenantMembership" SET status='DISABLED' WHERE id='owner-m'`,`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='owner-m'`],[`UPDATE "WhatsAppCompanyChannel" SET mode='SUSPENDED',revision=3 WHERE "connectionId"='channel-a'`,`UPDATE "WhatsAppCompanyChannel" SET mode='COMPANY',revision=2 WHERE "connectionId"='channel-a'`]]){const event=await receive('IDENTIDAD short'),before=syntheticReplyCalls;reserveHook=()=>pool.query(mutation);try{const result=await process(event.eventId);assert.equal(result.replySent,false);assert.equal(result.replyState,'META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED');assert.equal(syntheticReplyCalls,before);assert.equal((await outbound(event.eventId)).outcome.state,'SEND_STARTED');}finally{reserveHook=async()=>{};await pool.query(restore);}await reopen(event.eventId);assert.equal((await noBusinessWrites(()=>process(event.eventId))).replyState,'SEND_STARTED');assert.equal(syntheticReplyCalls,before);}const before=syntheticReplyCalls,expired=await receive('IDENTIDAD short',{time:String(Math.floor(Date.now()/1000)-86401)}),result=await noBusinessWrites(()=>process(expired.eventId));assert.equal(result.replySent,false);assert.equal(await outbound(expired.eventId),undefined);assert.equal(syntheticReplyCalls,before);});
  await check(7,async()=>{
   const context={projectId:'project-target',scope:personScope,workerId:'worker-target',challengeId:prepared.challengeId};
   const observe=()=>noBusinessWrites(()=>participants.kycChatAttempt(person,context));
   const privateDto=value=>{assert.equal(value.detail,'kyc-chat-attempt');const reply=value.kycChatAttempt.replyDelivery;assert.deepEqual(Object.keys(reply).sort(),['recordedAt','state','version']);assert.doesNotMatch(JSON.stringify(value),/5491100001111|encrypted|wamid\.|SyntheticReply|IDENTIDAD|codeDigest|requestDigest/);return reply;};
   const status=async(event,{recipient=null,channel=specs[0],opaque=null}={})=>{const out=await outbound(event.eventId),request=requestFor(out);return record(payload({id:out.outcome.messageId,status:'read',timestamp:timestamp(),recipient_id:recipient||request.to,biz_opaque_callback_data:opaque||out.id},channel,true));};
   const rejected=await receive('IDENTIDAD short');assert.equal((await noBusinessWrites(()=>process(rejected.eventId))).kind,'KYC_REJECTION');assert.equal(privateDto(await observe()).state,'API_ACCEPTED');const outBefore=await outbound(rejected.eventId);
   const wrongRecipient=await status(rejected,{recipient:'5491100009999'});assert.equal((await noBusinessWrites(()=>process(wrongRecipient))).code,'META_CUSTOMER_OUTBOUND_STATUS_CONFLICT');assert.deepEqual(await outbound(rejected.eventId),outBefore);
   const wrongChannel=await status(rejected,{channel:specs[1]});assert.equal((await noBusinessWrites(()=>process(wrongChannel))).processed,true);assert.deepEqual(await outbound(rejected.eventId),outBefore);
   const valid=await status(rejected);assert.equal((await noBusinessWrites(()=>process(valid))).processed,true);const reply=privateDto(await observe());assert.equal(reply.state,'READ');assert.match(reply.recordedAt,/\.000Z$/);assert.equal((await outbound(rejected.eventId)).outcome.statusEventId,valid);
   const uncertain=await outbound(started.eventId),diagnostic=readCustomerOutboundDiagnostic(uncertain.outcome.diagnostic),uncertainRequest=requestFor(uncertain),beforeStatusCalls=syntheticReplyCalls;
   const observed=await record(payload({id:'wamid.SyntheticLateStatus0001',status:'delivered',timestamp:timestamp(),recipient_id:uncertainRequest.to,biz_opaque_callback_data:uncertain.id},specs[0],true));assert.equal((await noBusinessWrites(()=>process(observed))).processed,true);const settled=await outbound(started.eventId);assert.equal(settled.outcome.state,'STATUS_OBSERVED');assert.equal(settled.outcome.providerStatus,'delivered');assert.deepEqual(readCustomerOutboundDiagnostic(settled.outcome.diagnostic),diagnostic);assert.equal(syntheticReplyCalls,beforeStatusCalls);
   const before=outboundReads;try{await pool.query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id='member'`);await assert.rejects(()=>observe(),{code:'WORKSPACE_MEMBERSHIP_REQUIRED',status:403});assert.equal(outboundReads,before);}finally{await pool.query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='member'`);}
   const capture=await receive(prepared.code),result=await process(capture.eventId);assert.equal(result.kind,'KYC_CHAT');assert.equal(result.processed,true);assert.equal(result.businessApplied,false);const captured=await outbound(capture.eventId),request=requestFor(captured);assert.equal(request.channelPurpose,'KYC_CAPTURE');assert.equal(request.targetProjectId,'project-target');const projected=(await pool.query(`SELECT * FROM "AuditLog" WHERE id=$1`,[companyKycProjectionId(capture.eventId)])).rows[0];assert.equal(projected.entityId,'worker-target');assert.equal(projected.actorId,'person');assert.equal(projected.metadata.anchorProjectId,'project-a');assert.equal(projected.metadata.targetProjectId,'project-target');assert.equal(request.companyKycDigest,companyKycProjectionDigest(projected.metadata));assert.equal(captured.outcome.actorId,'person');assert.equal(privateDto(await observe()).state,'API_ACCEPTED');const delivered=await status(capture);assert.equal((await noBusinessWrites(()=>process(delivered))).processed,true);assert.equal(privateDto(await observe()).state,'READ');const row=(await pool.query(`SELECT metadata FROM "Worker" WHERE id='worker-target'`)).rows[0];assert.equal(row.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.deepEqual(row.metadata.participant.permissions,{attendance:false,report:false});assert.equal(mediaCalls,0);assert.equal(depositCalls,0);
  });
  failureContext.stage='FINAL_ASSERTIONS';assert.deepEqual(checks,COMPANY_KYC_REJECTION_FEEDBACK_CHECKS);assert.equal(syntheticReplyCalls,COMPANY_KYC_REJECTION_SYNTHETIC_REPLY_COUNT);assert.equal(providerCalls,0);assert.equal(mediaCalls,0);assert.equal(depositCalls,0);
 }catch(error){failureContext.failedStage=failureContext.stage;throw error;}finally{failureContext.stage='CLEANUP';try{if(pool){await closeDisposablePool(pool);poolClosed=true;failureContext.poolClosed=true;}if(created){ownedDatabase(database);assert.equal((await admin.query('SELECT current_database() AS db')).rows[0].db,'obrasaas_cutover_ci');assert.equal((await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1',[database])).rows[0].count,0);await admin.query(`DROP DATABASE "${database}"`);removed=(await admin.query('SELECT count(*)::int AS count FROM pg_database WHERE datname=$1',[database])).rows[0].count===0;failureContext.databaseRemoved=removed;assert.equal(removed,true);}}finally{try{if(connected)await admin.end();}finally{globalThis.fetch=originalFetch;}}}
 assert.equal(created,true);assert.equal(poolClosed,true);assert.equal(removed,true);
 return {version:COMPANY_KYC_REJECTION_FEEDBACK_PROOF_VERSION,status:'PASS',environment:'local-disposable-postgresql',postgresExecuted:true,providerCalls,syntheticReplyCalls,realIdentityDocuments:false,productionDataWritten:false,identityCertified:false,permissionsGranted:false,mediaCalls,depositCalls,poolClosed,databaseRemoved:removed,totalCheckCount:checks.length,checks};
}
async function main(){
 // Reject a target before parsing source, opening SQL or installing fetch.
 companyKycRejectionFeedbackDisposableUrl(process.env);
 failureContext.stage='SOURCE_SNAPSHOT';
 const root=process.cwd(),git=args=>execFileSync('git',args,{encoding:'utf8'}).trim(),sourceRevision=git(['rev-parse','HEAD']),sourceTree=git(['rev-parse','HEAD^{tree}']),trackedClean=git(['status','--porcelain','--untracked-files=no'])==='';if(process.env.CI==='true')assert.equal(trackedClean,true,'CI native evidence requires committed clean source');
 const sourceManifest=companyKycRejectionFeedbackSourceFiles(root).map(file=>({path:file,sha256:sha(readFileSync(path.join(root,file)))})),proof=await verifyCompanyKycRejectionFeedbackPostgres();
 failureContext.stage='SOURCE_FENCE';assert.equal(git(['rev-parse','HEAD']),sourceRevision);assert.equal(git(['rev-parse','HEAD^{tree}']),sourceTree);for(const ref of sourceManifest)assert.equal(sha(readFileSync(path.join(root,ref.path))),ref.sha256,'Fixture source changed during native execution: '+ref.path);if(process.env.CI==='true')assert.equal(git(['status','--porcelain','--untracked-files=no']),'');
 const result={...proof,sourceRevision,sourceTree,trackedClean,sourceState:process.env.CI==='true'?'EXACT_CI_SOURCE':'LOCAL_REVIEW_SOURCE',sourceManifest,harnessSha256:sha(readFileSync(fileURLToPath(import.meta.url)))};
 failureContext.stage='WRITE_PROOF';const output=path.join(root,'.vercel/private/company-kyc-rejection-feedback-postgres.json');mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{const failure=companyKycRejectionFeedbackFailure(error);try{companyKycRejectionFeedbackDisposableUrl(process.env);const output=path.join(process.cwd(),'.vercel/private/company-kyc-rejection-feedback-postgres-failure.json');mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(failure,null,2)+'\n');}catch{/* An unauthorized target never produces a fixture file. */}console.error(JSON.stringify(failure));process.exitCode=1;});
