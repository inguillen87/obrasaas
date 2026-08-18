import { getAppState, getMessages } from '@/lib/db';
import { getStateVersion, getStateSnapshot, realtimeBus, isServerlessMode } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// Enterprise SSE Endpoint — Serverless-Compatible Realtime
// 
// Strategy:
// - SERVERLESS (Vercel + Neon): Polls Postgres updated_at every 2s
//   When timestamp changes → fetches full state → pushes to client
// - LOCAL DEV: Uses in-memory EventEmitter for instant push
// ============================================================================

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant') || 'default';

    const encoder = new TextEncoder();
    let unsubscribe = null;
    let pollTimer = null;
    let heartbeatTimer = null;
    let closed = false;

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
                    timestamp: new Date().toISOString(),
                    data: {
                        state: initialState,
                        messages: initialMessages
                    }
                });

                controller.enqueue(encoder.encode('event: init\ndata: ' + initPayload + '\n\n'));

                // 2. Choose realtime strategy based on environment
                if (isServerlessMode()) {
                    // =========================================================
                    // SERVERLESS MODE: Poll Postgres updated_at every 2 seconds
                    // This works across lambda instances because state is in DB
                    // =========================================================
                    let lastVersion = await getStateVersion(tenantId);

                    pollTimer = setInterval(async () => {
                        if (closed) return;
                        try {
                            const currentVersion = await getStateVersion(tenantId);
                            
                            if (currentVersion && currentVersion !== lastVersion) {
                                lastVersion = currentVersion;
                                
                                // State changed — fetch and push full snapshot
                                const snapshot = await getStateSnapshot(tenantId);
                                if (snapshot) {
                                    const updatePayload = JSON.stringify({
                                        type: 'STATE_UPDATE',
                                        tenantId,
                                        version: snapshot.version,
                                        timestamp: new Date().toISOString(),
                                        data: snapshot.state
                                    });
                                    controller.enqueue(encoder.encode('event: update\ndata: ' + updatePayload + '\n\n'));

                                    // Also push messages if they changed
                                    const msgPayload = JSON.stringify({
                                        type: 'MESSAGE_RECEIVED',
                                        tenantId,
                                        timestamp: new Date().toISOString(),
                                        data: snapshot.messages
                                    });
                                    controller.enqueue(encoder.encode('event: update\ndata: ' + msgPayload + '\n\n'));
                                }
                            }
                        } catch (pollErr) {
                            console.warn('SSE poll error:', pollErr.message);
                        }
                    }, 2000); // Poll every 2 seconds

                } else {
                    // =========================================================
                    // LOCAL DEV MODE: Use EventEmitter for instant push
                    // =========================================================
                    unsubscribe = realtimeBus.subscribe(tenantId, (event) => {
                        if (closed) return;
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
                }

                // 3. Heartbeat ping every 15s to keep connection alive through proxies/firewalls
                heartbeatTimer = setInterval(() => {
                    if (closed) return;
                    try {
                        controller.enqueue(encoder.encode(': ping ' + Date.now() + '\n\n'));
                    } catch (pingErr) {
                        cleanup();
                    }
                }, 15000);

            } catch (err) {
                console.error('Error starting SSE stream:', err);
                controller.close();
            }
        },
        cancel() {
            cleanup();
        }
    });

    function cleanup() {
        closed = true;
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    // Clean up on request abort
    request.signal.addEventListener('abort', cleanup);

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