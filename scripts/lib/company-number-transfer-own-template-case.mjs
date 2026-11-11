import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ownCompanyFixture} from '../../tests/fixtures/own-company-meta.mjs';
import {createCompanyOnboardingStore} from '../../src/lib/company-onboarding-store.mjs';
import {createWorkspaceStore} from '../../src/lib/workspace-store.mjs';
import {createCompanyChannelStore} from '../../src/lib/company-channel-store.mjs';
import {createOwnCompanyConnection} from '../../src/lib/meta-own-company-connection.mjs';
import {createOwnCompanyTemplates} from '../../src/lib/meta-own-company-templates.mjs';
import {createMetaCustomerProvider} from '../../src/lib/meta-customer-provider.mjs';
import {createCompanyNumberTransferStore} from '../../src/lib/company-number-transfer-store.mjs';
import {buildCustomerTemplate} from '../../src/lib/meta-customer-templates.mjs';

// Uses the parent's owned, synthetic PostgreSQL pool. No authority/runtime grant
// is seeded: both memberships and the OWN runtime come from canonical commands.
export async function runOwnTemplateTransferBarrierCase({pool,connect,environment}){
 const workspace=createWorkspaceStore({connect}),bootstrap=createCompanyOnboardingStore({connect});
 const signed=organizationId=>({authenticated:true,verification:'clerk-production-jwt',userId:'user_TemplateOwner679',organizationId,organizationRole:'org:admin'});
 const sourceSession=signed('org_TemplateSource679'),destinationSession=signed('org_TemplateDestination679'),display='+5491100067909';
 const profile={verified:true,proofType:'clerk-signed-bootstrap-profile',userId:sourceSession.userId,primaryEmail:'template-owner679@example.invalid'};
 const create=async(session,name)=>bootstrap.create(session,{operationId:randomUUID(),expectedClerkOrganizationId:session.organizationId,companyName:name,project:{name:name+' worksite',address:''},initialTasks:[],confirmNewCompany:true,companyPhone:display},profile);
 const source=await create(sourceSession,'Synthetic OWN template source'),destination=await create(destinationSession,'Synthetic OWN template destination');
 const sc={projectId:source.projectId,scope:(await workspace.list(sourceSession)).scope},dc={projectId:destination.projectId,scope:(await workspace.list(destinationSession)).scope};
 const actor=(await pool.query(`SELECT id FROM public."PlatformUser" WHERE "clerkUserId"=$1`,[sourceSession.userId])).rows[0].id;
 const fixture=ownCompanyFixture({patch:{organizationId:source.organizationId,actorId:actor,clerkUserId:sourceSession.userId,clerkOrganizationId:sourceSession.organizationId,projectId:source.projectId,wabaId:'23000679009',phoneNumberId:'22000679009',expectedPhoneE164:display}});
 const env={...environment,...fixture.environment,META_COMPANY_TRANSFER_CONFIG_ID:'14000679002',OBRASAAS_COMPANY_NUMBER_TRANSFER_RELEASE:'single-phone-waba-v1'};
 let remote=null,templateCreates=0,loseCreateAck=false,exchangeCalls=0;
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url),edge=parsed.pathname.slice('/v25.0/'.length),method=options.method||'GET';
  if(edge===fixture.policy.wabaId+'/message_templates'){
   if(method==='POST'){templateCreates++;const body=JSON.parse(options.body);remote={...body,id:'28000679009',status:'PENDING'};if(loseCreateAck)throw new Error('SYNTHETIC_TEMPLATE_ACK_LOST');return Response.json({id:remote.id,status:remote.status});}
   assert.equal(method,'GET');return Response.json({data:remote?[remote]:[]});
  }
  assert.equal(method,'GET','OWN fixture is already registered/subscribed; no provider mutation is needed');return fixture.fetchImpl(url,options);
 };
 const ownProvider=createMetaCustomerProvider({environment:env,fetchImpl}),ownConnection=createOwnCompanyConnection({workspace,provider:ownProvider,environment:env}),channels=createCompanyChannelStore({workspace,ownConnection,environment:env});
 const base={connectionId:null,revision:0,companyPhoneRevision:1,wabaId:fixture.policy.wabaId,phoneNumberId:fixture.policy.phoneNumberId,confirmOwnBusiness:true,confirmReplacement:false};
 assert.equal((await channels.command(sourceSession,{...sc,action:'CONNECT_OWN_NUMBER',operationId:randomUUID(),payload:base})).state,'RECORDED');
 const channel=async()=>(await pool.query(`SELECT c.*,cc.mode,cc.revision FROM public."WhatsAppConnection" c JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id WHERE c."projectId"=$1`,[sc.projectId])).rows[0];
 let c=await channel();assert.equal((await channels.command(sourceSession,{...sc,action:'ACTIVATE_OWN_NUMBER',operationId:randomUUID(),payload:{...base,connectionId:c.id,revision:c.revision,confirmRegistration:false,securityPin:null}})).state,'RECORDED');c=await channel();assert.equal(c.metadata.ownCompanyRuntime.state,'ACTIVE');
 const templates=createOwnCompanyTemplates({workspace,provider:ownProvider,environment:env}),key='open_attendance_reminder';
 const command=async action=>{const view=await templates.read(sourceSession,sc),definition=buildCustomerTemplate(await channel(),key);return templates.command(sourceSession,{...sc,action,operationId:randomUUID(),payload:{connectionId:view.connectionId,ownerRevision:view.ownerRevision,grantDigest:view.grantDigest,...(action==='SUBMIT_OWN_TEMPLATE'?{review:{blueprintKey:key,expectedName:definition.name,contentSha256:definition.contentSha256,confirmed:true}}:{blueprintKey:key}),...(action==='RECOVER_OWN_TEMPLATE'?{recoveryOf:null}:{})}});};
 assert.equal((await command('PREPARE_OWN_TEMPLATE')).submissionState,'DRAFT');
 const identity={verifyAdminMembership:async({userId,organizationId})=>({userId,organizationId,role:'org:admin',providerMembershipId:'orgmem_'+organizationId.replaceAll('_',''),providerMembershipRevision:1,providerUserRevision:1})};
 const grant=()=>({token:'fresh-synthetic-own-destination-grant-679',origin:'fresh-customer-oauth',wabaId:fixture.policy.wabaId,phoneNumberId:fixture.policy.phoneNumberId,inventory:[fixture.policy.phoneNumberId],subscribed:true,checkedAt:new Date().toISOString(),verification:{phoneNumberId:fixture.policy.phoneNumberId,displayPhoneNumber:display,registered:true,platformType:'CLOUD_API',isOnBizApp:false,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:new Date(Date.now()+3600000).toISOString()}});
 const provider={readiness:()=>({canLaunchMeta:true,appId:fixture.policy.appId,configId:'14000679001',version:'v25.0'}),exchangeTransferGrant:async()=>{exchangeCalls++;return grant();},verifyTransferGrant:async()=>grant()};
 const transfer=createCompanyNumberTransferStore({workspace,identity,provider,environment:env});
 const input=async()=>{const v=await transfer.read(destinationSession,dc),s=v.sources.find(s=>s.id===c.id);assert(s);return {...dc,action:'PREPARE',operationId:randomUUID(),sourceConnectionId:s.id,sourceRevision:s.revision,companyPhoneRevision:v.companyPhoneRevision};};
 // Plan while still DRAFT, then create UNKNOWN through the real durable
 // submission path. This also proves final COMMIT cannot retire a changed or
 // unresolved source even when PREPARE happened before that operation.
 let plan=await transfer.command(destinationSession,await input());assert.equal(plan.readiness.canLaunchMeta,true);assert.equal(plan.readiness.configId,env.META_COMPANY_TRANSFER_CONFIG_ID);
 const preparedInput={...dc,action:'AUTHORIZE',operationId:randomUUID(),transferId:plan.transferId,stateToken:plan.stateToken,code:'synthetic-own-template-code-679'};plan=await transfer.command(destinationSession,preparedInput);
 loseCreateAck=true;const unknown=await command('SUBMIT_OWN_TEMPLATE');loseCreateAck=false;assert.equal(unknown.submissionState,'SUBMISSION_UNKNOWN');assert.equal(unknown.providerConfirmed,false);assert.equal(templateCreates,1);
 const unknownSource=await channel(),unknownReceipt=(await pool.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1`,[unknown.receiptId])).rows[0].metadata;
 await assert.rejects(transfer.command(destinationSession,{...dc,action:'COMMIT',operationId:randomUUID(),transferId:plan.transferId,revision:plan.revision,confirmTransfer:true}),{code:'COMPANY_TRANSFER_CONTEXT_CHANGED'});
 await transfer.command(destinationSession,{...dc,action:'CLOSE',operationId:randomUUID(),transferId:plan.transferId,revision:plan.revision});
 await assert.rejects(transfer.command(destinationSession,await input()),{code:'COMPANY_TRANSFER_PENDING_OPERATIONS'});
 assert.deepEqual(await channel(),unknownSource);assert.deepEqual((await pool.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1`,[unknown.receiptId])).rows[0].metadata,unknownReceipt);assert.equal(templateCreates,1);assert.equal(exchangeCalls,1);
 assert.equal((await pool.query(`SELECT count(*)::int AS n FROM public."WhatsAppAssetRetirement" WHERE "sourceConnectionId"=$1`,[c.id])).rows[0].n,0);
 remote.status='APPROVED';const recovery=await command('RECOVER_OWN_TEMPLATE');assert.equal(recovery.submissionState,'SUBMITTED');assert.equal(recovery.providerConfirmed,true);assert.equal(templateCreates,1,'Recovery must use GET readback only');
 // The original UNKNOWN receipt is retained. Only the newer exact canonical
 // readback of that submission may release the barrier; no SQL cancellation.
 assert.equal((await pool.query(`SELECT metadata->>'submissionState' AS state FROM public."AuditLog" WHERE id=$1`,[unknown.receiptId])).rows[0].state,'SUBMISSION_UNKNOWN');
 plan=await transfer.command(destinationSession,await input());assert.equal(plan.state,'PREPARED');await transfer.command(destinationSession,{...dc,action:'CLOSE',operationId:randomUUID(),transferId:plan.transferId,revision:plan.revision});
 return {templateCreates,checks:['genuine-own-template-unknown-holds-prepare-and-final-commit','canonical-get-only-template-recovery-releases-barrier-with-original-unknown-retained']};
}
