import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {extractMonthlyPlanOoxml,validatePlanOoxml,PLAN_OOXML_LIMITS,safePlanOoxmlAnalysis} from '../src/lib/plan-import-ooxml.mjs';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {decodePlanSource,boundedPlanMultipart,normalizePlanRows,PLAN_IMPORT_CONSENT,PLAN_IMPORT_SPREADSHEET_CONSENT,planImportSourceRejection} from '../src/lib/plan-import-policy.mjs';
import {planImportUploadFormDigest,planImportUploadDigest} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {ooxmlFixture,ooxmlFixtureParts,zipOoxmlFixture} from './fixtures/plan-import-ooxml-synthetic.mjs';
const mime='application/vnd.ms-excel.sheet.macroenabled.12',xlsx='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const form=(bytes=ooxmlFixture(),consent=PLAN_IMPORT_SPREADSHEET_CONSENT,type=mime)=>{const f=new FormData();for(const [k,v] of Object.entries({operationId:randomUUID(),projectId:'p-synthetic',scope:'a'.repeat(64),consent}))f.append(k,v);f.append('file',new Blob([bytes],{type}),'synthetic-plan.'+(type===xlsx?'xlsx':'xlsm'));return f;};
const request=f=>new Request('https://obrasaas.com/api/identity/plan-import',{method:'POST',body:f});
const changed=(part,change,options)=>{const parts=ooxmlFixtureParts(options);parts[part]=change(parts[part]);return zipOoxmlFixture(parts);};
test('XLSM and XLSX retain original bytes/type/hash and no AI settings or network are accessed',async()=>{
 for(const type of [mime,xlsx]){const bytes=ooxmlFixture({type:type===xlsx?'xlsx':'xlsm'}),source=decodePlanSource(bytes,type);assert.equal(source.sha256,createHash('sha256').update(bytes).digest('hex'));assert.deepEqual(source.bytes,bytes);assert.equal(source.extension,type===mime?'xlsm':'xlsx');
  const analyzer=createPlanImportAnalyzer({environment:()=>{throw new Error('AI configuration must not be read');},fetchImpl:()=>{throw new Error('Provider must not be called');}}),result=await analyzer.analyze(source);assert.equal(result.success,true);assert.equal(result.provider,'local-ooxml');assert.equal(result.model,null);assert.equal(result.rows.length,2);assert.equal(result.spreadsheet.detailRowsExcluded,4);assert.equal(result.spreadsheet.weeklyStatus,'FORMULA_ERRORS');assert.equal(result.spreadsheet.weeklyFormulaErrors,1);assert.ok(result.rows.every(row=>row.startsOn===null&&row.endsOn===null&&row.uncertainty));assert.throws(()=>normalizePlanRows(result.rows,{complete:true}),{code:'PLAN_IMPORT_REVIEW_REQUIRED'});assert.ok(result.warnings.some(w=>w.includes('4 partidas')));assert.ok(result.warnings.some(w=>w.includes('monetaria prevista')));
 }
});
test('local consent selects monthly grouped scope and cannot be exchanged with OpenAI consent',async()=>{
 const f=form(),parsed=await boundedPlanMultipart(request(f));assert.equal(parsed.consent,PLAN_IMPORT_SPREADSHEET_CONSENT);assert.equal(parsed.source.extension,'xlsm');
 for(const [bytes,consent,type] of [[ooxmlFixture(),PLAN_IMPORT_CONSENT,mime],[Buffer.from('%PDF-1.7\nfixture\n%%EOF'),PLAN_IMPORT_SPREADSHEET_CONSENT,'application/pdf']])await assert.rejects(boundedPlanMultipart(request(form(bytes,consent,type))),{code:'PLAN_IMPORT_CONSENT_REQUIRED'});
});
test('browser upload fingerprint agrees with server existing v1 envelope; changed consent is denied',async()=>{
 const f=form(),input=await boundedPlanMultipart(request(f)),expected=createHash('sha256').update(JSON.stringify(['plan-import-upload-command-v1',{action:'UPLOAD',consent:input.consent,operationId:input.operationId.toLowerCase(),projectId:input.projectId,scope:input.scope,source:{bytes:input.source.bytes.length,contentType:input.source.contentType,sha256:input.source.sha256}}])).digest('hex');assert.equal(await planImportUploadFormDigest(f),expected);
 await assert.rejects(planImportUploadDigest({...input,consent:PLAN_IMPORT_CONSENT,source:{bytes:input.source.bytes.length,contentType:input.source.contentType,sha256:input.source.sha256}}));
});
test('all 50 grouped rows are returned; row 51 rejects complete extraction without selecting a subset',async()=>{
 assert.equal((await extractMonthlyPlanOoxml(ooxmlFixture({rubros:50}),mime)).rows.length,50);await assert.rejects(extractMonthlyPlanOoxml(ooxmlFixture({rubros:51}),mime),{code:'PLAN_IMPORT_ROWS_LIMIT'});
});
test('more than 50 quote details remain explicitly excluded instead of masquerading as imported tasks',async()=>{
 const result=await extractMonthlyPlanOoxml(ooxmlFixture({rubros:3,details:90}),mime);assert.equal(result.rows.length,3);assert.equal(result.spreadsheet.detailRowsExcluded,90);assert.ok(result.warnings.some(w=>w.includes('90 partidas')));assert.ok(result.rows.every(r=>Object.keys(r).sort().join('|')==='endsOn|evidence|startsOn|title|uncertainty'));
});
test('blank distribution stays distinct from explicit zero and never becomes recorded progress',async()=>{
 const result=await extractMonthlyPlanOoxml(ooxmlFixture({allocations:[null,0,1]}),mime);assert.match(result.rows[0].evidence,/ordinal 1: sin dato/);assert.match(result.rows[0].evidence,/ordinal 2: 0%/);assert.equal(result.spreadsheet.progressImported,false);
 for(const allocation of [[0,0,0],[1.1,0,0],[-0.1,0,1.1],['unknown',0,1]])await assert.rejects(extractMonthlyPlanOoxml(ooxmlFixture({allocations:allocation}),mime),{code:'PLAN_IMPORT_SPREADSHEET_PERIODS_INVALID'});
});
test('wrong/hidden profile, missing quote, skipped rubro or ordinal, and wrong MIME cannot yield a draft',async()=>{
 const cases=[changed('xl/workbook.xml',s=>s.replace('Plan y curva Meses','Other plan')),changed('xl/workbook.xml',s=>s.replace('sheetId="1"','sheetId="1" state="hidden"')),changed('xl/workbook.xml',s=>s.replace('Cotización','Another sheet')),changed('xl/worksheets/sheet1.xml',s=>s.replace('DESCRIPCIÓN','Unknown')),changed('xl/worksheets/sheet1.xml',s=>s.replace('<v>2</v>','<v>4</v>'))];
 for(const bytes of cases)await assert.rejects(extractMonthlyPlanOoxml(bytes,mime));await assert.rejects(validatePlanOoxml(ooxmlFixture({type:'xlsx'}),mime),{code:'PLAN_IMPORT_FILE_INVALID'});
});
test('formula errors, missing caches and remote/DDE formula expressions fail the selected plan',async()=>{
 for(const replacement of ['<c r="B10" t="e"><f>#REF!</f><v>#REF!</v></c>','<c r="B10" t="str"><f>Cotización!D7</f></c>','<c r="B10" t="str"><f>WEBSERVICE("https://example.invalid")</f><v>Cached</v></c>','<c r="B10" t="str"><f>[other.xlsx]Sheet!A1</f><v>Cached</v></c>']){const bytes=changed('xl/worksheets/sheet1.xml',s=>s.replace(/<c r="B10".*?<\/c>/,replacement));await assert.rejects(extractMonthlyPlanOoxml(bytes,mime),{code:'PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID'});}
});
test('selected cached formulas are read as cached text; the formula is never evaluated',async()=>{
 const bytes=changed('xl/worksheets/sheet1.xml',s=>s.replace(/<c r="B10".*?<\/c>/,'<c r="B10" t="str"><f>Cotización!D7</f><v>Cached synthetic title</v></c>')),result=await extractMonthlyPlanOoxml(bytes,mime);assert.equal(result.rows[0].title,'Cached synthetic title');assert.equal(result.spreadsheet.formulasRecalculated,false);assert.equal(result.spreadsheet.macrosExecuted,false);
});
test('shared formula followers inherit the same safety check and cannot hide an external expression',async()=>{
 const bytes=changed('xl/worksheets/sheet1.xml',s=>s.replace(/<c r="B10".*?<\/c>/,'<c r="B10" t="str"><f t="shared" si="0">WEBSERVICE("https://example.invalid")</f><v>Cached first</v></c>').replace(/<c r="B12".*?<\/c>/,'<c r="B12" t="str"><f t="shared" si="0"/><v>Cached second</v></c>'));
 await assert.rejects(extractMonthlyPlanOoxml(bytes,mime),{code:'PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID'});
 const orphan=changed('xl/worksheets/sheet1.xml',s=>s.replace(/<c r="B10".*?<\/c>/,'<c r="B10" t="str"><f t="shared" si="99"/><v>Cached title</v></c>'));
 await assert.rejects(extractMonthlyPlanOoxml(orphan,mime),{code:'PLAN_IMPORT_FILE_INVALID'});
});
test('duplicate cells, duplicate cached values and multiple sheetData blocks cannot yield a selection',async()=>{
 const cases=[changed('xl/worksheets/sheet1.xml',s=>s.replace('</sheetData>','<row><c r="A10"><v>1</v></c></row></sheetData>')),changed('xl/worksheets/sheet1.xml',s=>s.replace('<v>100</v>','<v>100</v><v>200</v>')),changed('xl/worksheets/sheet1.xml',s=>s.replace('</worksheet>','<sheetData/></worksheet>'))];
 for(const bytes of cases)await assert.rejects(extractMonthlyPlanOoxml(bytes,mime),{code:'PLAN_IMPORT_FILE_INVALID'});
 const hidden=changed('xl/workbook.xml',s=>s.replace('sheetId="3"','sheetId="3" state="hidden"'));
 const result=await extractMonthlyPlanOoxml(hidden,mime);assert.equal(result.spreadsheet.weeklyStatus,'NOT_SELECTED');assert.equal(result.spreadsheet.weeklyFormulaErrors,0);
});
test('DTD, XXE, invalid UTF-8, malformed XML, external relationships and unsafe ZIP paths are rejected',async()=>{
 const bad=[changed('xl/workbook.xml',s=>'<!DOCTYPE workbook [<!ENTITY x SYSTEM "file:///private">]>'+s),changed('xl/workbook.xml',()=>Buffer.from([0xff,0xfe])),changed('xl/workbook.xml',s=>s.replace('</workbook>','')),changed('xl/_rels/workbook.xml.rels',s=>s.replace('Target="worksheets/sheet1.xml"','Target="https://example.invalid/plan.xml" TargetMode="External"'))];
 const parts=ooxmlFixtureParts();bad.push(zipOoxmlFixture([...Object.entries(parts),['../outside.xml','unsafe']]));bad.push(zipOoxmlFixture([...Object.entries(parts),['xl/workbook.xml',parts['xl/workbook.xml']]]));
 for(const bytes of bad)await assert.rejects(validatePlanOoxml(bytes,mime),{code:'PLAN_IMPORT_FILE_INVALID'});
});
test('entry count, declared bomb, false output length, CRC corruption and encrypted entries fail closed',async()=>{
 const parts=ooxmlFixtureParts(),bad=[];for(const options of [{declaredSize:PLAN_OOXML_LIMITS.partBytes+1},{declaredSize:3},{badCRC:true},{encrypted:true}])bad.push(zipOoxmlFixture({...parts,'xl/workbook.xml':{data:parts['xl/workbook.xml'],...options}}));bad.push(zipOoxmlFixture([...Object.entries(parts),...Array.from({length:PLAN_OOXML_LIMITS.entries},(_,i)=>['unused/'+i,''])]));
 for(const bytes of bad)await assert.rejects(validatePlanOoxml(bytes,mime),{code:'PLAN_IMPORT_FILE_INVALID'});
});
test('malformed original workbook is typed as pre-reservation source rejection before any store call',async()=>{
 const bytes=changed('xl/workbook.xml',s=>'<!DOCTYPE workbook>'+s),f=form(bytes);let error;try{await boundedPlanMultipart(request(f));}catch(e){error=e;}assert.equal(error.code,'PLAN_IMPORT_FILE_INVALID');assert.deepEqual(planImportSourceRejection(error),{scope:f.get('scope'),projectId:f.get('projectId'),operationId:f.get('operationId')});
});
test('public analysis accepts only bounded declaration flags, never financial values or grants',async()=>{
 const analysis=(await extractMonthlyPlanOoxml(ooxmlFixture(),mime)).spreadsheet;assert.deepEqual(safePlanOoxmlAnalysis(analysis),analysis);for(const bad of [{...analysis,progressImported:true},{...analysis,formulasRecalculated:true},{...analysis,amount:100},{...analysis,permission:true},{...analysis,periodOrdinals:[1,3]},{...analysis,rowCount:51}])assert.equal(safePlanOoxmlAnalysis(bad),null);
});
