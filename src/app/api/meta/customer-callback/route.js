import {connectWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers} from '../../../../lib/meta-customer-callback.mjs';
import {after} from 'next/server';
import {productionMetaCustomerProcessor} from '../../../../lib/meta-customer-processing-runtime.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
const handlers=createMetaCustomerCallbackHandlers({inbox:createMetaCustomerInbox({connect:connectWorkspace}),schedule:eventIds=>after(async()=>{
 try{await productionMetaCustomerProcessor.recover({eventIds:eventIds.slice(0,20),limit:3});}catch{console.error('META_CUSTOMER_PROCESSING_WAKEUP_UNCONFIRMED');}
})});
export const GET=handlers.GET;
export const POST=handlers.POST;
