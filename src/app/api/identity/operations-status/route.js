import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createOperationsStatus,createOperationsStatusHandler} from '../../../../lib/operations-status.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=createOperationsStatusHandler({verify:verifyWorkspaceSession,store:createOperationsStatus({workspace:productionWorkspace})});
