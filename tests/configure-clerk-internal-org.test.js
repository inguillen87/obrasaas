import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INTERNAL_ORGANIZATION_PROFILE,
  parseInternalOrganizationArgs,
  selectInternalOrganization,
} from '../scripts/configure-clerk-internal-org.mjs';

function membership(id, internal = false) {
  return {
    organization: {
      id,
      public_metadata: internal ? { internal: true } : {},
    },
  };
}

test('requires an explicit ID when no organization is already internal', () => {
  assert.throws(
    () => selectInternalOrganization({
      memberships: [membership('org_tenant_a'), membership('org_tenant_b')],
    }),
    /Set OBRASAAS_INTERNAL_CLERK_ORG_ID explicitly/,
  );
});

test('selects the explicit organization without falling back to the first membership', () => {
  const selected = selectInternalOrganization({
    memberships: [membership('org_tenant'), membership('org_operations')],
    explicitOrganizationId: 'org_operations',
  });

  assert.equal(selected.id, 'org_operations');
});

test('rejects an explicit organization outside the superadmin memberships', () => {
  assert.throws(
    () => selectInternalOrganization({
      memberships: [membership('org_tenant')],
      explicitOrganizationId: 'org_unknown',
    }),
    /is not an organization membership of guillen\.marce@gmail\.com/,
  );
});

test('reuses exactly one already-internal organization when no ID is configured', () => {
  const selected = selectInternalOrganization({
    memberships: [membership('org_tenant'), membership('org_operations', true)],
  });

  assert.equal(selected.id, 'org_operations');
});

test('rejects multiple already-internal organizations as ambiguous', () => {
  assert.throws(
    () => selectInternalOrganization({
      memberships: [membership('org_internal_a', true), membership('org_internal_b', true)],
    }),
    /Multiple Clerk organizations are marked internal/,
  );
});

test('rejects an explicit ID that conflicts with another internal organization', () => {
  assert.throws(
    () => selectInternalOrganization({
      memberships: [membership('org_existing_internal', true), membership('org_explicit')],
      explicitOrganizationId: 'org_explicit',
    }),
    /Another organization is already marked internal/,
  );
});

test('internal organization setup does not require paid or disabled slug support', () => {
  assert.deepEqual(INTERNAL_ORGANIZATION_PROFILE, {
    name: 'ObraSaaS Operaciones',
  });
  assert.equal(Object.hasOwn(INTERNAL_ORGANIZATION_PROFILE, 'slug'), false);
});

test('internal organization mutation requires exact Clerk instance confirmation', () => {
  assert.deepEqual(parseInternalOrganizationArgs([]), {
    apply: false,
    confirmedInstanceId: null,
  });
  assert.deepEqual(parseInternalOrganizationArgs([
    '--apply',
    '--confirm-instance',
    'ins_Development123',
  ]), {
    apply: true,
    confirmedInstanceId: 'ins_Development123',
  });
  assert.throws(
    () => parseInternalOrganizationArgs(['--confirm-instance']),
    /requires a value/,
  );
});
