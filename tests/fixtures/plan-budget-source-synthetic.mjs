import {measurementCypFixtureParts,physicalTextCell,physicalNumericCell,replacePhysicalCell,zipOoxmlFixture,addPhysicalStyles} from './plan-measurement-source-synthetic.mjs';
export {physicalTextCell,physicalNumericCell,replacePhysicalCell,zipOoxmlFixture,addPhysicalStyles};
export const PLAN_SHEET_PART='xl/worksheets/sheet1.xml',BUDGET_SHEET_PART='xl/worksheets/sheet2.xml';
const escaped=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function putBudgetCell(parts,sheet,address,xml){
 const row=/[1-9]\d*$/.exec(address)[0],cell=new RegExp(`<c r="${address}"(?: [^>]*)?>[\\s\\S]*?</c>`);
 if(cell.test(parts[sheet]))return replacePhysicalCell(parts,sheet,address,xml);
 const pattern=new RegExp(`(<row r="${row}">[\\s\\S]*?)(</row>)`);
 if(pattern.test(parts[sheet]))parts[sheet]=parts[sheet].replace(pattern,(_,body,close)=>body+xml+close);
 else parts[sheet]=parts[sheet].replace('</sheetData>',`<row r="${row}">${xml}</row></sheetData>`);
 return parts;
}
export function budgetSourceFixtureParts({partidas=2,quantity='17.25000',unit='m2 ',unitPrice='999.0000',amounts=['2.5000','3.7500'],monthBase='Mes base sintético 2023',priceBasis='$ Referencia sintética 2023'}={}){
 const {parts}=measurementCypFixtureParts({partidas,quantity,unit}),budgetCodes=new Map([...parts[BUDGET_SHEET_PART].matchAll(/<c r="B(\d+)" t="inlineStr"><is><t>([^<]+)<\/t><\/is><\/c>/g)].map(match=>[match[2],match[1]])),planCodes=[...parts[PLAN_SHEET_PART].matchAll(/<c r="A(\d+)" t="inlineStr"><is><t>([^<]+)<\/t><\/is><\/c>/g)],rows=[];
 for(const match of planCodes){const planRow=match[1],code=match[2],budgetRow=budgetCodes.get(code);
  putBudgetCell(parts,PLAN_SHEET_PART,'A'+planRow,physicalNumericCell('A'+planRow,code,{attributes:' t="str"',formula:`'CyP Integral completo'!B${budgetRow}`}));
  if(!/^[AB]\.1\.\d+\.\d+$/.test(code))continue;
  const amount=amounts[rows.length%amounts.length];
  for(const [column,xml]of [['D',physicalTextCell('D'+budgetRow,unit)],['E',physicalNumericCell('E'+budgetRow,quantity)],['H',physicalNumericCell('H'+budgetRow,unitPrice,{formula:'G'+budgetRow+'*$G$6'})],['K',physicalNumericCell('K'+budgetRow,amount,{formula:'E'+budgetRow+'*H'+budgetRow})]])putBudgetCell(parts,BUDGET_SHEET_PART,column+budgetRow,xml);
  putBudgetCell(parts,PLAN_SHEET_PART,'C'+planRow,physicalTextCell('C'+planRow,unit));
  for(const [column,sourceColumn,value]of [['D','E',quantity],['E','H',unitPrice],['F','K',amount]])putBudgetCell(parts,PLAN_SHEET_PART,column+planRow,physicalNumericCell(column+planRow,value,{formula:`'CyP Integral completo'!${sourceColumn}${budgetRow}`}));
  rows.push({code,planRow,budgetRow,quantity,unitPrice,amount});
 }
 putBudgetCell(parts,BUDGET_SHEET_PART,'N1',physicalTextCell('N1',monthBase));putBudgetCell(parts,BUDGET_SHEET_PART,'G5',physicalTextCell('G5',priceBasis));putBudgetCell(parts,BUDGET_SHEET_PART,'G6',physicalNumericCell('G6','1.0000'));
 putBudgetCell(parts,BUDGET_SHEET_PART,'O'+budgetCodes.get('A'),physicalNumericCell('O'+budgetCodes.get('A'),'1000.00',{formula:'SUM(K1:K2)'}));
 for(const [code,value]of [['H','5.00'],['I','2.00']])putBudgetCell(parts,BUDGET_SHEET_PART,'L'+budgetCodes.get(code),physicalNumericCell('L'+budgetCodes.get(code),value,{formula:'0+0'}));
 putBudgetCell(parts,BUDGET_SHEET_PART,'C300',physicalTextCell('C300','Total de control sintético'));putBudgetCell(parts,BUDGET_SHEET_PART,'O300',physicalNumericCell('O300','9999.00',{formula:'SUM(L1:O299)'}));
 return{parts,rows,budgetCodes};
}
export function relocateBudgetFixtureRow(parts,sheet,oldRow,newRow){
 const pattern=new RegExp(`<row r="${oldRow}">([\\s\\S]*?)</row>`);if(!pattern.test(parts[sheet]))throw new Error('Synthetic row missing');
 parts[sheet]=parts[sheet].replace(pattern,(_,cells)=>`<row r="${newRow}">${cells.replace(new RegExp(`r="([A-Z]+)${oldRow}"`,'g'),`r="$1${newRow}"`)}</row>`);return parts;
}
export function sharedPlanReference(parts,rows,{column='E',targetColumn='H',si='19',absolute=false}={}){
 const first=rows[0],last=rows.at(-1),ref=`${column}${first.planRow}:${column}${last.planRow}`;
 for(const [index,row]of rows.entries())putBudgetCell(parts,PLAN_SHEET_PART,column+row.planRow,physicalNumericCell(column+row.planRow,column==='E'?row.unitPrice:row.quantity,{formula:index===0?`'CyP Integral completo'!${absolute?'$':''}${targetColumn}${absolute?'$':''}${first.budgetRow}`:'',formulaAttributes:` t="shared" si="${escaped(si)}"${index===0?` ref="${ref}"`:''}`}));
 return parts;
}
