// ObraSaaS System API — Neon Cloud Database Health & Relational Telemetry
import { NextResponse } from 'next/server';
import { getDatabaseHealth, getAppState } from '@/lib/db';
import { prisma, syncStateToRelationalDb } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const health = await getDatabaseHealth();
        
        let relationalStats = {
            organizations: 0,
            projects: 0,
            workers: 0,
            tasks: 0
        };

        if (health.connected) {
            try {
                const { getPool } = await import('@/lib/db');
                const p = getPool();
                if (p) {
                    const [orgs, projs, wrks, tsks] = await Promise.all([
                        p.query('SELECT count(*) FROM "Organization"').catch(() => ({ rows: [{ count: 0 }] })),
                        p.query('SELECT count(*) FROM "Project"').catch(() => ({ rows: [{ count: 0 }] })),
                        p.query('SELECT count(*) FROM "Worker"').catch(() => ({ rows: [{ count: 0 }] })),
                        p.query('SELECT count(*) FROM "Task"').catch(() => ({ rows: [{ count: 0 }] }))
                    ]);
                    relationalStats = {
                        organizations: parseInt(orgs.rows[0].count, 10),
                        projects: parseInt(projs.rows[0].count, 10),
                        workers: parseInt(wrks.rows[0].count, 10),
                        tasks: parseInt(tsks.rows[0].count, 10)
                    };
                }
            } catch (relErr) {
                console.warn('Postgres table count warning:', relErr.message);
            }
        }

        return NextResponse.json({
            success: true,
            database: {
                engine: 'PostgreSQL 16 Serverless v2',
                provider: 'Neon Cloud (AWS us-east-1)',
                ...health
            },
            relationalPrismaTables: relationalStats,
            serverTimestamp: new Date().toISOString()
        });
    } catch (err) {
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const state = await getAppState();
        const syncResult = await syncStateToRelationalDb(state);
        const health = await getDatabaseHealth();

        return NextResponse.json({
            success: true,
            message: 'Sincronización relacional de Neon PostgreSQL ejecutada con éxito',
            sync: syncResult,
            databaseHealth: health
        });
    } catch (err) {
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
