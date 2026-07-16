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

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

function buildIncident({ title, description, type, badge, reporter, icon, now, evidence }) {
  return {
    id: `inc-${randomUUID()}`,
    title,
    description,
    type,
    badge,
    timestamp: new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
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

  return (
    Object.entries(state.tasks).find(([, task]) => {
      const significantWords = normalize(task.name)
        .split(/\s+/)
        .filter((word) => word.length >= 5);
      return significantWords.some((word) => normalizedText.includes(word));
    }) || [null, null]
  );
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

function audioProposalReply(proposal, transcriptionStatus = null) {
  if (transcriptionStatus === "disabled_by_tenant") {
    return "Recibí el audio y lo guardé como evidencia. La transcripción con IA está desactivada por la organización y no se envió el contenido a un proveedor de IA.";
  }
  if (!proposal) {
    return "Recibí el audio y lo guardé como evidencia. La transcripción quedó pendiente para procesamiento automático.";
  }
  if (proposal.type === REPORT_PROPOSAL_TYPES.CRITICAL_INCIDENT) {
    return "Guardé y transcribí el audio como evidencia. Detecté una posible incidencia crítica, pero no ejecuté cambios ni envié notificaciones desde la voz. Confirmala por texto con “incidencia urgente:” y el detalle para registrarla como alerta operativa.";
  }
  if (proposal.type === REPORT_PROPOSAL_TYPES.DELAY_REPORT) {
    return "Guardé y transcribí el audio como evidencia. Detecté una posible demora, todavía sin impacto aplicado al cronograma. Confirmala por texto con “demora:” y el detalle para que quede registrada.";
  }
  if (proposal.type === REPORT_PROPOSAL_TYPES.TASK_PROGRESS) {
    const progress = proposal.percentage === null ? "" : `${proposal.percentage}%`;
    const reference = proposal.taskReference ? ` en ${proposal.taskReference}` : "";
    return `Guardé y transcribí el audio como evidencia. Detecté una propuesta de avance ${progress}${reference}, pero no modifiqué el Gantt. Confirmala por texto indicando “avance ${progress || "porcentaje"} tarea <número o nombre>”.`;
  }
  if (proposal.type === REPORT_PROPOSAL_TYPES.ATTENDANCE_REQUEST) {
    return "Guardé y transcribí el audio como evidencia. Detecté una intención de fichaje, pero la voz no registra asistencia. Escribí “fichar” para iniciar el control y luego informá tu ubicación.";
  }
  return "Guardé y transcribí el audio como evidencia. No detecté una acción inequívoca y no modifiqué la obra. Si querés aplicar un cambio, confirmalo con un comando por texto.";
}

async function processFlowReply({ state, worker, event, now, projectId, links, prisma, evidence }) {
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
        timeZone: "America/Argentina/Buenos_Aires",
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
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(now);
  const worker = trustedWorker(options.worker, projectSettings.id);
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
  const intent = classifyObraIntent(event);

  if (!canFieldWorkerHandleIntent(worker.whatsappRole, intent)) {
    reply = intent === FIELD_WORKER_INTENTS.TASK_PROGRESS
      ? "Tu número está autorizado para reportar, pero no para cambiar avances. Pedile al capataz o jefe de obra que confirme la actualización."
      : "Tu rol no permite ejecutar esa acción desde WhatsApp. El mensaje quedó registrado sin modificar la obra.";
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
      },
    );
    reply = "Evidencia recibida y registrada. Para vincularla a una tarea, respondé con el nombre de la tarea o su número.";
  } else if (event.kind === "audio") {
    const transcriptionCompleted = event.transcription?.status === "completed" && body;
    const transcriptionDisabled = event.transcription?.status === "disabled_by_tenant";
    audioProposal = transcriptionCompleted ? classifyReportProposal(body) : null;
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
        evidence: audioProposal
          ? { ...(evidence || {}), proposal: audioProposal }
          : evidence,
      },
    );
    reply = audioProposalReply(audioProposal, event.transcription?.status || null);
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
      task.progress = progress;
      reply = `Actualicé “${task.name}” al ${progress}% y registré el cambio en la bitácora.`;
      stateChanged = true;
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
      authorized: true,
      ...(intent === FIELD_WORKER_INTENTS.MEDICAL ? { sensitivity: "medical" } : {}),
      ...(audioProposal ? { audioProposal } : {}),
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

  return { reply, state, worker, flowPrompt, intent, stateChanged, newMessages };
}
