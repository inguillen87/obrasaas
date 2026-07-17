import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for the isolated migration verification.');
}

const migrationUrl = new URL(
  '../prisma/migrations/20260717050000_project_task_projection/migration.sql',
  import.meta.url,
);
const migration = await readFile(migrationUrl, 'utf8');

function migrationBlock(name) {
  const match = migration.match(new RegExp(
    `-- TASK_PROJECTION_${name}_BEGIN\\s*([\\s\\S]*?)\\s*-- TASK_PROJECTION_${name}_END`,
  ));
  if (!match?.[1]) throw new Error(`Migration block ${name} is missing.`);
  return match[1].trim();
}

const lockSql = migrationBlock('LOCKS');
const backfillSql = migrationBlock('BACKFILL');
const pruneSql = migrationBlock('PRUNE');
const rollback = new Error('EXPECTED_MIGRATION_VERIFICATION_ROLLBACK');
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`
      CREATE TEMP TABLE "Project" (
        "id" text PRIMARY KEY,
        "startsAt" timestamptz
      ) ON COMMIT DROP
    `);
    await transaction.$executeRawUnsafe(`
      CREATE TEMP TABLE "ProjectSnapshot" (
        "projectId" text PRIMARY KEY,
        "state" jsonb NOT NULL,
        "version" integer NOT NULL,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL
      ) ON COMMIT DROP
    `);
    await transaction.$executeRawUnsafe(`
      CREATE TEMP TABLE "Task" (
        "id" text PRIMARY KEY,
        "projectId" text NOT NULL,
        "externalId" text,
        "title" text NOT NULL,
        "status" "TaskStatus" NOT NULL,
        "progress" integer NOT NULL,
        "startsAt" timestamptz,
        "endsAt" timestamptz,
        "assignee" text,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL,
        UNIQUE ("projectId", "externalId")
      ) ON COMMIT DROP
    `);

    const now = new Date('2026-07-17T12:00:00.000Z');
    await transaction.$executeRawUnsafe(
      'INSERT INTO "Project" ("id", "startsAt") VALUES ($1, $2), ($3, $4)',
      'project-a',
      new Date('2026-07-01T00:00:00.000Z'),
      'project-b',
      new Date('2026-08-01T00:00:00.000Z'),
    );
    await transaction.$executeRawUnsafe(
      `INSERT INTO "ProjectSnapshot"
        ("projectId", "state", "version", "createdAt", "updatedAt")
       VALUES ($1, $2::jsonb, 7, $3, $3), ($4, $5::jsonb, 3, $3, $3)`,
      'project-a',
      JSON.stringify({
        tasks: {
          'task-a': {
            name: 'Estructura PB',
            assignee: 'Ana',
            progress: 20,
            duration: 3,
            startDay: 1,
          },
          'task-b': {
            name: 'Estructura PB',
            assignee: 'Bruno',
            progress: 0,
            duration: 2,
            startDay: 4,
            isDelayed: true,
          },
          fractional: {
            name: 'Terminaciones',
            progress: 49.6,
            duration: 2.4,
            startDay: 8,
          },
        },
      }),
      now,
      'project-b',
      JSON.stringify({
        tasks: {
          'task-a': {
            name: 'Estructura PB',
            progress: 90,
            duration: 1,
            startDay: 2,
          },
        },
      }),
    );
    await transaction.$executeRawUnsafe(
      `INSERT INTO "Task"
        ("id", "projectId", "externalId", "title", "status", "progress", "metadata", "createdAt", "updatedAt")
       VALUES
        ('legacy-null', 'project-a', NULL, 'Legacy null', 'READY', 0, '{"source":"manual"}', $1, $1),
        ('legacy-manual', 'project-a', 'manual:task-a', 'Legacy manual', 'READY', 0, '{"source":"manual"}', $1, $1)`,
      now,
    );

    await transaction.$queryRawUnsafe(lockSql);
    await transaction.$executeRawUnsafe(backfillSql);
    await transaction.$executeRawUnsafe(pruneSql);

    const firstRows = await transaction.$queryRawUnsafe(`
      SELECT "projectId", "externalId", "title", "status"::text AS status,
        "progress", "startsAt", "endsAt", "assignee", "metadata"
      FROM "Task"
      ORDER BY "projectId", "externalId" NULLS FIRST
    `);
    assert.equal(firstRows.length, 6);
    const projected = firstRows.filter((row) => row.metadata?.source === 'project-snapshot-v1');
    assert.equal(projected.length, 4);
    assert.deepEqual(
      projected.map((row) => `${row.projectId}/${row.externalId}`),
      [
        'project-a/snapshot:fractional',
        'project-a/snapshot:task-a',
        'project-a/snapshot:task-b',
        'project-b/snapshot:task-a',
      ],
    );
    const taskA = projected.find(
      (row) => row.projectId === 'project-a' && row.externalId === 'snapshot:task-a',
    );
    const taskB = projected.find(
      (row) => row.projectId === 'project-a' && row.externalId === 'snapshot:task-b',
    );
    const fractional = projected.find((row) => row.externalId === 'snapshot:fractional');
    assert.equal(taskA.status, 'IN_PROGRESS');
    assert.equal(taskA.assignee, 'Ana');
    assert.equal(taskA.metadata.snapshotTaskId, 'task-a');
    assert.equal(taskA.startsAt.toISOString(), '2026-07-01T00:00:00.000Z');
    assert.equal(taskA.endsAt.toISOString(), '2026-07-03T00:00:00.000Z');
    assert.equal(taskB.status, 'BLOCKED');
    assert.equal(fractional.progress, 50);

    await transaction.$executeRawUnsafe(
      `UPDATE "ProjectSnapshot"
       SET "state" = $2::jsonb, "version" = 8, "updatedAt" = $3
       WHERE "projectId" = $1`,
      'project-a',
      JSON.stringify({
        tasks: {
          'task-a': {
            name: 'Estructura PB',
            assignee: 'Ana',
            progress: 100,
            duration: 3,
            startDay: 1,
          },
          fractional: {
            name: 'Terminaciones',
            progress: 50,
            duration: 2,
            startDay: 8,
          },
        },
      }),
      new Date('2026-07-17T13:00:00.000Z'),
    );
    await transaction.$executeRawUnsafe(backfillSql);
    await transaction.$executeRawUnsafe(pruneSql);
    await transaction.$executeRawUnsafe(backfillSql);
    await transaction.$executeRawUnsafe(pruneSql);

    const finalRows = await transaction.$queryRawUnsafe(`
      SELECT "projectId", "externalId", "status"::text AS status, "progress", "metadata"
      FROM "Task"
      ORDER BY "projectId", "externalId" NULLS FIRST
    `);
    assert.equal(finalRows.length, 5);
    assert.equal(
      finalRows.some((row) => row.externalId === 'snapshot:task-b'),
      false,
    );
    assert.equal(
      finalRows.find(
        (row) => row.projectId === 'project-a' && row.externalId === 'snapshot:task-a',
      ).status,
      'DONE',
    );
    assert.equal(
      finalRows.filter((row) => row.metadata?.source === 'manual').length,
      2,
    );
    throw rollback;
  }, { isolationLevel: 'Serializable', timeout: 60_000, maxWait: 10_000 });
  throw new Error('Migration verification did not roll back.');
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await prisma.$disconnect();
}

console.log('Project task migration verification passed and rolled back.');
