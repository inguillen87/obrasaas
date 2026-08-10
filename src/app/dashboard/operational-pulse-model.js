const CLOSED_INCIDENT_STATUSES = new Set(['closed', 'resolved']);
const ATTENTION_INCIDENT_TYPES = new Set(['critical', 'warning']);

const PROJECT_STATUSES = Object.freeze({
  ACTIVE: { label: 'Obra activa', tone: 'active' },
  PLANNING: { label: 'En planificación', tone: 'planning' },
  PAUSED: { label: 'Obra pausada', tone: 'paused' },
  COMPLETED: { label: 'Obra finalizada', tone: 'completed' },
  ARCHIVED: { label: 'Obra archivada', tone: 'archived' },
});

const SYNC_COPY = Object.freeze({
  live: {
    label: 'Datos sincronizados',
    detail: 'Última actualización confirmada',
    tone: 'live',
  },
  syncing: {
    label: 'Actualizando datos',
    detail: 'Guardando los últimos cambios',
    tone: 'syncing',
  },
  error: {
    label: 'Revisar sincronización',
    detail: 'Hay cambios que todavía no se confirmaron',
    tone: 'error',
  },
});

function recordValues(value) {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  return Object.values(value).filter(isRecord);
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function boundedProgress(value) {
  const progress = Number(value);
  if (!Number.isFinite(progress)) return null;
  return Math.max(0, Math.min(100, progress));
}

function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatSyncTime(value) {
  if (!value) return { dateTime: null, timeLabel: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { dateTime: null, timeLabel: null };

  return {
    dateTime: date.toISOString(),
    timeLabel: new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(date),
  };
}

function taskAttentionSignals(tasks) {
  return tasks.flatMap((task, index) => {
    const progress = boundedProgress(task.progress);
    if (task.isDelayed !== true || progress === 100) return [];

    return [{
      id: `delayed-task-${index}`,
      kind: 'Tarea demorada',
      title: cleanText(task.name) || 'Tarea sin nombre informado',
      detail: progress == null ? null : `${Math.round(progress)}% registrado`,
      tone: 'delayed',
      priority: 1,
      sourceIndex: index,
      href: '/dashboard?tab=sec-gantt',
    }];
  });
}

function incidentAttentionSignals(incidents) {
  return incidents.flatMap((incident, index) => {
    const type = String(incident.type || '').toLowerCase();
    const status = String(incident.status || '').toLowerCase();
    if (!ATTENTION_INCIDENT_TYPES.has(type) || CLOSED_INCIDENT_STATUSES.has(status)) return [];

    return [{
      id: `attention-incident-${cleanText(incident.id) || index}`,
      kind: type === 'critical' ? 'Riesgo crítico' : 'Alerta abierta',
      title: cleanText(incident.title) || 'Incidencia sin título informado',
      detail: cleanText(incident.timestamp),
      tone: type,
      priority: type === 'critical' ? 0 : 2,
      sourceIndex: index,
      href: '/dashboard/activity',
    }];
  });
}

function latestRecordedSignal(incidents) {
  const latest = incidents.find((incident) => (
    cleanText(incident.title) || cleanText(incident.description) || cleanText(incident.timestamp)
  ));
  if (!latest) return null;

  return {
    title: cleanText(latest.title) || cleanText(latest.description) || 'Actividad registrada',
    timestamp: cleanText(latest.timestamp),
  };
}

/**
 * Derives display-only operational facts from the persisted project snapshot.
 * It deliberately avoids estimating deadlines, expected headcount or overall
 * construction progress because those facts are not present in this payload.
 */
export function buildOperationalPulseModel({
  project,
  state,
  tasks: tasksProp,
  incidents: incidentsProp,
  attendance: attendanceProp,
  setup = {},
  syncState = 'live',
  lastSyncedAt = null,
} = {}) {
  const snapshot = isRecord(state) ? state : {};
  const capabilities = isRecord(setup) ? setup : {};
  const tasks = recordValues(tasksProp ?? snapshot.tasks);
  const incidents = Array.isArray(incidentsProp)
    ? incidentsProp.filter(isRecord)
    : Array.isArray(snapshot.incidents)
      ? snapshot.incidents.filter(isRecord)
      : [];
  const attendance = recordValues(attendanceProp ?? snapshot.attendance);

  const taskProgress = tasks.map((task) => boundedProgress(task.progress)).filter((value) => value != null);
  const averageTaskProgress = taskProgress.length > 0
    ? Math.round(taskProgress.reduce((total, progress) => total + progress, 0) / taskProgress.length)
    : null;
  const completedTaskCount = taskProgress.filter((progress) => progress === 100).length;
  const presentCount = attendance.filter((entry) => (
    String(entry.status || '').trim().toLocaleLowerCase('es-AR').startsWith('presente')
  )).length;

  const attentionSignals = [
    ...incidentAttentionSignals(incidents),
    ...taskAttentionSignals(tasks),
  ].sort((left, right) => (
    left.priority - right.priority || left.sourceIndex - right.sourceIndex
  ));
  const hasOperationalData = tasks.length > 0 || incidents.length > 0 || attendance.length > 0;
  const sync = SYNC_COPY[syncState] || SYNC_COPY.live;
  const syncTime = formatSyncTime(lastSyncedAt);
  const projectStatus = PROJECT_STATUSES[project?.status];

  let attentionHeadline = 'Sin riesgos abiertos en los datos registrados';
  let attentionEmptyCopy = 'No hay alertas abiertas ni tareas marcadas como demoradas.';
  if (attentionSignals.length > 0) {
    attentionHeadline = `${attentionSignals.length} señal${attentionSignals.length === 1 ? '' : 'es'} requiere${attentionSignals.length === 1 ? '' : 'n'} revisión`;
    attentionEmptyCopy = null;
  } else if (!hasOperationalData) {
    attentionHeadline = 'Todavía no hay actividad operativa registrada';
    attentionEmptyCopy = 'La prioridad aparecerá cuando exista una tarea, un fichaje o una novedad real.';
  }

  const actions = [
    {
      href: '/dashboard/activity',
      label: 'Abrir bitácora',
      icon: 'fa-solid fa-shield-halved',
    },
    {
      href: '/dashboard?tab=sec-gantt',
      label: capabilities.canManageProjects ? 'Gestionar cronograma' : 'Ver cronograma',
      icon: 'fa-solid fa-timeline',
    },
    {
      href: '/dashboard?tab=sec-personal',
      label: 'Ver asistencia',
      icon: 'fa-solid fa-users',
    },
  ];

  if (capabilities.canManageIntegrations && !capabilities.whatsappConnected) {
    actions.push({
      href: '/dashboard/integrations',
      label: capabilities.whatsappChannel?.requiresAttention
        ? 'Revisar WhatsApp'
        : 'Conectar WhatsApp',
      icon: 'fa-brands fa-whatsapp',
    });
  }

  return {
    project: {
      name: cleanText(project?.name) || 'Obra sin nombre informado',
      address: cleanText(project?.address),
      status: cleanText(projectStatus?.label) || cleanText(project?.status),
      statusTone: projectStatus?.tone || 'neutral',
    },
    attention: {
      count: attentionSignals.length,
      headline: attentionHeadline,
      emptyCopy: attentionEmptyCopy,
      signals: attentionSignals.slice(0, 3),
      hiddenCount: Math.max(0, attentionSignals.length - 3),
    },
    progress: {
      average: averageTaskProgress,
      taskCount: tasks.length,
      measuredTaskCount: taskProgress.length,
      completedTaskCount,
    },
    presence: {
      presentCount,
      recordCount: attendance.length,
    },
    sync: {
      ...sync,
      ...syncTime,
    },
    latestSignal: latestRecordedSignal(incidents),
    actions,
    hasOperationalData,
  };
}
