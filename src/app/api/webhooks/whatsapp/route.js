import {after} from 'next/server';
import {connectWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createMetaAppCallback} from '../../../../lib/meta-app-callback.mjs';
import {productionMetaDemoPilot} from '../../../../lib/meta-demo-pilot-runtime.mjs';
import {productionMetaCustomerProcessor} from '../../../../lib/meta-customer-processing-runtime.mjs';
import {META_CUSTOMER_PROTOCOL,META_DEMO_PILOT_PROTOCOL,metaCloudEventMatches} from '../../../../lib/meta-cloud-protocol.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
const handlers=createMetaAppCallback({connect:connectWorkspace,schedule:eventIds=>after(async()=>{
 const tasks=[[META_CUSTOMER_PROTOCOL,productionMetaCustomerProcessor],[META_DEMO_PILOT_PROTOCOL,productionMetaDemoPilot.processor]].map(async([protocol,processor])=>{
  const ids=eventIds.filter(id=>metaCloudEventMatches(protocol,id));if(ids.length)await processor.recover({eventIds:ids.slice(0,20),limit:1});
 });
 const results=await Promise.allSettled(tasks);if(results.some(r=>r.status==='rejected'))console.error('META_APP_PROCESSING_WAKEUP_UNCONFIRMED');
})});
export const GET=handlers.GET;
export const POST=handlers.POST;
