import { createHash } from 'node:crypto';

import { runOperationalProjectMutation } from './project-write-policy.js';

const MAX_LOCATIONS = 100;
const CODE_PATTERN = /^[A-Z0-9]+(?:[._-][A-Z0-9]+)*$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const UNIQUE_CONFLICT_CODES = new Set(['P2002', '23505']);

export class InventoryLocationError extends Error {
  constructor(message, code = 'INVENTORY_LOCATION_INVALID', status = 400) {
    super(message);
    this.name = 'InventoryLocationError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field, max) {
  if (typeof value !== 'string') {
    throw new InventoryLocationError(`${field} debe ser texto.`);
  }
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new InventoryLocationError(`${field} es inválido.`);
  }
  return normalized;
}

function scope(value) {
  return {
    organizationId: text(value?.organizationId, 'organizationId', 190),
    projectId: text(value?.projectId, 'projectId', 190),
  };
}

function code(value) {
  const normalized = text(value, 'code', 32).toUpperCase();
  if (!CODE_PATTERN.test(normalized)) {
    throw new InventoryLocationError(
      'code admite letras, números y separadores internos ., _ o -.',
      'INVENTORY_LOCATION_CODE_INVALID',
      400,
    );
  }
  return normalized;
}

function operationKey(value) {
  if (typeof value !== 'string') {
    throw new InventoryLocationError(
      'Idempotency-Key es obligatorio.',
      'INVENTORY_LOCATION_IDEMPOTENCY_KEY_REQUIRED',
      400,
    );
  }
  const normalized = value.trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new InventoryLocationError(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'INVENTORY_LOCATION_IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  return normalized;
}

function normalizeCreateInput(input, rawOperationKey) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InventoryLocationError('El cuerpo debe ser un objeto JSON.');
  }
  const allowedFields = new Set(['code', 'name']);
  if (
    Object.keys(input).length !== allowedFields.size
    || Object.keys(input).some((field) => !allowedFields.has(field))
  ) {
    throw new InventoryLocationError(
      'El cuerpo admite únicamente code y name.',
      'INVENTORY_LOCATION_FIELDS_INVALID',
      400,
    );
  }
  const normalized = {
    operationKey: operationKey(rawOperationKey),
    code: code(input.code),
    name: text(input.name, 'name', 160),
  };
  return {
    ...normalized,
    requestFingerprint: createHash('sha256').update(JSON.stringify({
      code: normalized.code,
      name: normalized.name,
    })).digest('hex'),
  };
}

function serializeInventoryLocation(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.active,
    revision: row.revision,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null,
  };
}

function auditMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function governedDatabaseConflict(error) {
  if (UNIQUE_CONFLICT_CODES.has(error?.code)) {
    return new InventoryLocationError(
      'Ya existe una ubicación con ese código en la obra.',
      'INVENTORY_LOCATION_CODE_CONFLICT',
      409,
    );
  }
  if (error?.code === 'P2034') {
    return new InventoryLocationError(
      'La ubicación cambió concurrentemente. Recargá antes de reintentar.',
      'INVENTORY_LOCATION_WRITE_CONFLICT',
      409,
    );
  }
  return null;
}

export async function listInventoryLocations(prisma, {
  scope: rawScope,
  includeInactive = false,
} = {}) {
  const current = scope(rawScope);
  if (typeof includeInactive !== 'boolean') {
    throw new InventoryLocationError('includeInactive es inválido.');
  }
  const rows = await prisma.inventoryLocation.findMany({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      ...(!includeInactive ? { active: true } : {}),
    },
    orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
    take: MAX_LOCATIONS + 1,
  });
  if (!includeInactive && rows.length > MAX_LOCATIONS) {
    throw new InventoryLocationError(
      'La obra tiene más de 100 ubicaciones activas y requiere corrección administrativa.',
      'INVENTORY_LOCATION_ACTIVE_LIMIT_CORRUPT',
      409,
    );
  }
  return {
    locations: rows.slice(0, MAX_LOCATIONS).map(serializeInventoryLocation),
    hasMore: includeInactive && rows.length > MAX_LOCATIONS,
  };
}

export async function createInventoryLocation(prisma, {
  scope: rawScope,
  actorId,
  operationKey: rawOperationKey,
  input,
} = {}) {
  const current = scope(rawScope);
  const actor = text(actorId, 'actorId', 190);
  const normalized = normalizeCreateInput(input, rawOperationKey);

  try {
    return await runOperationalProjectMutation(prisma, current, async (transaction) => {
      const replayLog = await transaction.auditLog.findFirst({
        where: {
          organizationId: current.organizationId,
          action: 'inventory_location.created',
          entityType: 'InventoryLocation',
          AND: [
            { metadata: { path: ['projectId'], equals: current.projectId } },
            { metadata: { path: ['operationKey'], equals: normalized.operationKey } },
          ],
        },
        select: { entityId: true, metadata: true },
        orderBy: { createdAt: 'desc' },
      });
      if (replayLog) {
        const metadata = auditMetadata(replayLog.metadata);
        if (metadata.requestFingerprint !== normalized.requestFingerprint) {
          throw new InventoryLocationError(
            'El Idempotency-Key ya fue usado con otro contenido.',
            'IDEMPOTENCY_REPLAY_MUTATED',
            409,
          );
        }
        const replay = await transaction.inventoryLocation.findFirst({
          where: {
            id: replayLog.entityId || '',
            organizationId: current.organizationId,
            projectId: current.projectId,
          },
        });
        if (!replay) {
          throw new InventoryLocationError(
            'El replay no coincide con una ubicación vigente de la obra.',
            'INVENTORY_LOCATION_REPLAY_INCONSISTENT',
            409,
          );
        }
        return { location: serializeInventoryLocation(replay), replayed: true };
      }

      const activeLocationCount = await transaction.inventoryLocation.count({
        where: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          active: true,
        },
      });
      if (activeLocationCount >= MAX_LOCATIONS) {
        throw new InventoryLocationError(
          `La obra alcanzó el máximo de ${MAX_LOCATIONS} ubicaciones activas.`,
          'INVENTORY_LOCATION_ACTIVE_LIMIT',
          409,
        );
      }

      const created = await transaction.inventoryLocation.create({
        data: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          code: normalized.code,
          name: normalized.name,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: current.organizationId,
          actorId: actor,
          action: 'inventory_location.created',
          entityType: 'InventoryLocation',
          entityId: created.id,
          metadata: {
            projectId: current.projectId,
            operationKey: normalized.operationKey,
            requestFingerprint: normalized.requestFingerprint,
            code: normalized.code,
          },
        },
      });
      return { location: serializeInventoryLocation(created), replayed: false };
    });
  } catch (error) {
    if (error instanceof InventoryLocationError) throw error;
    throw governedDatabaseConflict(error) || error;
  }
}

export function inventoryLocationErrorResponse(error) {
  if (!(error instanceof InventoryLocationError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    {
      status: error.status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
