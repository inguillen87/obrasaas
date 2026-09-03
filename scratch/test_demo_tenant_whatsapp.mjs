const BASE_URL = 'http://localhost:3000';

async function testDemoTenantWhatsApp() {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║   🏢 OBRASAAS — DEMO TENANT WHATSAPP INTEGRATION & ISOLATION QA   ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    let passed = 0;

    // 1. Connect / Verify Demo Tenant in Embedded Signup
    console.log('1. Verificando vinculación de WABA del Tenant Demo (Palermo Soho)...');
    const signupRes = await fetch(`${BASE_URL}/api/v1/whatsapp/embedded-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tenantSlug: 'palermo-soho',
            companyName: 'Constructora Palermo Soho S.A.',
            wabaId: '2046153882937995',
            phoneNumberId: '1225843560610854'
        })
    });
    const signupData = await signupRes.json();
    if (signupData.success && signupData.tenantSlug === 'palermo-soho') {
        console.log('  ✅ [PASS] Tenant Demo WABA vinculado correctamente.');
        passed++;
    } else {
        console.error('  ❌ [FAIL] Error vinculando tenant demo:', signupData);
    }

    // 2. Incoming Webhook routing to Tenant Demo via phoneNumberId
    console.log('2. Enviando mensaje entrante simulado desde Meta para el Tenant Demo...');
    const webhookRes = await fetch(`${BASE_URL}/api/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            object: 'whatsapp_business_account',
            entry: [{
                id: '2046153882937995',
                changes: [{
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '+54 9 11 5555-0199',
                            phone_number_id: '1225843560610854'
                        },
                        contacts: [{ profile: { name: 'Marcelo Guillén' }, wa_id: '5492613168608' }],
                        messages: [{
                            from: '5492613168608',
                            id: `wamid_tenant_demo_${Date.now()}`,
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            type: 'text',
                            text: { body: '¿Cuál es el saldo de caja y el personal presente en el tenant demo?' }
                        }]
                    },
                    field: 'messages'
                }]
            }]
        })
    });
    const webhookData = await webhookRes.json();
    if (webhookData.success && (webhookData.reply || webhookData.response)) {
        const replyText = webhookData.reply || webhookData.response;
        console.log('  ✅ [PASS] Webhook procesó el mensaje y respondió con éxito.');
        console.log(`     💬 Respuesta bot: "${replyText.slice(0, 75).replace(/\n/g, ' ')}..."`);
        passed++;
    } else {
        console.error('  ❌ [FAIL] Webhook falló:', webhookData);
    }

    // 3. Verify dispatch from tenant demo
    console.log('3. Despachando menú interactivo para el Tenant Demo...');
    const dispatchRes = await fetch(`${BASE_URL}/api/v1/whatsapp/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipientPhone: '5492613168608',
            type: 'menu_director',
            tenantSlug: 'palermo-soho'
        })
    });
    const dispatchData = await dispatchRes.json();
    if (dispatchData.success) {
        console.log('  ✅ [PASS] Menú interactivo despachado exitosamente.');
        passed++;
    } else {
        console.error('  ❌ [FAIL] Despacho falló:', dispatchData);
    }

    console.log('\n════════════════════════════════════════════════════════════════════');
    console.log(`📊 RESULTADO TENANT DEMO QA: ${passed}/3 PRUEBAS PASADAS`);
    console.log('════════════════════════════════════════════════════════════════════\n');
}

testDemoTenantWhatsApp().catch(console.error);
