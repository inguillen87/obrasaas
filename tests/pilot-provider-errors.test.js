import assert from 'node:assert/strict';
import test from 'node:test';
import { PILOT_SLUGS_DISABLED, isPilotSlugConfigurationError, pilotWorkspaceRecoveryState, pilotWorkspaceErrorMessage } from '../src/lib/whatsapp/pilot-provider-errors.js';
const rejected = { status: 403, errors: [{ code: 'organization_slugs_disabled', message: 'do-not-expose-provider-details' }] };
test('observed Clerk slug rejection maps to a bounded configuration diagnosis', () => {
  assert.equal(isPilotSlugConfigurationError(rejected), true);
  assert.equal(pilotWorkspaceRecoveryState({ status: 409, code: PILOT_SLUGS_DISABLED }), 'configuration');
  assert.match(pilotWorkspaceErrorMessage(PILOT_SLUGS_DISABLED), /Enable organization slugs/);
  assert.ok(!pilotWorkspaceErrorMessage(PILOT_SLUGS_DISABLED).includes('do-not-expose-provider-details'));
});
for (const error of [null, {}, new Error('organization_slugs_disabled'), { ...rejected, status: 500 }, { status: 403, errors: null }, { status: 403, errors: [{ code: 'other' }] }]) {
  test('uncertain or unrelated provider failure is not diagnosed as configuration: ' + JSON.stringify(error), () => assert.equal(isPilotSlugConfigurationError(error), false));
}
test('SDK statusCode form is recognized only with the exact bounded code', () => assert.equal(isPilotSlugConfigurationError({ statusCode: 403, errors: rejected.errors }), true));
test('network and malformed successes retain uncertain recovery', () => {
  assert.equal(pilotWorkspaceRecoveryState(new Error('network')), 'uncertain');
  assert.equal(pilotWorkspaceRecoveryState({ status: 503 }), 'uncertain');
  assert.equal(pilotWorkspaceRecoveryState({ status: 200 }), 'uncertain');
});
test('ordinary permission and context failures remain blocked', () => {
  for (const status of [401,403,404,409]) assert.equal(pilotWorkspaceRecoveryState({ status, code: 'EVIDENCE_CONTEXT_CHANGED' }), 'blocked');
  assert.equal(pilotWorkspaceRecoveryState({ status: 403, code: PILOT_SLUGS_DISABLED }), 'blocked');
});
test('invalid user input remains correctable without changing other failure states', () => assert.equal(pilotWorkspaceRecoveryState({ status: 400 }), 'idle'));
test('unknown diagnostic code cannot introduce arbitrary text into safe messages', () => assert.ok(!pilotWorkspaceErrorMessage('secret-provider-details').includes('secret-provider-details')));
