import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/portal — Public read-only endpoint for investors/buyers
// No auth required — uses projectId or token as query param
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const projectId = searchParams.get('projectId');

    // In production, validate token or check that project has portal enabled
    // For now, return public-safe subset of state
    try {
        const state = await getAppState();
        const project = state.projectConfig || {};
        const tasks = Object.values(state.tasks || {});
        
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.progress === 100).length;
        const avanceGlobal = parseFloat(state.avancePercentage) || 0;

        // Build timeline from completed milestones
        const milestones = tasks
            .filter(t => t.progress === 100)
            .map(t => ({
                name: t.name,
                completedDate: t.endDate || 'Fecha no registrada',
                assignedTo: t.assignedTo
            }));

        // Active work
        const activeWork = tasks
            .filter(t => t.progress > 0 && t.progress < 100)
            .map(t => ({
                name: t.name,
                progress: t.progress,
                assignedTo: t.assignedTo
            }));

        // Recent incidents (safe subset)
        const recentIncidents = (state.incidents || [])
            .slice(-3)
            .map(i => ({
                title: i.title,
                type: i.type === 'danger' ? 'Crítico' : i.type === 'warning' ? 'Alerta' : 'Info',
                timestamp: i.timestamp
            }));

        return Response.json({
            project: {
                name: project.name,
                city: project.city,
                province: project.province,
                address: project.address,
                director: project.director?.name
            },
            progress: {
                overall: avanceGlobal,
                tasksTotal: totalTasks,
                tasksCompleted: completedTasks,
                currentQuincena: state.currentQuincena
            },
            milestones,
            activeWork,
            recentIncidents,
            workersOnSite: Object.keys(state.attendance || {}).length,
            lastUpdate: state.lastUpdate || new Date().toISOString(),
            _portal: true
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
