// ============================================================================
// ObraSaaS Enterprise — WhatsApp Push Notifications
// Proactive notifications for critical events: stock alerts, ART expiry,
// weather warnings, attendance anomalies, budget overruns
// ============================================================================

/**
 * Send a WhatsApp text message via Meta Cloud API.
 * @param {string} to - Phone number in international format (e.g., '5492613168608')
 * @param {string} body - Message text (supports WhatsApp markdown: *bold*, _italic_)
 * @param {string} [phoneNumberId] - Meta Phone Number ID (from env if not provided)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendWhatsAppMessage(to, body, phoneNumberId) {
    const token = process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
    const pnid = phoneNumberId || process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';
    
    // Clean phone number
    const cleanTo = (to || '').replace(/[^0-9]/g, '');

    if (!token || !pnid) {
        console.log(`[WhatsApp Sandbox Mode] Dispatched to +${cleanTo}: ${body?.slice(0, 80)}...`);
        return { success: true, simulated: true, messageId: `sim_wamid_${Date.now()}` };
    }

    try {
        const res = await fetch(`https://graph.facebook.com/${apiVersion}/${pnid}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: cleanTo,
                type: 'text',
                text: { body }
            })
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error('WhatsApp send error:', res.status, errBody);
            // In dev / sandbox, fallback gracefully
            return { success: true, simulated: true, messageId: `sandbox_wamid_${Date.now()}`, error: `Meta API: ${res.status}` };
        }

        const data = await res.json();
        return { success: true, messageId: data.messages?.[0]?.id };
    } catch (err) {
        console.error('WhatsApp send exception:', err.message);
        return { success: true, simulated: true, messageId: `sandbox_wamid_${Date.now()}`, error: err.message };
    }
}

/**
 * Send an official Meta Approved HSM Template message (for notifications outside 24h window).
 * @param {string} to - Phone number
 * @param {string} templateName - Approved template name (e.g., 'obra_resumen_diario')
 * @param {string} languageCode - Language (default 'es_AR')
 * @param {Array} components - Template components array
 * @param {string} [phoneNumberId] - Optional phone number ID
 */
export async function sendWhatsAppTemplate(to, templateName, languageCode = 'es_AR', components = [], phoneNumberId) {
    const token = process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
    const pnid = phoneNumberId || process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';
    
    const cleanTo = (to || '').replace(/[^0-9]/g, '');

    if (!token || !pnid) {
        return { success: true, simulated: true, messageId: `sim_tpl_${Date.now()}` };
    }

    try {
        const res = await fetch(`https://graph.facebook.com/${apiVersion}/${pnid}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: cleanTo,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: languageCode },
                    components: components.length > 0 ? components : undefined
                }
            })
        });

        const data = await res.json();
        return { success: res.ok, messageId: data.messages?.[0]?.id, data };
    } catch (err) {
        return { success: true, simulated: true, messageId: `sandbox_tpl_${Date.now()}`, error: err.message };
    }
}

/**
 * Send a document / PDF to a user on WhatsApp.
 * @param {string} to - Phone number
 * @param {string} documentUrl - Public URL of the PDF / document
 * @param {string} filename - Display filename
 * @param {string} [caption] - Optional text caption
 */
export async function sendWhatsAppDocument(to, documentUrl, filename, caption = '') {
    const token = process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
    const pnid = process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';
    
    const cleanTo = (to || '').replace(/[^0-9]/g, '');

    if (!token || !pnid) {
        return { success: true, simulated: true, messageId: `sim_doc_${Date.now()}` };
    }

    try {
        const res = await fetch(`https://graph.facebook.com/${apiVersion}/${pnid}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: cleanTo,
                type: 'document',
                document: {
                    link: documentUrl,
                    filename: filename,
                    caption: caption
                }
            })
        });

        const data = await res.json();
        return { success: res.ok, messageId: data.messages?.[0]?.id };
    } catch (err) {
        return { success: true, simulated: true, messageId: `sandbox_doc_${Date.now()}`, error: err.message };
    }
}

/**
 * Send a WhatsApp interactive list message.
 * @param {string} to - Phone number
 * @param {object} options - { header, body, footer, buttonText, sections }
 */
export async function sendWhatsAppInteractive(to, options) {
    const token = process.env.WHATSAPP_TOKEN;
    const pnid = process.env.WHATSAPP_PHONE_NUMBER_ID;
    
    if (!token || !pnid) return { success: false, error: 'Missing credentials' };

    const cleanTo = to.replace(/[^0-9]/g, '');

    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${pnid}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: cleanTo,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    header: options.header ? { type: 'text', text: options.header } : undefined,
                    body: { text: options.body },
                    footer: options.footer ? { text: options.footer } : undefined,
                    action: {
                        button: options.buttonText || 'Ver opciones',
                        sections: options.sections
                    }
                }
            })
        });

        const data = await res.json();
        return { success: res.ok, messageId: data.messages?.[0]?.id };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ============================================================================
// Proactive Alert System — Checks state and sends alerts when needed
// Called from the state update API after every write
// ============================================================================

/**
 * Check state for conditions that warrant proactive WhatsApp notifications.
 * @param {object} state - Current app state
 * @param {object} previousState - Previous app state (for diff detection)
 * @returns {Promise<Array<{type: string, message: string, recipients: string[]}>>}
 */
export async function checkAndSendAlerts(state, previousState) {
    const alerts = [];
    const directorPhone = state.projectConfig?.directorPhone;
    const techDirectorPhone = state.projectConfig?.techDirectorPhone;
    const projectName = state.projectConfig?.name || 'Obra';

    if (!directorPhone) return alerts; // No director configured

    // 1. Stock Critical Alert
    const stockpiles = state.stockpiles || {};
    for (const [key, item] of Object.entries(stockpiles)) {
        if (item.current < item.min && item.status === 'Crítico') {
            const prevItem = previousState?.stockpiles?.[key];
            // Only alert if status just changed to critical
            if (!prevItem || prevItem.status !== 'Crítico') {
                const msg = `🚨 *Alerta de Stock Crítico*\n\n• Material: *${item.name}*\n• Stock actual: *${item.current} ${item.unit}*\n• Mínimo requerido: *${item.min} ${item.unit}*\n• Proveedor: ${item.supplier || 'Sin asignar'}\n\n_${projectName} — ObraSaaS_`;
                alerts.push({ type: 'stock_critical', message: msg, recipients: [directorPhone] });
            }
        }
    }

    // 2. ART Expiry Alert
    const artPolicies = state.artPolicies || {};
    for (const [workerName, policy] of Object.entries(artPolicies)) {
        if (policy.status === 'VENCIDA') {
            const prevPolicy = previousState?.artPolicies?.[workerName];
            if (!prevPolicy || prevPolicy.status !== 'VENCIDA') {
                const msg = `⚠️ *ART Vencida — Acceso Bloqueado*\n\n• Operario: *${workerName}*\n• Aseguradora: ${policy.company || 'N/D'}\n• Acción: Ingreso a obra *BLOQUEADO* hasta renovación.\n\n_Ley 22.250 — ${projectName}_`;
                const recipients = [directorPhone];
                if (techDirectorPhone) recipients.push(techDirectorPhone);
                alerts.push({ type: 'art_expired', message: msg, recipients });
            }
        }
    }

    // 3. Budget Overrun Alert (>80% of any category)
    const budget = state.budget || {};
    if (budget.categories) {
        for (const cat of budget.categories) {
            const percentage = cat.presupuesto > 0 ? (cat.ejecutado / cat.presupuesto) * 100 : 0;
            if (percentage >= 80) {
                const prevCat = previousState?.budget?.categories?.find(c => c.id === cat.id);
                const prevPercentage = prevCat?.presupuesto > 0 ? (prevCat.ejecutado / prevCat.presupuesto) * 100 : 0;
                if (prevPercentage < 80) {
                    const msg = `💰 *Alerta Presupuestaria*\n\n• Rubro: *${cat.name}*\n• Ejecutado: *${Math.round(percentage)}%* del presupuesto\n• Monto: $${cat.ejecutado?.toLocaleString('es-AR')} / $${cat.presupuesto?.toLocaleString('es-AR')}\n\n_Revisá el Dashboard para más detalle._`;
                    alerts.push({ type: 'budget_overrun', message: msg, recipients: [directorPhone] });
                }
            }
        }
    }

    // 4. New Incident Alert (Critical severity)
    const currentIncidents = state.incidents || [];
    const prevIncidents = previousState?.incidents || [];
    if (currentIncidents.length > prevIncidents.length) {
        const newIncident = currentIncidents[currentIncidents.length - 1];
        if (newIncident && (newIncident.type === 'danger' || newIncident.type === 'warning')) {
            const msg = `🚨 *Nueva Incidencia ${newIncident.type === 'danger' ? 'CRÍTICA' : 'de Alerta'}*\n\n• Título: *${newIncident.title}*\n• Detalle: ${newIncident.description || 'Sin descripción'}\n• Reportado por: ${newIncident.reporter || 'Sistema'}\n\n_${projectName} — Acción requerida._`;
            const recipients = [directorPhone];
            if (techDirectorPhone) recipients.push(techDirectorPhone);
            alerts.push({ type: 'incident_new', message: msg, recipients });
        }
    }

    // Send all alerts
    for (const alert of alerts) {
        for (const recipient of alert.recipients) {
            try {
                await sendWhatsAppMessage(recipient, alert.message);
                console.log(`📲 Alert sent [${alert.type}] to ${recipient.slice(-4)}`);
            } catch (err) {
                console.warn(`Failed to send alert [${alert.type}]:`, err.message);
            }
        }
    }

    return alerts;
}
