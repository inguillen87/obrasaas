"use client";

import { useMemo, useRef, useState } from "react";

import {
  discardProtectedUploadAttempt,
  isProtectedUploadFileSizeAllowed,
  isTerminalProtectedUploadClientError,
  protectedUploadAttemptForPayload,
  protectedUploadFileIdentity,
  protectedUploadFileSizeMessage,
  protectedUploadPayloadKey,
  rememberProtectedUploadId,
} from "@/lib/protected-upload-policy";
import {
  compareProcurementQuantities,
  formatProcurementQuantity,
  parseProcurementQuantity,
} from "@/lib/procurement-quantity";
import styles from "../extra-work/extra-work.module.css";
import ReceiptInspectionClient from "./receipt-inspection-client";
import ReceiptReconciliationClient from "./receipt-reconciliation-client";

function indexLineBalances(balances) {
  return new Map((balances || []).map((balance) => [
    balance.purchaseOrderLineId,
    balance,
  ]));
}

function remainingForLine(line, balances) {
  const balance = balances.get(line.id);
  return parseProcurementQuantity(
    balance?.remainingToReceive || line.quantity,
    { allowZero: true },
  );
}

export default function ReceiptClient({
  orders,
  initialReceipts,
  initialReceiptsTruncated = false,
  initialLineBalances,
  canManage,
  onReceiptCommitted,
}) {
  const [receipts, setReceipts] = useState(initialReceipts);
  const [receiptsTruncated, setReceiptsTruncated] = useState(initialReceiptsTruncated);
  const [lineBalances, setLineBalances] = useState(() => (
    indexLineBalances(initialLineBalances)
  ));
  const approved = useMemo(
    () => orders.filter((order) => (
      ["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status)
    )),
    [orders],
  );
  const [selectedOrderId, setSelectedOrderId] = useState(approved[0]?.id || "");
  const order = approved.find((row) => row.id === selectedOrderId)
    || approved[0]
    || null;
  const orderId = order?.id || "";
  const openLines = useMemo(() => (order?.lines || []).filter((line) => (
    compareProcurementQuantities(
      remainingForLine(line, lineBalances),
      0n,
    ) > 0
  )), [order, lineBalances]);
  const [selectedLineId, setSelectedLineId] = useState(openLines[0]?.id || "");
  const selectedLine = openLines.find((line) => line.id === selectedLineId)
    || openLines[0]
    || null;
  const lineId = selectedLine?.id || "";
  const remainingScaled = selectedLine
    ? remainingForLine(selectedLine, lineBalances)
    : 0n;
  const remaining = formatProcurementQuantity(remainingScaled);
  const [quantity, setQuantity] = useState("");
  const [file, setFile] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reconciliationVersion, setReconciliationVersion] = useState(0);
  const uploadAttempt = useRef(null);
  const submittingRef = useRef(false);
  const fileInputRef = useRef(null);

  async function refreshReceiptState() {
    const response = await fetch("/api/goods-receipts", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result.receipts) || !Array.isArray(result.lineBalances)) {
      throw new Error(result.error || "No se pudo refrescar el saldo recibido.");
    }
    setReceipts(result.receipts);
    setReceiptsTruncated(result.hasMore === true);
    setLineBalances(indexLineBalances(result.lineBalances));
  }

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!file) {
      setNotice("El remito es obligatorio.");
      return;
    }
    if (!isProtectedUploadFileSizeAllowed(file)) {
      setNotice(protectedUploadFileSizeMessage("El remito"));
      return;
    }
    let quantityScaled;
    try {
      quantityScaled = parseProcurementQuantity(quantity);
    } catch {
      setNotice("La cantidad debe ser un decimal positivo con hasta tres decimales.");
      return;
    }
    if (
      !selectedLine
      || compareProcurementQuantities(quantityScaled, remainingScaled) > 0
    ) {
      setNotice(`La cantidad debe ser mayor que cero y no superar ${remaining}.`);
      return;
    }
    const canonicalQuantity = formatProcurementQuantity(quantityScaled);
    submittingRef.current = true;
    setBusy(true);
    let attempt;
    try {
      const payloadKey = protectedUploadPayloadKey({
        orderId,
        lineId,
        quantity: canonicalQuantity,
        file: protectedUploadFileIdentity(file),
      });
      attempt = await protectedUploadAttemptForPayload(
        uploadAttempt.current,
        payloadKey,
        { deleteEndpoint: "/api/goods-receipts/evidence" },
      );
      uploadAttempt.current = attempt;
      if (!attempt.uploadId) {
        const data = new FormData();
        data.append("file", file);
        const upload = await fetch("/api/goods-receipts/evidence", {
          method: "POST",
          headers: { "Idempotency-Key": attempt.operationKey },
          body: data,
        });
        const media = await upload.json().catch(() => ({}));
        if (!upload.ok) {
          const uploadError = new Error(
            media.error || "No se pudo cargar el remito.",
          );
          uploadError.status = upload.status;
          uploadError.code = media.code;
          throw uploadError;
        }
        rememberProtectedUploadId(attempt, media.uploadId);
      }
      const response = await fetch("/api/goods-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationKey: attempt.operationKey,
          purchaseOrderId: orderId,
          uploadId: attempt.uploadId,
          lines: [{ purchaseOrderLineId: lineId, quantity: canonicalQuantity }],
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const createError = new Error(
          result.error || "No se pudo registrar la recepción.",
        );
        createError.status = response.status;
        createError.code = result.code;
        throw createError;
      }
      uploadAttempt.current = null;
      setReceipts((current) => [
        result.receipt,
        ...current.filter((receipt) => receipt.id !== result.receipt.id),
      ].slice(0, 500));
      if (Array.isArray(result.lineBalances)) {
        setLineBalances((current) => {
          const next = new Map(current);
          for (const balance of result.lineBalances) {
            next.set(balance.purchaseOrderLineId, balance);
          }
          return next;
        });
      }
      setQuantity("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice("Recepción registrada con remito privado.");
      setReconciliationVersion((current) => current + 1);
      await onReceiptCommitted?.(result.receipt);
    } catch (error) {
      if (attempt?.uploadId && isTerminalProtectedUploadClientError(error)) {
        try {
          await discardProtectedUploadAttempt(
            attempt,
            "/api/goods-receipts/evidence",
          );
          uploadAttempt.current = null;
        } catch (cleanupError) {
          setNotice(`${error.message} ${cleanupError.message}`);
          return;
        }
      }
      if (["GOODS_RECEIPT_OVER_RECEIVE", "GOODS_RECEIPT_ORDER_CONFLICT"].includes(error.code)) {
        await refreshReceiptState().catch(() => {});
      }
      setNotice(error.message);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  function openReceipt(receipt) {
    window.open(
      `/api/goods-receipts/${encodeURIComponent(receipt.id)}/receipt`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <>
      <section className={styles.panel} aria-labelledby="goods-receipt-title">
      <h2 id="goods-receipt-title">Recepciones y remitos</h2>
      {canManage && (
        approved.length === 0 ? (
          <p>No hay órdenes aprobadas con cantidades pendientes.</p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Orden aprobada
              <select
                value={orderId}
                onChange={(event) => {
                  setSelectedOrderId(event.target.value);
                  setSelectedLineId("");
                  setQuantity("");
                }}
              >
                {approved.map((row) => (
                  <option key={row.id} value={row.id}>{row.number}</option>
                ))}
              </select>
            </label>
            <label>
              Línea pendiente
              <select
                value={lineId}
                onChange={(event) => {
                  setSelectedLineId(event.target.value);
                  setQuantity("");
                }}
                required
              >
                {openLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.description} · quedan {(
                      formatProcurementQuantity(remainingForLine(line, lineBalances))
                    )} {line.unit}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad recibida
              <input
                required
                type="number"
                min="0.001"
                max={remaining || undefined}
                step="0.001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <label>
              Remito o evidencia
              <input
                ref={fileInputRef}
                required
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
            <button disabled={busy || !selectedLine}>
              Registrar recepción
            </button>
          </form>
        )
      )}
      {notice && (
        <p className={styles.notice} role="status" aria-live="polite">
          {notice}
        </p>
      )}

      {receiptsTruncated && (
        <p className={styles.notice}>
          Se muestran las 500 recepciones más recientes; los saldos incluyen todo el historial registrado.
        </p>
      )}

      <ul>
        {receipts.length === 0 ? (
          <li>No hay recepciones registradas.</li>
        ) : receipts.map((receipt) => {
          const purchaseOrder = orders.find(
            (candidate) => candidate.id === receipt.purchaseOrderId,
          );
          return (
            <li key={receipt.id}>
              <div>
                <strong>
                  {purchaseOrder?.number || "Orden"} · {receipt.status}
                </strong>
                <span>
                  {receipt.receivedAt
                    ? new Date(receipt.receivedAt).toLocaleString("es-AR")
                    : "Fecha no disponible"}
                </span>
                <p>{receipt.lines?.length || 0} líneas recibidas</p>
              </div>
              {receipt.receipt && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openReceipt(receipt)}
                >
                  Ver remito
                </button>
              )}
            </li>
          );
        })}
      </ul>
      </section>
      <ReceiptReconciliationClient
        orders={orders}
        canManage={canManage}
        refreshVersion={reconciliationVersion}
      />
      <ReceiptInspectionClient
        receipts={receipts}
        receiptsTruncated={receiptsTruncated}
        orders={orders}
        canManage={canManage}
        refreshVersion={reconciliationVersion}
        onInspectionCommitted={() => {
          setReconciliationVersion((current) => current + 1);
        }}
      />
    </>
  );
}
