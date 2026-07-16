import { createHash } from 'node:crypto';

import { FIELD_WORKER_INTENTS } from '../field-workers.js';
import { parseOperationalProposalDecision } from './operational-proposals.js';

function normalizePolicyText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function flowKind(event) {
  const response = event.interactive?.response || {};
  return normalizePolicyText(
    response.flow_type || response.flow_name || event.interactive?.name || '',
  );
}

export function classifyObraIntent(event, { trustedFlowType = null } = {}) {
  const body = String(event.text || event.transcription?.text || '').trim();
  const lowerBody = normalizePolicyText(body);
  if (event.location) return FIELD_WORKER_INTENTS.ATTENDANCE_LOCATION;
  if (['image', 'video', 'document', 'sticker', 'audio'].includes(event.kind)) {
    return FIELD_WORKER_INTENTS.EVIDENCE;
  }
  if (parseOperationalProposalDecision(event)) {
    return FIELD_WORKER_INTENTS.COMMAND_CONFIRMATION;
  }
  if (event.interactive?.type === 'flow') {
    const kind = event.provider === 'meta'
      ? normalizePolicyText(trustedFlowType)
      : flowKind(event);
    if (kind.includes('medical') || kind.includes('licencia')) return FIELD_WORKER_INTENTS.MEDICAL;
    if (kind.includes('attendance') || kind.includes('fichaje')) {
      return FIELD_WORKER_INTENTS.ATTENDANCE_START;
    }
    if (kind.includes('incident')) return FIELD_WORKER_INTENTS.INCIDENT;
    return FIELD_WORKER_INTENTS.EVIDENCE;
  }
  if (lowerBody.includes('licencia') || lowerBody.includes('certificado')) {
    return FIELD_WORKER_INTENTS.MEDICAL;
  }
  if (['fichar', 'ingreso', 'ingresar', 'entrada', 'arranco'].some((term) => lowerBody.includes(term))) {
    return FIELD_WORKER_INTENTS.ATTENDANCE_START;
  }
  if (/\b([0-9]{1,3})\s*%/.test(lowerBody)) return FIELD_WORKER_INTENTS.TASK_PROGRESS;
  if (
    ['incidencia', 'reportar incidencia', 'nueva incidencia'].includes(lowerBody)
    || ['fuga', 'roto', 'accidente', 'riesgo', 'urgente', 'peligro'].some((term) => lowerBody.includes(term))
  ) {
    return FIELD_WORKER_INTENTS.INCIDENT;
  }
  if (['demora', 'retraso', 'no llego', 'suministro'].some((term) => lowerBody.includes(term))) {
    return FIELD_WORKER_INTENTS.DELAY_REPORT;
  }
  if (lowerBody.includes('ayuda') || lowerBody.includes('menu')) return FIELD_WORKER_INTENTS.HELP;
  return FIELD_WORKER_INTENTS.EVIDENCE;
}

export function attendanceStatusCountsAsPresent(status) {
  const normalized = normalizePolicyText(status).trim();
  return normalized === 'presente'
    || normalized.startsWith('presente (')
    || normalized.startsWith('presente ·');
}

export function setWorkerAttendance(attendance, worker, entry) {
  if (!attendance || typeof attendance !== 'object' || Array.isArray(attendance)) {
    throw new Error('A valid attendance snapshot is required.');
  }
  if (!worker?.id || !worker?.name) {
    throw new Error('A trusted worker identity is required.');
  }

  const legacyEntry = attendance[worker.name];
  if (
    worker.name !== worker.id
    && legacyEntry
    && (!legacyEntry.workerId || legacyEntry.workerId === worker.id)
  ) {
    delete attendance[worker.name];
  }

  attendance[worker.id] = {
    ...entry,
    workerId: worker.id,
    name: worker.name,
    role: worker.role || 'Cuadrilla de obra',
  };
  return attendance[worker.id];
}

export function countPresentAttendanceEntries(attendance) {
  if (!attendance || typeof attendance !== 'object' || Array.isArray(attendance)) return 0;
  return Object.values(attendance).filter((entry) => (
    attendanceStatusCountsAsPresent(entry?.status)
  )).length;
}

export function prependUniqueEventIncident(incidents, externalId, incident) {
  if (!Array.isArray(incidents) || !incident?.id) {
    throw new Error('A valid incident collection and incident are required.');
  }
  const id = externalId
    ? `inc-event-${createHash('sha256').update(String(externalId)).digest('hex').slice(0, 32)}`
    : incident.id;
  if (incidents.some((current) => current?.id === id)) return false;
  incidents.unshift({ ...incident, id });
  return true;
}
