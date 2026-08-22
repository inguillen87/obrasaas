import { getAppState, saveAppState } from '@/lib/db';
import { appendAuditTransaction } from '@/lib/auditLedger';

export const dynamic = 'force-dynamic';

// GET /api/v1/whatsapp/embedded-signup — Status and Config
export async function GET() {
    try {
        const state = await getAppState();
        const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || '1048291048572910';
        const configId = process.env.META_CONFIG_ID || process.env.NEXT_PUBLIC_META_CONFIG_ID || 'obrasaas_embedded_signup_v4';

        return Response.json({
            success: true,
            appId,
            configId,
            graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v21.0',
            techProvider: {
                name: 'ObraSaaS Enterprise ConTech',
                tier: 'Meta Tech Provider (OBO - On Behalf Of)',
                supportedFeatures: [
                    'WhatsApp Embedded Signup v4',
                    'Bi-directional Webhook Subscriptions (subscribed_apps)',
                    'Multi-tenant WABA isolation',
                    'Voice Copilot (Whisper) & OCR (AFIP)',
                    'UOCRA Digital Payslips & Geofence Attendance'
                ]
            }
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/v1/whatsapp/embedded-signup — Token Exchange & WABA Webhook Subscription
export async function POST(request) {
    try {
        const body = await request.json();
        const { code, wabaId, phoneNumberId, tenantSlug, companyName } = body;

        const appId = process.env.META_APP_ID || '1048291048572910';
        const appSecret = process.env.META_APP_SECRET || '';
        const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';

        let userAccessToken = null;

        // 1. Server-to-Server Token Exchange (if code provided)
        if (code && appSecret) {
            try {
                const tokenUrl = `https://graph.facebook.com/${apiVersion}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`;
                const tokenRes = await fetch(tokenUrl);
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    userAccessToken = tokenData.access_token;
                } else {
                    console.warn('Meta OAuth Token Exchange warning:', await tokenRes.text());
                }
            } catch (tokenErr) {
                console.warn('Token exchange exception:', tokenErr.message);
            }
        }

        // 2. Subscribe ObraSaaS to the Client WABA Webhooks (POST /{wabaId}/subscribed_apps)
        let subscribed = false;
        if (wabaId && (userAccessToken || process.env.META_WHATSAPP_ACCESS_TOKEN)) {
            try {
                const subToken = userAccessToken || process.env.META_WHATSAPP_ACCESS_TOKEN;
                const subRes = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${subToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (subRes.ok) {
                    subscribed = true;
                } else {
                    console.warn('Subscribed apps response:', await subRes.text());
                }
            } catch (subErr) {
                console.warn('Subscribed apps exception:', subErr.message);
            }
        }

        // 3. Persist Tenant WhatsApp Connection into State & Audit Ledger
        const state = await getAppState();
        const resolvedSlug = tenantSlug || (companyName || 'constructora').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        state.tenantWhatsAppAccounts = state.tenantWhatsAppAccounts || {};
        state.tenantWhatsAppAccounts[resolvedSlug] = {
            tenantSlug: resolvedSlug,
            companyName: companyName || state.projectConfig?.name || 'Constructora Cliente',
            wabaId: wabaId || '2046153882937995',
            phoneNumberId: phoneNumberId || '1225843560610854',
            connectedAt: new Date().toISOString(),
            status: 'CONECTADO_ACTIVO',
            provider: 'Meta WhatsApp Cloud API (Tech Provider OBO)',
            subscribedApps: subscribed
        };

        state.auditLedger = appendAuditTransaction(state.auditLedger, {
            action: 'META_EMBEDDED_SIGNUP_COMPLETED',
            actor: companyName || resolvedSlug,
            details: { wabaId, phoneNumberId, tenantSlug: resolvedSlug, subscribed }
        });

        await saveAppState(state);

        return Response.json({
            success: true,
            status: 'CONECTADO',
            tenantSlug: resolvedSlug,
            wabaId: wabaId || state.tenantWhatsAppAccounts[resolvedSlug].wabaId,
            phoneNumberId: phoneNumberId || state.tenantWhatsAppAccounts[resolvedSlug].phoneNumberId,
            subscribedApps: subscribed
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
