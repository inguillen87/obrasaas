'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FIELD_REPORT_CATEGORIES, normalizeFieldReport } from '@/lib/field-report';
import { publishFieldInvalidation } from '@/lib/schedule-field-channel';
import { tokens } from '@/lib/design-system';
import PwaControls, { useDeviceOnline } from './pwa-controls';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import styles from './field.module.css';
const empty = date => ({ category: 'PROGRESS', title: '', location: '', details: '', workDate: date });
export default function FieldClient({ project, workDate, counts, channel, permissions }) {
  const [draft, setDraft] = useState(() => empty(workDate));
  const [busy, setBusy] = useState(false), [unconfirmed, setUnconfirmed] = useState(false);
  const [error, setError] = useState(''), [saved, setSaved] = useState(null);
  const inFlight = useRef(false), attempt = useRef(null);
  const online = useDeviceOnline();
  const dirty = Boolean(draft.title || draft.location || draft.details);
  useWorkspaceLeaveGuard({ dirty: dirty || unconfirmed, busy, message: 'Hay un parte pendiente de guardar o confirmar. ¿Salir de esta obra o sección?' });
  const category = FIELD_REPORT_CATEGORIES.find(item => item.key === draft.category);
  useEffect(() => {
    const warn = event => { if (dirty || unconfirmed) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, unconfirmed]);
  const field = (key, value) => { setDraft(current => ({ ...current, [key]: value })); setSaved(null); };
  async function save(event) {
    event.preventDefault();
    if (inFlight.current || !permissions.write || !online) return;
    setError('');
    try {
      if (!attempt.current) attempt.current = { input: normalizeFieldReport({ projectId: project.id, ...draft }), key: crypto.randomUUID() };
    } catch (validation) { setError(validation.message); return; }
    inFlight.current = true; setBusy(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/field/reports', { method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key }, body: JSON.stringify(attempt.current.input) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if ([400, 422].includes(response.status)) { attempt.current = null; setUnconfirmed(false); }
        else setUnconfirmed(true);
        throw new Error(result.error || 'No se confirmó el envío. Revisá la sesión y reintentá esta misma solicitud.');
      }
      if (typeof result.report?.id !== 'string' || !result.report.status) throw new Error('Respuesta incompleta. No se confirmó el envío.');
      publishFieldInvalidation({ organizationId: project.organizationId, projectId: project.id });
      setSaved(result.report); setDraft(empty(workDate)); setUnconfirmed(false); attempt.current = null;
    } catch (failure) {
      if (attempt.current) setUnconfirmed(true);
      setError(failure.name === 'AbortError' ? 'La conexión demoró. El parte podría haberse guardado: reintentá la misma solicitud, sin duplicarla.' : failure.message);
    } finally { clearTimeout(timeout); inFlight.current = false; setBusy(false); }
  }
  function guardNavigation(event) {
    if ((dirty || unconfirmed) && !window.confirm('Hay un parte sin confirmar o cambios sin guardar. ¿Salir de esta pantalla?')) event.preventDefault();
  }
  return <div className={styles.shell} style={{ '--field-bg': tokens.colors.bg.primary, '--field-accent': tokens.colors.accent.primary }}>
    <header className={styles.header}>
      <div className={styles.eyebrow}><span className={styles.brandDot} /> OPERACIÓN DE CAMPO <span>{project.organization}</span></div>
      <div className={styles.heroRow}><div><h1>Campo móvil</h1><p className={styles.heroDescription}>Una novedad. Un registro. Seguimiento en la misma obra.</p></div>
        <a className={styles.quickCreate} href="#report-title"><span aria-hidden="true">＋</span> Nuevo parte</a></div>
      <div className={styles.projectPill}><i className="fa-solid fa-building" aria-hidden="true" /><h2>{project.name}</h2><span>{permissions.write ? 'Captura habilitada' : 'Solo lectura'}</span></div>
    </header>
    <PwaControls />
    <nav className={styles.actions} aria-label="Acciones de campo">
      <Link onNavigate={guardNavigation} href="/dashboard/progress#capture-evidence"><strong>{permissions.write ? 'Foto / evidencia' : 'Ver evidencias'}</strong><span>Adjuntar a una tarea de la obra</span></Link>
      <Link onNavigate={guardNavigation} href="/dashboard/inspections"><strong>Inspecciones</strong><span>Controles y revisión técnica</span></Link>
      <Link onNavigate={guardNavigation} href="/dashboard/progress"><strong>Partes y seguimiento</strong><span>Borradores y revisión humana</span></Link>
      {permissions.inbox && <Link onNavigate={guardNavigation} href="/dashboard/inbox"><strong>Bandeja WhatsApp</strong><span>Conversaciones del canal de la obra</span></Link>}
    </nav>
    <section className={styles.card} aria-labelledby="report-title">
      <div className={styles.reportHeading}><div><span className={styles.sectionEyebrow}>REGISTRO ESTRUCTURADO</span><h2 id="report-title" tabIndex={-1}>Nuevo parte de campo</h2></div><span className={styles.draftBadge}>{busy ? 'Guardando' : unconfirmed ? 'Por confirmar' : saved ? 'Guardado' : 'Borrador'}</span></div>
      <ol className={styles.journey} aria-label="Circuito del parte"><li aria-current={!saved ? 'step' : undefined}><span>01</span> Registrar</li><li aria-current={saved ? 'step' : undefined}><span>02</span> Enviar a revisión</li><li><span>03</span> Decisión autorizada</li></ol>
      <p>Se guarda como borrador en la bitácora. No cambia stock, costos ni avance aprobado automáticamente.</p>
      {!permissions.write && <p role="status">Tu acceso o el estado de la obra es de solo lectura. El responsable puede revisar los permisos.</p>}
      {!online && <p className={styles.warning} role="status">Podés redactar en esta pantalla, pero necesitás conexión para guardar. No cierres la pestaña: todavía no hay una cola offline de partes.</p>}
      {saved && <div className={styles.success} role="status"><strong>Guardado confirmado por el servidor</strong><p>{saved.title}</p><Link onNavigate={guardNavigation} href={'/dashboard/progress#daily-log-' + saved.id}>Abrir parte en la bitácora</Link></div>}
      {error && <p className={styles.warning} role="alert">{error}</p>}
      <form onSubmit={save}>
        <fieldset disabled={!permissions.write || busy || unconfirmed} className={styles.fields}>
          <div className={styles.categoryHeader}><strong>¿Qué necesitás informar?</strong><span>Elegí el tipo de novedad</span></div>
          <div className={styles.categoryGrid} role="group" aria-label="Tipo de parte">
            {FIELD_REPORT_CATEGORIES.map((item, index) => <label key={item.key} className={`${styles.category} ${draft.category === item.key ? styles.categorySelected : ''}`}>
              <input type="radio" name="report-category" value={item.key} checked={draft.category === item.key} onChange={() => field('category', item.key)} />
              <i aria-hidden="true" className={['fa-solid fa-arrow-trend-up', 'fa-solid fa-box-open', 'fa-solid fa-triangle-exclamation', 'fa-solid fa-lightbulb'][index]} />
              <span>{item.label}</span><small>{item.help}</small>
            </label>)}
          </div>
          <label>Título<input name="title" value={draft.title} required maxLength={160} placeholder="Ej.: falta cemento para la mampostería" onChange={e => field('title', e.target.value)} /></label>
          <div className={styles.twoColumns}>
            <label>Sector o ubicación<input name="location" value={draft.location} required maxLength={240} placeholder="Ej.: planta baja, sector norte" onChange={e => field('location', e.target.value)} /></label>
            <label>Fecha del parte<input name="workDate" type="date" value={draft.workDate} required onChange={e => field('workDate', e.target.value)} /></label>
          </div>
          <label>Detalle<textarea name="details" value={draft.details} rows={5} required maxLength={2000} aria-describedby="report-privacy" placeholder={category.help} onChange={e => field('details', e.target.value)} /></label>
          <p id="report-privacy" className={styles.hint}>No incluyas documentos de identidad, información médica ni datos bancarios. Informá una urgencia directamente al responsable: este parte no es un canal de emergencias.</p>
        </fieldset>
        {unconfirmed && <p>El contenido queda protegido mientras se verifica el mismo intento. No crees otro parte para reemplazarlo.</p>}
        {permissions.write && <button className={styles.primary} type="submit" disabled={busy || !online}>{busy ? 'Guardando…' : unconfirmed ? 'Reintentar la misma solicitud' : 'Guardar parte en la obra'}</button>}
      </form>
    </section>
    <section className={styles.card} aria-labelledby="pilot-title"><h2 id="pilot-title">Preparación de esta obra</h2>
      <div className={styles.readiness}><p><strong>{counts.workers}</strong> personas activas</p><p><strong>{counts.tasks}</strong> tareas canónicas</p><p><strong>{channel.label}</strong><span>{channel.summary}</span></p></div>
      {counts.workers === 0 && <p>Todavía no hay una cuadrilla activa. Incorporá únicamente personas confirmadas, con sus permisos y obra asignados.</p>}
      {counts.tasks === 0 && <p>Creá una tarea antes de asociar fotos de avance. Un parte de texto puede guardarse sin inventar una tarea.</p>}
      <div className={styles.links}>
        {permissions.tasks && <Link onNavigate={guardNavigation} href="/dashboard?tab=sec-gantt">Preparar tareas</Link>}
        {permissions.write && <Link onNavigate={guardNavigation} href="/dashboard/execution">Cuadrillas y responsables</Link>}
        {permissions.integrations && <Link onNavigate={guardNavigation} href="/dashboard/integrations">Verificar conexión WhatsApp</Link>}
      </div>
      <p className={styles.hint}>Los mensajes entregados desde la consola de Meta no confirman por sí solos que esta obra reciba mensajes. No se envían invitaciones ni mensajes desde esta pantalla.</p>
    </section>
  </div>;
}
