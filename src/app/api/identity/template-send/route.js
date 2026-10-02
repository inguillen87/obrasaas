import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionMetaCustomerTemplateSend} from '../../../../lib/meta-customer-template-send-runtime.mjs';
import {createMetaCustomerTemplateSendHandlers} from '../../../../lib/meta-customer-template-send-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const handlers=createMetaCustomerTemplateSendHandlers({verify:verifyWorkspaceSession,service:productionMetaCustomerTemplateSend});
export const GET=handlers.GET;
export const POST=handlers.POST;
