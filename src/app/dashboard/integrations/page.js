import IntegrationsClient from "./integrations-client";
import AiProcessingControls from "./ai-processing-controls";
import WhatsAppPilotImportPanel from "./pilot-import-panel";
import {
  listWhatsAppPilotImportTargets,
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
    phoneNumberId: connection.phoneNumberId,
    whatsappBusinessId: connection.whatsappBusinessId,
    displayPhoneNumber: connection.displayPhoneNumber,
    verifiedBusinessName: connection.verifiedBusinessName,
    enabled: connection.enabled,
    connectionStatus: connection.connectionStatus,
    tokenLastFour: connection.tokenLastFour,
    embeddedSignupVersion: connection.embeddedSignupVersion,
    connectedAt: connection.connectedAt?.toISOString() || null,
    lastVerifiedAt: connection.lastVerifiedAt?.toISOString() || null,
    lastError: connection.lastError,
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
  const [channelHealth, pilotImportTargets] = await Promise.all([
    loadWhatsAppChannelHealth(prisma, {
      projectId: access.project.id,
    }),
    pilotPanelEnabled
      ? listWhatsAppPilotImportTargets(prisma, access)
      : Promise.resolve([]),
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
          <p className={styles.eyebrow}>Canales operativos</p>
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
        appId={process.env.NEXT_PUBLIC_META_APP_ID || ""}
        configId={process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID || ""}
        platformReady={metaPlatformReady}
        initialConnection={serializeConnection(channelHealth.connection)}
        initialHealth={channelHealth.readiness}
        initialHealthDiagnostics={channelHealth.diagnostics}
        initialFlowCatalog={getWhatsAppFlowCatalog()}
      />
      {pilotPanelEnabled && (
        <WhatsAppPilotImportPanel
          targets={pilotImportTargets}
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
