'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  whatsappConnectionActive,
  whatsappConnectionIdentity,
  whatsappConnectionLinked,
  whatsappGraphAccessReady,
  whatsappGraphAccessRejected,
  whatsappReconnectRequired,
} from './channel-client-state';
import TemplateReviewControl from './template-review-control';
import { templateCatalogMatches, templateStatusPresentation } from '@/lib/whatsapp/template-review-policy';
import WhatsAppConnectExperience from './whatsapp-connect-experience';
import ChannelRecoveryPanel from './channel-recovery-panel';
import TenantWhatsAppWorkspace from './tenant-whatsapp-workspace';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import styles from './integrations.module.css';

const META_ORIGINS = new Set([
  'https://www.facebook.com',
  'https://web.facebook.com',
]);
const EMPTY_CATALOG = Object.freeze([]);

function formatDate(value) {
  if (!value) return 'Pendiente';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function parseEmbeddedSignupEvent(raw) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function flowStatusLabel(status, verificationUnavailable = false) {
  if (verificationUnavailable) return 'Estado Meta no verificado';
  if (status === 'PUBLISHED') return 'Publicado';
  if (status === 'DRAFT') return 'Borrador validado';
  if (status === 'NOT_CREATED') return 'Sin crear';
  return status === 'UNKNOWN' ? 'Revisar' : status;
}

function flowStatusClass(status, verificationUnavailable = false) {
  if (verificationUnavailable) return 'flowBlocked';
  if (status === 'PUBLISHED') return 'flowPublished';
  if (status === 'DRAFT') return 'flowDraft';
  if (status === 'NOT_CREATED') return 'flowMissing';
  return 'flowBlocked';
}

function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readinessIcon(status) {
  if (status === 'COMPLETE') return 'fa-check';
  if (status === 'DEGRADED') return 'fa-triangle-exclamation';
  if (status === 'CURRENT') return 'fa-arrow-right';
  return 'fa-circle';
}

function normalizeFlowCatalogPayload(payload) {
  if (!isPlainRecord(payload) || !Array.isArray(payload.catalog)) {
    throw new Error('La respuesta de WhatsApp Flows no tiene un formato válido.');
  }
  return {
    catalog: payload.catalog,
    endpoint: isPlainRecord(payload.endpoint) ? payload.endpoint : null,
  };
}

function normalizeTemplateCatalogPayload(payload, scope) {
  if (!templateCatalogMatches(payload, scope)) {
    throw new Error('La respuesta de plantillas de WhatsApp no tiene un formato v\u00e1lido.');
  }
  return payload.templates;
}

function integrationResponseError(payload, fallback) {
  const error = new Error(
    typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim().slice(0, 300)
      : fallback,
  );
  error.code = typeof payload?.code === 'string'
    ? payload.code.trim().toUpperCase().slice(0, 96)
    : null;
  return error;
}

function flowEndpointPresentation(endpoint, { graphReady, linked, verificationFailed }) {
  if (!linked) return { label: 'Conectá WhatsApp para activarlo', tone: 'idle' };
  if (!graphReady) return { label: 'Cuenta requiere atención', tone: 'blocked' };
  if (verificationFailed) return { label: 'No se pudo verificar', tone: 'blocked' };
  if (endpoint === undefined) return { label: 'Verificando cifrado…', tone: 'pending' };
  if (endpoint?.ready) return { label: 'Cifrado verificado', tone: 'ready' };
  if (endpoint) return { label: 'Configuración incompleta', tone: 'blocked' };
  return { label: 'Pendiente del primer borrador', tone: 'pending' };
}

function flowRuntimePresentation(flow, verificationUnavailable = false) {
  if (verificationUnavailable) {
    return { label: 'Cuenta requiere verificación', tone: 'blocked' };
  }
  if (flow.runtimeActive) return { label: 'Canal dinámico operativo', tone: 'ready' };
  if (flow.remote.healthStatus?.blocked) {
    return { label: 'Canal bloqueado por Meta', tone: 'blocked' };
  }
  if (flow.remote.status === 'PUBLISHED' && flow.remoteDataEndpointReady) {
    return { label: 'Canal listo para reconciliar', tone: 'pending' };
  }
  if (flow.remote.status === 'PUBLISHED') {
    return { label: 'Publicado sin Data Endpoint', tone: 'blocked' };
  }
  if (flow.remote.status === 'DRAFT' && flow.remote.applicationId) {
    return { label: 'Borrador cifrado vinculado', tone: 'pending' };
  }
  if (flow.remote.status === 'NOT_CREATED') {
    return { label: 'Aún no provisionado', tone: 'idle' };
  }
  return { label: 'Vinculación pendiente', tone: 'pending' };
}

function flowActionLabel({
  isPending,
  isPublished,
  publishedCanReconcile,
  publishedHealthBlocked,
  remoteStatus,
  runtimeActive,
  verificationUnavailable,
}) {
  if (verificationUnavailable) return 'Verificar cuenta';
  if (isPending) return 'Validando…';
  if (isPublished && runtimeActive) return 'Listo para enviar';
  if (publishedHealthBlocked) return 'Revisar en Meta';
  if (publishedCanReconcile) return 'Reconciliar canal';
  if (isPublished) return 'Requiere nueva versión';
  return remoteStatus === 'DRAFT' ? 'Actualizar borrador' : 'Crear borrador';
}

function templatePresentation(template, verificationUnavailable = false) {
  if (verificationUnavailable) return { label: 'Estado Meta no verificado', tone: 'blocked' };
  return templateStatusPresentation(template);
}

async function readFlowCatalog({ signal } = {}) {
  const response = await fetch('/api/integrations/whatsapp/flows', {
    cache: 'no-store',
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw integrationResponseError(payload, 'No se pudieron consultar los Flows.');
  }
  return normalizeFlowCatalogPayload(payload);
}

async function readTemplateCatalog({ signal, scope } = {}) {
  const response = await fetch('/api/integrations/whatsapp/templates', {
    headers: evidenceScopeHeaders(scope),
    cache: 'no-store',
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw integrationResponseError(payload, 'No se pudieron consultar las plantillas.');
  }
  return normalizeTemplateCatalogPayload(payload, scope);
}

export default function IntegrationsClient({
  organizationId, projectId, companyName, projectName, canReadInbox = false, internalWorkspace = false, graphVersion = 'v25.0',
  appId,
  configId,
  platformReady,
  pilotImportEnabled,
  initialConnection,
  initialHealth,
  initialHealthDiagnostics,
  initialFlowCatalog,
}) {
  const [connection, setConnection] = useState(initialConnection);
  const [preparedWorkspace, setPreparedWorkspace] = useState(null);
  const preparedRevisionRef = useRef(null);
  const [channelHealth, setChannelHealth] = useState(initialHealth);
  const [lifecycleView, setLifecycleView] = useState(null);
  const [healthDiagnostics, setHealthDiagnostics] = useState(initialHealthDiagnostics);
  const [healthPending, setHealthPending] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [registrationPin, setRegistrationPin] = useState('');
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(false);
  const [flowCatalog, setFlowCatalog] = useState(
    Array.isArray(initialFlowCatalog) ? initialFlowCatalog : [],
  );
  const [flowPendingKey, setFlowPendingKey] = useState(null);
  const [flowNotice, setFlowNotice] = useState(null);
  const [templateCatalog, setTemplateCatalog] = useState([]);
  const [templateReviewEpoch, setTemplateReviewEpoch] = useState(0);
  const [templatePendingKey, setTemplatePendingKey] = useState(null);
  const [templateNotice, setTemplateNotice] = useState(null);
  const [flowEndpoint, setFlowEndpoint] = useState(
    whatsappGraphAccessReady(initialConnection, initialHealth) ? undefined : null,
  );
  const signupRef = useRef({ code: null, whatsappBusinessId: null, phoneNumberId: null });
  const pinRef = useRef('');
  const signupActiveRef = useRef(false);
  const signupGenerationRef = useRef(0);
  const submittedRef = useRef(false);
  const graphAccessFailureSyncRef = useRef(false);
  const healthRequestSequenceRef = useRef(0);
  const remoteChannelEpochRef = useRef(0);
  const linked = whatsappConnectionLinked(connection);
  const connectionIdentity = whatsappConnectionIdentity(connection);
  const connectionActive = whatsappConnectionActive(connection);
  const lifecycleMatches = lifecycleView?.organizationId === organizationId && lifecycleView?.projectId === projectId;
  const lifecycleBlocked = linked && (!lifecycleMatches || lifecycleView.state !== 'ready' || lifecycleView.credential?.blocksProviderActions !== false);
  const lifecycleContextBlocked = linked && lifecycleMatches && lifecycleView.state === 'blocked';
  const lifecycleReauthorization = linked && lifecycleMatches && lifecycleView.credential?.reauthorizationRequired === true;
  const graphReady = whatsappGraphAccessReady(connection, channelHealth) && !lifecycleBlocked;
  const remoteVerificationUnavailable = linked && !graphReady;
  const reconnectRequired = whatsappReconnectRequired(connection, channelHealth) || lifecycleReauthorization;
  const safeInitialFlowCatalog = Array.isArray(initialFlowCatalog)
    ? initialFlowCatalog
    : EMPTY_CATALOG;
  const presentedFlowCatalog = graphReady
    ? flowCatalog
    : safeInitialFlowCatalog;
  const presentedTemplateCatalog = graphReady ? templateCatalog : EMPTY_CATALOG;
  const presentedFlowEndpoint = graphReady ? flowEndpoint : null;
  const presentedFlowNotice = graphReady ? flowNotice : null;
  const presentedTemplateNotice = graphReady ? templateNotice : null;
  const configured = Boolean(appId && configId && platformReady);
  const healthStateClass = lifecycleBlocked || channelHealth?.degraded
    ? styles.degradedState
    : channelHealth?.operational
      ? styles.connected
      : styles.pendingState;
  const endpointPresentation = flowEndpointPresentation(presentedFlowEndpoint, {
    graphReady,
    linked,
    verificationFailed: presentedFlowEndpoint === undefined && presentedFlowNotice?.type === 'error',
  });
  const endpointFingerprint = typeof presentedFlowEndpoint?.keyFingerprint === 'string'
    ? presentedFlowEndpoint.keyFingerprint
    : null;

  async function synchronizeChannelHealth({ method = 'GET' } = {}) {
    const remoteChannelEpoch = remoteChannelEpochRef.current;
    const requestSequence = healthRequestSequenceRef.current + 1;
    healthRequestSequenceRef.current = requestSequence;
    const response = await fetch('/api/integrations/whatsapp/health', {
      method,
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (
      remoteChannelEpoch !== remoteChannelEpochRef.current
      || requestSequence !== healthRequestSequenceRef.current
    ) return null;
    if (isPlainRecord(payload.health)) setChannelHealth(payload.health);
    if (isPlainRecord(payload.diagnostics)) setHealthDiagnostics(payload.diagnostics);
    if (!response.ok) {
      const error = new Error(payload.error || 'No se pudo verificar la salud del canal.');
      error.code = payload.code || null;
      throw error;
    }
    return payload;
  }

  function invalidateRemoteChannelState() {
    remoteChannelEpochRef.current += 1;
    setTemplateReviewEpoch(value => value + 1);
    healthRequestSequenceRef.current += 1;
    setChannelHealth(null);
    setLifecycleView(null);
    setHealthDiagnostics(null);
    setFlowCatalog(Array.isArray(initialFlowCatalog) ? initialFlowCatalog : []);
    setFlowEndpoint(null);
    setFlowNotice(null);
    setFlowPendingKey(null);
    setTemplateCatalog([]);
    setTemplateNotice(null);
    setTemplatePendingKey(null);
  }

  function handleGraphAccessFailure(error) {
    if (!whatsappGraphAccessRejected(error?.code)) return false;
    if (graphAccessFailureSyncRef.current) return true;

    graphAccessFailureSyncRef.current = true;
    invalidateRemoteChannelState();
    setConnection((current) => current ? {
      ...current,
      connectionStatus: 'ERROR',
    } : null);
    setStatus({ type: 'error', text: error.message });
    void synchronizeChannelHealth({ method: 'POST' })
      .then((refreshed) => {
        if (!refreshed) return;
        setConnection((current) => current ? {
          ...current,
          connectionStatus: 'CONNECTED',
        } : null);
        setStatus({
          type: 'success',
          text: 'La credencial volvió a verificarse con Meta. Actualizamos el estado del canal.',
        });
      })
      .catch(() => undefined)
      .finally(() => {
        graphAccessFailureSyncRef.current = false;
      });
    return true;
  }

  const handleGraphAccessFailureEvent = useEffectEvent((error) => (
    handleGraphAccessFailure(error)
  ));

  async function submitConnection() {
    const signup = signupRef.current;
    if (
      submittedRef.current
      || !signupActiveRef.current
      || !signup.code
      || !signup.whatsappBusinessId
      || !signup.phoneNumberId
    ) return;

    submittedRef.current = true;
    signupActiveRef.current = false;
    setPending(true);
    setStatus({ type: 'progress', text: 'Validando activos y registrando el número…' });
    try {
      const response = await fetch('/api/integrations/whatsapp/embedded-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }) },
        body: JSON.stringify({
          code: signup.code,
          whatsappBusinessId: signup.whatsappBusinessId,
          phoneNumberId: signup.phoneNumberId,
          registrationPin: pinRef.current,
          preparedRevision: preparedRevisionRef.current,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo conectar WhatsApp.');
      if (payload.context?.organizationId !== organizationId || payload.context?.projectId !== projectId || payload.connection?.linked !== true) throw new Error('No se confirmó la conexión en esta empresa y obra. Revisá Integraciones antes de repetir.');
      invalidateRemoteChannelState();
      setFlowEndpoint(undefined);
      setConnection(payload.connection);
      setRegistrationPin('');
      let healthRefreshFailed = false;
      try {
        const refreshed = await synchronizeChannelHealth();
        if (!refreshed) healthRefreshFailed = true;
      } catch {
        healthRefreshFailed = true;
      }
      setStatus({
        type: 'success',
        text: healthRefreshFailed
          ? 'La cuenta quedó vinculada y suscripta. La lectura de salud se actualizará al recargar; falta validar tráfico real.'
          : 'La cuenta quedó vinculada y suscripta. Falta validar tráfico real antes de declararla operativa.',
      });
    } catch (error) {
      submittedRef.current = false;
      setStatus({ type: 'error', text: error.message });
    } finally {
      setPending(false);
    }
  }

  const submitConnectionFromMetaEvent = useEffectEvent(() => {
    void submitConnection();
  });

  useEffect(() => {
    if (!appId) return undefined;

    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        cookie: false,
        xfbml: false,
        version: graphVersion,
      });
      setSdkReady(true);
    };

    const existing = document.getElementById('facebook-jssdk');
    if (existing && window.FB) window.fbAsyncInit();
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://connect.facebook.net/es_LA/sdk.js';
      document.body.appendChild(script);
    }

    function onMessage(event) {
      if (!signupActiveRef.current || !META_ORIGINS.has(event.origin)) return;
      const payload = parseEmbeddedSignupEvent(event.data);
      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (payload.event === 'FINISH') {
        if (!/^\d{5,32}$/.test(payload.data?.waba_id || '') || !/^\d{5,32}$/.test(payload.data?.phone_number_id || '')) return;
        signupRef.current.whatsappBusinessId = payload.data?.waba_id || null;
        signupRef.current.phoneNumberId = payload.data?.phone_number_id || null;
        setStatus({ type: 'progress', text: 'Activos recibidos. Finalizando conexión segura…' });
        submitConnectionFromMetaEvent();
      } else if (payload.event === 'CANCEL') {
        signupActiveRef.current = false; signupRef.current = {};
        setPending(false);
        setStatus({ type: 'info', text: 'El registro fue cancelado antes de compartir los activos.' });
      } else if (payload.event === 'ERROR') {
        signupActiveRef.current = false; signupRef.current = {};
        setPending(false);
        setStatus({ type: 'error', text: 'Meta informó un error durante el registro.' });
      }
    }

    window.addEventListener('message', onMessage);
    return () => { signupActiveRef.current = false; signupGenerationRef.current += 1; window.removeEventListener('message', onMessage); };
  }, [appId, graphVersion]);

  useEffect(() => {
    if (!graphReady || !advancedOpen) return undefined;
    let active = true;
    const remoteChannelEpoch = remoteChannelEpochRef.current;
    const controller = new AbortController();
    readFlowCatalog({ signal: controller.signal })
      .then((payload) => {
        if (!active || remoteChannelEpoch !== remoteChannelEpochRef.current) return;
        setFlowCatalog(payload.catalog);
        setFlowEndpoint(payload.endpoint);
      })
      .catch((error) => {
        if (
          !active
          || remoteChannelEpoch !== remoteChannelEpochRef.current
          || error.name === 'AbortError'
        ) return;
        if (handleGraphAccessFailureEvent(error)) return;
        setFlowNotice({ type: 'error', text: error.message });
      });
    readTemplateCatalog({ signal: controller.signal, scope: { organizationId, projectId } })
      .then((templates) => {
        if (!active || remoteChannelEpoch !== remoteChannelEpochRef.current) return;
        setTemplateCatalog(templates);
      })
      .catch((error) => {
        if (
          !active
          || remoteChannelEpoch !== remoteChannelEpochRef.current
          || error.name === 'AbortError'
        ) return;
        if (handleGraphAccessFailureEvent(error)) return;
        setTemplateNotice({ type: 'error', text: error.message });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [connectionIdentity, graphReady, advancedOpen, organizationId, projectId]);

  function startSignup() {
    if (internalWorkspace || pending || lifecycleContextBlocked || signupActiveRef.current) return;
    if (preparedWorkspace?.allowed !== true) { setStatus({ type: 'error', text: 'Guardá la preparación y abrí la primera obra elegida antes de autorizar.' }); return; }
    preparedRevisionRef.current = preparedWorkspace.revision;
    if (!/^\d{6}$/.test(registrationPin)) {
      setStatus({ type: 'error', text: 'Definí un PIN de 6 números antes de conectar.' });
      return;
    }
    if (!window.FB || !sdkReady || !configId) {
      setStatus({ type: 'error', text: 'La configuración de Meta todavía no está disponible.' });
      return;
    }

    const generation = ++signupGenerationRef.current; signupActiveRef.current = true;
    signupRef.current = { code: null, whatsappBusinessId: null, phoneNumberId: null };
    pinRef.current = registrationPin;
    submittedRef.current = false;
    setPending(true);
    setStatus({ type: 'progress', text: 'Completá el registro seguro en la ventana de Meta.' });
    window.FB.login((response) => {
      if (!signupActiveRef.current || generation !== signupGenerationRef.current) return;
      if (response.authResponse?.code) {
        signupRef.current.code = response.authResponse.code;
        void submitConnection();
        return;
      }
      setPending(false);
      signupActiveRef.current = false;
      setStatus({ type: 'info', text: 'Meta no autorizó la conexión. No se guardó ningún dato.' });
    }, {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {} },
    });
  }

  async function disconnect() {
    if (!window.confirm('¿Desactivar WhatsApp en esta obra? Los activos seguirán siendo tuyos en Meta.')) return;
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch('/api/integrations/whatsapp/embedded-signup', {
        method: 'DELETE',
        headers: evidenceScopeHeaders({ organizationId, projectId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo desactivar la conexión.');
      }
      invalidateRemoteChannelState();
      setConnection((current) => current ? {
        ...current,
        enabled: false,
        connectionStatus: 'DISABLED',
      } : null);
      let healthRefreshFailed = false;
      try {
        const refreshed = await synchronizeChannelHealth();
        if (!refreshed) healthRefreshFailed = true;
      } catch {
        healthRefreshFailed = true;
      }
      setStatus({
        type: 'success',
        text: healthRefreshFailed
          ? 'La conexión local fue desactivada y las credenciales eliminadas. La lectura de salud se actualizará al recargar.'
          : 'La conexión local fue desactivada y las credenciales eliminadas.',
      });
    } catch (error) {
      setStatus({ type: 'error', text: error.message });
    } finally {
      setPending(false);
    }
  }

  async function verifyChannel() {
    if (lifecycleContextBlocked || healthPending) return;
    setHealthPending(true);
    setStatus({ type: 'progress', text: 'Verificando token, permisos, teléfono y suscripción en Meta…' });
    try {
      const refreshed = await synchronizeChannelHealth({ method: 'POST' });
      if (!refreshed) return;
      setStatus({
        type: 'success',
        text: 'Cuenta y webhook revalidados. El estado operativo depende de evidencia real en ambos sentidos.',
      });
    } catch (error) {
      setStatus({ type: 'error', text: error.message });
    } finally {
      setHealthPending(false);
    }
  }

  async function refreshFlows() {
    const remoteChannelEpoch = remoteChannelEpochRef.current;
    setFlowPendingKey('refresh');
    setFlowNotice({ type: 'progress', text: 'Consultando el estado real en Meta…' });
    try {
      const [payload, templates] = await Promise.all([
        readFlowCatalog(),
        readTemplateCatalog({ scope: { organizationId, projectId } }),
      ]);
      if (remoteChannelEpoch !== remoteChannelEpochRef.current) return;
      setFlowCatalog(payload.catalog);
      setFlowEndpoint(payload.endpoint || null);
      setTemplateCatalog(templates);
      setTemplateNotice(null);
      setFlowNotice({
        type: 'success',
        text: 'Flows, Data Endpoint y plantillas sincronizados con la cuenta de WhatsApp.',
      });
    } catch (error) {
      if (handleGraphAccessFailure(error)) return;
      if (remoteChannelEpoch === remoteChannelEpochRef.current) {
        setFlowNotice({ type: 'error', text: error.message });
      }
    } finally {
      if (remoteChannelEpoch === remoteChannelEpochRef.current) setFlowPendingKey(null);
    }
  }

  async function provisionFlowDraft(blueprintKey) {
    const remoteChannelEpoch = remoteChannelEpochRef.current;
    setFlowPendingKey(blueprintKey);
    setFlowNotice({ type: 'progress', text: 'Validando y sincronizando el borrador con Meta…' });
    try {
      const response = await fetch('/api/integrations/whatsapp/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprintKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw integrationResponseError(payload, 'No se pudo preparar el Flow.');
      }
      if (remoteChannelEpoch !== remoteChannelEpochRef.current) return;
      if (!isPlainRecord(payload.catalogItem)) {
        throw new Error('Meta respondió sin el estado reconciliado del Flow.');
      }
      setFlowCatalog((current) => current.map((item) => (
        item.key === blueprintKey ? payload.catalogItem : item
      )));
      setFlowEndpoint(isPlainRecord(payload.endpoint) ? payload.endpoint : null);
      setFlowNotice({
        type: 'success',
        text: payload.catalogItem.remote?.status === 'PUBLISHED'
          ? payload.catalogItem.runtimeActive
            ? 'El Flow publicado y su canal dinámico quedaron verificados.'
            : 'El Flow publicado se preservó sin cambios. Para usar el Data Endpoint necesita una nueva versión.'
          : 'Borrador validado y guardado en la cuenta de WhatsApp. Publicarlo seguirá requiriendo una decisión explícita.',
      });
    } catch (error) {
      if (handleGraphAccessFailure(error)) return;
      if (remoteChannelEpoch === remoteChannelEpochRef.current) {
        setFlowNotice({ type: 'error', text: error.message });
      }
    } finally {
      if (remoteChannelEpoch === remoteChannelEpochRef.current) setFlowPendingKey(null);
    }
  }


  return (
    <>
      <div className={styles.grid}>
      <section className={styles.channelCard}>
        <div className={styles.cardTop}>
          <div className={styles.whatsappMark} aria-hidden="true">
            <i className="fa-brands fa-whatsapp" />
          </div>
          <div>
            <p className={styles.eyebrow}>Meta · Cloud API</p>
            <h2>WhatsApp Business</h2>
          </div>
          <span className={`${styles.state} ${healthStateClass}`}>
            {lifecycleBlocked ? (lifecycleReauthorization ? 'Reautorizar WhatsApp' : 'Estado por verificar') : channelHealth?.label || 'Estado pendiente'}
          </span>
        </div>

        <p className={styles.summary}>
          Reportes, fotos, ubicaciones y WhatsApp Flows entran por la cuenta propia de tu empresa
          y se convierten en evidencia trazable dentro de la obra correcta.
        </p>

        {!internalWorkspace && <TenantWhatsAppWorkspace organizationId={organizationId} projectId={projectId} companyName={companyName}
          onState={setPreparedWorkspace} connectionPending={pending} />}
        {linked && !internalWorkspace && <ChannelRecoveryPanel key={organizationId + ':' + projectId}
          organizationId={organizationId} projectId={projectId} refreshKey={healthDiagnostics?.checkedAt || ''}
          busy={pending || healthPending || Boolean(flowPendingKey) || Boolean(templatePendingKey)}
          onStatus={setLifecycleView} onVerify={verifyChannel} />}
        <div id="customer-whatsapp-authorization" tabIndex={-1}>
        <WhatsAppConnectExperience companyName={companyName} projectName={projectName} internalWorkspace={internalWorkspace}
          linked={linked} reconnectRequired={reconnectRequired} configured={configured} sdkReady={sdkReady}
          pending={pending} blocked={healthPending || lifecycleContextBlocked || Boolean(flowPendingKey) || Boolean(templatePendingKey) || preparedWorkspace?.allowed !== true}
          pin={registrationPin} onPinChange={value => { pinRef.current = value; setRegistrationPin(value); }}
          onConnect={startSignup} diagnostics={healthDiagnostics} canReadInbox={canReadInbox} />
        </div>
        {pilotImportEnabled && <p className={styles.pilotTargetSummary}>El número piloto se administra en <a href="#platform-technical-tools">Administración técnica</a>. La autorización de clientes se realiza con Meta.</p>}
        <details className={styles.technicalTools}><summary>Ver estado detallado de la conexión</summary>
        {channelHealth && !lifecycleBlocked && (
          <section className={styles.readinessPanel} aria-labelledby="whatsapp-readiness-title">
            <div className={styles.readinessHeader}>
              <div>
                <span>Activación verificable</span>
                <strong id="whatsapp-readiness-title">{channelHealth.summary}</strong>
              </div>
              <b>{channelHealth.progress?.percentage || 0}%</b>
            </div>
            <div
              className={styles.readinessProgress}
              role="progressbar"
              aria-label="Progreso de activación del canal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={channelHealth.progress?.percentage || 0}
            >
              <i style={{ width: `${channelHealth.progress?.percentage || 0}%` }} />
            </div>
            <ol className={styles.readinessStages}>
              {(channelHealth.progress?.stages || []).map((stage) => (
                <li key={stage.key} data-state={stage.status.toLowerCase()}>
                  <i className={`fa-solid ${readinessIcon(stage.status)}`} aria-hidden="true" />
                  <span>{stage.label}</span>
                </li>
              ))}
            </ol>
            <div className={styles.readinessFooter}>
              <div>
                <span>Siguiente acción</span>
                <strong>{channelHealth.nextAction?.label || 'Canal completamente validado'}</strong>
              </div>
              <div className={styles.healthEvidence}>
                <span>Entrada firmada: {formatDate(healthDiagnostics?.lastSignedInboundAt)}</span>
                <span>Salida Meta: {formatDate(healthDiagnostics?.lastConfirmedOutboundAt)}</span>
                <span>
                  Cola: {healthDiagnostics?.pendingEvents || 0} pendientes · {healthDiagnostics?.failedEvents || 0} fallidos
                </span>
              </div>
            </div>
          </section>
        )}

        {linked && (
          <div className={styles.connectionPanel}>
            <div>
              <span>Número</span>
              <strong>{connection.displayPhoneNumber || 'Verificado por Meta'}</strong>
            </div>
            <div>
              <span>Nombre verificado</span>
              <strong>{connection.verifiedBusinessName || 'Pendiente en Meta'}</strong>
            </div>
            <div>
              <span>WABA</span>
              <strong>{connection.whatsappBusinessId}</strong>
            </div>
            <div>
              <span>Última validación</span>
              <strong>{formatDate(connection.lastVerifiedAt)}</strong>
            </div>
          </div>
        )}

        </details>
        {status && (
          <div className={`${styles.notice} ${styles[status.type]}`} role="status">
            {status.text}
          </div>
        )}
        {!platformReady && (
          <div className={`${styles.notice} ${styles.info}`} role="status">
            Canal en activación controlada. El alta se habilitará cuando la validación firmada
            de Meta esté completa; no necesitás compartir credenciales con ObraSaaS.
          </div>
        )}
        <div className={styles.actions}>
          <div className={styles.channelActionButtons}>
            {linked && connectionActive && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={verifyChannel}
                disabled={
                  pending
                  || healthPending
                  || Boolean(flowPendingKey)
                  || Boolean(templatePendingKey)
                }
              >
                <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                {healthPending ? 'Verificando…' : 'Verificar con Meta'}
              </button>
            )}
            {linked && connectionActive && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={disconnect}
                disabled={
                  pending
                  || healthPending
                  || Boolean(flowPendingKey)
                  || Boolean(templatePendingKey)
                }
              >
                Desactivar en esta obra
              </button>
            )}
          </div>
          <span>{configured ? 'Autorización con Meta configurada · pendiente de validación comercial' : 'Habilitación a cargo de ObraSaaS'}</span>
        </div>
      </section>

      <aside className={styles.securityCard}>
        <p className={styles.eyebrow}>Arquitectura de confianza</p>
        <h2>Separación real por tenant</h2>
        <ul>
          <li><i className="fa-solid fa-key" /> Tokens cifrados con AES-256-GCM.</li>
          <li><i className="fa-solid fa-building-shield" /> Cada empresa conserva su WABA y su número.</li>
          <li><i className="fa-solid fa-diagram-project" /> Cada evento se resuelve contra la obra autorizada.</li>
          <li><i className="fa-solid fa-file-shield" /> Firmas de webhook y cambios auditados.</li>
        </ul>
        <div className={styles.boundary}>
          <span>ObraSaaS procesa</span>
          <strong>Mensajes · Flows · estados · evidencia</strong>
          <span>ObraSaaS no comparte</span>
          <strong>Credenciales · números · datos entre empresas</strong>
        </div>
      </aside>
      </div>

      <details className={styles.technicalTools} onToggle={event => setAdvancedOpen(event.currentTarget.open)}><summary>Formularios y automatizaciones · configuración avanzada</summary>
      <section className={styles.flowsSection} aria-labelledby="whatsapp-flows-title">
        <header className={styles.flowsHeader}>
          <div>
            <p className={styles.eyebrow}>Experiencias nativas · sin salir de WhatsApp</p>
            <h2 id="whatsapp-flows-title">WhatsApp Flows por obra</h2>
            <p>
              Blueprints propios para obra, aislados por WABA, con Flow JSON 7.3 y Data API 4.0.
              El contexto sale de la obra autorizada; nunca se publica sin una decisión explícita.
            </p>
          </div>
          <div className={styles.flowHeaderActions}>
            <span className={styles.versionBadge}>Flow JSON 7.3 · Data API 4.0</span>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={refreshFlows}
              disabled={
                !graphReady
                || pending
                || healthPending
                || Boolean(flowPendingKey)
                || Boolean(templatePendingKey)
              }
            >
              <i className="fa-solid fa-arrows-rotate" aria-hidden="true" />
              Sincronizar
            </button>
          </div>
        </header>

        <div
          className={styles.flowTrustBar}
          role="group"
          aria-label="Estado del canal cifrado de WhatsApp Flows"
        >
          <div data-state={endpointPresentation.tone}>
            <i className="fa-solid fa-lock" aria-hidden="true" />
            <span>Data Endpoint</span>
            <strong>{endpointPresentation.label}</strong>
          </div>
          <div data-state={endpointPresentation.tone}>
            <i className="fa-solid fa-key" aria-hidden="true" />
            <span>Clave por conexión</span>
            <strong title={endpointFingerprint ? `SHA-256 ${endpointFingerprint}` : undefined}>
              {endpointFingerprint
                ? `SHA-256 ${endpointFingerprint.slice(0, 12)}…`
                : 'RSA-2048 dedicada'}
            </strong>
          </div>
          <div data-state={graphReady ? 'ready' : linked ? 'blocked' : 'idle'}>
            <i className="fa-solid fa-building-shield" aria-hidden="true" />
            <span>Límite tenant</span>
            <strong>{connection?.verifiedBusinessName || 'WABA propio de la empresa'}</strong>
          </div>
        </div>

        <div className={styles.flowGrid}>
          {presentedFlowCatalog.map((flow) => {
            const remoteStatus = flow.remote.status;
            const isPublished = remoteStatus === 'PUBLISHED';
            const runtimeActive = Boolean(flow.runtimeActive);
            const runtimePresentation = flowRuntimePresentation(
              flow,
              remoteVerificationUnavailable,
            );
            const publishedHealthBlocked = isPublished
              && flow.remote.healthStatus?.blocked === true;
            const publishedCanReconcile = isPublished
              && flow.remoteDataEndpointReady === true
              && !publishedHealthBlocked;
            const isPending = flowPendingKey === flow.key;
            const templateEntry = presentedTemplateCatalog.find((item) => item.blueprintKey === flow.key);
            const template = templateEntry?.template || null;
            const templateState = templatePresentation(
              template,
              remoteVerificationUnavailable,
            );
            const actionLabel = flowActionLabel({
              isPending,
              isPublished,
              publishedCanReconcile,
              publishedHealthBlocked,
              remoteStatus,
              runtimeActive,
              verificationUnavailable: remoteVerificationUnavailable,
            });
            return (
              <article className={styles.flowCard} key={flow.key}>
                <div className={styles.flowCardTop}>
                  <div className={styles.flowIcon} aria-hidden="true">
                    <i className={flow.flowType === 'incident'
                      ? 'fa-solid fa-triangle-exclamation'
                      : 'fa-solid fa-helmet-safety'} />
                  </div>
                  <span className={`${styles.flowState} ${styles[flowStatusClass(remoteStatus, remoteVerificationUnavailable)]}`}>
                    {flowStatusLabel(remoteStatus, remoteVerificationUnavailable)}
                  </span>
                </div>
                <p className={styles.flowScreen}>{flow.screenId}</p>
                <h3>{flow.title}</h3>
                <p>{flow.description}</p>
                <ul className={styles.flowCapabilities} aria-label="Datos incluidos">
                  {flow.capabilities.map((capability) => <li key={capability}>{capability}</li>)}
                </ul>
                <div className={styles.flowRuntimeMeta}>
                  <span>
                    <i className="fa-solid fa-code-branch" aria-hidden="true" />
                    Data API {flow.remote.dataApiVersion || flow.dataApiVersion}
                  </span>
                  <span data-state={runtimePresentation.tone}>
                    <i className={runtimeActive
                      ? 'fa-solid fa-circle-check'
                      : 'fa-regular fa-clock'} aria-hidden="true" />
                    {runtimePresentation.label}
                  </span>
                  <span data-state={templateState.tone}>
                    <i className={template?.status === 'APPROVED'
                      ? 'fa-solid fa-circle-check'
                      : 'fa-regular fa-message'} aria-hidden="true" />
                    {templateState.label}
                  </span>
                </div>
                {flow.remote.validationErrors.length > 0 && (
                  <div className={`${styles.notice} ${styles.error}`} role="alert">
                    {flow.remote.validationErrors[0].message}
                  </div>
                )}
                <div className={styles.flowCardFooter}>
                  <div>
                    <span>Activo Meta</span>
                    <strong>
                      {flow.remote.id
                        || (remoteVerificationUnavailable
                          ? 'Estado no verificado'
                          : 'Se crea al conectar un WABA')}
                    </strong>
                  </div>
                  <div className={styles.flowActions}>
                    <button
                      type="button"
                      className={styles.flowButton}
                      onClick={() => provisionFlowDraft(flow.key)}
                      disabled={
                        !graphReady
                        || !platformReady
                        || pending
                        || healthPending
                        || Boolean(flowPendingKey)
                        || runtimeActive
                        || (isPublished && !publishedCanReconcile)
                      }
                    >
                      {actionLabel}
                    </button>
                    <TemplateReviewControl
                      key={flow.key + ':' + connectionIdentity + ':' + templateReviewEpoch}
                      flow={flow} organizationId={organizationId} projectId={projectId}
                      companyName={companyName} projectName={projectName} canReadInbox={canReadInbox}
                      disabled={!graphReady || !platformReady || pending || healthPending || Boolean(flowPendingKey) || Boolean(templatePendingKey)}
                      onBusy={value => setTemplatePendingKey(current => value ? flow.key : current === flow.key ? null : current)}
                      onGraphError={handleGraphAccessFailure}
                      onCatalog={(catalog, partial) => {
                        setTemplateCatalog(current => partial ? [...current.filter(row => !catalog.some(item => item.blueprintKey === row.blueprintKey)), ...catalog] : catalog);
                        setTemplateNotice(null);
                      }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {presentedFlowNotice && (
          <div className={`${styles.notice} ${styles[presentedFlowNotice.type]}`} role="status">
            {presentedFlowNotice.text}
          </div>
        )}

        {presentedTemplateNotice && (
          <div className={`${styles.notice} ${styles[presentedTemplateNotice.type]}`} role="status">
            {presentedTemplateNotice.text}
          </div>
        )}

        <div className={styles.flowGovernance}>
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          <div>
            <strong>Gobernanza antes de automatización</strong>
            <span>
              Publicar en Meta vuelve el JSON inmutable. Por eso esta beta valida y provisiona borradores,
              pero reserva la publicación para cuando exista número real, prueba end-to-end y aprobación del tenant.
              Las plantillas se versionan por contenido y sólo se habilitan después de la aprobación de Meta.
            </span>
          </div>
        </div>
      </section>
      </details>
    </>
  );
}
