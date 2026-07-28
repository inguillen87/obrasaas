import { createHash } from 'node:crypto';

import {
  isMedicalEvidenceRecord,
  sanitizeMessagesForMedicalPrivacy,
} from '@/lib/medical-privacy';
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
  WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT,
  resolveClaimedWhatsAppMessageMedia,
} from '@/lib/whatsapp/media-assets';
import { sendWhatsAppText } from '@/lib/whatsapp/meta';

const CUSTOMER_CARE_WINDOW_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_INBOX_CONVERSATION_PAGE_SIZE = 30;
const MAX_INBOX_CONVERSATION_PAGE_SIZE = 80;
const DEFAULT_INBOX_MESSAGE_PAGE_SIZE = 60;
const MAX_INBOX_MESSAGE_PAGE_SIZE = 100;
const MAX_INBOX_CURSOR_LENGTH = 768;
const MAX_MANUAL_TEXT_LENGTH = 4_096;
const STALE_MANUAL_SEND_MS = 2 * 60 * 1_000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const META_CONVERSATION_PREFIX = 'meta:';
const MANUAL_SEND_REQUEST_ACTION = 'whatsapp.inbox.send_requested';
const PUBLIC_DELIVERY_STATUSES = new Set([
  'prepared',
  'sending',
  'accepted',
  'sent',
  'delivered',
  'read',
  'failed',
  'unknown',
]);
const SOURCE_EVIDENCE_KINDS = new Set([
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'DOCUMENT',
]);
const MANUAL_SEND_RATE_LIMITS = Object.freeze({
  actorPerMinute: 20,
  organizationPerMinute: 120,
  conversationPerMinute: 10,
});

export class WhatsAppInboxError extends Error {
  constructor(message, {
    code = 'WHATSAPP_INBOX_ERROR',
    status = 400,
    retryAfterSeconds = null,
  } = {}) {
    super(message);
    this.name = 'WhatsAppInboxError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function validDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nowDate(clock) {
  const value = typeof clock === 'function' ? clock() : clock;
  return validDate(value) || new Date();
}

function paginationError() {
  return new WhatsAppInboxError('La paginación solicitada no es válida.', {
    code: 'INBOX_PAGINATION_INVALID',
    status: 400,
  });
}

function pageSize(value, fallback, maximum) {
  if (value == null || value === '') return fallback;
  const source = String(value).trim();
  if (!/^\d{1,3}$/.test(source)) throw paginationError();
  const parsed = Number(source);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw paginationError();
  }
  return parsed;
}

function encodeInboxCursor(kind, record, boundaryId) {
  const id = String(record?.id || '').trim();
  const scope = String(boundaryId || '').trim();
  const timestamp = kind === 'conversation'
    ? validDate(record?.updatedAt)
    : validDate(record?.createdAt);
  if (!id || !scope || !timestamp) return null;
  return Buffer.from(JSON.stringify({
    v: 1,
    k: kind,
    s: scope,
    id,
    at: timestamp.toISOString(),
  })).toString('base64url');
}

function decodeInboxCursor(value, expectedKind, expectedBoundaryId) {
  if (value == null || value === '') return null;
  const source = String(value).trim();
  if (
    !source
    || source.length > MAX_INBOX_CURSOR_LENGTH
    || !/^[A-Za-z0-9_-]+$/.test(source)
  ) {
    throw paginationError();
  }
  try {
    const parsed = JSON.parse(Buffer.from(source, 'base64url').toString('utf8'));
    const id = String(parsed?.id || '').trim();
    const scope = String(parsed?.s || '').trim();
    const at = validDate(parsed?.at);
    if (
      parsed?.v !== 1
      || parsed?.k !== expectedKind
      || scope !== String(expectedBoundaryId || '').trim()
      || !id
      || id.length > 256
      || !at
    ) {
      throw paginationError();
    }
    return { id, at };
  } catch (error) {
    if (error instanceof WhatsAppInboxError) throw error;
    throw paginationError();
  }
}

function conversationPageWhere(cursor) {
  if (!cursor) return {};
  return {
    OR: [
      { updatedAt: { lt: cursor.at } },
      { updatedAt: cursor.at, id: { lt: cursor.id } },
    ],
  };
}

function messagePageWhere(cursor) {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.at } },
      { createdAt: cursor.at, id: { lt: cursor.id } },
    ],
  };
}

function compareMessageMarkers(left, right) {
  const leftTime = validDate(left?.createdAt)?.getTime() || 0;
  const rightTime = validDate(right?.createdAt)?.getTime() || 0;
  if (leftTime !== rightTime) return leftTime - rightTime;
  const leftId = String(left?.id || '');
  const rightId = String(right?.id || '');
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function boundedText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeWhatsAppPhone(value) {
  const source = String(value || '').trim();
  if (!/^\+?[0-9][0-9 ()-]{6,24}$/.test(source)) return '';
  const phone = source.replace(/\D/g, '');
  return /^\d{8,20}$/.test(phone) ? phone : '';
}

export function whatsAppConversationIdentity(event) {
  const phone = normalizeWhatsAppPhone(event?.from);
  if (!phone) {
    throw new WhatsAppInboxError('Meta no informó un remitente de WhatsApp válido.', {
      code: 'WHATSAPP_CONTACT_INVALID',
      status: 422,
    });
  }
  const displayName = boundedText(event?.displayName, 255) || null;
  return {
    externalId: `${META_CONVERSATION_PREFIX}${phone}`,
    phone,
    displayName,
  };
}

export function whatsAppCustomerCareWindow(lastInboundAt, now = new Date()) {
  const inboundAt = validDate(lastInboundAt);
  const observedAt = nowDate(now);
  if (!inboundAt || inboundAt.getTime() > observedAt.getTime()) {
    return {
      isOpen: false,
      expiresAt: null,
      remainingSeconds: 0,
      reason: inboundAt ? 'INVALID_CLOCK' : 'NO_INBOUND_MESSAGE',
    };
  }

  const expiresAt = new Date(inboundAt.getTime() + CUSTOMER_CARE_WINDOW_MS);
  const remainingMs = expiresAt.getTime() - observedAt.getTime();
  const isOpen = remainingMs > 0;
  return {
    isOpen,
    expiresAt: expiresAt.toISOString(),
    remainingSeconds: isOpen ? Math.ceil(remainingMs / 1_000) : 0,
    reason: isOpen ? 'OPEN' : 'EXPIRED',
  };
}

function phoneFromConversation(conversation) {
  const externalId = String(conversation?.externalId || '');
  if (!externalId.startsWith(META_CONVERSATION_PREFIX)) return '';
  return normalizeWhatsAppPhone(externalId.slice(META_CONVERSATION_PREFIX.length));
}

function maskedWhatsAppPhone(value) {
  const phone = normalizeWhatsAppPhone(value);
  return phone ? `•••• ${phone.slice(-4)}` : '';
}

function jsonMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function publicMessage(message, {
  includeMedicalEvidence = false,
  includeSourceEvidence = false,
} = {}) {
  const messageHasSourceMedia = SOURCE_EVIDENCE_KINDS.has(
    String(message?.kind || '').toUpperCase(),
  ) || Boolean(jsonMetadata(message?.metadata).media);
  const managedMedia = includeSourceEvidence && messageHasSourceMedia
    ? resolveClaimedWhatsAppMessageMedia(message)
    : null;
  const safeMessage = sanitizeMessagesForMedicalPrivacy([message], {
    includeMedicalEvidence,
    // Conversation readers may see operational text. Binary/source evidence
    // still stays private because the public DTO below never emits its URL,
    // storage identity, transcription, or provider metadata.
    includeSourceEvidence: true,
  })[0] || message;
  const rawMetadata = jsonMetadata(safeMessage?.metadata);
  const managedDescriptor = rawMetadata.redacted === true
    ? null
    : managedMedia?.descriptor || null;
  const managedMediaMetadata = managedDescriptor
    ? {
        kind: String(message.kind || '').toLowerCase() || null,
        assetId: managedDescriptor.assetId,
        mimeType: managedDescriptor.mimeType,
        filename: managedDescriptor.filename,
        size: managedDescriptor.size,
        sha256: managedDescriptor.sha256,
      }
    : null;
  const metadata = managedMediaMetadata
    ? { ...rawMetadata, media: managedMediaMetadata }
    : rawMetadata;
  const kind = String(safeMessage.kind || 'TEXT').toUpperCase();
  const containsSourceEvidence = SOURCE_EVIDENCE_KINDS.has(kind)
    || Boolean(metadata.media)
    || Boolean(metadata.transcription);
  const sourceRestricted = containsSourceEvidence && !includeSourceEvidence;
  const rawStatus = String(safeMessage.status || '').trim().toLowerCase();
  const status = String(safeMessage.direction || '').toUpperCase() === 'OUTBOUND'
    ? (PUBLIC_DELIVERY_STATUSES.has(rawStatus) ? rawStatus : 'unknown')
    : null;
  const progressEvidenceLinked = Boolean(
    includeSourceEvidence
    && safeMessage.progressEvidenceSource?.id
  );
  const sourceEvidenceViewable = Boolean(
    includeSourceEvidence
    && String(safeMessage.direction || '').toUpperCase() === 'INBOUND'
    && containsSourceEvidence
    && (managedDescriptor || (safeMessage.mediaUrl && metadata.media))
    && metadata.quarantined !== true
  );
  const progressEvidenceEligible = Boolean(
    includeSourceEvidence
    && !progressEvidenceLinked
    && sourceEvidenceViewable
    && String(safeMessage.direction || '').toUpperCase() === 'INBOUND'
    && kind === 'IMAGE'
    && metadata.provider === 'meta'
    && metadata.authorized === true
    && metadata.quarantined !== true
    && (managedDescriptor || metadata.media)
    && !isMedicalEvidenceRecord(safeMessage)
  );
  return {
    id: safeMessage.id,
    direction: safeMessage.direction,
    kind: kind.toLowerCase(),
    body: sourceRestricted
      ? 'Evidencia adjunta recibida. El archivo y su contenido están restringidos para este rol.'
      : safeMessage.body || '',
    status,
    sourceEvidenceViewable,
    progressEvidenceEligible,
    progressEvidenceLinked,
    sentAt: validDate(safeMessage.sentAt)?.toISOString() || null,
    recordedAt: validDate(safeMessage.createdAt)?.toISOString() || null,
    media: sourceRestricted || metadata.sourceContentRestricted && !includeSourceEvidence
      ? null
      : metadata.media
        ? {
            kind: metadata.media.kind || null,
            mimeType: metadata.media.mimeType || null,
            filename: metadata.media.filename || null,
          }
        : null,
  };
}

function publicConversation(conversation, options = {}) {
  const lastMessage = Array.isArray(conversation.messages)
    ? conversation.messages[0] || null
    : null;
  const maskedPhone = maskedWhatsAppPhone(phoneFromConversation(conversation));
  return {
    id: conversation.id,
    displayName: conversation.displayName || (maskedPhone ? `Contacto ${maskedPhone}` : 'Contacto de WhatsApp'),
    phone: maskedPhone,
    lastMessage: lastMessage ? publicMessage(lastMessage, options) : null,
    lastMessageAt: validDate(lastMessage?.createdAt || conversation.updatedAt)?.toISOString() || null,
    unreadCount: Math.max(0, Number(options.unreadCount) || 0),
  };
}

function textChannelReadiness(connection, env = process.env, now = new Date()) {
  const readiness = deriveStoredWhatsAppChannelReadiness({
    connection,
    env,
    now,
  });
  const account = readiness.checks.account;
  return {
    readiness,
    operational: Boolean(
      connection?.enabled
      && connection.connectionStatus === 'CONNECTED'
      && connection.encryptedAccessToken
      && readiness.checks.platform.configured
      && account.linked
      && account.enabled
      && account.tokenStatus === 'VALID'
      && account.scopesVerified
      && account.phoneStatus === 'REGISTERED'
      && account.qualityStatus !== 'DEGRADED'
      && account.providerStatus !== 'DEGRADED'
      && readiness.checks.webhook.subscriptionStatus === 'SUBSCRIBED'
    ),
  };
}

function publicConnection(connection, env = process.env, now = new Date()) {
  if (!connection) {
    return {
      operational: false,
      status: 'NOT_CONNECTED',
      reason: 'ACCOUNT_NOT_CONNECTED',
      displayPhoneNumber: null,
      verifiedBusinessName: null,
    };
  }
  const { operational, readiness } = textChannelReadiness(connection, env, now);
  return {
    operational,
    status: connection.connectionStatus,
    reason: operational ? null : readiness.nextAction?.code || 'CHANNEL_NOT_READY',
    displayPhoneNumber: connection.displayPhoneNumber || null,
    verifiedBusinessName: connection.verifiedBusinessName || null,
  };
}

function platformConfigurationReady(env) {
  return Object.values(whatsAppPlatformConfiguration(env)).every(Boolean);
}

function trustedScope(access) {
  const organizationId = String(access?.organization?.id || '').trim();
  const projectId = String(access?.project?.id || '').trim();
  if (!organizationId || !projectId) {
    throw new WhatsAppInboxError('No hay una obra activa para esta bandeja.', {
      code: 'PROJECT_SCOPE_REQUIRED',
      status: 403,
    });
  }
  return { organizationId, projectId };
}

function trustedActorId(access) {
  const actorId = String(access?.databaseUserId || '').trim();
  if (!actorId) {
    throw new WhatsAppInboxError('No pudimos identificar al usuario de la bandeja.', {
      code: 'INBOX_ACTOR_REQUIRED',
      status: 403,
    });
  }
  return actorId;
}

function trustedMembershipId(access) {
  const membershipId = String(access?.tenantMembershipId || '').trim();
  return membershipId || null;
}

async function unreadCountsForConversations(prisma, {
  scope,
  actorId,
  membershipId,
  conversationIds,
}) {
  if (!conversationIds.length) return new Map();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT message."conversationId" AS "conversationId",
            COUNT(*)::integer AS "unreadCount"
       FROM "Message" AS message
       INNER JOIN "Conversation" AS conversation
         ON conversation."id" = message."conversationId"
       INNER JOIN "Project" AS project
         ON project."id" = conversation."projectId"
       INNER JOIN "PlatformUser" AS actor
         ON actor."id" = $1
       LEFT JOIN "TenantMembership" AS membership
         ON membership."id" = $4
        AND membership."userId" = actor."id"
        AND membership."organizationId" = project."organizationId"
        AND membership."status" = 'ACTIVE'
       LEFT JOIN "ProjectMembership" AS project_membership
         ON project_membership."tenantMembershipId" = membership."id"
        AND project_membership."projectId" = conversation."projectId"
        AND project_membership."status" = 'ACTIVE'
       LEFT JOIN "ConversationReadState" AS read_state
         ON read_state."conversationId" = conversation."id"
        AND read_state."platformUserId" = $1
      WHERE conversation."projectId" = $2
        AND project."organizationId" = $3
        AND conversation."channel" = 'whatsapp'
        AND conversation."externalId" LIKE 'meta:%'
        AND conversation."id" = ANY($5::text[])
        AND message."direction" = 'INBOUND'
        AND (
          (
            read_state."conversationId" IS NOT NULL
            AND (message."createdAt", message."id")
              > (read_state."lastReadCreatedAt", read_state."lastReadMessageId")
          )
          OR (
            read_state."conversationId" IS NULL
            AND message."createdAt" > GREATEST(
              COALESCE(
                conversation."unreadTrackingStartedAt",
                '-infinity'::timestamp
              ),
              GREATEST(
                actor."createdAt",
                COALESCE(membership."createdAt", actor."createdAt"),
                COALESCE(
                  project_membership."createdAt",
                  membership."createdAt",
                  actor."createdAt"
                )
              )
            )
          )
        )
      GROUP BY message."conversationId"`,
    actorId,
    scope.projectId,
    scope.organizationId,
    membershipId,
    conversationIds,
  );
  return new Map(rows.map((row) => [
    String(row.conversationId),
    Math.max(0, Number(row.unreadCount) || 0),
  ]));
}

async function unreadSummaryForScope(prisma, {
  scope,
  actorId,
  membershipId,
  conversationId = null,
}) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::integer AS "unreadTotal",
            COUNT(*) FILTER (
              WHERE conversation."id" = $5
            )::integer AS "conversationUnreadCount"
       FROM "Message" AS message
       INNER JOIN "Conversation" AS conversation
         ON conversation."id" = message."conversationId"
       INNER JOIN "Project" AS project
         ON project."id" = conversation."projectId"
       INNER JOIN "PlatformUser" AS actor
         ON actor."id" = $1
       LEFT JOIN "TenantMembership" AS membership
         ON membership."id" = $4
        AND membership."userId" = actor."id"
        AND membership."organizationId" = project."organizationId"
        AND membership."status" = 'ACTIVE'
       LEFT JOIN "ProjectMembership" AS project_membership
         ON project_membership."tenantMembershipId" = membership."id"
        AND project_membership."projectId" = conversation."projectId"
        AND project_membership."status" = 'ACTIVE'
       LEFT JOIN "ConversationReadState" AS read_state
         ON read_state."conversationId" = conversation."id"
        AND read_state."platformUserId" = $1
      WHERE conversation."projectId" = $2
        AND project."organizationId" = $3
        AND conversation."channel" = 'whatsapp'
        AND conversation."externalId" LIKE 'meta:%'
        AND message."direction" = 'INBOUND'
        AND (
          (
            read_state."conversationId" IS NOT NULL
            AND (message."createdAt", message."id")
              > (read_state."lastReadCreatedAt", read_state."lastReadMessageId")
          )
          OR (
            read_state."conversationId" IS NULL
            AND message."createdAt" > GREATEST(
              COALESCE(
                conversation."unreadTrackingStartedAt",
                '-infinity'::timestamp
              ),
              GREATEST(
                actor."createdAt",
                COALESCE(membership."createdAt", actor."createdAt"),
                COALESCE(
                  project_membership."createdAt",
                  membership."createdAt",
                  actor."createdAt"
                )
              )
            )
          )
        )`,
    actorId,
    scope.projectId,
    scope.organizationId,
    membershipId,
    conversationId,
  );
  return {
    unreadTotal: Math.max(0, Number(rows[0]?.unreadTotal) || 0),
    conversationUnreadCount: Math.max(
      0,
      Number(rows[0]?.conversationUnreadCount) || 0,
    ),
  };
}

async function unreadTotalForScope(prisma, options) {
  const summary = await unreadSummaryForScope(prisma, options);
  return summary.unreadTotal;
}

export async function listWhatsAppInbox({
  prisma,
  access,
  limit,
  cursor,
  includeMedicalEvidence = false,
  includeSourceEvidence = false,
  env = process.env,
  clock = () => new Date(),
}) {
  const scope = trustedScope(access);
  const actorId = trustedActorId(access);
  const membershipId = trustedMembershipId(access);
  const requestedLimit = pageSize(
    limit,
    DEFAULT_INBOX_CONVERSATION_PAGE_SIZE,
    MAX_INBOX_CONVERSATION_PAGE_SIZE,
  );
  const decodedCursor = decodeInboxCursor(cursor, 'conversation', scope.projectId);
  const [connection, conversations, unreadTotal] = await Promise.all([
    prisma.whatsAppConnection.findFirst({
      where: {
        projectId: scope.projectId,
        project: { organizationId: scope.organizationId },
      },
      select: {
        enabled: true,
        connectionStatus: true,
        encryptedAccessToken: true,
        lastError: true,
        metadata: true,
        displayPhoneNumber: true,
        verifiedBusinessName: true,
      },
    }),
    prisma.conversation.findMany({
      where: {
        projectId: scope.projectId,
        project: { organizationId: scope.organizationId },
        channel: 'whatsapp',
        externalId: { startsWith: META_CONVERSATION_PREFIX },
        ...conversationPageWhere(decodedCursor),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: requestedLimit + 1,
      select: {
        id: true,
        externalId: true,
        displayName: true,
        updatedAt: true,
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            id: true,
            conversationId: true,
            externalId: true,
            direction: true,
            kind: true,
            body: true,
            mediaUrl: true,
            status: true,
            metadata: true,
            sentAt: true,
            createdAt: true,
            progressEvidenceSource: { select: { id: true } },
            whatsappMediaAsset: { select: WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT },
          },
        },
      },
    }),
    unreadTotalForScope(prisma, { scope, actorId, membershipId }),
  ]);
  const hasMore = conversations.length > requestedLimit;
  const page = hasMore ? conversations.slice(0, requestedLimit) : conversations;
  const unreadCounts = await unreadCountsForConversations(prisma, {
    scope,
    actorId,
    membershipId,
    conversationIds: page.map((conversation) => conversation.id),
  });

  return {
    project: { id: scope.projectId, name: access.project.name || 'Obra activa' },
    connection: publicConnection(connection, env, nowDate(clock)),
    unreadTotal,
    conversations: page.map((conversation) => publicConversation(
      conversation,
      {
        includeMedicalEvidence,
        includeSourceEvidence,
        unreadCount: unreadCounts.get(conversation.id) || 0,
      },
    )),
    pageInfo: {
      hasMore,
      nextCursor: hasMore
        ? encodeInboxCursor('conversation', page[page.length - 1], scope.projectId)
        : null,
    },
  };
}

async function findScopedConversation(
  prisma,
  scope,
  conversationId,
  { includeLatestMessage = false } = {},
) {
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
    select: {
      id: true,
      externalId: true,
      displayName: true,
      updatedAt: true,
      ...(includeLatestMessage
        ? {
            messages: {
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: {
                id: true,
                conversationId: true,
                externalId: true,
                direction: true,
                kind: true,
                body: true,
                mediaUrl: true,
                status: true,
                metadata: true,
                sentAt: true,
                createdAt: true,
                progressEvidenceSource: { select: { id: true } },
                whatsappMediaAsset: { select: WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT },
              },
            },
          }
        : {}),
    },
  });
}

function chronologicalMessages(messages) {
  return messages.slice().sort((left, right) => (
    compareMessageMarkers(
      { id: left.id, createdAt: left.createdAt },
      { id: right.id, createdAt: right.createdAt },
    )
  ));
}

export async function getWhatsAppConversationMessages({
  prisma,
  access,
  conversationId,
  limit,
  cursor,
  includeMedicalEvidence = false,
  includeSourceEvidence = false,
  canManage = false,
  clock = () => new Date(),
  env = process.env,
}) {
  const scope = trustedScope(access);
  const actorId = trustedActorId(access);
  const membershipId = trustedMembershipId(access);
  const requestedLimit = pageSize(
    limit,
    DEFAULT_INBOX_MESSAGE_PAGE_SIZE,
    MAX_INBOX_MESSAGE_PAGE_SIZE,
  );
  const decodedCursor = decodeInboxCursor(cursor, 'message', conversationId);
  const conversation = await findScopedConversation(
    prisma,
    scope,
    conversationId,
    { includeLatestMessage: true },
  );
  if (!conversation) {
    throw new WhatsAppInboxError('La conversación ya no está disponible en esta obra.', {
      code: 'INBOX_CONVERSATION_NOT_FOUND',
      status: 404,
    });
  }
  const observedAt = nowDate(clock);
  const [messageRows, inbound, project, connection, unreadCounts] = await Promise.all([
    prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...messagePageWhere(decodedCursor),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: requestedLimit + 1,
      select: {
        id: true,
        conversationId: true,
        externalId: true,
        direction: true,
        kind: true,
        body: true,
        mediaUrl: true,
        status: true,
        metadata: true,
        sentAt: true,
        createdAt: true,
        progressEvidenceSource: { select: { id: true } },
        whatsappMediaAsset: { select: WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT },
      },
    }),
    prisma.message.findFirst({
      where: { conversationId: conversation.id, direction: 'INBOUND' },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, sentAt: true },
    }),
    prisma.project.findFirst({
      where: { id: scope.projectId, organizationId: scope.organizationId },
      include: { organization: true },
    }),
    prisma.whatsAppConnection.findUnique({
      where: { projectId: scope.projectId },
      select: {
        id: true,
        phoneNumberId: true,
        enabled: true,
        connectionStatus: true,
        encryptedAccessToken: true,
        lastError: true,
        metadata: true,
      },
    }),
    unreadCountsForConversations(prisma, {
      scope,
      actorId,
      membershipId,
      conversationIds: [conversation.id],
    }),
  ]);
  const hasMore = messageRows.length > requestedLimit;
  const page = hasMore ? messageRows.slice(0, requestedLimit) : messageRows;
  const orderedMessages = chronologicalMessages(page);
  const window = whatsAppCustomerCareWindow(inbound?.sentAt, observedAt);
  return {
    conversation: publicConversation(
      conversation,
      {
        includeMedicalEvidence,
        includeSourceEvidence,
        unreadCount: unreadCounts.get(conversation.id) || 0,
      },
    ),
    messages: orderedMessages.map((message) => publicMessage(
      message,
      { includeMedicalEvidence, includeSourceEvidence },
    )),
    window,
    composerCapability: manualComposerCapability({
      canManage,
      project,
      connection,
      inbound,
      observedAt,
      env,
    }),
    pageInfo: {
      hasMore,
      nextCursor: hasMore
        ? encodeInboxCursor('message', page[page.length - 1], conversation.id)
        : null,
    },
  };
}

export async function markWhatsAppConversationRead({
  prisma,
  access,
  conversationId,
  throughMessageId,
}) {
  const scope = trustedScope(access);
  const actorId = trustedActorId(access);
  const membershipId = trustedMembershipId(access);
  const targetId = String(throughMessageId || '').trim();
  if (!targetId || targetId.length > 256) {
    throw new WhatsAppInboxError('El punto de lectura no es válido.', {
      code: 'INBOX_READ_TARGET_INVALID',
      status: 400,
    });
  }

  const readState = await prisma.$transaction(async (transaction) => {
    const conversation = await findScopedConversation(
      transaction,
      scope,
      conversationId,
    );
    if (!conversation) {
      throw new WhatsAppInboxError('La conversación ya no está disponible en esta obra.', {
        code: 'INBOX_CONVERSATION_NOT_FOUND',
        status: 404,
      });
    }
    const target = await transaction.message.findFirst({
      where: { id: targetId, conversationId: conversation.id },
      select: { id: true, createdAt: true },
    });
    if (!target) {
      throw new WhatsAppInboxError('El mensaje visible ya no está disponible.', {
        code: 'INBOX_READ_TARGET_NOT_FOUND',
        status: 404,
      });
    }

    await transaction.$queryRawUnsafe(
      `INSERT INTO "ConversationReadState" (
         "conversationId",
         "platformUserId",
         "lastReadMessageId",
         "lastReadCreatedAt",
         "createdAt",
         "updatedAt"
       ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("conversationId", "platformUserId") DO UPDATE
       SET "lastReadMessageId" = EXCLUDED."lastReadMessageId",
           "lastReadCreatedAt" = EXCLUDED."lastReadCreatedAt",
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE (
         "ConversationReadState"."lastReadCreatedAt",
         "ConversationReadState"."lastReadMessageId"
       ) < (
         EXCLUDED."lastReadCreatedAt",
         EXCLUDED."lastReadMessageId"
       )
       RETURNING "lastReadMessageId"`,
      conversation.id,
      actorId,
      target.id,
      target.createdAt,
    );
    const state = await transaction.conversationReadState.findUnique({
      where: {
        conversationId_platformUserId: {
          conversationId: conversation.id,
          platformUserId: actorId,
        },
      },
      select: {
        lastReadMessageId: true,
        lastReadCreatedAt: true,
      },
    });
    if (!state) {
      throw new WhatsAppInboxError('No pudimos confirmar el punto de lectura.', {
        code: 'INBOX_READ_STATE_UNAVAILABLE',
        status: 503,
      });
    }
    const marker = {
      id: state.lastReadMessageId,
      createdAt: state.lastReadCreatedAt,
    };
    const unreadSummary = await unreadSummaryForScope(transaction, {
      scope,
      actorId,
      membershipId,
      conversationId: conversation.id,
    });
    return {
      conversationId: conversation.id,
      unreadCount: unreadSummary.conversationUnreadCount,
      unreadTotal: unreadSummary.unreadTotal,
      readThrough: {
        messageId: marker.id,
        recordedAt: validDate(marker.createdAt)?.toISOString() || null,
      },
    };
  }, {
    isolationLevel: 'ReadCommitted',
    maxWait: 5_000,
    timeout: 10_000,
  });
  return readState;
}

function manualMessageExternalId(scope, conversationId, idempotencyKey) {
  const digest = createHash('sha256')
    .update(`obrasaas-whatsapp-manual-v1\0${scope.organizationId}\0${scope.projectId}\0${conversationId}\0${idempotencyKey}`)
    .digest('hex');
  return { externalId: `obrasaas-manual:${digest}`, digest };
}

function providerMessageId(result) {
  const id = result?.messages?.[0]?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function ambiguousSendFailure(error) {
  if (error?.ambiguous === true) return true;
  if (Number(error?.status) >= 500) return true;
  return error?.name === 'AbortError' || error?.name === 'TimeoutError' || error instanceof TypeError;
}

function idempotencyKeyValue(value) {
  const key = String(value || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new WhatsAppInboxError('La operación requiere una clave de idempotencia válida.', {
      code: 'IDEMPOTENCY_KEY_INVALID',
      status: 400,
    });
  }
  return key;
}

function manualBody(value) {
  const text = String(value || '').trim();
  if (!text || text.length > MAX_MANUAL_TEXT_LENGTH) {
    throw new WhatsAppInboxError('El mensaje debe tener entre 1 y 4096 caracteres.', {
      code: 'WHATSAPP_MESSAGE_INVALID',
      status: 400,
    });
  }
  return text;
}

function manualPublicMessage(message, options = {}) {
  return publicMessage(message, options);
}

function manualSendFailure(error, fallback = {}) {
  if (error instanceof WhatsAppInboxError) return error;
  if (error instanceof ProjectWritePolicyError) {
    return new WhatsAppInboxError(error.message, {
      code: error.code,
      status: error.status,
    });
  }
  return new WhatsAppInboxError(
    fallback.message || 'No se pudo preparar el envío de WhatsApp.',
    {
      code: fallback.code || 'WHATSAPP_SEND_PREPARATION_FAILED',
      status: fallback.status || 500,
    },
  );
}

function assertManualSendState({ project, connection, inbound, observedAt, env }) {
  if (!project) {
    throw new WhatsAppInboxError('La obra ya no está disponible.', {
      code: 'PROJECT_WRITE_SCOPE_INVALID',
      status: 403,
    });
  }
  if (!subscriptionAllowsWrites(project.organization, observedAt)) {
    throw new WhatsAppInboxError('El plan actual no permite enviar mensajes.', {
      code: 'SUBSCRIPTION_WRITE_BLOCKED',
      status: 402,
    });
  }
  if (!platformConfigurationReady(env)) {
    throw new WhatsAppInboxError('La configuración segura de Meta todavía está incompleta.', {
      code: 'WHATSAPP_PLATFORM_NOT_READY',
      status: 409,
    });
  }
  if (
    !connection?.enabled
    || connection.connectionStatus !== 'CONNECTED'
    || !connection.encryptedAccessToken
    || !connection.phoneNumberId
  ) {
    throw new WhatsAppInboxError('WhatsApp no está operativo para esta obra.', {
      code: 'WHATSAPP_CONNECTION_NOT_OPERATIONAL',
      status: 409,
    });
  }
  const { operational } = textChannelReadiness(connection, env, observedAt);
  if (!operational) {
    throw new WhatsAppInboxError(
      'La cuenta de WhatsApp todavía no superó la verificación operativa.',
      { code: 'WHATSAPP_CHANNEL_NOT_READY', status: 409 },
    );
  }
  const window = whatsAppCustomerCareWindow(inbound?.sentAt, observedAt);
  if (!window.isOpen) {
    throw new WhatsAppInboxError('La ventana de 24 horas cerró. Elegí una plantilla aprobada.', {
      code: 'WHATSAPP_TEMPLATE_REQUIRED',
      status: 409,
    });
  }
  return window;
}

function manualComposerCapability({
  canManage,
  project,
  connection,
  inbound,
  observedAt,
  env,
}) {
  const window = whatsAppCustomerCareWindow(inbound?.sentAt, observedAt);
  if (!canManage) {
    return {
      allowed: false,
      code: 'WHATSAPP_MANAGE_PERMISSION_REQUIRED',
      reason: 'Tu rol puede leer la conversación, pero no enviar mensajes.',
    };
  }
  if (!project || !['PLANNING', 'ACTIVE', 'PAUSED'].includes(project.status)) {
    return {
      allowed: false,
      code: 'PROJECT_READ_ONLY',
      reason: 'La obra está en modo solo lectura.',
    };
  }
  try {
    assertManualSendState({
      project,
      connection,
      inbound,
      observedAt,
      env,
    });
    return { allowed: true, code: 'READY', reason: null };
  } catch (error) {
    return {
      allowed: false,
      code: error?.code || 'WHATSAPP_SEND_BLOCKED',
      reason: error?.message || 'El canal no está listo para enviar.',
      ...(window.expiresAt ? { expiresAt: window.expiresAt } : {}),
    };
  }
}

async function loadManualSendState(transaction, {
  scope,
  conversationId,
  observedAt,
  env,
}) {
  await requireOperationalProjectWrite(transaction, scope);
  // Keep the subscription snapshot stable until this transaction commits.
  // Every normal Organization UPDATE must acquire a conflicting row lock.
  await transaction.$queryRawUnsafe(
    'SELECT id FROM "Organization" WHERE id = $1 FOR SHARE',
    scope.organizationId,
  );
  const conversation = await findScopedConversation(transaction, scope, conversationId);
  if (!conversation) {
    throw new WhatsAppInboxError('La conversación ya no está disponible en esta obra.', {
      code: 'INBOX_CONVERSATION_NOT_FOUND',
      status: 404,
    });
  }
  const [project, connection, inbound] = await Promise.all([
    transaction.project.findFirst({
      where: { id: scope.projectId, organizationId: scope.organizationId },
      include: { organization: true },
    }),
    transaction.whatsAppConnection.findUnique({
      where: { projectId: scope.projectId },
      select: {
        id: true,
        phoneNumberId: true,
        enabled: true,
        connectionStatus: true,
        encryptedAccessToken: true,
        lastError: true,
        metadata: true,
      },
    }),
    transaction.message.findFirst({
      where: { conversationId: conversation.id, direction: 'INBOUND' },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, externalId: true, sentAt: true },
    }),
  ]);
  const window = assertManualSendState({
    project,
    connection,
    inbound,
    observedAt,
    env,
  });
  return { conversation, project, connection, inbound, window };
}

async function lockManualSendRateLane(transaction, organizationId) {
  await transaction.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    `whatsapp-manual-send:${organizationId}`,
  );
}

async function assertManualSendRateLimit(transaction, {
  scope,
  actorId,
  conversationId,
  observedAt,
}) {
  const since = new Date(observedAt.getTime() - 60_000);
  const baseWhere = {
    organizationId: scope.organizationId,
    action: MANUAL_SEND_REQUEST_ACTION,
    createdAt: { gte: since },
  };
  const [actorMinuteCount, organizationMinuteCount, conversationMinuteCount] = await Promise.all([
    actorId
      ? transaction.auditLog.count({ where: { ...baseWhere, actorId } })
      : Promise.resolve(0),
    transaction.auditLog.count({ where: baseWhere }),
    transaction.auditLog.count({
      where: {
        ...baseWhere,
        entityType: 'Conversation',
        entityId: conversationId,
      },
    }),
  ]);
  let code = null;
  if (actorMinuteCount >= MANUAL_SEND_RATE_LIMITS.actorPerMinute) {
    code = 'WHATSAPP_ACTOR_RATE_LIMIT';
  } else if (organizationMinuteCount >= MANUAL_SEND_RATE_LIMITS.organizationPerMinute) {
    code = 'WHATSAPP_ORGANIZATION_RATE_LIMIT';
  } else if (conversationMinuteCount >= MANUAL_SEND_RATE_LIMITS.conversationPerMinute) {
    code = 'WHATSAPP_CONVERSATION_RATE_LIMIT';
  }
  if (code) {
    throw new WhatsAppInboxError(
      'Se alcanzó el límite seguro de envíos. Esperá un minuto antes de continuar.',
      { code, status: 429, retryAfterSeconds: 60 },
    );
  }
}

function manualMessageMetadata({ access, identity, payloadDigest, extra = {} }) {
  return {
    source: 'dashboard-inbox',
    actorId: access.databaseUserId || null,
    idempotencyDigest: identity.digest,
    payloadDigest,
    ...extra,
  };
}

function assertManualSendReplay(existing, { conversationId, payloadDigest }) {
  if (
    existing.conversationId !== conversationId
    || jsonMetadata(existing.metadata).payloadDigest !== payloadDigest
  ) {
    throw new WhatsAppInboxError(
      'La clave de idempotencia ya fue usada con otro mensaje.',
      { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', status: 409 },
    );
  }
  return existing;
}

async function reconcileStaleManualSend(transaction, {
  message,
  access,
  scope,
  identity,
  payloadDigest,
  observedAt,
}) {
  const claimedAt = validDate(message.sentAt || message.createdAt);
  if (
    String(message.status || '').toLowerCase() !== 'sending'
    || !claimedAt
    || observedAt.getTime() - claimedAt.getTime() < STALE_MANUAL_SEND_MS
  ) {
    return message;
  }
  const updated = await transaction.message.update({
    where: { id: message.id },
    data: {
      status: 'unknown',
      metadata: manualMessageMetadata({
        access,
        identity,
        payloadDigest,
        extra: {
          failureCode: 'STALE_DISPATCH_CLAIM',
          failedAt: observedAt.toISOString(),
        },
      }),
    },
  });
  await transaction.auditLog.create({
    data: {
      organizationId: scope.organizationId,
      actorId: access.databaseUserId || null,
      action: 'whatsapp.inbox.delivery_unknown',
      entityType: 'Message',
      entityId: message.id,
      metadata: {
        projectId: scope.projectId,
        conversationId: message.conversationId,
        providerStatus: 'unknown',
        failureCode: 'STALE_DISPATCH_CLAIM',
      },
    },
  });
  return updated;
}

export async function sendManualWhatsAppMessage({
  prisma,
  access,
  conversationId,
  body,
  idempotencyKey,
  includeMedicalEvidence = false,
  sendText = sendWhatsAppText,
  clock = () => new Date(),
  env = process.env,
}) {
  const scope = trustedScope(access);
  const key = idempotencyKeyValue(idempotencyKey);
  const text = manualBody(body);
  const observedAt = nowDate(clock);
  const conversation = await findScopedConversation(prisma, scope, conversationId);
  if (!conversation) {
    throw new WhatsAppInboxError('La conversación ya no está disponible en esta obra.', {
      code: 'INBOX_CONVERSATION_NOT_FOUND',
      status: 404,
    });
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
      select: { id: true, externalId: true, sentAt: true },
    }),
  ]);

  const identity = manualMessageExternalId(scope, conversation.id, key);
  const payloadDigest = createHash('sha256').update(text).digest('hex');
  const existingSnapshot = await prisma.message.findUnique({
    where: { externalId: identity.externalId },
  });
  if (existingSnapshot) {
    assertManualSendReplay(existingSnapshot, {
      conversationId: conversation.id,
      payloadDigest,
    });
    let reconciled = existingSnapshot;
    if (String(existingSnapshot.status || '').toLowerCase() === 'sending') {
      reconciled = await prisma.$transaction(async (transaction) => {
        await lockManualSendRateLane(transaction, scope.organizationId);
        const current = await transaction.message.findUnique({
          where: { externalId: identity.externalId },
        });
        if (!current) {
          throw new WhatsAppInboxError('No pudimos reconciliar el mensaje enviado.', {
            code: 'WHATSAPP_SEND_RECONCILIATION_FAILED',
            status: 409,
          });
        }
        assertManualSendReplay(current, {
          conversationId: conversation.id,
          payloadDigest,
        });
        return reconcileStaleManualSend(transaction, {
          message: current,
          access,
          scope,
          identity,
          payloadDigest,
          observedAt,
        });
      }, { isolationLevel: 'ReadCommitted' });
    }
    return {
      message: manualPublicMessage(reconciled, { includeMedicalEvidence }),
      window: whatsAppCustomerCareWindow(inbound?.sentAt, observedAt),
      idempotent: true,
    };
  }

  if (!project || !['PLANNING', 'ACTIVE', 'PAUSED'].includes(project.status)) {
    throw new WhatsAppInboxError('La obra está en modo solo lectura.', {
      code: 'PROJECT_READ_ONLY',
      status: 409,
    });
  }
  const window = assertManualSendState({
    project,
    connection,
    inbound,
    observedAt,
    env,
  });

  let claimed;
  try {
    const reservation = await prisma.$transaction(async (transaction) => {
      await lockManualSendRateLane(transaction, scope.organizationId);
      const existing = await transaction.message.findUnique({
        where: { externalId: identity.externalId },
      });
      if (existing) {
        assertManualSendReplay(existing, {
          conversationId: conversation.id,
          payloadDigest,
        });
        const reconciled = await reconcileStaleManualSend(transaction, {
          message: existing,
          access,
          scope,
          identity,
          payloadDigest,
          observedAt,
        });
        return {
          message: reconciled,
          idempotent: true,
          window: whatsAppCustomerCareWindow(inbound?.sentAt, observedAt),
        };
      }
      const fresh = await loadManualSendState(transaction, {
        scope,
        conversationId: conversation.id,
        observedAt,
        env,
      });
      await assertManualSendRateLimit(transaction, {
        scope,
        actorId: access.databaseUserId || null,
        conversationId: fresh.conversation.id,
        observedAt,
      });
      const message = await transaction.message.create({
        data: {
          conversationId: fresh.conversation.id,
          externalId: identity.externalId,
          direction: 'OUTBOUND',
          kind: 'TEXT',
          body: text,
          status: 'sending',
          sentAt: observedAt,
          metadata: manualMessageMetadata({ access, identity, payloadDigest }),
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: access.databaseUserId || null,
          action: MANUAL_SEND_REQUEST_ACTION,
          entityType: 'Conversation',
          entityId: fresh.conversation.id,
          metadata: {
            projectId: scope.projectId,
            messageId: message.id,
            payloadDigest,
          },
        },
      });
      return { message, idempotent: false, window: fresh.window };
    }, { isolationLevel: 'ReadCommitted' });
    if (reservation.idempotent) {
      return {
        message: manualPublicMessage(reservation.message, { includeMedicalEvidence }),
        window: reservation.window,
        idempotent: true,
      };
    }
    claimed = reservation.message;
  } catch (error) {
    if (error?.code !== 'P2002') throw manualSendFailure(error);
    const existing = await prisma.message.findUnique({
      where: { externalId: identity.externalId },
    });
    if (!existing || existing.conversationId !== conversation.id) throw error;
    if (jsonMetadata(existing.metadata).payloadDigest !== payloadDigest) {
      throw new WhatsAppInboxError(
        'La clave de idempotencia ya fue usada con otro mensaje.',
        { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', status: 409 },
      );
    }
    return {
      message: manualPublicMessage(existing, { includeMedicalEvidence }),
      window,
      idempotent: true,
    };
  }

  const recipient = phoneFromConversation(conversation);
  if (!recipient) {
    await prisma.message.update({
      where: { id: claimed.id },
      data: { status: 'failed' },
    });
    throw new WhatsAppInboxError('El contacto de la conversación no es válido.', {
      code: 'WHATSAPP_CONTACT_INVALID',
      status: 422,
    });
  }

  async function persistProviderFailure(error, {
    forceAmbiguous = false,
    database = prisma,
    throwAfter = true,
  } = {}) {
    const ambiguous = forceAmbiguous || ambiguousSendFailure(error);
    const status = ambiguous ? 'unknown' : 'failed';
    const failureData = {
      status,
      metadata: manualMessageMetadata({
        access,
        identity,
        payloadDigest,
        extra: {
          failureCode: boundedText(error?.code || error?.name || 'META_SEND_ERROR', 80),
          failedAt: nowDate(clock).toISOString(),
        },
      }),
    };
    try {
      claimed = await database.message.update({
        where: { id: claimed.id },
        data: failureData,
      });
    } catch (persistenceError) {
      if (!throwAfter) throw persistenceError;
      console.error('A WhatsApp provider failure could not update its claimed message:', persistenceError);
      try {
        await database.message.updateMany({
          where: { id: claimed.id, conversationId: conversation.id },
          data: failureData,
        });
      } catch (fallbackError) {
        console.error('The fallback WhatsApp failure update also failed:', fallbackError);
      }
    }
    const supportingWrites = [
      database.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: nowDate(clock) },
      }),
      database.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: access.databaseUserId || null,
          action: ambiguous
            ? 'whatsapp.inbox.delivery_unknown'
            : 'whatsapp.inbox.message_rejected',
          entityType: 'Message',
          entityId: claimed.id,
          metadata: {
            projectId: scope.projectId,
            conversationId: conversation.id,
            providerStatus: status,
            failureCode: failureData.metadata.failureCode,
          },
        },
      }),
    ];
    if (throwAfter) {
      const failureWrites = await Promise.allSettled(supportingWrites);
      for (const write of failureWrites) {
        if (write.status === 'rejected') {
          console.error('A supporting WhatsApp failure record could not be persisted:', write.reason);
        }
      }
    } else {
      await Promise.all(supportingWrites);
    }
    const responseError = new WhatsAppInboxError(
      ambiguous
        ? 'Meta no confirmó la entrega. No se reenviará automáticamente para evitar duplicados.'
        : 'Meta rechazó el mensaje.',
      {
        code: ambiguous ? 'WHATSAPP_DELIVERY_UNKNOWN' : 'WHATSAPP_SEND_REJECTED',
        status: 502,
      },
    );
    if (throwAfter) throw responseError;
    return responseError;
  }

  let providerDispatchStarted = false;
  let outcome;
  try {
    outcome = await prisma.$transaction(async (transaction) => {
      const fresh = await loadManualSendState(transaction, {
        scope,
        conversationId: conversation.id,
        observedAt: nowDate(clock),
        env,
      });
      providerDispatchStarted = true;
      let result;
      try {
        result = await sendText({
          to: recipient,
          text,
          replyToMessageId: fresh.inbound?.externalId || undefined,
          phoneNumberId: fresh.connection.phoneNumberId,
          scope,
        });
      } catch (error) {
        const responseError = await persistProviderFailure(error, {
          database: transaction,
          throwAfter: false,
        });
        return { responseError };
      }
      const wamid = providerMessageId(result);
      if (!wamid) {
        const missingId = new Error('Meta accepted the request without a message ID.');
        missingId.ambiguous = true;
        const responseError = await persistProviderFailure(missingId, {
          forceAmbiguous: true,
          database: transaction,
          throwAfter: false,
        });
        return { responseError };
      }

      const acceptedAt = nowDate(clock);
      claimed = await transaction.message.update({
        where: { id: claimed.id },
        data: {
          providerMessageId: wamid,
          status: 'accepted',
          metadata: manualMessageMetadata({
            access,
            identity,
            payloadDigest,
            extra: { acceptedAt: acceptedAt.toISOString() },
          }),
        },
      });
      await Promise.all([
        transaction.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: acceptedAt },
        }),
        transaction.auditLog.create({
          data: {
            organizationId: scope.organizationId,
            actorId: access.databaseUserId || null,
            action: 'whatsapp.inbox.message_sent',
            entityType: 'Message',
            entityId: claimed.id,
            metadata: {
              projectId: scope.projectId,
              conversationId: conversation.id,
              providerStatus: 'accepted',
            },
          },
        }),
      ]);
      return { message: claimed, window: fresh.window };
    }, {
      isolationLevel: 'ReadCommitted',
      maxWait: 5_000,
      timeout: 30_000,
    });
  } catch (error) {
    if (providerDispatchStarted) {
      error.code ||= 'LOCAL_CORRELATION_FAILED';
      return persistProviderFailure(error, { forceAmbiguous: true });
    }
    const failureCode = boundedText(error?.code || error?.name || 'DISPATCH_BLOCKED', 80);
    const blockedWrites = await Promise.allSettled([
      prisma.message.update({
        where: { id: claimed.id },
        data: {
          status: 'failed',
          metadata: manualMessageMetadata({
            access,
            identity,
            payloadDigest,
            extra: { failureCode, failedAt: nowDate(clock).toISOString() },
          }),
        },
      }),
      prisma.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: access.databaseUserId || null,
          action: 'whatsapp.inbox.dispatch_blocked',
          entityType: 'Message',
          entityId: claimed.id,
          metadata: {
            projectId: scope.projectId,
            conversationId: conversation.id,
            failureCode,
          },
        },
      }),
    ]);
    for (const write of blockedWrites) {
      if (write.status === 'rejected') {
        console.error('A blocked WhatsApp dispatch could not be persisted:', write.reason);
      }
    }
    throw manualSendFailure(error);
  }

  if (outcome.responseError) throw outcome.responseError;
  return {
    message: manualPublicMessage(outcome.message, { includeMedicalEvidence }),
    window: outcome.window,
    idempotent: false,
  };
}
