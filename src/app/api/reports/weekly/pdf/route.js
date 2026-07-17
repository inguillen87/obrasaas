import { createHash } from 'node:crypto';

import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  renderWeeklyReportPdf,
  weeklyReportPdfFilename,
} from '@/lib/report-pdf';
import {
  loadWeeklyReportModel,
  recordWeeklyReportGeneration,
  reserveWeeklyReportGeneration,
} from '@/lib/weekly-report-service';
import { weeklyReportRateLimitResponse } from '@/lib/report-rate-limit';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:reports:read');
    await reserveWeeklyReportGeneration(access);
    const report = await loadWeeklyReportModel(access);
    const bytes = await renderWeeklyReportPdf(report);
    const sha256 = createHash('sha256').update(bytes).digest('hex');

    await recordWeeklyReportGeneration(access, report, {
      format: 'pdf',
      byteLength: bytes.byteLength,
      sha256,
    });

    return new Response(bytes, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': `attachment; filename="${weeklyReportPdfFilename(report)}"`,
        'Content-Length': String(bytes.byteLength),
        'Content-Type': 'application/pdf',
        'X-Content-Type-Options': 'nosniff',
        'X-Report-Id': report.reportId,
        'X-Report-Sha256': sha256,
        'X-Report-Version': report.snapshotVersion == null
          ? 'none'
          : String(report.snapshotVersion),
      },
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    const rateLimitResponse = weeklyReportRateLimitResponse(error);
    if (rateLimitResponse) return rateLimitResponse;
    console.error('Weekly PDF generation failed:', error);
    return Response.json({
      error: 'No pudimos generar el PDF semanal.',
      code: 'REPORT_PDF_GENERATION_FAILED',
    }, { status: 500 });
  }
}
