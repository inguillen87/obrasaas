import { getAppState, saveAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/budget — Get budget breakdown by rubro
export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return Response.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const state = await getAppState();
        const budget = state.budget || getDefaultBudget(state);

        // Calculate totals
        const totalPresupuesto = budget.rubros.reduce((s, r) => s + r.presupuesto, 0);
        const totalEjecutado = budget.rubros.reduce((s, r) => s + r.ejecutado, 0);
        const totalPorEjecutar = totalPresupuesto - totalEjecutado;
        const desvioGlobal = totalPresupuesto > 0 ? ((totalEjecutado / totalPresupuesto) * 100).toFixed(1) : 0;

        return Response.json({
            projectName: state.projectConfig?.name || 'Obra',
            currency: 'ARS',
            totalPresupuesto,
            totalEjecutado,
            totalPorEjecutar,
            desvioGlobal: parseFloat(desvioGlobal),
            avanceFisico: parseFloat(state.avancePercentage) || 0,
            curvaS: {
                avanceFinanciero: parseFloat(desvioGlobal),
                avanceFisico: parseFloat(state.avancePercentage) || 0,
                diferencia: (parseFloat(desvioGlobal) - (parseFloat(state.avancePercentage) || 0)).toFixed(1)
            },
            rubros: budget.rubros,
            lastUpdated: budget.lastUpdated || new Date().toISOString(),
            _links: { self: '/api/v1/budget', tasks: '/api/v1/tasks' }
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/v1/budget — Update budget (add expense to rubro)
export async function POST(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return Response.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const { rubroId, monto, concepto, proveedor, comprobante } = await request.json();
        if (!rubroId || !monto) return Response.json({ error: 'rubroId and monto required' }, { status: 400 });

        const state = await getAppState();
        state.budget = state.budget || getDefaultBudget(state);

        let rubro = state.budget.rubros.find(r => r.id === rubroId || (r.nombre || '').toLowerCase().includes(rubroId.toLowerCase()));
        if (!rubro && state.budget.rubros.length > 0) {
            rubro = state.budget.rubros[0];
        }
        if (!rubro) return Response.json({ error: 'No budget rubros available' }, { status: 404 });

        // Add expense
        rubro.ejecutado += monto;
        rubro.movimientos = rubro.movimientos || [];
        rubro.movimientos.push({
            id: `mov-${Date.now().toString(36)}`,
            monto,
            concepto: concepto || 'Gasto registrado',
            proveedor: proveedor || 'Sin especificar',
            comprobante: comprobante || null,
            fecha: new Date().toISOString(),
            registradoPor: 'API'
        });

        // Check alert threshold (80%)
        const porcentaje = (rubro.ejecutado / rubro.presupuesto) * 100;
        let alerta = null;
        if (porcentaje >= 80 && porcentaje < 100) {
            alerta = { type: 'warning', message: `⚠️ Rubro "${rubro.nombre}" al ${porcentaje.toFixed(0)}% del presupuesto` };
        } else if (porcentaje >= 100) {
            alerta = { type: 'danger', message: `🚨 Rubro "${rubro.nombre}" EXCEDIDO: ${porcentaje.toFixed(0)}%` };
        }

        state.budget.lastUpdated = new Date().toISOString();
        await saveAppState(state);

        return Response.json({
            rubro: { id: rubro.id, nombre: rubro.nombre, ejecutado: rubro.ejecutado, presupuesto: rubro.presupuesto },
            porcentaje: parseFloat(porcentaje.toFixed(1)),
            alerta,
            movimiento: rubro.movimientos[rubro.movimientos.length - 1]
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

function getDefaultBudget(state) {
    const totalBudget = state.projectConfig?.totalBudget || 4995000;
    return {
        rubros: [
            { id: 'estructura', nombre: 'Estructura (Hormigón + Hierro)', presupuesto: Math.round(totalBudget * 0.30), ejecutado: Math.round(totalBudget * 0.30 * 0.95), movimientos: [] },
            { id: 'mamposteria', nombre: 'Mampostería y Revoques', presupuesto: Math.round(totalBudget * 0.15), ejecutado: Math.round(totalBudget * 0.15 * 0.60), movimientos: [] },
            { id: 'instalaciones', nombre: 'Instalaciones (Sanitaria + Gas + Eléctrica)', presupuesto: Math.round(totalBudget * 0.18), ejecutado: Math.round(totalBudget * 0.18 * 0.30), movimientos: [] },
            { id: 'carpinteria', nombre: 'Carpintería y Aberturas', presupuesto: Math.round(totalBudget * 0.10), ejecutado: 0, movimientos: [] },
            { id: 'pintura', nombre: 'Pintura y Revestimientos', presupuesto: Math.round(totalBudget * 0.08), ejecutado: 0, movimientos: [] },
            { id: 'pisos', nombre: 'Pisos y Mesadas', presupuesto: Math.round(totalBudget * 0.07), ejecutado: 0, movimientos: [] },
            { id: 'cubierta', nombre: 'Cubierta e Impermeabilización', presupuesto: Math.round(totalBudget * 0.05), ejecutado: 0, movimientos: [] },
            { id: 'mano_obra', nombre: 'Mano de Obra (Jornales UOCRA)', presupuesto: Math.round(totalBudget * 0.05), ejecutado: Math.round(totalBudget * 0.05 * 0.50), movimientos: [] },
            { id: 'imprevistos', nombre: 'Imprevistos (5%)', presupuesto: Math.round(totalBudget * 0.02), ejecutado: 0, movimientos: [] }
        ],
        lastUpdated: new Date().toISOString()
    };
}
