import {readMetaJson,normalizeWhatsAppRecipient,resolveMetaTransport,metaFailure,metaDispatchHttpStatus} from './meta-whatsapp-transport.mjs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const reply=(value,status)=>Response.json(value,{status,headers});
export function testRecipients(environment=process.env){
 const raw=environment.META_TEST_ALLOWED_RECIPIENTS;
 if(typeof raw!=='string'||raw.length>2048)return [];
 const values=raw.split(',');
 if(!values.length||values.length>20||values.some(value=>normalizeWhatsAppRecipient(value)!==value))return [];
 return [...new Set(values)];
}
export function createMetaTestDispatch({authorize,send,environment=()=>process.env}){
 const authorized=request=>authorize(request)?.authorized===true;
 return {
  async GET(request){
   if(!authorized(request))return reply(metaFailure('AUTHENTICATION_REQUIRED'),401);
   const env=environment(),config=resolveMetaTransport(env);
   return reply({success:true,state:config.error?'CONFIGURATION_INCOMPLETE':'CONFIGURATION_PRESENT',
    channelMode:env.META_CHANNEL_MODE==='test'?'META_TEST_NUMBER':'NOT_SELECTED',
    testRecipientCount:testRecipients(env).length,providerVerified:false,deliveryVerified:false,
    numberPurchaseRequired:false,businessOperationsEnabled:false},200);
  },
  async POST(request){
   if(!authorized(request))return reply(metaFailure('AUTHENTICATION_REQUIRED'),401);
   let body;try{if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error();body=await readMetaJson(request,32768);}catch{return reply(metaFailure('META_PAYLOAD_INVALID'),400);}
   const env=environment();if(env.META_CHANNEL_MODE!=='test')return reply(metaFailure('META_TEST_MODE_NOT_SELECTED'),503);
   const to=normalizeWhatsAppRecipient(body.recipientPhone);
   if(!to)return reply(metaFailure('META_PAYLOAD_INVALID'),400);
   if(!testRecipients(env).includes(to))return reply(metaFailure('META_LOCAL_TEST_RECIPIENT_NOT_ALLOWED'),403);
   let payload;
   if(body.messageType==='hello_world')payload={type:'template',template:{name:'hello_world',language:{code:'en_US'}}};
   else if(['text','custom'].includes(body.messageType)&&typeof body.customText==='string')payload={type:'text',text:{body:body.customText}};
   else if(body.messageType==='payload')payload=body.payload;
   else return reply(metaFailure('META_OPERATION_REQUIRES_CANONICAL_SCOPE'),409);
   const result=await send(to,payload);
   return reply({...result,businessDataWritten:false,automaticRetry:false},metaDispatchHttpStatus(result));
  }
 };
}
