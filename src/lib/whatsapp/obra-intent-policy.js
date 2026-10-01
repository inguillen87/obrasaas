// Pure contracts reused from enterprise 1677ff7; imports adapted only.


import { FIELD_WORKER_INTENTS } from './field-worker-intent-policy.js';
import { parseOperationalProposalDecision } from './operational-proposal-decision-policy.js';

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

export function requestedAttendanceAction(value) {
  const text = normalizePolicyText(value).trim();
  if (!text) return null;
  if (
    ['almuerzo', 'pausa', 'descanso', 'iniciar pausa', 'inicio pausa', 'salgo a almorzar']
      .some((term) => text === term || text.startsWith(`${term} `))
  ) return 'BREAK_START';
  if (
    ['volvi', 'regreso', 'fin pausa', 'terminar pausa', 'retomo', 'retomar actividad']
      .some((term) => text === term || text.startsWith(`${term} `))
  ) return 'BREAK_END';
  if (
    ['chau', 'salida', 'egreso', 'me voy', 'termine'].includes(text)
    || ['finalizar jornada', 'cerrar jornada'].some(
      (term) => text === term || text.startsWith(`${term} `),
    )
  ) return 'CHECK_OUT';
  if (
    ['fichar', 'ingreso', 'ingresar', 'entrada', 'arranco']
      .some((term) => text === term || text.includes(term))
  ) return 'CHECK_IN';
  return null;
}

export function requestedWorkerPaymentDestination(value) {
  const text = normalizePolicyText(value).trim().replace(/\s+/g, ' ');
  if (!text) return false;

  if ([
    'cobro',
    'datos de cobro',
    'destino de cobro',
    'medio de cobro',
    'forma de cobro',
    'configurar cobro',
    'solicitud de destino de cobro protegida',
    '[destino de cobro restringido]',
  ].includes(text)) return true;

  if (/\b(?:quiero|necesito|como|donde)\s+(?:puedo\s+|quiero\s+)?cobrar\b/u.test(text)) {
    return true;
  }
  if (/\b(?:configurar|configuro|cambiar|cambio|actualizar|actualizo)\s+(?:como|donde)\s+(?:me\s+)?(?:cobro|pagan)\b/u.test(text)) {
    return true;
  }
  if (/\b(?:donde|como)\s+(?:me\s+)?pagan\b/u.test(text)) return true;
  if (/\b(?:datos|cuenta|cbu|cvu|alias)\b/u.test(text)) {
    return /\b(?:cobro|cobrar|sueldo|reintegro|pagar|paguen|depositar|depositen)\b/u.test(text)
      || /\b(?:configurar|configuro|cargar|cargo|cambiar|cambio|actualizar|actualizo|confirmar|confirmo)\s+(?:mi\s+)?(?:cuenta|cbu|cvu|alias)\b/u.test(text)
      || /\bmi\s+(?:cbu|cvu|alias)\s+(?:es\b|:)/u.test(text);
  }
  return false;
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
    if (kind === 'worker_payment_destination') {
      return FIELD_WORKER_INTENTS.PAYMENT_DESTINATION;
    }
    if (kind.includes('incident')) return FIELD_WORKER_INTENTS.INCIDENT;
    return FIELD_WORKER_INTENTS.EVIDENCE;
  }
  if (lowerBody.includes('licencia') || lowerBody.includes('certificado')) {
    return FIELD_WORKER_INTENTS.MEDICAL;
  }
  const attendanceAction = requestedAttendanceAction(lowerBody);
  const paymentDestinationRequested = requestedWorkerPaymentDestination(lowerBody)
    || event.sensitiveContentKind === 'worker_payment_destination';
  if (paymentDestinationRequested && !attendanceAction) {
    return FIELD_WORKER_INTENTS.PAYMENT_DESTINATION;
  }
  if (attendanceAction && !paymentDestinationRequested) {
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
