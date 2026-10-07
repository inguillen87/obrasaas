// Browser-safe public projection. Planned places never identify a participant.
import {PROJECT_PREPARATION_SNAPSHOT_KEYS,projectPreparationReceiptOutcome} from './workspace-recovery-journal.mjs';
export const PREPARATION_JOBS=Object.freeze({WORKER:'Operario',FOREMAN:'Encargado',ARCHITECT:'Dirección técnica',OWNER:'Comitente',SAFETY:'Seguridad e higiene',SUPPLIER:'Proveedor'});
const fail=()=>{throw Object.assign(new Error('La respuesta no coincide con la preparación de esta obra.'),{code:'PROJECT_PREPARATION_CONTEXT_CHANGED',status:409});};
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...expected].sort().join('|');
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const text=(value,max,min=0)=>typeof value==='string'&&value.length>=min&&value.length<=max&&!/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(value)&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
const snapshotKeys=PROJECT_PREPARATION_SNAPSHOT_KEYS;
export function projectPreparationSnapshot(value,context){
 if(!keys(value,snapshotKeys)||value.scope!==context.scope||value.projectId!==context.projectId||!sha(value.scope)||!sha(value.detailsDigest)||value.canManage!==true||!Number.isSafeInteger(value.revision)||value.revision<0||value.revision>2147483647||!text(value.name,120,2)||!text(value.clientName,120)||!text(value.address,300)||value.startStatus!=='TO_CONFIRM'||value.declarationOnly!==true||!Array.isArray(value.teams)||value.teams.length>20||!Array.isArray(value.slots)||value.slots.length>50)fail();
 const ids=new Set(),slots=new Set();for(const team of value.teams){if(!keys(team,['id','label','engagement','headcount','note','status'])||!new RegExp('^planned_team_'+uuid+'$').test(team.id)||ids.has(team.id)||!text(team.label,100,2)||!text(team.note,500)||!['IN_HOUSE','SUBCONTRACTED'].includes(team.engagement)||team.status!=='PLANNED'||team.headcount!==null&&(!Number.isSafeInteger(team.headcount)||team.headcount<1||team.headcount>99))fail();ids.add(team.id);}
 for(const slot of value.slots){if(!keys(slot,['id','teamId','label','job','note','provisional','status'])||!new RegExp('^planned_slot_'+uuid+'$').test(slot.id)||slots.has(slot.id)||!ids.has(slot.teamId)||!text(slot.label,100,2)||!text(slot.note,300)||!Object.hasOwn(PREPARATION_JOBS,slot.job)||slot.provisional!==true||slot.status!=='PLANNED')fail();slots.add(slot.id);}
 for(const team of value.teams)if(team.headcount!==null&&value.slots.filter(slot=>slot.teamId===team.id).length>team.headcount)fail();
 return structuredClone(value);
}
export function projectPreparationOutcome(value,reference){
 if(!projectPreparationReceiptOutcome(value,reference))fail();
 if(value.state==='NOT_OBSERVED'||value.state==='CANCELLED')return structuredClone(value);
 const snapshot=Object.fromEntries(snapshotKeys.map(key=>[key,value[key]]));projectPreparationSnapshot(snapshot,reference);return structuredClone(value);
}
export const projectPreparationPublicSnapshot=value=>Object.fromEntries(snapshotKeys.map(key=>[key,value[key]]));
export function projectPreparationDraft(value){return {expectedRevision:value.revision,expectedDetailsDigest:value.detailsDigest,name:value.name,clientName:value.clientName,address:value.address,teams:structuredClone(value.teams),slots:structuredClone(value.slots),reason:''};}
export const preparationReadDenied=error=>error?.status===401||error?.status===403||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE','PROJECT_PREPARATION_CONTEXT_CHANGED'].includes(error?.code);
