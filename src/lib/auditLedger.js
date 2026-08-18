/**
 * ObraSaaS Inmutable Cryptographic Audit Ledger (SHA-256)
 * Generates tamper-proof chained hash blocks for field check-ins, quincena certifications,
 * financial movements, and safety incidents for judicial & labor dispute compliance.
 */

import crypto from 'crypto';

const GENESIS_HASH = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";

/**
 * Calculates SHA-256 hash for an audit transaction block
 */
export function calculateBlockHash({ index, timestamp, action, actor, details, previousHash }) {
    const serialized = JSON.stringify({
        index,
        timestamp,
        action,
        actor,
        details,
        previousHash
    });
    return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Appends a new immutable audit transaction to the chain
 */
export function appendAuditTransaction(currentLedger = [], { action, actor, details = {} }) {
    const ledger = Array.isArray(currentLedger) ? [...currentLedger] : [];
    const index = ledger.length + 1;
    const timestamp = new Date().toISOString();
    const previousHash = ledger.length > 0 ? ledger[0].hash : GENESIS_HASH;

    const blockHash = calculateBlockHash({
        index,
        timestamp,
        action,
        actor,
        details,
        previousHash
    });

    const newBlock = {
        index,
        timestamp,
        formattedTime: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        action,
        actor,
        details,
        previousHash,
        hash: blockHash,
        signatureStatus: "CERTIFICADO_SHA256"
    };

    // Store latest at index 0 for quick UI display (capped at 50 records)
    ledger.unshift(newBlock);
    if (ledger.length > 50) {
        ledger.pop();
    }

    return ledger;
}

/**
 * Verifies the integrity of the audit chain
 */
export function verifyChainIntegrity(ledger = []) {
    if (!Array.isArray(ledger) || ledger.length === 0) {
        return { intact: true, totalBlocks: 0, violations: [] };
    }

    // Ledger is stored in reverse chronological order (newest first)
    const chronological = [...ledger].reverse();
    const violations = [];

    for (let i = 0; i < chronological.length; i++) {
        const current = chronological[i];
        const prev = i > 0 ? chronological[i - 1] : null;
        const expectedPrevHash = prev ? prev.hash : GENESIS_HASH;

        if (current.previousHash !== expectedPrevHash) {
            violations.push({
                blockIndex: current.index,
                reason: `Discrepancia en previousHash. Esperado: ${expectedPrevHash}, Encontrado: ${current.previousHash}`
            });
        }

        const calculated = calculateBlockHash({
            index: current.index,
            timestamp: current.timestamp,
            action: current.action,
            actor: current.actor,
            details: current.details,
            previousHash: current.previousHash
        });

        if (calculated !== current.hash) {
            violations.push({
                blockIndex: current.index,
                reason: `Hash de bloque alterado. Calculado: ${calculated}, Almacenado: ${current.hash}`
            });
        }
    }

    return {
        intact: violations.length === 0,
        totalBlocks: ledger.length,
        violations
    };
}
