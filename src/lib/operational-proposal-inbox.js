import { createHash } from 'node:crypto';

import { isSensitiveMedicalText } from './medical-privacy.js';
import {
  ensureOperationalStateCollections,
} from './operational-state-effects.js';
import {
  resolveOperationalProposalDecision,
} from './operational-proposal-resolution.js';
import {
  ProjectWritePolicyError,
  runOperationalProjectMutation,
} from './project-write-policy.js';
import {
  CANONICAL_OPERATIONAL_TASK_SOURCE,
  OPERATIONAL_TASK_AUTHORITIES,
  canonicalFirstTaskRows,
  findCanonicalOperationalTaskRow,
  listCanonicalOperationalTaskRows,
} from './operational-task-authority.js';
import {
  validateProjectStateInput,
} from './project-state.js';
import { synchronizeProjectTaskProjection } from './project-tasks.js';
import {
  OPERATIONAL_PROPOSAL_DECISIONS,
  OPERATIONAL_PROPOSAL_STATUSES,
  OPERATIONAL_PROPOSAL_TYPES,
  finalizeOperationalProposal,
  invalidateOperationalProposal,
  markOperationalProposalExpired,
} from './whatsapp/operational-proposals.js';

export const OPERATIONAL_PROPOSAL_READ_PERMISSION = 'org:operational-proposals:read';
export const OPERATIONAL_PROPOSAL_MANAGE_PERMISSION = 'org:operational-proposals:manage';

const DASHBOARD_AUDIT_SOURCE = 'dashboard-approval-inbox';
const DASHBOARD_DECISION_ACTION = 'operational.proposal.dashboard_decision';
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const MAX_LIST_OFFSET = 5_000;
const DEFAULT_EXPIRY_SWEEP_LIMIT = 50;
const MAX_EXPIRY_SWEEP_LIMIT = 100;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const MAX_TASK_ID_LENGTH = 128;
const VIEW_FILTERS = new Set(['pending', 'history', 'all']);
const TYPE_FILTERS = new Set(Object.values(OPERATIONAL_PROPOSAL_TYPES));
const DURABLE_RESOLUTION_OUTCOMES = new Set([
  'APPLIED',
  'REJECTED',
  'EXPIRED',
  'INVALIDATED',
]);
const REDACTED_CRITICAL_SUMMARY = 'Incidencia crítica registrada. El detalle sensible está restringido para este rol.';
const REDACTED_MEDICAL_SUMMARY = 'Reporte operativo recibido. El detalle médico está restringido para este rol.';
const REDACTED_VOICE_SUMMARY = 'Reporte de voz recibido. El contenido original está restringido; revisá el efecto estructurado antes de decidir.';

export class OperationalProposalInboxError extends Error {
  constructor(message, {
    code = 'OPERATIONAL_PROPOSAL_INBOX_ERROR',
    status = 400,
    details = {},
  } = {}) {
    super(message);
    this.name = 'OperationalProposalInboxError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function jsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanText(value, limit) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function containsSensitiveMedicalContent(value, seen = new Set()) {
  if (typeof value === 'string') {
    return isSensitiveMedicalText(value)
      || isSensitiveMedicalText(value.replace(/[-_./]+/g, ' '));
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((nested) => (
    containsSensitiveMedicalContent(nested, seen)
  ));
}

function exactTaskId(value) {
  if (value === null || value === undefined) return null;
  const taskId = String(value);
  if (
    !taskId
    || taskId.length > MAX_TASK_ID_LENGTH
    || taskId !== taskId.trim()
    || /[\u0000-\u001f\u007f]/.test(taskId)
  ) {
    return null;
  }
  return taskId;
}

function safeDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateIso(value) {
  return safeDate(value)?.toISOString() || null;
}

function boundedProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function parseBoundedInteger(value, {
  field,
  fallback,
  min,
  max,
}) {
  if (value == null || value === '') return fallback;
  if (!/^\d+$/.test(String(value).trim())) {
    throw new OperationalProposalInboxError(
      `El filtro ${field} no es válido.`,
      { code: 'INVALID_PROPOSAL_FILTER' },
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new OperationalProposalInboxError(
      `El filtro ${field} debe estar entre ${min} y ${max}.`,
      { code: 'INVALID_PROPOSAL_FILTER' },
    );
  }
  return parsed;
}

function singleSearchParam(searchParams, field) {
  const values = searchParams.getAll(field);
  if (values.length > 1) {
    throw new OperationalProposalInboxError(
      `El filtro ${field} no puede repetirse.`,
      { code: 'INVALID_PROPOSAL_FILTER' },
    );
  }
  return values[0] ?? null;
}

export function parseOperationalProposalFilters(searchParams) {
  const supported = new Set(['view', 'type', 'limit', 'offset']);
  for (const field of searchParams.keys()) {
    if (!supported.has(field)) {
      throw new OperationalProposalInboxError(
        `El filtro ${field} no está permitido.`,
        { code: 'INVALID_PROPOSAL_FILTER' },
      );
    }
  }

  const view = cleanText(singleSearchParam(searchParams, 'view') || 'pending', 20)
    .toLowerCase();
  if (!VIEW_FILTERS.has(view)) {
    throw new OperationalProposalInboxError(
      'El filtro view debe ser pending, history o all.',
      { code: 'INVALID_PROPOSAL_FILTER' },
    );
  }
  const rawType = cleanText(singleSearchParam(searchParams, 'type'), 64).toUpperCase();
  if (rawType && !TYPE_FILTERS.has(rawType)) {
    throw new OperationalProposalInboxError(
      'El tipo de propuesta no es válido.',
      { code: 'INVALID_PROPOSAL_FILTER' },
    );
  }

  return {
    view,
    type: rawType || null,
    limit: parseBoundedInteger(singleSearchParam(searchParams, 'limit'), {
      field: 'limit',
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    }),
    offset: parseBoundedInteger(singleSearchParam(searchParams, 'offset'), {
      field: 'offset',
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    }),
  };
}

export function effectiveOperationalProposalStatus(proposal, now = new Date()) {
  if (
    proposal?.status === OPERATIONAL_PROPOSAL_STATUSES.PENDING
    && safeDate(proposal.expiresAt)?.getTime() <= now.getTime()
  ) {
    return OPERATIONAL_PROPOSAL_STATUSES.EXPIRED;
  }
  return proposal?.status || null;
}

function serializeTaskChange(proposal) {
  if (proposal.type !== OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS) return null;
  const action = jsonObject(proposal.action);
  const result = jsonObject(proposal.result);
  return {
    percentage: boundedProgress(action.percentage),
    taskId: exactTaskId(action.taskKey) || exactTaskId(result.taskKey),
    taskName: cleanText(action.taskName || result.taskName, 160) || null,
    taskReference: cleanText(action.taskReference, 160) || null,
    currentProgress: null,
  };
}

function serializeTaskPrecondition(proposal) {
  if (proposal.type !== OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS) return null;
  const precondition = jsonObject(proposal.precondition);
  if (Object.keys(precondition).length === 0) return null;
  return {
    taskId: exactTaskId(precondition.taskKey),
    taskName: cleanText(precondition.taskName, 160) || null,
    progress: boundedProgress(precondition.taskProgress),
  };
}

function serializeProposalResult(proposal) {
  const result = jsonObject(proposal.result);
  if (Object.keys(result).length === 0) return null;
  if (proposal.type === OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS) {
    return {
      taskId: exactTaskId(result.taskKey),
      taskName: cleanText(result.taskName, 160) || null,
      previousProgress: boundedProgress(result.previousProgress),
      nextProgress: boundedProgress(result.nextProgress),
    };
  }
  return {
    effect: cleanText(result.effect, 64) || null,
    severity: cleanText(result.severity, 32) || null,
  };
}

export function serializeOperationalProposal(proposal, {
  includeSensitiveDetails = false,
  now = new Date(),
} = {}) {
  const status = effectiveOperationalProposalStatus(proposal, now);
  const taskChange = serializeTaskChange(proposal);
  const critical = proposal.type === OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT;
  const sensitive = critical || containsSensitiveMedicalContent({
    summary: proposal.summary,
    action: proposal.action,
    precondition: proposal.precondition,
    result: proposal.result,
  });
  const detailRestricted = sensitive && !includeSensitiveDetails;
  const summaryRestricted = !includeSensitiveDetails;
  const taskPrecondition = serializeTaskPrecondition(proposal);
  const proposalResult = serializeProposalResult(proposal);
  const change = detailRestricted && taskChange
    ? {
        ...taskChange,
        taskId: null,
        taskName: null,
        taskReference: null,
      }
    : summaryRestricted && taskChange
      ? {
          ...taskChange,
          taskReference: null,
        }
      : taskChange;
  const precondition = detailRestricted && taskPrecondition
    ? {
        ...taskPrecondition,
        taskId: null,
        taskName: null,
      }
    : taskPrecondition;
  const result = detailRestricted && proposalResult
    ? {
        ...proposalResult,
        taskId: null,
        taskName: null,
      }
    : proposalResult;
  return {
    id: proposal.id,
    confirmationCode: proposal.confirmationCode,
    type: proposal.type,
    status,
    summary: summaryRestricted
      ? critical
        ? REDACTED_CRITICAL_SUMMARY
        : sensitive
          ? REDACTED_MEDICAL_SUMMARY
          : REDACTED_VOICE_SUMMARY
      : cleanText(proposal.summary, 280),
    summaryRestricted,
    detailRestricted,
    proposedBy: !detailRestricted && proposal.proposedByWorker?.name
      ? { name: cleanText(proposal.proposedByWorker.name, 160) }
      : null,
    change,
    precondition,
    result,
    requiresTaskSelection: (
      proposal.type === OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS
      && !jsonObject(proposal.action).taskKey
    ),
    expiresAt: dateIso(proposal.expiresAt),
    resolvedAt: dateIso(proposal.resolvedAt),
    createdAt: dateIso(proposal.createdAt),
  };
}

export function serializeOperationalTasks(state, {
  includeSensitiveDetails = false,
} = {}) {
  return Object.entries(jsonObject(state?.tasks))
    .slice(0, 500)
    .map(([rawId, task]) => {
      const id = exactTaskId(rawId);
      if (!id) return null;
      const name = cleanText(task?.name, 160) || `Tarea ${cleanText(id, 40)}`;
      if (
        !includeSensitiveDetails
        && containsSensitiveMedicalContent({ id, name, task })
      ) {
        return null;
      }
      return {
        id,
        name,
        progress: boundedProgress(task?.progress),
      };
    })
    .filter(Boolean)
    .sort((left, right) => (
      left.name.localeCompare(right.name, 'es')
      || left.id.localeCompare(right.id, 'es')
    ));
}

export function serializeCanonicalOperationalTasks(rows, {
  includeSensitiveDetails = false,
} = {}) {
  return (Array.isArray(rows) ? rows : [])
    .slice(0, 500)
    .map((task) => {
      const id = exactTaskId(task?.id);
      if (!id) return null;
      const name = cleanText(task?.title, 160) || `Tarea ${cleanText(id, 40)}`;
      if (
        !includeSensitiveDetails
        && containsSensitiveMedicalContent({
          id,
          name,
          description: task?.description,
          metadata: task?.metadata,
        })
      ) {
        return null;
      }
      return {
        id,
        name,
        progress: boundedProgress(task?.progress),
        revision: Number.isSafeInteger(task?.revision) && task.revision >= 0
          ? task.revision
          : null,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (
      left.name.localeCompare(right.name, 'es')
      || left.id.localeCompare(right.id, 'es')
    ));
}

function proposalWithCurrentTaskProgress(proposal, tasks) {
  if (!proposal?.change?.taskId) return proposal;
  const currentTask = tasks.find((task) => task.id === proposal.change.taskId);
  return {
    ...proposal,
    change: {
      ...proposal.change,
      currentProgress: currentTask?.progress ?? null,
    },
  };
}

function proposalScopeWhere(scope) {
  return {
    projectId: scope.projectId,
    project: { organizationId: scope.organizationId },
  };
}

function proposalViewWhere(view, now) {
  if (view === 'pending') {
    return {
      status: OPERATIONAL_PROPOSAL_STATUSES.PENDING,
      expiresAt: { gt: now },
    };
  }
  if (view === 'history') {
    return {
      OR: [
        { status: { not: OPERATIONAL_PROPOSAL_STATUSES.PENDING } },
        {
          status: OPERATIONAL_PROPOSAL_STATUSES.PENDING,
          expiresAt: { lte: now },
        },
      ],
    };
  }
  return {};
}

function statusCountWhere(scope, status, now) {
  const scoped = proposalScopeWhere(scope);
  if (status === OPERATIONAL_PROPOSAL_STATUSES.PENDING) {
    return {
      ...scoped,
      status,
      expiresAt: { gt: now },
    };
  }
  if (status === OPERATIONAL_PROPOSAL_STATUSES.EXPIRED) {
    return {
      ...scoped,
      OR: [
        { status },
        {
          status: OPERATIONAL_PROPOSAL_STATUSES.PENDING,
          expiresAt: { lte: now },
        },
      ],
    };
  }
  return { ...scoped, status };
}

export async function countPendingOperationalProposals(
  prisma,
  scope,
  { now = new Date() } = {},
) {
  return prisma.operationalProposal.count({
    where: statusCountWhere(
      scope,
      OPERATIONAL_PROPOSAL_STATUSES.PENDING,
      now,
    ),
  });
}

export async function sweepExpiredOperationalProposals(prisma, scope, {
  now = new Date(),
  limit = DEFAULT_EXPIRY_SWEEP_LIMIT,
} = {}) {
  const boundedLimit = Math.max(
    1,
    Math.min(MAX_EXPIRY_SWEEP_LIMIT, Math.trunc(Number(limit) || DEFAULT_EXPIRY_SWEEP_LIMIT)),
  );
  try {
    const expiredCount = await runOperationalProjectMutation(
      prisma,
      scope,
      async (transaction) => {
        const expired = await transaction.operationalProposal.findMany({
          where: {
            projectId: scope.projectId,
            status: OPERATIONAL_PROPOSAL_STATUSES.PENDING,
            expiresAt: { lte: now },
          },
          orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
          take: boundedLimit,
        });
        let transitioned = 0;
        for (const proposal of expired) {
          const applied = await markOperationalProposalExpired(transaction, {
            proposal,
            projectId: scope.projectId,
            organizationId: scope.organizationId,
            resolverWorkerId: null,
            resolverProvider: 'dashboard',
            resolverExternalId: `expiry:${proposal.id}`,
            auditActorId: null,
            auditSource: `${DASHBOARD_AUDIT_SOURCE}-expiry`,
            result: { reason: 'dashboard_inbox_expiry_sweep' },
            now,
          });
          if (applied) transitioned += 1;
        }
        return transitioned;
      },
    );
    return { expiredCount, skippedReadOnly: false };
  } catch (error) {
    if (
      error instanceof ProjectWritePolicyError
      && error.code === 'PROJECT_READ_ONLY'
    ) {
      return { expiredCount: 0, skippedReadOnly: true };
    }
    throw error;
  }
}

export async function listOperationalProposalInbox(prisma, scope, {
  filters,
  includeSensitiveDetails = false,
  now = new Date(),
} = {}) {
  const resolvedFilters = filters || {
    view: 'pending',
    type: null,
    limit: DEFAULT_LIST_LIMIT,
    offset: 0,
  };
  const where = {
    ...proposalScopeWhere(scope),
    ...proposalViewWhere(resolvedFilters.view, now),
    ...(resolvedFilters.type ? { type: resolvedFilters.type } : {}),
  };
  const proposalSelect = {
    id: true,
    confirmationCode: true,
    type: true,
    status: true,
    summary: true,
    action: true,
    precondition: true,
    result: true,
    expiresAt: true,
    resolvedAt: true,
    createdAt: true,
    proposedByWorker: { select: { name: true } },
  };
  const statuses = Object.values(OPERATIONAL_PROPOSAL_STATUSES);
  const [
    proposals,
    total,
    snapshot,
    canonicalTaskRows,
    ...statusCounts
  ] = await Promise.all([
    prisma.operationalProposal.findMany({
      where,
      select: proposalSelect,
      orderBy: resolvedFilters.view === 'pending'
        ? [{ expiresAt: 'asc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: resolvedFilters.offset,
      take: resolvedFilters.limit,
    }),
    prisma.operationalProposal.count({ where }),
    prisma.projectSnapshot.findUnique({
      where: { projectId: scope.projectId },
      select: { state: true, version: true, updatedAt: true },
    }),
    listCanonicalOperationalTaskRows(prisma, scope),
    ...statuses.map((status) => prisma.operationalProposal.count({
      where: statusCountWhere(scope, status, now),
    })),
  ]);

  const metrics = Object.fromEntries(
    statuses.map((status, index) => [status.toLowerCase(), statusCounts[index]]),
  );
  const legacyTasks = serializeOperationalTasks(snapshot?.state, {
    includeSensitiveDetails,
  });
  const canonicalTasks = serializeCanonicalOperationalTasks(canonicalTaskRows, {
    includeSensitiveDetails,
  });
  const taskAuthority = canonicalFirstTaskRows({
    canonicalRows: canonicalTaskRows,
    legacyRows: legacyTasks,
  }).authority;
  const tasks = taskAuthority === OPERATIONAL_TASK_AUTHORITIES.CANONICAL
    ? canonicalTasks
    : legacyTasks;
  return {
    proposals: proposals.map((proposal) => proposalWithCurrentTaskProgress(
      serializeOperationalProposal(proposal, {
        includeSensitiveDetails,
        now,
      }),
      tasks,
    )),
    tasks,
    taskAuthority,
    metrics,
    pagination: {
      limit: resolvedFilters.limit,
      offset: resolvedFilters.offset,
      total,
      hasMore: resolvedFilters.offset + proposals.length < total,
    },
    stateVersion: snapshot?.version ?? 0,
  };
}

export function parseOperationalProposalDecisionInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OperationalProposalInboxError(
      'La decisión debe enviarse como un objeto JSON.',
      { code: 'INVALID_DECISION' },
    );
  }
  const allowedFields = new Set([
    'decision',
    'taskId',
    'taskExpectedProgress',
    'taskExpectedRevision',
  ]);
  if (Object.keys(value).some((field) => !allowedFields.has(field))) {
    throw new OperationalProposalInboxError(
      'La decisión contiene campos no permitidos.',
      { code: 'INVALID_DECISION' },
    );
  }
  const decision = cleanText(value.decision, 16).toUpperCase();
  if (!Object.values(OPERATIONAL_PROPOSAL_DECISIONS).includes(decision)) {
    throw new OperationalProposalInboxError(
      'La decisión debe ser APPROVE o REJECT.',
      { code: 'INVALID_DECISION' },
    );
  }
  const taskId = exactTaskId(value.taskId);
  if (value.taskId != null && !taskId) {
    throw new OperationalProposalInboxError(
      'La tarea seleccionada no es válida.',
      { code: 'INVALID_TASK_SELECTION' },
    );
  }
  if (decision === OPERATIONAL_PROPOSAL_DECISIONS.REJECT && taskId) {
    throw new OperationalProposalInboxError(
      'Una decisión de rechazo no admite selección de tarea.',
      { code: 'INVALID_TASK_SELECTION' },
    );
  }
  let taskExpectedProgress = null;
  if (value.taskExpectedProgress != null) {
    const parsedProgress = Number(value.taskExpectedProgress);
    if (
      !Number.isFinite(parsedProgress)
      || parsedProgress < 0
      || parsedProgress > 100
    ) {
      throw new OperationalProposalInboxError(
        'El avance esperado de la tarea debe estar entre 0 y 100.',
        { code: 'INVALID_TASK_SELECTION' },
      );
    }
    taskExpectedProgress = parsedProgress;
  }
  if (taskId && taskExpectedProgress == null) {
    throw new OperationalProposalInboxError(
      'Confirmá también el avance actual de la tarea seleccionada.',
      { code: 'TASK_CONFIRMATION_REQUIRED', status: 422 },
    );
  }
  if (!taskId && taskExpectedProgress != null) {
    throw new OperationalProposalInboxError(
      'El avance esperado requiere una tarea seleccionada.',
      { code: 'INVALID_TASK_SELECTION' },
    );
  }
  let taskExpectedRevision = null;
  if (value.taskExpectedRevision != null) {
    const parsedRevision = Number(value.taskExpectedRevision);
    if (!Number.isSafeInteger(parsedRevision) || parsedRevision < 0) {
      throw new OperationalProposalInboxError(
        'La revision esperada de la tarea no es valida.',
        { code: 'INVALID_TASK_SELECTION' },
      );
    }
    taskExpectedRevision = parsedRevision;
  }
  if (!taskId && taskExpectedRevision != null) {
    throw new OperationalProposalInboxError(
      'La revision esperada requiere una tarea seleccionada.',
      { code: 'INVALID_TASK_SELECTION' },
    );
  }
  return {
    decision,
    taskId,
    taskExpectedProgress,
    taskExpectedRevision,
  };
}

export function normalizeOperationalProposalId(value) {
  const rawProposalId = String(value || '').trim();
  const proposalId = cleanText(rawProposalId, 256);
  if (
    !proposalId
    || rawProposalId.length > 256
    || proposalId !== rawProposalId
    || !/^[A-Za-z0-9_-]+$/.test(proposalId)
  ) {
    throw new OperationalProposalInboxError(
      'La propuesta no existe en la obra activa.',
      { code: 'OPERATIONAL_PROPOSAL_NOT_FOUND', status: 404 },
    );
  }
  return proposalId;
}

export function dashboardDecisionIdentity(scope, actorId, idempotencyKey) {
  const key = String(idempotencyKey || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new OperationalProposalInboxError(
      'La decisión requiere una clave de idempotencia válida.',
      { code: 'IDEMPOTENCY_KEY_REQUIRED' },
    );
  }
  const trustedActorId = cleanText(actorId, 256);
  if (!scope?.organizationId || !scope?.projectId || !trustedActorId) {
    throw new OperationalProposalInboxError(
      'No se pudo vincular la decisión a una identidad confiable.',
      { code: 'DASHBOARD_RESOLVER_INVALID', status: 403 },
    );
  }
  const digest = createHash('sha256')
    .update(
      `obrasaas-dashboard-proposal-decision-v1\0${scope.organizationId}\0${scope.projectId}\0${trustedActorId}\0${key}`,
    )
    .digest('hex');
  return {
    digest,
    operationId: `dashboard-proposal-decision:${digest}`,
    resolverExternalId: `dashboard-decision:${digest}`,
  };
}

function normalizedDecisionRequest(proposalId, input) {
  return {
    proposalId,
    decision: input.decision,
    taskId: input.taskId || null,
    taskExpectedProgress: input.taskExpectedProgress ?? null,
    taskExpectedRevision: input.taskExpectedRevision ?? null,
  };
}

function sameDecisionRequest(left, right) {
  return left?.proposalId === right.proposalId
    && left?.decision === right.decision
    && (left?.taskId || null) === (right.taskId || null)
    && (left?.taskExpectedProgress ?? null) === (right.taskExpectedProgress ?? null)
    && (left?.taskExpectedRevision ?? null) === (right.taskExpectedRevision ?? null);
}

function storedDecisionOutcome(operation, expected) {
  const metadata = jsonObject(operation?.metadata);
  const request = jsonObject(metadata.request);
  const outcome = jsonObject(metadata.outcome);
  const trustedOperation = operation
    && operation.organizationId === expected.organizationId
    && operation.actorId === expected.actorId
    && operation.action === DASHBOARD_DECISION_ACTION
    && operation.entityType === 'OperationalProposal'
    && metadata.projectId === expected.projectId;
  if (!trustedOperation || !sameDecisionRequest(request, expected.request)) {
    throw new OperationalProposalInboxError(
      'La clave de idempotencia ya fue utilizada para otra operación.',
      { code: 'IDEMPOTENCY_KEY_CONFLICT', status: 409 },
    );
  }
  if (
    !Number.isInteger(outcome.httpStatus)
    || !outcome.outcome
    || !outcome.message
  ) {
    throw new OperationalProposalInboxError(
      'La operación idempotente almacenada no se puede verificar.',
      { code: 'IDEMPOTENCY_KEY_CONFLICT', status: 409 },
    );
  }
  return {
    success: outcome.httpStatus < 400,
    httpStatus: outcome.httpStatus,
    code: outcome.code || null,
    outcome: outcome.outcome,
    message: outcome.message,
    stateVersion: Number.isSafeInteger(outcome.stateVersion)
      ? outcome.stateVersion
      : 0,
  };
}

function resolutionDescriptor(resolution, stateVersion) {
  const base = {
    success: false,
    httpStatus: 409,
    code: 'PROPOSAL_RACE_LOST',
    outcome: resolution.outcome,
    message: resolution.reply,
    stateVersion,
  };
  if (resolution.outcome === 'APPLIED' || resolution.outcome === 'REJECTED') {
    return {
      ...base,
      success: true,
      httpStatus: 200,
      code: null,
    };
  }
  if (resolution.outcome === 'NOT_FOUND') {
    return {
      ...base,
      httpStatus: 404,
      code: 'OPERATIONAL_PROPOSAL_NOT_FOUND',
    };
  }
  if (resolution.outcome === 'TASK_REQUIRED') {
    return {
      ...base,
      httpStatus: 422,
      code: 'TASK_REQUIRED',
    };
  }
  if (resolution.outcome === 'TASK_CONFIRMATION_REQUIRED') {
    return {
      ...base,
      httpStatus: 422,
      code: 'TASK_CONFIRMATION_REQUIRED',
    };
  }
  if (resolution.outcome === 'TASK_PRECONDITION_STALE') {
    return {
      ...base,
      code: 'TASK_PRECONDITION_STALE',
    };
  }
  if (resolution.outcome === 'EXPIRED') {
    return { ...base, code: 'PROPOSAL_EXPIRED' };
  }
  if (resolution.outcome === 'INVALIDATED') {
    return { ...base, code: 'PROPOSAL_INVALIDATED' };
  }
  if (resolution.outcome === 'ALREADY_TERMINAL') {
    return {
      ...base,
      code: resolution.proposal?.status === OPERATIONAL_PROPOSAL_STATUSES.EXPIRED
        ? 'PROPOSAL_EXPIRED'
        : resolution.proposal?.status === OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED
          ? 'PROPOSAL_INVALIDATED'
          : 'PROPOSAL_ALREADY_TERMINAL',
    };
  }
  if (resolution.outcome === 'FORBIDDEN') {
    return {
      ...base,
      httpStatus: 403,
      code: 'OPERATIONAL_PROPOSAL_RESOLUTION_FORBIDDEN',
    };
  }
  if (resolution.outcome === 'RESOLVER_IDENTITY_INVALID') {
    return {
      ...base,
      httpStatus: 403,
      code: 'DASHBOARD_RESOLVER_INVALID',
    };
  }
  return base;
}

function proposalQuery(scope, proposalId) {
  return {
    where: {
      id: proposalId,
      projectId: scope.projectId,
      project: { organizationId: scope.organizationId },
    },
    include: {
      proposedByWorker: {
        select: { name: true },
      },
    },
  };
}

function taskSelectionDescriptor(message, code = 'TASK_NOT_FOUND', status = 422) {
  return {
    success: false,
    httpStatus: status,
    code,
    outcome: (
      code === 'TASK_PRECONDITION_STALE'
      || code === 'TASK_CONFIRMATION_REQUIRED'
    )
      ? code
      : 'TASK_REQUIRED',
    message,
    stateVersion: 0,
  };
}

function canonicalTaskResolutionFailure(reply, outcome = 'TASK_REQUIRED') {
  return {
    reply,
    stateChanged: false,
    authorized: true,
    proposal: null,
    outcome,
  };
}

function canonicalTaskTransitionContext({
  proposal,
  scope,
  actorId,
  resolverExternalId,
  now,
}) {
  return {
    proposal,
    projectId: scope.projectId,
    organizationId: scope.organizationId,
    resolverWorkerId: null,
    resolverProvider: 'dashboard',
    resolverExternalId,
    auditActorId: actorId,
    auditSource: DASHBOARD_AUDIT_SOURCE,
    now,
  };
}

async function invalidateCanonicalTaskProposal(transaction, {
  proposal,
  scope,
  actorId,
  resolverExternalId,
  now,
  reason,
  taskId = null,
}) {
  const invalidated = await invalidateOperationalProposal(transaction, {
    ...canonicalTaskTransitionContext({
      proposal,
      scope,
      actorId,
      resolverExternalId,
      now,
    }),
    result: {
      reason,
      ...(taskId ? { taskId } : {}),
      taskAuthority: OPERATIONAL_TASK_AUTHORITIES.CANONICAL,
    },
  });
  return {
    reply: invalidated
      ? `La tarea canonica vinculada a ${proposal.confirmationCode} ya no coincide con la propuesta. La invalide sin modificar el Gantt.`
      : `La propuesta ${proposal.confirmationCode} cambio de estado. No modifique el Gantt.`,
    stateChanged: false,
    authorized: true,
    proposal: invalidated
      ? { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED }
      : proposal,
    outcome: invalidated ? 'INVALIDATED' : 'RACE_LOST',
  };
}

async function resolveCanonicalTaskProgressProposal(transaction, {
  proposal,
  trustedInput,
  scope,
  actorId,
  resolverExternalId,
  includeSensitiveDetails = false,
  now,
}) {
  const action = jsonObject(proposal.action);
  const precondition = jsonObject(proposal.precondition);
  const rawBoundTaskId = action.taskKey == null ? null : String(action.taskKey);
  const boundTaskId = rawBoundTaskId ? exactTaskId(rawBoundTaskId) : null;
  if (rawBoundTaskId && !boundTaskId) {
    return invalidateCanonicalTaskProposal(transaction, {
      proposal,
      scope,
      actorId,
      resolverExternalId,
      now,
      reason: 'canonical_task_identity_invalid',
    });
  }

  const taskId = boundTaskId || trustedInput.taskId;
  if (!taskId) {
    return canonicalTaskResolutionFailure(
      `La propuesta ${proposal.confirmationCode} sigue pendiente: elegi la tarea canonica exacta antes de aprobarla.`,
    );
  }
  const task = await findCanonicalOperationalTaskRow(transaction, scope, taskId);
  if (!task) {
    if (boundTaskId) {
      return invalidateCanonicalTaskProposal(transaction, {
        proposal,
        scope,
        actorId,
        resolverExternalId,
        now,
        reason: 'canonical_task_missing_after_proposal',
        taskId,
      });
    }
    return canonicalTaskResolutionFailure(
      'La tarea seleccionada ya no existe o no esta disponible para este rol.',
    );
  }
  const visibleTask = serializeCanonicalOperationalTasks([task], {
    includeSensitiveDetails,
  })[0] || null;
  if (!visibleTask) {
    return canonicalTaskResolutionFailure(
      'La tarea vinculada no esta disponible para este rol. La propuesta sigue pendiente para que la revise una persona autorizada.',
    );
  }

  const currentProgress = boundedProgress(task.progress);
  const currentRevision = Number.isSafeInteger(task.revision) && task.revision >= 0
    ? task.revision
    : null;
  if (boundTaskId) {
    const preconditionRevision = Number(precondition.taskRevision);
    const boundPreconditionIsStale = (
      Object.keys(precondition).length === 0
      || Number(precondition.taskProgress) !== currentProgress
      || !Number.isSafeInteger(preconditionRevision)
      || preconditionRevision < 0
      || preconditionRevision !== currentRevision
      || (
        precondition.taskName
        && String(precondition.taskName) !== String(task.title || '')
      )
    );
    if (boundPreconditionIsStale || currentRevision == null) {
      return invalidateCanonicalTaskProposal(transaction, {
        proposal,
        scope,
        actorId,
        resolverExternalId,
        now,
        reason: 'canonical_task_changed_after_proposal',
        taskId,
      });
    }
  } else if (trustedInput.taskExpectedRevision == null) {
    return canonicalTaskResolutionFailure(
      'Confirma tambien la revision actual de la tarea canonica.',
      'TASK_CONFIRMATION_REQUIRED',
    );
  } else if (
    trustedInput.taskExpectedProgress !== currentProgress
    || trustedInput.taskExpectedRevision !== currentRevision
  ) {
    return canonicalTaskResolutionFailure(
      'La tarea canonica cambio desde que abriste la confirmacion. Recarga la bandeja.',
      'TASK_PRECONDITION_STALE',
    );
  }

  const percentage = Number(action.percentage);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return invalidateCanonicalTaskProposal(transaction, {
      proposal,
      scope,
      actorId,
      resolverExternalId,
      now,
      reason: 'invalid_stored_percentage',
      taskId,
    });
  }

  let nextRevision = currentRevision;
  if (percentage !== currentProgress) {
    const updated = await transaction.task.updateMany({
      where: {
        id: taskId,
        projectId: scope.projectId,
        revision: currentRevision,
        progress: currentProgress,
        metadata: {
          path: ['source'],
          equals: CANONICAL_OPERATIONAL_TASK_SOURCE,
        },
      },
      data: {
        progress: percentage,
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      return canonicalTaskResolutionFailure(
        'La tarea canonica cambio antes de aplicar la decision. Recarga la bandeja.',
        'TASK_PRECONDITION_STALE',
      );
    }
    nextRevision += 1;
    await transaction.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        actorId,
        action: 'task.progress.approved',
        entityType: 'Task',
        entityId: taskId,
        metadata: {
          projectId: scope.projectId,
          proposalId: proposal.id,
          auditSource: DASHBOARD_AUDIT_SOURCE,
          previousProgress: currentProgress,
          nextProgress: percentage,
          previousRevision: currentRevision,
          nextRevision,
          taskAuthority: OPERATIONAL_TASK_AUTHORITIES.CANONICAL,
        },
      },
    });
  }

  const result = {
    taskKey: taskId,
    taskName: String(task.title || ''),
    previousProgress: currentProgress,
    nextProgress: percentage,
    taskRevision: nextRevision,
    taskAuthority: OPERATIONAL_TASK_AUTHORITIES.CANONICAL,
  };
  const applied = await finalizeOperationalProposal(transaction, {
    ...canonicalTaskTransitionContext({
      proposal,
      scope,
      actorId,
      resolverExternalId,
      now,
    }),
    decision: OPERATIONAL_PROPOSAL_DECISIONS.APPROVE,
    result,
  });
  if (!applied) {
    throw new OperationalProposalInboxError(
      `La propuesta ${proposal.confirmationCode} cambio de estado antes de aplicarse. No repeti ningun cambio.`,
      {
        code: 'PROPOSAL_RACE_LOST',
        status: 409,
        details: { outcome: 'RACE_LOST' },
      },
    );
  }
  return {
    reply: `Aplique la propuesta ${proposal.confirmationCode}: "${task.title}" paso de ${currentProgress}% a ${percentage}%.`,
    stateChanged: percentage !== currentProgress,
    authorized: true,
    proposal: {
      ...proposal,
      status: OPERATIONAL_PROPOSAL_STATUSES.APPLIED,
      result,
    },
    outcome: 'APPLIED',
  };
}

async function storeDashboardDecisionOperation(transaction, {
  identity,
  scope,
  actorId,
  proposal,
  request,
  descriptor,
}) {
  await transaction.auditLog.create({
    data: {
      id: identity.operationId,
      organizationId: scope.organizationId,
      actorId,
      action: DASHBOARD_DECISION_ACTION,
      entityType: 'OperationalProposal',
      entityId: proposal.id,
      metadata: {
        projectId: scope.projectId,
        auditSource: DASHBOARD_AUDIT_SOURCE,
        provider: 'dashboard',
        idempotencyDigest: identity.digest,
        request,
        outcome: {
          httpStatus: descriptor.httpStatus,
          code: descriptor.code,
          outcome: descriptor.outcome,
          message: descriptor.message,
          stateVersion: descriptor.stateVersion,
        },
      },
    },
  });
}

export async function resolveDashboardOperationalProposal(prisma, {
  scope,
  proposalId,
  actorId,
  actorName,
  idempotencyKey,
  input,
  includeSensitiveDetails = false,
  timezone = 'America/Argentina/Buenos_Aires',
  now = new Date(),
}) {
  const trustedProposalId = normalizeOperationalProposalId(proposalId);
  const trustedInput = parseOperationalProposalDecisionInput(input);
  const identity = dashboardDecisionIdentity(scope, actorId, idempotencyKey);
  const request = normalizedDecisionRequest(trustedProposalId, trustedInput);

  const result = await runOperationalProjectMutation(
    prisma,
    scope,
    async (transaction) => {
      const priorOperation = await transaction.auditLog.findUnique({
        where: { id: identity.operationId },
        select: {
          organizationId: true,
          actorId: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
        },
      });
      if (priorOperation) {
        const stored = storedDecisionOutcome(priorOperation, {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          actorId,
          request,
        });
        const currentProposal = await transaction.operationalProposal.findFirst(
          proposalQuery(scope, trustedProposalId),
        );
        return {
          ...stored,
          alreadyApplied: true,
          proposal: currentProposal
            ? serializeOperationalProposal(currentProposal, {
                includeSensitiveDetails,
                now,
              })
            : null,
        };
      }

      let proposal = await transaction.operationalProposal.findFirst(
        proposalQuery(scope, trustedProposalId),
      );
      if (!proposal) {
        return {
          ...taskSelectionDescriptor(
            'La propuesta no existe en la obra activa.',
            'OPERATIONAL_PROPOSAL_NOT_FOUND',
            404,
          ),
          outcome: 'NOT_FOUND',
          alreadyApplied: false,
          proposal: null,
        };
      }

      const canonicalTaskRows = await listCanonicalOperationalTaskRows(transaction, scope);
      const canonicalTasks = serializeCanonicalOperationalTasks(canonicalTaskRows, {
        includeSensitiveDetails,
      });
      const action = jsonObject(proposal.action);
      const pendingAndFresh = (
        proposal.status === OPERATIONAL_PROPOSAL_STATUSES.PENDING
        && safeDate(proposal.expiresAt)?.getTime() > now.getTime()
      );
      const canonicalTaskApproval = (
        canonicalTaskRows.length > 0
        && pendingAndFresh
        && proposal.type === OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS
        && trustedInput.decision === OPERATIONAL_PROPOSAL_DECISIONS.APPROVE
      );

      let previousState = null;
      let state = null;
      let stateVersion = 0;
      let legacyTasks = [];
      if (!canonicalTaskApproval) {
        const snapshot = await transaction.projectSnapshot.findUnique({
          where: { projectId: scope.projectId },
          select: { state: true, version: true },
        });
        previousState = snapshot?.state
          ? structuredClone(snapshot.state)
          : {};
        state = ensureOperationalStateCollections(structuredClone(previousState));
        stateVersion = snapshot?.version ?? 0;
        legacyTasks = serializeOperationalTasks(state, {
          includeSensitiveDetails,
        });
      }
      const taskAuthority = canonicalFirstTaskRows({
        canonicalRows: canonicalTaskRows,
        legacyRows: legacyTasks,
      }).authority;
      const operationalTasks = taskAuthority === OPERATIONAL_TASK_AUTHORITIES.CANONICAL
        ? canonicalTasks
        : legacyTasks;

      if (
        pendingAndFresh
        &&
        trustedInput.taskId
        && proposal.type !== OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS
      ) {
        return {
          ...taskSelectionDescriptor(
            'Esta propuesta no admite selección de tarea.',
            'INVALID_TASK_SELECTION',
            400,
          ),
          alreadyApplied: false,
          proposal: serializeOperationalProposal(proposal, {
            includeSensitiveDetails,
            now,
          }),
          stateVersion,
        };
      }
      if (
        pendingAndFresh
        &&
        trustedInput.taskId
        && action.taskKey
        && String(action.taskKey) !== trustedInput.taskId
      ) {
        return {
          ...taskSelectionDescriptor(
            'La propuesta ya está vinculada a otra tarea.',
            'TASK_SELECTION_CONFLICT',
            409,
          ),
          alreadyApplied: false,
          proposal: serializeOperationalProposal(proposal, {
            includeSensitiveDetails,
            now,
          }),
          stateVersion,
        };
      }

      const selectedLegacyTask = taskAuthority === OPERATIONAL_TASK_AUTHORITIES.LEGACY
        && trustedInput.taskId
        && Object.hasOwn(state.tasks, trustedInput.taskId)
        ? state.tasks[trustedInput.taskId]
        : null;
      if (
        taskAuthority === OPERATIONAL_TASK_AUTHORITIES.LEGACY
        && pendingAndFresh
        && trustedInput.taskId
        && !selectedLegacyTask
      ) {
        return {
          ...taskSelectionDescriptor('La tarea seleccionada ya no existe.'),
          alreadyApplied: false,
          proposal: serializeOperationalProposal(proposal, {
            includeSensitiveDetails,
            now,
          }),
          stateVersion,
          tasks: operationalTasks,
        };
      }
      if (
        taskAuthority === OPERATIONAL_TASK_AUTHORITIES.LEGACY
        &&
        pendingAndFresh
        &&
        selectedLegacyTask
        && boundedProgress(selectedLegacyTask.progress) !== trustedInput.taskExpectedProgress
      ) {
        return {
          ...taskSelectionDescriptor(
            'El avance de la tarea cambió desde que abriste la confirmación. Recargá la bandeja.',
            'TASK_PRECONDITION_STALE',
            409,
          ),
          alreadyApplied: false,
          proposal: proposalWithCurrentTaskProgress(
            serializeOperationalProposal(proposal, {
              includeSensitiveDetails,
              now,
            }),
            operationalTasks,
          ),
          stateVersion,
          tasks: operationalTasks,
        };
      }

      const resolution = canonicalTaskApproval
        ? await resolveCanonicalTaskProgressProposal(transaction, {
            proposal,
            trustedInput,
            scope,
            actorId,
            resolverExternalId: identity.resolverExternalId,
            includeSensitiveDetails,
            now,
          })
        : await resolveOperationalProposalDecision({
            state,
            resolver: {
              id: null,
              name: cleanText(actorName, 160) || 'Usuario de plataforma',
              whatsappRole: 'SITE_MANAGER',
            },
            event: {
              provider: 'dashboard',
              externalId: identity.resolverExternalId,
            },
            now,
            projectSettings: {
              id: scope.projectId,
              organizationId: scope.organizationId,
              timezone,
            },
            prisma: transaction,
            decision: {
              decision: trustedInput.decision,
              confirmationCode: proposal.confirmationCode,
              taskReference: trustedInput.taskId
                ? `TAREA ${trustedInput.taskId}`
                : null,
              taskExpectedProgress: trustedInput.taskExpectedProgress,
              channel: 'dashboard',
            },
            auditActorId: actorId,
            auditSource: DASHBOARD_AUDIT_SOURCE,
          });

      if (!canonicalTaskApproval && resolution.stateChanged) {
        const validatedState = validateProjectStateInput(state, {
          previousState,
        });
        stateVersion += 1;
        await synchronizeProjectTaskProjection(transaction, {
          projectId: scope.projectId,
          nextTasks: validatedState.tasks,
          stateVersion,
        });
        await transaction.projectSnapshot.upsert({
          where: { projectId: scope.projectId },
          update: { state: validatedState, version: stateVersion },
          create: {
            projectId: scope.projectId,
            state: validatedState,
            version: stateVersion,
          },
        });
      }

      const descriptor = resolutionDescriptor(resolution, stateVersion);
      const serializedProposal = resolution.proposal
        ? serializeOperationalProposal(resolution.proposal, {
            includeSensitiveDetails,
            now,
          })
        : serializeOperationalProposal(proposal, {
            includeSensitiveDetails,
            now,
          });
      if (DURABLE_RESOLUTION_OUTCOMES.has(resolution.outcome)) {
        await storeDashboardDecisionOperation(transaction, {
          identity,
          scope,
          actorId,
          proposal,
          request,
          descriptor,
        });
      }
      return {
        ...descriptor,
        alreadyApplied: false,
        proposal: serializedProposal,
        ...(descriptor.code === 'TASK_REQUIRED'
          ? {
              tasks: operationalTasks,
            }
          : {}),
      };
    },
  );

  if (!result.success) {
    throw new OperationalProposalInboxError(result.message, {
      code: result.code,
      status: result.httpStatus,
      details: {
        outcome: result.outcome,
        stateVersion: result.stateVersion,
        alreadyApplied: result.alreadyApplied,
        proposal: result.proposal,
        ...(result.tasks ? { tasks: result.tasks } : {}),
      },
    });
  }
  return {
    success: true,
    alreadyApplied: result.alreadyApplied,
    outcome: result.outcome,
    message: result.message,
    proposal: result.proposal,
    stateVersion: result.stateVersion,
  };
}

export function operationalProposalInboxErrorResponse(error) {
  if (!(error instanceof OperationalProposalInboxError)) return null;
  return Response.json({
    error: error.message,
    code: error.code,
    ...error.details,
  }, {
    status: error.status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
