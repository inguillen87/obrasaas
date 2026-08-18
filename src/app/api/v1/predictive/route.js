// GET /api/v1/predictive — Predictive AI & Delay Forecasting Endpoint
import { getAppState } from '@/lib/db';
import { runPredictiveAnalysis } from '@/lib/predictiveAI';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getAppState();
    const forecast = runPredictiveAnalysis(state);

    return Response.json(forecast);
  } catch (err) {
    console.error('Predictive API error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
