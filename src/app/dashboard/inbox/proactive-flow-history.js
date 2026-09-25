'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { flowHistoryPageMatches, flowHistoryReplyPresentation, flowHistoryStatusLabel } from '@/lib/whatsapp/proactive-flow-history-policy';
import { FLOW_FOLLOWUP_FILTERS, flowFollowupFilter } from '@/lib/whatsapp/proactive-flow-followup';
import { buildFlowHistoryView, flowHistoryTitle, FLOW_HISTORY_SEARCH_LIMIT, FLOW_HISTORY_ORDERS } from '@/lib/whatsapp/proactive-flow-history-view';
import ProactiveFlowReply from './proactive-flow-reply';
import styles from './proactive-flow-history.module.css';
const formatDate = value => new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
// Read-only observations are invalidated across network transitions; the existing
// cleanup aborts reads. Reconnection never submits writes or fetches automatically.
export default function ProactiveFlowHistory(props) {
  return <ScopedHistory key={JSON.stringify([props.organizationId, props.projectId, props.conversationId, props.online !== false])} {...props} />;
}
function ScopedHistory({ organizationId, projectId, conversationId, online = true }) {
  const heading = useId(), panelId = useId(), filterDescriptionId = useId(), listRef = useRef(null), alive = useRef(true), active = useRef(null);
  const [open, setOpen] = useState(false), [page, setPage] = useState(null), [phase, setPhase] = useState('idle');
  const searchId = useId(), searchHintId = useId(), orderId = useId(), searchRef = useRef(null);
  const [query, setQuery] = useState(''), [order, setOrder] = useState('recent');
  const [request, setRequest] = useState({ cursor: null, trail: [] }), [error, setError] = useState(''), [filter, setFilter] = useState('all');
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); active.current = null; }; }, []);
  const busy = phase === 'loading', ready = phase === 'ready' && online;
  async function load(next) {
    if (!online || !organizationId || !projectId || !conversationId) return;
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setRequest(next); setPage(null); setPhase('loading'); setError('');
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({ projectId, mode: 'history' });
      if (next.cursor) params.set('cursor', next.cursor);
      const response = await fetch('/api/whatsapp/inbox/' + encodeURIComponent(conversationId) + '/proactive-flows?' + params, {
        method: 'GET', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }) },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error('No se pudo consultar el seguimiento de esta conversación.'), { status: response.status });
      if (!flowHistoryPageMatches(result, { organizationId, projectId, conversationId }, next.cursor)) throw new Error('La respuesta no corresponde al seguimiento solicitado.');
      if (alive.current && active.current === controller) { setPage(result); setPhase('ready'); }
    } catch (failure) {
      if (alive.current && active.current === controller) {
        setPage(null); setPhase([401, 402, 403, 404].includes(failure.status) ? 'blocked' : 'error');
        setError(failure.name === 'AbortError' ? 'La consulta demoró. Podés volver a consultar sin reenviar ningún mensaje.' : failure.message);
      }
    } finally { clearTimeout(timer); if (active.current === controller) active.current = null; }
  }
  function toggle() {
    if (open) { active.current?.abort(); active.current = null; setOpen(false); setPage(null); setPhase('idle'); }
    else { setFilter('all'); setQuery(''); setOrder('recent'); setOpen(true); void load({ cursor: null, trail: [] }); }
  }
  const followup = buildFlowHistoryView(ready ? page : null, { filter, query, order });
  const selectedFilter = flowFollowupFilter(filter);
  const items = followup.items;
  function resetListScroll() { if (listRef.current) listRef.current.scrollTop = 0; }
  function clearSearch() { setQuery(''); resetListScroll(); searchRef.current?.focus(); }
  function chooseFilter(key) { setFilter(key); resetListScroll(); }
  return <section className={styles.history} aria-labelledby={heading}>
    <header className={styles.header}><div><span>TRAZABILIDAD · SÓLO LECTURA</span><h3 id={heading}>Seguimiento de formularios</h3></div>
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={panelId} disabled={!open && !online}>{open ? 'Cerrar seguimiento' : 'Consultar envíos anteriores'}</button></header>
    {open && <div id={panelId} className={styles.content} aria-busy={busy}>
      <p>Buscá y priorizá los formularios de esta conversación. Consultar no envía mensajes ni levanta bloqueos.</p>
      <div className={styles.actions}><button type="button" disabled={busy || !online || phase === 'blocked'} onClick={() => load({ cursor: null, trail: [] })}>Consultar últimos registros</button>
        {request.cursor && <button type="button" disabled={busy || !online || phase === 'blocked'} onClick={() => load({ ...request })}>Actualizar esta página</button>}</div>
      <div className={styles.tools} role="search" aria-label="Buscar en el seguimiento consultado">
        <div className={styles.searchField}><label htmlFor={searchId}>Buscar en esta página</label>
          <div className={styles.searchInput}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
            <input ref={searchRef} id={searchId} type="search" value={query} maxLength={FLOW_HISTORY_SEARCH_LIMIT} autoComplete="off" spellCheck={false}
              aria-describedby={searchHintId} placeholder="Texto, tipo de formulario o registro" disabled={busy || !online || phase === 'blocked'}
              onChange={event => { setQuery(event.target.value); resetListScroll(); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); } else if (event.key === 'Escape' && query) { event.preventDefault(); event.stopPropagation(); clearSearch(); } }}/>
            {query && <button type="button" className={styles.clearSearch} onClick={clearSearch} disabled={busy || !online || phase === 'blocked'} aria-label="Limpiar búsqueda">×</button>}
          </div>
        </div>
        <div className={styles.orderField}><label htmlFor={orderId}>Ordenar esta página</label>
          <select id={orderId} value={order} onChange={event => { setOrder(event.target.value); resetListScroll(); }} disabled={busy || !online || phase === 'blocked'}>
            {FLOW_HISTORY_ORDERS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </div>
        <p id={searchHintId} className={styles.searchHint}>Busca sólo en esta página, no en otros chats.</p>
      </div>
      {!online && <p role="status" className={styles.notice}>Sin conexión. Los estados no se presentan como actualizados. Reconectar no envía mensajes.</p>}
      {busy && <p role="status">Consultando registros de esta conversación…</p>}
      {error && <p role="alert" className={styles.notice}>{error}</p>}
      {ready && page && followup.available && <>
        <p className={styles.caption}>Consulta: {formatDate(page.observedAt)} · Fechas en hora de este dispositivo.</p>
        <div className={styles.filters} role="group" aria-label="Filtrar esta página" aria-describedby={filterDescriptionId}>
          {FLOW_FOLLOWUP_FILTERS.map(option => <button key={option.key} type="button" data-category={option.key}
            aria-pressed={selectedFilter.key === option.key} onClick={() => chooseFilter(option.key)}>{option.label} ({followup.counts[option.key]})</button>)}
        </div>
        <p id={filterDescriptionId} className={styles.filterExplanation}>{selectedFilter.detail}</p>
        <p role="status" className={styles.resultCount}>{items.length} de {page.items.length} registros de esta página · {selectedFilter.label}.{followup.query ? ' Búsqueda aplicada.' : ''} Los estados corresponden a la hora de consulta.</p>
        {items.length === 0 && <p role="status" className={styles.empty}>{followup.query && page.items.length ? 'No hay coincidencias con esta búsqueda y filtro en la página. Limpiá la búsqueda, cambiá el filtro o recorré otra página; no se revisaron las demás.' : page.items.length ? 'No hay registros en «' + selectedFilter.label + '» en esta página. El filtro no evalúa las demás páginas; podés seguir recorriéndolas.' : 'Todavía no hay formularios registrados en esta conversación. La ausencia no demuestra que un envío en curso haya fallado.'}</p>}
        <ol ref={listRef} className={styles.list} aria-label="Formularios de la página consultada">{items.map(item => {
          const reply = flowHistoryReplyPresentation(item, page.observedAt);
          return <li key={item.messageId} className={styles.item}><div className={styles.rowHeader}><strong>{flowHistoryTitle(item.blueprintKey)}</strong><time dateTime={item.recordedAt}>Registro: {formatDate(item.recordedAt)}</time></div>
            <p className={styles.status} data-status={item.status} data-tone={item.riskDecision || ['failed', 'unknown', 'sending'].includes(item.status) ? 'attention' : 'observed'}>{flowHistoryStatusLabel(item)}</p>
            <p className={styles.reply} data-tone={reply.tone}><strong>{reply.label}</strong></p>
            <p className={styles.excerpt}>Mensaje: {item.body ? item.body.slice(0, 140) + (item.body.length > 140 ? '…' : '') : 'Sin cuerpo conservado.'}</p>
            {item.correlation === 'conflict' && <p className={styles.notice}>La sesión y el mensaje no coinciden. Hace falta revisar la correlación; esta consulta no corrige registros.</p>}
            {item.riskDecision && <p className={styles.caption}>No es un rechazo confirmado de Meta ni un envío nuevo. La decisión anterior aceptó el riesgo y quedó registrada.</p>}
            <details className={styles.details}><summary>Ver mensaje y registro</summary><p className={styles.caption}>{reply.detail}</p><p className={styles.body}>{item.body || 'Sin cuerpo conservado.'}</p><dl><div><dt>Registro</dt><dd>{item.messageId}</dd></div>
              {item.reply.recordedAt && <div><dt>Respuesta registrada</dt><dd>{formatDate(item.reply.recordedAt)}</dd></div>}
              {item.expiresAt && <div><dt>Vigencia original del enlace</dt><dd>{formatDate(item.expiresAt)}</dd></div>}</dl></details>
            {item.reply.state === 'recorded' && item.correlation === 'verified' && <ProactiveFlowReply organizationId={organizationId} projectId={projectId} conversationId={conversationId} sourceMessageId={item.messageId} observedAt={page.observedAt} online={online}/>}
          </li>;
        })}</ol>
        <nav className={styles.pagination} aria-label="Páginas de seguimiento"><button type="button" disabled={!request.trail.length} onClick={() => load({ cursor: request.trail.at(-1), trail: request.trail.slice(0, -1) })}>Más recientes</button><span>Página {request.trail.length + 1} · hasta {page.pageSize} registros</span><button type="button" disabled={!page.nextCursor} onClick={() => load({ cursor: page.nextCursor, trail: [...request.trail, request.cursor] })}>Más antiguos</button></nav>
        <p className={styles.caption}>Aceptado, entregado, leído y respuesta registrada son hechos distintos. Ninguno acredita por sí solo avance físico, aprobación del parte ni pago.</p>
      </>}
    </div>}
  </section>;
}
