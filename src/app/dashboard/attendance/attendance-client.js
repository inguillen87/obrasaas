'use client';

import { useMemo, useState } from 'react';

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}

function Metric({ label, value, tone = '' }) {
  return <article className={`${tone ? `metric ${tone}` : 'metric'}`}><span>{label}</span><strong>{value}</strong></article>;
}

function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function AttendanceClient({
  initialControl,
  initialCorrections,
  initialScheduleAssignments,
}) {
  const [control, setControl] = useState(initialControl);
  const [corrections, setCorrections] = useState(initialCorrections.corrections || []);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [tab, setTab] = useState('today');
  const [decisionNote, setDecisionNote] = useState({});

  const kpis = useMemo(() => control.kpis || {}, [control.kpis]);
  const alerts = control.alerts || [];
  const rows = control.rows || control.people || [];
  const schedules = control.schedules || [];

  async function acknowledge(alert) {
    setBusy(alert.id);
    try {
      await requestJson(`/api/attendance/alerts/${encodeURIComponent(alert.id)}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ eventId: alert.openedEventId }),
      });
      setControl((current) => ({ ...current, alerts: current.alerts.filter((item) => item.id !== alert.id) }));
      setNotice('Alerta reconocida y registrada en la bitácora.');
    } catch (error) { setNotice(error.message); } finally { setBusy(null); }
  }

  async function decide(correction, decision) {
    setBusy(correction.id);
    try {
      await requestJson(`/api/attendance/corrections/${encodeURIComponent(correction.id)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, note: decisionNote[correction.id] || undefined }),
      });
      setCorrections((current) => current.filter((item) => item.id !== correction.id));
      setNotice(decision === 'APPROVED' ? 'Corrección aprobada y versionada.' : 'Corrección rechazada.');
    } catch (error) { setNotice(error.message); } finally { setBusy(null); }
  }

  return (
    <section className="attendance-content" aria-live="polite">
      {notice && <div className="notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button></div>}
      <nav className="tabs" aria-label="Secciones de asistencia">
        {[['today', 'Hoy'], ['schedules', 'Horarios'], ['corrections', `Correcciones (${corrections.length})`]].map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

      {tab === 'today' && (
        <>
          <div className="metrics">
            <Metric label="Presentes" value={kpis.present ?? kpis.presentCount ?? 0} tone="good" />
            <Metric label="Tardanzas" value={kpis.late ?? kpis.lateCount ?? 0} tone="warn" />
            <Metric label="Sin ingreso" value={kpis.noShow ?? kpis.noShowCount ?? 0} tone="danger" />
            <Metric label="Pendientes de cierre" value={kpis.pendingClose ?? kpis.pendingCloseCount ?? 0} />
          </div>
          <div className="panel-grid">
            <section className="panel"><div className="panel-heading"><div><span className="kicker">Registro operativo</span><h2>Jornada de hoy</h2></div><span className="date-pill">{control.workDate}</span></div>
              <div className="table-wrap"><table><thead><tr><th>Persona</th><th>Estado</th><th>Ingreso</th><th>Salida</th><th>Observación</th></tr></thead><tbody>
                {rows.length === 0 ? <tr><td colSpan="5" className="empty">Todavía no hay registros para esta fecha.</td></tr> : rows.map((row) => <tr key={row.workerId || row.id}><td><strong>{row.name || row.worker?.name || 'Sin nombre'}</strong><small>{row.role || row.worker?.role || '—'}</small></td><td><span className={`status status-${String(row.status || 'pending').toLowerCase().replaceAll(' ', '-')}`}>{row.status || 'Pendiente'}</span></td><td>{row.checkin || formatTime(row.checkInAt)}</td><td>{row.checkout || formatTime(row.checkOutAt)}</td><td>{row.observation || row.note || '—'}</td></tr>)}
              </tbody></table></div>
            </section>
            <section className="panel"><div className="panel-heading"><div><span className="kicker">Acción requerida</span><h2>Alertas</h2></div><span className="count-badge">{alerts.length}</span></div>
              {alerts.length === 0 ? <p className="empty">No hay alertas abiertas. El sistema no inventa salidas ni ausencias.</p> : <ul className="alert-list">{alerts.map((alert) => <li key={alert.id}><div><strong>{alert.title || alert.type}</strong><p>{alert.message || alert.description || 'Revisar jornada.'}</p></div>{control.permissions?.canAcknowledgeAlerts && <button type="button" className="button quiet" disabled={busy === alert.id} onClick={() => acknowledge(alert)}>{busy === alert.id ? '…' : 'Reconocer'}</button>}</li>)}</ul>}
            </section>
          </div>
        </>
      )}

      {tab === 'schedules' && <section className="panel"><div className="panel-heading"><div><span className="kicker">Reglas versionadas</span><h2>Horarios y asignaciones</h2></div></div><p className="muted">Cada versión tiene vigencia, tolerancias y zona horaria propias. Publicar una modificación no reescribe el pasado.</p><div className="schedule-grid">{schedules.length === 0 ? <p className="empty">No hay horarios publicados para esta obra.</p> : schedules.map((schedule) => <article className="schedule-card" key={schedule.id}><div><strong>{schedule.name}</strong><span>{schedule.status} · revisión {schedule.revision}</span></div><small>{schedule.versions?.[0]?.effectiveFrom || 'Sin vigencia'} · {schedule.versions?.[0]?.timezone || control.timezone}</small><p>{(initialScheduleAssignments?.[schedule.id] || []).length} personas asignadas</p></article>)}</div></section>}

      {tab === 'corrections' && <section className="panel"><div className="panel-heading"><div><span className="kicker">Doble control</span><h2>Correcciones pendientes</h2></div><span className="count-badge">{corrections.length}</span></div>{corrections.length === 0 ? <p className="empty">No hay correcciones esperando decisión.</p> : <div className="correction-list">{corrections.map((correction) => <article className="correction-card" key={correction.id}><div><strong>{correction.worker?.name || 'Persona'}</strong><span>{correction.shift?.workDate || 'Fecha no disponible'} · vence {formatTime(correction.expiresAt)}</span></div><pre>{JSON.stringify(correction.effectiveEvents || correction.proposedEvents || [], null, 2)}</pre><label>Nota de decisión (opcional)<textarea value={decisionNote[correction.id] || ''} onChange={(event) => setDecisionNote((current) => ({ ...current, [correction.id]: event.target.value }))} maxLength={1000} /></label><div className="actions">{initialCorrections.permissions?.canApprove && <><button type="button" className="button primary" disabled={busy === correction.id} onClick={() => decide(correction, 'APPROVED')}>Aprobar</button><button type="button" className="button danger" disabled={busy === correction.id} onClick={() => decide(correction, 'REJECTED')}>Rechazar</button></>}</div></article>)}</div>}</section>}
    </section>
  );
}
