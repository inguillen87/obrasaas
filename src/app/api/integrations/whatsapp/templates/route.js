import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { normalizeTemplateReview, assertTemplateReviewDefinition, TemplateReviewError } from '@/lib/whatsapp/template-review-policy';
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
  buildOwnedWhatsAppFlowTemplate,
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
      'Vary': 'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project',
      'X-Content-Type-Options': 'nosniff',
      ...init.headers,
    },
  });
}

function auditIp(request) {
  return request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request?.headers?.get('x-real-ip')
    || null;
}

function assertTemplateRequest(request, access) {
  if (!request?.headers?.get('x-obrasaas-organization') || !request.headers.get('x-obrasaas-project')) {
    throw new TemplateReviewError('Actualizá la empresa y obra de esta pantalla.', 'WHATSAPP_TEMPLATE_CONTEXT_REQUIRED', 409);
  }
  assertEvidenceRequestContext(request, access);
  const url = new URL(request.url);
  if (url.search) throw new TemplateReviewError('La consulta no admite cambios de alcance por URL.');
  if (request.headers.get('sec-fetch-site') === 'cross-site'
    || request.headers.get('origin') && request.headers.get('origin') !== url.origin) {
    throw new TemplateReviewError('Origen no autorizado.', 'WHATSAPP_TEMPLATE_ORIGIN', 403);
  }
  return { organizationId: access.organization.id, projectId: access.project.id };
}
function secureErrorResponse(error, fallback) {
  if (error instanceof TemplateReviewError) return json({ error: error.message, code: error.code }, { status: error.status });
  const contextFailure = evidenceContextErrorResponse(error);
  if (contextFailure) return contextFailure;
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
  console.error(fallback, { code: 'WHATSAPP_TEMPLATE_OPERATION_UNCONFIRMED' });
  return json({ error: 'No se pudieron administrar las plantillas de WhatsApp.' }, { status: 500 });
}

function errorResponse(error, fallback) {
  const response = secureErrorResponse(error, fallback);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Vary', 'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const context = assertTemplateRequest(request, access);
    const prisma = getPrisma();
    const connection = await requireGraphReadyWhatsAppConnection(prisma, access.project.id);
    const templates = await synchronizeOwnedWhatsAppFlowTemplates({
      prisma,
      connection,
      accessToken: decryptCredential(connection.encryptedAccessToken),
    });
    return json({ context, templates });
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
    const context = assertTemplateRequest(request, access);
    const review = normalizeTemplateReview(await readJsonRequest(request, { maxBytes: MAX_TEMPLATE_REQUEST_BYTES }));
    const { blueprintKey } = review;

    prisma = getPrisma();
    const connection = await requireGraphReadyWhatsAppConnection(prisma, access.project.id);
    assertTemplateReviewDefinition(review, buildOwnedWhatsAppFlowTemplate({ connection, blueprintKey }));
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

    assertTemplateReviewDefinition(review, buildOwnedWhatsAppFlowTemplate({ connection: { ...connection, metadata: acquired.metadata }, blueprintKey }));
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
    return json({ context, result });
  } catch (error) {
    return errorResponse(error, 'WhatsApp template provisioning failed:');
  } finally {
    if (lease && prisma) {
      try {
        await releaseWhatsAppConnectionLease(prisma, lease);
      } catch (releaseError) {
        console.error('WhatsApp template provisioning lease release failed:', { code: releaseError?.code || 'LEASE_RELEASE_FAILED' });
      }
    }
  }
}
