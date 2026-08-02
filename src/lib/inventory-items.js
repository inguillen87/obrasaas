import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import { runOperationalProjectMutation } from './project-write-policy.js';

const MAX_ACTIVE_ITEMS = 500;
export const INVENTORY_ITEM_LIST_DEFAULT_LIMIT = 100;
export const INVENTORY_ITEM_LIST_MAX_LIMIT = 200;

const CODE_PATTERN = /^[A-Z0-9]+(?:[._-][A-Z0-9]+)*$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const UNIQUE_CONFLICT_CODES = new Set(['P2002', '23505']);
const LIST_QUERY_FIELDS = new Set(['active', 'cursor', 'limit']);
const LIST_CURSOR_CONTRACT = 'inventory-item-list:v1';
const LIST_CURSOR_MAX_LENGTH = 2_048;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export class InventoryItemError extends Error {
  constructor(message, code = 'INVENTORY_ITEM_INVALID', status = 400) {
    super(message);
    this.name = 'InventoryItemError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field, max) {
  if (typeof value !== 'string') {
    throw new InventoryItemError(`${field} debe ser texto.`);
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new InventoryItemError(`${field} es inválido.`);
  }
  return normalized;
}

function contractualText(value, field, max) {
  if (typeof value !== 'string') {
    throw new InventoryItemError(`${field} debe ser texto.`);
  }
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new InventoryItemError(`${field} es inválido.`);
  }
  return normalized;
}

function scope(value) {
  return {
    organizationId: text(value?.organizationId, 'organizationId', 190),
    projectId: text(value?.projectId, 'projectId', 190),
  };
}

function strictIdentifier(value, field, max = 190) {
  if (
    typeof value !== 'string'
    || !value
    || value.length > max
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new InventoryItemError(
      `${field} es inválido.`,
      'INVENTORY_ITEM_CURSOR_INVALID',
      400,
    );
  }
  return value;
}

function canonicalCode(value, field, max) {
  const normalized = text(value, field, max).toUpperCase();
  if (!CODE_PATTERN.test(normalized)) {
    throw new InventoryItemError(
      `${field} admite letras, números y separadores internos ., _ o -.`,
      'INVENTORY_ITEM_CODE_INVALID',
      400,
    );
  }
  return normalized;
}

function strictCursorCode(value) {
  const normalized = canonicalCode(value, 'cursor.code', 32);
  if (normalized !== value) {
    throw new InventoryItemError(
      'cursor no es canónico.',
      'INVENTORY_ITEM_CURSOR_INVALID',
      400,
    );
  }
  return normalized;
}

function singleQueryValue(searchParams, field) {
  const values = searchParams.getAll(field);
  if (values.length > 1) {
    throw new InventoryItemError(
      `El filtro ${field} no puede repetirse.`,
      'INVENTORY_ITEM_QUERY_INVALID',
      400,
    );
  }
  return values[0] ?? null;
}

function inventoryItemPageLimit(value) {
  if (value == null) return INVENTORY_ITEM_LIST_DEFAULT_LIMIT;
  if (!/^[1-9]\d{0,2}$/.test(value)) {
    throw new InventoryItemError(
      'limit no es válido.',
      'INVENTORY_ITEM_LIMIT_INVALID',
      400,
    );
  }
  const parsed = Number(value);
  if (parsed > INVENTORY_ITEM_LIST_MAX_LIMIT) {
    throw new InventoryItemError(
      `limit debe estar entre 1 y ${INVENTORY_ITEM_LIST_MAX_LIMIT}.`,
      'INVENTORY_ITEM_LIMIT_INVALID',
      400,
    );
  }
  return parsed;
}

function encodeInventoryItemCursorPayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function inventoryItemCursorScope(current) {
  return createHash('sha256')
    .update([
      LIST_CURSOR_CONTRACT,
      current.organizationId,
      current.projectId,
      'all',
    ].join('\u0000'))
    .digest('base64url');
}

function inventoryItemCursorPayload(current, row) {
  return [
    LIST_CURSOR_CONTRACT,
    inventoryItemCursorScope(current),
    'all',
    strictCursorCode(row?.code),
    strictIdentifier(row?.id, 'cursor.id'),
  ];
}

function encodeInventoryItemCursor(current, row) {
  return encodeInventoryItemCursorPayload(inventoryItemCursorPayload(current, row));
}

function decodeInventoryItemCursor(rawCursor, current) {
  if (rawCursor == null) return null;
  if (
    typeof rawCursor !== 'string'
    || !rawCursor
    || rawCursor.length > LIST_CURSOR_MAX_LENGTH
    || !BASE64URL_PATTERN.test(rawCursor)
  ) {
    throw new InventoryItemError(
      'cursor no es válido.',
      'INVENTORY_ITEM_CURSOR_INVALID',
      400,
    );
  }
  try {
    const payload = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
    if (
      !Array.isArray(payload)
      || payload.length !== 5
      || encodeInventoryItemCursorPayload(payload) !== rawCursor
    ) {
      throw new InventoryItemError(
        'cursor no es canónico.',
        'INVENTORY_ITEM_CURSOR_INVALID',
        400,
      );
    }
    const [contract, cursorScope, active, code, id] = payload;
    if (
      contract !== LIST_CURSOR_CONTRACT
      || cursorScope !== inventoryItemCursorScope(current)
      || active !== 'all'
    ) {
      throw new InventoryItemError(
        'cursor no corresponde a esta consulta.',
        'INVENTORY_ITEM_CURSOR_SCOPE_MISMATCH',
        400,
      );
    }
    return {
      code: strictCursorCode(code),
      id: strictIdentifier(id, 'cursor.id'),
    };
  } catch (error) {
    if (error instanceof InventoryItemError) throw error;
    throw new InventoryItemError(
      'cursor no es válido.',
      'INVENTORY_ITEM_CURSOR_INVALID',
      400,
    );
  }
}

function normalizedInventoryItemCursor(value) {
  if (value == null) return null;
  if (
    typeof value !== 'object'
    || Array.isArray(value)
    || Object.keys(value).length !== 2
    || !Object.hasOwn(value, 'code')
    || !Object.hasOwn(value, 'id')
  ) {
    throw new InventoryItemError(
      'cursor es inválido.',
      'INVENTORY_ITEM_CURSOR_INVALID',
      400,
    );
  }
  return {
    code: strictCursorCode(value.code),
    id: strictIdentifier(value.id, 'cursor.id'),
  };
}

function normalizedInventoryItemPageLimit(value) {
  if (value == null) return INVENTORY_ITEM_LIST_DEFAULT_LIMIT;
  if (
    !Number.isInteger(value)
    || value < 1
    || value > INVENTORY_ITEM_LIST_MAX_LIMIT
  ) {
    throw new InventoryItemError(
      `limit debe estar entre 1 y ${INVENTORY_ITEM_LIST_MAX_LIMIT}.`,
      'INVENTORY_ITEM_LIMIT_INVALID',
      400,
    );
  }
  return value;
}

export function parseInventoryItemListQuery(requestUrl, rawScope) {
  const current = scope(rawScope);
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    throw new InventoryItemError(
      'La URL del catálogo es inválida.',
      'INVENTORY_ITEM_QUERY_INVALID',
      400,
    );
  }
  for (const field of url.searchParams.keys()) {
    if (!LIST_QUERY_FIELDS.has(field)) {
      throw new InventoryItemError(
        `El filtro ${field} no está permitido.`,
        'INVENTORY_ITEM_QUERY_INVALID',
        400,
      );
    }
  }

  const active = singleQueryValue(url.searchParams, 'active');
  const rawCursor = singleQueryValue(url.searchParams, 'cursor');
  const rawLimit = singleQueryValue(url.searchParams, 'limit');
  if (active !== null && active !== 'true' && active !== 'all') {
    throw new InventoryItemError(
      'active admite únicamente true o all.',
      'INVENTORY_ITEM_ACTIVE_FILTER_INVALID',
      400,
    );
  }
  if (active !== 'all') {
    if (rawCursor !== null || rawLimit !== null) {
      throw new InventoryItemError(
        'cursor y limit requieren active=all.',
        'INVENTORY_ITEM_PAGINATION_REQUIRES_ALL',
        400,
      );
    }
    return { scope: current, includeInactive: false };
  }
  return {
    scope: current,
    includeInactive: true,
    cursor: decodeInventoryItemCursor(rawCursor, current),
    limit: inventoryItemPageLimit(rawLimit),
  };
}

function operationKey(value) {
  if (typeof value !== 'string') {
    throw new InventoryItemError(
      'Idempotency-Key es obligatorio.',
      'INVENTORY_ITEM_IDEMPOTENCY_KEY_REQUIRED',
      400,
    );
  }
  const normalized = value.trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new InventoryItemError(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'INVENTORY_ITEM_IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  return normalized;
}

function normalizeCreateInput(input, rawOperationKey) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InventoryItemError('El cuerpo debe ser un objeto JSON.');
  }
  const allowedFields = new Set(['code', 'name', 'baseUnit']);
  if (
    Object.keys(input).length !== allowedFields.size
    || Object.keys(input).some((field) => !allowedFields.has(field))
  ) {
    throw new InventoryItemError(
      'El cuerpo admite únicamente code, name y baseUnit.',
      'INVENTORY_ITEM_FIELDS_INVALID',
      400,
    );
  }
  const normalized = {
    operationKey: operationKey(rawOperationKey),
    code: canonicalCode(input.code, 'code', 32),
    name: text(input.name, 'name', 160),
    // Units are a contractual identity shared with PurchaseOrderLine. Preserve
    // their spelling instead of silently changing case or symbols.
    baseUnit: contractualText(input.baseUnit, 'baseUnit', 32),
  };
  return {
    ...normalized,
    requestFingerprint: createHash('sha256').update(JSON.stringify({
      code: normalized.code,
      name: normalized.name,
      baseUnit: normalized.baseUnit,
    })).digest('hex'),
  };
}

function serializeInventoryItem(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    baseUnit: row.baseUnit,
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
    return new InventoryItemError(
      'Ya existe un material con ese código en la obra.',
      'INVENTORY_ITEM_CODE_CONFLICT',
      409,
    );
  }
  if (error?.code === 'P2034') {
    return new InventoryItemError(
      'El catálogo cambió concurrentemente. Recargá antes de reintentar.',
      'INVENTORY_ITEM_WRITE_CONFLICT',
      409,
    );
  }
  return null;
}

export async function listInventoryItems(prisma, {
  scope: rawScope,
  includeInactive = false,
  cursor: rawCursor = null,
  limit: rawLimit,
} = {}) {
  const current = scope(rawScope);
  if (typeof includeInactive !== 'boolean') {
    throw new InventoryItemError('includeInactive es inválido.');
  }
  if (!includeInactive && (rawCursor !== null || rawLimit !== undefined)) {
    throw new InventoryItemError(
      'cursor y limit requieren includeInactive=true.',
      'INVENTORY_ITEM_PAGINATION_REQUIRES_ALL',
      400,
    );
  }
  const cursor = includeInactive ? normalizedInventoryItemCursor(rawCursor) : null;
  const limit = includeInactive
    ? normalizedInventoryItemPageLimit(rawLimit)
    : MAX_ACTIVE_ITEMS;
  const rows = await prisma.inventoryItem.findMany({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      ...(!includeInactive ? { active: true } : {}),
      ...(cursor ? {
        OR: [
          { code: { gt: cursor.code } },
          { code: cursor.code, id: { gt: cursor.id } },
        ],
      } : {}),
    },
    orderBy: [{ code: 'asc' }, { id: 'asc' }],
    take: limit + 1,
  });
  if (!includeInactive && rows.length > MAX_ACTIVE_ITEMS) {
    throw new InventoryItemError(
      'La obra tiene más de 500 materiales activos y requiere corrección administrativa.',
      'INVENTORY_ITEM_ACTIVE_LIMIT_CORRUPT',
      409,
    );
  }
  const page = rows.slice(0, limit);
  if (!includeInactive) {
    return {
      items: page.map(serializeInventoryItem),
      hasMore: false,
    };
  }
  const hasMore = rows.length > limit;
  return {
    items: page.map(serializeInventoryItem),
    hasMore,
    nextCursor: hasMore && page.length
      ? encodeInventoryItemCursor(current, page.at(-1))
      : null,
  };
}

export async function createInventoryItem(prisma, {
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
          action: 'inventory_item.created',
          entityType: 'InventoryItem',
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
          throw new InventoryItemError(
            'El Idempotency-Key ya fue usado con otro contenido.',
            'IDEMPOTENCY_REPLAY_MUTATED',
            409,
          );
        }
        const replay = await transaction.inventoryItem.findFirst({
          where: {
            id: replayLog.entityId || '',
            organizationId: current.organizationId,
            projectId: current.projectId,
          },
        });
        if (!replay) {
          throw new InventoryItemError(
            'El replay no coincide con un material vigente de la obra.',
            'INVENTORY_ITEM_REPLAY_INCONSISTENT',
            409,
          );
        }
        return { item: serializeInventoryItem(replay), replayed: true };
      }

      const activeItemCount = await transaction.inventoryItem.count({
        where: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          active: true,
        },
      });
      if (activeItemCount >= MAX_ACTIVE_ITEMS) {
        throw new InventoryItemError(
          `La obra alcanzó el máximo de ${MAX_ACTIVE_ITEMS} materiales activos.`,
          'INVENTORY_ITEM_ACTIVE_LIMIT',
          409,
        );
      }

      const created = await transaction.inventoryItem.create({
        data: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          code: normalized.code,
          name: normalized.name,
          baseUnit: normalized.baseUnit,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: current.organizationId,
          actorId: actor,
          action: 'inventory_item.created',
          entityType: 'InventoryItem',
          entityId: created.id,
          metadata: {
            projectId: current.projectId,
            operationKey: normalized.operationKey,
            requestFingerprint: normalized.requestFingerprint,
            code: normalized.code,
            baseUnit: normalized.baseUnit,
          },
        },
      });
      return { item: serializeInventoryItem(created), replayed: false };
    });
  } catch (error) {
    if (error instanceof InventoryItemError) throw error;
    throw governedDatabaseConflict(error) || error;
  }
}

export function inventoryItemErrorResponse(error) {
  if (!(error instanceof InventoryItemError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    {
      status: error.status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
