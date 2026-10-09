import {digest} from '../../src/lib/workspace-policy.mjs';
import {OBRASAAS_META_CHANNEL} from '../../src/lib/meta-channel-binding.mjs';

export function ownCompanyFixture({time=Date.now(),patch={}}={}){
 const policy={version:1,sourceHead:'a'.repeat(40),organizationId:'org-a',actorId:'owner',clerkUserId:'user_Owner',clerkOrganizationId:'org_A',projectId:'project-a',appId:OBRASAAS_META_CHANNEL.appId,businessId:'240000001',wabaId:'230000001',phoneNumberId:'220000001',expectedPhoneE164:'+5491100009999',companyPhoneRevision:1,issuedAt:new Date(time-1000).toISOString(),expiresAt:new Date(time+3600000).toISOString(),...patch};
 const declaration={version:1,status:'UNVERIFIED',e164:policy.expectedPhoneE164,revision:1,declaredAt:new Date(time-2000).toISOString(),receiptId:'company_phone_'+ 'b'.repeat(64)};
 const environment={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_SHA:policy.sourceHead,NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-own-company-app-secret',META_OWN_COMPANY_ACCESS_TOKEN:'synthetic-own-company-server-token',META_WHATSAPP_ACCESS_TOKEN:'synthetic-existing-global-test-token',WHATSAPP_TOKEN:'synthetic-independent-legacy-global-token',META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,19).toString('base64'),META_CUSTOMER_VERIFY_TOKEN:'synthetic-own-company-verify-token-only',META_GRAPH_API_VERSION:'v25.0',OBRASAAS_META_OWN_COMPANY_RELEASE:'own-company-number-v1',OBRASAAS_META_OWN_COMPANY_POLICY:JSON.stringify(policy),OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256:digest(policy)};
 const context={member:{actorId:'owner',organizationId:'org-a',organizationName:'Synthetic company',role:'ADMIN'},session:{authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'},project:{id:'project-a',organizationId:'org-a',organizationMetadata:{companyPhoneDeclaration:declaration}}};
 const debug={is_valid:true,type:'SYSTEM_USER',app_id:policy.appId,user_id:'250000001',scopes:['business_management','whatsapp_business_management','whatsapp_business_messaging','public_profile'],expires_at:Math.floor((time+2*3600000)/1000),data_access_expires_at:0,granular_scopes:['business_management','whatsapp_business_management','whatsapp_business_messaging'].map(scope=>({scope,target_ids:[]}))};
 const phone={id:policy.phoneNumberId,display_phone_number:policy.expectedPhoneE164,verified_name:'Synthetic company',code_verification_status:'VERIFIED',status:'CONNECTED',is_on_biz_app:false,platform_type:'CLOUD_API'};
 const calls=[],state={registered:true,subscribed:true,debug,phone,failPost:null,failRead:null,afterRead:null,pagingEdge:null,missingEdge:null};
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url),path=parsed.pathname.slice('/v25.0/'.length),method=options.method||'GET';calls.push({path,method});
  if(method==='GET'&&state.failRead===path)return Response.json({error:{code:200,message:'Synthetic permission rejected'}},{status:403});
  if(method==='POST'){if(state.failPost===path)throw new Error('Synthetic lost acknowledgement');if(path===policy.wabaId+'/subscribed_apps'){state.subscribed=true;return Response.json({success:true});}if(path===policy.phoneNumberId+'/register'){state.registered=true;state.phone.status='CONNECTED';return Response.json({success:true});}if(path===policy.phoneNumberId+'/messages')return Response.json({messages:[{id:'wamid.syntheticownreply123456'}]});throw new Error('Unexpected synthetic POST');}
  let result;
  if(path==='debug_token')result={data:state.debug};
  else if(path===policy.wabaId+'/phone_numbers')result={data:[{...state.phone,status:state.registered?'CONNECTED':'PENDING'}]};
  else if(path===policy.wabaId+'/subscribed_apps')result={data:state.subscribed?[{app_id:policy.appId}]:[]};
  else{const edges={system_users:'250000001',owned_apps:policy.appId,owned_whatsapp_business_accounts:policy.wabaId},edge=path.split('/')[1];if(!edges[edge]||path.split('/')[0]!==policy.businessId)throw new Error('Unexpected synthetic GET');result={data:state.missingEdge===edge?[]:[{id:edges[edge]}],...(state.pagingEdge===edge?{paging:{next:'https://graph.facebook.com/synthetic-next'}}:{})};}
  if(state.afterRead)await state.afterRead(path);return Response.json(result);
 };
 return {policy,declaration,environment,context,debug,phone,state,calls,fetchImpl,time};
}
