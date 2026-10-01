import { createHash } from 'node:crypto';

export class WorkspaceError extends Error {
  constructor(code, status = 400) { super(code); this.name = 'WorkspaceError'; this.code = code; this.status = status; }
}
export const WORKSPACE_ROLES = Object.freeze({ ADMIN: 'Administrador', DIRECTOR: 'Director de obra', SITE_MANAGER: 'Jefe de obra', FINANCE: 'Administración', AUDITOR: 'Auditor' });
export const workspaceId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
export const operationId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const managesSchedule = role => ['ADMIN', 'DIRECTOR', 'SITE_MANAGER'].includes(role);
export const portfolioAccess = role => ['ADMIN', 'DIRECTOR'].includes(role);
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Called only AFTER RSA signature/issuer/lifetime verification, never on a decoded
// but unverified token. A personal session without an active organization remains personal.
export function organizationFromVerifiedClaims(claims) {
  const legacyPresent = claims.org_id !== undefined || claims.org_role !== undefined;
  const modernPresent = claims.o !== undefined && claims.o !== null;
  const valid = (id, role) => typeof id === 'string' && /^org_[A-Za-z0-9]+$/.test(id) && typeof role === 'string' && /^org:[a-z][a-z0-9_]{0,63}$/.test(role);
  let old = null, current = null;
  if (legacyPresent) {
    if (!valid(claims.org_id, claims.org_role)) return null;
    old = { organizationId: claims.org_id, organizationRole: claims.org_role };
  }
  if (modernPresent) {
    const organization = claims.o;
    if (!organization || typeof organization !== 'object' || Array.isArray(organization) || typeof organization.rol !== 'string') return null;
    const role = organization.rol.startsWith('org:') ? organization.rol : 'org:' + organization.rol;
    if (!valid(organization.id, role)) return null;
    current = { organizationId: organization.id, organizationRole: role };
  }
  if (old && current && (old.organizationId !== current.organizationId || old.organizationRole !== current.organizationRole)) return null;
  return current || old;
}
export function requireWorkspaceIdentity(session) {
  if (session?.authenticated !== true || session.verification !== 'clerk-production-jwt' || !/^user_[A-Za-z0-9]+$/.test(session.userId || '')) throw new WorkspaceError('SESSION_REQUIRED', 401);
  if (!/^org_[A-Za-z0-9]+$/.test(session.organizationId || '') || !/^org:[a-z][a-z0-9_]{0,63}$/.test(session.organizationRole || '')) throw new WorkspaceError('WORKSPACE_ORGANIZATION_REQUIRED', 403);
}
export function scopeStamp(session, membership) {
  return digest([session.userId, session.organizationId, session.organizationRole, membership.membershipId, membership.organizationId, membership.role]);
}
export function checkScope(actual, expected) {
  if (expected !== undefined && (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || expected !== actual)) throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED', 409);
}
export function calendarDate(value) {
  if (typeof value !== 'string' || !/^(20\d\d|2100)-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateScheduleChange(input) {
  const keys = ['operationId', 'projectId', 'taskId', 'scope', 'expectedRevision', 'startsOn', 'endsOn', 'reason'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join('|') !== [...keys].sort().join('|')) throw new WorkspaceError('SCHEDULE_INPUT_INVALID');
  if (!operationId(input.operationId) || !workspaceId(input.projectId) || !workspaceId(input.taskId) || !/^[a-f0-9]{64}$/.test(input.scope || '') || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(input.expectedRevision || '')) throw new WorkspaceError('SCHEDULE_INPUT_INVALID');
  if (!calendarDate(input.startsOn) || !calendarDate(input.endsOn) || input.endsOn < input.startsOn) throw new WorkspaceError('SCHEDULE_DATES_INVALID');
  if (typeof input.reason !== 'string' || input.reason.trim().length < 8 || input.reason.length > 800 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.reason)) throw new WorkspaceError('SCHEDULE_REASON_REQUIRED');
  return { ...input, operationId: input.operationId.toLowerCase(), reason: input.reason.trim() };
}
export function scheduleReceiptId(actorId, projectId, id) { return 'workspace_schedule_' + digest([actorId, projectId, id.toLowerCase()]); }
export function scheduleRequestDigest(input) {
  return digest([input.projectId, input.taskId, input.scope, input.expectedRevision, input.startsOn, input.endsOn, input.reason]);
}
export function workspaceConnectionConfig(environment = process.env) {
  let url;
  try { url = new URL(environment.DATABASE_URL); } catch { throw new WorkspaceError('WORKSPACE_DATABASE_UNAVAILABLE', 503); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech') || !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname) || url.pathname !== '/neondb' || !url.username || !url.password || (url.port && url.port !== '5432') || url.hash) throw new WorkspaceError('WORKSPACE_DATABASE_UNAVAILABLE', 503);
  for (const [name, value] of url.searchParams) {
    if (!['sslmode', 'channel_binding'].includes(name) || url.searchParams.getAll(name).length !== 1 || (name === 'sslmode' && !['require', 'verify-full'].includes(value)) || (name === 'channel_binding' && value !== 'require')) throw new WorkspaceError('WORKSPACE_DATABASE_UNAVAILABLE', 503);
  }
  // Explicit fields prevent a connection-string sslmode from replacing strict TLS.
  return { host: url.hostname, port: 5432, database: 'neondb', user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), ssl: { rejectUnauthorized: true }, enableChannelBinding: true, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 15000, statement_timeout: 8000, query_timeout: 9000, application_name: 'obrasaas-authorized-workspace' };
}
