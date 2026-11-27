import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createConsumptionEvidenceCatalog,createConsumptionEvidenceHandler} from '../../../../lib/consumption-evidence-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=createConsumptionEvidenceHandler({verify:verifyWorkspaceSession,store:createConsumptionEvidenceCatalog({workspace:productionWorkspace})});
