import { getPlatformAccess } from '@/lib/access';
import { createAssignmentRescheduleHandlers } from '@/lib/assignment-reschedule-handlers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = createAssignmentRescheduleHandlers({ resolveAccess: getPlatformAccess });
export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
