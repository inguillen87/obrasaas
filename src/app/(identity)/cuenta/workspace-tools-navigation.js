'use client';
import {House,CalendarDays,UsersRound,HardHat,Package,ShoppingBag,BriefcaseBusiness,MessageCircle,Settings2,Clock3,CreditCard} from 'lucide-react';
import {workspaceDestination,workspaceViewAllowed} from './workspace-view-routing.mjs';
import {revealWorkspaceDestination} from './workspace-screen';
import styles from './workspace-tools-navigation.module.css';
const main=[['workspace-home-title',House],['schedule-title',CalendarDays],['participant-title',UsersRound],['field-title',HardHat],['inventory-title',Package],['purchase-title',ShoppingBag],['constructor-crm-title',BriefcaseBusiness],['customer-inbox-title',MessageCircle]];
const settings=['project-preparation-title','project-creation-title','site-register-title','worker-channel-title','own-company-number-title','own-company-templates-title','company-channel-title','customer-whatsapp-title','customer-meta-title','template-send-title','operation-status-title','office-review-admin-title','workspace-recovery-title','demo-pilot-title'];
const pendingTargets={participants:'participant-title',field:'field-title',inventory:'inventory-title',purchase:'purchase-title',channel:'worker-channel-title',ownCompanyNumber:'own-company-number-title',ownCompanyTemplates:'own-company-templates-title',companyChannel:'company-channel-title',preparation:'customer-whatsapp-title',meta:'customer-meta-title',inbox:'customer-inbox-title',template:'template-send-title',crm:'constructor-crm-title',projectPreparation:'project-preparation-title',projectCreation:'project-creation-title',office:'office-review-admin-title',register:'site-register-title',demo:'demo-pilot-title',plan:'plan-import-title',planMeasurement:'plan-measurement-title',baseline:'schedule-title',measurement:'schedule-title'};
export function WorkspaceToolsNavigation({canManageIntegrations=false,canImportPlan=false,role,pending={},schedulePending=false,scheduleEditing=false,activeSection='inicio',projectAvailable=true}){
 const capabilities={role,canManageIntegrations,projectAvailable};
 const allowed=id=>{if(id==='plan-import-title'&&!canImportPlan||id==='plan-measurement-title'&&(!canImportPlan||!canManageIntegrations))return false;const destination=workspaceDestination(id);return destination&&workspaceViewAllowed(destination.section,capabilities);};
 const primary=main.filter(([id])=>allowed(id)),secondary=settings.filter(allowed);
 const outstanding=[...new Set([...(schedulePending?[scheduleEditing?'schedule-edit-title':'schedule-title']:[]),...Object.entries(pending).filter(([,value])=>value===true).map(([key])=>pendingTargets[key]).filter(id=>id&&allowed(id))])];
 const navigate=(event,id)=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();revealWorkspaceDestination(id);};
 const renderLink=(id,Icon)=>{const destination=workspaceDestination(id);return <a key={id} href={'#'+id} onClick={event=>navigate(event,id)} aria-current={activeSection===destination.section?'page':undefined}>{Icon&&<Icon size={18} aria-hidden="true"/>}<span>{destination.label}</span></a>;};
 const options=[...primary.map(([id])=>id),...secondary,...(role==='ADMIN'?['company-subscription-title']:[])];
 return <nav className={styles.navigation} aria-label="Navegación de la obra">
  <p className={styles.eyebrow}>TU ESPACIO DE TRABAJO</p>
  <label className={styles.mobilePicker}>Ir a la sección<select value={options.find(id=>workspaceDestination(id).section===activeSection)||'workspace-home-title'} onChange={event=>revealWorkspaceDestination(event.target.value)}>{options.map(id=><option key={id} value={id}>{workspaceDestination(id).label}</option>)}</select></label>
  <div className={styles.desktopLinks}>{primary.map(([id,Icon])=>renderLink(id,Icon))}
   {secondary.length>0&&<details className={styles.settings} open={secondary.some(id=>workspaceDestination(id).section===activeSection)||undefined}><summary><Settings2 size={18} aria-hidden="true"/>Configuración</summary><div className={styles.secondary}>{secondary.map(id=>renderLink(id))}</div></details>}
   {role==='ADMIN'&&<div className={styles.billing}>{renderLink('company-subscription-title',CreditCard)}</div>}
  </div>
  {outstanding.length>0&&<div className={styles.pending} role="status" aria-live="polite"><strong><Clock3 size={16} aria-hidden="true"/>Acciones en curso</strong><p>Tus borradores se conservan en estas secciones.</p>{outstanding.map(id=>renderLink(id))}</div>}
  <a className={styles.help} href="/manual" target="_blank" rel="noopener noreferrer">Centro de ayuda ↗</a>
 </nav>;
}
