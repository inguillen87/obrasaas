// ObraSaaS Comprehensive Frontend Page Audit
// Validates that every frontend route and webview loads with HTTP 200 and renders properly

const BASE_URL = 'http://localhost:3000';

const pagesToTest = [
  { path: '/', name: 'Landing Page Enterprise' },
  { path: '/dashboard', name: 'Dashboard Principal de Obra' },
  { path: '/superadmin', name: 'SuperAdmin Platform Console & CRM' },
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
  { path: '/webview/attendance?worker=juan&token=test', name: 'Webview Fichaje Satelital' },
  { path: '/webview/kyc?worker=juan&token=test', name: 'Webview KYC Biométrico' },
  { path: '/webview/medical?worker=juan&token=test', name: 'Webview Apto Médico' },
];

async function runPageAudit() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        🌐 OBRASAAS FRONTEND & WEBVIEW ROUTE AUDIT                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

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

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`📊 TOTAL PÁGINAS: ${passed} EXITOSAS / ${failed} FALLOS (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log('════════════════════════════════════════════════════════════════════\n');
}

runPageAudit();
