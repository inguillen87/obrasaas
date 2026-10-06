'use client';
import {useSyncExternalStore} from 'react';
import {HardHat,UsersRound,MessageCircle,BriefcaseBusiness,ArrowUpRight,ArrowUp,Clock3} from 'lucide-react';
import styles from './workspace-tools-navigation.module.css';

const tool=(id,label)=>({id,label});
const destinations={
 schedule:tool('schedule-title','Tareas y cronograma'),
 plan:tool('plan-import-title','Importación de cronograma'),
 register:tool('site-register-title','Incidencias y materiales'),
 field:tool('field-title','Jornada, evidencia y avance'),
 participants:tool('participant-title','Participantes y permisos'),
 channel:tool('worker-channel-title','Mi número y autorización de avisos'),
 companyChannel:tool('company-channel-title','Canal y obras de la empresa'),
 purchase:tool('purchase-title','Compras'),
 inventory:tool('inventory-title','Inventario y consumo'),
 preparation:tool('customer-whatsapp-title','Preparar WhatsApp de la empresa'),
 meta:tool('customer-meta-title','Conexión y plantillas'),
 inbox:tool('customer-inbox-title','Bandeja y seguimiento'),
 template:tool('template-send-title','Enviar recordatorio de jornada'),
 crm:tool('constructor-crm-title','Clientes y oportunidades'),
 demo:tool('demo-pilot-title','Piloto con el número demo'),
};

function focusDestination(event,id){
 if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
 const element=document.getElementById(id);
 if(!element?.getClientRects().length)return;
 if(!element.hasAttribute('tabindex')){
  element.setAttribute('tabindex','-1');
  element.addEventListener('blur',()=>element.removeAttribute('tabindex'),{once:true});
 }
 element.focus({preventScroll:true});
 // The ordinary fragment link remains responsible for scrolling and history.
}

function subscribeFragment(callback){window.addEventListener('hashchange',callback);return()=>window.removeEventListener('hashchange',callback);}
const currentFragment=()=>window.location.hash.slice(1),serverFragment=()=>'';
function ToolLink({destination,active}){
 return <a href={'#'+destination.id} aria-current={active===destination.id?'location':undefined} onClick={event=>focusDestination(event,destination.id)}><span>{destination.label}</span><ArrowUpRight size={14} aria-hidden="true"/></a>;
}

export function WorkspaceToolsNavigation({canManageIntegrations=false,canImportPlan=false,role,pending={},schedulePending=false,scheduleEditing=false}){
 const active=useSyncExternalStore(subscribeFragment,currentFragment,serverFragment);
 // Visibility follows the same canonical account capabilities as the mounted panels.
 // These links neither grant permissions nor hide/unmount a form.
 const groups=[
  {id:'work',label:'Trabajo en obra',icon:HardHat,tools:[destinations.schedule,destinations.field,destinations.inventory,...(canManageIntegrations?[destinations.register,destinations.purchase]:[])]},
  {id:'people',label:'Equipo y acceso',icon:UsersRound,tools:[...(canManageIntegrations?[tool('site-register-title','Fichas del equipo')]:[]),destinations.participants,destinations.channel]},
  ...((role==='ADMIN'||canManageIntegrations)?[{id:'whatsapp',label:'WhatsApp de la empresa',icon:MessageCircle,tools:[destinations.companyChannel,...(canManageIntegrations?[destinations.preparation,destinations.meta,destinations.inbox,destinations.template]:[])]}]:[]),
  ...((role==='ADMIN'||canManageIntegrations)?[{id:'management',label:'Administración y seguimiento',icon:BriefcaseBusiness,tools:[...(role==='ADMIN'?[destinations.crm,destinations.demo]:[]),...(canManageIntegrations?[tool('operation-status-title','Pendientes y actividad')]:[])]}]:[]),
 ];
 const visible=new Set(groups.flatMap(group=>group.tools.map(item=>item.id)));
 // An open import is an outstanding action inside the schedule panel.
 if(canImportPlan)visible.add(destinations.plan.id);
 const outstanding=[...(schedulePending?[scheduleEditing?tool('schedule-edit-title','Planificación pendiente'):destinations.schedule]:[]),...Object.entries(pending).filter(([,value])=>value===true).map(([key])=>destinations[key]).filter(item=>item&&visible.has(item.id))];
 return <nav className={styles.navigation} aria-labelledby="workspace-tools-title">
  <div className={styles.heading}><p className={styles.eyebrow}>NAVEGACIÓN</p><h3 id="workspace-tools-title">Herramientas de esta obra</h3><p className={styles.intro}>Todo el trabajo, en el mismo contexto.</p></div>
  <div className={styles.groups}>{groups.map(group=>{const Icon=group.icon;return <details className={styles.group} key={group.id} open={group.id==='work'}><summary><Icon size={17} aria-hidden="true"/><span>{group.label}<small>{group.tools.length} herramientas</small></span></summary><div className={styles.links}>{group.tools.map(item=><ToolLink key={item.id} destination={item} active={active}/>)}</div></details>;})}</div>
  {outstanding.length>0&&<div className={styles.pending} role="status" aria-live="polite"><strong><Clock3 size={16} aria-hidden="true"/>Acciones en curso</strong><p>Antes de actualizar la lista o cambiar de obra, completá la acción o comprobá el resultado en:</p><div className={styles.links}>{outstanding.map(item=><ToolLink key={item.id} destination={item} active={active}/>)}</div></div>}
  <a className={styles.guide} href="#onboarding-guide-title" onClick={event=>focusDestination(event,'onboarding-guide-title')}><ArrowUp size={15} aria-hidden="true"/><span>Volver a la guía</span></a>
 </nav>;
}
