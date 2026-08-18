import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/uocra — UOCRA CCT worker categories, daily wages, and compliance data
export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return Response.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const state = await getAppState();
        const workers = state.workerRegistry || [];

        // UOCRA CCT 76/75 — Categorías y Jornales (valores actualizados Ago 2026)
        const categorias = [
            { id: 'oficial', nombre: 'Oficial', jornal: 28500, adicional_zona: 0, presentismo: 2850 },
            { id: 'oficial_esp', nombre: 'Oficial Especializado', jornal: 31000, adicional_zona: 0, presentismo: 3100 },
            { id: 'medio_oficial', nombre: 'Medio Oficial', jornal: 25800, adicional_zona: 0, presentismo: 2580 },
            { id: 'ayudante', nombre: 'Ayudante', jornal: 23500, adicional_zona: 0, presentismo: 2350 },
            { id: 'sereno', nombre: 'Sereno / Vigilador', jornal: 22000, adicional_zona: 0, presentismo: 2200 },
            { id: 'guinchero', nombre: 'Guinchero', jornal: 30000, adicional_zona: 0, presentismo: 3000 },
            { id: 'chofer', nombre: 'Chofer de Equipo Pesado', jornal: 31500, adicional_zona: 0, presentismo: 3150 }
        ];

        // Map workers to UOCRA categories
        const workerCompliance = workers.map(w => {
            const trade = (w.trade || w.role || '').toLowerCase();
            let category = 'ayudante'; // Default
            if (trade.includes('oficial') && trade.includes('especial')) category = 'oficial_esp';
            else if (trade.includes('oficial') || trade.includes('albañil')) category = 'oficial';
            else if (trade.includes('medio')) category = 'medio_oficial';
            else if (trade.includes('plomero') || trade.includes('electricista') || trade.includes('gasista')) category = 'oficial_esp';
            else if (trade.includes('guinch')) category = 'guinchero';
            else if (trade.includes('chofer')) category = 'chofer';

            const cat = categorias.find(c => c.id === category);
            
            return {
                name: w.name,
                dni: w.dni,
                trade: w.trade || w.role,
                categoriaUOCRA: cat.nombre,
                jornalDiario: cat.jornal,
                presentismo: cat.presentismo,
                jornalConPresentismo: cat.jornal + cat.presentismo,
                quincenal: (cat.jornal + cat.presentismo) * 12, // 12 days per quincena (weekdays)
                artStatus: state.artPolicies?.[w.name]?.status || 'SIN PÓLIZA',
                artCompany: state.artPolicies?.[w.name]?.company || 'Sin asignar'
            };
        });

        // Calculate totals
        const totalJornalDiario = workerCompliance.reduce((s, w) => s + w.jornalConPresentismo, 0);
        const totalQuincenal = workerCompliance.reduce((s, w) => s + w.quincenal, 0);
        const totalMensual = totalQuincenal * 2;

        // Compliance alerts
        const sinART = workerCompliance.filter(w => w.artStatus === 'SIN PÓLIZA' || w.artStatus === 'VENCIDA');
        const artVencidas = workerCompliance.filter(w => w.artStatus === 'VENCIDA');

        return Response.json({
            categorias,
            workers: workerCompliance,
            totals: {
                jornalDiario: totalJornalDiario,
                quincenal: totalQuincenal,
                mensual: totalMensual,
                anual: totalMensual * 12,
                cargasSociales: Math.round(totalMensual * 0.45), // ~45% employer contributions
                costoTotalMensual: totalMensual + Math.round(totalMensual * 0.45)
            },
            compliance: {
                totalWorkers: workers.length,
                sinART: sinART.length,
                artVencidas: artVencidas.length,
                compliant: workers.length - sinART.length,
                complianceRate: workers.length > 0 ? Math.round(((workers.length - sinART.length) / workers.length) * 100) : 0,
                alertas: [
                    ...sinART.map(w => `🚨 ${w.name}: ${w.artStatus}`),
                    ...artVencidas.map(w => `⚠️ ${w.name}: ART Vencida — Acceso bloqueado`)
                ]
            },
            legal: {
                cct: 'CCT 76/75 UOCRA',
                ley: 'Ley 22.250 — Régimen de la Industria de la Construcción',
                srt: 'Res. SRT 319/99',
                ieric: 'Ley 22.250 Art. 7'
            }
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
