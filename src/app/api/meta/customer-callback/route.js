import {connectWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers} from '../../../../lib/meta-customer-callback.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createMetaCustomerCallbackHandlers({inbox:createMetaCustomerInbox({connect:connectWorkspace})});
export const GET=handlers.GET;
export const POST=handlers.POST;
