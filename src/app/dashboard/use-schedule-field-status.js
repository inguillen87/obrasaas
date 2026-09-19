'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { subscribeFieldInvalidation } from '@/lib/schedule-field-channel';
export const FIELD_REFRESH_MS = 10000;
export default function useScheduleFieldStatus({ organizationId, projectId, taskId = null, after = null }) {
  const [result, setResult] = useState({ snapshot: null, state: 'loading', error: '', checkedAt: null });
  const requestRefresh = useRef(() => {});
  const key = [organizationId, projectId, taskId || '', after || ''].join('|');
  useEffect(() => {
    let active = true, inFlight = false, blocked = false, timer, controller, etag = null, current = null, failures = 0;
    const scope = { organizationId, projectId };
    const schedule = () => { clearTimeout(timer); if (active && !blocked) timer = setTimeout(refresh, Math.min(60000, FIELD_REFRESH_MS * 2 ** failures)); };
    async function refresh() {
      if (!active || blocked || inFlight) return;
      if (document.visibilityState === 'hidden' || navigator.onLine === false) { schedule(); return; }
      inFlight = true; controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const query = new URLSearchParams(taskId ? { taskId } : after ? { after } : {});
        const response = await fetch('/api/schedule/field-status?' + query, { cache: 'no-store', signal: controller.signal,
          headers: { ...evidenceScopeHeaders(scope), ...(etag ? { 'If-None-Match': etag } : {}) } });
        if (!active) return;
        if (response.status === 304 && current) {
          failures = 0; setResult({ key, snapshot: current, state: 'verified', error: '', checkedAt: new Date().toISOString() }); return;
        }
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          if ([401,403,404,409].includes(response.status)) { blocked = true; current = null; etag = null; }
          throw new Error(payload?.error || 'No se pudo verificar la actualización de campo.');
        }
        if (!payload || payload.organizationId !== organizationId || payload.projectId !== projectId || !Array.isArray(payload.tasks) || payload.tasks.length > 50 || typeof payload.version !== 'string') {
          blocked = true; current = null; throw new Error('La respuesta no corresponde al contexto de esta pantalla.');
        }
        current = payload; etag = response.headers.get('etag'); failures = 0;
        setResult({ key, snapshot: payload, state: 'verified', error: '', checkedAt: new Date().toISOString() });
      } catch (error) {
        if (active) { failures = Math.min(failures + 1, 3); setResult(previous => ({ key, snapshot: current, state: blocked ? 'blocked' : 'stale', error: error.message, checkedAt: current ? previous.checkedAt : null })); }
      } finally { clearTimeout(timeout); inFlight = false; schedule(); }
    }
    const invalidate = () => { clearTimeout(timer); if (!inFlight) void refresh(); };
    const offline = () => { if (active) setResult(previous => ({ ...previous, state: 'offline' })); };
    const visible = () => { if (document.visibilityState === 'visible') invalidate(); };
    requestRefresh.current = invalidate;
    const unsubscribe = subscribeFieldInvalidation(scope, invalidate);
    window.addEventListener('online', invalidate); window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    void refresh();
    return () => {
      active = false; clearTimeout(timer); controller?.abort(); unsubscribe(); requestRefresh.current = () => {};
      window.removeEventListener('online', invalidate); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', visible);
    };
  }, [organizationId, projectId, taskId, after, key]);
  const refresh = useCallback(() => requestRefresh.current(), []);
  return { ...(result.key === key ? result : { snapshot: null, state: 'loading', error: '', checkedAt: null }), refresh };
}
