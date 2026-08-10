import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { decryptCredential } from '@/lib/credentials';
import { getPrisma } from '@/lib/prisma';
import {
  buildWhatsAppChannelHealthFailureMetadata,
  buildWhatsAppChannelHealthMetadata,
  loadWhatsAppChannelHealth,
} from '@/lib/whatsapp/channel-health';
import {
  MetaIntegrationError,
  verifyConnectedWhatsAppAccount,
} from '@/lib/whatsapp/embedded-signup';
import {
  acquireWhatsAppConnectionLease,
  commitWhatsAppConnectionLease,
  releaseWhatsAppConnectionLease,
  WhatsAppFlowProvisioningLeaseError,
} from '@/lib/whatsapp/flow-provisioning-lease';
import { publicMetaIntegrationFailure } from '@/lib/whatsapp/public-error';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TOKEN_FAILURE_CODES = new Set([
  'META_TOKEN_MISSING',
  'META_TOKEN_APP_MISMATCH',
  'META_190',
]);

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
}

function auditIp(request) {
  return request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request?.headers?.get('x-real-ip')
    || null;
}

function leaseErrorResponse(error) {
  const headers = error.retryAfterSeconds
    ? { 'Retry-After': String(error.retryAfterSeconds) }
    : undefined;
  return json({
    error: 'Hay otra operación segura de WhatsApp en curso. Volvé a intentar.',
    code: error.code,
  }, { status: error.status, headers });
}

function publicHealth(result) {
  return {
    health: result.readiness,
    diagnostics: result.diagnostics,
  };
}

export function createWhatsAppHealthHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  decrypt = decryptCredential,
  verifyRemote = verifyConnectedWhatsAppAccount,
  loadHealth = loadWhatsAppChannelHealth,
  acquireLease = acquireWhatsAppConnectionLease,
  commitLease = commitWhatsAppConnectionLease,
  releaseLease = releaseWhatsAppConnectionLease,
  clock = () => new Date(),
} = {}) {
  async function GET() {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:integrations:manage');
      const result = await loadHealth(prismaFactory(), {
        projectId: access.project.id,
        now: clock(),
      });
      return json(publicHealth(result));
    } catch (error) {
      if (error instanceof AccessError) return accessErrorResponse(error);
      console.error('WhatsApp health read failed:', error);
      return json({ error: 'No se pudo cargar la salud del canal.' }, { status: 500 });
    }
  }

  async function POST(request) {
    let access;
    let prisma;
    let lease = null;
    let leaseCommitted = false;
    try {
      access = await resolveAccess();
      authorize(access, 'org:integrations:manage');
      prisma = prismaFactory();
      const connection = await prisma.whatsAppConnection.findUnique({
        where: { projectId: access.project.id },
        select: {
          id: true,
          phoneNumberId: true,
          whatsappBusinessId: true,
          encryptedAccessToken: true,
          enabled: true,
          connectionStatus: true,
          updatedAt: true,
        },
      });
      if (!connection) {
        return json({
          error: 'Todavía no hay una cuenta de WhatsApp vinculada.',
          code: 'WHATSAPP_ACCOUNT_NOT_LINKED',
        }, { status: 409 });
      }
      if (!connection.enabled) {
        return json({
          error: 'La conexión está desactivada. Volvé a vincularla para verificarla.',
          code: 'WHATSAPP_CONNECTION_DISABLED',
        }, { status: 409 });
      }
      if (
        !connection.phoneNumberId
        || !connection.whatsappBusinessId
        || !connection.encryptedAccessToken
      ) {
        return json({
          error: 'La conexión guardada está incompleta y debe volver a vincularse.',
          code: 'WHATSAPP_CONNECTION_INCOMPLETE',
        }, { status: 409 });
      }

      const expectedConnectionIdentity = {
        phoneNumberId: connection.phoneNumberId,
        whatsappBusinessId: connection.whatsappBusinessId,
        encryptedAccessToken: connection.encryptedAccessToken,
      };
      const acquired = await acquireLease(prisma, {
        connectionId: connection.id,
        operationKey: 'health_verify',
        expectedUpdatedAt: connection.updatedAt,
        expectedConnectionIdentity,
        requireActive: false,
      });
      lease = {
        connectionId: connection.id,
        leaseId: acquired.lease.id,
        expectedConnectionIdentity: acquired.connectionIdentity,
      };

      let verified;
      try {
        verified = await verifyRemote({
          accessToken: decrypt(connection.encryptedAccessToken),
          whatsappBusinessId: connection.whatsappBusinessId,
          phoneNumberId: connection.phoneNumberId,
        });
      } catch (error) {
        if (!(error instanceof MetaIntegrationError)) throw error;
        const publicFailure = publicMetaIntegrationFailure(error, {
          fallback: 'No se pudo verificar el canal con Meta.',
        });
        const failedAt = clock();
        await commitLease(prisma, {
          ...lease,
          requireActive: false,
          buildConnectionData: (observed) => ({
            metadata: buildWhatsAppChannelHealthFailureMetadata(
              observed.metadata,
              { code: publicFailure.code },
              { now: failedAt },
            ),
            lastError: publicFailure.code,
            ...(TOKEN_FAILURE_CODES.has(publicFailure.code) ? { connectionStatus: 'ERROR' } : {}),
          }),
          createAuditLog: (transaction) => transaction.auditLog.create({
            data: {
              organizationId: access.organization.id,
              actorId: access.databaseUserId,
              action: 'integration.whatsapp.verification_failed',
              entityType: 'WhatsAppConnection',
              entityId: connection.id,
              ipAddress: auditIp(request),
              metadata: { projectId: access.project.id, code: publicFailure.code },
            },
          }),
        });
        leaseCommitted = true;
        const result = await loadHealth(prisma, {
          projectId: access.project.id,
          now: failedAt,
        });
        return json({
          error: publicFailure.message,
          code: publicFailure.code,
          ...publicHealth(result),
        }, { status: publicFailure.status });
      }

      const verifiedAt = clock();
      await commitLease(prisma, {
        ...lease,
        requireActive: false,
        buildConnectionData: (observed) => ({
          displayPhoneNumber: verified.displayPhoneNumber,
          verifiedBusinessName: verified.verifiedBusinessName,
          connectionStatus: 'CONNECTED',
          lastVerifiedAt: verifiedAt,
          lastError: null,
          metadata: buildWhatsAppChannelHealthMetadata(
            observed.metadata,
            verified,
            { now: verifiedAt },
          ),
        }),
        createAuditLog: (transaction) => transaction.auditLog.create({
          data: {
            organizationId: access.organization.id,
            actorId: access.databaseUserId,
            action: 'integration.whatsapp.verified',
            entityType: 'WhatsAppConnection',
            entityId: connection.id,
            ipAddress: auditIp(request),
            metadata: {
              projectId: access.project.id,
              subscriptionVerified: verified.subscribed === true,
              phoneStatus: verified.phoneStatus || null,
              qualityRating: verified.qualityRating || null,
            },
          },
        }),
      });
      leaseCommitted = true;
      const result = await loadHealth(prisma, {
        projectId: access.project.id,
        now: verifiedAt,
      });
      return json(publicHealth(result));
    } catch (error) {
      if (lease && !leaseCommitted && prisma) {
        try {
          await releaseLease(prisma, lease);
        } catch (releaseError) {
          console.error('WhatsApp health lease release failed:', releaseError);
        }
      }
      if (error instanceof AccessError) return accessErrorResponse(error);
      if (error instanceof WhatsAppFlowProvisioningLeaseError) return leaseErrorResponse(error);
      if (error instanceof MetaIntegrationError) {
        const failure = publicMetaIntegrationFailure(error, {
          fallback: 'No se pudo verificar el canal con Meta.',
        });
        return json({ error: failure.message, code: failure.code }, {
          status: failure.status,
        });
      }
      console.error('WhatsApp health verification failed:', error);
      return json({ error: 'No se pudo verificar el canal con Meta.' }, { status: 500 });
    }
  }

  return { GET, POST };
}

export const { GET, POST } = createWhatsAppHealthHandlers();
