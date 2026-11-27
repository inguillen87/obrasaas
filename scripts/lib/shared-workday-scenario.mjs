import assert from 'node:assert/strict';
import { randomUUID, createHmac, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isIPv4 } from 'node:net';
import { Client, Pool } from 'pg';
import { trackDisposablePool, closeDisposablePool } from './disposable-postgres-cleanup.mjs';
import { COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL } from './company-channel-disposable-fixture.mjs';
import { createCanonicalParticipantKycFixture } from '../fixtures/canonical-participant-kyc.mjs';
import { createControlledLifecycleBlob, lifecycleDisposableUrl, lifecycleEnvironment } from '../fixtures/meta-signup-field-lifecycle-fixture.mjs';
import { createWorkspaceStore } from '../../src/lib/workspace-store.mjs';
import { createWorkspaceHandlers } from '../../src/lib/workspace-http.mjs';
import { createFieldOperations } from '../../src/lib/field-operations-store.mjs';
import { createFieldHandlers, createFieldMediaHandlers } from '../../src/lib/field-operations-http.mjs';
import { createFieldMedia } from '../../src/lib/field-media.mjs';
import { createWorkerChannelStore } from '../../src/lib/worker-channel-identity.mjs';
import { createMetaCustomerInbox, createMetaCustomerCallbackHandlers, splitMetaCustomerEvents } from '../../src/lib/meta-customer-callback.mjs';
import { createMetaCustomerProcessor } from '../../src/lib/meta-customer-processing.mjs';
import { customerReplyMessage } from '../../src/lib/meta-customer-provider.mjs';
import { createMetaFieldBridge } from '../../src/lib/meta-field-bridge.mjs';
import { encryptCustomerSecret } from '../../src/lib/meta-customer-credentials.mjs';

export function expectedDatabaseHosts(url, environment = process.env, inspect = execFileSync) {
  const { GITHUB_ACTIONS, GITHUB_JOB, GITHUB_WORKFLOW, WORKDAY_POSTGRES_SERVICE_ID: serviceId, WORKDAY_POSTGRES_NETWORK: network } = environment;
  const workdayJob = GITHUB_ACTIONS === 'true' && GITHUB_JOB === 'workday' && GITHUB_WORKFLOW === 'Shared construction workday';
  if (!serviceId && !network && !workdayJob) return ['127.0.0.1/32', '::1/128'];

  assert.ok(workdayJob, 'PostgreSQL service context requires the shared workday job');
  assert.equal(url.href, 'postgresql://cutover_test@127.0.0.1:6549/obrasaas_cutover_ci');
  assert.match(serviceId, /^[0-9a-f]{64}$/);
  assert.match(network, /^github_network_[0-9a-f]{32}$/);
  // Read only the network and port metadata of the runner's own service.
  const format = '{{json .NetworkSettings.Networks}}\n{{json .NetworkSettings.Ports}}';
  const inspected = inspect('/usr/bin/docker', ['--host=unix:///var/run/docker.sock', 'inspect', '--type=container', '--format', format, serviceId], { encoding: 'utf8' });
  const [networks, ports] = inspected.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(ports['5432/tcp'], [{ HostIp: '127.0.0.1', HostPort: '6549' }]);
  const address = networks[network]?.IPAddress;
  assert.ok(isIPv4(address), 'Missing PostgreSQL address on the job network');
  return [address + '/32'];
}

// Allocate an exclusively owned database. Shared services may host other suites.
export async function runSharedWorkday({
  jpeg,
  captureInventory,
  approveConsumption,
  approveProgress
}) {
  const url = lifecycleDisposableUrl(process.env);
  const expectedHosts = expectedDatabaseHosts(url);
  const database = 'obrasaas_shared_workday_' + randomUUID().replaceAll('-', '');
  const admin = new Client({
    connectionString: url.href,
    connectionTimeoutMillis: 5000
  });
  await admin.connect();
  let pool,
    created = false;
  try {
    const target = (await admin.query('SELECT current_database() db, inet_server_addr()::text host')).rows[0];
    assert.equal(target.db, 'obrasaas_cutover_ci');
    assert.ok(expectedHosts.includes(target.host), 'Unexpected PostgreSQL server address');
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    const owned = new URL(url);
    owned.pathname = '/' + database;
    pool = trackDisposablePool(new Pool({
      connectionString: owned.href,
      max: 8,
      connectionTimeoutMillis: 5000
    }));
    return await exercise({
      pool,
      database,
      databaseHost: target.host,
      jpeg,
      captureInventory,
      approveConsumption,
      approveProgress
    });
  } finally {
    try {
      await closeDisposablePool(pool);
      if (created) await admin.query(`DROP DATABASE "${database}"`);
    } finally {
      await admin.end();
    }
  }
}
async function exercise({
  pool,
  database,
  databaseHost,
  jpeg,
  captureInventory,
  approveConsumption,
  approveProgress
}) {
  const query = (...args) => pool.query(...args);
  const connect = () => pool.connect();
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8'
  }).trim();
  assert.ok(jpeg.length <= 2097152 && jpeg.readUInt16BE(0) === 0xffd8);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const originalFetch = globalThis.fetch;
  let networkAttempts = 0,
    downloads = 0;
  globalThis.fetch = async () => {
    networkAttempts++;
    throw Error('External HTTP unavailable in this exercise');
  };
  const started = performance.now(),
    steps = [],
    messages = [];
  const mark = (step, details = {}) => steps.push({
    step,
    elapsedMs: Math.round(performance.now() - started),
    ...details
  });
  const session = (userId, organizationId = 'org_A', organizationRole = 'org:member') => ({
    authenticated: true,
    verification: 'clerk-production-jwt',
    userId,
    organizationId,
    organizationRole
  });
  const owner = session('user_Owner', 'org_A', 'org:admin'),
    worker = session('user_Person'),
    director = session('user_Director'),
    foreign = session('user_Foreign', 'org_B', 'org:admin');
  const workspace = createWorkspaceStore({
      connect
    }),
    field = createFieldOperations({
      workspace
    });
  const origin = 'https://obrasaas.com',
    ctx = new Map();
  const environment = {
    ...lifecycleEnvironment
  };
  const blob = createControlledLifecycleBlob();
  const analyzer = {
    analyzePhoto() {
      assert.fail('Worker chose save only');
    }
  };
  const media = createFieldMedia({
    analyzer,
    operations: field,
    put: blob.put,
    get: blob.get,
    environment: () => environment
  });
  const provider = {
    async downloadMedia(input) {
      assert.equal(input.phoneNumberId, '120000001');
      assert.equal(input.mediaId, '150000101');
      assert.equal(input.token, 'synthetic-local-field');
      downloads++;
      return {
        bytes: jpeg,
        contentType: 'image/jpeg'
      };
    }
  };
  const bridge = createMetaFieldBridge({
    analyzer,
    connect,
    environment,
    provider,
    put: blob.put,
    get: blob.get
  });
  const inbox = createMetaCustomerInbox({
      connect,
      environment
    }),
    callback = createMetaCustomerCallbackHandlers({
      inbox,
      environment
    });
  const dispatches = new Map();
  const processor = createMetaCustomerProcessor({
    connect,
    environment,
    dispatch: async context => {
      const result = await bridge.execute(context);
      dispatches.set(context.eventId, result);
      return result;
    },
    outbound: {
      send: async () => ({
        replySent: false,
        state: 'SYNTHETIC_NOT_SENT'
      })
    }
  });
  const context = actor => ctx.get(actor.userId);
  const project = 'project-a',
    task = 'task-a',
    sector = 'sector-a',
    workerId = 'worker-a';
  const taskTitle = 'Muro de planta baja',
    sectorTitle = 'Entrada del personal por el sector Sur desde el pasillo central de planta baja',
    northEntrance = 'Entrada del personal por el sector Norte desde el pasillo central de planta baja',
    materialTitle = 'Cemento';
  async function web(actor, route, method = 'GET', input = {}, expected = 200) {
    const verify = async () => actor;
    const api = route === 'field-operations' ? createFieldHandlers({
      verify,
      operations: field
    }) : route === 'field-media' ? createFieldMediaHandlers({
      verify,
      media
    }) : createWorkspaceHandlers({
      verify,
      store: workspace
    });
    const request = new Request(origin + '/api/identity/' + route + (method === 'GET' ? '?' + new URLSearchParams(input) : ''), {
      method,
      headers: {
        origin,
        'content-type': 'application/json'
      },
      ...(method === 'POST' ? {
        body: JSON.stringify(input)
      } : {})
    });
    const response = await api[method](request);
    assert.equal(response.status, expected, response.status === expected ? '' : await response.clone().text());
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    return response;
  }
  const read = async (actor = owner) => (await web(actor, 'field-operations', 'GET', context(actor))).json();
  const payload = (actor, action, fields) => ({
    ...context(actor),
    action,
    operationId: randomUUID(),
    payload: fields
  });
  const post = async (actor, command) => (await web(actor, 'field-operations', 'POST', command)).json();
  const save = (actor, action, fields) => post(actor, payload(actor, action, fields));
  const taskProgress = async () => (await (await web(owner, 'workspace', 'GET', context(owner))).json()).tasks.find(t => t.id === task).progress;
  async function receive(wire) {
    const signature = 'sha256=' + createHmac('sha256', environment.META_APP_SECRET).update(wire).digest('hex');
    const ack = await callback.POST(new Request(origin + '/api/meta/customer-callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature
      },
      body: wire
    }));
    assert.equal(ack.status, 200);
    assert.equal((await ack.json()).durable, true);
    const eventId = 'customer_webhook_' + splitMetaCustomerEvents(JSON.parse(wire))[0].externalId;
    await processor.process(eventId);
    return eventId;
  }
  async function send(message, label) {
    const value = {
      id: 'wamid.' + randomUUID().replaceAll('-', ''),
      from: '5491100001111',
      timestamp: String(Math.floor(Date.now() / 1000)),
      ...(typeof message === 'string' ? {
        type: 'text',
        text: {
          body: message
        }
      } : message)
    };
    const wire = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        id: '130000001',
        changes: [{
          field: 'messages',
          value: {
            metadata: {
              phone_number_id: '120000001'
            },
            messages: [value]
          }
        }]
      }]
    });
    const eventId = await receive(wire),
      result = dispatches.get(eventId);
    assert.ok(result, 'No dispatch for ' + (label ?? value.type));
    const choiceTitles = result.reply?.sections?.flatMap(s => s.rows.map(r => r.title)) ?? [];
    messages.push({
      operation: label ?? (typeof message === 'string' ? message : message.type),
      response: result.reply?.body ?? null,
      choices: choiceTitles,
      kind: result.kind
    });
    return {
      result,
      eventId,
      wire
    };
  }
  async function choose(prior, title) {
    const message = customerReplyMessage(prior.result.reply);
    const rows = message.interactive.action.sections.flatMap(s => s.rows);
    if (title === sectorTitle) {
      const north = rows.filter(row => /\bNorte\b/iu.test([row.title, row.description].join(' ')));
      assert.equal(north.length, 1,
        'Expected one visible Norte entrance in the synthetic menu: ' + JSON.stringify(rows.map(({title, description}) => ({title, description}))));
    }
    const matches = title === sectorTitle
      ? rows.filter(row => /\bSur\b/iu.test([row.title, row.description].join(' ')))
      : rows.filter(row => row.title === title || row.description === title);
    assert.equal(matches.length, 1, 'Expected one visible choice matching ' + title);
    const [row] = matches;
    return send({
      type: 'interactive',
      interactive: {
        type: 'list_reply',
        list_reply: {
          id: row.id,
          title: row.title
        }
      }
    }, title);
  }
  async function attendance(command) {
    let step = await send(command);
    step = await choose(step, sectorTitle);
    step = await choose(step, 'Continuar');
    step = await send({
      type: 'location',
      location: {
        latitude: 0,
        longitude: 0
      }
    }, 'Ubicación sintética');
    step = await choose(step, 'Guardar');
    assert.equal(step.result.kind, 'ATTENDANCE');
    return step;
  }
  async function counts() {
    const row = (await query(`SELECT (SELECT count(*)::int FROM "Incident" WHERE metadata->'fieldOperations'->>'kind'='EVIDENCE') AS evidence,
 (SELECT count(*)::int FROM "OperationalProposal") AS proposals,(SELECT count(*)::int FROM "AttendanceEntry") AS attendance,
 (SELECT count(*)::int FROM "AuditLog" WHERE action='material.inventory.moved') AS movements,
 (SELECT count(*)::int FROM "WebhookEvent") AS webhooks,(SELECT count(*)::int FROM "AuditLog" WHERE action IN ('field.operation.recorded','field.media.recorded','meta.field.dispatched')) AS receipts`)).rows[0];
    return {
      ...row,
      downloads,
      puts: blob.puts(),
      progress: await taskProgress(),
      balance: (await read()).inventory.materials[0].balance
    };
  }
  try {
    const db = (await query('SELECT current_database() db,inet_server_addr()::text host')).rows[0];
    assert.equal(db.db, database);
    assert.equal(db.host, databaseHost);
    assert.equal((await query("SELECT to_regclass('public.\"Project\"') AS existing")).rows[0].existing, null);
    await query(COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL);
    await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('director','user_Director','director@example.invalid');
 INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES('director-m','director','org-a','DIRECTOR','org:member','ACTIVE');
 INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES('owner-pm','project-a','owner-m','ACTIVE'),('director-pm','project-a','director-m','ACTIVE')`);
    await query('UPDATE "Task" SET title=$1 WHERE id=$2', [taskTitle, task]);
    for (const actor of [owner, worker, director, foreign]) ctx.set(actor.userId, {
      projectId: actor === foreign ? 'project-b' : project,
      scope: (await workspace.list(actor)).scope
    });
    for (const [id, actor, phone] of [[workerId, worker, '+5491100001111'], ['worker-owner', owner, '+5491100002222'], ['worker-director', director, '+5491100003333']]) {
      const profile = {
        siteRegister: {
          version: 1,
          job: 'WORKER',
          source: 'responsible-entry',
          identityStatus: 'UNVERIFIED',
          channelVerified: false
        },
        participant: {
          version: 1,
          status: 'ACTIVE',
          clerkUserId: actor.userId,
          permissions: {
            attendance: true,
            report: true
          },
          invitation: null,
          kyc: {
            version: 1,
            status: 'NOT_SUBMITTED'
          }
        }
      };
      await query('INSERT INTO "Worker"(id,"projectId",name,phone,active,metadata) VALUES($1,$2,$1,$3,true,$4::jsonb)', [id, project, phone, JSON.stringify(profile)]);
    }
    const kyc = createCanonicalParticipantKycFixture({
      workspace,
      connect,
      query
    });
    for (const [id, actor, reviewer] of [['worker-director', director, owner], ['worker-owner', owner, director], [workerId, worker, owner]]) await kyc.approve({
      projectId: project,
      workerId: id,
      actor,
      reviewer
    });
    const first = await read();
    await save(owner, 'CONFIGURE_SITE', {
      revision: first.projectRevision,
      sectors: [{
        id: 'north-access',
        name: northEntrance,
        latitude: 0.01,
        longitude: 0,
        radius: 100
      }, {
        id: sector,
        name: sectorTitle,
        latitude: 0,
        longitude: 0,
        radius: 100
      }]
    });
    const view = await read();
    const added = await save(owner, 'ADD_MATERIAL', {
      revision: view.projectRevision,
      catalogHash: view.inventory.catalogHash,
      name: materialTitle,
      unit: 'bolsa'
    });
    const materialId = added.material.id;
    const inv = async () => (await read()).inventory;
    const opening = await save(owner, 'PROPOSE_STOCK_ADJUSTMENT', {
      materialId,
      catalogHash: (await inv()).catalogHash,
      quantity: '20.000',
      direction: 'IN',
      source: {
        type: 'OPENING',
        reference: 'Recuento inicial de laboratorio'
      },
      reason: 'Veinte bolsas iniciales para la jornada simulada.'
    });
    await save(director, 'DECIDE_STOCK_ADJUSTMENT', {
      proposalId: opening.adjustment.id,
      revision: opening.adjustment.revision,
      catalogHash: (await inv()).catalogHash,
      decision: 'APPROVE',
      reason: 'Recuento inicial revisado en la simulación.'
    });
    assert.equal((await inv()).materials[0].balance, '20.000');
    mark('Configuración web y stock inicial', {
      stockBolsas: 20,
      actoresConKycSintetico: kyc.records.length
    });
    const encrypted = encryptCustomerSecret('synthetic-local-field', {
      organizationId: 'org-a',
      projectId: project,
      purpose: 'access-token',
      resourceId: '120000001'
    }, environment);
    const settings = {
      credentialFormat: 'tenant-aad-v2',
      credentialOrganizationId: 'org-a',
      customerSubscribed: true,
      customerVerification: {
        registered: true,
        expiresAt: null,
        scopes: ['whatsapp_business_management', 'whatsapp_business_messaging']
      },
      customerActivation: {
        version: 1,
        state: 'ACTIVE',
        actorId: 'owner'
      }
    };
    await query(`INSERT INTO "WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken","displayPhoneNumber",metadata)
 VALUES('channel-a','project-a',true,'CONNECTED','120000001','130000001',$1,'+5491100009999',$2::jsonb)`, [encrypted, JSON.stringify(settings)]);
    const channels = createWorkerChannelStore({
        workspace
      }),
      record = (await channels.read(worker, context(worker))).records.find(r => r.workerId === workerId);
    const challenge = await channels.command(worker, payload(worker, 'REQUEST_CHALLENGE', {
      workerId,
      revision: record.revision
    }));
    const binding = await send(challenge.code, 'Vincular cuenta de laboratorio');
    assert.equal(binding.result.kind, 'CHANNEL_BOUND');
    mark('Vinculación de trabajador por callback firmado');
    const entry = await attendance('ENTRADA');
    const firstAttendance = (await read()).attendance[0];
    assert.equal(firstAttendance.eventType, 'CHECK_IN');
    assert.equal(firstAttendance.sectorId, sector);
    assert.equal(firstAttendance.verificationStatus, 'REVIEW_REQUIRED');
    mark('Entrada recibida por WhatsApp y visible en web', {
      estado: firstAttendance.verificationStatus,
      sectorElegido: sectorTitle
    });
    let step = await send('EVIDENCIA');
    step = await choose(step, taskTitle);
    step = await choose(step, sectorTitle);
    const reference = await send({
      type: 'image',
      image: {
        id: '150000101',
        mime_type: 'image/jpeg',
        caption: 'Muro de planta baja. Imagen de demostración de obra.'
      }
    }, 'Foto de demostración');
    assert.equal(reference.result.businessApplied, false);
    assert.equal(downloads, 0);
    assert.equal(blob.puts(), 0);
    const photo = await choose(reference, 'Sólo guardar');
    assert.equal(photo.result.kind, 'EVIDENCE');
    assert.equal(downloads, 1);
    assert.equal(blob.puts(), 1);
    const evidence = (await read()).evidence[0];
    assert.equal(evidence.workerId, workerId);
    assert.equal(evidence.taskId, task);
    assert.equal(evidence.sectorId, sector);
    const file = await web(owner, 'field-media', 'GET', {
      ...context(owner),
      evidenceId: evidence.id
    });
    assert.equal(file.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), jpeg);
    await web(foreign, 'field-media', 'GET', {
      ...context(foreign),
      projectId: project,
      evidenceId: evidence.id
    }, 404);
    mark('Foto guardada con consentimiento y descargada por la dirección', {
      bytes: jpeg.length,
      sha256: hash(jpeg),
      accesoOtraEmpresa: 404,
      descargasDeOrigen: downloads,
      escriturasDeArchivo: blob.puts()
    });
    const reviewCmd = payload(owner, 'REVIEW_EVIDENCE', {
      evidenceId: evidence.id,
      revision: evidence.revision,
      decision: 'APPROVE',
      reason: 'Revisión independiente de la foto sintética del muro.'
    });
    const reviewed = await post(owner, reviewCmd);
    assert.equal(reviewed.evidence.review.decision, 'APPROVE');
    mark('Revisión de la foto en la web');
    const scheduledTask = async () => (await query(`SELECT progress, to_char("startsAt",'YYYY-MM-DD') AS "startsOn",
      to_char("endsAt",'YYYY-MM-DD') AS "endsOn" FROM "Task" WHERE id=$1 AND "projectId"=$2`, [task, project])).rows[0];
    const originalSchedule = await scheduledTask();
    assert.deepEqual(originalSchedule, {progress: 0, startsOn: '2026-10-01', endsOn: '2026-10-10'});
    step = await send('AVANCE');
    step = await choose(step, taskTitle);
    step = await choose(step, sectorTitle);
    step = await send('25%');
    step = await choose(step, evidence.title);
    step = await send('Avance acumulado del muro declarado en el laboratorio.');
    const proposed = await choose(step, 'Guardar');
    assert.equal(proposed.result.kind, 'PROGRESS_PROPOSAL');
    assert.equal(await taskProgress(), 0);
    const source = (await query(`SELECT metadata->'outcome'->'proposal'->>'id' AS id FROM "AuditLog"
      WHERE id=$1 AND "entityId"=$2 AND action='field.operation.recorded'`, [proposed.result.receiptId, project])).rows[0];
    const proposal = (await read()).proposals.find(row => row.id === source.id);
    assert.ok(proposal);
    assert.equal(proposal.status, 'PENDING');
    assert.equal(proposal.taskId, task);
    assert.equal(proposal.progress, 25);
    assert.deepEqual(await scheduledTask(), originalSchedule);
    const links = await (await web(owner, 'field-operations', 'GET', {
      ...context(owner),
      proposalId: proposal.id
    })).json();
    assert.deepEqual(links.evidence.map(row => row.id), [evidence.id]);
    assert.equal(links.evidence[0].review.decision, 'APPROVE');
    const progressReviewer = approveProgress ? director : owner;
    const progressPayload = {
      proposalId: proposal.id,
      revision: proposal.revision,
      decision: 'APPROVE',
      reason: 'Verificada la evidencia sintética asociada al avance declarado.'
    };
    const browserProgress = approveProgress && await approveProgress({
      web, director, scope: context(director), observer: owner, observerScope: context(owner), task,
      decisionPayload: progressPayload, proposalReceiptId: proposed.result.receiptId, originalSchedule
    });
    const approvalCmd = approveProgress ? browserProgress.command : payload(progressReviewer, 'DECIDE_PROGRESS', progressPayload);
    const decision = approveProgress ? browserProgress.response : await post(progressReviewer, approvalCmd);
    assert.equal(decision.proposal.id, proposal.id);
    assert.equal(decision.proposal.status, 'APPLIED');
    const recordedDecisions = await query(`SELECT id,"actorId" FROM "AuditLog" WHERE "entityId"=$1
      AND action='field.operation.recorded' AND metadata->>'command'='DECIDE_PROGRESS'
      AND metadata->'outcome'->'proposal'->>'id'=$2`, [project, proposal.id]);
    assert.deepEqual(recordedDecisions.rows, [{id: decision.receiptId, actorId: approveProgress ? 'director' : 'owner'}]);
    assert.equal(await taskProgress(), 25);
    assert.deepEqual(await scheduledTask(), {...originalSchedule, progress: 25});
    mark('Propuesta WhatsApp y aprobación web sobre la misma evidencia', {
      porcentajePendiente: 0,
      porcentajeAprobado: 25,
      mismaEvidencia: true
    });
    step = await send('CONSUMO');
    step = await choose(step, taskTitle);
    step = await choose(step, sectorTitle);
    step = await choose(step, materialTitle + ' · bolsa');
    step = await send('3');
    step = await send('Tres bolsas consumidas en el muro del laboratorio.');
    const consumption = await choose(step, 'Guardar');
    assert.equal(consumption.result.kind, 'CONSUMPTION_PROPOSAL');
    const pendingStock = await inv(),
      item = pendingStock.consumptions.find(r => r.proposalReceiptId === consumption.result.receiptId);
    assert.ok(item);
    assert.equal(item.taskId, task);
    assert.equal(pendingStock.materials[0].balance, '20.000');
    const decisionPayload = {
      proposalId: item.id,
      revision: item.revision,
      catalogHash: pendingStock.catalogHash,
      decision: 'APPROVE',
      reason: 'Tres bolsas verificadas por la dirección de obra de laboratorio.'
    };
    const browserDecision = approveConsumption && await approveConsumption({
      web, director, scope: context(director), decisionPayload, proposalReceiptId: consumption.result.receiptId
    });
    const consumptionCmd = approveConsumption ? browserDecision.command : payload(director, 'DECIDE_CONSUMPTION', decisionPayload);
    const approved = approveConsumption ? browserDecision.response : await post(director, consumptionCmd);
    assert.equal(approved.consumption.state, 'APPROVED');
    assert.equal((await inv()).materials[0].balance, '17.000');
    const movements = await query(`SELECT id, metadata FROM "AuditLog" WHERE action='material.inventory.moved'
      AND "entityId"=$1 AND metadata->>'proposalId'=$2`, [project, item.id]);
    assert.equal(movements.rowCount, 1);
    assert.equal(movements.rows[0].id, approved.consumption.decision.movementId);
    assert.equal(movements.rows[0].metadata.receiptId, approved.receiptId);
    assert.equal(movements.rows[0].metadata.direction, 'OUT');
    assert.equal(movements.rows[0].metadata.quantity, '3.000');
    assert.equal(movements.rows[0].metadata.balanceBefore, '20.000');
    assert.equal(movements.rows[0].metadata.balanceAfter, '17.000');
    const decisionReceipts = await query(`SELECT id FROM "AuditLog" WHERE action='field.operation.recorded'
      AND "entityId"=$1 AND metadata->>'command'='DECIDE_CONSUMPTION'
      AND metadata->'outcome'->'consumption'->>'id'=$2 AND "actorId"='director'`, [project, item.id]);
    assert.deepEqual(decisionReceipts.rows, [{id: approved.receiptId}]);
    assert.equal(await taskProgress(), 25);
    mark('Consumo WhatsApp y aprobación web', {
      saldoPendiente: 20,
      consumo: 3,
      saldoFinal: 17
    });
    const checkout = await attendance('SALIDA');
    const attendanceRows = (await read()).attendance;
    assert.deepEqual(attendanceRows.sort((a, b) => a.sequence - b.sequence).map(r => r.eventType), ['CHECK_IN', 'CHECK_OUT']);
    mark('Salida de la misma jornada', {
      marcas: attendanceRows.length
    });
    const before = await counts();
    for (const op of [entry, reference, photo, proposed, consumption, checkout]) assert.equal(await receive(op.wire), op.eventId);
    for (const [actor, cmd, receipt] of [[owner, reviewCmd, reviewed], [progressReviewer, approvalCmd, decision], [director, consumptionCmd, approved]]) {
      assert.equal((await post(actor, cmd)).receiptId, receipt.receiptId);
    }
    const after = await counts();
    assert.deepEqual(after, before);
    assert.deepEqual([before.evidence, before.proposals, before.attendance, before.movements, before.progress, before.balance], [1, 1, 2, 2, 25, '17.000']);
    assert.equal(networkAttempts, 0);
    mark('Reenvío de seis callbacks y tres decisiones web', {
      estadoIdéntico: true
    });
    const browserInventory = captureInventory ? await captureInventory({
      web,
      owner,
      context,
      expected: after,
      sourceRevision
    }) : null;
    if (browserInventory) {
      assert.deepEqual(await counts(), after);
      assert.equal(networkAttempts, 0);
      mark('Inventario consultado en Chromium sobre la misma base', {
        saldoBolsas: 17,
        movimientos: 2
      });
    }
    const status = await send('ESTADO');
    const history = await choose(status, 'Mis consumos');
    const materialRow = history.result.reply.sections.flatMap(section => section.rows)
      .find(row => row.title === materialTitle);
    assert.ok(materialRow);
    assert.ok(materialRow.description.startsWith('3 bolsa · Aprobado'));
    const detail = await choose(history, materialTitle);
    const feedback = detail.result.reply.body;
    assert.ok(feedback.includes('Estado vigente: Aprobado'));
    assert.ok(feedback.includes(consumptionCmd.payload.reason));
    assert.ok(feedback.includes(approved.receiptId));
    assert.ok(feedback.includes(consumption.result.receiptId));
    assert.equal(detail.result.businessApplied, false);
    assert.equal((await inv()).materials[0].balance, '17.000');
    assert.equal(await taskProgress(), 25);
    assert.equal(networkAttempts, 0);
    mark('El operario consultó en WhatsApp la decisión tomada en la web', {
      estado: 'Aprobado',
      reciboDePropuestaYDecision: true,
      saldoBolsas: 17
    });
    return {
      status: 'PASS',
      sourceRevision,
      timestamp: new Date().toISOString(),
      steps,
      messages,
      browserInventory,
      attendanceSector: {selectedLabel: sectorTitle, recordedId: firstAttendance.sectorId, verification: firstAttendance.verificationStatus},
      browserProgress: browserProgress?.proof ?? null,
      browserApproval: browserDecision ? {...browserDecision.proof, databaseOutflowsForProposal: movements.rowCount, databaseDecisionReceipts: decisionReceipts.rowCount} : null,
      outboundNetworkAttempts: networkAttempts,
      beforeReplay: before,
      afterReplay: after,
      elapsedMs: Math.round(performance.now() - started),
      boundaries: ['PostgreSQL local descartable y handlers HTTP reales llamados con Request/Response en proceso.', 'Verificador de sesión, imagen, blob privado y descarga Meta de laboratorio. Sin JWT real, teléfono, entrega Meta ni IA.', ...(browserDecision ? ['Dirección aprobó el consumo en el panel React de Chromium con la sesión sintética.'] : []), ...(browserInventory ? ['Chromium consultó por HTTP el inventario de esta jornada con el componente de producción y la sesión sintética.'] : []), 'Una declaración del 25 % y tres bolsas independientes. Entrada y salida ocurren en segundos, sin medir horas reales.']
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}
