import test from 'node:test';
import assert from 'node:assert/strict';
import {documentCurveFixture} from './fixtures/plan-import-document-curve-synthetic.mjs';
import {normalizeDocumentCurve} from '../src/lib/plan-import-document-curve.mjs';

const printed=(field,rawText,decimalText)=>({...field,rawText,decimalText,evidence:field.evidence.map(ref=>({...ref,quote:rawText}))});
function rounded(){
 const curve=documentCurveFixture();delete curve.coherence;
 curve.total=printed(curve.total,'3','3');curve.initialCumulative=printed(curve.initialCumulative,'0','0');
 for(const [index,amount,cumulative,ratio,raw] of [[0,'1','1','0.3333','33,33 %'],[1,'2','3','0.6667','66.67 %']]){
  const p=curve.periods[index];p.monthlyAmount=printed(p.monthlyAmount,amount,amount);p.cumulativeAmount=printed(p.cumulativeAmount,cumulative,cumulative);
  p.monthlyPercentage=printed(p.monthlyPercentage,raw,ratio);p.cumulativePercentage=printed(p.cumulativePercentage,index===0?raw:'100 %',index===0?ratio:'1');
 }
 return curve;
}

test('printed percentage precision permits rounding without rewriting monetary values or source text',()=>{
 const input=rounded(),snapshot=structuredClone(input),result=normalizeDocumentCurve(input);
 assert.equal(result.coherence.status,'CONSISTENT');
 assert.equal(result.coherence.checks.filter(check=>check.status==='MATCH_PRINTED_PRECISION').length,3);
 assert.deepEqual(input,snapshot);delete result.coherence;assert.deepEqual(result,snapshot);
});

test('percentage disagreement outside its actual printed precision remains inconsistent',()=>{
 const input=rounded();input.periods[0].monthlyPercentage=printed(input.periods[0].monthlyPercentage,'33,30 %','0.3330');
 const result=normalizeDocumentCurve(input);assert.equal(result.coherence.status,'INCONSISTENT');
 assert.deepEqual(result.coherence.checks.find(check=>check.kind==='MONTHLY_PERCENTAGE'&&check.ordinal===1),{kind:'MONTHLY_PERCENTAGE',ordinal:1,status:'MISMATCH'});
 assert.equal(result.periods[0].monthlyAmount.decimalText,'1');assert.equal(result.periods[0].monthlyPercentage.rawText,'33,30 %');
});

test('a normalized ratio that does not equal the printed percentage cannot gain rounding tolerance',()=>{
 const input=rounded();input.periods[0].monthlyPercentage.decimalText='0.33335';
 const result=normalizeDocumentCurve(input);assert.equal(result.coherence.status,'INCONSISTENT');
 assert.equal(result.coherence.checks.find(check=>check.kind==='MONTHLY_PERCENTAGE'&&check.ordinal===1).status,'MISMATCH');
});

test('rounded percentages cannot conceal a monetary total or accumulated discrepancy',()=>{
 for(const field of ['monthlyAmount','cumulativeAmount']){
  const input=rounded();input.periods[1][field]=printed(input.periods[1][field],'2.9999','2.9999');
  const result=normalizeDocumentCurve(input);assert.equal(result.coherence.status,'INCONSISTENT');
  assert.ok(result.coherence.checks.some(check=>['MONTHLY_TOTAL','CUMULATIVE_AMOUNT','FINAL_TOTAL'].includes(check.kind)&&check.status==='MISMATCH'));
 }
});

test('large monetary amounts use the same integer interval rather than floating point tolerances',()=>{
 const input=rounded(),unit=100000000000000000001n;
 input.total=printed(input.total,String(3n*unit),String(3n*unit));
 for(const [index,multiplier] of [[0,1n],[1,2n]]){
  const p=input.periods[index];p.monthlyAmount=printed(p.monthlyAmount,String(multiplier*unit),String(multiplier*unit));
  const accumulated=index===0?unit:3n*unit;p.cumulativeAmount=printed(p.cumulativeAmount,String(accumulated),String(accumulated));
 }
 const result=normalizeDocumentCurve(input);assert.equal(result.coherence.status,'CONSISTENT');
 assert.equal(result.periods[0].monthlyAmount.decimalText,'100000000000000000001');
});

function calendarGap(lastMonth){
 const curve=documentCurveFixture();delete curve.coherence;
 curve.periods.push(structuredClone(curve.periods[1]));
 for(const [index,amount,cumulative,percentage] of [[0,'25','25','0.25'],[1,'25','50','0.25'],[2,'50','100','0.5']]){
  const p=curve.periods[index];p.ordinal=index+1;p.label='Mes '+p.ordinal;
  p.monthlyAmount=printed(p.monthlyAmount,amount,amount);p.cumulativeAmount=printed(p.cumulativeAmount,cumulative,cumulative);
  p.monthlyPercentage=printed(p.monthlyPercentage,String(Number(percentage)*100)+' %',percentage);
  p.cumulativePercentage=printed(p.cumulativePercentage,cumulative+' %',String(Number(cumulative)/100));
  p.calendarMonth=index===0?'2026-01':index===1?null:lastMonth;
  p.calendarEvidence=p.calendarMonth===null?[]:[{page:1,bbox:null,quote:p.calendarMonth}];
 }
 return curve;
}

test('known calendar months separated by an unknown month must respect their ordinal distance',()=>{
 for(const lastMonth of ['2026-01','2026-02','2025-12','2026-04']){
  const result=normalizeDocumentCurve(calendarGap(lastMonth));
  assert.equal(result.coherence.status,'INCONSISTENT',lastMonth);
  assert.deepEqual(result.coherence.checks.find(check=>check.kind==='CALENDAR_SEQUENCE'),{kind:'CALENDAR_SEQUENCE',ordinal:3,status:'MISMATCH'});
  assert.equal(result.periods[1].calendarMonth,null);
 }
});

test('a valid calendar gap is checked without inferring the missing month',()=>{
 const input=calendarGap('2026-03'),snapshot=structuredClone(input),result=normalizeDocumentCurve(input);
 assert.equal(result.coherence.status,'CONSISTENT');
 assert.deepEqual(result.coherence.checks.find(check=>check.kind==='CALENDAR_SEQUENCE'),{kind:'CALENDAR_SEQUENCE',ordinal:3,status:'MATCH'});
 assert.equal(result.periods[1].calendarMonth,null);assert.deepEqual(result.periods[1].calendarEvidence,[]);
 assert.deepEqual(input,snapshot);
});
