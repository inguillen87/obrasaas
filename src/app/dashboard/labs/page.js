import Image from 'next/image';

import styles from './labs.module.css';
import { getPlatformAccess, requireTenantPermission } from '@/lib/access';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Labs',
  description: 'Entorno de exploración tecnológica de ObraSaaS, separado de la operación real.',
  robots: { index: false, follow: false },
};

const LABS = [
  {
    id: 'vision',
    number: '02',
    icon: 'fa-camera',
    state: 'research',
    stateLabel: 'Investigación',
    eyebrow: 'Visión + prevención',
    title: 'Observaciones asistidas, nunca decisiones opacas.',
    description:
      'Evaluamos cómo detectar condiciones visibles y convertirlas en alertas revisables. No hay cámaras, streaming ni modelos de visión procesando esta obra.',
    evidence: [
      'Casos de uso y límites de decisión definidos.',
      'Revisión humana planteada como requisito obligatorio.',
    ],
    requirements: [
      'Cámaras y zonas expresamente autorizadas.',
      'Política de privacidad y retención aprobada.',
      'Dataset representativo con métricas acordadas.',
      'Protocolo de falsos positivos y escalamiento humano.',
    ],
    boundary: 'Sin dataset validado ni benchmark, no existe una función vendible.',
  },
  {
    id: 'iot',
    number: '03',
    icon: 'fa-tower-broadcast',
    state: 'offline',
    stateLabel: 'No conectado',
    eyebrow: 'IoT + abastecimiento',
    title: 'Telemetría que informa; personas que deciden.',
    description:
      'La hipótesis es anticipar faltantes y desvíos desde sensores o balanzas. Hoy no hay gateways, dispositivos ni telemetría vinculados a este tenant.',
    evidence: [
      'Escenario de abastecimiento documentado.',
      'Automatización de compra excluida hasta validar controles.',
    ],
    requirements: [
      'Inventario de dispositivos y protocolo técnico.',
      'Calibración en una obra piloto autorizada.',
      'Credenciales aisladas por tenant y monitoreo de salud.',
      'Umbrales, fallback offline y aprobación de compra.',
    ],
    boundary: 'Cero lecturas recibidas: cualquier número visible sería ficticio.',
  },
];

function StatusBadge({ state, children }) {
  return (
    <span className={`${styles.status} ${styles[`status_${state}`]}`}>
      <i className="fa-solid fa-circle" aria-hidden="true" />
      {children}
    </span>
  );
}

function Checklist({ items, title, variant = 'evidence' }) {
  return (
    <div className={styles.checklist}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <i
              className={`fa-solid ${variant === 'evidence' ? 'fa-check' : 'fa-arrow-right'}`}
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResearchCard({ lab }) {
  return (
    <article className={styles.researchCard} data-state={lab.state}>
      <div className={styles.cardTopline}>
        <div className={styles.cardIdentity}>
          <span className={styles.labNumber}>{lab.number}</span>
          <i className={`fa-solid ${lab.icon}`} aria-hidden="true" />
        </div>
        <StatusBadge state={lab.state}>{lab.stateLabel}</StatusBadge>
      </div>

      <p className={styles.cardEyebrow}>{lab.eyebrow}</p>
      <h2 id={`lab-${lab.id}-title`}>{lab.title}</h2>
      <p className={styles.cardDescription}>{lab.description}</p>

      <div className={styles.cardLists}>
        <Checklist items={lab.evidence} title="Evidencia disponible" />
        <Checklist items={lab.requirements} title="Requisitos de activación" variant="requirements" />
      </div>

      <footer className={styles.cardBoundary}>
        <i className="fa-solid fa-shield-halved" aria-hidden="true" />
        <div>
          <span>Límite actual</span>
          <strong>{lab.boundary}</strong>
        </div>
      </footer>
    </article>
  );
}

export default async function LabsPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:projects:read');

  return (
    <div className={styles.shell}>
      <div className={styles.gridTexture} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>ObraSaaS Labs · entorno experimental</p>
          <h1>Innovación visible.<br />Operación intacta.</h1>
          <p className={styles.lead}>
            Probamos BIM, visión e IoT en un perímetro separado. Cada capacidad muestra qué
            evidencia existe, qué falta y qué debe aprobarse antes de tocar una obra real.
          </p>
        </div>

        <aside className={styles.scopeCard} aria-label="Alcance del entorno Labs">
          <div className={styles.scopeIcon} aria-hidden="true">
            <i className="fa-solid fa-flask" />
          </div>
          <span>Perímetro actual</span>
          <strong>Laboratorio controlado</strong>
          <p><i className="fa-solid fa-lock" aria-hidden="true" /> Sin escritura operativa</p>
          <small>{access.organization.name} · {access.project.name}</small>
        </aside>
      </header>

      <section className={styles.truthBar} aria-labelledby="labs-truth-title">
        <div className={styles.truthStatement}>
          <i className="fa-solid fa-fingerprint" aria-hidden="true" />
          <div>
            <span>Regla de evidencia</span>
            <h2 id="labs-truth-title">Una idea no se presenta como producto.</h2>
            <p>
              Esta superficie no conecta proveedores, no ejecuta automatizaciones y no modifica
              datos de la obra. Los estados describen capacidad comprobada, no intención comercial.
            </p>
          </div>
        </div>
        <dl className={styles.truthMetrics}>
          <div><dt>Integraciones activadas desde Labs</dt><dd>0</dd></div>
          <div><dt>Líneas de exploración</dt><dd>3</dd></div>
          <div><dt>Control humano requerido</dt><dd>Siempre</dd></div>
        </dl>
      </section>

      <section className={styles.bimLab} aria-labelledby="lab-bim-title">
        <div className={styles.bimVisual}>
          <Image
            className={styles.bimImage}
            src="/bim_render.png"
            alt="Render conceptual de un modelo de edificio con sistemas MEP resaltados"
            fill
            priority
            sizes="(max-width: 980px) 100vw, 58vw"
          />
          <div className={styles.visualShade} aria-hidden="true" />
          <div className={styles.visualLabel}>
            <span>Artefacto disponible</span>
            <strong>Render estático · no es un visor conectado</strong>
          </div>
          <div className={styles.visualIndex} aria-hidden="true">LAB / 01</div>
        </div>

        <div className={styles.bimCopy}>
          <div className={styles.sectionTopline}>
            <p className={styles.cardEyebrow}>BIM + contexto operativo</p>
            <StatusBadge state="demo">Demo</StatusBadge>
          </div>
          <h2 id="lab-bim-title">Del modelo aislado a decisiones con contexto.</h2>
          <p className={styles.cardDescription}>
            El render permite discutir la experiencia objetivo: relacionar incidencias, documentos
            y avances con sectores del modelo. No hay IFC cargado, CDE sincronizado ni detección de
            interferencias ejecutándose detrás de esta imagen.
          </p>

          <div className={styles.bimEvidence}>
            <div>
              <span>Evidencia disponible</span>
              <strong>Un render conceptual identificado como demo.</strong>
            </div>
            <div>
              <span>Estado de conexión</span>
              <strong>Sin Autodesk, IFC ni proveedor BIM conectado.</strong>
            </div>
          </div>

          <div className={styles.activationBlock}>
            <h3>Para activar un piloto real</h3>
            <ol>
              <li><span>01</span><p><strong>Modelo autorizado</strong>IFC o proveedor y alcance contractual definidos.</p></li>
              <li><span>02</span><p><strong>Identidad de elementos</strong>Mapeo estable entre sectores, tareas e incidencias.</p></li>
              <li><span>03</span><p><strong>Permisos y auditoría</strong>Acceso por rol, trazabilidad y exportación verificadas.</p></li>
              <li><span>04</span><p><strong>Criterio de aceptación</strong>Casos reales medidos antes de llamarlo productivo.</p></li>
            </ol>
          </div>

          <footer className={styles.bimBoundary}>
            <i className="fa-solid fa-ban" aria-hidden="true" />
            <p><span>Hoy no hace</span> Navegar modelos, guardar marcas ni detectar clashes reales.</p>
          </footer>
        </div>
      </section>

      <section className={styles.researchGrid} aria-label="Líneas experimentales de ObraSaaS">
        {LABS.map((lab) => <ResearchCard key={lab.id} lab={lab} />)}
      </section>

      <section className={styles.releaseGate} aria-labelledby="release-gate-title">
        <div className={styles.releaseIntro}>
          <p className={styles.eyebrow}>Criterio de salida</p>
          <h2 id="release-gate-title">De experimento a capacidad operativa.</h2>
          <p>
            Ningún lab entra al producto por una demo convincente. Debe superar cuatro puertas con
            evidencia del tenant y una persona responsable de la decisión.
          </p>
        </div>
        <ol className={styles.gates}>
          <li><span>01</span><div><strong>Valor medible</strong><p>Problema, línea base y resultado esperado.</p></div></li>
          <li><span>02</span><div><strong>Datos autorizados</strong><p>Propiedad, privacidad, retención y acceso.</p></div></li>
          <li><span>03</span><div><strong>Operación segura</strong><p>Aislamiento, observabilidad, fallback y soporte.</p></div></li>
          <li><span>04</span><div><strong>Aceptación humana</strong><p>Piloto validado y responsable que autoriza producción.</p></div></li>
        </ol>
      </section>

      <footer className={styles.pageNote}>
        <i className="fa-solid fa-circle-info" aria-hidden="true" />
        <p>
          <strong>Labs no forma parte de las promesas operativas actuales.</strong>
          Cuando una capacidad alcance producción, tendrá conexión verificable, permisos por rol,
          auditoría y una definición comercial explícita.
        </p>
      </footer>
    </div>
  );
}
