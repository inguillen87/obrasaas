'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { searchWorkspaceNavigation } from '@/lib/workspace-navigation-search';
import { requestWorkspaceNavigation } from '@/lib/workspace-leave-policy';
import { tokens } from '@/lib/design-system';
import styles from './workspace-navigator.module.css';
const OPEN_EVENT = 'obrasaas:open-workspace-navigator';
export function NavigationLauncher({ compact = false }) {
  return <button type="button" className={compact ? styles.compact : styles.launcher} aria-label="Buscar sección" aria-haspopup="dialog"
    onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
    <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
    {!compact && <><span>Buscar sección</span><kbd>Ctrl K</kbd></>}
  </button>;
}
export default function WorkspaceNavigator({ catalog, projectName, roleLabel, onOpen }) {
  const dialogRef = useRef(null), inputRef = useRef(null), previousFocus = useRef(null);
  const [opened, setOpened] = useState(false), [query, setQuery] = useState(''), [notice, setNotice] = useState('');
  const headingId = useId(), helpId = useId();
  const results = searchWorkspaceNavigation(catalog, query);
  const close = () => { dialogRef.current?.close(); setOpened(false); };
  useEffect(() => {
    const open = () => {
      if (dialogRef.current?.open) { inputRef.current?.focus(); return; }
      if (document.querySelector('dialog[open]')) return;
      previousFocus.current = document.activeElement;
      onOpen?.(); setQuery(''); setNotice(''); setOpened(true);
    };
    const keyboard = event => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k' && !event.defaultPrevented) {
        event.preventDefault(); open();
      }
    };
    window.addEventListener(OPEN_EVENT, open); window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener(OPEN_EVENT, open); window.removeEventListener('keydown', keyboard); };
  }, [onOpen]);
  useEffect(() => {
    if (!opened) return undefined;
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal(); inputRef.current?.focus();
    return () => { dialog.close(); document.body.style.overflow = overflow; previousFocus.current?.focus?.(); };
  }, [opened]);
  function navigate(event) {
    if (!requestWorkspaceNavigation('route')) {
      event.preventDefault(); setNotice('Continuás en la misma pantalla. Guardá los cambios o esperá que termine la operación.'); return;
    }
    close();
  }
  function resultKeys(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'Tab') {
      const focusable = Array.from(dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const links = Array.from(dialogRef.current.querySelectorAll('[data-nav-result]'));
    if (!links.length) return;
    const index = links.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % links.length : index <= 0 ? links.length - 1 : index - 1;
    event.preventDefault(); links[next].focus();
  }
  if (!opened) return null;
  return createPortal(<dialog ref={dialogRef} className={styles.dialog} aria-labelledby={headingId} aria-describedby={helpId}
    style={{ '--nav-bg': tokens.colors.bg.secondary, '--nav-border': tokens.colors.border.default, '--nav-accent': tokens.colors.accent.primary }}
    onCancel={close} onClose={() => { if (!dialogRef.current?.open) setOpened(false); }} onKeyDown={resultKeys}>
    <header className={styles.header}><div><p>OBRASAAS · ESPACIO DE TRABAJO</p><h2 id={headingId}>¿Dónde querés continuar?</h2></div>
      <button type="button" className={styles.close} aria-label="Cerrar buscador" onClick={close}>×</button></header>
    <div className={styles.context}><span>{projectName}</span><span>{roleLabel}</span></div>
    <label className={styles.search}><span className="sr-only">Buscar sección por nombre o actividad</span>
      <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
      <input ref={inputRef} type="search" value={query} maxLength={120} placeholder="Probá: fotos, materiales, roles…" autoComplete="off" onChange={e => setQuery(e.target.value)} />
    </label>
    <p id={helpId} className={styles.help}>Accesos de tu rol. Buscás secciones, no documentos ni datos de otras obras.</p>
    <p className={styles.count} role="status">{results.length} {results.length === 1 ? 'sección disponible' : 'secciones disponibles'}{notice ? ' · ' + notice : ''}</p>
    <nav className={styles.results} aria-label="Resultados de navegación">
      {results.length === 0 && <div className={styles.empty}><strong>No encontramos esa sección.</strong><p>Probá otra palabra o revisá los accesos disponibles para tu rol.</p><button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>Ver todas las secciones</button></div>}
      {results.map(item => {
        const content = <><span className={styles.icon}><i className={item.icon} aria-hidden="true" /></span><span className={styles.text}><strong>{item.label}</strong><small>{item.description}</small></span><span className={styles.group}>{item.group}</span><span aria-hidden="true">↗</span></>;
        return item.hardNavigation
          ? <a key={item.key} data-nav-result href={item.href} className={styles.result} onClick={navigate}>{content}</a>
          : <Link key={item.key} data-nav-result href={item.href} prefetch={false} className={styles.result} onNavigate={navigate}>{content}</Link>;
      })}
    </nav>
    <footer className={styles.footer}><span>↑ ↓ para recorrer · Enter para abrir</span><span>Esc para cerrar</span></footer>
  </dialog>, document.body);
}
