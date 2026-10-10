import {cypFixtureParts,zipOoxmlFixture} from './plan-import-ooxml-synthetic.mjs';

// Fully synthetic caches. The fixture models coordinates and internal references,
// never customer amounts, nominal descriptions, identities or executable macros.
const text=(address,value)=>`<c r="${address}" t="inlineStr"><is><t>${value}</t></is></c>`;
const cache=(address,value,formula)=>`<c r="${address}">${formula?`<f>${formula}</f>`:''}${value===null?'':`<v>${value}</v>`}</c>`;
const stringFormula=(address,value,formula)=>`<c r="${address}" t="str"><f>${formula}</f><v>${value}</v></c>`;
const add=(xml,cells)=>xml.replace('</sheetData>',`<row>${cells}</row></sheetData>`);
const column=index=>{let result='';for(let v=index+1;v>0;v=Math.floor((v-1)/26))result=String.fromCharCode(65+(v-1)%26)+result;return result;};
export function cypCurveFixtureParts({partidas=190,initial=null,...physical}={}){
 const parts=cypFixtureParts({partidas,...physical});
 const last=(xml,col)=>Math.max(...[...xml.matchAll(new RegExp(`<c r="${col}(\\d+)"`,'g'))].map(match=>Number(match[1])));
 const totalRow=last(parts['xl/worksheets/sheet1.xml'],'A')+2,budgetTotal=last(parts['xl/worksheets/sheet2.xml'],'B')+2;
 const total='12345678901234567890.1234500';
 let footer=stringFormula(`B${totalRow}`,'TOTAL PRESUPUESTO',`'CyP Integral completo'!C${budgetTotal}`)+cache(`H${totalRow}`,'9.9900',`'CyP Integral completo'!M${budgetTotal}`)+cache(`I${totalRow}`,total,`'CyP Integral completo'!O${budgetTotal}`)+cache(`I${totalRow+3}`,initial);
 const labels=['Certificado semanal ($)','Certificacion Mensual ($)','Certificacion Acumulada ($)','Certificacion Mensual(%)','Certificacion Acumulada (%)'];
 footer+=labels.map((label,i)=>text(`D${totalRow+1+i}`,label)).join('');
 const curve=[];
 for(let i=0;i<12;i++){
  const c=String.fromCharCode(65+i),p=column(9+i*4),amount=i===0?'12345678901234567890.1234500':'0.0000',monthly=i===0?'0.125000':i===11?'0.875000':'0.000000',cumulative=i===11?'1.000000':'0.125000';
  curve.push(text(`${c}30`,`MES ${i+1}`));
  const values=[amount,total,monthly,cumulative];
  for(let f=0;f<4;f++)curve.push(cache(`${c}${31+f}`,values[f],`+'Plan de trabajo'!${p}${totalRow+2+f}`));
  footer+=cache(`${p}${totalRow+2}`,amount,`${p}${totalRow+1}`)+cache(`${p}${totalRow+3}`,total,`${p}${totalRow+2}`)+cache(`${p}${totalRow+4}`,monthly,`+${p}${totalRow+2}/$I$${totalRow}`)+cache(`${p}${totalRow+5}`,cumulative,`+${p}${totalRow+4}`);
 }
 parts['xl/worksheets/sheet1.xml']=add(parts['xl/worksheets/sheet1.xml'],footer);
 parts['xl/worksheets/sheet2.xml']=add(parts['xl/worksheets/sheet2.xml'],text(`C${budgetTotal}`,'TOTAL PRESUPUESTO')+cache(`M${budgetTotal}`,'9.9900','SUM(M6:M7)')+cache(`O${budgetTotal}`,total,'SUM(O6:O7)'));
 parts['xl/worksheets/sheet4.xml']=add(parts['xl/worksheets/sheet4.xml'],curve.join(''));
 return parts;
}
export const cypCurveFixture=options=>zipOoxmlFixture(cypCurveFixtureParts(options));
