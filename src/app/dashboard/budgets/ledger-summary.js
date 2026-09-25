'use client';
import { budgetLedgerGroups } from '@/lib/budget-control-view';
import styles from './budgets.module.css';

const KIND_LABEL = Object.freeze({ COMMITMENT: 'Comprometido', ACTUAL: 'Real', FORECAST: 'Forecast' });
const formatMoney = (value, currency) => {
  const amount = Number(value);
  if (currency === 'SIN_MONEDA') return amount.toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' · moneda sin resolver';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
};
const formatDate = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(date) : 'Sin fecha';
};

export default function LedgerSummary({ entries }) {
  const groups = budgetLedgerGroups(entries);
  return <section className={styles.panel} aria-labelledby="budget-ledger-title">
    <div className={styles.panelHeader}><div><h2 id="budget-ledger-title">Conciliación financiera</h2>
      <p>Compromisos, costos reales y forecast se leen aparte del presupuesto aprobado y nunca se mezclan entre monedas.</p></div></div>
    {groups.length === 0 ? <p className={styles.empty}>No hay movimientos financieros registrados.</p> : <>
      <div className={styles.ledgerGroups} aria-label="Totales por moneda">{groups.map(group => <article className={styles.ledgerGroup} key={group.currency}>
        <h3>{group.currency === 'SIN_MONEDA' ? 'Moneda sin resolver' : group.currency} · {group.count} movimientos</h3>
        <div className={styles.ledgerMetrics}><div><span>Comprometido</span><strong>{formatMoney(group.COMMITMENT, group.currency)}</strong></div>
          <div><span>Real</span><strong>{formatMoney(group.ACTUAL, group.currency)}</strong></div>
          <div><span>Forecast</span><strong>{formatMoney(group.FORECAST, group.currency)}</strong></div></div>
      </article>)}</div>
      <ol className={styles.ledgerList} aria-label="Movimientos financieros recientes">{entries.slice(0,20).map(entry => <li key={entry.id}>
        <div className={styles.ledgerTop}><strong>{KIND_LABEL[entry.kind] || 'Movimiento'}</strong><span>{formatMoney(entry.amount, entry.currency || 'SIN_MONEDA')}</span></div>
        <p>{formatDate(entry.occurredAt)} · {entry.description || entry.externalRef || 'Sin referencia externa'}</p>
      </li>)}</ol>
      {entries.length > 20 && <p className={styles.footnote}>Se muestran los 20 movimientos más recientes de {entries.length} cargados.</p>}
      {groups.some(group => group.currency === 'SIN_MONEDA') && <p className={styles.footnote} role="status">Hay movimientos cuyo renglón no pudo asociarse a una moneda de versión en esta lectura. Se mantienen separados y no entran en totales ARS/USD.</p>}
    </>}
  </section>;
}
