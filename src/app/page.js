import Image from 'next/image';
import Link from 'next/link';
import ProductExperience from './landing/product-experience';
import styles from './landing/landing.module.css';
import { PLAN_CATALOG, PRICING_BASIS_NOTE, VARIABLE_COST_NOTE } from '@/lib/plans';

const capabilities = [
  ['01', 'Campo conversacional', 'WhatsApp como interfaz de obra', 'La cuadrilla reporta por voz, foto, ubicación o formulario. ObraSaaS estructura el mensaje sin obligar al equipo a aprender otra aplicación.', 'Cloud API · Flows · multimedia'],
  ['02', 'Planificación viva', 'Del reporte al Gantt', 'Cada avance, bloqueo o desvío propone una actualización trazable del cronograma, con responsable, evidencia y contexto de obra.', 'Tareas · dependencias · alertas'],
  ['03', 'Control de recursos', 'Acopios, compras y proveedores', 'Monitorea mínimos de seguridad, registra consumos y prepara órdenes de compra con aprobación humana y seguimiento de entrega.', 'Stock · OC · trazabilidad'],
  ['04', 'Personas y seguridad', 'Presentismo con evidencia', 'Geocerca, horario y registro del operario quedan unidos en una bitácora auditable, con flujos para certificados e incidencias.', 'GPS · RRHH · cumplimiento'],
  ['05', 'Dirección ejecutiva', 'Reportes que explican el riesgo', 'Convierte la actividad diaria en resúmenes semanales, evidencias y reportes listos para comitentes, dirección o inspección.', 'PDF · KPIs · bitácora'],
  ['06', 'Capa abierta', 'BIM, cámaras e integraciones', 'Una arquitectura preparada para conectar modelos, video, ERPs y sensores sin encerrar la operación en un único proveedor.', 'BIM · API · visión'],
];

const audiences = [
  ['Arquitectura e inspección', 'Menos recorridas ciegas. Más decisiones con contexto.', 'Recibe avances, evidencia y desvíos ordenados por frente, responsable y fecha; llega a la obra sabiendo qué validar.', ['Bitácora fotográfica', 'Reportes para comitentes', 'Seguimiento de hitos']],
  ['Constructoras', 'Campo y oficina sobre el mismo estado operativo.', 'Conecta ejecución, abastecimiento, RRHH y cronograma para anticipar bloqueos antes de que se conviertan en costo.', ['Multiobra', 'Control de suministros', 'Riesgo y productividad']],
  ['Gobiernos y mandantes', 'Trazabilidad para obras que deben rendir cuentas.', 'Estandariza evidencia, responsables y fechas con permisos por rol y una historia verificable de cada decisión.', ['Auditoría', 'Contratistas y permisos', 'Tableros de cartera']],
];

const faqs = [
  ['¿La cuadrilla tiene que instalar una app?', 'No para los flujos principales. La propuesta es operar desde WhatsApp mediante mensajes, ubicación y WhatsApp Flows. El panel web queda para supervisión, planificación y administración.'],
  ['¿ObraSaaS reemplaza un ERP o una plataforma BIM?', 'No pretende reemplazar todo. Funciona como capa operativa entre campo y gestión: captura la realidad de obra y puede integrarla con ERP, BIM, almacenamiento y analítica mediante APIs.'],
  ['¿La IA modifica el cronograma o compra sin control?', 'Las acciones sensibles deben trabajar con reglas, permisos y aprobación. La IA clasifica, propone y automatiza tareas repetitivas; ObraSaaS conserva evidencia y responsables para cada cambio.'],
  ['¿Puede funcionar en varias obras y empresas?', 'Sí. Cada empresa opera como un tenant separado, con usuarios, roles, proyectos y datos aislados por organización. Enterprise agrega portfolio multiempresa, permisos avanzados e integraciones dedicadas.'],
  ['¿Qué se necesita para conectar WhatsApp oficial?', 'Una cuenta comercial de Meta, un WABA, un número habilitado, plantillas aprobadas, webhook HTTPS y credenciales de Cloud API. Para un SaaS multicliente también corresponde implementar Embedded Signup.'],
];

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function CheckIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><path d="m4 10 3.5 3.5L16 5.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}

function Logo() {
  return <span className={styles.logo}><span className={styles.logoMark} aria-hidden="true"><span /><span /><span /></span><span>ObraSaaS</span></span>;
}

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.ambientGrid} aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="ObraSaaS, inicio"><Logo /><span className={styles.brandTag}>Field OS</span></Link>
        <nav className={styles.nav} aria-label="Navegación principal">
          <a href="#producto">Producto</a><a href="#plataforma">Plataforma</a><a href="#sectores">Sectores</a><a href="#precios">Precios</a><a href="#preguntas">Preguntas</a>
        </nav>
        <div className={styles.headerActions}><Link href="/dashboard" prefetch={false} className={styles.quietLink}>Ver plataforma</Link><a href="#contacto" className={styles.compactCta}>Solicitar demo <ArrowIcon /></a></div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span className={styles.liveDot} />Operación de obra conectada, desde el primer mensaje</div>
          <h1>La obra avanza por WhatsApp.<span> La gestión se actualiza sola.</span></h1>
          <p>Convierte audios, fotos, ubicación y formularios de la cuadrilla en tareas, evidencia, alertas y decisiones. Un sistema operativo de campo diseñado para la realidad de LATAM.</p>
          <div className={styles.heroActions}><Link href="/dashboard" prefetch={false} className={styles.primaryCta}>Explorar la plataforma <ArrowIcon /></Link><a href="#producto" className={styles.secondaryCta}>Ver cómo funciona</a></div>
          <div className={styles.heroProof} aria-label="Capacidades principales"><span><CheckIcon /> WhatsApp Cloud API + Flows</span><span><CheckIcon /> Cronograma y evidencia conectados</span><span><CheckIcon /> Diseñado para español y LATAM</span></div>
        </div>
        <div className={styles.heroProduct}><ProductExperience /></div>
      </section>

      <section className={styles.audienceStrip} aria-label="Sectores objetivo"><span>Diseñado para</span><strong>Estudios de arquitectura</strong><i /><strong>Constructoras</strong><i /><strong>Inspección y obra pública</strong><i /><strong>Desarrolladores y mandantes</strong></section>

      <section className={styles.outcomes} id="producto">
        <div className={styles.sectionIntro}><span className={styles.sectionKicker}>Una sola línea operativa</span><h2>Del mensaje informal a una decisión que queda registrada.</h2><p>ObraSaaS conecta lo que ocurre en campo con lo que dirección necesita controlar. Sin copiar mensajes, perseguir planillas ni reconstruir la historia al final de la semana.</p></div>
        <div className={styles.flowRail}>
          {[
            ['01', 'Captura', 'Voz, foto, GPS o Flow'], ['02', 'Comprensión', 'Proyecto, persona e intención'], ['03', 'Acción', 'Tarea, alerta o aprobación'], ['04', 'Evidencia', 'Bitácora, KPI y reporte'],
          ].map(([step, title, copy]) => <article key={step} className={styles.flowStep}><span>{step}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}
        </div>
      </section>

      <section className={styles.platform} id="plataforma">
        <div className={styles.sectionIntroRow}><div><span className={styles.sectionKicker}>Plataforma modular</span><h2>Una base común para controlar ejecución, recursos y riesgo.</h2></div><p>Empieza por el flujo que más duele y suma capacidades sin fragmentar los datos de la obra.</p></div>
        <div className={styles.capabilityGrid}>
          {capabilities.map(([number, eyebrow, title, description, signal]) => <article className={styles.capabilityCard} key={number}><div className={styles.cardTopline}><span>{number}</span><small>{signal}</small></div><p className={styles.cardEyebrow}>{eyebrow}</p><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <section className={styles.positioning}>
        <div className={styles.positioningCopy}><span className={styles.sectionKicker}>Nuestra ventaja</span><h2>No es otra app que la cuadrilla tiene que recordar abrir.</h2><p>Las plataformas globales demostraron el valor de una fuente única de verdad. ObraSaaS acerca esa disciplina al canal que el campo latinoamericano ya usa todos los días.</p><ul><li><CheckIcon /><span><strong>Adopción primero.</strong> WhatsApp en campo, panel especializado en oficina.</span></li><li><CheckIcon /><span><strong>IA con control.</strong> Propone y automatiza dentro de reglas, permisos y aprobaciones.</span></li><li><CheckIcon /><span><strong>Arquitectura abierta.</strong> Preparada para ERP, BIM, almacenamiento, cámaras y sensores.</span></li></ul></div>
        <div className={styles.architectureCard}>
          <div className={styles.architectureHeader}><span>Arquitectura operativa</span><small>Evento → contexto → acción</small></div>
          <div className={styles.architectureStack}><div><span className={styles.nodeIcon}>WA</span><p><strong>Canales de campo</strong><small>WhatsApp · webviews · sensores</small></p></div><i aria-hidden="true" /><div><span className={styles.nodeIcon}>AI</span><p><strong>Motor ObraSaaS</strong><small>Identidad · intención · políticas</small></p></div><i aria-hidden="true" /><div><span className={styles.nodeIcon}>OS</span><p><strong>Registro operativo</strong><small>Gantt · RRHH · stock · evidencia</small></p></div></div>
          <div className={styles.architectureOutput}><span>API</span><span>ERP</span><span>BIM</span><span>PDF</span><span>BI</span></div>
        </div>
      </section>

      <section className={styles.sectors} id="sectores">
        <div className={styles.sectionIntro}><span className={styles.sectionKicker}>Una plataforma, distintas responsabilidades</span><h2>La misma evidencia, presentada para quien tiene que actuar.</h2></div>
        <div className={styles.audienceCards}>{audiences.map(([role, title, copy, outcomes]) => <article key={role}><span>{role}</span><h3>{title}</h3><p>{copy}</p><ul>{outcomes.map((outcome) => <li key={outcome}><CheckIcon /> {outcome}</li>)}</ul></article>)}</div>
      </section>

      <section className={styles.innovation}>
        <div className={styles.innovationIntro}><span className={styles.sectionKicker}>Preparada para la siguiente capa</span><h2>Del reporte humano a la telemetría de la obra.</h2><p>La visión es sumar BIM, cámaras e IoT donde agreguen evidencia y prevención, manteniendo al supervisor en control de cada acción relevante.</p></div>
        <div className={styles.visualGrid}><article className={styles.visualCard}><Image src="/bim_render.png" width={1024} height={1024} alt="Visualización conceptual de un modelo BIM conectado" sizes="(max-width: 800px) 100vw, 50vw" /><div><span>BIM + contexto operativo</span><p>Relacionar incidencias, avances y documentos con sectores y elementos del modelo.</p></div></article><article className={styles.visualCard}><Image src="/cctv_render.png" width={1024} height={1024} alt="Visualización conceptual de seguridad asistida por visión" sizes="(max-width: 800px) 100vw, 50vw" /><div><span>Visión + prevención</span><p>Detectar condiciones de riesgo y convertirlas en alertas revisables, no en decisiones opacas.</p></div></article></div>
      </section>

      <section className={styles.pricing} id="precios">
        <div className={styles.sectionIntroRow}>
          <div><span className={styles.sectionKicker}>Precios simples en USD</span><h2>Una prueba seria. Dos planes para crecer.</h2></div>
          <p>Sin un laberinto de módulos. El plan se define por escala operativa, gobierno e integraciones; los cargos variables siempre quedan visibles.</p>
        </div>
        <div className={styles.pricingGrid}>
          {Object.values(PLAN_CATALOG).map((plan) => (
            <article key={plan.key} className={`${styles.pricingCard} ${plan.key === 'PRO' ? styles.pricingFeatured : ''}`}>
              <div className={styles.pricingTopline}>
                <span>{plan.name}</span>
                {plan.key === 'PRO' && <small>Más elegido</small>}
              </div>
              <p>{plan.description}</p>
              <div className={styles.price}>
                {plan.pricePrefix && <small>{plan.pricePrefix}</small>}
                <strong>USD {plan.priceMonthly}</strong>
                <span>{plan.key === 'TRIAL' ? `por ${plan.trialDays} días` : '/ mes'}</span>
              </div>
              {plan.key === 'PRO' && <p className={styles.annualPrice}>USD {plan.priceAnnualMonthly}/mes con pago anual</p>}
              <ul>{plan.features.map((feature) => <li key={feature}><CheckIcon /> {feature}</li>)}</ul>
              {plan.key === 'TRIAL'
                ? <Link href="/sign-up" className={styles.primaryCta}>Probar 14 días <ArrowIcon /></Link>
                : <a href={`mailto:guillen.marce@gmail.com?subject=ObraSaaS%20${plan.name}`} className={plan.key === 'PRO' ? styles.primaryCta : styles.secondaryCta}>{plan.key === 'PRO' ? 'Empezar con Pro' : 'Hablar con Enterprise'} <ArrowIcon /></a>}
            </article>
          ))}
        </div>
        <p className={styles.pricingBasisNote}>{PRICING_BASIS_NOTE}</p>
        <p className={styles.variableCostNote}>{VARIABLE_COST_NOTE}</p>
      </section>

      <section className={styles.faq} id="preguntas">
        <div className={styles.faqIntro}><span className={styles.sectionKicker}>Preguntas concretas</span><h2>Qué es, qué no es y qué hace falta para operar.</h2><p>Sin promesas vagas: una plataforma seria también explica sus límites y condiciones.</p></div>
        <div className={styles.faqList}>{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className={styles.finalCta} id="contacto"><div><span className={styles.sectionKicker}>Implementación guiada</span><h2>Elegimos una obra, conectamos un flujo y medimos el resultado.</h2><p>Un piloto serio empieza con un problema operativo y una métrica, no con una lista infinita de funciones.</p></div><div className={styles.finalActions}><a className={styles.primaryCta} href="mailto:guillen.marce@gmail.com?subject=Demo%20ObraSaaS">Coordinar una demo <ArrowIcon /></a><Link className={styles.secondaryCta} href="/presupuesto">Ver alcance de referencia</Link></div></section>

      <footer className={styles.footer}><div><Logo /><p>Tecnología de obra diseñada en Argentina para operar globalmente.</p></div><div className={styles.footerLinks}><Link href="/dashboard" prefetch={false}>Plataforma</Link><Link href="/presupuesto">Propuesta</Link><Link href="/privacy">Privacidad</Link><Link href="/terms">Términos</Link><a href="mailto:guillen.marce@gmail.com">Contacto</a></div><p>© 2026 ObraSaaS · Operado desde Argentina</p></footer>
    </main>
  );
}
