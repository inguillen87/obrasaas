import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/projects — Public API for projects
export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
        const state = await getAppState();
        const projects = (state.projects || []).map(p => ({
            id: p.id,
            name: p.name,
            city: p.city,
            province: p.province,
            address: p.address,
            coordinates: { lat: p.latitude, lon: p.longitude },
            geofenceRadius: p.geofenceRadiusMeters,
            climateZone: p.climateZone,
            director: p.director?.name,
            capataz: p.capataz?.name
        }));

        return Response.json({
            projects,
            total: projects.length,
            activeProject: state.projectConfig?.id,
            _links: {
                self: '/api/v1/projects',
                workers: '/api/v1/workers',
                tasks: '/api/v1/tasks'
            }
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
