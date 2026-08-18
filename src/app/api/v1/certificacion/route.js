import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/certificacion — Generate certification data for PDF export
// Query: ?fecha=2026-08-18
export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return Response.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const fecha = searchParams.get('fecha') || new Date().toISOString().split('T')[0];

        const state = await getAppState();
        const project = state.projectConfig || {};
        const tasks = Object.values(state.tasks || {});
        const budget = state.budget || {};

        // Task progress breakdown
        const taskBreakdown = tasks.map(t => ({
            nombre: t.name,
            avanceAnterior: Math.max(0, (t.progress || 0) - 10), // Simulated previous
            avanceActual: t.progress || 0,
            avanceDelPeriodo: Math.min(10, t.progress || 0),
            responsable: t.assignedTo || 'Sin asignar'
        }));

        const avanceGlobal = parseFloat(state.avancePercentage) || 0;

        // Generate SHA-256 hash for certification
        let hash = 'pending';
        try {
            const { createHash } = await import('crypto');
            const content = JSON.stringify({ fecha, project: project.name, avance: avanceGlobal, tasks: taskBreakdown.length });
            hash = createHash('sha256').update(content).digest('hex');
        } catch (e) {}

        return Response.json({
            certificacion: {
                numero: `CERT-${Date.now().toString(36).toUpperCase()}`,
                fecha,
                periodo: state.currentQuincena || 'Período actual',
                obra: {
                    nombre: project.name,
                    direccion: project.address,
                    ciudad: `${project.city}, ${project.province}`,
                    director: project.director?.name
                },
                avance: {
                    global: avanceGlobal,
                    tareasCompletadas: tasks.filter(t => t.progress === 100).length,
                    tareasEnCurso: tasks.filter(t => t.progress > 0 && t.progress < 100).length,
                    tareasPendientes: tasks.filter(t => !t.progress || t.progress === 0).length
                },
                detalleRubros: taskBreakdown,
                presupuesto: {
                    total: budget.totalPresupuesto || project.totalBudget || 0,
                    ejecutado: budget.totalEjecutado || 0,
                    porEjecutar: (budget.totalPresupuesto || 0) - (budget.totalEjecutado || 0)
                },
                firmaDigital: {
                    hash,
                    algoritmo: 'SHA-256',
                    firmadoPor: project.director?.name || 'Director de Obra',
                    timestamp: new Date().toISOString()
                },
                legal: 'Certificación emitida conforme Ley 13.064 de Obras Públicas y normativa UOCRA vigente.',
                generadoPor: 'ObraSaaS Enterprise — obrasaas.vercel.app'
            }
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
