import { randomUUID } from "node:crypto";
import { generateWebviewToken } from "@/lib/auth";
import { appendMessages, getAppState, getProjectSettings, saveAppState } from "@/lib/db";
import { getDistanceMeters } from "@/lib/geo";

const workerProfiles = [
  { id: "juan", name: "Juan Gómez", role: "Albañilería principal", matches: ["juan"] },
  { id: "carlos", name: "Carlos Pérez", role: "Pintura e interiores", matches: ["carlos", "1132419981"] },
  { id: "luis", name: "Luis Martínez", role: "Instalaciones sanitarias", matches: ["luis"] },
];

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveWorker({ from, displayName }) {
  const searchValue = normalize(`${from} ${displayName || ""}`);
  const known = workerProfiles.find((worker) =>
    worker.matches.some((match) => searchValue.includes(match)),
  );
  if (known) return known;

  const phone = String(from || "operario").replace(/\D/g, "") || "operario";
  return {
    id: phone,
    name: displayName || `Operario ${phone.slice(-4)}`,
    role: "Cuadrilla de obra",
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
  state.operariosCount = Object.values(state.attendance).filter((entry) =>
    normalize(entry.status).includes("presente"),
  ).length;
}

function processFlowReply({ state, worker, event, now }) {
  const response = event.interactive?.response || {};
  const flowName = normalize(event.interactive?.name || response.flow_name || "");
  const summary = Object.entries(response)
    .filter(([key]) => !["flow_token", "screen"].includes(key))
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");

  const isMedical = flowName.includes("medical") || flowName.includes("licencia");
  if (isMedical) {
    const days = Math.min(30, Math.max(1, Number(response.days) || 1));
    state.attendance[worker.name] = {
      role: worker.role,
      checkin: "--:--",
      status: `Licencia justificada (${days} días)`,
    };
  }

  state.incidents.unshift(
    buildIncident({
      title: isMedical
        ? "Certificado médico recibido"
        : flowName.includes("incid")
          ? "Incidencia recibida por WhatsApp Flow"
          : "Formulario de obra completado",
      description: isMedical
        ? `Licencia justificada de ${worker.name}. Documento almacenado en repositorio protegido.`
        : summary || "El formulario fue recibido y quedó registrado en la bitácora.",
      type: flowName.includes("incid") ? "warning" : "info",
      badge: "WhatsApp Flow",
      reporter: worker.name,
      icon: "fa-brands fa-whatsapp",
      now,
    }),
  );

  return isMedical
    ? "Certificado recibido y asociado a tu legajo. La licencia quedó informada al equipo autorizado."
    : "Formulario recibido. Lo registré en la bitácora de la obra y ya está visible para el equipo de gestión.";
}

export async function processIncomingObraMessage(event, scope) {
  const [state, projectSettings] = await Promise.all([
    getAppState(scope),
    getProjectSettings(scope),
  ]);
  ensureStateCollections(state);

  const now = event.timestamp instanceof Date ? event.timestamp : new Date();
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(now);
  const worker = resolveWorker(event);
  const links = secureLinks(worker.id, projectSettings.id);
  const body = String(event.text || event.transcription?.text || "").trim();
  const lowerBody = normalize(body);
  const evidence = event.media
    ? {
        kind: event.kind,
        url: event.media.url || null,
        filename: event.media.filename || null,
        mimeType: event.media.mimeType || null,
        size: event.media.size || null,
        sha256: event.media.sha256 || null,
        assetId: event.media.storage?.assetId || null,
        publicId: event.media.storage?.publicId || null,
      }
    : null;
  let reply;

  if (event.interactive?.type === "flow") {
    reply = processFlowReply({ state, worker, event, now });
  } else if (event.location) {
    const projectLatitude = projectSettings.latitude;
    const projectLongitude = projectSettings.longitude;
    const geofenceMeters = projectSettings.geofenceMeters;
    const distance = Math.round(
      getDistanceMeters(
        event.location.latitude,
        event.location.longitude,
        projectLatitude,
        projectLongitude,
      ),
    );
    const inside = distance <= geofenceMeters;

    state.attendance[worker.name] = {
      role: worker.role,
      checkin: time,
      status: inside ? "Presente (GPS)" : "Desvío (GPS)",
    };
    if (!inside) state.alertsCount += 1;
    updatePresentCount(state);
    state.incidents.unshift(
      buildIncident({
        title: inside ? "Fichaje dentro de geocerca" : "Fichaje fuera de geocerca",
        description: `${worker.name} registró su ubicación a ${distance} m del punto de obra (radio configurado: ${geofenceMeters} m).`,
        type: inside ? "success" : "critical",
        badge: inside ? "Presente" : "Revisar GPS",
        reporter: worker.name,
        icon: "fa-solid fa-location-dot",
        now,
      }),
    );
    reply = inside
      ? `Ubicación validada. Registré tu ingreso a las ${time} dentro de la geocerca (${distance} m).\n\nVer historial: ${links.attendance}`
      : `Registré el fichaje a ${distance} m de la obra, fuera del radio permitido de ${geofenceMeters} m. Quedó marcado para revisión.`;
  } else if (["image", "video", "document", "sticker"].includes(event.kind)) {
    state.incidents.unshift(
      buildIncident({
        title: "Evidencia de obra recibida",
        description: body || `Archivo ${event.kind} recibido desde WhatsApp y asociado a la bitácora.`,
        type: "info",
        badge: "Evidencia",
        reporter: worker.name,
        icon: "fa-solid fa-camera",
        now,
        evidence,
      }),
    );
    reply = "Evidencia recibida y registrada. Para vincularla a una tarea, respondé con el nombre de la tarea o su número.";
  } else if (event.kind === "audio") {
    const transcriptionCompleted = event.transcription?.status === "completed" && body;
    state.incidents.unshift(
      buildIncident({
        title: transcriptionCompleted ? "Reporte de voz transcripto" : "Audio de obra recibido",
        description: transcriptionCompleted
          ? body
          : "El audio quedó almacenado como evidencia y su transcripción está pendiente.",
        type: "info",
        badge: transcriptionCompleted ? "Voz + IA" : "Evidencia de voz",
        reporter: worker.name,
        icon: "fa-solid fa-microphone-lines",
        now,
        evidence,
      }),
    );
    reply = transcriptionCompleted
      ? `Audio guardado y transcripto:\n\n“${body.slice(0, 900)}”\n\nQuedó registrado en la bitácora de la obra.`
      : "Recibí el audio y lo guardé como evidencia. La transcripción quedó pendiente para procesamiento automático.";
  } else if (lowerBody.includes("licencia") || lowerBody.includes("certificado")) {
    reply = `Cargá el certificado desde este enlace seguro, válido por dos horas:\n${links.medical}`;
  } else if (["fichar", "ingreso", "ingresar", "entrada", "arranco"].some((term) => lowerBody.includes(term))) {
    state.attendance[worker.name] = { role: worker.role, checkin: time, status: "Presente" };
    updatePresentCount(state);
    state.incidents.unshift(
      buildIncident({
        title: "Ingreso registrado",
        description: `${worker.name} informó el inicio de su jornada. La verificación GPS sigue pendiente.`,
        type: "success",
        badge: "Presentismo",
        reporter: worker.name,
        icon: "fa-solid fa-user-check",
        now,
      }),
    );
    reply = `Registré tu ingreso a las ${time}. Completá la validación GPS desde este enlace seguro:\n${links.attendance}`;
  } else if (/\b([0-9]{1,3})\s*%/.test(lowerBody)) {
    const progress = Math.min(100, Number(lowerBody.match(/\b([0-9]{1,3})\s*%/)?.[1] || 0));
    const [, task] = selectTask(state, lowerBody);
    if (task) {
      task.progress = progress;
      reply = `Actualicé “${task.name}” al ${progress}% y registré el cambio en la bitácora.`;
    } else {
      reply = `Detecté un avance del ${progress}%, pero necesito el nombre o número de la tarea para aplicarlo sin ambigüedad.`;
    }
  } else if (["fuga", "roto", "accidente", "riesgo", "urgente", "peligro"].some((term) => lowerBody.includes(term))) {
    state.alertsCount += 1;
    state.incidents.unshift(
      buildIncident({
        title: "Incidencia crítica reportada",
        description: body || "Reporte urgente recibido desde WhatsApp.",
        type: "critical",
        badge: "Urgente",
        reporter: worker.name,
        icon: "fa-solid fa-triangle-exclamation",
        now,
      }),
    );
    reply = "Registré la incidencia como crítica y quedó visible en el centro de alertas. Si hay riesgo para personas, detené la tarea y seguí el protocolo de seguridad de la obra.";
  } else if (["demora", "retraso", "no llego", "suministro"].some((term) => lowerBody.includes(term))) {
    state.alertsCount += 1;
    state.incidents.unshift(
      buildIncident({
        title: "Demora reportada",
        description: body,
        type: "warning",
        badge: "Planificación",
        reporter: worker.name,
        icon: "fa-solid fa-clock",
        now,
      }),
    );
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
    text: body || `[${event.kind || "evento"}]`,
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
    },
  }, {
    externalId: event.externalId ? `obrasaas-reply:${event.externalId}` : null,
    sender: "bot",
    kind: "text",
    text: reply,
    time,
    sentAt: new Date().toISOString(),
  }];
  await saveAppState(state, scope);
  await appendMessages(newMessages, scope);

  return { reply, state, worker };
}
