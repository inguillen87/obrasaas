'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import styles from './contracts.module.css';
import {
  CONTRACT_DECISIONS,
  CONTRACT_UNIT_OPTIONS,
  buildProjectContractVersionPayload,
  createProjectContractAttempt,
  createProjectContractDraft,
  formatMinorUnits,
  projectContractApiErrorMessage,
  projectContractMutationIsAmbiguous,
  projectContractMutationReceiptIsUsable,
  projectContractSnapshotConfirmsAttempt,
  projectContractSnapshotIsUsable,
  uncertainProjectContractAttempt,
  updateProjectContractLine,
} from './project-contract-state';

const READINESS_PRESENTATION = Object.freeze({
  AUTHORITY_REQUIRED: ['Autoridades requeridas', 'Definí la cadena independiente antes de preparar la SOV.', 'pending'],
  AUTHORITY_REVIEW_PENDING: ['Autoridades en revisión', 'La propuesta espera una decisión maker-checker.', 'pending'],
  CONTRACT_REQUIRED: ['SOV requerida', 'Las autoridades están vigentes; falta preparar la base contractual.', 'pending'],
  CONTRACT_REVIEW_PENDING: ['SOV en revisión', 'La versión completa espera decisión financiera.', 'pending'],
  ACTIVE: ['Contrato vigente', 'La SOV aprobada puede ser un input independiente de S10.', 'ready'],
});

const TECHNICAL_PRESENTATION = Object.freeze({
  MATCHED: ['Coincide con S9.1', 'matched'],
  UNESTABLISHED: ['Base técnica aún no establecida', 'pending'],
  MISMATCHED: ['Diferencia técnica; bloquea S10', 'blocked'],
  NOT_APPLICABLE: ['No aplica', 'pending'],
});
const EMPTY_CANONICAL_TASKS = Object.freeze([]);

function newOperationKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  }
  throw new Error('El navegador no ofrece aleatoriedad segura para iniciar la operación.');
}

function shortDigest(value) {
  const digest = typeof value === 'string' ? value : '';
  return digest.length === 64 ? `${digest.slice(0, 12)}…${digest.slice(-8)}` : 'No disponible';
}

function exactTimestamp(value) {
  if (typeof value !== 'string') return 'Fecha no disponible';
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]} ${match[2]} UTC` : value;
}

function exactCivilDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : 'Fecha no disponible';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    cache: 'no-store',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(projectContractApiErrorMessage(
      payload,
      'No se pudo completar la operación contractual.',
    ));
    error.status = response.status;
    error.code = payload?.code || null;
    throw error;
  }
  return { payload, status: response.status };
}

function memberName(members, membershipId) {
  const member = members.get(membershipId);
  return member ? `${member.label} · ${member.tenantRole}` : 'Membresía no disponible';
}

function decisionLabel(decision) {
  if (!decision) return 'Pendiente';
  return decision.decision === 'APPROVED' ? 'Aprobada' : 'Rechazada';
}

function TechnicalPill({ value }) {
  const presentationKey = value === null ? 'NOT_APPLICABLE' : value;
  const [label, tone] = TECHNICAL_PRESENTATION[presentationKey]
    || [value || 'No informado', 'pending'];
  return <span className={styles.technicalPill} data-tone={tone}>{label}</span>;
}

function DecisionPill({ decision }) {
  return (
    <span className={styles.decisionPill} data-decision={decision?.decision || 'PENDING'}>
      {decisionLabel(decision)}
    </span>
  );
}

function AuthorityDetails({ authority, memberDirectory, title }) {
  if (!authority) return <p className={styles.emptyState}>Todavía no existe.</p>;
  return (
    <section aria-label={title}>
      <div className={styles.historyHeader}>
        <div>
          <strong>{title} · v{authority.version}</strong>
          <small>{exactTimestamp(authority.preparedAt)}</small>
        </div>
        <DecisionPill decision={authority.decision} />
      </div>
      <dl className={styles.detailList}>
        <dt>Certificador</dt>
        <dd>{memberName(memberDirectory, authority.authorities.certifierMembershipId)}</dd>
        <dt>Conformador financiero</dt>
        <dd>{memberName(memberDirectory, authority.authorities.financeMembershipId)}</dd>
        <dt>Registrador externo</dt>
        <dd>{memberName(memberDirectory, authority.authorities.registrarMembershipId)}</dd>
        <dt>Preparó</dt>
        <dd>{memberName(memberDirectory, authority.preparedByMembershipId)}</dd>
        <dt>Integridad</dt>
        <dd className={styles.digest} title={authority.integrityDigest}>
          {shortDigest(authority.integrityDigest)}
        </dd>
      </dl>
      {authority.decision ? (
        <p className={styles.scopeNote}>
          Decidió {memberName(memberDirectory, authority.decision.decidedByMembershipId)}:
          {' '}{authority.decision.reason}
        </p>
      ) : null}
    </section>
  );
}

function ContractLineTable({ contract }) {
  return (
    <div className={styles.tableScroller}>
      <table className={styles.table}>
        <caption>
          Snapshot completo: {contract.lineCount} tareas, sin omitir las líneas NO_CLAIM.
        </caption>
        <thead>
          <tr>
            <th scope="col">Tarea canónica</th>
            <th scope="col">Estado</th>
            <th scope="col">Base contractual</th>
            <th scope="col">Importe facial</th>
            <th scope="col">Cruce técnico</th>
          </tr>
        </thead>
        <tbody>
          {contract.lines.map((line) => (
            <tr key={line.id || `${contract.id}:${line.taskId}`}>
              <th scope="row">
                {line.taskCode ? `${line.taskCode} · ` : ''}{line.taskTitle}
                <small className={styles.muted}> r{line.taskRevision}</small>
              </th>
              <td><span className={styles.lineState}>{line.state}</span></td>
              <td>
                {line.state === 'VALUED'
                  ? `${line.baseQuantity} ${line.unitCode}`
                  : line.noClaimReason}
              </td>
              <td>
                {line.state === 'VALUED'
                  ? formatMinorUnits(
                      line.contractAmountMinor,
                      contract.currencyCode,
                      contract.currencyMinorUnits,
                    )
                  : 'No aplica; no equivale a cero.'}
              </td>
              <td>
                <span className={styles.hint}>Al preparar</span>
                <TechnicalPill value={line.technicalBasisStatusAtPrepare} />
                <span className={styles.hint}>Ahora</span>
                <TechnicalPill value={line.currentTechnicalCompatibility} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContractDetails({ contract, memberDirectory, title, showLines = true }) {
  if (!contract) return <p className={styles.emptyState}>Todavía no existe.</p>;
  return (
    <section aria-label={title}>
      <div className={styles.historyHeader}>
        <div>
          <strong>{title} · v{contract.version}</strong>
          <small>{contract.contractReference} · vigencia {exactCivilDate(contract.effectiveFrom)}</small>
        </div>
        <DecisionPill decision={contract.decision} />
      </div>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span>Total facial</span>
          <strong>{formatMinorUnits(
            contract.totalContractAmountMinor,
            contract.currencyCode,
            contract.currencyMinorUnits,
          )}</strong>
        </div>
        <div className={styles.metric}>
          <span>Tareas valuadas</span>
          <strong>{contract.valuedLineCount}</strong>
        </div>
        <div className={styles.metric}>
          <span>Sin reclamo</span>
          <strong>{contract.noClaimLineCount}</strong>
        </div>
        <div className={styles.metric}>
          <span>Retención contractual</span>
          <strong>{contract.retentionBps} bps</strong>
        </div>
      </div>
      <dl className={styles.detailList}>
        <dt>Título</dt>
        <dd>{contract.title}</dd>
        <dt>Contraparte</dt>
        <dd>{contract.counterpartyLabel}</dd>
        <dt>Preparó</dt>
        <dd>{memberName(memberDirectory, contract.preparedByMembershipId)}</dd>
        <dt>Política</dt>
        <dd>{contract.roundingPolicyVersion} · ajustes {contract.adjustmentPolicyVersion}</dd>
        <dt>Integridad</dt>
        <dd className={styles.digest} title={contract.integrityDigest}>
          {shortDigest(contract.integrityDigest)}
        </dd>
      </dl>
      <div className={styles.noticeRow}>
        <TechnicalPill value={contract.currentTechnicalCompatibility} />
        {contract.s10BlockerCode ? <span className={styles.muted}>{contract.s10BlockerCode}</span> : null}
      </div>
      {contract.decision ? (
        <p className={styles.scopeNote}>
          Decidió {memberName(memberDirectory, contract.decision.decidedByMembershipId)}:
          {' '}{contract.decision.reason}
        </p>
      ) : null}
      {showLines ? <ContractLineTable contract={contract} /> : null}
    </section>
  );
}

function AuthorityProposalForm({ candidates, currentAuthority, disabled, onSubmit }) {
  const [selection, setSelection] = useState(() => ({
    certifierMembershipId: currentAuthority?.authorities.certifierMembershipId || '',
    financeMembershipId: currentAuthority?.authorities.financeMembershipId || '',
    registrarMembershipId: currentAuthority?.authorities.registrarMembershipId || '',
  }));
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();
    const ids = Object.values(selection);
    if (ids.some((id) => !id) || new Set(ids).size !== 3) {
      setError('Las tres autoridades deben estar completas y ser membresías distintas.');
      return;
    }
    setError('');
    onSubmit(selection);
  }

  const fields = [
    ['certifierMembershipId', 'Certificador contractual', candidates.certifiers],
    ['financeMembershipId', 'Conformador financiero', candidates.finances],
    ['registrarMembershipId', 'Registrador de referencia externa', candidates.registrars],
  ];
  return (
    <form onSubmit={submit}>
      <div className={styles.authorityGrid}>
        {fields.map(([name, label, options]) => (
          <label className={styles.field} key={name}>
            <span>{label}</span>
            <select
              disabled={disabled}
              onChange={(event) => setSelection((current) => ({
                ...current,
                [name]: event.target.value,
              }))}
              required
              value={selection[name]}
            >
              <option value="">Seleccionar membresía</option>
              {options.map((member) => (
                <option key={member.id} value={member.id}>{member.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {error ? <p className={styles.fieldError} role="alert">{error}</p> : null}
      <div className={styles.actions}>
        <button className={styles.button} disabled={disabled} type="submit">
          Proponer autoridades
        </button>
      </div>
    </form>
  );
}

function DecisionForm({ disabled, label, onSubmit }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function decide(decision) {
    const normalized = reason.trim();
    if (!normalized || normalized.length > 1_000) {
      setError('Registrá un fundamento de hasta 1000 caracteres.');
      return;
    }
    setError('');
    onSubmit({ decision, reason: normalized });
  }

  return (
    <div>
      <label className={styles.field}>
        <span>Fundamento de la decisión</span>
        <textarea
          disabled={disabled}
          maxLength={1_000}
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </label>
      {error ? <p className={styles.fieldError} role="alert">{error}</p> : null}
      <div className={styles.actions}>
        {CONTRACT_DECISIONS.map((decision) => (
          <button
            className={decision === 'APPROVED' ? styles.button : styles.secondaryButton}
            disabled={disabled}
            key={decision}
            onClick={() => decide(decision)}
            type="button"
          >
            {decision === 'APPROVED' ? `Aprobar ${label}` : `Rechazar ${label}`}
          </button>
        ))}
      </div>
    </div>
  );
}

function ContractDraftForm({ disabled, onSubmit, snapshot, tasks, tenantToday }) {
  const [draft, setDraft] = useState(() => createProjectContractDraft(tasks, tenantToday));
  const [validation, setValidation] = useState({ errors: [], fieldErrors: {} });

  function updateField(name, value) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function updateLine(taskId, patch) {
    setDraft((current) => ({
      ...current,
      lines: updateProjectContractLine(current.lines, taskId, patch),
    }));
  }

  function submit(event) {
    event.preventDefault();
    const result = buildProjectContractVersionPayload({ draft, snapshot, tasks });
    if (!result.ok) {
      setValidation(result);
      return;
    }
    setValidation({ errors: [], fieldErrors: {} });
    onSubmit(result.payload);
  }

  const textFields = [
    ['contractReference', 'Referencia contractual', 120],
    ['title', 'Título de la versión', 240],
    ['counterpartyLabel', 'Contraparte', 240],
  ];
  return (
    <form onSubmit={submit}>
      <div className={styles.formGrid}>
        {textFields.map(([name, label, maxLength]) => (
          <label className={styles.field} key={name}>
            <span>{label}</span>
            <input
              aria-invalid={Boolean(validation.fieldErrors[name])}
              disabled={disabled}
              maxLength={maxLength}
              onChange={(event) => updateField(name, event.target.value)}
              required
              value={draft[name]}
            />
            {validation.fieldErrors[name]
              ? <small className={styles.fieldError}>{validation.fieldErrors[name]}</small>
              : null}
          </label>
        ))}
        <label className={styles.field}>
          <span>Vigencia civil</span>
          <input
            aria-invalid={Boolean(validation.fieldErrors.effectiveFrom)}
            disabled={disabled}
            onChange={(event) => updateField('effectiveFrom', event.target.value)}
            required
            type="date"
            value={draft.effectiveFrom}
          />
        </label>
        <label className={styles.field}>
          <span>Moneda contractual</span>
          <select
            disabled={disabled}
            onChange={(event) => updateField('currencyCode', event.target.value)}
            value={draft.currencyCode}
          >
            <option value="ARS">ARS · peso argentino</option>
            <option value="USD">USD · dólar estadounidense</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Retención (basis points)</span>
          <input
            aria-invalid={Boolean(validation.fieldErrors.retentionBps)}
            disabled={disabled}
            inputMode="numeric"
            max="10000"
            min="0"
            onChange={(event) => updateField('retentionBps', event.target.value)}
            pattern="\d+"
            required
            type="text"
            value={draft.retentionBps}
          />
        </label>
      </div>

      <div className={styles.sectionHeader}>
        <div>
          <h3>Schedule of Values completa</h3>
          <p className={styles.muted}>
            Clasificá cada tarea. NO_CLAIM exige fundamento y nunca equivale a monto cero.
          </p>
        </div>
        <span className={styles.statusPill} data-tone="pending">{tasks.length} tareas</span>
      </div>

      <ul className={styles.lineList}>
        {tasks.map((task, index) => {
          const line = draft.lines[index];
          const lineError = validation.fieldErrors[`line:${task.id}`];
          return (
            <li className={styles.lineCard} key={task.id}>
              <div className={styles.lineHeader}>
                <div>
                  <strong>{task.code ? `${task.code} · ` : ''}{task.title}</strong>
                  <small>
                    Tarea canónica r{task.revision} · base técnica S9.1:{' '}
                    {task.technicalBasis.status === 'ESTABLISHED'
                      ? `${task.technicalBasis.baseQuantity} ${task.technicalBasis.unitCode}`
                      : 'aún no establecida'}
                  </small>
                </div>
                <span className={styles.lineState}>{line.state === 'UNSET' ? 'Sin clasificar' : line.state}</span>
              </div>
              <div className={styles.lineEditor}>
                <label className={styles.lineField}>
                  <span>Tratamiento contractual</span>
                  <select
                    aria-invalid={Boolean(lineError)}
                    disabled={disabled}
                    onChange={(event) => updateLine(task.id, { state: event.target.value })}
                    value={line.state}
                  >
                    <option value="UNSET">Elegir…</option>
                    <option value="VALUED">VALUED · valuada</option>
                    <option value="NO_CLAIM">NO_CLAIM · sin reclamo</option>
                  </select>
                </label>
                {line.state === 'VALUED' ? (
                  <>
                    <label className={styles.lineField}>
                      <span>Unidad</span>
                      <select
                        disabled={disabled}
                        onChange={(event) => updateLine(task.id, { unitCode: event.target.value })}
                        value={line.unitCode}
                      >
                        <option value="">Elegir…</option>
                        {CONTRACT_UNIT_OPTIONS.map(([code, label]) => (
                          <option key={code} value={code}>{label} ({code})</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.lineField}>
                      <span>Cantidad base (hasta 4 decimales)</span>
                      <input
                        disabled={disabled}
                        inputMode="decimal"
                        onChange={(event) => updateLine(task.id, { baseQuantity: event.target.value })}
                        placeholder="0,0000"
                        type="text"
                        value={line.baseQuantity}
                      />
                    </label>
                    <label className={styles.lineField}>
                      <span>Importe en minor units (entero)</span>
                      <input
                        disabled={disabled}
                        inputMode="numeric"
                        onChange={(event) => updateLine(task.id, { contractAmountMinor: event.target.value })}
                        pattern="[0-9]+"
                        placeholder="Ej.: 125000 para 1.250,00"
                        type="text"
                        value={line.contractAmountMinor}
                      />
                    </label>
                  </>
                ) : line.state === 'NO_CLAIM' ? (
                  <label className={`${styles.lineField} ${styles.fieldWide}`}>
                    <span>Fundamento explícito</span>
                    <textarea
                      disabled={disabled}
                      maxLength={1_000}
                      onChange={(event) => updateLine(task.id, { noClaimReason: event.target.value })}
                      value={line.noClaimReason}
                    />
                  </label>
                ) : null}
              </div>
              {lineError ? <small className={styles.fieldError} role="alert">{lineError}</small> : null}
            </li>
          );
        })}
      </ul>
      {validation.errors.length > 0 ? (
        <ul className={styles.errorList} role="alert">
          {validation.errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      ) : null}
      <div className={styles.actions}>
        <button className={styles.button} disabled={disabled} type="submit">
          Preparar versión contractual completa
        </button>
      </div>
    </form>
  );
}

function uniqueHistory(...groups) {
  const byId = new Map();
  for (const group of groups) {
    for (const record of Array.isArray(group) ? group : [group]) {
      if (record?.id && !byId.has(record.id)) byId.set(record.id, record);
    }
  }
  return [...byId.values()].sort((left, right) => right.version - left.version);
}

export default function ContractsClient({
  authorityCandidates,
  initialSnapshot,
  organizationName,
  projectName,
  scope,
  tenantToday,
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loadState, setLoadState] = useState('ready');
  const [mutationBusy, setMutationBusy] = useState(false);
  const [attempt, setAttempt] = useState(null);
  const [notice, setNotice] = useState(null);
  const attemptRef = useRef(null);
  const getControllerRef = useRef(null);
  const getSequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const memberDirectory = useMemo(() => new Map(
    [...authorityCandidates.certifiers, ...authorityCandidates.finances, ...authorityCandidates.registrars]
      .map((member) => [member.id, member]),
  ), [authorityCandidates]);
  const canonicalTasks = Array.isArray(snapshot?.canonicalTasks)
    ? snapshot.canonicalTasks
    : EMPTY_CANONICAL_TASKS;
  const tasks = useMemo(() => canonicalTasks.map((task) => ({
    id: task.taskId,
    code: task.taskCode,
    title: task.taskTitle,
    revision: task.taskRevision,
    technicalBasis: task.technicalBasis,
  })), [canonicalTasks]);
  const taskCatalogKey = useMemo(
    () => tasks.map((task) => `${task.id}:${task.revision}`).join('|'),
    [tasks],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      getSequenceRef.current += 1;
      getControllerRef.current?.abort();
    };
  }, []);

  const loadSnapshot = useCallback(async ({ reconcile = false } = {}) => {
    const sequence = getSequenceRef.current + 1;
    getSequenceRef.current = sequence;
    getControllerRef.current?.abort();
    const controller = new AbortController();
    getControllerRef.current = controller;
    setLoadState('loading');
    try {
      const { payload } = await api('/api/project-contract', { signal: controller.signal });
      if (!projectContractSnapshotIsUsable(payload, scope)) {
        throw new Error('El servidor devolvió un snapshot contractual incompleto.');
      }
      if (
        !mountedRef.current
        || getSequenceRef.current !== sequence
        || getControllerRef.current !== controller
      ) return null;
      setSnapshot(payload);
      setLoadState('ready');
      const currentAttempt = attemptRef.current;
      if (currentAttempt?.state === 'CONFIRMED') {
        attemptRef.current = null;
        setAttempt(null);
        setNotice({ tone: 'success', message: 'Operación confirmada y snapshot autoritativo actualizado.' });
      } else if (reconcile && currentAttempt?.state === 'UNCERTAIN') {
        if (projectContractSnapshotConfirmsAttempt(payload, currentAttempt)) {
          attemptRef.current = null;
          setAttempt(null);
          setNotice({ tone: 'success', message: 'El GET autoritativo confirmó el resultado; no hubo un segundo POST.' });
        } else {
          setNotice({
            tone: 'warning',
            message: 'El GET no confirma todavía el intento. La clave permanece retenida y las mutaciones siguen bloqueadas.',
          });
        }
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') return null;
      if (!mountedRef.current || getSequenceRef.current !== sequence) return null;
      setLoadState('error');
      setNotice({ tone: 'error', message: error.message || 'No se pudo actualizar el snapshot.' });
      return null;
    } finally {
      if (getControllerRef.current === controller) getControllerRef.current = null;
    }
  }, [scope]);

  const performMutation = useCallback(async ({ kind, path, resourceId = null, body }) => {
    if (attemptRef.current || mutationBusy) return;
    let operationKey;
    try {
      operationKey = newOperationKey();
    } catch (error) {
      setNotice({ tone: 'error', message: error.message });
      return;
    }
    const history = kind === 'AUTHORITY_PROPOSAL'
      ? uniqueHistory(snapshot?.authorityHistory, snapshot?.currentAuthority, snapshot?.pendingAuthority)
      : kind === 'CONTRACT_PROPOSAL'
        ? uniqueHistory(snapshot?.contractHistory, snapshot?.currentContract, snapshot?.pendingContract)
        : [];
    const nextAttempt = createProjectContractAttempt({
      kind,
      operationKey,
      path,
      resourceId,
      body,
      knownResourceIds: history.map((record) => record.id),
    });
    attemptRef.current = nextAttempt;
    setAttempt(nextAttempt);
    setMutationBusy(true);
    setNotice({ tone: 'neutral', message: 'Registrando una única operación idempotente…' });
    try {
      const { payload, status } = await api(path, {
        method: 'POST',
        headers: { 'Idempotency-Key': operationKey },
        body: JSON.stringify(body),
      });
      const statusMatchesReceipt = (status === 201 && payload?.replayed === false)
        || (status === 200 && payload?.replayed === true);
      if (!projectContractMutationReceiptIsUsable(payload, kind) || !statusMatchesReceipt) {
        const error = new Error('La respuesta 2xx no confirma el recibo contractual esperado.');
        error.status = null;
        error.malformedSuccess = true;
        throw error;
      }
      if (!mountedRef.current) return;
      const confirmed = Object.freeze({ ...nextAttempt, state: 'CONFIRMED' });
      attemptRef.current = confirmed;
      setAttempt(confirmed);
      setNotice({ tone: 'neutral', message: 'Recibo válido; conciliando el snapshot por GET…' });
      await loadSnapshot();
    } catch (error) {
      if (!mountedRef.current) return;
      if (projectContractMutationIsAmbiguous(error)) {
        const uncertain = uncertainProjectContractAttempt(nextAttempt);
        attemptRef.current = uncertain;
        setAttempt(uncertain);
        setNotice({
          tone: 'warning',
          message: 'Resultado incierto: no se reenvía el POST. Conservamos la misma Idempotency-Key y sólo conciliamos por GET.',
        });
      } else {
        attemptRef.current = null;
        setAttempt(null);
        setNotice({ tone: 'error', message: error.message || 'La operación fue rechazada.' });
        if (error?.status === 409) await loadSnapshot();
      }
    } finally {
      if (mountedRef.current) setMutationBusy(false);
    }
  }, [loadSnapshot, mutationBusy, snapshot]);

  const capabilities = snapshot?.capabilities || {};
  const mutationsLocked = mutationBusy || Boolean(attempt);
  const canProposeAuthority = !snapshot?.pendingAuthority
    && capabilities.proposeAuthority?.allowed === true;
  const canDecideAuthority = capabilities.decideAuthority?.allowed === true
    && capabilities.decideAuthority.targetId === snapshot.pendingAuthority?.id;
  const canPrepareContract = capabilities.prepareContract?.allowed === true
    && !snapshot.pendingContract;
  const canDecideContract = capabilities.decideContract?.allowed === true
    && capabilities.decideContract.targetId === snapshot.pendingContract?.id;
  const authorityHistory = uniqueHistory(
    snapshot?.authorityHistory,
    snapshot?.pendingAuthority,
    snapshot?.currentAuthority,
  );
  const contractHistory = uniqueHistory(
    snapshot?.contractHistory,
    snapshot?.pendingContract,
    snapshot?.currentContract,
  );
  const [readinessLabel, readinessDescription, readinessTone] = READINESS_PRESENTATION[snapshot?.readiness]
    || ['Estado no reconocido', 'Actualizá antes de operar.', 'pending'];

  function proposeAuthority(selection) {
    performMutation({
      kind: 'AUTHORITY_PROPOSAL',
      path: '/api/project-contract/authorities',
      body: {
        expectedCurrentAuthorityVersionId: snapshot.currentAuthority?.id || null,
        expectedHeadRevision: snapshot.authorityRevision,
        ...selection,
      },
    });
  }

  function decideAuthority(input) {
    const authority = snapshot.pendingAuthority;
    performMutation({
      kind: 'AUTHORITY_DECISION',
      path: `/api/project-contract/authorities/${encodeURIComponent(authority.id)}/decision`,
      resourceId: authority.id,
      body: {
        expectedHeadRevision: snapshot.authorityRevision,
        expectedAuthorityDigest: authority.integrityDigest,
        ...input,
      },
    });
  }

  function proposeContract(body) {
    performMutation({
      kind: 'CONTRACT_PROPOSAL',
      path: '/api/project-contract/versions',
      body,
    });
  }

  function decideContract(input) {
    const contract = snapshot.pendingContract;
    performMutation({
      kind: 'CONTRACT_DECISION',
      path: `/api/project-contract/versions/${encodeURIComponent(contract.id)}/decision`,
      resourceId: contract.id,
      body: {
        expectedHeadRevision: snapshot.headRevision,
        expectedContractDigest: contract.integrityDigest,
        ...input,
      },
    });
  }

  if (!projectContractSnapshotIsUsable(snapshot, scope)) {
    return (
      <div className={styles.page}>
        <section className={styles.notice} data-tone="error" role="alert">
          El snapshot inicial no cumple el contrato privado de S9.3. No se habilitó ninguna acción.
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>S9.3 · Autoridad contractual</p>
          <h1>Contrato y Schedule of Values</h1>
          <p className={styles.heroCopy}>
            {organizationName} · {projectName}. Una fuente contractual versionada, separada del
            presupuesto interno, de la medición técnica y de cuentas por pagar.
          </p>
        </div>
        <div className={styles.heroBadge}>
          <span>Estado autoritativo</span>
          <strong>{readinessLabel}</strong>
          <small>{readinessDescription}</small>
        </div>
      </header>

      <p className={styles.scopeNote}>
        Esta superficie administra autoridades y la SOV completa. No emite certificados,
        conformidad financiera, PDF ni ejecuta o confirma pagos. Toda respuesta declara
        <code> executionAllowed: false</code>.
      </p>

      {notice ? (
        <div aria-live="polite" className={styles.notice} data-tone={notice.tone} role="status">
          {notice.message}
        </div>
      ) : null}
      {attempt && !mutationBusy ? (
        <section className={styles.notice} data-tone="warning" aria-labelledby="uncertain-heading">
          <strong id="uncertain-heading">
            {attempt.state === 'UNCERTAIN' ? 'Intento incierto bloqueado' : 'Recibo pendiente de conciliación'}
          </strong>
          <p>
            Clave retenida <span className={styles.digest}>{attempt.operationKey}</span>. No hay
            reintento automático ni botón de reenvío.
          </p>
          <button
            className={styles.secondaryButton}
            disabled={loadState === 'loading'}
            onClick={() => loadSnapshot({ reconcile: true })}
            type="button"
          >
            Conciliar por GET autoritativo
          </button>
        </section>
      ) : null}

      <section className={styles.statusGrid} aria-label="Estado contractual">
        <article className={styles.statusCard}>
          <span className={styles.statusPill} data-tone={readinessTone}>{readinessLabel}</span>
          <h2>Head contractual</h2>
          <p>Autoridades r{snapshot.authorityRevision} · contrato r{snapshot.headRevision}</p>
        </article>
        <article className={styles.statusCard}>
          <span className={styles.statusPill} data-tone={snapshot.currentAuthority ? 'ready' : 'pending'}>
            {snapshot.currentAuthority ? `Autoridad v${snapshot.currentAuthority.version}` : 'Sin autoridad vigente'}
          </span>
          <h2>Segregación</h2>
          <p>Tres membresías activas y distintas; maker-checker en cada ledger.</p>
        </article>
        <article className={styles.statusCard}>
          <span className={styles.statusPill} data-tone={snapshot.s10BlockerCode ? 'pending' : 'ready'}>
            {snapshot.s10BlockerCode || 'Base contractual elegible'}
          </span>
          <h2>Entrada futura a S10</h2>
          <p><TechnicalPill value={snapshot.currentTechnicalCompatibility} /></p>
        </article>
      </section>

      <section className={styles.twoColumns}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Cadena de autoridad</p>
              <h2>Designación vigente</h2>
            </div>
          </div>
          <AuthorityDetails
            authority={snapshot.currentAuthority}
            memberDirectory={memberDirectory}
            title="Autoridad vigente"
          />
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Maker-checker</p>
              <h2>Propuesta pendiente</h2>
            </div>
          </div>
          <AuthorityDetails
            authority={snapshot.pendingAuthority}
            memberDirectory={memberDirectory}
            title="Autoridad candidata"
          />
          {snapshot.pendingAuthority && canDecideAuthority ? (
            <DecisionForm
              disabled={mutationsLocked}
              label="autoridad"
              onSubmit={decideAuthority}
            />
          ) : null}
        </article>
      </section>

      {canProposeAuthority ? (
        <section className={styles.panel} aria-labelledby="authority-form-heading">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Nueva versión de autoridad</p>
              <h2 id="authority-form-heading">Designar tres responsables distintos</h2>
            </div>
          </div>
          <AuthorityProposalForm
            candidates={authorityCandidates}
            currentAuthority={snapshot.currentAuthority}
            disabled={mutationsLocked}
            onSubmit={proposeAuthority}
          />
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="current-contract-heading">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Snapshot contractual</p>
            <h2 id="current-contract-heading">SOV vigente</h2>
          </div>
          <button
            className={styles.secondaryButton}
            disabled={loadState === 'loading'}
            onClick={() => loadSnapshot()}
            type="button"
          >
            {loadState === 'loading' ? 'Actualizando…' : 'Actualizar snapshot'}
          </button>
        </div>
        <ContractDetails
          contract={snapshot.currentContract}
          memberDirectory={memberDirectory}
          title="Contrato vigente"
        />
      </section>

      {snapshot.pendingContract ? (
        <section className={styles.panel} aria-labelledby="pending-contract-heading">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Maker-checker financiero</p>
              <h2 id="pending-contract-heading">Versión contractual pendiente</h2>
            </div>
          </div>
          <ContractDetails
            contract={snapshot.pendingContract}
            memberDirectory={memberDirectory}
            title="Contrato candidato"
          />
          {canDecideContract ? (
            <DecisionForm
              disabled={mutationsLocked}
              label="contrato"
              onSubmit={decideContract}
            />
          ) : null}
        </section>
      ) : null}

      {canPrepareContract ? (
        <section className={styles.panel} aria-labelledby="contract-form-heading">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Nueva versión completa</p>
              <h2 id="contract-form-heading">Preparar Schedule of Values</h2>
              <p>El total lo deriva el servidor; el cliente nunca lo envía.</p>
            </div>
          </div>
          <ContractDraftForm
            disabled={mutationsLocked}
            key={taskCatalogKey}
            onSubmit={proposeContract}
            snapshot={snapshot}
            tasks={tasks}
            tenantToday={tenantToday}
          />
        </section>
      ) : null}

      <section className={styles.twoColumns} aria-label="Historial contractual">
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Ledger append-only</p>
              <h2>Historial de autoridades</h2>
            </div>
          </div>
          <ol className={styles.historyList}>
            {authorityHistory.map((authority) => (
              <li className={styles.historyCard} key={authority.id}>
                <AuthorityDetails
                  authority={authority}
                  memberDirectory={memberDirectory}
                  title={`Autoridad v${authority.version}`}
                />
              </li>
            ))}
          </ol>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Ledger append-only</p>
              <h2>Historial de contratos</h2>
            </div>
          </div>
          <ol className={styles.historyList}>
            {contractHistory.map((contract) => (
              <li className={styles.historyCard} key={contract.id}>
                <details>
                  <summary>
                    Contrato v{contract.version} · {contract.contractReference} · {decisionLabel(contract.decision)}
                  </summary>
                  <ContractDetails
                    contract={contract}
                    memberDirectory={memberDirectory}
                    showLines={false}
                    title={`Contrato v${contract.version}`}
                  />
                </details>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <p className={styles.hint}>
        Las acciones se muestran sólo cuando el snapshot server-owned confirma la membresía designada.
      </p>
    </div>
  );
}
