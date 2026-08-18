import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/polizas — Insurance policies tracking (ART, Todo Riesgo, RC, Caución)
export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return Response.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const state = await getAppState();
        const artPolicies = state.artPolicies || {};

        // Map ART policies
        const art = Object.entries(artPolicies).map(([worker, pol]) => {
            const expDate = pol.expirationDate ? new Date(pol.expirationDate) : null;
            const now = new Date();
            const daysUntilExpiry = expDate ? Math.ceil((expDate - now) / (1000 * 60 * 60 * 24)) : null;

            return {
                worker,
                company: pol.company,
                policyNumber: pol.policyNumber || 'Sin número',
                status: pol.status,
                expirationDate: pol.expirationDate,
                daysUntilExpiry,
                alert: daysUntilExpiry !== null
                    ? daysUntilExpiry <= 0 ? '🚨 VENCIDA' 
                    : daysUntilExpiry <= 7 ? '⚠️ Vence en 7 días'
                    : daysUntilExpiry <= 15 ? '⚠️ Vence en 15 días'
                    : daysUntilExpiry <= 30 ? '📋 Vence en 30 días'
                    : '✅ Vigente'
                    : '❓ Sin fecha'
            };
        });

        // Project-level policies
        const projectPolicies = state.projectPolicies || [
            { type: 'Todo Riesgo Construcción', company: 'San Cristóbal Seguros', status: 'VIGENTE', expirationDate: '2027-03-15', coverage: '$50.000.000 ARS' },
            { type: 'Responsabilidad Civil', company: 'La Meridional', status: 'VIGENTE', expirationDate: '2027-01-20', coverage: '$20.000.000 ARS' },
            { type: 'Caución por Anticipo', company: 'Fianzas y Crédito', status: 'VIGENTE', expirationDate: '2026-12-31', coverage: '$5.000.000 ARS' }
        ];

        // Compliance summary
        const totalWorkers = Object.keys(artPolicies).length || (state.workerRegistry || []).length;
        const artVigentes = art.filter(a => a.status === 'VIGENTE').length;
        const artVencidas = art.filter(a => a.status === 'VENCIDA').length;
        const proximasAVencer = art.filter(a => a.daysUntilExpiry > 0 && a.daysUntilExpiry <= 30).length;

        return Response.json({
            art: {
                policies: art,
                summary: {
                    total: totalWorkers,
                    vigentes: artVigentes,
                    vencidas: artVencidas,
                    proximasAVencer,
                    complianceRate: totalWorkers > 0 ? Math.round((artVigentes / totalWorkers) * 100) : 0
                }
            },
            projectPolicies,
            legal: {
                ley: 'Ley 24.557 — Riesgos del Trabajo',
                srt: 'SRT Res. 319/99',
                cobertura: 'Obligatoria para todo personal en obra'
            }
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
