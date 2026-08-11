'use client';

import {
  memo,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from 'react';

import styles from './privacy-review.module.css';
import {
  assertPrivacySuccessfulResponseDtoSafe,
  INITIAL_PRIVACY_REVIEW_STATE,
  PrivacyCommittedResponseError,
  privacyReviewInteractionIsLocked,
  privacyReviewReducer,
} from './privacy-review-state';

const REQUESTS_ENDPOINT = '/api/tenant/privacy/requests';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const STATE_LABELS = Object.freeze({
  IDENTITY_PENDING: ['Identidad pendiente', 'warning'],
  IDENTITY_REVOKED_OR_EXPIRED: ['Identidad revocada o vencida', 'danger'],
  LEGAL_ASSESSMENT_PENDING: ['Evaluación legal pendiente', 'warning'],
  DECISION_PREPARATION_PENDING: ['Preparación pendiente', 'info'],
  APPROVAL_PENDING: ['Doble aprobación pendiente', 'accent'],
  REVIEW_BLOCKED: ['Revisión bloqueada', 'danger'],
  STALE: ['Expediente desactualizado', 'danger'],
});

const REQUEST_TYPE_LABELS = Object.freeze({
  ACCESS: 'Acceso',
  CORRECTION: 'Corrección',
  ERASURE: 'Supresión',
  RESTRICTION: 'Restricción',
  PORTABILITY: 'Portabilidad',
  OBJECTION: 'Oposición',
});

const CATEGORY_LABELS = Object.freeze({
  PERSONAL: 'Datos personales',
  LABOR: 'Relación laboral',
  FINANCIAL: 'Datos financieros',
  CONVERSATION: 'Conversaciones',
  MEDIA: 'Archivos multimedia',
  AI_DERIVED: 'Resultados derivados por IA',
  AUDIT: 'Auditoría',
});

const ACTION_LABELS = Object.freeze({
  DISCLOSE_CANDIDATE: 'Candidato a entrega',
  CORRECT_CANDIDATE: 'Candidato a corrección',
  RESTRICT_CANDIDATE: 'Candidato a restricción',
  PORTABILITY_CANDIDATE: 'Candidato a portabilidad',
  ERASE_CANDIDATE: 'Candidato a supresión',
  CRYPTO_ERASE_CANDIDATE: 'Candidato a borrado criptográfico',
  PSEUDONYMIZE_CANDIDATE: 'Candidato a seudonimización',
  KEEP_WITH_BASIS: 'Conservar con fundamento',
  WITHHOLD_WITH_BASIS: 'No entregar con fundamento',
  NO_CHANGE_WITH_BASIS: 'Sin cambio con fundamento',
  UNRESOLVED: 'No resuelto',
});

const COMMON_ACTIONS = Object.freeze([
  'KEEP_WITH_BASIS',
  'WITHHOLD_WITH_BASIS',
  'NO_CHANGE_WITH_BASIS',
]);

const ACTIONS_BY_REQUEST_TYPE = Object.freeze({
  ACCESS: ['DISCLOSE_CANDIDATE', ...COMMON_ACTIONS],
  CORRECTION: ['CORRECT_CANDIDATE', 'RESTRICT_CANDIDATE', ...COMMON_ACTIONS],
  ERASURE: [
    'ERASE_CANDIDATE',
    'CRYPTO_ERASE_CANDIDATE',
    'PSEUDONYMIZE_CANDIDATE',
    'RESTRICT_CANDIDATE',
    ...COMMON_ACTIONS,
  ],
  RESTRICTION: ['RESTRICT_CANDIDATE', ...COMMON_ACTIONS],
  PORTABILITY: ['PORTABILITY_CANDIDATE', 'DISCLOSE_CANDIDATE', ...COMMON_ACTIONS],
  OBJECTION: ['RESTRICT_CANDIDATE', 'PSEUDONYMIZE_CANDIDATE', ...COMMON_ACTIONS],
});

class PrivacyApiError extends Error {
  constructor(message, { code = 'PRIVACY_CONSOLE_REQUEST_FAILED', status = 0 } = {}) {
    super(message);
    this.name = 'PrivacyApiError';
    this.code = code;
    this.status = status;
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function shortId(value) {
  const normalized = String(value || '');
  if (normalized.length <= 18) return normalized;
  return `${normalized.slice(0, 10)}…${normalized.slice(-6)}`;
}

function requiredText(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} es obligatorio.`);
  return normalized;
}

function sha256(value, label) {
  const normalized = requiredText(value, label).toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) {
    throw new Error(`${label} debe ser un SHA-256 hexadecimal de 64 caracteres.`);
  }
  return normalized;
}

function isoTimestamp(value, label) {
  const normalized = requiredText(value, label);
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} no es una fecha válida.`);
  return date.toISOString();
}

function optionalIsoTimestamp(value, label) {
  return String(value || '').trim() ? isoTimestamp(value, label) : null;
}

function createIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('El navegador no puede generar una clave segura para esta operación.');
  }
  return `privacy-${globalThis.crypto.randomUUID()}`;
}

function errorMessage(error) {
  if (error instanceof PrivacyApiError && error.code) {
    return `${error.message} (${error.code})`;
  }
  return error?.message || 'No se pudo completar la operación.';
}

function responseIsAmbiguous(error) {
  return error instanceof TypeError
    || error?.name === 'AbortError'
    || (error instanceof PrivacyApiError && error.status >= 500);
}

function safeServerErrorMessage(status) {
  if (status === 400) return 'La solicitud no cumple el contrato esperado.';
  if (status === 401) return 'La sesión ya no es válida.';
  if (status === 403) return 'El administrador ya no tiene acceso a este control.';
  if (status === 404) return 'El expediente no existe en este tenant.';
  if (status === 409) return 'El expediente cambió y debe conciliarse antes de continuar.';
  if (status === 413) return 'La solicitud supera el tamaño permitido.';
  if (status === 429) return 'El control está limitado temporalmente.';
  if (status >= 500) return 'El servidor no pudo confirmar el resultado.';
  return 'El servidor rechazó la operación.';
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...options?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PrivacyApiError(
      safeServerErrorMessage(response.status),
      {
        code: typeof payload?.code === 'string' && /^[A-Z0-9_]{1,100}$/.test(payload.code)
          ? payload.code
          : 'PRIVACY_CONSOLE_REQUEST_FAILED',
        status: response.status,
      },
    );
  }
  return assertPrivacySuccessfulResponseDtoSafe(payload, {
    mutation: options?.method === 'POST',
  });
}

function StateBadge({ state }) {
  const [label, tone] = STATE_LABELS[state] || [state || 'Sin estado', 'neutral'];
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{label}</span>;
}

function EvidenceFlag({ committed }) {
  return (
    <span className={committed ? styles.evidenceOk : styles.evidenceMissing}>
      {committed ? 'Evidencia comprometida' : 'Sin evidencia vigente'}
    </span>
  );
}

function Field({ children, hint, label, name }) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <label className={styles.field} htmlFor={name}>
      <span>{label}</span>
      {children}
      {hint ? <small id={hintId}>{hint}</small> : null}
    </label>
  );
}

function TextInput({
  autoComplete = 'off',
  disabled,
  hint,
  label,
  name,
  onChange,
  pattern,
  required = true,
  type = 'text',
  value,
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <Field hint={hint} label={label} name={name}>
      <input
        aria-describedby={hintId}
        autoComplete={autoComplete}
        disabled={disabled}
        id={name}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        pattern={pattern}
        required={required}
        spellCheck={false}
        type={type}
        value={value}
      />
    </Field>
  );
}

function HashInput({ disabled, label, name, onChange, value }) {
  return (
    <TextInput
      disabled={disabled}
      hint="Pegá sólo el compromiso SHA-256; nunca el archivo ni su contenido."
      label={label}
      name={name}
      onChange={onChange}
      pattern="[a-fA-F0-9]{64}"
      value={value}
    />
  );
}

function SelectInput({ children, disabled, label, name, onChange, value }) {
  return (
    <Field label={label} name={name}>
      <select
        disabled={disabled}
        id={name}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </Field>
  );
}

function QueuePanel({
  interactionLocked,
  onLoadMore,
  onRefresh,
  onSelect,
  queue,
  selectedRequestId,
}) {
  return (
    <aside aria-labelledby="privacy-queue-heading" className={styles.queuePanel}>
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Cola del tenant</p>
          <h2 id="privacy-queue-heading">Casos revisables</h2>
        </div>
        <button
          className={styles.ghostButton}
          disabled={interactionLocked || queue.status === 'loading'}
          onClick={onRefresh}
          type="button"
        >
          Actualizar
        </button>
      </div>

      {queue.error ? <p className={styles.errorBox} role="alert">{queue.error}</p> : null}
      {queue.status === 'loading' && queue.requests.length === 0 ? (
        <p className={styles.emptyState} role="status">Cargando expedientes…</p>
      ) : null}
      {queue.status !== 'loading' && queue.requests.length === 0 ? (
        <p className={styles.emptyState}>No hay expedientes revisables.</p>
      ) : null}

      <ol className={styles.queueList}>
        {queue.requests.map((request) => (
          <li key={request.id}>
            <button
              aria-current={selectedRequestId === request.id ? 'true' : undefined}
              className={selectedRequestId === request.id ? styles.queueItemActive : styles.queueItem}
              disabled={interactionLocked}
              onClick={() => onSelect(request.id)}
              type="button"
            >
              <span className={styles.queueItemTopline}>
                <strong>{REQUEST_TYPE_LABELS[request.type] || request.type}</strong>
                <span>{shortId(request.id)}</span>
              </span>
              <StateBadge state={request.reviewState} />
              <small>
                {request.discovery.itemCount} registros · {request.activeHoldCount} retenciones
              </small>
              <time dateTime={request.receivedAt}>{formatDate(request.receivedAt)}</time>
            </button>
          </li>
        ))}
      </ol>

      {queue.nextCursor ? (
        <button
          className={styles.secondaryButton}
          disabled={interactionLocked || queue.status === 'loading'}
          onClick={onLoadMore}
          type="button"
        >
          {queue.status === 'loading' ? 'Cargando…' : 'Cargar más'}
        </button>
      ) : null}
    </aside>
  );
}

function ReviewOverview({ review }) {
  const activeHolds = review.holds.filter((hold) => hold.active);
  return (
    <section aria-labelledby="review-overview-heading" className={styles.overview}>
      <div className={styles.reviewTitle}>
        <div>
          <p className={styles.eyebrow}>Expediente {shortId(review.request.id)}</p>
          <h2 id="review-overview-heading">
            Solicitud de {REQUEST_TYPE_LABELS[review.request.type] || review.request.type}
          </h2>
        </div>
        <StateBadge state={review.reviewState} />
      </div>

      <dl className={styles.metricGrid}>
        <div>
          <dt>Descubrimiento</dt>
          <dd>{review.discovery.itemCount} elementos</dd>
          <small>
            {review.discovery.blockerCount} pendientes de revisión ·{' '}
            {review.discovery.coverageBlockerCount} brechas de cobertura
          </small>
        </div>
        <div>
          <dt>Identidad</dt>
          <dd>{review.requesterVerification?.eventKind || 'Pendiente'}</dd>
          <EvidenceFlag committed={review.requesterVerification?.evidenceCommitted} />
        </div>
        <div>
          <dt>Plazo legal</dt>
          <dd>{review.legalAssessment ? formatDate(review.legalAssessment.dueAt) : 'Pendiente'}</dd>
          <small>{review.deadlineOverdue ? 'Plazo vencido' : 'Sin vencimiento detectado'}</small>
        </div>
        <div>
          <dt>Retenciones activas</dt>
          <dd>{activeHolds.length}</dd>
          <small>Bloquean cualquier aprobación incompatible</small>
        </div>
        <div>
          <dt>Decisión</dt>
          <dd>{review.decision?.status || 'Sin preparar'}</dd>
          <small>{review.decision?.makerCheckerCompleted ? 'Doble control completo' : 'Doble control pendiente'}</small>
        </div>
      </dl>

      <div className={styles.executionLock} role="note">
        <strong>Ejecución deshabilitada</strong>
        <span>
          Incluso una decisión aprobada permanece sellada y bloqueada. La fase
          ejecutora no forma parte de esta consola.
        </span>
      </div>
    </section>
  );
}

function VerificationForm({ disabled, form, onPatch, onSubmit, review }) {
  const revoking = form.eventKind === 'REVOKED';
  const representative = form.requesterKind === 'REPRESENTATIVE';
  return (
    <details className={styles.controlCard} open={review.reviewState.startsWith('IDENTITY')}>
      <summary>
        <span>1</span>
        <strong>Verificación del solicitante</strong>
        <small>Prueba sustancial, versionada y revocable</small>
      </summary>
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.formGrid}>
          <SelectInput
            disabled={disabled}
            label="Evento"
            name="verification-event-kind"
            onChange={(eventKind) => onPatch({ eventKind })}
            value={form.eventKind}
          >
            <option value="">Seleccionar evento</option>
            <option value="VERIFIED">Registrar verificación</option>
            <option
              disabled={review.requesterVerification?.eventKind !== 'VERIFIED'}
              value="REVOKED"
            >
              Revocar verificación vigente
            </option>
          </SelectInput>
          {!revoking ? (
            <SelectInput
              disabled={disabled}
              label="Vínculo con el titular"
              name="verification-requester-kind"
              onChange={(requesterKind) => onPatch({ requesterKind })}
              value={form.requesterKind}
            >
              <option value="">Seleccionar vínculo</option>
              <option value="SELF">Titular</option>
              <option value="REPRESENTATIVE">Representante</option>
            </SelectInput>
          ) : null}
        </div>

        {revoking ? (
          <TextInput
            disabled={disabled}
            label="Código del motivo de revocación"
            name="verification-revocation-reason"
            onChange={(revocationReasonCode) => onPatch({ revocationReasonCode })}
            value={form.revocationReasonCode}
          />
        ) : (
          <>
            <div className={styles.formGrid}>
              <TextInput
                disabled={disabled}
                label="Método de verificación"
                name="verification-method"
                onChange={(verificationMethodCode) => onPatch({ verificationMethodCode })}
                value={form.verificationMethodCode}
              />
              <TextInput
                disabled={disabled}
                label="Versión de política"
                name="verification-policy"
                onChange={(verificationPolicyVersion) => onPatch({ verificationPolicyVersion })}
                value={form.verificationPolicyVersion}
              />
              <TextInput
                disabled={disabled}
                label="Válida hasta"
                name="verification-valid-until"
                onChange={(validUntil) => onPatch({ validUntil })}
                type="datetime-local"
                value={form.validUntil}
              />
              {!representative ? (
                <TextInput
                  disabled={disabled}
                  label="Revisión esperada de identidad"
                  name="verification-identity-revision"
                  onChange={(expectedSubjectIdentityRevision) => onPatch({ expectedSubjectIdentityRevision })}
                  type="number"
                  value={form.expectedSubjectIdentityRevision}
                />
              ) : null}
            </div>
            <div className={styles.formGrid}>
              <HashInput
                disabled={disabled}
                label="Evidencia del solicitante"
                name="verification-requester-evidence"
                onChange={(requesterEvidenceSha256) => onPatch({ requesterEvidenceSha256 })}
                value={form.requesterEvidenceSha256}
              />
              <HashInput
                disabled={disabled}
                label="Evidencia del desafío"
                name="verification-challenge-evidence"
                onChange={(challengeEvidenceSha256) => onPatch({ challengeEvidenceSha256 })}
                value={form.challengeEvidenceSha256}
              />
              {representative ? (
                <HashInput
                  disabled={disabled}
                  label="Evidencia de identidad"
                  name="verification-identity-evidence"
                  onChange={(identityEvidenceSha256) => onPatch({ identityEvidenceSha256 })}
                  value={form.identityEvidenceSha256}
                />
              ) : null}
            </div>
            {representative ? (
              <fieldset className={styles.fieldset}>
                <legend>Representación</legend>
                <div className={styles.formGrid}>
                  <TextInput
                    disabled={disabled}
                    label="Método"
                    name="representation-method"
                    onChange={(representationMethodCode) => onPatch({ representationMethodCode })}
                    value={form.representationMethodCode}
                  />
                  <HashInput
                    disabled={disabled}
                    label="Evidencia de representación"
                    name="representation-evidence"
                    onChange={(representationEvidenceSha256) => onPatch({ representationEvidenceSha256 })}
                    value={form.representationEvidenceSha256}
                  />
                  <TextInput
                    disabled={disabled}
                    label="Representación válida hasta"
                    name="representation-valid-until"
                    onChange={(representationValidUntil) => onPatch({ representationValidUntil })}
                    type="datetime-local"
                    value={form.representationValidUntil}
                  />
                </div>
              </fieldset>
            ) : null}
          </>
        )}
        <button className={styles.primaryButton} disabled={disabled} type="submit">
          {revoking ? 'Registrar revocación' : 'Registrar verificación'}
        </button>
      </form>
    </details>
  );
}

function AssessmentForm({ disabled, form, onPatch, onSubmit }) {
  return (
    <details className={styles.controlCard}>
      <summary>
        <span>2</span>
        <strong>Evaluación legal</strong>
        <small>Jurisdicción, plazo y matriz de retención</small>
      </summary>
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.formGrid}>
          <TextInput
            disabled={disabled}
            label="Jurisdicción"
            name="assessment-jurisdiction"
            onChange={(jurisdictionCode) => onPatch({ jurisdictionCode })}
            value={form.jurisdictionCode}
          />
          <TextInput
            disabled={disabled}
            label="Fecha límite revisada"
            name="assessment-due-at"
            onChange={(dueAt) => onPatch({ dueAt })}
            type="datetime-local"
            value={form.dueAt}
          />
          <TextInput
            disabled={disabled}
            label="Versión de política de plazo"
            name="assessment-deadline-policy"
            onChange={(deadlinePolicyVersion) => onPatch({ deadlinePolicyVersion })}
            value={form.deadlinePolicyVersion}
          />
          <TextInput
            disabled={disabled}
            label="Versión de matriz de retención"
            name="assessment-retention-matrix"
            onChange={(retentionMatrixVersion) => onPatch({ retentionMatrixVersion })}
            value={form.retentionMatrixVersion}
          />
        </div>
        <div className={styles.formGrid}>
          <HashInput
            disabled={disabled}
            label="Política de plazo"
            name="assessment-deadline-policy-evidence"
            onChange={(deadlinePolicySha256) => onPatch({ deadlinePolicySha256 })}
            value={form.deadlinePolicySha256}
          />
          <HashInput
            disabled={disabled}
            label="Matriz de retención"
            name="assessment-retention-matrix-evidence"
            onChange={(retentionMatrixSha256) => onPatch({ retentionMatrixSha256 })}
            value={form.retentionMatrixSha256}
          />
          <HashInput
            disabled={disabled}
            label="Revisión legal"
            name="assessment-legal-evidence"
            onChange={(legalReviewEvidenceSha256) => onPatch({ legalReviewEvidenceSha256 })}
            value={form.legalReviewEvidenceSha256}
          />
        </div>
        <button className={styles.primaryButton} disabled={disabled} type="submit">
          Registrar evaluación legal
        </button>
      </form>
    </details>
  );
}

function HoldForms({ disabled, form, holdEvent, onEventPatch, onEventSubmit, onPatch, onSubmit, review }) {
  const itemOptions = review.reviewItems.filter((item) => item.kind === 'RECORD');
  const categoryOptions = [...new Set(review.reviewItems.map((item) => item.category))];
  const activeHolds = review.holds.filter((hold) => hold.active);
  const releasing = holdEvent.eventKind === 'RELEASED';
  const selectedHold = activeHolds.find((hold) => hold.id === holdEvent.holdId) || null;
  return (
    <details className={styles.controlCard}>
      <summary>
        <span>3</span>
        <strong>Retenciones legales</strong>
        <small>Alta, revisión o liberación con evidencia</small>
      </summary>
      <div className={styles.splitForms}>
        <form className={styles.form} onSubmit={onSubmit}>
          <h3>Nueva retención</h3>
          <div className={styles.formGrid}>
            <SelectInput
              disabled={disabled}
              label="Alcance"
              name="hold-scope-kind"
              onChange={(scopeKind) => onPatch({
                scopeKind,
                scopeValue: '',
              })}
              value={form.scopeKind}
            >
              <option value="">Seleccionar alcance</option>
              <option disabled={itemOptions.length === 0} value="ITEM">Elemento</option>
              <option value="CATEGORY">Categoría</option>
            </SelectInput>
            <SelectInput
              disabled={disabled}
              label={form.scopeKind === 'ITEM' ? 'Elemento' : 'Categoría'}
              name="hold-scope-value"
              onChange={(scopeValue) => onPatch({ scopeValue })}
              value={form.scopeValue}
            >
              <option value="">Seleccionar destino</option>
              {form.scopeKind === 'ITEM'
                ? itemOptions.map((item) => (
                  <option key={item.reviewItemId} value={item.reviewItemId}>
                    {item.ordinal + 1}. {item.recordType}
                  </option>
                ))
                : categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category] || category}
                  </option>
                ))}
            </SelectInput>
            <TextInput
              disabled={disabled}
              label="Fundamento"
              name="hold-basis"
              onChange={(basisCode) => onPatch({ basisCode })}
              value={form.basisCode}
            />
            <TextInput
              disabled={disabled}
              label="Versión de política"
              name="hold-policy"
              onChange={(policyVersion) => onPatch({ policyVersion })}
              value={form.policyVersion}
            />
            <TextInput
              disabled={disabled}
              label="Próxima revisión"
              name="hold-review-due"
              onChange={(reviewDueAt) => onPatch({ reviewDueAt })}
              type="datetime-local"
              value={form.reviewDueAt}
            />
          </div>
          <HashInput
            disabled={disabled}
            label="Evidencia de la retención"
            name="hold-evidence"
            onChange={(evidenceSha256) => onPatch({ evidenceSha256 })}
            value={form.evidenceSha256}
          />
          <button className={styles.primaryButton} disabled={disabled} type="submit">
            Crear retención
          </button>
        </form>

        <form className={styles.form} onSubmit={onEventSubmit}>
          <h3>Actualizar retención activa</h3>
          {activeHolds.length === 0 ? (
            <p className={styles.emptyState}>No hay retenciones activas.</p>
          ) : (
            <>
              <div className={styles.formGrid}>
                <SelectInput
                  disabled={disabled}
                  label="Retención"
                  name="hold-event-target"
                  onChange={(holdId) => onEventPatch({ holdId })}
                  value={holdEvent.holdId}
                >
                  <option value="">Seleccionar retención</option>
                  {activeHolds.map((hold) => (
                    <option key={hold.id} value={hold.id}>{shortId(hold.id)}</option>
                  ))}
                </SelectInput>
                <SelectInput
                  disabled={disabled}
                  label="Evento"
                  name="hold-event-kind"
                  onChange={(eventKind) => onEventPatch({ eventKind })}
                  value={holdEvent.eventKind}
                >
                  <option value="">Seleccionar evento</option>
                  <option value="REVIEWED">Revisar y mantener</option>
                  <option value="RELEASED">Liberar</option>
                </SelectInput>
              </div>
              <p className={styles.inlineFact}>
                Cabeza esperada: {shortId(selectedHold?.headEvent.id)}
              </p>
              {releasing ? (
                <div className={styles.formGrid}>
                  <TextInput
                    disabled={disabled}
                    label="Motivo de liberación"
                    name="hold-release-reason"
                    onChange={(releaseReasonCode) => onEventPatch({ releaseReasonCode })}
                    value={holdEvent.releaseReasonCode}
                  />
                  <HashInput
                    disabled={disabled}
                    label="Evidencia de liberación"
                    name="hold-release-evidence"
                    onChange={(releaseEvidenceSha256) => onEventPatch({ releaseEvidenceSha256 })}
                    value={holdEvent.releaseEvidenceSha256}
                  />
                </div>
              ) : (
                <div className={styles.formGrid}>
                  <TextInput
                    disabled={disabled}
                    label="Fundamento"
                    name="hold-event-basis"
                    onChange={(basisCode) => onEventPatch({ basisCode })}
                    value={holdEvent.basisCode}
                  />
                  <TextInput
                    disabled={disabled}
                    label="Versión de política"
                    name="hold-event-policy"
                    onChange={(policyVersion) => onEventPatch({ policyVersion })}
                    value={holdEvent.policyVersion}
                  />
                  <TextInput
                    disabled={disabled}
                    label="Próxima revisión"
                    name="hold-event-review-due"
                    onChange={(reviewDueAt) => onEventPatch({ reviewDueAt })}
                    type="datetime-local"
                    value={holdEvent.reviewDueAt}
                  />
                  <HashInput
                    disabled={disabled}
                    label="Evidencia de revisión"
                    name="hold-event-evidence"
                    onChange={(evidenceSha256) => onEventPatch({ evidenceSha256 })}
                    value={holdEvent.evidenceSha256}
                  />
                </div>
              )}
              <button className={styles.primaryButton} disabled={disabled} type="submit">
                {releasing ? 'Registrar liberación' : 'Registrar revisión'}
              </button>
            </>
          )}
        </form>
      </div>
    </details>
  );
}

const DecisionItemEditor = memo(function DecisionItemEditor({
  actions,
  disabled,
  draft,
  item,
  onItemPatch,
}) {
  const blocker = item.kind === 'COVERAGE_BLOCKER';
  return (
    <li className={styles.decisionItem}>
      <div className={styles.decisionItemHeading}>
        <span>{item.ordinal + 1}</span>
        <div>
          <strong>{item.recordType}</strong>
          <small>{CATEGORY_LABELS[item.category] || item.category}</small>
        </div>
        {blocker ? <span className={styles.blockerTag}>Bloqueo de cobertura</span> : null}
      </div>
      <div className={styles.formGrid}>
        <SelectInput
          disabled={disabled || blocker}
          label="Acción candidata"
          name={`decision-action-${item.ordinal}`}
          onChange={(action) => onItemPatch(item.reviewItemId, {
            action,
            ...(action === 'UNRESOLVED' ? {
              legalBasisCode: '',
              retentionPolicyVersion: '',
              retentionRuleCode: '',
              retentionUntil: '',
            } : null),
          })}
          value={draft?.action || ''}
        >
          {!blocker ? <option value="">Seleccionar sin inferencias</option> : null}
          {(blocker ? ['UNRESOLVED'] : actions).map((action) => (
            <option key={action} value={action}>{ACTION_LABELS[action]}</option>
          ))}
        </SelectInput>
        {!blocker ? (
          <>
            <TextInput
              disabled={disabled}
              label="Fundamento legal"
              name={`decision-basis-${item.ordinal}`}
              onChange={(legalBasisCode) => onItemPatch(item.reviewItemId, { legalBasisCode })}
              value={draft?.legalBasisCode || ''}
            />
            <TextInput
              disabled={disabled}
              label="Versión de retención"
              name={`decision-policy-${item.ordinal}`}
              onChange={(retentionPolicyVersion) => onItemPatch(item.reviewItemId, { retentionPolicyVersion })}
              value={draft?.retentionPolicyVersion || ''}
            />
            <TextInput
              disabled={disabled}
              label="Regla de retención"
              name={`decision-rule-${item.ordinal}`}
              onChange={(retentionRuleCode) => onItemPatch(item.reviewItemId, { retentionRuleCode })}
              value={draft?.retentionRuleCode || ''}
            />
            <TextInput
              disabled={disabled}
              label="Retener hasta (opcional)"
              name={`decision-until-${item.ordinal}`}
              onChange={(retentionUntil) => onItemPatch(item.reviewItemId, { retentionUntil })}
              required={false}
              type="datetime-local"
              value={draft?.retentionUntil || ''}
            />
          </>
        ) : (
          <p className={styles.blockerExplanation}>
            Un bloqueo sólo puede quedar como no resuelto; no admite
            fundamento ni regla de retención inventados.
          </p>
        )}
      </div>
    </li>
  );
});

function DecisionForm({ disabled, drafts, onItemPatch, onSubmit, review }) {
  const actions = ACTIONS_BY_REQUEST_TYPE[review.request.type] || COMMON_ACTIONS;
  return (
    <details className={styles.controlCard} open={review.reviewState === 'DECISION_PREPARATION_PENDING'}>
      <summary>
        <span>4</span>
        <strong>Preparar decisión completa</strong>
        <small>Cobertura exacta de {review.reviewItems.length} elementos</small>
      </summary>
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.decisionNotice} role="note">
          Cada elemento exige una decisión humana. La consola no sugiere ni
          completa fundamentos, reglas o plazos.
        </div>
        <ol className={styles.decisionList}>
          {review.reviewItems.map((item) => (
            <DecisionItemEditor
              actions={actions}
              disabled={disabled}
              draft={drafts[item.reviewItemId]}
              item={item}
              key={item.reviewItemId}
              onItemPatch={onItemPatch}
            />
          ))}
        </ol>
        <button className={styles.primaryButton} disabled={disabled} type="submit">
          Sellar y enviar a doble aprobación
        </button>
      </form>
    </details>
  );
}

function ApprovalForm({ disabled, form, onPatch, onSubmit, review }) {
  const pending = review.decision?.status === 'PENDING_APPROVAL';
  return (
    <details className={styles.controlCard} open={review.reviewState === 'APPROVAL_PENDING'}>
      <summary>
        <span>5</span>
        <strong>Doble aprobación</strong>
        <small>El aprobador debe ser distinto de quien preparó</small>
      </summary>
      <form className={styles.form} onSubmit={onSubmit}>
        {!pending ? (
          <p className={styles.emptyState}>No hay una decisión pendiente de aprobación.</p>
        ) : (
          <>
            <div className={styles.approvalSummary}>
              <span>Revisión {review.decision.revision}</span>
              <span>{review.decision.itemCount} elementos</span>
              <span>{review.decision.unresolvedCount} no resueltos</span>
              <span>{review.decision.activeHoldCount} retenciones capturadas</span>
            </div>
            <div className={styles.formGrid}>
              <SelectInput
                disabled={disabled}
                label="Decisión del segundo administrador"
                name="approval-decision"
                onChange={(decision) => onPatch({ decision })}
                value={form.decision}
              >
                <option value="">Seleccionar conscientemente</option>
                <option value="APPROVE">Aprobar expediente</option>
                <option value="REJECT">Rechazar expediente</option>
              </SelectInput>
              {form.decision === 'REJECT' ? (
                <TextInput
                  disabled={disabled}
                  label="Código del motivo de rechazo"
                  name="approval-reason"
                  onChange={(reasonCode) => onPatch({ reasonCode })}
                  value={form.reasonCode}
                />
              ) : null}
            </div>
            <div className={styles.executionLock} role="note">
              Aprobar sólo sella el expediente como bloqueado. No inicia una
              acción sobre los datos descubiertos.
            </div>
            <button className={styles.primaryButton} disabled={disabled} type="submit">
              Registrar doble control
            </button>
          </>
        )}
      </form>
    </details>
  );
}

function MutationStatus({ mutation, onClear, onReconcile, onRetry }) {
  if (mutation.status === 'idle') return null;
  if (mutation.status === 'submitting') {
    return <p aria-live="polite" className={styles.progressBox}>Registrando {mutation.label}…</p>;
  }
  if (mutation.status === 'success') {
    return (
      <div aria-live="polite" className={styles.successBox}>
        <span>{mutation.notice}</span>
        <button onClick={onClear} type="button">Cerrar</button>
      </div>
    );
  }
  if (mutation.status === 'uncertain') {
    return (
      <section aria-labelledby="uncertain-heading" className={styles.uncertainBox}>
        <h3 id="uncertain-heading">Resultado incierto: no se reenvió nada</h3>
        <p>{mutation.error}</p>
        <p>
          La consola {mutation.reconciliation === 'loading'
            ? 'está conciliando el expediente con una lectura segura.'
            : mutation.reconciliation === 'complete'
              ? 'recargó el expediente. Revisá el estado antes de decidir.'
              : 'no pudo conciliar el expediente todavía.'}
        </p>
        <div className={styles.statusActions}>
          <button className={styles.secondaryButton} onClick={onReconcile} type="button">
            Conciliar otra vez
          </button>
          <button
            className={styles.dangerButton}
            disabled={mutation.reconciliation === 'loading'}
            onClick={onRetry}
            type="button"
          >
            Reintentar exactamente la misma solicitud
          </button>
        </div>
      </section>
    );
  }
  if (mutation.status === 'reconciliation_required') {
    return (
      <section aria-labelledby="reconciliation-heading" className={styles.uncertainBox}>
        <h3 id="reconciliation-heading">Registro confirmado; lectura pendiente</h3>
        <p>{mutation.error}</p>
        <p>No se reenviará el POST. Sólo se volverán a leer el expediente y la cola.</p>
        <button className={styles.secondaryButton} onClick={onReconcile} type="button">
          Reintentar conciliación segura
        </button>
      </section>
    );
  }
  return (
    <div className={styles.errorBox} role="alert">
      <span>{mutation.error}</span>
      <button onClick={onClear} type="button">Cerrar</button>
    </div>
  );
}

export default function PrivacyReviewConsole() {
  const [state, dispatch] = useReducer(
    privacyReviewReducer,
    INITIAL_PRIVACY_REVIEW_STATE,
  );
  const queueSequence = useRef(0);
  const reviewSequence = useRef(0);
  const queueController = useRef(null);
  const reviewController = useRef(null);
  const mutationController = useRef(null);
  const mutationInFlight = useRef(false);
  const mounted = useRef(true);

  const loadReview = useCallback(async (
    requestId,
    { preserveCurrent = false, preserveForms = false } = {},
  ) => {
    reviewController.current?.abort();
    const controller = new AbortController();
    reviewController.current = controller;
    const sequence = ++reviewSequence.current;
    dispatch({
      type: 'REVIEW_LOADING',
      requestId,
      sequence,
      preserveCurrent,
    });
    try {
      const payload = await requestJson(
        `${REQUESTS_ENDPOINT}/${encodeURIComponent(requestId)}/review`,
        { signal: controller.signal },
      );
      if (!mounted.current || controller.signal.aborted) return false;
      dispatch({
        type: 'REVIEW_SUCCESS',
        requestId,
        sequence,
        payload,
        preserveForms,
      });
      return true;
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return false;
      dispatch({
        type: 'REVIEW_FAILURE',
        requestId,
        sequence,
        error: errorMessage(error),
      });
      return false;
    }
  }, []);

  const loadQueue = useCallback(async ({
    append = false,
    cursor = null,
    selectFirst = false,
  } = {}) => {
    queueController.current?.abort();
    const controller = new AbortController();
    queueController.current = controller;
    const sequence = ++queueSequence.current;
    dispatch({ type: 'QUEUE_LOADING', sequence, append });
    try {
      const query = new URLSearchParams({ limit: '25' });
      if (cursor) query.set('cursor', cursor);
      const payload = await requestJson(`${REQUESTS_ENDPOINT}?${query}`, {
        signal: controller.signal,
      });
      if (!mounted.current || controller.signal.aborted) return false;
      dispatch({ type: 'QUEUE_SUCCESS', sequence, payload, append });
      if (selectFirst && payload.requests[0]) {
        await loadReview(payload.requests[0].id);
      }
      return true;
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return false;
      dispatch({
        type: 'QUEUE_FAILURE',
        sequence,
        error: errorMessage(error),
      });
      return false;
    }
  }, [loadReview]);

  useEffect(() => {
    mounted.current = true;
    void loadQueue({ selectFirst: true });
    return () => {
      mounted.current = false;
      queueController.current?.abort();
      reviewController.current?.abort();
      mutationController.current?.abort();
    };
  }, [loadQueue]);

  const sendOperation = useCallback(async (operation) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    const controller = new AbortController();
    mutationController.current = controller;
    dispatch({ type: 'MUTATION_START', operation });
    try {
      const payload = await requestJson(operation.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': operation.idempotencyKey,
        },
        body: JSON.stringify(operation.body),
      });
      if (!mounted.current || controller.signal.aborted) return;
      const [reviewReconciled, queueReconciled] = await Promise.all([
        loadReview(operation.requestId),
        loadQueue(),
      ]);
      if (mounted.current) {
        const notice = payload.replayed
          ? `${operation.label}: respuesta idempotente recuperada.`
          : `${operation.label}: registro confirmado.`;
        if (!reviewReconciled || !queueReconciled) {
          dispatch({
            type: 'MUTATION_RECONCILIATION_REQUIRED',
            operation,
            error: 'El registro fue confirmado, pero la lectura posterior no pudo conciliarse.',
            notice,
          });
          return;
        }
        dispatch({
          type: 'MUTATION_SUCCESS',
          label: operation.label,
          notice,
        });
      }
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof PrivacyCommittedResponseError) {
        const notice = `${operation.label}: HTTP 2xx conciliado por lectura segura.`;
        dispatch({
          type: 'MUTATION_RECONCILIATION_REQUIRED',
          operation,
          error: errorMessage(error),
          notice,
        });
        const [reviewReconciled, queueReconciled] = await Promise.all([
          loadReview(operation.requestId, { preserveCurrent: true }),
          loadQueue(),
        ]);
        if (mounted.current) {
          dispatch({
            type: 'MUTATION_RECONCILED',
            ok: reviewReconciled && queueReconciled,
          });
        }
        return;
      }
      if (responseIsAmbiguous(error)) {
        dispatch({
          type: 'MUTATION_UNCERTAIN',
          operation,
          error: errorMessage(error),
        });
        const reconciled = await loadReview(operation.requestId, {
          preserveCurrent: true,
          preserveForms: true,
        });
        if (mounted.current) {
          dispatch({ type: 'MUTATION_RECONCILED', ok: reconciled });
        }
        return;
      }
      dispatch({
        type: 'MUTATION_FAILURE',
        label: operation.label,
        error: errorMessage(error),
        reconciliation: error instanceof PrivacyApiError && error.status === 409
          ? 'loading'
          : 'idle',
      });
      if (error instanceof PrivacyApiError && error.status === 409) {
        await loadReview(operation.requestId);
      }
    } finally {
      mutationInFlight.current = false;
    }
  }, [loadQueue, loadReview]);

  const patchDecisionItem = useCallback((reviewItemId, patch) => {
    dispatch({
      type: 'DECISION_ITEM_PATCH',
      reviewItemId,
      patch,
    });
  }, []);

  function operationFor(label, path, body) {
    const requestId = state.review.data.request.id;
    return {
      label,
      requestId,
      url: `${REQUESTS_ENDPOINT}/${encodeURIComponent(requestId)}${path}`,
      idempotencyKey: createIdempotencyKey(),
      body,
    };
  }

  function submitVerification(event) {
    event.preventDefault();
    const review = state.review.data;
    const form = state.forms.verification;
    try {
      if (!['VERIFIED', 'REVOKED'].includes(form.eventKind)) {
        throw new Error('Elegí el evento de verificación.');
      }
      let body;
      if (form.eventKind === 'REVOKED') {
        body = {
          eventKind: 'REVOKED',
          expectedHeadEventId: requiredText(
            review.requesterVerification?.id,
            'La verificación vigente',
          ),
          revocationReasonCode: requiredText(
            form.revocationReasonCode,
            'El motivo de revocación',
          ),
        };
      } else {
        if (!['SELF', 'REPRESENTATIVE'].includes(form.requesterKind)) {
          throw new Error('Elegí si actúa el titular o un representante.');
        }
        body = {
          eventKind: 'VERIFIED',
          expectedHeadEventId: review.requesterVerification?.id || null,
          requesterKind: form.requesterKind,
          assuranceLevel: 'SUBSTANTIAL',
          verificationMethodCode: requiredText(form.verificationMethodCode, 'El método'),
          verificationPolicyVersion: requiredText(form.verificationPolicyVersion, 'La política'),
          requesterEvidenceSha256: sha256(form.requesterEvidenceSha256, 'La evidencia del solicitante'),
          challengeEvidenceSha256: sha256(form.challengeEvidenceSha256, 'La evidencia del desafío'),
          validUntil: isoTimestamp(form.validUntil, 'La vigencia'),
          ...(form.requesterKind === 'SELF' ? {
            expectedSubjectIdentityRevision: Number(
              requiredText(form.expectedSubjectIdentityRevision, 'La revisión de identidad'),
            ),
          } : {
            identityEvidenceSha256: sha256(form.identityEvidenceSha256, 'La evidencia de identidad'),
            representation: {
              methodCode: requiredText(form.representationMethodCode, 'El método de representación'),
              evidenceSha256: sha256(form.representationEvidenceSha256, 'La evidencia de representación'),
              validUntil: isoTimestamp(form.representationValidUntil, 'La vigencia de representación'),
            },
          }),
        };
        if (
          form.requesterKind === 'SELF'
          && (
            !Number.isSafeInteger(body.expectedSubjectIdentityRevision)
            || body.expectedSubjectIdentityRevision < 1
          )
        ) {
          throw new Error('La revisión de identidad debe ser un entero válido.');
        }
      }
      void sendOperation(operationFor(
        'Verificación del solicitante',
        '/verification-events',
        body,
      ));
    } catch (error) {
      dispatch({ type: 'MUTATION_FAILURE', label: 'Verificación', error: errorMessage(error) });
    }
  }

  function submitAssessment(event) {
    event.preventDefault();
    const review = state.review.data;
    const form = state.forms.assessment;
    try {
      const body = {
        expectedHeadAssessmentId: review.legalAssessment?.id || null,
        jurisdictionCode: requiredText(form.jurisdictionCode, 'La jurisdicción'),
        deadlineMethod: 'REVIEWED_EXPLICIT_DATE',
        dueAt: isoTimestamp(form.dueAt, 'La fecha límite'),
        deadlinePolicyVersion: requiredText(form.deadlinePolicyVersion, 'La política de plazo'),
        deadlinePolicySha256: sha256(form.deadlinePolicySha256, 'La evidencia de la política de plazo'),
        retentionMatrixVersion: requiredText(form.retentionMatrixVersion, 'La matriz de retención'),
        retentionMatrixSha256: sha256(form.retentionMatrixSha256, 'La evidencia de la matriz'),
        legalReviewEvidenceSha256: sha256(form.legalReviewEvidenceSha256, 'La evidencia legal'),
      };
      void sendOperation(operationFor('Evaluación legal', '/legal-assessments', body));
    } catch (error) {
      dispatch({ type: 'MUTATION_FAILURE', label: 'Evaluación legal', error: errorMessage(error) });
    }
  }

  function submitHold(event) {
    event.preventDefault();
    const review = state.review.data;
    const form = state.forms.hold;
    try {
      if (!['ITEM', 'CATEGORY'].includes(form.scopeKind)) {
        throw new Error('Elegí el alcance de la retención.');
      }
      const body = {
        manifestId: review.discovery.id,
        scope: form.scopeKind === 'ITEM'
          ? { kind: 'ITEM', reviewItemId: requiredText(form.scopeValue, 'El elemento') }
          : { kind: 'CATEGORY', category: requiredText(form.scopeValue, 'La categoría') },
        basisCode: requiredText(form.basisCode, 'El fundamento'),
        policyVersion: requiredText(form.policyVersion, 'La versión de política'),
        evidenceSha256: sha256(form.evidenceSha256, 'La evidencia de retención'),
        reviewDueAt: isoTimestamp(form.reviewDueAt, 'La próxima revisión'),
      };
      void sendOperation(operationFor('Retención legal', '/holds', body));
    } catch (error) {
      dispatch({ type: 'MUTATION_FAILURE', label: 'Retención legal', error: errorMessage(error) });
    }
  }

  function submitHoldEvent(event) {
    event.preventDefault();
    const review = state.review.data;
    const form = state.forms.holdEvent;
    const hold = review.holds.find((entry) => entry.active && entry.id === form.holdId);
    try {
      if (!hold) throw new Error('Seleccioná una retención activa.');
      if (!['REVIEWED', 'RELEASED'].includes(form.eventKind)) {
        throw new Error('Elegí revisar o liberar la retención.');
      }
      const body = form.eventKind === 'RELEASED'
        ? {
          eventKind: 'RELEASED',
          expectedHeadEventId: hold.headEvent.id,
          releaseReasonCode: requiredText(form.releaseReasonCode, 'El motivo de liberación'),
          releaseEvidenceSha256: sha256(form.releaseEvidenceSha256, 'La evidencia de liberación'),
        }
        : {
          eventKind: 'REVIEWED',
          expectedHeadEventId: hold.headEvent.id,
          basisCode: requiredText(form.basisCode, 'El fundamento'),
          policyVersion: requiredText(form.policyVersion, 'La versión de política'),
          evidenceSha256: sha256(form.evidenceSha256, 'La evidencia de revisión'),
          reviewDueAt: isoTimestamp(form.reviewDueAt, 'La próxima revisión'),
        };
      void sendOperation(operationFor(
        form.eventKind === 'RELEASED' ? 'Liberación de retención' : 'Revisión de retención',
        `/holds/${encodeURIComponent(hold.id)}/events`,
        body,
      ));
    } catch (error) {
      dispatch({ type: 'MUTATION_FAILURE', label: 'Evento de retención', error: errorMessage(error) });
    }
  }

  function submitDecision(event) {
    event.preventDefault();
    const review = state.review.data;
    try {
      if (!review.requesterVerification?.id || !review.legalAssessment?.id) {
        throw new Error('La identidad y la evaluación legal deben estar vigentes.');
      }
      const items = review.reviewItems.map((item) => {
        const draft = state.forms.decisionItems[item.reviewItemId];
        const blocker = item.kind === 'COVERAGE_BLOCKER';
        if (!draft || (!blocker && !draft.action)) {
          throw new Error(`Elegí una acción para el elemento ${item.ordinal + 1}.`);
        }
        if (blocker) {
          return {
            reviewItemId: item.reviewItemId,
            action: 'UNRESOLVED',
            legalBasisCode: null,
            retentionPolicyVersion: null,
            retentionRuleCode: null,
            retentionUntil: null,
          };
        }
        return {
          reviewItemId: item.reviewItemId,
          action: draft.action,
          legalBasisCode: requiredText(draft.legalBasisCode, `El fundamento del elemento ${item.ordinal + 1}`),
          retentionPolicyVersion: requiredText(draft.retentionPolicyVersion, `La política del elemento ${item.ordinal + 1}`),
          retentionRuleCode: requiredText(draft.retentionRuleCode, `La regla del elemento ${item.ordinal + 1}`),
          retentionUntil: optionalIsoTimestamp(
            draft.retentionUntil,
            `La fecha de retención del elemento ${item.ordinal + 1}`,
          ),
        };
      });
      const body = {
        manifestId: review.discovery.id,
        expectedVerificationEventId: review.requesterVerification.id,
        expectedLegalAssessmentId: review.legalAssessment.id,
        holdSetRevisionToken: review.holdSetRevisionToken,
        expectedPreviousDecisionId: review.decision?.id || null,
        items,
      };
      void sendOperation(operationFor('Preparación de decisión', '/decisions', body));
    } catch (error) {
      dispatch({ type: 'MUTATION_FAILURE', label: 'Preparación de decisión', error: errorMessage(error) });
    }
  }

  function submitApproval(event) {
    event.preventDefault();
    const review = state.review.data;
    const form = state.forms.approval;
    try {
      if (!review.decision || review.decision.status !== 'PENDING_APPROVAL') {
        throw new Error('No hay una decisión pendiente de doble aprobación.');
      }
      if (!['APPROVE', 'REJECT'].includes(form.decision)) {
        throw new Error('Elegí aprobar o rechazar conscientemente.');
      }
      const body = {
        expectedRevision: review.decision.revision,
        decisionRevisionToken: review.decision.decisionRevisionToken,
        decision: form.decision,
        reasonCode: form.decision === 'APPROVE'
          ? null
          : requiredText(form.reasonCode, 'El motivo de rechazo'),
      };
      void sendOperation(operationFor(
        'Doble aprobación',
        `/decisions/${encodeURIComponent(review.decision.id)}/approval`,
        body,
      ));
    } catch (error) {
      dispatch({ type: 'MUTATION_FAILURE', label: 'Doble aprobación', error: errorMessage(error) });
    }
  }

  const review = state.review.data;
  const forms = state.forms;
  const interactionLocked = privacyReviewInteractionIsLocked(state.mutation);
  const operationDisabled = interactionLocked
    || state.review.status !== 'ready';

  return (
    <div className={styles.console}>
      <header className={styles.consoleHeader}>
        <div>
          <p className={styles.eyebrow}>PRO-05B.1 · plano de control</p>
          <h1>Decisiones de privacidad con doble control</h1>
          <p>
            Revisión tenant-scoped, sin contexto de obra y sin automatizar
            decisiones legales ni acciones sobre datos.
          </p>
        </div>
        <div className={styles.headerAssurances} aria-label="Garantías activas">
          <span>Administrador activo</span>
          <span>Sin contexto de obra</span>
          <span>Sin ejecución</span>
        </div>
      </header>

      <MutationStatus
        mutation={state.mutation}
        onClear={() => dispatch({ type: 'MUTATION_CLEAR' })}
        onReconcile={async () => {
          const operation = state.mutation.uncertainOperation;
          const requestId = operation?.requestId
            || state.mutation.reconciliationRequestId;
          if (!requestId) return;
          const [reviewReconciled, queueReconciled] = await Promise.all([
            loadReview(requestId, {
              preserveCurrent: true,
              preserveForms: state.mutation.status === 'uncertain',
            }),
            loadQueue(),
          ]);
          if (mounted.current) {
            dispatch({
              type: 'MUTATION_RECONCILED',
              ok: reviewReconciled && queueReconciled,
            });
          }
        }}
        onRetry={() => {
          const operation = state.mutation.uncertainOperation;
          if (operation) void sendOperation(operation);
        }}
      />

      <div className={styles.workspace}>
        <QueuePanel
          interactionLocked={interactionLocked}
          onLoadMore={() => loadQueue({
            append: true,
            cursor: state.queue.nextCursor,
          })}
          onRefresh={async () => {
            await loadQueue();
            if (state.selectedRequestId) {
              await loadReview(state.selectedRequestId, { preserveCurrent: true });
            }
          }}
          onSelect={(requestId) => {
            if (!interactionLocked) void loadReview(requestId);
          }}
          queue={state.queue}
          selectedRequestId={state.selectedRequestId}
        />

        <section aria-label="Detalle del expediente" className={styles.reviewPanel}>
          {state.review.status === 'loading' && !review ? (
            <p className={styles.emptyState} role="status">Cargando expediente…</p>
          ) : null}
          {state.review.error ? (
            <div className={styles.errorBox} role="alert">
              <span>{state.review.error}</span>
              {state.selectedRequestId ? (
                <button onClick={() => loadReview(state.selectedRequestId)} type="button">
                  Reintentar lectura
                </button>
              ) : null}
            </div>
          ) : null}
          {!review && state.review.status === 'idle' ? (
            <div className={styles.emptyReview}>
              <strong>Seleccioná un expediente</strong>
              <span>La cola no expone nombres, contactos ni contenido descubierto.</span>
            </div>
          ) : null}

          {review && forms ? (
            <>
              <ReviewOverview review={review} />
              <section aria-labelledby="control-sequence-heading" className={styles.controls}>
                <div className={styles.sectionHeading}>
                  <div>
                    <p className={styles.eyebrow}>Secuencia controlada</p>
                    <h2 id="control-sequence-heading">Construir el expediente</h2>
                  </div>
                  <button
                    className={styles.ghostButton}
                    disabled={state.review.status === 'loading'}
                    onClick={() => loadReview(review.request.id, { preserveCurrent: true })}
                    type="button"
                  >
                    Conciliar estado
                  </button>
                </div>

                <VerificationForm
                  disabled={operationDisabled}
                  form={forms.verification}
                  onPatch={(patch) => dispatch({ type: 'FORM_PATCH', form: 'verification', patch })}
                  onSubmit={submitVerification}
                  review={review}
                />
                <AssessmentForm
                  disabled={operationDisabled || [
                    'IDENTITY_PENDING',
                    'IDENTITY_REVOKED_OR_EXPIRED',
                  ].includes(review.reviewState)}
                  form={forms.assessment}
                  onPatch={(patch) => dispatch({ type: 'FORM_PATCH', form: 'assessment', patch })}
                  onSubmit={submitAssessment}
                />
                <HoldForms
                  disabled={operationDisabled}
                  form={forms.hold}
                  holdEvent={forms.holdEvent}
                  onEventPatch={(patch) => dispatch({ type: 'FORM_PATCH', form: 'holdEvent', patch })}
                  onEventSubmit={submitHoldEvent}
                  onPatch={(patch) => dispatch({ type: 'FORM_PATCH', form: 'hold', patch })}
                  onSubmit={submitHold}
                  review={review}
                />
                <DecisionForm
                  disabled={operationDisabled || ![
                    'DECISION_PREPARATION_PENDING',
                    'REVIEW_BLOCKED',
                    'STALE',
                  ].includes(review.reviewState)}
                  drafts={forms.decisionItems}
                  onItemPatch={patchDecisionItem}
                  onSubmit={submitDecision}
                  review={review}
                />
                <ApprovalForm
                  disabled={operationDisabled || review.reviewState !== 'APPROVAL_PENDING'}
                  form={forms.approval}
                  onPatch={(patch) => dispatch({ type: 'FORM_PATCH', form: 'approval', patch })}
                  onSubmit={submitApproval}
                  review={review}
                />
              </section>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
