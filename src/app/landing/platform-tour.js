'use client';

import { useRef, useState } from 'react';

import styles from './platform-tour.module.css';

const modules = [
  {
    id: 'field',
    number: '01',
    label: 'Reportar',
    eyebrow: 'WhatsApp en campo',
    title: 'La cuadrilla informa sin aprender otra aplicación.',
    description: 'Audio, foto, ubicación o Flow entran con identidad, obra y momento. La señal original queda vinculada a lo que ObraSaaS interpreta.',
  },
  {
    id: 'context',
    number: '02',
    label: 'Entender',
    eyebrow: 'Contexto operativo',
    title: 'El mensaje se convierte en un registro revisable.',
    description: 'La plataforma separa hechos, evidencia y supuestos; identifica el frente afectado y explica qué dato todavía falta.',
  },
  {
    id: 'approve',
    number: '03',
    label: 'Aprobar',
    eyebrow: 'Decisión supervisada',
    title: 'La IA propone el cambio. Una persona decide.',
    description: 'Cronograma, acopios y responsables reciben propuestas pendientes. Nada sensible se ejecuta sin permiso y confirmación.',
  },
  {
    id: 'control',
    number: '04',
    label: 'Controlar',
    eyebrow: 'Dirección y auditoría',
    title: 'El resultado aparece en el tablero y en el reporte.',
    description: 'La decisión conserva origen, responsable, evidencia e impacto para que dirección, inspección o comitente puedan reconstruirla.',
  },
];

function FieldScene() {
  return (
    <div className={styles.fieldScene}>
      <article className={styles.conversationCard}>
        <div className={styles.conversationHeader}>
          <span className={styles.avatar}>JM</span>
          <div><strong>Juan · Capataz</strong><small>Obra Palermo · Instalaciones</small></div>
          <span className={styles.channelBadge}>WhatsApp</span>
        </div>
        <div className={styles.messageStack}>
          <div className={styles.messageBubble}>
            <span>Nota de voz · 0:18</span>
            <div className={styles.waveform} aria-hidden="true">
              {[8, 16, 12, 24, 18, 29, 13, 22, 10, 19, 8, 15].map((height, index) => (
                <i style={{ height }} key={`${height}-${index}`} />
              ))}
            </div>
            <p>“Terminamos las cañerías del segundo piso. Quedaron probadas y listas para cerrar.”</p>
            <time>08:41 · ✓✓</time>
          </div>
          <div className={styles.attachmentRow}>
            <span className={styles.attachmentPreview} aria-hidden="true"><i /><i /><i /></span>
            <div><strong>3 fotos adjuntas</strong><small>Frente norte · geolocalización recibida</small></div>
            <span className={styles.receivedBadge}>Recibido</span>
          </div>
        </div>
      </article>
      <div className={styles.identityRail} aria-label="Contexto resuelto">
        <div><span>01</span><p><small>Persona</small><strong>Identidad autorizada</strong></p><i /></div>
        <div><span>02</span><p><small>Proyecto</small><strong>Obra Palermo</strong></p><i /></div>
        <div><span>03</span><p><small>Frente</small><strong>Instalaciones · Piso 2</strong></p><i /></div>
        <div><span>04</span><p><small>Evidencia</small><strong>Audio + 3 fotos + GPS</strong></p><i /></div>
      </div>
    </div>
  );
}

function ContextScene() {
  return (
    <div className={styles.contextScene}>
      <div className={styles.analysisHeader}>
        <div><span>ObraSaaS Engine</span><strong>Lectura estructurada del evento</strong></div>
        <span className={styles.reviewBadge}>Revisión requerida</span>
      </div>
      <div className={styles.analysisGrid}>
        <article className={styles.transcriptCard}>
          <span>Hecho informado</span>
          <blockquote>Las cañerías del segundo piso fueron terminadas y probadas.</blockquote>
          <div className={styles.sourceLine}><i aria-hidden="true">↳</i><p><strong>Fuente original</strong><small>Audio de Juan · 08:41 · WhatsApp</small></p></div>
        </article>
        <article className={styles.classificationCard}>
          <span>Contexto encontrado</span>
          <dl>
            <div><dt>Partida</dt><dd>Instalación sanitaria</dd></div>
            <div><dt>Ubicación</dt><dd>Piso 2 · Frente norte</dd></div>
            <div><dt>Hito relacionado</dt><dd>Prueba hidráulica</dd></div>
            <div><dt>Confianza</dt><dd><b>Alta · 92%</b></dd></div>
          </dl>
        </article>
      </div>
      <div className={styles.missingSignal}>
        <span aria-hidden="true">!</span>
        <div><strong>Falta una confirmación para cerrar el avance</strong><p>La evidencia muestra la instalación, pero no incluye el acta firmada de la prueba hidráulica.</p></div>
        <button type="button" disabled>Solicitar evidencia</button>
      </div>
    </div>
  );
}

function ApprovalScene() {
  const ganttRows = [
    { name: 'Montantes sanitarias', owner: 'Cuadrilla A', start: 4, span: 28, progress: 100, status: 'done' },
    { name: 'Prueba hidráulica', owner: 'Juan M.', start: 29, span: 24, progress: 84, status: 'active' },
    { name: 'Cierre de tabiques', owner: 'Terminaciones', start: 55, span: 31, progress: 18, status: 'waiting' },
  ];

  return (
    <div className={styles.approvalScene}>
      <div className={styles.proposalHeader}>
        <div><span>Propuesta pendiente</span><strong>Actualizar el plan de instalaciones</strong></div>
        <small>Impacto estimado · sin conflicto</small>
      </div>
      <div className={styles.ganttBoard}>
        <div className={styles.ganttScale}><span>Actividad</span><div><i>Lun 15</i><i>Mar 16</i><i>Mié 17</i><i>Jue 18</i><i>Vie 19</i></div></div>
        {ganttRows.map((row) => (
          <div className={styles.tourGanttRow} key={row.name}>
            <p><strong>{row.name}</strong><small>{row.owner}</small></p>
            <div className={styles.tourGanttTrack}>
              <i
                className={styles[row.status]}
                style={{ insetInlineStart: `${row.start}%`, width: `${row.span}%` }}
              >
                <span style={{ width: `${row.progress}%` }} />
              </i>
            </div>
            <small>{row.progress}%</small>
          </div>
        ))}
      </div>
      <div className={styles.approvalFooter}>
        <div className={styles.impactSummary}>
          <span>Impacto propuesto</span>
          <strong>+7% en “Prueba hidráulica”</strong>
          <small>No modifica fechas ni emite mensajes externos.</small>
        </div>
        <div className={styles.approvalActions}>
          <button type="button" disabled>Rechazar</button>
          <button type="button" disabled>Aprobar cambio</button>
        </div>
      </div>
    </div>
  );
}

function ControlScene() {
  return (
    <div className={styles.controlScene}>
      <div className={styles.reportTopline}>
        <div><span>Reporte ejecutivo semanal</span><strong>Obra Palermo · Semana 24</strong></div>
        <span className={styles.reportStatus}>Listo para exportar</span>
      </div>
      <div className={styles.reportMetrics}>
        <article><span>Avance</span><strong>84%</strong><small>+6,4% semanal</small></article>
        <article><span>Hitos validados</span><strong>12/14</strong><small>2 requieren evidencia</small></article>
        <article><span>Riesgo de plazo</span><strong>Bajo</strong><small>0 conflictos activos</small></article>
      </div>
      <div className={styles.controlGrid}>
        <article className={styles.reportNarrative}>
          <span>Resumen verificable</span>
          <h3>Instalaciones avanza según el plan.</h3>
          <p>El frente del segundo piso informó terminación y prueba. El avance quedó actualizado después de la aprobación del responsable.</p>
          <div><i /><span><strong>1 evidencia pendiente</strong><small>Acta de prueba hidráulica</small></span></div>
        </article>
        <article className={styles.auditCard}>
          <span>Historia de la decisión</span>
          <ol>
            <li><i /><div><strong>Reporte recibido</strong><small>Juan · WhatsApp · 08:41</small></div></li>
            <li><i /><div><strong>Contexto resuelto</strong><small>Instalaciones · Piso 2</small></div></li>
            <li><i /><div><strong>Cambio aprobado</strong><small>Dirección de obra · 09:06</small></div></li>
            <li><i /><div><strong>Reporte actualizado</strong><small>Snapshot v18 · trazable</small></div></li>
          </ol>
        </article>
      </div>
    </div>
  );
}

function ActiveScene({ id }) {
  if (id === 'field') return <FieldScene />;
  if (id === 'context') return <ContextScene />;
  if (id === 'approve') return <ApprovalScene />;
  return <ControlScene />;
}

export default function PlatformTour() {
  const [activeId, setActiveId] = useState(modules[0].id);
  const tabRefs = useRef([]);
  const active = modules.find((module) => module.id === activeId) || modules[0];

  function activateTab(index) {
    const normalizedIndex = (index + modules.length) % modules.length;
    setActiveId(modules[normalizedIndex].id);
    const tab = tabRefs.current[normalizedIndex];
    tab?.focus();
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function handleTabKeyDown(event, index) {
    const keyTargets = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: modules.length - 1,
    };
    if (!(event.key in keyTargets)) return;
    event.preventDefault();
    activateTab(keyTargets[event.key]);
  }

  return (
    <section className={styles.tour} id="plataforma" aria-labelledby="platform-tour-title">
      <div className={styles.intro}>
        <div>
          <span>Producto en contexto</span>
          <h2 id="platform-tour-title">Una señal de campo actualiza toda la conversación de la obra.</h2>
        </div>
        <p>Recorré el circuito que conecta adopción, criterio y trazabilidad. La experiencia es demostrativa; las reglas y límites que muestra son los que aplica la plataforma.</p>
      </div>

      <div className={styles.tourFrame}>
        <div className={styles.moduleTabs} role="tablist" aria-label="Recorrido operativo de ObraSaaS">
          {modules.map((module, index) => {
            const selected = module.id === active.id;
            return (
              <button
                type="button"
                role="tab"
                ref={(node) => { tabRefs.current[index] = node; }}
                id={`tour-tab-${module.id}`}
                aria-selected={selected}
                aria-controls="tour-panel"
                tabIndex={selected ? 0 : -1}
                className={selected ? styles.activeTab : undefined}
                onClick={() => setActiveId(module.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                key={module.id}
              >
                <span>{module.number}</span>
                <div><small>{module.eyebrow}</small><strong>{module.label}</strong></div>
                <i aria-hidden="true">→</i>
              </button>
            );
          })}
        </div>

        <div className={styles.stage}>
          <div className={styles.stageTopbar}>
            <div className={styles.windowDots} aria-hidden="true"><i /><i /><i /></div>
            <p><span>OS</span><strong>Obra Palermo</strong><small>Centro operativo</small></p>
            <div className={styles.stageStatus}><i /> Entorno demostrativo</div>
          </div>
          <div
            className={styles.scene}
            role="tabpanel"
            id="tour-panel"
            aria-labelledby={`tour-tab-${active.id}`}
            key={active.id}
          >
            <div className={styles.sceneIntro}>
              <div><span>{active.number} · {active.eyebrow}</span><h3>{active.title}</h3></div>
              <p>{active.description}</p>
            </div>
            <ActiveScene id={active.id} />
          </div>
        </div>
      </div>

      <div className={styles.signalBar} aria-label="Capacidades verificables de la plataforma">
        <div><span>Canal</span><strong>WhatsApp Cloud API y Flows</strong></div>
        <div><span>Gobierno</span><strong>Permisos por rol y tenant</strong></div>
        <div><span>Registro</span><strong>Postgres transaccional</strong></div>
        <div><span>Control</span><strong>Acciones sensibles pendientes</strong></div>
      </div>
    </section>
  );
}
