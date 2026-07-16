import { getPrisma } from '@/lib/prisma';
import { normalizePublicLeadInput, PublicLeadInputError } from '@/lib/public-leads';
import {
  readJsonRequest,
  RequestBodyError,
  requestBodyErrorResponse,
} from '@/lib/request-body';

const MAX_REQUEST_BYTES = 16_000;
const IP_HOURLY_LIMIT = 5;
const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

function requestIp(request) {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-forwarded-for')
    || '';
  const candidate = forwarded.split(',', 1)[0].trim();
  return /^[a-f0-9:.]{3,64}$/i.test(candidate) ? candidate : null;
}

function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  let source;
  try {
    source = new URL(origin).origin;
  } catch {
    throw new PublicLeadInputError('El origen de la solicitud es inválido.', {
      code: 'INVALID_LEAD_ORIGIN',
      status: 403,
    });
  }
  if (source !== new URL(request.url).origin) {
    throw new PublicLeadInputError('La solicitud debe enviarse desde ObraSaaS.', {
      code: 'INVALID_LEAD_ORIGIN',
      status: 403,
    });
  }
}

function successResponse(status = 201) {
  return Response.json(
    {
      ok: true,
      message: 'Recibimos tu solicitud. Vamos a contactarte para definir el piloto.',
    },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const parsed = await readJsonRequest(request, { maxBytes: MAX_REQUEST_BYTES });
    const normalized = normalizePublicLeadInput(parsed);
    if (normalized.spam) return successResponse(202);

    const prisma = getPrisma();
    const ipAddress = requestIp(request);
    if (ipAddress) {
      const recentSubmissions = await prisma.auditLog.count({
        where: {
          ipAddress,
          action: {
            in: ['platform.crm.public_lead_created', 'platform.crm.public_lead_duplicate'],
          },
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1_000) },
        },
      });
      if (recentSubmissions >= IP_HOURLY_LIMIT) {
        return Response.json(
          {
            error: 'Recibimos varias solicitudes desde esta conexión. Probá nuevamente más tarde.',
            code: 'LEAD_RATE_LIMIT',
          },
          {
            status: 429,
            headers: { 'Retry-After': '3600', 'Cache-Control': 'no-store' },
          },
        );
      }
    }

    const duplicate = await prisma.crmAccount.findFirst({
      where: {
        email: normalized.data.email,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (duplicate) {
      await prisma.auditLog.create({
        data: {
          action: 'platform.crm.public_lead_duplicate',
          entityType: 'CrmAccount',
          entityId: duplicate.id,
          ipAddress,
          metadata: {
            category: 'CRM',
            source: 'landing',
            title: 'Solicitud de demo repetida',
            description: normalized.data.email,
          },
        },
      });
      return successResponse(202);
    }

    await prisma.$transaction(async (transaction) => {
      const account = await transaction.crmAccount.create({ data: normalized.data });
      await transaction.auditLog.create({
        data: {
          action: 'platform.crm.public_lead_created',
          entityType: 'CrmAccount',
          entityId: account.id,
          ipAddress,
          metadata: {
            category: 'CRM',
            source: 'landing',
            title: 'Nueva solicitud de demo',
            description: account.name,
            details: {
              segment: account.segment,
              estimatedSeats: account.estimatedSeats,
            },
          },
        },
      });
    });
    return successResponse();
  } catch (error) {
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof PublicLeadInputError) {
      return Response.json(
        { error: error.message, code: error.code },
        {
          status: error.status,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }
    console.error('Public lead capture failed:', error);
    return Response.json(
      { error: 'No pudimos registrar la solicitud. Probá nuevamente.', code: 'LEAD_INTERNAL_ERROR' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
