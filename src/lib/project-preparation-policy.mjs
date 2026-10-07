import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {SITE_ROLES} from './site-register-policy.mjs';
export const PROJECT_PREPARATION_ACTION='SAVE_PREPARATION';
export const canPrepareProject=role=>['ADMIN','DIRECTOR'].includes(role);
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const teamId=value=>typeof value==='string'&&new RegExp('^planned_team_'+uuid+'$').test(value);
const slotId=value=>typeof value==='string'&&new RegExp('^planned_slot_'+uuid+'$').test(value);
const invalid=()=>{throw new WorkspaceError('PROJECT_PREPARATION_INPUT_INVALID',422);};
function keys(value,fields){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==[...fields].sort().join('|'))invalid();}
export function preparationText(value,max,min=0){
 if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(value)||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))invalid();
 const text=value.trim().normalize('NFC');if(text.length<min||text.length>max)invalid();return text;
}
export function preparationRoster(teams,slots){
 if(!Array.isArray(teams)||teams.length>20||!Array.isArray(slots)||slots.length>50)invalid();
 const ids=new Set(),result=teams.map(value=>{
  keys(value,['id','label','engagement','headcount','note','status']);
  if(!teamId(value.id)||ids.has(value.id)||!['IN_HOUSE','SUBCONTRACTED'].includes(value.engagement)||value.status!=='PLANNED'||value.headcount!==null&&(!Number.isSafeInteger(value.headcount)||value.headcount<1||value.headcount>99))invalid();ids.add(value.id);
  return {id:value.id,label:preparationText(value.label,100,2),engagement:value.engagement,headcount:value.headcount,note:preparationText(value.note,500),status:'PLANNED'};
 });
 const slotIds=new Set(),places=slots.map(value=>{
  keys(value,['id','teamId','label','job','note','provisional','status']);
  if(!slotId(value.id)||slotIds.has(value.id)||!ids.has(value.teamId)||!Object.hasOwn(SITE_ROLES,value.job)||value.provisional!==true||value.status!=='PLANNED')invalid();slotIds.add(value.id);
  return {id:value.id,teamId:value.teamId,label:preparationText(value.label,100,2),job:value.job,note:preparationText(value.note,300),provisional:true,status:'PLANNED'};
 });
 for(const team of result)if(team.headcount!==null&&places.filter(slot=>slot.teamId===team.id).length>team.headcount)invalid();
 return {teams:result,slots:places};
}
export function preparationContext(input){if(!workspaceId(input?.projectId)||!/^[a-f0-9]{64}$/.test(input?.scope||''))throw new WorkspaceError('PROJECT_PREPARATION_QUERY_INVALID',400);return input;}
export function normalizeProjectPreparation(input){
 keys(input,['operationId','scope','projectId','action','payload']);preparationContext(input);
 if(input.action==='CANCEL_PENDING_PREPARATION'){if(!operationId(input.operationId))invalid();keys(input.payload,['confirmed']);if(input.payload.confirmed!==true)invalid();return {...input,operationId:input.operationId.toLowerCase(),payload:{confirmed:true}};}
 if(!operationId(input.operationId)||input.action!==PROJECT_PREPARATION_ACTION)invalid();
 const p=input.payload;keys(p,['expectedRevision','expectedDetailsDigest','name','clientName','address','teams','slots','reason']);
 if(!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0||p.expectedRevision>=2147483647||!/^[a-f0-9]{64}$/.test(p.expectedDetailsDigest||''))invalid();
 return {...input,operationId:input.operationId.toLowerCase(),payload:{expectedRevision:p.expectedRevision,expectedDetailsDigest:p.expectedDetailsDigest,name:preparationText(p.name,120,2),clientName:preparationText(p.clientName,120),address:preparationText(p.address,300),...preparationRoster(p.teams,p.slots),reason:preparationText(p.reason,500,8)}};
}
export const preparationReceiptId=(actorId,projectId,op)=>'project_preparation_'+digest([actorId,projectId,op.toLowerCase()]);
export const preparationRequestDigest=input=>digest(['project-preparation-v1',input.projectId,input.scope,input.action,input.payload]);
