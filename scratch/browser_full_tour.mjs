import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:/Users/guill/.gemini/antigravity/brain/3df1b943-68c1-44ae-b5b0-c16b3883609e';

async function runBrowserTour() {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║   🌐 OBRASAAS — REAL BROWSER TOUR & VISUAL QA AUTOMATION          ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    const tourSteps = [
        {
            name: '1. Landing Page Enterprise',
            url: `${BASE_URL}/`,
            screenshot: 'screenshot_01_landing.png'
        },
        {
            name: '2. Onboarding 4-Step con Meta WhatsApp',
            url: `${BASE_URL}/onboarding`,
            screenshot: 'screenshot_02_onboarding.png'
        },
        {
            name: '3. Dashboard Principal & Hub WhatsApp',
            url: `${BASE_URL}/dashboard`,
            screenshot: 'screenshot_03_dashboard.png'
        },
        {
            name: '4. Libro de Obra Digital (Ley 22.250 & CPAU)',
            url: `${BASE_URL}/libro-obra`,
            screenshot: 'screenshot_04_libro_obra.png'
        },
        {
            name: '5. Visor de Planos CAD & Regla Calibrada',
            url: `${BASE_URL}/planos`,
            screenshot: 'screenshot_05_planos.png'
        },
        {
            name: '6. Inspecciones & Checklists QA/QC CIRSOC 201',
            url: `${BASE_URL}/inspecciones`,
            screenshot: 'screenshot_06_inspecciones.png'
        },
        {
            name: '7. Webview Recibo de Sueldo UOCRA (Firma Táctil)',
            url: `${BASE_URL}/webview/recibos?worker=juan&token=test`,
            screenshot: 'screenshot_07_recibo_uocra.png'
        },
        {
            name: '8. Informe Ejecutivo de Auditoría QA para Marcelo & Victoria',
            url: `${BASE_URL}/qa-report`,
            screenshot: 'screenshot_08_qa_report.png'
        }
    ];

    let passed = 0;
    for (const step of tourSteps) {
        try {
            console.log(`🔍 Navegando en vivo a: ${step.name} (${step.url})...`);
            await page.goto(step.url, { waitUntil: 'networkidle2', timeout: 20000 });
            
            // Wait for animations and layout to settle
            await new Promise(r => setTimeout(r, 1200));

            const screenshotPath = path.join(ARTIFACT_DIR, step.screenshot);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            console.log(`  📸 Captura guardada: ${step.screenshot}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ Error en paso ${step.name}:`, err.message);
        }
    }

    await browser.close();

    console.log('\n════════════════════════════════════════════════════════════════════');
    console.log(`🎯 RECORRIDO BROWSER FINALIZADO: ${passed}/${tourSteps.length} PÁGINAS TESTEADAS CON ÉXITO`);
    console.log('════════════════════════════════════════════════════════════════════\n');
}

runBrowserTour().catch(err => {
    console.error('Fatal browser tour error:', err);
    process.exit(1);
});
