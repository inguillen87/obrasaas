import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { CashMovementError, cashMovementErrorResponse, createCashFund, listCashFunds } from '@/lib/cash-movements';

function known(error) { if (error instanceof AccessError) return accessErrorResponse(error); if (error instanceof RequestBodyError) return requestBodyErrorResponse(error); return projectWritePolicyErrorResponse(error) || cashMovementErrorResponse(error); }

export async function GET() { try { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); return Response.json(await listCashFunds(getPrisma(), { projectId: access.project.id }), { headers: { 'Cache-Control': 'private, no-store' } }); } catch (error) { return known(error) || Response.json({ error: 'No se pudieron cargar los fondos.', code: 'CASH_FUNDS_READ_FAILED' }, { status: 500 }); } }

export async function POST(request) { try { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' }); const input = await readJsonRequest(request, { maxBytes: 16 * 1024 }); return Response.json(await createCashFund(getPrisma(), { scope: { organizationId: access.organization.id, projectId: access.project.id }, actorId: access.databaseUserId, input }), { status: 201 }); } catch (error) { return known(error) || Response.json({ error: 'No se pudo crear el fondo.', code: 'CASH_FUND_CREATE_FAILED' }, { status: 500 }); } }
