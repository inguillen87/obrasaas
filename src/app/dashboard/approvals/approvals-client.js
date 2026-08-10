'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { useModalFocus } from '../use-modal-focus';
import styles from './approvals.module.css';
import { FIRST_VALUE_APPROVAL_SIMULATOR_HREF } from '@/lib/first-value-onboarding';

const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const TERMINAL_STATUSES = new Set(['APPLIED', 'REJECTED', 'EXPIRED', 'INVALIDATED']);

const TYPE_LABELS = {
  TASK_PROGRESS: 'Avance de tarea',
  DELAY_REPORT: 'Reporte de demora',
  CRITICAL_INCIDENT: 'Incidencia crítica',
};

const TYPE_ICONS = {
  TASK_PROGRESS: 'fa-solid fa-chart-line',
  DELAY_REPORT: 'fa-solid fa-clock-rotate-left',
  CRITICAL_INCIDENT: 'fa-solid fa-triangle-exclamation',
};

const STATUS_LABELS = {
  PENDING: 'Pendiente',
  APPLIED: 'Aplicada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Vencida',
  INVALIDATED: 'Invalidada',
};

const FILTERS = [
  ['PENDING', 'Pendientes'],
  ['HISTORY', 'Historial'],
];

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function effectiveStatus(proposal, now = Date.now()) {
  const status = String(proposal.effectiveStatus || proposal.status || 'PENDING').toUpperCase();
  const expiresAt = safeDate(proposal.expiresAt);
  if (status === 'PENDING' && expiresAt && expiresAt.getTime() <= now) return 'EXPIRED';
  return status;
}

function normalizeTask(task, fallbackKey = '') {
  const source = objectValue(task);
  const id = String(
    source.id
    || source.key
    || source.taskKey
    || source.externalId
    || fallbackKey,
  ).trim();
  if (!id) return null;
  return {
    id,
    name: String(source.name || source.title || source.taskName || `Tarea ${id}`).trim(),
    progress: finiteNumber(source.progress ?? source.currentProgress),
    revision: Number.isSafeInteger(source.revision) && source.revision >= 0
      ? source.revision
      : null,
    status: String(source.status || '').toUpperCase(),
  };
}

function normalizedTaskList(value) {
  if (Array.isArray(value)) {
    return value.map((task, index) => normalizeTask(task, index + 1)).filter(Boolean);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, task]) => normalizeTask(task, key))
      .filter(Boolean);
  }
  return [];
}

function normalizeProposal(raw) {
  const source = objectValue(raw);
  const action = objectValue(source.change || source.action);
  const precondition = objectValue(source.precondition);
  const result = objectValue(source.result);
  const proposer = objectValue(source.proposedBy || source.proposer || source.reportedBy);
  const task = objectValue(source.task || source.targetTask);
  const type = String(source.type || source.proposalType || '').toUpperCase();
  const taskKey = String(
    action.taskId
    || action.taskKey
    || task.id
    || task.key
    || source.taskKey
    || '',
  ).trim();
  const taskName = String(
    action.taskName
    || task.name
    || task.title
    || source.taskName
    || '',
  ).trim();

  return {
    id: String(source.id || '').trim(),
    confirmationCode: String(source.confirmationCode || source.code || '').trim(),
    type,
    status: String(source.status || 'PENDING').toUpperCase(),
    effectiveStatus: String(source.effectiveStatus || '').toUpperCase(),
    detailRestricted: source.detailRestricted === true,
    summary: String(source.summary || source.description || 'Propuesta operativa sin resumen.').trim(),
    createdAt: source.createdAt || source.proposedAt || null,
    expiresAt: source.expiresAt || null,
    resolvedAt: source.resolvedAt || source.updatedAt || null,
    proposerName: source.detailRestricted === true
      ? 'Identidad restringida'
      : String(
        proposer.name
        || source.proposedByName
        || source.reporterName
        || 'Equipo de obra',
      ).trim(),
    percentage: finiteNumber(
      action.percentage
      ?? source.percentage
      ?? source.proposedProgress,
    ),
    previousProgress: finiteNumber(
      action.currentProgress
      ?? precondition.progress
      ?? precondition.taskProgress
      ?? source.currentProgress
      ?? result.previousProgress,
    ),
    taskKey,
    taskName,
    result,
    requiresTaskSelection: Boolean(
      source.requiresTaskSelection
      ?? source.taskSelectionRequired
      ?? (type === 'TASK_PROGRESS' && !taskKey),
    ),
    availableTasks: normalizedTaskList(
      source.availableTasks
      || source.taskOptions
      || source.tasks,
    ),
    canManage: source.canManage,
  };
}

function proposalList(payload) {
  const source = objectValue(payload);
  const direct = Array.isArray(source.proposals)
    ? source.proposals
    : Array.isArray(source.items)
      ? source.items
      : [
          ...(Array.isArray(source.pending) ? source.pending : []),
          ...(Array.isArray(source.history) ? source.history : []),
        ];
  const seen = new Set();
  return direct
    .map(normalizeProposal)
    .filter((proposal) => proposal.id && !seen.has(proposal.id) && seen.add(proposal.id));
}

function formatDate(value, timeZone, options = {}) {
  const date = safeDate(value);
  if (!date) return 'Sin fecha registrada';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    ...options,
  }).format(date);
}

function relativeExpiry(value, now) {
  const date = safeDate(value);
  if (!date) return 'Sin vencimiento informado';
  const minutes = Math.ceil((date.getTime() - now) / 60_000);
  if (minutes <= 0) return 'Vencida';
  if (minutes === 1) return 'Vence en 1 minuto';
  if (minutes < 60) return `Vence en ${minutes} minutos`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? 'Vence en 1 hora' : `Vence en ${hours} horas`;
}

function responseMessage(payload, fallback) {
  return String(payload?.error || payload?.message || payload?.reply || fallback);
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(responseMessage(
      payload,
      'La operación no pudo completarse. Probá nuevamente.',
    ));
    error.code = payload.code || payload.outcome || '';
    error.status = response.status;
    throw error;
  }
  return payload;
}

function idempotencyKey(decision) {
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `op-${decision.toLowerCase()}-${suffix}`;
}

function decisionError(error) {
  if (error.code === 'TASK_PRECONDITION_STALE') {
    return 'El avance de la tarea cambió desde que abriste la propuesta. Actualizamos los datos: elegí la tarea y confirmá nuevamente.';
  }
  if (error.code === 'TASK_CONFIRMATION_REQUIRED') {
    return 'Necesitamos confirmar el avance actual de la tarea. Actualizamos los datos: elegila y revisá la decisión otra vez.';
  }
  if (error.code === 'TASK_NOT_FOUND') {
    return 'La tarea elegida ya no existe en la obra. Actualizamos la lista: seleccioná otra y confirmá nuevamente.';
  }
  if (error.code === 'TASK_SELECTION_CONFLICT') {
    return 'La propuesta quedó vinculada a otra tarea mientras la revisabas. Actualizamos el contexto para que vuelvas a confirmar.';
  }
  if (error.code === 'TASK_REQUIRED' || error.status === 422) {
    return 'Elegí la tarea exacta antes de confirmar la aprobación.';
  }
  if (error.code === 'FORBIDDEN' || error.status === 403) {
    return 'Tu rol no puede resolver esta propuesta. La obra no fue modificada.';
  }
  if (error.status === 404) {
    return 'La propuesta ya no está disponible en esta obra. Actualizá la bandeja.';
  }
  if (error.status === 409) {
    return error.message || 'La propuesta cambió de estado. Actualizá antes de decidir.';
  }
  return error.message || 'No pudimos registrar la decisión. La obra no fue modificada.';
}

function proposalEffect(proposal) {
  if (proposal.type === 'TASK_PROGRESS') {
    const task = proposal.detailRestricted
      ? 'Tarea con detalle restringido'
      : proposal.taskName || (proposal.taskKey ? `Tarea ${proposal.taskKey}` : null);
    return {
      title: task || 'Tarea pendiente de seleccionar',
      detail: proposal.percentage == null
        ? 'El porcentaje propuesto no está disponible.'
        : `${proposal.previousProgress == null ? 'Avance actual sin dato' : `${proposal.previousProgress}% actual`} → ${proposal.percentage}% propuesto`,
      note: 'Sólo actualiza el avance de la tarea elegida y recalcula el progreso agregado.',
    };
  }
  if (proposal.type === 'CRITICAL_INCIDENT') {
    return {
      title: 'Crear alerta crítica',
      detail: 'La incidencia quedará visible en el registro operativo y en alertas.',
      note: 'No reemplaza protocolos de seguridad ni ejecuta acciones externas automáticamente.',
    };
  }
  return {
    title: 'Registrar una demora',
    detail: 'Se creará una incidencia de planificación con la evidencia recibida.',
    note: 'No reprograma el cronograma ni cambia fechas automáticamente.',
  };
}

function statusDescription(proposal, timeZone) {
  const status = effectiveStatus(proposal);
  if (status === 'APPLIED') {
    if (proposal.type === 'TASK_PROGRESS' && proposal.result.nextProgress != null) {
      return `${proposal.result.taskName || proposal.taskName || 'Tarea'} quedó en ${proposal.result.nextProgress}%.`;
    }
    return 'El cambio autorizado quedó aplicado y auditado.';
  }
  if (status === 'REJECTED') return 'La evidencia se conservó y la obra no fue modificada.';
  if (status === 'EXPIRED') return 'Venció sin aplicar cambios sobre la obra.';
  if (status === 'INVALIDATED') return 'El contexto cambió y la propuesta se anuló de forma segura.';
  return `Creada ${formatDate(proposal.createdAt, timeZone)}`;
}

function DecisionDialog({
  busy,
  dialog,
  dialogError,
  dialogRef,
  globalTasks,
  onClose,
  onConfirm,
  onSelectTask,
  onToggleAcknowledgement,
  selectedTaskId,
  timeZone,
}) {
  if (!dialog) return null;
  const {
    proposal,
    decision,
    acknowledged,
    taskRefreshRequired = false,
  } = dialog;
  const approving = decision === 'APPROVE';
  const effect = proposalEffect(proposal);
  const taskOptions = proposal.availableTasks.length > 0
    ? proposal.availableTasks
    : globalTasks;
  const taskRequired = approving
    && proposal.type === 'TASK_PROGRESS'
    && proposal.requiresTaskSelection;
  const selectedTask = taskOptions.find((task) => task.id === selectedTaskId) || null;
  const taskSelectionReady = !taskRequired
    || Boolean(!taskRefreshRequired && selectedTask && selectedTask.progress != null);
  const ready = acknowledged && taskSelectionReady;

  return (
    <div className={styles.modalBackdrop}>
      <section
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-dialog-title"
        aria-describedby="decision-dialog-description"
        tabIndex={-1}
      >
        <header className={styles.modalHeader}>
          <div className={`${styles.modalIcon} ${approving ? styles.modalApproveIcon : styles.modalRejectIcon}`}>
            <i
              className={approving ? 'fa-solid fa-shield-check' : 'fa-solid fa-ban'}
              aria-hidden="true"
            />
          </div>
          <div>
            <p>{approving ? 'Confirmación de aprobación' : 'Confirmación de rechazo'}</p>
            <h2 id="decision-dialog-title">
              {approving ? 'Revisá el efecto antes de aplicar.' : 'Rechazar sin modificar la obra.'}
            </h2>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar confirmación"
          >
            ×
          </button>
        </header>

        <div className={styles.modalBody}>
          <p id="decision-dialog-description" className={styles.modalSummary}>
            {proposal.summary}
          </p>

          <div className={styles.modalEffect}>
            <span>Efecto verificable</span>
            <strong>{effect.title}</strong>
            <p>{effect.detail}</p>
            <small><i className="fa-solid fa-circle-info" aria-hidden="true" /> {effect.note}</small>
          </div>

          {taskRequired && (
            <label className={styles.taskSelector}>
              <span>Tarea exacta para aplicar el avance</span>
              <select
                value={selectedTaskId}
                onChange={(event) => onSelectTask(event.target.value)}
                disabled={busy || taskRefreshRequired}
                data-autofocus
              >
                <option value="">Seleccionar una tarea…</option>
                {taskOptions.map((task) => (
                  <option value={task.id} key={task.id} disabled={task.progress == null}>
                    {task.name}{task.progress == null ? ' · avance no disponible' : ` · ${task.progress}% actual`}
                  </option>
                ))}
              </select>
              <small>
                {taskRefreshRequired
                  ? 'Cerrá esta confirmación, actualizá la bandeja y volvé a revisar la propuesta.'
                  : selectedTask?.progress != null
                  ? `Esta autorización quedará vinculada al ${selectedTask.progress}% visible ahora. Si cambia, la operación fallará de forma segura.`
                  : taskOptions.length > 0
                    ? 'Elegí una tarea con avance verificable. La propuesta seguirá pendiente hasta entonces.'
                  : 'No hay tareas elegibles en la obra. Creá o recuperá una tarea antes de aprobar.'}
              </small>
            </label>
          )}

          <dl className={styles.modalFacts}>
            <div><dt>Código</dt><dd>{proposal.confirmationCode || proposal.id}</dd></div>
            <div><dt>Reportado por</dt><dd>{proposal.proposerName}</dd></div>
            <div><dt>Creada</dt><dd>{formatDate(proposal.createdAt, timeZone)}</dd></div>
            <div><dt>Vencimiento</dt><dd>{formatDate(proposal.expiresAt, timeZone)}</dd></div>
          </dl>

          <label className={styles.acknowledgement}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => onToggleAcknowledgement(event.target.checked)}
              disabled={busy}
              data-autofocus={!taskRequired ? '' : undefined}
            />
            <span>
              <strong>
                {approving
                  ? 'Revisé el efecto y quiero autorizar esta operación.'
                  : 'Confirmo el rechazo y entiendo que la evidencia se conservará.'}
              </strong>
              <small>
                La decisión queda asociada a tu identidad y registrada en la auditoría.
              </small>
            </span>
          </label>

          {dialogError && (
            <div className={styles.modalError} role="alert" tabIndex={-1}>
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
              <span>{dialogError}</span>
            </div>
          )}
        </div>

        <footer className={styles.modalFooter}>
          <button type="button" className={styles.cancelButton} onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className={approving ? styles.confirmApprove : styles.confirmReject}
            onClick={onConfirm}
            disabled={busy || !ready}
          >
            {busy ? (
              <><i className={`fa-solid fa-spinner ${styles.spinning}`} aria-hidden="true" /> Verificando…</>
            ) : approving ? (
              <><i className="fa-solid fa-check" aria-hidden="true" /> Confirmar aprobación</>
            ) : (
              <><i className="fa-solid fa-ban" aria-hidden="true" /> Confirmar rechazo</>
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function ApprovalsClient({ canCreateFieldSimulation = false }) {
  const [proposals, setProposals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [serverMetrics, setServerMetrics] = useState({});
  const [context, setContext] = useState({});
  const [canManage, setCanManage] = useState(false);
  const [activeFilter, setActiveFilter] = useState('PENDING');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [dialogError, setDialogError] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const requestIdRef = useRef(0);
  const noticeTimerRef = useRef(null);

  const closeDialog = useCallback(() => {
    if (decisionBusy) return;
    setDialog(null);
    setDialogError('');
    setSelectedTaskId('');
  }, [decisionBusy]);

  const { captureReturnFocus, dialogRef } = useModalFocus({
    locked: decisionBusy,
    onRequestClose: closeDialog,
    open: Boolean(dialog),
  });

  const loadInbox = useCallback(async ({ initial = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (initial) setLoading(true);
    else setRefreshing(true);
    setLoadError('');

    try {
      const limit = 100;
      let offset = 0;
      let payload = null;
      const allProposals = [];
      do {
        const response = await fetch(
          `/api/operational-proposals?view=all&limit=${limit}&offset=${offset}`,
          {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          },
        );
        const page = await readResponse(response);
        if (!payload) payload = page;
        const pageProposals = Array.isArray(page.proposals) ? page.proposals : [];
        allProposals.push(...pageProposals);
        if (!page.pagination?.hasMore || pageProposals.length === 0) break;
        offset += pageProposals.length;
      } while (offset <= 5_000);
      payload = { ...payload, proposals: allProposals };
      if (requestId !== requestIdRef.current) return false;

      const nextProposals = proposalList(payload);
      const payloadContext = objectValue(payload.context);
      const permissions = objectValue(payload.permissions);
      const capabilities = objectValue(payload.capabilities);
      setProposals(nextProposals);
      setTasks(normalizedTaskList(
        payload.tasks
        || payload.availableTasks
        || payloadContext.tasks,
      ));
      setServerMetrics(objectValue(payload.metrics || payload.counts || payload.summary));
      setContext({
        organizationName: String(
          payloadContext.organizationName
          || payload.organization?.name
          || payload.organizationName
          || '',
        ),
        projectName: String(
          payloadContext.projectName
          || payload.project?.name
          || payload.projectName
          || '',
        ),
        timeZone: String(
          payloadContext.timeZone
          || payloadContext.timezone
          || payload.project?.timezone
          || payload.organization?.timezone
          || payload.timezone
          || DEFAULT_TIME_ZONE,
        ),
      });
      setCanManage(Boolean(
        permissions.manage
        ?? permissions.canManage
        ?? capabilities.decide
        ?? payload.canManage
        ?? false,
      ));
      setLastSync(new Date());
      return true;
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setLoadError(error.message || 'No pudimos cargar la bandeja de aprobaciones.');
      }
      return false;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadInbox({ initial: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      requestIdRef.current += 1;
    };
  }, [loadInbox]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [dialog]);

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  const timeZone = context.timeZone || DEFAULT_TIME_ZONE;
  const counts = useMemo(() => {
    const statuses = proposals.map((proposal) => ({
      proposal,
      status: effectiveStatus(proposal, now),
    }));
    const pending = statuses.filter(({ status }) => status === 'PENDING');
    const resolvedCutoff = now - 24 * 60 * 60 * 1_000;
    const numberFromServer = (keys, fallback) => {
      for (const key of keys) {
        const value = finiteNumber(serverMetrics[key]);
        if (value != null) return value;
      }
      return fallback;
    };
    const terminalCountFromServer = [
      'applied',
      'rejected',
      'expired',
      'invalidated',
    ].reduce((total, key) => total + (finiteNumber(serverMetrics[key]) || 0), 0);
    return {
      pending: numberFromServer(
        ['pending', 'pendingCount'],
        pending.length,
      ),
      critical: numberFromServer(
        ['critical', 'criticalPending', 'criticalCount'],
        pending.filter(({ proposal }) => proposal.type === 'CRITICAL_INCIDENT').length,
      ),
      expiring: numberFromServer(
        ['expiring', 'expiringSoon', 'expiringSoonCount'],
        pending.filter(({ proposal }) => {
          const expiresAt = safeDate(proposal.expiresAt)?.getTime();
          return expiresAt && expiresAt > now && expiresAt - now <= 10 * 60 * 1_000;
        }).length,
      ),
      resolved: numberFromServer(
        ['resolvedLast24Hours', 'resolved24h', 'recentlyResolved'],
        statuses.filter(({ proposal, status }) => {
          const resolvedAt = safeDate(proposal.resolvedAt)?.getTime();
          return TERMINAL_STATUSES.has(status) && resolvedAt && resolvedAt >= resolvedCutoff;
        }).length,
      ),
      history: numberFromServer(
        ['history', 'historyCount'],
        terminalCountFromServer
          || statuses.filter(({ status }) => TERMINAL_STATUSES.has(status)).length,
      ),
    };
  }, [now, proposals, serverMetrics]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    return proposals
      .filter((proposal) => {
        const status = effectiveStatus(proposal, now);
        if (activeFilter === 'PENDING' && status !== 'PENDING') return false;
        if (activeFilter === 'HISTORY' && !TERMINAL_STATUSES.has(status)) return false;
        if (typeFilter !== 'ALL' && proposal.type !== typeFilter) return false;
        if (!needle) return true;
        return [
          proposal.summary,
          proposal.confirmationCode,
          proposal.proposerName,
          proposal.taskName,
          TYPE_LABELS[proposal.type],
        ].some((value) => String(value || '').toLocaleLowerCase('es').includes(needle));
      })
      .sort((left, right) => {
        if (activeFilter === 'PENDING') {
          const criticalDifference = Number(right.type === 'CRITICAL_INCIDENT')
            - Number(left.type === 'CRITICAL_INCIDENT');
          if (criticalDifference) return criticalDifference;
          return (safeDate(left.expiresAt)?.getTime() || Infinity)
            - (safeDate(right.expiresAt)?.getTime() || Infinity);
        }
        const leftDate = safeDate(left.resolvedAt || left.createdAt)?.getTime() || 0;
        const rightDate = safeDate(right.resolvedAt || right.createdAt)?.getTime() || 0;
        return rightDate - leftDate;
      });
  }, [activeFilter, now, proposals, query, typeFilter]);

  function showNotice(type, text) {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    setNotice({ type, text });
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 7_000);
  }

  function openDecision(proposal, decision) {
    captureReturnFocus();
    setDialog({
      proposal,
      decision,
      acknowledged: false,
      taskRefreshRequired: false,
      idempotencyKey: idempotencyKey(decision),
    });
    setSelectedTaskId(proposal.taskKey || '');
    setDialogError('');
  }

  function selectDecisionTask(taskId) {
    setSelectedTaskId(taskId);
    setDialog((current) => current ? {
      ...current,
      acknowledged: false,
      idempotencyKey: idempotencyKey(current.decision),
    } : current);
    setDialogError('');
  }

  async function confirmDecision() {
    if (!dialog || decisionBusy) return;
    const taskOptions = dialog.proposal.availableTasks.length > 0
      ? dialog.proposal.availableTasks
      : tasks;
    const selectedTask = taskOptions.find((task) => task.id === selectedTaskId) || null;
    const taskId = dialog.decision === 'APPROVE'
      && dialog.proposal.requiresTaskSelection
      && selectedTaskId
      ? selectedTaskId
      : null;
    const taskExpectedProgress = taskId ? selectedTask?.progress : null;
    const taskExpectedRevision = taskId ? selectedTask?.revision : null;
    if (taskId && taskExpectedProgress == null) {
      setDialogError('No pudimos verificar el avance actual de esa tarea. Actualizá la bandeja antes de aprobar.');
      return;
    }
    setDecisionBusy(true);
    setDialogError('');

    try {
      const response = await fetch(`/api/operational-proposals/${encodeURIComponent(dialog.proposal.id)}/decision`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Idempotency-Key': dialog.idempotencyKey,
        },
        body: JSON.stringify({
          decision: dialog.decision,
          ...(taskId ? { taskId } : {}),
          ...(taskExpectedProgress != null ? { taskExpectedProgress } : {}),
          ...(taskExpectedRevision != null ? { taskExpectedRevision } : {}),
        }),
      });
      const payload = await readResponse(response);
      const refreshed = await loadInbox();
      setDialog(null);
      setSelectedTaskId('');
      setDialogError('');
      const outcome = String(payload.outcome || payload.proposal?.status || '').toUpperCase();
      const message = payload.message || payload.reply || (
        dialog.decision === 'APPROVE'
          ? 'La decisión fue procesada por el servidor.'
          : 'La propuesta fue rechazada sin modificar la obra.'
      );
      showNotice(
        outcome === 'INVALIDATED' || outcome === 'EXPIRED' ? 'warning' : 'success',
        refreshed ? message : `${message} No pudimos refrescar la bandeja; actualizala manualmente.`,
      );
    } catch (error) {
      const taskNeedsRefresh = (
        error.code === 'TASK_PRECONDITION_STALE'
        || error.code === 'TASK_CONFIRMATION_REQUIRED'
        || error.code === 'TASK_NOT_FOUND'
        || error.code === 'TASK_SELECTION_CONFLICT'
      );
      const refreshed = taskNeedsRefresh ? await loadInbox() : false;
      setDialogError(
        taskNeedsRefresh && !refreshed
          ? 'La tarea cambió, pero no pudimos refrescar su avance. Cerrá esta confirmación, actualizá la bandeja y revisá nuevamente.'
          : decisionError(error),
      );
      if (
        error.code === 'TASK_REQUIRED'
        || error.code === 'TASK_NOT_FOUND'
        || error.code === 'TASK_SELECTION_CONFLICT'
        || error.code === 'TASK_PRECONDITION_STALE'
        || error.code === 'TASK_CONFIRMATION_REQUIRED'
      ) {
        setSelectedTaskId('');
        setDialog((current) => current ? {
          ...current,
          acknowledged: false,
          taskRefreshRequired: taskNeedsRefresh && !refreshed,
          proposal: {
            ...current.proposal,
            availableTasks: [],
            requiresTaskSelection: true,
          },
          idempotencyKey: idempotencyKey(current.decision),
        } : current);
      }
      if (!taskNeedsRefresh && (error.status === 404 || error.status === 409)) {
        void loadInbox();
      }
    } finally {
      setDecisionBusy(false);
    }
  }

  function clearFilters() {
    setTypeFilter('ALL');
    setQuery('');
  }

  if (loading) {
    return (
      <section className={styles.clientLoading} aria-busy="true" aria-live="polite">
        <div className={styles.loadingMetrics} aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div className={`${styles.skeleton} ${styles.loadingMetric}`} key={index} />
          ))}
        </div>
        <div className={styles.loadingWorkspace} aria-hidden="true">
          <div className={`${styles.skeleton} ${styles.loadingToolbar}`} />
          {Array.from({ length: 3 }, (_, index) => (
            <div className={`${styles.skeleton} ${styles.loadingCard}`} key={index} />
          ))}
        </div>
        <span className={styles.srOnly}>Cargando propuestas operativas.</span>
      </section>
    );
  }

  if (loadError && proposals.length === 0) {
    return (
      <section className={styles.loadError} role="alert">
        <div className={styles.errorIcon}><i className="fa-solid fa-link-slash" aria-hidden="true" /></div>
        <p className={styles.eyebrow}>Bandeja temporalmente inaccesible</p>
        <h2>No pudimos consultar las propuestas.</h2>
        <p>{loadError}</p>
        <button type="button" onClick={() => void loadInbox({ initial: true })}>
          <i className="fa-solid fa-arrows-rotate" aria-hidden="true" /> Reintentar
        </button>
      </section>
    );
  }

  return (
    <>
      <section className={styles.metrics} aria-label="Resumen de aprobaciones operativas">
        <article>
          <div className={styles.metricTopline}><span>Pendientes</span><i className="fa-regular fa-hourglass-half" aria-hidden="true" /></div>
          <strong>{counts.pending}</strong>
          <small>esperan una decisión humana</small>
        </article>
        <article className={counts.critical > 0 ? styles.criticalMetric : ''}>
          <div className={styles.metricTopline}><span>Críticas</span><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /></div>
          <strong>{counts.critical}</strong>
          <small>requieren prioridad operativa</small>
        </article>
        <article className={counts.expiring > 0 ? styles.expiringMetric : ''}>
          <div className={styles.metricTopline}><span>Próximas a vencer</span><i className="fa-regular fa-clock" aria-hidden="true" /></div>
          <strong>{counts.expiring}</strong>
          <small>dentro de los próximos 10 min</small>
        </article>
        <article>
          <div className={styles.metricTopline}><span>Resueltas · 24 h</span><i className="fa-solid fa-shield-check" aria-hidden="true" /></div>
          <strong>{counts.resolved}</strong>
          <small>con resultado auditable</small>
        </article>
      </section>

      {notice && (
        <div className={`${styles.globalNotice} ${styles[`notice${notice.type}`]}`} role="status">
          <i
            className={notice.type === 'success'
              ? 'fa-solid fa-circle-check'
              : 'fa-solid fa-triangle-exclamation'}
            aria-hidden="true"
          />
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button>
        </div>
      )}

      {loadError && proposals.length > 0 && (
        <div className={`${styles.globalNotice} ${styles.noticewarning}`} role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>{loadError} Se conserva la última versión cargada.</span>
          <button type="button" onClick={() => void loadInbox()} disabled={refreshing}>Reintentar</button>
        </div>
      )}

      <section className={styles.workspace}>
        <header className={styles.workspaceHeader}>
          <div>
            <p className={styles.eyebrow}>Cola de control</p>
            <h2>{context.projectName || 'Obra activa'}</h2>
            <p>
              {context.organizationName ? `${context.organizationName} · ` : ''}
              La bandeja muestra únicamente propuestas del contexto autorizado.
            </p>
          </div>
          <div className={styles.syncState}>
            <span><i aria-hidden="true" /> Fuente de verdad sincronizada</span>
            <small>
              {lastSync ? `Actualizada ${formatDate(lastSync, timeZone, { year: undefined })}` : 'Sin sincronizar'}
            </small>
            <button type="button" onClick={() => void loadInbox()} disabled={refreshing}>
              <i className="fa-solid fa-arrows-rotate" aria-hidden="true" />
              {refreshing ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.viewTabs} aria-label="Vista de propuestas">
            {FILTERS.map(([value, label]) => {
              const count = value === 'PENDING' ? counts.pending : counts.history;
              return (
                <button
                  type="button"
                  key={value}
                  className={activeFilter === value ? styles.activeTab : ''}
                  onClick={() => setActiveFilter(value)}
                  aria-pressed={activeFilter === value}
                >
                  {label}<span>{count}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.filterControls}>
            <label className={styles.typeSelect}>
              <span className={styles.srOnly}>Filtrar por tipo</span>
              <i className="fa-solid fa-filter" aria-hidden="true" />
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="ALL">Todos los tipos</option>
                <option value="TASK_PROGRESS">Avance de tarea</option>
                <option value="DELAY_REPORT">Reporte de demora</option>
                <option value="CRITICAL_INCIDENT">Incidencia crítica</option>
              </select>
            </label>
            <label className={styles.search}>
              <span className={styles.srOnly}>Buscar propuestas</span>
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar código, tarea o reporte…"
              />
            </label>
          </div>
        </div>

        <div className={styles.resultBar}>
          <span>
            <i aria-hidden="true" />
            {canManage ? 'Decisiones habilitadas para tu rol' : 'Vista de consulta · sin permiso de decisión'}
          </span>
          <strong>{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</strong>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <i
                className={activeFilter === 'PENDING'
                  ? 'fa-solid fa-shield-check'
                  : 'fa-solid fa-box-archive'}
                aria-hidden="true"
              />
            </div>
            <strong>
              {proposals.length === 0
                ? 'La bandeja está lista para la primera propuesta.'
                : activeFilter === 'PENDING' && !query && typeFilter === 'ALL'
                  ? 'No hay decisiones pendientes.'
                  : activeFilter === 'HISTORY' && !query && typeFilter === 'ALL'
                    ? 'Todavía no hay decisiones en el historial.'
                    : 'No encontramos coincidencias.'}
            </strong>
            <p>
              {activeFilter === 'PENDING'
                ? 'Los reportes accionables del campo aparecerán acá antes de modificar tareas, alertas o planificación.'
                : 'Las aprobaciones, rechazos, vencimientos e invalidaciones quedarán disponibles para auditoría.'}
            </p>
            {(query || typeFilter !== 'ALL') && (
              <button type="button" onClick={clearFilters}>Limpiar filtros</button>
            )}
            {activeFilter === 'PENDING'
              && !query
              && typeFilter === 'ALL'
              && canCreateFieldSimulation && (
              <Link
                className={styles.emptyPrimaryAction}
                href={FIRST_VALUE_APPROVAL_SIMULATOR_HREF}
              >
                <i className="fa-brands fa-whatsapp" aria-hidden="true" />
                Generar propuesta de prueba
              </Link>
            )}
          </div>
        ) : (
          <ol className={styles.proposalList}>
            {filtered.map((proposal) => {
              const status = effectiveStatus(proposal, now);
              const pending = status === 'PENDING';
              const effect = proposalEffect(proposal);
              const expiring = pending
                && safeDate(proposal.expiresAt)
                && safeDate(proposal.expiresAt).getTime() - now <= 10 * 60 * 1_000;
              const proposalCanManage = canManage && proposal.canManage !== false;
              return (
                <li key={proposal.id}>
                  <article className={`${styles.proposalCard} ${styles[`type${proposal.type}`] || ''}`}>
                    <div className={styles.proposalRail} aria-hidden="true">
                      <i className={TYPE_ICONS[proposal.type] || 'fa-solid fa-wave-square'} />
                    </div>

                    <div className={styles.proposalBody}>
                      <div className={styles.proposalTopline}>
                        <div className={styles.badges}>
                          <span className={`${styles.typeBadge} ${styles[`badge${proposal.type}`] || ''}`}>
                            {TYPE_LABELS[proposal.type] || 'Propuesta operativa'}
                          </span>
                          <span className={`${styles.statusBadge} ${styles[`status${status}`] || ''}`}>
                            <i aria-hidden="true" />{STATUS_LABELS[status] || status}
                          </span>
                        </div>
                        <code>{proposal.confirmationCode || proposal.id}</code>
                      </div>

                      <h3>{proposal.summary}</h3>

                      <div className={styles.effectCard}>
                        <div>
                          <span>Efecto si se aprueba</span>
                          <strong>{effect.title}</strong>
                          <p>{effect.detail}</p>
                        </div>
                        {proposal.type === 'TASK_PROGRESS' && proposal.percentage != null && (
                          <div className={styles.progressDelta} aria-label={`Avance propuesto ${proposal.percentage}%`}>
                            <span>{proposal.previousProgress == null ? '—' : `${proposal.previousProgress}%`}</span>
                            <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                            <strong>{proposal.percentage}%</strong>
                          </div>
                        )}
                      </div>

                      <div className={styles.proposalMeta}>
                        <span><i className="fa-regular fa-user" aria-hidden="true" /> {proposal.proposerName}</span>
                        <span><i className="fa-regular fa-calendar" aria-hidden="true" /> {formatDate(proposal.createdAt, timeZone)}</span>
                        {pending ? (
                          <span className={expiring ? styles.expiryAlert : ''}>
                            <i className="fa-regular fa-clock" aria-hidden="true" />
                            {relativeExpiry(proposal.expiresAt, now)}
                          </span>
                        ) : (
                          <span><i className="fa-solid fa-circle-check" aria-hidden="true" /> {statusDescription(proposal, timeZone)}</span>
                        )}
                      </div>

                      {pending && proposalCanManage ? (
                        <footer className={styles.cardActions}>
                          <p><i className="fa-solid fa-lock" aria-hidden="true" /> Requiere confirmación explícita.</p>
                          <div>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              onClick={() => openDecision(proposal, 'REJECT')}
                              disabled={decisionBusy}
                            >
                              Rechazar
                            </button>
                            <button
                              type="button"
                              className={styles.approveButton}
                              onClick={() => openDecision(proposal, 'APPROVE')}
                              disabled={decisionBusy}
                            >
                              Revisar y aprobar <span aria-hidden="true">→</span>
                            </button>
                          </div>
                        </footer>
                      ) : pending ? (
                        <div className={styles.readOnlyNote}>
                          <i className="fa-solid fa-eye" aria-hidden="true" />
                          <span>Tu rol puede consultar esta propuesta, pero no resolverla.</span>
                        </div>
                      ) : (
                        <div className={styles.terminalNote}>
                          <i className="fa-solid fa-fingerprint" aria-hidden="true" />
                          <span>{statusDescription(proposal, timeZone)}</span>
                        </div>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <DecisionDialog
        busy={decisionBusy}
        dialog={dialog}
        dialogError={dialogError}
        dialogRef={dialogRef}
        globalTasks={tasks}
        onClose={closeDialog}
        onConfirm={() => void confirmDecision()}
        onSelectTask={selectDecisionTask}
        onToggleAcknowledgement={(acknowledged) => {
          setDialog((current) => current ? { ...current, acknowledged } : current);
        }}
        selectedTaskId={selectedTaskId}
        timeZone={timeZone}
      />
    </>
  );
}
