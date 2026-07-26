"use client";

import { useRef, useState } from "react";
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
import styles from "../extra-work/extra-work.module.css";

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "No se pudo completar la operación.");
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return body;
}

export default function PayablesClient({
  initialInvoices,
  suppliers,
  purchaseOrders,
  projectName,
  canManage,
}) {
  const [rows, setRows] = useState(initialInvoices);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const uploadAttempt = useRef(null);
  const busyRef = useRef(false);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    supplierId: suppliers[0]?.id || "",
    purchaseOrderId: "",
    invoiceNumber: "",
    amount: "",
    currency: suppliers[0]?.currency || "ARS",
    dueAt: "",
  });
  const currencyOptions = Array.from(new Set([
    form.currency,
    ...suppliers.map((supplier) => supplier.currency),
    ...purchaseOrders.map((order) => order.currency),
  ].filter((value) => /^[A-Z]{3}$/.test(value || ""))));

  async function create(event) {
    event.preventDefault();
    if (busyRef.current) return;
    if (file && !isProtectedUploadFileSizeAllowed(file)) {
      setNotice(protectedUploadFileSizeMessage("El comprobante"));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    let attempt;
    try {
      const payloadKey = protectedUploadPayloadKey({
        form,
        file: protectedUploadFileIdentity(file),
      });
      attempt = await protectedUploadAttemptForPayload(uploadAttempt.current, payloadKey, {
        deleteEndpoint: "/api/supplier-invoices/evidence",
      });
      uploadAttempt.current = attempt;
      if (file && !attempt.uploadId) {
        const body = new FormData();
        body.append("file", file);
        const upload = await fetch("/api/supplier-invoices/evidence", {
          method: "POST",
          headers: { "Idempotency-Key": attempt.operationKey },
          body,
        });
        const result = await upload.json().catch(() => ({}));
        if (!upload.ok) {
          const uploadError = new Error(result.error || "No se pudo cargar el comprobante.");
          uploadError.status = upload.status;
          uploadError.code = result.code;
          throw uploadError;
        }
        rememberProtectedUploadId(attempt, result.uploadId);
      }
      const result = await api("/api/supplier-invoices", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          operationKey: attempt.operationKey,
          dueAt: form.dueAt || undefined,
          uploadId: attempt.uploadId || undefined,
        }),
      });
      setRows((current) => [
        result.invoice,
        ...current.filter((row) => row.id !== result.invoice.id),
      ]);
      uploadAttempt.current = null;
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setForm((current) => ({
        ...current,
        invoiceNumber: "",
        amount: "",
        dueAt: "",
      }));
      setNotice("Factura registrada.");
    } catch (error) {
      if (attempt?.uploadId && isTerminalProtectedUploadClientError(error)) {
        try {
          await discardProtectedUploadAttempt(attempt, "/api/supplier-invoices/evidence");
          uploadAttempt.current = null;
        } catch (cleanupError) {
          setNotice(`${error.message} ${cleanupError.message}`);
          return;
        }
      }
      setNotice(error.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function decide(row, status) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await api("/api/supplier-invoices", {
        method: "PATCH",
        body: JSON.stringify({
          id: row.id,
          expectedRevision: row.revision,
          status,
        }),
      });
      setRows((current) =>
        current.map((entry) =>
          entry.id === row.id ? { ...entry, ...result } : entry,
        ),
      );
      setNotice(`Factura: ${result.status}.`);
    } catch (error) {
      if (error.status === 409) {
        try {
          const latest = await api("/api/supplier-invoices");
          setRows(latest.invoices);
        } catch {
          // Keep the original conflict message; a manual reload remains safe.
        }
      }
      setNotice(error.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function openReceipt(row) {
    window.open(
      `/api/supplier-invoices/${encodeURIComponent(row.id)}/receipt`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  async function showMatch(row) {
    try {
      const result = await api(`/api/supplier-invoices/${row.id}/match`);
      setNotice(
        result.availableValue === null
          ? result.reason
          : `Control: recibido ${result.currency} ${result.receivedValue.toFixed(2)}, comprometido ${result.committedValue.toFixed(2)}, disponible ${result.availableValue.toFixed(2)}.`,
      );
    } catch (error) {
      setNotice(error.message);
    }
  }

  return (
    <main className={styles.shell}>
      <header>
        <span>S10 · cuentas por pagar</span>
        <h1>Facturas de proveedores</h1>
        <p>{projectName} · vencimientos y decisiones auditables.</p>
      </header>
      {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}
      {canManage && <section className={styles.panel}>
        <h2>Nueva factura</h2>
        {suppliers.length === 0 ? (
          <p>Configurá proveedores antes de registrar facturas.</p>
        ) : (
          <form onSubmit={create}>
            <select
              aria-label="Proveedor"
              value={form.supplierId}
              onChange={(event) => {
                const supplierId = event.target.value;
                const supplier = suppliers.find((row) => row.id === supplierId);
                setForm((current) => ({
                  ...current,
                  supplierId,
                  purchaseOrderId: "",
                  currency: supplier?.currency || current.currency,
                }));
              }}
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.legalName}
                </option>
              ))}
            </select>
            <select
              aria-label="Orden de compra vinculada"
              value={form.purchaseOrderId}
              onChange={(event) => {
                const purchaseOrderId = event.target.value;
                const order = purchaseOrders.find(
                  (candidate) => candidate.id === purchaseOrderId,
                );
                const supplier = suppliers.find(
                  (candidate) => candidate.id === form.supplierId,
                );
                setForm((current) => ({
                  ...current,
                  purchaseOrderId,
                  currency: order?.currency || supplier?.currency || current.currency,
                }));
              }}
            >
              <option value="">Sin orden vinculada</option>
              {purchaseOrders
                .filter(
                  (order) =>
                    !form.supplierId || order.supplierId === form.supplierId,
                )
                .map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.number} · {order.supplier?.legalName} ·{" "}
                    {order.currency} {order.total}
                  </option>
                ))}
            </select>
            <input
              aria-label="Número de factura"
              required
              value={form.invoiceNumber}
              onChange={(event) =>
                setForm({ ...form, invoiceNumber: event.target.value })
              }
              placeholder="Número de factura"
            />
            <input
              aria-label="Importe de la factura"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) =>
                setForm({ ...form, amount: event.target.value })
              }
              placeholder="Importe"
            />
            <label>
              Moneda
              <select
                value={form.currency}
                disabled={Boolean(form.purchaseOrderId)}
                onChange={(event) => setForm({ ...form, currency: event.target.value })}
              >
                {currencyOptions.map((currencyCode) => (
                  <option key={currencyCode} value={currencyCode}>
                    {currencyCode}
                  </option>
                ))}
              </select>
              {form.purchaseOrderId && (
                <small>Derivada de la orden de compra vinculada.</small>
              )}
            </label>
            <input
              aria-label="Fecha de vencimiento"
              type="date"
              value={form.dueAt}
              onChange={(event) =>
                setForm({ ...form, dueAt: event.target.value })
              }
            />
            <input
              ref={fileInputRef}
              aria-label="Comprobante de la factura"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <button disabled={busy}>Registrar factura</button>
          </form>
        )}
      </section>}
      <section className={styles.panel}>
        <h2>Obligaciones</h2>
        <ul>
          {rows.length === 0 ? (
            <li>No hay facturas registradas.</li>
          ) : (
            rows.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>
                    {row.invoiceNumber} · {row.supplier?.legalName}
                  </strong>
                  <span>
                    {row.status} · {row.currency} {row.amount} · vencimiento{" "}
                    {row.dueAt ? row.dueAt.slice(0, 10) : "sin fecha"}
                  </span>
                </div>
                {row.purchaseOrderId && (
                  <button type="button" disabled={busy} onClick={() => showMatch(row)}>
                    Ver control de recepción
                  </button>
                )}
                {row.receipt && (
                  <button type="button" disabled={busy} onClick={() => openReceipt(row)}>
                    Ver comprobante
                  </button>
                )}
                {canManage && row.status === "RECEIVED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => decide(row, "APPROVED")}
                  >
                    Aprobar
                  </button>
                )}
                {canManage && row.status === "APPROVED" && (
                  <button type="button" disabled={busy} onClick={() => decide(row, "PAID")}>
                    Marcar pagada
                  </button>
                )}
                {canManage && !["PAID", "VOIDED"].includes(row.status) && (
                  <button type="button" disabled={busy} onClick={() => decide(row, "VOIDED")}>
                    Anular
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
