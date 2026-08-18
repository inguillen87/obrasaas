// ============================================================================
// ObraSaaS Enterprise — Webhook Event Dispatcher
// Fires registered webhooks when events occur in the platform
// ============================================================================

/**
 * Dispatch an event to all registered webhooks that listen for it.
 * Non-blocking — fires and forgets. Logs failures.
 * 
 * @param {object} state - Current app state (contains state.webhooks)
 * @param {string} eventType - Event type (e.g., 'task.completed', 'incident.created')
 * @param {object} payload - Event payload to send
 */
export async function dispatchWebhookEvent(state, eventType, payload) {
    const webhooks = (state?.webhooks || []).filter(w => 
        w.active && w.events.includes(eventType)
    );

    if (webhooks.length === 0) return;

    const eventData = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
        project: {
            id: state.projectConfig?.id,
            name: state.projectConfig?.name
        }
    };

    for (const webhook of webhooks) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'X-ObraSaaS-Event': eventType,
                'X-ObraSaaS-Delivery': `delivery-${Date.now().toString(36)}`
            };

            // Add HMAC signature if secret is configured
            if (webhook.secret) {
                try {
                    const { createHmac } = await import('crypto');
                    const body = JSON.stringify(eventData);
                    const signature = createHmac('sha256', webhook.secret)
                        .update(body)
                        .digest('hex');
                    headers['X-ObraSaaS-Signature'] = `sha256=${signature}`;
                } catch (e) {
                    // Crypto not available, skip signature
                }
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(webhook.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(eventData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`Webhook ${webhook.id} responded with ${response.status}`);
            } else {
                console.log(`✅ Webhook delivered: ${eventType} → ${webhook.url}`);
            }
        } catch (err) {
            console.warn(`❌ Webhook ${webhook.id} failed: ${err.message}`);
        }
    }
}
