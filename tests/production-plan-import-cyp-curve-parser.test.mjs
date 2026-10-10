import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCypPlanOoxml,extractCypCurveOoxml,safePlanOoxmlAnalysis} from '../src/lib/plan-import-ooxml.mjs';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {normalizePlanRows,validatePlanSourceRows,boundedPlanMultipart,PLAN_IMPORT_CYP_CURVE_CONSENT} from '../src/lib/plan-import-policy.mjs';
import {cypCurveFixture,cypCurveFixtureParts} from './fixtures/plan-import-cyp-curve-synthetic.mjs';
import {zipOoxmlFixture} from './fixtures/plan-import-ooxml-synthetic.mjs';
const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const invalid={code:'PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED'};

test('v4 keeps the complete v2 physical extraction and exact lexical caches from all 12 source months',async()=>{
 const bytes=cypCurveFixture(),legacy=await extractCypPlanOoxml(bytes,mime),result=await extractCypCurveOoxml(bytes,mime);
 const {curve,...physical}=result.spreadsheet;
 assert.deepEqual({...physical,version:2,profile:'CYP_PARTIDAS'},legacy.spreadsheet);assert.deepEqual(result.rows,legacy.rows);
 assert.equal(result.rows.length,190);assert.equal(curve.total.sourceCell,'Plan de trabajo!I233');assert.equal(curve.total.cachedValue,'12345678901234567890.1234500');
 assert.deepEqual(curve.initialCumulative,{sourceCell:'Plan de trabajo!I236',cachedValue:null,hasFormula:false});
 assert.equal(curve.periods.length,12);assert.equal(curve.periods[0].monthlyAmount.sourceCell,'Curva de Inversion!A31');assert.equal(curve.periods[11].cumulativePercentage.sourceCell,'Curva de Inversion!L34');
 assert.equal(curve.periods[0].monthlyPercentage.cachedValue,'0.125000');assert.equal(curve.currency,null);assert.equal(curve.calendarStart,null);
 assert.ok(result.rows.every(row=>row.startsOn===null&&row.endsOn===null));assert.ok(result.rows.every(row=>!/[HI]/.test(row.code)));
 assert.deepEqual(safePlanOoxmlAnalysis(result.spreadsheet),result.spreadsheet);
});

test('an explicit cached zero is distinct from an absent initial cumulative value',async()=>{
 const empty=await extractCypCurveOoxml(cypCurveFixture(),mime),zero=await extractCypCurveOoxml(cypCurveFixture({initial:'0.000000'}),mime);
 assert.equal(empty.spreadsheet.curve.initialCumulative.cachedValue,null);assert.equal(zero.spreadsheet.curve.initialCumulative.cachedValue,'0.000000');
});

test('v4 remains local with no AI credentials or provider calls and requires its own multipart consent',async()=>{
 const bytes=cypCurveFixture();let calls=0;const analyzer=createPlanImportAnalyzer({environment:()=>{calls++;throw new Error('No credentials');},fetchImpl:()=>{calls++;throw new Error('No provider');}});
 const result=await analyzer.analyze({bytes,contentType:mime},{profile:'CYP_PARTIDAS_CURVE'});assert.equal(result.success,true);assert.equal(result.provider,'local-ooxml');assert.equal(result.spreadsheet.version,4);assert.equal(calls,0);
 const form=new FormData();for(const [key,value] of Object.entries({projectId:'project-synthetic',scope:'a'.repeat(64),operationId:'01234567-89ab-4cde-8fab-0123456789ab',consent:PLAN_IMPORT_CYP_CURVE_CONSENT}))form.set(key,value);form.set('file',new Blob([bytes],{type:mime}),'synthetic.xlsx');
 const input=await boundedPlanMultipart(new Request('https://synthetic.invalid/api/identity/plan-import',{method:'POST',body:form}));assert.equal(input.consent,PLAN_IMPORT_CYP_CURVE_CONSENT);
});

for(const [name,part,from,to,code=invalid.code] of [
 ['different denominator','sheet1','+J235/$I$233','+J235/$H$233'],
 ['wrong source budget total','sheet1',"'CyP Integral completo'!O232","'CyP Integral completo'!M232"],
 ['swapped monthly/cumulative cache','sheet4',"+'Plan de trabajo'!J235","+'Plan de trabajo'!J236"],
 ['duplicate ordinal label','sheet4','MES 12','MES 11','PLAN_IMPORT_SPREADSHEET_PERIODS_INVALID'],
 ['missing formula cache','sheet4','<v>0.125000</v>','','PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID'],
 ['external selected reference','sheet4',"+'Plan de trabajo'!J235","+'[private.xlsx]Plan de trabajo'!J235",'PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID'],
 ['missing semantic role','sheet1','Certificacion Acumulada (%)','Unexpected summary']
])test('v4 fails closed on '+name+' while the physical v2 source stays usable',async()=>{
 const parts=cypCurveFixtureParts(),path=`xl/worksheets/${part}.xml`;assert.ok(parts[path].includes(from));parts[path]=parts[path].replace(from,to);const bytes=zipOoxmlFixture(parts);
 await assert.rejects(extractCypCurveOoxml(bytes,mime),{code});assert.equal((await extractCypPlanOoxml(bytes,mime)).rows.length,190);
});

test('stored v4 analysis rejects mixed origins, extra financial semantics and unsafe exact decimals',async()=>{
 const {spreadsheet}=await extractCypCurveOoxml(cypCurveFixture(),mime);
 for(const change of [v=>{v.curve.total.sourceCell='Plan de trabajo!H233';},v=>{v.curve.initialCumulative.sourceCell='Plan de trabajo!I235';},v=>{v.curve.periods[0].monthlyAmount.sourceCell='Curva de Inversion!A32';},v=>{v.curve.periods[0].monthlyPercentage.cachedValue='1.00000000000000001';},v=>{v.curve.total.cachedValue='NaN';},v=>{v.curve.currency='ARS';},v=>{v.curve.periods[0].monthlyAmount.cachedValue=null;},v=>{v.curve.executedAmount='1';},v=>{v.profile='CYP_PARTIDAS';}]){
  const value=structuredClone(spreadsheet);change(value);assert.equal(safePlanOoxmlAnalysis(value),null);
 }
 const detached=safePlanOoxmlAnalysis(spreadsheet);detached.curve.total.cachedValue='0';assert.equal(spreadsheet.curve.total.cachedValue,'12345678901234567890.1234500');
});

test('chart caches cannot mask errors, missing formula caches or invalid decimals in their declared sources',async()=>{
 for(const [part,address] of [['sheet1','J235'],['sheet1','N236'],['sheet1','BB238'],['sheet2','O232']])for(const kind of ['error','absent','invalid']){
  const parts=cypCurveFixtureParts(),path=`xl/worksheets/${part}.xml`,pattern=new RegExp(`<c r="${address}">([\\s\\S]*?)</c>`),match=pattern.exec(parts[path]);assert.ok(match);
  const content=kind==='error'?`<c r="${address}" t="e"><f>+1</f><v>#VALUE!</v></c>`:kind==='absent'?match[0].replace(/<v>[^<]*<\/v>/,''):match[0].replace(/<v>[^<]*<\/v>/,'<v>NaN</v>');
  parts[path]=parts[path].replace(match[0],content);const bytes=zipOoxmlFixture(parts);await assert.rejects(extractCypCurveOoxml(bytes,mime),{code:'PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID'});assert.equal((await extractCypPlanOoxml(bytes,mime)).rows.length,190);
 }
});

test('v4 protects original codes/evidence and missing quantity review after editing or excluding rows',async()=>{
 const extraction=await extractCypCurveOoxml(cypCurveFixture(),mime),rows=normalizePlanRows(extraction.rows),shortened=normalizePlanRows(rows.slice(0,3).reverse().map(row=>({...row,title:row.title.slice(0,100),startsOn:'2026-11-01',endsOn:'2026-11-30',uncertainty:''})),{complete:true});
 assert.throws(()=>validatePlanSourceRows(shortened,extraction.spreadsheet,rows,{complete:true}),{code:'PLAN_IMPORT_REVIEW_REQUIRED'});
 shortened.forEach(row=>{row.sourceIssueReviewed=true;});assert.equal(validatePlanSourceRows(shortened,extraction.spreadsheet,rows,{complete:true}),shortened);
 for(const change of [row=>{row.code='A.1.99.1';row.parentCode='A.1.99';},row=>{row.evidence='Different synthetic source';}]){const edited=structuredClone(shortened);change(edited[0]);assert.throws(()=>validatePlanSourceRows(edited,extraction.spreadsheet,rows),{code:'PLAN_IMPORT_ROWS_INVALID'});}
});

test('v4 accepts the current maximum of 200 physical rows without a partial extraction',async()=>{
 const result=await extractCypCurveOoxml(cypCurveFixture({partidas:200}),mime);assert.equal(result.rows.length,200);assert.equal(result.spreadsheet.curve.total.sourceCell,'Plan de trabajo!I243');
 await assert.rejects(extractCypCurveOoxml(cypCurveFixture({partidas:201}),mime),{code:'PLAN_IMPORT_ROWS_LIMIT'});
});
