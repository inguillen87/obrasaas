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
  evidenceSummary = null,
  organization = {},
  project = {},
  actorEmail = null,
  generatedAt = new Date(),
  snapshot = null,
  timeZone = organization?.timezone || 'America/Argentina/Buenos_Aires',
} = {}) {
  const parsedGenerated = new Date(generatedAt);
  const generated = Number.isNaN(parsedGenerated.getTime())
    ? new Date()
    : parsedGenerated;
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
  const attendance = entries(state.attendance).map(([recordKey, attendanceValue]) => {
    const item = record(attendanceValue);
    const status = text(item.status, 'Sin estado');
    const normalized = status.toLowerCase();
    const explicitPresence = Object.hasOwn(item, 'present');
    const present = explicitPresence
      ? item.present === true
      : normalized.includes('presente') || normalized.includes('voz');
    const checkin = text(item.checkin, '—');
    const breakStartedAt = text(item.breakStartedAt, '—');
    const breakEndedAt = text(item.breakEndedAt, '—');
    const checkout = text(item.checkout, '—');
    const workDateLabel = text(item.workDateLabel, 'Última jornada');
    const pauseLabel = breakStartedAt === '—' && breakEndedAt === '—'
      ? 'sin pausa registrada'
      : `${breakStartedAt}–${breakEndedAt}`;
    return {
      name: text(item.name, recordKey),
      role: text(item.role, 'Sin función'),
      status,
      present,
      daysPresent: Math.max(0, number(item.daysPresent, present ? 1 : 0)),
      daysRegistered: Math.max(0, number(item.daysRegistered, 1)),
      workDateLabel,
      checkin,
      breakStartedAt,
      breakEndedAt,
      checkout,
      journeyLabel: item.legacyException === true
        ? 'Sin jornada canónica · excepción pendiente de migración'
        : `${workDateLabel} · ${checkin} → ${checkout} · pausa ${pauseLabel}`,
      legacyException: item.legacyException === true,
      tone: item.legacyException === true
        ? 'warning'
        : item.reviewRequired === true || normalized.includes('revisi')
        ? 'warning'
        : normalized.includes('licencia') || normalized.includes('justific')
          ? 'warning'
          : normalized.includes('jornada cerrada')
            ? 'neutral'
            : present
              ? 'success'
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
  const allIncidents = (Array.isArray(state.incidents) ? state.incidents : [])
    .map((incidentValue, index) => {
      const incident = record(incidentValue);
      const sourceType = incident.severity || incident.type;
      const status = text(incident.status, 'open').toLowerCase();
      const active = !['resolved', 'closed'].includes(status);
      const tone = active ? incidentTone(sourceType) : 'success';
      return {
        id: text(incident.id, `incident-${index}`),
        title: text(incident.title, 'Incidencia sin título'),
        description: text(incident.description, 'Sin detalle informado'),
        reporter: text(incident.reporter, 'Operación de obra'),
        active,
        status,
        tone,
        label: active
          ? text(incident.badge, tone === 'danger' ? 'Alta' : tone === 'warning' ? 'Media' : 'Informativa')
          : 'Resuelta',
      };
    })
    .sort((left, right) => {
      const priority = { danger: 0, warning: 1, neutral: 2, success: 3 };
      if (left.active !== right.active) return left.active ? -1 : 1;
      return priority[left.tone] - priority[right.tone];
    });
  const incidentTotal = allIncidents.length;
  const incidents = allIncidents.slice(0, 40);
  const messageList = Array.isArray(messages) ? messages : [];
  const computedEvidenceCount = messageList.filter((message) => Boolean(
    message?.mediaUrl || message?.media || ['image', 'video', 'document', 'audio'].includes(String(message?.kind).toLowerCase()),
  )).length;
  const computedAudioCount = messageList.filter((message) => (
    String(message?.kind).toLowerCase() === 'audio' || Boolean(message?.transcription)
  )).length;
  const computedOperationalMessageCount = messageList.filter((message) => {
    const kind = String(message?.kind).toLowerCase();
    if (kind === 'system') return false;
    return message?.sender === 'user'
      || Boolean(message?.mediaUrl || message?.media || message?.transcription)
      || ['image', 'video', 'document', 'audio', 'location'].includes(kind);
  }).length;
  const summary = record(evidenceSummary);
  const evidenceCount = evidenceSummary == null
    ? computedEvidenceCount
    : Math.max(0, number(summary.evidenceCount));
  const audioCount = evidenceSummary == null
    ? computedAudioCount
    : Math.max(0, number(summary.audioCount));
  const operationalMessageCount = evidenceSummary == null
    ? computedOperationalMessageCount
    : Math.max(0, number(summary.operationalMessageCount));
  const evidenceTruncated = evidenceSummary != null && summary.truncated === true;
  const evidenceMessageLimit = Math.max(1, number(summary.messageLimit, 500));
  const presentWorkers = attendance.filter((entry) => entry.present).length;
  const criticalIncidents = allIncidents.filter((incident) => (
    incident.active && incident.tone === 'danger'
  )).length;
  const tasksDone = tasks.filter((task) => task.progress >= 100).length;
  const alertsCount = Math.max(number(state.alertsCount), allIncidents.filter((item) => (
    item.active && (item.tone === 'danger' || item.tone === 'warning')
  )).length);
  const reportTimeZone = supportedReportTimeZone(timeZone);
  const periodStart = weeklyReportPeriodStart(generated, reportTimeZone);
  const scheduleGap = schedule.percentage - progress;
  const hasOperationalData = tasks.length > 0
    || attendance.length > 0
    || stockpiles.length > 0
    || incidentTotal > 0
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
      : 'El avance físico acompaña el plazo informado y no se observan alertas activas. Mantener la captura diaria de evidencia permitirá sostener esta lectura con trazabilidad.';
  const projectIdSuffix = text(project.id, 'LOCAL').slice(-7).toUpperCase();
  const dateId = weeklyReportDocumentTimestamp(generated, reportTimeZone);

  return {
    organizationName: text(organization.name, 'Organización sin nombre'),
    projectName: text(project.name, 'Obra sin nombre'),
    projectAddress: text(project.address, 'Ubicación no informada'),
    reportId: `OS-${projectIdSuffix}-${dateId}`,
    issuedBy: text(organization.name, 'ObraSaaS'),
    issuedByEmail: text(actorEmail || organization.contactEmail, 'Responsable autorizado del tenant'),
    generatedAt: generated,
    timeZone: reportTimeZone,
    periodStart,
    lastUpdatedAt: snapshot?.updatedAt ? new Date(snapshot.updatedAt) : null,
    snapshotVersion: snapshot && snapshot.exists !== false
      ? Math.max(1, number(snapshot.version, 1))
      : null,
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
    evidenceTruncated,
    evidenceMessageLimit,
    tasks,
    attendance,
    stockpiles,
    incidents,
    incidentTotal,
    budget: buildBudget(state),
    executiveSummary,
  };
}

const DEFAULT_REPORT_TIMEZONE = 'America/Argentina/Buenos_Aires';

function safeReportDate(value) {
  try {
    const parsed = value instanceof Date ? new Date(value) : new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch {
    return new Date();
  }
}

function supportedReportTimeZone(value) {
  const candidate = String(value || DEFAULT_REPORT_TIMEZONE).trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return DEFAULT_REPORT_TIMEZONE;
  }
}

function zonedParts(value, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(
    formatter.formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
}

function shiftedCalendarDate(parts, days) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function calendarDateKey(parts) {
  return [parts.year, parts.month, parts.day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');
}

function zonedMidnightUtc(parts, timeZone) {
  const nominalUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const targetDate = calendarDateKey(parts);
  let lower = nominalUtc - (36 * 60 * 60 * 1_000);
  let upper = nominalUtc + (36 * 60 * 60 * 1_000);
  while (lower < upper) {
    const midpoint = lower + Math.floor((upper - lower) / 2);
    const renderedDate = calendarDateKey(zonedParts(new Date(midpoint), timeZone));
    if (renderedDate >= targetDate) upper = midpoint;
    else lower = midpoint + 1;
  }
  const firstInstant = new Date(lower);
  if (calendarDateKey(zonedParts(firstInstant, timeZone)) !== targetDate) {
    throw new RangeError(`No existe el día local ${targetDate} en ${timeZone}.`);
  }
  return firstInstant;
}

function databaseDate(parts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function weeklyReportWorkDateRange(value, timeZone = DEFAULT_REPORT_TIMEZONE) {
  const generated = safeReportDate(value);
  const zone = supportedReportTimeZone(timeZone);
  const current = zonedParts(generated, zone);
  const start = shiftedCalendarDate(current, -6);
  const end = shiftedCalendarDate(current, 0);
  return {
    start: databaseDate(start),
    end: databaseDate(end),
    timeZone: zone,
  };
}

export function weeklyReportPeriodStart(value, timeZone = DEFAULT_REPORT_TIMEZONE) {
  const generated = safeReportDate(value);
  const zone = supportedReportTimeZone(timeZone);
  const start = shiftedCalendarDate(zonedParts(generated, zone), -6);
  return zonedMidnightUtc(start, zone);
}

function weeklyReportDocumentTimestamp(value, timeZone = DEFAULT_REPORT_TIMEZONE) {
  const generated = safeReportDate(value);
  const parts = zonedParts(generated, supportedReportTimeZone(timeZone));
  const dateParts = [parts.year, parts.month, parts.day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'));
  const timeParts = [parts.hour, parts.minute, parts.second]
    .map((part) => String(part).padStart(2, '0'));
  timeParts.push(String(generated.getUTCMilliseconds()).padStart(3, '0'));
  return `${dateParts.join('')}-${timeParts.join('')}`;
}
