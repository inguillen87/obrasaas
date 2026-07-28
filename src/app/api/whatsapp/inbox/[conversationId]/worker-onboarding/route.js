import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  decodeUtf8RequestBytes,
  readLimitedRequestBytes,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  resolveRequestCorrelationId,
  withCorrelationId,
} from '@/lib/request-correlation';
import {
  WorkerOnboardingInvitationError,
  getWorkerOnboardingInvitationState,
  sendWorkerOnboardingInvitation,
} from '@/lib/whatsapp/worker-onboarding-invitations';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 1_024;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const QUERY_FIELDS = new Set(['projectId']);

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
}

function finalize(response, correlationId) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(response, correlationId);
}

function projectIdFromRequest(request) {
  const searchParams = new URL(request.url).searchParams;
  for (const key of searchParams.keys()) {
    if (!QUERY_FIELDS.has(key) || searchParams.getAll(key).length !== 1) {
      throw new WorkerOnboardingInvitationError(
        'La consulta contiene parametros no permitidos.',
        { code: 'WORKER_ONBOARDING_INVITATION_QUERY_INVALID', status: 400 },
      );
    }
  }
  const projectId = String(searchParams.get('projectId') || '').trim();
  if (!projectId) {
    throw new WorkerOnboardingInvitationError(
      'Selecciona una obra para invitar al contacto.',
      { code: 'PROJECT_ID_REQUIRED', status: 400 },
    );
  }
  return projectId;
}

async function conversationIdFromContext(context) {
  const params = await context?.params;
  const conversationId = String(params?.conversationId || '').trim();
  if (!conversationId) {
    throw new WorkerOnboardingInvitationError(
      'La conversacion no es valida.',
      { code: 'INBOX_CONVERSATION_NOT_FOUND', status: 404 },
    );
  }
  return conversationId;
}

async function assertActiveProject(prisma, access, projectId) {
  if (projectId !== access?.project?.id) {
    throw new WorkerOnboardingInvitationError(
      'La obra solicitada no coincide con el contexto activo.',
      { code: 'PROJECT_SCOPE_MISMATCH', status: 403 },
    );
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: access.organization.id },
    select: { id: true },
  });
  if (!project) {
    throw new WorkerOnboardingInvitationError(
      'La obra ya no esta disponible.',
      { code: 'PROJECT_NOT_FOUND', status: 404 },
    );
  }
}

function requireIdempotencyKey(request) {
  const key = String(request.headers.get('idempotency-key') || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new WorkerOnboardingInvitationError(
      'Envia un encabezado Idempotency-Key valido de entre 8 y 128 caracteres.',
      { code: 'IDEMPOTENCY_KEY_INVALID', status: 400 },
    );
  }
  return key;
}

function isJsonMediaType(request) {
  const mediaType = String(request.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  return mediaType === 'application/json'
    || (mediaType.startsWith('application/') && mediaType.endsWith('+json'));
}

async function readOptionalEmptyObject(request) {
  const bytes = await readLimitedRequestBytes(request, { maxBytes: MAX_BODY_BYTES });
  if (bytes.byteLength === 0) return {};
  if (!isJsonMediaType(request)) {
    throw new RequestBodyError('El cuerpo debe enviarse como application/json.', {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      status: 415,
    });
  }
  let input;
  try {
    input = JSON.parse(decodeUtf8RequestBytes(bytes));
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError('El cuerpo JSON no es valido.', {
      code: 'INVALID_JSON',
      status: 400,
    });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WorkerOnboardingInvitationError(
      'El cuerpo debe ser un objeto JSON vacio.',
      { code: 'WORKER_ONBOARDING_INVITATION_BODY_INVALID', status: 400 },
    );
  }
  if (Object.keys(input).length !== 0) {
    throw new WorkerOnboardingInvitationError(
      'El alta deriva telefono, token y alcance exclusivamente del servidor.',
      { code: 'WORKER_ONBOARDING_INVITATION_BODY_NOT_EMPTY', status: 400 },
    );
  }
  return input;
}

function errorResponse(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof WorkerOnboardingInvitationError) {
    return json({ error: error.message, code: error.code }, {
      status: error.status,
      headers: error.retryAfterSeconds
        ? { 'Retry-After': String(error.retryAfterSeconds) }
        : undefined,
    });
  }
  return null;
}

export function createWorkerOnboardingInvitationHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  loadState = getWorkerOnboardingInvitationState,
  sendInvitation = sendWorkerOnboardingInvitation,
  parseBody = readOptionalEmptyObject,
  resolveCorrelationId = resolveRequestCorrelationId,
  clock = () => new Date(),
  env = process.env,
  logError = console.error,
} = {}) {
  async function GET(request, context) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:workers:onboarding:read', { subscriptionMode: 'read' });
      const projectId = projectIdFromRequest(request);
      const conversationId = await conversationIdFromContext(context);
      const prisma = prismaFactory();
      await assertActiveProject(prisma, access, projectId);
      const state = await loadState({
        prisma,
        access,
        conversationId,
        canManage: hasTenantPermission(access, 'org:workers:onboarding:manage'),
        clock,
        env,
      });
      return finalize(json(state), correlationId);
    } catch (error) {
      const known = errorResponse(error);
      if (known) return finalize(known, correlationId);
      logError('Worker-onboarding invitation state failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalize(json({
        error: 'No se pudo evaluar el alta del contacto.',
        code: 'WORKER_ONBOARDING_INVITATION_STATE_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  async function POST(request, context) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:workers:onboarding:manage', { subscriptionMode: 'write' });
      const projectId = projectIdFromRequest(request);
      const conversationId = await conversationIdFromContext(context);
      await parseBody(request);
      const idempotencyKey = requireIdempotencyKey(request);
      const prisma = prismaFactory();
      await assertActiveProject(prisma, access, projectId);
      const result = await sendInvitation({
        prisma,
        access,
        conversationId,
        idempotencyKey,
        clock,
        env,
      });
      return finalize(json(result), correlationId);
    } catch (error) {
      const known = errorResponse(error);
      if (known) return finalize(known, correlationId);
      logError('Worker-onboarding invitation send failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalize(json({
        error: 'No se pudo enviar la invitacion de alta.',
        code: 'WORKER_ONBOARDING_INVITATION_SEND_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  return { GET, POST };
}

export const { GET, POST } = createWorkerOnboardingInvitationHandlers();
