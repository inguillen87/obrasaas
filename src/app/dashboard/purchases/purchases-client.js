"use client";

import { useRef, useState } from "react";

import styles from "../extra-work/extra-work.module.css";
import ReceiptClient from "./receipt-client";
import SupplierCommitmentsClient from "./supplier-commitments-client";

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
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

export default function PurchasesClient({
  initialOrders,
  initialReceipts,
  initialReceiptsTruncated,
  initialLineBalances,
  initialCommitments,
  suppliers,
  budgetLines,
  tasks,
  tasksTruncated,
  projectName,
  tenantToday,
  canManage,
  canReadInventory,
  canManageInventory,
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const createAttemptRef = useRef(null);
  const [form, setForm] = useState({
    supplierId: suppliers[0]?.id || "",
    number: "",
    currency: suppliers[0]?.currency || "ARS",
    budgetLineId: budgetLines[0]?.id || "",
    description: "",
    unit: "unidad",
    quantity: "",
    unitPrice: "",
  });
  const currencyOptions = Array.from(new Set([
    form.currency,
    ...suppliers.map((supplier) => supplier.currency),
  ].filter((value) => /^[A-Z]{3}$/.test(value || ""))));

  async function refreshOrders() {
    try {
      const result = await api("/api/purchase-orders");
      setOrders(result.purchaseOrders);
      return true;
    } catch (error) {
      setNotice(`La operación se guardó, pero no se pudo refrescar la lista: ${error.message}`);
      return false;
    }
  }

  async function create(event) {
    event.preventDefault();
    if (busyRef.current) return;
    const input = {
      supplierId: form.supplierId,
      number: form.number,
      currency: form.currency,
      lines: [{
        budgetLineId: form.budgetLineId,
        description: form.description,
        unit: form.unit,
        quantity: form.quantity,
        unitPrice: form.unitPrice,
      }],
    };
    const payloadKey = JSON.stringify(input);
    if (createAttemptRef.current?.payloadKey !== payloadKey) {
      createAttemptRef.current = { payloadKey, operationKey: crypto.randomUUID() };
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await api("/api/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          operationKey: createAttemptRef.current.operationKey,
        }),
      });
      setOrders((rows) => [
        result.purchaseOrder,
        ...rows.filter((row) => row.id !== result.purchaseOrder.id),
      ]);
      createAttemptRef.current = null;
      setForm((current) => ({
        ...current,
        number: "",
        description: "",
        quantity: "",
        unitPrice: "",
      }));
      setNotice("Orden creada como borrador.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function decide(order, status) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await api("/api/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          operation: "DECIDE",
          id: order.id,
          expectedRevision: order.revision,
          status,
        }),
      });
      setOrders((rows) => rows.map((row) => (
        row.id === order.id
          ? { ...row, status: result.status, revision: result.revision }
          : row
      )));
      setNotice(
        status === "APPROVED"
          ? "Orden aprobada y comprometida en presupuesto."
          : "Estado actualizado.",
      );
    } catch (error) {
      if (error.status === 409) await refreshOrders();
      setNotice(error.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <main className={styles.shell}>
        <header>
          <span>S9 · abastecimiento</span>
          <h1>Compras y recepción</h1>
          <p>{projectName} · órdenes vinculadas a proveedores y presupuesto.</p>
        </header>
        {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}

        {canManage && (
          <section className={styles.panel} aria-labelledby="purchase-create-title">
            <h2 id="purchase-create-title">Nueva orden</h2>
            {suppliers.length === 0 || budgetLines.length === 0 ? (
              <p>Configurá proveedores y líneas presupuestarias antes de crear órdenes.</p>
            ) : (
              <form onSubmit={create}>
                <label>
                  Número de orden
                  <input required value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} />
                </label>
                <label>
                  Proveedor
                  <select
                    value={form.supplierId}
                    onChange={(event) => {
                      const supplierId = event.target.value;
                      const supplier = suppliers.find((row) => row.id === supplierId);
                      setForm({
                        ...form,
                        supplierId,
                        currency: supplier?.currency || form.currency,
                      });
                    }}
                  >
                    {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.legalName}</option>)}
                  </select>
                </label>
                <label>
                  Moneda
                  <select
                    value={form.currency}
                    onChange={(event) => setForm({ ...form, currency: event.target.value })}
                  >
                    {currencyOptions.map((currencyCode) => (
                      <option key={currencyCode} value={currencyCode}>
                        {currencyCode}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Partida presupuestaria
                  <select value={form.budgetLineId} onChange={(event) => setForm({ ...form, budgetLineId: event.target.value })}>
                    {budgetLines.map((line) => <option key={line.id} value={line.id}>{line.costCode} · {line.description}</option>)}
                  </select>
                </label>
                <label>
                  Material o servicio
                  <input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
                <div className={styles.row}>
                  <label>
                    Cantidad
                    <input required type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
                  </label>
                  <label>
                    Precio unitario
                    <input required type="number" min="0" step="0.01" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
                  </label>
                </div>
                <button disabled={busy}>Crear borrador</button>
              </form>
            )}
          </section>
        )}

        <section className={styles.panel} aria-labelledby="purchase-list-title">
          <h2 id="purchase-list-title">Órdenes</h2>
          <ul>
            {orders.length === 0 ? <li>No hay órdenes registradas.</li> : orders.map((order) => (
              <li key={order.id}>
                <div>
                  <strong>{order.number} · {order.supplier?.legalName || "Proveedor"}</strong>
                  <span>{order.status} · {order.currency} {order.total} · revisión {order.revision}</span>
                  <p>{order.lines?.length || 0} líneas</p>
                </div>
                {canManage && ["DRAFT", "SUBMITTED"].includes(order.status) && (
                  <span>
                    <button type="button" disabled={busy} onClick={() => decide(order, "APPROVED")}>Aprobar</button>
                    <button type="button" disabled={busy} onClick={() => decide(order, "CANCELLED")}>Cancelar</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SupplierCommitmentsClient
        initialCommitments={initialCommitments}
        suppliers={suppliers}
        tasks={tasks}
        tasksTruncated={tasksTruncated}
        orders={orders}
        canManage={canManage}
        projectName={projectName}
        tenantToday={tenantToday}
      />

      <ReceiptClient
        orders={orders}
        initialReceipts={initialReceipts}
        initialReceiptsTruncated={initialReceiptsTruncated}
        initialLineBalances={initialLineBalances}
        canManage={canManage}
        canReadInventory={canReadInventory}
        canManageInventory={canManageInventory}
        onReceiptCommitted={refreshOrders}
      />
    </>
  );
}
