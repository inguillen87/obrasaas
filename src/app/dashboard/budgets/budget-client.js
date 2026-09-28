'use client';
import { useMemo, useState } from 'react';
import { budgetControlSummary, budgetStatusPresentation, budgetVersionTotal } from '@/lib/budget-control-view';
import styles from './budgets.module.css';

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}
const emptyLine = { costCode: '', description: '', amount: '' };
const formatMoney = (value, currency) => {
  const amount = Number(value), code = /^[A-Z]{3}$/.test(currency || '') ? currency : 'ARS';
  return Number.isFinite(amount) ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(amount) : code + ' —';
};

export default function BudgetClient({ initialBudgets, canManage, projectName }) {
  const [rows, setRows] = useState(initialBudgets);
  const [currency, setCurrency] = useState('ARS');
  const [lines, setLines] = useState([emptyLine]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const summary = useMemo(() => budgetControlSummary(rows), [rows]);

  function updateLine(index, field, value) {
    setLines(current => current.map((line, rowIndex) => rowIndex === index ? { ...line, [field]: value } : line));
  }
  async function create(event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await api('/api/budgets', { method: 'POST', body: JSON.stringify({ currency, lines: lines.map(line => ({ ...line, amount: Number(line.amount) })) }) });
      setRows(current => [result.budget, ...current]); setLines([emptyLine]); setNotice('Borrador creado; todavía no afecta el presupuesto vigente.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }
  async function activate(row) {
    setBusy(true);
    try {
      await api('/api/budgets', { method: 'PATCH', body: JSON.stringify({ id: row.id, expectedRevision: row.revision }) });
      setRows(current => current.map(entry => entry.id === row.id ? { ...entry, status: 'ACTIVE', revision: entry.revision + 1 } : { ...entry, status: entry.status === 'ACTIVE' ? 'SUPERSEDED' : entry.status }));
      setNotice('Versión activada con control de concurrencia.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }

  return <main className={styles.shell}>
    <section className={styles.hero} aria-labelledby="budget-title"><div className={styles.heroTop}><div>
      <span className={styles.eyebrow}>CONTROL ECONÓMICO · VERSIONADO</span><h1 id="budget-title">Presupuesto & costos</h1>
      <p>{projectName} · Presupuesto base, versiones históricas y movimientos financieros separados por moneda.</p></div>
      <span className={styles.sourceBadge}><i className="fa-solid fa-shield-halved" aria-hidden="true"/> Activación explícita y auditada</span>
    </div></section>

    <section className={styles.stats} aria-label="Resumen presupuestario">
      <article className={styles.stat}><span>Versiones</span><strong>{summary.versions}</strong></article>
      <article className={styles.stat}><span>Borradores</span><strong>{summary.drafts}</strong></article>
      <article className={styles.stat}><span>Versión vigente</span><strong>{summary.active ? 'v' + summary.active.version : 'Sin activar'}</strong></article>
      <article className={styles.stat}><span>Total vigente</span><strong>{summary.active ? formatMoney(summary.activeTotal, summary.activeCurrency) : '—'}</strong></article>
    </section>

    {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}

    <section className={styles.panel} aria-labelledby="budget-versions-title">
      <div className={styles.panelHeader}><div><h2 id="budget-versions-title">Versiones presupuestarias</h2><p>Cada activación conserva la versión anterior. Un borrador no altera el presupuesto vigente.</p></div></div>
      {rows.length === 0 ? <p className={styles.empty}>No hay presupuestos registrados para esta obra.</p> : <ol className={styles.versionList}>{rows.map(row => {
        const presentation = budgetStatusPresentation(row.status), total = budgetVersionTotal(row);
        return <li className={styles.versionCard} key={row.id}><div><div className={styles.versionTop}><strong>Versión {row.version}</strong><span className={styles.status} data-tone={presentation.tone}>{presentation.label}</span></div>
          <div className={styles.versionMeta}><span>{row.lines?.length || 0} líneas</span><span>{row.currency}</span><span>Revisión {row.revision}</span>{row.baseVersion && <span>Base v{row.baseVersion}</span>}</div>
          <p className={styles.versionAmount}>{formatMoney(total, row.currency)}</p></div>
          {canManage && row.status === 'DRAFT' && <button disabled={busy} onClick={() => activate(row)}>Activar versión</button>}
        </li>;
      })}</ol>}
    </section>

    {canManage && <section className={styles.panel} aria-labelledby="budget-draft-title">
      <div className={styles.panelHeader}><div><h2 id="budget-draft-title">Nuevo borrador</h2><p>Prepará una versión nueva sin reemplazar la vigente hasta su activación explícita.</p></div>
        <button type="button" aria-expanded={draftOpen} onClick={() => setDraftOpen(value => !value)}>{draftOpen ? 'Ocultar formulario' : 'Preparar versión'}</button></div>
      {draftOpen && <form className={styles.form} onSubmit={create}>
        <div className={styles.formTop}><label>Moneda<input required value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} maxLength={3} aria-label="Moneda"/></label>
          <p className={styles.footnote}>La moneda pertenece a la versión. Los movimientos financieros se presentan separados por moneda.</p></div>
        <table className={styles.lineTable}><thead><tr><th>Código</th><th>Descripción</th><th>Monto</th></tr></thead><tbody>{lines.map((line,index) => <tr key={index}>
          <td><input aria-label={'Código línea ' + (index + 1)} required value={line.costCode} onChange={event => updateLine(index,'costCode',event.target.value)} placeholder="MAT-01"/></td>
          <td><input aria-label={'Descripción línea ' + (index + 1)} required value={line.description} onChange={event => updateLine(index,'description',event.target.value)} placeholder="Materiales"/></td>
          <td><input aria-label={'Monto línea ' + (index + 1)} required type="number" min="0" step="0.01" value={line.amount} onChange={event => updateLine(index,'amount',event.target.value)} placeholder="0,00"/></td>
        </tr>)}</tbody></table>
        <div className={styles.lineControls}><button className={styles.secondaryButton} type="button" onClick={() => setLines(current => [...current,{...emptyLine}])}>Agregar línea</button>
          {lines.length > 1 && <button className={styles.secondaryButton} type="button" onClick={() => setLines(current => current.slice(0,-1))}>Quitar última</button>}</div>
        <div className={styles.formActions}><button disabled={busy} type="submit">{busy ? 'Guardando…' : 'Crear borrador'}</button></div>
      </form>}
    </section>}
  </main>;
}
