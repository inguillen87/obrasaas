import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { SOURCE_EVIDENCE_PERMISSION } from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import { resolveRequestCorrelationId } from '@/lib/request-correlation';
import {
  linkWhatsAppMessageToProgressEvidence,
  WhatsAppProgressEvidenceError,
  whatsAppProgressEvidenceErrorResponse,
} from '@/lib/whatsapp/progress-evidence';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 4 * 1024;
const BODY_FIELDS = new Set(['projectId', 'taskId']);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function secureResponse(response, correlationId) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('x-request-id', correlationId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function routeError(message, code, status) {
  return new WhatsAppProgressEvidenceError(message, { code, status });
}

function projectIdFromRequest(request, access) {
  const projectId = String(new URL(request.url).searchParams.get('projectId') || '').trim();
  if (!projectId) {
    throw routeError('Seleccioná una obra para vincular la evidencia.', 'PROJECT_ID_REQUIRED', 400);
  }
  if (projectId !== access.project.id) {
    throw routeError(
      'La obra solicitada no coincide con el contexto activo.',
      'PROJECT_SCOPE_MISMATCH',
      403,
    );
  }
  return projectId;
}

function assertBody(input, projectId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw routeError(
      'El cuerpo debe ser un objeto JSON.',
      'WHATSAPP_PROGRESS_EVIDENCE_INPUT_INVALID',
      400,
    );
  }
  if (Object.keys(input).some((field) => !BODY_FIELDS.has(field))) {
    throw routeError(
      'La solicitud contiene campos no permitidos.',
      'WHATSAPP_PROGRESS_EVIDENCE_INPUT_INVALID',
      400,
    );
  }
  const bodyProjectId = typeof input.projectId === 'string' ? input.projectId.trim() : '';
  if (!bodyProjectId) {
    throw routeError('projectId es obligatorio.', 'WHATSAPP_PROGRESS_EVIDENCE_INPUT_INVALID', 400);
  }
  if (bodyProjectId !== projectId) {
    throw routeError(
      'La obra del cuerpo no coincide con la URL.',
      'PROJECT_SCOPE_MISMATCH',
      403,
    );
  }
  return {
    taskId: typeof input.taskId === 'string' ? input.taskId.trim() : '',
  };
}

function idempotencyKeyFromRequest(request) {
  const key = String(request.headers.get('idempotency-key') || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw routeError(
      'La operación requiere una clave de idempotencia válida.',
      'IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  return key;
}

async function sourceIds(context) {
  const params = await context?.params;
  const conversationId = String(params?.conversationId || '').trim();
  const messageId = String(params?.messageId || '').trim();
  if (!conversationId || !messageId || conversationId.length > 190 || messageId.length > 190) {
    throw routeError(
      'La evidencia solicitada no está disponible.',
      'WHATSAPP_PROGRESS_EVIDENCE_NOT_FOUND',
      404,
    );
  }
  return { conversationId, messageId };
}

function knownErrorResponse(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  return whatsAppProgressEvidenceErrorResponse(error)
    || projectWritePolicyErrorResponse(error);
}

export function createWhatsAppProgressEvidenceHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  linkEvidence = linkWhatsAppMessageToProgressEvidence,
  parseBody = (request) => readJsonRequest(request, { maxBytes: MAX_BODY_BYTES }),
  resolveCorrelationId = resolveRequestCorrelationId,
  clock = () => new Date(),
} = {}) {
  async function POST(request, context) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:execution:manage', { subscriptionMode: 'write' });
      authorize(access, SOURCE_EVIDENCE_PERMISSION);
      const projectId = projectIdFromRequest(request, access);
      const input = assertBody(await parseBody(request), projectId);
      const { conversationId, messageId } = await sourceIds(context);
      const idempotencyKey = idempotencyKeyFromRequest(request);
      const result = await linkEvidence(prismaFactory(), {
        scope: {
          organizationId: access.organization.id,
          projectId,
        },
        actorId: access.databaseUserId,
        conversationId,
        messageId,
        taskId: input.taskId,
        idempotencyKey,
        correlationId,
        clock,
      });
      return secureResponse(
        Response.json(result, { status: result.replayed ? 200 : 201 }),
        correlationId,
      );
    } catch (error) {
      const response = knownErrorResponse(error);
      if (response) return secureResponse(response, correlationId);
      console.error('WhatsApp progress evidence link failed.', {
        requestId: correlationId,
        name: error?.name || 'Error',
        code: error?.code || 'UNKNOWN',
      });
      return secureResponse(
        Response.json(
          {
            error: 'No se pudo vincular la evidencia de WhatsApp.',
            code: 'WHATSAPP_PROGRESS_EVIDENCE_FAILED',
          },
          { status: 500 },
        ),
        correlationId,
      );
    }
  }

  return { POST };
}

export const { POST } = createWhatsAppProgressEvidenceHandlers();
