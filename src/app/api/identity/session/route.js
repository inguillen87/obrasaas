import { sessionCheckResponse } from '../../../../lib/verified-session.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request) { return sessionCheckResponse(request); }
