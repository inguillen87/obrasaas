// Formatting only: no inferred country, suffix or mobile alias.
export function companyPhoneE164(value, {provider = false} = {}) {
  if (typeof value !== 'string' || !(provider ? /^\+?[1-9][0-9 ()-]{7,25}$/ : /^\+[1-9][0-9 ()-]{7,25}$/).test(value)) return null;
  const digits = value.replace(/[+ ()-]/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? '+' + digits : null;
}
