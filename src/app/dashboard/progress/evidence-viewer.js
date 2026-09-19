'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { fetchEvidencePreview } from '@/lib/evidence-viewer-policy';
import { progressReviewAttachmentHref } from '@/lib/progress-review-policy';
import { tokens } from '@/lib/design-system';
import styles from './evidence-viewer.module.css';
const STATUS = { PENDING: 'Pendiente de revisión', APPROVED: 'Aprobada', REJECTED: 'Rechazada' };
export default function EvidenceViewer({ item, organizationId, projectId, projectName, taskTitle, onClose }) {
  const dialog = useRef(null), closeButton = useRef(null);
  const titleId = useId(), descriptionId = useId();
  const [imageUrl, setImageUrl] = useState(null), [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0), [zoom, setZoom] = useState(1), [decoded, setDecoded] = useState(false);
  const original = progressReviewAttachmentHref(item);
  useEffect(() => {
    const target = dialog.current, previous = document.activeElement;
    target.showModal(); closeButton.current?.focus();
    return () => { target.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true, createdUrl;
    const timeout = setTimeout(() => controller.abort(), 20000);
    fetchEvidencePreview(item, { organizationId, projectId }, { signal: controller.signal }).then(blob => {
      if (!active) return;
      createdUrl = URL.createObjectURL(blob); setImageUrl(createdUrl);
    }).catch(error => {
      if (active) setLoadError({ code: error.code, message: error.name === 'AbortError' ? 'La consulta demoró demasiado. Podés reintentar sin volver a subir el archivo.' : error.message });
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); if (createdUrl) URL.revokeObjectURL(createdUrl); };
  }, [item, organizationId, projectId, attempt]);
  function retry() { setLoadError(null); setImageUrl(null); setDecoded(false); setZoom(1); setAttempt(value => value + 1); }
  function keydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.current.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  const ready = Boolean(imageUrl && decoded && !loadError);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    style={{ '--viewer-bg': tokens.colors.bg.secondary, '--viewer-accent': tokens.colors.accent.primary }}
    onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={keydown}>
    <header className={styles.header}><div><span className={styles.eyebrow}>ARCHIVO PRIVADO · CONSULTA</span><h2 id={titleId}>Evidencia de obra</h2><p>{projectName}</p></div>
      <button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar visor de evidencia">×</button></header>
    <section className={styles.context}><strong>{item.caption || 'Imagen sin descripción'}</strong><p>Tarea: {taskTitle || item.taskId}</p>
      <div className={styles.metadata}><span>{STATUS[item.status] || 'Estado no reconocido'}</span><span>Versión {item.revision}</span><span>{item.attachment?.filename || 'Archivo de imagen'}</span></div>
    </section>
    <div className={styles.toolbar} aria-label="Controles de imagen">
      <button type="button" disabled={!ready || zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .5))}>Alejar</button>
      <output aria-label="Ampliación">{Math.round(zoom * 100)}%</output>
      <button type="button" disabled={!ready || zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + .5))}>Acercar</button>
      <button type="button" disabled={!ready} onClick={() => setZoom(1)}>Ajustar</button>
    </div>
    <div className={styles.stage} tabIndex={ready ? 0 : undefined} role="region" aria-label="Imagen privada de la obra" aria-busy={!ready && !loadError}>
      {!ready && !loadError && <p className={styles.loading} role="status">Consultando archivo privado…</p>}
      {imageUrl && !loadError && <div className={styles.imageCanvas} style={{ width: `${zoom * 100}%`, visibility: decoded ? 'visible' : 'hidden' }}>
        {/* Bytes fetched with session and context; never sent to an image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={item.caption || 'Evidencia de la tarea de obra'} draggable={false}
          onLoad={event => {
            if (event.currentTarget.naturalWidth * event.currentTarget.naturalHeight > 40_000_000) setLoadError({ code: 'EVIDENCE_PREVIEW_DIMENSIONS', message: 'La imagen es demasiado grande para este visor. Conservá el original sin modificarlo.' });
            else setDecoded(true);
          }} onError={() => setLoadError({ code: 'EVIDENCE_PREVIEW_DECODE', message: 'El archivo no pudo visualizarse como imagen. No se modificó ni se volvió a subir.' })} />
      </div>}
      {loadError && <div className={styles.error} role="alert"><strong>No se pudo mostrar la imagen</strong><p>{loadError.message}</p>
        {loadError.code !== 'EVIDENCE_PREVIEW_CONTEXT' && <button type="button" onClick={retry}>Reintentar consulta</button>}
      </div>}
    </div>
    {item.reviewNote && <aside className={styles.review}><strong>{item.status === 'REJECTED' ? 'Motivo del rechazo' : 'Nota de revisión'}</strong><p>{item.reviewNote}</p></aside>}
    <footer className={styles.footer}><p id={descriptionId}>Consultar o ampliar no modifica la imagen ni aprueba el registro. El estado mostrado corresponde a la tarjeta abierta.</p>
      {original && <a href={original} target="_blank" rel="noopener noreferrer">Abrir archivo original</a>}
      <button type="button" onClick={onClose}>Volver a la bitácora</button>
    </footer>
  </dialog>;
}
