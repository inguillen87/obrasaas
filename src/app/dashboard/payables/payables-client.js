'use client';

import { useState } from 'react';
import styles from '../extra-work/extra-work.module.css';

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}

export default function PayablesClient({ initialInvoices, suppliers, projectName }) {
  const [rows, setRows] = useState(initialInvoices);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ supplierId: suppliers[0]?.id || '', invoiceNumber: '', amount: '', currency: 'ARS', dueAt: '' });

  async function create(event) {
    event.preventDefault(); setBusy(true);
    try {
      let receipt;
      if (file) {
        const body = new FormData(); body.append('file', file);
        const upload = await fetch('/api/supplier-invoices/evidence', { method: 'POST', body });
        const result = await upload.json().catch(() => ({}));
        if (!upload.ok) throw new Error(result.error || 'No se pudo cargar el comprobante.');
        receipt = result.receipt;
      }
      const result = await api('/api/supplier-invoices', { method: 'POST', body: JSON.stringify({ ...form, amount: Number(form.amount), operationKey: crypto.randomUUID(), dueAt: form.dueAt || undefined, receipt }) });
      setRows((current) => [result.invoice, ...current]); setFile(null); setForm({ ...form, invoiceNumber: '', amount: '', dueAt: '' }); setNotice('Factura registrada.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }

  async function decide(row, status) {
    setBusy(true); try { const result = await api('/api/supplier-invoices', { method: 'PATCH', body: JSON.stringify({ id: row.id, expectedRevision: row.revision, status }) }); setRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, ...result } : entry)); setNotice(`Factura: ${result.status}.`); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }

  async function openReceipt(row) { try { const result = await api(`/api/supplier-invoices/${row.id}/receipt`); window.open(result.url, '_blank', 'noopener,noreferrer'); } catch (error) { setNotice(error.message); } }
  async function showMatch(row) { try { const result = await api(`/api/supplier-invoices/${row.id}/match`); setNotice(result.availableValue === null ? result.reason : `Control: recibido ${result.currency} ${result.receivedValue.toFixed(2)}, comprometido ${result.committedValue.toFixed(2)}, disponible ${result.availableValue.toFixed(2)}.`); } catch (error) { setNotice(error.message); } }

  return <main className={styles.shell}><header><span>S10 · cuentas por pagar</span><h1>Facturas de proveedores</h1><p>{projectName} · vencimientos y decisiones auditables.</p></header>{notice && <p className={styles.notice}>{notice}</p>}<section className={styles.panel}><h2>Nueva factura</h2>{suppliers.length === 0 ? <p>Configurá proveedores antes de registrar facturas.</p> : <form onSubmit={create}><select value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.legalName}</option>)}</select><input required value={form.invoiceNumber} onChange={(event) => setForm({ ...form, invoiceNumber: event.target.value })} placeholder="Número de factura" /><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="Importe" /><input type="date" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} /><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /><button disabled={busy}>Registrar factura</button></form>}</section><section className={styles.panel}><h2>Obligaciones</h2><ul>{rows.length === 0 ? <li>No hay facturas registradas.</li> : rows.map((row) => <li key={row.id}><div><strong>{row.invoiceNumber} · {row.supplier?.legalName}</strong><span>{row.status} · {row.currency} {row.amount} · vencimiento {row.dueAt ? row.dueAt.slice(0, 10) : 'sin fecha'}</span></div>{row.purchaseOrderId && <button disabled={busy} onClick={() => showMatch(row)}>Ver control de recepción</button>}{row.receipt && <button disabled={busy} onClick={() => openReceipt(row)}>Ver comprobante</button>}{row.status === 'RECEIVED' && <button disabled={busy} onClick={() => decide(row, 'APPROVED')}>Aprobar</button>}{row.status === 'APPROVED' && <button disabled={busy} onClick={() => decide(row, 'PAID')}>Marcar pagada</button>}{!['PAID', 'VOIDED'].includes(row.status) && <button disabled={busy} onClick={() => decide(row, 'VOIDED')}>Anular</button>}</li>)}</ul></section></main>;
}
