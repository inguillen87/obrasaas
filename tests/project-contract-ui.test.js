import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [page, client, state, css, loading, shell, shellModel] = await Promise.all([
  readFile(new URL('src/app/dashboard/contracts/page.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/contracts/contracts-client.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/contracts/project-contract-state.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/contracts/contracts.module.css', root), 'utf8'),
  readFile(new URL('src/app/dashboard/contracts/loading.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/dashboard-shell.js', root), 'utf8'),
  readFile(new URL('src/lib/dashboard-shell.js', root), 'utf8'),
]);

test('the private server route renders one fresh tenant/project snapshot without an internal API round-trip', () => {
  assert.match(page, /export const dynamic = 'force-dynamic'/);
  assert.match(page, /requireTenantPermission\(access, 'org:contracts:read'/);
  assert.match(page, /hasTenantPermission\(access, 'tenant:members:read'\)/);
  assert.match(page, /canReadMembers \? prisma\.tenantMembership\.findMany/);
  assert.match(page, /: Promise\.resolve\(\[\]\)/);
  assert.match(page, /if \(!access\.tenantMembershipId\)/);
  assert.match(page, /readProjectContractSnapshot\(prisma, \{/);
  assert.match(page, /organizationId: access\.organization\.id/);
  assert.match(page, /projectId: access\.project\.id/);
  assert.match(page, /actorMembershipId: access\.tenantMembershipId/);
  assert.doesNotMatch(page, /fetch\(['"]\/api\/project-contract/);
  assert.doesNotMatch(page, /prisma\.task\./);
  assert.doesNotMatch(page, /JSON\.parse\(JSON\.stringify/);
});

test('the SOV draft covers every canonical task with explicit VALUED or NO_CLAIM semantics', () => {
  assert.match(client, /canonicalTasks\.map/);
  assert.match(client, /tasks\.map\(\(task, index\) =>/);
  assert.match(client, /NO_CLAIM exige fundamento y nunca equivale a monto cero/);
  assert.match(client, /El total lo deriva el servidor; el cliente nunca lo envía/);
  assert.match(state, /lineByTask\.size !== taskRows\.length/);
  assert.match(state, /Al menos una tarea debe quedar valuada/);
  assert.doesNotMatch(client, /totalContractAmountMinor:/);
});

test('minor units remain canonical strings and never pass through floating point APIs', () => {
  assert.match(state, /BigInt\(`/);
  assert.match(state, /contractAmountMinor,/);
  assert.match(state, /currencyMinorUnits: 2/);
  assert.match(client, /inputMode="numeric"/);
  assert.match(client, /formatMinorUnits\(/);
  assert.doesNotMatch(client, /parseFloat|parseInt|Number\(/);
  assert.doesNotMatch(state, /parseFloat|Number\(.*contractAmount|Number\(.*totalContract/);
});

test('ambiguous and malformed-success POSTs retain one key, block repost, and reconcile only by GET', () => {
  assert.match(client, /'Idempotency-Key': operationKey/);
  assert.match(client, /error\.malformedSuccess = true/);
  assert.match(client, /uncertainProjectContractAttempt\(nextAttempt\)/);
  assert.match(client, /knownResourceIds: history\.map\(\(record\) => record\.id\)/);
  assert.match(client, /if \(attemptRef\.current \|\| mutationBusy\) return/);
  assert.match(client, /No hay[\s\S]*reintento automático ni botón de reenvío/);
  assert.match(client, /Conciliar por GET autoritativo/);
  assert.match(client, /api\('\/api\/project-contract', \{ signal: controller\.signal \}\)/);
  assert.match(client, /getSequenceRef\.current !== sequence/);
  assert.match(client, /getControllerRef\.current\?\.abort\(\)/);
  assert.match(client, /mountedRef\.current = false/);
  const uncertainSection = client.slice(
    client.indexOf('attempt && !mutationBusy'),
    client.indexOf('<section className={styles.statusGrid}'),
  );
  assert.doesNotMatch(uncertainSection, /performMutation|method: 'POST'/);
});

test('maker-checker controls follow server capabilities and preserve append-only history', () => {
  assert.match(client, /capabilities\.proposeAuthority\?\.allowed === true/);
  assert.match(client, /capabilities\.decideAuthority\?\.allowed === true/);
  assert.match(client, /capabilities\.prepareContract\?\.allowed === true/);
  assert.match(client, /capabilities\.decideContract\?\.allowed === true/);
  assert.match(client, /capabilities\.decideAuthority\.targetId === snapshot\.pendingAuthority\?\.id/);
  assert.match(client, /capabilities\.decideContract\.targetId === snapshot\.pendingContract\?\.id/);
  assert.match(client, /snapshot\?\.authorityHistory/);
  assert.match(client, /snapshot\?\.contractHistory/);
  assert.match(client, /Historial de autoridades/);
  assert.match(client, /Historial de contratos/);
  assert.match(client, /Decidió/);
  assert.match(client, /showLines=\{false\}/);
});

test('the route is accessible, deterministic across hydration, mobile, and excludes payment state', () => {
  assert.match(client, /aria-live="polite"/);
  assert.match(client, /<caption>/);
  assert.match(client, /scope="col"/);
  assert.match(client, /scope="row"/);
  assert.match(client, /exactTimestamp/);
  assert.match(client, /UTC/);
  assert.doesNotMatch(client, /new Date\(|toLocale|Intl\.DateTimeFormat|Date\.now|Math\.random/);
  assert.doesNotMatch(client, /\bPAID\b|method: '(PUT|PATCH|DELETE)'/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /\.tableScroller \{[\s\S]*overflow-x: auto/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch([page, client, state, loading].join('\n'), /\u00c3|\u00c2|\u00e2\u20ac/);
});

test('dashboard navigation exposes the contract surface only with its dedicated read permission', () => {
  assert.match(shell, /href: '\/dashboard\/contracts'/);
  assert.match(shell, /permission: 'canReadContracts'/);
  assert.match(shellModel, /canReadContracts: hasTenantPermission\(access, 'org:contracts:read'\)/);
});
