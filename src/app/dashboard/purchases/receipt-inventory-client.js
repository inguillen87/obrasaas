"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./receipt-inventory-client.module.css";

const MAX_INVENTORY_ITEMS = 500;
const MAX_ACCEPTED_LINES = 1_000;

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
    const error = new Error(body.error || "No se pudo completar la operación de inventario.");
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return body;
}

function operationAttempt(current, payload, prefix) {
  const payloadKey = JSON.stringify(payload);
  if (current?.payloadKey === payloadKey) return current;
  return {
    payloadKey,
    operationKey: `${prefix}:${crypto.randomUUID()}`,
  };
}

function validateStatus(result, inspectionId) {
  if (
    result?.inspection?.id !== inspectionId
    || !Array.isArray(result.acceptedLines)
    || result.acceptedLines.length > MAX_ACCEPTED_LINES
    || !Array.isArray(result.transactions)
    || !Array.isArray(result.balances)
    || typeof result.activePutaway !== "boolean"
    || typeof result.canPutAway !== "boolean"
    || typeof result.requiresNewInspectionVersion !== "boolean"
  ) {
    throw new Error("El servidor devolvió un estado de inventario incompleto o inválido.");
  }
  const lineIds = new Set();
  for (const line of result.acceptedLines) {
    if (
      !line?.purchaseOrderLineId
      || !line.description
      || !line.unit
      || !line.acceptedQuantity
      || lineIds.has(line.purchaseOrderLineId)
    ) {
      throw new Error("El servidor devolvió líneas aceptadas duplicadas o incompletas.");
    }
    lineIds.add(line.purchaseOrderLineId);
  }
  return result;
}

function validateItems(result) {
  if (
    !Array.isArray(result?.items)
    || result.items.length > MAX_INVENTORY_ITEMS
    || result.hasMore !== false
  ) {
    throw new Error(
      "El catálogo activo supera el límite seguro o llegó incompleto. Corregilo antes de ingresar stock.",
    );
  }
  const ids = new Set();
  for (const item of result.items) {
    if (!item?.id || !item.code || !item.name || !item.baseUnit || ids.has(item.id)) {
      throw new Error("El catálogo contiene materiales duplicados o incompletos.");
    }
    ids.add(item.id);
  }
  return result.items;
}

async function loadInventorySnapshot(inspectionId, signal) {
  const [nextStatusRaw, nextItemsRaw] = await Promise.all([
    requestJson(
      `/api/inventory-transactions?sourceInspectionId=${encodeURIComponent(inspectionId)}`,
      { signal },
    ),
    requestJson("/api/inventory-items?active=true", { signal }),
  ]);
  return {
    nextStatus: validateStatus(nextStatusRaw, inspectionId),
    nextItems: validateItems(nextItemsRaw),
  };
}

function inventoryDate(value) {
  if (!value) return "fecha no disponible";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function itemLabel(item) {
  return `${item.code} · ${item.name} · ${item.baseUnit}`;
}

export default function ReceiptInventoryClient({
  inspection,
  canManage,
  onActiveStateChange,
}) {
  const inspectionId = inspection.id;
  const [status, setStatus] = useState(null);
  const [items, setItems] = useState([]);
  const [selections, setSelections] = useState({});
  const [createLineId, setCreateLineId] = useState("");
  const [itemForm, setItemForm] = useState({ code: "", name: "" });
  const [reversalReason, setReversalReason] = useState("");
  const [notice, setNotice] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);
  const itemAttemptRef = useRef(null);
  const putawayAttemptRef = useRef(null);
  const reversalAttemptRef = useRef(null);

  const commitSnapshot = useCallback(({ nextStatus, nextItems }) => {
    setStatus(nextStatus);
    setItems(nextItems);
    setSelections((current) => Object.fromEntries(nextStatus.acceptedLines.map((line) => {
      const compatibleCurrent = nextItems.find((item) => (
        item.id === current[line.purchaseOrderLineId]
        && item.baseUnit === line.unit
      ));
      return [
        line.purchaseOrderLineId,
        line.binding?.inventoryItem?.id || compatibleCurrent?.id || "",
      ];
    })));
    const firstUnbound = nextStatus.acceptedLines.find((line) => !line.binding);
    setCreateLineId((current) => (
      nextStatus.acceptedLines.some((line) => line.purchaseOrderLineId === current && !line.binding)
        ? current
        : firstUnbound?.purchaseOrderLineId || ""
    ));
  }, []);

  const refresh = useCallback(async ({ signal } = {}) => {
    const snapshot = await loadInventorySnapshot(inspectionId, signal);
    commitSnapshot(snapshot);
    const { nextStatus } = snapshot;
    return nextStatus;
  }, [commitSnapshot, inspectionId]);

  useEffect(() => {
    const controller = new AbortController();
    loadInventorySnapshot(inspectionId, controller.signal)
      .then(commitSnapshot)
      .catch((error) => {
        if (error.name !== "AbortError") setLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [commitSnapshot, inspectionId, loadAttempt]);

  function retryInitialLoad() {
    if (loading || busy) return;
    setLoadError(null);
    setLoading(true);
    setLoadAttempt((current) => current + 1);
  }

  const currentStatus = status?.inspection?.id === inspectionId ? status : null;
  useEffect(() => {
    onActiveStateChange?.(
      currentStatus ? Boolean(currentStatus.activePutaway) : null,
      inspectionId,
    );
  }, [currentStatus, inspectionId, onActiveStateChange]);

  const unboundLines = currentStatus?.acceptedLines.filter((line) => !line.binding) || [];
  const createLine = unboundLines.find((line) => (
    line.purchaseOrderLineId === createLineId
  )) || unboundLines[0] || null;
  const putaway = currentStatus?.transactions.find((row) => (
    row.kind === "RECEIPT_PUTAWAY"
  )) || null;
  const compatibleItemsByLine = useMemo(() => Object.fromEntries(
    (currentStatus?.acceptedLines || []).map((line) => [
      line.purchaseOrderLineId,
      items.filter((item) => item.active === true && item.baseUnit === line.unit),
    ]),
  ), [currentStatus?.acceptedLines, items]);
  const selectedBindingsComplete = Boolean(
    currentStatus?.acceptedLines.length
    && currentStatus.acceptedLines.every((line) => {
      const itemId = line.binding?.inventoryItem?.id || selections[line.purchaseOrderLineId];
      const item = line.binding?.inventoryItem
        || items.find((candidate) => candidate.id === itemId);
      return item?.active === true && item.baseUnit === line.unit;
    })
  );

  async function createItem(event) {
    event.preventDefault();
    if (submittingRef.current || !createLine) return;
    const payload = {
      code: itemForm.code,
      name: itemForm.name,
      baseUnit: createLine.unit,
    };
    itemAttemptRef.current = operationAttempt(
      itemAttemptRef.current,
      payload,
      "inventory-item",
    );
    submittingRef.current = true;
    setBusy(true);
    try {
      const result = await requestJson("/api/inventory-items", {
        method: "POST",
        headers: { "Idempotency-Key": itemAttemptRef.current.operationKey },
        body: JSON.stringify(payload),
      });
      if (!result.item?.id || result.item.baseUnit !== createLine.unit) {
        throw new Error("La respuesta no confirma un material de la unidad requerida.");
      }
      itemAttemptRef.current = null;
      setItems((current) => [
        ...current.filter((item) => item.id !== result.item.id),
        result.item,
      ].sort((left, right) => left.code.localeCompare(right.code, "es")));
      setSelections((current) => ({
        ...current,
        [createLine.purchaseOrderLineId]: result.item.id,
      }));
      setItemForm({ code: "", name: "" });
      setNotice(result.replayed
        ? "Material recuperado de forma idempotente y seleccionado."
        : "Material canónico creado y seleccionado; todavía no ingresó a stock.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  async function createPutaway() {
    if (
      submittingRef.current
      || !currentStatus?.canPutAway
      || !selectedBindingsComplete
    ) return;
    const payload = {
      kind: "RECEIPT_PUTAWAY",
      sourceInspectionId: inspectionId,
      bindings: currentStatus.acceptedLines.map((line) => ({
        purchaseOrderLineId: line.purchaseOrderLineId,
        inventoryItemId: line.binding?.inventoryItem?.id
          || selections[line.purchaseOrderLineId],
      })),
    };
    putawayAttemptRef.current = operationAttempt(
      putawayAttemptRef.current,
      payload,
      "inventory-putaway",
    );
    submittingRef.current = true;
    setBusy(true);
    try {
      const result = await requestJson("/api/inventory-transactions", {
        method: "POST",
        headers: { "Idempotency-Key": putawayAttemptRef.current.operationKey },
        body: JSON.stringify(payload),
      });
      if (result.transaction?.kind !== "RECEIPT_PUTAWAY") {
        throw new Error("La respuesta no confirma el ingreso a stock; reintentá sin cambiar los vínculos.");
      }
      putawayAttemptRef.current = null;
      await refresh();
      setNotice(result.replayed
        ? "Ingreso de stock recuperado de forma idempotente."
        : "Ingreso registrado como existencia física. Todavía no se reservó material para ninguna tarea.");
    } catch (error) {
      if (error.status === 409) await refresh().catch(() => undefined);
      setNotice(error.message);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  async function reversePutaway(event) {
    event.preventDefault();
    if (submittingRef.current || !putaway || !currentStatus?.activePutaway) return;
    const payload = {
      kind: "REVERSAL",
      reversesTransactionId: putaway.id,
      reason: reversalReason,
    };
    reversalAttemptRef.current = operationAttempt(
      reversalAttemptRef.current,
      payload,
      "inventory-putaway-reversal",
    );
    submittingRef.current = true;
    setBusy(true);
    try {
      const result = await requestJson("/api/inventory-transactions", {
        method: "POST",
        headers: { "Idempotency-Key": reversalAttemptRef.current.operationKey },
        body: JSON.stringify(payload),
      });
      if (result.transaction?.kind !== "REVERSAL") {
        throw new Error("La respuesta no confirma la reversión; reintentá sin cambiar el motivo.");
      }
      reversalAttemptRef.current = null;
      setReversalReason("");
      await refresh();
      setNotice(
        "Ingreso revertido exactamente. Para volver a ingresar, registrá una nueva versión de inspección.",
      );
    } catch (error) {
      if (error.status === 409) await refresh().catch(() => undefined);
      setNotice(error.message);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={`inventory-putaway-${inspectionId}`}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Ledger físico · ingreso explícito</span>
          <h3 id={`inventory-putaway-${inspectionId}`}>Ingreso y existencia física</h3>
        </div>
        {currentStatus && (
          <span className={currentStatus.activePutaway ? styles.activeBadge : styles.pendingBadge}>
            {currentStatus.activePutaway ? "EN STOCK" : "NO DISPONIBLE"}
          </span>
        )}
      </div>
      <p className={styles.intro}>
        ACEPTADO confirma calidad y ubicación. El material sólo ingresa a existencia física después de
        vincular cada línea con su identidad canónica y registrar este movimiento auditable.
        ObraSaaS nunca infiere el vínculo por descripción, fecha o FIFO, ni lo reserva para tareas.
      </p>

      {loading && <p role="status">Cargando catálogo y ledger de inventario…</p>}
      {loadError && !currentStatus && (
        <div className={styles.notice} role="alert">
          <p>{loadError}</p>
          <button type="button" disabled={loading || busy} onClick={retryInitialLoad}>
            Reintentar carga segura
          </button>
        </div>
      )}
      {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}

      {currentStatus && (
        <>
          <div className={styles.summaryGrid}>
            <div>
              <span>Ubicación física</span>
              <strong>
                {currentStatus.inspection.location.code} · {currentStatus.inspection.location.name}
              </strong>
            </div>
            <div>
              <span>Líneas aceptadas</span>
              <strong>{currentStatus.acceptedLines.length}</strong>
            </div>
            <div>
              <span>Partidas exactas</span>
              <strong>{currentStatus.acceptedDispositionCount}</strong>
            </div>
          </div>

          {currentStatus.acceptedLines.length === 0 && (
            <p className={styles.warning} role="status">
              La inspección vigente no tiene cantidad ACEPTADA para ingresar a stock.
            </p>
          )}

          <div className={styles.lineList}>
            {currentStatus.acceptedLines.map((line) => {
              const boundItem = line.binding?.inventoryItem || null;
              const compatibleItems = compatibleItemsByLine[line.purchaseOrderLineId] || [];
              return (
                <article key={line.purchaseOrderLineId} className={styles.lineCard}>
                  <div>
                    <strong>{line.description}</strong>
                    <span>{line.acceptedQuantity} {line.unit} ACEPTADO</span>
                  </div>
                  {boundItem ? (
                    <div className={styles.boundItem}>
                      <span>Vínculo inmutable</span>
                      <strong>{itemLabel(boundItem)}</strong>
                      {!boundItem.active && (
                        <small>El material está inactivo y bloquea nuevos ingresos.</small>
                      )}
                    </div>
                  ) : (
                    <label>
                      Material canónico de la misma unidad
                      <select
                        value={selections[line.purchaseOrderLineId] || ""}
                        disabled={!canManage || busy || !currentStatus.canPutAway}
                        onChange={(event) => setSelections((current) => ({
                          ...current,
                          [line.purchaseOrderLineId]: event.target.value,
                        }))}
                      >
                        <option value="">Seleccionar explícitamente</option>
                        {compatibleItems.map((item) => (
                          <option key={item.id} value={item.id}>{itemLabel(item)}</option>
                        ))}
                      </select>
                      {compatibleItems.length === 0 && (
                        <small>No hay materiales activos con unidad exacta “{line.unit}”.</small>
                      )}
                    </label>
                  )}
                </article>
              );
            })}
          </div>

          {canManage && currentStatus.canPutAway && unboundLines.length > 0 && (
            <details className={styles.itemCreator}>
              <summary>Crear material canónico sin inventar stock</summary>
              <form onSubmit={createItem}>
                <label>
                  Línea que se vinculará
                  <select
                    value={createLine?.purchaseOrderLineId || ""}
                    disabled={busy}
                    onChange={(event) => setCreateLineId(event.target.value)}
                  >
                    {unboundLines.map((line) => (
                      <option key={line.purchaseOrderLineId} value={line.purchaseOrderLineId}>
                        {line.description} · {line.unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Código único
                  <input
                    required
                    maxLength={32}
                    autoComplete="off"
                    placeholder="CEM-01"
                    value={itemForm.code}
                    onChange={(event) => setItemForm({ ...itemForm, code: event.target.value })}
                  />
                </label>
                <label>
                  Nombre
                  <input
                    required
                    maxLength={160}
                    autoComplete="off"
                    value={itemForm.name}
                    onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })}
                  />
                </label>
                <label>
                  Unidad contractual
                  <input readOnly value={createLine?.unit || ""} />
                </label>
                <button type="submit" disabled={busy || !createLine}>
                  Crear y seleccionar
                </button>
              </form>
            </details>
          )}

          {canManage && currentStatus.canPutAway && (
            <div className={styles.putawayAction}>
              <div>
                <strong>Movimiento atómico</strong>
                <p>
                  Se ingresarán todas y sólo las partidas ACEPTADAS, con sus cantidades y
                  ubicación tomadas del servidor. No admite ingreso parcial.
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !selectedBindingsComplete}
                onClick={createPutaway}
              >
                {busy ? "Registrando…" : "Ingresar todo lo ACEPTADO a stock"}
              </button>
            </div>
          )}

          {currentStatus.activePutaway && putaway && (
            <div className={styles.posted}>
              <div className={styles.postedHeader}>
                <div>
                  <strong>Ingreso #{putaway.id}</strong>
                  <span>{inventoryDate(putaway.occurredAt)} · {putaway.entries.length} partidas</span>
                </div>
                <span className={styles.activeBadge}>ON-HAND</span>
              </div>
              <ul>
                {currentStatus.acceptedLines.map((line) => (
                  <li key={line.purchaseOrderLineId}>
                    <strong>{line.binding?.inventoryItem?.code || line.description}</strong>
                    <span>{line.acceptedQuantity} {line.unit}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.balanceGrid}>
                {currentStatus.balances.map((balance) => {
                  const entry = putaway.entries.find((candidate) => (
                    candidate.inventoryItemId === balance.inventoryItemId
                    && candidate.locationId === balance.locationId
                  ));
                  return (
                    <div key={`${balance.inventoryItemId}:${balance.locationId}`}>
                      <span>Existencia actual · {entry?.item?.code || balance.inventoryItemId}</span>
                      <strong>{balance.onHand} {entry?.item?.unit || ""}</strong>
                    </div>
                  );
                })}
              </div>

              {canManage && (
                <form className={styles.reversalForm} onSubmit={reversePutaway}>
                  <div>
                    <strong>Revertir antes de corregir la inspección</strong>
                    <p>
                      La reversión resta exactamente este ingreso. Se bloquea si el material
                      ya fue consumido o movido y produciría stock negativo.
                    </p>
                  </div>
                  <label>
                    Motivo obligatorio
                    <textarea
                      required
                      maxLength={500}
                      value={reversalReason}
                      onChange={(event) => setReversalReason(event.target.value)}
                    />
                  </label>
                  <button type="submit" disabled={busy || !reversalReason.trim()}>
                    Registrar reversión de stock
                  </button>
                </form>
              )}
            </div>
          )}

          {currentStatus.requiresNewInspectionVersion && (
            <p className={styles.warning} role="status">
              El ingreso de esta versión fue revertido. Registrá una CORRECTION o REVERSAL de
              inspección antes de volver a ingresar; el historial no se reutiliza ni se borra.
            </p>
          )}
        </>
      )}
    </section>
  );
}
