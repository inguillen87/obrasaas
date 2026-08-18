import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/incidents — Public API for incidents
export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
        const state = await getAppState();
        const incidents = (state.incidents || []).map(inc => ({
            id: inc.id,
            title: inc.title,
            description: inc.description,
            type: inc.type, // danger, warning, info
            severity: inc.type === 'danger' ? 'critical' : inc.type === 'warning' ? 'high' : 'low',
            badge: inc.badge,
            reporter: inc.reporter,
            timestamp: inc.timestamp,
            resolved: inc.resolved || false
        }));

        return Response.json({
            incidents,
            total: incidents.length,
            critical: incidents.filter(i => i.severity === 'critical').length,
            unresolved: incidents.filter(i => !i.resolved).length,
            _links: {
                self: '/api/v1/incidents',
                tasks: '/api/v1/tasks',
                workers: '/api/v1/workers'
            }
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
