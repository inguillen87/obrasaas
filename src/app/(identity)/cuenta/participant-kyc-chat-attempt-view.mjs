const copy={
 SENDER_MISMATCH:'El código coincide, pero el mensaje llegó desde un teléfono distinto del registrado. Revisá la ficha.',
 CODE_FORMAT:'El mensaje recibido no conserva el formato del código preparado.',
 CODE_MISMATCH:'El mensaje llegó desde el teléfono registrado, pero su código no coincide con el vigente.',
 PREPARATION_RECEIPT_UNCONFIRMED:'Coinciden código y teléfono, pero no se comprobó el recibo de preparación. Requiere revisión.',
 CHALLENGE_REJECTED:'Coinciden código, teléfono y recibo. Otra comprobación rechazó el inicio; requiere revisión.',
 SAME_SECOND_UNCONFIRMED:'No pudimos separar la preparación y los intentos recibidos en ese momento. El diagnóstico requiere revisión.',
};
const invalid=()=>{throw Object.assign(new Error('No se pudo comprobar el intento para este perfil. Volvé a consultar tu acceso.'),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});};
export function participantKycChatAttemptDate(value){return new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value))+' (hora de Argentina)';}
export function participantKycChatAttemptView(value,{scope,projectId,workerId,challengeId}){
 if(!/^kyc_chat_[a-f0-9]{32}$/.test(challengeId||'')||value?.detail!=='kyc-chat-attempt'||value.scope!==scope||value.projectId!==projectId||value.workerId!==workerId||value.challengeId!==challengeId)invalid();
 const attempt=value.kycChatAttempt;
 if(attempt?.version!==1||!['OBSERVED','NOT_OBSERVED','UNAVAILABLE'].includes(attempt.state))invalid();
 if(attempt.state==='NOT_OBSERVED')return {state:attempt.state,description:'No se encontró un intento comprobable en los últimos 20 mensajes del canal. Puede haber intentos anteriores.'};
 if(attempt.state==='UNAVAILABLE')return {state:attempt.state,description:'No se pudo comprobar el intento con la ficha y el canal vigentes.'};
 if(!['PENDING','PROCESSED'].includes(attempt.processingState)||typeof attempt.rejected!=='boolean'||typeof attempt.sameSecond!=='boolean'||!['codeSyntax','codeMatch','senderMatch','preparationReceiptMatch'].every(key=>typeof attempt[key]==='boolean')||!Number.isFinite(Date.parse(attempt.receivedAt))||!Object.hasOwn(copy,attempt.reason)&&attempt.reason!=='OTHER_RESULT')invalid();
 const description=attempt.sameSecond?copy.SAME_SECOND_UNCONFIRMED:attempt.reason==='OTHER_RESULT'?(attempt.processingState==='PENDING'?'El intento recibido sigue pendiente de procesamiento.':'El intento recibido tiene un resultado registrado. La respuesta y su entrega requieren comprobación independiente.'):copy[attempt.reason];
 return {state:'OBSERVED',description,receivedAt:attempt.receivedAt,checks:{codeSyntax:attempt.codeSyntax,codeMatch:attempt.codeMatch,senderMatch:attempt.senderMatch,preparationReceiptMatch:attempt.preparationReceiptMatch}};
}
