// A separate opt-in preserves the complete source investment curve. Financial
// caches never become task quantities, execution, payments or calendar dates.
export const PLAN_CYP_CURVE_CONSENT='plan-spreadsheet-cyp-curve-v4';
export const PLAN_CYP_CURVE_PROFILE='CYP_PARTIDAS_CURVE';
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
