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
import { getPool } from './db.js';

export async function syncStateToRelationalDb(state) {
  if (!state) return { success: false, reason: 'No state provided' };

  try {
    const p = getPool();
    if (!p) {
      return { success: true, reason: 'Local mode, DATABASE_URL not present' };
    }

    // 1. Get primary organization
    const orgRes = await p.query('SELECT id, name FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1');
    if (orgRes.rows.length === 0) {
      return { success: false, reason: 'No organization found in database' };
    }
    const org = orgRes.rows[0];

    // 2. Upsert Project
    const projSlug = 'palermo';
    const projName = state.projectConfig?.name || 'Torre Palermo Soho';
    const lat = state.projectConfig?.latitude || -34.5886;
    const lng = state.projectConfig?.longitude || -58.4302;
    const geofence = state.projectConfig?.geofenceRadiusMeters || 100;

    let projRes = await p.query('SELECT id FROM "Project" WHERE slug = $1 LIMIT 1', [projSlug]);
    let projectId;
    if (projRes.rows.length > 0) {
      projectId = projRes.rows[0].id;
      await p.query(`
        UPDATE "Project"
        SET name = $1, latitude = $2, longitude = $3, "geofenceMeters" = $4, "updatedAt" = NOW()
        WHERE id = $5
      `, [projName, lat, lng, geofence, projectId]);
    } else {
      const insertRes = await p.query(`
        INSERT INTO "Project" (id, "organizationId", name, slug, status, latitude, longitude, "geofenceMeters", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, NOW(), NOW())
        RETURNING id
      `, ['proj_' + Date.now(), org.id, projName, projSlug, lat, lng, geofence]);
      projectId = insertRes.rows[0].id;
    }

    // 3. Upsert Workers
    const workers = state.workerRegistry || [];
    let syncedWorkers = 0;
    for (const w of workers) {
      const workerId = 'wrk_' + (w.dni || w.id || w.name.toLowerCase().replace(/\s+/g, '_'));
      const phone = w.phone || '+5491155443322';
      const role = w.role || w.trade || 'Albañilería';
      const active = w.status !== 'Inactivo';
      const metadata = JSON.stringify({
        dni: w.dni,
        kycStatus: w.kycStatus || 'VERIFICADO',
        artPolicy: state.artPolicies?.[w.name] || null
      });

      await p.query(`
        INSERT INTO "Worker" (id, "projectId", "externalId", phone, name, role, active, metadata, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          role = EXCLUDED.role,
          active = EXCLUDED.active,
          metadata = EXCLUDED.metadata,
          "updatedAt" = NOW()
      `, [workerId, projectId, w.dni || w.id, phone, w.name, role, active, metadata]);
      syncedWorkers++;
    }

    // 4. Upsert Tasks
    const tasks = state.tasks || {};
    let syncedTasks = 0;
    for (const [taskId, t] of Object.entries(tasks)) {
      const dbTaskId = 'tsk_' + taskId;
      const progress = Math.min(100, Math.max(0, parseInt(t.progress) || 0));
      const status = progress === 100 ? 'DONE' : progress > 0 ? 'IN_PROGRESS' : 'READY';
      const assignee = t.assignee || 'Sin Asignar';
      const title = t.name || 'Tarea de Obra';
      const metadata = JSON.stringify({
        start: t.start,
        duration: t.duration,
        quincena: t.quincena || 'Q1'
      });

      await p.query(`
        INSERT INTO "Task" (id, "projectId", "externalId", title, description, status, progress, assignee, metadata, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6::"TaskStatus", $7, $8, $9, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          progress = EXCLUDED.progress,
          assignee = EXCLUDED.assignee,
          metadata = EXCLUDED.metadata,
          "updatedAt" = NOW()
      `, [dbTaskId, projectId, taskId, title, `Tarea quincenal para ${assignee}`, status, progress, assignee, metadata]);
      syncedTasks++;
    }

    // 5. Query verified counts
    const [wCount, tCount, pCount, oCount] = await Promise.all([
      p.query('SELECT count(*) FROM "Worker"'),
      p.query('SELECT count(*) FROM "Task"'),
      p.query('SELECT count(*) FROM "Project"'),
      p.query('SELECT count(*) FROM "Organization"')
    ]);

    return {
      success: true,
      organizationId: org.id,
      projectId,
      syncedWorkers,
      syncedTasks,
      databaseCounts: {
        organizations: parseInt(oCount.rows[0].count, 10),
        projects: parseInt(pCount.rows[0].count, 10),
        workers: parseInt(wCount.rows[0].count, 10),
        tasks: parseInt(tCount.rows[0].count, 10)
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
