'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { tokens } from '@/lib/design-system';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { subscribeFieldInvalidation } from '@/lib/schedule-field-channel';
import { requestWorkspaceNavigation } from '@/lib/workspace-leave-policy';
import { navigationSearchText } from '@/lib/workspace-navigation-search';
import styles from './operations-center.module.css';
const CYCLES = { daily: 'Trabajo diario', quality: 'Calidad y avance', planning: 'Planificación y equipo', supply: 'Abastecimiento y costos' };
const KNOWN_QUEUES = new Set(['unassigned','reports','inspections','blockers','purchases','evidence','proposals']);
function internalHref(href) { return typeof href === 'string' && /^\/dashboard(?:[/?#]|$)/.test(href) && !/[\\\u0000-\u0020]/.test(href); }
function verify(body, scope) {
  return body?.organizationId === scope.organizationId && body?.projectId === scope.projectId && Array.isArray(body.queues) && body.queues.length <= 7 && new Set(body.queues.map(q => q.key)).size === body.queues.length
    && body.queues.every(q => KNOWN_QUEUES.has(q.key) && ['available','unavailable'].includes(q.state) && (q.state === 'unavailable' ? q.count === null : Number.isSafeInteger(q.count) && q.count >= 0)
      && Array.isArray(q.samples) && q.samples.length <= 3 && q.samples.every(sample => internalHref(sample.href)) && internalHref(q.href))
    && Array.isArray(body.paths) && body.paths.every(path => internalHref(path.href)) && (!body.channel || internalHref(body.channel.href));
}
function time(value) { const date = new Date(value); return value && Number.isFinite(date.getTime()) ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Sin verificar'; }
export default function OperationsCenter({ organizationId, projectId, projectName }) {
  const [view, setView] = useState({ data: null, status: 'loading', error: '', checkedAt: null });
  const [filter, setFilter] = useState('pending'), [query, setQuery] = useState('');
  const refreshRef = useRef(() => {});
  useEffect(() => {
    let alive = true, blocked = false, running = false, timer, controller, lastAttempt = 0;
    const scope = { organizationId, projectId };
    async function refresh() {
      if (!alive || blocked || running) return;
      clearTimeout(timer);
      if (document.visibilityState === 'hidden' || navigator.onLine === false) { timer = setTimeout(refresh, 30000); return; }
      if (Date.now() - lastAttempt < 1500) { timer = setTimeout(refresh, 1500); return; }
      running = true; lastAttempt = Date.now(); controller = new AbortController();
      setView(previous => ({ ...previous, status: 'loading' }));
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('/api/operations/overview', { cache: 'no-store', signal: controller.signal, headers: evidenceScopeHeaders(scope) });
        const body = await response.json().catch(() => null);
        if (!alive) return;
        if (!response.ok) { blocked = [401,403,404,409].includes(response.status); throw new Error(body?.error || 'No se pudo confirmar la actualización.'); }
        if (!verify(body, scope)) { blocked = true; throw new Error('La respuesta no corresponde a la obra de esta pantalla.'); }
        setView({ data: body, status: 'ready', error: '', checkedAt: new Date().toISOString() });
      } catch (failure) { if (alive) setView(previous => ({ ...previous, data: blocked ? null : previous.data, status: blocked ? 'blocked' : 'stale', error: failure.name === 'AbortError' ? 'La consulta demoró. Los datos anteriores no están actualizados.' : failure.message })); }
      finally { clearTimeout(timeout); running = false; if (alive && !blocked) timer = setTimeout(refresh, 30000); }
    }
    const wake = () => { if (document.visibilityState === 'visible') void refresh(); };
    const offline = () => setView(previous => ({ ...previous, status: 'stale', error: 'Sin conexión. Los pendientes pueden haber cambiado.' }));
    refreshRef.current = refresh;
    const unsubscribe = subscribeFieldInvalidation(scope, wake);
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake); window.addEventListener('offline', offline);
    void refresh();
    return () => { alive = false; controller?.abort(); clearTimeout(timer); unsubscribe(); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); window.removeEventListener('offline', offline); refreshRef.current = () => {}; };
  }, [organizationId, projectId]);
  const data = view.data?.organizationId === organizationId && view.data?.projectId === projectId ? view.data : null;
  const queues = useMemo(() => (data?.queues || []).filter(queue => (filter === 'all' || queue.count > 0 || queue.state === 'unavailable') && navigationSearchText(queue.label + ' ' + queue.detail + ' ' + CYCLES[queue.cycle]).includes(navigationSearchText(query))), [data, filter, query]);
  const pending = (data?.queues || []).reduce((sum, queue) => sum + (queue.count || 0), 0);
  function navigate(event) { if (view.status === 'blocked' || !requestWorkspaceNavigation('route')) event.preventDefault(); }
  const style = { '--op-bg': tokens.colors.bg.primary, '--op-card': tokens.colors.bg.secondary, '--op-elevated': tokens.colors.bg.elevated, '--op-border': tokens.colors.border.default,
    '--op-text': tokens.colors.text.primary, '--op-muted': tokens.colors.text.secondary, '--op-accent': tokens.colors.accent.primary, '--op-info': tokens.colors.accent.info, '--op-success': tokens.colors.accent.success, '--op-font': tokens.font.sans, '--op-heading': tokens.font.heading };
  return <section className={styles.center} style={style} aria-label="Centro de operaciones de la obra">
    <header className={styles.hero}><div><span className={styles.eyebrow}>OBRA CONECTADA · SIGUIENTE PASO</span><h2>Centro de operaciones</h2><p>{projectName}</p><small>Tu rol define qué podés consultar. Cada decisión se completa en su circuito original.</small></div>
      <div className={styles.metric}><strong>{data ? (data.failedQueues ? '≥ ' : '') + pending.toLocaleString('es-AR') : '—'}</strong><span>Pendientes en las bandejas consultadas</span><small>{data ? data.queues.length + ' bandejas autorizadas' : 'Consultando fuentes'}</small></div>
    </header>
    <div className={styles.toolbar}><p role="status"><i data-state={view.status} />{view.status === 'ready' ? 'Consulta confirmada · ' + time(view.checkedAt) : view.status === 'loading' ? 'Actualizando fuentes…' : view.status === 'blocked' ? 'Contexto o acceso cambiado' : 'Datos anteriores · actualización pendiente'}<small>Actualización cada 30 s con la pantalla visible. No ejecuta compras, aprobaciones ni mensajes.</small></p>
      <button type="button" disabled={view.status === 'loading' || view.status === 'blocked'} onClick={() => refreshRef.current()}><i className="fa-solid fa-rotate" aria-hidden="true" /> Actualizar</button></div>
    {view.error && <p role="alert" className={styles.warning}>{view.error}</p>}
    {data?.readOnly && <p className={styles.warning}>Obra en estado {data.projectStatus === 'COMPLETED' ? 'finalizada' : 'archivada'}. Consultá el historial; las acciones de escritura conservan su bloqueo.</p>}
    {data?.channel && <aside className={styles.channel}><i className="fa-brands fa-whatsapp" aria-hidden="true" /><div><strong>{data.channel.label}</strong><p>{data.channel.detail}</p></div><Link href={data.channel.href} prefetch={false} onNavigate={navigate}>{data.channel.action} <span aria-hidden="true">→</span></Link></aside>}
    {data?.paths.length > 0 && <nav className={styles.paths} aria-label="Ciclos de trabajo de la obra">{data.paths.map(path => <Link key={path.key} href={path.href} prefetch={false} onNavigate={navigate}><i className={path.icon} aria-hidden="true" /><strong>{path.label}</strong><span>{path.detail}</span></Link>)}</nav>}
    <div className={styles.queueHeading}><div><h3>Qué necesita atención</h3><p>Pendientes registrados, no un diagnóstico automático de toda la obra.</p></div><label className={styles.search}><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /><input type="search" aria-label="Buscar bandejas de pendientes" placeholder="Buscar una bandeja…" maxLength={80} value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    <div className={styles.filters} role="group" aria-label="Filtrar bandejas"><button type="button" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>Con pendientes</button><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todas las autorizadas</button><span>{data?.failedQueues > 0 ? data.failedQueues + ' fuentes sin confirmar' : 'De cada bandeja se muestran hasta 3 registros antiguos'}</span></div>
    <div className={styles.queues}>{queues.map(queue => <article className={styles.queue} key={queue.key} data-unavailable={queue.state === 'unavailable'}>
      <div className={styles.queueTitle}><div><span>{CYCLES[queue.cycle]}</span><h4>{queue.label}</h4></div><strong>{queue.count === null ? '—' : queue.count.toLocaleString('es-AR')}</strong></div>
      <p>{queue.detail}</p><small className={styles.next}>{queue.next}</small>
      {queue.state === 'unavailable' ? <p role="status" className={styles.warning}>No se pudo consultar esta fuente. No equivale a cero pendientes.</p> : queue.samples.length ? <ul>{queue.samples.map(sample => <li key={sample.id}><span>{sample.label}</span><Link href={sample.href} prefetch={false} onNavigate={navigate}>{sample.action} <span aria-hidden="true">↗</span></Link></li>)}</ul> : <p className={styles.emptyLane}>Sin pendientes registrados en esta bandeja.</p>}
      <footer><span>{queue.hasMore ? queue.count - queue.samples.length + ' registros adicionales' : 'Consulta por obra y permisos'}</span><Link href={queue.href} prefetch={false} onNavigate={navigate}>{queue.action} →</Link></footer>
    </article>)}</div>
    {data && queues.length === 0 && <div className={styles.empty}><i className="fa-solid fa-list-check" aria-hidden="true" /><h4>{query ? 'No hay bandejas que coincidan' : data.queues.length ? 'Sin pendientes en las bandejas verificadas' : 'Tu rol no tiene bandejas disponibles aquí'}</h4><p>{query ? 'La búsqueda filtra nombres de bandeja; no busca documentos ni mensajes.' : 'Podés recorrer los módulos autorizados. Este resumen no representa una certificación de cumplimiento.'}</p></div>}
    {!data && view.status === 'loading' && <div className={styles.loading} role="status">Consultando registros de la obra. No se muestran datos de demostración como resultados.</div>}
  </section>;
}
