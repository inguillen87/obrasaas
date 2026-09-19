'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tokens } from '@/lib/design-system';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import styles from './platform-preflight-panel.module.css';
export default function PilotWorkspacePanel({ organizationId, projectId }) {
  const router = useRouter(), pending = useRef(false), request = useRef(null), alive = useRef(true);
  const [name, setName] = useState('Piloto Marcelo y Victoria'), [projectName, setProjectName] = useState('Obra piloto - Marcelo y Victoria');
  const [accepted, setAccepted] = useState(false), [state, setState] = useState('idle'), [error, setError] = useState(''), [result, setResult] = useState(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const frozen = ['saving','uncertain','blocked','ready'].includes(state);
  async function submit(event) {
    event.preventDefault(); if (pending.current || !accepted || ['blocked','ready'].includes(state)) return;
    request.current ||= { organizationName: name.trim(), projectName: projectName.trim(), confirmIsolatedPilot: true };
    pending.current = true; setState('saving'); setError('');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch('/api/integrations/whatsapp/pilot-workspace', { method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }) }, body: JSON.stringify(request.current) });
      const body = await response.json().catch(() => null);
      if (!alive.current) return;
      if (!response.ok) { const failure = new Error(typeof body?.error === 'string' ? body.error + (body.code ? ` (${body.code})` : '') : 'Alta no confirmada.'); failure.status = response.status; throw failure; }
      if (body?.context?.organizationId !== organizationId || body.context.projectId !== projectId || body.status !== 'READY_FOR_CONNECTION' || !body.organization?.id || !body.project?.id || body.connectionCreated !== false || body.messagesSent !== false) throw new Error('Respuesta no confirmada para esta obra.');
      setResult(body); setState('ready'); router.refresh();
    } catch (failure) { if (alive.current) { if (failure.status === 400) request.current = null; setState(failure.status === 400 ? 'idle' : [401,403,404,409].includes(failure.status) ? 'blocked' : 'uncertain'); setError(failure.name === 'AbortError' ? 'El alta podría haberse completado. Verificá el mismo intento sin crear otra empresa.' : failure.message); } }
    finally { clearTimeout(timeout); pending.current = false; }
  }
  const css = { '--preflight-bg': tokens.colors.bg.secondary, '--preflight-border': tokens.colors.border.default, '--preflight-accent': tokens.colors.accent.primary, '--preflight-text': tokens.colors.text.primary, '--preflight-muted': tokens.colors.text.secondary };
  return <section className={styles.panel} style={css} aria-labelledby="pilot-workspace-heading">
    <header className={styles.header}><div><span>PILOTO AISLADO · SOLO PREVIEW</span><h2 id="pilot-workspace-heading">Preparar la empresa y su obra piloto</h2><p>La administración interna no es una empresa cliente. Creá un espacio separado antes de vincular el número de prueba.</p></div></header>
    <form onSubmit={submit} className={styles.pilotForm}>
      <label>Empresa piloto<input aria-label="Empresa piloto" minLength={3} maxLength={100} required value={name} disabled={frozen} onChange={event => setName(event.target.value)} /></label>
      <label>Obra del piloto<input aria-label="Obra del piloto" minLength={3} maxLength={100} required value={projectName} disabled={frozen} onChange={event => setProjectName(event.target.value)} /></label>
      <label className={styles.pilotConsent}><input type="checkbox" checked={accepted} disabled={frozen} onChange={event => setAccepted(event.target.checked)} />Confirmo crear una organización y una obra de prueba, con acceso del titular. No copiar datos, enviar invitaciones ni activar pagos.</label>
      <button type="submit" disabled={!accepted || ['saving','blocked','ready'].includes(state)}>{state === 'saving' ? 'Preparando espacio aislado…' : state === 'uncertain' ? 'Verificar el mismo intento' : state === 'ready' ? 'Piloto preparado' : 'Crear empresa piloto'}</button>
    </form>
    <p className={styles.scope}>El alta usa la identidad autenticada y mantiene separados los datos. Repetir el mismo intento recupera el mismo espacio. No conecta WhatsApp, no crea trabajadores y no cambia planes de otros clientes.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {result && <div className={styles.results}><article><h3>{result.organization.name}</h3><p>{result.project.name}</p><strong>Destino preparado</strong><p role="status">Ahora podés seleccionar esta empresa y obra en la importación del número piloto.</p></article></div>}
  </section>;
}
