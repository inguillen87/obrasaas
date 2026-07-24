import {
  AccessError,
  accessErrorResponse,
} from '@/lib/access';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import {
  RequestBodyError,
  requestBodyErrorResponse,
} from '@/lib/request-body';

export const MAX_ATTENDANCE_JSON_BYTES = 16 * 1024;

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export class AttendanceApiError extends Error {
  constructor(message, { code = 'ATTENDANCE_API_INVALID', status = 400 } = {}) {
    super(message);
    this.name = 'AttendanceApiError';
    this.code = code;
    this.status = status;
  }
}

export function attendanceJson(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
}

export function attendanceScope(access) {
  return {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
}

export function requireAttendanceIdempotencyKey(request) {
  const key = String(request.headers.get('idempotency-key') || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new AttendanceApiError(
      'Enviá una clave Idempotency-Key válida de entre 8 y 128 caracteres.',
      { code: 'ATTENDANCE_IDEMPOTENCY_KEY_INVALID', status: 400 },
    );
  }
  return key;
}

export function requireAttendanceRouteId(value, field) {
  const identifier = typeof value === 'string' ? value.trim() : '';
  if (
    !identifier
    || identifier.length > 180
    || /[\u0000-\u001f\u007f]/.test(identifier)
  ) {
    throw new AttendanceApiError(`El identificador ${field} no es válido.`, {
      code: 'ATTENDANCE_ROUTE_ID_INVALID',
      status: 404,
    });
  }
  return identifier;
}

function withNoStore(response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export function attendanceApiErrorResponse(error, {
  operation,
  fallbackMessage,
  fallbackCode,
  domainErrorResponses = [],
}) {
  let response = null;
  if (error instanceof AttendanceApiError) {
    response = attendanceJson({ error: error.message, code: error.code }, {
      status: error.status,
    });
  } else if (error instanceof AccessError) {
    response = accessErrorResponse(error);
  } else if (error instanceof RequestBodyError) {
    response = requestBodyErrorResponse(error);
  } else {
    for (const domainErrorResponse of domainErrorResponses) {
      response = domainErrorResponse(error);
      if (response) break;
    }
    response ||= projectWritePolicyErrorResponse(error);
  }
  if (response) return withNoStore(response);

  console.error('Attendance API operation failed:', {
    operation,
    name: error?.name,
    code: error?.code,
  });
  return attendanceJson({
    error: fallbackMessage,
    code: fallbackCode,
  }, { status: 500 });
}

export function assertOnlySearchParams(searchParams, allowed) {
  for (const key of searchParams.keys()) {
    if (!allowed.has(key)) {
      throw new AttendanceApiError('La consulta contiene filtros no admitidos.', {
        code: 'ATTENDANCE_QUERY_INVALID',
        status: 400,
      });
    }
  }
  for (const key of allowed) {
    if (searchParams.getAll(key).length > 1) {
      throw new AttendanceApiError('Cada filtro puede enviarse una sola vez.', {
        code: 'ATTENDANCE_QUERY_INVALID',
        status: 400,
      });
    }
  }
}
