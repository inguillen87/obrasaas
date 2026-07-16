import Link from 'next/link';

import ReportMilestoneAction from './report-milestone-action';
import styles from './getting-started.module.css';
import {
  FIRST_VALUE_REPORT_ACTION,
  countMeaningfulReportGenerations,
  deriveFirstValueReadiness,
} from '@/lib/first-value-onboarding';
import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { getAppStateSnapshot } from '@/lib/db';
import { getPrisma } from '@/lib/prisma';
import { isUnconfiguredTenantBootstrapProject } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Primer valor | ObraSaaS',
  robots: { index: false, follow: false },
};

const DATE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
});

function MilestoneAction({ action }) {
  return (
    <Link
      className={action.primary ? styles.primaryAction : styles.secondaryAction}
      href={action.href}
    >
      {action.label}<span aria-hidden="true">→</span>
    </Link>
  );
}

function MilestoneCard({ milestone, number, isCurrent, reportGenerated }) {
  const state = milestone.complete
    ? 'complete'
    : milestone.blocked ? 'blocked' : isCurrent ? 'current' : 'pending';
  const stateLabel = state === 'complete'
    ? 'Confirmado'
    : state === 'blocked' ? 'Requiere administrador' : state === 'current' ? 'Próximo paso' : 'Disponible';

  return (
    <article className={`${styles.milestone} ${styles[state]}`}>
      <div className={styles.marker} aria-hidden="true">
        {milestone.complete ? <i className="fa-solid fa-check" /> : String(number).padStart(2, '0')}
      </div>
      <div className={styles.milestoneBody}>
        <div className={styles.milestoneTopline}>
          <div>
            <p>{milestone.eyebrow}</p>
            <h2>{milestone.title}</h2>
          </div>
          <span>{stateLabel}</span>
        </div>
        <p className={styles.description}>{milestone.description}</p>
        <div className={styles.evidence}>
          <i className="fa-solid fa-database" aria-hidden="true" />
          <div><span>Señal real</span><strong>{milestone.signal}</strong></div>
        </div>
        <div className={styles.actions}>
          {milestone.actions.map((action) => (
            <MilestoneAction action={action} key={`${action.href}-${action.label}`} />
          ))}
          {milestone.key === 'report' && (
            <ReportMilestoneAction compact generated={reportGenerated} />
          )}
          {milestone.blocked && (
            <small>Tu rol puede consultar este estado, pero no modificarlo.</small>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function GettingStartedPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:projects:read');
  const prisma = getPrisma();
  const reportAuditWhere = {
    organizationId: access.organization.id,
    action: FIRST_VALUE_REPORT_ACTION,
    entityId: access.project.id,
  };

  const [
    snapshot,
    activeMembershipCount,
    activeFieldWorkerCount,
    inboundMessageCount,
    whatsapp,
    lastReport,
    meaningfulReportEvents,
  ] = await Promise.all([
    getAppStateSnapshot(access),
    prisma.tenantMembership.count({
      where: { organizationId: access.organization.id, status: 'ACTIVE' },
    }),
    prisma.worker.count({
      where: { projectId: access.project.id, active: true },
    }),
    prisma.message.count({
      where: {
        direction: 'INBOUND',
        conversation: { projectId: access.project.id },
      },
    }),
    prisma.whatsAppConnection.findUnique({
      where: { projectId: access.project.id },
      select: {
        enabled: true,
        connectionStatus: true,
        displayPhoneNumber: true,
        verifiedBusinessName: true,
        lastVerifiedAt: true,
      },
    }),
    prisma.auditLog.findFirst({
      where: reportAuditWhere,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, metadata: true },
    }),
    prisma.auditLog.findMany({
      where: {
        ...reportAuditWhere,
        metadata: { path: ['emptyState'], equals: false },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { createdAt: true, metadata: true },
    }),
  ]);

  const lastMeaningfulReport = meaningfulReportEvents[0] || null;

  const projectConfigured = !isUnconfiguredTenantBootstrapProject(access.project);
  const whatsappConnected = Boolean(
    whatsapp?.enabled && whatsapp.connectionStatus === 'CONNECTED',
  );
  const readiness = deriveFirstValueReadiness({
    activeFieldWorkerCount,
    activeMembershipCount,
    inboundMessageCount,
    projectConfigured,
    reportGenerationCount: countMeaningfulReportGenerations(meaningfulReportEvents),
    state: snapshot.state,
    whatsappConnected,
  });

  const canManageProjects = hasTenantPermission(access, 'org:projects:manage');
  const canManagePeople = hasTenantPermission(access, 'org:field:manage')
    || hasTenantPermission(access, 'tenant:members:manage');
  const canManageIntegrations = hasTenantPermission(access, 'org:integrations:manage');
  const canViewTeam = hasTenantPermission(access, 'tenant:members:read');
  const connectionIdentity = whatsapp?.verifiedBusinessName
    || whatsapp?.displayPhoneNumber
    || 'activo verificado por Meta';

  const milestones = [
    {
      key: 'project',
      eyebrow: 'Contexto operativo',
      title: 'Configurá la primera obra',
      description: 'Definí un perímetro real para separar cronograma, cuadrilla, evidencias y credenciales desde el inicio.',
      complete: readiness.completion.project,
      blocked: !canManageProjects && !readiness.completion.project,
      signal: projectConfigured
        ? `${access.project.name} · ${access.project.address || 'ubicación todavía opcional'}`
        : 'El perímetro bootstrap “Obra principal” sigue sin configurar',
      actions: canManageProjects
        ? [{ href: projectConfigured ? '/dashboard/projects' : '/dashboard/projects#configure-first-project', label: projectConfigured ? 'Gestionar obras' : 'Configurar obra', primary: !projectConfigured }]
        : [{ href: '/dashboard/projects', label: 'Ver portfolio' }],
    },
    {
      key: 'people',
      eyebrow: 'Responsables',
      title: 'Agregá la primera persona',
      description: 'Podés invitar un usuario de plataforma o autorizar una persona de campo con su propio rol y teléfono.',
      complete: readiness.completion.people,
      blocked: !canManagePeople && !readiness.completion.people,
      signal: `${readiness.counts.activeMemberships} acceso${readiness.counts.activeMemberships === 1 ? '' : 's'} activo${readiness.counts.activeMemberships === 1 ? '' : 's'} · ${readiness.counts.activeFieldWorkers} persona${readiness.counts.activeFieldWorkers === 1 ? '' : 's'} de campo`,
      actions: canViewTeam
        ? [{ href: '/dashboard/team#field-workers-title', label: readiness.completion.people ? 'Revisar equipo' : 'Agregar persona', primary: !readiness.completion.people }]
        : [],
    },
    {
      key: 'task',
      eyebrow: 'Plan maestro',
      title: 'Creá la primera tarea',
      description: 'Armá una línea base con responsable, duración, avance y predecesoras; queda persistida dentro de esta obra.',
      complete: readiness.completion.task,
      blocked: !canManageProjects && !readiness.completion.task,
      signal: readiness.counts.tasks > 0
        ? `${readiness.counts.tasks} tarea${readiness.counts.tasks === 1 ? '' : 's'} en el snapshot v${snapshot.version}`
        : `Snapshot v${snapshot.version} sin tareas registradas`,
      actions: [{
        href: '/dashboard?tab=sec-gantt',
        label: readiness.completion.task ? 'Abrir cronograma' : canManageProjects ? 'Crear tarea' : 'Ver cronograma',
        primary: canManageProjects && !readiness.completion.task,
      }],
    },
    {
      key: 'fieldFlow',
      eyebrow: 'Canal de campo',
      title: 'Probá el flujo o conectá Meta',
      description: 'Una prueba local sirve para validar la experiencia. WhatsApp sólo figura conectado cuando Cloud API confirma el activo del tenant.',
      complete: readiness.completion.fieldFlow,
      blocked: false,
      signal: whatsappConnected
        ? `Meta conectado · ${connectionIdentity}`
        : readiness.counts.inboundMessages > 0
          ? `${readiness.counts.inboundMessages} entrada${readiness.counts.inboundMessages === 1 ? '' : 's'} local${readiness.counts.inboundMessages === 1 ? '' : 'es'} registrada${readiness.counts.inboundMessages === 1 ? '' : 's'} · Meta sin conectar`
          : 'Sin entradas registradas · Meta sin conectar',
      actions: [
        {
          href: '/dashboard?tab=sec-whatsapp',
          label: whatsappConnected ? 'Abrir operación' : 'Probar flujo local',
          primary: !readiness.completion.fieldFlow,
        },
        ...(!whatsappConnected && canManageIntegrations
          ? [{ href: '/dashboard/integrations', label: 'Conectar Meta' }]
          : []),
      ],
    },
    {
      key: 'report',
      eyebrow: 'Primer entregable',
      title: 'Generá el primer reporte',
      description: 'ObraSaaS compone el reporte con los datos actuales, registra la generación en la bitácora y abre la vista lista para guardar como PDF.',
      complete: readiness.completion.report,
      blocked: false,
      signal: lastMeaningfulReport
        ? `Reporte con datos generado el ${DATE_FORMATTER.format(lastMeaningfulReport.createdAt)}`
        : lastReport?.metadata?.emptyState === true
          ? `Último intento vacío el ${DATE_FORMATTER.format(lastReport.createdAt)} · el hito sigue pendiente`
          : readiness.completion.task
            ? 'Datos listos; todavía no hay una generación registrada'
            : 'El reporte puede abrirse, pero permanecerá vacío hasta registrar actividad',
      actions: lastMeaningfulReport ? [{ href: '/dashboard/report', label: 'Revisar reporte' }] : [],
    },
  ];

  const nextMilestone = milestones.find((milestone) => milestone.key === readiness.nextKey);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.back}>← Volver al centro operativo</Link>
        <div className={styles.headerGrid}>
          <div>
            <p className={styles.eyebrow}>Primer valor · puesta en marcha</p>
            <h1>De tenant vacío a una operación demostrable.</h1>
            <p className={styles.lead}>
              Cinco hitos verificables para que {access.organization.name} pueda planificar,
              operar y emitir su primer reporte sin contratar ningún servicio adicional.
            </p>
          </div>
          <div className={styles.contextCard}>
            <span>Contexto activo</span>
            <strong>{access.project.name}</strong>
            <small>{access.organization.name} · {access.tenantRole}</small>
          </div>
        </div>
      </header>

      <section className={styles.progressCard} aria-labelledby="activation-progress-title">
        <div className={styles.progressCopy}>
          <span>Activación operativa</span>
          <strong id="activation-progress-title">{readiness.completed} de {readiness.total} hitos confirmados</strong>
          <p>
            {readiness.completed === readiness.total
              ? 'La base de primer valor está completa. El próximo salto es repetir el circuito con datos reales de campo.'
              : `Próximo foco: ${nextMilestone?.title || 'revisar la operación'}.`}
          </p>
        </div>
        <div className={styles.progressMetric}>
          <strong>{readiness.percentage}%</strong>
          <span>confirmado</span>
        </div>
        <div className={styles.progressTrack} aria-hidden="true">
          <i style={{ width: `${readiness.percentage}%` }} />
        </div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.timeline} aria-label="Hitos de primer valor">
          {milestones.map((milestone, index) => (
            <MilestoneCard
              isCurrent={milestone.key === readiness.nextKey}
              key={milestone.key}
              milestone={milestone}
              number={index + 1}
              reportGenerated={Boolean(lastMeaningfulReport)}
            />
          ))}
        </section>

        <aside className={styles.sideRail}>
          <section className={styles.nextCard}>
            <span className={styles.eyebrow}>{readiness.nextKey ? 'Siguiente acción' : 'Circuito inicial completo'}</span>
            <h2>{nextMilestone?.title || 'Volvé a medir con datos reales'}</h2>
            <p>
              {nextMilestone?.description
                || 'Actualizá cronograma, canal y reporte cada semana para que la plataforma refleje la obra y no una demo estática.'}
            </p>
            {nextMilestone?.key === 'report' ? (
              <ReportMilestoneAction generated={Boolean(lastMeaningfulReport)} />
            ) : nextMilestone?.actions[0] ? (
              <MilestoneAction action={{ ...nextMilestone.actions[0], primary: true }} />
            ) : (
              <span className={styles.adminNote}>Un administrador del tenant debe completar este paso.</span>
            )}
          </section>

          <section className={styles.signalsCard}>
            <div><span>Obra</span><strong>{projectConfigured ? 'Configurada' : 'Bootstrap'}</strong></div>
            <div><span>Personas</span><strong>{readiness.counts.activeMemberships + readiness.counts.activeFieldWorkers}</strong></div>
            <div><span>Tareas</span><strong>{readiness.counts.tasks}</strong></div>
            <div><span>Canal</span><strong>{whatsappConnected ? 'Meta' : readiness.counts.inboundMessages ? 'Prueba local' : 'Pendiente'}</strong></div>
          </section>

          <section className={styles.truthCard}>
            <i className="fa-solid fa-shield-halved" aria-hidden="true" />
            <div>
              <strong>Progreso con evidencia</strong>
              <p>
                No usamos checkboxes manuales ni localStorage. Cada hito se calcula con registros
                del tenant, y una prueba local nunca se presenta como conexión de Meta.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
