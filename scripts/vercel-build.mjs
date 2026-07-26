import { spawn } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);

const DATABASE_IDENTITY_DOMAIN = "obrasaas-database-identity-v1";
const POSTGRES_DEFAULT_PORT = "5432";
const SHA256_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;
const GIT_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const PRISMA_DATABASE_ENVIRONMENTS = Object.freeze([
  "DIRECT_URL",
  "DATABASE_URL_UNPOOLED",
  "DATABASE_URL",
]);
const WORKER_IDENTITY_VERIFIER_PATH = fileURLToPath(
  new URL("./verify-worker-identity-migrations.mjs", import.meta.url),
);
const PROGRESS_JOURNAL_VERIFIER_PATH = fileURLToPath(
  new URL("./verify-progress-journal-migration.mjs", import.meta.url),
);
const PROTECTED_UPLOAD_VERIFIER_PATH = fileURLToPath(
  new URL("./verify-protected-upload-migration.mjs", import.meta.url),
);
const VISUAL_PROGRESS_VERIFIER_PATH = fileURLToPath(
  new URL("./verify-visual-progress-migration.mjs", import.meta.url),
);

export const PRODUCTION_DATABASE_IDENTITY_ENV =
  "OBRASAAS_PRODUCTION_DATABASE_IDENTITY_SHA256";
export const PRODUCTION_MIGRATION_RELEASE_ENV =
  "OBRASAAS_PRODUCTION_MIGRATION_RELEASE_SHA";

export class MigrationGateError extends Error {
  constructor(message) {
    super(message);
    this.name = "MigrationGateError";
  }
}

function normalizeIdentifier(value, label) {
  let decoded;

  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new MigrationGateError(`DATABASE_URL has an invalid ${label}.`);
  }

  const normalized = decoded.normalize("NFC");
  if (!normalized || normalized.includes("\0")) {
    throw new MigrationGateError(`DATABASE_URL must include a valid ${label}.`);
  }

  return normalized;
}

function normalizeDatabaseHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (!normalized.endsWith(".neon.tech")) {
    return normalized;
  }

  const labels = normalized.split(".");
  labels[0] = labels[0].replace(/-pooler$/, "");
  return labels.join(".");
}

/**
 * Produces a stable identity without retaining the password or connection
 * options. Username and database name remain case-sensitive because they are
 * authentication identifiers; the DNS hostname is case-insensitive.
 */
export function normalizeDatabaseIdentity(databaseUrl) {
  if (
    typeof databaseUrl !== "string" ||
    databaseUrl.length === 0 ||
    databaseUrl !== databaseUrl.trim()
  ) {
    throw new MigrationGateError("DATABASE_URL is missing or malformed.");
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new MigrationGateError("DATABASE_URL is missing or malformed.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new MigrationGateError("DATABASE_URL must use PostgreSQL.");
  }

  const host = normalizeDatabaseHostname(parsed.hostname);
  if (!host || parsed.hash) {
    throw new MigrationGateError("DATABASE_URL is missing or malformed.");
  }

  const databasePath = parsed.pathname.startsWith("/")
    ? parsed.pathname.slice(1)
    : parsed.pathname;
  if (!databasePath || databasePath.includes("/")) {
    throw new MigrationGateError("DATABASE_URL must name exactly one database.");
  }

  const identity = {
    host,
    port: parsed.port || POSTGRES_DEFAULT_PORT,
    database: normalizeIdentifier(databasePath, "database name"),
    user: normalizeIdentifier(parsed.username, "username"),
  };

  return `${DATABASE_IDENTITY_DOMAIN}\n${JSON.stringify(identity)}`;
}

export function databaseIdentityDigest(databaseUrl) {
  return createHash("sha256")
    .update(normalizeDatabaseIdentity(databaseUrl), "utf8")
    .digest();
}

export function isNeonDatabaseUrl(databaseUrl) {
  normalizeDatabaseIdentity(databaseUrl);
  const hostname = new URL(databaseUrl).hostname.toLowerCase().replace(/\.$/, "");
  return hostname.endsWith(".neon.tech") && hostname !== ".neon.tech";
}

export function resolvePrismaDatabaseEnvironment(environment) {
  for (const name of PRISMA_DATABASE_ENVIRONMENTS) {
    if (environment[name] !== undefined && environment[name] !== null) {
      return name;
    }
  }

  throw new MigrationGateError(
    "No database connection is available for Prisma migrations.",
  );
}

function productionIdentityDigest(environment) {
  const expectedHex = environment[PRODUCTION_DATABASE_IDENTITY_ENV];
  if (typeof expectedHex !== "string" || !SHA256_HEX_PATTERN.test(expectedHex)) {
    throw new MigrationGateError(
      `${PRODUCTION_DATABASE_IDENTITY_ENV} must be a 64-character SHA-256 value.`,
    );
  }

  return Buffer.from(expectedHex, "hex");
}

function identitiesMatch(actualDigest, expectedDigest) {
  return (
    actualDigest.length === expectedDigest.length &&
    timingSafeEqual(actualDigest, expectedDigest)
  );
}

function requireNeonDatabase(databaseUrl) {
  if (!isNeonDatabaseUrl(databaseUrl)) {
    throw new MigrationGateError(
      "Vercel database migrations require an approved Neon connection.",
    );
  }

  const declaredSchemas = new URL(databaseUrl).searchParams.getAll("schema");
  if (declaredSchemas.some((schema) => schema !== "public")) {
    throw new MigrationGateError(
      "Vercel database migrations are restricted to the public schema.",
    );
  }
}

function inspectVercelDatabaseConnections(environment) {
  if (
    environment.DATABASE_URL === undefined ||
    environment.DATABASE_URL === null
  ) {
    throw new MigrationGateError(
      "DATABASE_URL is required for the Vercel runtime connection.",
    );
  }

  const migrationEnvironment = resolvePrismaDatabaseEnvironment(environment);
  const connections = PRISMA_DATABASE_ENVIRONMENTS.filter(
    (name) => environment[name] !== undefined && environment[name] !== null,
  ).map((name) => {
    requireNeonDatabase(environment[name]);
    return {
      name,
      digest: databaseIdentityDigest(environment[name]),
    };
  });

  const referenceDigest = connections[0].digest;
  if (
    connections.some(
      ({ digest }) => !identitiesMatch(digest, referenceDigest),
    )
  ) {
    throw new MigrationGateError(
      "Vercel database connections do not identify the same Neon branch.",
    );
  }

  return { migrationEnvironment, connections };
}

function requireProductionRelease(environment) {
  const releaseSha = environment[PRODUCTION_MIGRATION_RELEASE_ENV];
  const commitSha = environment.VERCEL_GIT_COMMIT_SHA;

  if (
    typeof releaseSha !== "string" ||
    typeof commitSha !== "string" ||
    !GIT_SHA_PATTERN.test(releaseSha) ||
    !GIT_SHA_PATTERN.test(commitSha) ||
    releaseSha.length !== commitSha.length ||
    !timingSafeEqual(Buffer.from(releaseSha), Buffer.from(commitSha))
  ) {
    throw new MigrationGateError(
      `Production migrations require ${PRODUCTION_MIGRATION_RELEASE_ENV} to exactly match the deployment commit.`,
    );
  }
}

/**
 * Returns only execution intent. Connection material and identity digests are
 * deliberately excluded so callers cannot accidentally log them.
 */
export function evaluateMigrationGate(environment = process.env) {
  const vercelEnvironment = environment.VERCEL_ENV;

  if (vercelEnvironment === undefined || vercelEnvironment === "development") {
    return Object.freeze({ migrate: false, environment: "development" });
  }

  if (vercelEnvironment !== "preview" && vercelEnvironment !== "production") {
    throw new MigrationGateError("Unknown Vercel environment; build refused.");
  }

  const expectedProductionDigest = productionIdentityDigest(environment);
  const { migrationEnvironment, connections } =
    inspectVercelDatabaseConnections(environment);
  const productionIdentityMatches = connections.map(({ digest }) =>
    identitiesMatch(digest, expectedProductionDigest),
  );

  if (vercelEnvironment === "preview") {
    if (productionIdentityMatches.some(Boolean)) {
      throw new MigrationGateError(
        "Preview migration refused because a database identity is production.",
      );
    }

    return Object.freeze({
      migrate: true,
      environment: "preview",
      migrationDatabaseEnvironment: migrationEnvironment,
    });
  }

  requireProductionRelease(environment);
  if (!productionIdentityMatches.every(Boolean)) {
    throw new MigrationGateError(
      "Production migration refused because a database identity is not approved.",
    );
  }

  return Object.freeze({
    migrate: true,
    environment: "production",
    migrationDatabaseEnvironment: migrationEnvironment,
  });
}

export function spawnNodeCli(file, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      ...options,
      shell: false,
      stdio: "inherit",
    });

    child.once("error", () => {
      reject(new Error("Unable to start a required build subprocess."));
    });
    child.once("exit", (code, signal) => {
      if (code === 0 && signal === null) {
        resolve();
        return;
      }

      reject(new Error("A required build subprocess failed."));
    });
  });
}

export async function runVercelBuild({
  environment = process.env,
  cwd = process.cwd(),
  runner = spawnNodeCli,
  cliPaths = {
    prisma: require.resolve("prisma/build/index.js"),
    next: require.resolve("next/dist/bin/next"),
    workerIdentityVerifier: WORKER_IDENTITY_VERIFIER_PATH,
    progressJournalVerifier: PROGRESS_JOURNAL_VERIFIER_PATH,
    protectedUploadVerifier: PROTECTED_UPLOAD_VERIFIER_PATH,
    visualProgressVerifier: VISUAL_PROGRESS_VERIFIER_PATH,
  },
} = {}) {
  const plan = evaluateMigrationGate(environment);
  const sharedOptions = {
    cwd,
    env: environment,
    windowsHide: true,
    shell: false,
    stdio: "inherit",
  };

  if (plan.migrate) {
    console.log(`Migration gate approved for Vercel ${plan.environment}.`);
    await runner(
      process.execPath,
      [cliPaths.prisma, "migrate", "deploy"],
      sharedOptions,
    );

    const verificationEnvironment = {
      ...environment,
      WORKER_IDENTITY_MIGRATION_DATABASE_URL:
        environment[plan.migrationDatabaseEnvironment],
      WORKER_IDENTITY_MIGRATION_SCHEMA: "public",
      PROGRESS_JOURNAL_MIGRATION_DATABASE_URL:
        environment[plan.migrationDatabaseEnvironment],
      PROGRESS_JOURNAL_MIGRATION_SCHEMA: "public",
      PROTECTED_UPLOAD_MIGRATION_DATABASE_URL:
        environment[plan.migrationDatabaseEnvironment],
      PROTECTED_UPLOAD_MIGRATION_SCHEMA: "public",
      VISUAL_PROGRESS_MIGRATION_DATABASE_URL:
        environment[plan.migrationDatabaseEnvironment],
      VISUAL_PROGRESS_MIGRATION_SCHEMA: "public",
    };
    await runner(
      process.execPath,
      [cliPaths.workerIdentityVerifier],
      { ...sharedOptions, env: verificationEnvironment },
    );
    await runner(
      process.execPath,
      [cliPaths.progressJournalVerifier],
      { ...sharedOptions, env: verificationEnvironment },
    );
    await runner(
      process.execPath,
      [cliPaths.protectedUploadVerifier],
      { ...sharedOptions, env: verificationEnvironment },
    );
    await runner(
      process.execPath,
      [cliPaths.visualProgressVerifier],
      { ...sharedOptions, env: verificationEnvironment },
    );
  }

  await runner(
    process.execPath,
    [cliPaths.prisma, "generate"],
    sharedOptions,
  );
  await runner(process.execPath, [cliPaths.next, "build"], sharedOptions);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  runVercelBuild().catch((error) => {
    const safeMessage =
      error instanceof MigrationGateError
        ? error.message
        : "Vercel build failed in a protected subprocess.";
    console.error(safeMessage);
    process.exitCode = 1;
  });
}
