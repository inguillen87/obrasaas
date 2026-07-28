import crypto, { createHash } from 'node:crypto';

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
  WorkerOnboardingError,
  issueWorkerOnboardingClaimWithReservation,
} from '@/lib/worker-onboarding';
import { getCurrentWorkerOnboardingPrivacyNotice } from '@/lib/worker-onboarding-privacy-notices';
import { workerOnboardingSensitivePurgeData } from '@/lib/worker-onboarding-retention';
import {
  deriveStoredWhatsAppChannelReadiness,
  whatsAppPlatformConfiguration,
} from '@/lib/whatsapp/channel-health';
import {
  getPublishedWhatsAppFlowReference,
  getWhatsAppFlowBlueprint,
  getWhatsAppFlowSessionTtlMs,
} from '@/lib/whatsapp/flows';
import { sendWhatsAppFlow } from '@/lib/whatsapp/meta';
import {
  WorkerOnboardingFlowSessionError,
  assertWorkerOnboardingFlowTokenSecret,
  getWorkerOnboardingFlowSessionForDelivery,
  issueWorkerOnboardingFlowSession,
  markWorkerOnboardingFlowSessionDeliveryAttempted,
  markWorkerOnboardingFlowSessionDeliveryRejected,
  markWorkerOnboardingFlowSessionSent,
} from '@/lib/whatsapp/worker-onboarding-flow-sessions';

const BLUEPRINT_KEY = 'worker-onboarding';
const META_CONVERSATION_PREFIX = 'meta:';
const INVITATION_MESSAGE_TYPE = 'worker_onboarding_invitation';
const SEND_REQUEST_ACTION = 'worker.onboarding.invitation_requested';
const PROVIDER_MESSAGE_ID_PATTERN = /^[^\u0000-\u001f\u007f]{1,500}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f]{1,190}$/;
const INBOUND_WINDOW_MS = 24 * 60 * 60 * 1_000;
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const STALE_SEND_MS = 2 * 60 * 1_000;
const RATE_LIMITS = Object.freeze({
  actorPerMinute: 5,
  organizationPerMinute: 30,
  conversationPerMinute: 3,
});

export class WorkerOnboardingInvitationError extends Error {
  constructor(message, {
    code = 'WORKER_ONBOARDING_INVITATION_ERROR',
    status = 400,
    retryAfterSeconds = null,
  } = {}) {
    super(message);
    this.name = 'WorkerOnboardingInvitationError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function invitationError(message, code, status, options = {}) {
  return new WorkerOnboardingInvitationError(message, {
    code,
    status,
    ...options,
  });
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

function requiredIdentifier(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_IDENTIFIER_PATTERN.test(normalized)) {
    throw invitationError(
      `${field} no es valido.`,
      'WORKER_ONBOARDING_INVITATION_INPUT_INVALID',
      400,
    );
  }
  return normalized;
}

function trustedScope(access) {
  const organizationId = requiredIdentifier(access?.organization?.id, 'organizationId');
  const projectId = requiredIdentifier(access?.project?.id, 'projectId');
  return { organizationId, projectId };
}

function actorMembershipId(access) {
  const membershipId = typeof access?.tenantMembershipId === 'string'
    ? access.tenantMembershipId.trim()
    : '';
  if (!SAFE_IDENTIFIER_PATTERN.test(membershipId)) {
    throw invitationError(
      'Una membresia tenant activa es obligatoria para invitar operarios.',
      'TENANT_MEMBERSHIP_REQUIRED',
      403,
    );
  }
  return membershipId;
}

function normalizedIdempotencyKey(value) {
  const key = String(value || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw invitationError(
      'La operacion requiere una clave de idempotencia valida.',
      'IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  return key;
}

function normalizePhone(value) {
  const source = String(value || '').trim();
  if (!/^\+?[0-9][0-9 ()-]{6,24}$/.test(source)) return null;
  const digits = source.replace(/\D/g, '');
  if (!/^\d{8,20}$/.test(digits)) return null;
  return { address: `+${digits}`, providerSubject: digits };
}

function conversationSender(conversation, inbound, connection) {
  const externalId = String(conversation?.externalId || '');
  const conversationPhone = externalId.startsWith(META_CONVERSATION_PREFIX)
    ? normalizePhone(externalId.slice(META_CONVERSATION_PREFIX.length))
    : null;
  const metadata = jsonObject(inbound?.metadata);
  const inboundPhone = normalizePhone(metadata.from);
  if (
    !conversationPhone
    || !inboundPhone
    || conversationPhone.address !== inboundPhone.address
    || conversationPhone.providerSubject !== inboundPhone.providerSubject
    || metadata.provider !== 'meta'
    || metadata.quarantined !== true
    || metadata.contactStatus !== 'UNASSIGNED'
    || metadata.workerResolution !== FIELD_WORKER_RESOLUTION.UNKNOWN
    || String(metadata.phoneNumberId || '') !== String(connection?.phoneNumberId || '')
  ) return null;
  return inboundPhone;
}

function platformConfigured(env) {
  const configuration = whatsAppPlatformConfiguration(env);
  return configuration.publicAppUrlConfigured === true
    && configuration.publicAppUrlStatus === 'CONFIGURED'
    && configuration.appIdConfigured === true
    && configuration.appSecretConfigured === true
    && configuration.embeddedSignupConfigConfigured === true
    && configuration.webhookVerifyTokenConfigured === true
    && configuration.credentialEncryptionConfigured === true;
}

function channelOperational(connection, env, now, deriveReadiness) {
  if (
    !connection?.enabled
    || connection.connectionStatus !== 'CONNECTED'
    || !connection.encryptedAccessToken
    || !connection.phoneNumberId
    || !connection.whatsappBusinessId
  ) return { operational: false, readiness: null };
  const readiness = deriveReadiness({ connection, env, now });
  const account = readiness?.checks?.account || {};
  return {
    readiness,
    operational: Boolean(
      readiness?.checks?.platform?.configured
      && account.linked
      && account.enabled
      && account.tokenStatus === 'VALID'
      && account.scopesVerified
      && account.phoneStatus === 'REGISTERED'
      && account.qualityStatus !== 'DEGRADED'
      && account.providerStatus !== 'DEGRADED'
      && readiness?.checks?.webhook?.subscriptionStatus === 'SUBSCRIBED'
    ),
  };
}

function flowEndpointOperational(readiness) {
  const flows = readiness?.checks?.flows || {};
  return flows.configured === true
    && flows.endpointStatus === 'HEALTHY'
    && Number(flows.publishedCount || 0) >= 1;
}

function fixedPublishedFlow(connection, resolvePublishedFlow) {
  const flow = connection
    ? resolvePublishedFlow(connection.metadata, BLUEPRINT_KEY)
    : null;
  return flow
    && flow.blueprintKey === BLUEPRINT_KEY
    && flow.screenId === 'WORKER_ONBOARDING'
    && flow.flowType === 'worker_onboarding'
    && flow.flowAction === 'data_exchange'
    ? flow
    : null;
}

function inboundWindowOpen(inbound, now) {
  const sentAt = validDate(inbound?.sentAt);
  if (!sentAt) return false;
  const age = now.getTime() - sentAt.getTime();
  return age >= -FUTURE_CLOCK_SKEW_MS && age < INBOUND_WINDOW_MS;
}

function effectiveClaimStatus(claim, now) {
  const status = String(claim?.status || '').toUpperCase();
  const expiresAt = validDate(claim?.expiresAt);
  if (['PENDING', 'SUBMITTED'].includes(status) && expiresAt?.getTime() <= now.getTime()) {
    return 'EXPIRED';
  }
  return status || null;
}

function safeMessageStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return new Set([
    'sending',
    'accepted',
    'sent',
    'delivered',
    'read',
    'failed',
    'unknown',
  ]).has(status) ? status : 'unknown';
}

function publicInvitation(message, claim, session, now) {
  if (!message) return null;
  const status = safeMessageStatus(message.status);
  let delivery = status;
  if (session?.submittedAt) delivery = 'submitted';
  else if (session?.deliveryRejectedAt) delivery = 'rejected';
  else if (session?.sentAt) delivery = 'accepted';
  else if (session?.deliveryAttemptedAt && !session?.sentAt) delivery = 'unknown';
  return {
    id: message.id,
    status,
    delivery,
    claimStatus: effectiveClaimStatus(claim, now),
    recordedAt: validDate(message.createdAt)?.toISOString() || null,
    attemptedAt: validDate(message.sentAt)?.toISOString() || null,
    expiresAt: validDate(claim?.expiresAt || session?.expiresAt)?.toISOString() || null,
  };
}

function invitationBindingValid({ message, claim, session, scope }) {
  const metadata = jsonObject(message?.metadata);
  return Boolean(
    message?.externalId
    && claim?.id
    && session?.id
    && metadata.messageType === INVITATION_MESSAGE_TYPE
    && metadata.blueprintKey === BLUEPRINT_KEY
    && metadata.claimId === claim.id
    && metadata.workerOnboardingFlowSessionId === session.id
    && metadata.flowId === session.flowId
    && session.claimId === claim.id
    && claim.organizationId === scope.organizationId
    && claim.projectId === scope.projectId
    && session.organizationId === scope.organizationId
    && session.projectId === scope.projectId
    && session.connectionId === claim.connectionId
    && session.sourceExternalId === message.externalId
    && session.blueprintKey === BLUEPRINT_KEY
    && session.screenId === 'WORKER_ONBOARDING'
    && session.flowType === 'worker_onboarding'
  );
}

async function scopedConversation(prisma, scope, conversationId) {
  const id = requiredIdentifier(conversationId, 'conversationId');
  return prisma.conversation.findFirst({
    where: {
      id,
      projectId: scope.projectId,
      project: { organizationId: scope.organizationId },
      channel: 'whatsapp',
      externalId: { startsWith: META_CONVERSATION_PREFIX },
    },
    select: {
      id: true,
      projectId: true,
      externalId: true,
      displayName: true,
      updatedAt: true,
    },
  });
}

async function latestInvitation(prisma, scope, conversationId) {
  if (typeof prisma.message?.findFirst !== 'function') {
    return { message: null, claim: null, session: null, corrupt: false };
  }
  const message = await prisma.message.findFirst({
    where: {
      conversationId,
      direction: 'OUTBOUND',
      metadata: { path: ['messageType'], equals: INVITATION_MESSAGE_TYPE },
    },
    select: {
      id: true,
      conversationId: true,
      externalId: true,
      status: true,
      metadata: true,
      sentAt: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  if (!message) return { message: null, claim: null, session: null, corrupt: false };
  const metadata = jsonObject(message.metadata);
  const claimId = String(metadata.claimId || '').trim();
  const sessionId = String(metadata.workerOnboardingFlowSessionId || '').trim();
  if (!claimId || !sessionId) {
    return { message, claim: null, session: null, corrupt: true };
  }
  const [claim, session] = await Promise.all([
    prisma.workerOnboardingClaim.findFirst({
      where: {
        id: claimId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
      },
    }),
    prisma.workerOnboardingFlowSession.findUnique({ where: { id: sessionId } }),
  ]);
  const corrupt = message.conversationId !== conversationId
    || !invitationBindingValid({ message, claim, session, scope });
  return { message, claim, session, corrupt };
}

async function lockInvitationLane(prisma, scope, conversationId) {
  await prisma.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    `worker-onboarding-invitation:${scope.organizationId}:${scope.projectId}:${conversationId}`,
  );
}

async function readState(prisma, scope, conversationId, {
  env,
  now,
  lockWrites = false,
  resolveWorker,
  deriveReadiness,
  resolvePublishedFlow,
}) {
  if (lockWrites) {
    await requireOperationalProjectWrite(prisma, scope);
    await lockInvitationLane(prisma, scope, conversationId);
  }
  const conversation = await scopedConversation(prisma, scope, conversationId);
  if (!conversation) {
    throw invitationError(
      'La conversacion ya no esta disponible en esta obra.',
      'INBOX_CONVERSATION_NOT_FOUND',
      404,
    );
  }
  const [project, connection, inbound, invitation] = await Promise.all([
    prisma.project.findFirst({
      where: { id: scope.projectId, organizationId: scope.organizationId },
      include: { organization: true },
    }),
    prisma.whatsAppConnection.findUnique({
      where: { projectId: scope.projectId },
      select: {
        id: true,
        projectId: true,
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
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        externalId: true,
        metadata: true,
        sentAt: true,
        createdAt: true,
      },
    }),
    latestInvitation(prisma, scope, conversation.id),
  ]);
  const sender = conversationSender(conversation, inbound, connection);
  let workerResolution = sender
    ? await resolveWorker(prisma, scope, sender.address)
    : {
        status: FIELD_WORKER_RESOLUTION.INVALID_PHONE,
        worker: null,
        normalizedPhone: null,
      };
  let authorizedByClaim = false;
  let approvedClaimInvalid = false;
  if (
    !invitation.corrupt
    && effectiveClaimStatus(invitation.claim, now) === 'APPROVED'
  ) {
    const resolvedWorkerId = String(invitation.claim?.resolvedWorkerId || '').trim();
    const resolvedWorker = resolvedWorkerId && typeof prisma.worker?.findFirst === 'function'
      ? await prisma.worker.findFirst({
          where: {
            id: resolvedWorkerId,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            active: true,
          },
          select: { id: true },
        })
      : null;
    if (resolvedWorker) {
      authorizedByClaim = true;
      workerResolution = {
        status: FIELD_WORKER_RESOLUTION.RESOLVED,
        worker: resolvedWorker,
        normalizedPhone: null,
        source: 'APPROVED_ONBOARDING_CLAIM',
      };
    } else {
      approvedClaimInvalid = true;
      workerResolution = {
        status: FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED,
        worker: null,
        normalizedPhone: null,
      };
    }
  }
  const channel = channelOperational(connection, env, now, deriveReadiness);
  return {
    conversation,
    project,
    connection,
    inbound,
    invitation,
    sender,
    workerResolution,
    authorizedByClaim,
    approvedClaimInvalid,
    channel,
    publishedFlow: fixedPublishedFlow(connection, resolvePublishedFlow),
  };
}

function capabilityError(state, {
  canManage,
  env,
  now,
  flowSessionSecret,
  ignoreExistingInvitation = false,
}) {
  if (!canManage) {
    return invitationError(
      'Tu rol puede revisar el contacto, pero no invitar operarios.',
      'WORKER_ONBOARDING_MANAGE_PERMISSION_REQUIRED',
      403,
    );
  }
  if (state.workerResolution.status === FIELD_WORKER_RESOLUTION.RESOLVED) {
    return invitationError(
      'Este contacto ya pertenece a un operario autorizado.',
      'WORKER_ONBOARDING_CONTACT_ALREADY_AUTHORIZED',
      409,
    );
  }
  if (!state.project || !['PLANNING', 'ACTIVE', 'PAUSED'].includes(state.project.status)) {
    return invitationError(
      'La obra esta en modo solo lectura.',
      'PROJECT_READ_ONLY',
      409,
    );
  }
  if (!subscriptionAllowsWrites(state.project.organization, now)) {
    return invitationError(
      'El plan actual no permite invitar operarios.',
      'SUBSCRIPTION_WRITE_BLOCKED',
      402,
    );
  }
  if (!platformConfigured(env)) {
    return invitationError(
      'La configuracion segura de Meta todavia esta incompleta.',
      'WHATSAPP_PLATFORM_NOT_READY',
      409,
    );
  }
  try {
    assertWorkerOnboardingFlowTokenSecret(flowSessionSecret, {
      allowDevelopmentFallback: true,
    });
  } catch (error) {
    return invitationError(
      'La firma segura del alta todavia no esta configurada.',
      error?.code || 'WORKER_ONBOARDING_FLOW_TOKEN_SECRET_REQUIRED',
      error?.status || 503,
    );
  }
  if (!state.channel.operational) {
    return invitationError(
      'WhatsApp no esta operativo para esta obra.',
      'WHATSAPP_CONNECTION_NOT_OPERATIONAL',
      409,
    );
  }
  if (!flowEndpointOperational(state.channel.readiness)) {
    return invitationError(
      'El Data Endpoint cifrado de WhatsApp Flows no esta listo.',
      'WHATSAPP_FLOW_ENDPOINT_NOT_READY',
      409,
    );
  }
  if (!state.publishedFlow) {
    return invitationError(
      'El Flow exacto de alta de operario no esta publicado.',
      'WORKER_ONBOARDING_FLOW_NOT_PUBLISHED',
      409,
    );
  }
  if (!state.inbound) {
    return invitationError(
      'El contacto todavia no inicio la conversacion.',
      'WHATSAPP_PRIOR_INBOUND_REQUIRED',
      409,
    );
  }
  if (!state.sender) {
    return invitationError(
      'El ultimo mensaje no prueba una identidad Meta cuarentenada valida.',
      'WORKER_ONBOARDING_CONTACT_NOT_QUARANTINED',
      409,
    );
  }
  if (!inboundWindowOpen(state.inbound, now)) {
    return invitationError(
      'La ventana de atencion de 24 horas ya vencio. El contacto debe escribir nuevamente.',
      'WHATSAPP_CUSTOMER_SERVICE_WINDOW_CLOSED',
      409,
    );
  }
  if (state.workerResolution.status !== FIELD_WORKER_RESOLUTION.UNKNOWN) {
    return invitationError(
      'La identidad del contacto esta en conflicto y requiere revision administrativa.',
      'WORKER_ONBOARDING_CONTACT_IDENTITY_CONFLICT',
      409,
    );
  }
  if (!ignoreExistingInvitation && state.invitation.corrupt) {
    return invitationError(
      'El alta anterior no conserva una correlacion integra. No se habilita otro envio.',
      'WORKER_ONBOARDING_INVITATION_STATE_CORRUPT',
      409,
    );
  }
  if (!ignoreExistingInvitation && state.invitation.message) {
    const messageStatus = safeMessageStatus(state.invitation.message.status);
    const claimStatus = effectiveClaimStatus(state.invitation.claim, now);
    const recovery = idempotentRecoveryState(state.invitation, now);
    if (!recovery.expired && ['sending', 'unknown'].includes(messageStatus)) {
      return invitationError(
        'Hay una invitacion cuya entrega no fue confirmada. No se enviara otra automaticamente.',
        'WORKER_ONBOARDING_INVITATION_DELIVERY_UNRESOLVED',
        409,
      );
    }
    if (['PENDING', 'SUBMITTED'].includes(claimStatus)) {
      return invitationError(
        'Este contacto ya tiene un alta abierta.',
        'WORKER_ONBOARDING_INVITATION_ALREADY_OPEN',
        409,
      );
    }
  }
  return null;
}

function assertCapability(state, options) {
  const error = capabilityError(state, options);
  if (error) throw error;
  return state;
}

function capabilityDto(error) {
  return error
    ? { allowed: false, code: error.code, reason: error.message }
    : { allowed: true, code: 'READY', reason: null };
}

function onboardingUiState(state, error, now) {
  if (!error) return 'eligible';
  if (state.workerResolution.status === FIELD_WORKER_RESOLUTION.RESOLVED) {
    return 'authorized';
  }
  if (
    state.invitation.corrupt
    || state.approvedClaimInvalid
    || [
      FIELD_WORKER_RESOLUTION.AMBIGUOUS,
      FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED,
    ].includes(state.workerResolution.status)
  ) return 'conflict';
  if (
    state.invitation.message
    && (
      (
        !idempotentRecoveryState(state.invitation, now).expired
        && ['sending', 'unknown'].includes(safeMessageStatus(state.invitation.message.status))
      )
      || ['PENDING', 'SUBMITTED'].includes(effectiveClaimStatus(state.invitation.claim, now))
    )
  ) return 'already_pending';
  return 'closed';
}

function invitationIdentity(scope, conversationId, key) {
  const digest = createHash('sha256')
    .update(
      `obrasaas-worker-onboarding-invitation-v1\0${scope.organizationId}\0${scope.projectId}\0${conversationId}\0${key}`,
    )
    .digest('hex');
  return {
    digest,
    externalId: `worker-onboarding-invitation:${digest}`,
  };
}

function deriveClaimToken(identity, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`obrasaas-worker-onboarding-claim-token-v1\0${identity.digest}`)
    .digest('base64url');
}

function messageMetadata({ access, identity, claimId, sessionId, flow, extra = {} }) {
  return {
    source: 'dashboard-inbox',
    messageType: INVITATION_MESSAGE_TYPE,
    actorId: access.databaseUserId || null,
    idempotencyDigest: identity.digest,
    blueprintKey: BLUEPRINT_KEY,
    claimId,
    workerOnboardingFlowSessionId: sessionId,
    flowId: flow.id,
    ...extra,
  };
}

function metadataMatches(message, identity, conversationId) {
  const metadata = jsonObject(message?.metadata);
  return Boolean(
    message
    && message.conversationId === conversationId
    && message.externalId === identity.externalId
    && metadata.messageType === INVITATION_MESSAGE_TYPE
    && metadata.idempotencyDigest === identity.digest
    && metadata.blueprintKey === BLUEPRINT_KEY
    && metadata.claimId
    && metadata.workerOnboardingFlowSessionId
  );
}

async function existingIdempotentInvitation(prisma, scope, identity, conversationId, now) {
  const message = await prisma.message.findUnique({
    where: { externalId: identity.externalId },
  });
  if (!message) return null;
  if (!metadataMatches(message, identity, conversationId)) {
    throw invitationError(
      'La clave de idempotencia ya fue utilizada para otra operacion.',
      'WORKER_ONBOARDING_INVITATION_IDEMPOTENCY_CONFLICT',
      409,
    );
  }
  const metadata = jsonObject(message.metadata);
  const [claim, session] = await Promise.all([
    prisma.workerOnboardingClaim.findFirst({
      where: {
        id: metadata.claimId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
      },
    }),
    prisma.workerOnboardingFlowSession.findUnique({
      where: { id: metadata.workerOnboardingFlowSessionId },
    }),
  ]);
  if (!invitationBindingValid({ message, claim, session, scope })) {
    throw invitationError(
      'La invitacion existente no conserva una correlacion integra.',
      'WORKER_ONBOARDING_INVITATION_STATE_CORRUPT',
      409,
    );
  }
  return {
    message,
    claim,
    session,
    response: {
      conversationId,
      invitation: publicInvitation(message, claim, session, now),
      idempotent: true,
    },
  };
}

function idempotentRecoveryState(existing, now) {
  if (!existing?.message || !existing?.claim || !existing?.session) {
    return { recoverable: false, expired: false, retryAfterSeconds: null };
  }
  const status = safeMessageStatus(existing.message.status);
  const storedClaimStatus = String(existing.claim?.status || '').toUpperCase();
  const claimExpiresAt = validDate(existing.claim.expiresAt);
  const sessionExpiresAt = validDate(existing.session.expiresAt);
  const expired = storedClaimStatus === 'EXPIRED'
    || !claimExpiresAt
    || !sessionExpiresAt
    || claimExpiresAt.getTime() <= now.getTime()
    || sessionExpiresAt.getTime() <= now.getTime();
  const untouched = !existing.session.deliveryAttemptedAt
    && !existing.session.deliveryRejectedAt
    && !existing.session.sentAt
    && !existing.session.submittedAt
    && !existing.session.consumedAt;
  if (status !== 'sending' || !untouched) {
    return { recoverable: false, expired: false, retryAfterSeconds: null };
  }
  if (expired && ['PENDING', 'EXPIRED'].includes(storedClaimStatus)) {
    return { recoverable: false, expired: true, retryAfterSeconds: null };
  }
  if (storedClaimStatus !== 'PENDING') {
    return { recoverable: false, expired: false, retryAfterSeconds: null };
  }
  const recordedAt = validDate(existing.message.sentAt || existing.message.createdAt);
  if (!recordedAt) return { recoverable: false, expired: false, retryAfterSeconds: null };
  const ageMs = now.getTime() - recordedAt.getTime();
  if (ageMs < STALE_SEND_MS) {
    return {
      recoverable: false,
      expired: false,
      retryAfterSeconds: Math.max(1, Math.ceil((STALE_SEND_MS - ageMs) / 1_000)),
    };
  }
  return { recoverable: true, expired: false, retryAfterSeconds: null };
}

async function reconcileExpiredIdempotentInvitation({
  prisma,
  access,
  scope,
  existing,
  clock,
}) {
  const reconciledAt = observedDate(clock);
  let reconciled = false;
  await prisma.$transaction(async (transaction) => {
    await requireOperationalProjectWrite(transaction, scope);
    await lockInvitationLane(transaction, scope, existing.message.conversationId);
    const [claim, session, message] = await Promise.all([
      transaction.workerOnboardingClaim.findFirst({
        where: {
          id: existing.claim.id,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
        },
      }),
      transaction.workerOnboardingFlowSession.findUnique({
        where: { id: existing.session.id },
      }),
      transaction.message.findUnique({ where: { id: existing.message.id } }),
    ]);
    if (!invitationBindingValid({ message, claim, session, scope })) {
      throw invitationError(
        'La invitacion expirada no conserva una correlacion integra.',
        'WORKER_ONBOARDING_INVITATION_STATE_CORRUPT',
        409,
      );
    }
    const recovery = idempotentRecoveryState({ message, claim, session }, reconciledAt);
    if (!recovery.expired) return;
    let claimClosed = claim.status === 'EXPIRED' && Boolean(claim.sensitiveDataPurgedAt);
    if (!claimClosed && ['PENDING', 'EXPIRED'].includes(claim.status)) {
      const claimUpdate = await transaction.workerOnboardingClaim.updateMany({
        where: {
          id: claim.id,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          status: claim.status,
        },
        data: workerOnboardingSensitivePurgeData({
          status: 'EXPIRED',
          purgedAt: reconciledAt,
        }),
      });
      claimClosed = claimUpdate.count === 1;
    }
    if (!claimClosed) return;
    await Promise.all([
      transaction.message.updateMany({
        where: {
          id: message.id,
          conversationId: message.conversationId,
          status: { in: ['sending', 'SENDING'] },
        },
        data: {
          status: 'failed',
          metadata: {
            ...jsonObject(message.metadata),
            failureCode: 'WORKER_ONBOARDING_INVITATION_EXPIRED',
            failedAt: reconciledAt.toISOString(),
          },
        },
      }),
      transaction.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: access.databaseUserId || null,
          action: 'worker.onboarding.invitation_expired',
          entityType: 'Message',
          entityId: message.id,
          metadata: {
            projectId: scope.projectId,
            conversationId: message.conversationId,
            claimId: claim.id,
          },
          createdAt: reconciledAt,
        },
      }),
    ]);
    reconciled = true;
  }, { isolationLevel: 'ReadCommitted', maxWait: 5_000, timeout: 15_000 });
  return reconciled;
}

async function assertRateLimit(prisma, { scope, actorId, conversationId, now }) {
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
  const limited = actorCount >= RATE_LIMITS.actorPerMinute
    ? 'WORKER_ONBOARDING_INVITATION_ACTOR_RATE_LIMIT'
    : organizationCount >= RATE_LIMITS.organizationPerMinute
      ? 'WORKER_ONBOARDING_INVITATION_ORGANIZATION_RATE_LIMIT'
      : conversationCount >= RATE_LIMITS.conversationPerMinute
        ? 'WORKER_ONBOARDING_INVITATION_CONVERSATION_RATE_LIMIT'
        : null;
  if (limited) {
    throw invitationError(
      'Se alcanzo el limite seguro de invitaciones. Espera un minuto antes de continuar.',
      limited,
      429,
      { retryAfterSeconds: 60 },
    );
  }
}

function providerMessageId(result) {
  const id = String(result?.messages?.[0]?.id || '').trim();
  return PROVIDER_MESSAGE_ID_PATTERN.test(id) ? id : null;
}

function sameSender(left, right) {
  return left?.address === right?.address
    && left?.providerSubject === right?.providerSubject;
}

function normalizedError(error, fallback = {}) {
  if (error instanceof WorkerOnboardingInvitationError) return error;
  if (
    error instanceof ProjectWritePolicyError
    || error instanceof WorkerOnboardingError
    || error instanceof WorkerOnboardingFlowSessionError
  ) {
    return invitationError(
      error.message,
      error.code || fallback.code || 'WORKER_ONBOARDING_INVITATION_FAILED',
      error.status || fallback.status || 500,
    );
  }
  return invitationError(
    fallback.message || 'No se pudo preparar la invitacion de alta.',
    fallback.code || 'WORKER_ONBOARDING_INVITATION_PREPARATION_FAILED',
    fallback.status || 500,
  );
}

function isDeliveryAmbiguityError(error) {
  return [
    'WORKER_ONBOARDING_INVITATION_DELIVERY_UNKNOWN',
    'WORKER_ONBOARDING_FLOW_SESSION_DELIVERY_AMBIGUOUS',
    'WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT',
  ].includes(error?.code);
}

async function cancelPendingClaim(prisma, claimId, scope, cancelledAt) {
  if (typeof prisma.workerOnboardingClaim?.updateMany !== 'function') return false;
  const result = await prisma.workerOnboardingClaim.updateMany({
    where: {
      id: claimId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      status: 'PENDING',
    },
    data: workerOnboardingSensitivePurgeData({
      status: 'CANCELLED',
      purgedAt: cancelledAt,
    }),
  });
  return result.count === 1;
}

async function persistPreDispatchFailure({
  prisma,
  access,
  scope,
  reservation,
  identity,
  error,
  clock,
}) {
  const failedAt = observedDate(clock);
  const failureCode = String(error?.code || error?.name || 'LOCAL_PREPARATION_FAILED')
    .slice(0, 80);
  let closureOutcome = 'PERSISTENCE_FAILED';
  try {
    closureOutcome = await prisma.$transaction(async (transaction) => {
      const claimClosed = await cancelPendingClaim(
        transaction,
        reservation.claim.id,
        scope,
        failedAt,
      );
      if (!claimClosed) return 'CONCURRENT_STATE';
      await Promise.all([
        transaction.message.update({
          where: { id: reservation.message.id },
          data: {
            status: 'failed',
            metadata: messageMetadata({
              access,
              identity,
              claimId: reservation.claim.id,
              sessionId: reservation.session.id,
              flow: reservation.flow,
              extra: { failureCode, failedAt: failedAt.toISOString() },
            }),
          },
        }),
        transaction.auditLog.create({
          data: {
            organizationId: scope.organizationId,
            actorId: access.databaseUserId || null,
            action: 'worker.onboarding.invitation_preparation_failed',
            entityType: 'Message',
            entityId: reservation.message.id,
            metadata: {
              projectId: scope.projectId,
              conversationId: reservation.message.conversationId,
              failureCode,
            },
          },
        }),
      ]);
      return 'CLOSED';
    }, { isolationLevel: 'ReadCommitted' });
  } catch (persistenceError) {
    console.error('Worker-onboarding invitation preparation failure was not persisted:', {
      name: persistenceError?.name,
      code: persistenceError?.code,
    });
  }
  if (closureOutcome === 'CONCURRENT_STATE') {
    throw invitationError(
      'El alta cambio mientras se cerraba el intento. Actualiza el Inbox antes de continuar.',
      'WORKER_ONBOARDING_INVITATION_CONCURRENT_MODIFICATION',
      409,
    );
  }
  throw invitationError(
    'La invitacion no llego a Meta y el intento local fue cerrado. Podes iniciar una nueva operacion.',
    'WORKER_ONBOARDING_INVITATION_PREPARATION_FAILED',
    409,
  );
}

function definitiveProviderRejection(error) {
  if (error?.code === 'META_FLOW_REJECTED') return true;
  const status = Number(error?.status);
  return Number.isInteger(status)
    && status >= 400
    && status < 500
    && ![408, 425, 429].includes(status);
}

async function persistProviderFailure({
  prisma,
  access,
  scope,
  reservation,
  identity,
  error,
  definitive,
  providerAccepted = false,
  acceptedProviderMessageId = null,
  markRejected,
  markSent,
  flowSessionSecret,
  clock,
}) {
  const failedAt = observedDate(clock);
  const status = definitive ? 'failed' : 'unknown';
  const failureCode = String(error?.code || error?.name || 'META_FLOW_DELIVERY_UNKNOWN')
    .slice(0, 80);
  try {
    await prisma.$transaction(async (transaction) => {
      if (providerAccepted && acceptedProviderMessageId) {
        await markSent(
          transaction,
          {
            sessionId: reservation.session.id,
            providerMessageId: acceptedProviderMessageId,
          },
          { secret: flowSessionSecret, now: failedAt },
        );
      } else if (definitive) {
        await markRejected(
          transaction,
          { sessionId: reservation.session.id },
          { secret: flowSessionSecret, now: failedAt },
        );
        const claimClosed = await cancelPendingClaim(
          transaction,
          reservation.claim.id,
          scope,
          failedAt,
        );
        if (!claimClosed) {
          throw invitationError(
            'El alta cambio mientras Meta rechazaba el envio.',
            'WORKER_ONBOARDING_INVITATION_CONCURRENT_MODIFICATION',
            409,
          );
        }
      }
      const messageData = {
        status,
        ...(acceptedProviderMessageId
          ? { providerMessageId: acceptedProviderMessageId }
          : {}),
        metadata: messageMetadata({
          access,
          identity,
          claimId: reservation.claim.id,
          sessionId: reservation.session.id,
          flow: reservation.flow,
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
      };
      const messageWrite = !definitive && !providerAccepted
        ? transaction.message.updateMany({
            where: {
              id: reservation.message.id,
              conversationId: reservation.message.conversationId,
              status: { in: ['sending', 'unknown', 'SENDING', 'UNKNOWN'] },
            },
            data: messageData,
          })
        : transaction.message.update({
            where: { id: reservation.message.id },
            data: messageData,
          });
      await Promise.all([
        messageWrite,
        transaction.conversation.update({
          where: { id: reservation.message.conversationId },
          data: { updatedAt: failedAt },
        }),
        transaction.auditLog.create({
          data: {
            organizationId: scope.organizationId,
            actorId: access.databaseUserId || null,
            action: providerAccepted
              ? 'worker.onboarding.invitation_correlation_pending'
              : definitive
                ? 'worker.onboarding.invitation_rejected'
                : 'worker.onboarding.invitation_delivery_unknown',
            entityType: 'Message',
            entityId: reservation.message.id,
            metadata: {
              projectId: scope.projectId,
              conversationId: reservation.message.conversationId,
              providerStatus: status,
              providerAccepted,
              failureCode,
            },
          },
        }),
      ]);
    }, { isolationLevel: 'ReadCommitted' });
  } catch (persistenceError) {
    console.error('Worker-onboarding invitation provider outcome was not persisted atomically:', {
      name: persistenceError?.name,
      code: persistenceError?.code,
    });
    try {
      if (providerAccepted && acceptedProviderMessageId) {
        try {
          await markSent(
            prisma,
            {
              sessionId: reservation.session.id,
              providerMessageId: acceptedProviderMessageId,
            },
            { secret: flowSessionSecret, now: failedAt },
          );
        } catch (sessionError) {
          console.error('Worker-onboarding provider acceptance fence also failed:', {
            name: sessionError?.name,
            code: sessionError?.code,
          });
        }
      }
      await prisma.message.updateMany({
        where: {
          id: reservation.message.id,
          conversationId: reservation.message.conversationId,
        },
        data: {
          status: 'unknown',
          ...(acceptedProviderMessageId
            ? { providerMessageId: acceptedProviderMessageId }
            : {}),
        },
      });
    } catch (fallbackError) {
      console.error('Worker-onboarding invitation fallback status also failed:', {
        name: fallbackError?.name,
        code: fallbackError?.code,
      });
    }
  }
  throw invitationError(
    providerAccepted
      ? 'Meta acepto la invitacion, pero su correlacion local sigue pendiente. No se reenviara.'
      : definitive
        ? 'Meta rechazo la invitacion. El intento quedo cerrado como fallido.'
        : 'Meta no confirmo la entrega. No se reenviara automaticamente para evitar duplicados.',
    providerAccepted
      ? 'WORKER_ONBOARDING_INVITATION_CORRELATION_PENDING'
      : definitive
        ? 'WORKER_ONBOARDING_INVITATION_DELIVERY_REJECTED'
        : 'WORKER_ONBOARDING_INVITATION_DELIVERY_UNKNOWN',
    502,
  );
}

export async function getWorkerOnboardingInvitationState({
  prisma,
  access,
  conversationId,
  canManage = false,
  clock = () => new Date(),
  env = process.env,
  flowSessionSecret = env?.WORKER_ONBOARDING_FLOW_TOKEN_SECRET,
  resolveWorker = resolveActiveFieldWorkerByPhone,
  deriveReadiness = deriveStoredWhatsAppChannelReadiness,
  resolvePublishedFlow = getPublishedWhatsAppFlowReference,
}) {
  const scope = trustedScope(access);
  const now = observedDate(clock);
  const state = await readState(prisma, scope, conversationId, {
    env,
    now,
    resolveWorker,
    deriveReadiness,
    resolvePublishedFlow,
  });
  const error = capabilityError(state, {
    canManage,
    env,
    now,
    flowSessionSecret,
  });
  const blueprint = getWhatsAppFlowBlueprint(BLUEPRINT_KEY);
  return {
    conversationId: state.conversation.id,
    state: onboardingUiState(state, error, now),
    contact: {
      status: state.workerResolution.status === FIELD_WORKER_RESOLUTION.UNKNOWN
        && state.sender
        ? 'UNASSIGNED'
        : state.workerResolution.status,
    },
    capability: capabilityDto(error),
    invitation: publicInvitation(
      state.invitation.message,
      state.invitation.claim,
      state.invitation.session,
      now,
    ),
    flow: {
      key: BLUEPRINT_KEY,
      title: blueprint.title,
      expiresInMinutes: Math.round(getWhatsAppFlowSessionTtlMs(BLUEPRINT_KEY) / 60_000),
    },
  };
}

export async function sendWorkerOnboardingInvitation({
  prisma,
  access,
  conversationId,
  idempotencyKey,
  sendFlow = sendWhatsAppFlow,
  claimIssuer = issueWorkerOnboardingClaimWithReservation,
  issueSession = issueWorkerOnboardingFlowSession,
  getSessionForDelivery = getWorkerOnboardingFlowSessionForDelivery,
  markDeliveryAttempted = markWorkerOnboardingFlowSessionDeliveryAttempted,
  markDeliveryRejected = markWorkerOnboardingFlowSessionDeliveryRejected,
  markSessionSent = markWorkerOnboardingFlowSessionSent,
  resolveWorker = resolveActiveFieldWorkerByPhone,
  deriveReadiness = deriveStoredWhatsAppChannelReadiness,
  resolvePublishedFlow = getPublishedWhatsAppFlowReference,
  tokenFactory = deriveClaimToken,
  clock = () => new Date(),
  env = process.env,
  flowSessionSecret = env?.WORKER_ONBOARDING_FLOW_TOKEN_SECRET,
}) {
  const scope = trustedScope(access);
  const membershipId = actorMembershipId(access);
  const key = normalizedIdempotencyKey(idempotencyKey);
  const now = observedDate(clock);
  let initial = await readState(prisma, scope, conversationId, {
    env,
    now,
    resolveWorker,
    deriveReadiness,
    resolvePublishedFlow,
  });
  const identity = invitationIdentity(scope, initial.conversation.id, key);
  const priorRecovery = idempotentRecoveryState(initial.invitation, now);
  if (priorRecovery.expired) {
    let reconciled;
    try {
      reconciled = await reconcileExpiredIdempotentInvitation({
        prisma,
        access,
        scope,
        existing: initial.invitation,
        clock,
      });
    } catch (error) {
      throw normalizedError(error);
    }
    if (reconciled) {
      const sameExpiredOperation = initial.invitation.message.externalId === identity.externalId;
      initial = await readState(prisma, scope, conversationId, {
        env,
        now: observedDate(clock),
        resolveWorker,
        deriveReadiness,
        resolvePublishedFlow,
      });
      if (sameExpiredOperation) {
        throw invitationError(
          'La invitacion expiro antes de llegar a Meta. Inicia una nueva operacion.',
          'WORKER_ONBOARDING_INVITATION_EXPIRED',
          410,
        );
      }
    }
  }
  const existing = await existingIdempotentInvitation(
    prisma,
    scope,
    identity,
    initial.conversation.id,
    now,
  );
  const resolvedSecret = assertWorkerOnboardingFlowTokenSecret(flowSessionSecret, {
    allowDevelopmentFallback: true,
  });
  const ttlMs = getWhatsAppFlowSessionTtlMs(BLUEPRINT_KEY);
  const blueprint = getWhatsAppFlowBlueprint(BLUEPRINT_KEY);
  const currentPrivacyNotice = getCurrentWorkerOnboardingPrivacyNotice();
  let reservation;

  if (existing) {
    const recovery = idempotentRecoveryState(existing, now);
    if (recovery.expired) {
      const reconciled = await reconcileExpiredIdempotentInvitation({
        prisma,
        access,
        scope,
        existing,
        clock,
      });
      if (reconciled) {
        throw invitationError(
          'La invitacion expiro antes de llegar a Meta. Inicia una nueva operacion.',
          'WORKER_ONBOARDING_INVITATION_EXPIRED',
          410,
        );
      }
    }
    if (!recovery.recoverable) return existing.response;
    assertCapability(initial, {
      canManage: true,
      env,
      now,
      flowSessionSecret: resolvedSecret,
      ignoreExistingInvitation: true,
    });
    reservation = {
      state: initial,
      flow: initial.publishedFlow,
      claim: existing.claim,
      session: existing.session,
      message: existing.message,
      token: null,
      dispatch: true,
      recovered: true,
    };
  } else {
    assertCapability(initial, {
      canManage: true,
      env,
      now,
      flowSessionSecret: resolvedSecret,
    });
  }

  if (!reservation) try {
    const expiresAt = new Date(now.getTime() + ttlMs);
    const claimToken = tokenFactory(identity, resolvedSecret);
    const issued = await claimIssuer(prisma, {
      scope,
      connectionId: initial.connection.id,
      sender: initial.sender,
      claimToken,
      expiresAt,
      issuedByMembershipId: membershipId,
      idempotencyKey: key,
      now,
      dependencies: { env },
    }, async (transaction, claimContext) => {
      await lockInvitationLane(transaction, scope, initial.conversation.id);
      const existingMessage = await transaction.message.findUnique({
        where: { externalId: identity.externalId },
      });
      if (existingMessage) {
        if (!metadataMatches(existingMessage, identity, initial.conversation.id)) {
          throw invitationError(
            'La clave de idempotencia ya fue utilizada para otra operacion.',
            'WORKER_ONBOARDING_INVITATION_IDEMPOTENCY_CONFLICT',
            409,
          );
        }
        const metadata = jsonObject(existingMessage.metadata);
        const session = await transaction.workerOnboardingFlowSession.findUnique({
          where: { id: metadata.workerOnboardingFlowSessionId },
        });
        return {
          state: initial,
          flow: initial.publishedFlow,
          claim: claimContext.claim,
          session,
          message: existingMessage,
          token: null,
          dispatch: false,
        };
      }
      const fresh = assertCapability(
        await readState(transaction, scope, initial.conversation.id, {
          env,
          now: claimContext.currentTime,
          lockWrites: true,
          resolveWorker,
          deriveReadiness,
          resolvePublishedFlow,
        }),
        {
          canManage: true,
          env,
          now: claimContext.currentTime,
          flowSessionSecret: resolvedSecret,
          ignoreExistingInvitation: true,
        },
      );
      if (
        fresh.connection.id !== claimContext.connectionId
        || !sameSender(fresh.sender, claimContext.sender)
        || fresh.publishedFlow.id !== initial.publishedFlow.id
      ) {
        throw invitationError(
          'El contacto, el canal o el Flow cambiaron antes de reservar la invitacion.',
          'WORKER_ONBOARDING_INVITATION_SCOPE_CHANGED',
          409,
        );
      }
      await assertRateLimit(transaction, {
        scope,
        actorId: access.databaseUserId || null,
        conversationId: fresh.conversation.id,
        now: claimContext.currentTime,
      });
      const issuedSession = await issueSession(transaction, {
        claimId: claimContext.claim.id,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        connectionId: fresh.connection.id,
        phoneNumberId: fresh.connection.phoneNumberId,
        blueprintKey: BLUEPRINT_KEY,
        flowId: fresh.publishedFlow.id,
        screenId: fresh.publishedFlow.screenId,
        flowType: fresh.publishedFlow.flowType,
        sourceExternalId: identity.externalId,
        noticeVersion: currentPrivacyNotice.version,
        noticeContentSha256: currentPrivacyNotice.contentSha256,
      }, {
        secret: resolvedSecret,
        now: claimContext.currentTime,
        ttlMs,
      });
      const message = await transaction.message.create({
        data: {
          conversationId: fresh.conversation.id,
          externalId: identity.externalId,
          direction: 'OUTBOUND',
          kind: 'INTERACTIVE',
          body: blueprint.message.body,
          status: 'sending',
          sentAt: claimContext.currentTime,
          metadata: messageMetadata({
            access,
            identity,
            claimId: claimContext.claim.id,
            sessionId: issuedSession.session.id,
            flow: fresh.publishedFlow,
          }),
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: access.databaseUserId || null,
          action: SEND_REQUEST_ACTION,
          entityType: 'Conversation',
          entityId: fresh.conversation.id,
          metadata: {
            projectId: scope.projectId,
            messageId: message.id,
            claimId: claimContext.claim.id,
            blueprintKey: BLUEPRINT_KEY,
            idempotencyDigest: identity.digest,
          },
          createdAt: claimContext.currentTime,
        },
      });
      return {
        state: fresh,
        flow: fresh.publishedFlow,
        claim: claimContext.claim,
        session: issuedSession.session,
        message,
        token: issuedSession.token,
        dispatch: true,
      };
    });
    reservation = issued.reservation;
  } catch (error) {
    const replay = await existingIdempotentInvitation(
      prisma,
      scope,
      identity,
      initial.conversation.id,
      observedDate(clock),
    );
    if (replay) return replay.response;
    throw normalizedError(error);
  }

  if (!reservation?.dispatch) {
    const replay = await existingIdempotentInvitation(
      prisma,
      scope,
      identity,
      initial.conversation.id,
      observedDate(clock),
    );
    if (replay) return replay.response;
    throw invitationError(
      'La reserva idempotente no conserva una invitacion integra.',
      'WORKER_ONBOARDING_INVITATION_STATE_CORRUPT',
      409,
    );
  }

  let delivery;
  try {
    delivery = await prisma.$transaction(async (transaction) => {
      const dispatchTime = observedDate(clock);
      const fresh = assertCapability(
        await readState(transaction, scope, initial.conversation.id, {
          env,
          now: dispatchTime,
          lockWrites: true,
          resolveWorker,
          deriveReadiness,
          resolvePublishedFlow,
        }),
        {
          canManage: true,
          env,
          now: dispatchTime,
          flowSessionSecret: resolvedSecret,
          ignoreExistingInvitation: true,
        },
      );
      if (
        fresh.connection.id !== reservation.state.connection.id
        || !sameSender(fresh.sender, reservation.state.sender)
        || fresh.publishedFlow.id !== reservation.flow.id
      ) {
        throw invitationError(
          'El contacto, el canal o el Flow cambiaron antes del envio.',
          'WORKER_ONBOARDING_INVITATION_SCOPE_CHANGED',
          409,
        );
      }
      const sessionDelivery = await getSessionForDelivery(
        transaction,
        {
          sessionId: reservation.session.id,
          claimId: reservation.claim.id,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          connectionId: fresh.connection.id,
          phoneNumberId: fresh.connection.phoneNumberId,
          blueprintKey: BLUEPRINT_KEY,
          flowId: fresh.publishedFlow.id,
          screenId: fresh.publishedFlow.screenId,
          flowType: fresh.publishedFlow.flowType,
          sourceExternalId: identity.externalId,
          noticeVersion: reservation.session.noticeVersion,
          noticeContentSha256: reservation.session.noticeContentSha256,
        },
        { secret: resolvedSecret, now: dispatchTime },
      );
      const attempt = await markDeliveryAttempted(
        transaction,
        { sessionId: reservation.session.id },
        { secret: resolvedSecret, now: dispatchTime },
      );
      if (attempt.alreadyAttempted) {
        throw invitationError(
          'El proveedor ya tiene un intento de entrega sin resolver.',
          'WORKER_ONBOARDING_INVITATION_DELIVERY_UNKNOWN',
          502,
        );
      }
      return {
        sender: fresh.sender,
        connection: fresh.connection,
        flow: fresh.publishedFlow,
        token: sessionDelivery.token,
      };
    }, { isolationLevel: 'ReadCommitted', maxWait: 5_000, timeout: 15_000 });
  } catch (error) {
    const normalized = normalizedError(error);
    if (isDeliveryAmbiguityError(normalized)) {
      const latest = await existingIdempotentInvitation(
        prisma,
        scope,
        identity,
        initial.conversation.id,
        observedDate(clock),
      );
      if (
        latest?.session?.sentAt
        || latest?.session?.providerMessageId
        || ['accepted', 'sent', 'delivered', 'read'].includes(
          safeMessageStatus(latest?.message?.status),
        )
      ) return latest.response;
      return persistProviderFailure({
        prisma,
        access,
        scope,
        reservation,
        identity,
        error: invitationError(
          'El proveedor ya tiene un intento de entrega sin resolver.',
          'WORKER_ONBOARDING_INVITATION_DELIVERY_UNKNOWN',
          502,
        ),
        definitive: false,
        markRejected: markDeliveryRejected,
        markSent: markSessionSent,
        flowSessionSecret: resolvedSecret,
        clock,
      });
    }
    return persistPreDispatchFailure({
      prisma,
      access,
      scope,
      reservation,
      identity,
      error: normalized,
      clock,
    });
  }

  let providerResult;
  try {
    providerResult = await sendFlow({
      to: delivery.sender.address,
      phoneNumberId: delivery.connection.phoneNumberId,
      scope,
      flowId: delivery.flow.id,
      flowToken: delivery.token,
      screenId: delivery.flow.screenId,
      flowAction: 'data_exchange',
      header: blueprint.message.header,
      body: blueprint.message.body,
      footer: blueprint.message.footer,
      cta: blueprint.message.cta,
    });
  } catch (error) {
    return persistProviderFailure({
      prisma,
      access,
      scope,
      reservation,
      identity,
      error,
      definitive: definitiveProviderRejection(error),
      markRejected: markDeliveryRejected,
      markSent: markSessionSent,
      flowSessionSecret: resolvedSecret,
      clock,
    });
  }

  const wamid = providerMessageId(providerResult);
  if (!wamid) {
    return persistProviderFailure({
      prisma,
      access,
      scope,
      reservation,
      identity,
      error: Object.assign(new Error('Meta accepted without a provider message ID.'), {
        code: 'META_PROVIDER_MESSAGE_ID_MISSING',
      }),
      definitive: false,
      markRejected: markDeliveryRejected,
      markSent: markSessionSent,
      flowSessionSecret: resolvedSecret,
      clock,
    });
  }

  let accepted;
  try {
    accepted = await prisma.$transaction(async (transaction) => {
      const acceptedAt = observedDate(clock);
      await markSessionSent(
        transaction,
        { sessionId: reservation.session.id, providerMessageId: wamid },
        { secret: resolvedSecret, now: acceptedAt },
      );
      const message = await transaction.message.update({
        where: { id: reservation.message.id },
        data: {
          providerMessageId: wamid,
          status: 'accepted',
          metadata: messageMetadata({
            access,
            identity,
            claimId: reservation.claim.id,
            sessionId: reservation.session.id,
            flow: reservation.flow,
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
            action: 'worker.onboarding.invitation_sent',
            entityType: 'Message',
            entityId: reservation.message.id,
            metadata: {
              projectId: scope.projectId,
              conversationId: reservation.message.conversationId,
              blueprintKey: BLUEPRINT_KEY,
              providerStatus: 'accepted',
            },
          },
        }),
      ]);
      return message;
    }, { isolationLevel: 'ReadCommitted', maxWait: 5_000, timeout: 15_000 });
  } catch (error) {
    return persistProviderFailure({
      prisma,
      access,
      scope,
      reservation,
      identity,
      error: Object.assign(error, { code: error?.code || 'LOCAL_CORRELATION_FAILED' }),
      definitive: false,
      providerAccepted: true,
      acceptedProviderMessageId: wamid,
      markRejected: markDeliveryRejected,
      markSent: markSessionSent,
      flowSessionSecret: resolvedSecret,
      clock,
    });
  }

  return {
    conversationId: reservation.message.conversationId,
    invitation: publicInvitation(accepted, reservation.claim, {
      ...reservation.session,
      sentAt: observedDate(clock),
      providerMessageId: wamid,
    }, observedDate(clock)),
    idempotent: Boolean(reservation.recovered),
  };
}
