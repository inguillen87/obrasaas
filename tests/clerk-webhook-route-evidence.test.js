import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      '@clerk/nextjs/server': 'mock:clerk-server',
      '@clerk/nextjs/webhooks': 'mock:clerk-webhooks',
      '@/lib/clerk-membership-state': 'mock:clerk-membership-state',
      '@/lib/clerk-membership-sync': 'mock:clerk-membership-sync',
      '@/lib/clerk-organization-sync': 'mock:clerk-organization-sync',
      '@/lib/clerk-user-sync': 'mock:clerk-user-sync',
      '@/lib/internal-organization': 'mock:internal-organization',
      '@/lib/invitations': 'mock:invitations',
      '@/lib/prisma': 'mock:prisma',
    };
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
    if (specifier.startsWith('@/')) {
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}.js`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:clerk-server') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function clerkClient() {
            globalThis.__clerkWebhookRouteState.effects.push('clerkClient');
            return {};
          }
        `,
      };
    }
    if (url === 'mock:clerk-webhooks') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function verifyWebhook(request) {
            const state = globalThis.__clerkWebhookRouteState;
            state.effects.push('verify');
            state.verificationRequestIsOriginal = request === state.originalRequest;
            state.verifiedRawBody = await request.text();
            if (state.verificationFailure) throw new Error('invalid signature');
            const payload = JSON.parse(state.verifiedRawBody);
            return { type: payload.type, data: payload.data };
          }
        `,
      };
    }
    if (url === 'mock:prisma') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export function getPrisma() {
            globalThis.__clerkWebhookRouteState.effects.push('prisma');
            return globalThis.__clerkWebhookRouteState.database;
          }
        `,
      };
    }
    if (url === 'mock:clerk-user-sync') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function preserveDeletedClerkUser(_prisma, userId) {
            globalThis.__clerkWebhookRouteState.effects.push('preserve:' + userId);
          }
          export async function syncPlatformUserFromClerk() {
            throw new Error('Unexpected user synchronization.');
          }
        `,
      };
    }
    if (url === 'mock:clerk-membership-sync') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function disableDeletedClerkTenantMembership() {}
          export async function persistClerkTenantMembership() {}
        `,
      };
    }
    if (url === 'mock:clerk-organization-sync') {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export async function syncClerkOrganization() {}',
      };
    }
    if (url === 'mock:invitations') {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export function acceptedInvitationRole() { return null; }',
      };
    }
    if (url === 'mock:clerk-membership-state') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export class ClerkMembershipStatePendingError extends Error {}
          export async function getCurrentClerkOrganizationMembership() { return null; }
          export function resolveClerkMembershipEventState() { return { active: false }; }
          export function resolveClerkTenantRole() { return 'AUDITOR'; }
        `,
      };
    }
    if (url === 'mock:internal-organization') {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export function internalOrganizationMembershipAllowed() { return true; }',
      };
    }
    return nextLoad(url, context);
  },
});

const {
  CLERK_WEBHOOK_MAX_BODY_BYTES,
} = await import('../src/lib/clerk-webhook-claim.js');
const { POST } = await import('../src/app/api/webhooks/clerk/route.js');

const SIGNING_SECRET = `whsec_${'b'.repeat(48)}`;
const EVIDENCE_SECRET = `evidence_${'e'.repeat(48)}`;
const EVIDENCE_KEY_ID = 'clerk-webhook-evidence-v1';
const EVIDENCE_DOMAIN = 'obrasaas:clerk-webhook:verified-body:v1';

function databaseDouble() {
  let record = null;
  return {
    get record() {
      return record;
    },
    webhookEvent: {
      async createMany({ data }) {
        if (record) return { count: 0 };
        record = { id: 'event-db', ...data[0] };
        return { count: 1 };
      },
      async updateMany({ where, data }) {
        if (!record || record.provider !== where.provider || record.externalId !== where.externalId) {
          return { count: 0 };
        }
        let matches = true;
        if (where.status && typeof where.status === 'string') matches = record.status === where.status;
        if (where.leaseToken) matches = matches && record.leaseToken === where.leaseToken;
        if (where.OR) {
          matches = where.OR.some((condition) => {
            if (condition.status === 'PENDING' || condition.status === 'FAILED') {
              return record.status === condition.status;
            }
            return record.status === 'PROCESSING'
              && record.leaseExpiresAt <= condition.leaseExpiresAt.lte;
          });
        }
        if (!matches) return { count: 0 };
        const next = { ...data };
        if (data.attempts?.increment) next.attempts = record.attempts + data.attempts.increment;
        record = { ...record, ...next };
        return { count: 1 };
      },
      async findUnique() {
        return record ? { ...record } : null;
      },
    },
  };
}

function webhookRequest(rawBody) {
  return new Request('https://obrasaas-preview.vercel.app/api/webhooks/clerk', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': 'msg_clerk_a',
      'svix-signature': 'v1,test-signature',
      'svix-timestamp': '1785240000',
    },
    body: rawBody,
    ...(rawBody instanceof ReadableStream ? { duplex: 'half' } : {}),
  });
}

async function withRouteState(overrides, run) {
  const previousSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  const previousExpectedInstanceId = process.env.CLERK_EXPECTED_INSTANCE_ID;
  const previousEvidenceSecret = process.env.CLERK_WEBHOOK_EVIDENCE_SECRET;
  const previousEvidenceKeyId = process.env.CLERK_WEBHOOK_EVIDENCE_KEY_ID;
  const database = databaseDouble();
  const {
    expectedInstanceId = 'ins_Development123',
    evidenceSecret = EVIDENCE_SECRET,
    evidenceKeyId = EVIDENCE_KEY_ID,
    ...stateOverrides
  } = overrides;
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = SIGNING_SECRET;
  if (expectedInstanceId === null) delete process.env.CLERK_EXPECTED_INSTANCE_ID;
  else process.env.CLERK_EXPECTED_INSTANCE_ID = expectedInstanceId;
  if (evidenceSecret === null) delete process.env.CLERK_WEBHOOK_EVIDENCE_SECRET;
  else process.env.CLERK_WEBHOOK_EVIDENCE_SECRET = evidenceSecret;
  if (evidenceKeyId === null) delete process.env.CLERK_WEBHOOK_EVIDENCE_KEY_ID;
  else process.env.CLERK_WEBHOOK_EVIDENCE_KEY_ID = evidenceKeyId;
  globalThis.__clerkWebhookRouteState = {
    database,
    effects: [],
    verificationFailure: false,
    verifiedRawBody: null,
    ...stateOverrides,
  };
  try {
    return await run(globalThis.__clerkWebhookRouteState);
  } finally {
    if (previousSecret === undefined) delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    else process.env.CLERK_WEBHOOK_SIGNING_SECRET = previousSecret;
    if (previousExpectedInstanceId === undefined) delete process.env.CLERK_EXPECTED_INSTANCE_ID;
    else process.env.CLERK_EXPECTED_INSTANCE_ID = previousExpectedInstanceId;
    if (previousEvidenceSecret === undefined) delete process.env.CLERK_WEBHOOK_EVIDENCE_SECRET;
    else process.env.CLERK_WEBHOOK_EVIDENCE_SECRET = previousEvidenceSecret;
    if (previousEvidenceKeyId === undefined) delete process.env.CLERK_WEBHOOK_EVIDENCE_KEY_ID;
    else process.env.CLERK_WEBHOOK_EVIDENCE_KEY_ID = previousEvidenceKeyId;
    delete globalThis.__clerkWebhookRouteState;
  }
}

test('Clerk route verifies a rebuilt bounded request and redacts only after completion', () => (
  withRouteState({}, async (state) => {
    const rawBody = '{\r\n  "instance_id":"ins_Development123",\r\n  "type":"user.deleted",\r\n  "data":{"id":"user_a","email":"persona@example.com"}\r\n}\r\n';
    const rawBytes = new TextEncoder().encode(rawBody);
    const request = webhookRequest(rawBody);
    state.originalRequest = request;
    Object.defineProperty(request, 'clone', {
      value() {
        throw new Error('The Clerk route must not clone its request stream.');
      },
    });
    const response = await POST(request);

    assert.equal(response.status, 200);
    assert.equal(state.verificationRequestIsOriginal, false);
    assert.equal(state.verifiedRawBody, rawBody);
    assert.deepEqual(state.effects, [
      'verify',
      'prisma',
      'prisma',
      'clerkClient',
      'preserve:user_a',
    ]);
    assert.equal(state.database.record.status, 'PROCESSED');
    assert.deepEqual(state.database.record.payload, {
      version: 1,
      redacted: true,
      bodyEvidence: {
        version: 1,
        algorithm: 'hmac-sha256',
        domain: EVIDENCE_DOMAIN,
        keyId: EVIDENCE_KEY_ID,
        instanceId: 'ins_Development123',
        digest: createHmac('sha256', EVIDENCE_SECRET)
          .update(`${EVIDENCE_DOMAIN}\0`, 'utf8')
          .update(`${EVIDENCE_KEY_ID}\0ins_Development123\0msg_clerk_a\0user.deleted\0`, 'utf8')
          .update(rawBytes)
          .digest('hex'),
      },
    });
    assert.equal(JSON.stringify(state.database.record.payload).includes('persona@example.com'), false);

    const completedPayload = structuredClone(state.database.record.payload);
    const replayResponse = await POST(webhookRequest(rawBody));
    assert.equal(replayResponse.status, 200);
    assert.equal(state.database.record.attempts, 1);
    assert.deepEqual(state.database.record.payload, completedPayload);
    assert.deepEqual(state.effects.slice(-2), ['verify', 'prisma']);
  })
));

test('invalid signatures never produce evidence or durable webhook state', () => (
  withRouteState({ verificationFailure: true }, async (state) => {
    const response = await POST(webhookRequest(
      '{"instance_id":"ins_Development123","type":"user.deleted","data":{"id":"user_a"}}',
    ));

    assert.equal(response.status, 400);
    assert.deepEqual(state.effects, ['verify']);
    assert.equal(state.database.record, null);
  })
));

test('missing or mismatched Clerk instance configuration fails closed before Neon', async () => {
  const cases = [
    { expectedInstanceId: null, status: 503 },
    { expectedInstanceId: 'ins_Production123', status: 403 },
  ];
  for (const scenario of cases) {
    await withRouteState(scenario, async (state) => {
      const response = await POST(webhookRequest(
        '{"instance_id":"ins_Development123","type":"user.deleted","data":{"id":"user_a"}}',
      ));

      assert.equal(response.status, scenario.status);
      assert.deepEqual(state.effects, ['verify']);
      assert.equal(state.database.record, null);
    });
  }
});

test('missing, invalid or reused Clerk evidence keys fail closed before Neon', async () => {
  const cases = [
    { evidenceSecret: null },
    { evidenceSecret: 'too-short' },
    { evidenceSecret: SIGNING_SECRET },
    { evidenceKeyId: null },
    { evidenceKeyId: 'unversioned-key' },
  ];
  for (const scenario of cases) {
    await withRouteState(scenario, async (state) => {
      const response = await POST(webhookRequest(
        '{"instance_id":"ins_Development123","type":"user.deleted","data":{"id":"user_a"}}',
      ));

      assert.equal(response.status, 503);
      assert.deepEqual(state.effects, ['verify']);
      assert.equal(state.database.record, null);
    });
  }
});

test('oversized Clerk bodies are rejected before signature work or persistence', () => (
  withRouteState({}, async (state) => {
    const chunk = new TextEncoder().encode('a'.repeat(64 * 1024));
    let emitted = 0;
    const body = new ReadableStream({
      pull(controller) {
        if (emitted > CLERK_WEBHOOK_MAX_BODY_BYTES) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
        emitted += chunk.byteLength;
      },
    });
    const request = webhookRequest(body);
    assert.equal(request.headers.get('content-length'), null);
    const response = await POST(request);

    assert.equal(response.status, 413);
    assert.deepEqual(state.effects, []);
    assert.equal(state.database.record, null);
  })
));
