import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionPlanMeasurement} from '../../../../lib/plan-measurement-runtime.mjs';
import {createPlanMeasurementHandlers} from '../../../../lib/plan-measurement-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
const handlers=createPlanMeasurementHandlers({verify:verifyWorkspaceSession,measurements:productionPlanMeasurement});
export const GET=handlers.GET;
export const POST=handlers.POST;
