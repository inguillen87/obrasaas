import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertS92ClerkDevelopmentInstance,
  buildS92ClerkFixturePlan,
  loadS92ClerkFixtureState,
  parseS92ClerkFixtureArgs,
  provisionS92ClerkFixtures,
  S92_CLERK_FIXTURE,
  S92_FIXTURE_ID,
  S92_ORGANIZATION_EXTERNAL_ID_METADATA_KEY,
  s92ClerkOrganizationCreateParams,
  s92ClerkOrganizationUpdateParams,
} from '../scripts/provision-s92-e2e-clerk-fixtures.mjs';

function emptyClerk(mutations = []) {
  const mutation = (name) => async () => {
    mutations.push(name);
    throw new Error(`Unexpected mutation ${name}`);
  };
  return {
    organizations: {
      async getOrganizationList() {
        return { data: [], totalCount: 0 };
      },
      createOrganization: mutation('createOrganization'),
      updateOrganization: mutation('updateOrganization'),
      updateOrganizationMetadata: mutation('updateOrganizationMetadata'),
      createOrganizationMembership: mutation('createOrganizationMembership'),
      updateOrganizationMembership: mutation('updateOrganizationMembership'),
      updateOrganizationMembershipMetadata: mutation('updateOrganizationMembershipMetadata'),
    },
    users: {
      async getUserList() {
        return { data: [], totalCount: 0 };
      },
      async getOrganizationMembershipList() {
        return { data: [], totalCount: 0 };
      },
      createUser: mutation('createUser'),
      updateUser: mutation('updateUser'),
    },
  };
}

function readyState() {
  const organizationByKey = new Map(S92_CLERK_FIXTURE.organizations.map((organization) => [
    organization.key,
    {
      id: `org_${organization.key}`,
      name: organization.name,
      privateMetadata: {
        [S92_ORGANIZATION_EXTERNAL_ID_METADATA_KEY]: organization.externalId,
        obrasaasFixture: S92_FIXTURE_ID,
        synthetic: true,
      },
    },
  ]));
  const userByKey = new Map();
  const membershipsByActorKey = new Map();
  for (const actor of S92_CLERK_FIXTURE.actors) {
    const user = {
      id: `user_${actor.key}`,
      externalId: actor.externalId,
      firstName: actor.firstName,
      lastName: actor.lastName,
      primaryEmailAddressId: `email_${actor.key}`,
      emailAddresses: [{
        id: `email_${actor.key}`,
        emailAddress: actor.email,
      }],
      publicMetadata: {
        obrasaasFixture: S92_FIXTURE_ID,
        expectedTenantRole: actor.tenantRole,
        synthetic: true,
      },
    };
    userByKey.set(actor.key, user);
    membershipsByActorKey.set(actor.key, [{
      id: `orgmem_${actor.key}`,
      role: actor.clerkRole,
      organization: { id: `org_${actor.organizationKey}` },
      publicMetadata: {
        obrasaasFixture: S92_FIXTURE_ID,
        obrasaasTenantRole: actor.tenantRole,
        synthetic: true,
      },
    }]);
  }
  return { organizationByKey, userByKey, membershipsByActorKey };
}

test('S9.2 Clerk fixture is synthetic, stable and split across two tenants', () => {
  assert.equal(S92_CLERK_FIXTURE.organizations.length, 2);
  assert.equal(S92_CLERK_FIXTURE.actors.length, 6);
  assert.deepEqual(
    S92_CLERK_FIXTURE.actors.filter(({ organizationKey }) => organizationKey === 'tenantA')
      .map(({ tenantRole }) => tenantRole),
    ['ADMIN', 'DIRECTOR', 'SITE_MANAGER', 'FINANCE', 'AUDITOR'],
  );
  const outsider = S92_CLERK_FIXTURE.actors.find(({ key }) => key === 'outsider');
  assert.equal(outsider.organizationKey, 'tenantB');
  assert.equal(outsider.tenantRole, 'ADMIN');
  assert.equal(outsider.clerkRole, 'org:admin');
  assert.equal(new Set(S92_CLERK_FIXTURE.actors.map(({ email }) => email)).size, 6);
  for (const organization of S92_CLERK_FIXTURE.organizations) {
    assert.match(organization.externalId, /^obrasaas-e2e:s92:/);
    assert.equal(Object.hasOwn(organization, 'slug'), false);
  }
  for (const actor of S92_CLERK_FIXTURE.actors) {
    assert.match(actor.externalId, /^obrasaas-e2e:s92:/);
    assert.match(actor.email, /\+clerk_test@example\.com$/);
  }
});

test('Clerk organizations never depend on the optional slug capability', () => {
  const specification = S92_CLERK_FIXTURE.organizations[0];
  const createParams = s92ClerkOrganizationCreateParams(specification);
  const updateParams = s92ClerkOrganizationUpdateParams(specification);
  assert.equal(Object.hasOwn(createParams, 'slug'), false);
  assert.equal(Object.hasOwn(updateParams, 'slug'), false);
  assert.equal(createParams.name, specification.name);
  assert.equal(
    createParams.privateMetadata[S92_ORGANIZATION_EXTERNAL_ID_METADATA_KEY],
    specification.externalId,
  );
});

test('a matching Clerk name without fixture metadata fails closed', async () => {
  const clerk = emptyClerk();
  clerk.organizations.getOrganizationList = async () => ({
    data: [{
      id: 'org_unrelated',
      name: S92_CLERK_FIXTURE.organizations[0].name.toUpperCase(),
      privateMetadata: {},
      slug: 'generated-by-clerk',
    }],
    totalCount: 1,
  });
  await assert.rejects(
    () => loadS92ClerkFixtureState(clerk),
    /organization name .* is owned by another resource/,
  );
});

test('Clerk fixture CLI is dry-run by default and verify cannot mutate', () => {
  assert.deepEqual(parseS92ClerkFixtureArgs([]), {
    apply: false,
    verify: false,
    confirmedInstanceId: null,
  });
  assert.deepEqual(parseS92ClerkFixtureArgs(['--verify']), {
    apply: false,
    verify: true,
    confirmedInstanceId: null,
  });
  assert.deepEqual(parseS92ClerkFixtureArgs([
    '--apply', '--confirm-instance', 'ins_Development123',
  ]), {
    apply: true,
    verify: false,
    confirmedInstanceId: 'ins_Development123',
  });
  assert.throws(
    () => parseS92ClerkFixtureArgs(['--apply', '--verify']),
    /mutually exclusive/,
  );
  assert.throws(() => parseS92ClerkFixtureArgs(['--unknown']), /Unknown argument/);
  assert.throws(
    () => parseS92ClerkFixtureArgs(['--confirm-instance']),
    /requires a value/,
  );
});

test('Development instance and sk_test gates fail closed', () => {
  assert.deepEqual(assertS92ClerkDevelopmentInstance({
    id: 'ins_Development123',
    environment_type: 'development',
  }, 'sk_test_fixture'), {
    id: 'ins_Development123',
    environmentType: 'development',
  });
  assert.throws(() => assertS92ClerkDevelopmentInstance({
    id: 'ins_Production123',
    environment_type: 'production',
  }, 'sk_test_fixture'), /Development/);
  assert.throws(() => assertS92ClerkDevelopmentInstance({
    id: 'ins_Development123',
    environment_type: 'development',
  }, 'sk_live_forbidden'), /sk_test/);
});

test('exact fixture state has no pending Clerk operation', () => {
  assert.deepEqual(buildS92ClerkFixturePlan(readyState()), []);
});

test('unexpected cross-organization membership fails instead of being deleted', () => {
  const state = readyState();
  state.membershipsByActorKey.get('auditor').push({
    id: 'orgmem_foreign',
    role: 'org:member',
    organization: { id: 'org_foreign' },
    publicMetadata: {},
  });
  assert.throws(
    () => buildS92ClerkFixturePlan(state),
    /unexpected Clerk organization/,
  );
});

test('dry-run and verify never call a Clerk mutation', async () => {
  const mutations = [];
  const clerk = emptyClerk(mutations);
  const instance = { id: 'ins_Development123', environment_type: 'development' };
  const dryRun = await provisionS92ClerkFixtures({
    clerk,
    instance,
    secretKey: 'sk_test_fixture',
  });
  assert.equal(dryRun.applied, false);
  assert.equal(dryRun.operations.length, 8);
  assert.deepEqual(mutations, []);

  await assert.rejects(() => provisionS92ClerkFixtures({
    clerk,
    instance,
    secretKey: 'sk_test_fixture',
    verify: true,
  }), /pending operation/);
  assert.deepEqual(mutations, []);
});

test('apply refuses production and requires exact Development instance confirmation', async () => {
  const mutations = [];
  const clerk = emptyClerk(mutations);
  await assert.rejects(() => provisionS92ClerkFixtures({
    apply: true,
    confirmedInstanceId: 'ins_Production123',
    secretKey: 'sk_test_fixture',
    instance: { id: 'ins_Production123', environment_type: 'production' },
    clerk,
  }), /Development/);
  await assert.rejects(() => provisionS92ClerkFixtures({
    apply: true,
    confirmedInstanceId: 'ins_Other123',
    secretKey: 'sk_test_fixture',
    instance: { id: 'ins_Development123', environment_type: 'development' },
    clerk,
  }), /confirm-instance/);
  assert.deepEqual(mutations, []);
});
