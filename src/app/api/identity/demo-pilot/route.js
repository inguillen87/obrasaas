import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionMetaDemoPilot} from '../../../../lib/meta-demo-pilot-runtime.mjs';
import {createMetaDemoPilotHandlers} from '../../../../lib/meta-demo-pilot-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
const handlers=createMetaDemoPilotHandlers({verify:verifyWorkspaceSession,service:productionMetaDemoPilot.service});
export const GET=handlers.GET;
export const POST=handlers.POST;
