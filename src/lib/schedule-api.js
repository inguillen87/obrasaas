import { AccessError, accessErrorResponse } from './access.js';
import { projectWritePolicyErrorResponse } from './project-write-policy.js';
import { RequestBodyError, requestBodyErrorResponse } from './request-body.js';
import { withCorrelationId } from './request-correlation.js';
import { scheduleSnapshotErrorResponse } from './schedule-snapshots.js';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export class ScheduleApiError extends Error {
  constructor(message, code = 'SCHEDULE_REQUEST_INVALID', status = 400) {
    super(message);
    this.name = 'ScheduleApiError';
    this.code = code;
    this.status = status;
  }
}

export function scheduleApiJson(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
}

export function finalizeScheduleApiResponse(response, correlationId) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(response, correlationId);
}

export function scheduleScope(access) {
  return {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
}

export function assertScheduleObject(input, allowedFields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ScheduleApiError('El cuerpo debe ser un objeto JSON.');
  }
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new ScheduleApiError(
      'La solicitud contiene campos no permitidos.',
      'SCHEDULE_UNKNOWN_FIELDS',
    );
  }
  return input;
}

export function assertScheduleSearchParams(searchParams, allowedFields) {
  for (const key of searchParams.keys()) {
    if (!allowedFields.has(key) || searchParams.getAll(key).length !== 1) {
      throw new ScheduleApiError(
        'La consulta contiene filtros no permitidos o duplicados.',
        'SCHEDULE_QUERY_INVALID',
      );
    }
  }
}

export function requireScheduleIdempotencyKey(request) {
  const key = String(request.headers.get('idempotency-key') || '').trim();
  if (!IDEMPOTENCY_KEY.test(key)) {
    throw new ScheduleApiError(
      'Enviá un encabezado Idempotency-Key válido de entre 8 y 128 caracteres.',
      'SCHEDULE_IDEMPOTENCY_KEY_INVALID',
    );
  }
  return key;
}

export function scheduleQueryValue(searchParams, key) {
  const value = searchParams.get(key);
  return value === null || value === '' ? undefined : value;
}

export function scheduleApiErrorResponse(error) {
  if (error instanceof ScheduleApiError) {
    return scheduleApiJson({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  return projectWritePolicyErrorResponse(error) || scheduleSnapshotErrorResponse(error);
}
