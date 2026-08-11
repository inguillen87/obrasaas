'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import styles from './measurements.module.css';
import {
  apiErrorMessage,
  authoritativeBaselineQuantity,
  authoritativeMeasurementUnit,
  buildProgressMeasurementPayload,
  civilFortnightForDate,
  exactMeasurementSummary,
  initialFortnightDate,
  measurementBaselineIsRequired,
  MEASUREMENT_METHODS,
  MEASUREMENT_UNITS,
  mergeMeasurementHistoryPage,
  progressMeasurementAttempt,
  shouldApplyMeasurementSnapshot,
  snapshotConfirmsAttempt,
  uncertainProgressMeasurementAttempt,
} from './progress-measurements-state';

const HISTORY_LIMIT = 25;
const STATUS_LABELS = Object.freeze({
  PENDING: 'Pendiente de revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
});
const METHOD_LABELS = new Map(MEASUREMENT_METHODS);
const UNIT_LABELS = new Map(MEASUREMENT_UNITS);
const READINESS_LABELS = Object.freeze({
  NOT_DEFINED: 'Sin base definida',
  READY: 'Lista para medir',
  REVIEW_PENDING: 'Revisión pendiente',
});
function dateTimeFormatter(timeZone) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    });
  } catch {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    });
  }
}

function defaultForm(taskId, today) {
  return {
    taskId: taskId || '',
    periodDate: initialFortnightDate(today),
    unit: 'M2',
    baselineQuantity: '',
    executedQuantity: '',
    method: 'DIRECT_COUNT',
    rationale: '',
    evidenceIds: [],
  };
}

function newUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const words = globalThis.crypto.getRandomValues(new Uint32Array(4));
    return [...words].map((word) => word.toString(16).padStart(8, '0')).join('-');
  }
  throw new Error('El navegador no dispone de aleatoriedad segura para crear el intento.');
}

function attemptScopeKey(taskId, periodDate) {
  return `${taskId}:${periodDate}`;
}

function mutationIsAmbiguous(error) {
  return (
    !Number.isInteger(error?.status)
    || error.status >= 500
    || error.status === 408
    || error.status === 425
  );
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    cache: 'no-store',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(apiErrorMessage(payload, 'No se pudo completar la operación.'));
    error.status = response.status;
    error.code = payload?.code || null;
    throw error;
  }
  return payload;
}

function localDateTime(value, formatter) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return formatter.format(date);
}

function shortEvidenceId(value) {
  const id = String(value || '');
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function ReviewForm({
  busy,
  canApprove,
  measurement,
  onOpenPeriod,
  onSubmit,
  periodActive,
}) {
  const [decision, setDecision] = useState('APPROVE');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const pending = measurement.status === 'PENDING' && !measurement.review;
  const isMaker = measurement.preparedBy?.isCurrentActor === true;
  const canReview = pending && canApprove && !isMaker;

  function submit(event) {
    event.preventDefault();
    const normalizedReason = reason.trim().replace(/\s+/g, ' ');
    if (normalizedReason.length < 5 || normalizedReason.length > 1_000) {
      setError('El fundamento de la decisión debe tener entre 5 y 1.000 caracteres.');
      return;
    }
    setError('');
    onSubmit(measurement, { decision, reason: normalizedReason });
  }

  if (!pending) return null;
  if (isMaker) {
    return (
      <p className={styles.checkerNotice}>
        Separación maker-checker: quien preparó esta medición no puede decidirla.
      </p>
    );
  }
  if (canApprove && !periodActive) {
    return (
      <div className={styles.checkerNotice}>
        <p>Abrí esta quincena para obtener su cabecera CAS antes de decidir.</p>
        <button onClick={onOpenPeriod} type="button">Abrir quincena</button>
      </div>
    );
  }
  if (!canReview) {
    return (
      <p className={styles.checkerNotice}>
        Espera la decisión de un Director o Administrador distinto del preparador.
      </p>
    );
  }

  return (
    <form className={styles.reviewForm} onSubmit={submit}>
      <div className={styles.reviewHeading}>
        <div>
          <strong>Revisión independiente</strong>
          <small>La decisión queda append-only y no modifica Gantt ni pagos.</small>
        </div>
        <select
          aria-label="Decisión sobre la medición"
          disabled={busy}
          onChange={(event) => setDecision(event.target.value)}
          value={decision}
        >
          <option value="APPROVE">Aprobar</option>
          <option value="REJECT">Rechazar</option>
        </select>
      </div>
      <label>
        <span>Fundamento de la decisión</span>
        <textarea
          disabled={busy}
          maxLength={1_000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Criterio técnico verificable"
          required
          value={reason}
        />
      </label>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <button disabled={busy} type="submit">
        {busy ? 'Registrando decisión…' : 'Confirmar decisión'}
      </button>
    </form>
  );
}

function MeasurementCard({
  canApprove,
  dateFormatter,
  measurement,
  onOpenPeriod,
  onReview,
  periodActive,
  reviewBusy,
}) {
  const review = measurement.review;
  return (
    <article className={styles.measurementCard} data-status={measurement.status?.toLowerCase()}>
      <header className={styles.cardHeader}>
        <div>
          <small>{measurement.period?.label || 'Quincena civil'}</small>
          <strong>{measurement.executedQuantity} {UNIT_LABELS.get(measurement.unit) || measurement.unit}</strong>
        </div>
        <span className={styles.statusBadge} data-status={measurement.status?.toLowerCase()}>
          {STATUS_LABELS[measurement.status] || measurement.status}
        </span>
      </header>

      <dl className={styles.measurementFacts}>
        <div><dt>Base técnica</dt><dd>{measurement.baselineQuantity} {UNIT_LABELS.get(measurement.unit) || measurement.unit}</dd></div>
        <div><dt>Método</dt><dd>{METHOD_LABELS.get(measurement.method) || measurement.method}</dd></div>
        <div><dt>Revisión</dt><dd>#{measurement.revision}</dd></div>
      </dl>

      <div className={styles.rationale}>
        <strong>Fundamento técnico</strong>
        <p>{measurement.rationale}</p>
      </div>

      <div className={styles.evidenceReferences}>
        <strong>Evidencia aprobada vinculada</strong>
        <ul>
          {(measurement.evidence || []).map((evidence) => (
            <li key={evidence.id}>
              <span>{shortEvidenceId(evidence.id)}</span>
              <time dateTime={evidence.capturedAt || undefined}>{localDateTime(evidence.capturedAt, dateFormatter)}</time>
            </li>
          ))}
        </ul>
      </div>

      <ol aria-label="Línea de tiempo de propuesta y decisión" className={styles.decisionTimeline}>
        <li>
          <span aria-hidden="true"><i className="fa-solid fa-pen-ruler" /></span>
          <div>
            <strong>Propuesta preparada</strong>
            <small>{measurement.preparedBy?.label || 'Miembro de obra'} · {localDateTime(measurement.preparedAt, dateFormatter)}</small>
          </div>
        </li>
        <li data-complete={review ? 'true' : 'false'}>
          <span aria-hidden="true"><i className={review ? 'fa-solid fa-stamp' : 'fa-solid fa-hourglass-half'} /></span>
          <div>
            <strong>{review ? (review.decision === 'APPROVE' ? 'Medición aprobada' : 'Medición rechazada') : 'Decisión pendiente'}</strong>
            {review ? (
              <>
                <small>{review.reviewedBy?.label || 'Checker autorizado'} · {localDateTime(review.reviewedAt, dateFormatter)}</small>
                <p>{review.reason}</p>
              </>
            ) : <small>Debe actuar otra membresía autorizada.</small>}
          </div>
        </li>
      </ol>

      <ReviewForm
        busy={reviewBusy}
        canApprove={canApprove}
        measurement={measurement}
        onOpenPeriod={onOpenPeriod}
        onSubmit={onReview}
        periodActive={periodActive}
      />
    </article>
  );
}

export default function MeasurementsClient({
  approvedEvidence,
  approvedEvidenceTruncated,
  initialSnapshot,
  initialTaskId,
  organizationTimeZone,
  permissions,
  projectName,
  tasks,
  tasksTruncated,
  tenantToday,
}) {
  const initialPeriodStart = initialFortnightDate(tenantToday);
  const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId || '');
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loadState, setLoadState] = useState(initialSnapshot ? 'ready' : 'idle');
  const [form, setForm] = useState(() => defaultForm(initialTaskId, tenantToday));
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState(null);
  const [uncertainOperations, setUncertainOperations] = useState({
    submit: null,
    reviews: [],
  });
  const mountedRef = useRef(false);
  const selectedTaskRef = useRef(initialTaskId || '');
  const selectedPeriodRef = useRef(initialPeriodStart);
  const snapshotRef = useRef(initialSnapshot);
  const requestSequenceRef = useRef(0);
  const snapshotRequestRef = useRef(null);
  const initialSnapshotConsumedRef = useRef(false);
  const submitBusyRef = useRef(false);
  const reviewBusyRef = useRef(false);
  const mutationBusyRef = useRef(false);
  const submitAttemptsRef = useRef(new Map());
  const reviewAttemptsRef = useRef(new Map());

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [selectedTaskId, tasks],
  );
  const tenantDateTimeFormatter = useMemo(
    () => dateTimeFormatter(organizationTimeZone),
    [organizationTimeZone],
  );
  const taskEvidence = useMemo(
    () => approvedEvidence.filter((evidence) => evidence.taskId === selectedTaskId),
    [approvedEvidence, selectedTaskId],
  );
  const baselineRequired = measurementBaselineIsRequired(snapshot);
  const exactSummary = useMemo(() => exactMeasurementSummary(snapshot), [snapshot]);
  const preparationFailClosed = tasksTruncated || approvedEvidenceTruncated;
  const preparationBlockedByPending = snapshot?.readiness?.reviewPending === true;
  const canPrepare = permissions.canPrepare
    && !preparationFailClosed
    && !preparationBlockedByPending;
  let fortnight = null;
  try {
    fortnight = civilFortnightForDate(form.periodDate);
  } catch {
    fortnight = null;
  }
  const selectedPeriodStart = fortnight?.start || '';

  const uncertainSubmit = uncertainOperations.submit;
  const uncertainReviews = uncertainOperations.reviews;

  const loadSnapshot = useCallback(async ({
    append = false,
    cursor = null,
    periodDate,
    preserveNotice = false,
    taskId,
  }) => {
    if (!taskId || !periodDate) return null;
    const requestPeriodStart = civilFortnightForDate(periodDate).start;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    snapshotRequestRef.current?.controller.abort();
    const controller = new AbortController();
    snapshotRequestRef.current = {
      controller,
      requestPeriodStart,
      requestSequence,
      taskId,
    };
    if (mountedRef.current) {
      setLoadState(append ? 'loading-more' : 'loading');
      if (!preserveNotice) setNotice(null);
    }
    try {
      const query = new URLSearchParams({
        taskId,
        periodDate: requestPeriodStart,
        limit: String(HISTORY_LIMIT),
      });
      if (cursor) query.set('cursor', cursor);
      const incoming = await api(`/api/progress-measurements?${query.toString()}`, {
        signal: controller.signal,
      });
      const applies = mountedRef.current && shouldApplyMeasurementSnapshot({
        currentPeriodStart: selectedPeriodRef.current,
        currentSequence: requestSequenceRef.current,
        currentTaskId: selectedTaskRef.current,
        requestPeriodStart,
        requestSequence,
        requestTaskId: taskId,
        snapshot: incoming,
      });
      if (!applies || snapshotRequestRef.current?.controller !== controller) return null;
      if (
        append
        && (
          snapshotRef.current?.head?.id !== incoming?.head?.id
          || snapshotRef.current?.head?.revision !== incoming?.head?.revision
        )
      ) {
        setNotice({
          tone: 'warning',
          message: 'El corte cambió mientras se cargaba el historial. Volvé a cargarlo completo.',
        });
        setLoadState('error');
        return null;
      }
      if (append) {
        setSnapshot((current) => {
          const merged = mergeMeasurementHistoryPage(current, incoming, {
            taskId,
            headId: current?.head?.id || null,
          });
          snapshotRef.current = merged;
          return merged;
        });
      } else {
        snapshotRef.current = incoming;
        setSnapshot(incoming);
      }
      setLoadState('ready');
      return incoming;
    } catch (error) {
      if (error?.name === 'AbortError') return null;
      if (
        !mountedRef.current
        || requestSequenceRef.current !== requestSequence
        || selectedTaskRef.current !== taskId
        || selectedPeriodRef.current !== requestPeriodStart
      ) return null;
      setLoadState('error');
      setNotice({ tone: 'error', message: error.message || 'No se pudieron cargar las mediciones.' });
      return null;
    } finally {
      if (snapshotRequestRef.current?.controller === controller) {
        snapshotRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
      snapshotRequestRef.current?.controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedTaskId || !selectedPeriodStart) return;
    if (
      !initialSnapshotConsumedRef.current
      && initialSnapshot?.task?.id === selectedTaskId
      && selectedPeriodStart === initialPeriodStart
    ) {
      initialSnapshotConsumedRef.current = true;
      snapshotRef.current = initialSnapshot;
      return;
    }
    initialSnapshotConsumedRef.current = true;
    loadSnapshot({ periodDate: selectedPeriodStart, taskId: selectedTaskId });
  }, [
    initialPeriodStart,
    initialSnapshot,
    loadSnapshot,
    selectedPeriodStart,
    selectedTaskId,
  ]);

  function selectTask(event) {
    const taskId = event.target.value;
    const periodDate = initialPeriodStart;
    selectedTaskRef.current = taskId;
    selectedPeriodRef.current = periodDate;
    requestSequenceRef.current += 1;
    snapshotRequestRef.current?.controller.abort();
    snapshotRef.current = null;
    setSelectedTaskId(taskId);
    setSnapshot(null);
    setForm(defaultForm(taskId, tenantToday));
    setFormError('');
    setNotice(null);
    const submit = submitAttemptsRef.current.get(attemptScopeKey(taskId, periodDate));
    setUncertainOperations({
      submit: submit?.state === 'UNCERTAIN' ? submit : null,
      reviews: [...reviewAttemptsRef.current.values()].filter((attempt) => (
        attempt.taskId === taskId
        && attempt.periodDate === periodDate
        && attempt.state === 'UNCERTAIN'
      )),
    });
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePeriodDate(value) {
    let periodDate = '';
    try {
      periodDate = civilFortnightForDate(value).start;
    } catch {
      periodDate = '';
    }
    setFormError('');
    if (periodDate && selectedPeriodRef.current === periodDate) {
      setForm((current) => ({ ...current, periodDate: value }));
      return;
    }
    setForm((current) => ({
      ...current,
      periodDate: value,
      ...(periodDate
        ? { executedQuantity: '', rationale: '', evidenceIds: [] }
        : {}),
    }));
    selectedPeriodRef.current = periodDate;
    requestSequenceRef.current += 1;
    snapshotRequestRef.current?.controller.abort();
    snapshotRef.current = null;
    setSnapshot(null);
    setLoadState(periodDate ? 'loading' : 'idle');
    setNotice(null);
    const taskId = selectedTaskRef.current;
    const submit = submitAttemptsRef.current.get(attemptScopeKey(taskId, periodDate));
    setUncertainOperations({
      submit: submit?.state === 'UNCERTAIN' ? submit : null,
      reviews: [...reviewAttemptsRef.current.values()].filter((attempt) => (
        attempt.taskId === taskId
        && attempt.periodDate === periodDate
        && attempt.state === 'UNCERTAIN'
      )),
    });
  }

  function openMeasurementPeriod(periodDate) {
    updatePeriodDate(periodDate);
    setNotice({
      tone: 'neutral',
      message: 'Se abrió la quincena de la propuesta. Esperá la lectura autoritativa antes de decidir.',
    });
  }

  function toggleEvidence(evidenceId) {
    if (form.evidenceIds.includes(evidenceId)) {
      setForm((current) => ({
        ...current,
        evidenceIds: current.evidenceIds.filter((id) => id !== evidenceId),
      }));
      return;
    }
    if (form.evidenceIds.length >= 10) {
      setFormError('Podés vincular como máximo 10 evidencias aprobadas.');
      return;
    }
    setFormError('');
    setForm((current) => ({
      ...current,
      evidenceIds: [...current.evidenceIds, evidenceId],
    }));
  }

  function publishAttemptState() {
    if (!mountedRef.current) return;
    const taskId = selectedTaskRef.current;
    const periodDate = selectedPeriodRef.current;
    const submit = submitAttemptsRef.current.get(attemptScopeKey(taskId, periodDate));
    setUncertainOperations({
      submit: submit?.state === 'UNCERTAIN' ? submit : null,
      reviews: [...reviewAttemptsRef.current.values()].filter((attempt) => (
        attempt.taskId === taskId
        && attempt.periodDate === periodDate
        && attempt.state === 'UNCERTAIN'
      )),
    });
  }

  async function performSubmit(attempt) {
    if (submitBusyRef.current || mutationBusyRef.current) return;
    submitBusyRef.current = true;
    mutationBusyRef.current = true;
    if (mountedRef.current) {
      setSubmitBusy(true);
      setNotice({ tone: 'neutral', message: 'Enviando una única propuesta…' });
    }
    try {
      const result = await api('/api/progress-measurements', {
        method: 'POST',
        headers: { 'Idempotency-Key': attempt.operationKey },
        body: JSON.stringify(attempt.body),
      });
      if (
        !result?.measurement?.id
        || result.measurement.taskId !== attempt.taskId
        || !result?.head?.id
      ) {
        const error = new Error('La respuesta no confirmó el contrato de la medición.');
        error.status = null;
        throw error;
      }
      const scopeKey = attemptScopeKey(attempt.taskId, attempt.body.periodDate);
      submitAttemptsRef.current.delete(scopeKey);
      publishAttemptState();
      if (
        mountedRef.current
        && selectedTaskRef.current === attempt.taskId
        && selectedPeriodRef.current === attempt.body.periodDate
      ) {
        setForm((current) => ({
          ...current,
          executedQuantity: '',
          rationale: '',
          evidenceIds: [],
        }));
        setNotice({
          tone: 'success',
          message: result.replayed
            ? 'La propuesta ya estaba registrada; no se creó un duplicado.'
            : 'Propuesta registrada. Se actualiza desde la fuente autoritativa.',
        });
        await loadSnapshot({
          periodDate: attempt.body.periodDate,
          taskId: attempt.taskId,
          preserveNotice: true,
        });
      }
    } catch (error) {
      if (mutationIsAmbiguous(error)) {
        submitAttemptsRef.current.set(
          attemptScopeKey(attempt.taskId, attempt.body.periodDate),
          uncertainProgressMeasurementAttempt(attempt),
        );
        publishAttemptState();
        if (
          mountedRef.current
          && selectedTaskRef.current === attempt.taskId
          && selectedPeriodRef.current === attempt.body.periodDate
        ) {
          setNotice({
            tone: 'warning',
            message: 'Resultado incierto: se conservó exactamente la clave y el body. No se reintentó automáticamente.',
          });
        }
      } else {
        submitAttemptsRef.current.delete(
          attemptScopeKey(attempt.taskId, attempt.body.periodDate),
        );
        publishAttemptState();
        if (
          mountedRef.current
          && selectedTaskRef.current === attempt.taskId
          && selectedPeriodRef.current === attempt.body.periodDate
        ) {
          setNotice({ tone: 'error', message: error.message });
          if (error.status === 409) {
            await loadSnapshot({
              periodDate: attempt.body.periodDate,
              taskId: attempt.taskId,
              preserveNotice: true,
            });
          }
        }
      }
    } finally {
      submitBusyRef.current = false;
      mutationBusyRef.current = false;
      if (mountedRef.current) setSubmitBusy(false);
    }
  }

  async function submitMeasurement(event) {
    event.preventDefault();
    if (
      !canPrepare
      || submitBusyRef.current
      || mutationBusyRef.current
      || loadState !== 'ready'
    ) return;
    try {
      const eligibleIds = new Set(taskEvidence.map((evidence) => evidence.id));
      if (form.evidenceIds.some((id) => !eligibleIds.has(id))) {
        throw new Error('La evidencia seleccionada ya no pertenece al catálogo aprobado de esta tarea.');
      }
      const payload = buildProgressMeasurementPayload(form, snapshotRef.current);
      const scopeKey = attemptScopeKey(payload.taskId, payload.periodDate);
      const previous = submitAttemptsRef.current.get(scopeKey) || null;
      if (previous?.state === 'UNCERTAIN') {
        setNotice({
          tone: 'warning',
          message: 'Primero conciliá el intento incierto. No se generó una clave nueva.',
        });
        return;
      }
      const attempt = progressMeasurementAttempt(previous, payload, newUuid);
      submitAttemptsRef.current.set(scopeKey, attempt);
      publishAttemptState();
      setFormError('');
      await performSubmit(attempt);
    } catch (error) {
      setFormError(error.message || 'Revisá los datos de la medición.');
    }
  }

  function reviewAttempt(measurement, input, expectedRevision) {
    const body = {
      expectedRevision,
      decision: input.decision,
      reason: input.reason,
    };
    const payloadKey = JSON.stringify(body);
    const current = reviewAttemptsRef.current.get(measurement.id);
    if (current?.payloadKey === payloadKey) return current;
    return {
      measurementId: measurement.id,
      taskId: measurement.taskId,
      periodDate: measurement.period?.start,
      body,
      payloadKey,
      operationKey: `progress-measurement-review-${newUuid()}`,
      state: 'READY',
    };
  }

  async function performReview(attempt) {
    if (reviewBusyRef.current || mutationBusyRef.current) return;
    reviewBusyRef.current = true;
    mutationBusyRef.current = true;
    if (mountedRef.current) {
      setReviewBusyId(attempt.measurementId);
      setNotice({ tone: 'neutral', message: 'Registrando una única decisión…' });
    }
    try {
      const result = await api(
        `/api/progress-measurements/${encodeURIComponent(attempt.measurementId)}/review`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': attempt.operationKey },
          body: JSON.stringify(attempt.body),
        },
      );
      if (
        result?.measurement?.id !== attempt.measurementId
        || result.measurement.taskId !== attempt.taskId
        || !result.measurement.review
      ) {
        const error = new Error('La respuesta no confirmó la decisión de la medición.');
        error.status = null;
        throw error;
      }
      reviewAttemptsRef.current.delete(attempt.measurementId);
      publishAttemptState();
      if (
        mountedRef.current
        && selectedTaskRef.current === attempt.taskId
        && selectedPeriodRef.current === attempt.periodDate
      ) {
        setNotice({
          tone: 'success',
          message: result.replayed
            ? 'La decisión ya estaba registrada; no se duplicó.'
            : 'Decisión registrada. Se concilia el acumulado autoritativo.',
        });
        await loadSnapshot({
          periodDate: attempt.periodDate,
          taskId: attempt.taskId,
          preserveNotice: true,
        });
      }
    } catch (error) {
      if (mutationIsAmbiguous(error)) {
        reviewAttemptsRef.current.set(attempt.measurementId, {
          ...attempt,
          state: 'UNCERTAIN',
        });
        publishAttemptState();
        if (
          mountedRef.current
          && selectedTaskRef.current === attempt.taskId
          && selectedPeriodRef.current === attempt.periodDate
        ) {
          setNotice({
            tone: 'warning',
            message: 'La decisión quedó incierta. Se preservaron clave y body; no hubo reintento automático.',
          });
        }
      } else {
        reviewAttemptsRef.current.delete(attempt.measurementId);
        publishAttemptState();
        if (
          mountedRef.current
          && selectedTaskRef.current === attempt.taskId
          && selectedPeriodRef.current === attempt.periodDate
        ) {
          setNotice({ tone: 'error', message: error.message });
          if (error.status === 409) {
            await loadSnapshot({
              periodDate: attempt.periodDate,
              taskId: attempt.taskId,
              preserveNotice: true,
            });
          }
        }
      }
    } finally {
      reviewBusyRef.current = false;
      mutationBusyRef.current = false;
      if (mountedRef.current) setReviewBusyId(null);
    }
  }

  async function submitReview(measurement, input) {
    if (
      reviewBusyRef.current
      || mutationBusyRef.current
      || !permissions.canApprove
      || measurement.preparedBy?.isCurrentActor === true
    ) return;
    if (selectedPeriodRef.current !== measurement.period?.start) {
      setNotice({
        tone: 'warning',
        message: 'Abrí la quincena de esta propuesta antes de decidirla.',
      });
      return;
    }
    const head = snapshotRef.current?.head;
    if (
      head?.pendingMeasurementId !== measurement.id
      || !Number.isSafeInteger(head?.revision)
      || head.revision < 1
    ) {
      setNotice({
        tone: 'error',
        message: 'La cabecera cambió o esta propuesta ya no es la pendiente autoritativa. Actualizá antes de decidir.',
      });
      await loadSnapshot({
        periodDate: measurement.period.start,
        taskId: measurement.taskId,
        preserveNotice: true,
      });
      return;
    }
    const previous = reviewAttemptsRef.current.get(measurement.id);
    if (previous?.state === 'UNCERTAIN') {
      setNotice({
        tone: 'warning',
        message: 'Primero conciliá la decisión incierta. No se generó una clave nueva.',
      });
      return;
    }
    const attempt = reviewAttempt(measurement, input, head.revision);
    reviewAttemptsRef.current.set(measurement.id, attempt);
    publishAttemptState();
    await performReview(attempt);
  }

  async function reconcileUncertain() {
    const taskId = selectedTaskRef.current;
    const periodDate = selectedPeriodRef.current;
    const incoming = await loadSnapshot({ periodDate, taskId, preserveNotice: true });
    if (
      !incoming
      || selectedTaskRef.current !== taskId
      || selectedPeriodRef.current !== periodDate
    ) return;
    let confirmed = 0;
    const scopeKey = attemptScopeKey(taskId, periodDate);
    const submitAttempt = submitAttemptsRef.current.get(scopeKey);
    if (submitAttempt?.state === 'UNCERTAIN') {
      if (snapshotConfirmsAttempt(incoming, submitAttempt)) {
        submitAttemptsRef.current.delete(scopeKey);
        confirmed += 1;
        setForm((current) => ({
          ...current,
          executedQuantity: '',
          rationale: '',
          evidenceIds: [],
        }));
      } else {
        submitAttemptsRef.current.set(scopeKey, { ...submitAttempt, reconciled: true });
      }
    }
    for (const attempt of reviewAttemptsRef.current.values()) {
      if (
        attempt.taskId !== taskId
        || attempt.periodDate !== periodDate
        || attempt.state !== 'UNCERTAIN'
      ) continue;
      const measurement = incoming.measurements?.find(({ id }) => id === attempt.measurementId);
      if (
        measurement?.review?.decision === attempt.body.decision
        && measurement.review.reason === attempt.body.reason
      ) {
        reviewAttemptsRef.current.delete(attempt.measurementId);
        confirmed += 1;
      } else {
        reviewAttemptsRef.current.set(attempt.measurementId, { ...attempt, reconciled: true });
      }
    }
    publishAttemptState();
    setNotice(confirmed > 0
      ? { tone: 'success', message: 'La lectura autoritativa confirmó la operación incierta.' }
      : {
          tone: 'warning',
          message: 'La operación aún no aparece. Podés reenviar manualmente la misma clave y el mismo body.',
        });
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>S9.1 · Control técnico</span>
          <h1>Mediciones de avance</h1>
          <p>{projectName} · cantidades exactas por tarea y quincena civil.</p>
        </div>
        <div className={styles.scopeNotice}>
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          <span>No certifica pagos ni cambia Gantt, presupuesto o Task.progress.</span>
        </div>
      </header>

      {(tasksTruncated || approvedEvidenceTruncated) && (
        <div className={styles.failClosed} role="alert">
          El catálogo supera el límite seguro. La lectura sigue disponible, pero preparar nuevas mediciones quedó bloqueado para no operar sobre datos parciales.
        </div>
      )}

      <section aria-labelledby="measurement-task-heading" className={styles.taskSelector}>
        <div>
          <span className={styles.sectionIndex}>01</span>
          <div>
            <h2 id="measurement-task-heading">Partida a medir</h2>
            <p>Seleccioná una tarea canónica. Los hitos no admiten cantidades.</p>
          </div>
        </div>
        <label>
          <span>Tarea</span>
          <select onChange={selectTask} value={selectedTaskId}>
            {tasks.length === 0 && <option value="">No hay tareas medibles</option>}
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.code ? `${task.code} · ` : ''}{task.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div aria-atomic="true" aria-live="polite" className={styles.liveRegion}>
        {notice && <p data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p>}
      </div>

      {(uncertainSubmit || uncertainReviews.length > 0) && (
        <section className={styles.uncertainPanel} aria-labelledby="uncertain-heading">
          <div>
            <strong id="uncertain-heading">Operación pendiente de conciliación</strong>
            <p>Primero consultá el estado autoritativo. El sistema nunca reenvía solo.</p>
          </div>
          <div className={styles.uncertainActions}>
            <button
              disabled={loadState === 'loading' || submitBusy || Boolean(reviewBusyId)}
              onClick={reconcileUncertain}
              type="button"
            >
              Conciliar ahora
            </button>
            {uncertainSubmit?.reconciled && (
              <button disabled={submitBusy} onClick={() => performSubmit(uncertainSubmit)} type="button">
                Reenviar misma propuesta
              </button>
            )}
            {uncertainReviews.filter((attempt) => attempt.reconciled).map((attempt) => (
              <button
                disabled={Boolean(reviewBusyId)}
                key={attempt.measurementId}
                onClick={() => performReview(attempt)}
                type="button"
              >
                Reenviar misma decisión
              </button>
            ))}
          </div>
        </section>
      )}

      {!selectedTask ? (
        <section className={styles.emptyState}>
          <i className="fa-solid fa-ruler-combined" aria-hidden="true" />
          <h2>No hay una tarea medible seleccionada</h2>
          <p>Creá primero una tarea canónica de tipo TASK.</p>
        </section>
      ) : (
        <div className={styles.workspace}>
          <section aria-labelledby="measurement-summary-heading" className={styles.summaryPanel}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionIndex}>02</span>
              <div>
                <h2 id="measurement-summary-heading">Corte autoritativo</h2>
                <p>{selectedTask.code || 'Sin código'} · {selectedTask.title}</p>
              </div>
            </div>

            {loadState === 'loading' && <p className={styles.loading} role="status">Cargando mediciones…</p>}
            {loadState === 'error' && (
              <button onClick={() => loadSnapshot({
                periodDate: selectedPeriodStart,
                taskId: selectedTaskId,
              })} type="button">
                Reintentar lectura
              </button>
            )}
            {snapshot && exactSummary && (
              <>
                <div className={styles.metrics}>
                  <div><small>Base técnica</small><strong>{exactSummary.baseline} {UNIT_LABELS.get(authoritativeMeasurementUnit(snapshot)) || authoritativeMeasurementUnit(snapshot)}</strong></div>
                  <div><small>Aprobado</small><strong>{exactSummary.approved} {UNIT_LABELS.get(authoritativeMeasurementUnit(snapshot)) || authoritativeMeasurementUnit(snapshot)}</strong></div>
                  <div><small>Restante</small><strong>{exactSummary.remaining} {UNIT_LABELS.get(authoritativeMeasurementUnit(snapshot)) || authoritativeMeasurementUnit(snapshot)}</strong></div>
                  <div><small>Avance derivado</small><strong>{exactSummary.percent}%</strong></div>
                </div>
                <div className={styles.progressTrack} aria-label={`Avance derivado ${exactSummary.percent}%`}>
                  <span style={{ '--measurement-progress': `min(100%, ${exactSummary.percent}%)` }} />
                </div>
                {exactSummary.inconsistent && (
                  <p className={styles.formError} role="alert">El acumulado recibido supera la base. No prepares operaciones.</p>
                )}
              </>
            )}
            {snapshot && (
              <p className={styles.readinessBadge} data-state={snapshot.readiness?.state?.toLowerCase()}>
                {READINESS_LABELS[snapshot.readiness?.state] || 'Estado no disponible'}
              </p>
            )}
            {snapshot && !exactSummary && (
              <div className={styles.notDefined}>
                <strong>Base aún no definida</strong>
                <p>La primera propuesta aprobada fijará unidad y cantidad base para esta tarea.</p>
              </div>
            )}
          </section>

          {permissions.canPrepare && (
            <section aria-labelledby="measurement-prepare-heading" className={styles.preparePanel}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIndex}>03</span>
                <div>
                  <h2 id="measurement-prepare-heading">Preparar propuesta</h2>
                  <p>La propuesta queda pendiente hasta una revisión independiente.</p>
                </div>
              </div>

              <form className={styles.measurementForm} onSubmit={submitMeasurement}>
                {preparationBlockedByPending && (
                  <div className={styles.pendingBlock} role="status">
                    <strong>Ya existe una propuesta pendiente para esta tarea</strong>
                    <p>
                      {snapshot.readiness.blockingPeriod?.label || 'Otra quincena'} debe aprobarse o rechazarse antes de preparar una nueva.
                    </p>
                    {!snapshot.readiness.pendingIsRequestedPeriod && snapshot.readiness.blockingPeriod?.start && (
                      <button
                        onClick={() => openMeasurementPeriod(snapshot.readiness.blockingPeriod.start)}
                        type="button"
                      >
                        Abrir quincena pendiente
                      </button>
                    )}
                  </div>
                )}
                <fieldset disabled={!canPrepare || submitBusy || Boolean(reviewBusyId) || Boolean(uncertainSubmit) || loadState !== 'ready'}>
                  <legend>Período y cantidad</legend>
                  <div className={styles.formGrid}>
                    <label>
                      <span>Fecha dentro de la quincena</span>
                      <input
                        max={tenantToday}
                        onChange={(event) => updatePeriodDate(event.target.value)}
                        required
                        type="date"
                        value={form.periodDate}
                      />
                      <small>{fortnight?.label || 'Fecha civil inválida'}</small>
                    </label>
                    {baselineRequired ? (
                      <>
                        <label>
                          <span>Unidad técnica</span>
                          <select onChange={(event) => updateForm('unit', event.target.value)} value={form.unit}>
                            {MEASUREMENT_UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Cantidad base</span>
                          <input
                            autoComplete="off"
                            inputMode="decimal"
                            onChange={(event) => updateForm('baselineQuantity', event.target.value)}
                            pattern="(?:0|[1-9][0-9]{0,13})(?:[.][0-9]{1,4})?"
                            placeholder="125.5000"
                            required
                            type="text"
                            value={form.baselineQuantity}
                          />
                        </label>
                      </>
                    ) : (
                      <div className={styles.fixedBasis}>
                        <span>Base fijada</span>
                        <strong>{authoritativeBaselineQuantity(snapshot)} {UNIT_LABELS.get(authoritativeMeasurementUnit(snapshot)) || authoritativeMeasurementUnit(snapshot)}</strong>
                        <small>No se edita desde una medición posterior.</small>
                      </div>
                    )}
                    <label>
                      <span>Cantidad ejecutada en el período</span>
                      <input
                        autoComplete="off"
                        inputMode="decimal"
                        onChange={(event) => updateForm('executedQuantity', event.target.value)}
                        pattern="(?:0|[1-9][0-9]{0,13})(?:[.][0-9]{1,4})?"
                        placeholder="12.7500"
                        required
                        type="text"
                        value={form.executedQuantity}
                      />
                    </label>
                  </div>
                </fieldset>

                <fieldset disabled={!canPrepare || submitBusy || Boolean(reviewBusyId) || Boolean(uncertainSubmit) || loadState !== 'ready'}>
                  <legend>Método y trazabilidad</legend>
                  <label>
                    <span>Método</span>
                    <select onChange={(event) => updateForm('method', event.target.value)} value={form.method}>
                      {MEASUREMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Fundamento técnico</span>
                    <textarea
                      maxLength={1_000}
                      minLength={10}
                      onChange={(event) => updateForm('rationale', event.target.value)}
                      placeholder="Describí cómo se obtuvo y verificó la cantidad."
                      required
                      value={form.rationale}
                    />
                    <small>{form.rationale.length}/1.000</small>
                  </label>
                </fieldset>

                <fieldset disabled={!canPrepare || submitBusy || Boolean(reviewBusyId) || Boolean(uncertainSubmit) || loadState !== 'ready'}>
                  <legend>Evidencia aprobada · 1 a 10</legend>
                  {taskEvidence.length === 0 ? (
                    <p className={styles.noEvidence}>Esta tarea todavía no tiene evidencia aprobada elegible.</p>
                  ) : (
                    <div className={styles.evidencePicker}>
                      {taskEvidence.map((evidence) => (
                        <label key={evidence.id}>
                          <input
                            checked={form.evidenceIds.includes(evidence.id)}
                            onChange={() => toggleEvidence(evidence.id)}
                            type="checkbox"
                          />
                          <span>
                            <strong>Evidencia {shortEvidenceId(evidence.id)}</strong>
                            <small>{localDateTime(evidence.capturedAt, tenantDateTimeFormatter)}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <small>{form.evidenceIds.length}/10 seleccionadas</small>
                </fieldset>

                {formError && <p className={styles.formError} role="alert">{formError}</p>}
                <button
                  className={styles.primaryAction}
                  disabled={!canPrepare || submitBusy || Boolean(reviewBusyId) || Boolean(uncertainSubmit) || loadState !== 'ready' || taskEvidence.length === 0}
                  type="submit"
                >
                  {submitBusy ? 'Enviando una vez…' : 'Enviar a revisión'}
                </button>
                <p className={styles.mutationDisclaimer}>
                  No hay aprobación optimista. Ante una respuesta incierta, se conserva el mismo intento y se concilia por GET.
                </p>
              </form>
            </section>
          )}

          <section aria-labelledby="measurement-history-heading" className={styles.historyPanel}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionIndex}>04</span>
              <div>
                <h2 id="measurement-history-heading">Historial inmutable</h2>
                <p>Propuestas y decisiones, de la más reciente a la más antigua.</p>
              </div>
            </div>
            {snapshot?.measurements?.length ? (
              <div className={styles.historyList}>
                {snapshot.measurements.map((measurement) => (
                  <MeasurementCard
                    canApprove={permissions.canApprove}
                    dateFormatter={tenantDateTimeFormatter}
                    key={measurement.id}
                    measurement={measurement}
                    onOpenPeriod={() => openMeasurementPeriod(measurement.period.start)}
                    onReview={submitReview}
                    periodActive={measurement.period?.start === selectedPeriodStart}
                    reviewBusy={Boolean(reviewBusyId) || submitBusy}
                  />
                ))}
              </div>
            ) : loadState === 'ready' ? (
              <div className={styles.emptyHistory}>
                <i className="fa-solid fa-layer-group" aria-hidden="true" />
                <p>No hay mediciones para esta tarea.</p>
              </div>
            ) : null}
            {snapshot?.nextCursor && (
              <button
                className={styles.loadMore}
                disabled={loadState === 'loading-more'}
                onClick={() => loadSnapshot({
                  append: true,
                  cursor: snapshot.nextCursor,
                  periodDate: selectedPeriodStart,
                  preserveNotice: true,
                  taskId: selectedTaskId,
                })}
                type="button"
              >
                {loadState === 'loading-more' ? 'Cargando…' : 'Cargar más'}
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
