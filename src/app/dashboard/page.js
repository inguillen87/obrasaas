import DashboardClient from './dashboard-client';
import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { getAppStateSnapshot, getMessages } from '@/lib/db';
import { getPrisma } from '@/lib/prisma';
import { listCanonicalTasks } from '@/lib/canonical-tasks';
import { fieldWorkerWhatsAppRole } from '@/lib/field-workers';
import { publicTenantAiSettings } from '@/lib/ai/tenant-settings';
import {
  MEDICAL_EVIDENCE_PERMISSION,
  SOURCE_EVIDENCE_PERMISSION,
  sanitizeProjectStateMedicalData,
} from '@/lib/medical-privacy';
import { redirect } from 'next/navigation';
import ProjectAccessRequired from './project-access-required';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Hoy',
  description: 'Prioridades, avance, equipo y riesgos de la obra activa.',
};

export default async function DashboardPage() {
  const access = await getPlatformAccess({ requireOrganization: false });
  if (!access.organization) {
    redirect('/session-tasks/choose-organization');
  }
  if (!access.project) return <ProjectAccessRequired access={access} />;
  requireTenantPermission(access, 'org:projects:read');

  const prisma = getPrisma();
  const canManageField = hasTenantPermission(access, 'org:field:manage');
  const canReadMedicalEvidence = hasTenantPermission(access, MEDICAL_EVIDENCE_PERMISSION);
  const canReadSourceEvidence = hasTenantPermission(access, SOURCE_EVIDENCE_PERMISSION);
  const canReadOperationalProposals = hasTenantPermission(
    access,
    'org:operational-proposals:read',
  );
  const canReadCanonicalTasks = hasTenantPermission(access, 'org:tasks:read');
  const canManageCanonicalTasks = hasTenantPermission(access, 'org:tasks:manage');
  const canUseReviewedEvidence = (
    canManageCanonicalTasks
    && canReadSourceEvidence
    && hasTenantPermission(access, 'org:execution:manage')
  );
  const aiSettings = publicTenantAiSettings(access.organization.metadata);
  const [
    initialSnapshot,
    initialMessages,
    whatsapp,
    membershipCount,
    fieldWorkers,
    pendingOperationalProposalCount,
    canonicalTasks,
  ] = await Promise.all([
    getAppStateSnapshot(access),
    getMessages(access, {
      includeMedicalEvidence: canReadMedicalEvidence,
      includeSourceEvidence: canReadSourceEvidence,
    }),
    prisma.whatsAppConnection.findUnique({
      where: { projectId: access.project.id },
      select: { enabled: true, connectionStatus: true, lastVerifiedAt: true },
    }),
    prisma.tenantMembership.count({
      where: { organizationId: access.organization.id, status: 'ACTIVE' },
    }),
    canManageField
      ? prisma.worker.findMany({
          where: { projectId: access.project.id, active: true },
          orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, name: true, role: true, metadata: true },
        })
      : Promise.resolve([]),
    canReadOperationalProposals
      ? prisma.operationalProposal.count({
          where: {
            projectId: access.project.id,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        })
      : Promise.resolve(0),
    canReadCanonicalTasks
      ? listCanonicalTasks(prisma, { projectId: access.project.id, limit: 5_000 })
      : Promise.resolve({ tasks: [], hasMore: false }),
  ]);
  return (
    <DashboardClient
      initialState={sanitizeProjectStateMedicalData(initialSnapshot.state, {
        includeAttendanceLocation: canReadSourceEvidence,
      })}
      initialMessages={initialMessages}
      setup={{
        initialLoadedAt: new Date().toISOString(),
        initialStateVersion: initialSnapshot.version,
        membershipCount,
        whatsappConnected: Boolean(
          whatsapp?.enabled && whatsapp.connectionStatus === 'CONNECTED',
        ),
        whatsappStatus: whatsapp?.connectionStatus || 'PENDING',
        whatsappLastVerifiedAt: whatsapp?.lastVerifiedAt?.toISOString() || null,
        isEmptyState: !initialSnapshot.exists,
        lastDataAt: initialSnapshot.updatedAt?.toISOString() || null,
        canManageProjects: hasTenantPermission(access, 'org:projects:manage'),
        canViewTeam: hasTenantPermission(access, 'tenant:members:read'),
        canManageIntegrations: hasTenantPermission(access, 'org:integrations:manage'),
        canReadOperationalProposals,
        canReadCanonicalTasks,
        canManageCanonicalTasks: hasTenantPermission(access, 'org:tasks:manage'),
        canUseReviewedEvidence,
        canonicalTasks: canonicalTasks.tasks,
        canonicalTasksHasMore: canonicalTasks.hasMore,
        canManageOperationalProposals: hasTenantPermission(
          access,
          'org:operational-proposals:manage',
        ),
        pendingOperationalProposalCount,
        aiSupervisorEnabled: aiSettings.supervisorEnabled,
        aiAudioTranscriptionEnabled: aiSettings.audioTranscriptionEnabled,
        canManageField,
        fieldWorkers: fieldWorkers.map((worker) => ({
          id: worker.id,
          name: worker.name,
          role: worker.role,
          whatsappRole: fieldWorkerWhatsAppRole(worker),
        })),
      }}
      platformAccess={{
        email: access.email,
        isSuperadmin: access.isSuperadmin,
        systemRole: access.systemRole,
        orgRole: access.orgRole,
        tenantRole: access.tenantRole,
        organization: {
          name: access.organization.name,
          plan: access.organization.subscriptionPlan,
          subscriptionStatus: access.organization.subscriptionStatus,
          trialEndsAt: access.organization.trialEndsAt?.toISOString() || null,
        },
        project: {
          id: access.project.id,
          name: access.project.name,
          address: access.project.address,
          status: access.project.status,
          latitude: access.project.latitude == null ? null : Number(access.project.latitude),
          longitude: access.project.longitude == null ? null : Number(access.project.longitude),
          geofenceMeters: access.project.geofenceMeters,
          startsAt: access.project.startsAt?.toISOString() || null,
          endsAt: access.project.endsAt?.toISOString() || null,
        },
      }}
    />
  );
}
