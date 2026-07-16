'use client';

import { useMemo, useState } from 'react';

import styles from './integrations.module.css';

function formatDate(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function AiProcessingControls({ initialSettings, canManage }) {
  const [settings, setSettings] = useState(initialSettings);
  const [draft, setDraft] = useState({
    supervisorEnabled: initialSettings.supervisorEnabled,
    audioTranscriptionEnabled: initialSettings.audioTranscriptionEnabled,
  });
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(null);
  const changed = draft.supervisorEnabled !== settings.supervisorEnabled
    || draft.audioTranscriptionEnabled !== settings.audioTranscriptionEnabled;
  const requiresAttestation = useMemo(() => (
    (draft.supervisorEnabled && !settings.supervisorEnabled)
    || (draft.audioTranscriptionEnabled && !settings.audioTranscriptionEnabled)
  ), [draft, settings]);

  function toggle(key) {
    if (!canManage || pending) return;
    setDraft((current) => ({ ...current, [key]: !current[key] }));
    setAuthorizationConfirmed(false);
    setNotice(null);
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!canManage || !changed || pending || (requiresAttestation && !authorizationConfirmed)) {
      return;
    }
    setPending(true);
    setNotice({ type: 'progress', text: 'Guardando el límite de procesamiento de la organización…' });
    try {
      const response = await fetch('/api/tenant/ai-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          organizationAuthorizationConfirmed: requiresAttestation
            ? authorizationConfirmed
            : false,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar la configuración.');
      setSettings(payload.settings);
      setDraft({
        supervisorEnabled: payload.settings.supervisorEnabled,
        audioTranscriptionEnabled: payload.settings.audioTranscriptionEnabled,
      });
      setAuthorizationConfirmed(false);
      setNotice({
        type: 'success',
        text: payload.settings.supervisorEnabled || payload.settings.audioTranscriptionEnabled
          ? 'Procesamiento actualizado y atribuido al administrador de la organización.'
          : 'Procesamiento con OpenAI desactivado para esta organización.',
      });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.aiSection} aria-labelledby="ai-processing-title">
      <header className={styles.aiHeader}>
        <div>
          <p className={styles.eyebrow}>Privacidad y procesamiento externo</p>
          <h2 id="ai-processing-title">Funciones con OpenAI</h2>
          <p>
            Están apagadas hasta que un administrador las active. Cada finalidad se controla
            por separado y desactivarla impide nuevas solicitudes a OpenAI.
          </p>
        </div>
        <span className={`${styles.state} ${
          settings.supervisorEnabled || settings.audioTranscriptionEnabled
            ? styles.connected
            : styles.pendingState
        }`}>
          {settings.supervisorEnabled || settings.audioTranscriptionEnabled
            ? 'Activación parcial o total'
            : 'Sin procesamiento IA'}
        </span>
      </header>

      <form onSubmit={saveSettings}>
        <div className={styles.aiOptions}>
          <button
            type="button"
            className={`${styles.aiOption} ${draft.supervisorEnabled ? styles.aiOptionEnabled : ''}`}
            onClick={() => toggle('supervisorEnabled')}
            disabled={!canManage || pending}
            aria-pressed={draft.supervisorEnabled}
          >
            <span className={styles.aiToggle} aria-hidden="true"><i /></span>
            <span>
              <strong>Supervisor IA</strong>
              <small>
                Envía la consulta, el historial reciente y un contexto acotado de la obra activa.
              </small>
            </span>
          </button>
          <button
            type="button"
            className={`${styles.aiOption} ${draft.audioTranscriptionEnabled ? styles.aiOptionEnabled : ''}`}
            onClick={() => toggle('audioTranscriptionEnabled')}
            disabled={!canManage || pending}
            aria-pressed={draft.audioTranscriptionEnabled}
          >
            <span className={styles.aiToggle} aria-hidden="true"><i /></span>
            <span>
              <strong>Transcripción de audios</strong>
              <small>
                Envía a OpenAI los nuevos audios compatibles recibidos por WhatsApp para obtener texto.
              </small>
            </span>
          </button>
        </div>

        {requiresAttestation && (
          <label className={styles.aiAttestation}>
            <input
              type="checkbox"
              checked={authorizationConfirmed}
              onChange={(event) => setAuthorizationConfirmed(event.target.checked)}
            />
            <span>
              Confirmo, como administrador, que la organización informó a las personas involucradas
              y determinó una base legal o autorización aplicable para esta finalidad. Esta declaración
              no sustituye el consentimiento individual cuando la ley lo exige.
            </span>
          </label>
        )}

        <div className={styles.aiFooter}>
          <div>
            <a href="/privacy#openai-processing">Ver datos enviados, proveedor y retención</a>
            {settings.authorizationAttestedAt && (
              <span>
                Última atestación: {formatDate(settings.authorizationAttestedAt)}
              </span>
            )}
            {!canManage && <span>Solo un administrador del tenant puede cambiar este límite.</span>}
          </div>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={
              !canManage
              || !changed
              || pending
              || (requiresAttestation && !authorizationConfirmed)
            }
          >
            {pending ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      </form>

      {notice && (
        <div className={`${styles.notice} ${styles[notice.type]}`} role="status">
          {notice.text}
        </div>
      )}
    </section>
  );
}
