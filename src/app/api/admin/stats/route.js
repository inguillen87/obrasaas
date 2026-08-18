import { getAppState } from '@/lib/db';
import { verifyApiAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/stats — Platform-wide statistics for super-admin dashboard
export async function GET(request) {
    const { authorized, reason } = verifyApiAuth(request);
    if (!authorized) {
        return Response.json({ error: reason || 'Unauthorized' }, { status: 401 });
    }

    try {
        const state = await getAppState();
        
        const tenants = state.tenants || [];
        const projects = state.projects || [];
        const workers = state.workerRegistry || [];
        const incidents = state.incidents || [];
        const kycVerifications = Object.keys(state.kycVerifications || {}).length;
        const auditBlocks = (state.auditLedger || []).length;
        const messages = state.pendingRegistrations ? Object.keys(state.pendingRegistrations).length : 0;
        
        // Revenue estimation
        const activeTenants = tenants.filter(t => t.status === 'active').length || 1;
        const planPricing = { starter: 29, professional: 99, enterprise: 199 };
        const mrr = tenants.reduce((sum, t) => sum + (planPricing[t.plan] || 29), 0) || 29;
        
        // Worker status breakdown
        const activeWorkers = workers.filter(w => w.status?.includes('Activo')).length;
        const pendingWorkers = workers.filter(w => w.status?.includes('PRE-VERIFICADO')).length;
        const blockedWorkers = workers.filter(w => w.status?.includes('Bloqueado')).length;

        // Incident severity breakdown
        const criticalIncidents = incidents.filter(i => i.type === 'danger').length;
        const warningIncidents = incidents.filter(i => i.type === 'warning').length;
        const infoIncidents = incidents.filter(i => i.type === 'info').length;

        return Response.json({
            platform: {
                totalTenants: activeTenants,
                totalProjects: projects.length,
                totalWorkers: workers.length,
                activeWorkers,
                pendingWorkers,
                blockedWorkers,
                kycVerifications,
                auditBlocks,
                pendingRegistrations: messages,
                mrr,
                arr: mrr * 12
            },
            incidents: {
                total: incidents.length,
                critical: criticalIncidents,
                warning: warningIncidents,
                info: infoIncidents
            },
            growth: {
                newWorkersThisWeek: workers.filter(w => {
                    const reg = w.registeredAt ? new Date(w.registeredAt) : null;
                    if (!reg) return false;
                    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
                    return reg > weekAgo;
                }).length,
                newTenantsThisMonth: tenants.filter(t => {
                    const created = t.createdAt ? new Date(t.createdAt) : null;
                    if (!created) return false;
                    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
                    return created > monthAgo;
                }).length
            }
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
