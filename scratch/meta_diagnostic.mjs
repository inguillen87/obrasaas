import fs from 'fs';
import dotenv from 'dotenv';

// Load env
const envContent = fs.readFileSync('.env.local', 'utf8');
const parsed = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([A-Z_]+)="?([^"\n]+)"?$/);
    if (match) parsed[match[1]] = match[2];
});

const token = parsed.META_WHATSAPP_ACCESS_TOKEN;
const phoneId = parsed.META_PHONE_NUMBER_ID;
const wabaId = parsed.META_WABA_ID;
const version = parsed.META_GRAPH_API_VERSION || 'v25.0';

console.log('══════════════════════════════════════════════════════════════');
console.log('  📱 OBRASAAS — META WHATSAPP CLOUD API DIAGNOSTIC');
console.log('══════════════════════════════════════════════════════════════\n');

// 1. Phone number registration status
console.log('1. Verificando registro del número de teléfono...');
try {
    const phoneRes = await fetch(`https://graph.facebook.com/${version}/${phoneId}?fields=verified_name,code_verification_status,quality_rating,platform_type,display_phone_number,name_status&access_token=${token}`);
    const phoneData = await phoneRes.json();
    console.log('   Resultado:', JSON.stringify(phoneData, null, 2));
} catch(e) {
    console.error('   Error:', e.message);
}

// 2. WABA account status
console.log('\n2. Verificando cuenta WABA...');
try {
    const wabaRes = await fetch(`https://graph.facebook.com/${version}/${wabaId}?fields=name,timezone_id,message_template_namespace,account_review_status&access_token=${token}`);
    const wabaData = await wabaRes.json();
    console.log('   Resultado:', JSON.stringify(wabaData, null, 2));
} catch(e) {
    console.error('   Error:', e.message);
}

// 3. Webhook subscriptions
console.log('\n3. Verificando suscripciones de webhook...');
try {
    const subRes = await fetch(`https://graph.facebook.com/${version}/${wabaId}/subscribed_apps?access_token=${token}`);
    const subData = await subRes.json();
    console.log('   Resultado:', JSON.stringify(subData, null, 2));
} catch(e) {
    console.error('   Error:', e.message);
}

// 4. Send a test message to Marcelo's phone
console.log('\n4. Enviando mensaje de prueba real a Marcelo (+5492613168608)...');
try {
    const sendRes = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: '5492613168608',
            type: 'text',
            text: {
                body: '🏗️ *ObraSaaS Enterprise — Test de Conexión en Vivo*\n\n✅ La plataforma está conectada correctamente con Meta WhatsApp Cloud API.\n\n📍 Enviá tu *ubicación GPS* para fichar en la obra.\n📸 Enviá una *foto de remito* para procesar con OCR.\n🎙️ Enviá una *nota de voz* para transcripción con IA.\n\nEscribí *"menú"* para ver todas las opciones.\n\n_Timestamp: ' + new Date().toISOString() + '_'
            }
        })
    });
    const sendData = await sendRes.json();
    console.log('   Status HTTP:', sendRes.status);
    console.log('   Resultado:', JSON.stringify(sendData, null, 2));

    if (sendData.messages?.[0]?.id) {
        console.log('   ✅ MENSAJE ENVIADO EXITOSAMENTE');
        console.log('   📨 Message ID:', sendData.messages[0].id);
    } else if (sendData.error) {
        console.log('   ❌ ERROR:', sendData.error.message);
        console.log('   Code:', sendData.error.code);
    }
} catch(e) {
    console.error('   Error:', e.message);
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  DIAGNÓSTICO COMPLETADO');
console.log('══════════════════════════════════════════════════════════════');
