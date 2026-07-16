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
import {
  isSensitiveMedicalText,
  medicalOperationalDescription,
  restrictedOperationalDescription,
  sensitiveMedicalOperationalDescription,
} from "@/lib/medical-privacy";
import {
  DEFAULT_OPERATIONAL_TIME_ZONE,
  appendOperationalIncident,
  ensureOperationalStateCollections,
  recalculateOverallProgress,
  selectOperationalTask,
  trustedOperationalTimeZone,
} from "@/lib/operational-state-effects";
import { resolveOperationalProposalDecision } from "@/lib/operational-proposal-resolution";
import { getPrisma } from "@/lib/prisma";
import {
  classifyObraIntent,
  countPresentAttendanceEntries,
  setWorkerAttendance,
} from "@/lib/whatsapp/obra-policy";
import {
  OPERATIONAL_PROPOSAL_TYPES,
  createOperationalProposal,
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

const DEFAULT_TIME_ZONE = DEFAULT_OPERATIONAL_TIME_ZONE;

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const trustedTimeZone = trustedOperationalTimeZone;

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

const addIncident = appendOperationalIncident;
const ensureStateCollections = ensureOperationalStateCollections;
const selectTask = selectOperationalTask;

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

const updateOverallProgress = recalculateOverallProgress;

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
        ? medicalOperationalDescription()
        : isAttendance
          ? "El formulario de ingreso fue recibido y quedó pendiente de ubicación."
          : restrictedOperationalDescription(),
      type: isIncident
        ? ["high", "critical"].includes(response.severity) ? "critical" : "warning"
        : isAttendance && response.ppe_status !== "complete" ? "warning" : "info",
      badge: isMedical ? medicalRecord.badge : "WhatsApp Flow",
      reporter: worker.name,
      icon: "fa-brands fa-whatsapp",
      now,
      evidence: isMedical && medicalRecord.hasEvidence ? evidence : null,
      sensitivity: isMedical
        ? "medical"
        : isAttendance
          ? null
          : "restricted",
      metadata: isAttendance
        ? null
        : {
            kind: isIncident ? "whatsapp-flow-incident" : "whatsapp-flow-report",
            sourceContentRestricted: true,
            detailRestricted: true,
          },
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
  const eventText = String(event.text || "").trim();
  const transcriptionText = String(event.transcription?.text || "").trim();
  const body = String(
    event.kind === "audio" && transcriptionText
      ? transcriptionText
      : eventText || transcriptionText,
  ).trim();
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
  const sensitiveMedicalContent = (
    intent === FIELD_WORKER_INTENTS.MEDICAL
    || isSensitiveMedicalText(`${eventText}\n${transcriptionText}`)
  );
  const sourceContentRestricted = Boolean(
    body
    || event.media
    || event.transcription
    || event.interactive,
  );
  const restrictedSourceIncident = {
    sensitivity: sensitiveMedicalContent ? "medical" : "restricted",
    metadata: {
      kind: sensitiveMedicalContent
        ? "sensitive-medical-report"
        : "source-content-restricted",
      sourceContentRestricted: true,
      detailRestricted: true,
    },
  };
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
    const outcome = await resolveOperationalProposalDecision({
      state,
      resolver: worker,
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
        description: sensitiveMedicalContent
          ? sensitiveMedicalOperationalDescription()
          : restrictedOperationalDescription(),
        type: "info",
        badge: "Evidencia",
        reporter: worker.name,
        icon: "fa-solid fa-camera",
        now,
        evidence: null,
        ...restrictedSourceIncident,
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
    stateChanged = addIncident(
      state,
      event,
      {
        title: transcriptionCompleted ? "Reporte de voz transcripto" : "Audio de obra recibido",
        description: transcriptionCompleted
          ? sensitiveMedicalContent
            ? sensitiveMedicalOperationalDescription()
            : restrictedOperationalDescription()
          : transcriptionDisabled
            ? "El audio quedó almacenado como evidencia. La transcripción con IA está desactivada por la organización."
            : "El audio quedó almacenado como evidencia y su transcripción está pendiente.",
        type: "info",
        badge: transcriptionCompleted ? "Voz + propuesta" : "Evidencia de voz",
        reporter: worker.name,
        icon: "fa-solid fa-microphone-lines",
        now,
        timeZone,
        evidence: null,
        ...restrictedSourceIncident,
      },
    );
    reply = audioProposalReply(
      sensitiveMedicalContent && audioProposal
        ? { ...audioProposal, taskReference: null }
        : audioProposal,
      {
        transcriptionStatus: event.transcription?.status || null,
        operationalProposal,
        worker,
        timeZone,
      },
    );
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
        description: sensitiveMedicalContent
          ? sensitiveMedicalOperationalDescription()
          : restrictedOperationalDescription(),
        type: "critical",
        badge: "Urgente",
        reporter: worker.name,
        icon: "fa-solid fa-triangle-exclamation",
        now,
        ...restrictedSourceIncident,
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
        description: sensitiveMedicalContent
          ? sensitiveMedicalOperationalDescription()
          : restrictedOperationalDescription(),
        type: "warning",
        badge: "Planificación",
        reporter: worker.name,
        icon: "fa-solid fa-clock",
        now,
        ...restrictedSourceIncident,
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
      ...(sourceContentRestricted ? { sourceContentRestricted: true } : {}),
      ...(sensitiveMedicalContent
        ? { sensitivity: "medical" }
        : sourceContentRestricted
          ? { sensitivity: "restricted" }
          : {}),
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
    ...((sensitiveMedicalContent || event.kind === "audio")
      ? {
          metadata: {
            sensitivity: sensitiveMedicalContent ? "medical" : "restricted",
            sourceContentRestricted: true,
          },
        }
      : {}),
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
