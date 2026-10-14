import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {DOCUMENT_CURVE_PROFILE,DOCUMENT_CURVE_CONSENT,normalizeDocumentCurve,normalizeDocumentCurveExtraction,safeDocumentCurve,hasDocumentCurveSeriesValue,documentCurveCanonical,documentCurveSchema,documentCurveResponseSchema} from '../src/lib/plan-import-document-curve.mjs';
import {normalizeDocumentCurveDecision,documentCurveDecisionDigest,documentCurveUploadDigest,isDocumentCurveConsent,PLAN_IMPORT_DOCUMENT_CURVE_CONSENT,boundedPlanMultipart,normalizePlanRows,normalizePlanDecision,planDecisionDigest} from '../src/lib/plan-import-policy.mjs';
import {documentCurveFixture,documentCurveProviderFixture,documentCurveNumeric as value,documentCurveEvidence as evidence} from './fixtures/plan-import-document-curve-synthetic.mjs';
const sha='a'.repeat(64),withoutCoherence=curve=>{const copy=structuredClone(curve);delete copy.coherence;return copy;};
const base=()=>withoutCoherence(documentCurveFixture());
const decision=(action='REVIEW_CURVE')=>({action,projectId:'p-document',scope:'b'.repeat(64),operationId:randomUUID(),draftId:'draft-document',expectedRevision:2,reason:'Comparado con el documento sintético.',rows:null,curve:action==='REVIEW_CURVE'?documentCurveFixture():null});

test('document proposals retain exact original text and detached full source evidence',()=>{
 const input=base(),before=structuredClone(input),result=normalizeDocumentCurve(input,{sourceSha256:sha});
 assert.equal(result.profile,DOCUMENT_CURVE_PROFILE);assert.equal(result.coherence.status,'CONSISTENT');assert.equal(result.total.decimalText,'100.00');assert.deepEqual(input,before);
 result.periods[0].monthlyAmount.evidence[0].bbox[0]=0;assert.deepEqual(input,before);
 assert.deepEqual(normalizeDocumentCurve(documentCurveFixture()),documentCurveFixture());
 assert.equal(safeDocumentCurve({...input,sourceSha256:'not-a-hash'}),null);
});
test('BigInt comparisons expose a monetary discrepancy hidden by floating point',async()=>{
 const input=base();input.total=value('9007199254740993.0004');input.periods[0].monthlyAmount=value('9007199254740993.0001');input.periods[0].cumulativeAmount=value('9007199254740993.0001');input.periods[1].monthlyAmount=value('0.0002');input.periods[1].cumulativeAmount=value('9007199254740993.0003');
 for(const p of input.periods){p.monthlyPercentage=value(null);p.cumulativePercentage=value(null);}
 assert.equal(Number(input.total.decimalText),Number(input.periods[1].cumulativeAmount.decimalText));
 const actual=normalizeDocumentCurve(input);assert.equal(actual.coherence.status,'INCONSISTENT');assert.equal(actual.coherence.checks.find(c=>c.kind==='MONTHLY_TOTAL').status,'MISMATCH');
 const source=readFileSync(new URL('../src/lib/plan-import-document-curve.mjs',import.meta.url),'utf8'),needle='return x===y;';assert.equal(source.split(needle).length,2);
 const mutant=await import('data:text/javascript;base64,'+Buffer.from(source.replace(needle,'return Number(x)===Number(y);')).toString('base64'));
 assert.equal(mutant.normalizeDocumentCurve(input).coherence.status,'INCOMPLETE','Removing exact integer equality masks the discrepancy');
});
test('missing data and printed zero remain distinct without interpolation or null arithmetic',()=>{
 const input=base();input.initialCumulative=value(null);input.periods[0].monthlyPercentage=value('0.00',{rawText:'0,00%'});
 const result=normalizeDocumentCurve(input);assert.equal(result.initialCumulative.decimalText,null);assert.equal(result.periods[0].monthlyPercentage.decimalText,'0.00');assert.equal(result.coherence.checks.find(c=>c.kind==='MONTHLY_TOTAL').status,'INCOMPLETE');
 input.periods.forEach(p=>['monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage'].forEach(k=>{p[k]=value(null);}));
 const missing=normalizeDocumentCurve(input);assert.equal(hasDocumentCurveSeriesValue(missing),false);assert.equal(missing.total.decimalText,'100.00');
 input.periods[0].monthlyAmount=value('0');assert.equal(hasDocumentCurveSeriesValue(normalizeDocumentCurve(input)),true);
});
test('exact coherence preserves inconsistencies and rejects a substituted client coherence record',()=>{
 const input=base();input.periods[1].cumulativeAmount=value('99.99');const result=normalizeDocumentCurve(input);assert.equal(result.coherence.status,'INCONSISTENT');assert.equal(result.periods[1].cumulativeAmount.rawText,'99.99');
 assert.equal(normalizeDocumentCurveDecision({...decision(),curve:result}).curve.coherence.status,'INCONSISTENT','Review is permitted; application is a separate store decision');
 assert.throws(()=>normalizeDocumentCurve({...result,coherence:documentCurveFixture().coherence}),{code:'PLAN_IMPORT_DOCUMENT_CURVE_INVALID'});
 assert.throws(()=>normalizeDocumentCurve({...result,coherence:{...result.coherence,accepted:true}}),{code:'PLAN_IMPORT_DOCUMENT_CURVE_INVALID'});
});
test('numeric domains bound precision, scaling, evidence and unknown keys without coercion',()=>{
 for(const bad of ['NaN','Infinity','-1','1e101','1e-101','1'.repeat(129),1,true,' 1 ']){const input=base();input.total.decimalText=bad;assert.throws(()=>normalizeDocumentCurve(input),{code:'PLAN_IMPORT_DOCUMENT_CURVE_INVALID'});}
 const maximum=base();maximum.total=value('1e100');assert.equal(normalizeDocumentCurve(maximum).total.decimalText,'1e100');
 for(const change of [c=>{c.total.decimalText='1';c.total.rawText=null;},c=>{c.total.evidence=[];},c=>{c.periods[0].monthlyPercentage.decimalText='1.00001';},c=>{c.total.evidence[0].bbox=[0,0,0,1];},c=>{c.total.evidence[0].bbox=[0,0,Infinity,1];},c=>{c.total.evidence[0].page=0;},c=>{c.total.evidence[0].page=1001;},c=>{c.total.uncertainty='\n';},c=>{c.total.rawText='<html>';},c=>{c.total.grant=true;},c=>{c.tasks=[];},c=>{c.sourceSha256='c'.repeat(64);},c=>{c.periods[1].ordinal=1;}]){const input=base();change(input);assert.throws(()=>normalizeDocumentCurve(input,{sourceSha256:sha}),{code:'PLAN_IMPORT_DOCUMENT_CURVE_INVALID'});}
});
test('a document locale is a reviewed proposal, not a guessed separator or currency',()=>{
 const input=base();input.total=value('1234.50',{rawText:'1.234,50',uncertainty:'Interpretación propuesta para comparación humana.'});const result=normalizeDocumentCurve(input);
 assert.equal(result.total.rawText,'1.234,50');assert.equal(result.total.decimalText,'1234.50');assert.equal(result.total.uncertainty,input.total.uncertainty);
 input.total=value(null,{rawText:'1,234',uncertainty:'Separador ambiguo en la fuente sintética.'});assert.equal(normalizeDocumentCurve(input).total.decimalText,null);
 input.currency={code:null,rawText:'$',evidence:evidence('$'),uncertainty:'El símbolo no distingue la moneda.'};assert.equal(normalizeDocumentCurve(input).currency.code,null);
 input.currency.code='ARS';assert.throws(()=>normalizeDocumentCurve(input),{code:'PLAN_IMPORT_DOCUMENT_CURVE_INVALID'});
 input.currency.evidence=evidence('Moneda explícita ARS');assert.equal(normalizeDocumentCurve(input).currency.code,'ARS');
});
test('calendar dates require a literal source year and ordinal months never acquire dates',()=>{
 const input=base();input.periods[0].calendarEvidence=evidence('Enero sin año');assert.throws(()=>normalizeDocumentCurve(input),{code:'PLAN_IMPORT_DOCUMENT_CURVE_INVALID'});
 input.periods[0].calendarEvidence=evidence('Referencia 120261');assert.throws(()=>normalizeDocumentCurve(input),{code:'PLAN_IMPORT_DOCUMENT_CURVE_INVALID'});
 input.periods.forEach(p=>{p.calendarMonth=null;p.calendarEvidence=[];p.label='Mes '+p.ordinal;});const ordinal=normalizeDocumentCurve(input);assert.ok(ordinal.periods.every(p=>p.calendarMonth===null));assert.equal(ordinal.coherence.status,'CONSISTENT');
 input.periods[0].calendarMonth='2026-01';input.periods[0].calendarEvidence=evidence('Enero 2026');input.periods[1].calendarMonth='2026-03';input.periods[1].calendarEvidence=evidence('Marzo 2026');assert.equal(normalizeDocumentCurve(input).coherence.checks.find(c=>c.kind==='CALENDAR_SEQUENCE').status,'MISMATCH');
});
test('the complete 36-month document is retained and month37 rejects the whole proposal',()=>{
 const input=base();input.periods=Array.from({length:36},(_,i)=>({...structuredClone(input.periods[0]),ordinal:i+1,label:'Mes '+(i+1),calendarMonth:null,calendarEvidence:[],monthlyAmount:value(i===0?'100':'0'),cumulativeAmount:value('100'),monthlyPercentage:value(i===0?'1':'0'),cumulativePercentage:value('1')}));
 assert.equal(normalizeDocumentCurve(input).periods.length,36);assert.equal(normalizeDocumentCurve(input).coherence.status,'CONSISTENT');input.periods.push({...structuredClone(input.periods[0]),ordinal:37});assert.throws(()=>normalizeDocumentCurve(input),{code:'PLAN_IMPORT_DOCUMENT_CURVE_INVALID'});
});
test('provider schema has no source identity, task permission, or precomputed coherence',()=>{
 assert.deepEqual(Object.keys(documentCurveSchema.properties).sort(),['currency','initialCumulative','kind','periods','profile','total','version']);assert.equal(documentCurveSchema.additionalProperties,false);assert.equal(documentCurveSchema.properties.periods.maxItems,36);
 assert.deepEqual(documentCurveResponseSchema.required,['isMonthlyFinancialCurve','truncated','warnings','curve']);assert.equal(documentCurveResponseSchema.properties.curve.anyOf[0].type,'null');
 const raw=documentCurveProviderFixture(),bound=normalizeDocumentCurveExtraction(raw,sha);assert.equal(bound.sourceSha256,sha);assert.equal(bound.coherence.status,'CONSISTENT');assert.throws(()=>normalizeDocumentCurveExtraction({...raw,sourceSha256:sha},sha));assert.throws(()=>normalizeDocumentCurveExtraction({...raw,coherence:bound.coherence},sha));
});
test('new review and application commands cannot enter legacy task decisions or fingerprints',()=>{
 const input=decision(),normalized=normalizeDocumentCurveDecision(input);assert.equal(normalized.rows,null);assert.equal(normalized.curve.coherence.status,'CONSISTENT');
 const expected=createHash('sha256').update(JSON.stringify(['plan-document-curve-decision-v1','FINANCIAL_MONTHLY_CURVE',documentCurveCanonical(normalized)])).digest('hex');assert.equal(documentCurveDecisionDigest(input),expected);
 for(const action of ['APPLY_CURVE','REJECT'])assert.equal(normalizeDocumentCurveDecision(decision(action)).curve,null);
 for(const change of [v=>{v.rows=[];},v=>{v.actorId='forged';},v=>{v.action='APPLY';},v=>{v.expectedRevision=0;},v=>{v.curve=null;},v=>{v.reason=' ';}]){const changed=decision();change(changed);assert.throws(()=>normalizeDocumentCurveDecision(changed));}
 assert.throws(()=>normalizeDocumentCurveDecision({...decision('APPLY_CURVE'),curve:documentCurveFixture()}));assert.throws(()=>normalizePlanRows([]));assert.throws(()=>normalizePlanDecision(input));
 const documentReject=decision('REJECT'),legacy={...documentReject};delete legacy.curve;assert.equal(normalizePlanDecision(legacy).rows,null);assert.notEqual(documentCurveDecisionDigest(documentReject),planDecisionDigest(legacy),'The same UUID/context/reason does not reuse the legacy namespace');
 const reused={...input,curve:structuredClone(input.curve)};reused.curve.periods[0].monthlyAmount.rawText='25,00';assert.notEqual(documentCurveDecisionDigest(reused),documentCurveDecisionDigest(input));
});
test('upload consent and fingerprints separate task extraction from financial review',async()=>{
 assert.equal(PLAN_IMPORT_DOCUMENT_CURVE_CONSENT,DOCUMENT_CURVE_CONSENT);assert.equal(isDocumentCurveConsent('plan-document-openai-v1'),false);
 const form=new FormData(),operationId=randomUUID(),pdf=Buffer.from('%PDF-1.7\nSynthetic monthly document\n%%EOF');for(const [k,v]of Object.entries({projectId:'p-document',scope:'b'.repeat(64),operationId,consent:DOCUMENT_CURVE_CONSENT}))form.append(k,v);form.append('file',new Blob([pdf],{type:'application/pdf'}),'synthetic.pdf');
 const input=await boundedPlanMultipart(new Request('https://obrasaas.com/api/identity/plan-import',{method:'POST',body:form}));assert.equal(input.consent,DOCUMENT_CURVE_CONSENT);
 const command={...input,source:{bytes:input.source.bytes.length,contentType:input.source.contentType,sha256:input.source.sha256}},expected=createHash('sha256').update(JSON.stringify(['plan-document-curve-upload-command-v1',{action:'UPLOAD',purpose:'FINANCIAL_MONTHLY_CURVE',consent:DOCUMENT_CURVE_CONSENT,operationId,projectId:input.projectId,scope:input.scope,source:command.source}])).digest('hex');assert.equal(documentCurveUploadDigest(command),expected);
 assert.throws(()=>documentCurveUploadDigest({...command,consent:'plan-document-openai-v1'}));assert.throws(()=>documentCurveUploadDigest({...command,source:{...command.source,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}));
});
