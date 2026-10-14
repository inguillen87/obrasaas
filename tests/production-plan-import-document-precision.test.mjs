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

function cumulativeOnly(values,{percentage=false,rawTexts=[]}={}){
 const curve=documentCurveFixture();delete curve.coherence;
 const absent={rawText:null,decimalText:null,evidence:[],uncertainty:'Not printed'};
 curve.total=structuredClone(absent);curve.initialCumulative=structuredClone(absent);
 curve.periods=values.map((value,index)=>{const p=structuredClone(curve.periods[0]);p.ordinal=index+1;p.label='Mes '+p.ordinal;p.calendarMonth=null;p.calendarEvidence=[];
  for(const name of ['monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage'])p[name]=structuredClone(absent);
  if(value!==null){const name=percentage?'cumulativePercentage':'cumulativeAmount',raw=rawTexts[index]??(percentage?String(Number(value)*100)+' %':value);p[name]={rawText:raw,decimalText:value,evidence:[{page:1,bbox:null,quote:raw}],uncertainty:''};}
  return p;});return curve;
}

test('known cumulative amounts cannot decrease across an unknown month without any total to mask the defect',()=>{
 for(const values of [['25',null,'20'],['100000000000000000002',null,'100000000000000000001']]){
  const input=cumulativeOnly(values),snapshot=structuredClone(input),result=normalizeDocumentCurve(input);
  assert.equal(result.coherence.status,'INCONSISTENT');assert.deepEqual(result.coherence.checks.find(check=>check.kind==='CUMULATIVE_MONOTONIC'&&check.ordinal===3),{kind:'CUMULATIVE_MONOTONIC',ordinal:3,status:'MISMATCH'});
  assert.equal(result.periods[1].cumulativeAmount.decimalText,null);assert.equal(result.total.decimalText,null);assert.deepEqual(input,snapshot);
 }
});

test('increasing cumulative observations retain their gap and never fill monthly amounts',()=>{
 const input=cumulativeOnly(['20',null,'25']),result=normalizeDocumentCurve(input);
 assert.equal(result.coherence.status,'INCOMPLETE');assert.equal(result.coherence.checks.find(check=>check.kind==='CUMULATIVE_MONOTONIC'&&check.ordinal===3).status,'MATCH');
 assert.deepEqual(result.periods.map(p=>p.cumulativeAmount.decimalText),['20',null,'25']);assert.ok(result.periods.every(p=>p.monthlyAmount.decimalText===null));
});

test('percentage-only cumulative curves reject a decrease with or without an unknown month',()=>{
 for(const values of [['0.25','0.20'],['0.25',null,'0.20']]){
  const result=normalizeDocumentCurve(cumulativeOnly(values,{percentage:true}));assert.equal(result.coherence.status,'INCONSISTENT');
  assert.deepEqual(result.coherence.checks.find(check=>check.kind==='CUMULATIVE_PERCENTAGE_MONOTONIC'),{kind:'CUMULATIVE_PERCENTAGE_MONOTONIC',ordinal:values.length,status:'MISMATCH'});
  assert.ok(result.periods.every(p=>p.cumulativeAmount.decimalText===null));
 }
});

test('overlapping printed percentage precision permits equal cumulative observations without rewriting proposals',()=>{
 const input=cumulativeOnly(['0.3333',null,'0.333'],{percentage:true,rawTexts:['33.33 %',null,'33.3 %']}),snapshot=structuredClone(input),result=normalizeDocumentCurve(input);
 assert.equal(result.coherence.status,'INCOMPLETE');assert.equal(result.coherence.checks.find(check=>check.kind==='CUMULATIVE_PERCENTAGE_MONOTONIC').status,'MATCH_PRINTED_PRECISION');assert.deepEqual(input,snapshot);
 input.periods[0].cumulativePercentage.decimalText='0.34';const invalid=normalizeDocumentCurve(input);assert.equal(invalid.coherence.status,'INCONSISTENT');assert.equal(invalid.coherence.checks.find(check=>check.kind==='CUMULATIVE_PERCENTAGE_MONOTONIC').status,'MISMATCH');
});

test('a coarse intermediate percentage cannot conceal a decrease between precise cumulative endpoints',()=>{
 const input=cumulativeOnly(['0.3333','0.33','0.3330'],{percentage:true,rawTexts:['33.33 %','33 %','33.30 %']}),snapshot=structuredClone(input),result=normalizeDocumentCurve(input);
 assert.equal(result.coherence.status,'INCONSISTENT');
 assert.deepEqual(result.coherence.checks.filter(check=>check.kind==='CUMULATIVE_PERCENTAGE_MONOTONIC'),[{kind:'CUMULATIVE_PERCENTAGE_MONOTONIC',ordinal:2,status:'MATCH_PRINTED_PRECISION'},{kind:'CUMULATIVE_PERCENTAGE_MONOTONIC',ordinal:3,status:'MISMATCH'}]);
 assert.deepEqual(input,snapshot);assert.ok(result.periods.every(p=>p.cumulativeAmount.decimalText===null));
});

test('globally overlapping percentage intervals remain valid through a coarse observation and a missing month',()=>{
 const input=cumulativeOnly(['0.3333','0.33',null,'0.3333'],{percentage:true,rawTexts:['33.33 %','33 %',null,'33.33 %']}),snapshot=structuredClone(input),result=normalizeDocumentCurve(input);
 assert.equal(result.coherence.status,'INCOMPLETE');
 assert.deepEqual(result.coherence.checks.filter(check=>check.kind==='CUMULATIVE_PERCENTAGE_MONOTONIC'),[{kind:'CUMULATIVE_PERCENTAGE_MONOTONIC',ordinal:2,status:'MATCH_PRINTED_PRECISION'},{kind:'CUMULATIVE_PERCENTAGE_MONOTONIC',ordinal:4,status:'MATCH'}]);
 assert.equal(result.periods[2].cumulativePercentage.decimalText,null);assert.deepEqual(input,snapshot);
});

test('neither a mismatched current nor a mismatched earlier proposal gains rounding from another literal percentage',()=>{
 for(const [values,rawTexts] of [[['0.333','0.3329'],['33.3 %','33.3 %']],[['0.3331','0.333'],['33.30 %','33.3 %']]]){
  const input=cumulativeOnly(values,{percentage:true,rawTexts}),snapshot=structuredClone(input);
  const result=normalizeDocumentCurve(input);assert.equal(result.coherence.status,'INCONSISTENT');assert.equal(result.coherence.checks.find(check=>check.kind==='CUMULATIVE_PERCENTAGE_MONOTONIC').status,'MISMATCH');
  assert.deepEqual(input,snapshot);
 }
});
