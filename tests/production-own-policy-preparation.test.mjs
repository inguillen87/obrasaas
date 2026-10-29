import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {readOwnCompanyPolicy} from '../src/lib/meta-own-company-policy.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = 'a'.repeat(40);
const defaults = {
  'source-head': source, 'organization-id': 'company_demo',
  'actor-id': 'admin_demo', 'clerk-user-id': 'user_Demo',
  'clerk-organization-id': 'org_Demo', 'project-id': 'project_demo',
  'business-id': '12345678901', 'waba-id': '22345678901',
  'phone-number-id': '32345678901', phone: '+54 9 221 555 0100',
  'phone-revision': '1',
};
function run(changes = {}, extra = []) {
  const input = {...defaults, ...changes};
  const args = Object.entries(input).flatMap(([key, value]) => value === null ? [] : ['--' + key, value]);
  return spawnSync(process.execPath, ['scripts/prepare-own-company-policy.mjs', ...args, ...extra], {
    cwd: root, encoding: 'utf8', timeout: 15000,
    env: {PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP},
  });
}
test('policy preparation prints values accepted by production now and an independently calculated digest', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.split(/\r?\n/).filter(line => line.startsWith('OBRASAAS_'));
  assert.equal(lines.length, 3);
  const environment = Object.fromEntries(lines.map(line => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1)];
  }));
  const raw = environment.OBRASAAS_META_OWN_COMPANY_POLICY;
  assert.equal(environment.OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256, createHash('sha256').update(raw).digest('hex'));
  const policy = readOwnCompanyPolicy({
    ...environment, VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: source,
    NEXT_PUBLIC_META_APP_ID: OBRASAAS_META_CHANNEL.appId,
  });
  assert.ok(policy);
  assert.equal(policy.expectedPhoneE164, '+5492215550100');
  assert.equal(policy.organizationId, defaults['organization-id']);
});
const invalid = [
  ['missing field', {'actor-id': null}],
  ['short source revision', {'source-head': 'abc'}],
  ['invalid internal identifier', {'organization-id': 'company one'}],
  ['invalid Clerk identifier', {'clerk-user-id': 'admin_demo'}],
  ['invalid phone', {phone: 'invalid'}],
  ['zero phone revision', {'phone-revision': '0'}],
  ['oversized window', {hours: '5'}],
  ['submillisecond window', {hours: '0.00000001'}],
  ['future authorization', {'issued-at': new Date(Date.now() + 3600000).toISOString()}],
  ['expired authorization', {'issued-at': new Date(Date.now() - 8 * 3600000).toISOString()}],
  ['ambiguous local date', {'issued-at': '2026-10-28'}],
  ['test number substituted', {'phone-number-id': OBRASAAS_META_CHANNEL.phoneNumberId}],
];
for (const [name, changes] of invalid) {
  test('policy preparation rejects ' + name + ' without printing configuration', () => {
    const result = run(changes);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /ERROR:/);
    assert.doesNotMatch(result.stdout, /OBRASAAS_META_OWN_COMPANY_(?:POLICY|RELEASE)=/);
  });
}
test('help is available without any private identifiers', () => {
  const result = spawnSync(process.execPath, ['scripts/prepare-own-company-policy.mjs', '--help'], {
    cwd: root, encoding: 'utf8', timeout: 15000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--source-head/);
  assert.match(result.stdout, /--issued-at/);
  assert.doesNotMatch(result.stdout, /OBRASAAS_META_OWN_COMPANY_POLICY=/);
});
