import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import pg from 'pg';
import dotenv from 'dotenv';

import {
  provisionS92ClerkFixtures,
  S92_FIXTURE_ID,
} from './provision-s92-e2e-clerk-fixtures.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const { Client } = pg;

export const S92_E2E_DEFAULT_DESCRIPTOR_PATH = resolve('test-results/s92-e2e-fixture.json');
export const S92_E2E_PERIOD = Object.freeze({
  date: '2020-01-01',
  start: '2020-01-01',
  end: '2020-01-15',
});

export const S92_DB_FIXTURE = Object.freeze({
  organizations: Object.freeze({
    tenantA: Object.freeze({
      id: 's92e2e_org_primary',
      name: 'ObraSaaS S9.2 E2E Primary',
      slug: 'obrasaas-s92-e2e-primary',
    }),
    tenantB: Object.freeze({
      id: 's92e2e_org_other',
      name: 'ObraSaaS S9.2 E2E Other Tenant',
      slug: 'obrasaas-s92-e2e-other',
    }),
  }),
  projects: Object.freeze({
    primary: Object.freeze({
      id: 's92e2e_project_primary',
      organizationKey: 'tenantA',
      name: 'S9.2 E2E Corte Quincenal',
      slug: 's92-e2e-corte-quincenal',
    }),
    primaryAnchor: Object.freeze({
      id: 's92e2e_project_primary_anchor',
      organizationKey: 'tenantA',
      name: 'S9.2 E2E Obra Ancla',
      slug: 's92-e2e-obra-ancla',
    }),
    isolation: Object.freeze({
      id: 's92e2e_project_isolation',
      organizationKey: 'tenantB',
      name: 'S9.2 E2E Otro Tenant',
      slug: 's92-e2e-otro-tenant',
    }),
  }),
  tasks: Object.freeze({
    measured: Object.freeze({
      id: 's92e2e_task_measured',
      projectKey: 'primary',
      externalId: `${S92_FIXTURE_ID}:task:measured`,
      code: 'S92-MEASURED',
      title: 'Mamposteria sintetica medida',
      status: 'IN_PROGRESS',
      progress: 37,
    }),
    missing: Object.freeze({
      id: 's92e2e_task_missing',
      projectKey: 'primary',
      externalId: `${S92_FIXTURE_ID}:task:missing`,
      code: 'S92-MISSING',
      title: 'Revoque sintetico sin medicion',
      status: 'READY',
      progress: 0,
    }),
    isolation: Object.freeze({
      id: 's92e2e_task_isolation',
      projectKey: 'isolation',
      externalId: `${S92_FIXTURE_ID}:task:isolation`,
      code: 'S92-OTHER',
      title: 'Tarea sintetica de otro tenant',
      status: 'READY',
      progress: 0,
    }),
  }),
  evidence: Object.freeze({
    id: 's92e2e_evidence_approved',
    taskKey: 'measured',
  }),
});

function optionValue(args, name) {
  const indexes = args.flatMap((value, index) => (value === name ? [index] : []));
  if (indexes.length > 1) throw new Error(`${name} may only be provided once.`);
  if (indexes.length === 0) return null;
  const value = args[indexes[0] + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

export function parseS92DatabaseSeedArgs(args, environment = process.env) {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--descriptor') throw new Error(`Unknown argument: ${args[index]}`);
    index += 1;
  }
  return {
    descriptorPath: resolve(
      optionValue(args, '--descriptor')
      || environment.S92_E2E_FIXTURE_FILE
      || S92_E2E_DEFAULT_DESCRIPTOR_PATH,
    ),
  };
}

export function authorizeS92DisposableDatabase(environment = process.env) {
  if (environment.S92_E2E_DISPOSABLE !== '1') {
    throw new Error('S92_E2E_DISPOSABLE=1 is required before seeding S9.2 E2E data.');
  }
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the S9.2 E2E seed.');
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }
  const connectionOptions = [...parsed.searchParams.entries()];
  if (
    connectionOptions.some(([key, value]) => key !== 'schema' || value !== 'public')
    || parsed.searchParams.getAll('schema').length > 1
  ) {
    throw new Error('S9.2 E2E DATABASE_URL only permits the exact query option schema=public.');
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!localHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error('S9.2 E2E seed is restricted to a local PostgreSQL host.');
  }
  let databaseName;
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error('DATABASE_URL database name is invalid.');
  }
  if (databaseName !== 'obrasaas_e2e') {
    throw new Error('S9.2 E2E seed requires the exact database name obrasaas_e2e.');
  }
  return { databaseUrl, databaseName, hostname: parsed.hostname.toLowerCase() };
}

export function assertS92RuntimeDatabaseIdentity(row) {
  if (row?.database_name !== 'obrasaas_e2e') {
    throw new Error('Connected database is not the exact disposable obrasaas_e2e database.');
  }
  const address = String(row?.server_address || '').toLowerCase();
  const mappedAddress = address.startsWith('::ffff:') ? address.slice(7) : address;
  const octets = mappedAddress.split('.').map(Number);
  const validIpv4 = octets.length === 4 && octets.every((octet) => (
    Number.isInteger(octet) && octet >= 0 && octet <= 255
  ));
  const privateIpv4 = validIpv4 && (
    octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
  );
  const loopback = address === '::1' || (validIpv4 && octets[0] === 127);
  const uniqueLocalIpv6 = /^f[cd][0-9a-f]{2}:/i.test(address);
  if (!address || (!loopback && !privateIpv4 && !uniqueLocalIpv6)) {
    throw new Error('Connected PostgreSQL server is not loopback or private-network local.');
  }
  if (Number(row?.server_port) !== 5432) {
    throw new Error('Connected PostgreSQL server does not expose the expected internal port 5432.');
  }
  return true;
}

function metadata() {
  return JSON.stringify({ fixture: S92_FIXTURE_ID, synthetic: true });
}

function expectedActorDatabaseIds() {
  return {
    admin: { userId: 's92e2e_user_admin', membershipId: 's92e2e_membership_admin' },
    director: { userId: 's92e2e_user_director', membershipId: 's92e2e_membership_director' },
    siteManager: { userId: 's92e2e_user_site_manager', membershipId: 's92e2e_membership_site_manager' },
    finance: { userId: 's92e2e_user_finance', membershipId: 's92e2e_membership_finance' },
    auditor: { userId: 's92e2e_user_auditor', membershipId: 's92e2e_membership_auditor' },
    outsider: { userId: 's92e2e_user_outsider', membershipId: 's92e2e_membership_outsider' },
  };
}

function assertCount(rows, expected, label) {
  if (rows.length !== expected) throw new Error(`S9.2 E2E ${label} row count drifted.`);
}

function assertExact(value, expected, label) {
  if (value !== expected) throw new Error(`S9.2 E2E ${label} drifted.`);
}

async function assertNoS92LedgerHistory(database) {
  const projectIds = Object.values(S92_DB_FIXTURE.projects).map(({ id }) => id);
  const result = await database.query(`
    SELECT
      (SELECT count(*) FROM "TaskProgressMeasurementHead" WHERE "projectId" = ANY($1::text[])) AS measurement_heads,
      (SELECT count(*) FROM "TaskProgressMeasurement" WHERE "projectId" = ANY($1::text[])) AS measurements,
      (SELECT count(*) FROM "TaskProgressMeasurementDecision" WHERE "projectId" = ANY($1::text[])) AS decisions,
      (SELECT count(*) FROM "ProjectProgressMeasurementCutHead" WHERE "projectId" = ANY($1::text[])) AS cut_heads,
      (SELECT count(*) FROM "ProjectProgressMeasurementCut" WHERE "projectId" = ANY($1::text[])) AS cuts,
      (SELECT count(*) FROM "ProjectProgressMeasurementCutLine" WHERE "projectId" = ANY($1::text[])) AS cut_lines
  `, [projectIds]);
  const counts = result.rows[0] || {};
  if (Object.values(counts).some((value) => Number(value) !== 0)) {
    throw new Error('S9.2 E2E seed refuses a project that already has measurement or cut history.');
  }
}

async function insertS92BaseRows(database, clerkFixture) {
  const actorIds = expectedActorDatabaseIds();
  for (const [organizationKey, specification] of Object.entries(S92_DB_FIXTURE.organizations)) {
    const clerkOrganizationId = clerkFixture.organizations[organizationKey].clerkOrganizationId;
    await database.query(`
      INSERT INTO "Organization" (
        "id", "clerkOrganizationId", "name", "slug", "subscriptionPlan",
        "subscriptionStatus", "trialEndsAt", "metadata", "updatedAt"
      ) VALUES ($1, $2, $3, $4, 'PRO', 'ACTIVE', NULL, $5::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING
    `, [specification.id, clerkOrganizationId, specification.name, specification.slug, metadata()]);
  }

  for (const [actorKey, identity] of Object.entries(clerkFixture.actors)) {
    const actorId = actorIds[actorKey];
    if (!actorId) throw new Error(`Unexpected resolved Clerk actor ${actorKey}.`);
    await database.query(`
      INSERT INTO "PlatformUser" (
        "id", "clerkUserId", "primaryEmail", "fullName", "systemRole", "updatedAt"
      ) VALUES ($1, $2, $3, $4, 'TENANT_USER', CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING
    `, [actorId.userId, identity.clerkUserId, identity.email, `S92 Synthetic ${actorKey}`]);
    const organizationKey = actorKey === 'outsider' ? 'tenantB' : 'tenantA';
    const organizationId = S92_DB_FIXTURE.organizations[organizationKey].id;
    await database.query(`
      INSERT INTO "TenantMembership" (
        "id", "organizationId", "userId", "clerkRole", "tenantRole", "status", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5::"TenantRole", 'ACTIVE', CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING
    `, [
      actorId.membershipId,
      organizationId,
      actorId.userId,
      identity.clerkRole,
      identity.tenantRole,
    ]);
  }

  for (const [projectKey, project] of Object.entries(S92_DB_FIXTURE.projects)) {
    const organizationId = S92_DB_FIXTURE.organizations[project.organizationKey].id;
    await database.query(`
      INSERT INTO "Project" (
        "id", "organizationId", "name", "slug", "status", "metadata", "startsAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, 'ACTIVE', $5::jsonb, $6::timestamp, CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING
    `, [project.id, organizationId, project.name, project.slug, metadata(), '2019-12-01T00:00:00.000Z']);

    const actorKeys = project.organizationKey === 'tenantA'
      ? ['admin', 'director', 'siteManager', 'finance', 'auditor']
      : ['outsider'];
    for (const actorKey of actorKeys) {
      await database.query(`
        INSERT INTO "ProjectMembership" (
          "id", "projectId", "tenantMembershipId", "status", "updatedAt"
        ) VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
      `, [
        `s92e2e_project_membership_${projectKey}_${actorKey === 'siteManager' ? 'site_manager' : actorKey}`,
        project.id,
        actorIds[actorKey].membershipId,
      ]);
    }
  }

  for (const task of Object.values(S92_DB_FIXTURE.tasks)) {
    const project = S92_DB_FIXTURE.projects[task.projectKey];
    await database.query(`
      INSERT INTO "Task" (
        "id", "projectId", "externalId", "code", "title", "type", "status",
        "progress", "revision", "metadata", "startsAt", "endsAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, 'TASK', $6::"TaskStatus",
        $7, 0, $8::jsonb, $9::timestamp, $10::timestamp, CURRENT_TIMESTAMP
      )
      ON CONFLICT DO NOTHING
    `, [
      task.id,
      project.id,
      task.externalId,
      task.code,
      task.title,
      task.status,
      task.progress,
      JSON.stringify({ source: 'canonical-task-v1', fixture: S92_FIXTURE_ID, synthetic: true }),
      '2020-01-01T00:00:00.000Z',
      '2020-01-15T23:59:59.000Z',
    ]);
  }

  const evidence = S92_DB_FIXTURE.evidence;
  const measuredTask = S92_DB_FIXTURE.tasks[evidence.taskKey];
  const measuredProject = S92_DB_FIXTURE.projects[measuredTask.projectKey];
  await database.query(`
    INSERT INTO "ProgressEvidence" (
      "id", "projectId", "taskId", "capturedAt", "caption", "media", "status",
      "reviewNote", "revision", "reviewedAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4::timestamp, $5, $6::jsonb, 'APPROVED',
      $7, 0, $4::timestamp, CURRENT_TIMESTAMP
    )
    ON CONFLICT DO NOTHING
  `, [
    evidence.id,
    measuredProject.id,
    measuredTask.id,
    '2020-01-10T12:00:00.000Z',
    'Evidencia sintetica aprobada para S9.2 E2E.',
    JSON.stringify({ fixture: S92_FIXTURE_ID, synthetic: true, storage: null }),
    'Aprobacion sintetica determinista para acceptance E2E.',
  ]);
}

async function verifyS92BaseRows(database, clerkFixture) {
  const actorIds = expectedActorDatabaseIds();
  const organizations = await database.query(`
    SELECT "id", "clerkOrganizationId", "name", "slug",
           "subscriptionPlan"::text, "subscriptionStatus"::text, "trialEndsAt"
      FROM "Organization" WHERE "id" = ANY($1::text[]) ORDER BY "id"
  `, [Object.values(S92_DB_FIXTURE.organizations).map(({ id }) => id)]);
  assertCount(organizations.rows, 2, 'organization');
  for (const [key, expected] of Object.entries(S92_DB_FIXTURE.organizations)) {
    const actual = organizations.rows.find(({ id }) => id === expected.id);
    assertExact(actual?.clerkOrganizationId, clerkFixture.organizations[key].clerkOrganizationId, `${key} Clerk organization`);
    assertExact(actual?.name, expected.name, `${key} organization name`);
    assertExact(actual?.slug, expected.slug, `${key} organization slug`);
    assertExact(actual?.subscriptionPlan, 'PRO', `${key} subscription plan`);
    assertExact(actual?.subscriptionStatus, 'ACTIVE', `${key} subscription status`);
    assertExact(actual?.trialEndsAt, null, `${key} trial end`);
  }

  const users = await database.query(`
    SELECT "id", "clerkUserId", "primaryEmail", "systemRole"
      FROM "PlatformUser" WHERE "id" = ANY($1::text[]) ORDER BY "id"
  `, [Object.values(actorIds).map(({ userId }) => userId)]);
  assertCount(users.rows, 6, 'platform user');
  const memberships = await database.query(`
    SELECT "id", "organizationId", "userId", "clerkRole", "tenantRole"::text, "status"::text
      FROM "TenantMembership" WHERE "id" = ANY($1::text[]) ORDER BY "id"
  `, [Object.values(actorIds).map(({ membershipId }) => membershipId)]);
  assertCount(memberships.rows, 6, 'tenant membership');
  for (const [actorKey, identity] of Object.entries(clerkFixture.actors)) {
    const ids = actorIds[actorKey];
    const user = users.rows.find(({ id }) => id === ids.userId);
    assertExact(user?.clerkUserId, identity.clerkUserId, `${actorKey} Clerk user`);
    assertExact(user?.primaryEmail, identity.email, `${actorKey} email`);
    assertExact(user?.systemRole, 'TENANT_USER', `${actorKey} system role`);
    const membership = memberships.rows.find(({ id }) => id === ids.membershipId);
    const organizationKey = actorKey === 'outsider' ? 'tenantB' : 'tenantA';
    assertExact(membership?.organizationId, S92_DB_FIXTURE.organizations[organizationKey].id, `${actorKey} organization`);
    assertExact(membership?.userId, ids.userId, `${actorKey} user membership`);
    assertExact(membership?.clerkRole, identity.clerkRole, `${actorKey} Clerk role`);
    assertExact(membership?.tenantRole, identity.tenantRole, `${actorKey} tenant role`);
    assertExact(membership?.status, 'ACTIVE', `${actorKey} membership status`);
  }

  const projects = await database.query(`
    SELECT "id", "organizationId", "name", "slug", "status"::text
      FROM "Project" WHERE "id" = ANY($1::text[]) ORDER BY "id"
  `, [Object.values(S92_DB_FIXTURE.projects).map(({ id }) => id)]);
  assertCount(projects.rows, 3, 'project');
  for (const project of Object.values(S92_DB_FIXTURE.projects)) {
    const actual = projects.rows.find(({ id }) => id === project.id);
    assertExact(actual?.organizationId, S92_DB_FIXTURE.organizations[project.organizationKey].id, `${project.id} organization`);
    assertExact(actual?.name, project.name, `${project.id} name`);
    assertExact(actual?.slug, project.slug, `${project.id} slug`);
    assertExact(actual?.status, 'ACTIVE', `${project.id} status`);
  }

  const projectMemberships = await database.query(`
    SELECT "id", "projectId", "tenantMembershipId", "status"::text
      FROM "ProjectMembership"
     WHERE "projectId" = ANY($1::text[]) ORDER BY "projectId", "tenantMembershipId"
  `, [Object.values(S92_DB_FIXTURE.projects).map(({ id }) => id)]);
  const expectedProjectMemberships = [];
  for (const [projectKey, project] of Object.entries(S92_DB_FIXTURE.projects)) {
    const actorKeys = project.organizationKey === 'tenantA'
      ? ['admin', 'director', 'siteManager', 'finance', 'auditor']
      : ['outsider'];
    for (const actorKey of actorKeys) {
      expectedProjectMemberships.push({
        id: `s92e2e_project_membership_${projectKey}_${actorKey === 'siteManager' ? 'site_manager' : actorKey}`,
        projectId: project.id,
        tenantMembershipId: actorIds[actorKey].membershipId,
      });
    }
  }
  assertCount(projectMemberships.rows, expectedProjectMemberships.length, 'project membership');
  for (const expected of expectedProjectMemberships) {
    const actual = projectMemberships.rows.find(({ id }) => id === expected.id);
    assertExact(actual?.projectId, expected.projectId, `${expected.id} project`);
    assertExact(actual?.tenantMembershipId, expected.tenantMembershipId, `${expected.id} actor`);
    assertExact(actual?.status, 'ACTIVE', `${expected.id} status`);
  }

  const tasks = await database.query(`
    SELECT "id", "projectId", "externalId", "code", "title", "type"::text,
           "status"::text, "progress", "revision", "metadata"
      FROM "Task" WHERE "id" = ANY($1::text[]) ORDER BY "id"
  `, [Object.values(S92_DB_FIXTURE.tasks).map(({ id }) => id)]);
  assertCount(tasks.rows, 3, 'canonical task');
  for (const expected of Object.values(S92_DB_FIXTURE.tasks)) {
    const actual = tasks.rows.find(({ id }) => id === expected.id);
    assertExact(actual?.projectId, S92_DB_FIXTURE.projects[expected.projectKey].id, `${expected.id} project`);
    assertExact(actual?.externalId, expected.externalId, `${expected.id} external ID`);
    assertExact(actual?.code, expected.code, `${expected.id} code`);
    assertExact(actual?.title, expected.title, `${expected.id} title`);
    assertExact(actual?.type, 'TASK', `${expected.id} type`);
    assertExact(actual?.status, expected.status, `${expected.id} status`);
    assertExact(actual?.progress, expected.progress, `${expected.id} progress`);
    assertExact(actual?.revision, 0, `${expected.id} revision`);
    assertExact(actual?.metadata?.source, 'canonical-task-v1', `${expected.id} canonical source`);
  }

  const evidence = await database.query(`
    SELECT "id", "projectId", "taskId", "status"::text, "revision"
      FROM "ProgressEvidence" WHERE "id" = $1
  `, [S92_DB_FIXTURE.evidence.id]);
  assertCount(evidence.rows, 1, 'approved evidence');
  assertExact(evidence.rows[0].projectId, S92_DB_FIXTURE.projects.primary.id, 'evidence project');
  assertExact(evidence.rows[0].taskId, S92_DB_FIXTURE.tasks.measured.id, 'evidence task');
  assertExact(evidence.rows[0].status, 'APPROVED', 'evidence status');
  assertExact(evidence.rows[0].revision, 0, 'evidence revision');
}

export function buildS92E2EDescriptor(clerkFixture) {
  const actorIds = expectedActorDatabaseIds();
  const primaryActors = Object.fromEntries(
    ['admin', 'director', 'siteManager', 'finance', 'auditor'].map((actorKey) => [actorKey, {
      email: clerkFixture.actors[actorKey].email,
      membershipId: actorIds[actorKey].membershipId,
      expectedRole: clerkFixture.actors[actorKey].tenantRole,
    }]),
  );
  return {
    schemaVersion: 1,
    fixtureId: S92_FIXTURE_ID,
    primary: {
      clerkOrganizationId: clerkFixture.organizations.tenantA.clerkOrganizationId,
      databaseOrganizationId: S92_DB_FIXTURE.organizations.tenantA.id,
      anchorProjectId: S92_DB_FIXTURE.projects.primaryAnchor.id,
      project: {
        id: S92_DB_FIXTURE.projects.primary.id,
        name: S92_DB_FIXTURE.projects.primary.name,
        slug: S92_DB_FIXTURE.projects.primary.slug,
        status: 'ACTIVE',
      },
      actors: primaryActors,
      tasks: {
        measured: {
          id: S92_DB_FIXTURE.tasks.measured.id,
          code: S92_DB_FIXTURE.tasks.measured.code,
          title: S92_DB_FIXTURE.tasks.measured.title,
          revision: 0,
          initialProgress: S92_DB_FIXTURE.tasks.measured.progress,
        },
        missing: {
          id: S92_DB_FIXTURE.tasks.missing.id,
          code: S92_DB_FIXTURE.tasks.missing.code,
          title: S92_DB_FIXTURE.tasks.missing.title,
          revision: 0,
          initialProgress: S92_DB_FIXTURE.tasks.missing.progress,
        },
      },
      evidence: {
        id: S92_DB_FIXTURE.evidence.id,
        taskId: S92_DB_FIXTURE.tasks.measured.id,
        status: 'APPROVED',
      },
    },
    otherTenant: {
      clerkOrganizationId: clerkFixture.organizations.tenantB.clerkOrganizationId,
      databaseOrganizationId: S92_DB_FIXTURE.organizations.tenantB.id,
      anchorProjectId: S92_DB_FIXTURE.projects.isolation.id,
      admin: {
        email: clerkFixture.actors.outsider.email,
        membershipId: actorIds.outsider.membershipId,
        expectedRole: 'ADMIN',
      },
    },
    period: S92_E2E_PERIOD,
    payloads: {
      measurementV1: {
        unit: 'M2',
        baselineQuantity: '100.0000',
        executedQuantity: '30.0000',
        method: 'DIRECT_COUNT',
        rationale: 'Medicion sintetica inicial S9.2 E2E.',
      },
      reviewV1: {
        decision: 'APPROVE',
        reason: 'Aprobacion sintetica inicial S9.2 E2E.',
      },
      measurementV2: {
        unit: 'M2',
        baselineQuantity: '100.0000',
        executedQuantity: '25.0000',
        method: 'DIRECT_COUNT',
        rationale: 'Correccion sintetica S9.2 E2E.',
      },
      reviewV2: {
        decision: 'APPROVE',
        reason: 'Aprobacion sintetica de correccion S9.2 E2E.',
      },
    },
    operationKeys: {
      measurementV1: 's92-e2e-measurement-v1',
      reviewV1: 's92-e2e-review-v1',
      cutV1: 's92-e2e-cut-v1',
      measurementV2: 's92-e2e-measurement-v2',
      reviewV2: 's92-e2e-review-v2',
      cutV2: 's92-e2e-cut-v2',
    },
  };
}

export function assertS92DescriptorHasNoSecrets(descriptor) {
  const serialized = JSON.stringify(descriptor);
  if (/sk_(?:test|live)_|postgres(?:ql)?:\/\//i.test(serialized)) {
    throw new Error('S9.2 E2E descriptor contains a credential-shaped value.');
  }
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      if (/(?:secret|password|token|databaseUrl|connectionString)/i.test(key)) {
        throw new Error(`S9.2 E2E descriptor contains forbidden key ${key}.`);
      }
      visit(nested);
    }
  };
  visit(descriptor);
  return true;
}

export async function seedS92E2EDatabase({
  environment = process.env,
  descriptorPath = environment.S92_E2E_FIXTURE_FILE || S92_E2E_DEFAULT_DESCRIPTOR_PATH,
  clerkFixture = null,
  database = null,
  clerkVerifier = provisionS92ClerkFixtures,
} = {}) {
  const authorization = authorizeS92DisposableDatabase(environment);
  const ownsDatabase = !database;
  const client = database || new Client({ connectionString: authorization.databaseUrl });
  if (ownsDatabase) await client.connect();
  try {
    const identity = await client.query(`
      SELECT current_database() AS database_name,
             inet_server_addr()::text AS server_address,
             inet_server_port() AS server_port
    `);
    assertS92RuntimeDatabaseIdentity(identity.rows[0]);
    const tables = await client.query(`
      SELECT to_regclass('public."Organization"') IS NOT NULL AS organization,
             to_regclass('public."TaskProgressMeasurementHead"') IS NOT NULL AS measurement_head,
             to_regclass('public."ProjectProgressMeasurementCut"') IS NOT NULL AS cut
    `);
    if (!tables.rows[0]?.organization || !tables.rows[0]?.measurement_head || !tables.rows[0]?.cut) {
      throw new Error('S9.2 E2E database is not fully migrated.');
    }

    const resolvedClerk = clerkFixture || (
      await clerkVerifier({ verify: true, secretKey: environment.CLERK_SECRET_KEY })
    ).fixture;
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    try {
      await client.query("SET LOCAL statement_timeout = '30000ms'");
      await assertNoS92LedgerHistory(client);
      await insertS92BaseRows(client, resolvedClerk);
      await verifyS92BaseRows(client, resolvedClerk);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    }

    const descriptor = buildS92E2EDescriptor(resolvedClerk);
    assertS92DescriptorHasNoSecrets(descriptor);
    const outputPath = resolve(descriptorPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(descriptor, null, 2)}\n`, 'utf8');
    return { descriptor, descriptorPath: outputPath };
  } finally {
    if (ownsDatabase) await client.end();
  }
}

const isMainModule = Boolean(
  process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
);

if (isMainModule) {
  const args = parseS92DatabaseSeedArgs(process.argv.slice(2));
  const result = await seedS92E2EDatabase(args);
  console.log(`S9.2 E2E disposable database fixture verified; descriptor: ${result.descriptorPath}`);
}
