import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const apply = process.argv.includes('--apply');
const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error('CLERK_SECRET_KEY is required.');

const permissions = [
  ['Projects read', 'org:projects:read', 'View projects, plans and field activity.'],
  ['Projects manage', 'org:projects:manage', 'Create and update projects, tasks and schedules.'],
  ['Field operations manage', 'org:field:manage', 'Manage attendance, incidents, evidence and field workflows.'],
  ['Reports read', 'org:reports:read', 'View and export operational reports.'],
  ['Costs read', 'org:costs:read', 'View budgets, costs and purchasing data.'],
  ['Costs manage', 'org:costs:manage', 'Manage budgets, purchases and supplier operations.'],
  ['Integrations manage', 'org:integrations:manage', 'Configure WhatsApp and external integrations.'],
  ['Portfolio read', 'org:portfolio:read', 'View cross-project portfolio analytics.'],
];

const roles = [
  ['Admin', 'org:admin', 'Full tenant administration.', permissions.map(([, key]) => key)],
  ['Director de obra', 'org:director', 'Directs projects, resources, costs and operational decisions.', [
    'org:projects:read', 'org:projects:manage', 'org:field:manage', 'org:reports:read', 'org:costs:read', 'org:portfolio:read',
  ]],
  ['Jefe de obra', 'org:site_manager', 'Runs daily field execution and reporting.', [
    'org:projects:read', 'org:projects:manage', 'org:field:manage', 'org:reports:read',
  ]],
  ['Administración', 'org:finance', 'Manages costs, purchasing and financial reporting.', [
    'org:projects:read', 'org:reports:read', 'org:costs:read', 'org:costs:manage',
  ]],
  ['Auditor', 'org:auditor', 'Read-only access to projects, reports, costs and portfolio.', [
    'org:projects:read', 'org:reports:read', 'org:costs:read', 'org:portfolio:read',
  ]],
];

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
    throw new Error(`Clerk ${init.method || 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function create(path, payload) {
  if (!apply) return { id: `dry-run:${payload.key}`, key: payload.key, permissions: [] };
  return clerk(path, { method: 'POST', body: JSON.stringify(payload) });
}

const existingPermissions = await clerk('/organization_permissions?limit=500');
const permissionByKey = new Map(existingPermissions.data.map((item) => [item.key, item]));

for (const [name, key, description] of permissions) {
  if (permissionByKey.has(key)) continue;
  console.log(`${apply ? 'Creating' : 'Would create'} permission ${key}`);
  const created = await create('/organization_permissions', { name, key, description });
  permissionByKey.set(key, created);
}

const existingRoles = await clerk('/organization_roles?limit=500');
const roleByKey = new Map(existingRoles.data.map((item) => [item.key, item]));

for (const [name, key, description, permissionKeys] of roles) {
  let role = roleByKey.get(key);
  if (!role) {
    console.log(`${apply ? 'Creating' : 'Would create'} role ${key}`);
    role = await create('/organization_roles', { name, key, description });
    roleByKey.set(key, role);
  }

  const attached = new Set((role.permissions || []).map((permission) => permission.key));
  for (const permissionKey of permissionKeys) {
    if (attached.has(permissionKey)) continue;
    const permission = permissionByKey.get(permissionKey);
    console.log(`${apply ? 'Assigning' : 'Would assign'} ${permissionKey} to ${key}`);
    if (apply) {
      await clerk(`/organization_roles/${role.id}/permissions/${permission.id}`, { method: 'POST' });
    }
  }
}

console.log(apply ? 'Clerk RBAC is synchronized.' : 'Dry run complete. Re-run with --apply to mutate Clerk.');

