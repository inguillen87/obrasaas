import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionCompanySubscription} from '../../../../lib/company-subscription-runtime.mjs';
import {createCompanySubscriptionHandlers} from '../../../../lib/company-subscription-http.mjs';
export const runtime='nodejs';
export const maxDuration=90;
export const dynamic='force-dynamic';
const handlers=createCompanySubscriptionHandlers({verifySession:verifyWorkspaceSession,store:productionCompanySubscription});
export const GET=handlers.GET;
export const POST=handlers.POST;
