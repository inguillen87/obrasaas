import {after} from 'next/server';
import {productionMetaDemoPilot} from '../../../lib/meta-demo-pilot-runtime.mjs';
import {createMetaCustomerCallbackHandlers} from '../../../lib/meta-customer-callback.mjs';
import {META_DEMO_PILOT_PROTOCOL} from '../../../lib/meta-cloud-protocol.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
// The fixed TestNumber never enters the historical global-state/DNI/GPS engine.
// Without a signed, scoped and consented demo grant, no inbox/effect/send occurs.
const handlers=createMetaCustomerCallbackHandlers({inbox:productionMetaDemoPilot.inbox,protocol:META_DEMO_PILOT_PROTOCOL,verifyTokenName:'META_VERIFY_TOKEN',schedule:eventIds=>after(async()=>{
 try{await productionMetaDemoPilot.processor.recover({eventIds:eventIds.slice(0,20),limit:3});}catch{console.error('META_DEMO_PROCESSING_WAKEUP_UNCONFIRMED');}
})});
export const GET=handlers.GET;
export const POST=handlers.POST;
