import {ooxmlFixtureParts,zipOoxmlFixture} from './plan-import-ooxml-synthetic.mjs';
const escaped=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const label=(address,value)=>`<c r="${address}" t="inlineStr"><is><t>${escaped(value)}</t></is></c>`;
const cached=(address,value)=>value===null?'':`<c r="${address}"><v>${escaped(value)}</v></c>`;

// New synthetic profile only. The historical v1/v2 fixtures remain unchanged.
export function monthlyCurveFixtureParts(options={}) {
 const {rubros=2,curveTotal=String(rubros*100+rubros*(rubros-1)/2),monthlyAmounts=[curveTotal,'0','0'],cumulativeAmounts=[curveTotal,curveTotal,curveTotal],monthlyPercentages=['1.000','0','0'],cumulativePercentages=['1','1','1'],initialCumulative='0.00'}=options;
 const parts=ooxmlFixtureParts(options),totalRow=11+2*(rubros-1)+2;
 const footer=(row,text,values)=>`<row r="${row}">${label('B'+row,text)}${values}</row>`;
 const series=(row,values)=>values.map((value,i)=>cached('GHI'[i]+row,value)).join('');
 const footers=[
  footer(totalRow,'TOTAL',cached('E'+totalRow,curveTotal)),
  footer(totalRow+3,'IMPORTE TOTAL MENSUAL',series(totalRow+3,monthlyAmounts)),
  footer(totalRow+5,'IMPORTE TOTAL ACUMULADO',cached('F'+(totalRow+5),initialCumulative)+series(totalRow+5,cumulativeAmounts)),
  footer(totalRow+7,'PORCENTAJE MENSUAL',series(totalRow+7,monthlyPercentages)),
  footer(totalRow+9,'PORCENTAJE ACUMULADO',series(totalRow+9,cumulativePercentages))
 ].join('');
 parts['xl/worksheets/sheet1.xml']=parts['xl/worksheets/sheet1.xml'].replace('</sheetData>',footers+'</sheetData>');
 return parts;
}
export const monthlyCurveFixture=options=>zipOoxmlFixture(monthlyCurveFixtureParts(options));
