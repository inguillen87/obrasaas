// ObraSaaS Comprehensive Platform Verification Suite v8.0
// Tests ALL 26 pages + ALL GET-compatible API endpoints + POST mutations

const BASE_URL = 'http://localhost:3000';

const pagesToTest = [
  // PUBLIC
  { path: '/', name: 'Landing Page Enterprise' },
  { path: '/sign-in', name: 'Página de Iniciar Sesión & Demo' },
  { path: '/sign-up', name: 'Página de Registro de Constructora' },
  { path: '/pricing', name: 'Planes SaaS & Mercado Pago' },
  { path: '/onboarding', name: 'Onboarding de Constructoras' },
  { path: '/poster', name: 'Cartel Oficial de Obra con QR' },
  { path: '/api-docs', name: 'Documentación de APIs REST' },

  // GESTIÓN DE OBRA
  { path: '/dashboard', name: 'Dashboard Principal de Obra' },
  { path: '/dashboard/report', name: 'Reporte Ejecutivo & Certificación PDF' },
  { path: '/libro-obra', name: 'Libro de Obra Digital (Ley 22.250)' },
  { path: '/cronograma', name: 'Cronograma Studio & Gantt CPM' },
  { path: '/inspecciones', name: 'Inspecciones & Checklists QA/QC' },
  { path: '/documentos', name: 'Documentación Técnica & Submittals' },
  { path: '/presupuesto', name: 'Control Presupuestario & Curva S' },
  { path: '/costos', name: 'Análisis de Costos & CAC' },
  { path: '/planos', name: 'Visor de Planos CAD / Floorplans' },
  { path: '/bim', name: 'Visor 3D BIM & Gemelo Digital' },

  // ENTERPRISE
  { path: '/ejecutivo', name: 'Dashboard Ejecutivo & ROI' },
  { path: '/portal', name: 'Portal para Comitentes e Inversores' },
  { path: '/compliance', name: 'Compliance ART, UOCRA & AFIP' },
  { path: '/marketplace', name: 'Marketplace de Corralones & Materiales' },
  { path: '/superadmin', name: 'SuperAdmin Console & CRM' },
  { path: '/licitaciones', name: 'Licitómetro de Obra Pública' },

  // MOBILE PWA WEBVIEWS
  { path: '/webview/attendance?worker=juan&token=test', name: 'Webview Fichaje Satelital' },
  { path: '/webview/kyc?worker=juan&token=test', name: 'Webview KYC Biométrico' },
  { path: '/webview/medical?worker=juan&token=test', name: 'Webview Apto Médico' },
  { path: '/webview/recibos?worker=juan&token=test', name: 'Webview Recibos Digitales UOCRA' },
];

const AK = { 'x-api-key': 'obrasaas_admin_key' };

const apiEndpointsToTest = [
  // v1 APIs
  { path: '/api/v1/dolar', name: 'API Dólar & CAC Live Engine' },
  { path: '/api/v1/predictive', name: 'API IA Predictiva & CIRSOC 201' },
  { path: '/api/v1/certificacion', name: 'API Certificación de Avance', headers: AK },
  { path: '/api/v1/certificacion/pdf', name: 'API Certificado PDF Oficial' },
  { path: '/api/v1/rfi', name: 'API RFI Consultas Técnicas' },
  { path: '/api/v1/adicionales', name: 'API Change Orders & Adicionales CAC' },
  { path: '/api/v1/budget', name: 'API Presupuesto & Rubros', headers: AK },
  { path: '/api/v1/tasks', name: 'API Tareas Gantt CPM', headers: AK },
  { path: '/api/v1/incidents', name: 'API Incidentes de Obra', headers: AK },
  { path: '/api/v1/polizas', name: 'API Pólizas & Seguros', headers: AK },
  { path: '/api/v1/portal', name: 'API Portal Inversor (Vecino Digital)' },
  { path: '/api/v1/projects', name: 'API Multi-Proyecto Enterprise', headers: AK },
  { path: '/api/v1/uocra', name: 'API UOCRA & CCT', headers: AK },
  { path: '/api/v1/workers', name: 'API Operarios & RRHH', headers: AK },
  { path: '/api/v1/export?type=budget', name: 'API Exportación ERP (CSV)' },
  { path: '/api/v1/webhooks', name: 'API Webhooks & Integraciones', headers: AK },
  { path: '/api/v1/whatsapp/dispatch', name: 'API WhatsApp Dispatch & Health Hub' },
  { path: '/api/v1/recibos', name: 'API Recibos Digitales UOCRA' },

  // Admin APIs
  { path: '/api/admin/stats', name: 'API Admin Stats Platform-Wide', headers: AK },
  { path: '/api/admin/libro-obra', name: 'API Libro de Obra Digital (Asientos)' },
  { path: '/api/admin/libro-obra/pdf', name: 'API Libro de Obra PDF (Ley 22.250)' },
  { path: '/api/admin/tenants', name: 'API Multi-Tenant & Constructoras', headers: AK },

  // Core APIs
  { path: '/api/cron/daily-summary', name: 'API Cron Resumen Diario WhatsApp' },
  { path: '/api/state', name: 'API State Management & Persistence' },
  { path: '/api/project', name: 'API Proyecto & Configuración' },
  { path: '/api/weather', name: 'API Clima & Radar Satelital' },
  { path: '/api/billing', name: 'API Billing & Suscripciones' },
  { path: '/api/billing/checkout', name: 'API Checkout & Mercado Pago' },
  { path: '/api/auth/verify', name: 'API Auth & Token Verification' },
];

const postMutationsToTest = [
  {
    name: 'POST Crear RFI (Consulta Técnica)',
    path: '/api/v1/rfi',
    body: { subject: 'Cota de nivel en subsuelo', question: '¿A qué NP queda la losa del subsuelo S2?', discipline: 'Estructura', ballInCourt: 'Calculista Estructural' },
  },
  {
    name: 'POST Crear Change Order (Adicional CAC)',
    path: '/api/v1/adicionales',
    body: { title: 'Adicional de revestimiento hall', description: 'Porcelanato importado en hall de acceso', rubroCode: 'Terminaciones', laborAmountARS: 450000, materialAmountARS: 1200000, scheduleImpactDays: 5, cacBaseIndex: 1247.3 },
  },
  {
    name: 'POST Asiento de Libro de Obra',
    path: '/api/admin/libro-obra',
    body: { date: '2025-08-19', weather: 'Soleado', temperature: 18, workers: 32, tasks: 'Hormigonado losa nivel 4', observations: 'Encofrado completo', materials: 'Hormigón H-30 x 45m³', signedBy: 'Ing. Martín López' },
  },
];

async function runFullVerification() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║     🏗️  OBRASAAS ENTERPRISE v8.0 — COMPLETE PLATFORM AUDIT       ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;
  const failures = [];

  // SECTION 1: ALL PAGES
  console.log('🌐 1. VERIFICACIÓN DE TODAS LAS PÁGINAS (26 Rutas Frontend):');
  for (const page of pagesToTest) {
    try {
      const res = await fetch(`${BASE_URL}${page.path}`);
      const text = await res.text();
      if (res.status === 200 && text.length > 100) {
        passed++;
        console.log(`  ✅ [200 OK] ${page.name.padEnd(48)} (${page.path}) — ${text.length} bytes`);
      } else {
        failed++;
        failures.push(`PAGE: ${page.path} → HTTP ${res.status}`);
        console.log(`  ❌ [FAIL ${res.status}] ${page.name.padEnd(48)} (${page.path})`);
      }
    } catch (err) {
      failed++;
      failures.push(`PAGE: ${page.path} → ${err.message}`);
      console.log(`  ❌ [ERR] ${page.name.padEnd(48)} (${page.path}): ${err.message}`);
    }
  }

  // SECTION 2: ALL API ENDPOINTS (GET)
  console.log('\n⚙️  2. VERIFICACIÓN DE ENDPOINTS API (27 GET):');
  for (const api of apiEndpointsToTest) {
    try {
      const res = await fetch(`${BASE_URL}${api.path}`, { headers: api.headers || {} });
      if (res.status === 200) {
        passed++;
        console.log(`  ✅ [200 OK] ${api.name.padEnd(48)} (${api.path})`);
      } else {
        failed++;
        failures.push(`API GET: ${api.path} → HTTP ${res.status}`);
        console.log(`  ❌ [FAIL ${res.status}] ${api.name.padEnd(48)} (${api.path})`);
      }
    } catch (err) {
      failed++;
      failures.push(`API GET: ${api.path} → ${err.message}`);
      console.log(`  ❌ [ERR] ${api.name.padEnd(48)} (${api.path}): ${err.message}`);
    }
  }

  // SECTION 3: POST MUTATION TESTS
  console.log('\n🔄 3. VERIFICACIÓN DE MUTACIONES (3 POST):');
  for (const mutation of postMutationsToTest) {
    try {
      const res = await fetch(`${BASE_URL}${mutation.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mutation.body)
      });
      if (res.status >= 200 && res.status < 300) {
        passed++;
        console.log(`  ✅ [${res.status} OK] ${mutation.name.padEnd(48)}`);
      } else {
        failed++;
        failures.push(`POST: ${mutation.name} → HTTP ${res.status}`);
        console.log(`  ❌ [FAIL ${res.status}] ${mutation.name.padEnd(48)}`);
      }
    } catch (err) {
      failed++;
      failures.push(`POST: ${mutation.name} → ${err.message}`);
      console.log(`  ❌ [ERR] ${mutation.name.padEnd(48)}: ${err.message}`);
    }
  }

  // SUMMARY
  const total = passed + failed;
  const pct = ((passed / total) * 100).toFixed(1);
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`📊 TOTAL AUDITORÍA: ${passed} PRUEBAS EXITOSAS / ${failed} FALLOS (${pct}%)`);
  if (failures.length > 0) {
    console.log('\n⚠️  FALLOS DETECTADOS:');
    failures.forEach(f => console.log(`  • ${f}`));
  }
  console.log('════════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runFullVerification();
