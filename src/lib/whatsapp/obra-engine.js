import { randomUUID } from "node:crypto";
import { generateWebviewToken } from "@/lib/auth";
import {
  completePendingGeoAttendance,
  ensurePendingGeoAttendance,
} from "@/lib/attendance";
import { appendMessages, getAppState, getProjectSettings, saveAppState } from "@/lib/db";
import {
  FIELD_WORKER_INTENTS,
  canFieldWorkerHandleIntent,
  fieldWorkerWhatsAppRole,
} from "@/lib/field-workers";
import { getDistanceMeters, validateProjectGeofence } from "@/lib/geo";
import { medicalFlowRecord } from "@/lib/medical-upload";
import { getPrisma } from "@/lib/prisma";
import {
  classifyObraIntent,
  countPresentAttendanceEntries,
  prependUniqueEventIncident,
  setWorkerAttendance,
} from "@/lib/whatsapp/obra-policy";
import {
  OPERATIONAL_PROPOSAL_DECISIONS,
  OPERATIONAL_PROPOSAL_STATUSES,
  OPERATIONAL_PROPOSAL_TYPES,
  canResolveOperationalProposal,
  createOperationalProposal,
  finalizeOperationalProposal,
  findOperationalProposal,
  invalidateOperationalProposal,
  markOperationalProposalExpired,
  parseOperationalProposalDecision,
} from "@/lib/whatsapp/operational-proposals";
import {
  REPORT_PROPOSAL_TYPES,
  classifyReportProposal,
} from "@/lib/whatsapp/report-proposal";

export class ObraWorkerAuthorizationError extends Error {
  constructor(message = "A trusted active field worker is required.") {
    super(message);
    this.name = "ObraWorkerAuthorizationError";
    this.code = "FIELD_WORKER_REQUIRED";
  }
}

export class ObraOperationalAtomicityError extends Error {
  constructor() {
    super("Operational proposals require the project-locked atomic message pipeline.");
    this.name = "ObraOperationalAtomicityError";
    this.code = "OPERATIONAL_ATOMIC_CONTEXT_REQUIRED";
  }
}

const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function trustedTimeZone(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function requireOperationalAtomicContext(options) {
  if (
    options.persist === false
    && options.prisma
    && options.state !== undefined
    && options.projectSettings !== undefined
    && options.worker
  ) {
    return;
  }
  throw new ObraOperationalAtomicityError();
}

function trustedWorker(worker, projectId) {
  if (
    !worker
    || worker.active !== true
    || !worker.id
    || !worker.name
    || worker.projectId !== projectId
  ) {
    throw new ObraWorkerAuthorizationError();
  }
  return {
    id: worker.id,
    projectId: worker.projectId,
    phone: worker.phone,
    name: worker.name,
    role: worker.role || "Cuadrilla de obra",
    whatsappRole: fieldWorkerWhatsAppRole(worker),
  };
}

function buildIncident({
  title,
  description,
  type,
  badge,
  reporter,
  icon,
  now,
  evidence,
  timeZone = DEFAULT_TIME_ZONE,
}) {
  return {
    id: `inc-${randomUUID()}`,
    title,
    description,
    type,
    badge,
    timestamp: new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: trustedTimeZone(timeZone),
    }).format(now),
    reporter,
    icon,
    ...(evidence ? { evidence } : {}),
  };
}

function addIncident(state, event, incident) {
  return prependUniqueEventIncident(
    state.incidents,
    event?.externalId,
    buildIncident(incident),
  );
}

function ensureStateCollections(state) {
  state.attendance ||= {};
  state.incidents ||= [];
  state.tasks ||= {};
  state.alertsCount ||= 0;
}

function selectTask(state, text) {
  const normalizedText = normalize(text);
  const explicitId = normalizedText.match(/(?:tarea|task)\s*#?([0-9]+)/)?.[1];
  if (explicitId && state.tasks[explicitId]) return [explicitId, state.tasks[explicitId]];

  const entries = Object.entries(state.tasks);
  const exactNameMatches = entries.filter(([, task]) => {
    const taskName = normalize(task?.name).trim();
    return taskName.length >= 3 && normalizedText.includes(taskName);
  });
  if (exactNameMatches.length === 1) return exactNameMatches[0];
  if (exactNameMatches.length > 1) return [null, null];

  const wordMatches = entries.filter(([, task]) => {
    const significantWords = normalize(task?.name)
      .split(/\s+/)
      .filter((word) => word.length >= 5);
    return significantWords.some((word) => normalizedText.includes(word));
  });
  return wordMatches.length === 1 ? wordMatches[0] : [null, null];
}

function secureLinks(workerId, projectId) {
  const deploymentUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || deploymentUrl || "http://localhost:3000").replace(/\/$/, "");
  const attendanceQuery = new URLSearchParams({
    worker: workerId,
    token: generateWebviewToken(workerId, { purpose: "attendance", scope: projectId }),
  }).toString();
  const medicalQuery = new URLSearchParams({
    worker: workerId,
    token: generateWebviewToken(workerId, { purpose: "medical", scope: projectId }),
  }).toString();
  return {
    attendance: `${appUrl}/webview/attendance?${attendanceQuery}`,
    medical: `${appUrl}/webview/medical?${medicalQuery}`,
  };
}

function updatePresentCount(state) {
  state.operariosCount = countPresentAttendanceEntries(state.attendance);
}

function updateOverallProgress(state) {
  const tasks = Object.values(state.tasks || {});
  const nextProgress = tasks.length === 0
    ? 0
    : Math.round(tasks.reduce((total, task) => (
        total + Math.max(0, Math.min(100, Number(task?.progress) || 0))
      ), 0) / tasks.length);
  const changed = Number(state.avancePercentage) !== nextProgress;
  state.avancePercentage = nextProgress;
  return changed;
}

function publicOperationalProposal(record) {
  if (!record) return null;
  return {
    id: record.id,
    confirmationCode: record.confirmationCode,
    type: record.type,
    status: record.status,
    expiresAt: new Date(record.expiresAt).toISOString(),
  };
}

function reportProposalOperation(state, proposal) {
  if (proposal.type === REPORT_PROPOSAL_TYPES.TASK_PROGRESS) {
    const [taskKey, task] = selectTask(
      state,
      `${proposal.taskReference || ""} ${proposal.summary || ""}`,
    );
    return {
      type: OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS,
      action: {
        percentage: proposal.percentage,
        taskKey,
        taskName: task?.name || null,
        taskReference: proposal.taskReference,
      },
      precondition: taskKey && task
        ? {
            taskKey,
            taskName: task.name || null,
            taskProgress: Number(task.progress) || 0,
          }
        : null,
    };
  }
  if (proposal.type === REPORT_PROPOSAL_TYPES.DELAY_REPORT) {
    return {
      type: OPERATIONAL_PROPOSAL_TYPES.DELAY_REPORT,
      action: {
        delaySignals: proposal.signals?.delay,
        riskSignals: proposal.signals?.risk,
      },
      precondition: null,
    };
  }
  if (proposal.type === REPORT_PROPOSAL_TYPES.CRITICAL_INCIDENT) {
    return {
      type: OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT,
      action: {
        riskSignals: proposal.signals?.risk,
        delaySignals: proposal.signals?.delay,
      },
      precondition: null,
    };
  }
  return null;
}

function proposalExpiryLabel(value, timeZone) {
  const expiresAt = value ? new Date(value) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: trustedTimeZone(timeZone),
  }).format(expiresAt);
}

function audioProposalReply(proposal, {
  transcriptionStatus = null,
  operationalProposal = null,
  worker = null,
  timeZone = DEFAULT_TIME_ZONE,
} = {}) {
  if (transcriptionStatus === "disabled_by_tenant") {
    return "Recibí el audio y lo guardé como evidencia. La transcripción con IA está desactivada por la organización y no se envió el contenido a un proveedor de IA.";
  }
  if (!proposal) {
    return "Recibí el audio y lo guardé como evidencia. La transcripción quedó pendiente para procesamiento automático.";
  }
  const code = operationalProposal?.confirmationCode;
  const proposalTimeZone = trustedTimeZone(timeZone);
  const expiryLabel = proposalExpiryLabel(operationalProposal?.expiresAt, proposalTimeZone);
  const requiresSupervisor = [
    REPORT_PROPOSAL_TYPES.TASK_PROGRESS,
    REPORT_PROPOSAL_TYPES.DELAY_REPORT,
  ].includes(proposal.type)
    && !["FOREMAN", "SITE_MANAGER"].includes(worker?.whatsappRole);
  const approvalInstructions = code
    ? requiresSupervisor
      ? ` La aprobación debe hacerla un capataz o jefe de obra autorizado con “CONFIRMAR ${code}”; compartile este código. Vos podés descartarla con “RECHAZAR ${code}”. Es válida hasta ${expiryLabel || "el vencimiento indicado"} (zona ${proposalTimeZone}).`
      : ` Escribí “CONFIRMAR ${code}” para aplicarla o “RECHAZAR ${code}” para descartarla. Es válida hasta ${expiryLabel || "el vencimiento indicado"} (zona ${proposalTimeZone}); si recibís este mensaje después, enviá un nuevo audio.`
    : "";
  if (proposal.type === REPORT_PROPOSAL_TYPES.CRITICAL_INCIDENT) {
    return `Guardé y transcribí el audio como evidencia. Detecté una posible incidencia crítica, pero no ejecuté cambios ni envié notificaciones desde la voz.${approvalInstructions || " Confirmala con un reporte explícito por texto."}`;
  }
  if (proposal.type === REPORT_PROPOSAL_TYPES.DELAY_REPORT) {
    return `Guardé y transcribí el audio como evidencia. Detecté una posible demora, todavía sin impacto aplicado al cronograma.${approvalInstructions || " Confirmala con un reporte explícito por texto."}`;
  }
  if (proposal.type === REPORT_PROPOSAL_TYPES.TASK_PROGRESS) {
    const progress = proposal.percentage === null ? "" : `${proposal.percentage}%`;
    const reference = proposal.taskReference ? ` en ${proposal.taskReference}` : "";
    const taskInstruction = operationalProposal?.action?.taskKey
      ? ""
      : ` Si todavía no quedó asociada, usá “CONFIRMAR ${code} TAREA <número o nombre>”.`;
    return `Guardé y transcribí el audio como evidencia. Detecté una propuesta de avance ${progress}${reference}, pero no modifiqué el Gantt.${approvalInstructions || ` Confirmala por texto indicando “avance ${progress || "porcentaje"} tarea <número o nombre>”.`}${code ? taskInstruction : ""}`;
  }
  if (proposal.type === REPORT_PROPOSAL_TYPES.ATTENDANCE_REQUEST) {
    return "Guardé y transcribí el audio como evidencia. Detecté una intención de fichaje, pero la voz no registra asistencia. Escribí “fichar” para iniciar el control y luego informá tu ubicación.";
  }
  return "Guardé y transcribí el audio como evidencia. No detecté una acción inequívoca y no modifiqué la obra. Si querés aplicar un cambio, confirmalo con un comando por texto.";
}

function terminalProposalReply(proposal) {
  if (proposal.status === OPERATIONAL_PROPOSAL_STATUSES.APPLIED) {
    return `La propuesta ${proposal.confirmationCode} ya fue aplicada. No repetí ningún cambio.`;
  }
  if (proposal.status === OPERATIONAL_PROPOSAL_STATUSES.REJECTED) {
    return `La propuesta ${proposal.confirmationCode} ya fue rechazada. No modifiqué la obra.`;
  }
  if (proposal.status === OPERATIONAL_PROPOSAL_STATUSES.EXPIRED) {
    return `La propuesta ${proposal.confirmationCode} venció. Enviá un nuevo audio o comando para generar una decisión actualizada.`;
  }
  if (proposal.status === OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED) {
    return `La propuesta ${proposal.confirmationCode} quedó invalidada porque el contexto de la obra cambió. Generá una nueva propuesta.`;
  }
  return `La propuesta ${proposal.confirmationCode} ya no está pendiente. No repetí ningún cambio.`;
}

async function processOperationalProposalDecision({
  state,
  worker,
  event,
  now,
  projectSettings,
  prisma,
  decision,
  auditActorId = null,
  auditSource = null,
}) {
  const proposal = await findOperationalProposal(prisma, {
    projectId: projectSettings.id,
    confirmationCode: decision.confirmationCode,
  });
  if (!proposal) {
    return {
      reply: `No encontré una propuesta pendiente con el código ${decision.confirmationCode} en esta obra.`,
      stateChanged: false,
      authorized: false,
      proposal: null,
    };
  }
  if (proposal.status !== OPERATIONAL_PROPOSAL_STATUSES.PENDING) {
    return {
      reply: terminalProposalReply(proposal),
      stateChanged: false,
      authorized: true,
      proposal,
    };
  }

  const organizationId = projectSettings.organizationId;
  const resolverProvider = String(event.provider || decision.channel || "whatsapp")
    .trim()
    .toLowerCase()
    .slice(0, 32);
  const resolverExternalId = String(event.externalId || "").trim().slice(0, 512);
  if (!organizationId || !resolverProvider || !resolverExternalId) {
    return {
      reply: "No pude vincular esta confirmación a un evento confiable. No modifiqué la obra.",
      stateChanged: false,
      authorized: false,
      proposal,
    };
  }

  const transitionContext = {
    proposal,
    projectId: projectSettings.id,
    organizationId,
    resolverWorkerId: worker.id,
    resolverProvider,
    resolverExternalId,
    auditActorId,
    auditSource,
    now,
  };
  if (new Date(proposal.expiresAt).getTime() <= now.getTime()) {
    await markOperationalProposalExpired(prisma, {
      ...transitionContext,
      result: { reason: "confirmation_after_expiry" },
    });
    return {
      reply: `La propuesta ${proposal.confirmationCode} venció. Enviá un nuevo audio para trabajar con información actualizada.`,
      stateChanged: false,
      authorized: true,
      proposal: { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.EXPIRED },
    };
  }

  if (!canResolveOperationalProposal(worker, proposal, decision.decision)) {
    return {
      reply: proposal.type === OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT
        ? "Tu identidad no puede resolver esta propuesta crítica. Debe hacerlo quien la reportó, Seguridad, el capataz o el jefe de obra."
        : "Tu identidad puede reportar, pero sólo un capataz o jefe de obra puede aprobar o rechazar este cambio operativo.",
      stateChanged: false,
      authorized: false,
      proposal,
    };
  }

  if (decision.decision === OPERATIONAL_PROPOSAL_DECISIONS.REJECT) {
    const rejected = await finalizeOperationalProposal(prisma, {
      ...transitionContext,
      decision: decision.decision,
      result: { reason: "rejected_by_authorized_worker" },
    });
    return {
      reply: rejected
        ? `Rechacé la propuesta ${proposal.confirmationCode}. La evidencia permanece en la bitácora y no modifiqué la obra.`
        : `La propuesta ${proposal.confirmationCode} cambió de estado antes de poder rechazarla. No repetí ninguna acción.`,
      stateChanged: false,
      authorized: true,
      proposal: rejected
        ? { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.REJECTED }
        : proposal,
    };
  }

  if (proposal.type === OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS) {
    const action = proposal.action && typeof proposal.action === "object"
      ? proposal.action
      : {};
    const precondition = proposal.precondition && typeof proposal.precondition === "object"
      ? proposal.precondition
      : null;
    const percentage = Number(action.percentage);
    let taskKey = action.taskKey ? String(action.taskKey) : null;
    let task = taskKey ? state.tasks[taskKey] : null;

    if (taskKey) {
      const stale = !task
        || (
          precondition
          && (
            Number(task.progress) !== Number(precondition.taskProgress)
            || (
              precondition.taskName
              && String(task.name || "") !== String(precondition.taskName)
            )
          )
        );
      if (stale) {
        const invalidated = await invalidateOperationalProposal(prisma, {
          ...transitionContext,
          result: {
            reason: task ? "task_changed_after_proposal" : "task_missing_after_proposal",
            taskKey,
          },
        });
        return {
          reply: invalidated
            ? `La tarea vinculada a ${proposal.confirmationCode} cambió después del audio. Invalidé la propuesta para no pisar un avance más nuevo.`
            : `La propuesta ${proposal.confirmationCode} cambió de estado. No modifiqué el Gantt.`,
          stateChanged: false,
          authorized: true,
          proposal: invalidated
            ? { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED }
            : proposal,
        };
      }
    } else {
      [taskKey, task] = selectTask(
        state,
        `${decision.taskReference || ""} ${action.taskReference || ""}`,
      );
    }

    if (!taskKey || !task) {
      return {
        reply: `La propuesta ${proposal.confirmationCode} sigue pendiente: indicá la tarea exacta con “CONFIRMAR ${proposal.confirmationCode} TAREA <número o nombre>”.`,
        stateChanged: false,
        authorized: true,
        proposal,
      };
    }
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      const invalidated = await invalidateOperationalProposal(prisma, {
        ...transitionContext,
        result: { reason: "invalid_stored_percentage", taskKey },
      });
      return {
        reply: invalidated
          ? `La propuesta ${proposal.confirmationCode} contenía un porcentaje inválido y fue anulada sin modificar la obra.`
          : `La propuesta ${proposal.confirmationCode} cambió de estado. No modifiqué el Gantt.`,
        stateChanged: false,
        authorized: true,
        proposal,
      };
    }

    const previousProgress = Number(task.progress) || 0;
    const result = {
      taskKey,
      taskName: String(task.name || ""),
      previousProgress,
      nextProgress: percentage,
    };
    const applied = await finalizeOperationalProposal(prisma, {
      ...transitionContext,
      decision: decision.decision,
      result,
    });
    if (!applied) {
      return {
        reply: `La propuesta ${proposal.confirmationCode} cambió de estado antes de aplicarse. No repetí ningún cambio.`,
        stateChanged: false,
        authorized: true,
        proposal,
      };
    }
    task.progress = percentage;
    const aggregateChanged = updateOverallProgress(state);
    return {
      reply: `Apliqué la propuesta ${proposal.confirmationCode}: “${task.name}” pasó de ${previousProgress}% a ${percentage}%.`,
      stateChanged: previousProgress !== percentage || aggregateChanged,
      authorized: true,
      proposal: { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.APPLIED, result },
    };
  }

  if (
    proposal.type === OPERATIONAL_PROPOSAL_TYPES.DELAY_REPORT
    || proposal.type === OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT
  ) {
    const critical = proposal.type === OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT;
    const result = {
      effect: "incident_created",
      severity: critical ? "critical" : "warning",
    };
    const applied = await finalizeOperationalProposal(prisma, {
      ...transitionContext,
      decision: decision.decision,
      result,
    });
    if (!applied) {
      return {
        reply: `La propuesta ${proposal.confirmationCode} cambió de estado antes de aplicarse. No repetí ningún cambio.`,
        stateChanged: false,
        authorized: true,
        proposal,
      };
    }
    const incidentAdded = addIncident(
      state,
      { externalId: `operational-proposal:${proposal.id}` },
      {
        title: critical ? "Incidencia crítica confirmada" : "Demora confirmada",
        description: proposal.summary,
        type: critical ? "critical" : "warning",
        badge: critical ? "Urgente" : "Planificación",
        reporter: proposal.proposedByWorker?.name || worker.name,
        icon: critical ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-clock",
        now,
        timeZone: projectSettings.timezone,
      },
    );
    if (incidentAdded) state.alertsCount += 1;
    return {
      reply: critical
        ? `Apliqué la propuesta ${proposal.confirmationCode}: la incidencia crítica quedó visible en alertas. Si hay riesgo para personas, detené la tarea y seguí el protocolo de seguridad.`
        : `Apliqué la propuesta ${proposal.confirmationCode}: la demora quedó registrada para revisión de planificación, sin reprogramar automáticamente el cronograma.`,
      stateChanged: incidentAdded,
      authorized: true,
      proposal: { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.APPLIED, result },
    };
  }

  const invalidated = await invalidateOperationalProposal(prisma, {
    ...transitionContext,
    result: { reason: "unsupported_proposal_type" },
  });
  return {
    reply: invalidated
      ? `La propuesta ${proposal.confirmationCode} no tiene una acción compatible y fue anulada sin modificar la obra.`
      : `La propuesta ${proposal.confirmationCode} cambió de estado. No modifiqué la obra.`,
    stateChanged: false,
    authorized: true,
    proposal,
  };
}

async function processFlowReply({
  state,
  worker,
  event,
  now,
  projectId,
  links,
  prisma,
  evidence,
  timeZone,
}) {
  const response = event.interactive?.response || {};
  const flowName = normalize(response.flow_type || response.flow_name || event.interactive?.name || "");
  const summary = Object.entries(response)
    .filter(([key]) => !["flow_token", "screen", "flow_type", "flow_name"].includes(key))
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");

  const isMedical = flowName.includes("medical") || flowName.includes("licencia");
  const isIncident = flowName.includes("incident");
  const isAttendance = flowName.includes("attendance") || flowName.includes("fichaje");
  const medicalRecord = isMedical
    ? medicalFlowRecord({
        days: response.days,
        workerName: worker.name,
        media: event.media,
        uploadLink: links.medical,
      })
    : null;
  if (isMedical) {
    setWorkerAttendance(state.attendance, worker, {
      checkin: "--:--",
      status: medicalRecord.attendanceStatus,
    });
  }
  if (isAttendance) {
    const ppeComplete = response.ppe_status === "complete";
    await ensurePendingGeoAttendance(prisma, {
      projectId,
      workerId: worker.id,
      now,
      metadata: { ppeStatus: ppeComplete ? "complete" : "incomplete", source: "whatsapp-flow" },
    });
    setWorkerAttendance(state.attendance, worker, {
      checkin: new Intl.DateTimeFormat("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: trustedTimeZone(timeZone),
      }).format(now),
      status: ppeComplete ? "GPS pendiente · EPP verificado" : "GPS pendiente · EPP incompleto",
    });
    updatePresentCount(state);
  }

  const incidentAdded = addIncident(
    state,
    event,
    {
      title: isMedical
        ? medicalRecord.title
        : isIncident
          ? "Incidencia recibida por WhatsApp Flow"
          : isAttendance
            ? "Ingreso pendiente de geocerca"
          : "Formulario de obra completado",
      description: isMedical
        ? medicalRecord.description
        : summary || "El formulario fue recibido y quedó registrado en la bitácora.",
      type: isIncident
        ? ["high", "critical"].includes(response.severity) ? "critical" : "warning"
        : isAttendance && response.ppe_status !== "complete" ? "warning" : "info",
      badge: isMedical ? medicalRecord.badge : "WhatsApp Flow",
      reporter: worker.name,
      icon: "fa-brands fa-whatsapp",
      now,
      evidence: isMedical && medicalRecord.hasEvidence ? evidence : null,
      timeZone,
    },
  );
  if (
    incidentAdded
    && (
      (isAttendance && response.ppe_status !== "complete")
      || (isIncident && ["high", "critical"].includes(response.severity))
    )
  ) {
    state.alertsCount += 1;
  }

  return isMedical
    ? medicalRecord.reply
    : isAttendance
      ? response.ppe_status === "complete"
        ? `EPP confirmado. Para completar el ingreso todavía falta informar y contrastar tu ubicación:\n${links.attendance}`
        : `EPP incompleto: no inicies la tarea hasta regularizarlo. El ingreso sigue pendiente de ubicación:\n${links.attendance}`
    : "Formulario recibido. Lo registré en la bitácora de la obra y ya está visible para el equipo de gestión.";
}

export async function processIncomingObraMessage(event, scope, options = {}) {
  const [state, projectSettings] = await Promise.all([
    options.state === undefined ? getAppState(scope) : options.state,
    options.projectSettings === undefined ? getProjectSettings(scope) : options.projectSettings,
  ]);
  ensureStateCollections(state);

  const now = event.timestamp instanceof Date ? event.timestamp : new Date();
  const processingNow = options.processingTime instanceof Date
    ? options.processingTime
    : new Date();
  const timeZone = trustedTimeZone(projectSettings.timezone);
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(now);
  const worker = trustedWorker(options.worker, projectSettings.id);
  const organizationId = projectSettings.organizationId
    || scope?.organization?.id
    || scope?.organizationId
    || null;
  const links = secureLinks(worker.id, projectSettings.id);
  const body = String(event.text || event.transcription?.text || "").trim();
  const lowerBody = normalize(body);
  const evidence = event.media
    ? {
        kind: event.media.kind || event.kind,
        url: event.media.url || null,
        filename: event.media.filename || null,
        mimeType: event.media.mimeType || null,
        size: event.media.size || null,
        sha256: event.media.sha256 || null,
        provider: event.media.storage?.provider || null,
        storageStatus: event.media.storage?.status || null,
        assetId: event.media.storage?.assetId || null,
        publicId: event.media.storage?.publicId || null,
        pathname: event.media.storage?.pathname || null,
      }
    : null;
  let reply;
  let flowPrompt = null;
  let stateChanged = false;
  let audioProposal = null;
  let operationalProposal = null;
  let authorized = true;
  const intent = classifyObraIntent(event);
  const operationalDecision = intent === FIELD_WORKER_INTENTS.COMMAND_CONFIRMATION
    ? parseOperationalProposalDecision(event)
    : null;
  const auditSource = String(
    options.auditSource
      || (event.provider === "internal" ? "dashboard-simulator" : event.provider || "whatsapp"),
  ).slice(0, 64);

  if (!canFieldWorkerHandleIntent(worker.whatsappRole, intent)) {
    authorized = false;
    reply = intent === FIELD_WORKER_INTENTS.TASK_PROGRESS
      ? "Tu número está autorizado para reportar, pero no para cambiar avances. Pedile al capataz o jefe de obra que confirme la actualización."
      : "Tu rol no permite ejecutar esa acción desde WhatsApp. El mensaje quedó registrado sin modificar la obra.";
  } else if (operationalDecision) {
    requireOperationalAtomicContext(options);
    const outcome = await processOperationalProposalDecision({
      state,
      worker,
      event,
      now: processingNow,
      projectSettings: { ...projectSettings, organizationId },
      prisma: options.prisma || getPrisma(),
      decision: operationalDecision,
      auditActorId: options.auditActorId || null,
      auditSource,
    });
    reply = outcome.reply;
    stateChanged = outcome.stateChanged;
    authorized = outcome.authorized;
    operationalProposal = outcome.proposal;
  } else if (event.interactive?.type === "flow") {
    reply = await processFlowReply({
      state,
      worker,
      event,
      now,
      projectId: projectSettings.id,
      links,
      prisma: options.prisma || getPrisma(),
      evidence,
      timeZone,
    });
    stateChanged = true;
  } else if (event.location) {
    const geofence = validateProjectGeofence(projectSettings);
    if (!geofence.valid) {
      reply = "La obra todavía no tiene una geocerca configurada. Un administrador debe registrar sus coordenadas antes de validar ingresos por ubicación.";
    } else {
      const distance = Math.round(
        getDistanceMeters(
          event.location.latitude,
          event.location.longitude,
          geofence.latitude,
          geofence.longitude,
        ),
      );
      const inside = distance <= geofence.geofenceMeters;

      const completedAttendance = await completePendingGeoAttendance(options.prisma || getPrisma(), {
        projectId: projectSettings.id,
        workerId: worker.id,
        now,
        latitude: event.location.latitude,
        longitude: event.location.longitude,
        distanceMeters: distance,
        inside,
        accuracy: event.location.accuracy,
      });
      if (!completedAttendance) {
        reply = "No encontré un ingreso pendiente vigente. Escribí “fichar” para iniciar el control y después informá la ubicación desde el enlace seguro.";
      } else {
        setWorkerAttendance(state.attendance, worker, {
          checkin: time,
          status: inside ? "Presente (ubicación informada)" : "Desvío (ubicación informada)",
        });
        updatePresentCount(state);
        const incidentAdded = addIncident(
          state,
          event,
          {
            title: inside ? "Ubicación informada dentro de geocerca" : "Ubicación informada fuera de geocerca",
            description: `${worker.name} informó una ubicación a ${distance} m del punto de obra (radio configurado: ${geofence.geofenceMeters} m).`,
            type: inside ? "success" : "critical",
            badge: inside ? "Presente" : "Revisar GPS",
            reporter: worker.name,
            icon: "fa-solid fa-location-dot",
            now,
            timeZone,
          },
        );
        if (incidentAdded && !inside) state.alertsCount += 1;
        reply = inside
          ? `Ubicación informada y contrastada con la geocerca. Registré tu ingreso a las ${time} dentro del radio configurado (${distance} m).`
          : `La ubicación informada está a ${distance} m de la obra, fuera del radio configurado de ${geofence.geofenceMeters} m. El ingreso quedó marcado para revisión.`;
        stateChanged = true;
      }
    }
  } else if (["image", "video", "document", "sticker"].includes(event.kind)) {
    stateChanged = addIncident(
      state,
      event,
      {
        title: "Evidencia de obra recibida",
        description: body || `Archivo ${event.kind} recibido desde WhatsApp y asociado a la bitácora.`,
        type: "info",
        badge: "Evidencia",
        reporter: worker.name,
        icon: "fa-solid fa-camera",
        now,
        evidence,
        timeZone,
      },
    );
    reply = "Evidencia recibida y registrada. Para vincularla a una tarea, respondé con el nombre de la tarea o su número.";
  } else if (event.kind === "audio") {
    const transcriptionCompleted = event.transcription?.status === "completed" && body;
    const transcriptionDisabled = event.transcription?.status === "disabled_by_tenant";
    audioProposal = transcriptionCompleted ? classifyReportProposal(body) : null;
    const operation = audioProposal ? reportProposalOperation(state, audioProposal) : null;
    if (operation && event.externalId && organizationId) {
      requireOperationalAtomicContext(options);
      const created = await createOperationalProposal(options.prisma || getPrisma(), {
        projectId: projectSettings.id,
        organizationId,
        proposedByWorkerId: worker.id,
        sourceProvider: event.provider || "whatsapp",
        sourceExternalId: event.externalId,
        type: operation.type,
        summary: audioProposal.summary,
        transcript: body,
        action: operation.action,
        precondition: operation.precondition,
        now: processingNow,
        auditActorId: options.auditActorId || null,
        auditSource,
      });
      operationalProposal = created.record;
    }
    const evidenceProposal = audioProposal
      ? {
          ...audioProposal,
          operationalProposal: publicOperationalProposal(operationalProposal),
        }
      : null;
    stateChanged = addIncident(
      state,
      event,
      {
        title: transcriptionCompleted ? "Reporte de voz transcripto" : "Audio de obra recibido",
        description: transcriptionCompleted
          ? body
          : transcriptionDisabled
            ? "El audio quedó almacenado como evidencia. La transcripción con IA está desactivada por la organización."
            : "El audio quedó almacenado como evidencia y su transcripción está pendiente.",
        type: "info",
        badge: transcriptionCompleted ? "Voz + propuesta" : "Evidencia de voz",
        reporter: worker.name,
        icon: "fa-solid fa-microphone-lines",
        now,
        timeZone,
        evidence: evidenceProposal
          ? { ...(evidence || {}), proposal: evidenceProposal }
          : evidence,
      },
    );
    reply = audioProposalReply(audioProposal, {
      transcriptionStatus: event.transcription?.status || null,
      operationalProposal,
      worker,
      timeZone,
    });
  } else if (lowerBody.includes("licencia") || lowerBody.includes("certificado")) {
    reply = `Cargá el certificado desde este enlace seguro, válido por dos horas:\n${links.medical}`;
  } else if (["fichar", "ingreso", "ingresar", "entrada", "arranco"].some((term) => lowerBody.includes(term))) {
    flowPrompt = "shift-check-in";
    await ensurePendingGeoAttendance(options.prisma || getPrisma(), {
      projectId: projectSettings.id,
      workerId: worker.id,
      now,
      metadata: { source: event.provider || "whatsapp", externalId: event.externalId || null },
    });
    setWorkerAttendance(state.attendance, worker, { checkin: time, status: "GPS pendiente" });
    updatePresentCount(state);
    addIncident(
      state,
      event,
      {
        title: "Ingreso pendiente de ubicación",
        description: `${worker.name} inició el control de ingreso. Todavía no cuenta como presente hasta informar una ubicación y contrastarla con la geocerca.`,
        type: "info",
        badge: "GPS pendiente",
        reporter: worker.name,
        icon: "fa-solid fa-user-check",
        now,
        timeZone,
      },
    );
    reply = `Inicié el control a las ${time}, pero todavía no figurás presente. Informá tu ubicación para contrastarla con la geocerca desde este enlace seguro:\n${links.attendance}`;
    stateChanged = true;
  } else if (["incidencia", "reportar incidencia", "nueva incidencia"].includes(lowerBody)) {
    flowPrompt = "incident-report";
    reply = "Contame qué ocurrió, en qué sector y qué nivel de riesgo observás. Lo voy a registrar en la bitácora de la obra.";
  } else if (/\b([0-9]{1,3})\s*%/.test(lowerBody)) {
    const progress = Math.min(100, Number(lowerBody.match(/\b([0-9]{1,3})\s*%/)?.[1] || 0));
    const [, task] = selectTask(state, lowerBody);
    if (task) {
      const previousProgress = Number(task.progress) || 0;
      task.progress = progress;
      reply = `Actualicé “${task.name}” al ${progress}% y registré el cambio en la bitácora.`;
      const aggregateChanged = updateOverallProgress(state);
      stateChanged = previousProgress !== progress || aggregateChanged;
    } else {
      reply = `Detecté un avance del ${progress}%, pero necesito el nombre o número de la tarea para aplicarlo sin ambigüedad.`;
    }
  } else if (["fuga", "roto", "accidente", "riesgo", "urgente", "peligro"].some((term) => lowerBody.includes(term))) {
    flowPrompt = "incident-report";
    stateChanged = addIncident(
      state,
      event,
      {
        title: "Incidencia crítica reportada",
        description: body || "Reporte urgente recibido desde WhatsApp.",
        type: "critical",
        badge: "Urgente",
        reporter: worker.name,
        icon: "fa-solid fa-triangle-exclamation",
        now,
        timeZone,
      },
    );
    if (stateChanged) state.alertsCount += 1;
    reply = "Registré la incidencia como crítica y quedó visible en el centro de alertas. Si hay riesgo para personas, detené la tarea y seguí el protocolo de seguridad de la obra.";
  } else if (["demora", "retraso", "no llego", "suministro"].some((term) => lowerBody.includes(term))) {
    stateChanged = addIncident(
      state,
      event,
      {
        title: "Demora reportada",
        description: body,
        type: "warning",
        badge: "Planificación",
        reporter: worker.name,
        icon: "fa-solid fa-clock",
        now,
        timeZone,
      },
    );
    if (stateChanged) state.alertsCount += 1;
    reply = "Demora registrada. Quedó pendiente de impacto y reprogramación por el responsable de planificación.";
  } else if (lowerBody.includes("ayuda") || lowerBody.includes("menu") || lowerBody.includes("menú")) {
    reply = "Puedo ayudarte a: registrar ingreso y ubicación, informar avance con porcentaje y tarea, reportar una incidencia, adjuntar evidencia o cargar un certificado médico.";
  } else {
    reply = "Guardé el reporte en la bitácora. Para convertirlo en una acción, indicá “avance 60% tarea 3”, “incidencia urgente”, “fichar” o “licencia”.";
  }

  const newMessages = [{
    externalId: event.externalId || null,
    sender: "user",
    kind: event.kind || "text",
    text: intent === FIELD_WORKER_INTENTS.MEDICAL
      ? "Solicitud médica recibida. Los detalles clínicos no se incorporan a la bitácora operativa."
      : body || `[${event.kind || "evento"}]`,
    time,
    sentAt: now.toISOString(),
    mediaUrl: event.media?.url || null,
    media: event.media || null,
    transcription: event.transcription || null,
    metadata: {
      provider: event.provider || null,
      from: event.from || null,
      displayName: event.displayName || null,
      phoneNumberId: event.phoneNumberId || null,
      workerId: worker.id,
      workerRole: worker.whatsappRole,
      intent,
      authorized,
      ...(intent === FIELD_WORKER_INTENTS.MEDICAL ? { sensitivity: "medical" } : {}),
      ...(audioProposal
        ? {
            audioProposal: {
              ...audioProposal,
              operationalProposal: publicOperationalProposal(operationalProposal),
            },
          }
        : {}),
      ...(operationalDecision
        ? {
            operationalDecision: {
              ...operationalDecision,
              proposal: publicOperationalProposal(operationalProposal),
            },
          }
        : {}),
    },
  }, {
    externalId: event.externalId ? `obrasaas-reply:${event.externalId}` : null,
    sender: "bot",
    kind: "text",
    text: reply,
    time,
    sentAt: new Date().toISOString(),
  }];
  if (options.persist !== false) {
    if (stateChanged) await saveAppState(state, scope);
    await appendMessages(newMessages, scope);
  }

  return {
    reply,
    state,
    worker,
    flowPrompt,
    intent,
    stateChanged,
    newMessages,
    operationalProposal: publicOperationalProposal(operationalProposal),
  };
}
