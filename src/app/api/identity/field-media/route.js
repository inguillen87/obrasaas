import { verifyWorkspaceSession } from '../../../../lib/verified-session.mjs';
import { productionFieldMedia } from '../../../../lib/field-operations-runtime.mjs';
import { createFieldMediaHandlers } from '../../../../lib/field-operations-http.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const handlers=createFieldMediaHandlers({verify:verifyWorkspaceSession,media:productionFieldMedia});
export const GET=handlers.GET;
export const POST=handlers.POST;
