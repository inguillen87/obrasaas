import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  WEBHOOK_LEASE_MS,
  createMessageWebhookOutcome,
  deserializeWebhookPayload,
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
  synchronizeProjectTaskProjection,
} from "@/lib/project-tasks";
import {
  lockProjectTransaction,
  requireOperationalProjectWrite,
} from "@/lib/project-write-policy";
import {
  isMedicalEvidenceRecord,
  isRestrictedEvidenceRecord,
  isSensitiveMedicalText,
  sanitizeMessagesForMedicalPrivacy,
} from "@/lib/medical-privacy";
import { subscriptionAllowsWrites } from "@/lib/plans";
import { redactSensitiveText } from "@/lib/sensitive-text";
import {
  issueProgressEvidenceCaptureSession,
} from "@/lib/progress-evidence-capture-sessions";
import {
  getPublishedWhatsAppFlowReference,
  getWhatsAppFlowSessionTtlMs,
  validateWhatsAppFlowReply,
} from "@/lib/whatsapp/flows";
import { normalizeMetaProviderCode } from "@/lib/whatsapp/provider-failure";
import {
  consumeWhatsAppFlowSession,
  issueWhatsAppFlowSession,
} from "@/lib/whatsapp/flow-sessions";
import {
  assertWorkerPaymentFlowTerminalReceipt,
  issueWorkerPaymentFlowSessionInTransaction,
  WorkerPaymentFlowSessionError,
  WORKER_PAYMENT_FLOW_BLUEPRINT_KEY,
} from "@/lib/whatsapp/worker-payment-flow-sessions";
import { getCurrentWorkerPaymentPrivacyNotice } from "@/lib/worker-payment-privacy-notices";
import {
  issueWorkerPaymentPrivateReceiptInTransaction,
} from "@/lib/worker-payment-private-receipts";
import {
  consumeWorkerOnboardingFlowSession,
  WorkerOnboardingFlowSessionError,
} from "@/lib/whatsapp/worker-onboarding-flow-sessions";
import { whatsAppConversationIdentity } from "@/lib/whatsapp/inbox";
import {
  WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT,
  claimWhatsAppMediaAsset,
  resolveClaimedWhatsAppMessageMedia,
  whatsAppMediaAssetDescriptor,
  whatsAppMediaAssetHash,
} from "@/lib/whatsapp/media-assets";
import {
  PROGRESS_EVIDENCE_LOCATION_DURABLE_REPLY,
} from "@/lib/whatsapp/progress-evidence-location-delivery";
import {
  WORKER_PAYMENT_PRIVATE_RECEIPT_DURABLE_REPLY,
} from "@/lib/whatsapp/worker-payment-receipt-delivery";
import {
  extractSecureWebviewDelivery,
} from "@/lib/whatsapp/secure-webview-delivery";
import { resolveWhatsAppConnectionScopes } from "@/lib/whatsapp/webhook-scope";
import { persistDurableMetaWebhookBatch } from "@/lib/whatsapp/webhook-ingress";

const LOCAL_DB_PATH = path.join(process.cwd(), "data", "db.json");
const LOCAL_CONVERSATION_ID = "dashboard-demo";
const QUARANTINE_UNASSIGNED_MEDIA = Symbol.for(
  "obrasaas.whatsapp.quarantine-unassigned-media",
);

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
    body: redactSensitiveText(message.text || ""),
    mediaUrl: message.mediaUrl || message.media?.url || null,
    status: message.status || null,
    metadata: storedMessageMetadata(message),
    sentAt: storedMessageDate(message.sentAt, fallbackDate),
  };
}

function redactedStoredMessage(message) {
  return {
    ...message,
    text: redactSensitiveText(message?.text || ""),
  };
}

function managedWhatsAppMediaAssetId(event) {
  if (!event?.media || typeof event.media !== "object" || Array.isArray(event.media)) return null;
  const declared = Object.hasOwn(event.media, "assetId");
  const mediaAssetId = typeof event.media.assetId === "string"
    ? event.media.assetId.trim()
    : "";
  const ledgerAssetId = typeof event.media.storage?.ledgerAssetId === "string"
    ? event.media.storage.ledgerAssetId.trim()
    : "";
  if (!declared && !ledgerAssetId) return null;
  if (!mediaAssetId || ledgerAssetId !== mediaAssetId) {
    throw webhookProcessingError(
      "Managed WhatsApp media has an invalid durable asset reference.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  return mediaAssetId;
}

export function progressEvidenceLocationCaptureEligible(event, result, mediaAssetId) {
  const caption = typeof event?.text === "string"
    ? event.text.normalize("NFKC").trim()
    : "";
  if (
    !mediaAssetId
    || event?.provider !== "meta"
    || String(event?.kind || "").toLowerCase() !== "image"
    || Boolean(result?.flowPrompt)
    || !/^(?:AVANCE|PROGRESO)\s*:\s*\S/iu.test(caption)
  ) return false;
  const inbound = result?.newMessages?.find((message) => (
    message?.sender === "user" && message.externalId === event.externalId
  ));
  return inbound?.metadata?.authorized === true
    && inbound.metadata.sensitivity !== "medical";
}

function attachProgressEvidenceLocationPrompt(result, { session }) {
  const outboundExternalId = result.newMessages.find((message) => message?.sender === "bot")?.externalId;
  return {
    ...result,
    reply: PROGRESS_EVIDENCE_LOCATION_DURABLE_REPLY,
    progressEvidenceCaptureSessionId: session.id,
    progressEvidenceLocationDelivery: {
      version: 1,
      sessionId: session.id,
    },
    newMessages: result.newMessages.map((message) => (
      message?.sender === "bot" && message.externalId === outboundExternalId
        ? {
            ...message,
            text: PROGRESS_EVIDENCE_LOCATION_DURABLE_REPLY,
            metadata: {
              ...(message.metadata || {}),
              progressEvidenceLocationCapture: {
                sessionId: session.id,
                status: session.status,
                expiresAt: session.expiresAt?.toISOString?.() || String(session.expiresAt),
                deliveryContentRestricted: true,
              },
            },
          }
        : message
    )),
  };
}

function suppressWorkerPaymentFlowPrompt(result, reply, reason) {
  const outboundExternalId = result.newMessages.find(
    (message) => message?.sender === "bot",
  )?.externalId;
  return {
    ...result,
    reply,
    flowPrompt: null,
    newMessages: result.newMessages.map((message) => (
      message?.sender === "bot" && message.externalId === outboundExternalId
        ? {
            ...message,
            text: reply,
            metadata: {
              ...(message.metadata || {}),
              workerPaymentFlow: { status: "UNAVAILABLE", reason },
            },
          }
        : message
    )),
  };
}

function attachWorkerPaymentPrivateReceiptDelivery(result, descriptor) {
  const outboundExternalId = result.newMessages.find(
    (message) => message?.sender === "bot",
  )?.externalId;
  return {
    ...result,
    reply: WORKER_PAYMENT_PRIVATE_RECEIPT_DURABLE_REPLY,
    workerPaymentPrivateReceiptDelivery: descriptor,
    newMessages: result.newMessages.map((message) => (
      message?.sender === "bot" && message.externalId === outboundExternalId
        ? {
            ...message,
            text: WORKER_PAYMENT_PRIVATE_RECEIPT_DURABLE_REPLY,
            metadata: {
              ...(message.metadata || {}),
              workerPaymentPrivateReceipt: {
                status: "ISSUED",
                deliveryContentRestricted: true,
              },
            },
          }
        : message
    )),
  };
}

function assertManagedWhatsAppMediaEvent(event, row, descriptor) {
  const media = event?.media;
  const storage = media?.storage;
  if (
    !row
    || row.webhookEventId == null
    || descriptor.assetId !== media?.assetId
    || storage?.ledgerAssetId !== row.id
    || row.providerMessageIdHash !== whatsAppMediaAssetHash(event.externalId || "")
    || row.providerMediaIdHash !== whatsAppMediaAssetHash(media?.id || "")
    || media.filename !== descriptor.filename
    || media.mimeType !== descriptor.mimeType
    || media.sha256 !== descriptor.sha256
    || media.size !== descriptor.size
    || media.url !== descriptor.url
    || storage?.provider !== descriptor.storage.provider
    || storage?.assetId !== descriptor.storage.assetId
    || storage?.publicId !== descriptor.storage.publicId
    || storage?.pathname !== descriptor.storage.pathname
    || storage?.resourceType !== descriptor.storage.resourceType
    || storage?.format !== descriptor.storage.format
    || storage?.bytes !== descriptor.storage.bytes
  ) {
    throw webhookProcessingError(
      "Managed WhatsApp media does not match its durable asset.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
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

function readLocalDb({ initialize = true } = {}) {
  if (initialize) initLocalDb();
  try {
    return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
  } catch {
    if (!initialize) return { webhookEvents: [] };
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

async function durableConversation(context, identity = null) {
  const externalId = identity?.externalId || LOCAL_CONVERSATION_ID;
  const displayName = identity?.displayName
    || (identity ? identity.phone : "Bitácora principal");
  return context.prisma.conversation.upsert({
    where: {
      projectId_channel_externalId: {
        projectId: context.project.id,
        channel: "whatsapp",
        externalId,
      },
    },
    update: identity?.displayName ? { displayName: identity.displayName } : {},
    create: {
      projectId: context.project.id,
      channel: "whatsapp",
      externalId,
      displayName,
    },
  });
}

function localProjectStateSnapshot(db) {
  const numericVersion = Number(db.appStateVersion);
  const version = Number.isSafeInteger(numericVersion) && numericVersion >= 0
    ? numericVersion
    : 0;
  const parsedUpdatedAt = db.appStateUpdatedAt ? new Date(db.appStateUpdatedAt) : null;
  const exists = Object.hasOwn(db, "appState");
  return {
    state: exists ? db.appState : createEmptyAppState(),
    version,
    updatedAt: parsedUpdatedAt && !Number.isNaN(parsedUpdatedAt.getTime()) ? parsedUpdatedAt : null,
    exists,
  };
}

export async function getAppStateSnapshot(scope, { initializeIfMissing = true } = {}) {
  if (!hasDurableDatabase()) {
    return localProjectStateSnapshot(readLocalDb({ initialize: initializeIfMissing }));
  }

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
  preserveAttendanceProjection = false,
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
  const nextState = preserveAttendanceProjection
    ? {
        ...state,
        attendance: clone(
          currentState?.attendance && typeof currentState.attendance === "object"
            ? currentState.attendance
            : {},
        ),
      }
    : state;
  const derivedActivities = typeof deriveActivities === "function"
    ? deriveActivities(currentState, nextState)
    : [];
  const auditActivities = [
    ...(Array.isArray(activities) ? activities : []),
    ...(Array.isArray(derivedActivities) ? derivedActivities : []),
  ];
  const nextVersion = currentVersion + 1;
  await synchronizeProjectTaskProjection(transaction, {
    projectId: context.project.id,
    nextTasks: nextState.tasks,
    projectStartsAt: context.project.startsAt,
    stateVersion: nextVersion,
  });
  const stored = await transaction.projectSnapshot.upsert({
    where: { projectId: context.project.id },
    update: { state: nextState, version: nextVersion },
    create: { projectId: context.project.id, state: nextState, version: nextVersion },
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
  preserveAttendanceProjection = false,
} = {}) {
  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const current = localProjectStateSnapshot(db);
    const currentVersion = assertProjectStateVersion(expectedVersion, current.version);
    const nextState = preserveAttendanceProjection
      ? {
          ...state,
          attendance: clone(
            current.state?.attendance && typeof current.state.attendance === 'object'
              ? current.state.attendance
              : {},
          ),
        }
      : state;
    const derivedActivities = typeof deriveActivities === "function"
      ? deriveActivities(current.state, nextState)
      : [];
    const auditActivities = [
      ...(Array.isArray(activities) ? activities : []),
      ...(Array.isArray(derivedActivities) ? derivedActivities : []),
    ];
    const updatedAt = new Date();
    db.appState = clone(nextState);
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
      state: clone(nextState),
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
    preserveAttendanceProjection,
  }));
}

export async function saveAppState(state, scope, options = {}) {
  const snapshot = await saveAppStateSnapshot(state, scope, options);
  return snapshot.state;
}

function serializeDurableMessages(messages, {
  includeMedicalEvidence = false,
  includeSourceEvidence = includeMedicalEvidence,
} = {}) {
  const serialized = messages.map((message) => {
    const rawMetadata = message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
      ? message.metadata
      : {};
    const hasSourceMedia = Boolean(message.mediaUrl || rawMetadata.media);
    const managedMedia = Object.hasOwn(message, "whatsappMediaAsset") || hasSourceMedia
      ? resolveClaimedWhatsAppMessageMedia(message)
      : null;
    const managedDescriptor = managedMedia?.descriptor || null;
    const media = managedDescriptor
      ? {
          kind: String(message.kind || "").toLowerCase() || null,
          assetId: managedDescriptor.assetId,
          filename: managedDescriptor.filename,
          mimeType: managedDescriptor.mimeType,
          sha256: managedDescriptor.sha256,
          size: managedDescriptor.size,
          url: managedDescriptor.url,
          storage: {
            ...managedDescriptor.storage,
            status: "stored",
            ledgerAssetId: managedDescriptor.assetId,
          },
        }
      : rawMetadata.media || null;
    const metadata = managedDescriptor
      ? { ...rawMetadata, media }
      : rawMetadata;
    return {
      id: message.id,
      externalId: message.externalId,
      sender: message.direction === "OUTBOUND" ? "bot" : "user",
      kind: message.kind.toLowerCase(),
      text: redactSensitiveText(message.body || ""),
      mediaUrl: managedDescriptor?.url || message.mediaUrl,
      media,
      transcription: metadata.transcription || null,
      status: message.status,
      metadata,
      sentAt: message.sentAt.toISOString(),
      time: metadata.time || message.sentAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    };
  });
  return sanitizeMessagesForMedicalPrivacy(serialized, {
    includeMedicalEvidence,
    includeSourceEvidence,
  });
}

export async function getMessages(scope, {
  includeMedicalEvidence = false,
  includeSourceEvidence = includeMedicalEvidence,
  initializeIfEmpty = true,
  sentAtGte = null,
  sentAtLte = null,
  take = 200,
} = {}) {
  const normalizedTake = Math.min(501, Math.max(1, Number(take) || 200));
  const lowerBound = sentAtGte instanceof Date && !Number.isNaN(sentAtGte.getTime())
    ? sentAtGte
    : null;
  const upperBound = sentAtLte instanceof Date && !Number.isNaN(sentAtLte.getTime())
    ? sentAtLte
    : null;

  if (!hasDurableDatabase()) {
    const storedMessages = readLocalDb({ initialize: initializeIfEmpty }).messages;
    const localMessages = (Array.isArray(storedMessages)
      ? storedMessages
      : initializeIfEmpty ? clone(defaultMessages) : [])
      .filter((message) => {
        if (!message.sentAt) return true;
        const messageDate = new Date(message.sentAt);
        if (Number.isNaN(messageDate.getTime())) return false;
        return (!lowerBound || messageDate >= lowerBound)
          && (!upperBound || messageDate <= upperBound);
      })
      .slice(-normalizedTake);
    return sanitizeMessagesForMedicalPrivacy(
      localMessages,
      { includeMedicalEvidence, includeSourceEvidence },
    );
  }

  const context = await durableContext(scope);
  const conversation = initializeIfEmpty
    ? await durableConversation(context)
    : await context.prisma.conversation.findUnique({
        where: {
          projectId_channel_externalId: {
            projectId: context.project.id,
            channel: "whatsapp",
            externalId: LOCAL_CONVERSATION_ID,
          },
        },
      });
  if (!conversation) return [];
  const messageWhere = {
    conversationId: conversation.id,
    ...((lowerBound || upperBound) ? {
      sentAt: {
        ...(lowerBound ? { gte: lowerBound } : {}),
        ...(upperBound ? { lte: upperBound } : {}),
      },
    } : {}),
  };
  let messages = await context.prisma.message.findMany({
    where: messageWhere,
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: normalizedTake,
    include: {
      whatsappMediaAsset: { select: WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT },
    },
  });

  if (messages.length === 0 && initializeIfEmpty) {
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
      where: messageWhere,
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: normalizedTake,
      include: {
        whatsappMediaAsset: { select: WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT },
      },
    });
  }

  messages.reverse();

  return serializeDurableMessages(messages, {
    includeMedicalEvidence,
    includeSourceEvidence,
  });
}

export async function getOperationalMessages(scope, {
  includeMedicalEvidence = false,
  includeSourceEvidence = includeMedicalEvidence,
  sentAtGte = null,
  sentAtLte = null,
  take = 200,
} = {}) {
  const normalizedTake = Math.min(501, Math.max(1, Number(take) || 200));
  const lowerBound = sentAtGte instanceof Date && !Number.isNaN(sentAtGte.getTime())
    ? sentAtGte
    : null;
  const upperBound = sentAtLte instanceof Date && !Number.isNaN(sentAtLte.getTime())
    ? sentAtLte
    : null;
  if (!hasDurableDatabase()) return [];

  const context = await durableContext(scope);
  const messages = await context.prisma.message.findMany({
    where: {
      conversation: {
        projectId: context.project.id,
        channel: "whatsapp",
        externalId: { startsWith: "meta:" },
      },
      ...((lowerBound || upperBound) ? {
        sentAt: {
          ...(lowerBound ? { gte: lowerBound } : {}),
          ...(upperBound ? { lte: upperBound } : {}),
        },
      } : {}),
    },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: normalizedTake,
    include: {
      whatsappMediaAsset: { select: WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT },
    },
  });
  messages.reverse();
  return serializeDurableMessages(messages, {
    includeMedicalEvidence,
    includeSourceEvidence,
  });
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
    db.messages = messages.map(redactedStoredMessage);
    writeLocalDb(db);
    return db.messages;
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

async function appendDurableMessages(context, messages, { conversationIdentity = null } = {}) {
  const conversation = await durableConversation(context, conversationIdentity);
  const persistedMessages = [];
  for (const [index, message] of messages.entries()) {
    const data = durableMessageData(
      message,
      conversation.id,
      new Date(Date.now() + index),
    );
    if (!data.externalId) {
      const created = await context.prisma.message.create({ data });
      persistedMessages.push(created || data);
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
      const updated = await context.prisma.message.update({ where: { id: existing.id }, data: update });
      persistedMessages.push(updated || { ...data, id: existing.id });
    } else {
      const created = await context.prisma.message.create({ data });
      persistedMessages.push(created || data);
    }
  }
  if (conversationIdentity && messages.length > 0) {
    await context.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
        ...(conversationIdentity.displayName
          ? { displayName: conversationIdentity.displayName }
          : {}),
      },
    });
  }
  return persistedMessages;
}

export async function appendMessages(messages, scope) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const current = Array.isArray(db.messages) ? db.messages : [];
    const safeMessages = messages.map(redactedStoredMessage);
    for (const message of safeMessages) {
      const existingIndex = message.externalId
        ? current.findIndex((item) => item.externalId === message.externalId)
        : -1;
      if (existingIndex >= 0) current[existingIndex] = message;
      else current.push(message);
    }
    db.messages = current.slice(-200);
    writeLocalDb(db);
    return safeMessages;
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

const DASHBOARD_SIMULATOR_OPERATION_ACTION = "dashboard.field_simulation.applied";
const DIRECT_EPHEMERAL_SECURE_LINK_PATTERN = /https?:\/\/[^\s<>"']+\/webview\/(?:attendance|medical)\?[^\s<>"']+/giu;

function directObraMessageInput({
  event,
  scope,
  workerId,
  apply,
  beforeApply,
  operation,
  allowEphemeralSecureReply,
}) {
  const normalized = {
    projectId: String(scope?.project?.id || scope?.projectId || "").trim(),
    organizationId: String(scope?.organization?.id || scope?.organizationId || "").trim() || null,
    workerId: String(workerId || "").trim(),
    allowEphemeralSecureReply: allowEphemeralSecureReply === true,
  };
  if (
    !normalized.projectId
    || !normalized.workerId
    || !event
    || typeof event !== "object"
    || Array.isArray(event)
    || typeof apply !== "function"
    || (beforeApply != null && typeof beforeApply !== "function")
    || (
      allowEphemeralSecureReply !== undefined
      && typeof allowEphemeralSecureReply !== "boolean"
    )
  ) {
    throw new DirectObraMessageError(
      "A trusted project, active worker, event and application callback are required.",
      "DIRECT_MESSAGE_INPUT_INVALID",
      400,
    );
  }

  if (operation == null) {
    if (normalized.allowEphemeralSecureReply) {
      throw new DirectObraMessageError(
        "Ephemeral secure replies require an authenticated simulator operation.",
        "DIRECT_EPHEMERAL_REPLY_UNAUTHORIZED",
        403,
      );
    }
    return { ...normalized, operation: null };
  }
  const operationId = String(operation.id || "").trim();
  const operationAction = String(operation.action || "").trim();
  const operationActorId = String(operation.actorId || "").trim() || null;
  if (
    !operationId
    || operationId.length > 190
    || !operationAction
    || operationAction.length > 160
    || (operationActorId && operationActorId.length > 256)
  ) {
    throw new DirectObraMessageError(
      "The direct-message idempotency operation is invalid.",
      "DIRECT_OPERATION_INVALID",
      400,
    );
  }
  if (
    normalized.allowEphemeralSecureReply
    && (
      String(event.provider || "").trim() !== "internal"
      || operationAction !== DASHBOARD_SIMULATOR_OPERATION_ACTION
      || !operationActorId
    )
  ) {
    throw new DirectObraMessageError(
      "Ephemeral secure replies are restricted to authenticated dashboard simulations.",
      "DIRECT_EPHEMERAL_REPLY_UNAUTHORIZED",
      403,
    );
  }
  return {
    ...normalized,
    operation: {
      id: operationId,
      action: operationAction,
      actorId: operationActorId,
    },
  };
}

function directOperationalProposalOutcome(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = String(value.id || "").trim();
  const confirmationCode = String(value.confirmationCode || "").trim();
  const type = String(value.type || "").trim();
  const status = String(value.status || "").trim();
  const expiresAt = String(value.expiresAt || "").trim();
  if (
    !id
    || id.length > 256
    || !/^VP-[A-F0-9]{12}$/.test(confirmationCode)
    || !["TASK_PROGRESS", "DELAY_REPORT", "CRITICAL_INCIDENT"].includes(type)
    || !["PENDING", "APPLIED", "REJECTED", "EXPIRED", "INVALIDATED"].includes(status)
    || Number.isNaN(new Date(expiresAt).getTime())
  ) {
    return null;
  }
  return { id, confirmationCode, type, status, expiresAt };
}

const DIRECT_REPLY_SENSITIVITIES = new Set(["medical", "restricted"]);

function directReplySensitivity(result) {
  const messages = Array.isArray(result?.newMessages) ? result.newMessages : [];
  const outboundReplies = messages.filter((message) => message?.sender === "bot");
  if (
    isSensitiveMedicalText(result?.reply)
    || outboundReplies.some((message) => isMedicalEvidenceRecord(message))
  ) {
    return "medical";
  }
  if (outboundReplies.some((message) => isRestrictedEvidenceRecord(message))) {
    return "restricted";
  }
  return null;
}

function attachDirectReplySensitivity(result, sensitivity) {
  if (!sensitivity) return result;
  Object.defineProperty(result, "__replySensitivity", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: sensitivity,
  });
  return result;
}

function readDirectOperationOutcome(record, { operation, project, worker }) {
  if (!record) return null;
  const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
    ? record.metadata
    : {};
  const outcome = metadata.outcome && typeof metadata.outcome === "object" && !Array.isArray(metadata.outcome)
    ? metadata.outcome
    : null;
  const operationalProposal = directOperationalProposalOutcome(outcome?.operationalProposal);
  const storedReplySensitivity = outcome?.replySensitivity;
  const replySensitivity = storedReplySensitivity === undefined
    && operation.action === "dashboard.field_simulation.applied"
    ? "restricted"
    : storedReplySensitivity || null;
  if (
    record.organizationId !== project.organizationId
    || (record.actorId || null) !== operation.actorId
    || record.action !== operation.action
    || record.entityType !== "Worker"
    || record.entityId !== worker.id
    || metadata.projectId !== project.id
    || typeof outcome?.reply !== "string"
    || (replySensitivity && !DIRECT_REPLY_SENSITIVITIES.has(replySensitivity))
    || (outcome?.operationalProposal != null && !operationalProposal)
  ) {
    throw new DirectObraMessageError(
      "A prior direct-message operation has an invalid or conflicting outcome.",
      "DIRECT_OPERATION_OUTCOME_INVALID",
      409,
    );
  }
  return attachDirectReplySensitivity({
    reply: redactSensitiveText(outcome.reply),
    flowPrompt: typeof outcome.flowPrompt === "string" ? outcome.flowPrompt : null,
    intent: typeof outcome.intent === "string" ? outcome.intent : null,
    operationalProposal,
    stateChanged: false,
    newMessages: [],
    worker,
  }, replySensitivity);
}

function storedDirectOperationOutcome(result) {
  return {
    reply: redactSensitiveText(result.reply).slice(0, 4_000),
    replySensitivity: directReplySensitivity(result),
    flowPrompt: typeof result.flowPrompt === "string" ? result.flowPrompt.slice(0, 160) : null,
    intent: typeof result.intent === "string" ? result.intent.slice(0, 160) : null,
    operationalProposal: directOperationalProposalOutcome(result.operationalProposal),
  };
}

export async function applyDirectObraMessageAtomically({
  event,
  scope,
  workerId,
  apply,
  beforeApply = null,
  operation = null,
  allowEphemeralSecureReply = false,
}) {
  const normalized = directObraMessageInput({
    event,
    scope,
    workerId,
    apply,
    beforeApply,
    operation,
    allowEphemeralSecureReply,
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
        startsAt: true,
        organization: {
          select: {
            timezone: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            trialEndsAt: true,
          },
        },
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
    if (!subscriptionAllowsWrites(project.organization)) {
      throw new DirectObraMessageError(
        "The organization subscription does not allow direct field writes.",
        "SUBSCRIPTION_READ_ONLY",
        402,
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
          actorId: true,
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
      organizationId: project.organizationId,
      latitude: project.latitude == null ? null : Number(project.latitude),
      longitude: project.longitude == null ? null : Number(project.longitude),
      geofenceMeters: project.geofenceMeters,
      timezone: project.organization?.timezone || "America/Argentina/Buenos_Aires",
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
      await synchronizeProjectTaskProjection(transaction, {
        projectId: project.id,
        nextTasks: state.tasks,
        projectStartsAt: project.startsAt,
        stateVersion: nextVersion,
      });
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
          ...(normalized.operation.actorId ? { actorId: normalized.operation.actorId } : {}),
          action: normalized.operation.action,
          entityType: "Worker",
          entityId: worker.id,
          metadata: {
            projectId: project.id,
            ...(normalized.operation.actorId
              ? { initiatedByPlatformUserId: normalized.operation.actorId }
              : {}),
            provider: String(event.provider || "direct").slice(0, 32),
            simulated: event.provider === "internal",
            outcome: storedDirectOperationOutcome(result),
          },
        },
      });
    }
    return {
      alreadyApplied: false,
      result: normalized.allowEphemeralSecureReply
        ? ephemeralSimulatorOperationResult(result, normalized.projectId)
        : publicDirectOperationResult(result),
    };
  }, { maxWait: 5_000, timeout: 20_000 });
}

function webhookProcessingError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const AUTOMATIC_WHATSAPP_DELIVERY_VERSION = 1;
const AUTOMATIC_WHATSAPP_DELIVERY_SOURCE = "automatic-webhook";
const AUTOMATIC_WHATSAPP_DELIVERY_FINAL_STATES = new Set([
  "accepted",
  "sent",
  "delivered",
  "read",
  "failed",
  "unknown",
]);
const AUTOMATIC_WHATSAPP_DELIVERY_SETTLEMENT_STATES = new Set([
  "accepted",
  "failed",
  "unknown",
]);
const AUTOMATIC_WHATSAPP_FAILURE_CODE_PATTERN = /^[A-Z][A-Z0-9_.:-]{0,79}$/;

function jsonRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function automaticWhatsAppDeliveryTimestamp(value) {
  const timestamp = value ? new Date(value) : null;
  return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : null;
}

function automaticWhatsAppDeliveryMetadata(
  metadata,
  webhookEventId,
  dispatchState,
  now = new Date(),
  failureEvidence = null,
) {
  const priorJournal = jsonRecord(jsonRecord(metadata).automaticDelivery);
  const timestamp = automaticWhatsAppDeliveryTimestamp(now) || new Date().toISOString();
  const preparedAt = automaticWhatsAppDeliveryTimestamp(priorJournal.preparedAt);
  const dispatchStartedAt = automaticWhatsAppDeliveryTimestamp(priorJournal.dispatchStartedAt);
  const preProviderReleaseCount = Number.isSafeInteger(priorJournal.preProviderReleaseCount)
    && priorJournal.preProviderReleaseCount > 0
    ? Math.min(priorJournal.preProviderReleaseCount, 255)
    : 0;
  const lastPreProviderReleasedAt = automaticWhatsAppDeliveryTimestamp(
    priorJournal.lastPreProviderReleasedAt,
  );
  return {
    ...jsonRecord(metadata),
    automaticDelivery: {
      version: AUTOMATIC_WHATSAPP_DELIVERY_VERSION,
      source: AUTOMATIC_WHATSAPP_DELIVERY_SOURCE,
      webhookEventId,
      dispatchState,
      ...((preparedAt || dispatchState === "prepared" || dispatchState === "sending")
        ? { preparedAt: preparedAt || timestamp }
        : {}),
      ...((dispatchStartedAt || dispatchState === "sending")
        ? { dispatchStartedAt: dispatchStartedAt || timestamp }
        : {}),
      ...(preProviderReleaseCount ? { preProviderReleaseCount } : {}),
      ...(lastPreProviderReleasedAt ? { lastPreProviderReleasedAt } : {}),
      ...(AUTOMATIC_WHATSAPP_DELIVERY_SETTLEMENT_STATES.has(dispatchState)
        ? { settledAt: timestamp }
        : {}),
      ...(["failed", "unknown"].includes(dispatchState) && failureEvidence?.failureCode
        ? { failureCode: failureEvidence.failureCode }
        : {}),
      ...(["failed", "unknown"].includes(dispatchState) && failureEvidence?.providerStatus
        ? { providerStatus: failureEvidence.providerStatus }
        : {}),
      ...(["failed", "unknown"].includes(dispatchState) && failureEvidence?.providerCode
        ? { providerCode: failureEvidence.providerCode }
        : {}),
    },
  };
}

function publicDirectOperationResult(result) {
  const safeResult = {
    ...result,
    reply: redactSensitiveText(result.reply),
    newMessages: Array.isArray(result.newMessages)
      ? result.newMessages.map(redactedStoredMessage)
      : [],
  };
  return attachDirectReplySensitivity(safeResult, directReplySensitivity(result));
}

function ephemeralSimulatorText(value, projectId) {
  const text = String(value || "");
  const matches = [...text.matchAll(DIRECT_EPHEMERAL_SECURE_LINK_PATTERN)];
  if (matches.length !== 1) return redactSensitiveText(text);
  try {
    if (!extractSecureWebviewDelivery(text, { projectId })) {
      return redactSensitiveText(text);
    }
  } catch {
    return redactSensitiveText(text);
  }
  const [{ 0: link, index }] = matches;
  return [
    redactSensitiveText(text.slice(0, index)),
    link,
    redactSensitiveText(text.slice(index + link.length)),
  ].join("");
}

function ephemeralSimulatorOperationResult(result, projectId) {
  const safeResult = publicDirectOperationResult(result);
  const originalMessages = Array.isArray(result.newMessages) ? result.newMessages : [];
  const ephemeralResult = {
    ...safeResult,
    reply: ephemeralSimulatorText(result.reply, projectId),
    newMessages: safeResult.newMessages.map((message, index) => ({
      ...message,
      text: ephemeralSimulatorText(originalMessages[index]?.text, projectId),
    })),
  };
  return attachDirectReplySensitivity(
    ephemeralResult,
    directReplySensitivity(result),
  );
}

function automaticWhatsAppPreProviderReleaseMetadata(
  metadata,
  webhookEventId,
  now = new Date(),
) {
  const priorJournal = jsonRecord(jsonRecord(metadata).automaticDelivery);
  const timestamp = automaticWhatsAppDeliveryTimestamp(now) || new Date().toISOString();
  const preparedAt = automaticWhatsAppDeliveryTimestamp(priorJournal.preparedAt) || timestamp;
  const priorReleaseCount = Number.isSafeInteger(priorJournal.preProviderReleaseCount)
    && priorJournal.preProviderReleaseCount >= 0
    ? priorJournal.preProviderReleaseCount
    : 0;
  return {
    ...jsonRecord(metadata),
    automaticDelivery: {
      version: AUTOMATIC_WHATSAPP_DELIVERY_VERSION,
      source: AUTOMATIC_WHATSAPP_DELIVERY_SOURCE,
      webhookEventId,
      dispatchState: "prepared",
      preparedAt,
      preProviderReleaseCount: Math.min(priorReleaseCount + 1, 255),
      lastPreProviderReleasedAt: timestamp,
    },
  };
}

function automaticWhatsAppFailureEvidence({
  failureCode,
  providerStatus,
  providerCode,
  state,
}) {
  const failureCodeSupplied = failureCode !== undefined && failureCode !== null;
  const providerStatusSupplied = providerStatus !== undefined && providerStatus !== null;
  const providerCodeSupplied = providerCode !== undefined && providerCode !== null;
  const normalizedFailureCode = typeof failureCode === "string"
    ? failureCode.trim().toUpperCase()
    : "";
  const normalizedProviderStatus = typeof providerStatus === "number" ? providerStatus : null;
  const normalizedProviderCode = normalizeMetaProviderCode(providerCode);
  if (
    (
      state === "accepted"
      && (failureCodeSupplied || providerStatusSupplied || providerCodeSupplied)
    )
    || (
      failureCodeSupplied
      && !AUTOMATIC_WHATSAPP_FAILURE_CODE_PATTERN.test(normalizedFailureCode)
    )
    || (
      providerStatusSupplied
      && (
        !Number.isInteger(normalizedProviderStatus)
        || normalizedProviderStatus < 100
        || normalizedProviderStatus > 599
      )
    )
    || (providerCodeSupplied && typeof providerCode !== "number")
    || (providerCodeSupplied && !normalizedProviderCode)
  ) {
    throw webhookProcessingError(
      "Automatic WhatsApp failure evidence must use bounded machine, HTTP and provider codes.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  return {
    ...(normalizedFailureCode ? { failureCode: normalizedFailureCode } : {}),
    ...(normalizedProviderStatus ? { providerStatus: normalizedProviderStatus } : {}),
    ...(normalizedProviderCode ? { providerCode: normalizedProviderCode } : {}),
  };
}

function prepareAutomaticWebhookMessages(messages, { eventId, inboundExternalId, now = new Date() }) {
  const outboundExternalId = `obrasaas-reply:${inboundExternalId}`;
  return messages.map((message) => {
    if (message?.sender !== "bot" || message.externalId !== outboundExternalId) {
      return message;
    }
    return {
      ...message,
      status: "prepared",
      metadata: automaticWhatsAppDeliveryMetadata(
        message.metadata,
        eventId,
        "prepared",
        now,
      ),
    };
  });
}

function automaticWhatsAppDeliveryInput({
  eventId,
  leaseToken,
  inboundExternalId,
  scope,
}) {
  const normalized = {
    eventId: typeof eventId === "string" ? eventId.trim() : "",
    leaseToken: typeof leaseToken === "string" ? leaseToken.trim() : "",
    inboundExternalId: typeof inboundExternalId === "string" ? inboundExternalId.trim() : "",
    projectId: typeof scope?.projectId === "string" ? scope.projectId.trim() : "",
    organizationId: typeof scope?.organizationId === "string" ? scope.organizationId.trim() : "",
    phoneNumberId: typeof scope?.phoneNumberId === "string" ? scope.phoneNumberId.trim() : "",
  };
  if (
    !normalized.eventId
    || !normalized.leaseToken
    || !normalized.inboundExternalId
    || !normalized.projectId
    || !normalized.organizationId
    || !normalized.phoneNumberId
  ) {
    throw webhookProcessingError(
      "An applied webhook lease, inbound message and trusted tenant scope are required for automatic delivery.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  return {
    ...normalized,
    outboundExternalId: `obrasaas-reply:${normalized.inboundExternalId}`,
  };
}

function automaticWhatsAppDeliveryClaim(value) {
  const claim = {
    version: Number(value?.version),
    eventId: typeof value?.eventId === "string" ? value.eventId.trim() : "",
    leaseToken: typeof value?.leaseToken === "string" ? value.leaseToken.trim() : "",
    projectId: typeof value?.projectId === "string" ? value.projectId.trim() : "",
    organizationId: typeof value?.organizationId === "string" ? value.organizationId.trim() : "",
    phoneNumberId: typeof value?.phoneNumberId === "string" ? value.phoneNumberId.trim() : "",
    messageId: typeof value?.messageId === "string" ? value.messageId.trim() : "",
    outboundExternalId: typeof value?.outboundExternalId === "string"
      ? value.outboundExternalId.trim()
      : "",
  };
  if (
    claim.version !== AUTOMATIC_WHATSAPP_DELIVERY_VERSION
    || !claim.eventId
    || !claim.leaseToken
    || !claim.projectId
    || !claim.organizationId
    || !claim.phoneNumberId
    || !claim.messageId
    || !claim.outboundExternalId.startsWith("obrasaas-reply:")
    || claim.outboundExternalId.length === "obrasaas-reply:".length
  ) {
    throw webhookProcessingError(
      "The automatic WhatsApp delivery claim is invalid.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  return claim;
}

async function requireAutomaticWhatsAppDeliveryProject(transaction, normalized) {
  const project = await transaction.project.findFirst({
    where: {
      id: normalized.projectId,
      organizationId: normalized.organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      whatsapp: {
        select: {
          phoneNumberId: true,
          enabled: true,
        },
      },
    },
  });
  if (
    !project
    || !project.whatsapp?.enabled
    || project.whatsapp.phoneNumberId !== normalized.phoneNumberId
  ) {
    throw webhookProcessingError(
      "The automatic WhatsApp delivery crossed its trusted tenant connection boundary.",
      "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
    );
  }
  return project;
}

async function requireAutomaticWhatsAppDeliveryEvent(transaction, normalized) {
  const inboundExternalId = normalized.inboundExternalId
    || normalized.outboundExternalId.slice("obrasaas-reply:".length);
  const event = await transaction.webhookEvent.findFirst({
    where: {
      id: normalized.eventId,
      projectId: normalized.projectId,
      provider: "meta",
      externalId: scopedWebhookExternalId(normalized.projectId, inboundExternalId),
      eventType: "message",
      status: "PROCESSING",
      leaseToken: normalized.leaseToken,
      appliedAt: { not: null },
    },
    select: {
      id: true,
      appliedAt: true,
      outcome: true,
      payload: true,
    },
  });
  if (!event) {
    throw webhookProcessingError(
      "The webhook lease changed before automatic WhatsApp delivery could be recorded.",
      "WEBHOOK_LEASE_LOST",
    );
  }
  readAppliedMessageWebhookOutcome(event);
  let stored;
  let conversationExternalId;
  try {
    stored = deserializeWebhookPayload(event.payload);
    conversationExternalId = whatsAppConversationIdentity(stored.event).externalId;
  } catch {
    throw webhookProcessingError(
      "The applied webhook payload cannot prove its automatic delivery contact.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  if (
    stored.event.provider !== "meta"
    || stored.event.eventType !== "message"
    || stored.event.externalId !== inboundExternalId
    || stored.event.phoneNumberId !== normalized.phoneNumberId
    || stored.scope.projectId !== normalized.projectId
    || stored.scope.organizationId !== normalized.organizationId
    || stored.scope.phoneNumberId !== normalized.phoneNumberId
  ) {
    throw webhookProcessingError(
      "The applied webhook payload crossed its trusted automatic delivery scope.",
      "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
    );
  }
  return { ...event, conversationExternalId };
}

function automaticWhatsAppMessageInScope(message, normalized) {
  return Boolean(
    message
    && message.id === (normalized.messageId || message.id)
    && message.externalId === normalized.outboundExternalId
    && message.direction === "OUTBOUND"
    && message.conversationId
    && message.conversation?.projectId === normalized.projectId
    && message.conversation?.channel === "whatsapp"
    && message.conversation?.externalId === normalized.conversationExternalId
  );
}

function automaticWhatsAppJournalMatches(metadata, eventId, dispatchState) {
  const journal = jsonRecord(metadata).automaticDelivery;
  return Boolean(
    journal
    && typeof journal === "object"
    && !Array.isArray(journal)
    && journal.version === AUTOMATIC_WHATSAPP_DELIVERY_VERSION
    && journal.source === AUTOMATIC_WHATSAPP_DELIVERY_SOURCE
    && journal.webhookEventId === eventId
    && journal.dispatchState === dispatchState
  );
}

export function assertExpiredWhatsAppFlowRecoveryResult(
  expiredFlowSession,
  result,
) {
  if (!expiredFlowSession) return;
  const flowPrompt = result?.flowPrompt === null
    || result?.flowPrompt === undefined
    || result?.flowPrompt === ""
    ? null
    : result.flowPrompt;
  if (
    result?.stateChanged !== false
    || (
      flowPrompt !== null
      && flowPrompt !== expiredFlowSession.blueprintKey
    )
  ) {
    throw webhookProcessingError(
      "An expired WhatsApp Flow recovery cannot mutate state or change blueprints.",
      "WEBHOOK_OUTCOME_INVALID",
    );
  }
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

function workerOnboardingReceipt(event) {
  const response = event?.interactive?.response;
  const tokenEvidence = event?.interactive?.flowToken;
  const candidate = event?.provider === "meta"
    && event?.interactive?.type === "flow"
    && (
      response?.flow_type === "worker_onboarding"
      || tokenEvidence?.kind === "worker_onboarding"
    );
  if (!candidate) return { candidate: false, receipt: null, tokenEvidence: null };
  if (tokenEvidence?.kind !== "worker_onboarding") {
    return { candidate: true, receipt: null, tokenEvidence: null };
  }
  try {
    return {
      candidate: true,
      receipt: validateWhatsAppFlowReply("worker-onboarding", response),
      tokenEvidence,
    };
  } catch {
    return { candidate: true, receipt: null, tokenEvidence: null };
  }
}

const REJECTED_WORKER_ONBOARDING_RECEIPT_CODES = new Set([
  "WORKER_ONBOARDING_FLOW_SESSION_CLAIM_UNAVAILABLE",
  "WORKER_ONBOARDING_FLOW_SESSION_CONFLICT",
  "WORKER_ONBOARDING_FLOW_SESSION_EXPIRED",
  "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
  "WORKER_ONBOARDING_FLOW_SESSION_RETIRED",
  "WORKER_ONBOARDING_FLOW_SESSION_USED",
]);

async function closeWorkerOnboardingReceipt(
  transaction,
  { event, normalized, project, receipt },
) {
  if (!receipt.receipt || !receipt.tokenEvidence) return false;
  if (!project.whatsapp?.id) {
    throw webhookProcessingError(
      "The worker-onboarding receipt has no exact WhatsApp connection scope.",
      "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
    );
  }
  try {
    await consumeWorkerOnboardingFlowSession(transaction, {
      tokenEvidence: receipt.tokenEvidence,
      claimRef: receipt.receipt.claim_ref,
      senderAddress: event.from,
      consumedExternalId: event.externalId,
      organizationId: normalized.organizationId,
      projectId: normalized.projectId,
      connectionId: project.whatsapp.id,
      phoneNumberId: normalized.phoneNumberId,
    }, { recoverExpired: true });
    return true;
  } catch (error) {
    if (
      error instanceof WorkerOnboardingFlowSessionError
      && REJECTED_WORKER_ONBOARDING_RECEIPT_CODES.has(error.code)
    ) return false;
    throw error;
  }
}

function quarantinedWebhookMessage(event, { onboardingReceipt = null } = {}) {
  const kind = String(event.kind || "text").trim().toLowerCase() || "text";
  const transcriptionText = typeof event.transcription?.text === "string"
    ? event.transcription.text.trim()
    : "";
  const body = typeof event.text === "string" && event.text.trim()
    ? event.text.trim()
    : transcriptionText
      || (event.location ? "[ubicación]" : event.interactive ? "[mensaje interactivo]" : `[${kind}]`);
  const medical = isSensitiveMedicalText(body);
  const sourceContentRestricted = Boolean(
    event.media
    || event.transcription
    || kind !== "text",
  );
  const isolatesWorkerOnboardingReceipt = onboardingReceipt?.candidate === true;

  return {
    externalId: event.externalId || null,
    sender: "user",
    kind,
    text: body,
    sentAt: event.timestamp || new Date(),
    mediaUrl: event.media?.url || null,
    media: event.media || null,
    transcription: event.transcription || null,
    metadata: {
      provider: "meta",
      ...(!isolatesWorkerOnboardingReceipt ? {
        from: event.from || null,
        providerDisplayName: typeof event.displayName === "string"
          ? event.displayName.trim().slice(0, 255) || null
          : null,
      } : {}),
      phoneNumberId: event.phoneNumberId || null,
      contactStatus: "UNASSIGNED",
      workerResolution: FIELD_WORKER_RESOLUTION.UNKNOWN,
      quarantined: true,
      automationSuppressed: true,
      ...(isolatesWorkerOnboardingReceipt
        ? { workerOnboardingReceipt: onboardingReceipt.verified ? "VERIFIED" : "UNVERIFIED" }
        : {}),
      ...(sourceContentRestricted ? { sourceContentRestricted: true } : {}),
      ...(medical
        ? { sensitivity: "medical" }
        : sourceContentRestricted
          ? { sensitivity: "restricted" }
          : {}),
    },
  };
}

function quarantinedWebhookOutcome() {
  return {
    ...createMessageWebhookOutcome({
      // The delivery layer must never emit this internal receipt. A non-empty
      // reply keeps the persisted envelope compatible with existing retries.
      reply: "Mensaje conservado para revisión sin automatización.",
    }),
    quarantined: true,
    contactStatus: "UNASSIGNED",
    workerResolution: FIELD_WORKER_RESOLUTION.UNKNOWN,
    deliverySuppressed: true,
  };
}

function restoredAppliedWebhookOutcome(leasedEvent, outcome) {
  if (leasedEvent?.outcome?.quarantined !== true) return outcome;
  return {
    ...outcome,
    quarantined: true,
    contactStatus: "UNASSIGNED",
    workerResolution: FIELD_WORKER_RESOLUTION.UNKNOWN,
    deliverySuppressed: true,
  };
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
        projectId: true,
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
      const reusableOutcome = restoredAppliedWebhookOutcome(leasedEvent, priorOutcome);
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
      return {
        alreadyApplied: true,
        quarantined: reusableOutcome.quarantined === true,
        outcome: reusableOutcome,
      };
    }

    // Message ingress already required an ACTIVE project. A later pause does
    // not invalidate a durably accepted event, but completed and archived
    // projects stay immutable. Tenant ownership and the exact enabled WhatsApp
    // connection are revalidated under the project lock.
    const project = await transaction.project.findFirst({
      where: {
        id: normalized.projectId,
        organizationId: normalized.organizationId,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        latitude: true,
        longitude: true,
        geofenceMeters: true,
        startsAt: true,
        organization: {
          select: {
            timezone: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            trialEndsAt: true,
          },
        },
        snapshot: { select: { state: true, version: true } },
        whatsapp: {
          select: { id: true, phoneNumberId: true, enabled: true, metadata: true },
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
    if (!subscriptionAllowsWrites(project.organization)) {
      throw webhookProcessingError(
        "The organization subscription no longer allows WhatsApp message processing.",
        "WEBHOOK_SUBSCRIPTION_BLOCKED",
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
    if (
      (
        resolution.status === FIELD_WORKER_RESOLUTION.UNKNOWN
        || event[QUARANTINE_UNASSIGNED_MEDIA] === true
      )
      && event.provider === "meta"
    ) {
      const onboardingReceipt = workerOnboardingReceipt(event);
      const verifiedOnboardingReceipt = onboardingReceipt.candidate
        ? await closeWorkerOnboardingReceipt(transaction, {
            event,
            normalized,
            project,
            receipt: onboardingReceipt,
          })
        : false;
      const identity = whatsAppConversationIdentity(event);
      const outcome = quarantinedWebhookOutcome();
      await appendDurableMessages(
        { prisma: transaction, project },
        [quarantinedWebhookMessage(event, {
          onboardingReceipt: onboardingReceipt.candidate
            ? { candidate: true, verified: verifiedOnboardingReceipt }
            : null,
        })],
        {
          conversationIdentity: {
            ...identity,
            displayName: "Contacto sin asignar",
          },
        },
      );

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
          appliedAt: new Date(),
          outcome,
          lastError: null,
        },
      });
      if (accepted.count !== 1) {
        throw webhookProcessingError(
          "The webhook lease changed while its quarantined message was being persisted.",
          "WEBHOOK_LEASE_LOST",
        );
      }
      return { alreadyApplied: false, quarantined: true, outcome };
    }
    if (resolution.status !== FIELD_WORKER_RESOLUTION.RESOLVED) {
      throw fieldWorkerResolutionError(resolution.status);
    }
    const workerPaymentFlowBinding = (
      project.status === "ACTIVE"
      && resolution.source === "CANONICAL"
      && typeof resolution.worker?.personId === "string"
      && resolution.worker.personId
      && resolution.worker?.person?.identityStatus === "VERIFIED"
      && typeof resolution.channelIdentityId === "string"
      && resolution.channelIdentityId
    )
      ? {
          personId: resolution.worker.personId,
          channelIdentityId: resolution.channelIdentityId,
        }
      : null;

    const isFlowReply = event.interactive?.type === "flow";
    if (isFlowReply && event.provider !== "meta") {
      throw webhookProcessingError(
        "Durable WhatsApp Flow replies must come from the Meta provider.",
        "WEBHOOK_PAYLOAD_INVALID",
      );
    }
    const isMetaFlowReply = isFlowReply && event.provider === "meta";
    let workerPaymentTerminalReceipt = null;
    const flowConsumption = isMetaFlowReply
      ? (
          await consumeWhatsAppFlowSession(transaction, {
            tokenEvidence: event.interactive?.flowToken,
            consumedExternalId: event.externalId,
            organizationId: normalized.organizationId,
            projectId: normalized.projectId,
            workerId: resolution.worker.id,
            phoneNumberId: normalized.phoneNumberId,
            recipientPhone: resolution.normalizedPhone,
          }, {
            recoverExpired: true,
            beforeConsume: async (_prisma, { session }) => {
              if (session.blueprintKey !== WORKER_PAYMENT_FLOW_BLUEPRINT_KEY) return;
              try {
                workerPaymentTerminalReceipt = await assertWorkerPaymentFlowTerminalReceipt(
                  transaction,
                  {
                    session,
                    connectionId: project.whatsapp.id,
                    response: event.interactive?.response || {},
                  },
                );
              } catch (error) {
                if (
                  error instanceof WorkerPaymentFlowSessionError
                  && error.status < 500
                ) {
                  throw webhookProcessingError(
                    "The payment Flow receipt does not match its terminal session.",
                    "WHATSAPP_FLOW_SESSION_INVALID",
                  );
                }
                throw error;
              }
            },
          })
        )
      : null;
    const terminalPaymentFlow = Boolean(workerPaymentTerminalReceipt);
    let workerPaymentPrivateReceiptDelivery = null;
    if (terminalPaymentFlow) {
      const paymentSession = workerPaymentTerminalReceipt.paymentSession;
      const issuedReceipt = await issueWorkerPaymentPrivateReceiptInTransaction(
        transaction,
        {
          organizationId: normalized.organizationId,
          projectId: normalized.projectId,
          connectionId: project.whatsapp.id,
          flowSessionId: paymentSession.flowSessionId,
          workerId: resolution.worker.id,
          personId: paymentSession.personId,
          channelIdentityId: paymentSession.channelIdentityId,
          sourceWebhookEventId: normalized.eventId,
          consumedExternalId: event.externalId,
        },
      );
      workerPaymentPrivateReceiptDelivery = issuedReceipt?.descriptor || null;
    }
    const flowSession = flowConsumption?.expired && !terminalPaymentFlow
      ? null
      : flowConsumption?.session || null;
    const expiredFlowSession = flowConsumption?.expired && !terminalPaymentFlow
      ? flowConsumption.session
      : null;
    const expiredFlowCanReissue = Boolean(
      expiredFlowSession
      && getPublishedWhatsAppFlowReference(
        project.whatsapp.metadata,
        expiredFlowSession.blueprintKey,
      ),
    );

    const state = project.snapshot?.state
      ? clone(project.snapshot.state)
      : createEmptyAppState();
    const projectSettings = {
      id: project.id,
      organizationId: project.organizationId,
      latitude: project.latitude == null ? null : Number(project.latitude),
      longitude: project.longitude == null ? null : Number(project.longitude),
      geofenceMeters: project.geofenceMeters,
      timezone: project.organization?.timezone || "America/Argentina/Buenos_Aires",
    };
    let result = await apply({
      prisma: transaction,
      state,
      projectSettings,
      worker: resolution.worker,
      workerPaymentFlowEligible: Boolean(workerPaymentFlowBinding),
      flowSession,
      expiredFlowSession,
      expiredFlowCanReissue,
    });
    if (!result || !Array.isArray(result.newMessages)) {
      throw webhookProcessingError(
        "The WhatsApp engine did not return persistable message effects.",
        "WEBHOOK_OUTCOME_INVALID",
      );
    }
    if (workerPaymentPrivateReceiptDelivery) {
      result = attachWorkerPaymentPrivateReceiptDelivery(
        result,
        workerPaymentPrivateReceiptDelivery,
      );
    }
    assertExpiredWhatsAppFlowRecoveryResult(expiredFlowSession, result);
    const paymentFlowRequested = result.flowPrompt === WORKER_PAYMENT_FLOW_BLUEPRINT_KEY;
    if (paymentFlowRequested && !workerPaymentFlowBinding) {
      result = suppressWorkerPaymentFlowPrompt(
        result,
        "Para proteger tus datos de cobro, la empresa debe verificar tu identidad laboral y vincular este WhatsApp antes de habilitar el formulario. No envíes CBU, CVU ni alias por el chat.",
        "IDENTITY_OR_CHANNEL_NOT_VERIFIED",
      );
    }
    let issuedFlowSession = null;
    if (result.flowPrompt) {
      const publishedFlow = getPublishedWhatsAppFlowReference(
        project.whatsapp.metadata,
        result.flowPrompt,
      );
      if (publishedFlow) {
        const baseInput = {
          organizationId: normalized.organizationId,
          projectId: normalized.projectId,
          workerId: resolution.worker.id,
          phoneNumberId: normalized.phoneNumberId,
          recipientPhone: resolution.normalizedPhone,
          blueprintKey: publishedFlow.blueprintKey,
          flowId: publishedFlow.id,
          screenId: publishedFlow.screenId,
          flowType: publishedFlow.flowType,
          sourceExternalId: event.externalId,
        };
        if (result.flowPrompt === WORKER_PAYMENT_FLOW_BLUEPRINT_KEY) {
          const notice = getCurrentWorkerPaymentPrivacyNotice();
          issuedFlowSession = (
            await issueWorkerPaymentFlowSessionInTransaction(transaction, {
              ...baseInput,
              connectionId: project.whatsapp.id,
              personId: workerPaymentFlowBinding.personId,
              channelIdentityId: workerPaymentFlowBinding.channelIdentityId,
              notice: {
                version: notice.version,
                contentSha256: notice.contentSha256,
              },
            }, {
              ttlMs: getWhatsAppFlowSessionTtlMs(publishedFlow.blueprintKey),
            })
          ).session;
        } else {
          issuedFlowSession = (
            await issueWhatsAppFlowSession(transaction, baseInput, {
              ttlMs: getWhatsAppFlowSessionTtlMs(publishedFlow.blueprintKey),
            })
          ).session;
        }
      } else if (result.flowPrompt === WORKER_PAYMENT_FLOW_BLUEPRINT_KEY) {
        result = suppressWorkerPaymentFlowPrompt(
          result,
          "Tu identidad y este WhatsApp están verificados, pero el formulario protegido de cobro todavía no está habilitado por la empresa. No envíes CBU, CVU ni alias por el chat.",
          "FLOW_NOT_PUBLISHED",
        );
      }
    }
    const mediaAssetId = managedWhatsAppMediaAssetId(event);
    if (progressEvidenceLocationCaptureEligible(event, result, mediaAssetId)) {
      const capture = await issueProgressEvidenceCaptureSession(transaction, {
        scope: {
          organizationId: normalized.organizationId,
          projectId: normalized.projectId,
        },
        workerId: resolution.worker.id,
        connectionId: project.whatsapp.id,
        mediaAssetId,
      });
      result = attachProgressEvidenceLocationPrompt(result, {
        session: capture.session,
      });
    }
    let secureWebviewDelivery = null;
    try {
      secureWebviewDelivery = extractSecureWebviewDelivery(result.reply, {
        projectId: normalized.projectId,
      });
    } catch {
      throw webhookProcessingError(
        "The secure webview could not be converted into a non-secret delivery descriptor.",
        "WEBHOOK_OUTCOME_INVALID",
      );
    }
    const outcome = createMessageWebhookOutcome({
      ...result,
      flowSessionId: issuedFlowSession?.id || null,
      secureWebviewDelivery,
    });

    if (result.stateChanged) {
      const nextVersion = (project.snapshot?.version ?? 0) + 1;
      await synchronizeProjectTaskProjection(transaction, {
        projectId: project.id,
        nextTasks: state.tasks,
        projectStartsAt: project.startsAt,
        stateVersion: nextVersion,
      });
      await transaction.projectSnapshot.upsert({
        where: { projectId: project.id },
        update: { state, version: { increment: 1 } },
        create: { projectId: project.id, state },
      });
    }
    const automaticMessages = prepareAutomaticWebhookMessages(result.newMessages, {
      eventId: normalized.eventId,
      inboundExternalId: event.externalId,
    });
    const persistedMessages = await appendDurableMessages(
      { prisma: transaction, project },
      automaticMessages,
      {
        conversationIdentity: whatsAppConversationIdentity({
          ...event,
          displayName: resolution.worker.name,
        }),
      },
    );
    if (mediaAssetId) {
      const inboundMessages = persistedMessages.filter((message) => (
        message?.direction === "INBOUND"
        && message.externalId === event.externalId
        && typeof message.id === "string"
        && typeof message.conversationId === "string"
      ));
      if (inboundMessages.length !== 1) {
        throw webhookProcessingError(
          "Managed WhatsApp media requires one durable inbound message.",
          "WEBHOOK_OUTCOME_INVALID",
        );
      }
      await claimWhatsAppMediaAsset(transaction, {
        scope: normalized,
        mediaAssetId,
        messageConversationId: inboundMessages[0].conversationId,
        messageId: inboundMessages[0].id,
      });
    }

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

export async function claimAutomaticWhatsAppDelivery({
  eventId,
  leaseToken,
  inboundExternalId,
  scope,
  now = new Date(),
}) {
  const claimedAt = new Date(now);
  if (Number.isNaN(claimedAt.getTime())) {
    throw webhookProcessingError(
      "A valid claim time is required for automatic WhatsApp delivery.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  const normalized = automaticWhatsAppDeliveryInput({
    eventId,
    leaseToken,
    inboundExternalId,
    scope,
  });
  if (!hasDurableDatabase()) {
    throw webhookProcessingError(
      "Automatic WhatsApp delivery requires durable storage.",
      "WEBHOOK_DURABLE_STORAGE_REQUIRED",
    );
  }

  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma().$transaction(async (transaction) => {
    await lockProjectTransaction(transaction, normalized.projectId);
    await requireAutomaticWhatsAppDeliveryProject(transaction, normalized);
    const leasedEvent = await requireAutomaticWhatsAppDeliveryEvent(transaction, normalized);
    const deliveryScope = {
      ...normalized,
      conversationExternalId: leasedEvent.conversationExternalId,
    };

    const message = await transaction.message.findUnique({
      where: { externalId: normalized.outboundExternalId },
      select: {
        id: true,
        conversationId: true,
        externalId: true,
        providerMessageId: true,
        direction: true,
        status: true,
        metadata: true,
        conversation: {
          select: {
            projectId: true,
            channel: true,
            externalId: true,
          },
        },
      },
    });
    if (!message) {
      return {
        dispatch: false,
        state: "unknown",
        reason: "message_missing",
      };
    }
    if (!automaticWhatsAppMessageInScope(message, deliveryScope)) {
      throw webhookProcessingError(
        "The automatic outbound message crossed its tenant conversation boundary.",
        "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
      );
    }

    const status = typeof message.status === "string"
      ? message.status.trim().toLowerCase()
      : null;
    if (AUTOMATIC_WHATSAPP_DELIVERY_FINAL_STATES.has(status)) {
      return {
        dispatch: false,
        state: status,
        reason: ["failed", "unknown"].includes(status) ? "terminal" : "already_dispatched",
        ...(["accepted", "sent", "delivered", "read"].includes(status)
          ? { providerMessageId: message.providerMessageId || null }
          : {}),
      };
    }

    const prepared = message.status === "prepared"
      && message.providerMessageId == null
      && automaticWhatsAppJournalMatches(
        message.metadata,
        normalized.eventId,
        "prepared",
      );
    if (prepared) {
      const claimed = await transaction.message.updateMany({
        where: {
          id: message.id,
          conversationId: message.conversationId,
          status: "prepared",
          providerMessageId: null,
        },
        data: {
          status: "sending",
          metadata: automaticWhatsAppDeliveryMetadata(
            message.metadata,
            normalized.eventId,
            "sending",
            claimedAt,
          ),
        },
      });
      if (claimed.count === 1) {
        return {
          dispatch: true,
          state: "sending",
          claim: {
            version: AUTOMATIC_WHATSAPP_DELIVERY_VERSION,
            eventId: normalized.eventId,
            leaseToken: normalized.leaseToken,
            projectId: normalized.projectId,
            organizationId: normalized.organizationId,
            phoneNumberId: normalized.phoneNumberId,
            messageId: message.id,
            outboundExternalId: normalized.outboundExternalId,
          },
        };
      }
      return {
        dispatch: false,
        state: "unknown",
        reason: "CLAIM_CONFLICT",
      };
    }

    // A prior sender can have reached Meta even when no provider response was
    // durably recorded. Re-encountered sending, legacy null and malformed
    // prepared rows are therefore retired as unknown instead of being retried.
    const retired = await transaction.message.updateMany({
      where: {
        id: message.id,
        conversationId: message.conversationId,
        status: message.status,
      },
      data: {
        status: "unknown",
        metadata: automaticWhatsAppDeliveryMetadata(
          message.metadata,
          normalized.eventId,
          "unknown",
          claimedAt,
          { failureCode: "STALE_DISPATCH_CLAIM" },
        ),
      },
    });
    return {
      dispatch: false,
      state: "unknown",
      reason: retired.count === 1 ? "STALE_DISPATCH_CLAIM" : "CLAIM_CONFLICT",
    };
  }, { maxWait: 5_000, timeout: 10_000 });
}

export async function settleAutomaticWhatsAppDelivery({
  claim: suppliedClaim,
  state,
  providerMessageId,
  failureCode,
  providerStatus,
  providerCode,
  now = new Date(),
}) {
  const settledAt = new Date(now);
  if (Number.isNaN(settledAt.getTime())) {
    throw webhookProcessingError(
      "A valid settlement time is required for automatic WhatsApp delivery.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  const claim = automaticWhatsAppDeliveryClaim(suppliedClaim);
  const normalizedState = typeof state === "string" ? state.trim().toLowerCase() : "";
  const providerIdSupplied = providerMessageId !== undefined && providerMessageId !== null;
  const normalizedProviderMessageId = typeof providerMessageId === "string"
    ? providerMessageId.trim()
    : "";
  if (
    !AUTOMATIC_WHATSAPP_DELIVERY_SETTLEMENT_STATES.has(normalizedState)
    || (
      normalizedState === "accepted"
        ? !normalizedProviderMessageId || normalizedProviderMessageId.length > 500
        : providerIdSupplied
    )
  ) {
    throw webhookProcessingError(
      "The automatic WhatsApp delivery settlement is invalid.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  const failureEvidence = automaticWhatsAppFailureEvidence({
    failureCode,
    providerStatus,
    providerCode,
    state: normalizedState,
  });
  if (!hasDurableDatabase()) {
    throw webhookProcessingError(
      "Automatic WhatsApp delivery settlement requires durable storage.",
      "WEBHOOK_DURABLE_STORAGE_REQUIRED",
    );
  }

  const normalized = {
    ...claim,
    inboundExternalId: claim.outboundExternalId.slice("obrasaas-reply:".length),
  };
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma().$transaction(async (transaction) => {
    await lockProjectTransaction(transaction, claim.projectId);
    await requireAutomaticWhatsAppDeliveryProject(transaction, normalized);
    const leasedEvent = await requireAutomaticWhatsAppDeliveryEvent(transaction, normalized);
    const deliveryScope = {
      ...normalized,
      conversationExternalId: leasedEvent.conversationExternalId,
    };

    const message = await transaction.message.findUnique({
      where: { id: claim.messageId },
      select: {
        id: true,
        conversationId: true,
        externalId: true,
        providerMessageId: true,
        direction: true,
        status: true,
        metadata: true,
        conversation: {
          select: {
            projectId: true,
            channel: true,
            externalId: true,
          },
        },
      },
    });
    if (!automaticWhatsAppMessageInScope(message, deliveryScope)) {
      throw webhookProcessingError(
        "The claimed automatic outbound message crossed its tenant conversation boundary.",
        "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
      );
    }

    const currentState = typeof message.status === "string"
      ? message.status.trim().toLowerCase()
      : "unknown";
    if (currentState !== "sending") {
      if (
        normalizedState === "accepted"
        && currentState === "accepted"
        && message.providerMessageId
        && message.providerMessageId !== normalizedProviderMessageId
      ) {
        throw webhookProcessingError(
          "The automatic outbound message is already bound to a different Meta message.",
          "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
        );
      }
      return {
        settled: false,
        state: currentState,
        reason: "already_settled",
        ...(["accepted", "sent", "delivered", "read"].includes(currentState)
          ? { providerMessageId: message.providerMessageId || null }
          : {}),
      };
    }
    if (
      message.providerMessageId != null
      || !automaticWhatsAppJournalMatches(message.metadata, claim.eventId, "sending")
    ) {
      throw webhookProcessingError(
        "The automatic WhatsApp delivery journal no longer matches its claim.",
        "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
      );
    }

    if (normalizedState === "accepted") {
      const conflict = await transaction.message.findUnique({
        where: { providerMessageId: normalizedProviderMessageId },
        select: { id: true },
      });
      if (conflict && conflict.id !== message.id) {
        throw webhookProcessingError(
          "The Meta message ID belongs to another outbound message.",
          "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
        );
      }
    }

    const settled = await transaction.message.updateMany({
      where: {
        id: message.id,
        conversationId: message.conversationId,
        status: "sending",
        providerMessageId: null,
      },
      data: {
        status: normalizedState,
        metadata: automaticWhatsAppDeliveryMetadata(
          message.metadata,
          claim.eventId,
          normalizedState,
          settledAt,
          failureEvidence,
        ),
        ...(normalizedState === "accepted"
          ? { providerMessageId: normalizedProviderMessageId }
          : {}),
      },
    });
    if (settled.count !== 1) {
      return {
        settled: false,
        state: "unknown",
        reason: "settlement_conflict",
      };
    }
    return {
      settled: true,
      state: normalizedState,
    };
  }, { maxWait: 5_000, timeout: 10_000 });
}

/**
 * Releases a won delivery claim only while the caller can still prove that no
 * provider request started. Ambiguous/post-dispatch paths must use terminal
 * settlement instead and are never eligible for this CAS.
 */
export async function releaseAutomaticWhatsAppDelivery({
  claim: suppliedClaim,
  now = new Date(),
}) {
  const releasedAt = new Date(now);
  if (Number.isNaN(releasedAt.getTime())) {
    throw webhookProcessingError(
      "A valid release time is required for automatic WhatsApp delivery.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }
  const claim = automaticWhatsAppDeliveryClaim(suppliedClaim);
  if (!hasDurableDatabase()) {
    throw webhookProcessingError(
      "Automatic WhatsApp delivery release requires durable storage.",
      "WEBHOOK_DURABLE_STORAGE_REQUIRED",
    );
  }

  const normalized = {
    ...claim,
    inboundExternalId: claim.outboundExternalId.slice("obrasaas-reply:".length),
  };
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma().$transaction(async (transaction) => {
    await lockProjectTransaction(transaction, claim.projectId);
    await requireAutomaticWhatsAppDeliveryProject(transaction, normalized);
    const leasedEvent = await requireAutomaticWhatsAppDeliveryEvent(transaction, normalized);
    const deliveryScope = {
      ...normalized,
      conversationExternalId: leasedEvent.conversationExternalId,
    };
    const message = await transaction.message.findUnique({
      where: { id: claim.messageId },
      select: {
        id: true,
        conversationId: true,
        externalId: true,
        providerMessageId: true,
        direction: true,
        status: true,
        metadata: true,
        conversation: {
          select: {
            projectId: true,
            channel: true,
            externalId: true,
          },
        },
      },
    });
    if (!automaticWhatsAppMessageInScope(message, deliveryScope)) {
      throw webhookProcessingError(
        "The releasable automatic outbound message crossed its tenant conversation boundary.",
        "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
      );
    }
    const currentState = typeof message.status === "string"
      ? message.status.trim().toLowerCase()
      : "unknown";
    if (
      currentState === "prepared"
      && message.providerMessageId == null
      && automaticWhatsAppJournalMatches(message.metadata, claim.eventId, "prepared")
    ) {
      return { released: false, state: "prepared", reason: "already_released" };
    }
    if (currentState !== "sending") {
      return { released: false, state: currentState, reason: "already_settled" };
    }
    if (
      message.providerMessageId != null
      || !automaticWhatsAppJournalMatches(message.metadata, claim.eventId, "sending")
    ) {
      throw webhookProcessingError(
        "The automatic WhatsApp delivery journal no longer matches its pre-provider claim.",
        "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
      );
    }
    const released = await transaction.message.updateMany({
      where: {
        id: message.id,
        conversationId: message.conversationId,
        status: "sending",
        providerMessageId: null,
      },
      data: {
        status: "prepared",
        metadata: automaticWhatsAppPreProviderReleaseMetadata(
          message.metadata,
          claim.eventId,
          releasedAt,
        ),
      },
    });
    return released.count === 1
      ? { released: true, state: "prepared" }
      : { released: false, state: "unknown", reason: "release_conflict" };
  }, { maxWait: 5_000, timeout: 10_000 });
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
  const mediaAssetId = managedWhatsAppMediaAssetId(event);
  if (mediaAssetId) {
    const mediaAsset = await context.prisma.whatsAppMediaAsset.findFirst({
      where: {
        id: mediaAssetId,
        organizationId: context.organization.id,
        projectId: context.project.id,
        webhookEventId: normalizedEventId,
        status: { in: ["AVAILABLE", "CLAIMED"] },
      },
      select: WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT,
    });
    if (!mediaAsset) {
      throw webhookProcessingError(
        "Managed WhatsApp media does not belong to the leased webhook.",
        "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
      );
    }
    const descriptor = whatsAppMediaAssetDescriptor(mediaAsset, {
      scope: {
        organizationId: context.organization.id,
        projectId: context.project.id,
      },
    });
    assertManagedWhatsAppMediaEvent(event, mediaAsset, descriptor);
  }
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
  const [message, conflict] = await Promise.all([
    context.prisma.message.findUnique({
      where: { externalId: outboundExternalId },
      select: {
        id: true,
        conversationId: true,
        conversation: {
          select: { projectId: true, channel: true, externalId: true },
        },
      },
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
  if (
    message.conversation?.projectId !== context.project.id
    || message.conversation?.channel !== "whatsapp"
    || !String(message.conversation?.externalId || "").startsWith("meta:")
  ) {
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
    const message = await transaction.message.findUnique({
      where: { providerMessageId: providerId },
      select: {
        id: true,
        conversationId: true,
        status: true,
        conversation: {
          select: { projectId: true, channel: true, externalId: true },
        },
      },
    });
    if (!message) return false;
    if (
      message.conversation?.projectId !== context.project.id
      || message.conversation?.channel !== "whatsapp"
      || !String(message.conversation?.externalId || "").startsWith("meta:")
    ) {
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
    const snapshot = await saveAppStateSnapshot(fresh.appState, scope, {
      expectedVersion,
      preserveAttendanceProjection: true,
    });
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
      preserveAttendanceProjection: true,
    });
    await replaceDurableMessages(transactionContext, fresh.messages);
    return stored;
  });
  fresh.appState = snapshot.state;
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
      timezone: process.env.PROJECT_TIMEZONE || "America/Argentina/Buenos_Aires",
    };
  }

  const { project } = await durableContext(scope);
  return {
    id: project.id,
    latitude: project.latitude == null ? null : Number(project.latitude),
    longitude: project.longitude == null ? null : Number(project.longitude),
    geofenceMeters: project.geofenceMeters,
    organizationId: project.organizationId,
    timezone: project.organization?.timezone || "America/Argentina/Buenos_Aires",
  };
}
