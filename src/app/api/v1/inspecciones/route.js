import { getAppState, saveAppState } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const defaultInspections = [
    { id: 'INSP-101', type: 'Seguridad e Higiene', icon: '👷', title: 'Inspección de Seguridad e Higiene (SRT Res. 319/99)', date: '2026-08-19', inspector: 'Ing. Carlos Mendez', status: 'APROBADA', score: 92, passed: 11, failed: 1, items: [], projectId: 'obra-palermo-01' },
    { id: 'INSP-102', type: 'Estructura', icon: '🏗️', title: 'Inspección de Estructura pre-Hormigonado (CIRSOC 201)', date: '2026-08-18', inspector: 'Arq. Lucía Fernandez', status: 'OBSERVADA', score: 75, passed: 9, failed: 3, items: [], projectId: 'obra-palermo-01' },
    { id: 'INSP-103', type: 'Instalación Eléctrica', icon: '⚡', title: 'Verificación de Instalación Eléctrica (RIEI)', date: '2026-08-17', inspector: 'Tec. Marcelo Rojas', status: 'RECHAZADA', score: 40, passed: 4, failed: 6, items: [], projectId: 'obra-palermo-01' },
    { id: 'INSP-104', type: 'Terminaciones', icon: '🔍', title: 'Inspección de Terminaciones y Vicios Ocultos', date: '2026-08-19', inspector: 'Arq. Lucía Fernandez', status: 'PENDIENTE', score: 0, passed: 0, failed: 0, items: [], projectId: 'obra-palermo-01' }
];

export async function GET(request) {
    try {
        const state = await getAppState();
        let inspecciones = state.inspecciones;
        
        if (!inspecciones || inspecciones.length === 0) {
            inspecciones = defaultInspections;
            state.inspecciones = inspecciones;
            await saveAppState(state);
        }
        
        return Response.json({ data: inspecciones });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const state = await getAppState();
        const body = await request.json();
        
        const newInsp = {
            id: `INSP-${Math.floor(Math.random() * 1000) + 200}`,
            hash: crypto.createHash('sha256').update(JSON.stringify(body) + Date.now()).digest('hex'),
            ...body,
            date: new Date().toISOString().split('T')[0],
            inspector: 'Admin',
            projectId: 'obra-palermo-01'
        };
        
        if (!state.inspecciones) state.inspecciones = defaultInspections;
        state.inspecciones.unshift(newInsp);
        
        await saveAppState(state);
        
        return Response.json({ data: newInsp });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        const state = await getAppState();
        const body = await request.json();
        
        if (!state.inspecciones) state.inspecciones = defaultInspections;
        
        const index = state.inspecciones.findIndex(i => i.id === body.id);
        if (index === -1) {
            return Response.json({ error: 'Not found' }, { status: 404 });
        }
        
        state.inspecciones[index] = { ...state.inspecciones[index], ...body };
        await saveAppState(state);
        
        return Response.json({ data: state.inspecciones[index] });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
