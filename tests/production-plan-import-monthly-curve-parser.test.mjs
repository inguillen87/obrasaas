import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {extractMonthlyCurveOoxml,extractMonthlyPlanOoxml,extractCypPlanOoxml,safePlanOoxmlAnalysis,safeMonthlyCurveAnalysis,PLAN_MONTHLY_CURVE_CONSENT,PLAN_OOXML_LIMITS} from '../src/lib/plan-import-ooxml.mjs';
import {monthlyCurveFixture,monthlyCurveFixtureParts} from './fixtures/plan-import-monthly-curve-synthetic.mjs';
import {ooxmlFixture,cypFixture,zipOoxmlFixture} from './fixtures/plan-import-ooxml-synthetic.mjs';
import {normalizePlanRows,validatePlanSourceRows} from '../src/lib/plan-import-policy.mjs';
const mime='application/vnd.ms-excel.sheet.macroenabled.12',xlsx='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const changed=change=>{const parts=monthlyCurveFixtureParts();parts['xl/worksheets/sheet1.xml']=change(parts['xl/worksheets/sheet1.xml']);return zipOoxmlFixture(parts);};
const extract=options=>extractMonthlyCurveOoxml(monthlyCurveFixture(options),mime);
const replaceCell=(xml,address,replacement)=>xml.replace(new RegExp(`<c r="${address}".*?<\\/c>`),replacement);

test('v3 opt-in extracts original monetary caches and stable source row identities without calendar or execution',async()=>{
 const result=await extract(),s=result.spreadsheet;
 assert.equal(PLAN_MONTHLY_CURVE_CONSENT,'plan-spreadsheet-monthly-curve-v3');assert.equal(s.version,3);assert.equal(s.profile,'MONTHLY_RUBROS_CURVE');assert.equal(s.rowCount,2);assert.deepEqual(s.periodOrdinals,[1,2,3]);
 assert.deepEqual(result.rows.map(r=>r.sourceRowId),['Plan y curva Meses!A10','Plan y curva Meses!A12']);assert.ok(result.rows.every(r=>r.startsOn===null&&r.endsOn===null&&r.uncertainty));
 assert.deepEqual(Object.keys(result.rows[0]).sort(),['endsOn','evidence','sourceRowId','startsOn','title','uncertainty']);
 assert.deepEqual(s.items.map(i=>i.sourceTitle),result.rows.map(r=>r.title));assert.equal(s.items[0].sourceRange,'Plan y curva Meses!A10:I11');assert.equal(s.items[0].budget.sourceCell,'Plan y curva Meses!E10');
 assert.equal(s.curve.kind,'PLANNED_MONETARY_INVESTMENT');assert.equal(s.curve.currency,null);assert.equal(s.curve.calendarStart,null);assert.equal(s.curve.initialCumulative.cachedValue,'0.00');assert.equal(s.curve.periods[0].monthlyPercentage.cachedValue,'1.000');
 assert.equal(s.quantityImported,false);assert.equal(s.progressImported,false);assert.equal(s.dependenciesImported,false);assert.equal(s.macrosExecuted,false);assert.equal(s.formulasRecalculated,false);assert.equal(s.weeklyStatus,'FORMULA_ERRORS');assert.ok(result.warnings.some(w=>w.includes('completa del archivo original')));
 assert.deepEqual(safePlanOoxmlAnalysis(s),s);assert.deepEqual(safeMonthlyCurveAnalysis(s),s);
});

test('cached decimal lexemes retain precision, signs, exponent and zero formatting without float reserialization',async()=>{
 const exact='9007199254740993.1234567890123456789012345',result=await extract({curveTotal:exact,monthlyAmounts:['+9.0071992547409931234567890123456789012345E15','0.000000','00.00'],cumulativeAmounts:[exact,exact,exact],monthlyPercentages:['.9999999999999999999999999999999999','1E-35','0.0']});
 assert.equal(result.spreadsheet.curve.total.cachedValue,exact);assert.equal(result.spreadsheet.curve.periods[0].monthlyAmount.cachedValue,'+9.0071992547409931234567890123456789012345E15');assert.equal(result.spreadsheet.curve.periods[1].monthlyAmount.cachedValue,'0.000000');assert.equal(result.spreadsheet.curve.periods[2].monthlyAmount.cachedValue,'00.00');
 assert.equal(result.spreadsheet.curve.periods[0].monthlyPercentage.cachedValue,'.9999999999999999999999999999999999');
});

test('v3 keeps the original padded source title while normalized rows pass immutable source validation',async()=>{
 const sourceTitle='  Rubro sintético 1  ',bytes=changed(xml=>replaceCell(xml,'B10',`<c r="B10" t="inlineStr"><is><t>${sourceTitle}</t></is></c>`)),result=await extractMonthlyCurveOoxml(bytes,mime);
 assert.equal(result.rows[0].title,sourceTitle);assert.equal(result.spreadsheet.items[0].sourceTitle,sourceTitle);
 const normalized=normalizePlanRows(result.rows);assert.equal(normalized[0].title,sourceTitle.trim());
 assert.deepEqual(validatePlanSourceRows(normalized,result.spreadsheet,normalized),normalized);
 const reviewed=normalized.map(row=>({...row,title:'Título revisado '+row.sourceRowId,startsOn:'2026-11-01',endsOn:'2026-11-02',uncertainty:''}));
 assert.deepEqual(validatePlanSourceRows(normalizePlanRows(reviewed,{complete:true}),result.spreadsheet,normalized,{complete:true}),reviewed);
 assert.equal(result.spreadsheet.items[0].sourceTitle,sourceTitle);
 const altered=structuredClone(result.spreadsheet);altered.items[0].sourceTitle='Otro origen';
 assert.throws(()=>validatePlanSourceRows(normalized,altered,normalized),{code:'PLAN_IMPORT_ROWS_INVALID'});
});

test('plain missing caches remain unknown null distinct from explicit zero; formula without cache rejects',async()=>{
 const s=(await extract({monthlyAmounts:[null,'0','0'],initialCumulative:null})).spreadsheet;
 assert.equal(s.curve.periods[0].monthlyAmount.cachedValue,null);assert.equal(s.curve.periods[0].monthlyAmount.hasFormula,false);assert.equal(s.curve.periods[1].monthlyAmount.cachedValue,'0');assert.equal(s.curve.initialCumulative.cachedValue,null);
 await assert.rejects(extractMonthlyCurveOoxml(changed(xml=>replaceCell(xml,'G18','<c r="G18"><f>SUM(G10:G13)</f></c>')),mime),{code:'PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID'});
});

test('source formulas are provenance only; original cached strings survive and are not evaluated',async()=>{
 const bytes=changed(xml=>replaceCell(xml,'G18','<c r="G18"><f>SUM(G10:G13)</f><v>999.00000000001</v></c>')),s=(await extractMonthlyCurveOoxml(bytes,mime)).spreadsheet;
 assert.equal(s.curve.periods[0].monthlyAmount.cachedValue,'999.00000000001');assert.equal(s.curve.periods[0].monthlyAmount.hasFormula,true);assert.equal(s.formulasRecalculated,false);
});

test('selected source errors, remote/DDE formulas, nonnumeric types and malformed caches fail closed',async()=>{
 const bad=['<c r="G18" t="e"><f>#REF!</f><v>#REF!</v></c>','<c r="G18"><f>WEBSERVICE("https://example.invalid")</f><v>201</v></c>','<c r="G18"><f>[remote.xlsx]Sheet!A1</f><v>201</v></c>','<c r="G18"><f>Server|DDE!A1</f><v>201</v></c>','<c r="G18" t="str"><v>201</v></c>','<c r="G18"><v>NaN</v></c>','<c r="G18"><v>Infinity</v></c>','<c r="G18"><v>1E101</v></c>','<c r="G18"><v>'+('1'.repeat(129))+'</v></c>'];
 for(const replacement of bad)await assert.rejects(extractMonthlyCurveOoxml(changed(xml=>replaceCell(xml,'G18',replacement)),mime));
});

test('negative money or out-of-range percentages are rejected exactly beyond IEEE rounding',async()=>{
 for(const options of [{curveTotal:'-0.00000000000000000000001'},{monthlyAmounts:['-1','0','0']},{monthlyPercentages:['1.0000000000000000000000000000000001','0','0']},{cumulativePercentages:['-1E-100','1','1']}])await assert.rejects(extract(options),{code:'PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED'});
});

test('footer roles must be unique, ordered and after all source rubros',async()=>{
 for(const change of [xml=>xml.replace('IMPORTE TOTAL MENSUAL','UNKNOWN'),xml=>xml.replace('</sheetData>','<row><c r="B99" t="inlineStr"><is><t>TOTAL</t></is></c></row></sheetData>'),xml=>xml.replace('IMPORTE TOTAL MENSUAL','TEMP').replace('IMPORTE TOTAL ACUMULADO','IMPORTE TOTAL MENSUAL').replace('TEMP','IMPORTE TOTAL ACUMULADO'),xml=>xml.replace('r="B15"','r="B9"')])await assert.rejects(extractMonthlyCurveOoxml(changed(change),mime),{code:'PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED'});
});

test('safe v3 rejects unknown fields, permissions, execution claims, inferred currency/calendar and source identity swaps',async()=>{
 const original=(await extract()).spreadsheet;
 const mutations=[s=>{s.amount=1;},s=>{s.progressImported=true;},s=>{s.curve.currency='ARS';},s=>{s.curve.calendarStart='2026-10-07';},s=>{s.curve.actualProgress=[];},s=>{s.items[0].sourceRowId=s.items[1].sourceRowId;},s=>{s.items[0].sourceTitle='<script>unsafe</script>';},s=>{s.items[0].permission=true;},s=>{s.items[0].sourceRange='Plan y curva Meses!A12:I13';},s=>{s.items[0].budget.sourceCell='Other sheet!E10';},s=>{s.items[0].budget.cachedValue=100;},s=>{s.items[0].budget.cachedValue=null;},s=>{s.items[0].ordinalDistribution[0].cachedValue='0';},s=>{s.curve.total.sourceCell='Plan y curva Meses!E10';},s=>{s.curve.periods[0].ordinal=2;},s=>{s.curve.periods[0].headerCell='Plan y curva Meses!H9';},s=>{s.curve.periods[0].monthlyAmount.sourceCell='Plan y curva Meses!H18';},s=>{s.curve.periods[1].monthlyAmount.sourceCell='Plan y curva Meses!H99';},s=>{s.curve.periods[0].monthlyAmount.cachedValue=null;s.curve.periods[0].monthlyAmount.hasFormula=true;},s=>{s.periodOrdinals=[1,3];},s=>{s.weeklyStatus='NOT_SELECTED';},s=>{s.items.pop();},s=>{s.curve.periods.pop();}];
 for(const mutate of mutations){const changed=structuredClone(original);mutate(changed);assert.equal(safeMonthlyCurveAnalysis(changed),null);assert.equal(safePlanOoxmlAnalysis(changed),null);}
});

test('safe v3 returns independent deep copies of every cache, period and source item',async()=>{
 const s=(await extract()).spreadsheet,copy=safeMonthlyCurveAnalysis(s);copy.items[0].budget.cachedValue='9';copy.items[0].ordinalDistribution[0].cachedValue='0';copy.curve.total.cachedValue='1';copy.curve.initialCumulative.cachedValue='2';copy.curve.periods[0].monthlyAmount.cachedValue='3';copy.curve.periods[0].cumulativeAmount.cachedValue='4';copy.curve.periods[0].monthlyPercentage.cachedValue='5';copy.curve.periods[0].cumulativePercentage.cachedValue='6';copy.periodOrdinals[0]=2;
 assert.equal(s.items[0].budget.cachedValue,'100');assert.equal(s.items[0].ordinalDistribution[0].cachedValue,'1');assert.equal(s.curve.total.cachedValue,'201');assert.equal(s.curve.initialCumulative.cachedValue,'0.00');assert.equal(s.curve.periods[0].monthlyAmount.cachedValue,'201');assert.equal(s.curve.periods[0].cumulativeAmount.cachedValue,'201');assert.equal(s.curve.periods[0].monthlyPercentage.cachedValue,'1.000');assert.equal(s.curve.periods[0].cumulativePercentage.cachedValue,'1');assert.equal(s.periodOrdinals[0],1);
});

test('v3 preserves source bytes and can extract XLSX or inert-macro XLSM without network or macro activity',async()=>{
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('network forbidden');};
 try {for(const type of ['xlsm','xlsx']){const bytes=monthlyCurveFixture({type}),before=createHash('sha256').update(bytes).digest('hex'),s=(await extractMonthlyCurveOoxml(bytes,type==='xlsm'?mime:xlsx)).spreadsheet;assert.equal(createHash('sha256').update(bytes).digest('hex'),before);assert.equal(s.macrosExecuted,false);assert.equal(s.formulasRecalculated,false);assert.equal(s.usesCachedValues,true);}}
 finally {globalThis.fetch=originalFetch;}
});

test('v3 requires explicit complete footer profile; ordinary v1 remains ordinary and v2 unchanged',async()=>{
 await assert.rejects(extractMonthlyCurveOoxml(ooxmlFixture(),mime),{code:'PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED'});
 const ordinary=await extractMonthlyPlanOoxml(monthlyCurveFixture(),mime);assert.equal(ordinary.spreadsheet.version,1);assert.equal(ordinary.spreadsheet.profile,'MONTHLY_RUBROS');assert.equal(ordinary.spreadsheet.curve,undefined);assert.equal(ordinary.rows[0].sourceRowId,undefined);
 assert.equal((await extractCypPlanOoxml(cypFixture(),xlsx)).spreadsheet.version,2);assert.equal(safePlanOoxmlAnalysis((await extractCypPlanOoxml(cypFixture(),xlsx)).spreadsheet).version,2);
});

test('v3 retains full bounded fifty rubros and excluded budget count; fifty-one rejects rather than truncating',async()=>{
 const s=(await extract({rubros:50,details:90})).spreadsheet;assert.equal(s.items.length,50);assert.equal(s.rowCount,50);assert.equal(s.detailRowsExcluded,90);assert.equal(s.items.at(-1).sourceRowId,'Plan y curva Meses!A108');
 await assert.rejects(extract({rubros:51}),{code:'PLAN_IMPORT_ROWS_LIMIT'});
});

test('v3 shares the unchanged bounded OOXML reader and rejects ZIP corruption, duplicates, XXE and hidden selected views',async()=>{
 const parts=monthlyCurveFixtureParts(),bad=[zipOoxmlFixture({...parts,'xl/workbook.xml':{data:parts['xl/workbook.xml'],badCRC:true}}),zipOoxmlFixture({...parts,'xl/workbook.xml':{data:parts['xl/workbook.xml'],declaredSize:PLAN_OOXML_LIMITS.partBytes+1}}),zipOoxmlFixture({...parts,'xl/workbook.xml':'<!DOCTYPE workbook [<!ENTITY unsafe SYSTEM "file:///private">]>'+parts['xl/workbook.xml']}),zipOoxmlFixture([...Object.entries(parts),['xl/workbook.xml',parts['xl/workbook.xml']]]),zipOoxmlFixture({...parts,'xl/workbook.xml':parts['xl/workbook.xml'].replace('sheetId="1"','sheetId="1" state="hidden"')})];
 for(const bytes of bad)await assert.rejects(extractMonthlyCurveOoxml(bytes,mime));
});
