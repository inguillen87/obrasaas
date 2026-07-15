import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clerkOrganizationIsInternal,
  mergeClerkOrganizationMetadata,
} from '../src/lib/organization-policy.js';

test('only explicitly marked Clerk organizations are internal', () => {
  assert.equal(clerkOrganizationIsInternal({ publicMetadata: { internal: true } }), true);
  assert.equal(clerkOrganizationIsInternal({ public_metadata: { internal: true } }), true);
  assert.equal(clerkOrganizationIsInternal({ publicMetadata: {} }), false);
  assert.equal(
    clerkOrganizationIsInternal(
      { id: 'org_internal', publicMetadata: {} },
      null,
      'org_internal',
    ),
    true,
  );
});

test('Clerk metadata sync preserves the internal platform marker', () => {
  const metadata = mergeClerkOrganizationMetadata(
    { internal: true, billingNote: 'not exposed' },
    {
      name: 'Marcelo Organization',
      slug: 'obrasaas-operaciones',
      imageUrl: 'https://img.example/logo.png',
    },
  );
  assert.deepEqual(metadata, {
    internal: true,
    billingNote: 'not exposed',
    clerkSlug: 'obrasaas-operaciones',
    clerkName: 'Marcelo Organization',
    clerkImageUrl: 'https://img.example/logo.png',
  });
});
