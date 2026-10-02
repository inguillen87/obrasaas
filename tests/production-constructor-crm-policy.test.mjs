import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeCrmAccountInput } from '../src/lib/enterprise-crm-policy.mjs';
import { validateConstructorCrmCommand, normalizeConstructorCrmInput, serializeConstructorCrmAccount, CONSTRUCTOR_CRM_FIELDS } from '../src/lib/constructor-crm-policy.mjs';
import { constructorCrmMigrationArguments, constructorCrmProductionContext, constructorCrmDisposableConnection, CONSTRUCTOR_CRM_TARGET } from '../scripts/lib/constructor-crm-migration.mjs';
import { inspectConstructorCrmBuildGate } from '../scripts/lib/constructor-crm-build-gate.mjs';

const command = { action: 'CREATE', operationId: '01234567-89ab-4cde-8123-0123456789ab', scope: 'a'.repeat(64), projectId: 'project-a', payload: { name: '  Cliente de prueba  ', email: '  CONTACTO@EXAMPLE.INVALID  ', nextFollowUpOn: '2026-10-02', notes: '  Seguimiento\ncon datos controlados.  ' } };
test('canonical enterprise validation is reused, API date is mapped and SaaS metrics are absent', () => {
  const actual = normalizeConstructorCrmInput(command.payload);
  assert.deepEqual(actual, normalizeCrmAccountInput({ name: command.payload.name, email: command.payload.email, nextFollowUpAt: command.payload.nextFollowUpOn, notes: command.payload.notes }));
  assert.equal(actual.data.email, 'contacto@example.invalid'); assert.equal(actual.data.stage, 'NEW');
  assert.equal(actual.data.nextFollowUpAt.toISOString(), '2026-10-02T12:00:00.000Z');
  assert.equal(Object.hasOwn(actual.data, 'estimatedSeats'), false); assert.equal(Object.hasOwn(actual.data, 'estimatedMonthlyValue'), false);
});
test('normalized patch identity is stable before any current-row read or changed revision', () => {
  const update = { ...command, action: 'UPDATE', payload: { id: 'account-a', revision: 1, notes: '  Próximo paso  ', email: ' A@EXAMPLE.INVALID ' } };
  const normalized = validateConstructorCrmCommand(update);
  assert.deepEqual(normalized.payload, { email: 'a@example.invalid', notes: 'Próximo paso' });
  assert.equal(normalized.id, 'account-a'); assert.equal(normalized.revision, 1);
  assert.deepEqual(normalized, validateConstructorCrmCommand({ ...update, payload: { email: 'a@example.invalid', revision: 1, notes: 'Próximo paso', id: 'account-a' } }));
  assert.equal(Object.hasOwn(normalized.payload, 'stage'), false); assert.equal(Object.hasOwn(normalized.payload, 'name'), false);
});
test('organization ownership, identity, money and unknown fields cannot enter through payload or top-level input', () => {
  for (const field of ['organizationId', 'ownerOrganizationId', 'estimatedSeats', 'estimatedMonthlyValue', 'workerId', 'getSessionToken', 'id', 'revision']) assert.throws(() => validateConstructorCrmCommand({ ...command, payload: { ...command.payload, [field]: 'malicious' } }), { code: 'CONSTRUCTOR_CRM_INPUT_INVALID' });
  for (const field of ['organizationId', 'ownerOrganizationId', 'id', 'revision']) assert.throws(() => validateConstructorCrmCommand({ ...command, [field]: 'malicious' }), { code: 'CONSTRUCTOR_CRM_INPUT_INVALID' });
});
test('command enforces UUID4, exact scope and bounded monotonic revision without coercion', () => {
  for (const patch of [{ action: 'DELETE' }, { operationId: 'not-a-uuid' }, { operationId: '01234567-89ab-1cde-8123-0123456789ab' }, { scope: 'wrong' }, { projectId: '../project-a' }]) assert.throws(() => validateConstructorCrmCommand({ ...command, ...patch }), { code: 'CONSTRUCTOR_CRM_INPUT_INVALID' });
  for (const revision of [0, -1, 1.5, '1', 2147483648, null]) assert.throws(() => validateConstructorCrmCommand({ ...command, action: 'UPDATE', payload: { id: 'account-a', revision, name: 'Cliente' } }), { code: 'CONSTRUCTOR_CRM_INPUT_INVALID' });
});
test('invalid calendars, empty stage, oversized contact and private control characters fail before a write', () => {
  for (const payload of [{ nextFollowUpOn: '2026-02-29' }, { stage: null }, { stage: '' }, { stage: 'INVOICE' }, { phone: '1'.repeat(41) }, { notes: 'x'.repeat(5001) }, { name: 'a' }, { notes: 'bad\u0000value' }, { email: 'not-an-email' }]) assert.throws(() => validateConstructorCrmCommand({ ...command, payload: { ...command.payload, ...payload } }), { code: 'CONSTRUCTOR_CRM_INPUT_INVALID' });
});
test('no-change rejection and nullable clear preserve enterprise semantics without a second update engine', () => {
  const current = { name: 'Cliente', stage: 'NEW', notes: 'Pendiente', email: 'a@example.invalid' };
  assert.throws(() => normalizeConstructorCrmInput({ notes: ' Pendiente ' }, current), { code: 'CONSTRUCTOR_CRM_NO_CHANGES', status: 409 });
  const clear = normalizeConstructorCrmInput({ notes: '' }, current);
  assert.equal(clear.data.notes, null); assert.deepEqual(clear.changes.notes, { from: 'Pendiente', to: null });
});
test('DTO exposes only contact fields and integer revision, with no tenant relation or SaaS metrics', () => {
  const row = { id: 'account-a', revision: 2, name: 'Cliente', stage: 'CONTACTED', organizationId: 'legacy-platform', ownerOrganizationId: 'org-private', estimatedMonthlyValue: 500, estimatedSeats: 8, nextFollowUpAt: new Date('2026-10-02T12:00:00Z'), internalPrivateField: 'private' };
  const dto = serializeConstructorCrmAccount(row);
  assert.deepEqual(Object.keys(dto), ['id', 'revision', ...CONSTRUCTOR_CRM_FIELDS]); assert.equal(dto.nextFollowUpOn, '2026-10-02');
  assert.doesNotMatch(JSON.stringify(dto), /legacy-platform|org-private|estimated|internalPrivate/);
  assert.throws(() => serializeConstructorCrmAccount({ ...row, revision: '2' }), { code: 'CONSTRUCTOR_CRM_RECORD_UNCONFIRMED' });
  assert.throws(() => serializeConstructorCrmAccount({ ...row, phone: { unexpected: true } }), { code: 'CONSTRUCTOR_CRM_RECORD_UNCONFIRMED' });
});
test('migration requires explicit target flags and apply fingerprint; duplicate or ambiguous flags are rejected', () => {
  const base = ['--expected-project', CONSTRUCTOR_CRM_TARGET.projectId, '--expected-team', CONSTRUCTOR_CRM_TARGET.teamId];
  assert.equal(constructorCrmMigrationArguments(base).mode, 'DRY_RUN');
  assert.equal(constructorCrmMigrationArguments(['--apply', ...base, '--expected-fingerprint', 'a'.repeat(64)]).mode, 'APPLY');
  for (const extra of [['--apply'], ['--apply', '--dry-run'], ['--dry-run', '--dry-run'], ['--unknown'], ['--expected-fingerprint', 'invalid']]) assert.throws(() => constructorCrmMigrationArguments([...base, ...extra]), { code: 'CONSTRUCTOR_CRM_MIGRATION_ARGUMENTS_INVALID' });
});
test('production migration target comes from pinned project/team and production context, never an arbitrary URL', () => {
  const env = { VERCEL_ENV: 'production', VERCEL_PROJECT_ID: CONSTRUCTOR_CRM_TARGET.projectId, NEXT_PUBLIC_APP_URL: CONSTRUCTOR_CRM_TARGET.origin }, project = { projectId: CONSTRUCTOR_CRM_TARGET.projectId, orgId: CONSTRUCTOR_CRM_TARGET.teamId };
  assert.equal(constructorCrmProductionContext(env, project, project.projectId, project.orgId).projectVerified, true);
  for (const altered of [{ VERCEL_ENV: 'preview' }, { VERCEL_PROJECT_ID: 'another-project' }, { NEXT_PUBLIC_APP_URL: 'https://example.invalid' }, { VERCEL_ORG_ID: 'other-team' }]) assert.throws(() => constructorCrmProductionContext({ ...env, ...altered }, project, project.projectId, project.orgId), { code: 'CONSTRUCTOR_CRM_MIGRATION_TARGET_REJECTED' });
  assert.throws(() => constructorCrmProductionContext(env, { ...project, orgId: 'other-team' }, project.projectId, project.orgId), { code: 'CONSTRUCTOR_CRM_MIGRATION_TARGET_REJECTED' });
});
test('production build cannot bypass schema gate with CI and sanitizes failed connection diagnostics', async () => {
  const environment = { VERCEL_ENV: 'production', VERCEL_PROJECT_ID: CONSTRUCTOR_CRM_TARGET.projectId, NEXT_PUBLIC_APP_URL: CONSTRUCTOR_CRM_TARGET.origin, CI: 'true', DATABASE_URL: 'postgresql://synthetic:private-value@ep-control.example.neon.tech/neondb?sslmode=require' };
  let called = 0;
  const result = await inspectConstructorCrmBuildGate({ environment, makeClient: () => { called++; throw new Error(environment.DATABASE_URL); } });
  assert.equal(called, 1); assert.equal(result.required, true); assert.equal(result.passed, false); assert.equal(result.status, 'UNCONFIRMED');
  assert.doesNotMatch(JSON.stringify(result), /synthetic|private-value|neon.tech|postgresql/);
  const skipped = await inspectConstructorCrmBuildGate({ environment: { ...environment, VERCEL_ENV: 'preview' }, makeClient: () => { throw Error('must not connect'); } });
  assert.equal(skipped.required, false); assert.equal(skipped.passed, false); assert.equal(skipped.status, 'SKIPPED_NON_PRODUCTION');
});
test('migration CLI rejects an unapproved target before opening a database and emits no raw credentials', () => {
  const script = new URL('../scripts/adopt-constructor-crm-schema.mjs', import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(script), '--apply', '--expected-project', 'another-project', '--expected-team', 'another-team', '--expected-fingerprint', 'a'.repeat(64)], { encoding: 'utf8', env: { ...process.env, VERCEL_ENV: 'preview', DATABASE_URL: 'postgresql://private:never-print@private.example/secret' } });
  assert.equal(result.status, 1); assert.doesNotMatch(result.stdout + result.stderr, /never-print|private.example|postgresql:/);
  assert.match(result.stderr, /CONSTRUCTOR_CRM_MIGRATION_TARGET_REJECTED/);
});
test('disposable fixture rejects production, nonlocal hosts and missing explicit disposability before any connection', () => {
  const env = { CUTOVER_TEST_DATABASE_URL: 'postgresql://synthetic@127.0.0.1:6549/obrasaas_cutover_ci', CUTOVER_TEST_DISPOSABLE: '1' };
  assert.equal(constructorCrmDisposableConnection(env).hostname, '127.0.0.1');
  for (const patch of [{ CUTOVER_TEST_DISPOSABLE: '0' }, { VERCEL_ENV: 'production' }, { VERCEL: '1' }, { CUTOVER_TEST_DATABASE_URL: 'postgresql://synthetic@ep-real.neon.tech/neondb' }, { CUTOVER_TEST_DATABASE_URL: 'postgresql://synthetic@localhost/another_database' }, { CUTOVER_TEST_DATABASE_URL: 'postgresql://synthetic@localhost/obrasaas_cutover_ci?sslmode=require' }]) assert.throws(() => constructorCrmDisposableConnection({ ...env, ...patch }), { code: 'CONSTRUCTOR_CRM_DISPOSABLE_TARGET_REJECTED' });
});
