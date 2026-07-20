import { createClerkClient } from '@clerk/backend';
import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

const SUPERADMIN_EMAIL = 'guillen.marce@gmail.com';

let identityFixturesPromise;

function primaryEmail(user) {
  return user.emailAddresses
    .find((email) => email.id === user.primaryEmailAddressId)
    ?.emailAddress
    ?.trim()
    ?.toLowerCase() || null;
}

function isInternalOrganization(organization) {
  return organization.publicMetadata?.internal === true;
}

async function loadIdentityFixtures() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey?.startsWith('sk_test_')) {
    throw new Error('Clerk E2E tests require the dedicated development instance secret key.');
  }

  const client = createClerkClient({ secretKey });
  const response = await client.users.getUserList({ limit: 100 });
  const users = response.data.map((user) => ({
    email: primaryEmail(user),
    user,
  }));
  const superadmins = users.filter(({ email }) => email === SUPERADMIN_EMAIL);
  if (superadmins.length !== 1) {
    throw new Error('Clerk E2E requires exactly the canonical ObraSaaS superadmin.');
  }

  const superadminMemberships = await client.users.getOrganizationMembershipList({
    userId: superadmins[0].user.id,
    limit: 100,
  });
  const internalMemberships = superadminMemberships.data.filter(({ organization }) => (
    isInternalOrganization(organization)
  ));
  if (internalMemberships.length !== 1) {
    throw new Error('Clerk E2E requires exactly one internal superadmin organization.');
  }

  for (const candidate of users.filter(({ email }) => email && email !== SUPERADMIN_EMAIL)) {
    const memberships = await client.users.getOrganizationMembershipList({
      userId: candidate.user.id,
      limit: 100,
    });
    const externalMembership = memberships.data.find(({ organization }) => (
      !isInternalOrganization(organization)
    ));
    if (externalMembership) {
      if (memberships.data.some(({ organization }) => isInternalOrganization(organization))) {
        throw new Error('A tenant E2E identity must never belong to the internal organization.');
      }
      return {
        superadmin: {
          email: SUPERADMIN_EMAIL,
          organizationId: internalMemberships[0].organization.id,
        },
        tenant: {
          email: candidate.email,
          organizationId: externalMembership.organization.id,
        },
      };
    }
  }

  throw new Error('Clerk E2E requires one verified tenant user with an external organization.');
}

function identityFixtures() {
  identityFixturesPromise ||= loadIdentityFixtures();
  return identityFixturesPromise;
}

async function signInWithOrganization(page, identity) {
  await page.goto('/sign-in');
  await clerk.signIn({ page, emailAddress: identity.email });
  await page.waitForFunction(() => Boolean(window.Clerk?.session));
  await page.evaluate(async (organizationId) => {
    await window.Clerk.setActive({ organization: organizationId });
  }, identity.organizationId);
  await page.waitForFunction(
    (organizationId) => window.Clerk?.organization?.id === organizationId,
    identity.organizationId,
  );
}

async function sameOriginResponse(page, pathname, init = {}) {
  return page.evaluate(async (url) => {
    const response = await fetch(url.pathname, {
      ...url.init,
      credentials: 'same-origin',
    });
    return {
      status: response.status,
      payload: await response.json().catch(() => null),
    };
  }, { pathname, init });
}

test('an anonymous visitor cannot open the dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL((url) => url.pathname.startsWith('/sign-in'));

  expect(new URL(page.url()).pathname).toMatch(/^\/sign-in/);
  await expect(page.getByRole('heading', { name: 'Volvé a decidir con evidencia.' })).toBeVisible();
});

test('the canonical superadmin always enters the internal control plane', async ({ page }) => {
  const { superadmin } = await identityFixtures();
  await signInWithOrganization(page, superadmin);
  await page.goto('/dashboard');

  await expect(page.locator('.internal-workspace')).toBeVisible();
  await expect(
    page.locator('.internal-workspace').getByText('ObraSaaS Operaciones', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.dashboard-organization-switcher')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Consola SuperAdmin' })).toBeVisible();
  const authorizationProbe = await sameOriginResponse(page, '/api/superadmin/tenants', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(authorizationProbe.status).toBe(400);
  expect(authorizationProbe.payload?.code).not.toBe('SUPERADMIN_REQUIRED');

  await page.goto('/superadmin');
  await expect(page.getByRole('heading', { name: 'Administración global' })).toBeVisible();
  await expect(page.getByText('Superadmin exclusivo')).toBeVisible();
});

test('a tenant stays inside its organization and cannot reach internal or superadmin surfaces', async ({ page }) => {
  const { superadmin, tenant } = await identityFixtures();
  await signInWithOrganization(page, tenant);
  await page.goto('/dashboard');

  await expect(page.locator('.dashboard-organization-switcher')).toBeVisible();
  await expect(page.locator('.dashboard-organization-switcher button')).toBeVisible();
  await expect(page.locator('.internal-workspace')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Consola SuperAdmin' })).toHaveCount(0);
  const internalActivation = await page.evaluate(async ({ internalOrganizationId, tenantOrganizationId }) => {
    try {
      await window.Clerk.setActive({ organization: internalOrganizationId });
    } catch {
      // Clerk rejects organizations outside the signed-in user's membership set.
    }
    return {
      activeOrganizationId: window.Clerk.organization?.id || null,
      tenantOrganizationId,
    };
  }, {
    internalOrganizationId: superadmin.organizationId,
    tenantOrganizationId: tenant.organizationId,
  });
  expect(internalActivation.activeOrganizationId).toBe(internalActivation.tenantOrganizationId);
  const authorizationProbe = await sameOriginResponse(page, '/api/superadmin/tenants', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(authorizationProbe).toMatchObject({
    status: 403,
    payload: { code: 'SUPERADMIN_REQUIRED' },
  });
});

test('signing out invalidates access to protected routes', async ({ page }) => {
  const { superadmin } = await identityFixtures();
  await signInWithOrganization(page, superadmin);
  await page.goto('/dashboard');
  await expect(page.locator('.internal-workspace')).toBeVisible();

  await clerk.signOut({ page });
  await page.goto('/dashboard');
  await page.waitForURL((url) => url.pathname.startsWith('/sign-in'));
  expect(new URL(page.url()).pathname).toMatch(/^\/sign-in/);
});
