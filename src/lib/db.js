// ObraSaaS Enterprise — Neon PostgreSQL Cloud Database Layer
// Connects natively to Neon Serverless PostgreSQL with automatic failover and relational sync

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { emitRealtimeUpdate } from './realtime.js';
import { defaultAppState, defaultMessages } from './defaultState.js';

// Re-export baseline seed templates for full backward compatibility
export { defaultAppState, defaultMessages };

// Global connection pool cache for Neon PostgreSQL
let pool = null;

export function getPool() {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
        return null;
    }

    if (!pool) {
        pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            console.warn('⚠️ Neon Postgres pool event:', err.message);
            pool = null;
        });
    }
    return pool;
}

// Local file fallback path (used in offline development if no internet or DATABASE_URL)
const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'db.json');

function initLocalDb() {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LOCAL_DB_PATH)) {
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({
            appState: defaultAppState,
            messages: defaultMessages
        }, null, 2));
    }
}

// Ensure Neon Postgres schema table exists
async function ensurePostgresTable(p) {
    try {
        await p.query(`
            CREATE TABLE IF NOT EXISTS obrasaas_app_state (
                id VARCHAR(50) PRIMARY KEY,
                state JSONB NOT NULL,
                messages JSONB NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
    } catch(e) {
        console.warn("⚠️ Neon table check notice:", e.message);
    }
}

/**
 * Health check for Neon PostgreSQL connection and state
 */
export async function getDatabaseHealth() {
    const p = getPool();
    const startTime = Date.now();
    
    if (!p) {
        return {
            status: 'LOCAL_FALLBACK',
            provider: 'Local JSON storage (DATABASE_URL not configured)',
            connected: false,
            latencyMs: 0,
            timestamp: new Date().toISOString()
        };
    }

    try {
        const { rows } = await p.query(`
            SELECT 
                NOW() as db_time,
                version() as db_version,
                (SELECT count(*) FROM obrasaas_app_state) as state_rows,
                (SELECT updated_at FROM obrasaas_app_state WHERE id = 'default') as last_state_update,
                (SELECT length(state::text) FROM obrasaas_app_state WHERE id = 'default') as state_bytes
        `);
        const latencyMs = Date.now() - startTime;
        const row = rows[0] || {};
        
        return {
            status: 'CONNECTED',
            provider: 'Neon Serverless PostgreSQL (AWS us-east-1)',
            host: process.env.DATABASE_URL?.match(/@([^/:]+)/)?.[1] || 'neon.tech',
            connected: true,
            latencyMs,
            dbTime: row.db_time,
            stateRows: parseInt(row.state_rows || '0', 10),
            lastUpdated: row.last_state_update || null,
            stateSizeBytes: parseInt(row.state_bytes || '0', 10),
            serverVersion: row.db_version ? row.db_version.split(' ')[0] + ' ' + row.db_version.split(' ')[1] : 'PostgreSQL'
        };
    } catch (err) {
        return {
            status: 'ERROR',
            provider: 'Neon Serverless PostgreSQL',
            connected: false,
            error: err.message,
            latencyMs: Date.now() - startTime
        };
    }
}

// Read database contents from Neon (with local dev fallback)
async function readDb() {
    const p = getPool();
    if (p) {
        try {
            await ensurePostgresTable(p);
            const { rows } = await p.query('SELECT state, messages FROM obrasaas_app_state WHERE id = $1', ['default']);
            if (rows.length > 0 && rows[0].state) {
                const storedState = rows[0].state;
                const mergedState = {
                    ...defaultAppState,
                    ...storedState,
                    activeProjectId: storedState.activeProjectId || defaultAppState.activeProjectId,
                    projects: storedState.projects || defaultAppState.projects,
                    projectConfig: storedState.projectConfig || defaultAppState.projectConfig,
                    workerRegistry: storedState.workerRegistry || defaultAppState.workerRegistry,
                    attendance: { ...defaultAppState.attendance, ...(storedState.attendance || {}) },
                    cajaChica: storedState.cajaChica || defaultAppState.cajaChica,
                    kycVerifications: { ...defaultAppState.kycVerifications, ...(storedState.kycVerifications || {}) },
                    remitos: storedState.remitos || defaultAppState.remitos,
                    sitePhotos: storedState.sitePhotos || defaultAppState.sitePhotos,
                    artPolicies: { ...defaultAppState.artPolicies, ...(storedState.artPolicies || {}) },
                    auditLedger: storedState.auditLedger || defaultAppState.auditLedger,
                    budget: storedState.budget || defaultAppState.budget,
                    libroObra: storedState.libroObra || defaultAppState.libroObra,
                    tenants: storedState.tenants || defaultAppState.tenants,
                    projectPolicies: storedState.projectPolicies || defaultAppState.projectPolicies,
                    webhooks: storedState.webhooks || defaultAppState.webhooks,
                    calendarAppointments: storedState.calendarAppointments || defaultAppState.calendarAppointments,
                    curvaS: storedState.curvaS || defaultAppState.curvaS,
                    materialRequests: storedState.materialRequests || defaultAppState.materialRequests,
                    actasHyS: storedState.actasHyS || defaultAppState.actasHyS,
                    geofenceSettings: storedState.geofenceSettings || defaultAppState.geofenceSettings,
                    ganttExternalFiles: storedState.ganttExternalFiles || defaultAppState.ganttExternalFiles
                };
                return {
                    appState: mergedState,
                    messages: rows[0].messages || defaultMessages
                };
            } else {
                await p.query(
                    'INSERT INTO obrasaas_app_state (id, state, messages, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (id) DO UPDATE SET state = $2, messages = $3, updated_at = NOW()',
                    ['default', JSON.stringify(defaultAppState), JSON.stringify(defaultMessages)]
                );
                return {
                    appState: defaultAppState,
                    messages: defaultMessages
                };
            }
        } catch (e) {
            console.error("Neon Postgres read error:", e.message);
        }
    }

    try {
        initLocalDb();
        const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
        const parsed = JSON.parse(data);
        const storedState = parsed.appState || {};
        const mergedState = {
            ...defaultAppState,
            ...storedState,
            activeProjectId: storedState.activeProjectId || defaultAppState.activeProjectId,
            projects: storedState.projects || defaultAppState.projects,
            projectConfig: storedState.projectConfig || defaultAppState.projectConfig,
            workerRegistry: storedState.workerRegistry || defaultAppState.workerRegistry,
            attendance: { ...defaultAppState.attendance, ...(storedState.attendance || {}) },
            cajaChica: storedState.cajaChica || defaultAppState.cajaChica,
            kycVerifications: { ...defaultAppState.kycVerifications, ...(storedState.kycVerifications || {}) },
            remitos: storedState.remitos || defaultAppState.remitos,
            sitePhotos: storedState.sitePhotos || defaultAppState.sitePhotos,
            artPolicies: { ...defaultAppState.artPolicies, ...(storedState.artPolicies || {}) },
            auditLedger: storedState.auditLedger || defaultAppState.auditLedger,
            budget: storedState.budget || defaultAppState.budget,
            libroObra: storedState.libroObra || defaultAppState.libroObra,
            tenants: storedState.tenants || defaultAppState.tenants,
            projectPolicies: storedState.projectPolicies || defaultAppState.projectPolicies,
            webhooks: storedState.webhooks || defaultAppState.webhooks,
            calendarAppointments: storedState.calendarAppointments || defaultAppState.calendarAppointments,
            curvaS: storedState.curvaS || defaultAppState.curvaS,
            materialRequests: storedState.materialRequests || defaultAppState.materialRequests,
            actasHyS: storedState.actasHyS || defaultAppState.actasHyS,
            geofenceSettings: storedState.geofenceSettings || defaultAppState.geofenceSettings,
            ganttExternalFiles: storedState.ganttExternalFiles || defaultAppState.ganttExternalFiles
        };
        return {
            appState: mergedState,
            messages: parsed.messages || defaultMessages
        };
    } catch(e) {
        console.warn("Local file read skipped:", e.message);
        return {
            appState: defaultAppState,
            messages: defaultMessages
        };
    }
}

async function writeDb(data) {
    const p = getPool();
    if (p) {
        try {
            await ensurePostgresTable(p);
            await p.query(
                'INSERT INTO obrasaas_app_state (id, state, messages, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (id) DO UPDATE SET state = $2, messages = $3, updated_at = NOW()',
                ['default', JSON.stringify(data.appState), JSON.stringify(data.messages)]
            );
            
            import('./prisma.js').then(({ syncStateToRelationalDb }) => {
                syncStateToRelationalDb(data.appState).catch(err => 
                    console.warn('Prisma relational sync notice (non-fatal):', err.message)
                );
            }).catch(() => {});

            return;
        } catch (e) {
            console.error("Neon Postgres write error:", e.message);
        }
    }

    try {
        initLocalDb();
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.warn("Local file write skipped:", e.message);
    }
}

export async function getAppState() {
    const db = await readDb();
    return db.appState || defaultAppState;
}

export async function saveAppState(state) {
    const db = await readDb();
    const previousState = db.appState || null;
    db.appState = state;
    await writeDb(db);
    emitRealtimeUpdate('STATE_UPDATE', state);
    
    if (previousState) {
        import('./whatsappNotifications.js').then(({ checkAndSendAlerts }) => {
            checkAndSendAlerts(state, previousState).catch(err => 
                console.warn('Alert check notice (non-fatal):', err.message)
            );
        }).catch(() => {});
    }
    
    if (previousState && state.webhooks?.length > 0) {
        import('./webhookDispatcher.js').then(({ dispatchWebhookEvent }) => {
            const prevTasks = previousState.tasks || {};
            const newTasks = state.tasks || {};
            for (const [key, task] of Object.entries(newTasks)) {
                if (task.progress === 100 && prevTasks[key]?.progress < 100) {
                    dispatchWebhookEvent(state, 'task.completed', { taskId: key, name: task.name });
                } else if (task.progress !== prevTasks[key]?.progress) {
                    dispatchWebhookEvent(state, 'task.progress_updated', { taskId: key, name: task.name, progress: task.progress });
                }
            }
            if ((state.incidents?.length || 0) > (previousState.incidents?.length || 0)) {
                const newInc = state.incidents[state.incidents.length - 1];
                dispatchWebhookEvent(state, 'incident.created', newInc);
            }
            if ((state.workerRegistry?.length || 0) > (previousState.workerRegistry?.length || 0)) {
                const newWorker = state.workerRegistry[state.workerRegistry.length - 1];
                dispatchWebhookEvent(state, 'worker.registered', { name: newWorker.name, trade: newWorker.trade });
            }
        }).catch(() => {});
    }
    
    return state;
}

export async function getMessages() {
    const db = await readDb();
    return db.messages || defaultMessages;
}

export async function saveMessages(messages) {
    const db = await readDb();
    db.messages = messages;
    await writeDb(db);
    emitRealtimeUpdate('MESSAGE_RECEIVED', messages);
    return messages;
}

export async function resetState() {
    const freshDb = {
        appState: JSON.parse(JSON.stringify(defaultAppState)),
        messages: JSON.parse(JSON.stringify(defaultMessages))
    };
    await writeDb(freshDb);
    emitRealtimeUpdate('STATE_RESET', freshDb);
    return freshDb;
}
