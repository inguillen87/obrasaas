import { getAppState, saveAppState } from '@/lib/db';

export async function GET() {
    try {
        const state = await getAppState();
        return Response.json(state.subscription || { status: "active", plan: "Pro", expiresAt: "2027-12-31" });
    } catch (error) {
        return Response.json({ error: "Failed to fetch subscription" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { plan, action } = body;

        const state = await getAppState();

        if (action === 'cancel') {
            state.subscription = {
                status: "cancelled",
                plan: "Free",
                expiresAt: new Date().toLocaleDateString('es-AR')
            };
            await saveAppState(state);
            return Response.json({ success: true, subscription: state.subscription });
        }

        if (!plan || !['Free', 'Pro', 'Enterprise'].includes(plan)) {
            return Response.json({ error: "Invalid plan" }, { status: 400 });
        }

        // Simular compra / upgrade
        state.subscription = {
            status: "active",
            plan: plan,
            expiresAt: "2027-12-31"
        };

        // Si es Free, limitamos operarios de demo
        if (plan === 'Free') {
            state.operariosCount = 1;
            // Quitamos operarios extra
            state.attendance = {
                "Juan Gómez": { role: "Albañilería Principal", checkin: "08:02 AM", status: "Presente" },
                "Carlos Pérez": { role: "Pintura e Interiores", checkin: "--:--", status: "Ausente" },
                "Luis Martínez": { role: "Instalaciones y Sanitarios", checkin: "--:--", status: "Ausente" }
            };
        }

        await saveAppState(state);
        return Response.json({ success: true, subscription: state.subscription });
    } catch (error) {
        console.error("Billing endpoint error:", error);
        return Response.json({ error: "Failed to update billing" }, { status: 500 });
    }
}
