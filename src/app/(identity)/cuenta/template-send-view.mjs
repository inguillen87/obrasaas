const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
export const TEMPLATE_SEND_KEY='open_attendance_reminder';
const invalid=()=>{throw new Error('No se pudo comprobar el resultado de esta obra. Conservá el intento y consultá su recibo.');};
export function templateSendSnapshot(value,{projectId,scope}){
 if(value?.projectId!==projectId||value.scope!==scope||typeof value.projectName!=='string'||typeof value.canSend!=='boolean'||value.template?.key!==TEMPLATE_SEND_KEY||typeof value.template.bodyText!=='string'||typeof value.template.title!=='string'||typeof value.template.canSend!=='boolean'||!Array.isArray(value.records)||value.records.length>200)return invalid();
 const seen=new Set();for(const row of value.records){if(!id(row.workerId)||seen.has(row.workerId)||typeof row.name!=='string'||typeof row.eligible!=='boolean')return invalid();seen.add(row.workerId);}
 if(value.recent!==undefined){if(!Array.isArray(value.recent)||value.recent.length>20)return invalid();for(const result of value.recent){if(!result.receipt||!id(result.receipt.workerId)||typeof result.receipt.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.receipt.operationId))return invalid();templateSendResult(result,{...value,workerId:result.receipt.workerId,operationId:result.receipt.operationId});}}
 return value;
}
export function templateSendResult(value,command){
 if(value?.projectId!==command.projectId||value.scope!==command.scope||typeof value.definitive!=='boolean'||typeof value.providerAccepted!=='boolean'||typeof value.deliveryConfirmed!=='boolean')return invalid();
 if(value.state==='NOT_OBSERVED'){if(value.definitive!==false||value.providerAccepted||value.deliveryConfirmed)return invalid();return value;}
 if(value.receipt?.operationId!==command.operationId||value.receipt.workerId!==command.workerId||value.receipt.templateKey!==TEMPLATE_SEND_KEY||typeof value.receipt.id!=='string'||!value.receipt.id)return invalid();
 if(['SEND_STARTED','SEND_UNKNOWN'].includes(value.state)){if(value.definitive||value.saved||value.deliveryConfirmed)return invalid();return value;}
 if(value.state==='ACCEPTED'){if(!value.definitive||!value.saved||!value.providerAccepted||value.deliveryConfirmed)return invalid();return value;}
 if(value.state==='REJECTED'){if(!value.definitive||value.saved||value.providerAccepted||value.deliveryConfirmed)return invalid();return value;}
 if(value.state==='STATUS_OBSERVED'){if(!value.definitive||!value.saved||!['sent','delivered','read','failed','deleted'].includes(value.providerStatus)||value.deliveryConfirmed!==['delivered','read'].includes(value.providerStatus))return invalid();return value;}
 return invalid();
}
export function templateSendNotice(value){
 if(value.state==='NOT_OBSERVED')return 'Todavía no se observa el recibo. Conservamos la referencia; no se genera otro envío automáticamente.';
 if(['SEND_STARTED','SEND_UNKNOWN'].includes(value.state))return 'El envío quedó sin confirmar. Consultá este mismo intento; no se repite la solicitud a Meta.';
 if(value.state==='REJECTED')return value.code==='META_CUSTOMER_PROVIDER_REJECTED'?'Meta rechazó el envío. No se confirmó la entrega; revisá el canal y la plantilla antes de preparar otra solicitud.':'Se detuvo el envío antes de confirmarlo. Revisá la jornada, la autorización y la aprobación de la plantilla antes de preparar otra solicitud.';
 if(['failed','deleted'].includes(value.providerStatus))return 'Meta informó que el mensaje falló o fue eliminado. El recibo conserva ese resultado; no se reenvía automáticamente.';
 if(value.deliveryConfirmed)return value.providerStatus==='read'?'Meta informó lectura del mensaje. Eso no registra la salida ni modifica la jornada.':'Meta informó entrega del mensaje. Eso no registra la salida ni modifica la jornada.';
 return 'Meta aceptó el mensaje. La entrega todavía no está confirmada; esto no registra la salida ni modifica la jornada.';
}
