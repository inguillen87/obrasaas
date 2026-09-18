export const FIELD_REPORT_CATEGORIES = Object.freeze([
  { key: 'PROGRESS', label: 'Avance', help: 'Qué se hizo y en qué sector.' },
  { key: 'SHORTAGE', label: 'Faltante', help: 'Material, cantidad, unidad y cuándo se necesita.' },
  { key: 'ISSUE', label: 'Incidencia', help: 'Qué impide continuar y qué atención necesita.' },
  { key: 'IMPROVEMENT', label: 'Mejora', help: 'Propuesta para revisar con el responsable.' },
].map(Object.freeze));
export class FieldReportError extends Error {
  constructor(message, code = 'FIELD_REPORT_INVALID', status = 422) {
    super(message); this.code = code; this.status = status;
  }
}
const KEYS = new Set(['projectId', 'category', 'title', 'location', 'details', 'workDate']);
function text(value, label, max, multiline = false) {
  if (typeof value !== 'string') throw new FieldReportError(label + ': completá el campo.');
  const normalized = value.trim().replace(/\r\n/g, '\n');
  const forbidden = multiline ? /[\u0000-\u0008\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (!normalized || normalized.length > max || forbidden.test(normalized)) {
    throw new FieldReportError(label + ': usá hasta ' + max + ' caracteres válidos.');
  }
  return normalized;
}
export function normalizeFieldReport(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !KEYS.has(key))) {
    throw new FieldReportError('El parte contiene campos no admitidos.');
  }
  const category = FIELD_REPORT_CATEGORIES.find(item => item.key === input.category);
  if (!category) throw new FieldReportError('Seleccioná un tipo de parte válido.');
  const workDate = text(input.workDate, 'Fecha', 10);
  const date = new Date(workDate + 'T00:00:00.000Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== workDate) {
    throw new FieldReportError('La fecha del parte no es válida.');
  }
  return {
    projectId: text(input.projectId, 'Obra', 190), category: category.key,
    title: text(input.title, 'Título', 160), location: text(input.location, 'Sector', 240),
    details: text(input.details, 'Detalle', 2000, true), workDate,
  };
}
export function fieldReportAsDailyLog(input) {
  const report = normalizeFieldReport(input);
  const label = FIELD_REPORT_CATEGORIES.find(item => item.key === report.category).label;
  return {
    title: label + ' — ' + report.title,
    summary: 'Parte de campo: ' + label + '\nSector: ' + report.location + '\n\n' + report.details,
    workDate: new Date(report.workDate + 'T00:00:00.000Z'),
  };
}
export function fieldReportErrorResponse(error) {
  return error instanceof FieldReportError ? Response.json({ error: error.message, code: error.code }, {
    status: error.status, headers: { 'Cache-Control': 'private, no-store' },
  }) : null;
}
