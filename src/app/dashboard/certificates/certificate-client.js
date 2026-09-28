'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CERTIFICATE_BLOCKER_LABELS, CERTIFICATE_MODE_LABELS, CERTIFICATE_READINESS_LABELS, certificateCapabilityLabel, certificateSnapshotSummary, formatCertificateMinor, majorToCertificateMinor } from '@/lib/certificate-workspace-view';
import { certificatePeriodForDate, certificateSnapshotMatches, certificateReceiptMatches, certificateFailureMessage, certificateFailureIsUncertain, sameCertificatePeriod } from '@/lib/certificate-workspace-session';
import styles from './certificates.module.css';

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, cache: 'no-store', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error('Certificate request failed');
    error.status = response.status;
    error.code = body?.code;
    throw error;
  }
  return body;
}
function CertificateMoney({ certificate, field }) {
  return certificate ? formatCertificateMinor(certificate.totals?.[field], certificate.terms?.currencyCode, certificate.terms?.currencyMinorUnits) : '—';
}
function PeriodLabel({ period }) { return <>{period?.start || '—'} → {period?.end || '—'}</>; }
const decisionLabels = { APPROVED: 'Aprobado', REJECTED: 'Rechazado', CANCELLED: 'Cancelado' };
function shortHash(value) { return typeof value === 'string' && value.length > 16 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value || '—'; }

export default function CertificateClient(props) {
  const scopeKey = `${props.scope?.organizationId}:${props.scope?.projectId}:${props.actorMembershipId}`;
  return <CertificateWorkspace {...props} key={scopeKey} />;
}

function CertificateWorkspace({ initialSnapshot, initialPeriodDate, projectName, scope = {}, actorMembershipId }) {
  const [snapshot, setSnapshot] = useState(() => certificateSnapshotMatches(initialSnapshot, scope, initialPeriodDate, actorMembershipId) ? initialSnapshot : null);
  const [periodDate, setPeriodDate] = useState(initialPeriodDate);
  const [phase, setPhase] = useState('idle');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [deductions, setDeductions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [nextPeriodDate, setNextPeriodDate] = useState(null);
  const active = useRef(null);
  const alive = useRef(true);
  const sequence = useRef(0);
  const busy = phase !== 'idle';
  const locked = busy || Boolean(attempt);
  const dirty = deductions.length > 0 || Boolean(decisionReason.trim());
  const summary = useMemo(() => certificateSnapshotSummary(snapshot), [snapshot]);
  const terms = summary.candidate?.terms || summary.pending?.terms || summary.current?.terms || null;
  const currency = terms?.currencyCode || 'ARS', minorUnits = terms?.currencyMinorUnits ?? 2;
  const pendingInPeriod = sameCertificatePeriod(summary.pending?.period, snapshot?.requestedPeriod);
  const scopeHeaders = {
    'X-ObraSaaS-Organization': scope.organizationId,
    'X-ObraSaaS-Project': scope.projectId,
    'X-ObraSaaS-Membership': actorMembershipId,
  };

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; active.current?.controller.abort(); active.current = null; };
  }, []);
  useEffect(() => {
    if (!dirty && !attempt && !busy) return;
    const guard = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, attempt, busy]);

  function begin(kind) {
    if (active.current) return null;
    const work = { id: ++sequence.current, controller: new AbortController() };
    work.timer = setTimeout(() => work.controller.abort(), 45000);
    active.current = work;
    setPhase(kind);
    setError(''); setNotice(''); setSnapshot(null);
    return work;
  }
  const current = work => alive.current && active.current === work;
  function finish(work) {
    clearTimeout(work.timer);
    if (!current(work)) return;
    active.current = null; setPhase('idle');
  }
  async function readSnapshot(date, work) {
    const data = await requestJson(`/api/project-certificates?periodDate=${encodeURIComponent(date)}`, {
      headers: scopeHeaders, signal: work.controller.signal,
    });
    if (!certificateSnapshotMatches(data, scope, date, actorMembershipId)) throw new Error('Unverified certificate snapshot');
    if (current(work)) setSnapshot(data);
    return data;
  }
  async function refresh() {
    if (!scope.organizationId || !scope.projectId || !actorMembershipId) { setError('Volvé a ingresar a la obra para verificar tu sesión.'); return; }
    if (!certificatePeriodForDate(periodDate)) { setError('Elegí una fecha válida para consultar la quincena.'); return; }
    const work = begin('reading');
    if (!work) return;
    try {
      await readSnapshot(periodDate, work);
      if (!current(work)) return;
      if (attempt?.status === 'confirmed') {
        setAttempt(null); setDeductions([]); setDecisionReason('');
        setNotice('Operación confirmada y estado del período actualizado.');
      }
    } catch (failure) {
      if (current(work)) setError(certificateFailureMessage(failure));
    } finally { finish(work); }
  }
  function selectPeriod(date) {
    if (locked) return;
    if (dirty) { setNextPeriodDate(date); return; }
    applyPeriod(date);
  }
  function applyPeriod(date) {
    setPeriodDate(date); setSnapshot(null); setDeductions([]); setDecisionReason('');
    setError(''); setNotice('Consultá el período seleccionado para habilitar sus acciones.'); setNextPeriodDate(null);
  }
  async function execute(command, recovering = false) {
    const work = begin('writing');
    if (!work) return;
    const pendingAttempt = { ...command, status: 'uncertain' };
    setAttempt(pendingAttempt);
    let confirmed = false;
    try {
      const result = await requestJson(command.url, {
        method: 'POST', headers: { ...scopeHeaders, 'Idempotency-Key': command.key },
        body: JSON.stringify(command.body), signal: work.controller.signal,
      });
      if (!certificateReceiptMatches(result, command, actorMembershipId)) throw new Error('Unverified certificate receipt');
      if (!current(work)) return;
      confirmed = true;
      setAttempt({ ...command, status: 'confirmed' });
      await readSnapshot(command.periodDate, work);
      if (!current(work)) return;
      setAttempt(null); setDeductions([]); setDecisionReason('');
      setNotice(result.receipt.replayed ? 'Se recuperó la operación registrada, sin duplicarla.' :
        command.kind === 'PREPARE' ? 'Certificado preparado y enviado a decisión.' : 'Decisión contractual registrada.');
    } catch (failure) {
      if (!current(work)) return;
      if (confirmed) {
        setError('La operación está confirmada, pero falta actualizar la vista. Consultá el período; no hace falta repetir la operación.');
      } else {
        if (!recovering && !certificateFailureIsUncertain(failure)) setAttempt(null);
        setError(certificateFailureMessage(failure, true));
      }
    } finally { finish(work); }
  }
  function prepare() {
    const candidate = snapshot?.candidate;
    if (!candidate || !snapshot.capabilities.prepare.allowed || locked || active.current) return;
    const normalized = [];
    for (const [index, row] of deductions.entries()) {
      const code = row.code.trim(), reason = row.reason.trim(), amountMinor = majorToCertificateMinor(row.amount, minorUnits);
      if (!code || !reason || !amountMinor) { setError(`Completá código, motivo e importe válido en la deducción ${index + 1}.`); return; }
      normalized.push({ code, reason, amountMinor });
    }
    const body = { periodDate, expectedBookRevision: candidate.expectedBookRevision,
      expectedPeriodHeadRevision: candidate.expectedPeriodHeadRevision,
      expectedCurrentApprovedVersionId: candidate.expectedCurrentApprovedVersionId, deductions: normalized };
    execute({ kind: 'PREPARE', periodDate, body, key: `certificate-prepare-${crypto.randomUUID()}`, url: '/api/project-certificates' });
  }
  function decide(decision) {
    const pending = snapshot?.pendingCertificate;
    if (!pending || !pendingInPeriod || !snapshot.capabilities?.[decision.toLowerCase()]?.allowed || !decisionReason.trim() || locked || active.current) return;
    const body = { expectedBookRevision: snapshot.book?.revision ?? 0,
      expectedPeriodHeadRevision: snapshot.periodHead?.revision ?? 0,
      expectedCertificateDigest: pending.integrityDigest, decision, reason: decisionReason.trim() };
    execute({ kind: decision, periodDate, certificateId: pending.id, body,
      key: `certificate-${decision.toLowerCase()}-${crypto.randomUUID()}`,
      url: `/api/project-certificates/${encodeURIComponent(pending.id)}/decision` });
  }
  const blockers=snapshot?.readiness?.blockingReasons||[];
  return <main className={styles.shell}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>CERTIFICACIÓN CONTRACTUAL · QUINCENAL</span><h1>Certificaciones</h1><p>{projectName} · preparación y dictamen sobre corte técnico, contrato y autoridades vigentes.</p></div><span className={styles.guard}><i className="fa-solid fa-shield-halved" aria-hidden="true"/> No ejecuta pagos</span></header>
    <section className={styles.periodBar} aria-label="Período de certificación"><label>Fecha dentro de la quincena<input type="date" value={periodDate} onChange={e=>selectPeriod(e.target.value)} disabled={locked}/></label><button type="button" onClick={refresh} disabled={busy||!periodDate}>{busy?'Actualizando…':'Actualizar período'}</button><span><PeriodLabel period={snapshot?.requestedPeriod}/></span></section>
    {error&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p className={styles.notice} role="status">{notice}</p>}
    {nextPeriodDate !== null && <section className={styles.blockers} role="alertdialog" aria-labelledby="change-period-title">
      <h2 id="change-period-title">Hay cambios sin guardar</h2><p>Cambiar de período descarta las deducciones y el dictamen de esta pantalla. No modifica certificados guardados.</p>
      <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setNextPeriodDate(null)}>Seguir editando</button>
        <button type="button" className={styles.danger} onClick={() => applyPeriod(nextPeriodDate)}>Descartar y cambiar período</button></div>
    </section>}
    {attempt && <section className={styles.blockers} aria-label="Recuperación del certificado">
      <h2>{attempt.status === 'confirmed' ? 'Operación confirmada · consulta pendiente' : 'Operación por confirmar'}</h2>
      <p>No cierres esta pantalla. Conservamos el mismo identificador y los datos originales de la operación.</p>
      <div className={styles.actions}>{attempt.status === 'uncertain' && <button type="button" className={styles.secondary} disabled={busy} onClick={() => execute(attempt, true)}>Recuperar mismo intento</button>}</div>
    </section>}
    {snapshot ? <>
    <section className={styles.stats} aria-label="Estado de certificación"><article><span>Estado</span><strong>{CERTIFICATE_READINESS_LABELS[summary.readiness]||summary.readiness}</strong></article><article><span>Modo</span><strong>{CERTIFICATE_MODE_LABELS[summary.mode]||'—'}</strong></article><article><span>Historial</span><strong>{summary.history}</strong><small>versiones de esta quincena</small></article><article><span>Pendiente</span><strong>{summary.pending?'Sí':'No'}</strong><small>{summary.current?'hay versión aprobada':'sin aprobado actual'}</small></article></section>
    {blockers.length>0&&<section className={styles.blockers} aria-labelledby="cert-blockers"><h2 id="cert-blockers">Bloqueos del período</h2><ul>{blockers.map(code=><li key={code}><strong>{CERTIFICATE_BLOCKER_LABELS[code]||'El período requiere revisión contractual antes de continuar.'}</strong></li>)}</ul></section>}
    <div className={`${styles.grid} ${!summary.candidate ? styles.single : ''}`}>
      {(summary.candidate || (!summary.pending && !summary.current)) && <section className={styles.panel} aria-labelledby="candidate-title"><div className={styles.panelHead}><div><span>CANDIDATO</span><h2 id="candidate-title">Base certificable</h2></div><b>{certificateCapabilityLabel(snapshot.capabilities?.prepare)}</b></div>
        {summary.candidate?<><div className={styles.moneyGrid}><div><span>Incremento bruto</span><strong>{formatCertificateMinor(summary.candidate.totals.certificateIncrementGrossMinor,currency,minorUnits)}</strong></div><div><span>Retención del período</span><strong>{formatCertificateMinor(summary.candidate.totals.certificateIncrementRetentionMinor,currency,minorUnits)}</strong></div></div><p className={styles.meta}><PeriodLabel period={summary.candidate.period}/> · {summary.candidate.valuedLineCount} líneas valorizadas · {summary.candidate.noClaimLineCount} sin reclamo</p><ol className={styles.lines}>{summary.candidate.lines.slice(0,8).map(line=><li key={line.taskId}><div><strong>{line.taskCode?`${line.taskCode} · `:''}{line.taskTitle}</strong><span>{line.state==='VALUED'?`${line.periodQuantity} ${line.unitCode}`:line.noClaimReason}</span></div><b>{line.certificateIncrementGrossMinor?formatCertificateMinor(line.certificateIncrementGrossMinor,currency,minorUnits):'Sin importe'}</b></li>)}</ol>{summary.candidate.lines.length>8&&<p className={styles.meta}>Se muestran 8 de {summary.candidate.lines.length} líneas.</p>}
          {snapshot.capabilities?.prepare?.allowed&&!attempt&&<div className={styles.prepareBox}><h3>Deducciones del certificado</h3>{deductions.map((row,index)=><div className={styles.deductionRow} key={index}><input aria-label={`Código deducción ${index+1}`} placeholder="Código" value={row.code} onChange={e=>setDeductions(cur=>cur.map((item,i)=>i===index?{...item,code:e.target.value}:item))}/><input aria-label={`Motivo deducción ${index+1}`} placeholder="Motivo contractual" value={row.reason} onChange={e=>setDeductions(cur=>cur.map((item,i)=>i===index?{...item,reason:e.target.value}:item))}/><input aria-label={`Importe deducción ${index+1}`} inputMode="decimal" placeholder={`Importe ${currency}`} value={row.amount} onChange={e=>setDeductions(cur=>cur.map((item,i)=>i===index?{...item,amount:e.target.value}:item))}/><button type="button" onClick={()=>setDeductions(cur=>cur.filter((_,i)=>i!==index))}>Quitar</button></div>)}<div className={styles.actions}><button type="button" className={styles.secondary} onClick={()=>setDeductions(cur=>[...cur,{code:'',reason:'',amount:''}])} disabled={locked||deductions.length>=50}>Agregar deducción</button><button type="button" className={styles.primary} onClick={prepare} disabled={locked}>Preparar certificado</button></div></div>}
        </>:<p className={styles.empty}>No hay candidato disponible para este período.</p>}</section>}
      <section className={styles.panel} aria-labelledby="pending-title"><div className={styles.panelHead}><div><span>PENDIENTE / APROBADO</span><h2 id="pending-title">Estado contractual</h2></div></div>
        {summary.pending?<CertificateCard certificate={summary.pending} kind="Pendiente de decisión"/>:summary.current?<CertificateCard certificate={summary.current} kind="Aprobado vigente"/>:<p className={styles.empty}>Todavía no existe un certificado para esta quincena.</p>}
        {summary.pending&&pendingInPeriod&&!attempt&&<div className={styles.decisionBox}><h3>Dictamen</h3><textarea aria-label="Fundamento del dictamen" rows={4} maxLength={1000} value={decisionReason} onChange={e=>setDecisionReason(e.target.value)} placeholder="Fundamento contractual verificable"/><div className={styles.capabilities}><span>Aprobar: {certificateCapabilityLabel(snapshot.capabilities.approve)}</span><span>Rechazar: {certificateCapabilityLabel(snapshot.capabilities.reject)}</span><span>Cancelar: {certificateCapabilityLabel(snapshot.capabilities.cancel)}</span></div><div className={styles.actions}>{snapshot.capabilities.approve.allowed&&<button className={styles.primary} type="button" disabled={locked||!decisionReason.trim()} onClick={()=>decide('APPROVE')}>Aprobar</button>}{snapshot.capabilities.reject.allowed&&<button className={styles.danger} type="button" disabled={locked||!decisionReason.trim()} onClick={()=>decide('REJECT')}>Rechazar</button>}{snapshot.capabilities.cancel.allowed&&<button className={styles.secondary} type="button" disabled={locked||!decisionReason.trim()} onClick={()=>decide('CANCEL')}>Cancelar</button>}</div></div>}
      </section>
    </div>
    <section className={styles.panel} aria-labelledby="history-title"><div className={styles.panelHead}><div><span>HISTORIAL DEL PERÍODO</span><h2 id="history-title">Versiones</h2></div></div>{snapshot.history.length===0?<p className={styles.empty}>No hay versiones persistidas en esta quincena.</p>:<ol className={styles.history}>{snapshot.history.map(cert=><li key={cert.id}><div><strong>Secuencia {cert.projectSequence} · v{cert.periodVersion}</strong><span><PeriodLabel period={cert.period}/> · {decisionLabels[cert.decision?.decision]||'Pendiente'}</span></div><span>{formatCertificateMinor(cert.totals.certificateIncrementNetMinor,cert.terms.currencyCode,cert.terms.currencyMinorUnits)}</span></li>)}</ol>}</section>
    {summary.pending && !pendingInPeriod && <p className={styles.notice} role="status">El certificado pendiente corresponde a otra quincena. Consultá su fecha para registrar un dictamen.</p>}
    </> : <section className={styles.empty} role="status">{busy ? 'Verificando el certificado y sus permisos…' : 'Consultá el período para cargar datos verificados.'}</section>}
    <p className={styles.disclaimer}>Esta superficie registra preparación y dictamen contractual. No reemplaza firma digital certificada, comprobante fiscal ni ejecución bancaria.</p>
  </main>;
}
function CertificateCard({certificate,kind}){const currency=certificate.terms.currencyCode,minor=certificate.terms.currencyMinorUnits;return <article className={styles.certificateCard}><div><span>{kind}</span><strong>Secuencia {certificate.projectSequence} · v{certificate.periodVersion}</strong><small><PeriodLabel period={certificate.period}/></small></div><div className={styles.moneyGrid}><div><span>Bruto período</span><strong><CertificateMoney certificate={certificate} field="certificateIncrementGrossMinor"/></strong></div><div><span>Retención</span><strong><CertificateMoney certificate={certificate} field="certificateIncrementRetentionMinor"/></strong></div><div><span>Deducciones</span><strong>{formatCertificateMinor(certificate.totals.certificateIncrementDeductionsMinor,currency,minor)}</strong></div><div><span>Neto</span><strong>{formatCertificateMinor(certificate.totals.certificateIncrementNetMinor,currency,minor)}</strong></div></div><p className={styles.meta}>Integridad: <code>{shortHash(certificate.integrityDigest)}</code> · {certificate.lineCount} líneas · {certificate.deductionCount} deducciones</p>{certificate.decision&&<p className={styles.decision}><strong>{decisionLabels[certificate.decision.decision]||certificate.decision.decision}</strong> · {certificate.decision.reason}</p>}</article>;}
