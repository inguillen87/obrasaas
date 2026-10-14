import {normalizeDocumentCurve} from '../../src/lib/plan-import-document-curve.mjs';
export const documentCurveEvidence=quote=>[{page:1,bbox:[0.1,0.2,0.7,0.4],quote}];
export const documentCurveNumeric=(value,{rawText=value,uncertainty=value===null?'No aparece en la fuente sintética.':''}={})=>({rawText,decimalText:value,evidence:rawText===null?[]:documentCurveEvidence(rawText),uncertainty});
export function documentCurveFixture({sourceSha256='a'.repeat(64)}={}){
 return normalizeDocumentCurve({version:1,profile:'DOCUMENT_MONTHLY_CURVE_V1',kind:'PLANNED_MONETARY_INVESTMENT',sourceSha256,
  currency:{code:'ARS',rawText:'ARS',evidence:documentCurveEvidence('Moneda ARS; ejemplo sintético.'),uncertainty:''},total:documentCurveNumeric('100.00'),initialCumulative:documentCurveNumeric('0.00'),
  periods:[{ordinal:1,label:'Enero 2026',labelEvidence:documentCurveEvidence('Enero 2026'),calendarMonth:'2026-01',calendarEvidence:documentCurveEvidence('Enero 2026'),monthlyAmount:documentCurveNumeric('25.00'),cumulativeAmount:documentCurveNumeric('25.00'),monthlyPercentage:documentCurveNumeric('0.25',{rawText:'25%'}),cumulativePercentage:documentCurveNumeric('0.25',{rawText:'25%'})},
   {ordinal:2,label:'Febrero 2026',labelEvidence:documentCurveEvidence('Febrero 2026'),calendarMonth:'2026-02',calendarEvidence:documentCurveEvidence('Febrero 2026'),monthlyAmount:documentCurveNumeric('75.00'),cumulativeAmount:documentCurveNumeric('100.00'),monthlyPercentage:documentCurveNumeric('0.75',{rawText:'75%'}),cumulativePercentage:documentCurveNumeric('1.00',{rawText:'100%'})}]
 });
}
export function documentCurveProviderFixture(){const {sourceSha256,coherence,...value}=documentCurveFixture();void sourceSha256;void coherence;return value;}
