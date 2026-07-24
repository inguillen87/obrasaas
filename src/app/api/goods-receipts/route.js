import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { createGoodsReceipt, goodsReceiptErrorResponse } from '@/lib/goods-receipts';
function known(error) { if (error instanceof AccessError) return accessErrorResponse(error); if (error instanceof RequestBodyError) return requestBodyErrorResponse(error); return goodsReceiptErrorResponse(error); }
export async function POST(request) { try { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' }); const input = await readJsonRequest(request, { maxBytes: 32 * 1024 }); return Response.json(await createGoodsReceipt(getPrisma(), { scope: { organizationId: access.organization.id, projectId: access.project.id }, actorId: access.databaseUserId, input }), { status: 201 }); } catch (error) { return known(error) || Response.json({ error: 'No se pudo registrar recepción.', code: 'GOODS_RECEIPT_CREATE_FAILED' }, { status: 500 }); } }
