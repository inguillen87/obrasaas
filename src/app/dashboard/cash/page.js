import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { listCashFunds, listCashMovements, cashBalance } from '@/lib/cash-movements';
import CashClient from './cash-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caja chica', description: 'Fondos y movimientos de caja chica auditables.' };

export default async function CashPage() { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); const prisma = getPrisma(); const funds = await listCashFunds(prisma, { projectId: access.project.id }); const movements = await listCashMovements(prisma, { projectId: access.project.id }); const balances = Object.fromEntries(await Promise.all(funds.funds.map(async (fund) => [fund.id, (await cashBalance(prisma, { projectId: access.project.id, fundId: fund.id })).balance]))); return <CashClient initialFunds={funds.funds} initialMovements={movements.movements} balances={balances} canManage={hasTenantPermission(access, 'org:execution:manage')} projectName={access.project.name} />; }
