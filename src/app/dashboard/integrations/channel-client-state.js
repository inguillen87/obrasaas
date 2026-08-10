const RECONNECT_ACTIONS = new Set([
  'CONNECT_ACCOUNT',
  'ENABLE_CONNECTION',
  'REGISTER_PHONE',
  'RECONNECT_ACCOUNT',
  'SUBSCRIBE_WEBHOOK',
]);

const GRAPH_ACCESS_REJECTION_CODES = new Set([
  'META_190',
  'META_PILOT_TOKEN_EXPIRED',
  'META_PILOT_TOKEN_INVALID',
  'META_TOKEN_APP_MISMATCH',
  'META_TOKEN_MISSING',
  'WHATSAPP_GRAPH_RECONNECT_REQUIRED',
  'WHATSAPP_GRAPH_VERIFICATION_REQUIRED',
  'WHATSAPP_NOT_CONNECTED',
]);

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizedStatus(value) {
  return String(value || '').trim().toUpperCase();
}

export function whatsappConnectionLinked(connection) {
  return Boolean(
    connection?.linked === true
    && String(connection.whatsappBusinessId || '').trim(),
  );
}

export function whatsappConnectionIdentity(connection) {
  if (!whatsappConnectionLinked(connection)) return null;
  return String(connection.whatsappBusinessId).trim();
}

export function whatsappGraphAccessRejected(code) {
  return GRAPH_ACCESS_REJECTION_CODES.has(normalizedStatus(code));
}

export function whatsappConnectionActive(connection) {
  return whatsappConnectionLinked(connection)
    && connection.enabled === true
    && normalizedStatus(connection.connectionStatus) === 'CONNECTED';
}

export function whatsappGraphAccessReady(connection, health) {
  if (!whatsappConnectionActive(connection)) return false;
  const checks = record(record(health).checks);
  const account = record(checks.account);
  return normalizedStatus(account.tokenStatus) === 'VALID'
    && account.scopesVerified === true
    && normalizedStatus(account.phoneStatus) === 'REGISTERED'
    && normalizedStatus(account.providerStatus) !== 'DEGRADED';
}

export function whatsappReconnectRequired(connection, health) {
  if (!whatsappConnectionLinked(connection)) return false;
  if (!whatsappConnectionActive(connection)) return true;

  const source = record(health);
  const account = record(record(source.checks).account);
  const tokenStatus = normalizedStatus(account.tokenStatus);
  if (tokenStatus === 'EXPIRED' || tokenStatus === 'INVALID') return true;

  return Array.isArray(source.actions) && source.actions.some((action) => (
    RECONNECT_ACTIONS.has(normalizedStatus(record(action).code))
  ));
}
