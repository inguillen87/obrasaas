import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error('CLERK_SECRET_KEY is required.');

async function clerk(path) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Clerk GET ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

const [roles, permissions] = await Promise.all([
  clerk('/organization_roles?limit=100'),
  clerk('/organization_permissions?limit=100'),
]);

const customRoles = roles.data.filter(
  ({ key }) => key !== 'org:admin' && key !== 'org:member',
);
const customPermissions = permissions.data.filter(
  ({ key }) => !key.startsWith('org:sys_'),
);

if (customRoles.length || customPermissions.length) {
  console.error('Clerk cost-safety audit failed.');
  if (customRoles.length) {
    console.error(`Paid custom roles detected: ${customRoles.map(({ key }) => key).join(', ')}`);
  }
  if (customPermissions.length) {
    console.error(`Custom permissions detected: ${customPermissions.map(({ key }) => key).join(', ')}`);
  }
  console.error('ObraSaaS roles belong in TenantMembership. Do not enable the Clerk B2B add-on without approval.');
  process.exitCode = 1;
} else {
  console.log('Clerk RBAC cost-safety audit passed: only org:admin and org:member are enabled.');
  console.log('Operational roles remain tenant-scoped in the ObraSaaS database.');
}
