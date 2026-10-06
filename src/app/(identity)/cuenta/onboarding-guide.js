'use client';
import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import Link from 'next/link';
import styles from './onboarding-guide.module.css';

const targetIds = ['organization-context','company-bootstrap-heading','workspace-title','schedule-title','site-register-title','participant-title','field-title','customer-whatsapp-title','worker-channel-title','constructor-crm-title'];
function subscribeTargets(callback) {
 const observer = new MutationObserver(callback);
 observer.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['hidden','style','aria-hidden']});
 window.addEventListener('resize', callback);
 return () => { observer.disconnect(); window.removeEventListener('resize', callback); };
}
const readTargets = () => targetIds.filter(id => document.getElementById(id)?.getClientRects().length).join('|');
const noTargets = () => '';

const steps = [
 {key:'organization',title:'Elegí la organización',manual:'empezar',target:'organization-context',text:'Elegí tu constructora en Organización activa. Si te invitaron, seleccioná esa empresa.',detail:'Usá tu propia cuenta y verificá el correo. Crear una organización no crea todavía la empresa, la obra ni sus participantes.',dependency:'El selector de organización todavía no está disponible. Esperá a que se confirme tu sesión.'},
 {key:'company',title:'Empresa y primera obra',manual:'empezar',target:'company-bootstrap-heading',text:'Si sos administrador, completá el nombre de la empresa y de la primera obra. La dirección y las primeras tareas son opcionales. Revisá la confirmación antes de crear.',detail:'Esperá el comprobante y elegí Entrar a mi obra. Si no llega la respuesta, usá Comprobar creación: no repitas el alta en otra organización.',dependency:'Primero seleccioná una organización. El alta inicial corresponde a su administrador.'},
 {key:'tasks',title:'Organizá las tareas',manual:'cronograma',target:'schedule-title',text:'Abrí una obra en Mis obras y consultá su cronograma. Si sos administrador, director o jefe de obra, podés crear tareas o elegir Importar PDF o imagen para preparar un borrador del Gantt. Compará sus títulos y fechas con la fuente antes de aplicarlo.',detail:'La importación admite hasta 50 tareas por archivo y requiere autorización para la extracción con OpenAI. Un administrador o director aprueba agregarlas con avance cero; no reemplaza las tareas existentes. El resumen y la búsqueda consideran las tareas cargadas: cargá más si la vista es parcial. Una fecha prevista no registra trabajo; el avance cambia tras una aprobación autorizada.',dependency:'Primero completá el alta de la empresa y abrí una obra en Mis obras. Si no tenés una obra asignada, pedile acceso a su responsable.'},
 {key:'team',title:'Incorporá al equipo',manual:'equipo',target:'participant-title',text:'Consultá tu participación en esta obra. El responsable prepara tu ficha y envía la invitación al correo correcto; ingresá con tu cuenta y aceptá la participación.',detail:'Una ficha o un teléfono declarado no conceden acceso. Podés aceptar con un correo secundario verificado de tu propia cuenta, conservando el principal. Si el correo queda sin confirmar, consultá el resultado antes de volver a invitar.',dependency:'Abrí una obra para consultar Participantes y revisión de identidad. Invitar y administrar personas requiere el permiso correspondiente.'},
 {key:'identity',title:'Presentá y revisá la identidad',manual:'equipo',target:'participant-title',text:'El participante presenta su documento y selfie desde su autoservicio o mediante el código privado IDENTIDAD del canal cliente activo. Otro responsable autorizado consulta las dos imágenes y registra su revisión.',detail:'La revisión es humana. La lectura asistida y la comparación facial privada requieren autorizaciones independientes y son opcionales. La selfie es estática: no verifica prueba de vida ni aprueba la identidad. En WhatsApp, usá el código del responsable desde el teléfono exacto de tu ficha y confirmá Guardar identidad. Podés cancelar antes de confirmar.',dependency:'Si todavía no aceptaste la invitación, la captura por chat queda pendiente de aceptación de cuenta y no habilita permisos. Para continuar con la revisión, aceptá la invitación verificada y abrí la obra asignada.'},
 {key:'field',title:'Registrá el trabajo',manual:'trabajo',target:'field-title',text:'Con participación y revisión vigentes, abrí Jornada y evidencia. El responsable prepara sectores y QR. En Inventario y consumo prepara el catálogo; las entregas vinculadas aumentan el saldo y los consumos requieren revisión.',detail:'En Sectores y QR, el responsable puede reimprimir el código vigente sin renovar la configuración. Elegí el sector y leé su QR con cámara; podés detenerla mientras esperás el permiso. La lectura queda en el formulario hasta que guardes. Para fichar, obtené la ubicación puntual y el QR cuando corresponda: una ubicación válida fuera del perímetro o la ausencia del QR requiere revisión; los errores de GPS se corrigen antes de fichar. Subir evidencia no aprueba avance. Informar consumo tampoco descuenta stock: otro administrador o director debe aprobarlo con saldo suficiente.',dependency:'Abrí una obra. La jornada y los reportes requieren tu ficha activa, identidad revisada y permisos actuales.'},
 {key:'whatsapp',title:'Prepará WhatsApp',manual:'whatsapp',target:'customer-whatsapp-title',text:'Podés trabajar desde la web mientras se prepara el canal. El responsable autoriza el número de la empresa con Meta; cada participante vincula el suyo desde su propia cuenta.',detail:'El código de SMS o llamada es distinto del PIN de registro. El código VINCULAR es privado y vence. Vincular un número no autoriza recordatorios: ese consentimiento se decide aparte.',dependency:'Abrí una obra con acceso a integraciones. Si sos participante, usá Mi WhatsApp de obra cuando el canal esté habilitado.'},
 {key:'clients',title:'Clientes y seguimiento',manual:'clientes',target:'constructor-crm-title',text:'El administrador de la empresa consulta Clientes para registrar oportunidades, contactos, etapas y la próxima fecha de seguimiento. Buscá por cliente, contacto, correo o teléfono en toda la empresa.',detail:'Las fichas pertenecen a la empresa, no sólo a la obra abierta. Una fecha de seguimiento no envía mensajes ni emite un presupuesto. Guardar un teléfono no concede permiso para escribirle por WhatsApp.',dependency:'Consultar Clientes requiere permiso de administración y el rol Administrador de la empresa. Abrí una obra con ese acceso; si tu rol no lo permite, pedile al responsable que gestione el seguimiento.'},
];

export function OnboardingGuide({orgId=null, orgRole=null}) {
 const [opened,setOpened] = useState(true), [index,setIndex] = useState(0), [reviewed,setReviewed] = useState([]), [notice,setNotice] = useState('');
 const title = useRef(null), moveFocus = useRef(false), choices = useRef(null);
 const available = new Set(useSyncExternalStore(subscribeTargets, readTargets, noTargets).split('|'));
 const step = steps[index], administrator = orgRole === 'org:admin';
 const teamRegister = step.key==='team'&&available.has('site-register-title');
 let target = step.target, dependency = step.dependency;
 if(step.key==='company') {
  if(!orgId) target=null;
  else if(available.has('workspace-title')) target='workspace-title';
  else if(!administrator) { target=null; dependency='El administrador debe completar el alta inicial. Cuando tengas una obra asignada, podrás consultarla en Mis obras.'; }
 }
 if(step.key==='whatsapp'&&!available.has(target)&&available.has('worker-channel-title')) target='worker-channel-title';
 if(teamRegister) target='site-register-title';
 const canGo=Boolean(target&&available.has(target));
 useEffect(()=>{if(moveFocus.current){title.current?.focus();moveFocus.current=false;}},[index]);
 function change(next){moveFocus.current=true;if(choices.current)choices.current.open=false;setNotice('');setIndex(next);}
 function go(destination=target){
  const element=destination&&document.getElementById(destination);
  if(!element?.getClientRects().length){setNotice(dependency);return;}
  const temporary=!element.hasAttribute('tabindex');
  if(temporary){element.setAttribute('tabindex','-1');element.addEventListener('blur',()=>element.removeAttribute('tabindex'),{once:true});}
  element.scrollIntoView({behavior:'auto',block:'start'});element.focus({preventScroll:true});
 }
 return <section className={styles.guide} aria-labelledby="onboarding-guide-title">
  <div className={styles.heading}><div><p className={styles.eyebrow}>ACOMPAÑAMIENTO DE INICIO</p><h2 id="onboarding-guide-title" tabIndex={-1}>Tu primera obra, paso a paso</h2></div><button type="button" aria-expanded={opened} aria-controls="onboarding-guide-content" onClick={()=>setOpened(value=>!value)}>{opened?'Ocultar guía':'Abrir guía'}</button></div>
  {opened&&<div id="onboarding-guide-content">
   <p className={styles.intro}>Te acompañamos sin guardar datos ni enviar mensajes.</p>
   <details className={styles.choices} ref={choices}><summary>Elegir otro paso</summary><nav aria-label="Pasos de inicio" className={styles.steps}>{steps.map((item,position)=><button type="button" key={item.key} aria-current={position===index?'step':undefined} onClick={()=>change(position)}><span>{position+1}</span>{item.title}{reviewed.includes(item.key)&&<small>Revisado por vos</small>}</button>)}</nav></details>
   <div className={styles.current}><p className={styles.position}>Paso {index+1} de {steps.length}</p><h3 ref={title} tabIndex={-1}>{step.title}</h3><p>{step.key==='company'&&available.has('workspace-title')?'Mis obras está disponible en esta pantalla. Abrí una obra y consultá su información antes de continuar.':teamRegister?'Primero abrí Equipo, incidencias y materiales → Abrir registro → Agregar persona para guardar la ficha. Después, en Participantes y revisión de identidad, asigná los permisos y enviá la invitación al correo correcto. El invitado ingresa con su cuenta y acepta la participación en esa obra.':step.text}</p>
    <details key={step.key}><summary>Qué revisar en este paso</summary><p>{step.detail}</p><label className={styles.review}><input type="checkbox" checked={reviewed.includes(step.key)} onChange={event=>setReviewed(previous=>event.target.checked?[...previous,step.key]:previous.filter(key=>key!==step.key))}/><span>Revisado por vos <small>Marca personal; no confirma guardado, permisos ni aceptación del proveedor.</small></span></label></details>
    {!canGo&&<p className={styles.dependency}>{dependency}</p>}
    <div className={styles.actions}><button type="button" className={styles.primary} disabled={!canGo} onClick={()=>go()}>Ir a este paso</button>{teamRegister&&available.has('participant-title')&&<a href="#participant-title" onClick={event=>{event.preventDefault();go('participant-title');}}>Invitaciones y permisos</a>}{!canGo&&available.has('workspace-title')&&<button type="button" onClick={()=>go('workspace-title')}>Consultar Mis obras</button>}<Link href={'/manual#'+step.manual}>Leer el paso en el manual</Link></div>
   </div>
   <p className={styles.notice} role="status" aria-live="polite">{notice}</p>
   <div className={styles.navigation}><button type="button" disabled={index===0} onClick={()=>change(index-1)}>Anterior</button><span>{reviewed.length} de {steps.length} pasos revisados por vos</span>{index<steps.length-1?<button type="button" onClick={()=>change(index+1)}>Siguiente</button>:<button type="button" onClick={()=>change(0)}>Volver al primer paso</button>}</div>
   <p className={styles.privacy}>Las marcas no se guardan. Al cambiar de cuenta u organización, empiezan de nuevo.</p>
  </div>}
 </section>;
}
