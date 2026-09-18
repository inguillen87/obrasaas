'use client';
import { useId, useState } from 'react';
import styles from './progress-context-panel.module.css';

export default function ProgressContextPanel({ projectName, changed = false, busy = false, draftText = '', hasUnsaved = false }) {
  const titleId = useId();
  const [copyStatus, setCopyStatus] = useState('');
  async function copyDraft() {
    try { await navigator.clipboard.writeText(draftText); setCopyStatus('Texto copiado. El archivo adjunto no se copia: conservá su original.'); }
    catch { setCopyStatus('No se pudo copiar. Seleccioná el texto del formulario antes de salir.'); }
  }
  function reload() {
    if (busy) return;
    if (hasUnsaved && !window.confirm('Esta recarga descarta el texto y el archivo locales sin confirmar. Copiá lo necesario antes de continuar. ¿Recargar?')) return;
    window.location.reload();
  }
  return <section className={`${styles.panel} ${changed ? styles.changed : ''}`} aria-labelledby={titleId}>
    <div className={styles.context}>
      <span className={styles.eyebrow}>CONTEXTO DEL REGISTRO</span>
      <h2 id={titleId}>{projectName}</h2>
      <p>Los envíos se comparan con la empresa y la obra activas en tu sesión.</p>
    </div>
    <ol className={styles.steps} aria-label="Circuito de la bitácora">
      <li><span>01</span> Registrar</li><li><span>02</span> Enviar a revisión</li><li><span>03</span> Decisión autorizada</li>
    </ol>
    {changed && <div className={styles.warning}>
      <div role="alert"><h3>La obra activa cambió</h3><p>Esta pantalla conserva la obra anterior. Bloqueamos nuevas operaciones desde aquí; el texto y la selección de archivo permanecen en esta pestaña.</p></div>
      <p>No recargues antes de conservar lo que necesites. El borrador local no equivale a un guardado en el servidor.</p>
      <div className={styles.actions}>
        {draftText.trim() && <button type="button" onClick={copyDraft}>Copiar texto del borrador</button>}
        <a href="/dashboard/progress" target="_blank" rel="noopener noreferrer">Ver obra activa en otra pestaña</a>
        <button type="button" disabled={busy} onClick={reload}>Recargar esta bitácora</button>
      </div>
      <p role="status" className={styles.copyStatus}>{copyStatus}</p>
    </div>}
  </section>;
}
