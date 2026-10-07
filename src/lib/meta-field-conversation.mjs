import {digest,WorkspaceError,workspaceId} from './workspace-policy.mjs';
import {FIELD_NOTICE,fieldTransition} from './field-operations-policy.mjs';
import {siteText,siteQuantity,MATERIAL_UNITS} from './site-register-policy.mjs';
import {normalizeProgressMeasurementQuantity,parseProgressMeasurementQuantity} from './progress-measurement-quantity.js';
import {FIELD_MEDIA_PRIVACY_NOTICE,FIELD_MEDIA_PRIVACY_NOTICE_VERSION,FIELD_VIDEO_PRIVACY_NOTICE,FIELD_VIDEO_AUDIO_PRIVACY_NOTICE,fieldMediaAnalysisConsent,fieldVideoAnalysisConsent,validFieldMediaAnalysisConsent} from './field-media-privacy.mjs';
import {inventoryQuantity} from './material-inventory.mjs';
import {voiceProgressDraftForEvidence,prepareVoiceProgressDraft,voiceProgressDraftReady,UNKNOWN_VOICE_VALUE,voiceQuantityScopeLabel,voiceProgressQuantityLabel,voiceProgressUnitLabel} from './voice-progress-draft.mjs';

const menuOptions=[['ATTEND_IN','Entrada'],['ATTEND_PAUSE','Iniciar pausa'],['ATTEND_RESUME','Volver de pausa'],['ATTEND_OUT','Salida'],['TASKS','Mis tareas'],['MEDIA','Enviar evidencia'],['INCIDENT','Informar incidencia'],['MATERIAL','Pedir material'],['CONSUMPTION','Proponer consumo'],['PROGRESS','Proponer avance'],['STATUS','Consultar estado']];
const aliases={MENU:'MENU',AYUDA:'MENU',ENTRADA:'ATTEND_IN',PAUSA:'ATTEND_PAUSE',VOLVER:'ATTEND_RESUME',SALIDA:'ATTEND_OUT',TAREAS:'TASKS',EVIDENCIA:'MEDIA',INCIDENCIA:'INCIDENT',MATERIALES:'MATERIAL',CONSUMO:'CONSUMPTION',AVANCE:'PROGRESS',ESTADO:'STATUS',CANCELAR:'MENU'};
export const metaFieldConversationAction=body=>typeof body==='string'?aliases[body.trim().toUpperCase()]||null:null;
const attendanceEvents={ATTEND_IN:'CHECK_IN',ATTEND_PAUSE:'BREAK_START',ATTEND_RESUME:'BREAK_END',ATTEND_OUT:'CHECK_OUT'};
const journeyExplanation={ATTENDANCE_SHIFT_ALREADY_OPEN:'Ya tenés una jornada abierta.',ATTENDANCE_SHIFT_NOT_OPEN:'Primero registrá una entrada.',ATTENDANCE_BREAK_ALREADY_OPEN:'Tu pausa ya está abierta. Registrá el regreso de pausa para continuar.',ATTENDANCE_BREAK_NOT_OPEN:'No hay una pausa abierta.',ATTENDANCE_BREAK_OPEN:'Registrá el regreso de pausa antes de la salida.'};
const text=body=>({type:'text',body});
const permits=(purpose,facts)=>purpose==='ATTENDANCE'?facts.permissions.attendance===true:facts.permissions.report===true;
const denied=purpose=>({state:null,reply:text((purpose==='ATTENDANCE'?'Tu participación no tiene habilitado el registro de jornada.':'Tu participación no tiene habilitado el envío de reportes, evidencia o propuestas de avance.')+' Pedí al responsable que revise tus permisos en Mi cuenta. Escribí MENU para consultar las opciones disponibles.')});
function journeyError(action,facts){try{fieldTransition(attendanceEvents[action],facts.latest);return null;}catch(error){if(!Object.hasOwn(journeyExplanation,error.code))throw error;return error.code;}}
const availableMenu=facts=>menuOptions.filter(([action])=>(!facts.attendanceOnly||action.startsWith('ATTEND_')||action==='STATUS')).filter(([action])=>action.startsWith('ATTEND_')?permits('ATTENDANCE',facts)&&!journeyError(action,facts):action==='CONSUMPTION'?permits('REPORT',facts)&&Boolean(facts.inventory?.materials?.some(m=>m.active)):['MEDIA','INCIDENT','MATERIAL','PROGRESS'].includes(action)?permits('REPORT',facts):true);
const progressHint='Usá el formato 25% o 2.5 / 10 M2. La base debe ser mayor que cero y la cantidad no puede superarla. Usá punto, hasta 4 decimales y hasta 14 cifras enteras, sin ceros a la izquierda. El borrador se conserva. Escribí CANCELAR para volver al menú.';
const inputHints={INCIDENT_TITLE:'Escribí un título de 3 a 160 caracteres.',INCIDENT_DESCRIPTION:'Escribí un detalle de 8 a 2000 caracteres.',MATERIAL_NAME:'Escribí el nombre del material de 2 a 160 caracteres.',MATERIAL_QUANTITY:'Escribí una cantidad mayor que cero, por ejemplo 12 o 2.5. Usá punto, hasta 3 decimales y hasta 9 cifras enteras.',MEDIA:'Volvé a enviar la foto, audio o video con una descripción de hasta 1000 caracteres.',MEDIA_FILE:'Volvé a enviar la foto, audio o video con una descripción de hasta 1000 caracteres.'};
function choices(state,eventId,body,rows){const nonce=digest([eventId,state.step]).slice(0,20);return {state:{...state,nonce,choices:rows.map(([value,title])=>({value,title}))},reply:{type:'interactive',body,button:'Elegir',sections:[{title:'Opciones',rows:rows.map(([,title],i)=>({id:'obra:'+nonce+':'+i,title:title.slice(0,24)}))}]}};}
const taskChoices=(tasks,optional=false)=>[...(optional?[['NONE','Sin tarea asociada']]:[]),...tasks.slice(0,optional?9:10).map(t=>[t.id,t.title])];
const sectorChoices=sectors=>sectors.slice(0,10).map(s=>[s.id,s.name]);
function chooseSector(state,eventId,facts){if(!facts.sectors.length)return {state:null,reply:text('Un responsable debe configurar los sectores de la obra antes de continuar. Podés hacerlo desde Mi cuenta.')};return choices({...state,step:'SECTOR'},eventId,'Elegí el sector donde estás trabajando.',sectorChoices(facts.sectors));}
function chooseTask(state,eventId,facts){const optional=['INCIDENT','MATERIAL','CONSUMPTION'].includes(state.purpose);if(!facts.tasks.length&&!optional)return {state:null,reply:text('La obra todavía no tiene tareas. Pedí al responsable que cree la tarea desde Mi cuenta.')};return choices({...state,step:'TASK'},eventId,'Elegí la tarea. Para más tareas, usá Mi cuenta.',taskChoices(facts.tasks,optional));}
function consumptionMaterials(state,eventId,facts){const materials=facts.inventory?.materials?.filter(m=>m.active)||[];if(!materials.length)return {state:null,reply:text('El responsable debe configurar el catálogo antes de proponer consumo. El stock no cambió.')};const offset=state.materialOffset||0,rows=materials.slice(offset,offset+8).map(m=>[m.id,m.name+' · '+m.unit]);if(offset>0)rows.push(['PREVIOUS','Materiales anteriores']);if(offset+8<materials.length)rows.push(['NEXT','Más materiales']);return choices({...state,step:'CONSUMPTION_MATERIAL',materialOffset:offset},eventId,'Elegí el material del catálogo. La propuesta requiere revisión antes de descontar stock.',rows);}
function confirm(state,eventId,body){return choices({...state,step:'CONFIRM'},eventId,body,[['CONFIRM','Guardar'],['CANCEL','Cancelar']]);}
const voiceEvidence=(state,facts)=>facts.evidence.filter(e=>e.taskId===state.taskId&&e.status==='APPROVED'&&voiceProgressDraftForEvidence(e,facts.tasks.find(t=>t.id===state.taskId))?.task.revision===facts.tasks.find(t=>t.id===state.taskId)?.revision);
const includesVideo=rows=>rows.some(e=>e.media?.kind==='video');
const manualMeasurement=state=>({state:{...state,step:'MEASUREMENT'},reply:text('Escribí el avance medido, por ejemplo 25%, o la cantidad acumulada y su base: 2.5 / 10 M2. La tarea conserva su avance hasta aprobación.')});
const mediaNotice=(state,eventId)=>choices({...state,step:'MEDIA_NOTICE'},eventId,FIELD_MEDIA_PRIVACY_NOTICE,[['ANALYZE','Analizar y guardar'],['SAVE_ONLY','Sólo guardar'],['CANCEL','Cancelar']]);
export const META_FIELD_MEDIA_AUTHORIZATION_VERSION='field-channel-media-v2';
const mediaReferenceKeys=['version','eventId','payloadDigest','contextDigest','sourceProjectId','kind','mediaId','contentType','caption','receivedAt','expiresAt','taskId','taskRevision','sectorId'];
const mediaTypes={image:['image/jpeg','image/png','image/webp'],audio:['audio/ogg','audio/wav','audio/mpeg','audio/mp4','audio/webm'],video:['video/mp4','video/webm']};
const canonicalDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function validMetaFieldMediaReference(ref,{state,facts,now}={}){
 if(!ref||typeof ref!=='object'||Array.isArray(ref)||Object.keys(ref).sort().join('|')!==mediaReferenceKeys.slice().sort().join('|')||ref.version!==1||!['eventId','sourceProjectId','taskId','sectorId'].every(key=>workspaceId(ref[key]))||!['payloadDigest','contextDigest'].every(key=>/^[a-f0-9]{64}$/.test(ref[key]||''))||!/^\d{5,32}$/.test(ref.mediaId||'')||typeof ref.contentType!=='string'||ref.contentType.length>128||/[\x00-\x1f\x7f]/.test(ref.contentType)||!mediaTypes[ref.kind]?.includes(ref.contentType.toLowerCase().split(';')[0].trim())||typeof ref.caption!=='string'||!ref.caption.length||ref.caption.length>1000||typeof ref.taskRevision!=='string'||!canonicalDate(ref.receivedAt)||!canonicalDate(ref.expiresAt)||Date.parse(ref.expiresAt)-Date.parse(ref.receivedAt)!==900000||!(now instanceof Date)||!Number.isFinite(now.getTime())||Date.parse(ref.receivedAt)>now.getTime()||Date.parse(ref.expiresAt)<=now.getTime())return false;
 if(!state||state.mediaAuthorizationVersion!==META_FIELD_MEDIA_AUTHORIZATION_VERSION||ref.taskId!==state.taskId||ref.taskRevision!==state.taskRevision||ref.sectorId!==state.sectorId||ref.contextDigest!==facts?.mediaReferenceContext?.contextDigest||ref.sourceProjectId!==facts?.mediaReferenceContext?.sourceProjectId)return false;
 return facts.permissions?.report===true&&facts.tasks?.some(task=>task.id===ref.taskId&&task.revision===ref.taskRevision)&&facts.sectors?.some(sector=>sector.id===ref.sectorId);
}
const mediaFilePrompt=state=>({state:{...state,step:'MEDIA_FILE'},reply:text('Enviá una foto de hasta 2 MiB, o audio/video de hasta 3 MiB, de esta tarea y sector. Después elegirás si querés análisis asistido. El archivo todavía no se guardará ni se enviará para análisis.')});
function typedMediaNotice(state,eventId){const video=state.pendingFile.kind==='video';return choices({...state,step:video?'VIDEO_NOTICE':'MEDIA_TYPED_NOTICE'},eventId,(video?'Recibimos la referencia de tu video.\n'+FIELD_VIDEO_PRIVACY_NOTICE:'Recibimos la referencia de tu '+(state.pendingFile.kind==='image'?'foto':'audio')+'.\n'+FIELD_MEDIA_PRIVACY_NOTICE),[['ANALYZE',video?'Analizar cuadros':'Analizar y guardar'],['SAVE_ONLY','Sólo guardar'],['CANCEL','Cancelar']]);}
export function metaFieldMediaAuthorizationValid(message,media,state){
 const selected=message?.type==='interactive'?(message.interactive?.type==='list_reply'?message.interactive.list_reply?.id:message.interactive?.type==='button_reply'?message.interactive.button_reply?.id:null):null;
 const match=/^obra:([a-f0-9]{20}):(\d{1,2})$/.exec(selected||'');
 if(!match||!workspaceId(state?.lastEventId)||match[1]!==digest([state.lastEventId,state.mediaAuthorizationStep]).slice(0,20))return false;
 const index=Number(match[2]),kind=media?.sourceOrigin?.kind;let expected;
 if(state.mediaAuthorizationStep==='MEDIA_TYPED_NOTICE'&&['image','audio'].includes(kind)&&[0,1].includes(index))expected=fieldMediaAnalysisConsent(index===0);
 else if(state.mediaAuthorizationStep==='VIDEO_NOTICE'&&kind==='video'&&index===1)expected=fieldVideoAnalysisConsent(false,false);
 else if(state.mediaAuthorizationStep==='VIDEO_AUDIO_NOTICE'&&kind==='video'&&[0,1].includes(index)&&state.videoVisualConsentEventId===state.lastEventId)expected=fieldVideoAnalysisConsent(true,index===0);
 return Boolean(expected&&validFieldMediaAnalysisConsent(media.analysisConsent)&&digest(expected)===digest(media.analysisConsent));
}
function authorizeMedia(state,eventId,consent){const ref=state.pendingFile;return {state:{...state,step:'MEDIA_AUTHORIZED',mediaAuthorizationStep:state.step,analysisConsent:consent,analysisConsentEventId:eventId},media:{taskId:ref.taskId,sectorId:ref.sectorId,mediaId:ref.mediaId,caption:ref.caption,contentType:ref.contentType,kind:ref.kind,analysisConsent:consent,analysisConsentEventId:eventId,sourceOrigin:ref}};}
function start(action,eventId,facts){
 if(action==='MENU')return choices({step:'MENU',purpose:'MENU'},eventId,'ObraSaaS · '+facts.projectName+'\nElegí una acción disponible para tu participación. CANCELAR vuelve al menú.',availableMenu(facts));
 if(action==='TASKS')return {state:null,reply:text(facts.tasks.length?'Tareas de '+facts.projectName+'\n'+facts.tasks.slice(0,15).map(t=>t.title.slice(0,160)+' · '+t.progress+'%').join('\n')+'\n'+(facts.tasks.length>15?'Consultá todas las tareas en Mi cuenta.\n':'')+'El avance cambia sólo tras aprobación del responsable.':'La obra todavía no tiene tareas.')};
 if(action==='STATUS'){const e=facts.latest;return {state:null,reply:text('Obra: '+facts.projectName+'\nJornada: '+(!e||e.eventType==='CHECK_OUT'?'cerrada':e.phase==='ON_BREAK'?'en pausa':'en curso')+'\nEvidencias pendientes: '+facts.evidence.filter(e=>e.status==='PENDING').length+'\nPropuestas pendientes: '+facts.proposals.filter(p=>p.status==='PENDING').length+'\nConsultá los recibos y las revisiones en Mi cuenta.')};}
 if(attendanceEvents[action]){if(!permits('ATTENDANCE',facts))return denied('ATTENDANCE');const error=journeyError(action,facts);if(error)return choices({step:'MENU',purpose:'MENU'},eventId,journeyExplanation[error]+' No registramos otro fichaje. Elegí una acción disponible.',availableMenu(facts));return chooseSector({purpose:'ATTENDANCE',eventType:attendanceEvents[action],expectedEventId:facts.latest?.id||null},eventId,facts);}
 if(!permits('REPORT',facts))return denied('REPORT');
 return chooseTask({purpose:action,...(action==='MEDIA'?{mediaAuthorizationVersion:META_FIELD_MEDIA_AUTHORIZATION_VERSION}:{})},eventId,facts);
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
  if(step==='CONSUMPTION_QUANTITY'&&error.code==='INVENTORY_QUANTITY_INVALID')return {state,reply:text('Ingresá una cantidad positiva con punto y hasta tres decimales. El borrador y el stock se conservan.')};
  const hint=step==='REASON'&&['MATERIAL','PROGRESS','CONSUMPTION'].includes(state.purpose)?'Escribí el motivo de 8 a '+(state.purpose==='MATERIAL'?2000:1000)+' caracteres.':inputHints[step];
  if(hint&&(error.code==='SITE_INPUT_INVALID'||step==='MATERIAL_QUANTITY'&&error.code==='SITE_QUANTITY_INVALID'))return {state,reply:text(hint+' El borrador se conserva. Corregí este dato para continuar, o escribí CANCELAR.')};
  throw error;
 }
}
function planConversation({message,state,eventId,facts,now}){
 const body=message.type==='text'?message.text?.body?.trim():null;
 const alias=metaFieldConversationAction(body);
 if(alias)return start(alias,eventId,facts);
 const active=state?.version===1&&Date.parse(state.expiresAt)>now.getTime()?state:null;
 const selection=message.type==='interactive'?(message.interactive?.type==='list_reply'?message.interactive.list_reply?.id:message.interactive?.type==='button_reply'?message.interactive.button_reply?.id:null):null;
 let selected=null;
 if(selection){const match=/^obra:([a-f0-9]{20}):(\d{1,2})$/.exec(selection);if(!active||!match||match[1]!==active.nonce||!active.choices?.[Number(match[2])])return {state:active,reply:text('Esta opción pertenece a un paso anterior. Escribí MENU para volver a empezar.')};selected=active.choices[Number(match[2])].value;}
 if(!active)return start('MENU',eventId,facts);
 if(active.purpose!=='MENU'&&!permits(active.purpose,facts))return denied(active.purpose);
 const s={...active};delete s.choices;delete s.nonce;
 if(s.sourceVoice&&!voiceProgressDraftReady(s.sourceVoice,facts.evidence.find(e=>e.id===s.sourceVoice.evidenceId),facts.tasks.find(t=>t.id===s.taskId)))return {state:active,reply:text('La tarea o el '+(s.sourceVoice.mediaKind==='video'?'video':'audio')+' cambió desde que preparaste el borrador. No guardamos una propuesta. Conservamos este paso; escribí AVANCE para revisar los registros vigentes o CANCELAR para volver al menú.')};
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
  if(s.purpose==='MEDIA')return s.mediaAuthorizationVersion===META_FIELD_MEDIA_AUTHORIZATION_VERSION?mediaFilePrompt(s):mediaNotice(s,eventId);
  if(s.purpose==='CONSUMPTION')return consumptionMaterials(s,eventId,facts);
  if(s.purpose==='PROGRESS'){const rows=voiceEvidence(s,facts),video=includesVideo(rows);return rows.length?choices({...s,step:'PROGRESS_SOURCE'},eventId,'Podés revisar un borrador desde un '+(video?'audio o video':'audio')+' ya aprobado o ingresar tu medición. La cantidad del día no se suma automáticamente.',[['VOICE',video?'Revisar audio o video':'Revisar audio aprobado'],['MANUAL','Ingresar medición']]):manualMeasurement(s);}
  return {state:{...s,step:s.purpose==='INCIDENT'?'INCIDENT_TITLE':s.purpose==='MATERIAL'?'MATERIAL_NAME':'MEASUREMENT'},reply:text(s.purpose==='INCIDENT'?'Escribí un título breve para la incidencia.':s.purpose==='MATERIAL'?'Escribí el material que necesitás.':'Escribí el avance, por ejemplo 25%, o una cantidad como 2.5 / 10 M2. La tarea conservará su avance hasta que un responsable apruebe.')};
 }
 if(s.step==='PROGRESS_SOURCE'){
  if(selected==='MANUAL')return manualMeasurement(s);
  const rows=voiceEvidence(s,facts),label=includesVideo(rows)?'audio o video':'audio';
  if(selected!=='VOICE')return {state:active,reply:text('Elegí el '+label+' aprobado o la medición manual en el menú anterior.')};
  return rows.length?choices({...s,step:'VOICE_EVIDENCE'},eventId,'Elegí el '+label+' aprobado de esta tarea.',rows.slice(0,10).map(e=>[e.id,e.title])):manualMeasurement(s);
 }
 if(s.step==='VOICE_EVIDENCE'){
  const rows=voiceEvidence(s,facts),evidence=rows.find(e=>e.id===selected);if(!evidence)return {state:active,reply:text('Elegí un '+(includesVideo(rows)?'audio o video':'audio')+' aprobado vigente del menú anterior.')};
  const task=facts.tasks.find(t=>t.id===s.taskId),draft=voiceProgressDraftForEvidence(evidence,task),prepared=prepareVoiceProgressDraft(evidence,task,facts.workerId);
  const video=evidence.media.kind==='video';
  return choices({...s,step:'VOICE_REVIEW',voiceCandidate:prepared.sourceVoice},eventId,'Borrador del audio'+(video?' del video':'')+' · Tarea elegida: '+task.title.slice(0,160)+'\nActividad: '+(draft.activity===UNKNOWN_VOICE_VALUE?'Sin identificar':draft.activity.slice(0,160))+'\nCantidad: '+voiceProgressQuantityLabel(draft.quantity)+' '+voiceProgressUnitLabel(draft.unit)+'\nAlcance: '+voiceQuantityScopeLabel(draft.quantitySemantics)+'\nLa base y el porcentaje están pendientes. Revisá que el '+(video?'video original, su audio':'audio')+' y la unidad correspondan a esta tarea. Ingresarás la medición acumulada; una cantidad del día no se suma automáticamente.',[['USE','Revisé, completar'],['MANUAL','Medición manual']]);
 }
 if(s.step==='VOICE_REVIEW'){
  if(selected==='MANUAL'){delete s.voiceCandidate;return manualMeasurement(s);}
  if(selected!=='USE')return {state:active,reply:text('Revisá el borrador y elegí una opción del menú anterior. Todavía no se guardó una propuesta.')};
  const sourceVoice={...s.voiceCandidate,confirmed:true},evidence=facts.evidence.find(e=>e.id===sourceVoice.evidenceId),task=facts.tasks.find(t=>t.id===s.taskId);
  if(!voiceProgressDraftReady(sourceVoice,evidence,task))return {state:active,reply:text('La tarea o el '+(sourceVoice.mediaKind==='video'?'video':'audio')+' cambió. Escribí AVANCE para consultar nuevamente; no se guardó una propuesta.')};
  delete s.voiceCandidate;return manualMeasurement({...s,sourceVoice});
 }
 if(s.step==='LOCATION_NOTICE')return selected==='ACCEPT'?{state:{...s,step:'LOCATION',noticeVersion:FIELD_NOTICE},reply:text('Compartí tu ubicación actual con el botón de adjuntar de WhatsApp. No envíes la dirección escrita. La precisión y el QR quedan pendientes de revisión.')}:{state:null,reply:text('Operación cancelada. Escribí MENU cuando quieras continuar.')};
 if(s.step==='LOCATION'){
  if(message.type!=='location')return {state:active,reply:text('Para continuar, compartí tu ubicación actual o escribí CANCELAR.')};
  const capturedAt=new Date(Number(message.timestamp)*1000);if(!Number.isFinite(capturedAt.getTime()))throw new WorkspaceError('ATTENDANCE_LOCATION_INVALID',422);
  s.location={latitude:message.location?.latitude,longitude:message.location?.longitude,accuracy:null,capturedAt:capturedAt.toISOString(),noticeVersion:s.noticeVersion};
  return confirm(s,eventId,'¿Guardar este fichaje para revisión humana? La ubicación recibida no incluye precisión GPS ni lectura de QR.');
 }
 if(s.step==='MEDIA_FILE'&&s.mediaAuthorizationVersion===META_FIELD_MEDIA_AUTHORIZATION_VERSION){
  if(!['image','audio','video'].includes(message.type))return {state:active,reply:text('Esperamos una foto, audio o video. Después podrás elegir cómo guardarlo. Escribí CANCELAR para volver al menú.')};
  const source=facts.mediaReferenceContext,asset=message[message.type],ref={version:1,eventId,payloadDigest:source?.payloadDigest,contextDigest:source?.contextDigest,sourceProjectId:source?.sourceProjectId,kind:message.type,mediaId:asset?.id,contentType:asset?.mime_type,caption:siteText(asset?.caption||'Evidencia enviada desde el canal verificado.',1000,1,true),receivedAt:now.toISOString(),expiresAt:new Date(now.getTime()+900000).toISOString(),taskId:s.taskId,taskRevision:s.taskRevision,sectorId:s.sectorId};
  if(source?.eventId!==eventId||!validMetaFieldMediaReference(ref,{state:s,facts,now}))return {state:null,reply:text('No pudimos vincular ese archivo con la tarea y la participación actuales. Escribí EVIDENCIA y volvé a elegir la tarea y el sector. No guardamos ni analizamos el archivo.')};
  return typedMediaNotice({...s,pendingFile:ref},eventId);
 }
 if(['MEDIA_TYPED_NOTICE','VIDEO_NOTICE','VIDEO_AUDIO_NOTICE'].includes(s.step)&&s.mediaAuthorizationVersion===META_FIELD_MEDIA_AUTHORIZATION_VERSION){
  if(!validMetaFieldMediaReference(s.pendingFile,{state:s,facts,now}))return {state:null,reply:text('El archivo, la tarea o la participación cambió, o venció esta espera. No guardamos ni analizamos el archivo. Escribí EVIDENCIA para empezar con los datos actuales.')};
  if(selected==='CANCEL')return {state:null,reply:text('Operación cancelada. No guardamos ni enviamos el archivo para análisis. Escribí MENU cuando quieras continuar.')};
  if(s.step==='VIDEO_AUDIO_NOTICE'){
   if(!['WITH_AUDIO','VISUAL_ONLY'].includes(selected))return {state:active,reply:text('Elegí si autorizás transcribir el audio o si preferís sólo los cuadros. Todavía no guardamos ni analizamos el video.')};
   if(s.pendingFile.kind!=='video'||!validFieldMediaAnalysisConsent(s.analysisConsent)||s.analysisConsent.noticeVersion===FIELD_MEDIA_PRIVACY_NOTICE_VERSION||s.analysisConsent.allowed!==true||s.analysisConsent.videoAudio.allowed!==false)return {state:null,reply:text('Esta autorización no corresponde al video actual. Escribí EVIDENCIA para empezar de nuevo.')};
   return authorizeMedia(s,eventId,fieldVideoAnalysisConsent(true,selected==='WITH_AUDIO'));
  }
  if(!['ANALYZE','SAVE_ONLY'].includes(selected))return {state:active,reply:text('Elegí una opción del aviso anterior. Todavía no guardamos ni analizamos el archivo.')};
  if(s.step==='VIDEO_NOTICE'){
   if(s.pendingFile.kind!=='video')return {state:null,reply:text('El aviso no corresponde a este archivo. Escribí EVIDENCIA para empezar de nuevo.')};
   if(selected==='SAVE_ONLY')return authorizeMedia(s,eventId,fieldVideoAnalysisConsent(false,false));
   return choices({...s,step:'VIDEO_AUDIO_NOTICE',analysisConsent:fieldVideoAnalysisConsent(true,false),videoVisualConsentEventId:eventId},eventId,FIELD_VIDEO_AUDIO_PRIVACY_NOTICE,[['WITH_AUDIO','Transcribir audio'],['VISUAL_ONLY','Sólo cuadros'],['CANCEL','Cancelar']]);
  }
  if(s.pendingFile.kind==='video')return {state:null,reply:text('Este video requiere su propio aviso. Escribí EVIDENCIA para empezar de nuevo.')};
  return authorizeMedia(s,eventId,fieldMediaAnalysisConsent(selected==='ANALYZE'));
 }
 if(s.step==='MEDIA_NOTICE'){
  if(selected==='CANCEL')return {state:null,reply:text('Operación cancelada. Escribí MENU cuando quieras continuar.')};
  if(!['ANALYZE','SAVE_ONLY'].includes(selected))return mediaNotice(s,eventId);
  return {state:{...s,step:'MEDIA',analysisConsent:fieldMediaAnalysisConsent(selected==='ANALYZE'),analysisConsentEventId:eventId},reply:text('Enviá una foto de hasta 2 MiB, o audio/video de hasta 3 MiB, de esta tarea y sector. '+(selected==='ANALYZE'?'Autorizaste el análisis asistido; el video se limita a cuatro cuadros sin audio.':'Se guardará en privado para revisión manual, sin enviarlo a OpenAI.'))};
 }
 if(s.step==='MEDIA'){
  if(!validFieldMediaAnalysisConsent(s.analysisConsent)||s.analysisConsent.noticeVersion!==FIELD_MEDIA_PRIVACY_NOTICE_VERSION)return mediaNotice(s,eventId);
  if(!['image','audio','video'].includes(message.type))return {state:active,reply:text('Esperamos una foto, audio o video. Escribí CANCELAR si querés volver al menú.')};
  return {state:s,media:{taskId:s.taskId,sectorId:s.sectorId,mediaId:message[message.type]?.id,caption:siteText(message[message.type]?.caption||'Evidencia enviada desde el canal verificado.',1000,1,true),contentType:message[message.type]?.mime_type,kind:message.type,analysisConsent:s.analysisConsent,analysisConsentEventId:s.analysisConsentEventId}};
 }
 if(s.step==='INCIDENT_TITLE'){s.title=siteText(body,160,3);return {state:{...s,step:'INCIDENT_DESCRIPTION'},reply:text('Describí qué pasó y qué necesita atención. No incluyas documentos de identidad ni datos bancarios.')};}
 if(s.step==='INCIDENT_DESCRIPTION'){s.description=siteText(body,2000,8,true);return choices({...s,step:'SEVERITY'},eventId,'Elegí la prioridad de atención.',[['LOW','Baja'],['MEDIUM','Media'],['HIGH','Alta'],['CRITICAL','Crítica']]);}
 if(s.step==='SEVERITY'){if(!selected)return {state:active,reply:text('Elegí la prioridad del menú anterior.')};s.severity=selected;return confirm(s,eventId,'Incidencia: '+s.title+'\nPrioridad: '+active.choices.find(c=>c.value===selected).title+'\nDetalle: '+s.description.slice(0,550)+(s.description.length>550?'…':'')+'\n¿Guardar para seguimiento del responsable?');}
 if(s.step==='MATERIAL_NAME'){s.name=siteText(body,160,2);return {state:{...s,step:'MATERIAL_QUANTITY'},reply:text('Escribí la cantidad exacta, por ejemplo 12 o 2.5. Usá punto para los decimales.')};}
 if(s.step==='MATERIAL_QUANTITY'){s.quantity=siteQuantity(body);return choices({...s,step:'MATERIAL_UNIT'},eventId,'Elegí la unidad.',MATERIAL_UNITS.map(u=>[u,u]));}
 if(s.step==='MATERIAL_UNIT'){if(!selected)return {state:active,reply:text('Elegí la unidad del menú anterior.')};s.unit=selected;return {state:{...s,step:'REASON'},reply:text('Explicá para qué necesitás el material. El pedido requiere autorización de compra.')};}
 if(s.step==='CONSUMPTION_MATERIAL'){if(selected==='NEXT'||selected==='PREVIOUS')return consumptionMaterials({...s,materialOffset:Math.max(0,(s.materialOffset||0)+(selected==='NEXT'?8:-8))},eventId,facts);const material=facts.inventory?.materials?.find(m=>m.id===selected&&m.active);if(!material)return {state:active,reply:text('Elegí un material del catálogo anterior.')};return {state:{...s,step:'CONSUMPTION_QUANTITY',materialId:material.id,name:material.name,unit:material.unit,catalogHash:facts.inventory.catalogHash},reply:text('Material: '+material.name+'\nUnidad: '+material.unit+'\nEscribí la cantidad consumida, con punto y hasta tres decimales.')};}
 if(s.step==='CONSUMPTION_QUANTITY'){s.quantity=inventoryQuantity(body);return {state:{...s,step:'REASON'},reply:text('Explicá para qué se usó el material. Todavía no se descuenta stock.')};}
 if(s.step==='MEASUREMENT'){
  const percent=/^(100|\d{1,2})%$/.exec(body||''),quantity=/^(\d+(?:\.\d{1,4})?)\s*\/\s*(\d+(?:\.\d{1,4})?)\s+(M|M2|M3|KG|T|L|UNIT|HOUR|DAY|LOT)$/i.exec(body||'');
  if(percent)Object.assign(s,{progress:Number(percent[1]),quantity:null,baseline:null,unit:null});
  else if(quantity){const value=normalizeProgressMeasurementQuantity(quantity[1]),baseline=normalizeProgressMeasurementQuantity(quantity[2],{allowZero:false});if(parseProgressMeasurementQuantity(value)>parseProgressMeasurementQuantity(baseline))throw new WorkspaceError('FIELD_QUANTITY_INVALID');Object.assign(s,{progress:Number(parseProgressMeasurementQuantity(value)*100n/parseProgressMeasurementQuantity(baseline)),quantity:value,baseline,unit:quantity[3].toUpperCase()});}
  else return {state:active,reply:text(progressHint)};
  const evidence=facts.evidence.filter(e=>e.taskId===s.taskId&&e.status==='APPROVED');if(!evidence.length)return {state:null,reply:text('Esta tarea necesita evidencia revisada y aprobada antes de recibir una propuesta de avance. Enviá EVIDENCIA y pedí al responsable que la revise. El avance no cambió.')};
  if(s.sourceVoice)return {state:{...s,step:'REASON',evidenceIds:[s.sourceVoice.evidenceId]},reply:text('Explicá cómo verificaste la medición acumulada de esta tarea. El audio aprobado quedará vinculado; la propuesta sigue pendiente de confirmación.')};
  return choices({...s,step:'PROGRESS_EVIDENCE'},eventId,'Elegí la evidencia aprobada que sustenta el avance.',evidence.slice(0,10).map(e=>[e.id,e.title]));
 }
 if(s.step==='PROGRESS_EVIDENCE'){if(!selected)return {state:active,reply:text('Elegí una evidencia aprobada del menú anterior.')};s.evidenceIds=[selected];return {state:{...s,step:'REASON'},reply:text('Explicá cómo mediste el avance o la cantidad ejecutada.')};}
 if(s.step==='REASON'){s.reason=siteText(body,s.purpose==='MATERIAL'?2000:1000,8,true);return confirm(s,eventId,(s.purpose==='MATERIAL'?'Pedido: '+s.quantity+' '+s.unit+' de '+s.name+'\nEsto no autoriza una compra.':s.purpose==='CONSUMPTION'?'Consumo propuesto: '+s.quantity+' '+s.unit+' de '+s.name+'\nEl stock se conserva hasta revisión del responsable.':'Avance propuesto: '+s.progress+'%'+(s.quantity!==null?' · '+s.quantity+' / '+s.baseline+' '+s.unit:'')+'\nLa tarea conserva su avance hasta aprobación.')+'\nMotivo: '+s.reason.slice(0,550)+(s.reason.length>550?'…':'')+'\n¿Guardar para revisión?');}
 if(s.step==='CONFIRM'){
  if(selected==='CANCEL')return {state:null,reply:text('Operación cancelada. Escribí MENU para continuar.')};
  if(selected!=='CONFIRM')return {state:active,reply:text('Elegí Guardar o Cancelar en el menú anterior.')};
  if(s.purpose==='ATTENDANCE')return {state:null,command:{action:'ATTENDANCE',payload:{workerId:facts.workerId,eventType:s.eventType,expectedEventId:s.expectedEventId,sectorId:s.sectorId,qrToken:null,location:s.location||null}}};
  if(s.purpose==='INCIDENT')return {state:null,command:{action:'REPORT_INCIDENT',payload:{workerId:facts.workerId,taskId:s.taskId,sectorId:s.sectorId,title:s.title,description:s.description,severity:s.severity,evidenceIds:[]}}};
  if(s.purpose==='MATERIAL')return {state:null,command:{action:'REQUEST_MATERIAL',payload:{workerId:facts.workerId,taskId:s.taskId,sectorId:s.sectorId,name:s.name,quantity:s.quantity,unit:s.unit,reason:s.reason,evidenceIds:[]}}};
  if(s.purpose==='CONSUMPTION')return {state:null,command:{action:'PROPOSE_CONSUMPTION',payload:{workerId:facts.workerId,taskId:s.taskId,sectorId:s.sectorId,materialId:s.materialId,catalogHash:s.catalogHash,quantity:s.quantity,reason:s.reason}}};
  if(s.purpose==='PROGRESS')return {state:null,command:{action:'PROPOSE_PROGRESS',payload:{workerId:facts.workerId,taskId:s.taskId,revision:s.taskRevision,progress:s.progress,quantity:s.quantity,baseline:s.baseline,unit:s.unit,reason:s.reason,evidenceIds:s.evidenceIds}}};
 }
 return start('MENU',eventId,facts);
}
