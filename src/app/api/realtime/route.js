import { getAppState, getMessages } from '@/lib/db';
import { realtimeBus } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant') || 'default';

    const encoder = new TextEncoder();
    let unsubscribe = null;
    let heartbeatTimer = null;

    const stream = new ReadableStream({
        async start(controller) {
            try {
                // 1. Send initial snapshot immediately upon connection
                const [initialState, initialMessages] = await Promise.all([
                    getAppState(),
                    getMessages()
                ]);

                const initPayload = JSON.stringify({
                    type: 'INIT',
                    tenantId,
                    version: realtimeBus.getTenantVersion(tenantId),
                    timestamp: new Date().toISOString(),
                    data: {
                        state: initialState,
                        messages: initialMessages
                    }
                });

                controller.enqueue(encoder.encode('event: init\ndata: ' + initPayload + '\n\n'));

                // 2. Subscribe to real-time events for this tenant
                unsubscribe = realtimeBus.subscribe(tenantId, (event) => {
                    try {
                        const eventPayload = JSON.stringify({
                            type: event.eventType,
                            tenantId: event.tenantId,
                            version: event.version,
                            timestamp: event.timestamp,
                            data: event.payload
                        });

                        controller.enqueue(encoder.encode('event: update\ndata: ' + eventPayload + '\n\n'));
                    } catch (pushErr) {
                        console.warn('Error pushing SSE event to client:', pushErr.message);
                    }
                });

                // 3. Heartbeat ping every 20s to keep connection alive through proxies/firewalls
                heartbeatTimer = setInterval(() => {
                    try {
                        controller.enqueue(encoder.encode(': ping ' + Date.now() + '\n\n'));
                    } catch (pingErr) {
                        clearInterval(heartbeatTimer);
                    }
                }, 20000);

            } catch (err) {
                console.error('Error starting SSE stream:', err);
                controller.close();
            }
        },
        cancel() {
            // Clean up when client disconnects
            if (unsubscribe) {
                unsubscribe();
            }
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
            }
        }
    });

    // Clean up on request abort
    request.signal.addEventListener('abort', () => {
        if (unsubscribe) unsubscribe();
        if (heartbeatTimer) clearInterval(heartbeatTimer);
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform, no-store, must-revalidate',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*'
        }
    });
}