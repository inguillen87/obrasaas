import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@clerk/nextjs/server") {
      return { url: "mock:clerk-nextjs-server", shortCircuit: true };
    }
    if (specifier === "next/headers") {
      return { url: "mock:next-headers", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const extension = specifier.startsWith("@/generated/") ? ".ts" : ".js";
      const sourcePath = new URL(
        `../src/${specifier.slice(2)}${extension}`,
        import.meta.url,
      );
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "mock:clerk-nextjs-server") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === "mock:next-headers") {
      return {
        format: "module",
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    return nextLoad(url, context);
  },
});

const { AccessError } = await import("../src/lib/access.js");
const { MetaIntegrationError, preparePilotWhatsAppCredential } = await import(
  "../src/lib/whatsapp/embedded-signup.js"
);
const { importPilotWhatsAppConnection, normalizeWhatsAppPilotImportRequest } =
  await import("../src/lib/whatsapp/pilot-import.js");
const { createWhatsAppPilotImportHandlers } = await import(
  "../src/app/api/integrations/whatsapp/pilot-import/route.js"
);

const NOW = new Date("2026-07-26T12:00:00.000Z");
const SECRET = "unit-test-fingerprint-secret-value-123456789";
const TOKEN = "temporary-pilot-access-token-value";
const ALLOWED_ASSETS = "123456789:987654321";
const ACCESS = Object.freeze({
  databaseUserId: "actor-superadmin",
  isSuperadmin: true,
});
const BODY = Object.freeze({
  accessToken: TOKEN,
  projectId: "project-a",
  whatsappBusinessId: "123456789",
  phoneNumberId: "987654321",
});

function normalized(body = BODY, key = "pilot-import-0001") {
  return normalizeWhatsAppPilotImportRequest(body, {
    idempotencyKey: key,
    fingerprintSecret: SECRET,
    allowedAssets: ALLOWED_ASSETS,
  });
}

function verified(overrides = {}) {
  return {
    tokenType: "temporary",
    expiresAt: Math.floor(NOW.getTime() / 1_000) + 3_600,
    scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
    subscribed: true,
    displayPhoneNumber: "+54 9 11 5555 5555",
    verifiedBusinessName: "Constructora Piloto",
    qualityRating: "GREEN",
    verificationStatus: "VERIFIED",
    phoneStatus: "CONNECTED",
    registrationPerformed: false,
    ...overrides,
  };
}

function fakePrisma({
  existing = null,
  phoneOwner = null,
  membership = { id: "membership-a", tenantRole: "ADMIN" },
} = {}) {
  const connections = [];
  if (existing) connections.push({ ...existing });
  if (phoneOwner && !connections.some((row) => row.id === phoneOwner.id)) {
    connections.push({ ...phoneOwner });
  }
  const state = {
    connection:
      connections.find((row) => row.projectId === "project-a") || null,
    connections,
    audits: [],
    creates: 0,
    projectReads: 0,
    membershipReads: 0,
    events: [],
  };

  function sameValue(actual, expected) {
    if (actual instanceof Date || expected instanceof Date) {
      return new Date(actual).getTime() === new Date(expected).getTime();
    }
    return actual === expected;
  }

  function matches(row, where) {
    return Object.entries(where).every(([field, expected]) => {
      if (field === "OR")
        return expected.some((condition) => matches(row, condition));
      if (
        expected &&
        typeof expected === "object" &&
        !(expected instanceof Date) &&
        Object.hasOwn(expected, "lte")
      ) {
        return (
          row[field] != null &&
          new Date(row[field]).getTime() <= new Date(expected.lte).getTime()
        );
      }
      return sameValue(row[field] ?? null, expected);
    });
  }

  function uniqueConflict() {
    const error = new Error("unique conflict");
    error.code = "P2002";
    return error;
  }

  const prisma = {
    project: {
      async findFirst(args) {
        state.projectReads += 1;
        assert.deepEqual(args.where, { id: "project-a", status: "ACTIVE" });
        return {
          id: "project-a",
          organizationId: "organization-a",
          status: "ACTIVE",
          organization: {
            id: "organization-a",
            clerkOrganizationId: "org_external_tenant",
            metadata: {},
            subscriptionPlan: "PRO",
            subscriptionStatus: "ACTIVE",
            trialEndsAt: null,
          },
        };
      },
    },
    tenantMembership: {
      async findFirst(args) {
        state.membershipReads += 1;
        assert.deepEqual(args.where, {
          organizationId: "organization-a",
          userId: "actor-superadmin",
          status: "ACTIVE",
        });
        return membership
          ? { ...membership, userId: "actor-superadmin", status: "ACTIVE" }
          : null;
      },
    },
    whatsAppConnection: {
      async findUnique({ where }) {
        const row = connections.find((candidate) => matches(candidate, where));
        return row ? { ...row } : null;
      },
      async create({ data }) {
        if (
          connections.some(
            (row) =>
              row.projectId === data.projectId ||
              row.phoneNumberId === data.phoneNumberId,
          )
        ) {
          throw uniqueConflict();
        }
        state.creates += 1;
        const created = {
          id: `connection-${state.creates}`,
          updatedAt: NOW,
          ...data,
        };
        connections.push(created);
        if (created.projectId === "project-a") state.connection = created;
        state.events.push("reservation-created");
        return { ...created };
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const row of connections) {
          if (!matches(row, where)) continue;
          const previousUpdatedAt =
            row.updatedAt instanceof Date ? row.updatedAt : NOW;
          Object.assign(row, data);
          if (!Object.hasOwn(data, "updatedAt")) {
            row.updatedAt = new Date(previousUpdatedAt.getTime() + 1);
          }
          count += 1;
        }
        return { count };
      },
    },
    auditLog: {
      async create({ data }) {
        state.audits.push(structuredClone(data));
        return data;
      },
    },
    async $transaction(callback) {
      return callback(prisma);
    },
  };
  return { prisma, state };
}

test("pilot request normalization is strict and stores only keyed fingerprints", () => {
  const input = normalized();
  assert.equal(input.accessToken, TOKEN);
  assert.match(input.idempotencyKeyHash, /^[a-f0-9]{64}$/);
  assert.match(input.requestFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(input.idempotencyKeyHash.includes("pilot-import-0001"), false);
  assert.throws(
    () => normalized({ ...BODY, unexpected: true }),
    (error) => error.code === "PILOT_IMPORT_FIELDS_INVALID",
  );
  assert.throws(
    () =>
      normalizeWhatsAppPilotImportRequest(BODY, {
        idempotencyKey: "short",
        fingerprintSecret: SECRET,
      }),
    (error) => error.code === "IDEMPOTENCY_KEY_INVALID",
  );
  assert.throws(
    () => normalized({ ...BODY, registrationPin: 731902 }),
    (error) => error.code === "PILOT_PIN_INVALID",
  );
});

test("pilot asset allowlist fails closed and requires an exact WABA/phone pair", () => {
  const options = {
    idempotencyKey: "pilot-import-allowlist",
    fingerprintSecret: SECRET,
  };
  assert.throws(
    () => normalizeWhatsAppPilotImportRequest(BODY, options),
    (error) =>
      error.code === "PILOT_ASSET_ALLOWLIST_UNAVAILABLE" &&
      error.status === 503,
  );
  assert.throws(
    () =>
      normalizeWhatsAppPilotImportRequest(BODY, {
        ...options,
        allowedAssets: ` ${ALLOWED_ASSETS}`,
      }),
    (error) =>
      error.code === "PILOT_ASSET_ALLOWLIST_UNAVAILABLE" &&
      error.status === 503,
  );
  assert.throws(
    () =>
      normalizeWhatsAppPilotImportRequest(BODY, {
        ...options,
        allowedAssets: `${ALLOWED_ASSETS},${ALLOWED_ASSETS}`,
      }),
    (error) =>
      error.code === "PILOT_ASSET_ALLOWLIST_UNAVAILABLE" &&
      error.status === 503,
  );
  assert.throws(
    () =>
      normalizeWhatsAppPilotImportRequest(BODY, {
        ...options,
        allowedAssets: "123456789:111111111",
      }),
    (error) => error.code === "PILOT_ASSET_NOT_ALLOWED" && error.status === 403,
  );
});

test("route is undiscoverable outside flagged Preview before auth or body reads", async () => {
  let authCalls = 0;
  let bodyCalls = 0;
  const { POST } = createWhatsAppPilotImportHandlers({
    environment: {
      VERCEL_ENV: "production",
      WHATSAPP_PILOT_IMPORT_ENABLED: "true",
    },
    resolveAccess: async () => {
      authCalls += 1;
    },
    parseBody: async () => {
      bodyCalls += 1;
    },
    resolveCorrelationId: () => "request-disabled",
  });
  const response = await POST(
    new Request(
      "https://preview.example/api/integrations/whatsapp/pilot-import",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BODY),
      },
    ),
  );
  assert.equal(response.status, 404);
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  assert.equal(response.headers.get("x-request-id"), "request-disabled");
  assert.equal(authCalls, 0);
  assert.equal(bodyCalls, 0);
});

test("route authenticates before reading the secret body", async () => {
  let bodyCalls = 0;
  const { POST } = createWhatsAppPilotImportHandlers({
    environment: {
      VERCEL_ENV: "preview",
      WHATSAPP_PILOT_IMPORT_ENABLED: "true",
    },
    resolveAccess: async () => {
      throw new AccessError("Superadmin access required.", {
        code: "SUPERADMIN_REQUIRED",
        status: 403,
      });
    },
    parseBody: async () => {
      bodyCalls += 1;
    },
    resolveCorrelationId: () => "request-auth",
  });
  const response = await POST(
    new Request(
      "https://preview.example/api/integrations/whatsapp/pilot-import",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BODY),
      },
    ),
  );
  assert.equal(response.status, 403);
  assert.equal(bodyCalls, 0);
});

test("route fails closed when the Preview asset allowlist is unavailable", async () => {
  let imports = 0;
  const { POST } = createWhatsAppPilotImportHandlers({
    environment: {
      VERCEL_ENV: "preview",
      WHATSAPP_PILOT_IMPORT_ENABLED: "true",
      WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: SECRET,
    },
    resolveAccess: async () => ACCESS,
    importConnection: async () => {
      imports += 1;
    },
    resolveCorrelationId: () => "request-allowlist",
  });
  const response = await POST(
    new Request(
      "https://preview.example/api/integrations/whatsapp/pilot-import",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "pilot-import-0001",
        },
        body: JSON.stringify(BODY),
      },
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.code, "PILOT_ASSET_ALLOWLIST_UNAVAILABLE");
  assert.equal(imports, 0);
});

test("route enforces the bounded JSON body before invoking the import service", async () => {
  let imports = 0;
  const { POST } = createWhatsAppPilotImportHandlers({
    environment: {
      VERCEL_ENV: "preview",
      WHATSAPP_PILOT_IMPORT_ENABLED: "true",
      WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: SECRET,
      WHATSAPP_PILOT_ALLOWED_ASSETS: ALLOWED_ASSETS,
    },
    resolveAccess: async () => ACCESS,
    importConnection: async () => {
      imports += 1;
    },
    resolveCorrelationId: () => "request-size",
  });
  const response = await POST(
    new Request(
      "https://preview.example/api/integrations/whatsapp/pilot-import",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "pilot-import-0001",
        },
        body: JSON.stringify({
          ...BODY,
          accessToken: `EAA${"x".repeat(8_200)}`,
        }),
      },
    ),
  );
  assert.equal(response.status, 413);
  assert.equal(imports, 0);
});

test("route exposes only a generic Meta validation failure and safe logs", async () => {
  const logs = [];
  const previousConsoleError = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const { POST } = createWhatsAppPilotImportHandlers({
      environment: {
        VERCEL_ENV: "preview",
        WHATSAPP_PILOT_IMPORT_ENABLED: "true",
        WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: SECRET,
        WHATSAPP_PILOT_ALLOWED_ASSETS: ALLOWED_ASSETS,
      },
      resolveAccess: async () => ACCESS,
      prismaFactory: () => ({}),
      importConnection: async () => {
        throw new MetaIntegrationError(`Provider rejected ${TOKEN}`, {
          code: "META_190",
          status: 403,
        });
      },
      resolveCorrelationId: () => "request-provider",
    });
    const response = await POST(
      new Request(
        "https://preview.example/api/integrations/whatsapp/pilot-import",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": "pilot-import-0001",
          },
          body: JSON.stringify(BODY),
        },
      ),
    );
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.code, "PILOT_IMPORT_VALIDATION_FAILED");
    assert.equal(JSON.stringify({ payload, logs }).includes(TOKEN), false);
    assert.equal(logs[0][1].code, "META_190");
  } finally {
    console.error = previousConsoleError;
  }
});

test("new pilot import encrypts immediately, audits safely, and replays without Meta", async () => {
  const { prisma, state } = fakePrisma();
  let remoteCalls = 0;
  const dependencies = {
    prepareCredential: async ({ beforeRemoteMutation }) => {
      assert.equal(state.connection.connectionStatus, "PENDING");
      assert.equal(state.connection.enabled, false);
      assert.equal(state.connection.encryptedAccessToken, null);
      assert.equal(state.events[0], "reservation-created");
      await beforeRemoteMutation({ registrationRequired: false });
      state.events.push("meta-called");
      remoteCalls += 1;
      return verified();
    },
    encrypt: (value) => `encrypted:${value === TOKEN ? "token" : "pin"}`,
    lastFour: () => "alue",
  };
  const input = normalized();
  const first = await importPilotWhatsAppConnection(
    prisma,
    {
      access: ACCESS,
      input,
      ipAddress: "203.0.113.10",
      now: NOW,
    },
    dependencies,
  );
  const second = await importPilotWhatsAppConnection(
    prisma,
    {
      access: ACCESS,
      input,
      now: NOW,
    },
    dependencies,
  );

  assert.equal(remoteCalls, 1);
  assert.equal(state.creates, 1);
  assert.equal(state.audits.length, 3);
  assert.deepEqual(state.events, ["reservation-created", "meta-called"]);
  assert.equal(state.connection.encryptedAccessToken, "encrypted:token");
  assert.equal(state.connection.encryptedPin, null);
  assert.equal(first.connection.replayed, false);
  assert.equal(second.connection.replayed, true);
  assert.equal(
    first.connection.credentialExpiresAt,
    "2026-07-26T13:00:00.000Z",
  );
  const persisted = JSON.stringify({
    response: first,
    metadata: state.connection.metadata,
    audit: state.audits,
  });
  assert.equal(persisted.includes(TOKEN), false);
  assert.equal(persisted.includes("encrypted:token"), false);
  assert.equal(persisted.includes("tokenLastFour"), false);
  assert.equal(state.audits[0].action, "integration.whatsapp.pilot_reserved");
  assert.equal(
    state.audits[1].action,
    "integration.whatsapp.pilot_remote_attempted",
  );
  assert.equal(state.audits[2].action, "integration.whatsapp.pilot_imported");
  assert.equal(state.audits[2].metadata.tenantMembershipId, "membership-a");
  assert.equal(state.audits[2].ipAddress, "203.0.113.10");
});

test("same idempotency key with changed token fails before Meta", async () => {
  const { prisma } = fakePrisma();
  let remoteCalls = 0;
  const dependencies = {
    prepareCredential: async ({ beforeRemoteMutation }) => {
      await beforeRemoteMutation({ registrationRequired: false });
      remoteCalls += 1;
      return verified();
    },
    encrypt: () => "encrypted-token",
    lastFour: () => "alue",
  };
  await importPilotWhatsAppConnection(
    prisma,
    {
      access: ACCESS,
      input: normalized(),
      now: NOW,
    },
    dependencies,
  );
  const changed = normalized({
    ...BODY,
    accessToken: "different-temporary-token-value",
  });
  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      {
        access: ACCESS,
        input: changed,
        now: NOW,
      },
      dependencies,
    ),
    (error) => error.code === "IDEMPOTENCY_PAYLOAD_MISMATCH",
  );
  assert.equal(remoteCalls, 1);
});

test("concurrent first-create uniqueness race reconciles the durable reservation before Meta", async () => {
  const { prisma, state } = fakePrisma();
  prisma.whatsAppConnection.create = async ({ data }) => {
    const raced = { id: "connection-race", updatedAt: NOW, ...data };
    state.connection = raced;
    state.connections.push(raced);
    const conflict = new Error("unique conflict");
    conflict.code = "P2002";
    throw conflict;
  };
  let remoteCalls = 0;
  const result = await importPilotWhatsAppConnection(
    prisma,
    {
      access: ACCESS,
      input: normalized(),
      now: NOW,
    },
    {
      prepareCredential: async ({ beforeRemoteMutation }) => {
        await beforeRemoteMutation({ registrationRequired: false });
        remoteCalls += 1;
        return verified();
      },
      encrypt: () => "encrypted-race-token",
      lastFour: () => "alue",
    },
  );
  assert.equal(remoteCalls, 1);
  assert.equal(result.connection.replayed, false);
  assert.equal(result.connection.id, "connection-race");
});

test("registration PIN is encrypted only for a provider-confirmed registration", async () => {
  const { prisma, state } = fakePrisma();
  const input = normalized(
    { ...BODY, registrationPin: "731902" },
    "pilot-import-pin-01",
  );
  const encryptedValues = [];
  const result = await importPilotWhatsAppConnection(
    prisma,
    {
      access: ACCESS,
      input,
      now: NOW,
    },
    {
      prepareCredential: async ({ registrationPin, beforeRemoteMutation }) => {
        assert.equal(registrationPin, "731902");
        await beforeRemoteMutation({ registrationRequired: true });
        return verified({ registrationPerformed: true });
      },
      encrypt: (value) => {
        encryptedValues.push(value);
        return value === TOKEN ? "encrypted-token" : "encrypted-pin";
      },
      lastFour: () => "alue",
    },
  );
  assert.deepEqual(encryptedValues, [TOKEN, "731902"]);
  assert.equal(state.connection.encryptedPin, "encrypted-pin");
  assert.equal(result.connection.registrationPerformed, true);
  assert.equal(JSON.stringify(result).includes("731902"), false);
});

test("a recovery PIN is discarded when Meta confirms the phone is already registered", async () => {
  const { prisma, state } = fakePrisma();
  const input = normalized(
    { ...BODY, registrationPin: "731902" },
    "pilot-import-pin-02",
  );
  const encryptedValues = [];
  await importPilotWhatsAppConnection(
    prisma,
    {
      access: ACCESS,
      input,
      now: NOW,
    },
    {
      prepareCredential: async ({ beforeRemoteMutation }) => {
        await beforeRemoteMutation({ registrationRequired: false });
        return verified({ registrationPerformed: false });
      },
      encrypt: (value) => {
        encryptedValues.push(value);
        return "encrypted-token";
      },
      lastFour: () => "alue",
    },
  );
  assert.deepEqual(encryptedValues, [TOKEN, "731902"]);
  assert.equal(state.connection.encryptedPin, null);
});

test("a crash after remote registration fences altered retries and recovers the original encrypted PIN", async () => {
  const { prisma, state } = fakePrisma();
  const originalInput = normalized(
    { ...BODY, registrationPin: "111111" },
    "pilot-import-crash-01",
  );
  let remoteMutations = 0;
  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      { access: ACCESS, input: originalInput, now: NOW },
      {
        prepareCredential: async ({ beforeRemoteMutation }) => {
          await beforeRemoteMutation({ registrationRequired: true });
          remoteMutations += 1;
          throw new MetaIntegrationError("simulated post-register crash", {
            code: "META_GRAPH_TIMEOUT",
            status: 502,
          });
        },
        encrypt: (value) =>
          value === TOKEN ? "encrypted-token-a" : "encrypted-pin-a",
        lastFour: () => "alue",
      },
    ),
    (error) => error.code === "META_GRAPH_TIMEOUT",
  );
  assert.equal(remoteMutations, 1);
  assert.equal(state.connection.connectionStatus, "PENDING");
  assert.equal(state.connection.encryptedPin, null);
  assert.equal(
    state.connection.metadata.pilotImportReservation.registrationPinEscrow,
    "encrypted-pin-a",
  );
  assert.equal(
    JSON.stringify(state.connection.metadata).includes("111111"),
    false,
  );

  const alteredSameKey = normalized(
    {
      ...BODY,
      accessToken: "different-temporary-token-value",
      registrationPin: "222222",
    },
    "pilot-import-crash-01",
  );
  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      { access: ACCESS, input: alteredSameKey, now: NOW },
      {
        prepareCredential: async () => {
          remoteMutations += 1;
        },
        encrypt: () => "must-not-persist",
        lastFour: () => "alue",
      },
    ),
    (error) => error.code === "IDEMPOTENCY_PAYLOAD_MISMATCH",
  );
  const alteredNewKey = normalized(
    {
      ...BODY,
      accessToken: "different-temporary-token-value",
      registrationPin: "222222",
    },
    "pilot-import-crash-02",
  );
  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      {
        access: ACCESS,
        input: alteredNewKey,
        now: NOW,
      },
      {
        prepareCredential: async () => {
          remoteMutations += 1;
        },
        encrypt: () => "must-not-persist",
        lastFour: () => "alue",
      },
    ),
    (error) => error.code === "PILOT_IMPORT_RECOVERY_REQUIRED",
  );
  assert.equal(remoteMutations, 1);

  const reloadRecoveryInput = normalized(
    { ...BODY, registrationPin: "111111" },
    "pilot-import-crash-reload",
  );
  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      { access: ACCESS, input: reloadRecoveryInput, now: NOW },
      {
        prepareCredential: async ({ beforeRemoteMutation }) => {
          await beforeRemoteMutation({ registrationRequired: false });
          remoteMutations += 1;
          throw new MetaIntegrationError("simulated second reload timeout", {
            code: "META_GRAPH_TIMEOUT",
            status: 502,
          });
        },
        encrypt: (value) =>
          value === TOKEN ? "encrypted-token-retry" : "encrypted-pin-retry",
        lastFour: () => "alue",
      },
    ),
    (error) => error.code === "META_GRAPH_TIMEOUT",
  );
  assert.equal(remoteMutations, 2);

  const secondReloadRecoveryInput = normalized(
    { ...BODY, registrationPin: "111111" },
    "pilot-import-crash-second-reload",
  );
  const recovered = await importPilotWhatsAppConnection(
    prisma,
    { access: ACCESS, input: secondReloadRecoveryInput, now: NOW },
    {
      prepareCredential: async ({ beforeRemoteMutation }) => {
        await beforeRemoteMutation({ registrationRequired: false });
        remoteMutations += 1;
        return verified({ registrationPerformed: false });
      },
      encrypt: (value) =>
        value === TOKEN ? "encrypted-token-retry" : "encrypted-pin-retry",
      lastFour: () => "alue",
    },
  );
  assert.equal(remoteMutations, 3);
  assert.equal(recovered.connection.registrationPerformed, false);
  assert.equal(recovered.connection.registrationRecovered, true);
  assert.equal(recovered.connection.recoveryRekeyed, true);
  assert.equal(state.connection.encryptedPin, "encrypted-pin-a");
  assert.equal(state.audits.at(-2).metadata.recoveryRekeyed, true);
  assert.equal(state.audits.at(-1).metadata.recoveryRekeyed, true);
  assert.equal(
    Object.hasOwn(state.connection.metadata, "pilotImportReservation"),
    false,
  );

  const originalReplay = await importPilotWhatsAppConnection(prisma, {
    access: ACCESS,
    input: originalInput,
    now: NOW,
  });
  assert.equal(originalReplay.connection.replayed, true);
  assert.equal(originalReplay.connection.recoveryRekeyed, true);
  const firstReloadReplay = await importPilotWhatsAppConnection(prisma, {
    access: ACCESS,
    input: reloadRecoveryInput,
    now: NOW,
  });
  const secondReloadReplay = await importPilotWhatsAppConnection(prisma, {
    access: ACCESS,
    input: secondReloadRecoveryInput,
    now: NOW,
  });
  assert.equal(firstReloadReplay.connection.replayed, true);
  assert.equal(secondReloadReplay.connection.replayed, true);
  assert.deepEqual(
    state.connection.metadata.pilotImport.operations.at(-1).operationKeyAliases,
    [originalInput.idempotencyKeyHash, reloadRecoveryInput.idempotencyKeyHash],
  );
  assert.equal(remoteMutations, 3);
});

test("the real Meta preparer recovers after register succeeds and its read-back times out", async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = "1665088767899217";
  process.env.META_APP_SECRET = "unit-test-secret";
  const { prisma, state } = fakePrisma();
  const body = { ...BODY, registrationPin: "111111" };
  const originalInput = normalized(body, "pilot-import-real-register-01");
  const reloadInput = normalized(body, "pilot-import-real-register-reload");
  let providerRegistered = false;
  let failRegistrationReadBack = true;
  let registerCalls = 0;

  const fetchImpl = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const method = options.method || "GET";
    if (path.endsWith("/debug_token")) {
      return Response.json({
        data: {
          is_valid: true,
          app_id: "1665088767899217",
          expires_at: Math.floor(NOW.getTime() / 1_000) + 3_600,
          scopes: [
            "whatsapp_business_management",
            "whatsapp_business_messaging",
          ],
        },
      });
    }
    if (path.endsWith("/phone_numbers")) {
      if (providerRegistered && failRegistrationReadBack) {
        failRegistrationReadBack = false;
        const timeout = new Error("simulated provider read-back timeout");
        timeout.name = "AbortError";
        throw timeout;
      }
      return Response.json({
        data: [
          {
            id: BODY.phoneNumberId,
            status: providerRegistered ? "CONNECTED" : "DISCONNECTED",
            code_verification_status: providerRegistered
              ? "VERIFIED"
              : "UNREGISTERED",
            display_phone_number: "+54 9 11 5555 5555",
            verified_name: "Constructora Piloto",
          },
        ],
      });
    }
    if (path.endsWith("/subscribed_apps") && method === "GET") {
      return Response.json({ data: [{ id: "1665088767899217" }] });
    }
    if (path.endsWith(`/${BODY.phoneNumberId}/register`)) {
      registerCalls += 1;
      providerRegistered = true;
      return Response.json({ success: true });
    }
    return Response.json({ success: true });
  };
  const prepareCredential = (input) =>
    preparePilotWhatsAppCredential({ ...input, fetchImpl });

  try {
    await assert.rejects(
      importPilotWhatsAppConnection(
        prisma,
        { access: ACCESS, input: originalInput, now: NOW },
        {
          prepareCredential,
          encrypt: (value) =>
            value === TOKEN ? "encrypted-token-a" : "encrypted-pin-a",
          lastFour: () => "alue",
        },
      ),
      (error) => error.code === "META_GRAPH_TIMEOUT",
    );
    assert.equal(providerRegistered, true);
    assert.equal(registerCalls, 1);
    assert.equal(
      state.connection.metadata.pilotImportReservation.registrationPinEscrow,
      "encrypted-pin-a",
    );

    const recovered = await importPilotWhatsAppConnection(
      prisma,
      { access: ACCESS, input: reloadInput, now: NOW },
      {
        prepareCredential,
        encrypt: (value) =>
          value === TOKEN ? "encrypted-token-retry" : "encrypted-pin-retry",
        lastFour: () => "alue",
      },
    );
    assert.equal(recovered.connection.registrationRecovered, true);
    assert.equal(recovered.connection.recoveryRekeyed, true);
    assert.equal(state.connection.encryptedPin, "encrypted-pin-a");
    assert.equal(registerCalls, 1);
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test("a saturated recovery alias chain fails before another Meta mutation", async () => {
  const body = { ...BODY, registrationPin: "111111" };
  const input = normalized(body, "pilot-import-alias-limit-new");
  const canonical = normalized(body, "pilot-import-alias-limit-current");
  const operationKeyAliases = Array.from(
    { length: 32 },
    (_, index) =>
      normalized(
        body,
        `pilot-import-alias-limit-${String(index).padStart(2, "0")}`,
      ).idempotencyKeyHash,
  );
  const { prisma, state } = fakePrisma({
    existing: {
      id: "connection-alias-limit",
      projectId: BODY.projectId,
      phoneNumberId: BODY.phoneNumberId,
      whatsappBusinessId: BODY.whatsappBusinessId,
      enabled: false,
      connectionStatus: "PENDING",
      encryptedAccessToken: null,
      encryptedPin: null,
      metadata: {
        pilotImportReservation: {
          version: 2,
          operationKeyHash: canonical.idempotencyKeyHash,
          operationKeyAliases,
          requestFingerprint: input.requestFingerprint,
          reservedAt: NOW.toISOString(),
          remoteAttemptedAt: NOW.toISOString(),
          lastRemoteAttemptAt: NOW.toISOString(),
          attemptCount: 1,
          registrationRequired: false,
        },
      },
      updatedAt: NOW,
    },
  });
  let remoteMutations = 0;

  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      { access: ACCESS, input, now: NOW },
      {
        prepareCredential: async ({ beforeRemoteMutation }) => {
          await beforeRemoteMutation({ registrationRequired: false });
          remoteMutations += 1;
          return verified();
        },
        encrypt: () => "encrypted-candidate",
        lastFour: () => "alue",
      },
    ),
    (error) => error.code === "PILOT_IMPORT_RECOVERY_CHAIN_LIMIT",
  );
  assert.equal(remoteMutations, 0);
  assert.deepEqual(
    state.connection.metadata.pilotImportReservation.operationKeyAliases,
    operationKeyAliases,
  );
});

test("a pre-mutation Meta rejection leaves the reservation safely replaceable", async () => {
  const { prisma, state } = fakePrisma();
  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      { access: ACCESS, input: normalized(), now: NOW },
      {
        prepareCredential: async () => {
          throw new MetaIntegrationError("invalid token", {
            code: "META_PILOT_TOKEN_INVALID",
            status: 400,
          });
        },
        encrypt: () => "encrypted-invalid-token",
        lastFour: () => "alue",
      },
    ),
    (error) => error.code === "META_PILOT_TOKEN_INVALID",
  );
  assert.equal(
    Object.hasOwn(
      state.connection.metadata.pilotImportReservation,
      "remoteAttemptedAt",
    ),
    false,
  );

  let remoteMutations = 0;
  const result = await importPilotWhatsAppConnection(
    prisma,
    {
      access: ACCESS,
      input: normalized(BODY, "pilot-import-corrected-02"),
      now: NOW,
    },
    {
      prepareCredential: async ({ beforeRemoteMutation }) => {
        await beforeRemoteMutation({ registrationRequired: false });
        remoteMutations += 1;
        return verified();
      },
      encrypt: () => "encrypted-corrected-token",
      lastFour: () => "alue",
    },
  );
  assert.equal(remoteMutations, 1);
  assert.equal(result.connection.replayed, false);
});

test("target tenant membership is mandatory before Meta validation", async () => {
  const { prisma } = fakePrisma({ membership: null });
  let remoteCalls = 0;
  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      {
        access: ACCESS,
        input: normalized(),
        now: NOW,
      },
      {
        prepareCredential: async () => {
          remoteCalls += 1;
        },
      },
    ),
    (error) => error.code === "PILOT_TENANT_MEMBERSHIP_REQUIRED",
  );
  assert.equal(remoteCalls, 0);
});

test("same-identity refresh uses lease/CAS, preserves PIN and Flow bindings, and releases on failure", async () => {
  const existing = {
    id: "connection-a",
    projectId: "project-a",
    phoneNumberId: BODY.phoneNumberId,
    whatsappBusinessId: BODY.whatsappBusinessId,
    displayPhoneNumber: "+1 old",
    verifiedBusinessName: "Old",
    enabled: true,
    connectionStatus: "CONNECTED",
    encryptedAccessToken: "old-encrypted-token",
    encryptedPin: "old-encrypted-pin",
    metadata: {
      whatsappFlows: { "incident-report": { id: "flow-old" } },
      whatsappFlowEndpoint: { id: "endpoint-old" },
    },
    updatedAt: new Date("2026-07-26T11:59:00.000Z"),
  };
  const { prisma, state } = fakePrisma({ existing });
  let releases = 0;
  const acquireLease = async () => {
    state.connection.flowProvisioningLeaseId = "lease-a";
    state.connection.updatedAt = new Date(
      state.connection.updatedAt.getTime() + 1,
    );
    return {
      lease: { id: "lease-a" },
      metadata: state.connection.metadata,
      updatedAt: state.connection.updatedAt,
    };
  };
  const commitLease = async (_database, options) => {
    const data = options.buildConnectionData(state.connection);
    Object.assign(state.connection, data, { flowProvisioningLeaseId: null });
    await options.createAuditLog(prisma);
    return { data };
  };
  const result = await importPilotWhatsAppConnection(
    prisma,
    {
      access: ACCESS,
      input: normalized(),
      now: NOW,
    },
    {
      prepareCredential: async ({ beforeRemoteMutation }) => {
        await beforeRemoteMutation({ registrationRequired: false });
        return verified();
      },
      encrypt: () => "new-encrypted-token",
      lastFour: () => "alue",
      acquireLease,
      commitLease,
      releaseLease: async () => {
        releases += 1;
        return true;
      },
    },
  );
  assert.equal(result.connection.replayed, false);
  assert.equal(releases, 0);
  assert.equal(state.connection.encryptedPin, "old-encrypted-pin");
  assert.deepEqual(state.connection.metadata.whatsappFlows, {
    "incident-report": { id: "flow-old" },
  });
  assert.deepEqual(state.connection.metadata.whatsappFlowEndpoint, {
    id: "endpoint-old",
  });

  state.connection.updatedAt = new Date("2026-07-26T12:01:00.000Z");
  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      {
        access: ACCESS,
        input: normalized(BODY, "pilot-import-0002"),
        now: new Date("2026-07-26T12:02:00.000Z"),
      },
      {
        prepareCredential: async ({ beforeRemoteMutation }) => {
          await beforeRemoteMutation({ registrationRequired: false });
          throw new MetaIntegrationError("remote failure", {
            code: "META_190",
            status: 403,
          });
        },
        encrypt: () => "newer-encrypted-token",
        lastFour: () => "alue",
        acquireLease,
        releaseLease: async () => {
          releases += 1;
          return true;
        },
      },
    ),
    (error) => error.code === "META_190",
  );
  assert.equal(releases, 1);
});

test("pilot refuses a project identity swap before lease acquisition or Meta effects", async () => {
  const { prisma } = fakePrisma({
    existing: {
      id: "connection-a",
      projectId: "project-a",
      phoneNumberId: "111111111",
      whatsappBusinessId: "222222222",
      enabled: true,
      connectionStatus: "CONNECTED",
      encryptedAccessToken: "old-encrypted-token",
      encryptedPin: null,
      metadata: {},
      updatedAt: NOW,
    },
  });
  let leaseCalls = 0;
  let remoteCalls = 0;
  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      {
        access: ACCESS,
        input: normalized(),
        now: NOW,
      },
      {
        acquireLease: async () => {
          leaseCalls += 1;
        },
        prepareCredential: async () => {
          remoteCalls += 1;
        },
      },
    ),
    (error) => error.code === "PILOT_IMPORT_CONNECTION_CONFLICT",
  );
  assert.equal(leaseCalls, 0);
  assert.equal(remoteCalls, 0);
});

test("pilot refuses a phone reserved by another tenant before local or Meta effects", async () => {
  const { prisma, state } = fakePrisma({
    phoneOwner: {
      id: "connection-other",
      projectId: "project-other",
      phoneNumberId: BODY.phoneNumberId,
      whatsappBusinessId: BODY.whatsappBusinessId,
      enabled: true,
      connectionStatus: "CONNECTED",
      encryptedAccessToken: "other-encrypted-token",
      encryptedPin: null,
      metadata: {},
      updatedAt: NOW,
    },
  });
  let remoteCalls = 0;
  await assert.rejects(
    importPilotWhatsAppConnection(
      prisma,
      {
        access: ACCESS,
        input: normalized(),
        now: NOW,
      },
      {
        prepareCredential: async () => {
          remoteCalls += 1;
        },
      },
    ),
    (error) => error.code === "PILOT_IMPORT_CONNECTION_CONFLICT",
  );
  assert.equal(state.creates, 0);
  assert.equal(remoteCalls, 0);
});
