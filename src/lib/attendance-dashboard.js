const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function createAttendanceUiIdempotencyKey() {
  const entropy = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `attendance-ui:${entropy}`.slice(0, 128);
}

export const ATTENDANCE_CLASSIFICATION_LABELS = Object.freeze({
  UNSCHEDULED: 'Sin horario',
  EXPECTED: 'Esperado',
  PRESENT: 'Presente',
  LATE: 'Tarde',
  PENDING_GPS: 'GPS pendiente',
  REVIEW_REQUIRED: 'Requiere revisión',
  NO_SHOW: 'Sin ingreso',
  ABSENT: 'Ausente',
  EXCUSED: 'Justificado',
  PENDING_CLOSE: 'Salida pendiente',
});

export const ATTENDANCE_ALERT_LABELS = Object.freeze({
  NO_SHOW: 'Sin ingreso en horario',
  PENDING_CLOSE: 'Jornada sin cerrar',
});

export const ATTENDANCE_EXCEPTION_TYPES = Object.freeze([
  { value: 'EXCUSED_ABSENCE', label: 'Ausencia justificada' },
  { value: 'APPROVED_LEAVE', label: 'Licencia aprobada' },
  { value: 'OFFSITE_WORK', label: 'Trabajo fuera de obra' },
  { value: 'NON_WORKING_DAY', label: 'Día no laborable' },
]);

export const ISO_WEEKDAYS = Object.freeze([
  { isoWeekday: 1, short: 'Lun', label: 'Lunes' },
  { isoWeekday: 2, short: 'Mar', label: 'Martes' },
  { isoWeekday: 3, short: 'Mié', label: 'Miércoles' },
  { isoWeekday: 4, short: 'Jue', label: 'Jueves' },
  { isoWeekday: 5, short: 'Vie', label: 'Viernes' },
  { isoWeekday: 6, short: 'Sáb', label: 'Sábado' },
  { isoWeekday: 7, short: 'Dom', label: 'Domingo' },
]);

function integer(value, field, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${field} debe ser un entero entre ${minimum} y ${maximum}.`);
  }
  return parsed;
}

function safeDateKey(value, fallback) {
  const candidate = String(value || '').trim();
  return DATE_KEY_PATTERN.test(candidate) ? candidate : fallback;
}

export function addCivilDays(dateKey, amount) {
  const candidate = safeDateKey(dateKey, null);
  if (!candidate || !Number.isSafeInteger(amount)) {
    throw new Error('La fecha civil no es válida.');
  }
  const date = new Date(`${candidate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function minuteToTime(value, fallback = '08:00') {
  const minute = Number(value);
  if (!Number.isSafeInteger(minute) || minute < 0 || minute > 1_439) return fallback;
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function timeToMinute(value, field = 'Hora') {
  const candidate = String(value || '').trim();
  if (!TIME_PATTERN.test(candidate)) throw new Error(`${field} no es válida.`);
  const [hour, minute] = candidate.split(':').map(Number);
  return (hour * 60) + minute;
}

export function attendanceSummary(control) {
  const source = control?.summary || control?.kpis || {};
  return {
    present: Number(source.present ?? source.presentCount) || 0,
    late: Number(source.late ?? source.lateCount) || 0,
    noShow: Number(source.noShow ?? source.noShowCount) || 0,
    absent: Number(source.absent ?? source.absentCount) || 0,
    pendingClose: Number(source.pendingClose ?? source.pendingCloseCount) || 0,
    reviewRequired: Number(source.reviewRequired ?? source.reviewRequiredCount) || 0,
    openAlerts: Number(source.openAlerts) || 0,
    totalWorkers: Number(source.totalWorkers) || 0,
  };
}

export function attendanceRows(control) {
  const rows = Array.isArray(control?.rows)
    ? control.rows
    : (Array.isArray(control?.people) ? control.people : []);
  return rows.map((row) => {
    const worker = row.worker || {};
    const evaluation = row.evaluation || {};
    const classification = evaluation.classification || row.status || 'EXPECTED';
    return {
      ...row,
      workerId: worker.id || row.workerId || row.id,
      name: worker.name || row.name || 'Sin nombre',
      role: worker.role || row.role || null,
      classification,
      classificationLabel: ATTENDANCE_CLASSIFICATION_LABELS[classification] || classification,
      checkInAt: evaluation.actualCheckInAt || row.checkInAt || null,
      checkOutAt: evaluation.actualCheckOutAt || row.checkOutAt || null,
      delayMinutes: Number(evaluation.delayMinutes) || 0,
      workedDurationMinutes: Number(evaluation.workedDurationMinutes) || 0,
      missingCheckout: Boolean(evaluation.missingCheckout),
      reviewRequired: Boolean(evaluation.reviewRequired),
      pendingGps: Boolean(evaluation.pendingGps),
      exception: row.exception || null,
      alerts: Array.isArray(row.alerts) ? row.alerts : [],
    };
  });
}

export function openAttendanceAlerts(rows) {
  return (Array.isArray(rows) ? rows : []).flatMap((row) => (
    (row.alerts || [])
      .filter((alert) => alert.open && alert.openedEventId)
      .map((alert) => ({
        ...alert,
        id: alert.openedEventId,
        workerId: row.workerId,
        workerName: row.name,
        title: ATTENDANCE_ALERT_LABELS[alert.type] || alert.type,
      }))
  ));
}

function defaultScheduleDay(day) {
  const isWorkingDay = day.isoWeekday <= 5;
  return {
    isoWeekday: day.isoWeekday,
    isWorkingDay,
    startTime: '08:00',
    endTime: '17:00',
    endDayOffset: 0,
    expectedBreakMinutes: isWorkingDay ? 60 : 0,
  };
}

export function createScheduleDraft({
  schedule = null,
  assignedWorkerIds = [],
  workDate,
  timezone = 'America/Argentina/Buenos_Aires',
} = {}) {
  const version = schedule?.versions?.[0] || null;
  const latestKnownDate = [
    safeDateKey(workDate, null),
    safeDateKey(version?.effectiveFrom, null),
  ].filter(Boolean).sort().at(-1);
  const nextEffectiveDate = schedule
    ? addCivilDays(latestKnownDate, 1)
    : safeDateKey(workDate, new Date().toISOString().slice(0, 10));
  const sourceDays = new Map((version?.days || []).map((day) => [day.isoWeekday, day]));
  return {
    scheduleId: schedule?.id || null,
    expectedRevision: Number(schedule?.revision) || 0,
    name: schedule?.name || 'Horario general',
    effectiveFrom: nextEffectiveDate,
    timezone: version?.timezone || timezone,
    earlyCheckInMinutes: version?.earlyCheckInMinutes ?? 120,
    lateToleranceMinutes: version?.lateToleranceMinutes ?? 10,
    latePolicy: version?.latePolicy || 'FULL_FROM_SCHEDULE',
    noShowAfterMinutes: version?.noShowAfterMinutes ?? 30,
    pendingCloseAfterMinutes: version?.pendingCloseAfterMinutes ?? 60,
    absenceFinalizeAfterMinutes: version?.absenceFinalizeAfterMinutes ?? 120,
    workerIds: [...new Set(assignedWorkerIds)].sort(),
    days: ISO_WEEKDAYS.map((weekday) => {
      const source = sourceDays.get(weekday.isoWeekday);
      if (!source) return defaultScheduleDay(weekday);
      return {
        isoWeekday: weekday.isoWeekday,
        isWorkingDay: Boolean(source.isWorkingDay),
        startTime: minuteToTime(source.startMinute),
        endTime: minuteToTime(source.endMinute, '17:00'),
        endDayOffset: Number(source.endDayOffset) === 1 ? 1 : 0,
        expectedBreakMinutes: Number(source.expectedBreakMinutes) || 0,
      };
    }),
  };
}

export function buildSchedulePublishPayload(draft) {
  const name = String(draft?.name || '').trim();
  if (!name || name.length > 120) throw new Error('El nombre del horario es obligatorio.');
  const effectiveFrom = safeDateKey(draft?.effectiveFrom, null);
  if (!effectiveFrom) throw new Error('La vigencia debe ser una fecha válida.');
  const timezone = String(draft?.timezone || '').trim();
  if (!timezone || timezone.length > 64) throw new Error('La zona horaria es obligatoria.');
  if (!Array.isArray(draft?.days) || draft.days.length !== 7) {
    throw new Error('El horario debe definir los siete días de la semana.');
  }
  const lateToleranceMinutes = integer(draft.lateToleranceMinutes, 'La tolerancia', 0, 240);
  const noShowAfterMinutes = integer(draft.noShowAfterMinutes, 'El umbral sin ingreso', lateToleranceMinutes, 1_440);
  const pendingCloseAfterMinutes = integer(draft.pendingCloseAfterMinutes, 'El aviso de salida pendiente', 0, 1_440);
  const absenceFinalizeAfterMinutes = integer(draft.absenceFinalizeAfterMinutes, 'El cierre de ausencia', pendingCloseAfterMinutes, 2_880);
  const days = draft.days.map((day, index) => {
    const isoWeekday = integer(day.isoWeekday, `Día ${index + 1}`, 1, 7);
    if (!day.isWorkingDay) {
      return {
        isoWeekday,
        isWorkingDay: false,
        startMinute: null,
        endMinute: null,
        endDayOffset: 0,
        expectedBreakMinutes: 0,
      };
    }
    const startMinute = timeToMinute(day.startTime, `Inicio de ${ISO_WEEKDAYS[index]?.label || `día ${index + 1}`}`);
    const endMinute = timeToMinute(day.endTime, `Fin de ${ISO_WEEKDAYS[index]?.label || `día ${index + 1}`}`);
    const endDayOffset = Number(day.endDayOffset) === 1 ? 1 : 0;
    const duration = endMinute + (endDayOffset * 1_440) - startMinute;
    if (duration < 1 || duration > 1_440) {
      throw new Error(`${ISO_WEEKDAYS[index]?.label || `Día ${index + 1}`}: la salida debe ser posterior al ingreso.`);
    }
    const expectedBreakMinutes = integer(day.expectedBreakMinutes, 'La pausa', 0, 720);
    if (expectedBreakMinutes >= duration) {
      throw new Error(`${ISO_WEEKDAYS[index]?.label || `Día ${index + 1}`}: la pausa debe ser menor que la jornada.`);
    }
    return {
      isoWeekday,
      isWorkingDay: true,
      startMinute,
      endMinute,
      endDayOffset,
      expectedBreakMinutes,
    };
  });
  if (new Set(days.map((day) => day.isoWeekday)).size !== 7) {
    throw new Error('Cada día de la semana debe aparecer una sola vez.');
  }
  return {
    scheduleId: draft.scheduleId || null,
    expectedRevision: Number(draft.expectedRevision) || 0,
    name,
    effectiveFrom,
    timezone,
    earlyCheckInMinutes: integer(draft.earlyCheckInMinutes, 'La anticipación de ingreso', 0, 720),
    lateToleranceMinutes,
    latePolicy: draft.latePolicy === 'EXCLUDE_GRACE' ? 'EXCLUDE_GRACE' : 'FULL_FROM_SCHEDULE',
    noShowAfterMinutes,
    pendingCloseAfterMinutes,
    absenceFinalizeAfterMinutes,
    workerIds: [...new Set((draft.workerIds || []).map(String).filter(Boolean))].sort(),
    days,
  };
}
