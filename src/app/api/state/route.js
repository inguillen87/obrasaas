import { getAppStateSnapshot, resetState, saveAppStateSnapshot } from '@/lib/db';
import { AccessError, accessErrorResponse, getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import {
    assertAttendanceProjectionUnchanged,
    assertProjectStateVersion,
    formatProjectStateEtag,
    deriveProjectStateActivities,
    flagStockRisks,
    ProjectStateInputError,
    ProjectStateVersionConflictError,
    parseProjectStateVersion,
    parseProjectStateWriteRequest,
    validateProjectStateInput,
} from '@/lib/project-state';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import {
    sanitizeProjectStateMedicalData,
    SOURCE_EVIDENCE_PERMISSION,
} from '@/lib/medical-privacy';
import {
    readJsonRequest,
    RequestBodyError,
    requestBodyErrorResponse,
} from '@/lib/request-body';

const MAX_STATE_BODY_BYTES = 1_000_000;

function projectStateHeaders(version) {
    return {
        'Cache-Control': 'private, no-store',
        ETag: formatProjectStateEtag(version),
        'X-Project-State-Version': String(version),
    };
}

function projectStateResponse(snapshot, access, { status = 200 } = {}) {
    return Response.json(sanitizeProjectStateMedicalData(snapshot.state, {
        includeAttendanceLocation: hasTenantPermission(access, SOURCE_EVIDENCE_PERMISSION),
    }), {
        status,
        headers: projectStateHeaders(snapshot.version),
    });
}

function projectStateErrorResponse(error) {
    const policyError = projectWritePolicyErrorResponse(error);
    if (policyError) return policyError;
    if (error instanceof ProjectStateVersionConflictError) {
        return Response.json(
            {
                error: error.message,
                code: error.code,
                expectedVersion: error.expectedVersion,
                currentVersion: error.currentVersion,
            },
            {
                status: error.status,
                headers: projectStateHeaders(error.currentVersion),
            },
        );
    }
    if (error instanceof ProjectStateInputError) {
        return Response.json(
            { error: error.message, code: error.code },
            { status: error.status },
        );
    }
    return null;
}

export async function GET() {
    try {
        const access = await getPlatformAccess();
        requireTenantPermission(access, 'org:projects:read');
        const snapshot = await getAppStateSnapshot(access);
        return projectStateResponse(snapshot, access);
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
        const parsed = await readJsonRequest(request, { maxBytes: MAX_STATE_BODY_BYTES });

        const writeRequest = parseProjectStateWriteRequest(
            parsed,
            request.headers.get('if-match'),
        );
        const currentSnapshot = await getAppStateSnapshot(access);
        assertProjectStateVersion(writeRequest.expectedVersion, currentSnapshot.version);
        const validationContext = { previousState: currentSnapshot.state };
        const body = validateProjectStateInput(writeRequest.state, validationContext);
        flagStockRisks(body);
        const includeAttendanceLocation = hasTenantPermission(
            access,
            SOURCE_EVIDENCE_PERMISSION,
        );
        const validatedBody = validateProjectStateInput(
            sanitizeProjectStateMedicalData(body, {
                inferLegacyMedicalText: false,
                includeAttendanceLocation,
            }),
            validationContext,
        );
        const publicCurrentState = sanitizeProjectStateMedicalData(currentSnapshot.state, {
            includeAttendanceLocation,
        });
        assertAttendanceProjectionUnchanged(publicCurrentState, validatedBody);
        const updated = await saveAppStateSnapshot(validatedBody, access, {
            expectedVersion: writeRequest.expectedVersion,
            deriveActivities: deriveProjectStateActivities,
            preserveAttendanceProjection: true,
        });
        return projectStateResponse(updated, access);
    } catch (error) {
        if (error instanceof AccessError) return accessErrorResponse(error);
        if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
        const stateError = projectStateErrorResponse(error);
        if (stateError) return stateError;
        console.error("Error saving state:", error);
        return Response.json({ error: "Failed to save state" }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const access = await getPlatformAccess();
        requireTenantPermission(access, 'org:projects:manage');
        const expectedVersion = parseProjectStateVersion(request.headers.get('if-match'));
        const fresh = await resetState(access, { expectedVersion });
        return projectStateResponse(fresh.snapshot, access);
    } catch (error) {
        if (error instanceof AccessError) return accessErrorResponse(error);
        const stateError = projectStateErrorResponse(error);
        if (stateError) return stateError;
        console.error("Error resetting state:", error);
        return Response.json({ error: "Failed to reset state" }, { status: 500 });
    }
}
