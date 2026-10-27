import assert from 'node:assert/strict';
import {randomUUID, createHash, createHmac} from 'node:crypto';
import {existsSync, readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {Client, Pool} from 'pg';
import {trackDisposablePool, closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {lifecycleSchema, lifecycleEnvironment, lifecycleTenants, lifecyclePng, createControlledLifecycleBlob, createControlledLifecycleGraph} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {createPrivateImageUploader} from '../src/lib/private-image-upload.mjs';
import {createOrganizationUsage} from '../src/lib/organization-usage-store.mjs';
import {createPilotMediaAnalyzer} from '../src/lib/pilot-media.mjs';
import {createParticipantKycPreanalysis} from '../src/lib/participant-kyc-preanalysis.mjs';
import {PARTICIPANT_NOTICE_VERSION, participantReceiptId} from '../src/lib/participant-policy.mjs';
import {PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION, PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256} from '../src/lib/participant-kyc-image-set.mjs';
import {PARTICIPANT_AUTO_OCR_NOTICE_VERSION, PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION, PARTICIPANT_OCR_NOTICE_VERSION, PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from '../src/lib/participant-analysis-consent.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createMetaCustomerInbox, createMetaCustomerCallbackHandlers, splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {prepareMetaKycChallenge as prepareHistoricalV2Challenge} from '../tests/fixtures/meta-kyc-challenge-legacy-v2.mjs';
import {syntheticCaptureQuality} from './lib/synthetic-capture-quality.mjs';
import {CAPTURE_QUALITY_NOTICE_VERSION, CAPTURE_QUALITY_MODEL_MANIFEST_SHA256} from '../src/lib/private-capture-quality.mjs';
import {resolveMetaKycAuthority, META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';
import {createParticipantChannelKycDeposit, createParticipantChannelKycUploader} from '../src/lib/participant-channel-kyc.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {customerJobTransaction, customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const prefix = 'obrasaas_kyc_preanalysis_';
const databasePattern = /^obrasaas_kyc_preanalysis_[a-f0-9]{32}$/;
export const PARTICIPANT_KYC_PREANALYSIS_CHECKS = Object.freeze([
  'web-v1-consent-is-not-reinterpreted-or-queued-and-budget-recovery-does-not-read-sources',
  'web-v2-intent-is-atomic-personal-and-replay-keeps-the-original-source-and-wakeup',
  'explicit-v2-refusal-is-terminal-with-no-private-read-or-provider-or-permission-change',
  'three-image-web-source-sends-only-front-to-OCR-and-front-selfie-to-private-advisory',
  'parallel-workers-and-cron-cannot-dispatch-a-live-claim-twice',
  'configuration-wait-is-durable-and-cron-recovers-once-after-explicit-recheck-time',
  'expired-OCR-DISPATCHED-reclaims-only-current-pending-biometric-without-retrying-OCR-or-accepting-late-fields',
  'uncertain-OCR-with-biometric-configuration-wait-is-recoverable-only-for-that-independent-pending-stage',
  'expired-coverage-holds-without-dispatch-and-renewed-trial-recovers-the-same-bound-operation',
  'transport-uncertainty-records-UNKNOWN-and-reload-or-cron-never-retries-a-dispatched-request',
  'canonical-DISPATCHED-and-UNKNOWN-resource-receipts-block-before-private-reads-without-a-new-paid-attempt',
  'cron-skips-old-held-and-backs-off-invalid-source-without-starving-the-next-valid-reference',
  'unique-original-submission-and-exact-project-actor-consent-evidence-are-required-before-private-reads',
  'current-membership-revocation-during-private-read-denies-before-reservation-or-provider-dispatch',
  'late-submission-change-cannot-store-results-or-overwrite-the-current-capture',
  'fresh-SQL-clock-rejects-an-expired-claim-after-await-with-zero-provider-and-no-lease-extension',
  'expired-durable-DISPATCHED-claim-becomes-UNCERTAIN-once-and-late-provider-result-cannot-rewrite-current-state',
  'signed-WhatsApp-three-image-capture-enqueues-current-v2-consent-once-with-original-issuer-and-no-account-or-field-grant',
  'only-technical-preanalysis-and-usage-records-are-created-no-review-permission-attendance-or-task-effect',
]);
const session = (userId, organizationId = 'org_A', organizationRole = 'org:member') => ({authenticated: true, verification: 'clerk-production-jwt', userId, organizationId, organizationRole});

// No ambient DATABASE_URL, production credential, custom host or target name is
// ever considered. This guard runs before constructing a PostgreSQL client.
export function participantPreanalysisDisposableTarget(environment = {}) {
  const deny = () => {throw Object.assign(new Error('Explicit local disposable PostgreSQL target required'), {code: 'KYC_PREANALYSIS_TARGET_REJECTED'});};
  let url; try {url = new URL(environment.CUTOVER_TEST_DATABASE_URL);} catch {deny();}
  if (environment.CUTOVER_TEST_DISPOSABLE !== '1' || environment.VERCEL || environment.VERCEL_ENV || environment.VERCEL_TARGET_ENV ||
      !['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || !['5432', '6549'].includes(url.port) ||
      url.username !== 'cutover_test' || url.password !== (url.port === '5432' ? 'cutover_test' : '') || url.pathname !== '/obrasaas_cutover_ci' || url.search || url.hash) deny();
  return url;
}

export function participantPreanalysisTargetSelfTest() {
  const local = {CUTOVER_TEST_DISPOSABLE: '1', CUTOVER_TEST_DATABASE_URL: 'postgresql://cutover_test@127.0.0.1:6549/obrasaas_cutover_ci'};
  assert.equal(participantPreanalysisDisposableTarget(local).hostname, '127.0.0.1');
  assert.equal(participantPreanalysisDisposableTarget({...local, CUTOVER_TEST_DATABASE_URL: 'postgresql://cutover_test:cutover_test@127.0.0.1:5432/obrasaas_cutover_ci'}).port, '5432');
  const changes = [{CUTOVER_TEST_DISPOSABLE: undefined}, {CUTOVER_TEST_DISPOSABLE: '0'}, {VERCEL: '1'}, {VERCEL_ENV: 'production'}, {VERCEL_TARGET_ENV: 'preview'},
    ...['https://127.0.0.1:6549/obrasaas_cutover_ci', 'postgresql://cutover_test@db.example.invalid:6549/obrasaas_cutover_ci',
      'postgresql://cutover_test@localhost:6549/obrasaas_cutover_ci', 'postgresql://other@127.0.0.1:6549/obrasaas_cutover_ci',
      'postgresql://cutover_test:secret@127.0.0.1:6549/obrasaas_cutover_ci', 'postgresql://cutover_test@127.0.0.1:6548/obrasaas_cutover_ci',
      'postgresql://cutover_test@127.0.0.1:6549/neondb', 'postgresql://cutover_test@127.0.0.1:6549/obrasaas_cutover_ci?sslmode=require',
      'postgresql://cutover_test@127.0.0.1:6549/obrasaas_cutover_ci#target', 'not-a-url'].map(CUTOVER_TEST_DATABASE_URL => ({CUTOVER_TEST_DATABASE_URL}))];
  for (const change of changes) assert.throws(() => participantPreanalysisDisposableTarget({...local, ...change}), {code: 'KYC_PREANALYSIS_TARGET_REJECTED'});
  return {status: 'TARGET_GUARDS_PASS_POSTGRES_NOT_EXECUTED', accepted: 2, rejected: changes.length, clientsConstructed: 0, providerRequests: 0};
}

export function participantPreanalysisSourceManifest() {
  const files = new Set(), visit = relative => {
    if (files.has(relative)) return;
    assert.ok(!path.isAbsolute(relative) && !relative.split('/').includes('..'));
    const filename = path.join(root, relative); assert.ok(existsSync(filename)); files.add(relative);
    if (!/\.[cm]?jsx?$/.test(relative)) return;
    const tree = parse(readFileSync(filename, 'utf8'), {sourceType: 'module', plugins: ['jsx']});
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      const specifier = ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) ? node.source?.value
        : node.type === 'CallExpression' && node.callee?.type === 'Import' ? node.arguments[0]?.value : null;
      if (typeof specifier === 'string' && specifier.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), specifier), found = [base, base + '.mjs', base + '.js', path.join(base, 'index.js')].find(candidate => existsSync(candidate));
        assert.ok(found, relative + ': missing local source'); visit(path.relative(root, found).split(path.sep).join('/'));
      }
      for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
    }; walk(tree);
  };
  for (const relative of ['scripts/verify-participant-kyc-preanalysis-postgres.mjs', 'src/app/api/identity/participants/route.js', 'src/app/api/meta/customer-process/route.js',
    'api/_biometric_core.py', 'package.json', 'package-lock.json']) visit(relative);
  return [...files].sort().map(relative => {const bytes = readFileSync(path.join(root, relative)); return {path: relative, bytes: bytes.length, sha256: sha(bytes)};});
}

export async function verifyParticipantKycPreanalysisPostgres(environment = process.env) {
  const target = participantPreanalysisDisposableTarget(environment), database = prefix + randomUUID().replaceAll('-', '');
  assert.match(database, databasePattern);
  const sources = participantPreanalysisSourceManifest(), sourceDigest = digest(sources), startedAt = new Date().toISOString();
  const nativeEnvironment = {...lifecycleEnvironment};
  const admin = new Client({connectionString: target.href, options: '-c statement_timeout=8000 -c lock_timeout=5000 -c TimeZone=UTC'});
  const checks = [], sqlFailures = [], lockObservations = [], releases = new Set(), inFlight = new Set(), observedPids = new Set();
  const blob = createControlledLifecycleBlob(), webWakeups = [], whatsappWakeups = [];
  const counts = {unexpectedNetwork: 0, privateReads: 0, syntheticOpenAi: 0, syntheticBiometric: 0};

  // Explicit generated-pixel adapter for this SQL/control-flow harness only.
  // It exercises no vision/model inference, identity, authenticity or liveness.
  assert.equal(sha(readFileSync(new URL('./lib/synthetic-capture-quality.mjs', import.meta.url))), 'ca3114f1c6ffd88d321b1251ef1c502765b4ccb2c0be54915f0ee83e0668e420');
  assert.equal(sha(readFileSync(new URL('../tests/fixtures/meta-kyc-challenge-legacy-v2.mjs', import.meta.url))), 'b0403d1627eb3fc03fd9a41820b56c1a2dcdc74d14a0578e06f75fbc6571adb8');
  assert.equal(sha(readFileSync(new URL('../src/lib/capture-quality-policy.mjs', import.meta.url))), '94cfd5f24158983a93430158a33716119cb17783f6067053610a788638dd5057');
  const qualitySources = new Map();
  const ownQualitySource = (kind, bytes) => {
    assert.ok(['DOCUMENT_FRONT', 'DOCUMENT_BACK', 'SELFIE'].includes(kind));
    assert.ok(Buffer.isBuffer(bytes));
    const owned = Buffer.from(bytes), key = kind + ':' + sha(owned);
    assert.equal(qualitySources.has(key), false, 'Each generated capture is registered once by this harness');
    qualitySources.set(key, owned); return Buffer.from(owned);
  };
  const assessCaptureQuality = async input => {
    assert.ok(['DOCUMENT_FRONT', 'DOCUMENT_BACK', 'SELFIE'].includes(input.kind));
    assert.equal(input.image.mimeType, 'image/png'); assert.ok(Buffer.isBuffer(input.image.buffer));
    assert.equal(input.consentVersion, 'participant-capture-quality-v1');
    assert.equal(CAPTURE_QUALITY_NOTICE_VERSION, 'participant-capture-quality-v1');
    assert.equal(CAPTURE_QUALITY_MODEL_MANIFEST_SHA256, '49b52aefe0f0247ff19b0445af1ab173550163d701fd2a2dd7959289bbbd42e3');
    const digest = sha(input.image.buffer), owned = qualitySources.get(input.kind + ':' + digest);
    assert.ok(owned, 'Only captures generated and registered by this exact harness may enter its synthetic quality port');
    assert.deepEqual(input.image.buffer, owned);
    const result = await syntheticCaptureQuality(input);
    assert.equal(result.version, 1); assert.equal(result.mode, 'capture-quality-v1'); assert.equal(result.kind, input.kind);
    assert.equal(result.state, 'QUALITY_PASS'); assert.deepEqual(result.reasonCodes, []);
    assert.equal(result.imageSha256, digest); assert.equal(result.modelManifestSha256, CAPTURE_QUALITY_MODEL_MANIFEST_SHA256);
    assert.equal(result.identityCertified, false); assert.equal(result.livenessVerified, false); assert.equal(result.documentAuthenticityVerified, false);
    return result;
  };

  const originalFetch = globalThis.fetch;
  let pool, created = false, ownedOid = null, engine, ownership, activeCheck = null, failure = null;
  let getHook = null, fetchHook = null, providerMode = 'SUCCESS', readiness = {ocr: true, biometric: true}, webNumber = 0;
  const cleanup = {poolClosed: false, ownSessionsBeforeDrop: null, databaseRemoved: false, adminClosed: false, sourceBytesUnchanged: false};
  const query = (sql, values) => pool.query(sql, values);
  const connect = async () => {
    const client = await pool.connect();
    return {release: broken => client.release(broken), query: async (sql, values) => {
      try {return await client.query(sql, values);} catch (error) {if (/^[0-9A-Z]{5}$/.test(error.code || '')) sqlFailures.push({code: error.code}); throw error;}
    }};
  };
  const row = async id => (await query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1`, [id])).rows[0];
  const get = async (pathname, options) => {
    assert.equal(options?.access, 'private'); assert.equal(options?.useCache, false);
    assert.match(pathname, /^obrasaas\/legacy-images\/v1\/[a-f0-9]{64}\/image\.(png|jpg|webp)$/);
    counts.privateReads++; const hook = getHook; getHook = null; if (hook) await hook(); return blob.get(pathname, options);
  };
  const roleSnapshot = async () => digest((await query(`SELECT (SELECT jsonb_agg(x ORDER BY id) FROM public."PlatformUser" x) AS users,(SELECT jsonb_agg(x ORDER BY id) FROM public."TenantMembership" x) AS members,(SELECT jsonb_agg(x ORDER BY id) FROM public."ProjectMembership" x) AS projects`)).rows);
  const blobSnapshot = () => [...blob.objects].map(([pathname, value]) => ({pathnameSha256: sha(Buffer.from(pathname)), bytes: value.bytes.length, contentType: value.contentType, sha256: sha(value.bytes)})).sort((a, b) => a.pathnameSha256.localeCompare(b.pathnameSha256));
  const stable = async ref => {
    const worker = await row(ref.workerId), metadata = structuredClone(worker.metadata); delete metadata.participant.kyc.processing;
    const receipts = (await query(`SELECT * FROM public."AuditLog" WHERE "entityId"=$1 AND action<>'participant.kyc.preanalysis' AND action<>'organization.usage.resource' ORDER BY id`, [ref.workerId])).rows;
    return {metadata, roles: await roleSnapshot(), receipts, blobs: blobSnapshot()};
  };
  const track = promise => {inFlight.add(promise); promise.then(() => inFlight.delete(promise), () => inFlight.delete(promise)); return promise;};
  const gate = () => {
    let entered, release; const ready = new Promise(resolve => {entered = resolve;}), waiting = new Promise(resolve => {release = resolve;}); releases.add(release);
    return {enter: () => {entered(); return waiting;}, release: () => {releases.delete(release); release();}, wait: async pending => {
      let timeout; try {await Promise.race([ready, Promise.all(Array.isArray(pending) ? pending : [pending]).then(() => {assert.fail('Canonical processing finished before the expected private-I/O barrier');}),
        new Promise((_, reject) => {timeout = setTimeout(() => reject(new Error('Canonical private-I/O barrier was not reached within 25000ms')), 25000);})]);} finally {clearTimeout(timeout);}
    }};
  };
  const check = async (name, run) => {activeCheck = name; assert.equal(name, PARTICIPANT_KYC_PREANALYSIS_CHECKS[checks.length]); try {await run(); checks.push(name);} finally {for (const release of releases) release(); releases.clear();}};
  const mutate = async (id, fn) => {const worker = await row(id); fn(worker.metadata); await query(`UPDATE public."Worker" SET metadata=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`, [id, JSON.stringify(worker.metadata)]);};
  const refOf = worker => ({projectId: worker.projectId, workerId: worker.id, submissionId: worker.metadata.participant.kyc.submissionId});
  const usages = async workerId => (await query(`SELECT * FROM public."AuditLog" WHERE "entityId"=$1 AND action='organization.usage.resource' ORDER BY id`, [workerId])).rows;
  const liveFetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions'); assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body), images = body.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).filter(content => content.type === 'image_url');
    assert.equal(body.model, 'gpt-4o'); assert.equal(images.length, 1, 'Only the document front may reach OCR');
    const image = Buffer.from(images[0].image_url.url.split(',')[1], 'base64'), imageSha = sha(image);
    const ledger = (await query(`SELECT metadata FROM public."AuditLog" WHERE action='organization.usage.resource' AND metadata->>'state'='DISPATCHED' AND metadata->'binding'->>'sourceSha256'=$1`, [imageSha])).rows;
    assert.equal(ledger.length, 1); assert.equal(ledger[0].metadata.binding.stage, 'IDENTITY_OPENAI_OCR');
    const worker = await row(ledger[0].metadata.binding.resourceId); assert.equal(worker.metadata.participant.kyc.processing.stages.ocr.state, 'DISPATCHED');
    assert.equal(worker.metadata.participant.kyc.images.find(value => value.id === 'document-front').sha256, imageSha);
    counts.syntheticOpenAi++; const hook = fetchHook; fetchHook = null; if (hook) await hook();
    if (providerMode === 'UNKNOWN') throw new Error('Synthetic post-dispatch transport uncertainty');
    return Response.json({id: 'chatcmpl_SyntheticPreanalysis', model: 'gpt-4o', usage: {prompt_tokens: 100, completion_tokens: 20, total_tokens: 120},
      choices: [{finish_reason: 'stop', message: {content: JSON.stringify({isDni: true, nombreCompleto: 'PERSONA SINTETICA DE ENSAYO', dni: '12345678', cuil: null, ocrConfidence: 50})}}]}, {headers: {'x-request-id': 'req_SyntheticPreanalysis'}});
  };
  const biometrics = async ({front, selfie}) => {
    const frontSha256 = sha(front.buffer), selfieSha256 = sha(selfie.buffer);
    const workers = (await query(`SELECT metadata FROM public."Worker" WHERE metadata->'participant'->'kyc'->'processing'->'stages'->'biometric'->>'state'='DISPATCHED'`)).rows;
    assert.equal(workers.filter(value => value.metadata.participant.kyc.images.some(image => image.id === 'document-front' && image.sha256 === frontSha256)
      && value.metadata.participant.kyc.images.some(image => image.id === 'selfie' && image.sha256 === selfieSha256)).length, 1);
    counts.syntheticBiometric++;
    return {success: true, status: 'ADVISORY_UNREVIEWED', provider: 'private-opencv-onnx', modelManifestSha256: 'c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860',
      frontSha256, selfieSha256, faceSimilarity: 0.1, captureRiskSignal: 0.2, identityCertified: false, livenessVerified: false, documentAuthenticityVerified: false, measurementCalibrated: false, requiresHumanReview: true};
  };
  globalThis.fetch = async () => {counts.unexpectedNetwork++; throw new Error('UNCONTROLLED_PREANALYSIS_NETWORK');};
  try {
    await admin.connect();
    const boundary = (await admin.query(`SELECT current_database() AS database,session_user AS actor,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port,current_setting('server_version_num')::int AS version`)).rows[0];
    assert.equal(boundary.database, 'obrasaas_cutover_ci'); assert.equal(boundary.actor, 'cutover_test'); assert.equal(boundary.role, 'cutover_test');
    assert.equal(boundary.host, '127.0.0.1'); assert.equal(boundary.port, Number(target.port)); assert.ok(boundary.version >= 170000 && boundary.version < 180000); engine = boundary;
    assert.equal((await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [database])).rows.length, 0);
    await admin.query('CREATE DATABASE "' + database + '"'); created = true;
    ownership = (await admin.query(`SELECT d.oid,d.datname,pg_get_userbyid(d.datdba) AS owner FROM pg_database d WHERE d.datname=$1`, [database])).rows[0];
    assert.equal(ownership.datname, database); assert.equal(ownership.owner, 'cutover_test'); ownedOid = ownership.oid;
    const child = new URL(target); child.pathname = '/' + database;
    pool = trackDisposablePool(new Pool({connectionString: child.href, max: 12, options: '-c statement_timeout=8000 -c lock_timeout=5000 -c TimeZone=UTC'}));
    pool.on('connect', client => observedPids.add(client.processID));
    assert.equal((await query('SELECT current_database() AS database')).rows[0].database, database);
    await query(lifecycleSchema); await query(`ALTER TABLE public."Organization" ADD COLUMN "subscriptionPlan" text DEFAULT 'TRIAL',ADD COLUMN "subscriptionStatus" text DEFAULT 'TRIALING'`);
    for (const tenant of lifecycleTenants) {
      await query(`INSERT INTO public."Organization"(id,name,"clerkOrganizationId",metadata,"trialEndsAt") VALUES($1,'Synthetic preanalysis organization',$2,'{}',clock_timestamp()+interval '1 day')`, [tenant.organizationId, tenant.clerkOrganizationId]);
      await query(`INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`, [tenant.ownerId, tenant.ownerUserId, tenant.ownerId + '@example.invalid']);
      await query(`INSERT INTO public."TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'ADMIN','org:admin','ACTIVE')`, ['owner-member-' + tenant.key, tenant.ownerId, tenant.organizationId]);
      await query(`INSERT INTO public."Project"(id,"organizationId",name,status,metadata) VALUES($1,$2,'Synthetic preanalysis project','ACTIVE','{}')`, [tenant.projectId, tenant.organizationId]);
    }
    const workspace = createWorkspaceStore({connect}), usage = createOrganizationUsage({workspace, connect});
    const uploader = createPrivateImageUploader({get, put: blob.put, environment: () => nativeEnvironment});
    const store = createParticipantStore({workspace, connect, upload: uploader.uploadImageToBlob, get, assessCaptureQuality, environment: nativeEnvironment});
    const analyzer = createPilotMediaAnalyzer({environment: () => ({OPENAI_API_KEY: 'synthetic-preanalysis-no-provider-access'}), fetchImpl: liveFetch});
    const service = createParticipantKycPreanalysis({connect, get, analyzer, assessBiometrics: biometrics, usage, readiness: () => readiness});
    async function submit({ocr = true, biometric = false, legacy = false, back = false} = {}) {
      const number = ++webNumber, userId = 'user_Preanalysis' + number, actorId = 'preanalysis-actor-' + number, workerId = 'preanalysis-worker-' + number;
      await query(`INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`, [actorId, userId, 'preanalysis-' + number + '@example.invalid']);
      await query(`INSERT INTO public."TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,'company-a','AUDITOR','org:member','ACTIVE')`, ['preanalysis-member-' + number, actorId]);
      await query(`INSERT INTO public."ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES($1,'project-a',$2,'ACTIVE')`, ['preanalysis-pm-' + number, 'preanalysis-member-' + number]);
      const metadata = {siteRegister: {version: 1}, participant: {version: 1, status: 'ACTIVE', clerkUserId: userId, permissions: {attendance: false, report: false}, kyc: {version: 1, status: 'NOT_SUBMITTED'}}};
      await query(`INSERT INTO public."Worker"(id,"projectId",name,phone,role,active,metadata) VALUES($1,'project-a','Synthetic preanalysis participant',$2,'WORKER',true,$3::jsonb)`, [workerId, '+5491101' + String(number).padStart(6, '0'), JSON.stringify(metadata)]);
      const actor = session(userId), scope = (await workspace.list(actor)).scope, initial = await row(workerId), rolesBeforeCapture = await roleSnapshot();
      const image = kind => ownQualitySource({front: 'DOCUMENT_FRONT', back: 'DOCUMENT_BACK', selfie: 'SELFIE'}[kind], Buffer.concat([lifecyclePng, Buffer.from('synthetic-preanalysis-' + number + '-' + kind)])).toString('base64');
      const input = {projectId: 'project-a', scope, workerId, revision: initial.revision, operationId: randomUUID(), noticeVersion: PARTICIPANT_NOTICE_VERSION,
        consent: true, front: image('front'), selfie: image('selfie'), ocrConsent: ocr, ocrNoticeVersion: legacy ? PARTICIPANT_OCR_NOTICE_VERSION : PARTICIPANT_AUTO_OCR_NOTICE_VERSION,
        biometricConsent: biometric, biometricNoticeVersion: legacy ? PARTICIPANT_BIOMETRIC_NOTICE_VERSION : PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION};
      if (back) Object.assign(input, {back: image('back'), backConsent: true, backNoticeVersion: PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION, backNoticeSha256: PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256});
      const handler = createParticipantHandlers({verify: async () => actor, store, scheduleAnalysis: ref => webWakeups.push(ref)});
      const request = () => new Request('https://obrasaas.com/api/identity/participants', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://obrasaas.com'}, body: JSON.stringify(input)});
      const wakeupsBeforeCapture = webWakeups.length;
      const response = await handler.POST(request()); assert.equal(response.status, 200); const outcome = await response.json(); assert.equal(outcome.saved, true);
      const current = await row(workerId), ref = refOf(current), source = (await query('SELECT * FROM public."AuditLog" WHERE id=$1', [outcome.receiptId])).rows[0];
      assert.equal(source.id, participantReceiptId(actorId, ref.projectId, input.operationId)); assert.equal(source.metadata.kind, 'KYC_SUBMITTED');
      const previousParticipant = structuredClone(initial.metadata.participant), currentParticipant = structuredClone(current.metadata.participant);
      delete previousParticipant.kyc; delete currentParticipant.kyc;
      assert.deepEqual(currentParticipant, previousParticipant); assert.equal(await roleSnapshot(), rolesBeforeCapture);
      assert.deepEqual(currentParticipant.permissions, {attendance: false, report: false});
      for (const [id, key] of [['document-front', 'front'], ['selfie', 'selfie'], ...(back ? [['document-back', 'back']] : [])]) {
        assert.equal(current.metadata.participant.kyc.images.find(value => value.id === id)?.sha256, sha(Buffer.from(input[key], 'base64')));
      }
      assert.equal(webWakeups.length - wakeupsBeforeCapture, legacy ? 0 : 1);
      if (!legacy) assert.deepEqual(webWakeups.at(-1), ref);
      return {ref, input, handler, request, outcome, source, number};
    }
    await check('web-v1-consent-is-not-reinterpreted-or-queued-and-budget-recovery-does-not-read-sources', async () => {
      const fixture = await submit({legacy: true, ocr: true, biometric: true}), worker = await row(fixture.ref.workerId), before = {...counts};
      assert.equal(worker.metadata.participant.kyc.processing, undefined);
      assert.deepEqual(await service.recover(), {durable: true, checked: 0, results: []}); assert.deepEqual(counts, before);
      assert.deepEqual(await service.recover({budgetMs: 154999}), {durable: true, checked: 0, results: [], deferred: true});
    });
    await check('web-v2-intent-is-atomic-personal-and-replay-keeps-the-original-source-and-wakeup', async () => {
      const before = {...counts}, fixture = await submit(), worker = await row(fixture.ref.workerId), kyc = worker.metadata.participant.kyc;
      assert.equal(kyc.status, 'PENDING_REVIEW'); assert.equal(kyc.processing.status, 'QUEUED'); assert.equal(kyc.processing.auto.sourceReceiptId, fixture.source.id);
      assert.equal(kyc.processing.auto.sourceActorId, fixture.source.actorId); assert.equal(kyc.processing.auto.submissionId, fixture.ref.submissionId);
      assert.equal(counts.syntheticOpenAi, before.syntheticOpenAi); assert.equal(counts.syntheticBiometric, before.syntheticBiometric);
      const snapshot = await stable(fixture.ref), wakeups = webWakeups.length;
      const replay = await fixture.handler.POST(fixture.request()); assert.equal(replay.status, 200); assert.equal((await replay.json()).replayed, true);
      assert.equal(webWakeups.length, wakeups); assert.deepEqual(await stable(fixture.ref), snapshot);
      await service.process(fixture.ref); assert.deepEqual(await stable(fixture.ref), snapshot);
      const usageRows = await usages(fixture.ref.workerId); assert.equal(usageRows.length, 1); assert.equal(usageRows[0].metadata.state, 'OBSERVED');
      assert.equal(usageRows[0].metadata.observation.usage.totalTokens, '120');
    });
    await check('explicit-v2-refusal-is-terminal-with-no-private-read-or-provider-or-permission-change', async () => {
      const fixture = await submit({ocr: false, biometric: false}), before = {...counts}, snapshot = await stable(fixture.ref);
      assert.equal((await row(fixture.ref.workerId)).metadata.participant.kyc.processing.status, 'SKIPPED_CONSENT');
      assert.equal((await service.process(fixture.ref)).state, 'SKIPPED_CONSENT'); assert.deepEqual(counts, before); assert.deepEqual(await stable(fixture.ref), snapshot);
    });
    await check('three-image-web-source-sends-only-front-to-OCR-and-front-selfie-to-private-advisory', async () => {
      const fixture = await submit({ocr: true, biometric: true, back: true}), before = {...counts}, snapshot = await stable(fixture.ref), worker = await row(fixture.ref.workerId);
      assert.equal(worker.metadata.participant.kyc.images.length, 3); assert.equal((await service.process(fixture.ref)).state, 'EXTRACTED_UNVERIFIED');
      assert.equal(counts.syntheticOpenAi - before.syntheticOpenAi, 1); assert.equal(counts.syntheticBiometric - before.syntheticBiometric, 1);
      assert.equal(counts.privateReads - before.privateReads, 2); assert.deepEqual(await stable(fixture.ref), snapshot);
      const k = (await row(fixture.ref.workerId)).metadata.participant.kyc; assert.equal(k.processing.biometrics.requiresHumanReview, true); assert.equal(k.processing.biometrics.identityCertified, false);
    });
    await check('parallel-workers-and-cron-cannot-dispatch-a-live-claim-twice', async () => {
      const fixture = await submit(), pause = gate(), before = counts.syntheticOpenAi; fetchHook = pause.enter;
      const blocker = await pool.connect(); let blockerOpen = false;
      try {
        await blocker.query('BEGIN'); blockerOpen = true;
        await blocker.query('SELECT id FROM public."Worker" WHERE id=$1 FOR UPDATE', [fixture.ref.workerId]);
        const first = track(service.process(fixture.ref)), second = track(service.process(fixture.ref));
        let blocked;
        for (let attempt = 0; attempt < 50; attempt++) {
          blocked = (await admin.query(`SELECT pid,query,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=$1 AND $2::int=ANY(pg_blocking_pids(pid))`, [database, blocker.processID])).rows
            .find(value => value.query.includes('SELECT id,"projectId",active,metadata FROM public."Worker"') && value.query.includes('FOR UPDATE'));
          if (blocked) break; await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.ok(blocked, 'PostgreSQL itself must observe the real canonical Worker lock waiting on our exact blocker PID');
        assert.ok(blocked.blockers.includes(blocker.processID)); assert.equal(counts.syntheticOpenAi, before);
        lockObservations.push({kind: 'INITIAL_CLAIM_SERIALIZATION', blockerPid: blocker.processID, waiterPid: blocked.pid, canonicalWorkerLock: true, postgresReportedBlockingPid: true});
        await blocker.query('COMMIT'); blockerOpen = false;
        await pause.wait([first, second]); assert.deepEqual(await Promise.race([first, second]), {automatic: true, state: 'RUNNING', processed: false});
        assert.equal((await service.recover()).checked, 0); assert.equal(counts.syntheticOpenAi, before + 1);
        pause.release(); const results = await Promise.all([first, second]);
        assert.deepEqual(results.map(value => value.state).sort(), ['EXTRACTED_UNVERIFIED', 'RUNNING']); assert.equal((await usages(fixture.ref.workerId)).length, 1);
      } finally {if (blockerOpen) await blocker.query('ROLLBACK'); blocker.release();}
    });
    await check('configuration-wait-is-durable-and-cron-recovers-once-after-explicit-recheck-time', async () => {
      const fixture = await submit({ocr: true, biometric: true}), before = {...counts}; readiness = {ocr: false, biometric: false};
      assert.equal((await service.process(fixture.ref)).state, 'WAITING_CONFIGURATION'); assert.deepEqual(counts, before); assert.equal((await usages(fixture.ref.workerId)).length, 0);
      const snapshot = await stable(fixture.ref); readiness = {ocr: true, biometric: true}; assert.equal((await service.recover()).checked, 0);
      await mutate(fixture.ref.workerId, m => {m.participant.kyc.processing.nextCheckAt = '2000-01-01T00:00:00.000Z';});
      const recovered = await service.recover(); assert.equal(recovered.checked, 1); assert.equal(recovered.results[0].state, 'EXTRACTED_UNVERIFIED'); assert.deepEqual(await stable(fixture.ref), snapshot);
    });
    await check('expired-OCR-DISPATCHED-reclaims-only-current-pending-biometric-without-retrying-OCR-or-accepting-late-fields', async () => {
      const fixture = await submit({ocr: true, biometric: true}), pause = gate(), before = {...counts}, snapshot = await stable(fixture.ref);
      const short = createParticipantKycPreanalysis({connect, get, analyzer, assessBiometrics: biometrics, usage, readiness: () => readiness, leaseMs: 1000});
      fetchHook = pause.enter; const original = track(short.process(fixture.ref)); await pause.wait(original);
      const claimed = (await row(fixture.ref.workerId)).metadata.participant.kyc.processing, expiresAt = Date.parse(claimed.expiresAt);
      assert.equal(claimed.stages.ocr.state, 'DISPATCHED'); assert.equal(claimed.stages.biometric.state, 'PENDING'); assert.ok(Number.isFinite(expiresAt));
      for (;;) {const now = (await query('SELECT clock_timestamp() AS now')).rows[0].now; if (now.getTime() >= expiresAt) break; await new Promise(resolve => setTimeout(resolve, 25));}
      assert.deepEqual(await service.process(fixture.ref), {automatic: true, state: 'UNCERTAIN', code: 'PARTICIPANT_ANALYSIS_DISPATCH_UNCERTAIN', processed: true});
      const completed = (await row(fixture.ref.workerId)).metadata.participant.kyc.processing;
      assert.equal(completed.stages.ocr.state, 'DISPATCHED'); assert.equal(completed.stages.biometric.state, 'COMPLETE'); assert.deepEqual(completed.issueCodes, ['OCR_DISPATCH_UNCERTAIN']);
      assert.equal(completed.fields, undefined); assert.equal(completed.biometrics.requiresHumanReview, true); assert.equal(completed.biometrics.identityCertified, false);
      assert.equal(counts.syntheticOpenAi - before.syntheticOpenAi, 1); assert.equal(counts.syntheticBiometric - before.syntheticBiometric, 1); assert.equal(counts.privateReads - before.privateReads, 3);
      const receipts = (await query(`SELECT * FROM public."AuditLog" WHERE "entityId"=$1 AND action='participant.kyc.preanalysis'`, [fixture.ref.workerId])).rows;
      assert.equal(receipts.length, 1); assert.equal(receipts[0].metadata.status, 'UNCERTAIN');
      pause.release(); await assert.rejects(original, {code: 'PARTICIPANT_ANALYSIS_LEASE_CHANGED'});
      assert.deepEqual((await row(fixture.ref.workerId)).metadata.participant.kyc.processing, completed); assert.deepEqual(await stable(fixture.ref), snapshot);
      assert.equal((await usages(fixture.ref.workerId)).length, 1); assert.equal((await usages(fixture.ref.workerId))[0].metadata.state, 'OBSERVED');
      assert.equal((await service.recover()).checked, 0); assert.equal((await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE "entityId"=$1 AND action='participant.kyc.preanalysis'`, [fixture.ref.workerId])).rows[0].n, 1);
    });
    await check('uncertain-OCR-with-biometric-configuration-wait-is-recoverable-only-for-that-independent-pending-stage', async () => {
      const fixture = await submit({ocr: true, biometric: true}), pause = gate(), before = {...counts}, snapshot = await stable(fixture.ref);
      const short = createParticipantKycPreanalysis({connect, get, analyzer, assessBiometrics: biometrics, usage, readiness: () => readiness, leaseMs: 1000});
      fetchHook = pause.enter; const original = track(short.process(fixture.ref)); await pause.wait(original);
      const claimed = (await row(fixture.ref.workerId)).metadata.participant.kyc.processing, expiresAt = Date.parse(claimed.expiresAt); assert.ok(Number.isFinite(expiresAt));
      for (;;) {const now = (await query('SELECT clock_timestamp() AS now')).rows[0].now; if (now.getTime() >= expiresAt) break; await new Promise(resolve => setTimeout(resolve, 25));}
      readiness = {ocr: true, biometric: false};
      try {
        assert.deepEqual(await service.process(fixture.ref), {automatic: true, state: 'UNCERTAIN', code: 'PARTICIPANT_ANALYSIS_DISPATCH_UNCERTAIN', processed: false});
        const waiting = (await row(fixture.ref.workerId)).metadata.participant.kyc.processing;
        assert.equal(waiting.stages.ocr.state, 'DISPATCHED'); assert.deepEqual(waiting.stages.biometric, {state: 'WAITING_CONFIGURATION', code: 'BIOMETRIC_SERVICE_NOT_CONFIGURED'});
        assert.deepEqual(waiting.issueCodes, ['OCR_DISPATCH_UNCERTAIN', 'FACIAL_UNAVAILABLE']); assert.equal(Date.parse(waiting.nextCheckAt) - Date.parse(waiting.completedAt), 300000);
        assert.equal(counts.syntheticOpenAi - before.syntheticOpenAi, 1); assert.equal(counts.syntheticBiometric, before.syntheticBiometric); assert.equal(counts.privateReads - before.privateReads, 1);
        const receipts = (await query(`SELECT * FROM public."AuditLog" WHERE "entityId"=$1 AND action='participant.kyc.preanalysis'`, [fixture.ref.workerId])).rows; assert.equal(receipts.length, 1);
        assert.equal((await service.recover()).checked, 0); readiness = {ocr: true, biometric: true};
        await mutate(fixture.ref.workerId, m => {m.participant.kyc.processing.nextCheckAt = '2000-01-01T00:00:00.000Z';});
        const recovered = await service.recover(); assert.equal(recovered.checked, 1);
        assert.deepEqual(recovered.results[0], {automatic: true, state: 'UNCERTAIN', code: 'PARTICIPANT_ANALYSIS_DISPATCH_UNCERTAIN', processed: true});
        const completed = (await row(fixture.ref.workerId)).metadata.participant.kyc.processing;
        assert.equal(completed.stages.ocr.state, 'DISPATCHED'); assert.equal(completed.stages.biometric.state, 'COMPLETE'); assert.equal(completed.fields, undefined);
        assert.deepEqual(completed.issueCodes, ['OCR_DISPATCH_UNCERTAIN']); assert.equal(counts.syntheticOpenAi - before.syntheticOpenAi, 1); assert.equal(counts.syntheticBiometric - before.syntheticBiometric, 1);
        assert.equal(counts.privateReads - before.privateReads, 3); pause.release(); await assert.rejects(original, {code: 'PARTICIPANT_ANALYSIS_LEASE_CHANGED'});
        assert.deepEqual((await row(fixture.ref.workerId)).metadata.participant.kyc.processing, completed); assert.deepEqual(await stable(fixture.ref), snapshot);
        assert.deepEqual((await query(`SELECT * FROM public."AuditLog" WHERE "entityId"=$1 AND action='participant.kyc.preanalysis'`, [fixture.ref.workerId])).rows, receipts);
        assert.equal((await usages(fixture.ref.workerId)).length, 1); assert.equal((await usages(fixture.ref.workerId))[0].metadata.state, 'OBSERVED');
      } finally {readiness = {ocr: true, biometric: true};}
    });
    await check('expired-coverage-holds-without-dispatch-and-renewed-trial-recovers-the-same-bound-operation', async () => {
      const fixture = await submit(), before = counts.syntheticOpenAi, original = (await query('SELECT "trialEndsAt" FROM public."Organization" WHERE id=\'company-a\'')).rows[0].trialEndsAt;
      try {
        await query(`UPDATE public."Organization" SET "trialEndsAt"=clock_timestamp()-interval '1 day' WHERE id='company-a'`);
        assert.equal((await service.process(fixture.ref)).state, 'USAGE_HELD'); assert.equal(counts.syntheticOpenAi, before);
      } finally {await query('UPDATE public."Organization" SET "trialEndsAt"=$1 WHERE id=\'company-a\'', [original]);}
      const auto = (await row(fixture.ref.workerId)).metadata.participant.kyc.processing.auto;
      await mutate(fixture.ref.workerId, m => {m.participant.kyc.processing.nextCheckAt = '2000-01-01T00:00:00.000Z';});
      assert.equal((await service.recover()).results[0].state, 'EXTRACTED_UNVERIFIED');
      assert.deepEqual((await row(fixture.ref.workerId)).metadata.participant.kyc.processing.auto, auto); assert.equal(counts.syntheticOpenAi, before + 1);
    });
    await check('transport-uncertainty-records-UNKNOWN-and-reload-or-cron-never-retries-a-dispatched-request', async () => {
      const fixture = await submit(), before = counts.syntheticOpenAi, snapshot = await stable(fixture.ref); providerMode = 'UNKNOWN';
      try {assert.equal((await service.process(fixture.ref)).state, 'UNCERTAIN');} finally {providerMode = 'SUCCESS';}
      const ledger = await usages(fixture.ref.workerId); assert.equal(ledger.length, 1); assert.equal(ledger[0].metadata.state, 'UNKNOWN');
      const receipt = (await query(`SELECT * FROM public."AuditLog" WHERE "entityId"=$1 AND action='participant.kyc.preanalysis'`, [fixture.ref.workerId])).rows;
      assert.equal(receipt.length, 1); assert.equal(receipt[0].metadata.identityCertified, false); assert.equal(receipt[0].metadata.permissionsGranted, false);
      assert.equal((await service.process(fixture.ref)).state, 'UNCERTAIN'); assert.equal((await service.recover()).checked, 0);
      assert.equal(counts.syntheticOpenAi, before + 1); assert.deepEqual(await stable(fixture.ref), snapshot);
    });
    let heldRef;
    await check('canonical-DISPATCHED-and-UNKNOWN-resource-receipts-block-before-private-reads-without-a-new-paid-attempt', async () => {
      for (const state of ['DISPATCHED', 'UNKNOWN']) {
        const fixture = await submit(), worker = await row(fixture.ref.workerId), k = worker.metadata.participant.kyc, a = k.processing.auto;
        const client = await connect(); let reservation;
        try {
          await client.query('BEGIN'); const member = {organizationId: a.organizationId, actorId: a.sourceActorId}; await usage.lockBeforeProject(client, member);
          reservation = await usage.reserveResource(client, member, {version: 2, projectId: a.projectId, resourceType: 'Worker', resourceId: a.workerId,
            resourceRevision: digest(['participant-ocr-resource-v1', a.submissionId, a.contentHash]), stage: 'IDENTITY_OPENAI_OCR', sourceSha256: k.images[0].sha256,
            operationId: randomUUID(), requestDigest: digest(['synthetic-prior-attempt', state, a]), consentVersion: k.ocrConsent.noticeVersion, requestedModel: 'gpt-4o'});
          await usage.fence(client, member, reservation.capability); await client.query('COMMIT');
        } catch (error) {await client.query('ROLLBACK'); throw error;} finally {client.release();}
        if (state === 'UNKNOWN') await usage.unknown(reservation.capability);
        const before = {...counts}; assert.equal((await service.process(fixture.ref)).state, 'USAGE_HELD'); assert.deepEqual(counts, before);
        const receipts = await usages(fixture.ref.workerId); assert.equal(receipts.length, 1); assert.equal(receipts[0].metadata.state, state); heldRef = fixture.ref;
      }
    });
    await check('cron-skips-old-held-and-backs-off-invalid-source-without-starving-the-next-valid-reference', async () => {
      const bad = await submit(), good = await submit(), oldHeld = await row(heldRef.workerId);
      await query(`UPDATE public."Worker" SET "updatedAt"='2000-01-01' WHERE id=$1`, [heldRef.workerId]);
      await query('DELETE FROM public."AuditLog" WHERE id=$1', [bad.source.id]);
      await query(`UPDATE public."Worker" SET "updatedAt"='2000-01-02' WHERE id=$1`, [bad.ref.workerId]);
      const result = await service.recover({limit: 1}); assert.equal(result.checked, 2);
      assert.equal(result.results[0].code, 'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'); assert.equal(result.results[1].state, 'EXTRACTED_UNVERIFIED');
      assert.equal((await row(bad.ref.workerId)).metadata.participant.kyc.processing.recoveryCode, 'PARTICIPANT_ANALYSIS_SOURCE_CHANGED');
      assert.deepEqual((await row(heldRef.workerId)).metadata, oldHeld.metadata); assert.equal((await usages(good.ref.workerId)).length, 1);
    });
    await check('unique-original-submission-and-exact-project-actor-consent-evidence-are-required-before-private-reads', async () => {
      const fixture = await submit(), worker = await row(fixture.ref.workerId), original = structuredClone(worker.metadata), before = {...counts};
      await query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) SELECT $1,"organizationId","actorId",action,"entityType","entityId",metadata FROM public."AuditLog" WHERE id=$2`, ['participant_' + 'f'.repeat(64), fixture.source.id]);
      await assert.rejects(service.process(fixture.ref), {code: 'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'}); assert.deepEqual(counts, before);
      await query('DELETE FROM public."AuditLog" WHERE id=$1', ['participant_' + 'f'.repeat(64)]);
      await assert.rejects(service.process({...fixture.ref, projectId: 'project-b'}), {code: 'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});
      for (const patch of [m => {m.participant.kyc.ocrConsent.noticeSha256 = '0'.repeat(64);}, m => {m.participant.kyc.processing.auto.sourceActorId = 'owner-a';}]) {
        await mutate(fixture.ref.workerId, patch); await assert.rejects(service.process(fixture.ref), {code: 'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});
        await query('UPDATE public."Worker" SET metadata=$2::jsonb WHERE id=$1', [fixture.ref.workerId, JSON.stringify(original)]);
      }
      assert.deepEqual(counts, before); await service.process(fixture.ref);
    });
    await check('current-membership-revocation-during-private-read-denies-before-reservation-or-provider-dispatch', async () => {
      for (const [table, idPrefix] of [['TenantMembership', 'preanalysis-member-'], ['ProjectMembership', 'preanalysis-pm-']]) {
        const fixture = await submit(), pause = gate(), before = counts.syntheticOpenAi; getHook = pause.enter;
        const pending = track(service.process(fixture.ref)); await pause.wait(pending);
        await query('UPDATE public."' + table + '" SET status=\'DISABLED\' WHERE id=$1', [idPrefix + fixture.number]);
        pause.release(); await assert.rejects(pending, {code: 'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});
        assert.equal(counts.syntheticOpenAi, before); assert.equal((await usages(fixture.ref.workerId)).length, 0);
        await query('UPDATE public."' + table + '" SET status=\'ACTIVE\' WHERE id=$1', [idPrefix + fixture.number]);
      }
    });
    await check('late-submission-change-cannot-store-results-or-overwrite-the-current-capture', async () => {
      const fixture = await submit(), pause = gate(), before = counts.syntheticOpenAi; getHook = pause.enter;
      const pending = track(service.process(fixture.ref)); await pause.wait(pending);
      await mutate(fixture.ref.workerId, m => {m.participant.kyc.submissionId = 'kyc_synthetic_replacement';});
      const changed = await row(fixture.ref.workerId); pause.release(); await assert.rejects(pending, {code: 'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});
      assert.deepEqual(await row(fixture.ref.workerId), changed); assert.equal(counts.syntheticOpenAi, before); assert.equal((await usages(fixture.ref.workerId)).length, 0);
      assert.deepEqual((await query('SELECT * FROM public."AuditLog" WHERE id=$1', [fixture.source.id])).rows[0], fixture.source);
    });
    await check('fresh-SQL-clock-rejects-an-expired-claim-after-await-with-zero-provider-and-no-lease-extension', async () => {
      const fixture = await submit(), pause = gate(), before = counts.syntheticOpenAi;
      const short = createParticipantKycPreanalysis({connect, get, analyzer, assessBiometrics: biometrics, usage, readiness: () => readiness, leaseMs: 1000});
      getHook = pause.enter; const pending = track(short.process(fixture.ref)); await pause.wait(pending);
      const claimed = (await row(fixture.ref.workerId)).metadata.participant.kyc.processing, expiresAt = Date.parse(claimed.expiresAt); assert.ok(Number.isFinite(expiresAt));
      for (;;) {const now = (await query('SELECT clock_timestamp() AS now')).rows[0].now; if (now.getTime() >= expiresAt) break; await new Promise(resolve => setTimeout(resolve, 25));}
      pause.release(); await assert.rejects(pending, {code: 'PARTICIPANT_ANALYSIS_LEASE_CHANGED'});
      assert.equal((await row(fixture.ref.workerId)).metadata.participant.kyc.processing.expiresAt, claimed.expiresAt); assert.equal(counts.syntheticOpenAi, before);
    });
    await check('expired-durable-DISPATCHED-claim-becomes-UNCERTAIN-once-and-late-provider-result-cannot-rewrite-current-state', async () => {
      const fixture = await submit(), pause = gate(), before = counts.syntheticOpenAi, snapshot = await stable(fixture.ref);
      const short = createParticipantKycPreanalysis({connect, get, analyzer, assessBiometrics: biometrics, usage, readiness: () => readiness, leaseMs: 1000});
      fetchHook = pause.enter; const pending = track(short.process(fixture.ref)); await pause.wait(pending);
      const claimed = (await row(fixture.ref.workerId)).metadata.participant.kyc.processing, expiresAt = Date.parse(claimed.expiresAt);
      assert.equal(claimed.stages.ocr.state, 'DISPATCHED'); assert.ok(Number.isFinite(expiresAt));
      for (;;) {const now = (await query('SELECT clock_timestamp() AS now')).rows[0].now; if (now.getTime() >= expiresAt) break; await new Promise(resolve => setTimeout(resolve, 25));}
      assert.equal((await short.process(fixture.ref)).state, 'UNCERTAIN');
      assert.equal((await short.process(fixture.ref)).state, 'UNCERTAIN'); assert.equal(counts.syntheticOpenAi, before + 1);
      const receipts = (await query(`SELECT * FROM public."AuditLog" WHERE "entityId"=$1 AND action='participant.kyc.preanalysis'`, [fixture.ref.workerId])).rows;
      assert.equal(receipts.length, 1); assert.equal(receipts[0].metadata.status, 'UNCERTAIN');
      pause.release(); await assert.rejects(pending, {code: 'PARTICIPANT_ANALYSIS_LEASE_CHANGED'});
      assert.equal((await row(fixture.ref.workerId)).metadata.participant.kyc.processing.status, 'UNCERTAIN'); assert.deepEqual(await stable(fixture.ref), snapshot);
    });
    await check('signed-WhatsApp-three-image-capture-enqueues-current-v2-consent-once-with-original-issuer-and-no-account-or-field-grant', async () => {
      const tenant = {...lifecycleTenants[0], workerId: 'preanalysis-whatsapp-worker', channelId: 'preanalysis-whatsapp-channel'};
      const metadata = {siteRegister: {version: 1}, participant: {version: 1, status: 'INVITED', clerkUserId: null, permissions: {attendance: false, report: false},
        invitation: {id: 'invite_' + 'a'.repeat(32), state: 'SENT', email: 'preanalysis-invited@example.invalid', providerId: 'orginv_SyntheticPreanalysis', expiresAt: new Date(Date.now() + 86400000).toISOString()}, kyc: {version: 1, status: 'NOT_SUBMITTED'}}};
      await query(`INSERT INTO public."Worker"(id,"projectId",name,phone,role,active,metadata) VALUES($1,$2,'Synthetic WhatsApp capture',$3,'WORKER',true,$4::jsonb)`, [tenant.workerId, tenant.projectId, '+' + tenant.sender, JSON.stringify(metadata)]);
      const channelMetadata = {credentialFormat: 'tenant-aad-v2', credentialOrganizationId: tenant.organizationId, customerSubscribed: true, customerActivation: {version: 1, state: 'ACTIVE', actorId: tenant.ownerId}, customerVerification: {registered: true, scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'], expiresAt: null}};
      const token = encryptCustomerSecret(tenant.token, {organizationId: tenant.organizationId, projectId: tenant.projectId, purpose: 'access-token', resourceId: tenant.phoneNumberId}, nativeEnvironment);
      await query(`INSERT INTO public."WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken",metadata) VALUES($1,$2,true,'CONNECTED',$3,$4,$5,$6::jsonb)`, [tenant.channelId, tenant.projectId, tenant.phoneNumberId, tenant.wabaId, token, JSON.stringify(channelMetadata)]);
      const graph = createControlledLifecycleGraph(nativeEnvironment); graph.assets.get('a').registered = true; graph.assets.get('a').subscribed = true;
      const mediaIds = ['150000021', '150000022', '150000023'];
      const mediaBytes = mediaIds.map((_, index) => ownQualitySource(['DOCUMENT_FRONT', 'DOCUMENT_BACK', 'SELFIE'][index], Buffer.concat([lifecyclePng, Buffer.from('synthetic-whatsapp-identity-image-' + index)])));
      mediaIds.forEach((mediaId, index) => graph.addMedia('a', mediaId, mediaBytes[index]));
      const provider = createMetaCustomerProvider({environment: nativeEnvironment, fetchImpl: graph.fetchImpl});
      const channelUpload = createParticipantChannelKycUploader({get, put: blob.put, environment: () => nativeEnvironment});
      const deposit = createParticipantChannelKycDeposit({connect, resolveAuthority: resolveMetaKycAuthority, upload: channelUpload, assessCaptureQuality, environment: nativeEnvironment});
      const bridge = createMetaKycBridge({connect, provider, deposit, environment: nativeEnvironment, scheduleAnalysis: ref => whatsappWakeups.push(ref)});
      const outbound = createMetaKycOutbound({connect, provider, environment: nativeEnvironment});
      const processor = createMetaCustomerProcessor({connect, environment: nativeEnvironment, authorizationCodes: META_KYC_AUTHORIZATION_CODES,
        dispatch: context => bridge.execute(context), outbound: {send: (context, reply, {purpose}) => outbound.send(context, reply, {purpose})}});
      const callback = createMetaCustomerCallbackHandlers({inbox: createMetaCustomerInbox({connect, environment: nativeEnvironment}), environment: nativeEnvironment, schedule: () => {}});
      // The INVITED/PENDING_ACCOUNT_CLAIM oracle is an already-issued historical v2 challenge, not v3 coverage.
      const code = await customerJobTransaction(connect, async client => prepareHistoricalV2Challenge(client,
        {actorId: tenant.ownerId, membershipId: 'owner-member-a', organizationId: tenant.organizationId, role: 'ADMIN'},
        {id: tenant.projectId, organizationId: tenant.organizationId}, {workerId: tenant.workerId, revision: (await row(tenant.workerId)).revision, operationId: randomUUID()}));
      let sequence = 0;
      async function receive(message) {
        const value = {id: 'wamid.SyntheticPreanalysis_' + randomUUID().replaceAll('-', ''), from: tenant.sender, timestamp: String(Math.floor(Date.now() / 1000) - 60 + ++sequence),
          ...(typeof message === 'string' ? {type: 'text', text: {body: message}} : message)};
        const payload = {object: 'whatsapp_business_account', entry: [{id: tenant.wabaId, changes: [{field: 'messages', value: {metadata: {phone_number_id: tenant.phoneNumberId}, messages: [value]}}]}]}, wire = JSON.stringify(payload);
        const response = await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback', {method: 'POST', headers: {'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=' + createHmac('sha256', nativeEnvironment.META_APP_SECRET).update(wire).digest('hex')}, body: wire}));
        assert.equal(response.status, 200); const eventId = 'customer_webhook_' + splitMetaCustomerEvents(payload)[0].externalId;
        const result = await processor.process(eventId), reply = graph.messages.get(customerOutboundId(eventId))?.body; return {eventId, result, reply};
      }
      const choose = async (last, title) => {const choice = last.reply?.interactive?.action.sections.flatMap(section => section.rows).find(value => value.title === title); assert.ok(choice, title); return receive({type: 'interactive', interactive: {type: 'list_reply', list_reply: {id: choice.id, title: choice.title}}});};
      const rolesBeforeCapture = await roleSnapshot();
      let last = await receive(code.code);
      for (const title of ['Autorizar imágenes', 'Autorizar dorso', 'Con lectura asistida', 'Con comparación facial']) last = await choose(last, title);
      for (const mediaId of mediaIds) last = await receive({type: 'image', image: {id: mediaId, mime_type: 'image/png'}});
      last = await choose(last, 'Guardar identidad'); assert.equal(last.result.businessApplied, true);
      const worker = await row(tenant.workerId), ref = refOf(worker), snapshot = await stable(ref), wakes = whatsappWakeups.length;
      assert.equal(worker.metadata.participant.status, 'INVITED'); assert.equal(worker.metadata.participant.kyc.status, 'PENDING_ACCOUNT_CLAIM');
      assert.equal(worker.metadata.participant.clerkUserId, null); assert.deepEqual(worker.metadata.participant.permissions, {attendance: false, report: false});
      assert.equal(await roleSnapshot(), rolesBeforeCapture);
      assert.equal(worker.metadata.participant.kyc.images.length, 3); assert.equal(worker.metadata.participant.kyc.processing.status, 'QUEUED');
      assert.equal(worker.metadata.participant.kyc.processing.auto.sourceActorId, tenant.ownerId); assert.equal(wakes, 1);
      assert.deepEqual(whatsappWakeups[0], ref);
      for (const [id, index] of [['document-front', 0], ['document-back', 1], ['selfie', 2]]) assert.equal(worker.metadata.participant.kyc.images.find(value => value.id === id)?.sha256, sha(mediaBytes[index]));
      const before = {...counts}; assert.equal((await service.process(ref)).state, 'EXTRACTED_UNVERIFIED'); assert.deepEqual(await stable(ref), snapshot);
      assert.equal(counts.privateReads - before.privateReads, 2); assert.equal(counts.syntheticOpenAi - before.syntheticOpenAi, 1); assert.equal(counts.syntheticBiometric - before.syntheticBiometric, 1);
      assert.equal((await row(tenant.workerId)).metadata.participant.clerkUserId, null); assert.deepEqual((await row(tenant.workerId)).metadata.participant.permissions, {attendance: false, report: false});
      assert.equal(await roleSnapshot(), rolesBeforeCapture);
      const sent = graph.assets.get('a').sends, analyzed = counts.syntheticOpenAi;
      await processor.process(last.eventId); assert.equal(whatsappWakeups.length, wakes); assert.deepEqual(graph.unexpected, []);
      assert.equal(graph.assets.get('a').sends, sent); assert.equal(counts.syntheticOpenAi, analyzed); assert.deepEqual(await stable(ref), snapshot);
    });
    await check('only-technical-preanalysis-and-usage-records-are-created-no-review-permission-attendance-or-task-effect', async () => {
      assert.equal((await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE metadata->>'kind' IN ('REVIEW_KYC','FIELD_PERMISSIONS_CHANGED','INVITATION_ACCEPTED')`)).rows[0].n, 0);
      for (const table of ['Task', 'AttendanceEntry', 'OperationalProposal', 'Incident']) assert.equal((await query('SELECT count(*)::int AS n FROM public."' + table + '"')).rows[0].n, 0);
      assert.equal((await query(`SELECT count(*)::int AS n FROM public."Worker" WHERE metadata->'participant'->'kyc'->>'status'='APPROVED'`)).rows[0].n, 0);
      assert.equal(counts.unexpectedNetwork, 0); assert.deepEqual(sqlFailures, []);
    });
    assert.deepEqual(checks, PARTICIPANT_KYC_PREANALYSIS_CHECKS);
  } catch (error) {
    failure = {code: /^[A-Z0-9_]{2,90}$/.test(error.code || '') ? error.code : 'KYC_PREANALYSIS_NATIVE_UNCONFIRMED', name: error.name,
      locations: String(error.stack || '').split('\n').filter(line => line.includes(root) || line.includes('src/lib/')).slice(0, 6)};
  } finally {
    for (const release of releases) release(); releases.clear(); await Promise.allSettled([...inFlight]);
    globalThis.fetch = originalFetch;
    try {
      if (pool) {await closeDisposablePool(pool); cleanup.poolClosed = true;}
      if (created) {
        assert.match(database, databasePattern); assert.notEqual(database, 'obrasaas_cutover_ci');
        const current = (await admin.query(`SELECT d.oid,d.datname,pg_get_userbyid(d.datdba) AS owner FROM pg_database d WHERE d.datname=$1`, [database])).rows[0];
        assert.equal(current?.oid, ownedOid); assert.equal(current?.datname, ownership.datname); assert.equal(current?.owner, ownership.owner);
        cleanup.ownSessionsBeforeDrop = (await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1', [database])).rows[0].n;
        assert.equal(cleanup.ownSessionsBeforeDrop, 0); await admin.query('DROP DATABASE "' + database + '"');
        cleanup.databaseRemoved = (await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [database])).rows.length === 0;
      }
    } catch (error) {
      cleanup.failureCode = /^[A-Z0-9_]{2,90}$/.test(error.code || '') ? error.code : 'KYC_PREANALYSIS_CLEANUP_UNCONFIRMED';
      failure ||= {code: cleanup.failureCode, name: error.name};
    } finally {
      try {await admin.end(); cleanup.adminClosed = true;} catch {failure ||= {code: 'KYC_PREANALYSIS_ADMIN_CLOSE_UNCONFIRMED', name: 'Error'};}
      try {cleanup.sourceBytesUnchanged = digest(participantPreanalysisSourceManifest()) === sourceDigest;} catch {cleanup.sourceBytesUnchanged = false;}
    }
  }
  const blobManifest = blobSnapshot();
  if (!cleanup.sourceBytesUnchanged) failure ||= {code: 'KYC_PREANALYSIS_NATIVE_SOURCE_CHANGED', name: 'Error'};
  if (created && !cleanup.databaseRemoved) failure ||= {code: 'KYC_PREANALYSIS_DATABASE_CLEANUP_UNCONFIRMED', name: 'Error'};
  return {version: 1, status: failure ? 'FAIL' : 'PASS', startedAt, finishedAt: new Date().toISOString(), postgresExecuted: Boolean(engine),
    engine, ownership, ownedConnectionPids: [...observedPids].sort((a, b) => a - b), checks, completedCheckCount: checks.length, failure: failure ? {...failure, check: activeCheck} : null,
    sourceManifest: sources, sourceDigest, harnessSha256: sha(readFileSync(fileURLToPath(import.meta.url))), blobManifest, cleanup, sqlFailures, lockObservations, counts,
    providerRequests: 0, productionDataWritten: false, realConsentOrIdentityVerified: false, humanApprovalPerformed: false,
    leaseFixtures: {normalServiceMs: 150000, expiryOnlyFixtureMs: 1000, sqlClockObservedBeforeRelease: true, productionLeaseConfigurationChanged: false},
    boundary: 'Owned random local PostgreSQL 17 child database; real canonical public SQL, web handlers and signed WhatsApp pipeline; generated pixels and closed AI/Graph/Blob transports only'};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--guard-self-test') console.log(JSON.stringify(participantPreanalysisTargetSelfTest()));
  else {
    assert.deepEqual(args, [], 'Only --guard-self-test or a native run is supported');
    const output = path.join(root, '.vercel/private/participant-kyc-preanalysis-evidence'); mkdirSync(output, {recursive: true});
    const proofPath = path.join(output, 'native-' + new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID().replaceAll('-', '') + '.json');
    verifyParticipantKycPreanalysisPostgres().then(proof => {writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', {flag: 'wx'});
      console.log(JSON.stringify({status: proof.status, completedCheckCount: proof.completedCheckCount, failure: proof.failure, cleanup: proof.cleanup, proofPath})); if (proof.status !== 'PASS') process.exitCode = 1;
    }).catch(error => {writeFileSync(proofPath, JSON.stringify({status: 'FAIL', code: error.code || 'KYC_PREANALYSIS_TARGET_OR_CLEANUP_UNCONFIRMED', postgresAcceptanceClaimed: false}, null, 2) + '\n', {flag: 'wx'}); console.error(error.code || 'KYC_PREANALYSIS_TARGET_OR_CLEANUP_UNCONFIRMED'); process.exitCode = 1;});
  }
}
