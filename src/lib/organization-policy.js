function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function databaseOrganizationIsInternal(organization) {
  return organization?.clerkOrganizationId === 'system:obrasaas'
    || record(organization?.metadata).internal === true;
}

export function clerkOrganizationIsInternal(
  organization,
  existingMetadata = null,
  internalClerkOrgId = null,
) {
  const publicMetadata = record(
    organization?.publicMetadata ?? organization?.public_metadata,
  );
  return record(existingMetadata).internal === true
    || publicMetadata.internal === true
    || Boolean(internalClerkOrgId && organization?.id === internalClerkOrgId);
}

export function mergeClerkOrganizationMetadata(
  existingMetadata,
  organization,
  orgSlug = null,
  internalClerkOrgId = null,
) {
  return {
    ...record(existingMetadata),
    clerkSlug: organization?.slug || orgSlug || null,
    clerkName: organization?.name || null,
    clerkImageUrl: organization?.imageUrl || organization?.image_url || null,
    internal: clerkOrganizationIsInternal(
      organization,
      existingMetadata,
      internalClerkOrgId,
    ),
  };
}
