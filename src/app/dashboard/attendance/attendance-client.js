'use client';

import { useMemo, useRef, useState } from 'react';

import {
  ATTENDANCE_EXCEPTION_TYPES,
  ISO_WEEKDAYS,
  attendanceRows,
  attendanceSummary,
  buildSchedulePublishPayload,
  createAttendanceUiIdempotencyKey,
  createScheduleDraft,
  openAttendanceAlerts,
} from '@/lib/attendance-dashboard';

import styles from './attendance.module.css';

const CLASSIFICATION_TONE = Object.freeze({
  PRESENT: 'good',
  LATE: 'warn',
  NO_SHOW: 'danger',
  ABSENT: 'danger',
  REVIEW_REQUIRED: 'danger',
  PENDING_GPS: 'warn',
  PENDING_CLOSE: 'warn',
  EXCUSED: 'neutral',
});

const EVENT_LABELS = Object.freeze({
  CHECK_IN: 'Ingreso',
  BREAK_START: 'Inicio de pausa',
  BREAK_END: 'Fin de pausa',
  CHECK_OUT: 'Salida',
});

async function requestJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }
  const response = await fetch(url, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}

function Metric({ label, value, tone = '' }) {
  const className = [styles.metric, tone ? styles[tone] : ''].filter(Boolean).join(' ');
  return <article className={className}><span>{label}</span><strong>{value}</strong></article>;
}

function formatTime(value, timezone) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone || undefined,
  }).format(parsed);
}

function formatDuration(minutes) {
  const value = Number(minutes) || 0;
  if (value <= 0) return '—';
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function rowObservation(row) {
  if (row.pendingGps) return 'Ubicación pendiente de validación';
  if (row.reviewRequired) return 'Requiere revisión humana';
  if (row.exception) return row.exception.type === 'OFFSITE_WORK'
    ? 'Trabajo fuera de obra autorizado'
    : 'Excepción vigente';
  if (row.missingCheckout) return 'Falta registrar la salida';
  if (row.delayMinutes > 0) return `${row.delayMinutes} min de demora`;
  return 'Sin observaciones';
}

function scheduleSummary(version) {
  if (!version) return 'Sin versión publicada';
  const workingDays = (version.days || []).filter((day) => day.isWorkingDay).length;
  return `${workingDays} días laborables · ${version.lateToleranceMinutes} min de tolerancia`;
}

function ScheduleEditor({ draft, workers, busy, onChange, onCancel, onPublish }) {
  function patch(fields) {
    onChange((current) => ({ ...current, ...fields }));
  }

  function patchDay(index, fields) {
    onChange((current) => ({
      ...current,
      days: current.days.map((day, dayIndex) => (
        dayIndex === index ? { ...day, ...fields } : day
      )),
    }));
  }

  function toggleWorker(workerId) {
    onChange((current) => {
      const selected = new Set(current.workerIds);
      if (selected.has(workerId)) selected.delete(workerId);
      else selected.add(workerId);
      return { ...current, workerIds: [...selected].sort() };
    });
  }

  return (
    <form className={styles.editor} onSubmit={onPublish}>
      <div className={styles.editorHeading}>
        <div>
          <span className={styles.kicker}>{draft.scheduleId ? 'Nueva versión' : 'Nuevo horario'}</span>
          <h3>{draft.scheduleId ? 'Publicar cambios sin reescribir el pasado' : 'Definir la obligación horaria'}</h3>
        </div>
        <button type="button" className={styles.iconButton} onClick={onCancel} aria-label="Cerrar editor">×</button>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>Nombre
          <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} maxLength={120} required />
        </label>
        <label className={styles.field}>Vigente desde
          <input type="date" value={draft.effectiveFrom} onChange={(event) => patch({ effectiveFrom: event.target.value })} required />
        </label>
        <label className={styles.field}>Zona horaria
          <input value={draft.timezone} onChange={(event) => patch({ timezone: event.target.value })} maxLength={64} required />
        </label>
      </div>

      <div className={styles.policyGrid}>
        <label className={styles.field}>Ingreso anticipado
          <span><input type="number" min="0" max="720" value={draft.earlyCheckInMinutes} onChange={(event) => patch({ earlyCheckInMinutes: event.target.value })} /> min</span>
        </label>
        <label className={styles.field}>Tolerancia
          <span><input type="number" min="0" max="240" value={draft.lateToleranceMinutes} onChange={(event) => patch({ lateToleranceMinutes: event.target.value })} /> min</span>
        </label>
        <label className={styles.field}>Sin ingreso a los
          <span><input type="number" min={draft.lateToleranceMinutes || 0} max="1440" value={draft.noShowAfterMinutes} onChange={(event) => patch({ noShowAfterMinutes: event.target.value })} /> min</span>
        </label>
        <label className={styles.field}>Salida pendiente a los
          <span><input type="number" min="0" max="1440" value={draft.pendingCloseAfterMinutes} onChange={(event) => patch({ pendingCloseAfterMinutes: event.target.value })} /> min</span>
        </label>
        <label className={styles.field}>Ausencia definitiva a los
          <span><input type="number" min={draft.pendingCloseAfterMinutes || 0} max="2880" value={draft.absenceFinalizeAfterMinutes} onChange={(event) => patch({ absenceFinalizeAfterMinutes: event.target.value })} /> min</span>
        </label>
        <label className={styles.field}>Cómputo de tardanza
          <select value={draft.latePolicy} onChange={(event) => patch({ latePolicy: event.target.value })}>
            <option value="FULL_FROM_SCHEDULE">Desde el horario previsto</option>
            <option value="EXCLUDE_GRACE">Desde el fin de tolerancia</option>
          </select>
        </label>
      </div>

      <fieldset className={styles.weekEditor}>
        <legend>Semana laboral</legend>
        <div className={styles.weekHeader} aria-hidden="true">
          <span>Día</span><span>Trabaja</span><span>Ingreso</span><span>Salida</span><span>Día sig.</span><span>Pausa</span>
        </div>
        {draft.days.map((day, index) => (
          <div className={styles.weekRow} key={day.isoWeekday}>
            <strong>{ISO_WEEKDAYS[index].short}</strong>
            <label className={styles.switchLabel}>
              <input type="checkbox" checked={day.isWorkingDay} onChange={(event) => patchDay(index, {
                isWorkingDay: event.target.checked,
                expectedBreakMinutes: event.target.checked ? (day.expectedBreakMinutes || 60) : 0,
              })} />
              <span>{day.isWorkingDay ? 'Sí' : 'No'}</span>
            </label>
            <input aria-label={`Ingreso ${ISO_WEEKDAYS[index].label}`} type="time" value={day.startTime} disabled={!day.isWorkingDay} onChange={(event) => patchDay(index, { startTime: event.target.value })} />
            <input aria-label={`Salida ${ISO_WEEKDAYS[index].label}`} type="time" value={day.endTime} disabled={!day.isWorkingDay} onChange={(event) => patchDay(index, { endTime: event.target.value })} />
            <label className={styles.switchLabel}>
              <input type="checkbox" checked={day.endDayOffset === 1} disabled={!day.isWorkingDay} onChange={(event) => patchDay(index, { endDayOffset: event.target.checked ? 1 : 0 })} />
              <span>{day.endDayOffset === 1 ? 'Sí' : 'No'}</span>
            </label>
            <span className={styles.minuteInput}><input aria-label={`Pausa ${ISO_WEEKDAYS[index].label}`} type="number" min="0" max="720" value={day.expectedBreakMinutes} disabled={!day.isWorkingDay} onChange={(event) => patchDay(index, { expectedBreakMinutes: event.target.value })} /> min</span>
          </div>
        ))}
      </fieldset>

      <fieldset className={styles.workerPicker}>
        <legend>Personas asignadas</legend>
        <p>La nueva versión cierra las asignaciones anteriores desde su fecha de vigencia.</p>
        <div>
          {workers.length === 0 ? <span className={styles.empty}>No hay operarios activos en esta obra.</span> : workers.map((worker) => (
            <label key={worker.workerId} className={draft.workerIds.includes(worker.workerId) ? styles.workerSelected : ''}>
              <input type="checkbox" checked={draft.workerIds.includes(worker.workerId)} onChange={() => toggleWorker(worker.workerId)} />
              <span><strong>{worker.name}</strong><small>{worker.role || 'Sin rol informado'}</small></span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.editorFooter}>
        <p><strong>{draft.workerIds.length}</strong> personas · vigencia {draft.effectiveFrom}</p>
        <div>
          <button type="button" className={`${styles.button} ${styles.quiet}`} onClick={onCancel}>Cancelar</button>
          <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy === 'schedule'}>
            {busy === 'schedule' ? 'Publicando…' : 'Publicar versión'}
          </button>
        </div>
      </div>
    </form>
  );
}

function ExceptionEditor({ editor, busy, onChange, onCancel, onSubmit }) {
  return (
    <form className={styles.exceptionEditor} onSubmit={onSubmit}>
      <div className={styles.editorHeading}>
        <div><span className={styles.kicker}>Excepción fechada</span><h3>{editor.workerName}</h3></div>
        <button type="button" className={styles.iconButton} onClick={onCancel} aria-label="Cerrar editor">×</button>
      </div>
      <p>Aplica únicamente al <strong>{editor.workDate}</strong> y queda registrada en auditoría.</p>
      <label className={styles.field}>Tipo
        <select value={editor.type} onChange={(event) => onChange((current) => ({ ...current, type: event.target.value }))}>
          {ATTENDANCE_EXCEPTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </label>
      <label className={styles.field}>Nota administrativa
        <textarea value={editor.note} onChange={(event) => onChange((current) => ({ ...current, note: event.target.value }))} maxLength={280} placeholder="Motivo o referencia del respaldo (opcional)" />
      </label>
      <div className={styles.editorFooter}>
        {editor.active ? (
          <button type="button" className={`${styles.button} ${styles.danger}`} disabled={busy === 'exception'} onClick={() => onSubmit(null, 'CANCEL')}>Cancelar excepción vigente</button>
        ) : <span />}
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy === 'exception'}>
          {busy === 'exception' ? 'Guardando…' : editor.active ? 'Actualizar excepción' : 'Guardar excepción'}
        </button>
      </div>
    </form>
  );
}

export default function AttendanceClient({
  currentUserId,
  initialControl,
  initialCorrections,
  initialScheduleAssignments,
}) {
  const [control, setControl] = useState(initialControl);
  const [corrections, setCorrections] = useState(initialCorrections.corrections || []);
  const [scheduleAssignments, setScheduleAssignments] = useState(initialScheduleAssignments || {});
  const [notice, setNotice] = useState(null);
  const [noticeTone, setNoticeTone] = useState('success');
  const [busy, setBusy] = useState(null);
  const [tab, setTab] = useState('today');
  const [decisionNote, setDecisionNote] = useState({});
  const [scheduleDraft, setScheduleDraft] = useState(null);
  const [exceptionEditor, setExceptionEditor] = useState(null);
  const attemptsRef = useRef(new Map());

  const rows = useMemo(() => attendanceRows(control), [control]);
  const summary = useMemo(() => attendanceSummary(control), [control]);
  const alerts = useMemo(() => openAttendanceAlerts(rows), [rows]);
  const schedules = control.schedules || [];

  function showNotice(message, tone = 'success') {
    setNotice(message);
    setNoticeTone(tone);
  }

  function replaySafeKey(scope, payload) {
    const fingerprint = JSON.stringify(payload);
    const existing = attemptsRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const attempt = { fingerprint, key: createAttendanceUiIdempotencyKey() };
    attemptsRef.current.set(scope, attempt);
    return attempt.key;
  }

  async function reloadControl(workDate = control.workDate) {
    const next = await requestJson(`/api/attendance/control?workDate=${encodeURIComponent(workDate)}`);
    setControl(next);
    return next;
  }

  async function changeWorkDate(workDate) {
    setBusy('date');
    try {
      await reloadControl(workDate);
      setExceptionEditor(null);
    } catch (error) {
      showNotice(error.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function acknowledge(alert) {
    setBusy(`alert:${alert.id}`);
    try {
      await requestJson(`/api/attendance/alerts/${encodeURIComponent(alert.id)}/acknowledge`, {
        method: 'POST',
      });
      await reloadControl(control.workDate);
      showNotice('Alerta reconocida. Seguirá visible hasta que la condición se resuelva.');
    } catch (error) {
      showNotice(error.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function decide(correction, decision) {
    const note = decisionNote[correction.id]?.trim() || undefined;
    const payload = {
      decision,
      reasonCode: decision === 'APPROVED' ? 'ADMIN_APPROVED' : 'ADMIN_REJECTED',
      ...(note ? { note } : {}),
    };
    const scope = `decision:${correction.id}:${decision}`;
    setBusy(scope);
    try {
      await requestJson(`/api/attendance/corrections/${encodeURIComponent(correction.id)}/decision`, {
        method: 'POST',
        headers: { 'Idempotency-Key': replaySafeKey(scope, payload) },
        body: JSON.stringify(payload),
      });
      attemptsRef.current.delete(scope);
      setCorrections((current) => current.filter((item) => item.id !== correction.id));
      await reloadControl(control.workDate);
      showNotice(decision === 'APPROVED' ? 'Corrección aprobada y versionada.' : 'Corrección rechazada.');
    } catch (error) {
      showNotice(error.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  function editSchedule(schedule = null) {
    setScheduleDraft(createScheduleDraft({
      schedule,
      assignedWorkerIds: schedule ? (scheduleAssignments[schedule.id] || []) : [],
      workDate: control.workDate,
      timezone: control.timezone,
    }));
  }

  async function publishSchedule(event) {
    event.preventDefault();
    let payload;
    try {
      payload = buildSchedulePublishPayload(scheduleDraft);
    } catch (error) {
      showNotice(error.message, 'error');
      return;
    }
    const scope = `schedule:${payload.scheduleId || payload.name}`;
    setBusy('schedule');
    try {
      const result = await requestJson('/api/attendance/schedules', {
        method: 'POST',
        headers: { 'Idempotency-Key': replaySafeKey(scope, payload) },
        body: JSON.stringify(payload),
      });
      attemptsRef.current.delete(scope);
      setControl((current) => ({
        ...current,
        schedules: [
          result.schedule,
          ...(current.schedules || []).filter((item) => item.id !== result.schedule.id),
        ],
      }));
      setScheduleAssignments((current) => ({
        ...current,
        [result.schedule.id]: result.assignedWorkerIds || [],
      }));
      setScheduleDraft(null);
      showNotice(result.replayed
        ? 'La versión ya estaba publicada; no se creó un duplicado.'
        : 'Horario publicado y asignaciones versionadas.');
    } catch (error) {
      showNotice(error.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  function editException(row) {
    setExceptionEditor({
      workerId: row.workerId,
      workerName: row.name,
      workDate: control.workDate,
      expectedRevision: row.exception?.revision || 0,
      active: Boolean(row.exception),
      type: row.exception?.type || 'EXCUSED_ABSENCE',
      note: '',
    });
  }

  async function submitException(event, explicitAction = 'SET') {
    event?.preventDefault?.();
    const action = explicitAction;
    const payload = {
      workerId: exceptionEditor.workerId,
      workDate: exceptionEditor.workDate,
      expectedRevision: exceptionEditor.expectedRevision,
      action,
      reasonCode: action === 'SET' ? 'ADMIN_EXCEPTION' : 'ADMIN_EXCEPTION_CANCELLED',
      ...(action === 'SET' ? { type: exceptionEditor.type } : {}),
      ...(exceptionEditor.note.trim() ? { note: exceptionEditor.note.trim() } : {}),
    };
    const scope = `exception:${payload.workerId}:${payload.workDate}:${action}`;
    setBusy('exception');
    try {
      const result = await requestJson('/api/attendance/exceptions', {
        method: 'POST',
        headers: { 'Idempotency-Key': replaySafeKey(scope, payload) },
        body: JSON.stringify(payload),
      });
      attemptsRef.current.delete(scope);
      await reloadControl(control.workDate);
      setExceptionEditor(null);
      showNotice(result.replayed
        ? 'La excepción ya estaba registrada; no se duplicó.'
        : action === 'SET' ? 'Excepción guardada y expectativa recalculada.' : 'Excepción cancelada.');
    } catch (error) {
      showNotice(error.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.attendanceContent} aria-live="polite">
      {notice && (
        <div className={`${styles.notice} ${noticeTone === 'error' ? styles.noticeError : ''}`} role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button>
        </div>
      )}
      <nav className={styles.tabs} aria-label="Secciones de asistencia">
        {[
          ['today', 'Control diario'],
          ['schedules', 'Horarios'],
          ['corrections', `Correcciones (${corrections.length})`],
        ].map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? styles.active : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

      {tab === 'today' && (
        <>
          <div className={styles.dayToolbar}>
            <div><span className={styles.kicker}>Fecha operativa</span><strong>{control.project?.name}</strong></div>
            <label>Jornada
              <input type="date" value={control.workDate} disabled={busy === 'date'} onChange={(event) => void changeWorkDate(event.target.value)} />
            </label>
          </div>
          <div className={styles.metrics}>
            <Metric label="Presentes" value={summary.present} tone="good" />
            <Metric label="Tardanzas" value={summary.late} tone="warn" />
            <Metric label="Sin ingreso" value={summary.noShow} tone="danger" />
            <Metric label="Ausentes" value={summary.absent} tone="danger" />
            <Metric label="Salidas pendientes" value={summary.pendingClose} tone="warn" />
            <Metric label="Revisión requerida" value={summary.reviewRequired} />
          </div>
          <div className={styles.panelGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div><span className={styles.kicker}>Registro operativo</span><h2>Jornada del {control.workDate}</h2></div>
                <span className={styles.datePill}>{rows.length} personas</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Persona</th><th>Estado</th><th>Ingreso</th><th>Salida</th><th>Trabajado</th><th>Observación</th><th /></tr></thead>
                  <tbody>
                    {rows.length === 0 ? <tr><td colSpan="7" className={styles.empty}>No hay operarios activos para esta fecha.</td></tr> : rows.map((row) => {
                      const tone = CLASSIFICATION_TONE[row.classification];
                      return (
                        <tr key={row.workerId}>
                          <td><strong>{row.name}</strong><small>{row.role || 'Sin rol informado'}</small></td>
                          <td><span className={`${styles.status} ${tone ? styles[`status${tone[0].toUpperCase()}${tone.slice(1)}`] : ''}`}>{row.classificationLabel}</span></td>
                          <td>{formatTime(row.checkInAt, control.timezone)}</td>
                          <td>{formatTime(row.checkOutAt, control.timezone)}</td>
                          <td>{formatDuration(row.workedDurationMinutes)}</td>
                          <td>{rowObservation(row)}</td>
                          <td>{control.permissions?.canManageExceptions && <button type="button" className={styles.inlineButton} onClick={() => editException(row)}>{row.exception ? 'Editar excepción' : 'Justificar'}</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div><span className={styles.kicker}>Acción requerida</span><h2>Alertas abiertas</h2></div>
                <span className={styles.countBadge}>{alerts.length}</span>
              </div>
              {alerts.length === 0 ? <p className={styles.empty}>No hay alertas abiertas. El sistema no inventa salidas ni ausencias.</p> : (
                <ul className={styles.alertList}>{alerts.map((alert) => (
                  <li key={alert.id}>
                    <div><strong>{alert.title}</strong><p>{alert.workerName} · abierta {formatTime(alert.openedAt, control.timezone)}</p>{alert.acknowledged && <span className={styles.acknowledged}>Reconocida, pendiente de resolución</span>}</div>
                    {control.permissions?.canAcknowledgeAlerts && !alert.acknowledged && (
                      <button type="button" className={`${styles.button} ${styles.quiet}`} disabled={busy === `alert:${alert.id}`} onClick={() => void acknowledge(alert)}>{busy === `alert:${alert.id}` ? '…' : 'Reconocer'}</button>
                    )}
                  </li>
                ))}</ul>
              )}
            </section>
          </div>
          {exceptionEditor && (
            <ExceptionEditor editor={exceptionEditor} busy={busy} onChange={setExceptionEditor} onCancel={() => setExceptionEditor(null)} onSubmit={submitException} />
          )}
        </>
      )}

      {tab === 'schedules' && (
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.kicker}>Reglas versionadas</span><h2>Horarios y asignaciones</h2></div>
            {control.permissions?.canManageSchedules && !scheduleDraft && <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => editSchedule()}>Nuevo horario</button>}
          </div>
          <p className={styles.muted}>Cada publicación tiene vigencia, tolerancias y zona horaria propias. Una modificación crea una versión nueva y conserva el pasado.</p>
          <div className={styles.scheduleGrid}>
            {schedules.length === 0 ? <p className={styles.empty}>No hay horarios publicados para esta obra.</p> : schedules.map((schedule) => {
              const version = schedule.versions?.[0];
              return (
                <article className={styles.scheduleCard} key={schedule.id}>
                  <div><strong>{schedule.name}</strong><span>Revisión {schedule.revision}</span></div>
                  <small>Vigente desde {version?.effectiveFrom || '—'} · {version?.timezone || control.timezone}</small>
                  <p>{scheduleSummary(version)}</p>
                  <footer><span>{(scheduleAssignments[schedule.id] || []).length} personas asignadas</span>{control.permissions?.canManageSchedules && <button type="button" className={styles.inlineButton} onClick={() => editSchedule(schedule)}>Publicar cambios</button>}</footer>
                </article>
              );
            })}
          </div>
          {scheduleDraft && (
            <ScheduleEditor draft={scheduleDraft} workers={rows} busy={busy} onChange={setScheduleDraft} onCancel={() => setScheduleDraft(null)} onPublish={publishSchedule} />
          )}
        </section>
      )}

      {tab === 'corrections' && (
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.kicker}>Doble control</span><h2>Correcciones pendientes</h2></div>
            <span className={styles.countBadge}>{corrections.length}</span>
          </div>
          {corrections.length === 0 ? <p className={styles.empty}>No hay correcciones esperando decisión.</p> : (
            <div className={styles.correctionList}>{corrections.map((correction) => {
              const requestedByCurrentUser = correction.requestedBy?.type === 'PLATFORM_USER'
                && correction.requestedBy.id === currentUserId;
              return (
                <article className={styles.correctionCard} key={correction.id}>
                  <div className={styles.correctionHeading}>
                    <div><strong>{correction.worker?.name || 'Persona'}</strong><span>{correction.shift?.workDate || 'Fecha no disponible'} · motivo {correction.reasonCode}</span></div>
                    <span className={styles.datePill}>Vence {formatTime(correction.expiresAt, control.timezone)}</span>
                  </div>
                  <ol className={styles.eventTimeline}>{(correction.proposedEvents || []).map((event) => (
                    <li key={event.logicalId}><span>{EVENT_LABELS[event.eventType] || event.eventType}</span><strong>{formatTime(event.occurredAt, control.timezone)}</strong></li>
                  ))}</ol>
                  {requestedByCurrentUser && <p className={styles.controlWarning}>Doble control: quien solicitó esta corrección no puede decidirla.</p>}
                  <label className={styles.field}>Nota de decisión (opcional)
                    <textarea value={decisionNote[correction.id] || ''} onChange={(event) => setDecisionNote((current) => ({ ...current, [correction.id]: event.target.value }))} maxLength={280} />
                  </label>
                  <div className={styles.actions}>
                    {initialCorrections.permissions?.canApprove && (
                      <>
                        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={Boolean(busy) || requestedByCurrentUser} onClick={() => void decide(correction, 'APPROVED')}>Aprobar</button>
                        <button type="button" className={`${styles.button} ${styles.danger}`} disabled={Boolean(busy) || requestedByCurrentUser} onClick={() => void decide(correction, 'REJECTED')}>Rechazar</button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}</div>
          )}
        </section>
      )}
    </section>
  );
}
