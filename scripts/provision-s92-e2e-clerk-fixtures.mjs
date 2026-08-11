import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createClerkClient } from '@clerk/backend';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

export const S92_FIXTURE_ID = 'obrasaas-e2e:s92';
export const S92_ORGANIZATION_EXTERNAL_ID_METADATA_KEY = 'obrasaasFixtureExternalId';

export const S92_CLERK_FIXTURE = Object.freeze({
  organizations: Object.freeze([
    Object.freeze({
      key: 'tenantA',
      externalId: `${S92_FIXTURE_ID}:organization:primary`,
      name: 'ObraSaaS S9.2 E2E Primary',
    }),
    Object.freeze({
      key: 'tenantB',
      externalId: `${S92_FIXTURE_ID}:organization:other`,
      name: 'ObraSaaS S9.2 E2E Other Tenant',
    }),
  ]),
  actors: Object.freeze([
    Object.freeze({
      key: 'admin',
      externalId: `${S92_FIXTURE_ID}:user:admin`,
      email: 's92-admin+clerk_test@example.com',
      firstName: 'S92',
      lastName: 'Synthetic Admin',
      organizationKey: 'tenantA',
      clerkRole: 'org:admin',
      tenantRole: 'ADMIN',
    }),
    Object.freeze({
      key: 'director',
      externalId: `${S92_FIXTURE_ID}:user:director`,
      email: 's92-director+clerk_test@example.com',
      firstName: 'S92',
      lastName: 'Synthetic Director',
      organizationKey: 'tenantA',
      clerkRole: 'org:member',
      tenantRole: 'DIRECTOR',
    }),
    Object.freeze({
      key: 'siteManager',
      externalId: `${S92_FIXTURE_ID}:user:site-manager`,
      email: 's92-site-manager+clerk_test@example.com',
      firstName: 'S92',
      lastName: 'Synthetic Site Manager',
      organizationKey: 'tenantA',
      clerkRole: 'org:member',
      tenantRole: 'SITE_MANAGER',
    }),
    Object.freeze({
      key: 'finance',
      externalId: `${S92_FIXTURE_ID}:user:finance`,
      email: 's92-finance+clerk_test@example.com',
      firstName: 'S92',
      lastName: 'Synthetic Finance',
      organizationKey: 'tenantA',
      clerkRole: 'org:member',
      tenantRole: 'FINANCE',
    }),
    Object.freeze({
      key: 'auditor',
      externalId: `${S92_FIXTURE_ID}:user:auditor`,
      email: 's92-auditor+clerk_test@example.com',
      firstName: 'S92',
      lastName: 'Synthetic Auditor',
      organizationKey: 'tenantA',
      clerkRole: 'org:member',
      tenantRole: 'AUDITOR',
    }),
    Object.freeze({
      key: 'outsider',
      externalId: `${S92_FIXTURE_ID}:user:outsider`,
      email: 's92-outsider+clerk_test@example.com',
      firstName: 'S92',
      lastName: 'Synthetic Other Tenant Admin',
      organizationKey: 'tenantB',
      clerkRole: 'org:admin',
      tenantRole: 'ADMIN',
    }),
  ]),
});

function optionValue(args, name) {
  const indexes = args.flatMap((value, index) => (value === name ? [index] : []));
  if (indexes.length > 1) throw new Error(`${name} may only be provided once.`);
  if (indexes.length === 0) return null;
  const value = args[indexes[0] + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

export function parseS92ClerkFixtureArgs(args) {
  const supported = new Set(['--apply', '--verify', '--confirm-instance']);
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!supported.has(value)) throw new Error(`Unknown argument: ${value}`);
    if (value === '--confirm-instance') index += 1;
  }
  const apply = args.includes('--apply');
  const verify = args.includes('--verify');
  if (apply && verify) throw new Error('--apply and --verify are mutually exclusive.');
  return {
    apply,
    verify,
    confirmedInstanceId: optionValue(args, '--confirm-instance'),
  };
}

function pageData(response) {
  return Array.isArray(response) ? response : response?.data || [];
}

function totalCount(response) {
  const value = response?.totalCount ?? response?.total_count;
  return Number.isInteger(value) ? value : null;
}

async function listAll(loadPage, label) {
  const rows = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const response = await loadPage({ limit, offset });
    const page = pageData(response);
    rows.push(...page);
    const total = totalCount(response);
    if (page.length < limit || (total !== null && rows.length >= total)) return rows;
    if (offset >= 9_900) throw new Error(`Clerk returned more than 10,000 ${label}.`);
  }
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function organizationMetadata(organization) {
  return record(organization?.privateMetadata ?? organization?.private_metadata);
}

function normalizedOrganizationName(value) {
  return String(value || '').trim().toLocaleLowerCase('en-US');
}

function membershipMetadata(membership) {
  return record(membership?.publicMetadata ?? membership?.public_metadata);
}

function primaryEmail(user) {
  const emailAddresses = user?.emailAddresses ?? user?.email_addresses ?? [];
  const primaryId = user?.primaryEmailAddressId ?? user?.primary_email_address_id;
  const primary = emailAddresses.find((email) => email.id === primaryId) || emailAddresses[0];
  return String(primary?.emailAddress ?? primary?.email_address ?? '').trim().toLowerCase();
}

function membershipOrganizationId(membership) {
  return membership?.organization?.id
    ?? membership?.organizationId
    ?? membership?.organization_id
    ?? null;
}

function fixtureOrganizationMetadata(specification) {
  return {
    [S92_ORGANIZATION_EXTERNAL_ID_METADATA_KEY]: specification.externalId,
    obrasaasFixture: S92_FIXTURE_ID,
    synthetic: true,
  };
}

function fixtureUserMetadata(actor) {
  return {
    obrasaasFixture: S92_FIXTURE_ID,
    expectedTenantRole: actor.tenantRole,
    synthetic: true,
  };
}

function fixtureMembershipMetadata(actor) {
  return {
    obrasaasFixture: S92_FIXTURE_ID,
    obrasaasTenantRole: actor.tenantRole,
    synthetic: true,
  };
}

function metadataContains(actual, expected) {
  const source = record(actual);
  return Object.entries(expected).every(([key, value]) => source[key] === value);
}

export function assertS92ClerkDevelopmentInstance(instance, secretKey) {
  if (!String(secretKey || '').startsWith('sk_test_')) {
    throw new Error('S9.2 E2E Clerk fixtures require CLERK_SECRET_KEY=sk_test_* only.');
  }
  const environmentType = instance?.environmentType ?? instance?.environment_type;
  if (!instance?.id || environmentType !== 'development') {
    throw new Error('S9.2 E2E Clerk fixtures are restricted to an identified Development instance.');
  }
  return { id: instance.id, environmentType };
}

export async function loadS92ClerkFixtureState(clerk) {
  const [organizations, users] = await Promise.all([
    listAll(
      ({ limit, offset }) => clerk.organizations.getOrganizationList({ limit, offset }),
      'organizations',
    ),
    listAll(({ limit, offset }) => clerk.users.getUserList({ limit, offset }), 'users'),
  ]);

  const organizationByKey = new Map();
  for (const specification of S92_CLERK_FIXTURE.organizations) {
    const externalMatches = organizations.filter((organization) => (
      organizationMetadata(organization)[S92_ORGANIZATION_EXTERNAL_ID_METADATA_KEY]
      === specification.externalId
    ));
    if (externalMatches.length > 1) {
      throw new Error(`Duplicate Clerk organizations for ${specification.externalId}.`);
    }
    const nameMatches = organizations.filter((organization) => (
      normalizedOrganizationName(organization.name)
      === normalizedOrganizationName(specification.name)
    ));
    const selected = externalMatches[0] || null;
    if (!selected && nameMatches.length > 0) {
      throw new Error(`Clerk organization name ${specification.name} is owned by another resource.`);
    }
    if (selected && nameMatches.some(({ id }) => id !== selected.id)) {
      throw new Error(`Clerk organization name ${specification.name} is ambiguous.`);
    }
    organizationByKey.set(specification.key, selected);
  }

  const userByKey = new Map();
  const membershipsByActorKey = new Map();
  for (const actor of S92_CLERK_FIXTURE.actors) {
    const externalMatches = users.filter((user) => user.externalId === actor.externalId);
    if (externalMatches.length > 1) throw new Error(`Duplicate Clerk users for ${actor.externalId}.`);
    const emailMatches = users.filter((user) => primaryEmail(user) === actor.email);
    const selected = externalMatches[0] || null;
    if (!selected && emailMatches.length > 0) {
      throw new Error(`Synthetic email ${actor.email} is owned by another Clerk user.`);
    }
    if (selected && primaryEmail(selected) !== actor.email) {
      throw new Error(`Clerk user ${actor.externalId} does not own its exact synthetic email.`);
    }
    if (selected && emailMatches.some(({ id }) => id !== selected.id)) {
      throw new Error(`Synthetic email ${actor.email} is ambiguous.`);
    }
    userByKey.set(actor.key, selected);
    if (selected) {
      const memberships = await listAll(
        ({ limit, offset }) => clerk.users.getOrganizationMembershipList({
          userId: selected.id,
          limit,
          offset,
        }),
        `memberships for ${actor.externalId}`,
      );
      membershipsByActorKey.set(actor.key, memberships);
    } else {
      membershipsByActorKey.set(actor.key, []);
    }
  }

  return { organizationByKey, userByKey, membershipsByActorKey };
}

export function buildS92ClerkFixturePlan(state) {
  const operations = [];
  for (const specification of S92_CLERK_FIXTURE.organizations) {
    const organization = state.organizationByKey.get(specification.key);
    if (!organization) {
      operations.push({ kind: 'createOrganization', key: specification.key });
      continue;
    }
    const expectedMetadata = fixtureOrganizationMetadata(specification);
    if (
      organization.name !== specification.name
      || !metadataContains(organizationMetadata(organization), expectedMetadata)
    ) {
      operations.push({ kind: 'updateOrganization', key: specification.key, id: organization.id });
    }
  }

  for (const actor of S92_CLERK_FIXTURE.actors) {
    const user = state.userByKey.get(actor.key);
    if (!user) {
      operations.push({ kind: 'createUser', key: actor.key });
      continue;
    }
    const expectedUserMetadata = fixtureUserMetadata(actor);
    if (
      user.firstName !== actor.firstName
      || user.lastName !== actor.lastName
      || !metadataContains(user.publicMetadata ?? user.public_metadata, expectedUserMetadata)
    ) {
      operations.push({ kind: 'updateUser', key: actor.key, id: user.id });
    }

    const expectedOrganization = state.organizationByKey.get(actor.organizationKey);
    const memberships = state.membershipsByActorKey.get(actor.key) || [];
    const unexpected = memberships.filter((membership) => (
      !expectedOrganization || membershipOrganizationId(membership) !== expectedOrganization.id
    ));
    if (unexpected.length > 0) {
      throw new Error(`Synthetic actor ${actor.externalId} belongs to an unexpected Clerk organization.`);
    }
    if (!expectedOrganization) continue;
    if (memberships.length > 1) {
      throw new Error(`Synthetic actor ${actor.externalId} has duplicate Clerk memberships.`);
    }
    const membership = memberships[0] || null;
    if (!membership) {
      operations.push({ kind: 'createMembership', key: actor.key });
      continue;
    }
    const expectedMembershipMetadata = fixtureMembershipMetadata(actor);
    if (
      membership.role !== actor.clerkRole
      || !metadataContains(membershipMetadata(membership), expectedMembershipMetadata)
    ) {
      operations.push({ kind: 'updateMembership', key: actor.key });
    }
  }
  return operations;
}

function actorSpecification(key) {
  const actor = S92_CLERK_FIXTURE.actors.find((candidate) => candidate.key === key);
  if (!actor) throw new Error(`Unknown S9.2 actor ${key}.`);
  return actor;
}

function organizationSpecification(key) {
  const organization = S92_CLERK_FIXTURE.organizations.find((candidate) => candidate.key === key);
  if (!organization) throw new Error(`Unknown S9.2 organization ${key}.`);
  return organization;
}

export function s92ClerkOrganizationCreateParams(specification) {
  return {
    name: specification.name,
    privateMetadata: fixtureOrganizationMetadata(specification),
    publicMetadata: { synthetic: true, obrasaasFixture: S92_FIXTURE_ID },
  };
}

export function s92ClerkOrganizationUpdateParams(specification) {
  return { name: specification.name };
}

async function applyS92ClerkOperation(clerk, state, operation) {
  if (operation.kind === 'createOrganization') {
    const specification = organizationSpecification(operation.key);
    await clerk.organizations.createOrganization(
      s92ClerkOrganizationCreateParams(specification),
    );
    return;
  }
  if (operation.kind === 'updateOrganization') {
    const specification = organizationSpecification(operation.key);
    await clerk.organizations.updateOrganization(
      operation.id,
      s92ClerkOrganizationUpdateParams(specification),
    );
    await clerk.organizations.updateOrganizationMetadata(operation.id, {
      privateMetadata: fixtureOrganizationMetadata(specification),
      publicMetadata: { synthetic: true, obrasaasFixture: S92_FIXTURE_ID },
    });
    return;
  }
  if (operation.kind === 'createUser') {
    const actor = actorSpecification(operation.key);
    await clerk.users.createUser({
      externalId: actor.externalId,
      emailAddress: [actor.email],
      firstName: actor.firstName,
      lastName: actor.lastName,
      publicMetadata: fixtureUserMetadata(actor),
      privateMetadata: { synthetic: true, obrasaasFixture: S92_FIXTURE_ID },
      skipPasswordRequirement: true,
      skipLegalChecks: true,
    });
    return;
  }
  if (operation.kind === 'updateUser') {
    const actor = actorSpecification(operation.key);
    await clerk.users.updateUser(operation.id, {
      firstName: actor.firstName,
      lastName: actor.lastName,
      publicMetadata: fixtureUserMetadata(actor),
      privateMetadata: { synthetic: true, obrasaasFixture: S92_FIXTURE_ID },
    });
    return;
  }

  const actor = actorSpecification(operation.key);
  const user = state.userByKey.get(actor.key);
  const organization = state.organizationByKey.get(actor.organizationKey);
  if (!user || !organization) throw new Error(`Cannot apply ${operation.kind} before identities exist.`);
  if (operation.kind === 'createMembership') {
    await clerk.organizations.createOrganizationMembership({
      organizationId: organization.id,
      userId: user.id,
      role: actor.clerkRole,
    });
  } else if (operation.kind === 'updateMembership') {
    await clerk.organizations.updateOrganizationMembership({
      organizationId: organization.id,
      userId: user.id,
      role: actor.clerkRole,
    });
  } else {
    throw new Error(`Unsupported S9.2 Clerk operation ${operation.kind}.`);
  }
  await clerk.organizations.updateOrganizationMembershipMetadata({
    organizationId: organization.id,
    userId: user.id,
    publicMetadata: fixtureMembershipMetadata(actor),
  });
}

export function s92ResolvedClerkFixture(state, instance) {
  const organizations = Object.fromEntries(S92_CLERK_FIXTURE.organizations.map((specification) => {
    const organization = state.organizationByKey.get(specification.key);
    if (!organization) throw new Error(`Missing resolved Clerk organization ${specification.externalId}.`);
    return [specification.key, {
      externalId: specification.externalId,
      clerkOrganizationId: organization.id,
    }];
  }));
  const actors = Object.fromEntries(S92_CLERK_FIXTURE.actors.map((actor) => {
    const user = state.userByKey.get(actor.key);
    const organization = state.organizationByKey.get(actor.organizationKey);
    if (!user || !organization) throw new Error(`Missing resolved Clerk actor ${actor.externalId}.`);
    return [actor.key, {
      externalId: actor.externalId,
      email: actor.email,
      clerkUserId: user.id,
      clerkOrganizationId: organization.id,
      tenantRole: actor.tenantRole,
      clerkRole: actor.clerkRole,
    }];
  }));
  return {
    instanceId: instance.id,
    environmentType: 'development',
    organizations,
    actors,
  };
}

export async function readClerkInstance({ secretKey, fetchImpl = fetch }) {
  const response = await fetchImpl('https://api.clerk.com/v1/instance', {
    method: 'GET',
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Clerk instance verification failed (${response.status}).`);
  return body;
}

export async function provisionS92ClerkFixtures({
  apply = false,
  verify = false,
  confirmedInstanceId = null,
  secretKey = process.env.CLERK_SECRET_KEY,
  clerk = null,
  instance = null,
  fetchImpl = fetch,
} = {}) {
  if (apply && verify) throw new Error('--apply and --verify are mutually exclusive.');
  if (!String(secretKey || '').startsWith('sk_test_')) {
    throw new Error('S9.2 E2E Clerk fixtures require CLERK_SECRET_KEY=sk_test_* only.');
  }
  const activeInstance = instance || await readClerkInstance({ secretKey, fetchImpl });
  const verifiedInstance = assertS92ClerkDevelopmentInstance(activeInstance, secretKey);
  const client = clerk || createClerkClient({ secretKey });
  let state = await loadS92ClerkFixtureState(client);
  let operations = buildS92ClerkFixturePlan(state);

  if (verify) {
    if (operations.length > 0) {
      throw new Error(`S9.2 Clerk fixture verification found ${operations.length} pending operation(s).`);
    }
    return { applied: false, verified: true, operations: [], fixture: s92ResolvedClerkFixture(state, verifiedInstance) };
  }
  if (!apply) {
    return { applied: false, verified: operations.length === 0, operations };
  }
  if (confirmedInstanceId !== verifiedInstance.id) {
    throw new Error('--confirm-instance must match the active Clerk Development instance exactly.');
  }

  for (const operation of operations.filter(({ kind }) => (
    kind === 'createOrganization'
    || kind === 'updateOrganization'
    || kind === 'createUser'
    || kind === 'updateUser'
  ))) {
    await applyS92ClerkOperation(client, state, operation);
  }
  state = await loadS92ClerkFixtureState(client);
  operations = buildS92ClerkFixturePlan(state);
  for (const operation of operations.filter(({ kind }) => (
    kind === 'createMembership' || kind === 'updateMembership'
  ))) {
    await applyS92ClerkOperation(client, state, operation);
  }
  state = await loadS92ClerkFixtureState(client);
  operations = buildS92ClerkFixturePlan(state);
  if (operations.length > 0) {
    throw new Error(`S9.2 Clerk fixture apply left ${operations.length} pending operation(s).`);
  }
  return {
    applied: true,
    verified: true,
    operations: [],
    fixture: s92ResolvedClerkFixture(state, verifiedInstance),
  };
}

const isMainModule = Boolean(
  process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
);

if (isMainModule) {
  const args = parseS92ClerkFixtureArgs(process.argv.slice(2));
  const result = await provisionS92ClerkFixtures(args);
  if (args.verify) {
    console.log('S9.2 Clerk Development fixtures verified with no drift.');
  } else if (args.apply) {
    console.log('S9.2 synthetic Clerk Development fixtures applied and verified.');
  } else {
    console.log(`S9.2 Clerk dry run: ${result.operations.length} pending operation(s); no mutations performed.`);
  }
}
