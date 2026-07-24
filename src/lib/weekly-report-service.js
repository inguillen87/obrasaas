import 'server-only';

import { hasTenantPermission } from './access.js';
import {
  loadWeeklyAttendanceExpectations,
  loadWeeklyAttendanceShifts,
} from './attendance-report-query.js';
import {
  attendanceEventsFromShifts,
  buildAttendanceExpectationPeriodProjection,
  buildAttendancePeriodProjection,
  mergeAttendanceExpectationProjection,
  mergeAttendanceReportProjection,
} from './attendance-reporting.js';
import { getAppStateSnapshot, getOperationalMessages } from './db.js';
import { FIRST_VALUE_REPORT_ACTION } from './first-value-onboarding.js';
import {
  MEDICAL_EVIDENCE_PERMISSION,
  SOURCE_EVIDENCE_PERMISSION,
  sanitizeProjectStateMedicalData,
} from './medical-privacy.js';
import { getPrisma } from './prisma.js';
import { reserveWeeklyReportRateLimit } from './report-rate-limit.js';
import {
  buildWeeklyReportModel,
  weeklyReportPeriodStart,
  weeklyReportWorkDateRange,
} from './reporting.js';

export async function reserveWeeklyReportGeneration(access, {
  now = new Date(),
  prisma = getPrisma(),
} = {}) {
  await prisma.$transaction(async (transaction) => {
    await reserveWeeklyReportRateLimit(transaction, {
      organizationId: access.organization.id,
      actorId: access.databaseUserId || null,
      projectId: access.project.id,
      now,
    });
  }, { isolationLevel: 'ReadCommitted' });
}

export async function loadWeeklyReportModel(access, {
  generatedAt = new Date(),
  prisma = getPrisma(),
} = {}) {
  const parsedGeneratedAt = generatedAt instanceof Date
    ? new Date(generatedAt)
    : new Date(generatedAt);
  const safeGeneratedAt = Number.isNaN(parsedGeneratedAt.getTime())
    ? new Date()
    : parsedGeneratedAt;
  const includeMedicalEvidence = hasTenantPermission(
    access,
    MEDICAL_EVIDENCE_PERMISSION,
  );
  const includeSourceEvidence = hasTenantPermission(
    access,
    SOURCE_EVIDENCE_PERMISSION,
  );

  const reportTimeZone = access.organization.timezone
    || 'America/Argentina/Buenos_Aires';
  const periodStart = weeklyReportPeriodStart(safeGeneratedAt, reportTimeZone);
  const workDateRange = weeklyReportWorkDateRange(safeGeneratedAt, reportTimeZone);
  const [snapshot, loadedMessages, loadedShifts, loadedExpectations] = await Promise.all([
    getAppStateSnapshot(access, { initializeIfMissing: false }),
    getOperationalMessages(access, {
      includeMedicalEvidence,
      includeSourceEvidence,
      sentAtGte: periodStart,
      sentAtLte: safeGeneratedAt,
      take: 501,
    }),
    loadWeeklyAttendanceShifts(prisma, {
      projectId: access.project.id,
      workDateRange,
      generatedAt: safeGeneratedAt,
    }),
    loadWeeklyAttendanceExpectations(prisma, {
      projectId: access.project.id,
      workDateRange,
      generatedAt: safeGeneratedAt,
    }),
  ]);
  const loadedAttendance = attendanceEventsFromShifts(loadedShifts);

  const evidenceTruncated = loadedMessages.length > 500;
  const messages = evidenceTruncated ? loadedMessages.slice(-500) : loadedMessages;

  const evidenceSummary = messages.reduce((summary, message) => {
    const kind = String(message?.kind || '').toLowerCase();
    const hasEvidence = Boolean(
      message?.mediaUrl
      || message?.media
      || ['image', 'video', 'document', 'audio'].includes(kind),
    );
    const isAudio = kind === 'audio' || Boolean(message?.transcription);
    const isOperational = kind !== 'system' && (
      message?.sender === 'user'
      || hasEvidence
      || ['location'].includes(kind)
    );
    if (hasEvidence) summary.evidenceCount += 1;
    if (isAudio) summary.audioCount += 1;
    if (isOperational) summary.operationalMessageCount += 1;
    return summary;
  }, {
    evidenceCount: 0,
    audioCount: 0,
    operationalMessageCount: 0,
    truncated: evidenceTruncated,
    messageLimit: 500,
  });

  const physicalAttendance = buildAttendancePeriodProjection(loadedAttendance, {
    timeZone: reportTimeZone,
  });
  const expectedAttendance = buildAttendanceExpectationPeriodProjection(
    loadedExpectations,
    { generatedAt: safeGeneratedAt, timeZone: reportTimeZone },
  );
  const attendance = mergeAttendanceExpectationProjection(
    physicalAttendance,
    expectedAttendance,
  );
  const sanitizedState = sanitizeProjectStateMedicalData(snapshot.state) || {};
  const reportState = {
    ...sanitizedState,
    attendance: mergeAttendanceReportProjection({
      canonical: attendance,
      attendance: sanitizedState.attendance,
      hrAttendance: sanitizedState.hrAttendance,
    }),
  };

  return buildWeeklyReportModel({
    state: reportState,
    evidenceSummary,
    organization: access.organization,
    project: access.project,
    actorEmail: access.email,
    generatedAt: safeGeneratedAt,
    timeZone: reportTimeZone,
    snapshot: snapshot.exists ? snapshot : null,
  });
}

export async function recordWeeklyReportGeneration(access, report, {
  format,
  byteLength = null,
  sha256 = null,
} = {}) {
  const normalizedFormat = format === 'pdf' ? 'pdf' : 'web';
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
        generatedAt: report.generatedAt.toISOString(),
        emptyState: report.isEmptyState,
        format: normalizedFormat,
        ...(Number.isSafeInteger(byteLength) && byteLength > 0
          ? { byteLength }
          : {}),
        ...(/^[a-f0-9]{64}$/.test(String(sha256 || '')) ? { sha256 } : {}),
      },
    },
  });
}
