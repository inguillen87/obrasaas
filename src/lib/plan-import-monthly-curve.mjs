// This contract preserves source caches. It does not price work, infer currency,
// assign calendar dates, or turn planned investment into executed progress.
export const PLAN_MONTHLY_CURVE_CONSENT='plan-spreadsheet-monthly-curve-v3';
export const PLAN_MONTHLY_CURVE_PROFILE='MONTHLY_RUBROS_CURVE';
const worksheet='Plan y curva Meses';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const column=index=>{let out='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;};
const cell=(col,row)=>`${worksheet}!${col}${row}`;
const sourceText=value=>typeof value==='string'&&value.trim().length>0&&value.length<=500&&!/[\u0000-\u001f\u007f<>]/.test(value);

// Compare decimal caches exactly, while retaining their original lexical form.
// Bounds keep exponents/digits from creating unbounded BigInt work.
function decimal(value) {
 if(typeof value!=='string'||value.length>128)return null;
 const match=/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[Ee]([+-]?\d{1,3}))?$/.exec(value);
 if(!match)return null;
 const exponent=Number(match[5]||0);if(Math.abs(exponent)>100)return null;
 const fraction=match[3]??match[4]??'',digits=(match[2]||'0')+fraction;
 let coefficient=BigInt(digits)*(match[1]==='-'?-1n:1n),scale=fraction.length-exponent;
 if(scale<0){coefficient*=10n**BigInt(-scale);scale=0;}
 return {coefficient,scale};
}
const nonnegative=d=>d&&d.coefficient>=0n;
const atMostOne=d=>nonnegative(d)&&d.coefficient<=10n**BigInt(d.scale);
function cache(value,address,{ratio=false,required=false}={}) {
 if(!exact(value,['sourceCell','cachedValue','hasFormula'])||value.sourceCell!==address||typeof value.hasFormula!=='boolean')return false;
 if(value.cachedValue===null)return !required&&!value.hasFormula;
 const parsed=decimal(value.cachedValue);return ratio?atMostOne(parsed):nonnegative(parsed);
}
const rowOf=value=>{const match=/^Plan y curva Meses![A-Z]{1,3}([1-9]\d{0,5})$/.exec(value||'');return match?Number(match[1]):null;};
function completeAllocation(values) {
 const decimals=values.map(v=>v.cachedValue===null?{coefficient:0n,scale:0}:decimal(v.cachedValue));
 if(decimals.some(v=>!v))return false;
 const scale=Math.max(8,...decimals.map(v=>v.scale)),unit=10n**BigInt(scale);
 const sum=decimals.reduce((result,v)=>result+v.coefficient*10n**BigInt(scale-v.scale),0n);
 const difference=sum>unit?sum-unit:unit-sum;
 return difference<=10n**BigInt(scale-8);
}

export function safeMonthlyCurveAnalysis(value) {
 const keys=['version','profile','worksheet','level','rowCount','detailRowsExcluded','periodOrdinals','weeklyStatus','weeklyFormulaErrors','usesCachedValues','formulasRecalculated','macrosExecuted','quantityImported','dependenciesImported','progressImported','items','curve'];
 if(!exact(value,keys)||value.version!==3||value.profile!==PLAN_MONTHLY_CURVE_PROFILE||value.worksheet!==worksheet||value.level!=='RUBRO'||!Number.isSafeInteger(value.rowCount)||value.rowCount<1||value.rowCount>50||!Number.isSafeInteger(value.detailRowsExcluded)||value.detailRowsExcluded<0||value.detailRowsExcluded>50000||!Array.isArray(value.periodOrdinals)||!value.periodOrdinals.length||value.periodOrdinals.length>16||value.periodOrdinals.some((v,i)=>v!==i+1)||!['ABSENT','FORMULA_ERRORS','NOT_SELECTED'].includes(value.weeklyStatus)||!Number.isSafeInteger(value.weeklyFormulaErrors)||value.weeklyFormulaErrors<0||value.weeklyFormulaErrors>50000||(value.weeklyStatus==='FORMULA_ERRORS')!==(value.weeklyFormulaErrors>0)||value.usesCachedValues!==true||['formulasRecalculated','macrosExecuted','quantityImported','dependenciesImported','progressImported'].some(k=>value[k]!==false)||!Array.isArray(value.items)||value.items.length!==value.rowCount)return null;
 const lastColumn=column(5+value.periodOrdinals.length);
 for(const [i,item] of value.items.entries()) {
  const row=10+i*2;
  if(!exact(item,['sourceRowId','sourceTitle','sourceRange','budget','ordinalDistribution'])||item.sourceRowId!==cell('A',row)||!sourceText(item.sourceTitle)||item.sourceRange!==`${cell('A',row)}:${lastColumn}${row+1}`||!cache(item.budget,cell('E',row),{required:true})||!Array.isArray(item.ordinalDistribution)||item.ordinalDistribution.length!==value.periodOrdinals.length||item.ordinalDistribution.some((v,p)=>!cache(v,cell(column(6+p),row+1),{ratio:true}))||!completeAllocation(item.ordinalDistribution))return null;
 }
 const curve=value.curve;
 if(!exact(curve,['kind','currency','calendarStart','total','initialCumulative','periods'])||curve.kind!=='PLANNED_MONETARY_INVESTMENT'||curve.currency!==null||curve.calendarStart!==null||!Array.isArray(curve.periods)||curve.periods.length!==value.periodOrdinals.length)return null;
 const first=curve.periods[0],totalRow=rowOf(curve.total?.sourceCell),monthlyRow=rowOf(first?.monthlyAmount?.sourceCell),cumulativeRow=rowOf(first?.cumulativeAmount?.sourceCell),percentageRow=rowOf(first?.monthlyPercentage?.sourceCell),cumulativePercentageRow=rowOf(first?.cumulativePercentage?.sourceCell);
 if(![totalRow,monthlyRow,cumulativeRow,percentageRow,cumulativePercentageRow].every(Number.isSafeInteger)||totalRow<=11+2*(value.rowCount-1)||monthlyRow<=totalRow||cumulativeRow<=monthlyRow||percentageRow<=cumulativeRow||cumulativePercentageRow<=percentageRow||!cache(curve.total,cell('E',totalRow),{required:true})||!cache(curve.initialCumulative,cell('F',cumulativeRow)))return null;
 for(const [i,period] of curve.periods.entries()) {
  const col=column(6+i);
  if(!exact(period,['ordinal','headerCell','monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage'])||period.ordinal!==i+1||period.headerCell!==cell(col,9)||!cache(period.monthlyAmount,cell(col,monthlyRow))||!cache(period.cumulativeAmount,cell(col,cumulativeRow))||!cache(period.monthlyPercentage,cell(col,percentageRow),{ratio:true})||!cache(period.cumulativePercentage,cell(col,cumulativePercentageRow),{ratio:true}))return null;
 }
 const cloneCache=v=>({...v});
 return {...value,periodOrdinals:[...value.periodOrdinals],items:value.items.map(item=>({...item,budget:cloneCache(item.budget),ordinalDistribution:item.ordinalDistribution.map(cloneCache)})),curve:{...curve,total:cloneCache(curve.total),initialCumulative:cloneCache(curve.initialCumulative),periods:curve.periods.map(period=>({...period,monthlyAmount:cloneCache(period.monthlyAmount),cumulativeAmount:cloneCache(period.cumulativeAmount),monthlyPercentage:cloneCache(period.monthlyPercentage),cumulativePercentage:cloneCache(period.cumulativePercentage)}))}};
}
