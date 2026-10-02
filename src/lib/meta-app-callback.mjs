import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {META_CUSTOMER_PROTOCOL,META_DEMO_PILOT_PROTOCOL} from './meta-cloud-protocol.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers,splitMetaAppEvents,lockMetaCustomerInboxChannel} from './meta-customer-callback.mjs';
import {lockDemoPilotChannel} from './meta-demo-pilot-policy.mjs';

export function metaAppHandshakeDiagnostics(request){
 const params=new URL(request.url).searchParams,known=['hub.mode','hub.verify_token','hub.challenge'],challenge=params.get('hub.challenge')||'';
 return {parameterCount:params.size,modeIsSubscribe:params.get('hub.mode')==='subscribe',missingKnownParameters:known.some(key=>!params.has(key)),duplicateKnownParameters:known.some(key=>params.getAll(key).length>1),unknownParameterCount:[...params.keys()].filter(key=>!known.includes(key)).length,challengeLength:challenge.length,challengeHasAsciiControl:/[\u0000-\u001f\u007f]/.test(challenge)};
}
export function createMetaAppHandshakeGet(get,{log=(...entry)=>console.warn(...entry)}={}){
 return async request=>{
  const response=await get(request);
  if(response.status===400){try{log('META_APP_HANDSHAKE_INVALID',metaAppHandshakeDiagnostics(request));}catch{/* Diagnostics must not alter Meta's response. */}}
  return response;
 };
}

// One signed body and one transaction, including an app batch with both protocols.
export function createMetaAppCallback({connect,environment=process.env,schedule=()=>{}}){
 const inbox=createMetaCustomerInbox({connect,environment,routeEvent:event=>event.wabaId===OBRASAAS_META_CHANNEL.wabaId?{protocol:META_DEMO_PILOT_PROTOCOL,lockChannel:(client,e)=>lockDemoPilotChannel(client,e,environment)}:{protocol:META_CUSTOMER_PROTOCOL,lockChannel:lockMetaCustomerInboxChannel}});
 return createMetaCustomerCallbackHandlers({inbox,environment,verifyTokenName:'META_VERIFY_TOKEN',splitEvents:splitMetaAppEvents,schedule});
}
