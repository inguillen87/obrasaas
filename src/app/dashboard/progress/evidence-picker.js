'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { EVIDENCE_ACCEPT, EVIDENCE_STAGES, evidenceFileSize, evidenceSelectionIssue } from '@/lib/evidence-capture-policy';
import styles from './evidence-picker.module.css';
function LocalPreview({ file }) {
  const image = useRef(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/') || !image.current) return;
    const url = URL.createObjectURL(file); image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!file.type.startsWith('image/') || failed) return <div className={styles.fileIcon} aria-hidden="true">{file.type === 'application/pdf' ? 'PDF' : file.type === 'video/mp4' ? 'MP4' : 'ARCHIVO'}</div>;
  // Local blob preview: no optimization proxy and no network upload at this stage.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt="Vista previa local del archivo seleccionado" className={styles.preview} onError={() => setFailed(true)} />;
}
export default function EvidencePicker({ tasks, workers, projectName, file, taskId, authorId, caption, stage, feedback, savedId,
  disabled, fileInputRef, onFile, onTask, onAuthor, onCaption, onSubmit, onReset, onLeave }) {
  const pickerId = useId(), cameraId = useId();
  const locked = disabled || ['uploading', 'attaching', 'unconfirmed', 'context'].includes(stage);
  const issue = file ? evidenceSelectionIssue(file) : null;
  const task = tasks.find(item => item.id === taskId);
  const canSend = file && !issue && task && !disabled && !['uploading', 'attaching'].includes(stage);
  return <section className={styles.capture} id="capture-evidence" aria-labelledby={pickerId + '-title'}>
    <header><span className={styles.eyebrow}>EVIDENCIA DE OBRA</span><h2 id={pickerId + '-title'}>De la foto a la revisión</h2><p>{projectName}</p></header>
    <ol className={styles.steps} aria-label="Etapas de la evidencia"><li aria-current={['ready','error'].includes(stage) ? 'step' : undefined}>01 · Preparar</li><li aria-current={stage === 'uploading' ? 'step' : undefined}>02 · Transferir</li><li aria-current={stage === 'attaching' ? 'step' : undefined}>03 · Registrar</li><li aria-current={stage === 'saved' ? 'step' : undefined}>04 · Revisar</li></ol>
    {tasks.length === 0 && <div className={styles.empty}><strong>Esta obra todavía no tiene una tarea para vincular la evidencia.</strong><p>Pedí al responsable que prepare el cronograma. No se crean tareas ni avances automáticamente.</p></div>}
    <form onSubmit={onSubmit}>
      <fieldset disabled={locked || tasks.length === 0} className={styles.fields}>
        <label>Tarea de la evidencia<select aria-label="Tarea vinculada a la evidencia" required value={taskId} onChange={event => onTask(event.target.value)}><option value="">Elegí una tarea de esta obra</option>{tasks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <div className={styles.fileArea}>
          <label htmlFor={pickerId} className={styles.fileLabel}>Elegir archivo del dispositivo</label>
          <input ref={fileInputRef} id={pickerId} aria-label="Archivo de evidencia" type="file" accept={EVIDENCE_ACCEPT} onChange={event => { const selected = event.target.files?.[0]; if (selected) onFile(selected); }} />
          <label htmlFor={cameraId} className={styles.camera}>Tomar foto<input id={cameraId} aria-label="Tomar foto de evidencia" className={styles.srOnly} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => { const selected = event.target.files?.[0]; if (selected) onFile(selected); event.target.value = ''; }} /></label>
          <small>JPG, PNG, WebP, PDF o MP4 breve · máximo 4 MiB. La cámara depende del dispositivo y navegador.</small>
        </div>
        {file && <div className={styles.selected}>
          {!issue && <LocalPreview key={file.name + ':' + file.size + ':' + file.lastModified} file={file} />}
          <div><strong>{file.name}</strong><p>{evidenceFileSize(file.size)} · {file.type || 'Formato no informado'}</p><small>Vista local: seleccionar no sube ni guarda el archivo.</small></div>
          <button type="button" className={styles.clear} onClick={() => onFile(null)}>Quitar archivo</button>
        </div>}
        {issue && <p className={styles.error} role="alert">{issue}</p>}
        <label>Descripción de la evidencia<textarea aria-label="Descripción de la evidencia" value={caption} onChange={event => onCaption(event.target.value)} maxLength={2000} rows={3} placeholder="Qué muestra la imagen y qué debe revisar el responsable" /></label>
        <label>Persona informada — opcional<select aria-label="Persona informada en la evidencia" value={authorId} onChange={event => onAuthor(event.target.value)}><option value="">Sin persona asignada</option>{workers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </fieldset>
      {feedback && <div className={['error','context'].includes(stage) ? styles.error : styles.feedback} role={['error','context'].includes(stage) ? 'alert' : 'status'}><strong>{EVIDENCE_STAGES[stage]}</strong><p>{feedback}</p></div>}
      {stage === 'saved' && savedId && <a className={styles.savedLink} href={'#evidence-' + encodeURIComponent(savedId)}>Ver evidencia guardada y su estado</a>}
      {['uploading','attaching'].includes(stage) && <p role="status" className={styles.processing}>{EVIDENCE_STAGES[stage]} No cierres esta pantalla.</p>}
      {['unconfirmed','context'].includes(stage) && <p>La selección queda protegida para no duplicar archivos. La transferencia o el registro podrían haberse completado; no los damos por confirmados.</p>}
      <button className={styles.submit} type="submit" disabled={!canSend}>{stage === 'context' ? 'Reintentar en la obra original' : stage === 'unconfirmed' ? 'Reintentar la misma evidencia' : ['uploading','attaching'].includes(stage) ? EVIDENCE_STAGES[stage] : 'Guardar evidencia para revisión'}</button>
      {file && !locked && <button className={styles.reset} type="button" onClick={onReset}>Limpiar selección</button>}
    </form>
    <p className={styles.disclaimer}>La revisión de esta evidencia no certifica automáticamente avance, calidad estructural ni pagos. No adjuntes documentos personales o médicos en este circuito.</p>
    <Link onNavigate={onLeave} href="/dashboard/campo" className={styles.back}>Volver a Campo móvil</Link>
  </section>;
}
