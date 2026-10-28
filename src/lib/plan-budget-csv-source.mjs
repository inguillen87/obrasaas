// Explicit flat CSV observations. This is not a CyP workbook, schedule,
// financial approval or document recognition result. Every value stays text.
import {createHash} from 'node:crypto';
import {WorkspaceError} from './workspace-policy.mjs';

export const PLAN_BUDGET_CSV_PROFILE='SOURCE_BUDGET_CSV_V1';
export const PLAN_BUDGET_CSV_CONSENT='plan-source-budget-csv-local-v1';
export const PLAN_BUDGET_CSV_PURPOSE='READ_ONLY_BUDGET_SOURCE';
export const PLAN_BUDGET_CSV_TYPE='text/csv';
export const PLAN_BUDGET_CSV_LIMITS=Object.freeze({rows:200,fileBytes:3*1024*1024,proofBytes:2*1024*1024,code:128,title:2000,unit:128,value:256,page:80});
export const PLAN_BUDGET_CSV_HEADERS=Object.freeze(['pagina','codigo','descripcion','unidad_original','cantidad_original','precio_unitario_original','total_iva_incluido_original']);
const sourceKeys=['version','profile','purpose','sourceSha256','contentType','headers','rows','currency','warnings','formulasEvaluated','calendarDatesInferred','taskWrites','stockWrites','paymentWrites','amountsCalculated','sourceDigest'];
const rowKeys=['sourceRowId','code','sourceTitle','rawUnit','rawQuantity','rawUnitPrice','rawLineAmount','provenance','issues','reviewRequired','automaticUseAllowed'];
const flagKeys=['formulasEvaluated','calendarDatesInferred','taskWrites','stockWrites','paymentWrites','amountsCalculated'];
const baseWarnings=['CURRENCY_UNCONFIRMED','ALL_VALUES_REQUIRE_SOURCE_REVIEW'];
const fail=(code='PLAN_IMPORT_BUDGET_CSV_INVALID',status=400)=>{throw new WorkspaceError(code,status);};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const sha=value=>createHash('sha256').update(value).digest('hex');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const exact=(value,keys)=>plain(value)&&!Object.getOwnPropertySymbols(value).length&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const literal=(value,max,required=false)=>typeof value==='string'&&value.length<=max&&(!required||Boolean(value.trim()))&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const frozen=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);}return value;};
const issuesFor=row=>[row.code,row.sourceTitle,row.rawUnit,row.rawQuantity,row.rawUnitPrice,row.rawLineAmount,row.provenance.pageLiteral].some(value=>/^\s*[=+@-]/u.test(value))?['FORMULA_LIKE_TEXT']:[];
const warningsFor=rows=>[...baseWarnings,...(rows.some(row=>row.issues.length)?['FORMULA_LIKE_TEXT_PRESENT']:[])];

export function decodePlanBudgetCsvText(bytes){
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>PLAN_BUDGET_CSV_LIMITS.fileBytes)fail('PLAN_IMPORT_FILE_TOO_LARGE',413);
 let value;try{value=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{fail('PLAN_IMPORT_BUDGET_CSV_ENCODING_INVALID');}
 // A UTF-8 BOM is only an encoding marker. Original bytes/hash are unchanged.
 if(value.charCodeAt(0)===0xfeff)value=value.slice(1);
 if(!literal(value,PLAN_BUDGET_CSV_LIMITS.fileBytes,true))fail();
 return value;
}

function records(text){
 const result=[];let cells=[],value='',quoted=false,closed=false,line=1,start=1;
 const cell=()=>{cells.push(value);value='';closed=false;if(cells.length>PLAN_BUDGET_CSV_HEADERS.length)fail();};
 const record=()=>{cell();result.push({cells,lineStart:start,lineEnd:line});cells=[];if(result.length>PLAN_BUDGET_CSV_LIMITS.rows+1)fail('PLAN_IMPORT_BUDGET_CSV_ROWS_LIMIT',413);};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}
   else{value+=c;if(c==='\r'){if(text[i+1]==='\n'){value+='\n';i++;}line++;}else if(c==='\n')line++;}
  }else if(c==='"'){if(value||closed)fail();quoted=true;}
  else if(c===',')cell();
  else if(c==='\r'||c==='\n'){record();if(c==='\r'&&text[i+1]==='\n')i++;line++;start=line;}
  else{if(closed)fail();value+=c;}
  if(value.length>PLAN_BUDGET_CSV_LIMITS.title)fail();
 }
 if(quoted)fail();
 if(value||closed||cells.length)record();
 if(result.length<2)fail();
 if(!same(result[0].cells,PLAN_BUDGET_CSV_HEADERS))fail('PLAN_IMPORT_BUDGET_CSV_HEADERS_INVALID');
 return result.slice(1);
}

function validate(source){
 if(!exact(source,sourceKeys)||source.version!==1||source.profile!==PLAN_BUDGET_CSV_PROFILE||source.purpose!==PLAN_BUDGET_CSV_PURPOSE||source.contentType!==PLAN_BUDGET_CSV_TYPE||!hash(source.sourceSha256)||!hash(source.sourceDigest)||!same(source.headers,PLAN_BUDGET_CSV_HEADERS)||!Array.isArray(source.rows)||!source.rows.length||source.rows.length>PLAN_BUDGET_CSV_LIMITS.rows||!exact(source.currency,['code','status'])||source.currency.code!==null||source.currency.status!=='UNKNOWN'||flagKeys.some(key=>source[key]!==false))fail();
 const codes=new Set();let previousLine=1;
 source.rows.forEach((row,index)=>{
  const p=row?.provenance;
  if(!exact(row,rowKeys)||!literal(row.code,PLAN_BUDGET_CSV_LIMITS.code,true)||!literal(row.sourceTitle,PLAN_BUDGET_CSV_LIMITS.title,true)||!literal(row.rawUnit,PLAN_BUDGET_CSV_LIMITS.unit)||['rawQuantity','rawUnitPrice','rawLineAmount'].some(key=>!literal(row[key],PLAN_BUDGET_CSV_LIMITS.value))||!exact(p,['record','lineStart','lineEnd','pageLiteral'])||p.record!==index+2||!Number.isSafeInteger(p.lineStart)||!Number.isSafeInteger(p.lineEnd)||p.lineStart!==previousLine+1||p.lineEnd<p.lineStart||p.lineEnd>PLAN_BUDGET_CSV_LIMITS.fileBytes||!literal(p.pageLiteral,PLAN_BUDGET_CSV_LIMITS.page)||row.sourceRowId!=='csv:'+p.record||row.reviewRequired!==true||row.automaticUseAllowed!==false||!same(row.issues,issuesFor(row)))fail();
  if(codes.has(row.code))fail('PLAN_IMPORT_BUDGET_CSV_DUPLICATE_CODES');codes.add(row.code);previousLine=p.lineEnd;
 });
 if(!same(source.warnings,warningsFor(source.rows)))fail();
 const {sourceDigest:ignored,...payload}=source;void ignored;
 const text=JSON.stringify(canonical(payload));
 if(Buffer.byteLength(text)+100>PLAN_BUDGET_CSV_LIMITS.proofBytes)fail('PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',413);
 return sha(text);
}

export const planBudgetCsvSourceDigest=source=>validate(source);
export function extractPlanBudgetCsvSource(bytes,contentType,{sourceSha256=null}={}){
 if(contentType!==PLAN_BUDGET_CSV_TYPE)fail();
 const text=decodePlanBudgetCsvText(bytes);
 const actualSha=sha(bytes);if(sourceSha256!==null&&sourceSha256!==actualSha)fail('PLAN_IMPORT_BUDGET_SOURCE_SHA_MISMATCH');
 const rows=records(text).map((record,index)=>{
  if(record.cells.length!==PLAN_BUDGET_CSV_HEADERS.length)fail();
  const [pageLiteral,code,sourceTitle,rawUnit,rawQuantity,rawUnitPrice,rawLineAmount]=record.cells;
  const row={sourceRowId:'csv:'+(index+2),code,sourceTitle,rawUnit,rawQuantity,rawUnitPrice,rawLineAmount,provenance:{record:index+2,lineStart:record.lineStart,lineEnd:record.lineEnd,pageLiteral},issues:[],reviewRequired:true,automaticUseAllowed:false};
  row.issues=issuesFor(row);return row;
 });
 const source={version:1,profile:PLAN_BUDGET_CSV_PROFILE,purpose:PLAN_BUDGET_CSV_PURPOSE,sourceSha256:actualSha,contentType,headers:[...PLAN_BUDGET_CSV_HEADERS],rows,currency:{code:null,status:'UNKNOWN'},warnings:warningsFor(rows),...Object.fromEntries(flagKeys.map(key=>[key,false])),sourceDigest:'0'.repeat(64)};
 source.sourceDigest=validate(source);return frozen(source);
}
