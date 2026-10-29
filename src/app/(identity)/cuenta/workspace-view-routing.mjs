// Navigation is presentation only. Server capabilities remain the authority.
const destinations = {
 'workspace-home-title': ['inicio', 'Resumen'],
 'schedule-title': ['cronograma', 'Cronograma'],
 'plan-import-title': ['cronograma', 'Importar cronograma'],
 'plan-measurement-title': ['cronograma', 'Metrados por revisar'],
 'schedule-edit-title': ['cronograma', 'Planificar tarea'],
 'field-title': ['actividad', 'Jornada y avances'],
 'inventory-title': ['materiales', 'Materiales'],
 'participant-title': ['identidad', 'Equipo e identidad'],
 'worker-channel-title': ['mi-whatsapp', 'Mi WhatsApp'],
 'project-preparation-title': ['preparacion', 'Preparación de obra'],
 'project-creation-title': ['nueva-obra', 'Nueva obra'],
 'site-register-title': ['registros', 'Registros de obra'],
 'purchase-title': ['compras', 'Compras'],
 'own-company-number-title': ['numero', 'Número de la empresa'],
 'own-company-templates-title': ['plantillas', 'Plantillas'],
 'company-channel-title': ['canal', 'Canal de la empresa'],
 'customer-whatsapp-title': ['configurar-whatsapp', 'Configurar WhatsApp'],
 'customer-meta-title': ['conexion', 'Conexión de WhatsApp'],
 'customer-inbox-title': ['bandeja', 'Bandeja de mensajes'],
 'template-send-title': ['recordatorios', 'Recordatorios'],
 'constructor-crm-title': ['clientes', 'Clientes'],
 'demo-pilot-title': ['piloto', 'Pruebas del canal'],
 'operation-status-title': ['actividad-administrativa', 'Actividad administrativa'],
 'office-review-admin-title': ['accesos', 'Accesos de consulta'],
 'company-subscription-title': ['plan', 'Plan y facturación'],
 'workspace-recovery-title': ['recuperacion', 'Operaciones pendientes'],
};
const sections = new Set(Object.values(destinations).map(([section]) => section));
export function workspaceLocationView(location = '') {
 let url;
 try { url = new URL(location, 'https://obrasaas.com/cuenta'); } catch { return {section:'inicio', target:'workspace-home-title'}; }
 const fragment = url.hash.slice(1);
 if (Object.hasOwn(destinations, fragment)) return {section:destinations[fragment][0], target:fragment};
 const section = url.searchParams.get('seccion');
 if (sections.has(section)) return {section, target:Object.keys(destinations).find(key => destinations[key][0] === section)};
 return {section:'inicio', target:'workspace-home-title'};
}
export function workspaceDestination(id) {
 return Object.hasOwn(destinations,id) ? {section:destinations[id][0],label:destinations[id][1]} : null;
}
// A request for the identity section that arrives before any authorized obra
// is open names only the pending destination. It never chooses, remembers or
// trusts an obra: the person opens one from the existing selector.
export function workspacePendingProjectSection(requested, {projectAvailable=false,privatePresentationAvailable=false,officeReviewOnly=false,projectCount=0,loading=false} = {}) {
 return requested==='identidad'&&projectAvailable===false&&privatePresentationAvailable===false&&officeReviewOnly!==true&&loading===false&&Number.isSafeInteger(projectCount)&&projectCount>0?'identidad':null;
}
export function workspaceViewAllowed(section, {role,canManageIntegrations=false,projectAvailable=true,privatePresentationAvailable=false} = {}) {
 // This is presentation-only self-service, supplied by the validated private selection.
 if(projectAvailable===false&&privatePresentationAvailable===true&&['identidad','mi-whatsapp'].includes(section))return true;
 if(projectAvailable===false&&!['inicio','plan','recuperacion'].includes(section))return false;
 if (['inicio','cronograma','actividad','materiales','identidad','mi-whatsapp','recuperacion'].includes(section)) return true;
 if (section==='preparacion') return ['ADMIN','DIRECTOR'].includes(role);
 if (['nueva-obra','numero','plantillas','clientes','piloto','accesos','plan'].includes(section)) return role==='ADMIN';
 if (section==='canal') return role==='ADMIN'||canManageIntegrations===true;
 return ['registros','compras','configurar-whatsapp','conexion','bandeja','recordatorios','actividad-administrativa'].includes(section)&&canManageIntegrations===true;
}
