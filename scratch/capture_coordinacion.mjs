import puppeteer from 'puppeteer';
import path from 'path';

async function run() {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        defaultViewport: { width: 1440, height: 900 }
    });

    const page = await browser.newPage();

    // Auto-login
    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('obrasaas_logged_in', 'true');
        localStorage.setItem('obrasaas_admin_key', 'internal');
    });

    console.log('Navigating to /coordinacion...');
    await page.goto('http://localhost:3000/coordinacion', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Capture New Alert Markup Editor
    const screenshot1 = 'C:\\Users\\guill\\.gemini\\antigravity\\brain\\3df1b943-68c1-44ae-b5b0-c16b3883609e\\coordinacion_01_markup_editor.png';
    await page.screenshot({ path: screenshot1, fullPage: false });
    console.log('Captured:', screenshot1);

    // Switch to Tablero tab
    const tabs = await page.$$('button');
    for (const tab of tabs) {
        const text = await page.evaluate(el => el.textContent, tab);
        if (text && text.includes('Tablero de Tareas')) {
            await tab.click();
            break;
        }
    }
    await new Promise(r => setTimeout(r, 1000));

    // Capture Tablero
    const screenshot2 = 'C:\\Users\\guill\\.gemini\\antigravity\\brain\\3df1b943-68c1-44ae-b5b0-c16b3883609e\\coordinacion_02_tablero_kanban.png';
    await page.screenshot({ path: screenshot2, fullPage: false });
    console.log('Captured:', screenshot2);

    await browser.close();
    console.log('Done capturing screenshots!');
}

run().catch(console.error);
