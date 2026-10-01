import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createCustomerWhatsAppSetup} from '../../../../lib/customer-whatsapp-setup.mjs';
import {createCustomerWhatsAppHandlers} from '../../../../lib/customer-whatsapp-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createCustomerWhatsAppHandlers({verify:verifyWorkspaceSession,service:createCustomerWhatsAppSetup({workspace:productionWorkspace})});
export const GET=handlers.GET;
export const POST=handlers.POST;
