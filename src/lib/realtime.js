// ============================================================================
// ObraSaaS Enterprise Realtime Bus — Serverless-Compatible
// Uses Postgres updated_at polling instead of in-memory EventEmitter
// Works reliably across Vercel serverless lambda instances
// ============================================================================

import { Pool } from 'pg';

// ============================================================================
// 1. Postgres State Version Tracker
// Instead of EventEmitter (fails across lambdas), we track the last 
// updated_at timestamp from the database. SSE stream polls this.
// ============================================================================

let pool = null;

function getPool() {
    if (!pool && process.env.DATABASE_URL) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 3, // Keep pool small for realtime connections
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
    }
    return pool;
}

/**
 * Get the current state version (updated_at timestamp) from Postgres.
 * This is fast — single column query on primary key.
 * @param {string} tenantId
 * @returns {Promise<string|null>} ISO timestamp or null
 */
export async function getStateVersion(tenantId = 'default') {
    const p = getPool();
    if (!p) return null;
    
    try {
        const { rows } = await p.query(
            'SELECT updated_at FROM obrasaas_app_state WHERE id = $1',
            [tenantId]
        );
        return rows[0]?.updated_at?.toISOString() || null;
    } catch (err) {
        console.warn('Realtime version check error:', err.message);
        return null;
    }
}

/**
 * Get the full state + messages from Postgres (used when version changes).
 * @param {string} tenantId
 * @returns {Promise<{state: object, messages: array, version: string}|null>}
 */
export async function getStateSnapshot(tenantId = 'default') {
    const p = getPool();
    if (!p) return null;
    
    try {
        const { rows } = await p.query(
            'SELECT state, messages, updated_at FROM obrasaas_app_state WHERE id = $1',
            [tenantId]
        );
        if (rows.length > 0) {
            return {
                state: rows[0].state,
                messages: rows[0].messages,
                version: rows[0].updated_at?.toISOString() || new Date().toISOString()
            };
        }
        return null;
    } catch (err) {
        console.warn('Realtime snapshot error:', err.message);
        return null;
    }
}

// ============================================================================
// 2. In-Memory Fallback (Local Development Only)
// When no DATABASE_URL is configured, fall back to EventEmitter
// ============================================================================

import { EventEmitter } from 'events';

class LocalRealtimeBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(500);
        this.versions = new Map();
    }

    getTenantVersion(tenantId = 'default') {
        return this.versions.get(tenantId) || 1;
    }

    incrementTenantVersion(tenantId = 'default') {
        const current = this.getTenantVersion(tenantId);
        const next = current + 1;
        this.versions.set(tenantId, next);
        return next;
    }

    broadcast(tenantId = 'default', eventType, payload) {
        const version = this.incrementTenantVersion(tenantId);
        const event = {
            tenantId,
            eventType,
            version,
            timestamp: new Date().toISOString(),
            payload
        };

        const channel = 'tenant:' + tenantId;
        this.emit(channel, event);
        this.emit('tenant:*', event);
        return event;
    }

    subscribe(tenantId = 'default', callback) {
        const channel = 'tenant:' + tenantId;
        this.on(channel, callback);
        return () => {
            this.off(channel, callback);
        };
    }
}

const globalRealtimeKey = Symbol.for('obrasaas.realtime.bus');
if (!global[globalRealtimeKey]) {
    global[globalRealtimeKey] = new LocalRealtimeBus();
}

export const realtimeBus = global[globalRealtimeKey];

// ============================================================================
// 3. Unified Emit Function
// Works for both serverless (Postgres-based) and local (EventEmitter-based)
// ============================================================================

export function emitRealtimeUpdate(eventType, payload, tenantId = 'default') {
    try {
        // In serverless: the SSE stream detects changes via updated_at polling
        // The emit here is for local dev where EventEmitter works within the same process
        return realtimeBus.broadcast(tenantId, eventType, payload);
    } catch (err) {
        console.warn('Realtime broadcast error (non-fatal):', err.message);
    }
}

// ============================================================================
// 4. Mode Detection
// ============================================================================

export function isServerlessMode() {
    return Boolean(process.env.DATABASE_URL);
}