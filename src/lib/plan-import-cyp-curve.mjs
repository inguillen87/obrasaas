// A separate opt-in preserves the complete source investment curve. Financial
// caches never become task quantities, execution, payments or calendar dates.
export const PLAN_CYP_CURVE_CONSENT='plan-spreadsheet-cyp-curve-v4';
export const PLAN_CYP_CURVE_PROFILE='CYP_PARTIDAS_CURVE';
export const PLAN_CYP_INVESTMENT_CONSENT='plan-spreadsheet-cyp-investment-curves-v1';
export const PLAN_CYP_INVESTMENT_PROFILE='CYP_INVESTMENT_CURVES_V1';
export const PLAN_CYP_INVESTMENT_PURPOSE='FINANCIAL_CYP_INVESTMENT_CURVES';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
function decimal(value){
 if(typeof value!=='string'||value.length>128)return null;
 const match=/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[Ee]([+-]?\d{1,3}))?$/.exec(value);
 if(!match)return null;const exponent=Number(match[5]||0);if(Math.abs(exponent)>100)return null;
 const fraction=match[3]??match[4]??'',digits=(match[2]||'0')+fraction;
 let coefficient=BigInt(digits)*(match[1]==='-'?-1n:1n),scale=fraction.length-exponent;
 if(scale<0){coefficient*=10n**BigInt(-scale);scale=0;}
 return {coefficient,scale};
}
export function safeCypCurveCache(value,address,{ratio=false,required=false}={}){
 if(!exact(value,['sourceCell','cachedValue','hasFormula'])||value.sourceCell!==address||typeof value.hasFormula!=='boolean')return false;
 if(value.cachedValue===null)return !required&&!value.hasFormula;
 const d=decimal(value.cachedValue);return Boolean(d&&d.coefficient>=0n&&(!ratio||d.coefficient<=10n**BigInt(d.scale)));
}
export function safeCypCurveAnalysis(value,validatePhysical){
 if(!value||value.version!==4||value.profile!==PLAN_CYP_CURVE_PROFILE||typeof validatePhysical!=='function')return null;
 const {curve,...physical}=value,base=validatePhysical({...physical,version:2,profile:'CYP_PARTIDAS'});
 if(!base||!exact(curve,['kind','currency','calendarStart','total','initialCumulative','periods'])||curve.kind!=='PLANNED_MONETARY_INVESTMENT'||curve.currency!==null||curve.calendarStart!==null||!Array.isArray(curve.periods)||curve.periods.length!==12)return null;
 const totalMatch=/^Plan de trabajo!I([1-9]\d{0,5})$/.exec(curve.total?.sourceCell||''),totalRow=totalMatch?Number(totalMatch[1]):null;
 const lastPhysicalRow=Math.max(...[...base.groups,...base.items].map(item=>Number(/^Plan de trabajo!A([1-9]\d{0,5}):/.exec(item.sourceRange)?.[1])));
 if(!Number.isSafeInteger(totalRow)||totalRow<=lastPhysicalRow||!safeCypCurveCache(curve.total,`Plan de trabajo!I${totalRow}`,{required:true})||!safeCypCurveCache(curve.initialCumulative,`Plan de trabajo!I${totalRow+3}`))return null;
 for(const [i,period] of curve.periods.entries()){
  const col=String.fromCharCode(65+i);
  if(!exact(period,['ordinal','headerCell','monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage'])||period.ordinal!==i+1||period.headerCell!==`Curva de Inversion!${col}30`||!safeCypCurveCache(period.monthlyAmount,`Curva de Inversion!${col}31`)||!safeCypCurveCache(period.cumulativeAmount,`Curva de Inversion!${col}32`)||!safeCypCurveCache(period.monthlyPercentage,`Curva de Inversion!${col}33`,{ratio:true})||!safeCypCurveCache(period.cumulativePercentage,`Curva de Inversion!${col}34`,{ratio:true}))return null;
 }
 const copy=v=>({...v});
 return {...base,version:4,profile:PLAN_CYP_CURVE_PROFILE,curve:{...curve,total:copy(curve.total),initialCumulative:copy(curve.initialCumulative),periods:curve.periods.map(period=>({...period,monthlyAmount:copy(period.monthlyAmount),cumulativeAmount:copy(period.cumulativeAmount),monthlyPercentage:copy(period.monthlyPercentage),cumulativePercentage:copy(period.cumulativePercentage)}))}};
}

const investmentColumn=index=>{let result='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;};
const nonnegative=value=>Boolean(value&&value.coefficient>=0n);
const decimalText=({coefficient,scale})=>{
 const sign=coefficient<0n?'-':'',digits=(coefficient<0n?-coefficient:coefficient).toString();
 if(!scale)return sign+digits;const padded=digits.padStart(scale+1,'0');return sign+padded.slice(0,-scale)+'.'+padded.slice(-scale);
};
// A comparison of the stored decimal caches, not a workbook recalculation or a
// tolerance policy. It never repairs the budget or the weekly source amounts.
export function cypInvestmentComparison(weekly){
 if(!Array.isArray(weekly?.periods)||weekly.periods.length!==48)return null;
 const total=decimal(weekly.total?.cachedValue),amounts=Array.from(weekly.periods,period=>decimal(period?.amount?.cachedValue));
 if(!nonnegative(total)||amounts.some(value=>!nonnegative(value)))return null;
 const scale=Math.max(total.scale,...amounts.map(value=>value.scale)),align=value=>value.coefficient*10n**BigInt(scale-value.scale);
 const sum=amounts.reduce((result,value)=>result+align(value),0n),difference=sum-align(total);
 return {status:difference===0n?'MATCH':'DIFFERENT',weeklySumDecimalText:decimalText({coefficient:sum,scale}),totalDecimalText:decimalText(total),differenceDecimalText:decimalText({coefficient:difference,scale})};
}
// Financial-only v5 deliberately does not borrow the Task-creating v4 decoder.
// The monthly object retains the v4 curve shape and its exact cache lexemes.
export function safeCypInvestmentAnalysis(value){
 if(!exact(value,['version','profile','sourceSha256','kind','monthly','weekly','comparison'])||value.version!==5||value.profile!==PLAN_CYP_INVESTMENT_PROFILE||value.kind!=='PLANNED_MONETARY_INVESTMENT'||typeof value.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sourceSha256))return null;
 const m=value.monthly,w=value.weekly,fields=['monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage'];
 if(!exact(m,['kind','currency','calendarStart','total','initialCumulative','periods'])||m.kind!==value.kind||m.currency!==null||m.calendarStart!==null||!Array.isArray(m.periods)||m.periods.length!==12)return null;
 const match=/^Plan de trabajo!I([1-9]\d{0,5})$/.exec(m.total?.sourceCell||''),totalRow=match?Number(match[1]):null;
 if(!Number.isSafeInteger(totalRow)||totalRow<8||totalRow>999994||!safeCypCurveCache(m.total,`Plan de trabajo!I${totalRow}`,{required:true})||!safeCypCurveCache(m.initialCumulative,`Plan de trabajo!I${totalRow+3}`))return null;
 for(const [i,p]of m.periods.entries()){
  const c=investmentColumn(i);
  if(!exact(p,['ordinal','headerCell',...fields])||p.ordinal!==i+1||p.headerCell!==`Curva de Inversion!${c}30`||fields.some((field,j)=>!safeCypCurveCache(p[field],`Curva de Inversion!${c}${31+j}`,{ratio:j>=2})))return null;
 }
 if(!exact(w,['granularity','currency','calendarStart','total','periods'])||w.granularity!=='ORDINAL_WEEK_12X4'||w.currency!==null||w.calendarStart!==null||!Array.isArray(w.periods)||w.periods.length!==48||!safeCypCurveCache(w.total,`Plan de trabajo!I${totalRow}`,{required:true})||['sourceCell','cachedValue','hasFormula'].some(key=>w.total[key]!==m.total[key]))return null;
 for(const[i,p]of w.periods.entries()){
  if(!exact(p,['ordinal','monthOrdinal','weekInMonth','monthHeaderCell','weekHeaderCell','amount'])||p.ordinal!==i+1||p.monthOrdinal!==Math.floor(i/4)+1||p.weekInMonth!==i%4+1||p.monthHeaderCell!==`Plan de trabajo!${investmentColumn(9+Math.floor(i/4)*4)}5`||p.weekHeaderCell!==`Plan de trabajo!${investmentColumn(9+i)}6`||!safeCypCurveCache(p.amount,`Plan de trabajo!${investmentColumn(9+i)}${totalRow+1}`,{required:true})||p.amount.hasFormula!==true)return null;
 }
 const comparison=cypInvestmentComparison(w);
 if(!comparison||!exact(value.comparison,Object.keys(comparison))||Object.keys(comparison).some(key=>value.comparison[key]!==comparison[key]))return null;
 const copy=cache=>({...cache});
 return {...value,monthly:{...m,total:copy(m.total),initialCumulative:copy(m.initialCumulative),periods:m.periods.map(period=>({...period,...Object.fromEntries(fields.map(field=>[field,copy(period[field])]))}))},weekly:{...w,total:copy(w.total),periods:w.periods.map(period=>({...period,amount:copy(period.amount)}))},comparison:{...comparison}};
}
