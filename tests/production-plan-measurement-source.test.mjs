import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {extractPlanMeasurementSource,normalizePlanMeasurementSource,normalizePlanMeasurementDecimal,planMeasurementSourceDigest,normalizePlanMeasurementReview,normalizePlanMeasurementDocument,isPlanMeasurementConsent,PLAN_MEASUREMENT_CONSENT,PLAN_MEASUREMENT_DOCUMENT_CONSENT,PLAN_MEASUREMENT_PROFILE,PLAN_MEASUREMENT_DOCUMENT_SCHEMA,PLAN_MEASUREMENT_DOCUMENT_INSTRUCTIONS} from '../src/lib/plan-measurement-source.mjs';
import {extractCypPlanOoxml,readPlanMeasurementOoxml} from '../src/lib/plan-import-ooxml.mjs';
import {measurementCypFixtureParts,measurementQuoteFixtureParts,measurementDocumentFixture,replacePhysicalCell,physicalNumericCell,physicalTextCell,addPhysicalStyles,zipOoxmlFixture} from './fixtures/plan-measurement-source-synthetic.mjs';
const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const sha=value=>createHash('sha256').update(value).digest('hex');
const cloned=value=>JSON.parse(JSON.stringify(value));
const documentOptions={sourceSha256:'a'.repeat(64),contentType:'application/pdf'};
const extraction=async(options={})=>{const fixture=measurementCypFixtureParts(options),bytes=zipOoxmlFixture(fixture.parts);return {...fixture,bytes,source:await extractPlanMeasurementSource(bytes,mime,{sourceSha256:sha(bytes)})};};
const reviewRow=(source,patch={})=>({sourceRowId:source.rows[0].sourceRowId,baseline:source.rows[0].candidate.baseline||'12.3400',unit:source.rows[0].candidate.unit||'M2',reason:'Comparé la cantidad y unidad con la fuente sintética.',confirmed:true,issuesAcknowledged:true,...patch});
const sourceError=error=>error?.code==='PLAN_IMPORT_MEASUREMENT_SOURCE_INVALID';

test('source decimals expand exactly within canonical physical limits, preserving no float path',()=>{
 const accepted={'12.34000':'12.3400','1.2300000000':'1.2300','1e2':'100.0000','1234e-3':'1.2340','.0001':'0.0001','+001.20':'1.2000','10000e-8':'0.0001','99999999999999.9999':'99999999999999.9999','999999999999999999e-4':'99999999999999.9999'};
 for(const [raw,expected] of Object.entries(accepted))assert.equal(normalizePlanMeasurementDecimal(raw),expected,raw);
 for(const raw of ['0','0.00000','-1','-0','1.23456','1e-5','1e101','1e-101','100000000000000','1,25','1,000.25','1 000','1%','$12','NaN','Infinity',' 12','12 ',12,null,'1e+999','1'.repeat(129)])assert.equal(normalizePlanMeasurementDecimal(raw),null,String(raw));
});
test('separate format-aware consent never reinterprets legacy approval or financial consent',()=>{
 assert.equal(isPlanMeasurementConsent(PLAN_MEASUREMENT_CONSENT,mime),true);
 assert.equal(isPlanMeasurementConsent(PLAN_MEASUREMENT_DOCUMENT_CONSENT,'image/png'),true);
 for(const [consent,type] of [[PLAN_MEASUREMENT_CONSENT,'application/pdf'],[PLAN_MEASUREMENT_DOCUMENT_CONSENT,mime],['plan-spreadsheet-cyp-partidas-v2',mime],['plan-document-openai-v1','application/pdf'],[PLAN_MEASUREMENT_DOCUMENT_CONSENT,'text/plain']])assert.equal(isPlanMeasurementConsent(consent,type),false);
});
test('local CyP source keeps physical lexical cells and exact coordinates, with explicit group/cost exclusions',async()=>{
 const {source,row,bytes}=await extraction();const first=source.rows[0];
 assert.equal(source.profile,PLAN_MEASUREMENT_PROFILE);assert.equal(source.sourceSha256,sha(bytes));assert.equal(source.rows.length,2);
 assert.equal(first.sourceRowId,`Plan de trabajo!A${row}:D${row}`);assert.equal(first.quantity.rawValue,'12.34000');assert.equal(first.quantity.value,'12.34000');assert.equal(first.quantity.type,'n');assert.equal(first.quantity.cachePresent,true);assert.equal(first.quantity.present,true);
 assert.equal(first.unit.value,'m²');assert.equal(first.unit.rawValue,null);assert.equal(first.provenance.quantityCell,'D'+row);assert.equal(first.provenance.unitCell,'C'+row);assert.equal(first.provenance.sameRow,true);
 assert.deepEqual(first.candidate,{baseline:'12.3400',unit:'M2',issues:[]});
 assert.equal(source.excludedRows.filter(row=>row.reason==='MONETARY_COST_ROW').length,9);assert.ok(source.excludedRows.some(row=>row.code==='A.1.1'));
 assert.equal(Object.hasOwn(first,'startsOn'),false);assert.equal(Object.hasOwn(first,'progress'),false);assert.equal(Object.hasOwn(source,'currency'),false);
 const snapshot=await readPlanMeasurementOoxml(bytes,mime);assert.ok(snapshot.worksheets[0].cells.every(cell=>/^[ABCD]\d+$/.test(cell.address)));
});
test('new source snapshot has no mutation of bytes or legacy v2 output and quantityImported stays false',async()=>{
 const {bytes}=await extraction({partidas:190}),beforeSha=sha(bytes),before=await extractCypPlanOoxml(bytes,mime);
 await readPlanMeasurementOoxml(bytes,mime);const after=await extractCypPlanOoxml(bytes,mime);
 assert.equal(sha(bytes),beforeSha);assert.deepEqual(after,before);assert.equal(after.spreadsheet.quantityImported,false);assert.equal(after.spreadsheet.progressImported,false);assert.equal(after.rows.length,190);
});
test('source extraction is complete at200 and denies201 without returning a partial candidate set',async()=>{
 assert.equal((await extraction({partidas:200})).source.rows.length,200);
 await assert.rejects(extraction({partidas:201}),{code:'PLAN_IMPORT_MEASUREMENT_SOURCE_TOO_LARGE',status:413});
});
test('quantity blank, zero, negative, text and excess precision remain distinct unresolved candidates',async()=>{
 const blank=await extraction({quantity:null});assert.equal(blank.source.rows[0].quantity.present,true);assert.equal(blank.source.rows[0].quantity.cachePresent,false);assert.ok(blank.source.rows[0].candidate.issues.includes('QUANTITY_MISSING'));
 for(const quantity of ['0','-1','1.23456','1,25']){const {source}=await extraction({quantity});assert.equal(source.rows[0].candidate.baseline,null);assert.ok(source.rows[0].candidate.issues.includes('QUANTITY_REQUIRES_CORRECTION'));}
 const {parts,row}=measurementCypFixtureParts();replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','D'+row,physicalTextCell('D'+row,'12.34'));
 const source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime);assert.equal(source.rows[0].candidate.baseline,null);assert.ok(source.rows[0].candidate.issues.includes('QUANTITY_TYPE_UNSUPPORTED'));
});
test('absence facts inherit row and column visibility/styles instead of manufacturing a visible cache',async()=>{
 const {parts,row}=measurementCypFixtureParts();replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','D'+row,'');
 parts['xl/worksheets/sheet1.xml']=parts['xl/worksheets/sheet1.xml'].replace(`<row r="${row}">`,`<row r="${row}" hidden="1">`).replace('<sheetData>','<cols><col min="4" max="4" hidden="1" style="1"/></cols><sheetData>');addPhysicalStyles(parts,{formatId:'14'});
 const {rows}=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime);assert.equal(rows[0].quantity.present,false);assert.deepEqual(rows[0].quantity.cellAttributes,{});assert.equal(rows[0].quantity.rowAttributes.hidden,'1');assert.equal(rows[0].quantity.style.source,'COLUMN');assert.equal(rows[0].quantity.style.numFmtId,'14');assert.ok(rows[0].candidate.issues.includes('HIDDEN_SOURCE_CELL'));assert.ok(rows[0].candidate.issues.includes('QUANTITY_FORMAT_UNSUPPORTED'));
});
test('effective date, percentage, currency, fractional, hidden and unknown numeric formats are not quantities',async()=>{
 for(const format of [{formatId:'14'},{formatId:'9'},{formatId:'7'},{formatId:'12'},{formatCode:';;;'}, {formatCode:'0.0,"thousands"'}, {formatCode:'0.00 "m2"'}]){
  const {parts,row}=measurementCypFixtureParts();addPhysicalStyles(parts,format);replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','D'+row,physicalNumericCell('D'+row,'12.34',{attributes:' s="1"'}));
  const source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime);assert.equal(source.rows[0].candidate.baseline,null);assert.ok(source.rows[0].candidate.issues.includes('QUANTITY_FORMAT_UNSUPPORTED'));
 }
 const {parts,row}=measurementCypFixtureParts();addPhysicalStyles(parts);replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','D'+row,physicalNumericCell('D'+row,'12.3400',{attributes:' s="1"'}));
 assert.equal((await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime)).rows[0].candidate.baseline,'12.3400');
});
test('row/column inherited styles, cell overrides, hidden columns and merged quantities have explicit gates',async()=>{
 for(const kind of ['ROW','COLUMN','HIDDEN','MERGED']){
  const {parts,row}=measurementCypFixtureParts();addPhysicalStyles(parts,{formatId:'14'});
  if(kind==='ROW')parts['xl/worksheets/sheet1.xml']=parts['xl/worksheets/sheet1.xml'].replace(`<row r="${row}">`,`<row r="${row}" s="1" customFormat="1">`);
  if(kind==='COLUMN'||kind==='HIDDEN')parts['xl/worksheets/sheet1.xml']=parts['xl/worksheets/sheet1.xml'].replace('<sheetData>',`<cols><col min="4" max="4" ${kind==='COLUMN'?'style="1"':'hidden="1"'}/></cols><sheetData>`);
  if(kind==='MERGED')parts['xl/worksheets/sheet1.xml']=parts['xl/worksheets/sheet1.xml'].replace('</worksheet>',`<mergeCells count="1"><mergeCell ref="C${row}:D${row}"/></mergeCells></worksheet>`);
  const source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime);assert.equal(source.rows[0].candidate.baseline,null);
  if(kind==='ROW'){assert.equal(source.rows[0].quantity.style.source,'ROW');replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','D'+row,physicalNumericCell('D'+row,'12.34000',{attributes:' s="0"'}));assert.equal((await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime)).rows[0].quantity.style.source,'CELL');}
 }
});
test('formula cache remains literal and requires review; original shared formula attributes and master are preserved',async()=>{
 const {parts,row}=measurementCypFixtureParts();replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','D'+row,physicalNumericCell('D'+row,'12.34',{formula:'SUM(A1:A2)',formulaAttributes:' t="shared" si="0" ref="D'+row+':D'+row+'"'}));
 const source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),q=source.rows[0].quantity;
 assert.equal(q.formulaText,'SUM(A1:A2)');assert.equal(q.formulaAttributes.si,'0');assert.equal(q.sharedFormulaMaster.address,'D'+row);assert.equal(q.rawValue,'12.34');assert.deepEqual(source.rows[0].candidate.issues,['FORMULA_CACHE_REVIEW_REQUIRED']);
 assert.throws(()=>normalizePlanMeasurementReview({source,rows:[reviewRow(source,{issuesAcknowledged:false})]}),{code:'PLAN_IMPORT_MEASUREMENT_REVIEW_REQUIRED'});
 assert.equal(normalizePlanMeasurementReview({source,rows:[reviewRow(source)]}).rows[0].baseline,'12.3400');
});
test('external, orphan shared, data-table and absent-cache formulas cannot become automatic baselines',async()=>{
 for(const [formula,formulaAttributes,quantity] of [['[remote.xlsx]Sheet!D8','', '12'],['',' t="shared" si="9"','12'],['TABLE(A1)',' t="dataTable"','12'],['SUM(A1:A2)','',null],['INDIRECT("D8")','', '12']]){
  const {parts,row}=measurementCypFixtureParts();replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','D'+row,physicalNumericCell('D'+row,quantity,{formula,formulaAttributes}));
  const source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime);assert.equal(source.rows[0].candidate.baseline,null);assert.ok(source.rows[0].candidate.issues.includes('FORMULA_UNSUPPORTED'));
 }
});
test('raw shared-string index is preserved separately from the resolved source unit',async()=>{
 const {parts,row}=measurementCypFixtureParts(),rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 parts['xl/_rels/workbook.xml.rels']=parts['xl/_rels/workbook.xml.rels'].replace('</Relationships>',`<Relationship Id="rStrings" Target="sharedStrings.xml" Type="${rel}/sharedStrings"/></Relationships>`);parts['xl/sharedStrings.xml']='<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>m²</t></si></sst>';
 replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','C'+row,`<c r="C${row}" t="s"><v>0</v></c>`);
 const source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime);assert.equal(source.rows[0].unit.rawValue,'0');assert.equal(source.rows[0].unit.value,'m²');assert.equal(source.rows[0].candidate.unit,'M2');
});
test('code/title and paired budget facts are immutable same-row identities, not title matching or invisible formula caches',async()=>{
 const {parts,row}=measurementCypFixtureParts();
 replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','A'+row,`<c r="A${row}" t="str"><f>"A.1.1.1"</f><v>A.1.1.1</v></c>`);
 const source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),first=source.rows[0];
 assert.equal(first.provenance.codeFact.value,first.code);assert.equal(first.provenance.titleFact.value,first.sourceTitle);assert.equal(first.provenance.matchingSource.codeFact.value,first.code);assert.equal(first.provenance.matchingSource.titleFact.value,first.sourceTitle);
 assert.ok(first.candidate.issues.includes('IDENTITY_REVIEW_REQUIRED'));
 assert.throws(()=>normalizePlanMeasurementReview({source,rows:[reviewRow(source)]}),{code:'PLAN_IMPORT_MEASUREMENT_REVIEW_REQUIRED'});
 assert.equal(normalizePlanMeasurementReview({source,rows:[reviewRow(source,{identityConfirmed:true})]}).rows[0].identityConfirmed,true);
 for(const mutate of [s=>s.rows[0].provenance.codeFact.value='A.1.9.9',s=>s.rows[0].provenance.titleFact.value='Otra descripción',s=>s.rows[0].provenance.codeFact.address='A999',s=>s.rows[0].provenance.matchingSource.codeFact.value='A.1.9.9',s=>s.rows[0].provenance.matchingSource.titleFact.address='C999']){const changed=cloned(source);mutate(changed);assert.throws(()=>normalizePlanMeasurementSource(changed),sourceError);}
 for(const address of ['A'+row,'B'+row]){const fixture=measurementCypFixtureParts();replacePhysicalCell(fixture.parts,'xl/worksheets/sheet1.xml',address,`<c r="${address}" t="str"><f>[remote.xlsx]Sheet!A1</f><v>${address.startsWith('A')?'A.1.1.1':'Partida sintética A.1.1.1'}</v></c>`);await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(fixture.parts),mime),sourceError);}
});
test('noncanonical XML visibility is pending and hidden identifier columns require independent identity comparison',async()=>{
 for(const attributes of ['hidden="True"','hidden="1"']){
  const {parts}=measurementCypFixtureParts();parts['xl/worksheets/sheet1.xml']=parts['xl/worksheets/sheet1.xml'].replace('<sheetData>',`<cols><col min="1" max="1" ${attributes}/></cols><sheetData>`);
  const source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime);assert.equal(source.rows[0].candidate.baseline,null);assert.ok(source.rows[0].candidate.issues.includes('IDENTITY_REVIEW_REQUIRED'));assert.ok(source.rows[0].candidate.issues.includes(attributes.includes('True')?'SOURCE_VISIBILITY_UNKNOWN':'HIDDEN_SOURCE_CELL'));
  assert.throws(()=>normalizePlanMeasurementReview({source,rows:[reviewRow(source)]}),{code:'PLAN_IMPORT_MEASUREMENT_REVIEW_REQUIRED'});
  assert.equal(normalizePlanMeasurementReview({source,rows:[reviewRow(source,{identityConfirmed:true})]}).rows[0].identityConfirmed,true);
 }
});
test('source identity is bound to file hash, same-row addresses, code and immutable derived candidates',async()=>{
 const {source,bytes,parts,row}=await extraction();await assert.rejects(extractPlanMeasurementSource(bytes,mime,{sourceSha256:'b'.repeat(64)}),sourceError);
 for(const mutate of [s=>s.version=2,s=>s.sourceSha256='x',s=>s.rows[0].provenance.quantityCell='D999',s=>s.rows[0].provenance.sourceRange=`Plan de trabajo!A${row}:D999`,s=>s.rows[0].candidate.baseline='999.0000',s=>s.rows[0].candidate.issues=['FORGED_APPROVAL'],s=>s.rows[0].quantity.rawValue='999',s=>s.rows[0].quantity.style.numFmtId='14',s=>s.rows.push(cloned(s.rows[0])),s=>s.rows[0].code='A.1.1000.1']){
  const changed=cloned(source);mutate(changed);assert.throws(()=>normalizePlanMeasurementSource(changed),sourceError);
 }
 const ordered=cloned(source);ordered.rows.reverse();assert.notEqual(planMeasurementSourceDigest(ordered),planMeasurementSourceDigest(source));
 parts['xl/worksheets/sheet1.xml']=parts['xl/worksheets/sheet1.xml'].replace(`<row r="${row}">`,`<row r="999">`);await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),sourceError);
});
test('source review selects a subset explicitly and denies duplicates, unconfirmed rows and unsupported corrections',async()=>{
 const {source}=await extraction(),review=normalizePlanMeasurementReview({source,rows:[reviewRow(source)]});
 assert.equal(review.rows.length,1);assert.equal(review.sourceDigest,planMeasurementSourceDigest(source));assert.equal(review.rows[0].code,source.rows[0].code);assert.equal(review.rows[0].corrected,false);
 for(const rows of [[],[reviewRow(source),reviewRow(source)],[reviewRow(source,{confirmed:false})],[reviewRow(source,{reason:'short'})],[reviewRow(source,{sourceRowId:'foreign'})],[reviewRow(source,{code:'A.1.9.9'})],[reviewRow(source,{baseline:'12,34'})],[reviewRow(source,{baseline:'0'})],[reviewRow(source,{baseline:'12.34567'})],[reviewRow(source,{unit:'USD'})]])assert.throws(()=>normalizePlanMeasurementReview({source,rows}),{code:'PLAN_IMPORT_MEASUREMENT_REVIEW_REQUIRED'});
 assert.throws(()=>normalizePlanMeasurementReview({source,rows:[reviewRow(source,{unit:'KG'})]}),{code:'PLAN_IMPORT_MEASUREMENT_UNIT_INCOMPATIBLE',status:409});
});
test('unknown unit and unresolved source quantity require explicit canonical correction and acknowledgement',async()=>{
 const {source}=await extraction({quantity:'1,25',unit:'bolsa'});assert.equal(source.rows[0].candidate.baseline,null);assert.equal(source.rows[0].candidate.unit,null);
 assert.throws(()=>normalizePlanMeasurementReview({source,rows:[reviewRow(source,{baseline:'1.25',unit:'UNIT',issuesAcknowledged:false})]}),{code:'PLAN_IMPORT_MEASUREMENT_REVIEW_REQUIRED'});
 const reviewed=normalizePlanMeasurementReview({source,rows:[reviewRow(source,{baseline:'1.25',unit:'UNIT'})]});assert.equal(reviewed.rows[0].baseline,'1.2500');assert.equal(reviewed.rows[0].corrected,true);
});
test('Cotización extracts individual physical rows rather than aggregate monthly rubros',async()=>{
 const {parts}=measurementQuoteFixtureParts(),source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime);
 assert.equal(source.format,'COTIZACION_PARTIDAS');assert.equal(source.rows.length,2);assert.equal(source.rows[0].sourceRowId,'Cotización!C7:F7');assert.equal(source.rows[0].candidate.baseline,'1.0000');assert.equal(source.rows[0].candidate.unit,'UNIT');assert.ok(source.rows.every(row=>row.sourceTitle.startsWith('Partida sintética')));
});
test('a premature quote total or missing physical row title cannot silently omit source candidates',async()=>{
 const {parts}=measurementQuoteFixtureParts();parts['xl/worksheets/sheet2.xml']=parts['xl/worksheets/sheet2.xml'].replace('</sheetData>',`<row r="10">${physicalTextCell('C10','1.3')}${physicalTextCell('D10','Partida física posterior sintética')}${physicalTextCell('E10','m²')}${physicalNumericCell('F10','5')}</row></sheetData>`);
 await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),{code:'PLAN_IMPORT_MEASUREMENT_EXTRACTION_INCOMPLETE',status:413});
 const missing=measurementQuoteFixtureParts();replacePhysicalCell(missing.parts,'xl/worksheets/sheet2.xml','D7','');await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(missing.parts),mime),sourceError);
 const notes=measurementQuoteFixtureParts();notes.parts['xl/worksheets/sheet2.xml']=notes.parts['xl/worksheets/sheet2.xml'].replace('</sheetData>',`<row r="10">${physicalTextCell('D10','Nota textual sintética sin partidas físicas')}</row></sheetData>`);assert.equal((await extractPlanMeasurementSource(zipOoxmlFixture(notes.parts),mime)).rows.length,2);
});
test('unknown XML style-selection booleans cannot manufacture a General numeric candidate',async()=>{
 const {parts,row}=measurementCypFixtureParts();addPhysicalStyles(parts,{formatId:'14'});parts['xl/worksheets/sheet1.xml']=parts['xl/worksheets/sheet1.xml'].replace(`<row r="${row}">`,`<row r="${row}" s="1" customFormat="True">`);const bytes=zipOoxmlFixture(parts);
 await assert.rejects(readPlanMeasurementOoxml(bytes,mime),sourceError);await assert.rejects(extractPlanMeasurementSource(bytes,mime),sourceError);
 const good=(await extraction()).source;good.rows[0].quantity.rowAttributes.customFormat='True';assert.throws(()=>normalizePlanMeasurementSource(good),sourceError);
 const xf=measurementCypFixtureParts();addPhysicalStyles(xf.parts,{formatId:'14',xf:' applyNumberFormat="True"'});replacePhysicalCell(xf.parts,'xl/worksheets/sheet1.xml','D'+xf.row,physicalNumericCell('D'+xf.row,'12.34',{attributes:' s="1"'}));await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(xf.parts),mime),sourceError);
 const other=(await extraction()).source;other.rows[0].quantity.style.attributes.applyNumberFormat='True';assert.throws(()=>normalizePlanMeasurementSource(other),sourceError);
});
test('document source keeps literal evidence and never interprets decimal commas or OCR as approval',()=>{
 const source=normalizePlanMeasurementDocument(measurementDocumentFixture(),documentOptions);assert.deepEqual(source.rows[0].candidate,{baseline:'12.3400',unit:'M2',issues:['OCR_REVIEW_REQUIRED']});assert.equal(source.rows[0].provenance.evidence[0].page,1);
 assert.throws(()=>normalizePlanMeasurementReview({source,rows:[reviewRow(source,{issuesAcknowledged:false})]}),{code:'PLAN_IMPORT_MEASUREMENT_REVIEW_REQUIRED'});
 const provider=measurementDocumentFixture();provider.rows[0].rawQuantity='1,25';provider.rows[0].evidence[0].quote='Partida sintética 1,25 m²';const comma=normalizePlanMeasurementDocument(provider,documentOptions);assert.equal(comma.rows[0].candidate.baseline,null);
 const correction=normalizePlanMeasurementReview({source:comma,rows:[reviewRow(comma,{baseline:'1.25',unit:'KG',reason:'Corregí la lectura OCR comparándola con la página original.'})]});assert.equal(correction.rows[0].corrected,true);assert.equal(correction.rows[0].baseline,'1.2500');
});
test('document source rejects partial extraction, forged literal evidence, other purposes and image page confusion',()=>{
 for(const mutate of [p=>p.rows[0].evidence[0].quote='Literal sin cantidades',p=>p.rows[0].rawQuantity='99',p=>p.rows[0].code=12,p=>p.rows[0].rawUnit=null,p=>p.rows[0].evidence=[],p=>p.rows[0].evidence[0].page=0,p=>p.rows[0].extra='approved',p=>p.extra='approved']){const provider=measurementDocumentFixture();mutate(provider);assert.throws(()=>normalizePlanMeasurementDocument(provider,documentOptions),sourceError);}
 assert.throws(()=>normalizePlanMeasurementDocument(measurementDocumentFixture({truncated:true}),documentOptions),{code:'PLAN_IMPORT_MEASUREMENT_EXTRACTION_INCOMPLETE'});
 const image=measurementDocumentFixture();image.rows[0].evidence[0].page=2;assert.throws(()=>normalizePlanMeasurementDocument(image,{...documentOptions,contentType:'image/png'}),sourceError);
 assert.throws(()=>normalizePlanMeasurementDocument(measurementDocumentFixture({isMeasurement:false}),documentOptions),{code:'PLAN_IMPORT_MEASUREMENT_NOT_FOUND'});
 assert.equal(PLAN_MEASUREMENT_DOCUMENT_SCHEMA.additionalProperties,false);assert.equal(PLAN_MEASUREMENT_DOCUMENT_SCHEMA.properties.rows.items.properties.rawQuantity.type[0],'string');assert.match(PLAN_MEASUREMENT_DOCUMENT_INSTRUCTIONS,/No calcules cantidades desde importes/);
});

function declaredQuantityFormat(id,formatCode,{quantity='12.34000',selected=true}={}){
 const {parts,row}=measurementCypFixtureParts();addPhysicalStyles(parts);
 const encoded=formatCode.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 parts['xl/styles.xml']=parts['xl/styles.xml'].replace('<numFmt numFmtId="164" formatCode="0.0000"/>',`<numFmt numFmtId="${id}" formatCode="${encoded}"/>`).replace('<xf numFmtId="164"/>',`<xf numFmtId="${id}"/>`);
 replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','D'+row,physicalNumericCell('D'+row,quantity,{attributes:selected?' s="1"':''}));return {parts,row};
}
test('unused low accounting declarations do not alter exact physical candidates or legacy financial extraction',async()=>{
 for(const id of ['41','43','44']){
  const code='_(* #,##0.00_);_(* (#,##0.00);_(* "-"_);_(@_)',plain=declaredQuantityFormat(id,code,{selected:false}),{parts}=declaredQuantityFormat(id,code,{selected:false});plain.parts['xl/styles.xml']=plain.parts['xl/styles.xml'].replace(/<numFmts\b[^>]*>[\s\S]*?<\/numFmts>/,'<numFmts count="0"/>');
  const bytes=zipOoxmlFixture(parts),before=sha(bytes),source=await extractPlanMeasurementSource(bytes,mime),original=await extractPlanMeasurementSource(zipOoxmlFixture(plain.parts),mime);
  assert.deepEqual(source.rows,original.rows);assert.equal(source.sourceSha256,before);assert.equal(sha(bytes),before);assert.equal(source.rows[0].candidate.baseline,'12.3400');assert.equal(source.rows[0].candidate.unit,'M2');assert.equal(Object.hasOwn(source.rows[0],'startsOn'),false);assert.equal(Object.hasOwn(source.rows[0],'progress'),false);
  const legacy=await extractCypPlanOoxml(bytes,mime);assert.equal(legacy.spreadsheet.quantityImported,false);assert.equal(legacy.spreadsheet.progressImported,false);assert.deepEqual(legacy,await extractCypPlanOoxml(zipOoxmlFixture(plain.parts),mime));
 }
});
test('used date money percentage accounting and unknown low format IDs never become baselines even with a numeric-looking declaration',async()=>{
 for(const id of ['5','7','9','14','41','43','44','163']){
  const {parts,row}=declaredQuantityFormat(id,'0'),bytes=zipOoxmlFixture(parts),source=await extractPlanMeasurementSource(bytes,mime),first=source.rows[0];
  assert.equal(first.sourceRowId,`Plan de trabajo!A${row}:D${row}`);assert.equal(first.quantity.style.numFmtId,id);assert.equal(first.quantity.style.formatCode,'0');assert.equal(first.quantity.rawValue,'12.34000');assert.equal(first.quantity.value,'12.34000');assert.equal(first.candidate.baseline,null);assert.equal(first.candidate.unit,'M2');assert.ok(first.candidate.issues.includes('QUANTITY_FORMAT_UNSUPPORTED'));assert.deepEqual(normalizePlanMeasurementSource(source),source);
  const forged=cloned(source);forged.rows[0].candidate.baseline='12.3400';assert.throws(()=>normalizePlanMeasurementSource(forged),sourceError);assert.throws(()=>normalizePlanMeasurementReview({source,rows:[reviewRow(source,{issuesAcknowledged:false})]}),{code:'PLAN_IMPORT_MEASUREMENT_REVIEW_REQUIRED'});
 }
});
test('coherent numeric built-ins and simple declared custom formats retain exact lexical quantities',async()=>{
 for(const [id,code]of [['0','General'],['1','0'],['2','0.00'],['3','#,##0'],['4','#,##0.00'],['164','0.0000'],['999999','#,##0.0000']]){
  const {parts}=declaredQuantityFormat(id,code),source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),first=source.rows[0];assert.equal(first.quantity.style.numFmtId,id);assert.equal(first.quantity.style.formatCode,code);assert.equal(first.quantity.rawValue,'12.34000');assert.deepEqual(first.candidate,{baseline:'12.3400',unit:'M2',issues:[]});
 }
});
test('incoherent built-in numeric declarations preserve the existing source rejection rather than approving a numeric disguise',async()=>{
 for(const [id,code]of [['0','0'],['1','0.00'],['2','0'],['3','0'],['4','0']]){const {parts}=declaredQuantityFormat(id,code);await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),sourceError);}
});
test('an accounting style without a cached quantity preserves absence and cannot synthesize a baseline',async()=>{
 const {parts}=declaredQuantityFormat('43','0',{quantity:null}),source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),first=source.rows[0];assert.equal(first.quantity.present,true);assert.equal(first.quantity.cachePresent,false);assert.equal(first.quantity.rawValue,null);assert.equal(first.quantity.value,null);assert.equal(first.quantity.style.numFmtId,'43');assert.equal(first.quantity.style.formatCode,'0');assert.equal(first.candidate.baseline,null);assert.ok(first.candidate.issues.includes('QUANTITY_MISSING'));assert.ok(first.candidate.issues.includes('QUANTITY_FORMAT_UNSUPPORTED'));
});

const syntheticMoneyFooter='SON PESOS CIENTO VEINTITRES MIL CUATROCIENTOS CINCUENTA Y SEIS CON 78/100';
function quoteMoneyFooter({cells=physicalTextCell('C11',syntheticMoneyFooter),rowAttributes='',extraRows=''}={}){
 const {parts}=measurementQuoteFixtureParts();parts['xl/worksheets/sheet2.xml']=parts['xl/worksheets/sheet2.xml'].replace('</sheetData>',`<row r="11"${rowAttributes}>${cells}</row>${extraRows}</sheetData>`);return parts;
}
test('literal money-in-words footer after the unique quote total is retained as an explicit monetary exclusion',async()=>{
 for(const footer of [syntheticMoneyFooter,'SON PESOS: DOSCIENTOS CUARENTA Y CINCO CON SETENTA Y OCHO CENTAVOS.']){const parts=quoteMoneyFooter({cells:physicalTextCell('C11',footer)}),bytes=zipOoxmlFixture(parts),source=await extractPlanMeasurementSource(bytes,mime),original=await extractPlanMeasurementSource(zipOoxmlFixture(measurementQuoteFixtureParts().parts),mime);assert.equal(source.sourceSha256,sha(bytes));assert.deepEqual(source.rows,original.rows);assert.equal(source.rows.length,2);assert.deepEqual(source.excludedRows,[{sourceRowId:'Cotización!C11:F11',code:null,sourceTitle:footer,reason:'MONETARY_COST_ROW'}]);assert.deepEqual(normalizePlanMeasurementSource(source),source);assert.ok(source.rows.every(row=>!Object.hasOwn(row,'startsOn')&&!Object.hasOwn(row,'progress')));assert.equal(Object.hasOwn(source,'amount'),false);assert.equal(Object.hasOwn(source,'currency'),false);}
});
test('money footer vocabulary never hides task words ambiguous prefixes notes or populated companion columns',async()=>{
 const cells=[physicalTextCell('C11','SON PESOS CIEN CON 00/100 COLOCAR HORMIGON'),physicalTextCell('C11','IMPORTE SON PESOS CIEN CON 00/100'),physicalTextCell('C11','SON PESOS CIEN CON 100/100'),physicalTextCell('C11','SON PESOS CIEN CON 00/100 SALDO A CONFIRMAR'),physicalTextCell('C11','Nota textual sintética sin partidas'),physicalNumericCell('C11','123'),...['D','E','F'].map(column=>physicalTextCell('C11',syntheticMoneyFooter)+(column==='F'?physicalNumericCell('F11','1'):physicalTextCell(column+'11',column==='D'?'Nota adicional sintética':'m²')))];
 for(const value of cells)await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(quoteMoneyFooter({cells:value})),mime),{code:'PLAN_IMPORT_MEASUREMENT_EXTRACTION_INCOMPLETE',status:413});
});
test('formula hidden merged and unsafe formatted money footer cells cannot be silently excluded',async()=>{
 const formula=physicalNumericCell('C11',syntheticMoneyFooter,{attributes:' t="str"',formula:'"SON PESOS CIEN CON 00/100"'}),blankFormula=physicalTextCell('C11',syntheticMoneyFooter)+physicalNumericCell('D11',null,{attributes:' t="str"',formula:'""'}),cases=[quoteMoneyFooter({cells:formula}),quoteMoneyFooter({cells:blankFormula}),quoteMoneyFooter({rowAttributes:' hidden="1"'}),quoteMoneyFooter({rowAttributes:' hidden="True"'})];
 const merged=quoteMoneyFooter();merged['xl/worksheets/sheet2.xml']=merged['xl/worksheets/sheet2.xml'].replace('</worksheet>','<mergeCells count="1"><mergeCell ref="C11:D11"/></mergeCells></worksheet>');cases.push(merged);
 const columnHidden=quoteMoneyFooter();columnHidden['xl/worksheets/sheet2.xml']=columnHidden['xl/worksheets/sheet2.xml'].replace('<sheetData>','<cols><col min="3" max="3" hidden="1"/></cols><sheetData>');cases.push(columnHidden);
 const styled=quoteMoneyFooter({cells:physicalTextCell('C11',syntheticMoneyFooter,' s="1"')});addPhysicalStyles(styled,{formatId:'14'});cases.push(styled);
 const disguised=quoteMoneyFooter({cells:physicalTextCell('C11',syntheticMoneyFooter,' s="1"')});addPhysicalStyles(disguised);disguised['xl/styles.xml']=disguised['xl/styles.xml'].replace('<numFmt numFmtId="164" formatCode="0.0000"/>','<numFmt numFmtId="43" formatCode="0"/>').replace('<xf numFmtId="164"/>','<xf numFmtId="43"/>');cases.push(disguised);
 for(const parts of cases)await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),{code:'PLAN_IMPORT_MEASUREMENT_EXTRACTION_INCOMPLETE',status:413});
});
test('a valid money footer cannot turn an extra physical item on either side of that footer into a complete import',async()=>{
 for(const row of ['10','12']){const extraRows=`<row r="${row}">${physicalTextCell('C'+row,'1.3')}${physicalTextCell('D'+row,'Partida física posterior sintética')}${physicalTextCell('E'+row,'m²')}${physicalNumericCell('F'+row,'5')}</row>`;await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(quoteMoneyFooter({extraRows})),mime),{code:'PLAN_IMPORT_MEASUREMENT_EXTRACTION_INCOMPLETE',status:413});}
});
test('a genuinely empty percent-formatted footer companion preserves its style facts without manufacturing a quantity',async()=>{
 const parts=quoteMoneyFooter({cells:physicalTextCell('C11',syntheticMoneyFooter)+physicalNumericCell('F11',null,{attributes:' s="1"'})});addPhysicalStyles(parts,{formatId:'9'});const bytes=zipOoxmlFixture(parts),snapshot=await readPlanMeasurementOoxml(bytes,mime),empty=snapshot.worksheets[0].cells.find(cell=>cell.address==='F11');assert.equal(empty.present,true);assert.equal(empty.rawValue,null);assert.equal(empty.value,null);assert.equal(empty.cachePresent,false);assert.equal(empty.style.source,'CELL');assert.equal(empty.style.index,'1');assert.equal(empty.style.numFmtId,'9');assert.equal(empty.formulaAttributes,null);assert.equal(empty.formulaText,null);assert.deepEqual(empty.mergedRanges,[]);
 const source=await extractPlanMeasurementSource(bytes,mime);assert.equal(source.sourceSha256,sha(bytes));assert.equal(source.rows.length,2);assert.deepEqual(source.excludedRows,[{sourceRowId:'Cotización!C11:F11',code:null,sourceTitle:syntheticMoneyFooter,reason:'MONETARY_COST_ROW'}]);assert.equal(source.rows.some(row=>row.sourceRowId==='Cotización!C11:F11'),false);assert.ok(source.rows.every(row=>row.candidate.baseline==='1.0000'&&row.candidate.unit==='UNIT'));
});
test('blank footer style tolerance never admits unresolved or ambiguous styles nor unsafe labels or companion facts',async()=>{
 const empty=(attributes=' s="1"',formula=null)=>quoteMoneyFooter({cells:physicalTextCell('C11',syntheticMoneyFooter)+physicalNumericCell('F11',null,{attributes,formula})}),unresolved=empty(' s="2"');addPhysicalStyles(unresolved,{formatId:'9'});
 const ambiguous=empty('');addPhysicalStyles(ambiguous,{formatId:'9'});ambiguous['xl/worksheets/sheet2.xml']=ambiguous['xl/worksheets/sheet2.xml'].replace('<sheetData>','<cols><col min="6" max="6" style="0"/><col min="6" max="6" style="1"/></cols><sheetData>');
 const label=quoteMoneyFooter({cells:physicalTextCell('C11',syntheticMoneyFooter,' s="1"')+physicalNumericCell('F11',null,{attributes:' s="1"'})});addPhysicalStyles(label,{formatId:'9'});
 const formula=empty(' s="1"','SUM(F1:F2)');addPhysicalStyles(formula,{formatId:'9'});
 const hidden=empty();addPhysicalStyles(hidden,{formatId:'9'});hidden['xl/worksheets/sheet2.xml']=hidden['xl/worksheets/sheet2.xml'].replace('<sheetData>','<cols><col min="6" max="6" hidden="1"/></cols><sheetData>');
 const merged=empty();addPhysicalStyles(merged,{formatId:'9'});merged['xl/worksheets/sheet2.xml']=merged['xl/worksheets/sheet2.xml'].replace('</worksheet>','<mergeCells count="1"><mergeCell ref="F11:G11"/></mergeCells></worksheet>');
 for(const parts of [unresolved,ambiguous,label,formula,hidden,merged])await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),{code:'PLAN_IMPORT_MEASUREMENT_EXTRACTION_INCOMPLETE',status:413});
});

const literalLineFeedTitle='  Partida  sintética\nuno \n  literal  ';
function quoteLineFeedTitleParts({title=literalLineFeedTitle,type='xlsx'}={}){
 const {parts}=measurementQuoteFixtureParts();replacePhysicalCell(parts,'xl/worksheets/sheet2.xml','D7',physicalNumericCell('D7',title,{attributes:' t="str"'}));if(type==='xlsm'){parts['[Content_Types].xml']=parts['[Content_Types].xml'].replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml','application/vnd.ms-excel.sheet.macroEnabled.main+xml');parts['xl/vbaProject.bin']=Buffer.from('Synthetic inert line feed title workbook; never executed');}return parts;
}
test('Excel LF title presentation is derived without trimming other spaces or changing original XLSX and XLSM facts',async()=>{
 for(const[type,contentType]of [['xlsx',mime],['xlsm','application/vnd.ms-excel.sheet.macroenabled.12']]){const bytes=zipOoxmlFixture(quoteLineFeedTitleParts({type})),before=sha(bytes),source=await extractPlanMeasurementSource(bytes,contentType),first=source.rows[0];assert.equal(source.sourceSha256,before);assert.equal(sha(bytes),before);assert.equal(first.sourceTitle,literalLineFeedTitle.replaceAll('\n',' '));assert.equal(first.provenance.titleFact.value,literalLineFeedTitle);assert.equal(first.provenance.titleFact.rawValue,literalLineFeedTitle);assert.equal(first.provenance.titleFact.type,'str');assert.equal(first.provenance.titleFact.address,'D7');assert.equal(first.provenance.titleFact.formulaText,null);assert.equal(first.sourceRowId,'Cotización!C7:F7');assert.equal(first.quantity.rawValue,'1');assert.deepEqual(first.candidate,{baseline:'1.0000',unit:'UNIT',issues:[]});assert.deepEqual(normalizePlanMeasurementSource(source),source);}
});
test('LF normalization also preserves grouping titles and requires exact original CyP cross-sheet title equality',async()=>{
 const grouped=quoteLineFeedTitleParts();replacePhysicalCell(grouped,'xl/worksheets/sheet2.xml','C7',physicalTextCell('C7','1'));replacePhysicalCell(grouped,'xl/worksheets/sheet2.xml','C8',physicalTextCell('C8','1.1'));const quoted=await extractPlanMeasurementSource(zipOoxmlFixture(grouped),mime);assert.equal(quoted.rows.length,1);assert.deepEqual(quoted.excludedRows,[{sourceRowId:'Cotización!C7:F7',code:'1',sourceTitle:literalLineFeedTitle.replaceAll('\n',' '),reason:'GROUPING_ROW'}]);
 const {parts}=measurementCypFixtureParts(),original=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),first=original.rows[0],group=original.excludedRows.find(row=>row.code===first.parentCode),groupRow=/!A(\d+):/.exec(group.sourceRowId)[1],budgetRow=/<c r="B(\d+)" t="inlineStr"><is><t>A\.1\.1<\/t>/.exec(parts['xl/worksheets/sheet2.xml'])[1],rawGroup='Rubro  sintético\nA.1.1';
 for(const[sheet,address,title]of [['xl/worksheets/sheet1.xml',first.provenance.titleCell,literalLineFeedTitle],['xl/worksheets/sheet2.xml',first.provenance.matchingSource.titleFact.address,literalLineFeedTitle],['xl/worksheets/sheet1.xml','B'+groupRow,rawGroup],['xl/worksheets/sheet2.xml','C'+budgetRow,rawGroup]])replacePhysicalCell(parts,sheet,address,physicalNumericCell(address,title,{attributes:' t="str"'}));
 const source=await extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),leaf=source.rows[0];assert.equal(leaf.sourceTitle,literalLineFeedTitle.replaceAll('\n',' '));assert.equal(leaf.provenance.titleFact.value,literalLineFeedTitle);assert.equal(leaf.provenance.titleFact.rawValue,literalLineFeedTitle);assert.equal(leaf.provenance.matchingSource.titleFact.value,literalLineFeedTitle);assert.equal(leaf.provenance.matchingSource.titleFact.rawValue,literalLineFeedTitle);assert.equal(source.excludedRows.find(row=>row.code===first.parentCode).sourceTitle,rawGroup.replaceAll('\n',' '));
 replacePhysicalCell(parts,'xl/worksheets/sheet2.xml',first.provenance.matchingSource.titleFact.address,physicalNumericCell(first.provenance.matchingSource.titleFact.address,literalLineFeedTitle.replaceAll('\n',' '),{attributes:' t="str"'}));await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),sourceError);
});
test('LF title derivation cannot admit forged presentation or carriage returns tabs and markup characters',async()=>{
 const source=await extractPlanMeasurementSource(zipOoxmlFixture(quoteLineFeedTitleParts()),mime);for(const title of [literalLineFeedTitle,literalLineFeedTitle.replaceAll('\n',' ').trim(),'Título arbitrario sintético',source.rows[0].sourceTitle.replace('  ',' ')]){const forged=cloned(source);forged.rows[0].sourceTitle=title;assert.throws(()=>normalizePlanMeasurementSource(forged),sourceError);}
 for(const encoded of ['Partida&#13;sintética','Partida&#9;sintética','Partida&lt;sintética','Partida&gt;sintética']){const {parts}=measurementQuoteFixtureParts();replacePhysicalCell(parts,'xl/worksheets/sheet2.xml','D7',`<c r="D7" t="str"><v>${encoded}</v></c>`);await assert.rejects(extractPlanMeasurementSource(zipOoxmlFixture(parts),mime),sourceError);}
 for(const raw of ['Partida\rsintética','Partida\tsintética','Partida<sintética','Partida>sintética']){const forged=cloned(source);forged.rows[0].provenance.titleFact.value=raw;forged.rows[0].provenance.titleFact.rawValue=raw;forged.rows[0].sourceTitle=raw;assert.throws(()=>normalizePlanMeasurementSource(forged),sourceError);}
});
