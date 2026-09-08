import { getAppState, saveAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Infer task group from name for Gantt grouping
function inferGroup(name) {
    const lower = (name || '').toLowerCase();
    if (lower.includes('excavac') || lower.includes('fundac') || lower.includes('hormigon') || lower.includes('columna') || lower.includes('viga') || lower.includes('losa') || lower.includes('estructura')) return 'Estructura';
    if (lower.includes('mampost') || lower.includes('carpint') || lower.includes('revoque grueso') || lower.includes('contrapiso') || lower.includes('cerramiento')) return 'Cerramientos';
    if (lower.includes('cañer') || lower.includes('descarga') || lower.includes('sanitar') || lower.includes('instalac')) return 'Instalaciones';
    if (lower.includes('revoque fino') || lower.includes('cerám') || lower.includes('porcelan') || lower.includes('pintura') || lower.includes('terminac') || lower.includes('revestim')) return 'Terminaciones';
    return 'General';
}

// Calculate week number since project start
function weekFromDate(dateStr, projectStart) {
    if (!dateStr) return 1;
    const d = new Date(dateStr);
    const start = new Date(projectStart || '2026-08-01');
    const diffMs = d - start;
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, diffWeeks + 1);
}

// Calculate duration in weeks
function durationWeeks(startDate, endDate) {
    if (!startDate || !endDate) return 1;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diffMs = e - s;
    const weeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, weeks);
}

// GET /api/v1/tasks — Full Gantt data with groups, materials, and supplier status
export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
        const state = await getAppState();
        const projectStart = '2026-08-01';
        
        const tasks = Object.entries(state.tasks || {}).map(([key, t]) => {
            // Generate initials from assignee name
            const initials = (t.assignee || t.assignedTo || 'NN')
                .split(' ')
                .map(w => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

            return {
                id: `t${key}`,
                name: t.name,
                progress: t.progress || 0,
                startDate: t.startDate,
                endDate: t.endDate,
                startWeek: weekFromDate(t.startDate, projectStart),
                duration: durationWeeks(t.startDate, t.endDate),
                assignee: initials,
                assigneeFull: t.assignee || t.assignedTo || 'Sin asignar',
                quincena: t.quincena,
                group: inferGroup(t.name),
                dependencies: t.dependencies || [],
                status: t.progress === 100 ? 'completed' : t.isBlocked ? 'at-risk' : t.progress > 0 ? 'on-track' : 'on-track',
                // Material & supplier data
                requiredMaterials: t.requiredMaterials || [],
                materialStatus: t.materialStatus || 'N/A',
                isBlocked: t.isBlocked || false,
                supplierName: t.supplierName || null,
                supplierStatus: t.supplierStatus || null
            };
        });

        const overallProgress = parseFloat(state.avancePercentage) || 0;
        const completedCount = tasks.filter(t => t.status === 'completed').length;
        const blockedCount = tasks.filter(t => t.isBlocked).length;

        return Response.json({
            tasks,
            total: tasks.length,
            completed: completedCount,
            blocked: blockedCount,
            overallProgress,
            currentQuincena: state.currentQuincena,
            projectStart,
            projectName: state.projectConfig?.name || 'Obra',
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

// POST /api/v1/tasks — Create a new task
export async function POST(request) {
    try {
        const body = await request.json();
        const { name, startDate, endDate, assignee, quincena, requiredMaterials } = body;

        if (!name) {
            return Response.json({ error: 'name is required' }, { status: 400 });
        }

        const state = await getAppState();
        state.tasks = state.tasks || {};

        const nextId = Math.max(0, ...Object.keys(state.tasks).map(Number)) + 1;

        state.tasks[nextId] = {
            name,
            progress: 0,
            duration: durationWeeks(startDate, endDate),
            startOffset: 0,
            assignee: assignee || 'Sin asignar',
            quincena: quincena || 'Q1',
            startDate: startDate || new Date().toISOString().split('T')[0],
            endDate: endDate || new Date().toISOString().split('T')[0],
            requiredMaterials: requiredMaterials || [],
            materialStatus: 'Disponible',
            isBlocked: false,
            supplierStatus: 'Pendiente',
            supplierName: null
        };

        await saveAppState(state);

        return Response.json({ 
            task: { id: `t${nextId}`, ...state.tasks[nextId] },
            message: `Tarea "${name}" creada exitosamente`
        }, { status: 201 });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

// PATCH /api/v1/tasks — Update task progress or status
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { taskId, progress, status, isBlocked, materialStatus, assignee } = body;

        if (!taskId) {
            return Response.json({ error: 'taskId is required' }, { status: 400 });
        }

        const state = await getAppState();
        const numericId = taskId.toString().replace('t', '');
        
        if (!state.tasks[numericId]) {
            return Response.json({ error: `Task ${taskId} not found` }, { status: 404 });
        }

        const task = state.tasks[numericId];
        
        if (progress !== undefined) task.progress = Math.min(100, Math.max(0, progress));
        if (isBlocked !== undefined) task.isBlocked = isBlocked;
        if (materialStatus !== undefined) task.materialStatus = materialStatus;
        if (assignee !== undefined) task.assignee = assignee;

        // Recalculate overall progress
        const allTasks = Object.values(state.tasks);
        const avg = allTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / allTasks.length;
        state.avancePercentage = Math.round(avg);

        await saveAppState(state);

        return Response.json({
            task: { id: taskId, ...task },
            overallProgress: state.avancePercentage,
            message: `Tarea "${task.name}" actualizada`
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
