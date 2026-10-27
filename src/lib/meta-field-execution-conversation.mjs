import {digest,WorkspaceError} from './workspace-policy.mjs';
import {inventoryQuantity} from './material-inventory.mjs';
import {parseProcurementQuantity} from './procurement-quantity.js';
import {siteText} from './site-register-policy.mjs';
import {deriveTaskMeasurement} from './task-progress-measurement.js';
import {normalizeExecutionPayload} from './field-execution-policy.mjs';
import {parseProgressMeasurementQuantity} from './progress-measurement-quantity.js';

const text=body=>({type:'text',body});
const uuid=value=>{const h=digest(value);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
function choices(state,eventId,body,rows){const nonce=digest([eventId,state.step]).slice(0,20);return {state:{...state,nonce,choices:rows.map(([value,title])=>({value,title}))},reply:{type:'interactive',body,button:'Elegir',sections:[{title:'Opciones',rows:rows.map(([,title],index)=>({id:`obra:${nonce}:${index}`,title:title.slice(0,24)}))}]}};}
const taskFor=(facts,id)=>facts.executionTasks?.find(task=>task.id===id);
const liveMandates=(facts,now)=>(facts.execution?.mandates||[]).filter(m=>m.state==='ACTIVE'&&m.workerId===facts.workerId&&Date.parse(m.validUntil)>now.getTime()&&m.catalogHash===facts.inventory?.catalogHash);
export const hasMetaFieldExecutionMandate=(facts,now)=>liveMandates(facts,now).length>0;
const unchanged=(state,body)=>({state,preserveConversation:true,reply:text(body)});
function mandatePage(state,eventId,facts,now){
 const all=liveMandates(facts,now),offset=Math.min(state.offset||0,Math.max(0,Math.floor((all.length-1)/7)*7)),rows=all.slice(offset,offset+7).map(m=>[m.id,(taskFor(facts,m.taskId)?.title||'Tarea autorizada')+' · '+m.validUntil.slice(0,10)]);
 if(offset)rows.push(['PREVIOUS','Mandatos anteriores']);if(offset+7<all.length)rows.push(['NEXT','Más mandatos']);rows.push(['MANUAL','Proponer sin mandato']);
 if(!all.length)return {state:null,reply:text('No hay un mandato vigente de tu cuenta para el catálogo actual. Pedí al administrador o director que autorice trabajador, tarea, sector, materiales y cupos en Mi cuenta. No se descontó stock. CONSUMO conserva la propuesta manual.')};
 return choices({...state,purpose:'EXECUTION',step:'EXECUTION_MANDATE',offset},eventId,'Registrar uso de material bajo autorización previa. Elegí el mandato de esta tarea. Confirmar cantidades registrará una salida real de stock.'+(facts.execution.mandatesTruncated?' La consulta de mandatos es parcial.':''),rows);
}
function quantityPrompt(state,facts){const material=state.materials[state.materialIndex],label=facts.inventory.materials.find(row=>row.id===material.materialId)?.name||'Material autorizado';return {state:{...state,step:'EXECUTION_QUANTITY'},reply:text(label+' · '+material.unit+'\nMáximo por reporte: '+material.maxPerReport+' '+material.unit+'.\nEscribí la cantidad exacta que usaste con punto y hasta tres decimales. Escribí 0 si no usaste este material. No convertimos unidades ni inferimos consumo.')};}
function progressPrompt(state,eventId,facts){
 const task=taskFor(facts,state.taskId),m=state.progressAllowance;
 if(!m||!task?.measurement||['definitionId','baseline','unit'].some(key=>m[key]!==task.measurement[key]))return {state:{...state,step:'EXECUTION_REASON',progress:null,evidenceIds:[]},reply:text('Explicá para qué se usaron los materiales (8 a 1000 caracteres). El registro descontará stock; no modificará el avance de la tarea.')};
 return choices({...state,step:'EXECUTION_PROGRESS'},eventId,'La tarea tiene base autorizada de '+m.baseline+' '+m.unit+'. Acumulado actual: '+task.measurement.executed+' '+m.unit+'.\n¿Informás además una cantidad ejecutada de esta tarea con evidencia ya aprobada? El material usado no determina el porcentaje.',[['STOCK_ONLY','Sólo materiales'],['MEASURED','Informar cantidad']]);
}
function evidencePage(state,eventId,facts){
 const all=(facts.executionEvidence||[]).filter(e=>e.taskId===state.taskId&&e.workerId===facts.workerId&&e.sectorId===state.sectorId&&e.status==='APPROVED'),offset=Math.min(state.evidenceOffset||0,Math.max(0,Math.floor((all.length-1)/7)*7)),rows=all.slice(offset,offset+7).map(e=>[e.id,e.title]);
 if(offset)rows.push(['PREVIOUS','Evidencias anteriores']);if(offset+7<all.length)rows.push(['NEXT','Más evidencias']);rows.push(['STOCK_ONLY','Sólo materiales']);
 return choices({...state,step:'EXECUTION_EVIDENCE',evidenceOffset:offset},eventId,all.length?'Elegí la evidencia de esta cuenta, tarea y sector que ya fue aprobada.':'No hay evidencia aprobada en esta consulta. Podés registrar sólo materiales; para actualizar avance, pedí revisión de la evidencia y volvé a consultar el mismo borrador.',rows);
}
function receiptPage(state,eventId,facts){const all=(facts.execution?.receipts||[]).filter(row=>row.action==='REPORT_EXECUTION'),offset=Math.min(state.offset||0,Math.max(0,Math.floor((all.length-1)/7)*7)),rows=all.slice(offset,offset+7).map(row=>[row.receiptId,(row.execution?.recordedAt||'').slice(0,10)+' · '+(taskFor(facts,row.execution?.taskId)?.title||'Uso registrado')]);if(offset)rows.push(['PREVIOUS','Recibos anteriores']);if(offset+7<all.length)rows.push(['NEXT','Más recibos']);rows.push(['MENU','Volver al menú']);return choices({...state,purpose:'OWN_EXECUTIONS',step:'EXECUTION_RECEIPTS',offset},eventId,'Salidas de materiales registradas por tu cuenta.'+(!all.length?' No hay recibos en esta consulta.':' Elegí un recibo para consultar sus cantidades y avance registrado.')+(facts.execution?.receiptsTruncated?' Se muestran las últimas 100 operaciones.':''),rows);}
export function metaFieldExecutionAcknowledgement(outcome,projectName){const e=outcome.execution;return 'Materiales registrados en '+projectName.slice(0,40)+'.\n'+(outcome.executionReplay?'Este hecho ya estaba registrado; no hubo otro descuento.\n':'')+e.movements.map(row=>row.quantity+' '+row.unit+' · salida registrada').join('\n')+'\nHecho: '+e.reportId+'\nRecibo: '+outcome.receiptId+'\n'+(e.measurement?'Cantidad ejecutada registrada: '+e.measurement.executed+' / '+e.measurement.baseline+' '+e.measurement.unit+' · '+e.measurement.progress+'%.':'El avance de la tarea se conservó.')+'\nEscribí EJECUCIONES para consultar tus recibos.';}

// Exact reported facts only. The store freshly proves authorization, quotas,
// stock, KYC, evidence and revisions. This planner cannot grant a mandate.
export function planMetaFieldExecution({state=null,eventId,facts,now,selected=null,body=null,action=null}){
 if(facts.permissions.report!==true||facts.attendanceOnly)return {state:null,reply:text('Tu participación no tiene habilitado registrar uso de materiales. Pedí al responsable que revise tu acceso. No se cambió stock.')};
 if(action==='OWN_EXECUTIONS')return receiptPage({},eventId,facts);
 if(action==='EXECUTION')return mandatePage({},eventId,facts,now);
 if(state?.purpose==='OWN_EXECUTIONS'){
  if(selected==='NEXT'||selected==='PREVIOUS')return receiptPage({...state,offset:Math.max(0,(state.offset||0)+(selected==='NEXT'?7:-7))},eventId,facts);
  const receipt=facts.execution?.receipts.find(row=>row.receiptId===selected&&row.action==='REPORT_EXECUTION');if(receipt)return unchanged(state,metaFieldExecutionAcknowledgement(receipt,facts.projectName));return unchanged(state,'Elegí un recibo o una página en el mensaje vigente. Consultar no mueve stock.');
 }
 const s={...state};delete s.nonce;delete s.choices;
 if(s.step==='EXECUTION_MANDATE'){
  if(selected==='NEXT'||selected==='PREVIOUS')return mandatePage({...s,offset:Math.max(0,(s.offset||0)+(selected==='NEXT'?7:-7))},eventId,facts,now);
  if(selected==='MANUAL')return {manualConsumption:true};
  const mandate=liveMandates(facts,now).find(m=>m.id===selected),task=mandate&&taskFor(facts,mandate.taskId);if(!mandate||!task)return unchanged(state,'El mandato o su tarea ya no está disponible. No se descontó stock. Escribí CANCELAR para revisar el estado vigente.');
  return quantityPrompt({...s,mandateId:mandate.id,mandateRevision:mandate.revision,taskId:task.id,taskRevision:task.revision,sectorId:mandate.sectorId,catalogHash:mandate.catalogHash,materials:mandate.materials,materialIndex:0,lines:[],reportId:uuid(['meta-field-execution-fact-v1',facts.workerId,eventId]),progressAllowance:mandate.progress,executionDeadline:new Date(now.getTime()+900000).toISOString()},facts);
 }
 const mandate=liveMandates(facts,now).find(m=>m.id===s.mandateId),task=taskFor(facts,s.taskId);
 if(!mandate||mandate.revision!==s.mandateRevision||!task||task.revision!==s.taskRevision||Date.parse(s.executionDeadline)<=now.getTime())return unchanged(state,'El mandato, la tarea o el plazo cambió. Conservamos este borrador y no descontamos stock. Cancelalo para consultar el estado vigente antes de informar otro hecho.');
 if(s.step==='EXECUTION_QUANTITY'){
  let quantity;try{quantity=inventoryQuantity(body,{allowZero:true});}catch{return unchanged(state,'Ingresá una cantidad decimal exacta con punto y hasta tres decimales, o 0 si no usaste este material. Conservamos el borrador.');}
  const material=s.materials[s.materialIndex],amount=parseProcurementQuantity(quantity,{allowZero:true}),used=parseProcurementQuantity(mandate.materials.find(row=>row.materialId===material.materialId).used,{allowZero:true});if(amount>parseProcurementQuantity(material.maxPerReport)||amount+used>parseProcurementQuantity(material.limit))return unchanged(state,'La cantidad supera el cupo vigente de este mandato. Corregí la cantidad real; no se descontó stock.');
  if(amount)s.lines=[...s.lines,{lineId:'line_'+digest([s.reportId,material.materialId]).slice(0,32),materialId:material.materialId,unit:material.unit,quantity}];s.materialIndex++;
  if(s.materialIndex<s.materials.length)return quantityPrompt(s,facts);
  if(!s.lines.length)return {state:null,reply:text('No informaste materiales usados. No se registró una salida ni se modificó la tarea.')};return progressPrompt(s,eventId,facts);
 }
 if(s.step==='EXECUTION_PROGRESS'){
  if(selected==='STOCK_ONLY')return {state:{...s,step:'EXECUTION_REASON',progress:null,evidenceIds:[]},reply:text('Explicá para qué se usaron los materiales. El avance de la tarea se conservará.')};
  if(selected!=='MEASURED')return unchanged(state,'Elegí Sólo materiales o Informar cantidad en el mensaje vigente.');return {state:{...s,step:'EXECUTION_MEASUREMENT'},reply:text('Base autorizada: '+s.progressAllowance.baseline+' '+s.progressAllowance.unit+'.\nEscribí sólo la cantidad adicional ejecutada de esta tarea, con punto y hasta cuatro decimales. No deducimos avance de los materiales.')};
 }
 if(s.step==='EXECUTION_MEASUREMENT'){
  let derived;try{derived=deriveTaskMeasurement(task,{mode:'DELTA',quantity:body});}catch{return unchanged(state,'Ingresá una cantidad exacta positiva con hasta cuatro decimales dentro de la base y el cupo autorizados. Conservamos el borrador.');}
  const allowance=mandate.progress,delta=parseProgressMeasurementQuantity(derived.delta);if(!allowance||delta>parseProgressMeasurementQuantity(allowance.maxPerReport)||parseProgressMeasurementQuantity(allowance.used)+delta>parseProgressMeasurementQuantity(allowance.limit))return unchanged(state,'La cantidad medida supera el cupo vigente de avance. Corregí la cantidad real en este mismo borrador; todavía no se modificaron stock ni tarea.');
  s.progress={definitionId:derived.definitionId,baseline:derived.baseline,unit:derived.unit,mode:'DELTA',quantity:derived.reported};s.measurementSummary=derived;return evidencePage(s,eventId,facts);
 }
 if(s.step==='EXECUTION_EVIDENCE'){
  if(selected==='STOCK_ONLY')return {state:{...s,step:'EXECUTION_REASON',progress:null,evidenceIds:[]},reply:text('Explicá para qué se usaron los materiales. El avance de la tarea se conservará.')};
  if(selected==='NEXT'||selected==='PREVIOUS')return evidencePage({...s,evidenceOffset:Math.max(0,(s.evidenceOffset||0)+(selected==='NEXT'?7:-7))},eventId,facts);
  if(!facts.executionEvidence?.some(e=>e.id===selected&&e.taskId===s.taskId&&e.workerId===facts.workerId&&e.sectorId===s.sectorId&&e.status==='APPROVED'))return evidencePage(s,eventId,facts);return {state:{...s,step:'EXECUTION_REASON',evidenceIds:[selected]},reply:text('Explicá cómo verificaste el uso de materiales y la cantidad ejecutada. Se conservará la evidencia aprobada elegida.')};
 }
 if(s.step==='EXECUTION_REASON'){
  try{s.reason=siteText(body,1000,8,true);}catch{return unchanged(state,'Escribí el motivo de 8 a 1000 caracteres. Conservamos las cantidades y el borrador.');}
  const head='Confirmar registra una salida real de stock bajo el mandato elegido.\n',tail='\n'+(s.progress?'Cantidad adicional: '+s.progress.quantity+' '+s.progress.unit+' sobre base '+s.progress.baseline+'.\nNuevo acumulado: '+s.measurementSummary.executed+' · '+s.measurementSummary.progress+'%.':'La tarea conserva su avance.')+'\nMotivo: '+s.reason.slice(0,80)+'\n¿Registrar este mismo hecho?',limit=Number.isSafeInteger(facts.replyBodyLimit)?facts.replyBodyLimit:1024;
  let summary='';for(const size of [24,16,8,0]){summary=s.lines.map((row,index)=>(index+1)+'. '+(size?(facts.inventory.materials.find(m=>m.id===row.materialId)?.name||'Material').slice(0,size)+' · ':'')+row.quantity+' '+row.unit).join('\n');if(head.length+summary.length+tail.length<=limit)break;}
  if(head.length+summary.length+tail.length>limit)throw new WorkspaceError('FIELD_EXECUTION_CONFIRMATION_TOO_LONG',409);
  return choices({...s,step:'EXECUTION_CONFIRM'},eventId,head+summary+tail,[['CONFIRM','Registrar salida'],['CANCEL','Cancelar']]);
 }
 if(s.step==='EXECUTION_CONFIRM'){
  if(selected==='CANCEL')return {state:null,reply:text('Reporte cancelado. El stock y la tarea se conservaron.')};if(selected!=='CONFIRM')return unchanged(state,'Elegí Registrar salida o Cancelar en el mensaje vigente.');
  const payload=normalizeExecutionPayload('REPORT_EXECUTION',{reportId:s.reportId,mandateId:s.mandateId,mandateRevision:s.mandateRevision,workerId:facts.workerId,taskId:s.taskId,taskRevision:s.taskRevision,sectorId:s.sectorId,catalogHash:s.catalogHash,lines:s.lines,progress:s.progress,evidenceIds:s.evidenceIds,reason:s.reason});
  if(s.progress&&!s.evidenceIds.every(id=>facts.executionEvidence?.some(e=>e.id===id&&e.status==='APPROVED'&&e.taskId===s.taskId&&e.workerId===facts.workerId&&e.sectorId===s.sectorId)))throw new WorkspaceError('FIELD_EVIDENCE_NOT_APPROVED',409);
  return {state:null,command:{action:'REPORT_EXECUTION',payload}};
 }
 return unchanged(state,'Respondé al paso vigente para continuar o escribí CANCELAR.');
}
