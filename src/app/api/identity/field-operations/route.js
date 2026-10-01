import { verifyWorkspaceSession } from '../../../../lib/verified-session.mjs';
import { productionFieldOperations } from '../../../../lib/field-operations-runtime.mjs';
import { createFieldHandlers } from '../../../../lib/field-operations-http.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const handlers=createFieldHandlers({verify:verifyWorkspaceSession,operations:productionFieldOperations});
export const GET=handlers.GET;
export const POST=handlers.POST;
