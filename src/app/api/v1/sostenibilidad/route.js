import { getAppState, saveAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/sostenibilidad — Timber Framing & Sustainable Modular Metrics
export async function GET(request) {
    try {
        const state = await getAppState();
        const metrics = state.woodModularMetrics || {
            m3MaderaInstalada: 48.5,
            especies: ['Pino Elliotis Tratado CCA', 'Eucalipto Grandis Laminado (Glulam)'],
            certificacion: 'FSC / PEFC Cadena de Custodia #ARG-2026-442',
            kgCO2CapturadoTotal: 43650,
            kgCO2EvitadoVsHormigon: 31525,
            reduccionHuellaPct: 68.4,
            modulosOffSite: {
                total: 16,
                completadosTaller: 14,
                montadosObra: 10,
                enTransporte: 2,
                tiempoMontajePromedioHoras: 4.2
            },
            tornilleriaFijaciones: {
                totalProyectado: 2400,
                instalados: 1850,
                proveedor: 'Rothoblaas / Heco-Topix Estructural',
                resistenciaCertificadaKN: 28.5,
                calibracionDinamométrica: 'Conforme IRAM 11556'
            },
            eficienciaTermicaK: 0.28,
            ahorroTiempoSemanas: 6.5,
            tipoSistema: 'Wood Frame Industrializado + CLT Muros Portantes'
        };

        if (!metrics.kgCO2CapturadoTotal || metrics.kgCO2CapturadoTotal === 0) {
            metrics.m3MaderaInstalada = metrics.m3MaderaInstalada || 48.5;
            metrics.kgCO2CapturadoTotal = Math.round(metrics.m3MaderaInstalada * 900);
            metrics.kgCO2EvitadoVsHormigon = metrics.kgCO2EvitadoVsHormigon || Math.round(metrics.m3MaderaInstalada * 650);
            metrics.reduccionHuellaPct = metrics.reduccionHuellaPct || 68.4;
        }

        const totalModules = metrics.modulosOffSite?.total || 16;
        const mountedModules = metrics.modulosOffSite?.montadosObra || 10;
        const percentMounted = Math.round((mountedModules / totalModules) * 100);

        const totalFasteners = metrics.tornilleriaFijaciones?.totalProyectado || 2400;
        const installedFasteners = metrics.tornilleriaFijaciones?.instalados || 1850;
        const percentFasteners = Math.round((installedFasteners / totalFasteners) * 100);

        return Response.json({
            success: true,
            metrics,
            derived: {
                percentMounted,
                percentFasteners,
                toneladasCO2Netas: Number((metrics.kgCO2CapturadoTotal / 1000).toFixed(1)),
                toneladasCO2Evitadas: Number((metrics.kgCO2EvitadoVsHormigon / 1000).toFixed(1)),
                equivalenteArbolesPlantados: Math.round(metrics.kgCO2CapturadoTotal / 22), // 1 árbol absorbe ~22kg CO2/año
                ahorroTermicoAnualPct: 42,
                directoraEspecialista: 'Arq. María Victoria Schiaffino'
            }
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/v1/sostenibilidad — Update Module Assembly or Fastener Stock
export async function POST(request) {
    try {
        const body = await request.json();
        const { action = 'update_assembly', montadosDelta = 0, tornillosDelta = 0 } = body;
        const state = await getAppState();
        
        state.woodModularMetrics = state.woodModularMetrics || {};
        state.woodModularMetrics.modulosOffSite = state.woodModularMetrics.modulosOffSite || {
            total: 16,
            completadosTaller: 14,
            montadosObra: 10,
            enTransporte: 2,
            tiempoMontajePromedioHoras: 4.2
        };

        if (action === 'update_assembly') {
            const currentMounted = state.woodModularMetrics.modulosOffSite.montadosObra;
            const newMounted = Math.min(
                state.woodModularMetrics.modulosOffSite.total,
                Math.max(0, currentMounted + Number(montadosDelta))
            );
            state.woodModularMetrics.modulosOffSite.montadosObra = newMounted;

            if (tornillosDelta) {
                state.woodModularMetrics.tornilleriaFijaciones = state.woodModularMetrics.tornilleriaFijaciones || {};
                const currentFasteners = state.woodModularMetrics.tornilleriaFijaciones.instalados || 1850;
                state.woodModularMetrics.tornilleriaFijaciones.instalados = Math.min(
                    state.woodModularMetrics.tornilleriaFijaciones.totalProyectado || 2400,
                    currentFasteners + Number(tornillosDelta)
                );
            }

            await saveAppState(state);

            return Response.json({
                success: true,
                modulosOffSite: state.woodModularMetrics.modulosOffSite,
                tornilleriaFijaciones: state.woodModularMetrics.tornilleriaFijaciones,
                message: `Montaje de módulos actualizado: ${newMounted}/${state.woodModularMetrics.modulosOffSite.total} ensamblados en obra`
            });
        }

        return Response.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
