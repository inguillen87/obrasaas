"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  buildTaskMaterialReleasePayload,
  buildTaskMaterialReservePayload,
  createTaskMaterialReservationDraft,
  validateTaskMaterialReservationMutationResult,
  validateTaskMaterialReservationSnapshot,
} from "@/lib/task-material-reservations-ui-contract";

import styles from "./task-material-reservations-panel.module.css";

const STATUS_PRESENTATION = Object.freeze({
  NOT_DEFINED: ["Sin BOM", "idle"],
  NOT_REQUIRED: ["No requiere materiales", "ready"],
  DEFINED_UNRESERVED: ["Definida, sin reservar", "pending"],
  AVAILABLE: ["Disponible", "ready"],
  REVIEW_REQUIRED: ["Revisión requerida", "attention"],
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || "No se pudo completar la operación.");
    error.status = response.status;
    error.code = body?.code || null;
    throw error;
  }
  if (!record(body)) throw new Error("El servidor devolvió una respuesta incompleta.");
  return body;
}

function activeAvailability(line) {
  return line.availability.filter((row) => row.locationActive && row.available !== "0.000");
}

function locationLabel(row) {
  return `${row.locationCode} · ${row.locationName} · disponible ${row.available} ${row.unit}`;
}

export default function TaskMaterialReservationsPanel({
  taskId,
  canReserve,
  canRelease,
  requirementRevisionId,
  onBusyChange,
  onReservationStateChange,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [draft, setDraft] = useState(null);
  const [releaseReason, setReleaseReason] = useState("");
  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const requestRef = useRef({ sequence: 0, controller: null });
  const mutationAttemptRef = useRef(null);
  const draftKeyRef = useRef(0);

  const decorateDraft = useCallback((nextSnapshot) => {
    const initial = createTaskMaterialReservationDraft(nextSnapshot);
    return {
      ...initial,
      lines: initial.lines.map((line) => ({
        ...line,
        allocations: line.allocations.map((allocation) => {
          draftKeyRef.current += 1;
          return { ...allocation, key: `reservation-allocation-${draftKeyRef.current}` };
        }),
      })),
    };
  }, []);

  const publishState = useCallback((nextSnapshot, known = true) => {
    onReservationStateChange?.({
      taskId,
      known,
      blocksRevision: known
        ? nextSnapshot?.reservationHead?.kind === "RESERVE"
        : true,
      readiness: known ? nextSnapshot?.readiness || null : null,
    });
  }, [onReservationStateChange, taskId]);

  const loadSnapshot = useCallback(async ({ preserveNotice = false } = {}) => {
    requestRef.current.controller?.abort();
    const controller = new AbortController();
    const sequence = requestRef.current.sequence + 1;
    requestRef.current = { sequence, controller };
    publishState(null, false);
    setLoadState("loading");
    setLoadError(null);
    if (!preserveNotice) setNotice(null);
    try {
      const body = await requestJson(
        `/api/tasks/${encodeURIComponent(taskId)}/material-reservations`,
        { signal: controller.signal, cache: "no-store" },
      );
      if (!mountedRef.current || requestRef.current.sequence !== sequence) return null;
      const validated = validateTaskMaterialReservationSnapshot(body, taskId);
      setSnapshot(validated);
      setDraft(decorateDraft(validated));
      setReleaseReason("");
      setLoadState("ready");
      publishState(validated);
      return validated;
    } catch (error) {
      if (
        !mountedRef.current
        || error.name === "AbortError"
        || requestRef.current.sequence !== sequence
      ) return null;
      setSnapshot(null);
      setDraft(null);
      setLoadError(error.message || "No se pudo cargar la disponibilidad real.");
      setLoadState("error");
      publishState(null, false);
      return null;
    }
  }, [decorateDraft, publishState, taskId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (busyRef.current) onBusyChange?.(taskId, false);
    };
  }, [onBusyChange, taskId]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => {
      void loadSnapshot();
    }, 0);
    return () => {
      window.clearTimeout(kickoff);
      requestRef.current.sequence += 1;
      requestRef.current.controller?.abort();
    };
  }, [loadSnapshot, requirementRevisionId]);

  function updateAllocation(lineId, allocationKey, field, value) {
    setDraft((current) => current ? ({
      ...current,
      lines: current.lines.map((line) => line.requirementLineId === lineId ? ({
        ...line,
        allocations: line.allocations.map((allocation) => (
          allocation.key === allocationKey ? { ...allocation, [field]: value } : allocation
        )),
      }) : line),
    }) : current);
  }

  function addAllocation(lineId) {
    setDraft((current) => {
      if (!current) return current;
      draftKeyRef.current += 1;
      return {
        ...current,
        lines: current.lines.map((line) => line.requirementLineId === lineId ? ({
          ...line,
          allocations: [
            ...line.allocations,
            {
              key: `reservation-allocation-${draftKeyRef.current}`,
              locationId: "",
              quantity: "",
            },
          ],
        }) : line),
      };
    });
  }

  function removeAllocation(lineId, allocationKey) {
    setDraft((current) => current ? ({
      ...current,
      lines: current.lines.map((line) => line.requirementLineId === lineId ? ({
        ...line,
        allocations: line.allocations.filter((allocation) => allocation.key !== allocationKey),
      }) : line),
    }) : current);
  }

  async function mutate(payload) {
    if (busyRef.current) return;
    const payloadKey = JSON.stringify({ taskId, payload });
    if (mutationAttemptRef.current?.payloadKey !== payloadKey) {
      mutationAttemptRef.current = { payloadKey, operationKey: crypto.randomUUID() };
    }
    requestRef.current.sequence += 1;
    requestRef.current.controller?.abort();
    busyRef.current = true;
    publishState(null, false);
    onBusyChange?.(taskId, true);
    setBusy(true);
    setNotice(null);
    setLoadError(null);
    try {
      const result = validateTaskMaterialReservationMutationResult(
        await requestJson(
          `/api/tasks/${encodeURIComponent(taskId)}/material-reservations`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": mutationAttemptRef.current.operationKey,
            },
            body: JSON.stringify(payload),
          },
        ),
        taskId,
        payload,
      );
      if (!mountedRef.current) return;
      mutationAttemptRef.current = null;
      if (result.readiness.authoritative) {
        publishState({
          reservationHead: result.readiness.state === "AVAILABLE" ? { kind: "RESERVE" } : null,
          readiness: result.readiness,
        });
      } else {
        publishState(null, false);
      }
      setNotice(result.replayed
        ? "La operación ya estaba confirmada y se recuperó sin duplicarla."
        : payload.kind === "RESERVE"
          ? "La BOM completa quedó reservada."
          : "La reserva completa quedó liberada.");
      await loadSnapshot({ preserveNotice: true });
    } catch (error) {
      if (!mountedRef.current) return;
      if (error.status === 409) {
        mutationAttemptRef.current = null;
        setNotice(`${error.message} Se actualizó el estado antes de otro intento.`);
        await loadSnapshot({ preserveNotice: true });
      } else {
        setNotice(
          `${error.message} No se reintentó automáticamente; repetí el mismo envío para recuperar un resultado ambiguo.`,
        );
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        onBusyChange?.(taskId, false);
        setBusy(false);
      }
    }
  }

  function reserve(event) {
    event.preventDefault();
    if (!snapshot || !draft || !canReserve || busyRef.current) return;
    try {
      void mutate(buildTaskMaterialReservePayload(snapshot, draft));
    } catch (error) {
      setNotice(error.message);
    }
  }

  function release(event) {
    event.preventDefault();
    if (!snapshot || !canRelease || busyRef.current) return;
    try {
      void mutate(buildTaskMaterialReleasePayload(snapshot, releaseReason));
    } catch (error) {
      setNotice(error.message);
    }
  }

  const presentation = snapshot
    ? STATUS_PRESENTATION[snapshot.readiness.state]
    : ["Sin verificar", "attention"];

  return (
    <section className={styles.panel} aria-labelledby={`reservation-title-${taskId}`}>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>S12.2C · stock comprometido</span>
          <h4 id={`reservation-title-${taskId}`}>Reserva de materiales</h4>
          <p>La cobertura se calcula con stock físico por ubicación y queda ligada a la BOM vigente.</p>
        </div>
        <span className={`${styles.status} ${styles[presentation[1]]}`}>{presentation[0]}</span>
      </header>

      <div className={styles.feedback} aria-live="polite">
        {loadState === "loading" && <p role="status">Verificando reservas y existencias…</p>}
        {notice && <p role="status">{notice}</p>}
        {loadError && <p className={styles.alert} role="alert">{loadError}</p>}
      </div>

      {loadState === "error" && (
        <button type="button" disabled={busy} onClick={() => void loadSnapshot()}>
          Reintentar verificación
        </button>
      )}

      {snapshot && (
        <>
          <div className={styles.summary}>
            <div>
              <span>Revisión de materiales</span>
              <strong>{snapshot.requirementRevision
                ? `BOM v${snapshot.requirementRevision.version}`
                : "Sin definir"}</strong>
            </div>
            <div>
              <span>Cobertura exacta</span>
              <strong>{snapshot.readiness.coveredLineCount}/{snapshot.readiness.requiredLineCount} líneas</strong>
            </div>
            <button
              type="button"
              disabled={busy || loadState === "loading"}
              onClick={() => void loadSnapshot()}
            >
              Recargar stock
            </button>
          </div>

          {snapshot.readiness.state === "NOT_DEFINED" && (
            <p className={styles.context}>Publicá primero una BOM para poder reservar existencias.</p>
          )}
          {snapshot.readiness.state === "NOT_REQUIRED" && (
            <p className={styles.success}>La revisión vigente declara que esta tarea no requiere materiales.</p>
          )}
          {snapshot.readiness.state === "REVIEW_REQUIRED" && (
            <p className={styles.alert} role="alert">
              Las proyecciones, la cadena o la BOM no coinciden. La reserva quedó bloqueada hasta revisar el estado autoritativo.
            </p>
          )}

          {snapshot.lineBalances.length > 0 && (
            <div className={styles.coverageList}>
              {snapshot.lineBalances.map((line) => (
                <article key={line.requirementLineId} className={styles.coverageCard}>
                  <div className={styles.materialHeading}>
                    <div>
                      <strong>{line.itemCode} · {line.itemName}</strong>
                      <span>Requerido {line.requiredQuantity} {line.unit} · reservado {line.reservedQuantity} {line.unit}</span>
                    </div>
                    <span>{line.availability.length} ubicación(es) con existencia registrada</span>
                  </div>
                  <ul className={styles.stockList} aria-label={`Stock de ${line.itemName} por ubicación`}>
                    {line.availability.length === 0 ? (
                      <li>Sin stock físico ingresado.</li>
                    ) : line.availability.map((row) => (
                      <li key={row.locationId}>
                        <span>{row.locationCode} · {row.locationName}{!row.locationActive ? " · inactiva" : ""}</span>
                        <strong>{row.available} {row.unit} disponibles</strong>
                        <small>{row.onHand} en mano · {row.reserved} ya reservados</small>
                      </li>
                    ))}
                  </ul>
                  {snapshot.readiness.state === "AVAILABLE" && line.allocations.length > 0 && (
                    <ul className={styles.allocationSummary} aria-label={`Reserva vigente de ${line.itemName}`}>
                      {line.allocations.map((allocation) => {
                        const location = line.availability.find(
                          (row) => row.locationId === allocation.locationId,
                        );
                        return (
                          <li key={allocation.id}>
                            {location?.locationCode || "Ubicación no disponible"}: {allocation.quantity} {line.unit}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          )}

          {snapshot.readiness.state === "DEFINED_UNRESERVED" && canReserve && draft && (
            <form className={styles.editor} onSubmit={reserve}>
              <div>
                <h5>Asignar la BOM completa</h5>
                <p>Cada línea debe sumar exactamente lo requerido. Podés dividirla entre varias ubicaciones.</p>
              </div>
              {snapshot.lineBalances.map((line) => {
                const draftLine = draft.lines.find(
                  (candidate) => candidate.requirementLineId === line.requirementLineId,
                );
                const eligible = activeAvailability(line);
                return (
                  <fieldset key={line.requirementLineId} className={styles.allocationEditor}>
                    <legend>{line.itemCode} · {line.requiredQuantity} {line.unit}</legend>
                    {draftLine.allocations.map((allocation, index) => {
                      const usedElsewhere = new Set(draftLine.allocations
                        .filter((candidate) => candidate.key !== allocation.key)
                        .map((candidate) => candidate.locationId));
                      return (
                        <div key={allocation.key} className={styles.allocationRow}>
                          <label>
                            Ubicación {index + 1}
                            <select
                              required
                              value={allocation.locationId}
                              disabled={busy}
                              onChange={(event) => updateAllocation(
                                line.requirementLineId,
                                allocation.key,
                                "locationId",
                                event.target.value,
                              )}
                            >
                              <option value="">Seleccionar ubicación</option>
                              {eligible.map((row) => (
                                <option
                                  key={row.locationId}
                                  value={row.locationId}
                                  disabled={usedElsewhere.has(row.locationId)}
                                >
                                  {locationLabel(row)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Cantidad ({line.unit})
                            <input
                              required
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]+([.][0-9]{1,3})?"
                              value={allocation.quantity}
                              disabled={busy}
                              onChange={(event) => updateAllocation(
                                line.requirementLineId,
                                allocation.key,
                                "quantity",
                                event.target.value,
                              )}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={busy || draftLine.allocations.length === 1}
                            onClick={() => removeAllocation(line.requirementLineId, allocation.key)}
                          >
                            Quitar
                          </button>
                        </div>
                      );
                    })}
                    {eligible.length === 0 && (
                      <p className={styles.alert} role="alert">No hay una ubicación activa con stock disponible.</p>
                    )}
                    <button
                      type="button"
                      disabled={busy || draftLine.allocations.length >= eligible.length}
                      onClick={() => addAllocation(line.requirementLineId)}
                    >
                      Dividir en otra ubicación
                    </button>
                  </fieldset>
                );
              })}
              <label className={styles.reason}>
                Motivo de la reserva
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  value={draft.reason}
                  disabled={busy}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))}
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? "Confirmando reserva…" : "Reservar BOM completa"}
              </button>
            </form>
          )}

          {snapshot.reservationHead?.kind === "RESERVE"
            && snapshot.reservationHead.requirementRevisionId === snapshot.requirementRevision?.id
            && canRelease && (
            <form className={styles.release} onSubmit={release}>
              <div>
                <h5>Liberar reserva completa</h5>
                <p>La liberación es un movimiento espejo auditable; no borra el historial.</p>
                {snapshot.readiness.state !== "AVAILABLE" && (
                  <p className={styles.alert} role="alert">
                    La reserva requiere revisión. Podés liberarla completa para recuperar el stock antes de corregir ubicaciones o materiales.
                  </p>
                )}
              </div>
              <label className={styles.reason}>
                Motivo de la liberación
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  value={releaseReason}
                  disabled={busy}
                  onChange={(event) => setReleaseReason(event.target.value)}
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? "Liberando reserva…" : "Liberar reserva completa"}
              </button>
            </form>
          )}

          {!canReserve && !canRelease && snapshot.requirementRevision && (
            <p className={styles.context}>
              Tenés acceso de lectura. Reservar o liberar requiere administrar tareas e inventario.
            </p>
          )}
        </>
      )}
    </section>
  );
}
