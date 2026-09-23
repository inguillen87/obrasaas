import { createOwnerDirectoryHandlers } from '@/lib/assignment-owner-directory-handlers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = createOwnerDirectoryHandlers();
export const GET = handlers.GET;
