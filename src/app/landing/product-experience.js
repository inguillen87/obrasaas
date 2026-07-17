'use client';

import { useEffect, useState } from 'react';

import { ObraSaasMark } from '@/app/brand/brand-logo';
import styles from './landing.module.css';

const steps = [
  {
    id: 'capture',
    short: 'Captura',
    stage: 'Entrada de campo',
    progress: 78,
    delta: 'Sin cambios aún',
    event: 'Reporte recibido',
    assistantTitle: 'Audio capturado',
    assistant: 'Nota de voz recibida desde la cuadrilla. Preparando transcripción y contexto.',
  },
  {
    id: 'context',
    short: 'Contexto',
    stage: 'Interpretación',
    progress: 78,
    delta: 'Evidencia vinculada',
    event: 'Contexto resuelto',
    assistantTitle: 'Reporte estructurado',
    assistant: 'Instalaciones · segundo piso · responsable y evidencia asociados a la obra correcta.',
  },
  {
    id: 'review',
    short: 'Revisión',
    stage: 'Control humano',
    progress: 78,
    delta: 'Cambio pendiente',
    event: 'Propuesta para revisar',
    assistantTitle: 'Avance propuesto: 78% → 84%',
    assistant: 'La actualización queda pendiente hasta que una persona autorizada la apruebe.',
  },
  {
    id: 'record',
    short: 'Registro',
    stage: 'Trazabilidad',
    progress: 84,
    delta: '+6% registrado',
    event: 'Actualización confirmada',
    assistantTitle: 'Gantt y bitácora actualizados',
    assistant: 'Aprobado por Dirección. El cambio quedó registrado y la cuadrilla recibió confirmación.',
  },
];

const fieldMessage = 'Terminamos las cañerías del segundo piso. Quedaron probadas y listas para cerrar.';

export default function ProductExperience() {
  const [active, setActive] = useState(0);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const paused = interactionPaused || userPaused;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion || paused) return undefined;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % steps.length), 2800);
    return () => window.clearInterval(timer);
  }, [active, paused, reducedMotion]);

  const step = steps[active];

  return (
    <div
      className={styles.productShell}
      data-paused={paused || undefined}
      aria-label="Recorrido demostrativo del circuito operativo"
      role="region"
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false);
      }}
    >
      <div className={styles.shellTopbar}>
        <div className={styles.windowDots} aria-hidden="true"><i /><i /><i /></div>
        <span><b className={styles.liveDot} /> Circuito operativo · Obra demostrativa</span>
        <small>Datos simulados</small>
      </div>
      <p className={styles.srOnly} aria-live={paused ? 'polite' : 'off'} aria-atomic="true">
        Etapa {active + 1} de {steps.length}: {step.stage}. {step.assistantTitle}.
      </p>
      <div className={styles.productBody}>
        <div className={styles.controlPanel}>
          <div className={styles.panelHeadline}><div><small>Avance consolidado</small><strong>{step.progress}%</strong></div><span>{step.delta}</span></div>
          <div className={styles.metricRow}><div><span>Frentes activos</span><strong>7</strong><small>2 por validar</small></div><div><span>Alertas</span><strong>03</strong><small>1 crítica</small></div><div><span>Cuadrilla</span><strong>28</strong><small>26 presentes</small></div></div>
          <div className={styles.ganttCard}>
            <div className={styles.ganttHeader}><span>Plan de ejecución</span><small>Semana 24</small></div>
            {[
              ['Estructura', 100, 'done'], ['Instalaciones', step.progress, 'active'], ['Revestimientos', 42, 'active'], ['Terminaciones', 12, 'waiting'],
            ].map(([label, value, status]) => <div className={styles.ganttLine} key={label}><span>{label}</span><div><i className={styles[status]} style={{ width: `${value}%` }} /></div><small>{value}%</small></div>)}
          </div>
          <div className={styles.eventCard} key={step.id}><span className={styles.eventIcon}><ObraSaasMark size={30} /></span><div><small>ObraSaaS Engine</small><strong>{step.event}</strong><p>{step.assistant}</p></div><time>ahora</time></div>
        </div>
        <div className={styles.phoneWrap}>
          <div className={styles.phone}>
            <div className={styles.phoneBar}><span>9:41</span><i /><span>●●●</span></div>
            <div className={styles.chatHeader}><span className={styles.chatAvatar}><ObraSaasMark size={27} /></span><div><strong>Obra demostrativa</strong><small>Cuadrilla · segundo piso</small></div></div>
            <div className={styles.chatBody} key={step.id}>
              <div className={styles.chatSystem}>Hoy</div>
              <div className={styles.chatBubble}><small>Nota de voz recibida</small><p>{fieldMessage}</p><div className={styles.voiceLine}><span className={styles.voicePlay} aria-hidden="true">▶</span><i /><span>0:18</span></div><time>08:41 ✓✓</time></div>
              <div className={styles.botBubble}>
                <span><ObraSaasMark size={18} /></span>
                <div>
                  <strong>{step.assistantTitle}</strong>
                  <p>{step.assistant}</p>
                  {step.id === 'review' && <small className={styles.reviewGate}>Requiere aprobación</small>}
                  {step.id === 'record' && <small className={styles.recordedGate}>Registrado con responsable y hora</small>}
                </div>
                <time>08:41</time>
              </div>
            </div>
            <div className={styles.chatComposer}><span>＋</span><p>Mensaje</p><b>⌁</b></div>
          </div>
        </div>
      </div>
      <div className={styles.demoDisclosure}>
        <span>Recorrido demostrativo</span>
        <small>Muestra el circuito completo; no ejecuta cambios reales.</small>
        <button
          type="button"
          className={styles.demoPause}
          aria-pressed={userPaused}
          onClick={() => setUserPaused((current) => !current)}
        >
          {userPaused ? 'Reanudar' : 'Pausar'}
        </button>
      </div>
      <div className={styles.demoControls} aria-label="Etapas del circuito operativo">
        {steps.map((item, index) => <button type="button" className={index === active ? styles.demoControlActive : undefined} onClick={() => setActive(index)} key={item.id} aria-pressed={index === active}><span>0{index + 1}</span>{item.short}</button>)}
      </div>
    </div>
  );
}
