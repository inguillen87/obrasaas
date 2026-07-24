const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class PrivateStorageError extends Error {
  constructor(message, code = 'PRIVATE_STORAGE_SCOPE_INVALID') {
    super(message);
    this.name = 'PrivateStorageError';
    this.code = code;
  }
}

function segment(value, field) {
  if (typeof value !== 'string' || !SAFE_SEGMENT.test(value) || value === '.' || value === '..') {
    throw new PrivateStorageError(`${field} inválido.`);
  }
  return value;
}

export function buildWorkerDocumentObjectKey({ organizationId, projectId, workerId, documentId, version }) {
  const normalizedVersion = Number(version);
  if (!Number.isSafeInteger(normalizedVersion) || normalizedVersion < 1) {
    throw new PrivateStorageError('version inválida.', 'PRIVATE_STORAGE_VERSION_INVALID');
  }
  return [
    'obrasaas',
    segment(organizationId, 'organizationId'),
    segment(projectId, 'projectId'),
    'workers',
    segment(workerId, 'workerId'),
    'documents',
    segment(documentId, 'documentId'),
    `v${normalizedVersion}`,
  ].join('/');
}

export function assertWorkerDocumentObjectKey(scope, objectKey) {
  const expectedPrefix = buildWorkerDocumentObjectKey({ ...scope, documentId: 'placeholder', version: 1 }).replace('/documents/placeholder/v1', '/documents/');
  if (typeof objectKey !== 'string' || !objectKey.startsWith(expectedPrefix)) {
    throw new PrivateStorageError('La clave no pertenece al scope solicitado.', 'PRIVATE_STORAGE_SCOPE_MISMATCH');
  }
  const suffix = objectKey.slice(expectedPrefix.length);
  if (!/^[-A-Za-z0-9._]{1,128}\/v[1-9][0-9]*$/.test(suffix)) {
    throw new PrivateStorageError('Clave de objeto inválida.', 'PRIVATE_STORAGE_KEY_INVALID');
  }
  return objectKey;
}
