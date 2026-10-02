'use client';
import {useCallback} from 'react';
import {useAuth,useOrganization,OrganizationSwitcher} from '@clerk/nextjs';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {identityAccountReturnPath,identitySignInPath} from '../../../lib/identity-return-path.mjs';
import {AccountWorkspace} from './workspace-client';
import {CompanyBootstrapPanel} from './company-bootstrap-panel';
import {ParticipantSelfServicePanel} from './participant-panel';
import {OnboardingGuide} from './onboarding-guide';
import styles from './workspace.module.css';
import identityStyles from '../identity.module.css';
import {IdentityLoadingNotice} from '../identity-load-guard';
export function WorkspaceIdentityPanel(){
 const params=useSearchParams(),returnPath=identityAccountReturnPath(params);
 const {isLoaded,isSignedIn,userId,sessionId,orgId,orgRole,getToken}=useAuth();
 const {organization}=useOrganization();
 const sessionToken=useCallback(()=>getToken({skipCache:true}),[getToken]);
 const profileToken=useCallback(()=>getToken({template:'obrasaas-bootstrap-v1',skipCache:true}),[getToken]);
 if(!isLoaded)return <IdentityLoadingNotice/>;
 if(!isSignedIn)return <section role="alert"><p>La sesión terminó. Volvé a ingresar antes de consultar una obra.</p><Link href={identitySignInPath(params)} className={identityStyles.home}>Volver a ingresar</Link></section>;
 return <>
  <OnboardingGuide key={`guide:${userId}:${orgId||'personal'}:${sessionId}:${orgRole||'personal'}`} orgId={orgId} orgRole={orgRole}/>
  <ParticipantSelfServicePanel key={`join:${userId}:${orgId||'personal'}:${sessionId}:${orgRole||'personal'}:${returnPath}`} getSessionToken={sessionToken}/>
  <div id="organization-context" tabIndex={-1} className={styles.context}><span>Organización activa</span><OrganizationSwitcher afterSelectOrganizationUrl={returnPath} afterSelectPersonalUrl={returnPath} afterLeaveOrganizationUrl={returnPath} afterCreateOrganizationUrl={returnPath}/><a href="#onboarding-guide-title" className={identityStyles.home}>Volver a la guía</a></div>
  {!orgId?<section><h2>Seleccioná o creá tu organización</h2><p>Usá el selector de organización para crear la identidad de tu constructora en Clerk. Después se habilitará el alta de empresa y primera obra, sin importar datos ajenos.</p></section>:
   orgRole==='org:admin'?<CompanyBootstrapPanel key={`${userId}:${orgId || 'personal'}:${sessionId}:${orgRole||'personal'}`} organizationId={orgId} organizationName={organization?.id===orgId?organization.name:''} getSessionToken={sessionToken} getProfileToken={profileToken}><AccountWorkspace key={`${userId}:${orgId || 'personal'}:${sessionId}:${orgRole||'personal'}`} getSessionToken={sessionToken}/></CompanyBootstrapPanel>:
   <AccountWorkspace key={`${userId}:${orgId || 'personal'}:${sessionId}:${orgRole||'personal'}`} getSessionToken={sessionToken}/>}
 </>;
}
