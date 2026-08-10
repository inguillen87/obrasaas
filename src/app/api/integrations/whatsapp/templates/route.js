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
  acquireWhatsAppConnectionLease,
  releaseWhatsAppConnectionLease,
  WhatsAppFlowProvisioningLeaseError,
} from '@/lib/whatsapp/flow-provisioning-lease';
import {
  provisionOwnedWhatsAppFlowTemplate,
  synchronizeOwnedWhatsAppFlowTemplates,
} from '@/lib/whatsapp/templates';
import { publicMetaIntegrationFailure } from '@/lib/whatsapp/public-error';
import {
  requireGraphReadyWhatsAppConnection,
  WhatsAppGraphAccessError,
} from '@/lib/whatsapp/graph-access';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TEMPLATE_REQUEST_BYTES = 4 * 1_024;

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
}

function auditIp(request) {
  return request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request?.headers?.get('x-real-ip')
    || null;
}

function errorResponse(error, fallback) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof WhatsAppGraphAccessError) {
    return json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof WhatsAppFlowProvisioningLeaseError) {
    return json({
      error: 'Hay otra operaci\u00f3n segura de WhatsApp en curso. Volv\u00e9 a intentar.',
      code: error.code,
    }, {
      status: error.status,
      headers: error.retryAfterSeconds
        ? { 'Retry-After': String(error.retryAfterSeconds) }
        : undefined,
    });
  }
  if (error instanceof MetaIntegrationError) {
    if (error.status >= 500) console.error(fallback, { code: error.code, status: error.status });
    const failure = publicMetaIntegrationFailure(error, {
      fallback: 'No se pudieron administrar las plantillas de WhatsApp.',
    });
    return json({ error: failure.message, code: failure.code }, {
      status: failure.status,
    });
  }
  console.error(fallback, error);
  return json({ error: 'No se pudieron administrar las plantillas de WhatsApp.' }, { status: 500 });
}

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const prisma = getPrisma();
    const connection = await requireGraphReadyWhatsAppConnection(prisma, access.project.id);
    const templates = await synchronizeOwnedWhatsAppFlowTemplates({
      prisma,
      connection,
      accessToken: decryptCredential(connection.encryptedAccessToken),
    });
    return json({ templates });
  } catch (error) {
    return errorResponse(error, 'WhatsApp template catalog read failed:');
  }
}

export async function POST(request) {
  let lease = null;
  let prisma = null;
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const body = await readJsonRequest(request, { maxBytes: MAX_TEMPLATE_REQUEST_BYTES });
    const blueprintKey = typeof body.blueprintKey === 'string' ? body.blueprintKey.trim() : '';
    if (!blueprintKey || blueprintKey.length > 100) {
      throw new MetaIntegrationError('El blueprint de WhatsApp Flow no es v\u00e1lido.', {
        code: 'FLOW_BLUEPRINT_NOT_FOUND',
        status: 400,
      });
    }

    prisma = getPrisma();
    const connection = await requireGraphReadyWhatsAppConnection(prisma, access.project.id);
    const expectedConnectionIdentity = {
      phoneNumberId: connection.phoneNumberId,
      whatsappBusinessId: connection.whatsappBusinessId,
      encryptedAccessToken: connection.encryptedAccessToken,
    };
    const acquired = await acquireWhatsAppConnectionLease(prisma, {
      connectionId: connection.id,
      operationKey: 'template_provision',
      expectedUpdatedAt: connection.updatedAt,
      expectedConnectionIdentity,
      requireActive: true,
    });
    lease = { connectionId: connection.id, leaseId: acquired.lease.id };

    const result = await provisionOwnedWhatsAppFlowTemplate({
      prisma,
      connection: { ...connection, metadata: acquired.metadata },
      blueprintKey,
      accessToken: decryptCredential(connection.encryptedAccessToken),
    });
    await prisma.auditLog.create({
      data: {
        organizationId: access.organization.id,
        actorId: access.databaseUserId,
        action: result.created
          ? 'integration.whatsapp.template_created'
          : 'integration.whatsapp.template_reconciled',
        entityType: 'WhatsAppFlowTemplate',
        entityId: result.template.id || result.expectedName,
        ipAddress: auditIp(request),
        metadata: {
          projectId: access.project.id,
          whatsappBusinessId: connection.whatsappBusinessId,
          blueprintKey,
          templateName: result.template.name,
          templateStatus: result.template.status,
          templateCategory: result.template.category,
          contentSha256: result.contentSha256,
        },
      },
    });
    return json({ result });
  } catch (error) {
    return errorResponse(error, 'WhatsApp template provisioning failed:');
  } finally {
    if (lease && prisma) {
      try {
        await releaseWhatsAppConnectionLease(prisma, lease);
      } catch (releaseError) {
        console.error('WhatsApp template provisioning lease release failed:', releaseError);
      }
    }
  }
}
