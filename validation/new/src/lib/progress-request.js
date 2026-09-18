import { evidenceScopeHeaders } from './evidence-capture-policy.js';

// These headers are comparison conditions, never a replacement for session/RBAC.
export function createProgressRequest(context, { fetchImpl = globalThis.fetch, onContextChange } = {}) {
  const fixedContext = { organizationId: context?.organizationId, projectId: context?.projectId };
  let staleContextError = null;
  return async function requestProgress(path, options = {}) {
    if (staleContextError) throw staleContextError;
    if (typeof path !== 'string' || !path.startsWith('/api/') || /[\\\u0000-\u0020\u007f]/.test(path)) {
      throw new TypeError('El destino de la operación no es una ruta interna válida.');
    }
    const target = new URL(path, 'https://obrasaas.internal');
    if (target.origin !== 'https://obrasaas.internal' || !target.pathname.startsWith('/api/')) {
      throw new TypeError('El destino de la operación no pertenece a esta aplicación.');
    }
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    for (const [key, value] of Object.entries(evidenceScopeHeaders(fixedContext))) headers.set(key, value);
    const response = await fetchImpl(path, { ...options, cache: 'no-store', headers });
    const body = await response.json().catch(() => null);
    const objectBody = body && typeof body === 'object' && !Array.isArray(body);
    if (!response.ok) {
      const error = new Error(objectBody && typeof body.error === 'string' ? body.error : 'No se pudo completar la operación.');
      error.status = response.status;
      error.code = objectBody && typeof body.code === 'string' ? body.code : null;
      error.assessmentCreated = Boolean(objectBody && body.assessmentId);
      if (error.code === 'EVIDENCE_CONTEXT_CHANGED') {
        staleContextError = error;
        if (typeof onContextChange === 'function') onContextChange(error);
      }
      throw error;
    }
    if (!objectBody) {
      const error = new Error('La respuesta llegó incompleta. Conservá los datos y verificá la bitácora antes de volver a enviar.');
      error.status = response.status; error.code = 'PROGRESS_RESPONSE_UNCONFIRMED'; throw error;
    }
    return body;
  };
}

// Validate creation before clearing the local draft.
export function confirmedProgressLog(body) {
  const log = body?.dailyLog;
  if (!log || typeof log.id !== 'string' || !log.id.trim()
    || !['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(log.status)
    || !Number.isSafeInteger(log.revision) || log.revision < 0) {
    const error = new Error('El servidor no devolvió un parte válido. Conservá el texto y verificá los registros antes de volver a enviar.');
    error.code = 'PROGRESS_RESPONSE_UNCONFIRMED'; throw error;
  }
  return log;
}
