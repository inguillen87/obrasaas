import { Buffer } from 'node:buffer';

export const GOODS_RECEIPT_LIST_DEFAULT_LIMIT = 500;
export const GOODS_RECEIPT_LIST_MAX_LIMIT = 500;

const CURSOR_CONTRACT = 'goods-receipt-list:v1';
const CURSOR_MAX_LENGTH = 2_048;
const IDENTIFIER_MAX_LENGTH = 190;
const QUERY_FIELDS = new Set(['purchaseOrderId', 'status', 'cursor', 'limit']);
const STATUSES = new Set(['POSTED', 'VOIDED']);
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export class GoodsReceiptListQueryError extends Error {
  constructor(message, code = 'GOODS_RECEIPT_LIST_QUERY_INVALID') {
    super(message);
    this.name = 'GoodsReceiptListQueryError';
    this.code = code;
    this.status = 400;
  }
}

function invalid(message = 'La consulta de recepciones no es válida.') {
  throw new GoodsReceiptListQueryError(message);
}

function identifier(value, field, { optional = false } = {}) {
  if (value == null && optional) return null;
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > IDENTIFIER_MAX_LENGTH
    || value !== value.trim()
  ) {
    return invalid(`${field} no es válido.`);
  }
  return value;
}

function singleQueryValue(searchParams, field) {
  const values = searchParams.getAll(field);
  if (values.length > 1) invalid(`El filtro ${field} no puede repetirse.`);
  return values[0] ?? null;
}

function pageLimit(value) {
  if (value == null) return GOODS_RECEIPT_LIST_DEFAULT_LIMIT;
  if (!/^[1-9]\d{0,2}$/.test(value)) invalid('limit no es válido.');
  const parsed = Number(value);
  if (parsed < 1 || parsed > GOODS_RECEIPT_LIST_MAX_LIMIT) {
    invalid(`limit debe estar entre 1 y ${GOODS_RECEIPT_LIST_MAX_LIMIT}.`);
  }
  return parsed;
}

function cursorPayload({ scope, purchaseOrderId, status, receivedAt, id }) {
  return [
    CURSOR_CONTRACT,
    scope.organizationId,
    scope.projectId,
    purchaseOrderId,
    status,
    receivedAt,
    id,
  ];
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(rawCursor, { scope, purchaseOrderId, status }) {
  if (rawCursor == null) return null;
  if (
    typeof rawCursor !== 'string'
    || rawCursor.length === 0
    || rawCursor.length > CURSOR_MAX_LENGTH
    || !BASE64URL.test(rawCursor)
  ) {
    return invalid('cursor no es válido.');
  }
  try {
    const payload = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
    if (
      !Array.isArray(payload)
      || payload.length !== 7
      || encodePayload(payload) !== rawCursor
    ) {
      return invalid('cursor no es canónico.');
    }
    const [contract, organizationId, projectId, cursorOrderId, cursorStatus, receivedAt, id] = payload;
    const parsedDate = new Date(receivedAt);
    if (
      contract !== CURSOR_CONTRACT
      || organizationId !== scope.organizationId
      || projectId !== scope.projectId
      || cursorOrderId !== purchaseOrderId
      || cursorStatus !== status
      || typeof receivedAt !== 'string'
      || Number.isNaN(parsedDate.getTime())
      || parsedDate.toISOString() !== receivedAt
    ) {
      return invalid('cursor no corresponde a esta consulta.');
    }
    return {
      receivedAt: parsedDate,
      id: identifier(id, 'cursor.id'),
    };
  } catch (error) {
    if (error instanceof GoodsReceiptListQueryError) throw error;
    return invalid('cursor no es válido.');
  }
}

export function parseGoodsReceiptListQuery(requestUrl, rawScope) {
  const scope = {
    organizationId: identifier(rawScope?.organizationId, 'organizationId'),
    projectId: identifier(rawScope?.projectId, 'projectId'),
  };
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return invalid('La URL de consulta no es válida.');
  }
  for (const field of url.searchParams.keys()) {
    if (!QUERY_FIELDS.has(field)) invalid(`El filtro ${field} no está permitido.`);
  }
  const purchaseOrderId = identifier(
    singleQueryValue(url.searchParams, 'purchaseOrderId'),
    'purchaseOrderId',
    { optional: true },
  );
  const status = singleQueryValue(url.searchParams, 'status');
  if (status != null && !STATUSES.has(status)) invalid('status no es válido.');
  const limit = pageLimit(singleQueryValue(url.searchParams, 'limit'));
  const cursor = decodeCursor(singleQueryValue(url.searchParams, 'cursor'), {
    scope,
    purchaseOrderId,
    status,
  });
  return { scope, purchaseOrderId, status, limit, cursor };
}

export function goodsReceiptListWhere(query) {
  return {
    organizationId: query.scope.organizationId,
    projectId: query.scope.projectId,
    ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.cursor ? {
      OR: [
        { receivedAt: { lt: query.cursor.receivedAt } },
        {
          receivedAt: query.cursor.receivedAt,
          id: { lt: query.cursor.id },
        },
      ],
    } : {}),
  };
}

export function encodeGoodsReceiptListCursor(row, query) {
  const receivedAt = row?.receivedAt instanceof Date
    ? row.receivedAt.toISOString()
    : row?.receivedAt;
  if (
    typeof receivedAt !== 'string'
    || Number.isNaN(new Date(receivedAt).getTime())
    || new Date(receivedAt).toISOString() !== receivedAt
  ) {
    return invalid('La recepción no tiene una fecha cursorable.');
  }
  return encodePayload(cursorPayload({
    scope: query.scope,
    purchaseOrderId: query.purchaseOrderId,
    status: query.status,
    receivedAt,
    id: identifier(row?.id, 'receipt.id'),
  }));
}

export function goodsReceiptListQueryErrorResponse(error) {
  if (!(error instanceof GoodsReceiptListQueryError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    {
      status: error.status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
