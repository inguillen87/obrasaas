import {
  AccessError,
  accessErrorResponse,
} from '@/lib/access';
import {
  ProjectCertificateError,
  projectCertificateErrorResponse,
} from '@/lib/project-certificates';
import {
  RequestBodyError,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  resolveRequestCorrelationId,
  withCorrelationId,
} from '@/lib/request-correlation';

export function finalizeProjectCertificateResponse(request, response, replayed = null) {
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

export function knownProjectCertificateError(request, error) {
  let response = null;
  if (error instanceof AccessError) response = accessErrorResponse(error);
  else if (error instanceof RequestBodyError) response = requestBodyErrorResponse(error);
  else if (error instanceof ProjectCertificateError) response = projectCertificateErrorResponse(error);
  return response ? finalizeProjectCertificateResponse(request, response) : null;
}

export function unexpectedProjectCertificateError(request, error, operation, logError) {
  const correlationId = resolveRequestCorrelationId(request);
  logError('project_certificate.unexpected', {
    correlationId,
    operation,
    name: typeof error?.name === 'string' ? error.name : 'Error',
    code: typeof error?.code === 'string' ? error.code : null,
  });
  return finalizeProjectCertificateResponse(request, Response.json({
    error: operation === 'read'
      ? 'No se pudo cargar el certificado contractual.'
      : 'No se pudo completar la operación del certificado.',
    code: operation === 'read'
      ? 'PROJECT_CERTIFICATE_READ_FAILED'
      : 'PROJECT_CERTIFICATE_WRITE_FAILED',
  }, { status: 500 }));
}

export function projectCertificateScope(access) {
  return {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
}

export function requireProjectCertificateActor(access) {
  if (!access.tenantMembershipId) {
    throw new AccessError('Una membresía activa en la organización y obra es obligatoria.', {
      code: 'TENANT_PROJECT_MEMBERSHIP_REQUIRED',
      status: 403,
    });
  }
  return access.tenantMembershipId;
}

export function rejectProjectCertificateQuery(request) {
  if (new URL(request.url).searchParams.size !== 0) {
    throw new ProjectCertificateError(
      'La ruta no admite parámetros de consulta.',
      'PROJECT_CERTIFICATE_QUERY_INVALID',
    );
  }
}
