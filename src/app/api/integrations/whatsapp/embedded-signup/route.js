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
  completeEmbeddedSignup,
  MetaIntegrationError,
} from '@/lib/whatsapp/embedded-signup';

export const runtime = 'nodejs';
export const maxDuration = 60;

function safeConnection(connection) {
  if (!connection) return null;
  return {
    id: connection.id,
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

function auditIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;
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
  try {
    access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const body = await request.json().catch(() => ({}));
    const whatsappBusinessId = String(body.whatsappBusinessId || '');
    const phoneNumberId = String(body.phoneNumberId || '');
    const registrationPin = String(body.registrationPin || '');

    const result = await completeEmbeddedSignup({
      code: body.code,
      whatsappBusinessId,
      phoneNumberId,
      registrationPin,
    });

    const prisma = getPrisma();
    const connection = await prisma.$transaction(async (tx) => {
      const saved = await tx.whatsAppConnection.upsert({
        where: { projectId: access.project.id },
        update: {
          phoneNumberId,
          whatsappBusinessId,
          displayPhoneNumber: result.displayPhoneNumber,
          verifiedBusinessName: result.verifiedBusinessName,
          enabled: true,
          connectionStatus: 'CONNECTED',
          encryptedAccessToken: encryptCredential(result.accessToken),
          encryptedPin: encryptCredential(registrationPin),
          tokenLastFour: credentialLastFour(result.accessToken),
          embeddedSignupVersion: 'v4',
          connectedAt: new Date(),
          lastVerifiedAt: new Date(),
          lastError: null,
          metadata: {
            tokenType: result.tokenType,
            expiresAt: result.expiresAt,
            scopes: result.scopes,
            qualityRating: result.qualityRating,
            verificationStatus: result.verificationStatus,
          },
        },
        create: {
          projectId: access.project.id,
          phoneNumberId,
          whatsappBusinessId,
          displayPhoneNumber: result.displayPhoneNumber,
          verifiedBusinessName: result.verifiedBusinessName,
          enabled: true,
          connectionStatus: 'CONNECTED',
          encryptedAccessToken: encryptCredential(result.accessToken),
          encryptedPin: encryptCredential(registrationPin),
          tokenLastFour: credentialLastFour(result.accessToken),
          embeddedSignupVersion: 'v4',
          connectedAt: new Date(),
          lastVerifiedAt: new Date(),
          metadata: {
            tokenType: result.tokenType,
            expiresAt: result.expiresAt,
            scopes: result.scopes,
            qualityRating: result.qualityRating,
            verificationStatus: result.verificationStatus,
          },
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
          },
        },
      });
      return saved;
    });

    return Response.json({ connection: safeConnection(connection) });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof MetaIntegrationError) {
      if (access?.project?.id) {
        await getPrisma().whatsAppConnection.updateMany({
          where: { projectId: access.project.id },
          data: {
            connectionStatus: 'ERROR',
            lastError: error.message.slice(0, 2_000),
          },
        }).catch(() => {});
      }
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
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
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const prisma = getPrisma();
    const existing = await prisma.whatsAppConnection.findUnique({
      where: { projectId: access.project.id },
    });
    if (!existing) return new Response(null, { status: 204 });

    await prisma.$transaction([
      prisma.whatsAppConnection.update({
        where: { id: existing.id },
        data: {
          enabled: false,
          connectionStatus: 'DISABLED',
          encryptedAccessToken: null,
          encryptedPin: null,
          tokenLastFour: null,
          lastError: null,
        },
      }),
      prisma.auditLog.create({
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
    ]);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error('WhatsApp disconnect failed:', error);
    return Response.json({ error: 'No se pudo desactivar la conexión.' }, { status: 500 });
  }
}
