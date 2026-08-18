import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/tasks — Public API for Gantt tasks with progress
export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
        const state = await getAppState();
        const tasks = Object.entries(state.tasks || {}).map(([key, t]) => ({
            id: key,
            name: t.name,
            progress: t.progress,
            startDate: t.startDate,
            endDate: t.endDate,
            assignedTo: t.assignedTo,
            quincena: t.quincena,
            dependencies: t.dependencies || [],
            status: t.progress === 100 ? 'completed' : t.progress > 0 ? 'in_progress' : 'pending'
        }));

        const overallProgress = parseFloat(state.avancePercentage) || 0;

        return Response.json({
            tasks,
            total: tasks.length,
            overallProgress,
            currentQuincena: state.currentQuincena,
            _links: {
                self: '/api/v1/tasks',
                workers: '/api/v1/workers',
                incidents: '/api/v1/incidents'
            }
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
