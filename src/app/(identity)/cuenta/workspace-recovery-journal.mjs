// Receipt references only. Never persist commands, tokens, files, location or messages.
export const RECOVERY_EVENT = 'obrasaas:pending-receipts';
const prefix = 'obrasaas.pending-receipt.v1.';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const scopeValid = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const RECOVERY_RESOURCES = Object.freeze({
  workspace:'Planificación', 'task-creation':'Nueva tarea', 'site-register':'Registro de obra',
  'site-photo':'Fotografía privada', participants:'Participantes e identidad',
  'field-operations':'Operación de campo', 'field-media':'Evidencia privada',
  'site-purchases':'Compra o recepción', 'whatsapp-setup':'Preparación de WhatsApp',
  'meta-onboarding':'Seguimiento de WhatsApp',
});
const failure = (code, message) => Object.assign(new Error(message), {code,status:409,requestDispatched:false});
const unavailable = () => failure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE','No se pudo conservar la referencia del intento en este navegador. Habilitá el almacenamiento y volvé a intentar; la operación no se envió.');
function resourceOf(url) {
  if(typeof url!=='string') return null;
  const found = /^\/api\/identity\/([a-z-]+)(?:\?.*)?$/.exec(url);
  return found && Object.hasOwn(RECOVERY_RESOURCES,found[1]) ? found[1] : null;
}
function reference(url, options, now) {
  if(options?.method?.toUpperCase()!=='POST')return null;
  const resource=resourceOf(url);if(!resource||url.includes('?'))return null;
  let body;
  if(typeof options.body==='string'){try{body=JSON.parse(options.body);}catch{return null;}}
  else if(typeof options.body?.get==='function') body=Object.fromEntries(['operationId','projectId','scope','action','reportId','eventId'].map(key=>[key,options.body.get(key)]));
  if(!body||!uuid(body.operationId)||!id(body.projectId)||!scopeValid(body.scope))return null;
  if(resource==='site-photo'&&!id(body.reportId))return null;
  // Invitation reconciliation reads the provider and finalizes the original
  // invitation's receipt; it never creates a second invitation.
  if(resource==='participants'&&body.action==='RECOVER_INVITATION')return null;
  if(resource==='meta-onboarding'&&(!['review_inbox','process_inbox'].includes(body.action)||!id(body.eventId)))return null;
  return {version:1,resource,scope:body.scope,projectId:body.projectId,operationId:body.operationId.toLowerCase(),createdAt:now,
    ...(resource==='site-photo'?{reportId:body.reportId}:{}),
    ...(resource==='meta-onboarding'?{action:body.action,eventId:body.eventId}:{}),
  };
}
function valid(entry) {
  if(!entry||entry.version!==1||!Object.hasOwn(RECOVERY_RESOURCES,entry.resource)||!scopeValid(entry.scope)||!id(entry.projectId)||!uuid(entry.operationId)||!Number.isSafeInteger(entry.createdAt)||entry.createdAt<0)return false;
  const fields=['version','resource','scope','projectId','operationId','createdAt',...(entry.resource==='site-photo'?['reportId']:[]),...(entry.resource==='meta-onboarding'?['action','eventId']:[])];
  if(Object.keys(entry).sort().join('|')!==fields.sort().join('|'))return false;
  return (entry.resource!=='site-photo'||id(entry.reportId))&&(entry.resource!=='meta-onboarding'||['review_inbox','process_inbox'].includes(entry.action)&&id(entry.eventId));
}
const keyOf=entry=>prefix+entry.scope+'.'+entry.resource+'.'+entry.operationId;
export function recoveryQuery(entry) {
  if(!valid(entry))throw new TypeError('Invalid receipt reference');
  return '/api/identity/'+entry.resource+'?'+new URLSearchParams({projectId:entry.projectId,scope:entry.scope,operationId:entry.operationId,
    ...(entry.resource==='site-photo'?{reportId:entry.reportId}:{}),...(entry.resource==='meta-onboarding'?{action:entry.action,eventId:entry.eventId}:{})});
}
export function recoveryResult(entry, result) {
  if(!valid(entry)||result?.scope!==entry.scope)return null;
  if(result.projectId!==undefined&&result.projectId!==entry.projectId)return null;
  if(entry.resource==='meta-onboarding') {
    const receipt=result.receipt;
    if(receipt?.operationId!==entry.operationId||receipt.eventId!==entry.eventId||receipt.action!==entry.action)return null;
    if(entry.action==='review_inbox'&&receipt.state==='RECORDED'&&receipt.actorOperationVerified===true&&typeof receipt.receiptId==='string'&&receipt.receiptId)return {state:'RECORDED',receiptId:receipt.receiptId};
    if(entry.action==='process_inbox'&&receipt.state==='EVENT_PROCESSED'&&receipt.eventStatus==='PROCESSED'&&receipt.actorOperationVerified===false)return {state:'EVENT_PROCESSED',receiptId:receipt.businessReceiptId||null};
    return receipt.state==='NOT_OBSERVED'?{state:'NOT_OBSERVED'}:null;
  }
  const receiptId=result.receiptId||result.receipt?.id;
  if(result.state==='RECORDED'&&typeof receiptId==='string'&&receiptId&&(result.saved===true||result.created===true))return {state:'RECORDED',receiptId};
  if(entry.resource==='participants'&&result.state==='INVITATION_UNCONFIRMED'&&result.participant?.status==='REVOKED')return {state:'PARTICIPATION_REVOKED'};
  return ['NOT_OBSERVED','PROCESSING','INVITATION_UNCONFIRMED'].includes(result.state)?{state:result.state}:null;
}
export function createWorkspaceRecoveryJournal({getStorage,now=Date.now,notify=()=>{},withLock}) {
  const storage=()=>{try{const value=getStorage();if(!value)throw unavailable();return value;}catch{throw unavailable();}};
  function list(scope) {
    if(!scopeValid(scope))return [];
    const s=storage(),entries=[];
    try {
    for(let i=0;i<s.length;i++){
      const key=s.key(i);if(!key?.startsWith(prefix+scope+'.'))continue;
      const raw=s.getItem(key);let entry;try{if(raw?.length>2048)throw unavailable();entry=JSON.parse(raw);}catch{throw unavailable();}
      if(!valid(entry)||entry.scope!==scope||key!==keyOf(entry))throw unavailable();
      entries.push(entry);if(entries.length>64)throw unavailable();
    }
    } catch { throw unavailable(); }
    return entries.sort((a,b)=>a.createdAt-b.createdAt||a.operationId.localeCompare(b.operationId));
  }
  function remove(entry) {try{storage().removeItem(keyOf(entry));notify();return true;}catch{return false;}}
  return {
    list,
    prepare(url, options) {
      const entry=reference(url,options,now());if(!entry)return null;
      const reserve=()=>{
      if(options.signal?.aborted)throw Object.assign(new DOMException('La consulta se canceló.','AbortError'),{requestDispatched:false});
      const current=list(entry.scope),existing=current.find(row=>keyOf(row)===keyOf(entry));
      if(existing){if(existing.projectId!==entry.projectId||existing.reportId!==entry.reportId||existing.eventId!==entry.eventId||existing.action!==entry.action)throw failure('WORKSPACE_RECOVERY_CONFLICT','Este identificador corresponde a otro intento. Comprobá el recibo antes de continuar.');return {entry:existing,existed:true};}
      const pending=current.find(row=>row.resource===entry.resource&&row.projectId===entry.projectId&&(entry.resource!=='meta-onboarding'||row.eventId===entry.eventId));
      let resolution=false;
      if(entry.resource==='participants'&&typeof options.body==='string'){try{resolution=JSON.parse(options.body).action==='REVOKE';}catch{ /* The server rejects malformed commands. */ }}
      if(pending&&!resolution)throw failure('WORKSPACE_RECOVERY_REQUIRED','Hay un envío anterior sin confirmar en este módulo. Comprobá su recibo en Operaciones por comprobar antes de iniciar otro.');
      if(current.length>=64)throw unavailable();
      const s=storage();try{s.setItem(keyOf(entry),JSON.stringify(entry));if(s.getItem(keyOf(entry))!==JSON.stringify(entry))throw unavailable();}catch{throw unavailable();}
      notify();return {entry,existed:false};
      };
      if(!withLock)return reserve();
      // Reserve under an origin-wide browser lock before obtaining the token or
      // dispatching. Separate tabs cannot both pass list/check/setItem.
      return Promise.resolve().then(()=>withLock('obrasaas-receipt:'+entry.scope,options.signal,reserve)).catch(error=>{throw Object.assign(error,{requestDispatched:false});});
    },
    settle(ticket, result, error) {
      if(!ticket)return;
      if(error){if(!ticket.existed&&(error.requestDispatched===false||error.status>=400&&error.status<500))remove(ticket.entry);return;}
      const entry=ticket.entry;
      // A general Meta snapshot is not a receipt for this operation.
      if(entry.resource==='meta-onboarding')return;
      if(result?.scope===entry.scope&&(result.projectId===undefined||result.projectId===entry.projectId)&&(result.saved===true||result.created===true)&&(result.receiptId||result.receipt?.id))remove(entry);
    },
    observe(url, result) {
      const resource=resourceOf(url);if(!resource||!url.includes('?'))return;
      const params=new URLSearchParams(url.slice(url.indexOf('?')+1));
      const scope=params.get('scope'),operationId=params.get('operationId');if(!scopeValid(scope)||!uuid(operationId))return;
      const entry=list(scope).find(row=>row.resource===resource&&row.operationId===operationId.toLowerCase());
      if(!entry||params.get('projectId')!==entry.projectId)return;
      const outcome=recoveryResult(entry,result);
      if(['RECORDED','EVENT_PROCESSED','PARTICIPATION_REVOKED'].includes(outcome?.state))remove(entry);
    },
  };
}
export const browserRecoveryJournal=createWorkspaceRecoveryJournal({
  getStorage:()=>globalThis.window?.localStorage,
  notify:()=>{globalThis.window?.dispatchEvent(new Event(RECOVERY_EVENT));},
  withLock:(name,signal,reserve)=>{
    const locks=globalThis.navigator?.locks;
    if(!locks?.request)throw failure('WORKSPACE_RECOVERY_LOCK_UNAVAILABLE','Este navegador no permite conservar el intento de forma segura entre pestañas. Abrí ObraSaaS en un navegador actualizado; la operación no se envió.');
    return locks.request(name,{mode:'exclusive',...(signal?{signal}:{})},reserve);
  },
});
