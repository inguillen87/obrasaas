import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  dispatchWhatsAppFlowDataRequest,
  loadWhatsAppFlowTrustedContext,
  verifyWhatsAppFlowTokenSignature,
  WhatsAppFlowDataEndpointError,
} from "../src/lib/whatsapp/flow-endpoint.js";
import { getWhatsAppFlowScopedName } from "../src/lib/whatsapp/flows.js";
import {
  getCurrentWorkerOnboardingPrivacyNotice,
  getWorkerOnboardingPrivacyNotice,
} from "../src/lib/worker-onboarding-privacy-notices.js";

const APP_SECRET = "meta-app-secret-for-endpoint-tests";
const FLOW_TOKEN = "ofs1.123e4567-e89b-42d3-a456-426614174000.signature";
const ENDPOINT_ID = "987e4567-e89b-42d3-a456-426614174000";
const DYNAMIC_FLOW_NAME = getWhatsAppFlowScopedName("shift-check-in", ENDPOINT_ID);
const ONBOARDING_FLOW_TOKEN = `wofs1.223e4567-e89b-42d3-a456-426614174000.${"A".repeat(43)}`;
const ONBOARDING_FLOW_ID = "887654321012345";
const ONBOARDING_FLOW_NAME = getWhatsAppFlowScopedName("worker-onboarding", ENDPOINT_ID);
const CURRENT_ONBOARDING_NOTICE = getCurrentWorkerOnboardingPrivacyNotice();
const SESSION = Object.freeze({
  id: "123e4567-e89b-42d3-a456-426614174000",
  organizationId: "organization-a",
  projectId: "project-a",
  workerId: "worker-a",
  phoneNumberId: "123456789012345",
  blueprintKey: "shift-check-in",
  flowId: "987654321012345",
  screenId: "SHIFT_CHECK_IN",
  flowType: "attendance",
});
const ENDPOINT = Object.freeze({
  endpointId: ENDPOINT_ID,
  connectionId: "connection-a",
  organizationId: SESSION.organizationId,
  projectId: SESSION.projectId,
  phoneNumberId: SESSION.phoneNumberId,
  enabled: true,
  connectionEnabled: true,
  connectionStatus: "CONNECTED",
  metadata: {
    whatsappFlows: {
      "shift-check-in": {
        id: SESSION.flowId,
        name: DYNAMIC_FLOW_NAME,
        status: "PUBLISHED",
        dataExchange: true,
        flowScope: ENDPOINT_ID,
      },
    },
  },
});
const CONTEXT = Object.freeze({
  project: { id: SESSION.projectId, name: "Torre Norte" },
  worker: { name: "Ana Pérez" },
  workAreas: [
    { id: "task_area_a", title: "Estructura nivel 2", taskRef: "task-a" },
    { id: "task_area_b", title: "Núcleo de servicios", taskRef: "task-b" },
  ],
});
const ONBOARDING_SESSION = Object.freeze({
  id: "223e4567-e89b-42d3-a456-426614174000",
  claimId: "claim-a",
  organizationId: SESSION.organizationId,
  projectId: SESSION.projectId,
  connectionId: ENDPOINT.connectionId,
  phoneNumberId: SESSION.phoneNumberId,
  blueprintKey: "worker-onboarding",
  flowId: ONBOARDING_FLOW_ID,
  screenId: "WORKER_ONBOARDING",
  flowType: "worker_onboarding",
  noticeVersion: CURRENT_ONBOARDING_NOTICE.version,
  noticeContentSha256: CURRENT_ONBOARDING_NOTICE.contentSha256,
  tokenSha256: crypto.createHash("sha256").update(ONBOARDING_FLOW_TOKEN).digest("hex"),
  expiresAt: new Date("2026-07-28T18:30:00.000Z"),
  privacyPresentedAt: null,
});
const ONBOARDING_CLAIM = Object.freeze({
  id: ONBOARDING_SESSION.claimId,
  status: "PENDING",
});
const ONBOARDING_ENDPOINT = Object.freeze({
  ...ENDPOINT,
  metadata: {
    whatsappFlows: {
      ...ENDPOINT.metadata.whatsappFlows,
      "worker-onboarding": {
        id: ONBOARDING_FLOW_ID,
        name: ONBOARDING_FLOW_NAME,
        status: "PUBLISHED",
        dataExchange: true,
        flowScope: ENDPOINT_ID,
      },
    },
  },
});

function jwt(claims, secret = APP_SECRET, header = { alg: "HS256", typ: "JWT" }) {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function dependencies({ session = SESSION, writes = [] } = {}) {
  return {
    prisma: new Proxy({}, {
      get(_target, property) {
        if (["create", "update", "updateMany", "delete", "upsert"].includes(String(property))) {
          writes.push(property);
        }
        return undefined;
      },
    }),
    authenticateSession: async () => ({ session }),
    loadTrustedContext: async () => CONTEXT,
  };
}

function payload(overrides = {}) {
  return {
    version: "3.0",
    action: "INIT",
    flow_token: FLOW_TOKEN,
    ...overrides,
  };
}

function assertEndpointError(code, status) {
  return (error) => {
    assert.equal(error instanceof WhatsAppFlowDataEndpointError, true);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  };
}

test("Data API 4 token signatures bind the exact outer Flow token", () => {
  const signature = jwt({ flow_token: FLOW_TOKEN });
  assert.deepEqual(verifyWhatsAppFlowTokenSignature({
    signature,
    flowToken: FLOW_TOKEN,
    appSecret: APP_SECRET,
  }), { present: true, valid: true });
  assert.deepEqual(verifyWhatsAppFlowTokenSignature({
    signature: undefined,
    flowToken: FLOW_TOKEN,
    appSecret: APP_SECRET,
  }), { present: false, valid: false });

  assert.throws(
    () => verifyWhatsAppFlowTokenSignature({
      signature: jwt({ flow_token: "different" }),
      flowToken: FLOW_TOKEN,
      appSecret: APP_SECRET,
    }),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID", 427),
  );
  assert.throws(
    () => verifyWhatsAppFlowTokenSignature({
      signature: jwt({ flow_token: FLOW_TOKEN }, APP_SECRET, { alg: "none" }),
      flowToken: FLOW_TOKEN,
      appSecret: APP_SECRET,
    }),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID", 427),
  );
});

test("ping and Meta error notifications are acknowledged without session access", async () => {
  let authentications = 0;
  const common = {
    endpoint: ENDPOINT,
    prisma: {},
    appSecret: APP_SECRET,
  };
  const options = {
    authenticateSession: async () => {
      authentications += 1;
      throw new Error("must not authenticate");
    },
  };
  const ping = await dispatchWhatsAppFlowDataRequest({
    ...common,
    payload: { version: "3.0", action: "ping" },
  }, options);
  const acknowledged = await dispatchWhatsAppFlowDataRequest({
    ...common,
    payload: { version: "3.0", action: "data_exchange", data: { error: "client" } },
  }, options);

  assert.deepEqual(ping.response, { data: { status: "active" } });
  assert.deepEqual(acknowledged.response, { data: { acknowledged: true } });
  assert.equal(authentications, 0);
});

test("INIT returns only server-owned project, worker, and work-area context", async () => {
  const writes = [];
  const deps = dependencies({ writes });
  const result = await dispatchWhatsAppFlowDataRequest({
    payload: payload({
      flow_token_signature: jwt({ flow_token: FLOW_TOKEN }),
      data: { organizationId: "attacker", project_name: "attacker" },
    }),
    endpoint: ENDPOINT,
    prisma: deps.prisma,
    appSecret: APP_SECRET,
  }, deps);

  assert.deepEqual(result.response, {
    screen: "SHIFT_CHECK_IN",
    data: {
      project_name: "Torre Norte",
      worker_name: "Ana Pérez",
      work_areas: CONTEXT.workAreas.map(({ id, title }) => ({ id, title })),
    },
  });
  assert.equal(result.session.id, SESSION.id);
  assert.equal(result.signaturePresent, true);
  assert.deepEqual(writes, []);
});

test("data_exchange maps a trusted option and emits the legacy-compatible terminal reply", async () => {
  const deps = dependencies();
  const result = await dispatchWhatsAppFlowDataRequest({
    payload: payload({
      action: "data_exchange",
      screen: "SHIFT_CHECK_IN",
      data: {
        work_area: "task_area_b",
        ppe_status: "complete",
        observations: "Sin novedades",
      },
    }),
    endpoint: ENDPOINT,
    prisma: deps.prisma,
    appSecret: APP_SECRET,
  }, deps);

  assert.deepEqual(result.response, {
    screen: "SUCCESS",
    data: {
      extension_message_response: {
        params: {
          flow_token: FLOW_TOKEN,
          flow_type: "attendance",
          work_area: "Núcleo de servicios",
          ppe_status: "complete",
          observations: "Sin novedades",
          task_ref: "task-b",
        },
      },
    },
  });
});

test("pre-worker onboarding INIT is isolated from Worker data and returns only trusted privacy context", async () => {
  let operationalAuthentications = 0;
  const result = await dispatchWhatsAppFlowDataRequest({
    payload: payload({
      flow_token: ONBOARDING_FLOW_TOKEN,
      flow_token_signature: jwt({ flow_token: ONBOARDING_FLOW_TOKEN }),
      data: { project_name: "attacker", privacy_notice_version: "attacker" },
    }),
    endpoint: ONBOARDING_ENDPOINT,
    prisma: {
      project: {
        findFirst: async () => ({
          id: SESSION.projectId,
          name: "Torre Norte",
          organization: {
            subscriptionPlan: "PRO",
            subscriptionStatus: "ACTIVE",
            trialEndsAt: null,
            timezone: "America/Argentina/Buenos_Aires",
          },
        }),
      },
    },
    appSecret: APP_SECRET,
    now: new Date("2026-07-28T17:00:00.000Z"),
  }, {
    authenticateSession: async () => {
      operationalAuthentications += 1;
      throw new Error("operational authentication must stay isolated");
    },
    authenticateOnboardingSession: async () => ({
      session: ONBOARDING_SESSION,
      claim: ONBOARDING_CLAIM,
      tokenEvidence: { tokenSha256: ONBOARDING_SESSION.tokenSha256 },
    }),
    presentOnboardingPrivacy: async (_prisma, _input, { now }) => ({
      session: { ...ONBOARDING_SESSION, privacyPresentedAt: now },
      alreadyPresented: false,
    }),
  });

  assert.equal(operationalAuthentications, 0);
  assert.equal(result.session.kind, "worker_onboarding");
  assert.equal(result.response.screen, "WORKER_ONBOARDING");
  assert.equal(result.response.data.project_name, "Torre Norte");
  assert.equal(result.response.data.privacy_notice_version, CURRENT_ONBOARDING_NOTICE.version);
  assert.equal(result.response.data.privacy_notice_text, CURRENT_ONBOARDING_NOTICE.content);
  assert.match(result.response.data.expires_label, /vence/i);
  assert.equal(JSON.stringify(result.response).includes("worker-a"), false);
});

test("pre-worker onboarding submission persists encrypted-domain input and emits a receipt without identity values", async () => {
  const calls = [];
  const identity = {
    given_names: "Carlos Alberto",
    family_name: "Pérez",
    cuil: "20-12345678-6",
    privacy_accepted: true,
  };
  const result = await dispatchWhatsAppFlowDataRequest({
    payload: payload({
      flow_token: ONBOARDING_FLOW_TOKEN,
      action: "data_exchange",
      screen: "WORKER_ONBOARDING",
      data: identity,
    }),
    endpoint: ONBOARDING_ENDPOINT,
    prisma: {
      project: {
        findFirst: async () => ({
          id: SESSION.projectId,
          name: "Torre Norte",
          organization: {
            subscriptionPlan: "PRO",
            subscriptionStatus: "ACTIVE",
            trialEndsAt: null,
            timezone: "America/Argentina/Buenos_Aires",
          },
        }),
      },
    },
    appSecret: APP_SECRET,
    now: new Date("2026-07-28T17:00:00.000Z"),
  }, {
    authenticateOnboardingSession: async () => ({
      session: {
        ...ONBOARDING_SESSION,
        privacyPresentedAt: new Date("2026-07-28T16:59:00.000Z"),
      },
      claim: ONBOARDING_CLAIM,
      tokenEvidence: { tokenSha256: ONBOARDING_SESSION.tokenSha256 },
    }),
    submitOnboardingFlow: async (_prisma, input) => {
      calls.push(["submit", structuredClone(input)]);
      return { id: "claim-a", status: "SUBMITTED" };
    },
  });

  assert.deepEqual(calls[0][1].scope, {
    organizationId: SESSION.organizationId,
    projectId: SESSION.projectId,
  });
  assert.deepEqual(calls[0][1].identity, {
    givenNames: identity.given_names,
    familyName: identity.family_name,
    cuil: identity.cuil,
    privacyAccepted: true,
  });
  assert.equal(calls[0][1].sessionId, ONBOARDING_SESSION.id);
  assert.equal(calls[0][1].phoneNumberId, ONBOARDING_SESSION.phoneNumberId);
  assert.equal(calls[0][1].flowId, ONBOARDING_SESSION.flowId);
  assert.equal(calls[0][1].tokenSha256, ONBOARDING_SESSION.tokenSha256);
  const params = result.response.data.extension_message_response.params;
  assert.deepEqual(params, {
    flow_token: ONBOARDING_FLOW_TOKEN,
    flow_type: "worker_onboarding",
    claim_ref: "claim-a",
    submission_status: "submitted",
  });
  const receiptWithoutProtocolToken = JSON.stringify({ ...params, flow_token: null });
  assert.equal(receiptWithoutProtocolToken.includes(identity.given_names), false);
  assert.equal(receiptWithoutProtocolToken.includes(identity.family_name), false);
  assert.equal(receiptWithoutProtocolToken.includes(identity.cuil), false);

  for (const invalidData of [
    { ...identity, privacy_accepted: false },
    { ...identity, privacy_notice_version: "client-owned" },
    { ...identity, cuil: "invalid", flow_type: "worker_onboarding" },
  ]) {
    await assert.rejects(
      dispatchWhatsAppFlowDataRequest({
        payload: payload({
          flow_token: ONBOARDING_FLOW_TOKEN,
          action: "data_exchange",
          screen: "WORKER_ONBOARDING",
          data: invalidData,
        }),
        endpoint: ONBOARDING_ENDPOINT,
        prisma: {
          project: {
            findFirst: async () => ({
              id: SESSION.projectId,
              name: "Torre Norte",
              organization: {
                subscriptionPlan: "PRO",
                subscriptionStatus: "ACTIVE",
                timezone: "America/Argentina/Buenos_Aires",
              },
            }),
          },
        },
        appSecret: APP_SECRET,
      }, {
        authenticateOnboardingSession: async () => ({
          session: {
            ...ONBOARDING_SESSION,
            privacyPresentedAt: new Date("2026-07-28T16:59:00.000Z"),
          },
          claim: ONBOARDING_CLAIM,
          tokenEvidence: { tokenSha256: ONBOARDING_SESSION.tokenSha256 },
        }),
        submitOnboardingFlow: async () => {
          throw new Error("invalid form must not reach persistence");
        },
      }),
      assertEndpointError("WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID", 400),
    );
  }
});

test("a notice rotation after issuance cannot change the exact text presented by INIT", async () => {
  const legacyNotice = getWorkerOnboardingPrivacyNotice("worker-privacy-v1");
  assert.notEqual(legacyNotice.version, CURRENT_ONBOARDING_NOTICE.version);
  const legacySession = {
    ...ONBOARDING_SESSION,
    noticeVersion: legacyNotice.version,
    noticeContentSha256: legacyNotice.contentSha256,
  };
  const result = await dispatchWhatsAppFlowDataRequest({
    payload: payload({ flow_token: ONBOARDING_FLOW_TOKEN }),
    endpoint: ONBOARDING_ENDPOINT,
    prisma: {
      project: {
        findFirst: async () => ({
          id: SESSION.projectId,
          name: "Torre Norte",
          organization: {
            subscriptionPlan: "PRO",
            subscriptionStatus: "ACTIVE",
            timezone: "America/Argentina/Buenos_Aires",
          },
        }),
      },
    },
    appSecret: APP_SECRET,
    now: new Date("2026-07-28T17:00:00.000Z"),
  }, {
    authenticateOnboardingSession: async () => ({
      session: legacySession,
      claim: ONBOARDING_CLAIM,
      tokenEvidence: { tokenSha256: legacySession.tokenSha256 },
    }),
    presentOnboardingPrivacy: async (_prisma, _input, { now }) => ({
      session: { ...legacySession, privacyPresentedAt: now },
      alreadyPresented: false,
    }),
  });
  assert.equal(result.response.data.privacy_notice_version, legacyNotice.version);
  assert.equal(result.response.data.privacy_notice_text, legacyNotice.content);
  assert.notEqual(result.response.data.privacy_notice_text, CURRENT_ONBOARDING_NOTICE.content);
});

test("data_exchange without a prior INIT privacy presentation fails before persistence", async () => {
  let submissions = 0;
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: payload({
        flow_token: ONBOARDING_FLOW_TOKEN,
        action: "data_exchange",
        screen: "WORKER_ONBOARDING",
        data: {
          given_names: "Carlos",
          family_name: "Perez",
          cuil: "20-12345678-6",
          privacy_accepted: true,
        },
      }),
      endpoint: ONBOARDING_ENDPOINT,
      prisma: {},
      appSecret: APP_SECRET,
    }, {
      authenticateOnboardingSession: async () => ({
        session: ONBOARDING_SESSION,
        claim: ONBOARDING_CLAIM,
        tokenEvidence: { tokenSha256: ONBOARDING_SESSION.tokenSha256 },
      }),
      submitOnboardingFlow: async () => {
        submissions += 1;
      },
    }),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID", 427),
  );
  assert.equal(submissions, 0);
});

test("projected task identities survive duplicate names and reordering, then fail closed after deletion", async () => {
  let tasks = [
    {
      externalId: "snapshot:task-a",
      title: "Estructura nivel 2",
      metadata: { source: "project-snapshot-v1" },
    },
    {
      externalId: "snapshot:task-b",
      title: "Estructura nivel 2",
      metadata: { source: "project-snapshot-v1" },
    },
  ];
  let taskQuery = null;
  const prisma = {
    project: {
      findFirst: async () => ({
        id: SESSION.projectId,
        name: "Torre Norte",
        address: "Av. Obra 100",
        organization: { subscriptionPlan: "PRO", subscriptionStatus: "ACTIVE" },
      }),
    },
    worker: {
      findFirst: async () => ({ id: SESSION.workerId, name: "Ana Pérez" }),
    },
    task: {
      findMany: async (query) => {
        taskQuery = query;
        return tasks;
      },
    },
  };

  const initial = await loadWhatsAppFlowTrustedContext(prisma, SESSION);
  assert.deepEqual(taskQuery.where, {
    projectId: SESSION.projectId,
    externalId: { startsWith: "snapshot:" },
    metadata: { path: ["source"], equals: "project-snapshot-v1" },
    status: { in: ["READY", "IN_PROGRESS", "BLOCKED"] },
  });
  assert.deepEqual(taskQuery.select, { externalId: true, title: true, assignee: true });
  tasks = [...tasks].reverse();
  const reordered = await loadWhatsAppFlowTrustedContext(prisma, SESSION);
  const initialIdsByTaskRef = Object.fromEntries(
    initial.workAreas.map((area) => [area.taskRef, area.id]),
  );
  const reorderedIdsByTaskRef = Object.fromEntries(
    reordered.workAreas.map((area) => [area.taskRef, area.id]),
  );
  assert.deepEqual(reorderedIdsByTaskRef, initialIdsByTaskRef);
  assert.equal(new Set(initial.workAreas.map((area) => area.title)).size, 2);
  assert.equal(initial.workAreas.every((area) => area.title.startsWith("Estructura nivel 2 · ")), true);
  assert.match(initialIdsByTaskRef["task-a"], /^task_[a-f0-9]{24}$/);
  assert.notEqual(initialIdsByTaskRef["task-a"], initialIdsByTaskRef["task-b"]);

  const selectedTaskId = initialIdsByTaskRef["task-a"];
  tasks = [{
    externalId: "snapshot:task-b",
    title: "Estructura nivel 2",
    metadata: { source: "project-snapshot-v1" },
  }];
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: payload({
        action: "data_exchange",
        screen: "SHIFT_CHECK_IN",
        data: {
          work_area: selectedTaskId,
          ppe_status: "complete",
          observations: "Sin novedades",
        },
      }),
      endpoint: ENDPOINT,
      prisma,
      appSecret: APP_SECRET,
    }, {
      authenticateSession: async () => ({ session: SESSION }),
      loadTrustedContext: (client, session) => loadWhatsAppFlowTrustedContext(client, session),
    }),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID", 400),
  );

  tasks = [];
  const fallback = await loadWhatsAppFlowTrustedContext(prisma, SESSION);
  assert.deepEqual(fallback.workAreas, [{ id: "project_site", title: "Av. Obra 100" }]);
});

test("cross-screen, client-owned flow_type or task_ref, and stale static metadata fail closed", async () => {
  const deps = dependencies();
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: payload({
        action: "data_exchange",
        screen: "OTHER_SCREEN",
        data: { work_area: "task_area_a", ppe_status: "complete", observations: "" },
      }),
      endpoint: ENDPOINT,
      prisma: deps.prisma,
      appSecret: APP_SECRET,
    }, deps),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID", 400),
  );
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: payload({
        action: "data_exchange",
        screen: "SHIFT_CHECK_IN",
        data: {
          task_ref: "task-b",
          work_area: "task_area_b",
          ppe_status: "complete",
          observations: "",
        },
      }),
      endpoint: ENDPOINT,
      prisma: deps.prisma,
      appSecret: APP_SECRET,
    }, deps),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID", 400),
  );
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: payload({
        action: "data_exchange",
        screen: "SHIFT_CHECK_IN",
        data: {
          flow_type: "incident",
          work_area: "task_area_a",
          ppe_status: "complete",
          observations: "",
        },
      }),
      endpoint: ENDPOINT,
      prisma: deps.prisma,
      appSecret: APP_SECRET,
    }, deps),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID", 400),
  );
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: payload(),
      endpoint: {
        ...ENDPOINT,
        metadata: {
          whatsappFlows: {
            "shift-check-in": {
              ...ENDPOINT.metadata.whatsappFlows["shift-check-in"],
              dataExchange: false,
            },
          },
        },
      },
      prisma: deps.prisma,
      appSecret: APP_SECRET,
    }, deps),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE", 427),
  );
});

test("unknown fields and undocumented protocol versions are rejected", async () => {
  const deps = dependencies();
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: payload({ version: "4.0" }),
      endpoint: ENDPOINT,
      prisma: deps.prisma,
      appSecret: APP_SECRET,
    }, deps),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID", 400),
  );
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: { ...payload(), organizationId: "attacker" },
      endpoint: ENDPOINT,
      prisma: deps.prisma,
      appSecret: APP_SECRET,
    }, deps),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID", 400),
  );
});
