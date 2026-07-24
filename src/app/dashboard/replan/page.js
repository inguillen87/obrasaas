import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { listExtraWork } from '@/lib/extra-work';
import { listReplanScenarios } from '@/lib/replan-scenarios';
import ReplanClient from './replan-client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Escenarios de planificación', description: 'Comparación segura de impactos antes de aplicar cambios.' };
export default async function ReplanPage() { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); const prisma = getPrisma(); const [scenarios, extras] = await Promise.all([listReplanScenarios(prisma, { projectId: access.project.id }), listExtraWork(prisma, { projectId: access.project.id })]); return <ReplanClient initialScenarios={scenarios.scenarios} approvedExtras={extras.requests.filter((row) => row.status === 'APPROVED')} canManage={hasTenantPermission(access, 'org:execution:manage')} projectName={access.project.name} />; }
