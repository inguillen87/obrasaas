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
    title: 'ObraSaaS | La obra habla. La operación entiende.',
    description:
      'Convierte voz, fotos, ubicación y formularios de campo en avance, evidencia y decisiones trazables.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'ObraSaaS',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ObraSaaS | La obra habla. La operación entiende.',
    description: 'De WhatsApp a una decisión trazable, sin obligar a la cuadrilla a aprender otra app.',
  },
};

const audiences = [
  ['Arquitectura e inspección', 'Menos recorridas ciegas. Más decisiones con contexto.', 'Recibe avances, evidencia y desvíos ordenados por frente, responsable y fecha; llega a la obra sabiendo qué validar.', ['Bitácora fotográfica', 'Reportes para comitentes', 'Seguimiento de hitos']],
  ['Constructoras', 'Campo y oficina sobre el mismo estado operativo.', 'Conecta ejecución, abastecimiento, RRHH y cronograma para anticipar bloqueos antes de que se conviertan en costo.', ['Multiobra', 'Control de suministros', 'Riesgo y productividad']],
  ['Gobiernos y mandantes', 'Trazabilidad para obras que deben rendir cuentas.', 'Estandariza evidencia, responsables y fechas con permisos por rol y una historia verificable de cada decisión.', ['Auditoría', 'Contratistas y permisos', 'Tableros de cartera']],
];

const trustControls = [
  ['01', 'Cada empresa y cada obra permanecen separadas', 'La sesión se resuelve contra una organización, una obra activa y un rol antes de leer o modificar datos. Los accesos no se comparten entre tenants.', 'ORGANIZACIÓN · OBRA · PERMISOS POR ROL'],
  ['02', 'Cada cambio conserva evidencia y responsable', 'Mensajes, actualizaciones del proyecto y consultas del Supervisor mantienen origen, fecha y contexto dentro de una bitácora revisable.', 'AUDITORÍA · EVIDENCIA · HISTORIAL'],
  ['03', 'Canales e IA operan bajo control humano', 'WhatsApp se configura por proyecto y las credenciales no se comparten. La IA estructura información y propone; una persona autorizada decide las acciones sensibles.', 'CREDENCIALES AISLADAS · APROBACIÓN · TRAZABILIDAD'],
];

const faqs = [
  ['¿La cuadrilla tiene que instalar una app?', 'No para los flujos principales. La propuesta es operar desde WhatsApp mediante mensajes, ubicación y WhatsApp Flows. El panel web queda para supervisión, planificación y administración.'],
  ['¿ObraSaaS reemplaza un ERP o una plataforma BIM?', 'No. Funciona como capa operativa entre campo y gestión. Las integraciones específicas con ERP, BIM o analítica se habilitan sólo después de conectar y validar el proveedor correspondiente.'],
  ['¿La IA modifica el cronograma o compra sin control?', 'No. La versión actual clasifica información y propone acciones, pero no emite órdenes ni mensajes externos. Los cambios operativos permitidos dependen del rol y quedan registrados.'],
  ['¿Puede funcionar en varias obras y empresas?', 'Puede operar varias obras dentro de una empresa. Cada empresa se mantiene como un tenant separado. La consolidación multiempresa y las integraciones dedicadas todavía requieren alcance e implementación específicos.'],
  ['¿Qué se necesita para conectar WhatsApp oficial?', 'Una cuenta comercial de Meta, un WABA, un número habilitado, plantillas aprobadas, webhook HTTPS y credenciales de Cloud API. Para un SaaS multicliente también corresponde implementar Embedded Signup.'],
];

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ObraSaaS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, WhatsApp',
  inLanguage: 'es',
  description: 'Plataforma operativa para convertir voz, fotos y formularios de campo en evidencia, avance y decisiones trazables.',
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

function Logo() {
  return <ObraSaasLogo className={styles.logo} markSize={30} />;
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
        <Link href="/" className={styles.brand} aria-label="ObraSaaS, inicio"><Logo /></Link>
        <nav className={styles.nav} aria-label="Navegación principal">
          <a href="#plataforma">Plataforma</a><a href="#confianza">Confianza</a><a href="#sectores">Sectores</a><a href="#precios">Precios</a><a href="#preguntas">Preguntas</a>
        </nav>
        <div className={styles.headerActions}><Link href="/sign-in" className={styles.quietLink}>Iniciar sesión</Link><Link href="/sign-up" className={styles.compactCta}>Probar 14 días <ArrowIcon /></Link><MobileNavigation /></div>
      </header>

      <main id="contenido">
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span className={styles.liveDot} />De WhatsApp al control de obra</div>
          <h1>La obra habla. ObraSaaS la convierte en <span>avance, evidencia y decisiones.</span></h1>
          <p>La cuadrilla reporta con voz, fotos, ubicación y formularios desde el canal que ya usa. Dirección recibe contexto ordenado, propuestas revisables y una bitácora trazable, sin obligar al campo a aprender otra app.</p>
          <div className={styles.heroActions}><Link href="/sign-up" className={styles.primaryCta}>Probar gratis 14 días <ArrowIcon /></Link><a href="#plataforma" className={styles.secondaryCta}>Ver el recorrido</a></div>
          <div className={styles.heroProof} aria-label="Condiciones principales"><span><CheckIcon /> Sin app nueva para la cuadrilla</span><span><CheckIcon /> Aprobación humana antes de actuar</span><span><CheckIcon /> Empresa y obra aisladas</span></div>
          <div className={styles.heroMeta} aria-label="Capacidades destacadas"><span>WhatsApp por proyecto</span><i /><span>Bandeja</span><i /><span>Gantt</span><i /><span>Reportes</span><i /><span>Auditoría</span></div>
        </div>
        <div className={styles.heroProduct}><ProductExperience /></div>
      </section>

      <section className={styles.audienceStrip} aria-label="Sectores objetivo"><span>Construido para</span><strong>Estudios e inspección</strong><i /><strong>Constructoras</strong><i /><strong>Obra pública</strong><i /><strong>Desarrolladores y mandantes</strong></section>

      <PlatformTour />

      <section className={styles.trust} id="confianza">
        <div className={styles.trustIntro}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>Confianza verificable</span>
            <h2>La automatización sirve cuando cada dato, permiso y decisión se puede revisar.</h2>
            <p>ObraSaaS no presenta a la IA como una caja negra. La plataforma separa organizaciones y obras, limita acciones por rol y conserva una bitácora de lo que ocurrió. Las integraciones externas se activan con los activos y credenciales de cada tenant.</p>
          </div>
          <div className={styles.trustPrinciple}>
            <span aria-hidden="true">03</span>
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
            <div><a href="#contacto" className={styles.primaryCta}>Solicitar piloto <ArrowIcon /></a><Link href="/sign-up" className={styles.secondaryCta}>Probar 14 días</Link></div>
          </div>
        </div>
      </section>

      <section className={styles.positioning}>
        <div className={styles.positioningCopy}><span className={styles.sectionKicker}>Nuestra ventaja</span><h2>No es otra app que la cuadrilla tiene que recordar abrir.</h2><p>Las plataformas globales demostraron el valor de una fuente única de verdad. ObraSaaS acerca esa disciplina al canal que el campo latinoamericano ya usa todos los días.</p><ul><li><CheckIcon /><span><strong>Adopción primero.</strong> WhatsApp en campo, panel especializado en oficina.</span></li><li><CheckIcon /><span><strong>IA con control.</strong> Estructura información y propone acciones dentro de reglas y permisos.</span></li><li><CheckIcon /><span><strong>Arquitectura extensible.</strong> Los proveedores externos se conectan y validan antes de presentarlos como productivos.</span></li></ul></div>
        <div className={styles.architectureCard}>
          <div className={styles.architectureHeader}><span>Arquitectura operativa</span><small>Núcleo actual + perímetro planificado</small></div>
          <div className={styles.architectureStack}><div><span className={styles.nodeIcon}>WA</span><p><strong>Canales de campo</strong><small>WhatsApp · webviews · sensores</small></p></div><i aria-hidden="true" /><div><span className={styles.nodeIcon}>AI</span><p><strong>Motor ObraSaaS</strong><small>Identidad · intención · políticas</small></p></div><i aria-hidden="true" /><div><span className={styles.nodeIcon}>OS</span><p><strong>Registro operativo</strong><small>Gantt · RRHH · stock · evidencia</small></p></div></div>
          <div className={styles.architectureOutput}><span>PDF activo</span><span>API roadmap</span><span>ERP roadmap</span><span>BIM demo</span><span>BI roadmap</span></div>
        </div>
      </section>

      <section className={styles.sectors} id="sectores">
        <div className={styles.sectionIntro}><span className={styles.sectionKicker}>Una plataforma, distintas responsabilidades</span><h2>La misma evidencia, presentada para quien tiene que actuar.</h2></div>
        <div className={styles.audienceCards}>{audiences.map(([role, title, copy, outcomes]) => <article key={role}><span>{role}</span><h3>{title}</h3><p>{copy}</p><ul>{outcomes.map((outcome) => <li key={outcome}><CheckIcon /> {outcome}</li>)}</ul></article>)}</div>
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
                <h3>{plan.name}</h3>
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
                : <a href="#contacto" className={plan.key === 'PRO' ? styles.primaryCta : styles.secondaryCta}>Solicitar piloto <ArrowIcon /></a>}
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

      <footer className={styles.footer}><div><Logo /><p>Tecnología de obra diseñada en Argentina para operar globalmente.</p></div><div className={styles.footerLinks}><a href="#plataforma">Recorrido</a><a href="#confianza">Confianza</a><a href="#sectores">Sectores</a><Link href="/sign-in">Ingresar</Link><Link href="/privacy">Privacidad</Link><Link href="/terms">Términos</Link><Link href="/data-deletion">Eliminar datos</Link><a href="#contacto">Contacto</a></div><p>© 2026 ObraSaaS · Operado desde Argentina</p></footer>
    </div>
  );
}
