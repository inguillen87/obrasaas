import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import {
  createGoodsReceipt,
  goodsReceiptErrorResponse,
  listGoodsReceiptLineBalances,
  serializeGoodsReceipt,
} from '@/lib/goods-receipts';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { protectedUploadErrorResponse } from '@/lib/protected-uploads';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { resolveRequestCorrelationId, withCorrelationId } from '@/lib/request-correlation';

import {
  encodeGoodsReceiptListCursor,
  goodsReceiptListQueryErrorResponse,
  goodsReceiptListWhere,
  parseGoodsReceiptListQuery,
} from './pagination.js';

function respond(request, response) {
  return withCorrelationId(response, resolveRequestCorrelationId(request));
}

function known(request, error) {
  if (error instanceof AccessError) return respond(request, accessErrorResponse(error));
  if (error instanceof RequestBodyError) return respond(request, requestBodyErrorResponse(error));
  const domain = projectWritePolicyErrorResponse(error)
    || protectedUploadErrorResponse(error)
    || goodsReceiptErrorResponse(error)
    || goodsReceiptListQueryErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, { maxBytes: 32 * 1024 });
    const result = await createGoodsReceipt(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      input,
    });
    return respond(request, Response.json(result, { status: 201 }));
  } catch (error) {
    return known(request, error)
      || respond(request, Response.json({ error: 'No se pudo registrar recepción.', code: 'GOODS_RECEIPT_CREATE_FAILED' }, { status: 500 }));
  }
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const query = parseGoodsReceiptListQuery(request.url, {
      organizationId: access.organization.id,
      projectId: access.project.id,
    });
    const prisma = getPrisma();
    const balanceOrderIds = query.purchaseOrderId
      ? [query.purchaseOrderId]
      : (await prisma.purchaseOrder.findMany({
          where: {
            organizationId: access.organization.id,
            projectId: access.project.id,
          },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        })).map((order) => order.id);
    const [rows, lineBalances] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where: goodsReceiptListWhere(query),
        include: {
          purchaseOrder: { select: { id: true, number: true } },
          lines: {
            include: {
              purchaseOrderLine: {
                select: { id: true, description: true, unit: true },
              },
            },
          },
        },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      }),
      listGoodsReceiptLineBalances(prisma, {
        organizationId: access.organization.id,
        projectId: access.project.id,
        purchaseOrderIds: balanceOrderIds,
      }),
    ]);
    const page = rows.slice(0, query.limit);
    const hasMore = rows.length > query.limit;
    return respond(request, Response.json(
      {
        receipts: page.map(serializeGoodsReceipt),
        hasMore,
        nextCursor: hasMore && page.length
          ? encodeGoodsReceiptListCursor(page[page.length - 1], query)
          : null,
        lineBalances,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    ));
  } catch (error) {
    return known(request, error)
      || respond(request, Response.json({ error: 'No se pudieron cargar recepciones.', code: 'GOODS_RECEIPT_READ_FAILED' }, { status: 500 }));
  }
}
