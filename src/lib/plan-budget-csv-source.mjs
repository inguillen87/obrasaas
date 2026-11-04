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
// Explicit reading facts kept with the source. Excel in Spanish (Argentina) saves
// "CSV (delimitado por comas)" with semicolons and Windows-1252 text.
export const PLAN_BUDGET_CSV_ENCODINGS=Object.freeze(['UTF-8','WINDOWS-1252']);
export const PLAN_BUDGET_CSV_DELIMITERS=Object.freeze([',',';']);
const sourceKeys=['version','profile','purpose','sourceSha256','contentType','encoding','delimiter','headers','rows','currency','warnings','formulasEvaluated','calendarDatesInferred','taskWrites','stockWrites','paymentWrites','amountsCalculated','sourceDigest'];
const legacySourceKeys=sourceKeys.filter(key=>!['encoding','delimiter'].includes(key));
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

// Deterministic decoding, recorded in the source: a UTF-8 BOM or valid UTF-8 is
// UTF-8; any other byte sequence is read as Windows-1252 unless it uses one of the
// code points Windows-1252 leaves undefined. UTF-16 exports are rejected, never guessed.
export function readPlanBudgetCsvText(bytes){
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>PLAN_BUDGET_CSV_LIMITS.fileBytes)fail('PLAN_IMPORT_FILE_TOO_LARGE',413);
 const encodingInvalid=()=>fail('PLAN_IMPORT_BUDGET_CSV_ENCODING_INVALID');
 if(bytes.length>=2&&(bytes[0]===0xff&&bytes[1]===0xfe||bytes[0]===0xfe&&bytes[1]===0xff))encodingInvalid();
 const bom=bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf;
 let text,encoding;
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);encoding='UTF-8';}
 catch{if(bom)encodingInvalid();text=new TextDecoder('windows-1252').decode(bytes);encoding='WINDOWS-1252';if(/[\u0080-\u009f]/u.test(text))encodingInvalid();}
 // A UTF-8 BOM is only an encoding marker. Original bytes/hash are unchanged.
 if(text.charCodeAt(0)===0xfeff)text=text.slice(1);
 if(!literal(text,PLAN_BUDGET_CSV_LIMITS.fileBytes,true))fail();
 return {text,encoding};
}
export const decodePlanBudgetCsvText=bytes=>readPlanBudgetCsvText(bytes).text;

function parse(text,delimiter,maxRecords=Infinity){
 const result=[];let cells=[],value='',quoted=false,closed=false,line=1,start=1;
 const quotes=()=>fail('PLAN_IMPORT_BUDGET_CSV_QUOTES_INVALID');
 const cell=()=>{cells.push(value);value='';closed=false;if(cells.length>PLAN_BUDGET_CSV_HEADERS.length)fail('PLAN_IMPORT_BUDGET_CSV_COLUMNS_INVALID');};
 const record=()=>{cell();result.push({cells,lineStart:start,lineEnd:line});cells=[];if(result.length>PLAN_BUDGET_CSV_LIMITS.rows+1)fail('PLAN_IMPORT_BUDGET_CSV_ROWS_LIMIT',413);};
 for(let i=0;i<text.length&&result.length<maxRecords;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}
   else{value+=c;if(c==='\r'){if(text[i+1]==='\n'){value+='\n';i++;}line++;}else if(c==='\n')line++;}
  }else if(c==='"'){if(value||closed)quotes();quoted=true;}
  else if(c===delimiter)cell();
  else if(c==='\r'||c==='\n'){record();if(c==='\r'&&text[i+1]==='\n')i++;line++;start=line;}
  else{if(closed)quotes();value+=c;}
  if(value.length>PLAN_BUDGET_CSV_LIMITS.title)fail();
 }
 if(result.length<maxRecords){if(quoted)quotes();if(value||closed||cells.length)record();}
 return result;
}

// The header alone selects the separator: exactly the seven names separated by
// commas, or exactly the seven names separated by semicolons. Nothing is inferred
// from data rows, so a mixed file fails on its first divergent record.
function headerDelimiter(text){
 for(const delimiter of PLAN_BUDGET_CSV_DELIMITERS){let header=null;try{header=parse(text,delimiter,1)[0]?.cells;}catch{}if(header&&same(header,PLAN_BUDGET_CSV_HEADERS))return delimiter;}
 return fail('PLAN_IMPORT_BUDGET_CSV_HEADERS_INVALID');
}

function records(text,delimiter){
 const result=parse(text,delimiter);
 if(!result.length||!same(result[0].cells,PLAN_BUDGET_CSV_HEADERS))fail('PLAN_IMPORT_BUDGET_CSV_HEADERS_INVALID');
 if(result.length<2)fail();
 return result.slice(1);
}

function validate(source){
 // The original V1 source has neither reading fact. Validate that exact shape
 // with its original digest; never backfill fields into persisted evidence.
 const explicitFormat=exact(source,sourceKeys),legacyFormat=exact(source,legacySourceKeys);
 if(!explicitFormat&&!legacyFormat||source.version!==1||source.profile!==PLAN_BUDGET_CSV_PROFILE||source.purpose!==PLAN_BUDGET_CSV_PURPOSE||source.contentType!==PLAN_BUDGET_CSV_TYPE||explicitFormat&&(!PLAN_BUDGET_CSV_ENCODINGS.includes(source.encoding)||!PLAN_BUDGET_CSV_DELIMITERS.includes(source.delimiter))||!hash(source.sourceSha256)||!hash(source.sourceDigest)||!same(source.headers,PLAN_BUDGET_CSV_HEADERS)||!Array.isArray(source.rows)||!source.rows.length||source.rows.length>PLAN_BUDGET_CSV_LIMITS.rows||!exact(source.currency,['code','status'])||source.currency.code!==null||source.currency.status!=='UNKNOWN'||flagKeys.some(key=>source[key]!==false))fail();
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
 const {text,encoding}=readPlanBudgetCsvText(bytes);
 const actualSha=sha(bytes);if(sourceSha256!==null&&sourceSha256!==actualSha)fail('PLAN_IMPORT_BUDGET_SOURCE_SHA_MISMATCH');
 const delimiter=headerDelimiter(text);
 const rows=records(text,delimiter).map((record,index)=>{
  // An empty record (blank line, or a row of separators) and a row without code or
  // description (for example a chapter title) are rejected by name, never skipped.
  if(record.cells.every(cell=>!cell.trim()))fail('PLAN_IMPORT_BUDGET_CSV_ROW_INCOMPLETE');
  if(record.cells.length!==PLAN_BUDGET_CSV_HEADERS.length)fail('PLAN_IMPORT_BUDGET_CSV_COLUMNS_INVALID');
  const [pageLiteral,code,sourceTitle,rawUnit,rawQuantity,rawUnitPrice,rawLineAmount]=record.cells;
  if(!code.trim()||!sourceTitle.trim())fail('PLAN_IMPORT_BUDGET_CSV_ROW_INCOMPLETE');
  const row={sourceRowId:'csv:'+(index+2),code,sourceTitle,rawUnit,rawQuantity,rawUnitPrice,rawLineAmount,provenance:{record:index+2,lineStart:record.lineStart,lineEnd:record.lineEnd,pageLiteral},issues:[],reviewRequired:true,automaticUseAllowed:false};
  row.issues=issuesFor(row);return row;
 });
 const source={version:1,profile:PLAN_BUDGET_CSV_PROFILE,purpose:PLAN_BUDGET_CSV_PURPOSE,sourceSha256:actualSha,contentType,encoding,delimiter,headers:[...PLAN_BUDGET_CSV_HEADERS],rows,currency:{code:null,status:'UNKNOWN'},warnings:warningsFor(rows),...Object.fromEntries(flagKeys.map(key=>[key,false])),sourceDigest:'0'.repeat(64)};
 source.sourceDigest=validate(source);return frozen(source);
}
