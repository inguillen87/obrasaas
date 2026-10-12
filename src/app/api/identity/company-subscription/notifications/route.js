import {productionCompanySubscription,productionCompanySubscriptionProvider} from '../../../../../lib/company-subscription-runtime.mjs';
import {createCompanySubscriptionWebhookHandlers} from '../../../../../lib/company-subscription-http.mjs';
export const runtime='nodejs';
export const maxDuration=90;
export const dynamic='force-dynamic';
const handlers=createCompanySubscriptionWebhookHandlers({provider:productionCompanySubscriptionProvider,store:productionCompanySubscription});
export const GET=handlers.GET;
export const POST=handlers.POST;
