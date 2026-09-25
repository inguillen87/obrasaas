import { summarizeFlowFollowup, flowFollowupFilter } from './proactive-flow-followup.js';

export const FLOW_HISTORY_SEARCH_LIMIT = 160;
export const FLOW_HISTORY_ORDERS = Object.freeze([
  { key: 'recent', label: 'Más recientes' },
  { key: 'attention', label: 'Requieren atención primero' },
]);
const priority = Object.freeze({ attention: 0, expired: 1, waiting: 2, responded: 3 });
export function flowHistoryTitle(key) {
  if (key === 'incident-report') return 'Incidencia de obra';
  if (key === 'shift-check-in') return 'Fichaje y seguridad';
  return 'Formulario';
}
export function normalizeFlowHistoryQuery(value) {
  return typeof value === 'string' ? value.slice(0, FLOW_HISTORY_SEARCH_LIMIT)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim() : '';
}
// Search only the private-safe fields already returned by the authorized reader.
// Never fetch other pages, mutate provider state or reinterpret a cursor here.
export function buildFlowHistoryView(page, { filter = 'all', query = '', order = 'recent' } = {}) {
  const summary = summarizeFlowFollowup(page), selected = flowFollowupFilter(filter);
  const normalized = normalizeFlowHistoryQuery(query), tokens = normalized.split(' ').filter(Boolean);
  const ordering = FLOW_HISTORY_ORDERS.some(option => option.key === order) ? order : 'recent';
  if (!summary.available) return { available: false, items: [], counts: null, pageCount: 0, categoryCount: 0, query: normalized, order: ordering };
  const candidates = summary.items.map((row, index) => ({ ...row, index }))
    .filter(row => selected.key === 'all' || row.category === selected.key);
  const matches = candidates.filter(({ item }) => {
    const text = [item.messageId, flowHistoryTitle(item.blueprintKey), item.body].map(value => normalizeFlowHistoryQueryText(value)).join(' ');
    return tokens.every(token => text.includes(token));
  });
  if (ordering === 'attention') matches.sort((left, right) => priority[left.category] - priority[right.category] || left.index - right.index);
  return { available: true, items: matches.map(row => row.item), counts: summary.counts,
    pageCount: page.items.length, categoryCount: candidates.length, query: normalized, order: ordering };
}
function normalizeFlowHistoryQueryText(value) {
  return typeof value === 'string' ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim() : '';
}
