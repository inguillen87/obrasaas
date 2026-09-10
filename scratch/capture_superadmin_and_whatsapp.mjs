import puppeteer from 'puppeteer';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = 'C:/Users/guill/.gemini/antigravity/brain/7f2b6be8-80bf-44bb-96e1-87c3b983f740/screenshots';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
    console.log('🚀 Starting SuperAdmin & WhatsApp Capture...');
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,920']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 920 });

    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('obrasaas_logged_in', 'true');
        localStorage.setItem('obrasaas_admin_key', 'obrasaas_admin_key');
    });

    try {
        // ==========================================
        // 1. SUPERADMIN CONSOLE
        // ==========================================
        console.log('📸 Loading /superadmin (logged out)...');
        await page.goto(`${BASE_URL}/superadmin`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(1000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15_superadmin_login.png'), fullPage: false });
        console.log('  ✅ 15_superadmin_login.png');

        // Type password & enter
        const pwdInput = await page.$('input[type="password"]');
        if (pwdInput) {
            await pwdInput.type('obrasaas_admin_key');
            await sleep(300);
            const unlockBtn = await page.$('button');
            if (unlockBtn) await unlockBtn.click();
            await sleep(2000);
        }

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15a_superadmin_overview.png'), fullPage: false });
        console.log('  ✅ 15a_superadmin_overview.png');

        // Tab: Tenants
        const buttons = await page.$$('button');
        for (const b of buttons) {
            const t = await page.evaluate(el => el.textContent, b);
            if (t && t.includes('Tenants')) {
                await b.click();
                console.log('  Clicked Tenants tab');
                break;
            }
        }
        await sleep(1000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15b_superadmin_tenants.png'), fullPage: false });
        console.log('  ✅ 15b_superadmin_tenants.png');

        // Tab: Facturación & MRR
        const buttons2 = await page.$$('button');
        for (const b of buttons2) {
            const t = await page.evaluate(el => el.textContent, b);
            if (t && (t.includes('Facturación') || t.includes('MRR'))) {
                await b.click();
                console.log('  Clicked Facturación tab');
                break;
            }
        }
        await sleep(1000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15c_superadmin_billing.png'), fullPage: false });
        console.log('  ✅ 15c_superadmin_billing.png');

        // Tab: Auditoría & Seguridad
        const buttons3 = await page.$$('button');
        for (const b of buttons3) {
            const t = await page.evaluate(el => el.textContent, b);
            if (t && (t.includes('Auditoría') || t.includes('Seguridad'))) {
                await b.click();
                console.log('  Clicked Auditoría tab');
                break;
            }
        }
        await sleep(1000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15d_superadmin_audit.png'), fullPage: false });
        console.log('  ✅ 15d_superadmin_audit.png');

        // ==========================================
        // 2. WHATSAPP SIMULATOR
        // ==========================================
        console.log('\n📸 Loading WhatsApp Simulator in /dashboard...');
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(1500);

        // Switch to WhatsApp tab in sidebar
        const sideButtons = await page.$$('aside button, nav button, button');
        for (const b of sideButtons) {
            const t = await page.evaluate(el => el.textContent, b);
            if (t && t.includes('Simulador WhatsApp')) {
                await b.click();
                console.log('  Switched to Simulador WhatsApp');
                break;
            }
        }
        await sleep(1500);

        // Click on audio simulation button (Audio 2: Reporte de Avance Diario)
        const simButtons = await page.$$('button');
        for (const b of simButtons) {
            const t = await page.evaluate(el => el.textContent, b);
            if (t && t.includes('Reporte de Avance')) {
                await b.click();
                console.log('  Clicked Reporte de Avance Diario button');
                break;
            }
        }
        await sleep(2500);

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13_whatsapp_simulator.png'), fullPage: false });
        console.log('  ✅ 13_whatsapp_simulator.png');

        // Send a direct message in chat input
        const inputs = await page.$$('input');
        for (const inp of inputs) {
            const ph = await page.evaluate(el => el.placeholder, inp);
            if (ph && ph.toLowerCase().includes('bot')) {
                await inp.focus();
                await inp.type('1');
                await sleep(400);
                await page.keyboard.press('Enter');
                console.log('  Sent command "1" to bot');
                break;
            }
        }
        await sleep(3000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14_whatsapp_material_sent.png'), fullPage: false });
        console.log('  ✅ 14_whatsapp_material_sent.png');

    } catch (err) {
        console.error('Error during capture:', err);
    } finally {
        await browser.close();
        console.log('🏁 Done!');
    }
}

run();
