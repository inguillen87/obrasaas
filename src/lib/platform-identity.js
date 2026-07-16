export const SUPERADMIN_EMAIL = 'guillen.marce@gmail.com';

export function normalizeVerifiedEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isSuperadminEmail(value) {
  return normalizeVerifiedEmail(value) === SUPERADMIN_EMAIL;
}

export function systemRoleForVerifiedEmail(value) {
  return isSuperadminEmail(value) ? 'SUPERADMIN' : 'TENANT_USER';
}
