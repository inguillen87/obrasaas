import { buildGanttModel } from './gantt.js';

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, number(value)));
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function entries(value) {
  return Object.entries(record(value));
}

function text(value, fallback) {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function timeline(value) {
  const match = String(value || '').match(/(\d+)\s*\/\s*(\d+)/);
  const currentDay = Math.max(0, number(match?.[1], 0));
  const totalDays = Math.max(1, number(match?.[2], 1));
  return {
    currentDay,
    totalDays,
    percentage: Math.round(clamp((currentDay / totalDays) * 100)),
  };
}

function incidentTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (['critical', 'danger', 'high'].includes(normalized)) return 'danger';
  if (['warning', 'medium'].includes(normalized)) return 'warning';
  if (['success', 'resolved', 'low'].includes(normalized)) return 'success';
  return 'neutral';
}

function reportCurrency(value, currency) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function buildBudget(state) {
  const budget = record(state.budget);
  const total = number(budget.total ?? state.budgetTotal);
  if (total <= 0) return null;
  const executed = clamp(number(budget.executed ?? state.budgetExecuted), 0, total);
  const currency = text(budget.currency ?? state.budgetCurrency, 'USD').toUpperCase();
  return {
    total,
    executed,
    remaining: total - executed,
    currency,
    formattedTotal: reportCurrency(total, currency),
    formattedExecuted: reportCurrency(executed, currency),
    formattedRemaining: reportCurrency(total - executed, currency),
  };
}

export function buildWeeklyReportModel({
  state = {},
  messages = [],
  organization = {},
  project = {},
  actorEmail = null,
  generatedAt = new Date(),
  snapshot = null,
} = {}) {
  const progress = Math.round(clamp(state.avancePercentage));
  const schedule = timeline(state.diasEstimados);
  const gantt = buildGanttModel(state.tasks, {
    projectStartsAt: project.startsAt,
    projectEndsAt: project.endsAt,
  });
  const tasks = gantt.tasks.map((task) => {
    return {
      id: task.id,
      name: task.name,
      assignee: task.assignee,
      duration: task.duration,
      progress: task.progress,
      status: task.status,
      tone: task.tone,
      startDay: task.startDay,
      endDay: task.endDay,
      startDate: task.startDate,
      endDate: task.endDate,
      dependencyNames: task.dependencyNames,
      dependencyConflict: task.dependencyConflict,
    };
  });
  const attendance = entries(state.attendance).map(([name, attendanceValue]) => {
    const item = record(attendanceValue);
    const status = text(item.status, 'Sin estado');
    const normalized = status.toLowerCase();
    return {
      name,
      role: text(item.role, 'Sin función'),
      status,
      tone: normalized.includes('presente') || normalized.includes('voz')
        ? 'success'
        : normalized.includes('licencia') || normalized.includes('justific')
          ? 'warning'
          : 'danger',
    };
  });
  const stockpiles = entries(state.stockpiles).map(([id, stockValue]) => {
    const item = record(stockValue);
    const belowMinimum = number(item.current) < number(item.min);
    const status = text(item.status, belowMinimum ? 'Crítico' : 'Sin estado');
    return {
      id,
      name: text(item.name, 'Material sin nombre'),
      current: number(item.current),
      unit: text(item.unit, 'u.'),
      status,
      tone: belowMinimum || /cr[ií]tico|bajo/i.test(status)
        ? 'danger'
        : /camino|pendiente|revisar/i.test(status) ? 'warning' : 'success',
    };
  });
  const incidents = (Array.isArray(state.incidents) ? state.incidents : [])
    .slice(0, 8)
    .map((incidentValue, index) => {
      const incident = record(incidentValue);
      const sourceType = incident.severity || incident.type;
      const tone = incidentTone(sourceType);
      return {
        id: text(incident.id, `incident-${index}`),
        title: text(incident.title, 'Incidencia sin título'),
        description: text(incident.description, 'Sin detalle informado'),
        reporter: text(incident.reporter, 'Operación de obra'),
        tone,
        label: text(incident.badge, tone === 'danger' ? 'Alta' : tone === 'warning' ? 'Media' : 'Informativa'),
      };
    });
  const messageList = Array.isArray(messages) ? messages : [];
  const evidenceCount = messageList.filter((message) => Boolean(
    message?.mediaUrl || message?.media || ['image', 'video', 'document', 'audio'].includes(String(message?.kind).toLowerCase()),
  )).length;
  const audioCount = messageList.filter((message) => (
    String(message?.kind).toLowerCase() === 'audio' || Boolean(message?.transcription)
  )).length;
  const operationalMessageCount = messageList.filter((message) => {
    const kind = String(message?.kind).toLowerCase();
    if (kind === 'system') return false;
    return message?.sender === 'user'
      || Boolean(message?.mediaUrl || message?.media || message?.transcription)
      || ['image', 'video', 'document', 'audio', 'location'].includes(kind);
  }).length;
  const presentWorkers = attendance.filter((entry) => entry.tone === 'success').length;
  const criticalIncidents = incidents.filter((incident) => incident.tone === 'danger').length;
  const tasksDone = tasks.filter((task) => task.progress >= 100).length;
  const alertsCount = Math.max(number(state.alertsCount), incidents.filter((item) => (
    item.tone === 'danger' || item.tone === 'warning'
  )).length);
  const generated = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const periodStart = new Date(generated);
  periodStart.setDate(periodStart.getDate() - 6);
  const scheduleGap = schedule.percentage - progress;
  const hasOperationalData = tasks.length > 0
    || attendance.length > 0
    || stockpiles.length > 0
    || incidents.length > 0
    || operationalMessageCount > 0
    || progress > 0
    || number(state.alertsCount) > 0;
  const isEmptyState = !snapshot || snapshot.exists === false || !hasOperationalData;
  const executiveSummary = isEmptyState
    ? 'Todavía no hay actividad operativa persistida para elaborar una lectura ejecutiva. Registrá avances, asistencia, tareas o evidencias antes de usar este reporte para tomar decisiones.'
    : gantt.dependencyConflicts > 0
      ? `El cronograma contiene ${gantt.dependencyConflicts} conflicto${gantt.dependencyConflicts === 1 ? '' : 's'} de secuencia: hay tareas planificadas antes de que finalicen sus predecesoras. Reprogramarlas evita comunicar una línea base inconsistente.`
    : scheduleGap > 10
    ? `El avance físico se ubica ${scheduleGap} puntos por debajo del tiempo consumido. Conviene revisar tareas bloqueadas, abastecimiento y responsables antes de confirmar la próxima línea base.`
    : alertsCount > 0
      ? `El avance mantiene una relación razonable con el plazo, pero existen ${alertsCount} alertas que requieren seguimiento. Priorizar las incidencias críticas evita trasladar riesgo a la próxima semana.`
      : 'El avance físico acompaña el plazo informado y no se observan alertas abiertas. Mantener la captura diaria de evidencia permitirá sostener esta lectura con trazabilidad.';
  const projectIdSuffix = text(project.id, 'LOCAL').slice(-7).toUpperCase();
  const dateId = generated.toISOString().slice(0, 10).replaceAll('-', '');

  return {
    organizationName: text(organization.name, 'Organización sin nombre'),
    projectName: text(project.name, 'Obra sin nombre'),
    projectAddress: text(project.address, 'Ubicación no informada'),
    reportId: `OS-${projectIdSuffix}-${dateId}`,
    issuedBy: text(organization.name, 'ObraSaaS'),
    issuedByEmail: text(actorEmail || organization.contactEmail, 'Responsable autorizado del tenant'),
    generatedAt: generated,
    periodStart,
    lastUpdatedAt: snapshot?.updatedAt ? new Date(snapshot.updatedAt) : null,
    snapshotVersion: Math.max(1, number(snapshot?.version, 1)),
    isEmptyState,
    progress,
    currentDay: schedule.currentDay,
    totalDays: schedule.totalDays,
    timelinePercentage: schedule.percentage,
    alertsCount,
    criticalIncidents,
    presentWorkers,
    tasksDone,
    dependencyCount: gantt.dependencyCount,
    scheduleConflicts: gantt.dependencyConflicts,
    scheduleStartsAt: gantt.startsAt,
    scheduleEndsAt: gantt.endsAt,
    evidenceCount,
    audioCount,
    tasks,
    attendance,
    stockpiles,
    incidents,
    budget: buildBudget(state),
    executiveSummary,
  };
}
