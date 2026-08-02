"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import baseStyles from "../extra-work/extra-work.module.css";
import styles from "./receipt-inspection-client.module.css";
import ReceiptInventoryClient from "./receipt-inventory-client";
import {
  RECEIPT_INSPECTION_QUALITIES,
  RECEIPT_INSPECTION_PAGE_SIZE,
  acceptedReceiptInspectionDraft,
  buildReceiptInspectionReversal,
  buildReceiptInspectionSubmission,
  deriveReceiptInspectionPartitions,
  initialReceiptInspectionPage,
  latestReceiptInspection,
  receiptInspectionLineDetail,
  receiptInspectionPageFromResponse,
  receiptInspectionReceiptLabel,
  receiptInspectionDraftFromHead,
} from "./receipt-inspection-model";

const ALLOCATION_PAGE_SIZE = 200;
const ALLOCATION_HARD_CAP = 2_000;
const INSPECTION_PAGE_SIZE = 50;
const INSPECTION_HARD_CAP = 500;

const QUALITY_LABELS = {
  ACCEPTED: "Aceptado",
  DAMAGED: "Dañado",
  REJECTED: "Rechazado",
  QUARANTINED: "En cuarentena",
};

const KIND_LABELS = {
  FINALIZATION: "Finalización",
  CORRECTION: "Corrección",
  REVERSAL: "Reversión",
};

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "No se pudo completar la operación de inspección.");
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return body;
}

async function loadAllPages({
  path,
  params,
  collectionKey,
  pageSize,
  hardCap,
  signal,
}) {
  const rows = [];
  const rowIds = new Set();
  const cursors = new Set();
  let cursor = null;

  while (true) {
    const query = new URLSearchParams({
      ...params,
      limit: String(pageSize),
      ...(cursor ? { cursor } : {}),
    });
    const result = await requestJson(`${path}?${query.toString()}`, { signal });
    const page = result[collectionKey];
    if (
      !Array.isArray(page)
      || page.length > pageSize
      || typeof result.hasMore !== "boolean"
    ) {
      throw new Error("El servidor devolvió una página incompleta o inválida.");
    }
    if (rows.length + page.length > hardCap) {
      throw new Error(
        `La consulta supera el límite seguro de ${hardCap} registros. Acotá el alcance antes de inspeccionar.`,
      );
    }
    for (const row of page) {
      if (!row?.id || rowIds.has(row.id)) {
        throw new Error("El servidor devolvió registros duplicados o sin identificador.");
      }
      rowIds.add(row.id);
      rows.push(row);
    }
    if (!result.hasMore) break;
    if (
      page.length === 0
      ||
      rows.length >= hardCap
      || typeof result.nextCursor !== "string"
      || !result.nextCursor
      || cursors.has(result.nextCursor)
    ) {
      throw new Error("La paginación no puede completarse de forma segura.");
    }
    cursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }

  return rows;
}

async function loadInspectionSnapshot(receipt, signal) {
  const [allocations, inspections] = await Promise.all([
    loadAllPages({
      path: "/api/goods-receipt-commitment-allocations",
      params: { purchaseOrderId: receipt.purchaseOrderId },
      collectionKey: "allocations",
      pageSize: ALLOCATION_PAGE_SIZE,
      hardCap: ALLOCATION_HARD_CAP,
      signal,
    }),
    loadAllPages({
      path: "/api/goods-receipt-inspections",
      params: { goodsReceiptId: receipt.id },
      collectionKey: "inspections",
      pageSize: INSPECTION_PAGE_SIZE,
      hardCap: INSPECTION_HARD_CAP,
      signal,
    }),
  ]);
  const partition = deriveReceiptInspectionPartitions(receipt, allocations);
  const head = latestReceiptInspection(inspections);
  return {
    goodsReceiptId: receipt.id,
    allocations,
    inspections,
    partitions: partition.partitions,
    hasUnallocated: partition.hasUnallocated,
    head,
    draft: receiptInspectionDraftFromHead(partition.partitions, head),
  };
}

async function loadActiveLocations(signal) {
  const result = await requestJson("/api/inventory-locations?active=true", { signal });
  if (!Array.isArray(result.locations) || typeof result.hasMore !== "boolean") {
    throw new Error("El servidor devolvió ubicaciones inválidas.");
  }
  if (result.hasMore) {
    throw new Error(
      "La obra supera el límite de 100 ubicaciones activas. Desactivá o consolidá ubicaciones antes de inspeccionar.",
    );
  }
  const ids = new Set();
  for (const location of result.locations) {
    if (!location?.id || location.active !== true || ids.has(location.id)) {
      throw new Error("El servidor devolvió una ubicación inactiva, repetida o inválida.");
    }
    ids.add(location.id);
  }
  return result.locations;
}

function inspectionDate(value) {
  if (!value) return "fecha no disponible";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function locationLabel(location) {
  return `${location.code} · ${location.name}`;
}

function operationAttempt(current, payload, prefix) {
  const payloadKey = JSON.stringify(payload);
  if (current?.payloadKey === payloadKey) return current;
  return {
    payloadKey,
    operationKey: `${prefix}:${crypto.randomUUID()}`,
  };
}

export default function ReceiptInspectionClient({
  receipts,
  receiptsTruncated = false,
  orders,
  canManage,
  canReadInventory = false,
  canManageInventory = false,
  refreshVersion = 0,
  onInspectionCommitted,
}) {
  const [receiptPage, setReceiptPage] = useState(() => (
    initialReceiptInspectionPage(receipts, receiptsTruncated)
  ));
  const postedReceipts = receiptPage.receipts;
  const [selectedReceiptId, setSelectedReceiptId] = useState(postedReceipts[0]?.id || "");
  const receiptId = postedReceipts.some((receipt) => receipt.id === selectedReceiptId)
    ? selectedReceiptId
    : postedReceipts[0]?.id || "";
  const receipt = postedReceipts.find((candidate) => candidate.id === receiptId) || null;
  const [snapshot, setSnapshot] = useState(null);
  const [draft, setDraft] = useState({});
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [reversalReason, setReversalReason] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [locationName, setLocationName] = useState("");
  const [notice, setNotice] = useState(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationsError, setLocationsError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [inventoryPutawayState, setInventoryPutawayState] = useState({
    inspectionId: null,
    active: null,
  });
  const [receiptPageLoading, setReceiptPageLoading] = useState(false);
  const [receiptPageError, setReceiptPageError] = useState(null);
  const [receiptCursorHistory, setReceiptCursorHistory] = useState([]);
  const inspectionAttemptRef = useRef(null);
  const reversalAttemptRef = useRef(null);
  const locationAttemptRef = useRef(null);
  const submittingRef = useRef(false);
  const receiptPageRequestRef = useRef(0);
  const receiptPageRef = useRef(receiptPage);
  const receiptCursorHistoryRef = useRef(receiptCursorHistory);

  const loadReceiptPage = useCallback(async (
    cursor,
    cursorHistory,
    { signal } = {},
  ) => {
    const requestId = receiptPageRequestRef.current + 1;
    receiptPageRequestRef.current = requestId;
    setReceiptPageLoading(true);
    try {
      const query = new URLSearchParams({
        status: "POSTED",
        limit: String(RECEIPT_INSPECTION_PAGE_SIZE),
        ...(cursor ? { cursor } : {}),
      });
      const result = await requestJson(
        `/api/goods-receipts?${query.toString()}`,
        { signal },
      );
      const nextPage = receiptInspectionPageFromResponse(result, cursor);
      if (
        nextPage.nextCursor
        && cursorHistory.some((previousCursor) => previousCursor === nextPage.nextCursor)
      ) {
        throw new Error("El servidor repitió un cursor anterior; la navegación se bloqueó de forma segura.");
      }
      if (signal?.aborted || receiptPageRequestRef.current !== requestId) return false;
      receiptPageRef.current = nextPage;
      receiptCursorHistoryRef.current = cursorHistory;
      setReceiptPage(nextPage);
      setReceiptCursorHistory(cursorHistory);
      setReceiptPageError(null);
      return true;
    } catch (error) {
      if (
        error.name === "AbortError"
        || signal?.aborted
        || receiptPageRequestRef.current !== requestId
      ) return false;
      setReceiptPageError(error.message);
      return false;
    } finally {
      if (!signal?.aborted && receiptPageRequestRef.current === requestId) {
        setReceiptPageLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadReceiptPage(
      receiptPageRef.current.cursor,
      receiptCursorHistoryRef.current,
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [loadReceiptPage, refreshVersion]);

  useEffect(() => {
    const controller = new AbortController();
    loadActiveLocations(controller.signal)
      .then((nextLocations) => {
        if (controller.signal.aborted) return;
        setLocations(nextLocations);
        setLocationId((current) => (
          nextLocations.some((location) => location.id === current)
            ? current
            : nextLocations[0]?.id || ""
        ));
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setLocations([]);
        setLocationId("");
        setLocationsError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingLocations(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!receipt) return undefined;
    const controller = new AbortController();
    loadInspectionSnapshot(receipt, controller.signal)
      .then((nextSnapshot) => {
        if (controller.signal.aborted) return;
        setSnapshot({ ...nextSnapshot, refreshVersion });
        setDraft(nextSnapshot.draft);
        setReason("");
        setReversalReason("");
        if (nextSnapshot.head?.kind !== "REVERSAL" && nextSnapshot.head?.locationId) {
          setLocationId(nextSnapshot.head.locationId);
        }
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setSnapshot({
          goodsReceiptId: receipt.id,
          refreshVersion,
          loadError: error.message,
        });
        setNotice(error.message);
      });
    return () => controller.abort();
  }, [receipt, refreshVersion]);

  const currentSnapshot = (
    snapshot?.goodsReceiptId === receiptId
    && snapshot?.refreshVersion === refreshVersion
  ) ? snapshot : null;
  const loadingSnapshot = Boolean(receipt && !currentSnapshot);
  const head = currentSnapshot?.head || null;
  const inspectionKind = head && head.kind !== "REVERSAL" ? "CORRECTION" : "FINALIZATION";
  const reconciliationFrozen = Boolean(head && head.kind !== "REVERSAL");
  const activeLocation = locations.find((location) => location.id === locationId) || null;
  const currentInventoryPutawayState = canReadInventory && head && head.kind !== "REVERSAL"
    && inventoryPutawayState.inspectionId === head.id
    ? inventoryPutawayState.active
    : canReadInventory && head && head.kind !== "REVERSAL"
      ? null
      : false;
  const inventoryPutawayActive = currentInventoryPutawayState === true;
  const inventoryPutawayPending = currentInventoryPutawayState === null;
  const inventoryPutawayBlocked = inventoryPutawayActive || inventoryPutawayPending;
  const updateInventoryPutawayState = useCallback((active, inspectionId) => {
    setInventoryPutawayState({ inspectionId, active });
  }, []);

  async function showNextReceiptPage() {
    const current = receiptPageRef.current;
    if (!current.hasMore || !current.nextCursor || receiptPageLoading) return;
    await loadReceiptPage(current.nextCursor, [
      ...receiptCursorHistoryRef.current,
      current.cursor,
    ]);
  }

  async function showPreviousReceiptPage() {
    const history = receiptCursorHistoryRef.current;
    if (history.length === 0 || receiptPageLoading) return;
    await loadReceiptPage(history[history.length - 1], history.slice(0, -1));
  }

  function updateDraft(partitionKey, quality, value) {
    setDraft((current) => ({
      ...current,
      [partitionKey]: {
        ...(current[partitionKey] || {}),
        [quality]: value,
      },
    }));
  }

  async function refreshCurrentSnapshot(successMessage) {
    const nextSnapshot = await loadInspectionSnapshot(receipt);
    setSnapshot({ ...nextSnapshot, refreshVersion });
    setDraft(nextSnapshot.draft);
    setReason("");
    setReversalReason("");
    if (nextSnapshot.head?.kind !== "REVERSAL" && nextSnapshot.head?.locationId) {
      setLocationId(nextSnapshot.head.locationId);
    }
    setNotice(successMessage);
  }

  function notifyInspectionCommitted(inspection) {
    try {
      onInspectionCommitted?.(inspection);
    } catch {
      // The authoritative inspection already succeeded; local sibling refresh is best-effort.
    }
  }

  async function submitInspection(event) {
    event.preventDefault();
    if (inventoryPutawayBlocked) {
      setNotice("Revertí primero el ingreso de inventario antes de cambiar la inspección.");
      return;
    }
    if (submittingRef.current || !receipt || !currentSnapshot || currentSnapshot.loadError) return;
    let payload;
    try {
      payload = buildReceiptInspectionSubmission({
        receipt,
        partitions: currentSnapshot.partitions,
        draft,
        head,
        locationId: activeLocation?.id || "",
        reason,
      });
    } catch (error) {
      setNotice(error.message);
      return;
    }
    inspectionAttemptRef.current = operationAttempt(
      inspectionAttemptRef.current,
      payload,
      "receipt-inspection",
    );
    submittingRef.current = true;
    setBusy(true);
    try {
      const result = await requestJson("/api/goods-receipt-inspections", {
        method: "POST",
        headers: {
          "Idempotency-Key": inspectionAttemptRef.current.operationKey,
        },
        body: JSON.stringify(payload),
      });
      if (!result.inspection?.id) {
        throw new Error("La respuesta no confirma la inspección; reintentá sin cambiar los datos.");
      }
      inspectionAttemptRef.current = null;
      try {
        await refreshCurrentSnapshot(
          payload.kind === "FINALIZATION"
            ? "Inspección finalizada. La conciliación quedó congelada hasta una reversión auditable."
            : "Corrección de inspección registrada.",
        );
      } catch (refreshError) {
        setNotice(`La inspección se guardó, pero no se pudo refrescar: ${refreshError.message}`);
      }
      notifyInspectionCommitted(result.inspection);
    } catch (error) {
      if (error.status === 409) {
        await refreshCurrentSnapshot(error.message).catch(() => undefined);
      }
      setNotice(error.message);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  async function submitReversal(event) {
    event.preventDefault();
    if (inventoryPutawayBlocked) {
      setNotice("Revertí primero el ingreso de inventario antes de revertir la inspección.");
      return;
    }
    if (submittingRef.current || !receipt) return;
    let payload;
    try {
      payload = buildReceiptInspectionReversal({ receipt, head, reason: reversalReason });
    } catch (error) {
      setNotice(error.message);
      return;
    }
    reversalAttemptRef.current = operationAttempt(
      reversalAttemptRef.current,
      payload,
      "receipt-inspection-reversal",
    );
    submittingRef.current = true;
    setBusy(true);
    try {
      const result = await requestJson("/api/goods-receipt-inspections", {
        method: "POST",
        headers: {
          "Idempotency-Key": reversalAttemptRef.current.operationKey,
        },
        body: JSON.stringify(payload),
      });
      if (!result.inspection?.id) {
        throw new Error("La respuesta no confirma la reversión; reintentá sin cambiar el motivo.");
      }
      reversalAttemptRef.current = null;
      try {
        await refreshCurrentSnapshot(
          "Inspección revertida. La conciliación vuelve a quedar editable antes de una nueva finalización.",
        );
      } catch (refreshError) {
        setNotice(`La reversión se guardó, pero no se pudo refrescar: ${refreshError.message}`);
      }
      notifyInspectionCommitted(result.inspection);
    } catch (error) {
      if (error.status === 409) {
        await refreshCurrentSnapshot(error.message).catch(() => undefined);
      }
      setNotice(error.message);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  async function createLocation(event) {
    event.preventDefault();
    if (locationBusy || busy) return;
    const payload = {
      code: locationCode.trim().toUpperCase(),
      name: locationName.trim(),
    };
    if (!payload.code || !payload.name) {
      setNotice("Completá el código y el nombre de la ubicación.");
      return;
    }
    locationAttemptRef.current = operationAttempt(
      locationAttemptRef.current,
      payload,
      "inventory-location",
    );
    setLocationBusy(true);
    try {
      const result = await requestJson("/api/inventory-locations", {
        method: "POST",
        headers: {
          "Idempotency-Key": locationAttemptRef.current.operationKey,
        },
        body: JSON.stringify(payload),
      });
      if (!result.location?.id || result.location.active !== true) {
        throw new Error("La respuesta no confirma una ubicación activa; reintentá sin cambiar los datos.");
      }
      locationAttemptRef.current = null;
      setLocations((current) => [
        ...current.filter((location) => location.id !== result.location.id),
        result.location,
      ].sort((left, right) => locationLabel(left).localeCompare(locationLabel(right), "es")));
      setLocationId(result.location.id);
      setLocationCode("");
      setLocationName("");
      setLocationsError(null);
      setNotice(result.replayed
        ? "Ubicación recuperada de forma idempotente."
        : "Ubicación activa creada y seleccionada.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLocationBusy(false);
    }
  }

  return (
    <section
      className={`${baseStyles.panel} ${styles.panel}`}
      aria-labelledby="receipt-inspection-title"
    >
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Control de calidad trazable</span>
          <h2 id="receipt-inspection-title">Inspección de materiales recibidos</h2>
        </div>
        {head && (
          <span className={reconciliationFrozen ? styles.frozenBadge : styles.openBadge}>
            {reconciliationFrozen ? "Conciliación congelada" : "Revisión reabierta"}
          </span>
        )}
      </div>
      <p className={styles.intro}>
        Clasificá exactamente lo recibido por asignación explícita. ACEPTADO confirma la
        inspección física/documental en una ubicación; no crea stock AVAILABLE ni reserva
        material para tareas.
      </p>

      {postedReceipts.length === 0 && !receiptPageLoading ? (
        <p>No hay recepciones POSTED disponibles para inspeccionar.</p>
      ) : (
        <label className={styles.receiptSelector}>
          Recepción contabilizada
          <select
            value={receiptId}
            disabled={busy || locationBusy || receiptPageLoading}
            onChange={(event) => {
              setSelectedReceiptId(event.target.value);
              setNotice(null);
            }}
          >
            {postedReceipts.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {receiptInspectionReceiptLabel(candidate, orders)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className={styles.locationHeader} aria-label="Paginación de recepciones">
        <button
          type="button"
          disabled={
            busy
            || locationBusy
            || receiptPageLoading
            || receiptCursorHistory.length === 0
          }
          onClick={showPreviousReceiptPage}
        >
          Página anterior
        </button>
        <span>
          Página {receiptCursorHistory.length + 1} · hasta {RECEIPT_INSPECTION_PAGE_SIZE} remitos
        </span>
        <button
          type="button"
          disabled={
            busy
            || locationBusy
            || receiptPageLoading
            || !receiptPage.hasMore
            || !receiptPage.nextCursor
          }
          onClick={showNextReceiptPage}
        >
          Página siguiente
        </button>
      </div>
      <p className={styles.intro}>
        El historial se navega por cursor en páginas de tamaño fijo; no se carga completo
        ni se ocultan remitos anteriores al primer recorte.
      </p>

      {receiptPageLoading && <p role="status">Cargando página de recepciones…</p>}
      {receiptPageError && (
        <p className={styles.error} role="alert">{receiptPageError}</p>
      )}

      {loadingSnapshot && receipt && <p role="status">Cargando inspección completa…</p>}
      {notice && (
        <p className={baseStyles.notice} role="status" aria-live="polite">
          {notice}
        </p>
      )}
      {locationsError && (
        <p className={styles.error} role="alert">{locationsError}</p>
      )}

      {currentSnapshot && !currentSnapshot.loadError && (
        <>
          {reconciliationFrozen && (
            <div className={styles.freezeNotice} role="status">
              Esta finalización congela las asignaciones del remito. Para cambiar la
              conciliación, primero registrá una REVERSAL con motivo; una corrección sólo
              cambia la clasificación inspeccionada.
            </div>
          )}
          {currentSnapshot.hasUnallocated && (
            <div className={styles.warning} role="alert">
              Hay cantidad recibida sin compromiso conciliado. Se inspecciona como saldo
              sin asignar y ObraSaaS no la vincula por fecha ni por FIFO.
            </div>
          )}

          <div className={styles.summaryGrid}>
            <div>
              <span>Próxima acción</span>
              <strong>{KIND_LABELS[inspectionKind]}</strong>
            </div>
            <div>
              <span>Particiones exactas</span>
              <strong>{currentSnapshot.partitions.length}</strong>
            </div>
            <div>
              <span>Versión vigente</span>
              <strong>{head ? `v${head.version} · ${KIND_LABELS[head.kind]}` : "Sin finalizar"}</strong>
            </div>
          </div>

          {canReadInventory && head && head.kind !== "REVERSAL" && (
            <ReceiptInventoryClient
              key={head.id}
              inspection={head}
              canManage={canManageInventory}
              onActiveStateChange={updateInventoryPutawayState}
            />
          )}

          {inventoryPutawayPending && (
            <div className={styles.freezeNotice} role="status">
              Validando el ledger de inventario antes de habilitar cambios de inspección…
            </div>
          )}

          {inventoryPutawayActive && (
            <div className={styles.warning} role="status">
              Esta inspección ya produjo una existencia física on-hand. Revertí primero el ingreso de
              inventario; la base de datos bloquea correcciones o reversiones de inspección
              mientras ese movimiento siga activo.
            </div>
          )}

          {canManage && (
            <form className={styles.inspectionForm} onSubmit={submitInspection}>
              <div className={styles.locationHeader}>
                <label>
                  Ubicación activa de inspección
                  <select
                    required
                    value={activeLocation?.id || ""}
                    disabled={busy || locationBusy || loadingLocations || Boolean(locationsError) || locations.length === 0}
                    onChange={(event) => setLocationId(event.target.value)}
                  >
                    <option value="">Seleccionar ubicación</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {locationLabel(location)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.acceptAll}
                  onClick={() => setDraft(acceptedReceiptInspectionDraft(
                    currentSnapshot.partitions,
                  ))}
                  disabled={busy || locationBusy}
                >
                  Completar todo como aceptado
                </button>
              </div>

              {locations.length === 0 && !loadingLocations && !locationsError && (
                <p className={styles.warning} role="alert">
                  Creá al menos una ubicación activa antes de registrar la inspección.
                </p>
              )}

              <div className={styles.partitionList}>
                {currentSnapshot.partitions.map((partition) => {
                  const detail = receiptInspectionLineDetail(
                    receipt,
                    orders,
                    partition.purchaseOrderLineId,
                  );
                  return (
                    <fieldset key={partition.key} className={styles.partition}>
                      <legend>{detail.description}</legend>
                      <div className={styles.partitionMeta}>
                        <span>
                          {partition.unallocated
                            ? "Saldo sin conciliar"
                            : `Asignación explícita · ${partition.supplierCommitmentId}`}
                        </span>
                        <strong>{partition.quantity} {detail.unit}</strong>
                      </div>
                      <div className={styles.qualityGrid}>
                        {RECEIPT_INSPECTION_QUALITIES.map((quality) => (
                          <label key={quality}>
                            {QUALITY_LABELS[quality]}
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="0.000"
                              value={draft?.[partition.key]?.[quality] || ""}
                              onChange={(event) => updateDraft(
                                partition.key,
                                quality,
                                event.target.value,
                              )}
                              aria-label={`${QUALITY_LABELS[quality]} para ${detail.description}, total ${partition.quantity} ${detail.unit}`}
                            />
                          </label>
                        ))}
                      </div>
                      <p className={styles.partitionRule}>
                        Las cuatro cantidades deben sumar exactamente {partition.quantity} {detail.unit}.
                      </p>
                    </fieldset>
                  );
                })}
              </div>

              <label>
                Motivo y observaciones
                <textarea
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required={inspectionKind === "CORRECTION"}
                  placeholder={inspectionKind === "CORRECTION"
                    ? "Explicá qué corrige esta versión."
                    : "Obligatorio si hay daño, rechazo o cuarentena."}
                />
              </label>
              <button
                type="submit"
                disabled={
                  busy
                  || locationBusy
                  || loadingLocations
                  || inventoryPutawayBlocked
                  || !activeLocation
                  || Boolean(locationsError)
                }
              >
                {busy ? "Guardando…" : `${KIND_LABELS[inspectionKind]} inspección`}
              </button>
            </form>
          )}

          {canManage && reconciliationFrozen && (
            <form className={styles.reversalForm} onSubmit={submitReversal}>
              <div>
                <h3>Revertir la finalización vigente</h3>
                <p>
                  Esta acción reabre la conciliación y conserva una versión auditable;
                  no borra el historial.
                </p>
              </div>
              <label>
                Motivo obligatorio de reversión
                <textarea
                  required
                  maxLength={500}
                  value={reversalReason}
                  onChange={(event) => setReversalReason(event.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={
                  busy
                  || locationBusy
                  || inventoryPutawayBlocked
                  || !reversalReason.trim()
                }
              >
                Registrar REVERSAL
              </button>
            </form>
          )}

          <div className={styles.history}>
            <h3>Historial inmutable</h3>
            {currentSnapshot.inspections.length === 0 ? (
              <p>Aún no hay versiones de inspección.</p>
            ) : (
              <ol>
                {[...currentSnapshot.inspections]
                  .sort((left, right) => right.version - left.version)
                  .map((inspection) => {
                    const location = inspection.location
                      || locations.find((candidate) => candidate.id === inspection.locationId);
                    return (
                      <li key={inspection.id}>
                        <strong>v{inspection.version} · {KIND_LABELS[inspection.kind]}</strong>
                        <span>
                          {inspectionDate(inspection.inspectedAt)}
                          {location ? ` · ${locationLabel(location)}` : ""}
                        </span>
                        {inspection.reason && <p>{inspection.reason}</p>}
                      </li>
                    );
                  })}
              </ol>
            )}
          </div>
        </>
      )}

      {canManage && (
        <details className={styles.locationCreator}>
          <summary>Crear una ubicación para esta obra</summary>
          <form onSubmit={createLocation}>
            <label>
              Código operativo
              <input
                required
                maxLength={32}
                value={locationCode}
                onChange={(event) => setLocationCode(event.target.value)}
                placeholder="DEPOSITO-01"
              />
            </label>
            <label>
              Nombre visible
              <input
                required
                maxLength={160}
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                placeholder="Depósito principal"
              />
            </label>
            <button type="submit" disabled={busy || locationBusy}>
              {locationBusy ? "Creando…" : "Crear y seleccionar"}
            </button>
          </form>
        </details>
      )}
    </section>
  );
}
