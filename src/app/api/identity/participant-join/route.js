import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionParticipants} from '../../../../lib/participant-runtime.mjs';
import {createParticipantHandlers} from '../../../../lib/participant-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createParticipantHandlers({verify:verifyWorkspaceSession,store:productionParticipants,join:true});
export const GET=handlers.GET;
export const POST=handlers.POST;
