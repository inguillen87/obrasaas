export const WHATSAPP_CHANNEL_READINESS_STATES = Object.freeze({
  UNCONFIGURED: 'UNCONFIGURED',
  READY_TO_CONNECT: 'READY_TO_CONNECT',
  ACCOUNT_LINKED: 'ACCOUNT_LINKED',
  WEBHOOK_PENDING: 'WEBHOOK_PENDING',
  OPERATIONAL: 'OPERATIONAL',
  DEGRADED: 'DEGRADED',
});

export const WHATSAPP_CHANNEL_STAGE_KEYS = Object.freeze({
  PLATFORM: 'platform',
  ACCOUNT: 'account',
  WEBHOOK: 'webhook',
  TRAFFIC: 'traffic',
  FLOWS: 'flows',
});

export const WHATSAPP_REQUIRED_SCOPES = Object.freeze([
  'whatsapp_business_management',
  'whatsapp_business_messaging',
]);

const STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({ key: WHATSAPP_CHANNEL_STAGE_KEYS.PLATFORM, label: 'Plataforma' }),
  Object.freeze({ key: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT, label: 'Cuenta' }),
  Object.freeze({ key: WHATSAPP_CHANNEL_STAGE_KEYS.WEBHOOK, label: 'Webhook' }),
  Object.freeze({ key: WHATSAPP_CHANNEL_STAGE_KEYS.TRAFFIC, label: 'Envío y recepción' }),
  Object.freeze({ key: WHATSAPP_CHANNEL_STAGE_KEYS.FLOWS, label: 'Flows' }),
]);

const STATE_COPY = Object.freeze({
  [WHATSAPP_CHANNEL_READINESS_STATES.UNCONFIGURED]: Object.freeze({
    label: 'Meta no configurado',
    summary: 'Falta completar la configuración segura de la app de Meta.',
  }),
  [WHATSAPP_CHANNEL_READINESS_STATES.READY_TO_CONNECT]: Object.freeze({
    label: 'Listo para vincular',
    summary: 'La plataforma está lista; todavía no hay una cuenta de WhatsApp vinculada.',
  }),
  [WHATSAPP_CHANNEL_READINESS_STATES.ACCOUNT_LINKED]: Object.freeze({
    label: 'Cuenta vinculada',
    summary: 'Existe una cuenta vinculada, pero todavía faltan verificaciones del canal.',
  }),
  [WHATSAPP_CHANNEL_READINESS_STATES.WEBHOOK_PENDING]: Object.freeze({
    label: 'Prueba operativa pendiente',
    summary: 'Meta y el webhook están vinculados; falta probar tráfico real en ambos sentidos.',
  }),
  [WHATSAPP_CHANNEL_READINESS_STATES.OPERATIONAL]: Object.freeze({
    label: 'Operativo',
    summary: 'El canal tiene recepción firmada y envío confirmado por Meta.',
  }),
  [WHATSAPP_CHANNEL_READINESS_STATES.DEGRADED]: Object.freeze({
    label: 'Requiere atención',
    summary: 'Una verificación explícita detectó un problema que impide declarar el canal sano.',
  }),
});

const TOKEN_STATUSES = new Set(['VALID', 'EXPIRED', 'INVALID', 'UNKNOWN']);
const SUBSCRIPTION_STATUSES = new Set(['SUBSCRIBED', 'UNSUBSCRIBED', 'UNKNOWN']);
const PHONE_STATUSES = new Set(['REGISTERED', 'UNREGISTERED', 'UNKNOWN']);
const HEALTH_STATUSES = new Set(['HEALTHY', 'DEGRADED', 'UNKNOWN']);
const ENDPOINT_STATUSES = new Set(['HEALTHY', 'DEGRADED', 'UNKNOWN']);

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function knownBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function normalizedStatus(value, allowed) {
  const normalized = String(value || '').trim().toUpperCase();
  return allowed.has(normalized) ? normalized : 'UNKNOWN';
}

function normalizedScopes(value) {
  if (!Array.isArray(value)) return { known: false, values: [] };
  return {
    known: true,
    values: [...new Set(value
      .filter((scope) => typeof scope === 'string')
      .map((scope) => scope.trim())
      .filter(Boolean))],
  };
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function hasSerializableTimestamp(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && Number.isFinite(Date.parse(value));
}

function addAction(actions, actionCodes, action) {
  if (actionCodes.has(action.code)) return;
  actionCodes.add(action.code);
  actions.push(action);
}

function stageStatus({ complete, degraded, current }) {
  if (degraded) return 'DEGRADED';
  if (complete) return 'COMPLETE';
  return current ? 'CURRENT' : 'PENDING';
}

/**
 * Derives a credential-free, JSON-serializable readiness projection.
 *
 * Callers must reduce provider/database state to booleans, status enums,
 * granted scope names, counts and ISO timestamps before invoking this model.
 * IDs, access tokens, app secrets and raw provider payloads are intentionally
 * outside this contract and are never copied to the result.
 */
export function deriveWhatsAppChannelReadiness(input = {}) {
  const source = record(input);
  const platform = record(source.platform);
  const account = record(source.account);
  const traffic = record(source.traffic);
  const flows = record(source.flows);

  const appIdConfigured = platform.appIdConfigured === true;
  const appSecretConfigured = platform.appSecretConfigured === true;
  const embeddedSignupConfigConfigured = platform.embeddedSignupConfigConfigured === true;
  const webhookVerifyTokenConfigured = platform.webhookVerifyTokenConfigured === true;
  const credentialEncryptionConfigured = platform.credentialEncryptionConfigured === true;
  const missingPlatformConfig = [
    ['META_APP_ID_MISSING', 'appId', appIdConfigured, 'Falta configurar el identificador de la app de Meta.'],
    ['META_APP_SECRET_MISSING', 'appSecret', appSecretConfigured, 'Falta configurar el secreto de la app de Meta.'],
    ['META_EMBEDDED_SIGNUP_CONFIG_MISSING', 'embeddedSignupConfig', embeddedSignupConfigConfigured, 'Falta configurar Embedded Signup para ObraSaaS.'],
    ['WEBHOOK_VERIFY_TOKEN_MISSING', 'webhookVerifyToken', webhookVerifyTokenConfigured, 'Falta configurar el token de verificación del webhook.'],
    ['CREDENTIAL_ENCRYPTION_MISSING', 'credentialEncryption', credentialEncryptionConfigured, 'Falta configurar el cifrado de credenciales por tenant.'],
  ].filter(([, , configured]) => !configured);
  const platformConfigured = missingPlatformConfig.length === 0;

  const linked = account.linked === true;
  const enabled = knownBoolean(account.enabled);
  const tokenStatus = normalizedStatus(account.tokenStatus, TOKEN_STATUSES);
  const scopes = normalizedScopes(account.scopes);
  const missingScopes = scopes.known
    ? WHATSAPP_REQUIRED_SCOPES.filter((scope) => !scopes.values.includes(scope))
    : [...WHATSAPP_REQUIRED_SCOPES];
  const scopesVerified = scopes.known && missingScopes.length === 0;
  const phoneStatus = normalizedStatus(account.phoneStatus, PHONE_STATUSES);
  const subscriptionStatus = normalizedStatus(account.subscriptionStatus, SUBSCRIPTION_STATUSES);
  const qualityStatus = normalizedStatus(account.qualityStatus, HEALTH_STATUSES);
  const templateStatus = normalizedStatus(account.templateStatus, HEALTH_STATUSES);
  const providerStatus = normalizedStatus(account.providerStatus, HEALTH_STATUSES);

  const signedInboundObserved = hasSerializableTimestamp(traffic.signedInboundAt);
  const confirmedOutboundObserved = hasSerializableTimestamp(traffic.confirmedOutboundAt);

  const flowsConfigured = flows.configured === true;
  const flowEndpointStatus = normalizedStatus(flows.endpointStatus, ENDPOINT_STATUSES);
  const publishedFlowCount = safeCount(flows.publishedCount);
  const flowCapabilityReady = flowsConfigured
    && flowEndpointStatus === 'HEALTHY'
    && publishedFlowCount > 0;

  const reasons = [];
  const actions = [];
  const actionCodes = new Set();
  let explicitlyDegraded = false;

  for (const [code, , , message] of missingPlatformConfig) {
    reasons.push({
      code,
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.PLATFORM,
      severity: linked ? 'DEGRADED' : 'BLOCKING',
      message,
    });
  }
  if (missingPlatformConfig.length > 0) {
    explicitlyDegraded = linked;
    addAction(actions, actionCodes, {
      code: 'CONFIGURE_META_PLATFORM',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.PLATFORM,
      priority: 'BLOCKING',
      label: 'Completar configuración de Meta',
    });
  }

  if (platformConfigured && !linked) {
    reasons.push({
      code: 'ACCOUNT_NOT_LINKED',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
      severity: 'PENDING',
      message: 'Todavía no hay una cuenta de WhatsApp Business vinculada.',
    });
    addAction(actions, actionCodes, {
      code: 'CONNECT_ACCOUNT',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
      priority: 'NEXT',
      label: 'Vincular cuenta de WhatsApp',
    });
  }

  if (linked) {
    if (enabled === false) {
      explicitlyDegraded = true;
      reasons.push({
        code: 'CONNECTION_DISABLED',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        severity: 'DEGRADED',
        message: 'La conexión está deshabilitada.',
      });
      addAction(actions, actionCodes, {
        code: 'ENABLE_CONNECTION',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        priority: 'BLOCKING',
        label: 'Reactivar conexión',
      });
    } else if (enabled === null) {
      reasons.push({
        code: 'CONNECTION_STATUS_UNVERIFIED',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        severity: 'PENDING',
        message: 'No se verificó si la conexión está habilitada.',
      });
      addAction(actions, actionCodes, {
        code: 'VERIFY_ACCOUNT',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        priority: 'NEXT',
        label: 'Verificar cuenta en Meta',
      });
    }

    if (tokenStatus === 'EXPIRED' || tokenStatus === 'INVALID') {
      explicitlyDegraded = true;
      reasons.push({
        code: tokenStatus === 'EXPIRED' ? 'ACCESS_TOKEN_EXPIRED' : 'ACCESS_TOKEN_INVALID',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        severity: 'DEGRADED',
        message: tokenStatus === 'EXPIRED'
          ? 'El token de acceso de Meta venció.'
          : 'Meta marcó el token de acceso como inválido.',
      });
      addAction(actions, actionCodes, {
        code: 'RECONNECT_ACCOUNT',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        priority: 'BLOCKING',
        label: 'Reconectar cuenta en Meta',
      });
    } else if (tokenStatus === 'UNKNOWN') {
      reasons.push({
        code: 'ACCESS_TOKEN_UNVERIFIED',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        severity: 'PENDING',
        message: 'La vigencia del token de Meta todavía no fue verificada.',
      });
      addAction(actions, actionCodes, {
        code: 'VERIFY_ACCOUNT',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        priority: 'NEXT',
        label: 'Verificar cuenta en Meta',
      });
    }

    if (!scopes.known) {
      reasons.push({
        code: 'SCOPES_UNVERIFIED',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        severity: 'PENDING',
        message: 'Los permisos obligatorios de WhatsApp todavía no fueron verificados.',
      });
      addAction(actions, actionCodes, {
        code: 'VERIFY_ACCOUNT',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        priority: 'NEXT',
        label: 'Verificar cuenta en Meta',
      });
    } else if (missingScopes.length > 0) {
      explicitlyDegraded = true;
      reasons.push({
        code: 'REQUIRED_SCOPES_MISSING',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        severity: 'DEGRADED',
        message: 'La cuenta no concedió todos los permisos obligatorios de WhatsApp.',
      });
      addAction(actions, actionCodes, {
        code: 'RECONNECT_ACCOUNT',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        priority: 'BLOCKING',
        label: 'Reconectar y conceder permisos',
      });
    }

    if (phoneStatus === 'UNREGISTERED') {
      explicitlyDegraded = true;
      reasons.push({
        code: 'PHONE_NOT_REGISTERED',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        severity: 'DEGRADED',
        message: 'El número no figura registrado para Cloud API.',
      });
      addAction(actions, actionCodes, {
        code: 'REGISTER_PHONE',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        priority: 'BLOCKING',
        label: 'Registrar número en Meta',
      });
    } else if (phoneStatus === 'UNKNOWN') {
      reasons.push({
        code: 'PHONE_STATUS_UNVERIFIED',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        severity: 'PENDING',
        message: 'El registro del número todavía no fue verificado.',
      });
      addAction(actions, actionCodes, {
        code: 'VERIFY_ACCOUNT',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        priority: 'NEXT',
        label: 'Verificar cuenta en Meta',
      });
    }

    for (const [status, code, message, label] of [
      [qualityStatus, 'PHONE_QUALITY_DEGRADED', 'Meta informó calidad degradada para el número.', 'Revisar calidad del número'],
      [templateStatus, 'TEMPLATE_HEALTH_DEGRADED', 'Meta informó restricciones en las plantillas.', 'Revisar plantillas en Meta'],
      [providerStatus, 'PROVIDER_HEALTH_DEGRADED', 'La última verificación de Meta detectó un problema del canal.', 'Revalidar canal con Meta'],
    ]) {
      if (status !== 'DEGRADED') continue;
      explicitlyDegraded = true;
      reasons.push({
        code,
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        severity: 'DEGRADED',
        message,
      });
      addAction(actions, actionCodes, {
        code: code === 'PHONE_QUALITY_DEGRADED'
          ? 'REVIEW_PHONE_QUALITY'
          : code === 'TEMPLATE_HEALTH_DEGRADED'
            ? 'REVIEW_TEMPLATES'
            : 'REVALIDATE_PROVIDER',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT,
        priority: 'BLOCKING',
        label,
      });
    }

    if (subscriptionStatus === 'UNSUBSCRIBED') {
      explicitlyDegraded = true;
      reasons.push({
        code: 'WEBHOOK_NOT_SUBSCRIBED',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.WEBHOOK,
        severity: 'DEGRADED',
        message: 'La app no está suscripta al WABA seleccionado.',
      });
      addAction(actions, actionCodes, {
        code: 'SUBSCRIBE_WEBHOOK',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.WEBHOOK,
        priority: 'BLOCKING',
        label: 'Restablecer suscripción del webhook',
      });
    } else if (subscriptionStatus === 'UNKNOWN') {
      reasons.push({
        code: 'WEBHOOK_SUBSCRIPTION_UNVERIFIED',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.WEBHOOK,
        severity: 'PENDING',
        message: 'La suscripción del WABA al webhook todavía no fue confirmada.',
      });
      addAction(actions, actionCodes, {
        code: 'VERIFY_WEBHOOK_SUBSCRIPTION',
        stage: WHATSAPP_CHANNEL_STAGE_KEYS.WEBHOOK,
        priority: 'NEXT',
        label: 'Verificar suscripción del webhook',
      });
    }
  }

  const accountReady = platformConfigured
    && linked
    && enabled === true
    && tokenStatus === 'VALID'
    && scopesVerified
    && phoneStatus === 'REGISTERED'
    && qualityStatus !== 'DEGRADED'
    && templateStatus !== 'DEGRADED'
    && providerStatus !== 'DEGRADED';
  const webhookReady = accountReady && subscriptionStatus === 'SUBSCRIBED';
  const trafficReady = webhookReady
    && signedInboundObserved
    && confirmedOutboundObserved;
  const flowsReady = trafficReady && flowCapabilityReady;

  if (webhookReady && !signedInboundObserved) {
    reasons.push({
      code: 'SIGNED_INBOUND_NOT_OBSERVED',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.TRAFFIC,
      severity: 'PENDING',
      message: 'Todavía no se recibió un webhook firmado de un mensaje real.',
    });
    addAction(actions, actionCodes, {
      code: 'TEST_INBOUND_MESSAGE',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.TRAFFIC,
      priority: 'NEXT',
      label: 'Enviar mensaje de prueba al número',
    });
  }
  if (webhookReady && !confirmedOutboundObserved) {
    reasons.push({
      code: 'CONFIRMED_OUTBOUND_NOT_OBSERVED',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.TRAFFIC,
      severity: 'PENDING',
      message: 'Todavía no existe un envío aceptado y confirmado por Meta.',
    });
    addAction(actions, actionCodes, {
      code: 'TEST_OUTBOUND_MESSAGE',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.TRAFFIC,
      priority: 'NEXT',
      label: 'Probar envío desde ObraSaaS',
    });
  }

  if (linked && flowsConfigured && flowEndpointStatus === 'DEGRADED') {
    explicitlyDegraded = true;
    reasons.push({
      code: 'FLOW_ENDPOINT_DEGRADED',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.FLOWS,
      severity: 'DEGRADED',
      message: 'El endpoint configurado para WhatsApp Flows no está sano.',
    });
    addAction(actions, actionCodes, {
      code: 'REPAIR_FLOW_ENDPOINT',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.FLOWS,
      priority: 'BLOCKING',
      label: 'Reparar endpoint de Flows',
    });
  } else if (trafficReady && !flowsConfigured) {
    reasons.push({
      code: 'FLOWS_NOT_CONFIGURED',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.FLOWS,
      severity: 'PENDING',
      message: 'El canal opera, pero todavía no tiene WhatsApp Flows configurados.',
    });
    addAction(actions, actionCodes, {
      code: 'CONFIGURE_FLOWS',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.FLOWS,
      priority: 'ENHANCEMENT',
      label: 'Configurar WhatsApp Flows',
    });
  } else if (linked && flowsConfigured && flowEndpointStatus === 'UNKNOWN') {
    reasons.push({
      code: 'FLOW_ENDPOINT_UNVERIFIED',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.FLOWS,
      severity: 'PENDING',
      message: 'La salud del endpoint de Flows todavía no fue verificada.',
    });
    addAction(actions, actionCodes, {
      code: 'VERIFY_FLOW_ENDPOINT',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.FLOWS,
      priority: 'NEXT',
      label: 'Verificar endpoint de Flows',
    });
  } else if (
    linked
    && flowsConfigured
    && flowEndpointStatus === 'HEALTHY'
    && publishedFlowCount === 0
  ) {
    reasons.push({
      code: 'NO_PUBLISHED_FLOWS',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.FLOWS,
      severity: 'PENDING',
      message: 'El endpoint está sano, pero todavía no hay un Flow publicado.',
    });
    addAction(actions, actionCodes, {
      code: 'PUBLISH_FLOW',
      stage: WHATSAPP_CHANNEL_STAGE_KEYS.FLOWS,
      priority: 'NEXT',
      label: 'Publicar primer Flow',
    });
  }

  let state;
  if (!platformConfigured && !linked) {
    state = WHATSAPP_CHANNEL_READINESS_STATES.UNCONFIGURED;
  } else if (explicitlyDegraded) {
    state = WHATSAPP_CHANNEL_READINESS_STATES.DEGRADED;
  } else if (!linked) {
    state = WHATSAPP_CHANNEL_READINESS_STATES.READY_TO_CONNECT;
  } else if (trafficReady) {
    state = WHATSAPP_CHANNEL_READINESS_STATES.OPERATIONAL;
  } else if (webhookReady) {
    state = WHATSAPP_CHANNEL_READINESS_STATES.WEBHOOK_PENDING;
  } else {
    state = WHATSAPP_CHANNEL_READINESS_STATES.ACCOUNT_LINKED;
  }

  const accountDegraded = linked && (
    !platformConfigured
    || enabled === false
    || ['EXPIRED', 'INVALID'].includes(tokenStatus)
    || (scopes.known && missingScopes.length > 0)
    || phoneStatus === 'UNREGISTERED'
    || qualityStatus === 'DEGRADED'
    || templateStatus === 'DEGRADED'
    || providerStatus === 'DEGRADED'
  );
  const stages = STAGE_DEFINITIONS.map((definition) => {
    let complete = false;
    let degraded = false;
    let current = false;
    if (definition.key === WHATSAPP_CHANNEL_STAGE_KEYS.PLATFORM) {
      complete = platformConfigured;
      degraded = linked && !platformConfigured;
      current = !platformConfigured;
    } else if (definition.key === WHATSAPP_CHANNEL_STAGE_KEYS.ACCOUNT) {
      complete = accountReady;
      degraded = accountDegraded;
      current = platformConfigured && !accountReady;
    } else if (definition.key === WHATSAPP_CHANNEL_STAGE_KEYS.WEBHOOK) {
      complete = webhookReady;
      degraded = linked && subscriptionStatus === 'UNSUBSCRIBED';
      current = accountReady && !webhookReady;
    } else if (definition.key === WHATSAPP_CHANNEL_STAGE_KEYS.TRAFFIC) {
      complete = trafficReady;
      current = webhookReady && !trafficReady;
    } else {
      complete = flowsReady;
      degraded = linked && flowsConfigured && flowEndpointStatus === 'DEGRADED';
      current = trafficReady && !flowsReady;
    }
    return {
      ...definition,
      status: stageStatus({ complete, degraded, current }),
    };
  });
  const completed = stages.filter((stage) => stage.status === 'COMPLETE').length;
  const nextStage = stages.find((stage) => stage.status === 'DEGRADED')
    || stages.find((stage) => stage.status === 'CURRENT')
    || stages.find((stage) => stage.status === 'PENDING')
    || null;
  const nextAction = actions.find((action) => action.priority === 'BLOCKING')
    || actions.find((action) => action.priority === 'NEXT')
    || actions[0]
    || null;

  return {
    state,
    label: STATE_COPY[state].label,
    summary: STATE_COPY[state].summary,
    operational: state === WHATSAPP_CHANNEL_READINESS_STATES.OPERATIONAL,
    messagingOperational: trafficReady,
    degraded: state === WHATSAPP_CHANNEL_READINESS_STATES.DEGRADED,
    checks: {
      platform: {
        configured: platformConfigured,
        missing: missingPlatformConfig.map(([, key]) => key),
      },
      account: {
        linked,
        enabled,
        tokenStatus,
        scopesVerified,
        missingScopes: scopes.known ? missingScopes : null,
        phoneStatus,
        qualityStatus,
        templateStatus,
        providerStatus,
      },
      webhook: {
        subscriptionStatus,
      },
      traffic: {
        signedInboundObserved,
        confirmedOutboundObserved,
      },
      flows: {
        configured: flowsConfigured,
        endpointStatus: flowEndpointStatus,
        publishedCount: publishedFlowCount,
        ready: flowsReady,
      },
    },
    progress: {
      completed,
      total: stages.length,
      percentage: Math.round((completed / stages.length) * 100),
      nextStage: nextStage?.key || null,
      stages,
    },
    reasons,
    actions,
    nextAction,
  };
}
