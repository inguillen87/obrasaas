import { getAppState, saveAppState } from '@/lib/db';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

// GET /api/v1/hys — List Safety & Hygiene Inspection Acts & Metrics
export async function GET(request) {
    try {
        const state = await getAppState();
        const actas = state.actasHyS || [];

        const total = actas.length;
        const avgEpp = total > 0 
            ? Math.round(actas.reduce((acc, a) => acc + (a.eppCumplimientoPct || 100), 0) / total) 
            : 100;
        const lastActa = actas.length > 0 ? actas[0] : null;

        const byType = actas.reduce((acc, a) => {
            acc[a.tipo] = (acc[a.tipo] || 0) + 1;
            return acc;
        }, {});

        return Response.json({
            success: true,
            actas,
            stats: {
                totalActas: total,
                eppCumplimientoPromedio: avgEpp,
                ultimaInspeccionFecha: lastActa?.fecha || null,
                inspectorPrincipal: 'Ing. Carlos Méndez (MAT-HYS-4829)',
                marcasSRT: 'Conforme Res. SRT 299/11 & Res. 319/99',
                distribucionPorTipo: byType
            }
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/v1/hys — Create new official Safety & Hygiene Act with SHA-256 Hash
export async function POST(request) {
    try {
        const body = await request.json();
        const {
            tipo = 'Checklist EPP',
            inspectorHyS = 'Ing. Carlos Méndez',
            matricula = 'MAT-HYS-4829',
            estadoClima = 'Despejado, 20°C',
            eppCumplimientoPct = 100,
            observaciones = '',
            fotos = [],
            eppChecklist = []
        } = body;

        const state = await getAppState();
        state.actasHyS = state.actasHyS || [];

        const todayStr = new Date().toISOString().split('T')[0];
        const newId = `hys-${Date.now().toString(36)}`;

        // Cryptographic SHA-256 Token
        const rawPayload = JSON.stringify({
            id: newId,
            fecha: todayStr,
            inspector: inspectorHyS,
            matricula,
            tipo,
            eppPct: eppCumplimientoPct,
            obs: observaciones,
            ts: Date.now()
        });
        const firmaToken = 'SHA256:' + createHash('sha256').update(rawPayload).digest('hex');

        const newActa = {
            id: newId,
            fecha: body.fecha || todayStr,
            inspectorHyS,
            matricula,
            tipo,
            estadoClima,
            eppCumplimientoPct: Number(eppCumplimientoPct),
            observaciones: observaciones || 'Inspección de rutina completada sin no conformidades graves.',
            fotos: Array.isArray(fotos) ? fotos : [],
            eppChecklist: Array.isArray(eppChecklist) ? eppChecklist : [
                { item: 'Cascos de Seguridad Dieléctricos', cumplido: true },
                { item: 'Calzado de Seguridad con Puntera de Acero', cumplido: true },
                { item: 'Protección Ocular & Auditiva', cumplido: true },
                { item: 'Arneses y Líneas de Vida en Altura', cumplido: eppCumplimientoPct >= 95 }
            ],
            firmaDigitalToken: firmaToken,
            obraId: state.projectConfig?.id || 'obra-palermo-01',
            createdAt: new Date().toISOString()
        };

        // Insert at beginning (most recent first)
        state.actasHyS.unshift(newActa);

        // Cross-sync into libro de obra as official safety log
        state.libroObra = state.libroObra || [];
        const safetySummary = `[ACTA HyS ${newActa.tipo}] Cumplimiento EPP: ${newActa.eppCumplimientoPct}%. ${newActa.observaciones}. Inspector: ${newActa.inspectorHyS} (${newActa.matricula}). Hash: ${firmaToken.slice(0, 16)}...`;
        
        const existingEntry = state.libroObra.find(e => e.date === todayStr);
        if (existingEntry) {
            existingEntry.safety = existingEntry.safety && existingEntry.safety !== 'Sin incidentes' 
                ? `${existingEntry.safety} | ${safetySummary}`
                : safetySummary;
        } else {
            state.libroObra.unshift({
                id: `lo-${Date.now().toString(36)}`,
                date: todayStr,
                weather: estadoClima,
                temperature: '21',
                workersPresent: 14,
                tasksPerformed: 'Inspección técnica y operativa de seguridad e higiene laboral.',
                observations: 'Acta oficial de seguridad asentada en libro.',
                incidents: [],
                materialsReceived: '',
                safety: safetySummary,
                signedBy: `${inspectorHyS} (HyS) & Arq. Marcelo Guillén (Director)`,
                hash: firmaToken,
                createdAt: new Date().toISOString()
            });
        }

        await saveAppState(state);

        return Response.json({
            success: true,
            acta: newActa,
            message: `Acta de Higiene y Seguridad registrada con firma criptográfica ${firmaToken.slice(0, 20)}...`
        }, { status: 201 });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
