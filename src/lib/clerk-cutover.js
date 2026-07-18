import { clerkDatabaseOrganizationId } from './clerk-organization-sync.js';
import { verifiedPrimaryEmail } from './clerk-user-sync.js';
import { SUPERADMIN_EMAIL } from './platform-identity.js';

const ID_PATTERNS = Object.freeze({
  instance: /^ins_[A-Za-z0-9]+$/,
  user: /^user_[A-Za-z0-9]+$/,
  organization: /^org_[A-Za-z0-9]+$/,
});

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function exactKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${label} contains unknown fields.`);
}

function boundedId(value, label, pattern = null) {
  if (typeof value !== 'string' || !value.trim() || value.length > 191) {
    throw new Error(`${label} must be a non-empty bounded ID.`);
  }
  const normalized = value.trim();
  if (pattern && !pattern.test(normalized)) throw new Error(`${label} has an invalid format.`);
  return normalized;
}

function unique(entries, key, label) {
  const values = entries.map((entry) => entry[key]);
  if (new Set(values).size !== values.length) throw new Error(`${label} values must be unique.`);
}

function databaseInternal(metadata) {
  return Boolean(metadata && typeof metadata === 'object' && !Array.isArray(metadata) && metadata.internal === true);
}

function clerkInternal(organization) {
  const metadata = organization?.publicMetadata ?? organization?.public_metadata;
  return Boolean(metadata && typeof metadata === 'object' && !Array.isArray(metadata) && metadata.internal === true);
}

export function validateClerkCutoverManifest(input) {
  const manifest = record(input, 'Clerk cutover manifest');
  exactKeys(manifest, ['targetInstanceId', 'users', 'organizations'], 'Clerk cutover manifest');
  if (!Array.isArray(manifest.users) || !Array.isArray(manifest.organizations)) {
    throw new Error('Clerk cutover users and organizations must be arrays.');
  }

  const users = manifest.users.map((candidate, index) => {
    const entry = record(candidate, `users[${index}]`);
    exactKeys(entry, [
      'platformUserId',
      'expectedPreviousClerkUserId',
      'nextClerkUserId',
    ], `users[${index}]`);
    return {
      platformUserId: boundedId(entry.platformUserId, `users[${index}].platformUserId`),
      expectedPreviousClerkUserId: boundedId(
        entry.expectedPreviousClerkUserId,
        `users[${index}].expectedPreviousClerkUserId`,
        ID_PATTERNS.user,
      ),
      nextClerkUserId: boundedId(
        entry.nextClerkUserId,
        `users[${index}].nextClerkUserId`,
        ID_PATTERNS.user,
      ),
    };
  });
  const organizations = manifest.organizations.map((candidate, index) => {
    const entry = record(candidate, `organizations[${index}]`);
    exactKeys(entry, [
      'organizationId',
      'expectedPreviousClerkOrganizationId',
      'nextClerkOrganizationId',
    ], `organizations[${index}]`);
    return {
      organizationId: boundedId(entry.organizationId, `organizations[${index}].organizationId`),
      expectedPreviousClerkOrganizationId: boundedId(
        entry.expectedPreviousClerkOrganizationId,
        `organizations[${index}].expectedPreviousClerkOrganizationId`,
        ID_PATTERNS.organization,
      ),
      nextClerkOrganizationId: boundedId(
        entry.nextClerkOrganizationId,
        `organizations[${index}].nextClerkOrganizationId`,
        ID_PATTERNS.organization,
      ),
    };
  });

  for (const [entries, keys] of [
    [users, ['platformUserId', 'expectedPreviousClerkUserId', 'nextClerkUserId']],
    [organizations, ['organizationId', 'expectedPreviousClerkOrganizationId', 'nextClerkOrganizationId']],
  ]) {
    for (const key of keys) unique(entries, key, key);
  }
  if (users.some((entry) => entry.expectedPreviousClerkUserId === entry.nextClerkUserId)) {
    throw new Error('Every user cutover must change its Clerk user ID.');
  }
  if (organizations.some(
    (entry) => entry.expectedPreviousClerkOrganizationId === entry.nextClerkOrganizationId,
  )) {
    throw new Error('Every organization cutover must change its Clerk organization ID.');
  }

  return {
    targetInstanceId: boundedId(
      manifest.targetInstanceId,
      'targetInstanceId',
      ID_PATTERNS.instance,
    ),
    users,
    organizations,
  };
}

export function assertProductionClerkInstance(instance, targetInstanceId) {
  if (instance?.id !== targetInstanceId) {
    throw new Error('The active Clerk secret does not match the cutover target instance.');
  }
  if (instance?.environment_type !== 'production') {
    throw new Error('Clerk identity cutover requires a production instance.');
  }
  return true;
}

export function validateClerkCutoverCoverage({
  manifest,
  databaseUsers,
  databaseOrganizations,
}) {
  if (manifest.users.length !== databaseUsers.length) {
    throw new Error('Cutover manifest must cover every Clerk-linked platform user.');
  }
  if (manifest.organizations.length !== databaseOrganizations.length) {
    throw new Error('Cutover manifest must cover every Clerk-linked organization.');
  }

  const usersById = new Map(databaseUsers.map((user) => [user.id, user]));
  const organizationsById = new Map(databaseOrganizations.map((organization) => [
    organization.id,
    organization,
  ]));
  const users = manifest.users.map((entry) => {
    const databaseUser = usersById.get(entry.platformUserId);
    if (!databaseUser || databaseUser.clerkUserId !== entry.expectedPreviousClerkUserId) {
      throw new Error('A platform user no longer matches its expected previous Clerk identity.');
    }
    return { entry, databaseUser };
  });
  const organizations = manifest.organizations.map((entry) => {
    const databaseOrganization = organizationsById.get(entry.organizationId);
    if (
      !databaseOrganization
      || databaseOrganization.clerkOrganizationId !== entry.expectedPreviousClerkOrganizationId
    ) {
      throw new Error('An organization no longer matches its expected previous Clerk identity.');
    }
    return { entry, databaseOrganization };
  });

  const currentUserIds = new Set(databaseUsers.map((user) => user.clerkUserId));
  const currentOrganizationIds = new Set(
    databaseOrganizations.map((organization) => organization.clerkOrganizationId),
  );
  if (users.some(({ entry }) => currentUserIds.has(entry.nextClerkUserId))) {
    throw new Error('A target Clerk user ID is already bound in the database.');
  }
  if (organizations.some(({ entry }) => currentOrganizationIds.has(entry.nextClerkOrganizationId))) {
    throw new Error('A target Clerk organization ID is already bound in the database.');
  }

  const superadmins = databaseUsers.filter((user) => user.systemRole === 'SUPERADMIN');
  if (superadmins.length !== 1 || superadmins[0].primaryEmail !== SUPERADMIN_EMAIL) {
    throw new Error('Cutover requires exactly the canonical ObraSaaS superadmin identity.');
  }
  if (databaseOrganizations.filter((organization) => databaseInternal(organization.metadata)).length !== 1) {
    throw new Error('Cutover requires exactly one internal ObraSaaS organization.');
  }

  return { users, organizations };
}

export function validateClerkCutoverMemberships({
  coverage,
  databaseMemberships,
  targetMemberships,
}) {
  const userTargets = new Map(coverage.users.map(({ entry, databaseUser }) => [
    databaseUser.id,
    entry.nextClerkUserId,
  ]));
  const organizationTargets = new Map(
    coverage.organizations.map(({ entry, databaseOrganization }) => [
      databaseOrganization.id,
      entry.nextClerkOrganizationId,
    ]),
  );
  const expected = new Map();

  for (const membership of databaseMemberships) {
    if (membership.status !== 'ACTIVE') continue;
    const clerkUserId = userTargets.get(membership.userId);
    const clerkOrganizationId = organizationTargets.get(membership.organizationId);
    if (!clerkUserId || !clerkOrganizationId) {
      throw new Error('An active database membership falls outside the cutover identity set.');
    }
    const key = `${clerkOrganizationId}:${clerkUserId}`;
    if (expected.has(key)) throw new Error('Database membership identities must be unique.');
    expected.set(key, membership.clerkRole);
  }

  const actual = new Map();
  for (const membership of targetMemberships) {
    const clerkOrganizationId = boundedId(
      membership.clerkOrganizationId,
      'targetMembership.clerkOrganizationId',
      ID_PATTERNS.organization,
    );
    const clerkUserId = boundedId(
      membership.clerkUserId,
      'targetMembership.clerkUserId',
      ID_PATTERNS.user,
    );
    const clerkRole = boundedId(membership.clerkRole, 'targetMembership.clerkRole');
    const key = `${clerkOrganizationId}:${clerkUserId}`;
    if (actual.has(key)) throw new Error('Target Clerk memberships must be unique.');
    actual.set(key, clerkRole);
  }

  if (actual.size !== expected.size) {
    throw new Error('Target Clerk memberships do not match active ObraSaaS memberships.');
  }
  for (const [key, expectedRole] of expected) {
    if (actual.get(key) !== expectedRole) {
      throw new Error('Target Clerk membership role does not match ObraSaaS.');
    }
  }
  return true;
}

export function validateClerkCutoverUserTarget({ entry, databaseUser, clerkUser }) {
  if (clerkUser?.id !== entry.nextClerkUserId) {
    throw new Error('Clerk returned a different target user identity.');
  }
  const email = verifiedPrimaryEmail(clerkUser);
  if (!email || email !== databaseUser.primaryEmail) {
    throw new Error('Target Clerk user does not match the verified platform email.');
  }
  return true;
}

export function validateClerkCutoverOrganizationTarget({
  entry,
  databaseOrganization,
  clerkOrganization,
}) {
  if (clerkOrganization?.id !== entry.nextClerkOrganizationId) {
    throw new Error('Clerk returned a different target organization identity.');
  }
  if (clerkDatabaseOrganizationId(clerkOrganization) !== databaseOrganization.id) {
    throw new Error('Target Clerk organization lacks the exact stable ObraSaaS database link.');
  }
  if (clerkInternal(clerkOrganization) !== databaseInternal(databaseOrganization.metadata)) {
    throw new Error('Target Clerk organization internal status does not match the database.');
  }
  return true;
}
