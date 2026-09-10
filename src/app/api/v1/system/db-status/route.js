// ObraSaaS System API — Neon Cloud Database Health & Relational Telemetry
import { NextResponse } from 'next/server';
import { getDatabaseHealth, getAppState } from '@/lib/db';
import { prisma, syncStateToRelationalDb } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const health = await getDatabaseHealth();
        
        let relationalStats = {
            tenants: 0,
            projects: 0,
            workers: 0,
            tasks: 0
        };

        if (health.connected) {
            try {
                const [tenants, projects, workers, tasks] = await Promise.all([
                    prisma.tenant.count().catch(() => 0),
                    prisma.project.count().catch(() => 0),
                    prisma.worker.count().catch(() => 0),
                    prisma.task.count().catch(() => 0)
                ]);
                relationalStats = { tenants, projects, workers, tasks };
            } catch (relErr) {
                console.warn('Prisma table count warning:', relErr.message);
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
