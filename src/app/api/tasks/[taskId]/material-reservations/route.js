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
  resolveRequestCorrelationId,
  withCorrelationId,
} from '@/lib/request-correlation';
import {
  applyTaskMaterialReservation,
  readTaskMaterialReservationSnapshot,
  TaskMaterialReservationError,
  taskMaterialReservationErrorResponse,
} from '@/lib/task-material-reservations';

export const runtime = 'nodejs';

const MAX_TASK_MATERIAL_RESERVATION_BODY_BYTES = 256 * 1024;

function respond(request, response, correlationId = resolveRequestCorrelationId(request)) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }), correlationId);
}

function unexpected(request, error, operation, response) {
  const correlationId = resolveRequestCorrelationId(request);
  console.error('task_material_reservations.unexpected', {
    correlationId,
    operation,
    name: typeof error?.name === 'string' ? error.name : 'Error',
    code: typeof error?.code === 'string' ? error.code : null,
  });
  return respond(request, response, correlationId);
}

function known(request, error) {
  if (error instanceof AccessError) return respond(request, accessErrorResponse(error));
  if (error instanceof RequestBodyError) return respond(request, requestBodyErrorResponse(error));
  const domain = taskMaterialReservationErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

function trustedScope(access) {
  return {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
}

function authorizeWrite(authorize, access) {
  authorize(access, 'org:tasks:manage', { subscriptionMode: 'write' });
  authorize(access, 'org:inventory:manage', { subscriptionMode: 'write' });
}

function authorizeRead(authorize, access) {
  authorize(access, 'org:tasks:read', { subscriptionMode: 'read' });
  authorize(access, 'org:inventory:read', { subscriptionMode: 'read' });
}

function assertEmptyReadQuery(request) {
  if ([...new URL(request.url).searchParams.keys()].length > 0) {
    throw new TaskMaterialReservationError(
      'La consulta de reservas no admite parámetros.',
      'TASK_MATERIAL_RESERVATION_QUERY_INVALID',
    );
  }
}

export function createTaskMaterialReservationHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  applyReservation = applyTaskMaterialReservation,
  readReservation = readTaskMaterialReservationSnapshot,
  readBody = readJsonRequest,
} = {}) {
  return {
    async GET(request, { params }) {
      try {
        const access = await resolveAccess();
        authorizeRead(authorize, access);
        assertEmptyReadQuery(request);
        const taskId = (await params).taskId;
        const result = await readReservation(prismaFactory(), {
          scope: trustedScope(access),
          taskId,
        });
        return respond(request, Response.json(result));
      } catch (error) {
        return known(request, error) || unexpected(
          request,
          error,
          'read',
          Response.json({
            error: 'No se pudo cargar la reserva de materiales.',
            code: 'TASK_MATERIAL_RESERVATION_READ_FAILED',
          }, { status: 500 }),
        );
      }
    },

    async POST(request, { params }) {
      try {
        const access = await resolveAccess();
        authorizeWrite(authorize, access);
        const taskId = (await params).taskId;
        const input = await readBody(request, {
          maxBytes: MAX_TASK_MATERIAL_RESERVATION_BODY_BYTES,
        });
        const result = await applyReservation(prismaFactory(), {
          scope: trustedScope(access),
          taskId,
          actorId: access.databaseUserId,
          operationKey: request.headers.get('Idempotency-Key'),
          input,
        });
        return respond(request, Response.json(result, {
          status: result.replayed ? 200 : 201,
        }));
      } catch (error) {
        return known(request, error) || unexpected(
          request,
          error,
          'apply',
          Response.json({
            error: 'No se pudo modificar la reserva de materiales.',
            code: 'TASK_MATERIAL_RESERVATION_WRITE_FAILED',
          }, { status: 500 }),
        );
      }
    },
  };
}

const handlers = createTaskMaterialReservationHandlers();

export async function GET(request, context) {
  return handlers.GET(request, context);
}

export async function POST(request, context) {
  return handlers.POST(request, context);
}
