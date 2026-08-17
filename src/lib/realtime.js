import { EventEmitter } from 'events';

class RealtimeBus extends EventEmitter {
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
    global[globalRealtimeKey] = new RealtimeBus();
}

export const realtimeBus = global[globalRealtimeKey];

export function emitRealtimeUpdate(eventType, payload, tenantId = 'default') {
    try {
        return realtimeBus.broadcast(tenantId, eventType, payload);
    } catch (err) {
        console.warn('Realtime broadcast error (non-fatal):', err.message);
    }
}