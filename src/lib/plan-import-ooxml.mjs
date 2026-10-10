import yauzl from 'yauzl';
import {SaxesParser} from 'saxes';
import {crc32} from 'node:zlib';
import path from 'node:path';
import {WorkspaceError} from './workspace-policy.mjs';
import {safeMonthlyCurveAnalysis,PLAN_MONTHLY_CURVE_PROFILE} from './plan-import-monthly-curve.mjs';
export {safeMonthlyCurveAnalysis,PLAN_MONTHLY_CURVE_CONSENT} from './plan-import-monthly-curve.mjs';
import {safeCypCurveAnalysis,safeCypCurveCache,PLAN_CYP_CURVE_PROFILE} from './plan-import-cyp-curve.mjs';
export {PLAN_CYP_CURVE_CONSENT} from './plan-import-cyp-curve.mjs';

export const PLAN_OOXML_TYPES=Object.freeze({
 'application/vnd.ms-excel.sheet.macroenabled.12':'xlsm',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx'
});
export const PLAN_OOXML_CONSENT='plan-spreadsheet-monthly-rubros-v1';
export const PLAN_CYP_CONSENT='plan-spreadsheet-cyp-partidas-v2';
export const PLAN_CYP_ROWS=200;
export const PLAN_OOXML_LIMITS=Object.freeze({fileBytes:3*1024*1024,entries:512,partBytes:8*1024*1024,totalBytes:16*1024*1024,nodes:200000,depth:64,cells:50000,strings:50000,periods:16,timeoutMs:10000});
const spreadsheetNS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relationshipNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageNS='http://schemas.openxmlformats.org/package/2006/relationships';
const contentNS='http://schemas.openxmlformats.org/package/2006/content-types';
const fail=(code='PLAN_IMPORT_FILE_INVALID')=>{throw new WorkspaceError(code,code==='PLAN_IMPORT_ROWS_LIMIT'?413:400);};
const text=value=>typeof value==='string'?value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase():'';
const number=value=>typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(value)&&Number.isFinite(Number(value))?Number(value):null;

// A bounded, sequential ZIP reader. It never extracts paths to disk, starts
// worker threads, or opens package references. Check real output, not just sizes.
async function openPackage(bytes) {
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>PLAN_OOXML_LIMITS.fileBytes)fail();
 const zip=await yauzl.fromBufferPromise(Buffer.from(bytes),{strictFileNames:true,validateEntrySizes:true});
 const entries=new Map(),started=Date.now();let declared=0;
 const check=()=>{if(Date.now()-started>PLAN_OOXML_LIMITS.timeoutMs)fail('PLAN_IMPORT_SPREADSHEET_TOO_COMPLEX');};
 try {
  if(zip.entryCount>PLAN_OOXML_LIMITS.entries)fail();
  for await(const entry of zip.eachEntry()) {
   check();
   const name=entry.fileName;
   if(!name||name.length>240||/[\u0000-\u001f\u007f\\]/.test(name)||name.startsWith('/')||name.split('/').some(part=>part==='..'||part==='.')||entries.has(name)||entry.generalPurposeBitFlag&1||![0,8].includes(entry.compressionMethod)||!Number.isSafeInteger(entry.uncompressedSize)||entry.uncompressedSize>PLAN_OOXML_LIMITS.partBytes)fail();
   declared+=entry.uncompressedSize;if(declared>PLAN_OOXML_LIMITS.totalBytes)fail();entries.set(name,entry);
  }
  let consumed=0;const cache=new Map();
  return {check,names:[...entries.keys()],async read(name) {
   check();
   if(cache.has(name))return cache.get(name);
   const entry=entries.get(name);if(!entry||name.endsWith('/'))fail();
   const stream=await zip.openReadStreamPromise(entry),chunks=[];let size=0,checksum=0;
   const timer=setTimeout(()=>stream.destroy(new WorkspaceError('PLAN_IMPORT_SPREADSHEET_TOO_COMPLEX',400)),Math.max(1,PLAN_OOXML_LIMITS.timeoutMs-(Date.now()-started)));timer.unref();
   try {for await(const chunk of stream) {check();size+=chunk.length;consumed+=chunk.length;if(size>entry.uncompressedSize||size>PLAN_OOXML_LIMITS.partBytes||consumed>PLAN_OOXML_LIMITS.totalBytes)fail();checksum=crc32(chunk,checksum);chunks.push(chunk);}}
   finally {clearTimeout(timer);stream.destroy();}
   if(size!==entry.uncompressedSize||checksum!==entry.crc32)fail();const value=Buffer.concat(chunks);cache.set(name,value);return value;
  },close(){zip.close();cache.clear();}};
 }catch(error){zip.close();throw error;}
}

// Saxes enforces well-formed XML and namespaces. DTDs/entities are not enabled.
function xml(bytes,rootName,rootNS,check=()=>{}) {
 let source;try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail();}
 if(/<!DOCTYPE|<!ENTITY/i.test(source))fail();
 const parser=new SaxesParser({xmlns:true}),stack=[];let root=null,count=0;
 parser.on('error',()=>fail());parser.on('doctype',()=>fail());
 parser.on('opentag',node=>{
  check();
  if(++count>PLAN_OOXML_LIMITS.nodes||stack.length>=PLAN_OOXML_LIMITS.depth)fail();
  const value={name:node.local,ns:node.uri,attrs:Object.create(null),children:[],value:''};
  for(const a of Object.values(node.attributes)){if(a.name.length>240||a.value.length>32768)fail();value.attrs[a.uri?`{${a.uri}}${a.local}`:a.name]=a.value;}
  if(stack.length)stack.at(-1).children.push(value);else {if(root)fail();root=value;}
  stack.push(value);
 });
 const append=value=>{if(stack.length){stack.at(-1).value+=value;if(stack.at(-1).value.length>32768)fail();}};
 parser.on('text',append);parser.on('cdata',append);parser.on('closetag',()=>stack.pop());
 parser.write(source).close();if(!root||root.name!==rootName||root.ns!==rootNS)fail();return root;
}
const children=(node,name,ns=spreadsheetNS)=>node?.children.filter(child=>child.name===name&&child.ns===ns)||[];
const child=(node,name,ns=spreadsheetNS)=>children(node,name,ns)[0];
const attr=(node,name)=>node?.attrs[name];
const richText=node=>node.name==='t'&&node.ns===spreadsheetNS?node.value:node.children.map(richText).join('');
function relationships(bytes,base,check) {
 const root=xml(bytes,'Relationships',packageNS,check),result=new Map();
 for(const rel of children(root,'Relationship',packageNS)) {
  const id=attr(rel,'Id'),target=attr(rel,'Target'),type=attr(rel,'Type');
  if(!id||result.has(id)||!target||!type||attr(rel,'TargetMode')==='External'||target.includes('\\')||/[?#:\u0000-\u001f]/.test(target))fail();
  const resolved=path.posix.normalize(target.startsWith('/')?target.slice(1):path.posix.join(base,target));
  if(resolved.startsWith('../')||resolved.startsWith('/')||resolved==='..')fail();result.set(id,{target:resolved,type});
 }
 return result;
}
function sheetCells(bytes,strings,check) {
 const root=xml(bytes,'worksheet',spreadsheetNS,check),cells=new Map(),shared=new Map();
 if(children(root,'sheetData').length!==1)fail();
 for(const row of children(child(root,'sheetData'),'row'))for(const cell of children(row,'c')) {
  const address=attr(cell,'r');if(!/^[A-Z]{1,3}[1-9]\d{0,5}$/.test(address||'')||cells.has(address)||cells.size>=PLAN_OOXML_LIMITS.cells)fail();
  if(['f','v','is'].some(name=>children(cell,name).length>1))fail();
  const type=attr(cell,'t')||'n',formula=child(cell,'f'),v=child(cell,'v');let value=v?.value??null;
  if(type==='s'){const index=number(value);if(!Number.isSafeInteger(index)||index<0||index>=strings.length)fail();value=strings[index];}
  else if(type==='inlineStr'){const inline=child(cell,'is');value=inline?richText(inline):null;}
  else if(!['n','str','e','b','d'].includes(type))fail();
  const sharedId=attr(formula,'t')==='shared'?attr(formula,'si'):null;
  if(sharedId!==null&&formula?.value){if(shared.has(sharedId))fail();shared.set(sharedId,formula.value);}
  cells.set(address,{value,type,formula:formula?.value??null,hasFormula:Boolean(formula),sharedId});
 }
 for(const c of cells.values())if(c.sharedId!==null){if(!shared.has(c.sharedId))fail();c.formula=shared.get(c.sharedId);}
 return cells;
}
async function workbook(bytes,contentType) {
 const container=await openPackage(bytes);
 try {
  const content=xml(await container.read('[Content_Types].xml'),'Types',contentNS,container.check),types=new Map();
  for(const override of children(content,'Override',contentNS)){const part=attr(override,'PartName');if(!part||types.has(part))fail();types.set(part,attr(override,'ContentType'));}
  const rootRelations=relationships(await container.read('_rels/.rels'),'',container.check);
  const main=[...rootRelations.values()].filter(rel=>rel.type===relationshipNS+'/officeDocument');if(main.length!==1||main[0].target!=='xl/workbook.xml')fail();
  const expected=PLAN_OOXML_TYPES[contentType]==='xlsm'?'application/vnd.ms-excel.sheet.macroEnabled.main+xml':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
  if(!PLAN_OOXML_TYPES[contentType]||types.get('/xl/workbook.xml')!==expected)fail();
  const tree=xml(await container.read('xl/workbook.xml'),'workbook',spreadsheetNS,container.check),rels=relationships(await container.read('xl/_rels/workbook.xml.rels'),'xl',container.check),sheets=new Map();
  for(const sheet of children(child(tree,'sheets'),'sheet')) {
   const name=attr(sheet,'name'),id=attr(sheet,'{'+relationshipNS+'}id'),rel=rels.get(id);
   if(!name||name.length>31||sheets.has(name)||!rel||rel.type!==relationshipNS+'/worksheet'||!rel.target.startsWith('xl/worksheets/')||types.get('/'+rel.target)!=='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml')fail();
   sheets.set(name,{target:rel.target,visible:!attr(sheet,'state')||attr(sheet,'state')==='visible'});
  }
  const stringRel=[...rels.values()].filter(rel=>rel.type===relationshipNS+'/sharedStrings');if(stringRel.length>1)fail();const strings=[];
  if(stringRel.length){const shared=xml(await container.read(stringRel[0].target),'sst',spreadsheetNS,container.check);for(const s of children(shared,'si')){if(strings.length>=PLAN_OOXML_LIMITS.strings)fail();strings.push(richText(s));}}
  return {async sheet(name){const sheet=sheets.get(name);if(!sheet?.visible)fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');return sheetCells(await container.read(sheet.target),strings,container.check);},has:name=>sheets.has(name),visible:name=>sheets.get(name)?.visible===true,close:container.close};
 }catch(error){container.close();throw error;}
}
export async function validatePlanOoxml(bytes,contentType) {
 let value;try{value=await workbook(bytes,contentType);return true;}catch(error){if(error instanceof WorkspaceError)throw error;fail();}finally{value?.close();}
}
const cell=(cells,address)=>cells.get(address);
const value=(cells,address)=>cell(cells,address)?.value??null;
const safeValue=(cells,address)=>{const c=cell(cells,address);if(c?.type==='e'||c?.hasFormula&&(c.value===null||/\[|#REF!|\b(?:WEBSERVICE|HYPERLINK|DDE)\s*\(/i.test(c.formula||'')))fail('PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID');return c?.value??null;};
const column=index=>{let result='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;};
export async function extractMonthlyPlanOoxml(bytes,contentType,{rowLimit=50}={}) {
 let book;
 try {
  book=await workbook(bytes,contentType);const monthly=await book.sheet('Plan y curva Meses'),quote=await book.sheet('Cotización');
  if(text(value(monthly,'A8'))!=='RUBRO'||text(value(monthly,'B8'))!=='DESCRIPCION'||text(value(monthly,'E8'))!=='TOTAL'||text(value(monthly,'F8'))!=='MES'||number(value(monthly,'F9'))!==0)fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
  const periods=[];for(let i=6;i<6+PLAN_OOXML_LIMITS.periods;i++){const v=safeValue(monthly,column(i)+'9');if(v===null||v==='')break;if(number(v)!==periods.length+1)fail('PLAN_IMPORT_SPREADSHEET_PERIODS_INVALID');periods.push(i);}
  if(!periods.length||value(monthly,column(6+periods.length)+'9')!==null)fail('PLAN_IMPORT_SPREADSHEET_PERIODS_INVALID');
  if(text(value(quote,'D5'))!=='DESIGNACION'||text(value(quote,'E5'))!=='UNIDAD'||text(value(quote,'F5'))!=='CANTIDAD')fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
  const totals=[...quote.entries()].filter(([a,c])=>/^D\d+$/.test(a)&&text(c.value)==='TOTAL OBRA');if(totals.length!==1)fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
  const totalRow=Number(totals[0][0].slice(1));if(totalRow<7||totalRow>10000)fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');let detailRowsExcluded=0;
  for(let r=6;r<totalRow;r++)if(value(quote,'D'+r)&&value(quote,'E'+r)){if(number(safeValue(quote,'F'+r))===null)fail('PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID');detailRowsExcluded++;}
  const rows=[];let row=10;
  while(number(value(monthly,'A'+row))!==null) {
   if(rows.length>=rowLimit)fail('PLAN_IMPORT_ROWS_LIMIT');
   if(number(safeValue(monthly,'A'+row))!==rows.length+1||!safeValue(monthly,'B'+row)||number(safeValue(monthly,'E'+row))===null||value(monthly,'C'+row)!==null||value(monthly,'D'+row)!==null)fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
   const allocations=periods.map(c=>{const v=safeValue(monthly,column(c)+(row+1));if(v!==null&&number(v)===null)fail('PLAN_IMPORT_SPREADSHEET_PERIODS_INVALID');return v===null?null:number(v);});
   if(allocations.some(a=>a!==null&&(a<0||a>1))||Math.abs(allocations.reduce((sum,a)=>sum+(a??0),0)-1)>1e-8)fail('PLAN_IMPORT_SPREADSHEET_PERIODS_INVALID');
   rows.push({title:safeValue(monthly,'B'+row),startsOn:null,endsOn:null,evidence:`Plan y curva Meses!A${row}:${column(periods.at(-1))}${row+1}; rubro ${rows.length+1}; `+allocations.map((a,i)=>`mes ordinal ${i+1}: ${a===null?'sin dato':(a*100)+'%'}`).join('; '),uncertainty:'Rubro agregado del plan mensual. Los meses son ordinales, sin fechas calendario; confirmar inicio y fin. No se importan partidas, cantidades, dependencias ni avance.'});row+=2;
  }
  if(!rows.length||[...monthly.entries()].some(([a,c])=>/^A\d+$/.test(a)&&Number(a.slice(1))>row&&number(c.value)!==null))fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
  let weeklyStatus='ABSENT',weeklyFormulaErrors=0;
  if(book.has('Plan y curva Semanas')){weeklyStatus='NOT_SELECTED';if(book.visible('Plan y curva Semanas')){const weekly=await book.sheet('Plan y curva Semanas');weeklyFormulaErrors=[...weekly.values()].filter(c=>c.type==='e'||c.formula?.includes('#REF!')).length;weeklyStatus=weeklyFormulaErrors?'FORMULA_ERRORS':'NOT_SELECTED';}}
  const spreadsheet={version:1,profile:'MONTHLY_RUBROS',worksheet:'Plan y curva Meses',level:'RUBRO',rowCount:rows.length,detailRowsExcluded,periodOrdinals:periods.map((_,i)=>i+1),weeklyStatus,weeklyFormulaErrors,usesCachedValues:true,formulasRecalculated:false,macrosExecuted:false,quantityImported:false,dependenciesImported:false,progressImported:false};
  return {rows,spreadsheet,warnings:[`Se extrajeron ${rows.length} rubros agregados del plan mensual. Las ${detailRowsExcluded} partidas con cantidades de Cotización quedan excluidas; este borrador no es su importación completa.`, 'Los meses ordinales no acreditan fechas: guardá las correcciones y revisalas antes de aplicar. Los valores de fórmulas son cachés originales; no se recalcularon.', 'La curva es inversión monetaria prevista, no avance físico ejecutado ni certificación. No se ejecutaron macros ni referencias externas.', ...(weeklyStatus==='FORMULA_ERRORS'?[`Plan y curva Semanas queda excluida y bloqueada: ${weeklyFormulaErrors} celdas con errores de fórmula. No se interpretó su nombre como escala semanal.`]:[])]};
 }catch(error){if(error instanceof WorkspaceError)throw error;fail();}finally{book?.close();}
}

export function safePlanOoxmlAnalysis(value) {
 if(value?.version===4)return safeCypCurveAnalysis(value,safeCypPlanAnalysis);
 if(value?.version===3)return safeMonthlyCurveAnalysis(value);
 if(value?.version===2)return safeCypPlanAnalysis(value);
 const keys=['version','profile','worksheet','level','rowCount','detailRowsExcluded','periodOrdinals','weeklyStatus','weeklyFormulaErrors','usesCachedValues','formulasRecalculated','macrosExecuted','quantityImported','dependenciesImported','progressImported'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==keys.sort().join('|')||value.version!==1||value.profile!=='MONTHLY_RUBROS'||value.worksheet!=='Plan y curva Meses'||value.level!=='RUBRO'||!Number.isSafeInteger(value.rowCount)||value.rowCount<1||value.rowCount>50||!Number.isSafeInteger(value.detailRowsExcluded)||value.detailRowsExcluded<0||value.detailRowsExcluded>PLAN_OOXML_LIMITS.cells||!Array.isArray(value.periodOrdinals)||!value.periodOrdinals.length||value.periodOrdinals.length>PLAN_OOXML_LIMITS.periods||value.periodOrdinals.some((v,i)=>v!==i+1)||!['ABSENT','FORMULA_ERRORS','NOT_SELECTED'].includes(value.weeklyStatus)||!Number.isSafeInteger(value.weeklyFormulaErrors)||value.weeklyFormulaErrors<0||value.weeklyFormulaErrors>PLAN_OOXML_LIMITS.cells||(value.weeklyStatus==='FORMULA_ERRORS')!==(value.weeklyFormulaErrors>0)||value.usesCachedValues!==true||['formulasRecalculated','macrosExecuted','quantityImported','dependenciesImported','progressImported'].some(k=>value[k]!==false))return null;
 return {...value,periodOrdinals:[...value.periodOrdinals]};
}

// Opt-in v3 extends the unchanged grouped v1 extraction with source financial
// caches. Its second bounded package pass reads only the selected visible view.
export async function extractMonthlyCurveOoxml(bytes,contentType,{rowLimit=50}={}) {
 const original=await extractMonthlyPlanOoxml(bytes,contentType,{rowLimit});let book;
 try {
  book=await workbook(bytes,contentType);const monthly=await book.sheet('Plan y curva Meses'),count=original.rows.length,periods=original.spreadsheet.periodOrdinals;
  const cached=(address,{required=false}={})=>{
   const c=cell(monthly,address),v=safeValue(monthly,address);
   if(c&&c.type!=='n'||c?.hasFormula&&/\|/.test(c.formula||'')||required&&(v===null||v==='')||v===''||v!==null&&typeof v!=='string')fail('PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID');
   return {sourceCell:`Plan y curva Meses!${address}`,cachedValue:v,hasFormula:Boolean(c?.hasFormula)};
  };
  const footer=label=>{
   const matches=[...monthly.entries()].filter(([address,c])=>Number(address.replace(/^[A-Z]+/,''))>11+2*(count-1)&&text(c.value)===label);
   if(matches.length!==1)fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
   safeValue(monthly,matches[0][0]);return Number(matches[0][0].replace(/^[A-Z]+/,''));
  };
  const totalRow=footer('TOTAL'),monthlyRow=footer('IMPORTE TOTAL MENSUAL'),cumulativeRow=footer('IMPORTE TOTAL ACUMULADO'),percentageRow=footer('PORCENTAJE MENSUAL'),cumulativePercentageRow=footer('PORCENTAJE ACUMULADO');
  const items=original.rows.map((row,i)=>{const sourceRow=10+i*2;return {sourceRowId:`Plan y curva Meses!A${sourceRow}`,sourceTitle:row.title,sourceRange:`Plan y curva Meses!A${sourceRow}:${column(5+periods.length)}${sourceRow+1}`,budget:cached('E'+sourceRow,{required:true}),ordinalDistribution:periods.map((_,p)=>cached(column(6+p)+(sourceRow+1)))};});
  const curve={kind:'PLANNED_MONETARY_INVESTMENT',currency:null,calendarStart:null,total:cached('E'+totalRow,{required:true}),initialCumulative:cached('F'+cumulativeRow),periods:periods.map((ordinal,i)=>{const col=column(6+i);return {ordinal,headerCell:`Plan y curva Meses!${col}9`,monthlyAmount:cached(col+monthlyRow),cumulativeAmount:cached(col+cumulativeRow),monthlyPercentage:cached(col+percentageRow),cumulativePercentage:cached(col+cumulativePercentageRow)};})};
  const spreadsheet={...original.spreadsheet,version:3,profile:PLAN_MONTHLY_CURVE_PROFILE,items,curve};
  if(!safeMonthlyCurveAnalysis(spreadsheet))fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
  return {rows:original.rows.map((row,i)=>({sourceRowId:items[i].sourceRowId,...row})),spreadsheet,warnings:[...original.warnings,'Se conserva la curva monetaria prevista completa del archivo original. Excluir tareas no recalcula esa curva; confirmar moneda y alcance. No contiene ejecución ni pagos acreditados.']};
 }catch(error){if(error instanceof WorkspaceError)throw error;fail();}finally{book?.close();}
}

const cypCode=value=>typeof value==='string'&&/^[AB](?:\.1(?:\.\d{1,3}){0,2})?$/.test(value);
const cypPart=value=>typeof value==='string'&&/^[AB]\.1\.\d{1,3}\.\d{1,3}$/.test(value);
const parentCode=code=>code.includes('.')?code.slice(0,code.lastIndexOf('.')):'';
const declarationText=value=>typeof value==='string'&&value.trim().length>0&&value.length<=500&&!/[\u0000-\u001f\u007f<>]/.test(value);
const sourceRange=value=>typeof value==='string'&&/^Plan de trabajo!A[1-9]\d{0,5}:(?:B|BE)[1-9]\d{0,5}$/.test(value);
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
export function safeCypPlanAnalysis(value) {
 const keys=['version','profile','worksheet','level','rowCount','groups','items','budgetCodeCount','excludedBudgetLeafCount','excludedBudgetGroupingCount','periodOrdinals','weeksPerPeriod','duplicateViewExcluded','hiddenSheetsIgnored','externalReferencesIgnored','usesCachedValues','formulasRecalculated','macrosExecuted','quantityImported','dependenciesImported','progressImported'];
 if(!exactKeys(value,keys)||value.version!==2||value.profile!=='CYP_PARTIDAS'||value.worksheet!=='Plan de trabajo'||value.level!=='PARTIDA'||!Number.isSafeInteger(value.rowCount)||value.rowCount<1||value.rowCount>PLAN_CYP_ROWS||!Array.isArray(value.groups)||value.groups.length<4||value.groups.length>50||!Array.isArray(value.items)||value.items.length!==value.rowCount||!Array.isArray(value.periodOrdinals)||value.periodOrdinals.length!==12||value.periodOrdinals.some((v,i)=>v!==i+1)||value.weeksPerPeriod!==4||['duplicateViewExcluded','hiddenSheetsIgnored','externalReferencesIgnored','usesCachedValues'].some(k=>value[k]!==true)||['formulasRecalculated','macrosExecuted','quantityImported','dependenciesImported','progressImported'].some(k=>value[k]!==false)||!Number.isSafeInteger(value.excludedBudgetLeafCount)||value.excludedBudgetLeafCount<0||value.excludedBudgetLeafCount>200||!Number.isSafeInteger(value.excludedBudgetGroupingCount)||value.excludedBudgetGroupingCount<0||value.excludedBudgetGroupingCount>50||value.budgetCodeCount!==value.rowCount+value.groups.length+value.excludedBudgetLeafCount+value.excludedBudgetGroupingCount)return null;
 const all=new Map();
 for(const group of value.groups){if(!exactKeys(group,['code','parentCode','title','sourceRange'])||!cypCode(group.code)||cypPart(group.code)||group.parentCode!==parentCode(group.code)||!declarationText(group.title)||!sourceRange(group.sourceRange)||all.has(group.code))return null;all.set(group.code,group);}
 for(const group of value.groups)if(group.parentCode&&!all.has(group.parentCode))return null;
 if(!['A','A.1','B','B.1'].every(code=>all.has(code)))return null;
 for(const item of value.items){if(!exactKeys(item,['code','parentCode','sourceTitle','sourceRange','missingUnit','missingQuantity','ordinalDistribution'])||!cypPart(item.code)||item.parentCode!==parentCode(item.code)||!all.has(item.parentCode)||all.has(item.code)||!declarationText(item.sourceTitle)||!sourceRange(item.sourceRange)||typeof item.missingUnit!=='boolean'||typeof item.missingQuantity!=='boolean'||!Array.isArray(item.ordinalDistribution)||item.ordinalDistribution.length!==48||item.ordinalDistribution.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)))return null;all.set(item.code,item);}
 return {...value,periodOrdinals:[...value.periodOrdinals],groups:value.groups.map(g=>({...g})),items:value.items.map(i=>({...i,ordinalDistribution:[...i.ordinalDistribution]}))};
}

// The explicit v2 profile reads one visible view only. All A/B descendants are
// checked against the visible budget; costs and duplicate/hidden views are not tasks.
export async function extractCypPlanOoxml(bytes,contentType) {
 let book;
 try {
  book=await workbook(bytes,contentType);const plan=await book.sheet('Plan de trabajo'),budget=await book.sheet('CyP Integral completo');
  if(!book.visible('Plan de trabajo (Avance físico)')||!book.visible('Curva de Inversion')||text(safeValue(plan,'C5'))!=='U.'||text(safeValue(plan,'D5'))!=='CANT.'||text(safeValue(plan,'E5'))!=='$ UNITARIO'||text(safeValue(plan,'F5'))!=='$ SUBITEM')fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
  for(let month=0;month<12;month++){if(text(safeValue(plan,column(9+month*4)+'5'))!=='MES '+(month+1))fail('PLAN_IMPORT_SPREADSHEET_PERIODS_INVALID');for(let week=0;week<4;week++)if(number(safeValue(plan,column(9+month*4+week)+'6'))!==week+1)fail('PLAN_IMPORT_SPREADSHEET_PERIODS_INVALID');}
  const codes=(cells,col,minimum)=>{const result=new Map();for(const [address,c] of cells){if(!new RegExp('^'+col+'[0-9]+$').test(address)||Number(address.slice(col.length))<minimum)continue;const code=c.value;if(typeof code==='string'&&/^[ABHI]\./.test(code)&&! /^[ABHI](?:\.\d{1,3})*$/.test(code))fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');if(typeof code==='string'&&/^[A-Z](?:\.\d{1,3})*$/.test(code)){if(! /^[ABHI](?:\.\d{1,3}){0,3}$/.test(code)||result.has(code))fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');safeValue(cells,address);result.set(code,Number(address.slice(col.length)));}}return result;};
  const original=codes(budget,'B',6),selected=codes(plan,'A',7);
  if(original.size!==selected.size||[...original.keys()].some(code=>!selected.has(code)))fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
  const groups=[],items=[],rows=[];
  for(const [code,row] of selected) {
   const sourceTitle=safeValue(plan,'B'+row),budgetTitle=safeValue(budget,'C'+original.get(code));
   if(!declarationText(sourceTitle)||typeof budgetTitle!=='string'||sourceTitle.trim()!==budgetTitle.trim())fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
   if(!/^[AB](?:\.|$)/.test(code))continue;
   if(!cypCode(code))fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
   if(!cypPart(code)){groups.push({code,parentCode:parentCode(code),title:sourceTitle.trim(),sourceRange:`Plan de trabajo!A${row}:B${row}`});continue;}
   if(rows.length>=PLAN_CYP_ROWS)fail('PLAN_IMPORT_ROWS_LIMIT');
   const unit=safeValue(plan,'C'+row),quantity=safeValue(plan,'D'+row),missingUnit=typeof unit!=='string'||!unit.trim(),missingQuantity=number(quantity)===null;
   const ordinalDistribution=Array.from({length:48},(_,i)=>{const v=safeValue(plan,column(9+i)+row);if(v===null||v==='')return null;const n=number(v);if(n===null||n<0||n>1)fail('PLAN_IMPORT_SPREADSHEET_PERIODS_INVALID');return n;});
   const source=`Plan de trabajo!A${row}:BE${row}`;
   items.push({code,parentCode:parentCode(code),sourceTitle:sourceTitle.trim(),sourceRange:source,missingUnit,missingQuantity,ordinalDistribution});
   rows.push({code,parentCode:parentCode(code),sourceIssueReviewed:false,title:sourceTitle.trim(),startsOn:null,endsOn:null,evidence:`${source}; partida ${code}; 12 meses × 4 semanas ordinales. Distribución original preservada en el borrador, sin convertirla en avance.`,uncertainty:'Confirmar fechas calendario y descripción con la fuente. No se infieren predecesoras ni avance.'+(missingUnit||missingQuantity?' Falta unidad o cantidad en esta vista: revisar explícitamente la diferencia o excluir esta partida.':'')+(sourceTitle.length>160?' Abreviar el título a 160 caracteres antes de aplicar; la descripción original se conserva.':'')});
  }
  const extra=[...original.keys()].filter(code=>! /^[AB](?:\.|$)/.test(code)),excludedBudgetLeafCount=extra.filter(code=>![...original.keys()].some(other=>other.startsWith(code+'.'))).length;
  const spreadsheet={version:2,profile:'CYP_PARTIDAS',worksheet:'Plan de trabajo',level:'PARTIDA',rowCount:rows.length,groups,items,budgetCodeCount:original.size,excludedBudgetLeafCount,excludedBudgetGroupingCount:extra.length-excludedBudgetLeafCount,periodOrdinals:Array.from({length:12},(_,i)=>i+1),weeksPerPeriod:4,duplicateViewExcluded:true,hiddenSheetsIgnored:true,externalReferencesIgnored:true,usesCachedValues:true,formulasRecalculated:false,macrosExecuted:false,quantityImported:false,dependenciesImported:false,progressImported:false};
  if(!safeCypPlanAnalysis(spreadsheet))fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
  return {rows,spreadsheet,warnings:[`Se extrajeron ${rows.length} partidas del alcance A/B, con ${groups.length} agrupadores conservados sólo como jerarquía. ${excludedBudgetLeafCount} conceptos adicionales de costos quedan excluidos; la vista física no se duplica.`,'El eje contiene 12 meses y 48 semanas ordinales: no son fechas calendario ni predecesoras. Guardá la revisión humana antes de aplicar.', 'La curva y los porcentajes son distribución prevista, no avance ejecutado ni certificación. Se conservan cachés sin recalcular; no se ejecutan macros ni se abren enlaces externos o copias ocultas.',`Revisión de fuente: ${items.filter(i=>i.missingUnit||i.missingQuantity).length} partidas con unidad/cantidad pendiente y ${rows.filter(r=>r.title.length>160).length} descripciones que requieren título abreviado. No se completan automáticamente.`]};
 }catch(error){if(error instanceof WorkspaceError)throw error;fail();}finally{book?.close();}
}

// Keep the physical v2 profile unchanged. This explicit financial profile reads
// source caches and their declared roles; no workbook formula is evaluated.
export async function extractCypCurveOoxml(bytes,contentType){
 const original=await extractCypPlanOoxml(bytes,contentType);let book;
 try{
  book=await workbook(bytes,contentType);const plan=await book.sheet('Plan de trabajo'),budget=await book.sheet('CyP Integral completo'),investment=await book.sheet('Curva de Inversion');
  const lastCode=(cells,col)=>Math.max(...[...cells.entries()].filter(([address,c])=>new RegExp('^'+col+'[1-9]\\d*$').test(address)&&typeof c.value==='string'&&/^[ABHI](?:\.\d{1,3})*$/.test(c.value)).map(([address])=>Number(address.slice(col.length))));
  const footer=(cells,col,after,label)=>{
   const matches=[...cells.entries()].filter(([address,c])=>new RegExp('^'+col+'[1-9]\\d*$').test(address)&&Number(address.slice(col.length))>after&&text(c.value)===label);
   if(matches.length!==1)fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');safeValue(cells,matches[0][0]);return Number(matches[0][0].slice(col.length));
  };
  const totalRow=footer(plan,'B',lastCode(plan,'A'),'TOTAL PRESUPUESTO'),budgetTotalRow=footer(budget,'C',lastCode(budget,'B'),'TOTAL PRESUPUESTO');
  const formula=(cells,address,expected)=>{const c=cell(cells,address);safeValue(cells,address);if(!c?.hasFormula||String(c.formula||'').replace(/^\+/, '').replaceAll('$','')!==expected)fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');};
  formula(plan,'B'+totalRow,`'CyP Integral completo'!C${budgetTotalRow}`);
  formula(plan,'I'+totalRow,`'CyP Integral completo'!O${budgetTotalRow}`);
  const roles=['CERTIFICADO SEMANAL ($)','CERTIFICACION MENSUAL ($)','CERTIFICACION ACUMULADA ($)','CERTIFICACION MENSUAL(%)','CERTIFICACION ACUMULADA (%)'];
  for(const [i,label] of roles.entries())if(text(safeValue(plan,'D'+(totalRow+i+1))).replaceAll(' ','')!==label.replaceAll(' ',''))fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
  const cached=(cells,sheet,address,{required=false}={})=>{
   const c=cell(cells,address),v=safeValue(cells,address);
   if(c&&c.type!=='n'||c?.hasFormula&&/\|/.test(c.formula||'')||required&&(v===null||v==='')||v===''||v!==null&&typeof v!=='string')fail('PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID');
   return {sourceCell:`${sheet}!${address}`,cachedValue:v,hasFormula:Boolean(c?.hasFormula)};
  };
  // Inspect the declared source caches as well as the chart caches. Stale chart
  // values cannot conceal an error/missing result in their referenced source.
  const sourceCache=(cells,sheet,address,{ratio=false}={})=>{const value=cached(cells,sheet,address,{required:true});if(!safeCypCurveCache(value,`${sheet}!${address}`,{required:true,ratio}))fail('PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID');};
  sourceCache(budget,'CyP Integral completo','O'+budgetTotalRow);
  const periods=Array.from({length:12},(_,i)=>{
   const col=column(i),planCol=column(9+i*4);
   if(text(safeValue(investment,col+'30'))!=='MES '+(i+1))fail('PLAN_IMPORT_SPREADSHEET_PERIODS_INVALID');
   for(let field=0;field<4;field++){formula(investment,col+(31+field),`'Plan de trabajo'!${planCol}${totalRow+2+field}`);sourceCache(plan,'Plan de trabajo',planCol+(totalRow+2+field),{ratio:field>=2});}
   formula(plan,planCol+(totalRow+4),`${planCol}${totalRow+2}/I${totalRow}`);
   return {ordinal:i+1,headerCell:`Curva de Inversion!${col}30`,monthlyAmount:cached(investment,'Curva de Inversion',col+'31'),cumulativeAmount:cached(investment,'Curva de Inversion',col+'32'),monthlyPercentage:cached(investment,'Curva de Inversion',col+'33'),cumulativePercentage:cached(investment,'Curva de Inversion',col+'34')};
  });
  const curve={kind:'PLANNED_MONETARY_INVESTMENT',currency:null,calendarStart:null,total:cached(plan,'Plan de trabajo','I'+totalRow,{required:true}),initialCumulative:cached(plan,'Plan de trabajo','I'+(totalRow+3)),periods};
  const spreadsheet={...original.spreadsheet,version:4,profile:PLAN_CYP_CURVE_PROFILE,curve};
  if(!safePlanOoxmlAnalysis(spreadsheet))fail('PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED');
  return {...original,spreadsheet,warnings:[...original.warnings,'La inversión prevista conserva la curva completa y la base presupuestaria originales. Los costos adicionales excluidos como tareas no se descuentan de esa curva. Excluir o renombrar partidas no recalcula importes; moneda y fechas siguen por confirmar.']};
 }catch(error){if(error instanceof WorkspaceError)throw error;fail();}finally{book?.close();}
}
