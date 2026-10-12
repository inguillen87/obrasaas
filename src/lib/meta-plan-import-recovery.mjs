import {digest, WorkspaceError} from './workspace-policy.mjs';
import {decodeWorkerChannelProof} from './worker-channel-identity.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerOutboundId} from './meta-customer-outbound.mjs';
import {META_CUSTOMER_PROTOCOL} from './meta-cloud-protocol.mjs';
import {metaPlanImportAuthorizationValid} from './meta-plan-import-conversation.mjs';
const operationFor = eventId => {
  const h = digest(['meta-field-operation-v1', eventId, 'PLAN_IMPORT']);
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};

// Proof of an existing sealed attempt only. Returning true preserves an inbox
// reservation after revocation; it never authorizes a retry or external call.
export async function metaPreparedPlanRecovery(client, context, {environment = process.env} = {}) {
  try {
    const event = (await client.query(`SELECT * FROM public."WebhookEvent"
      WHERE id=$1 AND "projectId"=$2 AND provider=$3`,
    [context.eventId, context.projectId, META_CUSTOMER_PROTOCOL.provider])).rows[0];
    if (!event || event.eventType !== 'message' || event.status !== 'PENDING' ||
        event.leaseToken !== context.leaseToken || event.payload?.channelId !== context.channelId ||
        event.payload?.payloadDigest !== context.payloadDigest) return false;
    const connection = (await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c
      JOIN public."Project" p ON p.id=c."projectId"
      WHERE c.id=$1 AND c."projectId"=$2 AND p."organizationId"=$3`,
    [context.channelId, context.projectId, event.payload.organizationId])).rows[0];
    if (!connection || connection.metadata?.developmentPilot) return false;
    const proof = decodeWorkerChannelProof(event, connection, environment);
    const key = 'meta_field_plan_' + digest(event.id);
    const row = (await client.query(`SELECT "actorId","entityId",metadata FROM public."AuditLog"
      WHERE id=$1 AND "organizationId"=$2 AND action='meta.field.plan.prepared' AND "entityType"='Worker'`,
    [key, connection.organizationId])).rows[0], m = row?.metadata;
    if (m?.version !== 1 || m.eventId !== event.id || m.payloadDigest !== context.payloadDigest ||
        m.operationId !== operationFor(event.id) || typeof m.inputDigest !== 'string') return false;
    const input = JSON.parse(decryptCustomerSecret(m.encryptedInput, {
      organizationId: connection.organizationId, projectId: m.projectId,
      purpose: 'field-plan-prepared', resourceId: key
    }, environment));
    if (digest(input) !== m.inputDigest || input.command?.analysisConsentEventId !== event.id ||
        input.state?.bindingId !== m.channelBindingId ||
        !metaPlanImportAuthorizationValid(proof.value, input.command, input.state)) return false;
    const ref = input.command.sourceOrigin;
    if (ref.sourceProjectId !== event.projectId) return false;
    const origin = (await client.query(`SELECT * FROM public."WebhookEvent"
      WHERE id=$1 AND "projectId"=$2 AND provider=$3`,
    [ref.eventId, ref.sourceProjectId, META_CUSTOMER_PROTOCOL.provider])).rows[0];
    if (!origin || origin.payload?.payloadDigest !== ref.payloadDigest) return false;
    const signed = decodeWorkerChannelProof(origin, connection, environment), asset = signed.value?.[signed.value.type];
    if (signed.senderE164 !== proof.senderE164 || signed.value.type !== ref.kind ||
        asset?.id !== ref.mediaId || asset.mime_type !== ref.contentType) return false;
    const projection = (await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute"
      WHERE "sourceEventId"=$1`, [event.id])).rows[0];
    if (proof.companyRouting?.mode === 'COMPANY') {
      const source = (await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute"
        WHERE "sourceEventId"=$1`, [ref.eventId])).rows[0];
      const fields = ['organizationId', 'connectionId', 'projectId', 'workerId', 'actorId', 'membershipId', 'assignmentRevision', 'bindingId', 'routeId', 'routeEpoch'];
      if (projection?.kind !== 'FIELD' || source?.kind !== 'FIELD' ||
          projection.payloadDigest !== m.payloadDigest || source.payloadDigest !== ref.payloadDigest ||
          projection.projectId !== m.projectId || projection.workerId !== row.entityId ||
          projection.actorId !== row.actorId || projection.bindingId !== m.channelBindingId ||
          fields.some(field => source[field] !== projection[field])) return false;
    } else if (m.projectId !== event.projectId || projection) return false;
    const observed = (await client.query(`SELECT metadata FROM public."AuditLog"
      WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4
        AND action='meta.field.dispatched'`,
    ['meta_field_' + digest(['meta-field-dispatch-v1', ref.eventId]), connection.organizationId, row.actorId, row.entityId])).rows[0]?.metadata;
    if (observed?.version !== 1 || observed.projectId !== m.projectId ||
        observed.eventId !== ref.eventId || observed.channelId !== connection.id ||
        observed.channelBindingId !== m.channelBindingId || observed.payloadDigest !== ref.payloadDigest ||
        observed.kind !== 'CONVERSATION' || observed.businessApplied !== false) return false;
    const outbound = (await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent"
      WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1'`,
    [customerOutboundId(ref.eventId), connection.projectId])).rows[0];
    if (!['SENT', 'STATUS_OBSERVED'].includes(outbound?.outcome?.state) ||
        ['failed', 'deleted'].includes(outbound.outcome.providerStatus) ||
        outbound.outcome.messageId !== proof.value.context?.id) return false;
    const sent = JSON.parse(decryptCustomerSecret(outbound.payload.encryptedPayload, {
      organizationId: connection.organizationId, projectId: connection.projectId,
      purpose: 'outbound', resourceId: outbound.id
    }, environment));
    return digest(sent) === outbound.payload.requestDigest && sent.eventId === ref.eventId &&
      sent.payloadDigest === ref.payloadDigest && sent.organizationId === connection.organizationId &&
      sent.channelId === connection.id && sent.to === proof.value.from && sent.replyTo === signed.value.id &&
      (projection ? sent.targetProjectId === m.projectId && sent.sourceRouteId === ref.eventId
        : sent.targetProjectId === undefined && sent.sourceRouteId === undefined);
  } catch (error) {
    if (error instanceof WorkspaceError || error instanceof SyntaxError || error instanceof TypeError) return false;
    throw error;
  }
}
