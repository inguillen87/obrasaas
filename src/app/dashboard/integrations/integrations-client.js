'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './integrations.module.css';

const META_ORIGINS = new Set([
  'https://www.facebook.com',
  'https://web.facebook.com',
]);

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

function flowStatusLabel(status) {
  if (status === 'PUBLISHED') return 'Publicado';
  if (status === 'DRAFT') return 'Borrador validado';
  if (status === 'NOT_CREATED') return 'Sin crear';
  return status === 'UNKNOWN' ? 'Revisar' : status;
}

function flowStatusClass(status) {
  if (status === 'PUBLISHED') return 'flowPublished';
  if (status === 'DRAFT') return 'flowDraft';
  if (status === 'NOT_CREATED') return 'flowMissing';
  return 'flowBlocked';
}

async function readFlowCatalog() {
  const response = await fetch('/api/integrations/whatsapp/flows', { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'No se pudieron consultar los Flows.');
  return payload.catalog;
}

export default function IntegrationsClient({
  appId,
  configId,
  platformReady,
  initialConnection,
  initialFlowCatalog,
}) {
  const [connection, setConnection] = useState(initialConnection);
  const [sdkReady, setSdkReady] = useState(false);
  const [registrationPin, setRegistrationPin] = useState('');
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(false);
  const [flowCatalog, setFlowCatalog] = useState(initialFlowCatalog);
  const [flowPendingKey, setFlowPendingKey] = useState(null);
  const [flowNotice, setFlowNotice] = useState(null);
  const signupRef = useRef({ code: null, whatsappBusinessId: null, phoneNumberId: null });
  const pinRef = useRef('');
  const submittedRef = useRef(false);
  const connected = connection?.enabled && connection.connectionStatus === 'CONNECTED';
  const configured = Boolean(appId && configId && platformReady);

  async function submitConnection() {
    const signup = signupRef.current;
    if (
      submittedRef.current
      || !signup.code
      || !signup.whatsappBusinessId
      || !signup.phoneNumberId
    ) return;

    submittedRef.current = true;
    setPending(true);
    setStatus({ type: 'progress', text: 'Validando activos y registrando el número…' });
    try {
      const response = await fetch('/api/integrations/whatsapp/embedded-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: signup.code,
          whatsappBusinessId: signup.whatsappBusinessId,
          phoneNumberId: signup.phoneNumberId,
          registrationPin: pinRef.current,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo conectar WhatsApp.');
      setConnection(payload.connection);
      setRegistrationPin('');
      setStatus({
        type: 'success',
        text: 'WhatsApp quedó conectado, suscripto al webhook y aislado para este tenant.',
      });
    } catch (error) {
      submittedRef.current = false;
      setStatus({ type: 'error', text: error.message });
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!appId) return undefined;

    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        cookie: false,
        xfbml: false,
        version: 'v25.0',
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
      if (!META_ORIGINS.has(event.origin)) return;
      const payload = parseEmbeddedSignupEvent(event.data);
      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (payload.event === 'FINISH') {
        signupRef.current.whatsappBusinessId = payload.data?.waba_id || null;
        signupRef.current.phoneNumberId = payload.data?.phone_number_id || null;
        setStatus({ type: 'progress', text: 'Activos recibidos. Finalizando conexión segura…' });
        void submitConnection();
      } else if (payload.event === 'CANCEL') {
        setPending(false);
        setStatus({ type: 'info', text: 'El registro fue cancelado antes de compartir los activos.' });
      } else if (payload.event === 'ERROR') {
        setPending(false);
        setStatus({ type: 'error', text: payload.data?.error_message || 'Meta informó un error durante el registro.' });
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [appId]);

  useEffect(() => {
    if (!connected) return undefined;
    let active = true;
    readFlowCatalog()
      .then((catalog) => {
        if (active) setFlowCatalog(catalog);
      })
      .catch((error) => {
        if (active) setFlowNotice({ type: 'error', text: error.message });
      });
    return () => { active = false; };
  }, [connected]);

  function startSignup() {
    if (!/^\d{6}$/.test(registrationPin)) {
      setStatus({ type: 'error', text: 'Definí un PIN de 6 números antes de conectar.' });
      return;
    }
    if (!window.FB || !sdkReady || !configId) {
      setStatus({ type: 'error', text: 'La configuración de Meta todavía no está disponible.' });
      return;
    }

    signupRef.current = { code: null, whatsappBusinessId: null, phoneNumberId: null };
    pinRef.current = registrationPin;
    submittedRef.current = false;
    setPending(true);
    setStatus({ type: 'progress', text: 'Completá el registro seguro en la ventana de Meta.' });
    window.FB.login((response) => {
      if (response.authResponse?.code) {
        signupRef.current.code = response.authResponse.code;
        void submitConnection();
        return;
      }
      setPending(false);
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
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo desactivar la conexión.');
      }
      setConnection((current) => current ? {
        ...current,
        enabled: false,
        connectionStatus: 'DISABLED',
        tokenLastFour: null,
      } : null);
      setFlowCatalog(initialFlowCatalog);
      setFlowNotice(null);
      setStatus({ type: 'success', text: 'La conexión local fue desactivada y las credenciales eliminadas.' });
    } catch (error) {
      setStatus({ type: 'error', text: error.message });
    } finally {
      setPending(false);
    }
  }

  async function refreshFlows() {
    setFlowPendingKey('refresh');
    setFlowNotice({ type: 'progress', text: 'Consultando el estado real en Meta…' });
    try {
      setFlowCatalog(await readFlowCatalog());
      setFlowNotice({ type: 'success', text: 'Estado de Flows sincronizado con la cuenta de WhatsApp.' });
    } catch (error) {
      setFlowNotice({ type: 'error', text: error.message });
    } finally {
      setFlowPendingKey(null);
    }
  }

  async function provisionFlowDraft(blueprintKey) {
    setFlowPendingKey(blueprintKey);
    setFlowNotice({ type: 'progress', text: 'Validando y sincronizando el borrador con Meta…' });
    try {
      const response = await fetch('/api/integrations/whatsapp/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprintKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo preparar el Flow.');
      setFlowCatalog((current) => current.map((item) => (
        item.key === blueprintKey ? payload.catalogItem : item
      )));
      setFlowNotice({
        type: 'success',
        text: payload.result.flow.status === 'PUBLISHED'
          ? 'El Flow ya estaba publicado. No se modificó ningún activo irreversible.'
          : 'Borrador validado y guardado en la cuenta de WhatsApp. Publicarlo seguirá requiriendo una decisión explícita.',
      });
    } catch (error) {
      setFlowNotice({ type: 'error', text: error.message });
    } finally {
      setFlowPendingKey(null);
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
          <span className={`${styles.state} ${connected ? styles.connected : styles.pendingState}`}>
            {connected ? 'Conectado' : connection?.connectionStatus === 'ERROR' ? 'Revisar' : 'Sin conectar'}
          </span>
        </div>

        <p className={styles.summary}>
          Reportes, fotos, ubicaciones y WhatsApp Flows entran por la cuenta propia de tu empresa
          y se convierten en evidencia trazable dentro de la obra correcta.
        </p>

        {connected ? (
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
        ) : (
          <div className={styles.connectFlow}>
            <label htmlFor="whatsapp-pin">
              <span>PIN de registro del número</span>
              <input
                id="whatsapp-pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                placeholder="6 números"
                value={registrationPin}
                onChange={(event) => {
                  const nextPin = event.target.value.replace(/\D/g, '').slice(0, 6);
                  pinRef.current = nextPin;
                  setRegistrationPin(nextPin);
                }}
              />
              <small>No es un código SMS. Es el PIN de 2 pasos que protegerá el número en Meta.</small>
            </label>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={startSignup}
              disabled={!configured || !sdkReady || pending}
            >
              <i className="fa-brands fa-meta" aria-hidden="true" />
              {pending ? 'Conectando…' : 'Conectar con Meta'}
            </button>
          </div>
        )}

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
        {connection?.lastError && !connected && (
          <div className={`${styles.notice} ${styles.error}`} role="alert">
            Último intento: {connection.lastError}
          </div>
        )}

        <div className={styles.actions}>
          {connected && (
            <button type="button" className={styles.secondaryButton} onClick={disconnect} disabled={pending}>
              Desactivar en esta obra
            </button>
          )}
          <span>{configured ? 'Embedded Signup v4 listo' : 'Activación técnica pendiente'}</span>
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

      <section className={styles.flowsSection} aria-labelledby="whatsapp-flows-title">
        <header className={styles.flowsHeader}>
          <div>
            <p className={styles.eyebrow}>Experiencias nativas · sin salir de WhatsApp</p>
            <h2 id="whatsapp-flows-title">WhatsApp Flows operativos</h2>
            <p>
              Blueprints propios para obra, aislados por WABA y compilados con Flow JSON 7.3.
              ObraSaaS crea borradores reversibles; nunca publica un Flow sin una decisión explícita.
            </p>
          </div>
          <div className={styles.flowHeaderActions}>
            <span className={styles.versionBadge}>Flow JSON 7.3</span>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={refreshFlows}
              disabled={!connected || Boolean(flowPendingKey)}
            >
              <i className="fa-solid fa-arrows-rotate" aria-hidden="true" />
              Sincronizar
            </button>
          </div>
        </header>

        <div className={styles.flowGrid}>
          {flowCatalog.map((flow) => {
            const remoteStatus = flow.remote.status;
            const isPublished = remoteStatus === 'PUBLISHED';
            const isPending = flowPendingKey === flow.key;
            return (
              <article className={styles.flowCard} key={flow.key}>
                <div className={styles.flowCardTop}>
                  <div className={styles.flowIcon} aria-hidden="true">
                    <i className={flow.flowType === 'incident'
                      ? 'fa-solid fa-triangle-exclamation'
                      : 'fa-solid fa-helmet-safety'} />
                  </div>
                  <span className={`${styles.flowState} ${styles[flowStatusClass(remoteStatus)]}`}>
                    {flowStatusLabel(remoteStatus)}
                  </span>
                </div>
                <p className={styles.flowScreen}>{flow.screenId}</p>
                <h3>{flow.title}</h3>
                <p>{flow.description}</p>
                <ul className={styles.flowCapabilities} aria-label="Datos incluidos">
                  {flow.capabilities.map((capability) => <li key={capability}>{capability}</li>)}
                </ul>
                {flow.remote.validationErrors.length > 0 && (
                  <div className={`${styles.notice} ${styles.error}`} role="alert">
                    {flow.remote.validationErrors[0].message}
                  </div>
                )}
                <div className={styles.flowCardFooter}>
                  <div>
                    <span>Activo Meta</span>
                    <strong>{flow.remote.id || 'Se crea al conectar un WABA'}</strong>
                  </div>
                  <button
                    type="button"
                    className={styles.flowButton}
                    onClick={() => provisionFlowDraft(flow.key)}
                    disabled={!connected || !platformReady || Boolean(flowPendingKey) || isPublished}
                  >
                    {isPending
                      ? 'Validando…'
                      : isPublished
                        ? 'Publicado en Meta'
                        : remoteStatus === 'DRAFT'
                          ? 'Actualizar borrador'
                          : 'Crear borrador'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {flowNotice && (
          <div className={`${styles.notice} ${styles[flowNotice.type]}`} role="status">
            {flowNotice.text}
          </div>
        )}

        <div className={styles.flowGovernance}>
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          <div>
            <strong>Gobernanza antes de automatización</strong>
            <span>
              Publicar en Meta vuelve el JSON inmutable. Por eso esta beta valida y provisiona borradores,
              pero reserva la publicación para cuando exista número real, prueba end-to-end y aprobación del tenant.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
