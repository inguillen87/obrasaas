'use client';
import {useCallback} from 'react';
import {useAuth,useOrganization,OrganizationSwitcher} from '@clerk/nextjs';
import {AccountWorkspace} from './workspace-client';
import {CompanyBootstrapPanel} from './company-bootstrap-panel';
import styles from './workspace.module.css';
export function WorkspaceIdentityPanel(){
 const {isLoaded,isSignedIn,userId,orgId,orgRole,getToken}=useAuth();
 const {organization}=useOrganization();
 const sessionToken=useCallback(()=>getToken({skipCache:true}),[getToken]);
 const profileToken=useCallback(()=>getToken({template:'obrasaas-bootstrap-v1',skipCache:true}),[getToken]);
 if(!isLoaded)return <p role="status">Verificando el contexto de tu cuenta…</p>;
 if(!isSignedIn)return <p role="alert">La sesión terminó. Volvé a ingresar antes de consultar una obra.</p>;
 return <>
  <div className={styles.context}><span>Organización activa</span><OrganizationSwitcher afterSelectOrganizationUrl="/cuenta" afterSelectPersonalUrl="/cuenta" afterLeaveOrganizationUrl="/cuenta" afterCreateOrganizationUrl="/cuenta"/></div>
  {!orgId?<section><h2>Seleccioná o creá tu organización</h2><p>Usá el selector de organización para crear la identidad de tu constructora en Clerk. Después se habilitará el alta de empresa y primera obra, sin importar datos ajenos.</p></section>:
   orgRole==='org:admin'?<CompanyBootstrapPanel key={`${userId}:${orgId || 'personal'}`} organizationId={orgId} organizationName={organization?.id===orgId?organization.name:''} getSessionToken={sessionToken} getProfileToken={profileToken}><AccountWorkspace key={`${userId}:${orgId || 'personal'}`}/></CompanyBootstrapPanel>:
   <AccountWorkspace key={`${userId}:${orgId || 'personal'}`}/>}
 </>;
}
