import {digest,WorkspaceError} from './workspace-policy.mjs';
import {FIELD_NOTICE,fieldTransition} from './field-operations-policy.mjs';
import {siteText,siteQuantity,MATERIAL_UNITS} from './site-register-policy.mjs';
import {normalizeProgressMeasurementQuantity,parseProgressMeasurementQuantity} from './progress-measurement-quantity.js';
import {FIELD_MEDIA_PRIVACY_NOTICE,fieldMediaAnalysisConsent,validFieldMediaAnalysisConsent} from './field-media-privacy.mjs';

const menuOptions=[['ATTEND_IN','Entrada'],['ATTEND_PAUSE','Iniciar pausa'],['ATTEND_RESUME','Volver de pausa'],['ATTEND_OUT','Salida'],['TASKS','Mis tareas'],['MEDIA','Enviar evidencia'],['INCIDENT','Informar incidencia'],['MATERIAL','Pedir material'],['PROGRESS','Proponer avance'],['STATUS','Consultar estado']];
const aliases={MENU:'MENU',AYUDA:'MENU',ENTRADA:'ATTEND_IN',PAUSA:'ATTEND_PAUSE',VOLVER:'ATTEND_RESUME',SALIDA:'ATTEND_OUT',TAREAS:'TASKS',EVIDENCIA:'MEDIA',INCIDENCIA:'INCIDENT',MATERIALES:'MATERIAL',AVANCE:'PROGRESS',ESTADO:'STATUS',CANCELAR:'MENU'};
const attendanceEvents={ATTEND_IN:'CHECK_IN',ATTEND_PAUSE:'BREAK_START',ATTEND_RESUME:'BREAK_END',ATTEND_OUT:'CHECK_OUT'};
const journeyExplanation={ATTENDANCE_SHIFT_ALREADY_OPEN:'Ya tenés una jornada abierta.',ATTENDANCE_SHIFT_NOT_OPEN:'Primero registrá una entrada.',ATTENDANCE_BREAK_ALREADY_OPEN:'Tu pausa ya está abierta. Registrá el regreso de pausa para continuar.',ATTENDANCE_BREAK_NOT_OPEN:'No hay una pausa abierta.',ATTENDANCE_BREAK_OPEN:'Registrá el regreso de pausa antes de la salida.'};
const text=body=>({type:'text',body});
const permits=(purpose,facts)=>purpose==='ATTENDANCE'?facts.permissions.attendance===true:facts.permissions.report===true;
const denied=purpose=>({state:null,reply:text((purpose==='ATTENDANCE'?'Tu participación no tiene habilitado el registro de jornada.':'Tu participación no tiene habilitado el envío de reportes, evidencia o propuestas de avance.')+' Pedí al responsable que revise tus permisos en Mi cuenta. Escribí MENU para consultar las opciones disponibles.')});
function journeyError(action,facts){try{fieldTransition(attendanceEvents[action],facts.latest);return null;}catch(error){if(!Object.hasOwn(journeyExplanation,error.code))throw error;return error.code;}}
const availableMenu=facts=>menuOptions.filter(([action])=>action.startsWith('ATTEND_')?permits('ATTENDANCE',facts)&&!journeyError(action,facts):['MEDIA','INCIDENT','MATERIAL','PROGRESS'].includes(action)?permits('REPORT',facts):true);
const progressHint='Usá el formato 25% o 2.5 / 10 M2. La base debe ser mayor que cero y la cantidad no puede superarla. Usá punto, hasta 4 decimales y hasta 14 cifras enteras, sin ceros a la izquierda. El borrador se conserva. Escribí CANCELAR para volver al menú.';
const inputHints={INCIDENT_TITLE:'Escribí un título de 3 a 160 caracteres.',INCIDENT_DESCRIPTION:'Escribí un detalle de 8 a 2000 caracteres.',MATERIAL_NAME:'Escribí el nombre del material de 2 a 160 caracteres.',MATERIAL_QUANTITY:'Escribí una cantidad mayor que cero, por ejemplo 12 o 2.5. Usá punto, hasta 3 decimales y hasta 9 cifras enteras.',MEDIA:'Volvé a enviar la foto, audio o video con una descripción de hasta 1000 caracteres.'};
function choices(state,eventId,body,rows){const nonce=digest([eventId,state.step]).slice(0,20);return {state:{...state,nonce,choices:rows.map(([value,title])=>({value,title}))},reply:{type:'interactive',body,button:'Elegir',sections:[{title:'Opciones',rows:rows.map(([,title],i)=>({id:'obra:'+nonce+':'+i,title:title.slice(0,24)}))}]}};}
const taskChoices=(tasks,optional=false)=>[...(optional?[['NONE','Sin tarea asociada']]:[]),...tasks.slice(0,optional?9:10).map(t=>[t.id,t.title])];
const sectorChoices=sectors=>sectors.slice(0,10).map(s=>[s.id,s.name]);
function chooseSector(state,eventId,facts){if(!facts.sectors.length)return {state:null,reply:text('Un responsable debe configurar los sectores de la obra antes de continuar. Podés hacerlo desde Mi cuenta.')};return choices({...state,step:'SECTOR'},eventId,'Elegí el sector donde estás trabajando.',sectorChoices(facts.sectors));}
function chooseTask(state,eventId,facts){if(!facts.tasks.length&&state.purpose!=='INCIDENT'&&state.purpose!=='MATERIAL')return {state:null,reply:text('La obra todavía no tiene tareas. Pedí al responsable que cree la tarea desde Mi cuenta.')};return choices({...state,step:'TASK'},eventId,'Elegí la tarea. Para más tareas, usá Mi cuenta.',taskChoices(facts.tasks,['INCIDENT','MATERIAL'].includes(state.purpose)));}
function confirm(state,eventId,body){return choices({...state,step:'CONFIRM'},eventId,body,[['CONFIRM','Guardar'],['CANCEL','Cancelar']]);}
const mediaNotice=(state,eventId)=>choices({...state,step:'MEDIA_NOTICE'},eventId,FIELD_MEDIA_PRIVACY_NOTICE,[['ANALYZE','Analizar y guardar'],['SAVE_ONLY','Sólo guardar'],['CANCEL','Cancelar']]);
function start(action,eventId,facts){
 if(action==='MENU')return choices({step:'MENU',purpose:'MENU'},eventId,'ObraSaaS · '+facts.projectName+'\nElegí una acción disponible para tu participación. CANCELAR vuelve al menú.',availableMenu(facts));
 if(action==='TASKS')return {state:null,reply:text(facts.tasks.length?'Tareas de '+facts.projectName+'\n'+facts.tasks.slice(0,15).map(t=>t.title.slice(0,160)+' · '+t.progress+'%').join('\n')+'\n'+(facts.tasks.length>15?'Consultá todas las tareas en Mi cuenta.\n':'')+'El avance cambia sólo tras aprobación del responsable.':'La obra todavía no tiene tareas.')};
 if(action==='STATUS'){const e=facts.latest;return {state:null,reply:text('Obra: '+facts.projectName+'\nJornada: '+(!e||e.eventType==='CHECK_OUT'?'cerrada':e.phase==='ON_BREAK'?'en pausa':'en curso')+'\nEvidencias pendientes: '+facts.evidence.filter(e=>e.status==='PENDING').length+'\nPropuestas pendientes: '+facts.proposals.filter(p=>p.status==='PENDING').length+'\nConsultá los recibos y las revisiones en Mi cuenta.')};}
 if(attendanceEvents[action]){if(!permits('ATTENDANCE',facts))return denied('ATTENDANCE');const error=journeyError(action,facts);if(error)return choices({step:'MENU',purpose:'MENU'},eventId,journeyExplanation[error]+' No registramos otro fichaje. Elegí una acción disponible.',availableMenu(facts));return chooseSector({purpose:'ATTENDANCE',eventType:attendanceEvents[action],expectedEventId:facts.latest?.id||null},eventId,facts);}
 if(!permits('REPORT',facts))return denied('REPORT');
 return chooseTask({purpose:action},eventId,facts);
}

// Only provider-authenticated messages enter this state machine. Interactive
// choices are single-context capabilities; free text never authorizes approval.
export function planMetaFieldConversation({message,state,eventId,facts,now}){
 try{return planConversation({message,state,eventId,facts,now});}
 catch(error){
  // Recover only the current input step. Identity, permission, revision and
  // backend errors retain their canonical handling in the signed bridge.
  if(state?.version!==1||!(Date.parse(state.expiresAt)>now.getTime()))throw error;
  const step=state.step;
  if(step==='MEASUREMENT'&&['FIELD_QUANTITY_INVALID','PROGRESS_MEASUREMENT_QUANTITY_INVALID'].includes(error.code))return {state,reply:text(progressHint)};
  const hint=step==='REASON'&&['MATERIAL','PROGRESS'].includes(state.purpose)?'Escribí el motivo de 8 a '+(state.purpose==='PROGRESS'?1000:2000)+' caracteres.':inputHints[step];
  if(hint&&(error.code==='SITE_INPUT_INVALID'||step==='MATERIAL_QUANTITY'&&error.code==='SITE_QUANTITY_INVALID'))return {state,reply:text(hint+' El borrador se conserva. Corregí este dato para continuar, o escribí CANCELAR.')};
  throw error;
 }
}
function planConversation({message,state,eventId,facts,now}){
 const body=message.type==='text'?message.text?.body?.trim():null;
 const alias=body&&aliases[body.toUpperCase()];
 if(alias)return start(alias,eventId,facts);
 const active=state?.version===1&&Date.parse(state.expiresAt)>now.getTime()?state:null;
 const selection=message.type==='interactive'?(message.interactive?.type==='list_reply'?message.interactive.list_reply?.id:message.interactive?.type==='button_reply'?message.interactive.button_reply?.id:null):null;
 let selected=null;
 if(selection){const match=/^obra:([a-f0-9]{20}):(\d{1,2})$/.exec(selection);if(!active||!match||match[1]!==active.nonce||!active.choices?.[Number(match[2])])return {state:active,reply:text('Esta opción pertenece a un paso anterior. Escribí MENU para volver a empezar.')};selected=active.choices[Number(match[2])].value;}
 if(!active)return start('MENU',eventId,facts);
 if(active.purpose!=='MENU'&&!permits(active.purpose,facts))return denied(active.purpose);
 const s={...active};delete s.choices;delete s.nonce;
 if(s.step==='MENU')return selected?start(selected,eventId,facts):start('MENU',eventId,facts);
 if(s.step==='TASK'){
  if(!selected)return {state:active,reply:text('Elegí una tarea en el menú anterior, o escribí CANCELAR.')};
  s.taskId=selected==='NONE'?null:selected;const task=facts.tasks.find(t=>t.id===s.taskId);if(s.taskId&&!task)throw new WorkspaceError('WORKSPACE_TASK_UNAVAILABLE',404);s.taskRevision=task?.revision||null;
  return chooseSector(s,eventId,facts);
 }
 if(s.step==='SECTOR'){
  if(!selected||!facts.sectors.some(x=>x.id===selected))return {state:active,reply:text('Elegí un sector en el menú anterior, o escribí CANCELAR.')};s.sectorId=selected;
  if(s.purpose==='ATTENDANCE'){
   if(['BREAK_START','BREAK_END'].includes(s.eventType))return confirm(s,eventId,s.eventType==='BREAK_START'?'¿Guardar el inicio de pausa?':'¿Guardar el regreso de pausa?');
   return choices({...s,step:'LOCATION_NOTICE'},eventId,'Para registrar entrada o salida usaremos la ubicación que compartas, vinculada a esta obra y su sector. WhatsApp no informa precisión GPS: el fichaje quedará para revisión humana. Podés usar la web para capturar precisión y QR. ¿Querés continuar?',[['ACCEPT','Continuar'],['CANCEL','Cancelar']]);
  }
  if(s.purpose==='MEDIA')return mediaNotice(s,eventId);
  return {state:{...s,step:s.purpose==='INCIDENT'?'INCIDENT_TITLE':s.purpose==='MATERIAL'?'MATERIAL_NAME':'MEASUREMENT'},reply:text(s.purpose==='INCIDENT'?'Escribí un título breve para la incidencia.':s.purpose==='MATERIAL'?'Escribí el material que necesitás.':'Escribí el avance, por ejemplo 25%, o una cantidad como 2.5 / 10 M2. La tarea conservará su avance hasta que un responsable apruebe.')};
 }
 if(s.step==='LOCATION_NOTICE')return selected==='ACCEPT'?{state:{...s,step:'LOCATION',noticeVersion:FIELD_NOTICE},reply:text('Compartí tu ubicación actual con el botón de adjuntar de WhatsApp. No envíes la dirección escrita. La precisión y el QR quedan pendientes de revisión.')}:{state:null,reply:text('Operación cancelada. Escribí MENU cuando quieras continuar.')};
 if(s.step==='LOCATION'){
  if(message.type!=='location')return {state:active,reply:text('Para continuar, compartí tu ubicación actual o escribí CANCELAR.')};
  const capturedAt=new Date(Number(message.timestamp)*1000);if(!Number.isFinite(capturedAt.getTime()))throw new WorkspaceError('ATTENDANCE_LOCATION_INVALID',422);
  s.location={latitude:message.location?.latitude,longitude:message.location?.longitude,accuracy:null,capturedAt:capturedAt.toISOString(),noticeVersion:s.noticeVersion};
  return confirm(s,eventId,'¿Guardar este fichaje para revisión humana? La ubicación recibida no incluye precisión GPS ni lectura de QR.');
 }
 if(s.step==='MEDIA_NOTICE'){
  if(selected==='CANCEL')return {state:null,reply:text('Operación cancelada. Escribí MENU cuando quieras continuar.')};
  if(!['ANALYZE','SAVE_ONLY'].includes(selected))return mediaNotice(s,eventId);
  return {state:{...s,step:'MEDIA',analysisConsent:fieldMediaAnalysisConsent(selected==='ANALYZE'),analysisConsentEventId:eventId},reply:text('Enviá una foto de hasta 2 MiB, o audio/video de hasta 3 MiB, de esta tarea y sector. '+(selected==='ANALYZE'?'Autorizaste el análisis asistido; el video se limita a cuatro cuadros sin audio.':'Se guardará en privado para revisión manual, sin enviarlo a OpenAI.'))};
 }
 if(s.step==='MEDIA'){
  if(!validFieldMediaAnalysisConsent(s.analysisConsent))return mediaNotice(s,eventId);
  if(!['image','audio','video'].includes(message.type))return {state:active,reply:text('Esperamos una foto, audio o video. Escribí CANCELAR si querés volver al menú.')};
  return {state:s,media:{taskId:s.taskId,sectorId:s.sectorId,mediaId:message[message.type]?.id,caption:siteText(message[message.type]?.caption||'Evidencia enviada desde el canal verificado.',1000,1,true),contentType:message[message.type]?.mime_type,kind:message.type,analysisConsent:s.analysisConsent,analysisConsentEventId:s.analysisConsentEventId}};
 }
 if(s.step==='INCIDENT_TITLE'){s.title=siteText(body,160,3);return {state:{...s,step:'INCIDENT_DESCRIPTION'},reply:text('Describí qué pasó y qué necesita atención. No incluyas documentos de identidad ni datos bancarios.')};}
 if(s.step==='INCIDENT_DESCRIPTION'){s.description=siteText(body,2000,8,true);return choices({...s,step:'SEVERITY'},eventId,'Elegí la prioridad de atención.',[['LOW','Baja'],['MEDIUM','Media'],['HIGH','Alta'],['CRITICAL','Crítica']]);}
 if(s.step==='SEVERITY'){if(!selected)return {state:active,reply:text('Elegí la prioridad del menú anterior.')};s.severity=selected;return confirm(s,eventId,'Incidencia: '+s.title+'\nPrioridad: '+active.choices.find(c=>c.value===selected).title+'\nDetalle: '+s.description.slice(0,550)+(s.description.length>550?'…':'')+'\n¿Guardar para seguimiento del responsable?');}
 if(s.step==='MATERIAL_NAME'){s.name=siteText(body,160,2);return {state:{...s,step:'MATERIAL_QUANTITY'},reply:text('Escribí la cantidad exacta, por ejemplo 12 o 2.5. Usá punto para los decimales.')};}
 if(s.step==='MATERIAL_QUANTITY'){s.quantity=siteQuantity(body);return choices({...s,step:'MATERIAL_UNIT'},eventId,'Elegí la unidad.',MATERIAL_UNITS.map(u=>[u,u]));}
 if(s.step==='MATERIAL_UNIT'){if(!selected)return {state:active,reply:text('Elegí la unidad del menú anterior.')};s.unit=selected;return {state:{...s,step:'REASON'},reply:text('Explicá para qué necesitás el material. El pedido requiere autorización de compra.')};}
 if(s.step==='MEASUREMENT'){
  const percent=/^(100|\d{1,2})%$/.exec(body||''),quantity=/^(\d+(?:\.\d{1,4})?)\s*\/\s*(\d+(?:\.\d{1,4})?)\s+(M|M2|M3|KG|T|L|UNIT|HOUR|DAY|LOT)$/i.exec(body||'');
  if(percent)Object.assign(s,{progress:Number(percent[1]),quantity:null,baseline:null,unit:null});
  else if(quantity){const value=normalizeProgressMeasurementQuantity(quantity[1]),baseline=normalizeProgressMeasurementQuantity(quantity[2],{allowZero:false});if(parseProgressMeasurementQuantity(value)>parseProgressMeasurementQuantity(baseline))throw new WorkspaceError('FIELD_QUANTITY_INVALID');Object.assign(s,{progress:Number(parseProgressMeasurementQuantity(value)*100n/parseProgressMeasurementQuantity(baseline)),quantity:value,baseline,unit:quantity[3].toUpperCase()});}
  else return {state:active,reply:text(progressHint)};
  const evidence=facts.evidence.filter(e=>e.taskId===s.taskId&&e.status==='APPROVED');if(!evidence.length)return {state:null,reply:text('Esta tarea necesita evidencia revisada y aprobada antes de recibir una propuesta de avance. Enviá EVIDENCIA y pedí al responsable que la revise. El avance no cambió.')};
  return choices({...s,step:'PROGRESS_EVIDENCE'},eventId,'Elegí la evidencia aprobada que sustenta el avance.',evidence.slice(0,10).map(e=>[e.id,e.title]));
 }
 if(s.step==='PROGRESS_EVIDENCE'){if(!selected)return {state:active,reply:text('Elegí una evidencia aprobada del menú anterior.')};s.evidenceIds=[selected];return {state:{...s,step:'REASON'},reply:text('Explicá cómo mediste el avance o la cantidad ejecutada.')};}
 if(s.step==='REASON'){s.reason=siteText(body,s.purpose==='PROGRESS'?1000:2000,8,true);return confirm(s,eventId,(s.purpose==='MATERIAL'?'Pedido: '+s.quantity+' '+s.unit+' de '+s.name+'\nEsto no autoriza una compra.':'Avance propuesto: '+s.progress+'%'+(s.quantity!==null?' · '+s.quantity+' / '+s.baseline+' '+s.unit:'')+'\nLa tarea conserva su avance hasta aprobación.')+'\nMotivo: '+s.reason.slice(0,550)+(s.reason.length>550?'…':'')+'\n¿Guardar para revisión?');}
 if(s.step==='CONFIRM'){
  if(selected==='CANCEL')return {state:null,reply:text('Operación cancelada. Escribí MENU para continuar.')};
  if(selected!=='CONFIRM')return {state:active,reply:text('Elegí Guardar o Cancelar en el menú anterior.')};
  if(s.purpose==='ATTENDANCE')return {state:null,command:{action:'ATTENDANCE',payload:{workerId:facts.workerId,eventType:s.eventType,expectedEventId:s.expectedEventId,sectorId:s.sectorId,qrToken:null,location:s.location||null}}};
  if(s.purpose==='INCIDENT')return {state:null,command:{action:'REPORT_INCIDENT',payload:{workerId:facts.workerId,taskId:s.taskId,sectorId:s.sectorId,title:s.title,description:s.description,severity:s.severity,evidenceIds:[]}}};
  if(s.purpose==='MATERIAL')return {state:null,command:{action:'REQUEST_MATERIAL',payload:{workerId:facts.workerId,taskId:s.taskId,sectorId:s.sectorId,name:s.name,quantity:s.quantity,unit:s.unit,reason:s.reason,evidenceIds:[]}}};
  if(s.purpose==='PROGRESS')return {state:null,command:{action:'PROPOSE_PROGRESS',payload:{workerId:facts.workerId,taskId:s.taskId,revision:s.taskRevision,progress:s.progress,quantity:s.quantity,baseline:s.baseline,unit:s.unit,reason:s.reason,evidenceIds:s.evidenceIds}}};
 }
 return start('MENU',eventId,facts);
}
