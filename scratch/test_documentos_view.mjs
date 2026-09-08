import puppeteer from 'puppeteer';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/guill/.gemini/antigravity/brain/3df1b943-68c1-44ae-b5b0-c16b3883609e';

async function main() {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });

    console.log('Navegando a http://localhost:3000/documentos...');
    await page.goto('http://localhost:3000/documentos', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_12_documentos_live.png') });
    console.log('📸 Screenshot guardado: lifecycle_12_documentos_live.png');

    // Click on Remitos folder to view real WhatsApp ingested documents
    const clicked = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('h3'));
        const remitosCard = cards.find(c => c.textContent && c.textContent.includes('Remitos'));
        if (remitosCard) {
            remitosCard.closest('div').click();
            return true;
        }
        return false;
    });

    if (clicked) {
        await new Promise(r => setTimeout(r, 1500));
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_13_remitos_folder_live.png') });
        console.log('📸 Screenshot guardado: lifecycle_13_remitos_folder_live.png');
    }

    await browser.close();
}

main().catch(console.error);
