export const BUSINESS_PROFILE_KINDS = Object.freeze([
  { key: 'CONSTRUCTOR', label: 'Constructora', detail: 'Coordinar ejecución, cuadrillas, compras y costos.', icon: 'fa-solid fa-helmet-safety', paths: ['field','schedule','purchases','team'] },
  { key: 'ARCHITECTURE', label: 'Estudio o arquitecto independiente', detail: 'Dirigir tareas, documentación e inspecciones.', icon: 'fa-solid fa-compass-drafting', paths: ['projects','schedule','quality','reports'] },
  { key: 'CONSULTANCY', label: 'Consultora o gerenciadora', detail: 'Supervisar obras, revisiones y reportes por cliente.', icon: 'fa-solid fa-clipboard-check', paths: ['projects','quality','reports','team'] },
  { key: 'DEVELOPER', label: 'Desarrolladora o grupo inversor', detail: 'Administrar obras, contratos y avances publicados.', icon: 'fa-solid fa-building', paths: ['projects','contracts','measurements','reports'] },
  { key: 'OWNER', label: 'Comitente o propietario', detail: 'Organizar el seguimiento de la obra que contrataste.', icon: 'fa-solid fa-house', paths: ['projects','schedule','reports','team'] },
  { key: 'PUBLIC_ENTITY', label: 'Organismo público', detail: 'Coordinar obras y controles dentro de sus atribuciones.', icon: 'fa-solid fa-landmark', paths: ['projects','quality','contracts','reports'] },
].map(item => Object.freeze({ ...item, paths: Object.freeze(item.paths) })));
export const BUSINESS_MARKETS = Object.freeze([{ key: 'PRIVATE', label: 'Obra privada' }, { key: 'PUBLIC', label: 'Obra pública' }, { key: 'MIXED', label: 'Ambas' }].map(Object.freeze));
const ROUTES = Object.freeze({
  projects: { label: 'Preparar las obras', href: '/dashboard/projects', permission: 'org:projects:read' },
  field: { label: 'Abrir Campo móvil', href: '/dashboard/campo', permission: 'org:execution:read' },
  schedule: { label: 'Organizar el cronograma', href: '/dashboard?tab=sec-gantt', permission: 'org:tasks:read' },
  purchases: { label: 'Gestionar abastecimiento', href: '/dashboard/purchases', permission: 'org:execution:read' },
  quality: { label: 'Revisar inspecciones', href: '/dashboard/inspections', permission: 'org:execution:read' },
  reports: { label: 'Consultar reportes', href: '/dashboard/report', permission: 'org:reports:read' },
  team: { label: 'Asignar accesos por rol', href: '/dashboard/team', permission: 'tenant:members:read' },
  contracts: { label: 'Consultar contratos y partidas', href: '/dashboard/contracts', permission: 'org:contracts:read' },
  measurements: { label: 'Consultar avance medido', href: '/dashboard/measurements', permission: 'org:measurements:read' },
});
export class BusinessProfileError extends Error {
  constructor(message, code = 'BUSINESS_PROFILE_INVALID', status = 422) { super(message); this.code = code; this.status = status; }
}
const object = value => value && typeof value === 'object' && !Array.isArray(value);
export function businessProfileFromMetadata(metadata) {
  if (metadata != null && !object(metadata)) throw new BusinessProfileError('Los metadatos de la organización requieren revisión.', 'BUSINESS_PROFILE_INTEGRITY', 409);
  const value = object(metadata) ? metadata.businessProfile : null;
  if (value == null) return { configured: false, kind: null, market: null, revision: 0, updatedAt: null };
  if (!object(value) || value.schemaVersion !== 1 || !BUSINESS_PROFILE_KINDS.some(p => p.key === value.kind) || !BUSINESS_MARKETS.some(p => p.key === value.market) || !Number.isSafeInteger(value.revision) || value.revision < 1) throw new BusinessProfileError('El perfil guardado requiere revisión; no se reemplazó por un valor predeterminado.', 'BUSINESS_PROFILE_INTEGRITY', 409);
  return { configured: true, kind: value.kind, market: value.market, revision: value.revision, updatedAt: typeof value.updatedAt === 'string' && value.updatedAt.length < 40 && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null };
}
export function normalizeBusinessProfile(input) {
  const allowed = new Set(['kind','market','expectedRevision']);
  if (!object(input) || Object.keys(input).some(key => !allowed.has(key))) throw new BusinessProfileError('El perfil sólo admite tipo de organización, ámbito y revisión.');
  if (!BUSINESS_PROFILE_KINDS.some(p => p.key === input.kind) || !BUSINESS_MARKETS.some(p => p.key === input.market)) throw new BusinessProfileError('Seleccioná un tipo de organización y el ámbito de sus obras.');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new BusinessProfileError('Volvé a consultar la revisión del perfil.');
  return { kind: input.kind, market: input.market, expectedRevision: input.expectedRevision };
}
export function businessProfilePaths(profile, hasPermission) {
  const kind = BUSINESS_PROFILE_KINDS.find(p => p.key === profile?.kind);
  if (!kind) return [];
  return kind.paths.map(key => ({ key, ...ROUTES[key] })).filter(route => hasPermission(route.permission) === true);
}
export async function updateBusinessProfile(prisma, { organizationId, actorId, input, now = new Date() }) {
  if (![organizationId,actorId].every(id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(id))) throw new BusinessProfileError('No se confirmó la identidad de la organización y del administrador.', 'BUSINESS_PROFILE_SCOPE', 403);
  const command = normalizeBusinessProfile(input);
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '3000ms'");
    await tx.$executeRawUnsafe('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE', organizationId);
    const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true, metadata: true, updatedAt: true } });
    if (!org) throw new BusinessProfileError('Organización no disponible.', 'BUSINESS_PROFILE_NOT_FOUND', 404);
    const current = businessProfileFromMetadata(org.metadata);
    if (current.kind === command.kind && current.market === command.market && [current.revision,current.revision - 1].includes(command.expectedRevision)) return { profile: current, unchanged: true };
    if (current.revision !== command.expectedRevision) throw new BusinessProfileError('Otro administrador modificó el perfil. Consultá la versión actual antes de guardar.', 'BUSINESS_PROFILE_CONFLICT', 409);
    if (current.revision === Number.MAX_SAFE_INTEGER) throw new BusinessProfileError('El perfil requiere mantenimiento de versión.', 'BUSINESS_PROFILE_INTEGRITY', 409);
    const stored = { schemaVersion: 1, kind: command.kind, market: command.market, revision: current.revision + 1, updatedAt: now.toISOString() };
    const changed = await tx.organization.updateMany({ where: { id: org.id, updatedAt: org.updatedAt }, data: { metadata: { ...(object(org.metadata) ? org.metadata : {}), businessProfile: stored } } });
    if (changed.count !== 1) throw new BusinessProfileError('La configuración de la organización cambió. Consultala de nuevo.', 'BUSINESS_PROFILE_CONFLICT', 409);
    await tx.auditLog.create({ data: { organizationId, actorId, action: 'organization.business_profile.updated', entityType: 'Organization', entityId: organizationId, metadata: { previousKind: current.kind, previousMarket: current.market, kind: stored.kind, market: stored.market, revision: stored.revision } } });
    return { profile: businessProfileFromMetadata({ businessProfile: stored }), unchanged: false };
  }, { timeout: 10000 });
}

export function confirmsBusinessProfileUpdate(body, command, scope) {
  return Boolean(body && body.organizationId === scope.organizationId && body.projectId === scope.projectId
    && typeof body.unchanged === 'boolean' && body.profile?.configured === true
    && body.profile.kind === command.kind && body.profile.market === command.market
    && Number.isSafeInteger(body.profile.revision) && body.profile.revision > 0
    && (body.profile.revision === command.expectedRevision + 1 || (body.unchanged && body.profile.revision === command.expectedRevision)));
}
