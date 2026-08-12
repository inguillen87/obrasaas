import {
  AccessError,
  accessErrorResponse,
} from '@/lib/access';
import {
  ProjectContractError,
  projectContractErrorResponse,
} from '@/lib/project-contracts';
import {
  RequestBodyError,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  resolveRequestCorrelationId,
  withCorrelationId,
} from '@/lib/request-correlation';

export function finalizeProjectContractResponse(request, response, replayed = null) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('Vary', 'Cookie, Authorization');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (replayed !== null) headers.set('Idempotency-Replayed', String(replayed));
  return withCorrelationId(new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }), resolveRequestCorrelationId(request));
}

export function knownProjectContractError(request, error) {
  let response = null;
  if (error instanceof AccessError) response = accessErrorResponse(error);
  else if (error instanceof RequestBodyError) response = requestBodyErrorResponse(error);
  else response = projectContractErrorResponse(error);
  return response ? finalizeProjectContractResponse(request, response) : null;
}

export function unexpectedProjectContractError(request, error, operation, logError) {
  const correlationId = resolveRequestCorrelationId(request);
  logError('project_contract.unexpected', {
    correlationId,
    operation,
    name: typeof error?.name === 'string' ? error.name : 'Error',
    code: typeof error?.code === 'string' ? error.code : null,
  });
  return finalizeProjectContractResponse(request, Response.json({
    error: operation === 'read'
      ? 'No se pudo cargar la autoridad contractual.'
      : 'No se pudo completar la operación contractual.',
    code: operation === 'read'
      ? 'PROJECT_CONTRACT_READ_FAILED'
      : 'PROJECT_CONTRACT_WRITE_FAILED',
  }, { status: 500 }));
}

export function projectContractScope(access) {
  return {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
}

export function requireProjectContractActor(access) {
  if (!access.tenantMembershipId) {
    throw new AccessError('Una membresía activa en la organización y obra es obligatoria.', {
      code: 'TENANT_PROJECT_MEMBERSHIP_REQUIRED',
      status: 403,
    });
  }
  return access.tenantMembershipId;
}

export function rejectProjectContractQuery(request) {
  if (new URL(request.url).searchParams.size !== 0) {
    throw new ProjectContractError(
      'La ruta no admite parámetros de consulta.',
      'PROJECT_CONTRACT_QUERY_INVALID',
    );
  }
}
