import { getAppState, saveAppState, resetState } from '@/lib/db';
import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import {
    deriveProjectStateActivities,
    flagStockRisks,
    ProjectStateInputError,
    validateProjectStateInput,
} from '@/lib/project-state';

const MAX_STATE_BODY_BYTES = 1_000_000;

export async function GET() {
    try {
        const access = await getPlatformAccess();
        requireTenantPermission(access, 'org:projects:read');
        const state = await getAppState(access);
        return Response.json(state);
    } catch (error) {
        if (error instanceof AccessError) return accessErrorResponse(error);
        console.error("Error fetching state:", error);
        return Response.json({ error: "Failed to fetch state" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const access = await getPlatformAccess();
        requireTenantPermission(access, 'org:projects:manage');
        const rawBody = await request.text();
        if (Buffer.byteLength(rawBody, 'utf8') > MAX_STATE_BODY_BYTES) {
            throw new ProjectStateInputError('El estado supera el máximo de 1 MB.', {
                code: 'PROJECT_STATE_TOO_LARGE',
                status: 413,
            });
        }
        let parsed;
        try {
            parsed = JSON.parse(rawBody);
        } catch {
            throw new ProjectStateInputError('El cuerpo debe ser JSON válido.');
        }

        flagStockRisks(parsed);
        const body = validateProjectStateInput(parsed);
        const previous = await getAppState(access);
        const activities = deriveProjectStateActivities(previous, body);
        const updated = await saveAppState(body, access, { activities });
        return Response.json(updated);
    } catch (error) {
        if (error instanceof AccessError) return accessErrorResponse(error);
        if (error instanceof ProjectStateInputError) {
            return Response.json(
                { error: error.message, code: error.code },
                { status: error.status },
            );
        }
        console.error("Error saving state:", error);
        return Response.json({ error: "Failed to save state" }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const access = await getPlatformAccess();
        requireTenantPermission(access, 'org:projects:manage');
        const fresh = await resetState(access);
        return Response.json(fresh.appState);
    } catch (error) {
        if (error instanceof AccessError) return accessErrorResponse(error);
        console.error("Error resetting state:", error);
        return Response.json({ error: "Failed to reset state" }, { status: 500 });
    }
}
