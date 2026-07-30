'use client';

import { useRef, useState } from 'react';

import styles from './team.module.css';

const DESTINATION_STATUSES = new Set([
  'PENDING_VERIFICATION',
  'VERIFIED',
  'ACTIVE',
  'SUPERSEDED',
  'REJECTED',
  'REVOKED',
]);
const DESTINATION_TYPES = new Set(['CBU', 'CVU', 'ALIAS']);
const PURPOSES = new Set(['SALARY', 'REIMBURSEMENT']);
const PRIVACY_STATUSES = new Set(['ATTESTED', 'REATTESTATION_REQUIRED']);
const MASKED_VALUE_PATTERN = /^(?:CBU|CVU|Alias) •••• [a-z0-9.-]{1,4}$/;
const SAFE_ID_PATTERN = /^[^\u0000-\u001f\u007f]{1,190}$/;
const MAX_REASON_LENGTH = 500;
let operationSequence = 0;

const STATUS_LABELS = Object.freeze({
  PENDING_VERIFICATION: 'Pendiente de verificación',
  VERIFIED: 'Verificado',
  ACTIVE: 'Activo',
  SUPERSEDED: 'Reemplazado',
  REJECTED: 'Rechazado',
  REVOKED: 'Revocado',
});

const PURPOSE_LABELS = Object.freeze({
  SALARY: 'Haberes',
  REIMBURSEMENT: 'Reintegros',
});

const ACTION_LABELS = Object.freeze({
  REJECT: 'Rechazar destino',
  REVOKE: 'Revocar destino',
  ACTIVATE: 'Activar destino',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function safeId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return SAFE_ID_PATTERN.test(normalized) ? normalized : null;
}

function safeInteger(value, minimum) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum ? number : null;
}

function safeIsoDate(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function projectPaymentDestination(value) {
  const source = objectValue(value);
  const id = safeId(source.id);
  const type = DESTINATION_TYPES.has(source.type) ? source.type : null;
  const purpose = PURPOSES.has(source.purpose) ? source.purpose : null;
  const status = DESTINATION_STATUSES.has(source.status) ? source.status : null;
  const version = safeInteger(source.version, 1);
  const revision = safeInteger(source.revision, 0);
  const privacyStatus = PRIVACY_STATUSES.has(source.privacyStatus)
    ? source.privacyStatus
    : null;
  const maskedValue = typeof source.maskedValue === 'string'
    && MASKED_VALUE_PATTERN.test(source.maskedValue)
    ? source.maskedValue
    : null;
  if (
    !id
    || !type
    || !purpose
    || !status
    || version === null
    || revision === null
    || !privacyStatus
    || !maskedValue
    || source.currency !== 'ARS'
    || typeof source.paymentUsable !== 'boolean'
    || source.paymentUsable !== (status === 'ACTIVE' && privacyStatus === 'ATTESTED')
  ) {
    return null;
  }
  return {
    id,
    type,
    purpose,
    currency: 'ARS',
    maskedValue,
    status,
    version,
    revision,
    privacyStatus,
    paymentUsable: source.paymentUsable,
    availableFrom: safeIsoDate(source.availableFrom),
    verifiedAt: safeIsoDate(source.verifiedAt),
    createdAt: safeIsoDate(source.createdAt),
    updatedAt: safeIsoDate(source.updatedAt),
  };
}

function safeWorker(value) {
  const source = objectValue(value);
  const id = safeId(source.id);
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  if (!id || !name || name.length > 100) return null;
  return {
    id,
    name,
    role: typeof source.role === 'string' && source.role.trim()
      ? source.role.trim().slice(0, 80)
      : 'Cuadrilla de obra',
    active: source.active === true,
  };
}

function formatDate(value) {
  if (!value) return 'No registrada';
  return DATE_FORMATTER.format(new Date(value));
}

function operationKey(action) {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `payment-${action.toLowerCase()}-${randomId}`;
  const entropy = new Uint32Array(4);
  globalThis.crypto?.getRandomValues?.(entropy);
  const suffix = [...entropy].map((value) => value.toString(16).padStart(8, '0')).join('');
  operationSequence += 1;
  return `payment-${action.toLowerCase()}-${Date.now().toString(36)}-${operationSequence}-${suffix}`;
}

async function readResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      typeof payload.error === 'string' && payload.error ? payload.error : fallbackMessage,
    );
    error.status = response.status;
    error.code = typeof payload.code === 'string' ? payload.code : null;
    throw error;
  }
  return objectValue(payload);
}

function decisionEndpoint(workerId, destinationId, action) {
  const base = `/api/field/workers/${encodeURIComponent(workerId)}`
    + `/payment-destinations/${encodeURIComponent(destinationId)}`;
  if (action === 'ACTIVATE') return `${base}/activation`;
  if (action === 'REVOKE') return `${base}/revocation`;
  return `${base}/verification`;
}

function decisionBody(decision) {
  if (decision.action === 'ACTIVATE') {
    return { expectedRevision: decision.destination.revision };
  }
  if (decision.action === 'REVOKE') {
    return {
      expectedRevision: decision.destination.revision,
      reason: decision.reason.trim(),
    };
  }
  return {
    decision: 'REJECT',
    expectedRevision: decision.destination.revision,
    rejectionReason: decision.reason.trim(),
  };
}

function reasonPrompt(action) {
  return action === 'REJECT'
    ? 'Documentá por qué la evidencia no permite aceptar este destino.'
    : 'Documentá por qué este destino ya no debe utilizarse.';
}

export default function WorkerPaymentDestinationsClient({
  workers: rawWorkers,
  canManage,
  canActivate,
}) {
  const workers = Array.isArray(rawWorkers) ? rawWorkers.map(safeWorker).filter(Boolean) : [];
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerStates, setWorkerStates] = useState({});
  const [decision, setDecision] = useState(null);
  const [notice, setNotice] = useState(null);
  const loadEpochRef = useRef(new Map());

  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId) || null;
  const selectedState = selectedWorkerId ? workerStates[selectedWorkerId] : null;

  async function loadDestinations(workerId, { silent = false } = {}) {
    const epoch = (loadEpochRef.current.get(workerId) || 0) + 1;
    loadEpochRef.current.set(workerId, epoch);
    setWorkerStates((current) => ({
      ...current,
      [workerId]: {
        items: current[workerId]?.items || [],
        status: 'loading',
        error: null,
      },
    }));
    if (!silent) setNotice(null);
    try {
      const response = await fetch(
        `/api/field/workers/${encodeURIComponent(workerId)}/payment-destinations`,
        { cache: 'no-store' },
      );
      const payload = await readResponse(response, 'No se pudieron cargar los destinos de cobro.');
      if (!Array.isArray(payload.paymentDestinations)) {
        throw new Error('El servidor devolvió una lista de destinos inválida.');
      }
      const items = payload.paymentDestinations.map(projectPaymentDestination);
      if (items.some((item) => !item)) {
        throw new Error('El servidor devolvió un destino fuera del contrato seguro.');
      }
      if (loadEpochRef.current.get(workerId) !== epoch) return false;
      setWorkerStates((current) => ({
        ...current,
        [workerId]: { items, status: 'loaded', error: null },
      }));
      return true;
    } catch (error) {
      if (loadEpochRef.current.get(workerId) !== epoch) return false;
      setWorkerStates((current) => ({
        ...current,
        [workerId]: {
          items: current[workerId]?.items || [],
          status: 'error',
          error: error.message,
        },
      }));
      return false;
    }
  }

  function selectWorker(workerId) {
    setSelectedWorkerId(workerId);
    setDecision(null);
    setNotice(null);
    if (workerId && !workerStates[workerId]) void loadDestinations(workerId);
  }

  function openDecision(worker, destination, action) {
    setDecision({
      workerId: worker.id,
      destination,
      action,
      reason: '',
      idempotencyKey: operationKey(action),
      pending: false,
    });
    setNotice(null);
  }

  function updateReason(reason) {
    setDecision((current) => current ? {
      ...current,
      reason,
      idempotencyKey: operationKey(current.action),
    } : current);
  }

  function replaceDestination(workerId, rawDestination) {
    const destination = projectPaymentDestination(rawDestination);
    if (!destination) throw new Error('El servidor devolvió una decisión fuera del contrato seguro.');
    setWorkerStates((current) => ({
      ...current,
      [workerId]: {
        items: (current[workerId]?.items || []).map((item) => (
          item.id === destination.id ? destination : item
        )),
        status: 'loaded',
        error: null,
      },
    }));
    return destination;
  }

  async function submitDecision() {
    if (!decision || decision.pending) return;
    const requiresReason = decision.action === 'REJECT' || decision.action === 'REVOKE';
    const reasonLength = decision.reason.trim().length;
    if (requiresReason && (reasonLength < 1 || reasonLength > MAX_REASON_LENGTH)) {
      setNotice({ type: 'error', text: 'Ingresá un motivo de entre 1 y 500 caracteres.' });
      return;
    }
    setDecision((current) => current ? { ...current, pending: true } : current);
    setNotice(null);
    try {
      const response = await fetch(
        decisionEndpoint(decision.workerId, decision.destination.id, decision.action),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': decision.idempotencyKey,
          },
          body: JSON.stringify(decisionBody(decision)),
        },
      );
      const payload = await readResponse(response, 'No se pudo registrar la decisión.');
      const updated = replaceDestination(decision.workerId, payload.paymentDestination);
      setDecision(null);
      const synchronized = await loadDestinations(decision.workerId, { silent: true });
      setNotice({
        type: synchronized ? 'success' : 'warning',
        text: synchronized
          ? `${STATUS_LABELS[updated.status]}. La decisión quedó registrada y la lista fue reconciliada.`
          : `${STATUS_LABELS[updated.status]}. La decisión quedó registrada, pero no se pudo reconciliar toda la lista.`,
      });
    } catch (error) {
      const stale = error.code === 'WORKER_PAYMENT_REVISION_STALE';
      if (stale) {
        setDecision(null);
        await loadDestinations(decision.workerId, { silent: true });
        setNotice({
          type: 'warning',
          text: 'El destino cambió durante la revisión. Actualizamos la lista; revisalo antes de decidir.',
        });
      } else {
        setDecision((current) => current ? { ...current, pending: false } : current);
        setNotice({ type: 'error', text: error.message });
      }
    }
  }

  return (
    <section className={styles.paymentPanel} aria-labelledby="payment-destinations-title">
      <div className={styles.paymentPanelHeader}>
        <div>
          <p className={styles.eyebrow}>Gobierno de cobros</p>
          <h2 id="payment-destinations-title">Destinos de cobro de la cuadrilla</h2>
          <p>
            Consulta referencias enmascaradas y decisiones auditadas. Los valores bancarios y el
            CUIL nunca se muestran en este panel.
          </p>
        </div>
        <span className={styles.paymentPrivacyBadge}>Datos minimizados</span>
      </div>

      <div className={styles.paymentProviderNotice} role="note">
        <strong>Verificación externa pendiente</strong>
        <span>
          No se ofrece “Verificar” hasta conectar un proveedor confiable de titularidad. Rechazo,
          activación y revocación conservan permisos y actores separados en el servidor.
        </span>
      </div>

      {workers.length === 0 ? (
        <div className={styles.paymentEmpty}>
          <strong>No hay operarios disponibles</strong>
          <p>Primero vinculá una persona de la cuadrilla al proyecto activo.</p>
        </div>
      ) : (
        <label className={styles.paymentWorkerPicker}>
          <span>Operario</span>
          <select
            value={selectedWorkerId}
            onChange={(event) => selectWorker(event.target.value)}
          >
            <option value="">Seleccioná para cargar sus destinos</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name} · {worker.role}{worker.active ? '' : ' · inactivo'}
              </option>
            ))}
          </select>
        </label>
      )}

      {notice && (
        <div
          className={styles.paymentNotice}
          data-tone={notice.type}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
        </div>
      )}

      {selectedWorker && (
        <div className={styles.paymentWorkerContent}>
          <div className={styles.paymentWorkerHeading}>
            <div>
              <strong>{selectedWorker.name}</strong>
              <span>{selectedWorker.role}</span>
            </div>
            <button
              disabled={selectedState?.status === 'loading'}
              type="button"
              onClick={() => void loadDestinations(selectedWorker.id)}
            >
              {selectedState?.status === 'loading' ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>

          {selectedState?.status === 'loading' && selectedState.items.length === 0 && (
            <p className={styles.paymentLoading} role="status">Cargando destinos enmascarados…</p>
          )}

          {selectedState?.status === 'error' && (
            <div className={styles.paymentLoadError} role="alert">
              <span>{selectedState.error}</span>
              <button type="button" onClick={() => void loadDestinations(selectedWorker.id)}>
                Reintentar
              </button>
            </div>
          )}

          {selectedState?.status === 'loaded' && selectedState.items.length === 0 && (
            <div className={styles.paymentEmpty}>
              <strong>Sin destinos informados</strong>
              <p>El alta bancaria no se realiza desde administración ni expone datos sensibles.</p>
            </div>
          )}

          {Boolean(selectedState?.items.length) && (
            <div className={styles.paymentDestinationList}>
              {selectedState.items.map((destination) => (
                <article
                  className={styles.paymentDestinationCard}
                  data-status={destination.status}
                  key={destination.id}
                >
                  <div className={styles.paymentDestinationHeader}>
                    <div>
                      <strong>{destination.maskedValue}</strong>
                      <span>{PURPOSE_LABELS[destination.purpose]} · ARS</span>
                    </div>
                    <span className={styles.paymentStatus} data-status={destination.status}>
                      {STATUS_LABELS[destination.status]}
                    </span>
                  </div>

                  <dl className={styles.paymentFacts}>
                    <div><dt>Versión</dt><dd>{destination.version}</dd></div>
                    <div><dt>Revisión</dt><dd>{destination.revision}</dd></div>
                    <div><dt>Creado</dt><dd>{formatDate(destination.createdAt)}</dd></div>
                    <div><dt>Actualizado</dt><dd>{formatDate(destination.updatedAt)}</dd></div>
                    <div><dt>Verificado</dt><dd>{formatDate(destination.verifiedAt)}</dd></div>
                    <div><dt>Disponible desde</dt><dd>{formatDate(destination.availableFrom)}</dd></div>
                    <div>
                      <dt>Privacidad</dt>
                      <dd>
                        {destination.privacyStatus === 'ATTESTED'
                          ? 'Aviso atestado'
                          : 'Reatestación requerida'}
                      </dd>
                    </div>
                  </dl>

                  {destination.privacyStatus === 'REATTESTATION_REQUIRED' && (
                    <p className={styles.paymentReattestationNotice}>
                      {destination.status === 'ACTIVE'
                        ? 'Registro legado bloqueado para pagos. El operario debe ratificarlo desde su WhatsApp verificado.'
                        : ['PENDING_VERIFICATION', 'VERIFIED'].includes(destination.status)
                          ? 'Registro legado bloqueado. Volvé a capturar exactamente el mismo destino con el aviso vigente para ratificarlo.'
                          : 'Este registro legado está cerrado y no puede reabrirse. Registrá otro destino mediante una captura protegida.'}
                    </p>
                  )}

                  <div className={styles.paymentActions}>
                    {selectedWorker.active
                      && canManage
                      && destination.status === 'PENDING_VERIFICATION' && (
                      <button
                        className={styles.paymentDangerButton}
                        type="button"
                        onClick={() => openDecision(selectedWorker, destination, 'REJECT')}
                      >
                        Rechazar
                      </button>
                    )}
                    {selectedWorker.active
                      && canActivate
                      && destination.privacyStatus === 'ATTESTED'
                      && destination.status === 'VERIFIED' && (
                      <button
                        className={styles.paymentPrimaryButton}
                        type="button"
                        onClick={() => openDecision(selectedWorker, destination, 'ACTIVATE')}
                      >
                        Activar
                      </button>
                    )}
                    {selectedWorker.active
                      && canManage
                      && ['VERIFIED', 'ACTIVE'].includes(destination.status) && (
                      <button
                        className={styles.paymentDangerButton}
                        type="button"
                        onClick={() => openDecision(selectedWorker, destination, 'REVOKE')}
                      >
                        Revocar
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {decision && (
        <div className={styles.paymentDecisionPanel} role="region" aria-labelledby="payment-decision-title">
          <div>
            <p className={styles.eyebrow}>Decisión controlada</p>
            <h3 id="payment-decision-title">{ACTION_LABELS[decision.action]}</h3>
            <p>
              {decision.destination.maskedValue} · revisión {decision.destination.revision}. El
              servidor validará alcance, revisión vigente y separación de funciones.
            </p>
          </div>
          {(decision.action === 'REJECT' || decision.action === 'REVOKE') && (
            <label className={styles.paymentReasonField}>
              <span>{reasonPrompt(decision.action)}</span>
              <textarea
                disabled={decision.pending}
                maxLength={MAX_REASON_LENGTH}
                required
                value={decision.reason}
                onChange={(event) => updateReason(event.target.value)}
              />
              <small>{decision.reason.trim().length}/{MAX_REASON_LENGTH}</small>
            </label>
          )}
          <div className={styles.paymentDecisionActions}>
            <button
              disabled={decision.pending}
              type="button"
              onClick={() => setDecision(null)}
            >
              Cancelar
            </button>
            <button
              className={decision.action === 'ACTIVATE'
                ? styles.paymentPrimaryButton
                : styles.paymentDangerButton}
              disabled={decision.pending || (
                decision.action !== 'ACTIVATE'
                && (decision.reason.trim().length < 1
                  || decision.reason.trim().length > MAX_REASON_LENGTH)
              )}
              type="button"
              onClick={() => void submitDecision()}
            >
              {decision.pending ? 'Registrando…' : ACTION_LABELS[decision.action]}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
