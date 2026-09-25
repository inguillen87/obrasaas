'use client';
import { useEffect, useId, useState } from 'react';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { normalizeOwnerQuery, ownerDirectoryPageMatches } from '@/lib/assignment-owner-directory-policy';
import styles from './assignment-owner-directory.module.css';
const noop = () => {};

export default function AssignmentOwnerDirectory({ organizationId, projectId, taskId, taskRevision, ownerKind, disabled = false, onPick, onClose, onSourceChanged = noop }) {
  const queryId = useId();
  const [query, setQuery] = useState('');
  const [request, setRequest] = useState({ query: '', cursor: null, trail: [] });
  const [page, setPage] = useState(null), [phase, setPhase] = useState('loading'), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    const input = { taskId, expectedTaskRevision: taskRevision, ownerKind, query: request.query, cursor: request.cursor };
    const params = new URLSearchParams({ taskId, expectedTaskRevision: String(taskRevision), ownerKind, query: request.query });
    if (request.cursor) params.set('cursor', request.cursor);
    fetch('/api/execution/assignments/owners?' + params, { cache: 'no-store', signal: controller.signal, headers: evidenceScopeHeaders({ organizationId, projectId }) })
      .then(async response => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw Object.assign(new Error(body?.error || 'No se pudo consultar el directorio.'), { status: response.status, code: body?.code });
        if (!ownerDirectoryPageMatches(body, input, { organizationId, projectId })) throw Object.assign(new Error('La respuesta no corresponde a esta búsqueda y obra.'), { code: 'DIRECTORY_UNCONFIRMED' });
        if (active) { setPage(body); setPhase('ready'); setError(''); }
      })
      .catch(failure => {
        if (!active) return;
        setPage(null);
        const blocked = failure.code === 'DIRECTORY_UNCONFIRMED' || [401, 402, 403, 404, 409, 410].includes(failure.status);
        setPhase(blocked ? 'blocked' : 'error');
        setError(failure.name === 'AbortError' ? 'La consulta demoró. Volvé a buscar; tu planificación sigue intacta.' : failure.message);
        if (failure.status === 409 && failure.code === 'ASSIGNMENT_TASK_CHANGED') onSourceChanged();
      }).finally(() => clearTimeout(timer));
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [request, organizationId, projectId, taskId, taskRevision, ownerKind, onSourceChanged]);
  const busy = phase === 'loading';
  let normalized = null;
  try { normalized = normalizeOwnerQuery(query); } catch { /* Shown when the user searches. */ }
  const changed = normalized !== request.query;
  const usable = phase === 'ready' && !changed && !disabled;
  function load(next) { setPage(null); setError(''); setPhase('loading'); setRequest(next); }
  function search() {
    if (busy || disabled || phase === 'blocked') return;
    try { load({ query: normalizeOwnerQuery(query), cursor: null, trail: [] }); }
    catch (failure) { setError(failure.message); }
  }
  return <section className={styles.directory} aria-label="Directorio completo de responsables" aria-busy={busy}>
    <header><div><span>BUSCAR MÁS ALLÁ DEL LISTADO INICIAL</span><h3>{ownerKind === 'WORKER' ? 'Personas de esta obra' : 'Cuadrillas de esta obra'}</h3></div><button type="button" onClick={onClose}>Cerrar directorio</button></header>
    <p>Consultá responsables activos por nombre. Se muestran 30 por página; no se cargan legajos, teléfonos ni datos de otras obras.</p>
    <div className={styles.search}><label htmlFor={queryId}>Nombre en el directorio<input id={queryId} type="search" value={query} maxLength={80} disabled={disabled || phase === 'blocked'} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); search(); } }} placeholder="Nombre o palabras del nombre" /></label><button type="button" onClick={search} disabled={busy || disabled || phase === 'blocked'}>Buscar en toda la obra</button></div>
    <small>No distingue mayúsculas; escribí las tildes del nombre. Dejá el campo vacío para recorrer el directorio.</small>
    {error && <p role="alert" className={styles.notice}>{error}</p>}
    {busy && <p role="status">Consultando responsables de esta obra…</p>}
    {phase === 'error' && <button type="button" disabled={disabled} onClick={() => load({ ...request })}>Reintentar esta consulta</button>}
    {changed && page && <p role="status">La búsqueda cambió. Presioná Buscar antes de seleccionar un resultado.</p>}
    {page && <><p role="status">{page.items.length} resultados en esta página · {request.query ? 'Búsqueda: «' + request.query + '»' : 'Todos los nombres'} · orden por nombre</p>
      {page.items.length === 0 && <p className={styles.notice}>No hay resultados activos para esta búsqueda. Revisá el nombre o volvé al inicio; no se borró tu selección.</p>}
      <ul>{page.items.map(row => <li key={row.id}><strong>{row.name}</strong><button type="button" disabled={!usable} onClick={() => { if (usable) onPick(row); }} aria-label={'Elegir ' + row.name}>Elegir</button></li>)}</ul>
      <nav aria-label="Páginas del directorio"><button type="button" disabled={!usable || !request.trail.length} onClick={() => load({ query: request.query, cursor: request.trail.at(-1), trail: request.trail.slice(0, -1) })}>Página anterior</button><span>Página {request.trail.length + 1}</span><button type="button" disabled={!usable || !page.nextCursor} onClick={() => load({ query: request.query, cursor: page.nextCursor, trail: [...request.trail, request.cursor] })}>Página siguiente</button></nav>
    </>}
    <p className={styles.notice}>Elegir sólo completa el formulario. Todavía tenés que revisar coincidencias y confirmar; la vigencia del responsable se comprueba nuevamente al guardar.</p>
  </section>;
}
