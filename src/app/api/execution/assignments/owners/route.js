import { getPlatformAccess } from '@/lib/access';
import { createOwnerDirectoryHandlers } from '@/lib/assignment-owner-directory-handlers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = createOwnerDirectoryHandlers({ resolveAccess: getPlatformAccess });
export const GET = handlers.GET;
