import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';

export const OFFICE_CHAT_TTL_MS=5*60*1000;
export const OFFICE_CHAT_ACTION='office.chat.continuity';
export const OFFICE_CHAT_RECEIPT_ACTION='office.chat.operation';
export const OFFICE_CHAT_DISPATCH_ACTION='office.chat.dispatched';
export const OFFICE_CHAT_AUTHORIZATION_CODES=['OFFICE_CHAT_ACCESS_REVOKED','OFFICE_CHAT_CODE_REJECTED','OFFICE_CHAT_CODE_EXPIRED','OFFICE_CHAT_CONTEXT_CHANGED','OFFICE_CHAT_REPLY_CONTEXT_REQUIRED','OFFICE_CHAT_AMBIGUOUS'];
export const officeChatFailure=(code='OFFICE_CHAT_CONTEXT_CHANGED',status=409)=>{throw new WorkspaceError(code,status);};
export const officeChatSlotId=(organizationId,membershipId,connectionId)=>'office_chat_'+digest([organizationId,membershipId,connectionId]);
export const officeChatReceiptId=(member,operation)=>'office_chat_op_'+digest([member.organizationId,member.actorId,operation]);
export const officeChatDispatchId=eventId=>'office_chat_reply_'+digest(eventId);
export const officeChatCodeHash=code=>digest(['office-chat-code-v1',code]);
export const officeChatSender=value=>typeof value==='string'&&/^\+[1-9]\d{7,14}$/.test(value);
export function officeChatCommand(input){
 const keys=['action','operationId','projectId','scope',...(input?.action==='PREPARE'?['sender']:[])];
 if(!input||Array.isArray(input)||Object.keys(input).sort().join('|')!==keys.sort().join('|')||!['PREPARE','REVOKE'].includes(input.action)||!operationId(input.operationId)||!workspaceId(input.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||'')||input.action==='PREPARE'&&!officeChatSender(input.sender))officeChatFailure('OFFICE_CHAT_INPUT_INVALID',400);
 return {...input,operationId:input.operationId.toLowerCase()};
}
export const officeChatCode=text=>typeof text==='string'&&/^CUENTA [A-Za-z0-9_-]{43}$/.test(text)?text.slice(7):null;
export const OFFICE_CHAT_LINKS=Object.freeze({WORKS:'https://obrasaas.com/cuenta',TEAM:'https://obrasaas.com/cuenta?seccion=identidad',SETTINGS:'https://obrasaas.com/cuenta?seccion=mi-whatsapp',ACCOUNT:'https://obrasaas.com/cuenta'});
export function officeChatReply(eventId,choice=null){
 if(choice==='FIELD')return {type:'text',body:'Volviste al área de obra. Escribí MENU para consultar tus operaciones vigentes. Este vínculo de cuenta no concede permisos de campo.'};
 if(choice&&Object.hasOwn(OFFICE_CHAT_LINKS,choice))return {type:'text',body:OFFICE_CHAT_LINKS[choice]+'\n\nIngresá con tu cuenta habitual. Los permisos se comprueban en la plataforma. Escribí CUENTA para volver al menú o CAMPO para volver a tus operaciones de obra.'};
 const nonce=digest(['office-chat-menu-v1',eventId]).slice(0,20);
 return {type:'interactive',body:'Tu cuenta de oficina está vinculada para navegar. Las decisiones y autorizaciones se realizan en la plataforma con tu sesión personal.',button:'Mi cuenta',sections:[{title:'Cuenta de oficina',rows:[['WORKS','Mis obras'],['TEAM','Equipo'],['SETTINGS','Mi WhatsApp'],['ACCOUNT','Mi cuenta'],['FIELD','Volver a obra']].map(([value,title])=>({id:'cuenta:'+nonce+':'+value,title}))}]};
}
export const officeChatChoice=message=>/^cuenta:([a-f0-9]{20}):(WORKS|TEAM|SETTINGS|ACCOUNT|FIELD)$/.exec(message?.interactive?.list_reply?.id||message?.interactive?.button_reply?.id||'');
