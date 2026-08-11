import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';

const ACTOR_ROLES = Object.freeze({
  admin: 'ADMIN',
  director: 'DIRECTOR',
  siteManager: 'SITE_MANAGER',
  finance: 'FINANCE',
  auditor: 'AUDITOR',
});
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,13})\.\d{4}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const AMBIGUOUS_MUTATION_STATUSES = new Set([408, 425]);

function record(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`S92_E2E_FIXTURE_FILE: ${field} debe ser un objeto.`);
  }
  return value;
}

function text(value, field, { pattern = null } = {}) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new Error(`S92_E2E_FIXTURE_FILE: ${field} debe ser texto no vacío y normalizado.`);
  }
  if (pattern && !pattern.test(value)) {
    throw new Error(`S92_E2E_FIXTURE_FILE: ${field} no cumple el formato esperado.`);
  }
  return value;
}

function integer(value, field, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`S92_E2E_FIXTURE_FILE: ${field} debe ser un entero válido.`);
  }
  return value;
}

function assertNoSecretFields(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    const field = [...trail, key].join('.');
    if (/password|secret|private[_-]?key|testing[_-]?token/i.test(key)) {
      throw new Error(`S92_E2E_FIXTURE_FILE: ${field} no debe contener secretos.`);
    }
    assertNoSecretFields(nested, [...trail, key]);
  }
}

function civilFortnight(dateText) {
  if (!DATE_PATTERN.test(dateText)) {
    throw new Error('S92_E2E_FIXTURE_FILE: period.date debe usar YYYY-MM-DD.');
  }
  const [yearText, monthText, dayText] = dateText.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const monthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > monthDays) {
    throw new Error('S92_E2E_FIXTURE_FILE: period.date no es una fecha civil válida.');
  }
  const startDay = day <= 15 ? 1 : 16;
  const endDay = day <= 15 ? 15 : monthDays;
  const prefix = `${yearText}-${monthText}`;
  return {
    start: `${prefix}-${String(startDay).padStart(2, '0')}`,
    end: `${prefix}-${String(endDay).padStart(2, '0')}`,
  };
}

function actor(value, field, expectedRole) {
  const row = record(value, field);
  const parsed = {
    email: text(row.email, `${field}.email`),
    membershipId: text(row.membershipId, `${field}.membershipId`),
    expectedRole: text(row.expectedRole, `${field}.expectedRole`),
  };
  if (parsed.expectedRole !== expectedRole) {
    throw new Error(`S92_E2E_FIXTURE_FILE: ${field}.expectedRole debe ser ${expectedRole}.`);
  }
  return parsed;
}

function task(value, field) {
  const row = record(value, field);
  return {
    id: text(row.id, `${field}.id`),
    code: text(row.code, `${field}.code`),
    title: text(row.title, `${field}.title`),
    revision: integer(row.revision, `${field}.revision`),
    initialProgress: integer(row.initialProgress, `${field}.initialProgress`),
  };
}

function measurementPayload(value, field) {
  const row = record(value, field);
  return {
    unit: text(row.unit, `${field}.unit`),
    baselineQuantity: text(row.baselineQuantity, `${field}.baselineQuantity`, {
      pattern: DECIMAL_PATTERN,
    }),
    executedQuantity: text(row.executedQuantity, `${field}.executedQuantity`, {
      pattern: DECIMAL_PATTERN,
    }),
    method: text(row.method, `${field}.method`),
    rationale: text(row.rationale, `${field}.rationale`),
  };
}

function reviewPayload(value, field) {
  const row = record(value, field);
  const parsed = {
    decision: text(row.decision, `${field}.decision`),
    reason: text(row.reason, `${field}.reason`),
  };
  if (parsed.decision !== 'APPROVE' || parsed.reason.length < 5) {
    throw new Error(`S92_E2E_FIXTURE_FILE: ${field} debe aprobar con fundamento.`);
  }
  return parsed;
}

export function parseS92FixtureDescriptor(value) {
  const root = record(value, 'raíz');
  assertNoSecretFields(root);
  if (root.schemaVersion !== 1) {
    throw new Error('S92_E2E_FIXTURE_FILE: schemaVersion debe ser 1.');
  }

  const primary = record(root.primary, 'primary');
  const primaryProject = record(primary.project, 'primary.project');
  const primaryActors = record(primary.actors, 'primary.actors');
  const primaryTasks = record(primary.tasks, 'primary.tasks');
  const evidence = record(primary.evidence, 'primary.evidence');
  const otherTenant = record(root.otherTenant, 'otherTenant');
  const period = record(root.period, 'period');
  const payloads = record(root.payloads, 'payloads');
  const operationKeys = record(root.operationKeys, 'operationKeys');

  const parsedActors = Object.fromEntries(Object.entries(ACTOR_ROLES).map(([key, role]) => [
    key,
    actor(primaryActors[key], `primary.actors.${key}`, role),
  ]));
  const outsider = actor(otherTenant.admin, 'otherTenant.admin', 'ADMIN');
  const measuredTask = task(primaryTasks.measured, 'primary.tasks.measured');
  const missingTask = task(primaryTasks.missing, 'primary.tasks.missing');
  const expectedPeriod = civilFortnight(text(period.date, 'period.date'));
  const parsedPeriod = {
    date: period.date,
    start: text(period.start, 'period.start'),
    end: text(period.end, 'period.end'),
  };
  if (
    parsedPeriod.date !== parsedPeriod.start
    || parsedPeriod.start !== expectedPeriod.start
    || parsedPeriod.end !== expectedPeriod.end
  ) {
    throw new Error('S92_E2E_FIXTURE_FILE: period debe describir exactamente una quincena civil.');
  }

  const parsedEvidence = {
    id: text(evidence.id, 'primary.evidence.id'),
    taskId: text(evidence.taskId, 'primary.evidence.taskId'),
    status: text(evidence.status, 'primary.evidence.status'),
  };
  if (parsedEvidence.taskId !== measuredTask.id || parsedEvidence.status !== 'APPROVED') {
    throw new Error('S92_E2E_FIXTURE_FILE: la evidencia aprobada debe pertenecer a la tarea medida.');
  }
  if (measuredTask.id === missingTask.id) {
    throw new Error('S92_E2E_FIXTURE_FILE: las tareas medida y ausente deben ser distintas.');
  }

  const keys = Object.fromEntries([
    'measurementV1',
    'reviewV1',
    'cutV1',
    'measurementV2',
    'reviewV2',
    'cutV2',
  ].map((key) => [
    key,
    text(operationKeys[key], `operationKeys.${key}`, { pattern: IDEMPOTENCY_KEY_PATTERN }),
  ]));
  if (new Set(Object.values(keys)).size !== Object.keys(keys).length) {
    throw new Error('S92_E2E_FIXTURE_FILE: cada operación debe tener una Idempotency-Key distinta.');
  }

  const clerkOrganizationId = text(
    primary.clerkOrganizationId,
    'primary.clerkOrganizationId',
  );
  const databaseOrganizationId = text(
    primary.databaseOrganizationId,
    'primary.databaseOrganizationId',
  );
  const otherClerkOrganizationId = text(
    otherTenant.clerkOrganizationId,
    'otherTenant.clerkOrganizationId',
  );
  const otherDatabaseOrganizationId = text(
    otherTenant.databaseOrganizationId,
    'otherTenant.databaseOrganizationId',
  );
  const project = {
    id: text(primaryProject.id, 'primary.project.id'),
    name: text(primaryProject.name, 'primary.project.name'),
    slug: text(primaryProject.slug, 'primary.project.slug'),
    status: text(primaryProject.status, 'primary.project.status'),
  };
  const anchorProjectId = text(primary.anchorProjectId, 'primary.anchorProjectId');
  const otherAnchorProjectId = text(otherTenant.anchorProjectId, 'otherTenant.anchorProjectId');
  if (project.status !== 'ACTIVE' || project.id === anchorProjectId) {
    throw new Error('S92_E2E_FIXTURE_FILE: la obra fixture activa debe diferir de la obra ancla.');
  }
  if (
    clerkOrganizationId === otherClerkOrganizationId
    || databaseOrganizationId === otherDatabaseOrganizationId
  ) {
    throw new Error('S92_E2E_FIXTURE_FILE: tenant A y tenant B deben ser distintos.');
  }

  const identities = [...Object.values(parsedActors), outsider];
  if (
    new Set(identities.map(({ email }) => email.toLowerCase())).size !== identities.length
    || new Set(identities.map(({ membershipId }) => membershipId)).size !== identities.length
  ) {
    throw new Error('S92_E2E_FIXTURE_FILE: los seis actores deben tener identidades distintas.');
  }

  const measurementV1 = measurementPayload(payloads.measurementV1, 'payloads.measurementV1');
  const measurementV2 = measurementPayload(payloads.measurementV2, 'payloads.measurementV2');
  if (
    measurementV1.baselineQuantity !== measurementV2.baselineQuantity
    || measurementV1.unit !== measurementV2.unit
    || measurementV1.executedQuantity === measurementV2.executedQuantity
  ) {
    throw new Error('S92_E2E_FIXTURE_FILE: v2 debe corregir cantidad sin cambiar base ni unidad.');
  }

  return {
    schemaVersion: 1,
    fixtureId: text(root.fixtureId, 'fixtureId'),
    primary: {
      clerkOrganizationId,
      databaseOrganizationId,
      anchorProjectId,
      project,
      actors: parsedActors,
      tasks: { measured: measuredTask, missing: missingTask },
      evidence: parsedEvidence,
    },
    otherTenant: {
      clerkOrganizationId: otherClerkOrganizationId,
      databaseOrganizationId: otherDatabaseOrganizationId,
      anchorProjectId: otherAnchorProjectId,
      admin: outsider,
    },
    period: parsedPeriod,
    payloads: {
      measurementV1,
      reviewV1: reviewPayload(payloads.reviewV1, 'payloads.reviewV1'),
      measurementV2,
      reviewV2: reviewPayload(payloads.reviewV2, 'payloads.reviewV2'),
    },
    operationKeys: keys,
  };
}

export async function loadS92FixtureDescriptor(environment = process.env) {
  const configuredPath = environment.S92_E2E_FIXTURE_FILE;
  if (!configuredPath) {
    throw new Error('S92_E2E_FIXTURE_FILE es obligatorio para authenticated-s92.');
  }
  const fixturePath = path.resolve(configuredPath);
  let source;
  try {
    source = await readFile(fixturePath, 'utf8');
  } catch (error) {
    throw new Error(`No se pudo leer S92_E2E_FIXTURE_FILE (${error.code || 'READ_FAILED'}).`);
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('S92_E2E_FIXTURE_FILE no contiene JSON válido.');
  }
  return parseS92FixtureDescriptor(parsed);
}

export function requireS92DisposableTarget(baseURL, environment = process.env) {
  if (environment.S92_E2E_DISPOSABLE !== '1') {
    throw new Error('authenticated-s92 exige S92_E2E_DISPOSABLE=1 antes de cualquier sesión.');
  }
  let target;
  try {
    target = new URL(baseURL);
  } catch {
    throw new Error('authenticated-s92 exige un E2E_BASE_URL válido.');
  }
  const loopback = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (
    target.protocol !== 'http:'
    || !loopback.has(target.hostname)
    || target.port !== '3100'
    || target.username
    || target.password
    || target.pathname !== '/'
    || target.search
    || target.hash
  ) {
    throw new Error('authenticated-s92 sólo admite http loopback en el puerto 3100.');
  }
  return target.origin;
}

export async function sameOriginJson(page, pathname, init = {}) {
  return page.evaluate(async ({ requestInit, requestPath }) => {
    const response = await fetch(requestPath, {
      ...requestInit,
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const responseText = await response.text();
    let payload = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }
    return {
      headers: Object.fromEntries(response.headers.entries()),
      payload,
      status: response.status,
    };
  }, { requestInit: init, requestPath: pathname });
}

export async function openS92ActorSession(browser, {
  actor: actorFixture,
  baseURL,
  organizationId,
  projectId,
}) {
  const context = await browser.newContext({
    baseURL,
    colorScheme: 'dark',
    locale: 'es-AR',
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  try {
    await setupClerkTestingToken({ page });
    await page.goto('/sign-in');
    await clerk.signIn({ page, emailAddress: actorFixture.email });
    await page.waitForFunction(() => Boolean(window.Clerk?.session));
    await page.evaluate(async (clerkOrganizationId) => {
      await window.Clerk.setActive({ organization: clerkOrganizationId });
    }, organizationId);
    await page.waitForFunction(
      (clerkOrganizationId) => window.Clerk?.organization?.id === clerkOrganizationId,
      organizationId,
    );

    const selection = await sameOriginJson(page, '/api/projects', {
      body: JSON.stringify({ projectId }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });
    if (selection.status !== 200 || selection.payload?.activeProjectId !== projectId) {
      throw new Error(
        `No se pudo seleccionar la obra S9.2 para ${actorFixture.expectedRole} (${selection.status}).`,
      );
    }
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function postJsonOnce({
  body,
  operationKey,
  page,
  pathname,
}) {
  return sameOriginJson(page, pathname, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': operationKey,
    },
    method: 'POST',
  });
}

export async function postJsonOnceWithReconciliation({
  body,
  operationKey,
  page,
  pathname,
  reconcile,
}) {
  let response = null;
  let transportError = null;
  try {
    response = await postJsonOnce({ body, operationKey, page, pathname });
  } catch (error) {
    transportError = error;
  }
  if (
    !transportError
    && response
    && response.status < 500
    && !AMBIGUOUS_MUTATION_STATUSES.has(response.status)
  ) {
    return { ...response, reconciled: false };
  }

  const confirmation = await reconcile();
  if (!confirmation) {
    const marker = transportError?.message || `HTTP ${response?.status ?? 'sin respuesta'}`;
    throw new Error(`Resultado POST incierto y no confirmado por GET autoritativo: ${marker}`);
  }
  return {
    headers: response?.headers || {},
    payload: confirmation,
    reconciled: true,
    status: response?.status ?? null,
  };
}
