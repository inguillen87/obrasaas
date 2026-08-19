// ObraSaaS Comprehensive Frontend & API Verification Suite v7.0

const BASE_URL = 'http://localhost:3000';

const pagesToTest = [
  { path: '/', name: 'Landing Page Enterprise' },
  { path: '/dashboard', name: 'Dashboard Principal de Obra' },
  { path: '/sign-in', name: 'Página de Iniciar Sesión & Demo' },
  { path: '/sign-up', name: 'Página de Registro de Constructora' },
  { path: '/bim', name: 'Visor 3D BIM & Gemelo Digital' },
  { path: '/poster', name: 'Cartel Oficial de Obra con QR' },
  { path: '/superadmin', name: 'SuperAdmin Console & CRM' },
  { path: '/planos', name: 'Visor de Planos CAD / Floorplans' },
  { path: '/licitaciones', name: 'Licitómetro de Obra Pública' },
  { path: '/presupuesto', name: 'Control Presupuestario & Curva S' },
  { path: '/costos', name: 'Análisis de Costos & CAC' },
  { path: '/compliance', name: 'Compliance ART, UOCRA & AFIP' },
  { path: '/portal', name: 'Portal para Comitentes e Inversores' },
  { path: '/pricing', name: 'Planes SaaS & Mercado Pago' },
  { path: '/onboarding', name: 'Onboarding de Constructoras' },
  { path: '/marketplace', name: 'Marketplace de Corralones & Materiales' },
  { path: '/ejecutivo', name: 'Dashboard Ejecutivo & ROI' },
  { path: '/api-docs', name: 'Documentación de APIs REST' },
  { path: '/libro-obra', name: 'Libro de Obra Digital (Ley 22.250)' },
  { path: '/inspecciones', name: 'Inspecciones & Checklists QA/QC' },
  { path: '/documentos', name: 'Documentación Técnica & Submittals' },
  { path: '/cronograma', name: 'Cronograma Studio & Gantt CPM' },
  { path: '/webview/attendance?worker=juan&token=test', name: 'Webview Fichaje Satelital' },
  { path: '/webview/kyc?worker=juan&token=test', name: 'Webview KYC Biométrico' },
  { path: '/webview/medical?worker=juan&token=test', name: 'Webview Apto Médico' },
];

const apiEndpointsToTest = [
  { path: '/api/v1/dolar', name: 'API Dólar & CAC Live Engine' },
  { path: '/api/cron/daily-summary', name: 'API Cron Resumen Diario WhatsApp' },
  { path: '/api/v1/predictive', name: 'API IA Predictiva & CIRSOC 201' },
  { path: '/api/admin/stats', name: 'API Admin Stats Platform-Wide', headers: { 'x-api-key': 'obrasaas_admin_key' } },
  { path: '/api/v1/certificacion/pdf', name: 'API Certificado PDF Oficial' },
  { path: '/api/admin/libro-obra/pdf', name: 'API Libro de Obra PDF (Ley 22.250)' },
  { path: '/api/v1/rfi', name: 'API RFI Consultas Técnicas & Ball-in-Court' },
  { path: '/api/v1/adicionales', name: 'API Change Orders & Adicionales CAC' },
];

async function runFullVerification() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        🏗️  OBRASAAS ENTERPRISE v6.0 — FULL SYSTEM AUDIT           ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  console.log('🌐 1. VERIFICACIÓN DE TODAS LAS PÁGINAS Y VISTAS:');
  for (const page of pagesToTest) {
    try {
      const res = await fetch(`${BASE_URL}${page.path}`);
      const text = await res.text();
      
      if (res.status === 200 && text.length > 500) {
        passed++;
        console.log(`  ✅ [200 OK] ${page.name.padEnd(42)} (${page.path}) — ${text.length} bytes`);
      } else {
        failed++;
        console.log(`  ❌ [FAIL ${res.status}] ${page.name.padEnd(42)} (${page.path})`);
      }
    } catch (err) {
      failed++;
      console.log(`  ❌ [ERR] ${page.name.padEnd(42)} (${page.path}): ${err.message}`);
    }
  }

  console.log('\n⚙️ 2. VERIFICACIÓN DE ENDPOINTS API:');
  for (const api of apiEndpointsToTest) {
    try {
      const res = await fetch(`${BASE_URL}${api.path}`, { headers: api.headers || {} });
      if (res.status === 200) {
        passed++;
        console.log(`  ✅ [200 OK] ${api.name.padEnd(42)} (${api.path})`);
      } else {
        failed++;
        console.log(`  ❌ [FAIL ${res.status}] ${api.name.padEnd(42)} (${api.path})`);
      }
    } catch (err) {
      failed++;
      console.log(`  ❌ [ERR] ${api.name.padEnd(42)} (${api.path}): ${err.message}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`📊 TOTAL AUDITORÍA: ${passed} PRUEBAS EXITOSAS / ${failed} FALLOS (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log('════════════════════════════════════════════════════════════════════\n');
}

runFullVerification();
