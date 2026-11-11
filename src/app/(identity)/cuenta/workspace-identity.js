'use client';
import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import {useAuth,useClerk,useOrganization,useUser,OrganizationSwitcher} from '@clerk/nextjs';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {identityAccountReturnPath,identitySignInPath,identityWorkspaceProjectHint,identityWorkspacePlanHint} from '../../../lib/identity-return-path.mjs';
import {AccountWorkspace} from './workspace-client';
import {CompanyBootstrapPanel} from './company-bootstrap-panel';
import {ParticipantSelfServicePanel} from './participant-panel';
import {OfficeJoinPanel} from './office-review-panel';
import {OnboardingGuide} from './onboarding-guide';
import styles from './workspace.module.css';
import identityStyles from '../identity.module.css';
import {IdentityLoadingNotice} from '../identity-load-guard';
export function WorkspaceIdentityPanel(){
 const params=useSearchParams(),returnPath=identityAccountReturnPath(params),initialProjectId=identityWorkspaceProjectHint(params),initialPlanId=identityWorkspacePlanHint(params);
 const invitationPending=['participar','oficina','__clerk_ticket','__clerk_status'].some(name=>params.has(name));
 const mayEnterFirstProject=!initialProjectId&&!invitationPending;
 const {isLoaded,isSignedIn,userId,sessionId,orgId,orgRole,getToken}=useAuth();
 const {organization}=useOrganization();
 const clerk=useClerk(),{isLoaded:userLoaded,user}=useUser();
 const openOrganizationCreator=useCallback(()=>clerk.openCreateOrganization({afterCreateOrganizationUrl:returnPath,skipInvitationScreen:true}),[clerk,returnPath]);
 const canOpenCreator=isLoaded&&isSignedIn&&!orgId&&mayEnterFirstProject&&clerk.loaded&&userLoaded&&user?.id===userId&&user?.createOrganizationEnabled===true;
 const sessionToken=useCallback(()=>getToken({skipCache:true}),[getToken]);
 const profileToken=useCallback(()=>getToken({template:'obrasaas-bootstrap-v1',skipCache:true}),[getToken]);
 const contextKey=JSON.stringify([isLoaded,isSignedIn,userId,orgId,sessionId,orgRole]);
 return <WorkspaceIdentityContext key={contextKey} contextKey={contextKey} returnPath={returnPath} signInPath={identitySignInPath(params)} initialProjectId={initialProjectId} initialPlanId={initialPlanId} mayEnterFirstProject={mayEnterFirstProject} invitationPending={invitationPending} openOrganizationCreator={canOpenCreator?openOrganizationCreator:null} isLoaded={isLoaded} isSignedIn={isSignedIn} userId={userId} sessionId={sessionId} orgId={orgId} orgRole={orgRole} organization={organization} sessionToken={sessionToken} profileToken={profileToken}/>;
}
// A separate instance owns each context: an older callback cannot unlock a new
// draft, including when the user returns to the same organization and session.
function WorkspaceIdentityContext({contextKey,returnPath,signInPath,initialProjectId,initialPlanId,mayEnterFirstProject,invitationPending,openOrganizationCreator,isLoaded,isSignedIn,userId,sessionId,orgId,orgRole,organization,sessionToken,profileToken}){
 const currentContext=useRef(contextKey),[guideObservation,setGuideObservation]=useState(null),[companyContext,setCompanyContext]=useState(null),[pendingSources,setPendingSources]=useState({workspace:false,bootstrap:false});
 const [firstProjectRequest,setFirstProjectRequest]=useState(null);
 useLayoutEffect(()=>{currentContext.current=contextKey;return()=>{currentContext.current=null;};},[contextKey]);
 const observePending=useCallback(value=>{if(currentContext.current===contextKey&&typeof value==='boolean')setPendingSources(previous=>previous.workspace===value?previous:{...previous,workspace:value});},[contextKey]);
 const observeBootstrapPending=useCallback(value=>{if(currentContext.current===contextKey&&typeof value==='boolean')setPendingSources(previous=>previous.bootstrap===value?previous:{...previous,bootstrap:value});},[contextKey]);
 const workspacePending=pendingSources.workspace||pendingSources.bootstrap;
 const currentCreator=useRef(null);
 useLayoutEffect(()=>{
  currentCreator.current=workspacePending?null:openOrganizationCreator;
  return()=>{currentCreator.current=null;};
 },[workspacePending,openOrganizationCreator]);
 function startCompanyCreation(){
  if(currentContext.current!==contextKey||!openOrganizationCreator||currentCreator.current!==openOrganizationCreator)return;
  openOrganizationCreator();
 }
 const enterFirstProject=useCallback(projectId=>{
  if(currentContext.current!==contextKey||workspacePending||!mayEnterFirstProject)return false;
  setFirstProjectRequest({projectId});return true;
 },[contextKey,workspacePending,mayEnterFirstProject]);
 const observeGuide=useCallback(value=>{if(currentContext.current===contextKey)setGuideObservation({contextKey,value});},[contextKey]);
 const observeCompany=useCallback(value=>{
  if(currentContext.current!==contextKey)return;
  const current=value&&typeof value.name==='string'&&value.name.trim()&&typeof value.scope==='string'&&/^[a-f0-9]{64}$/.test(value.scope)&&Number.isSafeInteger(value.generation)&&value.generation>0?value:null;
  setCompanyContext(previous=>previous?.contextKey===contextKey&&previous.value?.name===current?.name&&previous.value?.scope===current?.scope&&previous.value?.generation===current?.generation?previous:{contextKey,value:current});
 },[contextKey]);
 if(!isLoaded)return <IdentityLoadingNotice/>;
 if(!isSignedIn)return <section role="alert"><p>La sesión terminó. Volvé a ingresar antes de consultar una obra.</p><Link href={signInPath} className={identityStyles.home}>Volver a ingresar</Link></section>;
 return <>
  <details className={styles.startGuide} open={!orgId?true:undefined}><summary>Guía de inicio<span>Empresa, equipo y WhatsApp</span></summary><OnboardingGuide key={`guide:${contextKey}`} orgId={orgId} orgRole={orgRole} observation={guideObservation?.contextKey===contextKey?guideObservation.value:null}/></details>
  <ParticipantSelfServicePanel key={`join:${userId}:${orgId||'personal'}:${sessionId}:${orgRole||'personal'}:${returnPath}`} getSessionToken={sessionToken}/>
  <OfficeJoinPanel key={`office:${contextKey}:${returnPath}`} getSessionToken={sessionToken}/>
  <div id="organization-context" tabIndex={-1} className={styles.organizationBar}><div><span>{companyContext?.contextKey===contextKey&&companyContext.value?'Empresa activa':'Espacio de trabajo'}</span>{companyContext?.contextKey===contextKey&&companyContext.value?<strong data-workspace-company-name>{companyContext.value.name}</strong>:<strong>{organization&&organization.id===orgId?organization.name:'Elegí el espacio de tu empresa'}</strong>}</div>{workspacePending?<p id="organization-context-lock" role="status">Completá la acción pendiente antes de cambiar de empresa.</p>:<OrganizationSwitcher afterSelectOrganizationUrl={returnPath} afterSelectPersonalUrl={returnPath} afterLeaveOrganizationUrl={returnPath} afterCreateOrganizationUrl={returnPath}/>}</div>
  {!orgId?<section className={`${styles.workspace} ${styles.startState}`}><h2>Elegí o creá el espacio de tu empresa</h2>{invitationPending?<p>Si recibiste una invitación, completala para ingresar al espacio de esa empresa.</p>:<p>Este espacio reúne a tu equipo. Después completás los datos de la empresa y su primera obra.</p>}{openOrganizationCreator&&<div className={styles.actions}><button type="button" className={styles.primary} disabled={workspacePending} onClick={startCompanyCreation}>Crear empresa</button></div>}</section>:
   orgRole==='org:admin'?<CompanyBootstrapPanel key={contextKey} organizationId={orgId} organizationName={organization?.id===orgId?organization.name:''} getSessionToken={sessionToken} getProfileToken={profileToken} onPending={observeBootstrapPending} onEnterFirstProject={mayEnterFirstProject?enterFirstProject:undefined} firstProjectNavigationBlocked={workspacePending}><AccountWorkspace key={contextKey} getSessionToken={sessionToken} onGuideObservation={observeGuide} onCompanyContext={observeCompany} onContextPending={observePending} initialProjectId={initialProjectId} initialPlanId={initialPlanId} firstProjectRequest={mayEnterFirstProject?firstProjectRequest:null}/></CompanyBootstrapPanel>:
   <AccountWorkspace key={contextKey} getSessionToken={sessionToken} onGuideObservation={observeGuide} onCompanyContext={observeCompany} onContextPending={observePending} initialProjectId={initialProjectId} initialPlanId={initialPlanId}/>}
 </>;
}
