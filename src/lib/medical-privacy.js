export const MEDICAL_EVIDENCE_PERMISSION = 'org:medical:evidence:read';
export const SOURCE_EVIDENCE_PERMISSION = 'org:field:evidence:read';

const MEDICAL_MESSAGE_PLACEHOLDER = 'Reporte sensible recibido. El contenido original y la evidencia están restringidos para este rol.';
const MEDICAL_INCIDENT_DESCRIPTION = 'Licencia médica registrada. Los detalles clínicos y el certificado permanecen fuera de la bitácora operativa.';
const SENSITIVE_MEDICAL_INCIDENT_DESCRIPTION = 'Reporte operativo recibido. El detalle médico y la evidencia permanecen con acceso restringido.';
const RESTRICTED_OPERATIONAL_INCIDENT_DESCRIPTION = 'Reporte operativo recibido. El detalle original y la evidencia permanecen con acceso restringido.';
const RESTRICTED_ENGINE_REPLY = 'Reporte recibido y procesado. El contenido original permanece restringido para este rol.';
const MEDICAL_TEXT_SCAN_CHUNK_LENGTH = 65_536;
const MEDICAL_TEXT_SCAN_OVERLAP = 256;
const CONSTRUCTION_MEDICAL_FALSE_POSITIVE_PATTERNS = Object.freeze([
  /\b(?:el|la|los|las)?\s*(?:hormigon|concreto|cemento|fachada|mamposteria|estructura|edificio|material(?:es)?|composite|compuesto)\s+(?:tiene|padece|presenta|sufre(?:\s+de)?)\s+aluminosis\b/g,
  /\baluminosis\b(?=.{0,80}\b(?:del?|de\s+la|en\s+el|en\s+la|por)\s+(?:hormigon|concreto|cemento|fachada|mamposteria|estructura|edificio|material(?:es)?)\b)/g,
]);
const SENSITIVE_MEDICAL_PATTERNS = Object.freeze([
  /\b(?:cancer|tumor(?:es)?|leucemia|quimio(?:terapia)?|radioterapia|oncologi(?:a|co|ca))\b/,
  /\b(?:vih|hiv|sida|aids|hepatitis(?:\s+[abc])?)\b/,
  /\b(?:tuberculosis|tbc|epoc|asma|bronquitis|enfisema)\b/,
  /\bfibrosis\s+(?:pulmonar|quistica|hepatica|renal|cardiaca|idiopatica)\b/,
  /\b(?:esclerosis\s+multiple|insuficiencia\s+(?:renal|cardiaca|respiratoria|hepatica)|fallo\s+(?:renal|cardiaco|respiratorio|hepatico))\b/,
  /\b(?:(?:recibio|necesita|espera|requiere|le\s+hicieron|fue\s+sometid[oa]\s+a)\s+(?:un\s+)?trasplante|seropositiv[oa]s?)\b/,
  /\b(?:infarto|acv|ictus|stroke|derrame\s+cerebral|accidente\s+cerebrovascular)\b/,
  /\b(?:dialisis|dializad[oa]s?)\b/,
  /\b(?:diagnostico(?!\s+(?:estructural|constructivo|(?:del?|de\s+la|de\s+los|de\s+las)\s+(?:hormigon|concreto|mortero|material(?:es)?|edificio|suelo|fachada|mamposteria|estructura|composite|compuesto)))|diagnosticad[oa]s?|enfermedad(?:es)?|sindrome)\b/,
  /\bpatologia(?!\s+(?:constructiva|estructural|edilicia|(?:del?|de\s+la|de\s+los|de\s+las)\s+(?:hormigon|concreto|mortero|material(?:es)?|edificio|suelo|fachada|mamposteria|estructura|composite|compuesto)))\b/,
  /\b(?:tratamiento|control|reposo|alta)\s+(?:medic[oa]|clinico|psiquiatrico|oncologico)\b/,
  /\b(?:turno|consulta|estudio)\s+(?:medic[oa]|clinico|hospitalario)\b/,
  /\b(?:va|fue|ira|asiste|asistio|concurre|concurrio|debe\s+ir|tiene\s+que\s+ir)\s+al\s+medic[oa]\b/,
  /\b(?:problema|problemas|motivo|motivos|complicacion|complicaciones)\s+(?:de\s+)?salud\b/,
  /\benferm[oa]s?\b/,
  /\b(?:medicacion|medicamentos?|antibioticos?|insulina|antidepresivos?)\b/,
  /\b(?:licencia|certificado|parte)\s+medic[oa]\b/,
  /\b(?:hospitalizad[oa]s?|internad[oa]s?|internacion|cirugia|quirurgic[oa]s?)\b/,
  /\boperad[oa]s?\s+(?:de|por)\b/,
  /\b(?:hemorragia|sangre|amputacion|quemadur[ao]|electrocutad[oa]|herid[oa]|lesionad[oa])s?\b/,
  /\bfractura\s+(?:expuesta|de\s+(?:craneo|clavicula|columna|cadera|costilla|brazo|pierna|mano|muneca|pie|tobillo|hueso)|en\s+(?:el|la)\s+(?:craneo|columna|cadera|brazo|pierna|mano|muneca|pie|tobillo))\b/,
  /\b(?:(?:esta|sigue|quedo)\s+sangrando|sangrado\s+(?:nasal|interno|externo|abundante))\b/,
  /\b(?:embarazo|embarazad[oa]s?|discapacidad|salud\s+mental|depresion|ansiedad|ataque\s+de\s+panico|psiquiatric[oa]|psicologic[oa])\b/,
  /\b(?:covid(?:-?19)?|fiebre|infeccion|neumonia|diabetes|hipertension|epilepsia)\b/,
  /\b(?:transfusion|ambulancia|terapia\s+intensiva)\b/,
  /\b(?:tiene|padece|sufre(?:\s+de)?|diagnosticad[oa]\s+con)\s+(?:[a-z]{2,}\s+){0,3}[a-z]{4,}(?:itis|osis|emia|patia|algia|plejia|oma)\b/,
]);
const RESTRICTED_INCIDENT_MARKERS = Object.freeze([
  'demora reportada',
  'demora confirmada',
  'incidencia critica reportada',
  'incidencia critica confirmada',
  'reporte de voz transcripto',
  'audio de obra recibido',
  'evidencia de obra recibida',
  'incidencia recibida por whatsapp flow',
  'formulario de obra completado',
]);
const SHARED_PROJECT_STATE_FIELDS = Object.freeze([
  'operariosCount',
  'avancePercentage',
  'alertsCount',
  'diasEstimados',
  'tasks',
  'incidents',
  'attendance',
  'stockpiles',
  'hrAttendance',
  'hrBonuses',
  'budget',
  'budgetTotal',
  'budgetExecuted',
  'budgetCurrency',
]);
const SHARED_TASK_FIELDS = Object.freeze([
  'name',
  'assignee',
  'progress',
  'duration',
  'startOffset',
  'startDay',
  'dependencies',
  'isDelayed',
  'isShifted',
]);
const SHARED_ATTENDANCE_FIELDS = Object.freeze([
  'workerId',
  'name',
  'role',
  'checkin',
  'status',
  'latitude',
  'longitude',
  'accuracy',
  'distanceMeters',
]);
const SHARED_HR_ATTENDANCE_FIELDS = Object.freeze([
  'workerId',
  'name',
  'role',
  'presents',
  'excused',
  'unexcused',
  'status',
]);
const SHARED_BONUS_FIELDS = Object.freeze([
  'name',
  'assignee',
  'worker',
  'type',
  'amount',
  'date',
  'description',
]);
const SHARED_STOCKPILE_FIELDS = Object.freeze([
  'name',
  'current',
  'min',
  'max',
  'unit',
  'supplier',
  'status',
]);
const SHARED_INCIDENT_FIELDS = Object.freeze([
  'id',
  'title',
  'description',
  'type',
  'badge',
  'timestamp',
  'reporter',
  'icon',
  'status',
  'sensitivity',
  'metadata',
]);
const SHARED_INCIDENT_METADATA_FIELDS = Object.freeze([
  'kind',
  'proposalId',
  'stockpileKey',
  'stockRiskStatus',
  'resolvedAt',
  'updatedAt',
  'detailRestricted',
  'redacted',
  'sourceContentRestricted',
  'rawContentRestricted',
]);
const SHARED_BUDGET_FIELDS = Object.freeze(['total', 'executed', 'currency']);
const SAFE_INCIDENT_TYPES = new Set(['critical', 'warning', 'success', 'info']);
const SAFE_INCIDENT_STATUSES = new Set([
  'active',
  'open',
  'pending',
  'resolved',
  'closed',
]);
const SAFE_METADATA_TOKEN = /^[A-Za-z0-9._:-]{1,256}$/;
const CANONICAL_PRIVATE_INCIDENT_ID = /^private-incident-[a-f0-9]{16}$/;

function jsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalized(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function projectedScalarRecord(record, fields, {
  stringPlaceholder = 'Detalle restringido',
} = {}) {
  const source = jsonObject(record);
  const projected = {};
  for (const field of fields) {
    if (!hasOwn(source, field)) continue;
    const value = source[field];
    if (
      value == null
      || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value))
    ) {
      projected[field] = value;
    } else if (typeof value === 'string') {
      projected[field] = isSensitiveMedicalText(value)
        ? stringPlaceholder
        : value;
    }
  }
  return projected;
}

function containsSensitiveMedicalData(value, depth = 0) {
  if (depth > 8 || value == null) return false;
  if (typeof value === 'string') return isSensitiveMedicalText(value);
  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveMedicalData(item, depth + 1));
  }
  if (typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => (
    isSensitiveMedicalText(key)
    || containsSensitiveMedicalData(item, depth + 1)
  ));
}

function opaqueStateIdentifier(value, prefix) {
  const canonical = String(value || '');
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < canonical.length; index += 1) {
    const code = canonical.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ (code + index), 0x85ebca6b);
  }
  return `${prefix}-${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

function privateIncidentId(incident, index) {
  const id = String(incident?.id || '');
  if (CANONICAL_PRIVATE_INCIDENT_ID.test(id)) return id;
  return opaqueStateIdentifier(id || `index:${index}`, 'private-incident');
}

function safeMetadataToken(value) {
  const token = String(value || '').trim();
  return SAFE_METADATA_TOKEN.test(token) && !isSensitiveMedicalText(token)
    ? token
    : null;
}

function projectIncidentMetadata(metadata, {
  restricted = false,
} = {}) {
  const source = jsonObject(metadata);
  const projected = {};
  for (const field of SHARED_INCIDENT_METADATA_FIELDS) {
    if (!hasOwn(source, field)) continue;
    const value = source[field];
    if (typeof value === 'boolean') {
      projected[field] = value;
      continue;
    }
    if (typeof value === 'string') {
      const token = safeMetadataToken(value);
      if (token) projected[field] = token;
    }
  }
  if (restricted) {
    projected.detailRestricted = true;
    projected.redacted = true;
    delete projected.sourceContentRestricted;
    delete projected.rawContentRestricted;
  }
  return projected;
}

function canonicalPrivateIncident(incident, index, {
  medical,
  medicalLeave,
} = {}) {
  const type = normalized(incident?.type);
  const status = normalized(incident?.status);
  return {
    id: privateIncidentId(incident, index),
    title: medicalLeave
      ? 'Licencia médica registrada'
      : medical
        ? 'Reporte médico restringido'
        : 'Reporte operativo restringido',
    description: medicalLeave
      ? MEDICAL_INCIDENT_DESCRIPTION
      : medical
        ? SENSITIVE_MEDICAL_INCIDENT_DESCRIPTION
        : RESTRICTED_OPERATIONAL_INCIDENT_DESCRIPTION,
    type: SAFE_INCIDENT_TYPES.has(type) ? type : 'warning',
    badge: medicalLeave
      ? 'Licencia'
      : medical
        ? 'Acceso médico restringido'
        : 'Evidencia restringida',
    timestamp: 'Registro protegido',
    reporter: 'Canal protegido',
    icon: medical
      ? 'fa-solid fa-notes-medical'
      : 'fa-solid fa-shield-halved',
    ...(SAFE_INCIDENT_STATUSES.has(status) ? { status } : {}),
    sensitivity: medical ? 'medical' : 'restricted',
    metadata: projectIncidentMetadata(incident?.metadata, {
      restricted: true,
    }),
  };
}

function projectSharedIncident(incident, index, {
  inferLegacyMedicalText,
} = {}) {
  const privacyOptions = { inferLegacyMedicalText };
  const medical = isMedicalIncident(incident, privacyOptions)
    || (
      inferLegacyMedicalText
      && containsSensitiveMedicalData(incident)
    );
  const restricted = medical
    || isRestrictedOperationalIncident(incident, privacyOptions);
  if (restricted) {
    return canonicalPrivateIncident(incident, index, {
      medical,
      medicalLeave: isMedicalLeaveIncident(incident),
    });
  }

  const source = jsonObject(incident);
  const projected = projectedScalarRecord(source, SHARED_INCIDENT_FIELDS);
  const type = normalized(projected.type);
  const status = normalized(projected.status);
  if (hasOwn(source, 'type')) {
    projected.type = SAFE_INCIDENT_TYPES.has(type) ? type : 'info';
  }
  if (hasOwn(source, 'status')) {
    if (SAFE_INCIDENT_STATUSES.has(status)) projected.status = status;
    else delete projected.status;
  }
  if (hasOwn(source, 'metadata')) {
    projected.metadata = projectIncidentMetadata(source.metadata);
  }
  return projected;
}

function projectSharedTasks(tasks) {
  const source = jsonObject(tasks);
  const idMap = new Map(
    Object.keys(source).map((taskId) => [
      taskId,
      isSensitiveMedicalText(taskId)
        ? opaqueStateIdentifier(taskId, 'private-task')
        : taskId,
    ]),
  );
  return Object.fromEntries(
    Object.entries(source)
      .filter(([, task]) => task && typeof task === 'object' && !Array.isArray(task))
      .map(([taskId, task]) => {
        const projected = projectedScalarRecord(task, SHARED_TASK_FIELDS, {
          stringPlaceholder: 'Detalle de tarea restringido',
        });
        if (Array.isArray(task.dependencies)) {
          projected.dependencies = task.dependencies
            .filter((dependencyId) => typeof dependencyId === 'string')
            .map((dependencyId) => (
              idMap.get(dependencyId)
              || (
                isSensitiveMedicalText(dependencyId)
                  ? opaqueStateIdentifier(dependencyId, 'private-task')
                  : dependencyId
              )
            ));
        }
        return [idMap.get(taskId), projected];
      }),
  );
}

function projectSharedRecordCollection(collection, fields, {
  idPrefix,
  stringPlaceholder,
} = {}) {
  return Object.fromEntries(
    Object.entries(jsonObject(collection))
      .filter(([, entry]) => entry && typeof entry === 'object' && !Array.isArray(entry))
      .map(([entryId, entry]) => {
        const safeId = isSensitiveMedicalText(entryId)
          ? opaqueStateIdentifier(entryId, idPrefix)
          : entryId;
        return [
          safeId,
          projectedScalarRecord(entry, fields, { stringPlaceholder }),
        ];
      }),
  );
}

function projectSharedBonuses(bonuses) {
  if (!Array.isArray(bonuses)) return [];
  return bonuses
    .filter((bonus) => bonus && typeof bonus === 'object' && !Array.isArray(bonus))
    .map((bonus) => projectedScalarRecord(bonus, SHARED_BONUS_FIELDS, {
      stringPlaceholder: 'Detalle de reconocimiento restringido',
    }));
}

function projectSharedState(state, {
  inferLegacyMedicalText,
} = {}) {
  const source = jsonObject(state);
  const projected = {};
  for (const field of SHARED_PROJECT_STATE_FIELDS) {
    if (!hasOwn(source, field)) continue;
    const value = source[field];
    if (field === 'tasks') {
      projected.tasks = projectSharedTasks(value);
    } else if (field === 'incidents') {
      projected.incidents = Array.isArray(value)
        ? value
          .filter((incident) => incident && typeof incident === 'object' && !Array.isArray(incident))
          .map((incident, index) => projectSharedIncident(incident, index, {
            inferLegacyMedicalText,
          }))
        : [];
    } else if (field === 'attendance') {
      projected.attendance = projectSharedRecordCollection(
        value,
        SHARED_ATTENDANCE_FIELDS,
        {
          idPrefix: 'private-worker',
          stringPlaceholder: 'Registro operativo restringido',
        },
      );
    } else if (field === 'hrAttendance') {
      projected.hrAttendance = projectSharedRecordCollection(
        value,
        SHARED_HR_ATTENDANCE_FIELDS,
        {
          idPrefix: 'private-worker',
          stringPlaceholder: 'Registro de personal restringido',
        },
      );
    } else if (field === 'stockpiles') {
      projected.stockpiles = projectSharedRecordCollection(
        value,
        SHARED_STOCKPILE_FIELDS,
        {
          idPrefix: 'private-material',
          stringPlaceholder: 'Dato de material restringido',
        },
      );
    } else if (field === 'hrBonuses') {
      projected.hrBonuses = projectSharedBonuses(value);
    } else if (field === 'budget') {
      projected.budget = projectedScalarRecord(value, SHARED_BUDGET_FIELDS, {
        stringPlaceholder: 'USD',
      });
    } else if (
      value == null
      || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value))
    ) {
      projected[field] = value;
    } else if (typeof value === 'string') {
      projected[field] = isSensitiveMedicalText(value)
        ? 'Dato operativo restringido'
        : value;
    }
  }
  return projected;
}

function normalizedMedicalScanText(value) {
  return CONSTRUCTION_MEDICAL_FALSE_POSITIVE_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, ' '),
    normalized(value),
  );
}

export function isSensitiveMedicalText(value) {
  const source = String(value || '');
  if (!source.trim()) return false;
  for (
    let offset = 0;
    offset < source.length;
    offset += MEDICAL_TEXT_SCAN_CHUNK_LENGTH - MEDICAL_TEXT_SCAN_OVERLAP
  ) {
    const text = normalizedMedicalScanText(source.slice(
      offset,
      offset + MEDICAL_TEXT_SCAN_CHUNK_LENGTH,
    ));
    if (SENSITIVE_MEDICAL_PATTERNS.some((pattern) => pattern.test(text))) {
      return true;
    }
    if (offset + MEDICAL_TEXT_SCAN_CHUNK_LENGTH >= source.length) break;
  }
  return false;
}

function storageIdentityIsMedical(storage) {
  const candidate = [storage?.pathname, storage?.publicId, storage?.assetId]
    .map((value) => normalized(value))
    .find((value) => value.includes('obrasaas/medical-certificates/'));
  return Boolean(candidate);
}

function hasMedicalEvidenceMarkers(record) {
  const metadata = jsonObject(record?.metadata);
  const media = jsonObject(record?.media || metadata.media);
  const storage = jsonObject(media.storage);
  const externalId = normalized(record?.externalId);

  return normalized(record?.sensitivity) === 'medical'
    || normalized(metadata.intent) === 'medical'
    || normalized(metadata.sensitivity) === 'medical'
    || normalized(media.sensitivity) === 'medical'
    || normalized(storage.sensitivity) === 'medical'
    || externalId.startsWith('webview-medical-')
    || externalId.startsWith('obrasaas-reply:webview-medical-')
    || storageIdentityIsMedical(storage);
}

export function isMedicalEvidenceRecord(record) {
  const metadata = jsonObject(record?.metadata);
  const media = jsonObject(record?.media || metadata.media);
  const storage = jsonObject(media.storage);
  const transcription = jsonObject(record?.transcription || metadata.transcription);
  const audioProposal = jsonObject(metadata.audioProposal);
  const clinicalText = [
    record?.text,
    record?.body,
    transcription.text,
    audioProposal.summary,
    metadata.summary,
    media.filename,
    storage.pathname,
    storage.publicId,
  ].filter(Boolean).join(' ');

  return hasMedicalEvidenceMarkers(record)
    || isSensitiveMedicalText(clinicalText);
}

export function isRestrictedEvidenceRecord(record) {
  const metadata = jsonObject(record?.metadata);
  const media = jsonObject(record?.media || metadata.media);
  const storage = jsonObject(media.storage);
  const direction = normalized(record?.direction);
  const sender = normalized(record?.sender);
  const body = normalized(record?.text || record?.body);
  const legacyAudioReply = (
    direction === 'outbound'
    || sender === 'bot'
  ) && (
    body.startsWith('guarde y transcribi el audio')
    || body.startsWith('recibi el audio')
    || body.startsWith('guarde el audio')
  );
  const restrictedMarkers = [
    record?.sensitivity,
    metadata.sensitivity,
    media.sensitivity,
    storage.sensitivity,
  ].map((value) => normalized(value));

  return direction === 'inbound'
    || sender === 'user'
    || legacyAudioReply
    || metadata.sourceContentRestricted === true
    || metadata.rawContentRestricted === true
    || restrictedMarkers.includes('restricted')
    || isMedicalEvidenceRecord(record);
}

export function sanitizeMessagesForMedicalPrivacy(messages, {
  includeMedicalEvidence = false,
  includeSourceEvidence = includeMedicalEvidence,
} = {}) {
  if (!Array.isArray(messages)) return [];

  return messages.map((message) => {
    const medical = isMedicalEvidenceRecord(message);
    const restricted = isRestrictedEvidenceRecord(message);
    if (
      (!medical && !restricted)
      || (medical && includeMedicalEvidence)
      || (!medical && restricted && includeSourceEvidence)
    ) {
      return message;
    }
    const originalMetadata = jsonObject(message.metadata);
    const metadata = {
      ...(typeof originalMetadata.provider === 'string'
        ? { provider: originalMetadata.provider }
        : {}),
      ...(typeof originalMetadata.intent === 'string'
        ? { intent: originalMetadata.intent }
        : {}),
      ...(typeof originalMetadata.authorized === 'boolean'
        ? { authorized: originalMetadata.authorized }
        : {}),
      ...(typeof originalMetadata.time === 'string'
        ? { time: originalMetadata.time }
        : {}),
      sensitivity: medical ? 'medical' : 'restricted',
      redacted: true,
    };

    return {
      ...message,
      text: MEDICAL_MESSAGE_PLACEHOLDER,
      body: MEDICAL_MESSAGE_PLACEHOLDER,
      mediaUrl: null,
      media: null,
      transcription: null,
      metadata,
    };
  });
}

export function isMedicalIncident(incident, {
  inferLegacyMedicalText = true,
} = {}) {
  if (!incident || typeof incident !== 'object') return false;
  if (hasMedicalEvidenceMarkers(incident)) return true;
  if (incident.diagnosis != null || incident.medicalDetails != null) return true;
  const marker = [
    incident.title,
    incident.badge,
    incident.category,
    incident.action,
  ].filter(Boolean).join(' ');
  const normalizedMarker = normalized(marker);
  return normalizedMarker.includes('certificado medico')
    || normalizedMarker.includes('licencia medica')
    || normalizedMarker.includes('medical leave')
    || (inferLegacyMedicalText && isSensitiveMedicalText([
      marker,
      incident.text,
      incident.body,
      incident.description,
      jsonObject(incident.metadata).description,
    ].filter(Boolean).join(' ')));
}

export function isRestrictedOperationalIncident(incident, {
  inferLegacyMedicalText = true,
} = {}) {
  if (!incident || typeof incident !== 'object') return false;
  if (isMedicalIncident(incident, { inferLegacyMedicalText })) return true;
  const metadata = jsonObject(incident.metadata);
  if (
    normalized(incident.sensitivity) === 'restricted'
    || normalized(metadata.sensitivity) === 'restricted'
    || metadata.sourceContentRestricted === true
    || metadata.rawContentRestricted === true
    || metadata.detailRestricted === true
  ) {
    return true;
  }
  const marker = normalized([
    incident.title,
    incident.badge,
    incident.category,
    incident.action,
    metadata.kind,
  ].filter(Boolean).join(' '));
  const trustedFieldEventIdentity = String(incident.id || '').startsWith('inc-event-');
  return trustedFieldEventIdentity
    && RESTRICTED_INCIDENT_MARKERS.some((candidate) => marker.includes(candidate));
}

function isMedicalLeaveIncident(incident) {
  const marker = normalized([
    incident?.title,
    incident?.badge,
    incident?.category,
    incident?.action,
  ].filter(Boolean).join(' '));
  return marker.includes('certificado medico')
    || marker.includes('licencia medica')
    || marker.includes('medical leave');
}

export function sanitizeProjectStateMedicalData(state, {
  inferLegacyMedicalText = true,
} = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  return projectSharedState(state, { inferLegacyMedicalText });
}

export function medicalOperationalDescription() {
  return MEDICAL_INCIDENT_DESCRIPTION;
}

export function sensitiveMedicalOperationalDescription() {
  return SENSITIVE_MEDICAL_INCIDENT_DESCRIPTION;
}

export function restrictedOperationalDescription() {
  return RESTRICTED_OPERATIONAL_INCIDENT_DESCRIPTION;
}

export function sanitizeObraEngineResultForMedicalPrivacy(result, {
  includeMedicalEvidence = false,
  includeSourceEvidence = includeMedicalEvidence,
} = {}) {
  if (
    !result
    || typeof result !== 'object'
    || (includeMedicalEvidence && includeSourceEvidence)
  ) {
    return result;
  }
  const rawMessages = Array.isArray(result.newMessages) ? result.newMessages : [];
  const outboundReplies = rawMessages.filter((message) => message?.sender === 'bot');
  const outboundMedical = outboundReplies.some((message) => (
    isMedicalEvidenceRecord(message)
  ));
  const outboundRestricted = outboundReplies.some((message) => (
    isRestrictedEvidenceRecord(message)
  ));
  const storedReplySensitivity = result.__replySensitivity;
  const storedReplyMedical = storedReplySensitivity === 'medical';
  const storedReplyRestricted = storedReplyMedical
    || storedReplySensitivity === 'restricted';
  const replyRestricted = (
    (isSensitiveMedicalText(result.reply) && !includeMedicalEvidence)
    || (outboundMedical && !includeMedicalEvidence)
    || (!outboundMedical && outboundRestricted && !includeSourceEvidence)
    || (storedReplyMedical && !includeMedicalEvidence)
    || (!storedReplyMedical && storedReplyRestricted && !includeSourceEvidence)
  );
  return {
    ...result,
    ...(replyRestricted ? { reply: RESTRICTED_ENGINE_REPLY } : {}),
    state: sanitizeProjectStateMedicalData(result.state),
    newMessages: sanitizeMessagesForMedicalPrivacy(rawMessages, {
      includeMedicalEvidence,
      includeSourceEvidence,
    }),
  };
}
