import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionOfficeChat} from '../../../../lib/office-chat-runtime.mjs';
import {createOfficeChatHandlers} from '../../../../lib/office-chat-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createOfficeChatHandlers({verify:verifyWorkspaceSession,store:productionOfficeChat});
export const GET=handlers.GET;
export const POST=handlers.POST;
