import {digest, WorkspaceError, workspaceId} from './workspace-policy.mjs';
import {decodeWorkerChannelProof} from './worker-channel-identity.mjs';
import {META_CUSTOMER_PROTOCOL} from './meta-cloud-protocol.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerOutboundId} from './meta-customer-outbound.mjs';
import {canImportPlan, canApprovePlan, PLAN_IMPORT_MONTHLY_CURVE_CONSENT, PLAN_IMPORT_CYP_CURVE_CONSENT} from './plan-import-policy.mjs';
import {validMetaPlanImportReferenceContext, metaPlanImportAuthorizationValid} from './meta-plan-import-conversation.mjs';

const financial = value => [PLAN_IMPORT_MONTHLY_CURVE_CONSENT, PLAN_IMPORT_CYP_CURVE_CONSENT].includes(value);
const fields = ['organizationId', 'connectionId', 'projectId', 'workerId', 'actorId', 'membershipId', 'assignmentRevision', 'bindingId', 'routeId', 'routeEpoch'];

// This digest binds a file reference to the canonical person and immutable
// worksite projection. It does not grant authority.
export function metaPlanImportContextDigest(r) {
  return digest(['meta-plan-import-context-v1', r.member.organizationId, r.member.actorId,
    r.member.membershipId, r.member.clerkUserId, r.member.role, r.project.id,
    r.worker.id, r.channelBinding.id, r.connection.id, r.connection.projectId,
    r.connection.phoneNumberId, r.connection.whatsappBusinessId,
    r.sourceProjectId || r.event.projectId,
    r.companyProjection ? Object.fromEntries(fields.map(key => [key, r.companyProjection[key]])) : null]);
}

export function requireMetaPlanImportRole(r, consent = null) {
  if (r.connection.metadata?.developmentPilot || !canImportPlan(r.member.role) ||
      financial(consent) && !canApprovePlan(r.member.role)) {
    throw new WorkspaceError('PLAN_IMPORT_PERMISSION_REQUIRED', 403);
  }
}

// Free input and interactive authorization both belong to the delivered,
// sealed prompt. A current telephone or selector is never enough.
export async function metaPlanImportPromptMatches(client, r, state, environment) {
  if (!workspaceId(state?.lastEventId) || typeof r.proof.value.context?.id !== 'string') return false;
  const row = (await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent"
    WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1'`,
  [customerOutboundId(state.lastEventId), r.connection.projectId])).rows[0];
  if (!['SENT', 'STATUS_OBSERVED'].includes(row?.outcome?.state) ||
      ['failed', 'deleted'].includes(row.outcome.providerStatus) ||
      !row.outcome.messageId || row.outcome.messageId !== r.proof.value.context.id) return false;
  let sent;
  try {
    sent = JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload, {
      organizationId: r.member.organizationId, projectId: r.connection.projectId,
      purpose: 'outbound', resourceId: row.id
    }, environment));
  } catch { return false; }
  if (digest(sent) !== row.payload.requestDigest || sent.eventId !== state.lastEventId ||
      sent.organizationId !== r.member.organizationId || sent.channelId !== r.connection.id ||
      sent.to !== r.proof.value.from) return false;
  const source = (await client.query(`SELECT * FROM public."WebhookEvent"
    WHERE id=$1 AND "projectId"=$2 AND provider=$3`,
  [state.lastEventId, r.connection.projectId, META_CUSTOMER_PROTOCOL.provider])).rows[0];
  if (!source || sent.payloadDigest !== source.payload?.payloadDigest ||
      state.pendingFile && sent.payloadDigest !== state.pendingFile.payloadDigest) return false;
  try {
    const proof = decodeWorkerChannelProof(source, r.connection, environment);
    if (proof.senderE164 !== r.proof.senderE164 || sent.replyTo !== proof.value.id) return false;
  } catch { return false; }
  if (r.companyProjection) {
    if (sent.targetProjectId !== r.project.id || sent.sourceRouteId !== state.lastEventId) return false;
    const projection = (await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute"
      WHERE "sourceEventId"=$1`, [state.lastEventId])).rows[0];
    if (projection?.kind !== 'FIELD' || projection.payloadDigest !== sent.payloadDigest ||
        fields.some(key => projection[key] !== r.companyProjection[key])) return false;
  } else if (sent.targetProjectId !== undefined || sent.sourceRouteId !== undefined) return false;
  return true;
}

// Signed origin and consent proof are rechecked before every external phase.
// The original dispatched reference proves only receipt, never progress.
export async function requireMetaPlanImportOrigin(client, r, command, state, environment, {reservationReadOnly = false} = {}) {
  requireMetaPlanImportRole(r, command?.consent);
  const restricted = (await client.query(`SELECT EXISTS(SELECT 1 FROM public."AuditLog"
    WHERE "organizationId"=$1 AND "actorId"=$2 AND action='office.review.accepted'
      AND metadata->>'membershipId'=$3) AS restricted`,
  [r.member.organizationId, r.member.actorId, r.member.membershipId])).rows[0]?.restricted;
  if (restricted !== false) throw new WorkspaceError('PLAN_IMPORT_PERMISSION_REQUIRED', 403);
  const ref = command?.sourceOrigin;
  const facts = {planImportRole: r.member.role, planImportReferenceContext: {
    eventId: r.event.id, payloadDigest: r.event.payload.payloadDigest,
    contextDigest: metaPlanImportContextDigest(r),
    sourceProjectId: r.sourceProjectId || r.event.projectId
  }};
  // Observing a sealed reservation uses the original authorization receipt's
  // time, never a new message or renewed file TTL. External work uses live time.
  const validationNow = reservationReadOnly ? new Date(r.event.createdAt) : r.now;
  if (state?.version !== 1 || state.purpose !== 'PLAN_IMPORT' || state.step !== 'PLAN_IMPORT_AUTHORIZED' ||
      digest(state.pendingFile) !== digest(ref) || command.consent !== state.consent ||
      command.analysisConsentEventId !== r.event.id ||
      !validMetaPlanImportReferenceContext(ref, {state, facts, now: validationNow}) ||
      !metaPlanImportAuthorizationValid(r.proof.value, command, state, {facts, now: validationNow, eventId: r.event.id}) ||
      !await metaPlanImportPromptMatches(client, r, state, environment)) {
    throw new WorkspaceError('META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED', 409);
  }
  const origin = (await client.query(`SELECT * FROM public."WebhookEvent"
    WHERE id=$1 AND "projectId"=$2 AND provider=$3`,
  [ref.eventId, ref.sourceProjectId, META_CUSTOMER_PROTOCOL.provider])).rows[0];
  if (!origin || origin.payload?.payloadDigest !== ref.payloadDigest) throw new WorkspaceError('META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED', 409);
  const proof = decodeWorkerChannelProof(origin, r.connection, environment), asset = proof.value?.[proof.value.type];
  if (proof.senderE164 !== r.proof.senderE164 || proof.value.type !== ref.kind ||
      asset?.id !== ref.mediaId || asset.mime_type !== ref.contentType) throw new WorkspaceError('META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED', 409);
  if (r.companyProjection) {
    const projection = (await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute"
      WHERE "sourceEventId"=$1`, [ref.eventId])).rows[0];
    if (proof.companyRouting?.mode !== 'COMPANY' || projection?.kind !== 'FIELD' ||
        projection.payloadDigest !== ref.payloadDigest || fields.some(key => projection[key] !== r.companyProjection[key])) {
      throw new WorkspaceError('META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED', 409);
    }
  } else if (proof.companyRouting?.mode === 'COMPANY') throw new WorkspaceError('META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED', 409);
  const receipt = 'meta_field_' + digest(['meta-field-dispatch-v1', ref.eventId]);
  const observed = (await client.query(`SELECT metadata FROM public."AuditLog"
    WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4
      AND action='meta.field.dispatched'`, [receipt, r.member.organizationId, r.member.actorId, r.worker.id])).rows[0]?.metadata;
  if (observed?.version !== 1 || observed.projectId !== r.project.id ||
      observed.channelId !== r.connection.id || observed.channelBindingId !== r.channelBinding.id ||
      observed.eventId !== ref.eventId || observed.payloadDigest !== ref.payloadDigest ||
      observed.kind !== 'CONVERSATION' || observed.businessApplied !== false) {
    throw new WorkspaceError('META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED', 409);
  }
}
