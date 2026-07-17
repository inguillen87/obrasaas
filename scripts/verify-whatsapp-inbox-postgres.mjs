import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';

import { PrismaNeon } from '@prisma/adapter-neon';

const SMOKE_DATABASE_ENV = 'INBOX_SMOKE_DATABASE_URL';
const PRODUCTION_DATABASE_HOST = 'ep-square-bird-acm34eel.sa-east-1.aws.neon.tech';
const PRODUCTION_ENDPOINT_PREFIX = 'ep-square-bird-acm34eel';
const REQUIRED_MIGRATIONS = Object.freeze([
  '20260717120000_whatsapp_inbox_read_state',
  '20260717121000_whatsapp_inbox_read_state_indexes',
]);
const REQUIRED_INDEXES = Object.freeze([
  'Conversation_projectId_channel_updatedAt_id_idx',
  'Message_conversationId_createdAt_id_idx',
  'Message_conversationId_direction_createdAt_id_idx',
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
});

function smokeDatabaseUrl() {
  const value = String(process.env[SMOKE_DATABASE_ENV] || '').trim();
  assert.ok(
    value,
    `${SMOKE_DATABASE_ENV} is required; DATABASE_URL is deliberately ignored.`,
  );

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${SMOKE_DATABASE_ENV} must be a valid PostgreSQL URL.`);
  }

  assert.ok(
    ['postgres:', 'postgresql:'].includes(parsed.protocol),
    `${SMOKE_DATABASE_ENV} must use the postgres or postgresql protocol.`,
  );
  const hostname = parsed.hostname.toLowerCase();
  assert.notEqual(
    hostname,
    PRODUCTION_DATABASE_HOST,
    'Refusing to run the Inbox smoke test against the production database host.',
  );
  assert.ok(
    !hostname.startsWith(`${PRODUCTION_ENDPOINT_PREFIX}-pooler.`),
    'Refusing to run the Inbox smoke test against the production pooler host.',
  );
  assert.ok(
    hostname.endsWith('.neon.tech'),
    'The Inbox smoke test only accepts an isolated Neon branch.',
  );
  return value;
}

function fixtureIdentity() {
  const token = randomUUID().replaceAll('-', '');
  const slugToken = token.slice(0, 20);
  return {
    organizationId: `inbox_smoke_org_${token}`,
    organizationSlug: `inbox-smoke-${slugToken}`,
    projectId: `inbox_smoke_project_${token}`,
    actorAId: `inbox_smoke_actor_a_${token}`,
    actorBId: `inbox_smoke_actor_b_${token}`,
    actorCId: `inbox_smoke_actor_c_${token}`,
    actorAEmail: `inbox-smoke-a-${token}@invalid.example`,
    actorBEmail: `inbox-smoke-b-${token}@invalid.example`,
    actorCEmail: `inbox-smoke-c-${token}@invalid.example`,
    actorAClerkId: `inbox_smoke_clerk_a_${token}`,
    actorBClerkId: `inbox_smoke_clerk_b_${token}`,
    actorCClerkId: `inbox_smoke_clerk_c_${token}`,
    membershipAId: `inbox_smoke_membership_a_${token}`,
    membershipBId: `inbox_smoke_membership_b_${token}`,
    projectMembershipAId: `inbox_smoke_project_membership_a_${token}`,
    baselineConversationId: `inbox_smoke_baseline_${token}`,
    nullBaselineConversationId: `inbox_smoke_null_${token}`,
    paginationConversationId: `inbox_smoke_page_${token}`,
    prefix: `inbox_smoke_${token}`,
  };
}

function accessFor(fixture, actorId) {
  const tenantMembershipId = actorId === fixture.actorAId
    ? fixture.membershipAId
    : actorId === fixture.actorBId
      ? fixture.membershipBId
      : null;
  return {
    databaseUserId: actorId,
    tenantMembershipId,
    organization: {
      id: fixture.organizationId,
      name: 'Inbox PostgreSQL smoke organization',
    },
    project: {
      id: fixture.projectId,
      organizationId: fixture.organizationId,
      name: 'Inbox PostgreSQL smoke project',
    },
  };
}

function conversationById(inbox, conversationId) {
  return inbox.conversations.find((conversation) => conversation.id === conversationId);
}

async function assertMigrationApplied(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "migration_name" AS "migrationName"
       FROM "_prisma_migrations"
      WHERE "migration_name" = ANY($1::text[])
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL`,
    REQUIRED_MIGRATIONS,
  );
  assert.deepEqual(
    new Set(rows.map((row) => row.migrationName)),
    new Set(REQUIRED_MIGRATIONS),
    'All Inbox read-state migrations must be applied on the smoke branch.',
  );
}

async function assertInboxIndexesReady(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT index_class."relname"::text AS "indexName",
            index_state."indisvalid" AS "isValid",
            index_state."indisready" AS "isReady"
       FROM "pg_class" AS index_class
       INNER JOIN "pg_index" AS index_state
         ON index_state."indexrelid" = index_class."oid"
      WHERE index_class."relname" = ANY($1::text[])`,
    REQUIRED_INDEXES,
  );
  assert.deepEqual(
    new Set(rows.map((row) => row.indexName)),
    new Set(REQUIRED_INDEXES),
    'Every Inbox read-state index must exist on the smoke branch.',
  );
  assert.equal(
    rows.every((row) => row.isValid === true && row.isReady === true),
    true,
    'Every Inbox read-state index must be valid and ready.',
  );
}

async function seedScope(prisma, fixture) {
  const actorCreatedAt = new Date('2026-07-17T16:00:00.000Z');
  const tenantJoinedAt = new Date('2026-07-17T17:00:00.000Z');
  const projectJoinedAt = new Date('2026-07-17T18:00:00.000Z');
  await prisma.platformUser.createMany({
    data: [
      {
        id: fixture.actorAId,
        clerkUserId: fixture.actorAClerkId,
        primaryEmail: fixture.actorAEmail,
        fullName: 'Inbox Smoke A',
        createdAt: actorCreatedAt,
      },
      {
        id: fixture.actorBId,
        clerkUserId: fixture.actorBClerkId,
        primaryEmail: fixture.actorBEmail,
        fullName: 'Inbox Smoke B',
        createdAt: actorCreatedAt,
      },
      {
        id: fixture.actorCId,
        clerkUserId: fixture.actorCClerkId,
        primaryEmail: fixture.actorCEmail,
        fullName: 'Inbox Smoke C',
        createdAt: actorCreatedAt,
      },
    ],
  });
  await prisma.organization.create({
    data: {
      id: fixture.organizationId,
      name: 'Inbox PostgreSQL smoke organization',
      slug: fixture.organizationSlug,
      projects: {
        create: {
          id: fixture.projectId,
          name: 'Inbox PostgreSQL smoke project',
          slug: 'inbox-postgres-smoke',
          status: 'ACTIVE',
        },
      },
    },
  });
  await prisma.tenantMembership.createMany({
    data: [
      {
        id: fixture.membershipAId,
        organizationId: fixture.organizationId,
        userId: fixture.actorAId,
        tenantRole: 'ADMIN',
        status: 'ACTIVE',
        createdAt: tenantJoinedAt,
      },
      {
        id: fixture.membershipBId,
        organizationId: fixture.organizationId,
        userId: fixture.actorBId,
        tenantRole: 'ADMIN',
        status: 'ACTIVE',
        createdAt: tenantJoinedAt,
      },
    ],
  });
  await prisma.projectMembership.create({
    data: {
      id: fixture.projectMembershipAId,
      projectId: fixture.projectId,
      tenantMembershipId: fixture.membershipAId,
      status: 'ACTIVE',
      createdAt: projectJoinedAt,
    },
  });
}

async function verifyUnreadSql({ prisma, fixture, listWhatsAppInbox }) {
  const baseline = new Date('2026-07-17T20:00:00.000Z');
  const beforeBaseline = new Date(baseline.getTime() - 60_000);
  const afterBaseline = new Date(baseline.getTime() + 60_000);
  const beforeActor = new Date('2026-07-17T15:30:00.000Z');
  const afterActor = new Date('2026-07-17T16:30:00.000Z');
  const afterTenant = new Date('2026-07-17T17:30:00.000Z');
  const afterProject = new Date('2026-07-17T18:30:00.000Z');

  await prisma.conversation.create({
    data: {
      id: fixture.baselineConversationId,
      projectId: fixture.projectId,
      channel: 'whatsapp',
      externalId: 'meta:5491100000001',
      displayName: 'Baseline contact',
      unreadTrackingStartedAt: baseline,
      updatedAt: afterBaseline,
      messages: {
        create: [
          {
            id: `${fixture.prefix}_baseline_before`,
            direction: 'INBOUND',
            body: 'Historical inbound before baseline',
            sentAt: beforeBaseline,
            createdAt: beforeBaseline,
          },
          {
            id: `${fixture.prefix}_baseline_after`,
            direction: 'INBOUND',
            body: 'New inbound after baseline',
            sentAt: afterBaseline,
            createdAt: afterBaseline,
          },
        ],
      },
    },
  });
  await prisma.conversation.create({
    data: {
      id: fixture.nullBaselineConversationId,
      projectId: fixture.projectId,
      channel: 'whatsapp',
      externalId: 'meta:5491100000002',
      displayName: 'Null baseline contact',
      unreadTrackingStartedAt: null,
      updatedAt: beforeBaseline,
      messages: {
        create: [
          {
            id: `${fixture.prefix}_before_actor`,
            direction: 'INBOUND',
            body: 'Historical inbound before the platform user existed',
            sentAt: beforeActor,
            createdAt: beforeActor,
          },
          {
            id: `${fixture.prefix}_after_actor`,
            direction: 'INBOUND',
            body: 'Inbound after platform-user creation',
            sentAt: afterActor,
            createdAt: afterActor,
          },
          {
            id: `${fixture.prefix}_after_tenant`,
            direction: 'INBOUND',
            body: 'Inbound after tenant membership',
            sentAt: afterTenant,
            createdAt: afterTenant,
          },
          {
            id: `${fixture.prefix}_after_project`,
            direction: 'INBOUND',
            body: 'Inbound after project access',
            sentAt: afterProject,
            createdAt: afterProject,
          },
        ],
      },
    },
  });

  const inboxA = await listWhatsAppInbox({
    prisma,
    access: accessFor(fixture, fixture.actorAId),
    limit: 10,
    env: {},
  });
  assert.equal(
    inboxA.conversations.length,
    2,
    'The real Inbox list query must return both seeded WhatsApp conversations.',
  );
  assert.equal(inboxA.unreadTotal, 2, 'Project-scoped access must ignore earlier history.');
  assert.equal(
    conversationById(inboxA, fixture.baselineConversationId)?.unreadCount,
    1,
    'Only the inbound recorded after the baseline must be unread.',
  );
  assert.equal(
    conversationById(inboxA, fixture.nullBaselineConversationId)?.unreadCount,
    1,
    'A project membership must baseline unread work at project access.',
  );
  assert.deepEqual(inboxA.pageInfo, { hasMore: false, nextCursor: null });

  const inboxB = await listWhatsAppInbox({
    prisma,
    access: accessFor(fixture, fixture.actorBId),
    limit: 10,
    env: {},
  });
  assert.equal(inboxB.unreadTotal, 3);
  assert.equal(
    conversationById(inboxB, fixture.nullBaselineConversationId)?.unreadCount,
    2,
    'A tenant member without a project-membership row must use tenant join time.',
  );

  const inboxC = await listWhatsAppInbox({
    prisma,
    access: accessFor(fixture, fixture.actorCId),
    limit: 10,
    env: {},
  });
  assert.equal(inboxC.unreadTotal, 4);
  assert.equal(
    conversationById(inboxC, fixture.nullBaselineConversationId)?.unreadCount,
    3,
    'A trusted actor without tenant membership must use platform-user creation time.',
  );
}

async function seedPaginationConversation(prisma, fixture) {
  const olderAt = new Date('2026-07-17T21:00:00.000Z');
  const tiedAt = new Date('2026-07-17T21:01:00.000Z');
  const ids = {
    older: `${fixture.prefix}_page_a`,
    tiedLower: `${fixture.prefix}_page_b`,
    tiedHigher: `${fixture.prefix}_page_c`,
  };
  await prisma.conversation.create({
    data: {
      id: fixture.paginationConversationId,
      projectId: fixture.projectId,
      channel: 'whatsapp',
      externalId: 'meta:5491100000003',
      displayName: 'Pagination contact',
      unreadTrackingStartedAt: null,
      updatedAt: tiedAt,
      messages: {
        create: [
          {
            id: ids.older,
            direction: 'INBOUND',
            body: 'Older page message',
            sentAt: olderAt,
            createdAt: olderAt,
          },
          {
            id: ids.tiedLower,
            direction: 'INBOUND',
            body: 'Tied lower id',
            sentAt: tiedAt,
            createdAt: tiedAt,
          },
          {
            id: ids.tiedHigher,
            direction: 'INBOUND',
            body: 'Tied higher id',
            sentAt: tiedAt,
            createdAt: tiedAt,
          },
        ],
      },
    },
  });
  return ids;
}

async function verifyMessagePagination({
  prisma,
  fixture,
  ids,
  getWhatsAppConversationMessages,
}) {
  const input = {
    prisma,
    access: accessFor(fixture, fixture.actorAId),
    conversationId: fixture.paginationConversationId,
    limit: 2,
    env: {},
  };
  const first = await getWhatsAppConversationMessages(input);
  assert.deepEqual(
    first.messages.map((message) => message.id),
    [ids.tiedLower, ids.tiedHigher],
  );
  assert.equal(first.pageInfo.hasMore, true);
  assert.ok(first.pageInfo.nextCursor);

  const second = await getWhatsAppConversationMessages({
    ...input,
    cursor: first.pageInfo.nextCursor,
  });
  assert.deepEqual(second.messages.map((message) => message.id), [ids.older]);
  assert.deepEqual(second.pageInfo, { hasMore: false, nextCursor: null });
  assert.equal(
    first.messages.some((message) => second.messages.some((older) => older.id === message.id)),
    false,
    'Message pages must not overlap.',
  );
}

async function verifyReadState({
  prisma,
  fixture,
  ids,
  markWhatsAppConversationRead,
  WhatsAppInboxError,
}) {
  await assert.rejects(
    markWhatsAppConversationRead({
      prisma,
      access: accessFor(fixture, fixture.actorAId),
      conversationId: fixture.paginationConversationId,
      throughMessageId: `${fixture.prefix}_missing`,
    }),
    (error) => (
      error instanceof WhatsAppInboxError
      && error.code === 'INBOX_READ_TARGET_NOT_FOUND'
      && error.status === 404
    ),
  );

  await Promise.all([
    markWhatsAppConversationRead({
      prisma,
      access: accessFor(fixture, fixture.actorAId),
      conversationId: fixture.paginationConversationId,
      throughMessageId: ids.tiedLower,
    }),
    markWhatsAppConversationRead({
      prisma,
      access: accessFor(fixture, fixture.actorAId),
      conversationId: fixture.paginationConversationId,
      throughMessageId: ids.tiedHigher,
    }),
  ]);
  const actorBResult = await markWhatsAppConversationRead({
    prisma,
    access: accessFor(fixture, fixture.actorBId),
    conversationId: fixture.paginationConversationId,
    throughMessageId: ids.tiedLower,
  });

  const states = await prisma.conversationReadState.findMany({
    where: { conversationId: fixture.paginationConversationId },
    orderBy: { platformUserId: 'asc' },
  });
  assert.equal(states.length, 2);
  assert.equal(
    states.find((state) => state.platformUserId === fixture.actorAId)?.lastReadMessageId,
    ids.tiedHigher,
    'Concurrent read updates must never regress the actor watermark.',
  );
  assert.equal(
    states.find((state) => state.platformUserId === fixture.actorBId)?.lastReadMessageId,
    ids.tiedLower,
    'Each platform user must retain an independent watermark.',
  );
  assert.equal(actorBResult.unreadCount, 1);
}

async function cleanupFixture(prisma, fixture) {
  // Organization -> Project -> Conversation -> Message/ConversationReadState
  // is a database-level cascade. Users are independent fixture roots.
  await prisma.organization.deleteMany({
    where: { id: fixture.organizationId },
  });
  await prisma.platformUser.deleteMany({
    where: { id: { in: [fixture.actorAId, fixture.actorBId, fixture.actorCId] } },
  });
}

function safeErrorMessage(error) {
  return String(error?.message || error || 'Unknown smoke-test failure')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]');
}

async function main() {
  const connectionString = smokeDatabaseUrl();
  const [{ PrismaClient }, inbox] = await Promise.all([
    import('../src/generated/prisma/client.ts'),
    import('../src/lib/whatsapp/inbox.js'),
  ]);
  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });
  const fixture = fixtureIdentity();
  let primaryError = null;

  try {
    await assertMigrationApplied(prisma);
    await assertInboxIndexesReady(prisma);
    await seedScope(prisma, fixture);
    await verifyUnreadSql({
      prisma,
      fixture,
      listWhatsAppInbox: inbox.listWhatsAppInbox,
    });
    const ids = await seedPaginationConversation(prisma, fixture);
    await verifyMessagePagination({
      prisma,
      fixture,
      ids,
      getWhatsAppConversationMessages: inbox.getWhatsAppConversationMessages,
    });
    await verifyReadState({
      prisma,
      fixture,
      ids,
      markWhatsAppConversationRead: inbox.markWhatsAppConversationRead,
      WhatsAppInboxError: inbox.WhatsAppInboxError,
    });
    console.log('WhatsApp Inbox PostgreSQL smoke: PASS');
    console.log('Verified: migration, real unread SQL, baselines, pagination, and read-state concurrency.');
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      await cleanupFixture(prisma, fixture);
    } catch (cleanupError) {
      primaryError = primaryError
        ? new AggregateError([primaryError, cleanupError], 'Smoke test and fixture cleanup failed.')
        : cleanupError;
    }
    await prisma.$disconnect().catch((disconnectError) => {
      primaryError = primaryError
        ? new AggregateError([primaryError, disconnectError], 'Smoke test and disconnect failed.')
        : disconnectError;
    });
  }

  if (primaryError) throw primaryError;
}

main().catch((error) => {
  console.error(`WhatsApp Inbox PostgreSQL smoke: FAIL - ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});
