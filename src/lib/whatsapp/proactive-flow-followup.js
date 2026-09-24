import { flowHistoryPageMatches } from './proactive-flow-history-policy.js';

export const FLOW_FOLLOWUP_FILTERS = Object.freeze([
  { key: 'all', label: 'Todos en esta página', detail: 'Conteos de hasta 20 registros consultados. No representan el total de la conversación.' },
  { key: 'waiting', label: 'Sin respuesta', detail: 'Sin respuesta registrada y con enlace vigente al consultar. No confirma que el mensaje haya sido entregado.' },
  { key: 'expired', label: 'Enlace vencido', detail: 'El enlace venció sin respuesta registrada. No prueba falta de entrega; no autoriza reenviar.' },
  { key: 'attention', label: 'Revisar envío', detail: 'Intento pendiente, incierto, fallido o sin correlación suficiente. Revisá su estado antes de cualquier otra operación.' },
  { key: 'responded', label: 'Con respuesta', detail: 'Existe una respuesta registrada. No equivale a parte, fichaje, avance o pago aprobados.' },
]);
const deliveryStates = new Set(['accepted', 'sent', 'delivered', 'read']);
function instant(value) {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? time : null;
}
// The supplied observation time is authoritative for this screen. No Date.now(),
// client timezone, automatic expiry countdown or inference from delivery alone.
export function classifyFlowFollowup(item, observedAt) {
  const observed = instant(observedAt), registered = instant(item?.recordedAt);
  if (observed === null || registered === null || registered > observed
    || !deliveryStates.has(item?.status) || item.correlation !== 'verified' || item.riskDecision !== false) return 'attention';
  if (item.reply?.state === 'recorded') {
    const received = instant(item.reply.recordedAt);
    return received !== null && received >= registered && received <= observed ? 'responded' : 'attention';
  }
  if (item.reply?.state !== 'not_recorded' || item.reply.recordedAt !== null) return 'attention';
  const expires = instant(item.expiresAt);
  if (expires === null || expires <= registered) return 'attention';
  return expires <= observed ? 'expired' : 'waiting';
}
export function summarizeFlowFollowup(page) {
  if (!flowHistoryPageMatches(page, page?.context, page?.cursor)) return { available: false, counts: null, items: [] };
  const counts = { all: page.items.length, waiting: 0, expired: 0, attention: 0, responded: 0 };
  const items = page.items.map(item => { const category = classifyFlowFollowup(item, page.observedAt); counts[category]++; return { item, category }; });
  return { available: true, counts, items };
}
export function flowFollowupFilter(key) {
  return FLOW_FOLLOWUP_FILTERS.find(filter => filter.key === key) || FLOW_FOLLOWUP_FILTERS[0];
}
