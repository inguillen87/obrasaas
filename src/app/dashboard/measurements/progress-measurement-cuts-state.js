import { civilFortnightForDate } from './progress-measurements-state.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,13})\.\d{4}$/;
const READINESS_STATES = new Set(['REVIEW_PENDING', 'EMPTY', 'READY', 'UP_TO_DATE', 'STALE']);

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function taskFromLine(line) {
  const value = record(line);
  const task = record(value.task);
  const id = String(task.id || '').trim();
  if (!id) return null;
  return {
    id,
    code: typeof task.code === 'string' ? task.code : null,
    title: typeof task.title === 'string' && task.title.trim()
      ? task.title
      : 'Tarea sin título',
    revision: Number.isSafeInteger(task.revision) ? task.revision : null,
  };
}

function measurementFromLine(line) {
  const value = record(line);
  return value.approvedMeasurement && typeof value.approvedMeasurement === 'object'
    ? value.approvedMeasurement
    : null;
}

function normalizedLine(line, source) {
  const value = record(line);
  const task = taskFromLine(value);
  if (!task) return null;
  const measurement = measurementFromLine(value);
  return {
    source,
    task,
    measurement,
    absent: measurement === null,
    snapshotToken: typeof value.snapshotToken === 'string' ? value.snapshotToken : null,
  };
}

export function cutCandidateRows(snapshot) {
  const candidate = record(snapshot?.candidate);
  const latestCut = record(snapshot?.latestCut);
  const currentLines = Array.isArray(candidate.lines) ? candidate.lines : [];
  const frozenLines = Array.isArray(latestCut.lines) ? latestCut.lines : [];
  const current = currentLines.map((line) => normalizedLine(line, 'candidate')).filter(Boolean);
  const frozen = frozenLines.map((line) => normalizedLine(line, 'latestCut')).filter(Boolean);
  const currentByTask = new Map();
  const frozenByTask = new Map();
  for (const line of current) {
    if (!currentByTask.has(line.task.id)) currentByTask.set(line.task.id, line);
  }
  for (const line of frozen) {
    if (!frozenByTask.has(line.task.id)) frozenByTask.set(line.task.id, line);
  }
  const taskIds = [...new Set([...currentByTask.keys(), ...frozenByTask.keys()])];
  const rows = taskIds.map((taskId) => {
    const candidateLine = currentByTask.get(taskId) || null;
    const latestCutLine = frozenByTask.get(taskId) || null;
    let change = 'UNCHANGED';
    if (candidateLine && !latestCutLine) change = 'ADDED';
    else if (!candidateLine && latestCutLine) change = 'REMOVED';
    else if (!cutLinesAreEqual(candidateLine, latestCutLine)) change = 'CHANGED';
    return {
      task: candidateLine?.task || latestCutLine.task,
      candidate: candidateLine,
      latestCut: latestCutLine,
      change,
    };
  });
  if (
    String(snapshot?.readiness?.state || '').toUpperCase() === 'STALE'
    && rows.length > 0
    && rows.every((row) => row.change === 'UNCHANGED')
  ) {
    return rows.map((row) => ({ ...row, change: 'REVIEW_REQUIRED' }));
  }
  return rows;
}

function cutLinesAreEqual(left, right) {
  if (!left || !right) return false;
  return (
    SHA256_PATTERN.test(left.snapshotToken)
    && SHA256_PATTERN.test(right.snapshotToken)
    && left.snapshotToken === right.snapshotToken
  );
}

function validSnapshotLine(line) {
  const value = record(line);
  const task = record(value.task);
  if (
    !['MEASURED', 'MISSING'].includes(value.state)
    || !SHA256_PATTERN.test(value.snapshotToken)
    || typeof task.id !== 'string'
    || !task.id
    || (task.code !== null && typeof task.code !== 'string')
    || typeof task.title !== 'string'
    || !task.title
    || !Number.isSafeInteger(task.revision)
    || task.revision < 0
  ) return false;
  if (value.state === 'MISSING') return value.approvedMeasurement === null;
  const measurement = record(value.approvedMeasurement);
  return (
    typeof measurement.id === 'string'
    && measurement.id.length > 0
    && Number.isSafeInteger(measurement.revision)
    && measurement.revision >= 1
    && typeof measurement.unit === 'string'
    && QUANTITY_PATTERN.test(measurement.baselineQuantity)
    && QUANTITY_PATTERN.test(measurement.executedQuantity)
    && QUANTITY_PATTERN.test(measurement.cumulativeQuantity)
    && typeof measurement.method === 'string'
    && typeof measurement.rationale === 'string'
    && Number.isSafeInteger(measurement.evidenceCount)
    && measurement.evidenceCount >= 1
    && !Number.isNaN(new Date(measurement.approvedAt).getTime())
  );
}

function validSnapshotLines(lines, counts) {
  if (!Array.isArray(lines) || lines.length !== counts.taskCount) return false;
  const taskIds = new Set();
  const tokens = new Set();
  let measured = 0;
  let missing = 0;
  for (const line of lines) {
    if (!validSnapshotLine(line)) return false;
    if (taskIds.has(line.task.id) || tokens.has(line.snapshotToken)) return false;
    taskIds.add(line.task.id);
    tokens.add(line.snapshotToken);
    if (line.state === 'MEASURED') measured += 1;
    else missing += 1;
  }
  return measured === counts.measuredLineCount && missing === counts.missingLineCount;
}

function validCounts(value) {
  return (
    Number.isSafeInteger(value?.taskCount)
    && value.taskCount >= 0
    && Number.isSafeInteger(value?.measuredLineCount)
    && value.measuredLineCount >= 0
    && Number.isSafeInteger(value?.missingLineCount)
    && value.missingLineCount >= 0
    && value.taskCount === value.measuredLineCount + value.missingLineCount
  );
}

export function progressMeasurementCutSnapshotIsUsable(snapshot, {
  periodStart,
  timeZone,
} = {}) {
  const value = record(snapshot);
  const period = record(value.requestedPeriod);
  const readiness = record(value.readiness);
  const candidate = record(value.candidate);
  const project = record(value.project);
  let expectedPeriod;
  try {
    expectedPeriod = civilFortnightForDate(periodStart);
    civilFortnightForDate(value.tenantToday);
  } catch {
    return false;
  }
  if (
    value.executionAllowed !== false
    || period.start !== expectedPeriod.start
    || period.end !== expectedPeriod.end
    || period.end >= value.tenantToday
    || typeof project.id !== 'string'
    || !project.id
    || typeof project.name !== 'string'
    || !project.name
    || project.timeZone !== timeZone
    || !READINESS_STATES.has(readiness.state)
    || typeof readiness.candidateReady !== 'boolean'
    || typeof readiness.canSeal !== 'boolean'
    || typeof readiness.reviewPending !== 'boolean'
    || readiness.periodClosed !== true
    || !validCounts(readiness)
    || !validCounts(candidate)
    || readiness.taskCount !== candidate.taskCount
    || readiness.measuredLineCount !== candidate.measuredLineCount
    || readiness.missingLineCount !== candidate.missingLineCount
    || !SHA256_PATTERN.test(candidate.token)
    || !validSnapshotLines(candidate.lines, candidate)
    || (candidate.expectedHeadCutId !== null && typeof candidate.expectedHeadCutId !== 'string')
    || (readiness.canSeal && !readiness.candidateReady)
  ) return false;
  const latestCut = value.latestCut;
  const head = value.head;
  if (!latestCut) {
    return head === null && candidate.expectedHeadCutId === null;
  }
  if (
    !head
    || typeof latestCut.id !== 'string'
    || !latestCut.id
    || head.currentCutId !== latestCut.id
    || candidate.expectedHeadCutId !== latestCut.id
    || !Number.isSafeInteger(head.revision)
    || head.revision < 1
    || latestCut.version !== head.revision
    || latestCut.period?.start !== period.start
    || latestCut.period?.end !== period.end
    || !validCounts(latestCut)
    || !validSnapshotLines(latestCut.lines, latestCut)
    || !SHA256_PATTERN.test(latestCut.candidateToken)
    || latestCut.integrity?.algorithm !== 'SHA-256'
    || !SHA256_PATTERN.test(latestCut.integrity?.digest)
    || (latestCut.previousCutId !== null && typeof latestCut.previousCutId !== 'string')
    || typeof latestCut.stale !== 'boolean'
  ) return false;
  return true;
}

export function cutCandidateCounts(snapshot) {
  const rows = cutCandidateRows(snapshot);
  let measured = 0;
  let missing = 0;
  for (const row of rows) {
    if (row.candidate?.measurement) measured += 1;
    else missing += 1;
  }
  return {
    taskCount: rows.length,
    measured,
    missing,
  };
}

export function latestClosedFortnightDate(tenantToday) {
  const current = civilFortnightForDate(tenantToday);
  const [yearText, monthText, dayText] = tenantToday.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (day > 15) return `${yearText}-${monthText}-15`;
  const previousMonthEnd = new Date(Date.UTC(year, month - 1, 0));
  const previousYear = String(previousMonthEnd.getUTCFullYear()).padStart(4, '0');
  const previousMonth = String(previousMonthEnd.getUTCMonth() + 1).padStart(2, '0');
  const previousDay = String(previousMonthEnd.getUTCDate()).padStart(2, '0');
  const latestClosed = `${previousYear}-${previousMonth}-${previousDay}`;
  if (latestClosed >= current.start) {
    throw new Error('No se pudo determinar una quincena civil cerrada.');
  }
  return latestClosed;
}

export function inactiveProgressMeasurementCutLoadState(snapshot) {
  return snapshot ? 'ready' : 'idle';
}

export function buildProgressMeasurementCutPayload(snapshot, periodDate) {
  const period = civilFortnightForDate(periodDate);
  if (snapshot?.requestedPeriod?.start !== period.start) {
    throw new Error('La quincena cambió mientras preparabas el corte. Actualizá antes de sellar.');
  }
  if (snapshot?.readiness?.canSeal !== true) {
    throw new Error('La fuente autoritativa todavía no habilita sellar este corte.');
  }
  const expectedHeadCutId = snapshot?.candidate?.expectedHeadCutId
    ?? snapshot?.head?.currentCutId
    ?? snapshot?.latestCut?.id
    ?? null;
  if (expectedHeadCutId !== null && typeof expectedHeadCutId !== 'string') {
    throw new Error('La cabecera del corte no es válida. Actualizá antes de sellar.');
  }
  const expectedCandidateToken = snapshot?.candidate?.token;
  if (
    typeof expectedCandidateToken !== 'string'
    || !SHA256_PATTERN.test(expectedCandidateToken)
  ) {
    throw new Error('La composición candidata no tiene un token válido. Actualizá antes de sellar.');
  }
  return {
    periodDate: period.start,
    expectedHeadCutId,
    expectedCandidateToken,
  };
}

export function progressMeasurementCutPayloadKey(payload) {
  return JSON.stringify({
    periodDate: payload.periodDate,
    expectedHeadCutId: payload.expectedHeadCutId,
    expectedCandidateToken: payload.expectedCandidateToken,
  });
}

export function progressMeasurementCutAttempt(previous, payload, createUuid) {
  const payloadKey = progressMeasurementCutPayloadKey(payload);
  if (previous?.payloadKey === payloadKey) return previous;
  return {
    payloadKey,
    operationKey: `progress-measurement-cut-${createUuid()}`,
    body: payload,
    expectedHeadCutId: payload.expectedHeadCutId,
    expectedCandidateToken: payload.expectedCandidateToken,
    periodDate: payload.periodDate,
    state: 'READY',
  };
}

export function uncertainProgressMeasurementCutAttempt(attempt) {
  return attempt ? { ...attempt, state: 'UNCERTAIN' } : null;
}

export function shouldApplyProgressMeasurementCutSnapshot({
  currentPeriodStart,
  currentSequence,
  requestPeriodStart,
  requestSequence,
  snapshot,
}) {
  return (
    requestSequence === currentSequence
    && requestPeriodStart === currentPeriodStart
    && snapshot?.requestedPeriod?.start === requestPeriodStart
    && (!snapshot?.latestCut || snapshot.latestCut.period?.start === requestPeriodStart)
  );
}

export function progressMeasurementCutSnapshotConfirmsAttempt(snapshot, attempt) {
  if (
    !snapshot
    || snapshot.requestedPeriod?.start !== attempt?.periodDate
    || snapshot.latestCut?.period?.start !== attempt.periodDate
    || typeof snapshot.latestCut?.id !== 'string'
  ) return false;
  return (
    snapshot.latestCut.id !== (attempt.expectedHeadCutId || null)
    && snapshot.latestCut.previousCutId === (attempt.expectedHeadCutId || null)
    && snapshot.latestCut.candidateToken === attempt.expectedCandidateToken
    && snapshot.head?.currentCutId === snapshot.latestCut.id
  );
}

export function cutFreshness(snapshot) {
  if (!snapshot?.latestCut) return 'NOT_SEALED';
  const state = String(snapshot?.readiness?.state || '').toUpperCase();
  if (['UP_TO_DATE', 'CURRENT', 'SEALED'].includes(state)) return 'UP_TO_DATE';
  if (['STALE', 'READY', 'CHANGED'].includes(state)) return 'STALE';
  return 'UNKNOWN';
}
