import { getPlatformAccess } from '@/lib/access';
import { createCrewMembershipHandlers } from '@/lib/crew-membership-handlers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = createCrewMembershipHandlers({ resolveAccess: getPlatformAccess });
export const GET = handlers.listGET;
export const POST = handlers.addPOST;
