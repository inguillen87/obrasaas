import {digest,WorkspaceError,workspaceId,calendarDate} from './workspace-policy.mjs';
import {FIELD_NOTICE,fieldTransition} from './field-operations-policy.mjs';
import {siteText,siteQuantity,MATERIAL_UNITS} from './site-register-policy.mjs';
import {normalizeProgressMeasurementQuantity,parseProgressMeasurementQuantity} from './progress-measurement-quantity.js';
import {FIELD_MEDIA_PRIVACY_NOTICE,FIELD_MEDIA_PRIVACY_NOTICE_VERSION,FIELD_VIDEO_PRIVACY_NOTICE,FIELD_VIDEO_AUDIO_PRIVACY_NOTICE,fieldMediaAnalysisConsent,fieldVideoAnalysisConsent,validFieldMediaAnalysisConsent} from './field-media-privacy.mjs';
import {inventoryQuantity} from './material-inventory.mjs';
import {canImportPlan} from './plan-import-policy.mjs';
import {startMetaPlanImportConversation,continueMetaPlanImportConversation} from './meta-plan-import-conversation.mjs';
import {voiceProgressDraftForEvidence,prepareVoiceProgressDraft,voiceProgressDraftReady,UNKNOWN_VOICE_VALUE,voiceQuantityScopeLabel,voiceProgressQuantityLabel,voiceProgressUnitLabel} from './voice-progress-draft.mjs';
import {deriveTaskMeasurement} from './task-progress-measurement.js';
import {planMetaFieldExecution,hasMetaFieldExecutionMandate} from './meta-field-execution-conversation.mjs';

const menuOptions=[['ATTEND_IN','Entrada'],['ATTEND_PAUSE','Iniciar pausa'],['ATTEND_RESUME','Volver de pausa'],['ATTEND_OUT','Salida'],['TASKS','Cronograma y tareas'],['MEDIA','Enviar evidencia'],['INCIDENT','Informar incidencia'],['MATERIAL','Pedir material'],['EXECUTION','Registrar material'],['CONSUMPTION','Proponer consumo'],['PROGRESS','Proponer avance'],['PLAN_IMPORT','Importar cronograma'],['STATUS','Consultar estado']];
const aliases={MENU:'MENU','MENÚ':'MENU',AYUDA:'MENU',HOLA:'MENU',ENTRADA:'ATTEND_IN',PAUSA:'ATTEND_PAUSE',VOLVER:'ATTEND_RESUME',SALIDA:'ATTEND_OUT',TAREAS:'TASKS',CRONOGRAMA:'TASKS',GANTT:'TASKS','IMPORTAR CRONOGRAMA':'PLAN_IMPORT','IMPORTAR PLAN':'PLAN_IMPORT',EVIDENCIA:'MEDIA',EVIDENCIAS:'OWN_EVIDENCE',AVANCES:'OWN_PROGRESS',INCIDENCIA:'INCIDENT',MATERIALES:'MATERIAL',CONSUMO:'CONSUMPTION',CONSUMOS:'OWN_CONSUMPTIONS',EJECUCION:'EXECUTION','EJECUCIÓN':'EXECUTION',REPORTAR:'EXECUTION',EJECUCIONES:'OWN_EXECUTIONS',AVANCE:'PROGRESS',ESTADO:'STATUS',CANCELAR:'MENU'};
export const metaFieldConversationAction=body=>typeof body==='string'?aliases[body.trim().toUpperCase()]||null:null;
// A read requirement, never participant authority. The signed bridge proves
// the recovery origin/binding and current permission before using this scope.
export function metaFieldRecoveryCatalogRead({message,state,recovery,now,attendanceOnly=false}){
 return attendanceOnly!==true&&message?.type==='text'&&metaFieldConversationAction(message.text?.body)==='CONSUMPTION'&&state?.version===1&&state.purpose==='CONSUMPTION'&&now instanceof Date&&Number.isFinite(now.getTime())&&Date.parse(state.expiresAt)>now.getTime()&&recovery?.version===1&&recovery.expired!==true&&recovery.deadline===state.expiresAt&&Date.parse(recovery.deadline)>now.getTime();
}
const attendanceEvents={ATTEND_IN:'CHECK_IN',ATTEND_PAUSE:'BREAK_START',ATTEND_RESUME:'BREAK_END',ATTEND_OUT:'CHECK_OUT'};
const journeyExplanation={ATTENDANCE_SHIFT_ALREADY_OPEN:'Ya tenés una jornada abierta.',ATTENDANCE_SHIFT_NOT_OPEN:'Primero registrá una entrada.',ATTENDANCE_BREAK_ALREADY_OPEN:'Tu pausa ya está abierta. Registrá el regreso de pausa para continuar.',ATTENDANCE_BREAK_NOT_OPEN:'No hay una pausa abierta.',ATTENDANCE_BREAK_OPEN:'Registrá el regreso de pausa antes de la salida.'};
const text=body=>({type:'text',body});
const permits=(purpose,facts)=>purpose==='PLAN_IMPORT'?canImportPlan(facts.planImportRole):purpose==='TASKS'||(purpose==='ATTENDANCE'?facts.permissions.attendance===true:facts.permissions.report===true);
const denied=purpose=>markMetaFieldDisclosure({state:null,reply:text((purpose==='ATTENDANCE'?'Tu participación no tiene habilitado el registro de jornada.':'Tu participación no tiene habilitado el envío de reportes, evidencia o propuestas de avance.')+' Pedí al responsable que revise tus permisos en Mi cuenta. Escribí MENU para consultar las opciones disponibles.')},'GENERIC');
function journeyError(action,facts){try{fieldTransition(attendanceEvents[action],facts.latest);return null;}catch(error){if(!Object.hasOwn(journeyExplanation,error.code))throw error;return error.code;}}
// Keep the old CONSUMO command and historical menu capability valid. The menu
// leads with real authorized execution; its manual alternative stays explicit.
const availableMenu=facts=>menuOptions.filter(([action])=>action!=='CONSUMPTION'&&(!facts.attendanceOnly||action.startsWith('ATTEND_')||action==='STATUS')).filter(([action])=>action==='PLAN_IMPORT'?permits('PLAN_IMPORT',facts):action.startsWith('ATTEND_')?permits('ATTENDANCE',facts)&&!journeyError(action,facts):action==='EXECUTION'?permits('REPORT',facts)&&Boolean(facts.inventory?.materials?.some(m=>m.active)):['MEDIA','INCIDENT','MATERIAL','PROGRESS'].includes(action)?permits('REPORT',facts):true);
const progressHint='Usá el formato 25% o 2.5 / 10 M2. La base debe ser mayor que cero y la cantidad no puede superarla. Usá punto, hasta 4 decimales y hasta 14 cifras enteras, sin ceros a la izquierda. El borrador se conserva. Escribí CANCELAR para volver al menú.';
const inputHints={INCIDENT_TITLE:'Escribí un título de 3 a 160 caracteres.',INCIDENT_DESCRIPTION:'Escribí un detalle de 8 a 2000 caracteres.',MATERIAL_NAME:'Escribí el nombre del material de 2 a 160 caracteres.',MATERIAL_QUANTITY:'Escribí una cantidad mayor que cero, por ejemplo 12 o 2.5. Usá punto, hasta 3 decimales y hasta 9 cifras enteras.',MEDIA:'Volvé a enviar la foto, audio o video con una descripción de hasta 1000 caracteres.',MEDIA_FILE:'Volvé a enviar la foto, audio o video con una descripción de hasta 1000 caracteres.'};
function choices(state,eventId,body,rows){const nonce=digest([eventId,state.step]).slice(0,20);return {state:{...state,nonce,choices:rows.map(([value,title])=>({value,title}))},reply:{type:'interactive',body,button:'Elegir',sections:[{title:'Opciones',rows:rows.map(([,title,description],i)=>({id:'obra:'+nonce+':'+i,title:title.slice(0,24),...(description?{description:description.slice(0,72)}:{})}))}]}};}
function chooseSector(state,eventId,facts){
 if(!facts.sectors.length)return {state:null,reply:text('Pedí al administrador o director que prepare al menos un sector de la obra en Mi cuenta. Después volvé a iniciar este registro.')};
 const offset=Math.min(state.sectorOffset||0,Math.floor((facts.sectors.length-1)/8)*8),rows=facts.sectors.slice(offset,offset+8).map(s=>[s.id,s.name]);
 if(offset>0)rows.push(['PREVIOUS_SECTORS','Sectores anteriores']);if(offset+8<facts.sectors.length)rows.push(['NEXT_SECTORS','Más sectores']);
 return choices({...state,step:'SECTOR',sectorOffset:offset},eventId,'Elegí el sector donde estás trabajando.',rows);
}
function compactReadText(value,limit){if(limit<=0)return '';const source=typeof value==='string'?value.trim().replace(/\s+/g,' '):'';if(source.length<=limit)return source;let result='';for(const character of source){if(result.length+character.length>=limit)break;result+=character;}return result+'…';}
function boundedReadBody(value,limit){if(value.length<=limit)return value;let result='';for(const character of value){if(result.length+character.length>=limit)break;result+=character;}return result+'…';}
const taskProgress=task=>typeof task.progress==='number'&&Number.isFinite(task.progress)&&task.progress>=0&&task.progress<=100?String(task.progress)+'%':'sin confirmar';
const taskDates=task=>calendarDate(task.startsOn)&&calendarDate(task.endsOn)&&task.endsOn>=task.startsOn?task.startsOn+' → '+task.endsOn:task.startsOn==null&&task.endsOn==null?'Sin fechas previstas':'Fechas por revisar';
const taskStates={BACKLOG:'Pendiente',IN_PROGRESS:'En curso',BLOCKED:'Bloqueada',DONE:'Finalizada'};
const taskState=task=>Object.hasOwn(taskStates,task.status)?taskStates[task.status]:'Estado por confirmar';
function scheduleReadBody(facts,detail='',draftInstruction=''){
 const tasks=facts.tasks.slice(0,8),page=facts.taskPage||{},limit=Number.isSafeInteger(facts.replyBodyLimit)&&facts.replyBodyLimit>=0&&facts.replyBodyLimit<=1024?facts.replyBodyLimit:1024;
 const summary=titleLimit=>'Cronograma y tareas · '+compactReadText(facts.projectName,40)+'\n'+(tasks.length?tasks.map((task,index)=>(index+1)+'. '+compactReadText(task.title,titleLimit)+' · '+taskDates(task)+' · '+taskProgress(task)).join('\n'):'No hay tareas en esta consulta.')+'\nFechas previstas · avance registrado.\n'+(page.hasPrevious||page.hasNext?draftInstruction?'Vista parcial de la obra.':'Vista parcial: recorré las páginas.':'Tareas de esta consulta.');
 const instruction=draftInstruction||'\nElegí una tarea para consultar su estado.',contentLimit=Math.max(0,limit-instruction.length);
 let body=detail||summary(16);
 // Reserve the original draft instructions before shortening titles or adding
 // an optional link. Dates and progress for all eight tasks keep priority.
 if(!detail)for(const titleLimit of [12,8,4]){if(body.length<=contentLimit)break;body=summary(titleLimit);}
 if(body.length>contentLimit)body=compactReadText(body,contentLimit);
 // This local hint is supplied by the signed bridge; Cuenta rechecks access.
 const link=!facts.attendanceOnly&&workspaceId(facts.projectId)?'\nGantt completo: https://obrasaas.com/cuenta?'+new URLSearchParams({obra:facts.projectId})+'#schedule-gantt-title':'';
 if(body.length+link.length+instruction.length<=limit)body+=link;
 return body+(instruction.length<=limit-body.length?instruction:compactReadText(instruction,Math.max(0,limit-body.length)));
}
const limitedTaskRead=state=>({state:state||null,...(state?{preserveConversation:true}:{}),reply:text('Este piloto sólo habilita jornada y su estado. Escribí MENU o ESTADO para continuar. La consulta del cronograma no está habilitada por este canal.')});
function chooseTask(state,eventId,facts,detail=''){
 const optional=['INCIDENT','MATERIAL','CONSUMPTION'].includes(state.purpose),limit=optional?7:8,page=facts.taskPage||{hasPrevious:false,hasNext:false},tasks=facts.tasks.slice(0,limit);
 if(state.purpose==='TASKS'&&facts.attendanceOnly)return limitedTaskRead(null);
 if(state.purpose==='TASKS'&&!tasks.length)return {state:null,reply:text(scheduleReadBody(facts))};
 if(!tasks.length&&!optional)return {state:null,reply:text('No hay tareas disponibles en esta página. Escribí TAREAS para consultar la obra desde el inicio.')};
 const rows=[...(optional?[['NONE','Sin tarea asociada']]:[]),...tasks.map(t=>[t.id,t.title,t.title+' · '+t.progress+'%'])];
 if(page.hasPrevious)rows.push(['PREVIOUS_TASKS','Tareas anteriores']);if(page.hasNext)rows.push(['NEXT_TASKS','Más tareas']);
 return choices({...state,step:'TASK',taskPage:page},eventId,state.purpose==='TASKS'?scheduleReadBody(facts,detail):detail||'Elegí la tarea de este registro. Podés recorrer todas las páginas.',rows);
}
function consumptionMaterials(state,eventId,facts){const materials=facts.inventory?.materials?.filter(m=>m.active)||[];if(!materials.length)return state.consumptionRecovery?{state,preserveConversation:true,reply:text('El catálogo no tiene materiales disponibles. Conservamos el borrador y su plazo; pedí al responsable que revise el catálogo o descartalo con CANCELAR.') }:{state:null,reply:text('El responsable debe configurar el catálogo antes de proponer consumo. El stock no cambió.')};const offset=Math.min(state.materialOffset||0,Math.floor((materials.length-1)/8)*8),rows=materials.slice(offset,offset+8).map(m=>[m.id,m.name+' · '+m.unit]);if(offset>0)rows.push(['PREVIOUS','Materiales anteriores']);if(offset+8<materials.length)rows.push(['NEXT','Más materiales']);const previous=state.recoverySuggestion;return choices({...state,step:'CONSUMPTION_MATERIAL',materialOffset:offset},eventId,(previous?'Borrador anterior: '+previous.quantity+' '+previous.unit+' de '+previous.name+'. Es una sugerencia, sin conversión ni aplicación automática.\n':'')+'Elegí el material del catálogo vigente. La propuesta requiere revisión antes de descontar stock.',rows);}
function consumptionReasonPrompt(state,eventId){return state.consumptionRecovery?choices({...state,step:'CONSUMPTION_RECOVERY_REASON'},eventId,'Motivo anterior: '+state.recoverySuggestion.reason.slice(0,550)+(state.recoverySuggestion.reason.length>550?'…':'')+'\nConfirmá si sigue correspondiendo al material y la cantidad elegidos.',[['KEEP_REASON','Usar motivo anterior'],['NEW_REASON','Escribir otro motivo']]):{state:{...state,step:'REASON'},reply:text('Explicá para qué se usó el material. Todavía no se descuenta stock.')};}
function consumptionConfirmation(state,eventId){return confirm(state,eventId,'Consumo propuesto: '+state.quantity+' '+state.unit+' de '+state.name+'\nEl stock se conserva hasta revisión del responsable.\nMotivo: '+state.reason.slice(0,550)+(state.reason.length>550?'…':'')+'\n¿Guardar para revisión?');}
const consumptionState=state=>({PENDING:'Pendiente de revisión',APPROVED:'Aprobado',REJECTED:'Rechazado',REVERSED:'Revertido'}[state]||'Estado no confirmado');
const consumptionName=c=>c.materialName||'Material '+c.materialId;
const consumptionReason=value=>value.length>600?value.slice(0,600)+'… (motivo completo en Mi cuenta)':value;
export function metaFieldConsumptionAcknowledgement(outcome,projectName){const c=outcome.recordedConsumptionSnapshot||outcome.consumption;return 'Consumo informado en '+projectName+': '+c.quantity+' '+c.unit+' de '+consumptionName(c)+'.\nReferencia del informe: '+c.id+'\nRecibo de propuesta: '+outcome.receiptId+'\nInformado: '+c.submittedAt+'\nQuedó pendiente de revisión. Este recibo no descuenta stock; otro responsable autorizado debe decidir.\nEscribí ESTADO para consultar la decisión vigente o CONSUMOS para recorrer tus informes.';}
function ownConsumptionList(state,eventId,facts){
 const page=facts.ownConsumptions;if(!page)return {state:null,reply:text('No se pudo confirmar la consulta de consumos. Escribí ESTADO para volver a intentar.')};
 const rows=page.records.map(c=>[c.id,consumptionName(c),c.quantity+' '+c.unit+' · '+consumptionState(c.state)+' · '+c.submittedAt.slice(0,10)]);
 if(page.nextCursor)rows.push(['NEXT_CONSUMPTIONS','Más consumos']);if(page.afterConsumption)rows.push(['FIRST_CONSUMPTIONS','Volver al inicio']);rows.push(['MENU','Volver al menú']);
 return {...choices({...state,purpose:'OWN_CONSUMPTIONS',step:'OWN_CONSUMPTION_LIST',consumptionAfter:page.afterConsumption,nextConsumptionCursor:page.nextCursor},eventId,'Consumos informados por tu cuenta en '+facts.projectName+'.\n'+(page.records.length?'Elegí un informe para consultar su estado vigente, motivo, fechas y recibos.':page.afterConsumption?'No hay más informes en esta página.':'No hay consumos informados por tu cuenta en esta obra.')+'\nLa consulta no mueve stock.',rows),consumptionRead:true};
}
function ownConsumptionDetail(state,eventId,facts,id){
 const c=facts.ownConsumptions?.records.find(row=>row.id===id);if(!c)throw new WorkspaceError('INVENTORY_CURSOR_UNAVAILABLE',404);
 let body='Obra: '+facts.projectName+'\n'+consumptionName(c)+': '+c.quantity+' '+c.unit+'\nReferencia del informe: '+c.id+'\nInformado: '+c.submittedAt+'\nEstado vigente: '+consumptionState(c.state)+'\nMotivo del informe: '+consumptionReason(c.reason);
 if(c.proposalReceiptId)body+='\nRecibo de propuesta: '+c.proposalReceiptId;
 for(const [label,event] of [['Decisión registrada',c.decision],['Reversión registrada',c.reversal]])if(event)body+='\n'+label+': '+(event.decision==='REJECT'?'Rechazado':event.decision==='APPROVE'?'Aprobado':'Revertido')+'\nFecha: '+event.recordedAt+'\nMotivo: '+consumptionReason(event.reason)+'\nRecibo: '+event.receiptId;
 body+='\nEl recibo de propuesta conserva el informe original. Las decisiones y sus movimientos tienen sus propios recibos.\nPara seguir recorriendo informes, usá las opciones de la lista anterior o escribí CONSUMOS para volver al inicio.';
 return {state,preserveConversation:true,reply:text(body),consumptionRead:true};
}
const ownReportPurposes=['OWN_EVIDENCE','OWN_PROGRESS'],ownReadPurposes=['OWN_CONSUMPTIONS',...ownReportPurposes];
const reportState=state=>({PENDING:'Pendiente de revisión',APPROVED:'Aprobada',APPLIED:'Aprobado y aplicado',REJECTED:'Rechazado',EXPIRED:'Vencido sin aprobación'}[state]||'Estado sin confirmar');
const reportSection=purpose=>purpose==='OWN_EVIDENCE'?'EVIDENCE':'PROGRESS';
const reportCommand=purpose=>purpose==='OWN_EVIDENCE'?'EVIDENCIAS':'AVANCES';
function ownReportList(state,eventId,facts,purpose){
 const page=facts.ownReports,section=reportSection(purpose),command=reportCommand(purpose),label=section==='EVIDENCE'?'Evidencias':'Avances';
 if(!page||page.section!==section)return {state:null,reply:text('No se pudo confirmar la consulta de tus informes. Escribí '+command+' para volver a consultar.')};
 const rows=page.records.map(r=>[r.id,r.title,reportState(r.state)+' · '+r.submittedAt.slice(0,10)]);
 if(page.nextCursor)rows.push(['NEXT_REPORTS','Más informes']);if(page.afterReport)rows.push(['FIRST_REPORTS','Volver al inicio']);rows.push(['MENU','Volver al menú']);
 return {...choices({...state,purpose,step:'OWN_REPORT_LIST',reportAfter:page.afterReport,nextReportCursor:page.nextCursor},eventId,label+(section==='EVIDENCE'?' informadas':' informados')+' por tu cuenta en '+compactReadText(facts.projectName,80)+'.\n'+(page.records.length?'Elegí un informe para consultar su estado, motivo y recibos.':page.afterReport?'No hay más informes en esta página.':'No hay informes propios en esta obra.')+'\nConsultar no aprueba evidencia ni modifica la tarea.',rows),reportRead:true};
}
function ownReportDetail(state,facts,id){
 const r=facts.ownReports?.records.find(row=>row.id===id&&row.section===reportSection(state.purpose));if(!r)throw new WorkspaceError('FIELD_REPORT_CURSOR_UNAVAILABLE',404);
 let body='Obra: '+compactReadText(facts.projectName,160)+'\n'+r.title+'\nReferencia del informe: '+r.id+'\nTarea registrada: '+r.taskId+'\nInformado: '+r.submittedAt+'\nEstado vigente: '+reportState(r.state)+'\n'+(r.section==='EVIDENCE'?'Descripción':'Motivo del informe')+': '+r.reason+'\nRecibo original: '+(r.receiptId||'No comprobado en los registros disponibles.');
 if(r.section==='PROGRESS'&&r.progress!==null)body+='\nAvance propuesto: '+r.progress+'%.';
 if(r.review)body+='\n'+(r.review.decision==='EXPIRED'?'Vencimiento registrado':'Revisión humana registrada')+': '+(r.review.decision==='APPROVE'?'Aprobado':r.review.decision==='REJECT'?'Rechazado':'Vencido')+'\nFecha: '+r.review.recordedAt+'\nMotivo: '+r.review.reason+'\nRecibo de '+(r.review.decision==='EXPIRED'?'vencimiento':'revisión')+': '+(r.review.receiptId||'No comprobado en los registros disponibles.');
 else if(r.state==='EXPIRED')body+='\nEl plazo venció sin una decisión autorizada; no se informa una aprobación.';
 body+='\n'+(r.section==='EVIDENCE'?'La revisión de evidencia no acredita por sí sola avance ejecutado ni identidad civil.':'La propuesta original y la decisión son registros distintos. Consultar no modifica el avance vigente de la tarea.')+'\nUsá las opciones de la lista anterior o escribí '+reportCommand(state.purpose)+' para volver al inicio.';
 return {state,preserveConversation:true,reply:text(body),reportRead:true};
}
function statusReply(facts){const e=facts.latest,page=facts.ownConsumptions;let body='Obra: '+compactReadText(facts.projectName,160);
 if(facts.permissions.attendance===true)body+='\nJornada: '+(!e||e.eventType==='CHECK_OUT'?'cerrada':e.phase==='ON_BREAK'?'en pausa':'en curso');
 if(facts.permissions.report===true)body+='\nEvidencias y avances: consultá tus informes para ver la revisión vigente, su motivo y sus recibos.';
 if(facts.permissions.report===true&&page)body+='\nConsumos informados por tu cuenta (últimos '+page.records.length+'):'+(page.records.length?'\n'+page.records.map(c=>consumptionName(c).slice(0,45)+' · '+c.quantity+' '+c.unit+' · '+consumptionState(c.state)).join('\n'):' ninguno.')+(page.nextCursor?'\nHay más informes para consultar.':'');
 return boundedReadBody(body+(facts.permissions.report===true?'\nEscribí EVIDENCIAS, AVANCES o CONSUMOS para consultar tus informes.':'\nConsultá los recibos de jornada en Mi cuenta.'),Number.isSafeInteger(facts.replyBodyLimit)?facts.replyBodyLimit:1024);
}
function confirm(state,eventId,body){return choices({...state,step:'CONFIRM'},eventId,body,[['CONFIRM','Guardar'],['CANCEL','Cancelar']]);}
const voiceEvidence=(state,facts)=>facts.evidence.filter(e=>e.taskId===state.taskId&&e.status==='APPROVED'&&voiceProgressDraftForEvidence(e,facts.tasks.find(t=>t.id===state.taskId))?.task.revision===facts.tasks.find(t=>t.id===state.taskId)?.revision);
const includesVideo=rows=>rows.some(e=>e.media?.kind==='video');
function manualMeasurement(state,eventId,facts){
 const task=facts.tasks.find(t=>t.id===state.taskId),measurement=task?.measurement;
 const next={...state};delete next.evidencePage;
 if(measurement)return choices({...next,step:'MEASUREMENT_SCOPE',measurementDefinitionId:measurement.definitionId},eventId,'Tarea: '+task.title+'\nBase del responsable: '+voiceProgressQuantityLabel(measurement.baseline)+' '+voiceProgressUnitLabel(measurement.unit)+'\nAcumulado aprobado: '+voiceProgressQuantityLabel(measurement.executed)+' '+voiceProgressUnitLabel(measurement.unit)+'\n¿Vas a informar una cantidad adicional o el total acumulado?',[['DELTA','Realizado hoy'],['CUMULATIVE','Total acumulado']]);
 return {state:{...next,step:'MEASUREMENT'},reply:text('Escribí el avance medido, por ejemplo 25%, o la cantidad acumulada y su base: 2.5 / 10 M2. La tarea conserva su avance hasta aprobación.')};
}
function chooseEvidence(state,eventId,facts,voice=false){
 const page=facts.evidencePage||{first:null,last:null,hasPrevious:false,hasNext:false},available=facts.pagedEvidence||facts.evidence;
 const current=voice?voiceEvidence(state,{...facts,evidence:available}):available.filter(e=>e.taskId===state.taskId&&e.status==='APPROVED');
 const rows=current.slice(0,voice?7:8).map(e=>[e.id,e.title]);
 if(page.hasPrevious)rows.push(['PREVIOUS_EVIDENCE','Evidencias anteriores']);if(page.hasNext)rows.push(['NEXT_EVIDENCE','Más evidencias']);
 if(voice)rows.push(['MANUAL','Ingresar medición']);
 if(!rows.length){
  // The marker survives evidence selection, reason and confirmation; the signed
  // transport must retain this same deadline when it persists each new prompt.
  const deadline=state.progressEvidenceWait?.deadline||state.expiresAt;
  return choices({...state,step:'PROGRESS_EVIDENCE_WAIT',progressEvidenceWait:{version:1,deadline},expiresAt:deadline},eventId,'Esta tarea necesita evidencia revisada y aprobada antes de recibir una propuesta de avance. Conservamos tu medición y el plazo original mientras el responsable revisa la evidencia. Consultá la evidencia aprobada desde esta opción o cancelá el borrador. El avance no cambió.',[['RECHECK_EVIDENCE','Consultar evidencia'],['CANCEL','Cancelar']]);
 }
 const body=voice?(current.length?'Elegí el audio o video aprobado vigente de esta tarea.':'Esta página no tiene un borrador de audio o video vigente. Recorré las otras páginas o ingresá tu medición.'):'Elegí la evidencia aprobada que sustenta el avance. Podés recorrer todas las páginas.';
 return choices({...state,step:voice?'VOICE_EVIDENCE':'PROGRESS_EVIDENCE',evidencePage:page},eventId,body,rows);
}
const mediaNotice=(state,eventId)=>choices({...state,step:'MEDIA_NOTICE'},eventId,FIELD_MEDIA_PRIVACY_NOTICE,[['ANALYZE','Analizar y guardar'],['SAVE_ONLY','Sólo guardar'],['CANCEL','Cancelar']]);
export const META_FIELD_MEDIA_AUTHORIZATION_VERSION='field-channel-media-v2';
const mediaReferenceKeys=['version','eventId','payloadDigest','contextDigest','sourceProjectId','kind','mediaId','contentType','caption','receivedAt','expiresAt','taskId','taskRevision','sectorId'];
const mediaTypes={image:['image/jpeg','image/png','image/webp'],audio:['audio/ogg','audio/wav','audio/mpeg','audio/mp4','audio/webm'],video:['video/mp4','video/webm']};
const canonicalDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
// Shape, immutable context and TTL only; this predicate grants no current access.
export function validMetaFieldMediaReferenceContext(ref,{state,facts,now}={}){
 if(!ref||typeof ref!=='object'||Array.isArray(ref)||Object.keys(ref).sort().join('|')!==mediaReferenceKeys.slice().sort().join('|')||ref.version!==1||!['eventId','sourceProjectId','taskId','sectorId'].every(key=>workspaceId(ref[key]))||!['payloadDigest','contextDigest'].every(key=>/^[a-f0-9]{64}$/.test(ref[key]||''))||!/^\d{5,32}$/.test(ref.mediaId||'')||typeof ref.contentType!=='string'||ref.contentType.length>128||/[\x00-\x1f\x7f]/.test(ref.contentType)||!mediaTypes[ref.kind]?.includes(ref.contentType.toLowerCase().split(';')[0].trim())||typeof ref.caption!=='string'||!ref.caption.length||ref.caption.length>1000||typeof ref.taskRevision!=='string'||!canonicalDate(ref.receivedAt)||!canonicalDate(ref.expiresAt)||Date.parse(ref.expiresAt)-Date.parse(ref.receivedAt)!==900000||!(now instanceof Date)||!Number.isFinite(now.getTime())||Date.parse(ref.receivedAt)>now.getTime()||Date.parse(ref.expiresAt)<=now.getTime())return false;
 if(!state||state.mediaAuthorizationVersion!==META_FIELD_MEDIA_AUTHORIZATION_VERSION||ref.taskId!==state.taskId||ref.taskRevision!==state.taskRevision||ref.sectorId!==state.sectorId||ref.contextDigest!==facts?.mediaReferenceContext?.contextDigest||ref.sourceProjectId!==facts?.mediaReferenceContext?.sourceProjectId)return false;
 return true;
}
export function validMetaFieldMediaReference(ref,context={}){
 const {facts}=context;
 return validMetaFieldMediaReferenceContext(ref,context)&&facts.permissions?.report===true&&facts.tasks?.some(task=>task.id===ref.taskId&&task.revision===ref.taskRevision)&&facts.sectors?.some(sector=>sector.id===ref.sectorId);
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
function start(action,eventId,facts,now){
 if(['EXECUTION','OWN_EXECUTIONS'].includes(action)||action==='CONSUMPTION'&&hasMetaFieldExecutionMandate(facts,now))return planMetaFieldExecution({eventId,facts,now,action:action==='CONSUMPTION'?'EXECUTION':action});
 if(action==='MENU')return choices({step:'MENU',purpose:'MENU'},eventId,'ObraSaaS · '+facts.projectName+'\nElegí una acción disponible para tu participación. CANCELAR vuelve al menú.',availableMenu(facts));
 if(action==='PLAN_IMPORT')return startMetaPlanImportConversation({eventId,facts,now});
 if(action==='TASKS')return chooseTask({purpose:'TASKS'},eventId,facts);
 if(action==='STATUS'){const body=statusReply(facts);return facts.permissions.report===true?{...choices({purpose:'OWN_CONSUMPTIONS',step:'OWN_CONSUMPTION_STATUS',consumptionAfter:null},eventId,body,[['OWN_EVIDENCE','Mis evidencias'],['OWN_PROGRESS','Mis avances'],...(facts.ownConsumptions?[['OWN_CONSUMPTIONS','Mis consumos']]:[]),['MENU','Volver al menú']]),consumptionRead:Boolean(facts.ownConsumptions)}:{state:null,reply:text(body)};}
 if(action==='OWN_CONSUMPTIONS')return permits('REPORT',facts)?ownConsumptionList({},eventId,facts):denied('REPORT');
 if(ownReportPurposes.includes(action))return permits('REPORT',facts)?ownReportList({},eventId,facts,action):denied('REPORT');
 if(attendanceEvents[action]){if(!permits('ATTENDANCE',facts))return denied('ATTENDANCE');const error=journeyError(action,facts);if(error)return markMetaFieldDisclosure(choices({step:'MENU',purpose:'MENU'},eventId,journeyExplanation[error]+' No registramos otro fichaje. Elegí una acción disponible.',availableMenu(facts)),'ATTENDANCE');return chooseSector({purpose:'ATTENDANCE',eventType:attendanceEvents[action],expectedEventId:facts.latest?.id||null},eventId,facts);}
 if(!permits('REPORT',facts))return denied('REPORT');
 return chooseTask({purpose:action,...(action==='MEDIA'?{mediaAuthorizationVersion:META_FIELD_MEDIA_AUTHORIZATION_VERSION}:{})},eventId,facts);
}

// Only provider-authenticated messages enter this state machine. Interactive
// choices are single-context capabilities; free text never authorizes approval.
const canonicalPlanDisclosures=new WeakMap();
const recoveryCatalogPlans=new WeakSet();
export const metaFieldRecoveryCatalogPlan=plan=>recoveryCatalogPlans.has(plan);
const reportPurposes=new Set(['MEDIA','INCIDENT','MATERIAL','CONSUMPTION','PROGRESS','EXECUTION','OWN_EXECUTIONS','OWN_CONSUMPTIONS','OWN_EVIDENCE','OWN_PROGRESS']);
export function metaFieldPurposeDisclosure(purpose){if(purpose==='ATTENDANCE')return 'ATTENDANCE';if(reportPurposes.has(purpose))return 'REPORT';if(purpose==='PLAN_IMPORT')return 'PLAN_IMPORT';if(purpose==='MENU')return 'MENU';if(purpose==='TASKS')return 'GENERIC';return null;}
const menuActions=new Set(menuOptions.map(([action])=>action));
export function metaFieldMenuDisclosure(choices,base='MENU'){
 // Choices themselves reveal which journey transitions/catalog operations are
 // available. This union only adds capabilities to the canonical base. A role
 // requirement cannot be represented by these two flags, so fail closed rather
 // than turning a future PLAN_IMPORT menu into an ordinary report permission.
 if(!['MENU','WITHDRAWAL','GENERIC','ATTENDANCE','REPORT','MIXED'].includes(base)||!Array.isArray(choices)||!choices.length||choices.some(choice=>!menuActions.has(choice?.value)))return null;
 const attendance=['ATTENDANCE','MIXED'].includes(base)||choices.some(choice=>Object.hasOwn(attendanceEvents,choice.value)),report=['REPORT','MIXED'].includes(base)||choices.some(choice=>reportPurposes.has(choice.value));
 return attendance?(report?'MIXED':'ATTENDANCE'):report?'REPORT':base;
}
// This classification is produced by the canonical planner, never accepted in
// an inbound payload or inferred from translated/private reply text.
export const metaFieldPlanDisclosure=plan=>canonicalPlanDisclosures.get(plan)||null;
function markMetaFieldDisclosure(plan,disclosure){canonicalPlanDisclosures.set(plan,disclosure);return plan;}
function classifyPlan(input,plan){
 const {message,state,facts,now}=input,body=message.type==='text'?message.text?.body?.trim().toUpperCase():null,action=metaFieldConversationAction(body);
 const active=state?.version===1&&Date.parse(state.expiresAt)>now.getTime()?state:null;
 const selection=message.type==='interactive'?(message.interactive?.list_reply?.id||message.interactive?.button_reply?.id):null,match=/^obra:([a-f0-9]{20}):(\d{1,2})$/.exec(selection||'');
 const selected=active&&match&&match[1]===active.nonce?active.choices?.[Number(match[2])]?.value:null;
 let disclosure=canonicalPlanDisclosures.get(plan);
 if(!disclosure){
 if((body==='CANCELAR'||selected==='CANCEL')&&!plan.command&&(!plan.state||plan.state.purpose==='MENU'))disclosure='WITHDRAWAL';
 else if(action==='STATUS'||selected==='STATUS'||plan.state?.step==='OWN_CONSUMPTION_STATUS')disclosure=facts.permissions.attendance===true?(facts.permissions.report===true?'MIXED':'ATTENDANCE'):'REPORT';
 else if(action==='TASKS'||plan.state?.purpose==='TASKS')disclosure='GENERIC';
 else if(body==='HOLA'&&active?.purpose!=='MENU'&&plan.preserveConversation&&active?.purpose!=='PLAN_IMPORT')disclosure='GENERIC';
 else if(plan.command)disclosure=plan.command.action==='ATTENDANCE'?'ATTENDANCE':'REPORT';
 else if(plan.media||plan.reportRead||plan.consumptionRead)disclosure='REPORT';
 else if(plan.planImport)disclosure='PLAN_IMPORT';
 else if(selection&&!active)disclosure='GENERIC'; // Expired/stale choice feedback contains no old draft.
 else if(plan.state)disclosure=metaFieldPurposeDisclosure(plan.state.purpose);
 else if(action==='MENU')disclosure='MENU';
 else if(active)disclosure=metaFieldPurposeDisclosure(active.purpose);
 else if(action)disclosure='GENERIC'; // Friendly refusal with no private draft.
 }
 // Only an emitted general menu carries these choices. HOLA preserving a
 // private draft and stale-choice text feedback do not emit a new menu.
 if(plan.state?.purpose==='MENU'&&plan.reply?.type==='interactive')disclosure=metaFieldMenuDisclosure(plan.state.choices,disclosure);
 if(!disclosure)throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
 canonicalPlanDisclosures.set(plan,disclosure);return plan;
}
export function planMetaFieldConversation(input){const {message,state,eventId,facts,now}=input;
 const plan=planMetaFieldConversationInput({message,state,eventId,facts,now});return classifyPlan(input,plan);
}
function planMetaFieldConversationInput({message,state,eventId,facts,now}){
 try{return planConversation({message,state,eventId,facts,now});}
 catch(error){
  // Recover only the current input step. Identity, permission, revision and
  // backend errors retain their canonical handling in the signed bridge.
  if(state?.version!==1||!(Date.parse(state.expiresAt)>now.getTime()))throw error;
  const step=state.step;
  if(step==='MEASUREMENT_QUANTITY'&&(error.name==='TaskProgressMeasurementError'||error.code==='PROGRESS_MEASUREMENT_QUANTITY_INVALID'))return {state,reply:text('Ingresá sólo una cantidad exacta, con punto y hasta cuatro decimales. El total no puede superar la base ni ser menor al acumulado aprobado. Conservamos el borrador; escribí CANCELAR para volver al menú.')};
  if(step==='MEASUREMENT'&&['FIELD_QUANTITY_INVALID','PROGRESS_MEASUREMENT_QUANTITY_INVALID'].includes(error.code))return {state,reply:text(progressHint)};
  if(step==='CONSUMPTION_QUANTITY'&&error.code==='INVENTORY_QUANTITY_INVALID')return {state,reply:text('Ingresá una cantidad positiva con punto y hasta tres decimales. El borrador y el stock se conservan.')};
  const hint=step==='REASON'&&['MATERIAL','PROGRESS','CONSUMPTION'].includes(state.purpose)?'Escribí el motivo de 8 a '+(state.purpose==='MATERIAL'?2000:1000)+' caracteres.':inputHints[step];
  if(hint&&(error.code==='SITE_INPUT_INVALID'||step==='MATERIAL_QUANTITY'&&error.code==='SITE_QUANTITY_INVALID'))return {state,reply:text(hint+' El borrador se conserva. Corregí este dato para continuar, o escribí CANCELAR.')};
  throw error;
 }
}
function planConversation({message,state,eventId,facts,now}){
 const body=message.type==='text'?message.text?.body?.trim():null;
 const active=state?.version===1&&Date.parse(state.expiresAt)>now.getTime()?state:null;
 const alias=metaFieldConversationAction(body);
 if((alias==='TASKS'||!alias&&active?.purpose==='TASKS')&&facts.attendanceOnly)return limitedTaskRead(active);
 if(alias==='TASKS'&&active&&!['MENU','TASKS'].includes(active.purpose))return {state:active,preserveConversation:true,reply:text(scheduleReadBody(facts,'','\nConservamos el borrador y su mensaje original. Respondé a ese paso para continuar; esta consulta no guarda ni extrae otro archivo.'+(active.purpose==='PLAN_IMPORT'&&active.step==='PLAN_IMPORT_AUTHORIZED'?' El archivo ya fue autorizado: comprobá el mismo intento desde Cuenta.':'')))};
 // A greeting is a read, never a replacement prompt for an open draft.
 // Keep its exact nonce, expiry and durable origin; authorization is resolved
 // by the signed bridge and purpose permissions still gate continuation.
 if(body?.toUpperCase()==='HOLA'&&active&&active.purpose!=='MENU')return active.purpose==='PLAN_IMPORT'&&active.step==='PLAN_IMPORT_AUTHORIZED'?continueMetaPlanImportConversation({message,state:active,eventId,facts,now}):{state:active,preserveConversation:true,reply:text(permits(active.purpose,facts)?'Conservamos el borrador. Respondé al mensaje original del paso para continuar, o con CANCELAR para descartarlo.':'El permiso para este borrador cambió. Pedí al responsable que revise tus permisos. Conservamos el borrador; no registramos operaciones.')};
 if(alias==='STATUS'&&active&& !['MENU',...ownReadPurposes].includes(active.purpose))return {state:active,preserveConversation:true,consumptionRead:facts.permissions.report===true&&Boolean(facts.ownConsumptions),reply:text(statusReply(facts)+'\nConservamos el borrador. Para recorrer tus informes, cancelalo explícitamente con CANCELAR y abrí ESTADO → Mis evidencias, Mis avances o Mis consumos.')};
 if(alias==='OWN_CONSUMPTIONS'&&active&&!['MENU',...ownReadPurposes].includes(active.purpose))return {state:active,preserveConversation:true,reply:text('Conservamos el borrador actual. Escribí CANCELAR y abrí ESTADO → Mis consumos para consultar tus informes sin descartar un registro por accidente.')};
 if(ownReportPurposes.includes(alias)&&active&&!['MENU',...ownReadPurposes].includes(active.purpose))return {state:active,preserveConversation:true,reply:text('Conservamos el borrador actual. Escribí CANCELAR y abrí ESTADO → Mis evidencias o Mis avances para consultar tus informes sin descartar un registro por accidente.')};
 if(alias&&active?.purpose==='PROGRESS'&&active.progressEvidenceWait&&body?.toUpperCase()!=='CANCELAR')return {state:active,preserveConversation:true,reply:text('Conservamos la medición y el plazo original de tu avance. Respondé al mensaje vigente para continuar o escribí CANCELAR para descartar el borrador antes de iniciar otro registro.')};
 if(active?.purpose==='PLAN_IMPORT'){
  if(alias==='STATUS')return {...start('STATUS',eventId,facts,now),state:active,preserveConversation:true};
  if(active.step==='PLAN_IMPORT_AUTHORIZED')return continueMetaPlanImportConversation({message,state:active,eventId,facts,now});
  if(alias==='MENU'&&body?.toUpperCase()==='CANCELAR')return start('MENU',eventId,facts,now);
  if(alias)return {state:active,preserveConversation:true,reply:text('Conservamos el borrador del cronograma. Respondé al mensaje de ese paso para continuar, o con CANCELAR para descartarlo explícitamente.')};
  return continueMetaPlanImportConversation({message,state:active,eventId,facts,now});
 }
 if(facts.consumptionRecovery&&active?.purpose==='CONSUMPTION'&&body?.toUpperCase()!=='CANCELAR'){
  if(!permits('REPORT',facts))return denied('REPORT');
  if(alias==='CONSUMPTION'){
   const recovery=facts.consumptionRecovery,suggestion=recovery.suggestion,next={...active,consumptionRecovery:{version:1,id:recovery.id,deadline:recovery.deadline,contextDigest:recovery.contextDigest,rejectionReceiptId:recovery.lastError.receiptId},recoverySuggestion:suggestion,materialOffset:0};
   for(const key of ['materialId','name','unit','catalogHash','quantity','reason'])delete next[key];
   const plan=consumptionMaterials(next,eventId,facts);recoveryCatalogPlans.add(plan);return plan;
  }
  if(alias||active.consumptionRecovery?.rejectionReceiptId!==facts.consumptionRecovery.lastError.receiptId)return {state:active,preserveConversation:true,reply:text('Conservamos el consumo pendiente, su mensaje original y su plazo. Respondé a ese mensaje con CONSUMO para volver a elegir material y revisar cantidad y motivo, o CANCELAR para descartarlo.')};
 }
 if(active?.purpose==='EXECUTION'&&alias&&body?.toUpperCase()!=='CANCELAR')return {state:active,preserveConversation:true,reply:text('Conservamos el mismo hecho y sus cantidades. Respondé al mensaje vigente o escribí CANCELAR antes de empezar otro reporte.')};
 if(alias)return start(alias,eventId,facts,now);
 const selection=message.type==='interactive'?(message.interactive?.type==='list_reply'?message.interactive.list_reply?.id:message.interactive?.type==='button_reply'?message.interactive.button_reply?.id:null):null;
 let selected=null;
 if(selection){const match=/^obra:([a-f0-9]{20}):(\d{1,2})$/.exec(selection);if(!active||!match||match[1]!==active.nonce||!active.choices?.[Number(match[2])])return {state:active,...(active?.purpose==='PROGRESS'&&active.progressEvidenceWait?{preserveConversation:true}:{}),reply:text(active?.purpose==='PROGRESS'&&active.progressEvidenceWait?'Esta opción pertenece a un paso anterior. Conservamos el borrador; respondé al mensaje vigente para continuar o escribí CANCELAR para descartarlo.':'Esta opción pertenece a un paso anterior. Escribí MENU para volver a empezar.')};selected=active.choices[Number(match[2])].value;}
 if(!active)return start('MENU',eventId,facts,now);
 if(active.purpose!=='MENU'&&!permits(active.purpose,facts))return denied(active.purpose);
 const s={...active};delete s.choices;delete s.nonce;
 if(s.purpose==='PROGRESS'&&s.progressEvidenceWait){
  if(selected==='CANCEL')return {state:null,reply:text('Borrador de avance cancelado. La tarea no cambió. Escribí MENU para continuar.')};
  const fixed=s.progressEvidenceWait,task=facts.tasks.find(t=>t.id===s.taskId);
  if(fixed.version!==1||fixed.deadline!==s.expiresAt||!(Date.parse(fixed.deadline)>now.getTime()))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
  if(!task||task.revision!==s.taskRevision||(task.measurement?.definitionId||null)!==(s.measurementDefinitionId||null))return {state:active,preserveConversation:true,reply:text('La tarea o su medición aprobada cambió. Conservamos el borrador y no guardamos una propuesta. Cancelá este borrador para revisar la tarea vigente antes de informar otra medición.')};
 }
 if(s.sourceVoice&&!voiceProgressDraftReady(s.sourceVoice,facts.evidence.find(e=>e.id===s.sourceVoice.evidenceId),facts.tasks.find(t=>t.id===s.taskId)))return {state:active,reply:text('La tarea o el '+(s.sourceVoice.mediaKind==='video'?'video':'audio')+' cambió desde que preparaste el borrador. No guardamos una propuesta. Conservamos este paso; escribí AVANCE para revisar los registros vigentes o CANCELAR para volver al menú.')};
 if(s.purpose==='PROGRESS'&&s.measurementDefinitionId){const task=facts.tasks.find(t=>t.id===s.taskId);if(task?.revision!==s.taskRevision||task.measurement?.definitionId!==s.measurementDefinitionId)return {state:active,reply:text('La tarea o su medición aprobada cambió. Conservamos el borrador y no sumamos cantidades. Escribí AVANCE para consultar la base y el acumulado vigentes, o CANCELAR para volver al menú.')};}
 if(s.purpose==='PROGRESS'&&s.evidenceIds?.some(id=>!facts.evidence.some(e=>e.id===id&&e.taskId===s.taskId&&e.status==='APPROVED')))return {state:active,...(s.progressEvidenceWait?{preserveConversation:true}:{}),reply:text(s.progressEvidenceWait?'La evidencia elegida ya no está aprobada para esta tarea. Conservamos el borrador y no guardamos una propuesta. Escribí CANCELAR para descartarlo antes de preparar otra medición con la evidencia vigente.':'La evidencia elegida ya no está aprobada para esta tarea. Conservamos el borrador; escribí AVANCE para consultar los registros vigentes o CANCELAR para volver al menú. No guardamos una propuesta.')};
 if(s.step==='MENU')return selected?start(selected,eventId,facts,now):start('MENU',eventId,facts,now);
 if(['EXECUTION','OWN_EXECUTIONS'].includes(s.purpose)){
  if(selected==='MENU')return start('MENU',eventId,facts,now);
  const plan=planMetaFieldExecution({state:active,eventId,facts,now,selected,body});return plan.manualConsumption?chooseTask({purpose:'CONSUMPTION'},eventId,facts):plan;
 }
 if(s.step==='PROGRESS_EVIDENCE_WAIT')return selected==='RECHECK_EVIDENCE'?chooseEvidence(s,eventId,facts):{state:active,preserveConversation:true,reply:text('Elegí Consultar evidencia en el mensaje vigente para comprobar la evidencia aprobada, o Cancelar para descartar el borrador. Conservamos la medición y el plazo original; todavía no guardamos una propuesta.')};
 if(ownReportPurposes.includes(selected)&&ownReadPurposes.includes(s.purpose))return start(selected,eventId,facts,now);
 if(ownReportPurposes.includes(s.purpose)){
  if(['NEXT_REPORTS','FIRST_REPORTS'].includes(selected))return ownReportList(s,eventId,facts,s.purpose);
  if(selected==='MENU')return start('MENU',eventId,facts,now);
  if(selected&&s.step==='OWN_REPORT_LIST')return ownReportDetail(active,facts,selected);
  return {state:active,reply:text('Elegí un informe o una página en el mensaje vigente. Consultar no modifica la tarea.')};
 }
 if(s.purpose==='OWN_CONSUMPTIONS'){
  if(['OWN_CONSUMPTIONS','NEXT_CONSUMPTIONS','FIRST_CONSUMPTIONS','BACK_CONSUMPTIONS'].includes(selected))return ownConsumptionList(s,eventId,facts);
  if(selected==='MENU')return start('MENU',eventId,facts,now);
  if(selected&&s.step==='OWN_CONSUMPTION_LIST')return ownConsumptionDetail(active,eventId,facts,selected);
  return {state:active,reply:text('Elegí un informe o una página en el mensaje vigente. La consulta no modifica stock.')};
 }
 if(s.step==='TASK'){
  if(!selected)return {state:active,reply:text('Elegí una tarea en el menú anterior, o escribí CANCELAR.')};
  if(['NEXT_TASKS','PREVIOUS_TASKS'].includes(selected))return chooseTask(s,eventId,facts);
  s.taskId=selected==='NONE'?null:selected;const task=facts.tasks.find(t=>t.id===s.taskId);if(s.taskId&&!task)throw new WorkspaceError('WORKSPACE_TASK_UNAVAILABLE',404);s.taskRevision=task?.revision||null;
  if(s.purpose==='TASKS'){delete s.taskId;delete s.taskRevision;return chooseTask(s,eventId,facts,compactReadText(task.title,160)+'\n'+taskDates(task)+'\nEstado registrado: '+taskState(task)+'\nAvance registrado: '+taskProgress(task)+'.'+(task.measurement?'\nMetrado aprobado: '+voiceProgressQuantityLabel(task.measurement.executed)+' / '+voiceProgressQuantityLabel(task.measurement.baseline)+' '+voiceProgressUnitLabel(task.measurement.unit)+'.':'')+'\nEl avance cambia sólo después de la revisión del responsable.');}
  return chooseSector(s,eventId,facts);
 }
 if(s.step==='SECTOR'){
  if(['NEXT_SECTORS','PREVIOUS_SECTORS'].includes(selected))return chooseSector({...s,sectorOffset:Math.max(0,(s.sectorOffset||0)+(selected==='NEXT_SECTORS'?8:-8))},eventId,facts);
  if(!selected||!facts.sectors.some(x=>x.id===selected))return {state:active,reply:text('Elegí un sector en el menú anterior, o escribí CANCELAR.')};s.sectorId=selected;
  if(s.purpose==='ATTENDANCE'){
   if(['BREAK_START','BREAK_END'].includes(s.eventType))return confirm(s,eventId,s.eventType==='BREAK_START'?'¿Guardar el inicio de pausa?':'¿Guardar el regreso de pausa?');
   return choices({...s,step:'LOCATION_NOTICE'},eventId,'Para registrar entrada o salida usaremos la ubicación que compartas, vinculada a esta obra y su sector. WhatsApp no informa precisión GPS: el fichaje quedará para revisión humana. Podés usar la web para capturar precisión y QR. ¿Querés continuar?',[['ACCEPT','Continuar'],['CANCEL','Cancelar']]);
  }
  if(s.purpose==='MEDIA')return s.mediaAuthorizationVersion===META_FIELD_MEDIA_AUTHORIZATION_VERSION?mediaFilePrompt(s):mediaNotice(s,eventId);
  if(s.purpose==='CONSUMPTION')return consumptionMaterials(s,eventId,facts);
  if(s.purpose==='PROGRESS'){const rows=voiceEvidence(s,facts),video=includesVideo(rows),otherPages=facts.evidencePage?.hasNext||facts.evidencePage?.hasPrevious;return rows.length||otherPages?choices({...s,step:'PROGRESS_SOURCE'},eventId,'Podés buscar un borrador desde un audio o video ya aprobado o ingresar tu medición. '+(facts.tasks.find(t=>t.id===s.taskId)?.measurement?'Vas a confirmar si es del día o acumulada contra la base del responsable.':'La cantidad del día no se suma automáticamente.'),[['VOICE',!rows.length&&otherPages?'Buscar audio o video':video||otherPages?'Revisar audio o video':'Revisar audio aprobado'],['MANUAL','Ingresar medición']]):manualMeasurement(s,eventId,facts);}
  return {state:{...s,step:s.purpose==='INCIDENT'?'INCIDENT_TITLE':s.purpose==='MATERIAL'?'MATERIAL_NAME':'MEASUREMENT'},reply:text(s.purpose==='INCIDENT'?'Escribí un título breve para la incidencia.':s.purpose==='MATERIAL'?'Escribí el material que necesitás.':'Escribí el avance, por ejemplo 25%, o una cantidad como 2.5 / 10 M2. La tarea conservará su avance hasta que un responsable apruebe.')};
 }
 if(s.step==='PROGRESS_SOURCE'){
  if(selected==='MANUAL')return manualMeasurement(s,eventId,facts);
  const rows=voiceEvidence(s,facts),label=includesVideo(rows)?'audio o video':'audio';
  if(selected!=='VOICE')return {state:active,reply:text('Elegí el '+label+' aprobado o la medición manual en el menú anterior.')};
  return chooseEvidence(s,eventId,facts,true);
 }
 if(s.step==='VOICE_EVIDENCE'){
   if(['NEXT_EVIDENCE','PREVIOUS_EVIDENCE'].includes(selected))return chooseEvidence(s,eventId,facts,true);
   if(selected==='MANUAL')return manualMeasurement(s,eventId,facts);
  const rows=voiceEvidence(s,facts),evidence=rows.find(e=>e.id===selected);if(!evidence)return {state:active,reply:text('Elegí un '+(includesVideo(rows)?'audio o video':'audio')+' aprobado vigente del menú anterior.')};
  const task=facts.tasks.find(t=>t.id===s.taskId),draft=voiceProgressDraftForEvidence(evidence,task),prepared=prepareVoiceProgressDraft(evidence,task,facts.workerId);
  const video=evidence.media.kind==='video';
  return choices({...s,step:'VOICE_REVIEW',voiceCandidate:prepared.sourceVoice},eventId,'Borrador del audio'+(video?' del video':'')+' · Tarea elegida: '+task.title.slice(0,160)+'\nActividad: '+(draft.activity===UNKNOWN_VOICE_VALUE?'Sin identificar':draft.activity.slice(0,160))+'\nCantidad: '+voiceProgressQuantityLabel(draft.quantity)+' '+voiceProgressUnitLabel(draft.unit)+'\nAlcance: '+voiceQuantityScopeLabel(draft.quantitySemantics)+(task.measurement?'\nBase del responsable: '+voiceProgressQuantityLabel(task.measurement.baseline)+' '+voiceProgressUnitLabel(task.measurement.unit)+'. Elegirás el alcance y confirmarás la cantidad; el audio nunca suma ni aprueba por sí solo.':'\nLa base y el porcentaje están pendientes. Revisá que el '+(video?'video original, su audio':'audio')+' y la unidad correspondan a esta tarea. Ingresarás la medición acumulada; una cantidad del día no se suma automáticamente.'),[['USE','Revisé, completar'],['MANUAL','Medición manual']]);
 }
 if(s.step==='VOICE_REVIEW'){
  if(selected==='MANUAL'){delete s.voiceCandidate;return manualMeasurement(s,eventId,facts);}
  if(selected!=='USE')return {state:active,reply:text('Revisá el borrador y elegí una opción del menú anterior. Todavía no se guardó una propuesta.')};
  const sourceVoice={...s.voiceCandidate,confirmed:true},evidence=facts.evidence.find(e=>e.id===sourceVoice.evidenceId),task=facts.tasks.find(t=>t.id===s.taskId);
  if(!voiceProgressDraftReady(sourceVoice,evidence,task))return {state:active,reply:text('La tarea o el '+(sourceVoice.mediaKind==='video'?'video':'audio')+' cambió. Escribí AVANCE para consultar nuevamente; no se guardó una propuesta.')};
  delete s.voiceCandidate;return manualMeasurement({...s,sourceVoice},eventId,facts);
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
 if(s.step==='CONSUMPTION_MATERIAL'){if(selected==='NEXT'||selected==='PREVIOUS')return consumptionMaterials({...s,materialOffset:Math.max(0,(s.materialOffset||0)+(selected==='NEXT'?8:-8))},eventId,facts);const material=facts.inventory?.materials?.find(m=>m.id===selected&&m.active);if(!material)return {state:active,reply:text('Elegí un material del catálogo anterior.')};const next={...s,step:'CONSUMPTION_QUANTITY',materialId:material.id,name:material.name,unit:material.unit,catalogHash:facts.inventory.catalogHash};if(s.consumptionRecovery&&s.recoverySuggestion.unit===material.unit)return choices({...next,step:'CONSUMPTION_RECOVERY_QUANTITY'},eventId,'Material elegido: '+material.name+'\nUnidad: '+material.unit+'\nCantidad anterior sugerida: '+s.recoverySuggestion.quantity+' '+s.recoverySuggestion.unit+'. Elegí si corresponde usarla.',[['KEEP_QUANTITY','Usar cantidad anterior'],['NEW_QUANTITY','Escribir otra cantidad']]);return {state:next,reply:text('Material: '+material.name+'\nUnidad: '+material.unit+'\n'+(s.consumptionRecovery?'La unidad anterior era '+s.recoverySuggestion.unit+'. No convertimos la cantidad.\n':'')+'Escribí la cantidad consumida, con punto y hasta tres decimales.')};}
 if(s.step==='CONSUMPTION_RECOVERY_QUANTITY'){if(selected==='NEW_QUANTITY')return {state:{...s,step:'CONSUMPTION_QUANTITY'},reply:text('Escribí la cantidad consumida en '+s.unit+', con punto y hasta tres decimales.')};if(selected!=='KEEP_QUANTITY'||s.unit!==s.recoverySuggestion.unit)return {state:active,reply:text('Elegí una cantidad desde el mensaje vigente.')};s.quantity=inventoryQuantity(s.recoverySuggestion.quantity);return consumptionReasonPrompt(s,eventId);}
 if(s.step==='CONSUMPTION_QUANTITY'){s.quantity=inventoryQuantity(body);return consumptionReasonPrompt(s,eventId);}
 if(s.step==='CONSUMPTION_RECOVERY_REASON'){if(selected==='NEW_REASON')return {state:{...s,step:'REASON'},reply:text('Escribí el motivo vigente, de 8 a 1000 caracteres.')};if(selected!=='KEEP_REASON')return {state:active,reply:text('Elegí el motivo desde el mensaje vigente.')};s.reason=siteText(s.recoverySuggestion.reason,1000,8,true);return consumptionConfirmation(s,eventId);}
 if(s.step==='MEASUREMENT_SCOPE'){
  if(!['DELTA','CUMULATIVE'].includes(selected))return {state:active,reply:text('Elegí Realizado hoy o Total acumulado en el menú anterior.')};
  const task=facts.tasks.find(t=>t.id===s.taskId);
  return {state:{...s,step:'MEASUREMENT_QUANTITY',measurementMode:selected},reply:text('Escribí sólo la cantidad '+(selected==='DELTA'?'adicional de este reporte':'total acumulada')+' en '+voiceProgressUnitLabel(task.measurement.unit)+', por ejemplo 50 o 2.5. Usá punto y hasta cuatro decimales. La base y la unidad ya las definió el responsable.')};
 }
 if(s.step==='MEASUREMENT_QUANTITY'){
  const task=facts.tasks.find(t=>t.id===s.taskId),derived=deriveTaskMeasurement(task,{mode:s.measurementMode,quantity:body});
  Object.assign(s,{measurement:{mode:derived.mode,quantity:derived.reported},measurementSummary:derived,progress:derived.progress,quantity:derived.executed,baseline:derived.baseline,unit:derived.unit});
  if(s.sourceVoice)return {state:{...s,step:'REASON',evidenceIds:[s.sourceVoice.evidenceId]},reply:text('Explicá cómo verificaste esta medición. El audio aprobado quedará vinculado; la cantidad requiere confirmación y revisión independiente.')};
  return chooseEvidence(s,eventId,facts);
 }
 if(s.step==='MEASUREMENT'){
  const percent=/^(100|\d{1,2})%$/.exec(body||''),quantity=/^(\d+(?:\.\d{1,4})?)\s*\/\s*(\d+(?:\.\d{1,4})?)\s+(M|M2|M3|KG|T|L|UNIT|HOUR|DAY|LOT)$/i.exec(body||'');
  if(percent)Object.assign(s,{progress:Number(percent[1]),quantity:null,baseline:null,unit:null});
  else if(quantity){const value=normalizeProgressMeasurementQuantity(quantity[1]),baseline=normalizeProgressMeasurementQuantity(quantity[2],{allowZero:false});if(parseProgressMeasurementQuantity(value)>parseProgressMeasurementQuantity(baseline))throw new WorkspaceError('FIELD_QUANTITY_INVALID');Object.assign(s,{progress:Number(parseProgressMeasurementQuantity(value)*100n/parseProgressMeasurementQuantity(baseline)),quantity:value,baseline,unit:quantity[3].toUpperCase()});}
  else return {state:active,reply:text(progressHint)};
  if(s.sourceVoice)return {state:{...s,step:'REASON',evidenceIds:[s.sourceVoice.evidenceId]},reply:text('Explicá cómo verificaste la medición acumulada de esta tarea. El audio aprobado quedará vinculado; la propuesta sigue pendiente de confirmación.')};
  return chooseEvidence(s,eventId,facts);
 }
 if(s.step==='PROGRESS_EVIDENCE'){if(['NEXT_EVIDENCE','PREVIOUS_EVIDENCE'].includes(selected))return chooseEvidence(s,eventId,facts);if(!selected||!facts.evidence.some(e=>e.id===selected&&e.taskId===s.taskId&&e.status==='APPROVED'))return {state:active,...(s.progressEvidenceWait?{preserveConversation:true}:{}),reply:text(s.progressEvidenceWait?'Elegí una evidencia aprobada del mensaje vigente. Conservamos la medición; si la evidencia cambió, escribí CANCELAR antes de preparar otro borrador.':'Elegí una evidencia aprobada vigente del menú anterior. Si cambió, escribí AVANCE para consultar nuevamente.')};s.evidenceIds=[selected];return {state:{...s,step:'REASON'},reply:text('Explicá cómo mediste el avance o la cantidad ejecutada.')};}
 if(s.step==='REASON'){s.reason=siteText(body,s.purpose==='MATERIAL'?2000:1000,8,true);const m=s.measurementSummary;return confirm(s,eventId,(s.purpose==='MATERIAL'?'Pedido: '+s.quantity+' '+s.unit+' de '+s.name+'\nEsto no autoriza una compra.':s.purpose==='CONSUMPTION'?'Consumo propuesto: '+s.quantity+' '+s.unit+' de '+s.name+'\nEl stock se conserva hasta revisión del responsable.':m?'Acumulado aprobado: '+voiceProgressQuantityLabel(m.previous)+' '+voiceProgressUnitLabel(m.unit)+'\nAdicional propuesto: '+voiceProgressQuantityLabel(m.delta)+' '+voiceProgressUnitLabel(m.unit)+'\nNuevo acumulado: '+voiceProgressQuantityLabel(m.executed)+' / '+voiceProgressQuantityLabel(m.baseline)+' '+voiceProgressUnitLabel(m.unit)+' · '+m.progress+'%\nLa tarea conserva su avance hasta aprobación.':'Avance propuesto: '+s.progress+'%'+(s.quantity!==null?' · '+s.quantity+' / '+s.baseline+' '+s.unit:'')+'\nLa tarea conserva su avance hasta aprobación.')+'\nMotivo: '+s.reason.slice(0,550)+(s.reason.length>550?'…':'')+'\n¿Guardar para revisión?');}
 if(s.step==='CONFIRM'){
  if(selected==='CANCEL')return {state:null,reply:text('Operación cancelada. Escribí MENU para continuar.')};
  if(selected!=='CONFIRM')return {state:active,reply:text('Elegí Guardar o Cancelar en el menú anterior.')};
  if(s.purpose==='ATTENDANCE')return {state:null,command:{action:'ATTENDANCE',payload:{workerId:facts.workerId,eventType:s.eventType,expectedEventId:s.expectedEventId,sectorId:s.sectorId,qrToken:null,location:s.location||null}}};
  if(s.purpose==='INCIDENT')return {state:null,command:{action:'REPORT_INCIDENT',payload:{workerId:facts.workerId,taskId:s.taskId,sectorId:s.sectorId,title:s.title,description:s.description,severity:s.severity,evidenceIds:[]}}};
  if(s.purpose==='MATERIAL')return {state:null,command:{action:'REQUEST_MATERIAL',payload:{workerId:facts.workerId,taskId:s.taskId,sectorId:s.sectorId,name:s.name,quantity:s.quantity,unit:s.unit,reason:s.reason,evidenceIds:[]}}};
  if(s.purpose==='CONSUMPTION')return {state:null,command:{action:'PROPOSE_CONSUMPTION',payload:{workerId:facts.workerId,taskId:s.taskId,sectorId:s.sectorId,materialId:s.materialId,catalogHash:s.catalogHash,quantity:s.quantity,reason:s.reason}}};
  if(s.purpose==='PROGRESS')return {state:null,command:{action:'PROPOSE_PROGRESS',payload:s.measurement?{workerId:facts.workerId,taskId:s.taskId,revision:s.taskRevision,measurement:s.measurement,reason:s.reason,evidenceIds:s.evidenceIds}:{workerId:facts.workerId,taskId:s.taskId,revision:s.taskRevision,progress:s.progress,quantity:s.quantity,baseline:s.baseline,unit:s.unit,reason:s.reason,evidenceIds:s.evidenceIds}}};
 }
 return start('MENU',eventId,facts,now);
}
