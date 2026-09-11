import { getAppState, saveAppState } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const defaultInspections = [
    { 
        id: 'INSP-101', 
        type: 'Seguridad e Higiene', 
        icon: '👷', 
        title: 'Inspección de Seguridad e Higiene (SRT Res. 319/99)', 
        date: '2026-08-19', 
        inspector: 'Ing. Carlos Mendez', 
        status: 'APROBADA', 
        score: 92, 
        passed: 7, 
        failed: 1, 
        hash: 'a17c4e2b8f90123d4e56789abcdef0123456789abcdef0123456789abcdef012',
        projectId: 'obra-palermo-01',
        items: [
            { id: 'srt-1', desc: 'EPP reglamentario completo (casco con barbijero, calzado con puntera de acero)', status: 'pass', note: '100% de operarios con dotación reglamentaria' },
            { id: 'srt-2', desc: 'Matafuegos triclase ABC con tarjeta de vigencia al día', status: 'pass', note: '4 extintores de 5kg y 1 de 10kg cargados en mayo 2026' },
            { id: 'srt-3', desc: 'Tablero de obra con disyuntor diferencial de 30mA y jabalina', status: 'pass', note: 'Disyuntor Schneider testeado con disparo a 24ms' },
            { id: 'srt-4', desc: 'Vallado perimetral rígido y señalética de evacuación', status: 'pass', note: 'Carteles amarillos normalizados colocados en accesos' },
            { id: 'srt-5', desc: 'Andamios normalizados con baranda a 1m y tablones trabados', status: 'pass', note: 'Andamios tubulares con zócalo y diagonal de arriostramiento' },
            { id: 'srt-6', desc: 'Orden y desmonte de clavos en circulaciones', status: 'fail', note: 'Sector medianera este requiere retiro de despuntes de encofrado' },
            { id: 'srt-7', desc: 'Botiquín de primeros auxilios reglamentario y nómina ART', status: 'pass', note: 'Botiquín completo con gasas estériles y números de emergencia' },
            { id: 'srt-8', desc: 'Capacitación de inducción documentada (Ley 22.250)', status: 'pass', note: 'Planillas de inducción firmadas por 7 operarios presentes' }
        ]
    },
    { 
        id: 'INSP-102', 
        type: 'Estructura', 
        icon: '🏗️', 
        title: 'Inspección de Estructura pre-Hormigonado (CIRSOC 201)', 
        date: '2026-08-18', 
        inspector: 'Arq. Lucía Fernandez', 
        status: 'OBSERVADA', 
        score: 75, 
        passed: 4, 
        failed: 2, 
        hash: 'b49f28a301cde4582f098711aabbccddeeff00112233445566778899aabbccdd',
        projectId: 'obra-palermo-01',
        items: [
            { id: 'cir-1', desc: 'Armaduras ADN 420 limpias de óxido no adherente y aceites', status: 'pass', note: 'Acero en vigas V-101 y V-102 limpio y sin deformaciones' },
            { id: 'cir-2', desc: 'Recubrimiento geométrico mínimo con separadores de mortero', status: 'fail', note: 'Faltan separadores en cara inferior de viga cinta sector balcón' },
            { id: 'cir-3', desc: 'Empalmes por yuxtaposición conformes a plano estructural', status: 'pass', note: 'Longitud de solape 55 diámetros verificado conforme a cálculo' },
            { id: 'cir-4', desc: 'Encofrados estancos, aplomados y apuntalados', status: 'pass', note: 'Puntales telescópicos metálicos fijados con doble cuña' },
            { id: 'cir-5', desc: 'Pases de cañerías sanitarias y eléctricas fijados rígidamente', status: 'fail', note: 'Pase cloacal de 110mm sin asegurar; riesgo de corrimiento' },
            { id: 'cir-6', desc: 'Testigos de nivel de colado replanteados con nivel óptico', status: 'pass', note: 'Espesor de losa de 14cm verificado en 6 testigos' }
        ]
    },
    { 
        id: 'INSP-103', 
        type: 'Instalación Eléctrica', 
        icon: '⚡', 
        title: 'Verificación de Instalación Eléctrica (AEA 90364)', 
        date: '2026-08-17', 
        inspector: 'Tec. Marcelo Rojas', 
        status: 'RECHAZADA', 
        score: 40, 
        passed: 2, 
        failed: 4, 
        hash: 'c81a29384756abcdef1234567890fedcba0987654321abcdef0123456789abcd',
        projectId: 'obra-palermo-01',
        items: [
            { id: 'elec-1', desc: 'Puesta a tierra con jabalina y resistencia < 10 Ohms', status: 'fail', note: 'Resistencia medida 18.5 Ohms; requiere hincar segunda jabalina' },
            { id: 'elec-2', desc: 'Canalizaciones ignífugas embutidas sin estrangulamiento', status: 'pass', note: 'Cañería corrugada blanca ignífuga IRAM 62386 en paredes' },
            { id: 'elec-3', desc: 'Conductores IRAM con código de colores reglamentario', status: 'fail', note: 'Encontrado cable celeste utilizado como retorno en pasillo' },
            { id: 'elec-4', desc: 'Tablero seccional con disyuntores y rotulado unifilar', status: 'fail', note: 'Falta rotulado de circuitos y contratapa aislante' },
            { id: 'elec-5', desc: 'Separación estricta de circuitos IUG y TUG', status: 'pass', note: 'Bocas de iluminación y tomas cableadas por caños independientes' },
            { id: 'elec-6', desc: 'Cajas con tapas provisorias protectoras de revoque', status: 'fail', note: 'Múltiples cajas octogonales con restos de mortero cementicio' }
        ]
    },
    { 
        id: 'INSP-104', 
        type: 'Terminaciones', 
        icon: '🔍', 
        title: 'Inspección de Terminaciones y Vicios Ocultos', 
        date: '2026-08-19', 
        inspector: 'Arq. Lucía Fernandez', 
        status: 'PENDIENTE', 
        score: 0, 
        passed: 0, 
        failed: 0, 
        hash: 'd92b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        projectId: 'obra-palermo-01',
        items: []
    }
];

export async function GET(request) {
    try {
        const state = await getAppState();
        let inspecciones = state.inspecciones;
        
        if (!inspecciones || inspecciones.length === 0) {
            inspecciones = defaultInspections;
            state.inspecciones = inspecciones;
            await saveAppState(state);
        } else {
            let updated = false;
            inspecciones = inspecciones.map(insp => {
                const def = defaultInspections.find(d => d.id === insp.id);
                if (def && (!insp.items || insp.items.length === 0) && def.items && def.items.length > 0) {
                    updated = true;
                    return { ...insp, items: def.items, hash: insp.hash || def.hash };
                }
                return insp;
            });
            if (updated) {
                state.inspecciones = inspecciones;
                await saveAppState(state);
            }
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
            date: body.date || new Date().toISOString().split('T')[0],
            inspector: body.inspector || 'Ing. Carlos Mendez (Inspector Jefe)',
            projectId: body.projectId || 'obra-palermo-01'
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
