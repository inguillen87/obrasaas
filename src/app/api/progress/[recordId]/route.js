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
    const access = await getPlatformAccess();
    requireTenantPermission(access, "org:execution:manage", {
      subscriptionMode: "write",
    });
    const input = await readJsonRequest(request, { maxBytes: 16 * 1024 });
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
