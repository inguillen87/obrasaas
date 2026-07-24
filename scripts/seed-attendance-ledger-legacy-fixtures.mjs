import assert from 'node:assert/strict';

import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const { Pool } = pg;
const connectionString = String(
  process.env.ATTENDANCE_MIGRATION_DATABASE_URL
  || process.env.DATABASE_URL
  || '',
).trim();
assert.ok(connectionString, 'DATABASE_URL is required to seed migration fixtures.');

const ORGANIZATION_ID = 'attendance-ledger-fixture-organization';
const PROJECT_ID = 'attendance-ledger-fixture-project';
const fixtures = Object.freeze([
  ['absent', 'ABSENT', '5 days'],
  ['excused', 'EXCUSED', '4 days'],
  ['outside', 'OUTSIDE_GEOFENCE', '3 days'],
  ['pending', 'PENDING_GEO', '5 minutes'],
  ['present', 'PRESENT', '2 days'],
]);

const pool = new Pool({
  connectionString,
  max: 1,
  application_name: 'obrasaas-attendance-legacy-fixture-seed',
});
const client = await pool.connect();

try {
  const targetColumns = await client.query(`
    SELECT COUNT(*)::integer AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AttendanceEntry'
      AND column_name IN ('eventType', 'verificationStatus', 'shiftId')
  `);
  assert.equal(
    targetColumns.rows[0].count,
    0,
    'Legacy fixtures must be seeded before attendance ledger expansion.',
  );

  await client.query('BEGIN');
  await client.query('DELETE FROM "Organization" WHERE "id" = $1', [ORGANIZATION_ID]);
  await client.query(`
    INSERT INTO "Organization" (
      "id", "name", "slug", "country", "timezone", "updatedAt"
    ) VALUES ($1, $2, $3, 'AR', 'America/Argentina/Buenos_Aires', CURRENT_TIMESTAMP)
  `, [ORGANIZATION_ID, 'Attendance Ledger Fixture', 'attendance-ledger-fixture']);
  await client.query(`
    INSERT INTO "Project" (
      "id", "organizationId", "name", "slug", "updatedAt"
    ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
  `, [PROJECT_ID, ORGANIZATION_ID, 'Attendance Ledger Fixture Project', 'ledger']);

  for (const [index, [suffix, status, age]] of fixtures.entries()) {
    const workerId = `attendance-ledger-fixture-worker-${suffix}`;
    const attendanceId = `attendance-ledger-fixture-${suffix}`;
    await client.query(`
      INSERT INTO "Worker" (
        "id", "projectId", "phone", "name", "updatedAt"
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [workerId, PROJECT_ID, `+5491100000${index}`, `Fixture ${suffix}`]);
    await client.query(`
      INSERT INTO "AttendanceEntry" (
        "id",
        "projectId",
        "workerId",
        "status",
        "source",
        "checkedInAt",
        "createdAt"
      ) VALUES (
        $1,
        $2,
        $3,
        $4::"AttendanceStatus",
        'migration-fixture',
        CURRENT_TIMESTAMP - $5::interval,
        CURRENT_TIMESTAMP - $5::interval
      )
    `, [attendanceId, PROJECT_ID, workerId, status, age]);
  }

  await client.query('COMMIT');
  console.log(JSON.stringify({
    organizationId: ORGANIZATION_ID,
    projectId: PROJECT_ID,
    fixtures: fixtures.length,
  }));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
