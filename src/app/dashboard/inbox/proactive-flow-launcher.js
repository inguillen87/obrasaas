'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import styles from './inbox.module.css';

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function textValue(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (text) return text;
  }
  return '';
}

function createIdempotencyKey() {
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `inbox-flow-${suffix}`;
}

function maskedPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `•••• ${digits.slice(-4)}`;
}

async function readResponse(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(textValue(payload.error, fallback));
    error.status = response.status;
    error.code = textValue(payload.code).toUpperCase();
    throw error;
  }
  return payload;
}

function normalizePayload(payload) {
  const source = objectValue(payload);
  const capability = objectValue(source.capability);
  return {
    capability: {
      allowed: capability.allowed === true,
      code: textValue(capability.code).toUpperCase(),
      reason: textValue(capability.reason),
    },
    recipient: source.recipient
      ? {
          name: textValue(source.recipient.name, 'Operario de la obra'),
          phone: textValue(source.recipient.phone),
        }
      : null,
    catalog: (Array.isArray(source.catalog) ? source.catalog : [])
      .map((item) => {
        const flow = objectValue(item);
        const template = objectValue(flow.template);
        const key = textValue(flow.key);
        return key
          ? {
              key,
              title: textValue(flow.title, key),
              description: textValue(flow.description),
              capabilities: Array.isArray(flow.capabilities)
                ? flow.capabilities.map((value) => textValue(value)).filter(Boolean)
                : [],
              expiresInMinutes: Math.max(1, Number(flow.expiresInMinutes) || 30),
               canSend: flow.canSend === true,
               unresolvedAttempt: flow.unresolvedAttempt
                 ? {
                     messageId: textValue(flow.unresolvedAttempt.messageId),
                     status: textValue(flow.unresolvedAttempt.status, 'unknown').toLowerCase(),
                     recordedAt: textValue(flow.unresolvedAttempt.recordedAt),
                   }
                 : null,
               template: {
                status: textValue(template.status, 'NOT_CREATED').toUpperCase(),
                statusLabel: textValue(template.statusLabel, 'No disponible'),
                rejectionReason: textValue(template.rejectionReason),
              },
            }
          : null;
      })
      .filter(Boolean),
  };
}

function statusTone(status) {
  if (status === 'APPROVED') return 'approved';
  if (['REJECTED', 'PAUSED', 'DISABLED'].includes(status)) return 'blocked';
  return 'pending';
}

function safeError(error, fallback) {
  const message = textValue(error?.message);
  if (!message || /failed to fetch|networkerror|load failed/i.test(message)) return fallback;
  return message;
}

export default function ProactiveFlowLauncher({
  canManageIntegrations = false,
  conversationId,
  online = true,
  onMessageSent,
  projectId,
  replyWindowOpen = false,
}) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [sendingKey, setSendingKey] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendOutcome, setSendOutcome] = useState('');
  const [success, setSuccess] = useState('');
  const [expanded, setExpanded] = useState(() => !replyWindowOpen);
  const [resolveKey, setResolveKey] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState('');
  const requestRef = useRef(null);
  const sendRequestRef = useRef(null);
  const resolveRequestRef = useRef(null);
  const conversationIdRef = useRef(conversationId);
  const idempotencyKeysRef = useRef(new Map());

  useLayoutEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const loadCatalog = useCallback(async () => {
    if (!conversationId || !projectId) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(
        `/api/whatsapp/inbox/${encodeURIComponent(conversationId)}/proactive-flows?projectId=${encodeURIComponent(projectId)}`,
        {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      const next = await readResponse(
        response,
        'No pudimos verificar los formularios aprobados de esta obra.',
      );
      setPayload(normalizePayload(next));
    } catch (error) {
      if (error.name !== 'AbortError') {
        setLoadError(safeError(
          error,
          'No pudimos verificar los formularios aprobados de esta obra.',
        ));
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [conversationId, projectId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadCatalog());
    return () => {
      window.cancelAnimationFrame(frame);
      requestRef.current?.abort();
      requestRef.current = null;
      sendRequestRef.current?.abort();
      sendRequestRef.current = null;
      resolveRequestRef.current?.abort();
      resolveRequestRef.current = null;
    };
  }, [loadCatalog]);

  const selectedFlow = payload?.catalog.find((item) => item.key === selectedKey) || null;
  const unresolvedFlow = payload?.catalog.find((item) => item.key === resolveKey) || null;
  const unknownFlow = sendOutcome === 'UNKNOWN'
    ? selectedKey
    : payload?.catalog.find((item) => item.unresolvedAttempt)?.key || '';

  function chooseFlow(key) {
    if (sendingKey || unknownFlow === key) return;
    setSelectedKey(key);
    setResolveKey('');
    setSendError('');
    setSendOutcome('');
    setSuccess('');
    setResolutionError('');
  }

  function cancelConfirmation() {
    if (sendingKey) return;
    setSelectedKey('');
    setSendError('');
    setSendOutcome('');
  }

  async function sendSelectedFlow({ newAttempt = false } = {}) {
    if (!selectedFlow?.canSend || !online || sendingKey) return;
    const operationConversationId = conversationId;
    const operationProjectId = projectId;
    const operationFlow = selectedFlow;
    const identity = `${operationConversationId}:${operationFlow.key}`;
    if (newAttempt) idempotencyKeysRef.current.delete(identity);
    const key = idempotencyKeysRef.current.get(identity) || createIdempotencyKey();
    idempotencyKeysRef.current.set(identity, key);
    sendRequestRef.current?.abort();
    const controller = new AbortController();
    sendRequestRef.current = controller;
    setSendingKey(operationFlow.key);
    setSendError('');
    setSendOutcome('');
    setSuccess('');
    try {
      const response = await fetch(
        `/api/whatsapp/inbox/${encodeURIComponent(operationConversationId)}/proactive-flows?projectId=${encodeURIComponent(operationProjectId)}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Idempotency-Key': key,
          },
          body: JSON.stringify({
            projectId: operationProjectId,
            blueprintKey: operationFlow.key,
            idempotencyKey: key,
          }),
          signal: controller.signal,
        },
      );
      const result = await readResponse(
        response,
        'No pudimos confirmar la entrega del formulario.',
      );
      const resultConversationId = textValue(result?.conversationId, operationConversationId);
      const stillCurrent = conversationIdRef.current === operationConversationId;
      const messageStatus = textValue(result?.message?.status).toUpperCase();
      if (messageStatus === 'UNKNOWN' || messageStatus === 'SENDING') {
        if (stillCurrent) {
          setSendOutcome('UNKNOWN');
          setSendError(
            'La entrega sigue sin confirmación. No la reenviaremos para evitar duplicados.',
          );
        }
        await onMessageSent?.(result);
        if (stillCurrent) void loadCatalog();
        return;
      }
      if (messageStatus === 'FAILED') {
        idempotencyKeysRef.current.delete(identity);
        if (stillCurrent) {
          setSendOutcome('FAILED');
          setSendError('Meta rechazó este intento. Podés crear una operación nueva.');
        }
        await onMessageSent?.(result);
        return;
      }
      idempotencyKeysRef.current.delete(identity);
      if (stillCurrent) {
        setSuccess(`${operationFlow.title} fue aceptado por Meta.`);
        setSelectedKey('');
      }
      await onMessageSent?.({ ...result, conversationId: resultConversationId });
      if (stillCurrent) void loadCatalog();
    } catch (error) {
      if (error?.name === 'AbortError') return;
      const code = textValue(error?.code).toUpperCase();
      const networkUnknown = error instanceof TypeError || Number(error?.status) >= 500;
      const outcome = code === 'WHATSAPP_FLOW_TEMPLATE_REJECTED'
        ? 'FAILED'
        : code === 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_UNKNOWN' || networkUnknown
          ? 'UNKNOWN'
          : '';
      if (outcome !== 'UNKNOWN') idempotencyKeysRef.current.delete(identity);
      if (conversationIdRef.current === operationConversationId) {
        setSendOutcome(outcome);
        setSendError(safeError(
          error,
          outcome === 'UNKNOWN'
            ? 'La entrega quedó sin confirmar. No la reenviaremos para evitar duplicados.'
            : 'No pudimos enviar el formulario.',
        ));
        if (outcome === 'UNKNOWN') void loadCatalog();
      }
    } finally {
      if (sendRequestRef.current === controller) sendRequestRef.current = null;
      if (conversationIdRef.current === operationConversationId) setSendingKey('');
    }
  }

  async function resolveUncertainty() {
    const unresolved = unresolvedFlow?.unresolvedAttempt;
    if (!unresolved?.messageId || resolving || !online) return;
    const operationConversationId = conversationId;
    const operationProjectId = projectId;
    resolveRequestRef.current?.abort();
    const controller = new AbortController();
    resolveRequestRef.current = controller;
    setResolving(true);
    setResolutionError('');
    try {
      const response = await fetch(
        `/api/whatsapp/inbox/${encodeURIComponent(operationConversationId)}/proactive-flows?projectId=${encodeURIComponent(operationProjectId)}`,
        {
          method: 'PATCH',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: operationProjectId,
            blueprintKey: unresolvedFlow.key,
            messageId: unresolved.messageId,
            confirmation: 'ACEPTO_RIESGO_DE_DUPLICADO',
          }),
          signal: controller.signal,
        },
      );
      await readResponse(response, 'No pudimos resolver el estado de este formulario.');
      if (conversationIdRef.current !== operationConversationId) return;
      idempotencyKeysRef.current.delete(`${operationConversationId}:${unresolvedFlow.key}`);
      setSuccess(`${unresolvedFlow.title}: nuevo intento habilitado con trazabilidad.`);
      setResolveKey('');
      setSelectedKey('');
      await loadCatalog();
      await onMessageSent?.({ conversationId: operationConversationId });
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (conversationIdRef.current === operationConversationId) {
        setResolutionError(safeError(
          error,
          'No pudimos resolver el estado de este formulario.',
        ));
      }
    } finally {
      if (resolveRequestRef.current === controller) resolveRequestRef.current = null;
      if (conversationIdRef.current === operationConversationId) setResolving(false);
    }
  }

  return (
    <section
      className={styles.flowLauncher}
      data-window={replyWindowOpen ? 'open' : 'closed'}
      aria-labelledby="proactive-flow-title"
    >
      <header className={styles.flowLauncherHeader}>
        <span className={styles.flowLauncherIcon} aria-hidden="true">
          <i className="fa-brands fa-whatsapp" />
        </span>
        <div className={styles.flowLauncherCopy}>
          <strong id="proactive-flow-title">Formularios operativos</strong>
          <small>
            {replyWindowOpen
              ? 'Enviá una captura estructurada sin salir de WhatsApp.'
              : 'Plantillas aprobadas: funcionan aunque la ventana de 24 horas esté cerrada.'}
          </small>
        </div>
        <div className={styles.flowHeaderActions}>
          <span className={styles.flowWindowBadge}>
            <i className="fa-solid fa-shield-halved" aria-hidden="true" />
            {payload?.catalog.some((flow) => flow.template.status === 'APPROVED')
              ? 'Plantilla aprobada'
              : 'Validación de Meta'}
          </span>
          <button
            aria-controls="proactive-flow-content"
            aria-expanded={expanded}
            aria-label={expanded
              ? 'Ocultar formularios operativos'
              : 'Abrir formularios operativos'}
            className={styles.flowToggle}
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            <span>{expanded ? 'Ocultar' : 'Abrir'}</span>
            <i className={expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'} aria-hidden="true" />
          </button>
        </div>
      </header>

      {expanded && <div className={styles.flowLauncherBody} id="proactive-flow-content">
      {loading ? (
        <div className={styles.flowLauncherState} role="status">
          <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
          Verificando plantillas y destinatario…
        </div>
      ) : loadError ? (
        <div className={styles.flowLauncherState} data-tone="error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadCatalog()}>Reintentar</button>
        </div>
      ) : (
        <>
          {success && (
            <div className={styles.flowSuccess} role="status">
              <i className="fa-solid fa-circle-check" aria-hidden="true" /> {success}
            </div>
          )}

          <div className={styles.flowOptions}>
            {payload?.catalog.map((flow) => {
              const disabled = !flow.canSend
                || !online
                || Boolean(sendingKey)
                || unknownFlow === flow.key;
              return (
                <button
                  aria-pressed={selectedKey === flow.key}
                  className={styles.flowOption}
                  data-selected={selectedKey === flow.key ? 'true' : 'false'}
                  disabled={disabled}
                  key={flow.key}
                  onClick={() => chooseFlow(flow.key)}
                  type="button"
                >
                  <span className={styles.flowOptionIcon} aria-hidden="true">
                    <i className={flow.key === 'incident-report'
                      ? 'fa-solid fa-triangle-exclamation'
                      : 'fa-solid fa-helmet-safety'} />
                  </span>
                  <span className={styles.flowOptionCopy}>
                    <strong>{flow.title}</strong>
                    <small>{flow.capabilities.join(' · ') || flow.description}</small>
                    {flow.template.rejectionReason && (
                      <span className={styles.flowRejectionReason}>
                        {flow.template.rejectionReason}
                      </span>
                    )}
                  </span>
                  <span
                    className={styles.flowTemplateStatus}
                    data-tone={flow.unresolvedAttempt
                      ? 'warning'
                      : statusTone(flow.template.status)}
                  >
                    {flow.unresolvedAttempt
                      ? 'Entrega sin confirmar'
                      : flow.template.statusLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {payload?.catalog.filter((flow) => flow.unresolvedAttempt).map((flow) => (
            <div className={styles.flowUnresolved} key={`unresolved-${flow.key}`} role="status">
              <div>
                <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                <span id={`flow-unresolved-warning-${flow.key}`}>
                  <strong>{flow.title}</strong>
                  Meta no confirmó el intento anterior. Bloqueamos reenvíos para evitar duplicados.
                </span>
              </div>
              <button
                aria-controls={`flow-resolution-panel-${flow.key}`}
                aria-expanded={resolveKey === flow.key}
                aria-describedby={`flow-unresolved-warning-${flow.key}`}
                type="button"
                onClick={() => {
                  setResolveKey(flow.key);
                  setSelectedKey('');
                  setResolutionError('');
                }}
                disabled={resolving || !online}
              >
                Revisar bloqueo
              </button>
            </div>
          ))}

          {!payload?.capability.allowed && (
            <div className={styles.flowLauncherState} data-tone="warning" role="status">
              <span>{payload?.capability.reason || 'No hay formularios disponibles.'}</span>
              {canManageIntegrations && [
                'WHATSAPP_FLOW_TEMPLATE_NOT_APPROVED',
                'WHATSAPP_CONNECTION_NOT_OPERATIONAL',
                'WHATSAPP_FLOW_ENDPOINT_NOT_READY',
                'WHATSAPP_FLOW_TOKEN_SECRET_REQUIRED',
              ].includes(payload?.capability.code) && (
                <Link href="/dashboard/integrations">Configurar en Integraciones</Link>
              )}
            </div>
          )}

          {unresolvedFlow?.unresolvedAttempt && (
            <div
              aria-describedby={`flow-resolution-risk-${unresolvedFlow.key}`}
              aria-labelledby={`flow-resolution-${unresolvedFlow.key}`}
              className={styles.flowConfirmation}
              data-tone="warning"
              id={`flow-resolution-panel-${unresolvedFlow.key}`}
              role="group"
            >
              <div>
                <span>Decisión con trazabilidad</span>
                <strong id={`flow-resolution-${unresolvedFlow.key}`}>
                  Habilitar otro intento de {unresolvedFlow.title}
                </strong>
                <small id={`flow-resolution-risk-${unresolvedFlow.key}`}>
                  Hacelo solo después de revisar Meta: el intento anterior podría haberse entregado.
                  La decisión y el riesgo de duplicado quedarán auditados para {' '}
                  {payload?.recipient?.name || 'este contacto'} {maskedPhone(payload?.recipient?.phone)}.
                </small>
              </div>
              <div className={styles.flowConfirmationActions}>
                <button
                  aria-describedby={`flow-resolution-risk-${unresolvedFlow.key}`}
                  type="button"
                  onClick={() => {
                    setResolveKey('');
                    setResolutionError('');
                  }}
                  disabled={resolving}
                >
                  Mantener bloqueo
                </button>
                <button
                  aria-describedby={`flow-resolution-risk-${unresolvedFlow.key}`}
                  type="button"
                  onClick={() => void resolveUncertainty()}
                  disabled={resolving || !online}
                >
                  <i className={resolving
                    ? 'fa-solid fa-circle-notch fa-spin'
                    : 'fa-solid fa-unlock-keyhole'} aria-hidden="true" />
                  {resolving ? 'Auditando…' : 'Habilitar nuevo intento'}
                </button>
              </div>
              {resolutionError && (
                <p className={styles.flowSendError} role="alert">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  {resolutionError}
                </p>
              )}
            </div>
          )}

          {selectedFlow && (
            <div
              aria-labelledby={`flow-confirmation-${selectedFlow.key}`}
              className={styles.flowConfirmation}
              role="group"
            >
              <div>
                <span>Confirmar envío</span>
                <strong id={`flow-confirmation-${selectedFlow.key}`}>{selectedFlow.title}</strong>
                <small>
                  Se enviará a {payload?.recipient?.name || 'este contacto'} {' '}
                  {maskedPhone(payload?.recipient?.phone)} y el enlace será
                  válido por {selectedFlow.expiresInMinutes} minutos.
                </small>
              </div>
              <div className={styles.flowConfirmationActions}>
                <button type="button" onClick={cancelConfirmation} disabled={Boolean(sendingKey)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void sendSelectedFlow({ newAttempt: sendOutcome === 'FAILED' })}
                  disabled={!online || Boolean(sendingKey) || sendOutcome === 'UNKNOWN'}
                >
                  <i className={sendingKey
                    ? 'fa-solid fa-circle-notch fa-spin'
                    : 'fa-solid fa-paper-plane'} aria-hidden="true" />
                  {sendingKey
                    ? 'Enviando…'
                    : sendOutcome === 'FAILED'
                      ? 'Crear nuevo intento'
                      : 'Enviar formulario'}
                </button>
              </div>
              {sendError && (
                <p className={styles.flowSendError} role="alert">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  {sendError}
                </p>
              )}
            </div>
          )}
        </>
      )}
      </div>}
    </section>
  );
}
