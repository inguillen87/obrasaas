const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
export const TEMPLATE_SEND_KEY='open_attendance_reminder';
export const PROGRESS_TEMPLATE_SEND_KEY='progress_review_notification';
export const TEMPLATE_SEND_KEYS=Object.freeze([TEMPLATE_SEND_KEY,PROGRESS_TEMPLATE_SEND_KEY]);
const revision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value);
export function templateSendActionReference(value){return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')==='proposalId|revision'&&id(value.proposalId)&&revision(value.revision));}
const sameReference=(left,right)=>templateSendActionReference(left)&&templateSendActionReference(right)&&left.proposalId===right.proposalId&&left.revision===right.revision;
const invalid=()=>{throw new Error('No se pudo comprobar el resultado de esta obra. Conservá el intento y consultá su recibo.');};
export function templateSendSnapshot(value,{projectId,scope,templateKey=TEMPLATE_SEND_KEY}){
 if(!TEMPLATE_SEND_KEYS.includes(templateKey)||value?.projectId!==projectId||value.scope!==scope||typeof value.projectName!=='string'||typeof value.canSend!=='boolean'||value.template?.key!==templateKey||typeof value.template.bodyText!=='string'||typeof value.template.title!=='string'||typeof value.template.canSend!=='boolean'||!Array.isArray(value.records)||value.records.length>200)return invalid();
 const seen=new Set();for(const row of value.records){if(!id(row.workerId)||seen.has(row.workerId)||typeof row.name!=='string'||typeof row.eligible!=='boolean')return invalid();seen.add(row.workerId);}
 if(templateKey===PROGRESS_TEMPLATE_SEND_KEY){if(!Array.isArray(value.proposals)||value.proposals.length>20)return invalid();const proposals=new Set();for(const row of value.proposals){if(!templateSendActionReference({proposalId:row?.proposalId,revision:row?.revision})||proposals.has(row.proposalId)||typeof row.title!=='string'||!row.title.trim()||!Array.isArray(row.eligibleWorkerIds)||row.eligibleWorkerIds.length>value.records.length||new Set(row.eligibleWorkerIds).size!==row.eligibleWorkerIds.length||row.eligibleWorkerIds.some(workerId=>!value.records.some(worker=>worker.workerId===workerId&&worker.eligible)))return invalid();proposals.add(row.proposalId);}}
 else if(value.proposals!==undefined&&(!Array.isArray(value.proposals)||value.proposals.length))return invalid();
 if(value.recent!==undefined){if(!Array.isArray(value.recent)||value.recent.length>20)return invalid();for(const result of value.recent){if(!result.receipt||!id(result.receipt.workerId)||typeof result.receipt.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.receipt.operationId))return invalid();templateSendResult(result,{...value,templateKey,workerId:result.receipt.workerId,operationId:result.receipt.operationId,...(templateKey===PROGRESS_TEMPLATE_SEND_KEY?{actionReference:result.receipt.actionReference}:{})});}}
 return value;
}
export function templateSendResult(value,command){
 const templateKey=command.templateKey||TEMPLATE_SEND_KEY;if(!TEMPLATE_SEND_KEYS.includes(templateKey)||templateKey===PROGRESS_TEMPLATE_SEND_KEY&&!templateSendActionReference(command.actionReference)||templateKey===TEMPLATE_SEND_KEY&&command.actionReference!==undefined||value?.projectId!==command.projectId||value.scope!==command.scope||typeof value.definitive!=='boolean'||typeof value.providerAccepted!=='boolean'||typeof value.deliveryConfirmed!=='boolean')return invalid();
 if(value.state==='NOT_OBSERVED'){if(value.definitive!==false||value.providerAccepted||value.deliveryConfirmed||value.receipt!=null||value.saved===true)return invalid();return value;}
 if(value.receipt?.operationId!==command.operationId||value.receipt.workerId!==command.workerId||value.receipt.templateKey!==templateKey||typeof value.receipt.id!=='string'||!value.receipt.id||templateKey===PROGRESS_TEMPLATE_SEND_KEY&&!sameReference(value.receipt.actionReference,command.actionReference)||templateKey===TEMPLATE_SEND_KEY&&value.receipt.actionReference!==undefined)return invalid();
 if(['SEND_STARTED','SEND_UNKNOWN'].includes(value.state)){if(value.definitive||value.saved||value.deliveryConfirmed)return invalid();return value;}
 if(value.state==='ACCEPTED'){if(!value.definitive||!value.saved||!value.providerAccepted||value.deliveryConfirmed)return invalid();return value;}
 if(value.state==='REJECTED'){if(!value.definitive||value.saved||value.providerAccepted||value.deliveryConfirmed)return invalid();return value;}
 if(value.state==='STATUS_OBSERVED'){if(!value.definitive||!value.saved||!['sent','delivered','read','failed','deleted'].includes(value.providerStatus)||value.deliveryConfirmed!==['delivered','read'].includes(value.providerStatus))return invalid();return value;}
 return invalid();
}
export function templateSendNotice(value){
 const progress=value.receipt?.templateKey===PROGRESS_TEMPLATE_SEND_KEY,boundary=progress?'Eso no aprueba la propuesta ni modifica tareas o el Gantt.':'Eso no registra la salida ni modifica la jornada.';
 if(value.state==='NOT_OBSERVED')return 'Todavía no se observa el recibo. Conservamos la referencia; no se genera otro envío automáticamente.';
 if(['SEND_STARTED','SEND_UNKNOWN'].includes(value.state))return 'El envío quedó sin confirmar. Consultá este mismo intento; no se repite la solicitud a Meta.';
 if(value.state==='REJECTED'&&value.code==='WORKER_TEMPLATE_CONSENT_NOTICE_CHANGED')return 'No se envió el mensaje. El trabajador debe revisar y aceptar el aviso actualizado de la empresa desde Mi WhatsApp y autorización de avisos.';
 if(value.state==='REJECTED')return value.code==='META_CUSTOMER_PROVIDER_REJECTED'?'Meta rechazó el envío. No se confirmó la entrega; revisá el canal y la plantilla antes de preparar otra solicitud.':progress?'Se detuvo el envío antes de confirmarlo. Revisá la propuesta pendiente, el revisor, la autorización y la aprobación de la plantilla antes de preparar otra solicitud.':'Se detuvo el envío antes de confirmarlo. Revisá la jornada, la autorización y la aprobación de la plantilla antes de preparar otra solicitud.';
 if(['failed','deleted'].includes(value.providerStatus))return 'Meta informó que el mensaje falló o fue eliminado. El recibo conserva ese resultado; no se reenvía automáticamente.';
 if(value.deliveryConfirmed)return (value.providerStatus==='read'?'Meta informó lectura del mensaje. ':'Meta informó entrega del mensaje. ')+boundary;
 return 'Meta aceptó el mensaje. La entrega todavía no está confirmada; '+(progress?'esto no aprueba la propuesta ni modifica tareas o el Gantt.':'esto no registra la salida ni modifica la jornada.');
}
