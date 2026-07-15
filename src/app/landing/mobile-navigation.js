'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <div className={styles.mobileNav}>
      <button
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
        <nav id="mobile-navigation-panel" className={styles.mobileNavPanel} aria-label="Navegación móvil">
          {links.map(([label, href], index) => (
            <a href={href} onClick={() => setOpen(false)} key={href}>
              <span>0{index + 1}</span>{label}
            </a>
          ))}
          <a href="/dashboard" className={styles.mobileNavProduct} onClick={() => setOpen(false)}>
            Abrir plataforma <span aria-hidden="true">→</span>
          </a>
        </nav>
      )}
    </div>
  );
}
