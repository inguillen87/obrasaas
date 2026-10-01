import {verifyWorkspaceSession} from '@/lib/verified-session.mjs';
import {productionWorkspace} from '@/lib/workspace-runtime.mjs';
import {createSitePurchases} from '@/lib/site-purchase-store.mjs';
import {createSitePurchaseHandlers} from '@/lib/site-purchase-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createSitePurchaseHandlers({verify:verifyWorkspaceSession,store:createSitePurchases({workspace:productionWorkspace})});
export const GET=handlers.GET;
export const POST=handlers.POST;
