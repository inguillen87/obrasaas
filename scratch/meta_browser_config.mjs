import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = 'C:/Users/guill/.gemini/antigravity/brain/3df1b943-68c1-44ae-b5b0-c16b3883609e';

async function takeScreenshot(page, name) {
    const filePath = path.join(SCREENSHOTS_DIR, `meta_${name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`📸 Screenshot saved: ${filePath}`);
    return filePath;
}

async function main() {
    console.log('🚀 Launching Chrome with user profile for Meta Developer Console...\n');
    
    // Launch Chrome with the user's existing profile to reuse Facebook login
    const browser = await puppeteer.launch({
        headless: false,
        channel: 'chrome',
        userDataDir: 'C:/Users/guill/AppData/Local/Google/Chrome/User Data',
        args: [
            '--profile-directory=Default',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-infobars',
            '--window-size=1400,900'
        ],
        defaultViewport: { width: 1400, height: 900 }
    });

    const page = await browser.newPage();
    
    // Step 1: Navigate to Meta Developer Console - WhatsApp API Setup
    console.log('1️⃣ Navigando a Meta Developer Console...');
    await page.goto('https://developers.facebook.com/apps/1665088767899217/whatsapp-business/wa-dev-console/', {
        waitUntil: 'networkidle2',
        timeout: 30000
    });
    await new Promise(r => setTimeout(r, 3000));
    await takeScreenshot(page, '01_developer_console');
    
    // Check if we need to login
    const currentUrl = page.url();
    console.log('   URL actual:', currentUrl);
    
    if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
        console.log('⚠️ Se requiere login en Facebook. Tomando screenshot para que el usuario pueda loguearse manualmente.');
        await takeScreenshot(page, '01_login_required');
        
        // Wait for user to potentially login (give 60 seconds)
        console.log('   Esperando 60 segundos para login manual...');
        await new Promise(r => setTimeout(r, 60000));
        await takeScreenshot(page, '01b_after_wait');
    }
    
    // Step 2: Navigate to WhatsApp configuration 
    console.log('\n2️⃣ Verificando página de configuración de WhatsApp...');
    const pageContent = await page.content();
    
    // Check if we're on the right page
    if (pageContent.includes('API Setup') || pageContent.includes('wa-dev-console') || pageContent.includes('Send and receive')) {
        console.log('   ✅ Estamos en la consola de WhatsApp API');
    } else {
        console.log('   Probando URL alternativa...');
        await page.goto('https://developers.facebook.com/apps/1665088767899217/whatsapp-business/wa-settings/', {
            waitUntil: 'networkidle2',
            timeout: 20000
        });
        await new Promise(r => setTimeout(r, 3000));
    }
    await takeScreenshot(page, '02_whatsapp_config');
    
    // Step 3: Navigate to Webhook Configuration
    console.log('\n3️⃣ Navegando a configuración de Webhooks...');
    await page.goto('https://developers.facebook.com/apps/1665088767899217/whatsapp-business/wa-settings/', {
        waitUntil: 'networkidle2',
        timeout: 20000
    });
    await new Promise(r => setTimeout(r, 3000));
    await takeScreenshot(page, '03_webhook_settings');
    
    // Step 4: Check the Webhook callback URL
    console.log('\n4️⃣ Buscando configuración de Callback URL...');
    const settingsContent = await page.content();
    
    // Look for webhook URL field
    const hasCallbackUrl = settingsContent.includes('Callback URL') || settingsContent.includes('callback_url');
    const hasVerifyToken = settingsContent.includes('Verify Token') || settingsContent.includes('verify_token');
    console.log('   Callback URL visible:', hasCallbackUrl);
    console.log('   Verify Token visible:', hasVerifyToken);
    
    // Step 5: Navigate back to API test console to check/add allowed numbers
    console.log('\n5️⃣ Navegando a consola de prueba de API...');
    await page.goto('https://developers.facebook.com/apps/1665088767899217/whatsapp-business/wa-dev-console/', {
        waitUntil: 'networkidle2',
        timeout: 20000
    });
    await new Promise(r => setTimeout(r, 3000));
    await takeScreenshot(page, '05_api_test_console');
    
    // Look for "Manage phone number list" or "Add phone number" button
    const devConsoleContent = await page.content();
    const hasManageList = devConsoleContent.includes('Manage') || devConsoleContent.includes('phone number list') || devConsoleContent.includes('Add phone');
    console.log('   Manage phone list visible:', hasManageList);
    
    // Try to find and click "Manage phone number list" or "To" dropdown
    try {
        // Look for dropdown or manage button related to recipients
        const manageButton = await page.$('button:has-text("Manage"), a:has-text("Manage"), [role="button"]:has-text("Manage")');
        if (manageButton) {
            console.log('   Encontrado botón "Manage" - clicking...');
            await manageButton.click();
            await new Promise(r => setTimeout(r, 2000));
            await takeScreenshot(page, '06_manage_numbers');
        }
    } catch(e) {
        console.log('   Buscando con selectores alternativos...');
    }
    
    // Try clicking on elements containing "To" or phone number selection
    try {
        const toElements = await page.$$('select, [class*="dropdown"], [class*="select"]');
        console.log(`   Encontrados ${toElements.length} dropdowns/selects`);
        
        // Look for any element that mentions phone numbers or recipients
        const allButtons = await page.$$('button, a[role="button"], [role="button"]');
        for (const btn of allButtons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text && (text.includes('Manage') || text.includes('Add') || text.includes('phone') || text.includes('número'))) {
                console.log(`   Botón encontrado: "${text.trim().substring(0, 50)}"`);
            }
        }
    } catch(e) {
        console.log('   Error buscando elementos:', e.message);
    }
    
    // Step 6: Take final screenshot of the whole page for analysis
    console.log('\n6️⃣ Screenshot final completo...');
    await takeScreenshot(page, '07_final_overview');
    
    // Extract visible text for analysis
    const visibleText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
    console.log('\n📄 Texto visible en la página (primeros 3000 chars):');
    console.log(visibleText.substring(0, 3000));
    
    console.log('\n✅ Browser permanece abierto para inspección manual.');
    console.log('   Cerrando la conexión de Puppeteer (Chrome queda abierto)...');
    
    browser.disconnect();
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
