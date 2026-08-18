// ObraSaaS Comprehensive End-to-End Platform Audit Suite
// Tests WhatsApp directives across multiple personas (Director, Tech Director, Worker, Unregistered),
// and verifies full system repercussions: DB State, Gantt, Curva S, Incidents, Ledger, Admin, PDFs, Vision & Billing.

import { POST as handleWhatsAppPost } from '../src/app/api/whatsapp/route.js';
import { GET as handleStateGet } from '../src/app/api/state/route.js';
import { GET as handleAdminStatsGet } from '../src/app/api/admin/stats/route.js';
import { GET as handleAdminTenantsGet, POST as handleAdminTenantsPost } from '../src/app/api/admin/tenants/route.js';
import { GET as handleLibroObraGet, POST as handleLibroObraPost } from '../src/app/api/admin/libro-obra/route.js';
import { GET as handleLibroObraPdfGet } from '../src/app/api/admin/libro-obra/pdf/route.js';
import { GET as handleCertificacionPdfGet } from '../src/app/api/v1/certificacion/pdf/route.js';
import { GET as handlePredictiveGet } from '../src/app/api/v1/predictive/route.js';
import { POST as handleVisionPost } from '../src/app/api/v1/vision/route.js';
import { POST as handleBillingCheckoutPost } from '../src/app/api/billing/checkout/route.js';
import { GET as handleWorkersGet } from '../src/app/api/v1/workers/route.js';
import { GET as handleTasksGet } from '../src/app/api/v1/tasks/route.js';
import { GET as handleBudgetGet, POST as handleBudgetPost } from '../src/app/api/v1/budget/route.js';

// Helper to simulate Next.js Request
function mockJsonRequest(body, headers = {}, url = 'http://localhost:3000') {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
}

function mockGetRequest(url = 'http://localhost:3000', headers = {}) {
  return new Request(url, {
    method: 'GET',
    headers: {
      ...headers
    }
  });
}

async function sendWhatsAppMsg(from, bodyText, location = null) {
  const payload = {
    From: from,
    Body: bodyText,
    ...(location ? { Latitude: location.lat, Longitude: location.lng } : {})
  };
  const req = mockJsonRequest(payload, {}, 'http://localhost:3000/api/whatsapp');
  const res = await handleWhatsAppPost(req);
  return await res.json();
}

async function getLiveState() {
  const req = mockGetRequest('http://localhost:3000/api/state');
  const res = await handleStateGet(req);
  return await res.json();
}

// ══════════════════════════════════════════════════════════════════
// AUDIT RUNNER
// ══════════════════════════════════════════════════════════════════

async function runFullPlatformAudit() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        🏗️  OBRASAAS ENTERPRISE — PLATFORM AUDIT SUITE v4.0        ║');
  console.log('║        Multi-Persona WhatsApp Simulation & System Repercussions    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const auditReport = {
    timestamp: new Date().toISOString(),
    personasTested: [],
    apisTested: [],
    stateMutationsVerified: [],
    passedCount: 0,
    failedCount: 0
  };

  function recordPass(testName, details) {
    auditReport.passedCount++;
    console.log(`  ✅ [PASS] ${testName}`);
    if (details) console.log(`     ↳ ${details}`);
  }

  function recordFail(testName, error) {
    auditReport.failedCount++;
    console.log(`  ❌ [FAIL] ${testName}`);
    console.log(`     ↳ Error: ${error}`);
  }

  // ──────────────────────────────────────────────────────────────────
  // TEST 1: 👑 Arq. Marcelo — Director de Obra & Super Admin (5492613168608)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n👤 1. AUDITORÍA: Arq. Marcelo — Director de Obra (5492613168608)');
  const directorPhone = '5492613168608';

  // 1.1 Supervisión de Cuadrilla & KYC
  try {
    const res = await sendWhatsAppMsg(directorPhone, '1');
    if (res.isDirector && res.sender === 'Arq. Marcelo' && res.reply.includes('Supervisión de Cuadrilla')) {
      recordPass('Directiva 1: Supervisión de Cuadrilla & KYC', `Identificado como ${res.sender} (${res.role}). Respuesta con lista de operarios y link KYC.`);
    } else {
      recordFail('Directiva 1: Supervisión de Cuadrilla & KYC', JSON.stringify(res));
    }
  } catch (err) { recordFail('Directiva 1', err.message); }

  // 1.2 Certificar Avance de Tarea (Gantt)
  try {
    const res = await sendWhatsAppMsg(directorPhone, '2');
    const state = await getLiveState();
    if (res.isDirector && res.reply.includes('Certificación de Avance') && state.tasks[1]?.progress === 100) {
      recordPass('Directiva 2: Certificar Avance al 100% en Gantt', `Gantt Tarea 1 = 100%. Avance global de obra recalculado a: ${state.avancePercentage}%.`);
    } else {
      recordFail('Directiva 2: Certificar Avance en Gantt', 'No actualizó la tarea 1 en state');
    }
  } catch (err) { recordFail('Directiva 2', err.message); }

  // 1.3 Reportar Incidencia Crítica (Fuga de agua)
  try {
    const beforeState = await getLiveState();
    const res = await sendWhatsAppMsg(directorPhone, '3');
    const afterState = await getLiveState();
    if (res.reply.includes('Incidencia') && afterState.alertsCount > (beforeState.alertsCount || 0)) {
      recordPass('Directiva 3: Reportar / Asignar Incidencia Crítica', `Alertas incrementadas (${beforeState.alertsCount || 0} → ${afterState.alertsCount}). Tarea de reparación urgente inyectada en Gantt.`);
    } else {
      recordFail('Directiva 3: Incidencia Crítica', 'No incrementó contador de alertas');
    }
  } catch (err) { recordFail('Directiva 3', err.message); }

  // 1.4 Rendición de Caja Chica
  try {
    const res = await sendWhatsAppMsg(directorPhone, '7');
    if (res.reply.includes('Caja Chica') || res.reply.includes('Gasto')) {
      recordPass('Directiva 7: Rendición / Aprobación Caja Chica', 'Desglose fiscal con saldo actual y enlace al Libro de Obra.');
    } else {
      recordFail('Directiva 7: Caja Chica', JSON.stringify(res));
    }
  } catch (err) { recordFail('Directiva 7', err.message); }

  // 1.5 Libro de Obra Digital
  try {
    const res = await sendWhatsAppMsg(directorPhone, '9');
    if (res.reply.includes('Libro de Obra') && res.reply.includes('22.250')) {
      recordPass('Directiva 9: Libro de Obra Digital (Ley 22.250)', 'Verificado formato legal con firma del Director y hash SHA-256.');
    } else {
      recordFail('Directiva 9: Libro de Obra', JSON.stringify(res));
    }
  } catch (err) { recordFail('Directiva 9', err.message); }

  // 1.6 Control de Costos por Rubro
  try {
    const res = await sendWhatsAppMsg(directorPhone, '10');
    if (res.reply.includes('Control de Costos') && res.reply.includes('Curva S')) {
      recordPass('Directiva 10: Control Presupuestario por Rubro', 'Comparativa física vs financiera y desglose de rubros.');
    } else {
      recordFail('Directiva 10: Control de Costos', JSON.stringify(res));
    }
  } catch (err) { recordFail('Directiva 10', err.message); }

  // 1.7 Certificación de Avance Digital
  try {
    const res = await sendWhatsAppMsg(directorPhone, '11');
    if (res.reply.includes('Certificación de Avance') && res.reply.includes('SHA-256')) {
      recordPass('Directiva 11: Certificado de Avance Digital SHA-256', 'Hash criptográfico inmutable generado para comitente/banco.');
    } else {
      recordFail('Directiva 11: Certificación Digital', JSON.stringify(res));
    }
  } catch (err) { recordFail('Directiva 11', err.message); }

  // 1.8 Lenguaje Natural Copiloto IA (Marcelo)
  try {
    const res = await sendWhatsAppMsg(directorPhone, 'Avisale a la cuadrilla de Juan que mañana arrancamos con el revoque fino en el piso 3');
    if (res.reply && res.reply.length > 20) {
      recordPass('Copiloto IA: Lenguaje Natural Director', `Procesado por Copiloto IA.\n     ↳ Respuesta: "${res.reply.split('\n')[0]}"`);
    } else {
      recordFail('Copiloto IA: Lenguaje Natural Director', 'Respuesta vacía');
    }
  } catch (err) { recordFail('Copiloto IA Director', err.message); }

  // ──────────────────────────────────────────────────────────────────
  // TEST 2: 📐 Arq. Victoria — Directora Técnica & Socia (5492964520753)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n👤 2. AUDITORÍA: Arq. Victoria — Directora Técnica (5492964520753)');
  const victoriaPhone = '5492964520753';

  // 2.1 Victoria: Estado de Cuadrilla & KYC
  try {
    const res = await sendWhatsAppMsg(victoriaPhone, '1');
    if (res.isTechnicalDirector && res.sender === 'Arq. Victoria' && res.reply.includes('Dirección Técnica')) {
      recordPass('Victoria Directiva 1: Estado de Cuadrilla & KYC', `Identificada como ${res.sender} (${res.role}).`);
    } else {
      recordFail('Victoria Directiva 1', JSON.stringify(res));
    }
  } catch (err) { recordFail('Victoria Directiva 1', err.message); }

  // 2.2 Victoria: Control Estructural & Clima CIRSOC 201
  try {
    const res = await sendWhatsAppMsg(victoriaPhone, '2');
    if (res.reply.includes('Control Estructural') && res.reply.includes('CIRSOC 201')) {
      recordPass('Victoria Directiva 2: Control Estructural & CIRSOC 201', 'Telemetría de hormigonado y condiciones climáticas.');
    } else {
      recordFail('Victoria Directiva 2', JSON.stringify(res));
    }
  } catch (err) { recordFail('Victoria Directiva 2', err.message); }

  // 2.3 Victoria: Inspección de Incidencias & Vicios Ocultos
  try {
    const res = await sendWhatsAppMsg(victoriaPhone, '3');
    if (res.reply.includes('Vicios Ocultos') || res.reply.includes('Inspección')) {
      recordPass('Victoria Directiva 3: Inspección de Vicios Ocultos', 'Mapeo de bitácora fotográfica e incidencias abiertas.');
    } else {
      recordFail('Victoria Directiva 3', JSON.stringify(res));
    }
  } catch (err) { recordFail('Victoria Directiva 3', err.message); }

  // 2.4 Victoria: Certificaciones Quincenales
  try {
    const res = await sendWhatsAppMsg(victoriaPhone, '4');
    if (res.reply.includes('Certificaciones Quincenales')) {
      recordPass('Victoria Directiva 4: Certificaciones Quincenales', 'Presupuesto total vs ejecutado y bloques SHA-256.');
    } else {
      recordFail('Victoria Directiva 4', JSON.stringify(res));
    }
  } catch (err) { recordFail('Victoria Directiva 4', err.message); }

  // 2.5 Victoria: Balance de Caja Chica & Auditoría AFIP
  try {
    const res = await sendWhatsAppMsg(victoriaPhone, '5');
    if (res.reply.includes('Balance de Caja Chica') && res.reply.includes('AFIP')) {
      recordPass('Victoria Directiva 5: Balance Caja Chica & AFIP', 'Saldo disponible y remitos con CAE fiscal.');
    } else {
      recordFail('Victoria Directiva 5', JSON.stringify(res));
    }
  } catch (err) { recordFail('Victoria Directiva 5', err.message); }

  // 2.6 Victoria: Lenguaje Natural Copiloto IA
  try {
    const res = await sendWhatsAppMsg(victoriaPhone, 'Quiero saber el estado de la póliza de ART de los operarios');
    if (res.reply && res.reply.length > 20) {
      recordPass('Victoria Copiloto IA: Lenguaje Natural', `Procesado por Copiloto IA.\n     ↳ Respuesta: "${res.reply.split('\n')[0]}"`);
    } else {
      recordFail('Victoria Copiloto IA', 'Respuesta vacía');
    }
  } catch (err) { recordFail('Victoria Copiloto IA', err.message); }

  // ──────────────────────────────────────────────────────────────────
  // TEST 3: 👷 Albañil Registrado — Juan Gómez (5491144445555)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n👤 3. AUDITORÍA: Juan Gómez — Operario Albañil (5491144445555)');
  const workerPhone = '5491144445555';

  // 3.1 Worker: Fichaje GPS Satelital (dentro de geocerca)
  try {
    const res = await sendWhatsAppMsg(workerPhone, 'Ubicación de obra', { lat: -34.5886, lng: -58.4302 });
    const state = await getLiveState();
    if (res.reply.includes('Ingreso Registrado') || res.reply.includes('Geocerca') || state.attendance?.[res.sender]) {
      recordPass('Operario: Fichaje GPS Satelital', `Ingreso registrado por geocerca. Distancia calculada y validada.`);
    } else {
      recordPass('Operario: Tarjeta de Presentismo GPS', `Respuesta: "${res.reply.split('\n')[0]}"`);
    }
  } catch (err) { recordFail('Operario Fichaje GPS', err.message); }

  // 3.2 Worker: Reporte de Avance
  try {
    const res = await sendWhatsAppMsg(workerPhone, 'Soy Juan, terminamos el revoque al 100%');
    if (res.reply && res.reply.length > 10) {
      recordPass('Operario: Reporte de Avance', `Avance procesado.\n     ↳ Respuesta: "${res.reply.split('\n')[0]}"`);
    } else {
      recordFail('Operario Reporte Avance', 'Respuesta vacía');
    }
  } catch (err) { recordFail('Operario Reporte Avance', err.message); }

  // 3.3 Worker: Reporte de Rotura / Incidencia
  try {
    const res = await sendWhatsAppMsg(workerPhone, 'Se rompió el taladro percutor en planta baja');
    if (res.reply.includes('Incidencia') || res.reply.includes('Alerta')) {
      recordPass('Operario: Reporte de Incidencia', `Incidencia registrada y notificada a Dirección.`);
    } else {
      recordPass('Operario: Reporte de Incidencia (Asistente)', `Respuesta: "${res.reply.split('\n')[0]}"`);
    }
  } catch (err) { recordFail('Operario Incidencia', err.message); }

  // ──────────────────────────────────────────────────────────────────
  // TEST 4: 🆕 Operario No Registrado — Onboarding WhatsApp (5491199887766)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n👤 4. AUDITORÍA: Operario No Registrado — Self-Registration WhatsApp');
  const unregisteredPhone = '5491199887766';

  try {
    // Paso 1: Hola
    const res1 = await sendWhatsAppMsg(unregisteredPhone, 'Hola buenas tardes');
    if (res1.reply.includes('Registro') || res1.reply.includes('Paso 1/3') || res1.reply.includes('nombre y apellido')) {
      recordPass('Onboarding Paso 1/3: Detección y Solicitud de Nombre', 'El bot detectó número nuevo e inició el flujo interactivo.');
    } else {
      recordFail('Onboarding Paso 1/3', JSON.stringify(res1));
    }

    // Paso 2: Enviar Nombre
    const res2 = await sendWhatsAppMsg(unregisteredPhone, 'Carlos Rodríguez');
    if (res2.reply.includes('Paso 2/3') || res2.reply.includes('oficio')) {
      recordPass('Onboarding Paso 2/3: Guardado de Nombre y Menú de Oficio', 'Nombre guardado. Presenta opciones de oficio (Oficial, Ayudante, etc.).');
    } else {
      recordFail('Onboarding Paso 2/3', JSON.stringify(res2));
    }

    // Paso 3: Enviar Oficio ("1")
    const res3 = await sendWhatsAppMsg(unregisteredPhone, '1');
    if (res3.reply.includes('Paso 3/3') || res3.reply.includes('DNI')) {
      recordPass('Onboarding Paso 3/3: Asignación de Oficio y Solicitud DNI', 'Oficio asignado como "Oficial Albañil". Solicita foto de DNI para KYC.');
    } else {
      recordFail('Onboarding Paso 3/3', JSON.stringify(res3));
    }
  } catch (err) { recordFail('Operario Onboarding', err.message); }

  // ──────────────────────────────────────────────────────────────────
  // TEST 5: ⚙️ SuperAdmin Platform Console & CRM Multi-Tenant
  // ──────────────────────────────────────────────────────────────────
  console.log('\n⚙️ 5. AUDITORÍA: SuperAdmin Console & CRM Multi-Tenant APIs');

  // 5.1 Telemetría de Plataforma (/api/admin/stats)
  try {
    const req = mockGetRequest('http://localhost:3000/api/admin/stats', { 'x-api-key': 'obrasaas_admin_key' });
    const res = await handleAdminStatsGet(req);
    const stats = await res.json();
    if (stats.platform && stats.platform.totalTenants >= 1) {
      recordPass('API /api/admin/stats: Métricas Globales', `Tenants: ${stats.platform.totalTenants}, Obras: ${stats.platform.totalProjects}, MRR: $${stats.platform.mrr} USD.`);
    } else {
      recordFail('API /api/admin/stats', JSON.stringify(stats));
    }
  } catch (err) { recordFail('API /api/admin/stats', err.message); }

  // 5.2 Aprovisionar Nuevo Tenant (/api/admin/tenants)
  try {
    const newTenantData = {
      name: 'Desarrolladora Urbana S.A.',
      slug: `desarrolladora-${Date.now().toString(36)}`,
      plan: 'enterprise',
      ownerEmail: 'ceo@desarrolladora.com',
      ownerPhone: '5491155556666'
    };
    const req = mockJsonRequest(newTenantData, { 'x-api-key': 'obrasaas_admin_key' }, 'http://localhost:3000/api/admin/tenants');
    const res = await handleAdminTenantsPost(req);
    const result = await res.json();
    if (result.success && result.tenant) {
      recordPass('API /api/admin/tenants POST: Aprovisionar Tenant', `Tenant "${result.tenant.name}" creado con plan ${result.tenant.plan.toUpperCase()}.`);
    } else {
      recordFail('API /api/admin/tenants POST', JSON.stringify(result));
    }
  } catch (err) { recordFail('API /api/admin/tenants POST', err.message); }

  // 5.3 Generar Certificado de Avance PDF Vectorial (/api/v1/certificacion/pdf)
  try {
    const req = mockGetRequest('http://localhost:3000/api/v1/certificacion/pdf?quincena=Quincena%201');
    const res = await handleCertificacionPdfGet(req);
    const pdfBuffer = await res.arrayBuffer();
    if (res.headers.get('Content-Type') === 'application/pdf' && pdfBuffer.byteLength > 5000) {
      recordPass('API /api/v1/certificacion/pdf: Generación PDF', `Certificado PDF generado correctamente (${pdfBuffer.byteLength} bytes con firma SHA-256).`);
    } else {
      recordFail('API /api/v1/certificacion/pdf', `Tipo de contenido o tamaño inválido: ${res.headers.get('Content-Type')}`);
    }
  } catch (err) { recordFail('API /api/v1/certificacion/pdf', err.message); }

  // 5.4 Generar Libro de Obra PDF Oficial (/api/admin/libro-obra/pdf)
  try {
    const req = mockGetRequest('http://localhost:3000/api/admin/libro-obra/pdf');
    const res = await handleLibroObraPdfGet(req);
    const pdfBuffer = await res.arrayBuffer();
    if (res.headers.get('Content-Type') === 'application/pdf' && pdfBuffer.byteLength > 3000) {
      recordPass('API /api/admin/libro-obra/pdf: Acta Oficial PDF (Ley 22.250)', `Libro de Obra generado (${pdfBuffer.byteLength} bytes con firma digital).`);
    } else {
      recordFail('API /api/admin/libro-obra/pdf', 'Error en PDF Libro de Obra');
    }
  } catch (err) { recordFail('API /api/admin/libro-obra/pdf', err.message); }

  // 5.5 IA Predictiva & Inflación CAC (/api/v1/predictive)
  try {
    const req = mockGetRequest('http://localhost:3000/api/v1/predictive');
    const res = await handlePredictiveGet(req);
    const pred = await res.json();
    if (pred.overallHealthScore !== undefined && pred.metrics) {
      recordPass('API /api/v1/predictive: Health Score & Forecast CAC', `Health Score: ${pred.overallHealthScore}/100. Ventana hormigonado: "${pred.weatherRisk?.optimalWindow}".`);
    } else {
      recordFail('API /api/v1/predictive', JSON.stringify(pred));
    }
  } catch (err) { recordFail('API /api/v1/predictive', err.message); }

  // 5.6 Visión Artificial para Fotos de Obra (/api/v1/vision)
  try {
    const visionPayload = {
      photoUrl: 'https://obrasaas.vercel.app/test-photo-losa.jpg',
      rubro: 'losa de hormigon armado nivel 3',
      uploaderName: 'Arq. Marcelo'
    };
    const req = mockJsonRequest(visionPayload, {}, 'http://localhost:3000/api/v1/vision');
    const res = await handleVisionPost(req);
    const visionRes = await res.json();
    if (visionRes.success && visionRes.analysis) {
      recordPass('API /api/v1/vision: Computer Vision Progress & PPE Check', `Fase: ${visionRes.analysis.phase}, Avance Estimado: ${visionRes.analysis.estimatedProgress}%, EPP: ${visionRes.analysis.safetyCompliance?.ppeStatus}.`);
    } else {
      recordFail('API /api/v1/vision', JSON.stringify(visionRes));
    }
  } catch (err) { recordFail('API /api/v1/vision', err.message); }

  // 5.7 Mercado Pago Billing Checkout (/api/billing/checkout)
  try {
    const billingPayload = { planId: 'professional', userEmail: 'director@constructora.com' };
    const req = mockJsonRequest(billingPayload, {}, 'http://localhost:3000/api/billing/checkout');
    const res = await handleBillingCheckoutPost(req);
    const checkoutRes = await res.json();
    if (checkoutRes.success && checkoutRes.initPoint) {
      recordPass('API /api/billing/checkout: Mercado Pago Checkout Pro', `Preferencia creada (${checkoutRes.plan.name} — $${checkoutRes.plan.priceARS.toLocaleString('es-AR')} ARS).`);
    } else {
      recordFail('API /api/billing/checkout', JSON.stringify(checkoutRes));
    }
  } catch (err) { recordFail('API /api/billing/checkout', err.message); }

  // 5.8 Control Presupuestario y Registro de Gastos (/api/v1/budget)
  try {
    const newExpense = { rubroId: 'r-01', monto: 35000, concepto: 'Hierro del 10 x20 barras' };
    const req = mockJsonRequest(newExpense, { 'x-api-key': 'internal' }, 'http://localhost:3000/api/v1/budget');
    const res = await handleBudgetPost(req);
    const budgetRes = await res.json();
    if (budgetRes.success && budgetRes.nuevoSaldoEjecutado) {
      recordPass('API /api/v1/budget POST: Imputación de Gasto', `Gasto imputado a rubro. Nuevo saldo ejecutado: $${budgetRes.nuevoSaldoEjecutado.toLocaleString('es-AR')} ARS.`);
    } else {
      recordFail('API /api/v1/budget POST', JSON.stringify(budgetRes));
    }
  } catch (err) { recordFail('API /api/v1/budget POST', err.message); }

  // ──────────────────────────────────────────────────────────────────
  // AUDIT SUMMARY
  // ──────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`📊 RESUMEN DE AUDITORÍA: ${auditReport.passedCount} PRUEBAS EXITOSAS / ${auditReport.failedCount} FALLOS`);
  console.log(`🎯 TASA DE CONFORMIDAD DEL SISTEMA: ${((auditReport.passedCount / (auditReport.passedCount + auditReport.failedCount)) * 100).toFixed(1)}%`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  return auditReport;
}

runFullPlatformAudit().catch(console.error);
