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
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  getProactiveWhatsAppFlowCatalog,
  resolveProactiveWhatsAppFlowUncertainty,
  sendProactiveWhatsAppFlowTemplate,
  WhatsAppProactiveFlowError,
} from '@/lib/whatsapp/proactive-flows';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 10_000;
const POST_FIELDS = new Set(['projectId', 'blueprintKey', 'idempotencyKey']);
const PATCH_FIELDS = new Set(['projectId', 'blueprintKey', 'messageId', 'confirmation']);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
}

function projectIdFromRequest(request) {
  const projectId = String(new URL(request.url).searchParams.get('projectId') || '').trim();
  if (!projectId) {
    throw new WhatsAppProactiveFlowError('Seleccioná una obra para usar formularios.', {
      code: 'PROJECT_ID_REQUIRED',
      status: 400,
    });
  }
  return projectId;
}

async function conversationIdFromContext(context) {
  const params = await context?.params;
  const conversationId = String(params?.conversationId || '').trim();
  if (!conversationId) {
    throw new WhatsAppProactiveFlowError('La conversación no es válida.', {
      code: 'INBOX_CONVERSATION_NOT_FOUND',
      status: 404,
    });
  }
  return conversationId;
}

async function assertActiveProject(prisma, access, projectId) {
  if (projectId !== access.project.id) {
    throw new WhatsAppProactiveFlowError(
      'La obra solicitada no coincide con el contexto activo.',
      { code: 'PROJECT_SCOPE_MISMATCH', status: 403 },
    );
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: access.organization.id },
    select: { id: true },
  });
  if (!project) {
    throw new WhatsAppProactiveFlowError('La obra ya no está disponible.', {
      code: 'PROJECT_NOT_FOUND',
      status: 404,
    });
  }
}

function assertPostInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WhatsAppProactiveFlowError('El cuerpo debe ser un objeto JSON.', {
      code: 'WHATSAPP_FLOW_SEND_INVALID',
      status: 400,
    });
  }
  if (Object.keys(input).some((field) => !POST_FIELDS.has(field))) {
    throw new WhatsAppProactiveFlowError('El envío contiene campos no permitidos.', {
      code: 'WHATSAPP_FLOW_SEND_INVALID',
      status: 400,
    });
  }
}

function assertPatchInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WhatsAppProactiveFlowError('El cuerpo debe ser un objeto JSON.', {
      code: 'WHATSAPP_FLOW_UNCERTAINTY_INPUT_INVALID',
      status: 400,
    });
  }
  if (Object.keys(input).some((field) => !PATCH_FIELDS.has(field))) {
    throw new WhatsAppProactiveFlowError('La resolución contiene campos no permitidos.', {
      code: 'WHATSAPP_FLOW_UNCERTAINTY_INPUT_INVALID',
      status: 400,
    });
  }
}

function idempotencyKey(request, input) {
  const key = String(
    request.headers.get('idempotency-key') || input?.idempotencyKey || '',
  ).trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new WhatsAppProactiveFlowError(
      'La operación requiere una clave de idempotencia válida.',
      { code: 'IDEMPOTENCY_KEY_INVALID', status: 400 },
    );
  }
  return key;
}

function errorResponse(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof WhatsAppProactiveFlowError) {
    return json(
      {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      {
        status: error.status,
        headers: error.retryAfterSeconds
          ? { 'Retry-After': String(error.retryAfterSeconds) }
          : undefined,
      },
    );
  }
  return null;
}

export function createWhatsAppProactiveFlowHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  loadCatalog = getProactiveWhatsAppFlowCatalog,
  resolveUncertainty = resolveProactiveWhatsAppFlowUncertainty,
  sendFlow = sendProactiveWhatsAppFlowTemplate,
  parseBody = (request) => readJsonRequest(request, { maxBytes: MAX_BODY_BYTES }),
  clock = () => new Date(),
  env = process.env,
} = {}) {
  async function GET(request, context) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:conversations:read');
      const projectId = projectIdFromRequest(request);
      const conversationId = await conversationIdFromContext(context);
      const prisma = prismaFactory();
      await assertActiveProject(prisma, access, projectId);
      return json(await loadCatalog({
        prisma,
        access,
        conversationId,
        canManage: hasTenantPermission(access, 'org:conversations:manage'),
        clock,
        env,
      }));
    } catch (error) {
      const response = errorResponse(error);
      if (response) return response;
      console.error('WhatsApp proactive Flow catalog failed:', error);
      return json({ error: 'No se pudieron cargar los formularios.' }, { status: 500 });
    }
  }

  async function POST(request, context) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:conversations:manage');
      const queryProjectId = projectIdFromRequest(request);
      const conversationId = await conversationIdFromContext(context);
      const input = await parseBody(request);
      assertPostInput(input);
      const bodyProjectId = input.projectId == null
        ? queryProjectId
        : String(input.projectId || '').trim();
      if (bodyProjectId !== queryProjectId) {
        throw new WhatsAppProactiveFlowError(
          'La obra del formulario no coincide con la URL.',
          { code: 'PROJECT_SCOPE_MISMATCH', status: 403 },
        );
      }
      const prisma = prismaFactory();
      await assertActiveProject(prisma, access, queryProjectId);
      return json(await sendFlow({
        prisma,
        access,
        conversationId,
        blueprintKey: input.blueprintKey,
        idempotencyKey: idempotencyKey(request, input),
        clock,
        env,
      }));
    } catch (error) {
      const response = errorResponse(error);
      if (response) return response;
      console.error('WhatsApp proactive Flow send failed:', error);
      return json({ error: 'No se pudo enviar el formulario.' }, { status: 500 });
    }
  }

  async function PATCH(request, context) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:conversations:manage');
      const queryProjectId = projectIdFromRequest(request);
      const conversationId = await conversationIdFromContext(context);
      const input = await parseBody(request);
      assertPatchInput(input);
      const bodyProjectId = String(input.projectId || '').trim();
      if (bodyProjectId !== queryProjectId) {
        throw new WhatsAppProactiveFlowError(
          'La obra de la resolución no coincide con la URL.',
          { code: 'PROJECT_SCOPE_MISMATCH', status: 403 },
        );
      }
      const prisma = prismaFactory();
      await assertActiveProject(prisma, access, queryProjectId);
      return json(await resolveUncertainty({
        prisma,
        access,
        conversationId,
        blueprintKey: input.blueprintKey,
        messageId: input.messageId,
        confirmation: input.confirmation,
        clock,
      }));
    } catch (error) {
      const response = errorResponse(error);
      if (response) return response;
      console.error('WhatsApp proactive Flow uncertainty resolution failed:', error);
      return json({ error: 'No se pudo resolver el estado del formulario.' }, { status: 500 });
    }
  }

  return { GET, POST, PATCH };
}

export const { GET, POST, PATCH } = createWhatsAppProactiveFlowHandlers();
