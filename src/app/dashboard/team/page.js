import Link from 'next/link';

import TeamClient from './team-client';
import styles from './team.module.css';
import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { TENANT_ROLES } from '@/lib/tenant-roles';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'tenant:members:read');
  const memberships = await getPrisma().tenantMembership.findMany({
    where: { organizationId: access.organization.id },
    include: { user: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/dashboard" className={styles.back}>← Volver al dashboard</Link>
          <p className={styles.eyebrow}>Gobierno del tenant</p>
          <h1>Equipo y permisos</h1>
          <p>
            {access.organization.name} · cada persona accede solo a lo que su función necesita.
          </p>
        </div>
        <div className={styles.identity}>
          <span>{access.email}</span>
          <strong>{access.isSuperadmin ? 'Superadmin' : TENANT_ROLES[access.tenantRole]?.label}</strong>
        </div>
      </header>

      <section className={styles.roleGrid} aria-label="Matriz de roles">
        {Object.values(TENANT_ROLES).map((role) => (
          <article key={role.key}>
            <span>{role.label}</span>
            <p>{role.description}</p>
          </article>
        ))}
      </section>

      <TeamClient
        canManage={hasTenantPermission(access, 'tenant:members:manage')}
        initialMemberships={memberships.map((membership) => ({
          id: membership.id,
          clerkRole: membership.clerkRole,
          tenantRole: membership.tenantRole,
          status: membership.status,
          user: {
            name: membership.user.fullName,
            email: membership.user.primaryEmail,
            avatarUrl: membership.user.avatarUrl,
          },
        }))}
        roles={Object.values(TENANT_ROLES)}
      />
    </main>
  );
}
