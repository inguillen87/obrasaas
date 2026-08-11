"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  applyTaskMaterialHistoryPage,
  validateTaskMaterialCatalogResponse,
} from "@/lib/task-material-requirements-ui-contract";

import TaskMaterialReservationsPanel from "./task-material-reservations-panel";
import styles from "./task-material-requirements-client.module.css";

const TASK_PAGE_SIZE = 100;
const HISTORY_PAGE_SIZE = 20;
const MAX_COMMITMENTS = 500;
const MAX_LINES = 200;
const QUANTITY_PATTERN = /^\d+(?:\.\d{1,3})?$/;
const REVISION_KINDS = new Set(["MATERIALS_REQUIRED", "NO_MATERIALS_REQUIRED"]);
const READINESS_STATES = new Set([
  "NOT_DEFINED",
  "NOT_REQUIRED",
  "DEFINED_UNRESERVED",
  "REVIEW_REQUIRED",
]);
const TASK_TYPES = new Set(["TASK", "MILESTONE"]);
const TASK_STATUSES = new Set(["BACKLOG", "READY", "IN_PROGRESS", "BLOCKED", "DONE"]);

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : dateFormatter.format(date);
}

function formatCivilDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "Sin fecha";
  return formatDate(`${value}T00:00:00.000Z`);
}

function taskName(task) {
  return `${task.code ? `${task.code} · ` : ""}${task.title}`;
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

function validateReadiness(value, head) {
  const readiness = record(value);
  if (
    !readiness
    || !READINESS_STATES.has(readiness.state)
    || !nonEmptyString(readiness.label)
    || readiness.available !== false
  ) {
    throw new Error("El estado de disponibilidad no es confiable.");
  }
  const expectedState = !head
    ? "NOT_DEFINED"
    : head.kind === "NO_MATERIALS_REQUIRED"
      ? "NOT_REQUIRED"
      : head.lines.some((line) => line.itemActive !== true)
        ? "REVIEW_REQUIRED"
        : "DEFINED_UNRESERVED";
  if (readiness.state !== expectedState) {
    throw new Error("El estado de materiales no coincide con la revisión activa.");
  }
  return readiness;
}

function validateRevision(value, taskId) {
  const revision = record(value);
  if (
    !revision
    || !nonEmptyString(revision.id)
    || revision.taskId !== taskId
    || !REVISION_KINDS.has(revision.kind)
    || !Number.isSafeInteger(revision.version)
    || revision.version < 1
    || !Number.isSafeInteger(revision.lineCount)
    || revision.lineCount < 0
    || (revision.predecessorId !== null && !nonEmptyString(revision.predecessorId))
    || !nonEmptyString(revision.reason)
    || !record(revision.taskSnapshot)
    || !Number.isSafeInteger(revision.taskSnapshot.revision)
    || revision.taskSnapshot.revision < 0
    || !nonEmptyString(revision.taskSnapshot.title)
    || !Array.isArray(revision.lines)
    || revision.lines.length > MAX_LINES
    || revision.lineCount !== revision.lines.length
  ) {
    throw new Error("Una revisión de materiales no cumple el contrato esperado.");
  }
  const seenLines = new Set();
  const seenItems = new Set();
  for (const line of revision.lines) {
    if (
      !record(line)
      || !nonEmptyString(line.id)
      || seenLines.has(line.id)
      || !nonEmptyString(line.inventoryItemId)
      || seenItems.has(line.inventoryItemId)
      || !nonEmptyString(line.requiredQuantity)
      || !validQuantity(line.requiredQuantity)
      || !nonEmptyString(line.itemCode)
      || !nonEmptyString(line.itemName)
      || !nonEmptyString(line.unit)
      || typeof line.itemActive !== "boolean"
    ) {
      throw new Error("El historial contiene una línea de materiales incompleta.");
    }
    seenLines.add(line.id);
    seenItems.add(line.inventoryItemId);
  }
  if (
    (revision.kind === "NO_MATERIALS_REQUIRED" && revision.lines.length !== 0)
    || (revision.kind === "MATERIALS_REQUIRED" && revision.lines.length === 0)
  ) {
    throw new Error("El modo de la revisión no coincide con sus líneas de materiales.");
  }
  return revision;
}

function validateTask(value, taskId) {
  const task = record(value);
  if (
    !task
    || task.id !== taskId
    || !nonEmptyString(task.title)
    || !TASK_TYPES.has(task.type)
    || !TASK_STATUSES.has(task.status)
    || !Number.isSafeInteger(task.revision)
    || task.revision < 0
  ) {
    throw new Error("La tarea autoritativa no cumple el contrato esperado.");
  }
  return task;
}

function validateSnapshot(value, taskId) {
  const snapshot = record(value);
  if (
    !snapshot
    || (snapshot.head !== null && !record(snapshot.head))
    || !Array.isArray(snapshot.history)
    || typeof snapshot.hasMore !== "boolean"
    || (snapshot.nextCursor !== null && !nonEmptyString(snapshot.nextCursor))
    || snapshot.hasMore !== Boolean(snapshot.nextCursor)
  ) {
    throw new Error("La definición de materiales llegó incompleta y se bloqueó su edición.");
  }
  const head = snapshot.head === null ? null : validateRevision(snapshot.head, taskId);
  const history = snapshot.history.map((revision) => validateRevision(revision, taskId));
  const historyIds = new Set(history.map((revision) => revision.id));
  if (historyIds.size !== history.length) {
    throw new Error("El historial de materiales contiene revisiones duplicadas.");
  }
  return {
    task: validateTask(snapshot.task, taskId),
    head,
    readiness: validateReadiness(snapshot.readiness, head),
    history,
    hasMore: snapshot.hasMore,
    nextCursor: snapshot.nextCursor,
  };
}

function validateCommitments(value, taskId) {
  const response = record(value);
  if (
    !response
    || !Array.isArray(response.commitments)
    || response.commitments.length > MAX_COMMITMENTS
    || typeof response.hasMore !== "boolean"
  ) {
    throw new Error("El contexto de proveedores llegó incompleto.");
  }
  const ids = new Set();
  const commitments = response.commitments.map((commitment) => {
    if (
      !record(commitment)
      || !nonEmptyString(commitment.id)
      || ids.has(commitment.id)
      || !nonEmptyString(commitment.title)
      || !Array.isArray(commitment.taskLinks)
      || !commitment.taskLinks.some((link) => link?.taskId === taskId)
      || !Array.isArray(commitment.lines)
    ) {
      throw new Error("Un compromiso de proveedor no corresponde a la tarea seleccionada.");
    }
    ids.add(commitment.id);
    return commitment;
  });
  return { commitments, hasMore: response.hasMore };
}

function validQuantity(value) {
  return QUANTITY_PATTERN.test(value) && /[1-9]/.test(value.replace(".", ""));
}

function mergeHistory(current, incoming) {
  const rows = [];
  const ids = new Set();
  for (const revision of [...current, ...incoming]) {
    if (!ids.has(revision.id)) {
      ids.add(revision.id);
      rows.push(revision);
    }
  }
  return rows;
}

export default function TaskMaterialRequirementsClient({
  tasks,
  tasksTruncated,
  canManage,
  projectName,
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [taskPage, setTaskPage] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [commitmentsTruncated, setCommitmentsTruncated] = useState(false);
  const [loadState, setLoadState] = useState("idle");
  const [snapshotError, setSnapshotError] = useState(null);
  const [catalogError, setCatalogError] = useState(null);
  const [commitmentsError, setCommitmentsError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [reservationBusy, setReservationBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [reservationState, setReservationState] = useState({
    taskId: null,
    known: false,
    blocksRevision: true,
    readiness: null,
  });
  const [draft, setDraft] = useState({
    kind: "MATERIALS_REQUIRED",
    reason: "",
    lines: [],
  });
  const lineCounterRef = useRef(0);
  const publishBusyRef = useRef(false);
  const reservationBusyRef = useRef(false);
  const publishAttemptRef = useRef(null);
  const historyRequestRef = useRef(null);

  useEffect(() => () => {
    historyRequestRef.current?.controller.abort();
  }, []);

  const orderedTasks = useMemo(() => [...tasks].sort((left, right) => (
    taskName(left).localeCompare(taskName(right), "es", { sensitivity: "base" })
  )), [tasks]);
  const filteredTasks = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase("es");
    if (!query) return orderedTasks;
    return orderedTasks.filter((task) => taskName(task).toLocaleLowerCase("es").includes(query));
  }, [deferredSearch, orderedTasks]);
  const taskPageCount = Math.max(1, Math.ceil(filteredTasks.length / TASK_PAGE_SIZE));
  const effectiveTaskPage = Math.min(taskPage, taskPageCount - 1);
  const visibleTasks = filteredTasks.slice(
    effectiveTaskPage * TASK_PAGE_SIZE,
    (effectiveTaskPage + 1) * TASK_PAGE_SIZE,
  );
  const selectedTask = orderedTasks.find((task) => task.id === selectedTaskId) || null;
  const authoritativeTask = snapshot?.task || selectedTask;
  const catalogById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog],
  );

  const handleReservationStateChange = useCallback((nextState) => {
    if (nextState?.taskId !== selectedTaskId) return;
    setReservationState(nextState);
  }, [selectedTaskId]);

  const handleReservationBusyChange = useCallback((taskId, nextBusy) => {
    if (taskId !== selectedTaskId) return;
    reservationBusyRef.current = nextBusy === true;
    setReservationBusy(reservationBusyRef.current);
  }, [selectedTaskId]);

  const nextDraftLine = useCallback((values = {}) => {
    lineCounterRef.current += 1;
    return {
      key: `material-line-${lineCounterRef.current}`,
      inventoryItemId: values.inventoryItemId || "",
      quantity: values.quantity || "",
      notes: values.notes || "",
      itemName: values.itemName || "",
      unit: values.unit || "",
    };
  }, []);

  const resetDraftFromHead = useCallback((head) => {
    if (head?.kind === "NO_MATERIALS_REQUIRED") {
      setDraft({ kind: "NO_MATERIALS_REQUIRED", reason: "", lines: [] });
      return;
    }
    setDraft({
      kind: "MATERIALS_REQUIRED",
      reason: "",
      lines: head?.lines?.length
        ? head.lines.map((line) => nextDraftLine({
          inventoryItemId: line.inventoryItemId,
          quantity: line.requiredQuantity,
          notes: line.notes || "",
          itemName: line.itemName,
          unit: line.unit,
        }))
        : [nextDraftLine()],
    });
  }, [nextDraftLine]);

  function prepareTaskLoad({ preserveNotice = false } = {}) {
    historyRequestRef.current?.controller.abort();
    historyRequestRef.current = null;
    setHistoryBusy(false);
    reservationBusyRef.current = false;
    setReservationBusy(false);
    setLoadState("loading");
    setSnapshot(null);
    setCatalog([]);
    setCommitments([]);
    setCommitmentsTruncated(false);
    setSnapshotError(null);
    setCatalogError(null);
    setCommitmentsError(null);
    setReservationState({
      taskId: null,
      known: false,
      blocksRevision: true,
      readiness: null,
    });
    if (!preserveNotice) setNotice(null);
  }

  function reloadTask({ preserveNotice = false, afterConflict = false } = {}) {
    if (
      !selectedTaskId
      || reservationBusyRef.current
      || (publishBusyRef.current && !afterConflict)
    ) return;
    prepareTaskLoad({ preserveNotice });
    setLoadAttempt((current) => current + 1);
  }

  useEffect(() => {
    if (!selectedTaskId || tasksTruncated) return undefined;
    const controller = new AbortController();
    let active = true;

    const requestOptions = { signal: controller.signal };
    Promise.allSettled([
      requestJson(
        `/api/tasks/${encodeURIComponent(selectedTaskId)}/material-requirements?limit=${HISTORY_PAGE_SIZE}`,
        requestOptions,
      ),
      requestJson("/api/inventory-items?active=true", requestOptions),
      requestJson(
        `/api/supplier-commitments?taskId=${encodeURIComponent(selectedTaskId)}`,
        requestOptions,
      ),
    ]).then(([snapshotResult, catalogResult, commitmentsResult]) => {
      if (!active) return;
      if (snapshotResult.status === "fulfilled") {
        try {
          const validated = validateSnapshot(snapshotResult.value, selectedTaskId);
          setSnapshot(validated);
          resetDraftFromHead(validated.head);
        } catch (error) {
          setSnapshotError(error.message);
        }
      } else if (snapshotResult.reason?.name !== "AbortError") {
        setSnapshotError(snapshotResult.reason?.message || "No se pudo cargar la definición.");
      }

      if (catalogResult.status === "fulfilled") {
        try {
          setCatalog(validateTaskMaterialCatalogResponse(catalogResult.value));
        } catch (error) {
          setCatalogError(error.message);
        }
      } else if (catalogResult.reason?.name !== "AbortError") {
        setCatalogError(catalogResult.reason?.message || "No se pudo cargar el catálogo.");
      }

      if (commitmentsResult.status === "fulfilled") {
        try {
          const validated = validateCommitments(commitmentsResult.value, selectedTaskId);
          setCommitments(validated.commitments);
          setCommitmentsTruncated(validated.hasMore);
        } catch (error) {
          setCommitmentsError(error.message);
        }
      } else if (commitmentsResult.reason?.name !== "AbortError") {
        setCommitmentsError(commitmentsResult.reason?.message || "No se pudo cargar el contexto de proveedores.");
      }
      setLoadState("ready");
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [loadAttempt, resetDraftFromHead, selectedTaskId, tasksTruncated]);

  function selectTask(taskId) {
    if (
      tasksTruncated
      || publishBusyRef.current
      || reservationBusyRef.current
      || taskId === selectedTaskId
    ) return;
    publishAttemptRef.current = null;
    prepareTaskLoad();
    setSelectedTaskId(taskId);
  }

  function setLine(lineKey, field, value) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (
        line.key === lineKey ? { ...line, [field]: value } : line
      )),
    }));
  }

  function addLine() {
    setDraft((current) => (
      current.lines.length >= MAX_LINES
        ? current
        : { ...current, lines: [...current.lines, nextDraftLine()] }
    ));
  }

  function removeLine(lineKey) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.key !== lineKey),
    }));
  }

  function declareNoMaterials() {
    setDraft((current) => ({ ...current, kind: "NO_MATERIALS_REQUIRED", lines: [] }));
    setNotice("Declaración preparada. Indicá el motivo y publicá la nueva revisión.");
  }

  function defineMaterials() {
    setDraft((current) => ({
      ...current,
      kind: "MATERIALS_REQUIRED",
      lines: current.lines.length ? current.lines : [nextDraftLine()],
    }));
    setNotice(null);
  }

  function validateDraft() {
    const reason = draft.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      return { error: "El motivo debe tener entre 3 y 500 caracteres." };
    }
    if (draft.kind === "NO_MATERIALS_REQUIRED") {
      return {
        payload: {
          expectedActiveRevisionId: snapshot.head?.id || null,
          kind: "NO_MATERIALS_REQUIRED",
          reason,
          lines: [],
        },
      };
    }
    if (draft.lines.length === 0 || draft.lines.length > MAX_LINES) {
      return { error: `Definí entre 1 y ${MAX_LINES} materiales.` };
    }
    const usedItems = new Set();
    const lines = [];
    for (const line of draft.lines) {
      if (!catalogById.has(line.inventoryItemId)) {
        return { error: "Seleccioná un material activo del catálogo en cada línea." };
      }
      if (usedItems.has(line.inventoryItemId)) {
        return { error: "Cada material puede aparecer una sola vez en la revisión." };
      }
      if (!validQuantity(line.quantity)) {
        return { error: "Cada cantidad debe ser positiva y tener hasta 3 decimales, usando punto." };
      }
      if (line.notes.length > 500) {
        return { error: "Las notas de cada material admiten hasta 500 caracteres." };
      }
      usedItems.add(line.inventoryItemId);
      lines.push({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        ...(line.notes.trim() ? { notes: line.notes.trim() } : {}),
      });
    }
    return {
      payload: {
        expectedActiveRevisionId: snapshot.head?.id || null,
        kind: "MATERIALS_REQUIRED",
        reason,
        lines,
      },
    };
  }

  async function publish(event) {
    event.preventDefault();
    if (
      publishBusyRef.current
      || !canManage
      || !snapshot
      || catalogError
      || tasksTruncated
      || reservationState.taskId !== selectedTaskId
      || !reservationState.known
      || reservationState.blocksRevision
      || authoritativeTask?.type !== "TASK"
      || authoritativeTask?.status === "DONE"
    ) return;
    const validation = validateDraft();
    if (validation.error) {
      setNotice(validation.error);
      return;
    }
    const payload = validation.payload;
    const payloadKey = JSON.stringify({ taskId: selectedTaskId, ...payload });
    if (publishAttemptRef.current?.payloadKey !== payloadKey) {
      publishAttemptRef.current = { payloadKey, operationKey: crypto.randomUUID() };
    }
    publishBusyRef.current = true;
    setPublishBusy(true);
    setNotice(null);
    try {
      const result = await requestJson(
        `/api/tasks/${encodeURIComponent(selectedTaskId)}/material-requirements`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": publishAttemptRef.current.operationKey,
          },
          body: JSON.stringify(payload),
        },
      );
      const revision = validateRevision(result.revision, selectedTaskId);
      if (
        typeof result.replayed !== "boolean"
        || revision.kind !== payload.kind
        || revision.predecessorId !== payload.expectedActiveRevisionId
      ) {
        throw new Error("La confirmación de publicación no coincide con la revisión solicitada.");
      }
      const readiness = validateReadiness(result.readiness, revision);
      setSnapshot((current) => ({
        ...current,
        head: revision,
        readiness,
        history: mergeHistory([revision], current.history),
      }));
      resetDraftFromHead(revision);
      publishAttemptRef.current = null;
      setNotice(
        result.replayed
          ? "La revisión ya existía y se recuperó sin duplicarla."
          : "Nueva revisión de materiales publicada.",
      );
    } catch (error) {
      if (error.status === 409) {
        setNotice(`${error.message} Se recargará la revisión activa antes de otro intento.`);
        reloadTask({ preserveNotice: true, afterConflict: true });
      } else {
        setNotice(`${error.message} No se reintentó automáticamente; podés repetir el mismo envío.`);
      }
    } finally {
      publishBusyRef.current = false;
      setPublishBusy(false);
    }
  }

  async function loadMoreHistory() {
    if (historyBusy || !snapshot?.hasMore || !snapshot.nextCursor || !selectedTaskId) return;
    const taskId = selectedTaskId;
    const expectedHeadId = snapshot.head?.id || null;
    const controller = new AbortController();
    historyRequestRef.current?.controller.abort();
    historyRequestRef.current = { controller, taskId };
    setHistoryBusy(true);
    setNotice(null);
    try {
      const result = await requestJson(
        `/api/tasks/${encodeURIComponent(taskId)}/material-requirements?limit=${HISTORY_PAGE_SIZE}&cursor=${encodeURIComponent(snapshot.nextCursor)}`,
        { signal: controller.signal },
      );
      if (historyRequestRef.current?.controller !== controller) return;
      const validated = validateSnapshot(result, taskId);
      if ((validated.head?.id || null) !== expectedHeadId) {
        setNotice("La revisión activa cambió mientras consultabas el historial; se recargó la tarea.");
        reloadTask({ preserveNotice: true });
        return;
      }
      setSnapshot((current) => applyTaskMaterialHistoryPage(current, {
        taskId,
        expectedHeadId,
        history: validated.history,
        hasMore: validated.hasMore,
        nextCursor: validated.nextCursor,
      }));
    } catch (error) {
      if (error.name !== "AbortError" && historyRequestRef.current?.controller === controller) {
        setNotice(error.message);
      }
    } finally {
      if (historyRequestRef.current?.controller === controller) {
        historyRequestRef.current = null;
        setHistoryBusy(false);
      }
    }
  }

  const taskCanPublish = authoritativeTask?.type === "TASK" && authoritativeTask?.status !== "DONE";
  const editorReady = canManage
    && taskCanPublish
    && snapshot
    && loadState === "ready"
    && !snapshotError
    && !catalogError
    && reservationState.taskId === selectedTaskId
    && reservationState.known
    && !reservationState.blocksRevision;

  return (
    <section className={styles.shell} aria-labelledby="task-materials-title">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>S12.2B · planificación de abastecimiento</span>
          <h2 id="task-materials-title">Materiales requeridos por tarea</h2>
          <p>
            {projectName} · cada publicación crea una revisión trazable de la BOM de la tarea.
            Definir materiales no los reserva ni cambia el estado de la tarea.
          </p>
        </div>
        <span className={styles.promiseBadge}>RESERVA CONTROLADA</span>
      </header>

      <p className={styles.availabilityWarning}>
        Sólo una reserva completa contra stock físico vuelve disponible la BOM.
        Una promesa de proveedor, una foto o una inferencia de IA nunca asignan existencias.
      </p>

      {tasksTruncated && (
        <p className={styles.blockingAlert} role="alert">
          Hay más de 5.000 tareas canónicas. El catálogo no está completo y, por seguridad,
          se bloqueó la consulta y edición de materiales hasta aplicar una selección paginada autoritativa.
        </p>
      )}

      {!tasksTruncated && (
        <div className={styles.workspace}>
          <aside className={styles.taskCatalog} aria-label="Tareas canónicas de la obra">
            <label className={styles.searchLabel}>
              Buscar por código o tarea
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setTaskPage(0);
                }}
                placeholder="Ej.: MAM-120 o mampostería"
              />
            </label>
            <p className={styles.catalogCount}>
              {filteredTasks.length} de {orderedTasks.length} tareas · página {effectiveTaskPage + 1} de {taskPageCount}
            </p>
            <div className={styles.taskList}>
              {visibleTasks.length === 0 ? (
                <p>No hay tareas que coincidan con la búsqueda.</p>
              ) : visibleTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={task.id === selectedTaskId ? styles.selectedTask : styles.taskButton}
                  aria-pressed={task.id === selectedTaskId}
                  disabled={publishBusy || reservationBusy}
                  onClick={() => selectTask(task.id)}
                >
                  <strong>{taskName(task)}</strong>
                  <span>{task.type} · {task.status}</span>
                  <small>{formatDate(task.startsAt)} → {formatDate(task.endsAt)}</small>
                </button>
              ))}
            </div>
            <nav className={styles.pagination} aria-label="Paginación del catálogo de tareas">
              <button
                type="button"
                disabled={effectiveTaskPage === 0}
                onClick={() => setTaskPage((current) => Math.max(0, current - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={effectiveTaskPage >= taskPageCount - 1}
                onClick={() => setTaskPage((current) => Math.min(taskPageCount - 1, current + 1))}
              >
                Siguiente
              </button>
            </nav>
          </aside>

          <div className={styles.detail}>
            {!selectedTask ? (
              <div className={styles.emptyState}>
                <h3>Seleccioná una tarea</h3>
                <p>La BOM, el catálogo activo y sus promesas vinculadas se cargarán recién al abrirla.</p>
              </div>
            ) : (
              <>
                <div className={styles.taskHeading}>
                  <div>
                    <span className={styles.eyebrow}>Tarea seleccionada</span>
                    <h3>{taskName(authoritativeTask)}</h3>
                    <p>{authoritativeTask.type} · {authoritativeTask.status} · revisión de tarea {authoritativeTask.revision}</p>
                  </div>
                  <button
                    type="button"
                    disabled={loadState === "loading" || publishBusy || reservationBusy}
                    onClick={() => reloadTask()}
                  >
                    Recargar datos
                  </button>
                </div>

                <div aria-live="polite">
                  {loadState === "loading" && <p className={styles.notice} role="status">Cargando definición y contexto seguro…</p>}
                  {notice && <p className={styles.notice} role="status">{notice}</p>}
                  {snapshotError && <p className={styles.blockingAlert} role="alert">{snapshotError}</p>}
                  {catalogError && <p className={styles.blockingAlert} role="alert">{catalogError}</p>}
                  {commitmentsError && <p className={styles.contextWarning} role="alert">{commitmentsError}</p>}
                </div>

                {authoritativeTask?.type === "TASK" && (
                  <TaskMaterialReservationsPanel
                    key={selectedTaskId}
                    taskId={selectedTaskId}
                    canReserve={canManage && taskCanPublish}
                    canRelease={canManage}
                    requirementRevisionId={snapshot?.head?.id || null}
                    onBusyChange={handleReservationBusyChange}
                    onReservationStateChange={handleReservationStateChange}
                  />
                )}

                {snapshot && reservationState.known && reservationState.blocksRevision && (
                  <p className={styles.contextWarning} role="status">
                    Liberá la reserva vigente antes de publicar otra revisión de la BOM.
                  </p>
                )}

                {snapshot && !taskCanPublish && (
                  <p className={styles.contextWarning} role="status">
                    {authoritativeTask.type !== "TASK"
                      ? "Los hitos se consultan, pero no admiten publicación de materiales."
                      : "La tarea está terminada: su historial queda sólo para consulta."}
                  </p>
                )}

                {snapshot && canManage && taskCanPublish && (
                  <form className={styles.editor} onSubmit={publish}>
                    <div className={styles.editorHeading}>
                      <div>
                        <h4>Nueva revisión</h4>
                        <p>
                          Se publicará contra la revisión activa {snapshot.head?.id || "inicial"}.
                          Las cantidades viajan como texto decimal exacto.
                        </p>
                      </div>
                      {draft.kind === "MATERIALS_REQUIRED" ? (
                        <button type="button" disabled={publishBusy} onClick={declareNoMaterials}>
                          Declarar que no requiere materiales
                        </button>
                      ) : (
                        <button type="button" disabled={publishBusy} onClick={defineMaterials}>
                          Definir materiales
                        </button>
                      )}
                    </div>

                    {draft.kind === "NO_MATERIALS_REQUIRED" ? (
                      <p className={styles.noMaterialsDeclaration}>
                        Esta revisión declarará explícitamente que la tarea no requiere materiales.
                      </p>
                    ) : (
                      <div className={styles.lineList}>
                        {draft.lines.map((line, index) => {
                          const missingItem = line.inventoryItemId && !catalogById.has(line.inventoryItemId);
                          return (
                            <fieldset key={line.key} className={styles.lineCard}>
                              <legend>Material {index + 1}</legend>
                              <label>
                                Material canónico activo
                                <select
                                  required
                                  value={line.inventoryItemId}
                                  disabled={!editorReady || publishBusy}
                                  onChange={(event) => setLine(line.key, "inventoryItemId", event.target.value)}
                                >
                                  <option value="">Seleccionar material</option>
                                  {missingItem && (
                                    <option value={line.inventoryItemId} disabled>
                                      {line.itemName || "Material inactivo"} · {line.unit || "sin unidad"} (reemplazar)
                                    </option>
                                  )}
                                  {catalog.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.code} · {item.name} · {item.baseUnit}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Cantidad exacta
                                <input
                                  required
                                  type="text"
                                  inputMode="decimal"
                                  pattern="[0-9]+([.][0-9]{1,3})?"
                                  placeholder="Ej.: 12.750"
                                  value={line.quantity}
                                  disabled={!editorReady || publishBusy}
                                  onChange={(event) => setLine(line.key, "quantity", event.target.value)}
                                />
                              </label>
                              <label className={styles.notesField}>
                                Nota de colocación o especificación (opcional)
                                <input
                                  maxLength={500}
                                  value={line.notes}
                                  disabled={!editorReady || publishBusy}
                                  onChange={(event) => setLine(line.key, "notes", event.target.value)}
                                />
                              </label>
                              <button
                                type="button"
                                className={styles.removeButton}
                                disabled={!editorReady || publishBusy || draft.lines.length === 1}
                                onClick={() => removeLine(line.key)}
                              >
                                Quitar línea
                              </button>
                            </fieldset>
                          );
                        })}
                        <button
                          type="button"
                          className={styles.addButton}
                          disabled={!editorReady || publishBusy || draft.lines.length >= MAX_LINES}
                          onClick={addLine}
                        >
                          Agregar material
                        </button>
                      </div>
                    )}

                    <label className={styles.reasonField}>
                      Motivo de la nueva revisión
                      <textarea
                        required
                        minLength={3}
                        maxLength={500}
                        rows={3}
                        value={draft.reason}
                        disabled={!editorReady || publishBusy}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))}
                      />
                    </label>
                    <button type="submit" disabled={!editorReady || publishBusy}>
                      {publishBusy ? "Publicando revisión…" : "Publicar nueva revisión"}
                    </button>
                  </form>
                )}

                {snapshot && !canManage && (
                  <p className={styles.contextWarning}>
                    Tenés acceso de lectura. La publicación requiere administrar tareas e inventario.
                  </p>
                )}

                <section className={styles.supplierContext} aria-labelledby="supplier-context-title">
                  <div className={styles.sectionHeading}>
                    <div>
                      <h4 id="supplier-context-title">Contexto de proveedores</h4>
                      <p>Vínculos informativos de la tarea; no asignan stock ni cubren líneas de la BOM.</p>
                    </div>
                    <span className={styles.promiseBadge}>PROMESA, NO RESERVA</span>
                  </div>
                  {commitmentsTruncated && (
                    <p className={styles.blockingAlert} role="alert">
                      Hay más compromisos vinculados que los recibidos. El contexto está incompleto y no permite inferir cobertura.
                    </p>
                  )}
                  {!commitmentsError && loadState === "ready" && commitments.length === 0 && (
                    <p>No hay promesas de proveedor vinculadas a esta tarea.</p>
                  )}
                  <ul className={styles.commitmentList}>
                    {commitments.map((commitment) => (
                      <li key={commitment.id}>
                        <div>
                          <strong>{commitment.title}</strong>
                          <span>{commitment.supplier?.legalName || "Proveedor sin nombre"} · {commitment.status}</span>
                          <small>{formatCivilDate(commitment.startsOn)} → {formatCivilDate(commitment.endsOn)}</small>
                        </div>
                        <span className={styles.promiseBadge}>PROMESA, NO RESERVA</span>
                        {commitment.lines.length > 0 && (
                          <ul>
                            {commitment.lines.map((line) => (
                              <li key={line.purchaseOrderLineId}>
                                {line.description || "Partida de orden"}: {line.quantity} {line.unit || ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>

                {snapshot && (
                  <section className={styles.history} aria-labelledby="material-history-title">
                    <div className={styles.sectionHeading}>
                      <div>
                        <h4 id="material-history-title">Historial inmutable</h4>
                        <p>Las revisiones anteriores son sólo de lectura y conservan sus nombres y unidades originales.</p>
                      </div>
                    </div>
                    {snapshot.history.length === 0 ? (
                      <p>Todavía no hay revisiones publicadas.</p>
                    ) : (
                      <ol className={styles.historyList}>
                        {snapshot.history.map((revision) => (
                          <li key={revision.id}>
                            <div className={styles.revisionHeading}>
                              <div>
                                <strong>Versión {revision.version} · {revision.kind === "NO_MATERIALS_REQUIRED" ? "No requiere materiales" : "Materiales definidos"}</strong>
                                <span>{formatDate(revision.createdAt)} · {revision.authoredBy?.name || "Autor no disponible"}</span>
                              </div>
                              <span>Revisión de tarea {revision.taskSnapshot?.revision}</span>
                            </div>
                            <p>{revision.reason}</p>
                            {revision.lines.length > 0 && (
                              <ul>
                                {revision.lines.map((line) => (
                                  <li key={line.id}>
                                    <strong>{line.itemCode} · {line.itemName}</strong>
                                    <span>{line.requiredQuantity} {line.unit}</span>
                                    {!line.itemActive && <small>Material actualmente inactivo</small>}
                                    {line.notes && <small>{line.notes}</small>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                    {snapshot.hasMore && (
                      <button type="button" disabled={historyBusy} onClick={loadMoreHistory}>
                        {historyBusy ? "Cargando historial…" : "Cargar más"}
                      </button>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
