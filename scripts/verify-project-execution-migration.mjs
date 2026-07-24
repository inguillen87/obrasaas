import assert from 'node:assert/strict';
import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
const connectionString = process.env.PROJECT_EXECUTION_MIGRATION_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('PROJECT_EXECUTION_MIGRATION_DATABASE_URL or DATABASE_URL is required.');
const pool = new pg.Pool({ connectionString, application_name: 'obrasaas-project-execution-verifier' });
const client = await pool.connect();
try {
  const migration = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', ['20260724120000_canonical_teams_assignments_blockers']);
  assert.equal(migration.rowCount, 1, 'S4 migration must be applied successfully.');
  const tables = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename = ANY($1::text[])', [['WorkTeam', 'WorkTeamMember', 'TaskAssignment', 'ProjectBlocker']]);
  assert.equal(tables.rowCount, 4, 'All S4 tables must exist.');
  const constraints = await client.query(`SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[])`, [[
    'WorkTeam_revision_nonnegative_check', 'WorkTeam_name_not_blank_check', 'WorkTeamMember_dates_check',
    'TaskAssignment_owner_check', 'TaskAssignment_dates_check', 'ProjectBlocker_resolution_state_check',
    'WorkTeamMember_team_scope_fkey', 'WorkTeamMember_worker_scope_fkey', 'TaskAssignment_task_scope_fkey',
    'TaskAssignment_worker_scope_fkey', 'TaskAssignment_team_scope_fkey', 'ProjectBlocker_task_scope_fkey',
    'ProjectBlocker_worker_scope_fkey', 'ProjectBlocker_team_scope_fkey',
  ]]);
  assert.equal(constraints.rowCount, 14, 'S4 checks and scoped FKs must exist.');
  const types = await client.query(`SELECT typname FROM pg_type WHERE typname = ANY($1::text[])`, [['WorkTeamStatus', 'WorkTeamMemberRole', 'TaskAssignmentStatus', 'ProjectBlockerStatus', 'ProjectBlockerSeverity']]);
  assert.equal(types.rowCount, 5, 'S4 enums must exist.');
  console.log(JSON.stringify({ ok: true, tables: tables.rowCount, constraints: constraints.rowCount, enums: types.rowCount }));
} finally { client.release(); await pool.end(); }
