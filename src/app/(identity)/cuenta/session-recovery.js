'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { safeRecoverySignInPath, verifyFreshSession } from '../../../lib/session-recovery.mjs';
import styles from '../identity.module.css';

const messages = {
  loading: 'Estamos comprobando tu acceso. Todavía no se consultaron datos de tus obras.',
  checking: 'Renovando y comprobando tu sesión…',
  refreshed: 'Volvemos a comprobar tu cuenta en el servidor. Si no se abre, podés intentarlo de nuevo.',
  contextChanged: 'Cambió la cuenta o la organización. Volvé a verificar el acceso antes de continuar.',
  SESSION_RECOVERY_REQUIRED: 'Tu acceso no pudo renovarse. Volvé a ingresar para abrir tu cuenta.',
  SESSION_RECOVERY_UNAVAILABLE: 'El servicio de acceso no respondió. Podés volver a verificar; no se modificó ninguna operación.',
  SESSION_RECOVERY_COOKIE_PENDING: 'No se pudo sincronizar el acceso en este navegador. Volvé a verificar o ingresá nuevamente.',
  SESSION_RECOVERY_SDK_TIMEOUT: 'El servicio de acceso está tardando en cargar. Podés recargar la página o volver a ingresar.',
};

export function SessionRecovery({ signInPath = '/sign-in', initialCode = 'SESSION_REQUIRED' }) {
  const { isLoaded, isSignedIn, userId, sessionId, orgId, getToken } = useAuth();
  const router = useRouter();
  const destination = safeRecoverySignInPath(signInPath);
  const context = JSON.stringify([userId || null, sessionId || null, orgId || null]);
  const [phase, setPhase] = useState(initialCode === 'IDENTITY_PROVIDER_UNAVAILABLE' ? 'SESSION_RECOVERY_UNAVAILABLE' : 'loading');
  const mounted = useRef(false), generation = useRef(0), controller = useRef(null);
  const activeContext = useRef(context), automaticAttempted = useRef(false), redirected = useRef(false);

  useEffect(() => {
    const epoch = generation, pending = controller;
    mounted.current = true;
    return () => { mounted.current = false; epoch.current++; pending.current?.abort(); };
  }, []);
  useEffect(() => {
    if (isLoaded) return;
    const timeout = setTimeout(() => {
      if (mounted.current) setPhase('SESSION_RECOVERY_SDK_TIMEOUT');
    }, 15000);
    return () => clearTimeout(timeout);
  }, [isLoaded]);
  useEffect(() => {
    if (activeContext.current !== context) {
      activeContext.current = context;
      generation.current++;
      controller.current?.abort();
      setPhase('contextChanged');
    }
  }, [context]);

  const recover = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !mounted.current) return;
    controller.current?.abort();
    const abort = new AbortController(), currentGeneration = ++generation.current;
    controller.current = abort;
    const current = () => mounted.current && activeContext.current === context && generation.current === currentGeneration;
    const timeout = setTimeout(() => abort.abort(), 15000);
    setPhase('checking');
    try {
      await verifyFreshSession({ getToken, readCookie: () => document.cookie,
        signal: abort.signal, isCurrent: current });
      if (!current()) return;
      setPhase('refreshed');
      // A refresh only asks the server to verify again. This component never
      // renders the workspace based on the client's verification result.
      router.refresh();
    } catch (error) {
      if (current()) setPhase(error.code === 'SESSION_RECOVERY_ABORTED' ? 'SESSION_RECOVERY_UNAVAILABLE' : messages[error.code] ? error.code : 'SESSION_RECOVERY_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
      if (controller.current === abort) controller.current = null;
    }
  }, [isLoaded, isSignedIn, context, getToken, router]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      if (!redirected.current) { redirected.current = true; router.replace(destination); }
      return;
    }
    if (!automaticAttempted.current && initialCode !== 'IDENTITY_PROVIDER_UNAVAILABLE') {
      automaticAttempted.current = true;
      void recover();
    }
  }, [isLoaded, isSignedIn, initialCode, destination, recover, router]);

  const busy = (!isLoaded && phase !== 'SESSION_RECOVERY_SDK_TIMEOUT') || phase === 'checking';
  return <div>
    <h1>Verificá tu acceso</h1>
    <p className={styles.lead} role={busy || phase === 'loading' || phase === 'refreshed' ? 'status' : 'alert'} aria-live="polite">{messages[phase]}</p>
    {isLoaded && isSignedIn && <button type="button" className={styles.retry} disabled={busy} onClick={() => void recover()}>{busy ? 'Verificando…' : 'Volver a verificar'}</button>}
    {!isLoaded && phase === 'SESSION_RECOVERY_SDK_TIMEOUT' && <button type="button" className={styles.retry} onClick={() => window.location.reload()}>Recargar página</button>}
    <p><Link href={destination} className={styles.home}>Volver a ingresar</Link></p>
    <p className={styles.note}>La renovación del acceso no reenvía cambios ni habilita operaciones pendientes.</p>
  </div>;
}
