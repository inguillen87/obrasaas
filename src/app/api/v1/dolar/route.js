import { getAppState } from '@/lib/db';
import { fetchLiveExchangeRates, convertBudgetCurrencies, generateTreasuryAdvice } from '@/lib/dolarCac';

export const dynamic = 'force-dynamic';

// GET /api/v1/dolar — Live Dollar rates, CAC Index, and Budget Hedging Metrics
export async function GET(request) {
    try {
        const state = await getAppState();
        const rates = await fetchLiveExchangeRates();

        const budget = state.budget || { rubros: [] };
        const totalPresupuesto = budget.rubros.reduce((s, r) => s + (r.presupuesto || 0), 0) || 4995000;
        const totalEjecutado = budget.rubros.reduce((s, r) => s + (r.ejecutado || 0), 0) || 1423575;

        const presupuestoConverted = convertBudgetCurrencies(totalPresupuesto, rates);
        const ejecutadoConverted = convertBudgetCurrencies(totalEjecutado, rates);
        const treasuryAdvice = generateTreasuryAdvice(totalPresupuesto, totalEjecutado, rates);

        return Response.json({
            success: true,
            timestamp: new Date().toISOString(),
            rates,
            budgetComparison: {
                totalPresupuesto: presupuestoConverted,
                totalEjecutado: ejecutadoConverted,
                saldoDisponible: convertBudgetCurrencies(totalPresupuesto - totalEjecutado, rates)
            },
            treasuryAdvice
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
