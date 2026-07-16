import { AccessError, accessErrorResponse, getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import {
  assertSupervisorRateLimits,
  buildSupervisorContext,
  requestSupervisorAnswer,
  SupervisorInputError,
  SupervisorProviderError,
  validateSupervisorRequest,
} from '@/lib/ai/supervisor';
import { getAppState, getMessages } from '@/lib/db';
import { getPrisma } from '@/lib/prisma';

const MAX_REQUEST_BYTES = 24_000;

async function enforceSupervisorRateLimit(access) {
  const prisma = getPrisma();
  const now = Date.now();
  const actions = ['ai.supervisor.answered', 'ai.supervisor.failed'];
  const [userMinuteCount, organizationDayCount] = await Promise.all([
    prisma.auditLog.count({
      where: {
        actorId: access.databaseUserId,
        action: { in: actions },
        createdAt: { gte: new Date(now - 60_000) },
      },
    }),
    prisma.auditLog.count({
      where: {
        organizationId: access.organization.id,
        action: { in: actions },
        createdAt: { gte: new Date(now - 24 * 60 * 60 * 1_000) },
      },
    }),
  ]);
  assertSupervisorRateLimits({ userMinuteCount, organizationDayCount });
}

async function recordSupervisorAudit(access, {
  question,
  status,
  result = null,
  error = null,
}) {
  try {
    await getPrisma().auditLog.create({
      data: {
        organizationId: access.organization.id,
        actorId: access.databaseUserId,
        action: status === 'success' ? 'ai.supervisor.answered' : 'ai.supervisor.failed',
        entityType: 'ProjectAI',
        entityId: access.project.id,
        metadata: {
          projectId: access.project.id,
          category: 'AI',
          severity: status === 'success' ? 'INFO' : 'WARNING',
          source: 'openai',
          title: status === 'success'
            ? 'Consulta al Supervisor IA procesada'
            : 'Consulta al Supervisor IA no procesada',
          description: question.slice(0, 300),
          details: {
            status,
            provider: result?.provider || 'openai',
            model: result?.model || process.env.OPENAI_SUPERVISOR_MODEL || 'gpt-5-mini',
            requestId: result?.requestId || error?.requestId || null,
            confidence: result?.confidence || null,
            evidenceCount: result?.evidence?.length || 0,
            actionCount: result?.actions?.length || 0,
            errorCode: error?.code || null,
          },
        },
      },
    });
  } catch (auditError) {
    console.error('Supervisor IA audit write failed:', auditError);
  }
}

function providerErrorResponse(error) {
  const errorMessage = error.status === 429
    ? 'El Supervisor IA recibió demasiadas consultas. Probá nuevamente en unos segundos.'
    : error.status === 504
      ? 'El Supervisor IA demoró más de lo esperado. Probá nuevamente.'
      : error.code === 'AI_NOT_CONFIGURED'
        ? 'El Supervisor IA todavía no está configurado en este entorno.'
        : 'El Supervisor IA no está disponible en este momento.';

  return Response.json(
    {
      error: errorMessage,
      code: error.code,
      requestId: error.requestId || null,
    },
    {
      status: error.status,
      headers: error.status === 429 ? { 'Retry-After': '30' } : undefined,
    },
  );
}

export async function POST(request) {
  let access;
  let question = '';
  try {
    access = await getPlatformAccess();
    requireTenantPermission(access, 'org:projects:read');
    await enforceSupervisorRateLimit(access);

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BYTES) {
      throw new SupervisorInputError('La consulta supera el tamaño permitido.', {
        code: 'SUPERVISOR_REQUEST_TOO_LARGE',
        status: 413,
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new SupervisorInputError('El cuerpo debe ser JSON válido.');
    }
    const input = validateSupervisorRequest(parsed);
    question = input.question;
    const canRequestActions = hasTenantPermission(access, 'org:projects:manage');
    const [state, messages, snapshot] = await Promise.all([
      getAppState(access),
      getMessages(access),
      getPrisma().projectSnapshot.findUnique({
        where: { projectId: access.project.id },
        select: { updatedAt: true },
      }),
    ]);
    const context = buildSupervisorContext({
      access,
      state,
      messages,
      canRequestActions,
      isDemoData: !snapshot,
      snapshotUpdatedAt: snapshot?.updatedAt || null,
    });
    const result = await requestSupervisorAnswer({
      question,
      history: input.history,
      context,
    });
    await recordSupervisorAudit(access, { question, status: 'success', result });

    return Response.json({
      ...result,
      scope: {
        isDemoData: !snapshot,
        asOf: context.snapshotUpdatedAt || context.capturedAt,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof SupervisorInputError) {
      return Response.json(
        { error: error.message, code: error.code },
        {
          status: error.status,
          headers: error.status === 429 ? { 'Retry-After': '60' } : undefined,
        },
      );
    }
    if (error instanceof SupervisorProviderError) {
      if (access?.organization && access?.project && question) {
        await recordSupervisorAudit(access, {
          question,
          status: 'error',
          error,
        });
      }
      return providerErrorResponse(error);
    }
    console.error('Supervisor IA request failed:', error);
    return Response.json(
      { error: 'No se pudo procesar la consulta.', code: 'SUPERVISOR_INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
