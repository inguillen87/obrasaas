'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import styles from './identity.module.css';

// Loading only controls the provider's display. It does not verify a session,
// consult business data, copy an invitation ticket or submit an operation.
export function IdentityLoadingNotice() {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDelayed(true), 15000);
    return () => clearTimeout(timer);
  }, []);
  return <section className={styles.loading} aria-label="Carga del servicio de acceso">
    <p role={delayed ? 'alert' : 'status'} aria-live="polite">{delayed
      ? 'El servicio de acceso está tardando en cargar. Podés recargar esta página e intentarlo de nuevo.'
      : 'Cargando el servicio de acceso…'}</p>
    {delayed && <>
      <button type="button" className={styles.retry} onClick={() => window.location.reload()}>Recargar acceso</button>
      <p className={styles.loadingHelp}>La recarga mantiene el enlace de esta página. No reenvía cambios de ObraSaaS.</p>
      <Link href="/manual" className={styles.home}>Consultar el manual</Link>
    </>}
  </section>;
}

export function IdentityWidget({ children }) {
  const { isLoaded } = useAuth();
  return isLoaded ? children : <IdentityLoadingNotice />;
}
