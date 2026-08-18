import { getAppState, saveAppState } from '@/lib/db';
import { verifyApiAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/v1/webhooks — List registered webhooks
export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return Response.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const state = await getAppState();
        return Response.json({
            webhooks: state.webhooks || [],
            supportedEvents: [
                'task.progress_updated',
                'task.completed',
                'incident.created',
                'incident.resolved',
                'worker.registered',
                'worker.kyc_verified',
                'stock.critical',
                'attendance.checkin',
                'attendance.checkout',
                'libro_obra.entry_created',
                'budget.overrun'
            ]
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/v1/webhooks — Register a new webhook
export async function POST(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return Response.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const { url, events, secret } = await request.json();
        
        if (!url || !events || !Array.isArray(events)) {
            return Response.json({ error: 'url and events[] are required' }, { status: 400 });
        }

        const state = await getAppState();
        state.webhooks = state.webhooks || [];

        const webhook = {
            id: `wh-${Date.now().toString(36)}`,
            url,
            events,
            secret: secret || null,
            active: true,
            createdAt: new Date().toISOString(),
            lastTriggered: null,
            failCount: 0
        };

        state.webhooks.push(webhook);
        await saveAppState(state);

        return Response.json({ webhook }, { status: 201 });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/v1/webhooks — Delete a webhook
export async function DELETE(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return Response.json({ error: 'Authentication required' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const webhookId = searchParams.get('id');

        if (!webhookId) return Response.json({ error: 'id query param required' }, { status: 400 });

        const state = await getAppState();
        state.webhooks = (state.webhooks || []).filter(w => w.id !== webhookId);
        await saveAppState(state);

        return Response.json({ deleted: webhookId });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
