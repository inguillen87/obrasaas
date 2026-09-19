export const PILOT_SLUGS_DISABLED = 'PILOT_SETUP_SLUGS_DISABLED';
const GENERIC_MESSAGE = 'No se pudo confirmar el espacio piloto. Conservá el intento y consultá su estado.';
export function pilotWorkspaceErrorMessage(code) {
  return code === PILOT_SLUGS_DISABLED
    ? 'Clerk rechazó el alta porque los identificadores de organización están deshabilitados. En la aplicación ObraSaaS de Clerk, activá Enable organization slugs y guardá el cambio. Este rechazo ocurrió antes de crear la empresa.'
    : GENERIC_MESSAGE;
}
// Only a recognized, definitive provider rejection is a configuration failure.
// Never infer it from arbitrary exception messages, timeouts or malformed responses.
export function isPilotSlugConfigurationError(error) {
  return Number(error?.status ?? error?.statusCode) === 403
    && Array.isArray(error?.errors)
    && error.errors.some(item => item?.code === 'organization_slugs_disabled');
}
export function pilotWorkspaceRecoveryState({ status, code } = {}) {
  if (status === 409 && code === PILOT_SLUGS_DISABLED) return 'configuration';
  if (status === 400) return 'idle';
  if ([401, 403, 404, 409].includes(status)) return 'blocked';
  return 'uncertain';
}
