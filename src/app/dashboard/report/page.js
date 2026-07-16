import Link from 'next/link';
import { getAppState, getMessages } from '@/lib/db';
import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { buildWeeklyReportModel } from '@/lib/reporting';
import {
  MEDICAL_EVIDENCE_PERMISSION,
  SOURCE_EVIDENCE_PERMISSION,
  sanitizeProjectStateMedicalData,
} from '@/lib/medical-privacy';
import ReportActions from './report-actions';
import styles from './report.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: { absolute: 'Reporte semanal | ObraSaaS' },
  robots: { index: false, follow: false },
};

function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    ...options,
  }).format(value);
}

function StatusBadge({ tone = 'neutral', children }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

function EmptyRow({ columns, children }) {
  return <tr><td className={styles.emptyCell} colSpan={columns}>{children}</td></tr>;
}

function taskPlanLabel(task) {
  if (task.startDate && task.endDate) {
    return `${formatDate(task.startDate, { timeZone: 'UTC', day: '2-digit', month: 'short' })} — ${formatDate(task.endDate, { timeZone: 'UTC', day: '2-digit', month: 'short' })}`;
  }
  return `Día ${task.startDay} — ${task.endDay}`;
}

export default async function ReportPage({ searchParams }) {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:reports:read');
  const includeMedicalEvidence = hasTenantPermission(
    access,
    MEDICAL_EVIDENCE_PERMISSION,
  );
  const includeSourceEvidence = hasTenantPermission(
    access,
    SOURCE_EVIDENCE_PERMISSION,
  );

  const prisma = getPrisma();
  const [state, messages, snapshot] = await Promise.all([
    getAppState(access),
    getMessages(access, {
      includeMedicalEvidence,
      includeSourceEvidence,
    }),
    prisma.projectSnapshot.findUnique({
      where: { projectId: access.project.id },
      select: { updatedAt: true, version: true },
    }),
  ]);
  const query = await searchParams;
  const report = buildWeeklyReportModel({
    state: sanitizeProjectStateMedicalData(state),
    messages,
    organization: access.organization,
    project: access.project,
    actorEmail: access.email,
    generatedAt: new Date(),
    snapshot,
  });

  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <Link href="/dashboard" className={styles.backLink}>← Volver al centro operativo</Link>
          <p>Documento tenant-aware · preparado para impresión A4 y exportación PDF.</p>
        </div>
        <ReportActions autoPrint={query?.print === 'true'} />
      </div>

      <article className={styles.report} aria-labelledby="report-title">
        <header className={styles.header}>
          <div className={styles.brandBlock}>
            <div className={styles.mark} aria-hidden="true">OS</div>
            <div>
              <strong>ObraSaaS</strong>
              <span>Control operativo y evidencia de obra</span>
            </div>
          </div>
          <div className={styles.documentMeta}>
            <p>Reporte ejecutivo semanal</p>
            <h1 id="report-title">{report.projectName}</h1>
            <span>{report.reportId}</span>
          </div>
        </header>

        <section className={styles.contextGrid} aria-label="Contexto del reporte">
          <div><span>Organización</span><strong>{report.organizationName}</strong></div>
          <div><span>Período</span><strong>{formatDate(report.periodStart, { day: '2-digit', month: 'short' })} — {formatDate(report.generatedAt, { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
          <div><span>Ubicación</span><strong>{report.projectAddress}</strong></div>
          <div><span>Actualización</span><strong>{report.lastUpdatedAt ? formatDate(report.lastUpdatedAt, { dateStyle: 'short', timeStyle: 'short' }) : 'Sin actividad persistida'}</strong></div>
        </section>

        {report.isEmptyState && (
          <div className={styles.emptyNotice} role="note">
            <strong>Reporte sin actividad.</strong> Este tenant todavía no registró datos operativos persistidos; los indicadores permanecen vacíos o en cero y no representan una obra real.
          </div>
        )}

        <section className={styles.metrics} aria-label="Resumen ejecutivo">
          <article><span>Avance físico</span><strong>{report.progress}%</strong><small>{report.tasksDone} de {report.tasks.length} tareas finalizadas</small></article>
          <article><span>Plazo consumido</span><strong>{report.timelinePercentage}%</strong><small>Día {report.currentDay} de {report.totalDays}</small></article>
          <article><span>Alertas abiertas</span><strong>{report.alertsCount}</strong><small>{report.criticalIncidents} de prioridad alta</small></article>
          <article><span>Presentismo</span><strong>{report.presentWorkers}/{report.attendance.length}</strong><small>personas registradas hoy</small></article>
        </section>

        <section className={styles.executiveSummary}>
          <div>
            <span className={styles.sectionKicker}>Lectura ejecutiva</span>
            <h2>Estado consolidado de la semana</h2>
          </div>
          <p>{report.executiveSummary}</p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div><span className={styles.sectionKicker}>Planificación</span><h2>Cronograma y responsables</h2></div>
            <StatusBadge tone={report.scheduleConflicts > 0 ? 'danger' : report.timelinePercentage > report.progress + 10 ? 'warning' : 'success'}>
              {report.scheduleConflicts > 0
                ? `${report.scheduleConflicts} conflicto${report.scheduleConflicts === 1 ? '' : 's'} de secuencia`
                : report.timelinePercentage > report.progress + 10 ? 'Revisar desvío' : 'Dentro de tolerancia'}
            </StatusBadge>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Tarea</th><th>Responsable</th><th>Plan</th><th>Predecesoras</th><th>Estado</th><th>Progreso</th></tr></thead>
              <tbody>
                {report.tasks.length === 0 ? <EmptyRow columns={6}>No hay tareas registradas.</EmptyRow> : report.tasks.map((task) => (
                  <tr key={task.id}>
                    <td><strong>{task.name}</strong></td>
                    <td>{task.assignee}</td>
                    <td>{taskPlanLabel(task)}</td>
                    <td>{task.dependencyNames.length > 0 ? task.dependencyNames.join(', ') : 'Sin predecesoras'}</td>
                    <td><StatusBadge tone={task.tone}>{task.status}</StatusBadge></td>
                    <td><div className={styles.progress}><span style={{ width: `${task.progress}%` }} /></div><strong>{task.progress}%</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className={styles.twoColumns}>
          <section className={styles.section}>
            <div className={styles.sectionHeading}><div><span className={styles.sectionKicker}>Campo</span><h2>Asistencia</h2></div></div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Persona</th><th>Función</th><th>Estado</th></tr></thead>
                <tbody>
                  {report.attendance.length === 0 ? <EmptyRow columns={3}>Sin registros de asistencia.</EmptyRow> : report.attendance.map((entry) => (
                    <tr key={entry.name}><td><strong>{entry.name}</strong></td><td>{entry.role}</td><td><StatusBadge tone={entry.tone}>{entry.status}</StatusBadge></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}><div><span className={styles.sectionKicker}>Abastecimiento</span><h2>Materiales críticos</h2></div></div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Material</th><th>Disponible</th><th>Estado</th></tr></thead>
                <tbody>
                  {report.stockpiles.length === 0 ? <EmptyRow columns={3}>Sin materiales registrados.</EmptyRow> : report.stockpiles.map((item) => (
                    <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.current} {item.unit}</td><td><StatusBadge tone={item.tone}>{item.status}</StatusBadge></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div><span className={styles.sectionKicker}>Trazabilidad</span><h2>Incidencias y evidencia</h2></div>
            <div className={styles.evidenceSummary}><strong>{report.evidenceCount}</strong> adjuntos · <strong>{report.audioCount}</strong> audios procesados</div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Evento</th><th>Detalle</th><th>Origen</th><th>Prioridad</th></tr></thead>
              <tbody>
                {report.incidents.length === 0 ? <EmptyRow columns={4}>No hay incidencias abiertas en el período.</EmptyRow> : report.incidents.map((incident) => (
                  <tr key={incident.id}><td><strong>{incident.title}</strong></td><td>{incident.description}</td><td>{incident.reporter}</td><td><StatusBadge tone={incident.tone}>{incident.label}</StatusBadge></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.financialNote}>
          <div><span className={styles.sectionKicker}>Control económico</span><h2>{report.budget ? 'Presupuesto operativo informado' : 'Presupuesto pendiente de configuración'}</h2></div>
          {report.budget ? (
            <div className={styles.budgetGrid}>
              <div><span>Total</span><strong>{report.budget.formattedTotal}</strong></div>
              <div><span>Ejecutado</span><strong>{report.budget.formattedExecuted}</strong></div>
              <div><span>Disponible</span><strong>{report.budget.formattedRemaining}</strong></div>
            </div>
          ) : (
            <p>ObraSaaS no inventa montos: el tenant debe cargar el presupuesto contractual antes de incorporarlo a reportes ejecutivos.</p>
          )}
        </section>

        <footer className={styles.footer}>
          <div><span>Emitido por</span><strong>{report.issuedBy}</strong><small>{report.issuedByEmail}</small></div>
          <div><span>Control documental</span><strong>Versión {report.snapshotVersion}</strong><small>Datos aislados por tenant</small></div>
          <div><span>Generado</span><strong>{formatDate(report.generatedAt, { dateStyle: 'short', timeStyle: 'short' })}</strong><small>America/Argentina/Buenos_Aires</small></div>
        </footer>
      </article>
    </main>
  );
}
