import { createHash } from 'node:crypto';
import { syncClerkOrganization } from '../clerk-organization-sync.js';
import { withClerkIdentitySyncLock, clerkIdentityRuntimeLockKeys } from '../clerk-identity-lock.js';
import { getCurrentClerkOrganizationMembership, resolveClerkTenantRole } from '../clerk-membership-state.js';
import { databaseOrganizationIsInternal } from '../organization-policy.js';
import { getSubscriptionEntitlements } from '../plans.js';
import { roleHasPermission } from '../tenant-roles.js';
export class PilotWorkspaceError extends Error {
  constructor(code, status = 409) { super('No se pudo confirmar el espacio piloto. Conservá el intento y consultá su estado.'); this.code = code; this.status = status; }
}
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function normalizePilotWorkspaceInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['organizationName','projectName','confirmIsolatedPilot'].includes(k)) || body.confirmIsolatedPilot !== true) throw new PilotWorkspaceError('PILOT_SETUP_INPUT_INVALID', 400);
  const result = {};
  for (const field of ['organizationName','projectName']) {
    if (typeof body[field] !== 'string') throw new PilotWorkspaceError('PILOT_SETUP_NAME_REQUIRED', 400);
    const value = body[field].trim();
    if (value.length < 3 || value.length > 100 || /[\u0000-\u001f\u007f]/.test(value)) throw new PilotWorkspaceError('PILOT_SETUP_NAME_INVALID', 400);
    result[field] = value;
  }
  return result;
}
export async function provisionPilotWorkspace({ prisma, clerk, access, body, environment = process.env, synchronize = syncClerkOrganization, identityLock = withClerkIdentitySyncLock }) {
  if (environment.VERCEL_ENV !== 'preview' || environment.WHATSAPP_PILOT_IMPORT_ENABLED !== 'true' || access?.isSuperadmin !== true) throw new PilotWorkspaceError('PILOT_SETUP_UNAVAILABLE', 404);
  if (!access.userId || !access.databaseUserId || !access.organization?.id || !access.project?.id || !databaseOrganizationIsInternal(access.organization)) throw new PilotWorkspaceError('PILOT_SETUP_CONTEXT_REQUIRED', 403);
  const input = normalizePilotWorkspaceInput(body);
  const ownerKey = hash(['obrasaas-pilot-v1', access.userId, environment.VERCEL_GIT_COMMIT_REF || 'preview']);
  const fingerprint = hash(input), slug = 'obrasaas-piloto-' + ownerKey.slice(0,24);
  let remote;
  try { remote = await clerk.organizations.getOrganization({ slug }); }
  catch (error) { if (Number(error.status ?? error.statusCode) !== 404) throw new PilotWorkspaceError('PILOT_SETUP_PROVIDER_UNAVAILABLE', 503); }
  if (!remote) {
    try { remote = await clerk.organizations.createOrganization({ name: input.organizationName, slug, createdBy: access.userId, privateMetadata: { obrasaasPilotVersion: 1, obrasaasPilotOwnerKey: ownerKey, obrasaasPilotFingerprint: fingerprint } }); }
    catch {
      // A lost response is reconciled by the unique slug; never issue a second create here.
      try { remote = await clerk.organizations.getOrganization({ slug }); }
      catch { throw new PilotWorkspaceError('PILOT_SETUP_PROVIDER_UNCONFIRMED', 503); }
    }
  }
  if (!remote?.id || remote.slug !== slug || remote.privateMetadata?.obrasaasPilotVersion !== 1 || remote.privateMetadata?.obrasaasPilotOwnerKey !== ownerKey || remote.privateMetadata?.obrasaasPilotFingerprint !== fingerprint) throw new PilotWorkspaceError('PILOT_SETUP_EXISTING_CONTEXT_CONFLICT');
  const membership = await getCurrentClerkOrganizationMembership(clerk.organizations, { organizationId: remote.id, userId: access.userId });
  const tenantRole = resolveClerkTenantRole({ clerkRole: membership?.role, clerkMembership: membership });
  if (!membership || membership.role !== 'org:admin' || !roleHasPermission(tenantRole, 'org:integrations:manage')) throw new PilotWorkspaceError('PILOT_SETUP_MEMBERSHIP_REQUIRED', 403);
  return identityLock(prisma, async tx => {
    const organization = await synchronize(tx, { organization: remote });
    if (databaseOrganizationIsInternal(organization)) throw new PilotWorkspaceError('PILOT_SETUP_INTERNAL_FORBIDDEN', 403);
    if (!getSubscriptionEntitlements(organization).canWrite) throw new PilotWorkspaceError('PILOT_SETUP_SUBSCRIPTION_REQUIRED');
    const existing = await tx.tenantMembership.findUnique({ where: { organizationId_userId: { organizationId: organization.id, userId: access.databaseUserId } } });
    if (existing && (existing.status !== 'ACTIVE' || !roleHasPermission(existing.tenantRole, 'org:integrations:manage'))) throw new PilotWorkspaceError('PILOT_SETUP_EXISTING_MEMBERSHIP_RESTRICTED', 403);
    if (!existing) await tx.tenantMembership.create({ data: { organizationId: organization.id, userId: access.databaseUserId, clerkRole: membership.role, tenantRole, status: 'ACTIVE' } });
    const project = await tx.project.upsert({ where: { organizationId_slug: { organizationId: organization.id, slug: 'piloto-whatsapp' } }, update: {}, create: { organizationId: organization.id, slug: 'piloto-whatsapp', name: input.projectName } });
    if (project.status !== 'ACTIVE' || project.name !== input.projectName) throw new PilotWorkspaceError('PILOT_SETUP_PROJECT_CHANGED');
    await tx.auditLog.upsert({ where: { id: 'pilot_setup_' + ownerKey }, update: {}, create: { id: 'pilot_setup_' + ownerKey, organizationId: organization.id, actorId: access.databaseUserId, action: 'platform.pilot.workspace_prepared', entityType: 'Project', entityId: project.id, metadata: { projectId: project.id, source: 'explicit_preview_pilot', fingerprint, remoteOrganizationId: remote.id, noAssetsCopied: true, messagesSent: false } } });
    return { organization: { id: organization.id, name: organization.name }, project: { id: project.id, name: project.name }, status: 'READY_FOR_CONNECTION', existingMembership: Boolean(existing), messagesSent: false, connectionCreated: false };
  }, { identityKeys: clerkIdentityRuntimeLockKeys({ clerkUserId: access.userId, clerkOrganizationId: remote.id }) });
}
