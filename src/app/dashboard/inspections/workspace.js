'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, EmptyState, GlassCard, PageHeader, tokens } from '@/lib/design-system';
import styles from './workspace.module.css';

const STATUS = { DRAFT: 'Borrador', SUBMITTED: 'En revisión', APPROVED: 'Aprobada', OBSERVED: 'Observada', REJECTED: 'Rechazada' };
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
export default function InspectionWorkspace({ projectName, templates, canManage, canReview }) {
  const [records, setRecords] = useState([]), [record, setRecord] = useState(null);
  const [draft, setDraft] = useState(() => freshDraft(templates[0]));
  const [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [reviewNotes, setReviewNotes] = useState('');
  const requestId = useRef(null);
  const editable = canManage && (!record || record.status === 'DRAFT') && !busy;
  const dirty = record && JSON.stringify(draft) !== JSON.stringify(asDraft(record));
  const load = useCallback(async (targetPage = page, signal) => {
    const data = await requestJson('/api/inspections?page=' + targetPage, { signal });
    setRecords(data.records); setHasMore(data.hasMore); setPage(targetPage);
  }, [page]);
  useEffect(() => {
    const controller = new AbortController();
    requestJson('/api/inspections?page=0', { signal: controller.signal }).then(data => { setRecords(data.records); setHasMore(data.hasMore); }).catch(err => { if (err.name !== 'AbortError') setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function open(id) {
    setBusy(true); setError(''); setNotice('');
    try { const found = await requestJson('/api/inspections/' + encodeURIComponent(id)); setRecord(found); setDraft(asDraft(found)); setReviewNotes(found.reviewNotes || ''); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function startNew() {
    setRecord(null); setDraft(freshDraft(templates[0])); setReviewNotes(''); requestId.current = null; setError(''); setNotice('');
  }
  function field(name, value) { setDraft(current => ({ ...current, [name]: value })); }
  function answer(index, name, value) { setDraft(current => ({ ...current, checklist: current.checklist.map((item, i) => i === index ? { ...item, [name]: value } : item) })); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const result = await requestJson(record ? '/api/inspections/' + record.id : '/api/inspections', { method: record ? 'PATCH' : 'POST', body: JSON.stringify(record ? { action: 'SAVE_DRAFT', version: record.version, draft } : { ...draft, clientRequestId: requestId.current }) });
      setRecord(result.record); setDraft(asDraft(result.record)); setNotice('Borrador guardado en la obra.'); await load(0);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function act(action) {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await requestJson('/api/inspections/' + record.id, { method: 'PATCH', body: JSON.stringify({ action, version: record.version, reviewNotes }) });
      setRecord(data.record); setDraft(asDraft(data.record)); setNotice('Estado actualizado: ' + STATUS[data.record.status]); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
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
      <div className={styles.workspace}>
        <GlassCard hover={false}>
          <h2>Registro de inspecciones</h2>
          <p className={styles.context}>{loading ? 'Cargando registros…' : records.length + ' registros en esta página'}</p>
          {!loading && !records.length && <EmptyState title="Todavía no hay inspecciones" description="Creá la primera con su ubicación, documento de referencia y controles. No se cargan ejemplos en tu obra." />}
          <div className={styles.list}>{records.map(item => <button key={item.id} className={styles.record} onClick={() => open(item.id)} disabled={busy} aria-pressed={record?.id === item.id}><strong>{item.title}</strong><span>{item.location}</span><Badge>{STATUS[item.status]}</Badge><small>v{item.version} · {new Date(item.createdAt).toLocaleDateString('es-AR')}</small></button>)}</div>
          <div className={styles.actions}><Button variant="secondary" disabled={page === 0 || busy} onClick={() => load(page - 1).catch(err => setError(err.message))}>Anterior</Button><span>Página {page + 1}</span><Button variant="secondary" disabled={!hasMore || busy} onClick={() => load(page + 1).catch(err => setError(err.message))}>Siguiente</Button></div>
        </GlassCard>
        <GlassCard hover={false}>
          <h2>{record ? record.title : 'Nueva inspección'}</h2>
          {record && <p><Badge>{STATUS[record.status]}</Badge> <span className={styles.context}>Versión {record.version}</span></p>}
          <form onSubmit={save}>
            <fieldset disabled={!editable} className={styles.fields}>
              <label>Plantilla<select value={draft.templateKey} disabled={Boolean(record)} onChange={event => setDraft(freshDraft(templates.find(item => item.key === event.target.value)))}>{templates.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}</select></label>
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
            {canManage && record.status === 'DRAFT' && <Button onClick={() => act('SUBMIT')} disabled={busy || dirty}>Enviar a revisión</Button>}
            {canManage && record.status === 'OBSERVED' && <Button onClick={() => act('REOPEN')} disabled={busy}>Reabrir para corregir</Button>}
            <Button variant="secondary" onClick={() => open(record.id)} disabled={busy}>Ver historial</Button>
            <Button variant="ghost" onClick={exportRecord} disabled={busy || dirty}>Descargar registro JSON</Button>
          </div>}
          {dirty && <p className={styles.context}>Guardá los cambios antes de enviar a revisión o descargar el registro.</p>}
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
          {record && <section className={styles.history}><h3>Trazabilidad</h3><p className={styles.context}>Huella SHA-256 de integridad del registro; no se presenta como firma digital certificada. El historial muestra hasta 20 revisiones recientes.</p><code>{record.contentHash}</code>{record.revisions?.map(revision => <p key={revision.id}>v{revision.version} · {revision.action} · {new Date(revision.createdAt).toLocaleString('es-AR')}</p>)}</section>}
        </GlassCard>
      </div>
    </div>
  </div>;
}
