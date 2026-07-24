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

