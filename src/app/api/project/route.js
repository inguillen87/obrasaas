import { getAppState, saveAppState } from '../../../lib/db.js';
import { verifyApiAuth } from '@/lib/auth';

export async function GET(request) {
    try {
        const state = await getAppState();
        return Response.json({
            success: true,
            activeProjectId: state.activeProjectId || "obra-palermo-01",
            activeProject: state.projectConfig,
            projects: state.projects || []
        });
    } catch (error) {
        console.error("Get project error:", error);
        return Response.json({ error: "Failed to get project state" }, { status: 500 });
    }
}

export async function POST(request) {
    // Enterprise Security: Require API auth for project changes
    const { authorized, reason } = verifyApiAuth(request);
    if (!authorized) {
        return Response.json({ error: 'Unauthorized', reason }, { status: 403 });
    }
    try {
        const { projectId } = await request.json();
        const state = await getAppState();

        const foundProject = (state.projects || []).find(p => p.id === projectId);
        if (!foundProject) {
            return Response.json({ error: `Project ID '${projectId}' not found` }, { status: 404 });
        }

        state.activeProjectId = foundProject.id;
        state.projectConfig = { ...foundProject };

        await saveAppState(state);

        return Response.json({
            success: true,
            activeProjectId: state.activeProjectId,
            activeProject: state.projectConfig,
            message: `Obra activa cambiada a: ${foundProject.name} (${foundProject.city})`
        });
    } catch (error) {
        console.error("Change project error:", error);
        return Response.json({ error: "Failed to change active project" }, { status: 500 });
    }
}
