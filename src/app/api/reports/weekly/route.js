import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { getAppStateSnapshot, getMessages } from '@/lib/db';
import { FIRST_VALUE_REPORT_ACTION } from '@/lib/first-value-onboarding';
import {
  MEDICAL_EVIDENCE_PERMISSION,
  SOURCE_EVIDENCE_PERMISSION,
  sanitizeProjectStateMedicalData,
} from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';
import { buildWeeklyReportModel } from '@/lib/reporting';

export async function POST() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:reports:read');
    const includeMedicalEvidence = hasTenantPermission(
      access,
      MEDICAL_EVIDENCE_PERMISSION,
    );
    const includeSourceEvidence = hasTenantPermission(
      access,
      SOURCE_EVIDENCE_PERMISSION,
    );

    const [snapshot, messages] = await Promise.all([
      getAppStateSnapshot(access),
      getMessages(access, {
        includeMedicalEvidence,
        includeSourceEvidence,
      }),
    ]);
    const generatedAt = new Date();
    const report = buildWeeklyReportModel({
      state: sanitizeProjectStateMedicalData(snapshot.state),
      messages,
      organization: access.organization,
      project: access.project,
      actorEmail: access.email,
      generatedAt,
      snapshot: snapshot.exists ? snapshot : null,
    });

    await getPrisma().auditLog.create({
      data: {
        organizationId: access.organization.id,
        actorId: access.databaseUserId,
        action: FIRST_VALUE_REPORT_ACTION,
        entityType: 'WeeklyReport',
        entityId: access.project.id,
        metadata: {
          projectId: access.project.id,
          reportId: report.reportId,
          snapshotVersion: report.snapshotVersion,
          generatedAt: generatedAt.toISOString(),
          emptyState: report.isEmptyState,
        },
      },
    });

    return Response.json({
      href: '/dashboard/report?print=true',
      report: {
        id: report.reportId,
        emptyState: report.isEmptyState,
        snapshotVersion: report.snapshotVersion,
      },
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
