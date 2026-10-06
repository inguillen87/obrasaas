const eventPattern=/^(?:customer_webhook_|meta_app_source_)[a-f0-9]{64}$/;
const text=(value,limit=4096)=>typeof value==='string'?value.slice(0,limit):'';
const fold=value=>text(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('es');
const invalid=()=>Object.assign(new Error('La respuesta no corresponde a la obra y la consulta actuales.'),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
export const customerInboxAccessDenied=error=>[401,403].includes(error?.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE','WORKSPACE_MEMBERSHIP_REQUIRED'].includes(error?.code);

// Project only the authorized inbox. Signup codes, credentials and state tokens
// from the shared integration endpoint never become part of this view model.
export function customerInboxSnapshot(value,{projectId,scope}){
 if(value?.projectId!==projectId||value.scope!==scope||!Array.isArray(value.inbox?.items)||value.inbox.items.length>20)throw invalid();
 const seen=new Set();
 const items=value.inbox.items.map(item=>{
  if(!eventPattern.test(item?.id||'')||seen.has(item.id))throw invalid();seen.add(item.id);
  const imported=item.id.startsWith('meta_app_source_');
  if(imported&&(item.source!=='WHATSAPP_BUSINESS_APP'||!['APP_CONTACT','APP_HISTORY','APP_ECHO'].includes(item.kind)||item.canProcess!==false||item.canReview!==false||item.businessApplied!==false||item.replySent!==false))throw invalid();
  return {id:item.id,revision:text(item.revision,40),status:text(item.status,24),createdAt:item.createdAt||null,kind:text(item.kind,40),from:/^[1-9]\d{7,14}$/.test(item.from||'')?item.from:null,body:text(item.body),observation:text(item.observation,80),
   source:imported?'WHATSAPP_BUSINESS_APP':null,sourceEventId:imported&&/^customer_webhook_[a-f0-9]{64}$/.test(item.sourceEventId||'')?item.sourceEventId:null,sourceTimestamp:imported?text(item.sourceTimestamp,14):null,
   payloadVerified:item.payloadVerified===true,canProcess:!imported&&item.canProcess===true,canReview:!imported&&item.canReview===true,processing:text(item.processing,24),processingCode:text(item.processingCode,120),reviewState:text(item.reviewState,32),reviewDecision:text(item.reviewDecision,32),intent:text(item.intent,40),identityStatus:text(item.identityStatus,48),
   hasLocation:item.hasLocation===true,businessApplied:item.businessApplied===true,businessKind:text(item.businessKind,48),receiptId:text(item.receiptId,160),replySent:item.replySent===true,replyState:text(item.replyState,32),providerStatus:text(item.providerStatus,32),providerReplyStatus:text(item.providerReplyStatus,32)};
 });
 const nextCursor=value.inbox.nextCursor||null;if(nextCursor&&!eventPattern.test(nextCursor))throw invalid();
 return {projectId,scope,companyName:text(value.companyName,120),projectName:text(value.projectName,120),connectionPresent:value.connection?.recordPresent===true,operational:value.activation?.operational===true,items,nextCursor,truncated:value.inbox.truncated===true};
}
export function mergeCustomerInboxPages(previous,next){
 if(previous.projectId!==next.projectId||previous.scope!==next.scope)throw invalid();
 const items=new Map(previous.items.map(item=>[item.id,item]));for(const item of next.items)items.set(item.id,item);
 return {...next,items:[...items.values()]};
}
export function customerInboxStage(item){
 if(!item.payloadVerified)return {key:'REVIEW',label:'Contenido pendiente de verificación'};
 if(item.status==='PENDING')return {key:'PENDING',label:item.processing==='LEASED'?'Procesamiento en curso':'Pendiente de procesamiento'};
 if(item.reviewState==='REVIEWED')return {key:'REVIEWED',label:'Seguimiento registrado'};
 if(item.reviewState==='REVIEW_REQUIRED')return {key:'REVIEW',label:'Revisión humana pendiente'};
 if(item.businessApplied)return {key:'RECORDED',label:'Acción de campo registrada'};
 return {key:'OBSERVED',label:'Evento observado'};
}
export function customerInboxReply(item){
 const status=item.providerReplyStatus;
 const delivery=({sent:'Enviado según Meta',delivered:'Entregado según Meta',read:'Leído según Meta',failed:'Entrega fallida según Meta',deleted:'Mensaje eliminado según Meta'})[status]||'Entrega sin confirmar';
 const acceptance=['SEND_UNKNOWN','SEND_STARTED'].includes(item.replyState)?'Resultado incierto; no se reenvía automáticamente':item.replySent?'Respuesta aceptada por Meta':status==='failed'?'Respuesta con entrega fallida':'Sin respuesta aceptada';
 return {acceptance,delivery};
}
export function customerInboxIdentity(item){return ({VERIFIED:'Identidad y permisos del canal comprobados para esta acción.',CHANNEL_VERIFIED:'Identidad y permisos del canal comprobados para esta acción.',NOT_APPLICABLE:'Evento de la cuenta, sin identidad de participante.',NOT_CHECKED:'Identidad todavía sin comprobar.',UNKNOWN:'Este remitente no tiene una participación identificada en la obra.',AMBIGUOUS:'Varias fichas coinciden; revisá la vinculación.',INVALID_PHONE:'El remitente no tiene un teléfono internacional verificable.',PARTICIPATION_REVOKED:'La participación está revocada.',PERMISSION_REVOKED:'El permiso de campo no está vigente.',MEMBERSHIP_REVOKED:'El acceso a la empresa u obra no está vigente.',KYC_REVIEW_REQUIRED:'Falta la revisión humana de identidad.',CHANNEL_IDENTITY_UNVERIFIED:'El vínculo de este teléfono con el participante sigue pendiente.'})[item.identityStatus]||'La identidad requiere revisión.';}
export function customerInboxEventTitle(item){return ({APP_CONTACT:'Contacto de WhatsApp Business',APP_HISTORY:'Historial de WhatsApp Business',APP_ECHO:'Enviado desde WhatsApp Business',text:'Mensaje',image:'Fotografía',audio:'Audio',video:'Video',document:'Documento',location:'Ubicación',interactive:'Respuesta al menú',message_status:'Estado de entrega'})[item.kind]||'Aviso o evento de la cuenta';}
export function customerInboxSummary(items){const result={total:items.length,pending:0,review:0,recorded:0};for(const item of items){const stage=customerInboxStage(item).key;if(stage==='PENDING')result.pending++;if(stage==='REVIEW')result.review++;if(item.businessApplied)result.recorded++;}return result;}
export function customerInboxGroups(items,{filter='ALL',query=''}={}){
 const needle=fold(text(query,120)).trim(),groups=new Map();
 for(const item of items){const stage=customerInboxStage(item).key;if(filter!=='ALL'&&stage!==filter)continue;
  if(needle&&!fold([item.from,item.body,item.observation,customerInboxEventTitle(item),customerInboxStage(item).label].join(' ')).includes(needle))continue;
  const key=item.from?'sender:'+item.from:'account-events',label=item.from?'Remitente +'+item.from:'Avisos y eventos de la cuenta';
  if(!groups.has(key))groups.set(key,{key,label,from:item.from,items:[]});groups.get(key).items.push(item);
 }
 return [...groups.values()];
}
export function customerInboxReceipt(value,command,{projectId,scope}){
 if(value?.projectId!==projectId||value.scope!==scope)throw invalid();
 const receipt=value.receipt;
 if(receipt?.eventId!==command.eventId||receipt.operationId!==command.operationId||receipt.action!==command.action)throw invalid();
 if(receipt.state==='RECORDED'&&command.action==='review_inbox'&&receipt.actorOperationVerified===true&&/^meta_inbox_request_[a-f0-9]{64}$/.test(receipt.receiptId||''))return {state:'RECORDED',receiptId:receipt.receiptId};
 if(receipt.state==='EVENT_PROCESSED'&&command.action==='process_inbox'&&receipt.actorOperationVerified===false&&receipt.eventStatus==='PROCESSED')return {state:'EVENT_PROCESSED',receiptId:null};
 if(receipt.state==='NOT_OBSERVED')return {state:'NOT_OBSERVED',receiptId:null};
 throw invalid();
}
