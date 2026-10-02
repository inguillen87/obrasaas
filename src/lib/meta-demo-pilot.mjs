import {META_DEMO_PILOT_PROTOCOL} from './meta-cloud-protocol.mjs';
import {createMetaCustomerProvider} from './meta-customer-provider.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers} from './meta-customer-callback.mjs';
import {resolveWorkerChannelIdentity} from './worker-channel-identity.mjs';
import {createMetaFieldBridge} from './meta-field-bridge.mjs';
import {createMetaCustomerOutbound} from './meta-customer-outbound.mjs';
import {createMetaCustomerProcessor} from './meta-customer-processing.mjs';
import {createMetaDemoPilotStore} from './meta-demo-pilot-store.mjs';
import {metaDemoTransportReadiness,assertDemoPilotConnection,assertDemoPilotResolved,lockDemoPilotChannel,labelDemoPilotReply,META_DEMO_REVIEW_CODES} from './meta-demo-pilot-policy.mjs';

// Composition of the existing engines; no alternate identity, business or send lane.
export function createMetaDemoPilot({connect,workspace,environment=process.env,fetchImpl=fetch,provider,put,get,analyzer,schedule=()=>{}}){
 const cloud=provider||createMetaCustomerProvider({environment,fetchImpl,readiness:metaDemoTransportReadiness});
 const demoProvider=Object.freeze({inspect:args=>cloud.inspect(args),inspectSubscription:args=>cloud.inspectSubscription(args),sendReply:args=>cloud.sendReply(args),downloadMedia:args=>cloud.downloadMedia(args)});
 const assertConnection=(c,org,pid,now,opts)=>assertDemoPilotConnection(c,org,pid,now,opts,environment);
 const resolveIdentity=async(client,context)=>assertDemoPilotResolved(client,await resolveWorkerChannelIdentity(client,{...context,protocol:META_DEMO_PILOT_PROTOCOL,assertConnection}),environment);
 const bridge=createMetaFieldBridge({connect,environment,resolveIdentity,provider:demoProvider,put,get,analyzer,protocol:META_DEMO_PILOT_PROTOCOL});
 const outbound=createMetaCustomerOutbound({connect,environment,resolveIdentity,provider:demoProvider,protocol:META_DEMO_PILOT_PROTOCOL,channelActive:(c,now)=>{assertConnection(c,c.organizationId,c.projectId,now);return true;}});
 const inbox=createMetaCustomerInbox({connect,environment,protocol:META_DEMO_PILOT_PROTOCOL,lockChannel:(client,event)=>lockDemoPilotChannel(client,event,environment)});
 const processor=createMetaCustomerProcessor({connect,environment,protocol:META_DEMO_PILOT_PROTOCOL,authorizationCodes:META_DEMO_REVIEW_CODES,lockChannel:(client,event)=>lockDemoPilotChannel(client,event,environment,{allowInactive:true}),dispatch:async context=>{const result=await bridge.execute(context);if(result?.kind==='CHANNEL_BOUND')result.reply={type:'text',body:'Tu WhatsApp quedó vinculado al piloto DEMO de esta obra de prueba. Escribí MENU para continuar. Esta prueba no acredita identidad civil ni operaciones de una obra real.'};return result?.reply?{...result,reply:labelDemoPilotReply(result.reply)}:result;},outbound});
 return {service:createMetaDemoPilotStore({workspace,provider:demoProvider,environment}),callback:createMetaCustomerCallbackHandlers({inbox,environment,protocol:META_DEMO_PILOT_PROTOCOL,verifyTokenName:'META_VERIFY_TOKEN',schedule}),inbox,processor,outbound};
}
