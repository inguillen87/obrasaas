import { getAppState, saveAppState } from '@/lib/db';
import { verifyApiAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/tenants — List all tenants (super-admin only)
export async function GET(request) {
    const authError = verifyApiAuth(request);
    if (authError) return authError;

    try {
        const state = await getAppState();
        const tenants = state.tenants || [
            {
                id: 'tenant-default',
                name: 'ObraSaaS Demo',
                slug: 'demo',
                plan: 'professional',
                ownerEmail: 'marcelo@obrasaas.app',
                ownerPhone: '5492613168608',
                createdAt: '2026-01-15',
                projectCount: (state.projects || []).length,
                workerCount: (state.workerRegistry || []).length,
                status: 'active'
            }
        ];

        // Enrich with computed stats
        const enriched = tenants.map(t => ({
            ...t,
            projectCount: t.projectCount || (state.projects || []).length,
            workerCount: t.workerCount || (state.workerRegistry || []).length,
            lastActivity: t.lastActivity || new Date().toISOString()
        }));

        return Response.json({ tenants: enriched, total: enriched.length });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/admin/tenants — Create a new tenant
export async function POST(request) {
    const authError = verifyApiAuth(request);
    if (authError) return authError;

    try {
        const body = await request.json();
        const { name, slug, plan, ownerEmail, ownerPhone } = body;

        if (!name || !slug) {
            return Response.json({ error: 'name and slug are required' }, { status: 400 });
        }

        const state = await getAppState();
        state.tenants = state.tenants || [];

        // Check slug uniqueness
        if (state.tenants.some(t => t.slug === slug)) {
            return Response.json({ error: 'Slug already exists' }, { status: 409 });
        }

        const newTenant = {
            id: `tenant-${Date.now().toString(36)}`,
            name,
            slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            plan: plan || 'starter',
            ownerEmail: ownerEmail || '',
            ownerPhone: ownerPhone || '',
            createdAt: new Date().toISOString(),
            projectCount: 0,
            workerCount: 0,
            status: 'active'
        };

        state.tenants.push(newTenant);
        await saveAppState(state);

        return Response.json({ tenant: newTenant }, { status: 201 });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
