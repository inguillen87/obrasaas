import { getAppState, saveAppState } from '@/lib/db';
import { sendWhatsAppMessage, sendWhatsAppTemplate, sendWhatsAppInteractive } from '@/lib/whatsappNotifications';
import { buildDirectorListMessage, buildVictoriaListMessage, buildWorkerListMessage } from '@/lib/metaTemplates';
import { generateWebviewToken } from '@/lib/auth';
import { appendAuditTransaction } from '@/lib/auditLedger';

export const dynamic = 'force-dynamic';

// GET /api/v1/whatsapp/dispatch — Health & Meta Connection Status
export async function GET() {
    try {
        const state = await getAppState();
        const hasToken = !!(process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN);
        const hasPhoneId = !!(process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID);
        const hasWaba = !!process.env.META_WABA_ID;

        return Response.json({
            success: true,
            status: hasToken && hasPhoneId ? 'connected' : 'unconfigured',
            meta: {
                hasAccessToken: hasToken,
                phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '1225843560610854',
                wabaId: process.env.META_WABA_ID || '2046153882937995',
                apiVersion: process.env.META_GRAPH_API_VERSION || 'v21.0',
                verifyTokenConfigured: !!process.env.META_VERIFY_TOKEN
            },
            directors: {
                guillermo: {
                    name: 'Guillermo / Arq. Marcelo',
                    role: 'Director de Obra & SuperAdmin',
                    phone: state.projectConfig?.directorPhone || process.env.DIRECTOR_PHONE || '54261153168608'
                },
                victoria: {
                    name: 'Arq. Victoria',
                    role: 'Socia & Directora Técnica',
                    phone: state.projectConfig?.techDirectorPhone || process.env.VICTORIA_PHONE || '54296415520753'
                }
            },
            features: {
                interactiveLists: true,
                voiceCopilotWhisper: true,
                visionOcrRemitos: true,
                gpsGeofencing: true,
                digitalPayslipsUocra: true,
                earlyAbsenceAlerts: true
            }
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/v1/whatsapp/dispatch — Real Phone Push Dispatcher
export async function POST(request) {
    try {
        const body = await request.json();
        const { recipientPhone, messageType, customText, workerId } = body;

        const state = await getAppState();
        const cleanTo = (recipientPhone || '').replace(/\D/g, '');

        if (!cleanTo) {
            return Response.json({ success: false, error: 'Recipient phone number is required' }, { status: 400 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://obrasaas.vercel.app';
        let dispatchResult = null;
        let messageBody = '';

        if (messageType === 'menu_director') {
            const listPayload = buildDirectorListMessage(state, cleanTo);
            const token = process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
            const pnid = process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
            const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';

            messageBody = `👑 *Centro de Mando — Director de Obra*\n\n1️⃣ Cuadrilla & KYC\n2️⃣ Certificar Avance\n3️⃣ Incidencia Crítica\n4️⃣ Replanificar Demora\n5️⃣ Proveedores\n6️⃣ Plan Quincenal\n7️⃣ Rendir Caja Chica\n8️⃣ Auditoría ART & GPS\n9️⃣ Libro de Obra\n🔟 Costos por Rubro\n1️⃣1️⃣ Certificado de Avance`;

            if (token && pnid) {
                try {
                    const res = await fetch(`https://graph.facebook.com/${apiVersion}/${pnid}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(listPayload)
                    });
                    if (res.ok) {
                        const data = await res.json();
                        dispatchResult = { success: true, messageId: data.messages?.[0]?.id, data };
                    } else {
                        dispatchResult = await sendWhatsAppMessage(cleanTo, messageBody);
                    }
                } catch (e) {
                    dispatchResult = await sendWhatsAppMessage(cleanTo, messageBody);
                }
            } else {
                dispatchResult = await sendWhatsAppMessage(cleanTo, messageBody);
            }
        } else if (messageType === 'menu_victoria') {
            const listPayload = buildVictoriaListMessage(state, cleanTo);
            const token = process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
            const pnid = process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
            const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';

            messageBody = `📐 *Panel Técnico — Arq. Victoria*\n\n1️⃣ Estado de Cuadrilla & KYC\n2️⃣ Control Estructural CIRSOC 201\n3️⃣ Inspección de Incidencias\n4️⃣ Certificaciones Quincenales\n5️⃣ Balance de Caja Chica & AFIP`;

            if (token && pnid) {
                try {
                    const res = await fetch(`https://graph.facebook.com/${apiVersion}/${pnid}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(listPayload)
                    });
                    if (res.ok) {
                        const data = await res.json();
                        dispatchResult = { success: true, messageId: data.messages?.[0]?.id, data };
                    } else {
                        dispatchResult = await sendWhatsAppMessage(cleanTo, messageBody);
                    }
                } catch (e) {
                    dispatchResult = await sendWhatsAppMessage(cleanTo, messageBody);
                }
            } else {
                dispatchResult = await sendWhatsAppMessage(cleanTo, messageBody);
            }
        } else if (messageType === 'recibo_uocra') {
            const targetWorker = workerId || 'juan';
            const token = generateWebviewToken(targetWorker);
            const link = `${appUrl}/webview/recibos?worker=${targetWorker}&token=${token}`;
            messageBody = `📄 *Recibo de Sueldo Digital (UOCRA CCT 76/75)*\n\nHola. Tu liquidación de la 1ra Quincena está lista para su firma digital:\n\n👉 *Firmar Recibo:* ${link}\n\n_Ley 20.744 art. 140 / Sello SHA-256 inmutable._`;
            dispatchResult = await sendWhatsAppMessage(cleanTo, messageBody);
        } else if (messageType === 'absence_alert') {
            const projName = state.projectConfig?.name || 'Torre Palermo Soho';
            messageBody = `🚨 *Alerta Temprana de Ausentismo (08:30 hs)*\n\n• Operario: *Juan Zapata (Oficial Armador)*\n• Obra: *${projName}*\n• Estado: *Sin Fichaje GPS a las 08:30 hs*\n\n📋 *Acciones Recomendadas:*\n1. Rebalancear cuadrilla en Gantt\n2. Convocar suplente: Carlos Gómez (Armador)\n\n_ObraSaaS Workforce Intelligence_`;
            dispatchResult = await sendWhatsAppMessage(cleanTo, messageBody);
        } else if (messageType === 'daily_summary') {
            const projName = state.projectConfig?.name || 'TORRE PALERMO';
            const dateStr = new Date().toLocaleDateString('es-AR');
            messageBody = `🏗️ *RESUMEN DIARIO DE OBRA — ${projName}*\n📅 ${dateStr}\n\n👷 Presentismo: *4/5 operarios* (80%)\n🔨 Avance Global: *${state.avancePercentage || 24}%*\n💰 Caja Chica Hoy: *$18.500 ARS*\n🚨 Incidencias Activas: *${state.alertsCount || 1}*\n\n_ObraSaaS Engine_`;
            dispatchResult = await sendWhatsAppMessage(cleanTo, messageBody);
        } else {
            messageBody = customText || 'Mensaje de prueba enviado desde ObraSaaS Hub.';
            dispatchResult = await sendWhatsAppMessage(cleanTo, messageBody);
        }

        // Audit dispatch
        state.auditLedger = appendAuditTransaction(state.auditLedger, {
            action: 'WHATSAPP_DIRECT_DISPATCH',
            actor: 'Dashboard Admin Hub',
            details: { recipient: cleanTo.slice(-4), messageType, success: dispatchResult?.success }
        });
        await saveAppState(state);

        return Response.json({
            success: dispatchResult?.success ?? true,
            recipient: cleanTo,
            messageType,
            messageId: dispatchResult?.messageId,
            error: dispatchResult?.error
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
