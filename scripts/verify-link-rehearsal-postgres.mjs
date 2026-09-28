import assert from 'node:assert/strict';
import { Client } from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readLegacyCutover } from './lib/read-legacy-cutover.mjs';
import { draftLegacyMappingPlan } from './lib/legacy-mapping-plan.mjs';
import { recordCommand, revertCommand as normalizeRevert, LINK_SCHEMA } from './lib/legacy-link-policy.mjs';
import { executeLinkRehearsal } from './lib/legacy-link-store.mjs';
import { fillMappingSelections, SHA } from '../tests/helpers/legacy-mapping-fixture.mjs';
const url = new URL(process.env.CUTOVER_TEST_DATABASE_URL || 'http://not-configured');
assert.ok(process.env.CUTOVER_TEST_DISPOSABLE === '1' && ['localhost', '127.0.0.1'].includes(url.hostname)
  && url.pathname === '/obrasaas_cutover_ci', 'Only the explicitly disposable LOCAL test database is permitted');
const TEST_TARGET = 'local-disposable:obrasaas_cutover_ci';
const revertCommand = (receipt, options) => normalizeRevert(receipt, { ...options, targetRef: TEST_TARGET });
const config = { connectionString: url.toString(), connectionTimeoutMillis: 10000, query_timeout: 20000 };
const client = new Client(config), engineSql = [], cases = [];
function factory({ failAtLink = 0, loseCommit = false, beforeCommit = false, afterLock = null } = {}) {
  let inserts = 0, fired = false;
  return () => {
    const connection = new Client(config); connection.on('error', () => {});
    return { connect: () => connection.connect(), end: () => connection.end(), async query(sql, params) {
      engineSql.push(sql);
      if (sql.includes('INSERT INTO obrasaas_link_rehearsal_v1.links') && ++inserts === failAtLink) throw new Error('Synthetic precommit failure');
      if (sql === 'COMMIT' && beforeCommit && !fired) { fired = true; throw new Error('Synthetic precommit disconnection'); }
      const result = await connection.query(sql, params);
      if (sql.includes('IN SHARE MODE') && afterLock) await afterLock();
      if (sql === 'COMMIT' && loseCommit && !fired) { fired = true; throw new Error('Synthetic lost commit acknowledgement'); }
      return result;
    } };
  };
}
const inputPlan = async () => fillMappingSelections(draftLegacyMappingPlan(await readLegacyCutover(client), { sourceSha: SHA }));
const cmd = (plan, key) => recordCommand(plan, { sourceSha: SHA, operationKey: key, targetRef: TEST_TARGET });
const sourceText = async () => (await client.query('SELECT id,state::text,messages::text FROM public.obrasaas_app_state ORDER BY id')).rows;
const ledgerCount = async () => (await client.query('SELECT count(*)::int AS n FROM obrasaas_link_rehearsal_v1.runs')).rows[0].n;
async function variation(label) {
  await client.query('UPDATE public.obrasaas_app_state SET messages=$1 WHERE id=$2', [JSON.stringify([{ text: 'SYNTHETIC ' + label }]), 'default']);
  return inputPlan();
}
function passed(name) { cases.push({ name, status: 'PASS' }); }
try {
  await client.connect();
  const original = await readLegacyCutover(client), originalText = await sourceText();
  assert.equal((await client.query('SELECT to_regnamespace($1) AS schema', [LINK_SCHEMA])).rows[0].schema, null);
  const draft = draftLegacyMappingPlan(original, { sourceSha: SHA });
  await assert.rejects(executeLinkRehearsal(factory(), cmd(draft, 'test-unreviewed-01'), draft), { code: 'REHEARSAL_REVIEW_INCOMPLETE' });
  const complete = fillMappingSelections(draft), firstCommand = cmd(complete, 'test-complete-0001');
  const crossed = structuredClone(complete);
  crossed.records.find(row => row.kind === 'worker').targetRef = crossed.targets.find(row => row.kind === 'worker' && row.ordinal === 2).targetRef;
  await assert.rejects(executeLinkRehearsal(factory(), cmd(crossed, 'test-crossed-00001'), crossed), { code: 'REHEARSAL_REVIEW_INCOMPLETE' });
  assert.equal((await client.query('SELECT to_regnamespace($1) AS schema', [LINK_SCHEMA])).rows[0].schema, null);
  passed('unreviewed-and-cross-scope-plans-create-no-ledger');
  await assert.rejects(executeLinkRehearsal(factory({ failAtLink: 3 }), firstCommand, complete), { code: 'REHEARSAL_DATABASE_UNAVAILABLE' });
  assert.equal((await client.query('SELECT to_regnamespace($1) AS schema', [LINK_SCHEMA])).rows[0].schema, null);
  passed('partial-write-and-schema-creation-rolled-back');
  const first = await executeLinkRehearsal(factory(), firstCommand, complete);
  assert.equal(first.linkCount, 4); assert.equal(first.activeReferenceCount, 4); assert.equal(first.historicalReplay, false);
  assert.equal(first.importAuthorized, false); assert.equal(first.businessDataWritten, false); assert.equal(await ledgerCount(), 1);
  const replay = await executeLinkRehearsal(factory(), firstCommand, complete);
  assert.equal(replay.historicalReplay, true); assert.equal(replay.sourceRevalidated, false);
  assert.equal(replay.recordDigest, first.recordDigest); assert.equal(await ledgerCount(), 1);
  passed('committed-receipt-replays-without-duplicate-links');
  await assert.rejects(executeLinkRehearsal(factory(), cmd(complete, 'test-other-key-0001'), complete), { code: 'REHEARSAL_PLAN_ALREADY_RECORDED' });
  await assert.rejects(executeLinkRehearsal(factory(), cmd(crossed, firstCommand.operationKey), crossed), { code: 'REHEARSAL_IDEMPOTENCY_CONFLICT' });
  passed('new-key-does-not-duplicate-and-reused-key-cannot-change-payload');
  const current = await variation('two concurrent attempts'), concurrentCommand = cmd(current, 'test-concurrent-001');
  const concurrent = await Promise.all([executeLinkRehearsal(factory(), concurrentCommand, current), executeLinkRehearsal(factory(), concurrentCommand, current)]);
  assert.equal(concurrent.filter(result => result.historicalReplay).length, 1);
  assert.equal(concurrent[0].runId, concurrent[1].runId); assert.equal(await ledgerCount(), 2);
  passed('concurrent-identical-commands-persist-once');
  const fresh = await variation('stale input'), staleCommand = cmd(fresh, 'test-stale-plan-001');
  await variation('changed after review');
  await assert.rejects(executeLinkRehearsal(factory(), staleCommand, fresh), { code: 'PLAN_OBSERVATION_CHANGED' });
  assert.equal(await ledgerCount(), 2);
  const old = await executeLinkRehearsal(factory(), firstCommand, complete);
  assert.equal(old.historicalReplay, true); assert.equal(old.sourceRevalidated, false);
  passed('stale-new-write-rejected-historical-receipt-recoverable');
  const lostPlan = await variation('response lost'), lostCommand = cmd(lostPlan, 'test-lost-commit-01');
  await assert.rejects(executeLinkRehearsal(factory({ loseCommit: true }), lostCommand, lostPlan), { code: 'REHEARSAL_COMMIT_UNCONFIRMED' });
  const recovered = await executeLinkRehearsal(factory(), lostCommand, lostPlan);
  assert.equal(recovered.historicalReplay, true); assert.equal(await ledgerCount(), 3);
  passed('lost-commit-acknowledgement-recovers-one-result');
  const notSaved = await variation('commit not reached'), notSavedCommand = cmd(notSaved, 'test-before-commit1');
  await assert.rejects(executeLinkRehearsal(factory({ beforeCommit: true }), notSavedCommand, notSaved), { code: 'REHEARSAL_COMMIT_UNCONFIRMED' });
  assert.equal(await ledgerCount(), 3);
  const retry = await executeLinkRehearsal(factory(), notSavedCommand, notSaved);
  assert.equal(retry.historicalReplay, false); assert.equal(await ledgerCount(), 4);
  passed('precommit-disconnection-retries-without-partial-record');
  const corrupted = (await client.query('SELECT * FROM obrasaas_link_rehearsal_v1.links WHERE run_id=$1 AND ordinal=4', [first.runId])).rows[0];
  await client.query('UPDATE obrasaas_link_rehearsal_v1.links SET target_ref=$1 WHERE run_id=$2 AND ordinal=4', ['target_' + 'f'.repeat(64), first.runId]);
  await assert.rejects(executeLinkRehearsal(factory(), firstCommand, complete), { code: 'REHEARSAL_RECEIPT_INTEGRITY_FAILED' });
  await client.query('UPDATE obrasaas_link_rehearsal_v1.links SET target_ref=$1 WHERE run_id=$2 AND ordinal=4', [corrupted.target_ref, first.runId]);
  passed('receipt-readback-detects-changed-reference');
  const forged = { ...first, recordDigest: 'f'.repeat(64) };
  await assert.rejects(executeLinkRehearsal(factory(), revertCommand(forged, { operationKey: 'test-bad-revert-01' })), { code: 'REHEARSAL_RECEIPT_MISMATCH' });
  const revert = revertCommand(first, { operationKey: 'test-revert-first1' });
  const reverted = await executeLinkRehearsal(factory(), revert);
  assert.equal(reverted.status, 'REHEARSAL_REVERTED'); assert.equal(reverted.activeReferenceCount, 0); assert.equal(reverted.revision, 2);
  assert.equal((await executeLinkRehearsal(factory(), revert)).historicalReplay, true);
  const rerecord = await executeLinkRehearsal(factory(), firstCommand, complete);
  assert.equal(rerecord.status, 'REHEARSAL_REVERTED'); assert.equal(rerecord.activeReferenceCount, 0);
  await assert.rejects(executeLinkRehearsal(factory(), revertCommand(first, { operationKey: 'test-revert-second' })), { code: 'REHEARSAL_ALREADY_REVERTED' });
  assert.equal((await client.query('SELECT count(*)::int AS n FROM obrasaas_link_rehearsal_v1.links WHERE run_id=$1', [first.runId])).rows[0].n, 4);
  passed('bound-reversal-idempotent-with-no-resurrection-or-history-deletion');
  const revokeLost = revertCommand(recovered, { operationKey: 'test-revert-loss-01' });
  await assert.rejects(executeLinkRehearsal(factory({ loseCommit: true }), revokeLost), { code: 'REHEARSAL_COMMIT_UNCONFIRMED' });
  const revoked = await executeLinkRehearsal(factory(), revokeLost);
  assert.equal(revoked.historicalReplay, true); assert.equal(revoked.activeReferenceCount, 0);
  passed('lost-reversal-acknowledgement-recovers');
  let publicWritePrevented = false;
  const lockedPlan = await variation('lock contention'), lockedCommand = cmd(lockedPlan, 'test-source-lock01');
  const afterLock = async () => {
    const probe = new Client(config); await probe.connect();
    try {
      await probe.query("SET lock_timeout='100ms'");
      await assert.rejects(probe.query('UPDATE public.obrasaas_app_state SET messages=messages'), { code: '55P03' });
      publicWritePrevented = true;
    } finally { await probe.end(); }
  };
  await executeLinkRehearsal(factory({ afterLock }), lockedCommand, lockedPlan);
  assert.equal(publicWritePrevented, true); passed('source-locks-prevent-concurrent-mutation');
  await client.query('UPDATE public.obrasaas_app_state SET state=$1,messages=$2 WHERE id=$3', [originalText[0].state, originalText[0].messages, 'default']);
  assert.deepEqual(await sourceText(), originalText); assert.deepEqual(await readLegacyCutover(client), original);
  assert.ok(!engineSql.some(sql => /(INSERT INTO|UPDATE|DELETE FROM) public/i.test(sql)));
  passed('engine-never-mutates-business-tables-and-fixture-restored');
  const stored = (await client.query('SELECT row_to_json(t)::text AS value FROM obrasaas_link_rehearsal_v1.links t')).rows;
  for (const value of ['PRIVATE_PHONE', 'PRIVATE_DOCUMENT', 'PRIVATE_TASK', 'old-worker', 'org-a']) assert.ok(!JSON.stringify(stored).includes(value));
  passed('persisted-links-contain-references-not-personal-content');
  const proof = { status: 'PASS', environment: 'disposable-local-postgresql17', realCustomerData: false,
    syntheticFixtureWrites: true, engineBusinessWrites: 0, referenceLedgerPersisted: true,
    rehearsalRuns: await ledgerCount(), cases, importAuthorized: false };
  mkdirSync('.vercel/link-rehearsal-evidence', { recursive: true });
  writeFileSync('.vercel/link-rehearsal-evidence/postgres.json', JSON.stringify(proof, null, 2));
  writeFileSync('.vercel/link-rehearsal-evidence/sample-receipt.json', JSON.stringify(reverted, null, 2));
  console.log(JSON.stringify(proof));
} finally { await client.end(); }
