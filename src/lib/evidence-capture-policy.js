import { isProtectedUploadFileSizeAllowed, protectedUploadFileSizeMessage } from './protected-upload-policy.js';
export const EVIDENCE_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']);
export const EVIDENCE_ACCEPT = EVIDENCE_MIME_TYPES.join(',');
export function evidenceSelectionIssue(file) {
  if (!file) return 'Seleccioná una foto, un video MP4 breve o un PDF.';
  if (!isProtectedUploadFileSizeAllowed(file)) return protectedUploadFileSizeMessage('La evidencia');
  if (!EVIDENCE_MIME_TYPES.includes(file.type)) return 'Formato no admitido. Usá JPG, PNG, WebP, MP4 o PDF. Para HEIC/HEIF, exportá una copia JPG antes de enviarla.';
  return null;
}
export function evidenceFileSize(bytes) {
  return Number.isSafeInteger(bytes) && bytes >= 0 ? (bytes < 1024 * 1024 ? Math.ceil(bytes / 1024) + ' KiB' : (bytes / (1024 * 1024)).toFixed(2) + ' MiB') : 'Tamaño no disponible';
}
export function evidenceScopeHeaders({ organizationId, projectId }) {
  if (typeof organizationId !== 'string' || !organizationId || typeof projectId !== 'string' || !projectId) throw new Error('Volvé a abrir la obra para verificar el contexto.');
  return { 'X-ObraSaaS-Organization': organizationId, 'X-ObraSaaS-Project': projectId };
}
export function evidenceFailureState(error, attempt) {
  const status = Number(error?.status);
  if (error?.code === 'EVIDENCE_CONTEXT_CHANGED' || [401, 403, 404].includes(status)) return 'context';
  if (attempt?.uploadId || !Number.isFinite(status) || status >= 500 || [408, 409, 425, 429].includes(status)) return 'unconfirmed';
  return 'error';
}
export const EVIDENCE_STAGES = Object.freeze({
  ready: 'Preparar evidencia', uploading: 'Transfiriendo archivo privado…', attaching: 'Vinculando con la tarea…',
  saved: 'Evidencia guardada', unconfirmed: 'Resultado por confirmar', error: 'Revisá la selección', context: 'Verificá la sesión y la obra',
});
export async function requestEvidenceStep(url, options, { phase, fetchImpl = globalThis.fetch, timeoutMs = 55000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, cache: 'no-store', signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(body?.error || (response.status === 413 ? protectedUploadFileSizeMessage('La evidencia') : 'El servidor no confirmó esta etapa. Reintentá sin cambiar el archivo.'));
      error.status = response.status; error.code = body?.code || 'EVIDENCE_STEP_FAILED'; throw error;
    }
    const valid = phase === 'upload'
      ? typeof body?.uploadId === 'string' && body.uploadId.trim().length > 0
      : typeof body?.evidence?.id === 'string' && typeof body?.evidence?.taskId === 'string' && typeof body?.evidence?.status === 'string';
    if (!valid) { const error = new Error('La respuesta llegó incompleta. Conservá la selección y reintentá la misma operación.'); error.code = 'EVIDENCE_RESPONSE_UNCONFIRMED'; throw error; }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timedOut = new Error('La conexión demoró. El archivo podría haberse recibido: reintentá la misma operación, sin volver a seleccionarlo.');
      timedOut.code = 'EVIDENCE_RESPONSE_UNCONFIRMED'; throw timedOut;
    }
    throw error;
  } finally { clearTimeout(timer); }
}
