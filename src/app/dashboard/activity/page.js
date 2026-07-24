import ActivityClient from './activity-client';
import styles from './activity.module.css';
import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import {
  isRestrictedEvidenceRecord,
  isRestrictedOperationalIncident,
  restrictedOperationalDescription,
} from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bitácora y auditoría',
  description: 'Trazabilidad operativa de una obra en ObraSaaS.',
  robots: { index: false, follow: false },
};

function jsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function truncate(value, max = 520) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function auditGroup(action) {
  if (action.startsWith('integration.')) return 'INTEGRATION';
  if (action.startsWith('tenant.') || action.startsWith('platform.')) return 'GOVERNANCE';
  return 'EXECUTION';
}

function auditLabel(action) {
  const labels = {
    'project.created': 'Obra creada',
    'project.updated': 'Obra actualizada',
    'project.archived': 'Obra archivada',
    'project.restored': 'Obra restaurada',
    'project.task.created': 'Tarea creada',
    'project.task.updated': 'Tarea actualizada',
    'project.task.deleted': 'Tarea eliminada',
    'project.incident.created': 'Incidencia registrada',
    'project.material.received': 'Ingreso de material',
    'project.material.adjusted': 'Ajuste de stock',
    'project.hr.bonus_awarded': 'Reconocimiento registrado',
    'tenant.membership.role_updated': 'Rol actualizado',
    'tenant.invitation.created': 'Invitación creada',
    'tenant.invitation.revoked': 'Invitación revocada',
    'integration.whatsapp.connected': 'WhatsApp conectado',
    'integration.whatsapp.disabled': 'WhatsApp desconectado',
    'integration.whatsapp.flow_created': 'Flow creado',
    'integration.whatsapp.flow_updated': 'Flow actualizado',
    'voice.proposal.created': 'Propuesta operativa creada',
    'voice.proposal.applied': 'Propuesta operativa aprobada y aplicada',
    'voice.proposal.rejected': 'Propuesta operativa rechazada',
    'voice.proposal.expired': 'Propuesta operativa vencida',
    'voice.proposal.invalidated': 'Propuesta operativa invalidada',
    'operational.proposal.dashboard_decision': 'Decisión desde la bandeja de aprobaciones',
    'platform.tenant.subscription_updated': 'Suscripción actualizada',
  };
  return labels[action] || action.split('.').join(' · ');
}

function actorLabel(actor) {
  return actor?.fullName || actor?.primaryEmail || 'Sistema ObraSaaS';
}

function auditEntry(log) {
  const metadata = jsonObject(log.metadata);
  const projectActivity = log.entityType === 'ProjectActivity';
  const restricted = isRestrictedOperationalIncident({
    title: metadata.title,
    description: metadata.description,
    category: metadata.category,
    action: log.action,
    metadata: {
      kind: metadata.kind,
      sourceContentRestricted: metadata.sourceContentRestricted,
      detailRestricted: metadata.detailRestricted,
    },
  });
  return {
    id: `audit-${log.id}`,
    occurredAt: log.createdAt.toISOString(),
    group: auditGroup(log.action),
    category: projectActivity ? String(metadata.category || 'SYSTEM') : 'AUDIT',
    severity: projectActivity ? String(metadata.severity || 'INFO') : 'INFO',
    source: projectActivity ? String(metadata.source || 'dashboard') : 'auditoría',
    title: projectActivity
      ? restricted
        ? 'Reporte operativo restringido'
        : truncate(metadata.title, 180)
      : auditLabel(log.action),
    description: projectActivity
      ? restricted
        ? restrictedOperationalDescription()
        : truncate(metadata.description)
      : `${actorLabel(log.actor)} · ${log.entityType}`,
    actor: actorLabel(log.actor),
    reference: log.action,
  };
}

function messageEntry(message) {
  const metadata = jsonObject(message.metadata);
  const inbound = message.direction === 'INBOUND';
  const sender = metadata.displayName || message.conversation.displayName || 'Canal de obra';
  const kind = message.kind === 'TEXT' ? 'mensaje' : message.kind.toLowerCase();
  const restricted = isRestrictedEvidenceRecord(message);
  return {
    id: `message-${message.id}`,
    occurredAt: message.sentAt.toISOString(),
    group: 'FIELD',
    category: 'MESSAGE',
    severity: 'INFO',
    source: message.conversation.channel || 'whatsapp',
    title: restricted
      ? 'Reporte de campo restringido'
      : inbound
        ? `Reporte recibido · ${sender}`
        : 'Respuesta de ObraSaaS',
    description: restricted
      ? restrictedOperationalDescription()
      : truncate(message.body || `${kind} sin texto`, 560),
    actor: restricted
      ? 'Canal protegido'
      : inbound
        ? sender
        : 'Asistente de obra',
    reference: `${inbound ? 'entrada' : 'salida'} · ${kind}`,
  };
}

function webhookEntry(event) {
  const failed = event.status === 'FAILED';
  return {
    id: `webhook-${event.id}`,
    occurredAt: event.createdAt.toISOString(),
    group: 'INTEGRATION',
    category: 'WEBHOOK',
    severity: failed ? 'CRITICAL' : event.status === 'PROCESSED' ? 'SUCCESS' : 'WARNING',
    source: event.provider,
    title: failed ? 'Evento de integración fallido' : 'Evento de integración procesado',
    description: truncate(event.lastError || event.eventType || 'Evento recibido por el canal configurado.'),
    actor: 'Infraestructura',
    reference: `${event.eventType} · ${event.status}`,
  };
}

function attendanceEntry(entry) {
  const eventType = entry.eventType || 'CHECK_IN';
  const verification = entry.verificationStatus || (
    entry.status === 'OUTSIDE_GEOFENCE' ? 'REVIEW_REQUIRED' : 'LEGACY'
  );
  const needsReview = verification === 'REVIEW_REQUIRED';
  const pending = verification === 'PENDING';
  const expired = verification === 'EXPIRED';
  const justifiedAbsence = entry.status === 'EXCUSED';
  const legacyAbsence = entry.status === 'ABSENT';
  const unclassifiedLegacy = verification === 'LEGACY' && !entry.shiftId;
  const labels = {
    CHECK_IN: 'Ingreso registrado',
    BREAK_START: 'Pausa iniciada',
    BREAK_END: 'Actividad retomada',
    CHECK_OUT: 'Salida registrada',
  };
  const title = justifiedAbsence
    ? 'Ausencia justificada registrada'
    : legacyAbsence
      ? 'Ausencia histórica sin clasificación canónica'
      : unclassifiedLegacy
        ? 'Registro histórico de asistencia'
        : pending
    ? 'Ingreso pendiente de ubicación'
    : expired
      ? 'Solicitud de ingreso vencida'
      : needsReview
        ? `${labels[eventType] || 'Fichaje registrado'} · revisar ubicación`
        : labels[eventType] || 'Fichaje registrado';
  const description = justifiedAbsence
    ? `${entry.worker.name} tiene una excepción justificada heredada; su fecha y vigencia requieren migración al ledger de excepciones.`
    : legacyAbsence
      ? `El registro histórico de ${entry.worker.name} no permite distinguir una ausencia laboral de un intento técnico vencido.`
      : unclassifiedLegacy
        ? `El registro de ${entry.worker.name} proviene del modelo anterior y no se interpreta como entrada, salida ni presencia verificada.`
        : needsReview
    ? `${entry.worker.name} informó una ubicación a ${entry.distanceMeters ?? '—'} m del punto configurado.`
    : pending
      ? `${entry.worker.name} inició el control y todavía no confirmó una ubicación válida.`
      : expired
        ? `El intento de ${entry.worker.name} venció sin convertirse en una ausencia laboral.`
        : `${entry.worker.name} registró ${eventType === 'CHECK_IN' ? 'su entrada' : eventType === 'CHECK_OUT' ? 'su salida' : eventType === 'BREAK_START' ? 'el inicio de una pausa' : 'el fin de una pausa'}.`;
  return {
    id: `attendance-${entry.id}`,
    occurredAt: (entry.occurredAt || entry.checkedInAt).toISOString(),
    group: 'FIELD',
    category: 'ATTENDANCE',
    severity: needsReview || pending || legacyAbsence
      ? 'WARNING'
      : expired || justifiedAbsence || unclassifiedLegacy
        ? 'INFO'
        : 'SUCCESS',
    source: entry.source || 'whatsapp',
    title,
    description,
    actor: entry.worker.name,
    reference: `${eventType} · ${verification}`,
  };
}

async function loadActivity(access) {
  const prisma = getPrisma();
  const projectId = access.project.id;
  const organizationId = access.organization.id;
  const [auditLogs, messages, webhooks, attendances] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        organizationId,
        OR: [
          { entityType: 'ProjectActivity', entityId: projectId },
          { entityType: 'Project', entityId: projectId },
          { entityType: { in: ['TenantMembership', 'ClerkOrganizationInvitation', 'Organization'] } },
          { metadata: { path: ['projectId'], equals: projectId } },
        ],
      },
      include: { actor: { select: { fullName: true, primaryEmail: true } } },
      orderBy: { createdAt: 'desc' },
      take: 120,
    }),
    prisma.message.findMany({
      where: { conversation: { projectId } },
      include: { conversation: { select: { displayName: true, channel: true } } },
      orderBy: { sentAt: 'desc' },
      take: 120,
    }),
    prisma.webhookEvent.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.attendanceEntry.findMany({
      where: { projectId },
      include: { worker: { select: { name: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 80,
    }),
  ]);

  const entries = [
    ...auditLogs.map(auditEntry),
    ...messages.map(messageEntry),
    ...webhooks.map(webhookEntry),
    ...attendances.map(attendanceEntry),
  ]
    .sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt))
    .slice(0, 250);

  const lastDay = Date.now() - 24 * 60 * 60 * 1_000;
  return {
    entries,
    metrics: {
      lastDay: entries.filter((entry) => new Date(entry.occurredAt).getTime() >= lastDay).length,
      fieldReports: entries.filter((entry) => entry.group === 'FIELD').length,
      critical: entries.filter((entry) => entry.severity === 'CRITICAL').length,
      governance: entries.filter((entry) => entry.group === 'GOVERNANCE').length,
    },
  };
}

export default async function ActivityPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:projects:read');
  const activity = await loadActivity(access);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Trazabilidad por obra</p>
          <h1>Bitácora y auditoría.</h1>
          <p>
            {access.project.name} · eventos del campo, decisiones del equipo y salud de las
            integraciones dentro del perímetro de {access.organization.name}.
          </p>
        </div>
        <div className={styles.scopeBadge}>
          <span>Contexto verificado</span>
          <strong>{access.project.name}</strong>
          <small>Tenant y obra aislados</small>
        </div>
      </header>

      <ActivityClient
        entries={activity.entries}
        metrics={activity.metrics}
        organizationName={access.organization.name}
        projectName={access.project.name}
        timezone={access.organization.timezone}
      />
    </div>
  );
}
