import {createHmac,createHash} from 'node:crypto';
import {WorkspaceError} from './workspace-policy.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {customerVaultConfigured} from './meta-customer-credentials.mjs';
import {META_CUSTOMER_REQUIRED_SCOPES,hasMetaCustomerRequiredScopes} from './meta-customer-permissions.mjs';

export const metaAssetId=value=>typeof value==='string'&&/^[1-9]\d{4,31}$/.test(value);
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
  callback:typeof environment.META_CUSTOMER_VERIFY_TOKEN==='string'&&environment.META_CUSTOMER_VERIFY_TOKEN.length>=32};
 return {canLaunchMeta:Object.values(gates).every(Boolean),operational:false,gates,
  launchCode:Object.values(gates).every(Boolean)?'META_CUSTOMER_AUTHORIZATION_AVAILABLE':'META_CUSTOMER_CONFIGURATION_PENDING',
  appId:gates.app?environment.NEXT_PUBLIC_META_APP_ID:null,configId:gates.configuration?configId:null,
  version:gates.version?environment.META_GRAPH_API_VERSION:null,callbackPath:'/api/meta/customer-callback',
  recovery:{afterResponse:true,signedJob:typeof environment.META_CUSTOMER_JOB_SECRET==='string'&&environment.META_CUSTOMER_JOB_SECRET.length>=32,periodic:typeof environment.CRON_SECRET==='string'&&environment.CRON_SECRET.length>=32,intervalMinutes:5,productionVerified:false},
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
   if(data?.is_valid!==true||String(data.app_id)!==ready.appId||!hasMetaCustomerRequiredScopes(data.scopes))throw new WorkspaceError('META_CUSTOMER_TOKEN_SCOPE_REJECTED',403);
   const expiresAt=Number(data.expires_at);if(!Number.isSafeInteger(expiresAt)||expiresAt<0||expiresAt&&expiresAt*1000<=now()+300000)throw new WorkspaceError('META_CUSTOMER_TOKEN_EXPIRED',409);
   const scopes=data.granular_scopes;
   if(!Array.isArray(scopes)||!scopes.some(scope=>scope.scope==='whatsapp_business_management'&&Array.isArray(scope.target_ids)&&scope.target_ids.map(String).includes(wabaId)))throw new WorkspaceError('META_CUSTOMER_WABA_SCOPE_REJECTED',403);
   const phones=await request(wabaId+'/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,status&limit=100',{token});
   const phone=phones.data?.find(item=>String(item.id)===phoneNumberId);if(!phone)throw new WorkspaceError('META_CUSTOMER_PHONE_WABA_MISMATCH',403);
   // Phone verification is not the Cloud API registration signal.
   return {expiresAt:expiresAt?new Date(expiresAt*1000).toISOString():null,scopes:[...META_CUSTOMER_REQUIRED_SCOPES],
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
  async inspectSubscription({token,wabaId}){
   if(!metaAssetId(wabaId))throw new WorkspaceError('META_CUSTOMER_WABA_SCOPE_REJECTED',403);
   const subscriptions=await request(wabaId+'/subscribed_apps',{token});
   return subscriptions.data?.some(entry=>String(entry.whatsapp_business_api_data?.id??entry.app_id??entry.id)===config().appId)===true;
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
  async sendReply({token,phoneNumberId,to,message,correlationId,replyTo}){
   if(!metaAssetId(phoneNumberId)||!/^[1-9]\d{7,14}$/.test(to||'')||!/^customer_outbound_[a-f0-9]{64}$/.test(correlationId||'')||!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(replyTo||''))throw new WorkspaceError('META_CUSTOMER_REPLY_INVALID');
   const result=await request(phoneNumberId+'/messages',{token,method:'POST',body:{messaging_product:'whatsapp',recipient_type:'individual',to,...customerReplyMessage(message),context:{message_id:replyTo},biz_opaque_callback_data:correlationId}});
   const id=result.messages?.length===1?result.messages[0].id:null;
   if(!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(id||''))throw new WorkspaceError('META_CUSTOMER_SEND_UNCONFIRMED',503);
   return {messageId:id};
  },
  async downloadMedia({token,phoneNumberId,mediaId,limit=3*1024*1024}){
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
