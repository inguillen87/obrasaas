import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { decryptCredential } from '@/lib/credentials';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import { MetaIntegrationError } from '@/lib/whatsapp/embedded-signup';
import {
  deleteOwnedWhatsAppFlowDraft,
  getWhatsAppFlowCatalog,
  getWhatsAppFlowBlueprint,
  listWhatsAppFlows,
  reconcileWhatsAppFlowLifecycleMetadata,
} from '@/lib/whatsapp/flows';
import { WhatsAppFlowEndpointKeyError } from '@/lib/whatsapp/flow-endpoint-keys';
import {
  buildWhatsAppFlowEndpointUri,
  flowRuntimeIsReady,
  provisionWhatsAppFlowDataEndpoint,
  readWhatsAppFlowEndpointState,
  remoteFlowUsesDataEndpoint,
  whatsAppFlowHealthIsBlocked,
} from '@/lib/whatsapp/flow-endpoint-provisioning';
import {
  acquireWhatsAppFlowProvisioningLease,
  commitWhatsAppFlowProvisioningLease,
  releaseWhatsAppFlowProvisioningLease,
  WhatsAppFlowProvisioningLeaseError,
} from '@/lib/whatsapp/flow-provisioning-lease';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FLOW_JSON_BYTES = 8 * 1024;
const FLOW_ENDPOINT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FLOW_KEY_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;
const META_RESOURCE_ID_PATTERN = /^\d{1,32}$/;
const HEALTH_STATE_PATTERN = /^[A-Z][A-Z0-9_]{0,39}$/;
const FLOW_KEY_PUBLIC_MESSAGES = Object.freeze({
  WHATSAPP_FLOW_KEY_INPUT_INVALID: 'La identidad del Data Endpoint no es válida.',
  WHATSAPP_FLOW_KEY_CONNECTION_NOT_FOUND: 'La conexión de WhatsApp ya no está disponible.',
  WHATSAPP_FLOW_KEY_ENDPOINT_NOT_FOUND: 'El Data Endpoint cambió durante la operación. Volvé a intentar.',
  WHATSAPP_FLOW_KEY_NOT_FOUND: 'La clave del Data Endpoint cambió durante la operación. Volvé a intentar.',
  WHATSAPP_FLOW_KEY_NOT_VERIFIED: 'Meta todavía no verificó la clave RSA del Data Endpoint.',
  WHATSAPP_FLOW_KEY_ROTATION_IN_PROGRESS: 'Ya hay una rotación de clave en curso para esta conexión.',
  WHATSAPP_FLOW_KEY_STATE_CONFLICT: 'El estado de la clave cambió durante la operación. Volvé a intentar.',
  WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID: 'El cifrado dedicado del Data Endpoint todavía no está configurado.',
  WHATSAPP_FLOW_KEY_PERSISTENCE_UNAVAILABLE: 'No se pudo guardar la clave cifrada del Data Endpoint.',
  WHATSAPP_FLOW_KEY_MATERIAL_INVALID: 'La clave RSA del Data Endpoint no es válida.',
});
const FLOW_PROVISIONING_PUBLIC_MESSAGES = Object.freeze({
  WHATSAPP_FLOW_PROVISIONING_IN_PROGRESS: 'Ya hay un WhatsApp Flow preparándose para esta conexión. Volvé a intentar en unos segundos.',
  WHATSAPP_FLOW_PROVISIONING_CONFLICT: 'La configuración de WhatsApp cambió durante la operación. Volvé a intentar.',
  WHATSAPP_FLOW_PROVISIONING_LEASE_LOST: 'La preparación del WhatsApp Flow perdió su turno. Volvé a intentar.',
  WHATSAPP_FLOW_PROVISIONING_CONNECTION_NOT_FOUND: 'La conexión de WhatsApp ya no está disponible.',
  WHATSAPP_FLOW_PROVISIONING_LEASE_UNAVAILABLE: 'No se pudo proteger la preparación del WhatsApp Flow.',
  WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID: 'La preparación segura del WhatsApp Flow no está disponible.',
  WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED: 'La conexi\u00f3n de WhatsApp cambi\u00f3 durante la operaci\u00f3n. Volv\u00e9 a intentar.',
});

function auditIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;
}

async function requireActiveConnection(access) {
  const connection = await getPrisma().whatsAppConnection.findUnique({
    where: { projectId: access.project.id },
  });
  if (
    !connection?.enabled
    || connection.connectionStatus !== 'CONNECTED'
    || !connection.whatsappBusinessId
    || !connection.encryptedAccessToken
  ) {
    throw new MetaIntegrationError('Conectá una cuenta de WhatsApp antes de administrar Flows.', {
      code: 'WHATSAPP_NOT_CONNECTED',
      status: 409,
    });
  }
  return connection;
}

function flowErrorResponse(error, fallback) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof MetaIntegrationError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof WhatsAppFlowEndpointKeyError) {
    if (error.status >= 500) {
      console.error(fallback, { code: error.code, name: error.name, status: error.status });
    }
    return Response.json({
      error: FLOW_KEY_PUBLIC_MESSAGES[error.code]
        || 'No se pudo preparar el cifrado del Data Endpoint.',
      code: error.code,
    }, { status: error.status });
  }
  if (error instanceof WhatsAppFlowProvisioningLeaseError) {
    if (error.status >= 500) {
      console.error(fallback, { code: error.code, name: error.name, status: error.status });
    }
    const headers = error.retryAfterSeconds
      ? { 'Retry-After': String(error.retryAfterSeconds) }
      : undefined;
    return Response.json({
      error: FLOW_PROVISIONING_PUBLIC_MESSAGES[error.code]
        || 'No se pudo proteger la preparación del WhatsApp Flow.',
      code: error.code,
    }, { status: error.status, headers });
  }
  console.error(fallback, error);
  return Response.json({ error: 'No se pudieron administrar los WhatsApp Flows.' }, { status: 500 });
}

function storedConnectionMetadata(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {};
}

function safeIsoTimestamp(value) {
  if (!value) return null;
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function expectedEndpointContract(endpointId) {
  const applicationId = String(process.env.NEXT_PUBLIC_META_APP_ID || '').trim();
  if (!META_RESOURCE_ID_PATTERN.test(applicationId)) return null;
  try {
    return {
      endpointUri: buildWhatsAppFlowEndpointUri(
        process.env.NEXT_PUBLIC_APP_URL,
        endpointId,
      ),
      applicationId,
    };
  } catch {
    return null;
  }
}

function publicEndpointState(endpointState, metadata) {
  const endpointId = String(endpointState?.id || '').trim().toLowerCase();
  if (!FLOW_ENDPOINT_ID_PATTERN.test(endpointId)) return null;
  const keyFingerprint = String(endpointState?.keyFingerprint || '').trim().toLowerCase();
  const safeKeyFingerprint = FLOW_KEY_FINGERPRINT_PATTERN.test(keyFingerprint)
    ? keyFingerprint
    : null;
  const keyVersion = Number.isSafeInteger(endpointState?.keyVersion)
    && endpointState.keyVersion > 0
    ? endpointState.keyVersion
    : null;
  const contract = expectedEndpointContract(endpointId);
  const stored = storedConnectionMetadata(metadata).whatsappFlowEndpoint;
  const bound = Boolean(
    endpointState.enabled === true
    && endpointState.ready === true
    && safeKeyFingerprint
    && keyVersion
    && contract
    && stored
    && typeof stored === 'object'
    && !Array.isArray(stored)
    && stored.id === endpointId
    && String(stored.keyFingerprint || '').toLowerCase() === safeKeyFingerprint
    && stored.keyVersion === keyVersion
    && stored.signatureStatus === 'VALID'
    && stored.endpointUri === contract.endpointUri
    && String(stored.applicationId || '') === contract.applicationId,
  );
  return {
    id: endpointId,
    enabled: endpointState.enabled === true,
    ready: bound,
    keyFingerprint: safeKeyFingerprint,
    keyVersion,
    verifiedAt: safeIsoTimestamp(endpointState.verifiedAt),
    signatureStatus: bound ? stored.signatureStatus : null,
    endpointUri: bound ? contract.endpointUri : null,
    applicationId: bound ? contract.applicationId : null,
  };
}

function publicFlowHealthStatus(healthStatus) {
  const entries = healthStatus && typeof healthStatus === 'object' && !Array.isArray(healthStatus)
    ? [
        healthStatus,
        ...(Array.isArray(healthStatus.entities) ? healthStatus.entities.slice(0, 50) : []),
      ]
    : [];
  const rawState = typeof healthStatus === 'string'
    ? healthStatus
    : entries
      .map((entry) => entry?.can_send_message || entry?.canSendMessage || entry?.status)
      .find((value) => typeof value === 'string');
  const normalizedState = String(rawState || '').trim().slice(0, 40).toUpperCase();
  const errorCount = entries.reduce((total, entry) => (
    total + (Array.isArray(entry?.errors) ? entry.errors.length : 0)
  ), 0);
  return {
    blocked: whatsAppFlowHealthIsBlocked(healthStatus),
    state: HEALTH_STATE_PATTERN.test(normalizedState) ? normalizedState : null,
    errorCount: Math.min(errorCount, 100),
  };
}

function catalogWithRuntimeState(catalog, metadata, endpointState) {
  const safeMetadata = storedConnectionMetadata(metadata);
  const storedFlows = safeMetadata.whatsappFlows
    && typeof safeMetadata.whatsappFlows === 'object'
    && !Array.isArray(safeMetadata.whatsappFlows)
    ? safeMetadata.whatsappFlows
    : {};
  const endpoint = publicEndpointState(endpointState, safeMetadata);
  const expectedContract = expectedEndpointContract(endpointState?.id);
  return catalog.map((item) => {
    const runtimeActive = flowRuntimeIsReady(item.remote, storedFlows[item.key], endpoint, {
      endpointUri: endpoint?.endpointUri,
      applicationId: endpoint?.applicationId,
    });
    return {
      ...item,
      remote: {
        ...item.remote,
        healthStatus: publicFlowHealthStatus(item.remote.healthStatus),
      },
      remoteDataEndpointReady: Boolean(
        expectedContract && remoteFlowUsesDataEndpoint(item.remote, expectedContract),
      ),
      runtimeActive,
    };
  });
}

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const connection = await requireActiveConnection(access);
    const prisma = getPrisma();
    const [remoteFlows, endpointState] = await Promise.all([
      listWhatsAppFlows({
        whatsappBusinessId: connection.whatsappBusinessId,
        accessToken: decryptCredential(connection.encryptedAccessToken),
      }),
      readWhatsAppFlowEndpointState(prisma, connection.id),
    ]);
    const refreshedConnection = await prisma.whatsAppConnection.findUnique({
      where: { id: connection.id },
      select: { metadata: true },
    });
    const metadata = refreshedConnection?.metadata ?? connection.metadata;
    return Response.json({
      catalog: catalogWithRuntimeState(
        getWhatsAppFlowCatalog(remoteFlows, {
          storedFlows: storedConnectionMetadata(metadata).whatsappFlows,
          storedDrafts: storedConnectionMetadata(metadata).whatsappFlowDrafts,
          flowScope: endpointState?.id || null,
        }),
        metadata,
        endpointState,
      ),
      endpoint: publicEndpointState(endpointState, metadata),
    });
  } catch (error) {
    return flowErrorResponse(error, 'WhatsApp Flow catalog read failed:');
  }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage');
    const body = await readJsonRequest(request, { maxBytes: MAX_FLOW_JSON_BYTES });
    const connection = await requireActiveConnection(access);
    const blueprintKey = typeof body.blueprintKey === 'string' ? body.blueprintKey.trim() : '';
    if (!getWhatsAppFlowBlueprint(blueprintKey)) {
      throw new MetaIntegrationError('El blueprint de WhatsApp Flow no existe.', {
        code: 'FLOW_BLUEPRINT_NOT_FOUND',
        status: 400,
      });
    }
    const prisma = getPrisma();
    const acquired = await acquireWhatsAppFlowProvisioningLease(prisma, {
      connectionId: connection.id,
      blueprintKey,
      expectedUpdatedAt: connection.updatedAt,
      expectedConnectionIdentity: {
        phoneNumberId: connection.phoneNumberId,
        whatsappBusinessId: connection.whatsappBusinessId,
        encryptedAccessToken: connection.encryptedAccessToken,
      },
    });
    let leaseCommitted = false;
    let provisioned = null;
    const accessToken = decryptCredential(connection.encryptedAccessToken);
    try {
      provisioned = await provisionWhatsAppFlowDataEndpoint({
        prisma,
        connection: { ...connection, metadata: acquired.metadata },
        blueprintKey,
        accessToken,
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
        applicationId: process.env.NEXT_PUBLIC_META_APP_ID,
      });
      const result = provisioned.result;
      const applicationId = String(process.env.NEXT_PUBLIC_META_APP_ID || '').trim();
      const provisionedAt = new Date();
      let lifecycle;
      const committed = await commitWhatsAppFlowProvisioningLease(prisma, {
        connectionId: connection.id,
        leaseId: acquired.lease.id,
        expectedConnectionIdentity: acquired.connectionIdentity,
        buildMetadata(metadata) {
          lifecycle = reconcileWhatsAppFlowLifecycleMetadata(metadata, {
            blueprintKey: result.blueprintKey,
            flow: result.flow,
            flowScope: provisioned.endpoint.id,
            whatsappBusinessId: connection.whatsappBusinessId,
            dataExchange: provisioned.dataExchange,
            endpointReady: provisioned.endpoint.ready,
            provisionedAt,
          });
          return {
            ...lifecycle.metadata,
            whatsappFlowEndpoint: {
              id: provisioned.endpoint.id,
              endpointUri: provisioned.endpointUri,
              applicationId,
              keyFingerprint: provisioned.endpoint.keyFingerprint,
              keyVersion: provisioned.endpoint.keyVersion,
              signatureStatus: provisioned.endpoint.signatureStatus,
              verifiedAt: safeIsoTimestamp(provisioned.endpoint.verifiedAt),
            },
          };
        },
        createAuditLog: (transaction) => transaction.auditLog.create({
          data: {
            organizationId: access.organization.id,
            actorId: access.databaseUserId,
            action: result.created
              ? 'integration.whatsapp.flow_draft_created'
              : lifecycle.promoted
                ? 'integration.whatsapp.flow_existing_confirmed'
                : lifecycle.activePreserved
                  ? 'integration.whatsapp.flow_migration_pending'
                  : 'integration.whatsapp.flow_draft_updated',
            entityType: 'WhatsAppFlow',
            entityId: result.flow.id,
            ipAddress: auditIp(request),
            metadata: {
              projectId: access.project.id,
              whatsappBusinessId: connection.whatsappBusinessId,
              blueprintKey: result.blueprintKey,
              status: result.flow.status,
              jsonVersion: result.flow.jsonVersion,
              dataApiVersion: result.flow.dataApiVersion,
              dataExchange: provisioned.dataExchange,
              flowEndpointId: provisioned.endpoint.id,
              keyFingerprint: provisioned.endpoint.keyFingerprint,
              keyVersion: provisioned.endpoint.keyVersion,
              signatureStatus: provisioned.endpoint.signatureStatus,
              published: result.flow.status === 'PUBLISHED',
              promoted: lifecycle.promoted,
              activePreserved: lifecycle.activePreserved,
              pending: lifecycle.pendingFlow !== null,
            },
          },
        }),
      });
      leaseCommitted = true;
      const nextMetadata = committed.metadata;

      const endpointState = await readWhatsAppFlowEndpointState(prisma, connection.id);
      const endpoint = publicEndpointState(endpointState, nextMetadata);
      const catalogItem = catalogWithRuntimeState(
        getWhatsAppFlowCatalog([result.flow], {
          storedFlows: nextMetadata.whatsappFlows,
          storedDrafts: nextMetadata.whatsappFlowDrafts,
          flowScope: provisioned.endpoint.id,
        }),
        nextMetadata,
        endpointState,
      ).find((item) => item.key === result.blueprintKey);
      if (!catalogItem) {
        throw new MetaIntegrationError('El blueprint provisionado no pudo reconciliarse.', {
          code: 'FLOW_BLUEPRINT_RECONCILIATION_FAILED',
          status: 500,
        });
      }

      return Response.json({
        result: {
          blueprintKey: result.blueprintKey,
          created: result.created === true,
          uploaded: result.uploaded === true,
          configured: result.configured === true,
          flow: catalogItem.remote,
        },
        endpoint,
        catalogItem,
      });
    } catch (error) {
      if (!leaseCommitted) {
        if (
          provisioned?.result?.created === true
          && provisioned?.result?.flow?.id
          && provisioned?.endpoint?.id
        ) {
          try {
            await deleteOwnedWhatsAppFlowDraft({
              blueprintKey,
              whatsappBusinessId: connection.whatsappBusinessId,
              accessToken,
              flowScope: provisioned.endpoint.id,
              flowId: provisioned.result.flow.id,
            });
          } catch (cleanupError) {
            // Keep the original provisioning failure. The next attempt still
            // reconciles the deterministic scoped name before creating again.
            console.error('WhatsApp orphan Flow draft cleanup failed:', {
              code: cleanupError?.code,
              name: cleanupError?.name,
              status: cleanupError?.status,
            });
          }
        }
        try {
          await releaseWhatsAppFlowProvisioningLease(prisma, {
            connectionId: connection.id,
            leaseId: acquired.lease.id,
          });
        } catch (releaseError) {
          console.error('WhatsApp Flow provisioning lease release failed:', {
            code: releaseError?.code,
            name: releaseError?.name,
            status: releaseError?.status,
          });
        }
      }
      throw error;
    }
  } catch (error) {
    return flowErrorResponse(error, 'WhatsApp Flow draft provision failed:');
  }
}
