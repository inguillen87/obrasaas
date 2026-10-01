import {createHmac} from 'node:crypto';
import {WorkspaceError} from './workspace-policy.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {customerVaultConfigured} from './meta-customer-credentials.mjs';

export const metaAssetId=value=>typeof value==='string'&&/^[1-9]\d{4,31}$/.test(value);
const requiredScopes=['business_management','whatsapp_business_management','whatsapp_business_messaging'];
export function metaCustomerReadiness(environment=process.env){
 const configId=environment.META_CONFIG_ID||environment.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
 const consistentConfig=!environment.META_CONFIG_ID||!environment.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID||environment.META_CONFIG_ID===environment.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
 const gates={app:environment.NEXT_PUBLIC_META_APP_ID===OBRASAAS_META_CHANNEL.appId,
  secret:typeof environment.META_APP_SECRET==='string'&&environment.META_APP_SECRET.length>=16,
  configuration:consistentConfig&&metaAssetId(configId),version:/^v\d{2}\.0$/.test(environment.META_GRAPH_API_VERSION||''),
  vault:customerVaultConfigured(environment),
  review:environment.OBRASAAS_META_SIGNUP_RELEASE==='customer-self-service-v1',
  callback:typeof environment.META_CUSTOMER_VERIFY_TOKEN==='string'&&environment.META_CUSTOMER_VERIFY_TOKEN.length>=32};
 return {canLaunchMeta:Object.values(gates).every(Boolean),operational:false,gates,
  launchCode:Object.values(gates).every(Boolean)?'META_CUSTOMER_AUTHORIZATION_AVAILABLE':'META_CUSTOMER_CONFIGURATION_PENDING',
  appId:gates.app?environment.NEXT_PUBLIC_META_APP_ID:null,configId:gates.configuration?configId:null,
  version:gates.version?environment.META_GRAPH_API_VERSION:null,callbackPath:'/api/meta/customer-callback',
  humanAcceptance:'NOT_VERIFIED',numberRegistration:'REQUIRES_CUSTOMER_NUMBER'};
}
export function createMetaCustomerProvider({environment=process.env,fetchImpl=fetch,now=()=>Date.now()}={}){
 const config=()=>{const ready=metaCustomerReadiness(environment);if(!ready.canLaunchMeta)throw new WorkspaceError(ready.launchCode,503);return ready;};
 async function request(path,{token,method='GET',body,appToken=false}={}){
  const ready=config(),url=new URL(`https://graph.facebook.com/${ready.version}/${path}`);
  if(token&&!appToken)url.searchParams.set('appsecret_proof',createHmac('sha256',environment.META_APP_SECRET).update(token).digest('hex'));
  let response;try{response=await fetchImpl(url,{method,headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new WorkspaceError('META_CUSTOMER_PROVIDER_UNCONFIRMED',503);}
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new WorkspaceError(response.status>=500||[408,425,429].includes(response.status)?'META_CUSTOMER_PROVIDER_UNCONFIRMED':'META_CUSTOMER_PROVIDER_REJECTED',response.status>=500||[408,425,429].includes(response.status)?503:409);
  if(!payload||typeof payload!=='object')throw new WorkspaceError('META_CUSTOMER_PROVIDER_UNCONFIRMED',503);return payload;
 }
 return {
  readiness:()=>metaCustomerReadiness(environment),
  async exchange(code){
   const ready=config(),query=new URLSearchParams({client_id:ready.appId,client_secret:environment.META_APP_SECRET,code});
   const result=await request('oauth/access_token?'+query);
   if(typeof result.access_token!=='string'||result.access_token.length<20||result.access_token.length>4096)throw new WorkspaceError('META_CUSTOMER_EXCHANGE_UNCONFIRMED',503);return result.access_token;
  },
  async inspect({token,wabaId,phoneNumberId}){
   const ready=config();const result=await request('debug_token?'+new URLSearchParams({input_token:token}),{token:ready.appId+'|'+environment.META_APP_SECRET,appToken:true});
   const data=result.data;
   if(data?.is_valid!==true||String(data.app_id)!==ready.appId||requiredScopes.some(scope=>!data.scopes?.includes(scope)))throw new WorkspaceError('META_CUSTOMER_TOKEN_SCOPE_REJECTED',403);
   const expiresAt=Number(data.expires_at);if(!Number.isSafeInteger(expiresAt)||expiresAt<0||expiresAt&&expiresAt*1000<=now()+300000)throw new WorkspaceError('META_CUSTOMER_TOKEN_EXPIRED',409);
   const scopes=data.granular_scopes;
   if(!Array.isArray(scopes)||!scopes.some(scope=>scope.scope==='whatsapp_business_management'&&Array.isArray(scope.target_ids)&&scope.target_ids.map(String).includes(wabaId)))throw new WorkspaceError('META_CUSTOMER_WABA_SCOPE_REJECTED',403);
   const phones=await request(wabaId+'/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,status&limit=100',{token});
   const phone=phones.data?.find(item=>String(item.id)===phoneNumberId);if(!phone)throw new WorkspaceError('META_CUSTOMER_PHONE_WABA_MISMATCH',403);
   // Phone verification is not the Cloud API registration signal.
   return {expiresAt:expiresAt?new Date(expiresAt*1000).toISOString():null,scopes:[...requiredScopes],
    phoneStatus:typeof phone.status==='string'?phone.status:'UNKNOWN',registered:phone.status==='CONNECTED',
    displayPhoneNumber:typeof phone.display_phone_number==='string'?phone.display_phone_number.slice(0,64):null,
    verifiedBusinessName:typeof phone.verified_name==='string'?phone.verified_name.slice(0,160):null};
  },
  async subscribe({token,wabaId}){
   await request(wabaId+'/subscribed_apps',{token,method:'POST',body:{override_callback_uri:'https://obrasaas.com/api/meta/customer-callback',verify_token:environment.META_CUSTOMER_VERIFY_TOKEN}});
   const subscriptions=await request(wabaId+'/subscribed_apps',{token});
   if(!subscriptions.data?.some(entry=>String(entry.whatsapp_business_api_data?.id??entry.app_id??entry.id)===config().appId))throw new WorkspaceError('META_CUSTOMER_SUBSCRIPTION_UNCONFIRMED',503);
   return true;
  },
  async register({token,phoneNumberId,pin}){
   if(!metaAssetId(phoneNumberId)||!/^\d{6}$/.test(pin||''))throw new WorkspaceError('META_CUSTOMER_REGISTRATION_INPUT_INVALID');
   const result=await request(phoneNumberId+'/register',{token,method:'POST',body:{messaging_product:'whatsapp',pin}});
   if(result.success!==true)throw new WorkspaceError('META_CUSTOMER_REGISTRATION_UNCONFIRMED',503);return true;
  },
  async templates({token,wabaId}){
   const templates=[];let path=wabaId+'/message_templates?fields=id,name,status,language,category&limit=100';
   for(let page=0;page<10;page++){
    const result=await request(path,{token});if(!Array.isArray(result.data))throw new WorkspaceError('META_CUSTOMER_CATALOG_UNCONFIRMED',503);
    for(const entry of result.data){if(!metaAssetId(String(entry.id))||!/^[a-z0-9_]{1,512}$/.test(entry.name||'')||typeof entry.status!=='string'||typeof entry.language!=='string')throw new WorkspaceError('META_CUSTOMER_CATALOG_UNCONFIRMED',503);
     templates.push({id:String(entry.id),name:entry.name,status:entry.status,language:entry.language,category:entry.category||null});}
    if(!result.paging?.next)return {wabaId,items:templates,complete:true,observedAt:new Date(now()).toISOString()};
    const cursor=result.paging.cursors?.after;if(typeof cursor!=='string'||cursor.length>2048)throw new WorkspaceError('META_CUSTOMER_CATALOG_UNCONFIRMED',503);
    path=wabaId+'/message_templates?'+new URLSearchParams({fields:'id,name,status,language,category',limit:'100',after:cursor});
   }
   throw new WorkspaceError('META_CUSTOMER_CATALOG_TRUNCATED',409);
  },
  async findTemplate({token,wabaId,name}){
   if(!metaAssetId(wabaId)||!/^[a-z0-9_]{1,512}$/.test(name||''))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_INVALID');
   const result=await request(wabaId+'/message_templates?'+new URLSearchParams({name,fields:'id,name,status,language,category,components',limit:'100'}),{token});
   if(!Array.isArray(result.data)||result.paging?.next)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_LOOKUP_UNCONFIRMED',503);
   const exact=result.data.filter(item=>item.name===name);if(exact.length>1)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_IDENTITY_CONFLICT',409);return exact[0]||null;
  },
  async createTemplate({token,wabaId,definition}){
   const result=await request(wabaId+'/message_templates',{token,method:'POST',body:{name:definition.name,language:definition.language,category:definition.category,components:definition.components}});
   if(!metaAssetId(String(result.id)))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SUBMISSION_UNCONFIRMED',503);
   // Re-read the exact owned content; POST acceptance is not template approval.
   return result;
  },
 };
}
