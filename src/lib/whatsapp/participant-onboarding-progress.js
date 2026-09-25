const STATES = new Set(['eligible','already_pending','authorized','conflict','closed']);
const CLAIMS = new Set(['PENDING','SUBMITTED','APPROVED','REJECTED','EXPIRED','CANCELLED']);
const ROLES = new Set(['WORKER','FOREMAN','SITE_MANAGER','SAFETY']);
const DELIVERY = new Set(['sending','accepted','sent','delivered','read','failed','unknown','submitted','rejected']);
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(value);
const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,280) : '';
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
// Shared public projection: no phone, civil identity, provider token or claims payload.
export function projectParticipantOnboarding(result) {
  const state = STATES.has(result?.state) ? result.state : 'closed';
  const invitation = result?.invitation || result;
  const claimStatus = CLAIMS.has(invitation?.claimStatus) ? invitation.claimStatus : null;
  const claimId = identifier(invitation?.claimId) ? invitation.claimId : null;
  const delivery = DELIVERY.has(invitation?.delivery) ? invitation.delivery : null;
  const code = clean(result?.capability?.code ?? result?.code);
  const current = result?.currentAccess;
  const currentAccess = state === 'authorized' && identifier(current?.workerId) && ROLES.has(current?.role)
    && current?.verifiedNow === true && date(current.checkedAt) ? { workerId: current.workerId, role: current.role, verifiedNow: true, checkedAt: date(current.checkedAt) } : null;
  const reason = clean(result?.capability?.reason ?? result?.reason);
  return { state, reason, code, claimId, claimStatus, delivery,
    expiresAt: date(invitation?.expiresAt), currentAccess,
    checkedAt: date(result?.checkedAt),
    needsIntegration: /^(WHATSAPP_|WORKER_ONBOARDING_FLOW_|WORKER_ONBOARDING_INVITATION_PREPARATION)/.test(code)
      && !['WHATSAPP_PRIOR_INBOUND_REQUIRED','WHATSAPP_CUSTOMER_SERVICE_WINDOW_CLOSED'].includes(code),
    unavailable: result?.unavailable === true };
}
export function onboardingClaimHref(claimId) {
  return identifier(claimId) ? '/dashboard/team?onboardingClaimId=' + encodeURIComponent(claimId) + '#worker-onboarding' : '/dashboard/team#worker-onboarding';
}
export function participantProgressCopy(progress) {
  if (progress.unavailable) return { title:'No se pudo verificar el alta', detail:'El estado está sin confirmar. Actualizá la conversación; no se habilitó otra invitación.', tone:'pending', step:0 };
  if (progress.state === 'conflict') return { title:'Acceso pendiente de revisión', detail:'Una aprobación anterior no reemplaza la identidad y asignación vigentes. Revisá el alta y la cuadrilla de esta obra.', tone:'conflict', step:3 };
  if (progress.state === 'authorized' && progress.currentAccess) return { title:'Participante autorizado en esta obra', detail:'Su identidad y asignación siguen vigentes. El próximo mensaje se evalúa con su rol actual; no se reproducen mensajes anteriores.', tone:'approved', step:4 };
  if (progress.claimStatus === 'SUBMITTED') return { title:'Datos enviados: falta la decisión', detail:'Abrí esta alta para comprobar la confirmación de WhatsApp y revisar los datos. Todavía no equivale a acceso operativo.', tone:'pending', step:3 };
  if (progress.state === 'already_pending') return { title:progress.delivery === 'unknown' || progress.delivery === 'sending' ? 'Confirmando la invitación anterior' : 'Esperando los datos del trabajador', detail:'El alta ya tiene un intento abierto. No se enviará otra invitación mientras se confirma o completa.', tone:'pending', step:2 };
  if (progress.claimStatus === 'REJECTED') return { title:'El alta anterior fue rechazada', detail:'El rechazo se conserva. Una nueva invitación necesita una decisión explícita y los controles actuales del canal.', tone:'conflict', step:3 };
  if (['EXPIRED','CANCELLED'].includes(progress.claimStatus)) return { title:progress.claimStatus === 'EXPIRED' ? 'La invitación anterior venció' : 'La invitación anterior fue cancelada', detail:'El antecedente se conserva. Revisá el canal y la conversación antes de preparar otra invitación.', tone:'pending', step:1 };
  if (progress.state === 'eligible') return { title:'Prepará el alta de este contacto', detail:'La invitación abre un formulario privado. Completarlo no concede permisos: un responsable de esta obra debe revisarlo.', tone:'eligible', step:1 };
  return { title:'El alta necesita atención', detail:progress.reason || 'Consultá la configuración y el estado del contacto. No hay una invitación nueva habilitada.', tone:'pending', step:0 };
}
export function confirmedOnboardingDecision(result, { claimId, expectedRevision, action, projectId }) {
  const status = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : null;
  return Boolean(status && result?.id === claimId && result?.projectId === projectId
    && result.status === status && result.revision === expectedRevision + 1 && typeof result.replayed === 'boolean'
    && (status !== 'APPROVED' || identifier(result?.resolution?.workerId)));
}
