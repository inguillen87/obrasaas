import { getAppState, saveAppState } from '@/lib/db';
import { verifyApiAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/libro-obra — Get all daily log entries
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const projectId = searchParams.get('projectId');

    try {
        const state = await getAppState();
        let entries = state.libroObra || [];

        // Filter by date if provided
        if (date) {
            entries = entries.filter(e => e.date === date);
        }
        // Filter by project
        if (projectId) {
            entries = entries.filter(e => e.projectId === projectId);
        }

        return Response.json({
            entries: entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
            total: entries.length
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/admin/libro-obra — Create a new daily log entry
export async function POST(request) {
    try {
        const body = await request.json();
        const { date, weather, temperature, workers, tasks, observations, incidents, materials, signedBy } = body;

        if (!date || !signedBy) {
            return Response.json({ error: 'date and signedBy are required' }, { status: 400 });
        }

        const state = await getAppState();
        state.libroObra = state.libroObra || [];

        // Check if entry for this date already exists
        const existingIndex = state.libroObra.findIndex(e => e.date === date);

        const entry = {
            id: existingIndex >= 0 ? state.libroObra[existingIndex].id : `lo-${Date.now().toString(36)}`,
            date,
            weather: weather || 'Despejado',
            temperature: temperature || null,
            workersPresent: workers || 0,
            tasksPerformed: tasks || [],
            observations: observations || '',
            incidents: incidents || [],
            materialsReceived: materials || [],
            signedBy: signedBy,
            signedAt: new Date().toISOString(),
            projectId: state.projectConfig?.id || 'obra-default',
            projectName: state.projectConfig?.name || 'Obra',
            // SHA-256 hash for legal immutability
            hash: null,
            createdAt: existingIndex >= 0 ? state.libroObra[existingIndex].createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Generate SHA-256 hash for legal certification
        const hashContent = JSON.stringify({
            date: entry.date,
            tasks: entry.tasksPerformed,
            observations: entry.observations,
            signedBy: entry.signedBy,
            signedAt: entry.signedAt
        });

        try {
            const { createHash } = await import('crypto');
            entry.hash = createHash('sha256').update(hashContent).digest('hex');
        } catch (e) {
            entry.hash = 'hash-unavailable';
        }

        if (existingIndex >= 0) {
            state.libroObra[existingIndex] = entry;
        } else {
            state.libroObra.push(entry);
        }

        // Also record in audit ledger
        state.auditLedger = state.auditLedger || [];
        state.auditLedger.push({
            type: 'LIBRO_OBRA',
            date: entry.date,
            signedBy: entry.signedBy,
            hash: entry.hash,
            timestamp: new Date().toISOString()
        });

        await saveAppState(state);

        return Response.json({ entry }, { status: existingIndex >= 0 ? 200 : 201 });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
