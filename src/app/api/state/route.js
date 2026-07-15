import { getAppState, saveAppState, resetState } from '@/lib/db';
import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';

function flagStockRisks(state) {
    if (!state.stockpiles) return;
    state.incidents ||= [];

    for (const [key, material] of Object.entries(state.stockpiles)) {
        if (!material || Number(material.current) >= Number(material.min)) continue;
        const incidentId = `stock-risk-${key}`;
        if (state.incidents.some((incident) => incident.id === incidentId)) continue;

        material.status = 'Requiere aprobación';
        state.alertsCount = Number(state.alertsCount || 0) + 1;
        state.incidents.unshift({
            id: incidentId,
            title: `Stock bajo: ${material.name}`,
            description: `${material.current} ${material.unit} disponibles frente a un mínimo de ${material.min}. La compra quedó pendiente de aprobación de un responsable autorizado.`,
            type: 'warning',
            badge: 'Revisar compra',
            timestamp: new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
            reporter: 'Control de abastecimiento',
            icon: 'fa-solid fa-cart-shopping',
        });
    }
}

export async function GET() {
    try {
        const access = await getPlatformAccess();
        requireTenantPermission(access, 'org:projects:read');
        const state = await getAppState(access);
        return Response.json(state);
    } catch (error) {
        if (error instanceof AccessError) return accessErrorResponse(error);
        console.error("Error fetching state:", error);
        return Response.json({ error: "Failed to fetch state" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const access = await getPlatformAccess();
        requireTenantPermission(access, 'org:projects:manage');
        const body = await request.json();
        if (!body) {
            return Response.json({ error: "Invalid state body" }, { status: 400 });
        }
        
        flagStockRisks(body);
        
        const updated = await saveAppState(body, access);
        return Response.json(updated);
    } catch (error) {
        if (error instanceof AccessError) return accessErrorResponse(error);
        console.error("Error saving state:", error);
        return Response.json({ error: "Failed to save state" }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const access = await getPlatformAccess();
        requireTenantPermission(access, 'org:projects:manage');
        const fresh = await resetState(access);
        return Response.json(fresh.appState);
    } catch (error) {
        if (error instanceof AccessError) return accessErrorResponse(error);
        console.error("Error resetting state:", error);
        return Response.json({ error: "Failed to reset state" }, { status: 500 });
    }
}
