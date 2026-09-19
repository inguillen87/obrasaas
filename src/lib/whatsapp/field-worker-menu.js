import { canFieldWorkerHandleIntent, FIELD_WORKER_INTENTS as INTENTS } from '../field-workers.js';
const OPTIONS = Object.freeze([
  { key: 'JOURNEY', intent: INTENTS.ATTENDANCE_START, label: 'Mi jornada', example: 'fichar · almuerzo · volví · chau' },
  { key: 'EVIDENCE', intent: INTENTS.EVIDENCE, label: 'Evidencia de obra', example: 'Adjuntá una foto o un archivo con su descripción.' },
  { key: 'INCIDENT', intent: INTENTS.INCIDENT, label: 'Informar un incidente', example: 'incidencia: describí qué pasó y dónde' },
  { key: 'PROGRESS', intent: INTENTS.TASK_PROGRESS, label: 'Informar avance', example: 'avance 30% tarea 12 · Usá la tarea real; el avance queda sujeto a revisión.' },
  { key: 'DELAY', intent: INTENTS.DELAY_REPORT, label: 'Informar una demora', example: 'demora: indicá tarea, motivo y plazo estimado' },
  { key: 'PAYMENT_DATA', intent: INTENTS.PAYMENT_DESTINATION, label: 'Mis datos de cobro', example: 'datos de cobro · No realiza pagos ni transferencias.' },
  { key: 'MEDICAL', intent: INTENTS.MEDICAL, label: 'Licencia o certificado', example: 'licencia · Usá el circuito privado para la documentación médica.' },
].map(Object.freeze));
const ROLE_NAMES = Object.freeze({ WORKER: 'Operario', FOREMAN: 'Capataz', SITE_MANAGER: 'Responsable de obra', SAFETY: 'Seguridad e higiene' });
export function fieldWorkerMenuOptions(role) {
  return OPTIONS.filter(item => canFieldWorkerHandleIntent(role, item.intent)).map(item => ({ ...item }));
}
export function buildFieldWorkerMenu({ role, projectName }) {
  if (!canFieldWorkerHandleIntent(role, INTENTS.HELP)) return 'Tu acceso a este canal necesita autorización del responsable de la obra.';
  const name = typeof projectName === 'string' ? projectName.replace(/[\u0000-\u001f\u007f*_~`]/g, ' ').trim().slice(0,100) : '';
  const lines = fieldWorkerMenuOptions(role).map(item => `• ${item.label}: ${item.example}`);
  return [`Obra: ${name || 'obra actual'}`, `Tu rol en este canal: ${ROLE_NAMES[role]}`, '',
    'Puedo ayudarte con estas opciones:', ...lines, '',
    'Este número opera sobre esta obra. Tus permisos en otras empresas no se trasladan a este chat.',
    'La asistencia y las acciones vuelven a validar tu acceso al ejecutarse.'].join('\n');
}
