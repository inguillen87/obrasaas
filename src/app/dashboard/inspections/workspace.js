'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, EmptyState, GlassCard, PageHeader, tokens } from '@/lib/design-system';
import Link from 'next/link';
import { INSPECTION_STATUS_LABELS, INSPECTION_ACTION_LABELS, inspectionDraftChanged, inspectionReadiness, inspectionNextStep } from '@/lib/inspection-workflow-view';
import styles from './workspace.module.css';

const STATUS = INSPECTION_STATUS_LABELS;
const RESULTS = { PENDING: 'Pendiente', PASS: 'Conforme', FAIL: 'No conforme', NA: 'No aplica' };
function freshDraft(template) {
  return { templateKey: template.key, title: '', location: '', technicalReference: '', notes: '', checklist: template.items.map(item => ({ ...item, result: 'PENDING', criterion: '', observation: '' })) };
}
function asDraft(record) {
  const { templateKey, title, location, technicalReference, notes, checklist } = record;
  return { templateKey, title, location, technicalReference, notes, checklist };
}
async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}
export default function InspectionWorkspace({ projectName, templates, canManage, canReview, initialRecord = null }) {
  const [records, setRecords] = useState([]), [record, setRecord] = useState(initialRecord);
  const [draft, setDraft] = useState(() => initialRecord ? asDraft(initialRecord) : freshDraft(templates[0]));
  const [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [reviewNotes, setReviewNotes] = useState(initialRecord?.reviewNotes || '');
  const requestId = useRef(null);
  const listGeneration = useRef(0);
  const [listError, setListError] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const operationLock = useRef(false);
  const editable = canManage && (!record || record.status === 'DRAFT') && !busy;
  const baseline = record ? asDraft(record) : freshDraft(templates.find(item => item.key === draft.templateKey) || templates[0]);
  const dirty = inspectionDraftChanged(draft, baseline);
  const reviewDirty = record?.status === 'SUBMITTED' && reviewNotes !== (record.reviewNotes || '');
  const hasUnsaved = dirty || reviewDirty;
  const readiness = inspectionReadiness(draft);
  const nextStep = inspectionNextStep({ record, draft, dirty, canManage, canReview });
  const confirmDiscard = () => !hasUnsaved || window.confirm('Hay cambios sin guardar. ¿Descartarlos y continuar?');
  const load = useCallback(async (targetPage = page) => {
    const generation = ++listGeneration.current;
    setListLoading(true);
    try {
      const data = await requestJson('/api/inspections?page=' + targetPage);
      if (generation !== listGeneration.current) return false;
      setRecords(data.records); setHasMore(data.hasMore); setPage(targetPage);
      setListError(''); setLastSynced(new Date()); return true;
    } catch (err) {
      if (generation === listGeneration.current) setListError(err.message);
      return false;
    } finally {
      if (generation === listGeneration.current) { setListLoading(false); setLoading(false); }
    }
  }, [page]);
  useEffect(() => {
    const controller = new AbortController();
    const generation = listGeneration.current;
    requestJson('/api/inspections?page=0', { signal: controller.signal }).then(data => {
      if (controller.signal.aborted || generation !== listGeneration.current) return;
      setRecords(data.records); setHasMore(data.hasMore); setLastSynced(new Date());
    }).catch(err => {
      if (err.name !== 'AbortError' && generation === listGeneration.current) setListError(err.message);
    }).finally(() => { if (!controller.signal.aborted && generation === listGeneration.current) setLoading(false); });
    return () => { controller.abort(); listGeneration.current += 1; };
  }, []);
  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && !operationLock.current) void load(page);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [load, page]);
  async function readHistory() {
    if (!record || operationLock.current) return;
    operationLock.current = true; setBusy(true); setError('');
    try {
      const latest = await requestJson('/api/inspections/' + encodeURIComponent(record.id));
      if (latest.version !== record.version) {
        setNotice('Hay una versión más reciente. Tus cambios siguen intactos; usá Actualizar registro para revisarla.');
      } else {
        setRecord(current => current?.id === latest.id ? { ...current, revisions: latest.revisions } : current);
      }
    } catch (err) { setError(err.message); }
    finally { operationLock.current = false; setBusy(false); }
  }
  function rememberSelection(id) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('inspection', id); else url.searchParams.delete('inspection');
    window.history.replaceState(window.history.state, '', url);
  }
  async function open(id) {
    if (operationLock.current || !confirmDiscard()) return;
    operationLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try { const found = await requestJson('/api/inspections/' + encodeURIComponent(id)); setRecord(found); rememberSelection(found.id); setDraft(asDraft(found)); setReviewNotes(found.reviewNotes || ''); }
    catch (err) { setError(err.message); } finally { operationLock.current = false; setBusy(false); }
  }
  function startNew() {
    if (operationLock.current || !confirmDiscard()) return;
    setRecord(null); rememberSelection(null); setDraft(freshDraft(templates[0])); setReviewNotes(''); requestId.current = null; setError(''); setNotice('');
  }
  function field(name, value) { setDraft(current => ({ ...current, [name]: value })); }
  function answer(index, name, value) { setDraft(current => ({ ...current, checklist: current.checklist.map((item, i) => i === index ? { ...item, [name]: value } : item) })); }
  async function save(event) {
    event.preventDefault();
    if (operationLock.current) return;
    operationLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const result = await requestJson(record ? '/api/inspections/' + record.id : '/api/inspections', { method: record ? 'PATCH' : 'POST', body: JSON.stringify(record ? { action: 'SAVE_DRAFT', version: record.version, draft } : { ...draft, clientRequestId: requestId.current }) });
      setRecord(result.record); rememberSelection(result.record.id); setDraft(asDraft(result.record)); setNotice('Borrador guardado en la obra.'); await load(0);
    } catch (err) { setError(err.message); } finally { operationLock.current = false; setBusy(false); }
  }
  async function act(action) {
    if (operationLock.current || (action === 'SUBMIT' && (dirty || !readiness.ready))) return;
    operationLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await requestJson('/api/inspections/' + record.id, { method: 'PATCH', body: JSON.stringify({ action, version: record.version, reviewNotes }) });
      setRecord(data.record); setDraft(asDraft(data.record)); setReviewNotes(data.record.reviewNotes || ''); setNotice('Estado actualizado: ' + STATUS[data.record.status]); await load();
    } catch (err) { setError(err.message); } finally { operationLock.current = false; setBusy(false); }
  }
  function exportRecord() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'inspeccion-' + record.id + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className={styles.shell} style={{ background: tokens.colors.bg.primary, color: tokens.colors.text.primary, fontFamily: tokens.font.sans }}>
    <PageHeader title="Inspecciones de obra" subtitle={projectName + ' · Checklist, revisión humana y trazabilidad'} actions={canManage && <Button onClick={startNew} disabled={busy}>Nueva inspección</Button>} />
    <div className={styles.content}>
      {error && <div role="alert" className={styles.error}>{error} <button onClick={() => record ? open(record.id) : load().catch(err => setError(err.message))}>Actualizar datos</button></div>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <p className={styles.context}>Cada registro pertenece a la obra activa. Los criterios se documentan según el proyecto: no hay umbrales técnicos universales ni aprobación automática.</p>
      <GlassCard hover={false} className={styles.nextStep}>
        <div className={styles.stepHeader}>
          <div><span className={styles.context}>Siguiente paso</span><h2>{nextStep.title}</h2><p className={styles.context}>{nextStep.detail}</p></div>
          <Badge>{readiness.completed} de {readiness.total} controles completos</Badge>
        </div>
        {record?.status === 'DRAFT' && !readiness.ready && <details className={styles.pending} open>
          <summary>{readiness.issues.length} punto{readiness.issues.length === 1 ? '' : 's'} por completar antes de enviar</summary>
          <ul>{readiness.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
        </details>}
        {record?.status === 'SUBMITTED' && readiness.failures > 0 && <p className={styles.error}>Hay {readiness.failures} no conformidad{readiness.failures === 1 ? '' : 'es'}: Dirección puede observar o rechazar, pero no aprobar.</p>}
        {record && records.some(item => item.id === record.id && item.version > record.version) && <p role="status" className={styles.notice}>El servidor tiene una versión más reciente. Tus cambios se conservan; revisá el registro antes de continuar.</p>}
        <nav className={styles.actions} aria-label="Continuar el circuito de obra">
          <Link href="/dashboard/activity" onClick={event => { if (!confirmDiscard()) event.preventDefault(); }}>Ver bitácora de la obra</Link>
          <Link href="/dashboard/getting-started" onClick={event => { if (!confirmDiscard()) event.preventDefault(); }}>Volver a puesta en marcha</Link>
        </nav>
      </GlassCard>
      <div className={styles.workspace}>
        <GlassCard hover={false}>
          <h2>Registro de inspecciones</h2>
          <p className={styles.context} aria-live="polite">{loading || listLoading ? 'Actualizando registros…' : records.length + ' registros en esta página'}</p>
          {lastSynced && <small className={styles.context}>Última consulta: {lastSynced.toLocaleTimeString('es-AR')}</small>}
          {listError && <div role="alert" className={styles.error}>No se pudo actualizar el listado: {listError}<Button variant="secondary" disabled={listLoading} onClick={() => load(page)}>Reintentar listado</Button></div>}
          {!loading && !listError && !records.length && <EmptyState title="Todavía no hay inspecciones" description="Creá la primera con su ubicación, documento de referencia y controles. No se cargan ejemplos en tu obra." />}
          <div className={styles.list}>{records.map(item => <button key={item.id} className={styles.record} onClick={() => open(item.id)} disabled={busy} aria-pressed={record?.id === item.id}><strong>{item.title}</strong><span>{item.location}</span><Badge>{STATUS[item.status]}</Badge><small>v{item.version} · {new Date(item.createdAt).toLocaleDateString('es-AR')}</small></button>)}</div>
          <div className={styles.actions}><Button variant="secondary" disabled={page === 0 || busy || listLoading} onClick={() => load(page - 1).catch(err => setError(err.message))}>Anterior</Button><span>Página {page + 1}</span><Button variant="secondary" disabled={!hasMore || busy || listLoading} onClick={() => load(page + 1).catch(err => setError(err.message))}>Siguiente</Button></div>
        </GlassCard>
        <GlassCard hover={false}>
          <h2>{record ? record.title : 'Nueva inspección'}</h2>
          {record && <p><Badge>{STATUS[record.status]}</Badge> <span className={styles.context}>Versión {record.version}</span></p>}
          <form onSubmit={save}>
            <fieldset disabled={!editable} className={styles.fields}>
              <label>Plantilla<select value={draft.templateKey} disabled={Boolean(record)} onChange={event => { if (confirmDiscard()) setDraft(freshDraft(templates.find(item => item.key === event.target.value))); }}>{templates.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}</select></label>
              <label>Título<input value={draft.title} required maxLength={180} onChange={event => field('title', event.target.value)} /></label>
              <label>Ubicación o elemento<input value={draft.location} required maxLength={240} placeholder="Sector, nivel o elemento inspeccionado" onChange={event => field('location', event.target.value)} /></label>
              <label>Documento de referencia y revisión<input value={draft.technicalReference} maxLength={500} placeholder="Plano, pliego o procedimiento aprobado y revisión" onChange={event => field('technicalReference', event.target.value)} /></label>
              {draft.checklist.map((item, index) => <section className={styles.check} key={item.key}>
                <h3>{index + 1}. {item.label}</h3>
                <label>Criterio de aceptación<textarea value={item.criterion} maxLength={1000} rows={2} onChange={event => answer(index, 'criterion', event.target.value)} /></label>
                <label>Resultado<select value={item.result} onChange={event => answer(index, 'result', event.target.value)}>{Object.entries(RESULTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label>Observación y evidencia de control<textarea value={item.observation} maxLength={2000} rows={2} placeholder="Justificación obligatoria para No conforme y No aplica" onChange={event => answer(index, 'observation', event.target.value)} /></label>
              </section>)}
              <label>Notas generales<textarea value={draft.notes} maxLength={4000} rows={3} onChange={event => field('notes', event.target.value)} /></label>
            </fieldset>
            {canManage && (!record || record.status === 'DRAFT') && <Button type="submit" loading={busy}>Guardar borrador</Button>}
          </form>
          {record && <div className={styles.actions}>
            <Button variant="secondary" onClick={() => open(record.id)} disabled={busy}>Actualizar registro</Button>
            {canManage && record.status === 'DRAFT' && <Button onClick={() => act('SUBMIT')} disabled={busy || dirty || !readiness.ready}>Enviar a revisión</Button>}
            {canManage && record.status === 'OBSERVED' && <Button onClick={() => act('REOPEN')} disabled={busy}>Reabrir para corregir</Button>}
            <Button variant="secondary" onClick={readHistory} disabled={busy}>Ver historial</Button>
            <Button variant="ghost" onClick={exportRecord} disabled={busy || dirty}>Descargar registro JSON</Button>
          </div>}
          {hasUnsaved && <p role="status" className={styles.context}>Guardá los cambios antes de enviar a revisión o descargar el registro.</p>}
          {canReview && record?.status === 'SUBMITTED' && <section className={styles.review}>
            <h3>Dictamen de Dirección</h3>
            <label>Conclusión y alcance<textarea value={reviewNotes} maxLength={4000} rows={3} disabled={busy} onChange={event => setReviewNotes(event.target.value)} /></label>
            <div className={styles.actions}>
              <Button onClick={() => act('APPROVE')} disabled={busy || !reviewNotes.trim() || record.checklist.some(item => item.result === 'FAIL')}>Aprobar</Button>
              <Button variant="secondary" onClick={() => act('OBSERVE')} disabled={busy || !reviewNotes.trim()}>Observar</Button>
              <Button variant="danger" onClick={() => act('REJECT')} disabled={busy || !reviewNotes.trim()}>Rechazar</Button>
            </div>
          </section>}
          {record?.reviewNotes && <section className={styles.review}><h3>Dictamen registrado</h3><p>{record.reviewNotes}</p><small>{new Date(record.reviewedAt).toLocaleString('es-AR')}</small></section>}
          {record && <section className={styles.history}><h3>Trazabilidad</h3><p className={styles.context}>Huella SHA-256 de integridad del registro; no se presenta como firma digital certificada. El historial muestra hasta 20 revisiones recientes.</p><code>{record.contentHash}</code>{record.revisions?.map(revision => <p key={revision.id}>v{revision.version} · {INSPECTION_ACTION_LABELS[revision.action] || 'Evento registrado'} · {new Date(revision.createdAt).toLocaleString('es-AR')}</p>)}</section>}
        </GlassCard>
      </div>
    </div>
  </div>;
}
