import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import {
  formatProcurementQuantity,
  parseProcurementQuantity,
  ProcurementQuantityError,
} from './procurement-quantity.js';
import { runOperationalProjectMutation } from './project-write-policy.js';

const MAX_REQUIREMENT_LINES = 200;
const HISTORY_DEFAULT_LIMIT = 20;
const HISTORY_MAX_LIMIT = 100;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const CURSOR_CONTRACT = 'task-material-requirement-history:v1';
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const CURSOR_MAX_LENGTH = 2_048;
const QUERY_FIELDS = new Set(['cursor', 'limit']);
const DATABASE_CONFLICT_CODES = new Set([
  'P2002',
  'P2003',
  'P2004',
  'P2010',
  'P2025',
  'P2034',
  '23503',
  '23505',
  '23514',
  '54000',
  '55000',
]);
const REVISION_INCLUDE = Object.freeze({
  lines: {
    include: {
      inventoryItem: {
        select: { id: true, active: true },
      },
    },
    orderBy: [{ itemCodeSnapshot: 'asc' }, { id: 'asc' }],
  },
  authoredBy: { select: { id: true, fullName: true } },
});

export class TaskMaterialRequirementError extends Error {
  constructor(message, code = 'TASK_MATERIAL_REQUIREMENT_INVALID', status = 400) {
    super(message);
    this.name = 'TaskMaterialRequirementError';
    this.code = code;
    this.status = status;
  }
}

function identifier(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (
    typeof value !== 'string'
    || !value
    || value.length > 190
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TaskMaterialRequirementError(`${field} es inválido.`);
  }
  return value;
}

function boundedText(value, field, { minimum = 1, maximum = 500, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string') {
    throw new TaskMaterialRequirementError(`${field} debe ser texto.`);
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (
    normalized.length < minimum
    || normalized.length > maximum
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new TaskMaterialRequirementError(`${field} es inválido.`);
  }
  return normalized;
}

function trustedScope(value) {
  return {
    organizationId: identifier(value?.organizationId, 'organizationId'),
    projectId: identifier(value?.projectId, 'projectId'),
  };
}

function operationKey(value) {
  if (typeof value !== 'string') {
    throw new TaskMaterialRequirementError(
      'Idempotency-Key es obligatorio.',
      'TASK_MATERIAL_REQUIREMENT_IDEMPOTENCY_REQUIRED',
    );
  }
  const normalized = value.trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new TaskMaterialRequirementError(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'TASK_MATERIAL_REQUIREMENT_IDEMPOTENCY_INVALID',
    );
  }
  return normalized;
}

function strictObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TaskMaterialRequirementError(`${field} debe ser un objeto.`);
  }
  return value;
}

function exactFields(value, allowed, required, field) {
  const keys = Object.keys(value);
  const unknown = keys.find((key) => !allowed.has(key));
  const missing = [...required].find((key) => !Object.hasOwn(value, key));
  if (unknown || missing) {
    throw new TaskMaterialRequirementError(
      unknown
        ? `${field}.${unknown} no está permitido.`
        : `${field}.${missing} es obligatorio.`,
      'TASK_MATERIAL_REQUIREMENT_FIELDS_INVALID',
    );
  }
}

function normalizeLine(rawLine, index) {
  const line = strictObject(rawLine, `lines[${index}]`);
  exactFields(
    line,
    new Set(['inventoryItemId', 'quantity', 'notes']),
    new Set(['inventoryItemId', 'quantity']),
    `lines[${index}]`,
  );
  let quantity;
  try {
    quantity = formatProcurementQuantity(parseProcurementQuantity(line.quantity));
  } catch {
    throw new TaskMaterialRequirementError(
      `lines[${index}].quantity debe ser texto decimal positivo con hasta tres decimales.`,
      'TASK_MATERIAL_REQUIREMENT_QUANTITY_INVALID',
    );
  }
  return {
    inventoryItemId: identifier(line.inventoryItemId, `lines[${index}].inventoryItemId`),
    quantity,
    notes: boundedText(line.notes, `lines[${index}].notes`, {
      maximum: 500,
      nullable: true,
    }),
  };
}

function normalizePublishInput(input, rawOperationKey, taskId) {
  const body = strictObject(input, 'body');
  exactFields(
    body,
    new Set(['expectedActiveRevisionId', 'kind', 'reason', 'lines']),
    new Set(['expectedActiveRevisionId', 'kind', 'reason', 'lines']),
    'body',
  );
  const kind = String(body.kind || '');
  if (!['MATERIALS_REQUIRED', 'NO_MATERIALS_REQUIRED'].includes(kind)) {
    throw new TaskMaterialRequirementError(
      'kind debe ser MATERIALS_REQUIRED o NO_MATERIALS_REQUIRED.',
      'TASK_MATERIAL_REQUIREMENT_KIND_INVALID',
    );
  }
  if (!Array.isArray(body.lines) || body.lines.length > MAX_REQUIREMENT_LINES) {
    throw new TaskMaterialRequirementError(
      `lines debe ser una lista de hasta ${MAX_REQUIREMENT_LINES} materiales.`,
      'TASK_MATERIAL_REQUIREMENT_LINES_INVALID',
    );
  }
  if (
    (kind === 'MATERIALS_REQUIRED' && body.lines.length === 0)
    || (kind === 'NO_MATERIALS_REQUIRED' && body.lines.length !== 0)
  ) {
    throw new TaskMaterialRequirementError(
      kind === 'MATERIALS_REQUIRED'
        ? 'Una BOM publicada debe incluir al menos un material.'
        : 'NO_MATERIALS_REQUIRED debe publicarse sin líneas.',
      'TASK_MATERIAL_REQUIREMENT_MODE_SHAPE_INVALID',
    );
  }
  const lines = body.lines.map(normalizeLine)
    .sort((left, right) => left.inventoryItemId.localeCompare(right.inventoryItemId));
  if (new Set(lines.map((line) => line.inventoryItemId)).size !== lines.length) {
    throw new TaskMaterialRequirementError(
      'Cada material puede aparecer una sola vez por revisión.',
      'TASK_MATERIAL_REQUIREMENT_ITEM_DUPLICATE',
    );
  }
  const normalized = {
    operationKey: operationKey(rawOperationKey),
    expectedActiveRevisionId: identifier(
      body.expectedActiveRevisionId,
      'expectedActiveRevisionId',
      { nullable: true },
    ),
    kind,
    reason: boundedText(body.reason, 'reason', { minimum: 3, maximum: 500 }),
    lines,
  };
  return {
    ...normalized,
    requestFingerprint: createHash('sha256').update(JSON.stringify({
      taskId,
      expectedActiveRevisionId: normalized.expectedActiveRevisionId,
      kind: normalized.kind,
      reason: normalized.reason,
      lines: normalized.lines,
    })).digest('hex'),
  };
}

function iso(value) {
  return value?.toISOString?.() || null;
}

function storedQuantity(value) {
  const candidate = typeof value === 'string'
    ? value
    : value?.toString?.();
  try {
    return parseProcurementQuantity(candidate);
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new TaskMaterialRequirementError(
      'La cantidad persistida de la BOM no respeta Decimal(14,3).',
      'TASK_MATERIAL_REQUIREMENT_QUANTITY_CORRUPT',
      409,
    );
  }
}

function serializeLine(line) {
  return {
    id: line.id,
    inventoryItemId: line.inventoryItemId,
    requiredQuantity: formatProcurementQuantity(storedQuantity(line.requiredQuantity)),
    itemCode: line.itemCodeSnapshot,
    itemName: line.itemNameSnapshot,
    unit: line.unitSnapshot,
    notes: line.notes || null,
    itemActive: line.inventoryItem?.active === true,
    createdAt: iso(line.createdAt),
  };
}

function serializeRevision(revision) {
  return {
    id: revision.id,
    taskId: revision.taskId,
    kind: revision.kind,
    version: revision.version,
    lineCount: revision.lineCount,
    predecessorId: revision.predecessorId || null,
    reason: revision.reason,
    taskSnapshot: {
      revision: revision.taskRevisionSnapshot,
      code: revision.taskCodeSnapshot || null,
      title: revision.taskTitleSnapshot,
      startsAt: iso(revision.taskStartsAtSnapshot),
      endsAt: iso(revision.taskEndsAtSnapshot),
    },
    lines: (revision.lines || []).map(serializeLine),
    authoredBy: revision.authoredBy
      ? { id: revision.authoredBy.id, name: revision.authoredBy.fullName || null }
      : null,
    createdAt: iso(revision.createdAt),
  };
}

function taskDto(task) {
  return {
    id: task.id,
    code: task.code || null,
    title: task.title,
    type: task.type,
    status: task.status,
    revision: task.revision,
    startsAt: iso(task.startsAt),
    endsAt: iso(task.endsAt),
  };
}

function readinessFor(head) {
  if (!head) {
    return {
      state: 'NOT_DEFINED',
      label: 'Materiales sin definir',
      available: false,
    };
  }
  if (head.kind === 'NO_MATERIALS_REQUIRED') {
    return {
      state: 'NOT_REQUIRED',
      label: 'No requiere materiales',
      available: false,
    };
  }
  if (head.lines.some((line) => line.inventoryItem?.active !== true)) {
    return {
      state: 'REVIEW_REQUIRED',
      label: 'Revisar materiales inactivos',
      available: false,
    };
  }
  return {
    state: 'DEFINED_UNRESERVED',
    label: `BOM v${head.version} sin reserva`,
    available: false,
  };
}

function cursorScope(current, taskId) {
  return createHash('sha256')
    .update([
      CURSOR_CONTRACT,
      current.organizationId,
      current.projectId,
      taskId,
    ].join('\u0000'))
    .digest('base64url');
}

function encodeCursor(current, taskId, version) {
  return Buffer.from(JSON.stringify([
    CURSOR_CONTRACT,
    cursorScope(current, taskId),
    version,
  ]), 'utf8').toString('base64url');
}

function decodeCursor(value, current, taskId) {
  if (value === null) return null;
  if (
    typeof value !== 'string'
    || !value
    || value.length > CURSOR_MAX_LENGTH
    || !BASE64URL_PATTERN.test(value)
  ) {
    throw new TaskMaterialRequirementError(
      'cursor no es válido.',
      'TASK_MATERIAL_REQUIREMENT_CURSOR_INVALID',
    );
  }
  try {
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      !Array.isArray(payload)
      || payload.length !== 3
      || Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url') !== value
      || payload[0] !== CURSOR_CONTRACT
      || payload[1] !== cursorScope(current, taskId)
      || !Number.isSafeInteger(payload[2])
      || payload[2] < 1
    ) {
      throw new Error('invalid cursor');
    }
    return { version: payload[2] };
  } catch {
    throw new TaskMaterialRequirementError(
      'cursor no corresponde a este historial.',
      'TASK_MATERIAL_REQUIREMENT_CURSOR_INVALID',
    );
  }
}

function singleQueryValue(searchParams, field) {
  const values = searchParams.getAll(field);
  if (values.length > 1) {
    throw new TaskMaterialRequirementError(
      `${field} no puede repetirse.`,
      'TASK_MATERIAL_REQUIREMENT_QUERY_INVALID',
    );
  }
  return values[0] ?? null;
}

function historyLimit(value) {
  if (value === null) return HISTORY_DEFAULT_LIMIT;
  if (!/^[1-9]\d{0,2}$/.test(value)) {
    throw new TaskMaterialRequirementError(
      'limit no es válido.',
      'TASK_MATERIAL_REQUIREMENT_LIMIT_INVALID',
    );
  }
  const parsed = Number(value);
  if (parsed > HISTORY_MAX_LIMIT) {
    throw new TaskMaterialRequirementError(
      `limit debe estar entre 1 y ${HISTORY_MAX_LIMIT}.`,
      'TASK_MATERIAL_REQUIREMENT_LIMIT_INVALID',
    );
  }
  return parsed;
}

export function parseTaskMaterialRequirementQuery(requestUrl, rawScope, rawTaskId) {
  const current = trustedScope(rawScope);
  const taskId = identifier(rawTaskId, 'taskId');
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    throw new TaskMaterialRequirementError(
      'La URL es inválida.',
      'TASK_MATERIAL_REQUIREMENT_QUERY_INVALID',
    );
  }
  for (const field of url.searchParams.keys()) {
    if (!QUERY_FIELDS.has(field)) {
      throw new TaskMaterialRequirementError(
        `El filtro ${field} no está permitido.`,
        'TASK_MATERIAL_REQUIREMENT_QUERY_INVALID',
      );
    }
  }
  return {
    scope: current,
    taskId,
    limit: historyLimit(singleQueryValue(url.searchParams, 'limit')),
    cursor: decodeCursor(singleQueryValue(url.searchParams, 'cursor'), current, taskId),
  };
}

async function canonicalTask(prisma, current, taskId) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      projectId: current.projectId,
      project: { organizationId: current.organizationId },
      metadata: { path: ['source'], equals: 'canonical-task-v1' },
    },
    select: {
      id: true,
      code: true,
      title: true,
      type: true,
      status: true,
      revision: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!task) {
    throw new TaskMaterialRequirementError(
      'La tarea canónica no existe en la obra activa.',
      'TASK_MATERIAL_REQUIREMENT_TASK_NOT_FOUND',
      404,
    );
  }
  return task;
}

export async function listTaskMaterialRequirements(prisma, {
  scope: rawScope,
  taskId: rawTaskId,
  cursor = null,
  limit = HISTORY_DEFAULT_LIMIT,
} = {}) {
  const current = trustedScope(rawScope);
  const taskId = identifier(rawTaskId, 'taskId');
  const safeLimit = Number.isSafeInteger(limit) && limit >= 1 && limit <= HISTORY_MAX_LIMIT
    ? limit
    : HISTORY_DEFAULT_LIMIT;
  const safeCursor = cursor === null
    ? null
    : (
      cursor
      && typeof cursor === 'object'
      && Number.isSafeInteger(cursor.version)
      && cursor.version >= 1
        ? { version: cursor.version }
        : (() => { throw new TaskMaterialRequirementError('cursor es inválido.'); })()
    );
  const [task, head, historyRows] = await Promise.all([
    canonicalTask(prisma, current, taskId),
    prisma.taskMaterialRequirementRevision.findFirst({
      where: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        taskId,
      },
      orderBy: { version: 'desc' },
      include: REVISION_INCLUDE,
    }),
    prisma.taskMaterialRequirementRevision.findMany({
      where: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        taskId,
        ...(safeCursor ? { version: { lt: safeCursor.version } } : {}),
      },
      orderBy: { version: 'desc' },
      take: safeLimit + 1,
      include: {
        ...REVISION_INCLUDE,
        authoredBy: { select: { id: true, fullName: true } },
      },
    }),
  ]);
  const page = historyRows.slice(0, safeLimit);
  const hasMore = historyRows.length > safeLimit;
  return {
    task: taskDto(task),
    head: head ? serializeRevision(head) : null,
    readiness: readinessFor(head),
    history: page.map(serializeRevision),
    hasMore,
    nextCursor: hasMore && page.length
      ? encodeCursor(current, taskId, page.at(-1).version)
      : null,
  };
}

function databaseConflict(error) {
  const message = String(error?.message || '');
  if (message.includes('must extend the current head')) {
    return new TaskMaterialRequirementError(
      'La BOM cambió; recargá el head autoritativo antes de publicar.',
      'TASK_MATERIAL_REQUIREMENT_HEAD_STALE',
      409,
    );
  }
  const codes = [error?.code, error?.meta?.code, error?.cause?.code]
    .filter((code) => typeof code === 'string');
  if (codes.some((code) => DATABASE_CONFLICT_CODES.has(code))) {
    return new TaskMaterialRequirementError(
      'La BOM entró en conflicto con el estado vigente. Recargá antes de reintentar.',
      'TASK_MATERIAL_REQUIREMENT_WRITE_CONFLICT',
      409,
    );
  }
  return null;
}

export async function publishTaskMaterialRequirement(prisma, {
  scope: rawScope,
  taskId: rawTaskId,
  actorId: rawActorId,
  operationKey: rawOperationKey,
  input,
} = {}) {
  const current = trustedScope(rawScope);
  const taskId = identifier(rawTaskId, 'taskId');
  const actorId = identifier(rawActorId, 'actorId');
  const normalized = normalizePublishInput(input, rawOperationKey, taskId);
  try {
    return await runOperationalProjectMutation(prisma, current, async (transaction) => {
      const replay = await transaction.taskMaterialRequirementRevision.findFirst({
        where: {
          projectId: current.projectId,
          operationKey: normalized.operationKey,
        },
        include: {
          ...REVISION_INCLUDE,
          authoredBy: { select: { id: true, fullName: true } },
        },
      });
      if (replay) {
        if (
          replay.organizationId !== current.organizationId
          || replay.taskId !== taskId
          || replay.requestFingerprint !== normalized.requestFingerprint
        ) {
          throw new TaskMaterialRequirementError(
            'El Idempotency-Key ya fue usado con otro contenido.',
            'IDEMPOTENCY_REPLAY_MUTATED',
            409,
          );
        }
        return {
          revision: serializeRevision(replay),
          readiness: readinessFor(replay),
          replayed: true,
        };
      }

      const task = await canonicalTask(transaction, current, taskId);
      if (task.type !== 'TASK' || task.status === 'DONE') {
        throw new TaskMaterialRequirementError(
          'Sólo una tarea operativa no finalizada puede recibir una nueva BOM.',
          'TASK_MATERIAL_REQUIREMENT_TASK_INELIGIBLE',
          409,
        );
      }
      const head = await transaction.taskMaterialRequirementRevision.findFirst({
        where: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          taskId,
        },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });
      const headId = head?.id || null;
      if (headId !== normalized.expectedActiveRevisionId) {
        throw new TaskMaterialRequirementError(
          'La BOM cambió; recargá antes de publicar una nueva revisión.',
          'TASK_MATERIAL_REQUIREMENT_HEAD_STALE',
          409,
        );
      }

      const requestedItemIds = normalized.lines.map((line) => line.inventoryItemId);
      const items = requestedItemIds.length
        ? await transaction.inventoryItem.findMany({
          where: {
            organizationId: current.organizationId,
            projectId: current.projectId,
            id: { in: requestedItemIds },
            active: true,
          },
          select: { id: true, code: true, name: true, baseUnit: true, active: true },
        })
        : [];
      if (items.length !== requestedItemIds.length) {
        throw new TaskMaterialRequirementError(
          'Todos los materiales deben estar activos y pertenecer a la obra.',
          'TASK_MATERIAL_REQUIREMENT_ITEM_SCOPE_INVALID',
          409,
        );
      }
      const itemById = new Map(items.map((item) => [item.id, item]));
      const created = await transaction.taskMaterialRequirementRevision.create({
        data: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          taskId,
          taskIdentitySnapshot: true,
          kind: normalized.kind,
          version: (head?.version || 0) + 1,
          lineCount: normalized.lines.length,
          taskRevisionSnapshot: task.revision,
          taskCodeSnapshot: task.code,
          taskTitleSnapshot: task.title,
          taskStartsAtSnapshot: task.startsAt,
          taskEndsAtSnapshot: task.endsAt,
          predecessorId: headId,
          operationKey: normalized.operationKey,
          requestFingerprint: normalized.requestFingerprint,
          reason: normalized.reason,
          authoredById: actorId,
        },
      });
      if (normalized.lines.length) {
        await transaction.taskMaterialRequirementLine.createMany({
          data: normalized.lines.map((line) => {
            const item = itemById.get(line.inventoryItemId);
            return {
              organizationId: current.organizationId,
              projectId: current.projectId,
              taskId,
              revisionId: created.id,
              inventoryItemId: item.id,
              requiredQuantity: line.quantity,
              itemCodeSnapshot: item.code,
              itemNameSnapshot: item.name,
              unitSnapshot: item.baseUnit,
              notes: line.notes,
            };
          }),
        });
      }
      const persisted = await transaction.taskMaterialRequirementRevision.findFirst({
        where: {
          id: created.id,
          organizationId: current.organizationId,
          projectId: current.projectId,
          taskId,
        },
        include: {
          ...REVISION_INCLUDE,
          authoredBy: { select: { id: true, fullName: true } },
        },
      });
      if (!persisted || persisted.lines.length !== normalized.lines.length) {
        throw new TaskMaterialRequirementError(
          'La BOM no pudo materializarse de forma completa.',
          'TASK_MATERIAL_REQUIREMENT_BUNDLE_INCOMPLETE',
          409,
        );
      }
      await transaction.auditLog.create({
        data: {
          organizationId: current.organizationId,
          actorId,
          action: 'task_material_requirement.published',
          entityType: 'TaskMaterialRequirementRevision',
          entityId: persisted.id,
          metadata: {
            projectId: current.projectId,
            taskId,
            version: persisted.version,
            kind: persisted.kind,
            lineCount: persisted.lineCount,
            predecessorId: persisted.predecessorId,
            operationKey: normalized.operationKey,
          },
        },
      });
      return {
        revision: serializeRevision(persisted),
        readiness: readinessFor(persisted),
        replayed: false,
      };
    });
  } catch (error) {
    if (
      error instanceof TaskMaterialRequirementError
      || error?.name === 'ProjectWritePolicyError'
    ) throw error;
    throw databaseConflict(error) || error;
  }
}

export function taskMaterialRequirementErrorResponse(error) {
  if (!(error instanceof TaskMaterialRequirementError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    {
      status: error.status,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    },
  );
}

export const TASK_MATERIAL_REQUIREMENT_MAX_LINES = MAX_REQUIREMENT_LINES;
