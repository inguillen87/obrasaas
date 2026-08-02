import { createHash } from 'node:crypto';

import { runOperationalProjectMutation } from './project-write-policy.js';

const COMMITMENT_KINDS = new Set(['MATERIAL_DELIVERY', 'SERVICE_EXECUTION']);
const INITIAL_STATUSES = new Set(['TENTATIVE', 'CONFIRMED']);
const TASK_RELATIONS = new Set(['REQUIRED_BEFORE_START', 'EXECUTES_TASK']);
const ACTIONS = new Set(['CONFIRM', 'RESCHEDULE', 'MARK_AT_RISK', 'FULFILL', 'CANCEL']);
const ACTIVE_REMINDER_STATUSES = ['PENDING', 'FAILED', 'CLAIMED'];
const MANUAL_REVIEW_REMINDER_STATUSES = new Set(['UNCERTAIN', 'CONFLICT']);
const MAX_TASK_LINKS = 50;
const MAX_LINE_LINKS = 200;
const DAY_MILLISECONDS = 86_400_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DECIMAL_14_3 = 99_999_999_999.999;

export class SupplierCommitmentError extends Error {
  constructor(message, code = 'SUPPLIER_COMMITMENT_INVALID', status = 400) {
    super(message);
    this.name = 'SupplierCommitmentError';
    this.code = code;
    this.status = status;
  }
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value, field, max, { required = true } = {}) {
  if (value === null || value === undefined || value === '') {
    if (!required) return null;
    throw new SupplierCommitmentError(`${field} es obligatorio.`);
  }
  if (typeof value !== 'string') {
    throw new SupplierCommitmentError(`${field} debe ser texto.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new SupplierCommitmentError(`${field} no cumple los limites permitidos.`);
  }
  return normalized;
}

function scope(value) {
  return {
    organizationId: text(value?.organizationId, 'organizationId', 190),
    projectId: text(value?.projectId, 'projectId', 190),
  };
}

function revision(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new SupplierCommitmentError('expectedRevision debe ser un entero no negativo.');
  }
  return normalized;
}

function reminderDays(value) {
  const normalized = Number(value ?? 7);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 30) {
    throw new SupplierCommitmentError('reminderDaysBefore debe estar entre 1 y 30.');
  }
  return normalized;
}

export function normalizeSupplierEmail(value) {
  const normalized = text(value, 'email del proveedor', 254).toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new SupplierCommitmentError(
      'El proveedor necesita un email operativo valido antes de activar recordatorios.',
      'SUPPLIER_REMINDER_EMAIL_REQUIRED',
      409,
    );
  }
  return normalized;
}

export function civilDateKey(value, field = 'fecha') {
  const candidate = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '');
  const match = candidate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new SupplierCommitmentError(`${field} debe usar YYYY-MM-DD.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (
    instant.getUTCFullYear() !== year
    || instant.getUTCMonth() !== month - 1
    || instant.getUTCDate() !== day
  ) throw new SupplierCommitmentError(`${field} no es una fecha civil valida.`);
  return instant.toISOString().slice(0, 10);
}

function civilDate(value, field) {
  return new Date(`${civilDateKey(value, field)}T00:00:00.000Z`);
}

export function addCivilDays(value, amount) {
  const date = civilDate(value, 'fecha');
  date.setUTCDate(date.getUTCDate() + Number(amount || 0));
  return date.toISOString().slice(0, 10);
}

function validTimezone(value) {
  const timezone = text(value, 'timezone', 64);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    throw new SupplierCommitmentError('La zona horaria de la organizacion no es valida.', 'SUPPLIER_COMMITMENT_TIMEZONE_INVALID', 409);
  }
  return timezone;
}

function zonedParts(value, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

export function zonedCivilDateTime(value, timezoneValue, hour = 9) {
  const dateKey = civilDateKey(value);
  const timezone = validTimezone(timezoneValue);
  const [year, month, day] = dateKey.split('-').map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, 0, 0);
  let candidate = wanted;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = zonedParts(new Date(candidate), timezone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const correction = wanted - represented;
    candidate += correction;
    if (correction === 0) break;
  }
  const verified = zonedParts(new Date(candidate), timezone);
  if (verified.year !== year || verified.month !== month || verified.day !== day || verified.hour !== hour) {
    throw new SupplierCommitmentError('No se pudo resolver el horario civil del recordatorio.', 'SUPPLIER_COMMITMENT_TIMEZONE_GAP', 409);
  }
  return new Date(candidate);
}

export function todayInTimezone(timezoneValue, now = new Date()) {
  const timezone = validTimezone(timezoneValue);
  const parts = zonedParts(now, timezone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function fortnightBucket(value) {
  const key = civilDateKey(value);
  const [year, month, day] = key.split('-').map(Number);
  const half = day <= 15 ? 1 : 2;
  const start = `${year}-${String(month).padStart(2, '0')}-${half === 1 ? '01' : '16'}`;
  const nextMonth = new Date(Date.UTC(year, month, 0));
  const endDay = half === 1 ? 15 : nextMonth.getUTCDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  return { id: `${year}-${String(month).padStart(2, '0')}-Q${half}`, year, month, half, start, end };
}

function normalizeTaskLinks(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_TASK_LINKS) {
    throw new SupplierCommitmentError(`taskLinks admite hasta ${MAX_TASK_LINKS} tareas.`);
  }
  const links = value.map((raw) => {
    const item = record(raw);
    const taskId = text(item.taskId, 'taskId', 190);
    const relation = String(item.relation || 'REQUIRED_BEFORE_START').toUpperCase();
    if (!TASK_RELATIONS.has(relation)) throw new SupplierCommitmentError('Relacion con tarea invalida.');
    return { taskId, relation };
  });
  if (new Set(links.map((link) => link.taskId)).size !== links.length) {
    throw new SupplierCommitmentError('Una tarea no puede repetirse en el mismo compromiso.');
  }
  return links.sort((left, right) => left.taskId.localeCompare(right.taskId));
}

function normalizeLineLinks(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_LINE_LINKS) {
    throw new SupplierCommitmentError(`lines admite hasta ${MAX_LINE_LINKS} partidas de orden.`);
  }
  const lines = value.map((raw) => {
    const item = record(raw);
    const purchaseOrderLineId = text(item.purchaseOrderLineId, 'purchaseOrderLineId', 190);
    const quantity = Number(item.quantity);
    if (
      !Number.isFinite(quantity)
      || quantity <= 0
      || quantity > MAX_DECIMAL_14_3
      || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-6
    ) {
      throw new SupplierCommitmentError('La cantidad comprometida debe ser positiva y tener hasta tres decimales.');
    }
    return { purchaseOrderLineId, quantity };
  });
  if (new Set(lines.map((line) => line.purchaseOrderLineId)).size !== lines.length) {
    throw new SupplierCommitmentError('Una linea de orden no puede repetirse en el mismo compromiso.');
  }
  return lines.sort((left, right) => left.purchaseOrderLineId.localeCompare(right.purchaseOrderLineId));
}

function normalizeCreateInput(input) {
  const candidate = record(input);
  const kind = String(candidate.kind || '').toUpperCase();
  if (!COMMITMENT_KINDS.has(kind)) throw new SupplierCommitmentError('Tipo de compromiso invalido.');
  const status = String(candidate.status || 'CONFIRMED').toUpperCase();
  if (!INITIAL_STATUSES.has(status)) throw new SupplierCommitmentError('El compromiso debe iniciar tentativo o confirmado.');
  const startsOn = civilDateKey(candidate.startsOn, 'startsOn');
  const endsOn = civilDateKey(candidate.endsOn || candidate.startsOn, 'endsOn');
  if (endsOn < startsOn) throw new SupplierCommitmentError('endsOn no puede ser anterior a startsOn.');
  const reminderEnabled = candidate.reminderEnabled === true;
  const reminderEmailConfirmed = candidate.reminderEmailConfirmed === true;
  if (reminderEnabled && !reminderEmailConfirmed) {
    throw new SupplierCommitmentError(
      'Confirma que el email operativo fue validado con el proveedor antes de programar avisos.',
      'SUPPLIER_REMINDER_EMAIL_CONFIRMATION_REQUIRED',
      409,
    );
  }
  return {
    operationKey: text(candidate.operationKey, 'operationKey', 190),
    supplierId: text(candidate.supplierId, 'supplierId', 190),
    purchaseOrderId: candidate.purchaseOrderId ? text(candidate.purchaseOrderId, 'purchaseOrderId', 190) : null,
    kind,
    status,
    title: text(candidate.title, 'title', 220),
    notes: candidate.notes ? text(candidate.notes, 'notes', 4000) : null,
    startsOn,
    endsOn,
    reminderEnabled,
    reminderEmailConfirmed,
    reminderDaysBefore: reminderDays(candidate.reminderDaysBefore),
    taskLinks: normalizeTaskLinks(candidate.taskLinks),
    lines: normalizeLineLinks(candidate.lines),
  };
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function commitmentFingerprint(input) {
  return fingerprint({
    ...input,
    lines: input.lines.map((line) => ({ ...line, quantity: line.quantity.toFixed(3) })),
  });
}

function stateSnapshot(value) {
  return {
    kind: value.kind,
    status: value.status,
    title: value.title,
    startsOn: civilDateKey(value.startsOn),
    endsOn: civilDateKey(value.endsOn),
    reminderEnabled: value.reminderEnabled === true,
    reminderDaysBefore: Number(value.reminderDaysBefore || 7),
    reminderEmailConfigured: Boolean(value.reminderEmail),
    reminderEmailConfirmed: Boolean(value.reminderEmailConfirmedAt),
    scheduleRevision: Number(value.scheduleRevision || 0),
    revision: Number(value.revision || 0),
  };
}

function maskEmail(value) {
  const [local, domain] = String(value || '').split('@');
  if (!local || !domain) return null;
  return `${local.slice(0, 2)}***@${domain}`;
}

function formatCivil(value) {
  const date = civilDate(value, 'fecha');
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function reminderCopy({ kind, commitment, projectName, supplierName }) {
  const date = commitment.startsOn;
  const range = commitment.endsOn !== commitment.startsOn
    ? ` entre el ${formatCivil(date)} y el ${formatCivil(commitment.endsOn)}`
    : ` el ${formatCivil(date)}`;
  if (kind === 'CANCELLED') {
    return {
      subject: `Cancelación de actividad - ${projectName}`,
      textBody: `Hola ${supplierName}. Se canceló la actividad "${commitment.title}" prevista${range} para la obra ${projectName}. Por favor, coordiná cualquier duda con el equipo de obra.`,
    };
  }
  if (kind === 'RESCHEDULED') {
    return {
      subject: `Reprogramación de actividad - ${projectName}`,
      textBody: `Hola ${supplierName}. La actividad "${commitment.title}" fue reprogramada${range} para la obra ${projectName}. Por favor, confirmá la nueva fecha con el equipo de obra.`,
    };
  }
  if (kind === 'LATE_SCHEDULED') {
    return {
      subject: `Actividad próxima programada - ${projectName}`,
      textBody: `Hola ${supplierName}. Se programó la actividad "${commitment.title}"${range} para la obra ${projectName}. La fecha está a menos de ${commitment.reminderDaysBefore} días, por eso este es un aviso inmediato y no el recordatorio anticipado.`,
    };
  }
  return {
    subject: `Recordatorio de actividad - ${projectName}`,
    textBody: `Hola ${supplierName}. Te recordamos que la actividad "${commitment.title}" está prevista${range} para la obra ${projectName}. Este aviso fue programado con ${commitment.reminderDaysBefore} días de anticipación. Por favor, confirmá disponibilidad con el equipo de obra.`,
  };
}

function reminderIdempotencyNamespace(env = process.env) {
  const configured = typeof env.RESEND_IDEMPOTENCY_NAMESPACE === 'string'
    ? env.RESEND_IDEMPOTENCY_NAMESPACE.trim().toLowerCase()
    : '';
  if (configured) {
    if (!/^[a-z0-9][a-z0-9._-]{0,62}[a-z0-9]$|^[a-z0-9]$/.test(configured)) {
      throw new SupplierCommitmentError(
        'RESEND_IDEMPOTENCY_NAMESPACE no es valido.',
        'SUPPLIER_REMINDER_NAMESPACE_INVALID',
        503,
      );
    }
    return configured;
  }
  if (env.VERCEL_ENV || env.NODE_ENV === 'production') {
    throw new SupplierCommitmentError(
      'Falta el namespace de idempotencia del entorno de email.',
      'SUPPLIER_REMINDER_NAMESPACE_MISSING',
      503,
    );
  }
  return 'local';
}

export function buildReminderDraft({
  commitment,
  projectName,
  supplierName,
  kind = null,
  now = new Date(),
  env = process.env,
}) {
  if (!commitment.reminderEmail) return null;
  if (!kind && civilDateKey(commitment.endsOn) < todayInTimezone(commitment.timezone, now)) return null;
  let reminderKind = kind;
  let scheduledFor;
  if (reminderKind === 'RESCHEDULED' || reminderKind === 'CANCELLED') {
    scheduledFor = new Date(now);
  } else {
    const dueDate = addCivilDays(commitment.startsOn, -Number(commitment.reminderDaysBefore || 7));
    const ideal = zonedCivilDateTime(dueDate, commitment.timezone, 9);
    if (ideal.getTime() < now.getTime()) {
      reminderKind = 'LATE_SCHEDULED';
      scheduledFor = new Date(now);
    } else {
      reminderKind = 'UPCOMING';
      scheduledFor = ideal;
    }
  }
  const copy = reminderCopy({ kind: reminderKind, commitment, projectName, supplierName });
  const scheduleRevision = Number(commitment.scheduleRevision || 0);
  const eventKey = `supplier:${commitment.id}:v${scheduleRevision}:${reminderKind.toLowerCase()}`;
  const providerIdempotencyKey = `${reminderIdempotencyNamespace(env)}:${eventKey}`;
  if (providerIdempotencyKey.length > 256) {
    throw new SupplierCommitmentError('La clave idempotente del email supera el limite del proveedor.');
  }
  return {
    organizationId: commitment.organizationId,
    projectId: commitment.projectId,
    commitmentId: commitment.id,
    scheduleRevision,
    eventKey,
    providerIdempotencyKey,
    kind: reminderKind,
    recipientEmail: commitment.reminderEmail,
    subject: copy.subject,
    textBody: copy.textBody,
    scheduledFor,
    nextAttemptAt: scheduledFor,
  };
}

function taskImpact(commitment, link, today) {
  const task = link.task || {};
  const taskStart = task.startsAt ? civilDateKey(task.startsAt) : null;
  const taskEnd = task.endsAt ? civilDateKey(task.endsAt) : taskStart;
  if (commitment.status === 'FULFILLED') {
    return commitment.kind === 'MATERIAL_DELIVERY' ? 'ADMIN_ATTESTED' : 'AVAILABLE';
  }
  if (commitment.status === 'CANCELLED') return 'BLOCKED';
  if (!taskStart) return 'REVIEW_REQUIRED';
  if (link.relation === 'EXECUTES_TASK') {
    if (commitment.endsOn < taskStart || (taskEnd && commitment.startsOn > taskEnd)) return 'AT_RISK';
    return commitment.status === 'TENTATIVE' || commitment.status === 'AT_RISK' ? 'AT_RISK' : 'ALIGNED';
  }
  if (today >= taskStart) return 'BLOCKED';
  if (commitment.endsOn < today) return 'BLOCKED';
  if (commitment.endsOn > taskStart) return 'AT_RISK';
  if (commitment.status === 'TENTATIVE' || commitment.status === 'AT_RISK') return 'AT_RISK';
  return 'EXPECTED_IN_TIME';
}

function serializeReminder(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    scheduleRevision: row.scheduleRevision,
    scheduledFor: row.scheduledFor?.toISOString?.() || null,
    sentAt: row.sentAt?.toISOString?.() || null,
    attempts: row.attempts,
  };
}

export function serializeSupplierCommitment(row, { now = new Date() } = {}) {
  const startsOn = civilDateKey(row.startsOn);
  const endsOn = civilDateKey(row.endsOn);
  const today = todayInTimezone(row.timezone, now);
  const links = (row.taskLinks || []).map((link) => ({
    taskId: link.taskId,
    relation: link.relation,
    task: link.task ? {
      id: link.task.id,
      title: link.task.title,
      status: link.task.status,
      startsAt: link.task.startsAt?.toISOString?.() || null,
      endsAt: link.task.endsAt?.toISOString?.() || null,
    } : null,
    readiness: taskImpact({ ...row, startsOn, endsOn }, link, today),
  }));
  const latestReminder = Array.isArray(row.reminderDeliveries) ? row.reminderDeliveries[0] : null;
  return {
    id: row.id,
    projectId: row.projectId,
    supplierId: row.supplierId,
    purchaseOrderId: row.purchaseOrderId || null,
    kind: row.kind,
    status: row.status,
    title: row.title,
    notes: row.notes || null,
    startsOn,
    endsOn,
    timezone: row.timezone,
    fortnight: fortnightBucket(startsOn),
    timing: row.status === 'FULFILLED'
      ? 'FULFILLED'
      : row.status === 'CANCELLED'
        ? 'CANCELLED'
        : endsOn < today
          ? 'OVERDUE'
          : 'SCHEDULED',
    reminderEnabled: row.reminderEnabled,
    reminderDaysBefore: row.reminderDaysBefore,
    reminderEmailMasked: maskEmail(row.reminderEmail),
    reminderEmailConfirmed: Boolean(row.reminderEmailConfirmedAt),
    scheduleRevision: row.scheduleRevision,
    revision: row.revision,
    fulfilledAt: row.fulfilledAt?.toISOString?.() || null,
    fulfillmentEvidence: row.status === 'FULFILLED'
      ? row.kind === 'MATERIAL_DELIVERY' ? 'ADMIN_ATTESTED' : 'SERVICE_CONFIRMED'
      : null,
    supplier: row.supplier ? { id: row.supplier.id, legalName: row.supplier.legalName } : null,
    purchaseOrder: row.purchaseOrder ? { id: row.purchaseOrder.id, number: row.purchaseOrder.number, status: row.purchaseOrder.status } : null,
    taskLinks: links,
    lines: (row.lines || []).map((line) => ({
      purchaseOrderLineId: line.purchaseOrderLineId,
      quantity: line.quantity?.toString?.() ?? String(line.quantity),
      description: line.purchaseOrderLine?.description || null,
      unit: line.purchaseOrderLine?.unit || null,
    })),
    latestReminder: serializeReminder(latestReminder),
    requiresManualReminderReview: (row.reminderDeliveries || []).some((delivery) => MANUAL_REVIEW_REMINDER_STATUSES.has(delivery.status)),
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null,
  };
}

function commitmentInclude() {
  return {
    supplier: { select: { id: true, legalName: true, email: true, active: true } },
    purchaseOrder: { select: { id: true, number: true, status: true } },
    taskLinks: {
      include: { task: { select: { id: true, title: true, status: true, startsAt: true, endsAt: true } } },
      orderBy: { taskId: 'asc' },
    },
    lines: {
      include: { purchaseOrderLine: { select: { id: true, description: true, unit: true } } },
      orderBy: { purchaseOrderLineId: 'asc' },
    },
    reminderDeliveries: { orderBy: { createdAt: 'desc' }, take: 20 },
  };
}

export async function listSupplierCommitments(prisma, {
  organizationId,
  projectId,
  from = null,
  to = null,
  status = null,
  taskId = null,
  limit = 500,
  now = new Date(),
} = {}) {
  const current = scope({ organizationId, projectId });
  const fromKey = from ? civilDateKey(from, 'from') : null;
  const toKey = to ? civilDateKey(to, 'to') : null;
  if (fromKey && toKey && toKey < fromKey) throw new SupplierCommitmentError('El rango de calendario es invalido.');
  const normalizedStatus = status ? String(status).toUpperCase() : null;
  if (normalizedStatus && !new Set(['TENTATIVE', 'CONFIRMED', 'AT_RISK', 'FULFILLED', 'CANCELLED']).has(normalizedStatus)) {
    throw new SupplierCommitmentError('Estado de compromiso invalido.');
  }
  const take = Math.min(5_000, Math.max(1, Number(limit) || 500));
  const rows = await prisma.supplierCommitment.findMany({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      ...(toKey ? { startsOn: { lte: civilDate(toKey) } } : {}),
      ...(fromKey ? { endsOn: { gte: civilDate(fromKey) } } : {}),
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(taskId ? { taskLinks: { some: { taskId: text(taskId, 'taskId', 190) } } } : {}),
    },
    include: commitmentInclude(),
    orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
    take: take + 1,
  });
  const hasMore = rows.length > take;
  return {
    commitments: rows.slice(0, take).map((row) => serializeSupplierCommitment(row, { now })),
    hasMore,
  };
}

async function validateTaskLinks(transaction, projectId, links) {
  if (links.length === 0) return;
  const tasks = await transaction.task.findMany({
    where: {
      projectId,
      id: { in: links.map((link) => link.taskId) },
      metadata: { path: ['source'], equals: 'canonical-task-v1' },
    },
    select: { id: true },
  });
  if (tasks.length !== links.length) {
    throw new SupplierCommitmentError(
      'Todas las tareas vinculadas deben pertenecer a la WBS canonica de esta obra.',
      'SUPPLIER_COMMITMENT_TASK_SCOPE',
      409,
    );
  }
}

async function validateCommitmentLines(transaction, { projectId, purchaseOrder, lines }) {
  if (lines.length === 0) return;
  if (!purchaseOrder) {
    throw new SupplierCommitmentError('Las cantidades comprometidas requieren una orden de compra.', 'SUPPLIER_COMMITMENT_ORDER_REQUIRED', 409);
  }
  const orderById = new Map(purchaseOrder.lines.map((line) => [line.id, line]));
  for (const line of lines) {
    const ordered = orderById.get(line.purchaseOrderLineId);
    if (!ordered) {
      throw new SupplierCommitmentError('Una linea comprometida no pertenece a la orden.', 'SUPPLIER_COMMITMENT_LINE_SCOPE', 409);
    }
    const [existing, receipts] = await Promise.all([
      transaction.supplierCommitmentLine.findMany({
      where: {
        projectId,
        purchaseOrderLineId: line.purchaseOrderLineId,
        commitment: { status: { in: ['TENTATIVE', 'CONFIRMED', 'AT_RISK'] } },
      },
      select: { quantity: true },
      }),
      transaction.goodsReceiptLine.findMany({
        where: {
          projectId,
          purchaseOrderLineId: line.purchaseOrderLineId,
          goodsReceipt: { status: 'POSTED' },
        },
        select: { quantity: true },
      }),
    ]);
    const committed = existing.reduce((sum, item) => sum + Number(item.quantity), 0);
    const received = receipts.reduce((sum, item) => sum + Number(item.quantity), 0);
    if (received + committed + line.quantity > Number(ordered.quantity) + 1e-9) {
      throw new SupplierCommitmentError(
        'La suma de entregas comprometidas supera la cantidad ordenada.',
        'SUPPLIER_COMMITMENT_OVER_ALLOCATED',
        409,
      );
    }
  }
}

export async function createSupplierCommitment(prisma, {
  scope: rawScope,
  actorId,
  input,
  now = new Date(),
} = {}) {
  const current = scope(rawScope);
  const actor = text(actorId, 'actorId', 190);
  const normalized = normalizeCreateInput(input);
  const requestFingerprint = commitmentFingerprint(normalized);
  return runOperationalProjectMutation(prisma, current, async (transaction) => {
    const replay = await transaction.supplierCommitment.findFirst({
      where: { projectId: current.projectId, operationKey: normalized.operationKey },
      include: commitmentInclude(),
    });
    if (replay) {
      if (replay.requestFingerprint !== requestFingerprint) {
        throw new SupplierCommitmentError('La operationKey ya fue usada con otro contenido.', 'IDEMPOTENCY_REPLAY_MUTATED', 409);
      }
      return { commitment: serializeSupplierCommitment(replay, { now }), replayed: true };
    }
    const conflictingEvent = await transaction.supplierCommitmentEvent.findFirst({
      where: { projectId: current.projectId, operationKey: normalized.operationKey },
      select: { id: true },
    });
    if (conflictingEvent) {
      throw new SupplierCommitmentError(
        'La operationKey ya fue usada por otra mutacion.',
        'IDEMPOTENCY_REPLAY_MUTATED',
        409,
      );
    }

    const [project, supplier] = await Promise.all([
      transaction.project.findFirst({
        where: { id: current.projectId, organizationId: current.organizationId },
        select: { id: true, name: true, organization: { select: { timezone: true } } },
      }),
      transaction.supplier.findFirst({
        where: { id: normalized.supplierId, organizationId: current.organizationId, active: true },
        select: { id: true, legalName: true, email: true, active: true },
      }),
    ]);
    if (!project || !supplier) {
      throw new SupplierCommitmentError('La obra o el proveedor no estan disponibles.', 'SUPPLIER_COMMITMENT_SCOPE', 409);
    }
    const purchaseOrder = normalized.purchaseOrderId
      ? await transaction.purchaseOrder.findFirst({
          where: {
            id: normalized.purchaseOrderId,
            organizationId: current.organizationId,
            projectId: current.projectId,
            supplierId: supplier.id,
            status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] },
          },
          include: { lines: true },
        })
      : null;
    if (normalized.purchaseOrderId && !purchaseOrder) {
      throw new SupplierCommitmentError('La orden debe estar aprobada y pertenecer al mismo proveedor.', 'SUPPLIER_COMMITMENT_ORDER_SCOPE', 409);
    }
    await validateTaskLinks(transaction, current.projectId, normalized.taskLinks);
    await validateCommitmentLines(transaction, { projectId: current.projectId, purchaseOrder, lines: normalized.lines });

    const timezone = validTimezone(project.organization.timezone);
    if (normalized.reminderEnabled && normalized.endsOn < todayInTimezone(timezone, now)) {
      throw new SupplierCommitmentError(
        'No se puede programar un recordatorio para un compromiso ya vencido.',
        'SUPPLIER_REMINDER_HISTORICAL_DATE',
        409,
      );
    }
    const reminderEmail = normalized.reminderEnabled ? normalizeSupplierEmail(supplier.email) : null;
    const created = await transaction.supplierCommitment.create({
      data: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        supplierId: supplier.id,
        purchaseOrderId: purchaseOrder?.id || null,
        operationKey: normalized.operationKey,
        requestFingerprint,
        kind: normalized.kind,
        status: normalized.status,
        title: normalized.title,
        notes: normalized.notes,
        startsOn: civilDate(normalized.startsOn),
        endsOn: civilDate(normalized.endsOn),
        timezone,
        reminderEnabled: normalized.reminderEnabled,
        reminderDaysBefore: normalized.reminderDaysBefore,
        reminderEmail,
        reminderEmailConfirmedAt: normalized.reminderEnabled ? now : null,
        reminderEmailConfirmedById: normalized.reminderEnabled ? actor : null,
        taskLinks: normalized.taskLinks.length ? { create: normalized.taskLinks.map((link) => ({ ...link, projectId: current.projectId })) } : undefined,
        lines: normalized.lines.length ? { create: normalized.lines.map((line) => ({ ...line, projectId: current.projectId, purchaseOrderId: purchaseOrder.id })) } : undefined,
      },
    });
    const createdState = stateSnapshot(created);
    await transaction.supplierCommitmentEvent.create({
      data: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        commitmentId: created.id,
        sequence: 0,
        operationKey: normalized.operationKey,
        requestFingerprint,
        type: 'CREATED',
        actorId: actor,
        nextState: createdState,
      },
    });
    if (created.reminderEnabled && created.status === 'CONFIRMED') {
      const draft = buildReminderDraft({ commitment: createdStateForReminder(created), projectName: project.name, supplierName: supplier.legalName, now });
      if (draft) await transaction.supplierReminderDelivery.create({ data: draft });
    }
    await transaction.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: actor,
        action: 'supplier_commitment.created',
        entityType: 'SupplierCommitment',
        entityId: created.id,
        metadata: {
          projectId: current.projectId,
          supplierId: supplier.id,
          purchaseOrderId: purchaseOrder?.id || null,
          kind: created.kind,
          startsOn: normalized.startsOn,
          endsOn: normalized.endsOn,
          reminderEnabled: created.reminderEnabled,
        },
      },
    });
    const persisted = await transaction.supplierCommitment.findFirst({
      where: { id: created.id, projectId: current.projectId },
      include: commitmentInclude(),
    });
    return { commitment: serializeSupplierCommitment(persisted, { now }), replayed: false };
  });
}

function createdStateForReminder(row) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    title: row.title,
    startsOn: civilDateKey(row.startsOn),
    endsOn: civilDateKey(row.endsOn),
    timezone: row.timezone,
    reminderDaysBefore: row.reminderDaysBefore,
    reminderEmail: row.reminderEmail,
    scheduleRevision: row.scheduleRevision,
  };
}

function actionEventType(action) {
  return {
    CONFIRM: 'CONFIRMED',
    RESCHEDULE: 'RESCHEDULED',
    MARK_AT_RISK: 'MARKED_AT_RISK',
    FULFILL: 'FULFILLED',
    CANCEL: 'CANCELLED',
  }[action];
}

export async function updateSupplierCommitment(prisma, {
  scope: rawScope,
  actorId,
  commitmentId,
  input,
  now = new Date(),
} = {}) {
  const current = scope(rawScope);
  const actor = text(actorId, 'actorId', 190);
  const id = text(commitmentId, 'commitmentId', 190);
  const candidate = record(input);
  const operationKey = text(candidate.operationKey, 'operationKey', 190);
  const expectedRevision = revision(candidate.expectedRevision);
  const action = String(candidate.action || '').toUpperCase();
  if (!ACTIONS.has(action)) throw new SupplierCommitmentError('Accion de compromiso invalida.');
  const reason = candidate.reason ? text(candidate.reason, 'reason', 500) : null;
  if (['RESCHEDULE', 'CANCEL'].includes(action) && !reason) {
    throw new SupplierCommitmentError('Reprogramar o cancelar requiere un motivo.');
  }
  const updateIntent = {
    commitmentId: id,
    operationKey,
    expectedRevision,
    action,
    reason,
    ...(action === 'RESCHEDULE' ? {
      startsOn: civilDateKey(candidate.startsOn, 'startsOn'),
      endsOn: civilDateKey(candidate.endsOn || candidate.startsOn, 'endsOn'),
    } : {}),
  };
  if (updateIntent.endsOn && updateIntent.endsOn < updateIntent.startsOn) {
    throw new SupplierCommitmentError('endsOn no puede ser anterior a startsOn.');
  }
  const requestFingerprint = fingerprint(updateIntent);

  return runOperationalProjectMutation(prisma, current, async (transaction) => {
    const replayEvent = await transaction.supplierCommitmentEvent.findFirst({
      where: { projectId: current.projectId, operationKey },
    });
    if (replayEvent) {
      if (replayEvent.commitmentId !== id || replayEvent.requestFingerprint !== requestFingerprint) {
        throw new SupplierCommitmentError('La operationKey ya fue usada con otro contenido.', 'IDEMPOTENCY_REPLAY_MUTATED', 409);
      }
      const replay = await transaction.supplierCommitment.findFirst({
        where: { id, organizationId: current.organizationId, projectId: current.projectId },
        include: commitmentInclude(),
      });
      return { commitment: serializeSupplierCommitment(replay, { now }), replayed: true };
    }

    const before = await transaction.supplierCommitment.findFirst({
      where: { id, organizationId: current.organizationId, projectId: current.projectId, revision: expectedRevision },
      include: {
        supplier: { select: { id: true, legalName: true, email: true, active: true } },
        project: { select: { id: true, name: true } },
        reminderDeliveries: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!before) throw new SupplierCommitmentError('El compromiso cambio; recarga antes de continuar.', 'SUPPLIER_COMMITMENT_STALE', 409);
    if (['FULFILLED', 'CANCELLED'].includes(before.status)) {
      throw new SupplierCommitmentError('El compromiso ya esta en un estado terminal.', 'SUPPLIER_COMMITMENT_TERMINAL', 409);
    }
    if (before.reminderDeliveries.some((delivery) => delivery.status === 'DISPATCHING')) {
      throw new SupplierCommitmentError('Hay un email en envio; espera su conciliacion antes de cambiar la fecha.', 'SUPPLIER_REMINDER_IN_FLIGHT', 409);
    }
    if (action === 'CONFIRM' && before.status !== 'TENTATIVE') {
      throw new SupplierCommitmentError('Solo un compromiso tentativo puede confirmarse.', 'SUPPLIER_COMMITMENT_ACTION_INVALID', 409);
    }
    if (action === 'MARK_AT_RISK' && before.status !== 'CONFIRMED') {
      throw new SupplierCommitmentError('Solo un compromiso confirmado puede marcarse en riesgo.', 'SUPPLIER_COMMITMENT_ACTION_INVALID', 409);
    }
    if (action === 'FULFILL' && !['CONFIRMED', 'AT_RISK'].includes(before.status)) {
      throw new SupplierCommitmentError('Solo un compromiso confirmado puede marcarse cumplido.', 'SUPPLIER_COMMITMENT_ACTION_INVALID', 409);
    }
    if (
      action === 'RESCHEDULE'
      && civilDateKey(before.startsOn) === updateIntent.startsOn
      && civilDateKey(before.endsOn) === updateIntent.endsOn
    ) {
      throw new SupplierCommitmentError('La reprogramacion debe cambiar al menos una fecha.', 'SUPPLIER_COMMITMENT_NOOP_RESCHEDULE', 409);
    }
    if (
      action === 'RESCHEDULE'
      && before.reminderEnabled
      && updateIntent.endsOn < todayInTimezone(before.timezone, now)
    ) {
      throw new SupplierCommitmentError(
        'No se puede reprogramar un aviso hacia una fecha ya vencida.',
        'SUPPLIER_REMINDER_HISTORICAL_DATE',
        409,
      );
    }
    if (action === 'FULFILL' && before.kind === 'MATERIAL_DELIVERY' && !reason) {
      throw new SupplierCommitmentError(
        'Confirmar manualmente una entrega material requiere indicar la evidencia o recepcion verificada.',
        'SUPPLIER_COMMITMENT_FULFILLMENT_EVIDENCE_REQUIRED',
        409,
      );
    }

    const nextRevision = expectedRevision + 1;
    const data = { revision: { increment: 1 } };
    if (action === 'CONFIRM') data.status = 'CONFIRMED';
    if (action === 'MARK_AT_RISK') data.status = 'AT_RISK';
    if (action === 'FULFILL') {
      data.status = 'FULFILLED';
      data.fulfilledAt = now;
    }
    if (action === 'CANCEL') data.status = 'CANCELLED';
    if (action === 'RESCHEDULE') {
      data.startsOn = civilDate(updateIntent.startsOn);
      data.endsOn = civilDate(updateIntent.endsOn);
      data.scheduleRevision = { increment: 1 };
    }

    const updated = await transaction.supplierCommitment.updateMany({
      where: { id, organizationId: current.organizationId, projectId: current.projectId, revision: expectedRevision },
      data,
    });
    if (updated.count !== 1) throw new SupplierCommitmentError('El compromiso cambio; recarga antes de continuar.', 'SUPPLIER_COMMITMENT_STALE', 409);

    await transaction.supplierReminderDelivery.updateMany({
      where: { commitmentId: id, projectId: current.projectId, status: { in: ACTIVE_REMINDER_STATUSES } },
      data: { status: 'CANCELLED', leasedAt: null, lastError: 'Superseded by a newer commitment revision' },
    });
    const after = {
      ...before,
      ...data,
      revision: nextRevision,
      startsOn: data.startsOn || before.startsOn,
      endsOn: data.endsOn || before.endsOn,
      status: data.status || before.status,
      fulfilledAt: data.fulfilledAt || before.fulfilledAt,
      reminderEmail: data.reminderEmail || before.reminderEmail,
      scheduleRevision: action === 'RESCHEDULE' ? Number(before.scheduleRevision || 0) + 1 : before.scheduleRevision,
    };
    await transaction.supplierCommitmentEvent.create({
      data: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        commitmentId: id,
        sequence: nextRevision,
        operationKey,
        requestFingerprint,
        type: actionEventType(action),
        actorId: actor,
        reason,
        previousState: stateSnapshot(before),
        nextState: stateSnapshot(after),
      },
    });

    const previouslySent = before.reminderDeliveries.some((delivery) => ['PROVIDER_ACCEPTED', 'DELIVERY_DELAYED', 'DELIVERED', 'UNCERTAIN'].includes(delivery.status));
    if (action === 'CANCEL' && previouslySent && after.reminderEmail) {
      const cancellation = buildReminderDraft({ commitment: createdStateForReminder(after), projectName: before.project.name, supplierName: before.supplier.legalName, kind: 'CANCELLED', now });
      await transaction.supplierReminderDelivery.create({ data: cancellation });
    }
    if (action === 'RESCHEDULE' && previouslySent && after.reminderEmail) {
      const rescheduled = buildReminderDraft({ commitment: createdStateForReminder(after), projectName: before.project.name, supplierName: before.supplier.legalName, kind: 'RESCHEDULED', now });
      await transaction.supplierReminderDelivery.create({ data: rescheduled });
    }
    if (
      after.reminderEnabled
      && ['CONFIRMED', 'AT_RISK'].includes(after.status)
      && ['CONFIRM', 'RESCHEDULE'].includes(action)
    ) {
      const upcoming = buildReminderDraft({ commitment: createdStateForReminder(after), projectName: before.project.name, supplierName: before.supplier.legalName, now });
      if (upcoming && !(action === 'RESCHEDULE' && previouslySent && upcoming.kind === 'LATE_SCHEDULED')) {
        await transaction.supplierReminderDelivery.create({ data: upcoming });
      }
    }
    await transaction.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: actor,
        action: `supplier_commitment.${action.toLowerCase()}`,
        entityType: 'SupplierCommitment',
        entityId: id,
        metadata: {
          projectId: current.projectId,
          revision: nextRevision,
          previousStatus: before.status,
          nextStatus: after.status,
          previousStartsOn: civilDateKey(before.startsOn),
          nextStartsOn: civilDateKey(after.startsOn),
          reason,
        },
      },
    });
    const persisted = await transaction.supplierCommitment.findFirst({
      where: { id, organizationId: current.organizationId, projectId: current.projectId },
      include: commitmentInclude(),
    });
    return { commitment: serializeSupplierCommitment(persisted, { now }), replayed: false };
  });
}

export function supplierCommitmentErrorResponse(error) {
  if (!(error instanceof SupplierCommitmentError)) return null;
  return Response.json({ error: error.message, code: error.code }, { status: error.status });
}
