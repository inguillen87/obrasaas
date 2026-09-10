// ObraSaaS Prisma Database Client & Relational Sync Adapter
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = global;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
  if (!connectionString) {
    return new PrismaClient();
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

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

    const rawPlan = (state.subscription?.plan || '').toUpperCase();
    const mappedPlan = rawPlan === 'PRO' || rawPlan === 'PROFESSIONAL' ? 'PROFESSIONAL' :
                       rawPlan === 'ENTERPRISE' ? 'ENTERPRISE' :
                       rawPlan === 'GOVERNMENT' ? 'GOVERNMENT' : 'STARTER';

    // 1. Try Upsert Tenant (if schema applied)
    let tenant = null;
    try {
      tenant = await prisma.tenant.upsert({
        where: { slug: tenantSlug },
        update: {
          name: tenantName,
          plan: mappedPlan,
          config: state.projectConfig || {}
        },
        create: {
          name: tenantName,
          slug: tenantSlug,
          plan: mappedPlan,
          ownerEmail: state.projectConfig?.directorEmail || 'marcelo@obrasaas.app',
          ownerPhone: state.projectConfig?.directorPhone || '5492613168608',
          config: state.projectConfig || {}
        }
      });
    } catch (tErr) {
      // Tenant table not yet migrated, continue
    }

    if (!tenant) {
      return { success: true, reason: 'Tenant table not active, state safely stored in obrasaas_app_state' };
    }

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
      }).catch(() => null);

      // Sync ART policy
      if (worker) {
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
      }).catch(() => {});
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
      }).catch(() => {});
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
    return { success: false, error: err.message };
  }
}
