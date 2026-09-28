export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ service: 'ObraSaaS', availability: 'public-site-online', operationalAccess: 'restricted',
    release: 'production-boundary-20260928', databaseChecked: false },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}
