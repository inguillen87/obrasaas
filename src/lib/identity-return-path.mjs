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
// An untrusted local navigation hint, never membership, scope or permission.
// This does not grant access to the suggested project.
export function identityWorkspaceProjectHint(searchParams) {
  const value = singleQueryValue(searchParams, 'obra');
  if (value.length < 1 || value.length > 128 || !/^[A-Za-z0-9]/.test(value) || /[^A-Za-z0-9_-]/.test(value)) return '';
  return value;
}
const hasQueryParameter=(searchParams,name)=>typeof searchParams?.getAll==='function'?searchParams.getAll(name).length>0:Boolean(searchParams&&typeof searchParams==='object'&&Object.hasOwn(searchParams,name));
// The draft ID is meaningful only beside one canonical project ID. Invitation
// parameters take priority, including ambiguous or malformed invitations.
export function identityWorkspacePlanHint(searchParams) {
 if(hasQueryParameter(searchParams,'participar')||hasQueryParameter(searchParams,'oficina')||!identityWorkspaceProjectHint(searchParams))return '';
 const value=singleQueryValue(searchParams,'plan');
 return value.length===75&&/^plan_draft_[a-f0-9]{64}$/.test(value)?value:'';
}
export function identityOfficeInvitationId(searchParams){
 const value=singleQueryValue(searchParams,'oficina');
 return /^office_invite_[a-f0-9]{32}$/.test(value)?value:'';
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
  const officeId=identityOfficeInvitationId(searchParams);
  if(officeId)return invitationId?path:`${path}?oficina=${officeId}`;
  if(invitationId)return `${path}?participar=${invitationId}`;
  const planId=identityWorkspacePlanHint(searchParams);
  if(planId)return `${path}?${new URLSearchParams({obra:identityWorkspaceProjectHint(searchParams),plan:planId})}`;
  // A closed presentation hint survives sign-in. It cannot choose a URL,
  // organization, identity, consent, or permission.
  const section=singleQueryValue(searchParams,'seccion');
  if(section==='identidad'){
    const project=identityWorkspaceProjectHint(searchParams);
    return `${path}?${new URLSearchParams({seccion:section,...(project?{obra:project}:{})})}`;
  }
  return path;
}

export const identityAccountReturnPath = searchParams => invitationPath('/cuenta', searchParams);
export const identitySignInPath = searchParams => invitationPath('/sign-in', searchParams);
export const identitySignUpPath = searchParams => invitationPath('/sign-up', searchParams);
