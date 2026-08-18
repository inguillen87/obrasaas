import { getAppState, saveAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/workers — Public API for worker registry
// Headers: x-api-key required
export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
        return Response.json({ 
            error: 'Authentication required', 
            docs: 'Include x-api-key header with your API key'
        }, { status: 401 });
    }

    try {
        const state = await getAppState();
        const workers = (state.workerRegistry || []).map(w => ({
            id: w.id,
            name: w.name,
            trade: w.trade || w.role,
            phone: w.phone,
            dni: w.dni,
            status: w.status,
            assignedTasks: w.assignedTasks || [],
            registeredAt: w.registeredAt,
            registeredVia: w.registeredVia || 'manual'
        }));

        return Response.json({
            workers,
            total: workers.length,
            _links: {
                self: '/api/v1/workers',
                projects: '/api/v1/projects',
                tasks: '/api/v1/tasks'
            }
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
