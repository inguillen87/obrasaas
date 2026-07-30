import crypto from 'node:crypto';

import {
  discoverWorkerPersonData,
  PRIVACY_DISCOVERY_CATALOG_SHA256,
  PRIVACY_DISCOVERY_CATALOG_VERSION,
  privacyOperationKeyHash,
  privacyRequestFingerprint,
  privacyAdminAttestationEvidenceSha256,
  validatePrivacyDiscoveryKeyConfig,
} from './privacy-discovery.js';

export const DATA_SUBJECT_REQUEST_MAX_BODY_BYTES = 8 * 1024;
export const DATA_SUBJECT_ATTESTATION_METHOD = 'AUTHENTICATED_TENANT_ADMIN_ATTESTATION';
export const DATA_SUBJECT_ATTESTATION_POLICY_VERSION = 'tenant-admin-privacy-intake-v1';
export const DATA_SUBJECT_REQUEST_RATE_LIMITS = Object.freeze({
  actorPerHour: 20,
  organizationPerHour: 100,
});
const DATA_SUBJECT_REQUEST_LOCK_TIMEOUT_MS = 3_000;
const DATA_SUBJECT_REQUEST_LOCK_RETRY_AFTER_SECONDS = 3;

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/;
const REQUEST_TYPES = new Set([
  'ACCESS',
  'CORRECTION',
  'ERASURE',
  'RESTRICTION',
  'PORTABILITY',
  'OBJECTION',
]);
const INPUT_FIELDS = new Set(['personId', 'requestType']);
const TERMINAL_STATUSES = new Set([
  'DISCOVERED',
  'DISCOVERY_BLOCKED',
  'DISCOVERY_FAILED',
  'REJECTED',
  'CANCELLED',
]);

export class DataSubjectRequestError extends Error {
  constructor(message, code = 'PRIVACY_REQUEST_FAILED', status = 500, details = {}) {
    super(message);
    this.name = 'DataSubjectRequestError';
    this.code = code;
    this.status = status;
    this.requestId = details.requestId || null;
    this.retryAfterSeconds = Number.isSafeInteger(details.retryAfterSeconds)
      ? details.retryAfterSeconds
      : null;
  }
}

function requestError(message, code, status, details) {
  return new DataSubjectRequestError(message, code, status, details);
}

function exactObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function normalizeDataSubjectRequestInput(value) {
  if (!exactObject(value)) {
    throw requestError(
      'El cuerpo debe ser un objeto JSON.',
      'PRIVACY_REQUEST_INVALID',
      400,
    );
  }
  const unknown = Object.keys(value).filter((key) => !INPUT_FIELDS.has(key));
  if (unknown.length > 0) {
    throw requestError(
      'La solicitud contiene campos no permitidos.',
      'PRIVACY_UNKNOWN_FIELDS',
      400,
    );
  }
  const personId = typeof value.personId === 'string' ? value.personId.trim() : '';
  const requestType = typeof value.requestType === 'string'
    ? value.requestType.trim().toUpperCase()
    : '';
  if (!IDENTIFIER_PATTERN.test(personId) || !REQUEST_TYPES.has(requestType)) {
    throw requestError(
      'personId o requestType no es válido.',
      'PRIVACY_REQUEST_INVALID',
      400,
    );
  }
  return { personId, requestType };
}

export function requireDataSubjectIdempotencyKey(request) {
  const value = String(request?.headers?.get?.('idempotency-key') || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw requestError(
      'Enviá un encabezado Idempotency-Key válido de entre 8 y 128 caracteres.',
      'PRIVACY_IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  return value;
}

function normalizeScope(scope) {
  const organizationId = typeof scope?.organizationId === 'string'
    ? scope.organizationId.trim()
    : '';
  const actorMembershipId = typeof scope?.actorMembershipId === 'string'
    ? scope.actorMembershipId.trim()
    : '';
  if (!organizationId || !actorMembershipId) {
    throw requestError(
      'La operación requiere una membresía administradora activa en el tenant.',
      'TENANT_MEMBERSHIP_REQUIRED',
      403,
    );
  }
  return { organizationId, actorMembershipId };
}

function isRetryableTransactionError(error) {
  return error?.code === 'P2034' || error?.code === '40001' || error?.code === '40P01';
}

function isUniqueConflict(error) {
  return error?.code === 'P2002' || error?.code === '23505';
}

function isPostgresLockTimeout(error) {
  return [
    error?.code,
    error?.sqlState,
    error?.sqlstate,
    error?.cause?.code,
    error?.cause?.originalCode,
    error?.meta?.code,
    error?.meta?.driverAdapterError?.cause?.code,
    error?.meta?.driverAdapterError?.cause?.originalCode,
  ].includes('55P03');
}

async function serializable(prisma, operation, attempts = 3) {
  if (typeof prisma?.$transaction !== 'function') {
    throw requestError(
      'La persistencia de solicitudes de privacidad no está disponible.',
      'PRIVACY_DISCOVERY_UNAVAILABLE',
      503,
    );
  }
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: 'Serializable',
        maxWait: 5_000,
        timeout: 20_000,
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === attempts - 1) throw error;
    }
  }
  throw lastError;
}

async function requireAdminAndSubject(transaction, scope, personId) {
  if (
    typeof transaction?.tenantMembership?.findFirst !== 'function'
    || typeof transaction?.workerPerson?.findFirst !== 'function'
  ) {
    throw requestError(
      'La persistencia de solicitudes de privacidad no está disponible.',
      'PRIVACY_DISCOVERY_UNAVAILABLE',
      503,
    );
  }
  const [actor, person] = await Promise.all([
    transaction.tenantMembership.findFirst({
      where: {
        id: scope.actorMembershipId,
        organizationId: scope.organizationId,
        status: 'ACTIVE',
        tenantRole: 'ADMIN',
      },
      select: { id: true, organizationId: true, userId: true, tenantRole: true, status: true },
    }),
    transaction.workerPerson.findFirst({
      where: { id: personId, organizationId: scope.organizationId },
      select: { id: true, organizationId: true },
    }),
  ]);
  if (!actor) {
    throw requestError(
      'La operación requiere una membresía administradora activa en el tenant.',
      'PRIVACY_ACTOR_FORBIDDEN',
      403,
    );
  }
  if (!person) {
    throw requestError(
      'No se encontró el sujeto dentro de la organización activa.',
      'PRIVACY_SUBJECT_NOT_FOUND',
      404,
    );
  }
  return { actor, person };
}

async function loadExistingByOperation(transaction, organizationId, operationKeyHash) {
  if (typeof transaction?.dataSubjectRequest?.findFirst !== 'function') {
    throw requestError(
      'La persistencia de solicitudes de privacidad no está disponible.',
      'PRIVACY_DISCOVERY_UNAVAILABLE',
      503,
    );
  }
  return transaction.dataSubjectRequest.findFirst({
    where: { organizationId, operationKeyHash },
    select: {
      id: true,
      organizationId: true,
      type: true,
      subjectKind: true,
      workerPersonId: true,
      status: true,
      operationKeyHash: true,
      requestFingerprint: true,
      receivedByMembershipId: true,
      discoveryCatalogVersion: true,
      discoveryCatalogSha256: true,
      receivedAt: true,
      attestedAt: true,
      discoveryStartedAt: true,
      terminalAt: true,
      terminalReasonCode: true,
      revision: true,
    },
  });
}

async function reserveDataSubjectRequestRateLimit(transaction, scope) {
  if (
    typeof transaction?.$executeRawUnsafe !== 'function'
    || typeof transaction?.$queryRawUnsafe !== 'function'
    || typeof transaction?.dataSubjectRequest?.count !== 'function'
  ) {
    throw requestError(
      'El control durable de solicitudes de privacidad no está disponible.',
      'PRIVACY_RATE_LIMIT_UNAVAILABLE',
      503,
    );
  }
  try {
    await transaction.$executeRawUnsafe(
      `SET LOCAL lock_timeout = '${DATA_SUBJECT_REQUEST_LOCK_TIMEOUT_MS}ms'`,
    );
    await transaction.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      `obrasaas:privacy-request-rate:${scope.organizationId}`,
    );
  } catch (error) {
    if (!isPostgresLockTimeout(error)) throw error;
    throw requestError(
      'La admisión de solicitudes de privacidad está ocupada temporalmente. Reintentá en unos segundos con la misma clave de idempotencia.',
      'PRIVACY_REQUEST_TEMPORARILY_UNAVAILABLE',
      503,
      { retryAfterSeconds: DATA_SUBJECT_REQUEST_LOCK_RETRY_AFTER_SECONDS },
    );
  }
  const clockRows = await transaction.$queryRawUnsafe(
    'SELECT statement_timestamp() AS "observedAt"',
  );
  const observedAt = new Date(clockRows?.[0]?.observedAt);
  if (Number.isNaN(observedAt.getTime())) {
    throw requestError(
      'El reloj durable de solicitudes de privacidad no está disponible.',
      'PRIVACY_RATE_LIMIT_UNAVAILABLE',
      503,
    );
  }
  const since = new Date(observedAt.getTime() - 60 * 60 * 1_000);
  const baseWhere = {
    organizationId: scope.organizationId,
    receivedAt: { gte: since },
  };
  const [actorCount, organizationCount] = await Promise.all([
    transaction.dataSubjectRequest.count({
      where: { ...baseWhere, receivedByMembershipId: scope.actorMembershipId },
    }),
    transaction.dataSubjectRequest.count({ where: baseWhere }),
  ]);
  if (
    Number(actorCount) >= DATA_SUBJECT_REQUEST_RATE_LIMITS.actorPerHour
    || Number(organizationCount) >= DATA_SUBJECT_REQUEST_RATE_LIMITS.organizationPerHour
  ) {
    throw requestError(
      'Se alcanzó el límite seguro de nuevas solicitudes de privacidad. Reintentá más tarde con la misma clave si ya habías iniciado el caso.',
      'PRIVACY_REQUEST_RATE_LIMIT',
      429,
      { retryAfterSeconds: 60 * 60 },
    );
  }
}

async function prepareRequest(
  prisma,
  { scope, input, operationKeyHash, requestFingerprint },
) {
  const createId = crypto.randomUUID();
  try {
    return await serializable(prisma, async (transaction) => {
      await requireAdminAndSubject(transaction, scope, input.personId);
      let row = await loadExistingByOperation(
        transaction,
        scope.organizationId,
        operationKeyHash,
      );
      let replayed = Boolean(row);
      if (row && row.requestFingerprint !== requestFingerprint) {
        throw requestError(
          'La clave de idempotencia ya fue usada con otro contenido.',
          'PRIVACY_IDEMPOTENCY_PAYLOAD_MISMATCH',
          409,
        );
      }
      if (!row) {
        await reserveDataSubjectRequestRateLimit(transaction, scope);
        if (typeof transaction?.dataSubjectRequest?.create !== 'function') {
          throw requestError(
            'La persistencia de solicitudes de privacidad no está disponible.',
            'PRIVACY_DISCOVERY_UNAVAILABLE',
            503,
          );
        }
        row = await transaction.dataSubjectRequest.create({
          data: {
            id: createId,
            organizationId: scope.organizationId,
            type: input.requestType,
            subjectKind: 'WORKER_PERSON',
            workerPersonId: input.personId,
            operationKeyHash,
            requestFingerprint,
            receivedByMembershipId: scope.actorMembershipId,
          },
        });
        replayed = false;
      }

      if (TERMINAL_STATUSES.has(row.status) || row.status === 'DISCOVERING') {
        return { row, replayed };
      }
      if (typeof transaction?.dataSubjectRequest?.update !== 'function') {
        throw requestError(
          'La persistencia de solicitudes de privacidad no está disponible.',
          'PRIVACY_DISCOVERY_UNAVAILABLE',
          503,
        );
      }
      if (row.status === 'RECEIVED') {
        row = await transaction.dataSubjectRequest.update({
          where: { id: row.id },
          data: {
            status: 'AUTHORITY_ATTESTED',
            attestedByMembershipId: scope.actorMembershipId,
            attestationPolicyVersion: DATA_SUBJECT_ATTESTATION_POLICY_VERSION,
            attestationMethod: DATA_SUBJECT_ATTESTATION_METHOD,
            attestationEvidenceSha256: privacyAdminAttestationEvidenceSha256({
              organizationId: scope.organizationId,
              requestId: row.id,
              personId: input.personId,
              requestType: input.requestType,
              actorMembershipId: scope.actorMembershipId,
            }),
            discoveryCatalogVersion: PRIVACY_DISCOVERY_CATALOG_VERSION,
            discoveryCatalogSha256: PRIVACY_DISCOVERY_CATALOG_SHA256,
            revision: { increment: 1 },
          },
        });
      }
      if (row.status === 'AUTHORITY_ATTESTED') {
        row = await transaction.dataSubjectRequest.update({
          where: { id: row.id },
          data: { status: 'DISCOVERING', revision: { increment: 1 } },
        });
      }
      if (row.status !== 'DISCOVERING') {
        throw requestError(
          'La solicitud de privacidad quedó en un estado no reconocido.',
          'PRIVACY_REQUEST_STATE_CONFLICT',
          409,
          { requestId: row.id },
        );
      }
      return { row, replayed };
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    return serializable(prisma, async (transaction) => {
      const row = await loadExistingByOperation(
        transaction,
        scope.organizationId,
        operationKeyHash,
      );
      if (!row || row.requestFingerprint !== requestFingerprint) {
        throw requestError(
          'La clave de idempotencia ya fue usada con otro contenido.',
          'PRIVACY_IDEMPOTENCY_PAYLOAD_MISMATCH',
          409,
        );
      }
      return { row, replayed: true };
    });
  }
}

async function sealDiscovery(prisma, scope, requestRow, discovery) {
  return serializable(prisma, async (transaction) => {
    const current = await loadExistingByOperation(
      transaction,
      scope.organizationId,
      requestRow.operationKeyHash,
    );
    if (!current || current.id !== requestRow.id) {
      throw requestError(
        'La solicitud de privacidad ya no está disponible.',
        'PRIVACY_REQUEST_STATE_CONFLICT',
        409,
        { requestId: requestRow.id },
      );
    }
    if (TERMINAL_STATUSES.has(current.status)) return current;
    if (current.status !== 'DISCOVERING') {
      throw requestError(
        'La solicitud de privacidad no admite sellar un descubrimiento.',
        'PRIVACY_REQUEST_STATE_CONFLICT',
        409,
        { requestId: requestRow.id },
      );
    }
    if (
      typeof transaction?.dataSubjectDiscoveryItem?.createMany !== 'function'
      || typeof transaction?.dataSubjectDiscoveryManifest?.create !== 'function'
      || typeof transaction?.dataSubjectRequest?.update !== 'function'
    ) {
      throw requestError(
        'La persistencia del manifiesto de privacidad no está disponible.',
        'PRIVACY_DISCOVERY_UNAVAILABLE',
        503,
        { requestId: requestRow.id },
      );
    }

    await transaction.dataSubjectDiscoveryItem.createMany({ data: discovery.items });
    await transaction.dataSubjectDiscoveryManifest.create({ data: discovery.manifest });
    return transaction.dataSubjectRequest.update({
      where: { id: requestRow.id },
      data: {
        status: discovery.manifest.outcome === 'COMPLETE'
          ? 'DISCOVERED'
          : 'DISCOVERY_BLOCKED',
        completedByMembershipId: scope.actorMembershipId,
        revision: { increment: 1 },
      },
    });
  });
}

async function markDiscoveryFailed(prisma, scope, requestId) {
  try {
    await serializable(prisma, async (transaction) => {
      if (
        typeof transaction?.dataSubjectRequest?.findFirst !== 'function'
        || typeof transaction?.dataSubjectRequest?.update !== 'function'
      ) return;
      const row = await transaction.dataSubjectRequest.findFirst({
        where: { id: requestId, organizationId: scope.organizationId },
        select: { id: true, status: true },
      });
      if (row?.status !== 'DISCOVERING') return;
      await transaction.dataSubjectRequest.update({
        where: { id: row.id },
        data: {
          status: 'DISCOVERY_FAILED',
          completedByMembershipId: scope.actorMembershipId,
          terminalReasonCode: 'SOURCE_READ_FAILED',
          revision: { increment: 1 },
        },
      });
    });
  } catch {
    // The original failure is authoritative. A failed attempt to persist its
    // sanitized terminal state must never expose source data or replace it.
  }
}

async function loadPublicResult(prisma, organizationId, requestId, replayed) {
  if (typeof prisma?.dataSubjectRequest?.findFirst !== 'function') {
    throw requestError(
      'La persistencia de solicitudes de privacidad no está disponible.',
      'PRIVACY_DISCOVERY_UNAVAILABLE',
      503,
      { requestId },
    );
  }
  const row = await prisma.dataSubjectRequest.findFirst({
    where: { id: requestId, organizationId },
    select: {
      id: true,
      type: true,
      subjectKind: true,
      status: true,
      receivedAt: true,
      attestedAt: true,
      terminalAt: true,
      terminalReasonCode: true,
      manifest: {
        select: {
          outcome: true,
          catalogVersion: true,
          sourceSnapshotAt: true,
          itemCount: true,
          blockerCount: true,
          manifestSha256: true,
          sealedAt: true,
          items: {
            select: {
              category: true,
              resourceType: true,
              kind: true,
              blockerCode: true,
            },
            orderBy: { ordinal: 'asc' },
          },
        },
      },
    },
  });
  if (!row) {
    throw requestError(
      'La solicitud de privacidad ya no está disponible.',
      'PRIVACY_REQUEST_STATE_CONFLICT',
      409,
      { requestId },
    );
  }
  const manifest = row.manifest;
  const categoryCounts = {};
  const blockers = [];
  for (const item of manifest?.items || []) {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    if (item.blockerCode) {
      blockers.push({
        category: item.category,
        resourceType: item.resourceType,
        code: item.blockerCode,
      });
    }
  }
  return {
    replayed,
    request: {
      id: row.id,
      type: row.type,
      subjectKind: row.subjectKind,
      status: row.status,
      receivedAt: row.receivedAt?.toISOString?.() || row.receivedAt,
      authorityAttestedAt: row.attestedAt?.toISOString?.() || row.attestedAt || null,
      requesterIdentityVerified: false,
      terminalAt: row.terminalAt?.toISOString?.() || row.terminalAt || null,
      failureCode: row.terminalReasonCode || null,
    },
    discovery: manifest ? {
      completed: true,
      coverageComplete: manifest.outcome === 'COMPLETE',
      executionAllowed: false,
      catalogVersion: manifest.catalogVersion,
      sourceSnapshotAt: manifest.sourceSnapshotAt?.toISOString?.()
        || manifest.sourceSnapshotAt,
      sealedAt: manifest.sealedAt?.toISOString?.() || manifest.sealedAt,
      itemCount: manifest.itemCount,
      blockerCount: manifest.blockerCount,
      manifestSha256: manifest.manifestSha256,
      categoryCounts,
      blockers,
    } : {
      completed: false,
      coverageComplete: false,
      executionAllowed: false,
      categoryCounts: {},
      blockers: [],
    },
  };
}

export async function createAndDiscoverWorkerPersonRequest(
  prisma,
  {
    scope: rawScope,
    input: rawInput,
    idempotencyKey,
    fingerprintKey,
    fingerprintKeyId,
    discover = discoverWorkerPersonData,
  },
) {
  const scope = normalizeScope(rawScope);
  const input = normalizeDataSubjectRequestInput(rawInput);
  if (!IDEMPOTENCY_KEY_PATTERN.test(String(idempotencyKey || ''))) {
    throw requestError(
      'La clave de idempotencia no es válida.',
      'PRIVACY_IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  validatePrivacyDiscoveryKeyConfig({
    key: fingerprintKey,
    keyId: fingerprintKeyId,
  });
  const operationKeyHash = privacyOperationKeyHash(
    scope.organizationId,
    idempotencyKey,
  );
  const requestFingerprint = privacyRequestFingerprint({
    organizationId: scope.organizationId,
    personId: input.personId,
    requestType: input.requestType,
  });
  const prepared = await prepareRequest(prisma, {
    scope,
    input,
    operationKeyHash,
    requestFingerprint,
  });
  if (TERMINAL_STATUSES.has(prepared.row.status)) {
    return loadPublicResult(prisma, scope.organizationId, prepared.row.id, true);
  }

  let discovery;
  try {
    discovery = await prisma.$transaction(
      (transaction) => discover(transaction, {
        organizationId: scope.organizationId,
        personId: input.personId,
        requestId: prepared.row.id,
        requestOperationKeyHash: operationKeyHash,
        requestFingerprint,
        sealedByMembershipId: scope.actorMembershipId,
        key: fingerprintKey,
        keyId: fingerprintKeyId,
      }),
      {
        isolationLevel: 'RepeatableRead',
        maxWait: 5_000,
        timeout: 30_000,
      },
    );
  } catch (error) {
    await markDiscoveryFailed(prisma, scope, prepared.row.id);
    if (error instanceof DataSubjectRequestError) throw error;
    throw requestError(
      'No se pudo completar el descubrimiento de datos.',
      'PRIVACY_DISCOVERY_UNAVAILABLE',
      503,
      { requestId: prepared.row.id },
    );
  }

  let sealConflict = null;
  try {
    await sealDiscovery(prisma, scope, prepared.row, discovery);
  } catch (error) {
    if (!isUniqueConflict(error) && !isRetryableTransactionError(error)) {
      await markDiscoveryFailed(prisma, scope, prepared.row.id);
      throw error;
    }
    sealConflict = error;
  }
  const result = await loadPublicResult(
    prisma,
    scope.organizationId,
    prepared.row.id,
    prepared.replayed,
  );
  if (sealConflict && !result.discovery.completed) {
    throw requestError(
      'La solicitud sigue en procesamiento; reintentá con la misma clave de idempotencia.',
      'PRIVACY_REQUEST_IN_PROGRESS',
      409,
      { requestId: prepared.row.id },
    );
  }
  return result;
}

export function dataSubjectRequestErrorResponse(error) {
  if (!(error instanceof DataSubjectRequestError)) return null;
  return Response.json(
    {
      error: error.message,
      code: error.code,
      ...(error.requestId ? { requestId: error.requestId } : {}),
    },
    {
      status: error.status,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        ...(error.retryAfterSeconds
          ? { 'Retry-After': String(error.retryAfterSeconds) }
          : {}),
      },
    },
  );
}
