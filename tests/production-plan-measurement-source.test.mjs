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
