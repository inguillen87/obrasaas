import {digest,workspaceId} from './workspace-policy.mjs';
import {
 canImportPlan,canApprovePlan,PLAN_IMPORT_CONSENT,PLAN_IMPORT_SPREADSHEET_CONSENT,
 PLAN_IMPORT_CYP_CONSENT,PLAN_IMPORT_MONTHLY_CURVE_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT,
} from './plan-import-policy.mjs';

export const META_PLAN_IMPORT_REFERENCE_TTL_MS=900000;
const imageTypes=['image/png','image/jpeg','image/webp'];
const spreadsheetTypes=['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel.sheet.macroenabled.12'];
const profiles=Object.freeze({
 DOCUMENT:{title:'PDF o imagen',consent:PLAN_IMPORT_CONSENT,limit:50,financial:false},
 MONTHLY:{title:'Excel mensual',consent:PLAN_IMPORT_SPREADSHEET_CONSENT,limit:50,financial:false},
 CYP:{title:'Partidas CyP',consent:PLAN_IMPORT_CYP_CONSENT,limit:200,financial:false},
 MONTHLY_CURVE:{title:'Curva por mes',consent:PLAN_IMPORT_MONTHLY_CURVE_CONSENT,limit:50,financial:true},
 CYP_CURVE:{title:'Partidas y curva',consent:PLAN_IMPORT_CYP_CURVE_CONSENT,limit:200,financial:true},
});
const referenceKeys=['version','eventId','payloadDigest','contextDigest','sourceProjectId','kind','mediaId','contentType','receivedAt','expiresAt'];
const contextKeys=['eventId','payloadDigest','contextDigest','sourceProjectId'];
const noticeChoices=[{value:'EXTRACT',title:'Extraer borrador'},{value:'CANCEL',title:'Cancelar'}];
const text=body=>({type:'text',body});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value,keys)=>object(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const clock=value=>value instanceof Date&&Number.isFinite(value.getTime());
const selectedId=message=>message?.type==='interactive'?(message.interactive?.type==='list_reply'?message.interactive.list_reply?.id:message.interactive?.type==='button_reply'?message.interactive.button_reply?.id:null):null;
const allowed=(profile,role)=>canImportPlan(role)&&Object.hasOwn(profiles,profile)&&(!profiles[profile].financial||canApprovePlan(role));
const formatChoices=role=>Object.entries(profiles).filter(([,profile])=>!profile.financial||canApprovePlan(role)).map(([value,profile])=>({value,title:profile.title}));
const contextValid=value=>exactKeys(value,contextKeys)&&workspaceId(value.eventId)&&workspaceId(value.sourceProjectId)&&hex(value.payloadDigest)&&hex(value.contextDigest);
const mediaMatches=(profile,kind,contentType)=>profile==='DOCUMENT'?(kind==='image'&&imageTypes.includes(contentType)||kind==='document'&&contentType==='application/pdf'):Object.hasOwn(profiles,profile)&&kind==='document'&&spreadsheetTypes.includes(contentType);

function prompt(state,eventId,body,rows){
 const nonce=digest([eventId,state.step]).slice(0,20);
 return {state:{...state,lastEventId:eventId,nonce,choices:rows.map(row=>({...row}))},reply:{type:'interactive',body,button:'Elegir',sections:[{title:'Importar cronograma',rows:rows.map((row,index)=>({id:'obra:'+nonce+':'+index,title:row.title.slice(0,24)}))}]}};
}
function unchanged(state,body){return {state,preserveConversation:true,reply:text(body)};}
function invalid(){return {state:null,reply:text('El permiso, la obra o la espera cambió. No guardamos ni analizamos el archivo. Escribí MENU y elegí Importar cronograma para empezar con los datos actuales.')};}
function cancelled(){return {state:null,cancelled:true,reply:text('Importación cancelada. No guardamos ni analizamos el archivo, ni modificamos cronogramas anteriores. Escribí MENU y elegí Importar cronograma cuando quieras empezar de nuevo.')};}
function selection(message,state,expected){
 const id=selectedId(message);
 if(!workspaceId(state?.lastEventId)||state.nonce!==digest([state.lastEventId,state.step]).slice(0,20)||!Array.isArray(state.choices)||digest(state.choices)!==digest(expected))return null;
 const index=expected.findIndex((_,i)=>id==='obra:'+state.nonce+':'+i);
 return index<0?null:expected[index].value;
}
function active(state,facts,now){
 const source=facts?.planImportReferenceContext;
 return object(state)&&state.version===1&&state.purpose==='PLAN_IMPORT'&&['PLAN_IMPORT_FORMAT','PLAN_IMPORT_FILE','PLAN_IMPORT_NOTICE','PLAN_IMPORT_AUTHORIZED'].includes(state.step)&&instant(state.expiresAt)&&clock(now)&&Date.parse(state.expiresAt)>now.getTime()&&contextValid(source)&&state.contextDigest===source.contextDigest&&state.sourceProjectId===source.sourceProjectId&&state.planImportRole===facts?.planImportRole&&canImportPlan(facts.planImportRole);
}
function referenceShape(ref){
 return exactKeys(ref,referenceKeys)&&ref.version===1&&workspaceId(ref.eventId)&&workspaceId(ref.sourceProjectId)&&hex(ref.payloadDigest)&&hex(ref.contextDigest)&&typeof ref.mediaId==='string'&&/^\d{5,32}$/.test(ref.mediaId)&&['image','document'].includes(ref.kind)&&typeof ref.contentType==='string'&&(ref.kind==='image'?imageTypes.includes(ref.contentType):['application/pdf',...spreadsheetTypes].includes(ref.contentType))&&instant(ref.receivedAt)&&instant(ref.expiresAt)&&Date.parse(ref.expiresAt)-Date.parse(ref.receivedAt)===META_PLAN_IMPORT_REFERENCE_TTL_MS;
}

// This validates a host-provided reference, not its signature or actual bytes.
// The bridge must verify the signed original event and current authority again.
export function validMetaPlanImportReferenceContext(ref,{state,facts,now}={}){
 if(!referenceShape(ref)||!active(state,facts,now)||!allowed(state.profile,facts.planImportRole)||state.consent!==profiles[state.profile].consent||!mediaMatches(state.profile,ref.kind,ref.contentType)||ref.contextDigest!==state.contextDigest||ref.sourceProjectId!==state.sourceProjectId||Date.parse(ref.receivedAt)>now.getTime()||Date.parse(ref.expiresAt)<=now.getTime())return false;
 if(['PLAN_IMPORT_NOTICE','PLAN_IMPORT_AUTHORIZED'].includes(state.step)&&state.lastEventId!==ref.eventId)return false;
 return !state.pendingFile||digest(state.pendingFile)===digest(ref);
}

export function startMetaPlanImportConversation({eventId,facts,now}={}){
 const source=facts?.planImportReferenceContext;
 if(!workspaceId(eventId)||!clock(now)||!contextValid(source)||source.eventId!==eventId||!canImportPlan(facts?.planImportRole))return invalid();
 const state={version:1,purpose:'PLAN_IMPORT',step:'PLAN_IMPORT_FORMAT',planImportRole:facts.planImportRole,contextDigest:source.contextDigest,sourceProjectId:source.sourceProjectId,expiresAt:new Date(now.getTime()+META_PLAN_IMPORT_REFERENCE_TTL_MS).toISOString()};
 return prompt(state,eventId,'Elegí el formato del cronograma de esta obra. Primero revisaremos el archivo y el aviso correspondiente. Extraer un borrador no aprueba ni aplica tareas; la revisión continúa en tu cuenta.',formatChoices(facts.planImportRole));
}

function filePrompt(state,eventId){
 const body=state.profile==='DOCUMENT'?'Enviá un PDF de hasta 3 MiB o una imagen PNG o JPEG de hasta 2 MiB.':'Enviá un archivo XLSX de hasta 3 MiB para '+profiles[state.profile].title+'. Si WhatsApp no admite tu XLSM, cargalo desde Mi cuenta; no hace falta cambiar sus macros para la lectura local.';
 return {state:{...state,lastEventId:eventId},reply:text(body+' Después leerás el aviso y decidirás si autorizás la extracción. No envíes otro formato. Escribí CANCELAR para terminar.')};
}
function notice(state,eventId){
 const profile=profiles[state.profile];
 const analysis=state.profile==='DOCUMENT'?'Si elegís Extraer borrador, autorizás guardar el archivo en almacenamiento privado y enviarlo a OpenAI para extraer hasta 50 tareas.':'Si elegís Extraer borrador, autorizás guardar el archivo en almacenamiento privado y leerlo localmente, sin enviarlo a OpenAI, sin ejecutar macros ni recalcular fórmulas. Límite: '+profile.limit+(state.profile.startsWith('CYP')?' partidas CyP.':' rubros mensuales.');
 const curve=profile.financial?' La curva representa inversión monetaria planificada, no avance físico; no se aprueban ni aplican tareas.':' Las fechas, cantidades y dudas se revisan en tu cuenta; ninguna tarea queda aprobada ni aplicada.';
 return prompt({...state,step:'PLAN_IMPORT_NOTICE'},eventId,analysis+curve+' Podés cancelar ahora sin guardar ni analizar el archivo. La autorización corresponde únicamente a este archivo y formato durante 15 minutos.',noticeChoices);
}

export function continueMetaPlanImportConversation({message,state,eventId,facts,now}={}){
 const body=message?.type==='text'&&typeof message.text?.body==='string'?message.text.body.trim().toUpperCase():null;
 if(state?.purpose==='PLAN_IMPORT'&&state.step==='PLAN_IMPORT_AUTHORIZED')return unchanged(state,'La extracción de este archivo ya fue autorizada y está pendiente de comprobar. Conservamos el mismo intento. Consultá el resultado en tu cuenta; no vuelvas a confirmar ni reenviar el archivo.');
 if(body==='CANCELAR')return cancelled();
 if(!workspaceId(eventId)||!active(state,facts,now)||facts.planImportReferenceContext.eventId!==eventId)return invalid();
 if(eventId===state.lastEventId)return unchanged(state,'Este evento ya corresponde al paso anterior. No guardamos ni analizamos el archivo. Elegí una opción del menú vigente con un nuevo mensaje, o CANCELAR.');
 if(state.step==='PLAN_IMPORT_FORMAT'){
  const chosen=selection(message,state,formatChoices(facts.planImportRole));
  if(!chosen||!allowed(chosen,facts.planImportRole))return unchanged(state,'Elegí un formato del menú vigente. Una opción anterior no autoriza esta importación. Escribí CANCELAR para terminar.');
  const next={...state,step:'PLAN_IMPORT_FILE',profile:chosen,consent:profiles[chosen].consent};delete next.nonce;delete next.choices;
  return filePrompt(next,eventId);
 }
 if(!allowed(state.profile,facts.planImportRole)||state.consent!==profiles[state.profile].consent)return invalid();
 if(state.step==='PLAN_IMPORT_FILE'){
  const asset=message?.[message?.type];
  if(!mediaMatches(state.profile,message?.type,asset?.mime_type)||!/^\d{5,32}$/.test(asset?.id||''))return unchanged(state,'Ese archivo no corresponde al formato elegido. Volvé a enviar el archivo correcto, o escribí CANCELAR. No guardamos ni analizamos el archivo.');
  const limit=message.type==='image'?2*1024*1024:3*1024*1024;
  // Webhooks normally omit file_size. A declaration can reject a file, but
  // cannot attest its real size; the provider enforces metadata/stream limits.
  if(Object.hasOwn(asset,'file_size')&&(!Number.isSafeInteger(asset.file_size)||asset.file_size<=0||asset.file_size>limit))return unchanged(state,'El tamaño declarado no es válido para este archivo. Máximo '+(message.type==='image'?'2':'3')+' MiB. Volvé a enviarlo dentro del límite, o CANCELAR.');
  const source=facts.planImportReferenceContext;
  const ref={version:1,eventId,payloadDigest:source.payloadDigest,contextDigest:source.contextDigest,sourceProjectId:source.sourceProjectId,kind:message.type,mediaId:asset.id,contentType:asset.mime_type,receivedAt:now.toISOString(),expiresAt:new Date(now.getTime()+META_PLAN_IMPORT_REFERENCE_TTL_MS).toISOString()};
  const next={...state,pendingFile:ref,expiresAt:ref.expiresAt};
  if(!validMetaPlanImportReferenceContext(ref,{state:next,facts,now}))return invalid();
  return notice(next,eventId);
 }
 if(!validMetaPlanImportReferenceContext(state.pendingFile,{state,facts,now}))return invalid();
 const chosen=selection(message,state,noticeChoices);
 if(chosen==='CANCEL')return cancelled();
 if(chosen!=='EXTRACT')return unchanged(state,'Leé el aviso y elegí Extraer borrador o Cancelar en el menú vigente. Un texto o una opción anterior no autoriza guardar ni analizar el archivo.');
 const authorized={...state,step:'PLAN_IMPORT_AUTHORIZED',mediaAuthorizationStep:'PLAN_IMPORT_NOTICE',authorizationProfile:state.profile,analysisConsentEventId:eventId};
 const planImport={sourceOrigin:{...state.pendingFile},consent:state.consent,analysisConsentEventId:eventId};
 return {state:authorized,planImport};
}

// The original NOTICE nonce, choices and lastEventId remain intact until the
// bridge validates this command. Optional current facts/time add live checks.
export function metaPlanImportAuthorizationValid(message,planImport,state,options){
 if(!object(state)||state.version!==1||state.purpose!=='PLAN_IMPORT'||state.step!=='PLAN_IMPORT_AUTHORIZED'||state.mediaAuthorizationStep!=='PLAN_IMPORT_NOTICE'||state.authorizationProfile!==state.profile||!allowed(state.profile,state.planImportRole)||state.consent!==profiles[state.profile].consent||!workspaceId(state.analysisConsentEventId)||state.analysisConsentEventId===state.lastEventId||!referenceShape(state.pendingFile)||state.pendingFile.eventId!==state.lastEventId||!mediaMatches(state.profile,state.pendingFile.kind,state.pendingFile.contentType)||state.pendingFile.contextDigest!==state.contextDigest||state.pendingFile.sourceProjectId!==state.sourceProjectId||!exactKeys(planImport,['sourceOrigin','consent','analysisConsentEventId'])||planImport.consent!==state.consent||planImport.analysisConsentEventId!==state.analysisConsentEventId||!referenceShape(planImport.sourceOrigin)||digest(planImport.sourceOrigin)!==digest(state.pendingFile))return false;
 const original={...state,step:state.mediaAuthorizationStep};
 if(selection(message,original,noticeChoices)!=='EXTRACT')return false;
 if(options!==undefined&&(!object(options)||options.eventId!==undefined&&options.eventId!==state.analysisConsentEventId||options.facts?.planImportReferenceContext?.eventId!==state.analysisConsentEventId||!validMetaPlanImportReferenceContext(state.pendingFile,{state,facts:options.facts,now:options.now})))return false;
 return true;
}
