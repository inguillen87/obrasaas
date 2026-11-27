import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {createLocalJWKSet,exportJWK,generateKeyPair,SignJWT} from 'jose';
import {createControlledLifecycleGraph,lifecycleEnvironment} from '../fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {executeCompanyChannelAdoption} from './company-channel-migration.mjs';
import {createBootstrapProfileVerifier} from '../../src/lib/company-onboarding-identity.mjs';
import {BOOTSTRAP_PROFILE_AUDIENCE} from '../../src/lib/company-onboarding-policy.mjs';
import {createCompanyOnboardingHandlers} from '../../src/lib/company-onboarding-http.mjs';
import {IDENTITY_ISSUER,IDENTITY_ORIGIN} from '../../src/lib/production-identity-config.mjs';
import {createParticipantStore} from '../../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../../src/lib/participant-http.mjs';
import {createCustomerWhatsAppSetup} from '../../src/lib/customer-whatsapp-setup.mjs';
import {createCustomerWhatsAppHandlers} from '../../src/lib/customer-whatsapp-http.mjs';
import {createMetaCustomerOnboarding} from '../../src/lib/meta-customer-onboarding.mjs';
import {createMetaCustomerHandlers} from '../../src/lib/meta-customer-http.mjs';
import {createMetaCustomerProvider} from '../../src/lib/meta-customer-provider.mjs';
import {createCompanyChannelStore} from '../../src/lib/company-channel-store.mjs';
import {createCompanyChannelHandlers} from '../../src/lib/company-channel-http.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers,splitMetaCustomerEvents} from '../../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../../src/lib/meta-customer-processing.mjs';
import {createEmployeeIntakeBridge,EMPLOYEE_INTAKE_AUTHORIZATION_CODES} from '../../src/lib/meta-employee-intake.mjs';
import {createMetaKycOutbound} from '../../src/lib/meta-kyc-outbound.mjs';
import {createMetaCustomerOutbound,customerOutboundId} from '../../src/lib/meta-customer-outbound.mjs';

const endpoint=path=>IDENTITY_ORIGIN+'/api/identity/'+path;
const get=(path,params)=>new Request(endpoint(path)+'?'+new URLSearchParams(params));
const post=(path,body,headers={})=>new Request(endpoint(path),{method:'POST',headers:{origin:IDENTITY_ORIGIN,'content-type':'application/json',...headers},body:JSON.stringify(body)});
async function json(response,expected=200){const body=await response.json();assert.equal(response.status,expected,body.code);assert.match(response.headers.get('cache-control'),/no-store/);return body;}

export async function verifyBootstrappedWhatsApp({pool,workspace,store,identity,command,checks}){
 const environment={...lifecycleEnvironment,META_COEXISTENCE_CONFIG_ID:'1555555555555556',OBRASAAS_META_COEXISTENCE_RELEASE:'business-app-coexistence-v1'};
 const graph=createControlledLifecycleGraph(environment);
 Object.assign(graph.assets.get('a'),{isOnBizApp:true,registered:true});
 let unexpectedNetworkCalls=0;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>{unexpectedNetworkCalls++;throw new Error('BOOTSTRAP_UNCONTROLLED_NETWORK');};
 try{
  // The bootstrap fixture intentionally keeps only contact, role and plan tables.
  // Add the signed-channel schema to its freshly created disposable database.
  await pool.query([
   'ALTER TABLE "Worker" ADD COLUMN name text,ADD COLUMN phone text,ADD COLUMN role text,ADD COLUMN "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,ADD COLUMN "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,ADD UNIQUE ("projectId",phone)',
   'ALTER TABLE "WhatsAppConnection" ADD UNIQUE ("projectId"),ADD COLUMN enabled boolean,ADD COLUMN "connectionStatus" text,ADD COLUMN "phoneNumberId" text UNIQUE,ADD COLUMN "whatsappBusinessId" text,ADD COLUMN "encryptedAccessToken" text,ADD COLUMN "encryptedPin" text,ADD COLUMN "displayPhoneNumber" text,ADD COLUMN "verifiedBusinessName" text,ADD COLUMN metadata jsonb,ADD COLUMN "lastVerifiedAt" timestamp,ADD COLUMN "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,ADD COLUMN "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP',
   'CREATE TABLE "WebhookEvent"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",provider text,"externalId" text,"eventType" text,status text DEFAULT \'PENDING\',attempts integer DEFAULT 0,payload jsonb,outcome jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,"processedAt" timestamp,"appliedAt" timestamp,"lastError" text,"leaseToken" text,"leaseExpiresAt" timestamp,UNIQUE(provider,"externalId"))',
  ].join(';'));
  const migration=await pool.connect();
  try{const dry=await executeCompanyChannelAdoption(migration);const adopted=await executeCompanyChannelAdoption(migration,{mode:'APPLY',expectedFingerprint:dry.fingerprint});assert.equal(adopted.status,'APPLIED');}finally{migration.release();}

  const connect=()=>pool.connect(),key=await generateKeyPair('RS256');
  const jwk={...await exportJWK(key.publicKey),kid:'synthetic-bootstrap-whatsapp',alg:'RS256',use:'sig'};
  const verifyProfile=createBootstrapProfileVerifier(createLocalJWKSet({keys:[jwk]}));
  const provider=createMetaCustomerProvider({environment,fetchImpl:graph.fetchImpl});
  const setup=createCustomerWhatsAppSetup({workspace}),onboarding=createMetaCustomerOnboarding({workspace,provider,environment}),company=createCompanyChannelStore({workspace,environment});
  const intake=createEmployeeIntakeBridge({connect,environment}),kycOutbound=createMetaKycOutbound({connect,provider,environment}),statusOutbound=createMetaCustomerOutbound({connect,provider,environment});
  const callback=createMetaCustomerCallbackHandlers({inbox:createMetaCustomerInbox({connect,environment}),environment});
  const processor=createMetaCustomerProcessor({connect,environment,dispatch:ctx=>intake.execute(ctx),authorizationCodes:EMPLOYEE_INTAKE_AUTHORIZATION_CODES,outbound:{send:(...args)=>kycOutbound.send(...args),observeStatus:(...args)=>statusOutbound.observeStatus(...args)}});
  const sendWire=wire=>{
   const signature='sha256='+createHmac('sha256',environment.META_APP_SECRET).update(wire).digest('hex');
   return callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':signature},body:wire}));
  };

  const proofs=[];
  for(const [assetKey,numberMode] of [['a','BUSINESS_APP'],['b','DEDICATED']]){
   const asset=graph.assets.get(assetKey),owner=identity('WhatsAppOwner'+assetKey),director={...identity('WhatsAppDirector'+assetKey),organizationId:owner.organizationId,organizationRole:'org:member'};
   const ownerEmail='bootstrap-whatsapp-'+assetKey+'@example.invalid',directorEmail='bootstrap-director-'+assetKey+'@example.invalid';
   const epoch=Math.floor(Date.now()/1000);
   const profile=await new SignJWT({iss:IDENTITY_ISSUER,aud:BOOTSTRAP_PROFILE_AUDIENCE,sub:owner.userId,jti:randomUUID(),iat:epoch,nbf:epoch,exp:epoch+60,azp:IDENTITY_ORIGIN,purpose:'new-constructor-profile',profile_version:1,email:ownerEmail,email_verified:true}).setProtectedHeader({alg:'RS256',typ:'JWT',kid:jwk.kid}).sign(key.privateKey);
   const bootstrapHttp=createCompanyOnboardingHandlers({verifySession:async()=>owner,verifyProfile,store});
   const bootstrapBody={...command(owner),companyPhone:asset.displayNumber};
   const create=()=>bootstrapHttp.POST(post('company-onboarding',bootstrapBody,{'x-obrasaas-bootstrap-profile':profile})).then(response=>json(response));
   const created=await create(),createdReplay=await create();
   assert.equal(created.created,true);assert.equal(createdReplay.receiptId,created.receiptId);assert.equal(createdReplay.replayed,true);
   const ownerList=await workspace.list(owner),context={projectId:created.projectId,scope:ownerList.scope};
   assert.equal(ownerList.role,'ADMIN');assert.deepEqual(ownerList.projects.map(row=>row.id),[created.projectId]);
   const ownerAudit=(await pool.query('SELECT "actorId",metadata FROM "AuditLog" WHERE id=$1 AND "organizationId"=$2',[created.receiptId,created.organizationId])).rows[0];
   assert.equal(ownerAudit.metadata.profileEmailVerified,true);assert.equal(ownerAudit.metadata.identitySource,'clerk-user-id');
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM "WhatsAppConnection" WHERE "projectId"=$1',[created.projectId])).rows[0].n,0);
   await assert.rejects(workspace.list(director),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});

   const officeIdentity={async findVerifiedOfficeAccount(input){
    assert.deepEqual(input,{organizationId:owner.organizationId,email:directorEmail});
    return {state:'READY',code:null,account:{clerkUserId:director.userId,name:'Dirección sintética',email:directorEmail,primaryEmail:directorEmail,clerkRole:'org:member',providerMembershipId:'orgmem_Whatsapp'+assetKey,providerMembershipUpdatedAt:epoch*1000,userUpdatedAt:epoch*1000,emailAddressId:'email_Whatsapp'+assetKey,primaryEmailAddressId:'email_Whatsapp'+assetKey}};
   }};
   const participants=createParticipantStore({workspace,connect,identity:officeIdentity,environment}),ownerParticipant=createParticipantHandlers({verify:async()=>owner,store:participants});
   const found=await json(await ownerParticipant.GET(get('participants',{...context,detail:'verified-office-account',email:directorEmail})));
   assert.equal(found.verifiedOfficeAccount.state,'READY');
   const assign={...context,operationId:randomUUID(),action:'ASSIGN_VERIFIED_OFFICE',payload:{email:directorEmail,clerkUserId:director.userId,expectedProofDigest:found.verifiedOfficeAccount.account.proofDigest,role:'DIRECTOR',reason:'Asignación sintética independiente para comprobar el canal de la nueva empresa.',confirmOfficePermissions:true}};
   const assigned=await json(await ownerParticipant.POST(post('participants',assign)));
   assert.equal(assigned.account.role,'DIRECTOR');assert.equal(assigned.officeAssignmentReceipt.assignedProjectId,null);
   const directorList=await workspace.list(director),directorContext={projectId:created.projectId,scope:directorList.scope};
   assert.equal(directorList.role,'DIRECTOR');assert.deepEqual(directorList.projects.map(row=>row.id),[created.projectId]);
   const officeActor=(await pool.query('SELECT "userId" FROM "TenantMembership" WHERE id=$1 AND "organizationId"=$2',[assigned.officeAssignmentReceipt.membershipId,created.organizationId])).rows[0].userId;
   assert.notEqual(officeActor,ownerAudit.actorId);

   const prep=createCustomerWhatsAppHandlers({verify:async()=>owner,service:setup}),meta=createMetaCustomerHandlers({verify:async()=>owner,service:onboarding}),directorMeta=createMetaCustomerHandlers({verify:async()=>director,service:onboarding});
   const action=(name,extra={})=>({...context,operationId:randomUUID(),action:name,...extra});
   const invoke=body=>meta.POST(post('meta-onboarding',body)).then(response=>json(response));
   const before=await json(await prep.GET(get('whatsapp-setup',context)));
   await json(await prep.POST(post('whatsapp-setup',{...context,operationId:randomUUID(),profile:{assistantName:'Asistente sintético',numberMode,initialProjectId:created.projectId,useCases:['FIELD_REPORTS','MATERIAL_REQUESTS','SCHEDULE_QUERIES'],expectedRevision:before.profile.revision,confirmOwnership:true}})));
   const prepared=await invoke(action('begin',{preparedRevision:1}));
   const finish=action('complete',{signupId:prepared.signup.id,stateToken:prepared.stateToken,code:asset.code,wabaId:asset.wabaId,...(numberMode==='BUSINESS_APP'?{phoneNumberId:null,signupEvent:'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'}:{phoneNumberId:asset.phoneNumberId})});
   const linked=await invoke(finish);await invoke(finish);
   assert.equal(asset.exchanges,1);assert.equal(asset.subscriptions,1);assert.equal(linked.connection.enabled,false);
   if(numberMode==='DEDICATED'){
    assert.equal(linked.signup.state,'REGISTRATION_REQUIRED');
    const register=action('register_number',{signupId:prepared.signup.id,pin:'731907',confirmRegistration:true});
    const registered=await invoke(register);await invoke(register);
    assert.equal(registered.signup.state,'LINKED_PENDING_ACCEPTANCE');assert.equal(asset.registrations,1);
   }else{assert.equal(linked.signup.state,'LINKED_PENDING_ACCEPTANCE');assert.equal(linked.coexistence.verified,true);assert.equal(asset.registrations,0);}

   const channel=(await pool.query('SELECT id,"phoneNumberId","whatsappBusinessId",metadata FROM "WhatsAppConnection" WHERE "projectId"=$1',[created.projectId])).rows[0];
   assert.equal(channel.phoneNumberId,asset.phoneNumberId);assert.equal(channel.whatsappBusinessId,asset.wabaId);assert.equal(channel.metadata.credentialOrganizationId,created.organizationId);assert.equal(channel.metadata.customerSignupId,prepared.signup.id);
   const ownedChannel=createCompanyChannelHandlers({verify:async()=>owner,store:company});
   const readChannel=async()=> (await json(await ownedChannel.GET(get('company-channel',context)))).channels.find(row=>row.id===channel.id);
   const seeded=await readChannel();assert.equal(seeded.mode,'PROJECT_ONLY');assert.deepEqual(seeded.assignments.map(row=>row.projectId),[created.projectId]);
   const denied=await json(await directorMeta.POST(post('meta-onboarding',{...action('activate_channel',{confirmActivation:true}),...directorContext})),403);
   assert.equal(denied.code,'META_CUSTOMER_ACTIVATION_ADMIN_REQUIRED');
   const activated=await invoke(action('activate_channel',{confirmActivation:true}));assert.equal(activated.activation.operational,true);assert.equal(activated.activation.roundTrip,'NOT_VERIFIED');
   for(const companyAction of ['PREPARE','ACTIVATE']){
    const current=await readChannel();
    const result=await json(await ownedChannel.POST(post('company-channel',action(companyAction,{payload:{connectionId:channel.id,revision:current.revision,targetProjectId:null}}))));
    assert.equal(result.state,'RECORDED',result.code);
   }
   assert.equal((await readChannel()).mode,'COMPANY');

   const timestamp=()=>String(Math.floor(Date.now()/1000));
   const wrap=value=>({object:'whatsapp_business_account',entry:[{id:asset.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:asset.phoneNumberId},...value}}]}]});
   const hello=()=>wrap({messages:[{id:'wamid.BootstrappedHello_'+randomUUID().replaceAll('-',''),from:asset.sender,timestamp:timestamp(),type:'text',text:{body:'HOLA'}}]});
   async function push(payload){
    const wire=JSON.stringify(payload),ack=await json(await sendWire(wire));assert.equal(ack.durable,true);assert.equal(ack.applied,false);
    return {wire,id:'customer_webhook_'+splitMetaCustomerEvents(payload)[0].externalId};
   }
   const off=await push(hello());assert.equal((await processor.process(off.id)).replySent,false);assert.equal(asset.sends,0);
   const current=(await json(await ownerParticipant.GET(get('participants',context)))).employeeIntake;assert.equal(current.enabled,false);
   await json(await ownerParticipant.POST(post('participants',action('CONFIGURE_EMPLOYEE_INTAKE',{payload:{connectionId:channel.id,expectedRevision:current.revision,enabled:true,confirmed:true}}))));
   const signed=await push(hello()),processed=await processor.process(signed.id);
   assert.equal(processed.kind,'EMPLOYEE_INTAKE');assert.equal(processed.businessApplied,false);assert.equal(processed.replySent,true);
   const outboundId=customerOutboundId(signed.id),outgoing=graph.messages.get(outboundId);
   assert.equal(outgoing.asset,assetKey);assert.equal(outgoing.body.to,asset.sender);assert.equal(outgoing.body.type,'interactive');assert.equal(outgoing.body.interactive.action.sections.flatMap(section=>section.rows).filter(row=>row.title==='Sumarme a una obra').length,1);
   const delivery=await push(wrap({statuses:[{id:outgoing.id,status:'delivered',timestamp:timestamp(),recipient_id:asset.sender,biz_opaque_callback_data:outboundId}]}));
   await processor.process(delivery.id);
   assert.equal((await statusOutbound.result({eventId:signed.id,projectId:created.projectId,channelId:channel.id})).providerStatus,'delivered');
   await json(await sendWire(signed.wire));assert.equal((await processor.process(signed.id)).done,true);assert.equal(asset.sends,1);
   const persisted=(await pool.query('SELECT "projectId",payload FROM "WebhookEvent" WHERE id=$1',[signed.id])).rows[0];
   assert.equal(persisted.projectId,created.projectId);assert.equal(persisted.payload.organizationId,created.organizationId);assert.equal(persisted.payload.channelId,channel.id);
   assert.ok(persisted.payload.encryptedProof.startsWith('v2.'));assert.equal(persisted.payload.companyRouting.mode,'COMPANY');
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM "Worker" WHERE "projectId"=$1',[created.projectId])).rows[0].n,0);
   checks.push('same-local-signed-bootstrap-verified-DIRECTOR-and-owner-'+numberMode+'-channel-signed-HOLA-delivered-once');
   proofs.push({numberMode,signupExchanges:asset.exchanges,subscriptions:asset.subscriptions,registrations:asset.registrations,firstReplyPosts:asset.sends,deliveryStatus:'delivered',directorDeniedActivation:true});
  }
  assert.deepEqual(graph.unexpected,[]);assert.equal(unexpectedNetworkCalls,0);
  return {variants:proofs,syntheticOnly:true,realMetaRequests:0,unexpectedNetworkCalls,providerAcceptance:false,physicalPilotAccepted:false};
 }finally{globalThis.fetch=originalFetch;}
}

