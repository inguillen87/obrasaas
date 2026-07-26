import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { SOURCE_EVIDENCE_PERMISSION } from '@/lib/medical-privacy';
import {
  isDashboardProgressMediaForProject,
  progressEvidenceFileResponse,
} from '@/lib/private-receipts';
import { getPrisma } from '@/lib/prisma';
import { readProtectedFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

function notFound() {
  return Response.json(
    { error: 'La evidencia no está disponible.', code: 'PROGRESS_ATTACHMENT_NOT_FOUND' },
    { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function GET(_request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    requireTenantPermission(access, SOURCE_EVIDENCE_PERMISSION, { subscriptionMode: 'read' });
    const { recordId } = await params;
    const evidence = await getPrisma().progressEvidence.findFirst({
      where: {
        id: String(recordId || ''),
        projectId: access.project.id,
        sourceMessageId: null,
      },
      select: { id: true, projectId: true, media: true },
    });
    if (!evidence || !isDashboardProgressMediaForProject(evidence.media, access.project.id)) {
      return notFound();
    }
    const downloaded = await readProtectedFile(evidence.media.storage);
    if (!downloaded?.stream) return notFound();
    return progressEvidenceFileResponse(evidence.media, downloaded);
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error('Progress attachment delivery failed:', {
      name: error?.name,
      code: error?.code,
      status: error?.status,
    });
    return Response.json(
      { error: 'No se pudo cargar la evidencia.', code: 'PROGRESS_ATTACHMENT_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
