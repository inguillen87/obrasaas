import { databaseOrganizationIsInternal } from '@/lib/organization-policy';
import PilotConnectionProgress from './pilot-connection-progress';
import { readPilotConnectionProgress } from '@/lib/whatsapp/pilot-connection-progress';
import IntegrationsClient from "./integrations-client";
import PlatformPreflightPanel from "./platform-preflight-panel";
import PilotWorkspacePanel from "./pilot-workspace-panel";
import { inspectWhatsAppPlatformPrerequisites } from "@/lib/whatsapp/platform-preflight";
import AiProcessingControls from "./ai-processing-controls";
import WhatsAppPilotImportPanel from "./pilot-import-panel";
import {
  loadWhatsAppPilotImportTargetCatalog,
  whatsappPilotImportPanelEnabled,
} from "./pilot-import-targets";
import styles from "./integrations.module.css";
import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from "@/lib/access";
import { publicTenantAiSettings } from "@/lib/ai/tenant-settings";
import { resolvePageAccess } from "@/lib/page-access";
import { getPrisma } from "@/lib/prisma";
import { loadWhatsAppChannelHealth } from "@/lib/whatsapp/channel-health";
import { getWhatsAppFlowCatalog } from "@/lib/whatsapp/flows";
import { listAllowedWhatsAppPilotAssets } from "@/lib/whatsapp/pilot-import";

export const dynamic = "force-dynamic";

function serializeConnection(connection) {
  if (!connection) return null;
  return {
    linked: Boolean(connection.phoneNumberId && connection.whatsappBusinessId),
    whatsappBusinessId: connection.whatsappBusinessId,
    displayPhoneNumber: connection.displayPhoneNumber,
    verifiedBusinessName: connection.verifiedBusinessName,
    enabled: connection.enabled,
    connectionStatus: connection.connectionStatus,
    lastVerifiedAt: connection.lastVerifiedAt?.toISOString() || null,
  };
}

export default async function IntegrationsPage() {
  const access = await resolvePageAccess(async () => {
    const candidate = await getPlatformAccess();
    requireTenantPermission(candidate, "org:integrations:manage");
    return candidate;
  });
  const prisma = getPrisma();
  const pilotPanelEnabled = whatsappPilotImportPanelEnabled(
    process.env,
    access,
  );
  let pilotImportAssets = [];
  if (pilotPanelEnabled) {
    try {
      pilotImportAssets = listAllowedWhatsAppPilotAssets(
        process.env.WHATSAPP_PILOT_ALLOWED_ASSETS,
      );
    } catch {
      // The panel renders a fail-closed configuration state; the API independently
      // rejects every request until the exact Preview allowlist is valid.
    }
  }
  const [channelHealth, pilotImportCatalog] = await Promise.all([
    loadWhatsAppChannelHealth(prisma, {
      projectId: access.project.id,
    }),
    pilotPanelEnabled
      ? loadWhatsAppPilotImportTargetCatalog(prisma, access)
      : Promise.resolve({ targets: [], emptyState: null }),
  ]);
  const pilotProgress = pilotPanelEnabled ? await readPilotConnectionProgress(prisma, { targets: pilotImportCatalog.targets }).catch(() => ({ channels: [], unavailable: true })) : null;
  const metaPlatformReady = Boolean(
    process.env.META_APP_SECRET &&
      process.env.META_VERIFY_TOKEN &&
      process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY,
  );

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Canales de obra</p>
          <h1>Integraciones</h1>
          <p>
            Conectá los activos propios de {access.organization.name}. ObraSaaS
            mantiene separados los números, permisos y datos de cada empresa.
          </p>
        </div>
        <div className={styles.projectBadge}>
          <span>Obra activa</span>
          <strong>{access.project.name}</strong>
        </div>
      </header>

      {pilotPanelEnabled && <PilotConnectionProgress progress={pilotProgress} />}
      <IntegrationsClient
        key={access.organization.id + ":" + access.project.id + ":" + (channelHealth.connection?.updatedAt?.toISOString() || "unlinked")}
        organizationId={access.organization.id} projectId={access.project.id}
        companyName={access.organization.name} projectName={access.project.name}
        internalWorkspace={databaseOrganizationIsInternal(access.organization)}
        canReadInbox={hasTenantPermission(access, "org:conversations:read")}
        graphVersion={process.env.META_GRAPH_API_VERSION || "v25.0"}
        appId={process.env.NEXT_PUBLIC_META_APP_ID || ""}
        configId={process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID || ""}
        platformReady={metaPlatformReady}
        pilotImportEnabled={pilotPanelEnabled}
        initialConnection={serializeConnection(channelHealth.connection)}
        initialHealth={channelHealth.readiness}
        initialHealthDiagnostics={channelHealth.diagnostics}
        initialFlowCatalog={getWhatsAppFlowCatalog()}
      />
      {access.isSuperadmin && <details className={styles.technicalTools} id="platform-technical-tools">
        <summary>Administración técnica · solo ObraSaaS</summary>
        <p>Este panel es para configurar y probar la plataforma. No forma parte del alta de una empresa cliente.</p>
      {access.isSuperadmin && <PlatformPreflightPanel
        key={access.organization.id + ':' + access.project.id}
        organizationId={access.organization.id} projectId={access.project.id}
        initialConfiguration={inspectWhatsAppPlatformPrerequisites(process.env)} />}
      {pilotPanelEnabled && <PilotWorkspacePanel key={access.organization.id + ":" + access.project.id} organizationId={access.organization.id} projectId={access.project.id} />}
      {pilotPanelEnabled && (
        <WhatsAppPilotImportPanel
          currentProjectId={access.project.id}
          targets={pilotImportCatalog.targets}
          targetEmptyState={pilotImportCatalog.emptyState}
          assets={pilotImportAssets}
        />
      )}
      </details>}
      <AiProcessingControls
        canManage={hasTenantPermission(access, "tenant:members:manage")}
        initialSettings={publicTenantAiSettings(access.organization.metadata)}
      />
    </div>
  );
}
