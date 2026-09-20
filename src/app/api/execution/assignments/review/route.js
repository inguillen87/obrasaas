import { getPlatformAccess } from '@/lib/access';
import { createTaskAssignmentHandlers } from '@/lib/task-assignment-handlers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = createTaskAssignmentHandlers({ resolveAccess: getPlatformAccess });
export const POST = handlers.reviewPOST;
