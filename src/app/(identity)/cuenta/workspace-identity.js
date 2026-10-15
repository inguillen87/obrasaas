'use client';
import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import {useAuth,useOrganization,OrganizationSwitcher} from '@clerk/nextjs';
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
 const {isLoaded,isSignedIn,userId,sessionId,orgId,orgRole,getToken}=useAuth();
 const {organization}=useOrganization();
 const sessionToken=useCallback(()=>getToken({skipCache:true}),[getToken]);
 const profileToken=useCallback(()=>getToken({template:'obrasaas-bootstrap-v1',skipCache:true}),[getToken]);
 const contextKey=JSON.stringify([isLoaded,isSignedIn,userId,orgId,sessionId,orgRole]);
 return <WorkspaceIdentityContext key={contextKey} contextKey={contextKey} returnPath={returnPath} signInPath={identitySignInPath(params)} initialProjectId={initialProjectId} initialPlanId={initialPlanId} isLoaded={isLoaded} isSignedIn={isSignedIn} userId={userId} sessionId={sessionId} orgId={orgId} orgRole={orgRole} organization={organization} sessionToken={sessionToken} profileToken={profileToken}/>;
}
// A separate instance owns each context: an older callback cannot unlock a new
// draft, including when the user returns to the same organization and session.
function WorkspaceIdentityContext({contextKey,returnPath,signInPath,initialProjectId,initialPlanId,isLoaded,isSignedIn,userId,sessionId,orgId,orgRole,organization,sessionToken,profileToken}){
 const currentContext=useRef(contextKey),[guideObservation,setGuideObservation]=useState(null),[companyContext,setCompanyContext]=useState(null),[pendingSources,setPendingSources]=useState({workspace:false,bootstrap:false});
 useLayoutEffect(()=>{currentContext.current=contextKey;return()=>{currentContext.current=null;};},[contextKey]);
 const observePending=useCallback(value=>{if(currentContext.current===contextKey&&typeof value==='boolean')setPendingSources(previous=>previous.workspace===value?previous:{...previous,workspace:value});},[contextKey]);
 const observeBootstrapPending=useCallback(value=>{if(currentContext.current===contextKey&&typeof value==='boolean')setPendingSources(previous=>previous.bootstrap===value?previous:{...previous,bootstrap:value});},[contextKey]);
 const workspacePending=pendingSources.workspace||pendingSources.bootstrap;
 const observeGuide=useCallback(value=>{if(currentContext.current===contextKey)setGuideObservation({contextKey,value});},[contextKey]);
 const observeCompany=useCallback(value=>{
  if(currentContext.current!==contextKey)return;
  const current=value&&typeof value.name==='string'&&value.name.trim()&&typeof value.scope==='string'&&/^[a-f0-9]{64}$/.test(value.scope)&&Number.isSafeInteger(value.generation)&&value.generation>0?value:null;
  setCompanyContext(previous=>previous?.contextKey===contextKey&&previous.value?.name===current?.name&&previous.value?.scope===current?.scope&&previous.value?.generation===current?.generation?previous:{contextKey,value:current});
 },[contextKey]);
 if(!isLoaded)return <IdentityLoadingNotice/>;
 if(!isSignedIn)return <section role="alert"><p>La sesión terminó. Volvé a ingresar antes de consultar una obra.</p><Link href={signInPath} className={identityStyles.home}>Volver a ingresar</Link></section>;
 return <>
  <OnboardingGuide key={`guide:${contextKey}`} orgId={orgId} orgRole={orgRole} observation={guideObservation?.contextKey===contextKey?guideObservation.value:null}/>
  <ParticipantSelfServicePanel key={`join:${userId}:${orgId||'personal'}:${sessionId}:${orgRole||'personal'}:${returnPath}`} getSessionToken={sessionToken}/>
  <OfficeJoinPanel key={`office:${contextKey}:${returnPath}`} getSessionToken={sessionToken}/>
  <div id="organization-context" tabIndex={-1} className={styles.context}><div style={{minWidth:0,flex:1}}><span>Espacio de trabajo</span><p className={styles.caption} style={{margin:'0.35rem 0',overflowWrap:'anywhere'}}>Elegí tu espacio de trabajo. Su nombre puede ser distinto al de la empresa.</p>{companyContext?.contextKey===contextKey&&companyContext.value&&<div className={styles.company}><div><span>Empresa de trabajo</span><strong data-workspace-company-name>{companyContext.value.name}</strong></div></div>}</div>{workspacePending?<p id="organization-context-lock" role="status" style={{margin:0,maxWidth:320,fontSize:16,overflowWrap:'anywhere'}}>Para cambiar de espacio de trabajo, completá la acción pendiente, cancelá el borrador o comprobá su resultado.</p>:<OrganizationSwitcher afterSelectOrganizationUrl={returnPath} afterSelectPersonalUrl={returnPath} afterLeaveOrganizationUrl={returnPath} afterCreateOrganizationUrl={returnPath}/>}<a href="#onboarding-guide-title" className={identityStyles.home}>Volver a la guía</a></div>
  {!orgId?<section><h2>Seleccioná o creá tu organización</h2><p>Usá el selector para crear el espacio de tu constructora. Después podrás dar de alta la empresa y su primera obra.</p></section>:
   orgRole==='org:admin'?<CompanyBootstrapPanel key={contextKey} organizationId={orgId} organizationName={organization?.id===orgId?organization.name:''} getSessionToken={sessionToken} getProfileToken={profileToken} onPending={observeBootstrapPending}><AccountWorkspace key={contextKey} getSessionToken={sessionToken} onGuideObservation={observeGuide} onCompanyContext={observeCompany} onContextPending={observePending} initialProjectId={initialProjectId} initialPlanId={initialPlanId}/></CompanyBootstrapPanel>:
   <AccountWorkspace key={contextKey} getSessionToken={sessionToken} onGuideObservation={observeGuide} onCompanyContext={observeCompany} onContextPending={observePending} initialProjectId={initialProjectId} initialPlanId={initialPlanId}/>}
 </>;
}
