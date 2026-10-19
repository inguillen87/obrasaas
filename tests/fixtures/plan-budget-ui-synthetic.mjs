import {createHash} from 'node:crypto';
import {budgetSourceFixtureParts,putBudgetCell,physicalNumericCell,zipOoxmlFixture,PLAN_SHEET_PART} from './plan-budget-source-synthetic.mjs';
export function planBudgetUiSyntheticFixture(){
 const workbook=budgetSourceFixtureParts({partidas:190}),conflict=workbook.rows.find(row=>row.planRow==='72');
 if(!conflict)throw Error('The synthetic budget must include Plan D72');
 putBudgetCell(workbook.parts,PLAN_SHEET_PART,'D72',physicalNumericCell('D72','',{formula:"'CyP Integral completo'!M76"}));
 const bytes=zipOoxmlFixture(workbook.parts);
 return {bytes,sha256:createHash('sha256').update(bytes).digest('hex'),conflictCode:conflict.code,rows:workbook.rows.map(row=>({...row,unit:'m2 ',sourceRowId:'CyP Integral completo!B'+row.budgetRow+':K'+row.budgetRow,physicalSourceRowId:'Plan de trabajo!A'+row.planRow+':D'+row.planRow,sourceRange:'Plan de trabajo!A'+row.planRow+':BE'+row.planRow})),monthBase:'Mes base sintético 2023',priceBasis:'$ Referencia sintética 2023'};
}
