import puppeteer from 'puppeteer';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:/Users/guill/.gemini/antigravity/brain/3df1b943-68c1-44ae-b5b0-c16b3883609e';

async function runLiveWhatsAppChat() {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║   💬 OBRASAAS — LIVE BROWSER WHATSAPP CHAT & DISPATCH QA           ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1200 });

    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('obrasaas_logged_in', 'true');
    });

    console.log('1. Cargando el Hub de WhatsApp en el navegador...');
    await page.goto(`${BASE_URL}/dashboard?tab=sec-whatsapp`, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1200));

    console.log('2. Escribiendo mensaje en vivo como Marcelo Guillén...');
    const inputSelector = 'input.whatsapp-text-input';
    await page.waitForSelector(inputSelector, { timeout: 5000 });
    await page.type(inputSelector, 'Hola Asistente, ¿cuál es el avance global de la obra y el estado de la cuadrilla hoy?');
    
    // Click send
    const sendBtn = await page.$('button.whatsapp-send-btn');
    if (sendBtn) {
        await sendBtn.click();
        console.log('  📤 Mensaje enviado!');
        await new Promise(r => setTimeout(r, 1500));
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_chat_01_marcelo_msg.png') });
    console.log('  📸 Captura: screenshot_chat_01_marcelo_msg.png');

    console.log('3. Disparando botón: Enviar Menú Interactivo...');
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Menú Interactivo'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    console.log('4. Disparando botón: Enviar Resumen Diario...');
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Resumen Diario'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    console.log('5. Disparando botón: Alerta Ausentismo (08:30 hs)...');
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Ausentismo'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_chat_02_dispatches.png') });
    console.log('  📸 Captura: screenshot_chat_02_dispatches.png');

    console.log('6. Cambiando a rol: Arq. Victoria (Dir. Técnica)...');
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Victoria'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    await page.type(inputSelector, 'Auditoría estructural: verificar resistencia de vigas según CIRSOC 201.');
    const sendBtn2 = await page.$('button.whatsapp-send-btn');
    if (sendBtn2) {
        await sendBtn2.click();
        await new Promise(r => setTimeout(r, 1500));
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_chat_03_victoria_cirsoc.png') });
    console.log('  📸 Captura: screenshot_chat_03_victoria_cirsoc.png');

    console.log('7. Cambiando a rol: Juan Zapata (Armador) y enviando recibo UOCRA...');
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Juan Zapata') || b.textContent.includes('Armador'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Recibo UOCRA'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_chat_04_recibo_uocra.png') });
    console.log('  📸 Captura: screenshot_chat_04_recibo_uocra.png');

    console.log('8. Abriendo Drawer de Meta Embedded Signup...');
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Meta Embedded Signup'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_chat_05_meta_drawer.png') });
    console.log('  📸 Captura: screenshot_chat_05_meta_drawer.png');

    await browser.close();
    console.log('\n🎉 Recorrido Live WhatsApp en el Navegador completado con éxito.');
}

runLiveWhatsAppChat().catch(err => {
    console.error('Fatal live chat error:', err);
    process.exit(1);
});
