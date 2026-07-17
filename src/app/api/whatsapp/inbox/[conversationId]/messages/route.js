import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import {
  MEDICAL_EVIDENCE_PERMISSION,
  SOURCE_EVIDENCE_PERMISSION,
} from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  getWhatsAppConversationMessages,
  sendManualWhatsAppMessage,
  WhatsAppInboxError,
} from '@/lib/whatsapp/inbox';

export const runtime = 'nodejs';

const MAX_SEND_BODY_BYTES = 20_000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SEND_FIELDS = new Set(['projectId', 'body', 'idempotencyKey']);

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
  const value = new URL(request.url).searchParams.get('projectId');
  const projectId = String(value || '').trim();
  if (!projectId) {
    throw new WhatsAppInboxError('Seleccioná una obra para abrir la conversación.', {
      code: 'PROJECT_ID_REQUIRED',
      status: 400,
    });
  }
  return projectId;
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

function inboxErrorResponse(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof WhatsAppInboxError) {
    return json(
      { error: error.message, code: error.code },
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

function idempotencyKey(request, input) {
  const value = String(
    request.headers.get('idempotency-key') || input?.idempotencyKey || '',
  ).trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new WhatsAppInboxError('La operación requiere una clave de idempotencia válida.', {
      code: 'IDEMPOTENCY_KEY_INVALID',
      status: 400,
    });
  }
  return value;
}

function assertSendInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WhatsAppInboxError('El cuerpo debe ser un objeto JSON.', {
      code: 'WHATSAPP_MESSAGE_INVALID',
      status: 400,
    });
  }
  if (Object.keys(input).some((field) => !SEND_FIELDS.has(field))) {
    throw new WhatsAppInboxError('El mensaje contiene campos no permitidos.', {
      code: 'WHATSAPP_MESSAGE_INVALID',
      status: 400,
    });
  }
}

export function createWhatsAppConversationMessageHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  loadMessages = getWhatsAppConversationMessages,
  sendMessage = sendManualWhatsAppMessage,
  parseBody = (request) => readJsonRequest(request, { maxBytes: MAX_SEND_BODY_BYTES }),
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
      return json(await loadMessages({
        prisma,
        access,
        conversationId,
        includeMedicalEvidence: hasTenantPermission(
          access,
          MEDICAL_EVIDENCE_PERMISSION,
        ),
        includeSourceEvidence: hasTenantPermission(
          access,
          SOURCE_EVIDENCE_PERMISSION,
        ),
        canManage: hasTenantPermission(access, 'org:conversations:manage'),
        clock,
        env,
      }));
    } catch (error) {
      const response = inboxErrorResponse(error);
      if (response) return response;
      console.error('WhatsApp conversation read failed:', error);
      return json({ error: 'No se pudo cargar la conversación.' }, { status: 500 });
    }
  }

  async function POST(request, context) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:conversations:manage');
      const queryProjectId = projectIdFromRequest(request);
      const conversationId = await conversationIdFromContext(context);
      const input = await parseBody(request);
      assertSendInput(input);
      const bodyProjectId = input.projectId == null
        ? queryProjectId
        : String(input.projectId || '').trim();
      if (bodyProjectId !== queryProjectId) {
        throw new WhatsAppInboxError('La obra del mensaje no coincide con la URL.', {
          code: 'PROJECT_SCOPE_MISMATCH',
          status: 403,
        });
      }
      const key = idempotencyKey(request, input);
      const prisma = prismaFactory();
      await assertActiveProject(prisma, access, queryProjectId);
      return json(await sendMessage({
        prisma,
        access,
        conversationId,
        body: input.body,
        idempotencyKey: key,
        includeMedicalEvidence: hasTenantPermission(
          access,
          MEDICAL_EVIDENCE_PERMISSION,
        ),
        clock,
        env,
      }));
    } catch (error) {
      const response = inboxErrorResponse(error);
      if (response) return response;
      console.error('WhatsApp manual message failed:', error);
      return json({ error: 'No se pudo enviar el mensaje.' }, { status: 500 });
    }
  }

  return { GET, POST };
}

export const { GET, POST } = createWhatsAppConversationMessageHandlers();
