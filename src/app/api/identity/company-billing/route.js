import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createCompanyBilling} from '../../../../lib/company-billing.mjs';
import {createCompanyBillingHandlers} from '../../../../lib/company-billing-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createCompanyBillingHandlers({verifySession:verifyWorkspaceSession,store:createCompanyBilling({workspace:productionWorkspace})});
export const GET=handlers.GET;
export const POST=handlers.POST;
