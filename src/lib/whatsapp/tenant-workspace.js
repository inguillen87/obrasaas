import { databaseOrganizationIsInternal } from '../organization-policy.js';
import { normalizeTenantWorkspace, tenantWorkspaceFromMetadata, workspaceIdentifier, workspaceAuthorizationState, TenantWorkspaceError } from './tenant-workspace-policy.js';
function scopeIds(scope) {
  if (![scope?.organizationId, scope?.projectId].every(workspaceIdentifier)) throw new TenantWorkspaceError('Contexto de empresa no válido.', 'WORKSPACE_SCOPE', 403);
  return scope;
}
async function organization(tx, organizationId, lock = false) {
  if (lock) {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '3000ms'");
    await tx.$executeRawUnsafe('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE', organizationId);
  }
  const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, clerkOrganizationId: true, metadata: true, updatedAt: true } });
  if (!org || databaseOrganizationIsInternal(org)) throw new TenantWorkspaceError('Prepará el asistente desde la empresa cliente, no desde la administración interna.', 'WORKSPACE_CUSTOMER_REQUIRED', 409);
  return org;
}
async function projectInScope(tx, scope, projectId) {
  const project = await tx.project.findFirst({ where: { id: projectId, organizationId: scope.organizationId }, select: { id: true, name: true, status: true } });
  if (!project || !['ACTIVE','PLANNING'].includes(project.status)) throw new TenantWorkspaceError('La primera obra no está disponible para operar en esta empresa.', 'WORKSPACE_PROJECT_UNAVAILABLE', 409);
  return project;
}
export async function readTenantWorkspace(prisma, { scope }) {
  scopeIds(scope);
  return prisma.$transaction(async tx => {
    const org = await organization(tx, scope.organizationId);
    const current = await tx.project.findFirst({ where: { id: scope.projectId, organizationId: scope.organizationId }, select: { id: true } });
    if (!current) throw new TenantWorkspaceError('La obra activa no corresponde a esta empresa.', 'WORKSPACE_SCOPE', 404);
    const profile = tenantWorkspaceFromMetadata(org.metadata);
    const projects = await tx.project.findMany({ where: { organizationId: scope.organizationId, status: { in: ['PLANNING','ACTIVE'] } }, select: { id: true, name: true, status: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 51 });
    return { ...scope, companyName: org.name, profile, authorization: workspaceAuthorizationState(profile, scope.projectId), projects: projects.slice(0,50), projectsTruncated: projects.length > 50, operatingScope: 'LEGACY_SINGLE_PROJECT', automationActivated: false };
  }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
}

export async function saveTenantWorkspace(prisma, options) {
  const { scope, actorId, input, now = new Date() } = options;
  scopeIds(scope);
  if (!workspaceIdentifier(actorId)) {
    throw new TenantWorkspaceError('Administrador no válido.', 'WORKSPACE_SCOPE', 403);
  }
  const command = normalizeTenantWorkspace(input);
  return prisma.$transaction(async (tx) => {
    const org = await organization(tx, scope.organizationId, true);
    await projectInScope(tx, scope, scope.projectId);
    await projectInScope(tx, scope, command.initialProjectId);
    const current = tenantWorkspaceFromMetadata(org.metadata);
    const same = current.assistantName === command.assistantName
      && current.numberMode === command.numberMode
      && current.initialProjectId === command.initialProjectId
      && JSON.stringify(current.useCases) === JSON.stringify(command.useCases);
    if (same && [current.revision, current.revision - 1].includes(command.expectedRevision)) {
      return { ...scope, profile: current, unchanged: true,
        authorization: workspaceAuthorizationState(current, scope.projectId),
        automationActivated: false };
    }
    if (current.revision !== command.expectedRevision) {
      throw new TenantWorkspaceError('Otro administrador cambió la preparación. Consultá la versión actual.', 'WORKSPACE_CONFLICT', 409);
    }
    if (current.revision >= Number.MAX_SAFE_INTEGER) {
      throw new TenantWorkspaceError('La versión requiere mantenimiento.', 'WORKSPACE_INTEGRITY', 409);
    }
    const stored = {
      schemaVersion: 1, assistantName: command.assistantName,
      numberMode: command.numberMode, initialProjectId: command.initialProjectId,
      useCases: command.useCases, mode: 'REVIEW_REQUIRED', ownership: 'CUSTOMER',
      revision: current.revision + 1, updatedAt: now.toISOString(),
    };
    const result = await tx.organization.updateMany({
      where: { id: scope.organizationId, updatedAt: org.updatedAt },
      data: { metadata: { ...(org.metadata || {}), whatsappWorkspace: stored } },
    });
    if (result.count !== 1) {
      throw new TenantWorkspaceError('La empresa cambió mientras guardabas.', 'WORKSPACE_CONFLICT', 409);
    }
    await tx.auditLog.create({ data: {
      organizationId: org.id, actorId,
      action: 'organization.whatsapp_workspace.prepared',
      entityType: 'Organization', entityId: org.id,
      metadata: { revision: stored.revision, initialProjectId: stored.initialProjectId,
        numberMode: stored.numberMode, useCases: stored.useCases,
        ownership: stored.ownership, automationActivated: false },
    } });
    const profile = tenantWorkspaceFromMetadata({ whatsappWorkspace: stored });
    return { ...scope, profile, unchanged: false,
      authorization: workspaceAuthorizationState(profile, scope.projectId),
      automationActivated: false };
  }, { timeout: 10000 });
}

export async function assertTenantWorkspaceAuthorization(prisma, options) {
  const { scope, preparedRevision, lock = false } = options;
  scopeIds(scope);
  const org = await organization(prisma, scope.organizationId, lock);
  const profile = tenantWorkspaceFromMetadata(org.metadata);
  const authorization = workspaceAuthorizationState(profile, scope.projectId);
  if (!authorization.allowed) {
    throw new TenantWorkspaceError(authorization.message, authorization.code, 409);
  }
  if (!Number.isSafeInteger(preparedRevision) || preparedRevision !== profile.revision) {
    throw new TenantWorkspaceError('La preparación cambió. Actualizá Integraciones antes de autorizar.', 'WORKSPACE_REVISION_CHANGED', 409);
  }
  await projectInScope(prisma, scope, profile.initialProjectId);
  return profile;
}
