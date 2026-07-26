export const MAX_PROTECTED_UPLOAD_BYTES = 4 * 1024 * 1024;

export const PROTECTED_UPLOAD_QUOTAS = Object.freeze({
  actorProjectActive: 8,
  projectActive: 40,
  organizationRollingDayBytes: 256 * 1024 * 1024,
});

const fileIdentityTokens = new WeakMap();
let nextFileIdentityToken = 1;

export function protectedUploadFileSizeMessage(noun = 'El archivo') {
  return `${noun} debe pesar entre 1 byte y 4 MiB (4.194.304 bytes).`;
}

export function isProtectedUploadFileSizeAllowed(file) {
  return Boolean(
    file
    && Number.isSafeInteger(file.size)
    && file.size >= 1
    && file.size <= MAX_PROTECTED_UPLOAD_BYTES,
  );
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  if (value === undefined) return null;
  return value;
}

export function protectedUploadPayloadKey(payload) {
  return JSON.stringify(canonicalValue(payload));
}

export function protectedUploadFileIdentity(file) {
  if (!file) return null;
  if (!fileIdentityTokens.has(file)) {
    fileIdentityTokens.set(file, `selected-file-${nextFileIdentityToken}`);
    nextFileIdentityToken += 1;
  }
  return {
    selection: fileIdentityTokens.get(file),
    name: String(file.name || ''),
    size: Number(file.size) || 0,
    type: String(file.type || ''),
    lastModified: Number(file.lastModified) || 0,
  };
}

export function isTerminalProtectedUploadClientError(error) {
  const status = Number(error?.status);
  const retryableCodes = new Set([
    'PROTECTED_UPLOAD_IN_PROGRESS',
    'PROTECTED_UPLOAD_LEASE_LOST',
    'PROTECTED_UPLOAD_DELETE_IN_PROGRESS',
  ]);
  if (retryableCodes.has(String(error?.code || ''))) return false;
  return status >= 400
    && status < 500
    && ![408, 425, 429].includes(status);
}

export function reuseProtectedUploadAttempt(current, payloadKey, {
  randomUUID = () => globalThis.crypto.randomUUID(),
  now = () => new Date(),
} = {}) {
  if (current?.payloadKey === payloadKey) return current;
  if (current?.uploadId) {
    const error = new Error('La carga anterior debe descartarse antes de cambiar los datos.');
    error.code = 'PROTECTED_UPLOAD_ATTEMPT_CLEANUP_REQUIRED';
    throw error;
  }
  const operationKey = randomUUID();
  return {
    payloadKey,
    operationKey,
    deleteKey: `delete:${operationKey}`,
    capturedAt: now().toISOString(),
    uploadId: null,
  };
}

export function rememberProtectedUploadId(attempt, uploadId) {
  if (!attempt || typeof uploadId !== 'string' || !uploadId.trim()) {
    throw new TypeError('A valid upload attempt and uploadId are required.');
  }
  attempt.uploadId = uploadId.trim();
  return attempt;
}

export async function discardProtectedUploadAttempt(attempt, deleteEndpoint, {
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!attempt?.uploadId) return true;
  const response = await fetchImpl(deleteEndpoint, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': attempt.deleteKey,
    },
    body: JSON.stringify({ uploadId: attempt.uploadId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      body.error || 'La carga anterior quedó pendiente de limpieza; reintentá antes de cambiar los datos.',
    );
    error.status = response.status;
    error.code = body.code || 'PROTECTED_UPLOAD_ATTEMPT_DELETE_FAILED';
    throw error;
  }
  attempt.uploadId = null;
  return true;
}

export async function protectedUploadAttemptForPayload(current, payloadKey, {
  deleteEndpoint,
  fetchImpl = globalThis.fetch,
  randomUUID,
  now,
} = {}) {
  if (current?.payloadKey === payloadKey) return current;
  if (current?.uploadId) {
    await discardProtectedUploadAttempt(current, deleteEndpoint, { fetchImpl });
  }
  return reuseProtectedUploadAttempt(null, payloadKey, { randomUUID, now });
}
