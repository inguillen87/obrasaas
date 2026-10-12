const copy={
 SENDER_MISMATCH:'El código coincide, pero el mensaje llegó desde un teléfono distinto del registrado. Revisá la ficha.',
 CODE_FORMAT:'El mensaje recibido no conserva el formato del código preparado.',
 CODE_MISMATCH:'El mensaje llegó desde el teléfono registrado, pero su código no coincide con el vigente.',
 PREPARATION_RECEIPT_UNCONFIRMED:'Coinciden código y teléfono, pero no se comprobó el recibo de preparación. Requiere revisión.',
 CHALLENGE_REJECTED:'Coinciden código, teléfono y recibo. Otra comprobación rechazó el inicio; requiere revisión.',
 SAME_SECOND_UNCONFIRMED:'No pudimos separar la preparación y los intentos recibidos en ese momento. El diagnóstico requiere revisión.',
};
const invalid=()=>{throw Object.assign(new Error('No se pudo comprobar el intento para este perfil. Volvé a consultar tu acceso.'),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});};
const recordedStates=new Set(['RESERVED','SEND_UNKNOWN','API_ACCEPTED','API_REJECTED','DELIVERED','READ','FAILED']);
const emptyStates=new Set(['NOT_OBSERVED','UNAVAILABLE','WINDOW_CLOSED']);
const canonicalInstant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const contextId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const responseCopy={
 NOT_OBSERVED:['Respuesta sin comprobar','No hay un estado comprobado de la respuesta a este intento.'],
 RESERVED:['Respuesta pendiente','La respuesta tiene una reserva registrada. Su envío sigue sin confirmar.'],
 SEND_UNKNOWN:['Envío sin confirmar','El resultado del envío sigue sin confirmar. Podés volver a consultar este intento.'],
 API_ACCEPTED:['Respuesta aceptada por Meta','Meta aceptó la respuesta; todavía no hay comprobación de entrega.'],
 DELIVERED:['Respuesta registrada','La respuesta está vinculada a este intento.'],
 READ:['Respuesta registrada','La respuesta está vinculada a este intento.'],
 API_REJECTED:['Respuesta rechazada por Meta','Meta rechazó el envío de la respuesta.'],
 FAILED:['Respuesta con fallo de entrega','WhatsApp informó un fallo para esta respuesta.'],
 WINDOW_CLOSED:['Plazo de respuesta cerrado','Terminó el plazo para responder a ese mensaje.'],
 UNAVAILABLE:['Respuesta por comprobar','No se pudo comprobar la respuesta con el canal vigente.'],
};
function replyDeliveryView(value){
 if(value===undefined)value={version:1,state:'NOT_OBSERVED',recordedAt:null};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='recordedAt|state|version'||value.version!==1||!recordedStates.has(value.state)&&!emptyStates.has(value.state))invalid();
 if(recordedStates.has(value.state)?!canonicalInstant(value.recordedAt):value.recordedAt!==null)invalid();
 const [label,description]=responseCopy[value.state],delivery=value.state==='READ'?{label:'Lectura comprobada',description:'WhatsApp confirmó la lectura de esta respuesta.',confirmed:true}:value.state==='DELIVERED'?{label:'Entrega comprobada',description:'WhatsApp confirmó la entrega de esta respuesta.',confirmed:true}:value.state==='FAILED'?{label:'Fallo de entrega comprobado',description:'WhatsApp informó un fallo de entrega para esta respuesta.',confirmed:false}:{label:'Entrega sin comprobar',description:'Todavía no hay confirmación de entrega al teléfono.',confirmed:false};
 return {state:value.state,response:{label,description},delivery,recordedAt:value.recordedAt,dateSource:['DELIVERED','READ','FAILED'].includes(value.state)?'WHATSAPP':'SERVER'};
}
export function participantKycChatAttemptDate(value){return new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value))+' (hora de Argentina)';}
export function participantKycChatAttemptView(value,{scope,projectId,workerId,challengeId}){
 if(!/^[a-f0-9]{64}$/.test(scope||'')||!contextId(projectId)||!contextId(workerId)||!/^kyc_chat_[a-f0-9]{32}$/.test(challengeId||'')||value?.detail!=='kyc-chat-attempt'||value.scope!==scope||value.projectId!==projectId||value.workerId!==workerId||value.challengeId!==challengeId)invalid();
 const attempt=value.kycChatAttempt;
 if(attempt?.version!==1||!['OBSERVED','NOT_OBSERVED','UNAVAILABLE'].includes(attempt.state))invalid();
 if(attempt.state!=='OBSERVED'&&Object.hasOwn(attempt,'replyDelivery'))invalid();
 if(attempt.state==='NOT_OBSERVED')return {state:attempt.state,description:'No se encontró un intento comprobable en los últimos 20 mensajes del canal. Puede haber intentos anteriores.',replyDelivery:replyDeliveryView()};
 if(attempt.state==='UNAVAILABLE')return {state:attempt.state,description:'No se pudo comprobar el intento con la ficha y el canal vigentes.',replyDelivery:replyDeliveryView()};
 if(!['PENDING','PROCESSED'].includes(attempt.processingState)||typeof attempt.rejected!=='boolean'||typeof attempt.sameSecond!=='boolean'||!['codeSyntax','codeMatch','senderMatch','preparationReceiptMatch'].every(key=>typeof attempt[key]==='boolean')||!canonicalInstant(attempt.receivedAt)||!Object.hasOwn(copy,attempt.reason)&&attempt.reason!=='OTHER_RESULT'||attempt.sameSecond&&attempt.replyDelivery!==undefined&&attempt.replyDelivery?.state!=='UNAVAILABLE')invalid();
 const description=attempt.sameSecond?copy.SAME_SECOND_UNCONFIRMED:attempt.reason==='OTHER_RESULT'?(attempt.processingState==='PENDING'?'El intento recibido sigue pendiente de procesamiento.':'El intento recibido tiene un resultado registrado. La respuesta y su entrega requieren comprobación independiente.'):copy[attempt.reason];
 return {state:'OBSERVED',description,receivedAt:attempt.receivedAt,checks:{codeSyntax:attempt.codeSyntax,codeMatch:attempt.codeMatch,senderMatch:attempt.senderMatch,preparationReceiptMatch:attempt.preparationReceiptMatch},replyDelivery:replyDeliveryView(attempt.replyDelivery)};
}
