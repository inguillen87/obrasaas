import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = 'C:/Users/guill/.gemini/antigravity/brain/3df1b943-68c1-44ae-b5b0-c16b3883609e';
const BASE_URL = 'http://localhost:3000';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWhatsAppSimulation(payload) {
    const res = await fetch(`${BASE_URL}/api/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await res.json();
}

async function main() {
    console.log('🏗️ INICIANDO SIMULACIÓN DE CICLO DE VIDA COMPLETO DE OBRA EN TIEMPO REAL...');
    console.log('📍 Proyecto: Torre Palermo Soho (-34.5886, -58.4302)\n');

    // 1. Launch Puppeteer browser to watch the live Dashboard
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });

    // Auto-login so modal is not blocking dashboard view
    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('obrasaas_logged_in', 'true');
    });

    console.log('🖥️ Abriendo Dashboard en http://localhost:3000/dashboard...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Initial state screenshot
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_00_inicio_jornada.png') });
    console.log('📸 Screenshot guardado: lifecycle_00_inicio_jornada.png');

    // =========================================================================
    // HITO 1: 07:45 AM — Fichaje Satelital GPS de Juan Gómez (Albañil Principal)
    // =========================================================================
    console.log('\n=============================================================');
    console.log('⏰ HITO 1: 07:45 AM — Fichaje Satelital GPS (Juan Gómez)');
    console.log('=============================================================');

    const checkinPayload = {
        from: '5491132419981', // Juan Gómez
        message: 'Llegando a la obra, envío mi ubicación',
        latitude: -34.5885, // 15m from center (-34.5886, -58.4302)
        longitude: -58.4301
    };

    console.log('📲 Juan Gómez envía ubicación GPS por WhatsApp...');
    const res1 = await sendWhatsAppSimulation(checkinPayload);
    console.log('🤖 Respuesta del Bot:', res1.status || 'OK');
    await sleep(3000); // Wait for SSE event to propagate and React to re-render

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_01_fichaje_gps_juan.png') });
    console.log('📸 Screenshot guardado: lifecycle_01_fichaje_gps_juan.png (Asistencia & Operarios actualizados)');

    // =========================================================================
    // HITO 2: 08:30 AM — Consulta de Cuadrilla por Arq. Victoria (Directora Técnica)
    // =========================================================================
    console.log('\n=============================================================');
    console.log('⏰ HITO 2: 08:30 AM — Supervisión Técnica (Arq. Victoria)');
    console.log('=============================================================');

    console.log('📲 Arq. Victoria solicita estado de cuadrilla y ART...');
    const res2 = await sendWhatsAppSimulation({
        from: '5492964520753', // Arq. Victoria
        message: '1' // Opción 1: Cuadrilla & KYC
    });
    console.log('🤖 Bot responde con estado de cuadrilla UOCRA');
    await sleep(2000);

    // =========================================================================
    // HITO 3: 10:15 AM — Recepción de Cemento con Remito OCR & Validación AFIP
    // =========================================================================
    console.log('\n=============================================================');
    console.log('⏰ HITO 3: 10:15 AM — Remito Cemento Loma Negra & AFIP OCR');
    console.log('=============================================================');

    console.log('📲 Capataz envía remito escaneado por WhatsApp...');
    const res3 = await sendWhatsAppSimulation({
        from: '5491188997766', // Luis Martínez (Capataz)
        message: 'Remito de Cemento Loma Negra 40 bolsas',
        Body: 'Remito Loma Negra Cemento 40 bolsas $185000'
    });
    await sleep(3000);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_02_remito_cemento_afip.png') });
    console.log('📸 Screenshot guardado: lifecycle_02_remito_cemento_afip.png (Caja Chica y Remitos)');

    // =========================================================================
    // HITO 4: 12:30 PM — Reporte de Avance y Actualización de Gantt al 100%
    // =========================================================================
    console.log('\n=============================================================');
    console.log('⏰ HITO 4: 12:30 PM — Avance Gantt 100% (Revoque Grueso)');
    console.log('=============================================================');

    console.log('📲 Marcelo (Director General) certifica avance de Revoque Grueso...');
    const res4 = await sendWhatsAppSimulation({
        from: '5492613168608', // Marcelo Guillén
        message: '2' // Opción 2: Certificar Avance de Tarea 1 a 100%
    });
    await sleep(3000);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_03_gantt_avance_100.png') });
    console.log('📸 Screenshot guardado: lifecycle_03_gantt_avance_100.png (Gantt actualizado en tiempo real)');

    // =========================================================================
    // HITO 5: 14:00 PM — Inspección Fotográfica Técnica con IA
    // =========================================================================
    console.log('\n=============================================================');
    console.log('⏰ HITO 5: 14:00 PM — Inspección Fotográfica y Calidad CIRSOC');
    console.log('=============================================================');

    console.log('📲 Arq. Victoria envía foto técnica de armadura de columnas...');
    const res5 = await sendWhatsAppSimulation({
        from: '5492964520753', // Arq. Victoria
        message: 'Foto de inspección armadura losa 4to piso conforme a CIRSOC 201'
    });
    await sleep(2000);

    // =========================================================================
    // HITO 6: 16:30 PM — Notificación de Recibo de Sueldo UOCRA Quincenal
    // =========================================================================
    console.log('\n=============================================================');
    console.log('⏰ HITO 6: 16:30 PM — Recibo de Sueldo Digital UOCRA');
    console.log('=============================================================');

    console.log('📲 Juan Gómez consulta su recibo de sueldo por WhatsApp...');
    const res6 = await sendWhatsAppSimulation({
        from: '5491132419981', // Juan Gómez
        message: '7' // Opción 7: Recibo de sueldo UOCRA
    });
    await sleep(2000);

    // =========================================================================
    // HITO 7: 17:30 PM — Cierre de Jornada: Libro de Obra Digital SHA-256
    // =========================================================================
    console.log('\n=============================================================');
    console.log('⏰ HITO 7: 17:30 PM — Cierre de Jornada & Libro de Obra Digital');
    console.log('=============================================================');

    console.log('📲 Marcelo genera el asiento en el Libro de Obra Digital...');
    const res7 = await sendWhatsAppSimulation({
        from: '5492613168608', // Marcelo Guillén
        message: '9' // Opción 9: Libro de Obra Digital (Ley 22.250)
    });
    await sleep(3000);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_04_cierre_libro_obra.png') });
    console.log('📸 Screenshot guardado: lifecycle_04_cierre_libro_obra.png (Libro de Obra y Ledger SHA-256)');

    // Tab-specific detailed screenshots
    console.log('\n📊 Capturando vistas de cada pestaña del sistema...');

    await page.goto(`${BASE_URL}/dashboard?tab=sec-gantt`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_06_tab_gantt.png') });
    console.log('📸 Screenshot guardado: lifecycle_06_tab_gantt.png (Cronograma Gantt Q1/Q2)');

    await page.goto(`${BASE_URL}/dashboard?tab=sec-personal`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_07_tab_cuadrilla.png') });
    console.log('📸 Screenshot guardado: lifecycle_07_tab_cuadrilla.png (Cuadrilla, Asistencia y ART)');

    await page.goto(`${BASE_URL}/dashboard?tab=sec-admin`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_08_tab_remitos_afip.png') });
    console.log('📸 Screenshot guardado: lifecycle_08_tab_remitos_afip.png (Remitos y Comprobantes AFIP)');

    await page.goto(`${BASE_URL}/dashboard?tab=sec-whatsapp`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'lifecycle_09_tab_whatsapp_live.png') });
    console.log('📸 Screenshot guardado: lifecycle_09_tab_whatsapp_live.png (Conversaciones en Vivo WhatsApp)');

    await browser.close();
    console.log('\n🎉 SIMULACIÓN DE CICLO DE VIDA COMPLETO EJECUTADA CON ÉXITO.');
}

main().catch(err => {
    console.error('❌ Error en la simulación:', err);
    process.exit(1);
});
