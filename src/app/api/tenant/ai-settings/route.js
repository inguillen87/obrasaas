import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import {
  buildTenantAiSettingsUpdate,
  publicTenantAiSettings,
  TenantAiSettingsInputError,
} from '@/lib/ai/tenant-settings';
import { getPrisma } from '@/lib/prisma';
import {
  readJsonRequest,
  RequestBodyError,
  requestBodyErrorResponse,
} from '@/lib/request-body';

const MAX_AI_SETTINGS_JSON_BYTES = 4 * 1024;

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  });
}

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:projects:read');
    return json({
      settings: publicTenantAiSettings(access.organization.metadata),
      canManage: hasTenantPermission(access, 'tenant:members:manage'),
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error('Tenant AI settings read failed:', error);
    return json({ error: 'No se pudo cargar la configuración de IA.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'tenant:members:manage');
    const input = await readJsonRequest(request, {
      maxBytes: MAX_AI_SETTINGS_JSON_BYTES,
    });
    const prisma = getPrisma();
    const nextSettings = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        `obrasaas:tenant-ai-settings:${access.organization.id}`,
      );
      const organization = await transaction.organization.findUnique({
        where: { id: access.organization.id },
        select: { id: true, metadata: true },
      });
      if (!organization) {
        throw new AccessError('La organización ya no está disponible.', {
          code: 'ORGANIZATION_NOT_FOUND',
          status: 404,
        });
      }

      const previous = publicTenantAiSettings(organization.metadata);
      const stored = buildTenantAiSettingsUpdate(input, organization.metadata, {
        actorId: access.databaseUserId,
      });
      const updated = await transaction.$executeRawUnsafe(
        `UPDATE "Organization"
         SET "metadata" = COALESCE("metadata", '{}'::jsonb)
           || jsonb_build_object('aiProcessing', CAST($1 AS jsonb)),
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2`,
        JSON.stringify(stored),
        organization.id,
      );
      if (updated !== 1) throw new Error('Organization AI settings update was not applied.');

      const next = publicTenantAiSettings({ aiProcessing: stored });
      await transaction.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: access.databaseUserId,
          action: 'tenant.ai_processing.updated',
          entityType: 'OrganizationAISettings',
          entityId: organization.id,
          metadata: {
            previous: {
              supervisorEnabled: previous.supervisorEnabled,
              audioTranscriptionEnabled: previous.audioTranscriptionEnabled,
            },
            next: {
              supervisorEnabled: next.supervisorEnabled,
              audioTranscriptionEnabled: next.audioTranscriptionEnabled,
            },
            disclosureVersion: next.disclosureVersion,
            authorizationAttested: input.organizationAuthorizationConfirmed === true,
          },
        },
      });
      return next;
    }, { maxWait: 5_000, timeout: 10_000 });

    return json({ settings: nextSettings, canManage: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof TenantAiSettingsInputError) {
      return json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('Tenant AI settings update failed:', error);
    return json({ error: 'No se pudo actualizar la configuración de IA.' }, { status: 500 });
  }
}
