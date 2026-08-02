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
  listUserNotifications,
  markNotificationRead,
  notificationOutboxErrorResponse,
} from '@/lib/notification-outbox';

const MAX_NOTIFICATION_READ_BODY_BYTES = 4_000;
const NOTIFICATION_READ_FIELDS = new Set(['id']);

function known(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  return notificationOutboxErrorResponse(error);
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const rows = await listUserNotifications(getPrisma(), {
      organizationId: access.organization.id,
      recipientId: access.databaseUserId,
      projectId: access.project.id,
      limit: new URL(request.url).searchParams.get('limit') || 50,
    });
    return Response.json({
      notifications: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        readAt: row.readAt?.toISOString() || null,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return known(error) || Response.json({
      error: 'No se pudieron cargar las notificaciones.',
      code: 'NOTIFICATIONS_READ_FAILED',
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const body = await readJsonRequest(request, {
      maxBytes: MAX_NOTIFICATION_READ_BODY_BYTES,
    });
    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || Object.keys(body).some((field) => !NOTIFICATION_READ_FIELDS.has(field))
      || typeof body.id !== 'string'
      || !body.id.trim()
    ) {
      return Response.json({
        error: 'id inválido.',
        code: 'NOTIFICATION_ID_INVALID',
      }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const result = await markNotificationRead(getPrisma(), {
      organizationId: access.organization.id,
      recipientId: access.databaseUserId,
      projectId: access.project.id,
      id: body.id,
    });
    return Response.json({
      marked: result.marked,
      replayed: result.replayed,
      readAt: result.readAt.toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return known(error) || Response.json({
      error: 'No se pudo marcar la notificación.',
      code: 'NOTIFICATION_READ_FAILED',
    }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
