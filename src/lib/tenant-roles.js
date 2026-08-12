export const TENANT_ROLES = {
  ADMIN: {
    key: 'ADMIN',
    label: 'Administrador',
    description: 'Configura la organización, las personas, la facturación y todas las obras.',
  },
  DIRECTOR: {
    key: 'DIRECTOR',
    label: 'Director de obra',
    description: 'Dirige proyectos, costos, reportes, portfolio e integraciones operativas.',
  },
  SITE_MANAGER: {
    key: 'SITE_MANAGER',
    label: 'Jefe de obra',
    description: 'Gestiona ejecución, cuadrillas, tareas y el registro estructurado de incidencias de campo.',
  },
  FINANCE: {
    key: 'FINANCE',
    label: 'Administración',
    description: 'Consulta proyectos y administra costos, documentación y reportes.',
  },
  AUDITOR: {
    key: 'AUDITOR',
    label: 'Auditor',
    description: 'Acceso de solo lectura a proyectos, costos y reportes trazables.',
  },
};

const ROLE_PERMISSIONS = {
  ADMIN: ['*'],
  DIRECTOR: [
    'org:projects:read',
    'org:projects:manage',
    'org:operational-proposals:read',
    'org:operational-proposals:manage',
    'org:conversations:read',
    'org:conversations:manage',
    'org:field:manage',
    'org:field:evidence:read',
    'org:workers:onboarding:read',
    'org:workers:onboarding:manage',
    'org:workers:identity:read',
    'org:workers:identity:verify',
    'org:payroll:destinations:read',
    'org:payroll:destinations:activate',
    'org:medical:evidence:read',
    'org:attendance:read',
    'org:attendance:schedules:manage',
    'org:attendance:exceptions:manage',
    'org:attendance:corrections:request',
    'org:attendance:corrections:approve',
    'org:attendance:alerts:acknowledge',
    'org:tasks:read',
    'org:tasks:manage',
    'org:execution:read',
    'org:execution:manage',
    'org:measurements:read',
    'org:measurements:prepare',
    'org:measurements:approve',
    'org:measurement-cuts:read',
    'org:measurement-cuts:seal',
    'org:contracts:read',
    'org:contracts:prepare',
    'org:contracts:authorities:manage',
    'org:inventory:read',
    'org:inventory:manage',
    'org:reports:read',
    'org:costs:read',
    'org:costs:manage',
    'org:integrations:manage',
    'org:portfolio:read',
    'tenant:members:read',
  ],
  SITE_MANAGER: [
    'org:projects:read',
    'org:projects:manage',
    'org:operational-proposals:read',
    'org:operational-proposals:manage',
    'org:conversations:read',
    'org:conversations:manage',
    'org:field:manage',
    'org:workers:onboarding:read',
    'org:workers:onboarding:manage',
    'org:workers:identity:read',
    'org:attendance:read',
    'org:attendance:schedules:manage',
    'org:attendance:exceptions:manage',
    'org:attendance:corrections:request',
    'org:attendance:alerts:acknowledge',
    'org:tasks:read',
    'org:tasks:manage',
    'org:execution:read',
    'org:execution:manage',
    'org:measurements:read',
    'org:measurements:prepare',
    'org:measurement-cuts:read',
    'org:inventory:read',
    'org:inventory:manage',
    'org:reports:read',
    'org:costs:read',
    'tenant:members:read',
  ],
  FINANCE: [
    'org:projects:read',
    'org:operational-proposals:read',
    'org:workers:identity:read',
    'org:payroll:destinations:read',
    'org:payroll:destinations:manage',
    'org:attendance:read',
    'org:tasks:read',
    'org:execution:read',
    'org:measurements:read',
    'org:measurement-cuts:read',
    'org:contracts:read',
    'org:contracts:approve',
    'org:inventory:read',
    'org:reports:read',
    'org:costs:read',
    'org:costs:manage',
    'tenant:members:read',
  ],
  AUDITOR: [
    'org:projects:read',
    'org:operational-proposals:read',
    'org:attendance:read',
    'org:tasks:read',
    'org:execution:read',
    'org:measurements:read',
    'org:measurement-cuts:read',
    'org:contracts:read',
    'org:inventory:read',
    'org:reports:read',
    'org:costs:read',
  ],
};

const CLERK_ROLE_TO_TENANT_ROLE = {
  'org:admin': 'ADMIN',
  'org:director': 'DIRECTOR',
  'org:site_manager': 'SITE_MANAGER',
  'org:finance': 'FINANCE',
  'org:auditor': 'AUDITOR',
};

export function isTenantRole(role) {
  return Boolean(role && TENANT_ROLES[role]);
}

export function roleHasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

export function roleForClerkMembership(clerkRole, currentRole = null) {
  const mappedRole = CLERK_ROLE_TO_TENANT_ROLE[clerkRole];
  if (mappedRole) return mappedRole;
  if (currentRole === 'ADMIN' || !isTenantRole(currentRole)) return 'AUDITOR';
  return currentRole;
}
