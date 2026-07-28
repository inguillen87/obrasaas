'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildScheduleObservations,
  scheduleObservationRequirements,
} from '@/lib/schedule-observations';
import styles from './schedule-snapshots-panel.module.css';

const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const REQUIREMENTS_PAGE_SIZE = 25;

function civilToday(timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(value, { dateTime = false } = {}) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', dateTime
    ? { dateStyle: 'medium', timeStyle: 'short', timeZone: DEFAULT_TIME_ZONE }
    : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function deltaLabel(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return 'Sin cálculo';
  if (days === 0) return 'En fecha';
  return `${days > 0 ? '+' : ''}${days} día${Math.abs(days) === 1 ? '' : 's'}`;
}

function operationIdentity(kind, payload) {
  return `${kind}:${JSON.stringify(payload)}`;
}

function newOperationKey(kind) {
  const id = globalThis.crypto?.randomUUID?.();
  if (!id) throw new Error('El navegador no puede generar una clave segura para esta operación.');
  return `schedule-${kind}:${id}`;
}

async function responsePayload(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'La operación de cronograma no pudo completarse.');
    error.code = payload.code || 'SCHEDULE_REQUEST_FAILED';
    error.details = payload.details || null;
    throw error;
  }
  return payload;
}

function taskDatesComplete(task) {
  return Boolean(task?.startsAt && task?.endsAt);
}

export default function ScheduleSnapshotsPanel({
  canManage,
  getProjectStateVersion,
  initialTasks,
  onToast,
  project,
  tasksTruncated = false,
}) {
  const today = useMemo(() => civilToday(), []);
  const [loadedTasks, setLoadedTasks] = useState(null);
  const [baselines, setBaselines] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [baselineName, setBaselineName] = useState(`Línea base contractual · ${today}`);
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [replaceActiveBaseline, setReplaceActiveBaseline] = useState(false);
  const [asOfDate, setAsOfDate] = useState(today);
  const [observationEntries, setObservationEntries] = useState({});
  const [requirementsPage, setRequirementsPage] = useState(0);
  const operationKeys = useRef(new Map());

  const tasks = useMemo(() => (
    tasksTruncated && Array.isArray(loadedTasks)
      ? loadedTasks
      : Array.isArray(initialTasks) ? initialTasks : []
  ), [initialTasks, loadedTasks, tasksTruncated]);

  const requestData = useCallback(async ({ signal } = {}) => {
    const [baselineResponse, forecastResponse, fullTasksResponse] = await Promise.all([
      fetch('/api/schedule/baselines?limit=25', { cache: 'no-store', signal }),
      fetch('/api/schedule/forecasts?limit=25', { cache: 'no-store', signal }),
      tasksTruncated
        ? fetch('/api/tasks?limit=5000', { cache: 'no-store', signal })
        : Promise.resolve(null),
    ]);
    const [baselinePayload, forecastPayload, fullTasksPayload] = await Promise.all([
      responsePayload(baselineResponse),
      responsePayload(forecastResponse),
      fullTasksResponse ? responsePayload(fullTasksResponse) : Promise.resolve(null),
    ]);
    return {
      baselines: Array.isArray(baselinePayload.baselines) ? baselinePayload.baselines : [],
      forecasts: Array.isArray(forecastPayload.forecasts) ? forecastPayload.forecasts : [],
      fullTasks: fullTasksPayload
        ? (Array.isArray(fullTasksPayload.tasks) ? fullTasksPayload.tasks : [])
        : null,
    };
  }, [tasksTruncated]);

  const applyData = useCallback((data) => {
    setBaselines(data.baselines);
    setForecasts(data.forecasts);
    if (data.fullTasks) setLoadedTasks(data.fullTasks);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    requestData({ signal: controller.signal })
      .then((data) => {
        if (active) applyData(data);
      })
      .catch((loadError) => {
        if (active && loadError.name !== 'AbortError') {
          setError(loadError.message || 'No se pudo cargar el control contractual del cronograma.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [applyData, project.id, requestData]);

  const activeBaseline = baselines.find((baseline) => baseline.status === 'ACTIVE') || null;
  const latestForecast = forecasts[0] || null;
  const missingDateTasks = useMemo(() => tasks.filter((task) => !taskDatesComplete(task)), [tasks]);
  const requirements = useMemo(() => {
    if (tasks.length === 0) return [];
    try {
      return scheduleObservationRequirements(tasks);
    } catch {
      return [];
    }
  }, [tasks]);
  const requirementPages = Math.max(1, Math.ceil(requirements.length / REQUIREMENTS_PAGE_SIZE));
  const visibleRequirementsPage = Math.min(requirementsPage, requirementPages - 1);
  const visibleRequirements = requirements.slice(
    visibleRequirementsPage * REQUIREMENTS_PAGE_SIZE,
    (visibleRequirementsPage + 1) * REQUIREMENTS_PAGE_SIZE,
  );
  const baselineMatchesVisiblePlan = !activeBaseline || activeBaseline.taskCount === tasks.length;

  function keyFor(kind, payload) {
    const identity = operationIdentity(kind, payload);
    const existing = operationKeys.current.get(identity);
    if (existing) return { identity, key: existing };
    const key = newOperationKey(kind);
    operationKeys.current.set(identity, key);
    return { identity, key };
  }

  function projectStateVersion() {
    const version = Number(getProjectStateVersion?.());
    if (!Number.isSafeInteger(version) || version < 0 || version > 2_147_483_647) {
      throw new Error('No se pudo confirmar la versión vigente de la obra. Recargá la página.');
    }
    return version;
  }

  async function publishBaseline(event) {
    event.preventDefault();
    if (!canManage || busy) return;
    setError('');
    setNotice('');
    if (tasks.length === 0) {
      setError('Creá al menos una tarea canónica antes de publicar una línea base.');
      return;
    }
    if (missingDateTasks.length > 0) {
      setError(`Hay ${missingDateTasks.length} tarea${missingDateTasks.length === 1 ? '' : 's'} sin fechas de inicio y fin.`);
      return;
    }
    if (activeBaseline && !replaceActiveBaseline) {
      setError('Confirmá la rebaselinización para reemplazar la línea base activa.');
      return;
    }
    const input = {
      expectedProjectStateVersion: projectStateVersion(),
      name: baselineName,
      replaceActiveBaseline,
      timeZone,
    };
    const operation = keyFor('baseline', input);
    setBusy('baseline');
    try {
      const payload = await responsePayload(await fetch('/api/schedule/baselines', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': operation.key,
        },
        body: JSON.stringify(input),
      }));
      operationKeys.current.delete(operation.identity);
      setReplaceActiveBaseline(false);
      setNotice(payload.replayed
        ? `La línea base v${payload.baseline.version} ya estaba publicada; no se duplicó.`
        : `Línea base v${payload.baseline.version} publicada y sellada.`);
      onToast?.('Cronograma contractual actualizado.', 'success');
      applyData(await requestData());
    } catch (publishError) {
      setError(publishError.message);
    } finally {
      setBusy(null);
    }
  }

  async function calculateForecast(event) {
    event.preventDefault();
    if (!canManage || busy) return;
    setError('');
    setNotice('');
    try {
      if (!activeBaseline) throw new Error('Publicá primero una línea base contractual.');
      if (!baselineMatchesVisiblePlan) {
        throw new Error('El conjunto de tareas cambió desde la línea base. Rebaselinizá antes de calcular.');
      }
      const observations = buildScheduleObservations(tasks, observationEntries, { asOfDate });
      const input = {
        asOfDate,
        baselineId: activeBaseline.id,
        expectedProjectStateVersion: projectStateVersion(),
        observations,
      };
      const operation = keyFor('forecast', input);
      setBusy('forecast');
      const payload = await responsePayload(await fetch('/api/schedule/forecasts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': operation.key,
        },
        body: JSON.stringify(input),
      }));
      operationKeys.current.delete(operation.identity);
      setNotice(payload.replayed
        ? 'Este corte ya estaba calculado; se recuperó el mismo resultado.'
        : `Forecast calculado: ${deltaLabel(payload.forecast.finishDeltaDays)} respecto de la línea base.`);
      onToast?.('Pronóstico determinista guardado.', 'success');
      applyData(await requestData());
    } catch (forecastError) {
      setError(forecastError.message);
    } finally {
      setBusy(null);
    }
  }

  function updateObservation(sourceTaskId, field, value) {
    setObservationEntries((current) => ({
      ...current,
      [sourceTaskId]: { ...(current[sourceTaskId] || {}), [field]: value },
    }));
    setError('');
  }

  return (
    <section className={styles.panel} aria-labelledby="schedule-contract-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Control contractual e inmutable</span>
          <h2 id="schedule-contract-title">Línea base y forecast</h2>
          <p>Congelá el plan aprobado y comparalo con hechos reales. Ningún cálculo modifica las tareas canónicas.</p>
        </div>
        <span className={`${styles.health} ${activeBaseline ? styles.ready : styles.pending}`}>
          <i aria-hidden="true" />
          {loading ? 'Verificando' : activeBaseline ? `Baseline v${activeBaseline.version}` : 'Sin baseline'}
        </span>
      </div>

      {error && <div className={styles.error} role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{error}</div>}
      {notice && <div className={styles.notice} role="status"><i className="fa-solid fa-circle-check" aria-hidden="true" />{notice}</div>}

      <div className={styles.metrics} aria-label="Estado contractual del cronograma">
        <article>
          <span>Plan sellado</span>
          <strong>{activeBaseline ? `v${activeBaseline.version}` : 'Pendiente'}</strong>
          <small>{activeBaseline ? `${activeBaseline.taskCount} tareas · ${activeBaseline.dependencyCount} vínculos` : 'Todavía editable, sin referencia contractual'}</small>
        </article>
        <article>
          <span>Fin contractual</span>
          <strong>{latestForecast ? formatDate(latestForecast.baselineFinishDate) : '—'}</strong>
          <small>{activeBaseline ? activeBaseline.name : 'Publicá una línea base'}</small>
        </article>
        <article className={Number(latestForecast?.finishDeltaDays) > 0 ? styles.riskMetric : undefined}>
          <span>Desvío proyectado</span>
          <strong>{latestForecast ? deltaLabel(latestForecast.finishDeltaDays) : 'Sin cálculo'}</strong>
          <small>{latestForecast ? `Fin previsto ${formatDate(latestForecast.forecastFinishDate)}` : 'Ingresá el corte de avance'}</small>
        </article>
        <article>
          <span>Historial</span>
          <strong>{forecasts.length}</strong>
          <small>cortes reproducibles cargados</small>
        </article>
      </div>

      <div className={styles.actionsGrid}>
        <form className={styles.actionCard} onSubmit={publishBaseline}>
          <div className={styles.cardHeading}>
            <span>1</span>
            <div><strong>{activeBaseline ? 'Rebaselinizar' : 'Publicar línea base'}</strong><small>Foto contractual del plan vigente</small></div>
          </div>
          <label>Nombre del plan<input maxLength={220} onChange={(event) => setBaselineName(event.target.value)} required value={baselineName} /></label>
          <label>Zona horaria<input list="schedule-time-zones" maxLength={64} onChange={(event) => setTimeZone(event.target.value)} required value={timeZone} /></label>
          <datalist id="schedule-time-zones">
            <option value="America/Argentina/Buenos_Aires" />
            <option value="America/Santiago" />
            <option value="America/Lima" />
            <option value="America/Bogota" />
            <option value="America/Mexico_City" />
            <option value="America/Sao_Paulo" />
          </datalist>
          {activeBaseline && (
            <label className={styles.confirm}>
              <input checked={replaceActiveBaseline} onChange={(event) => setReplaceActiveBaseline(event.target.checked)} type="checkbox" />
              <span>Confirmo que el nuevo plan reemplazará la baseline v{activeBaseline.version}; el historial anterior seguirá inmutable.</span>
            </label>
          )}
          <div className={styles.validationLine}>
            <span>{tasks.length} tareas canónicas</span>
            <span className={missingDateTasks.length ? styles.invalid : styles.valid}>{missingDateTasks.length ? `${missingDateTasks.length} sin fechas` : 'Fechas completas'}</span>
          </div>
          <button disabled={!canManage || loading || Boolean(busy) || (activeBaseline && !replaceActiveBaseline)} type="submit">
            {busy === 'baseline' ? 'Sellando…' : activeBaseline ? 'Publicar nueva versión' : 'Publicar baseline'}
          </button>
        </form>

        <form className={styles.actionCard} onSubmit={calculateForecast}>
          <div className={styles.cardHeading}>
            <span>2</span>
            <div><strong>Calcular forecast</strong><small>Corte determinista, sin IA generativa</small></div>
          </div>
          <label>Fecha de corte<input max={today} onChange={(event) => setAsOfDate(event.target.value)} required type="date" value={asOfDate} /></label>
          <p className={styles.truthNote}><i className="fa-solid fa-shield-halved" aria-hidden="true" /> Las fechas reales no se autocompletan con el plan: deben reflejar hechos confirmados.</p>
          {requirements.length === 0 ? (
            <div className={styles.emptyRequirements}>Las tareas pendientes usan su duración contractual. No hacen falta datos reales adicionales.</div>
          ) : (
            <div className={styles.requirements}>
              <div className={styles.requirementHeader}>
                <span>{requirements.length} tareas con avance requieren hechos reales</span>
                {requirementPages > 1 && <small>Página {visibleRequirementsPage + 1} de {requirementPages}</small>}
              </div>
              {visibleRequirements.map((requirement) => (
                <fieldset key={requirement.sourceTaskId}>
                  <legend>{requirement.title} <span>{requirement.progressPercent}%</span></legend>
                  <label>Inicio real<input max={asOfDate} onChange={(event) => updateObservation(requirement.sourceTaskId, 'actualStartDate', event.target.value)} required type="date" value={observationEntries[requirement.sourceTaskId]?.actualStartDate || ''} /></label>
                  {requirement.requiresActualFinish && <label>Fin real<input max={asOfDate} onChange={(event) => updateObservation(requirement.sourceTaskId, 'actualFinishDate', event.target.value)} required type="date" value={observationEntries[requirement.sourceTaskId]?.actualFinishDate || ''} /></label>}
                  {requirement.requiresRemainingDuration && <label>Días restantes<input max="3650" min="1" onChange={(event) => updateObservation(requirement.sourceTaskId, 'remainingDurationDays', event.target.value)} required type="number" value={observationEntries[requirement.sourceTaskId]?.remainingDurationDays || ''} /></label>}
                </fieldset>
              ))}
              {requirementPages > 1 && (
                <div className={styles.pagination}>
                  <button disabled={visibleRequirementsPage === 0} onClick={() => setRequirementsPage(Math.max(0, visibleRequirementsPage - 1))} type="button">Anterior</button>
                  <button disabled={visibleRequirementsPage + 1 >= requirementPages} onClick={() => setRequirementsPage(Math.min(requirementPages - 1, visibleRequirementsPage + 1))} type="button">Siguiente</button>
                </div>
              )}
            </div>
          )}
          {!baselineMatchesVisiblePlan && <p className={styles.rebaselineWarning}>La baseline contiene {activeBaseline.taskCount} tareas y el plan vigente {tasks.length}. Rebaselinizá antes del próximo corte.</p>}
          <button disabled={!canManage || loading || Boolean(busy) || !activeBaseline || !baselineMatchesVisiblePlan} type="submit">
            {busy === 'forecast' ? 'Calculando…' : 'Guardar nuevo corte'}
          </button>
        </form>
      </div>

      {forecasts.length > 0 && (
        <div className={styles.history}>
          <div><strong>Últimos cortes</strong><span>Los resultados quedan auditables y no se sobreescriben.</span></div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Corte</th><th>Baseline</th><th>Fin previsto</th><th>Desvío</th><th>Calculado</th></tr></thead>
              <tbody>{forecasts.slice(0, 5).map((forecast) => (
                <tr key={forecast.id}>
                  <td>{formatDate(forecast.asOfDate)}</td>
                  <td>{baselines.find((baseline) => baseline.id === forecast.baselineId)?.name || 'Histórica'}</td>
                  <td>{formatDate(forecast.forecastFinishDate)}</td>
                  <td><span className={Number(forecast.finishDeltaDays) > 0 ? styles.late : styles.onTime}>{deltaLabel(forecast.finishDeltaDays)}</span></td>
                  <td>{formatDate(forecast.createdAt, { dateTime: true })}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
