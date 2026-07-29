import crypto from 'node:crypto';

import { createAuditLog } from './audit-log.js';
import { generateWebviewToken, verifyWebviewToken } from './auth.js';
import {
  getDistanceMeters,
  MAX_REPORTED_LOCATION_ACCURACY_METERS,
  validateProjectGeofence,
} from './geo.js';
import { assertOrganizationSubscriptionAllowsWrites } from './plans.js';
import { resolveWhatsAppPublicAppUrl } from './whatsapp/public-app-url.js';

export const PROGRESS_EVIDENCE_CAPTURE_TOKEN_PURPOSE = 'progress-evidence-location';
export const PROGRESS_EVIDENCE_CAPTURE_SESSION_TTL_MS = 15 * 60 * 1_000;
export const PROGRESS_EVIDENCE_LOCATION_MAX_AGE_MS = 2 * 60 * 1_000;
export const PROGRESS_EVIDENCE_LOCATION_FUTURE_SKEW_MS = 60 * 1_000;
export const PROGRESS_EVIDENCE_LOCATION_MIN_ACCEPTED_ACCURACY_METERS = 0.01;
export const PROGRESS_EVIDENCE_LOCATION_MAX_ACCEPTED_ACCURACY_METERS = 10_000;
export const PROGRESS_EVIDENCE_LOCATION_NOTICE_VERSION = 'progress-evidence-location-v2';
export const PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT =
  'Para adjuntar esta lectura de ubicación a la foto de avance, ObraSaaS solicitará una única lectura puntual de geolocalización reportada por el dispositivo. Se usará para contrastar la lectura informada con la geocerca de la obra; no certifica presencia, identidad ni el sensor utilizado. No registra asistencia ni utiliza metadatos EXIF de la imagen. La lectura puede requerir revisión.';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export const PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256 = sha256(
  PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT,
);

export const PROGRESS_EVIDENCE_LOCATION_NOTICE = Object.freeze({
  version: PROGRESS_EVIDENCE_LOCATION_NOTICE_VERSION,
  content: PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT,
  contentSha256: PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256,
});

const ISSUE_FIELDS = new Set([
  'scope',
  'workerId',
  'mediaAssetId',
  'connectionId',
  'correlationId',
]);
const SCOPE_FIELDS = new Set(['organizationId', 'projectId']);
const CONTEXT_FIELDS = new Set(['workerId', 'sessionId', 'token']);
const CAPTURE_FIELDS = new Set([
  'workerId',
  'sessionId',
  'token',
  'idempotencyKey',
  'privacyAccepted',
  'noticeVersion',
  'noticeContentSha256',
  'latitude',
  'longitude',
  'accuracyMeters',
  'capturedAt',
  'correlationId',
]);
const CANCEL_FIELDS = new Set([
  'workerId',
  'sessionId',
  'token',
  'correlationId',
]);
const LINK_FIELDS = new Set(['session', 'token', 'publicAppUrl']);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const IMAGE_ASSET_STATUSES = new Set(['AVAILABLE', 'CLAIMED']);
const CAPTURED_STATUSES = new Set(['LOCATION_CAPTURED', 'CONSUMED']);
const MAX_GEOFENCE_RADIUS_METERS = 100_000;
const MAX_EARTH_SURFACE_DISTANCE_METERS = 20_050_000;

export class ProgressEvidenceCaptureSessionError extends Error {
  constructor(
    message,
    code = 'PROGRESS_EVIDENCE_CAPTURE_INVALID',
    status = 400,
    details = null,
  ) {
    super(message);
    this.name = 'ProgressEvidenceCaptureSessionError';
    this.code = code;
    this.status = status;
    this.details = details && typeof details === 'object' ? details : null;
  }
}

export function isProgressEvidenceCaptureSessionError(error) {
  return error instanceof ProgressEvidenceCaptureSessionError
    || (
      error?.name === 'ProgressEvidenceCaptureSessionError'
      && typeof error?.code === 'string'
      && Number.isSafeInteger(error?.status)
    );
}

function captureError(message, code, status = 400, details = null) {
  return new ProgressEvidenceCaptureSessionError(message, code, status, details);
}

function objectInput(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw captureError(
      `${field} no es valido.`,
      'PROGRESS_EVIDENCE_CAPTURE_INPUT_INVALID',
    );
  }
  return value;
}

function rejectUnknownFields(value, allowed, field) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw captureError(
      `${field} contiene campos no permitidos.`,
      'PROGRESS_EVIDENCE_CAPTURE_FIELDS_INVALID',
      400,
      { fields: unknown.sort() },
    );
  }
}

function identifier(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !normalized
    || normalized !== value
    || normalized.length > 190
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw captureError(
      `${field} no es valido.`,
      'PROGRESS_EVIDENCE_CAPTURE_INPUT_INVALID',
    );
  }
  return normalized;
}

function tokenValue(value) {
  if (
    typeof value !== 'string'
    || !value
    || value !== value.trim()
    || value.length > 4_096
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw captureError(
      'El token de captura no es valido.',
      'PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID',
      401,
    );
  }
  return value;
}

function normalizedScope(value) {
  const scope = objectInput(value, 'scope');
  rejectUnknownFields(scope, SCOPE_FIELDS, 'scope');
  return {
    organizationId: identifier(scope.organizationId, 'organizationId'),
    projectId: identifier(scope.projectId, 'projectId'),
  };
}

function normalizedCorrelationId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !SAFE_CORRELATION_ID_PATTERN.test(value)) {
    throw captureError(
      'correlationId no es valido.',
      'PROGRESS_EVIDENCE_CAPTURE_INPUT_INVALID',
    );
  }
  return value;
}

function normalizedIssueInput(rawInput) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, ISSUE_FIELDS, 'input');
  return {
    scope: normalizedScope(input.scope),
    workerId: identifier(input.workerId, 'workerId'),
    mediaAssetId: identifier(input.mediaAssetId, 'mediaAssetId'),
    connectionId: identifier(input.connectionId, 'connectionId'),
    correlationId: normalizedCorrelationId(input.correlationId),
  };
}

function normalizedContextInput(rawInput) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, CONTEXT_FIELDS, 'input');
  return {
    workerId: identifier(input.workerId, 'workerId'),
    sessionId: identifier(input.sessionId, 'sessionId'),
    token: tokenValue(input.token),
  };
}

function canonicalCapturedAt(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (
    !Number.isFinite(date.getTime())
    || (
      typeof value === 'string'
      && (value.length > 40 || date.toISOString() !== value)
    )
    || (typeof value !== 'string' && !(value instanceof Date))
  ) {
    throw captureError(
      'La hora de captura de la ubicacion no es valida.',
      'PROGRESS_EVIDENCE_LOCATION_CAPTURE_TIME_INVALID',
      422,
    );
  }
  return date;
}

function finiteNumber(value, field, minimum, maximum, { minimumExclusive = false } = {}) {
  const validMinimum = minimumExclusive ? value > minimum : value >= minimum;
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || !validMinimum
    || value > maximum
  ) {
    throw captureError(
      `La ubicacion contiene un ${field} no valido.`,
      'PROGRESS_EVIDENCE_LOCATION_INVALID',
      422,
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

function fixedNumber(value, decimalPlaces) {
  const factor = 10 ** decimalPlaces;
  const normalized = Math.round(value * factor) / factor;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function conservativeAccuracy(value) {
  return Math.ceil(value * 100) / 100;
}

function normalizedCaptureInput(rawInput) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, CAPTURE_FIELDS, 'input');
  const idempotencyKey = typeof input.idempotencyKey === 'string'
    ? input.idempotencyKey.trim()
    : '';
  if (idempotencyKey !== input.idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw captureError(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  if (input.privacyAccepted !== true) {
    throw captureError(
      'Debe aceptar el aviso de privacidad antes de compartir la ubicacion.',
      'PROGRESS_EVIDENCE_LOCATION_NOTICE_REQUIRED',
      400,
    );
  }
  const noticeVersion = identifier(input.noticeVersion, 'noticeVersion');
  const noticeContentSha256 = typeof input.noticeContentSha256 === 'string'
    ? input.noticeContentSha256.toLowerCase()
    : '';
  if (!SHA256_PATTERN.test(noticeContentSha256)) {
    throw captureError(
      'El aviso de privacidad no es valido.',
      'PROGRESS_EVIDENCE_LOCATION_NOTICE_MISMATCH',
      409,
    );
  }
  return {
    workerId: identifier(input.workerId, 'workerId'),
    sessionId: identifier(input.sessionId, 'sessionId'),
    token: tokenValue(input.token),
    idempotencyKey,
    privacyAccepted: true,
    noticeVersion,
    noticeContentSha256,
    latitude: fixedNumber(
      finiteNumber(input.latitude, 'latitude', -90, 90),
      7,
    ),
    longitude: fixedNumber(
      finiteNumber(input.longitude, 'longitude', -180, 180),
      7,
    ),
    accuracyMeters: conservativeAccuracy(finiteNumber(
      input.accuracyMeters,
      'accuracyMeters',
      PROGRESS_EVIDENCE_LOCATION_MIN_ACCEPTED_ACCURACY_METERS,
      PROGRESS_EVIDENCE_LOCATION_MAX_ACCEPTED_ACCURACY_METERS,
    )),
    capturedAt: canonicalCapturedAt(input.capturedAt),
    correlationId: normalizedCorrelationId(input.correlationId),
  };
}

function normalizedCancelInput(rawInput) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, CANCEL_FIELDS, 'input');
  return {
    workerId: identifier(input.workerId, 'workerId'),
    sessionId: identifier(input.sessionId, 'sessionId'),
    token: tokenValue(input.token),
    correlationId: normalizedCorrelationId(input.correlationId),
  };
}

function currentDate(deps = {}) {
  const configured = typeof deps.clock === 'function'
    ? deps.clock()
    : typeof deps.now === 'function'
      ? deps.now()
      : deps.now ?? Date.now();
  const date = configured instanceof Date ? new Date(configured.getTime()) : new Date(configured);
  if (!Number.isFinite(date.getTime())) {
    throw captureError(
      'El reloj del servicio no esta disponible.',
      'PROGRESS_EVIDENCE_CAPTURE_CONFIGURATION_INVALID',
      503,
    );
  }
  return date;
}

function assertPrisma(prisma) {
  if (
    !prisma
    || typeof prisma.progressEvidenceCaptureSession?.findFirst !== 'function'
    || typeof prisma.progressEvidenceCaptureSession?.create !== 'function'
    || typeof prisma.progressEvidenceCaptureSession?.updateMany !== 'function'
    || typeof prisma.organization?.findUnique !== 'function'
    || typeof prisma.project?.findFirst !== 'function'
    || typeof prisma.worker?.findFirst !== 'function'
    || typeof prisma.whatsAppConnection?.findFirst !== 'function'
    || typeof prisma.whatsAppMediaAsset?.findFirst !== 'function'
  ) {
    throw captureError(
      'El almacenamiento de capturas no esta disponible.',
      'PROGRESS_EVIDENCE_CAPTURE_CONFIGURATION_INVALID',
      503,
    );
  }
}

function canonicalValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value === undefined ? null : value;
}

function fingerprint(value) {
  return sha256(JSON.stringify(canonicalValue(value)));
}

function safeHashEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function generatedToken(workerId, sessionId, issuedAt, expiresAt, deps) {
  const ttlMilliseconds = expiresAt.getTime() - issuedAt.getTime();
  if (ttlMilliseconds <= 0 || ttlMilliseconds % 1_000 !== 0) {
    throw captureError(
      'La vigencia de la sesion no es valida.',
      'PROGRESS_EVIDENCE_CAPTURE_CONFIGURATION_INVALID',
      503,
    );
  }
  const generator = deps.generateWebviewToken ?? generateWebviewToken;
  try {
    return generator(workerId, {
      now: issuedAt.getTime(),
      ttlSeconds: ttlMilliseconds / 1_000,
      purpose: PROGRESS_EVIDENCE_CAPTURE_TOKEN_PURPOSE,
      scope: sessionId,
      ...(deps.webviewSecret ? { secret: deps.webviewSecret } : {}),
    });
  } catch (cause) {
    throw captureError(
      'No se pudo emitir el acceso protegido a la captura.',
      'PROGRESS_EVIDENCE_CAPTURE_CONFIGURATION_INVALID',
      503,
      { cause: cause?.message || 'token_generation_failed' },
    );
  }
}

function assertPinnedNotice(session) {
  if (
    session.privacyNoticeVersion !== PROGRESS_EVIDENCE_LOCATION_NOTICE_VERSION
    || session.privacyNoticeContentSha256
      !== PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256
  ) {
    throw captureError(
      'La politica de privacidad de esta sesion ya no esta disponible.',
      'PROGRESS_EVIDENCE_LOCATION_NOTICE_MISMATCH',
      409,
    );
  }
}

function assertNoticeSubmission(session, input) {
  assertPinnedNotice(session);
  if (
    input.noticeVersion !== session.privacyNoticeVersion
    || input.noticeContentSha256 !== session.privacyNoticeContentSha256
  ) {
    throw captureError(
      'El aviso aceptado no coincide con el aviso emitido.',
      'PROGRESS_EVIDENCE_LOCATION_NOTICE_MISMATCH',
      409,
    );
  }
}

async function requireSubscription(transaction, organizationId, now, deps) {
  const checker = deps.assertSubscription
    ?? deps.assertOrganizationSubscriptionAllowsWrites
    ?? assertOrganizationSubscriptionAllowsWrites;
  try {
    return await checker(transaction, organizationId, { now });
  } catch (error) {
    if (
      typeof error?.code === 'string'
      && error.code.startsWith('SUBSCRIPTION_')
      && Number.isSafeInteger(error?.status)
    ) {
      throw captureError(error.message, error.code, error.status);
    }
    throw error;
  }
}

async function requireBoundContext(transaction, session, now, deps) {
  await requireSubscription(transaction, session.organizationId, now, deps);
  const project = await transaction.project.findFirst({
    where: {
      id: session.projectId,
      organizationId: session.organizationId,
      status: { in: ['ACTIVE', 'PAUSED'] },
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      status: true,
      latitude: true,
      longitude: true,
      geofenceMeters: true,
    },
  });
  const worker = await transaction.worker.findFirst({
    where: {
      id: session.workerId,
      projectId: session.projectId,
      OR: [
        { organizationId: session.organizationId },
        { organizationId: null },
      ],
      active: true,
    },
    select: {
      id: true,
      projectId: true,
      organizationId: true,
      name: true,
      active: true,
    },
  });
  const connection = await transaction.whatsAppConnection.findFirst({
    where: {
      id: session.connectionId,
      projectId: session.projectId,
      enabled: true,
      connectionStatus: 'CONNECTED',
    },
    select: {
      id: true,
      projectId: true,
      enabled: true,
      connectionStatus: true,
    },
  });
  const mediaAsset = await transaction.whatsAppMediaAsset.findFirst({
    where: {
      id: session.mediaAssetId,
      organizationId: session.organizationId,
      projectId: session.projectId,
      mediaKind: 'IMAGE',
      status: { in: [...IMAGE_ASSET_STATUSES] },
    },
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      mediaKind: true,
      status: true,
    },
  });
  if (!project || !worker || !connection || !mediaAsset) {
    throw captureError(
      'La sesion ya no esta vinculada a un contexto operativo valido.',
      'PROGRESS_EVIDENCE_CAPTURE_CONTEXT_UNAVAILABLE',
      409,
    );
  }
  return { project, worker, connection, mediaAsset };
}

function decimalNumber(value) {
  if (value === null || value === undefined) return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function sessionDto(session, context) {
  return {
    id: session.id,
    status: session.status,
    workerId: session.workerId,
    mediaAssetId: session.mediaAssetId,
    worker: {
      id: context.worker.id,
      name: context.worker.name,
    },
    project: {
      id: context.project.id,
      name: context.project.name,
    },
    notice: { ...PROGRESS_EVIDENCE_LOCATION_NOTICE },
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    privacyAcceptedAt: session.privacyAcceptedAt ?? null,
    locationCapturedAt: session.locationCapturedAt ?? null,
    locationReceivedAt: session.locationReceivedAt ?? null,
    locationSource: session.locationSource ?? null,
    locationVerification: session.locationVerification ?? null,
    distanceMeters: decimalNumber(session.distanceMeters),
    geofenceRadiusMeters: decimalNumber(session.geofenceRadiusMeters),
    canCapture: session.status === 'AWAITING_LOCATION',
    canCancel: session.status === 'AWAITING_LOCATION',
  };
}

function assertIssueReplay(session, input) {
  const exact = session.organizationId === input.scope.organizationId
    && session.projectId === input.scope.projectId
    && session.workerId === input.workerId
    && session.mediaAssetId === input.mediaAssetId
    && session.connectionId === input.connectionId;
  if (!exact) {
    throw captureError(
      'La imagen ya esta vinculada a otra sesion de captura.',
      'PROGRESS_EVIDENCE_CAPTURE_IDEMPOTENCY_CONFLICT',
      409,
    );
  }
  assertPinnedNotice(session);
}

function replayToken(session, deps) {
  const token = generatedToken(
    session.workerId,
    session.id,
    new Date(session.issuedAt),
    new Date(session.expiresAt),
    deps,
  );
  if (!safeHashEqual(sha256(token), session.tokenHash)) {
    throw captureError(
      'No se pudo reconstruir el acceso protegido a la sesion.',
      'PROGRESS_EVIDENCE_CAPTURE_CONFIGURATION_INVALID',
      503,
    );
  }
  return token;
}

function isUniqueError(error) {
  return error?.code === 'P2002' || error?.code === '23505';
}

async function runSerializable(prisma, operation) {
  if (typeof prisma.$transaction !== 'function') return operation(prisma);
  return prisma.$transaction(operation, { isolationLevel: 'Serializable' });
}

async function loadIssueReplay(prisma, input, now, deps) {
  return runSerializable(prisma, async (transaction) => {
    const existing = await transaction.progressEvidenceCaptureSession.findFirst({
      where: {
        organizationId: input.scope.organizationId,
        projectId: input.scope.projectId,
        mediaAssetId: input.mediaAssetId,
      },
    });
    if (!existing) throw captureError(
      'La sesion concurrente no pudo recuperarse.',
      'PROGRESS_EVIDENCE_CAPTURE_CONFLICT',
      409,
    );
    assertIssueReplay(existing, input);
    const context = await requireBoundContext(transaction, existing, now, deps);
    return {
      session: sessionDto(existing, context),
      token: replayToken(existing, deps),
      replayed: true,
    };
  });
}

export async function issueProgressEvidenceCaptureSession(prisma, rawInput, deps = {}) {
  assertPrisma(prisma);
  const input = normalizedIssueInput(rawInput);
  const observedNow = currentDate(deps);
  const issuedAt = new Date(Math.floor(observedNow.getTime() / 1_000) * 1_000);
  const expiresAt = new Date(issuedAt.getTime() + PROGRESS_EVIDENCE_CAPTURE_SESSION_TTL_MS);
  const idFactory = deps.idFactory ?? crypto.randomUUID;
  if (typeof idFactory !== 'function') {
    throw captureError(
      'El generador de sesiones no esta disponible.',
      'PROGRESS_EVIDENCE_CAPTURE_CONFIGURATION_INVALID',
      503,
    );
  }
  const candidateId = identifier(idFactory(), 'sessionId');
  const candidateToken = generatedToken(
    input.workerId,
    candidateId,
    issuedAt,
    expiresAt,
    deps,
  );

  try {
    return await runSerializable(prisma, async (transaction) => {
      const existing = await transaction.progressEvidenceCaptureSession.findFirst({
        where: {
          organizationId: input.scope.organizationId,
          projectId: input.scope.projectId,
          mediaAssetId: input.mediaAssetId,
        },
      });
      if (existing) {
        assertIssueReplay(existing, input);
        const context = await requireBoundContext(transaction, existing, observedNow, deps);
        return {
          session: sessionDto(existing, context),
          token: replayToken(existing, deps),
          replayed: true,
        };
      }

      const provisional = {
        organizationId: input.scope.organizationId,
        projectId: input.scope.projectId,
        workerId: input.workerId,
        mediaAssetId: input.mediaAssetId,
        connectionId: input.connectionId,
      };
      const context = await requireBoundContext(transaction, provisional, observedNow, deps);
      const created = await transaction.progressEvidenceCaptureSession.create({
        data: {
          id: candidateId,
          ...provisional,
          status: 'AWAITING_LOCATION',
          revision: 0,
          tokenHash: sha256(candidateToken),
          privacyNoticeVersion: PROGRESS_EVIDENCE_LOCATION_NOTICE_VERSION,
          privacyNoticeContentSha256: PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256,
          privacyAcceptedAt: null,
          issuedAt,
          expiresAt,
          locationCapturedAt: null,
          locationReceivedAt: null,
          latitude: null,
          longitude: null,
          accuracyMeters: null,
          locationSource: null,
          locationVerification: null,
          distanceMeters: null,
          geofenceRadiusMeters: null,
          operationKeyHash: null,
          requestFingerprint: null,
        },
      });
      return {
        session: sessionDto(created, context),
        token: candidateToken,
        replayed: false,
      };
    });
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    // An interactive TransactionClient is already aborted after a unique
    // violation. Its caller owns the transaction/retry boundary.
    if (typeof prisma.$transaction !== 'function') throw error;
    return loadIssueReplay(prisma, input, observedNow, deps);
  }
}

function hostedEnvironment(environment) {
  const vercelEnvironment = String(environment?.VERCEL_ENV || '').toLowerCase();
  return Boolean(environment?.VERCEL)
    || environment?.NODE_ENV === 'production'
    || vercelEnvironment === 'production'
    || vercelEnvironment === 'preview';
}

function strictPublicOrigin(value, environment) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    throw captureError(
      'La URL publica para la captura no es valida.',
      'PROGRESS_EVIDENCE_LINK_CONFIGURATION_INVALID',
      503,
    );
  }
  const localHostname = ['localhost', '127.0.0.1', '[::1]'].includes(
    parsed.hostname.toLowerCase(),
  );
  const secureProtocol = parsed.protocol === 'https:';
  const permittedLocalHttp = parsed.protocol === 'http:'
    && localHostname
    && !hostedEnvironment(environment);
  if (
    (!secureProtocol && !permittedLocalHttp)
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) {
    throw captureError(
      'La URL publica para la captura debe ser un origen estable.',
      'PROGRESS_EVIDENCE_LINK_CONFIGURATION_INVALID',
      503,
    );
  }
  return parsed.toString().replace(/\/$/, '');
}

export function buildProgressEvidenceLocationLink(
  rawInput,
  environment = process.env,
  deps = {},
) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, LINK_FIELDS, 'input');
  const session = objectInput(input.session, 'session');
  const sessionId = identifier(session.id, 'sessionId');
  const workerId = identifier(session.workerId ?? session.worker?.id, 'workerId');
  const token = tokenValue(input.token);
  const resolver = deps.resolveWhatsAppPublicAppUrl ?? resolveWhatsAppPublicAppUrl;
  let publicAppUrl;
  try {
    publicAppUrl = input.publicAppUrl === undefined
      ? resolver(environment)
      : input.publicAppUrl;
  } catch (error) {
    if (isProgressEvidenceCaptureSessionError(error)) throw error;
    throw captureError(
      'La URL publica para la captura no esta configurada.',
      'PROGRESS_EVIDENCE_LINK_CONFIGURATION_INVALID',
      503,
    );
  }
  const url = new URL(
    '/webview/progress-evidence-location',
    strictPublicOrigin(publicAppUrl, environment),
  );
  url.searchParams.set('worker', workerId);
  url.searchParams.set('session', sessionId);
  // URL fragments are handled only by the browser and are never part of the
  // HTTP request target, server logs, referrer, or Server Component props.
  url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}

function assertStoredTokenHash(session, input) {
  if (!safeHashEqual(sha256(input.token), session.tokenHash)) {
    throw captureError(
      'El token no autoriza esta sesion.',
      'PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID',
      401,
    );
  }
}

function assertLiveTokenSignature(session, input, now, deps) {
  const verifier = deps.verifyWebviewToken ?? verifyWebviewToken;
  let verified = false;
  try {
    verified = verifier(input.workerId, input.token, {
      now: now.getTime(),
      purpose: PROGRESS_EVIDENCE_CAPTURE_TOKEN_PURPOSE,
      scope: session.id,
      ...(deps.webviewSecret ? { secret: deps.webviewSecret } : {}),
    });
  } catch (cause) {
    throw captureError(
      'No se pudo verificar el acceso protegido.',
      'PROGRESS_EVIDENCE_CAPTURE_CONFIGURATION_INVALID',
      503,
      { cause: cause?.message || 'token_verification_failed' },
    );
  }
  if (!verified) {
    throw captureError(
      'El token no autoriza esta sesion.',
      'PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID',
      401,
    );
  }
}

export function assertProgressEvidenceCaptureTokenSignature(rawInput, deps = {}) {
  const input = normalizedContextInput(rawInput);
  // Epoch verification validates signature, subject, purpose and session scope
  // without applying the current TTL. The transactional service remains the
  // authority for live expiry and permits only exact terminal replays later.
  assertLiveTokenSignature({ id: input.sessionId }, input, new Date(0), deps);
  return true;
}

function assertStoredToken(session, input, now, deps) {
  assertStoredTokenHash(session, input);
  assertLiveTokenSignature(session, input, now, deps);
  assertPinnedNotice(session);
}

function sessionExpired(session, now) {
  return session.status === 'EXPIRED'
    || (
      session.status === 'AWAITING_LOCATION'
      && now.getTime() >= new Date(session.expiresAt).getTime()
    );
}

function expiredSessionError() {
  return captureError(
    'La sesion de ubicacion vencio.',
    'PROGRESS_EVIDENCE_CAPTURE_SESSION_EXPIRED',
    410,
  );
}

async function expireAwaitingSession(transaction, session, now) {
  if (session.status !== 'AWAITING_LOCATION') return;
  await transaction.progressEvidenceCaptureSession.updateMany({
    where: {
      id: session.id,
      workerId: session.workerId,
      status: 'AWAITING_LOCATION',
      expiresAt: { lte: now },
    },
    data: {
      status: 'EXPIRED',
      expiredAt: now,
      revision: { increment: 1 },
    },
  });
}

function assertContextState(session) {
  if (session.status === 'CONSUMED') {
    throw captureError(
      'La sesion de ubicacion ya no esta disponible.',
      'PROGRESS_EVIDENCE_CAPTURE_SESSION_UNAVAILABLE',
      410,
    );
  }
  if (!['AWAITING_LOCATION', 'LOCATION_CAPTURED', 'CANCELLED'].includes(session.status)) {
    throw captureError(
      'El estado de la sesion no permite esta operacion.',
      'PROGRESS_EVIDENCE_CAPTURE_STATE_CONFLICT',
      409,
    );
  }
}

async function findWorkerSession(transaction, input) {
  const session = await transaction.progressEvidenceCaptureSession.findFirst({
    where: {
      id: input.sessionId,
      workerId: input.workerId,
    },
  });
  if (!session) {
    throw captureError(
      'La sesion de ubicacion no existe.',
      'PROGRESS_EVIDENCE_CAPTURE_SESSION_NOT_FOUND',
      404,
    );
  }
  return session;
}

export async function getProgressEvidenceCaptureContext(prisma, rawInput, deps = {}) {
  assertPrisma(prisma);
  const input = normalizedContextInput(rawInput);
  const now = currentDate(deps);
  const outcome = await runSerializable(prisma, async (transaction) => {
    const session = await findWorkerSession(transaction, input);
    if (sessionExpired(session, now)) {
      if (!safeHashEqual(sha256(input.token), session.tokenHash)) {
        throw captureError(
          'El token no autoriza esta sesion.',
          'PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID',
          401,
        );
      }
      await expireAwaitingSession(transaction, session, now);
      return { expired: true };
    }
    assertStoredToken(session, input, now, deps);
    assertContextState(session);
    const context = await requireBoundContext(transaction, session, now, deps);
    return { session: sessionDto(session, context) };
  });
  if (outcome?.expired) throw expiredSessionError();
  return outcome;
}

function assertFreshLocation(input, now) {
  const ageMilliseconds = now.getTime() - input.capturedAt.getTime();
  if (
    ageMilliseconds > PROGRESS_EVIDENCE_LOCATION_MAX_AGE_MS
    || ageMilliseconds < -PROGRESS_EVIDENCE_LOCATION_FUTURE_SKEW_MS
  ) {
    throw captureError(
      'La lectura de ubicacion no es reciente.',
      'PROGRESS_EVIDENCE_LOCATION_STALE',
      422,
    );
  }
}

function operationKeyHash(session, input) {
  return fingerprint({
    action: 'capture-progress-evidence-location',
    organizationId: session.organizationId,
    projectId: session.projectId,
    workerId: session.workerId,
    sessionId: session.id,
    idempotencyKey: input.idempotencyKey,
  });
}

function captureRequestFingerprint(session, input, privacyAcceptedAt) {
  return fingerprint({
    action: 'capture-progress-evidence-location',
    organizationId: session.organizationId,
    projectId: session.projectId,
    workerId: session.workerId,
    sessionId: session.id,
    mediaAssetId: session.mediaAssetId,
    privacyAccepted: true,
    privacyAcceptedAt,
    noticeVersion: input.noticeVersion,
    noticeContentSha256: input.noticeContentSha256,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters,
    capturedAt: input.capturedAt,
  });
}

function exactCaptureReplay(session, input, expectedOperationKeyHash) {
  if (!CAPTURED_STATUSES.has(session.status)) return null;
  if (
    !session.operationKeyHash
    || !session.requestFingerprint
    || !session.privacyAcceptedAt
    || !session.locationCapturedAt
    || !session.locationReceivedAt
    || session.locationSource !== 'WEBVIEW_GEOLOCATION'
    || !['IN_GEOFENCE', 'REVIEW_REQUIRED'].includes(session.locationVerification)
  ) {
    throw captureError(
      'La sesion capturada tiene un estado incompleto.',
      'PROGRESS_EVIDENCE_CAPTURE_STATE_CONFLICT',
      409,
    );
  }
  if (session.operationKeyHash !== expectedOperationKeyHash) {
    throw captureError(
      'La sesion ya fue capturada con otra operacion.',
      'PROGRESS_EVIDENCE_CAPTURE_STATE_CONFLICT',
      409,
    );
  }
  const expectedFingerprint = captureRequestFingerprint(
    session,
    input,
    new Date(session.privacyAcceptedAt),
  );
  if (session.requestFingerprint !== expectedFingerprint) {
    throw captureError(
      'La Idempotency-Key ya fue usada con otra lectura.',
      'IDEMPOTENCY_KEY_CONFLICT',
      409,
    );
  }
  return session;
}

function exactCancellationReplay(session) {
  if (session.status !== 'CANCELLED') return null;
  if (
    !session.cancelledAt
    || session.privacyAcceptedAt != null
    || session.locationCapturedAt != null
    || session.locationReceivedAt != null
    || session.latitude != null
    || session.longitude != null
    || session.accuracyMeters != null
    || session.locationSource != null
    || session.locationVerification != null
    || session.distanceMeters != null
    || session.geofenceRadiusMeters != null
    || session.operationKeyHash != null
    || session.requestFingerprint != null
    || session.consumedAt != null
    || session.expiredAt != null
  ) {
    throw captureError(
      'La cancelacion de ubicacion tiene un estado incompleto.',
      'PROGRESS_EVIDENCE_CAPTURE_STATE_CONFLICT',
      409,
    );
  }
  return session;
}

function conservativeDistanceMeters(value) {
  return Number.isFinite(value) ? Math.ceil(value * 100) / 100 : null;
}

function serverGeofenceDecision(project, input, deps) {
  const geofence = validateProjectGeofence({
    latitude: project.latitude,
    longitude: project.longitude,
    geofenceMeters: project.geofenceMeters,
  });
  if (!geofence.valid || geofence.geofenceMeters > MAX_GEOFENCE_RADIUS_METERS) {
    return {
      locationVerification: 'REVIEW_REQUIRED',
      distanceMeters: null,
      geofenceRadiusMeters: null,
    };
  }
  const distanceCalculator = deps.getDistanceMeters ?? getDistanceMeters;
  const distance = Number(distanceCalculator(
    geofence.latitude,
    geofence.longitude,
    input.latitude,
    input.longitude,
  ));
  const validDistance = Number.isFinite(distance)
    && distance >= 0
    && distance <= MAX_EARTH_SURFACE_DISTANCE_METERS;
  if (!validDistance) {
    return {
      locationVerification: 'REVIEW_REQUIRED',
      distanceMeters: null,
      geofenceRadiusMeters: null,
    };
  }
  const storedDistance = conservativeDistanceMeters(distance);
  const autoVerified = validDistance
    && input.accuracyMeters <= MAX_REPORTED_LOCATION_ACCURACY_METERS
    && storedDistance + input.accuracyMeters <= geofence.geofenceMeters;
  return {
    locationVerification: autoVerified ? 'IN_GEOFENCE' : 'REVIEW_REQUIRED',
    distanceMeters: storedDistance,
    geofenceRadiusMeters: geofence.geofenceMeters,
  };
}

async function captureAudit(transaction, session, correlationId) {
  return createAuditLog(transaction, {
    organizationId: session.organizationId,
    actorId: null,
    action: 'progress_evidence.capture_location.recorded',
    entityType: 'ProgressEvidenceCaptureSession',
    entityId: session.id,
    correlationId,
    metadata: {
      projectId: session.projectId,
      workerId: session.workerId,
      mediaAssetId: session.mediaAssetId,
      connectionId: session.connectionId,
      status: session.status,
      locationSource: session.locationSource,
      locationVerification: session.locationVerification,
      noticeVersion: session.privacyNoticeVersion,
      operationKeyHash: session.operationKeyHash,
    },
  });
}

async function cancellationAudit(transaction, session, correlationId) {
  return createAuditLog(transaction, {
    organizationId: session.organizationId,
    actorId: null,
    action: 'progress_evidence.capture_location.cancelled',
    entityType: 'ProgressEvidenceCaptureSession',
    entityId: session.id,
    correlationId,
    metadata: {
      projectId: session.projectId,
      workerId: session.workerId,
      mediaAssetId: session.mediaAssetId,
      connectionId: session.connectionId,
      status: session.status,
      noticeVersion: session.privacyNoticeVersion,
    },
  });
}

export async function cancelProgressEvidenceLocation(prisma, rawInput, deps = {}) {
  assertPrisma(prisma);
  const input = normalizedCancelInput(rawInput);
  const now = currentDate(deps);

  const outcome = await runSerializable(prisma, async (transaction) => {
    const session = await findWorkerSession(transaction, input);
    assertStoredTokenHash(session, input);
    assertPinnedNotice(session);

    const replay = exactCancellationReplay(session);
    if (replay) {
      const context = await requireBoundContext(transaction, replay, now, deps);
      return { session: sessionDto(replay, context), replayed: true };
    }

    if (sessionExpired(session, now)) {
      await expireAwaitingSession(transaction, session, now);
      return { expired: true };
    }

    assertLiveTokenSignature(session, input, now, deps);
    const context = await requireBoundContext(transaction, session, now, deps);
    if (session.status !== 'AWAITING_LOCATION') {
      throw captureError(
        'El estado de la sesion no permite continuar sin ubicacion.',
        'PROGRESS_EVIDENCE_CAPTURE_STATE_CONFLICT',
        409,
      );
    }

    const result = await transaction.progressEvidenceCaptureSession.updateMany({
      where: {
        id: session.id,
        organizationId: session.organizationId,
        projectId: session.projectId,
        workerId: session.workerId,
        status: 'AWAITING_LOCATION',
        revision: session.revision,
        tokenHash: session.tokenHash,
        operationKeyHash: null,
        requestFingerprint: null,
        expiresAt: { gt: now },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        revision: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      const raced = await findWorkerSession(transaction, input);
      const racedReplay = exactCancellationReplay(raced);
      if (racedReplay) {
        return { session: sessionDto(racedReplay, context), replayed: true };
      }
      throw captureError(
        'La sesion cambio mientras se guardaba la decision.',
        'PROGRESS_EVIDENCE_CAPTURE_CAS_CONFLICT',
        409,
      );
    }

    const cancelled = await findWorkerSession(transaction, input);
    if (!exactCancellationReplay(cancelled)) {
      throw captureError(
        'No se pudo confirmar la cancelacion guardada.',
        'PROGRESS_EVIDENCE_CAPTURE_CAS_CONFLICT',
        409,
      );
    }
    await cancellationAudit(transaction, cancelled, input.correlationId);
    return { session: sessionDto(cancelled, context), replayed: false };
  });
  if (outcome?.expired) throw expiredSessionError();
  return outcome;
}

export async function captureProgressEvidenceLocation(prisma, rawInput, deps = {}) {
  assertPrisma(prisma);
  const input = normalizedCaptureInput(rawInput);
  const now = currentDate(deps);

  const outcome = await runSerializable(prisma, async (transaction) => {
    const session = await findWorkerSession(transaction, input);
    if (sessionExpired(session, now)) {
      if (!safeHashEqual(sha256(input.token), session.tokenHash)) {
        throw captureError(
          'El token no autoriza esta sesion.',
          'PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID',
          401,
        );
      }
      await expireAwaitingSession(transaction, session, now);
      return { expired: true };
    }
    assertStoredTokenHash(session, input);
    assertPinnedNotice(session);
    assertNoticeSubmission(session, input);
    const context = await requireBoundContext(transaction, session, now, deps);
    const expectedOperationKeyHash = operationKeyHash(session, input);
    const replay = exactCaptureReplay(session, input, expectedOperationKeyHash);
    if (replay) return { session: sessionDto(replay, context), replayed: true };
    assertLiveTokenSignature(session, input, now, deps);
    assertFreshLocation(input, now);
    if (session.status !== 'AWAITING_LOCATION') {
      throw captureError(
        'El estado de la sesion no permite capturar una ubicacion.',
        'PROGRESS_EVIDENCE_CAPTURE_STATE_CONFLICT',
        409,
      );
    }

    const privacyAcceptedAt = now;
    const requestFingerprint = captureRequestFingerprint(
      session,
      input,
      privacyAcceptedAt,
    );
    const geofence = serverGeofenceDecision(context.project, input, deps);
    const result = await transaction.progressEvidenceCaptureSession.updateMany({
      where: {
        id: session.id,
        organizationId: session.organizationId,
        projectId: session.projectId,
        workerId: session.workerId,
        status: 'AWAITING_LOCATION',
        tokenHash: session.tokenHash,
        operationKeyHash: null,
        requestFingerprint: null,
        expiresAt: { gt: now },
      },
      data: {
        status: 'LOCATION_CAPTURED',
        revision: { increment: 1 },
        privacyAcceptedAt,
        locationCapturedAt: input.capturedAt,
        locationReceivedAt: now,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters,
        locationSource: 'WEBVIEW_GEOLOCATION',
        locationVerification: geofence.locationVerification,
        distanceMeters: geofence.distanceMeters,
        geofenceRadiusMeters: geofence.geofenceRadiusMeters,
        operationKeyHash: expectedOperationKeyHash,
        requestFingerprint,
      },
    });
    if (result.count !== 1) {
      const raced = await findWorkerSession(transaction, input);
      const racedReplay = exactCaptureReplay(raced, input, expectedOperationKeyHash);
      if (racedReplay) {
        return { session: sessionDto(racedReplay, context), replayed: true };
      }
      throw captureError(
        'La sesion cambio mientras se guardaba la ubicacion.',
        'PROGRESS_EVIDENCE_CAPTURE_CAS_CONFLICT',
        409,
      );
    }
    const captured = await findWorkerSession(transaction, input);
    if (!exactCaptureReplay(captured, input, expectedOperationKeyHash)) {
      throw captureError(
        'No se pudo confirmar la captura guardada.',
        'PROGRESS_EVIDENCE_CAPTURE_CAS_CONFLICT',
        409,
      );
    }
    await captureAudit(transaction, captured, input.correlationId);
    return { session: sessionDto(captured, context), replayed: false };
  });
  if (outcome?.expired) throw expiredSessionError();
  return outcome;
}
