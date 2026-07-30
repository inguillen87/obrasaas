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
import { getCurrentWorkerPaymentPrivacyNotice } from "../src/lib/worker-payment-privacy-notices.js";
import { WhatsAppFlowSessionError } from "../src/lib/whatsapp/flow-sessions.js";
import { WorkerPaymentFlowSessionError } from "../src/lib/whatsapp/worker-payment-flow-sessions.js";
import { WorkerPaymentFlowSubmissionError } from "../src/lib/whatsapp/worker-payment-flow-submissions.js";

const APP_SECRET = "meta-app-secret-for-endpoint-tests";
const FLOW_TOKEN = "ofs1.123e4567-e89b-42d3-a456-426614174000.signature";
const ENDPOINT_ID = "987e4567-e89b-42d3-a456-426614174000";
const DYNAMIC_FLOW_NAME = getWhatsAppFlowScopedName("shift-check-in", ENDPOINT_ID);
const ONBOARDING_FLOW_TOKEN = `wofs1.223e4567-e89b-42d3-a456-426614174000.${"A".repeat(43)}`;
const ONBOARDING_FLOW_ID = "887654321012345";
const ONBOARDING_FLOW_NAME = getWhatsAppFlowScopedName("worker-onboarding", ENDPOINT_ID);
const CURRENT_ONBOARDING_NOTICE = getCurrentWorkerOnboardingPrivacyNotice();
const PAYMENT_FLOW_TOKEN = `ofs1.323e4567-e89b-42d3-a456-426614174000.${"B".repeat(43)}`;
const PAYMENT_FLOW_ID = "777654321012345";
const PAYMENT_RESERVATION_ID = "423e4567-e89b-42d3-a456-426614174000";
const PAYMENT_FLOW_SUBMISSION = Object.freeze({
  reservationId: PAYMENT_RESERVATION_ID,
  fingerprintKeyId: "payment-flow-v1",
  fingerprintHmac: "a".repeat(64),
});
const PAYMENT_FLOW_NAME = getWhatsAppFlowScopedName("worker-payment-destination", ENDPOINT_ID);
const CURRENT_PAYMENT_NOTICE = getCurrentWorkerPaymentPrivacyNotice();
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
const PAYMENT_SESSION = Object.freeze({
  ...SESSION,
  id: "323e4567-e89b-42d3-a456-426614174000",
  blueprintKey: "worker-payment-destination",
  flowId: PAYMENT_FLOW_ID,
  screenId: "WORKER_PAYMENT_DESTINATION",
  flowType: "worker_payment_destination",
});
const PAYMENT_COMPANION = Object.freeze({
  flowSessionId: PAYMENT_SESSION.id,
  organizationId: PAYMENT_SESSION.organizationId,
  projectId: PAYMENT_SESSION.projectId,
  connectionId: ENDPOINT.connectionId,
  workerId: PAYMENT_SESSION.workerId,
  personId: "person-a",
  channelIdentityId: "channel-a",
  noticeVersion: CURRENT_PAYMENT_NOTICE.version,
  noticeContentSha256: CURRENT_PAYMENT_NOTICE.contentSha256,
  expiresAt: "2026-07-28T18:30:00.000Z",
  privacyPresentedAt: "2026-07-28T16:59:00.000Z",
  submissionStatus: "OPEN",
  revision: 1,
});
const PAYMENT_ENDPOINT = Object.freeze({
  ...ENDPOINT,
  metadata: {
    whatsappFlows: {
      ...ENDPOINT.metadata.whatsappFlows,
      "worker-payment-destination": {
        id: PAYMENT_FLOW_ID,
        name: PAYMENT_FLOW_NAME,
        status: "PUBLISHED",
        dataExchange: true,
        flowScope: ENDPOINT_ID,
      },
    },
  },
});
const PAYMENT_FORM = Object.freeze({
  purpose: "salary",
  destination_type: "cbu",
  destination_value: "9999999100000000000000",
  holder_declaration: true,
  capture_notice_acknowledged: true,
});

function loadedPaymentSession(overrides = {}) {
  return {
    session: { ...PAYMENT_SESSION, kind: "worker_payment" },
    paymentSession: { ...PAYMENT_COMPANION, ...overrides },
    notice: CURRENT_PAYMENT_NOTICE,
  };
}

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

test("payment INIT records the pinned notice and returns only server-owned screen context", async () => {
  const calls = [];
  const result = await dispatchWhatsAppFlowDataRequest({
    payload: payload({
      flow_token: PAYMENT_FLOW_TOKEN,
      data: {
        project_name: "attacker",
        worker_name: "attacker",
        capture_notice_text: "attacker",
        destination_value: PAYMENT_FORM.destination_value,
      },
    }),
    endpoint: PAYMENT_ENDPOINT,
    prisma: {},
    appSecret: APP_SECRET,
    now: new Date("2026-07-28T17:00:00.000Z"),
  }, {
    authenticateSession: async () => ({ session: PAYMENT_SESSION }),
    loadTrustedContext: async () => {
      throw new Error("generic work-area context must not load for payments");
    },
    presentPaymentPrivacy: async (_prisma, scope, { now }) => {
      calls.push(["present", structuredClone(scope), now.toISOString()]);
      return loadedPaymentSession();
    },
    loadPaymentTrustedContext: async (_prisma, session, paymentSession) => {
      calls.push(["context", session.id, paymentSession.personId]);
      return {
        project: {
          id: PAYMENT_SESSION.projectId,
          name: "Torre Norte",
          organization: { timezone: "America/Argentina/Buenos_Aires" },
        },
        worker: { id: PAYMENT_SESSION.workerId, name: "Ana PÃ©rez" },
      };
    },
  });

  assert.deepEqual(calls, [
    ["present", {
      flowSessionId: PAYMENT_SESSION.id,
      organizationId: PAYMENT_SESSION.organizationId,
      projectId: PAYMENT_SESSION.projectId,
      connectionId: PAYMENT_ENDPOINT.connectionId,
      phoneNumberId: PAYMENT_SESSION.phoneNumberId,
    }, "2026-07-28T17:00:00.000Z"],
    ["context", PAYMENT_SESSION.id, PAYMENT_COMPANION.personId],
  ]);
  assert.equal(result.session.id, PAYMENT_SESSION.id);
  assert.equal(result.session.kind, "worker_payment");
  assert.equal(result.response.screen, "WORKER_PAYMENT_DESTINATION");
  assert.deepEqual(Object.keys(result.response.data).sort(), [
    "capture_notice_text",
    "capture_notice_version",
    "expires_label",
    "project_name",
    "worker_name",
  ]);
  assert.equal(result.response.data.project_name, "Torre Norte");
  assert.equal(result.response.data.worker_name, "Ana PÃ©rez");
  assert.equal(result.response.data.capture_notice_version, CURRENT_PAYMENT_NOTICE.version);
  assert.equal(result.response.data.capture_notice_text, CURRENT_PAYMENT_NOTICE.content);
  assert.match(result.response.data.expires_label, /vence/i);
  assert.equal(JSON.stringify(result.response).includes(PAYMENT_FORM.destination_value), false);
  assert.equal(JSON.stringify(result.response).includes(PAYMENT_COMPANION.personId), false);
  assert.equal(JSON.stringify(result.response).includes(PAYMENT_COMPANION.channelIdentityId), false);
});

test("payment BACK re-presents the governed screen while terminal sessions never reopen the form", async () => {
  let presentations = 0;
  let contextLoads = 0;
  const baseOptions = {
    authenticateSession: async () => ({ session: PAYMENT_SESSION }),
    loadPaymentTrustedContext: async () => {
      contextLoads += 1;
      return {
        project: {
          id: PAYMENT_SESSION.projectId,
          name: "Torre Norte",
          organization: { timezone: "America/Argentina/Buenos_Aires" },
        },
        worker: { id: PAYMENT_SESSION.workerId, name: "Ana Pérez" },
      };
    },
  };
  const back = await dispatchWhatsAppFlowDataRequest({
    payload: payload({ flow_token: PAYMENT_FLOW_TOKEN, action: "BACK" }),
    endpoint: PAYMENT_ENDPOINT,
    prisma: {},
    appSecret: APP_SECRET,
  }, {
    ...baseOptions,
    presentPaymentPrivacy: async () => {
      presentations += 1;
      return loadedPaymentSession();
    },
  });
  assert.equal(back.response.screen, "WORKER_PAYMENT_DESTINATION");
  assert.equal(presentations, 1);
  assert.equal(contextLoads, 1);

  const receipt = {
    flow_type: "worker_payment_destination",
    destination_ref: "destination-opaque-a",
    submission_status: "received",
    submitted_at: "2026-07-28T17:00:00.000Z",
  };
  const succeeded = await dispatchWhatsAppFlowDataRequest({
    payload: payload({ flow_token: PAYMENT_FLOW_TOKEN, action: "INIT" }),
    endpoint: PAYMENT_ENDPOINT,
    prisma: {},
    appSecret: APP_SECRET,
  }, {
    ...baseOptions,
    presentPaymentPrivacy: async () => ({
      ...loadedPaymentSession({ submissionStatus: "SUCCEEDED" }),
      receipt,
    }),
  });
  assert.equal(succeeded.response.screen, "SUCCESS");
  assert.equal(
    succeeded.response.data.extension_message_response.params.destination_ref,
    "destination-opaque-a",
  );
  assert.equal(contextLoads, 1);

  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: payload({ flow_token: PAYMENT_FLOW_TOKEN, action: "INIT" }),
      endpoint: PAYMENT_ENDPOINT,
      prisma: {},
      appSecret: APP_SECRET,
    }, {
      ...baseOptions,
      presentPaymentPrivacy: async () => loadedPaymentSession({ submissionStatus: "UNCERTAIN" }),
      reconcilePaymentSubmission: async () => ({
        outcome: null,
        awaitingOutcome: 1,
        provenanceMismatches: 0,
      }),
    }),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_SUBMISSION_CONFLICT", 409),
  );
  assert.equal(contextLoads, 1);
});

test("payment data_exchange reserves, submits, completes, and emits only the allowlisted receipt", async () => {
  const calls = [];
  const now = new Date("2026-07-28T17:00:00.000Z");
  const result = await dispatchWhatsAppFlowDataRequest({
    payload: payload({
      flow_token: PAYMENT_FLOW_TOKEN,
      action: "data_exchange",
      screen: "WORKER_PAYMENT_DESTINATION",
      data: PAYMENT_FORM,
    }),
    endpoint: PAYMENT_ENDPOINT,
    prisma: {},
    appSecret: APP_SECRET,
    now,
  }, {
    authenticateSession: async () => ({ session: PAYMENT_SESSION }),
    loadTrustedContext: async () => {
      throw new Error("generic work-area context must not load for payments");
    },
    loadPaymentSession: async (_prisma, scope) => {
      calls.push(["load", structuredClone(scope)]);
      return loadedPaymentSession();
    },
    reservePaymentSubmission: async (_prisma, scope, form) => {
      calls.push(["reserve", structuredClone(scope), structuredClone(form)]);
      return {
        state: "reserved",
        reservationId: PAYMENT_RESERVATION_ID,
        operationKey: "wpf-terminal:323e4567-e89b-42d3-a456-426614174000:423e4567-e89b-42d3-a456-426614174000",
        flowSubmission: PAYMENT_FLOW_SUBMISSION,
      };
    },
    submitPaymentFlow: async (_prisma, options) => {
      calls.push(["bridge", structuredClone(options)]);
      return {
        destinationRef: "destination-opaque-a",
        paymentDestination: {
          id: "destination-opaque-a",
          maskedValue: "****0000",
          status: "PENDING_VERIFICATION",
        },
      };
    },
    completePaymentSubmission: async (_prisma, scope, form, completion) => {
      calls.push([
        "complete",
        structuredClone(scope),
        structuredClone(form),
        structuredClone(completion),
      ]);
      return {
        session: { ...PAYMENT_SESSION, kind: "worker_payment" },
        receipt: {
          flow_type: "worker_payment_destination",
          destination_ref: "destination-opaque-a",
          submission_status: "received",
          submitted_at: "2026-07-28T17:00:00.000Z",
        },
      };
    },
  });

  assert.deepEqual(calls.map(([name]) => name), ["load", "reserve", "bridge", "complete"]);
  const bridgeOptions = calls.find(([name]) => name === "bridge")[1];
  assert.deepEqual(bridgeOptions.scope, {
    organizationId: PAYMENT_SESSION.organizationId,
    projectId: PAYMENT_SESSION.projectId,
    workerId: PAYMENT_SESSION.workerId,
    personId: PAYMENT_COMPANION.personId,
    channelIdentityId: PAYMENT_COMPANION.channelIdentityId,
  });
  assert.deepEqual(bridgeOptions.form, PAYMENT_FORM);
  assert.deepEqual(bridgeOptions.notice, {
    version: CURRENT_PAYMENT_NOTICE.version,
    contentSha256: CURRENT_PAYMENT_NOTICE.contentSha256,
    presentedAt: PAYMENT_COMPANION.privacyPresentedAt,
  });
  assert.equal(bridgeOptions.now.toISOString(), now.toISOString());
  assert.equal(bridgeOptions.operationKey.includes(PAYMENT_FORM.destination_value), false);
  assert.deepEqual(bridgeOptions.flowSubmission, PAYMENT_FLOW_SUBMISSION);
  assert.deepEqual(result.response, {
    screen: "SUCCESS",
    data: {
      extension_message_response: {
        params: {
          flow_token: PAYMENT_FLOW_TOKEN,
          flow_type: "worker_payment_destination",
          destination_ref: "destination-opaque-a",
          submission_status: "received",
        },
      },
    },
  });
  const serialized = JSON.stringify(result.response);
  assert.equal(serialized.includes(PAYMENT_FORM.destination_value), false);
  assert.equal(serialized.includes("****0000"), false);
  assert.equal(serialized.includes("submitted_at"), false);
});

test("payment terminal replay bypasses the bridge and UNCERTAIN never auto-retries", async () => {
  let bridgeCalls = 0;
  const common = {
    endpoint: PAYMENT_ENDPOINT,
    prisma: {},
    appSecret: APP_SECRET,
  };
  const requestPayload = payload({
    flow_token: PAYMENT_FLOW_TOKEN,
    action: "data_exchange",
    screen: "WORKER_PAYMENT_DESTINATION",
    data: PAYMENT_FORM,
  });
  const shared = {
    authenticateSession: async () => ({ session: PAYMENT_SESSION }),
    loadPaymentSession: async () => loadedPaymentSession(),
    submitPaymentFlow: async () => {
      bridgeCalls += 1;
      throw new Error("bridge must not run");
    },
  };
  const replay = await dispatchWhatsAppFlowDataRequest({
    ...common,
    payload: requestPayload,
  }, {
    ...shared,
    reservePaymentSubmission: async () => ({
      state: "replay",
      receipt: {
        flow_type: "worker_payment_destination",
        destination_ref: "destination-opaque-a",
        submission_status: "received",
        submitted_at: "2026-07-28T17:00:00.000Z",
      },
    }),
  });
  assert.equal(
    replay.response.data.extension_message_response.params.destination_ref,
    "destination-opaque-a",
  );

  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({ ...common, payload: requestPayload }, {
      ...shared,
      reservePaymentSubmission: async () => ({ state: "uncertain", replayed: true }),
      reconcilePaymentSubmission: async () => ({
        outcome: null,
        awaitingOutcome: 1,
        provenanceMismatches: 0,
      }),
    }),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_SUBMISSION_CONFLICT", 409),
  );
  assert.equal(bridgeCalls, 0);
});

test("an exact UNCERTAIN proof reconciles locally and returns success without rerunning the bridge", async () => {
  let bridgeCalls = 0;
  let loadCalls = 0;
  let reconciliationCalls = 0;
  const receipt = {
    flow_type: "worker_payment_destination",
    destination_ref: "destination-reconciled-a",
    submission_status: "received",
    submitted_at: "2026-07-28T17:00:00.000Z",
  };
  const result = await dispatchWhatsAppFlowDataRequest({
    payload: payload({
      flow_token: PAYMENT_FLOW_TOKEN,
      action: "data_exchange",
      screen: "WORKER_PAYMENT_DESTINATION",
      data: PAYMENT_FORM,
    }),
    endpoint: PAYMENT_ENDPOINT,
    prisma: {},
    appSecret: APP_SECRET,
  }, {
    authenticateSession: async () => ({ session: PAYMENT_SESSION }),
    loadPaymentSession: async () => {
      loadCalls += 1;
      return loadCalls === 1
        ? loadedPaymentSession({ submissionStatus: "UNCERTAIN" })
        : {
            ...loadedPaymentSession({ submissionStatus: "SUCCEEDED" }),
            receipt,
          };
    },
    reservePaymentSubmission: async () => ({ state: "uncertain", replayed: true }),
    reconcilePaymentSubmission: async (_prisma, target) => {
      reconciliationCalls += 1;
      assert.deepEqual(target, {
        flowSessionId: PAYMENT_SESSION.id,
        organizationId: PAYMENT_SESSION.organizationId,
      });
      return {
        outcome: { destinationId: receipt.destination_ref },
        awaitingOutcome: 0,
        provenanceMismatches: 0,
      };
    },
    submitPaymentFlow: async () => {
      bridgeCalls += 1;
      throw new Error("bridge must not run during reconciliation");
    },
  });

  assert.equal(reconciliationCalls, 1);
  assert.equal(loadCalls, 2);
  assert.equal(bridgeCalls, 0);
  assert.equal(
    result.response.data.extension_message_response.params.destination_ref,
    receipt.destination_ref,
  );
});

test("an expired payment data_exchange replays only the exact SUCCEEDED receipt without a bridge", async () => {
  const calls = [];
  const receipt = {
    flow_type: "worker_payment_destination",
    destination_ref: "destination-expired-replay",
    submission_status: "received",
    submitted_at: "2026-07-28T18:30:00.001Z",
  };
  const authenticateSession = async (_prisma, _input, options) => {
    calls.push(["authenticate", options?.allowExpired === true]);
    if (options?.allowExpired !== true) {
      throw new WhatsAppFlowSessionError(
        "expired",
        "WHATSAPP_FLOW_SESSION_EXPIRED",
      );
    }
    return {
      session: {
        ...PAYMENT_SESSION,
        expiresAt: new Date("2026-07-28T18:30:00.000Z"),
      },
    };
  };
  const forbidden = (name) => async () => {
    calls.push([name]);
    throw new Error(`${name} must not run during expired receipt replay`);
  };

  const result = await dispatchWhatsAppFlowDataRequest({
    payload: payload({
      flow_token: PAYMENT_FLOW_TOKEN,
      action: "data_exchange",
      screen: "WORKER_PAYMENT_DESTINATION",
      data: PAYMENT_FORM,
    }),
    endpoint: PAYMENT_ENDPOINT,
    prisma: {},
    appSecret: APP_SECRET,
    now: new Date("2026-07-28T18:31:00.000Z"),
  }, {
    authenticateSession,
    reconcilePaymentSubmission: async (_prisma, target) => {
      calls.push(["reconcile", structuredClone(target)]);
      return {
        outcome: null,
        awaitingOutcome: 0,
        provenanceMismatches: 0,
      };
    },
    replayExpiredPaymentSubmission: async (_prisma, scope, form) => {
      calls.push(["expired-replay", structuredClone(scope), structuredClone(form)]);
      return {
        ...loadedPaymentSession({ submissionStatus: "SUCCEEDED" }),
        receipt,
        replayed: true,
      };
    },
    loadPaymentSession: forbidden("load"),
    reservePaymentSubmission: forbidden("reserve"),
    submitPaymentFlow: forbidden("bridge"),
    completePaymentSubmission: forbidden("complete"),
    markPaymentSubmissionUncertain: forbidden("uncertain"),
  });

  assert.deepEqual(calls.map(([name]) => name), [
    "authenticate",
    "authenticate",
    "reconcile",
    "expired-replay",
  ]);
  assert.deepEqual(calls.slice(0, 2), [
    ["authenticate", false],
    ["authenticate", true],
  ]);
  assert.deepEqual(calls[2][1], {
    flowSessionId: PAYMENT_SESSION.id,
    organizationId: PAYMENT_SESSION.organizationId,
  });
  assert.deepEqual(calls[3][1], {
    flowSessionId: PAYMENT_SESSION.id,
    organizationId: PAYMENT_SESSION.organizationId,
    projectId: PAYMENT_SESSION.projectId,
    connectionId: PAYMENT_ENDPOINT.connectionId,
    phoneNumberId: PAYMENT_SESSION.phoneNumberId,
  });
  assert.deepEqual(calls[3][2], PAYMENT_FORM);
  assert.equal(result.session.id, PAYMENT_SESSION.id);
  assert.deepEqual(result.response, {
    screen: "SUCCESS",
    data: {
      extension_message_response: {
        params: {
          flow_token: PAYMENT_FLOW_TOKEN,
          flow_type: "worker_payment_destination",
          destination_ref: "destination-expired-replay",
          submission_status: "received",
        },
      },
    },
  });
  assert.equal(JSON.stringify(result.response).includes(PAYMENT_FORM.destination_value), false);
  assert.equal(JSON.stringify(result.response).includes("submitted_at"), false);
});

test("expired payment recovery requires data_exchange and the exact payment screen", async (t) => {
  const cases = [
    {
      name: "INIT",
      payload: payload({ flow_token: PAYMENT_FLOW_TOKEN, action: "INIT" }),
    },
    {
      name: "BACK",
      payload: payload({ flow_token: PAYMENT_FLOW_TOKEN, action: "BACK" }),
    },
    {
      name: "wrong screen",
      payload: payload({
        flow_token: PAYMENT_FLOW_TOKEN,
        action: "data_exchange",
        screen: "OTHER_SCREEN",
        data: PAYMENT_FORM,
      }),
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      let authentications = 0;
      let expiredReplays = 0;
      let bridgeCalls = 0;
      await assert.rejects(
        dispatchWhatsAppFlowDataRequest({
          payload: scenario.payload,
          endpoint: PAYMENT_ENDPOINT,
          prisma: {},
          appSecret: APP_SECRET,
          now: new Date("2026-07-28T18:31:00.000Z"),
        }, {
          authenticateSession: async () => {
            authentications += 1;
            throw new WhatsAppFlowSessionError(
              "expired",
              "WHATSAPP_FLOW_SESSION_EXPIRED",
            );
          },
          replayExpiredPaymentSubmission: async () => {
            expiredReplays += 1;
            throw new Error("expired replay must not run");
          },
          submitPaymentFlow: async () => {
            bridgeCalls += 1;
            throw new Error("bridge must not run");
          },
        }),
        assertEndpointError("WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID", 427),
      );
      assert.equal(authentications, 1);
      assert.equal(expiredReplays, 0);
      assert.equal(bridgeCalls, 0);
    });
  }
});

test("payment submission requires INIT and the exact payment screen before reserving", async () => {
  let reservations = 0;
  const common = {
    endpoint: PAYMENT_ENDPOINT,
    prisma: {},
    appSecret: APP_SECRET,
  };
  const options = {
    authenticateSession: async () => ({ session: PAYMENT_SESSION }),
    reservePaymentSubmission: async () => {
      reservations += 1;
      throw new Error("must not reserve");
    },
  };
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      ...common,
      payload: payload({
        flow_token: PAYMENT_FLOW_TOKEN,
        action: "data_exchange",
        screen: "WORKER_PAYMENT_DESTINATION",
        data: PAYMENT_FORM,
      }),
    }, {
      ...options,
      loadPaymentSession: async () => loadedPaymentSession({ privacyPresentedAt: null }),
    }),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID", 427),
  );
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      ...common,
      payload: payload({
        flow_token: PAYMENT_FLOW_TOKEN,
        action: "data_exchange",
        screen: "OTHER_SCREEN",
        data: PAYMENT_FORM,
      }),
    }, {
      ...options,
      loadPaymentSession: async () => loadedPaymentSession(),
    }),
    assertEndpointError("WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID", 400),
  );
  assert.equal(reservations, 0);
});

test("payment bridge errors are sanitized and ambiguous outcomes are durably fenced", async () => {
  const sensitive = PAYMENT_FORM.destination_value;
  const requestPayload = payload({
    flow_token: PAYMENT_FLOW_TOKEN,
    action: "data_exchange",
    screen: "WORKER_PAYMENT_DESTINATION",
    data: PAYMENT_FORM,
  });
  const commonOptions = {
    authenticateSession: async () => ({ session: PAYMENT_SESSION }),
    loadPaymentSession: async () => loadedPaymentSession(),
    reservePaymentSubmission: async () => ({
      state: "reserved",
      reservationId: PAYMENT_RESERVATION_ID,
      operationKey: "safe-operation-key",
      flowSubmission: PAYMENT_FLOW_SUBMISSION,
    }),
    reconcilePaymentSubmission: async () => ({
      outcome: null,
      awaitingOutcome: 1,
      provenanceMismatches: 0,
    }),
  };
  let uncertaintyMarks = 0;
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: requestPayload,
      endpoint: PAYMENT_ENDPOINT,
      prisma: {},
      appSecret: APP_SECRET,
    }, {
      ...commonOptions,
      submitPaymentFlow: async () => {
        throw new WorkerPaymentFlowSubmissionError(
          `invalid ${sensitive}`,
          "WORKER_PAYMENT_FLOW_INPUT_INVALID",
        );
      },
      markPaymentSubmissionUncertain: async () => {
        uncertaintyMarks += 1;
        return { state: "uncertain" };
      },
    }),
    (error) => {
      assert.equal(assertEndpointError("WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID", 400)(error), true);
      assert.equal(error.message.includes(sensitive), false);
      assert.deepEqual(error.journalSession, {
        id: PAYMENT_SESSION.id,
        kind: "worker_payment",
      });
      return true;
    },
  );
  assert.equal(uncertaintyMarks, 1);

  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: requestPayload,
      endpoint: PAYMENT_ENDPOINT,
      prisma: {},
      appSecret: APP_SECRET,
    }, {
      ...commonOptions,
      submitPaymentFlow: async () => {
        throw new Error(`ambiguous database result ${sensitive}`);
      },
      markPaymentSubmissionUncertain: async (_prisma, scope, form, uncertainty) => {
        uncertaintyMarks += 1;
        assert.equal(scope.flowSessionId, PAYMENT_SESSION.id);
        assert.deepEqual(form, PAYMENT_FORM);
        assert.equal(uncertainty.reservationId, "423e4567-e89b-42d3-a456-426614174000");
        return { state: "uncertain" };
      },
    }),
    (error) => {
      assert.equal(assertEndpointError("WHATSAPP_FLOW_ENDPOINT_SUBMISSION_CONFLICT", 409)(error), true);
      assert.equal(error.message.includes(sensitive), false);
      assert.deepEqual(error.journalSession, {
        id: PAYMENT_SESSION.id,
        kind: "worker_payment",
      });
      return true;
    },
  );
  assert.equal(uncertaintyMarks, 2);
});

test("payment completion ambiguity returns success only when the uncertainty fence proves replay", async () => {
  let uncertaintyMarks = 0;
  const result = await dispatchWhatsAppFlowDataRequest({
    payload: payload({
      flow_token: PAYMENT_FLOW_TOKEN,
      action: "data_exchange",
      screen: "WORKER_PAYMENT_DESTINATION",
      data: PAYMENT_FORM,
    }),
    endpoint: PAYMENT_ENDPOINT,
    prisma: {},
    appSecret: APP_SECRET,
  }, {
    authenticateSession: async () => ({ session: PAYMENT_SESSION }),
    loadPaymentSession: async () => loadedPaymentSession(),
    reservePaymentSubmission: async () => ({
      state: "reconcile",
      reservationId: PAYMENT_RESERVATION_ID,
      operationKey: "stable-local-reconciliation-key",
      flowSubmission: PAYMENT_FLOW_SUBMISSION,
    }),
    submitPaymentFlow: async () => ({ destinationRef: "destination-opaque-a" }),
    completePaymentSubmission: async () => {
      throw new Error("commit acknowledgement was lost");
    },
    markPaymentSubmissionUncertain: async () => {
      uncertaintyMarks += 1;
      return {
        state: "replay",
        receipt: {
          flow_type: "worker_payment_destination",
          destination_ref: "destination-opaque-a",
          submission_status: "received",
          submitted_at: "2026-07-28T17:00:00.000Z",
        },
      };
    },
  });
  assert.equal(uncertaintyMarks, 1);
  assert.deepEqual(result.response.data.extension_message_response.params, {
    flow_token: PAYMENT_FLOW_TOKEN,
    flow_type: "worker_payment_destination",
    destination_ref: "destination-opaque-a",
    submission_status: "received",
  });
});

test("payment companion validation errors retain safe endpoint status semantics", async () => {
  await assert.rejects(
    dispatchWhatsAppFlowDataRequest({
      payload: payload({
        flow_token: PAYMENT_FLOW_TOKEN,
        action: "data_exchange",
        screen: "WORKER_PAYMENT_DESTINATION",
        data: PAYMENT_FORM,
      }),
      endpoint: PAYMENT_ENDPOINT,
      prisma: {},
      appSecret: APP_SECRET,
    }, {
      authenticateSession: async () => ({ session: PAYMENT_SESSION }),
      loadPaymentSession: async () => loadedPaymentSession(),
      reservePaymentSubmission: async () => {
        throw new WorkerPaymentFlowSessionError(
          `invalid destination ${PAYMENT_FORM.destination_value}`,
          "WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID",
        );
      },
    }),
    (error) => {
      assert.equal(assertEndpointError("WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID", 400)(error), true);
      assert.equal(error.message.includes(PAYMENT_FORM.destination_value), false);
      return true;
    },
  );
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
