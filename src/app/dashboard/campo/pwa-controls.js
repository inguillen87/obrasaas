'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import styles from './field.module.css';
function subscribeOnline(callback) {
  window.addEventListener('online', callback); window.addEventListener('offline', callback);
  return () => { window.removeEventListener('online', callback); window.removeEventListener('offline', callback); };
}
export function useDeviceOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
function subscribeDisplay(callback) {
  const display = window.matchMedia('(display-mode: standalone)');
  display.addEventListener('change', callback);
  return () => display.removeEventListener('change', callback);
}
export default function PwaControls() {
  const online = useDeviceOnline();
  const standalone = useSyncExternalStore(subscribeDisplay, () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true, () => false);
  const [prompt, setPrompt] = useState(null), [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false), [registrationState, setRegistrationState] = useState('checking');
  const [waitingWorker, setWaitingWorker] = useState(null);
  useEffect(() => {
    let active = true;
    const beforeInstall = event => { event.preventDefault(); setPrompt(event); };
    const afterInstall = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', beforeInstall); window.addEventListener('appinstalled', afterInstall);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(registration => {
        if (!active) return;
        setRegistrationState('ready');
        if (registration.waiting) setWaitingWorker(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (active && worker.state === 'installed' && registration.waiting) setWaitingWorker(registration.waiting);
          });
        });
      }).catch(() => { if (active) setRegistrationState('failed'); });
    }
    return () => {
      active = false;
      window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', afterInstall);
    };
  }, []);
  async function install() {
    if (!prompt) { setHelp(value => !value); return; }
    try { await prompt.prompt(); await prompt.userChoice; } catch { setHelp(true); }
    finally { setPrompt(null); }
  }
  function update() {
    if (!window.confirm('La actualización recarga la pantalla. Guardá primero cualquier parte pendiente. ¿Actualizar ahora?')) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  }
  return <section className={styles.connection} aria-label="Conexión e instalación">
    <span role="status">{online ? 'Conexión del dispositivo disponible' : 'Sin conexión: todavía no se puede enviar'}</span>
    {!installed && !standalone && <button type="button" onClick={install}>{prompt ? 'Instalar ObraSaaS' : 'Cómo instalar'}</button>}
    {waitingWorker && <button type="button" onClick={update}>Actualizar aplicación</button>}
    {help && <p>En Android: menú del navegador → Instalar aplicación. En iPhone: Compartir → Agregar a inicio. La disponibilidad depende del navegador.</p>}
    {registrationState === 'failed' && <p>No se pudo preparar la pantalla offline. Los registros enviados requieren confirmación del servidor.</p>}
  </section>;
}
