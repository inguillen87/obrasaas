const DECIMAL_INPUT_PATTERN = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DECIMAL_SCALE = 10_000n;

export const MEASUREMENT_UNITS = Object.freeze([
  ['M', 'm'],
  ['M2', 'm²'],
  ['M3', 'm³'],
  ['KG', 'kg'],
  ['T', 't'],
  ['L', 'l'],
  ['UNIT', 'unidad'],
  ['HOUR', 'hora'],
  ['DAY', 'día'],
  ['LOT', 'lote'],
]);

export const MEASUREMENT_METHODS = Object.freeze([
  ['DIRECT_COUNT', 'Conteo directo'],
  ['DIMENSIONAL_CALCULATION', 'Cálculo dimensional'],
  ['INSTRUMENT_READING', 'Lectura de instrumento'],
  ['OTHER_REVIEWED', 'Otro método revisable'],
]);

const UNIT_VALUES = new Set(MEASUREMENT_UNITS.map(([value]) => value));
const METHOD_VALUES = new Set(MEASUREMENT_METHODS.map(([value]) => value));

export class ProgressMeasurementFormError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ProgressMeasurementFormError';
    this.field = field;
  }
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function requiredText(value, field, label, max) {
  if (typeof value !== 'string') {
    throw new ProgressMeasurementFormError(`${label} es obligatorio.`, field);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new ProgressMeasurementFormError(
      `${label} es obligatorio y admite hasta ${max} caracteres.`,
      field,
    );
  }
  return normalized;
}

function decimalParts(value, field, label, { allowZero = true } = {}) {
  if (
    typeof value !== 'string'
    || value !== value.trim()
    || !DECIMAL_INPUT_PATTERN.test(value)
  ) {
    throw new ProgressMeasurementFormError(
      `${label} debe ser un decimal exacto, sin coma, con hasta 4 decimales.`,
      field,
    );
  }
  const [whole, fraction = ''] = value.split('.');
  const scaled = (BigInt(whole) * DECIMAL_SCALE) + BigInt(fraction.padEnd(4, '0'));
  if (!allowZero && scaled === 0n) {
    throw new ProgressMeasurementFormError(`${label} debe ser mayor que cero.`, field);
  }
  return scaled;
}

export function canonicalDecimal(value, options = {}) {
  const scaled = decimalParts(value, options.field, options.label || 'La cantidad', options);
  const whole = scaled / DECIMAL_SCALE;
  const fraction = String(scaled % DECIMAL_SCALE).padStart(4, '0');
  return `${whole}.${fraction}`;
}

export function civilFortnightForDate(value) {
  const match = typeof value === 'string' ? DATE_KEY_PATTERN.exec(value) : null;
  if (!match) {
    throw new ProgressMeasurementFormError('Elegí una fecha civil válida.', 'periodDate');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > monthDays) {
    throw new ProgressMeasurementFormError('Elegí una fecha civil válida.', 'periodDate');
  }
  const firstHalf = day <= 15;
  const startDay = firstHalf ? 1 : 16;
  const endDay = firstHalf ? 15 : monthDays;
  const prefix = `${match[1]}-${match[2]}`;
  const start = `${prefix}-${String(startDay).padStart(2, '0')}`;
  const end = `${prefix}-${String(endDay).padStart(2, '0')}`;
  return {
    start,
    end,
    label: `${firstHalf ? '1.ª' : '2.ª'} quincena · ${start} a ${end}`,
  };
}

export function initialFortnightDate(today) {
  return civilFortnightForDate(today).start;
}

export function measurementBaselineIsRequired(snapshot) {
  const approved = record(snapshot?.approved);
  return !approved.baselineQuantity;
}

export function authoritativeMeasurementUnit(snapshot) {
  const approved = record(snapshot?.approved);
  return approved.unit || null;
}

export function authoritativeBaselineQuantity(snapshot) {
  const approved = record(snapshot?.approved);
  return approved.baselineQuantity || null;
}

export function buildProgressMeasurementPayload(form, snapshot) {
  const taskId = requiredText(form?.taskId, 'taskId', 'La tarea', 190);
  if (snapshot?.task?.id !== taskId) {
    throw new ProgressMeasurementFormError(
      'La tarea cambió mientras preparabas la medición. Volvé a cargarla.',
      'taskId',
    );
  }
  const period = civilFortnightForDate(form?.periodDate);
  if (snapshot?.requestedPeriod?.start !== period.start) {
    throw new ProgressMeasurementFormError(
      'La quincena cambió mientras preparabas la medición. Volvé a cargarla.',
      'periodDate',
    );
  }
  const initialize = measurementBaselineIsRequired(snapshot);
  const unit = initialize ? form?.unit : authoritativeMeasurementUnit(snapshot);
  if (!UNIT_VALUES.has(unit)) {
    throw new ProgressMeasurementFormError('Elegí una unidad técnica válida.', 'unit');
  }
  const baselineSource = initialize
    ? form?.baselineQuantity
    : authoritativeBaselineQuantity(snapshot);
  const baselineQuantity = canonicalDecimal(baselineSource, {
    allowZero: false,
    field: 'baselineQuantity',
    label: 'La cantidad base',
  });
  const executedQuantity = canonicalDecimal(form?.executedQuantity, {
    allowZero: false,
    field: 'executedQuantity',
    label: 'La cantidad ejecutada',
  });
  if (!METHOD_VALUES.has(form?.method)) {
    throw new ProgressMeasurementFormError('Elegí un método de medición válido.', 'method');
  }
  const rationale = requiredText(
    form?.rationale,
    'rationale',
    'El fundamento técnico',
    1_000,
  ).replace(/\s+/g, ' ');
  if (rationale.length < 10) {
    throw new ProgressMeasurementFormError(
      'El fundamento técnico debe tener al menos 10 caracteres.',
      'rationale',
    );
  }
  const evidenceIds = Array.isArray(form?.evidenceIds)
    ? [...new Set(form.evidenceIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];
  if (evidenceIds.length < 1 || evidenceIds.length > 10) {
    throw new ProgressMeasurementFormError(
      'Seleccioná entre 1 y 10 evidencias aprobadas.',
      'evidenceIds',
    );
  }
  if (evidenceIds.some((id) => id.length > 190)) {
    throw new ProgressMeasurementFormError('Una evidencia no es válida.', 'evidenceIds');
  }
  return {
    taskId,
    periodDate: period.start,
    unit,
    baselineQuantity,
    executedQuantity,
    method: form.method,
    rationale,
    evidenceIds,
    expectedHeadId: snapshot?.head?.latestMeasurementId || null,
  };
}

export function progressMeasurementPayloadKey(payload) {
  return JSON.stringify({
    taskId: payload.taskId,
    periodDate: payload.periodDate,
    unit: payload.unit,
    baselineQuantity: payload.baselineQuantity,
    executedQuantity: payload.executedQuantity,
    method: payload.method,
    rationale: payload.rationale,
    evidenceIds: [...payload.evidenceIds],
    expectedHeadId: payload.expectedHeadId,
  });
}

export function progressMeasurementAttempt(previous, payload, createUuid) {
  const payloadKey = progressMeasurementPayloadKey(payload);
  if (previous?.payloadKey === payloadKey) return previous;
  const uuid = createUuid();
  return {
    payloadKey,
    operationKey: `progress-measurement-${uuid}`,
    body: payload,
    expectedHeadId: payload.expectedHeadId,
    taskId: payload.taskId,
    createdAt: new Date().toISOString(),
    state: 'READY',
  };
}

export function uncertainProgressMeasurementAttempt(attempt) {
  return attempt ? { ...attempt, state: 'UNCERTAIN' } : null;
}

export function shouldApplyMeasurementSnapshot({
  currentPeriodStart,
  currentSequence,
  currentTaskId,
  requestPeriodStart,
  requestSequence,
  requestTaskId,
  snapshot,
}) {
  return (
    requestSequence === currentSequence
    && requestTaskId === currentTaskId
    && (!requestPeriodStart || requestPeriodStart === currentPeriodStart)
    && snapshot?.task?.id === requestTaskId
    && (
      !requestPeriodStart
      || snapshot?.requestedPeriod?.start === requestPeriodStart
    )
    && (
      !requestPeriodStart
      || !snapshot?.head
      || snapshot.head.period?.start === requestPeriodStart
    )
  );
}

export function mergeMeasurementHistoryPage(current, incoming, expected) {
  if (
    !current?.task?.id
    || current.task.id !== expected?.taskId
    || incoming?.task?.id !== expected?.taskId
    || current?.head?.id !== expected?.headId
    || incoming?.head?.id !== expected?.headId
  ) return current;
  const byId = new Map();
  for (const measurement of [...(current.measurements || []), ...(incoming.measurements || [])]) {
    if (measurement?.id && !byId.has(measurement.id)) byId.set(measurement.id, measurement);
  }
  return {
    ...current,
    measurements: [...byId.values()],
    nextCursor: incoming.nextCursor || null,
  };
}

function sameCanonicalDecimal(left, right) {
  try {
    return canonicalDecimal(left) === canonicalDecimal(right);
  } catch {
    return false;
  }
}

export function measurementMatchesAttempt(measurement, attempt) {
  const body = attempt?.body;
  if (!body || !measurement) return false;
  const measurementPeriod = record(measurement.period);
  const evidenceIds = (measurement.evidence || []).map((evidence) => evidence.id).sort();
  const expectedEvidenceIds = [...body.evidenceIds].sort();
  return (
    measurement.taskId === body.taskId
    && measurementPeriod.start === body.periodDate
    && measurement.unit === body.unit
    && sameCanonicalDecimal(measurement.baselineQuantity, body.baselineQuantity)
    && sameCanonicalDecimal(measurement.executedQuantity, body.executedQuantity)
    && measurement.method === body.method
    && measurement.rationale === body.rationale
    && JSON.stringify(evidenceIds) === JSON.stringify(expectedEvidenceIds)
  );
}

export function snapshotConfirmsAttempt(snapshot, attempt) {
  if (!snapshot || snapshot.task?.id !== attempt?.taskId) return false;
  if (
    (snapshot.head?.latestMeasurementId || null)
    === (attempt.expectedHeadId || null)
  ) return false;
  return (snapshot.measurements || []).some((measurement) => (
    measurementMatchesAttempt(measurement, attempt)
  ));
}

export function exactMeasurementSummary(snapshot) {
  const baselineSource = authoritativeBaselineQuantity(snapshot);
  const approvedSource = snapshot?.approved?.quantity || '0.0000';
  try {
    const baseline = decimalParts(baselineSource, null, 'La cantidad base', { allowZero: false });
    const approved = decimalParts(approvedSource, null, 'El acumulado aprobado');
    const inconsistent = approved > baseline;
    const remaining = inconsistent ? 0n : baseline - approved;
    const basisPoints = (approved * 1_000_000n) / baseline;
    return {
      baseline: canonicalDecimal(baselineSource, { allowZero: false }),
      approved: canonicalDecimal(approvedSource),
      remaining: `${remaining / DECIMAL_SCALE}.${String(remaining % DECIMAL_SCALE).padStart(4, '0')}`,
      percent: `${basisPoints / 10_000n}.${String(basisPoints % 10_000n).padStart(4, '0')}`,
      inconsistent,
    };
  } catch {
    return null;
  }
}

export function apiErrorMessage(payload, fallback) {
  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }
  return fallback;
}
