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
    description: 'Gestiona ejecución, cuadrillas, tareas, evidencias e incidencias de campo.',
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
    'org:field:manage',
    'org:medical:evidence:read',
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
    'org:field:manage',
    'org:reports:read',
    'org:costs:read',
    'tenant:members:read',
  ],
  FINANCE: [
    'org:projects:read',
    'org:reports:read',
    'org:costs:read',
    'org:costs:manage',
    'tenant:members:read',
  ],
  AUDITOR: [
    'org:projects:read',
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
