import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionWorkerChannel} from '../../../../lib/worker-channel-runtime.mjs';
import {createWorkerChannelHandlers} from '../../../../lib/worker-channel-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createWorkerChannelHandlers({verify:verifyWorkspaceSession,store:productionWorkerChannel});
export const GET=handlers.GET;
export const POST=handlers.POST;
