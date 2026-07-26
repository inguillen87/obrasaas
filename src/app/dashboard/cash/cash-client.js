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
function MovementForm({ funds, busy, onCreated, onNotice }) {
  const [form, setForm] = useState({
    fundId: funds[0]?.id || "",
    kind: "EXPENSE",
    amount: "",
    category: "",
    description: "",
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const uploadAttempt = useRef(null);
  const fileInputRef = useRef(null);
  const submittingRef = useRef(false);
  const selectedFundId = form.fundId || funds[0]?.id || "";
  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!file) return onNotice("El comprobante es obligatorio.");
    if (!isProtectedUploadFileSizeAllowed(file)) {
      return onNotice(protectedUploadFileSizeMessage("El comprobante"));
    }
    submittingRef.current = true;
    setSubmitting(true);
    let attempt;
    try {
      const submittedForm = { ...form, fundId: selectedFundId };
      const payloadKey = protectedUploadPayloadKey({
        form: submittedForm,
        file: protectedUploadFileIdentity(file),
      });
      attempt = await protectedUploadAttemptForPayload(uploadAttempt.current, payloadKey, {
        deleteEndpoint: "/api/cash-movements/receipt",
      });
      uploadAttempt.current = attempt;
      if (!attempt.uploadId) {
        const data = new FormData();
        data.append("file", file);
        const upload = await fetch("/api/cash-movements/receipt", {
          method: "POST",
          headers: { "Idempotency-Key": attempt.operationKey },
          body: data,
        });
        const receiptBody = await upload.json().catch(() => ({}));
        if (!upload.ok) {
          const uploadError = new Error(
            receiptBody.error || "No se pudo cargar el comprobante.",
          );
          uploadError.status = upload.status;
          uploadError.code = receiptBody.code;
          throw uploadError;
        }
        rememberProtectedUploadId(attempt, receiptBody.uploadId);
      }
      const result = await api("/api/cash-movements", {
        method: "POST",
        body: JSON.stringify({
          ...submittedForm,
          amount: Number(form.amount),
          idempotencyKey: attempt.operationKey,
          uploadId: attempt.uploadId,
        }),
      });
      onCreated(result.movement);
      uploadAttempt.current = null;
      setForm({
        ...submittedForm,
        amount: "",
        category: "",
        description: "",
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onNotice("Movimiento registrado con comprobante privado.");
    } catch (error) {
      if (attempt?.uploadId && isTerminalProtectedUploadClientError(error)) {
        try {
          await discardProtectedUploadAttempt(attempt, "/api/cash-movements/receipt");
          uploadAttempt.current = null;
        } catch (cleanupError) {
          return onNotice(`${error.message} ${cleanupError.message}`);
        }
      }
      onNotice(error.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }
  return (
    <section className={styles.panel}>
      <h2>Nuevo movimiento</h2>
      <form onSubmit={submit}>
        <select
          required
          aria-label="Fondo de caja"
          value={selectedFundId}
          onChange={(event) => setForm({ ...form, fundId: event.target.value })}
        >
          {funds.map((fund) => (
            <option key={fund.id} value={fund.id}>
              {fund.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Tipo de movimiento"
          value={form.kind}
          onChange={(event) => setForm({ ...form, kind: event.target.value })}
        >
          <option value="EXPENSE">Gasto</option>
          <option value="FUNDING">Fondos</option>
          <option value="REIMBURSEMENT">Reintegro</option>
          <option value="ADJUSTMENT">Ajuste</option>
        </select>
        <input
          required
          type="number"
          min="0.01"
          step="0.01"
          aria-label="Monto del movimiento"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
          placeholder="Monto"
        />
        <input
          required
          aria-label="Categoría del movimiento"
          value={form.category}
          onChange={(event) =>
            setForm({ ...form, category: event.target.value })
          }
          placeholder="Categoría"
        />
        <input
          aria-label="Descripción del movimiento"
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
          placeholder="Descripción"
        />
        <input
          ref={fileInputRef}
          required
          type="file"
          aria-label="Comprobante privado del movimiento"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <button
          type="submit"
          disabled={busy || submitting || funds.length === 0}
        >
          {submitting ? "Registrando…" : "Registrar movimiento"}
        </button>
      </form>
    </section>
  );
}
export default function CashClient({
  initialFunds,
  initialMovements,
  balances,
  canManage,
  projectName,
}) {
  const [funds, setFunds] = useState(initialFunds);
  const [movements, setMovements] = useState(initialMovements);
  const [fundBalances, setFundBalances] = useState(balances);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", currency: "ARS" });
  const busyRef = useRef(false);
  async function refreshFund(fundId) {
    const latest = await api(
      `/api/cash-movements?fundId=${encodeURIComponent(fundId)}`,
    );
    setMovements((rows) => [
      ...latest.movements,
      ...rows.filter((entry) => entry.fundId !== fundId),
    ]);
    setFundBalances((current) => ({
      ...current,
      [fundId]: latest.balance,
    }));
  }
  async function createFund(event) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await api("/api/cash-funds", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setFunds((rows) => [result.fund, ...rows]);
      setForm({ name: "", currency: "ARS" });
      setNotice("Fondo creado y auditado.");
    } catch (error) {
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
      const result = await api("/api/cash-movements", {
        method: "PATCH",
        body: JSON.stringify({
          id: row.id,
          expectedRevision: row.revision,
          status,
        }),
      });
      await refreshFund(row.fundId);
      setNotice(
        result.status === "PARTIALLY_APPROVED"
          ? "Primera aprobación registrada; falta un aprobador distinto."
          : result.approvalStage === "second"
            ? "Segunda aprobación registrada. El movimiento ya impacta el saldo."
            : result.status === "APPROVED"
              ? "Movimiento aprobado. El saldo fue actualizado."
              : "Movimiento rechazado de forma definitiva.",
      );
    } catch (error) {
      if (error.status === 409) {
        try {
          await refreshFund(row.fundId);
          setNotice(`${error.message} La lista fue actualizada.`);
        } catch {
          setNotice(`${error.message} Recargá la página antes de reintentar.`);
        }
      } else {
        setNotice(error.message);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function openReceipt(row) {
    window.open(
      `/api/cash-movements/${encodeURIComponent(row.id)}/receipt`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  const pendingMovements = movements.filter((row) =>
    ["PENDING_APPROVAL", "PARTIALLY_APPROVED"].includes(row.status),
  );
  return (
    <main className={styles.shell} aria-busy={busy}>
      <header>
        <span>S8 · control económico</span>
        <h1>Caja chica</h1>
        <a href="/api/cash-movements/export" download>
          Exportar CSV
        </a>
        <p>{projectName} · fondos, saldos y aprobaciones con trazabilidad.</p>
      </header>
      {notice && (
        <p className={styles.notice} role="status" aria-live="polite">
          {notice}
        </p>
      )}
      {canManage && (
        <MovementForm
          funds={funds}
          busy={busy}
          onCreated={(movement) => {
            setMovements((rows) => [movement, ...rows]);
            setFunds((rows) => rows.map((fund) => (
              fund.id === movement.fundId
                ? { ...fund, movementCount: Number(fund.movementCount || 0) + 1 }
                : fund
            )));
          }}
          onNotice={setNotice}
        />
      )}
      {canManage && (
        <section className={styles.panel}>
          <h2>Nuevo fondo</h2>
          <form onSubmit={createFund}>
            <input
              required
              aria-label="Nombre del fondo"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="Nombre del fondo"
            />
            <input
              required
              maxLength={3}
              aria-label="Moneda ISO del fondo"
              value={form.currency}
              onChange={(event) =>
                setForm({ ...form, currency: event.target.value.toUpperCase() })
              }
              placeholder="ARS"
            />
            <button type="submit" disabled={busy}>
              {busy ? "Procesando…" : "Crear fondo"}
            </button>
          </form>
        </section>
      )}
      <section className={styles.panel}>
        <h2>Fondos</h2>
        <ul>
          {funds.length === 0 ? (
            <li>No hay fondos configurados.</li>
          ) : (
            funds.map((fund) => (
              <li key={fund.id}>
                <div>
                  <strong>{fund.name}</strong>
                  <span>
                    {fund.currency} · {fund.movementCount || 0} movimientos
                  </span>
                  <p>
                    Saldo:{" "}
                    {Number(fundBalances[fund.id] || 0).toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
      <section className={styles.panel}>
        <h2>Movimientos pendientes</h2>
        <p>
          Los importes desde 100.000 requieren dos aprobadores distintos. El
          saldo cambia únicamente después de la aprobación final.
        </p>
        <ul>
          {pendingMovements.length === 0 ? (
            <li>No hay movimientos pendientes de decisión.</li>
          ) : (
            pendingMovements.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>
                    {row.category} · {row.amount}
                  </strong>
                  <span>
                    {row.status === "PARTIALLY_APPROVED"
                      ? "Primera aprobación completada"
                      : "Pendiente de aprobación"} · revisión {row.revision}
                  </span>
                  <p>{row.description || "Sin descripción"}</p>
                  {row.status === "PARTIALLY_APPROVED" && (
                    <p>La aprobación final debe realizarla otra persona.</p>
                  )}
                </div>
                <span>
                  {row.receipt && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Ver comprobante de ${row.category}`}
                      onClick={() => openReceipt(row)}
                    >
                      Ver comprobante
                    </button>
                  )}
                  {canManage && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`${row.status === "PARTIALLY_APPROVED" ? "Registrar segunda aprobación" : "Aprobar"} ${row.category}`}
                        onClick={() => decide(row, "APPROVED")}
                      >
                        {row.status === "PARTIALLY_APPROVED"
                          ? "Segunda aprobación"
                          : "Aprobar"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Rechazar ${row.category}`}
                        onClick={() => decide(row, "REJECTED")}
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
