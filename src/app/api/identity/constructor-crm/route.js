import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionConstructorCrm} from '../../../../lib/constructor-crm-runtime.mjs';
import {createConstructorCrmHandlers} from '../../../../lib/constructor-crm-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createConstructorCrmHandlers({verify:verifyWorkspaceSession,store:productionConstructorCrm});
export const GET=handlers.GET;
export const POST=handlers.POST;
