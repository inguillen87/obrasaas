import { readProactiveFlowIncident } from '@/lib/whatsapp/flow-incident';
import { normalizeFlowIncidentQuery, flowIncidentMatches } from '@/lib/whatsapp/flow-incident-policy';
import { readProactiveFlowAttendance } from '@/lib/whatsapp/flow-attendance';
import { normalizeFlowAttendanceQuery, flowAttendanceMatches } from '@/lib/whatsapp/flow-attendance-policy';
import { readProactiveFlowReply } from '@/lib/whatsapp/proactive-flow-reply';
import { normalizeFlowReplyQuery, flowReplyMatches } from '@/lib/whatsapp/proactive-flow-reply-policy';
import { listProactiveFlowHistory } from '@/lib/whatsapp/proactive-flow-history';
import { FlowHistoryError, flowHistoryPageMatches } from '@/lib/whatsapp/proactive-flow-history-policy';
import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { flowCatalogMatches, flowResultMatches, flowReceiptMatches, flowResolutionMatches } from '@/lib/whatsapp/proactive-flow-confirmation';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  readProactiveWhatsAppFlowReceipt,
  getProactiveWhatsAppFlowCatalog,
  resolveProactiveWhatsAppFlowUncertainty,
  sendProactiveWhatsAppFlowTemplate,
  WhatsAppProactiveFlowError,
} from '@/lib/whatsapp/proactive-flows';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 10_000;
const POST_FIELDS = new Set(['projectId', 'blueprintKey', 'idempotencyKey', 'reviewVersion', 'confirmed']);
const PATCH_FIELDS = new Set(['projectId', 'blueprintKey', 'messageId', 'confirmation']);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project, Idempotency-Key, X-ObraSaaS-Flow-Review',
      'X-Content-Type-Options': 'nosniff',
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
  if (input?.idempotencyKey !== undefined && request.headers.get('idempotency-key') && input.idempotencyKey !== request.headers.get('idempotency-key')) {
    throw new WhatsAppProactiveFlowError('Las identidades del intento no coinciden.', { code: 'IDEMPOTENCY_KEY_INVALID', status: 400 });
  }
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

function unwrappedErrorResponse(error) {
  const contextError = evidenceContextErrorResponse(error);
  if (contextError) return contextError;
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof FlowHistoryError) return json({ error: error.message, code: error.code }, { status: error.status });
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
  readReceipt = readProactiveWhatsAppFlowReceipt,
  readHistory = listProactiveFlowHistory,
  readReply = readProactiveFlowReply,
  readAttendance = readProactiveFlowAttendance,
  readIncident = readProactiveFlowIncident,
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
      assertRequestScope(request, access);
      if (new URL(request.url).searchParams.get('mode') === 'attendance') authorize(access, 'org:attendance:read', { subscriptionMode: 'read' });
      if (new URL(request.url).searchParams.get('mode') === 'incident') authorize(access, 'org:projects:read', { subscriptionMode: 'read' });
      const projectId = projectIdFromRequest(request);
      const conversationId = await conversationIdFromContext(context);
      const prisma = prismaFactory();
      await assertActiveProject(prisma, access, projectId);
      const scope = responseScope(access, conversationId);
      if (new URL(request.url).searchParams.get('mode') === 'incident') {
        const { messageId } = normalizeFlowIncidentQuery(new URL(request.url).searchParams);
        const result = await readIncident({ prisma, access, conversationId, messageId, clock });
        assertResponse(flowIncidentMatches(result, scope, messageId));
        return json(result);
      }
      if (new URL(request.url).searchParams.get('mode') === 'attendance') {
        const { messageId } = normalizeFlowAttendanceQuery(new URL(request.url).searchParams);
        const result = await readAttendance({ prisma, access, conversationId, messageId, clock });
        assertResponse(flowAttendanceMatches(result, scope, messageId));
        return json(result);
      }
      if (new URL(request.url).searchParams.get('mode') === 'reply') {
        const { messageId } = normalizeFlowReplyQuery(new URL(request.url).searchParams);
        const canReadAttendance = hasTenantPermission(access, 'org:attendance:read');
        const canReadIncident = hasTenantPermission(access, 'org:projects:read');
        const result = await readReply({ prisma, access, conversationId, messageId, clock, canReadAttendance, canReadIncident });
        assertResponse(result?.incidentAvailable !== true || canReadIncident);
        assertResponse(result?.attendanceAvailable !== true || canReadAttendance);
        assertResponse(flowReplyMatches(result, scope, messageId));
        return json(result);
      }
      if (new URL(request.url).searchParams.get('mode') === 'history') {
        const cursor = new URL(request.url).searchParams.get('cursor');
        const page = await readHistory({ prisma, access, conversationId, cursor, clock });
        assertResponse(flowHistoryPageMatches(page, scope, cursor));
        return json(page);
      }
      if (new URL(request.url).searchParams.get('mode') === 'receipt') {
        const blueprintKey = new URL(request.url).searchParams.get('blueprintKey');
        const key = idempotencyKey(request);
        const reviewVersion = request.headers.get('x-obrasaas-flow-review');
        const result = await readReceipt({ prisma, access, conversationId, blueprintKey, idempotencyKey: key, reviewVersion });
        assertResponse(flowReceiptMatches(result, { key, blueprintKey, reviewVersion }, scope));
        return json(result);
      }
      const catalog = await loadCatalog({
        prisma,
        access,
        conversationId,
        canManage: hasTenantPermission(access, 'org:conversations:manage'),
        clock,
        env,
      });
      assertResponse(flowCatalogMatches(catalog, scope));
      return json(catalog);
    } catch (error) {
      const response = errorResponse(error);
      if (response) return response;
      console.error('WhatsApp proactive Flow catalog failed:', { code: 'CATALOG_UNAVAILABLE' });
      return json({ error: 'No se pudieron cargar los formularios.' }, { status: 500 });
    }
  }

  async function POST(request, context) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:conversations:manage');
      assertRequestScope(request, access);
      const queryProjectId = projectIdFromRequest(request);
      const conversationId = await conversationIdFromContext(context);
      const input = await parseBody(request);
      assertPostInput(input);
      if (input.confirmed !== true || typeof input.reviewVersion !== 'string' || !/^[a-f0-9]{64}$/.test(input.reviewVersion)) {
        throw new WhatsAppProactiveFlowError('Revisá el mensaje y confirmá el envío explícitamente.', { code: 'WHATSAPP_FLOW_REVIEW_REQUIRED', status: 400 });
      }
      const key = idempotencyKey(request, input);
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
      const result = await sendFlow({
        prisma,
        access,
        conversationId,
        blueprintKey: input.blueprintKey,
        idempotencyKey: key,
        reviewVersion: input.reviewVersion,
        clock,
        env,
      });
      assertResponse(flowResultMatches(result, { key, blueprintKey: input.blueprintKey, reviewVersion: input.reviewVersion }, responseScope(access, conversationId)));
      return json(result);
    } catch (error) {
      const response = errorResponse(error);
      if (response) return response;
      console.error('WhatsApp proactive Flow send failed:', { code: 'SEND_UNCONFIRMED' });
      return json({ error: 'No se pudo enviar el formulario.' }, { status: 500 });
    }
  }

  async function PATCH(request, context) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:conversations:manage');
      assertRequestScope(request, access);
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
      const result = await resolveUncertainty({
        prisma,
        access,
        conversationId,
        blueprintKey: input.blueprintKey,
        messageId: input.messageId,
        confirmation: input.confirmation,
        clock,
      });
      assertResponse(flowResolutionMatches(result, input, responseScope(access, conversationId)));
      return json(result);
    } catch (error) {
      const response = errorResponse(error);
      if (response) return response;
      console.error('WhatsApp proactive Flow uncertainty resolution failed:', { code: 'RESOLUTION_UNCONFIRMED' });
      return json({ error: 'No se pudo resolver el estado del formulario.' }, { status: 500 });
    }
  }

  return { GET, POST, PATCH };
}

export const { GET, POST, PATCH } = createWhatsAppProactiveFlowHandlers();

function responseScope(access, conversationId) {
  return { organizationId: access.organization.id, projectId: access.project.id, conversationId };
}
function assertResponse(valid) {
  if (!valid) throw new WhatsAppProactiveFlowError('El resultado no confirmó la operación solicitada. Consultá el mismo intento sin reenviarlo.', {
    code: 'WHATSAPP_FLOW_RESPONSE_UNCONFIRMED', status: 503,
  });
}
function assertRequestScope(request, access) {
  if (!request.headers.get('x-obrasaas-organization') || !request.headers.get('x-obrasaas-project')) {
    throw new WhatsAppProactiveFlowError('Actualizá el contexto de empresa y obra.', { code: 'WHATSAPP_FLOW_CONTEXT_REQUIRED', status: 409 });
  }
  assertEvidenceRequestContext(request, access);
  const url = new URL(request.url), params = url.searchParams;
  if (request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.get('origin') && request.headers.get('origin') !== url.origin) {
    throw new WhatsAppProactiveFlowError('Origen no autorizado.', { code: 'WHATSAPP_FLOW_ORIGIN', status: 403 });
  }
  const receipt = request.method === 'GET' && params.get('mode') === 'receipt';
  const history = request.method === 'GET' && params.get('mode') === 'history';
  const reply = request.method === 'GET' && params.get('mode') === 'reply';
  const attendance = request.method === 'GET' && params.get('mode') === 'attendance';
  if (attendance) normalizeFlowAttendanceQuery(params);
  const incident = request.method === 'GET' && params.get('mode') === 'incident';
  if (incident) normalizeFlowIncidentQuery(params);
  if (reply) normalizeFlowReplyQuery(params);
  for (const key of params.keys()) {
    if (!(receipt ? ['projectId', 'mode', 'blueprintKey'] : history ? ['projectId', 'mode', 'cursor'] : (reply || attendance || incident) ? ['projectId', 'mode', 'messageId'] : ['projectId']).includes(key) || params.getAll(key).length !== 1) {
      throw new WhatsAppProactiveFlowError('La consulta contiene campos no admitidos.', { code: 'WHATSAPP_FLOW_QUERY_INVALID', status: 400 });
    }
  }
}
function errorResponse(error) {
  const response = unwrappedErrorResponse(error);
  if (response) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Vary', 'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project, Idempotency-Key, X-ObraSaaS-Flow-Review');
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }
  return response;
}
