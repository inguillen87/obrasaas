import { operationalIncidentIdForEvent } from './obra-policy.js';
import { flowIncidentReceiptMatches } from './flow-incident-policy.js';
import { FlowHistoryError } from './proactive-flow-history-policy.js';
// Only the engine-created incident is admitted; no caller-provided record selector.
export function buildFlowIncidentReceipt(incident, externalId, session) {
  const receipt = { version: 1, incidentId: incident?.id, projectId: session?.projectId, workerId: session?.workerId, sessionId: session?.id };
  if (!flowIncidentReceiptMatches(receipt,session) || incident.id !== operationalIncidentIdForEvent(externalId)
    || incident.metadata?.kind !== 'whatsapp-flow-incident' || !['warning','critical'].includes(incident.type)) {
    throw new FlowHistoryError('No se pudo vincular la incidencia del formulario.', 'WHATSAPP_FLOW_INCIDENT_BINDING_INVALID',503);
  }
  return receipt;
}
