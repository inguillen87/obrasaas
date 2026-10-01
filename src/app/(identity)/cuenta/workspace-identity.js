'use client';
import { useAuth, OrganizationSwitcher } from '@clerk/nextjs';
import { AccountWorkspace } from './workspace-client';
import styles from './workspace.module.css';
export function WorkspaceIdentityPanel() {
  const { isLoaded, isSignedIn, userId, orgId } = useAuth();
  if (!isLoaded) return <p role="status">Verificando el contexto de tu cuenta…</p>;
  if (!isSignedIn) return <p role="alert">La sesión terminó. Volvé a ingresar antes de consultar una obra.</p>;
  return <>
    <div className={styles.context}><span>Organización activa</span><OrganizationSwitcher afterSelectOrganizationUrl="/cuenta" afterSelectPersonalUrl="/cuenta" afterLeaveOrganizationUrl="/cuenta" afterCreateOrganizationUrl="/cuenta" /></div>
    <AccountWorkspace key={`${userId}:${orgId || 'personal'}`} />
  </>;
}
