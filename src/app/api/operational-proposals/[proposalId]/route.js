import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { proposalId } = await params;
    const state = await getAppState();
    const proposals = state.operationalProposals || [];
    const proposal = proposals.find(p => p.id === proposalId);

    if (!proposal) {
      return Response.json({ success: false, error: 'Propuesta no encontrada' }, { status: 404 });
    }

    return Response.json({ success: true, proposal });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
