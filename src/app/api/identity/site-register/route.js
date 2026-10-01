import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createSiteRegister} from '../../../../lib/site-register-store.mjs';
import {createSiteRegisterHandlers} from '../../../../lib/site-register-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createSiteRegisterHandlers({verify:verifyWorkspaceSession,store:createSiteRegister({workspace:productionWorkspace})});
export const GET=handlers.GET;
export const POST=handlers.POST;
