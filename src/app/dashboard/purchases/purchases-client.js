"use client";

import { useMemo, useRef, useState } from "react";

import styles from "./purchases.module.css";
import ReceiptClient from "./receipt-client";
import SupplierCommitmentsClient from "./supplier-commitments-client";
import TaskMaterialRequirementsClient from "./task-material-requirements-client";
import { filterPurchaseOrders, purchaseMarketplaceSummary, purchaseOrderPresentation, PURCHASE_ORDER_FILTERS } from "@/lib/purchase-marketplace-view";

const formatMoney = (value, currency = "ARS") => {
  const amount = Number(value);
  const code = /^[A-Z]{3}$/.test(currency || "") ? currency : "ARS";
  return Number.isFinite(amount) ? new Intl.NumberFormat("es-AR", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(amount) : `${code} —`;
};

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
  materialTasks,
  materialTasksTruncated,
  projectName,
  tenantToday,
  canManage,
  canReadInventory,
  canManageInventory,
  canReadTaskMaterials,
  canManageTaskMaterials,
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
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
  const summary = useMemo(() => purchaseMarketplaceSummary({ orders, suppliers, receipts: initialReceipts, commitments: initialCommitments }), [orders, suppliers, initialReceipts, initialCommitments]);
  const filteredOrders = useMemo(() => filterPurchaseOrders(orders, { query, status: statusFilter }), [orders, query, statusFilter]);

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
        <section className={styles.hero} aria-labelledby="marketplace-title">
          <div className={styles.heroTop}>
            <div><span className={styles.eyebrow}>ABASTECIMIENTO · DATOS DE LA OBRA</span><h1 id="marketplace-title">Marketplace & compras</h1>
              <p>{projectName} · Proveedores, Órdenes, compromisos y recepciones sobre los registros reales del proyecto.</p></div>
            <span className={styles.sourceBadge}><i className="fa-solid fa-database" aria-hidden="true"/> PostgreSQL · alcance de obra</span>
          </div>
          <nav className={styles.quickLinks} aria-label="Secciones de abastecimiento">
            <a href="#marketplace-orders">Órdenes</a><a href="#marketplace-suppliers">Proveedores</a><a href="#marketplace-create">Nueva orden</a><a href="#marketplace-operational">Recepción y compromisos</a>
          </nav>
        </section>

        <section className={styles.stats} aria-label="Resumen de abastecimiento">
          <article className={styles.stat}><span>Proveedores activos</span><strong>{summary.suppliers}</strong></article>
          <article className={styles.stat}><span>Órdenes abiertas</span><strong>{summary.openOrders}</strong></article>
          <article className={styles.stat}><span>Órdenes aprobadas</span><strong>{summary.approvedOrders}</strong></article>
          <article className={styles.stat}><span>Recepciones cargadas</span><strong>{summary.receipts}</strong></article>
          <article className={styles.stat}><span>Compromisos</span><strong>{summary.commitments}</strong></article>
        </section>

        {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}

        <section className={styles.panel} id="marketplace-suppliers" aria-labelledby="marketplace-suppliers-title">
          <div className={styles.panelHeader}><div><h2 id="marketplace-suppliers-title">Directorio de proveedores</h2><p>Proveedores activos de la empresa disponibles para esta operación. No se muestran ratings ni precios inventados.</p></div></div>
          {suppliers.length === 0 ? <p className={styles.empty}>No hay proveedores activos configurados.</p> : <div className={styles.supplierGrid}>{suppliers.slice(0, 12).map(supplier => (
            <article className={styles.supplierCard} key={supplier.id}><strong>{supplier.legalName}</strong><span>{supplier.paymentTerms || 'Condición de pago no informada.'}</span>
              <div className={styles.supplierMeta}><b>{supplier.currency || 'ARS'}</b><b>Proveedor activo</b></div></article>
          ))}</div>}
          {suppliers.length > 12 && <p className={styles.footerNote}>Se muestran 12 de {suppliers.length} proveedores activos. La creación de órdenes mantiene disponible el catálogo completo.</p>}
        </section>

        <section className={styles.panel} id="marketplace-orders" aria-labelledby="purchase-list-title">
          <div className={styles.panelHeader}><div><h2 id="purchase-list-title">Órdenes de compra</h2><p>Filtrá el registro cargado sin modificarlo. Aprobar compromete presupuesto según el contrato existente.</p></div></div>
          <div className={styles.toolbar} role="search" aria-label="Buscar órdenes de compra">
            <label>Buscar<input type="search" value={query} placeholder="Número, proveedor o material" onChange={event => setQuery(event.target.value)} /></label>
            <label>Estado<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>{PURCHASE_ORDER_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
          <p className={styles.resultMeta} role="status">{filteredOrders.length} de {orders.length} órdenes cargadas.</p>
          {filteredOrders.length === 0 ? <p className={styles.empty}>No hay órdenes que coincidan con la búsqueda y el estado seleccionados.</p> : <ul className={styles.orderList}>{filteredOrders.map(order => {
            const presentation = purchaseOrderPresentation(order.status);
            return <li className={styles.orderCard} key={order.id}><div><div className={styles.orderTop}><strong>{order.number} · {order.supplier?.legalName || "Proveedor"}</strong><span className={styles.status} data-tone={presentation.tone}>{presentation.label}</span></div>
              <span className={styles.orderAmount}>{formatMoney(order.total, order.currency)} · revisión {order.revision}</span><p>{order.lines?.length || 0} líneas vinculadas</p></div>
              {canManage && ["DRAFT", "SUBMITTED"].includes(order.status) && <div className={styles.orderActions}><button type="button" disabled={busy} onClick={() => decide(order, "APPROVED")}>Aprobar</button><button type="button" disabled={busy} onClick={() => decide(order, "CANCELLED")}>Cancelar</button></div>}
            </li>;
          })}</ul>}
        </section>

        {canManage && <section className={styles.panel} id="marketplace-create" aria-labelledby="purchase-create-title">
          <div className={styles.panelHeader}><div><h2 id="purchase-create-title">Nueva orden</h2><p>Creá un borrador ligado a proveedor y partida presupuestaria. No emite una compra fuera del flujo de aprobación.</p></div>
            <button type="button" aria-expanded={createOpen} onClick={() => setCreateOpen(value => !value)}>{createOpen ? 'Ocultar formulario' : 'Preparar orden'}</button></div>
          {createOpen && (suppliers.length === 0 || budgetLines.length === 0 ? <p className={styles.empty}>Configurá proveedores y líneas presupuestarias antes de crear órdenes.</p> : <form className={styles.form} onSubmit={create}>
            <label>Número de orden<input required value={form.number} onChange={event => setForm({ ...form, number: event.target.value })} /></label>
            <label>Proveedor<select value={form.supplierId} onChange={event => {
              const supplierId = event.target.value;
              const supplier = suppliers.find(row => row.id === supplierId);
              setForm({ ...form, supplierId, currency: supplier?.currency || form.currency });
            }}>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.legalName}</option>)}</select></label>
            <label>Moneda<select value={form.currency} onChange={event => setForm({ ...form, currency:event.target.value })}>{currencyOptions.map(currencyCode => <option key={currencyCode} value={currencyCode}>{currencyCode}</option>)}</select></label>
            <label>Partida presupuestaria<select value={form.budgetLineId} onChange={event => setForm({ ...form, budgetLineId:event.target.value })}>{budgetLines.map(line => <option key={line.id} value={line.id}>{line.costCode} · {line.description}</option>)}</select></label>
            <label className={styles.formWide}>Material o servicio<input required value={form.description} onChange={event => setForm({ ...form, description:event.target.value })} /></label>
            <div className={`${styles.row} ${styles.formWide}`}><label>Cantidad<input required type="number" min="0.001" step="0.001" value={form.quantity} onChange={event => setForm({ ...form, quantity:event.target.value })} /></label><label>Precio unitario<input required type="number" min="0" step="0.01" value={form.unitPrice} onChange={event => setForm({ ...form, unitPrice:event.target.value })} /></label></div>
            <div className={styles.formActions}><button disabled={busy}>{busy ? 'Guardando…' : 'Crear borrador'}</button></div>
          </form>)}
        </section>}
        <p className={styles.footerNote} id="marketplace-operational">Los módulos de compromisos, materiales y recepción continúan debajo y conservan sus contratos transaccionales actuales.</p>
      </main>

      {canReadTaskMaterials && (
        <TaskMaterialRequirementsClient
          tasks={materialTasks}
          tasksTruncated={materialTasksTruncated}
          canManage={canManageTaskMaterials}
          projectName={projectName}
        />
      )}

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
