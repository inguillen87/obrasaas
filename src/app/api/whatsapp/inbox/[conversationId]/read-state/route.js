import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  markWhatsAppConversationRead,
  WhatsAppInboxError,
} from '@/lib/whatsapp/inbox';

export const runtime = 'nodejs';

const MAX_READ_STATE_BODY_BYTES = 4_000;
const READ_STATE_FIELDS = new Set(['projectId', 'throughMessageId']);

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
  const projectId = String(
    new URL(request.url).searchParams.get('projectId') || '',
  ).trim();
  if (!projectId) {
    throw new WhatsAppInboxError('Seleccioná una obra para actualizar la lectura.', {
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
    throw new WhatsAppInboxError('La conversación no es válida.', {
      code: 'INBOX_CONVERSATION_NOT_FOUND',
      status: 404,
    });
  }
  return conversationId;
}

async function assertActiveProject(prisma, access, projectId) {
  if (projectId !== access.project.id) {
    throw new WhatsAppInboxError('La obra solicitada no coincide con el contexto activo.', {
      code: 'PROJECT_SCOPE_MISMATCH',
      status: 403,
    });
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: access.organization.id },
    select: { id: true },
  });
  if (!project) {
    throw new WhatsAppInboxError('La obra ya no está disponible.', {
      code: 'PROJECT_NOT_FOUND',
      status: 404,
    });
  }
}

function assertReadStateInput(input, projectId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WhatsAppInboxError('El cuerpo debe ser un objeto JSON.', {
      code: 'INBOX_READ_STATE_INVALID',
      status: 400,
    });
  }
  if (Object.keys(input).some((field) => !READ_STATE_FIELDS.has(field))) {
    throw new WhatsAppInboxError('El punto de lectura contiene campos no permitidos.', {
      code: 'INBOX_READ_STATE_INVALID',
      status: 400,
    });
  }
  const inputProjectId = typeof input.projectId === 'string'
    ? input.projectId.trim()
    : '';
  const throughMessageId = typeof input.throughMessageId === 'string'
    ? input.throughMessageId.trim()
    : '';
  if (!inputProjectId || !throughMessageId) {
    throw new WhatsAppInboxError('La obra y el punto de lectura son obligatorios.', {
      code: 'INBOX_READ_STATE_INVALID',
      status: 400,
    });
  }
  if (inputProjectId !== projectId) {
    throw new WhatsAppInboxError('La obra del punto de lectura no coincide con la URL.', {
      code: 'PROJECT_SCOPE_MISMATCH',
      status: 403,
    });
  }
}

function inboxErrorResponse(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof WhatsAppInboxError) {
    return json({ error: error.message, code: error.code }, { status: error.status });
  }
  return null;
}

export function createWhatsAppReadStateHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  markRead = markWhatsAppConversationRead,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: MAX_READ_STATE_BODY_BYTES,
  }),
} = {}) {
  async function PUT(request, context) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:conversations:read', { subscriptionMode: 'read' });
      const projectId = projectIdFromRequest(request);
      const conversationId = await conversationIdFromContext(context);
      const input = await parseBody(request);
      assertReadStateInput(input, projectId);
      const prisma = prismaFactory();
      await assertActiveProject(prisma, access, projectId);
      return json(await markRead({
        prisma,
        access,
        conversationId,
        throughMessageId: input.throughMessageId,
      }));
    } catch (error) {
      const response = inboxErrorResponse(error);
      if (response) return response;
      console.error('WhatsApp read-state update failed:', error);
      return json({ error: 'No se pudo actualizar el punto de lectura.' }, { status: 500 });
    }
  }

  return { PUT };
}

export const { PUT } = createWhatsAppReadStateHandlers();
