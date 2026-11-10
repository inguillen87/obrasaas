import assert from 'node:assert/strict';
import {randomUUID,createHmac,createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,readdirSync} from 'node:fs';
import {crc32,deflateSync} from 'node:zlib';
import {Client,Pool} from 'pg';
import {COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL} from './lib/company-channel-disposable-fixture.mjs';
import {executeCompanyChannelAdoption} from './lib/company-channel-migration.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {lifecycleEnvironment,lifecyclePng,lifecycleDisposableUrl,createControlledLifecycleBlob,createControlledLifecycleGraph} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createCompanyChannelStore} from '../src/lib/company-channel-store.mjs';
import {createCustomerWhatsAppSetup} from '../src/lib/customer-whatsapp-setup.mjs';
import {createMetaCustomerOnboarding} from '../src/lib/meta-customer-onboarding.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createMetaCustomerHandlers} from '../src/lib/meta-customer-http.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {readEmployeeIntake,EMPLOYEE_INTAKE_AUTHORIZATION_CODES} from '../src/lib/meta-employee-intake.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {resolveMetaKycAuthority,META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {createParticipantChannelKycDeposit,createParticipantChannelKycUploader} from '../src/lib/participant-channel-kyc.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {createMetaCustomerOutbound,customerOutboundId,customerJobTransaction} from '../src/lib/meta-customer-outbound.mjs';
import {createCompanyChannelBridge,resolveCompanyOutboundIdentity} from '../src/lib/company-channel-routing.mjs';
import {createWorkerChannelStore} from '../src/lib/worker-channel-identity.mjs';
import {createWorkerChannelHandlers} from '../src/lib/worker-channel-http.mjs';
import {createFieldHandlers,createFieldMediaHandlers} from '../src/lib/field-operations-http.mjs';
import {createFieldMedia} from '../src/lib/field-media.mjs';
import {createPlanImport} from '../src/lib/plan-import-store.mjs';
import {createPlanImportHandlers} from '../src/lib/plan-import-http.mjs';
import {PLAN_IMPORT_CONSENT} from '../src/lib/plan-import-policy.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {FIELD_NOTICE} from '../src/lib/field-operations-policy.mjs';
import {PARTICIPANT_ONBOARDING_NOTICE_VERSION,PARTICIPANT_ONBOARDING_NOTICE_SHA256,participantOnboardingIntent,participantOnboardingOutboundId,participantOnboardingPhaseOutboundId,participantOnboardingPhaseState} from '../src/lib/participant-onboarding-policy.mjs';
import {resolveParticipantOnboardingAuthority} from '../src/lib/participant-onboarding-authority.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {syntheticCaptureQuality} from './lib/synthetic-capture-quality.mjs';
import {CAPTURE_QUALITY_NOTICE_VERSION,CAPTURE_QUALITY_MODEL_MANIFEST_SHA256} from '../src/lib/private-capture-quality.mjs';

// Canonical SQL and signed sources in a new disposable schema only. All
// identities, credentials, images and provider methods are synthetic.
const url=lifecycleDisposableUrl(process.env);assert.ok(!process.env.VERCEL_TARGET_ENV);assert.equal(url.hostname,'127.0.0.1');assert.ok(['5432','6549'].includes(url.port));assert.equal(url.username,'cutover_test');assert.equal(url.password,url.port==='5432'?'cutover_test':'');
// Exercise PostgreSQL timestamp parsing outside UTC even on a UTC CI runner.
process.env.TZ='America/Argentina/Buenos_Aires';
assert.equal(new Date().getTimezoneOffset(),180);
const schema='obrasaas_reactive_kyc_'+randomUUID().replaceAll('-','');assert.match(schema,/^obrasaas_reactive_kyc_[a-f0-9]{32}$/);const quoted='"'+schema+'"';
const rewrite=sql=>{let text=sql.replace(/\bpublic\./g,quoted+'.').replace(/'public'::regnamespace/g,"'"+schema+"'::regnamespace").replace(/table_schema='public'/g,"table_schema='"+schema+"'");if(text.includes('FROM pg_trigger WHERE tgname=ANY'))text=text.replace('AND NOT tgisinternal','AND NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace=\''+schema+'\'::regnamespace)');return text;};
const environment={...lifecycleEnvironment},admin=new Client({connectionString:url.href}),checks=[],sqlFailures=[],messages=new Map(),blob=createControlledLifecycleBlob(),invitations=new Map();let pool,created=false,schemaRemoved=false,networkCalls=0,sends=0,downloads=0,invites=0,sequence=0,crossFinalClock=null,holdWorker=null,lastStatement=null,dispatchFailure=null;
const args=process.argv.slice(2);
assert.ok(args.length===0||args[0]==='--business-app'&&(args.length===1||args.length===2&&['--plan-image','--kyc-correction'].includes(args[1])));
const businessApp=args.length>0,planImage=args[1]==='--plan-image',kycCorrection=args[1]==='--kyc-correction';
const planFixture=planImage
 ?{name:'plan-import-synthetic-v1.png',contentType:'image/png',sha256:'e57146090c0436bb75b6c8c21ee958abffae777fb5ba151081dc50def4ba91db',label:'diagrama PNG'}
 :{name:'plan-import-synthetic-v1.pdf',contentType:'application/pdf',sha256:'88254bd24823b0d6d8da46d0f2dfe4494f92f3d92fe7fc92080519e554dc5f12',label:'PDF'};
let planImageSource=null;
if(businessApp)Object.assign(environment,{META_COEXISTENCE_CONFIG_ID:'1555555555555556',OBRASAAS_META_COEXISTENCE_RELEASE:'business-app-coexistence-v1'});
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{networkCalls++;throw Error('UNCONTROLLED_REACTIVE_NETWORK');};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),walk=dir=>readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const sourceManifest=[...walk('src/lib'),'scripts/lib/synthetic-capture-quality.mjs',...(businessApp?['scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs','scripts/fixtures/'+planFixture.name,'scripts/fixtures/plan-import-synthetic-v1.json','scripts/lib/company-channel-disposable-fixture.mjs','scripts/lib/company-channel-migration.mjs']:[])].sort().map(file=>({path:file,sha256:sha(readFileSync(file))})),harnessSha256=sha(readFileSync(new URL(import.meta.url)));
const query=(sql,args)=>pool.query(rewrite(sql),args);
const connect=async()=>{const c=await pool.connect();await c.query('SET search_path TO '+quoted);return {release:bad=>c.release(bad),query:async(sql,args)=>{try{if(!/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL)/.test(sql))lastStatement=sql;const result=await c.query(rewrite(sql),args);if(holdWorker&&sql.startsWith('UPDATE public."Worker" SET metadata=')&&args?.[0]===holdWorker.id){const gate=holdWorker;holdWorker=null;gate.entered();await gate.release;}if(crossFinalClock&&args?.[0]===crossFinalClock.eventId&&(crossFinalClock.kind==='intake'?sql.startsWith('SELECT id,clock_timestamp() AS now'):sql.startsWith('SELECT id,"projectId",payload,status::text AS status,"leaseToken"')&&sql.includes('clock_timestamp() AS now'))){result.rows[0].now=new Date(crossFinalClock.expiresAt);if(crossFinalClock.kind!=='intake')result.rows[0].leaseExpiresAt=new Date(Date.parse(crossFinalClock.expiresAt)+60000);crossFinalClock=null;}return result;}catch(error){if(error.code&&/^\d/.test(error.code))sqlFailures.push({code:error.code});throw error;}}};};
const owner={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'};
const director={...owner,userId:'user_ReactiveDirector',organizationRole:'org:member'},directorEmail='reactive-director@example.invalid';
const participantEndpoint='https://obrasaas.com/api/identity/participants';
const post=(url,body)=>new Request(url,{method:'POST',headers:{Origin:'https://obrasaas.com','Content-Type':'application/json'},body:JSON.stringify(body)});
const get=(url,params)=>new Request(url+'?'+new URLSearchParams(params));
const jsonResponse=async(response,expected=200)=>{const result=await response.json();assert.equal(response.status,expected,result.code);return result;};
const identityMedia=new Map([['150000001',lifecyclePng]]);
const provider={async sendReply({message,correlationId}){sends++;const messageId='wamid.SyntheticReactiveReply_'+sends;messages.set(correlationId,{messageId,message:structuredClone(message)});return {messageId};},async downloadMedia({beforeExternal,mediaId}){const bytes=identityMedia.get(mediaId);assert.ok(bytes,'Unknown synthetic identity media');await beforeExternal?.();downloads++;return {bytes,contentType:'image/png'};}};

function correctionPng(rgb){
 const chunk=(type,data)=>{
  const body=Buffer.concat([Buffer.from(type),data]),result=Buffer.alloc(12+data.length);
  result.writeUInt32BE(data.length);body.copy(result,4);result.writeUInt32BE(crc32(body),result.length-4);
  return result;
 };
 const header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,...rgb]))),chunk('IEND',Buffer.alloc(0))]);
}

// Closed synthetic quality only: these generated fixture pixels are never identity or liveness proof.
const qualityCalls=[];
const assessCaptureQuality=async input=>{
 assert.ok(['DOCUMENT_FRONT','SELFIE','DOCUMENT_BACK'].includes(input.kind));assert.equal(input.image.mimeType,'image/png');assert.equal(input.consentVersion,CAPTURE_QUALITY_NOTICE_VERSION);
 const expected=qualityCalls.length<6?lifecyclePng:correctionImages.get(input.kind);
 assert.deepEqual(input.image.buffer,expected);
 assert.equal(blob.puts(),Math.floor(qualityCalls.length/3)*3,'The complete new set must pass quality before its first Blob');
 const result=await syntheticCaptureQuality(input);assert.equal(result.state,'QUALITY_PASS');assert.equal(result.imageSha256,sha(expected));assert.equal(result.modelManifestSha256,CAPTURE_QUALITY_MODEL_MANIFEST_SHA256);assert.equal(result.identityCertified,false);assert.equal(result.livenessVerified,false);assert.equal(result.documentAuthenticityVerified,false);qualityCalls.push({kind:input.kind,sha256:result.imageSha256});return result;
};
const correctionImages=new Map(kycCorrection?[['DOCUMENT_FRONT',correctionPng([31,97,157])],['DOCUMENT_BACK',correctionPng([71,181,113])],['SELFIE',correctionPng([191,61,83])]]:[]);
const assessBiometrics=async()=>assert.fail('CURRENT manual capture must not call biometric analysis');

try{
 await admin.connect();const boundary=(await admin.query('SELECT current_database() AS database,session_user AS actor')).rows[0];assert.equal(boundary.database,'obrasaas_cutover_ci');assert.equal(boundary.actor,'cutover_test');await admin.query('CREATE SCHEMA '+quoted);created=true;await admin.query('SET search_path TO '+quoted);await admin.query(COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL);
 // The minimal channel fixture lacks the account role used by canonical
 // invitation acceptance. Extend only this disposable schema; store.join still
 // creates and proves the account before the reactive identity presentation.
 await admin.query(`CREATE TYPE "SystemRole" AS ENUM('TENANT_USER');ALTER TABLE "PlatformUser" ADD COLUMN "systemRole" "SystemRole" NOT NULL DEFAULT 'TENANT_USER'`);
 await admin.query('ALTER TABLE "Worker" ADD COLUMN role text;ALTER TABLE "WhatsAppConnection" ADD COLUMN "updatedAt" timestamp NOT NULL DEFAULT clock_timestamp();ALTER TABLE "Organization" ADD COLUMN "subscriptionPlan" text DEFAULT \'PRO\',ADD COLUMN "subscriptionStatus" text DEFAULT \'ACTIVE\'');
 pool=trackDisposablePool(new Pool({connectionString:url.href,max:8}));await query(`INSERT INTO public."Project"(id,"organizationId",name,status,metadata) VALUES('project-c','org-a','Synthetic destination B','ACTIVE','{}')`);
 let channelId='channel-a',phoneNumberId='120000001',wabaId='130000001';
 if(!businessApp){
  const metadata={credentialFormat:'tenant-aad-v2',credentialOrganizationId:'org-a',customerSignupId:'signup-synthetic',customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE',actorId:'owner'},customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null}},token=encryptCustomerSecret('synthetic-reactive-token',{organizationId:'org-a',projectId:'project-a',purpose:'access-token',resourceId:'120000001'},environment);
  await query(`INSERT INTO public."WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken",metadata) VALUES('channel-a','project-a',true,'CONNECTED','120000001','130000001',$1,$2::jsonb)`,[token,JSON.stringify(metadata)]);
 }else{
  await admin.query('ALTER TABLE "WhatsAppConnection" ADD UNIQUE ("projectId"),ADD COLUMN "verifiedBusinessName" text,ADD COLUMN "lastVerifiedAt" timestamp,ADD COLUMN "encryptedPin" text');
 }
 const migration=await connect();try{const dry=await executeCompanyChannelAdoption(migration);await executeCompanyChannelAdoption(migration,{mode:'APPLY',expectedFingerprint:dry.fingerprint});}finally{migration.release();}
 const workspace=createWorkspaceStore({connect}),company=createCompanyChannelStore({workspace,environment}),scope=(await workspace.list(owner)).scope,context={projectId:'project-c',scope},anchor={projectId:'project-a',scope};
 if(businessApp){
  const graph=createControlledLifecycleGraph(environment),asset=graph.assets.get('a');Object.assign(asset,{isOnBizApp:true,registered:true});
  const setup=createCustomerWhatsAppSetup({workspace}),onboarding=createMetaCustomerOnboarding({workspace,provider:createMetaCustomerProvider({environment,fetchImpl:graph.fetchImpl}),environment}),http=createMetaCustomerHandlers({verify:async()=>owner,service:onboarding});
  const action=(name,extra)=>({...anchor,operationId:randomUUID(),action:name,...extra});
  const invoke=body=>http.POST(post('https://obrasaas.com/api/identity/meta-onboarding',body)).then(response=>jsonResponse(response));
  const before=await setup.read(owner,anchor);
  await setup.save(owner,{...anchor,operationId:randomUUID(),profile:{assistantName:'Asistente sintético',numberMode:'BUSINESS_APP',initialProjectId:anchor.projectId,useCases:['FIELD_REPORTS','MATERIAL_REQUESTS','SCHEDULE_QUERIES'],expectedRevision:before.profile.revision,confirmOwnership:true}});
  const started=await invoke(action('begin',{preparedRevision:1}));assert.equal(started.signup.state,'PREPARED');assert.equal(started.signup.configId,environment.META_COEXISTENCE_CONFIG_ID);
  const finish=action('complete',{signupId:started.signup.id,stateToken:started.stateToken,code:asset.code,wabaId:asset.wabaId,phoneNumberId:null,signupEvent:'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'});
  const linked=await invoke(finish);assert.equal(linked.signup.state,'LINKED_PENDING_ACCEPTANCE');assert.equal(linked.signup.canRegister,false);assert.equal(linked.coexistence.verified,true);assert.equal(linked.connection.enabled,false);
  await invoke(finish);assert.equal(asset.exchanges,1);assert.equal(asset.subscriptions,1);assert.equal(asset.registrations,0);assert.deepEqual(graph.unexpected,[]);
  const channels=(await query('SELECT id,"projectId","phoneNumberId","whatsappBusinessId","encryptedPin",metadata FROM public."WhatsAppConnection"')).rows;assert.equal(channels.length,1);
  const channel=channels[0];assert.equal(channel.projectId,anchor.projectId);assert.equal(channel.phoneNumberId,asset.phoneNumberId);assert.equal(channel.whatsappBusinessId,asset.wabaId);assert.equal(channel.encryptedPin,null);assert.equal(channel.metadata.customerSignupId,started.signup.id);
  ({id:channelId,phoneNumberId,whatsappBusinessId:wabaId}=channel);
  const enrolled=(await query('SELECT c.mode,a.status,a."projectId" FROM public."WhatsAppCompanyChannel" c JOIN public."WhatsAppChannelProjectAssignment" a ON a."connectionId"=c."connectionId" WHERE c."connectionId"=$1',[channelId])).rows;
  assert.deepEqual(enrolled,[{mode:'PROJECT_ONLY',status:'ACTIVE',projectId:anchor.projectId}]);
  const activated=await invoke(action('activate_channel',{confirmActivation:true}));assert.equal(activated.activation.operational,true);assert.equal(activated.activation.roundTrip,'NOT_VERIFIED');assert.equal(asset.registrations,0);assert.deepEqual(graph.unexpected,[]);
  checks.push('BUSINESS_APP-real-adapter-WABA-only-finish-replay-zero-register-auto-enrolled-project-only-and-explicit-activation');
 }
 for(const [action,targetProjectId] of [['PREPARE',null],['ASSIGN','project-c'],['ACTIVATE',null]]){
  const state=await company.read(owner,anchor),channel=state.channels.find(item=>item.id===channelId);assert.ok(channel);
  const receipt=await company.command(owner,{...anchor,operationId:randomUUID(),action,payload:{connectionId:channelId,revision:channel.revision,targetProjectId}});assert.equal(receipt.state,'RECORDED',receipt.code);
 }
 if(businessApp){
  const promoted=(await company.read(owner,anchor)).channels.find(item=>item.id===channelId);assert.equal(promoted.mode,'COMPANY');
  assert.deepEqual(promoted.assignments.map(item=>[item.projectId,item.status]).sort(),[[anchor.projectId,'ACTIVE'],[context.projectId,'ACTIVE']]);
  checks.push('same-coexistence-channel-canonical-PREPARE-ASSIGN-ACTIVATE-distinct-destination');
 }
 let acceptedAccount=null,membershipChecks=0;
 const identity={async createInvitation({invitationId,email}){invites++;const result={id:'orginv_Reactive'+invites,invitationId,email,role:'org:member',state:'pending',expiresAt:new Date(Date.now()+7*86400000).toISOString()};invitations.set(invitationId,result);return result;},async findInvitation({invitationId}){return invitations.get(invitationId);},async verifiedEmail(userId){assert.equal(userId,acceptedAccount?.userId,'Only the explicit account acceptance fixture may query its provider');return acceptedAccount.email;},async verifyMembership({userId,organizationId}){assert.equal(userId,acceptedAccount?.userId,'REACTIVE_MUST_NOT_ACCEPT_ACCOUNT');assert.equal(organizationId,acceptedAccount.organizationId);membershipChecks++;return {userId,organizationId,role:'org:member'};}};
 if(businessApp)identity.findVerifiedOfficeAccount=async({organizationId,email})=>{
  assert.equal(organizationId,owner.organizationId);assert.equal(email,directorEmail);
  return {state:'READY',code:null,account:{clerkUserId:director.userId,name:'Directora sintética',email,primaryEmail:email,clerkRole:'org:member',providerMembershipId:'orgmem_ReactiveDirector',providerMembershipUpdatedAt:1791580000000,userUpdatedAt:1791580000000,emailAddressId:'email_ReactiveDirector',primaryEmailAddressId:'email_ReactiveDirector'}};
 };
 const store=createParticipantStore({workspace,connect,identity,get:blob.get,assessCaptureQuality,assessBiometrics,environment,...(kycCorrection?{prepareKycChat:prepareMetaKycChallenge}:{})}),upload=createParticipantChannelKycUploader({get:blob.get,put:async(...args)=>{assert.equal(qualityCalls.length,Math.ceil((blob.puts()+1)/3)*3);return blob.put(...args);},environment:()=>environment}),deposit=createParticipantChannelKycDeposit({connect,resolveAuthority:resolveMetaKycAuthority,upload,assessCaptureQuality,assessBiometrics,environment}),bridge=createMetaKycBridge({connect,provider,deposit,environment}),outbound=createMetaKycOutbound({connect,provider,environment});
 const processor=createMetaCustomerProcessor({connect,environment,authorizationCodes:[...EMPLOYEE_INTAKE_AUTHORIZATION_CODES,...META_KYC_AUTHORIZATION_CODES],dispatch:async c=>{try{return (await bridge.executeIntake(c))||await bridge.execute(c);}catch(error){dispatchFailure={code:error.code,stack:error.stack,lastStatement};throw error;}},outbound:{send:(c,reply,{purpose})=>outbound.send(c,reply,{purpose})}}),callback=createMetaCustomerCallbackHandlers({inbox:createMetaCustomerInbox({connect,environment}),environment,schedule:()=>{}});
 const push=async(message,{sender='15550001001',reply=null,timestamp=Math.floor(Date.now()/1000)}={})=>{sequence++;const value={id:'wamid.SyntheticReactiveMessage_'+sequence,from:sender,timestamp:String(timestamp),...(reply?{context:{id:reply}}:{}),...(typeof message==='string'?{type:'text',text:{body:message}}:message)},body={object:'whatsapp_business_account',entry:[{id:wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:phoneNumberId},messages:[value]}}]}]},bytes=Buffer.from(JSON.stringify(body)),signature='sha256='+createHmac('sha256',environment.META_APP_SECRET).update(bytes).digest('hex');assert.equal((await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':signature},body:bytes}))).status,200);return 'customer_webhook_'+splitMetaCustomerEvents(body)[0].externalId;};
 const execute=async(message,options)=>{const eventId=await push(message,options),result=await processor.process(eventId),sent=messages.get(customerOutboundId(eventId));return {eventId,result,...(sent||{})};};
 const choice=(last,title)=>{const row=last.message?.sections?.flatMap(s=>s.rows).find(r=>r.title===title);assert.ok(row,'Missing exact prompt '+title);return {type:'interactive',interactive:{type:'list_reply',list_reply:row}};};
 const assertPendingWorksiteReply=message=>{
  assert.equal(message.type,'text');
  assert.match(message.body,/pendiente de revisión independiente/);
  assert.deepEqual(message.body.split('\n').filter(line=>line.startsWith('https:')),[
   'https://obrasaas.com/cuenta?seccion=identidad&obra=project-c#participant-title',
  ]);
  assert.doesNotMatch(message.body,/project-a|Jornada|Vincular mi número|identidad fue aprobada/);
 };
 const assertCorrectionWorksiteReply=message=>{
  assert.equal(message.type,'text');
  assert.match(message.body,/corregir tu presentación de identidad/);
  assert.match(message.body,/pedile un código nuevo al responsable/);
  assert.deepEqual(message.body.split('\n').filter(line=>line.startsWith('https:')),[
   'https://obrasaas.com/cuenta?seccion=identidad&obra=project-c#participant-title',
  ]);
 };
 const state=async id=>JSON.parse(decryptCustomerSecret((await query(`SELECT payload FROM public."WebhookEvent" WHERE id=$1`,[id])).rows[0].payload.employeeIntake.encryptedState,{organizationId:'org-a',projectId:'project-a',purpose:'employee-intake',resourceId:id},environment));
 const recordedIntake=async id=>{const row=(await query(`SELECT payload FROM public."WebhookEvent" WHERE id=$1`,[id])).rows[0];assert.ok(row?.payload?.employeeIntakeDispatch);return JSON.parse(decryptCustomerSecret(row.payload.employeeIntakeDispatch.encryptedResult,{organizationId:'org-a',projectId:'project-a',purpose:'employee-intake-dispatch',resourceId:id},environment));};
 const worker=async id=>(await query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1`,[id])).rows[0];
 const command=(action,payload)=>({...context,operationId:randomUUID(),action,payload});
 const ownerHttp=createParticipantHandlers({verify:async()=>owner,store}),directorHttp=createParticipantHandlers({verify:async()=>director,store});
 let directorContext,directorMembershipId,directorDenied=false;
 if(businessApp){
  const discovered=await jsonResponse(await ownerHttp.GET(get(participantEndpoint,{...context,detail:'verified-office-account',email:directorEmail})));
  const candidate=discovered.verifiedOfficeAccount;assert.equal(candidate.state,'READY');assert.equal(candidate.account.clerkUserId,director.userId);
  const assignment=command('ASSIGN_VERIFIED_OFFICE',{email:directorEmail,clerkUserId:director.userId,expectedProofDigest:candidate.account.proofDigest,role:'DIRECTOR',reason:'Asignación sintética de Dirección para revisar identidad en otra cuenta.',confirmOfficePermissions:true});
  const assigned=await jsonResponse(await ownerHttp.POST(post(participantEndpoint,assignment)));assert.equal(assigned.account.role,'DIRECTOR');assert.equal(assigned.officeAssignmentReceipt.assignedProjectId,null);
  directorMembershipId=assigned.officeAssignmentReceipt.membershipId;
  const directory=await workspace.list(director);assert.ok(directory.projects.some(project=>project.id===context.projectId));directorContext={projectId:context.projectId,scope:directory.scope};
  const observed=await jsonResponse(await directorHttp.GET(get(participantEndpoint,directorContext)));assert.equal(observed.canManage,true);assert.equal(observed.canInvite,false);assert.equal(observed.employeeIntake,null);
 }
 const current=await customerJobTransaction(connect,c=>readEmployeeIntake(c,{organizationId:'org-a',role:'ADMIN'},'project-c',environment));await store.save(owner,command('CONFIGURE_EMPLOYEE_INTAKE',{connectionId:channelId,expectedRevision:current.revision,enabled:true,confirmed:true}));
 let initialMemberships=digest((await query(`SELECT * FROM public."TenantMembership" ORDER BY id`)).rows),initialProjects=digest((await query(`SELECT * FROM public."ProjectMembership" ORDER BY id`)).rows);
 async function admitted(sender,email){
  let last=await execute('HOLA',{sender});
  const app=last.eventId;
  last=await execute(choice(last,'Sumarme a una obra'),{sender,reply:last.messageId});
  last=await execute('Persona Sintética',{sender,reply:last.messageId});
  last=await execute(choice(last,'Operario'),{sender,reply:last.messageId});
  last=await execute(email,{sender,reply:last.messageId});
  await execute(choice(last,'Enviar solicitud'),{sender,reply:last.messageId});
  const s=await state(app);
  assert.equal(s.status,'WAITING_RESPONSIBLE');
  const admission=command('ADMIT_EMPLOYEE_INTAKE',{connectionId:channelId,applicationId:app,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:true,report:false},confirmed:true});
  if(businessApp&&!directorDenied){
   const before=(await query('SELECT count(*)::int AS count FROM public."Worker"')).rows[0].count;
   assert.equal(before,0);
   const denied=await jsonResponse(await directorHttp.POST(post(participantEndpoint,{...admission,...directorContext})),403);
   assert.equal(denied.code,'PARTICIPANT_INVITE_REQUIRED');assert.deepEqual(await state(app),s);
   assert.equal((await query('SELECT count(*)::int AS count FROM public."Worker"')).rows[0].count,before);
   directorDenied=true;
   checks.push('same-signed-intake-WAITING-no-worker-and-DIRECTOR-admit-403-without-mutation');
  }
  const admitted=businessApp?await jsonResponse(await ownerHttp.POST(post(participantEndpoint,admission))):await store.save(owner,admission);
  if(businessApp){
   const replay=await jsonResponse(await ownerHttp.POST(post(participantEndpoint,admission)));
   assert.equal(replay.receiptId,admitted.receiptId);assert.equal(replay.workerId,admitted.workerId);
   const admittedRow=await worker(admitted.workerId);assert.equal(admittedRow.projectId,context.projectId);assert.equal(admittedRow.metadata.participant,undefined);
  }
  assert.equal(admitted.permissionsGranted,false);
  const id=admitted.workerId,w=await worker(id);
  await store.save(owner,command('INVITE',{workerId:id,revision:w.revision,email,whatsAppConsent:{confirmed:true,noticeVersion:PARTICIPANT_ONBOARDING_NOTICE_VERSION,noticeSha256:PARTICIPANT_ONBOARDING_NOTICE_SHA256}}));
  const delivery=(await worker(id)).metadata.participant.onboardingDelivery;
  assert.equal(delivery.state,'WAITING_CONFIGURATION');
  assert.equal(delivery.deliveryVersion,2);
  assert.equal(delivery.phase,'ACCOUNT_INVITATION');
  assert.equal(participantOnboardingPhaseState(delivery,'IDENTITY_START').state,'WAITING_ACCOUNT_ACCEPTANCE');
  return {app,id,sender,email};
 }
 const snapshot=async id=>digest({worker:await worker(id),audit:(await query(`SELECT id,metadata FROM public."AuditLog" WHERE "entityId"=$1 ORDER BY id`,[id])).rows}),failSame=async(person,message,options={},mutate=null,restore=null)=>{await mutate?.();const {expectThrow,...sendOptions}=options,before=await snapshot(person.id),beforeSends=sends,beforePuts=blob.puts(),beforeDownloads=downloads;let out;try{if(expectThrow)await assert.rejects(execute(message,{sender:person.sender,...sendOptions}),{code:expectThrow});else{out=await execute(message,{sender:person.sender,...sendOptions});assert.equal(out.result.businessApplied,false);assert.equal(out.result.replySent,false);}assert.equal(sends,beforeSends);assert.equal(blob.puts(),beforePuts);assert.equal(downloads,beforeDownloads);assert.equal(await snapshot(person.id),before);}finally{await restore?.();}return out;};

 async function acceptForCurrent(person,userId){
  assert.equal(digest((await query('SELECT * FROM public."TenantMembership" ORDER BY id')).rows),initialMemberships);assert.equal(digest((await query('SELECT * FROM public."ProjectMembership" ORDER BY id')).rows),initialProjects);
  const invited=await worker(person.id),before=await snapshot(person.id),puts=blob.puts(),gets=downloads,assessments=qualityCalls.length,beforeMembershipChecks=membershipChecks;
  assert.equal(invited.metadata.participant.status,'INVITED');assert.equal(invited.metadata.participant.clerkUserId,null);const offered=await execute('HOLA',{sender:person.sender});assert.equal(offered.result.replySent,true);assert.equal(offered.result.businessApplied,false);assert.equal(offered.message.type,'text');assert.match(offered.message.body,/aceptá la invitación recibida por correo/);assert.match(offered.message.body,/No envíes fotos ni documentos/);assert.equal((await worker(person.id)).metadata.participant.kycChatChallenge,undefined);assert.equal(await snapshot(person.id),before);assert.equal(blob.puts(),puts);assert.equal(downloads,gets);assert.equal(qualityCalls.length,assessments);assert.equal(membershipChecks,beforeMembershipChecks);
  const beforeUsers=(await query('SELECT * FROM public."PlatformUser" ORDER BY id')).rows,beforeMembers=(await query('SELECT * FROM public."TenantMembership" ORDER BY id')).rows,beforeProjects=(await query('SELECT * FROM public."ProjectMembership" ORDER BY id')).rows;
  acceptedAccount={userId,organizationId:'org_A',email:person.email};invitations.get(invited.metadata.participant.invitation.id).state='accepted';const session={authenticated:true,verification:'clerk-production-jwt',userId,organizationId:'org_A',organizationRole:'org:member'},joined=await store.join(session,{invitationId:invited.metadata.participant.invitation.id,operationId:randomUUID()},{accept:true});assert.equal(joined.joined,true);assert.deepEqual(joined.onboardingReference,{projectId:'project-c',workerId:person.id});assert.equal(membershipChecks,beforeMembershipChecks+1);
  const afterUsers=(await query('SELECT * FROM public."PlatformUser" ORDER BY id')).rows,afterMembers=(await query('SELECT * FROM public."TenantMembership" ORDER BY id')).rows,afterProjects=(await query('SELECT * FROM public."ProjectMembership" ORDER BY id')).rows;
  for(const [prior,after]of [[beforeUsers,afterUsers],[beforeMembers,afterMembers],[beforeProjects,afterProjects]]){assert.equal(after.length,prior.length+1);for(const row of prior)assert.deepEqual(after.find(item=>item.id===row.id),row);}
  const own=afterUsers.find(row=>row.clerkUserId===userId),member=afterMembers.find(row=>!beforeMembers.some(old=>old.id===row.id)),assignment=afterProjects.find(row=>!beforeProjects.some(old=>old.id===row.id));assert.equal(member.userId,own.id);assert.equal(member.organizationId,'org-a');assert.equal(member.tenantRole,'AUDITOR');assert.equal(member.status,'ACTIVE');assert.equal(assignment.tenantMembershipId,member.id);assert.equal(assignment.projectId,'project-c');assert.equal(assignment.status,'ACTIVE');
  const accepted=await worker(person.id);assert.equal(accepted.metadata.participant.status,'ACTIVE');assert.equal(accepted.metadata.participant.clerkUserId,userId);assert.equal(accepted.metadata.participant.invitation.state,'ACCEPTED');assert.equal(accepted.metadata.participant.acceptanceReceiptId,joined.receiptId);assert.equal(accepted.metadata.participant.onboardingDelivery.phase,'IDENTITY_START');assert.equal(participantOnboardingPhaseState(accepted.metadata.participant.onboardingDelivery,'ACCOUNT_INVITATION').state,'CANCELED');assert.equal(participantOnboardingPhaseState(accepted.metadata.participant.onboardingDelivery,'IDENTITY_START').acceptanceReceiptId,joined.receiptId);assert.equal(accepted.metadata.participant.kycChatChallenge,undefined);assert.deepEqual(accepted.metadata.participant.permissions,{attendance:true,report:false});person.userId=userId;person.acceptanceReceiptId=joined.receiptId;person.acceptedPermissions=structuredClone(accepted.metadata.participant.permissions);
  initialMemberships=digest(afterMembers);initialProjects=digest(afterProjects);checks.push('CURRENT-'+userId+'-INVITED-account-instructions-zero-capture-then-one-explicit-canonical-JOIN');
 }

 const p=await admitted('15550001001','reactive-person@example.invalid');await acceptForCurrent(p,'user_ReactiveOne');let last=await execute('HOLA',{sender:p.sender});assert.equal(last.result.replySent,true);assert.match(choice(last,'Presentar identidad').interactive.list_reply.id,/^intake-kyc:[a-f0-9]{40}$/);assert.equal((await worker(p.id)).metadata.participant.kycChatChallenge,undefined);assert.doesNotMatch(JSON.stringify(last.result),/IDENTIDAD|kyc-start:/);checks.push('CURRENT-accepted-account-reactive-first-button-no-challenge-or-new-grant');
 await failSame(p,choice(last,'Presentar identidad'),{reply:null});await failSame(p,choice(last,'Presentar identidad'),{reply:'wamid.ForeignPrompt'});await failSame(p,{type:'interactive',interactive:{list_reply:{id:'intake-kyc:'+'0'.repeat(40)}}},{reply:last.messageId});checks.push('first-button-context-and-nonce-fail-closed-without-person-writes');
 const invitedBase=structuredClone((await worker(p.id)).metadata);
 for(const blockedState of ['BLOCKED','PENDING','SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED']){const m=structuredClone(invitedBase);m.participant.onboardingDelivery.state=blockedState;await query(`UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1`,[p.id,JSON.stringify(m)]);const result=await execute('ESTADO',{sender:p.sender});assert.ok(!result.message?.sections?.flatMap(s=>s.rows).some(r=>r.id.startsWith('intake-kyc:')));assert.equal((await worker(p.id)).metadata.participant.kycChatChallenge,undefined);}await query(`UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1`,[p.id,JSON.stringify(invitedBase)]);checks.push('blocked-pending-or-attempted-proactive-delivery-never-handoff');
 last=await execute('HOLA',{sender:p.sender});const button1=choice(last,'Presentar identidad');
 const revoke={...structuredClone(invitedBase),participant:{...structuredClone(invitedBase.participant),onboardingConsent:{...invitedBase.participant.onboardingConsent,status:'REVOKED'}}};await failSame(p,button1,{reply:last.messageId},()=>query(`UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1`,[p.id,JSON.stringify(revoke)]),()=>query(`UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1`,[p.id,JSON.stringify(invitedBase)]));
 await failSame(p,button1,{reply:last.messageId},()=>query(`UPDATE public."TenantMembership" SET status='DISABLED' WHERE id='owner-m'`),()=>query(`UPDATE public."TenantMembership" SET status='ACTIVE' WHERE id='owner-m'`));
 await failSame(p,button1,{reply:last.messageId,timestamp:Math.floor(Date.now()/1000)-25*3600,expectThrow:'META_CUSTOMER_REPLY_WINDOW_CLOSED'});
 // CURRENT accepted-account invitation expiry is covered below; expiry cannot undo canonical JOIN.
 const crossed=structuredClone(invitedBase);crossed.employeeIntakeAdmission.projectId='project-b';await failSame(p,button1,{reply:last.messageId},()=>query(`UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1`,[p.id,JSON.stringify(crossed)]),()=>query(`UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1`,[p.id,JSON.stringify(invitedBase)]));checks.push('CURRENT-reply-24h-and-cross-tenant-admission-denied-with-account-expiry-tested-separately');
 const legacyOutboxId=participantOnboardingOutboundId(participantOnboardingIntent(invitedBase.participant.onboardingDelivery)),outboxId=participantOnboardingPhaseOutboundId(participantOnboardingIntent(invitedBase.participant.onboardingDelivery),'IDENTITY_START');for(const existingId of [legacyOutboxId,outboxId])await failSame(p,button1,{reply:last.messageId},()=>query(`INSERT INTO public."WebhookEvent"(id,"projectId",provider,payload,outcome) VALUES($1,'project-a','meta-customer-outbound-v1',$2::jsonb,'{"state":"SEND_UNKNOWN"}')`,[existingId,JSON.stringify({organizationId:'org-a',workerId:p.id,invitationId:invitedBase.participant.onboardingDelivery.invitationId,consentReceiptId:invitedBase.participant.onboardingDelivery.consentReceiptId,onboardingPhase:'IDENTITY_START'})]),()=>query(`DELETE FROM public."WebhookEvent" WHERE id=$1`,[existingId]));checks.push('withdrawn-consent-revoked-issuer-and-existing-v1-or-current-identity-outbox-never-create-challenge');
 const beforeStartSubscription=(await query(`SELECT "subscriptionPlan","subscriptionStatus","trialEndsAt" AT TIME ZONE 'UTC' AS "trialEndsAt" FROM public."Organization" WHERE id='org-a'`)).rows[0];
 const startTrialExpiry=new Date(Date.now()+5*60000).toISOString();
 await query(`UPDATE public."Organization" SET "subscriptionPlan"='TRIAL',"subscriptionStatus"='TRIALING',"trialEndsAt"=$1::timestamptz AT TIME ZONE 'UTC' WHERE id='org-a'`,[startTrialExpiry]);
 last=await execute('HOLA',{sender:p.sender});
 assert.equal(last.result.replySent,true);
 const firstProof=(await state(p.app)).reactiveOnboarding;
 assert.equal(firstProof.expiresAt,startTrialExpiry);
 const firstEvent=await push(choice(last,'Presentar identidad'),{sender:p.sender,reply:last.messageId}),firstSnapshot=await snapshot(p.id),firstSends=sends;
 crossFinalClock={kind:'intake',eventId:firstEvent,expiresAt:startTrialExpiry};
 const firstExpired=await processor.process(firstEvent);
 assert.equal(crossFinalClock,null);
 assert.equal(firstExpired.code,'EMPLOYEE_INTAKE_CONTEXT_REQUIRED');
 assert.equal(firstExpired.replySent,false);
 assert.equal(firstExpired.businessApplied,false);
 assert.equal(await snapshot(p.id),firstSnapshot);
 assert.equal(sends,firstSends);
 assert.equal((await worker(p.id)).metadata.participant.kycChatChallenge,undefined);
 assert.equal((await query(`SELECT payload FROM public."WebhookEvent" WHERE id=$1`,[firstEvent])).rows[0].payload.employeeIntakeDispatch,undefined);
 checks.push('first-consumed-button-deadline-crossed-after-preparation-rolls-back-all-receipts-and-handoff');
 last=await execute('HOLA',{sender:p.sender});last=await execute(choice(last,'Presentar identidad'),{sender:p.sender,reply:last.messageId});assert.equal(last.result.replySent,true);let w=await worker(p.id);assert.equal(w.metadata.participant.status,'ACTIVE');assert.equal(w.metadata.participant.clerkUserId,p.userId);assert.deepEqual(w.metadata.participant.permissions,p.acceptedPermissions);assert.equal(w.metadata.participant.kycChatChallenge.status,'PENDING');assert.equal(w.metadata.participant.kycChatChallenge.analysisConsentVersion,3);assert.equal(w.metadata.participant.kycChatChallenge.participantClerkUserId,p.userId);assert.equal(w.metadata.participant.onboardingDelivery.state,'CANCELED');assert.equal(w.metadata.participant.onboardingDelivery.outboundId,null);const starterState=await state(p.app),starter=starterState.reactiveOnboarding;assert.equal(starter.kind,'KYC_START');assert.equal((await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE "entityId"=$1 AND action='participant.kyc_chat.prepared'`,[p.id])).rows[0].n,1);assert.equal((await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE "entityId"=$1 AND action='participant.onboarding.reactive_handoff'`,[p.id])).rows[0].n,1);assert.equal((await query(`SELECT count(*)::int AS n FROM public."WebhookEvent" WHERE id=$1`,[outboxId])).rows[0].n,0);assert.doesNotMatch(JSON.stringify(last.result),/IDENTIDAD|reactiveOnboarding/);assert.doesNotMatch(JSON.stringify(last.message),/IDENTIDAD/);checks.push('same-transaction-prepared-exterior-canceled-handoff-two-opaque-buttons-no-proactive-outbox');
 const replaySends=sends;assert.equal((await processor.process(last.eventId)).done,true);assert.equal(sends,replaySends);assert.equal((await worker(p.id)).metadata.participant.kycChatChallenge.id,starter.challengeId);checks.push('first-click-durable-replay-one-challenge-one-delivery');
 assert.equal(starter.expiresAt,startTrialExpiry);
 assert.ok(Date.parse(w.metadata.participant.kycChatChallenge.expiresAt)>Date.parse(startTrialExpiry));
 const start=choice(last,'Iniciar identidad'),startContext=last.messageId;await failSame(p,start,{reply:null});await failSame(p,start,{reply:'wamid.ForeignPrompt'});await failSame(p,{type:'interactive',interactive:{list_reply:{id:'kyc-start:'+'0'.repeat(40)}}},{reply:startContext});await failSame(p,start,{reply:startContext,sender:'15550001009'});checks.push('second-button-exact-SENT-prompt-sender-and-nonce-required');
 const pending=structuredClone((await worker(p.id)).metadata),sourceOutbound=customerOutboundId(last.eventId),savedOutcome=(await query(`SELECT outcome FROM public."WebhookEvent" WHERE id=$1`,[sourceOutbound])).rows[0].outcome;await failSame(p,start,{reply:startContext},()=>query(`UPDATE public."WebhookEvent" SET outcome='{"state":"SEND_UNKNOWN"}' WHERE id=$1`,[sourceOutbound]),()=>query(`UPDATE public."WebhookEvent" SET outcome=$2::jsonb WHERE id=$1`,[sourceOutbound,JSON.stringify(savedOutcome)]));checks.push('unconfirmed-start-prompt-cannot-be-consumed-or-resent');
 const crossedEvent=await push(start,{sender:p.sender,reply:startContext});
 crossFinalClock={eventId:crossedEvent,expiresAt:startTrialExpiry};
 const beforeClock=await snapshot(p.id),beforeClockSends=sends,crossedResult=await processor.process(crossedEvent);
 assert.equal(crossFinalClock,null);
 assert.equal(crossedResult.replySent,false);
 assert.equal(crossedResult.businessApplied,false);
 assert.equal(crossedResult.code,'META_KYC_CHALLENGE_EXPIRED');
 assert.equal(await snapshot(p.id),beforeClock);
 assert.equal(sends,beforeClockSends);
 checks.push('reactive-trial-deadline-crossed-at-final-DB-clock-rolls-back-claim-and-projection');
 last=await execute(start,{sender:p.sender,reply:startContext});assert.equal(last.result.replySent,true);assert.equal((await worker(p.id)).metadata.participant.kycChatChallenge.status,'CLAIMED');await failSame(p,start,{reply:startContext});const onceSends=sends;assert.equal((await processor.process(last.eventId)).done,true);assert.equal(sends,onceSends);checks.push('exact-start-event-claims-once-new-signed-replay-does-not-claim');
 await query(`UPDATE public."Organization" SET "subscriptionPlan"=$1,"subscriptionStatus"=$2,"trialEndsAt"=$3::timestamptz AT TIME ZONE 'UTC' WHERE id='org-a'`,[beforeStartSubscription.subscriptionPlan,beforeStartSubscription.subscriptionStatus,beforeStartSubscription.trialEndsAt?.toISOString()??null]);
 for(const title of ['Autorizar imágenes','Autorizar dorso','Sin lectura asistida','Revisión manual'])last=await execute(choice(last,title),{sender:p.sender,reply:last.messageId});
 for(let i=0;i<3;i++)last=await execute({type:'image',image:{id:'150000001',mime_type:'image/png'}},{sender:p.sender,reply:last.messageId});last=await execute(choice(last,'Presentar identidad'),{sender:p.sender,reply:last.messageId});assert.equal(last.result.businessApplied,true);w=await worker(p.id);assert.equal(w.metadata.participant.kyc.status,'PENDING_REVIEW');assert.equal(w.metadata.participant.kyc.biometricMode,'MANUAL');assert.equal(w.metadata.participant.kyc.biometricConsent.allowed,false);assert.equal(w.metadata.participant.kyc.channelCapture.accountClaimRequired,false);assert.equal(w.metadata.participant.status,'ACTIVE');assert.equal(w.metadata.participant.clerkUserId,p.userId);assert.deepEqual(w.metadata.participant.permissions,p.acceptedPermissions);assert.equal(w.metadata.participant.kycChatChallenge.status,'COMPLETED');assert.equal(blob.puts(),3);assert.equal(downloads,3);const captureCount=(await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE "entityId"=$1 AND metadata->>'kind'='KYC_SUBMITTED'`,[p.id])).rows[0].n;assert.equal(captureCount,1);const delivered=sends;assert.equal((await processor.process(last.eventId)).done,true);assert.equal(sends,delivered);assert.equal(blob.puts(),3);checks.push('CURRENT-signed-v3-manual-3image-capture-private-quality-PENDING_REVIEW-no-permission-change');
 const capturedSnapshot=await snapshot(p.id),captureMetadata=structuredClone((await worker(p.id)).metadata),capturePuts=blob.puts(),captureDownloads=downloads;
 for(const body of ['HOLA','ESTADO']){
  const observed=await execute(body,{sender:p.sender});
  assert.equal(observed.result.replySent,true,JSON.stringify({result:observed.result,dispatchFailure}));
  assert.equal(observed.result.businessApplied,false);
  assert.equal((await recordedIntake(observed.eventId)).reactiveKycStatus.status,'PENDING_REVIEW');
  assertPendingWorksiteReply(observed.message);
  assert.doesNotMatch(observed.message.body,/VINCULAR|documento.*https:/);
  assert.equal(await snapshot(p.id),capturedSnapshot);
  assert.equal(blob.puts(),capturePuts);
  assert.equal(downloads,captureDownloads);
 }
 const wrongGeneration=structuredClone(captureMetadata);wrongGeneration.participant.kyc.submissionId='kyc_'+randomUUID().replaceAll('-','');await failSame(p,'ESTADO',{},()=>query(`UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1`,[p.id,JSON.stringify(wrongGeneration)]),()=>query(`UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1`,[p.id,JSON.stringify(captureMetadata)]));
 const wrongPhone=structuredClone(captureMetadata);await failSame(p,'ESTADO',{},()=>query(`UPDATE public."Worker" SET phone='+15550001999' WHERE id=$1`,[p.id]),()=>query(`UPDATE public."Worker" SET phone=$2 WHERE id=$1`,[p.id,'+'+p.sender]));void wrongPhone;
 checks.push('completed-capture-status-HOLA-and-ESTADO-read-current-receipt-without-account-permission-or-image-effects-and-deny-new-generation-or-number');
 const originalInvitationExpiry=captureMetadata.participant.invitation.expiresAt;
 await query('UPDATE public."Worker" SET metadata=jsonb_set(metadata,\'{participant,invitation,expiresAt}\',\'"2000-01-01T00:00:00.000Z"\'::jsonb) WHERE id=$1',[p.id]);
 const beforeExpiryStatus=await snapshot(p.id),beforeExpiryPuts=blob.puts(),beforeExpiryDownloads=downloads,acceptedExpiryStatus=await execute('ESTADO',{sender:p.sender});assert.equal(acceptedExpiryStatus.result.replySent,true);assert.equal(acceptedExpiryStatus.result.businessApplied,false);assert.equal((await recordedIntake(acceptedExpiryStatus.eventId)).reactiveKycStatus.status,'PENDING_REVIEW');assert.equal(await snapshot(p.id),beforeExpiryStatus);assert.equal(blob.puts(),beforeExpiryPuts);assert.equal(downloads,beforeExpiryDownloads);
 await query('UPDATE public."Worker" SET metadata=jsonb_set(metadata,\'{participant,invitation,expiresAt}\',to_jsonb($2::text)) WHERE id=$1',[p.id,originalInvitationExpiry]);
 const originalSubscription=(await query(`SELECT "subscriptionPlan","subscriptionStatus","trialEndsAt" AT TIME ZONE 'UTC' AS "trialEndsAt" FROM public."Organization" WHERE id='org-a'`)).rows[0],trialExpiry=new Date(Date.now()+60000).toISOString();
 await query(`UPDATE public."Organization" SET "subscriptionPlan"='TRIAL',"subscriptionStatus"='TRIALING',"trialEndsAt"=$1::timestamptz AT TIME ZONE 'UTC' WHERE id='org-a'`,[trialExpiry]);
 assert.equal((await query(`SELECT "trialEndsAt" AT TIME ZONE 'UTC' AS "trialEndsAt" FROM public."Organization" WHERE id='org-a'`)).rows[0].trialEndsAt.getTime(),Date.parse(trialExpiry),'Trial timestamp must preserve the intended instant in the local PostgreSQL fixture');
 const activeTrialStatus=await execute('ESTADO',{sender:p.sender});
 assert.equal(activeTrialStatus.result.replySent,true);
 assert.equal(activeTrialStatus.result.businessApplied,false);
 assertPendingWorksiteReply(activeTrialStatus.message);
 const trialStatusEvent=await push('ESTADO',{sender:p.sender}),beforeTrialStatus=await snapshot(p.id),beforeTrialSends=sends;crossFinalClock={kind:'intake',eventId:trialStatusEvent,expiresAt:trialExpiry};
 const trialExpiredStatus=await processor.process(trialStatusEvent);
 assert.equal(trialExpiredStatus.replySent,false);
 assert.equal(trialExpiredStatus.businessApplied,false);
 assert.equal(trialExpiredStatus.code,'EMPLOYEE_INTAKE_CONTEXT_REQUIRED');
 assert.equal(crossFinalClock,null,'The simulated expiry must reach the final clock before rejecting the dispatch');
 assert.equal(await snapshot(p.id),beforeTrialStatus);
 assert.equal(sends,beforeTrialSends);
 assert.equal((await query(`SELECT payload FROM public."WebhookEvent" WHERE id=$1`,[trialStatusEvent])).rows[0].payload.employeeIntakeDispatch,undefined);
 await query(`UPDATE public."Organization" SET "subscriptionPlan"=$1,"subscriptionStatus"=$2,"trialEndsAt"=$3::timestamptz AT TIME ZONE 'UTC' WHERE id='org-a'`,[originalSubscription.subscriptionPlan,originalSubscription.subscriptionStatus,originalSubscription.trialEndsAt?.toISOString()??null]);
 checks.push('CURRENT-accepted-invitation-expiry-does-not-revoke-account-and-trial-final-clock-still-rolls-back-dispatch');
 const p2=await admitted('15550001002','second@example.invalid');await acceptForCurrent(p2,'user_ReactiveTwo');let race=await execute('HOLA',{sender:p2.sender});const intent=participantOnboardingIntent((await worker(p2.id)).metadata.participant.onboardingDelivery);let releaseHeld,entered;const reached=new Promise(resolve=>{entered=resolve;}),release=new Promise(resolve=>{releaseHeld=resolve;});holdWorker={id:p2.id,entered,release};const reacting=execute(choice(race,'Presentar identidad'),{sender:p2.sender,reply:race.messageId});await reached;let backgroundReached;const bgReached=new Promise(resolve=>{backgroundReached=resolve;});const backgroundConnect=async()=>{const c=await connect();return {...c,query:async(sql,args)=>{if(sql.includes('pg_advisory_xact_lock')&&args?.[0]?.startsWith('person-worksite-journey-v1:'))backgroundReached();return c.query(sql,args);}};};const background=customerJobTransaction(backgroundConnect,c=>resolveParticipantOnboardingAuthority(c,intent,{environment})).then(()=>({allowed:true}),error=>({allowed:false,code:error.code}));await bgReached;try{let blocked=false;for(let i=0;i<50&&!blocked;i++){blocked=(await admin.query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='cutover_test' AND datname='obrasaas_cutover_ci' AND wait_event='advisory') AS blocked`)).rows[0].blocked;if(!blocked)await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(blocked,true,'Background canonical journey must wait on reactive tx');}finally{releaseHeld();}race=await reacting;assert.equal(race.result.replySent,true);const bg=await background;assert.equal(bg.allowed,false);assert.equal(bg.code,'PARTICIPANT_ONBOARDING_CHALLENGE_REQUIRED');const racedWorker=await worker(p2.id);assert.equal(racedWorker.metadata.participant.onboardingDelivery.state,'CANCELED');assert.equal((await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE "entityId"=$1 AND action='participant.kyc_chat.prepared'`,[p2.id])).rows[0].n,1);assert.equal((await query(`SELECT count(*)::int AS n FROM public."WebhookEvent" WHERE id=$1`,[participantOnboardingPhaseOutboundId(intent,'IDENTITY_START')])).rows[0].n,0);checks.push('real-PG-shared-journey-lock-background-waits-rechecks-and-denies-second-challenge');
 assert.equal(digest((await query(`SELECT * FROM public."TenantMembership" ORDER BY id`)).rows),initialMemberships);assert.equal(digest((await query(`SELECT * FROM public."ProjectMembership" ORDER BY id`)).rows),initialProjects);for(const table of ['AttendanceEntry','Incident','OperationalProposal'])assert.equal((await query(`SELECT count(*)::int AS n FROM public."${table}"`)).rows[0].n,0);assert.equal((await query(`SELECT count(*)::int AS n FROM public."WhatsAppCompanyEventRoute"`)).rows[0].n,0);assert.equal((await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE metadata->>'kind' IN ('REVIEW_KYC','FIELD_PERMISSIONS_CHANGED')`)).rows[0].n,0);assert.equal((await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE metadata->>'kind'='INVITATION_ACCEPTED'`)).rows[0].n,2);assert.equal(networkCalls,0);assert.deepEqual(sqlFailures,[]);checks.push('reactive-chat-has-no-account-membership-KYC-approval-operational-route-or-network-effects-outside-two-explicit-JOINs');
 // The same signed chat also works when the person accepted the canonical
 // account first. Acceptance is an explicit separate fixture, never a chat
 // side effect. Old invitation expiry cannot undo that completed acceptance.
 const p3=await admitted('15550001003','accepted@example.invalid'),invited=await worker(p3.id);
 acceptedAccount={userId:'user_Accepted',organizationId:'org_A',email:p3.email};
 invitations.get(invited.metadata.participant.invitation.id).state='accepted';
 const joined=await store.join({authenticated:true,verification:'clerk-production-jwt',userId:acceptedAccount.userId,organizationId:acceptedAccount.organizationId,organizationRole:'org:member'},{invitationId:invited.metadata.participant.invitation.id,operationId:randomUUID()},{accept:true});
 assert.equal(joined.joined,true);assert.equal(membershipChecks,3);
 await query(`UPDATE public."Worker" SET metadata=jsonb_set(metadata,'{participant,invitation,expiresAt}','"2000-01-01T00:00:00.000Z"'::jsonb) WHERE id=$1`,[p3.id]);
 const accepted=structuredClone((await worker(p3.id)).metadata);
 assert.equal(accepted.participant.status,'ACTIVE');assert.equal(accepted.participant.invitation.state,'ACCEPTED');assert.deepEqual(accepted.participant.permissions,{attendance:true,report:false});
 const acceptedAudit=(await query(`SELECT "actorId",metadata FROM public."AuditLog" WHERE id=$1`,[joined.receiptId])).rows[0];
 const ownMembership=(await query(`SELECT id FROM public."TenantMembership" WHERE "userId"=$1 AND "organizationId"='org-a'`,[acceptedAudit.actorId])).rows[0].id;
 await failSame(p3,'HOLA',{},()=>query(`UPDATE public."TenantMembership" SET status='DISABLED' WHERE id=$1`,[ownMembership]),()=>query(`UPDATE public."TenantMembership" SET status='ACTIVE' WHERE id=$1`,[ownMembership]));
 await failSame(p3,'HOLA',{},()=>query(`UPDATE public."ProjectMembership" SET status='DISABLED' WHERE "tenantMembershipId"=$1 AND "projectId"='project-c'`,[ownMembership]),()=>query(`UPDATE public."ProjectMembership" SET status='ACTIVE' WHERE "tenantMembershipId"=$1 AND "projectId"='project-c'`,[ownMembership]));
 await failSame(p3,'HOLA',{},()=>query(`UPDATE public."AuditLog" SET "actorId"='foreign' WHERE id=$1`,[joined.receiptId]),()=>query(`UPDATE public."AuditLog" SET "actorId"=$2 WHERE id=$1`,[joined.receiptId,acceptedAudit.actorId]));
 await failSame(p3,'HOLA',{},()=>query(`UPDATE public."AuditLog" SET metadata=jsonb_set(metadata,'{kind}','"OTHER_ACCEPTANCE"'::jsonb) WHERE id=$1`,[joined.receiptId]),()=>query(`UPDATE public."AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[joined.receiptId,JSON.stringify(acceptedAudit.metadata)]));
 checks.push('accepted-reactive-account-still-requires-current-membership-worksite-and-exact-own-acceptance-receipt');
 const acceptedAccounts=digest((await query(`SELECT * FROM public."PlatformUser" ORDER BY id`)).rows),acceptedMemberships=digest((await query(`SELECT * FROM public."TenantMembership" ORDER BY id`)).rows),acceptedProjects=digest((await query(`SELECT * FROM public."ProjectMembership" ORDER BY id`)).rows);
 let acceptedReply=await execute('HOLA',{sender:p3.sender});assert.equal(acceptedReply.result.replySent,true);assert.match(acceptedReply.message.body,/cuenta ya está vinculada/);assert.doesNotMatch(acceptedReply.message.body,/Aceptá también/);
 const acceptedOffer=(await state(p3.app)).reactiveOnboarding;assert.ok(Date.parse(acceptedOffer.expiresAt)>Date.now());assert.ok(Date.parse(acceptedOffer.expiresAt)<=Date.now()+30*60*1000);
 acceptedReply=await execute(choice(acceptedReply,'Presentar identidad'),{sender:p3.sender,reply:acceptedReply.messageId});assert.equal(acceptedReply.result.replySent,true);assert.match(acceptedReply.message.body,/pendiente de revisión/);assert.doesNotMatch(acceptedReply.message.body,/falta aceptar/);
 let acceptedWorker=await worker(p3.id);assert.equal(acceptedWorker.metadata.participant.status,'ACTIVE');assert.equal(acceptedWorker.metadata.participant.kycChatChallenge.participantClerkUserId,acceptedAccount.userId);assert.deepEqual(acceptedWorker.metadata.participant.permissions,accepted.participant.permissions);
 acceptedReply=await execute(choice(acceptedReply,'Iniciar identidad'),{sender:p3.sender,reply:acceptedReply.messageId});assert.equal(acceptedReply.result.replySent,true);
 for(const title of ['Autorizar imágenes','Autorizar dorso','Sin lectura asistida','Revisión manual'])acceptedReply=await execute(choice(acceptedReply,title),{sender:p3.sender,reply:acceptedReply.messageId});
 for(let i=0;i<3;i++)acceptedReply=await execute({type:'image',image:{id:'150000001',mime_type:'image/png'}},{sender:p3.sender,reply:acceptedReply.messageId});
 acceptedReply=await execute(choice(acceptedReply,'Presentar identidad'),{sender:p3.sender,reply:acceptedReply.messageId});assert.equal(acceptedReply.result.businessApplied,true);
 acceptedWorker=await worker(p3.id);assert.equal(acceptedWorker.metadata.participant.status,'ACTIVE');assert.equal(acceptedWorker.metadata.participant.kyc.status,'PENDING_REVIEW');assert.equal(acceptedWorker.metadata.participant.kycChatChallenge.status,'COMPLETED');assert.equal(acceptedWorker.metadata.participant.clerkUserId,acceptedAccount.userId);assert.deepEqual(acceptedWorker.metadata.participant.permissions,accepted.participant.permissions);
 assert.equal(digest((await query(`SELECT * FROM public."PlatformUser" ORDER BY id`)).rows),acceptedAccounts);assert.equal(digest((await query(`SELECT * FROM public."TenantMembership" ORDER BY id`)).rows),acceptedMemberships);assert.equal(digest((await query(`SELECT * FROM public."ProjectMembership" ORDER BY id`)).rows),acceptedProjects);assert.equal(membershipChecks,3);assert.equal(blob.puts(),6);assert.equal(downloads,6);
 const acceptedSends=sends;assert.equal((await processor.process(acceptedReply.eventId)).done,true);assert.equal(sends,acceptedSends);assert.equal(blob.puts(),6);
 for(const table of ['AttendanceEntry','Incident','OperationalProposal'])assert.equal((await query(`SELECT count(*)::int AS n FROM public."${table}"`)).rows[0].n,0);
 assert.equal((await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE metadata->>'kind' IN ('REVIEW_KYC','FIELD_PERMISSIONS_CHANGED')`)).rows[0].n,0);assert.equal(networkCalls,0);assert.deepEqual(sqlFailures,[]);
 checks.push('accepted-account-after-invitation-expiry-signed-private-KYC-completes-PENDING_REVIEW-once-without-changing-account-permissions-or-operational-records');
 const pendingSnapshot=await snapshot(p3.id),pendingMetadata=structuredClone((await worker(p3.id)).metadata),providerMembershipReads=membershipChecks;
 let pendingPuts=blob.puts(),pendingDownloads=downloads;
 const pendingStatus=await execute('ESTADO',{sender:p3.sender});assert.equal(pendingStatus.result.replySent,true);assert.equal((await recordedIntake(pendingStatus.eventId)).reactiveKycStatus.status,'PENDING_REVIEW');assert.match(pendingStatus.message.body,/pendiente de revisión independiente/);assert.equal(await snapshot(p3.id),pendingSnapshot);assert.equal(blob.puts(),pendingPuts);assert.equal(downloads,pendingDownloads);assert.equal(membershipChecks,providerMembershipReads);
 assertPendingWorksiteReply(pendingStatus.message);
 const pendingStatusSends=sends;
 assert.equal((await processor.process(pendingStatus.eventId)).done,true);
 assert.equal(sends,pendingStatusSends);
 assert.equal(await snapshot(p3.id),pendingSnapshot);
 await failSame(p3,'ESTADO',{},()=>query(`UPDATE public."TenantMembership" SET status='DISABLED' WHERE id=$1`,[ownMembership]),()=>query(`UPDATE public."TenantMembership" SET status='ACTIVE' WHERE id=$1`,[ownMembership]));
 await failSame(p3,'ESTADO',{},()=>query(`UPDATE public."ProjectMembership" SET status='DISABLED' WHERE "tenantMembershipId"=$1 AND "projectId"='project-c'`,[ownMembership]),()=>query(`UPDATE public."ProjectMembership" SET status='ACTIVE' WHERE "tenantMembershipId"=$1 AND "projectId"='project-c'`,[ownMembership]));
 const missingAdoption=structuredClone(pendingMetadata);missingAdoption.participant.kyc.channelCapture.receiptId='participant_'+'0'.repeat(64);await failSame(p3,'ESTADO',{},()=>query(`UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1`,[p3.id,JSON.stringify(missingAdoption)]),()=>query(`UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1`,[p3.id,JSON.stringify(pendingMetadata)]));
 checks.push('accepted-pending-review-status-requires-current-own-TM-PM-and-exact-capture-receipt-without-provider-lookups');
 const currentReviews=async submissionId=>(await query(`SELECT id,"actorId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND metadata->>'projectId'=$3 AND metadata->>'kind'='REVIEW_KYC' AND metadata->>'submissionId'=$4`,['org-a',p3.id,context.projectId,submissionId])).rows;
 let rejectedReviewRows=null,rejectedSubmissionId=null;
 if(kycCorrection){
  const original=await worker(p3.id),oldChallenge=original.metadata.participant.kycChatChallenge,oldKyc=original.metadata.participant.kyc;
  rejectedSubmissionId=oldKyc.submissionId;
  const privateReason='Synthetic reviewer asks for clearer photos';
  const rejection={...directorContext,operationId:randomUUID(),action:'REVIEW_KYC',payload:{workerId:p3.id,revision:original.revision,submissionId:rejectedSubmissionId,decision:'REJECTED',reason:privateReason}};
  const rejected=await jsonResponse(await directorHttp.POST(post(participantEndpoint,rejection)));
  assert.equal(rejected.participant.kyc.status,'REJECTED');
  rejectedReviewRows=await currentReviews(rejectedSubmissionId);
  assert.equal(rejectedReviewRows.length,1);assert.equal(rejectedReviewRows[0].id,rejected.receiptId);
  assert.equal(rejectedReviewRows[0].metadata.decision,'REJECTED');assert.notEqual(rejectedReviewRows[0].actorId,acceptedAudit.actorId);
  const rejectedSnapshot=await snapshot(p3.id),rejectedStatus=await execute('ESTADO',{sender:p3.sender});
  assert.equal((await recordedIntake(rejectedStatus.eventId)).reactiveKycStatus.status,'REJECTED');
  assertCorrectionWorksiteReply(rejectedStatus.message);
  assert.ok(!JSON.stringify(rejectedStatus).includes(privateReason));
  assert.equal(await snapshot(p3.id),rejectedSnapshot);assert.equal(blob.puts(),pendingPuts);assert.equal(downloads,pendingDownloads);
  const person={...director,userId:acceptedAccount.userId},personal={projectId:context.projectId,scope:(await workspace.list(person)).scope};
  const channelStore=createWorkerChannelStore({workspace,environment});
  const assertNotEligible=async()=>{const state=(await channelStore.read(person,personal)).records.find(row=>row.workerId===p3.id);assert.equal(state.eligible,false);assert.equal(state.binding,null);};
  await assertNotEligible();
  const rejectedWorker=await worker(p3.id);
  assert.equal(rejectedWorker.metadata.participant.kycChatChallenge.status,'COMPLETED');
  const prepare={...directorContext,operationId:randomUUID(),action:'PREPARE_KYC_CHAT',payload:{workerId:p3.id,revision:rejectedWorker.revision}};
  const prepared=await jsonResponse(await directorHttp.POST(post(participantEndpoint,prepare)));
  assert.match(prepared.code,/^IDENTIDAD [A-Za-z0-9_-]{43}$/);
  const replay=await jsonResponse(await directorHttp.POST(post(participantEndpoint,prepare)));
  assert.equal(replay.receiptId,prepared.receiptId);assert.equal(replay.codeUnavailable,true);assert.equal(replay.code,undefined);
  const fresh=(await worker(p3.id)).metadata.participant.kycChatChallenge;
  assert.equal(fresh.status,'PENDING');assert.equal(fresh.analysisConsentVersion,3);assert.equal(fresh.captureImageSetVersion,2);
  assert.notEqual(fresh.id,oldChallenge.id);assert.notEqual(fresh.codeDigest,oldChallenge.codeDigest);
  assert.equal(fresh.projectId,context.projectId);assert.equal(fresh.connectionId,channelId);assert.equal(fresh.workerId,p3.id);
  assert.equal(fresh.participantClerkUserId,acceptedAccount.userId);assert.equal(fresh.senderE164,'+'+p3.sender);
  assert.equal(Date.parse(fresh.expiresAt)-Date.parse(fresh.createdAt),24*60*60*1000);
  assert.equal(new Set([sha(lifecyclePng),...[...correctionImages.values()].map(sha)]).size,4);
  let step=await execute(prepared.code,{sender:p3.sender});assert.equal(step.result.replySent,true);
  for(const title of ['Autorizar imágenes','Autorizar dorso','Sin lectura asistida','Revisión manual'])step=await execute(choice(step,title),{sender:p3.sender,reply:step.messageId});
  let index=0;
  for(const bytes of correctionImages.values()){
   const mediaId=String(150000701+index++);identityMedia.set(mediaId,bytes);
   step=await execute({type:'image',image:{id:mediaId,mime_type:'image/png'}},{sender:p3.sender,reply:step.messageId});
   assert.equal(step.result.replySent,true);assert.equal(blob.puts(),pendingPuts);assert.equal(downloads,pendingDownloads);
  }
  const corrected=await execute(choice(step,'Presentar identidad'),{sender:p3.sender,reply:step.messageId});
  assert.equal(corrected.result.businessApplied,true);assert.equal(corrected.result.replySent,true);
  pendingPuts+=3;pendingDownloads+=3;
  const recaptured=(await worker(p3.id)).metadata.participant;
  assert.equal(recaptured.kyc.status,'PENDING_REVIEW');assert.equal(recaptured.kycChatChallenge.status,'COMPLETED');assert.equal(recaptured.kycChatChallenge.id,fresh.id);
  assert.equal(recaptured.kyc.channelCapture.challengeId,fresh.id);assert.notEqual(recaptured.kyc.submissionId,rejectedSubmissionId);
  assert.notEqual(recaptured.kyc.contentHash,oldKyc.contentHash);assert.equal(recaptured.kyc.review,undefined);
  assert.deepEqual(recaptured.permissions,accepted.participant.permissions);assert.equal(blob.puts(),pendingPuts);assert.equal(downloads,pendingDownloads);
  const afterCorrection=await snapshot(p3.id),afterSends=sends;
  assert.equal((await processor.process(corrected.eventId)).done,true);assert.equal(sends,afterSends);assert.equal(await snapshot(p3.id),afterCorrection);
  assert.equal(blob.puts(),pendingPuts);assert.equal(downloads,pendingDownloads);
  const stale=await jsonResponse(await directorHttp.POST(post(participantEndpoint,rejection)));
  assert.equal(stale.receiptId,rejected.receiptId);assert.equal(stale.participant.kyc.submissionId,recaptured.kyc.submissionId);
  assert.equal(stale.participant.kyc.status,'PENDING_REVIEW');assert.deepEqual(await currentReviews(rejectedSubmissionId),rejectedReviewRows);
  const current=await worker(p3.id),wrongSubmission={...rejection,operationId:randomUUID(),payload:{...rejection.payload,revision:current.revision,decision:'APPROVED'}};
  const denied=await jsonResponse(await directorHttp.POST(post(participantEndpoint,wrongSubmission)),409);
  assert.equal(denied.code,'PARTICIPANT_KYC_NOT_PENDING');assert.equal(await snapshot(p3.id),afterCorrection);
  await assertNotEligible();
  checks.push('same-signed-CURRENT-v3-submission-DIRECTOR-rejection-fresh-v3-correction-three-new-private-images-and-original-review-retained');
 }
 const currentForReview=await worker(p3.id),kycForReview=currentForReview.metadata.participant.kyc;
 assert.notEqual(acceptedAudit.actorId,'owner');
 const review=command('REVIEW_KYC',{workerId:p3.id,revision:currentForReview.revision,submissionId:kycForReview.submissionId,decision:'APPROVED',reason:'Synthetic independent reviewer in canonical store; not real identity acceptance'});
 let reviewed;
 if(businessApp){
  const dashboard=await jsonResponse(await directorHttp.GET(get(participantEndpoint,directorContext)));
  const pending=dashboard.records.find(row=>row.id===p3.id);assert.equal(pending?.kyc.status,'PENDING_REVIEW');assert.equal(pending.kyc.images.length,3);
  for(const image of pending.kyc.images){
   const preview=await directorHttp.GET(get(participantEndpoint,{...directorContext,workerId:p3.id,imageId:image.id}));
   assert.equal(preview.status,200);assert.match(preview.headers.get('cache-control'),/private, no-store/);
   assert.deepEqual(Buffer.from(await preview.arrayBuffer()),kycCorrection?correctionImages.get(image.kind):lifecyclePng);
  }
  const directorReview={...review,...directorContext};
  reviewed=await jsonResponse(await directorHttp.POST(post(participantEndpoint,directorReview)));
  const replay=await jsonResponse(await directorHttp.POST(post(participantEndpoint,directorReview)));assert.equal(replay.receiptId,reviewed.receiptId);
  const receipts=(await query('SELECT a."actorId",m."tenantRole"::text AS role FROM public."AuditLog" a JOIN public."TenantMembership" m ON m."userId"=a."actorId" AND m."organizationId"=a."organizationId" WHERE a.id=$1 AND m.id=$2',[reviewed.receiptId,directorMembershipId])).rows;
  assert.equal(receipts.length,1);assert.equal(receipts[0].role,'DIRECTOR');assert.notEqual(receipts[0].actorId,'owner');assert.notEqual(receipts[0].actorId,acceptedAudit.actorId);
  assert.deepEqual((await worker(p3.id)).metadata.participant.permissions,accepted.participant.permissions);
  if(kycCorrection){
   const approvedRows=await currentReviews(kycForReview.submissionId);
   assert.equal(approvedRows.length,1);assert.equal(approvedRows[0].id,reviewed.receiptId);assert.equal(approvedRows[0].metadata.decision,'APPROVED');
   assert.equal(approvedRows[0].actorId,rejectedReviewRows[0].actorId);assert.deepEqual(await currentReviews(rejectedSubmissionId),rejectedReviewRows);
   checks.push('DIRECTOR-approval-belongs-to-corrected-submission-and-leaves-original-rejection-receipt-unchanged');
  }
  checks.push('same-destination-canonical-DIRECTOR-private-3-image-review-APPROVED-one-receipt-no-permission-change');
 }else reviewed=await store.save(owner,review);
 assert.equal(reviewed.saved,true);
 if(kycCorrection){
  await failSame(p3,'ESTADO');
  assert.equal((await worker(p3.id)).metadata.participant.channelIdentity?.binding,undefined);
  checks.push('original-reactive-status-cannot-claim-an-approval-from-the-manually-reissued-challenge');
 }else{
  const reviewedSnapshot=await snapshot(p3.id),approvedStatus=await execute('HOLA',{sender:p3.sender});assert.equal(approvedStatus.result.replySent,true);assert.equal((await recordedIntake(approvedStatus.eventId)).reactiveKycStatus.status,'APPROVED');assert.match(approvedStatus.message.body,/identidad fue aprobada/);assert.match(approvedStatus.message.body,/no concede permisos ni vincula/);assert.equal(await snapshot(p3.id),reviewedSnapshot);assert.equal((await worker(p3.id)).metadata.participant.channelIdentity?.binding,undefined);assert.equal(blob.puts(),pendingPuts);assert.equal(downloads,pendingDownloads);
  const beforeStatusReplay=sends;assert.equal((await processor.process(approvedStatus.eventId)).done,true);assert.equal(sends,beforeStatusReplay);assert.equal(await snapshot(p3.id),reviewedSnapshot);
  const reviewRow=(await currentReviews(kycForReview.submissionId))[0];assert.ok(reviewRow);await failSame(p3,'ESTADO',{},()=>query(`UPDATE public."AuditLog" SET "actorId"=$2 WHERE id=$1`,[reviewRow.id,acceptedAudit.actorId]),()=>query(`UPDATE public."AuditLog" SET "actorId"=$2 WHERE id=$1`,[reviewRow.id,reviewRow.actorId]));
  checks.push('canonical-other-actor-review-approved-status-uses-real-review-receipt-and-never-grants-or-binds-or-replays-send');
 }
 if(businessApp){
  const person={...director,userId:acceptedAccount.userId},personal={projectId:context.projectId,scope:(await workspace.list(person)).scope};
  const endpoint='https://obrasaas.com/api/identity/worker-channel';
  const channelHttp=createWorkerChannelHandlers({verify:async()=>person,store:createWorkerChannelStore({workspace,environment})});
  const ownChannel=async()=>(await jsonResponse(await channelHttp.GET(get(endpoint,personal)))).records.find(row=>row.workerId===p3.id);
  const eligible=await ownChannel();assert.equal(eligible.eligible,true);assert.equal(eligible.state,'NOT_LINKED');
  const bindingRequest={...personal,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:p3.id,revision:eligible.revision}};
  const issued=await jsonResponse(await channelHttp.POST(post(endpoint,bindingRequest)));assert.match(issued.code,/^VINCULAR [A-Za-z0-9_-]{43}$/);
  const recovered=await jsonResponse(await channelHttp.POST(post(endpoint,bindingRequest)));
  assert.equal(recovered.receiptId,issued.receiptId);assert.equal(recovered.codeUnavailable,true);assert.equal(recovered.code,undefined);

  const noFieldMedia=async()=>assert.fail('Synthetic evidence must not invoke an analyzer');
  const worksiteBlob=createControlledLifecycleBlob(),evidenceMediaId='150000491';
  let allowWorksitePhoto=false,fieldPhotoDownloads=0;
  const manualMediaAnalyzer={analyzePhoto:noFieldMedia,transcribeAudio:noFieldMedia};
  let fieldSends=0;
  const fieldProvider={async downloadMedia({mediaId,phoneNumberId:downloadPhone,beforeExternal}){
   assert.equal(allowWorksitePhoto,true);assert.equal(mediaId,evidenceMediaId);assert.equal(downloadPhone,phoneNumberId);
   assert.equal(typeof beforeExternal,'function');await beforeExternal();
   fieldPhotoDownloads++;
   return {bytes:lifecyclePng,contentType:'image/png'};
  },async sendReply(input){
   assert.equal(input.phoneNumberId,phoneNumberId);assert.equal(input.to,p3.sender);assert.equal(typeof input.finalBeforeExternal,'function');
   await input.finalBeforeExternal();
   fieldSends++;
   return provider.sendReply(input);
  }};
  const companyBridge=createCompanyChannelBridge({connect,environment,provider:fieldProvider,put:worksiteBlob.put,get:worksiteBlob.get,analyzer:manualMediaAnalyzer,planAnalyzer:{analyze:noFieldMedia}});
  const companyOutbound=createMetaCustomerOutbound({connect,environment,provider:fieldProvider,resolveIdentity:resolveCompanyOutboundIdentity,sourceContext:true});
  const fieldProcessor=createMetaCustomerProcessor({connect,environment,
   authorizationCodes:[...EMPLOYEE_INTAKE_AUTHORIZATION_CODES,...META_KYC_AUTHORIZATION_CODES,'COMPANY_CHANNEL_SOURCE_REQUIRED'],
   dispatch:async c=>(await bridge.executeIntake(c))||(await bridge.execute(c))||companyBridge.execute(c),
   outbound:{send:(c,reply,{purpose})=>purpose==='FIELD'?companyOutbound.send(c,reply):outbound.send(c,reply,{purpose})}
  });
  const field=async(message,reply=null,applied=false)=>{
   const eventId=await push(message,{sender:p3.sender,reply}),result=await fieldProcessor.process(eventId);
   assert.equal(result.businessApplied,applied,result.code);assert.equal(result.replySent,true,result.replyState||result.code);
   return {eventId,result,...messages.get(customerOutboundId(eventId))};
  };
  const routed=async(eventId)=> (await query('SELECT e.kind,e."projectId",e."workerId",e."connectionId",e."bindingId",e."routeId",e."routeEpoch",w."projectId" AS "sourceProjectId",w.payload FROM public."WhatsAppCompanyEventRoute" e JOIN public."WebhookEvent" w ON w.id=e."sourceEventId" WHERE e."sourceEventId"=$1',[eventId])).rows;
  const bound=await field(issued.code);assert.equal(bound.result.kind,'CHANNEL_BOUND');
  const identity=(await worker(p3.id)).metadata.participant.channelIdentity,verified=await ownChannel();
  assert.equal(identity.binding.kycSubmissionId,kycForReview.submissionId);
  if(kycCorrection)assert.notEqual(identity.binding.kycSubmissionId,rejectedSubmissionId);
  assert.equal(identity.challenge.status,'CONSUMED');assert.equal(identity.binding.status,'VERIFIED');
  assert.equal(identity.binding.proofEventId,bound.eventId);assert.equal(verified.state,'VERIFIED');assert.equal(verified.binding.id,identity.binding.id);
  const bindings=await routed(bound.eventId);assert.equal(bindings.length,1);
  const binding=bindings[0];assert.equal(binding.kind,'BINDING');assert.equal(binding.sourceProjectId,anchor.projectId);assert.equal(binding.projectId,personal.projectId);assert.equal(binding.workerId,p3.id);assert.equal(binding.connectionId,channelId);assert.equal(binding.bindingId,identity.challenge.id);
  assert.equal(binding.payload.employeeIntakeDispatch,undefined);assert.ok(!JSON.stringify(binding.payload).includes(issued.code));
  const afterBinding=await snapshot(p3.id);
  assert.equal((await fieldProcessor.process(bound.eventId)).done,true);assert.equal(fieldSends,1);assert.equal(await snapshot(p3.id),afterBinding);assert.deepEqual(await routed(bound.eventId),bindings);
  checks.push('same-approved-account-HTTP-VINCULAR-signed-binding-on-assigned-destination-one-use-and-no-replay');

  const selection=await field('HOLA');assert.equal(selection.result.kind,'WORKSITE_SELECTION');
  assert.deepEqual(selection.message.sections.flatMap(section=>section.rows.map(row=>row.title)),['Synthetic destination B']);
  const confirmation=await field(choice(selection,'Synthetic destination B'),selection.messageId);assert.equal(confirmation.result.kind,'WORKSITE_CONFIRM');
  const selected=await field(choice(confirmation,'Confirmar obra'),confirmation.messageId);assert.equal(selected.result.kind,'WORKSITE_SELECTED');
  const greeting=await field('HOLA');assert.equal(greeting.result.kind,'CONVERSATION');assert.equal(greeting.message.type,'interactive');
  assert.deepEqual(greeting.message.sections.flatMap(section=>section.rows.map(row=>row.title)),['Entrada','Cronograma y tareas','Consultar estado']);
  assert.match(greeting.message.body,/Obra: Synthetic destination B/);
  assert.deepEqual((await worker(p3.id)).metadata.participant.permissions,{attendance:true,report:false});
  const fieldRoutes=await routed(greeting.eventId);assert.equal(fieldRoutes.length,1);
  const route=fieldRoutes[0];assert.equal(route.kind,'FIELD');assert.equal(route.sourceProjectId,anchor.projectId);assert.equal(route.projectId,personal.projectId);assert.equal(route.workerId,p3.id);assert.equal(route.connectionId,channelId);assert.equal(route.bindingId,identity.binding.id);assert.equal(route.payload.employeeIntakeDispatch,undefined);
  const selectedRoute=(await query('SELECT epoch,"projectId","workerId","bindingId" FROM public."WhatsAppCompanyRoute" WHERE id=$1',[route.routeId])).rows;
  assert.deepEqual(selectedRoute,[{epoch:route.routeEpoch,projectId:personal.projectId,workerId:p3.id,bindingId:identity.binding.id}]);
  const afterMenu=await snapshot(p3.id);
  assert.equal((await fieldProcessor.process(greeting.eventId)).done,true);assert.equal(fieldSends,5);assert.equal(await snapshot(p3.id),afterMenu);assert.deepEqual(await routed(greeting.eventId),fieldRoutes);
  for(const table of ['AttendanceEntry','Incident','OperationalProposal'])assert.equal((await query('SELECT count(*)::int AS n FROM public."'+table+'"')).rows[0].n,0);
  assert.equal(blob.puts(),pendingPuts);assert.equal(downloads,pendingDownloads);
  checks.push('same-bound-account-confirms-destination-signed-HOLA-shows-jornada-and-read-actions-no-reports-and-no-replay');
  const operations=createFieldOperations({workspace}),fieldEndpoint='https://obrasaas.com/api/identity/field-operations';
  const ownerField=createFieldHandlers({verify:async()=>owner,operations}),personField=createFieldHandlers({verify:async()=>person,operations}),directorField=createFieldHandlers({verify:async()=>director,operations});
  const ownerSite=await jsonResponse(await ownerField.GET(get(fieldEndpoint,context)));
  const sector={id:'sector-pilot',name:'Sector sintético',latitude:0,longitude:0,radius:100};
  const configured=await jsonResponse(await ownerField.POST(post(fieldEndpoint,command('CONFIGURE_SITE',{revision:ownerSite.projectRevision,sectors:[sector]}))));
  assert.equal(configured.kind,'CONFIGURATION');assert.equal(configured.qrTokens.length,1);assert.equal(configured.qrTokens[0].sectorId,sector.id);
  const qrToken=configured.qrTokens[0].token;assert.match(qrToken,/^[a-f0-9]{64}$/);
  const ownSite=await jsonResponse(await personField.GET(get(fieldEndpoint,personal)));
  assert.equal(ownSite.sectors.find(row=>row.id===sector.id)?.radius,sector.radius);
  assert.ok(!JSON.stringify(ownSite).includes(qrToken),'Ordinary operator read must not disclose the QR secret');

  const readEvents=async()=>(await jsonResponse(await personField.GET(get(fieldEndpoint,personal)))).attendance.sort((left,right)=>left.sequence-right.sequence);
  const chooseField=(previous,title,applied=false)=>field(choice(previous,title),previous.messageId,applied);
  async function whatsappPunch(menu,action,position){
   let step=await chooseField(menu,action);step=await chooseField(step,sector.name);
   if(position){
    assert.match(step.message.body,/WhatsApp no informa precisión GPS/);
    step=await chooseField(step,'Continuar');
    if(action==='Entrada'){
     const denied=await field({type:'location',location:position});
     assert.equal(denied.result.kind,'WORKSITE_INPUT_CONTEXT_REQUIRED');assert.deepEqual(await readEvents(),[]);
    }
    step=await field({type:'location',location:position},step.messageId);
    assert.match(step.message.body,/revisión humana/);
   }
   const applied=await chooseField(step,'Guardar',true);assert.equal(applied.result.kind,'ATTENDANCE');
   const records=await readEvents(),event=records.at(-1),projections=await routed(applied.eventId);
   assert.equal(event.source,'meta-customer');assert.equal(event.workerId,p3.id);assert.equal(event.sectorId,sector.id);assert.equal(projections.length,1);
   assert.equal(projections[0].kind,'FIELD');assert.equal(projections[0].projectId,personal.projectId);assert.equal(projections[0].sourceProjectId,anchor.projectId);
   const sendCount=fieldSends;
   assert.equal((await fieldProcessor.process(applied.eventId)).done,true);assert.equal(fieldSends,sendCount);assert.deepEqual(await readEvents(),records);
   return {event,receiptId:applied.result.receiptId};
  }
  const waEntry=await whatsappPunch(greeting,'Entrada',{latitude:1,longitude:1});
  assert.equal(waEntry.event.eventType,'CHECK_IN');assert.equal(waEntry.event.verificationStatus,'REVIEW_REQUIRED');
  assert.equal(waEntry.event.qrStatus,'NOT_PROVIDED');assert.equal(waEntry.event.location.accuracyMeters,null);assert.ok(waEntry.event.location.distanceMeters>sector.radius);
  const waExit=await whatsappPunch(await field('HOLA'),'Salida',{latitude:0,longitude:0});
  assert.equal(waExit.event.eventType,'CHECK_OUT');assert.equal(waExit.event.shiftId,waEntry.event.shiftId);assert.equal(waExit.event.verificationStatus,'REVIEW_REQUIRED');
  assert.equal(waExit.event.qrStatus,'NOT_PROVIDED');assert.equal(waExit.event.location.accuracyMeters,null);assert.equal(waExit.event.location.distanceMeters,0);
  assert.equal((await readEvents()).length,2);
  checks.push('signed-location-requires-quoted-prompt-and-outside-WhatsApp-punches-stay-review-required-without-duplicate');

  const webPunch=(eventType,prior,token=qrToken)=>({...personal,operationId:randomUUID(),action:'ATTENDANCE',payload:{workerId:p3.id,eventType,expectedEventId:prior.id,sectorId:sector.id,qrToken:token,location:{latitude:0,longitude:0,accuracy:5,capturedAt:new Date().toISOString(),noticeVersion:FIELD_NOTICE}}});
  const postField=(body,expected)=>personField.POST(post(fieldEndpoint,body)).then(response=>jsonResponse(response,expected));
  const invalidToken=(qrToken[0]==='f'?'0':'f')+qrToken.slice(1);
  const invalid=await postField(webPunch('CHECK_IN',waExit.event,invalidToken),422);assert.equal(invalid.code,'FIELD_QR_INVALID');assert.equal((await readEvents()).length,2);
  const entryRequest=webPunch('CHECK_IN',waExit.event),entered=await postField(entryRequest),entryReplay=await postField(entryRequest);
  assert.equal(entered.event.verificationStatus,'VERIFIED');assert.equal(entered.event.qrStatus,'MATCHED');assert.equal(entered.event.location.accuracyMeters,5);
  assert.equal(entryReplay.replayed,true);assert.equal(entryReplay.receiptId,entered.receiptId);assert.equal(entryReplay.event.id,entered.event.id);
  const pause=await whatsappPunch(await field('HOLA'),'Iniciar pausa');
  assert.equal(pause.event.previousEventId,entered.event.id);assert.equal(pause.event.verificationStatus,'NOT_REQUIRED');
  await new Promise(resolve=>setTimeout(resolve,15));
  const resumed=await whatsappPunch(await field('HOLA'),'Volver de pausa');
  assert.equal(resumed.event.previousEventId,pause.event.id);assert.equal(resumed.event.verificationStatus,'NOT_REQUIRED');
  const exitRequest=webPunch('CHECK_OUT',resumed.event),exited=await postField(exitRequest),exitReplay=await postField(exitRequest);
  assert.equal(exited.event.verificationStatus,'VERIFIED');assert.equal(exited.event.qrStatus,'MATCHED');assert.equal(exitReplay.replayed,true);assert.equal(exitReplay.receiptId,exited.receiptId);
  const verifiedShift=[entered.event,pause.event,resumed.event,exited.event];
  assert.deepEqual(verifiedShift.map(row=>row.eventType),['CHECK_IN','BREAK_START','BREAK_END','CHECK_OUT']);
  assert.ok(verifiedShift.every(row=>row.shiftId===entered.event.shiftId&&row.recordedBy===acceptedAudit.actorId));
  const ledger=(await query('SELECT "projectId","workerId" FROM public."AttendanceEntry"')).rows;
  assert.equal(ledger.length,6);assert.ok(ledger.every(row=>row.projectId===personal.projectId&&row.workerId===p3.id));
  checks.push('same-operator-web-GPS-QR-entry-exit-and-signed-WhatsApp-pause-resume-share-one-canonical-shift');

  const hoursFrom=waEntry.event.recordedAt.slice(0,10),lastDate=exited.event.recordedAt.slice(0,10),hoursUntil=new Date(Date.parse(lastDate+'T00:00:00.000Z')+86400000).toISOString().slice(0,10);
  const hoursParams={hoursFrom,hoursUntil,hoursTimeZone:'UTC',hoursFormat:'json'};
  const report=await jsonResponse(await directorField.GET(get(fieldEndpoint,{...directorContext,...hoursParams})));
  assert.equal(report.kind,'FIELD_HOURS_REPORT');assert.equal(report.complete,true);assert.equal(report.rows.length,2);
  assert.equal(report.salaryCalculated,false);assert.equal(report.paymentEnabled,false);
  const deniedHours=await jsonResponse(await personField.GET(get(fieldEndpoint,{...personal,...hoursParams})),403);assert.equal(deniedHours.code,'FIELD_HOURS_PERMISSION_REQUIRED');
  const pendingShift=report.rows.find(row=>row.shiftId===waEntry.event.shiftId),readyShift=report.rows.find(row=>row.shiftId===entered.event.shiftId);
  assert.equal(pendingShift.evidenceStatus,'PENDING_REVIEW');assert.equal(pendingShift.readyForOperationalReview,false);
  assert.deepEqual(pendingShift.events.map(event=>event.recordingReceiptId),[waEntry.receiptId,waExit.receiptId]);
  assert.equal(readyShift.status,'CLOSED');assert.equal(readyShift.auditStatus,'CONFIRMED');assert.equal(readyShift.readyForOperationalReview,true);
  assert.deepEqual(readyShift.sourceEventIds,verifiedShift.map(event=>event.id));
  assert.deepEqual(readyShift.events.map(event=>event.recordingReceiptId),[entered.receiptId,pause.receiptId,resumed.receiptId,exited.receiptId]);
  const elapsedMs=Date.parse(exited.event.recordedAt)-Date.parse(entered.event.recordedAt),breakMs=Date.parse(resumed.event.recordedAt)-Date.parse(pause.event.recordedAt);
  assert.ok(breakMs>0);assert.ok(elapsedMs>breakMs);assert.equal(readyShift.elapsedMs,elapsedMs);assert.equal(readyShift.breakMs,breakMs);assert.equal(readyShift.netMs,elapsedMs-breakMs);
  assert.equal(report.totals.closedEvidenceReadyNetMs,readyShift.netMs);
  checks.push('Director-hours-report-matches-six-audited-punches-excludes-registered-breaks-and-separates-pending-evidence');
  const diagram=readFileSync(new URL('./fixtures/'+planFixture.name,import.meta.url));
  assert.equal(sha(diagram),planFixture.sha256);
  const extractionRows=JSON.parse(readFileSync(new URL('./fixtures/plan-import-synthetic-v1.json',import.meta.url),'utf8')).expectedRows;
  let extractions=0;
  const imports=createPlanImport({workspace,put:worksiteBlob.put,get:worksiteBlob.get,environment:()=>environment,analyzer:{async analyze(source){
   assert.equal(source.contentType,planFixture.contentType);assert.equal(source.sha256,planFixture.sha256);extractions++;
   return {success:true,rows:extractionRows.map((row,index)=>({...row,evidence:'Fila '+(index+1)+' del '+planFixture.label+' sintético.',uncertainty:''})),warnings:[],provider:'synthetic-openai-adapter',model:'synthetic'};
  }}});
  const planEndpoint='https://obrasaas.com/api/identity/plan-import',directorPlan=createPlanImportHandlers({verify:async()=>director,imports}),form=new FormData();
  for(const [key,value] of Object.entries({...directorContext,operationId:randomUUID(),consent:PLAN_IMPORT_CONSENT}))form.set(key,value);
  form.set('file',new Blob([diagram],{type:planFixture.contentType}),planFixture.name);
  const draft=await jsonResponse(await directorPlan.POST(new Request(planEndpoint,{method:'POST',headers:{origin:'https://obrasaas.com'},body:form})));
  assert.equal(draft.draft.status,'READY');assert.deepEqual(draft.draft.source,{contentType:planFixture.contentType,bytes:diagram.length,sha256:planFixture.sha256});assert.equal(extractions,1);assert.equal(worksiteBlob.puts(),1);assert.equal(fieldPhotoDownloads,0);
  const beforeApply=await workspace.read(director,directorContext);
  assert.ok(!beforeApply.tasks.some(task=>task.title===extractionRows[0].title));
  const applyPlan={...directorContext,operationId:randomUUID(),draftId:draft.draft.id,expectedRevision:draft.draft.revision,action:'APPLY',rows:draft.draft.rows,reason:'Dirección revisó los plazos del '+planFixture.label+' sintético.'};
  const appliedPlan=await jsonResponse(await directorPlan.POST(post(planEndpoint,applyPlan))),appliedReplay=await jsonResponse(await directorPlan.POST(post(planEndpoint,applyPlan)));
  assert.equal(appliedPlan.draft.status,'APPLIED');assert.equal(appliedPlan.tasks.length,extractionRows.length);
  assert.equal(appliedReplay.replayed,true);assert.equal(appliedReplay.receiptId,appliedPlan.receiptId);assert.equal(extractions,1);
  const task=appliedPlan.tasks.find(row=>row.title===extractionRows[0].title);assert.ok(task);
  const taskState=async()=>(await query('SELECT progress,metadata FROM public."Task" WHERE id=$1 AND "projectId"=$2',[task.id,personal.projectId])).rows[0];
  const importProvenance=(await taskState()).metadata.planImport;assert.equal(importProvenance.receiptId,appliedPlan.receiptId);assert.equal(importProvenance.sourceSha256,planFixture.sha256);
  assert.equal((await taskState()).progress,0);
  checks.push('same-destination-Director-HTTP-imports-reviewed-synthetic-'+(planImage?'PNG-diagram':'PDF')+'-once-without-changing-unapproved-progress');

  const beforeGrant=await worker(p3.id),ownParticipants=createParticipantHandlers({verify:async()=>person,store});
  assert.deepEqual(beforeGrant.metadata.participant.permissions,{attendance:true,report:false});
  const grant=command('SET_FIELD_PERMISSIONS',{workerId:p3.id,revision:beforeGrant.revision,permissions:{attendance:true,report:true},reason:'Administración habilita reportes para la prueba sintética de esta obra.'});
  const selfGrant=await jsonResponse(await ownParticipants.POST(post(participantEndpoint,{...grant,...personal})),403);
  assert.equal(selfGrant.code,'PARTICIPANT_MANAGE_REQUIRED');assert.deepEqual(await worker(p3.id),beforeGrant);
  const granted=await jsonResponse(await ownerHttp.POST(post(participantEndpoint,grant))),grantReplay=await jsonResponse(await ownerHttp.POST(post(participantEndpoint,grant)));
  assert.equal(granted.saved,true);assert.equal(grantReplay.receiptId,granted.receiptId);
  const authorized=(await worker(p3.id)).metadata.participant;assert.equal(authorized.fieldPermissionDecision.receiptId,granted.receiptId);
  assert.deepEqual(authorized.permissions,{attendance:true,report:true});assert.equal(authorized.channelIdentity.binding.id,identity.binding.id);

  const fieldView=async()=>jsonResponse(await directorField.GET(get(fieldEndpoint,directorContext)));
  const directorAction=(action,payload)=>({...directorContext,operationId:randomUUID(),action,payload});
  const reviewField=body=>directorField.POST(post(fieldEndpoint,body)).then(response=>jsonResponse(response));
  async function selectTask(action){
   const start=await field('HOLA');
   let selected=action==='CONSUMO'?await field(action,start.messageId):await chooseField(start,action);
   selected=await chooseField(selected,task.title.slice(0,24));
   return chooseField(selected,sector.name);
  }
  const preparedPhoto=await selectTask('Enviar evidencia');
  const image={type:'image',image:{id:evidenceMediaId,mime_type:'image/png',caption:'Foto sintética de la tarea importada.'}};
  const unquotedPhoto=await field(image);assert.equal(unquotedPhoto.result.kind,'WORKSITE_INPUT_CONTEXT_REQUIRED');assert.equal(fieldPhotoDownloads,0);assert.equal(worksiteBlob.puts(),1);
  const offeredPhoto=await field(image,preparedPhoto.messageId);assert.equal(offeredPhoto.result.kind,'CONVERSATION');
  assert.equal(fieldPhotoDownloads,0);assert.equal(worksiteBlob.puts(),1);
  allowWorksitePhoto=true;
  const photo=await chooseField(offeredPhoto,'Sólo guardar',true);
  allowWorksitePhoto=false;
  assert.equal(photo.result.kind,'EVIDENCE');assert.equal(fieldPhotoDownloads,1);assert.equal(worksiteBlob.puts(),2);
  const afterPhotoSends=fieldSends;
  assert.equal((await fieldProcessor.process(photo.eventId)).done,true);assert.equal(fieldSends,afterPhotoSends);
  assert.equal(fieldPhotoDownloads,1);assert.equal(worksiteBlob.puts(),2);
  const [photoRoute]=await routed(photo.eventId);assert.equal(photoRoute.projectId,personal.projectId);assert.equal(photoRoute.sourceProjectId,anchor.projectId);
  const evidence=(await fieldView()).evidence.find(row=>row.taskId===task.id);
  assert.equal(evidence?.status,'PENDING');assert.equal(evidence.workerId,p3.id);assert.equal(evidence.sectorId,sector.id);
  const privateMedia=createFieldMedia({operations,put:worksiteBlob.put,get:worksiteBlob.get,analyzer:manualMediaAnalyzer,environment:()=>environment});
  const mediaHttp=createFieldMediaHandlers({verify:async()=>director,media:privateMedia});
  const evidenceFile=await mediaHttp.GET(get('https://obrasaas.com/api/identity/field-media',{...directorContext,evidenceId:evidence.id}));
  assert.equal(evidenceFile.status,200);assert.match(evidenceFile.headers.get('cache-control'),/private, no-store/);assert.deepEqual(Buffer.from(await evidenceFile.arrayBuffer()),lifecyclePng);
  const evidenceDecision=await reviewField(directorAction('REVIEW_EVIDENCE',{evidenceId:evidence.id,revision:evidence.revision,decision:'APPROVE',reason:'Dirección revisó la foto privada de la tarea importada.'}));
  assert.equal(evidenceDecision.evidence.status,'APPROVED');assert.equal((await taskState()).progress,0);
  checks.push('explicit-report-grant-allows-same-signed-worker-private-photo-with-correlation-and-consent-once');

  let proposal=await selectTask('Proponer avance');
  proposal=await field('25%',proposal.messageId);
  proposal=await chooseField(proposal,'Fotografía de obra');
  proposal=await field('Medición sintética respaldada por la foto revisada de la tarea importada.',proposal.messageId);
  const savedProgress=await chooseField(proposal,'Guardar',true);assert.equal(savedProgress.result.kind,'PROGRESS_PROPOSAL');
  const sameProposal=(await fieldView()).proposals.find(row=>row.taskId===task.id);
  assert.equal(sameProposal?.workerId,p3.id);assert.deepEqual(sameProposal.evidenceIds,[evidence.id]);assert.equal((await taskState()).progress,0);
  const decideProgress=directorAction('DECIDE_PROGRESS',{proposalId:sameProposal.id,revision:sameProposal.revision,decision:'APPROVE',reason:'Dirección aprobó la medición sintética con evidencia revisada.'});
  const approvedProgress=await reviewField(decideProgress),progressReplay=await reviewField(decideProgress);
  assert.equal(approvedProgress.task.progress,25);assert.equal(progressReplay.receiptId,approvedProgress.receiptId);
  assert.equal((await taskState()).progress,25);
  const curve=await jsonResponse(await directorField.GET(get(fieldEndpoint,{...directorContext,progressCurveTaskId:task.id})));
  assert.equal(curve.state,'CONFIRMED');assert.equal(curve.total,1);
  assert.equal(curve.rows[0].origin,'HUMAN_APPROVAL');assert.equal(curve.rows[0].progress,25);assert.equal(curve.rows[0].receiptId,approvedProgress.receiptId);
  checks.push('same-imported-task-signed-proposal-stays-zero-until-Director-review-and-one-curve-point');

  const catalogSetup=await jsonResponse(await ownerField.GET(get(fieldEndpoint,context)));
  const saveOwner=body=>ownerField.POST(post(fieldEndpoint,body)).then(response=>jsonResponse(response));
  await saveOwner(command('ADD_MATERIAL',{revision:catalogSetup.projectRevision,catalogHash:catalogSetup.inventory.catalogHash,name:'Cemento sintético',unit:'bolsa'}));
  const catalog=(await fieldView()).inventory,material=catalog.materials.find(row=>row.name==='Cemento sintético');assert.ok(material);
  const opening=(await saveOwner(command('PROPOSE_STOCK_ADJUSTMENT',{materialId:material.id,catalogHash:catalog.catalogHash,quantity:'3.000',direction:'IN',source:{type:'OPENING',reference:planImage?'PILOTO-PNG-001':'PILOTO-PDF-001'},reason:'Saldo inicial sintético revisado para esta obra.'}))).adjustment;
  await reviewField(directorAction('DECIDE_STOCK_ADJUSTMENT',{proposalId:opening.id,revision:opening.revision,catalogHash:catalog.catalogHash,decision:'APPROVE',reason:'Dirección comprobó saldo y unidad de apertura.'}));
  const balance=async()=>(await fieldView()).inventory.materials.find(row=>row.id===material.id).balance;
  assert.equal(await balance(),'3.000');
  let consumption=await selectTask('CONSUMO');consumption=await chooseField(consumption,(material.name+' · '+material.unit).slice(0,24));
  consumption=await field('1.000',consumption.messageId);consumption=await field('Se consumió una bolsa sintética en la tarea importada.',consumption.messageId);
  const proposedConsumption=await chooseField(consumption,'Guardar',true);assert.equal(proposedConsumption.result.kind,'CONSUMPTION_PROPOSAL');assert.equal(await balance(),'3.000');
  const pendingConsumption=(await fieldView()).inventory.consumptions.find(row=>row.taskId===task.id);
  assert.equal(pendingConsumption?.state,'PENDING');assert.equal(pendingConsumption.workerId,p3.id);assert.equal(pendingConsumption.quantity,'1.000');
  const decideConsumption=directorAction('DECIDE_CONSUMPTION',{proposalId:pendingConsumption.id,revision:pendingConsumption.revision,catalogHash:catalog.catalogHash,decision:'APPROVE',reason:'Dirección comprobó el consumo de la tarea importada.'});
  const approvedConsumption=await reviewField(decideConsumption),consumptionReplay=await reviewField(decideConsumption);
  assert.equal(approvedConsumption.consumption.state,'APPROVED');assert.equal(consumptionReplay.receiptId,approvedConsumption.receiptId);assert.equal(await balance(),'2.000');
  assert.equal((await query("SELECT count(*)::int AS n FROM public.\"AuditLog\" WHERE action='material.inventory.moved' AND metadata->>'proposalId'=$1",[pendingConsumption.id])).rows[0].n,1);
  assert.deepEqual((await taskState()).metadata.planImport,importProvenance);
  const gantt=(await workspace.read(director,directorContext)).tasks.find(row=>row.id===task.id);
  assert.deepEqual([gantt.startsOn,gantt.endsOn,gantt.progress],[extractionRows[0].startsOn,extractionRows[0].endsOn,25]);
  checks.push('same-signed-worker-consumption-does-not-decrement-stock-until-Director-approval-with-single-movement');
  if(planImage)planImageSource={contentType:planFixture.contentType,sha256:planFixture.sha256,appliedTasks:appliedPlan.tasks.length,controlledExtractions:extractions,startsOn:gantt.startsOn,endsOn:gantt.endsOn,approvedProgress:gantt.progress,curvePoints:curve.total};
 }
 const beforeRevokeWorker=await worker(p3.id),beforeRevokeChallenge=structuredClone(beforeRevokeWorker.metadata.participant.kycChatChallenge),beforeRevokeKyc=structuredClone(beforeRevokeWorker.metadata.participant.kyc);
 const revoked=await store.save(owner,command('REVOKE',{workerId:p3.id,revision:beforeRevokeWorker.revision,reason:'Synthetic canonical revocation for reactive generation fence'}));assert.equal(revoked.saved,true);await failSame(p3,'ESTADO');
 const revokedWorker=await worker(p3.id),restored=await store.save(owner,command('RESTORE_ACCESS',{workerId:p3.id,revision:revokedWorker.revision,reason:'Synthetic canonical restoration does not renew original reactive handoff'}));assert.equal(restored.saved,true);
 const restoredWorker=await worker(p3.id);assert.equal(restoredWorker.metadata.participant.status,'ACTIVE');assert.deepEqual(restoredWorker.metadata.participant.kycChatChallenge,beforeRevokeChallenge);assert.deepEqual(restoredWorker.metadata.participant.kyc,beforeRevokeKyc);await failSame(p3,'ESTADO');await failSame(p3,'HOLA');
 checks.push('canonical-revoke-restore-preserves-old-capture-but-never-reuses-its-reactive-generation-or-approval');
 // Current status pins the already accepted account and original capture actor; it never fabricates a late adoption.
 const acceptedBeforeStatus=await worker(p.id);assert.equal(acceptedBeforeStatus.metadata.participant.status,'ACTIVE');assert.equal(acceptedBeforeStatus.metadata.participant.clerkUserId,p.userId);assert.equal(acceptedBeforeStatus.metadata.participant.acceptanceReceiptId,p.acceptanceReceiptId);assert.equal(acceptedBeforeStatus.metadata.participant.kyc.channelCapture.accountClaimRequired,false);
 const adoptedSnapshot=await snapshot(p.id),adoptedMetadata=structuredClone(acceptedBeforeStatus.metadata),adoptedStatus=await execute('ESTADO',{sender:p.sender});assert.equal((await recordedIntake(adoptedStatus.eventId)).reactiveKycStatus.status,'PENDING_REVIEW');assert.match(adoptedStatus.message.body,/pendiente de revisión/);assert.equal(await snapshot(p.id),adoptedSnapshot);
 const captureReceiptId=adoptedMetadata.participant.kyc.channelCapture.receiptId,captureActor=(await query('SELECT "actorId" FROM public."AuditLog" WHERE id=$1',[captureReceiptId])).rows[0].actorId;await failSame(p,'ESTADO',{},()=>query('UPDATE public."AuditLog" SET "actorId"=\'foreign\' WHERE id=$1',[captureReceiptId]),()=>query('UPDATE public."AuditLog" SET "actorId"=$2 WHERE id=$1',[captureReceiptId,captureActor]));
 checks.push('CURRENT-account-first-status-proves-original-account-and-capture-actor-without-a-late-adoption');
 const rejectionWorker=await worker(p.id),rejection=await store.save(owner,command('REVIEW_KYC',{workerId:p.id,revision:rejectionWorker.revision,submissionId:rejectionWorker.metadata.participant.kyc.submissionId,decision:'REJECTED',reason:'Synthetic private rejection reason must never appear in WhatsApp'}));assert.equal(rejection.saved,true);
 const rejectedSnapshot=await snapshot(p.id),rejectedStatus=await execute('ESTADO',{sender:p.sender});assert.equal((await recordedIntake(rejectedStatus.eventId)).reactiveKycStatus.status,'REJECTED');assertCorrectionWorksiteReply(rejectedStatus.message);assert.doesNotMatch(JSON.stringify(rejectedStatus.result),/Synthetic private rejection|https:\/\/.*blob|person@example|15550001001/);assert.equal(await snapshot(p.id),rejectedSnapshot);assert.equal((await worker(p.id)).metadata.participant.kycChatChallenge.status,'COMPLETED');assert.equal(blob.puts(),pendingPuts);assert.equal(downloads,pendingDownloads);
 assert.equal((await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE "entityId"=$1 AND action='participant.kyc_chat.prepared'`,[p.id])).rows[0].n,1);assert.equal((await worker(p.id)).metadata.participant.channelIdentity?.binding,undefined);
 checks.push('current-rejection-status-hides-private-reason-and-does-not-reopen-capture-or-create-challenge-consent-or-binding');
 assert.deepEqual(qualityCalls.map(row=>row.kind),Array.from({length:kycCorrection?3:2},()=>['DOCUMENT_FRONT','SELFIE','DOCUMENT_BACK']).flat());
 void adoptedMetadata;
 void pending;
}finally{globalThis.fetch=originalFetch;try{await closeDisposablePool(pool);if(created){assert.match(schema,/^obrasaas_reactive_kyc_[a-f0-9]{32}$/);await admin.query('DROP SCHEMA '+quoted+' CASCADE');schemaRemoved=true;}}finally{await admin.end();}}
const proof={status:'PASS',checkedAt:new Date().toISOString(),sourceManifest,harnessSha256,checks,sqlFailures,schemaRemoved,...(businessApp?{composition:'BUSINESS_APP_INTAKE_DIRECTOR',verifiedFieldHandoff:true,verifiedAttendanceSimulation:true,verifiedImportedTaskComposition:true,...(planImage?{planImageSource}:{}),...(kycCorrection?{verifiedKycCorrection:{sameAcceptedParticipant:true,previousReviewRetained:true,newPrivateImages:3,analysisConsentVersion:3,approvedSubmissionBound:true}}:{}),realProviderCalls:0}:{}),unexpectedNetworkCalls:networkCalls,syntheticInvitations:invites,syntheticReplies:sends,syntheticPrivateImages:blob.puts(),productionDataWritten:false,providerAcceptance:false,physicalPilotAccepted:false,coverageBoundary:'isolated local PostgreSQL canonical transactions and synthetic controlled adapters; explicit separate account acceptance before CURRENT v3 manual capture; historical pre-account v2 remains in the separate Recovery fixture and a different controlled actor review through canonical store with actual receipts; current reactive status tested without granting or channel binding'};mkdirSync('.vercel/private',{recursive:true});const proofPath='.vercel/private/reactive-onboarding-postgres-'+(kycCorrection?'business-app-kyc-correction-':planImage?'business-app-plan-image-':businessApp?'business-app-':'')+new Date().toISOString().replaceAll(':','-')+'.json';writeFileSync(proofPath,JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify({status:proof.status,checks:checks.length,providerCalls:0,proofPath}));
