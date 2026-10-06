import {createHmac,createHash} from 'node:crypto';
import {WorkspaceError} from './workspace-policy.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {customerVaultConfigured} from './meta-customer-credentials.mjs';
import {META_CUSTOMER_REQUIRED_SCOPES,hasMetaCustomerRequiredScopes} from './meta-customer-permissions.mjs';
import {resolveMetaTransport,readMetaJson} from './meta-whatsapp-transport.mjs';
import {createDevelopmentPilotCapability,developmentPilotCapabilityPolicy,developmentPilotCapabilityExpiry,developmentPilotConnectionPolicy,developmentPilotPhoneMatches,assertDevelopmentPilotMember,META_DEVELOPMENT_PILOT_MODE} from './meta-development-pilot-policy.mjs';

const pilotAudits=new WeakMap(),pilotInspections=new WeakMap();
export const metaCustomerAuthorizationReady=readiness=>readiness?.mode===META_DEVELOPMENT_PILOT_MODE?readiness.pilot?.canLaunch===true:readiness?.canLaunchMeta===true;
export const metaCustomerScopedTransportReady=readiness=>readiness?.mode===META_DEVELOPMENT_PILOT_MODE?readiness.pilot?.canUseAttendanceTransport===true:metaCustomerTransportReady(readiness);
export function developmentPilotUnavailableReadiness(ready,expiresAt,code='META_DEVELOPMENT_PILOT_UNAVAILABLE'){
 return {...ready,mode:META_DEVELOPMENT_PILOT_MODE,pilot:{canLaunch:false,canUseAttendanceTransport:false,expiresAt,ownBusinessOnly:true,ownerReadbackReady:false,code,capabilities:{attendance:false,binding:false,kyc:false,media:false,flows:false,templates:false,progress:false,stock:false,company:false}}};
}

export const metaAssetId=value=>typeof value==='string'&&/^[1-9]\d{4,31}$/.test(value);
export const metaCustomerTransportReady=readiness=>['app','secret','configuration','version','vault','review','callback'].every(key=>readiness?.gates?.[key]===true);
const demoTransportGates=['fixedAssets','testMode','credential','vault','signature','version','recipients'];
const injectedDemoTransportReady=readiness=>readiness?.canLaunchMeta===true&&readiness.gates&&typeof readiness.gates==='object'&&!Array.isArray(readiness.gates)&&Object.keys(readiness.gates).length===demoTransportGates.length&&demoTransportGates.every(key=>readiness.gates[key]===true);
// Deliberately limited to the adopted BODY-only, positional es_AR catalogue.
// Meta Cloud API contract: https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive
export function customerTemplateMessage(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='bodyParameters|language|name'||!/^obrasaas_[a-z0-9_]{1,200}$/.test(value.name||'')||value.language!=='es_AR'||!Array.isArray(value.bodyParameters)||value.bodyParameters.length!==1||typeof value.bodyParameters[0]!=='string'||!value.bodyParameters[0].trim()||value.bodyParameters[0].length>160||/[\u0000-\u001f\u007f<>]/.test(value.bodyParameters[0]))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_MESSAGE_INVALID');
 return {type:'template',template:{name:value.name,language:{code:value.language},components:[{type:'body',parameters:value.bodyParameters.map(text=>({type:'text',text}))}]}};
}
export function customerReplyMessage(value){
 if(value?.type==='interactive'){
  const clean=(text,max,multiline=false)=>typeof text==='string'&&text.trim().length>0&&text.length<=max&&!(multiline?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:/[\u0000-\u001f\u007f]/).test(text),keys=(o,list)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===list.sort().join('|');
  if(!keys(value,['type','body','button','sections'])||!clean(value.body,1024,true)||!clean(value.button,20)||!Array.isArray(value.sections)||!value.sections.length||value.sections.length>10)throw new WorkspaceError('META_CUSTOMER_REPLY_INVALID');
  let count=0;const ids=new Set(),sections=value.sections.map(section=>{
   if(!keys(section,['title','rows'])||!clean(section.title,24)||!Array.isArray(section.rows)||!section.rows.length)throw new WorkspaceError('META_CUSTOMER_REPLY_INVALID');
   return {title:section.title,rows:section.rows.map(row=>{if(!keys(row,row?.description===undefined?['id','title']:['id','title','description'])||!clean(row.id,200)||!clean(row.title,24)||row.description!==undefined&&!clean(row.description,72)||ids.has(row.id)||++count>10)throw new WorkspaceError('META_CUSTOMER_REPLY_INVALID');ids.add(row.id);return {...row};})};
  });
  return {type:'interactive',interactive:{type:'list',body:{text:value.body},action:{button:value.button,sections}}};
 }
 if(value?.type!=='text'||Object.keys(value).sort().join('|')!=='body|type'||typeof value.body!=='string'||!value.body.trim()||value.body.length>4096||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.body))throw new WorkspaceError('META_CUSTOMER_REPLY_INVALID');
 return {type:'text',text:{preview_url:false,body:value.body}};
}
export function metaCustomerReadiness(environment=process.env){
 const configId=environment.META_CONFIG_ID||environment.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
 const consistentConfig=!environment.META_CONFIG_ID||!environment.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID||environment.META_CONFIG_ID===environment.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
 const gates={app:environment.NEXT_PUBLIC_META_APP_ID===OBRASAAS_META_CHANNEL.appId,
  secret:typeof environment.META_APP_SECRET==='string'&&environment.META_APP_SECRET.length>=16,
  configuration:consistentConfig&&metaAssetId(configId),version:/^v\d{2}\.0$/.test(environment.META_GRAPH_API_VERSION||''),
  vault:customerVaultConfigured(environment),
  review:environment.OBRASAAS_META_SIGNUP_RELEASE==='customer-self-service-v1',
  callback:typeof environment.META_CUSTOMER_VERIFY_TOKEN==='string'&&environment.META_CUSTOMER_VERIFY_TOKEN.length>=32,
  signupVersion:environment.META_EMBEDDED_SIGNUP_VERSION==='4'};
 const available=Object.values(gates).every(Boolean),coexistenceConfig=environment.META_COEXISTENCE_CONFIG_ID;
 const coexistence=available&&environment.OBRASAAS_META_COEXISTENCE_RELEASE==='business-app-coexistence-v1'&&metaAssetId(coexistenceConfig)&&coexistenceConfig!==configId;
 return {canLaunchMeta:Object.values(gates).every(Boolean),canUseCustomerTransport:metaCustomerTransportReady({gates}),operational:false,gates,
  launchCode:Object.values(gates).every(Boolean)?'META_CUSTOMER_AUTHORIZATION_AVAILABLE':'META_CUSTOMER_CONFIGURATION_PENDING',
  appId:gates.app?environment.NEXT_PUBLIC_META_APP_ID:null,configId:gates.configuration?configId:null,
  version:gates.version?environment.META_GRAPH_API_VERSION:null,callbackPath:'/api/meta/customer-callback',
  recovery:{afterResponse:true,signedJob:typeof environment.META_CUSTOMER_JOB_SECRET==='string'&&environment.META_CUSTOMER_JOB_SECRET.length>=32,periodic:typeof environment.CRON_SECRET==='string'&&environment.CRON_SECRET.length>=32,intervalMinutes:5,productionVerified:false},
  humanAcceptance:'NOT_VERIFIED',numberRegistration:'REQUIRES_CUSTOMER_NUMBER',signupVersion:'4',
  flows:{DEDICATED:{available,configId:gates.configuration?configId:null},BUSINESS_APP:{available:coexistence,configId:coexistence?coexistenceConfig:null,featureType:'whatsapp_business_app_onboarding'},EXISTING_API:{available:false,configId:null,requiresSharePlan:true}}};
}
export function createMetaCustomerProvider({environment=process.env,fetchImpl=fetch,now=()=>Date.now(),readiness=metaCustomerReadiness,pilotCapability=null,pilotAudit=null}={}){
 // Embedded Signup versions govern new authorization flows. They do not
 // revoke previously granted customer transport. Retain every existing
 // transport prerequisite while requiring v4 separately for a new code.
 // The internal DEMO composition injects a different, complete seven-gate
 // contract. It cannot inherit CUSTOMER gates or authorize a partial shape.
 let inspectedAssets=null;
 const policy=()=>developmentPilotCapabilityPolicy(pilotCapability,environment,now());
 const scopedReady=()=>{
  const ready=readiness(environment);if(!pilotCapability)return ready;
  let current;try{current=policy();}catch{return developmentPilotUnavailableReadiness(ready,developmentPilotCapabilityExpiry(pilotCapability));}
  const audit=pilotAudits.get(pilotAudit),available=audit?.policyDigest===current.policyDigest&&audit.expiresAt>now()&&['app','secret','configuration','version','vault','callback','signupVersion'].every(key=>ready.gates?.[key]===true);
  return {...ready,mode:META_DEVELOPMENT_PILOT_MODE,pilot:{canLaunch:available,canUseAttendanceTransport:available,expiresAt:current.expiresAt,ownBusinessOnly:true,ownerReadbackReady:available,code:available?'META_DEVELOPMENT_PILOT_AVAILABLE':audit?.code||'META_DEVELOPMENT_PILOT_OWNER_UNVERIFIED',capabilities:{attendance:available,binding:available,kyc:false,media:false,flows:false,templates:false,progress:false,stock:false,company:false}}};
 };
 const config=(signupRequired=false)=>{const ready=scopedReady(),transportReady=pilotCapability?ready.pilot?.canUseAttendanceTransport===true:readiness===metaCustomerReadiness?metaCustomerTransportReady(ready):injectedDemoTransportReady(ready);if(!transportReady||signupRequired&&!metaCustomerAuthorizationReady(ready))throw new WorkspaceError(pilotCapability?ready.pilot.code:ready.launchCode,503);return ready;};
 const pilotAdapter=adapter=>{if(pilotCapability&&!['inspect','subscribe','register','reply'].includes(adapter))throw new WorkspaceError('META_DEVELOPMENT_PILOT_ADAPTER_UNAVAILABLE',409);};
 async function request(path,{token,method='GET',body,appToken=false}={}){
  const ready=config(),url=new URL(`https://graph.facebook.com/${ready.version}/${path}`);
  if(token&&!appToken)url.searchParams.set('appsecret_proof',createHmac('sha256',environment.META_APP_SECRET).update(token).digest('hex'));
  let response;try{response=await fetchImpl(url,{method,headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new WorkspaceError('META_CUSTOMER_PROVIDER_UNCONFIRMED',503);}
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new WorkspaceError(response.status>=500||[408,425,429].includes(response.status)?'META_CUSTOMER_PROVIDER_UNCONFIRMED':'META_CUSTOMER_PROVIDER_REJECTED',response.status>=500||[408,425,429].includes(response.status)?503:409);
  if(!payload||typeof payload!=='object')throw new WorkspaceError('META_CUSTOMER_PROVIDER_UNCONFIRMED',503);return payload;
 }
 return {
  readiness:scopedReady,
  assertWorkspace(context){if(pilotCapability){const current=assertDevelopmentPilotMember(pilotCapability,context,environment,now()),stored=context.project.metadata?.metaSignup?.developmentPilot;if(stored&&stored.policyDigest!==current.policyDigest)throw new WorkspaceError('META_DEVELOPMENT_PILOT_UNAVAILABLE',403);return current;}return null;},
  pilotReference(){if(!pilotCapability)return null;const current=policy();return {mode:META_DEVELOPMENT_PILOT_MODE,policyDigest:current.policyDigest,expiresAt:current.expiresAt};},
  pilotProvenance(verified){
   if(!pilotCapability)return null;const current=policy(),proof=pilotInspections.get(verified);
   if(!proof||proof.capability!==pilotCapability||proof.policyDigest!==current.policyDigest)throw new WorkspaceError('META_DEVELOPMENT_PILOT_OWNER_UNVERIFIED',403);
   return {version:1,mode:META_DEVELOPMENT_PILOT_MODE,policyDigest:current.policyDigest,actorId:current.actorId,clerkUserId:current.clerkUserId,clerkOrganizationId:current.clerkOrganizationId,organizationId:current.organizationId,projectId:current.projectId,appId:current.appId,configId:current.configId,businessId:current.businessId,expiresAt:current.expiresAt,wabaId:proof.wabaId,phoneNumberId:verified.phoneNumberId,displayPhoneNumber:verified.displayPhoneNumber,ownerVerified:true,verifiedAt:new Date(now()).toISOString()};
  },
  async forWorkspace(context){
   if(pilotCapability)return this;const capability=createDevelopmentPilotCapability(context,environment,now());if(!capability||readiness!==metaCustomerReadiness)return this;
   const current=developmentPilotCapabilityPolicy(capability,environment,now()),audit=Object.freeze({});let code='META_DEVELOPMENT_PILOT_OWNER_UNVERIFIED';
   const base=readiness(environment),credential=resolveMetaTransport(environment);
   // Independent read-only ownership auditor. Its credential is never a
   // customer transport credential and never enters an escrow or connection.
   try{
    if(credential.error||!['app','secret','configuration','version','vault','callback','signupVersion'].every(key=>base.gates?.[key]===true))throw new WorkspaceError(code,503);
    const auditRequest=async(path,{appToken=false}={})=>{
     developmentPilotCapabilityPolicy(capability,environment,now());const url=new URL(`https://graph.facebook.com/${base.version}/${path}`),token=appToken?base.appId+'|'+environment.META_APP_SECRET:credential.token;
     if(!appToken)url.searchParams.set('appsecret_proof',createHmac('sha256',environment.META_APP_SECRET).update(token).digest('hex'));
     let response;try{response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+token},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});}catch{throw new WorkspaceError(code,503);}
     const result=await readMetaJson(response,32768).catch(()=>null);if(!response.ok||!result||typeof result!=='object'||Array.isArray(result))throw new WorkspaceError(code,503);developmentPilotCapabilityPolicy(capability,environment,now());return result;
    };
    const debug=(await auditRequest('debug_token?'+new URLSearchParams({input_token:credential.token}),{appToken:true})).data,expiresAt=Number(debug?.expires_at);
    if(debug?.is_valid!==true||String(debug.app_id)!==current.appId||debug.type!=='SYSTEM_USER'||!hasMetaCustomerRequiredScopes(debug.scopes)||!debug.scopes.includes('business_management')||typeof debug.expires_at!=='number'||!Number.isSafeInteger(expiresAt)||expiresAt<0||expiresAt&&expiresAt*1000<=now()+300000)throw new WorkspaceError(code,403);
    const owned=await auditRequest(current.businessId+'/owned_whatsapp_business_accounts?'+new URLSearchParams({fields:'id',limit:'100'}));
    if(!Array.isArray(owned.data)||owned.data.length>100||owned.paging?.next||owned.data.some(item=>!metaAssetId(String(item?.id)))||new Set(owned.data.map(item=>String(item.id))).size!==owned.data.length)throw new WorkspaceError(code,403);
    pilotAudits.set(audit,{policyDigest:current.policyDigest,expiresAt:Math.min(Date.parse(current.expiresAt),now()+60000,expiresAt?expiresAt*1000:Infinity),ownedWabas:Object.freeze(owned.data.map(item=>String(item.id)))});
   }catch(error){code=error instanceof WorkspaceError&&error.code==='META_DEVELOPMENT_PILOT_UNAVAILABLE'?error.code:code;pilotAudits.set(audit,{policyDigest:current.policyDigest,expiresAt:0,code});}
   return createMetaCustomerProvider({environment,fetchImpl,now,readiness,pilotCapability:capability,pilotAudit:audit});
  },
  async forConnection({capability,connection,token}){
   if(!connection?.metadata?.developmentPilot)return this;
   const current=developmentPilotCapabilityPolicy(capability,environment,now());developmentPilotConnectionPolicy(connection,environment,now());
   const scoped=await this.forWorkspace({member:{actorId:current.actorId,organizationId:current.organizationId,role:'ADMIN'},session:{userId:current.clerkUserId,organizationId:current.clerkOrganizationId,organizationRole:'org:admin'},project:{id:current.projectId,organizationId:current.organizationId}});
   await scoped.inspect({token,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,numberMode:'DEDICATED'});return scoped;
  },
  async exchange(code){
   const ready=config(true),query=new URLSearchParams({client_id:ready.appId,client_secret:environment.META_APP_SECRET,code});
   const result=await request('oauth/access_token?'+query);
   if(typeof result.access_token!=='string'||result.access_token.length<20||result.access_token.length>4096)throw new WorkspaceError('META_CUSTOMER_EXCHANGE_UNCONFIRMED',503);return result.access_token;
  },
  async inspect({token,wabaId,phoneNumberId,numberMode='DEDICATED'}){
   pilotAdapter('inspect');if(pilotCapability&&(numberMode!=='DEDICATED'||!pilotAudits.get(pilotAudit)?.ownedWabas?.includes(wabaId)))throw new WorkspaceError('META_DEVELOPMENT_PILOT_OWNER_UNVERIFIED',403);
   const ready=config();const result=await request('debug_token?'+new URLSearchParams({input_token:token}),{token:ready.appId+'|'+environment.META_APP_SECRET,appToken:true});
   const data=result.data;
   if(data?.is_valid!==true||String(data.app_id)!==ready.appId||!hasMetaCustomerRequiredScopes(data.scopes))throw new WorkspaceError('META_CUSTOMER_TOKEN_SCOPE_REJECTED',403);
   const expiresAt=Number(data.expires_at);if(pilotCapability&&typeof data.expires_at!=='number'||!Number.isSafeInteger(expiresAt)||expiresAt<0||expiresAt&&expiresAt*1000<=now()+300000)throw new WorkspaceError('META_CUSTOMER_TOKEN_EXPIRED',409);
   const scopes=data.granular_scopes;
   if(!Array.isArray(scopes)||!scopes.some(scope=>scope.scope==='whatsapp_business_management'&&Array.isArray(scope.target_ids)&&scope.target_ids.map(String).includes(wabaId)))throw new WorkspaceError('META_CUSTOMER_WABA_SCOPE_REJECTED',403);
   const phones=await request(wabaId+'/phone_numbers?'+new URLSearchParams({fields:'id,display_phone_number,verified_name,code_verification_status,status,is_on_biz_app,platform_type',limit:'100'}),{token});
   if(!Array.isArray(phones.data)||phones.paging?.next)throw new WorkspaceError('META_CUSTOMER_PHONE_SELECTION_REQUIRED',409);
   const eligible=numberMode==='BUSINESS_APP'?phones.data.filter(item=>item.is_on_biz_app===true&&item.platform_type==='CLOUD_API'):phones.data;
   const phone=phoneNumberId?eligible.find(item=>String(item.id)===phoneNumberId):numberMode==='BUSINESS_APP'&&eligible.length===1?eligible[0]:null;
   if(!phone||!metaAssetId(String(phone.id)))throw new WorkspaceError(numberMode==='BUSINESS_APP'?'META_CUSTOMER_COEXISTENCE_PHONE_REQUIRED':'META_CUSTOMER_PHONE_WABA_MISMATCH',403);
   if(numberMode==='BUSINESS_APP'&&eligible.length!==1)throw new WorkspaceError('META_CUSTOMER_PHONE_SELECTION_REQUIRED',409);
   if(pilotCapability&&(phone.is_on_biz_app!==false||phone.platform_type!=='CLOUD_API'))throw new WorkspaceError('META_DEVELOPMENT_PILOT_DEDICATED_UNVERIFIED',403);
   // Phone verification is not the Cloud API registration signal.
   if(pilotCapability&&!developmentPilotPhoneMatches(policy(),phone.display_phone_number))throw new WorkspaceError('META_DEVELOPMENT_PILOT_PHONE_REJECTED',403);
   const verified={expiresAt:expiresAt?new Date(expiresAt*1000).toISOString():null,scopes:[...META_CUSTOMER_REQUIRED_SCOPES],
    phoneNumberId:String(phone.id),isOnBizApp:phone.is_on_biz_app===true,platformType:phone.platform_type||null,
    phoneStatus:typeof phone.status==='string'?phone.status:'UNKNOWN',registered:numberMode==='BUSINESS_APP'?phone.is_on_biz_app===true&&phone.platform_type==='CLOUD_API':phone.status==='CONNECTED',
    displayPhoneNumber:typeof phone.display_phone_number==='string'?phone.display_phone_number.slice(0,64):null,
    verifiedBusinessName:typeof phone.verified_name==='string'?phone.verified_name.slice(0,160):null};
   if(pilotCapability){pilotInspections.set(verified,{capability:pilotCapability,policyDigest:policy().policyDigest,wabaId});inspectedAssets={wabaId,phoneNumberId:verified.phoneNumberId};}return verified;
  },
  async subscribe({token,wabaId}){
   pilotAdapter('subscribe');if(pilotCapability&&inspectedAssets?.wabaId!==wabaId)throw new WorkspaceError('META_DEVELOPMENT_PILOT_OWNER_UNVERIFIED',403);
   await request(wabaId+'/subscribed_apps',{token,method:'POST',body:{override_callback_uri:'https://obrasaas.com/api/meta/customer-callback',verify_token:environment.META_CUSTOMER_VERIFY_TOKEN}});
   const subscriptions=await request(wabaId+'/subscribed_apps',{token});
   if(!subscriptions.data?.some(entry=>String(entry.whatsapp_business_api_data?.id??entry.app_id??entry.id)===config().appId))throw new WorkspaceError('META_CUSTOMER_SUBSCRIPTION_UNCONFIRMED',503);
   return true;
  },
  async inspectSubscription({token,wabaId}){
   if(pilotCapability&&inspectedAssets?.wabaId!==wabaId)throw new WorkspaceError('META_DEVELOPMENT_PILOT_OWNER_UNVERIFIED',403);
   if(!metaAssetId(wabaId))throw new WorkspaceError('META_CUSTOMER_WABA_SCOPE_REJECTED',403);
   const subscriptions=await request(wabaId+'/subscribed_apps',{token});
   return subscriptions.data?.some(entry=>String(entry.whatsapp_business_api_data?.id??entry.app_id??entry.id)===config().appId)===true;
  },
  async register({token,phoneNumberId,pin}){
   pilotAdapter('register');if(pilotCapability&&inspectedAssets?.phoneNumberId!==phoneNumberId)throw new WorkspaceError('META_DEVELOPMENT_PILOT_OWNER_UNVERIFIED',403);
   if(!metaAssetId(phoneNumberId)||!/^\d{6}$/.test(pin||''))throw new WorkspaceError('META_CUSTOMER_REGISTRATION_INPUT_INVALID');
   const result=await request(phoneNumberId+'/register',{token,method:'POST',body:{messaging_product:'whatsapp',pin}});
   if(result.success!==true)throw new WorkspaceError('META_CUSTOMER_REGISTRATION_UNCONFIRMED',503);return true;
  },
  async syncAppData({token,phoneNumberId,syncType}){
   pilotAdapter('coexistence');
   if(!readiness(environment).flows?.BUSINESS_APP?.available)throw new WorkspaceError('META_CUSTOMER_COEXISTENCE_CONFIGURATION_PENDING',503);
   if(!metaAssetId(phoneNumberId)||!['smb_app_state_sync','history'].includes(syncType))throw new WorkspaceError('META_CUSTOMER_SYNC_INPUT_INVALID');
   const result=await request(phoneNumberId+'/smb_app_data',{token,method:'POST',body:{messaging_product:'whatsapp',sync_type:syncType}});
   if(typeof result.request_id!=='string'||!result.request_id.length||result.request_id.length>200||/[\s\u0000-\u001f]/.test(result.request_id))throw new WorkspaceError('META_CUSTOMER_SYNC_UNCONFIRMED',503);
   return {requestId:result.request_id};
  },
  async templates({token,wabaId}){
   pilotAdapter('templates');
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
   pilotAdapter('templates');
   if(!metaAssetId(wabaId)||!/^[a-z0-9_]{1,512}$/.test(name||''))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_INVALID');
   const result=await request(wabaId+'/message_templates?'+new URLSearchParams({name,fields:'id,name,status,language,category,components',limit:'100'}),{token});
   if(!Array.isArray(result.data)||result.paging?.next)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_LOOKUP_UNCONFIRMED',503);
   const exact=result.data.filter(item=>item.name===name);if(exact.length>1)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_IDENTITY_CONFLICT',409);return exact[0]||null;
  },
  async createTemplate({token,wabaId,definition}){
   pilotAdapter('templates');
   const result=await request(wabaId+'/message_templates',{token,method:'POST',body:{name:definition.name,language:definition.language,category:definition.category,components:definition.components}});
   if(!metaAssetId(String(result.id)))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SUBMISSION_UNCONFIRMED',503);
   // Re-read the exact owned content; POST acceptance is not template approval.
   return result;
  },
  async sendReply({token,phoneNumberId,to,message,correlationId,replyTo}){
   pilotAdapter('reply');if(pilotCapability&&inspectedAssets?.phoneNumberId!==phoneNumberId)throw new WorkspaceError('META_DEVELOPMENT_PILOT_OWNER_UNVERIFIED',403);
   if(!metaAssetId(phoneNumberId)||!/^[1-9]\d{7,14}$/.test(to||'')||!/^customer_outbound_[a-f0-9]{64}$/.test(correlationId||'')||!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(replyTo||''))throw new WorkspaceError('META_CUSTOMER_REPLY_INVALID');
   const result=await request(phoneNumberId+'/messages',{token,method:'POST',body:{messaging_product:'whatsapp',recipient_type:'individual',to,...customerReplyMessage(message),context:{message_id:replyTo},biz_opaque_callback_data:correlationId}});
   const id=result.messages?.length===1?result.messages[0].id:null;
   if(!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(id||''))throw new WorkspaceError('META_CUSTOMER_SEND_UNCONFIRMED',503);
   return {messageId:id};
  },
  async sendTemplate({token,phoneNumberId,to,message,correlationId}){
   pilotAdapter('templates');
   if(!metaAssetId(phoneNumberId)||!/^[1-9]\d{7,14}$/.test(to||'')||!/^customer_outbound_[a-f0-9]{64}$/.test(correlationId||''))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_MESSAGE_INVALID');
   const result=await request(phoneNumberId+'/messages',{token,method:'POST',body:{messaging_product:'whatsapp',recipient_type:'individual',to,...customerTemplateMessage(message),biz_opaque_callback_data:correlationId}});
   const id=result.messages?.length===1?result.messages[0].id:null;
   if(!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(id||''))throw new WorkspaceError('META_CUSTOMER_SEND_UNCONFIRMED',503);
   return {messageId:id};
  },
  async downloadMedia({token,phoneNumberId,mediaId,limit=3*1024*1024}){
   pilotAdapter('media');
   if(!metaAssetId(phoneNumberId)||!metaAssetId(mediaId)||!Number.isSafeInteger(limit)||limit<=0||limit>3*1024*1024)throw new WorkspaceError('META_CUSTOMER_MEDIA_INVALID');
   // The URL originates exclusively from an authorized Graph lookup scoped to
   // this customer's phone. Webhook URLs are never download inputs.
   const item=await request(mediaId+'?'+new URLSearchParams({phone_number_id:phoneNumberId}),{token});
   let url;try{url=new URL(item.url);}catch{throw new WorkspaceError('META_CUSTOMER_MEDIA_UNCONFIRMED',503);}
   const mime=typeof item.mime_type==='string'?item.mime_type.toLowerCase().split(';')[0].trim():'';
   if(String(item.id)!==mediaId||!Number.isSafeInteger(item.file_size)||item.file_size<=0||item.file_size>limit||!['image/jpeg','image/png','image/webp','audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/webm','video/mp4','video/webm'].includes(mime)||url.protocol!=='https:'||url.hostname!=='lookaside.fbsbx.com'||url.username||url.password||url.port||url.hash||!url.pathname.startsWith('/whatsapp_business/attachments/'))throw new WorkspaceError('META_CUSTOMER_MEDIA_REJECTED',409);
   const expected=/^[a-f0-9]{64}$/i.test(item.sha256||'')?item.sha256.toLowerCase():/^[A-Za-z0-9+/]{43}=$/.test(item.sha256||'')?Buffer.from(item.sha256,'base64').toString('hex'):null;
   if(!expected)throw new WorkspaceError('META_CUSTOMER_MEDIA_UNCONFIRMED',503);
   let response;try{response=await fetchImpl(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new WorkspaceError('META_CUSTOMER_MEDIA_UNCONFIRMED',503);}
   if(!response.ok||!response.body||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!==mime)throw new WorkspaceError('META_CUSTOMER_MEDIA_UNCONFIRMED',503);
   const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)!==item.file_size))throw new WorkspaceError('META_CUSTOMER_MEDIA_INTEGRITY',409);
   const reader=response.body.getReader(),parts=[];let size=0;
   try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit||size>item.file_size)throw new WorkspaceError('META_CUSTOMER_MEDIA_INTEGRITY',409);parts.push(Buffer.from(part.value));}
    const bytes=Buffer.concat(parts,size);if(size!==item.file_size||createHash('sha256').update(bytes).digest('hex')!==expected)throw new WorkspaceError('META_CUSTOMER_MEDIA_INTEGRITY',409);return {bytes,contentType:mime,sha256:expected};
   }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  },
 };
}
