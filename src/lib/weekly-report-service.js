import 'server-only';

import { hasTenantPermission } from './access.js';
import { getAppStateSnapshot, getMessages } from './db.js';
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

export async function loadWeeklyReportModel(access, { generatedAt = new Date() } = {}) {
  const includeMedicalEvidence = hasTenantPermission(
    access,
    MEDICAL_EVIDENCE_PERMISSION,
  );
  const includeSourceEvidence = hasTenantPermission(
    access,
    SOURCE_EVIDENCE_PERMISSION,
  );

  const [snapshot, loadedMessages] = await Promise.all([
    getAppStateSnapshot(access, { initializeIfMissing: false }),
    getMessages(access, {
      includeMedicalEvidence,
      includeSourceEvidence,
      initializeIfEmpty: false,
      sentAtGte: weeklyReportPeriodStart(generatedAt),
      sentAtLte: generatedAt,
      take: 501,
    }),
  ]);

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

  return buildWeeklyReportModel({
    state: sanitizeProjectStateMedicalData(snapshot.state),
    evidenceSummary,
    organization: access.organization,
    project: access.project,
    actorEmail: access.email,
    generatedAt,
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
