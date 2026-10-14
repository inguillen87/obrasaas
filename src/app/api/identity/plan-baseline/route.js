import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionPlanBaseline} from '../../../../lib/plan-baseline-runtime.mjs';
import {createPlanBaselineHandlers} from '../../../../lib/plan-baseline-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createPlanBaselineHandlers({verify:verifyWorkspaceSession,baselines:productionPlanBaseline});
export const GET=handlers.GET;
export const POST=handlers.POST;
