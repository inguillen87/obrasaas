import { createHash } from 'node:crypto';

import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { progressBytesMatchMime } from '@/lib/private-receipts';
import { getPrisma } from '@/lib/prisma';
import { MAX_PROTECTED_UPLOAD_BYTES, protectedUploadFileSizeMessage } from '@/lib/protected-upload-policy';
import {
  deleteProtectedUpload,
  normalizeProtectedUploadIdempotencyKey,
  PROTECTED_UPLOAD_PURPOSE,
  protectedUploadErrorResponse,
  stageProtectedUpload,
} from '@/lib/protected-uploads';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf',
]);

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store',
      ...init.headers,
    },
  });
}

function errorResponse(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  const protectedError = protectedUploadErrorResponse(error);
  if (protectedError) return protectedError;
  console.error('Progress private media operation failed:', {
    name: error?.name,
    code: error?.code,
    status: error?.status,
  });
  return json({
    error: 'No se pudo procesar el archivo privado.',
    code: 'PROGRESS_UPLOAD_FAILED',
  }, { status: 500 });
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const idempotencyKey = normalizeProtectedUploadIdempotencyKey(
      request.headers.get('Idempotency-Key'),
    );
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size < 1 || file.size > MAX_PROTECTED_UPLOAD_BYTES) {
      return json({
        error: `${protectedUploadFileSizeMessage('La evidencia')} Para video MP4 usá un clip breve.`,
        code: 'PROGRESS_FILE_SIZE_INVALID',
      }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return json({
        error: 'Tipo de archivo no permitido.',
        code: 'PROGRESS_FILE_TYPE_INVALID',
      }, { status: 400 });
    }
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (!progressBytesMatchMime(fileBuffer, file.type)) {
      return json({
        error: 'El contenido del archivo no coincide con el tipo declarado.',
        code: 'PROGRESS_FILE_CONTENT_INVALID',
      }, { status: 400 });
    }
    const result = await stageProtectedUpload(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      purpose: PROTECTED_UPLOAD_PURPOSE.PROGRESS,
      idempotencyKey,
      file,
      sha256: createHash('sha256').update(fileBuffer).digest('hex'),
    });
    return json({ uploadId: result.uploadId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const uploadId = (await request.json().catch(() => null))?.uploadId;
    await deleteProtectedUpload(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      purpose: PROTECTED_UPLOAD_PURPOSE.PROGRESS,
      uploadId,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
