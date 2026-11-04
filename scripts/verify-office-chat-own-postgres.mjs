// Proposed native PostgreSQL verifier. Source-only until Root reviews the
// harness and separately owns a NEW local cluster. It starts/stops no server.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {setTimeout as wait} from 'node:timers/promises';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function isRepositorySourcePath(value) {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('/') &&
    !/[\\:\u0000-\u001f]/u.test(value) &&
    value.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..' && !/[. ]$/u.test(segment));
}

const root=fileURLToPath(new URL('../',import.meta.url));assert.equal(path.resolve(process.cwd()),path.resolve(root),'Native fixture cwd must be its isolated checkout');
const args=process.argv.slice(2);
let binding,server,sourceManifest,beforeSources,sources,output,save,officeCiConnection;
if(args[0]==='--github-actions-service'){
 const ci=await import('./lib/office-chat-native-ci-context.mjs');officeCiConnection=ci.officeCiConnection;
 ({binding,server,sourceManifest,beforeSources,sources,output,save}=await ci.loadOfficeNativeCiContext({variant:'own',argv:args,entryUrl:import.meta.url}));
}else{
 ({binding,server,sourceManifest,beforeSources,sources,output,save}=(()=>{
assert.equal(args.length,4,'Explicit reviewed binding required');assert.equal(args[0],'--binding');assert.equal(args[2],'--sha256');assert.match(args[3],/^[a-f0-9]{64}$/);
assert.equal(process.version,'v24.21.0');assert.equal(process.execArgv.length,0);assert.equal(hash(readFileSync(process.execPath)),'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');assert.equal(process.env.TZ,'UTC');assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone,'UTC');
for(const key of ['DATABASE_URL','PGHOST','PGPORT','PGPASSWORD','PGSERVICE','PGPASSFILE','PGSERVICEFILE','VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV','META_APP_SECRET','META_CUSTOMER_CREDENTIALS_KEY','CUTOVER_TEST_DATABASE_URL','NODE_OPTIONS','NODE_PATH'])assert(!process.env[key],'No inherited provider/DB configuration');
const bindingBytes=readFileSync(args[1]);assert.equal(hash(bindingBytes),args[3]);const binding=JSON.parse(bindingBytes);
assert.equal(binding.schema,'reviewed-office-chat-own-native-pg.v1');
assert.deepEqual(Object.keys(binding).sort(),['rootApproval','runDirectory','schema','server','sourceManifest']);
assert.deepEqual(Object.keys(binding.rootApproval).sort(),['path','sha256']);const approvedBytes=readFileSync(binding.rootApproval.path);assert.equal(hash(approvedBytes),binding.rootApproval.sha256);
const approval=JSON.parse(approvedBytes);assert.equal(approval.status,'ROOT_APPROVED_SINGLE_NATIVE_OFFICE_OWN_PG_INVOCATION');assert.equal(approval.bindingPayloadSha256,hash(Buffer.from(JSON.stringify({schema:binding.schema,runDirectory:binding.runDirectory,server:binding.server,sourceManifest:binding.sourceManifest}))));assert.equal(approval.harnessSha256,hash(readFileSync(fileURLToPath(import.meta.url))));
const server=binding.server;assert.deepEqual(Object.keys(server).sort(),['dataDirectory','host','pid','port','systemIdentifier','user']);assert.equal(server.host,'127.0.0.1');assert(Number.isSafeInteger(server.port)&&server.port>1024&&server.port<65536&&!new Set([11790,5432,6549,6559]).has(server.port));assert.equal(server.user,'office_chat_synthetic');assert(typeof server.dataDirectory==='string'&&path.isAbsolute(server.dataDirectory));assert.equal(path.basename(server.dataDirectory),'owned-data');assert.match(path.basename(path.dirname(server.dataDirectory)),/^office-chat-496-pg-owned-[a-z0-9-]+$/);assert.match(server.systemIdentifier,/^[0-9]{10,22}$/);assert(Number.isSafeInteger(server.pid)&&server.pid>0);
assert.deepEqual(Object.keys(binding.sourceManifest).sort(),['path','sha256']);const sourceBytes=readFileSync(binding.sourceManifest.path);assert.equal(hash(sourceBytes),binding.sourceManifest.sha256);const sourceManifest=JSON.parse(sourceBytes);assert.equal(path.resolve(sourceManifest.sourceRoot),path.resolve(root));assert.equal(sourceManifest.schema,'office-chat-own-native-pg-execution-inputs.v1');const sourceFileCount=Object.hasOwn(approval,'sourceFileCount')?approval.sourceFileCount:344;assert(Number.isSafeInteger(sourceFileCount)&&sourceFileCount>=344,'Approved source file count must be a safe integer of at least 344');assert(Array.isArray(sourceManifest.files)&&sourceManifest.files.length===sourceFileCount,'Source manifest must match the exact approved source file count');assert(sourceManifest.files.some(row=>row.path==='scripts/verify-office-chat-own-postgres.mjs'&&row.sha256===hash(readFileSync(fileURLToPath(import.meta.url)))));
assert.equal(new Set(sourceManifest.files.map(row=>row.path)).size,sourceManifest.files.length);
const sources=()=>sourceManifest.files.map(row=>{assert.deepEqual(Object.keys(row).sort(),['bytes','path','sha256']);assert(Number.isSafeInteger(row.bytes)&&row.bytes>0);assert.match(row.sha256,/^[a-f0-9]{64}$/);assert(isRepositorySourcePath(row.path),'Safe repository-relative source path required');const bytes=readFileSync(path.join(root,row.path));assert.equal(bytes.length,row.bytes,row.path);assert.equal(hash(bytes),row.sha256,row.path);return {path:row.path,bytes:bytes.length,sha256:hash(bytes)};});const beforeSources=sources();
const output=path.resolve(binding.runDirectory),privateRoot='C:/Users/guill/Documents/Codex/2026-11-02';assert(output.startsWith(path.resolve(privateRoot)+path.sep));assert(!output.startsWith(path.resolve(root)+path.sep));const outputParent=realpathSync(path.dirname(output)),realPrivateRoot=realpathSync(privateRoot);assert(outputParent===realPrivateRoot||outputParent.startsWith(realPrivateRoot+path.sep));assert(!existsSync(output),'Native output is create-only');const pidFile=readFileSync(path.join(server.dataDirectory,'postmaster.pid'),'utf8').split('\n');assert.equal(Number(pidFile[0]),server.pid);assert.equal(path.resolve(pidFile[1]).toLowerCase(),path.resolve(server.dataDirectory).toLowerCase());assert.equal(Number(pidFile[3]),server.port);mkdirSync(output);
const save=(name,value)=>writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
return {binding,server,sourceManifest,beforeSources,sources,output,save};
 })());
}
let externalNetworkAttempts=0,ownedLocalConnections=0;
const net=await import('node:net'),http=await import('node:http'),https=await import('node:https');
const originalConnect=net.Socket.prototype.connect,originalFetch=globalThis.fetch,originalHttp={request:http.default.request,get:http.default.get},originalHttps={request:https.default.request,get:https.default.get};
const denyNetwork=()=>{externalNetworkAttempts++;throw Object.assign(new Error('EXTERNAL_NETWORK_FORBIDDEN'),{code:'EXTERNAL_NETWORK_FORBIDDEN'});};
net.Socket.prototype.connect=function(...values){const opts=values[0]&&typeof values[0]==='object'?values[0]:{port:values[0],host:values[1]};if(Number(opts.port)!==server.port||opts.host!=='127.0.0.1')return denyNetwork();ownedLocalConnections++;return originalConnect.apply(this,values);};
globalThis.fetch=denyNetwork;http.default.request=http.default.get=denyNetwork;https.default.request=https.default.get=denyNetwork;
const {Client,Pool}=await import('pg');
const [{COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL},{executeCompanyChannelAdoption},{createWorkspaceStore},{createCanonicalParticipantKycFixture},{createFieldOperations},{createWorkerChannelStore,resolveWorkerChannelIdentity},{createCompanyChannelStore},{createMetaFieldBridge,readMetaFieldConversation},{createCompanyChannelBridge,resolveCompanyEnvelope,resolveCompanyOutboundIdentity,companyPreparedMediaRecovery},{createMetaCustomerInbox,createMetaCustomerCallbackHandlers,splitMetaCustomerEvents},{createMetaCustomerProcessor,createMetaCustomerProductionProcessor},{createMetaCustomerOutbound,customerJobTransaction,customerOutboundId},{createOfficeChatStore,createOfficeChatBridge,OFFICE_CHAT_SQL},{OFFICE_CHAT_ACTION,OFFICE_CHAT_AUTHORIZATION_CODES,OFFICE_CHAT_TTL_MS,officeChatCodeHash},{decryptCustomerSecret},{createMetaKycBridge},{createMetaKycOutbound},{createMetaKycRejection},{createMetaKycExpiryFeedback},{createMetaKycContextFeedback},{createMetaCustomerAppProjection},{META_KYC_AUTHORIZATION_CODES},{EMPLOYEE_INTAKE_AUTHORIZATION_CODES},{metaPreparedPlanRecovery}]=await Promise.all([
 import('./lib/company-channel-disposable-fixture.mjs'),import('./lib/company-channel-migration.mjs'),import('../src/lib/workspace-store.mjs'),import('./fixtures/canonical-participant-kyc.mjs'),import('../src/lib/field-operations-store.mjs'),import('../src/lib/worker-channel-identity.mjs'),import('../src/lib/company-channel-store.mjs'),import('../src/lib/meta-field-bridge.mjs'),import('../src/lib/company-channel-routing.mjs'),import('../src/lib/meta-customer-callback.mjs'),import('../src/lib/meta-customer-processing.mjs'),import('../src/lib/meta-customer-outbound.mjs'),import('../src/lib/office-chat-store.mjs'),import('../src/lib/office-chat-policy.mjs'),import('../src/lib/meta-customer-credentials.mjs'),import('../src/lib/meta-kyc-bridge.mjs'),import('../src/lib/meta-kyc-outbound.mjs'),import('../src/lib/meta-kyc-rejection.mjs'),import('../src/lib/meta-kyc-expiry-feedback.mjs'),import('../src/lib/meta-kyc-context-feedback.mjs'),import('../src/lib/meta-customer-app-projection.mjs'),import('../src/lib/meta-kyc-identity.mjs'),import('../src/lib/meta-employee-intake.mjs'),import('../src/lib/meta-plan-import-recovery.mjs')
]);
const [{ownCompanyFixture},{createOwnCompanyConnection},{createMetaCustomerProvider},{META_OWN_COMPANY_AUTHORIZATION_CODES},{trackDisposablePool,closeDisposablePool}]=await Promise.all([import('../tests/fixtures/own-company-meta.mjs'),import('../src/lib/meta-own-company-connection.mjs'),import('../src/lib/meta-customer-provider.mjs'),import('../src/lib/meta-own-company-policy.mjs'),import('./lib/disposable-postgres-cleanup.mjs')]);

const expectedChecks=['own-canonical-bootstrap-navigation-and-durable-replay','own-wrong-sender-session-and-channel-no-grant','own-source-lease-expires-under-real-channel-lock','own-existing-worker-FIELD-draft-survives-office-return','own-current-issuer-audit-and-ciphertext-revalidated'];
const checks=[],databases=[],pools=[],transactions=new AsyncLocalStorage(),counter={posts:0};
const mediaIo={downloads:0,puts:0,gets:0,analyses:0};
const config=binding.mode==='github-actions-service'?{...officeCiConnection(),application_name:'office496_own_native'}:{host:server.host,port:server.port,user:server.user,database:'postgres',ssl:false,connectionTimeoutMillis:2000,statement_timeout:8000,application_name:'office496_own_native'};
const admin=new Client(config);let phase='identity',failure=null;
async function rollbackReleaseOwned(client){let broken=false;try{await client.query('ROLLBACK');}catch(error){broken=true;throw error;}finally{client.release(broken);}}
async function boundedUntil(predicate,label){const until=Date.now()+5000;while(!await predicate()){assert(Date.now()<until,label);await wait(20);}}
async function scenario({worker=false}={}){
 const database='officeown_'+randomUUID().replaceAll('-','');assert.match(database,/^officeown_[a-f0-9]{32}$/);
 await admin.query('CREATE DATABASE "'+database+'"');databases.push(database);
 const pool=trackDisposablePool(new Pool({...config,database,max:8}));pools.push(pool);
 await pool.query(COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL);
 await pool.query(`CREATE TYPE "SystemRole" AS ENUM('TENANT_USER');ALTER TABLE "PlatformUser" ADD COLUMN "systemRole" "SystemRole" NOT NULL DEFAULT 'TENANT_USER';ALTER TABLE "Worker" ADD COLUMN role text;ALTER TABLE "Organization" ADD COLUMN "subscriptionPlan" text DEFAULT 'PRO',ADD COLUMN "subscriptionStatus" text DEFAULT 'ACTIVE';ALTER TABLE "WhatsAppConnection" ADD COLUMN "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,ADD COLUMN "updatedAt" timestamp(3) NOT NULL;UPDATE "TenantMembership" SET "tenantRole"='DIRECTOR',"updatedAt"=clock_timestamp() WHERE id='member'`);
 const schema=(await pool.query(`SELECT is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='WhatsAppConnection' AND column_name='updatedAt'`)).rows[0];assert.equal(schema.is_nullable,'NO');assert.equal(schema.column_default,null);
 const f=ownCompanyFixture(),environment={...f.environment,META_CUSTOMER_CREDENTIALS_KEY:randomBytes(32).toString('base64')};
 // Fixture-local administrative policy data, never process.env/CI provenance.
 f.debug.expires_at=Math.floor((f.time+24*3600000)/1000);
 const connect=async()=>{const client=await pool.connect(),hooks=transactions.getStore();hooks?.pid?.(client.processID);return {release:broken=>client.release(broken),query:async(sql,values)=>{await hooks?.before?.(sql,values,client);const actual=await client.query(sql,values);await hooks?.after?.(sql,values,actual,client);return actual;}};};
 const owner=f.context.session,person={...owner,userId:'user_Person',organizationRole:'org:member'},foreign={...owner,userId:'user_Foreign',organizationId:'org_B'};
 const workspace=createWorkspaceStore({connect}),operations=createFieldOperations({workspace}),workerChannel=createWorkerChannelStore({workspace,environment});
 await pool.query(`UPDATE "Organization" SET metadata=$1::jsonb WHERE id='org-a'`,[JSON.stringify(f.context.project.organizationMetadata)]);
 const migration=await pool.connect();try{const dry=await executeCompanyChannelAdoption(migration);assert.equal(dry.readOnly,true);assert.equal((await executeCompanyChannelAdoption(migration,{mode:'APPLY',expectedFingerprint:dry.fingerprint})).status,'APPLIED');}finally{migration.release();}
 const allowedGet=new Set(['debug_token',f.policy.businessId+'/system_users',f.policy.businessId+'/owned_apps',f.policy.businessId+'/owned_whatsapp_business_accounts',f.policy.wabaId+'/phone_numbers',f.policy.wabaId+'/subscribed_apps']);
 const localFetch=async(url,options={})=>{
  const parsed=new URL(url);assert.equal(parsed.origin,'https://graph.facebook.com');assert(parsed.pathname.startsWith('/v25.0/'));const edge=parsed.pathname.slice('/v25.0/'.length),method=options.method||'GET';
  assert(method==='GET'&&allowedGet.has(edge)||method==='POST'&&edge===f.policy.phoneNumberId+'/messages','Only original fixture edges and message POST are allowed');
  const original=await f.fetchImpl(url,options);
  if(method==='POST'){assert.equal(original.status,200);counter.posts++;return Response.json({messages:[{id:'wamid.officeown'+String(counter.posts).padStart(16,'0')}]});}
  return original;
 };
 const provider=createMetaCustomerProvider({environment,fetchImpl:localFetch}),ownConnection=createOwnCompanyConnection({workspace,provider,environment}),company=createCompanyChannelStore({workspace,ownConnection,environment});
 const ownerContext={projectId:'project-a',scope:(await workspace.list(owner)).scope},personal={projectId:'project-a',scope:(await workspace.list(person)).scope};
 const basePayload={connectionId:null,revision:0,companyPhoneRevision:1,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId,confirmOwnBusiness:true,confirmReplacement:false};
 const connected=await company.command(owner,{...ownerContext,operationId:randomUUID(),action:'CONNECT_OWN_NUMBER',payload:basePayload});assert.equal(connected.state,'RECORDED');
 const channel=async()=>(await pool.query(`SELECT c.*,cc.mode,cc.revision,p."organizationId" FROM "WhatsAppConnection" c JOIN "WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id JOIN "Project" p ON p.id=c."projectId" WHERE c."projectId"='project-a'`)).rows[0];
 let c=await channel();assert(c);assert.equal(c.enabled,false);assert.equal(c.mode,'PREPARED');assert(c.encryptedAccessToken.startsWith('v2.'));
 assert.equal(decryptCustomerSecret(c.encryptedAccessToken,{organizationId:'org-a',projectId:'project-a',purpose:'access-token',resourceId:f.policy.phoneNumberId},environment),environment.META_OWN_COMPANY_ACCESS_TOKEN);
 assert.throws(()=>decryptCustomerSecret(c.encryptedAccessToken,{organizationId:'org-b',projectId:'project-a',purpose:'access-token',resourceId:f.policy.phoneNumberId},environment));
 const activation=await company.command(owner,{...ownerContext,operationId:randomUUID(),action:'ACTIVATE_OWN_NUMBER',payload:{...basePayload,connectionId:c.id,revision:c.revision,confirmRegistration:false,securityPin:null}});
 assert.equal(activation.state,'RECORDED');c=await channel();assert.equal(c.enabled,true);assert.equal(c.mode,'PREPARED');assert.equal(c.metadata.ownCompanyRuntime.version,2);assert.equal(c.metadata.ownCompanyRuntime.state,'ACTIVE');assert.equal(c.metadata.ownCompanyRuntime.connectionId,c.id);assert.equal(c.metadata.ownCompanyRuntime.origin.receiptId,activation.receiptId);
 const origin=(await pool.query('SELECT metadata FROM "AuditLog" WHERE id=$1',[activation.receiptId])).rows[0].metadata;assert.equal(origin.state,'RECORDED');assert.deepEqual(origin.runtimeGrant,c.metadata.ownCompanyRuntime);assert.equal(f.calls.filter(call=>call.method==='POST').length,0,'Connected fixture needs no register/subscribe POST');
 const forbiddenMedia=kind=>async()=>{mediaIo[kind]++;throw new Error('NO_MEDIA_IO_IN_OWN_OFFICE_CORE');};
 const put=forbiddenMedia('puts'),get=forbiddenMedia('gets'),analyzer={analyzePhoto:forbiddenMedia('analyses')};
 const inbox=createMetaCustomerInbox({connect,environment}),callback=createMetaCustomerCallbackHandlers({inbox,environment});
 async function push(value,{from='5491100001111',status=false,waba=f.policy.wabaId,phone=f.policy.phoneNumberId,invalidSignature=false,expectedStatus=200}={}){
  const message=status?value:{id:'wamid.'+randomUUID().replaceAll('-',''),from,timestamp:String(Math.floor(Date.now()/1000)),...(typeof value==='string'?{type:'text',text:{body:value}}:value)};
  const body={object:'whatsapp_business_account',entry:[{id:waba,changes:[{field:'messages',value:{metadata:{phone_number_id:phone},[status?'statuses':'messages']:[message]}}]}]},bytes=Buffer.from(JSON.stringify(body)),signature='sha256='+createHmac('sha256',environment.META_APP_SECRET).update(bytes).digest('hex');
  const response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':invalidSignature?signature.slice(0,-1)+(signature.at(-1)==='0'?'1':'0'):signature},body:bytes}));assert.equal(response.status,expectedStatus);
  if(expectedStatus!==200)return null;return 'customer_webhook_'+splitMetaCustomerEvents(body)[0].externalId;
 }
 async function lease(eventId){const token=randomUUID(),row=(await pool.query(`UPDATE "WebhookEvent" SET "leaseToken"=$2,"leaseExpiresAt"=clock_timestamp()+interval '60 seconds',attempts=attempts+1 WHERE id=$1 AND provider='meta-customer-v1' AND status='PENDING' AND ("leaseToken" IS NULL OR "leaseExpiresAt"<=clock_timestamp()) RETURNING *`,[eventId,token])).rows[0];assert(row);return {eventId:row.id,projectId:row.projectId,channelId:row.payload.channelId,payloadDigest:row.payload.payloadDigest,leaseToken:token};}
 const fieldBridge=createMetaFieldBridge({connect,environment,provider,put,get,analyzer}),fieldOutbound=createMetaCustomerOutbound({connect,environment,provider,resolveIdentity:resolveWorkerChannelIdentity});
 if(worker){
  const participant={participant:{version:1,status:'ACTIVE',clerkUserId:person.userId,permissions:{attendance:true,report:true},kyc:{version:1,status:'NOT_SUBMITTED'}}};
  await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,active,metadata) VALUES('worker-a','project-a','Synthetic native person','+5491100001111',true,$1::jsonb)`,[JSON.stringify(participant)]);
  const kyc=createCanonicalParticipantKycFixture({workspace,connect,query:(...args)=>pool.query(...args)});await kyc.approve({projectId:'project-a',workerId:'worker-a',actor:person,reviewer:owner});
  await operations.save(owner,{...ownerContext,operationId:randomUUID(),action:'CONFIGURE_SITE',payload:{revision:(await operations.read(owner,ownerContext)).projectRevision,sectors:[{id:'sector-main',name:'Synthetic sector',latitude:0,longitude:0,radius:100}]}});
  const legacy=createMetaCustomerProcessor({connect,environment,dispatch:context=>fieldBridge.execute(context),outbound:fieldOutbound}),record=(await workerChannel.read(person,personal)).records.find(row=>row.workerId==='worker-a');assert(record);
  const challenge=await workerChannel.command(person,{...personal,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:record.workerId,revision:record.revision}});
  assert.equal((await legacy.process(await push(challenge.code))).kind,'CHANNEL_BOUND');
 }
 c=await channel();assert.equal((await company.command(owner,{...ownerContext,operationId:randomUUID(),action:'ACTIVATE',payload:{connectionId:c.id,revision:c.revision,targetProjectId:null}})).state,'RECORDED');c=await channel();assert.equal(c.mode,'COMPANY');
 const office=createOfficeChatStore({connect,environment}),bridge=createOfficeChatBridge({connect,environment,provider}),companyBridge=createCompanyChannelBridge({connect,environment,provider,put,get,analyzer});
 const companyOutbound=createMetaCustomerOutbound({connect,environment,provider,resolveIdentity:resolveCompanyOutboundIdentity,sourceContext:true}),kycBridge=createMetaKycBridge({connect,environment,provider,deposit:()=>{throw new Error('NO_KYC_DEPOSIT_IN_OWN_OFFICE_CORE');}});
 const processor=createMetaCustomerProductionProcessor({connect,environment,officeBridge:bridge,fieldBridge,kycBridge,kycOutbound:createMetaKycOutbound({connect,environment,provider}),appProjection:createMetaCustomerAppProjection({connect,environment,provider}),companyBridge,fieldOutbound,companyOutbound,isCompany:context=>customerJobTransaction(connect,client=>resolveCompanyEnvelope(client,{eventId:context.eventId,environment})).then(Boolean),rejectedKyc:createMetaKycRejection({connect,environment,provider}),expiredKyc:createMetaKycExpiryFeedback({connect,environment,provider}),contextKyc:createMetaKycContextFeedback({connect,environment,provider}),deferAuthorization:async(client,context)=>await companyPreparedMediaRecovery(client,context,{environment})||await metaPreparedPlanRecovery(client,context,{environment}),authorizationCodes:[...OFFICE_CHAT_AUTHORIZATION_CODES,...META_OWN_COMPANY_AUTHORIZATION_CODES,...META_KYC_AUTHORIZATION_CODES,...EMPLOYEE_INTAKE_AUTHORIZATION_CODES,'COMPANY_CHANNEL_SOURCE_REQUIRED','COMPANY_CHANNEL_SUSPENDED','COMPANY_CHANNEL_CONTEXT_CHANGED','COMPANY_CHANNEL_IDENTITY_AMBIGUOUS','COMPANY_CHANNEL_CATALOG_REQUIRED']});
 const command=(session=person,action='PREPARE')=>({projectId:'project-a',scope:session===owner?ownerContext.scope:personal.scope,operationId:randomUUID(),action,...(action==='PREPARE'?{sender:session===owner?'+5491100002222':'+5491100001111'}:{})});
 const slot=async(actor='person')=>(await pool.query('SELECT * FROM "AuditLog" WHERE action=$1 AND "actorId"=$2 ORDER BY id',[OFFICE_CHAT_ACTION,actor])).rows;
 async function prepare(session=person){const input=command(session),value=await office.command(session,input);assert.equal(value.codeAvailable,true);assert.match(value.message,/^CUENTA [A-Za-z0-9_-]{43}$/);return {input,value};}
 async function bind(session=person){const prepared=await prepare(session),eventId=await push(prepared.value.message,{from:session===owner?'5491100002222':'5491100001111'}),context=await lease(eventId),result=await bridge.execute(context);assert.equal(result.kind,'OFFICE_CHAT');return {...prepared,eventId,context,result};}
 async function replyFor(eventId){const row=(await pool.query('SELECT id,payload,outcome FROM "WebhookEvent" WHERE id=$1',[customerOutboundId(eventId)])).rows[0];assert(row);return {message:JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:'org-a',projectId:'project-a',purpose:'outbound',resourceId:row.id},environment)).message,messageId:row.outcome.messageId,row};}
 async function execute(message){const eventId=await push(message);return {eventId,result:await processor.process(eventId),reply:await replyFor(eventId)};}
 async function choose(parent,title){const row=parent.reply.message.sections.flatMap(section=>section.rows).find(row=>row.title===title);assert(row,'Current original menu choice required');return execute({type:'interactive',interactive:{type:'list_reply',list_reply:{id:row.id,title:row.title}},context:{id:parent.reply.messageId}});}
 const business=async()=>({workers:(await pool.query('SELECT row_to_json(w) AS row FROM "Worker" w ORDER BY id')).rows,tasks:(await pool.query('SELECT row_to_json(t) AS row FROM "Task" t ORDER BY id')).rows,counts:(await pool.query('SELECT (SELECT count(*) FROM "AttendanceEntry")::int AS attendance,(SELECT count(*) FROM "OperationalProposal")::int AS proposals,(SELECT count(*) FROM "Incident")::int AS incidents')).rows[0]});
 return {pool,f,environment,workspace,owner,person,foreign,ownerContext,personal,channel,activation,office,bridge,workerChannel,command,slot,prepare,bind,push,lease,processor,execute,choose,business};
}
async function check(name,run){phase=name;await run();checks.push(name);save('progress-'+String(checks.length).padStart(2,'0')+'.json',{name,status:'PASS_NATIVE_OWN_SQL_GROUP',completed:checks.length});}
// Failure-only diagnostic. Persist declared source locations, never raw stack
// lines, exception messages, assertion values, query data or payloads.
function declaredSourceFrames(error){
 const frames=[],declared=new Map(sourceManifest.files.map(row=>[path.resolve(root,row.path).toLowerCase(),row.path])),stack=error?.stack;
 if(typeof stack!=='string')return frames;
 for(const line of stack.split(/\r?\n/)){
  if(!/^\s+at\s/.test(line))continue;
  const match=/((?:file:\/\/\/|[A-Za-z]:[\\/])[^\r\n]*):([1-9]\d*):([1-9]\d*)\)?$/.exec(line);if(!match)continue;
  let filename;try{filename=match[1].startsWith('file:')?fileURLToPath(match[1]):match[1];}catch{continue;}
  const sourcePath=declared.get(path.resolve(filename).toLowerCase()),lineNumber=Number(match[2]),column=Number(match[3]);
  if(!sourcePath||!Number.isSafeInteger(lineNumber)||!Number.isSafeInteger(column))continue;
  frames.push({sourcePath,line:lineNumber,column});if(frames.length===8)break;
 }
 return frames;
}

try{
 await admin.connect();const identity=(await admin.query("SELECT system_identifier::text AS id,current_setting('data_directory') AS data,current_setting('port') AS port,current_setting('TimeZone') AS timezone,current_setting('server_version_num')::int AS version FROM pg_control_system()")).rows[0];
 assert.equal(identity.id,server.systemIdentifier);assert.equal(path.resolve(identity.data).toLowerCase(),path.resolve(server.dataDirectory).toLowerCase());assert.equal(identity.port,String(server.port));assert.equal(identity.timezone,'UTC');assert(Number.isInteger(identity.version)&&identity.version>=170000&&identity.version<180000);save('sql-identity.json',{...identity,ownerPid:server.pid});
 await check(expectedChecks[0],async()=>{
  const s=await scenario(),before=await s.business();assert.equal(OFFICE_CHAT_TTL_MS,300000);
  for(const session of [s.owner,s.person]){
   const p=await s.prepare(session),actor=session===s.owner?'owner':'person',rows=await s.slot(actor),code=p.value.message.slice(7);
   assert.equal(rows.length,1);assert.equal(Buffer.from(code,'base64url').length,32);assert.equal(rows[0].metadata.pending.hash,officeChatCodeHash(code));assert.equal(JSON.stringify(rows).includes(code),false);assert.equal(JSON.stringify((await s.pool.query('SELECT metadata FROM "AuditLog" ORDER BY id')).rows).includes(code),false,'Ephemeral code is absent from all native audit records');
   const replay=await s.office.command(session,p.input);assert.equal(replay.replayed,true);assert.equal(replay.codeAvailable,false);assert.equal(Object.hasOwn(replay,'message'),false);
  }
  const b=await s.bind();assert.equal(b.result.businessApplied,false);assert.equal(b.result.identityStatus,'OFFICE_NAVIGATION_ONLY');assert.equal(b.value.identityCertified,false);assert.equal(b.value.permissionsGranted,false);
  const first=await s.bridge.send(b.context,b.result.reply),posts=counter.posts;assert.equal(first.replySent,true);assert.deepEqual(await s.bridge.execute(b.context),b.result);
  await s.bridge.send(b.context,b.result.reply);assert.equal(counter.posts,posts,'Acknowledged send replay never makes another synthetic POST');assert.equal((await s.office.read(s.person,s.personal)).state,'BOUND');
  assert.deepEqual(await s.business(),before);assert.equal((await s.pool.query('SELECT count(*)::int AS n FROM "Worker"')).rows[0].n,0);
  const ownRow=await s.channel(),origin=(await s.pool.query('SELECT metadata FROM "AuditLog" WHERE id=$1',[s.activation.receiptId])).rows[0].metadata;assert.deepEqual(origin.runtimeGrant,ownRow.metadata.ownCompanyRuntime);
 });
 await check(expectedChecks[1],async()=>{
  const s=await scenario(),p=await s.prepare(),before=await s.slot(),posts=counter.posts;
  await assert.rejects(s.bridge.execute(await s.lease(await s.push(p.value.message,{from:'5491100003333'}))),{code:'OFFICE_CHAT_CODE_REJECTED'});
  const foreignScope=(await s.workspace.list(s.foreign)).scope;await assert.rejects(s.office.command(s.foreign,{...s.command(s.foreign),scope:foreignScope}),{code:'OFFICE_CHAT_ACCESS_REVOKED'});
  const events=async()=>(await s.pool.query('SELECT count(*)::int AS n FROM "WebhookEvent"')).rows[0].n,n=await events();
  await s.push(p.value.message,{invalidSignature:true,expectedStatus:403});await s.push(p.value.message,{phone:'229999991',expectedStatus:403});await s.push(p.value.message,{waba:'239999991',expectedStatus:403});
  assert.equal(await events(),n);assert.deepEqual(await s.slot(),before);assert.equal(counter.posts,posts);assert.equal((await s.pool.query('SELECT count(*)::int AS n FROM "Worker"')).rows[0].n,0);
 });
 await check(expectedChecks[2],async()=>{
  const s=await scenario(),p=await s.prepare(),context=await s.lease(await s.push(p.value.message)),before=await s.slot(),c=await s.channel(),blocker=await s.pool.connect();
  let pid=null,call=null,outcome;
  try{
   await blocker.query('BEGIN');assert.equal((await blocker.query('SELECT id FROM "WhatsAppConnection" WHERE id=$1 FOR UPDATE',[c.id])).rows.length,1);
   call=transactions.run({pid:value=>{pid=value;}},()=>s.bridge.execute(context)).then(value=>({ok:true,value}),error=>({ok:false,code:error?.code}));
   await boundedUntil(async()=>pid&&(await s.pool.query('SELECT $2::int=ANY(pg_blocking_pids($1::int)) AS blocked',[pid,blocker.processID])).rows[0].blocked,'Current OWN consumer must block behind its actual channel row');
   const armed=(await s.pool.query(`WITH shortened AS (UPDATE "WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()+interval '400 milliseconds' WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' AND status='PENDING' AND "leaseToken"=$3 AND payload->>'payloadDigest'=$4 AND "leaseExpiresAt">clock_timestamp()+interval '400 milliseconds' RETURNING id,"leaseExpiresAt") SELECT id,"leaseExpiresAt" AS deadline,clock_timestamp() AS observed,"leaseExpiresAt">clock_timestamp() AS alive,$6::int=ANY(pg_blocking_pids($5::int)) AS blocked FROM shortened`,[context.eventId,context.projectId,context.leaseToken,context.payloadDigest,pid,blocker.processID])).rows;
   assert.equal(armed.length,1);assert.equal(armed[0].alive,true);assert.equal(armed[0].blocked,true);
   let expired;await boundedUntil(async()=>{const rows=(await s.pool.query(`SELECT id,"leaseExpiresAt" AS deadline,clock_timestamp() AS observed,clock_timestamp()>="leaseExpiresAt" AS expired,$6::int=ANY(pg_blocking_pids($5::int)) AS blocked FROM "WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' AND status='PENDING' AND "leaseToken"=$3 AND payload->>'payloadDigest'=$4`,[context.eventId,context.projectId,context.leaseToken,context.payloadDigest,pid,blocker.processID])).rows;assert.equal(rows.length,1);expired=rows[0];return expired.expired===true&&expired.blocked===true;},'The same OWN source must expire while the same consumer remains blocked');
   assert.equal(expired.id,armed[0].id);assert.equal(expired.deadline.getTime(),armed[0].deadline.getTime());save('own-lease-lock-witness.json',{consumer:pid,blocker:blocker.processID,exactSourceTokenMatched:true,aliveWhileBlocked:armed[0],expiredWhileStillBlocked:expired});
  }finally{try{await rollbackReleaseOwned(blocker);}finally{if(call)outcome=await call;}}
  assert.equal(outcome.ok,false);assert.equal(outcome.code,'OFFICE_CHAT_CONTEXT_CHANGED');assert.deepEqual(await s.slot(),before);
 });
 await check(expectedChecks[3],async()=>{
  const s=await scenario({worker:true}),current=(await s.workerChannel.read(s.person,s.personal)).records.find(row=>row.workerId==='worker-a');assert.equal(current.state,'VERIFIED');assert.equal(current.eligible,true);assert.equal(current.challenge,null);
  const menu=await s.execute('OBRA');assert.equal(menu.result.kind,'WORKSITE_SELECTION');const chosen=await s.choose(menu,'Obra fixture local');assert.equal(chosen.result.kind,'WORKSITE_CONFIRM');assert.equal((await s.choose(chosen,'Confirmar obra')).result.kind,'WORKSITE_SELECTED');
  const fieldMenu=await s.execute('MENU');assert.equal(fieldMenu.result.kind,'CONVERSATION');const draft=await s.choose(fieldMenu,'Enviar evidencia');assert.equal(draft.result.kind,'CONVERSATION');assert.equal(draft.reply.message.type,'interactive');
  const worker=async()=>(await s.pool.query('SELECT row_to_json(w) AS row FROM "Worker" w WHERE id=$1',['worker-a'])).rows[0].row,before=await worker(),business=await s.business();
  await s.bind();assert.equal((await s.execute('HOLA')).result.kind,'OFFICE_CHAT');assert.deepEqual(await worker(),before);assert.equal((await s.execute('CAMPO')).result.kind,'OFFICE_CHAT');assert.deepEqual(await worker(),before);
  const sector=await s.choose(draft,'Tarea local');assert.equal(sector.result.kind,'CONVERSATION');assert.equal(sector.result.businessApplied,false);assert.equal(sector.reply.message.type,'interactive');assert.equal(sector.reply.message.body,'Obra: Obra fixture local\nElegí el sector donde estás trabajando.');assert.deepEqual(sector.reply.message.sections.flatMap(section=>section.rows).map(row=>row.title),['Synthetic sector']);
  const state=async()=>{const worker=(await s.pool.query('SELECT * FROM "Worker" WHERE id=$1',['worker-a'])).rows[0],member=(await s.pool.query(OFFICE_CHAT_SQL.member,['person','member','org-a'])).rows[0];assert(worker&&member);const decoded=readMetaFieldConversation({worker,member,project:{id:worker.projectId},channelBinding:worker.metadata.participant.channelIdentity.binding},s.environment);assert(decoded);return decoded;};
  const sectorState=await state();assert.equal(sectorState.purpose,'MEDIA');assert.equal(sectorState.step,'SECTOR');assert.equal(sectorState.taskId,'task-a');assert.equal(sectorState.lastEventId,sector.eventId);
  const media=await s.choose(sector,'Synthetic sector');assert.equal(media.result.kind,'CONVERSATION');assert.equal(media.reply.message.type,'text');assert.match(media.reply.message.body,/^Obra: Obra fixture local\nEnviá una foto/);
  const mediaState=await state();assert.equal(mediaState.purpose,'MEDIA');assert.equal(mediaState.step,'MEDIA_FILE');assert.equal(mediaState.taskId,'task-a');assert.equal(mediaState.sectorId,'sector-main');assert.equal(mediaState.lastEventId,media.eventId);
  assert.deepEqual((await s.business()).tasks,business.tasks);assert.deepEqual((await s.business()).counts,business.counts);
 });
 await check(expectedChecks[4],async()=>{
  // Each corruption has a fresh canonical activation: no hand-written runtime
  // grant, restoration or regrant can conceal a revoked issuer.
  for(const kind of ['issuer-role','origin-audit','ciphertext']){
   const s=await scenario(),b=await s.bind(),before=await s.slot(),posts=counter.posts,c=await s.channel();
   if(kind==='issuer-role')await s.pool.query(`UPDATE "TenantMembership" SET "tenantRole"='AUDITOR',"updatedAt"=clock_timestamp() WHERE id='owner-m'`);
   if(kind==='origin-audit')await s.pool.query(`UPDATE "AuditLog" SET metadata=jsonb_set(metadata,'{state}','"REJECTED"'::jsonb) WHERE id=$1`,[s.activation.receiptId]);
   if(kind==='ciphertext')await s.pool.query(`UPDATE "WhatsAppConnection" SET "encryptedAccessToken"=$2 WHERE id=$1`,[c.id,c.encryptedAccessToken.slice(0,-1)+(c.encryptedAccessToken.at(-1)==='a'?'b':'a')]);
   await assert.rejects(s.bridge.execute(b.context),{code:'META_OWN_COMPANY_UNAVAILABLE'});await assert.rejects(s.bridge.send(b.context,b.result.reply),{code:'META_OWN_COMPANY_UNAVAILABLE'});
   assert.deepEqual(await s.slot(),before);assert.equal(counter.posts,posts);assert.equal((await s.pool.query('SELECT count(*)::int AS n FROM "Worker"')).rows[0].n,0);
   assert.equal((await s.pool.query(`SELECT "tenantRole"::text AS role FROM "TenantMembership" WHERE id='member'`)).rows[0].role,'DIRECTOR','Distinct office actor stays authorized; only original issuer/proof was revoked');
  }
 });
 assert.deepEqual(checks,expectedChecks);assert.equal(databases.length,7);assert.equal(Object.values(mediaIo).reduce((a,b)=>a+b,0),0);
}catch(error){failure={name:typeof error?.name==='string'?error.name.slice(0,64):'Error',code:typeof error?.code==='string'&&/^[A-Z0-9_]{1,100}$/.test(error.code)?error.code:'NATIVE_CASE_UNCONFIRMED',phase};try{const frames=declaredSourceFrames(error);if(frames.length)failure.sourceFrames=frames;}catch{/* Preserve original failure. */}}
finally{
 for(const pool of pools){try{await closeDisposablePool(pool);}catch{failure??={code:'OWNED_POOL_CLEANUP_UNCONFIRMED',phase};}}
 await admin.end().catch(()=>{failure??={code:'OWNED_ADMIN_CLEANUP_UNCONFIRMED',phase};});
 net.Socket.prototype.connect=originalConnect;globalThis.fetch=originalFetch;http.default.request=originalHttp.request;http.default.get=originalHttp.get;https.default.request=originalHttps.request;https.default.get=originalHttps.get;
}
if(externalNetworkAttempts)failure??={code:'EXTERNAL_NETWORK_ATTEMPT_DENIED',phase};
let afterSources;try{afterSources=sources();assert.deepEqual(afterSources,beforeSources);}catch{failure??={code:'SOURCE_DRIFT',phase:'after-sources'};}
const result={schema:'office-chat-own-native-pg-result.v1',status:failure?'FAIL_OR_INCOMPLETE':'PASS_NATIVE_OWN_CORE_ONLY',engine:'postgresql',checks,checksExpected:expectedChecks.length,checksCompleted:checks.length,negativeAuthorityVariants:3,databases,databasesRetained:true,sourceFiles:beforeSources.length,sourceFilesUnchanged:JSON.stringify(beforeSources)===JSON.stringify(afterSources),syntheticProviderPosts:counter.posts,realProviderRequests:0,externalNetworkAttempts,ownedLocalConnections,mediaIo,localSourceBaseHead:binding.mode==='github-actions-service'?binding.ci.sourceRevision:'5167fa054576b93ec59797ea6d070fd2f9553669',dedicated13:'UNCHANGED_NOT_RERUN',originalOwn56:'UNCHANGED_NOT_RERUN',clusterShutdown:binding.mode==='github-actions-service'?'GITHUB_JOB_SERVICE_LIFECYCLE_NO_HARNESS_STOP':'OWNED_WRAPPER_MUST_FENCE_AND_STOP',productionDataWritten:false,personalIdentityOrFieldAccepted:false,...(binding.mode==='github-actions-service'?{ciExecution:binding.ci}:{}),...(failure?{failure}:{})};
save('result.json',result);console.log(JSON.stringify(result));if(failure)process.exitCode=1;
