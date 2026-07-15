import fs from "node:fs";
import path from "node:path";

const LOCAL_DB_PATH = path.join(process.cwd(), "data", "db.json");
const LOCAL_CONVERSATION_ID = "dashboard-demo";

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

export const defaultAppState = {
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
          appState: clone(defaultAppState),
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
      appState: clone(defaultAppState),
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
      include: { organization: true },
    });
    if (!project) throw new Error("The selected project does not belong to the active organization.");
    return { prisma, organization: project.organization, project };
  }

  if (scope?.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: String(scope.projectId) },
      include: { organization: true },
    });
    if (!project) throw new Error("Unknown project scope.");
    return { prisma, organization: project.organization, project };
  }

  if (scope?.phoneNumberId) {
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { phoneNumberId: String(scope.phoneNumberId) },
      include: { project: { include: { organization: true } } },
    });
    if (!connection?.enabled) throw new Error("Unknown or disabled WhatsApp connection.");
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

export async function getAppState(scope) {
  if (!hasDurableDatabase()) return readLocalDb().appState || clone(defaultAppState);

  const { prisma, project } = await durableContext(scope);
  const snapshot = await prisma.projectSnapshot.findUnique({ where: { projectId: project.id } });
  return snapshot?.state || clone(defaultAppState);
}

export async function saveAppState(state, scope) {
  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    db.appState = state;
    writeLocalDb(db);
    return state;
  }

  const { prisma, project } = await durableContext(scope);
  await prisma.projectSnapshot.upsert({
    where: { projectId: project.id },
    update: { state, version: { increment: 1 } },
    create: { projectId: project.id, state },
  });
  return state;
}

export async function getMessages(scope) {
  if (!hasDurableDatabase()) return readLocalDb().messages || clone(defaultMessages);

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

  return messages.map((message) => {
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
}

export async function saveMessages(messages, scope) {
  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    db.messages = messages;
    writeLocalDb(db);
    return messages;
  }

  const context = await durableContext(scope);
  const conversation = await durableConversation(context);
  await context.prisma.$transaction(async (transaction) => {
    await transaction.message.deleteMany({ where: { conversationId: conversation.id } });
    if (messages.length > 0) {
      await transaction.message.createMany({
        data: messages.map((message, index) => durableMessageData(
          message,
          conversation.id,
          new Date(Date.now() + index),
        )),
      });
    }
  });
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
  const conversation = await durableConversation(context);
  await context.prisma.$transaction(async (transaction) => {
    for (const [index, message] of messages.entries()) {
      const data = durableMessageData(
        message,
        conversation.id,
        new Date(Date.now() + index),
      );
      if (!data.externalId) {
        await transaction.message.create({ data });
        continue;
      }

      const existing = await transaction.message.findUnique({
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
        await transaction.message.update({ where: { id: existing.id }, data: update });
      } else {
        await transaction.message.create({ data });
      }
    }
  });
  return messages;
}

export async function claimWebhookEvent({ provider, externalId, eventType, payload, scope }) {
  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    db.webhookEvents ||= [];
    if (db.webhookEvents.some((event) => event.provider === provider && event.externalId === externalId)) {
      return { claimed: false };
    }
    db.webhookEvents.push({
      provider,
      externalId,
      eventType,
      payload,
      status: "PENDING",
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    writeLocalDb(db);
    return { claimed: true };
  }

  const { prisma, project } = await durableContext(scope);
  try {
    const event = await prisma.webhookEvent.create({
      data: { projectId: project.id, provider, externalId, eventType, payload },
    });
    return { claimed: true, eventId: event.id };
  } catch (error) {
    if (error?.code === "P2002") return { claimed: false };
    throw error;
  }
}

export async function updateWebhookEvent({ provider, externalId, status, error = null }) {
  if (!hasDurableDatabase()) {
    const db = readLocalDb();
    const event = db.webhookEvents?.find(
      (item) => item.provider === provider && item.externalId === externalId,
    );
    if (event) {
      event.status = status;
      event.attempts = (event.attempts || 0) + 1;
      event.lastError = error;
      if (status === "PROCESSED") event.processedAt = new Date().toISOString();
      writeLocalDb(db);
    }
    return;
  }

  const { getPrisma } = await import("@/lib/prisma");
  const prisma = getPrisma();
  await prisma.webhookEvent.update({
    where: { provider_externalId: { provider, externalId } },
    data: {
      status,
      attempts: { increment: 1 },
      lastError: error,
      processedAt: status === "PROCESSED" ? new Date() : null,
    },
  });
}

export async function resetState(scope) {
  const fresh = {
    appState: clone(defaultAppState),
    messages: clone(defaultMessages),
  };
  await saveAppState(fresh.appState, scope);
  await saveMessages(fresh.messages, scope);
  return fresh;
}

export async function resolveWhatsAppScope(phoneNumberId) {
  const scopes = await resolveWhatsAppScopes({ phoneNumberId });
  return scopes[0] || null;
}

export async function resolveWhatsAppScopes({
  phoneNumberId,
  whatsappBusinessId,
  displayPhoneNumber,
} = {}) {
  if (!phoneNumberId && !whatsappBusinessId && !displayPhoneNumber) return [];
  if (!hasDurableDatabase()) {
    return phoneNumberId ? [{ phoneNumberId: String(phoneNumberId) }] : [];
  }

  const { getPrisma } = await import("@/lib/prisma");
  const prisma = getPrisma();
  const identifiers = [
    ...(phoneNumberId ? [{ phoneNumberId: String(phoneNumberId) }] : []),
    ...(whatsappBusinessId ? [{ whatsappBusinessId: String(whatsappBusinessId) }] : []),
    ...(displayPhoneNumber ? [{ displayPhoneNumber: String(displayPhoneNumber) }] : []),
  ];
  const connections = await prisma.whatsAppConnection.findMany({
    where: {
      enabled: true,
      OR: identifiers,
    },
    select: {
      phoneNumberId: true,
      whatsappBusinessId: true,
      displayPhoneNumber: true,
    },
  });
  return connections.map((connection) => ({
    phoneNumberId: connection.phoneNumberId,
    whatsappBusinessId: connection.whatsappBusinessId,
    displayPhoneNumber: connection.displayPhoneNumber,
  }));
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
    latitude: Number(project.latitude ?? process.env.PROJECT_LATITUDE ?? -34.5886),
    longitude: Number(project.longitude ?? process.env.PROJECT_LONGITUDE ?? -58.4302),
    geofenceMeters: project.geofenceMeters,
  };
}
