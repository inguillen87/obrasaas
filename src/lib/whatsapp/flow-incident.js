import { historyId, FlowHistoryError } from './proactive-flow-history-policy.js';
import { resolveProactiveFlowReplyInTransaction } from './proactive-flow-reply.js';
import { flowIncidentReceiptMatches, flowIncidentMatches } from './flow-incident-policy.js';
import { operationalIncidentIdForEvent } from './obra-policy.js';
const date = v => v instanceof Date && Number.isFinite(v.getTime()) ? v.toISOString() : null;
// The existing operational incident lives in ProjectSnapshot, not the unused Incident table.
// Never reconstruct a historical link by text, phone, timestamp or a nearby record.
export async function readProactiveFlowIncident({prisma,access,conversationId,messageId,clock=()=>new Date()}) {
  const scope={organizationId:historyId(access?.organization?.id),projectId:historyId(access?.project?.id),conversationId:historyId(conversationId)};
  historyId(messageId);
  return prisma.$transaction(async tx => {
    const observedAt=date(clock());
    const output=(state,incident=null)=>{
      const result={context:scope,sourceMessageId:messageId,observedAt,state,incident};
      if (!flowIncidentMatches(result,scope,messageId)) throw new FlowHistoryError('No se pudo verificar la incidencia vinculada.','WHATSAPP_FLOW_INCIDENT_UNVERIFIED',503);
      return result;
    };
    if (!observedAt) return output('unavailable');
    const linked=await resolveProactiveFlowReplyInTransaction(tx,scope,messageId,observedAt);
    if (linked.state !== 'available') return output(linked.state);
    if (linked.session.blueprintKey !== 'incident-report') return output('unsupported');
    const meta=linked.inbound.metadata;
    if (meta.redacted === true || meta.simulated === true || meta.sensitivity === 'medical') return output('unavailable');
    if (!Object.hasOwn(meta,'flowIncidentReceipt')) return output('unlinked');
    const receipt=meta.flowIncidentReceipt;
    if (!flowIncidentReceiptMatches(receipt,linked.session) || receipt.incidentId !== operationalIncidentIdForEvent(linked.session.consumedExternalId)) return output('unavailable');
    const snapshot=await tx.projectSnapshot.findFirst({where:{projectId:scope.projectId,project:{organizationId:scope.organizationId}},select:{state:true,version:true,updatedAt:true}});
    const incidents=snapshot?.state?.incidents;
    if (!Array.isArray(incidents) || incidents.length > 1000) return output('unavailable');
    const matches=incidents.filter(row=>row?.id === receipt.incidentId);
    if (matches.length !== 1 || matches[0].metadata?.kind !== 'whatsapp-flow-incident' || matches[0].sensitivity === 'medical') return output('unavailable');
    const row=matches[0];
    const incident={id:receipt.incidentId,severity:row.type,status:row.status === undefined ? 'unclassified' : row.status,
      snapshotVersion:snapshot.version,snapshotUpdatedAt:date(snapshot.updatedAt)};
    if (!flowIncidentMatches({context:scope,sourceMessageId:messageId,observedAt,state:'available',incident},scope,messageId)) return output('unavailable');
    return output('available',incident);
  },{isolationLevel:'RepeatableRead',maxWait:5000,timeout:10000});
}
