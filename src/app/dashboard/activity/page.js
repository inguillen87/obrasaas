import Link from 'next/link';

import ActivityClient from './activity-client';
import styles from './activity.module.css';
import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import {
  isMedicalEvidenceRecord,
  isMedicalIncident,
  medicalOperationalDescription,
} from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bitácora y auditoría | ObraSaaS',
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
  const medical = isMedicalIncident({
    title: metadata.title,
    category: metadata.category,
    action: log.action,
  });
  return {
    id: `audit-${log.id}`,
    occurredAt: log.createdAt.toISOString(),
    group: auditGroup(log.action),
    category: projectActivity ? String(metadata.category || 'SYSTEM') : 'AUDIT',
    severity: projectActivity ? String(metadata.severity || 'INFO') : 'INFO',
    source: projectActivity ? String(metadata.source || 'dashboard') : 'auditoría',
    title: projectActivity ? truncate(metadata.title, 180) : auditLabel(log.action),
    description: projectActivity
      ? medical
        ? medicalOperationalDescription()
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
  const medical = isMedicalEvidenceRecord(message);
  return {
    id: `message-${message.id}`,
    occurredAt: message.sentAt.toISOString(),
    group: 'FIELD',
    category: 'MESSAGE',
    severity: 'INFO',
    source: message.conversation.channel || 'whatsapp',
    title: inbound ? `Reporte recibido · ${sender}` : 'Respuesta de ObraSaaS',
    description: medical
      ? medicalOperationalDescription()
      : truncate(message.body || `${kind} sin texto`, 560),
    actor: inbound ? sender : 'Asistente de obra',
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
  const outside = entry.status === 'OUTSIDE_GEOFENCE';
  return {
    id: `attendance-${entry.id}`,
    occurredAt: entry.checkedInAt.toISOString(),
    group: 'FIELD',
    category: 'ATTENDANCE',
    severity: outside ? 'WARNING' : 'SUCCESS',
    source: entry.source || 'whatsapp',
    title: outside ? 'Fichaje fuera de geocerca' : 'Ingreso registrado',
    description: outside
      ? `${entry.worker.name} quedó a ${entry.distanceMeters ?? '—'} m del punto configurado.`
      : `${entry.worker.name} confirmó presencia en la obra.`,
    actor: entry.worker.name,
    reference: entry.status,
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
      orderBy: { checkedInAt: 'desc' },
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
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/dashboard" className={styles.back}>← Volver al centro operativo</Link>
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
    </main>
  );
}
