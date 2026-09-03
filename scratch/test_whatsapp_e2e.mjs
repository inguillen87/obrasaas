const BASE_URL = 'http://localhost:3000';

async function runWhatsAppE2E() {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║   📱 OBRASAAS — DEEP WHATSAPP & MULTI-ROLE E2E QA AUDIT           ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    let passed = 0;
    let failed = 0;

    const testStep = async (name, fn) => {
        try {
            await fn();
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ [FAIL] ${name} — ${err.message}`);
            failed++;
        }
    };

    // 1. Meta Embedded Signup & Tech Provider Health Check
    await testStep('1. Health & Meta Tech Provider Config (GET /api/v1/whatsapp/embedded-signup)', async () => {
        const res = await fetch(`${BASE_URL}/api/v1/whatsapp/embedded-signup`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success || !data.appId) throw new Error('Invalid config response');
    });

    // 2. Meta Dispatcher API Health Check
    await testStep('2. Dispatcher Health & Director Config (GET /api/v1/whatsapp/dispatch)', async () => {
        const res = await fetch(`${BASE_URL}/api/v1/whatsapp/dispatch`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success || !data.directors?.marcelo?.phone) throw new Error('Missing director config');
    });

    // 3. Webhook GET Handshake (Meta Hub Verify Token)
    await testStep('3. Meta Webhook Handshake (GET /api/whatsapp hub.mode=subscribe)', async () => {
        const res = await fetch(`${BASE_URL}/api/whatsapp?hub.mode=subscribe&hub.verify_token=obrasaas_meta_secret_2026&hub.challenge=test_challenge_12345`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (text !== 'test_challenge_12345') throw new Error(`Expected challenge match, got ${text}`);
    });

    // 4. Worker Check-in: Satellite GPS Geofencing (POST /api/whatsapp)
    await testStep('4. Worker Satellite GPS Attendance Check-in (Juan Zapata)', async () => {
        const res = await fetch(`${BASE_URL}/api/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: '5491138452190',
                latitude: -34.5886,
                longitude: -58.4302
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('Attendance check-in not successful');
    });

    // 5. Worker Voice Note: Whisper Audio to Gantt Progress
    await testStep('5. Voice Note (Whisper Audio) -> Task Progress Parser', async () => {
        const res = await fetch(`${BASE_URL}/api/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: '5491138452190',
                bodyText: 'Audio de obra: Terminamos el armado de vigas del 3er piso según plano.',
                mediaUrl: 'audio_vigas_piso3.mp3',
                mediaType: 'audio/mpeg'
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('Audio progress update failed');
    });

    // 6. Multimodal Remito AFIP OCR & Materials Delivery
    await testStep('6. Vision OCR Remito/Factura Photo -> Cost Entry', async () => {
        const res = await fetch(`${BASE_URL}/api/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: '5491138452190',
                bodyText: 'Remito de entrega: 200 bolsas de cemento Loma Negra Tipo CPC40',
                mediaUrl: 'remito_cemento_ln.jpg',
                mediaType: 'image/jpeg'
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('Remito OCR processing failed');
    });

    // 7. Director (Marcelo Guillén) Interactive Menu Query
    await testStep('7. Director General (Marcelo Guillén) Interactive Menu Dispatch', async () => {
        const res = await fetch(`${BASE_URL}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientPhone: '5492613168608',
                messageType: 'menu_director'
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('Director menu dispatch failed');
    });

    // 8. Technical Director (Victoria) Structural & CIRSOC 201 Audit
    await testStep('8. Technical Director (Victoria) Technical Menu Dispatch', async () => {
        const res = await fetch(`${BASE_URL}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientPhone: '5492964520753',
                messageType: 'menu_victoria'
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('Victoria menu dispatch failed');
    });

    // 9. Early Absence Alert at 08:30 hs (Qontact Leapfrog Engine)
    await testStep('9. Early Absence 08:30 Alert with Crew Rebalancing Dispatch', async () => {
        const res = await fetch(`${BASE_URL}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientPhone: '5492613168608',
                messageType: 'absence_alert'
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('Absence alert dispatch failed');
    });

    // 10. UOCRA Digital Payslip Webview & Signature Verification
    await testStep('10. UOCRA Digital Payslips API (GET & POST /api/v1/recibos)', async () => {
        const getRes = await fetch(`${BASE_URL}/api/v1/recibos`);
        if (!getRes.ok) throw new Error(`GET /api/v1/recibos HTTP ${getRes.status}`);
        const getData = await getRes.json();
        if (!getData.success || getData.receipts.length === 0) throw new Error('No receipts returned');

        const postRes = await fetch(`${BASE_URL}/api/v1/recibos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workerId: 'juan',
                signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                signatureHash: 'SHA256:7f8a9b2c3d4e5f6a1b2c3d4e5f6a7b8c'
            })
        });
        if (!postRes.ok) throw new Error(`POST /api/v1/recibos HTTP ${postRes.status}`);
        const postData = await postRes.json();
        if (!postData.success || postData.status !== 'FIRMADO') throw new Error('Receipt signature recording failed');
    });

    // 11. Meta Embedded Signup Tenant Token Exchange
    await testStep('11. Meta Embedded Signup v4 Onboarding Exchange (POST /api/v1/whatsapp/embedded-signup)', async () => {
        const res = await fetch(`${BASE_URL}/api/v1/whatsapp/embedded-signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: 'AQD_test_oauth_code_meta_2026',
                wabaId: '2046153882937995',
                phoneNumberId: '1225843560610854',
                tenantSlug: 'constructora-demo',
                companyName: 'Constructora Palermo S.A.'
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success || data.status !== 'CONECTADO') throw new Error('Embedded signup exchange failed');
    });

    // 12. End-of-Day Daily Summary WhatsApp Push Dispatch
    await testStep('12. End-of-Day Executive Summary WhatsApp Push (GET /api/cron/daily-summary)', async () => {
        const res = await fetch(`${BASE_URL}/api/cron/daily-summary`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('Daily summary push cron failed');
    });

    // 13. Interactive CIRSOC 201 Structural Approval Button Dispatch
    await testStep('13. Interactive CIRSOC 201 Structural Button Dispatch (POST /api/v1/whatsapp/dispatch)', async () => {
        const res = await fetch(`${BASE_URL}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientPhone: '5492964520753',
                messageType: 'cirsoc_approval'
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('CIRSOC approval dispatch failed');
    });

    // 14. Interactive Remito OCR Confirmation Dispatch
    await testStep('14. Interactive Remito OCR Confirmation Dispatch (POST /api/v1/whatsapp/dispatch)', async () => {
        const res = await fetch(`${BASE_URL}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientPhone: '5492613168608',
                messageType: 'remito_ocr_confirm',
                customText: 'Hierro del 12 (150 barras)'
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('Remito OCR confirmation dispatch failed');
    });

    // 15. Interactive UOCRA Payslip Signature Dispatch
    await testStep('15. Interactive UOCRA Payslip Signature Dispatch (POST /api/v1/whatsapp/dispatch)', async () => {
        const res = await fetch(`${BASE_URL}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientPhone: '5491138452190',
                messageType: 'payslip_signature',
                workerId: 'juan'
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('Payslip signature dispatch failed');
    });

    console.log('\n════════════════════════════════════════════════════════════════════');
    console.log(`📊 WHATSAPP E2E AUDIT RESULT: ${passed} PASSED / ${failed} FAILED (${((passed/(passed+failed))*100).toFixed(1)}%)`);
    console.log('════════════════════════════════════════════════════════════════════\n');

    if (failed > 0) process.exit(1);
}

runWhatsAppE2E().catch(err => {
    console.error('Fatal E2E error:', err);
    process.exit(1);
});
