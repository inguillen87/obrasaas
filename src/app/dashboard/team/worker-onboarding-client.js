'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import styles from './team.module.css';

const PAGE_SIZE = 25;
const STATUS_FILTERS = Object.freeze([
  {
    key: 'SUBMITTED',
    label: 'Por revisar',
    emptyTitle: 'No hay altas esperando revisión',
    emptyCopy: 'Cuando un operario complete sus datos por WhatsApp, aparecerá acá.',
  },
  {
    key: 'PENDING',
    label: 'Esperando respuesta',
    emptyTitle: 'No hay invitaciones pendientes',
    emptyCopy: 'Las invitaciones emitidas y todavía no completadas aparecerán acá.',
  },
  {
    key: 'APPROVED',
    label: 'Aprobadas',
    emptyTitle: 'Todavía no hay altas aprobadas',
    emptyCopy: 'Las identidades vinculadas correctamente a la cuadrilla quedarán registradas acá.',
  },
  {
    key: 'REJECTED',
    label: 'Rechazadas',
    emptyTitle: 'No hay altas rechazadas',
    emptyCopy: 'Las decisiones de rechazo auditadas aparecerán en este historial.',
  },
  {
    key: 'EXPIRED',
    label: 'Vencidas',
    emptyTitle: 'No hay invitaciones vencidas',
    emptyCopy: 'Los reclamos que superen su vigencia se conservarán como historial.',
  },
  {
    key: 'CANCELLED',
    label: 'Canceladas',
    emptyTitle: 'No hay invitaciones canceladas',
    emptyCopy: 'Las operaciones canceladas de forma segura aparecerán acá.',
  },
]);
const CLAIM_STATUSES = new Set(STATUS_FILTERS.map(({ key }) => key));
const VERIFICATION_STATES = new Set([
  'PREPARED',
  'AWAITING_SUBMISSION',
  'AWAITING_RECEIPT',
  'VERIFIED',
  'REJECTED',
]);
const RETENTION_STATES = new Set(['ACTIVE', 'PENDING_PURGE', 'PURGED']);
const STATUS_PRESENTATION = Object.freeze({
  SUBMITTED: { label: 'Revisión requerida', tone: 'review' },
  PENDING: { label: 'Esperando al operario', tone: 'pending' },
  APPROVED: { label: 'Alta operativa aprobada', tone: 'approved' },
  REJECTED: { label: 'Alta rechazada', tone: 'rejected' },
  EXPIRED: { label: 'Invitación vencida', tone: 'expired' },
  CANCELLED: { label: 'Invitación cancelada', tone: 'cancelled' },
});

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function textValue(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return '';
}

function dateValue(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function emptyPage() {
  return {
    items: [],
    nextCursor: '',
    loaded: false,
    pending: '',
    error: '',
    updatedAt: null,
  };
}

function initialPages() {
  return Object.fromEntries(STATUS_FILTERS.map(({ key }) => [key, emptyPage()]));
}

function normalizeClaim(raw) {
  const source = objectValue(raw);
  const id = textValue(source.id);
  const status = textValue(source.status).toUpperCase();
  const revision = Number(source.revision);
  if (!id || !CLAIM_STATUSES.has(status) || !Number.isSafeInteger(revision) || revision < 0) {
    return null;
  }
  const identitySource = objectValue(source.identity);
  const resolutionSource = objectValue(source.resolution);
  const verificationSource = objectValue(source.verification);
  const legalName = textValue(identitySource.legalName);
  const maskedCuil = textValue(identitySource.maskedCuil);
  const privacyNoticeVersion = textValue(identitySource.privacyNoticeVersion);
  const workerId = textValue(resolutionSource.workerId);
  const verificationState = textValue(verificationSource.state).toUpperCase();
  const retentionSource = objectValue(source.retention);
  const retentionState = textValue(retentionSource.state).toUpperCase();
  const safeRetentionState = RETENTION_STATES.has(retentionState)
    ? retentionState
    : 'ACTIVE';
  const safeVerificationState = VERIFICATION_STATES.has(verificationState)
    ? verificationState
    : 'PREPARED';

  return {
    id,
    status,
    revision,
    sender: safeRetentionState === 'ACTIVE'
      ? textValue(source.sender, 'WhatsApp enmascarado')
      : '',
    identity: safeRetentionState === 'ACTIVE' && source.identity
      ? {
          legalName,
          maskedCuil,
          privacyNoticeVersion,
        }
      : null,
    createdAt: dateValue(source.createdAt)?.toISOString() || null,
    expiresAt: dateValue(source.expiresAt)?.toISOString() || null,
    submittedAt: dateValue(source.submittedAt)?.toISOString() || null,
    reviewedAt: dateValue(source.reviewedAt)?.toISOString() || null,
    hasRejectionReason: source.hasRejectionReason === true,
    retention: {
      state: safeRetentionState,
      purgedAt: dateValue(retentionSource.purgedAt)?.toISOString() || null,
    },
    verification: {
      state: safeVerificationState,
      deliveryAttemptedAt: dateValue(verificationSource.deliveryAttemptedAt)?.toISOString() || null,
      noticeServedAt: dateValue(verificationSource.noticeServedAt)?.toISOString() || null,
      submittedAt: dateValue(verificationSource.submittedAt)?.toISOString() || null,
      verifiedAt: dateValue(verificationSource.verifiedAt)?.toISOString() || null,
      rejectedAt: dateValue(verificationSource.rejectedAt)?.toISOString() || null,
    },
    reviewReady: status === 'SUBMITTED'
      && source.reviewReady === true
      && safeVerificationState === 'VERIFIED',
    resolution: workerId ? { workerId } : null,
  };
}

function mergeClaims(current, incoming) {
  const merged = new Map(current.map((claim) => [claim.id, claim]));
  for (const claim of incoming) merged.set(claim.id, claim);
  return [...merged.values()];
}

async function readResponse(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(textValue(payload?.error, fallback));
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

function createIdempotencyKey(prefix = 'worker-onboarding-decision') {
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function formatDate(value, timeZone) {
  const date = dateValue(value);
  if (!date) return 'Sin fecha registrada';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(date);
}

function claimTitle(claim) {
  if (claim.retention.state !== 'ACTIVE') return 'Alta histÃ³rica';
  return claim.identity?.legalName || 'Contacto de WhatsApp';
}

function claimPrimaryDate(claim) {
  if (claim.status === 'SUBMITTED') return { label: 'Enviado', value: claim.submittedAt };
  if (claim.status === 'APPROVED' || claim.status === 'REJECTED') {
    return { label: 'Revisado', value: claim.reviewedAt };
  }
  if (claim.status === 'EXPIRED') return { label: 'Venció', value: claim.expiresAt };
  return { label: 'Creado', value: claim.createdAt };
}

function DecisionPanel({
  draft,
  onCancel,
  onChangeReason,
  onSubmit,
  pending,
}) {
  const rejecting = draft.action === 'REJECT';
  const reason = draft.rejectionReason;
  const validReason = !rejecting || (reason.trim().length >= 1 && reason.trim().length <= 500);

  return (
    <form className={styles.onboardingDecisionPanel} onSubmit={onSubmit}>
      <div>
        <strong>{rejecting ? 'Rechazar esta alta' : 'Confirmar alta operativa'}</strong>
        <p>
          {rejecting
            ? 'El rechazo quedará auditado y este contacto no será habilitado como operario.'
            : 'Confirmá que el nombre completo visible y el CUIL enmascarado corresponden a la persona revisada.'}
        </p>
      </div>

      {rejecting && (
        <label className={styles.onboardingReasonField}>
          <span>Motivo del rechazo</span>
          <textarea
            autoFocus
            maxLength={500}
            required
            rows={3}
            value={reason}
            onChange={(event) => onChangeReason(event.target.value)}
            placeholder="Ej.: los datos no corresponden a la persona preautorizada."
          />
          <small>{reason.length}/500</small>
        </label>
      )}

      <div className={styles.onboardingDecisionActions}>
        <button type="button" onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
        <button
          className={rejecting ? styles.onboardingRejectConfirm : styles.onboardingApproveConfirm}
          type="submit"
          disabled={pending || !validReason}
        >
          {pending
            ? 'Guardando decisión…'
            : rejecting ? 'Rechazar alta' : 'Aprobar alta operativa'}
        </button>
      </div>
    </form>
  );
}

function ClaimCard({
  canManage,
  claim,
  decisionDraft,
  onCancelDecision,
  onChangeReason,
  onOpenDecision,
  onSubmitDecision,
  pendingDecision,
  timeZone,
}) {
  const presentation = STATUS_PRESENTATION[claim.status];
  const primaryDate = claimPrimaryDate(claim);
  const deciding = decisionDraft?.claimId === claim.id;

  return (
    <article className={styles.onboardingClaimCard} data-status={presentation.tone}>
      <header className={styles.onboardingClaimHeader}>
        <div className={styles.onboardingClaimIdentity}>
          <span aria-hidden="true"><i className="fa-brands fa-whatsapp" /></span>
          <div>
            <strong>{claimTitle(claim)}</strong>
            <small>
              {claim.retention.state === 'PURGED'
                ? 'Datos sensibles eliminados segÃºn la polÃ­tica de retenciÃ³n'
                : claim.retention.state === 'PENDING_PURGE'
                  ? 'Datos sensibles fuera de vista; eliminaciÃ³n programada'
                  : claim.sender}
            </small>
          </div>
        </div>
        <span className={styles.onboardingStatus} data-tone={presentation.tone}>
          {presentation.label}
        </span>
      </header>

      <dl className={styles.onboardingClaimFacts}>
        {claim.identity?.maskedCuil && (
          <div>
            <dt>CUIL declarado</dt>
            <dd>{claim.identity.maskedCuil}</dd>
          </div>
        )}
        {claim.identity?.privacyNoticeVersion && (
          <div>
            <dt>Privacidad aceptada</dt>
            <dd>{claim.identity.privacyNoticeVersion}</dd>
          </div>
        )}
        <div>
          <dt>{primaryDate.label}</dt>
          <dd>{formatDate(primaryDate.value, timeZone)}</dd>
        </div>
        {(claim.status === 'PENDING' || claim.status === 'SUBMITTED') && (
          <div>
            <dt>Vigencia</dt>
            <dd>Hasta {formatDate(claim.expiresAt, timeZone)}</dd>
          </div>
        )}
      </dl>

      {claim.status === 'REJECTED' && claim.hasRejectionReason && (
        <p className={styles.onboardingDecisionRecorded}>
          <i className="fa-solid fa-file-shield" aria-hidden="true" />
          El motivo quedó registrado en la auditoría protegida.
        </p>
      )}

      {claim.status === 'APPROVED' && claim.resolution?.workerId && (
        <>
          <p className={styles.onboardingDecisionRecorded}>
            <i className="fa-solid fa-circle-check" aria-hidden="true" />
            Canal de WhatsApp verificado. La identidad civil conserva su revisión documental separada.
          </p>
          <a
            className={styles.onboardingWorkerLink}
            href={`#field-worker-${claim.resolution.workerId}`}
          >
            <i className="fa-solid fa-arrow-down" aria-hidden="true" />
            Ver operario en la cuadrilla
          </a>
        </>
      )}

      {claim.status === 'SUBMITTED' && !claim.reviewReady && (
        <p className={styles.onboardingVerificationPending}>
          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
          <span>
            <strong>Confirmando WhatsApp.</strong> Recibimos el alta operativa declarada y estamos
            verificando su confirmación final. La identidad civil mantiene una revisión documental
            separada.
          </span>
        </p>
      )}

      {claim.status === 'SUBMITTED' && canManage && !deciding && (
        <div className={styles.onboardingClaimActions}>
          <button
            type="button"
            onClick={() => onOpenDecision(claim, 'REJECT')}
            disabled={Boolean(pendingDecision)}
          >
            Rechazar
          </button>
          <button
            className={styles.onboardingApproveButton}
            type="button"
            onClick={() => onOpenDecision(claim, 'APPROVE')}
            disabled={Boolean(pendingDecision) || !claim.reviewReady}
          >
            {claim.reviewReady ? 'Revisar y aprobar' : 'Confirmando WhatsApp'}
          </button>
        </div>
      )}

      {deciding && (
        <DecisionPanel
          draft={decisionDraft}
          onCancel={onCancelDecision}
          onChangeReason={onChangeReason}
          onSubmit={(event) => onSubmitDecision(event, claim)}
          pending={pendingDecision === claim.id}
        />
      )}
    </article>
  );
}

export default function WorkerOnboardingClient({
  canManage = false,
  canRead = false,
  projectName,
  timeZone = 'America/Argentina/Buenos_Aires',
}) {
  const [activeStatus, setActiveStatus] = useState('SUBMITTED');
  const [pages, setPages] = useState(initialPages);
  const [decisionDraft, setDecisionDraft] = useState(null);
  const [pendingDecision, setPendingDecision] = useState('');
  const [notice, setNotice] = useState(null);
  const requestsRef = useRef(new Map());
  const decisionAttemptsRef = useRef(new Map());

  const loadClaims = useCallback(async (status, {
    append = false,
    cursor = '',
  } = {}) => {
    if (!canRead || !CLAIM_STATUSES.has(status)) return;
    requestsRef.current.get(status)?.abort();
    const controller = new AbortController();
    requestsRef.current.set(status, controller);
    setPages((current) => ({
      ...current,
      [status]: {
        ...current[status],
        pending: append ? 'append' : current[status].loaded ? 'refresh' : 'initial',
        error: '',
      },
    }));

    try {
      const params = new URLSearchParams({ status, limit: String(PAGE_SIZE) });
      if (append && cursor) params.set('cursor', cursor);
      const response = await fetch(`/api/worker-onboarding/claims?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await readResponse(
        response,
        'No pudimos cargar las altas de operarios.',
      );
      const incoming = (Array.isArray(payload.items) ? payload.items : [])
        .map(normalizeClaim)
        .filter(Boolean);
      setPages((current) => ({
        ...current,
        [status]: {
          items: append ? mergeClaims(current[status].items, incoming) : incoming,
          nextCursor: textValue(payload.nextCursor),
          loaded: true,
          pending: '',
          error: '',
          updatedAt: new Date().toISOString(),
        },
      }));
    } catch (error) {
      if (error.name === 'AbortError') return;
      setPages((current) => ({
        ...current,
        [status]: {
          ...current[status],
          loaded: true,
          pending: '',
          error: safeError(error, 'No pudimos cargar las altas de operarios.'),
        },
      }));
    } finally {
      if (requestsRef.current.get(status) === controller) {
        requestsRef.current.delete(status);
      }
    }
  }, [canRead]);

  const activePage = pages[activeStatus];
  const activeFilter = useMemo(
    () => STATUS_FILTERS.find(({ key }) => key === activeStatus) || STATUS_FILTERS[0],
    [activeStatus],
  );

  useEffect(() => {
    if (!canRead || activePage.loaded || activePage.pending) return;
    void loadClaims(activeStatus);
  }, [activePage.loaded, activePage.pending, activeStatus, canRead, loadClaims]);

  useEffect(() => {
    if (!canRead) return undefined;
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') void loadClaims(activeStatus);
    }
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible);
  }, [activeStatus, canRead, loadClaims]);

  useEffect(() => () => {
    for (const controller of requestsRef.current.values()) controller.abort();
    requestsRef.current.clear();
  }, []);

  function selectStatus(status) {
    if (!CLAIM_STATUSES.has(status) || status === activeStatus) return;
    setDecisionDraft(null);
    setActiveStatus(status);
  }

  function openDecision(claim, action) {
    if (
      !canManage
      || claim.status !== 'SUBMITTED'
      || pendingDecision
      || (action === 'APPROVE' && !claim.reviewReady)
    ) return;
    setNotice(null);
    setDecisionDraft({
      claimId: claim.id,
      action,
      rejectionReason: '',
    });
  }

  async function submitDecision(event, claim) {
    event.preventDefault();
    const action = decisionDraft?.action;
    if (
      !canManage
      || pendingDecision
      || decisionDraft?.claimId !== claim.id
      || claim.status !== 'SUBMITTED'
      || (action === 'APPROVE' && !claim.reviewReady)
    ) return;
    const rejectionReason = action === 'REJECT' ? decisionDraft.rejectionReason.trim() : '';
    if (action === 'REJECT' && (rejectionReason.length < 1 || rejectionReason.length > 500)) {
      setNotice({ type: 'error', text: 'El rechazo requiere un motivo de hasta 500 caracteres.' });
      return;
    }

    const attemptIdentity = [claim.id, action, claim.revision, rejectionReason].join(':');
    const idempotencyKey = decisionAttemptsRef.current.get(attemptIdentity)
      || createIdempotencyKey();
    decisionAttemptsRef.current.set(attemptIdentity, idempotencyKey);
    setPendingDecision(claim.id);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/worker-onboarding/claims/${encodeURIComponent(claim.id)}/decision`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            action,
            expectedRevision: claim.revision,
            ...(action === 'REJECT' ? { rejectionReason } : {}),
          }),
        },
      );
      const result = await readResponse(response, 'No pudimos confirmar la decisión.');
      decisionAttemptsRef.current.delete(attemptIdentity);
      setDecisionDraft(null);
      setNotice({
        type: 'success',
        text: result.replayed === true
          ? 'La decisión ya estaba registrada. La cola fue reconciliada.'
          : action === 'APPROVE'
            ? 'Alta operativa aprobada y canal verificado; la revisión civil permanece separada.'
            : 'Alta rechazada con trazabilidad.',
      });
      setPages((current) => ({
        ...current,
        [action === 'APPROVE' ? 'APPROVED' : 'REJECTED']: {
          ...current[action === 'APPROVE' ? 'APPROVED' : 'REJECTED'],
          loaded: false,
        },
      }));
      await loadClaims('SUBMITTED');
    } catch (error) {
      if (Number(error?.status) === 409) {
        decisionAttemptsRef.current.delete(attemptIdentity);
        setDecisionDraft(null);
        setNotice({
          type: 'warning',
          text: 'El alta cambió mientras la revisabas. Recargamos el estado antes de permitir otra decisión.',
        });
        await loadClaims('SUBMITTED');
      } else {
        setNotice({
          type: 'error',
          text: safeError(
            error,
            'No pudimos confirmar la decisión. Reintentá para consultar la misma operación segura.',
          ),
        });
      }
    } finally {
      setPendingDecision('');
    }
  }

  if (!canRead) return null;

  return (
    <section className={styles.onboardingPanel} id="worker-onboarding" aria-labelledby="worker-onboarding-title">
      <header className={styles.onboardingPanelHeader}>
        <div>
          <p className={styles.eyebrow}>Identidad laboral protegida</p>
          <h2 id="worker-onboarding-title">Altas de operarios por WhatsApp</h2>
          <p>
            {projectName} · el teléfono y el CUIL se muestran enmascarados; el nombre legal sólo es
            visible para revisión autorizada. Nadie queda habilitado sin una decisión explícita.
          </p>
        </div>
        <button
          className={styles.onboardingRefreshButton}
          type="button"
          onClick={() => void loadClaims(activeStatus)}
          disabled={Boolean(activePage.pending)}
        >
          <i className="fa-solid fa-arrows-rotate" aria-hidden="true" />
          {activePage.pending === 'refresh' ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      <div className={styles.onboardingFilters} aria-label="Filtrar altas de operarios">
        {STATUS_FILTERS.map((filter) => {
          const page = pages[filter.key];
          return (
            <button
              type="button"
              key={filter.key}
              onClick={() => selectStatus(filter.key)}
              aria-pressed={activeStatus === filter.key}
            >
              <span>{filter.label}</span>
              {page.loaded && (
                <small>{page.items.length}{page.nextCursor ? '+' : ''}</small>
              )}
            </button>
          );
        })}
      </div>

      {notice && (
        <div
          className={styles.onboardingNotice}
          data-tone={notice.type}
          role={notice.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <i
            className={notice.type === 'success'
              ? 'fa-solid fa-circle-check'
              : notice.type === 'warning'
                ? 'fa-solid fa-triangle-exclamation'
                : 'fa-solid fa-circle-exclamation'}
            aria-hidden="true"
          />
          <span>{notice.text}</span>
        </div>
      )}

      {activePage.error && (
        <div className={styles.onboardingLoadError} role="alert">
          <span>{activePage.error}</span>
          <button type="button" onClick={() => void loadClaims(activeStatus)}>Reintentar</button>
        </div>
      )}

      <div
        className={styles.onboardingClaimList}
        aria-busy={activePage.pending === 'initial'}
        aria-live="polite"
      >
        {activePage.pending === 'initial' ? (
          <div className={styles.onboardingLoading} role="status">
            <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
            Cargando altas protegidas…
          </div>
        ) : activePage.items.length === 0 ? (
          <div className={styles.onboardingEmpty}>
            <i className="fa-regular fa-address-card" aria-hidden="true" />
            <strong>{activeFilter.emptyTitle}</strong>
            <p>{activeFilter.emptyCopy}</p>
          </div>
        ) : activePage.items.map((claim) => (
          <ClaimCard
            key={claim.id}
            canManage={canManage}
            claim={claim}
            decisionDraft={decisionDraft}
            onCancelDecision={() => setDecisionDraft(null)}
            onChangeReason={(rejectionReason) => setDecisionDraft((current) => (
              current?.claimId === claim.id ? { ...current, rejectionReason } : current
            ))}
            onOpenDecision={openDecision}
            onSubmitDecision={submitDecision}
            pendingDecision={pendingDecision}
            timeZone={timeZone}
          />
        ))}
      </div>

      {activePage.nextCursor && (
        <button
          className={styles.onboardingLoadMore}
          type="button"
          onClick={() => void loadClaims(activeStatus, {
            append: true,
            cursor: activePage.nextCursor,
          })}
          disabled={Boolean(activePage.pending)}
        >
          {activePage.pending === 'append' ? 'Cargando…' : 'Cargar altas anteriores'}
        </button>
      )}

      {!canManage && (
        <p className={styles.onboardingReadOnlyNote}>
          Tu rol puede consultar el historial, pero sólo un responsable autorizado puede aprobar o rechazar.
        </p>
      )}
    </section>
  );
}
