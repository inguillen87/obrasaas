import { readFileSync } from 'node:fs';
import { readLegacyCutover } from './read-legacy-cutover.mjs';
import { checkLegacyMappingPlan } from './legacy-mapping-plan.mjs';
import { LINK_REHEARSAL_POLICY, LINK_SCHEMA, linkDigest, linkFlags, failLink, classifyLinkError, recordCommand, revertCommand } from './legacy-link-policy.mjs';

const schemaSql = readFileSync(new URL('./legacy-link-schema.sql', import.meta.url), 'utf8');
const SOURCE_LOCK = `LOCK TABLE public.obrasaas_app_state, public."Organization", public."Project",
  public."Worker", public."Task", public."ProjectSnapshot", public._prisma_migrations IN SHARE MODE`;
const runReceipt = (run, links) => ({ policyVersion: LINK_REHEARSAL_POLICY, runId: run.run_id,
  targetRef: run.target_ref, sourceSha: run.source_sha, planFingerprint: run.plan_fingerprint,
  linksDigest: linkDigest(links), linkCount: links.length, ...linkFlags });

async function ledgerExists(client) {
  const found = (await client.query('SELECT to_regnamespace($1) IS NOT NULL AS present', [LINK_SCHEMA])).rows[0]?.present;
  if (!found) return false;
  const rows = (await client.query('SELECT singleton,version FROM obrasaas_link_rehearsal_v1.header')).rows;
  if (rows.length !== 1 || rows[0].singleton !== true || rows[0].version !== LINK_REHEARSAL_POLICY)
    failLink('REHEARSAL_LEDGER_CONTRACT_INVALID');
  return true;
}
async function readRun(client, runId) {
  const run = (await client.query('SELECT * FROM obrasaas_link_rehearsal_v1.runs WHERE run_id=$1', [runId])).rows[0];
  if (!run) failLink('REHEARSAL_RUN_NOT_FOUND');
  const links = (await client.query(`SELECT ordinal,source_ref AS "sourceRef",target_ref AS "targetRef",
    parent_source_ref AS "parentSourceRef",kind,operation_key AS "operationKey"
    FROM obrasaas_link_rehearsal_v1.links WHERE run_id=$1 ORDER BY ordinal LIMIT 5001`, [runId])).rows;
  if (!links.length || links.length !== run.link_count || links.some((row, index) => row.ordinal !== index + 1) ||
      linkDigest(links) !== run.links_digest || linkDigest(runReceipt(run, links)) !== run.record_digest ||
      !['RECORDED','REVERTED'].includes(run.state) || run.revision !== (run.state === 'RECORDED' ? 1 : 2))
    failLink('REHEARSAL_RECEIPT_INTEGRITY_FAILED');
  const events = (await client.query('SELECT operation,receipt,receipt_digest FROM obrasaas_link_rehearsal_v1.events WHERE run_id=$1 ORDER BY operation', [runId])).rows;
  if (events.length !== run.revision || events.some(event => event.receipt_digest !== linkDigest(event.receipt) ||
      event.receipt.runId !== runId || event.receipt.recordDigest !== run.record_digest || event.receipt.operation !== event.operation))
    failLink('REHEARSAL_RECEIPT_INTEGRITY_FAILED');
  return { run, links };
}
function resultFor(run, event, replayed, sourceRevalidated) {
  return { policyVersion: LINK_REHEARSAL_POLICY, status: run.state === 'RECORDED' ? 'REHEARSAL_RECORDED' : 'REHEARSAL_REVERTED',
    runId: run.run_id, targetRef: run.target_ref, recordDigest: run.record_digest, planFingerprint: run.plan_fingerprint,
    linkCount: run.link_count, activeReferenceCount: run.state === 'RECORDED' ? run.link_count : 0,
    revision: run.revision, operation: event.operation, operationReceiptDigest: event.receipt_digest,
    historicalReplay: replayed, sourceRevalidated, ...linkFlags };
}
async function writeEvent(client, command, run) {
  const receipt = { policyVersion: LINK_REHEARSAL_POLICY, runId: run.run_id,
    operation: command.operation, recordDigest: run.record_digest, revision: run.revision,
    targetRef: run.target_ref, linkCount: run.link_count, ...linkFlags };
  const event = { operation: command.operation, receipt, receipt_digest: linkDigest(receipt) };
  await client.query(`INSERT INTO obrasaas_link_rehearsal_v1.events
    (operation_key,run_id,operation,request_digest,receipt,receipt_digest) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
    [command.operationKey,run.run_id,command.operation,command.requestDigest,JSON.stringify(receipt),event.receipt_digest]);
  return event;
}

// makeClient creates two independent connections to the same allowlisted target.
// Public sources are held under SHARE locks while a different read-only
// transaction observes them. The writer changes ONLY the rehearsal ledger.
export async function executeLinkRehearsal(makeClient, command, manifest = null) {
  manifest = manifest === null ? null : structuredClone(manifest);
  command = structuredClone(command);
  const expected = command.operation === 'RECORD' ? recordCommand(manifest,command)
    : revertCommand({policyVersion:LINK_REHEARSAL_POLICY,targetRef:command.targetRef,runId:command.runId,
      recordDigest:command.recordDigest,...linkFlags},command);
  if (linkDigest(command) !== linkDigest(expected)) failLink('REHEARSAL_COMMAND_INVALID');
  const writer = makeClient(), reader = makeClient();
  let transaction = false, commitStarted = false;
  try {
    await writer.connect(); await reader.connect();
    const identify = async client => (await client.query('SELECT current_database() AS db,current_user AS usr,pg_backend_pid() AS pid')).rows[0];
    const [left,right] = await Promise.all([identify(writer),identify(reader)]);
    if (!left || !right || left.db !== right.db || left.usr !== right.usr || left.pid === right.pid)
      failLink('REHEARSAL_CONNECTION_PAIR_INVALID');
    await writer.query('BEGIN ISOLATION LEVEL READ COMMITTED'); transaction = true;
    await writer.query("SET LOCAL statement_timeout = '15s'");
    await writer.query("SET LOCAL lock_timeout = '3s'");
    await writer.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
    await writer.query('SELECT pg_advisory_xact_lock(179056,20260928)');
    const exists = await ledgerExists(writer);
    if (exists) {
      const prior = (await writer.query('SELECT * FROM obrasaas_link_rehearsal_v1.events WHERE operation_key=$1', [command.operationKey])).rows[0];
      if (prior) {
        if (prior.request_digest !== command.requestDigest || prior.operation !== command.operation || prior.receipt_digest !== linkDigest(prior.receipt))
          failLink('REHEARSAL_IDEMPOTENCY_CONFLICT');
        const {run} = await readRun(writer,prior.run_id);
        if (run.target_ref !== command.targetRef) failLink('REHEARSAL_TARGET_FORBIDDEN');
        await writer.query('ROLLBACK'); transaction = false;
        return resultFor(run,prior,true,false);
      }
    }
    let run, event;
    if (command.operation === 'RECORD') {
      await writer.query(SOURCE_LOCK);
      const snapshot = await readLegacyCutover(reader);
      const checked = checkLegacyMappingPlan(snapshot,manifest,{sourceSha:command.sourceSha});
      if (checked.status !== 'SELECTIONS_COMPLETE_NOT_AUTHORIZED') failLink('REHEARSAL_REVIEW_INCOMPLETE');
      if (!exists) await writer.query(schemaSql);
      const previous = (await writer.query('SELECT run_id FROM obrasaas_link_rehearsal_v1.runs WHERE plan_fingerprint=$1', [checked.planFingerprint])).rows;
      if (previous.length) failLink('REHEARSAL_PLAN_ALREADY_RECORDED');
      const records = new Map(manifest.records.map(row => [row.sourceRef,row]));
      const links = checked.rehearsalSteps.map((step,index) => ({ ordinal:index+1,sourceRef:step.sourceRef,
        targetRef:step.targetRef,parentSourceRef:step.parentSourceRef,kind:records.get(step.sourceRef).kind,operationKey:step.operationKey }));
      run = { run_id:'run_'+linkDigest([LINK_REHEARSAL_POLICY,command.targetRef,checked.planFingerprint]),
        target_ref:command.targetRef,source_sha:command.sourceSha,plan_fingerprint:checked.planFingerprint,
        links_digest:linkDigest(links),link_count:links.length,state:'RECORDED',revision:1 };
      run.record_digest = linkDigest(runReceipt(run,links));
      await writer.query(`INSERT INTO obrasaas_link_rehearsal_v1.runs
        (run_id,target_ref,source_sha,plan_fingerprint,links_digest,record_digest,link_count,state,revision)
        VALUES($1,$2,$3,$4,$5,$6,$7,'RECORDED',1)`,
        [run.run_id,run.target_ref,run.source_sha,run.plan_fingerprint,run.links_digest,run.record_digest,run.link_count]);
      // Sequential inserts preserve the parent-before-child foreign key contract.
      for (const link of links) await writer.query(`INSERT INTO obrasaas_link_rehearsal_v1.links
        (run_id,ordinal,source_ref,target_ref,parent_source_ref,kind,operation_key) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [run.run_id,link.ordinal,link.sourceRef,link.targetRef,link.parentSourceRef,link.kind,link.operationKey]);
      event = await writeEvent(writer,command,run);
    } else if (command.operation === 'REVERT') {
      if (!exists) failLink('REHEARSAL_RUN_NOT_FOUND');
      ({run} = await readRun(writer,command.runId));
      if (run.target_ref !== command.targetRef || run.record_digest !== command.recordDigest) failLink('REHEARSAL_RECEIPT_MISMATCH');
      if (run.state !== 'RECORDED') failLink('REHEARSAL_ALREADY_REVERTED');
      const update = await writer.query(`UPDATE obrasaas_link_rehearsal_v1.runs
        SET state='REVERTED',revision=2,reverted_at=now() WHERE run_id=$1 AND state='RECORDED' AND revision=1`, [run.run_id]);
      if (update.rowCount !== 1) failLink('REHEARSAL_REVISION_CONFLICT');
      run = {...run,state:'REVERTED',revision:2}; event = await writeEvent(writer,command,run);
    } else failLink('REHEARSAL_COMMAND_INVALID');
    await readRun(writer,run.run_id);
    commitStarted = true;
    await writer.query('COMMIT'); transaction = false; commitStarted = false;
    return resultFor(run,event,false,command.operation === 'RECORD');
  } catch (error) {
    if (transaction) await writer.query('ROLLBACK').catch(() => {});
    throw classifyLinkError(error,commitStarted);
  } finally { await Promise.allSettled([writer.end(),reader.end()]); }
}
