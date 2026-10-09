import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionProjectCreation} from '../../../../lib/project-creation-runtime.mjs';
import {createProjectCreationHandlers} from '../../../../lib/project-creation-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createProjectCreationHandlers({verify:verifyWorkspaceSession,store:productionProjectCreation});
export const GET=handlers.GET;
export const POST=handlers.POST;
