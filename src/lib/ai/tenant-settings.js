export const AI_PROCESSING_DISCLOSURE_VERSION = '2026-07-16';

const AI_PROCESSING_METADATA_KEY = 'aiProcessing';
const UPDATE_FIELDS = new Set([
  'supervisorEnabled',
  'audioTranscriptionEnabled',
  'organizationAuthorizationConfirmed',
]);

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function validIsoDate(value) {
  return typeof value === 'string'
    && value.length <= 40
    && !Number.isNaN(new Date(value).getTime());
}

export class TenantAiSettingsInputError extends Error {
  constructor(message, code = 'INVALID_AI_SETTINGS') {
    super(message);
    this.name = 'TenantAiSettingsInputError';
    this.code = code;
  }
}

export function tenantAiSettingsFromMetadata(metadata) {
  const stored = record(record(metadata)[AI_PROCESSING_METADATA_KEY]);
  const attestationCurrent = stored.disclosureVersion === AI_PROCESSING_DISCLOSURE_VERSION
    && validIsoDate(stored.authorizationAttestedAt)
    && typeof stored.authorizationAttestedBy === 'string'
    && Boolean(stored.authorizationAttestedBy.trim());

  return {
    supervisorEnabled: attestationCurrent && stored.supervisorEnabled === true,
    audioTranscriptionEnabled: attestationCurrent
      && stored.audioTranscriptionEnabled === true,
    disclosureVersion: typeof stored.disclosureVersion === 'string'
      ? stored.disclosureVersion
      : null,
    disclosureCurrent: attestationCurrent,
    authorizationAttestedAt: validIsoDate(stored.authorizationAttestedAt)
      ? stored.authorizationAttestedAt
      : null,
    updatedAt: validIsoDate(stored.updatedAt) ? stored.updatedAt : null,
  };
}

export function buildTenantAiSettingsUpdate(input, currentMetadata, {
  actorId,
  now = new Date(),
} = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TenantAiSettingsInputError('La configuración de IA debe ser un objeto JSON.');
  }
  const unknownFields = Object.keys(input).filter((key) => !UPDATE_FIELDS.has(key));
  if (unknownFields.length > 0) {
    throw new TenantAiSettingsInputError(
      `El campo ${unknownFields[0]} no está permitido.`,
      'AI_SETTINGS_UNKNOWN_FIELD',
    );
  }
  if (
    typeof input.supervisorEnabled !== 'boolean'
    || typeof input.audioTranscriptionEnabled !== 'boolean'
  ) {
    throw new TenantAiSettingsInputError(
      'Indicá explícitamente qué funciones de IA querés activar.',
      'AI_SETTINGS_FLAGS_REQUIRED',
    );
  }
  if (input.organizationAuthorizationConfirmed !== undefined
    && typeof input.organizationAuthorizationConfirmed !== 'boolean') {
    throw new TenantAiSettingsInputError(
      'La declaración de autorización debe ser explícita.',
      'AI_AUTHORIZATION_INVALID',
    );
  }
  if (typeof actorId !== 'string' || !actorId.trim()) {
    throw new TenantAiSettingsInputError(
      'No se pudo atribuir la configuración a un administrador.',
      'AI_SETTINGS_ACTOR_REQUIRED',
    );
  }

  const current = tenantAiSettingsFromMetadata(currentMetadata);
  const enablesSupervisor = input.supervisorEnabled && !current.supervisorEnabled;
  const enablesTranscription = input.audioTranscriptionEnabled
    && !current.audioTranscriptionEnabled;
  const requiresAttestation = enablesSupervisor || enablesTranscription;
  if (requiresAttestation && input.organizationAuthorizationConfirmed !== true) {
    throw new TenantAiSettingsInputError(
      'Para activar IA, un administrador debe confirmar que la organización informó a las personas involucradas y cuenta con una base legal o autorización aplicable.',
      'AI_ORGANIZATION_AUTHORIZATION_REQUIRED',
    );
  }
  if (
    input.supervisorEnabled === current.supervisorEnabled
    && input.audioTranscriptionEnabled === current.audioTranscriptionEnabled
  ) {
    throw new TenantAiSettingsInputError(
      'No hay cambios en la configuración de IA.',
      'AI_SETTINGS_UNCHANGED',
    );
  }

  const timestamp = now.toISOString();
  const stored = record(record(currentMetadata)[AI_PROCESSING_METADATA_KEY]);
  return {
    ...stored,
    supervisorEnabled: input.supervisorEnabled,
    audioTranscriptionEnabled: input.audioTranscriptionEnabled,
    disclosureVersion: requiresAttestation
      ? AI_PROCESSING_DISCLOSURE_VERSION
      : stored.disclosureVersion || current.disclosureVersion,
    authorizationAttestedAt: requiresAttestation
      ? timestamp
      : stored.authorizationAttestedAt || current.authorizationAttestedAt,
    authorizationAttestedBy: requiresAttestation
      ? actorId.trim()
      : stored.authorizationAttestedBy || null,
    updatedAt: timestamp,
    updatedBy: actorId.trim(),
  };
}

export function publicTenantAiSettings(metadata) {
  const settings = tenantAiSettingsFromMetadata(metadata);
  return {
    supervisorEnabled: settings.supervisorEnabled,
    audioTranscriptionEnabled: settings.audioTranscriptionEnabled,
    disclosureVersion: settings.disclosureVersion,
    disclosureCurrent: settings.disclosureCurrent,
    authorizationAttestedAt: settings.authorizationAttestedAt,
    updatedAt: settings.updatedAt,
  };
}
