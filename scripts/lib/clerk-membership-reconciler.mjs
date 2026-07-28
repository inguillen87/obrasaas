import { createClerkClient as createClerkSdkClient } from '@clerk/backend';
import { timingSafeEqual } from 'node:crypto';

import { acceptedInvitationRole } from '../../src/lib/invitations.js';
import {
  getCurrentClerkOrganizationMembership,
  resolveClerkTenantRole,
} from '../../src/lib/clerk-membership-state.js';
import {
  acquireClerkIdentityExclusiveLock,
  CLERK_IDENTITY_TRANSACTION_OPTIONS,
} from '../../src/lib/clerk-identity-lock.js';
import {
  clerkDatabaseOrganizationId,
  syncClerkOrganization,
} from '../../src/lib/clerk-organization-sync.js';
import {
  syncPlatformUserFromClerk,
  verifiedPrimaryEmail,
} from '../../src/lib/clerk-user-sync.js';
import { internalOrganizationMembershipAllowed } from '../../src/lib/internal-organization.js';
import { clerkOrganizationIsInternal } from '../../src/lib/organization-policy.js';
import { membershipTransitionRequiresProjectAccessReset } from '../../src/lib/project-access.js';
import {
  databaseIdentityDigest,
  evaluateMigrationGate,
  MigrationGateError,
  PRODUCTION_DATABASE_IDENTITY_ENV,
} from '../vercel-build.mjs';

const CLERK_API_BASE_URL = 'https://api.clerk.com/v1/';
const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9]{1,128}$/;
const CLERK_ORGANIZATION_ID_PATTERN = /^org_[A-Za-z0-9]{1,128}$/;
const CLERK_INSTANCE_ID_PATTERN = /^ins_[A-Za-z0-9]{1,128}$/;
const SHA256_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;
// Keep the one direct GET aligned with the exactly pinned @clerk/backend SDK.
const CLERK_BAPI_VERSION = '2026-05-12';
const CLERK_INSTANCE_READ_TIMEOUT_MS = 10_000;
const PREVIEW_DATABASE_AUTHORIZATION = Symbol('preview-database-authorization');

export const PREVIEW_DATABASE_IDENTITY_ENV = 'OBRASAAS_PREVIEW_DATABASE_IDENTITY_SHA256';

const PUBLIC_ERROR_MESSAGES = Object.freeze({
  RECONCILIATION_ARGUMENT_INVALID: 'Los argumentos del reconciliador no son validos.',
  RECONCILIATION_CLERK_CONFIGURATION_INVALID: 'La configuracion de lectura de Clerk no es valida.',
  RECONCILIATION_CLERK_READ_FAILED: 'No se pudo leer el estado autoritativo de Clerk.',
  RECONCILIATION_CLERK_INSTANCE_MISMATCH: 'La instancia Clerk no coincide con la instancia esperada.',
  RECONCILIATION_CLERK_INSTANCE_NOT_PREVIEW: 'El reconciliador solo admite una instancia Clerk de desarrollo.',
  RECONCILIATION_CLERK_TARGET_INVALID: 'Clerk no devolvio exactamente el usuario, organizacion y membresia solicitados.',
  RECONCILIATION_DATABASE_NOT_PREVIEW: 'La base fue rechazada por el gate seguro de Preview.',
  RECONCILIATION_IDENTITY_CONFLICT: 'La identidad existente requiere una reconciliacion explicita fuera de este comando estrecho.',
  RECONCILIATION_INTERNAL_ORGANIZATION_FORBIDDEN: 'La membresia solicitada no esta permitida en la organizacion interna.',
  RECONCILIATION_PROJECT_ACCESS_RESET_REQUIRED: 'La transicion requiere revocar accesos de obra y fue rechazada por este comando estrecho.',
  RECONCILIATION_VERIFIED_EMAIL_REQUIRED: 'El usuario Clerk no tiene un email primario verificado.',
  RECONCILIATION_DATABASE_WRITE_FAILED: 'La transaccion de reconciliacion no pudo completarse.',
  RECONCILIATION_FAILED: 'La reconciliacion fue rechazada sin aplicar cambios parciales.',
});

export class ClerkMembershipReconciliationError extends Error {
  constructor(code, options = {}) {
    super(PUBLIC_ERROR_MESSAGES[code] || PUBLIC_ERROR_MESSAGES.RECONCILIATION_FAILED, options);
    this.name = 'ClerkMembershipReconciliationError';
    this.code = code;
    if (Number.isInteger(options.status)) this.status = options.status;
  }
}

function fail(code, options) {
  throw new ClerkMembershipReconciliationError(code, options);
}

function assertClerkId(value, pattern) {
  return typeof value === 'string' && pattern.test(value);
}

export function parseClerkMembershipReconciliationArgs(args) {
  if (args.length === 1 && args[0] === '--help') return Object.freeze({ help: true });
  if (args.includes('--help')) fail('RECONCILIATION_ARGUMENT_INVALID');

  const valueOptions = new Map([
    ['--organization-id', 'organizationId'],
    ['--user-id', 'userId'],
    ['--expected-instance-id', 'expectedInstanceId'],
  ]);
  const parsed = { help: false, apply: false };
  const seen = new Set();

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (seen.has(option)) fail('RECONCILIATION_ARGUMENT_INVALID');
    seen.add(option);

    if (option === '--apply') {
      parsed.apply = true;
      continue;
    }

    const property = valueOptions.get(option);
    if (!property) fail('RECONCILIATION_ARGUMENT_INVALID');
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail('RECONCILIATION_ARGUMENT_INVALID');
    parsed[property] = value;
    index += 1;
  }

  if (
    !assertClerkId(parsed.organizationId, CLERK_ORGANIZATION_ID_PATTERN)
    || !assertClerkId(parsed.userId, CLERK_USER_ID_PATTERN)
    || !assertClerkId(parsed.expectedInstanceId, CLERK_INSTANCE_ID_PATTERN)
  ) {
    fail('RECONCILIATION_ARGUMENT_INVALID');
  }

  return Object.freeze(parsed);
}

export function authorizePreviewReconciliationDatabase(environment = process.env) {
  let gate;
  try {
    gate = evaluateMigrationGate(environment);
  } catch (error) {
    if (error instanceof MigrationGateError) {
      fail('RECONCILIATION_DATABASE_NOT_PREVIEW', { cause: error });
    }
    throw error;
  }
  if (gate.environment !== 'preview' || gate.migrate !== true) {
    fail('RECONCILIATION_DATABASE_NOT_PREVIEW');
  }

  const expectedPreviewHex = environment[PREVIEW_DATABASE_IDENTITY_ENV];
  const expectedProductionHex = environment[PRODUCTION_DATABASE_IDENTITY_ENV];
  if (
    typeof expectedPreviewHex !== 'string'
    || !SHA256_HEX_PATTERN.test(expectedPreviewHex)
    || typeof expectedProductionHex !== 'string'
    || !SHA256_HEX_PATTERN.test(expectedProductionHex)
  ) {
    fail('RECONCILIATION_DATABASE_NOT_PREVIEW');
  }
  const expectedPreviewDigest = Buffer.from(expectedPreviewHex, 'hex');
  const expectedProductionDigest = Buffer.from(expectedProductionHex, 'hex');
  const actualDigest = databaseIdentityDigest(environment.DATABASE_URL);
  if (
    timingSafeEqual(expectedPreviewDigest, expectedProductionDigest)
    || !timingSafeEqual(actualDigest, expectedPreviewDigest)
  ) {
    fail('RECONCILIATION_DATABASE_NOT_PREVIEW');
  }

  const authorization = {
    environment: 'preview',
    provider: 'neon',
    databaseUrl: environment.DATABASE_URL,
  };
  Object.defineProperty(authorization, PREVIEW_DATABASE_AUTHORIZATION, {
    value: true,
  });
  return Object.freeze(authorization);
}

function assertPreviewDatabaseAuthorization(authorization) {
  if (!authorization?.[PREVIEW_DATABASE_AUTHORIZATION]) {
    fail('RECONCILIATION_DATABASE_NOT_PREVIEW');
  }
}

export function assertExpectedPreviewClerkInstance(instance, expectedInstanceId) {
  if (!assertClerkId(expectedInstanceId, CLERK_INSTANCE_ID_PATTERN)) {
    fail('RECONCILIATION_ARGUMENT_INVALID');
  }
  if (instance?.id !== expectedInstanceId) {
    fail('RECONCILIATION_CLERK_INSTANCE_MISMATCH');
  }
  const environmentType = instance?.environmentType ?? instance?.environment_type;
  if (environmentType !== 'development') {
    fail('RECONCILIATION_CLERK_INSTANCE_NOT_PREVIEW');
  }
  return true;
}

export function createClerkBapiReadClient({
  secretKey,
  fetchImpl = globalThis.fetch,
  sdkClientFactory = createClerkSdkClient,
  instanceReadTimeoutMs = CLERK_INSTANCE_READ_TIMEOUT_MS,
  abortSignalFactory = (timeoutMs) => AbortSignal.timeout(timeoutMs),
} = {}) {
  if (
    typeof secretKey !== 'string'
    || !secretKey.trim()
    || typeof fetchImpl !== 'function'
    || typeof sdkClientFactory !== 'function'
    || !Number.isInteger(instanceReadTimeoutMs)
    || instanceReadTimeoutMs < 1_000
    || instanceReadTimeoutMs > 30_000
    || typeof abortSignalFactory !== 'function'
  ) {
    fail('RECONCILIATION_CLERK_CONFIGURATION_INVALID');
  }
  const sdk = sdkClientFactory({ secretKey });

  async function getInstance() {
    let response;
    try {
      response = await fetchImpl(new URL('instance', CLERK_API_BASE_URL), {
        method: 'GET',
        signal: abortSignalFactory(instanceReadTimeoutMs),
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${secretKey}`,
          'Clerk-API-Version': CLERK_BAPI_VERSION,
          'User-Agent': 'ObraSaaS-ClerkMembershipReconciler/1.0',
        },
      });
    } catch (error) {
      fail('RECONCILIATION_CLERK_READ_FAILED', { cause: error });
    }

    const body = await response.json().catch(() => null);
    if (!response.ok || body === null) {
      fail('RECONCILIATION_CLERK_READ_FAILED', { status: response.status });
    }
    return body;
  }

  return Object.freeze({
    getInstance,
    getUser: (userId) => sdk.users.getUser(userId),
    getOrganization: (organizationId) => sdk.organizations.getOrganization({ organizationId }),
    organizations: Object.freeze({
      getOrganizationMembershipList: (params) => (
        sdk.organizations.getOrganizationMembershipList(params)
      ),
    }),
    async getAcceptedOrganizationInvitations(organizationId) {
      const response = await sdk.organizations.getOrganizationInvitationList({
        organizationId,
        status: ['accepted'],
        limit: 100,
      });
      return response.data;
    },
  });
}

function membershipUserId(membership) {
  return membership?.publicUserData?.userId
    ?? membership?.public_user_data?.user_id
    ?? null;
}

function membershipOrganizationId(membership) {
  return membership?.organization?.id
    ?? membership?.organizationId
    ?? membership?.organization_id
    ?? null;
}

export async function loadAuthoritativeClerkMembershipState(
  clerk,
  { organizationId, userId },
) {
  const [user, organization, membership] = await Promise.all([
    clerk.getUser(userId),
    clerk.getOrganization(organizationId),
    getCurrentClerkOrganizationMembership(clerk.organizations, {
      organizationId,
      userId,
    }),
  ]);

  const membershipOrganization = membershipOrganizationId(membership);
  if (
    user?.id !== userId
    || organization?.id !== organizationId
    || !membership
    || membershipUserId(membership) !== userId
    || (membershipOrganization && membershipOrganization !== organizationId)
  ) {
    fail('RECONCILIATION_CLERK_TARGET_INVALID');
  }

  const clerkRole = membership.role || 'org:member';
  let invitationLookup = Object.freeze({ available: true, invitations: [] });
  if (clerkRole !== 'org:admin') {
    try {
      invitationLookup = Object.freeze({
        available: true,
        invitations: await clerk.getAcceptedOrganizationInvitations(organizationId),
      });
    } catch {
      invitationLookup = Object.freeze({ available: false, invitations: [] });
    }
  }

  return Object.freeze({
    user,
    organization,
    membership,
    clerkRole,
    invitationLookup,
  });
}

function projectedOrganization({ clerkOrganization, existingOrganization, internal }) {
  const metadata = existingOrganization?.metadata;
  return {
    clerkOrganizationId: clerkOrganization.id,
    metadata: {
      ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
      internal,
    },
  };
}

function reconciliationMembershipTarget({ state, currentMembership, primaryEmail }) {
  const startsNewLifecycle = !currentMembership || currentMembership.status !== 'ACTIVE';
  let invitedTenantRole = null;
  let invitationEvidence = 'not_required';

  if (startsNewLifecycle && state.clerkRole !== 'org:admin') {
    if (state.invitationLookup.available) {
      invitedTenantRole = acceptedInvitationRole(
        state.invitationLookup.invitations,
        primaryEmail,
      );
      invitationEvidence = invitedTenantRole ? 'matched' : 'not_found';
    } else {
      invitationEvidence = 'unavailable_least_privilege';
    }
  }

  const tenantRole = resolveClerkTenantRole({
    clerkRole: state.clerkRole,
    databaseMembership: startsNewLifecycle ? null : currentMembership,
    clerkMembership: state.membership,
    invitedTenantRole,
  });

  if (
    currentMembership
    && membershipTransitionRequiresProjectAccessReset({
      previousTenantRole: currentMembership.tenantRole,
      nextTenantRole: tenantRole,
      previousStatus: currentMembership.status,
      nextStatus: 'ACTIVE',
    })
  ) {
    fail('RECONCILIATION_PROJECT_ACCESS_RESET_REQUIRED');
  }

  return { tenantRole, invitationEvidence };
}

export async function buildClerkMembershipReconciliationPlan(
  database,
  state,
  { internalClerkOrganizationId = process.env.OBRASAAS_INTERNAL_CLERK_ORG_ID || null } = {},
) {
  const primaryEmail = verifiedPrimaryEmail(state.user);
  if (!primaryEmail) fail('RECONCILIATION_VERIFIED_EMAIL_REQUIRED');

  const linkedDatabaseOrganizationId = clerkDatabaseOrganizationId(state.organization);
  const [userByClerkId, userByEmail, organizationByClerkId, organizationByDatabaseId] = await Promise.all([
    database.platformUser.findUnique({
      where: { clerkUserId: state.user.id },
      select: { id: true, clerkUserId: true, primaryEmail: true },
    }),
    database.platformUser.findUnique({
      where: { primaryEmail },
      select: { id: true, clerkUserId: true, primaryEmail: true },
    }),
    database.organization.findUnique({
      where: { clerkOrganizationId: state.organization.id },
      select: { id: true, clerkOrganizationId: true, metadata: true },
    }),
    linkedDatabaseOrganizationId
      ? database.organization.findUnique({
          where: { id: linkedDatabaseOrganizationId },
          select: { id: true, clerkOrganizationId: true, metadata: true },
        })
      : Promise.resolve(null),
  ]);

  if (userByClerkId && userByEmail && userByClerkId.id !== userByEmail.id) {
    fail('RECONCILIATION_IDENTITY_CONFLICT');
  }
  if (!userByClerkId && userByEmail) {
    fail('RECONCILIATION_IDENTITY_CONFLICT');
  }
  if (linkedDatabaseOrganizationId && !organizationByDatabaseId) {
    fail('RECONCILIATION_IDENTITY_CONFLICT');
  }
  if (
    organizationByClerkId
    && organizationByDatabaseId
    && organizationByClerkId.id !== organizationByDatabaseId.id
  ) {
    fail('RECONCILIATION_IDENTITY_CONFLICT');
  }

  const existingUser = userByClerkId || userByEmail;
  const existingOrganization = organizationByClerkId || organizationByDatabaseId;
  if (existingOrganization && existingOrganization.clerkOrganizationId !== state.organization.id) {
    fail('RECONCILIATION_IDENTITY_CONFLICT');
  }

  const internal = clerkOrganizationIsInternal(
    state.organization,
    existingOrganization?.metadata,
    internalClerkOrganizationId,
  );
  if (!existingOrganization && internal && !linkedDatabaseOrganizationId) {
    const currentInternal = await database.organization.findFirst({
      where: {
        OR: [
          { clerkOrganizationId: 'system:obrasaas' },
          { metadata: { path: ['internal'], equals: true } },
        ],
      },
      select: { id: true },
    });
    if (currentInternal) fail('RECONCILIATION_IDENTITY_CONFLICT');
  }

  if (!internalOrganizationMembershipAllowed(
    projectedOrganization({
      clerkOrganization: state.organization,
      existingOrganization,
      internal,
    }),
    primaryEmail,
  )) {
    fail('RECONCILIATION_INTERNAL_ORGANIZATION_FORBIDDEN');
  }

  const currentMembership = existingUser && existingOrganization
    ? await database.tenantMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: existingOrganization.id,
            userId: existingUser.id,
          },
        },
        select: {
          id: true,
          clerkRole: true,
          tenantRole: true,
          status: true,
        },
      })
    : null;
  const target = reconciliationMembershipTarget({
    state,
    currentMembership,
    primaryEmail,
  });

  return {
    primaryEmail,
    currentMembership,
    target,
    summary: Object.freeze({
      user: existingUser ? 'update' : 'create',
      organization: existingOrganization ? 'update' : 'create',
      membership: currentMembership ? 'update' : 'create',
      membershipStatus: 'ACTIVE',
      tenantRole: target.tenantRole,
      invitationEvidence: target.invitationEvidence,
      projectAccessReset: false,
    }),
  };
}

async function applyClerkMembershipReconciliation(database, state, plan, options) {
  const organization = await syncClerkOrganization(database, {
    organization: state.organization,
    internalClerkOrgId: options.internalClerkOrganizationId,
  });
  const user = await syncPlatformUserFromClerk(database, state.user);

  if (
    organization.clerkOrganizationId !== state.organization.id
    || user.clerkUserId !== state.user.id
  ) {
    fail('RECONCILIATION_IDENTITY_CONFLICT');
  }
  if (!internalOrganizationMembershipAllowed(organization, user.primaryEmail)) {
    fail('RECONCILIATION_INTERNAL_ORGANIZATION_FORBIDDEN');
  }

  const currentMembership = await database.tenantMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
  });
  const target = reconciliationMembershipTarget({
    state,
    currentMembership,
    primaryEmail: user.primaryEmail,
  });
  if (
    target.tenantRole !== plan.target.tenantRole
    || target.invitationEvidence !== plan.target.invitationEvidence
  ) {
    fail('RECONCILIATION_IDENTITY_CONFLICT');
  }

  const membership = await database.tenantMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: {
      clerkRole: state.clerkRole,
      tenantRole: target.tenantRole,
      status: 'ACTIVE',
    },
    create: {
      organizationId: organization.id,
      userId: user.id,
      clerkRole: state.clerkRole,
      tenantRole: target.tenantRole,
      status: 'ACTIVE',
    },
    select: {
      organizationId: true,
      userId: true,
      tenantRole: true,
      status: true,
    },
  });

  if (
    membership.organizationId !== organization.id
    || membership.userId !== user.id
    || membership.tenantRole !== target.tenantRole
    || membership.status !== 'ACTIVE'
  ) {
    fail('RECONCILIATION_DATABASE_WRITE_FAILED');
  }
}

export async function reconcileClerkMembership({
  database,
  clerk,
  organizationId,
  userId,
  expectedInstanceId,
  apply = false,
  databaseAuthorization,
  internalClerkOrganizationId = process.env.OBRASAAS_INTERNAL_CLERK_ORG_ID || null,
}) {
  assertPreviewDatabaseAuthorization(databaseAuthorization);
  const instance = await clerk.getInstance();
  assertExpectedPreviewClerkInstance(instance, expectedInstanceId);
  const options = { internalClerkOrganizationId };

  if (!apply) {
    const state = await loadAuthoritativeClerkMembershipState(clerk, {
      organizationId,
      userId,
    });
    const plan = await buildClerkMembershipReconciliationPlan(database, state, options);
    return Object.freeze({
      ok: true,
      mode: 'dry-run',
      clerk: Object.freeze({ instanceVerified: true, environment: 'development' }),
      database: Object.freeze({ identityVerified: true, environment: 'preview', provider: 'neon' }),
      plan: plan.summary,
      applied: false,
    });
  }

  if (typeof database?.$transaction !== 'function') {
    fail('RECONCILIATION_DATABASE_WRITE_FAILED');
  }
  const summary = await database.$transaction(async (transaction) => {
    // This exclusive advisory lock blocks normal shared-lock Clerk syncs while
    // the administrative reconciliation establishes and persists its snapshot.
    await acquireClerkIdentityExclusiveLock(transaction);
    // Clerk cannot participate in the PostgreSQL transaction. Read its current
    // state only after the narrow transaction has started, immediately before
    // planning and writing the three allowed identity records.
    const state = await loadAuthoritativeClerkMembershipState(clerk, {
      organizationId,
      userId,
    });
    const plan = await buildClerkMembershipReconciliationPlan(transaction, state, options);
    await applyClerkMembershipReconciliation(transaction, state, plan, options);
    return plan.summary;
  }, {
    ...CLERK_IDENTITY_TRANSACTION_OPTIONS,
    isolationLevel: 'Serializable',
  });
  return Object.freeze({
    ok: true,
    mode: 'apply',
    clerk: Object.freeze({ instanceVerified: true, environment: 'development' }),
    database: Object.freeze({ identityVerified: true, environment: 'preview', provider: 'neon' }),
    plan: summary,
    applied: true,
  });
}

export function safeClerkMembershipReconciliationError(error) {
  const knownCode = typeof error?.code === 'string' && PUBLIC_ERROR_MESSAGES[error.code]
    ? error.code
    : error?.name === 'MigrationGateError'
      ? 'RECONCILIATION_DATABASE_NOT_PREVIEW'
      : error?.code === 'CLERK_VERIFIED_EMAIL_REQUIRED'
        ? 'RECONCILIATION_VERIFIED_EMAIL_REQUIRED'
        : error?.code?.startsWith?.('CLERK_')
          ? 'RECONCILIATION_IDENTITY_CONFLICT'
          : error?.code?.startsWith?.('P')
            ? 'RECONCILIATION_DATABASE_WRITE_FAILED'
            : 'RECONCILIATION_FAILED';
  return Object.freeze({
    code: knownCode,
    message: PUBLIC_ERROR_MESSAGES[knownCode],
  });
}
