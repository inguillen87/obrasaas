import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from "@/lib/access";
import { SOURCE_EVIDENCE_PERMISSION } from "@/lib/medical-privacy";
import { getPrisma } from "@/lib/prisma";
import { projectWritePolicyErrorResponse } from "@/lib/project-write-policy";
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from "@/lib/request-body";
import {
  progressJournalErrorResponse,
  reviewProgressRecord,
} from "@/lib/progress-journal";

function known(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  return progressJournalErrorResponse(error) || projectWritePolicyErrorResponse(error);
}
export async function PATCH(request, { params }) {
  try {
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
      return Response.json({ error: 'Origen de solicitud no autorizado.', code: 'PROGRESS_ORIGIN_FORBIDDEN' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const access = await getPlatformAccess();
    requireTenantPermission(access, "org:execution:manage", {
      subscriptionMode: "write",
    });
    const input = await readJsonRequest(request, { maxBytes: 16 * 1024 });
    if (['APPROVED', 'REJECTED'].includes(String(input.status ?? '').toUpperCase())) {
      requireTenantPermission(access, 'org:progress:review', { subscriptionMode: 'write' });
      if (String(input.kind ?? '').toUpperCase() === 'EVIDENCE') {
        requireTenantPermission(access, SOURCE_EVIDENCE_PERMISSION, { subscriptionMode: 'read' });
      }
    }
    const { recordId } = await params;
    return Response.json(
      await reviewProgressRecord(getPrisma(), {
        scope: {
          organizationId: access.organization.id,
          projectId: access.project.id,
        },
        actorId: access.databaseUserId,
        id: recordId,
        kind: input.kind,
        status: input.status,
        expected: input.expectedRevision,
        reviewNote: input.reviewNote,
        includeSourceEvidence: hasTenantPermission(
          access,
          SOURCE_EVIDENCE_PERMISSION,
        ),
      }),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return (
      known(error) ||
      Response.json(
        {
          error: "No se pudo revisar el registro.",
          code: "PROGRESS_REVIEW_FAILED",
        },
        { status: 500 },
      )
    );
  }
}
