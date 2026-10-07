import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createProjectPreparation} from '../../../../lib/project-preparation-store.mjs';
import {createProjectPreparationHandlers} from '../../../../lib/project-preparation-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createProjectPreparationHandlers({verify:verifyWorkspaceSession,store:createProjectPreparation({workspace:productionWorkspace})});
export const GET=handlers.GET;
export const POST=handlers.POST;
