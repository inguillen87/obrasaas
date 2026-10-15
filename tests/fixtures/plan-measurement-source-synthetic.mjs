import {cypFixtureParts,ooxmlFixtureParts,zipOoxmlFixture} from './plan-import-ooxml-synthetic.mjs';
export {zipOoxmlFixture};
const escaped=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const physicalTextCell=(address,value,attributes='')=>`<c r="${address}" t="inlineStr"${attributes}><is><t>${escaped(value)}</t></is></c>`;
export const physicalNumericCell=(address,value,{attributes='',formula=null,formulaAttributes=''}={})=>`<c r="${address}"${attributes}>${formula===null?'':`<f${formulaAttributes}>${escaped(formula)}</f>`}${value===null?'':`<v>${escaped(value)}</v>`}</c>`;
export function replacePhysicalCell(parts,sheet,address,xml){
 const pattern=new RegExp(`<c r="${address}"(?: [^>]*)?>[\\s\\S]*?</c>`);
 if(!pattern.test(parts[sheet]))throw new Error('Synthetic physical cell missing');
 parts[sheet]=parts[sheet].replace(pattern,xml);return parts;
}
// New provenance fixtures have consistent row@r. Historical fixtures remain
// byte-for-byte untouched; their intentionally minimal row markers differ.
function consistentRows(xml){return xml.replace(/<row(?: [^>]*)?>([\s\S]*?)<\/row>/g,(_,cells)=>{const rows=[...cells.matchAll(/<c r="[A-Z]+(\d+)"/g)].map(match=>match[1]);if(!rows.length||new Set(rows).size!==1)throw new Error('Synthetic mixed row');return `<row r="${rows[0]}">${cells}</row>`;});}
export function measurementCypFixtureParts({partidas=2,quantity='12.34000',unit='m²'}={}){
 const parts=cypFixtureParts({partidas,missingQuantity:false,longTitle:false});
 for(const sheet of ['xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml'])parts[sheet]=consistentRows(parts[sheet]);
 const row=/<c r="A(\d+)" t="inlineStr"><is><t>A\.1\.1\.1<\/t>/.exec(parts['xl/worksheets/sheet1.xml'])[1];
 replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','D'+row,physicalNumericCell('D'+row,quantity));
 replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','C'+row,physicalTextCell('C'+row,unit));
 return {parts,row};
}
export function measurementQuoteFixtureParts(){
 const parts=ooxmlFixtureParts({type:'xlsx',details:2});
 parts['xl/worksheets/sheet2.xml']=consistentRows(parts['xl/worksheets/sheet2.xml']);
 return {parts,row:'7'};
}
export const measurementCypFixture=options=>zipOoxmlFixture(measurementCypFixtureParts(options).parts);
export function addPhysicalStyles(parts,{formatId='164',formatCode='0.0000',xf=''}={}){
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 parts['xl/_rels/workbook.xml.rels']=parts['xl/_rels/workbook.xml.rels'].replace('</Relationships>',`<Relationship Id="rStyles" Target="styles.xml" Type="${rel}/styles"/></Relationships>`);
 parts['xl/styles.xml']=`<styleSheet xmlns="${ns}">${formatId==='164'?`<numFmts count="1"><numFmt numFmtId="164" formatCode="${escaped(formatCode)}"/></numFmts>`:''}<cellStyleXfs count="1"><xf numFmtId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="${formatId}"${xf}/></cellXfs></styleSheet>`;
 return parts;
}
export const measurementDocumentFixture=patch=>({isMeasurement:true,truncated:false,warnings:[],rows:[{code:'A.1.1.1',title:'Partida física sintética',rawQuantity:'12.3400',rawUnit:'m²',evidence:[{page:1,quote:'A.1.1.1 Partida física sintética 12.3400 m²',location:'Fila sintética1'}],uncertainty:''}],...patch});
