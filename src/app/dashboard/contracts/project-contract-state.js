const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const CAPABILITY_REASON_PATTERN = /^PROJECT_CONTRACT_[A-Z0-9_]{1,120}$/;
const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const QUANTITY_INPUT_PATTERN = /^\d+(?:[.,]\d{0,4})?$/;
const MAX_SIGNED_BIGINT = 9_223_372_036_854_775_807n;

export const CONTRACT_UNIT_OPTIONS = Object.freeze([
  ['M', 'Metro'],
  ['M2', 'Metro cuadrado'],
  ['M3', 'Metro cúbico'],
  ['KG', 'Kilogramo'],
  ['T', 'Tonelada'],
  ['L', 'Litro'],
  ['UNIT', 'Unidad'],
  ['HOUR', 'Hora'],
  ['DAY', 'Día'],
  ['LOT', 'Lote'],
]);

export const CONTRACT_DECISIONS = Object.freeze(['APPROVED', 'REJECTED']);
export const CONTRACT_LINE_STATES = Object.freeze(['VALUED', 'NO_CLAIM']);
export const CONTRACT_READINESS = Object.freeze([
  'AUTHORITY_REQUIRED',
  'AUTHORITY_REVIEW_PENDING',
  'CONTRACT_REQUIRED',
  'CONTRACT_REVIEW_PENDING',
  'ACTIVE',
]);

const UNIT_CODES = new Set(CONTRACT_UNIT_OPTIONS.map(([code]) => code));
const READINESS_CODES = new Set(CONTRACT_READINESS);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isPlainObject(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function isNullableIdentifier(value) {
  return value === null || (typeof value === 'string' && SAFE_IDENTIFIER.test(value));
}

function isRevision(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canonicalIntegerString(value, { positive = false } = {}) {
  const input = trimText(value);
  if (!/^\d+$/.test(input)) return null;
  const canonical = input.replace(/^0+(?=\d)/, '');
  if (positive && !POSITIVE_INTEGER_PATTERN.test(canonical)) return null;
  return canonical;
}

export function normalizePositiveMinorUnitsInput(value) {
  const canonical = canonicalIntegerString(value, { positive: true });
  if (canonical === null || canonical.length > 19) return null;
  return BigInt(canonical) <= MAX_SIGNED_BIGINT ? canonical : null;
}

export function normalizePositiveQuantityInput(value) {
  const input = trimText(value);
  if (!QUANTITY_INPUT_PATTERN.test(input)) return null;
  const [integerPart, fractionPart = ''] = input.replace(',', '.').split('.');
  const integer = integerPart.replace(/^0+(?=\d)/, '');
  if (integer.length > 14) return null;
  const fraction = fractionPart.padEnd(4, '0');
  if (fraction.length !== 4) return null;
  if (BigInt(`${integer}${fraction}`) <= 0n) return null;
  return `${integer}.${fraction}`;
}

export function formatMinorUnits(value, currencyCode, currencyMinorUnits) {
  const canonical = canonicalIntegerString(value);
  if (canonical === null || !Number.isSafeInteger(currencyMinorUnits)) return 'Importe no disponible';
  if (currencyMinorUnits < 0 || currencyMinorUnits > 6) return 'Importe no disponible';
  const padded = canonical.padStart(currencyMinorUnits + 1, '0');
  const integerLength = padded.length - currencyMinorUnits;
  const integer = padded.slice(0, integerLength).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fraction = currencyMinorUnits > 0 ? `,${padded.slice(integerLength)}` : '';
  const code = typeof currencyCode === 'string' && /^[A-Z]{3}$/.test(currencyCode)
    ? currencyCode
    : 'MON';
  return `${code} ${integer}${fraction}`;
}

export function createProjectContractDraft(tasks, effectiveFrom) {
  return {
    contractReference: '',
    title: '',
    counterpartyLabel: '',
    effectiveFrom: CIVIL_DATE_PATTERN.test(effectiveFrom || '') ? effectiveFrom : '',
    currencyCode: 'ARS',
    retentionBps: '0',
    lines: (Array.isArray(tasks) ? tasks : []).map((task) => ({
      taskId: task.id,
      state: 'UNSET',
      unitCode: '',
      baseQuantity: '',
      contractAmountMinor: '',
      noClaimReason: '',
    })),
  };
}

export function updateProjectContractLine(lines, taskId, patch) {
  return lines.map((line) => (
    line.taskId === taskId ? { ...line, ...patch } : line
  ));
}

function textWithin(value, max) {
  const text = trimText(value);
  return text && text.length <= max && !/[\u0000-\u001f\u007f]/.test(text) ? text : null;
}

function storedTextIsUsable(value, max) {
  return typeof value === 'string'
    && value === value.trim()
    && textWithin(value, max) === value;
}

function civilDateIsUsable(value) {
  if (typeof value !== 'string' || !CIVIL_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function normalizeRetentionBps(value) {
  const canonical = canonicalIntegerString(value);
  if (canonical === null) return null;
  const exact = BigInt(canonical);
  if (exact > 10_000n) return null;
  return Number.parseInt(canonical, 10);
}

export function buildProjectContractVersionPayload({ draft, snapshot, tasks }) {
  const errors = [];
  const fieldErrors = {};
  const authorityVersionId = snapshot?.currentAuthority?.id;
  if (!SAFE_IDENTIFIER.test(authorityVersionId || '')) {
    errors.push('No hay una autoridad contractual aprobada para preparar la SOV.');
  }
  if (!isRevision(snapshot?.authorityRevision) || snapshot.authorityRevision < 1) {
    errors.push('La revisión de autoridades no es utilizable.');
  }
  if (!isRevision(snapshot?.headRevision)) {
    errors.push('La revisión contractual no es utilizable.');
  }

  const contractReference = textWithin(draft?.contractReference, 120);
  const title = textWithin(draft?.title, 240);
  const counterpartyLabel = textWithin(draft?.counterpartyLabel, 240);
  if (!contractReference) fieldErrors.contractReference = 'Ingresá una referencia de hasta 120 caracteres.';
  if (!title) fieldErrors.title = 'Ingresá un título de hasta 240 caracteres.';
  if (!counterpartyLabel) fieldErrors.counterpartyLabel = 'Ingresá una contraparte de hasta 240 caracteres.';
  if (!civilDateIsUsable(draft?.effectiveFrom)) {
    fieldErrors.effectiveFrom = 'Elegí una fecha civil válida.';
  }
  if (!['ARS', 'USD'].includes(draft?.currencyCode)) {
    fieldErrors.currencyCode = 'Elegí ARS o USD.';
  }
  const retentionBps = normalizeRetentionBps(draft?.retentionBps);
  if (retentionBps === null) fieldErrors.retentionBps = 'Usá un entero entre 0 y 10000 bps.';

  const taskRows = Array.isArray(tasks) ? tasks : [];
  const draftLines = Array.isArray(draft?.lines) ? draft.lines : [];
  const lineByTask = new Map(draftLines.map((line) => [line.taskId, line]));
  const taskIds = new Set(taskRows.map((task) => task.id));
  if (taskRows.length === 0 || lineByTask.size !== taskRows.length) {
    errors.push('La SOV debe clasificar exactamente todas las tareas canónicas.');
  }
  if (draftLines.some((line) => !taskIds.has(line.taskId))) {
    errors.push('La SOV contiene una tarea fuera del catálogo canónico cargado.');
  }

  const lines = [];
  for (const task of taskRows) {
    const line = lineByTask.get(task.id);
    if (!line || !CONTRACT_LINE_STATES.includes(line.state)) {
      fieldErrors[`line:${task.id}`] = 'Marcá la tarea como valuada o sin reclamo.';
      continue;
    }
    if (line.state === 'VALUED') {
      const baseQuantity = normalizePositiveQuantityInput(line.baseQuantity);
      const contractAmountMinor = normalizePositiveMinorUnitsInput(line.contractAmountMinor);
      if (!UNIT_CODES.has(line.unitCode) || !baseQuantity || !contractAmountMinor) {
        fieldErrors[`line:${task.id}`] = 'Completá unidad, cantidad positiva y monto entero positivo.';
        continue;
      }
      lines.push({
        taskId: task.id,
        state: 'VALUED',
        unitCode: line.unitCode,
        baseQuantity,
        contractAmountMinor,
        noClaimReason: null,
      });
      continue;
    }
    const noClaimReason = textWithin(line.noClaimReason, 1_000);
    if (!noClaimReason) {
      fieldErrors[`line:${task.id}`] = 'Fundamentá por qué esta tarea queda sin reclamo.';
      continue;
    }
    lines.push({
      taskId: task.id,
      state: 'NO_CLAIM',
      unitCode: null,
      baseQuantity: null,
      contractAmountMinor: null,
      noClaimReason,
    });
  }

  if (lines.length > 0 && !lines.some((line) => line.state === 'VALUED')) {
    errors.push('Al menos una tarea debe quedar valuada.');
  }
  if (Object.keys(fieldErrors).length > 0 || errors.length > 0) {
    return { ok: false, errors, fieldErrors };
  }
  return {
    ok: true,
    payload: {
      authorityVersionId,
      expectedAuthorityRevision: snapshot.authorityRevision,
      expectedCurrentVersionId: snapshot.currentContract?.id || null,
      expectedHeadRevision: snapshot.headRevision,
      contractReference,
      title,
      counterpartyLabel,
      effectiveFrom: draft.effectiveFrom,
      currencyCode: draft.currencyCode,
      currencyMinorUnits: 2,
      retentionBps,
      roundingPolicyVersion: 'CERT_RETENTION_HALF_UP_V1',
      adjustmentPolicyVersion: 'NONE',
      lines,
    },
  };
}

export function projectContractMutationIsAmbiguous(error) {
  return (
    error?.malformedSuccess === true
    || !Number.isInteger(error?.status)
    || error.status >= 500
    || error.status === 408
    || error.status === 425
  );
}

function isMutationReceipt(value, resourceKey, resourceFields) {
  return hasExactKeys(value, [resourceKey, 'head', 'executionAllowed', 'replayed'])
    && value.executionAllowed === false
    && typeof value.replayed === 'boolean'
    && hasExactKeys(value.head, ['revision'])
    && Number.isSafeInteger(value.head.revision)
    && value.head.revision >= 1
    && hasExactKeys(value[resourceKey], resourceFields)
    && SAFE_IDENTIFIER.test(value[resourceKey].id || '');
}

export function projectContractMutationReceiptIsUsable(value, kind) {
  if (kind === 'AUTHORITY_PROPOSAL') {
    return isMutationReceipt(value, 'authority', [
      'id', 'version', 'integrityDigest', 'preparedByMembershipId',
    ])
      && Number.isSafeInteger(value.authority.version)
      && value.authority.version >= 1
      && SHA256_PATTERN.test(value.authority.integrityDigest)
      && SAFE_IDENTIFIER.test(value.authority.preparedByMembershipId || '');
  }
  if (kind === 'AUTHORITY_DECISION') {
    return isMutationReceipt(value, 'decision', [
      'id', 'authorityVersionId', 'decision', 'decidedByMembershipId',
    ])
      && SAFE_IDENTIFIER.test(value.decision.authorityVersionId || '')
      && CONTRACT_DECISIONS.includes(value.decision.decision)
      && SAFE_IDENTIFIER.test(value.decision.decidedByMembershipId || '');
  }
  if (kind === 'CONTRACT_PROPOSAL') {
    return isMutationReceipt(value, 'contract', [
      'id', 'version', 'integrityDigest', 'totalContractAmountMinor', 'preparedByMembershipId',
    ])
      && Number.isSafeInteger(value.contract.version)
      && value.contract.version >= 1
      && SHA256_PATTERN.test(value.contract.integrityDigest)
      && normalizePositiveMinorUnitsInput(value.contract.totalContractAmountMinor) !== null
      && SAFE_IDENTIFIER.test(value.contract.preparedByMembershipId || '');
  }
  if (kind === 'CONTRACT_DECISION') {
    return isMutationReceipt(value, 'decision', [
      'id', 'contractVersionId', 'decision', 'decidedByMembershipId',
    ])
      && SAFE_IDENTIFIER.test(value.decision.contractVersionId || '')
      && CONTRACT_DECISIONS.includes(value.decision.decision)
      && SAFE_IDENTIFIER.test(value.decision.decidedByMembershipId || '');
  }
  return false;
}

export function createProjectContractAttempt({
  kind,
  operationKey,
  path,
  resourceId = null,
  body,
  knownResourceIds = [],
}) {
  return Object.freeze({
    kind,
    operationKey,
    path,
    resourceId,
    body: structuredClone(body),
    knownResourceIds: Object.freeze([...new Set(knownResourceIds)]),
    state: 'PENDING',
  });
}

export function uncertainProjectContractAttempt(attempt) {
  return Object.freeze({ ...attempt, state: 'UNCERTAIN' });
}

const DECISION_KEYS = Object.freeze([
  'id', 'decision', 'reason', 'decidedByMembershipId', 'decidedAt',
]);
const AUTHORITY_KEYS = Object.freeze([
  'id', 'version', 'previousAuthorityVersionId', 'authorities', 'candidateToken',
  'integrityDigest', 'preparedByMembershipId', 'preparedAt', 'decision',
]);
const CONTRACT_KEYS = Object.freeze([
  'id', 'version', 'previousContractVersionId', 'authorityVersionId',
  'contractReference', 'title', 'counterpartyLabel', 'effectiveFrom',
  'currencyCode', 'currencyMinorUnits', 'retentionBps', 'roundingPolicyVersion',
  'adjustmentPolicyVersion', 'lineCount', 'valuedLineCount', 'noClaimLineCount',
  'totalContractAmountMinor', 'candidateToken', 'integrityDigest',
  'preparedByMembershipId', 'preparedAt', 'currentTechnicalCompatibility',
  's10BlockerCode', 'decision', 'lines',
]);
const CONTRACT_HISTORY_KEYS = Object.freeze(CONTRACT_KEYS.filter((key) => key !== 'lines'));
const CONTRACT_LINE_KEYS = Object.freeze([
  'ordinal', 'state', 'taskId', 'taskCode', 'taskTitle', 'taskRevision',
  'unitCode', 'baseQuantity', 'contractAmountMinor', 'noClaimReason',
  'technicalBasisStatusAtPrepare', 'currentTechnicalCompatibility', 'integrityDigest',
]);
const SNAPSHOT_KEYS = Object.freeze([
  'organizationId', 'projectId', 'authorityRevision', 'headRevision', 'readiness',
  'currentAuthority', 'pendingAuthority', 'currentContract', 'pendingContract',
  'historyLimit', 'authorityHistory', 'contractHistory', 'canonicalTasks',
  'capabilities', 'currentTechnicalCompatibility', 's10BlockerCode', 'executionAllowed',
]);
const COMPATIBILITY_CODES = new Set(['UNESTABLISHED', 'MATCHED', 'MISMATCHED']);
const PREPARED_BASIS_CODES = new Set(['UNESTABLISHED', 'MATCHED']);

function exactTimestampIsUsable(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

function decisionIsUsable(value) {
  return value === null || (
    hasExactKeys(value, DECISION_KEYS)
    && SAFE_IDENTIFIER.test(value.id || '')
    && CONTRACT_DECISIONS.includes(value.decision)
    && storedTextIsUsable(value.reason, 1_000)
    && SAFE_IDENTIFIER.test(value.decidedByMembershipId || '')
    && exactTimestampIsUsable(value.decidedAt)
  );
}

function authorityIsUsable(value) {
  if (value === null) return true;
  if (!hasExactKeys(value, AUTHORITY_KEYS)) return false;
  if (!hasExactKeys(value.authorities, [
    'certifierMembershipId', 'financeMembershipId', 'registrarMembershipId',
  ])) return false;
  const authorityIds = Object.values(value.authorities);
  return SAFE_IDENTIFIER.test(value.id || '')
    && Number.isSafeInteger(value.version)
    && value.version >= 1
    && isNullableIdentifier(value.previousAuthorityVersionId)
    && ((value.version === 1) === (value.previousAuthorityVersionId === null))
    && authorityIds.every((id) => SAFE_IDENTIFIER.test(id || ''))
    && new Set(authorityIds).size === 3
    && SHA256_PATTERN.test(value.candidateToken || '')
    && SHA256_PATTERN.test(value.integrityDigest || '')
    && SAFE_IDENTIFIER.test(value.preparedByMembershipId || '')
    && exactTimestampIsUsable(value.preparedAt)
    && decisionIsUsable(value.decision);
}

function contractLineIsUsable(line, index) {
  if (!hasExactKeys(line, CONTRACT_LINE_KEYS)) return false;
  if (!SAFE_IDENTIFIER.test(line.taskId || '')) return false;
  if (!CONTRACT_LINE_STATES.includes(line.state)) return false;
  if (line.ordinal !== index + 1) return false;
  if (!(line.taskCode === null || storedTextIsUsable(line.taskCode, 64))) return false;
  if (!storedTextIsUsable(line.taskTitle, 10_000)) return false;
  if (!isRevision(line.taskRevision)) return false;
  if (!SHA256_PATTERN.test(line.integrityDigest || '')) return false;
  if (line.state === 'VALUED') {
    return UNIT_CODES.has(line.unitCode)
      && normalizePositiveQuantityInput(line.baseQuantity) === line.baseQuantity
      && normalizePositiveMinorUnitsInput(line.contractAmountMinor) === line.contractAmountMinor
      && line.noClaimReason === null
      && PREPARED_BASIS_CODES.has(line.technicalBasisStatusAtPrepare)
      && COMPATIBILITY_CODES.has(line.currentTechnicalCompatibility);
  }
  return line.unitCode === null
    && line.baseQuantity === null
    && line.contractAmountMinor === null
    && storedTextIsUsable(line.noClaimReason, 1_000)
    && line.technicalBasisStatusAtPrepare === null
    && line.currentTechnicalCompatibility === null;
}

function contractIsUsable(value, { includeLines }) {
  if (value === null) return true;
  const keys = includeLines ? CONTRACT_KEYS : CONTRACT_HISTORY_KEYS;
  if (!hasExactKeys(value, keys)) return false;
  if (!SAFE_IDENTIFIER.test(value.id || '')) return false;
  if (!Number.isSafeInteger(value.version) || value.version < 1) return false;
  if (!isNullableIdentifier(value.previousContractVersionId)) return false;
  if ((value.version === 1) !== (value.previousContractVersionId === null)) return false;
  if (!SAFE_IDENTIFIER.test(value.authorityVersionId || '')) return false;
  if (!storedTextIsUsable(value.contractReference, 120)) return false;
  if (!storedTextIsUsable(value.title, 240) || !storedTextIsUsable(value.counterpartyLabel, 240)) return false;
  if (!civilDateIsUsable(value.effectiveFrom)) return false;
  if (!['ARS', 'USD'].includes(value.currencyCode) || value.currencyMinorUnits !== 2) return false;
  if (!Number.isSafeInteger(value.retentionBps) || value.retentionBps < 0 || value.retentionBps > 10_000) return false;
  if (value.roundingPolicyVersion !== 'CERT_RETENTION_HALF_UP_V1') return false;
  if (value.adjustmentPolicyVersion !== 'NONE') return false;
  if (![value.lineCount, value.valuedLineCount, value.noClaimLineCount].every(isRevision)) return false;
  if (value.lineCount < 1 || value.valuedLineCount < 1) return false;
  if (value.valuedLineCount + value.noClaimLineCount !== value.lineCount) return false;
  if (normalizePositiveMinorUnitsInput(value.totalContractAmountMinor) === null) return false;
  if (!SHA256_PATTERN.test(value.candidateToken || '') || !SHA256_PATTERN.test(value.integrityDigest || '')) return false;
  if (!SAFE_IDENTIFIER.test(value.preparedByMembershipId || '')) return false;
  if (!exactTimestampIsUsable(value.preparedAt)) return false;
  if (!COMPATIBILITY_CODES.has(value.currentTechnicalCompatibility)) return false;
  if (![null, 'CONTRACT_TECHNICAL_BASIS_MISMATCH'].includes(value.s10BlockerCode)) return false;
  if ((value.currentTechnicalCompatibility === 'MISMATCHED')
    !== (value.s10BlockerCode === 'CONTRACT_TECHNICAL_BASIS_MISMATCH')) return false;
  if (!decisionIsUsable(value.decision)) return false;
  if (!includeLines) return true;
  if (!Array.isArray(value.lines) || value.lines.length !== value.lineCount) return false;
  if (!value.lines.every(contractLineIsUsable)) return false;
  if (new Set(value.lines.map((line) => line.taskId)).size !== value.lines.length) return false;
  let total = 0n;
  for (const line of value.lines) {
    if (line.state === 'VALUED') total += BigInt(line.contractAmountMinor);
  }
  return total.toString() === value.totalContractAmountMinor;
}

function canonicalTaskIsUsable(task) {
  if (!hasExactKeys(task, ['taskId', 'taskCode', 'taskTitle', 'taskRevision', 'technicalBasis'])) return false;
  if (!SAFE_IDENTIFIER.test(task.taskId || '')) return false;
  if (!(task.taskCode === null || storedTextIsUsable(task.taskCode, 64))) return false;
  if (!storedTextIsUsable(task.taskTitle, 10_000) || !isRevision(task.taskRevision)) return false;
  if (!hasExactKeys(task.technicalBasis, ['status', 'unitCode', 'baseQuantity'])) return false;
  if (task.technicalBasis.status === 'UNESTABLISHED') {
    return task.technicalBasis.unitCode === null && task.technicalBasis.baseQuantity === null;
  }
  return task.technicalBasis.status === 'ESTABLISHED'
    && UNIT_CODES.has(task.technicalBasis.unitCode)
    && normalizePositiveQuantityInput(task.technicalBasis.baseQuantity) === task.technicalBasis.baseQuantity;
}

function capabilityIsUsable(value, { hasTarget }) {
  const keys = hasTarget
    ? ['allowed', 'reasonCode', 'expectedActorMembershipId', 'targetId']
    : ['allowed', 'reasonCode', 'expectedActorMembershipId'];
  if (!(hasExactKeys(value, keys)
    && typeof value.allowed === 'boolean'
    && (value.reasonCode === null || CAPABILITY_REASON_PATTERN.test(value.reasonCode))
    && isNullableIdentifier(value.expectedActorMembershipId)
    && (!hasTarget || isNullableIdentifier(value.targetId)))) return false;
  if (value.allowed && value.reasonCode !== null) return false;
  if (!value.allowed && value.reasonCode === null) return false;
  if (value.allowed) {
    return value.expectedActorMembershipId !== null
      && (!hasTarget || value.targetId !== null);
  }
  return true;
}

function capabilitiesAreUsable(value) {
  return hasExactKeys(value, [
    'read', 'proposeAuthority', 'decideAuthority', 'prepareContract', 'decideContract',
  ])
    && hasExactKeys(value.read, ['allowed', 'reasonCode'])
    && value.read.allowed === true
    && value.read.reasonCode === null
    && capabilityIsUsable(value.proposeAuthority, { hasTarget: false })
    && capabilityIsUsable(value.decideAuthority, { hasTarget: true })
    && capabilityIsUsable(value.prepareContract, { hasTarget: false })
    && capabilityIsUsable(value.decideContract, { hasTarget: true });
}

function historyIsDescendingAndUnique(records) {
  const ids = new Set();
  let previousVersion = Number.MAX_SAFE_INTEGER;
  for (const record of records) {
    if (ids.has(record.id) || record.version >= previousVersion) return false;
    ids.add(record.id);
    previousVersion = record.version;
  }
  return true;
}

export function projectContractSnapshotIsUsable(value, scope = {}) {
  if (!hasExactKeys(value, SNAPSHOT_KEYS)) return false;
  if (scope.organizationId && value.organizationId !== scope.organizationId) return false;
  if (scope.projectId && value.projectId !== scope.projectId) return false;
  if (!SAFE_IDENTIFIER.test(value.organizationId || '') || !SAFE_IDENTIFIER.test(value.projectId || '')) return false;
  if (!isRevision(value.authorityRevision) || !isRevision(value.headRevision)) return false;
  if (!READINESS_CODES.has(value.readiness) || value.executionAllowed !== false) return false;
  if (!authorityIsUsable(value.currentAuthority) || !authorityIsUsable(value.pendingAuthority)) return false;
  if (!contractIsUsable(value.currentContract, { includeLines: true })) return false;
  if (!contractIsUsable(value.pendingContract, { includeLines: true })) return false;
  if (value.historyLimit !== 20) return false;
  if (!Array.isArray(value.authorityHistory) || value.authorityHistory.length > value.historyLimit) return false;
  if (!value.authorityHistory.every((record) => record !== null && authorityIsUsable(record))) return false;
  if (!historyIsDescendingAndUnique(value.authorityHistory)) return false;
  if (!Array.isArray(value.contractHistory) || value.contractHistory.length > value.historyLimit) return false;
  if (!value.contractHistory.every((record) => record !== null
    && contractIsUsable(record, { includeLines: false }))) return false;
  if (!historyIsDescendingAndUnique(value.contractHistory)) return false;
  if (!Array.isArray(value.canonicalTasks) || value.canonicalTasks.length > 5_000) return false;
  if (!value.canonicalTasks.every(canonicalTaskIsUsable)) return false;
  if (new Set(value.canonicalTasks.map((task) => task.taskId)).size !== value.canonicalTasks.length) return false;
  if (!capabilitiesAreUsable(value.capabilities)) return false;
  if (!COMPATIBILITY_CODES.has(value.currentTechnicalCompatibility)) return false;
  if (![null, 'CONTRACT_TECHNICAL_BASIS_MISMATCH'].includes(value.s10BlockerCode)) return false;
  if ((value.currentTechnicalCompatibility === 'MISMATCHED')
    !== (value.s10BlockerCode === 'CONTRACT_TECHNICAL_BASIS_MISMATCH')) return false;
  const expectedCompatibility = value.currentContract?.currentTechnicalCompatibility || 'UNESTABLISHED';
  if (value.currentTechnicalCompatibility !== expectedCompatibility) return false;
  if (
    (value.readiness === 'AUTHORITY_REQUIRED' && (
      value.currentAuthority !== null || value.pendingAuthority !== null
    ))
    || (value.readiness === 'AUTHORITY_REVIEW_PENDING' && value.pendingAuthority === null)
    || (value.readiness === 'CONTRACT_REQUIRED' && (
      value.currentAuthority === null
      || value.pendingAuthority !== null
      || value.currentContract !== null
      || value.pendingContract !== null
    ))
    || (value.readiness === 'CONTRACT_REVIEW_PENDING' && (
      value.currentAuthority === null
      || value.pendingAuthority !== null
      || value.pendingContract === null
    ))
    || (value.readiness === 'ACTIVE' && (
      value.currentAuthority === null
      || value.currentContract === null
      || value.pendingAuthority !== null
      || value.pendingContract !== null
    ))
  ) return false;
  if (
    value.capabilities.decideAuthority.allowed
    && value.capabilities.decideAuthority.targetId !== value.pendingAuthority?.id
  ) return false;
  if (
    value.capabilities.decideContract.allowed
    && value.capabilities.decideContract.targetId !== value.pendingContract?.id
  ) return false;
  return true;
}

function sameAuthorityBody(authority, body) {
  return Boolean(authority)
    && authority.previousAuthorityVersionId === body.expectedCurrentAuthorityVersionId
    && authority.authorities.certifierMembershipId === body.certifierMembershipId
    && authority.authorities.financeMembershipId === body.financeMembershipId
    && authority.authorities.registrarMembershipId === body.registrarMembershipId;
}

function sameContractLine(line, expected) {
  return line.taskId === expected.taskId
    && line.state === expected.state
    && line.unitCode === expected.unitCode
    && line.baseQuantity === expected.baseQuantity
    && line.contractAmountMinor === expected.contractAmountMinor
    && line.noClaimReason === expected.noClaimReason;
}

function sameContractBody(contract, body) {
  if (!contract || contract.previousContractVersionId !== body.expectedCurrentVersionId) return false;
  const scalarFields = [
    'authorityVersionId',
    'contractReference',
    'title',
    'counterpartyLabel',
    'effectiveFrom',
    'currencyCode',
    'currencyMinorUnits',
    'retentionBps',
    'roundingPolicyVersion',
    'adjustmentPolicyVersion',
  ];
  if (scalarFields.some((field) => contract[field] !== body[field])) return false;
  if (!Array.isArray(contract.lines) || contract.lines.length !== body.lines.length) return false;
  const lineByTask = new Map(contract.lines.map((line) => [line.taskId, line]));
  return body.lines.every((line) => sameContractLine(lineByTask.get(line.taskId) || {}, line));
}

function decisionMatches(record, body) {
  return record?.decision?.decision === body.decision
    && record.decision.reason === body.reason;
}

function candidates(snapshot, currentKey, pendingKey, historyKey) {
  return [
    snapshot?.[currentKey],
    snapshot?.[pendingKey],
    ...(Array.isArray(snapshot?.[historyKey]) ? snapshot[historyKey] : []),
  ].filter(Boolean);
}

function proposalCandidates(snapshot, currentKey, pendingKey, historyKey, attempt) {
  const knownIds = new Set(attempt.knownResourceIds || []);
  return candidates(snapshot, currentKey, pendingKey, historyKey)
    .filter((record) => !knownIds.has(record.id));
}

export function projectContractSnapshotConfirmsAttempt(snapshot, attempt) {
  if (!projectContractSnapshotIsUsable(snapshot) || attempt?.state !== 'UNCERTAIN') return false;
  if (attempt.kind === 'AUTHORITY_PROPOSAL') {
    return proposalCandidates(snapshot, 'currentAuthority', 'pendingAuthority', 'authorityHistory', attempt)
      .some((authority) => sameAuthorityBody(authority, attempt.body));
  }
  if (attempt.kind === 'AUTHORITY_DECISION') {
    return candidates(snapshot, 'currentAuthority', 'pendingAuthority', 'authorityHistory')
      .some((authority) => authority.id === attempt.resourceId && decisionMatches(authority, attempt.body));
  }
  if (attempt.kind === 'CONTRACT_PROPOSAL') {
    return proposalCandidates(snapshot, 'currentContract', 'pendingContract', 'contractHistory', attempt)
      .some((contract) => sameContractBody(contract, attempt.body));
  }
  if (attempt.kind === 'CONTRACT_DECISION') {
    return candidates(snapshot, 'currentContract', 'pendingContract', 'contractHistory')
      .some((contract) => contract.id === attempt.resourceId && decisionMatches(contract, attempt.body));
  }
  return false;
}

export function projectContractApiErrorMessage(payload, fallback) {
  return trimText(payload?.error) || trimText(payload?.message) || fallback;
}
