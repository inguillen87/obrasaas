'use client';
import styles from './workspace-tools-navigation.module.css';

const tool=(id,label)=>({id,label});
const destinations={
 schedule:tool('schedule-title','Tareas y cronograma'),
 register:tool('site-register-title','Incidencias y materiales'),
 field:tool('field-title','Jornada, evidencia y avance'),
 participants:tool('participant-title','Participantes y permisos'),
 channel:tool('worker-channel-title','Mi número y autorización de avisos'),
 purchase:tool('purchase-title','Compras'),
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

function ToolLink({destination}){
 return <a href={'#'+destination.id} onClick={event=>focusDestination(event,destination.id)}>{destination.label}</a>;
}

export function WorkspaceToolsNavigation({canManageIntegrations=false,role,pending={},schedulePending=false,scheduleEditing=false}){
 // Visibility follows the same canonical account capabilities as the mounted panels.
 // These links neither grant permissions nor hide/unmount a form.
 const groups=[
  {id:'work',label:'Trabajo en obra',tools:[destinations.schedule,destinations.field,...(canManageIntegrations?[destinations.register,destinations.purchase]:[])]},
  {id:'people',label:'Equipo y acceso',tools:[...(canManageIntegrations?[tool('site-register-title','Fichas del equipo')]:[]),destinations.participants,destinations.channel]},
  ...(canManageIntegrations?[{id:'whatsapp',label:'WhatsApp de la empresa',tools:[destinations.preparation,destinations.meta,destinations.inbox,destinations.template]}]:[]),
  ...((role==='ADMIN'||canManageIntegrations)?[{id:'management',label:'Administración y seguimiento',tools:[...(role==='ADMIN'?[destinations.crm,destinations.demo]:[]),...(canManageIntegrations?[tool('operation-status-title','Pendientes y actividad')]:[])]}]:[]),
 ];
 const visible=new Set(groups.flatMap(group=>group.tools.map(item=>item.id)));
 const outstanding=[...(schedulePending?[scheduleEditing?tool('schedule-edit-title','Planificación pendiente'):destinations.schedule]:[]),...Object.entries(pending).filter(([,value])=>value===true).map(([key])=>destinations[key]).filter(item=>item&&visible.has(item.id))];
 return <nav className={styles.navigation} aria-labelledby="workspace-tools-title">
  <div className={styles.heading}><h3 id="workspace-tools-title">Herramientas de esta obra</h3><ToolLink destination={tool('onboarding-guide-title','Volver a la guía')}/></div>
  <p className={styles.intro}>Elegí una sección para ir al trabajo que necesitás hacer.</p>
  <div className={styles.groups}>{groups.map(group=><details className={styles.group} key={group.id} open={group.id==='work'}><summary>{group.label}<small>{group.tools.length} herramientas</small></summary><div className={styles.links}>{group.tools.map(item=><ToolLink key={item.id} destination={item}/>)}</div></details>)}</div>
  {outstanding.length>0&&<div className={styles.pending} role="status" aria-live="polite"><p>Antes de actualizar la lista o cambiar de obra, completá la acción o comprobá el resultado en:</p><div className={styles.links}>{outstanding.map(item=><ToolLink key={item.id} destination={item}/>)}</div></div>}
 </nav>;
}
