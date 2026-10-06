import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionPlanImport} from '../../../../lib/plan-import-runtime.mjs';
import {createPlanImportHandlers} from '../../../../lib/plan-import-http.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=120;
const handlers=createPlanImportHandlers({verify:verifyWorkspaceSession,imports:productionPlanImport});
export const GET=handlers.GET;
export const POST=handlers.POST;
