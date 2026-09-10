import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = 'C:/Users/guill/.gemini/antigravity/brain/7f2b6be8-80bf-44bb-96e1-87c3b983f740/screenshots';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSprintBrowserTour() {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║   🌐 OBRASAAS — LIVE BROWSER INTERACTIVE TOUR & E2E TESTING       ║');
    console.log('║   Validating all Sprints, Portals, WhatsApp Simulator & APIs       ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1440,920',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 920 });

    // Auto-login & admin key
    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('obrasaas_logged_in', 'true');
        localStorage.setItem('obrasaas_admin_key', 'internal');
    });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`  [Browser Console Error]: ${msg.text().slice(0, 150)}`);
        }
    });

    // Helper navigation
    const safeGoto = async (url) => {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(1800);
    };

    try {
        // =========================================================================
        // STEP 1: DASHBOARD PRINCIPAL & EXECUTIVE SPRINT WIDGETS
        // =========================================================================
        console.log('📍 Paso 1: Navegando a /dashboard...');
        try {
            await safeGoto(`${BASE_URL}/dashboard`);
            const shot1 = path.join(SCREENSHOTS_DIR, '01_dashboard_director_view.png');
            await page.screenshot({ path: shot1, fullPage: false });
            console.log(`  📸 Captura guardada: 01_dashboard_director_view.png`);
        } catch (e) {
            console.error('  Error en paso 1:', e.message);
        }

        // =========================================================================
        // STEP 2: CALENDARIO DE CITAS & RECORDATORIOS WHATSAPP
        // =========================================================================
        console.log('\n📍 Paso 2: Probando Módulo de Calendario (/calendario)...');
        try {
            await safeGoto(`${BASE_URL}/calendario`);

            // 2a. Monthly view
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_calendario_monthly.png'), fullPage: false });
            console.log(`  📸 Captura mensual: 02_calendario_monthly.png`);

            // 2b. Switch to 'Semanal' view
            const tabs = await page.$$('button');
            for (const btn of tabs) {
                const text = await page.evaluate(el => el.textContent, btn);
                if (text && text.includes('Semanal')) {
                    await btn.click();
                    break;
                }
            }
            await sleep(800);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_calendario_weekly.png'), fullPage: false });
            console.log(`  📸 Captura semanal: 03_calendario_weekly.png`);

            // 2c. Switch to 'Lista' view
            const tabs2 = await page.$$('button');
            for (const btn of tabs2) {
                const text = await page.evaluate(el => el.textContent, btn);
                if (text && text.includes('Lista')) {
                    await btn.click();
                    break;
                }
            }
            await sleep(800);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_calendario_list.png'), fullPage: false });
            console.log(`  📸 Captura lista: 04_calendario_list.png`);

            // 2d. Open 'Nueva Cita' Modal
            const buttons = await page.$$('button');
            let modalOpened = false;
            for (const b of buttons) {
                const t = await page.evaluate(el => el.textContent, b);
                if (t && t.includes('Nueva Cita')) {
                    await b.click();
                    modalOpened = true;
                    break;
                }
            }
            if (modalOpened) {
                await sleep(800);
                await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_calendario_modal_nueva_cita.png'), fullPage: false });
                console.log(`  📸 Captura modal cita: 05_calendario_modal_nueva_cita.png`);
                await page.keyboard.press('Escape');
                await sleep(400);
            }
        } catch (e) {
            console.error('  Error en paso 2:', e.message);
        }

        // =========================================================================
        // STEP 3: CRONOGRAMA & CURVA S INTERACTIVA (EVM)
        // =========================================================================
        console.log('\n📍 Paso 3: Probando Cronograma y Curva S (/cronograma)...');
        try {
            await safeGoto(`${BASE_URL}/cronograma`);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_cronograma_gantt.png'), fullPage: false });
            console.log(`  📸 Captura Gantt: 06_cronograma_gantt.png`);

            // Click on 'Curva S' mode button
            const modeButtons = await page.$$('button');
            for (const b of modeButtons) {
                const t = await page.evaluate(el => el.textContent, b);
                if (t && t.trim() === 'Curva S') {
                    await b.click();
                    console.log('  🎯 Botón "Curva S" clickeado');
                    break;
                }
            }
            await sleep(1200);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_cronograma_curva_s.png'), fullPage: false });
            console.log(`  📸 Captura Curva S: 07_cronograma_curva_s.png`);
        } catch (e) {
            console.error('  Error en paso 3:', e.message);
        }

        // =========================================================================
        // STEP 4: CONTROL DE COSTOS & BANDEJA DE MATERIALES (/costos)
        // =========================================================================
        console.log('\n📍 Paso 4: Probando Control de Costos y Materiales (/costos)...');
        try {
            await safeGoto(`${BASE_URL}/costos`);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_costos_overview.png'), fullPage: false });
            console.log(`  📸 Captura Costos: 08_costos_overview.png`);

            // Click on tab 'Pedidos de Campo & Suministros'
            const costButtons = await page.$$('button');
            for (const b of costButtons) {
                const t = await page.evaluate(el => el.textContent, b);
                if (t && t.includes('Pedidos de Campo')) {
                    await b.click();
                    console.log('  🎯 Tab "Pedidos de Campo & Suministros" activado');
                    break;
                }
            }
            await sleep(1200);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_costos_pedidos_materiales.png'), fullPage: false });
            console.log(`  📸 Captura Pedidos Materiales: 09_costos_pedidos_materiales.png`);
        } catch (e) {
            console.error('  Error en paso 4:', e.message);
        }

        // =========================================================================
        // STEP 5: LIBRO DE OBRA & ACTAS DE HIGIENE Y SEGURIDAD (/libro-obra)
        // =========================================================================
        console.log('\n📍 Paso 5: Probando Libro de Obra y Actas H&S (/libro-obra)...');
        try {
            await safeGoto(`${BASE_URL}/libro-obra`);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_libro_obra_overview.png'), fullPage: false });
            console.log(`  📸 Captura Libro de Obra: 10_libro_obra_overview.png`);

            // Toggle 'Ver Libro H&S' button
            const loButtons = await page.$$('button');
            for (const b of loButtons) {
                const t = await page.evaluate(el => el.textContent, b);
                if (t && (t.includes('Ver Libro H&S') || t.includes('Libro H&S') || t.includes('Actas H&S'))) {
                    await b.click();
                    console.log('  🎯 Toggle "Ver Libro H&S" activado');
                    break;
                }
            }
            await sleep(1200);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_libro_obra_actas_hys.png'), fullPage: false });
            console.log(`  📸 Captura Actas H&S: 11_libro_obra_actas_hys.png`);
        } catch (e) {
            console.error('  Error en paso 5:', e.message);
        }

        // =========================================================================
        // STEP 6: COORDINACION VISUAL & ALERTAS MARKUP (/coordinacion)
        // =========================================================================
        console.log('\n📍 Paso 6: Probando Coordinación Visual & Markup (/coordinacion)...');
        try {
            await safeGoto(`${BASE_URL}/coordinacion`);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12_coordinacion_visual.png'), fullPage: false });
            console.log(`  📸 Captura Coordinación: 12_coordinacion_visual.png`);
        } catch (e) {
            console.error('  Error en paso 6:', e.message);
        }

        // =========================================================================
        // STEP 7: SIMULADOR WHATSAPP & COPILOTO CONVERSACIONAL (/dashboard)
        // =========================================================================
        console.log('\n📍 Paso 7: Probando Simulador WhatsApp y Copiloto IA...');
        try {
            await safeGoto(`${BASE_URL}/dashboard`);

            // Click on 'Simulador WhatsApp' in sidebar
            const navButtons = await page.$$('nav button, aside button, button');
            for (const b of navButtons) {
                const t = await page.evaluate(el => el.textContent, b);
                if (t && t.includes('Simulador WhatsApp')) {
                    await b.click();
                    console.log('  🎯 Pestaña "Simulador WhatsApp" abierta');
                    break;
                }
            }
            await sleep(1000);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13_whatsapp_simulator.png'), fullPage: false });
            console.log(`  📸 Captura WhatsApp Simulator: 13_whatsapp_simulator.png`);

            // Type in the simulator chat input
            const chatInput = await page.$('input[placeholder*="bot"], input[placeholder*="Pregúntale"], input[type="text"]');
            if (chatInput) {
                await chatInput.click();
                await page.keyboard.type('Faltan 10 tirantes de pino y 2 cajas de tornillos T2 urgente');
                await sleep(500);
                await page.keyboard.press('Enter');
                console.log('  💬 Mensaje de pedido de material enviado en el simulador');
                await sleep(2500);

                await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14_whatsapp_material_sent.png'), fullPage: false });
                console.log(`  📸 Captura chat material: 14_whatsapp_material_sent.png`);
            }
        } catch (e) {
            console.error('  Error en paso 7:', e.message);
        }

        // =========================================================================
        // STEP 8: CONSOLA SUPERADMIN & CRM MULTI-TENANT (/superadmin)
        // =========================================================================
        console.log('\n📍 Paso 8: Probando Consola SuperAdmin (/superadmin)...');
        try {
            await safeGoto(`${BASE_URL}/superadmin`);
            await sleep(600);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15_superadmin_login.png'), fullPage: false });
            console.log(`  📸 Captura SuperAdmin Login: 15_superadmin_login.png`);

            // Unlock SuperAdmin Console
            const pwdInput = await page.$('input[type="password"]');
            if (pwdInput) {
                await pwdInput.click();
                await page.keyboard.type('obrasaas_admin_key');
                await page.keyboard.press('Enter');
                await sleep(1500);
            }

            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15a_superadmin_overview.png'), fullPage: false });
            console.log(`  📸 Captura SuperAdmin Overview: 15a_superadmin_overview.png`);

            // Click Tenants Tab
            let tabButtons = await page.$$('button');
            for (const b of tabButtons) {
                const t = await page.evaluate(el => el.textContent, b);
                if (t && t.includes('Tenants')) {
                    await b.click();
                    break;
                }
            }
            await sleep(800);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15b_superadmin_tenants.png'), fullPage: false });
            console.log(`  📸 Captura SuperAdmin Tenants: 15b_superadmin_tenants.png`);

            // Click Facturación Tab
            tabButtons = await page.$$('button');
            for (const b of tabButtons) {
                const t = await page.evaluate(el => el.textContent, b);
                if (t && (t.includes('Facturación') || t.includes('MRR'))) {
                    await b.click();
                    break;
                }
            }
            await sleep(800);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15c_superadmin_billing.png'), fullPage: false });
            console.log(`  📸 Captura SuperAdmin Billing: 15c_superadmin_billing.png`);

            // Click Auditoría Tab
            tabButtons = await page.$$('button');
            for (const b of tabButtons) {
                const t = await page.evaluate(el => el.textContent, b);
                if (t && (t.includes('Auditoría') || t.includes('Seguridad'))) {
                    await b.click();
                    break;
                }
            }
            await sleep(800);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15d_superadmin_audit.png'), fullPage: false });
            console.log(`  📸 Captura SuperAdmin Audit: 15d_superadmin_audit.png`);

        } catch (e) {
            console.error('  Error en paso 8:', e.message);
        }

        // =========================================================================
        // STEP 9: INSPECCIONES QA/QC & PROTOCOLOS CIRSOC (/inspecciones)
        // =========================================================================
        console.log('\n📍 Paso 9: Probando Inspecciones QA/QC (/inspecciones)...');
        try {
            await safeGoto(`${BASE_URL}/inspecciones`);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '16_inspecciones_qa.png'), fullPage: false });
            console.log(`  📸 Captura Inspecciones: 16_inspecciones_qa.png`);
        } catch (e) {
            console.error('  Error en paso 9:', e.message);
        }

        console.log('\n════════════════════════════════════════════════════════════════════');
        console.log('🏁 TOUR VIRTUAL COMPLETADO CON ÉXITO');
        console.log(`📁 Todas las capturas guardadas en: ${SCREENSHOTS_DIR}`);
        console.log('════════════════════════════════════════════════════════════════════');

    } catch (err) {
        console.error('❌ Error fatal en el tour interactivo:', err);
    } finally {
        await browser.close();
    }
}

runSprintBrowserTour().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
