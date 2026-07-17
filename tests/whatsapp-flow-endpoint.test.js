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

const APP_SECRET = "meta-app-secret-for-endpoint-tests";
const FLOW_TOKEN = "ofs1.123e4567-e89b-42d3-a456-426614174000.signature";
const ENDPOINT_ID = "987e4567-e89b-42d3-a456-426614174000";
const DYNAMIC_FLOW_NAME = getWhatsAppFlowScopedName("shift-check-in", ENDPOINT_ID);
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
