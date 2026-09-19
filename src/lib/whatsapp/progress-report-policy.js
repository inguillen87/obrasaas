import { redactSensitiveText } from '../sensitive-text.js';
import { isMedicalEvidenceRecord, isSensitiveMedicalText } from '../medical-privacy.js';
export class WhatsAppProgressReportError extends Error {
  constructor(message, code = 'WHATSAPP_REPORT_INVALID', status = 422) { super(message); this.name = 'WhatsAppProgressReportError'; this.code = code; this.status = status; }
}
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
export function reportIdentifier(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw new WhatsAppProgressReportError('La referencia solicitada no es válida.');
  return value;
}
export function reportSourceKind(message) {
  const meta = message?.metadata;
  if (!meta || message.direction !== 'INBOUND' || meta.provider !== 'meta' || meta.authorized !== true
    || meta.quarantined === true || meta.redacted === true || meta.simulated === true || meta.sourceContentRestricted === true
    || typeof meta.workerId !== 'string' || !ID.test(meta.workerId) || isMedicalEvidenceRecord(message)) return null;
  if (message.kind === 'TEXT' && typeof message.body === 'string' && message.body.trim() && !meta.transcription) return 'TEXT';
  if (message.kind === 'AUDIO' && meta.transcription?.status === 'completed' && typeof meta.transcription.text === 'string' && meta.transcription.text.trim()) return 'AUDIO_TRANSCRIPT';
  return null;
}
function text(value, label, max) {
  if (typeof value !== 'string') throw new WhatsAppProgressReportError(label + ': completá el texto.');
  const normalized = value.trim().replace(/\r\n/g, '\n');
  if (!normalized || normalized.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(normalized)) throw new WhatsAppProgressReportError(label + ': usá hasta ' + max + ' caracteres válidos.');
  if (isSensitiveMedicalText(normalized)) throw new WhatsAppProgressReportError('El contenido médico no se traslada a la bitácora operativa.', 'WHATSAPP_REPORT_SENSITIVE', 409);
  if (redactSensitiveText(normalized) !== normalized) throw new WhatsAppProgressReportError('El texto contiene un enlace protegido o material que no debe trasladarse a la bitÃ¡cora.', 'WHATSAPP_REPORT_PRIVATE_CONTENT', 409);
  return normalized;
}
export function normalizeMessageReport(input) {
  const keys = new Set(['taskId', 'title', 'summary', 'sourceVersion']);
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.has(key))) throw new WhatsAppProgressReportError('El parte contiene campos no admitidos.');
  if (typeof input.sourceVersion !== 'string' || !/^[a-f0-9]{64}$/.test(input.sourceVersion)) throw new WhatsAppProgressReportError('Volvé a consultar el mensaje antes de preparar el parte.', 'WHATSAPP_REPORT_SOURCE_REQUIRED', 409);
  return { taskId: reportIdentifier(input.taskId), title: text(input.title, 'Título', 180), summary: text(input.summary, 'Resumen revisado', 3000), sourceVersion: input.sourceVersion };
}
export function confirmedMessageReport(payload, { projectId, taskId }) {
  const result = payload?.report;
  if (!result || typeof result.id !== 'string' || result.projectId !== projectId || result.taskId !== taskId
    || !['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(result.status) || !Number.isSafeInteger(result.revision) || result.revision < 0) {
    throw new WhatsAppProgressReportError('El servidor no confirmó el parte esperado. Conservá el texto y reintentá la misma solicitud.', 'WHATSAPP_REPORT_UNCONFIRMED', 502);
  }
  return result;
}
export function messageReportErrorResponse(error) {
  return error instanceof WhatsAppProgressReportError ? Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } }) : null;
}
