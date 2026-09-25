'use client';
import { useEffect, useId, useRef, useState } from 'react';
import ProactiveFlowHistory from './proactive-flow-history';
import styles from './conversation-followup-panel.module.css';

// A read-only workspace: identity/network changes discard observations, never
// remount or reset the sibling composer, send consent or uncertain write attempt.
export default function ConversationFollowupPanel(props) {
  return <ScopedPanel key={JSON.stringify([props.organizationId, props.projectId, props.conversationId, props.online !== false])} {...props}/>;
}
function ScopedPanel({ organizationId, projectId, conversationId, contactName, projectName, online = true }) {
  const [open, setOpen] = useState(false);
  const titleId = useId(), dialogId = useId(), dialog = useRef(null), heading = useRef(null), trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current, opener = trigger.current, root = document.documentElement;
    const previousOverflow = root.style.overflow;
    element.showModal(); root.style.overflow = 'hidden'; heading.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      if (root.style.overflow === 'hidden') root.style.overflow = previousOverflow;
      if (opener?.isConnected && !opener.disabled) opener.focus({ preventScroll: true });
    };
  }, [open]);
  function keepFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]')]
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1), current = document.activeElement;
    if (!first) { event.preventDefault(); heading.current?.focus(); }
    else if (event.shiftKey && (current === first || current === heading.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && current === last) { event.preventDefault(); first.focus(); }
  }
  return <>
    <button ref={trigger} type="button" className={styles.trigger} disabled={!online}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined}
      aria-label="Abrir seguimiento de formularios" onClick={() => setOpen(true)}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v15a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2h-3M8 3v4h8V3H8ZM7 12h10M7 16h7"/></svg>
      <span>Seguimiento</span>
    </button>
    {open && <dialog ref={dialog} id={dialogId} className={styles.dialog} aria-labelledby={titleId}
      onKeyDown={keepFocus} onCancel={event => { event.preventDefault(); setOpen(false); }}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>ACTIVIDAD DE LA CONVERSACIÓN</span>
          <h2 ref={heading} id={titleId} tabIndex={-1}>Seguimiento de formularios</h2>
        </div>
        <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Cerrar panel de seguimiento">×</button>
      </header>
      <div className={styles.context} aria-label="Contexto del seguimiento"><strong>{contactName}</strong><span>Obra: {projectName}</span></div>
      <div className={styles.body}>
        <ProactiveFlowHistory organizationId={organizationId} projectId={projectId} conversationId={conversationId} online={online} embedded startExpanded/>
      </div>
      <footer className={styles.footer}><span>Consulta de registros. No envía mensajes ni aprueba operaciones.</span>
        <button type="button" onClick={() => setOpen(false)}>Volver a la conversación</button>
      </footer>
    </dialog>}
  </>;
}
