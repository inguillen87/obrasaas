import puppeteer from 'puppeteer';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/guill/.gemini/antigravity/brain/3df1b943-68c1-44ae-b5b0-c16b3883609e';
const BASE_URL = 'http://localhost:3000';

async function main() {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });

    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('obrasaas_logged_in', 'true');
    });

    console.log('Capturando Dashboard Principal actualizado...');
    await page.goto(`${BASE_URL}/dashboard?tab=sec-dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_10_main_dashboard.png') });
    console.log('📸 Screenshot guardado: lifecycle_10_main_dashboard.png');

    console.log('Capturando Presupuesto y Curva S...');
    await page.goto(`${BASE_URL}/dashboard?tab=sec-presupuesto`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_11_presupuesto_curva_s.png') });
    console.log('📸 Screenshot guardado: lifecycle_11_presupuesto_curva_s.png');

    await browser.close();
}

main().catch(console.error);
