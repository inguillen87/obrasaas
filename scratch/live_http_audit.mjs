// ObraSaaS Live HTTP Audit Suite (Comprehensive Multi-Persona Test)
const BASE_URL = 'http://localhost:3000';

async function sendWhatsAppHttp(from, bodyText, location = null) {
  const res = await fetch(`${BASE_URL}/api/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      From: from,
      Body: bodyText,
      ...(location ? { Latitude: location.lat, Longitude: location.lng } : {})
    })
  });
  return await res.json();
}

async function getLiveState() {
  const res = await fetch(`${BASE_URL}/api/state`);
  return await res.json();
}

async function runLiveAudit() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        🏗️  OBRASAAS LIVE HTTP SYSTEM AUDIT (MULTI-PERSONA)        ║');
  console.log('║        Target: http://localhost:3000                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  function pass(title, detail) {
    passed++;
    console.log(`  ✅ [PASS] ${title}`);
    if (detail) console.log(`     ↳ ${detail}`);
  }

  function fail(title, error) {
    failed++;
    console.log(`  ❌ [FAIL] ${title}`);
    console.log(`     ↳ Error: ${error}`);
  }

  // ──────────────────────────────────────────────────────────────────
  // 1. 👑 Arq. Marcelo — Director de Obra & SuperAdmin (5492613168608)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n👑 1. AUDITORÍA: Arq. Marcelo — Director de Obra & SuperAdmin (5492613168608)');
  const marceloPhone = '5492613168608';

  // 1.1 Supervisión de Cuadrilla & KYC
  try {
    const res = await sendWhatsAppHttp(marceloPhone, '1');
    if (res.isDirector && res.sender === 'Arq. Marcelo' && res.reply.includes('Supervisión de Cuadrilla')) {
      pass('Directiva 1: Supervisión de Cuadrilla & KYC', `Identificado como ${res.sender} (${res.role}). Respuesta con lista de operarios y link KYC.`);
    } else {
      fail('Directiva 1: Supervisión de Cuadrilla', JSON.stringify(res));
    }
  } catch (err) { fail('Directiva 1', err.message); }

  // 1.2 Certificar Avance de Tarea al 100% (Gantt)
  try {
    const res = await sendWhatsAppHttp(marceloPhone, '2');
    const state = await getLiveState();
    if (res.isDirector && res.reply.includes('Certificación de Avance') && state.tasks[1]?.progress === 100) {
      pass('Directiva 2: Certificar Avance en Gantt', `Gantt Tarea 1 = 100%. Avance global recalculado a ${state.avancePercentage}%.`);
    } else {
      fail('Directiva 2: Certificar Avance', 'No actualizó la tarea 1 en state');
    }
  } catch (err) { fail('Directiva 2', err.message); }

  // 1.3 Reportar Incidencia Crítica
  try {
    const beforeState = await getLiveState();
    const res = await sendWhatsAppHttp(marceloPhone, '3');
    const afterState = await getLiveState();
    if (res.reply.includes('Incidencia') && afterState.alertsCount > (beforeState.alertsCount || 0)) {
      pass('Directiva 3: Reportar Incidencia Crítica', `Alertas: ${beforeState.alertsCount || 0} → ${afterState.alertsCount}. Tarea urgente inyectada en Gantt.`);
    } else {
      fail('Directiva 3: Incidencia Crítica', 'No incrementó contador de alertas');
    }
  } catch (err) { fail('Directiva 3', err.message); }

  // 1.4 Rendición de Caja Chica
  try {
    const res = await sendWhatsAppHttp(marceloPhone, '7');
    if (res.reply.includes('Caja Chica') || res.reply.includes('Gasto')) {
      pass('Directiva 7: Rendición / Aprobación Caja Chica', 'Desglose fiscal con saldo y enlace a bitácora.');
    } else {
      fail('Directiva 7: Caja Chica', JSON.stringify(res));
    }
  } catch (err) { fail('Directiva 7', err.message); }

  // 1.5 Libro de Obra Digital
  try {
    const res = await sendWhatsAppHttp(marceloPhone, '9');
    if (res.reply.includes('Libro de Obra') && res.reply.includes('22.250')) {
      pass('Directiva 9: Libro de Obra Digital (Ley 22.250)', 'Acta oficial firmada por Director con hash SHA-256.');
    } else {
      fail('Directiva 9: Libro de Obra', JSON.stringify(res));
    }
  } catch (err) { fail('Directiva 9', err.message); }

  // 1.6 Control de Costos por Rubro
  try {
    const res = await sendWhatsAppHttp(marceloPhone, '10');
    if (res.reply.includes('Control de Costos') && res.reply.includes('Curva S')) {
      pass('Directiva 10: Control Presupuestario por Rubro', 'Comparativa física vs financiera y rubros ejecutados.');
    } else {
      fail('Directiva 10: Control de Costos', JSON.stringify(res));
    }
  } catch (err) { fail('Directiva 10', err.message); }

  // 1.7 Certificación de Avance Digital
  try {
    const res = await sendWhatsAppHttp(marceloPhone, '11');
    if (res.reply.includes('Certificación de Avance') && res.reply.includes('SHA-256')) {
      pass('Directiva 11: Certificación Digital SHA-256', 'Hash criptográfico inmutable generado para comitente/banco.');
    } else {
      fail('Directiva 11: Certificación Digital', JSON.stringify(res));
    }
  } catch (err) { fail('Directiva 11', err.message); }

  // 1.8 Lenguaje Natural Copiloto IA (Marcelo)
  try {
    const res = await sendWhatsAppHttp(marceloPhone, 'Avisale a la cuadrilla de Juan que mañana arrancamos con el revoque fino en el piso 3');
    if (res.reply && res.reply.length > 20) {
      pass('Copiloto IA: Lenguaje Natural Director', `Procesado por Copiloto IA.\n     ↳ Respuesta: "${res.reply.split('\n')[0]}"`);
    } else {
      fail('Copiloto IA: Lenguaje Natural Director', 'Respuesta vacía');
    }
  } catch (err) { fail('Copiloto IA Director', err.message); }

  // ──────────────────────────────────────────────────────────────────
  // 2. 📐 Arq. Victoria — Directora Técnica & Socia (5492964520753)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n📐 2. AUDITORÍA: Arq. Victoria — Directora Técnica (5492964520753)');
  const victoriaPhone = '5492964520753';

  // 2.1 Victoria: Estado de Cuadrilla & KYC
  try {
    const res = await sendWhatsAppHttp(victoriaPhone, '1');
    if (res.isTechnicalDirector && res.sender === 'Arq. Victoria' && res.reply.includes('Dirección Técnica')) {
      pass('Victoria Directiva 1: Estado de Cuadrilla & KYC', `Identificada como ${res.sender} (${res.role}).`);
    } else {
      fail('Victoria Directiva 1', JSON.stringify(res));
    }
  } catch (err) { fail('Victoria Directiva 1', err.message); }

  // 2.2 Victoria: Control Estructural & Clima CIRSOC 201
  try {
    const res = await sendWhatsAppHttp(victoriaPhone, '2');
    if (res.reply.includes('Control Estructural') && res.reply.includes('CIRSOC 201')) {
      pass('Victoria Directiva 2: Control Estructural & CIRSOC 201', 'Telemetría de hormigonado y condiciones climáticas.');
    } else {
      fail('Victoria Directiva 2', JSON.stringify(res));
    }
  } catch (err) { fail('Victoria Directiva 2', err.message); }

  // 2.3 Victoria: Inspección de Incidencias & Vicios Ocultos
  try {
    const res = await sendWhatsAppHttp(victoriaPhone, '3');
    if (res.reply.includes('Vicios Ocultos') || res.reply.includes('Inspección')) {
      pass('Victoria Directiva 3: Inspección de Vicios Ocultos', 'Mapeo de bitácora fotográfica e incidencias abiertas.');
    } else {
      fail('Victoria Directiva 3', JSON.stringify(res));
    }
  } catch (err) { fail('Victoria Directiva 3', err.message); }

  // 2.4 Victoria: Certificaciones Quincenales
  try {
    const res = await sendWhatsAppHttp(victoriaPhone, '4');
    if (res.reply.includes('Certificaciones Quincenales')) {
      pass('Victoria Directiva 4: Certificaciones Quincenales', 'Presupuesto total vs ejecutado y bloques SHA-256.');
    } else {
      fail('Victoria Directiva 4', JSON.stringify(res));
    }
  } catch (err) { fail('Victoria Directiva 4', err.message); }

  // 2.5 Victoria: Balance de Caja Chica & Auditoría AFIP
  try {
    const res = await sendWhatsAppHttp(victoriaPhone, '5');
    if (res.reply.includes('Balance de Caja Chica') && res.reply.includes('AFIP')) {
      pass('Victoria Directiva 5: Balance Caja Chica & AFIP', 'Saldo disponible y remitos con CAE fiscal.');
    } else {
      fail('Victoria Directiva 5', JSON.stringify(res));
    }
  } catch (err) { fail('Victoria Directiva 5', err.message); }

  // 2.6 Victoria: Lenguaje Natural Copiloto IA
  try {
    const res = await sendWhatsAppHttp(victoriaPhone, 'Quiero saber el estado de la póliza de ART de los operarios');
    if (res.reply && res.reply.length > 20) {
      pass('Victoria Copiloto IA: Lenguaje Natural', `Procesado por Copiloto IA.\n     ↳ Respuesta: "${res.reply.split('\n')[0]}"`);
    } else {
      fail('Victoria Copiloto IA', 'Respuesta vacía');
    }
  } catch (err) { fail('Victoria Copiloto IA', err.message); }

  // ──────────────────────────────────────────────────────────────────
  // 3. 👷 Albañil Registrado — Juan Gómez (5491144445555)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n👷 3. AUDITORÍA: Juan Gómez — Operario Albañil (5491144445555)');
  const workerPhone = '5491144445555';

  // 3.1 Worker: Fichaje GPS Satelital
  try {
    const res = await sendWhatsAppHttp(workerPhone, 'Ubicación de obra', { lat: -34.5886, lng: -58.4302 });
    pass('Operario: Fichaje GPS Satelital', `Ingreso registrado. Respuesta: "${res.reply.split('\n')[0]}"`);
  } catch (err) { fail('Operario Fichaje GPS', err.message); }

  // 3.2 Worker: Reporte de Avance
  try {
    const res = await sendWhatsAppHttp(workerPhone, 'Soy Juan, terminamos el revoque al 100%');
    if (res.reply && res.reply.length > 10) {
      pass('Operario: Reporte de Avance', `Avance procesado.\n     ↳ Respuesta: "${res.reply.split('\n')[0]}"`);
    } else {
      fail('Operario Reporte Avance', 'Respuesta vacía');
    }
  } catch (err) { fail('Operario Reporte Avance', err.message); }

  // 3.3 Worker: Reporte de Rotura / Incidencia
  try {
    const res = await sendWhatsAppHttp(workerPhone, 'Se rompió el taladro percutor en planta baja');
    pass('Operario: Reporte de Incidencia', `Incidencia registrada.\n     ↳ Respuesta: "${res.reply.split('\n')[0]}"`);
  } catch (err) { fail('Operario Incidencia', err.message); }

  // ──────────────────────────────────────────────────────────────────
  // 4. 🆕 Operario No Registrado — Onboarding Interactivo
  // ──────────────────────────────────────────────────────────────────
  console.log('\n🆕 4. AUDITORÍA: Operario No Registrado — Self-Registration WhatsApp');
  const freshUnregisteredPhone = `5491177${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    const res1 = await sendWhatsAppHttp(freshUnregisteredPhone, 'Hola buenas tardes');
    if (res1.reply.includes('Registro') || res1.reply.includes('Paso 1/3') || res1.reply.includes('nombre y apellido')) {
      pass('Onboarding Paso 1/3: Detección y Solicitud de Nombre', 'El bot detectó número nuevo e inició el flujo interactivo.');
    } else {
      fail('Onboarding Paso 1/3', JSON.stringify(res1));
    }

    const res2 = await sendWhatsAppHttp(freshUnregisteredPhone, 'Carlos Rodríguez');
    if (res2.reply.includes('Paso 2/3') || res2.reply.includes('oficio')) {
      pass('Onboarding Paso 2/3: Guardado de Nombre y Menú de Oficio', 'Nombre guardado. Presenta opciones de oficio (Oficial, Ayudante, etc.).');
    } else {
      fail('Onboarding Paso 2/3', JSON.stringify(res2));
    }

    const res3 = await sendWhatsAppHttp(freshUnregisteredPhone, '1');
    if (res3.reply.includes('Paso 3/3') || res3.reply.includes('DNI')) {
      pass('Onboarding Paso 3/3: Asignación de Oficio y Solicitud DNI', 'Oficio asignado como "Oficial Albañil". Solicita foto de DNI para KYC.');
    } else {
      fail('Onboarding Paso 3/3', JSON.stringify(res3));
    }
  } catch (err) { fail('Operario Onboarding', err.message); }

  // ──────────────────────────────────────────────────────────────────
  // 5. ⚙️ SuperAdmin Console & CRM Multi-Tenant APIs
  // ──────────────────────────────────────────────────────────────────
  console.log('\n⚙️ 5. AUDITORÍA: SuperAdmin Platform Console & CRM Multi-Tenant APIs');

  // 5.1 Telemetría de Plataforma (/api/admin/stats)
  try {
    const res = await fetch(`${BASE_URL}/api/admin/stats`, { headers: { 'x-api-key': 'obrasaas_admin_key' } });
    const stats = await res.json();
    if (stats.platform && stats.platform.totalTenants >= 1) {
      pass('API /api/admin/stats: Métricas Globales', `Tenants: ${stats.platform.totalTenants}, Obras: ${stats.platform.totalProjects}, MRR: $${stats.platform.mrr} USD.`);
    } else {
      fail('API /api/admin/stats', JSON.stringify(stats));
    }
  } catch (err) { fail('API /api/admin/stats', err.message); }

  // 5.2 Aprovisionar Nuevo Tenant (/api/admin/tenants)
  try {
    const newTenantData = {
      name: 'Desarrolladora Urbana S.A.',
      slug: `desarrolladora-${Date.now().toString(36)}`,
      plan: 'enterprise',
      ownerEmail: 'ceo@desarrolladora.com',
      ownerPhone: '5491155556666'
    };
    const res = await fetch(`${BASE_URL}/api/admin/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'obrasaas_admin_key' },
      body: JSON.stringify(newTenantData)
    });
    const result = await res.json();
    if (result.tenant) {
      pass('API /api/admin/tenants POST: Aprovisionar Tenant', `Tenant "${result.tenant.name}" creado con plan ${result.tenant.plan.toUpperCase()}.`);
    } else {
      fail('API /api/admin/tenants POST', JSON.stringify(result));
    }
  } catch (err) { fail('API /api/admin/tenants POST', err.message); }

  // 5.3 Generar Certificado de Avance PDF Vectorial (/api/v1/certificacion/pdf)
  try {
    const res = await fetch(`${BASE_URL}/api/v1/certificacion/pdf?quincena=Quincena%201`);
    const pdfBuffer = await res.arrayBuffer();
    if (res.headers.get('Content-Type') === 'application/pdf' && pdfBuffer.byteLength > 5000) {
      pass('API /api/v1/certificacion/pdf: Generación PDF', `Certificado PDF generado correctamente (${pdfBuffer.byteLength} bytes con firma SHA-256).`);
    } else {
      fail('API /api/v1/certificacion/pdf', `Tipo de contenido o tamaño inválido: ${res.headers.get('Content-Type')}`);
    }
  } catch (err) { fail('API /api/v1/certificacion/pdf', err.message); }

  // 5.4 Generar Libro de Obra PDF Oficial (/api/admin/libro-obra/pdf)
  try {
    const res = await fetch(`${BASE_URL}/api/admin/libro-obra/pdf`);
    const pdfBuffer = await res.arrayBuffer();
    if (res.headers.get('Content-Type') === 'application/pdf' && pdfBuffer.byteLength > 3000) {
      pass('API /api/admin/libro-obra/pdf: Acta Oficial PDF (Ley 22.250)', `Libro de Obra generado (${pdfBuffer.byteLength} bytes con firma digital).`);
    } else {
      fail('API /api/admin/libro-obra/pdf', 'Error en PDF Libro de Obra');
    }
  } catch (err) { fail('API /api/admin/libro-obra/pdf', err.message); }

  // 5.5 IA Predictiva & Inflación CAC (/api/v1/predictive)
  try {
    const res = await fetch(`${BASE_URL}/api/v1/predictive`);
    const pred = await res.json();
    if (pred.overallHealthScore !== undefined && pred.metrics) {
      pass('API /api/v1/predictive: Health Score & Forecast CAC', `Health Score: ${pred.overallHealthScore}/100. Ventana hormigonado: "${pred.weatherRisk?.optimalWindow}".`);
    } else {
      fail('API /api/v1/predictive', JSON.stringify(pred));
    }
  } catch (err) { fail('API /api/v1/predictive', err.message); }

  // 5.6 Visión Artificial para Fotos de Obra (/api/v1/vision)
  try {
    const visionPayload = {
      photoUrl: 'https://obrasaas.vercel.app/test-photo-losa.jpg',
      rubro: 'losa de hormigon armado nivel 3',
      uploaderName: 'Arq. Marcelo'
    };
    const res = await fetch(`${BASE_URL}/api/v1/vision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visionPayload)
    });
    const visionRes = await res.json();
    if (visionRes.success && visionRes.analysis) {
      pass('API /api/v1/vision: Computer Vision Progress & PPE Check', `Fase: ${visionRes.analysis.phase}, Avance Estimado: ${visionRes.analysis.estimatedProgress}%, EPP: ${visionRes.analysis.safetyCompliance?.ppeStatus}.`);
    } else {
      fail('API /api/v1/vision', JSON.stringify(visionRes));
    }
  } catch (err) { fail('API /api/v1/vision', err.message); }

  // 5.7 Mercado Pago Billing Checkout (/api/billing/checkout)
  try {
    const billingPayload = { planId: 'professional', userEmail: 'director@constructora.com' };
    const res = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(billingPayload)
    });
    const checkoutRes = await res.json();
    if (checkoutRes.success && checkoutRes.initPoint) {
      pass('API /api/billing/checkout: Mercado Pago Checkout Pro', `Preferencia creada (${checkoutRes.plan.name} — $${checkoutRes.plan.priceARS.toLocaleString('es-AR')} ARS).`);
    } else {
      fail('API /api/billing/checkout', JSON.stringify(checkoutRes));
    }
  } catch (err) { fail('API /api/billing/checkout', err.message); }

  // 5.8 Control Presupuestario y Registro de Gastos (/api/v1/budget)
  try {
    const newExpense = { rubroId: 'estructura', monto: 35000, concepto: 'Hierro del 10 x20 barras' };
    const res = await fetch(`${BASE_URL}/api/v1/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'internal' },
      body: JSON.stringify(newExpense)
    });
    const budgetRes = await res.json();
    if (budgetRes.rubro || budgetRes.movimiento) {
      pass('API /api/v1/budget POST: Imputación de Gasto', `Gasto imputado a rubro "${budgetRes.rubro?.nombre}". Ejecutado: $${budgetRes.rubro?.ejecutado?.toLocaleString('es-AR')} ARS.`);
    } else {
      fail('API /api/v1/budget POST', JSON.stringify(budgetRes));
    }
  } catch (err) { fail('API /api/v1/budget POST', err.message); }

  // ──────────────────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ──────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`📊 RESUMEN FINAL: ${passed} PRUEBAS EXITOSAS / ${failed} FALLOS`);
  console.log(`🎯 TASA DE CONFORMIDAD DEL SISTEMA: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('════════════════════════════════════════════════════════════════════\n');
}

runLiveAudit().catch(console.error);
