export const MEDICAL_EVIDENCE_PERMISSION = 'org:medical:evidence:read';

const MEDICAL_MESSAGE_PLACEHOLDER = 'Solicitud médica recibida. El contenido clínico y el certificado no se muestran en la bitácora operativa.';
const MEDICAL_INCIDENT_DESCRIPTION = 'Licencia médica registrada. Los detalles clínicos y el certificado permanecen fuera de la bitácora operativa.';

function jsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalized(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function storageIdentityIsMedical(storage) {
  const candidate = [storage?.pathname, storage?.publicId, storage?.assetId]
    .map((value) => normalized(value))
    .find((value) => value.includes('obrasaas/medical-certificates/'));
  return Boolean(candidate);
}

export function isMedicalEvidenceRecord(record) {
  const metadata = jsonObject(record?.metadata);
  const media = jsonObject(record?.media || metadata.media);
  const storage = jsonObject(media.storage);
  const externalId = normalized(record?.externalId);

  return record?.sensitivity === 'medical'
    || normalized(metadata.intent) === 'medical'
    || metadata.sensitivity === 'medical'
    || media.sensitivity === 'medical'
    || storage.sensitivity === 'medical'
    || externalId.startsWith('webview-medical-')
    || externalId.startsWith('obrasaas-reply:webview-medical-')
    || storageIdentityIsMedical(storage);
}

export function sanitizeMessagesForMedicalPrivacy(messages, {
  includeMedicalEvidence = false,
} = {}) {
  if (!Array.isArray(messages)) return [];
  if (includeMedicalEvidence) return messages;

  return messages.map((message) => {
    if (!isMedicalEvidenceRecord(message)) return message;
    const metadata = { ...jsonObject(message.metadata) };
    delete metadata.media;
    delete metadata.transcription;
    metadata.sensitivity = 'medical';
    metadata.redacted = true;

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

export function isMedicalIncident(incident) {
  if (!incident || typeof incident !== 'object') return false;
  if (isMedicalEvidenceRecord(incident)) return true;
  if (incident.diagnosis != null || incident.medicalDetails != null) return true;
  const marker = normalized([
    incident.title,
    incident.badge,
    incident.category,
    incident.action,
  ].filter(Boolean).join(' '));
  return marker.includes('certificado medico')
    || marker.includes('licencia medica')
    || marker.includes('medical leave');
}

export function sanitizeProjectStateMedicalData(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  if (!Array.isArray(state.incidents)) return state;

  let changed = false;
  const incidents = state.incidents.map((incident) => {
    if (!isMedicalIncident(incident)) return incident;
    changed = true;
    const sanitized = {
      ...incident,
      description: MEDICAL_INCIDENT_DESCRIPTION,
      sensitivity: 'medical',
    };
    delete sanitized.evidence;
    delete sanitized.diagnosis;
    delete sanitized.medicalDetails;
    return sanitized;
  });

  return changed ? { ...state, incidents } : state;
}

export function medicalOperationalDescription() {
  return MEDICAL_INCIDENT_DESCRIPTION;
}
