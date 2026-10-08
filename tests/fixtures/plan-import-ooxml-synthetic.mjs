import {crc32,deflateRawSync} from 'node:zlib';

// Generated in memory; no customer workbook, nominal title or macro is used.
export function zipOoxmlFixture(parts) {
 const entries=Array.isArray(parts)?parts:Object.entries(parts),local=[],central=[];let offset=0;
 for(const [name,input] of entries) {
  const options=input&&typeof input==='object'&&!Buffer.isBuffer(input)?input:{data:input},data=Buffer.from(options.data),fileName=Buffer.from(name),compressed=deflateRawSync(data),checksum=crc32(data);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(8,8);header.writeUInt32LE(checksum,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(fileName.length,26);
  local.push(header,fileName,compressed);const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(options.encrypted?1:0,8);directory.writeUInt16LE(8,10);directory.writeUInt32LE(options.badCRC?checksum^1:checksum,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(options.declaredSize??data.length,24);directory.writeUInt16LE(fileName.length,28);directory.writeUInt32LE(offset,42);central.push(directory,fileName);offset+=header.length+fileName.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
const escaped=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const s=(address,value)=>`<c r="${address}" t="inlineStr"><is><t>${escaped(value)}</t></is></c>`;
const n=(address,value)=>`<c r="${address}"><v>${value}</v></c>`;
const sheet=rows=>`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((cells,i)=>`<row r="${i+1}">${cells}</row>`).join('')}</sheetData></worksheet>`;
export function ooxmlFixtureParts({rubros=2,details=4,type='xlsm',weeklyErrors=true,allocations=[1,0,0]}={}) {
 const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships',pkg='http://schemas.openxmlformats.org/package/2006/relationships';
 const monthly=[s('A8','RUBRO')+s('B8','DESCRIPCIÓN')+s('E8','TOTAL')+s('F8','MES'),n('F9',0)+n('G9',1)+n('H9',2)+n('I9',3)];
 for(let i=0;i<rubros;i++){const r=10+i*2;monthly.push(n('A'+r,i+1)+s('B'+r,'Rubro sintético '+(i+1))+n('E'+r,100+i),allocations.map((v,j)=>v===null?'':n('GHI'[j]+(r+1),v)).join(''));}
 const quote=[s('D5','Designación')+s('E5','Unidad')+s('F5','Cantidad')];for(let i=0;i<details;i++){const r=7+i;quote.push(s('C'+r,'1.'+(i+1))+s('D'+r,'Partida sintética '+(i+1))+s('E'+r,'un.')+n('F'+r,1));}quote.push(s('D'+(7+details),'TOTAL OBRA'));
 const names=['Plan y curva Meses','Cotización','Plan y curva Semanas'];
 return {
  '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="${type==='xlsm'?'application/vnd.ms-excel.sheet.macroEnabled.main+xml':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'}"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  '_rels/.rels':`<Relationships xmlns="${pkg}"><Relationship Id="rMain" Target="xl/workbook.xml" Type="${rel}/officeDocument"/></Relationships>`,
  'xl/workbook.xml':`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${rel}"><sheets>${names.map((name,i)=>`<sheet name="${name}" sheetId="${i+1}" r:id="r${i+1}"/>`).join('')}</sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${pkg}">${names.map((_,i)=>`<Relationship Id="r${i+1}" Target="worksheets/sheet${i+1}.xml" Type="${rel}/worksheet"/>`).join('')}</Relationships>`,
  'xl/worksheets/sheet1.xml':sheet(monthly),
  'xl/worksheets/sheet2.xml':sheet(quote),
  'xl/worksheets/sheet3.xml':sheet([weeklyErrors?'<c r="B12" t="e"><f>+Cotización!#REF!</f><v>#REF!</v></c>':s('A8','RUBRO')]),
  ...(type==='xlsm'?{'xl/vbaProject.bin':Buffer.from('Synthetic inert macro bytes; never executed')}:{})
 };
}
export const ooxmlFixture=options=>zipOoxmlFixture(ooxmlFixtureParts(options));

export function cypFixtureParts({partidas=190,missingQuantity=true,longTitle=true}={}) {
 const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships',pkg='http://schemas.openxmlformats.org/package/2006/relationships';
 const col=index=>{let result='';for(let v=index+1;v>0;v=Math.floor((v-1)/26))result=String.fromCharCode(65+(v-1)%26)+result;return result;};
 const plan=[s('C5','U.')+s('D5','Cant.')+s('E5','$ Unitario')+s('F5','$ Subítem')+Array.from({length:12},(_,i)=>s(col(9+i*4)+'5','MES '+(i+1))).join(''),Array.from({length:48},(_,i)=>n(col(9+i)+'6',i%4+1)).join('')],budget=[];
 const entry=(code,title,leaf=false,index=0)=>{const r=plan.length+5,q=budget.length+6;plan.push(s('A'+r,code)+s('B'+r,title)+(leaf?s('C'+r,'un.')+(!(missingQuantity&&index===0)?n('D'+r,1):'')+Array.from({length:48},(_,i)=>i===0?'':n(col(9+i)+r,i===1?0.5:i===2?0.5:0)).join(''):''));budget.push(s('B'+q,code)+s('C'+q,title));};
 let count=0;for(const root of ['A','B']){entry(root,'Grupo sintético '+root);entry(root+'.1','Alcance sintético '+root);for(let group=1;group<=11;group++){const parent=root+'.1.'+group;entry(parent,'Rubro sintético '+parent);const groupIndex=(root==='A'?0:11)+group-1,quantity=Math.floor(partidas/22)+(groupIndex<partidas%22?1:0);for(let leaf=1;leaf<=quantity;leaf++){const code=parent+'.'+leaf,title=longTitle&&count===1?'Descripción sintética extensa '.repeat(9).trim():'Partida sintética '+code;entry(code,title,true,count++);}}}
 entry('H','Grupo de costos sintético H');for(let i=1;i<=4;i++)entry('H.'+i,'Concepto de costo sintético H.'+i);
 entry('I','Grupo de costos sintético I');for(let i=1;i<=3;i++)entry('I.'+i,'Concepto de costo sintético I.'+i);
 const names=['Plan de trabajo','CyP Integral completo','Plan de trabajo (Avance físico)','Curva de Inversion','Copia oculta'],parts={
  '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  '_rels/.rels':`<Relationships xmlns="${pkg}"><Relationship Id="rMain" Target="xl/workbook.xml" Type="${rel}/officeDocument"/></Relationships>`,
  'xl/workbook.xml':`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${rel}"><sheets>${names.map((name,i)=>`<sheet name="${name}" sheetId="${i+1}" r:id="r${i+1}" ${i===4?'state="hidden"':''}/>`).join('')}</sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${pkg}">${names.map((_,i)=>`<Relationship Id="r${i+1}" Target="worksheets/sheet${i+1}.xml" Type="${rel}/worksheet"/>`).join('')}<Relationship Id="rExternal" Target="externalLinks/externalLink1.xml" Type="${rel}/externalLink"/></Relationships>`,
  'xl/worksheets/sheet1.xml':sheet(plan),'xl/worksheets/sheet2.xml':sheet(budget),
  'xl/worksheets/sheet3.xml':sheet([s('A7','A.1.1.1')+s('B7','Duplicate physical view; never a second task')]),
  'xl/worksheets/sheet4.xml':sheet([s('A1','Planned monetary curve; never progress')]),
  'xl/worksheets/sheet5.xml':'<!DOCTYPE worksheet [<!ENTITY unsafe SYSTEM "https://example.invalid">]><invalid/>',
  'xl/externalLinks/externalLink1.xml':'<externalLink/>',
  'xl/externalLinks/_rels/externalLink1.xml.rels':`<Relationships xmlns="${pkg}"><Relationship Id="rRemote" Target="https://example.invalid/private.xlsx" TargetMode="External" Type="${rel}/externalLinkPath"/></Relationships>`
 };return parts;
}
export const cypFixture=options=>zipOoxmlFixture(cypFixtureParts(options));
