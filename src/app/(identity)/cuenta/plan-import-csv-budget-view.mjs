// Browser-side binding for a deterministic CSV reading, independent of CyP.
export const PLAN_CSV_BUDGET_PROFILE='SOURCE_BUDGET_CSV_V1';
export const PLAN_CSV_BUDGET_CONSENT='plan-source-budget-csv-local-v1';
export const PLAN_CSV_BUDGET_HEADERS=Object.freeze(['pagina','codigo','descripcion','unidad_original','cantidad_original','precio_unitario_original','total_iva_incluido_original']);
export const PLAN_CSV_BUDGET_ENCODINGS=Object.freeze(['UTF-8','WINDOWS-1252']);
export const PLAN_CSV_BUDGET_DELIMITERS=Object.freeze([',',';']);
const purpose='READ_ONLY_BUDGET_SOURCE';
const sourceKeys=['version','profile','purpose','sourceSha256','contentType','encoding','delimiter','headers','rows','currency','warnings','formulasEvaluated','calendarDatesInferred','taskWrites','stockWrites','paymentWrites','amountsCalculated','sourceDigest'];
const legacySourceKeys=sourceKeys.filter(key=>!['encoding','delimiter'].includes(key));
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const literal=(value,max,required=false)=>typeof value==='string'&&value.length<=max&&(!required||value.trim().length>0)&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value);
const unknownCurrency=value=>exact(value,['code','status'])&&value.code===null&&value.status==='UNKNOWN';
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
function canonical(value,depth=0,state={nodes:0}){
 if(depth>16||++state.nodes>20000)throw new Error('CSV_BUDGET_LIMIT');
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(Array.isArray(value))return value.map(item=>canonical(item,depth+1,state));
 if(!record(value)||Object.getOwnPropertySymbols(value).length)throw new Error('CSV_BUDGET_SHAPE');
 return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key],depth+1,state)]));
}
export function planCsvBudgetDescriptor(value,{projectId,sourceSha256}={}){
 return exact(value,['version','profile','purpose','projectId','sourceSha256','sourceDigest','rowCount','currency'])&&value.version===1&&value.profile===PLAN_CSV_BUDGET_PROFILE&&value.purpose===purpose&&typeof projectId==='string'&&value.projectId===projectId&&value.sourceSha256===sourceSha256&&hash(sourceSha256)&&hash(value.sourceDigest)&&Number.isSafeInteger(value.rowCount)&&value.rowCount>=1&&value.rowCount<=200&&unknownCurrency(value.currency);
}
function rowsValid(rows){
 const codes=new Set();let lastLine=1;
 return rows.every((row,index)=>{
  if(!exact(row,['sourceRowId','code','sourceTitle','rawUnit','rawQuantity','rawUnitPrice','rawLineAmount','provenance','issues','reviewRequired','automaticUseAllowed'])||!literal(row.code,128,true)||codes.has(row.code)||!literal(row.sourceTitle,2000,true)||!literal(row.rawUnit,128)||!['rawQuantity','rawUnitPrice','rawLineAmount'].every(key=>literal(row[key],256))||row.reviewRequired!==true||row.automaticUseAllowed!==false||!Array.isArray(row.issues)||row.issues.length>1||row.issues.some(issue=>issue!=='FORMULA_LIKE_TEXT'))return false;
  const p=row.provenance;
  if(!exact(p,['record','lineStart','lineEnd','pageLiteral'])||p.record!==index+2||row.sourceRowId!=='csv:'+p.record||!Number.isSafeInteger(p.lineStart)||!Number.isSafeInteger(p.lineEnd)||p.lineStart!==lastLine+1||p.lineEnd<p.lineStart||p.lineEnd>3*1024*1024||!literal(p.pageLiteral,80))return false;
  const formula=[row.code,row.sourceTitle,row.rawUnit,row.rawQuantity,row.rawUnitPrice,row.rawLineAmount,p.pageLiteral].some(value=>/^\s*[=+@-]/u.test(value));if(!same(row.issues,formula?['FORMULA_LIKE_TEXT']:[]))return false;
  codes.add(row.code);lastLine=p.lineEnd;return true;
 });
}
export async function validatePlanCsvBudgetDetail(draft,{projectId,descriptor,expectedId,expectedRevision}={}){
 try{
  if(draft?.budgetImport!==true||draft.financialSource!==true||draft.id!==expectedId||draft.revision!==expectedRevision||draft.status!=='READY'||draft.projectId!==undefined&&draft.projectId!==projectId||draft.source?.contentType!=='text/csv'||!planCsvBudgetDescriptor(descriptor,{projectId,sourceSha256:draft.source?.sha256})||!same(canonical(draft.budgetDescriptor),canonical(descriptor)))return {status:'SOURCE_MISMATCH'};
  const source=canonical(draft.budgetSource),explicitFormat=exact(source,sourceKeys),legacyFormat=exact(source,legacySourceKeys);
  if(!explicitFormat&&!legacyFormat||source.version!==1||source.profile!==PLAN_CSV_BUDGET_PROFILE||source.purpose!==purpose||source.sourceSha256!==descriptor.sourceSha256||source.sourceDigest!==descriptor.sourceDigest||source.contentType!=='text/csv'||explicitFormat&&(!PLAN_CSV_BUDGET_ENCODINGS.includes(source.encoding)||!PLAN_CSV_BUDGET_DELIMITERS.includes(source.delimiter))||!same(source.headers,PLAN_CSV_BUDGET_HEADERS)||!unknownCurrency(source.currency)||!Array.isArray(source.rows)||source.rows.length!==descriptor.rowCount||!rowsValid(source.rows)||['formulasEvaluated','calendarDatesInferred','taskWrites','stockWrites','paymentWrites','amountsCalculated'].some(key=>source[key]!==false))return {status:'SOURCE_MISMATCH'};
  const warnings=['CURRENCY_UNCONFIRMED','ALL_VALUES_REQUIRE_SOURCE_REVIEW',...(source.rows.some(row=>row.issues.length)?['FORMULA_LIKE_TEXT_PRESENT']:[])];
  if(!same(source.warnings,warnings))return {status:'SOURCE_MISMATCH'};
  const bytes=new TextEncoder().encode(JSON.stringify(source));if(bytes.length>2*1024*1024)return {status:'SOURCE_MISMATCH'};
  const {sourceDigest:ignored,...payload}=source;void ignored;
  const digest=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)))),value=>value.toString(16).padStart(2,'0')).join('');
  if(digest!==descriptor.sourceDigest)return {status:'DIGEST_MISMATCH'};
  return {status:'BOUND',source,draftId:draft.id,revision:draft.revision,sourceDigest:descriptor.sourceDigest};
 }catch{return {status:'UNCONFIRMED'};}
}
