import puppeteer from 'puppeteer';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:/Users/guill/.gemini/antigravity/brain/3df1b943-68c1-44ae-b5b0-c16b3883609e';

async function runInteractiveTest() {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║   🎭 OBRASAAS — INTERACTIVE WHATSAPP & DASHBOARD BROWSER QA        ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('obrasaas_logged_in', 'true');
    });

    console.log('1. Navegando al Dashboard Principal...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_dashboard_logged.png') });
    console.log('  📸 Captura: screenshot_dashboard_logged.png');

    console.log('2. Navegando al Hub de WhatsApp & Simulador...');
    await page.goto(`${BASE_URL}/dashboard?tab=sec-chat`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_whatsapp_hub.png') });
    console.log('  📸 Captura: screenshot_whatsapp_hub.png');

    console.log('3. Navegando a Personal & Recibos UOCRA...');
    await page.goto(`${BASE_URL}/dashboard?tab=sec-admin`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_personal_uocra.png') });
    console.log('  📸 Captura: screenshot_personal_uocra.png');

    console.log('4. Navegando al Visor de Planos CAD...');
    await page.goto(`${BASE_URL}/planos`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_planos_calibrated.png') });
    console.log('  📸 Captura: screenshot_planos_calibrated.png');

    console.log('5. Navegando a Inspecciones QA/QC...');
    await page.goto(`${BASE_URL}/inspecciones`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_inspecciones.png') });
    console.log('  📸 Captura: screenshot_inspecciones.png');

    console.log('6. Navegando al Informe Ejecutivo de Auditoría QA...');
    await page.goto(`${BASE_URL}/qa-report`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_qa_report_full.png') });
    console.log('  📸 Captura: screenshot_qa_report_full.png');

    await browser.close();
    console.log('\n✅ Prueba Interactiva Browser completada con éxito.');
}

runInteractiveTest().catch(err => {
    console.error('Interactive error:', err);
    process.exit(1);
});
