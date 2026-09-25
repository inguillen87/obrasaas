const STATUS_PRESENTATION = Object.freeze({
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  SUBMITTED: { label: 'En revisi?n', tone: 'warning' },
  APPROVED: { label: 'Aprobada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'muted' },
});
const normalize = value => typeof value === 'string' ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim() : '';
export function purchaseOrderPresentation(status) { return STATUS_PRESENTATION[status] || { label: 'Estado no clasificado', tone: 'warning' }; }
export function purchaseMarketplaceSummary({ orders = [], suppliers = [], receipts = [], commitments = [] } = {}) {
  const safeOrders = Array.isArray(orders) ? orders : [], safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  return {
    suppliers: safeSuppliers.length,
    openOrders: safeOrders.filter(row => ['DRAFT','SUBMITTED','APPROVED'].includes(row?.status)).length,
    approvedOrders: safeOrders.filter(row => row?.status === 'APPROVED').length,
    receipts: Array.isArray(receipts) ? receipts.length : 0,
    commitments: Array.isArray(commitments) ? commitments.length : 0,
  };
}
export function filterPurchaseOrders(orders, { query = '', status = 'ALL' } = {}) {
  if (!Array.isArray(orders)) return [];
  const needle = normalize(query), tokens = needle.split(' ').filter(Boolean);
  return orders.filter(order => {
    if (status !== 'ALL' && order?.status !== status) return false;
    if (!tokens.length) return true;
    const haystack = normalize([order?.number, order?.supplier?.legalName, order?.currency,
      ...(Array.isArray(order?.lines) ? order.lines.flatMap(line => [line?.description, line?.unit]) : [])].filter(Boolean).join(' '));
    return tokens.every(token => haystack.includes(token));
  });
}
export const PURCHASE_ORDER_FILTERS = Object.freeze([
  { value: 'ALL', label: 'Todas' }, { value: 'DRAFT', label: 'Borradores' },
  { value: 'SUBMITTED', label: 'En revisi?n' }, { value: 'APPROVED', label: 'Aprobadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]);
