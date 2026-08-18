// ObraSaaS Prisma Database Client & Relational Sync Adapter
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Migration helper to sync JSONB state into structured relational tables
 * @param {Object} state - JSONB state from obrasaas_app_state
 */
export async function syncStateToRelationalDb(state) {
  if (!state) return { success: false, reason: 'No state provided' };

  try {
    const tenantSlug = state.projectConfig?.tenantSlug || 'demo';
    const tenantName = state.projectConfig?.tenantName || 'ObraSaaS Demo';

    // 1. Upsert Tenant
    const tenant = await prisma.tenant.upsert({
      where: { slug: tenantSlug },
      update: {
        name: tenantName,
        plan: (state.subscription?.plan?.toUpperCase()) || 'PROFESSIONAL',
        config: state.projectConfig || {}
      },
      create: {
        name: tenantName,
        slug: tenantSlug,
        plan: 'PROFESSIONAL',
        ownerEmail: state.projectConfig?.directorEmail || 'marcelo@obrasaas.app',
        ownerPhone: state.projectConfig?.directorPhone || '5492613168608',
        config: state.projectConfig || {}
      }
    });

    // 2. Upsert Project
    const projectId = state.activeProjectId || 'obra-palermo-01';
    const project = await prisma.project.upsert({
      where: { id: projectId },
      update: {
        name: state.projectConfig?.name || 'Torre Palermo Soho',
        city: state.projectConfig?.city || 'CABA',
        province: state.projectConfig?.province || 'Buenos Aires',
        latitude: state.projectConfig?.latitude || -34.5886,
        longitude: state.projectConfig?.longitude || -58.4302,
        geofenceRadiusMeters: state.projectConfig?.geofenceRadiusMeters || 100,
        totalBudget: state.projectConfig?.totalBudget || 4995000
      },
      create: {
        id: projectId,
        tenantId: tenant.id,
        name: state.projectConfig?.name || 'Torre Palermo Soho',
        city: state.projectConfig?.city || 'CABA',
        province: state.projectConfig?.province || 'Buenos Aires',
        latitude: state.projectConfig?.latitude || -34.5886,
        longitude: state.projectConfig?.longitude || -58.4302,
        geofenceRadiusMeters: state.projectConfig?.geofenceRadiusMeters || 100,
        totalBudget: state.projectConfig?.totalBudget || 4995000
      }
    });

    // 3. Sync Workers & ART
    const workers = state.workerRegistry || [];
    for (const w of workers) {
      if (!w.id) continue;
      const worker = await prisma.worker.upsert({
        where: { id: w.id },
        update: {
          name: w.name,
          phone: w.phone || '',
          dni: w.dni || null,
          trade: w.trade || w.role || 'Albañilería',
          status: w.status || 'Activo',
          kycStatus: w.kycStatus === 'VERIFICADO' ? 'VERIFICADO' : 'PENDIENTE'
        },
        create: {
          id: w.id,
          tenantId: tenant.id,
          name: w.name,
          phone: w.phone || '',
          dni: w.dni || null,
          trade: w.trade || w.role || 'Albañilería',
          status: w.status || 'Activo',
          kycStatus: w.kycStatus === 'VERIFICADO' ? 'VERIFICADO' : 'PENDIENTE'
        }
      });

      // Sync ART policy
      const art = state.artPolicies?.[w.name];
      if (art && art.policyNumber) {
        const expDate = art.expirationDate ? new Date(art.expirationDate) : new Date(Date.now() + 30*24*3600*1000);
        await prisma.aRTPolicy.create({
          data: {
            workerId: worker.id,
            company: art.company || 'La Segunda ART',
            policyNumber: art.policyNumber,
            expirationDate: expDate,
            status: art.status || 'VIGENTE'
          }
        }).catch(() => {});
      }
    }

    // 4. Sync Gantt Tasks
    const tasks = state.tasks || {};
    for (const [id, t] of Object.entries(tasks)) {
      await prisma.task.upsert({
        where: { id },
        update: {
          name: t.name,
          progress: t.progress || 0,
          quincena: t.quincena || 'Q1',
          startDay: t.start || 1,
          durationDays: t.duration || 7,
          status: t.progress === 100 ? 'COMPLETADA' : t.progress > 0 ? 'EN_PROCESO' : 'PENDIENTE'
        },
        create: {
          id,
          projectId: project.id,
          name: t.name,
          progress: t.progress || 0,
          quincena: t.quincena || 'Q1',
          startDay: t.start || 1,
          durationDays: t.duration || 7,
          status: t.progress === 100 ? 'COMPLETADA' : t.progress > 0 ? 'EN_PROCESO' : 'PENDIENTE'
        }
      });
    }

    // 5. Sync Budget Rubros
    const budgetRubros = state.budget?.rubros || [];
    for (const r of budgetRubros) {
      if (!r.id) continue;
      await prisma.budgetRubro.upsert({
        where: { id: r.id },
        update: {
          name: r.nombre || 'Rubro',
          presupuesto: r.presupuesto || 0,
          ejecutado: r.ejecutado || 0
        },
        create: {
          id: r.id,
          projectId: project.id,
          code: r.id,
          name: r.nombre || 'Rubro',
          presupuesto: r.presupuesto || 0,
          ejecutado: r.ejecutado || 0
        }
      });
    }

    return {
      success: true,
      tenantId: tenant.id,
      projectId: project.id,
      syncedWorkers: workers.length,
      syncedTasks: Object.keys(tasks).length,
      syncedRubros: budgetRubros.length
    };
  } catch (err) {
    console.error('Prisma relational sync error:', err.message);
    return { success: false, error: err.message };
  }
}
