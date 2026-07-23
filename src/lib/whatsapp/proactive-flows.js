import { createHash } from 'node:crypto';

import {
  FIELD_WORKER_RESOLUTION,
  resolveActiveFieldWorkerByPhone,
} from '@/lib/field-workers';
import { subscriptionAllowsWrites } from '@/lib/plans';
import {
  ProjectWritePolicyError,
  requireOperationalProjectWrite,
} from '@/lib/project-write-policy';
import {
  deriveStoredWhatsAppChannelReadiness,
  whatsAppPlatformConfiguration,
} from '@/lib/whatsapp/channel-health';
import {
  getPublishedWhatsAppFlowReference,
  getWhatsAppFlowCatalog,
  getWhatsAppFlowSessionTtlMs,
} from '@/lib/whatsapp/flows';
import {
  assertWhatsAppFlowTokenSecret,
  getWhatsAppFlowSessionForDelivery,
  issueWhatsAppFlowSession,
  markWhatsAppFlowSessionDeliveryAttempted,
  markWhatsAppFlowSessionDeliveryRejected,
  markWhatsAppFlowSessionSent,
  WhatsAppFlowSessionError,
} from '@/lib/whatsapp/flow-sessions';
import { sendWhatsAppFlowTemplate } from '@/lib/whatsapp/meta';
import {
  buildOwnedWhatsAppFlowTemplate,
  WHATSAPP_FLOW_TEMPLATE_LANGUAGE,
} from '@/lib/whatsapp/templates';

const META_CONVERSATION_PREFIX = 'meta:';
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const BLUEPRINT_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const PROVIDER_MESSAGE_ID_PATTERN = /^[^\u0000-\u001f\u007f]{1,500}$/;
const SEND_REQUEST_ACTION = 'whatsapp.inbox.flow_template_send_requested';
const UNCERTAINTY_RESOLUTION_ACTION = 'whatsapp.inbox.flow_template_uncertainty_resolved';
const UNCERTAINTY_CONFIRMATION = 'ACEPTO_RIESGO_DE_DUPLICADO';
const STALE_SEND_MS = 2 * 60 * 1_000;
const RATE_LIMITS = Object.freeze({
  actorPerMinute: 10,
  organizationPerMinute: 60,
  conversationPerMinute: 5,
});

export class WhatsAppProactiveFlowError extends Error {
  constructor(message, {
    code = 'WHATSAPP_PROACTIVE_FLOW_ERROR',
    status = 400,
    retryAfterSeconds = null,
    details = null,
  } = {}) {
    super(message);
    this.name = 'WhatsAppProactiveFlowError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.details = details;
  }
}

function validDate(value) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function observedDate(clock) {
  const value = typeof clock === 'function' ? clock() : clock;
  return validDate(value) || new Date();
}

function jsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function trustedScope(access) {
  const organizationId = String(access?.organization?.id || '').trim();
  const projectId = String(access?.project?.id || '').trim();
  if (!organizationId || !projectId) {
    throw new WhatsAppProactiveFlowError('No hay una obra activa para este envío.', {
      code: 'PROJECT_SCOPE_REQUIRED',
      status: 403,
    });
  }
  return { organizationId, projectId };
}

function normalizePhone(value) {
  const source = String(value || '').trim();
  if (!/^\+?[0-9][0-9 ()-]{6,24}$/.test(source)) return '';
  const digits = source.replace(/\D/g, '');
  return /^\d{8,20}$/.test(digits) ? digits : '';
}

function conversationPhone(conversation) {
  const externalId = String(conversation?.externalId || '');
  return externalId.startsWith(META_CONVERSATION_PREFIX)
    ? normalizePhone(externalId.slice(META_CONVERSATION_PREFIX.length))
    : '';
}

function configurationReady(env) {
  return Object.values(whatsAppPlatformConfiguration(env)).every(Boolean);
}

function flowSecretError({ env, flowSessionSecret }) {
  try {
    assertWhatsAppFlowTokenSecret(
      flowSessionSecret ?? env?.WHATSAPP_FLOW_TOKEN_SECRET,
    );
    return null;
  } catch (error) {
    return new WhatsAppProactiveFlowError(
      'La firma segura de los formularios todavía no está configurada.',
      {
        code: error?.code || 'WHATSAPP_FLOW_TOKEN_SECRET_REQUIRED',
        status: error?.status || 503,
      },
    );
  }
}

function channelReadiness(connection, env, now) {
  return deriveStoredWhatsAppChannelReadiness({ connection, env, now });
}

function channelOperational(connection, env, now) {
  if (
    !connection?.enabled
    || connection.connectionStatus !== 'CONNECTED'
    || !connection.encryptedAccessToken
    || !connection.phoneNumberId
    || !connection.whatsappBusinessId
  ) return false;
  const readiness = channelReadiness(connection, env, now);
  const account = readiness.checks.account;
  return Boolean(
    readiness.checks.platform.configured
    && account.linked
    && account.enabled
    && account.tokenStatus === 'VALID'
    && account.scopesVerified
    && account.phoneStatus === 'REGISTERED'
    && account.qualityStatus !== 'DEGRADED'
    && account.providerStatus !== 'DEGRADED'
    && readiness.checks.webhook.subscriptionStatus === 'SUBSCRIBED'
  );
}

function scopedConversation(prisma, scope, conversationId) {
  const id = String(conversationId || '').trim();
  if (!id) return null;
  return prisma.conversation.findFirst({
    where: {
      id,
      projectId: scope.projectId,
      project: { organizationId: scope.organizationId },
      channel: 'whatsapp',
      externalId: { startsWith: META_CONVERSATION_PREFIX },
    },
    select: { id: true, externalId: true, displayName: true, updatedAt: true },
  });
}

async function readState(prisma, scope, conversationId, { lockWrites = false } = {}) {
  if (lockWrites) {
    await requireOperationalProjectWrite(prisma, scope);
    await prisma.$queryRawUnsafe(
      'SELECT id FROM "Organization" WHERE id = $1 FOR SHARE',
      scope.organizationId,
    );
  }
  const conversation = await scopedConversation(prisma, scope, conversationId);
  if (!conversation) {
    throw new WhatsAppProactiveFlowError(
      'La conversación ya no está disponible en esta obra.',
      { code: 'INBOX_CONVERSATION_NOT_FOUND', status: 404 },
    );
  }
  const [project, connection, inbound] = await Promise.all([
    prisma.project.findFirst({
      where: { id: scope.projectId, organizationId: scope.organizationId },
      include: { organization: true },
    }),
    prisma.whatsAppConnection.findUnique({
      where: { projectId: scope.projectId },
      select: {
        id: true,
        phoneNumberId: true,
        whatsappBusinessId: true,
        enabled: true,
        connectionStatus: true,
        encryptedAccessToken: true,
        lastError: true,
        metadata: true,
        flowEndpoint: {
          select: {
            id: true,
            enabled: true,
            updatedAt: true,
            keys: {
              where: { status: 'ACTIVE' },
              orderBy: { version: 'desc' },
              take: 1,
              select: {
                status: true,
                version: true,
                publicKeySha256: true,
                verifiedAt: true,
              },
            },
          },
        },
      },
    }),
    prisma.message.findFirst({
      where: { conversationId: conversation.id, direction: 'INBOUND' },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, externalId: true, sentAt: true, createdAt: true },
    }),
  ]);
  const recipient = conversationPhone(conversation);
  const workerResolution = recipient
    ? await resolveActiveFieldWorkerByPhone(prisma, scope, recipient)
    : {
        status: FIELD_WORKER_RESOLUTION.INVALID_PHONE,
        worker: null,
        normalizedPhone: null,
      };
  return { conversation, project, connection, inbound, recipient, workerResolution };
}

function capabilityError(state, { canManage, env, now, flowSessionSecret }) {
  if (!canManage) {
    return new WhatsAppProactiveFlowError(
      'Tu rol puede leer la conversación, pero no enviar formularios.',
      { code: 'WHATSAPP_MANAGE_PERMISSION_REQUIRED', status: 403 },
    );
  }
  if (!state.project || !['PLANNING', 'ACTIVE', 'PAUSED'].includes(state.project.status)) {
    return new WhatsAppProactiveFlowError('La obra está en modo solo lectura.', {
      code: 'PROJECT_READ_ONLY',
      status: 409,
    });
  }
  if (!subscriptionAllowsWrites(state.project.organization, now)) {
    return new WhatsAppProactiveFlowError('El plan actual no permite enviar formularios.', {
      code: 'SUBSCRIPTION_WRITE_BLOCKED',
      status: 402,
    });
  }
  if (!configurationReady(env)) {
    return new WhatsAppProactiveFlowError(
      'La configuración segura de Meta todavía está incompleta.',
      { code: 'WHATSAPP_PLATFORM_NOT_READY', status: 409 },
    );
  }
  const secretError = flowSecretError({ env, flowSessionSecret });
  if (secretError) return secretError;
  if (!channelOperational(state.connection, env, now)) {
    return new WhatsAppProactiveFlowError('WhatsApp no está operativo para esta obra.', {
      code: 'WHATSAPP_CONNECTION_NOT_OPERATIONAL',
      status: 409,
    });
  }
  const flows = channelReadiness(state.connection, env, now).checks.flows;
  if (
    flows.configured !== true
    || flows.endpointStatus !== 'HEALTHY'
    || Number(flows.publishedCount || 0) < 1
  ) {
    return new WhatsAppProactiveFlowError(
      'El Data Endpoint cifrado de WhatsApp Flows no está listo para recibir respuestas.',
      { code: 'WHATSAPP_FLOW_ENDPOINT_NOT_READY', status: 409 },
    );
  }
  if (!state.inbound) {
    return new WhatsAppProactiveFlowError(
      'Este contacto todavía no inició una conversación. ObraSaaS no habilita envíos en frío.',
      { code: 'WHATSAPP_PRIOR_INBOUND_REQUIRED', status: 409 },
    );
  }
  if (!state.recipient) {
    return new WhatsAppProactiveFlowError('El contacto de la conversación no es válido.', {
      code: 'WHATSAPP_CONTACT_INVALID',
      status: 422,
    });
  }
  if (state.workerResolution.status !== FIELD_WORKER_RESOLUTION.RESOLVED) {
    return new WhatsAppProactiveFlowError(
      'Asigná este teléfono a un operario activo de la obra antes de enviar un formulario.',
      { code: 'WHATSAPP_FLOW_WORKER_REQUIRED', status: 409 },
    );
  }
  return null;
}

function assertState(state, options) {
  const error = capabilityError(state, options);
  if (error) throw error;
  return state;
}

function templateStatus(record) {
  const status = String(record?.status || 'NOT_CREATED').toUpperCase();
  const labels = {
    APPROVED: 'Aprobada por Meta',
    REJECTED: 'Rechazada por Meta',
    PAUSED: 'Pausada por Meta',
    DISABLED: 'Pausada por Meta',
    MISSING: 'Requiere reconciliación',
    STALE: 'Requiere reconciliación',
    NOT_CREATED: 'Plantilla no creada',
    FLOW_NOT_PUBLISHED: 'Flow no publicado',
  };
  return { status, label: labels[status] || 'En revisión de Meta' };
}

function recordMatches(record, connection, definition) {
  return Boolean(
    record
    && record.connectionId === connection.id
    && record.whatsappBusinessId === connection.whatsappBusinessId
    && record.blueprintKey === definition.blueprintKey
    && record.name === definition.name
    && record.language === definition.language
    && record.category === definition.category
    && record.contentSha256 === definition.contentSha256
    && record.flowId === definition.flowId
    && record.screenId === definition.screenId
    && record.bodyText === definition.bodyText
    && record.buttonText === definition.buttonText
    && record.providerTemplateId
  );
}

function isUnresolvedFlowMessage(message, blueprintKey = null) {
  const metadata = jsonObject(message?.metadata);
  const status = String(message?.status || '').trim().toLowerCase();
  return ['sending', 'unknown'].includes(status)
    && metadata.messageType === 'whatsapp_flow_template'
    && (!blueprintKey || metadata.blueprintKey === blueprintKey);
}

function publicUnresolvedAttempt(message) {
  if (!message) return null;
  return {
    messageId: String(message.id || ''),
    status: String(message.status || 'unknown').trim().toLowerCase(),
    recordedAt: validDate(message.createdAt)?.toISOString() || null,
    attemptedAt: validDate(message.sentAt)?.toISOString() || null,
  };
}

async function findUnresolvedFlowMessage(prisma, conversationId, blueprintKey) {
  if (!prisma.message?.findFirst) return null;
  const message = await prisma.message.findFirst({
    where: {
      conversationId,
      direction: 'OUTBOUND',
      status: { in: ['sending', 'unknown', 'SENDING', 'UNKNOWN'] },
      AND: [
        {
          metadata: {
            path: ['messageType'],
            equals: 'whatsapp_flow_template',
          },
        },
        {
          metadata: {
            path: ['blueprintKey'],
            equals: blueprintKey,
          },
        },
      ],
    },
    select: {
      id: true,
      externalId: true,
      status: true,
      metadata: true,
      sentAt: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return isUnresolvedFlowMessage(message, blueprintKey) ? message : null;
}

async function buildCatalog(
  prisma,
  connection,
  { baseAllowed = false, conversationId = null } = {},
) {
  const blueprints = getWhatsAppFlowCatalog();
  const [records, ...unresolved] = await Promise.all([
    connection?.id && prisma.whatsAppFlowTemplate?.findMany
      ? prisma.whatsAppFlowTemplate.findMany({
        where: {
          connectionId: connection.id,
          language: WHATSAPP_FLOW_TEMPLATE_LANGUAGE,
          blueprintKey: { in: blueprints.map((item) => item.key) },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      })
      : [],
    ...blueprints.map((blueprint) => (
      conversationId
        ? findUnresolvedFlowMessage(prisma, conversationId, blueprint.key)
        : null
    )),
  ]);
  return blueprints.map((blueprint) => {
    const published = connection
      ? getPublishedWhatsAppFlowReference(connection.metadata, blueprint.key)
      : null;
    let definition = null;
    if (published) {
      try {
        definition = buildOwnedWhatsAppFlowTemplate({
          connection,
          blueprintKey: blueprint.key,
        });
      } catch {
        definition = null;
      }
    }
    const matching = definition
      ? records.find((record) => recordMatches(record, connection, definition)) || null
      : null;
    const stale = !matching && definition
      ? records.find((record) => record.blueprintKey === blueprint.key) || null
      : null;
    const presented = matching || (stale ? { ...stale, status: 'STALE' } : null);
    const status = templateStatus(
      presented || { status: published ? 'NOT_CREATED' : 'FLOW_NOT_PUBLISHED' },
    );
    const unresolvedAttempt = unresolved.find(
      (message) => isUnresolvedFlowMessage(message, blueprint.key),
    ) || null;
    return {
      key: blueprint.key,
      title: blueprint.title,
      description: blueprint.description,
      capabilities: blueprint.capabilities,
      expiresInMinutes: Math.max(
        1,
        Math.round((getWhatsAppFlowSessionTtlMs(blueprint.key) || 0) / 60_000),
      ),
      template: {
        id: matching?.providerTemplateId || null,
        status: status.status,
        statusLabel: status.label,
        rejectionReason: matching?.rejectionReason || null,
      },
      unresolvedAttempt: publicUnresolvedAttempt(unresolvedAttempt),
      canSend: Boolean(
        baseAllowed
        && matching?.status === 'APPROVED'
        && !unresolvedAttempt,
      ),
    };
  });
}

export async function getProactiveWhatsAppFlowCatalog({
  prisma,
  access,
  conversationId,
  canManage = false,
  clock = () => new Date(),
  env = process.env,
}) {
  const scope = trustedScope(access);
  const now = observedDate(clock);
  const state = await readState(prisma, scope, conversationId);
  const error = capabilityError(state, { canManage, env, now });
  const catalog = await buildCatalog(prisma, state.connection, {
    baseAllowed: !error,
    conversationId: state.conversation.id,
  });
  const anySendable = catalog.some((item) => item.canSend);
  const hasUnresolvedAttempt = catalog.some((item) => item.unresolvedAttempt);
  const capability = error
    ? { allowed: false, code: error.code, reason: error.message }
    : anySendable
      ? { allowed: true, code: 'READY', reason: null }
      : hasUnresolvedAttempt
        ? {
            allowed: false,
            code: 'WHATSAPP_FLOW_TEMPLATE_UNRESOLVED',
            reason: 'Hay un formulario con entrega sin confirmar. Revisalo antes de habilitar otro intento.',
          }
      : {
          allowed: false,
          code: 'WHATSAPP_FLOW_TEMPLATE_NOT_APPROVED',
          reason: 'No hay una plantilla operativa aprobada por Meta para esta obra.',
        };
  if (!capability.allowed) {
    for (const item of catalog) item.canSend = false;
  }
  return {
    capability,
    recipient: state.workerResolution.status === FIELD_WORKER_RESOLUTION.RESOLVED
      ? {
          name: state.workerResolution.worker.name,
          phone: state.workerResolution.normalizedPhone,
        }
      : null,
    catalog,
  };
}

function uncertaintyMessageId(value) {
  const messageId = String(value || '').trim();
  if (!messageId || messageId.length > 191 || /[\u0000-\u001f\u007f]/.test(messageId)) {
    throw new WhatsAppProactiveFlowError('El intento pendiente no es válido.', {
      code: 'WHATSAPP_FLOW_UNCERTAINTY_INPUT_INVALID',
      status: 400,
    });
  }
  return messageId;
}

function deliveryProvenError() {
  return new WhatsAppProactiveFlowError(
    'Hay evidencia de que Meta entregó este formulario. El bloqueo no puede levantarse manualmente.',
    { code: 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_PROVEN', status: 409 },
  );
}

async function invalidateUncertainFlowSession(prisma, session, now) {
  if (!session) {
    throw new WhatsAppProactiveFlowError(
      'No se encontró la sesión segura del intento anterior. El bloqueo se mantiene.',
      { code: 'WHATSAPP_FLOW_UNCERTAINTY_SESSION_MISSING', status: 409 },
    );
  }
  let fenced;
  try {
    fenced = await markWhatsAppFlowSessionDeliveryRejected(
      prisma,
      { sessionId: session.id },
      { now },
    );
  } catch (error) {
    if (error instanceof WhatsAppFlowSessionError) {
      throw new WhatsAppProactiveFlowError(
        'La sesión anterior cambió de estado y no puede invalidarse con seguridad.',
        { code: 'WHATSAPP_FLOW_UNCERTAINTY_SESSION_CONFLICT', status: 409 },
      );
    }
    throw error;
  }
  if (
    !fenced.session.deliveryRejectedAt
    || fenced.session.sentAt
    || fenced.session.consumedAt
  ) {
    throw deliveryProvenError();
  }
  return fenced.session;
}

export async function resolveProactiveWhatsAppFlowUncertainty({
  prisma,
  access,
  conversationId,
  blueprintKey: requestedBlueprint,
  messageId: requestedMessageId,
  confirmation,
  clock = () => new Date(),
}) {
  const scope = trustedScope(access);
  const { key: blueprintKey, blueprint } = selectedBlueprint(requestedBlueprint);
  const messageId = uncertaintyMessageId(requestedMessageId);
  if (String(confirmation || '').trim() !== UNCERTAINTY_CONFIRMATION) {
    throw new WhatsAppProactiveFlowError(
      'Confirmá explícitamente el riesgo de duplicado antes de habilitar otro intento.',
      { code: 'WHATSAPP_FLOW_UNCERTAINTY_CONFIRMATION_REQUIRED', status: 400 },
    );
  }
  const now = observedDate(clock);

  return prisma.$transaction(async (transaction) => {
    await lockSendLane(transaction, scope.organizationId);
    const state = await readState(
      transaction,
      scope,
      conversationId,
      { lockWrites: true },
    );
    const message = await transaction.message.findFirst({
      where: {
        id: messageId,
        conversationId: state.conversation.id,
        direction: 'OUTBOUND',
      },
      select: {
        id: true,
        conversationId: true,
        providerMessageId: true,
        status: true,
        metadata: true,
        sentAt: true,
        createdAt: true,
      },
    });
    const metadata = jsonObject(message?.metadata);
    if (
      !message
      || metadata.messageType !== 'whatsapp_flow_template'
      || metadata.blueprintKey !== blueprintKey
    ) {
      throw new WhatsAppProactiveFlowError('El intento pendiente ya no está disponible.', {
        code: 'WHATSAPP_FLOW_UNCERTAINTY_NOT_FOUND',
        status: 404,
      });
    }
    const session = metadata.flowSessionId
      ? await transaction.whatsAppFlowSession.findUnique({
          where: { id: metadata.flowSessionId },
        })
      : null;
    if (
      message.providerMessageId
      || session?.providerMessageId
      || session?.sentAt
      || session?.consumedAt
    ) {
      throw deliveryProvenError();
    }
    if (
      String(message.status || '').toLowerCase() === 'failed'
      && jsonObject(metadata.uncertaintyResolution).decision === 'ALLOW_NEW_ATTEMPT'
    ) {
      await invalidateUncertainFlowSession(transaction, session, now);
      return {
        conversationId: state.conversation.id,
        flow: { key: blueprintKey, title: blueprint.title },
        resolvedAttempt: publicMessage(message),
        idempotent: true,
      };
    }
    if (!isUnresolvedFlowMessage(message, blueprintKey)) {
      throw new WhatsAppProactiveFlowError(
        'Este intento ya tiene un estado final y no necesita resolución manual.',
        { code: 'WHATSAPP_FLOW_UNCERTAINTY_ALREADY_RESOLVED', status: 409 },
      );
    }
    const claimedAt = validDate(message.sentAt || message.createdAt);
    if (
      String(message.status || '').toLowerCase() === 'sending'
      && claimedAt
      && now.getTime() - claimedAt.getTime() < STALE_SEND_MS
    ) {
      throw new WhatsAppProactiveFlowError(
        'El intento todavía se está procesando. Esperá antes de resolverlo manualmente.',
        {
          code: 'WHATSAPP_FLOW_TEMPLATE_STILL_DISPATCHING',
          status: 409,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((STALE_SEND_MS - (now.getTime() - claimedAt.getTime())) / 1_000),
          ),
        },
      );
    }

    await invalidateUncertainFlowSession(transaction, session, now);

    const resolution = {
      decision: 'ALLOW_NEW_ATTEMPT',
      riskAccepted: true,
      resolvedAt: now.toISOString(),
      resolvedBy: access.databaseUserId || null,
    };
    const updated = await transaction.message.update({
      where: { id: message.id },
      data: {
        status: 'failed',
        metadata: { ...metadata, uncertaintyResolution: resolution },
      },
    });
    await transaction.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        actorId: access.databaseUserId || null,
        action: UNCERTAINTY_RESOLUTION_ACTION,
        entityType: 'Message',
        entityId: message.id,
        metadata: {
          projectId: scope.projectId,
          conversationId: state.conversation.id,
          blueprintKey,
          previousStatus: String(message.status || '').toLowerCase(),
          decision: resolution.decision,
          riskAccepted: true,
        },
      },
    });
    return {
      conversationId: state.conversation.id,
      flow: { key: blueprintKey, title: blueprint.title },
      resolvedAttempt: publicMessage(updated),
      idempotent: false,
    };
  }, { isolationLevel: 'ReadCommitted', maxWait: 5_000, timeout: 15_000 });
}

function normalizedIdempotencyKey(value) {
  const normalized = String(value || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new WhatsAppProactiveFlowError(
      'La operación requiere una clave de idempotencia válida.',
      { code: 'IDEMPOTENCY_KEY_INVALID', status: 400 },
    );
  }
  return normalized;
}

function selectedBlueprint(value) {
  const key = String(value || '').trim();
  if (!BLUEPRINT_KEY_PATTERN.test(key)) {
    throw new WhatsAppProactiveFlowError('El formulario solicitado no es válido.', {
      code: 'WHATSAPP_FLOW_BLUEPRINT_INVALID',
      status: 400,
    });
  }
  const blueprint = getWhatsAppFlowCatalog().find((item) => item.key === key);
  if (!blueprint) {
    throw new WhatsAppProactiveFlowError('El formulario solicitado no existe.', {
      code: 'WHATSAPP_FLOW_BLUEPRINT_NOT_FOUND',
      status: 404,
    });
  }
  return { key, blueprint };
}

function sendIdentity(scope, conversationId, blueprintKey, key) {
  const digest = createHash('sha256')
    .update(
      `obrasaas-whatsapp-flow-template-v1\0${scope.organizationId}\0${scope.projectId}\0${conversationId}\0${blueprintKey}\0${key}`,
    )
    .digest('hex');
  return { externalId: `obrasaas-flow-template:${digest}`, digest };
}

function payloadDigest({ state, definition }) {
  return createHash('sha256')
    .update([
      state.conversation.id,
      state.workerResolution.worker.id,
      state.workerResolution.normalizedPhone,
      definition.blueprintKey,
      definition.contentSha256,
      definition.name,
    ].join('\0'))
    .digest('hex');
}

async function approvedTemplate(prisma, state, blueprintKey) {
  let definition;
  try {
    definition = buildOwnedWhatsAppFlowTemplate({
      connection: state.connection,
      blueprintKey,
    });
  } catch (error) {
    throw new WhatsAppProactiveFlowError(
      error?.message || 'El WhatsApp Flow todavía no está publicado.',
      { code: error?.code || 'WHATSAPP_TEMPLATE_FLOW_NOT_READY', status: 409 },
    );
  }
  const record = await prisma.whatsAppFlowTemplate.findFirst({
    where: {
      connectionId: state.connection.id,
      whatsappBusinessId: state.connection.whatsappBusinessId,
      blueprintKey,
      name: definition.name,
      language: definition.language,
      contentSha256: definition.contentSha256,
      flowId: definition.flowId,
      screenId: definition.screenId,
      status: 'APPROVED',
      providerTemplateId: { not: null },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
  if (!record || !recordMatches(record, state.connection, definition)) {
    throw new WhatsAppProactiveFlowError(
      'La plantilla exacta de este formulario todavía no está aprobada por Meta.',
      { code: 'WHATSAPP_FLOW_TEMPLATE_NOT_APPROVED', status: 409 },
    );
  }
  return { definition, record };
}

function messageMetadata({
  access,
  identity,
  digest,
  blueprintKey,
  template,
  sessionId,
  extra = {},
}) {
  return {
    source: 'dashboard-inbox',
    messageType: 'whatsapp_flow_template',
    actorId: access.databaseUserId || null,
    idempotencyDigest: identity.digest,
    payloadDigest: digest,
    blueprintKey,
    providerTemplateId: template.providerTemplateId,
    templateName: template.name,
    templateLanguage: template.language,
    flowSessionId: sessionId,
    ...extra,
  };
}

function publicMessage(message) {
  const status = String(message?.status || '').trim().toLowerCase();
  const allowed = new Set([
    'sending',
    'accepted',
    'sent',
    'delivered',
    'read',
    'failed',
    'unknown',
  ]);
  return {
    id: message.id,
    direction: 'OUTBOUND',
    kind: 'interactive',
    body: message.body || '',
    status: allowed.has(status) ? status : 'unknown',
    sentAt: validDate(message.sentAt)?.toISOString() || null,
    recordedAt: validDate(message.createdAt)?.toISOString() || null,
  };
}

async function lockSendLane(prisma, organizationId) {
  await prisma.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    `whatsapp-outbound-send:${organizationId}`,
  );
}

async function assertRateLimit(prisma, {
  scope,
  actorId,
  conversationId,
  now,
}) {
  const since = new Date(now.getTime() - 60_000);
  const baseWhere = {
    organizationId: scope.organizationId,
    action: SEND_REQUEST_ACTION,
    createdAt: { gte: since },
  };
  const [actorCount, organizationCount, conversationCount] = await Promise.all([
    actorId ? prisma.auditLog.count({ where: { ...baseWhere, actorId } }) : 0,
    prisma.auditLog.count({ where: baseWhere }),
    prisma.auditLog.count({
      where: {
        ...baseWhere,
        entityType: 'Conversation',
        entityId: conversationId,
      },
    }),
  ]);
  let code = null;
  if (actorCount >= RATE_LIMITS.actorPerMinute) {
    code = 'WHATSAPP_ACTOR_RATE_LIMIT';
  } else if (organizationCount >= RATE_LIMITS.organizationPerMinute) {
    code = 'WHATSAPP_ORGANIZATION_RATE_LIMIT';
  } else if (conversationCount >= RATE_LIMITS.conversationPerMinute) {
    code = 'WHATSAPP_CONVERSATION_RATE_LIMIT';
  }
  if (code) {
    throw new WhatsAppProactiveFlowError(
      'Se alcanzó el límite seguro de formularios. Esperá un minuto antes de continuar.',
      { code, status: 429, retryAfterSeconds: 60 },
    );
  }
}

function providerMessageId(result) {
  const id = String(result?.messages?.[0]?.id || '').trim();
  return PROVIDER_MESSAGE_ID_PATTERN.test(id) ? id : null;
}

function normalizedSendError(error, fallback = {}) {
  if (error instanceof WhatsAppProactiveFlowError) return error;
  if (error instanceof ProjectWritePolicyError || error instanceof WhatsAppFlowSessionError) {
    return new WhatsAppProactiveFlowError(error.message, {
      code: error.code,
      status: error.status,
    });
  }
  return new WhatsAppProactiveFlowError(
    fallback.message || 'No se pudo preparar el formulario de WhatsApp.',
    {
      code: fallback.code || 'WHATSAPP_FLOW_SEND_PREPARATION_FAILED',
      status: fallback.status || 500,
    },
  );
}

async function persistDispatchFailure({
  prisma,
  access,
  scope,
  claim,
  identity,
  digest,
  blueprintKey,
  template,
  sessionId,
  error,
  definitive,
  providerAccepted = false,
  providerMessageId = null,
  clock,
}) {
  const failedAt = observedDate(clock);
  const status = definitive ? 'failed' : 'unknown';
  const failureCode = String(error?.code || error?.name || 'META_FLOW_TEMPLATE_ERROR')
    .trim()
    .slice(0, 80);
  try {
    await prisma.$transaction(async (transaction) => {
      if (providerAccepted && providerMessageId) {
        await markWhatsAppFlowSessionSent(
          transaction,
          { sessionId, providerMessageId },
          { now: failedAt },
        );
      } else if (definitive) {
        await markWhatsAppFlowSessionDeliveryRejected(
          transaction,
          { sessionId },
          { now: failedAt },
        );
      }
      await Promise.all([
        transaction.message.update({
          where: { id: claim.id },
          data: {
            ...(providerAccepted && providerMessageId ? { providerMessageId } : {}),
            status,
            metadata: messageMetadata({
              access,
              identity,
              digest,
              blueprintKey,
              template,
              sessionId,
              extra: {
                failureCode,
                failedAt: failedAt.toISOString(),
                ...(providerAccepted
                  ? {
                      providerAcceptedAt: failedAt.toISOString(),
                      correlationPending: true,
                    }
                  : {}),
              },
            }),
          },
        }),
        transaction.conversation.update({
          where: { id: claim.conversationId },
          data: { updatedAt: failedAt },
        }),
        transaction.auditLog.create({
          data: {
            organizationId: scope.organizationId,
            actorId: access.databaseUserId || null,
            action: providerAccepted
              ? 'whatsapp.inbox.flow_template_correlation_pending'
              : definitive
              ? 'whatsapp.inbox.flow_template_rejected'
              : 'whatsapp.inbox.flow_template_delivery_unknown',
            entityType: 'Message',
            entityId: claim.id,
            metadata: {
              projectId: scope.projectId,
              conversationId: claim.conversationId,
              blueprintKey,
              providerStatus: status,
              providerAccepted,
              failureCode,
            },
          },
        }),
      ]);
    }, { isolationLevel: 'ReadCommitted' });
  } catch (persistenceError) {
    console.error('WhatsApp Flow template failure could not be persisted atomically:', persistenceError);
    try {
      if (providerAccepted && providerMessageId) {
        try {
          await markWhatsAppFlowSessionSent(
            prisma,
            { sessionId, providerMessageId },
            { now: failedAt },
          );
        } catch (sessionFallbackError) {
          console.error(
            'WhatsApp Flow template provider acceptance fence also failed:',
            sessionFallbackError,
          );
        }
      }
      await prisma.message.updateMany({
        where: { id: claim.id, conversationId: claim.conversationId },
        data: {
          status: 'unknown',
          ...(providerAccepted && providerMessageId ? { providerMessageId } : {}),
        },
      });
    } catch (fallbackError) {
      console.error('WhatsApp Flow template fallback status also failed:', fallbackError);
    }
  }
  throw new WhatsAppProactiveFlowError(
    providerAccepted
      ? 'Meta aceptó el formulario, pero su correlación local sigue pendiente. No se habilitará otro intento.'
      : definitive
      ? 'Meta rechazó el formulario. Podés revisar la plantilla y crear un nuevo intento.'
      : 'Meta no confirmó la entrega. No se reenviará automáticamente para evitar duplicados.',
    {
      code: providerAccepted
        ? 'WHATSAPP_FLOW_TEMPLATE_CORRELATION_PENDING'
        : definitive
        ? 'WHATSAPP_FLOW_TEMPLATE_REJECTED'
        : 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_UNKNOWN',
      status: 502,
    },
  );
}

export async function sendProactiveWhatsAppFlowTemplate({
  prisma,
  access,
  conversationId,
  blueprintKey: requestedBlueprint,
  idempotencyKey: requestedIdempotencyKey,
  sendTemplate = sendWhatsAppFlowTemplate,
  flowSessionSecret,
  clock = () => new Date(),
  env = process.env,
}) {
  const scope = trustedScope(access);
  const key = normalizedIdempotencyKey(requestedIdempotencyKey);
  const { key: blueprintKey, blueprint } = selectedBlueprint(requestedBlueprint);
  const now = observedDate(clock);
  const identity = sendIdentity(scope, conversationId, blueprintKey, key);
  const resolvedFlowSessionSecret = flowSessionSecret ?? env?.WHATSAPP_FLOW_TOKEN_SECRET;
  let reservation;
  let expectedPayloadDigest = null;
  let expectedTemplateName = null;

  try {
    reservation = await prisma.$transaction(async (transaction) => {
      await lockSendLane(transaction, scope.organizationId);
      const state = assertState(
        await readState(transaction, scope, conversationId, { lockWrites: true }),
        { canManage: true, env, now, flowSessionSecret: resolvedFlowSessionSecret },
      );
      const { definition, record: template } = await approvedTemplate(
        transaction,
        state,
        blueprintKey,
      );
      const digest = payloadDigest({ state, definition });
      expectedPayloadDigest = digest;
      expectedTemplateName = template.name;
      const existing = await transaction.message.findUnique({
        where: { externalId: identity.externalId },
      });
      if (existing) {
        const metadata = jsonObject(existing.metadata);
        if (
          existing.conversationId !== state.conversation.id
          || metadata.payloadDigest !== digest
          || metadata.blueprintKey !== blueprintKey
          || metadata.templateName !== template.name
        ) {
          throw new WhatsAppProactiveFlowError(
            'La clave de idempotencia ya fue usada con otro formulario.',
            { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', status: 409 },
          );
        }
        const session = metadata.flowSessionId
          ? await transaction.whatsAppFlowSession.findUnique({
              where: { id: metadata.flowSessionId },
            })
          : null;
        const claimedAt = validDate(existing.sentAt || existing.createdAt);
        const stale = claimedAt
          && now.getTime() - claimedAt.getTime() >= STALE_SEND_MS;
        if (
          String(existing.status || '').toLowerCase() === 'sending'
          && stale
          && session
          && !session.deliveryAttemptedAt
          && !session.deliveryRejectedAt
          && !session.sentAt
          && !session.consumedAt
        ) {
          return {
            state,
            definition,
            template,
            digest,
            session,
            message: existing,
            idempotent: true,
            dispatch: true,
          };
        }
        if (
          String(existing.status || '').toLowerCase() === 'sending'
          && stale
          && session?.deliveryAttemptedAt
          && !session.sentAt
          && !session.deliveryRejectedAt
        ) {
          const reconciled = await transaction.message.update({
            where: { id: existing.id },
            data: {
              status: 'unknown',
              metadata: messageMetadata({
                access,
                identity,
                digest,
                blueprintKey,
                template,
                sessionId: session.id,
                extra: {
                  failureCode: 'STALE_PROVIDER_ATTEMPT',
                  failedAt: now.toISOString(),
                },
              }),
            },
          });
          await transaction.auditLog.create({
            data: {
              organizationId: scope.organizationId,
              actorId: access.databaseUserId || null,
              action: 'whatsapp.inbox.flow_template_delivery_unknown',
              entityType: 'Message',
              entityId: existing.id,
              metadata: {
                projectId: scope.projectId,
                conversationId: state.conversation.id,
                blueprintKey,
                providerStatus: 'unknown',
                failureCode: 'STALE_PROVIDER_ATTEMPT',
              },
            },
          });
          return {
            state,
            definition,
            template,
            digest,
            session,
            message: reconciled,
            idempotent: true,
            dispatch: false,
          };
        }
        return {
          state,
          definition,
          template,
          digest,
          session,
          message: existing,
          idempotent: true,
          dispatch: false,
        };
      }

      const unresolved = await findUnresolvedFlowMessage(
        transaction,
        state.conversation.id,
        blueprintKey,
      );
      if (unresolved) {
        throw new WhatsAppProactiveFlowError(
          'Ya existe un intento de este formulario cuya entrega no fue confirmada.',
          {
            code: 'WHATSAPP_FLOW_TEMPLATE_UNRESOLVED',
            status: 409,
            details: { unresolvedAttempt: publicUnresolvedAttempt(unresolved) },
          },
        );
      }

      await assertRateLimit(transaction, {
        scope,
        actorId: access.databaseUserId || null,
        conversationId: state.conversation.id,
        now,
      });
      const issued = await issueWhatsAppFlowSession(transaction, {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        workerId: state.workerResolution.worker.id,
        phoneNumberId: state.connection.phoneNumberId,
        recipientPhone: state.workerResolution.normalizedPhone,
        blueprintKey,
        flowId: definition.flowId,
        screenId: definition.screenId,
        flowType: blueprint.flowType,
        sourceExternalId: identity.externalId,
      }, {
        secret: resolvedFlowSessionSecret,
        now,
        ttlMs: getWhatsAppFlowSessionTtlMs(blueprintKey),
      });
      const message = await transaction.message.create({
        data: {
          conversationId: state.conversation.id,
          externalId: identity.externalId,
          direction: 'OUTBOUND',
          kind: 'INTERACTIVE',
          body: definition.bodyText,
          status: 'sending',
          sentAt: now,
          metadata: messageMetadata({
            access,
            identity,
            digest,
            blueprintKey,
            template,
            sessionId: issued.session.id,
          }),
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: access.databaseUserId || null,
          action: SEND_REQUEST_ACTION,
          entityType: 'Conversation',
          entityId: state.conversation.id,
          metadata: {
            projectId: scope.projectId,
            messageId: message.id,
            blueprintKey,
            payloadDigest: digest,
          },
        },
      });
      return {
        state,
        definition,
        template,
        digest,
        session: issued.session,
        message,
        idempotent: false,
        dispatch: true,
      };
    }, {
      isolationLevel: 'ReadCommitted',
      maxWait: 5_000,
      timeout: 20_000,
    });
  } catch (error) {
    if (error?.code !== 'P2002' && error?.code !== '23505') {
      throw normalizedSendError(error);
    }
    const existing = await prisma.message.findUnique({
      where: { externalId: identity.externalId },
    });
    const metadata = jsonObject(existing?.metadata);
    if (
      !existing
      || existing.conversationId !== String(conversationId || '').trim()
      || metadata.payloadDigest !== expectedPayloadDigest
      || metadata.blueprintKey !== blueprintKey
      || metadata.templateName !== expectedTemplateName
    ) {
      throw new WhatsAppProactiveFlowError(
        'La clave de idempotencia ya fue usada con otro formulario.',
        { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', status: 409 },
      );
    }
    return {
      conversationId: existing.conversationId,
      message: publicMessage(existing),
      flow: { key: blueprintKey, title: blueprint.title },
      idempotent: true,
    };
  }

  if (!reservation.dispatch) {
    return {
      conversationId: reservation.message.conversationId,
      message: publicMessage(reservation.message),
      flow: { key: blueprintKey, title: blueprint.title },
      idempotent: true,
    };
  }

  let delivery;
  try {
    delivery = await prisma.$transaction(async (transaction) => {
      const freshState = assertState(
        await readState(transaction, scope, conversationId, { lockWrites: true }),
        {
          canManage: true,
          env,
          now: observedDate(clock),
          flowSessionSecret: resolvedFlowSessionSecret,
        },
      );
      const freshTemplate = await approvedTemplate(transaction, freshState, blueprintKey);
      if (
        freshTemplate.record.id !== reservation.template.id
        || freshTemplate.definition.contentSha256 !== reservation.definition.contentSha256
        || freshState.workerResolution.worker.id !== reservation.state.workerResolution.worker.id
      ) {
        throw new WhatsAppProactiveFlowError(
          'La plantilla o el destinatario cambiaron antes del envío.',
          { code: 'WHATSAPP_FLOW_SEND_SCOPE_CHANGED', status: 409 },
        );
      }
      const sessionDelivery = await getWhatsAppFlowSessionForDelivery(
        transaction,
        {
          sessionId: reservation.session.id,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          workerId: freshState.workerResolution.worker.id,
          phoneNumberId: freshState.connection.phoneNumberId,
          recipientPhone: freshState.workerResolution.normalizedPhone,
          blueprintKey,
          flowId: freshTemplate.definition.flowId,
          screenId: freshTemplate.definition.screenId,
          flowType: blueprint.flowType,
          sourceExternalId: identity.externalId,
        },
        { secret: resolvedFlowSessionSecret, now: observedDate(clock) },
      );
      const attempt = await markWhatsAppFlowSessionDeliveryAttempted(
        transaction,
        { sessionId: reservation.session.id },
        { now: observedDate(clock) },
      );
      if (attempt.alreadyAttempted) {
        throw new WhatsAppProactiveFlowError(
          'El proveedor ya tiene un intento sin resolver para este formulario.',
          { code: 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_UNKNOWN', status: 502 },
        );
      }
      return {
        state: freshState,
        template: freshTemplate.record,
        definition: freshTemplate.definition,
        token: sessionDelivery.token,
      };
    }, { isolationLevel: 'ReadCommitted', maxWait: 5_000, timeout: 15_000 });
  } catch (error) {
    const failed = normalizedSendError(error);
    if (failed.code === 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_UNKNOWN') {
      return persistDispatchFailure({
        prisma,
        access,
        scope,
        claim: reservation.message,
        identity,
        digest: reservation.digest,
        blueprintKey,
        template: reservation.template,
        sessionId: reservation.session.id,
        error: failed,
        definitive: false,
        clock,
      });
    }
    try {
      await prisma.message.update({
        where: { id: reservation.message.id },
        data: {
          status: 'failed',
          metadata: messageMetadata({
            access,
            identity,
            digest: reservation.digest,
            blueprintKey,
            template: reservation.template,
            sessionId: reservation.session.id,
            extra: {
              failureCode: failed.code,
              failedAt: observedDate(clock).toISOString(),
            },
          }),
        },
      });
    } catch (persistenceError) {
      console.error('Blocked WhatsApp Flow template dispatch could not be persisted:', persistenceError);
    }
    throw failed;
  }

  let providerResult;
  try {
    providerResult = await sendTemplate({
      to: delivery.state.workerResolution.normalizedPhone,
      phoneNumberId: delivery.state.connection.phoneNumberId,
      scope,
      templateName: delivery.template.name,
      language: delivery.template.language,
      flowToken: delivery.token,
    });
  } catch (error) {
    return persistDispatchFailure({
      prisma,
      access,
      scope,
      claim: reservation.message,
      identity,
      digest: reservation.digest,
      blueprintKey,
      template: delivery.template,
      sessionId: reservation.session.id,
      error,
      definitive: error?.code === 'META_FLOW_TEMPLATE_REJECTED',
      clock,
    });
  }

  const wamid = providerMessageId(providerResult);
  if (!wamid) {
    return persistDispatchFailure({
      prisma,
      access,
      scope,
      claim: reservation.message,
      identity,
      digest: reservation.digest,
      blueprintKey,
      template: delivery.template,
      sessionId: reservation.session.id,
      error: Object.assign(new Error('Meta accepted without a message ID.'), {
        code: 'META_PROVIDER_MESSAGE_ID_MISSING',
      }),
      definitive: false,
      clock,
    });
  }

  let accepted;
  try {
    accepted = await prisma.$transaction(async (transaction) => {
      const acceptedAt = observedDate(clock);
      await markWhatsAppFlowSessionSent(
        transaction,
        { sessionId: reservation.session.id, providerMessageId: wamid },
        { now: acceptedAt },
      );
      const message = await transaction.message.update({
        where: { id: reservation.message.id },
        data: {
          providerMessageId: wamid,
          status: 'accepted',
          metadata: messageMetadata({
            access,
            identity,
            digest: reservation.digest,
            blueprintKey,
            template: delivery.template,
            sessionId: reservation.session.id,
            extra: { acceptedAt: acceptedAt.toISOString() },
          }),
        },
      });
      await Promise.all([
        transaction.conversation.update({
          where: { id: reservation.message.conversationId },
          data: { updatedAt: acceptedAt },
        }),
        transaction.auditLog.create({
          data: {
            organizationId: scope.organizationId,
            actorId: access.databaseUserId || null,
            action: 'whatsapp.inbox.flow_template_sent',
            entityType: 'Message',
            entityId: reservation.message.id,
            metadata: {
              projectId: scope.projectId,
              conversationId: reservation.message.conversationId,
              blueprintKey,
              providerStatus: 'accepted',
            },
          },
        }),
      ]);
      return message;
    }, { isolationLevel: 'ReadCommitted', maxWait: 5_000, timeout: 15_000 });
  } catch (error) {
    return persistDispatchFailure({
      prisma,
      access,
      scope,
      claim: reservation.message,
      identity,
      digest: reservation.digest,
      blueprintKey,
      template: delivery.template,
      sessionId: reservation.session.id,
      error: Object.assign(error, { code: error?.code || 'LOCAL_CORRELATION_FAILED' }),
      definitive: false,
      providerAccepted: true,
      providerMessageId: wamid,
      clock,
    });
  }

  return {
    conversationId: reservation.message.conversationId,
    message: publicMessage(accepted),
    flow: { key: blueprintKey, title: blueprint.title },
    idempotent: reservation.idempotent,
  };
}
