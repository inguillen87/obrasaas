import { isTenantRole } from './tenant-roles.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseInvitationInput(input, actorEmail = null) {
  const email = typeof input?.email === 'string'
    ? input.email.trim().toLowerCase()
    : '';
  const tenantRole = typeof input?.tenantRole === 'string'
    ? input.tenantRole.trim().toUpperCase()
    : '';

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: 'Ingresá un email válido.' };
  }
  if (!isTenantRole(tenantRole)) {
    return { error: 'Seleccioná un rol válido.' };
  }
  if (actorEmail && email === actorEmail.trim().toLowerCase()) {
    return { error: 'Tu usuario ya pertenece a esta organización.' };
  }

  return {
    email,
    tenantRole,
    clerkRole: tenantRole === 'ADMIN' ? 'org:admin' : 'org:member',
  };
}

export function tenantRoleFromInvitation(invitation) {
  if (invitation?.role === 'org:admin') return 'ADMIN';

  const desiredRole = invitation?.publicMetadata?.obrasaasTenantRole
    || invitation?.public_metadata?.obrasaasTenantRole;
  if (!isTenantRole(desiredRole) || desiredRole === 'ADMIN') return 'AUDITOR';
  return desiredRole;
}

export function acceptedInvitationRole(invitations, email) {
  const normalizedEmail = email?.trim().toLowerCase();
  const match = [...(invitations || [])]
    .filter((invitation) => (
      invitation.status === 'accepted'
      && invitation.emailAddress?.trim().toLowerCase() === normalizedEmail
    ))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];

  return match ? tenantRoleFromInvitation(match) : null;
}

export function serializeInvitation(invitation) {
  return {
    id: invitation.id,
    email: invitation.emailAddress,
    status: invitation.status || 'pending',
    tenantRole: tenantRoleFromInvitation(invitation),
    createdAt: new Date(invitation.createdAt).toISOString(),
    expiresAt: new Date(invitation.expiresAt).toISOString(),
  };
}
