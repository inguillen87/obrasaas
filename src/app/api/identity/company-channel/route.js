import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createCompanyChannelStore} from '../../../../lib/company-channel-store.mjs';
import {createCompanyChannelHandlers} from '../../../../lib/company-channel-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createCompanyChannelHandlers({verify:verifyWorkspaceSession,store:createCompanyChannelStore({workspace:productionWorkspace})});
export const GET=handlers.GET;
export const POST=handlers.POST;
