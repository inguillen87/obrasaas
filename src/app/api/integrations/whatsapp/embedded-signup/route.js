import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  credentialLastFour,
  encryptCredential,
} from '@/lib/credentials';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  buildDisabledWhatsAppConnectionData,
  completeEmbeddedSignup,
  mergeWhatsAppConnectionMetadata,
  MetaIntegrationError,
  whatsAppConnectionIdentityChanged,
} from '@/lib/whatsapp/embedded-signup';
import { buildWhatsAppChannelHealthMetadata } from '@/lib/whatsapp/channel-health';
import {
  acquireWhatsAppConnectionLease,
  commitWhatsAppConnectionLease,
  releaseWhatsAppConnectionLease,
  WhatsAppFlowProvisioningLeaseError,
} from '@/lib/whatsapp/flow-provisioning-lease';
import { publicMetaIntegrationFailure } from '@/lib/whatsapp/public-error';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_EMBEDDED_SIGNUP_JSON_BYTES = 16 * 1024;
const CONNECTION_LEASE_PUBLIC_MESSAGES = Object.freeze({
  WHATSAPP_FLOW_PROVISIONING_IN_PROGRESS: 'Hay otra operaci\u00f3n de WhatsApp en curso. Volv\u00e9 a intentar en unos segundos.',
  WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED: 'La conexi\u00f3n de WhatsApp cambi\u00f3 durante la operaci\u00f3n. Volv\u00e9 a intentar.',
  WHATSAPP_FLOW_PROVISIONING_LEASE_LOST: 'La operaci\u00f3n de WhatsApp perdi\u00f3 su turno seguro. Volv\u00e9 a intentar.',
  WHATSAPP_FLOW_PROVISIONING_CONFLICT: 'La conexi\u00f3n de WhatsApp tuvo cambios simult\u00e1neos. Volv\u00e9 a intentar.',
  WHATSAPP_FLOW_PROVISIONING_CONNECTION_NOT_FOUND: 'La conexi\u00f3n de WhatsApp ya no est\u00e1 disponible.',
});

function safeConnection(connection) {
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

function auditIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;
}

function connectionLeaseErrorResponse(error) {
  const headers = error.retryAfterSeconds
    ? { 'Retry-After': String(error.retryAfterSeconds) }
    : undefined;
  return Response.json({
    error: CONNECTION_LEASE_PUBLIC_MESSAGES[error.code]
      || 'No se pudo proteger la operaci\u00f3n de WhatsApp.',
    code: error.code,
  }, { status: error.status, headers });
}

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const connection = await getPrisma().whatsAppConnection.findUnique({
      where: { projectId: access.project.id },
    });
    return Response.json({ connection: safeConnection(connection) });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error('WhatsApp connection read failed:', error);
    return Response.json({ error: 'No se pudo cargar la conexión.' }, { status: 500 });
  }
}

export async function POST(request) {
  let access;
  let connectionLease = null;
  let connectionLeaseCommitted = false;
  let prisma;
  try {
    access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const body = await readJsonRequest(request, {
      maxBytes: MAX_EMBEDDED_SIGNUP_JSON_BYTES,
    });
    const whatsappBusinessId = String(body.whatsappBusinessId || '');
    const phoneNumberId = String(body.phoneNumberId || '');
    const registrationPin = String(body.registrationPin || '');

    prisma = getPrisma();
    const existingSnapshot = await prisma.whatsAppConnection.findUnique({
      where: { projectId: access.project.id },
      select: { id: true, updatedAt: true },
    });
    if (existingSnapshot) {
      const acquired = await acquireWhatsAppConnectionLease(prisma, {
        connectionId: existingSnapshot.id,
        operationKey: 'connection_refresh',
        expectedUpdatedAt: existingSnapshot.updatedAt,
        requireActive: false,
      });
      connectionLease = {
        connectionId: existingSnapshot.id,
        leaseId: acquired.lease.id,
      };
    }

    const result = await completeEmbeddedSignup({
      code: body.code,
      whatsappBusinessId,
      phoneNumberId,
      registrationPin,
    });
    const timestamp = new Date();
    const verifiedMetadata = buildWhatsAppChannelHealthMetadata({
      tokenType: result.tokenType,
      expiresAt: result.expiresAt,
      scopes: result.scopes,
      qualityRating: result.qualityRating,
      verificationStatus: result.verificationStatus,
      subscribed: result.subscribed,
      phoneStatus: result.phoneStatus,
    }, result, { now: timestamp });
    const encryptedAccessToken = encryptCredential(result.accessToken);
    const encryptedPin = encryptCredential(registrationPin);
    let connection;

    if (connectionLease) {
      let identityChanged = false;
      let previousIdentity = null;
      const committed = await commitWhatsAppConnectionLease(prisma, {
        connectionId: connectionLease.connectionId,
        leaseId: connectionLease.leaseId,
        requireActive: false,
        buildConnectionData(observed) {
          previousIdentity = {
            phoneNumberId: observed.phoneNumberId,
            whatsappBusinessId: observed.whatsappBusinessId,
          };
          identityChanged = whatsAppConnectionIdentityChanged(previousIdentity, {
            phoneNumberId,
            whatsappBusinessId,
          });
          return {
            phoneNumberId,
            whatsappBusinessId,
            displayPhoneNumber: result.displayPhoneNumber,
            verifiedBusinessName: result.verifiedBusinessName,
            enabled: true,
            connectionStatus: 'CONNECTED',
            encryptedAccessToken,
            encryptedPin,
            tokenLastFour: credentialLastFour(result.accessToken),
            embeddedSignupVersion: 'v4',
            connectedAt: timestamp,
            lastVerifiedAt: timestamp,
            lastError: null,
            metadata: mergeWhatsAppConnectionMetadata(observed.metadata, verifiedMetadata, {
              identityChanged,
            }),
          };
        },
        createAuditLog: (tx) => tx.auditLog.create({
          data: {
            organizationId: access.organization.id,
            actorId: access.databaseUserId,
            action: 'integration.whatsapp.connected',
            entityType: 'WhatsAppConnection',
            entityId: connectionLease.connectionId,
            ipAddress: auditIp(request),
            metadata: {
              projectId: access.project.id,
              phoneNumberId,
              whatsappBusinessId,
              embeddedSignupVersion: 'v4',
              identityChanged,
              ...(identityChanged ? {
                previousPhoneNumberId: previousIdentity.phoneNumberId,
                previousWhatsappBusinessId: previousIdentity.whatsappBusinessId,
                flowMetadataCleared: true,
              } : {}),
            },
          },
        }),
      });
      connectionLeaseCommitted = true;
      connection = {
        id: connectionLease.connectionId,
        ...committed.data,
      };
    } else {
      connection = await prisma.$transaction(async (tx) => {
        const saved = await tx.whatsAppConnection.create({
          data: {
            projectId: access.project.id,
            phoneNumberId,
            whatsappBusinessId,
            displayPhoneNumber: result.displayPhoneNumber,
            verifiedBusinessName: result.verifiedBusinessName,
            enabled: true,
            connectionStatus: 'CONNECTED',
            encryptedAccessToken,
            encryptedPin,
            tokenLastFour: credentialLastFour(result.accessToken),
            embeddedSignupVersion: 'v4',
            connectedAt: timestamp,
            lastVerifiedAt: timestamp,
            metadata: verifiedMetadata,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: access.organization.id,
            actorId: access.databaseUserId,
            action: 'integration.whatsapp.connected',
            entityType: 'WhatsAppConnection',
            entityId: saved.id,
            ipAddress: auditIp(request),
            metadata: {
              projectId: access.project.id,
              phoneNumberId,
              whatsappBusinessId,
              embeddedSignupVersion: 'v4',
              identityChanged: false,
            },
          },
        });
        return saved;
      });
    }

    return Response.json({ connection: safeConnection(connection) });
  } catch (error) {
    if (connectionLease && !connectionLeaseCommitted && prisma) {
      try {
        await releaseWhatsAppConnectionLease(prisma, connectionLease);
      } catch (releaseError) {
        console.error('WhatsApp connection lease release failed:', {
          code: releaseError?.code,
          name: releaseError?.name,
          status: releaseError?.status,
        });
      }
    }
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof WhatsAppFlowProvisioningLeaseError) {
      return connectionLeaseErrorResponse(error);
    }
    if (error instanceof MetaIntegrationError) {
      const failure = publicMetaIntegrationFailure(error, {
        fallback: 'No se pudo conectar WhatsApp con Meta.',
      });
      return Response.json({ error: failure.message, code: failure.code }, {
        status: failure.status,
      });
    }
    if (error?.code === 'P2002') {
      return Response.json({
        error: 'Ese número de WhatsApp ya está conectado a otra obra.',
        code: 'PHONE_ALREADY_CONNECTED',
      }, { status: 409 });
    }
    console.error('WhatsApp Embedded Signup failed:', error);
    return Response.json({ error: 'No se pudo completar la conexión con WhatsApp.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  let prisma;
  let connectionLease = null;
  let connectionLeaseCommitted = false;
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    prisma = getPrisma();
    const existing = await prisma.whatsAppConnection.findUnique({
      where: { projectId: access.project.id },
    });
    if (!existing) return new Response(null, { status: 204 });

    const acquired = await acquireWhatsAppConnectionLease(prisma, {
      connectionId: existing.id,
      operationKey: 'connection_disable',
      expectedUpdatedAt: existing.updatedAt,
      requireActive: false,
    });
    connectionLease = {
      connectionId: existing.id,
      leaseId: acquired.lease.id,
    };
    await commitWhatsAppConnectionLease(prisma, {
      connectionId: existing.id,
      leaseId: acquired.lease.id,
      requireActive: false,
      buildConnectionData: buildDisabledWhatsAppConnectionData,
      createAuditLog: (tx) => tx.auditLog.create({
        data: {
          organizationId: access.organization.id,
          actorId: access.databaseUserId,
          action: 'integration.whatsapp.disabled',
          entityType: 'WhatsAppConnection',
          entityId: existing.id,
          ipAddress: auditIp(request),
          metadata: {
            projectId: access.project.id,
            phoneNumberId: existing.phoneNumberId,
          },
        },
      }),
    });
    connectionLeaseCommitted = true;
    return new Response(null, { status: 204 });
  } catch (error) {
    if (connectionLease && !connectionLeaseCommitted && prisma) {
      try {
        await releaseWhatsAppConnectionLease(prisma, connectionLease);
      } catch (releaseError) {
        console.error('WhatsApp disconnect lease release failed:', {
          code: releaseError?.code,
          name: releaseError?.name,
          status: releaseError?.status,
        });
      }
    }
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof WhatsAppFlowProvisioningLeaseError) {
      return connectionLeaseErrorResponse(error);
    }
    console.error('WhatsApp disconnect failed:', error);
    return Response.json({ error: 'No se pudo desactivar la conexión.' }, { status: 500 });
  }
}
