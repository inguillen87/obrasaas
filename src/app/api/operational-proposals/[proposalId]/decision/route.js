import { getAppState, saveAppState } from '@/lib/db';
import { appendAuditTransaction } from '@/lib/auditLedger';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { proposalId } = await params;
    const body = await request.json();
    const { decision, reason, reviewer } = body;

    if (!decision || !['APPROVE', 'REJECT'].includes(decision.toUpperCase())) {
      return Response.json({ success: false, error: 'Decisión inválida. Use APPROVE o REJECT' }, { status: 400 });
    }

    const state = await getAppState();
    const proposals = state.operationalProposals || [];
    const index = proposals.findIndex(p => p.id === proposalId);

    if (index === -1) {
      return Response.json({ success: false, error: 'Propuesta operativa no encontrada' }, { status: 404 });
    }

    const proposal = proposals[index];
    const isApproved = decision.toUpperCase() === 'APPROVE';
    const newStatus = isApproved ? 'APROBADA' : 'RECHAZADA';

    proposal.status = newStatus;
    proposal.decisionReason = reason || (isApproved ? 'Aprobada por Director de Obra' : 'Rechazada por Director');
    proposal.reviewedBy = reviewer || 'Arq. Marcelo';
    proposal.decidedAt = new Date().toISOString();

    if (isApproved && proposal.targetTaskId && state.tasks?.[proposal.targetTaskId]) {
      if (proposal.proposedProgress !== undefined) {
        state.tasks[proposal.targetTaskId].progress = proposal.proposedProgress;
      }
      if (proposal.proposedDuration !== undefined) {
        state.tasks[proposal.targetTaskId].duration = proposal.proposedDuration;
      }
      if (proposal.proposedStatus) {
        state.tasks[proposal.targetTaskId].status = proposal.proposedStatus;
      }
    }

    proposals[index] = proposal;
    state.operationalProposals = proposals;

    state.auditLedger = appendAuditTransaction(state.auditLedger, {
      action: `PROPOSAL_${newStatus}`,
      actor: proposal.reviewedBy,
      details: { proposalId, decision: newStatus, reason: proposal.decisionReason }
    });

    await saveAppState(state);

    return Response.json({
      success: true,
      proposal,
      updatedTask: proposal.targetTaskId ? state.tasks?.[proposal.targetTaskId] : null
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
