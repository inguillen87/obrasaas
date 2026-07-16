import Link from 'next/link';
import { ObraSaasLogo } from './brand/brand-logo';
import MobileNavigation from './landing/mobile-navigation';
import PlatformTour from './landing/platform-tour';
import ProductExperience from './landing/product-experience';
import DemoForm from './landing/demo-form';
import styles from './landing/landing.module.css';
import { PLAN_CATALOG, PRICING_BASIS_NOTE, VARIABLE_COST_NOTE } from '@/lib/plans';

export const metadata = {
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'ObraSaaS | La obra avanza por WhatsApp',
    description:
      'Una plataforma operativa para conectar cuadrillas, cronograma, evidencia, suministros y dirección.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'ObraSaaS',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ObraSaaS | El sistema operativo de la obra',
    description: 'De la realidad de campo a una decisión trazable.',
  },
};

const audiences = [
  ['Arquitectura e inspección', 'Menos recorridas ciegas. Más decisiones con contexto.', 'Recibe avances, evidencia y desvíos ordenados por frente, responsable y fecha; llega a la obra sabiendo qué validar.', ['Bitácora fotográfica', 'Reportes para comitentes', 'Seguimiento de hitos']],
  ['Constructoras', 'Campo y oficina sobre el mismo estado operativo.', 'Conecta ejecución, abastecimiento, RRHH y cronograma para anticipar bloqueos antes de que se conviertan en costo.', ['Multiobra', 'Control de suministros', 'Riesgo y productividad']],
  ['Gobiernos y mandantes', 'Trazabilidad para obras que deben rendir cuentas.', 'Estandariza evidencia, responsables y fechas con permisos por rol y una historia verificable de cada decisión.', ['Auditoría', 'Contratistas y permisos', 'Tableros de cartera']],
];

const trustControls = [
  ['01', 'Aislamiento por organización y obra', 'Cada sesión se resuelve contra una organización, una obra activa y un rol. Las lecturas y escrituras se limitan a ese contexto antes de llegar a la base.', 'TENANT · PROYECTO · PERMISOS POR ROL'],
  ['02', 'Trazabilidad por contexto', 'Cambios del proyecto, consultas de IA y comunicaciones conservan fecha, origen y responsable en sus registros asociados.', 'AUDITORÍA · EVIDENCIA · HISTORIAL'],
  ['03', 'WhatsApp oficial por proyecto', 'Cada obra puede conectar su propio número mediante Embedded Signup, validar webhooks firmados y administrar Flows sin compartir credenciales con otro tenant.', 'META CLOUD API · EMBEDDED SIGNUP · FLOWS'],
  ['04', 'Persistencia durable y transaccional', 'El estado operativo se guarda en Neon Postgres. Las actualizaciones del proyecto y sus registros de auditoría se confirman dentro de la misma transacción.', 'NEON POSTGRES · PRISMA · TRANSACCIONES'],
  ['05', 'Supervisor IA acotado al contexto', 'El Supervisor analiza únicamente la obra activa y devuelve una respuesta estructurada con evidencia, nivel de confianza y limitaciones. Cada consulta queda registrada.', 'OPENAI RESPONSES · SALIDA ESTRUCTURADA · STORE: FALSE'],
  ['06', 'La IA propone; la acción sigue pendiente', 'La versión actual presenta sugerencias de reasignación o compra como acciones pendientes. No emite órdenes ni mensajes externos.', 'PROPUESTA PENDIENTE · SIN EJECUCIÓN EXTERNA'],
];

const faqs = [
  ['¿La cuadrilla tiene que instalar una app?', 'No para los flujos principales. La propuesta es operar desde WhatsApp mediante mensajes, ubicación y WhatsApp Flows. El panel web queda para supervisión, planificación y administración.'],
  ['¿ObraSaaS reemplaza un ERP o una plataforma BIM?', 'No pretende reemplazar todo. Funciona como capa operativa entre campo y gestión: captura la realidad de obra y puede integrarla con ERP, BIM, almacenamiento y analítica mediante APIs.'],
  ['¿La IA modifica el cronograma o compra sin control?', 'No. La versión actual clasifica información y propone acciones, pero no emite órdenes ni mensajes externos. Los cambios operativos permitidos dependen del rol y quedan registrados.'],
  ['¿Puede funcionar en varias obras y empresas?', 'Sí. Cada empresa opera como un tenant separado, con usuarios, roles, proyectos y datos aislados por organización. Enterprise agrega portfolio multiempresa, permisos avanzados e integraciones dedicadas.'],
  ['¿Qué se necesita para conectar WhatsApp oficial?', 'Una cuenta comercial de Meta, un WABA, un número habilitado, plantillas aprobadas, webhook HTTPS y credenciales de Cloud API. Para un SaaS multicliente también corresponde implementar Embedded Signup.'],
];

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ObraSaaS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, WhatsApp',
  inLanguage: 'es',
  description: 'Sistema operativo de obra para convertir reportes de campo en evidencia, tareas, cronograma y decisiones trazables.',
  featureList: [
    'WhatsApp Cloud API y Flows',
    'Cronograma Gantt',
    'Acopios y recepción de materiales',
    'Presentismo y geocerca',
    'Reportes ejecutivos',
    'Auditoría multi-tenant',
  ],
  offers: Object.values(PLAN_CATALOG).map((plan) => ({
    '@type': 'Offer',
    name: plan.name,
    price: plan.priceMonthly,
    priceCurrency: 'USD',
    description: plan.description,
  })),
};

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function CheckIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><path d="m4 10 3.5 3.5L16 5.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}

function Logo({ preload = false } = {}) {
  return <ObraSaasLogo className={styles.logo} markSize={30} preload={preload} />;
}

export default function Home() {
  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <a href="#contenido" className={styles.skipLink}>Saltar al contenido</a>
      <div className={styles.ambientGrid} aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="ObraSaaS, inicio"><Logo preload /></Link>
        <nav className={styles.nav} aria-label="Navegación principal">
          <a href="#producto">Producto</a><a href="#plataforma">Plataforma</a><a href="#confianza">Confianza</a><a href="#sectores">Sectores</a><a href="#precios">Precios</a><a href="#preguntas">Preguntas</a>
        </nav>
        <div className={styles.headerActions}><Link href="/sign-in" className={styles.quietLink}>Iniciar sesión</Link><a href="#contacto" className={styles.compactCta}>Solicitar demo <ArrowIcon /></a><MobileNavigation /></div>
      </header>

      <main id="contenido">
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span className={styles.liveDot} />Operación de obra conectada, desde el primer mensaje</div>
          <h1>La obra reporta por WhatsApp.<span> La gestión gana contexto para actuar.</span></h1>
          <p>Convierte audios, fotos, ubicación y formularios de la cuadrilla en información estructurada, evidencia, alertas y propuestas de acción. Un sistema operativo de campo diseñado para la realidad de LATAM.</p>
          <div className={styles.heroActions}><Link href="/sign-up" className={styles.primaryCta}>Probar 14 días <ArrowIcon /></Link><a href="#producto" className={styles.secondaryCta}>Ver la demo operativa</a></div>
          <div className={styles.heroProof} aria-label="Condiciones principales"><span><CheckIcon /> Demo interactiva sin tarjeta</span><span><CheckIcon /> Cada acción sensible requiere aprobación</span><span><CheckIcon /> Tenant y obra aislados desde el alta</span></div>
          <div className={styles.heroMeta} aria-label="Capacidades destacadas"><span>Cloud API</span><i /><span>WhatsApp Flows</span><i /><span>Gantt</span><i /><span>Acopios</span><i /><span>Reportes</span></div>
        </div>
        <div className={styles.heroProduct}><ProductExperience /></div>
      </section>

      <section className={styles.audienceStrip} aria-label="Sectores objetivo"><span>Diseñado para</span><strong>Estudios de arquitectura</strong><i /><strong>Constructoras</strong><i /><strong>Inspección y obra pública</strong><i /><strong>Desarrolladores y mandantes</strong></section>

      <section className={styles.outcomes} id="producto">
        <div className={styles.sectionIntro}><span className={styles.sectionKicker}>Una sola línea operativa</span><h2>Del mensaje informal a una decisión que queda registrada.</h2><p>ObraSaaS conecta lo que ocurre en campo con lo que dirección necesita controlar. Sin copiar mensajes, perseguir planillas ni reconstruir la historia al final de la semana.</p></div>
        <div className={styles.flowRail}>
          {[
            ['01', 'Reportar', 'Voz, foto, GPS o Flow'], ['02', 'Entender', 'Proyecto, persona e intención'], ['03', 'Aprobar', 'Tarea, alerta o cambio pendiente'], ['04', 'Controlar', 'Bitácora, KPI y reporte'],
          ].map(([step, title, copy]) => <article key={step} className={styles.flowStep}><span>{step}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}
        </div>
      </section>

      <PlatformTour />

      <section className={styles.trust} id="confianza">
        <div className={styles.trustIntro}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>Confianza verificable</span>
            <h2>La automatización sirve cuando cada dato, permiso y decisión se puede revisar.</h2>
            <p>ObraSaaS no presenta a la IA como una caja negra. La plataforma separa organizaciones y obras, limita acciones por rol y conserva una bitácora de lo que ocurrió. Las integraciones externas se activan con los activos y credenciales de cada tenant.</p>
          </div>
          <div className={styles.trustPrinciple}>
            <span aria-hidden="true">06</span>
            <div><small>Principio operativo</small><strong>La IA propone; no ejecuta por su cuenta.</strong><p>Las acciones sensibles permanecen pendientes y no generan órdenes ni mensajes externos.</p></div>
          </div>
        </div>
        <div className={styles.trustGrid}>
          {trustControls.map(([number, title, description, signal]) => (
            <article className={styles.trustCard} key={number}>
              <div className={styles.trustCardTopline}><span>{number}</span><i aria-hidden="true" /></div>
              <h3>{title}</h3>
              <p>{description}</p>
              <small>{signal}</small>
            </article>
          ))}
        </div>
        <div className={styles.trustFooter}>
          <div>
            <span className={styles.trustFooterLabel}>Condiciones de activación</span>
            <p>La activación de WhatsApp requiere los activos y aprobaciones de Meta de cada organización. El Supervisor IA requiere OpenAI configurado en el entorno correspondiente.</p>
          </div>
          <div className={styles.trustFooterActions}>
            <p>Lo verificamos sobre una obra de prueba: evento → permiso → actualización → bitácora.</p>
            <div><a href="#contacto" className={styles.primaryCta}>Solicitar recorrido técnico <ArrowIcon /></a><Link href="/sign-up" className={styles.secondaryCta}>Crear organización de prueba</Link></div>
          </div>
        </div>
      </section>

      <section className={styles.positioning}>
        <div className={styles.positioningCopy}><span className={styles.sectionKicker}>Nuestra ventaja</span><h2>No es otra app que la cuadrilla tiene que recordar abrir.</h2><p>Las plataformas globales demostraron el valor de una fuente única de verdad. ObraSaaS acerca esa disciplina al canal que el campo latinoamericano ya usa todos los días.</p><ul><li><CheckIcon /><span><strong>Adopción primero.</strong> WhatsApp en campo, panel especializado en oficina.</span></li><li><CheckIcon /><span><strong>IA con control.</strong> Estructura información y propone acciones dentro de reglas y permisos.</span></li><li><CheckIcon /><span><strong>Arquitectura abierta.</strong> Preparada para ERP, BIM, almacenamiento, cámaras y sensores.</span></li></ul></div>
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
        <div className={styles.innovationIntro}><span className={styles.sectionKicker}>ObraSaaS Labs · hoja de ruta</span><h2>Del reporte humano a la telemetría de la obra.</h2><p>BIM, cámaras e IoT son capacidades conceptuales en evaluación, no funciones activas del plan actual. La visión es incorporarlas sólo donde agreguen evidencia y prevención, manteniendo al supervisor en control.</p></div>
        <div className={styles.roadmapGrid}>
          {[
            ['01', 'BIM + contexto operativo', 'Roadmap', 'Vincular incidencias, avances y documentos con sectores y elementos del modelo.', ['Proveedor y formato definidos', 'Modelo piloto autorizado', 'Permisos por elemento']],
            ['02', 'Visión + prevención', 'Investigación', 'Convertir condiciones observadas en alertas revisables, nunca en decisiones opacas.', ['Cámaras y zonas autorizadas', 'Política de privacidad', 'Validación humana']],
            ['03', 'IoT + abastecimiento', 'Exploración', 'Usar telemetría para anticipar faltantes y desvíos sin emitir compras automáticamente.', ['Dispositivos seleccionados', 'Calibración en obra', 'Workflow de aprobación']],
          ].map(([number, title, status, copy, requirements]) => (
            <article className={styles.roadmapCard} key={number}>
              <div><span>{number}</span><small>{status}</small></div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <ul>{requirements.map((requirement) => <li key={requirement}><i aria-hidden="true" />{requirement}</li>)}</ul>
            </article>
          ))}
        </div>
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
                {plan.key === 'PRO' && <small>Plan recomendado</small>}
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
                : <a href="#contacto" className={plan.key === 'PRO' ? styles.primaryCta : styles.secondaryCta}>{plan.key === 'PRO' ? 'Hablar con ventas' : 'Diseñar Enterprise'} <ArrowIcon /></a>}
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

      <section className={styles.finalCta} id="contacto"><div className={styles.finalCtaCopy}><span className={styles.sectionKicker}>Implementación guiada</span><h2>Elegimos una obra, conectamos un flujo y medimos el resultado.</h2><p>Un piloto serio empieza con un problema operativo y una métrica, no con una lista infinita de funciones.</p><ul><li><CheckIcon /> Diagnóstico de 30 minutos</li><li><CheckIcon /> Una obra y un flujo prioritario</li><li><CheckIcon /> Alcance, responsables y métrica de éxito</li></ul></div><DemoForm /></section>
      </main>

      <footer className={styles.footer}><div><Logo /><p>Tecnología de obra diseñada en Argentina para operar globalmente.</p></div><div className={styles.footerLinks}><a href="#producto">Demo</a><a href="#confianza">Confianza</a><a href="#plataforma">Plataforma</a><Link href="/sign-in">Ingresar</Link><Link href="/privacy">Privacidad</Link><Link href="/terms">Términos</Link><Link href="/data-deletion">Eliminar datos</Link><a href="#contacto">Contacto</a></div><p>© 2026 ObraSaaS · Operado desde Argentina</p></footer>
    </div>
  );
}
