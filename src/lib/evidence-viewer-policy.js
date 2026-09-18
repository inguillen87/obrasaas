import { evidenceScopeHeaders } from './evidence-capture-policy.js';
import { progressReviewAttachmentHref } from './progress-review-policy.js';
export const EVIDENCE_PREVIEW_MAX_BYTES = 8 * 1024 * 1024;
export const EVIDENCE_PREVIEW_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export class EvidencePreviewError extends Error {
  constructor(message, code = 'EVIDENCE_PREVIEW_UNAVAILABLE') { super(message); this.name = 'EvidencePreviewError'; this.code = code; }
}
export function evidencePreviewHref(item) {
  const href = progressReviewAttachmentHref(item);
  return href && item.attachment.kind === 'image' && EVIDENCE_PREVIEW_TYPES.includes(item.attachment.mimeType) ? href : null;
}
function mime(value) { return String(value || '').split(';', 1)[0].trim().toLowerCase(); }
// Auth remains server-side. Context is a comparison precondition, not authority.
export async function fetchEvidencePreview(item, context, { signal, fetchImpl = globalThis.fetch } = {}) {
  const href = evidencePreviewHref(item);
  if (!href || item.projectId !== context?.projectId) throw new EvidencePreviewError('La imagen no está disponible en el contexto de esta obra.', 'EVIDENCE_PREVIEW_CONTEXT');
  const headers = evidenceScopeHeaders(context);
  if (Number.isSafeInteger(item.attachment.size) && item.attachment.size > EVIDENCE_PREVIEW_MAX_BYTES) {
    throw new EvidencePreviewError('Esta imagen supera el límite del visor. Podés abrir el archivo original con tu acceso autorizado.', 'EVIDENCE_PREVIEW_SIZE');
  }
  const response = await fetchImpl(href, { method: 'GET', cache: 'no-store', credentials: 'same-origin', redirect: 'error', headers, signal });
  if (!response.ok) {
    const code = response.status === 409 ? 'EVIDENCE_PREVIEW_CONTEXT' : 'EVIDENCE_PREVIEW_UNAVAILABLE';
    throw new EvidencePreviewError(response.status === 409 ? 'Cambió la obra activa. Cerrá el visor y verificá el contexto.' : 'No se pudo consultar la imagen. Revisá tu sesión y el acceso a esta obra.', code);
  }
  const contentType = mime(response.headers.get('content-type'));
  if (!EVIDENCE_PREVIEW_TYPES.includes(contentType) || contentType !== item.attachment.mimeType) {
    await response.body?.cancel().catch(() => {});
    throw new EvidencePreviewError('La respuesta no corresponde a la imagen esperada.', 'EVIDENCE_PREVIEW_TYPE');
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > EVIDENCE_PREVIEW_MAX_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new EvidencePreviewError('La imagen supera el límite de consulta del visor.', 'EVIDENCE_PREVIEW_SIZE');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new EvidencePreviewError('La respuesta no contiene una imagen.');
  const chunks = []; let total = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > EVIDENCE_PREVIEW_MAX_BYTES) throw new EvidencePreviewError('La imagen supera el límite de consulta del visor.', 'EVIDENCE_PREVIEW_SIZE');
      chunks.push(value);
    }
    if (!total || (Number.isSafeInteger(item.attachment.size) && total !== item.attachment.size)) {
      throw new EvidencePreviewError('La transferencia no coincide con el archivo registrado.', 'EVIDENCE_PREVIEW_INCOMPLETE');
    }
    return new Blob(chunks, { type: contentType });
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}
