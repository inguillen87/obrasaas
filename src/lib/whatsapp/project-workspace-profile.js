import { tenantWorkspaceFromMetadata, workspaceIdentifier, TenantWorkspaceError } from './tenant-workspace-policy.js';
const record = value => value && typeof value === 'object' && !Array.isArray(value);
function integrity() {
  return new TenantWorkspaceError('La preparación de esta obra requiere revisión.', 'WORKSPACE_INTEGRITY', 409);
}
// Project preparation takes precedence. Legacy company preparation is visible
// only in its original project; reading never copies it into a second site.
export function readProjectWorkspaceProfile(projectMetadata, organizationMetadata, projectId) {
  if (!workspaceIdentifier(projectId)) throw integrity();
  if (projectMetadata != null && !record(projectMetadata)) throw integrity();
  if (record(projectMetadata) && Object.hasOwn(projectMetadata, 'whatsappWorkspace')) {
    const stored = projectMetadata.whatsappWorkspace;
    if (!record(stored) || stored.schemaVersion !== 2 || stored.initialProjectId !== projectId) throw integrity();
    return { profile: tenantWorkspaceFromMetadata({ whatsappWorkspace: { ...stored, schemaVersion: 1 } }), profileSource: 'PROJECT' };
  }
  const legacy = tenantWorkspaceFromMetadata(organizationMetadata);
  return legacy.configured && legacy.initialProjectId === projectId
    ? { profile: legacy, profileSource: 'LEGACY_ORGANIZATION' }
    : { profile: tenantWorkspaceFromMetadata(null), profileSource: 'NONE' };
}
export function projectWorkspaceMetadata(metadata, stored, projectId) {
  if (metadata != null && !record(metadata)) throw integrity();
  if (stored.schemaVersion !== 2 || stored.initialProjectId !== projectId) throw integrity();
  readProjectWorkspaceProfile({ whatsappWorkspace: stored }, null, projectId);
  return { ...(metadata || {}), whatsappWorkspace: { ...stored, useCases: [...stored.useCases] } };
}
