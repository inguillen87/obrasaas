function singleQueryValue(searchParams, name) {
  let values;
  if (typeof searchParams?.getAll === 'function') {
    values = searchParams.getAll(name);
  } else if (searchParams && typeof searchParams === 'object' && Object.hasOwn(searchParams, name)) {
    const value = searchParams[name];
    values = Array.isArray(value) ? value : [value];
  } else {
    return '';
  }
  return Array.isArray(values) && values.length === 1 && typeof values[0] === 'string' ? values[0] : '';
}

// This is navigation context, not proof of membership or permission. Only the
// canonical participant invitation ID survives; no caller can select a URL.
export function identityInvitationId(searchParams) {
  const value = singleQueryValue(searchParams, 'participar');
  return value.length === 39 && /^invite_[a-f0-9]{32}$/.test(value) ? value : '';
}

// A pending ticket selects Clerk's own UI on the original request URL. It never
// grants a session or membership, and the ticket is not returned or forwarded.
export function identityHasPendingInvitation(searchParams) {
  const status = singleQueryValue(searchParams, '__clerk_status');
  if (status !== 'sign_in' && status !== 'sign_up') return false;
  const ticket = singleQueryValue(searchParams, '__clerk_ticket');
  return ticket.length >= 1 && ticket.length <= 8192 && !/[^A-Za-z0-9._-]/.test(ticket);
}

function invitationPath(path, searchParams) {
  const invitationId = identityInvitationId(searchParams);
  return invitationId ? `${path}?participar=${invitationId}` : path;
}

export const identityAccountReturnPath = searchParams => invitationPath('/cuenta', searchParams);
export const identitySignInPath = searchParams => invitationPath('/sign-in', searchParams);
export const identitySignUpPath = searchParams => invitationPath('/sign-up', searchParams);
