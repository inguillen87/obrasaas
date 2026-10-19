// Observations only. Authorization remains the existing projectOperation and
// privileged extraction/financial draft; this module grants no access or writes.
import {createHash} from 'node:crypto';
import {WorkspaceError} from './workspace-policy.mjs';
import {PLAN_OOXML_LIMITS,PLAN_OOXML_TYPES,readPlanBudgetOoxml} from './plan-import-ooxml.mjs';
import {extractPlanMeasurementSource,planMeasurementSourceDigest,PLAN_MEASUREMENT_LIMITS} from './plan-measurement-source.mjs';

export const PLAN_BUDGET_SOURCE_PROFILE='SOURCE_BUDGET_CYP_V2';
export const PLAN_BUDGET_SOURCE_CONSENT='plan-source-budget-local-v1';
export const PLAN_BUDGET_SOURCE_PURPOSE='READ_ONLY_BUDGET_SOURCE';
export const PLAN_BUDGET_SOURCE_LIMITS=Object.freeze({rows:PLAN_MEASUREMENT_LIMITS.rows,controls:500,proofBytes:2*1024*1024});
const budgetSheet='CyP Integral completo',planSheet='Plan de trabajo';
const fail=(code='PLAN_IMPORT_BUDGET_SOURCE_INVALID',status=400)=>{throw new WorkspaceError(code,status);};
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const mime=value=>typeof value==='string'?value.split(';')[0].trim().toLowerCase():'';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function canonical(value,depth=0,state={nodes:0}){
 if(depth>64||++state.nodes>PLAN_OOXML_LIMITS.nodes)fail('PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',413);
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(Array.isArray(value))return value.map(item=>canonical(item,depth+1,state));
 if(!plain(value)||Object.getOwnPropertySymbols(value).length)fail();
 return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key],depth+1,state)]));
}
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const clone=value=>structuredClone(value);
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function digestPayload(payload){const normalized=canonical(payload),text=JSON.stringify(normalized),digest=sha(text);if(Buffer.byteLength(JSON.stringify({...normalized,sourceDigest:digest}))>PLAN_BUDGET_SOURCE_LIMITS.proofBytes)fail('PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',413);return digest;}
function envelope(source){if(!plain(source)||source.version!==2||source.profile!==PLAN_BUDGET_SOURCE_PROFILE||source.purpose!=='READ_ONLY_BUDGET_SOURCE'||!hash(source.sourceSha256)||!hash(source.measurementSourceDigest)||!PLAN_OOXML_TYPES[source.contentType]||!Array.isArray(source.rows)||!source.rows.length||source.rows.length>PLAN_BUDGET_SOURCE_LIMITS.rows||!Array.isArray(source.controlCells)||source.controlCells.length>PLAN_BUDGET_SOURCE_LIMITS.controls||source.currency?.code!==null||source.currency?.status!=='UNKNOWN')fail();}
// Only styles are interned. Cells, caches, raw attributes, shared masters and
// observed targets keep their existing shape. Content ids and all references
// are included in the source digest; the caller still supplies its trusted hash.
const styleKeys=['attributes','baseAttributes','formatCode','index','numFmtId','source'];
const cellFact=value=>plain(value)&&typeof value.address==='string'&&typeof value.present==='boolean'&&typeof value.cachePresent==='boolean'&&Object.hasOwn(value,'formulaAttributes');
function styleId(style){if(!plain(style)||JSON.stringify(Object.keys(style).sort())!==JSON.stringify(styleKeys))fail();return sha(JSON.stringify(canonical(style)));}
function transformStyles(value,convert,depth=0,state={nodes:0}){
 if(depth>64||++state.nodes>PLAN_OOXML_LIMITS.nodes)fail('PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',413);
 if(Array.isArray(value))return value.map(item=>transformStyles(item,convert,depth+1,state));
 if(!plain(value))return value;
 const fact=cellFact(value);
 return Object.fromEntries(Object.entries(value).map(([key,item])=>fact&&key===convert.from?[convert.to,transformStyles(convert.apply(item),convert,depth+1,state)]:[key,transformStyles(item,convert,depth+1,state)]));
}
function packStyles(payload){
 // Keep the original uncompressed structure barrier as well as the compact cap.
 const normalized=canonical(payload),styles=new Map();
 const packed=transformStyles(normalized,{from:'style',to:'styleRef',apply:style=>{const id=styleId(style),old=styles.get(id);if(old&&!same(old,style))fail();styles.set(id,style);return id;}});
 return{...packed,styleTable:Object.fromEntries([...styles.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0))};
}
function unpackStyles(value,table){return transformStyles(value,{from:'styleRef',to:'style',apply:id=>{if(!hash(id)||!Object.hasOwn(table,id))fail();return table[id];}});}
function validateStyles(source){
 const table=source.styleTable;if(!plain(table)||!Object.keys(table).length)fail();
 for(const [id,style]of Object.entries(table))if(!hash(id)||styleId(style)!==id)fail();
 const used=new Set();
 const visit=value=>{if(Array.isArray(value)){value.forEach(visit);return;}if(!plain(value))return;
  if(cellFact(value)){if(Object.hasOwn(value,'style')||!hash(value.styleRef)||!Object.hasOwn(table,value.styleRef))fail();used.add(value.styleRef);}
  Object.values(value).forEach(visit);
 };
 const {styleTable:ignored,sourceDigest:ignoredDigest,...payload}=source;void ignored;void ignoredDigest;visit(payload);
 if(used.size!==Object.keys(table).length)fail();
 // A compact reference never bypasses the original raw node/depth allowance.
 unpackStyles(payload,table);
}
export function planBudgetSourceDigest(source){const normalized=canonical(source);envelope(normalized);validateStyles(normalized);const {sourceDigest:ignored,...payload}=normalized;void ignored;return digestPayload(payload);}
// Numeric-only in-memory measurements; no facts, styles or source values escape.
export function planBudgetStyleEvidenceSize(source){
 if(source?.sourceDigest!==planBudgetSourceDigest(source))fail('PLAN_IMPORT_BUDGET_BINDING_MISMATCH',409);
 const {styleTable,sourceDigest:ignored,...payload}=source;void ignored;let styleFactCount=0,inlineStyleBytes=0;
 const sizes=new Map(Object.entries(styleTable).map(([id,style])=>[id,Buffer.byteLength(JSON.stringify(style))]));
 const visit=value=>{if(Array.isArray(value)){value.forEach(visit);return;}if(!plain(value))return;if(cellFact(value)){styleFactCount++;inlineStyleBytes+=sizes.get(value.styleRef);}Object.values(value).forEach(visit);};visit(payload);
 // Count the raw representation algebraically: never stringify an expanded
 // repeated style or allocate a potentially amplified raw JSON envelope.
 const referenceBytes=styleFactCount*Buffer.byteLength(JSON.stringify('0'.repeat(64))),baseEnvelopeBytes=Buffer.byteLength(JSON.stringify({...payload,sourceDigest:'0'.repeat(64)})),unpackedEnvelopeBytes=baseEnvelopeBytes+inlineStyleBytes-referenceBytes+styleFactCount*(Buffer.byteLength('"style":')-Buffer.byteLength('"styleRef":')),packedEnvelopeBytes=Buffer.byteLength(JSON.stringify(source));
 return freeze({styleFactCount,uniqueStyleCount:Object.keys(styleTable).length,inlineStyleBytes,poolBytes:Buffer.byteLength(JSON.stringify(styleTable)),referenceBytes,unpackedEnvelopeBytes,packedEnvelopeBytes,savedBytes:unpackedEnvelopeBytes-packedEnvelopeBytes});
}
const rowOf=value=>/^([A-Z]+)([1-9]\d{0,5})$/.exec(value)?.[2]??null;
const columnOf=value=>{let result=0;for(const c of /^([A-Z]+)/.exec(value)[1])result=result*26+c.charCodeAt(0)-64;return result;};
function address(column,row){if(!Number.isSafeInteger(column)||column<1||column>16384||!Number.isSafeInteger(row)||row<1||row>999999)return null;let letters='';for(let n=column;n;n=Math.floor((n-1)/26))letters=String.fromCharCode(65+(n-1)%26)+letters;return letters+row;}
const inside=(cell,range)=>{if(typeof range!=='string'||!/^([A-Z]{1,3}[1-9]\d{0,5})(?::([A-Z]{1,3}[1-9]\d{0,5}))?$/.test(range))return false;const[a,last]=range.split(':'),b=last??a;return columnOf(a)<=columnOf(cell)&&columnOf(cell)<=columnOf(b)&&Number(rowOf(a))<=Number(rowOf(cell))&&Number(rowOf(cell))<=Number(rowOf(b));};
const sharedMasterValid=cell=>{const master=cell.sharedFormulaMaster;return Boolean(master&&master.attributes.t==='shared'&&master.attributes.si===cell.formulaAttributes?.si&&master.text&&inside(cell.address,master.attributes.ref)&&inside(master.address,master.attributes.ref));};
// Resolve one cell address only; no SUM, expression or workbook calculation runs.
function directReference(cell){
 if(cell.formulaAttributes===null)return{status:'MISSING',worksheet:null,address:null,shared:false};
 let text=cell.formulaText,anchor=cell.address,shared=false;
 if(cell.formulaAttributes.t==='shared'){
  const master=cell.sharedFormulaMaster;shared=true;
  if(!sharedMasterValid(cell))return{status:'SHARED_MASTER_UNRESOLVED',worksheet:null,address:null,shared:true};
  text=master.text;anchor=master.address;
 }else if(cell.formulaAttributes.t&&!['normal'].includes(cell.formulaAttributes.t))return{status:'UNSUPPORTED',worksheet:null,address:null,shared:false};
 const match=/^\+?'CyP Integral completo'!(\$?)([A-Z]{1,3})(\$?)([1-9]\d{0,5})$/.exec(text||'');
 if(!match)return{status:'UNSUPPORTED',worksheet:null,address:null,shared};
 const column=columnOf(match[2]+'1')+(shared&&!match[1]?columnOf(cell.address)-columnOf(anchor):0),row=Number(match[4])+(shared&&!match[3]?Number(rowOf(cell.address))-Number(rowOf(anchor)):0),resolved=address(column,row);
 return{status:resolved?'RESOLVED':'UNSUPPORTED',worksheet:resolved?budgetSheet:null,address:resolved,shared};
}
function decimal(raw){
 if(typeof raw!=='string'||raw.length>128)return null;
 const match=/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[Ee]([+-]?\d{1,3}))?$/.exec(raw);if(!match)return null;
 const exponent=Number(match[5]||'0');if(exponent>100||exponent< -100)return null;
 const fraction=match[3]??match[4]??'';let coefficient=BigInt((match[2]||'0')+fraction)*(match[1]==='-'?-1n:1n),scale=fraction.length-exponent;
 if(scale<0){coefficient*=10n**BigInt(-scale);scale=0;}return{coefficient,scale};
}
const equalDecimal=(a,b)=>{const left=decimal(a),right=decimal(b);if(!left||!right)return null;const scale=Math.max(left.scale,right.scale);return left.coefficient*10n**BigInt(scale-left.scale)===right.coefficient*10n**BigInt(scale-right.scale);};
function observation(cell){
 const hasFormula=cell.formulaAttributes!==null,savedValuePresent=cell.cachePresent||cell.type==='inlineStr'&&cell.value!==null,formulaCachePresent=hasFormula&&cell.cachePresent,issues=[];
 if(!cell.present)issues.push('CELL_ABSENT');
 if(hasFormula&&!formulaCachePresent)issues.push('FORMULA_CACHE_MISSING');
 if(cell.type==='e')issues.push('CELL_ERROR');
 if(cell.type!=='n')issues.push('NON_NUMERIC_CELL_TYPE');
 if(!savedValuePresent)issues.push('SAVED_VALUE_MISSING');
 if(hasFormula&&cell.formulaAttributes.t==='shared'&&!sharedMasterValid(cell))issues.push('SHARED_MASTER_UNRESOLVED');
 const expression=cell.formulaText||cell.sharedFormulaMaster?.text||'';
 if(hasFormula&&(!expression||/\[|#REF!|\b(?:WEBSERVICE|HYPERLINK|DDE|RTD|INDIRECT)\s*\(/i.test(expression)||cell.formulaAttributes.t&&!['normal','shared'].includes(cell.formulaAttributes.t)))issues.push('FORMULA_SOURCE_UNRESOLVED');
 if(cell.type==='n'&&savedValuePresent&&!decimal(cell.rawValue))issues.push('NON_DECIMAL_SAVED_VALUE');
 const available=issues.length===0;
 return{savedValuePresent,formulaCachePresent,kind:!cell.present?'ABSENT':hasFormula?(formulaCachePresent?'FORMULA_CACHE':'FORMULA_WITHOUT_CACHE'):'LITERAL',decimal:available?cell.rawValue:null,issues,reviewRequired:true};
}
const fact=(cells,cell)=>{const value=cells.get(cell);if(!value)fail();return clone(value);};
const map=sheet=>new Map(sheet.cells.map(cell=>[cell.address,cell]));
const contextFact=(cells,cell)=>({worksheet:budgetSheet,address:cell,fact:cells.has(cell)?clone(cells.get(cell)):null,declaredText:typeof cells.get(cell)?.value==='string'?cells.get(cell).value:null,interpretedDate:null});
function link(cell,expected,budget,budgetObservation){const reference=directReference(cell),observed=observation(cell),referenceMatches=reference.status==='RESOLVED'&&reference.address===expected,cacheMatches=equalDecimal(observed.decimal,budgetObservation.decimal);return{reference,expectedAddress:expected,referenceMatches,cacheMatchesBudget:cacheMatches,observation:observed,observedTarget:reference.address&&reference.address!==expected&&budget.has(reference.address)?clone(budget.get(reference.address)):null};}
function sumStored(values){
 if(!values.length||values.some(row=>row.decimal===null))return{complete:false,value:null,count:values.length,calculation:'SUM_OF_STORED_DECIMAL_VALUES_ONLY',formulasEvaluated:false};
 const parsed=values.map(row=>decimal(row.decimal)),scale=Math.max(...parsed.map(row=>row.scale)),total=parsed.reduce((sum,row)=>sum+row.coefficient*10n**BigInt(scale-row.scale),0n),negative=total<0n,digits=String(negative?-total:total).padStart(scale+1,'0');
 return{complete:true,value:(negative?'-':'')+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits),count:values.length,calculation:'SUM_OF_STORED_DECIMAL_VALUES_ONLY',formulasEvaluated:false};
}
function indirectSum(controls){
 const relevant=controls.filter(row=>row.classification==='MONETARY_COST_ROW'),byCode=new Map();for(const row of relevant){if(!byCode.has(row.code))byCode.set(row.code,[]);byCode.get(row.code).push(row);}
 const codes=[...byCode.keys()],issues=[];
 if(codes.some(code=>codes.some(other=>other!==code&&other.startsWith(code+'.'))))issues.push('NESTED_MONETARY_CONTROLS_REQUIRE_REVIEW');
 if([...byCode.values()].some(rows=>rows.length!==1))issues.push('MULTIPLE_MONETARY_CONTROL_COLUMNS_REQUIRE_REVIEW');
 const sum=issues.length?{complete:false,value:null,count:relevant.length,calculation:'SUM_OF_STORED_DECIMAL_VALUES_ONLY',formulasEvaluated:false}:sumStored(relevant.map(row=>row.observation));
 return{...sum,issues,scope:'PRESENT_DISJOINT_MONETARY_CONTROL_ROWS_ONLY',combinedWithPhysicalLines:false};
}
export async function extractPlanBudgetSource(bytes,contentType,{sourceSha256=null}={}){
 contentType=mime(contentType);if(!PLAN_OOXML_TYPES[contentType]||!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>PLAN_OOXML_LIMITS.fileBytes)fail();
 const actualSha=sha(bytes);if(sourceSha256!==null&&sourceSha256!==actualSha)fail('PLAN_IMPORT_BUDGET_SOURCE_SHA_MISMATCH');
 // Reuse the canonical complete identity/parent rules and physical source digest.
 const physical=await extractPlanMeasurementSource(bytes,contentType,{sourceSha256:actualSha});if(physical.format!=='CYP_PARTIDAS')fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
 const snapshot=await readPlanBudgetOoxml(bytes,contentType),plan=map(snapshot.worksheets.find(sheet=>sheet.name===planSheet)),budget=map(snapshot.worksheets.find(sheet=>sheet.name===budgetSheet)),codes=new Map();
 for(const [cell,value]of budget)if(/^B[1-9]\d{0,5}$/.test(cell)&&Number(rowOf(cell))>=6&&typeof value.value==='string'&&/^[ABHI](?:\.\d{1,3}){0,3}$/.test(value.value)){if(codes.has(value.value))fail('PLAN_IMPORT_BUDGET_IDENTITY_AMBIGUOUS');codes.set(value.value,rowOf(cell));}
 const rows=physical.rows.map(item=>{
  const planRow=item.provenance.row,budgetRow=rowOf(item.provenance.matchingSource.codeFact.address);
  if(codes.get(item.code)!==budgetRow||!same(budget.get('B'+budgetRow),item.provenance.matchingSource.codeFact)||!same(budget.get('C'+budgetRow),item.provenance.matchingSource.titleFact)||!same(plan.get('A'+planRow),item.provenance.codeFact))fail('PLAN_IMPORT_BUDGET_IDENTITY_MISMATCH');
  const identity=directReference(plan.get('A'+planRow));if(identity.status!=='RESOLVED'||identity.worksheet!==budgetSheet||identity.address!=='B'+budgetRow)fail('PLAN_IMPORT_BUDGET_IDENTITY_LINK_REQUIRED');
  const budgetCells=Object.fromEntries([['code','B'],['title','C'],['unit','D'],['quantity','E'],['unitPrice','H'],['lineAmount','K']].map(([name,column])=>[name,fact(budget,column+budgetRow)])),planCells=Object.fromEntries([['code','A'],['title','B'],['unit','C'],['quantity','D'],['unitPrice','E'],['lineAmount','F']].map(([name,column])=>[name,fact(plan,column+planRow)]));
  const observed={quantity:observation(budgetCells.quantity),unitPrice:observation(budgetCells.unitPrice),lineAmount:observation(budgetCells.lineAmount)},links=Object.fromEntries([['quantity','E'],['unitPrice','H'],['lineAmount','K']].map(([name,column])=>[name,link(planCells[name],column+budgetRow,budget,observed[name])])),issues=[];
  for(const name of ['quantity','unitPrice','lineAmount']){issues.push(...observed[name].issues.map(issue=>'BUDGET_'+name.toUpperCase()+'_'+issue));if(!links[name].referenceMatches)issues.push('PLAN_'+name.toUpperCase()+'_REFERENCE_UNRESOLVED');if(links[name].cacheMatchesBudget===false)issues.push('PLAN_'+name.toUpperCase()+'_CACHE_MISMATCH');issues.push(...links[name].observation.issues.map(issue=>'PLAN_'+name.toUpperCase()+'_'+issue));}
  const originalRawUnit=typeof budgetCells.unit.value==='string'?budgetCells.unit.value:null,planRawUnit=typeof planCells.unit.value==='string'?planCells.unit.value:null;if(originalRawUnit!==planRawUnit)issues.push('UNIT_LITERAL_MISMATCH');if(originalRawUnit===null||originalRawUnit==='')issues.push('UNIT_MISSING');
  return{code:item.code,parentCode:item.parentCode,sourceTitle:item.sourceTitle,physicalSourceRowId:item.sourceRowId,sourceRowId:budgetSheet+'!B'+budgetRow+':K'+budgetRow,budget:{worksheet:budgetSheet,row:budgetRow,cells:budgetCells},plan:{worksheet:planSheet,row:planRow,cells:planCells,identityReference:identity,links},originalRawUnit,planRawUnit,observed,issues:[...new Set(issues)].sort(),reviewRequired:true,automaticUseAllowed:false};
 });
 if(!rows.length||rows.length>PLAN_BUDGET_SOURCE_LIMITS.rows)fail('PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',413);
 const nonPhysicalRows=physical.excludedRows.map(item=>{const row=codes.get(item.code);if(!row)fail();return{code:item.code,parentCode:item.code.includes('.')?item.code.slice(0,item.code.lastIndexOf('.')):null,sourceTitle:item.sourceTitle,classification:item.reason,worksheet:budgetSheet,row,sourceRowId:budgetSheet+'!B'+row+':O'+row,codeFact:fact(budget,'B'+row),titleFact:fact(budget,'C'+row)};});
 const excludedByRow=new Map(nonPhysicalRows.map(row=>[row.row,row])),controlCells=[];
 for(const [cell,value]of budget)if(/^[LO][1-9]\d{0,5}$/.test(cell)&&value.present&&(value.value!==null&&value.value!==''||value.formulaAttributes!==null)){
  const row=rowOf(cell),excluded=excludedByRow.get(row);controlCells.push({worksheet:budgetSheet,address:cell,row,code:excluded?.code??null,classification:excluded?.classification??'UNCLASSIFIED_CONTROL',fact:clone(value),observation:observation(value),includedInPhysicalLineSum:false});
 }
 controlCells.sort((a,b)=>Number(a.row)-Number(b.row)||(a.address<b.address?-1:a.address>b.address?1:0));if(controlCells.length>PLAN_BUDGET_SOURCE_LIMITS.controls)fail('PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',413);
 const warnings=['SOURCE_CACHES_NOT_RECALCULATED','CURRENCY_UNCONFIRMED','ALL_VALUES_REQUIRE_SOURCE_REVIEW'];if(!budget.get('N1')?.value)warnings.push('BASE_MONTH_MISSING');
 const payload={version:2,profile:PLAN_BUDGET_SOURCE_PROFILE,purpose:'READ_ONLY_BUDGET_SOURCE',sourceSha256:actualSha,measurementSourceDigest:planMeasurementSourceDigest(physical),contentType,columnRoles:{unit:'D',quantity:'E',unitPrice:'H',lineAmount:'K'},currency:{code:null,status:'UNKNOWN'},monthBase:contextFact(budget,'N1'),priceBasis:contextFact(budget,'G5'),priceCoefficient:contextFact(budget,'G6'),rows,nonPhysicalRows,controlCells,sums:{physicalLineAmounts:{...sumStored(rows.map(row=>row.observed.lineAmount)),groupingAndControlCellsIncluded:false},indirectStoredControls:indirectSum(controlCells)},warnings,formulasEvaluated:false,macrosExecuted:false,unitsConverted:false,calendarDatesInferred:false,taskWrites:false,stockWrites:false};
 const compact=packStyles(payload);return freeze({...compact,sourceDigest:digestPayload(compact)});
}
// A digest is an integrity binding to a trusted caller receipt, not a signature
// or authorization. The caller supplies its expected file/digest and exact row.
export function selectPlanBudgetSourceRow(source,{sourceSha256,sourceDigest,code,budgetWorksheet,budgetRow,planWorksheet,planRow}={}){
 if(!hash(sourceSha256)||!hash(sourceDigest)||source?.sourceSha256!==sourceSha256||source.sourceDigest!==sourceDigest||planBudgetSourceDigest(source)!==sourceDigest||budgetWorksheet!==budgetSheet||planWorksheet!==planSheet||typeof budgetRow!=='string'||typeof planRow!=='string')fail('PLAN_IMPORT_BUDGET_BINDING_MISMATCH',409);
 const found=source.rows.filter(row=>row.code===code&&row.budget.worksheet===budgetWorksheet&&row.budget.row===budgetRow&&row.plan.worksheet===planWorksheet&&row.plan.row===planRow);if(found.length!==1)fail('PLAN_IMPORT_BUDGET_BINDING_MISMATCH',409);return freeze(unpackStyles(found[0],source.styleTable));
}
