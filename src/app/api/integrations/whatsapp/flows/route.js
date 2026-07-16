import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { decryptCredential } from '@/lib/credentials';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import { MetaIntegrationError } from '@/lib/whatsapp/embedded-signup';
import {
  getWhatsAppFlowCatalog,
  listWhatsAppFlows,
  provisionWhatsAppFlowDraft,
} from '@/lib/whatsapp/flows';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FLOW_JSON_BYTES = 8 * 1024;

function auditIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;
}

async function requireActiveConnection(access) {
  const connection = await getPrisma().whatsAppConnection.findUnique({
    where: { projectId: access.project.id },
  });
  if (
    !connection?.enabled
    || connection.connectionStatus !== 'CONNECTED'
    || !connection.whatsappBusinessId
    || !connection.encryptedAccessToken
  ) {
    throw new MetaIntegrationError('Conectá una cuenta de WhatsApp antes de administrar Flows.', {
      code: 'WHATSAPP_NOT_CONNECTED',
      status: 409,
    });
  }
  return connection;
}

function flowErrorResponse(error, fallback) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof MetaIntegrationError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error(fallback, error);
  return Response.json({ error: 'No se pudieron administrar los WhatsApp Flows.' }, { status: 500 });
}

function catalogWithRuntimeState(catalog, metadata) {
  const storedFlows = metadata
    && typeof metadata === 'object'
    && !Array.isArray(metadata)
    && metadata.whatsappFlows
    && typeof metadata.whatsappFlows === 'object'
    && !Array.isArray(metadata.whatsappFlows)
    ? metadata.whatsappFlows
    : {};
  return catalog.map((item) => ({
    ...item,
    runtimeActive: item.remote.status === 'PUBLISHED'
      && storedFlows[item.key]?.status === 'PUBLISHED'
      && String(storedFlows[item.key]?.id || '') === item.remote.id,
  }));
}

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const connection = await requireActiveConnection(access);
    const remoteFlows = await listWhatsAppFlows({
      whatsappBusinessId: connection.whatsappBusinessId,
      accessToken: decryptCredential(connection.encryptedAccessToken),
    });
    return Response.json({
      catalog: catalogWithRuntimeState(getWhatsAppFlowCatalog(remoteFlows), connection.metadata),
    });
  } catch (error) {
    return flowErrorResponse(error, 'WhatsApp Flow catalog read failed:');
  }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const body = await readJsonRequest(request, { maxBytes: MAX_FLOW_JSON_BYTES });
    const connection = await requireActiveConnection(access);
    const result = await provisionWhatsAppFlowDraft({
      blueprintKey: String(body.blueprintKey || ''),
      whatsappBusinessId: connection.whatsappBusinessId,
      accessToken: decryptCredential(connection.encryptedAccessToken),
    });

    const prisma = getPrisma();
    const metadata = connection.metadata
      && typeof connection.metadata === 'object'
      && !Array.isArray(connection.metadata)
      ? connection.metadata
      : {};
    const previousFlows = metadata.whatsappFlows
      && typeof metadata.whatsappFlows === 'object'
      && !Array.isArray(metadata.whatsappFlows)
      ? metadata.whatsappFlows
      : {};
    const provisionedAt = new Date();
    await prisma.$transaction([
      prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          metadata: {
            ...metadata,
            whatsappFlows: {
              ...previousFlows,
              [result.blueprintKey]: {
                id: result.flow.id,
                name: result.flow.name,
                status: result.flow.status,
                jsonVersion: result.flow.jsonVersion,
                provisionedAt: provisionedAt.toISOString(),
              },
            },
          },
        },
      }),
      prisma.auditLog.create({
        data: {
          organizationId: access.organization.id,
          actorId: access.databaseUserId,
          action: result.created
            ? 'integration.whatsapp.flow_draft_created'
            : result.flow.status === 'PUBLISHED'
              ? 'integration.whatsapp.flow_existing_confirmed'
              : 'integration.whatsapp.flow_draft_updated',
          entityType: 'WhatsAppFlow',
          entityId: result.flow.id,
          ipAddress: auditIp(request),
          metadata: {
            projectId: access.project.id,
            whatsappBusinessId: connection.whatsappBusinessId,
            blueprintKey: result.blueprintKey,
            status: result.flow.status,
            jsonVersion: result.flow.jsonVersion,
            published: result.flow.status === 'PUBLISHED',
          },
        },
      }),
    ]);

    return Response.json({
      result,
      catalogItem: {
        ...getWhatsAppFlowCatalog([result.flow])
          .find((item) => item.key === result.blueprintKey),
        runtimeActive: result.flow.status === 'PUBLISHED',
      },
    });
  } catch (error) {
    return flowErrorResponse(error, 'WhatsApp Flow draft provision failed:');
  }
}
