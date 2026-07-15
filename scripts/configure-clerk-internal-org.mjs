import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const apply = process.argv.includes('--apply');
const secretKey = process.env.CLERK_SECRET_KEY;
const superadminEmail = (
  process.env.OBRASAAS_SUPERADMIN_EMAIL || 'guillen.marce@gmail.com'
).trim().toLowerCase();

if (!secretKey) throw new Error('CLERK_SECRET_KEY is required.');

async function clerk(path, init = {}) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const details = Array.isArray(body?.errors)
      ? body.errors.map(({ code, message, long_message: longMessage }) => ({
        code,
        message,
        longMessage,
      }))
      : null;
    throw new Error(
      `Clerk ${init.method || 'GET'} ${path} failed (${response.status}): ${JSON.stringify(details)}`,
    );
  }
  return body;
}

const usersResponse = await clerk(
  `/users?email_address=${encodeURIComponent(superadminEmail)}&limit=10`,
);
const users = Array.isArray(usersResponse) ? usersResponse : usersResponse?.data || [];
const user = users.find((item) => item.email_addresses?.some(
  (email) => email.email_address?.trim().toLowerCase() === superadminEmail,
));
if (!user) throw new Error(`No Clerk user found for ${superadminEmail}.`);

const membershipsResponse = await clerk(
  `/users/${encodeURIComponent(user.id)}/organization_memberships?limit=100`,
);
const memberships = Array.isArray(membershipsResponse)
  ? membershipsResponse
  : membershipsResponse?.data || [];
const organization = memberships.find(
  (membership) => membership.organization?.public_metadata?.internal === true,
)?.organization || memberships[0]?.organization;
if (!organization) throw new Error('The superadmin does not belong to a Clerk organization.');

const nextMetadata = {
  ...(organization.public_metadata || {}),
  internal: true,
  purpose: 'platform-operations',
};

console.log(`${apply ? 'Configuring' : 'Would configure'} ${organization.id} as ObraSaaS Operaciones.`);
if (apply) {
  await clerk(`/organizations/${encodeURIComponent(organization.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: 'ObraSaaS Operaciones',
      slug: 'obrasaas-operaciones',
    }),
  });
  await clerk(`/organizations/${encodeURIComponent(organization.id)}/metadata`, {
    method: 'PATCH',
    body: JSON.stringify({ public_metadata: nextMetadata }),
  });
  console.log('Internal Clerk organization configured.');
} else {
  console.log('Dry run complete. Re-run with --apply to mutate Clerk.');
}
