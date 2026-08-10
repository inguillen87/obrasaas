import assert from "node:assert/strict";
import { test } from "node:test";

import {
  databaseIdentityDigest,
  evaluateMigrationGate,
  MigrationGateError,
  normalizeDatabaseIdentity,
  PRODUCTION_DATABASE_IDENTITY_ENV,
  PRODUCTION_MIGRATION_RELEASE_ENV,
  resolvePrismaDatabaseEnvironment,
  runVercelBuild,
} from "../scripts/vercel-build.mjs";

const PRODUCTION_URL =
  "postgresql://obra_admin:production-secret@ep-production.us-east-2.aws.neon.tech/obrasaas?sslmode=require";
const PRODUCTION_POOLER_URL =
  "postgresql://obra_admin:production-secret@ep-production-pooler.us-east-2.aws.neon.tech/obrasaas?sslmode=require";
const PREVIEW_URL =
  "postgresql://obra_admin:preview-secret@ep-preview.us-east-2.aws.neon.tech/obrasaas?sslmode=require";
const PREVIEW_POOLER_URL =
  "postgresql://obra_admin:preview-secret@ep-preview-pooler.us-east-2.aws.neon.tech/obrasaas?sslmode=require";
const COMMIT_SHA = "a".repeat(40);

function digestHex(databaseUrl) {
  return databaseIdentityDigest(databaseUrl).toString("hex");
}

function environment(overrides = {}) {
  return {
    VERCEL_ENV: "preview",
    DIRECT_URL: PREVIEW_URL,
    DATABASE_URL_UNPOOLED: PREVIEW_URL,
    DATABASE_URL: PREVIEW_POOLER_URL,
    [PRODUCTION_DATABASE_IDENTITY_ENV]: digestHex(PRODUCTION_URL),
    ...overrides,
  };
}

test("database identity excludes passwords and connection options", () => {
  const first =
    "postgresql://obra_admin:first@EP-PRODUCTION.us-east-2.aws.neon.tech:5432/obrasaas?sslmode=require";
  const second =
    "postgres://obra_admin:second@ep-production.us-east-2.aws.neon.tech/obrasaas?connect_timeout=10";

  assert.equal(normalizeDatabaseIdentity(first), normalizeDatabaseIdentity(second));
  assert.deepEqual(databaseIdentityDigest(first), databaseIdentityDigest(second));
  assert.equal(normalizeDatabaseIdentity(first).includes("first"), false);
  assert.equal(normalizeDatabaseIdentity(first).includes("second"), false);
});

test("database identity decodes and NFC-normalizes username and database", () => {
  const encoded =
    "postgresql://obra%5Fadmin:secret@ep-preview.neon.tech/obra%73aas";
  const plain = "postgresql://obra_admin:different@ep-preview.neon.tech/obrasaas";

  assert.equal(normalizeDatabaseIdentity(encoded), normalizeDatabaseIdentity(plain));
});

test("Neon direct and pooler URLs normalize to the same branch identity", () => {
  assert.equal(
    normalizeDatabaseIdentity(PRODUCTION_URL),
    normalizeDatabaseIdentity(PRODUCTION_POOLER_URL),
  );
  assert.deepEqual(
    databaseIdentityDigest(PRODUCTION_URL),
    databaseIdentityDigest(PRODUCTION_POOLER_URL),
  );
});

test("Prisma migration URL follows prisma.config.ts precedence exactly", () => {
  assert.equal(resolvePrismaDatabaseEnvironment(environment()), "DIRECT_URL");
  assert.equal(
    resolvePrismaDatabaseEnvironment({
      DATABASE_URL_UNPOOLED: PREVIEW_URL,
      DATABASE_URL: PREVIEW_POOLER_URL,
    }),
    "DATABASE_URL_UNPOOLED",
  );
  assert.equal(
    resolvePrismaDatabaseEnvironment({ DATABASE_URL: PREVIEW_POOLER_URL }),
    "DATABASE_URL",
  );
});

test("preview approves only a Neon identity different from production", () => {
  assert.deepEqual(evaluateMigrationGate(environment()), {
    migrate: true,
    environment: "preview",
    migrationDatabaseEnvironment: "DIRECT_URL",
  });

  assert.throws(
    () =>
      evaluateMigrationGate(
        environment({
          DIRECT_URL: PRODUCTION_URL,
          DATABASE_URL_UNPOOLED: PRODUCTION_URL,
          DATABASE_URL: PRODUCTION_URL,
        }),
      ),
    /identity is production/,
  );
});

test("preview fails closed for a missing production identity", () => {
  const env = environment();
  delete env[PRODUCTION_DATABASE_IDENTITY_ENV];

  assert.throws(
    () => evaluateMigrationGate(env),
    new RegExp(PRODUCTION_DATABASE_IDENTITY_ENV),
  );
});

test("preview fails closed for malformed hashes and non-Neon databases", () => {
  assert.throws(
    () =>
      evaluateMigrationGate(
        environment({ [PRODUCTION_DATABASE_IDENTITY_ENV]: "not-a-hash" }),
      ),
    /64-character SHA-256/,
  );
  assert.throws(
    () =>
      evaluateMigrationGate(
        environment({
          DIRECT_URL: undefined,
          DATABASE_URL_UNPOOLED: undefined,
          DATABASE_URL: "postgresql://user:secret@database.example.com/obrasaas",
        }),
      ),
    /approved Neon connection/,
  );
});

test("preview requires runtime and migration connections on the same Neon branch", () => {
  assert.throws(
    () =>
      evaluateMigrationGate(
        environment({ DATABASE_URL: PRODUCTION_POOLER_URL }),
      ),
    /same Neon branch/,
  );
  assert.throws(
    () =>
      evaluateMigrationGate({
        VERCEL_ENV: "preview",
        DIRECT_URL: PREVIEW_URL,
        [PRODUCTION_DATABASE_IDENTITY_ENV]: digestHex(PRODUCTION_URL),
      }),
    /DATABASE_URL is required/,
  );
});

test("Vercel migrations reject a non-public schema before running", async () => {
  let calls = 0;

  await assert.rejects(
    runVercelBuild({
      environment: environment({
        DIRECT_URL: `${PREVIEW_URL}&schema=tenant_private`,
      }),
      runner: async () => {
        calls += 1;
      },
    }),
    /restricted to the public schema/,
  );
  assert.equal(calls, 0);
});

test("production requires an exact commit-bound release authorization", () => {
  const base = environment({
    VERCEL_ENV: "production",
    DIRECT_URL: PRODUCTION_URL,
    DATABASE_URL_UNPOOLED: PRODUCTION_URL,
    DATABASE_URL: PRODUCTION_POOLER_URL,
    VERCEL_GIT_COMMIT_SHA: COMMIT_SHA,
  });

  assert.throws(
    () => evaluateMigrationGate(base),
    new RegExp(PRODUCTION_MIGRATION_RELEASE_ENV),
  );
  assert.throws(
    () =>
      evaluateMigrationGate({
        ...base,
        [PRODUCTION_MIGRATION_RELEASE_ENV]: "b".repeat(40),
      }),
    /exactly match/,
  );
  assert.deepEqual(
    evaluateMigrationGate({
      ...base,
      [PRODUCTION_MIGRATION_RELEASE_ENV]: COMMIT_SHA,
    }),
    {
      migrate: true,
      environment: "production",
      migrationDatabaseEnvironment: "DIRECT_URL",
    },
  );
});

test("production authorization cannot migrate an unapproved database identity", () => {
  assert.throws(
    () =>
      evaluateMigrationGate(
        environment({
          VERCEL_ENV: "production",
          VERCEL_GIT_COMMIT_SHA: COMMIT_SHA,
          [PRODUCTION_MIGRATION_RELEASE_ENV]: COMMIT_SHA,
        }),
      ),
    /identity is not approved/,
  );
});

test("local and Vercel development builds do not require database credentials", () => {
  assert.deepEqual(evaluateMigrationGate({}), {
    migrate: false,
    environment: "development",
  });
  assert.deepEqual(evaluateMigrationGate({ VERCEL_ENV: "development" }), {
    migrate: false,
    environment: "development",
  });
});

test("unknown Vercel environments fail closed", () => {
  assert.throws(
    () => evaluateMigrationGate({ VERCEL_ENV: "staging" }),
    MigrationGateError,
  );
});

test("preview runner migrates before generating and building without a shell", async () => {
  const calls = [];
  const runner = async (file, args, options) => {
    calls.push({ file, args, options });
  };

  await runVercelBuild({
    environment: environment(),
    cwd: "C:/safe-worktree",
    runner,
    cliPaths: {
      prisma: "prisma-cli",
      next: "next-cli",
      workerIdentityVerifier: "worker-verifier",
      progressJournalVerifier: "progress-verifier",
      protectedUploadVerifier: "protected-upload-verifier",
      whatsappMediaAssetVerifier: "whatsapp-media-asset-verifier",
      visualProgressVerifier: "visual-progress-verifier",
      scheduleSnapshotVerifier: "schedule-snapshot-verifier",
      notificationOutboxVerifier: "notification-outbox-verifier",
      projectExecutionVerifier: "project-execution-verifier",
      dataSubjectDiscoveryVerifier: "data-subject-verifier",
    },
  });

  assert.deepEqual(
    calls.map(({ args }) => args),
    [
      ["prisma-cli", "migrate", "deploy"],
      ["worker-verifier"],
      ["progress-verifier"],
      ["protected-upload-verifier"],
      ["whatsapp-media-asset-verifier"],
      ["visual-progress-verifier"],
      ["schedule-snapshot-verifier"],
      ["notification-outbox-verifier"],
      ["project-execution-verifier"],
      ["data-subject-verifier"],
      ["prisma-cli", "generate"],
      ["next-cli", "build"],
    ],
  );
  assert.equal(calls.every(({ file }) => file === process.execPath), true);
  assert.equal(calls.every(({ options }) => options.cwd === "C:/safe-worktree"), true);
  assert.equal(calls.every(({ options }) => options.shell === false), true);
  assert.equal(calls.every(({ options }) => options.stdio === "inherit"), true);
  const verificationCall = calls[1];
  assert.equal(verificationCall.args[0], "worker-verifier");
  assert.notEqual(verificationCall.args[0], undefined);
  assert.equal(
    verificationCall.options.env.WORKER_IDENTITY_MIGRATION_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    verificationCall.options.env.WORKER_IDENTITY_MIGRATION_SCHEMA,
    "public",
  );
  const progressVerificationCall = calls[2];
  assert.equal(progressVerificationCall.args[0], "progress-verifier");
  assert.equal(
    progressVerificationCall.options.env.PROGRESS_JOURNAL_MIGRATION_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    progressVerificationCall.options.env.PROGRESS_JOURNAL_MIGRATION_SCHEMA,
    "public",
  );
  const protectedUploadVerificationCall = calls[3];
  assert.equal(
    protectedUploadVerificationCall.args[0],
    "protected-upload-verifier",
  );
  assert.equal(
    protectedUploadVerificationCall.options.env.PROTECTED_UPLOAD_MIGRATION_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    protectedUploadVerificationCall.options.env.PROTECTED_UPLOAD_MIGRATION_SCHEMA,
    "public",
  );
  const mediaAssetVerificationCall = calls[4];
  assert.equal(
    mediaAssetVerificationCall.args[0],
    "whatsapp-media-asset-verifier",
  );
  assert.equal(
    mediaAssetVerificationCall.options.env.WHATSAPP_MEDIA_ASSET_MIGRATION_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    mediaAssetVerificationCall.options.env.WHATSAPP_MEDIA_ASSET_MIGRATION_SCHEMA,
    "public",
  );
  const visualProgressVerificationCall = calls[5];
  assert.equal(
    visualProgressVerificationCall.args[0],
    "visual-progress-verifier",
  );
  assert.equal(
    visualProgressVerificationCall.options.env.VISUAL_PROGRESS_MIGRATION_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    visualProgressVerificationCall.options.env.VISUAL_PROGRESS_MIGRATION_SCHEMA,
    "public",
  );
  const scheduleSnapshotVerificationCall = calls[6];
  assert.equal(
    scheduleSnapshotVerificationCall.args[0],
    "schedule-snapshot-verifier",
  );
  assert.equal(
    scheduleSnapshotVerificationCall.options.env.SCHEDULE_SNAPSHOT_MIGRATION_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    scheduleSnapshotVerificationCall.options.env.SCHEDULE_SNAPSHOT_MIGRATION_SCHEMA,
    "public",
  );
  const notificationOutboxVerificationCall = calls[7];
  assert.equal(
    notificationOutboxVerificationCall.args[0],
    "notification-outbox-verifier",
  );
  assert.equal(
    notificationOutboxVerificationCall.options.env.NOTIFICATION_OUTBOX_MIGRATION_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    notificationOutboxVerificationCall.options.env.NOTIFICATION_OUTBOX_MIGRATION_SCHEMA,
    "public",
  );
  const projectExecutionVerificationCall = calls[8];
  assert.equal(
    projectExecutionVerificationCall.args[0],
    "project-execution-verifier",
  );
  assert.equal(
    projectExecutionVerificationCall.options.env.PROJECT_EXECUTION_MIGRATION_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    projectExecutionVerificationCall.options.env.PROJECT_EXECUTION_MIGRATION_SCHEMA,
    "public",
  );
  const dataSubjectVerificationCall = calls.find(
    ({ args }) => args[0] === "data-subject-verifier",
  );
  assert.ok(dataSubjectVerificationCall);
  assert.equal(
    dataSubjectVerificationCall.options.env.DATA_SUBJECT_DISCOVERY_MIGRATION_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    dataSubjectVerificationCall.options.env.DATA_SUBJECT_DISCOVERY_MIGRATION_SCHEMA,
    "public",
  );
});

test("authorized production runs migration verification before the build", async () => {
  const calls = [];
  const productionEnvironment = environment({
    VERCEL_ENV: "production",
    DIRECT_URL: PRODUCTION_URL,
    DATABASE_URL_UNPOOLED: PRODUCTION_URL,
    DATABASE_URL: PRODUCTION_POOLER_URL,
    VERCEL_GIT_COMMIT_SHA: COMMIT_SHA,
    [PRODUCTION_MIGRATION_RELEASE_ENV]: COMMIT_SHA,
  });

  await runVercelBuild({
    environment: productionEnvironment,
    runner: async (_file, args, options) => calls.push({ args, options }),
    cliPaths: {
      prisma: "prisma-cli",
      next: "next-cli",
      workerIdentityVerifier: "worker-verifier",
      progressJournalVerifier: "progress-verifier",
      protectedUploadVerifier: "protected-upload-verifier",
      whatsappMediaAssetVerifier: "whatsapp-media-asset-verifier",
      visualProgressVerifier: "visual-progress-verifier",
      scheduleSnapshotVerifier: "schedule-snapshot-verifier",
      notificationOutboxVerifier: "notification-outbox-verifier",
      projectExecutionVerifier: "project-execution-verifier",
      dataSubjectDiscoveryVerifier: "data-subject-verifier",
    },
  });

  assert.deepEqual(
    calls.map(({ args }) => args),
    [
      ["prisma-cli", "migrate", "deploy"],
      ["worker-verifier"],
      ["progress-verifier"],
      ["protected-upload-verifier"],
      ["whatsapp-media-asset-verifier"],
      ["visual-progress-verifier"],
      ["schedule-snapshot-verifier"],
      ["notification-outbox-verifier"],
      ["project-execution-verifier"],
      ["data-subject-verifier"],
      ["prisma-cli", "generate"],
      ["next-cli", "build"],
    ],
  );
  assert.equal(
    calls[1].options.env.WORKER_IDENTITY_MIGRATION_DATABASE_URL,
    PRODUCTION_URL,
  );
  assert.equal(
    calls[1].options.env.WORKER_IDENTITY_MIGRATION_SCHEMA,
    "public",
  );
  assert.equal(
    calls[2].options.env.PROGRESS_JOURNAL_MIGRATION_DATABASE_URL,
    PRODUCTION_URL,
  );
  assert.equal(
    calls[2].options.env.PROGRESS_JOURNAL_MIGRATION_SCHEMA,
    "public",
  );
  assert.equal(
    calls[3].options.env.PROTECTED_UPLOAD_MIGRATION_DATABASE_URL,
    PRODUCTION_URL,
  );
  assert.equal(
    calls[3].options.env.PROTECTED_UPLOAD_MIGRATION_SCHEMA,
    "public",
  );
  assert.equal(
    calls[4].options.env.WHATSAPP_MEDIA_ASSET_MIGRATION_DATABASE_URL,
    PRODUCTION_URL,
  );
  assert.equal(
    calls[4].options.env.WHATSAPP_MEDIA_ASSET_MIGRATION_SCHEMA,
    "public",
  );
  assert.equal(
    calls[5].options.env.VISUAL_PROGRESS_MIGRATION_DATABASE_URL,
    PRODUCTION_URL,
  );
  assert.equal(
    calls[5].options.env.VISUAL_PROGRESS_MIGRATION_SCHEMA,
    "public",
  );
  assert.equal(
    calls[6].options.env.SCHEDULE_SNAPSHOT_MIGRATION_DATABASE_URL,
    PRODUCTION_URL,
  );
  assert.equal(
    calls[6].options.env.SCHEDULE_SNAPSHOT_MIGRATION_SCHEMA,
    "public",
  );
  assert.equal(
    calls[7].options.env.NOTIFICATION_OUTBOX_MIGRATION_DATABASE_URL,
    PRODUCTION_URL,
  );
  assert.equal(
    calls[7].options.env.NOTIFICATION_OUTBOX_MIGRATION_SCHEMA,
    "public",
  );
  assert.equal(
    calls[8].options.env.PROJECT_EXECUTION_MIGRATION_DATABASE_URL,
    PRODUCTION_URL,
  );
  assert.equal(
    calls[8].options.env.PROJECT_EXECUTION_MIGRATION_SCHEMA,
    "public",
  );
  const dataSubjectVerificationCall = calls.find(
    ({ args }) => args[0] === "data-subject-verifier",
  );
  assert.ok(dataSubjectVerificationCall);
  assert.equal(
    dataSubjectVerificationCall.options.env.DATA_SUBJECT_DISCOVERY_MIGRATION_DATABASE_URL,
    PRODUCTION_URL,
  );
  assert.equal(
    dataSubjectVerificationCall.options.env.DATA_SUBJECT_DISCOVERY_MIGRATION_SCHEMA,
    "public",
  );
});

test("data subject discovery verification fails the release before generate or build", async () => {
  const calls = [];

  await assert.rejects(
    runVercelBuild({
      environment: environment(),
      runner: async (_file, args) => {
        calls.push(args);
        if (args[0] === "data-subject-verifier") {
          throw new Error("privacy discovery verification failed");
        }
      },
      cliPaths: {
        prisma: "prisma-cli",
        next: "next-cli",
        workerIdentityVerifier: "worker-verifier",
        progressJournalVerifier: "progress-verifier",
        protectedUploadVerifier: "protected-upload-verifier",
        whatsappMediaAssetVerifier: "whatsapp-media-asset-verifier",
        visualProgressVerifier: "visual-progress-verifier",
        scheduleSnapshotVerifier: "schedule-snapshot-verifier",
        dataSubjectDiscoveryVerifier: "data-subject-verifier",
      },
    }),
    /privacy discovery verification failed/,
  );

  assert.equal(
    calls.some((args) => args[0] === "data-subject-verifier"),
    true,
  );
  assert.equal(
    calls.some(
      (args) =>
        args[0] === "prisma-cli" && args[1] === "generate",
    ),
    false,
  );
  assert.equal(calls.some((args) => args[0] === "next-cli"), false);
});

test("default Preview wiring executes the real data subject verifier before generate and build", async () => {
  const calls = [];

  await runVercelBuild({
    environment: environment(),
    runner: async (_file, args, options) => calls.push({ args, options }),
  });

  const migrateIndex = calls.findIndex(
    ({ args }) => args.at(-2) === "migrate" && args.at(-1) === "deploy",
  );
  const discoveryIndex = calls.findIndex(({ args }) =>
    args[0]?.endsWith("verify-data-subject-discovery-migration.mjs"),
  );
  const generateIndex = calls.findIndex(
    ({ args }) => args.at(-1) === "generate",
  );
  const buildIndex = calls.findIndex(
    ({ args }) => args.at(-1) === "build",
  );

  assert.ok(migrateIndex >= 0);
  assert.ok(discoveryIndex > migrateIndex);
  assert.ok(generateIndex > discoveryIndex);
  assert.ok(buildIndex > generateIndex);
  assert.equal(
    calls[discoveryIndex].options.env.DATA_SUBJECT_DISCOVERY_MIGRATION_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    calls[discoveryIndex].options.env.DATA_SUBJECT_DISCOVERY_MIGRATION_SCHEMA,
    "public",
  );
});

test("a rejected gate invokes no subprocess", async () => {
  let calls = 0;

  await assert.rejects(
    runVercelBuild({
      environment: environment({
        DIRECT_URL: PRODUCTION_URL,
        DATABASE_URL_UNPOOLED: PRODUCTION_URL,
        DATABASE_URL: PRODUCTION_POOLER_URL,
      }),
      runner: async () => {
        calls += 1;
      },
    }),
    /identity is production/,
  );
  assert.equal(calls, 0);
});

test("development runner skips migration and performs the normal build", async () => {
  const calls = [];

  await runVercelBuild({
    environment: {},
    runner: async (_file, args) => calls.push(args),
    cliPaths: {
      prisma: "prisma-cli",
      next: "next-cli",
      workerIdentityVerifier: "worker-verifier",
      progressJournalVerifier: "progress-verifier",
      protectedUploadVerifier: "protected-upload-verifier",
      whatsappMediaAssetVerifier: "whatsapp-media-asset-verifier",
      visualProgressVerifier: "visual-progress-verifier",
      scheduleSnapshotVerifier: "schedule-snapshot-verifier",
    },
  });

  assert.deepEqual(calls, [
    ["prisma-cli", "generate"],
    ["next-cli", "build"],
  ]);
});

test("notification project-scope preflight runs before migration with the gated database", async () => {
  const calls = [];
  await runVercelBuild({
    environment: environment(),
    cwd: "C:/safe-worktree",
    runner: async (_file, args, options) => calls.push({ args, options }),
    cliPaths: {
      prisma: "prisma-cli",
      next: "next-cli",
      workerIdentityVerifier: "worker-verifier",
      progressJournalVerifier: "progress-verifier",
      protectedUploadVerifier: "protected-upload-verifier",
      whatsappMediaAssetVerifier: "whatsapp-media-asset-verifier",
      visualProgressVerifier: "visual-progress-verifier",
      scheduleSnapshotVerifier: "schedule-snapshot-verifier",
      notificationOutboxScopePreflight: "notification-scope-preflight",
    },
  });

  assert.deepEqual(calls[0].args, ["notification-scope-preflight"]);
  assert.deepEqual(calls[1].args, ["prisma-cli", "migrate", "deploy"]);
  assert.equal(
    calls[0].options.env.NOTIFICATION_OUTBOX_PREFLIGHT_DATABASE_URL,
    PREVIEW_URL,
  );
  assert.equal(
    calls[0].options.env.NOTIFICATION_OUTBOX_PREFLIGHT_SCHEMA,
    "public",
  );
  assert.equal(calls[0].options.shell, false);
});

test("a failing notification scope preflight stops before migration DDL", async () => {
  const calls = [];
  await assert.rejects(
    runVercelBuild({
      environment: environment(),
      runner: async (_file, args) => {
        calls.push(args);
        if (args[0] === "notification-scope-preflight") {
          throw new Error("incompatible notification scope");
        }
      },
      cliPaths: {
        prisma: "prisma-cli",
        next: "next-cli",
        notificationOutboxScopePreflight: "notification-scope-preflight",
      },
    }),
    /incompatible notification scope/,
  );
  assert.deepEqual(calls, [["notification-scope-preflight"]]);
});
