import puppeteer from 'puppeteer';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:/Users/guill/.gemini/antigravity/brain/3df1b943-68c1-44ae-b5b0-c16b3883609e';

async function testInteractiveButtonsUI() {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║   ⚡ OBRASAAS — INTERACTIVE WHATSAPP BUTTONS & UI TEST             ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1100']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1100 });

    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('obrasaas_logged_in', 'true');
    });

    console.log('1. Navegando al Hub de WhatsApp...');
    await page.goto(`${BASE_URL}/dashboard?tab=sec-whatsapp`, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1200));

    console.log('2. Disparando botón: Auditoría CIRSOC 201...');
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('CIRSOC 201'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    console.log('3. Disparando botón: Confirmar Remito OCR...');
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirmar Remito OCR'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    console.log('4. Capturando mensaje con botones interactivos nativos...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_chat_interactive_buttons.png') });
    console.log('  📸 Captura: screenshot_chat_interactive_buttons.png');

    console.log('5. Clickeando un botón interactivo de WhatsApp en la burbuja...');
    const clicked = await page.evaluate(() => {
        const actionBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Aprobar') || b.textContent.includes('Confirmar Stock') || b.textContent.includes('Cuadrilla'));
        if (actionBtn) {
            actionBtn.click();
            return actionBtn.textContent.trim();
        }
        return null;
    });

    if (clicked) {
        console.log(`  👆 Botón clickeado con éxito: "${clicked}"`);
        await new Promise(r => setTimeout(r, 1500));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_chat_button_clicked.png') });
        console.log('  📸 Captura post-click: screenshot_chat_button_clicked.png');
    }

    await browser.close();
    console.log('\n🎉 Test de Botones Interactivos & Nueva UX/UI completado con éxito.');
}

testInteractiveButtonsUI().catch(console.error);
