import {createMetaSender,prepareMetaPayload,metaFailure} from './meta-whatsapp-transport.mjs';
const send=createMetaSender();
export async function sendWhatsAppMessage(to,body,phoneNumberId){return send(to,body,phoneNumberId);}
export async function sendWhatsAppTemplate(to,name,language='es_AR',components=[],phoneNumberId){
 return send(to,{type:'template',template:{name,language:{code:language},...(components?.length?{components}:{})}},phoneNumberId);
}
export async function sendWhatsAppDocument(to,link,filename,caption=''){
 return send(to,{type:'document',document:{link,filename,caption}});
}
export async function sendWhatsAppInteractive(to,options){
 if(!options||typeof options!=='object')return metaFailure('META_PAYLOAD_INVALID');
 const payload={type:'interactive',interactive:{type:'list',...(options.header?{header:{type:'text',text:options.header}}:{}),
  body:{text:options.body},...(options.footer?{footer:{text:options.footer}}:{}),action:{button:options.buttonText||'Ver opciones',sections:options.sections}}};
 if(!prepareMetaPayload(to,payload))return metaFailure('META_PAYLOAD_INVALID');return send(to,payload);
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
                const result = await sendWhatsAppMessage(recipient, alert.message);
                alert.delivery = result.accepted ? 'ACCEPTED_BY_META' : result.state;
                alert.delivered = false;
            } catch (err) {
                alert.delivery = 'UNCONFIRMED';
                alert.delivered = false;
            }
        }
    }

    return alerts;
}
