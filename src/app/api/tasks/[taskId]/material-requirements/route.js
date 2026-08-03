import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
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
  listTaskMaterialRequirements,
  parseTaskMaterialRequirementQuery,
  publishTaskMaterialRequirement,
  taskMaterialRequirementErrorResponse,
} from '@/lib/task-material-requirements';

export const runtime = 'nodejs';

const MAX_TASK_MATERIAL_REQUIREMENT_BODY_BYTES = 128 * 1024;

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
  console.error('task_material_requirements.unexpected', {
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
  const domain = projectWritePolicyErrorResponse(error)
    || taskMaterialRequirementErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

function trustedScope(access) {
  return {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
}

function authorizeRead(authorize, access) {
  authorize(access, 'org:tasks:read', { subscriptionMode: 'read' });
  authorize(access, 'org:inventory:read', { subscriptionMode: 'read' });
}

function authorizeWrite(authorize, access) {
  authorize(access, 'org:tasks:manage', { subscriptionMode: 'write' });
  authorize(access, 'org:inventory:manage', { subscriptionMode: 'write' });
}

export function createTaskMaterialRequirementHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  listRequirements = listTaskMaterialRequirements,
  publishRequirements = publishTaskMaterialRequirement,
  readBody = readJsonRequest,
} = {}) {
  return {
    async GET(request, { params }) {
      try {
        const access = await resolveAccess();
        authorizeRead(authorize, access);
        const taskId = (await params).taskId;
        const query = parseTaskMaterialRequirementQuery(
          request.url,
          trustedScope(access),
          taskId,
        );
        return respond(request, Response.json(
          await listRequirements(prismaFactory(), query),
        ));
      } catch (error) {
        return known(request, error) || unexpected(
          request,
          error,
          'read',
          Response.json({
            error: 'No se pudo cargar la BOM de la tarea.',
            code: 'TASK_MATERIAL_REQUIREMENT_READ_FAILED',
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
          maxBytes: MAX_TASK_MATERIAL_REQUIREMENT_BODY_BYTES,
        });
        const result = await publishRequirements(prismaFactory(), {
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
          'publish',
          Response.json({
            error: 'No se pudo publicar la BOM de la tarea.',
            code: 'TASK_MATERIAL_REQUIREMENT_WRITE_FAILED',
          }, { status: 500 }),
        );
      }
    },
  };
}

const handlers = createTaskMaterialRequirementHandlers();

export async function GET(request, context) {
  return handlers.GET(request, context);
}

export async function POST(request, context) {
  return handlers.POST(request, context);
}
