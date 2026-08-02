"use client";

import { useMemo, useRef, useState } from "react";

import styles from "./supplier-commitments.module.css";

const READY_LABELS = {
  AVAILABLE: "Disponible",
  EXPECTED_IN_TIME: "Previsto a tiempo",
  ALIGNED: "Coordinado",
  AT_RISK: "En riesgo",
  BLOCKED: "Bloquea inicio",
  REVIEW_REQUIRED: "Revisar fecha",
  ADMIN_ATTESTED: "Cumplimiento declarado",
};

const STATUS_LABELS = {
  TENTATIVE: "Tentativo",
  CONFIRMED: "Confirmado",
  AT_RISK: "En riesgo",
  FULFILLED: "Cumplido",
  CANCELLED: "Cancelado",
};

const TASK_STATUS_LABELS = {
  BACKLOG: "Pendiente",
  READY: "Lista",
  IN_PROGRESS: "En ejecución",
  BLOCKED: "Bloqueada",
  DONE: "Finalizada",
};

const REMINDER_LABELS = {
  PENDING: "Programado",
  CLAIMED: "Preparando envío",
  DISPATCHING: "Enviando",
  PROVIDER_ACCEPTED: "Aceptado por email",
  DELIVERY_DELAYED: "Entrega demorada",
  DELIVERED: "Entregado",
  FAILED: "Reintento pendiente",
  DEAD_LETTER: "Requiere intervención",
  CANCELLED: "Obsoleto",
  UNCERTAIN: "Resultado incierto",
  CONFLICT: "Conflicto idempotente",
  BOUNCED: "Rebotado",
  COMPLAINED: "Marcado como spam",
  DELIVERY_FAILED: "Entrega fallida",
  SUPPRESSED: "Dirección suprimida",
};

function localDateKey(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function fortnightFor(value) {
  const [year, month, day] = value.split("-").map(Number);
  const half = day <= 15 ? 1 : 2;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    id: `${year}-${String(month).padStart(2, "0")}-Q${half}`,
    year,
    month,
    half,
    start: `${year}-${String(month).padStart(2, "0")}-${half === 1 ? "01" : "16"}`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(half === 1 ? 15 : lastDay).padStart(2, "0")}`,
  };
}

function nextCivilDay(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function commitmentFortnights(commitment) {
  const buckets = [];
  let cursor = commitment.startsOn;
  while (cursor <= commitment.endsOn) {
    const bucket = fortnightFor(cursor);
    buckets.push(bucket);
    cursor = nextCivilDay(bucket.end);
  }
  return buckets;
}

function taskSchedule(task) {
  const startsOn = String(task?.startsAt || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null;
  const endsOn = String(task?.endsAt || task?.startsAt || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null;
  return startsOn && endsOn ? { startsOn, endsOn } : null;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function groupLabel(group) {
  const date = new Date(`${group.start}T00:00:00.000Z`);
  const month = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", month: "long", year: "numeric" }).format(date);
  return `${group.half === 1 ? "1.ª" : "2.ª"} quincena · ${month}`;
}

async function requestJson(path, options = {}) {
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

export default function SupplierCommitmentsClient({
  initialCommitments,
  suppliers,
  tasks,
  tasksTruncated,
  orders,
  canManage,
  projectName,
  tenantToday,
}) {
  const today = tenantToday || localDateKey();
  const [commitments, setCommitments] = useState(initialCommitments);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [reschedule, setReschedule] = useState(null);
  const createAttemptRef = useRef(null);
  const mutationAttemptRef = useRef(new Map());
  const firstSupplier = suppliers[0] || null;
  const [form, setForm] = useState({
    kind: "MATERIAL_DELIVERY",
    supplierId: firstSupplier?.id || "",
    purchaseOrderId: "",
    title: "",
    startsOn: today,
    endsOn: today,
    taskId: "",
    relation: "REQUIRED_BEFORE_START",
    reminderEnabled: false,
  });

  const eligibleOrders = useMemo(() => orders.filter((order) => (
    order.supplierId === form.supplierId
    && ["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status)
  )), [form.supplierId, orders]);
  const selectedSupplier = suppliers.find((supplier) => supplier.id === form.supplierId) || null;
  const groups = useMemo(() => {
    const catalog = new Map();
    const groupFor = (group) => {
      const current = catalog.get(group.id) || { ...group, tasks: [], commitments: [] };
      catalog.set(group.id, current);
      return current;
    };
    for (const task of tasks) {
      const schedule = taskSchedule(task);
      if (!schedule) continue;
      for (const group of commitmentFortnights(schedule)) {
        groupFor(group).tasks.push(task);
      }
    }
    for (const commitment of commitments) {
      for (const group of commitmentFortnights(commitment)) {
        groupFor(group).commitments.push(commitment);
      }
    }
    return [...catalog.values()].sort((left, right) => left.start.localeCompare(right.start));
  }, [commitments, tasks]);

  async function refresh() {
    const result = await requestJson("/api/supplier-commitments");
    setCommitments(result.commitments || []);
  }

  async function createCommitment(event) {
    event.preventDefault();
    if (busyRef.current) return;
    const input = {
      kind: form.kind,
      status: "CONFIRMED",
      supplierId: form.supplierId,
      purchaseOrderId: form.purchaseOrderId || null,
      title: form.title,
      startsOn: form.startsOn,
      endsOn: form.endsOn || form.startsOn,
      reminderEnabled: form.reminderEnabled,
      reminderEmailConfirmed: form.reminderEnabled,
      reminderDaysBefore: 7,
      taskLinks: form.taskId ? [{ taskId: form.taskId, relation: form.relation }] : [],
      lines: [],
    };
    const payloadKey = JSON.stringify(input);
    if (createAttemptRef.current?.payloadKey !== payloadKey) {
      createAttemptRef.current = { payloadKey, operationKey: crypto.randomUUID() };
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await requestJson("/api/supplier-commitments", {
        method: "POST",
        headers: { "Idempotency-Key": createAttemptRef.current.operationKey },
        body: JSON.stringify(input),
      });
      setCommitments((current) => [
        result.commitment,
        ...current.filter((row) => row.id !== result.commitment.id),
      ].sort((left, right) => left.startsOn.localeCompare(right.startsOn)));
      createAttemptRef.current = null;
      setForm((current) => ({ ...current, title: "", purchaseOrderId: "" }));
      setNotice(result.commitment.latestReminder?.kind === "LATE_SCHEDULED"
        ? "Compromiso guardado. Como faltan menos de siete días, quedó un aviso inmediato claramente identificado."
        : "Compromiso guardado y visible para el equipo de obra.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function mutate(commitment, action, extra = {}) {
    if (busyRef.current) return;
    const attemptKey = `${commitment.id}:${commitment.revision}:${action}:${JSON.stringify(extra)}`;
    const operationKey = mutationAttemptRef.current.get(attemptKey) || crypto.randomUUID();
    mutationAttemptRef.current.set(attemptKey, operationKey);
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await requestJson(`/api/supplier-commitments/${encodeURIComponent(commitment.id)}`, {
        method: "PATCH",
        headers: { "Idempotency-Key": operationKey },
        body: JSON.stringify({ action, expectedRevision: commitment.revision, ...extra }),
      });
      setCommitments((current) => current.map((row) => row.id === commitment.id ? result.commitment : row));
      mutationAttemptRef.current.delete(attemptKey);
      setReschedule(null);
      setNotice(action === "FULFILL" ? "Compromiso marcado como cumplido." : action === "RESCHEDULE" ? "Fecha reprogramada con trazabilidad." : "Compromiso actualizado.");
    } catch (error) {
      if (error.status === 409) await refresh().catch(() => {});
      setNotice(error.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function cancel(commitment) {
    const reason = window.prompt("Motivo de cancelación (queda en el historial):");
    if (reason?.trim()) mutate(commitment, "CANCEL", { reason: reason.trim() });
  }

  function fulfill(commitment) {
    if (commitment.kind !== "MATERIAL_DELIVERY") {
      mutate(commitment, "FULFILL");
      return;
    }
    const reason = window.prompt("Indicá el remito, recepción o evidencia revisada que confirma la entrega:");
    if (reason?.trim()) mutate(commitment, "FULFILL", { reason: reason.trim() });
  }

  return (
    <section className={styles.section} aria-labelledby="supplier-commitments-title">
      <header className={styles.header}>
        <div>
          <span>Plan de abastecimiento y servicios</span>
          <h2 id="supplier-commitments-title">Compromisos por quincena</h2>
          <p>{projectName} · entregas y servicios vinculados con la WBS, sin modificar automáticamente el estado de las tareas.</p>
        </div>
        <a className={styles.calendarLink} href="/api/schedule/calendar?format=ics">Exportar próximos 90 días (.ics)</a>
      </header>
      {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}
      {tasksTruncated && (
        <p className={styles.notice} role="status">
          La vista supera 5.000 tareas en los próximos 90 días; el calendario se muestra truncado y requiere acotar la planificación.
        </p>
      )}

      {canManage && (
        <form className={styles.form} onSubmit={createCommitment}>
          <label>
            Tipo
            <select value={form.kind} onChange={(event) => {
              const kind = event.target.value;
              setForm({
                ...form,
                kind,
                relation: kind === "MATERIAL_DELIVERY" ? "REQUIRED_BEFORE_START" : "EXECUTES_TASK",
              });
            }}>
              <option value="MATERIAL_DELIVERY">Entrega de material</option>
              <option value="SERVICE_EXECUTION">Ejecución de servicio</option>
            </select>
          </label>
          <label>
            Proveedor
            <select required value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value, purchaseOrderId: "" })}>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.legalName}</option>)}
            </select>
          </label>
          <label>
            Orden aprobada · opcional
            <select value={form.purchaseOrderId} onChange={(event) => setForm({ ...form, purchaseOrderId: event.target.value })}>
              <option value="">Sin orden vinculada</option>
              {eligibleOrders.map((order) => <option key={order.id} value={order.id}>{order.number}</option>)}
            </select>
          </label>
          <label className={styles.wide}>
            Material, entrega o servicio
            <input required minLength="3" maxLength="220" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ej. Entrega de aberturas planta alta" />
          </label>
          <label>
            Desde
            <input required type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value, endsOn: form.endsOn < event.target.value ? event.target.value : form.endsOn })} />
          </label>
          <label>
            Hasta
            <input required type="date" min={form.startsOn} value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} />
          </label>
          <label>
            Tarea habilitada · opcional
            <select value={form.taskId} onChange={(event) => setForm({ ...form, taskId: event.target.value })}>
              <option value="">Sin tarea vinculada</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.code ? `${task.code} · ` : ""}{task.title}</option>)}
            </select>
          </label>
          <label>
            Impacto en la tarea
            <select value={form.relation} onChange={(event) => setForm({ ...form, relation: event.target.value })} disabled={!form.taskId}>
              <option value="REQUIRED_BEFORE_START">Debe llegar antes de iniciar</option>
              <option value="EXECUTES_TASK">El proveedor ejecuta la tarea</option>
            </select>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={form.reminderEnabled} disabled={!selectedSupplier?.email} onChange={(event) => setForm({ ...form, reminderEnabled: event.target.checked })} />
            Confirmo que este email es operativo y autorizo avisar siete días antes
            <small>{selectedSupplier?.email ? `Destino confirmado por administración: ${selectedSupplier.email}` : "Cargá un email válido en el proveedor para habilitarlo."}</small>
          </label>
          <button type="submit" disabled={busy || !suppliers.length}>{busy ? "Guardando…" : "Registrar compromiso"}</button>
        </form>
      )}

      <div className={styles.groups}>
        {groups.length === 0 ? (
          <div className={styles.empty}>Todavía no hay entregas ni servicios programados.</div>
        ) : groups.map((group) => (
          <section className={styles.group} key={group.id}>
            <div className={styles.groupTitle}>
              <h3>{groupLabel(group)}</h3>
              <span>{formatDate(group.start)} — {formatDate(group.end)}</span>
            </div>
            {group.tasks.length > 0 && (
              <div className={styles.fortnightTasks}>
                <h4>Tareas planificadas · próximos 90 días</h4>
                <div className={styles.taskScheduleList}>
                  {group.tasks.map((task) => {
                    const schedule = taskSchedule(task);
                    return (
                      <div className={styles.taskScheduleItem} key={`${group.id}:${task.id}`}>
                        <div>
                          <strong>{task.code ? `${task.code} · ` : ""}{task.title}</strong>
                          <span>{formatDate(schedule.startsOn)}{schedule.endsOn !== schedule.startsOn ? ` a ${formatDate(schedule.endsOn)}` : ""}</span>
                        </div>
                        <em data-status={task.status}>{TASK_STATUS_LABELS[task.status] || task.status}</em>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className={styles.cards}>
              {group.commitments.map((commitment) => (
                <article className={`${styles.card} ${commitment.timing === "OVERDUE" ? styles.overdue : ""}`} key={`${group.id}:${commitment.id}`}>
                  <div className={styles.cardHead}>
                    <div>
                      <span className={styles.kind}>{commitment.kind === "MATERIAL_DELIVERY" ? "Material" : "Servicio"}</span>
                      <h4>{commitment.title}</h4>
                      <p>{commitment.supplier?.legalName} · {formatDate(commitment.startsOn)}{commitment.endsOn !== commitment.startsOn ? ` a ${formatDate(commitment.endsOn)}` : ""}</p>
                    </div>
                    <span className={`${styles.status} ${styles[commitment.status.toLowerCase()] || ""}`}>{STATUS_LABELS[commitment.status] || commitment.status}</span>
                  </div>
                  {commitment.purchaseOrder && <p className={styles.meta}>Orden {commitment.purchaseOrder.number} · {commitment.purchaseOrder.status}</p>}
                  {commitment.taskLinks.length > 0 && (
                    <div className={styles.taskLinks}>
                      {commitment.taskLinks.map((link) => (
                        <span key={link.taskId} data-risk={["AT_RISK", "BLOCKED", "ADMIN_ATTESTED"].includes(link.readiness)}>
                          {link.task?.title || "Tarea"} · {READY_LABELS[link.readiness] || link.readiness}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={styles.reminder}>
                    <strong>Email</strong>
                    <span>{commitment.reminderEnabled ? `${REMINDER_LABELS[commitment.latestReminder?.status] || "Pendiente de programar"} · ${commitment.reminderEmailMasked}` : "No activado"}</span>
                    {commitment.requiresManualReminderReview && <em>Revisión manual: un envío quedó incierto y no se reintentará solo.</em>}
                  </div>
                  {canManage && !["FULFILLED", "CANCELLED"].includes(commitment.status) && (
                    <div className={styles.actions}>
                      {commitment.status === "TENTATIVE" && <button type="button" disabled={busy} onClick={() => mutate(commitment, "CONFIRM")}>Confirmar</button>}
                      {["CONFIRMED", "AT_RISK"].includes(commitment.status) && <button type="button" disabled={busy} onClick={() => fulfill(commitment)}>Cumplido</button>}
                      {commitment.status === "CONFIRMED" && <button type="button" disabled={busy} onClick={() => mutate(commitment, "MARK_AT_RISK")}>Marcar riesgo</button>}
                      <button type="button" disabled={busy} onClick={() => setReschedule({ id: commitment.id, startsOn: commitment.startsOn, endsOn: commitment.endsOn, reason: "" })}>Reprogramar</button>
                      <button type="button" disabled={busy} onClick={() => cancel(commitment)}>Cancelar</button>
                    </div>
                  )}
                  {reschedule?.id === commitment.id && (
                    <form className={styles.reschedule} onSubmit={(event) => {
                      event.preventDefault();
                      mutate(commitment, "RESCHEDULE", { startsOn: reschedule.startsOn, endsOn: reschedule.endsOn, reason: reschedule.reason });
                    }}>
                      <input required type="date" value={reschedule.startsOn} onChange={(event) => setReschedule({ ...reschedule, startsOn: event.target.value, endsOn: reschedule.endsOn < event.target.value ? event.target.value : reschedule.endsOn })} />
                      <input required type="date" min={reschedule.startsOn} value={reschedule.endsOn} onChange={(event) => setReschedule({ ...reschedule, endsOn: event.target.value })} />
                      <input required minLength="3" maxLength="500" value={reschedule.reason} onChange={(event) => setReschedule({ ...reschedule, reason: event.target.value })} placeholder="Motivo de la reprogramación" />
                      <button disabled={busy}>Confirmar</button>
                      <button type="button" onClick={() => setReschedule(null)}>Cerrar</button>
                    </form>
                  )}
                </article>
              ))}
              {group.commitments.length === 0 && (
                <div className={styles.empty}>Sin entregas ni servicios comprometidos en esta quincena.</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
