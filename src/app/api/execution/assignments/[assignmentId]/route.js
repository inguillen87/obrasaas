import { getPlatformAccess } from '@/lib/access';
import { createTaskAssignmentHandlers } from '@/lib/task-assignment-handlers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = createTaskAssignmentHandlers({ resolveAccess: getPlatformAccess });
export const GET = handlers.detailGET;
export const PATCH = handlers.detailPATCH;
