const META_RESOURCE_ID_PATTERN = /^\d{5,32}$/;
const REGISTRATION_PIN_PATTERN = /^\d{6}$/;
const TARGET_ID_SUFFIX_LENGTH = 6;

export function pilotTargetIdSuffix(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";
  return normalized.length <= TARGET_ID_SUFFIX_LENGTH
    ? normalized
    : `…${normalized.slice(-TARGET_ID_SUFFIX_LENGTH)}`;
}

export function createPilotImportIdempotencyKey(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === "function") {
    return `pilot-import-${cryptoApi.randomUUID()}`;
  }
  if (typeof cryptoApi?.getRandomValues !== "function") {
    throw new Error("No hay un generador criptográfico disponible.");
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  const randomHex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `pilot-import-${randomHex}`;
}

export function validatePilotImportDraft(
  draft,
  { confirmed, allowedProjectIds, allowedAssetPairs },
) {
  if (
    !(allowedProjectIds instanceof Set) ||
    !allowedProjectIds.has(draft.projectId)
  ) {
    return "Seleccioná un tenant y una obra piloto habilitados.";
  }
  if (
    !(allowedAssetPairs instanceof Set) ||
    !allowedAssetPairs.has(`${draft.whatsappBusinessId}:${draft.phoneNumberId}`)
  ) {
    return "Seleccioná un número de prueba habilitado para este Preview.";
  }
  if (!META_RESOURCE_ID_PATTERN.test(draft.whatsappBusinessId)) {
    return "Ingresá un WhatsApp Business Account ID válido.";
  }
  if (!META_RESOURCE_ID_PATTERN.test(draft.phoneNumberId)) {
    return "Ingresá un Phone Number ID válido.";
  }
  if (
    typeof draft.accessToken !== "string" ||
    draft.accessToken.length < 20 ||
    draft.accessToken.length > 4_096 ||
    draft.accessToken.trim() !== draft.accessToken
  ) {
    return "Ingresá el token temporal completo, sin espacios al inicio ni al final.";
  }
  if (
    draft.registrationPin &&
    !REGISTRATION_PIN_PATTERN.test(draft.registrationPin)
  ) {
    return "El PIN de registro debe tener exactamente 6 números.";
  }
  if (confirmed !== true) {
    return "Confirmá el alcance piloto antes de importar la conexión.";
  }
  return null;
}

export function pilotImportRequestBody(draft) {
  return {
    projectId: draft.projectId,
    whatsappBusinessId: draft.whatsappBusinessId,
    phoneNumberId: draft.phoneNumberId,
    accessToken: draft.accessToken,
    ...(draft.registrationPin
      ? { registrationPin: draft.registrationPin }
      : {}),
  };
}

export function pilotImportErrorMessage(status, code) {
  if (code === "PILOT_IMPORT_IN_PROGRESS") {
    return "Hay otra validación segura en curso. Esperá unos segundos y reintentá.";
  }
  if (code === "PILOT_IMPORT_RECOVERY_REQUIRED") {
    return "Meta pudo haber aplicado el intento anterior. No cambies el token ni el PIN: recuperá la operación original antes de volver a conectar este número.";
  }
  if (code === "IDEMPOTENCY_PAYLOAD_MISMATCH") {
    return "La operación segura ya empezó con otros datos. Restaurá los valores originales o iniciá una recuperación controlada.";
  }
  if (code === "PILOT_IMPORT_VALIDATION_FAILED") {
    return "Meta no pudo completar la validación. Ante una interrupción, reintentá primero sin cambiar el activo, el token ni el PIN.";
  }
  if (
    code === "PILOT_ASSET_NOT_ALLOWED" ||
    code === "PILOT_ASSET_ALLOWLIST_UNAVAILABLE"
  ) {
    return "El activo de prueba ya no está habilitado en este Preview. Recargá la página.";
  }
  if (status === 404)
    return "La importación piloto ya no está habilitada en este Preview.";
  if (status === 401 || status === 403) {
    return "Tu sesión o membresía piloto ya no autoriza esta operación.";
  }
  if (status === 409) {
    return "La obra o el número cambió durante el intento. Revisá el destino antes de reintentar.";
  }
  if (status >= 400 && status < 500) {
    return "Los datos no pasaron la validación segura. Revisalos y reintentá.";
  }
  return "No se pudo completar la importación piloto. Podés reintentar con los mismos datos.";
}
