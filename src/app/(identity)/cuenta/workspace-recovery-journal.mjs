import {createBrowserRecoveryStorage} from './workspace-recovery-storage.mjs';
import {purchaseOutcome} from './site-purchase-view.mjs';

// Receipt references only. Never persist commands, tokens, files, location or messages.
export const RECOVERY_EVENT = 'obrasaas:pending-receipts';
export const WORKSPACE_RECOVERY_PREFIX = 'obrasaas.pending-receipt.v1.';
const prefix = WORKSPACE_RECOVERY_PREFIX;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const PROGRESS_TEMPLATE_SEND_KEY='progress_review_notification';
const templateSendActionReference=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')==='proposalId|revision'&&id(value.proposalId)&&typeof value.revision==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value.revision));
const scopeValid = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const RECOVERY_RESOURCES = Object.freeze({
  workspace:'Planificación', 'task-creation':'Nueva tarea', 'site-register':'Registro de obra',
  'site-photo':'Fotografía privada', participants:'Participantes e identidad',
  'field-operations':'Operación de campo', 'field-media':'Evidencia privada',
  'site-purchases':'Compra o recepción', 'whatsapp-setup':'Preparación de WhatsApp',
  'meta-onboarding':'Seguimiento de WhatsApp', 'worker-channel':'Mi WhatsApp y autorización de avisos',
  'template-send':'Aviso autorizado por WhatsApp',
  'constructor-crm':'Cliente u oportunidad de la empresa',
  'demo-pilot':'Preparación y vinculación del piloto DEMO',
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
  const progress=resource==='template-send'&&body.templateKey===PROGRESS_TEMPLATE_SEND_KEY;
  if(progress&&(!id(body.workerId)||!templateSendActionReference(body.actionReference)))throw unavailable();
  return {version:1,resource,scope:body.scope,projectId:body.projectId,operationId:body.operationId.toLowerCase(),createdAt:now,
    ...(resource==='site-photo'?{reportId:body.reportId}:{}),
    ...(resource==='meta-onboarding'?{action:body.action,eventId:body.eventId}:{}),
    ...(progress?{templateKey:PROGRESS_TEMPLATE_SEND_KEY,workerId:body.workerId,actionReference:{proposalId:body.actionReference.proposalId,revision:body.actionReference.revision}}:{}),
  };
}
function valid(entry) {
  if(!entry||entry.version!==1||!Object.hasOwn(RECOVERY_RESOURCES,entry.resource)||!scopeValid(entry.scope)||!id(entry.projectId)||!uuid(entry.operationId)||!Number.isSafeInteger(entry.createdAt)||entry.createdAt<0)return false;
  const progress=entry.resource==='template-send'&&entry.templateKey===PROGRESS_TEMPLATE_SEND_KEY;
  const fields=['version','resource','scope','projectId','operationId','createdAt',...(entry.resource==='site-photo'?['reportId']:[]),...(entry.resource==='meta-onboarding'?['action','eventId']:[]),...(progress?['templateKey','workerId','actionReference']:[])];
  if(Object.keys(entry).sort().join('|')!==fields.sort().join('|'))return false;
  if(progress&&(!id(entry.workerId)||!templateSendActionReference(entry.actionReference)))return false;
  return (entry.resource!=='site-photo'||id(entry.reportId))&&(entry.resource!=='meta-onboarding'||['review_inbox','process_inbox'].includes(entry.action)&&id(entry.eventId));
}
const keyOf=entry=>prefix+entry.scope+'.'+entry.resource+'.'+entry.operationId;
export function validateWorkspaceRecoveryStoredEntry(key,raw) {
  let entry;
  try {
    if(typeof key!=='string'||typeof raw!=='string'||raw.length>2048)throw unavailable();
    entry=JSON.parse(raw);
    if(!valid(entry)||key!==keyOf(entry))throw unavailable();
  } catch { throw unavailable(); }
  return entry;
}
export function recoveryQuery(entry) {
  if(!valid(entry))throw new TypeError('Invalid receipt reference');
  return '/api/identity/'+entry.resource+'?'+new URLSearchParams({projectId:entry.projectId,scope:entry.scope,operationId:entry.operationId,
    ...(entry.resource==='site-photo'?{reportId:entry.reportId}:{}),...(entry.resource==='meta-onboarding'?{action:entry.action,eventId:entry.eventId}:{})});
}
export function recoveryResult(entry, result) {
  if(!valid(entry)||result?.scope!==entry.scope)return null;
  if(result.projectId!==undefined&&result.projectId!==entry.projectId)return null;
  if(entry.resource==='demo-pilot') {
    if(result.projectId!==entry.projectId)return null;
    if(result.state==='NOT_OBSERVED'&&result.saved===false&&result.definitive===false&&!result.receipt)return {state:'NOT_OBSERVED'};
    const receipt=result.receipt;
    if(result.state==='RECORDED'&&result.saved===true&&result.identityCertified===false&&result.productionVerified===false&&id(receipt?.id)&&receipt.operationId===entry.operationId&&id(receipt.workerId)&&id(receipt.channelId)&&['PREPARE','REQUEST_CHALLENGE','UNLINK','REVOKE'].includes(receipt.action))return {state:'RECORDED',receiptId:receipt.id};
    return null;
  }
  if(entry.resource==='site-purchases'){
    try{purchaseOutcome(result,entry);return result.state==='RECORDED'?{state:'RECORDED',receiptId:result.receiptId}:{state:'NOT_OBSERVED'};}catch{return null;}
  }
  if(entry.resource==='constructor-crm'){
    if(result.projectId!==entry.projectId)return null;
    if(result.state==='NOT_OBSERVED'&&result.saved===false&&result.definitive===false&&!result.receipt)return {state:'NOT_OBSERVED'};
    const receipt=result.receipt;
    if(result.state==='RECORDED'&&result.saved===true&&result.definitive===true&&id(receipt?.id)&&receipt.operationId===entry.operationId&&id(receipt.accountId)&&['CREATE','UPDATE'].includes(receipt.action)&&Number.isSafeInteger(receipt.revision)&&receipt.revision>=1&&(!result.record||result.record.id===receipt.accountId&&result.record.revision>=receipt.revision))return {state:'RECORDED',receiptId:receipt.id};
    return null;
  }
  if(entry.resource==='template-send') {
    const receipt=result.receipt;
    if(entry.templateKey===PROGRESS_TEMPLATE_SEND_KEY){
      if(result.projectId!==entry.projectId||typeof result.definitive!=='boolean'||typeof result.providerAccepted!=='boolean'||typeof result.deliveryConfirmed!=='boolean')return null;
      if(result.state==='NOT_OBSERVED'&&result.definitive===false&&!result.saved&&!result.providerAccepted&&!result.deliveryConfirmed&&!receipt)return {state:'NOT_OBSERVED'};
      if(receipt?.operationId!==entry.operationId||receipt.workerId!==entry.workerId||typeof receipt.id!=='string'||!receipt.id||receipt.templateKey!==entry.templateKey||!templateSendActionReference(receipt.actionReference)||receipt.actionReference.proposalId!==entry.actionReference.proposalId||receipt.actionReference.revision!==entry.actionReference.revision)return null;
      if(['SEND_STARTED','SEND_UNKNOWN'].includes(result.state)&&result.definitive===false&&!result.saved&&!result.deliveryConfirmed)return {state:'PROCESSING'};
      if(result.state==='REJECTED'&&result.definitive===true&&!result.saved&&!result.providerAccepted&&!result.deliveryConfirmed)return {state:'REJECTED',receiptId:receipt.id};
      if(result.state==='ACCEPTED'&&result.definitive===true&&result.saved===true&&result.providerAccepted===true&&result.deliveryConfirmed===false)return {state:'ACCEPTED',receiptId:receipt.id};
      if(result.state==='STATUS_OBSERVED'&&result.definitive===true&&result.saved===true&&['sent','delivered','read','failed','deleted'].includes(result.providerStatus)&&result.deliveryConfirmed===['delivered','read'].includes(result.providerStatus))return {state:'STATUS_OBSERVED',receiptId:receipt.id};
      return null;
    }
    if(result.state==='NOT_OBSERVED'&&result.definitive===false)return {state:'NOT_OBSERVED'};
    if(receipt?.operationId!==entry.operationId||typeof receipt.id!=='string'||!receipt.id||receipt.templateKey!=='open_attendance_reminder')return null;
    if(['SEND_STARTED','SEND_UNKNOWN'].includes(result.state)&&result.definitive===false)return {state:'PROCESSING'};
    if(result.state==='REJECTED'&&result.definitive===true&&result.providerAccepted===false&&result.deliveryConfirmed===false)return {state:'REJECTED',receiptId:receipt.id};
    if(result.state==='ACCEPTED'&&result.definitive===true&&result.saved===true&&result.providerAccepted===true&&result.deliveryConfirmed===false)return {state:'ACCEPTED',receiptId:receipt.id};
    if(result.state==='STATUS_OBSERVED'&&result.definitive===true&&result.saved===true&&['sent','delivered','read','failed','deleted'].includes(result.providerStatus)&&result.deliveryConfirmed===['delivered','read'].includes(result.providerStatus))return {state:'STATUS_OBSERVED',receiptId:receipt.id};
    return null;
  }
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
export function createWorkspaceRecoveryJournal({getStorage,withStorage,now=Date.now,notify=()=>{},withLock}) {
  // getStorage is retained only for controlled in-memory tests. The browser uses
  // one transactional adapter; receipt policy remains in this factory.
  const storageOperation=withStorage||((mode,scope,callback,signal)=>{
    if(signal?.aborted)throw new DOMException('La consulta se canceló.','AbortError');
    const value=getStorage?.();if(!value)throw unavailable();return callback(value);
  });
  async function access(mode,scope,callback,signal) {
    try { return await storageOperation(mode,scope,callback,signal); }
    catch(error) {
      if(error?.name==='AbortError'||error?.requestDispatched===false&&['WORKSPACE_RECOVERY_REQUIRED','WORKSPACE_RECOVERY_CONFLICT','WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'].includes(error.code))throw error;
      throw unavailable();
    }
  }
  function readEntries(s,scope) {
    const entries=[];
    for(let i=0;i<s.length;i++){
      const key=s.key(i);if(!key?.startsWith(prefix+scope+'.'))continue;
      const entry=validateWorkspaceRecoveryStoredEntry(key,s.getItem(key));
      if(entry.scope!==scope)throw unavailable();
      entries.push(entry);if(entries.length>64)throw unavailable();
    }
    return entries.sort((a,b)=>a.createdAt-b.createdAt||a.operationId.localeCompare(b.operationId));
  }
  async function list(scope) {
    if(!scopeValid(scope))return [];
    return access('readonly',scope,s=>readEntries(s,scope));
  }
  async function remove(entry) {
    try {
      const removed=await access('readwrite',entry.scope,s=>{
        const key=keyOf(entry),raw=s.getItem(key);if(raw===null)return false;
        const stored=validateWorkspaceRecoveryStoredEntry(key,raw);
        if(!Object.keys(entry).every(field=>field==='actionReference'?entry[field]?.proposalId===stored[field]?.proposalId&&entry[field]?.revision===stored[field]?.revision:entry[field]===stored[field]))return false;
        s.removeItem(key);return true;
      });
      if(removed)notify();return removed;
    } catch { return false; }
  }
  return {
    list,
    async prepare(url, options) {
      const entry=reference(url,options,now());if(!entry)return null;
      const reserve=()=>access('readwrite',entry.scope,s=>{
      if(options.signal?.aborted)throw Object.assign(new DOMException('La consulta se canceló.','AbortError'),{requestDispatched:false});
      const current=readEntries(s,entry.scope),existing=current.find(row=>keyOf(row)===keyOf(entry));
      if(existing){if(existing.projectId!==entry.projectId||existing.reportId!==entry.reportId||existing.eventId!==entry.eventId||existing.action!==entry.action||existing.templateKey!==entry.templateKey||existing.workerId!==entry.workerId||existing.actionReference?.proposalId!==entry.actionReference?.proposalId||existing.actionReference?.revision!==entry.actionReference?.revision)throw failure('WORKSPACE_RECOVERY_CONFLICT','Este identificador corresponde a otro intento. Comprobá el recibo antes de continuar.');return {entry:existing,existed:true};}
      const pending=current.find(row=>row.resource===entry.resource&&row.projectId===entry.projectId&&(entry.resource!=='meta-onboarding'||row.eventId===entry.eventId));
      let resolution=false;
      if(entry.resource==='participants'&&typeof options.body==='string'){try{resolution=JSON.parse(options.body).action==='REVOKE';}catch{ /* The server rejects malformed commands. */ }}
      if(pending&&!resolution)throw failure('WORKSPACE_RECOVERY_REQUIRED','Hay un envío anterior sin confirmar en este módulo. Comprobá su recibo en Operaciones por comprobar antes de iniciar otro.');
      if(current.length>=64)throw unavailable();
      s.setItem(keyOf(entry),JSON.stringify(entry));if(s.getItem(keyOf(entry))!==JSON.stringify(entry))throw unavailable();
      return {entry,existed:false};
      },options.signal);
      // The native lock spans the complete read/check/write transaction. The
      // browser adapter resolves only after commit, before token acquisition.
      let ticket;
      try { ticket=withLock?await withLock('obrasaas-receipt:'+entry.scope,options.signal,reserve):await reserve(); }
      catch(error) {
        // The transaction has aborted, but it observed an existing committed
        // attempt. Refresh this tab even when cross-tab broadcasts are absent.
        if(error?.code==='WORKSPACE_RECOVERY_REQUIRED')notify();
        throw Object.assign(error,{requestDispatched:false});
      }
      if(!ticket.existed)notify();return ticket;
    },
    async settle(ticket, result, error) {
      if(!ticket)return;
      if(error){if(!ticket.existed&&(error.requestDispatched===false||error.status>=400&&error.status<500))await remove(ticket.entry);return;}
      const entry=ticket.entry;
      // A general Meta snapshot is not a receipt for this operation.
      if(entry.resource==='meta-onboarding')return;
      if(entry.resource==='template-send'){if(['ACCEPTED','STATUS_OBSERVED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='site-purchases'){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(entry.resource==='constructor-crm'){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(result?.scope===entry.scope&&(result.projectId===undefined||result.projectId===entry.projectId)&&(result.saved===true||result.created===true)&&(result.receiptId||result.receipt?.id))await remove(entry);
    },
    async observe(url, result) {
      const resource=resourceOf(url);if(!resource||!url.includes('?'))return;
      const params=new URLSearchParams(url.slice(url.indexOf('?')+1));
      const scope=params.get('scope'),operationId=params.get('operationId');if(!scopeValid(scope)||!uuid(operationId))return;
      const entry=(await list(scope)).find(row=>row.resource===resource&&row.operationId===operationId.toLowerCase());
      if(!entry||params.get('projectId')!==entry.projectId)return;
      const outcome=recoveryResult(entry,result);
      if(['RECORDED','EVENT_PROCESSED','PARTICIPATION_REVOKED','ACCEPTED','STATUS_OBSERVED','REJECTED'].includes(outcome?.state))await remove(entry);
    },
  };
}
export const browserRecoveryJournal=createWorkspaceRecoveryJournal({
  withStorage:createBrowserRecoveryStorage({prefix,validateStored:validateWorkspaceRecoveryStoredEntry}),
  notify:()=>{
    globalThis.window?.dispatchEvent(new Event(RECOVERY_EVENT));
    if(globalThis.window&&typeof globalThis.BroadcastChannel==='function'){
      // Invalidation only: never include scope, identifiers or receipt bodies.
      try { const channel=new BroadcastChannel(RECOVERY_EVENT);channel.postMessage({version:1,type:'invalidate'});channel.close(); }
      catch { /* Focus and same-window invalidation still refresh committed state. */ }
    }
  },
  withLock:(name,signal,reserve)=>{
    const locks=globalThis.navigator?.locks;
    if(!locks?.request)throw failure('WORKSPACE_RECOVERY_LOCK_UNAVAILABLE','Este navegador no permite conservar el intento de forma segura entre pestañas. Abrí ObraSaaS en un navegador actualizado; la operación no se envió.');
    return locks.request(name,{mode:'exclusive',...(signal?{signal}:{})},reserve);
  },
});
