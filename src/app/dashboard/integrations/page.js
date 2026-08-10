import IntegrationsClient from "./integrations-client";
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
  const access = await getPlatformAccess();
  requireTenantPermission(access, "org:integrations:manage");
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
            nunca comparte números, tokens ni cuentas de WhatsApp entre tenants.
          </p>
        </div>
        <div className={styles.projectBadge}>
          <span>Obra activa</span>
          <strong>{access.project.name}</strong>
        </div>
      </header>

      <IntegrationsClient
        key={channelHealth.connection?.updatedAt?.toISOString() || "unlinked"}
        appId={process.env.NEXT_PUBLIC_META_APP_ID || ""}
        configId={process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID || ""}
        platformReady={metaPlatformReady}
        pilotImportEnabled={pilotPanelEnabled}
        initialConnection={serializeConnection(channelHealth.connection)}
        initialHealth={channelHealth.readiness}
        initialHealthDiagnostics={channelHealth.diagnostics}
        initialFlowCatalog={getWhatsAppFlowCatalog()}
      />
      {pilotPanelEnabled && (
        <WhatsAppPilotImportPanel
          currentProjectId={access.project.id}
          targets={pilotImportCatalog.targets}
          targetEmptyState={pilotImportCatalog.emptyState}
          assets={pilotImportAssets}
        />
      )}
      <AiProcessingControls
        canManage={hasTenantPermission(access, "tenant:members:manage")}
        initialSettings={publicTenantAiSettings(access.organization.metadata)}
      />
    </div>
  );
}
