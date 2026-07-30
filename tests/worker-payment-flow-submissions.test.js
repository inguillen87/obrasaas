import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WorkerPaymentFlowSubmissionError,
  submitWorkerPaymentDestinationFromWhatsAppFlow,
} from '../src/lib/whatsapp/worker-payment-flow-submissions.js';
import {
  WORKER_FINANCIAL_FIELDS,
  WORKER_FINANCIAL_PURPOSES,
  encryptWorkerFinancialPayload,
} from '../src/lib/worker-financial-data.js';

const NOW = new Date('2026-07-29T12:00:00.000Z');
const DATABASE_DECIDED_AT = new Date(NOW.getTime() + 25);
const PRESENTED_AT = new Date('2026-07-29T11:59:00.000Z');
const CUIL = '20000000001';
const LEGAL_GIVEN_NAMES = 'Persona';
const LEGAL_FAMILY_NAME = 'Verificada';
const DESTINATION_VALUE = '9999999100000000000000';
const FLOW_SESSION_ID = '323e4567-e89b-42d3-a456-426614174000';
const RESERVATION_ID = '423e4567-e89b-42d3-a456-426614174000';
const FLOW_SUBMISSION = Object.freeze({
  reservationId: RESERVATION_ID,
  fingerprintKeyId: 'payment-flow-v1',
  fingerprintHmac: 'b'.repeat(64),
});
const SCOPE = Object.freeze({
  organizationId: 'organization-a',
  projectId: 'project-a',
  workerId: 'worker-a',
  personId: 'person-a',
  channelIdentityId: 'channel-a',
});
const NOTICE = Object.freeze({
  version: 'payment-capture-v1',
  contentSha256: 'a'.repeat(64),
  presentedAt: PRESENTED_AT,
});
const FORM = Object.freeze({
  purpose: 'salary',
  destination_type: 'cbu',
  destination_value: DESTINATION_VALUE,
  holder_declaration: true,
  capture_notice_acknowledged: true,
});

function prismaFixture({ worker = {}, person = {}, channel = {} } = {}) {
  return {
    worker: {
      async findFirst() {
        return {
          id: SCOPE.workerId,
          organizationId: SCOPE.organizationId,
          projectId: SCOPE.projectId,
          personId: SCOPE.personId,
          active: true,
          ...worker,
        };
      },
    },
    workerPerson: {
      async findFirst() {
        return {
          id: SCOPE.personId,
          organizationId: SCOPE.organizationId,
          status: 'ACTIVE',
          identityStatus: 'VERIFIED',
          encryptedIdentityPayload: 'encrypted-identity',
          wrappingKeyId: 'kek-v1',
          recordVersion: 3,
          privacyNoticeVersion: 'worker-identity-v1',
          privacyAcceptedAt: new Date('2026-07-20T12:00:00.000Z'),
          ...person,
        };
      },
    },
    workerChannelIdentity: {
      async findFirst() {
        return {
          id: SCOPE.channelIdentityId,
          organizationId: SCOPE.organizationId,
          personId: SCOPE.personId,
          provider: 'WHATSAPP',
          status: 'VERIFIED',
          revokedAt: null,
          ...channel,
        };
      },
    },
  };
}

function input(overrides = {}) {
  return {
    scope: { ...SCOPE },
    form: { ...FORM },
    notice: { ...NOTICE },
    operationKey: `wpf-terminal:${FLOW_SESSION_ID}:${RESERVATION_ID}`,
    flowSubmission: { ...FLOW_SUBMISSION },
    now: NOW,
    correlationId: 'correlation-a',
    ...overrides,
  };
}

function dependencies({ order = [], decryptIdentity, recordPrivacyChoice, submit } = {}) {
  return {
    readKeyConfiguration() {
      return { kekRegistry: { marker: 'test-registry' }, fingerprintRegistry: {} };
    },
    decryptIdentity: decryptIdentity ?? ((person, configuration) => {
      order.push('decrypt');
      assert.equal(person.id, SCOPE.personId);
      assert.equal(configuration.kekRegistry.marker, 'test-registry');
      return {
        givenNames: LEGAL_GIVEN_NAMES,
        familyName: LEGAL_FAMILY_NAME,
        cuil: CUIL,
      };
    }),
    recordPrivacyChoice: recordPrivacyChoice ?? (async () => {
      order.push('privacy');
      return {
        privacyChoiceEvent: { id: 'privacy-event-a', decidedAt: NOW.toISOString() },
        replayed: false,
      };
    }),
    submitPaymentDestination: submit ?? (async () => {
      order.push('submit');
      return {
        paymentDestination: {
          id: 'destination-a',
          purpose: 'SALARY',
          type: 'CBU',
          maskedValue: 'CBU .... 0000',
          currency: 'ARS',
          status: 'PENDING_VERIFICATION',
          version: 1,
          revision: 0,
          rawValue: DESTINATION_VALUE,
          holderName: `${LEGAL_GIVEN_NAMES} ${LEGAL_FAMILY_NAME}`,
          holderCuil: CUIL,
        },
        replayed: false,
      };
    }),
  };
}

function expectCode(code) {
  return (error) => error instanceof WorkerPaymentFlowSubmissionError && error.code === code;
}

test('maps the exact Flow form, derives holder identity server-side, and returns only a masked DTO', async () => {
  const order = [];
  let privacyOptions;
  let submitOptions;
  const result = await submitWorkerPaymentDestinationFromWhatsAppFlow(
    prismaFixture(),
    input({
      form: {
        ...FORM,
        purpose: ' Salary ',
        destination_type: 'CBU',
      },
    }),
    dependencies({
      order,
      recordPrivacyChoice: async (_prisma, options) => {
        order.push('privacy');
        privacyOptions = options;
        return {
          privacyChoiceEvent: {
            id: 'privacy-event-a',
            decidedAt: DATABASE_DECIDED_AT.toISOString(),
          },
          replayed: false,
        };
      },
      submit: async (_prisma, options) => {
        order.push('submit');
        submitOptions = options;
        return {
          paymentDestination: {
            id: 'destination-a',
            purpose: 'SALARY',
            type: 'CBU',
            maskedValue: 'CBU .... 0000',
            currency: 'ARS',
            status: 'PENDING_VERIFICATION',
            version: 1,
            revision: 0,
            privacyStatus: 'ATTESTED',
            paymentUsable: false,
            value: DESTINATION_VALUE,
            holderName: `${LEGAL_GIVEN_NAMES} ${LEGAL_FAMILY_NAME}`,
            holderCuil: CUIL,
          },
          replayed: false,
        };
      },
    }),
  );

  assert.deepEqual(order, ['decrypt', 'privacy', 'submit']);
  assert.equal(privacyOptions.paymentPurpose, 'SALARY');
  assert.deepEqual(privacyOptions.submittedBy, {
    type: 'WORKER_CHANNEL',
    channelIdentityId: SCOPE.channelIdentityId,
  });
  assert.deepEqual(privacyOptions.notice, NOTICE);
  assert.deepEqual(submitOptions.privacyChoice, { eventId: 'privacy-event-a' });
  assert.deepEqual(submitOptions.now, DATABASE_DECIDED_AT);
  assert.deepEqual(submitOptions.scope, {
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    workerId: SCOPE.workerId,
  });
  assert.equal(submitOptions.input.purpose, 'SALARY');
  assert.equal(submitOptions.input.type, 'CBU');
  assert.equal(submitOptions.input.value, DESTINATION_VALUE);
  assert.equal(submitOptions.input.holderName, `${LEGAL_GIVEN_NAMES} ${LEGAL_FAMILY_NAME}`);
  assert.equal(submitOptions.input.holderCuil, CUIL);
  assert.deepEqual(Object.keys(submitOptions.input).sort(), [
    'holderCuil',
    'holderName',
    'operationKey',
    'purpose',
    'type',
    'value',
  ]);
  assert.equal(result.destinationRef, 'destination-a');
  assert.equal(result.status, 'PENDING_VERIFICATION');
  assert.equal(result.paymentDestination.maskedValue, 'CBU .... 0000');
  assert.equal(result.paymentDestination.privacyStatus, 'ATTESTED');
  assert.equal(result.paymentDestination.paymentUsable, false);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, new RegExp(DESTINATION_VALUE));
  assert.doesNotMatch(serialized, new RegExp(CUIL));
  assert.doesNotMatch(serialized, new RegExp(LEGAL_GIVEN_NAMES));
  assert.equal(Object.hasOwn(result.paymentDestination, 'value'), false);
  assert.equal(Object.hasOwn(result.paymentDestination, 'holderName'), false);
  assert.equal(Object.hasOwn(result.paymentDestination, 'holderCuil'), false);
});

test('rejects unknown identity fields and non-affirmative declarations without reflecting values', async () => {
  const forbiddenIdentityInput = input({
    form: {
      ...FORM,
      holder_cuil: CUIL,
      holder_name: `${LEGAL_GIVEN_NAMES} ${LEGAL_FAMILY_NAME}`,
    },
  });
  await assert.rejects(
    submitWorkerPaymentDestinationFromWhatsAppFlow(
      prismaFixture(),
      forbiddenIdentityInput,
      dependencies(),
    ),
    (error) => {
      assert.equal(expectCode('WORKER_PAYMENT_FLOW_UNKNOWN_FIELDS')(error), true);
      assert.doesNotMatch(error.message, new RegExp(CUIL));
      assert.doesNotMatch(error.message, new RegExp(LEGAL_GIVEN_NAMES));
      assert.doesNotMatch(error.message, /holder_cuil|holder_name/);
      return true;
    },
  );
  for (const field of ['holder_declaration', 'capture_notice_acknowledged']) {
    await assert.rejects(
      submitWorkerPaymentDestinationFromWhatsAppFlow(
        prismaFixture(),
        input({ form: { ...FORM, [field]: false } }),
        dependencies(),
      ),
      expectCode('WORKER_PAYMENT_FLOW_CONSENT_REQUIRED'),
    );
  }
});

test('canonically validates the destination before appending privacy evidence', async () => {
  const order = [];
  await assert.rejects(
    submitWorkerPaymentDestinationFromWhatsAppFlow(
      prismaFixture(),
      input({
        form: {
          ...FORM,
          destination_value: '123',
        },
      }),
      dependencies({ order }),
    ),
    expectCode('WORKER_PAYMENT_FLOW_INPUT_INVALID'),
  );
  assert.deepEqual(order, ['decrypt']);
});

test('fails closed for cross-scope worker, unverified person, and mismatched channel', async () => {
  await assert.rejects(
    submitWorkerPaymentDestinationFromWhatsAppFlow(
      prismaFixture({ worker: { organizationId: 'organization-b' } }),
      input(),
      dependencies(),
    ),
    expectCode('WORKER_PAYMENT_FLOW_SCOPE_FORBIDDEN'),
  );
  await assert.rejects(
    submitWorkerPaymentDestinationFromWhatsAppFlow(
      prismaFixture({ person: { identityStatus: 'PENDING_REVIEW' } }),
      input(),
      dependencies(),
    ),
    expectCode('WORKER_PAYMENT_FLOW_IDENTITY_UNVERIFIED'),
  );
  await assert.rejects(
    submitWorkerPaymentDestinationFromWhatsAppFlow(
      prismaFixture({ channel: { personId: 'person-b' } }),
      input(),
      dependencies(),
    ),
    expectCode('WORKER_PAYMENT_FLOW_CHANNEL_UNVERIFIED'),
  );
});

test('decrypts persisted identity only with the exact IDENTITY_CUIL authenticated binding', async () => {
  const registry = {
    currentKeyId: 'kek-v1',
    keys: new Map([['kek-v1', Buffer.alloc(32, 7)]]),
  };
  const identityRecord = {
    organizationId: SCOPE.organizationId,
    id: SCOPE.personId,
    recordVersion: 3,
  };
  const encrypted = encryptWorkerFinancialPayload({
    givenNames: LEGAL_GIVEN_NAMES,
    familyName: LEGAL_FAMILY_NAME,
    cuil: CUIL,
    privacyNoticeVersion: 'worker-identity-v1',
  }, {
    organizationId: identityRecord.organizationId,
    subjectId: identityRecord.id,
    recordId: identityRecord.id,
    recordVersion: identityRecord.recordVersion,
    purpose: WORKER_FINANCIAL_PURPOSES.IDENTITY_CUIL,
    destinationType: 'CUIL',
    field: WORKER_FINANCIAL_FIELDS.IDENTITY_CUIL,
  }, { registry });
  let submitted;
  await submitWorkerPaymentDestinationFromWhatsAppFlow(
    prismaFixture({
      person: {
        encryptedIdentityPayload: encrypted.encryptedPayload,
        wrappingKeyId: encrypted.wrappingKeyId,
      },
    }),
    input(),
    {
      readKeyConfiguration: () => ({ kekRegistry: registry, fingerprintRegistry: {} }),
      recordPrivacyChoice: async () => ({
        privacyChoiceEvent: { id: 'privacy-event-binding', decidedAt: NOW.toISOString() },
        replayed: false,
      }),
      submitPaymentDestination: async (_prisma, options) => {
        submitted = options;
        return {
          paymentDestination: {
            id: 'destination-binding',
            purpose: 'SALARY',
            type: 'CBU',
            maskedValue: 'CBU .... 0000',
            currency: 'ARS',
            status: 'PENDING_VERIFICATION',
            version: 1,
            revision: 0,
          },
          replayed: false,
        };
      },
    },
  );
  assert.equal(submitted.input.holderName, `${LEGAL_GIVEN_NAMES} ${LEGAL_FAMILY_NAME}`);
  assert.equal(submitted.input.holderCuil, CUIL);
});

test('records privacy before submit and derives stable, separate, non-financial operation keys', async () => {
  const captures = [];
  const run = async () => {
    const order = [];
    const result = await submitWorkerPaymentDestinationFromWhatsAppFlow(
      prismaFixture(),
      input(),
      dependencies({
        order,
        recordPrivacyChoice: async (_prisma, options) => {
          order.push('privacy');
          captures.push({ kind: 'privacy', key: options.operationKey });
          return {
            privacyChoiceEvent: { id: 'privacy-event-a', decidedAt: NOW.toISOString() },
            replayed: captures.length > 2,
          };
        },
        submit: async (_prisma, options) => {
          order.push('submit');
          captures.push({ kind: 'submit', key: options.input.operationKey });
          return {
            paymentDestination: {
              id: 'destination-a',
              purpose: 'SALARY',
              type: 'CBU',
              maskedValue: 'CBU .... 0000',
              currency: 'ARS',
              status: 'PENDING_VERIFICATION',
              version: 1,
              revision: 0,
            },
            replayed: captures.length > 2,
          };
        },
      }),
    );
    assert.deepEqual(order, ['decrypt', 'privacy', 'submit']);
    return result;
  };

  const first = await run();
  const replay = await run();
  assert.equal(captures[0].kind, 'privacy');
  assert.equal(captures[1].kind, 'submit');
  assert.equal(captures[0].key, captures[2].key);
  assert.equal(captures[1].key, captures[3].key);
  assert.notEqual(captures[0].key, captures[1].key);
  for (const { key } of captures) {
    assert.doesNotMatch(key, new RegExp(DESTINATION_VALUE));
    assert.doesNotMatch(key, new RegExp(CUIL));
    assert.doesNotMatch(key, new RegExp(LEGAL_GIVEN_NAMES));
    assert.doesNotMatch(key, /flow-session-operation-a/);
  }
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.privacyChoiceReplayed, true);
});

test('fails closed when the privacy ledger does not return a real decision timestamp', async () => {
  for (const decidedAt of [undefined, null, 'not-a-date']) {
    let submitCalls = 0;
    await assert.rejects(
      submitWorkerPaymentDestinationFromWhatsAppFlow(
        prismaFixture(),
        input(),
        dependencies({
          recordPrivacyChoice: async () => ({
            privacyChoiceEvent: { id: 'privacy-event-invalid-time', decidedAt },
            replayed: false,
          }),
          submit: async () => {
            submitCalls += 1;
          },
        }),
      ),
      expectCode('WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID'),
    );
    assert.equal(submitCalls, 0);
  }
});
