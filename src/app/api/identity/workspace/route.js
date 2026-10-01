import { verifyWorkspaceSession } from '../../../../lib/verified-session.mjs';
import { productionWorkspace } from '../../../../lib/workspace-runtime.mjs';
import { createWorkspaceHandlers } from '../../../../lib/workspace-http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const handlers = createWorkspaceHandlers({ verify: verifyWorkspaceSession, store: productionWorkspace });
export const GET = handlers.GET;
export const POST = handlers.POST;
