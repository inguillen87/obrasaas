import {normalizeDocumentCurve,DOCUMENT_CURVE_PROFILE,documentCurveCanonical} from '../../../lib/plan-import-document-curve.mjs';
import {safeCypInvestmentAnalysis,PLAN_CYP_INVESTMENT_PROFILE} from '../../../lib/plan-import-cyp-curve.mjs';

const decimalPattern=/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d{1,3}))?$/;
const fields=['monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage'];
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value,keys)=>record(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');

function decimalParts(value,shift=0){
 if(typeof value!=='string'||!value.length||value.length>128)throw new Error('SOURCE_CURVE_DECIMAL_INVALID');
 const match=decimalPattern.exec(value);if(!match)throw new Error('SOURCE_CURVE_DECIMAL_INVALID');
 const exponent=Number(match[5]??0);if(!Number.isInteger(exponent)||Math.abs(exponent)>100)throw new Error('SOURCE_CURVE_DECIMAL_INVALID');
 const integer=match[2]??'',fraction=match[3]??match[4]??'',digits=integer+fraction,point=integer.length+exponent+shift;
 const whole=(point<=0?'0':point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)).replace(/^0+(?=\d)/,'');
 const tail=point<=0?'0'.repeat(-point)+digits:point>=digits.length?'':digits.slice(point);
 return {sign:match[1],whole,fraction:tail,nonZero:/[1-9]/.test(digits)};
}

/** Formats the cached decimal text exactly; this never recomputes workbook values. */
export function formatSourceCurveDecimal(value,{percentage=false}={}){
 if(value===null)return 'Sin dato';
 const parts=decimalParts(value,percentage?2:0);
 return parts.sign+parts.whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(parts.fraction?','+parts.fraction:'')+(percentage?'%':'');
}

function decimalCell(value,{percentage=false,address,required=false}={}){
 if(!exactKeys(value,['sourceCell','cachedValue','hasFormula'])||typeof value.sourceCell!=='string'||!/^(?:Plan y curva Meses|Plan de trabajo|Curva de Inversion)![A-Z]{1,3}[1-9]\d{0,5}$/.test(value.sourceCell)||(address!==undefined&&value.sourceCell!==address)||typeof value.hasFormula!=='boolean'||(value.cachedValue===null&&(value.hasFormula||required)))throw new Error('SOURCE_CURVE_CELL_INVALID');
 if(value.cachedValue!==null){
  const parts=decimalParts(value.cachedValue);
  if(parts.sign==='-'&&parts.nonZero)throw new Error('SOURCE_CURVE_DECIMAL_INVALID');
  if(percentage&&!(parts.whole==='0'||(parts.whole==='1'&&!/[1-9]/.test(parts.fraction))))throw new Error('SOURCE_CURVE_PERCENTAGE_INVALID');
 }
 return {sourceCell:value.sourceCell,cachedValue:value.cachedValue,hasFormula:value.hasFormula};
}

/** A complete source curve only. No task subset, task progress, currency or dates are inferred. */
export function planSourceCurveView(value,{profile='MONTHLY_RUBROS_CURVE'}={}){
 if(value===null||value===undefined)return null;
 if(!exactKeys(value,['kind','currency','calendarStart','total','initialCumulative','periods'])||value.kind!=='PLANNED_MONETARY_INVESTMENT'||value.currency!==null||value.calendarStart!==null||!Array.isArray(value.periods)||!value.periods.length||value.periods.length>16)throw new Error('SOURCE_CURVE_INVALID');
 const cyp=profile==='CYP_PARTIDAS_CURVE';if(!cyp&&profile!=='MONTHLY_RUBROS_CURVE'||cyp&&value.periods.length!==12)throw new Error('SOURCE_CURVE_INVALID');
 const rowOf=cell=>Number((cyp?/^Plan de trabajo!I([1-9]\d{0,5})$/:/^Plan y curva Meses![A-Z]{1,3}([1-9]\d{0,5})$/).exec(cell?.sourceCell??'')?.[1]);
 const totalRow=rowOf(value.total),rows=cyp?[31,32,33,34]:fields.map(field=>rowOf(value.periods[0]?.[field]));
 if(![totalRow,...rows].every(Number.isSafeInteger)||(cyp?totalRow<=34:rows.some((row,index)=>row<=(index===0?totalRow:rows[index-1]))))throw new Error('SOURCE_CURVE_CELL_INVALID');
 const address=(column,row)=>`${cyp?'Curva de Inversion':'Plan y curva Meses'}!${column}${row}`;
 const total=decimalCell(value.total,{address:cyp?`Plan de trabajo!I${totalRow}`:address('E',totalRow),required:true}),initialCumulative=decimalCell(value.initialCumulative,{address:cyp?`Plan de trabajo!I${totalRow+3}`:address('F',rows[1])});
 const periods=value.periods.map((period,index)=>{
  const column=String.fromCharCode((cyp?65:71)+index);
  if(!exactKeys(period,['ordinal','headerCell',...fields])||period.ordinal!==index+1||period.headerCell!==address(column,cyp?30:9))throw new Error('SOURCE_CURVE_PERIOD_INVALID');
  const result={ordinal:period.ordinal,headerCell:period.headerCell};
  for(const [i,field] of fields.entries())result[field]=decimalCell(period[field],{percentage:field.endsWith('Percentage'),address:address(column,rows[i])});
  return result;
 });
 const points=periods.map((period,index)=>{
  const raw=period.cumulativePercentage.cachedValue;
  // Only the bounded percentage is converted for SVG coordinates. Labels retain exact decimals.
  return {ordinal:period.ordinal,x:periods.length===1?450:50+800*index/(periods.length-1),y:raw===null?null:254-220*Number(raw)};
 });
 const segments=[];let segment=[];
 for(const point of points){if(point.y===null){if(segment.length)segments.push(segment);segment=[];}else segment.push(point);}
 if(segment.length)segments.push(segment);
 return {kind:value.kind,currency:null,calendarStart:null,total,initialCumulative,periods,points,segments};
}

/** Shared by the visible month controls and the SVG month controls. */
export function sourceCurveKeyboardIndex(key,index,length){
 if(!Number.isInteger(length)||length<1||length>16||!Number.isInteger(index)||index<0||index>=length)return null;
 if(key==='ArrowRight'||key==='ArrowDown')return Math.min(index+1,length-1);
 if(key==='ArrowLeft'||key==='ArrowUp')return Math.max(index-1,0);
 if(key==='Home')return 0;
 if(key==='End')return length-1;
 return null;
}
export {DOCUMENT_CURVE_PROFILE,normalizeDocumentCurve,documentCurveCanonical};

/** Document readings have page evidence, never fabricated spreadsheet cells. */
export function planDocumentCurveView(value,{sourceSha256}={}){
 if(value===null||value===undefined)return null;
 if(!Object.hasOwn(value,'coherence'))throw new Error('DOCUMENT_CURVE_UNCONFIRMED');
 const curve=normalizeDocumentCurve(value,{sourceSha256});
 const points=curve.periods.map((period,index)=>({ordinal:period.ordinal,x:curve.periods.length===1?450:50+800*index/(curve.periods.length-1),y:period.cumulativePercentage.decimalText===null?null:254-220*Number(period.cumulativePercentage.decimalText)}));
 const segments=[];let segment=[];
 for(const point of points){if(point.y===null){if(segment.length)segments.push(segment);segment=[];}else segment.push(point);}
 if(segment.length)segments.push(segment);
 return {...curve,points,segments};
}

export function planDocumentDraftView(draft){
 if(!draft||!Object.hasOwn(draft,'documentCurve')&&!Object.hasOwn(draft,'reviewedCurve')&&!Object.hasOwn(draft,'documentReviewed'))return null;
 if(draft.financialSource!==true||!Array.isArray(draft.rows)||draft.rows.length||draft.spreadsheet!==undefined||typeof draft.documentReviewed!=='boolean'||!['application/pdf','image/png','image/jpeg','image/webp'].includes(draft.source?.contentType))throw new Error('DOCUMENT_DRAFT_UNCONFIRMED');
 if(draft.documentCurve===null&&draft.reviewedCurve===null&&draft.documentReviewed===false&&['UPLOADING','PROCESSING','FAILED','REJECTED'].includes(draft.status))return {original:null,reviewed:null,documentReviewed:false};
 const original=planDocumentCurveView(draft.documentCurve,{sourceSha256:draft.source.sha256});
 const reviewed=draft.reviewedCurve===null?null:planDocumentCurveView(draft.reviewedCurve,{sourceSha256:draft.source.sha256});
 if(!original||draft.documentReviewed&&!reviewed)throw new Error('DOCUMENT_DRAFT_UNCONFIRMED');
 return {original,reviewed,documentReviewed:draft.documentReviewed};
}

export function documentCurveKeyboardIndex(key,index,length){
 if(!Number.isInteger(length)||length<1||length>36||!Number.isInteger(index)||index<0||index>=length)return null;
 if(key==='ArrowRight'||key==='ArrowDown')return Math.min(index+1,length-1);
 if(key==='ArrowLeft'||key==='ArrowUp')return Math.max(index-1,0);
 if(key==='Home')return 0;
 if(key==='End')return length-1;
 return null;
}

/** BigInt scales only visual coordinates. Source money/ratios are never recalculated. */
export function documentCurvePlot(value,{series=null}={}){
 const view=planDocumentCurveView(value),preferred=['cumulativePercentage','cumulativeAmount','monthlyAmount','monthlyPercentage'];
 if(!view)return null;
 const available=preferred.filter(field=>view.periods.some(period=>period[field].decimalText!==null));
 if(series!==null&&!preferred.includes(series))throw new Error('DOCUMENT_CURVE_SERIES_INVALID');
 const selected=available.includes(series)?series:available[0]||'cumulativePercentage',percentage=selected.endsWith('Percentage');
 const values=view.periods.map(period=>{const raw=period[selected].decimalText;if(raw===null)return null;const parts=decimalParts(raw);return {raw,coefficient:BigInt(parts.whole+parts.fraction),scale:parts.fraction.length};});
 const scale=Math.max(0,...values.filter(Boolean).map(item=>item.scale));
 const integers=values.map(item=>item===null?null:item.coefficient*10n**BigInt(scale-item.scale));
 let maximum=percentage?10n**BigInt(scale):0n,maximumRaw=percentage?'1':'0';
 for(let i=0;i<integers.length;i++)if(integers[i]!==null&&integers[i]>maximum){maximum=integers[i];maximumRaw=values[i].raw;}
 const points=integers.map((integer,index)=>({ordinal:index+1,x:view.periods.length===1?450:50+800*index/(view.periods.length-1),y:integer===null?null:254-(maximum===0n?0:Number(integer*220000n/maximum)/1000)}));
 const segments=[];let segment=[];for(const point of points){if(point.y===null){if(segment.length)segments.push(segment);segment=[];}else segment.push(point);}if(segment.length)segments.push(segment);
 return {series:selected,available,percentage,maximumRaw,points,segments};
}

export function documentCurveReviewValue(value,sourceSha256){
 const draft={...value};delete draft.coherence;delete draft.points;delete draft.segments;
 return normalizeDocumentCurve(draft,{sourceSha256});
}

export const documentCurveValuesEqual=(left,right)=>JSON.stringify(documentCurveCanonical(left))===JSON.stringify(documentCurveCanonical(right));

export {PLAN_CYP_INVESTMENT_PROFILE};
export function planInvestmentCurveView(value,{sourceSha256}={}){
 const view=safeCypInvestmentAnalysis(value);
 if(!view||sourceSha256!==undefined&&view.sourceSha256!==sourceSha256)throw new Error('INVESTMENT_CURVE_UNCONFIRMED');
 return view;
}
export function planInvestmentDraftView(draft){
 if(draft?.spreadsheet?.version!==5&&!Object.hasOwn(draft||{},'investmentReviewed'))return null;
 if(draft.financialSource!==true||!Array.isArray(draft.rows)||draft.rows.length||typeof draft.investmentReviewed!=='boolean'||typeof draft.differenceAcknowledged!=='boolean')throw new Error('INVESTMENT_DRAFT_UNCONFIRMED');
 if(!draft.spreadsheet&&['UPLOADING','PROCESSING','FAILED','REJECTED'].includes(draft.status)&&!draft.investmentReviewed&&!draft.differenceAcknowledged)return null;
 const source={...draft.spreadsheet};delete source.reviewed;
 const curve=planInvestmentCurveView(source,{sourceSha256:draft.source?.sha256});
 if(draft.investmentReviewed&&curve.comparison.status==='DIFFERENT'&&!draft.differenceAcknowledged)throw new Error('INVESTMENT_REVIEW_UNCONFIRMED');
 return curve;
}
export function investmentWeekKeyboardIndex(key,index){
 if(!Number.isInteger(index)||index<0||index>=48)return null;
 if(key==='ArrowRight'||key==='ArrowDown')return Math.min(47,index+1);
 if(key==='ArrowLeft'||key==='ArrowUp')return Math.max(0,index-1);
 if(key==='Home')return 0;if(key==='End')return 47;return null;
}
/** Only visual coordinates are scaled; cached monetary decimals remain untouched. */
export function investmentWeeklyPlot(value){
 const curve=planInvestmentCurveView(value),values=curve.weekly.periods.map(p=>decimalParts(p.amount.cachedValue)),scale=Math.max(...values.map(v=>v.fraction.length));
 const integers=values.map(v=>BigInt(v.whole+v.fraction)*10n**BigInt(scale-v.fraction.length));
 let maximum=0n,maximumRaw='0';integers.forEach((v,i)=>{if(v>maximum){maximum=v;maximumRaw=curve.weekly.periods[i].amount.cachedValue;}});
 return {maximumRaw,points:integers.map((v,i)=>({ordinal:i+1,x:50+800*i/47,y:254-(maximum===0n?0:Number(v*220000n/maximum)/1000)}))};
}
