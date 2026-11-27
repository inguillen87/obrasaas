import {PLAN_BUDGET_CSV_HEADERS} from '../../src/lib/plan-budget-csv-source.mjs';

// Entirely synthetic. No customer document, amount, title or row is a fixture.
export const csvLiteral=value=>'"'+String(value).replaceAll('"','""')+'"';
export function syntheticBudgetCsv({rows=null,count=3,ending='\n',bom=false}={}){
 const records=rows||Array.from({length:count},(_,i)=>[String(1+Math.floor(i/40)),String(1+Math.floor(i/4))+'.'+String(i%4+1),'Synthetic budget item '+(i+1),'un.','0,0000','999999999999999999999,000000','0,00']);
 return Buffer.from((bom?'\ufeff':'')+[PLAN_BUDGET_CSV_HEADERS.join(','),...records.map(row=>row.map(csvLiteral).join(','))].join(ending)+ending,'utf8');
}
