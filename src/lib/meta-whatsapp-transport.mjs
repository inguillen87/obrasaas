// Real Meta transport. A test phone number still makes real API calls.
// API acceptance is not delivery; never synthesize a wamid or silently retry.
const text=value=>typeof value==='string'&&value.length>0&&!/[\u0000-\u001f\u007f]/.test(value);
const id=value=>typeof value==='string'&&/^[1-9]\d{4,31}$/.test(value);
const no={success:false,accepted:false,delivered:false,read:false,simulated:false};
export const metaFailure=(code,state='NOT_SUBMITTED',extra={})=>({...no,state,code,...extra});
export function normalizeWhatsAppRecipient(value){
 if(typeof value!=='string'||!/^\+?[1-9][0-9 ()-]{6,25}$/.test(value))return null;
 const digits=value.replace(/[+ ()-]/g,'');return /^[1-9]\d{6,14}$/.test(digits)?digits:null;
}
export function resolveMetaTransport(environment=process.env,phoneNumberId){
 const pair=(a,b)=>environment[a]&&environment[b]&&environment[a]!==environment[b];
 if(pair('META_WHATSAPP_ACCESS_TOKEN','WHATSAPP_TOKEN')||pair('META_PHONE_NUMBER_ID','WHATSAPP_PHONE_NUMBER_ID'))return {error:'META_CONFIG_CONFLICT'};
 const token=environment.META_WHATSAPP_ACCESS_TOKEN||environment.WHATSAPP_TOKEN;
 const phone=environment.META_PHONE_NUMBER_ID||environment.WHATSAPP_PHONE_NUMBER_ID;
 const version=environment.META_GRAPH_API_VERSION||'v21.0';
 if(!text(token)||token.trim()!==token||token==='[SENSITIVE]'||token.length<20||token.length>8192||!id(phone))return {error:'META_TRANSPORT_NOT_CONFIGURED'};
 if(!/^v\d{1,3}\.0$/.test(version))return {error:'META_GRAPH_VERSION_INVALID'};
 if(phoneNumberId!==undefined&&phoneNumberId!==phone)return {error:'META_SENDER_MISMATCH'};
 return {token,phoneNumberId:phone,version};
}
export async function readMetaJson(response,limit=65536){
 if(!response.body?.getReader)throw new Error('META_RESPONSE_INVALID');
 const reader=response.body.getReader(),parts=[];let size=0;
 try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>limit)throw new Error('META_RESPONSE_TOO_LARGE');parts.push(Buffer.from(item.value));}
  const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('META_RESPONSE_INVALID');return data;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function metaErrorCode(error){
 const code=Number.isSafeInteger(error?.code)?error.code:null;
 const known={190:'META_ACCESS_TOKEN_INVALID',131030:'META_TEST_RECIPIENT_NOT_ALLOWED',131047:'META_SESSION_WINDOW_CLOSED',132001:'META_TEMPLATE_NOT_AVAILABLE',130429:'META_RATE_LIMITED',131031:'META_ACCOUNT_RESTRICTED',10:'META_PERMISSION_REQUIRED',200:'META_PERMISSION_REQUIRED'};
 return {code:known[code]||'META_REQUEST_REJECTED',providerCode:code};
}
const short=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
function validInteractive(value){
 if(!value||!short(value.body?.text,1024))return false;
 if(value.type==='button')return Array.isArray(value.action?.buttons)&&value.action.buttons.length>=1&&value.action.buttons.length<=3&&value.action.buttons.every(b=>b.type==='reply'&&short(b.reply?.id,256)&&short(b.reply?.title,20));
 if(value.type==='list'){
  const sections=value.action?.sections,rows=sections?.flatMap(s=>s.rows||[]);
  return short(value.action?.button,20)&&Array.isArray(sections)&&sections.length>0&&sections.length<=10&&rows.length>0&&rows.length<=10&&
   sections.every(s=>Array.isArray(s.rows)&&s.rows.length>0)&&rows.every(row=>short(row.id,200)&&short(row.title,24)&&(!row.description||short(row.description,72)))&&new Set(rows.map(r=>r.id)).size===rows.length;
 }
 return false;
}
function validMedia(value){
 if(!value||typeof value!=='object')return false;
 if(value.id&&value.link)return false;
 if(value.id)return id(value.id);
 if(!text(value.link))return false;
 try{const url=new URL(value.link);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&!url.port&&
  !/(?:^localhost$|\.local$|\.internal$|\.private\.blob\.vercel-storage\.com$)/.test(url.hostname)&&!/^[\d.]+$/.test(url.hostname)&&!url.hostname.includes(':');}catch{return false;}
}
export function prepareMetaPayload(to,body){
 let value,recipient;
 if(to&&typeof to==='object'&&!Array.isArray(to)){value=to;recipient=normalizeWhatsAppRecipient(to.to);}
 else{recipient=normalizeWhatsAppRecipient(to);value=typeof body==='string'?{type:'text',text:{body}}:body;}
 if(!recipient||!value||typeof value!=='object'||Array.isArray(value))return null;
 if(value.to!==undefined&&normalizeWhatsAppRecipient(value.to)!==recipient)return null;
 if(value.messaging_product!==undefined&&value.messaging_product!=='whatsapp')return null;
 const supported=['text','template','interactive','document','image','audio','video'];
 if(!supported.includes(value.type))return null;
 const payload={messaging_product:'whatsapp',to:recipient,type:value.type,[value.type]:value[value.type]};
 if(value.type==='text'&&!short(value.text?.body,4096))return null;
 if(value.type==='template'&&(!/^[a-z0-9_]{1,512}$/.test(value.template?.name||'')||!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(value.template?.language?.code||'')||
  (value.template.components!==undefined&&!Array.isArray(value.template.components))))return null;
 if(value.type==='interactive'&&!validInteractive(value.interactive))return null;
 if(['document','image','audio','video'].includes(value.type)&&!validMedia(value[value.type]))return null;
 try{const serialized=JSON.stringify(payload);if(Buffer.byteLength(serialized)>32768)return null;return JSON.parse(serialized);}catch{return null;}
}
export function classifyMetaSubmission(httpStatus,data){
 if(httpStatus<200||httpStatus>299){
  if(httpStatus>=500)return metaFailure('META_RESULT_UNCONFIRMED','UNCONFIRMED',{httpStatus});
  return metaFailure(metaErrorCode(data?.error).code,'REJECTED_BY_META',{httpStatus,providerCode:metaErrorCode(data?.error).providerCode});
 }
 const message=data?.messages?.[0]?.id;
 if(data?.error||data?.messaging_product!=='whatsapp'||data?.messages?.length!==1||typeof message!=='string'||!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(message))return metaFailure('META_RESULT_UNCONFIRMED','UNCONFIRMED',{httpStatus});
 return {success:true,accepted:true,delivered:false,read:false,simulated:false,state:'ACCEPTED_BY_META',messageId:message,httpStatus};
}
export function createMetaSender({fetchImpl=fetch,environment=()=>process.env,timeoutMs=15000}={}){
 return async function send(to,body,phoneNumberId){
  const payload=prepareMetaPayload(to,body);if(!payload)return metaFailure('META_PAYLOAD_INVALID');
  const config=resolveMetaTransport(environment(),phoneNumberId);if(config.error)return metaFailure(config.error);
  try{
   const response=await fetchImpl(`https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`,{
    method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},
    body:JSON.stringify(payload),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});
   const data=await readMetaJson(response);return classifyMetaSubmission(response.status,data);
  }catch{return metaFailure('META_RESULT_UNCONFIRMED','UNCONFIRMED');}
 };
}
export const metaDispatchHttpStatus=result=>result?.accepted?200:result?.state==='UNCONFIRMED'?502:result?.code==='META_PAYLOAD_INVALID'?400:result?.state==='REJECTED_BY_META'?422:503;
