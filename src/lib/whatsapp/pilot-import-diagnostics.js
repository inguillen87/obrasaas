// Closed diagnostic vocabulary. Never return provider messages, tokens or URLs.
const DIAGNOSTICS = Object.freeze({
  META_PILOT_TOKEN_EXPIRY_REQUIRED: Object.freeze({ code: 'PILOT_TOKEN_NOT_TEMPORARY', title: 'El token no es temporal',
    message: 'Meta informa este token sin vencimiento. El importador piloto exige una credencial temporal. Repetir el mismo token no resolverá el rechazo; no cambies la clave de la app ni el webhook.', changeRequired: true }),
  META_PILOT_TOKEN_EXPIRED: Object.freeze({ code: 'PILOT_TOKEN_EXPIRED', title: 'La credencial venció',
    message: 'El token temporal está vencido. Reemplazalo por una credencial vigente de esta app y confirmá otra vez el destino.', changeRequired: true }),
  META_PILOT_TOKEN_TTL_INSUFFICIENT: Object.freeze({ code: 'PILOT_TOKEN_EXPIRING', title: 'La credencial vence demasiado pronto',
    message: 'El token no tiene tiempo suficiente para completar la vinculación. Usá una credencial temporal con mayor vigencia.', changeRequired: true }),
  META_TOKEN_APP_MISMATCH: Object.freeze({ code: 'PILOT_TOKEN_WRONG_APP', title: 'La credencial no quedó validada para esta app',
    message: 'Verificá que el token esté vigente y haya sido emitido para la app ObraSaaS. No se habilitó el número con esta credencial.', changeRequired: true }),
  META_SCOPES_INCOMPLETE: Object.freeze({ code: 'PILOT_TOKEN_SCOPES_MISSING', title: 'Faltan permisos en la credencial',
    message: 'La autorización no incluye los permisos de WhatsApp requeridos por la integración. Revisá la autorización de la app; no cambies la obra para evadir el control.', changeRequired: true }),
  PHONE_WABA_MISMATCH: Object.freeze({ code: 'PILOT_PHONE_ACCOUNT_MISMATCH', title: 'El número no coincide con la cuenta',
    message: 'El número no se encontró en la cuenta WhatsApp Business seleccionada. Revisá los activos y la autorización antes de intentar vincularlo.', changeRequired: true }),
});
export function pilotImportProviderDiagnostic(error) {
  if (error?.status !== 403 || typeof error.code !== 'string' || !Object.hasOwn(DIAGNOSTICS, error.code)) return null;
  return DIAGNOSTICS[error.code];
}
export function pilotImportPublicDiagnostic(status, errorCode, diagnosticCode) {
  if (status !== 400 || errorCode !== 'PILOT_IMPORT_VALIDATION_FAILED' || typeof diagnosticCode !== 'string') return null;
  return Object.values(DIAGNOSTICS).find(item => item.code === diagnosticCode) || null;
}
