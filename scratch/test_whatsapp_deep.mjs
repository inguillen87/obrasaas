// Deep Automated Test for ObraSaaS WhatsApp Templates, Inbound Commands & SuperAdmin APIs
const BASE_URL = 'http://localhost:3000';

async function runTests() {
    console.log('🧪 Starting ObraSaaS Deep WhatsApp & Admin Test Suite...\n');
    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
        if (cond) {
            console.log(`  ✅ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${msg}`);
            failed++;
        }
    }

    // =========================================================================
    // PART 1: SUPERADMIN APIS
    // =========================================================================
    console.log('--- 1. Testing SuperAdmin APIs ---');
    try {
        const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
            headers: { 'x-api-key': 'obrasaas_admin_key' }
        });
        const statsData = await statsRes.json();
        assert(statsRes.status === 200, 'GET /api/admin/stats returns 200');
        assert(statsData.platform?.totalTenants >= 1, `Total tenants in platform: ${statsData.platform?.totalTenants}`);
        assert(statsData.platform?.mrr > 0, `MRR reported: $${statsData.platform?.mrr} USD`);
        assert(statsData.platform?.auditBlocks >= 0, `Audit blocks: ${statsData.platform?.auditBlocks}`);

        const tenantsRes = await fetch(`${BASE_URL}/api/admin/tenants`, {
            headers: { 'x-api-key': 'obrasaas_admin_key' }
        });
        const tenantsData = await tenantsRes.json();
        assert(tenantsRes.status === 200, 'GET /api/admin/tenants returns 200');
        assert(Array.isArray(tenantsData.tenants), `Tenants list length: ${tenantsData.tenants?.length}`);

        // Provision a test tenant
        const newTenantSlug = `test-tenant-${Date.now().toString(36)}`;
        const createTenantRes = await fetch(`${BASE_URL}/api/admin/tenants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'obrasaas_admin_key' },
            body: JSON.stringify({
                name: 'Constructora Austral S.A.',
                slug: newTenantSlug,
                plan: 'professional',
                ownerEmail: 'director@austral.com',
                ownerPhone: '+5492613168608'
            })
        });
        const createTenantData = await createTenantRes.json();
        assert([200, 201].includes(createTenantRes.status), `POST /api/admin/tenants created ${newTenantSlug} (HTTP ${createTenantRes.status})`);
        assert(createTenantData.tenant?.slug === newTenantSlug, 'Tenant created with correct slug');
    } catch (e) {
        console.error('SuperAdmin error:', e.message);
        failed++;
    }

    // =========================================================================
    // PART 2: WHATSAPP DISPATCH TEMPLATES
    // =========================================================================
    console.log('\n--- 2. Testing WhatsApp Outbound Dispatch Templates ---');
    const templateTypes = [
        { type: 'menu_director', label: 'Menú Interactivo Director' },
        { type: 'menu_victoria', label: 'Menú Interactivo Arq. Victoria' },
        { type: 'cirsoc_approval', label: 'Aprobación Estructural CIRSOC 201' },
        { type: 'remito_ocr_confirm', label: 'Confirmación Remito OCR AFIP' },
        { type: 'payslip_signature', label: 'Firma Recibo Sueldo UOCRA' },
        { type: 'absence_alert', label: 'Alerta Temprana de Ausentismo' },
        { type: 'daily_summary', label: 'Resumen Diario de Obra' },
        { type: 'cita_reminder', label: 'Recordatorio Cita de Obra (Sprint 2026)' },
        { type: 'material_approved', label: 'Aprobación Pedido de Material (Sprint 2026)' },
        { type: 'eod_report_request', label: 'Solicitud Reporte Fotográfico 17hs' },
        { type: 'weather_alert', label: 'Alerta Meteorológica Parada de Obra' },
        { type: 'art_alert', label: 'Alerta Vencimiento ART Ley 22.250' },
        { type: 'inspection_approval', label: 'Aprobación Inspección H&S Dec 911/96' }
    ];

    for (const t of templateTypes) {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/whatsapp/dispatch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientPhone: '5492613168608',
                    messageType: t.type,
                    customText: 'Test custom detail'
                })
            });
            const data = await res.json();
            assert(res.status === 200 && data.success === true, `Dispatch template [${t.type}]: ${t.label}`);
        } catch (e) {
            console.error(`Dispatch error on ${t.type}:`, e.message);
            failed++;
        }
    }

    // =========================================================================
    // PART 3: INBOUND WHATSAPP COMMANDS & WEBHOOK WORKFLOWS
    // =========================================================================
    console.log('\n--- 3. Testing Inbound WhatsApp Interactive Webhook ---');

    // 3a. Registered Worker (Juan Gómez: 5491132419981) requests material in natural language
    try {
        const matReqRes = await fetch(`${BASE_URL}/api/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: '5491132419981',
                message: 'Falta cal y 10 bolsas de plasticor urgente para la cuadrilla'
            })
        });
        assert(matReqRes.status === 200, 'Inbound natural language material request accepted');

        // Check if material request exists in DB
        const matListRes = await fetch(`${BASE_URL}/api/v1/materiales`);
        const matListData = await matListRes.json();
        const pendingMat = (matListData.requests || []).find(r => r.justificacion?.includes('plasticor') || r.items?.[0]?.descripcion?.includes('plasticor'));
        assert(!!pendingMat, `New material request was registered in pending_aprobacion state by ${pendingMat?.solicitante}`);

        // 3b. Director approves material request
        const approveMatRes = await fetch(`${BASE_URL}/api/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: '5492613168608',
                message: 'mat_approve'
            })
        });
        assert(approveMatRes.status === 200, 'Director action mat_approve accepted');

        // Verify status is now 'aprobada'
        const matListRes2 = await fetch(`${BASE_URL}/api/v1/materiales`);
        const matListData2 = await matListRes2.json();
        const approvedMat = (matListData2.requests || []).find(r => r.estado === 'aprobada' && r.justificacion?.includes('plasticor'));
        assert(!!approvedMat && !!approvedMat.nroOrdenCompra, `Material request approved with OC: ${approvedMat?.nroOrdenCompra}`);

    } catch (e) {
        console.error('Material request flow error:', e.message);
        failed++;
    }

    // 3c. Cita confirmation
    try {
        const citaRes = await fetch(`${BASE_URL}/api/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: '5492613168608',
                message: 'cita_confirm'
            })
        });
        assert(citaRes.status === 200, 'Inbound cita_confirm action accepted');

        const calRes = await fetch(`${BASE_URL}/api/v1/calendario`);
        const calData = await calRes.json();
        const confirmedAppt = (calData.appointments || []).find(a => a.estado === 'confirmada');
        assert(!!confirmedAppt, `Appointment marked as confirmada: ${confirmedAppt?.title}`);
    } catch (e) {
        console.error('Cita confirm flow error:', e.message);
        failed++;
    }

    // 3d. GPS Geofencing Check-in
    try {
        // Inside geofence (-34.5886, -58.4302) with registered worker
        const gpsInsideRes = await fetch(`${BASE_URL}/api/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: '5491132419981',
                latitude: -34.5886,
                longitude: -58.4302
            })
        });
        assert(gpsInsideRes.status === 200, 'GPS attendance check-in inside geofence accepted');
    } catch (e) {
        console.error('GPS error:', e.message);
        failed++;
    }

    // =========================================================================
    // PART 4: SUMMARY
    // =========================================================================
    console.log('\n=========================================');
    console.log(`🏆 TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log(`🎯 SUCCESS RATE: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log('=========================================\n');

    if (failed > 0) process.exit(1);
}

runTests();
