import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
export async function POST() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:reports:read');

    return Response.json({
      href: '/dashboard/report',
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error('Weekly report generation failed:', error);
    return Response.json({
      error: 'No pudimos generar el reporte semanal.',
      code: 'REPORT_GENERATION_FAILED',
    }, { status: 500 });
  }
}
