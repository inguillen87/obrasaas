import Link from 'next/link';

import IntegrationsClient from './integrations-client';
import styles from './integrations.module.css';
import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { getWhatsAppFlowCatalog } from '@/lib/whatsapp/flows';

export const dynamic = 'force-dynamic';

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
  requireTenantPermission(access, 'org:integrations:manage');
  const connection = await getPrisma().whatsAppConnection.findUnique({
    where: { projectId: access.project.id },
  });
  const metaPlatformReady = Boolean(
    process.env.META_APP_SECRET
    && process.env.META_VERIFY_TOKEN
    && process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY,
  );

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/dashboard" className={styles.back}>← Volver al dashboard</Link>
          <p className={styles.eyebrow}>Canales operativos</p>
          <h1>Integraciones</h1>
          <p>
            Conectá los activos propios de {access.organization.name}. ObraSaaS nunca comparte
            números, tokens ni cuentas de WhatsApp entre tenants.
          </p>
        </div>
        <div className={styles.projectBadge}>
          <span>Obra activa</span>
          <strong>{access.project.name}</strong>
        </div>
      </header>

      <IntegrationsClient
        appId={process.env.NEXT_PUBLIC_META_APP_ID || ''}
        configId={process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID || ''}
        platformReady={metaPlatformReady}
        initialConnection={serializeConnection(connection)}
        initialFlowCatalog={getWhatsAppFlowCatalog()}
      />
    </main>
  );
}
