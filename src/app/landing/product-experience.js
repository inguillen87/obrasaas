'use client';

import { useEffect, useState } from 'react';

import { ObraSaasMark } from '@/app/brand/brand-logo';
import styles from './landing.module.css';

const steps = [
  { id: 'report', short: 'Reporte', kind: 'voice', label: 'Nota de voz recibida', message: 'Terminamos las cañerías del segundo piso. Quedaron probadas y listas para cerrar.', assistant: 'Reporte transcripto · Evidencia vinculada · Requiere confirmación escrita', progress: 84, event: 'Propuesta pendiente' },
  { id: 'risk', short: 'Riesgo', kind: 'voice', label: 'Bloqueo detectado', message: 'El proveedor confirmó que los revestimientos llegan recién el jueves.', assistant: 'Posible demora logística · Sin reprogramación automática · Requiere confirmación', progress: 84, event: 'Demora propuesta' },
  { id: 'stock', short: 'Acopio', kind: 'voice', label: 'Stock bajo mínimo', message: 'Quedan 35 bolsas de cemento. Mañana arranca el revoque del frente norte.', assistant: 'Riesgo de stock detectado · Compra no emitida · Revisión pendiente', progress: 91, event: 'Revisión solicitada' },
  { id: 'attendance', short: 'Flow', kind: 'flow', label: 'Control de ingreso', message: 'Persona de ejemplo · Cuadrilla', assistant: 'EPP confirmado · Ubicación todavía pendiente · Sin presentismo registrado', progress: 91, event: 'Fichaje iniciado' },
];

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
    const timer = window.setInterval(() => setActive((current) => (current + 1) % steps.length), 4800);
    return () => window.clearInterval(timer);
  }, [active, paused, reducedMotion]);

  const step = steps[active];

  return (
    <div
      className={styles.productShell}
      data-paused={paused || undefined}
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false);
      }}
    >
      <div className={styles.shellTopbar}>
        <div className={styles.windowDots} aria-hidden="true"><i /><i /><i /></div>
        <span><b className={styles.liveDot} /> Centro de control · Obra demostrativa</span>
        <small>Datos simulados</small>
      </div>
      <div className={styles.productBody}>
        <div className={styles.controlPanel}>
          <div className={styles.panelHeadline}><div><small>Avance consolidado</small><strong>{step.progress}%</strong></div><span>+6,4% esta semana</span></div>
          <div className={styles.metricRow}><div><span>Frentes activos</span><strong>7</strong><small>2 por validar</small></div><div><span>Alertas</span><strong>03</strong><small>1 crítica</small></div><div><span>Cuadrilla</span><strong>28</strong><small>26 presentes</small></div></div>
          <div className={styles.ganttCard}>
            <div className={styles.ganttHeader}><span>Plan de ejecución</span><small>Semana 24</small></div>
            {[
              ['Estructura', 100, 'done'], ['Instalaciones', step.progress, 'active'], ['Revestimientos', active === 1 ? 28 : 42, active === 1 ? 'risk' : 'active'], ['Terminaciones', 12, 'waiting'],
            ].map(([label, value, status]) => <div className={styles.ganttLine} key={label}><span>{label}</span><div><i className={styles[status]} style={{ width: `${value}%` }} /></div><small>{value}%</small></div>)}
          </div>
          <div className={styles.eventCard} key={step.id}><span className={styles.eventIcon}><ObraSaasMark size={30} /></span><div><small>ObraSaaS Engine</small><strong>{step.event}</strong><p>{step.assistant}</p></div><time>ahora</time></div>
        </div>
        <div className={styles.phoneWrap}>
          <div className={styles.phone}>
            <div className={styles.phoneBar}><span>9:41</span><i /><span>●●●</span></div>
            <div className={styles.chatHeader}><span className={styles.chatAvatar}><ObraSaasMark size={27} /></span><div><strong>Obra demostrativa</strong><small>ObraSaaS · escenario simulado</small></div></div>
            <div className={styles.chatBody} key={step.id}>
              <div className={styles.chatSystem}>Hoy</div>
              {step.kind === 'flow' ? (
                <div className={styles.flowMessage}>
                  <div className={styles.flowMessageTopline}><span>WhatsApp Flow</span><small>Seguro</small></div>
                  <strong>{step.label}</strong>
                  <p>Confirmá los datos del turno sin salir del chat.</p>
                  <div className={styles.flowField}><span>Persona</span><b>Identidad autorizada</b></div>
                  <div className={styles.flowField}><span>Frente</span><b>Cuadrilla · PB</b></div>
                  <div className={styles.flowField}><span>Ubicación</span><b>Pendiente de informar</b></div>
                  <span className={styles.flowSubmit}>Continuar al control de ubicación</span>
                  <time>08:41 ✓✓</time>
                </div>
              ) : (
                <div className={styles.chatBubble}><small>{step.label}</small><p>{step.message}</p><div className={styles.voiceLine}><span className={styles.voicePlay} aria-hidden="true">▶</span><i /><span>0:18</span></div><time>08:41 ✓✓</time></div>
              )}
              <div className={styles.botBubble}><span>✦</span><div><strong>Procesado por ObraSaaS</strong><p>{step.assistant}</p></div><time>08:41</time></div>
            </div>
            <div className={styles.chatComposer}><span>＋</span><p>Mensaje</p><b>⌁</b></div>
          </div>
        </div>
      </div>
      <div className={styles.demoDisclosure}>
        <span>Escenario demostrativo</span>
        <small>Simula el flujo completo; no ejecuta cambios reales.</small>
        <button
          type="button"
          className={styles.demoPause}
          aria-pressed={userPaused}
          onClick={() => setUserPaused((current) => !current)}
        >
          {userPaused ? 'Reanudar' : 'Pausar'}
        </button>
      </div>
      <div className={styles.demoControls} aria-label="Escenarios demostrativos">
        {steps.map((item, index) => <button type="button" className={index === active ? styles.demoControlActive : undefined} onClick={() => setActive(index)} key={item.id} aria-pressed={index === active}><span>0{index + 1}</span>{item.short}</button>)}
      </div>
    </div>
  );
}
