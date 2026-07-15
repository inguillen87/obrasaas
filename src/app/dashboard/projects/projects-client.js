'use client';

import { useMemo, useState } from 'react';

import styles from './projects.module.css';

const STATUS_LABELS = {
  PLANNING: 'Planificación',
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  COMPLETED: 'Finalizada',
  ARCHIVED: 'Archivada',
};

function formatDate(value, timezone) {
  if (!value) return 'Sin actividad todavía';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(new Date(value));
}

function emptyForm() {
  return {
    name: '',
    address: '',
    startsAt: '',
    endsAt: '',
    geofenceMeters: 100,
  };
}

async function responseBody(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'La operación no pudo completarse.');
  return body;
}

function ProjectCard({ active, busy, onSelect, project, timezone }) {
  const selectable = project.status !== 'ARCHIVED';
  const whatsappReady = project.whatsapp?.status === 'CONNECTED';
  return (
    <article className={`${styles.projectCard} ${active ? styles.currentProject : ''}`}>
      <div className={styles.cardTopline}>
        <span className={`${styles.status} ${styles[`status${project.status}`] || ''}`}>
          <i aria-hidden="true" />{STATUS_LABELS[project.status] || project.status}
        </span>
        {active && <strong>Contexto actual</strong>}
      </div>
      <div className={styles.projectTitle}>
        <span aria-hidden="true">OS</span>
        <div>
          <h2>{project.name}</h2>
          <p>{project.address || 'Dirección pendiente de configurar'}</p>
        </div>
      </div>
      <dl className={styles.metrics}>
        <div><dt>Personal</dt><dd>{project.counts.workers}</dd></div>
        <div><dt>Tareas</dt><dd>{project.counts.tasks}</dd></div>
        <div><dt>Incidencias</dt><dd>{project.counts.incidents}</dd></div>
      </dl>
      <div className={styles.integrationState}>
        <span className={whatsappReady ? styles.connected : styles.pending} aria-hidden="true" />
        <div>
          <strong>{whatsappReady ? 'WhatsApp conectado' : 'WhatsApp pendiente'}</strong>
          <small>
            {whatsappReady
              ? project.whatsapp.verifiedBusinessName || project.whatsapp.displayPhoneNumber || 'Cloud API activa'
              : 'Configuración independiente para esta obra'}
          </small>
        </div>
      </div>
      <footer className={styles.cardFooter}>
        <span>Último movimiento · {formatDate(project.lastActivityAt || project.updatedAt, timezone)}</span>
        <button
          type="button"
          disabled={busy || active || !selectable}
          onClick={() => onSelect(project.id)}
        >
          {active ? 'Abierta' : selectable ? 'Abrir obra' : 'Archivada'}
          {!active && selectable && <span aria-hidden="true">→</span>}
        </button>
      </footer>
    </article>
  );
}

export default function ProjectsClient({
  activeProjectId,
  canManage,
  capacity,
  initialProjects,
  planName,
  timezone,
}) {
  const [projects] = useState(initialProjects);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const summary = useMemo(() => ({
    active: projects.filter((project) => project.status === 'ACTIVE').length,
    connected: projects.filter((project) => project.whatsapp?.status === 'CONNECTED').length,
    total: projects.length,
  }), [projects]);

  async function selectProject(projectId) {
    setBusy(true);
    setError('');
    try {
      await responseBody(await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      }));
      window.location.assign('/dashboard');
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  async function createProject(event) {
    event.preventDefault();
    if (!canManage || !capacity.canCreate) return;
    setBusy(true);
    setError('');
    try {
      await responseBody(await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }));
      window.location.assign('/dashboard');
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  const usage = capacity.limit == null
    ? 18
    : Math.min(100, Math.round((capacity.used / Math.max(1, capacity.limit)) * 100));

  return (
    <>
      <section className={styles.summaryGrid} aria-label="Resumen del portfolio">
        <article><span>Portfolio</span><strong>{summary.total}</strong><small>obras registradas</small></article>
        <article><span>En ejecución</span><strong>{summary.active}</strong><small>obras activas</small></article>
        <article><span>Canal de campo</span><strong>{summary.connected}</strong><small>WhatsApp conectados</small></article>
        <article className={styles.capacityCard}>
          <div><span>Capacidad {planName}</span><strong>{capacity.limit == null ? 'Sin límite' : `${capacity.used} / ${capacity.limit}`}</strong></div>
          <i aria-hidden="true"><b style={{ width: `${usage}%` }} /></i>
          <small>{capacity.limit == null ? 'Portfolio escalable' : `${capacity.remaining} cupos activos disponibles`}</small>
        </article>
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.workspace}>
        <section className={styles.catalog}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Perímetros separados</p><h2>Obras de la organización</h2></div>
            <p>El selector cambia proyecto, datos y credenciales de integración en una sola operación segura.</p>
          </div>
          <div className={styles.projectGrid}>
            {projects.map((project) => (
              <ProjectCard
                active={project.id === activeProjectId}
                busy={busy}
                key={project.id}
                onSelect={selectProject}
                project={project}
                timezone={timezone}
              />
            ))}
          </div>
        </section>

        <aside className={styles.createPanel}>
          <p className={styles.eyebrow}>Nueva operación</p>
          <h2>Crear una obra</h2>
          <p>Cada obra recibe su propia bitácora, equipo, geocerca, WABA y estado operativo.</p>
          {!canManage ? (
            <div className={styles.limitNotice}>
              <strong>Acceso de consulta</strong>
              <span>Tu rol puede recorrer el portfolio, pero no crear obras.</span>
            </div>
          ) : !capacity.canCreate ? (
            <div className={styles.limitNotice}>
              <strong>Límite del plan alcanzado</strong>
              <span>El plan {planName} admite {capacity.limit} obra activa. No se aplicará ningún cargo automático.</span>
            </div>
          ) : (
            <form onSubmit={createProject} className={styles.createForm}>
              <label>
                <span>Nombre de la obra</span>
                <input name="name" value={form.name} onChange={updateField} minLength={3} maxLength={80} placeholder="Ej. Hospital Regional Norte" required />
              </label>
              <label>
                <span>Dirección</span>
                <input name="address" value={form.address} onChange={updateField} maxLength={180} placeholder="Ciudad, provincia o dirección" />
              </label>
              <div className={styles.formRow}>
                <label><span>Inicio</span><input type="date" name="startsAt" value={form.startsAt} onChange={updateField} /></label>
                <label><span>Final prevista</span><input type="date" name="endsAt" value={form.endsAt} min={form.startsAt || undefined} onChange={updateField} /></label>
              </div>
              <label>
                <span>Radio de geocerca</span>
                <div className={styles.unitInput}><input type="number" name="geofenceMeters" value={form.geofenceMeters} onChange={updateField} min="25" max="5000" step="5" required /><b>metros</b></div>
              </label>
              <button type="submit" disabled={busy}>{busy ? 'Creando perímetro…' : 'Crear y abrir obra'} <span aria-hidden="true">→</span></button>
              <small>No se compra ningún servicio ni dominio al crearla.</small>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
