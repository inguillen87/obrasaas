import assert from 'node:assert/strict';
import test from 'node:test';

import {
  organizationPrivateMetadataLink,
  parseClerkOrganizationLinkArgs,
} from '../scripts/configure-clerk-organization-links.mjs';
import { CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY } from '../src/lib/clerk-organization-sync.js';

test('stable Clerk organization link preserves unrelated private metadata', () => {
  assert.deepEqual(organizationPrivateMetadataLink({
    id: 'org_a',
    private_metadata: { source: 'onboarding' },
  }, 'database_org_a'), {
    source: 'onboarding',
    [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: 'database_org_a',
  });
});

test('stable Clerk organization link is idempotent', () => {
  assert.deepEqual(organizationPrivateMetadataLink({
    id: 'org_a',
    privateMetadata: {
      [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: 'database_org_a',
    },
  }, 'database_org_a'), {
    [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: 'database_org_a',
  });
});

test('stable Clerk organization link refuses to overwrite another database identity', () => {
  assert.throws(
    () => organizationPrivateMetadataLink({
      id: 'org_a',
      private_metadata: {
        [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: 'database_org_other',
      },
    }, 'database_org_a'),
    /already linked to another ObraSaaS organization/,
  );
});

test('organization link CLI supports a production cutover plan with exact instance confirmation', () => {
  const args = parseClerkOrganizationLinkArgs([
    '--plan',
    'clerk-cutover-prod.json',
    '--apply',
    '--confirm-instance',
    'ins_Production123',
  ]);
  assert.equal(args.apply, true);
  assert.equal(args.confirmedInstanceId, 'ins_Production123');
  assert.match(args.planPath, /clerk-cutover-prod\.json$/);
  assert.throws(
    () => parseClerkOrganizationLinkArgs(['--confirm-instance']),
    /requires a value/,
  );
});
