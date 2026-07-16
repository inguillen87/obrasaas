'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import styles from './landing.module.css';

const links = [
  ['Producto', '#producto'],
  ['Plataforma', '#plataforma'],
  ['Sectores', '#sectores'],
  ['Precios', '#precios'],
  ['Preguntas', '#preguntas'],
];

export default function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => {
      panelRef.current?.querySelector('a')?.focus();
    });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panelRef.current?.querySelectorAll('a[href]') || []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.mobileNav}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.mobileNavTrigger}
        aria-expanded={open}
        aria-controls="mobile-navigation-panel"
        aria-label={open ? 'Cerrar navegación' : 'Abrir navegación'}
        onClick={() => setOpen((current) => !current)}
      >
        <span /><span /><span />
      </button>
      {open && (
        <nav ref={panelRef} id="mobile-navigation-panel" className={styles.mobileNavPanel} aria-label="Navegación móvil">
          {links.map(([label, href], index) => (
            <a href={href} onClick={() => setOpen(false)} key={href}>
              <span>0{index + 1}</span>{label}
            </a>
          ))}
          <Link href="/sign-up" className={styles.mobileNavProduct} onClick={() => setOpen(false)}>
            Probar 14 días <span aria-hidden="true">→</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
