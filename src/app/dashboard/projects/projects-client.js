'use client';

import { useMemo, useRef, useState } from 'react';

import { ObraSaasMark } from '@/app/brand/brand-logo';
import styles from './projects.module.css';

const STATUS_LABELS = {
  PLANNING: 'Planificación',
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  COMPLETED: 'Finalizada',
  ARCHIVED: 'Archivada',
};

const STATUS_OPTIONS = [
  ['PLANNING', 'Planificación'],
  ['ACTIVE', 'Activa'],
  ['PAUSED', 'Pausada'],
  ['COMPLETED', 'Finalizada'],
  ['ARCHIVED', 'Archivada'],
];

const STATUS_HELP = {
  PLANNING: 'Conserva el contexto, pero no recibe acciones del campo.',
  ACTIVE: 'Habilita operaciones de campo, geocerca y eventos de WhatsApp.',
  PAUSED: 'Detiene nuevos reportes de campo; la oficina puede reorganizar sin perder información.',
  COMPLETED: 'Mantiene la obra en solo lectura para consulta y reportes históricos.',
  ARCHIVED: 'La retira de los contextos seleccionables y bloquea nuevos eventos.',
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

function dateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    name: '',
    address: '',
    startsAt: '',
    endsAt: '',
    geofenceMeters: 100,
    latitude: '',
    longitude: '',
    status: 'ACTIVE',
  };
}

function formFromProject(project) {
  return {
    name: project.name || '',
    address: project.address || '',
    startsAt: dateInputValue(project.startsAt),
    endsAt: dateInputValue(project.endsAt),
    geofenceMeters: project.geofenceMeters || 100,
    latitude: project.latitude ?? '',
    longitude: project.longitude ?? '',
    status: project.status,
  };
}

function normalizedFormSnapshot(form) {
  const normalizedNumber = (value) => {
    if (value === '' || value == null) return '';
    const number = Number(value);
    return Number.isFinite(number) ? number : String(value);
  };
  return {
    name: String(form.name || '').trim().replace(/\s+/g, ' '),
    address: String(form.address || '').trim().replace(/\s+/g, ' '),
    startsAt: form.startsAt || '',
    endsAt: form.endsAt || '',
    geofenceMeters: normalizedNumber(form.geofenceMeters),
    latitude: normalizedNumber(form.latitude),
    longitude: normalizedNumber(form.longitude),
    status: form.status || 'ACTIVE',
  };
}

function formsMatch(left, right) {
  return JSON.stringify(normalizedFormSnapshot(left)) === JSON.stringify(normalizedFormSnapshot(right));
}

function mergeProjectDraft(baseline, draft, current) {
  const baselineSnapshot = normalizedFormSnapshot(baseline);
  const draftSnapshot = normalizedFormSnapshot(draft);
  const currentSnapshot = normalizedFormSnapshot(current);
  const merged = { ...current };
  for (const field of Object.keys(currentSnapshot)) {
    if (JSON.stringify(draftSnapshot[field]) !== JSON.stringify(baselineSnapshot[field])) {
      merged[field] = draft[field];
    }
  }
  const serverChangedStatus = currentSnapshot.status !== baselineSnapshot.status;
  if (serverChangedStatus) merged.status = current.status;
  return { merged, serverChangedStatus };
}

function coordinatesReady(form) {
  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  return form.latitude !== ''
    && form.longitude !== ''
    && Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180;
}

function openStreetMapUrl(form) {
  if (!coordinatesReady(form)) return null;
  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;
}

async function responseBody(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'La operación no pudo completarse.');
    error.code = body.code;
    throw error;
  }
  return body;
}

function ProjectCard({
  active,
  busy,
  canManage,
  onEdit,
  onSelect,
  project,
  timezone,
}) {
  const selectable = project.status !== 'ARCHIVED';
  const whatsappChannel = project.whatsapp?.channel || {
    connected: false,
    label: 'WhatsApp por verificar',
    summary: 'Actualizá la obra para confirmar el estado de la cuenta.',
    tone: 'pending',
  };
  const geofenceReady = project.latitude != null && project.longitude != null;
  return (
    <article className={`${styles.projectCard} ${active ? styles.currentProject : ''}`}>
      <div className={styles.cardTopline}>
        <span className={`${styles.status} ${styles[`status${project.status}`] || ''}`}>
          <i aria-hidden="true" />{STATUS_LABELS[project.status] || project.status}
        </span>
        {active && <strong>Contexto actual</strong>}
      </div>
      <div className={styles.projectTitle}>
        <span aria-hidden="true"><ObraSaasMark size={42} /></span>
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
      <div className={styles.signalGrid}>
        <div className={styles.integrationState}>
          <span className={styles[whatsappChannel.tone] || styles.pending} aria-hidden="true" />
          <div>
            <strong>{whatsappChannel.label}</strong>
            <small>
              {whatsappChannel.connected
                ? project.whatsapp?.verifiedBusinessName || project.whatsapp?.displayPhoneNumber || whatsappChannel.summary
                : whatsappChannel.summary}
            </small>
          </div>
        </div>
        <div className={styles.integrationState}>
          <span className={geofenceReady ? styles.connected : styles.pending} aria-hidden="true" />
          <div>
            <strong>{geofenceReady ? `Geocerca · ${project.geofenceMeters} m` : 'Geocerca pendiente'}</strong>
            <small>{geofenceReady ? 'Coordenadas listas para validar asistencia' : 'El GPS falla de forma segura hasta configurarla'}</small>
          </div>
        </div>
      </div>
      <footer className={styles.cardFooter}>
        <span>Último movimiento · {formatDate(project.lastActivityAt || project.updatedAt, timezone)}</span>
        <div className={styles.cardActions}>
          {canManage && (
            <button
              type="button"
              className={styles.secondaryAction}
              disabled={busy}
              onClick={(event) => onEdit(project, event.currentTarget)}
            >
              Gestionar
            </button>
          )}
          <button
            type="button"
            disabled={busy || active || !selectable}
            onClick={() => onSelect(project.id)}
          >
            {active ? 'Contexto actual' : selectable ? 'Abrir obra' : 'Archivada'}
            {!active && selectable && <span aria-hidden="true">→</span>}
          </button>
        </div>
      </footer>
    </article>
  );
}

function ProjectFields({
  disabled,
  form,
  gpsAccuracy,
  geoBusy,
  onClearCoordinates,
  onUseCurrentLocation,
  onUpdate,
  showStatus,
}) {
  const geofenceReady = coordinatesReady(form);
  const mapUrl = openStreetMapUrl(form);
  const geofenceRadius = Number(form.geofenceMeters);
  const accuracyWarning = gpsAccuracy != null
    && gpsAccuracy > (Number.isFinite(geofenceRadius) ? Math.max(30, geofenceRadius) : 30);
  return (
    <>
      {showStatus && (
        <label>
          <span>Estado operativo</span>
          <select
            name="status"
            value={form.status}
            onChange={onUpdate}
            disabled={disabled}
            aria-describedby="project-status-help"
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
          <small className={styles.fieldHint} id="project-status-help">{STATUS_HELP[form.status]}</small>
        </label>
      )}
      <label>
        <span>Nombre de la obra</span>
        <input name="name" value={form.name} onChange={onUpdate} minLength={3} maxLength={80} placeholder="Ej. Hospital Regional Norte" required disabled={disabled} />
      </label>
      <label>
        <span>Dirección</span>
        <input name="address" value={form.address} onChange={onUpdate} maxLength={180} placeholder="Ciudad, provincia o dirección" disabled={disabled} />
      </label>
      <div className={styles.formRow}>
        <label><span>Inicio</span><input type="date" name="startsAt" value={form.startsAt} onChange={onUpdate} disabled={disabled} /></label>
        <label><span>Final prevista</span><input type="date" name="endsAt" value={form.endsAt} min={form.startsAt || undefined} onChange={onUpdate} disabled={disabled} /></label>
      </div>
      <fieldset className={styles.geofenceFields} disabled={disabled}>
        <legend>Ubicación y geocerca</legend>
        <p>Estas coordenadas son la fuente real para asistencia, webviews y controles GPS.</p>
        <div className={styles.formRow}>
          <label>
            <span>Latitud</span>
            <input type="number" name="latitude" value={form.latitude} onChange={onUpdate} min="-90" max="90" step="0.0000001" placeholder="-34.6037000" />
          </label>
          <label>
            <span>Longitud</span>
            <input type="number" name="longitude" value={form.longitude} onChange={onUpdate} min="-180" max="180" step="0.0000001" placeholder="-58.3816000" />
          </label>
        </div>
        <label>
          <span>Radio de geocerca</span>
          <div className={styles.unitInput}>
            <input type="number" name="geofenceMeters" value={form.geofenceMeters} onChange={onUpdate} min="25" max="5000" step="5" required />
            <b>metros</b>
          </div>
        </label>
        <div className={styles.geoActions}>
          <button type="button" className={styles.inlineButton} onClick={onUseCurrentLocation} disabled={disabled || geoBusy}>
            {geoBusy ? 'Leyendo GPS…' : 'Usar ubicación de este dispositivo'}
          </button>
          {(form.latitude !== '' || form.longitude !== '') && (
            <button type="button" className={styles.textButton} onClick={onClearCoordinates} disabled={disabled}>
              Limpiar coordenadas
            </button>
          )}
        </div>
        {gpsAccuracy != null && (
          <p
            className={`${styles.gpsAccuracy} ${accuracyWarning ? styles.gpsAccuracyWarning : styles.gpsAccuracyReady}`}
            role="status"
          >
            <strong>Precisión estimada: ±{Math.ceil(gpsAccuracy)} m.</strong>
            {' '}
            {accuracyWarning
              ? 'La precisión supera el radio configurado. Reintentá al aire libre o verificá el punto en el mapa antes de guardar.'
              : 'La lectura es compatible con el radio configurado; confirmá visualmente el punto antes de guardar.'}
          </p>
        )}
        <div className={`${styles.geoReadiness} ${
          geofenceReady
            ? accuracyWarning ? styles.geoAttention : styles.geoReady
            : styles.geoPending
        }`}>
          <i aria-hidden="true" />
          <div>
            <strong>
              {geofenceReady
                ? accuracyWarning ? 'Geocerca lista, precisión a revisar' : 'Geocerca lista para guardar'
                : 'Geocerca todavía inactiva'}
            </strong>
            <span>
              {geofenceReady
                ? `${Number(form.latitude).toFixed(6)}, ${Number(form.longitude).toFixed(6)} · radio ${form.geofenceMeters} m`
                : 'Cargá ambas coordenadas o dejalas vacías. Nunca se validará presencia con una ubicación parcial.'}
            </span>
          </div>
          {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer">Ver mapa</a>}
        </div>
      </fieldset>
    </>
  );
}

function PanelFeedback({
  busy,
  error,
  errorCode,
  feedbackRef,
  notice,
  onLoadCurrentVersion,
}) {
  if (!error && !notice) return null;
  if (error) {
    return (
      <div className={`${styles.panelFeedback} ${styles.panelError}`} role="alert" ref={feedbackRef} tabIndex="-1">
        <div>
          <strong>No pudimos aplicar el cambio</strong>
          <span>{error}</span>
        </div>
        {errorCode === 'PROJECT_VERSION_CONFLICT' && (
          <button type="button" onClick={onLoadCurrentVersion} disabled={busy}>
            {busy ? 'Actualizando…' : 'Cargar versión actual'}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className={`${styles.panelFeedback} ${styles.panelNotice}`} role="status">
      <strong>Estado actualizado</strong>
      <span>{notice}</span>
    </div>
  );
}

export default function ProjectsClient({
  activeProjectId: initialActiveProjectId,
  canManage,
  capacity: initialCapacity,
  configuringBootstrap,
  initialProjects,
  planName,
  timezone,
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [activeProjectId, setActiveProjectId] = useState(initialActiveProjectId);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [archiveConfirmed, setArchiveConfirmed] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [panelError, setPanelError] = useState('');
  const [panelErrorCode, setPanelErrorCode] = useState('');
  const [panelNotice, setPanelNotice] = useState('');
  const editorHeadingRef = useRef(null);
  const panelFeedbackRef = useRef(null);
  const manageTriggerRef = useRef(null);
  const formContextTokenRef = useRef(0);
  const operationTokenRef = useRef(0);
  const operationInFlightRef = useRef(false);
  const geoTokenRef = useRef(0);
  const geoInFlightRef = useRef(false);

  const editingProject = projects.find((project) => project.id === editingProjectId) || null;
  const isDirty = useMemo(() => !formsMatch(form, baselineForm), [baselineForm, form]);
  const isArchiving = Boolean(
    editingProject
    && editingProject.status !== 'ARCHIVED'
    && form.status === 'ARCHIVED',
  );
  const hasVersionConflict = panelErrorCode === 'PROJECT_VERSION_CONFLICT';
  const formLocked = busy || geoBusy;
  const summary = useMemo(() => ({
    active: projects.filter((project) => project.status === 'ACTIVE').length,
    connected: projects.filter((project) => (
      project.status === 'ACTIVE' && project.whatsapp?.channel?.connected === true
    )).length,
    total: projects.length,
  }), [projects]);

  function clearPanelFeedback() {
    setPanelError('');
    setPanelErrorCode('');
    setPanelNotice('');
  }

  function focusPanelFeedback() {
    requestAnimationFrame(() => panelFeedbackRef.current?.focus({ preventScroll: true }));
  }

  function showPanelError(message, code = '') {
    setPanelNotice('');
    setPanelError(message);
    setPanelErrorCode(code || '');
    focusPanelFeedback();
  }

  function beginOperation() {
    if (operationInFlightRef.current) return null;
    operationInFlightRef.current = true;
    operationTokenRef.current += 1;
    setBusy(true);
    return operationTokenRef.current;
  }

  function operationIsCurrent(token, contextToken = null) {
    return operationTokenRef.current === token
      && (contextToken == null || formContextTokenRef.current === contextToken);
  }

  function finishOperation(token) {
    if (operationTokenRef.current !== token) return;
    operationInFlightRef.current = false;
    setBusy(false);
  }

  function invalidateFormContext() {
    formContextTokenRef.current += 1;
    operationTokenRef.current += 1;
    operationInFlightRef.current = false;
    geoTokenRef.current += 1;
    geoInFlightRef.current = false;
    setBusy(false);
    setGeoBusy(false);
    return formContextTokenRef.current;
  }

  function focusEditor(contextToken) {
    requestAnimationFrame(() => {
      if (formContextTokenRef.current !== contextToken) return;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      editorHeadingRef.current?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      editorHeadingRef.current?.focus({ preventScroll: true });
    });
  }

  function editProject(project, trigger) {
    if (operationInFlightRef.current || geoInFlightRef.current) return;
    if (editingProjectId === project.id) {
      manageTriggerRef.current = trigger;
      focusEditor(formContextTokenRef.current);
      return;
    }
    if (
      editingProjectId
      && isDirty
      && !window.confirm('Hay cambios sin guardar. ¿Querés descartarlos y gestionar otra obra?')
    ) {
      return;
    }
    const contextToken = invalidateFormContext();
    const nextForm = formFromProject(project);
    manageTriggerRef.current = trigger;
    setEditingProjectId(project.id);
    setForm(nextForm);
    setBaselineForm(nextForm);
    setGpsAccuracy(null);
    setArchiveConfirmed(false);
    setGlobalError('');
    clearPanelFeedback();
    focusEditor(contextToken);
  }

  function closeEditor() {
    if (operationInFlightRef.current || geoInFlightRef.current) return;
    if (isDirty && !window.confirm('Hay cambios sin guardar. ¿Querés descartarlos?')) return;
    const trigger = manageTriggerRef.current;
    invalidateFormContext();
    manageTriggerRef.current = null;
    setEditingProjectId(null);
    const nextForm = emptyForm();
    setForm(nextForm);
    setBaselineForm(nextForm);
    setGpsAccuracy(null);
    setArchiveConfirmed(false);
    clearPanelFeedback();
    requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }

  async function selectProject(projectId) {
    if (
      editingProjectId
      && isDirty
      && !window.confirm('Hay cambios sin guardar. ¿Querés descartarlos y abrir otra obra?')
    ) {
      return;
    }
    const operationToken = beginOperation();
    if (operationToken == null) return;
    setGlobalError('');
    clearPanelFeedback();
    try {
      await responseBody(await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      }));
      if (!operationIsCurrent(operationToken)) return;
      window.location.assign('/dashboard');
    } catch (requestError) {
      if (!operationIsCurrent(operationToken)) return;
      setGlobalError(requestError.message);
      finishOperation(operationToken);
    }
  }

  async function createProject(event) {
    event.preventDefault();
    if (!canManage || !capacity.canCreate || !isDirty || formLocked) return;
    const operationToken = beginOperation();
    if (operationToken == null) return;
    const contextToken = formContextTokenRef.current;
    const payload = { ...form };
    delete payload.status;
    setGlobalError('');
    clearPanelFeedback();
    try {
      await responseBody(await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));
      if (!operationIsCurrent(operationToken, contextToken)) return;
      window.location.assign('/dashboard');
    } catch (requestError) {
      if (!operationIsCurrent(operationToken, contextToken)) return;
      showPanelError(requestError.message, requestError.code);
      finishOperation(operationToken);
    }
  }

  async function updateProject(event) {
    event.preventDefault();
    if (
      !editingProject
      || !isDirty
      || formLocked
      || hasVersionConflict
      || (isArchiving && !archiveConfirmed)
    ) {
      return;
    }
    const operationToken = beginOperation();
    if (operationToken == null) return;
    const contextToken = formContextTokenRef.current;
    const submittedProjectId = editingProject.id;
    const submittedVersion = editingProject.updatedAt;
    const archivedNow = isArchiving;
    setGlobalError('');
    clearPanelFeedback();
    try {
      const body = await responseBody(await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: submittedProjectId,
          expectedUpdatedAt: submittedVersion,
          data: form,
        }),
      }));
      if (!operationIsCurrent(operationToken, contextToken)) return;
      setProjects((current) => current.map((project) => (
        project.id === body.project.id ? body.project : project
      )));
      setActiveProjectId(body.activeProjectId);
      setCapacity(body.capacity);
      const savedForm = formFromProject(body.project);
      setForm(savedForm);
      setBaselineForm(savedForm);
      setGpsAccuracy(null);
      setArchiveConfirmed(false);
      setPanelNotice(archivedNow
        ? 'Obra archivada. Los eventos de campo quedaron bloqueados y el contexto cambió de forma segura.'
        : 'Cambios guardados y auditados.');
    } catch (requestError) {
      if (!operationIsCurrent(operationToken, contextToken)) return;
      showPanelError(requestError.message, requestError.code);
    } finally {
      if (operationIsCurrent(operationToken, contextToken)) finishOperation(operationToken);
    }
  }

  async function loadCurrentVersion() {
    if (!editingProject || operationInFlightRef.current || geoInFlightRef.current) return;
    const operationToken = beginOperation();
    if (operationToken == null) return;
    const contextToken = formContextTokenRef.current;
    const projectId = editingProject.id;
    const draft = { ...form };
    setGlobalError('');
    setPanelNotice('');
    try {
      const body = await responseBody(await fetch('/api/projects', {
        method: 'GET',
        cache: 'no-store',
      }));
      if (!operationIsCurrent(operationToken, contextToken)) return;
      const currentProject = body.projects.find((project) => project.id === projectId);
      if (!currentProject) {
        const missingProjectError = new Error('La obra ya no está disponible en esta organización.');
        missingProjectError.code = 'PROJECT_NOT_FOUND';
        throw missingProjectError;
      }
      const currentForm = formFromProject(currentProject);
      const {
        merged: reviewedDraft,
        serverChangedStatus,
      } = mergeProjectDraft(baselineForm, draft, currentForm);
      setProjects(body.projects);
      setActiveProjectId(body.activeProjectId);
      setCapacity(body.capacity);
      setBaselineForm(currentForm);
      setForm(reviewedDraft);
      setArchiveConfirmed(false);
      setPanelError('');
      setPanelErrorCode('');
      setPanelNotice(formsMatch(reviewedDraft, currentForm)
        ? 'Versión actual cargada. Tu borrador ya coincide con la obra guardada.'
        : serverChangedStatus
          ? 'Versión actual cargada. Conservamos tu borrador, pero respetamos el estado operativo más reciente para evitar una reapertura accidental.'
          : 'Versión actual cargada. Conservamos tu borrador para que revises y vuelvas a guardar.');
    } catch (requestError) {
      if (!operationIsCurrent(operationToken, contextToken)) return;
      showPanelError(requestError.message, requestError.code);
    } finally {
      if (operationIsCurrent(operationToken, contextToken)) finishOperation(operationToken);
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === 'status') setArchiveConfirmed(false);
    if (name === 'latitude' || name === 'longitude') setGpsAccuracy(null);
    setPanelNotice('');
    if (!hasVersionConflict) {
      setPanelError('');
      setPanelErrorCode('');
    }
  }

  function useCurrentLocation() {
    if (operationInFlightRef.current || geoInFlightRef.current) return;
    setGlobalError('');
    setPanelNotice('');
    if (!hasVersionConflict) {
      setPanelError('');
      setPanelErrorCode('');
    }
    if (!navigator.geolocation) {
      showPanelError('Este navegador no permite leer la ubicación. Podés cargar las coordenadas manualmente.');
      return;
    }
    const contextToken = formContextTokenRef.current;
    geoTokenRef.current += 1;
    const geoToken = geoTokenRef.current;
    geoInFlightRef.current = true;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (
          geoTokenRef.current !== geoToken
          || formContextTokenRef.current !== contextToken
        ) {
          return;
        }
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
        }));
        const accuracy = Number(position.coords.accuracy);
        setGpsAccuracy(Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null);
        geoInFlightRef.current = false;
        setGeoBusy(false);
        setPanelNotice('Ubicación capturada. Revisá la precisión y el mapa antes de guardar la obra.');
      },
      (locationError) => {
        if (
          geoTokenRef.current !== geoToken
          || formContextTokenRef.current !== contextToken
        ) {
          return;
        }
        const message = locationError.code === 1
          ? 'El permiso de ubicación fue rechazado. Podés cargar latitud y longitud manualmente.'
          : 'No pudimos obtener una lectura GPS confiable. Reintentá o cargá las coordenadas.';
        geoInFlightRef.current = false;
        setGeoBusy(false);
        showPanelError(message);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }

  function clearCoordinates() {
    if (formLocked) return;
    setForm((current) => ({ ...current, latitude: '', longitude: '' }));
    setGpsAccuracy(null);
    if (!hasVersionConflict) {
      setPanelError('');
      setPanelErrorCode('');
    }
    setPanelNotice('Coordenadas eliminadas del formulario. El cambio se aplica recién al guardar.');
  }

  const usage = capacity.limit == null
    ? null
    : Math.min(100, Math.round((capacity.used / Math.max(1, capacity.limit)) * 100));

  return (
    <>
      <section className={styles.summaryGrid} aria-label="Resumen del portfolio">
        <article><span>Portfolio</span><strong>{summary.total}</strong><small>obras registradas</small></article>
        <article><span>En ejecución</span><strong>{summary.active}</strong><small>obras activas</small></article>
        <article><span>Canal de campo</span><strong>{summary.connected}</strong><small>cuentas y webhooks verificados</small></article>
        <article className={styles.capacityCard}>
          <div><span>Capacidad {planName}</span><strong>{capacity.limit == null ? 'Sin límite' : `${capacity.used} / ${capacity.limit}`}</strong></div>
          {usage != null && <i aria-hidden="true"><b style={{ width: `${usage}%` }} /></i>}
          <small>{capacity.limit == null ? 'Capacidad operativa sin tope configurado' : `${capacity.remaining} cupos operativos disponibles`}</small>
        </article>
      </section>

      {globalError && <p className={styles.error} role="alert">{globalError}</p>}
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
                busy={formLocked}
                canManage={canManage}
                key={project.id}
                onEdit={editProject}
                onSelect={selectProject}
                project={project}
                timezone={timezone}
              />
            ))}
          </div>
        </section>

        <aside className={styles.createPanel} id="configure-first-project">
          {!canManage ? (
            <>
              <p className={styles.eyebrow}>Portfolio</p>
              <h2 ref={editorHeadingRef} tabIndex="-1">Acceso de consulta</h2>
              <div className={styles.limitNotice}>
                <strong>Tu rol no administra obras</strong>
                <span>Podés recorrer y abrir contextos, pero no cambiar datos, geocercas ni estados.</span>
              </div>
            </>
          ) : editingProject ? (
            <>
              <div className={styles.panelTopline}>
                <div>
                  <p className={styles.eyebrow}>Gobierno del proyecto</p>
                  <h2 ref={editorHeadingRef} tabIndex="-1">Gestionar obra</h2>
                </div>
                <div className={styles.panelControls}>
                  {isDirty && <span className={styles.dirtyBadge}>Cambios sin guardar</span>}
                  <button type="button" className={styles.closeEditor} onClick={closeEditor} aria-label="Cerrar editor" disabled={formLocked}>×</button>
                </div>
              </div>
              <p>Editá el perímetro real, el cronograma y el estado sin perder el historial ni cambiar el identificador técnico.</p>
              <form onSubmit={updateProject} className={styles.createForm} aria-busy={formLocked}>
                <PanelFeedback
                  busy={busy}
                  error={panelError}
                  errorCode={panelErrorCode}
                  feedbackRef={panelFeedbackRef}
                  notice={panelNotice}
                  onLoadCurrentVersion={loadCurrentVersion}
                />
                <ProjectFields
                  disabled={formLocked}
                  form={form}
                  gpsAccuracy={gpsAccuracy}
                  geoBusy={geoBusy}
                  onClearCoordinates={clearCoordinates}
                  onUpdate={updateField}
                  onUseCurrentLocation={useCurrentLocation}
                  showStatus
                />
                {isArchiving && (
                  <label className={styles.archiveConfirmation}>
                    <input
                      type="checkbox"
                      checked={archiveConfirmed}
                      onChange={(event) => setArchiveConfirmed(event.target.checked)}
                      disabled={formLocked}
                    />
                    <span>
                      <strong>Confirmo el archivo de esta obra.</strong>
                      Se bloquearán nuevos eventos y, si es el contexto actual, ObraSaaS elegirá otra obra disponible.
                    </span>
                  </label>
                )}
                <div className={styles.formActions}>
                  <button type="button" className={styles.cancelButton} onClick={closeEditor} disabled={formLocked}>Cancelar</button>
                  <button
                    type="submit"
                    disabled={formLocked || !isDirty || hasVersionConflict || (isArchiving && !archiveConfirmed)}
                    title={
                      hasVersionConflict
                        ? 'Cargá la versión actual antes de volver a guardar'
                        : !isDirty ? 'No hay cambios nuevos para guardar' : undefined
                    }
                  >
                    {busy ? 'Guardando cambios…' : 'Guardar y auditar'} <span aria-hidden="true">→</span>
                  </button>
                </div>
                <small>La edición usa control de versión para no sobrescribir cambios de otra persona.</small>
              </form>
            </>
          ) : (
            <>
              <p className={styles.eyebrow}>{configuringBootstrap ? 'Puesta en marcha' : 'Nueva operación'}</p>
              <h2 ref={editorHeadingRef} tabIndex="-1">{configuringBootstrap ? 'Configurar la primera obra' : 'Crear una obra'}</h2>
              <p>
                {configuringBootstrap
                  ? 'Reemplazá el perímetro inicial por una obra real sin consumir un cupo adicional.'
                  : 'Cada obra recibe su propia bitácora, equipo, geocerca, WABA y estado operativo.'}
              </p>
              {!capacity.canCreate ? (
                <div className={styles.limitNotice}>
                  <strong>Límite del plan alcanzado</strong>
                  <span>
                    El plan {planName} admite {capacity.limit}{' '}
                    {capacity.limit === 1 ? 'obra operativa' : 'obras operativas'}.
                    {' '}Finalizá o archivá una antes de activar otra.
                  </span>
                </div>
              ) : (
                <form onSubmit={createProject} className={styles.createForm} aria-busy={formLocked}>
                  <PanelFeedback
                    busy={busy}
                    error={panelError}
                    errorCode={panelErrorCode}
                    feedbackRef={panelFeedbackRef}
                    notice={panelNotice}
                    onLoadCurrentVersion={loadCurrentVersion}
                  />
                  <ProjectFields
                    disabled={formLocked}
                    form={form}
                    gpsAccuracy={gpsAccuracy}
                    geoBusy={geoBusy}
                    onClearCoordinates={clearCoordinates}
                    onUpdate={updateField}
                    onUseCurrentLocation={useCurrentLocation}
                    showStatus={false}
                  />
                  <button type="submit" disabled={formLocked || !isDirty}>
                    {busy
                      ? 'Guardando perímetro…'
                      : configuringBootstrap ? 'Configurar y abrir obra' : 'Crear y abrir obra'}
                    {' '}<span aria-hidden="true">→</span>
                  </button>
                  <small>No se compra ningún servicio ni dominio al crearla.</small>
                </form>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
