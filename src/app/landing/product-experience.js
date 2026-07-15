'use client';

import { useEffect, useState } from 'react';
import styles from './landing.module.css';

const steps = [
  { id: 'report', short: 'Reporte', label: 'Nota de voz recibida', message: 'Terminamos las cañerías del segundo piso. Quedaron probadas y listas para cerrar.', assistant: 'Avance identificado · Instalaciones sanitarias · Evidencia vinculada', progress: 84, event: 'Tarea actualizada' },
  { id: 'risk', short: 'Riesgo', label: 'Bloqueo detectado', message: 'El proveedor confirmó que los revestimientos llegan recién el jueves.', assistant: 'Demora logística · Impacto estimado: 2 días · Requiere aprobación', progress: 84, event: 'Replanificación propuesta' },
  { id: 'stock', short: 'Acopio', label: 'Stock bajo mínimo', message: 'Quedan 35 bolsas de cemento. Mañana arranca el revoque del frente norte.', assistant: 'Riesgo de quiebre · Proveedor homologado · Orden preparada', progress: 91, event: 'Aprobación solicitada' },
  { id: 'attendance', short: 'Personal', label: 'Ingreso validado', message: 'Juan compartió su ubicación desde el acceso principal de la obra.', assistant: 'Dentro de geocerca · 08:02 · Registro asociado al operario', progress: 91, event: 'Presentismo confirmado' },
];

export default function ProductExperience() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return undefined;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % steps.length), 4800);
    return () => window.clearInterval(timer);
  }, []);

  const step = steps[active];

  return (
    <div className={styles.productShell}>
      <div className={styles.shellTopbar}>
        <div className={styles.windowDots} aria-hidden="true"><i /><i /><i /></div>
        <span><b className={styles.liveDot} /> Centro de control · Obra Palermo</span>
        <small>Sincronizado ahora</small>
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
          <div className={styles.eventCard} key={step.id}><span className={styles.eventIcon}>OS</span><div><small>ObraSaaS Engine</small><strong>{step.event}</strong><p>{step.assistant}</p></div><time>ahora</time></div>
        </div>
        <div className={styles.phoneWrap}>
          <div className={styles.phone}>
            <div className={styles.phoneBar}><span>9:41</span><i /><span>●●●</span></div>
            <div className={styles.chatHeader}><span className={styles.chatAvatar}>OS</span><div><strong>Obra Palermo</strong><small>ObraSaaS · en línea</small></div></div>
            <div className={styles.chatBody} key={step.id}>
              <div className={styles.chatSystem}>Hoy</div>
              <div className={styles.chatBubble}><small>{step.label}</small><p>{step.message}</p><div className={styles.voiceLine}><button type="button" aria-label="Reproducir nota de voz">▶</button><i /><span>0:18</span></div><time>08:41 ✓✓</time></div>
              <div className={styles.botBubble}><span>✦</span><div><strong>Procesado por ObraSaaS</strong><p>{step.assistant}</p></div><time>08:41</time></div>
            </div>
            <div className={styles.chatComposer}><span>＋</span><p>Mensaje</p><b>⌁</b></div>
          </div>
        </div>
      </div>
      <div className={styles.demoControls} aria-label="Escenarios del simulador">
        {steps.map((item, index) => <button type="button" className={index === active ? styles.demoControlActive : undefined} onClick={() => setActive(index)} key={item.id} aria-pressed={index === active}><span>0{index + 1}</span>{item.short}</button>)}
      </div>
    </div>
  );
}
