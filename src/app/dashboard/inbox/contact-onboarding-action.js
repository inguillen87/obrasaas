'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import styles from './inbox.module.css';

const ONBOARDING_STATES = new Set([
  'eligible',
  'already_pending',
  'authorized',
  'conflict',
  'closed',
]);
const SAFE_NEW_OPERATION_CODES = new Set([
  'WORKER_ONBOARDING_INVITATION_PREPARATION_FAILED',
  'WORKER_ONBOARDING_INVITATION_DELIVERY_REJECTED',
  'WORKER_ONBOARDING_INVITATION_EXPIRED',
]);
const UNCERTAIN_DELIVERY_CODES = new Set([
  'WORKER_ONBOARDING_INVITATION_DELIVERY_UNKNOWN',
  'WORKER_ONBOARDING_INVITATION_CORRELATION_PENDING',
]);

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function textValue(value) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

export function normalizeContactOnboarding(raw) {
  const source = objectValue(raw);
  const state = textValue(source.state || source.status).toLowerCase();
  return {
    state: ONBOARDING_STATES.has(state) ? state : 'closed',
    reason: textValue(source.reason).slice(0, 280),
  };
}

function createIdempotencyKey() {
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `inbox-worker-onboarding-${suffix}`;
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      textValue(payload?.error) || 'No pudimos confirmar la operación de alta.',
    );
    error.status = response.status;
    error.code = textValue(payload?.code).toUpperCase();
    throw error;
  }
  return payload;
}

function safeError(error, fallback) {
  const message = textValue(error?.message);
  if (!message || /failed to fetch|networkerror|load failed/i.test(message)) return fallback;
  return message;
}

function PendingState({ reason }) {
  return (
    <section className={styles.contactOnboardingCard} data-tone="pending" aria-labelledby="contact-onboarding-title">
      <span className={styles.contactOnboardingIcon} aria-hidden="true">
        <i className="fa-regular fa-clock" />
      </span>
      <div className={styles.contactOnboardingCopy}>
        <strong id="contact-onboarding-title">Alta de identidad en curso</strong>
        <p>{reason || 'La invitación ya está abierta. No enviaremos otra mientras siga vigente.'}</p>
      </div>
      <Link href="/dashboard/team#worker-onboarding">Ver altas</Link>
    </section>
  );
}

function ConflictState({ reason }) {
  return (
    <section
      className={styles.contactOnboardingCard}
      data-tone="conflict"
      aria-labelledby="contact-onboarding-title"
      role="alert"
    >
      <span className={styles.contactOnboardingIcon} aria-hidden="true">
        <i className="fa-solid fa-triangle-exclamation" />
      </span>
      <div className={styles.contactOnboardingCopy}>
        <strong id="contact-onboarding-title">Alta bloqueada por conflicto</strong>
        <p>{reason || 'Revisá la identidad en Equipo antes de realizar otra acción.'}</p>
      </div>
      <Link href="/dashboard/team#worker-onboarding">Revisar</Link>
    </section>
  );
}

export default function ContactOnboardingAction({
  canManageOnboarding = false,
  conversationId,
  onboarding: onboardingInput,
  online = true,
  onRefresh,
  projectId,
}) {
  const onboarding = normalizeContactOnboarding(onboardingInput);
  const [pending, setPending] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState('');
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [hasAttempt, setHasAttempt] = useState(false);
  const requestRef = useRef(null);
  const idempotencyKeyRef = useRef('');
  const reconciliationModeRef = useRef('blocked');

  useEffect(() => () => requestRef.current?.abort(), []);

  if (!canManageOnboarding || ['authorized', 'closed'].includes(onboarding.state)) return null;
  if (onboarding.state === 'already_pending') return <PendingState reason={onboarding.reason} />;
  if (onboarding.state === 'conflict') return <ConflictState reason={onboarding.reason} />;
  if (onboarding.state !== 'eligible') return null;

  async function refreshServerState({ mode = reconciliationModeRef.current } = {}) {
    if (reconciling || !online) return;
    setReconciling(true);
    setError('');
    try {
      const refreshed = await onRefresh?.();
      if (!refreshed) {
        setError('No pudimos actualizar el estado. No se enviará otra invitación hasta reconciliarlo.');
      } else if (normalizeContactOnboarding(refreshed).state === 'eligible') {
        if (mode === 'new') {
          idempotencyKeyRef.current = '';
          reconciliationModeRef.current = 'blocked';
          setHasAttempt(false);
          setRefreshRequired(false);
          setError('La entrega anterior quedó cerrada sin envío. Ya podés iniciar una nueva invitación.');
        } else if (mode === 'same') {
          reconciliationModeRef.current = 'blocked';
          setRefreshRequired(false);
          setError('El estado fue reconciliado. Podés reintentar la misma operación segura.');
        } else {
          setError('El servidor todavía no refleja un alta abierta. No se reenviará hasta resolver la entrega anterior.');
        }
      }
    } catch (refreshError) {
      setError(safeError(
        refreshError,
        'No pudimos actualizar el estado. No se enviará otra invitación hasta reconciliarlo.',
      ));
    } finally {
      setReconciling(false);
    }
  }

  async function issueOnboarding() {
    if (pending || refreshRequired || !online || !conversationId || !projectId) return;
    const idempotencyKey = idempotencyKeyRef.current || createIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;
    setHasAttempt(true);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    setError('');

    try {
      const response = await fetch(
        `/api/whatsapp/inbox/${encodeURIComponent(conversationId)}/worker-onboarding?projectId=${encodeURIComponent(projectId)}`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          signal: controller.signal,
        },
      );
      await readResponse(response);
      reconciliationModeRef.current = 'blocked';
      setRefreshRequired(true);
      await refreshServerState();
    } catch (requestError) {
      if (requestError.name === 'AbortError') return;
      const code = textValue(requestError?.code).toUpperCase();
      if (SAFE_NEW_OPERATION_CODES.has(code)) {
        idempotencyKeyRef.current = '';
        reconciliationModeRef.current = 'new';
        setRefreshRequired(true);
        setError('La invitación no fue entregada y el intento quedó cerrado de forma segura.');
        await refreshServerState({ mode: 'new' });
      } else if (UNCERTAIN_DELIVERY_CODES.has(code)) {
        reconciliationModeRef.current = 'blocked';
        setRefreshRequired(true);
        setError('Meta no confirmó el resultado. No enviaremos otra invitación hasta reconciliar este intento.');
        await refreshServerState({ mode: 'blocked' });
      } else if (Number(requestError?.status) === 409) {
        reconciliationModeRef.current = 'blocked';
        setRefreshRequired(true);
        setError('El estado del contacto cambió. Actualizalo antes de realizar otra acción.');
        await refreshServerState({ mode: 'blocked' });
      } else {
        reconciliationModeRef.current = 'same';
        setRefreshRequired(true);
        setError(safeError(
          requestError,
          'No pudimos confirmar la operación. Reintentá con la misma clave para evitar duplicados.',
        ));
        await refreshServerState({ mode: 'same' });
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setPending(false);
    }
  }

  return (
    <section className={styles.contactOnboardingCard} data-tone="eligible" aria-labelledby="contact-onboarding-title">
      <span className={styles.contactOnboardingIcon} aria-hidden="true">
        <i className="fa-solid fa-user-shield" />
      </span>
      <div className={styles.contactOnboardingCopy}>
        <strong id="contact-onboarding-title">Contacto sin identidad autorizada</strong>
        <p>
          {onboarding.reason
            || 'Podés invitarlo a declarar sus datos. No podrá operar hasta la aprobación administrativa.'}
        </p>
        {!online && <small>Conectate a internet para gestionar esta alta.</small>}
        {error && <small className={styles.contactOnboardingError} role="alert">{error}</small>}
      </div>
      {refreshRequired ? (
        <button
          type="button"
          onClick={() => void refreshServerState({ mode: reconciliationModeRef.current })}
          disabled={!online || reconciling}
        >
          {reconciling ? 'Actualizando…' : 'Actualizar estado'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void issueOnboarding()}
          disabled={!online || pending}
        >
          {pending
            ? 'Solicitando alta…'
            : hasAttempt ? 'Reintentar operación segura' : 'Invitar a registrarse'}
        </button>
      )}
    </section>
  );
}
