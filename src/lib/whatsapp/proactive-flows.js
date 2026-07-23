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
  } = {}) {
    super(message);
    this.name = 'WhatsAppProactiveFlowError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
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

function channelOperational(connection, env, now) {
  if (
    !connection?.enabled
    || connection.connectionStatus !== 'CONNECTED'
    || !connection.encryptedAccessToken
    || !connection.phoneNumberId
    || !connection.whatsappBusinessId
  ) return false;
  const readiness = deriveStoredWhatsAppChannelReadiness({ connection, env, now });
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

function capabilityError(state, { canManage, env, now }) {
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
  if (!channelOperational(state.connection, env, now)) {
    return new WhatsAppProactiveFlowError('WhatsApp no está operativo para esta obra.', {
      code: 'WHATSAPP_CONNECTION_NOT_OPERATIONAL',
      status: 409,
    });
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
    && record.contentSha256 === definition.contentSha256
    && record.flowId === definition.flowId
    && record.screenId === definition.screenId
    && record.providerTemplateId
  );
}

async function buildCatalog(prisma, connection, { baseAllowed = false } = {}) {
  const blueprints = getWhatsAppFlowCatalog();
  const records = connection?.id && prisma.whatsAppFlowTemplate?.findMany
    ? await prisma.whatsAppFlowTemplate.findMany({
        where: {
          connectionId: connection.id,
          language: WHATSAPP_FLOW_TEMPLATE_LANGUAGE,
          blueprintKey: { in: blueprints.map((item) => item.key) },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      })
    : [];
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
      canSend: Boolean(baseAllowed && matching?.status === 'APPROVED'),
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
  const catalog = await buildCatalog(prisma, state.connection, { baseAllowed: !error });
  const anySendable = catalog.some((item) => item.canSend);
  const capability = error
    ? { allowed: false, code: error.code, reason: error.message }
    : anySendable
      ? { allowed: true, code: 'READY', reason: null }
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
  clock,
}) {
  const failedAt = observedDate(clock);
  const status = definitive ? 'failed' : 'unknown';
  const failureCode = String(error?.code || error?.name || 'META_FLOW_TEMPLATE_ERROR')
    .trim()
    .slice(0, 80);
  try {
    await prisma.$transaction(async (transaction) => {
      if (definitive) {
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
            status,
            metadata: messageMetadata({
              access,
              identity,
              digest,
              blueprintKey,
              template,
              sessionId,
              extra: { failureCode, failedAt: failedAt.toISOString() },
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
            action: definitive
              ? 'whatsapp.inbox.flow_template_rejected'
              : 'whatsapp.inbox.flow_template_delivery_unknown',
            entityType: 'Message',
            entityId: claim.id,
            metadata: {
              projectId: scope.projectId,
              conversationId: claim.conversationId,
              blueprintKey,
              providerStatus: status,
              failureCode,
            },
          },
        }),
      ]);
    }, { isolationLevel: 'ReadCommitted' });
  } catch (persistenceError) {
    console.error('WhatsApp Flow template failure could not be persisted atomically:', persistenceError);
    try {
      await prisma.message.updateMany({
        where: { id: claim.id, conversationId: claim.conversationId },
        data: { status: 'unknown' },
      });
    } catch (fallbackError) {
      console.error('WhatsApp Flow template fallback status also failed:', fallbackError);
    }
  }
  throw new WhatsAppProactiveFlowError(
    definitive
      ? 'Meta rechazó el formulario. Podés revisar la plantilla y crear un nuevo intento.'
      : 'Meta no confirmó la entrega. No se reenviará automáticamente para evitar duplicados.',
    {
      code: definitive
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
  let reservation;

  try {
    reservation = await prisma.$transaction(async (transaction) => {
      await lockSendLane(transaction, scope.organizationId);
      const state = assertState(
        await readState(transaction, scope, conversationId, { lockWrites: true }),
        { canManage: true, env, now },
      );
      const { definition, record: template } = await approvedTemplate(
        transaction,
        state,
        blueprintKey,
      );
      const digest = payloadDigest({ state, definition });
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
        secret: flowSessionSecret,
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
    if (!existing) throw normalizedSendError(error);
    return {
      message: publicMessage(existing),
      flow: { key: blueprintKey, title: blueprint.title },
      idempotent: true,
    };
  }

  if (!reservation.dispatch) {
    return {
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
        { canManage: true, env, now: observedDate(clock) },
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
        { secret: flowSessionSecret, now: observedDate(clock) },
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
      clock,
    });
  }

  return {
    message: publicMessage(accepted),
    flow: { key: blueprintKey, title: blueprint.title },
    idempotent: reservation.idempotent,
  };
}
