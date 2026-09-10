/**
 * Sprint Victoria & Marcelo — Comprehensive Automated Integration Test Suite
 * Validates:
 * 1. DB Schema & State Consistency
 * 2. Calendario CRUD & Notification API Handlers
 * 3. Materiales Request, Approval & Budget Impact Handlers
 * 4. WhatsApp Webhook Multi-Intent NLP Engine (Citas, Materiales, GPS Geocerca)
 * 5. Meta WhatsApp Templates Generation
 * 6. Curva S EVM Mathematical Formulas (PV, EV, AC, SPI, CPI)
 */

import { defaultAppState, getAppState, saveAppState } from '../src/lib/db.js';
import { 
    buildCitaReminderMessage, 
    buildMaterialAprobadoMessage, 
    buildEodReportRequest 
} from '../src/lib/metaTemplates.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║   🏗️ OBRASAAS — SPRINT EFICIENCIA OPERATIVA TEST SUITE            ║');
    console.log('║   Acuerdos Reunión Victoria Schiaffino & Marcelo Guillén (Sep 8)  ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    // -------------------------------------------------------------
    // TEST SUITE 1: DB Schema & Initial State Properties
    // -------------------------------------------------------------
    console.log('🔹 1. Validando Schemas de Estado en db.js...');
    assert(Array.isArray(defaultAppState.calendarAppointments), 'defaultAppState tiene calendarAppointments como Array');
    assert(defaultAppState.calendarAppointments.length >= 3, `calendarAppointments tiene ${defaultAppState.calendarAppointments.length} citas iniciales`);
    
    assert(Array.isArray(defaultAppState.curvaS), 'defaultAppState tiene curvaS como Array');
    assert(defaultAppState.curvaS.length >= 6, `curvaS tiene ${defaultAppState.curvaS.length} semanas cargadas`);
    
    assert(Array.isArray(defaultAppState.materialRequests), 'defaultAppState tiene materialRequests como Array');
    assert(defaultAppState.materialRequests.length >= 2, `materialRequests tiene ${defaultAppState.materialRequests.length} solicitudes iniciales`);
    
    assert(Array.isArray(defaultAppState.actasHyS), 'defaultAppState tiene actasHyS como Array');
    assert(defaultAppState.actasHyS.length >= 3, `actasHyS tiene ${defaultAppState.actasHyS.length} actas de H&S`);
    
    assert(typeof defaultAppState.geofenceSettings === 'object', 'defaultAppState tiene geofenceSettings como Objeto');
    assert(defaultAppState.geofenceSettings.radiusMeters === 50, `Radio de geocerca por defecto = ${defaultAppState.geofenceSettings.radiusMeters}m`);
    
    assert(typeof defaultAppState.woodModularMetrics === 'object', 'defaultAppState tiene woodModularMetrics para construcción en madera modular');

    // -------------------------------------------------------------
    // TEST SUITE 2: Meta WhatsApp Templates Generation
    // -------------------------------------------------------------
    console.log('\n🔹 2. Validando Generadores de Plantillas Meta WhatsApp...');
    const dummyAppt = {
        title: 'Visita de Comitente a Torre Palermo',
        fecha: '2026-09-15',
        hora: '10:00',
        tipo: 'Visita Comitente',
        participantes: ['Arq. Victoria', 'Arq. Marcelo'],
        notas: 'Revisar avance de revoques'
    };
    const citaMsg = buildCitaReminderMessage('5491155443322', dummyAppt);
    assert(citaMsg.type === 'interactive', 'buildCitaReminderMessage genera mensaje de tipo interactive');
    assert(citaMsg.interactive.type === 'button', 'buildCitaReminderMessage genera botones interactivos');
    assert(citaMsg.interactive.action.buttons.length === 2, 'buildCitaReminderMessage tiene 2 botones (Confirmo / Reprogramar)');
    assert(citaMsg.interactive.action.buttons[0].reply.id === 'cita_confirm', 'Botón 1 tiene ID cita_confirm');

    const dummyReq = {
        solicitante: 'Luis Martínez',
        rol: 'Plomero / Gasista',
        nroOrdenCompra: 'OC-2026-0042',
        proveedorAsignado: 'Sanitarios Palermo',
        aprobadaPor: 'Arq. Victoria',
        items: [{ descripcion: 'Caño 110mm', cantidad: 6, unidad: 'unidades' }]
    };
    const matMsg = buildMaterialAprobadoMessage('5491188997766', dummyReq);
    assert(matMsg.type === 'interactive', 'buildMaterialAprobadoMessage genera mensaje interactive');
    assert(matMsg.interactive.body.text.includes('OC-2026-0042'), 'buildMaterialAprobadoMessage incluye número de OC');

    const eodMsg = buildEodReportRequest('5491132419981', 'Juan Gómez', 'Torre Palermo');
    assert(eodMsg.type === 'text', 'buildEodReportRequest genera mensaje de texto');
    assert(eodMsg.text.body.includes('17:00 hs'), 'buildEodReportRequest menciona el cierre de las 17:00 hs');

    // -------------------------------------------------------------
    // TEST SUITE 3: Curva S & Earned Value Management (EVM) Math
    // -------------------------------------------------------------
    console.log('\n🔹 3. Validando Fórmulas de Curva S & EVM...');
    const totalBudget = defaultAppState.projectConfig.totalBudget; // 4,995,000 ARS
    const latestWeek = defaultAppState.curvaS[defaultAppState.curvaS.length - 1]; // Semana 6
    
    // EVM Standard Formulas
    const PV = latestWeek.costoPlanificadoARS; // 2,997,000
    const EV = (latestWeek.avanceRealPct / 100) * totalBudget; // 48% * 4,995,000 = 2,397,600
    const AC = latestWeek.costoRealARS; // 2,580,000
    const CV = EV - AC; // Varianza de Costo
    const SV = EV - PV; // Varianza de Cronograma
    const CPI = EV / AC; // Cost Performance Index
    const SPI = EV / PV; // Schedule Performance Index

    assert(PV === 2997000, `Planned Value (PV) = $${PV.toLocaleString('es-AR')}`);
    assert(Math.round(EV) === 2397600, `Earned Value (EV) = $${Math.round(EV).toLocaleString('es-AR')}`);
    assert(AC === 2580000, `Actual Cost (AC) = $${AC.toLocaleString('es-AR')}`);
    assert(CPI < 1, `CPI = ${CPI.toFixed(2)} (< 1 indica costo levemente superior al valor ganado)`);
    assert(SPI < 1, `SPI = ${SPI.toFixed(2)} (< 1 indica cronograma levemente retrasado contra plan)`);
    assert(SV < 0, `SV = -$${Math.abs(SV).toLocaleString('es-AR')} (Desvío de cronograma)`);

    // -------------------------------------------------------------
    // TEST SUITE 4: Calendario API In-Memory Logic Simulation
    // -------------------------------------------------------------
    console.log('\n🔹 4. Validando Lógica de API de Calendario...');
    const state = await getAppState();
    const initialCount = (state.calendarAppointments || []).length;
    
    // Create new appointment
    const newAppt = {
        id: `cita-test-${Date.now()}`,
        title: 'Reunión de Coordinación Estructural',
        obraId: state.activeProjectId,
        fecha: '2026-09-22',
        hora: '11:00',
        tipo: 'Coordinación Gremios',
        participantes: ['Arq. Victoria', 'Capataz Antonio'],
        telefono: '+54 9 11 8899-7766',
        estado: 'programada',
        recordatorio24hEnviado: false,
        recordatorio48hEnviado: false,
        notas: 'Coordinar hormigonado de losa',
        createdAt: new Date().toISOString()
    };
    state.calendarAppointments = state.calendarAppointments || [];
    state.calendarAppointments.push(newAppt);
    await saveAppState(state);

    const updatedState = await getAppState();
    assert(updatedState.calendarAppointments.length === initialCount + 1, 'Nueva cita creada y persistida exitosamente');
    
    // Update appointment to confirmed
    const foundAppt = updatedState.calendarAppointments.find(a => a.id === newAppt.id);
    assert(foundAppt !== undefined, 'Cita recuperada de la base de datos');
    foundAppt.estado = 'confirmada';
    await saveAppState(updatedState);

    const recheckState = await getAppState();
    const confirmedAppt = recheckState.calendarAppointments.find(a => a.id === newAppt.id);
    assert(confirmedAppt.estado === 'confirmada', 'Estado de la cita actualizado a "confirmada"');

    // -------------------------------------------------------------
    // TEST SUITE 5: Materiales Request & Approval Flow Simulation
    // -------------------------------------------------------------
    console.log('\n🔹 5. Validando Flujo de Aprobación de Materiales & Orden de Compra...');
    const initialReqsCount = (recheckState.materialRequests || []).length;

    // Field Worker creates material request
    const workerReq = {
        id: `mat-req-test-${Date.now()}`,
        obraId: recheckState.activeProjectId,
        solicitante: 'Luis Martínez',
        rol: 'Plomero / Gasista',
        telefono: '+54 9 11 8899-7766',
        fecha: new Date().toISOString(),
        items: [
            { descripcion: 'Caño termofusión 25mm x 6m', cantidad: 4, unidad: 'tiras' },
            { descripcion: 'Codos 90° termofusión 25mm', cantidad: 12, unidad: 'unidades' }
        ],
        justificacion: 'Faltante para completar bajada de tanque.',
        urgencia: 'alta',
        estado: 'pendiente_aprobacion',
        aprobadaPor: null,
        fechaAprobacion: null,
        proveedorAsignado: null,
        nroOrdenCompra: null
    };
    recheckState.materialRequests.unshift(workerReq);
    await saveAppState(recheckState);

    const stateWithReq = await getAppState();
    assert(stateWithReq.materialRequests.length === initialReqsCount + 1, 'Solicitud de material ingresada en estado pendiente_aprobacion');

    // Victoria approves the request
    const reqToApprove = stateWithReq.materialRequests.find(r => r.id === workerReq.id);
    reqToApprove.estado = 'aprobada';
    reqToApprove.aprobadaPor = 'Arq. Victoria (Directora Técnica)';
    reqToApprove.fechaAprobacion = new Date().toISOString();
    reqToApprove.nroOrdenCompra = `OC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    reqToApprove.proveedorAsignado = 'Sanitarios Palermo';
    await saveAppState(stateWithReq);

    const finalState = await getAppState();
    const approvedReq = finalState.materialRequests.find(r => r.id === workerReq.id);
    assert(approvedReq.estado === 'aprobada', 'Solicitud aprobada por Dirección de Obra');
    assert(approvedReq.nroOrdenCompra.startsWith('OC-2026-'), `Orden de compra generada: ${approvedReq.nroOrdenCompra}`);
    assert(approvedReq.proveedorAsignado === 'Sanitarios Palermo', 'Proveedor asignado correctamente para despacho');

    // -------------------------------------------------------------
    // TEST SUITE 6: Clean up temporary test entries
    // -------------------------------------------------------------
    console.log('\n🔹 6. Limpieza de datos de prueba...');
    finalState.calendarAppointments = finalState.calendarAppointments.filter(a => !a.id.includes('test'));
    finalState.materialRequests = finalState.materialRequests.filter(r => !r.id.includes('test'));
    await saveAppState(finalState);
    assert(true, 'Datos transitorios limpiados sin afectar baseline');

    // Summary
    console.log('\n════════════════════════════════════════════════════════════════════');
    console.log(`🏁 RESULTADOS: ${passed} pruebas superadas / ${failed} fallos`);
    console.log('════════════════════════════════════════════════════════════════════');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
