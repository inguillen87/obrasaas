import crypto from 'node:crypto';

import {
  createAppSecretProof,
  isValidMetaResourceId,
  MetaIntegrationError,
} from './embedded-signup.js';
import {
  getPublishedWhatsAppFlowReference,
  getWhatsAppFlowBlueprint,
} from './flows.js';

export const WHATSAPP_FLOW_TEMPLATE_LANGUAGE = 'es_AR';
export const WHATSAPP_FLOW_TEMPLATE_CATEGORY = 'UTILITY';
export const WHATSAPP_FLOW_TEMPLATE_PREFIX = 'obrasaas_';

const TEMPLATE_NAME_PATTERN = /^[a-z0-9_]{1,512}$/;
const SCREEN_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/;
const GRAPH_VERSION_PATTERN = /^v\d{1,3}\.\d{1,3}$/;
const TEMPLATE_STATUS_PATTERN = /^[A-Z_]{2,40}$/;
const TEMPLATE_LIST_PAGE_SIZE = 100;
const TEMPLATE_LIST_MAX_PAGES = 1_000;
const PAGING_CURSOR_MAX_BYTES = 4_096;
const TEMPLATE_GRAPH_FIELDS = [
  'id',
  'name',
  'status',
  'category',
  'language',
  'components',
  'rejected_reason',
].join(',');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value, name, max) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new MetaIntegrationError(`La plantilla de WhatsApp tiene un ${name} inv\u00e1lido.`, {
      code: 'WHATSAPP_TEMPLATE_INPUT_INVALID',
      status: 400,
    });
  }
  return normalized;
}

function graphConfig({ version, appSecret } = {}) {
  const resolvedVersion = String(version || process.env.META_GRAPH_API_VERSION || 'v25.0');
  const resolvedAppSecret = String(appSecret || process.env.META_APP_SECRET || '');
  if (!GRAPH_VERSION_PATTERN.test(resolvedVersion) || !resolvedAppSecret) {
    throw new MetaIntegrationError('La firma privada de Meta todav\u00eda no est\u00e1 habilitada.', {
      code: 'META_NOT_CONFIGURED',
      status: 503,
    });
  }
  return { version: resolvedVersion, appSecret: resolvedAppSecret };
}

function assertAccessToken(value) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 4_096) {
    throw new MetaIntegrationError('La conexi\u00f3n de WhatsApp no tiene un token activo.', {
      code: 'WHATSAPP_TOKEN_MISSING',
      status: 409,
    });
  }
  return value;
}

function assertConnection(connection) {
  const id = boundedText(connection?.id, 'identificador de conexi\u00f3n', 191);
  const whatsappBusinessId = String(connection?.whatsappBusinessId || '');
  if (!isValidMetaResourceId(whatsappBusinessId)) {
    throw new MetaIntegrationError('La conexi\u00f3n no tiene un WABA v\u00e1lido.', {
      code: 'WHATSAPP_TEMPLATE_WABA_INVALID',
      status: 409,
    });
  }
  return { id, whatsappBusinessId };
}

function normalizeLanguage(value) {
  return String(value || '').replace('-', '_');
}

function statusValue(value, fallback = 'PENDING') {
  const normalized = String(value || fallback).trim().toUpperCase();
  return TEMPLATE_STATUS_PATTERN.test(normalized) ? normalized : 'UNKNOWN';
}

function templateContentHash(content) {
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

function deterministicTemplateName({ connectionId, whatsappBusinessId, blueprintKey, contentSha256 }) {
  const slug = String(blueprintKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  if (!slug) {
    throw new MetaIntegrationError('El blueprint de WhatsApp Flow no es v\u00e1lido.', {
      code: 'FLOW_BLUEPRINT_NOT_FOUND',
      status: 400,
    });
  }
  const scope = crypto
    .createHash('sha256')
    .update(`${connectionId}:${whatsappBusinessId}`)
    .digest('hex')
    .slice(0, 10);
  const name = `${WHATSAPP_FLOW_TEMPLATE_PREFIX}${slug}_${scope}_${contentSha256.slice(0, 10)}`;
  if (!TEMPLATE_NAME_PATTERN.test(name)) {
    throw new MetaIntegrationError('No se pudo generar una identidad segura para la plantilla.', {
      code: 'WHATSAPP_TEMPLATE_IDENTITY_INVALID',
      status: 500,
    });
  }
  return name;
}

export function buildOwnedWhatsAppFlowTemplate({ connection, blueprintKey }) {
  const identity = assertConnection(connection);
  const blueprint = getWhatsAppFlowBlueprint(blueprintKey);
  const flow = getPublishedWhatsAppFlowReference(connection?.metadata, blueprintKey);
  if (!blueprint || !flow) {
    throw new MetaIntegrationError('Public\u00e1 y verific\u00e1 el WhatsApp Flow antes de crear su plantilla.', {
      code: 'WHATSAPP_TEMPLATE_FLOW_NOT_READY',
      status: 409,
    });
  }
  if (!isValidMetaResourceId(flow.id) || !SCREEN_ID_PATTERN.test(flow.screenId)) {
    throw new MetaIntegrationError('El WhatsApp Flow publicado tiene una identidad inv\u00e1lida.', {
      code: 'WHATSAPP_TEMPLATE_FLOW_INVALID',
      status: 409,
    });
  }

  const bodyText = boundedText(blueprint.message?.body, 'cuerpo', 1_024);
  const buttonText = boundedText(blueprint.message?.cta, 'bot\u00f3n', 25);
  const flowAction = flow.flowAction === 'data_exchange' ? 'data_exchange' : 'navigate';
  const content = {
    schema: 1,
    language: WHATSAPP_FLOW_TEMPLATE_LANGUAGE,
    category: WHATSAPP_FLOW_TEMPLATE_CATEGORY,
    blueprintKey: blueprint.key,
    bodyText,
    buttonText,
    flowId: String(flow.id),
    screenId: flow.screenId,
    flowAction,
  };
  const contentSha256 = templateContentHash(content);
  const name = deterministicTemplateName({
    connectionId: identity.id,
    whatsappBusinessId: identity.whatsappBusinessId,
    blueprintKey: blueprint.key,
    contentSha256,
  });
  const flowButton = {
    type: 'FLOW',
    text: buttonText,
    flow_id: String(flow.id),
    flow_action: flowAction,
    ...(flowAction === 'navigate' ? { navigate_screen: flow.screenId } : {}),
  };

  return {
    ...content,
    name,
    contentSha256,
    whatsappBusinessId: identity.whatsappBusinessId,
    components: [
      { type: 'BODY', text: bodyText },
      { type: 'BUTTONS', buttons: [flowButton] },
    ],
  };
}

function normalizeRemoteTemplate(value) {
  if (!isPlainObject(value)) return null;
  const id = String(value.id || '');
  const name = String(value.name || '');
  if (!isValidMetaResourceId(id) || !TEMPLATE_NAME_PATTERN.test(name)) return null;
  return {
    id,
    name,
    status: statusValue(value.status),
    category: statusValue(value.category, WHATSAPP_FLOW_TEMPLATE_CATEGORY),
    language: normalizeLanguage(value.language),
    components: Array.isArray(value.components) ? value.components : [],
    rejectedReason: value.rejected_reason
      ? String(value.rejected_reason).slice(0, 2_000)
      : null,
    raw: value,
  };
}

function remoteBody(components) {
  const component = components.find((item) => String(item?.type || '').toUpperCase() === 'BODY');
  return typeof component?.text === 'string' ? component.text.trim() : null;
}

function remoteFlowButton(components) {
  const component = components.find((item) => String(item?.type || '').toUpperCase() === 'BUTTONS');
  return Array.isArray(component?.buttons)
    ? component.buttons.find((item) => String(item?.type || '').toUpperCase() === 'FLOW') || null
    : null;
}

export function remoteTemplateMatchesDefinition(remote, definition) {
  if (!remote || !definition) return false;
  const button = remoteFlowButton(remote.components || []);
  if (!button) return false;
  const remoteAction = String(button.flow_action || 'navigate').toLowerCase();
  return remote.name === definition.name
    && normalizeLanguage(remote.language) === definition.language
    && remoteBody(remote.components) === definition.bodyText
    && String(button.text || '').trim() === definition.buttonText
    && String(button.flow_id || '') === definition.flowId
    && remoteAction === definition.flowAction
    && (
      definition.flowAction !== 'navigate'
      || String(button.navigate_screen || '') === definition.screenId
    );
}

async function parseGraphResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;
  const providerCode = Number(payload?.error?.code);
  throw new MetaIntegrationError(fallbackMessage, {
    code: Number.isSafeInteger(providerCode) ? `META_${providerCode}` : 'META_GRAPH_ERROR',
    status: response.status >= 400 && response.status < 500 ? 400 : 502,
  });
}

function messageTemplatesUrl({ whatsappBusinessId, accessToken, version, appSecret }) {
  const url = new URL(
    `https://graph.facebook.com/${version}/${whatsappBusinessId}/message_templates`,
  );
  url.searchParams.set('appsecret_proof', createAppSecretProof(accessToken, appSecret));
  return url;
}

function pagingCursor(payload) {
  if (typeof payload?.paging?.next !== 'string' || !payload.paging.next) return null;
  const direct = payload?.paging?.cursors?.after;
  let cursor = typeof direct === 'string' ? direct : '';
  if (!cursor) {
    try {
      const next = new URL(payload.paging.next);
      if (next.protocol === 'https:' && next.hostname === 'graph.facebook.com') {
        cursor = next.searchParams.get('after') || '';
      }
    } catch {
      return null;
    }
  }
  if (!cursor) return null;
  if (Buffer.byteLength(cursor, 'utf8') > PAGING_CURSOR_MAX_BYTES) {
    throw new MetaIntegrationError('Meta devolvi\u00f3 una paginaci\u00f3n de plantillas inv\u00e1lida.', {
      code: 'META_TEMPLATE_PAGING_INVALID',
      status: 502,
    });
  }
  return cursor;
}

export async function listWhatsAppMessageTemplates({
  whatsappBusinessId,
  accessToken,
  fetchImpl = fetch,
  version,
  appSecret,
}) {
  if (!isValidMetaResourceId(whatsappBusinessId)) {
    throw new MetaIntegrationError('El WABA de la conexi\u00f3n no es v\u00e1lido.', {
      code: 'WHATSAPP_TEMPLATE_WABA_INVALID',
      status: 409,
    });
  }
  const token = assertAccessToken(accessToken);
  const config = graphConfig({ version, appSecret });
  const url = messageTemplatesUrl({
    whatsappBusinessId,
    accessToken: token,
    ...config,
  });
  url.searchParams.set('fields', TEMPLATE_GRAPH_FIELDS);
  url.searchParams.set('limit', String(TEMPLATE_LIST_PAGE_SIZE));

  const templates = [];
  const seenCursors = new Set();
  for (let page = 0; page < TEMPLATE_LIST_MAX_PAGES; page += 1) {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await parseGraphResponse(response, 'Meta no pudo listar las plantillas de WhatsApp.');
    if (!Array.isArray(payload.data)) {
      throw new MetaIntegrationError('Meta devolvi\u00f3 un cat\u00e1logo de plantillas inv\u00e1lido.', {
        code: 'META_TEMPLATE_RESPONSE_INVALID',
        status: 502,
      });
    }
    for (const item of payload.data) {
      const normalized = normalizeRemoteTemplate(item);
      if (normalized) templates.push(normalized);
    }
    const cursor = pagingCursor(payload);
    if (!cursor) return templates;
    if (seenCursors.has(cursor)) {
      throw new MetaIntegrationError('Meta repiti\u00f3 la paginaci\u00f3n de plantillas.', {
        code: 'META_TEMPLATE_PAGING_INVALID',
        status: 502,
      });
    }
    seenCursors.add(cursor);
    url.searchParams.set('after', cursor);
  }
  throw new MetaIntegrationError('El cat\u00e1logo de plantillas super\u00f3 el l\u00edmite seguro.', {
    code: 'META_TEMPLATE_PAGING_LIMIT',
    status: 502,
  });
}

export async function createWhatsAppFlowTemplate({
  definition,
  accessToken,
  fetchImpl = fetch,
  version,
  appSecret,
}) {
  if (!definition || !isValidMetaResourceId(definition.whatsappBusinessId)) {
    throw new MetaIntegrationError('La definici\u00f3n de plantilla no es v\u00e1lida.', {
      code: 'WHATSAPP_TEMPLATE_INPUT_INVALID',
      status: 400,
    });
  }
  const token = assertAccessToken(accessToken);
  const config = graphConfig({ version, appSecret });
  const url = messageTemplatesUrl({
    whatsappBusinessId: definition.whatsappBusinessId,
    accessToken: token,
    ...config,
  });
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: definition.name,
      language: definition.language,
      category: definition.category,
      components: definition.components,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  const payload = await parseGraphResponse(response, 'Meta rechaz\u00f3 la creaci\u00f3n de la plantilla.');
  if (!isValidMetaResourceId(payload.id)) {
    throw new MetaIntegrationError('Meta acept\u00f3 la solicitud sin devolver la plantilla creada.', {
      code: 'META_TEMPLATE_RESPONSE_INVALID',
      status: 502,
    });
  }
  return {
    id: String(payload.id),
    name: definition.name,
    status: statusValue(payload.status),
    category: statusValue(payload.category, definition.category),
    language: definition.language,
    components: definition.components,
    rejectedReason: null,
    raw: payload,
  };
}

function publicTemplate(record) {
  if (!record) return null;
  return {
    id: record.providerTemplateId || null,
    blueprintKey: record.blueprintKey,
    name: record.name,
    language: record.language,
    category: record.category,
    status: record.status,
    flowId: record.flowId,
    screenId: record.screenId,
    rejectionReason: record.rejectionReason || null,
    submittedAt: record.submittedAt?.toISOString?.() || record.submittedAt || null,
    lastSyncedAt: record.lastSyncedAt?.toISOString?.() || record.lastSyncedAt || null,
    canSend: record.status === 'APPROVED',
  };
}

async function persistOwnedTemplate(prisma, connection, definition, remote, now) {
  const delegate = prisma?.whatsAppFlowTemplate;
  if (!delegate?.findUnique || !delegate?.upsert) {
    throw new MetaIntegrationError('La persistencia de plantillas no est\u00e1 disponible.', {
      code: 'WHATSAPP_TEMPLATE_PERSISTENCE_UNAVAILABLE',
      status: 503,
    });
  }
  const where = {
    connectionId_name_language: {
      connectionId: connection.id,
      name: definition.name,
      language: definition.language,
    },
  };
  const existing = await delegate.findUnique({ where });
  if (
    existing
    && (
      existing.whatsappBusinessId !== definition.whatsappBusinessId
      || existing.blueprintKey !== definition.blueprintKey
      || existing.contentSha256 !== definition.contentSha256
      || existing.flowId !== definition.flowId
      || existing.screenId !== definition.screenId
    )
  ) {
    throw new MetaIntegrationError('La identidad local de la plantilla entr\u00f3 en conflicto.', {
      code: 'WHATSAPP_TEMPLATE_OWNERSHIP_CONFLICT',
      status: 409,
    });
  }
  const status = statusValue(remote.status);
  const category = statusValue(remote.category, definition.category);
  const statusChangedAt = existing?.status === status ? existing.statusChangedAt : now;
  const common = {
    whatsappBusinessId: definition.whatsappBusinessId,
    blueprintKey: definition.blueprintKey,
    providerTemplateId: remote.id,
    category,
    status,
    contentSha256: definition.contentSha256,
    flowId: definition.flowId,
    screenId: definition.screenId,
    bodyText: definition.bodyText,
    buttonText: definition.buttonText,
    rejectionReason: remote.rejectedReason,
    lastSyncedAt: now,
    statusChangedAt,
    metadata: {
      source: 'obrasaas',
      flowAction: definition.flowAction,
      providerLanguage: remote.raw?.language || remote.language,
    },
  };
  try {
    return await delegate.upsert({
      where,
      create: {
        connectionId: connection.id,
        name: definition.name,
        language: definition.language,
        submittedAt: now,
        ...common,
      },
      update: common,
    });
  } catch (error) {
    if (error?.code !== 'P2002' && error?.code !== '23505') throw error;
    throw new MetaIntegrationError('La plantilla remota ya pertenece a otra conexi\u00f3n.', {
      code: 'WHATSAPP_TEMPLATE_OWNERSHIP_CONFLICT',
      status: 409,
    });
  }
}

function findExactRemote(remoteTemplates, definition) {
  const exact = remoteTemplates.filter((item) => (
    item.name === definition.name
    && normalizeLanguage(item.language) === definition.language
  ));
  if (exact.length > 1) {
    throw new MetaIntegrationError('Meta devolvi\u00f3 m\u00e1s de una plantilla con la misma identidad.', {
      code: 'WHATSAPP_TEMPLATE_OWNERSHIP_CONFLICT',
      status: 409,
    });
  }
  if (exact[0] && !remoteTemplateMatchesDefinition(exact[0], definition)) {
    throw new MetaIntegrationError('La plantilla remota no coincide con el contrato de ObraSaaS.', {
      code: 'WHATSAPP_TEMPLATE_OWNERSHIP_CONFLICT',
      status: 409,
    });
  }
  return exact[0] || null;
}

function publishedBlueprintKeys(metadata) {
  const stored = isPlainObject(metadata?.whatsappFlows) ? metadata.whatsappFlows : {};
  return Object.keys(stored).filter((key) => getPublishedWhatsAppFlowReference(metadata, key));
}

export async function synchronizeOwnedWhatsAppFlowTemplates({
  prisma,
  connection,
  accessToken,
  fetchImpl = fetch,
  version,
  appSecret,
  now = new Date(),
}) {
  assertConnection(connection);
  const remoteTemplates = await listWhatsAppMessageTemplates({
    whatsappBusinessId: connection.whatsappBusinessId,
    accessToken,
    fetchImpl,
    version,
    appSecret,
  });
  const catalog = [];
  for (const blueprintKey of publishedBlueprintKeys(connection.metadata)) {
    const definition = buildOwnedWhatsAppFlowTemplate({ connection, blueprintKey });
    const remote = findExactRemote(remoteTemplates, definition);
    if (!remote) {
      const existing = await prisma.whatsAppFlowTemplate.findUnique({
        where: {
          connectionId_name_language: {
            connectionId: connection.id,
            name: definition.name,
            language: definition.language,
          },
        },
      });
      if (existing) {
        await prisma.whatsAppFlowTemplate.updateMany({
          where: {
            id: existing.id,
            connectionId: connection.id,
            whatsappBusinessId: connection.whatsappBusinessId,
          },
          data: { status: 'MISSING', lastSyncedAt: now, statusChangedAt: now },
        });
      }
      catalog.push({
        blueprintKey,
        expectedName: definition.name,
        contentSha256: definition.contentSha256,
        template: existing ? publicTemplate({ ...existing, status: 'MISSING', lastSyncedAt: now }) : null,
      });
      continue;
    }
    const record = await persistOwnedTemplate(prisma, connection, definition, remote, now);
    catalog.push({
      blueprintKey,
      expectedName: definition.name,
      contentSha256: definition.contentSha256,
      template: publicTemplate(record),
    });
  }
  return catalog;
}

export async function provisionOwnedWhatsAppFlowTemplate({
  prisma,
  connection,
  blueprintKey,
  accessToken,
  fetchImpl = fetch,
  version,
  appSecret,
  now = new Date(),
}) {
  const definition = buildOwnedWhatsAppFlowTemplate({ connection, blueprintKey });
  const remoteTemplates = await listWhatsAppMessageTemplates({
    whatsappBusinessId: connection.whatsappBusinessId,
    accessToken,
    fetchImpl,
    version,
    appSecret,
  });
  let remote = findExactRemote(remoteTemplates, definition);
  let created = false;
  if (!remote) {
    remote = await createWhatsAppFlowTemplate({
      definition,
      accessToken,
      fetchImpl,
      version,
      appSecret,
    });
    created = true;
  }
  const record = await persistOwnedTemplate(prisma, connection, definition, remote, now);
  return {
    created,
    expectedName: definition.name,
    contentSha256: definition.contentSha256,
    template: publicTemplate(record),
  };
}

export async function synchronizeWhatsAppTemplateStatus(
  event,
  scope,
  { prisma, now = new Date() } = {},
) {
  if (event?.field !== 'message_template_status_update') {
    return { updated: false, reason: 'not_template_status' };
  }
  const eventWabaId = String(event.whatsappBusinessId || '');
  const scopeWabaId = String(scope?.whatsappBusinessId || '');
  const projectId = String(scope?.projectId || '');
  const providerTemplateId = String(event.value?.message_template_id || '');
  if (
    !projectId
    || !isValidMetaResourceId(eventWabaId)
    || eventWabaId !== scopeWabaId
    || !isValidMetaResourceId(providerTemplateId)
  ) {
    return { updated: false, reason: 'scope_mismatch' };
  }
  const connection = await prisma.whatsAppConnection.findFirst({
    where: {
      projectId,
      whatsappBusinessId: eventWabaId,
      enabled: true,
    },
    select: { id: true, whatsappBusinessId: true },
  });
  if (!connection) return { updated: false, reason: 'connection_not_found' };

  const status = statusValue(event.event || event.value?.event);
  const reason = event.value?.reason
    ? String(event.value.reason).slice(0, 2_000)
    : null;
  const result = await prisma.whatsAppFlowTemplate.updateMany({
    where: {
      connectionId: connection.id,
      whatsappBusinessId: eventWabaId,
      providerTemplateId,
    },
    data: {
      status,
      rejectionReason: reason,
      lastSyncedAt: now,
      statusChangedAt: now,
    },
  });
  return result.count === 1
    ? { updated: true, status }
    : { updated: false, reason: 'foreign_template' };
}
