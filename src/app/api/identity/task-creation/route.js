import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createWorkspaceHandlers} from '../../../../lib/workspace-http.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const handlers=createWorkspaceHandlers({verify:verifyWorkspaceSession,store:{list:productionWorkspace.list,read:productionWorkspace.read,schedule:productionWorkspace.createTask,status:productionWorkspace.taskCreationStatus}});
export const GET=handlers.GET;export const POST=handlers.POST;
