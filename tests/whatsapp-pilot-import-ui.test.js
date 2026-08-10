import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}.js`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

const {
  createPilotImportIdempotencyKey,
  pilotImportErrorMessage,
  pilotImportRequestBody,
  pilotTargetIdSuffix,
  validatePilotImportDraft,
} = await import("../src/app/dashboard/integrations/pilot-import-helpers.js");
const {
  listWhatsAppPilotImportTargets,
  loadWhatsAppPilotImportTargetCatalog,
  whatsappPilotImportPanelEnabled,
} = await import(
  "../src/app/dashboard/integrations/pilot-import-targets.js"
);

const NOW = new Date("2026-07-26T12:00:00.000Z");
const VALID_DRAFT = Object.freeze({
  accessToken: "temporary-pilot-access-token-value",
  phoneNumberId: "987654321",
  projectId: "project-a",
  registrationPin: "",
  whatsappBusinessId: "123456789",
});

function organization(overrides = {}) {
  return {
    id: "organization-a",
    name: "Constructora Piloto",
    clerkOrganizationId: "org_external_a",
    metadata: {},
    subscriptionPlan: "PRO",
    subscriptionStatus: "ACTIVE",
    trialEndsAt: null,
    projects: [
      {
        id: "project-a",
        name: "Torre Norte",
        status: "ACTIVE",
        organizationId: "organization-a",
      },
    ],
    ...overrides,
  };
}

function membership(overrides = {}) {
  const targetOrganization = overrides.organization || organization();
  return {
    id: "membership-a",
    status: "ACTIVE",
    tenantRole: "ADMIN",
    projectMemberships: [],
    ...overrides,
    organization: targetOrganization,
  };
}

test("pilot panel gate is exact: Preview, enabled flag, and superadmin are all required", () => {
  assert.equal(
    whatsappPilotImportPanelEnabled(
      {
        VERCEL_ENV: "preview",
        WHATSAPP_PILOT_IMPORT_ENABLED: "true",
      },
      { isSuperadmin: true },
    ),
    true,
  );
  assert.equal(
    whatsappPilotImportPanelEnabled(
      {
        VERCEL_ENV: "production",
        WHATSAPP_PILOT_IMPORT_ENABLED: "true",
      },
      { isSuperadmin: true },
    ),
    false,
  );
  assert.equal(
    whatsappPilotImportPanelEnabled(
      {
        VERCEL_ENV: "preview",
        WHATSAPP_PILOT_IMPORT_ENABLED: "TRUE",
      },
      { isSuperadmin: true },
    ),
    false,
  );
  assert.equal(
    whatsappPilotImportPanelEnabled(
      {
        VERCEL_ENV: "preview",
        WHATSAPP_PILOT_IMPORT_ENABLED: "true",
      },
      { isSuperadmin: false },
    ),
    false,
  );
});

test("pilot target catalog is server-derived, external, writable, permitted, and active only", async () => {
  let query;
  const prisma = {
    tenantMembership: {
      async findMany(input) {
        query = input;
        return [
          membership({
            id: "internal-system",
            organization: organization({
              id: "organization-internal",
              clerkOrganizationId: "system:obrasaas",
            }),
          }),
          membership({
            organization: organization({
              projects: [
                {
                  id: "project-z",
                  name: "Zócalo",
                  status: "ACTIVE",
                  organizationId: "organization-a",
                },
                {
                  id: "project-a",
                  name: "Álamo",
                  status: "ACTIVE",
                  organizationId: "organization-a",
                },
                {
                  id: "project-paused",
                  name: "Pausada",
                  status: "PAUSED",
                  organizationId: "organization-a",
                },
              ],
            }),
          }),
          membership({
            id: "suspended",
            organization: organization({
              id: "organization-suspended",
              name: "Suspendida",
              clerkOrganizationId: "org_suspended",
              subscriptionStatus: "SUSPENDED",
            }),
          }),
          membership({ id: "auditor", tenantRole: "AUDITOR" }),
          membership({ id: "disabled", status: "DISABLED" }),
          membership({
            id: "metadata-internal",
            organization: organization({
              id: "organization-metadata-internal",
              clerkOrganizationId: "org_internal_metadata",
              metadata: { internal: true },
            }),
          }),
        ];
      },
    },
  };

  const targets = await listWhatsAppPilotImportTargets(
    prisma,
    {
      isSuperadmin: true,
      databaseUserId: "user-superadmin",
    },
    { now: NOW },
  );

  assert.deepEqual(query.where, {
    userId: "user-superadmin",
    status: "ACTIVE",
  });
  assert.equal(query.take, 50);
  assert.deepEqual(query.select.organization.select.projects.where, {
    status: "ACTIVE",
  });
  assert.deepEqual(targets, [
    {
      organizationId: "organization-a",
      organizationName: "Constructora Piloto",
      projects: [
        { id: "project-a", name: "Álamo" },
        { id: "project-z", name: "Zócalo" },
      ],
    },
  ]);
  assert.equal(JSON.stringify(targets).includes("clerkOrganizationId"), false);
  assert.equal(JSON.stringify(targets).includes("tenantRole"), false);
});

test("pilot target catalog fails closed before querying for a non-superadmin", async () => {
  const prisma = {
    tenantMembership: {
      async findMany() {
        throw new Error("Database must not be queried.");
      },
    },
  };
  assert.deepEqual(
    await listWhatsAppPilotImportTargets(prisma, {
      isSuperadmin: false,
      databaseUserId: "tenant-user",
    }),
    [],
  );
});

test("pilot target catalog returns a safe, actionable server reason when no target qualifies", async () => {
  async function catalogFor(rows) {
    return loadWhatsAppPilotImportTargetCatalog(
      {
        tenantMembership: {
          async findMany() {
            return rows;
          },
        },
      },
      {
        isSuperadmin: true,
        databaseUserId: "user-superadmin",
      },
      { now: NOW },
    );
  }

  const expired = await catalogFor([
    membership({
      organization: organization({
        subscriptionPlan: "TRIAL",
        subscriptionStatus: "TRIALING",
        trialEndsAt: new Date("2026-07-25T23:59:59.999Z"),
      }),
    }),
  ]);
  assert.deepEqual(expired.targets, []);
  assert.equal(expired.emptyState.code, "TRIAL_EXPIRED");
  assert.match(expired.emptyState.title, /venció/);
  assert.match(expired.emptyState.description, /Extendé|activá/);
  assert.doesNotMatch(JSON.stringify(expired.emptyState), /organization-a/);

  const suspended = await catalogFor([
    membership({
      organization: organization({ subscriptionStatus: "SUSPENDED" }),
    }),
  ]);
  assert.equal(suspended.emptyState.code, "SUBSCRIPTION_BLOCKED");

  const withoutProject = await catalogFor([
    membership({ organization: organization({ projects: [] }) }),
  ]);
  assert.equal(withoutProject.emptyState.code, "NO_ACTIVE_PROJECT");

  const withoutPermission = await catalogFor([
    membership({ tenantRole: "AUDITOR" }),
  ]);
  assert.equal(withoutPermission.emptyState.code, "PERMISSION_REQUIRED");

  const withoutMembership = await catalogFor([]);
  assert.equal(withoutMembership.emptyState.code, "NO_ACTIVE_MEMBERSHIP");
});

test("idempotency keys use cryptographic randomness and the request body has the exact API envelope", () => {
  const key = createPilotImportIdempotencyKey({
    randomUUID: () => "00112233-4455-6677-8899-aabbccddeeff",
  });
  assert.equal(key, "pilot-import-00112233-4455-6677-8899-aabbccddeeff");
  assert.match(key, /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);

  const withoutPin = pilotImportRequestBody(VALID_DRAFT);
  assert.deepEqual(Object.keys(withoutPin).sort(), [
    "accessToken",
    "phoneNumberId",
    "projectId",
    "whatsappBusinessId",
  ]);
  const withPin = pilotImportRequestBody({
    ...VALID_DRAFT,
    registrationPin: "731902",
  });
  assert.equal(withPin.registrationPin, "731902");
});

test("target suffixes disambiguate names without rendering complete identifiers", () => {
  assert.equal(
    pilotTargetIdSuffix("organization-sensitive-prefix-abc123"),
    "…abc123",
  );
  assert.equal(pilotTargetIdSuffix("short1"), "short1");
  assert.equal(pilotTargetIdSuffix(""), "");
});

test("pilot form validation rejects free project IDs and malformed secrets without echoing them", () => {
  const allowedProjectIds = new Set(["project-a"]);
  const allowedAssetPairs = new Set(["123456789:987654321"]);
  assert.equal(
    validatePilotImportDraft(VALID_DRAFT, {
      confirmed: true,
      allowedProjectIds,
      allowedAssetPairs,
    }),
    null,
  );
  assert.match(
    validatePilotImportDraft(
      { ...VALID_DRAFT, projectId: "free-form-id" },
      {
        confirmed: true,
        allowedProjectIds,
        allowedAssetPairs,
      },
    ),
    /tenant y una obra/,
  );
  assert.match(
    validatePilotImportDraft(
      { ...VALID_DRAFT, phoneNumberId: "111111111" },
      {
        confirmed: true,
        allowedProjectIds,
        allowedAssetPairs,
      },
    ),
    /número de prueba/,
  );
  assert.match(
    validatePilotImportDraft(
      { ...VALID_DRAFT, accessToken: " secret-that-is-long-enough " },
      {
        confirmed: true,
        allowedProjectIds,
        allowedAssetPairs,
      },
    ),
    /sin espacios/,
  );
  assert.match(
    validatePilotImportDraft(
      { ...VALID_DRAFT, registrationPin: "12345" },
      {
        confirmed: true,
        allowedProjectIds,
        allowedAssetPairs,
      },
    ),
    /6 números/,
  );
  assert.match(
    validatePilotImportDraft(VALID_DRAFT, {
      confirmed: false,
      allowedProjectIds,
      allowedAssetPairs,
    }),
    /Confirmá/,
  );
});

test("pilot error presentation is allowlisted and the client has no persistence or secret logging path", () => {
  assert.match(
    pilotImportErrorMessage(502, "PILOT_IMPORT_VALIDATION_FAILED"),
    /Meta/,
  );
  assert.match(
    pilotImportErrorMessage(409, "PILOT_IMPORT_RECOVERY_REQUIRED"),
    /operación original/,
  );
  assert.match(
    pilotImportErrorMessage(409, "IDEMPOTENCY_PAYLOAD_MISMATCH"),
    /otros datos/,
  );
  assert.doesNotMatch(
    pilotImportErrorMessage(500, "temporary-pilot-access-token-value"),
    /temporary-pilot-access-token-value/,
  );

  const clientSource = readFileSync(
    new URL(
      "../src/app/dashboard/integrations/pilot-import-panel.js",
      import.meta.url,
    ),
    "utf8",
  );
  const pageSource = readFileSync(
    new URL(
      "../src/app/dashboard/integrations/page.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(clientSource, /type="password"/);
  assert.match(clientSource, /autoComplete="off"/);
  assert.match(clientSource, /useState\(["']{2}\)/);
  assert.match(clientSource, /projectId: ["']{2}/);
  assert.match(clientSource, /Seleccioná un tenant piloto/);
  assert.match(clientSource, /Seleccioná una obra activa/);
  assert.match(clientSource, /disabled=\{!selectedOrganization\}/);
  assert.match(clientSource, /!selectedProject\s*\|\|\s*!selectedAsset/);
  assert.match(clientSource, /Seleccioná un activo emitido por Meta/);
  assert.match(clientSource, /assets\.map\(\(asset\)/);
  assert.match(clientSource, /targetEmptyState\?\.title/);
  assert.match(clientSource, /targetEmptyState\?\.description/);
  assert.match(
    clientSource,
    /function updateDraft[\s\S]*?setConfirmed\(false\)/,
  );
  assert.match(
    clientSource,
    /pilotTargetIdSuffix\(selectedOrganization\.organizationId\)/,
  );
  assert.match(clientSource, /pilotTargetIdSuffix\(selectedProject\.id\)/);
  assert.match(
    clientSource,
    /pilotTargetIdSuffix\(selectedAsset\.whatsappBusinessId\)/,
  );
  assert.match(
    clientSource,
    /pilotTargetIdSuffix\(selectedAsset\.phoneNumberId\)/,
  );
  assert.match(clientSource, /["']Idempotency-Key["']: idempotencyKey/);
  assert.match(clientSource, /cache: ["']no-store["']/);
  assert.match(clientSource, /const router = useRouter\(\)/);
  assert.match(
    clientSource,
    /payload\.connection\.projectId === currentProjectId\) router\.refresh\(\)/,
  );
  assert.match(
    pageSource,
    /key=\{channelHealth\.connection\?\.updatedAt\?\.toISOString\(\) \|\| "unlinked"\}/,
  );
  assert.match(pageSource, /currentProjectId=\{access\.project\.id\}/);
  assert.doesNotMatch(
    clientSource,
    /localStorage|sessionStorage|console\.|URLSearchParams/,
  );
  assert.doesNotMatch(clientSource, /payload\??\.error|tokenLastFour/);
});
