import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  WEBHOOK_LEASE_MS,
  createMessageWebhookOutcome,
  isWebhookEventEligible,
  readAppliedMessageWebhookOutcome,
  scopedWebhookExternalId,
  serializeWebhookPayload,
  shouldDeadLetterWebhookEvent,
  webhookFailureTransition,
} from "@/lib/webhook-queue";
import {
  FIELD_WORKER_RESOLUTION,
  resolveActiveFieldWorkerById,
  resolveActiveFieldWorkerByPhone,
} from "@/lib/field-workers";
import { assertProjectStateVersion } from "@/lib/project-state";
import {
  lockProjectTransaction,
  requireOperationalProjectWrite,
} from "@/lib/project-write-policy";
import { sanitizeMessagesForMedicalPrivacy } from "@/lib/medical-privacy";
import { resolveWhatsAppConnectionScopes } from "@/lib/whatsapp/webhook-scope";
import { persistDurableMetaWebhookBatch } from "@/lib/whatsapp/webhook-ingress";

const LOCAL_DB_PATH = path.join(process.cwd(), "data", "db.json");
const LOCAL_CONVERSATION_ID = "dashboard-demo";

export const emptyAppState = Object.freeze({
  operariosCount: 0,
  avancePercentage: 0,
  alertsCount: 0,
  diasEstimados: "",
  tasks: Object.freeze({}),
  incidents: Object.freeze([]),
  attendance: Object.freeze({}),
  stockpiles: Object.freeze({}),
  hrAttendance: Object.freeze({}),
  hrBonuses: Object.freeze([]),
});

export function createEmptyAppState() {
  return clone(emptyAppState);
}

const initialIncidents = [
  {
    id: "inc-1",
    title: "Quiebre de stock crítico",
    description:
      "Cemento por debajo del mínimo de seguridad. Requiere validación antes de emitir una orden de compra.",
    type: "warning",
    badge: "Stock bajo",
    timestamp: "Hoy, 08:30",
    reporter: "Control de acopio",
    icon: "fa-solid fa-triangle-exclamation",
  },
  {
    id: "inc-2",
    title: "Alerta de geocerca",
    description:
      "Un fichaje fue registrado fuera del radio configurado para la obra y quedó pendiente de revisión.",
    type: "critical",
    badge: "Desvío GPS",
    timestamp: "Hoy, 07:50",
    reporter: "Geolocalización",
    icon: "fa-solid fa-location-crosshairs",
  },
  {
    id: "inc-3",
    title: "Asistencia registrada",
    description: "Juan Gómez inició su jornada desde el acceso móvil de la obra.",
    type: "success",
    badge: "Presentismo",
    timestamp: "Hoy, 08:02",
    reporter: "Asistente de obra",
    icon: "fa-solid fa-user-check",
  },
  {
    id: "inc-4",
    title: "Planificación sincronizada",
    description: "La línea base fue reajustada y el cambio quedó registrado en la bitácora.",
    type: "info",
    badge: "Gantt",
    timestamp: "Ayer, 18:15",
    reporter: "Planificación",
    icon: "fa-solid fa-chart-gantt",
  },
];

const localDevelopmentDemoAppState = {
  operariosCount: 1,
  avancePercentage: 42,
  alertsCount: 2,
  diasEstimados: "Día 12/35",
  tasks: {
    1: { name: "Revoque grueso", progress: 80, duration: 5, startOffset: 0, assignee: "Juan Gómez" },
    2: { name: "Cañería y descargas", progress: 20, duration: 4, startOffset: 28.5, assignee: "Luis Martínez" },
    3: { name: "Revestimiento cerámico", progress: 0, duration: 4, startOffset: 57.1, assignee: "Carlos Pérez" },
    4: { name: "Pintura y terminación", progress: 0, duration: 2, startOffset: 85.7, assignee: "Carlos Pérez" },
  },
  incidents: initialIncidents,
  attendance: {
    "Juan Gómez": { role: "Albañilería principal", checkin: "08:02", status: "Presente" },
    "Carlos Pérez": { role: "Pintura e interiores", checkin: "--:--", status: "Ausente" },
    "Luis Martínez": { role: "Instalaciones sanitarias", checkin: "--:--", status: "Ausente" },
  },
  stockpiles: {
    cemento: { name: "Cemento", current: 35, min: 40, max: 150, unit: "Bolsas", supplier: "Proveedor asignado", status: "Crítico" },
    hierro: { name: "Hierro A500", current: 85, min: 30, max: 100, unit: "Barras", supplier: "Proveedor asignado", status: "Stock OK" },
    ladrillo: { name: "Ladrillo portante", current: 1500, min: 800, max: 2500, unit: "Uds", supplier: "Proveedor asignado", status: "Stock OK" },
    arena: { name: "Arena fina", current: 4, min: 8, max: 20, unit: "m³", supplier: "Proveedor asignado", status: "En camino" },
  },
  hrAttendance: {
    "Juan Gómez": { role: "Albañilería principal", presents: 21, excused: 1, unexcused: 0, status: "Presente" },
    "Carlos Pérez": { role: "Pintura e interiores", presents: 15, excused: 2, unexcused: 5, status: "Ausente" },
    "Luis Martínez": { role: "Instalaciones sanitarias", presents: 18, excused: 3, unexcused: 1, status: "Ausente" },
  },
  hrBonuses: [],
};

export const defaultMessages = [
  {
    sender: "bot",
    text: "Hola. Soy el asistente de ObraSaaS. Puedo registrar avances, novedades, asistencia y evidencias de obra.",
    time: "08:00",
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function redactedWebhookPayload() {
  return { version: 1, redacted: true };
}

const MESSAGE_KINDS = new Set([
  "TEXT",
  "IMAGE",
  "AUDIO",
  "VIDEO",
  "DOCUMENT",
  "LOCATION",
  "INTERACTIVE",
  "SYSTEM",
]);

function normalizeMessageKind(kind, sender) {
  const normalized = String(kind || "").toUpperCase();
  if (normalized === "STICKER") return "IMAGE";
  if (MESSAGE_KINDS.has(normalized)) return normalized;
  return sender === "bot" && normalized === "SYSTEM" ? "SYSTEM" : "TEXT";
}

function storedMessageMetadata(message) {
  const metadata = message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
    ? { ...message.metadata }
    : {};
  metadata.time = message.time || metadata.time || null;
  if (message.media) metadata.media = message.media;
  if (message.transcription) metadata.transcription = message.transcription;
  return clone(metadata);
}

function storedMessageDate(value, fallback) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function durableMessageData(message, conversationId, fallbackDate) {
  return {
    conversationId,
    externalId: message.externalId || null,
    direction: message.sender === "bot" ? "OUTBOUND" : "INBOUND",
    kind: normalizeMessageKind(message.kind, message.sender),
    body: message.text || "",
    mediaUrl: message.mediaUrl || message.media?.url || null,
    status: message.status || null,
    metadata: storedMessageMetadata(message),
    sentAt: storedMessageDate(message.sentAt, fallbackDate),
  };
}

function hasDurableDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function assertLocalStorageAllowed() {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production; local JSON storage is development-only.");
  }
}

function initLocalDb() {
  assertLocalStorageAllowed();
  const dir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.writeFileSync(
      LOCAL_DB_PATH,
      JSON.stringify(
        {
          appState: clone(localDevelopmentDemoAppState),
          messages: clone(defaultMessages),
          webhookEvents: [],
        },
        null,
        2,
      ),
    );
  }
}

function readLocalDb() {
  initLocalDb();
  try {
    return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
  } catch {
    return {
      appState: clone(localDevelopmentDemoAppState),
      messages: clone(defaultMessages),
      webhookEvents: [],
    };
  }
}

function writeLocalDb(data) {
  initLocalDb();
  const temporaryPath = `${LOCAL_DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2));
  fs.renameSync(temporaryPath, LOCAL_DB_PATH);
}

async function durableContext(scope) {
  const { getPrisma } = await import("@/lib/prisma");
  const prisma = getPrisma();

  if (scope?.organization?.id && scope?.project?.id) {
    const project = await prisma.project.findFirst({
      where: {
        id: scope.project.id,
        organizationId: scope.organization.id,
      },
      include: { organization: true, whatsapp: true },
    });
    if (!project) throw new Error("The selected project does not belong to the active organization.");
    const expectedOrganizationId = typeof scope.organizationId === "string"
      ? scope.organizationId.trim()
      : "";
    if (expectedOrganizationId && project.organizationId !== expectedOrganizationId) {
      throw new Error("The selected project does not belong to the trusted organization scope.");
    }
    const expectedPhoneNumberId = typeof scope.phoneNumberId === "string"
      ? scope.phoneNumberId.trim()
      : "";
    if (
      expectedPhoneNumberId
      && (
        !project.whatsapp?.enabled
        || project.whatsapp.phoneNumberId !== expectedPhoneNumberId
      )
    ) {
      throw new Error("The selected project does not belong to the trusted WhatsApp connection scope.");
    }
    return {
      prisma,
      organization: project.organization,
      project,
      whatsappConnection: project.whatsapp || undefined,
    };
  }

  if (scope?.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: String(scope.projectId) },
      include: { organization: true, whatsapp: true },
    });
    if (!project) throw new Error("Unknown project scope.");
    const expectedOrganizationId = typeof scope.organizationId === "string"
      ? scope.organizationId.trim()
      : "";
    if (expectedOrganizationId && project.organizationId !== expectedOrganizationId) {
      throw new Error("The selected project does not belong to the trusted organization scope.");
    }
    const expectedPhoneNumberId = typeof scope.phoneNumberId === "string"
      ? scope.phoneNumberId.trim()
      : "";
    if (
      expectedPhoneNumberId
      && (
        !project.whatsapp?.enabled
        || project.whatsapp.phoneNumberId !== expectedPhoneNumberId
      )
    ) {
      throw new Error("The selected project does not belong to the trusted WhatsApp connection scope.");
    }
    return {
      prisma,
      organization: project.organization,
      project,
      whatsappConnection: project.whatsapp || undefined,
    };
  }

  if (scope?.phoneNumberId) {
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { phoneNumberId: String(scope.phoneNumberId) },
      include: { project: { include: { organization: true } } },
    });
    if (!connection?.enabled) throw new Error("Unknown or disabled WhatsApp connection.");
    const expectedOrganizationId = typeof scope.organizationId === "string"
      ? scope.organizationId.trim()
      : "";
    if (expectedOrganizationId && connection.project.organizationId !== expectedOrganizationId) {
      throw new Error("The WhatsApp connection does not belong to the trusted organization scope.");
    }
    return {
      prisma,
      organization: connection.project.organization,
      project: connection.project,
      whatsappConnection: connection,
    };
  }

  throw new Error("A trusted tenant or integration scope is required for durable data access.");
}

async function durableConversation(context) {
  return context.prisma.conversation.upsert({
    where: {
      projectId_channel_externalId: {
        projectId: context.project.id,
        channel: "whatsapp",
        externalId: LOCAL_CONVERSATION_ID,
      },
    },
    update: {},
    create: {
      projectId: context.project.id,
      channel: "whatsapp",
      externalId: LOCAL_CONVERSATION_ID,
      displayName: "Bitácora principal",
    },
  });
}

function localProjectStateSnapshot(db) {
  const numericVersion = Number(db.appStateVersion);
  const version = Number.isSafeInteger(numericVersion) && numericVersion >= 0
    ? numericVersion
    : 0;
  const parsedUpdatedAt = db.appStateUpdatedAt ? new Date(db.appStateUpdatedAt) : null;
  return {
    state: db.appState || clone(localDevelopmentDemoAppState),
    version,
    updatedAt: parsedUpdatedAt && !Number.isNaN(parsedUpdatedAt.getTime()) ? parsedUpdatedAt : null,
    exists: Object.hasOwn(db, "appState"),
  };
}

export async function getAppStateSnapshot(scope) {
  if (!hasDurableDatabase()) return localProjectStateSnapshot(readLocalDb());

  const { prisma, project } = await durableContext(scope);
  const snapshot = await prisma.projectSnapshot.findUnique({
    where: { projectId: project.id },
    select: { state: true, version: true, updatedAt: true },
  });
  return snapshot
    ? { ...snapshot, exists: true }
    : { state: createEmptyAppState(), version: 0, updatedAt: null, exists: false };
}

export async function getAppState(scope) {
  const snapshot = await getAppStateSnapshot(scope);
  return snapshot.state;
}

function auditActivityData(activity, context, scope) {
  return {
    organizationId: context.organization.id,
    actorId: scope?.databaseUserId || null,
    action: String(activity.action || 'project.state.updated').slice(0, 160),
    entityType: 'ProjectActivity',
    entityId: context.project.id,
    metadata: {
      projectId: context.project.id,
      category: String(activity.category || 'SYSTEM').slice(0, 40),
      severity: String(activity.severity || 'INFO').slice(0, 20),
      source: String(activity.source || 'system').slice(0, 40),
      title: String(activity.title || 'Actividad de obra').slice(0, 500),
      description: String(activity.description || '').slice(0, 2_000),
      details: activity.metadata && typeof activity.metadata === 'object'
        ? clone(activity.metadata)
        : null,
    },
  };
}

export async function persistProjectStateTransaction(transaction, {
  context,
  scope,
  state,
  expectedVersion = null,
  activities = [],
  deriveActivities = null,
}) {
  await requireOperationalProjectWrite(transaction, {
    organizationId: context.organization?.id || context.project.organizationId,
    projectId: context.project.id,
  });

  const current = await transaction.projectSnapshot.findUnique({
    where: { projectId: context.project.id },
    select: { state: true, version: true, updatedAt: true },
  });
  const currentVersion = assertProjectStateVersion(expectedVersion, current?.version ?? 0);
  const currentState = current?.state || createEmptyAppState();
  const derivedActivities = typeof deriveActivities === "function"
    ? deriveActivities(currentState, state)
    : [];
  const auditActivities = [
    ...(Array.isArray(activities) ? activities : []),
    ...(Array.isArray(derivedActivities) ? derivedActivities : []),
  ];
  const nextVersion = currentVersion + 1;
  const stored = await transaction.projectSnapshot.upsert({
    where: { projectId: context.project.id },
    update: { state, version: nextVersion },
    create: { projectId: context.project.id, state, version: nextVersion },
    select: { state: true, version: true, updatedAt: true },
  });
  if (auditActivities.length > 0) {
    await transaction.auditLog.createMany({
      data: auditActivities.map((activity) => auditActivityData(activity, context, scope)),
    });
  }
  return { ...stored, exists: true };
}

export async function saveAppStateSnapshot(state, scope, {
  activities = [],
  expectedVersion = null,
  deriveActivities = null,
} = {}) {
  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const current = localProjectStateSnapshot(db);
    const currentVersion = assertProjectStateVersion(expectedVersion, current.version);
    const derivedActivities = typeof deriveActivities === "function"
      ? deriveActivities(current.state, state)
      : [];
    const auditActivities = [
      ...(Array.isArray(activities) ? activities : []),
      ...(Array.isArray(derivedActivities) ? derivedActivities : []),
    ];
    const updatedAt = new Date();
    db.appState = clone(state);
    db.appStateVersion = currentVersion + 1;
    db.appStateUpdatedAt = updatedAt.toISOString();
    db.activities ||= [];
    db.activities.push(...auditActivities.map((activity, index) => ({
      id: `local-activity-${Date.now()}-${index}`,
      ...clone(activity),
      createdAt: new Date().toISOString(),
    })));
    db.activities = db.activities.slice(-500);
    writeLocalDb(db);
    return {
      state: clone(state),
      version: db.appStateVersion,
      updatedAt,
      exists: true,
    };
  }

  const context = await durableContext(scope);
  return context.prisma.$transaction((transaction) => persistProjectStateTransaction(transaction, {
    context,
    scope,
    state,
    expectedVersion,
    activities,
    deriveActivities,
  }));
}

export async function saveAppState(state, scope, options = {}) {
  const snapshot = await saveAppStateSnapshot(state, scope, options);
  return snapshot.state;
}

export async function getMessages(scope, { includeMedicalEvidence = false } = {}) {
  if (!hasDurableDatabase()) {
    return sanitizeMessagesForMedicalPrivacy(
      readLocalDb().messages || clone(defaultMessages),
      { includeMedicalEvidence },
    );
  }

  const context = await durableContext(scope);
  const conversation = await durableConversation(context);
  let messages = await context.prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  if (messages.length === 0) {
    await context.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        kind: "SYSTEM",
        body: defaultMessages[0].text,
        metadata: { time: defaultMessages[0].time },
      },
    });
    messages = await context.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
  }

  messages.reverse();

  const serialized = messages.map((message) => {
    const metadata = message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
      ? message.metadata
      : {};
    return {
      id: message.id,
      externalId: message.externalId,
      sender: message.direction === "OUTBOUND" ? "bot" : "user",
      kind: message.kind.toLowerCase(),
      text: message.body || "",
      mediaUrl: message.mediaUrl,
      media: metadata.media || null,
      transcription: metadata.transcription || null,
      status: message.status,
      metadata,
      sentAt: message.sentAt.toISOString(),
      time: metadata.time || message.sentAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    };
  });
  return sanitizeMessagesForMedicalPrivacy(serialized, { includeMedicalEvidence });
}

async function replaceDurableMessages(context, messages) {
  const conversation = await durableConversation(context);
  await context.prisma.message.deleteMany({ where: { conversationId: conversation.id } });
  if (messages.length > 0) {
    await context.prisma.message.createMany({
      data: messages.map((message, index) => durableMessageData(
        message,
        conversation.id,
        new Date(Date.now() + index),
      )),
    });
  }
}

export async function saveMessages(messages, scope) {
  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    db.messages = messages;
    writeLocalDb(db);
    return messages;
  }

  const context = await durableContext(scope);
  await context.prisma.$transaction(async (transaction) => {
    await requireOperationalProjectWrite(transaction, {
      organizationId: context.organization.id,
      projectId: context.project.id,
    });
    await replaceDurableMessages({ ...context, prisma: transaction }, messages);
  });
  return messages;
}

async function appendDurableMessages(context, messages) {
  const conversation = await durableConversation(context);
  for (const [index, message] of messages.entries()) {
    const data = durableMessageData(
      message,
      conversation.id,
      new Date(Date.now() + index),
    );
    if (!data.externalId) {
      await context.prisma.message.create({ data });
      continue;
    }

    const existing = await context.prisma.message.findUnique({
      where: { externalId: data.externalId },
      select: { id: true, conversationId: true },
    });
    if (existing && existing.conversationId !== conversation.id) {
      throw new Error("Message external ID collision across tenant conversations.");
    }
    if (existing) {
      const update = { ...data };
      delete update.conversationId;
      delete update.externalId;
      await context.prisma.message.update({ where: { id: existing.id }, data: update });
    } else {
      await context.prisma.message.create({ data });
    }
  }
  return messages;
}

export async function appendMessages(messages, scope) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const current = Array.isArray(db.messages) ? db.messages : [];
    for (const message of messages) {
      const existingIndex = message.externalId
        ? current.findIndex((item) => item.externalId === message.externalId)
        : -1;
      if (existingIndex >= 0) current[existingIndex] = message;
      else current.push(message);
    }
    db.messages = current.slice(-200);
    writeLocalDb(db);
    return messages;
  }

  const context = await durableContext(scope);
  await context.prisma.$transaction(async (transaction) => {
    await appendDurableMessages({ ...context, prisma: transaction }, messages);
  });
  return messages;
}

export class DirectObraMessageError extends Error {
  constructor(message, code, status = 500) {
    super(message);
    this.name = "DirectObraMessageError";
    this.code = code;
    this.status = status;
  }
}

function directObraMessageInput({ event, scope, workerId, apply, beforeApply, operation }) {
  const normalized = {
    projectId: String(scope?.project?.id || scope?.projectId || "").trim(),
    organizationId: String(scope?.organization?.id || scope?.organizationId || "").trim() || null,
    workerId: String(workerId || "").trim(),
  };
  if (
    !normalized.projectId
    || !normalized.workerId
    || !event
    || typeof event !== "object"
    || Array.isArray(event)
    || typeof apply !== "function"
    || (beforeApply != null && typeof beforeApply !== "function")
  ) {
    throw new DirectObraMessageError(
      "A trusted project, active worker, event and application callback are required.",
      "DIRECT_MESSAGE_INPUT_INVALID",
      400,
    );
  }

  if (operation == null) return { ...normalized, operation: null };
  const operationId = String(operation.id || "").trim();
  const operationAction = String(operation.action || "").trim();
  if (
    !operationId
    || operationId.length > 190
    || !operationAction
    || operationAction.length > 160
  ) {
    throw new DirectObraMessageError(
      "The direct-message idempotency operation is invalid.",
      "DIRECT_OPERATION_INVALID",
      400,
    );
  }
  return {
    ...normalized,
    operation: { id: operationId, action: operationAction },
  };
}

function readDirectOperationOutcome(record, { operation, project, worker }) {
  if (!record) return null;
  const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
    ? record.metadata
    : {};
  const outcome = metadata.outcome && typeof metadata.outcome === "object" && !Array.isArray(metadata.outcome)
    ? metadata.outcome
    : null;
  if (
    record.organizationId !== project.organizationId
    || record.action !== operation.action
    || record.entityType !== "Worker"
    || record.entityId !== worker.id
    || metadata.projectId !== project.id
    || typeof outcome?.reply !== "string"
  ) {
    throw new DirectObraMessageError(
      "A prior direct-message operation has an invalid or conflicting outcome.",
      "DIRECT_OPERATION_OUTCOME_INVALID",
      409,
    );
  }
  return {
    reply: outcome.reply,
    flowPrompt: typeof outcome.flowPrompt === "string" ? outcome.flowPrompt : null,
    intent: typeof outcome.intent === "string" ? outcome.intent : null,
    stateChanged: false,
    newMessages: [],
    worker,
  };
}

function storedDirectOperationOutcome(result) {
  return {
    reply: String(result.reply || "").slice(0, 4_000),
    flowPrompt: typeof result.flowPrompt === "string" ? result.flowPrompt.slice(0, 160) : null,
    intent: typeof result.intent === "string" ? result.intent.slice(0, 160) : null,
  };
}

export async function applyDirectObraMessageAtomically({
  event,
  scope,
  workerId,
  apply,
  beforeApply = null,
  operation = null,
}) {
  const normalized = directObraMessageInput({
    event,
    scope,
    workerId,
    apply,
    beforeApply,
    operation,
  });
  if (!hasDurableDatabase()) {
    throw new DirectObraMessageError(
      "Direct message processing requires durable storage.",
      "DIRECT_DURABLE_STORAGE_REQUIRED",
      503,
    );
  }

  const { getPrisma } = await import("@/lib/prisma");
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    await lockProjectTransaction(transaction, normalized.projectId);

    const project = await transaction.project.findFirst({
      where: {
        id: normalized.projectId,
        status: "ACTIVE",
        ...(normalized.organizationId ? { organizationId: normalized.organizationId } : {}),
      },
      select: {
        id: true,
        organizationId: true,
        latitude: true,
        longitude: true,
        geofenceMeters: true,
        snapshot: { select: { state: true, version: true } },
      },
    });
    if (!project) {
      throw new DirectObraMessageError(
        "The project is unavailable for direct field messages.",
        "DIRECT_PROJECT_UNAVAILABLE",
        403,
      );
    }

    const resolution = await resolveActiveFieldWorkerById(
      transaction,
      { organizationId: project.organizationId, projectId: project.id },
      normalized.workerId,
    );
    if (resolution.status !== FIELD_WORKER_RESOLUTION.RESOLVED) {
      throw new DirectObraMessageError(
        "The field worker is no longer active in this project.",
        "FIELD_WORKER_REQUIRED",
        403,
      );
    }
    const worker = resolution.worker;

    if (normalized.operation) {
      const priorOperation = await transaction.auditLog.findUnique({
        where: { id: normalized.operation.id },
        select: {
          organizationId: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
        },
      });
      const priorResult = readDirectOperationOutcome(priorOperation, {
        operation: normalized.operation,
        project,
        worker,
      });
      if (priorResult) return { alreadyApplied: true, result: priorResult };
    }

    if (beforeApply) {
      await beforeApply({ prisma: transaction, project, worker });
    }
    const state = project.snapshot?.state
      ? clone(project.snapshot.state)
      : createEmptyAppState();
    const projectSettings = {
      id: project.id,
      latitude: project.latitude == null ? null : Number(project.latitude),
      longitude: project.longitude == null ? null : Number(project.longitude),
      geofenceMeters: project.geofenceMeters,
    };
    const trustedEvent = {
      ...event,
      from: worker.phone,
      displayName: worker.name,
    };
    const result = await apply({
      prisma: transaction,
      state,
      projectSettings,
      worker,
      event: trustedEvent,
    });
    if (!result || typeof result.reply !== "string" || !Array.isArray(result.newMessages)) {
      throw new DirectObraMessageError(
        "The ObraSaaS engine did not return persistable direct-message effects.",
        "DIRECT_MESSAGE_OUTCOME_INVALID",
      );
    }

    if (result.stateChanged) {
      const nextVersion = (project.snapshot?.version ?? 0) + 1;
      await transaction.projectSnapshot.upsert({
        where: { projectId: project.id },
        update: { state, version: nextVersion },
        create: { projectId: project.id, state, version: nextVersion },
      });
    }
    await appendDurableMessages(
      { prisma: transaction, project },
      result.newMessages,
    );

    if (normalized.operation) {
      await transaction.auditLog.create({
        data: {
          id: normalized.operation.id,
          organizationId: project.organizationId,
          action: normalized.operation.action,
          entityType: "Worker",
          entityId: worker.id,
          metadata: {
            projectId: project.id,
            outcome: storedDirectOperationOutcome(result),
          },
        },
      });
    }
    return { alreadyApplied: false, result };
  }, { maxWait: 5_000, timeout: 20_000 });
}

function webhookProcessingError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function atomicWebhookInput({ eventId, leaseToken, event, scope, apply }) {
  const normalized = {
    eventId: typeof eventId === "string" ? eventId.trim() : "",
    leaseToken: typeof leaseToken === "string" ? leaseToken.trim() : "",
    projectId: typeof scope?.projectId === "string" ? scope.projectId.trim() : "",
    organizationId: typeof scope?.organizationId === "string" ? scope.organizationId.trim() : "",
    phoneNumberId: typeof scope?.phoneNumberId === "string" ? scope.phoneNumberId.trim() : "",
  };
  if (
    !normalized.eventId
    || !normalized.leaseToken
    || !normalized.projectId
    || !normalized.organizationId
    || !normalized.phoneNumberId
    || event?.eventType !== "message"
    || typeof event?.from !== "string"
    || typeof apply !== "function"
  ) {
    throw webhookProcessingError(
      "A leased message event, trusted tenant scope and application callback are required.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  if (String(event.phoneNumberId || "").trim() !== normalized.phoneNumberId) {
    throw webhookProcessingError(
      "Stored webhook phone scope does not match its normalized message event.",
      "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
    );
  }
  return normalized;
}

function fieldWorkerResolutionError(status) {
  return webhookProcessingError(
    `WhatsApp sender could not be resolved as an active field worker: ${status}`,
    `FIELD_WORKER_${status}`,
  );
}

export async function applyWebhookMessageAtomically({
  eventId,
  leaseToken,
  event,
  scope,
  apply,
}) {
  const normalized = atomicWebhookInput({ eventId, leaseToken, event, scope, apply });
  if (!hasDurableDatabase()) {
    throw webhookProcessingError(
      "Durable webhook processing requires DATABASE_URL.",
      "WEBHOOK_DURABLE_STORAGE_REQUIRED",
    );
  }

  const { getPrisma } = await import("@/lib/prisma");
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    await lockProjectTransaction(transaction, normalized.projectId);

    const leasedEvent = await transaction.webhookEvent.findFirst({
      where: {
        id: normalized.eventId,
        projectId: normalized.projectId,
        eventType: "message",
        status: "PROCESSING",
        leaseToken: normalized.leaseToken,
      },
      select: {
        id: true,
        appliedAt: true,
        outcome: true,
      },
    });
    if (!leasedEvent) {
      throw webhookProcessingError(
        "The webhook lease changed before its internal effects were committed.",
        "WEBHOOK_LEASE_LOST",
      );
    }

    const priorOutcome = readAppliedMessageWebhookOutcome(leasedEvent);
    if (priorOutcome) {
      const accepted = await transaction.webhookEvent.updateMany({
        where: {
          id: normalized.eventId,
          projectId: normalized.projectId,
          eventType: "message",
          status: "PROCESSING",
          leaseToken: normalized.leaseToken,
          appliedAt: { not: null },
        },
        data: { lastError: null },
      });
      if (accepted.count !== 1) {
        throw webhookProcessingError(
          "The webhook lease changed before its stored outcome could be reused.",
          "WEBHOOK_LEASE_LOST",
        );
      }
      return { alreadyApplied: true, outcome: priorOutcome };
    }

    // Message ingress already required an ACTIVE project. A later pause does
    // not invalidate a durably accepted event, but tenant ownership and the
    // exact enabled WhatsApp connection are revalidated under the project lock.
    const project = await transaction.project.findFirst({
      where: {
        id: normalized.projectId,
        organizationId: normalized.organizationId,
      },
      select: {
        id: true,
        organizationId: true,
        latitude: true,
        longitude: true,
        geofenceMeters: true,
        snapshot: { select: { state: true } },
        whatsapp: {
          select: { phoneNumberId: true, enabled: true },
        },
      },
    });
    if (!project) {
      throw webhookProcessingError(
        "Stored webhook scope does not belong to the selected tenant project.",
        "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
      );
    }
    if (
      !project.whatsapp?.enabled
      || project.whatsapp.phoneNumberId !== normalized.phoneNumberId
    ) {
      throw webhookProcessingError(
        "Stored webhook scope does not belong to the enabled project WhatsApp connection.",
        "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
      );
    }

    const resolution = await resolveActiveFieldWorkerByPhone(
      transaction,
      {
        organizationId: normalized.organizationId,
        projectId: normalized.projectId,
      },
      event.from,
    );
    if (resolution.status !== FIELD_WORKER_RESOLUTION.RESOLVED) {
      throw fieldWorkerResolutionError(resolution.status);
    }

    const state = project.snapshot?.state
      ? clone(project.snapshot.state)
      : createEmptyAppState();
    const projectSettings = {
      id: project.id,
      latitude: project.latitude == null ? null : Number(project.latitude),
      longitude: project.longitude == null ? null : Number(project.longitude),
      geofenceMeters: project.geofenceMeters,
    };
    const result = await apply({
      prisma: transaction,
      state,
      projectSettings,
      worker: resolution.worker,
    });
    if (!result || !Array.isArray(result.newMessages)) {
      throw webhookProcessingError(
        "The WhatsApp engine did not return persistable message effects.",
        "WEBHOOK_OUTCOME_INVALID",
      );
    }
    const outcome = createMessageWebhookOutcome(result);

    if (result.stateChanged) {
      await transaction.projectSnapshot.upsert({
        where: { projectId: project.id },
        update: { state, version: { increment: 1 } },
        create: { projectId: project.id, state },
      });
    }
    await appendDurableMessages(
      { prisma: transaction, project },
      result.newMessages,
    );

    const appliedAt = new Date();
    const accepted = await transaction.webhookEvent.updateMany({
      where: {
        id: normalized.eventId,
        projectId: normalized.projectId,
        eventType: "message",
        status: "PROCESSING",
        leaseToken: normalized.leaseToken,
        appliedAt: null,
      },
      data: {
        appliedAt,
        outcome,
        lastError: null,
      },
    });
    if (accepted.count !== 1) {
      throw webhookProcessingError(
        "The webhook lease changed while its internal effects were being applied.",
        "WEBHOOK_LEASE_LOST",
      );
    }
    return { alreadyApplied: false, outcome };
  }, { maxWait: 5_000, timeout: 20_000 });
}

export async function persistEnrichedWebhookEvent({
  eventId,
  leaseToken,
  event,
  scope,
}) {
  const normalizedEventId = typeof eventId === "string" ? eventId.trim() : "";
  const normalizedLeaseToken = typeof leaseToken === "string" ? leaseToken.trim() : "";
  if (!normalizedEventId || !normalizedLeaseToken || event?.eventType !== "message") {
    throw webhookProcessingError(
      "A leased message event is required before enriched media can be persisted.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  if (!hasDurableDatabase()) {
    throw webhookProcessingError(
      "Enriched webhook media requires durable storage.",
      "WEBHOOK_DURABLE_STORAGE_REQUIRED",
    );
  }

  const context = await durableContext(scope);
  const updated = await context.prisma.webhookEvent.updateMany({
    where: {
      id: normalizedEventId,
      projectId: context.project.id,
      eventType: "message",
      status: "PROCESSING",
      leaseToken: normalizedLeaseToken,
      appliedAt: null,
    },
    data: {
      payload: serializeWebhookPayload(event, scope),
      lastError: null,
    },
  });
  if (updated.count !== 1) {
    throw webhookProcessingError(
      "The webhook lease changed before enriched media was persisted.",
      "WEBHOOK_LEASE_LOST",
    );
  }
  return true;
}

export async function linkOutboundWhatsAppMessage({
  inboundExternalId,
  providerMessageId,
  scope,
  status = "accepted",
}) {
  const inboundId = typeof inboundExternalId === "string" ? inboundExternalId.trim() : "";
  const providerId = typeof providerMessageId === "string" ? providerMessageId.trim() : "";
  if (!inboundId || !providerId) return false;
  const outboundExternalId = `obrasaas-reply:${inboundId}`;

  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const messages = Array.isArray(db.messages) ? db.messages : [];
    const conflict = messages.find(
      (message) => message.providerMessageId === providerId && message.externalId !== outboundExternalId,
    );
    if (conflict) {
      const error = new Error("WhatsApp provider message ID belongs to another conversation.");
      error.code = "WEBHOOK_MESSAGE_SCOPE_MISMATCH";
      throw error;
    }
    const message = messages.find((item) => item.externalId === outboundExternalId);
    if (!message) return false;
    message.providerMessageId = providerId;
    message.status = String(status || "accepted").slice(0, 80);
    writeLocalDb(db);
    return true;
  }

  const context = await durableContext(scope);
  const conversation = await durableConversation(context);
  const [message, conflict] = await Promise.all([
    context.prisma.message.findUnique({
      where: { externalId: outboundExternalId },
      select: { id: true, conversationId: true },
    }),
    context.prisma.message.findUnique({
      where: { providerMessageId: providerId },
      select: { id: true, conversationId: true },
    }),
  ]);
  if (conflict && conflict.id !== message?.id) {
    const error = new Error("WhatsApp provider message ID belongs to another conversation.");
    error.code = "WEBHOOK_MESSAGE_SCOPE_MISMATCH";
    throw error;
  }
  if (!message) return false;
  if (message.conversationId !== conversation.id) {
    const error = new Error("Outbound WhatsApp message crossed its tenant conversation boundary.");
    error.code = "WEBHOOK_MESSAGE_SCOPE_MISMATCH";
    throw error;
  }
  await context.prisma.message.update({
    where: { id: message.id },
    data: {
      providerMessageId: providerId,
      status: String(status || "accepted").slice(0, 80),
    },
  });
  return true;
}

const WHATSAPP_DELIVERY_STATUS_RANK = Object.freeze({
  accepted: 1,
  sent: 2,
  delivered: 3,
  read: 4,
});

export function nextWhatsAppMessageStatus(currentStatus, incomingStatus) {
  const current = typeof currentStatus === "string" ? currentStatus.trim().toLowerCase() : "";
  const incoming = typeof incomingStatus === "string" ? incomingStatus.trim().toLowerCase() : "";
  if (!incoming) return current || null;
  if (!current) return incoming;
  if (incoming === current) return current;

  const currentRank = WHATSAPP_DELIVERY_STATUS_RANK[current] || 0;
  const incomingRank = WHATSAPP_DELIVERY_STATUS_RANK[incoming] || 0;
  if (incoming === "failed") {
    return currentRank >= WHATSAPP_DELIVERY_STATUS_RANK.delivered ? current : "failed";
  }
  if (current === "failed") {
    return incomingRank >= WHATSAPP_DELIVERY_STATUS_RANK.delivered ? incoming : current;
  }
  if (currentRank && incomingRank) return incomingRank >= currentRank ? incoming : current;
  if (currentRank) return current;
  if (incomingRank) return incoming;
  return current;
}

export async function updateWhatsAppMessageStatus({ providerMessageId, status, scope }) {
  const providerId = typeof providerMessageId === "string" ? providerMessageId.trim() : "";
  const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase().slice(0, 80) : "";
  if (!providerId || !normalizedStatus) return false;

  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const message = (db.messages || []).find((item) => item.providerMessageId === providerId);
    if (!message) return false;
    const nextStatus = nextWhatsAppMessageStatus(message.status, normalizedStatus);
    if (nextStatus !== message.status) {
      message.status = nextStatus;
      writeLocalDb(db);
    }
    return true;
  }

  const context = await durableContext(scope);
  return context.prisma.$transaction(async (transaction) => {
    await lockProjectTransaction(transaction, context.project.id);
    const conversation = await durableConversation({ ...context, prisma: transaction });
    const message = await transaction.message.findUnique({
      where: { providerMessageId: providerId },
      select: { id: true, conversationId: true, status: true },
    });
    if (!message) return false;
    if (message.conversationId !== conversation.id) {
      const error = new Error("WhatsApp delivery status crossed its tenant conversation boundary.");
      error.code = "WEBHOOK_MESSAGE_SCOPE_MISMATCH";
      throw error;
    }
    const nextStatus = nextWhatsAppMessageStatus(message.status, normalizedStatus);
    if (nextStatus !== message.status) {
      await transaction.message.update({
        where: { id: message.id },
        data: { status: nextStatus },
      });
    }
    return true;
  });
}

export async function storeWebhookEvent({ provider, externalId, eventType, payload, scope }) {
  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    db.webhookEvents ||= [];
    const existing = db.webhookEvents.find(
      (event) => event.provider === provider && event.externalId === externalId,
    );
    if (existing) {
      return {
        stored: false,
        eventId: existing.id,
        projectId: existing.projectId,
        status: existing.status,
      };
    }
    const event = {
      id: `local-webhook-${randomUUID()}`,
      projectId: scope?.projectId || scope?.phoneNumberId || "local-project",
      provider,
      externalId,
      eventType,
      payload,
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: new Date().toISOString(),
      leaseToken: null,
      leaseExpiresAt: null,
      appliedAt: null,
      outcome: null,
      lastError: null,
      processedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.webhookEvents.push(event);
    writeLocalDb(db);
    return { stored: true, eventId: event.id, projectId: event.projectId, status: event.status };
  }

  const { prisma, project } = await durableContext(scope);
  try {
    const event = await prisma.webhookEvent.create({
      data: { projectId: project.id, provider, externalId, eventType, payload },
    });
    return { stored: true, eventId: event.id, projectId: event.projectId, status: event.status };
  } catch (error) {
    if (error?.code === "P2002") {
      const existing = await prisma.webhookEvent.findUnique({
        where: { provider_externalId: { provider, externalId } },
        select: { id: true, projectId: true, status: true },
      });
      if (existing?.projectId && existing.projectId !== project.id) {
        throw new Error("Webhook external ID collision across tenant projects.");
      }
      return {
        stored: false,
        eventId: existing?.id || null,
        projectId: existing?.projectId || project.id,
        status: existing?.status || null,
      };
    }
    throw error;
  }
}

export async function storeMetaWebhookBatch({ events }) {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      accepted: 0,
      duplicate: 0,
      unknownConnections: 0,
      projectIds: [],
    };
  }

  if (!hasDurableDatabase()) {
    const projectIds = new Set();
    let accepted = 0;
    let duplicate = 0;
    let unknownConnections = 0;
    for (const event of events) {
      const scopes = await resolveWhatsAppScopes({
        eventType: event.eventType,
        phoneNumberId: event.phoneNumberId,
        whatsappBusinessId: event.whatsappBusinessId,
        displayPhoneNumber: event.displayPhoneNumber || event.businessDisplayPhone,
      });
      if (scopes.length === 0) {
        unknownConnections += 1;
        continue;
      }
      for (const scope of scopes) {
        const scopedEvent = { ...event, phoneNumberId: scope.phoneNumberId };
        const result = await storeWebhookEvent({
          provider: scopedEvent.provider,
          externalId: scopedWebhookExternalId(scope.projectId, scopedEvent.externalId),
          eventType: scopedEvent.eventType,
          payload: serializeWebhookPayload(scopedEvent, scope),
          scope,
        });
        if (result.projectId) projectIds.add(result.projectId);
        if (result.stored) accepted += 1;
        else duplicate += 1;
      }
    }
    return {
      accepted,
      duplicate,
      unknownConnections,
      projectIds: [...projectIds].sort(),
    };
  }

  const prisma = (await import("@/lib/prisma")).getPrisma();
  return persistDurableMetaWebhookBatch(prisma, events);
}

export async function acquireWebhookEvent({ projectId, now = new Date(), leaseMs = WEBHOOK_LEASE_MS }) {
  const leaseStartedAt = new Date(now);
  if (!projectId || Number.isNaN(leaseStartedAt.getTime())) {
    throw new Error("A project and valid lease time are required to acquire a webhook event.");
  }
  const leaseExpiresAt = new Date(leaseStartedAt.getTime() + leaseMs);

  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const events = (db.webhookEvents || [])
      .filter((event) => event.projectId === projectId && ["PENDING", "PROCESSING"].includes(event.status))
      .sort((left, right) => {
        const timeDifference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        return timeDifference || String(left.id).localeCompare(String(right.id));
      });
    const active = events.find(
      (event) => event.status === "PROCESSING"
        && event.leaseExpiresAt
        && new Date(event.leaseExpiresAt).getTime() > leaseStartedAt.getTime(),
    );
    if (active) return null;

    while (events.length > 0) {
      const event = events.shift();
      if (shouldDeadLetterWebhookEvent(event, leaseStartedAt)) {
        event.status = "FAILED";
        event.lastError ||= "Webhook lease expired after the maximum retry count.";
        event.payload = redactedWebhookPayload();
        if (!event.appliedAt) event.outcome = null;
        event.nextAttemptAt = null;
        event.leaseToken = null;
        event.leaseExpiresAt = null;
        event.updatedAt = leaseStartedAt.toISOString();
        continue;
      }
      if (!isWebhookEventEligible(event, leaseStartedAt)) {
        writeLocalDb(db);
        return null;
      }
      event.status = "PROCESSING";
      event.attempts = (event.attempts || 0) + 1;
      event.leaseToken = randomUUID();
      event.leaseExpiresAt = leaseExpiresAt.toISOString();
      event.updatedAt = leaseStartedAt.toISOString();
      writeLocalDb(db);
      return event;
    }
    writeLocalDb(db);
    return null;
  }

  const [{ getPrisma }, { Prisma }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/generated/prisma/client"),
  ]);
  const prisma = getPrisma();
  for (let guard = 0; guard < 5; guard += 1) {
    const active = await prisma.webhookEvent.findFirst({
      where: {
        projectId,
        status: "PROCESSING",
        leaseExpiresAt: { gt: leaseStartedAt },
      },
      select: { id: true },
    });
    if (active) return null;

    const event = await prisma.webhookEvent.findFirst({
      where: { projectId, status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!event) return null;

    if (shouldDeadLetterWebhookEvent(event, leaseStartedAt)) {
      const retired = await prisma.webhookEvent.updateMany({
        where: {
          id: event.id,
          status: event.status,
          attempts: event.attempts,
          leaseToken: event.leaseToken,
        },
        data: {
          status: "FAILED",
          lastError: event.lastError || "Webhook lease expired after the maximum retry count.",
          payload: redactedWebhookPayload(),
          ...(!event.appliedAt ? { outcome: Prisma.DbNull } : {}),
          nextAttemptAt: null,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      if (retired.count === 0) continue;
      continue;
    }
    if (!isWebhookEventEligible(event, leaseStartedAt)) return null;

    const leaseToken = randomUUID();
    const eligibility = event.status === "PENDING"
      ? { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: leaseStartedAt } }] }
      : {
          leaseToken: event.leaseToken,
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: leaseStartedAt } }],
        };
    const acquired = await prisma.webhookEvent.updateMany({
      where: {
        id: event.id,
        status: event.status,
        attempts: event.attempts,
        ...eligibility,
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        leaseToken,
        leaseExpiresAt,
      },
    });
    if (acquired.count === 0) continue;
    return prisma.webhookEvent.findUnique({ where: { id: event.id } });
  }
  return null;
}

export async function completeWebhookEvent({ eventId, leaseToken, now = new Date() }) {
  const completedAt = new Date(now);
  if (!eventId || !leaseToken || Number.isNaN(completedAt.getTime())) return false;

  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const event = db.webhookEvents?.find(
      (item) => item.id === eventId && item.status === "PROCESSING" && item.leaseToken === leaseToken,
    );
    if (!event) return false;
    event.status = "PROCESSED";
    event.lastError = null;
    event.payload = redactedWebhookPayload();
    event.outcome = null;
    event.nextAttemptAt = null;
    event.leaseToken = null;
    event.leaseExpiresAt = null;
    event.processedAt = completedAt.toISOString();
    event.updatedAt = completedAt.toISOString();
    writeLocalDb(db);
    return true;
  }

  const [{ getPrisma }, { Prisma }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/generated/prisma/client"),
  ]);
  const result = await getPrisma().webhookEvent.updateMany({
    where: { id: eventId, status: "PROCESSING", leaseToken },
    data: {
      status: "PROCESSED",
      lastError: null,
      payload: redactedWebhookPayload(),
      outcome: Prisma.DbNull,
      nextAttemptAt: null,
      leaseToken: null,
      leaseExpiresAt: null,
      processedAt: completedAt,
    },
  });
  return result.count === 1;
}

export async function rescheduleWebhookEvent({
  eventId,
  leaseToken,
  error,
  now = new Date(),
  terminal = false,
}) {
  const failedAt = new Date(now);
  if (!eventId || !leaseToken || Number.isNaN(failedAt.getTime())) return null;
  const errorCode = typeof error?.code === "string" ? error.code.slice(0, 120) : null;
  const errorMessage = error instanceof Error
    ? error.message
    : String(error || "Unknown processing error");
  const lastError = `${errorCode ? `[${errorCode}] ` : ""}${errorMessage}`.slice(0, 2_000);

  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const event = db.webhookEvents?.find(
      (item) => item.id === eventId && item.status === "PROCESSING" && item.leaseToken === leaseToken,
    );
    if (!event) return null;
    const transition = terminal
      ? { status: "FAILED", nextAttemptAt: null }
      : webhookFailureTransition({
          attempts: event.attempts,
          externalId: event.externalId,
          now: failedAt,
        });
    event.status = transition.status;
    event.lastError = lastError;
    if (transition.status === "FAILED") {
      event.payload = redactedWebhookPayload();
      if (!event.appliedAt) event.outcome = null;
    }
    event.nextAttemptAt = transition.nextAttemptAt?.toISOString() || null;
    event.leaseToken = null;
    event.leaseExpiresAt = null;
    event.updatedAt = failedAt.toISOString();
    writeLocalDb(db);
    return {
      status: transition.status,
      nextAttemptAt: transition.nextAttemptAt?.toISOString() || null,
    };
  }

  const [{ getPrisma }, { Prisma }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/generated/prisma/client"),
  ]);
  const prisma = getPrisma();
  const event = await prisma.webhookEvent.findFirst({
    where: { id: eventId, status: "PROCESSING", leaseToken },
    select: { id: true, attempts: true, externalId: true, appliedAt: true },
  });
  if (!event) return null;
  const transition = terminal
    ? { status: "FAILED", nextAttemptAt: null }
    : webhookFailureTransition({
        attempts: event.attempts,
        externalId: event.externalId,
        now: failedAt,
      });
  const result = await prisma.webhookEvent.updateMany({
    where: { id: eventId, status: "PROCESSING", leaseToken },
    data: {
      status: transition.status,
      lastError,
      ...(transition.status === "FAILED"
        ? {
            payload: redactedWebhookPayload(),
            ...(!event.appliedAt ? { outcome: Prisma.DbNull } : {}),
          }
        : {}),
      nextAttemptAt: transition.nextAttemptAt,
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  if (result.count !== 1) return null;
  return { status: transition.status, nextAttemptAt: transition.nextAttemptAt };
}

export async function listDueWebhookProjectIds({ now = new Date(), limit = 5 } = {}) {
  const currentTime = new Date(now);
  const normalizedLimit = Math.min(25, Math.max(1, Math.trunc(Number(limit) || 5)));
  if (Number.isNaN(currentTime.getTime())) {
    throw new Error("A valid time is required to list due webhook projects.");
  }

  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const candidates = (db.webhookEvents || [])
      .filter((event) => (
        event.projectId
        && (
          isWebhookEventEligible(event, currentTime)
          || shouldDeadLetterWebhookEvent(event, currentTime)
        )
      ))
      .sort((left, right) => (
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        || String(left.id).localeCompare(String(right.id))
      ));
    return [...new Set(candidates.map((event) => event.projectId))].slice(0, normalizedLimit);
  }

  const { getPrisma } = await import("@/lib/prisma");
  const projects = await getPrisma().webhookEvent.groupBy({
    by: ["projectId"],
    where: {
      projectId: { not: null },
      OR: [
        {
          status: "PENDING",
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: currentTime } }],
        },
        {
          status: "PROCESSING",
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: currentTime } }],
        },
      ],
    },
    _min: { createdAt: true },
    orderBy: { _min: { createdAt: "asc" } },
    take: normalizedLimit,
  });
  return projects.map((project) => project.projectId).filter(Boolean);
}

export async function resetState(scope, { expectedVersion = null } = {}) {
  const useDevelopmentDemo = !hasDurableDatabase();
  const fresh = {
    appState: useDevelopmentDemo
      ? clone(localDevelopmentDemoAppState)
      : createEmptyAppState(),
    messages: clone(defaultMessages),
  };
  if (useDevelopmentDemo) {
    const snapshot = await saveAppStateSnapshot(fresh.appState, scope, { expectedVersion });
    await saveMessages(fresh.messages, scope);
    return { ...fresh, snapshot, version: snapshot.version };
  }

  const context = await durableContext(scope);
  const snapshot = await context.prisma.$transaction(async (transaction) => {
    const transactionContext = { ...context, prisma: transaction };
    const stored = await persistProjectStateTransaction(transaction, {
      context: transactionContext,
      scope,
      state: fresh.appState,
      expectedVersion,
    });
    await replaceDurableMessages(transactionContext, fresh.messages);
    return stored;
  });
  return { ...fresh, snapshot, version: snapshot.version };
}

export async function resolveWhatsAppScope(phoneNumberId) {
  const scopes = await resolveWhatsAppScopes({ phoneNumberId });
  return scopes[0] || null;
}

export async function resolveWhatsAppScopes({
  eventType,
  phoneNumberId,
  whatsappBusinessId,
  displayPhoneNumber,
} = {}, { prisma: prismaOverride = null } = {}) {
  if (!phoneNumberId && !whatsappBusinessId && !displayPhoneNumber) return [];
  if (!prismaOverride && !hasDurableDatabase()) {
    return typeof phoneNumberId === "string" && phoneNumberId.trim()
      ? [{
          projectId: "local-project",
          organizationId: "local-organization",
          phoneNumberId: phoneNumberId.trim(),
        }]
      : [];
  }

  const prisma = prismaOverride || (await import("@/lib/prisma")).getPrisma();
  return resolveWhatsAppConnectionScopes(prisma, {
    eventType,
    phoneNumberId,
    whatsappBusinessId,
    displayPhoneNumber,
  });
}

export async function getProjectSettings(scope) {
  if (!hasDurableDatabase()) {
    return {
      id: "local-project",
      latitude: Number(process.env.PROJECT_LATITUDE || -34.5886),
      longitude: Number(process.env.PROJECT_LONGITUDE || -58.4302),
      geofenceMeters: Number(process.env.PROJECT_GEOFENCE_METERS || 100),
    };
  }

  const { project } = await durableContext(scope);
  return {
    id: project.id,
    latitude: project.latitude == null ? null : Number(project.latitude),
    longitude: project.longitude == null ? null : Number(project.longitude),
    geofenceMeters: project.geofenceMeters,
  };
}
