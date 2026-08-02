"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  compareProcurementQuantities,
  formatProcurementQuantity,
  parseProcurementQuantity,
} from "@/lib/procurement-quantity";

import styles from "../extra-work/extra-work.module.css";
import { latestReceiptInspection } from "./receipt-inspection-model";

const INSPECTION_PAGE_SIZE = 50;
const INSPECTION_HARD_CAP = 500;

const RECEIPT_STATUS_LABELS = {
  UNALLOCATED: "Sin conciliar",
  PARTIALLY_ALLOCATED: "Conciliación parcial",
  FULLY_ALLOCATED: "Conciliada",
};

const COMMITMENT_STATUS_LABELS = {
  NOT_RECEIVED: "Sin entrega documentada",
  PARTIALLY_RECEIVED: "Documentación parcial",
  FULLY_RECEIVED: "Entrega documentada completa",
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
    const error = new Error(body.error || "No se pudo cargar la conciliación.");
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return body;
}

async function loadOrderInspections(purchaseOrderId, signal) {
  const inspections = [];
  const ids = new Set();
  const cursors = new Set();
  let cursor = null;

  while (true) {
    const query = new URLSearchParams({
      purchaseOrderId,
      limit: String(INSPECTION_PAGE_SIZE),
      ...(cursor ? { cursor } : {}),
    });
    const result = await requestJson(
      `/api/goods-receipt-inspections?${query.toString()}`,
      { signal },
    );
    const page = result.inspections;
    if (
      !Array.isArray(page)
      || page.length > INSPECTION_PAGE_SIZE
      || typeof result.hasMore !== "boolean"
    ) {
      throw new Error("El servidor devolvió una página de inspecciones inválida.");
    }
    if (inspections.length + page.length > INSPECTION_HARD_CAP) {
      throw new Error(
        `La orden supera el límite seguro de ${INSPECTION_HARD_CAP} inspecciones. Acotá el historial antes de conciliar.`,
      );
    }
    for (const inspection of page) {
      if (
        !inspection?.id
        || !inspection.goodsReceiptId
        || inspection.purchaseOrderId !== purchaseOrderId
        || ids.has(inspection.id)
      ) {
        throw new Error("El historial de inspecciones contiene registros fuera de alcance o repetidos.");
      }
      ids.add(inspection.id);
      inspections.push(inspection);
    }
    if (!result.hasMore) break;
    if (
      page.length === 0
      || inspections.length >= INSPECTION_HARD_CAP
      || typeof result.nextCursor !== "string"
      || !result.nextCursor
      || cursors.has(result.nextCursor)
    ) {
      throw new Error("La paginación de inspecciones no puede completarse de forma segura.");
    }
    cursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }

  return inspections;
}

function inspectionHeadsByReceipt(inspections) {
  const grouped = new Map();
  for (const inspection of inspections) {
    const rows = grouped.get(inspection.goodsReceiptId) || [];
    rows.push(inspection);
    grouped.set(inspection.goodsReceiptId, rows);
  }
  return new Map([...grouped].map(([goodsReceiptId, rows]) => [
    goodsReceiptId,
    latestReceiptInspection(rows),
  ]));
}

function inspectionStatusLabel(head) {
  if (!head) return "Sin inspección finalizada";
  if (head.kind === "REVERSAL") return `Revisión reabierta · v${head.version}`;
  return `Inspección v${head.version} finalizada`;
}

function remainingScaled(balance) {
  return parseProcurementQuantity(balance?.remainingQuantity || "0.000", {
    allowZero: true,
  });
}

function lineLabel(orders, purchaseOrderId, purchaseOrderLineId) {
  const order = orders.find((candidate) => candidate.id === purchaseOrderId);
  const line = order?.lines?.find((candidate) => candidate.id === purchaseOrderLineId);
  return line?.description || "Partida de la orden";
}

function dateLabel(value) {
  if (!value) return "fecha no disponible";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ReceiptReconciliationClient({
  orders,
  canManage,
  refreshVersion = 0,
}) {
  const eligibleOrders = useMemo(() => orders.filter((order) => (
    ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(order.status)
  )), [orders]);
  const [selectedOrderId, setSelectedOrderId] = useState(eligibleOrders[0]?.id || "");
  const orderId = eligibleOrders.some((order) => order.id === selectedOrderId)
    ? selectedOrderId
    : eligibleOrders[0]?.id || "";
  const [snapshot, setSnapshot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [selectedReceiptLineId, setSelectedReceiptLineId] = useState("");
  const [selectedCommitmentId, setSelectedCommitmentId] = useState("");
  const [quantity, setQuantity] = useState("");
  const attemptRef = useRef(null);
  const submittingRef = useRef(false);

  const fetchSnapshot = useCallback(async (purchaseOrderId, signal) => {
    if (!purchaseOrderId) return null;
    const query = new URLSearchParams({ purchaseOrderId, limit: "100" });
    const [result, inspections] = await Promise.all([
      requestJson(
        `/api/goods-receipt-commitment-allocations?${query.toString()}`,
        { signal },
      ),
      loadOrderInspections(purchaseOrderId, signal),
    ]);
    return {
      ...result,
      purchaseOrderId,
      inspectionHeads: inspectionHeadsByReceipt(inspections),
    };
  }, []);

  useEffect(() => {
    if (!orderId) return undefined;
    const controller = new AbortController();
    fetchSnapshot(orderId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setSnapshot(result);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setSnapshot({ purchaseOrderId: orderId, loadError: true });
          setNotice(error.message);
        }
      });
    return () => controller.abort();
  }, [fetchSnapshot, orderId, refreshVersion]);

  const currentSnapshot = snapshot?.purchaseOrderId === orderId ? snapshot : null;
  const receiptBalances = currentSnapshot?.receiptLineBalances || [];
  const commitmentBalances = currentSnapshot?.commitmentLineBalances || [];
  const inspectionHeads = currentSnapshot?.inspectionHeads || new Map();
  const pendingReceiptLines = receiptBalances.filter((balance) => (
    compareProcurementQuantities(remainingScaled(balance), 0n) > 0
  ));
  const openReceiptLines = receiptBalances.filter((balance) => (
    compareProcurementQuantities(remainingScaled(balance), 0n) > 0
    && (
      !inspectionHeads.get(balance.goodsReceiptId)
      || inspectionHeads.get(balance.goodsReceiptId).kind === "REVERSAL"
    )
  ));
  const frozenPendingReceiptLines = pendingReceiptLines.filter((balance) => (
    inspectionHeads.get(balance.goodsReceiptId)
    && inspectionHeads.get(balance.goodsReceiptId).kind !== "REVERSAL"
  ));
  const receiptLineId = openReceiptLines.some((balance) => (
    balance.goodsReceiptLineId === selectedReceiptLineId
  ))
    ? selectedReceiptLineId
    : openReceiptLines[0]?.goodsReceiptLineId || "";
  const receiptLine = openReceiptLines.find((balance) => (
    balance.goodsReceiptLineId === receiptLineId
  )) || null;
  const eligibleCommitments = commitmentBalances.filter((balance) => (
    balance.purchaseOrderLineId === receiptLine?.purchaseOrderLineId
    && balance.commitmentStatus !== "CANCELLED"
    && compareProcurementQuantities(remainingScaled(balance), 0n) > 0
  ));
  const commitmentId = eligibleCommitments.some((balance) => (
    balance.supplierCommitmentId === selectedCommitmentId
  ))
    ? selectedCommitmentId
    : eligibleCommitments[0]?.supplierCommitmentId || "";
  const commitmentLine = eligibleCommitments.find((balance) => (
    balance.supplierCommitmentId === commitmentId
  )) || null;
  const maximumScaled = receiptLine && commitmentLine
    ? (
        compareProcurementQuantities(
          remainingScaled(receiptLine),
          remainingScaled(commitmentLine),
        ) <= 0
          ? remainingScaled(receiptLine)
          : remainingScaled(commitmentLine)
      )
    : 0n;
  const maximum = formatProcurementQuantity(maximumScaled);

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current || !receiptLine || !commitmentLine) return;
    let canonicalQuantity;
    try {
      const parsed = parseProcurementQuantity(quantity);
      if (compareProcurementQuantities(parsed, maximumScaled) > 0) throw new Error();
      canonicalQuantity = formatProcurementQuantity(parsed);
    } catch {
      setNotice(`La cantidad debe ser positiva y no superar ${maximum}.`);
      return;
    }

    const payload = {
      goodsReceiptLineId: receiptLine.goodsReceiptLineId,
      supplierCommitmentId: commitmentLine.supplierCommitmentId,
      quantity: canonicalQuantity,
    };
    const payloadKey = JSON.stringify(payload);
    if (attemptRef.current?.payloadKey !== payloadKey) {
      attemptRef.current = { payloadKey, operationKey: crypto.randomUUID() };
    }
    submittingRef.current = true;
    setBusy(true);
    try {
      await requestJson("/api/goods-receipt-commitment-allocations", {
        method: "POST",
        headers: { "Idempotency-Key": attemptRef.current.operationKey },
        body: JSON.stringify(payload),
      });
      attemptRef.current = null;
      setQuantity("");
      setSelectedReceiptLineId("");
      setSelectedCommitmentId("");
      try {
        setSnapshot(await fetchSnapshot(orderId));
        setNotice("Recepción conciliada con el compromiso seleccionado.");
      } catch (refreshError) {
        setNotice(`La conciliación se guardó, pero no se pudo refrescar: ${refreshError.message}`);
      }
    } catch (error) {
      if (error.status === 409) {
        await fetchSnapshot(orderId)
          .then(setSnapshot)
          .catch(() => undefined);
      }
      setNotice(error.message);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="receipt-reconciliation-title">
      <h2 id="receipt-reconciliation-title">Conciliación de entregas</h2>
      <p>
        Asigná explícitamente cada cantidad recibida a una promesa del proveedor.
        Esta conciliación no marca por sí sola el material como disponible: stock y reserva se validan aparte.
      </p>

      {eligibleOrders.length === 0 ? (
        <p>No hay órdenes aprobadas o recibidas para conciliar.</p>
      ) : (
        <label>
          Orden de compra
          <select
            value={orderId}
            onChange={(event) => {
              setSelectedOrderId(event.target.value);
              setSelectedReceiptLineId("");
              setSelectedCommitmentId("");
              setQuantity("");
              setNotice(null);
            }}
          >
            {eligibleOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.number} · {order.supplier?.legalName || "Proveedor"}
              </option>
            ))}
          </select>
        </label>
      )}

      {orderId && !currentSnapshot && (
        <p aria-live="polite">Cargando saldos conciliados…</p>
      )}
      {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}
      {currentSnapshot?.hasMore && !currentSnapshot.loadError && (
        <p className={styles.notice}>
          El historial de asignaciones está paginado; los saldos incluyen toda la orden.
        </p>
      )}

      {currentSnapshot && !currentSnapshot.loadError && (
        <>
          <h3>Recepciones documentadas</h3>
          <ul>
            {receiptBalances.length === 0 ? (
              <li>No hay líneas de remito contabilizadas para esta orden.</li>
            ) : receiptBalances.map((balance) => {
              const inspectionHead = inspectionHeads.get(balance.goodsReceiptId);
              return (
                <li key={balance.goodsReceiptLineId}>
                  <div>
                    <strong>{lineLabel(orders, orderId, balance.purchaseOrderLineId)}</strong>
                    <span>{dateLabel(balance.receivedAt)} · {RECEIPT_STATUS_LABELS[balance.status] || balance.status}</span>
                    <span>{inspectionStatusLabel(inspectionHead)}</span>
                    <p>
                      Recibido {balance.receivedQuantity} · asignado {balance.allocatedQuantity}
                      {" · "}sin asignar {balance.remainingQuantity}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <h3>Compromisos de material</h3>
          <ul>
            {commitmentBalances.length === 0 ? (
              <li>No hay compromisos cuantificados para esta orden.</li>
            ) : commitmentBalances.map((balance) => (
              <li key={`${balance.supplierCommitmentId}:${balance.purchaseOrderLineId}`}>
                <div>
                  <strong>{balance.title || "Entrega comprometida"} · {balance.supplierLabel || "Proveedor"}</strong>
                  <span>{lineLabel(orders, orderId, balance.purchaseOrderLineId)}</span>
                  <p>
                    {COMMITMENT_STATUS_LABELS[balance.status] || balance.status}
                    {" · "}comprometido {balance.committedQuantity}
                    {" · "}documentado {balance.allocatedQuantity}
                    {" · "}pendiente {balance.remainingQuantity}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {canManage && currentSnapshot && !currentSnapshot.loadError && (
        openReceiptLines.length === 0 ? (
          frozenPendingReceiptLines.length > 0 ? (
            <p className={styles.notice} role="status">
              Queda saldo sin conciliar, pero todas las recepciones pendientes tienen una
              inspección finalizada. Registrá primero una REVERSAL desde Inspección de
              materiales para reabrir la conciliación.
            </p>
          ) : (
            <p>Todas las recepciones visibles de esta orden ya están conciliadas.</p>
          )
        ) : (
          <form onSubmit={submit}>
            <label>
              Línea recibida sin asignar
              <select
                value={receiptLineId}
                onChange={(event) => {
                  setSelectedReceiptLineId(event.target.value);
                  setSelectedCommitmentId("");
                  setQuantity("");
                }}
              >
                {openReceiptLines.map((balance) => (
                  <option key={balance.goodsReceiptLineId} value={balance.goodsReceiptLineId}>
                    {lineLabel(orders, orderId, balance.purchaseOrderLineId)} · quedan {balance.remainingQuantity}
                  </option>
                ))}
              </select>
            </label>
            {eligibleCommitments.length === 0 ? (
              <p>
                No existe un compromiso material compatible y con saldo para esta partida.
                Crealo o corregilo antes de conciliar; ObraSaaS no asigna por fecha ni por FIFO.
              </p>
            ) : (
              <>
                <label>
                  Compromiso compatible
                  <select
                    value={commitmentId}
                    onChange={(event) => {
                      setSelectedCommitmentId(event.target.value);
                      setQuantity("");
                    }}
                  >
                    {eligibleCommitments.map((balance) => (
                      <option key={balance.supplierCommitmentId} value={balance.supplierCommitmentId}>
                        {balance.title || "Entrega"} · {balance.supplierLabel || "Proveedor"}
                        {" · "}pendiente {balance.remainingQuantity}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cantidad a conciliar (máximo {maximum})
                  <input
                    required
                    type="number"
                    min="0.001"
                    max={maximum}
                    step="0.001"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
                <button disabled={busy || maximumScaled === 0n}>
                  Conciliar cantidad
                </button>
              </>
            )}
          </form>
        )
      )}
    </section>
  );
}
