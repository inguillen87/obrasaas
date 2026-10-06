import {constructorCrmRecord} from '../(identity)/cuenta/constructor-crm-view.mjs';

// Presentation-only adaptation of the existing Palermo sample. Never import
// defaultState: its legacy fixture also contains phone numbers and identity data.
export const DEMO_COMPANY=Object.freeze({name:'Constructora Palermo',project:'Torre Palermo Soho',location:'Palermo · Buenos Aires',period:'Agosto 2026'});
export const DEMO_TASKS=Object.freeze([
 {id:'sample-revoque',title:'Revoque grueso',status:'IN_PROGRESS',progress:80,startsOn:'2026-08-01',endsOn:'2026-08-06'},
 {id:'sample-caneria',title:'Cañería y descargas',status:'IN_PROGRESS',progress:20,startsOn:'2026-08-07',endsOn:'2026-08-11'},
 {id:'sample-revestimiento',title:'Revestimiento cerámico',status:'BLOCKED',progress:0,startsOn:'2026-08-16',endsOn:'2026-08-20'},
 {id:'sample-pintura',title:'Pintura y terminación',status:'BACKLOG',progress:0,startsOn:'2026-08-21',endsOn:'2026-08-23'},
].map(Object.freeze));
export const DEMO_MATERIALS=Object.freeze([
 {id:'cemento',name:'Cemento',quantity:'35',unit:'bolsas',sector:'Planta baja',state:'Pedido en revisión',detail:'La cuadrilla solicita material para el revoque. El responsable revisa cantidad, proveedor y costo antes de autorizar una compra.'},
 {id:'arena',name:'Arena fina',quantity:'4',unit:'m³',sector:'Planta baja',state:'Entrega parcial',detail:'El pedido contempla 8 m³. Esta ficha de ejemplo muestra 4 m³ recibidos y 4 m³ pendientes.'},
 {id:'ceramicas',name:'Revestimiento cerámico',quantity:'120',unit:'m²',sector:'Primer piso',state:'Entrega pendiente',detail:'La entrega pendiente afecta la tarea Revestimiento cerámico. Confirmar una entrega y aprobar un cambio de planificación son decisiones separadas.'},
].map(Object.freeze));
export const DEMO_INCIDENTS=Object.freeze([
 {id:'descarga',title:'Revisar descarga sanitaria',sector:'Primer piso',priority:'Alta',state:'En seguimiento',detail:'El equipo informa una fisura antes de cerrar el sector. El encargado debe revisar la evidencia y registrar el resultado.'},
 {id:'material',title:'Entrega de cerámicas demorada',sector:'Primer piso',priority:'Media',state:'Pendiente',detail:'Compras consulta al proveedor. Cualquier cambio de fechas conserva un motivo y requiere permiso de planificación.'},
].map(Object.freeze));
export const DEMO_OPPORTUNITIES=Object.freeze([
 {id:'sample-client-1',revision:1,name:'Vivienda colectiva · ejemplo',contactName:null,email:null,phone:null,notes:'Preparar presupuesto de obra y confirmar el alcance de la propuesta.',stage:'PROPOSAL',segment:'CONSTRUCTION',source:'REFERRAL',nextFollowUpOn:'2026-08-14'},
 {id:'sample-client-2',revision:1,name:'Reforma comercial · ejemplo',contactName:null,email:null,phone:null,notes:'Revisar planos y coordinar la presentación del presupuesto.',stage:'QUALIFIED',segment:'ARCHITECTURE',source:'ORGANIC',nextFollowUpOn:'2026-08-18'},
 {id:'sample-client-3',revision:1,name:'Ampliación residencial · ejemplo',contactName:null,email:null,phone:null,notes:'Primera consulta recibida. Falta confirmar superficie y plazos.',stage:'NEW',segment:'CONSTRUCTION',source:'ORGANIC',nextFollowUpOn:null},
].map(value=>Object.freeze(constructorCrmRecord(value))));
