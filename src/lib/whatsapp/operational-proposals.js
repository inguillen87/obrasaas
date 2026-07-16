import { createHash } from 'node:crypto';

import {
  FIELD_WORKER_INTENTS,
  canFieldWorkerHandleIntent,
} from '../field-workers.js';

export const OPERATIONAL_PROPOSAL_TYPES = Object.freeze({
  TASK_PROGRESS: 'TASK_PROGRESS',
  DELAY_REPORT: 'DELAY_REPORT',
  CRITICAL_INCIDENT: 'CRITICAL_INCIDENT',
});

export const OPERATIONAL_PROPOSAL_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  APPLIED: 'APPLIED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  INVALIDATED: 'INVALIDATED',
});

export const OPERATIONAL_PROPOSAL_DECISIONS = Object.freeze({
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
});

export const OPERATIONAL_PROPOSAL_TTL_MS = 30 * 60 * 1_000;
export const OPERATIONAL_PROPOSAL_CLASSIFIER_VERSION = 'report-proposal-v1';

const CONFIRMATION_CODE_PATTERN = /^VP-[A-F0-9]{12}$/;
const MAX_SOURCE_EXTERNAL_ID_LENGTH = 512;
const MAX_SUMMARY_LENGTH = 280;
const MAX_TASK_REFERENCE_LENGTH = 128;
const SUPERVISOR_ROLES = new Set(['FOREMAN', 'SITE_MANAGER']);
const SAFETY_APPROVER_ROLES = new Set(['FOREMAN', 'SITE_MANAGER', 'SAFETY']);

export class OperationalProposalError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'OperationalProposalError';
    this.code = code;
  }
}

function cleanText(value, limit) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function normalize(value) {
  return cleanText(value, 512)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function boundedArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 48))
    .filter(Boolean)
    .slice(0, 6);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonical(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeCode(value) {
  const code = normalize(value);
  return CONFIRMATION_CODE_PATTERN.test(code) ? code : null;
}

function decisionTaskReference(value) {
  const reference = cleanText(value, MAX_TASK_REFERENCE_LENGTH);
  if (!reference) return null;
  const normalized = normalize(reference);
  return /^(TAREA|TASK|ACTIVIDAD|ITEM|HITO|FRENTE)\b/.test(normalized)
    ? reference
    : null;
}

function decisionTaskSelection(value) {
  const selection = cleanText(value, MAX_TASK_REFERENCE_LENGTH);
  if (!selection) {
    return { taskReference: null, taskExpectedProgress: null };
  }
  const match = /^(.*?)(?:\s+DESDE\s+(\d{1,3})(?:\s*%|\s+POR\s+CIENTO)?)?$/i.exec(selection);
  if (!match) return null;
  const taskReference = decisionTaskReference(match[1]);
  if (!taskReference) return null;
  const taskExpectedProgress = match[2] == null ? null : Number(match[2]);
  if (
    taskExpectedProgress !== null
    && (
      !Number.isSafeInteger(taskExpectedProgress)
      || taskExpectedProgress < 0
      || taskExpectedProgress > 100
    )
  ) {
    return null;
  }
  return { taskReference, taskExpectedProgress };
}

function normalizeTaskAction(action = {}) {
  const percentage = Number(action.percentage);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new OperationalProposalError(
      'Task progress proposals require a bounded percentage.',
      'OPERATIONAL_PROPOSAL_ACTION_INVALID',
    );
  }
  return {
    version: 1,
    percentage,
    taskKey: cleanText(action.taskKey, MAX_TASK_REFERENCE_LENGTH) || null,
    taskName: cleanText(action.taskName, MAX_TASK_REFERENCE_LENGTH) || null,
    taskReference: cleanText(action.taskReference, MAX_TASK_REFERENCE_LENGTH) || null,
  };
}

function normalizeIncidentAction(action = {}) {
  return {
    version: 1,
    riskSignals: boundedArray(action.riskSignals),
    delaySignals: boundedArray(action.delaySignals),
  };
}

function normalizeAction(type, action) {
  if (type === OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS) {
    return normalizeTaskAction(action);
  }
  if (
    type === OPERATIONAL_PROPOSAL_TYPES.DELAY_REPORT
    || type === OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT
  ) {
    return normalizeIncidentAction(action);
  }
  throw new OperationalProposalError(
    'The report is not an actionable operational proposal.',
    'OPERATIONAL_PROPOSAL_TYPE_INVALID',
  );
}

function normalizePrecondition(type, precondition) {
  if (type !== OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS || !precondition) return null;
  const taskProgress = Number(precondition.taskProgress);
  if (!Number.isFinite(taskProgress) || taskProgress < 0 || taskProgress > 100) return null;
  return {
    version: 1,
    taskKey: cleanText(precondition.taskKey, MAX_TASK_REFERENCE_LENGTH) || null,
    taskName: cleanText(precondition.taskName, MAX_TASK_REFERENCE_LENGTH) || null,
    taskProgress,
  };
}

function auditMetadata(record, extra = {}) {
  return {
    projectId: record.projectId,
    proposalType: record.type,
    confirmationCode: record.confirmationCode,
    proposedByWorkerId: record.proposedByWorkerId,
    sourceProvider: record.sourceProvider,
    sourceExternalId: record.sourceExternalId,
    ...extra,
  };
}

async function createProposalAudit(prisma, {
  organizationId,
  action,
  record,
  actorId = null,
  auditSource = null,
  metadata = {},
}) {
  const trustedActorId = cleanText(actorId, 256) || null;
  const trustedAuditSource = cleanText(auditSource, 64).toLowerCase() || null;
  await prisma.auditLog.create({
    data: {
      organizationId,
      ...(trustedActorId ? { actorId: trustedActorId } : {}),
      action,
      entityType: 'OperationalProposal',
      entityId: record.id,
      metadata: auditMetadata(record, {
        ...metadata,
        ...(trustedActorId ? { initiatedByPlatformUserId: trustedActorId } : {}),
        ...(trustedAuditSource
          ? {
              auditSource: trustedAuditSource,
              simulated: trustedAuditSource === 'dashboard-simulator',
            }
          : {}),
      }),
    },
  });
}

export function operationalProposalCode({ projectId, sourceProvider = 'whatsapp', sourceExternalId }) {
  const project = cleanText(projectId, 256);
  const provider = cleanText(sourceProvider, 32).toLowerCase();
  const source = cleanText(sourceExternalId, MAX_SOURCE_EXTERNAL_ID_LENGTH);
  if (!project || !provider || !source) {
    throw new OperationalProposalError(
      'Project and source event are required for a proposal code.',
      'OPERATIONAL_PROPOSAL_SOURCE_REQUIRED',
    );
  }
  const digest = createHash('sha256')
    .update(`obrasaas-operational-proposal-v1\0${project}\0${provider}\0${source}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  return `VP-${digest}`;
}

export function parseOperationalProposalDecision(input) {
  // Flow decisions stay disabled until a signed, expiring flow_token is bound
  // to the exact proposal and worker. A client-supplied flow_type/code alone is
  // not an authorization mechanism.
  if (input && typeof input === 'object' && input.interactive?.type === 'flow') return null;
  if (
    input
    && typeof input === 'object'
    && input.kind
    && input.kind !== 'text'
  ) {
    return null;
  }

  const source = typeof input === 'string'
    ? input
    : String(input?.text || '');
  const normalized = normalize(source);
  const match = /^(CONFIRMAR|APROBAR|RECHAZAR)\s+(VP-[A-F0-9]{12})(?:\s+(.+))?$/.exec(normalized);
  if (!match) return null;
  const taskSelection = decisionTaskSelection(match[3]);
  if (!taskSelection || (match[3] && match[1] === 'RECHAZAR')) return null;
  return {
    decision: match[1] === 'RECHAZAR'
      ? OPERATIONAL_PROPOSAL_DECISIONS.REJECT
      : OPERATIONAL_PROPOSAL_DECISIONS.APPROVE,
    confirmationCode: match[2],
    ...taskSelection,
    channel: 'whatsapp-text',
  };
}

export function operationalProposalIntent(type) {
  if (type === OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS) {
    return FIELD_WORKER_INTENTS.TASK_PROGRESS;
  }
  if (type === OPERATIONAL_PROPOSAL_TYPES.DELAY_REPORT) {
    return FIELD_WORKER_INTENTS.DELAY_REPORT;
  }
  if (type === OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT) {
    return FIELD_WORKER_INTENTS.INCIDENT;
  }
  return null;
}

export function canResolveOperationalProposal(worker, proposal, decision) {
  const role = worker?.whatsappRole || 'WORKER';
  const isProposer = worker?.id && worker.id === proposal?.proposedByWorkerId;
  if (decision === OPERATIONAL_PROPOSAL_DECISIONS.REJECT && isProposer) return true;

  const targetIntent = operationalProposalIntent(proposal?.type);
  if (!targetIntent || !canFieldWorkerHandleIntent(role, targetIntent)) return false;
  if (proposal.type === OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT) {
    return isProposer || SAFETY_APPROVER_ROLES.has(role);
  }
  return SUPERVISOR_ROLES.has(role);
}

export async function createOperationalProposal(prisma, {
  projectId,
  organizationId,
  proposedByWorkerId,
  sourceProvider = 'whatsapp',
  sourceExternalId,
  type,
  summary,
  transcript,
  action,
  precondition = null,
  now = new Date(),
  auditActorId = null,
  auditSource = null,
}) {
  const project = cleanText(projectId, 256);
  const organization = cleanText(organizationId, 256);
  const workerId = cleanText(proposedByWorkerId, 256);
  const provider = cleanText(sourceProvider, 32).toLowerCase();
  const source = cleanText(sourceExternalId, MAX_SOURCE_EXTERNAL_ID_LENGTH);
  if (!project || !organization || !workerId || !provider || !source) {
    throw new OperationalProposalError(
      'A trusted project, organization, worker and source event are required.',
      'OPERATIONAL_PROPOSAL_SCOPE_REQUIRED',
    );
  }
  const normalizedAction = normalizeAction(type, action);
  const normalizedPrecondition = normalizePrecondition(type, precondition);
  const normalizedSummary = cleanText(summary, MAX_SUMMARY_LENGTH);
  const transcriptSha256 = createHash('sha256')
    .update(String(transcript ?? summary ?? ''))
    .digest('hex');
  const confirmationCode = operationalProposalCode({
    projectId: project,
    sourceProvider: provider,
    sourceExternalId: source,
  });

  const existing = await prisma.operationalProposal.findUnique({
    where: {
      projectId_sourceProvider_sourceExternalId: {
        projectId: project,
        sourceProvider: provider,
        sourceExternalId: source,
      },
    },
  });
  if (existing) {
    const sameProposal = existing.proposedByWorkerId === workerId
      && existing.type === type
      && existing.summary === normalizedSummary
      && existing.classifierVersion === OPERATIONAL_PROPOSAL_CLASSIFIER_VERSION
      && existing.transcriptSha256 === transcriptSha256
      && canonical(existing.action) === canonical(normalizedAction)
      && canonical(existing.precondition) === canonical(normalizedPrecondition);
    if (!sameProposal) {
      throw new OperationalProposalError(
        'The source event already belongs to a different operational proposal.',
        'OPERATIONAL_PROPOSAL_SOURCE_CONFLICT',
      );
    }
    return { created: false, record: existing };
  }

  const expiresAt = new Date(now.getTime() + OPERATIONAL_PROPOSAL_TTL_MS);
  const record = await prisma.operationalProposal.create({
    data: {
      projectId: project,
      proposedByWorkerId: workerId,
      sourceProvider: provider,
      sourceExternalId: source,
      confirmationCode,
      type,
      summary: normalizedSummary,
      action: normalizedAction,
      ...(normalizedPrecondition ? { precondition: normalizedPrecondition } : {}),
      classifierVersion: OPERATIONAL_PROPOSAL_CLASSIFIER_VERSION,
      transcriptSha256,
      expiresAt,
    },
  });
  await createProposalAudit(prisma, {
    organizationId: organization,
    action: 'voice.proposal.created',
    record,
    actorId: auditActorId,
    auditSource,
    metadata: { expiresAt: expiresAt.toISOString() },
  });
  return { created: true, record };
}

export async function findOperationalProposal(prisma, {
  projectId,
  confirmationCode,
}) {
  const project = cleanText(projectId, 256);
  const code = normalizeCode(confirmationCode);
  if (!project || !code) return null;
  return prisma.operationalProposal.findUnique({
    where: {
      projectId_confirmationCode: {
        projectId: project,
        confirmationCode: code,
      },
    },
    include: {
      proposedByWorker: {
        select: { name: true },
      },
    },
  });
}

async function transitionOperationalProposal(prisma, {
  proposal,
  projectId,
  organizationId,
  status,
  auditAction,
  resolverWorkerId = null,
  resolverProvider = null,
  resolverExternalId = null,
  auditActorId = null,
  auditSource = null,
  result = null,
  now = new Date(),
  expiry = 'future',
}) {
  const where = {
    id: proposal.id,
    projectId,
    status: OPERATIONAL_PROPOSAL_STATUSES.PENDING,
  };
  if (expiry === 'future') where.expiresAt = { gt: now };
  if (expiry === 'elapsed') where.expiresAt = { lte: now };

  const updated = await prisma.operationalProposal.updateMany({
    where,
    data: {
      status,
      resolvedByWorkerId: resolverWorkerId,
      resolverProvider,
      resolverExternalId,
      resolvedAt: now,
      ...(result === null ? {} : { result }),
    },
  });
  if (updated.count !== 1) return false;

  await createProposalAudit(prisma, {
    organizationId,
    action: auditAction,
    record: proposal,
    actorId: auditActorId,
    auditSource,
    metadata: {
      resolvedByWorkerId: resolverWorkerId,
      resolverProvider,
      resolverExternalId,
      result,
    },
  });
  return true;
}

export function markOperationalProposalExpired(prisma, options) {
  return transitionOperationalProposal(prisma, {
    ...options,
    status: OPERATIONAL_PROPOSAL_STATUSES.EXPIRED,
    auditAction: 'voice.proposal.expired',
    expiry: 'elapsed',
  });
}

export function invalidateOperationalProposal(prisma, options) {
  return transitionOperationalProposal(prisma, {
    ...options,
    status: OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED,
    auditAction: 'voice.proposal.invalidated',
  });
}

export function finalizeOperationalProposal(prisma, {
  decision,
  ...options
}) {
  const approved = decision === OPERATIONAL_PROPOSAL_DECISIONS.APPROVE;
  return transitionOperationalProposal(prisma, {
    ...options,
    status: approved
      ? OPERATIONAL_PROPOSAL_STATUSES.APPLIED
      : OPERATIONAL_PROPOSAL_STATUSES.REJECTED,
    auditAction: approved ? 'voice.proposal.applied' : 'voice.proposal.rejected',
  });
}
