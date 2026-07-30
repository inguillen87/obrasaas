'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildScheduleObservations,
  scheduleObservationRequirements,
} from '@/lib/schedule-observations';
import styles from './schedule-snapshots-panel.module.css';

const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const REQUIREMENTS_PAGE_SIZE = 25;
const FORECAST_COMPARISON_LIMIT = 50;
const MAX_RATIONALE_LENGTH = 1_000;

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

function reviewedAssessmentForForecast(payload, selection) {
  const assessments = Array.isArray(payload?.assessments) ? payload.assessments : [];
  const assessment = assessments.find((candidate) => candidate?.id === selection.assessmentId);
  if (!assessment || assessment.evidenceId !== selection.evidenceId) {
    throw new Error('La evaluación seleccionada no está disponible para esta evidencia.');
  }
  if (
    assessment.status !== 'COMPLETED'
    || !['APPROVED', 'CORRECTED'].includes(assessment.reviewStatus)
  ) {
    throw new Error('La evaluación debe estar completada y revisada por una persona antes de usarla.');
  }
  const taskId = typeof assessment.taskId === 'string' ? assessment.taskId.trim() : '';
  const revision = Number(assessment.revision);
  const corrected = assessment.reviewStatus === 'CORRECTED';
  const rangeMin = Number(corrected ? assessment.correctedProgressMin : assessment.progressMin);
  const rangeMax = Number(corrected ? assessment.correctedProgressMax : assessment.progressMax);
  if (
    !taskId
    || taskId.length > 190
    || !Number.isSafeInteger(revision)
    || revision < 0
    || !Number.isSafeInteger(rangeMin)
    || !Number.isSafeInteger(rangeMax)
    || rangeMin < 0
    || rangeMax > 100
    || rangeMin > rangeMax
  ) {
    throw new Error('La evaluación revisada no contiene un rango utilizable y verificable.');
  }
  return {
    assessmentId: assessment.id,
    evidenceId: assessment.evidenceId,
    expectedAssessmentRevision: revision,
    rangeMin,
    rangeMax,
    reviewStatus: assessment.reviewStatus,
    taskId,
  };
}

function civilDayOrdinal(value) {
  const dateKey = typeof value === 'string' ? value.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 86_400_000);
}

function comparisonBar(start, finish, minimum, span) {
  const startDay = civilDayOrdinal(start);
  const finishDay = civilDayOrdinal(finish);
  if (startDay == null || finishDay == null || finishDay < startDay) return null;
  return {
    left: `${Math.max(0, ((startDay - minimum) / span) * 100)}%`,
    width: `${Math.max(1.25, ((finishDay - startDay + 1) / span) * 100)}%`,
  };
}

function forecastComparison(detail) {
  const source = Array.isArray(detail?.tasks) ? detail.tasks : [];
  const valid = source.filter((task) => (
    task
    && typeof task.sourceTaskId === 'string'
    && civilDayOrdinal(task.baselineStart) != null
    && civilDayOrdinal(task.baselineFinish) != null
    && civilDayOrdinal(task.forecastStart) != null
    && civilDayOrdinal(task.forecastFinish) != null
  ));
  if (valid.length === 0) return { rows: [], total: 0 };
  const ordered = [...valid].sort((left, right) => (
    Math.abs(Number(right.finishDeltaDays) || 0) - Math.abs(Number(left.finishDeltaDays) || 0)
    || String(left.code || left.title || left.sourceTaskId)
      .localeCompare(String(right.code || right.title || right.sourceTaskId), 'es')
  ));
  const rows = ordered.slice(0, FORECAST_COMPARISON_LIMIT);
  const ordinals = rows.flatMap((task) => [
    civilDayOrdinal(task.baselineStart),
    civilDayOrdinal(task.baselineFinish),
    civilDayOrdinal(task.forecastStart),
    civilDayOrdinal(task.forecastFinish),
  ]).filter(Number.isFinite);
  const minimum = Math.min(...ordinals);
  const maximum = Math.max(...ordinals);
  const span = Math.max(1, maximum - minimum + 1);
  return {
    total: valid.length,
    rows: rows.map((task) => ({
      ...task,
      baselineBar: comparisonBar(task.baselineStart, task.baselineFinish, minimum, span),
      forecastBar: comparisonBar(task.forecastStart, task.forecastFinish, minimum, span),
    })),
  };
}

function progressSourceLabel(value) {
  if (value === 'REVIEWED_EVIDENCE') return 'Evidencia revisada';
  if (value === 'MANUAL_OVERRIDE') return 'Observación manual';
  return 'Avance canónico';
}

function forecastDriverLabel(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Cálculo determinista';
  if (value.kind === 'DEPENDENCY') return 'Condicionado por dependencia';
  if (value.kind === 'ACTUAL_FINISH') return 'Fin real confirmado';
  if (value.kind === 'ACTUAL_START') return 'Inicio real confirmado';
  if (value.kind === 'AS_OF_DATE') return 'Fecha de corte';
  return 'Cálculo determinista';
}

export default function ScheduleSnapshotsPanel({
  canManage,
  canUseReviewedEvidence = false,
  getProjectStateVersion,
  initialTasks,
  onToast,
  project,
  reviewedEvidenceSelection = null,
  tasksTruncated = false,
}) {
  const today = useMemo(() => civilToday(), []);
  const [loadedTasks, setLoadedTasks] = useState(null);
  const [baselines, setBaselines] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [forecastDetail, setForecastDetail] = useState(null);
  const [forecastDetailError, setForecastDetailError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [baselineName, setBaselineName] = useState(`Línea base contractual · ${today}`);
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [replaceActiveBaseline, setReplaceActiveBaseline] = useState(false);
  const [asOfDate, setAsOfDate] = useState(today);
  const [observationEntries, setObservationEntries] = useState({});
  const [reviewedAssessmentResult, setReviewedAssessmentResult] = useState(null);
  const [reviewedAssessmentFailure, setReviewedAssessmentFailure] = useState(null);
  const [reviewedProgressInput, setReviewedProgressInput] = useState(null);
  const [reviewedRationaleInput, setReviewedRationaleInput] = useState(null);
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
    const forecastRows = Array.isArray(forecastPayload.forecasts) ? forecastPayload.forecasts : [];
    let latestForecastDetail = null;
    let latestForecastDetailError = '';
    const latestForecastId = typeof forecastRows[0]?.id === 'string' ? forecastRows[0].id : null;
    if (latestForecastId) {
      try {
        const detailPayload = await responsePayload(await fetch(
          `/api/schedule/forecasts/${encodeURIComponent(latestForecastId)}`,
          { cache: 'no-store', signal },
        ));
        if (detailPayload?.forecast?.id !== latestForecastId) {
          throw new Error('El detalle recibido no corresponde al último forecast.');
        }
        latestForecastDetail = detailPayload.forecast;
      } catch (detailError) {
        if (detailError?.name === 'AbortError') throw detailError;
        latestForecastDetailError = detailError?.message
          || 'No se pudo cargar el detalle comparativo del último forecast.';
      }
    }
    return {
      baselines: Array.isArray(baselinePayload.baselines) ? baselinePayload.baselines : [],
      forecastDetail: latestForecastDetail,
      forecastDetailError: latestForecastDetailError,
      forecasts: forecastRows,
      fullTasks: fullTasksPayload
        ? (Array.isArray(fullTasksPayload.tasks) ? fullTasksPayload.tasks : [])
        : null,
    };
  }, [tasksTruncated]);

  const applyData = useCallback((data) => {
    setBaselines(data.baselines);
    setForecasts(data.forecasts);
    setForecastDetail(data.forecastDetail || null);
    setForecastDetailError(data.forecastDetailError || '');
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

  useEffect(() => {
    const evidenceId = reviewedEvidenceSelection?.evidenceId;
    const assessmentId = reviewedEvidenceSelection?.assessmentId;
    if (!canUseReviewedEvidence || !evidenceId || !assessmentId) return undefined;
    const selection = { evidenceId, assessmentId };
    const selectionKey = `${evidenceId}:${assessmentId}`;

    const controller = new AbortController();
    let active = true;
    fetch(
      `/api/progress/${encodeURIComponent(evidenceId)}/visual-assessments`,
      { cache: 'no-store', signal: controller.signal },
    )
      .then(responsePayload)
      .then((payload) => reviewedAssessmentForForecast(payload, selection))
      .then((assessment) => {
        if (active) {
          setReviewedAssessmentResult({ assessment, selectionKey });
          setReviewedAssessmentFailure(null);
        }
      })
      .catch((assessmentError) => {
        if (active && assessmentError?.name !== 'AbortError') {
          setReviewedAssessmentFailure({
            message: assessmentError?.message || 'No se pudo validar la evaluación revisada.',
            selectionKey,
          });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    canUseReviewedEvidence,
    reviewedEvidenceSelection?.assessmentId,
    reviewedEvidenceSelection?.evidenceId,
  ]);

  const activeBaseline = baselines.find((baseline) => baseline.status === 'ACTIVE') || null;
  const latestForecast = forecasts[0] || null;
  const reviewedJourneyRequested = Boolean(
    canUseReviewedEvidence && reviewedEvidenceSelection,
  );
  const reviewedSelectionKey = reviewedJourneyRequested
    ? `${reviewedEvidenceSelection.evidenceId}:${reviewedEvidenceSelection.assessmentId}`
    : null;
  const reviewedAssessment = reviewedAssessmentResult?.selectionKey === reviewedSelectionKey
    ? reviewedAssessmentResult.assessment
    : null;
  const reviewedAssessmentError = reviewedAssessmentFailure?.selectionKey === reviewedSelectionKey
    ? reviewedAssessmentFailure.message
    : '';
  const reviewedAssessmentLoading = Boolean(
    reviewedJourneyRequested && !reviewedAssessment && !reviewedAssessmentError,
  );
  const reviewedProgressPercent = reviewedProgressInput?.selectionKey === reviewedSelectionKey
    ? reviewedProgressInput.value
    : '';
  const reviewedRationale = reviewedRationaleInput?.selectionKey === reviewedSelectionKey
    ? reviewedRationaleInput.value
    : '';
  const reviewedTask = reviewedAssessment
    ? tasks.find((task) => task.id === reviewedAssessment.taskId) || null
    : null;
  const reviewedPoint = /^\d+$/.test(reviewedProgressPercent.trim())
    ? Number(reviewedProgressPercent.trim())
    : null;
  const reviewedPointValid = Boolean(
    reviewedAssessment
    && Number.isSafeInteger(reviewedPoint)
    && reviewedPoint >= reviewedAssessment.rangeMin
    && reviewedPoint <= reviewedAssessment.rangeMax
  );
  const reviewedRationaleValid = (
    reviewedRationale.trim().length > 0
    && reviewedRationale.trim().length <= MAX_RATIONALE_LENGTH
  );
  const reviewedEvidenceForRequirements = useMemo(() => (
    reviewedPointValid && reviewedAssessment
      ? {
          taskId: reviewedAssessment.taskId,
          assessmentId: reviewedAssessment.assessmentId,
          expectedAssessmentRevision: reviewedAssessment.expectedAssessmentRevision,
          progressPercent: reviewedPoint,
          rationale: '',
        }
      : null
  ), [reviewedAssessment, reviewedPoint, reviewedPointValid]);
  const missingDateTasks = useMemo(() => tasks.filter((task) => !taskDatesComplete(task)), [tasks]);
  const projectStartMissing = !project?.startsAt;
  const requirements = useMemo(() => {
    if (tasks.length === 0) return [];
    try {
      return scheduleObservationRequirements(tasks, {
        reviewedEvidence: reviewedEvidenceForRequirements,
      });
    } catch {
      return [];
    }
  }, [reviewedEvidenceForRequirements, tasks]);
  const requirementPages = Math.max(1, Math.ceil(requirements.length / REQUIREMENTS_PAGE_SIZE));
  const visibleRequirementsPage = Math.min(requirementsPage, requirementPages - 1);
  const visibleRequirements = requirements.slice(
    visibleRequirementsPage * REQUIREMENTS_PAGE_SIZE,
    (visibleRequirementsPage + 1) * REQUIREMENTS_PAGE_SIZE,
  );
  const baselineMatchesVisiblePlan = !activeBaseline || activeBaseline.taskCount === tasks.length;
  const comparison = useMemo(() => forecastComparison(forecastDetail), [forecastDetail]);

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
      let reviewedEvidence = null;
      if (reviewedJourneyRequested) {
        if (reviewedAssessmentLoading) {
          throw new Error('Esperá a que termine la validación de la evaluación revisada.');
        }
        if (reviewedAssessmentError || !reviewedAssessment || !reviewedTask) {
          throw new Error(
            reviewedAssessmentError
            || 'La evaluación revisada no corresponde a una tarea visible de esta obra.',
          );
        }
        if (!reviewedPointValid) {
          throw new Error(
            `Elegí un porcentaje entero entre ${reviewedAssessment.rangeMin}% y ${reviewedAssessment.rangeMax}%.`,
          );
        }
        const rationale = reviewedRationale.trim();
        if (!rationale || rationale.length > MAX_RATIONALE_LENGTH) {
          throw new Error(`Ingresá un fundamento humano de hasta ${MAX_RATIONALE_LENGTH} caracteres.`);
        }
        reviewedEvidence = {
          taskId: reviewedAssessment.taskId,
          assessmentId: reviewedAssessment.assessmentId,
          expectedAssessmentRevision: reviewedAssessment.expectedAssessmentRevision,
          progressPercent: reviewedPoint,
          rationale,
        };
      }
      const observations = reviewedEvidence
        ? buildScheduleObservations(tasks, observationEntries, { asOfDate, reviewedEvidence })
        : buildScheduleObservations(tasks, observationEntries, { asOfDate });
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
          {missingDateTasks.length > 0 && (
            <p className={styles.readinessWarning} role="status">
              {projectStartMissing ? (
                <>
                  <a href="/dashboard/projects">Completá el inicio de la obra</a> para convertir las tareas a fechas calendario.
                </>
              ) : (
                <>Editá las tareas sin calendario y completá sus fechas de inicio y fin antes de sellar el plan.</>
              )}
            </p>
          )}
          <button disabled={!canManage || loading || Boolean(busy) || tasks.length === 0 || missingDateTasks.length > 0 || (activeBaseline && !replaceActiveBaseline)} type="submit">
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
          {reviewedJourneyRequested && (
            <section className={styles.reviewedEvidenceCard} aria-labelledby="reviewed-evidence-title">
              <div className={styles.reviewedEvidenceHeading}>
                <div>
                  <span>Fuente propuesta</span>
                  <strong id="reviewed-evidence-title">Evidencia visual revisada</strong>
                </div>
                <span className={styles.reviewedEvidenceState}>
                  {reviewedAssessmentLoading
                    ? 'Validando…'
                    : reviewedAssessment
                      ? 'Revisión humana confirmada'
                      : 'No disponible'}
                </span>
              </div>

              {reviewedAssessmentLoading && (
                <p className={styles.reviewedEvidenceMessage} role="status">
                  Validando la evaluación exacta y su tarea dentro de esta obra…
                </p>
              )}
              {reviewedAssessmentError && (
                <p className={styles.reviewedEvidenceError} role="alert">
                  {reviewedAssessmentError}
                </p>
              )}
              {reviewedAssessment && !reviewedTask && (
                <p className={styles.reviewedEvidenceError} role="alert">
                  La tarea vinculada no está disponible en el cronograma actual. Recargá antes de continuar.
                </p>
              )}
              {reviewedAssessment && reviewedTask && (
                <>
                  <div className={styles.reviewedEvidenceFacts}>
                    <div>
                      <span>Tarea</span>
                      <strong>{reviewedTask.code ? `${reviewedTask.code} · ` : ''}{reviewedTask.title}</strong>
                    </div>
                    <div>
                      <span>Rango efectivo revisado</span>
                      <strong>{reviewedAssessment.rangeMin}%–{reviewedAssessment.rangeMax}%</strong>
                    </div>
                    <div>
                      <span>Decisión humana</span>
                      <strong>{reviewedAssessment.reviewStatus === 'CORRECTED' ? 'Rango corregido' : 'Lectura aprobada'}</strong>
                    </div>
                  </div>
                  <label>
                    Porcentaje puntual decidido por el Director
                    <input
                      aria-describedby="reviewed-progress-help"
                      max={reviewedAssessment.rangeMax}
                      min={reviewedAssessment.rangeMin}
                      onChange={(event) => {
                        setReviewedProgressInput({
                          selectionKey: reviewedSelectionKey,
                          value: event.target.value,
                        });
                        setError('');
                      }}
                      placeholder={`${reviewedAssessment.rangeMin}–${reviewedAssessment.rangeMax}`}
                      required
                      step="1"
                      type="number"
                      value={reviewedProgressPercent}
                    />
                  </label>
                  <small id="reviewed-progress-help" className={styles.reviewedEvidenceHelp}>
                    No elegimos promedio ni completamos este valor automáticamente. Debe ser un entero dentro del rango revisado.
                  </small>
                  <label>
                    Fundamento humano
                    <textarea
                      maxLength={MAX_RATIONALE_LENGTH}
                      onChange={(event) => {
                        setReviewedRationaleInput({
                          selectionKey: reviewedSelectionKey,
                          value: event.target.value,
                        });
                        setError('');
                      }}
                      placeholder="Explicá por qué este punto del rango representa el avance observado"
                      required
                      value={reviewedRationale}
                    />
                  </label>
                  <p className={styles.reviewedEvidenceGuardrail}>
                    Esta selección alimenta una observación y un forecast auditables. No certifica obra, no autoriza pagos y no modifica la tarea ni la baseline.
                  </p>
                </>
              )}
            </section>
          )}
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
          <button
            disabled={
              !canManage
              || loading
              || Boolean(busy)
              || !activeBaseline
              || !baselineMatchesVisiblePlan
              || (
                reviewedJourneyRequested
                && (
                  reviewedAssessmentLoading
                  || Boolean(reviewedAssessmentError)
                  || !reviewedAssessment
                  || !reviewedTask
                  || !reviewedPointValid
                  || !reviewedRationaleValid
                )
              )
            }
            type="submit"
          >
            {busy === 'forecast' ? 'Calculando…' : 'Guardar nuevo corte'}
          </button>
        </form>
      </div>

      {forecastDetailError && latestForecast && (
        <div className={styles.comparisonUnavailable} role="status">
          <i className="fa-solid fa-chart-gantt" aria-hidden="true" />
          <span>{forecastDetailError} El resumen contractual sigue disponible.</span>
        </div>
      )}

      {comparison.rows.length > 0 && (
        <section className={styles.forecastComparison} aria-labelledby="forecast-comparison-title">
          <div className={styles.comparisonHeading}>
            <div>
              <span className={styles.eyebrow}>Último corte guardado</span>
              <h3 id="forecast-comparison-title">Baseline vs. forecast por tarea</h3>
              <p>
                Comparación de sólo lectura. Las barras proyectadas no reescriben el plan vigente ni constituyen certificación.
              </p>
            </div>
            <div className={styles.comparisonLegend} aria-label="Leyenda de la comparación">
              <span><i data-kind="baseline" aria-hidden="true" />Baseline</span>
              <span><i data-kind="forecast" aria-hidden="true" />Forecast</span>
            </div>
          </div>

          <div className={styles.comparisonRows}>
            {comparison.rows.map((task) => {
              const title = `${task.code ? `${task.code} · ` : ''}${task.title || task.sourceTaskId}`;
              return (
                <article className={styles.comparisonRow} key={task.sourceTaskId}>
                  <div className={styles.comparisonTask}>
                    <strong>{title}</strong>
                    <div>
                      <span>{progressSourceLabel(task.progressSource)}</span>
                      <span>{Number(task.progressPercent) || 0}% observado</span>
                      <span className={Number(task.finishDeltaDays) > 0 ? styles.comparisonLate : styles.comparisonOnTime}>
                        {deltaLabel(task.finishDeltaDays)}
                      </span>
                    </div>
                    <small>{forecastDriverLabel(task.driver)}</small>
                  </div>
                  <div className={styles.comparisonTimeline}>
                    <div
                      aria-label={`${title}: baseline del ${formatDate(task.baselineStart)} al ${formatDate(task.baselineFinish)}`}
                      className={styles.comparisonTrack}
                      role="img"
                    >
                      <i
                        className={styles.baselineBar}
                        style={{ left: task.baselineBar.left, width: task.baselineBar.width }}
                      />
                    </div>
                    <div
                      aria-label={`${title}: forecast del ${formatDate(task.forecastStart)} al ${formatDate(task.forecastFinish)}`}
                      className={styles.comparisonTrack}
                      role="img"
                    >
                      <i
                        className={styles.forecastBar}
                        style={{ left: task.forecastBar.left, width: task.forecastBar.width }}
                      />
                    </div>
                    <div className={styles.comparisonDates}>
                      <span>Base {formatDate(task.baselineStart)} → {formatDate(task.baselineFinish)}</span>
                      <span>Previsto {formatDate(task.forecastStart)} → {formatDate(task.forecastFinish)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {comparison.total > comparison.rows.length && (
            <p className={styles.comparisonLimit}>
              Se muestran las {comparison.rows.length} tareas con mayor desvío absoluto de {comparison.total}. El cálculo guardado conserva el conjunto completo.
            </p>
          )}
        </section>
      )}

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
