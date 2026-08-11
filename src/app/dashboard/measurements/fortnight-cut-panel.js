'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import styles from './measurements.module.css';
import {
  buildProgressMeasurementCutPayload,
  cutCandidateCounts,
  cutCandidateRows,
  cutFreshness,
  inactiveProgressMeasurementCutLoadState,
  latestClosedFortnightDate,
  progressMeasurementCutAttempt,
  progressMeasurementCutSnapshotIsUsable,
  progressMeasurementCutSnapshotConfirmsAttempt,
  shouldApplyProgressMeasurementCutSnapshot,
  uncertainProgressMeasurementCutAttempt,
} from './progress-measurement-cuts-state';
import {
  apiErrorMessage,
  civilFortnightForDate,
  exactMeasurementSummary,
  MEASUREMENT_UNITS,
} from './progress-measurements-state';

const UNIT_LABELS = new Map(MEASUREMENT_UNITS);
const READINESS_LABELS = Object.freeze({
  REVIEW_PENDING: 'Revisión de medición pendiente',
  EMPTY: 'Sin mediciones aprobadas',
  READY: 'Listo para sellar',
  UP_TO_DATE: 'Corte vigente',
  STALE: 'Corte desactualizado',
});
const CHANGE_LABELS = Object.freeze({
  ADDED: 'Nueva línea candidata',
  CHANGED: 'Snapshot modificado',
  UNCHANGED: 'Sin cambios',
  REMOVED: 'Tarea fuera de la fuente',
  REVIEW_REQUIRED: 'Cambio de fuente; revisar',
});
const FRESHNESS_LABELS = Object.freeze({
  NOT_SEALED: 'Todavía no existe un corte sellado',
  STALE: 'El último corte está desactualizado',
  UP_TO_DATE: 'El último corte coincide con la fuente vigente',
  UNKNOWN: 'Vigencia no confirmada por el servidor',
});
const BLOCKING_REASON_LABELS = Object.freeze({
  REVIEW_PENDING: 'Hay mediciones pendientes de decisión en la obra.',
  NO_APPROVED_MEASUREMENTS: 'La quincena no tiene mediciones aprobadas para sellar.',
  CUT_UNCHANGED: 'La composición aprobada ya coincide con el último corte.',
  PROJECT_ARCHIVED: 'La obra archivada es de solo lectura.',
  PERIOD_OPEN: 'La quincena todavía no cerró en la zona horaria de la organización.',
  PERMISSION_REQUIRED: 'Tu rol permite leer el corte, pero no sellarlo.',
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

function localDateTime(value, formatter) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return formatter.format(date);
}

function newUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const words = globalThis.crypto.getRandomValues(new Uint32Array(4));
    return [...words].map((word) => word.toString(16).padStart(8, '0')).join('-');
  }
  throw new Error('El navegador no dispone de aleatoriedad segura para crear el intento.');
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

function shortDigest(value) {
  const digest = String(value || '');
  if (!digest) return 'No disponible';
  return digest.length > 20 ? `${digest.slice(0, 12)}…${digest.slice(-8)}` : digest;
}

function count(snapshot, field, fallback) {
  const value = snapshot?.readiness?.[field] ?? snapshot?.candidate?.[field];
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function latestCount(latestCut, field, fallback) {
  const value = latestCut?.[field];
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function measurementSummary(measurement) {
  if (!measurement) {
    return {
      primary: 'Ausente',
      secondary: 'Sin medición aprobada; no equivale a cero.',
    };
  }
  const unit = UNIT_LABELS.get(measurement.unit) || measurement.unit || 'unidad no disponible';
  const cumulative = typeof measurement.cumulativeQuantity === 'string'
    ? measurement.cumulativeQuantity
    : 'Cantidad no disponible';
  const executed = typeof measurement.executedQuantity === 'string'
    ? measurement.executedQuantity
    : 'Cantidad no disponible';
  const baseline = typeof measurement.baselineQuantity === 'string'
    ? measurement.baselineQuantity
    : 'Cantidad no disponible';
  const percent = typeof measurement.percent === 'string'
    ? measurement.percent
    : exactMeasurementSummary({
        approved: {
          baselineQuantity: measurement.baselineQuantity,
          quantity: measurement.cumulativeQuantity,
          unit: measurement.unit,
        },
      })?.percent;
  return {
    primary: `${cumulative} ${unit} acumulado`,
    secondary: `Base ${baseline} ${unit} · período ${executed} ${unit} · ${percent || '—'}% · medición r${measurement.revision ?? '—'}`,
  };
}

function SnapshotCell({ line }) {
  const summary = measurementSummary(line?.measurement || null);
  return (
    <div className={styles.cutLineValue} data-absent={line?.measurement ? 'false' : 'true'}>
      <strong>{summary.primary}</strong>
      <small>{summary.secondary}</small>
    </div>
  );
}

export default function FortnightCutPanel({
  active,
  canSeal,
  initialSnapshot,
  organizationTimeZone,
  tenantToday,
}) {
  const latestClosedDate = latestClosedFortnightDate(tenantToday);
  const initialPeriodStart = civilFortnightForDate(latestClosedDate).start;
  const matchingInitialSnapshot = progressMeasurementCutSnapshotIsUsable(initialSnapshot, {
    periodStart: initialPeriodStart,
    timeZone: organizationTimeZone,
  })
    ? initialSnapshot
    : null;
  const [periodDate, setPeriodDate] = useState(initialPeriodStart);
  const [snapshot, setSnapshot] = useState(matchingInitialSnapshot);
  const [loadState, setLoadState] = useState(matchingInitialSnapshot ? 'ready' : 'idle');
  const [notice, setNotice] = useState(null);
  const [sealBusy, setSealBusy] = useState(false);
  const [uncertainAttempt, setUncertainAttempt] = useState(null);
  const mountedRef = useRef(false);
  const activeRef = useRef(active);
  const selectedPeriodRef = useRef(initialPeriodStart);
  const snapshotRef = useRef(matchingInitialSnapshot);
  const requestSequenceRef = useRef(0);
  const snapshotRequestRef = useRef(null);
  const sealBusyRef = useRef(false);
  const attemptRef = useRef(null);

  const period = useMemo(() => {
    try {
      return civilFortnightForDate(periodDate);
    } catch {
      return null;
    }
  }, [periodDate]);
  const formatter = useMemo(
    () => dateTimeFormatter(organizationTimeZone),
    [organizationTimeZone],
  );
  const rows = useMemo(() => cutCandidateRows(snapshot), [snapshot]);
  const derivedCounts = useMemo(() => cutCandidateCounts(snapshot), [snapshot]);
  const freshness = cutFreshness(snapshot);
  const latestCut = snapshot?.latestCut || null;
  const taskCount = count(snapshot, 'taskCount', derivedCounts.taskCount);
  const measuredLineCount = count(snapshot, 'measuredLineCount', derivedCounts.measured);
  const missingLineCount = count(snapshot, 'missingLineCount', derivedCounts.missing);
  const latestMeasuredCount = latestCount(
    latestCut,
    'measuredLineCount',
    latestCount(latestCut, 'lineCount', Array.isArray(latestCut?.lines) ? latestCut.lines.length : 0),
  );
  const latestMissingCount = latestCount(latestCut, 'missingLineCount', null);
  const serverCanSeal = canSeal && snapshot?.readiness?.canSeal === true;

  const loadSnapshot = useCallback(async ({ periodStart, preserveNotice = false }) => {
    if (!periodStart) return null;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    snapshotRequestRef.current?.controller.abort();
    const controller = new AbortController();
    snapshotRequestRef.current = { controller, periodStart, requestSequence };
    if (mountedRef.current) {
      setLoadState('loading');
      if (!preserveNotice) setNotice(null);
    }
    try {
      const query = new URLSearchParams({ periodDate: periodStart });
      const incoming = await api(`/api/progress-measurement-cuts?${query.toString()}`, {
        signal: controller.signal,
      });
      if (!progressMeasurementCutSnapshotIsUsable(incoming, {
        periodStart,
        timeZone: organizationTimeZone,
      })) {
        throw new Error('La respuesta no cumple el contrato del corte técnico.');
      }
      const applies = mountedRef.current && shouldApplyProgressMeasurementCutSnapshot({
        currentPeriodStart: selectedPeriodRef.current,
        currentSequence: requestSequenceRef.current,
        requestPeriodStart: periodStart,
        requestSequence,
        snapshot: incoming,
      });
      if (!applies || snapshotRequestRef.current?.controller !== controller) return null;
      snapshotRef.current = incoming;
      setSnapshot(incoming);
      setLoadState('ready');
      return incoming;
    } catch (error) {
      if (error?.name === 'AbortError') return null;
      if (
        !mountedRef.current
        || requestSequenceRef.current !== requestSequence
        || selectedPeriodRef.current !== periodStart
      ) return null;
      setLoadState('error');
      setNotice({
        tone: 'error',
        message: error.message || 'No se pudo cargar el corte quincenal.',
      });
      return null;
    } finally {
      if (snapshotRequestRef.current?.controller === controller) {
        snapshotRequestRef.current = null;
      }
    }
  }, [organizationTimeZone]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
      snapshotRequestRef.current?.controller.abort();
    };
  }, [loadSnapshot]);

  useEffect(() => {
    activeRef.current = active;
    const periodStart = selectedPeriodRef.current;
    if (!active) {
      if (snapshotRequestRef.current) {
        snapshotRequestRef.current.controller.abort();
        snapshotRequestRef.current = null;
        if (mountedRef.current) {
          setLoadState(inactiveProgressMeasurementCutLoadState(snapshotRef.current));
        }
      }
      return;
    }
    if (
      !periodStart
      || snapshotRef.current?.requestedPeriod?.start === periodStart
      || snapshotRequestRef.current?.periodStart === periodStart
    ) return;
    loadSnapshot({ periodStart, preserveNotice: true });
  }, [active, loadSnapshot]);

  function invalidateSnapshotForRefresh() {
    requestSequenceRef.current += 1;
    snapshotRequestRef.current?.controller.abort();
    snapshotRequestRef.current = null;
    snapshotRef.current = null;
    if (mountedRef.current) {
      setSnapshot(null);
      setLoadState('idle');
    }
  }

  function changePeriod(value) {
    setPeriodDate(value);
    let periodStart = '';
    try {
      periodStart = civilFortnightForDate(value).start;
    } catch {
      periodStart = '';
    }
    if (selectedPeriodRef.current === periodStart) return;
    selectedPeriodRef.current = periodStart;
    requestSequenceRef.current += 1;
    snapshotRequestRef.current?.controller.abort();
    snapshotRef.current = null;
    setSnapshot(null);
    setLoadState(periodStart && active ? 'loading' : 'idle');
    setNotice(null);
    const attempt = attemptRef.current;
    setUncertainAttempt(
      attempt?.state === 'UNCERTAIN' && attempt.periodDate === periodStart ? attempt : null,
    );
    if (periodStart && active) loadSnapshot({ periodStart });
  }

  async function performSeal(attempt) {
    if (sealBusyRef.current) return;
    sealBusyRef.current = true;
    if (mountedRef.current) {
      setSealBusy(true);
      setNotice({ tone: 'neutral', message: 'Sellando un único corte técnico…' });
    }
    try {
      const result = await api('/api/progress-measurement-cuts', {
        method: 'POST',
        headers: { 'Idempotency-Key': attempt.operationKey },
        body: JSON.stringify(attempt.body),
      });
      if (
        !result?.cut?.id
        || result.cut.period?.start !== attempt.periodDate
        || result.cut.previousCutId !== attempt.expectedHeadCutId
        || result.cut.candidateToken !== attempt.expectedCandidateToken
        || result?.head?.currentCutId !== result.cut.id
        || !Number.isSafeInteger(result?.head?.revision)
        || result.executionAllowed !== false
      ) {
        const error = new Error('La respuesta no confirmó el contrato del corte técnico.');
        error.status = null;
        throw error;
      }
      attemptRef.current = null;
      if (
        mountedRef.current
        && selectedPeriodRef.current === attempt.periodDate
      ) {
        setUncertainAttempt(null);
        setNotice({
          tone: 'success',
          message: result.replayed
            ? 'El corte ya estaba sellado; no se creó un duplicado.'
            : 'Corte sellado. La vista se actualiza desde la fuente autoritativa.',
        });
        if (activeRef.current) {
          await loadSnapshot({ periodStart: attempt.periodDate, preserveNotice: true });
        } else {
          invalidateSnapshotForRefresh();
        }
      }
    } catch (error) {
      if (mutationIsAmbiguous(error)) {
        const uncertain = uncertainProgressMeasurementCutAttempt(attempt);
        attemptRef.current = uncertain;
        if (
          mountedRef.current
          && selectedPeriodRef.current === attempt.periodDate
        ) {
          setUncertainAttempt(uncertain);
          setNotice({
            tone: 'warning',
            message: 'Resultado incierto: se conservaron exactamente la clave y el body. No hubo reintento automático.',
          });
        }
      } else {
        attemptRef.current = null;
        if (
          mountedRef.current
          && selectedPeriodRef.current === attempt.periodDate
        ) {
          setUncertainAttempt(null);
          setNotice({ tone: 'error', message: error.message });
          if (error.status === 409) {
            if (activeRef.current) {
              await loadSnapshot({ periodStart: attempt.periodDate, preserveNotice: true });
            } else {
              invalidateSnapshotForRefresh();
            }
          }
        }
      }
    } finally {
      sealBusyRef.current = false;
      if (mountedRef.current) setSealBusy(false);
    }
  }

  async function sealCut() {
    if (
      sealBusyRef.current
      || loadState !== 'ready'
      || !serverCanSeal
      || uncertainAttempt
    ) return;
    try {
      const payload = buildProgressMeasurementCutPayload(snapshotRef.current, periodDate);
      const previous = attemptRef.current;
      if (previous?.state === 'UNCERTAIN') {
        setNotice({
          tone: 'warning',
          message: 'Primero conciliá el intento incierto. No se generó una clave nueva.',
        });
        return;
      }
      const attempt = progressMeasurementCutAttempt(previous, payload, newUuid);
      attemptRef.current = attempt;
      await performSeal(attempt);
    } catch (error) {
      setNotice({ tone: 'error', message: error.message });
    }
  }

  async function reconcileUncertain() {
    const attempt = attemptRef.current;
    if (!attempt || attempt.state !== 'UNCERTAIN') return;
    const incoming = await loadSnapshot({
      periodStart: attempt.periodDate,
      preserveNotice: true,
    });
    if (
      !incoming
      || !mountedRef.current
      || selectedPeriodRef.current !== attempt.periodDate
    ) return;
    if (progressMeasurementCutSnapshotConfirmsAttempt(incoming, attempt)) {
      attemptRef.current = null;
      setUncertainAttempt(null);
      setNotice({
        tone: 'success',
        message: 'La lectura autoritativa confirmó que el corte quedó sellado.',
      });
      return;
    }
    const reconciled = { ...attempt, reconciled: true };
    const competingHead = incoming.head?.currentCutId
      && incoming.head.currentCutId !== (attempt.expectedHeadCutId || null);
    const competingComposition = competingHead
      && incoming.latestCut?.candidateToken !== attempt.expectedCandidateToken;
    reconciled.conflict = Boolean(competingComposition);
    attemptRef.current = reconciled;
    setUncertainAttempt(reconciled);
    setNotice({
      tone: 'warning',
      message: competingComposition
        ? 'Otra composición avanzó la cabecera. Tu intento sigue incierto; sólo podés consultar su recibo reenviando manualmente la misma clave y el mismo body.'
        : 'El corte aún no aparece. Podés reenviar manualmente la misma clave y el mismo body.',
    });
  }

  return (
    <section aria-labelledby="fortnight-cut-heading" className={styles.cutWorkspace}>
      <div className={styles.cutIntro}>
        <div>
          <span className={styles.eyebrow}>S9.2-MED · Snapshot reproducible</span>
          <h2 id="fortnight-cut-heading">Corte quincenal</h2>
          <p>
            Compara la fuente aprobada actual con el último snapshot inmutable de la obra.
          </p>
        </div>
        <div className={styles.cutPeriodControl}>
          <label htmlFor="measurement-cut-period">Fecha dentro de la quincena</label>
          <input
            id="measurement-cut-period"
            max={latestClosedDate}
            onChange={(event) => changePeriod(event.target.value)}
            type="date"
            value={periodDate}
          />
          <small>{period?.label || 'Elegí una fecha civil válida.'}</small>
        </div>
      </div>

      <div aria-atomic="true" aria-live="polite" className={styles.liveRegion}>
        {notice && (
          <p data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>
            {notice.message}
          </p>
        )}
      </div>

      {uncertainAttempt && (
        <section aria-labelledby="cut-uncertain-heading" className={styles.uncertainPanel}>
          <div>
            <strong id="cut-uncertain-heading">Sellado pendiente de conciliación</strong>
            <p>Primero consultá el GET autoritativo. El sistema nunca reenvía solo.</p>
          </div>
          <div className={styles.uncertainActions}>
            <button disabled={loadState === 'loading' || sealBusy} onClick={reconcileUncertain} type="button">
              Conciliar ahora
            </button>
            {uncertainAttempt.reconciled && (
              <button disabled={sealBusy} onClick={() => performSeal(uncertainAttempt)} type="button">
                {uncertainAttempt.conflict ? 'Consultar recibo con misma clave' : 'Reenviar mismo sellado'}
              </button>
            )}
          </div>
        </section>
      )}

      {(loadState === 'loading' || loadState === 'idle') && !snapshot && (
        <div className={styles.cutLoading} role="status">Actualizando corte quincenal…</div>
      )}
      {loadState === 'error' && !snapshot && period?.start && (
        <div className={styles.cutLoading}>
          <p>No se pudo obtener una lectura autoritativa.</p>
          <button onClick={() => loadSnapshot({ periodStart: period.start })} type="button">
            Reintentar lectura
          </button>
        </div>
      )}

      {snapshot && (
        <>
          <div className={styles.cutSummaryGrid}>
            <article className={styles.cutSnapshotCard}>
              <header>
                <div>
                  <small>Candidato derivado ahora</small>
                  <strong>{READINESS_LABELS[snapshot.readiness?.state] || 'Estado no disponible'}</strong>
                </div>
                <span data-state={String(snapshot.readiness?.state || '').toLowerCase()}>
                  Fuente viva
                </span>
              </header>
              <dl>
                <div><dt>Tareas canónicas</dt><dd>{taskCount}</dd></div>
                <div><dt>Con medición</dt><dd>{measuredLineCount}</dd></div>
                <div><dt>Sin medición</dt><dd>{missingLineCount}</dd></div>
                <div><dt>Revisión cabeza</dt><dd>{snapshot.head?.revision ?? '—'}</dd></div>
              </dl>
              <p className={styles.cutAbsenceNote}>
                Las tareas sin medición figuran como ausencia explícita; nunca se convierten en cantidad cero.
              </p>
              {!serverCanSeal && snapshot.readiness?.blockingReason && (
                <p className={styles.cutBlocker} role="status">
                  {BLOCKING_REASON_LABELS[snapshot.readiness.blockingReason]
                    || 'El servidor no habilita sellar esta composición.'}
                </p>
              )}
            </article>

            <article className={styles.cutSnapshotCard}>
              <header>
                <div>
                  <small>Último corte sellado</small>
                  <strong>{latestCut ? `Versión ${latestCut.version}` : 'Sin corte previo'}</strong>
                </div>
                <span data-state={freshness.toLowerCase()}>{FRESHNESS_LABELS[freshness]}</span>
              </header>
              {latestCut ? (
                <>
                  <dl>
                    <div><dt>Líneas medidas</dt><dd>{latestMeasuredCount}</dd></div>
                    <div><dt>Ausencias</dt><dd>{latestMissingCount ?? 'No informado'}</dd></div>
                    <div><dt>Revisión</dt><dd>{latestCut.version}</dd></div>
                    <div><dt>Integridad</dt><dd>{latestCut.integrity?.algorithm || 'SHA-256'}</dd></div>
                  </dl>
                  <p className={styles.cutMetadata}>
                    <span>
                      Sellado por {latestCut.sealedBy?.label || 'miembro autorizado'} ·{' '}
                      <time dateTime={latestCut.sealedAt || undefined}>
                        {localDateTime(latestCut.sealedAt, formatter)}
                      </time>
                    </span>
                    <code title={latestCut.integrity?.digest || undefined}>
                      {shortDigest(latestCut.integrity?.digest)}
                    </code>
                  </p>
                </>
              ) : (
                <p className={styles.cutAbsenceNote}>
                  La obra todavía no tiene un snapshot técnico para esta quincena.
                </p>
              )}
            </article>
          </div>

          <section aria-labelledby="cut-comparison-heading" className={styles.cutComparison}>
            <div className={styles.cutComparisonHeading}>
              <div>
                <h3 id="cut-comparison-heading">Composición comparada</h3>
                <p>Candidato actual frente a la versión sellada más reciente.</p>
              </div>
              <button
                disabled={loadState === 'loading' || sealBusy}
                onClick={() => loadSnapshot({ periodStart: period.start })}
                type="button"
              >
                {loadState === 'loading' ? 'Actualizando…' : 'Actualizar fuente'}
              </button>
            </div>
            {rows.length > 0 ? (
              <div className={styles.cutTableScroller}>
                <table className={styles.cutTable}>
                  <caption>
                    Las cantidades son textos decimales exactos; una celda ausente no representa cero.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Tarea</th>
                      <th scope="col">Candidato</th>
                      <th scope="col">Último corte</th>
                      <th scope="col">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.task.id}>
                        <th data-label="Tarea" scope="row">
                          <strong>{row.task.code || 'Sin código'}</strong>
                          <small>{row.task.title} · tarea r{row.task.revision ?? '—'}</small>
                        </th>
                        <td data-label="Candidato"><SnapshotCell line={row.candidate} /></td>
                        <td data-label="Último corte"><SnapshotCell line={row.latestCut} /></td>
                        <td data-label="Diferencia">
                          <span className={styles.cutChangeBadge} data-change={row.change.toLowerCase()}>
                            {CHANGE_LABELS[row.change] || 'Estado no disponible'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.cutEmpty}>
                <strong>No hay tareas canónicas en la fuente del corte</strong>
                <p>No se genera una línea cero ni se infiere avance.</p>
              </div>
            )}
          </section>

          <section aria-labelledby="cut-seal-heading" className={styles.cutSealPanel}>
            <div>
              <h3 id="cut-seal-heading">Sellar snapshot técnico</h3>
              <p>
                El servidor rederiva y bloquea todas las mediciones aprobadas antes de persistir la versión y su hash.
              </p>
            </div>
            {canSeal ? (
              <button
                aria-describedby="cut-contract-boundary"
                disabled={!serverCanSeal || sealBusy || Boolean(uncertainAttempt) || loadState !== 'ready'}
                onClick={sealCut}
                type="button"
              >
                {sealBusy ? 'Sellando una vez…' : latestCut ? 'Sellar nueva revisión' : 'Sellar primer corte'}
              </button>
            ) : (
              <span className={styles.cutReadOnly}>Lectura autorizada · sellado restringido</span>
            )}
            <p id="cut-contract-boundary" className={styles.mutationDisclaimer}>
              No hay estado contractual optimista. Este artefacto no es certificado, precio, cuenta por pagar ni pago.
            </p>
          </section>
        </>
      )}
    </section>
  );
}
