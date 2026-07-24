import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { listBudgets } from '@/lib/budgets';
import { listBudgetEntries } from '@/lib/budget-entries';
import BudgetClient from './budget-client';
import LedgerSummary from './ledger-summary';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Presupuesto', description: 'Presupuesto versionado y auditable por obra.' };
export default async function BudgetsPage() { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); const prisma = getPrisma(); const [data, entries] = await Promise.all([listBudgets(prisma, { projectId: access.project.id }), listBudgetEntries(prisma, { projectId: access.project.id })]); return <><BudgetClient initialBudgets={data.budgets} canManage={hasTenantPermission(access, 'org:execution:manage')} projectName={access.project.name} /><LedgerSummary entries={entries.entries} /></>; }
