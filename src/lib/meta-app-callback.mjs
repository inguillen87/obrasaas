import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {META_CUSTOMER_PROTOCOL,META_DEMO_PILOT_PROTOCOL} from './meta-cloud-protocol.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers,splitMetaAppEvents,lockMetaCustomerInboxChannel} from './meta-customer-callback.mjs';
import {lockDemoPilotChannel} from './meta-demo-pilot-policy.mjs';

// One signed body and one transaction, including an app batch with both protocols.
export function createMetaAppCallback({connect,environment=process.env,schedule=()=>{}}){
 const inbox=createMetaCustomerInbox({connect,environment,routeEvent:event=>event.wabaId===OBRASAAS_META_CHANNEL.wabaId?{protocol:META_DEMO_PILOT_PROTOCOL,lockChannel:(client,e)=>lockDemoPilotChannel(client,e,environment)}:{protocol:META_CUSTOMER_PROTOCOL,lockChannel:lockMetaCustomerInboxChannel}});
 return createMetaCustomerCallbackHandlers({inbox,environment,verifyTokenName:'META_VERIFY_TOKEN',splitEvents:splitMetaAppEvents,schedule});
}
