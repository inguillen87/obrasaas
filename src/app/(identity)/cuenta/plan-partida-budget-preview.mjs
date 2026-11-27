// Browser-only observation binding. No server normalizer, money calculation or authority.
import {planCsvBudgetDescriptor,validatePlanCsvBudgetDetail} from './plan-import-csv-budget-view.mjs';
export const PLAN_BUDGET_SOURCE_PROFILE='SOURCE_BUDGET_CYP_V2';
export const PLAN_BUDGET_SOURCE_CONSENT='plan-source-budget-local-v1';
export const PLAN_BUDGET_SOURCE_PURPOSE='READ_ONLY_BUDGET_SOURCE';
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const text=(value,max=2000)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f<>]/.test(value);
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const fail=status=>({status});
const types=['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel.sheet.macroenabled.12'];
function canonical(value,depth=0,state={nodes:0}){
 if(depth>64||++state.nodes>200000)throw new Error('BUDGET_SOURCE_LIMIT');
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(Array.isArray(value))return value.map(item=>canonical(item,depth+1,state));
 if(!record(value)||Object.getOwnPropertySymbols(value).length)throw new Error('BUDGET_SOURCE_SHAPE');
 return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key],depth+1,state)]));
}
async function digest(value){const bytes=new TextEncoder().encode(JSON.stringify(canonical(value)));if(bytes.length>2*1024*1024)throw new Error('BUDGET_SOURCE_LIMIT');return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');}
export async function planPartidaBudgetDigest(source){const normalized=canonical(source);if(new TextEncoder().encode(JSON.stringify(normalized)).length>2*1024*1024)throw new Error('BUDGET_SOURCE_LIMIT');const {sourceDigest:ignored,...payload}=normalized;void ignored;return digest(payload);}
export function planPartidaBudgetDescriptor(value,{projectId,sourceSha256}={}){if(value?.profile==='SOURCE_BUDGET_CSV_V1')return planCsvBudgetDescriptor(value,{projectId,sourceSha256});return exact(value,['version','profile','purpose','projectId','sourceSha256','sourceDigest','measurementSourceDigest','rowCount','currency'])&&value.version===2&&value.profile===PLAN_BUDGET_SOURCE_PROFILE&&value.purpose===PLAN_BUDGET_SOURCE_PURPOSE&&value.projectId===projectId&&value.sourceSha256===sourceSha256&&hash(value.sourceSha256)&&hash(value.sourceDigest)&&hash(value.measurementSourceDigest)&&Number.isSafeInteger(value.rowCount)&&value.rowCount>=1&&value.rowCount<=200&&exact(value.currency,['code','status'])&&value.currency.code===null&&value.currency.status==='UNKNOWN';}
export function planPartidaBudgetCatalog(listing,{projectId,scope,owner,canonicalAccess}){
 if(canonicalAccess!==true||listing?.canApprove!==true)return null;
 if(!owner||!text(projectId,180)||!hash(scope)||listing.projectId!==projectId||listing.scope!==scope||!Array.isArray(listing.drafts)||listing.drafts.length>20||typeof listing.truncated!=='boolean')throw new Error('No se puede comprobar la lista de presupuestos de esta obra.');
 const entries=listing.drafts.filter(value=>value?.budgetImport===true).map(value=>{if(Object.hasOwn(value,'budgetSource'))throw new Error('La lista incluyó un detalle de presupuesto no solicitado.');return {id:value.id,revision:value.revision,status:value.status,budgetImport:true,source:value.source?{sha256:value.source.sha256,contentType:value.source.contentType}:null,budgetDescriptor:value.budgetDescriptor?structuredClone(value.budgetDescriptor):null};});
 return {owner,projectId,scope,canApprove:true,truncated:listing.truncated,entries};
}
export function planPartidaBudgetCandidate({catalog,view,selected}){
 if(!catalog||catalog.canApprove!==true)return fail('NO_ACCESS_OR_LIST');
 if(!view||catalog.projectId!==view.projectId||catalog.scope!==view.scope||!hash(view.sourceSha256)||!view.items?.some(row=>row.code===selected?.code&&row.sourceRange===selected?.sourceRange))return fail('CONTEXT_MISMATCH');
 if(catalog.truncated)return fail('INCOMPLETE_LIST');const candidates=catalog.entries.filter(row=>row.source?.sha256===view.sourceSha256);
 if(candidates.length!==1)return fail(candidates.length?'AMBIGUOUS':'NO_MATCH');const entry=candidates[0];
 if(entry.status!=='READY'||!text(entry.id,180)||!Number.isSafeInteger(entry.revision)||entry.revision<1||!types.includes(entry.source?.contentType)||!planPartidaBudgetDescriptor(entry.budgetDescriptor,{projectId:catalog.projectId,sourceSha256:view.sourceSha256}))return fail('SOURCE_UNAVAILABLE');
 return {status:'MATCH',entry};
}
function checkedRows(source){
 const codes=new Set(),budgetRanges=new Set(),planRanges=new Set();
 return source.rows.every(row=>{const b=row?.budget,p=row?.plan,br=/^CyP Integral completo!B([1-9]\d{0,5}):K\1$/.exec(row?.sourceRowId||''),pr=/^Plan de trabajo!A([1-9]\d{0,5}):D\1$/.exec(row?.physicalSourceRowId||'');
  if(!br||!pr||!text(row.code,128)||!/^[AB]\.1\.\d{1,3}\.\d{1,3}$/.test(row.code)||row.parentCode!==row.code.slice(0,row.code.lastIndexOf('.'))||codes.has(row.code)||budgetRanges.has(row.sourceRowId)||planRanges.has(row.physicalSourceRowId)||!text(row.sourceTitle,2000)||b?.worksheet!=='CyP Integral completo'||b.row!==br[1]||p?.worksheet!=='Plan de trabajo'||p.row!==pr[1]||b.cells?.code?.value!==row.code||p.cells?.code?.value!==row.code||p.identityReference?.status!=='RESOLVED'||p.identityReference.worksheet!==b.worksheet||p.identityReference.address!=='B'+b.row||row.reviewRequired!==true||row.automaticUseAllowed!==false||!Array.isArray(row.issues)||row.issues.some(value=>!text(value,160)))return false;
  for(const [name,bc,pc]of [['code','B','A'],['title','C','B'],['unit','D','C'],['quantity','E','D'],['unitPrice','H','E'],['lineAmount','K','F']])if(b.cells[name]?.address!==bc+b.row||p.cells[name]?.address!==pc+p.row)return false;
  for(const name of ['quantity','unitPrice','lineAmount']){const value=row.observed?.[name],link=p.links?.[name];if(!record(value)||typeof value.savedValuePresent!=='boolean'||typeof value.formulaCachePresent!=='boolean'||value.decimal!==null&&(typeof value.decimal!=='string'||value.decimal.length>128)||!Array.isArray(value.issues)||!record(link)||typeof link.referenceMatches!=='boolean'||link.expectedAddress!==b.cells[name].address||!record(link.observation))return false;}
  if(row.originalRawUnit!==null&&typeof row.originalRawUnit!=='string'||row.planRawUnit!==null&&typeof row.planRawUnit!=='string')return false;
  codes.add(row.code);budgetRanges.add(row.sourceRowId);planRanges.add(row.physicalSourceRowId);return true;
 });
}
async function checkedStyles(source){
 if(!record(source.styleTable)||!Object.keys(source.styleTable).length)return false;const used=new Set();let valid=true;
 for(const [id,style]of Object.entries(source.styleTable))if(!hash(id)||!exact(style,['attributes','baseAttributes','formatCode','index','numFmtId','source'])||await digest(style)!==id)return false;
 const walk=value=>{if(Array.isArray(value)){value.forEach(walk);return;}if(!record(value))return;if(typeof value.address==='string'&&typeof value.present==='boolean'&&typeof value.cachePresent==='boolean'&&Object.hasOwn(value,'formulaAttributes')){if(Object.hasOwn(value,'style')||!hash(value.styleRef)||!Object.hasOwn(source.styleTable,value.styleRef))valid=false;else used.add(value.styleRef);}Object.values(value).forEach(walk);};
 const {styleTable:ignored,...payload}=source;void ignored;walk(payload);return valid&&used.size===Object.keys(source.styleTable).length;
}
export async function validatePlanPartidaBudgetDetail(draft,{projectId,descriptor,expectedId,expectedRevision}){
 if(descriptor?.profile==='SOURCE_BUDGET_CSV_V1')return validatePlanCsvBudgetDetail(draft,{projectId,descriptor,expectedId,expectedRevision});
 try{if(draft?.budgetImport!==true||draft.financialSource!==true||draft.id!==expectedId||draft.revision!==expectedRevision||draft.status!=='READY'||draft.projectId!==undefined&&draft.projectId!==projectId||!types.includes(draft.source?.contentType)||!planPartidaBudgetDescriptor(descriptor,{projectId,sourceSha256:draft.source?.sha256})||JSON.stringify(canonical(draft.budgetDescriptor))!==JSON.stringify(canonical(descriptor)))return fail('SOURCE_MISMATCH');
  const source=canonical(draft.budgetSource);if(source.version!==2||source.profile!==PLAN_BUDGET_SOURCE_PROFILE||source.purpose!==PLAN_BUDGET_SOURCE_PURPOSE||source.sourceSha256!==descriptor.sourceSha256||source.sourceDigest!==descriptor.sourceDigest||source.measurementSourceDigest!==descriptor.measurementSourceDigest||source.contentType!==draft.source.contentType||source.currency?.code!==null||source.currency?.status!=='UNKNOWN'||!Array.isArray(source.rows)||source.rows.length!==descriptor.rowCount||source.rows.length>200||['formulasEvaluated','macrosExecuted','unitsConverted','calendarDatesInferred','taskWrites','stockWrites'].some(key=>source[key]!==false)||!checkedRows(source))return fail('SOURCE_MISMATCH');
  if(await planPartidaBudgetDigest(source)!==descriptor.sourceDigest||!await checkedStyles(source))return fail('DIGEST_MISMATCH');
  return {status:'BOUND',source,draftId:draft.id,revision:draft.revision,sourceDigest:descriptor.sourceDigest};
 }catch{return fail('UNCONFIRMED');}
}
export function resolvePlanPartidaBudgetRow(source,{view,selected}){
 if(source?.sourceSha256!==view?.sourceSha256||!view?.items?.some(row=>row.code===selected?.code&&row.sourceRange===selected?.sourceRange))return fail('SOURCE_MISMATCH');
 const range=/^Plan de trabajo!A([1-9]\d{0,5}):BE\1$/.exec(selected?.sourceRange||''),rows=source.rows.filter(row=>row.code===selected.code);if(!range||rows.length!==1||rows[0].parentCode!==selected.parentCode||rows[0].physicalSourceRowId!=='Plan de trabajo!A'+range[1]+':D'+range[1])return fail('SOURCE_MISMATCH');return {status:'BOUND',row:rows[0]};
}
export const planPartidaBudgetNotices={NO_ACCESS_OR_LIST:'No hay una lista vigente de presupuestos autorizados.',NO_MATCH:'No hay una lectura de presupuesto de este mismo archivo. Elegí Cómputo y presupuesto (lectura) al cargar el Excel.',INCOMPLETE_LIST:'La lista está limitada. Consultá los borradores por su referencia; no podemos afirmar un vínculo único.',AMBIGUOUS:'Hay más de una lectura para el mismo archivo. Revisá sus referencias; no elegimos una automáticamente.',CONTEXT_MISMATCH:'Cambió la obra o el permiso. Actualizá la consulta.',SOURCE_UNAVAILABLE:'La lectura todavía no tiene un detalle listo y comprobable.',SOURCE_MISMATCH:'La obra, el archivo, la partida o sus celdas no coinciden. Revisá las referencias.',DIGEST_MISMATCH:'La lectura no coincide con su huella. Consultá nuevamente la fuente.',UNCONFIRMED:'No pudimos comprobar este presupuesto. Actualizá la consulta.'};
