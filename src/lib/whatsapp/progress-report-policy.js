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
  if (redactSensitiveText(normalized) !== normalized) throw new WhatsAppProgressReportError('El texto contiene un enlace protegido o material que no debe trasladarse a la bitácora.', 'WHATSAPP_REPORT_PRIVATE_CONTENT', 409);
  return normalized;
}
export function normalizeMessageReport(input) {
  const keys = new Set(['taskId', 'title', 'summary', 'sourceVersion']);
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.has(key))) throw new WhatsAppProgressReportError('El parte contiene campos no admitidos.');
  if (typeof input.sourceVersion !== 'string' || !/^[a-f0-9]{64}$/.test(input.sourceVersion)) throw new WhatsAppProgressReportError('Volvé a consultar el mensaje antes de preparar el parte.', 'WHATSAPP_REPORT_SOURCE_REQUIRED', 409);
  return { taskId: reportIdentifier(input.taskId), title: text(input.title, 'Título', 180), summary: text(input.summary, 'Resumen revisado', 3000), sourceVersion: input.sourceVersion };
}
const HASH = /^[a-f0-9]{64}$/;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && ID.test(value);
const validHash = value => typeof value === 'string' && HASH.test(value);
const exactKeys = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const contextKeys = ['organizationId', 'projectId', 'conversationId', 'messageId'];
export function messageReportContextMatches(actual, expected) {
  return exactKeys(actual, contextKeys) && contextKeys.every(key => validId(expected?.[key]) && actual[key] === expected[key]);
}
export function messageReportRecordMatches(report, expected) {
  return exactKeys(report, ['id', 'projectId', 'taskId', 'status', 'revision'])
    && typeof expected?.reportId === 'string' && /^wa_report_[a-f0-9]{64}$/.test(expected.reportId) && report.id === expected.reportId
    && validId(expected?.projectId) && report.projectId === expected.projectId
    && validId(report.taskId) && (!expected.taskId || report.taskId === expected.taskId)
    && ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(report.status)
    && Number.isSafeInteger(report.revision) && report.revision >= 0;
}
export function messageReportPreparationMatches(payload, expected) {
  const source = payload?.source;
  return Boolean(exactKeys(payload, ['context','reportId','source','existing','existingReceipt']) && messageReportContextMatches(payload?.context, expected) && payload.reportId === expected.reportId
    && exactKeys(source, ['id','conversationId','projectId','kind','text','sentAt','workDate','version'])
    && source?.id === expected.messageId && source.conversationId === expected.conversationId && source.projectId === expected.projectId
    && ['TEXT', 'AUDIO_TRANSCRIPT'].includes(source.kind) && typeof source.text === 'string' && source.text.trim() && source.text.length <= 16000
    && validHash(source.version) && typeof source.sentAt === 'string' && Number.isFinite(Date.parse(source.sentAt))
    && typeof source.workDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source.workDate)
    && (payload.existing === null ? payload.existingReceipt === null : messageReportRecordMatches(payload.existing, expected)
      && exactKeys(payload.existingReceipt, ['sourceVersion','requestFingerprint']) && validHash(payload.existingReceipt?.sourceVersion) && validHash(payload.existingReceipt?.requestFingerprint)));
}
// Same deterministic identity as the existing database writer. Not a credential.
export async function messageReportSourceId(context, cryptoProvider = globalThis.crypto) {
  const values = contextKeys.map(key => reportIdentifier(context?.[key]));
  const bytes = new TextEncoder().encode(JSON.stringify(['whatsapp-report-source-v1', ...values]));
  const digest = await cryptoProvider.subtle.digest('SHA-256', bytes);
  return 'wa_report_' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function messageReportRecovery(error) {
  if (error?.status === 409 && error.code === 'WHATSAPP_REPORT_SOURCE_CHANGED') return 'refresh';
  if (error?.status === 422 && error.code === 'WHATSAPP_REPORT_INVALID') return 'revise';
  if ([401,402,403,404,410].includes(error?.status) || error?.code === 'WHATSAPP_REPORT_INTEGRITY') return 'blocked';
  return 'uncertain';
}
export async function messageReportFingerprint(input, cryptoProvider = globalThis.crypto) {
  const bytes = new TextEncoder().encode(JSON.stringify(normalizeMessageReport(input)));
  const hash = await cryptoProvider.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function confirmedMessageReport(payload, expected) {
  if (!exactKeys(payload, ['context','sourceVersion','requestFingerprint','report','replayed']) || !messageReportContextMatches(payload?.context, expected)
    || !validHash(expected?.sourceVersion) || payload.sourceVersion !== expected.sourceVersion
    || !validHash(expected?.requestFingerprint) || payload.requestFingerprint !== expected.requestFingerprint
    || typeof payload.replayed !== 'boolean' || !messageReportRecordMatches(payload?.report, expected)) {
    throw new WhatsAppProgressReportError('El servidor no confirmó el parte de este mensaje y esta solicitud. Conservá el texto y verificá el mismo intento.', 'WHATSAPP_REPORT_UNCONFIRMED', 502);
  }
  return payload.report;
}
export function messageReportErrorResponse(error) {
  return error instanceof WhatsAppProgressReportError ? Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } }) : null;
}
