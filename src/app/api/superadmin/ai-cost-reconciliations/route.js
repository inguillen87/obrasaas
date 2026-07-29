import {
  AccessError,
  accessErrorResponse,
  requireSuperadmin,
} from '@/lib/access';
import {
  AiCostReconciliationError,
  normalizeAiCostReconciliationRequest,
  reconcileAiVisualCost,
} from '@/lib/ai/cost-reconciliation';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  resolveRequestCorrelationId,
  withCorrelationId,
} from '@/lib/request-correlation';

export const runtime = 'nodejs';

const MAX_RECONCILIATION_JSON_BYTES = 8 * 1024;

function json(payload, correlationId, init = {}) {
  const response = Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
  return withCorrelationId(response, correlationId);
}

function secureResponse(response, correlationId) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }), correlationId);
}

function auditIp(request) {
  // Vercel emits x-vercel-forwarded-for independently of an upstream proxy;
  // prefer it so a proxy-overwritten x-forwarded-for is not treated as source.
  return request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;
}

function safeLog(error, correlationId) {
  return {
    correlationId,
    name: typeof error?.name === 'string' ? error.name : 'Error',
    code: typeof error?.code === 'string' ? error.code : 'UNKNOWN',
    status: Number.isInteger(error?.status) ? error.status : null,
  };
}

export function createAiCostReconciliationHandlers({
  resolveAccess = requireSuperadmin,
  prismaFactory = getPrisma,
  parseBody = readJsonRequest,
  normalizeInput = normalizeAiCostReconciliationRequest,
  reconcile = reconcileAiVisualCost,
  resolveCorrelationId = resolveRequestCorrelationId,
} = {}) {
  async function POST(request) {
    const correlationId = resolveCorrelationId(request);
    try {
      // Authenticate before revealing route-level validation details.
      const access = await resolveAccess();
      if (new URL(request.url).search) {
        throw new AiCostReconciliationError(
          'Query parameters are not accepted for AI cost reconciliation.',
          { code: 'AI_COST_RECONCILIATION_QUERY_FORBIDDEN', status: 400 },
        );
      }
      const body = await parseBody(request, { maxBytes: MAX_RECONCILIATION_JSON_BYTES });
      const input = normalizeInput(body, {
        idempotencyKey: request.headers.get('idempotency-key'),
      });
      const result = await reconcile(prismaFactory(), {
        access,
        input,
        ipAddress: auditIp(request),
      });
      return json({ reconciliation: result }, correlationId, {
        status: result.replayed ? 200 : 201,
      });
    } catch (error) {
      if (error instanceof AccessError) {
        return secureResponse(accessErrorResponse(error), correlationId);
      }
      if (error instanceof RequestBodyError) {
        return secureResponse(requestBodyErrorResponse(error), correlationId);
      }
      if (error instanceof AiCostReconciliationError) {
        return json({ error: error.message, code: error.code }, correlationId, {
          status: error.status,
        });
      }
      console.error('AI cost reconciliation failed:', safeLog(error, correlationId));
      return json({
        error: 'No se pudo conciliar el costo de IA.',
        code: 'AI_COST_RECONCILIATION_FAILED',
      }, correlationId, { status: 500 });
    }
  }
  return { POST };
}

export const { POST } = createAiCostReconciliationHandlers();
