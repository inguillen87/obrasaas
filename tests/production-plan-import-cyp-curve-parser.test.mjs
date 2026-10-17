import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCypPlanOoxml,extractCypCurveOoxml,extractCypInvestmentOoxml,safePlanOoxmlAnalysis,safeCypInvestmentAnalysis,PLAN_CYP_INVESTMENT_CONSENT,PLAN_CYP_INVESTMENT_PROFILE,PLAN_CYP_INVESTMENT_PURPOSE} from '../src/lib/plan-import-ooxml.mjs';
import {createHash} from 'node:crypto';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {normalizePlanRows,validatePlanSourceRows,boundedPlanMultipart,PLAN_IMPORT_CYP_CURVE_CONSENT} from '../src/lib/plan-import-policy.mjs';
import {cypCurveFixture,cypCurveFixtureParts,cypInvestmentFixture,cypInvestmentFixtureParts} from './fixtures/plan-import-cyp-curve-synthetic.mjs';
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

test('v5 financial-only preserves the exact v4 monthly curve and all48 shared-formula weekly caches without Task rows',async()=>{
 const bytes=cypInvestmentFixture(),legacy=await extractCypCurveOoxml(bytes,mime),result=await extractCypInvestmentOoxml(bytes,mime),s=result.spreadsheet;
 assert.deepEqual(result.rows,[]);assert.equal(legacy.rows.length,190);assert.deepEqual(s.monthly,legacy.spreadsheet.curve);assert.equal(s.version,5);assert.equal(s.profile,PLAN_CYP_INVESTMENT_PROFILE);assert.equal(PLAN_CYP_INVESTMENT_CONSENT,'plan-spreadsheet-cyp-investment-curves-v1');assert.equal(PLAN_CYP_INVESTMENT_PURPOSE,'FINANCIAL_CYP_INVESTMENT_CURVES');
 assert.equal(s.sourceSha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(s.weekly.granularity,'ORDINAL_WEEK_12X4');assert.equal(s.weekly.currency,null);assert.equal(s.weekly.calendarStart,null);assert.deepEqual(s.weekly.total,s.monthly.total);assert.equal(s.weekly.periods.length,48);
 assert.deepEqual(s.weekly.periods[0],{ordinal:1,monthOrdinal:1,weekInMonth:1,monthHeaderCell:'Plan de trabajo!J5',weekHeaderCell:'Plan de trabajo!J6',amount:{sourceCell:'Plan de trabajo!J234',cachedValue:'12345678901234567890.1234500',hasFormula:true}});
 assert.deepEqual(s.weekly.periods.at(-1),{ordinal:48,monthOrdinal:12,weekInMonth:4,monthHeaderCell:'Plan de trabajo!BB5',weekHeaderCell:'Plan de trabajo!BE6',amount:{sourceCell:'Plan de trabajo!BE234',cachedValue:'0.0000',hasFormula:true}});
 assert.equal(s.comparison.status,'MATCH');assert.equal(s.comparison.differenceDecimalText,'0.0000000');assert.deepEqual(safePlanOoxmlAnalysis(s),s);assert.deepEqual(safeCypInvestmentAnalysis(s),s);
 assert.equal(Object.hasOwn(s,'items'),false);assert.ok(result.warnings.some(w=>w.includes('No se crearon tareas')));
});

test('v5 retains exact lexemes beyond Number precision and exposes a discrepancy without tolerance or correction',async()=>{
 const weeklyAmounts=Array.from({length:48},(_,i)=>i===0?'+1.23456789012345678901704500E19':i===1?'00.000000000':'0.0000');
 const result=await extractCypInvestmentOoxml(cypInvestmentFixture({weeklyAmounts}),mime),s=result.spreadsheet;
 assert.equal(s.weekly.periods[0].amount.cachedValue,weeklyAmounts[0]);assert.equal(s.weekly.periods[1].amount.cachedValue,'00.000000000');assert.equal(s.monthly.total.cachedValue,'12345678901234567890.1234500');assert.equal(s.monthly.initialCumulative.cachedValue,null);
 assert.equal(s.comparison.status,'DIFFERENT');assert.equal(s.comparison.weeklySumDecimalText,'12345678901234567890.170450000');assert.equal(s.comparison.totalDecimalText,'12345678901234567890.1234500');assert.equal(s.comparison.differenceDecimalText,'0.047000000');assert.ok(result.warnings.some(w=>w.includes('0.047000000')));
 assert.equal(Number(s.comparison.weeklySumDecimalText),Number(s.comparison.totalDecimalText),'A Number conversion would conceal this exact discrepancy');
});

test('v5 supports independent equivalent weekly formulas without changing any preserved monetary cache',async()=>{
 const shared=await extractCypInvestmentOoxml(cypInvestmentFixture(),mime),independent=await extractCypInvestmentOoxml(cypInvestmentFixture({sharedWeekly:false}),mime);
 assert.deepEqual(independent.spreadsheet.weekly,shared.spreadsheet.weekly);assert.deepEqual(independent.spreadsheet.monthly,shared.spreadsheet.monthly);assert.deepEqual(independent.spreadsheet.comparison,shared.spreadsheet.comparison);assert.notEqual(independent.spreadsheet.sourceSha256,shared.spreadsheet.sourceSha256);
});

test('v5 does not invent the actual source footer row or a partial financial series when physical source size changes',async()=>{
 const result=await extractCypInvestmentOoxml(cypInvestmentFixture({partidas:200}),mime);assert.deepEqual(result.rows,[]);assert.equal(result.spreadsheet.weekly.total.sourceCell,'Plan de trabajo!I243');assert.equal(result.spreadsheet.weekly.periods[0].amount.sourceCell,'Plan de trabajo!J244');assert.equal(result.spreadsheet.weekly.periods.at(-1).amount.sourceCell,'Plan de trabajo!BE244');
});

for(const[name,before,after,code='PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID']of [
 ['shared master wrong range','ref="J234:BE234"','ref="J234:BD234"'],
 ['shared master crosses rows','ref="J234:BE234"','ref="J234:BE235"'],
 ['foreign cost denominator','SUMPRODUCT($F$7:$F$232,J7:J232)','SUMPRODUCT($G$7:$G$232,J7:J232)'],
 ['foreign weekly source column','SUMPRODUCT($F$7:$F$232,J7:J232)','SUMPRODUCT($F$7:$F$232,K7:K232)'],
 ['external selected formula','SUMPRODUCT($F$7:$F$232,J7:J232)',"SUMPRODUCT('[foreign.xlsx]Plan de trabajo'!F7:F232,J7:J232)"],
 ['missing shared member','<c r="K234"><f t="shared" si="42"/><v>0.0000</v></c>',''],
 ['orphan shared member','<c r="K234"><f t="shared" si="42"/>','<c r="K234"><f t="shared" si="43"/>','PLAN_IMPORT_FILE_INVALID'],
 ['weekly role changed','Certificado semanal ($)','Certificado ejecutado ($)','PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED']
])test('v5 fails closed on '+name+' without reinterpreting the monthly profile',async()=>{
 const parts=cypInvestmentFixtureParts(),sheet='xl/worksheets/sheet1.xml';assert.ok(parts[sheet].includes(before));parts[sheet]=parts[sheet].replace(before,after);await assert.rejects(extractCypInvestmentOoxml(zipOoxmlFixture(parts),mime),{code});
});

test('v5 validates the whole shared formula membership and every selected cache before returning either series',async()=>{
 const sheet='xl/worksheets/sheet1.xml';
 for(const address of ['J234','K234','BE234'])for(const kind of ['error','missing','text','invalid','negative','exponent']){
  const parts=cypInvestmentFixtureParts(),pattern=new RegExp(`<c r="${address}">([\\s\\S]*?)</c>`),match=pattern.exec(parts[sheet]);assert.ok(match);
  const value=kind==='error'?'#REF!':kind==='invalid'?'NaN':kind==='negative'?'-0.0001':kind==='exponent'?'1e101':'0';
  let changed=match[0].replace(/<v>[^<]*<\/v>/,kind==='missing'?'':`<v>${value}</v>`);if(kind==='error'||kind==='text')changed=changed.replace(`<c r="${address}">`,`<c r="${address}" t="${kind==='error'?'e':'str'}">`);
  parts[sheet]=parts[sheet].replace(match[0],changed);await assert.rejects(extractCypInvestmentOoxml(zipOoxmlFixture(parts),mime),{code:'PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID'},address+' '+kind);
 }
 const extra=cypInvestmentFixtureParts();extra[sheet]=addSyntheticCell(extra[sheet],'<c r="BF234"><f t="shared" si="42"/><v>0</v></c>');await assert.rejects(extractCypInvestmentOoxml(zipOoxmlFixture(extra),mime),{code:'PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID'});
 const legacy=cypCurveFixture();assert.equal((await extractCypCurveOoxml(legacy,mime)).spreadsheet.version,4);await assert.rejects(extractCypInvestmentOoxml(legacy,mime),{code:'PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID'});
});
const addSyntheticCell=(xml,cell)=>xml.replace('</sheetData>',`<row>${cell}</row></sheetData>`);

test('v5 source validation rejects omission extras reorder duplicate periods origin relabeling and forged comparison while returning detached copies',async()=>{
 const s=(await extractCypInvestmentOoxml(cypInvestmentFixture(),mime)).spreadsheet;
 for(const mutate of [v=>delete v.monthly,v=>{v.reviewed=true;},v=>{v.version=4;},v=>{v.sourceSha256='';},v=>{v.profile='CYP_PARTIDAS_CURVE';},v=>{v.weekly.currency='ARS';},v=>{v.weekly.calendarStart='2026-01-01';},v=>{v.weekly.granularity='WEEKLY_ISO';},v=>v.weekly.periods.pop(),v=>v.weekly.periods.push(v.weekly.periods[0]),v=>v.weekly.periods.reverse(),v=>{v.weekly.periods[1]=v.weekly.periods[0];},v=>{v.weekly.periods[0].monthOrdinal=2;},v=>{v.weekly.periods[0].weekInMonth=2;},v=>{v.weekly.periods[0].monthHeaderCell='Plan de trabajo!K5';},v=>{v.weekly.periods[0].weekHeaderCell='Plan de trabajo!K6';},v=>{v.weekly.periods[0].amount.sourceCell='Plan de trabajo!J235';},v=>{v.weekly.periods[0].amount.cachedValue=null;},v=>{v.weekly.periods[0].amount.hasFormula=false;},v=>{v.weekly.periods[0].cumulativeAmount='0';},v=>{v.weekly.total.cachedValue='0';},v=>{v.comparison.status='DIFFERENT';},v=>{v.comparison.weeklySumDecimalText='0';},v=>{v.comparison.totalDecimalText='0';},v=>{v.comparison.differenceDecimalText='0';},v=>{v.monthly.periods[0].headerCell='Curva de Inversion!B30';},v=>{v.monthly.currency='USD';}]){
  const changed=structuredClone(s);mutate(changed);assert.equal(safeCypInvestmentAnalysis(changed),null);assert.equal(safePlanOoxmlAnalysis(changed),null);
 }
 const copy=safeCypInvestmentAnalysis(s);copy.weekly.periods[0].amount.cachedValue='0';copy.monthly.periods[0].monthlyAmount.cachedValue='0';copy.comparison.status='DIFFERENT';assert.equal(s.weekly.periods[0].amount.cachedValue,'12345678901234567890.1234500');assert.equal(s.monthly.periods[0].monthlyAmount.cachedValue,'12345678901234567890.1234500');assert.equal(s.comparison.status,'MATCH');
});
