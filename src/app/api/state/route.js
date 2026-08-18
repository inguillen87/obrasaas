import { getAppState, saveAppState, resetState, getMessages, saveMessages } from '@/lib/db';
import { verifyApiAuth } from '@/lib/auth';

async function checkStockAndTriggerPurchases(state) {
    if (!state.stockpiles) return;

    const cement = state.stockpiles.cemento;
    const iron = state.stockpiles.hierro;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    // Check Cemento minimum safety levels
    if (cement && cement.current < cement.min && cement.status === 'Crítico') {
        cement.status = 'Orden de Compra Enviada';
        state.alertsCount = Math.max(0, state.alertsCount - 1); // Resolve critical stock alert
        
        // 1. Log incident
        state.incidents.unshift({
            id: "inc-po-cement-" + Date.now(),
            title: "Compra Automatizada Loma Negra",
            description: `Stock por debajo del mínimo de seguridad (${cement.current} bolsas). Generada orden de compra automática #OC-2026-901 por 100 bolsas.`,
            type: "success",
            badge: "Compra IA",
            timestamp: `Hoy, ${timeStr}`,
            reporter: "Inspector Logístico IA",
            icon: "fa-solid fa-cart-shopping"
        });

        // 2. Mock supplier response in chat messages
        try {
            const messages = await getMessages();
            messages.push({
                sender: "bot",
                text: `🤖 [Inspector Logístico] Alerta de quiebre de stock detectada (Cemento: ${cement.current} bolsas). Enviada orden de compra #OC-2026-901 a Loma Negra S.A. por 100 bolsas.`,
                time: timeStr
            });
            messages.push({
                sender: "bot",
                text: `📞 Loma Negra S.A.: Hemos recibido su orden de compra automática #OC-2026-901. Despacho programado para mañana a las 08:30 AM en ${state.projectConfig?.name || 'obra'}.`,
                time: timeStr
            });
            await saveMessages(messages);
        } catch(e) {
            console.error("Error appending supplier messages:", e);
        }
    }

    // Check Hierro minimum safety levels
    if (iron && iron.current < iron.min && iron.status === 'Crítico') {
        iron.status = 'Orden de Compra Enviada';
        state.alertsCount = Math.max(0, state.alertsCount - 1);
        
        state.incidents.unshift({
            id: "inc-po-iron-" + Date.now(),
            title: "Compra Automatizada Acindar",
            description: `Stock por debajo del mínimo de seguridad (${iron.current} barras). Generada orden de compra automática #OC-2026-902 por 50 barras.`,
            type: "success",
            badge: "Compra IA",
            timestamp: `Hoy, ${timeStr}`,
            reporter: "Inspector Logístico IA",
            icon: "fa-solid fa-cart-shopping"
        });

        try {
            const messages = await getMessages();
            messages.push({
                sender: "bot",
                text: `🤖 [Inspector Logístico] Alerta de stock bajo (Hierro A500: ${iron.current} barras). Enviada orden automática #OC-2026-902 a Acindar S.A. por 50 barras.`,
                time: timeStr
            });
            messages.push({
                sender: "bot",
                text: `📞 Distribuidora Acindar: Orden #OC-2026-902 confirmada. En viaje por camión fletado, tiempo estimado de arribo: 4 horas.`,
                time: timeStr
            });
            await saveMessages(messages);
        } catch(e) {
            console.error("Error appending iron supplier messages:", e);
        }
    }
}

export async function GET() {
    try {
        const state = await getAppState();
        return Response.json(state);
    } catch (error) {
        console.error("Error fetching state:", error);
        return Response.json({ error: "Failed to fetch state" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        if (!body) {
            return Response.json({ error: "Invalid state body" }, { status: 400 });
        }
        
        // Execute automatic stock checker and purchase trigger
        await checkStockAndTriggerPurchases(body);
        
        const updated = await saveAppState(body);
        return Response.json(updated);
    } catch (error) {
        console.error("Error saving state:", error);
        return Response.json({ error: "Failed to save state" }, { status: 500 });
    }
}

export async function DELETE(request) {
    // Enterprise Security: Require API auth for destructive operations
    const { authorized, reason } = verifyApiAuth(request);
    if (!authorized) {
        return Response.json({ error: 'Unauthorized', reason }, { status: 403 });
    }
    try {
        const fresh = await resetState();
        return Response.json(fresh.appState);
    } catch (error) {
        console.error("Error resetting state:", error);
        return Response.json({ error: "Failed to reset state" }, { status: 500 });
    }
}
