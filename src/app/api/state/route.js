import { getAppState, saveAppState, resetState } from '@/lib/db';

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
        const updated = await saveAppState(body);
        return Response.json(updated);
    } catch (error) {
        console.error("Error saving state:", error);
        return Response.json({ error: "Failed to save state" }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const fresh = await resetState();
        return Response.json(fresh.appState);
    } catch (error) {
        console.error("Error resetting state:", error);
        return Response.json({ error: "Failed to reset state" }, { status: 500 });
    }
}
