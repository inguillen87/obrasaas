import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {extractPlanBudgetSource,planBudgetSourceDigest,selectPlanBudgetSourceRow,planBudgetStyleEvidenceSize,PLAN_BUDGET_SOURCE_LIMITS} from '../src/lib/plan-budget-source.mjs';
import {extractCypPlanOoxml,readPlanMeasurementOoxml,readPlanBudgetOoxml,PLAN_OOXML_LIMITS} from '../src/lib/plan-import-ooxml.mjs';
import {extractPlanMeasurementSource,planMeasurementSourceDigest} from '../src/lib/plan-measurement-source.mjs';
import {budgetSourceFixtureParts,putBudgetCell,relocateBudgetFixtureRow,sharedPlanReference,physicalTextCell,physicalNumericCell,zipOoxmlFixture,addPhysicalStyles,PLAN_SHEET_PART,BUDGET_SHEET_PART} from './fixtures/plan-budget-source-synthetic.mjs';
const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const sha=value=>createHash('sha256').update(value).digest('hex');
const read=parts=>extractPlanBudgetSource(zipOoxmlFixture(parts),mime);
const extraction=async options=>{const fixture=budgetSourceFixtureParts(options),bytes=zipOoxmlFixture(fixture.parts);return{...fixture,bytes,source:await extractPlanBudgetSource(bytes,mime,{sourceSha256:sha(bytes)})};};
const binding=(source,row=source.rows[0])=>({sourceSha256:source.sourceSha256,sourceDigest:source.sourceDigest,code:row.code,budgetWorksheet:row.budget.worksheet,budgetRow:row.budget.row,planWorksheet:row.plan.worksheet,planRow:row.plan.row});

test('budget joins unique codes and exact Plan A references across distinct source rows',async()=>{
 const{source,bytes,rows}=await extraction(),row=source.rows[0];assert.notEqual(rows[0].planRow,rows[0].budgetRow);assert.equal(row.code,rows[0].code);assert.equal(row.parentCode,'A.1.1');assert.equal(row.plan.identityReference.address,'B'+rows[0].budgetRow);assert.equal(source.sourceSha256,sha(bytes));assert.equal(source.sourceDigest,planBudgetSourceDigest(source));assert.equal(row.automaticUseAllowed,false);assert.equal(source.taskWrites,false);assert.equal(source.stockWrites,false);
});
test('one hundred ninety budget items retain their hierarchy without grouping or cost duplication',async()=>{
 const{source}=await extraction({partidas:190});assert.equal(source.rows.length,190);assert.equal(new Set(source.rows.map(row=>row.code)).size,190);assert.equal(source.nonPhysicalRows.filter(row=>row.classification==='GROUPING_ROW').length,26);assert.equal(source.nonPhysicalRows.filter(row=>row.classification==='MONETARY_COST_ROW').length,9);assert.ok(source.nonPhysicalRows.every(row=>!source.rows.some(item=>item.code===row.code)));assert.ok(Buffer.byteLength(JSON.stringify(source))<=PLAN_BUDGET_SOURCE_LIMITS.proofBytes);
});
test('literal zero negative and large decimal strings survive without rounding or Number coercion',async()=>{
 for(const quantity of ['0','-1.25000','9007199254740993.1234500']){const{source}=await extraction({quantity});assert.equal(source.rows[0].budget.cells.quantity.rawValue,quantity);assert.equal(source.rows[0].observed.quantity.decimal,quantity);assert.equal(source.rows[0].plan.links.quantity.cacheMatchesBudget,true);}
});
test('saved literal presence and formula cache presence remain different observations',async()=>{
 const{source}=await extraction(),row=source.rows[0];assert.equal(row.observed.quantity.savedValuePresent,true);assert.equal(row.observed.quantity.formulaCachePresent,false);assert.equal(row.observed.unitPrice.savedValuePresent,true);assert.equal(row.observed.unitPrice.formulaCachePresent,true);assert.equal(row.observed.unitPrice.kind,'FORMULA_CACHE');
});
test('the D72 M76 conflict remains missing without borrowing a synthetic budget quantity',async()=>{
 const f=budgetSourceFixtureParts(),first=f.rows[0];relocateBudgetFixtureRow(f.parts,BUDGET_SHEET_PART,first.budgetRow,'71');relocateBudgetFixtureRow(f.parts,PLAN_SHEET_PART,first.planRow,'72');
 putBudgetCell(f.parts,PLAN_SHEET_PART,'A72',physicalNumericCell('A72',first.code,{attributes:' t="str"',formula:"'CyP Integral completo'!B71"}));
 for(const [column,target,value]of [['E','H',first.unitPrice],['F','K',first.amount]])putBudgetCell(f.parts,PLAN_SHEET_PART,column+'72',physicalNumericCell(column+'72',value,{formula:`'CyP Integral completo'!${target}71`}));
 putBudgetCell(f.parts,PLAN_SHEET_PART,'D72',physicalNumericCell('D72',null,{formula:"'CyP Integral completo'!M76"}));const source=await read(f.parts),row=source.rows.find(row=>row.plan.row==='72');
 assert.equal(row.budget.row,'71');assert.equal(row.observed.quantity.decimal,'17.25000');assert.equal(row.plan.cells.quantity.rawValue,null);assert.equal(row.plan.links.quantity.observation.decimal,null);assert.equal(row.plan.links.quantity.reference.address,'M76');assert.equal(row.plan.links.quantity.referenceMatches,false);assert.ok(row.issues.includes('PLAN_QUANTITY_FORMULA_CACHE_MISSING'));assert.equal(row.automaticUseAllowed,false);
});
test('a missing amount cache leaves the physical stored sum incomplete instead of zero',async()=>{
 const f=budgetSourceFixtureParts(),first=f.rows[0];putBudgetCell(f.parts,BUDGET_SHEET_PART,'K'+first.budgetRow,physicalNumericCell('K'+first.budgetRow,null,{formula:'E'+first.budgetRow+'*H'+first.budgetRow}));const source=await read(f.parts);assert.equal(source.rows[0].observed.lineAmount.savedValuePresent,false);assert.equal(source.rows[0].observed.lineAmount.formulaCachePresent,false);assert.equal(source.sums.physicalLineAmounts.complete,false);assert.equal(source.sums.physicalLineAmounts.value,null);
});
test('numeric-looking text boolean date and error cells remain unresolved original facts',async()=>{
 for(const [type,value]of [['str','12.50'],['b','1'],['d','2023-03-01'],['e','#REF!']]){const f=budgetSourceFixtureParts(),cell='H'+f.rows[0].budgetRow;putBudgetCell(f.parts,BUDGET_SHEET_PART,cell,physicalNumericCell(cell,value,{attributes:` t="${type}"`}));const source=await read(f.parts),row=source.rows[0];assert.equal(row.budget.cells.unitPrice.type,type);assert.equal(row.budget.cells.unitPrice.rawValue,value);assert.equal(row.observed.unitPrice.savedValuePresent,true);assert.equal(row.observed.unitPrice.decimal,null);assert.ok(row.observed.unitPrice.issues.includes('NON_NUMERIC_CELL_TYPE'));}
});
test('empty cache absent cell and numeric zero are not interchangeable',async()=>{
 const f=budgetSourceFixtureParts(),cell='K'+f.rows[0].budgetRow;putBudgetCell(f.parts,BUDGET_SHEET_PART,cell,physicalNumericCell(cell,''));const empty=await read(f.parts);assert.equal(empty.rows[0].observed.lineAmount.savedValuePresent,true);assert.equal(empty.rows[0].observed.lineAmount.decimal,null);
 putBudgetCell(f.parts,BUDGET_SHEET_PART,cell,'');const absent=await read(f.parts);assert.equal(absent.rows[0].budget.cells.lineAmount.present,false);assert.equal(absent.rows[0].observed.lineAmount.kind,'ABSENT');
 putBudgetCell(f.parts,BUDGET_SHEET_PART,cell,physicalNumericCell(cell,'0.000'));const zero=await read(f.parts);assert.equal(zero.rows[0].observed.lineAmount.decimal,'0.000');
});
test('shared direct Plan references preserve masters while resolving only cell addresses',async()=>{
 const f=budgetSourceFixtureParts();sharedPlanReference(f.parts,f.rows);const source=await read(f.parts),first=source.rows[0],second=source.rows[1];assert.equal(second.plan.cells.unitPrice.formulaText,'');assert.equal(second.plan.cells.unitPrice.sharedFormulaMaster.address,'E'+f.rows[0].planRow);assert.equal(second.plan.links.unitPrice.reference.address,'H'+f.rows[1].budgetRow);assert.equal(second.plan.links.unitPrice.referenceMatches,true);assert.equal(first.plan.links.unitPrice.referenceMatches,true);assert.equal(source.formulasEvaluated,false);
});
test('an orphan shared amount cache is retained but cannot complete the sum',async()=>{
 const f=budgetSourceFixtureParts(),cell='K'+f.rows[0].budgetRow;putBudgetCell(f.parts,BUDGET_SHEET_PART,cell,physicalNumericCell(cell,'8.00',{formula:'',formulaAttributes:' t="shared" si="57"'}));const source=await read(f.parts);assert.equal(source.rows[0].budget.cells.lineAmount.rawValue,'8.00');assert.equal(source.rows[0].observed.lineAmount.decimal,null);assert.ok(source.rows[0].observed.lineAmount.issues.includes('SHARED_MASTER_UNRESOLVED'));assert.equal(source.sums.physicalLineAmounts.complete,false);
});
test('a shared amount follower outside its master range cannot complete stored totals',async()=>{
 const f=budgetSourceFixtureParts(),first=f.rows[0],last=f.rows[1],master='K'+first.budgetRow,follower='K'+last.budgetRow;
 putBudgetCell(f.parts,BUDGET_SHEET_PART,master,physicalNumericCell(master,first.amount,{formula:'E'+first.budgetRow+'*H'+first.budgetRow,formulaAttributes:` t="shared" si="57" ref="${master}:${master}"`}));
 putBudgetCell(f.parts,BUDGET_SHEET_PART,follower,physicalNumericCell(follower,last.amount,{formula:'',formulaAttributes:' t="shared" si="57"'}));
 const source=await read(f.parts);assert.equal(source.rows[1].budget.cells.lineAmount.sharedFormulaMaster.address,master);assert.equal(source.rows[1].budget.cells.lineAmount.rawValue,last.amount);assert.equal(source.rows[1].observed.lineAmount.decimal,null);assert.ok(source.rows[1].observed.lineAmount.issues.includes('SHARED_MASTER_UNRESOLVED'));assert.equal(source.sums.physicalLineAmounts.complete,false);
});
test('absolute shared references are not shifted to manufacture a matching price link',async()=>{
 const f=budgetSourceFixtureParts();sharedPlanReference(f.parts,f.rows,{absolute:true});const source=await read(f.parts);assert.equal(source.rows[1].plan.links.unitPrice.reference.address,'H'+f.rows[0].budgetRow);assert.equal(source.rows[1].plan.links.unitPrice.referenceMatches,false);assert.ok(source.rows[1].issues.includes('PLAN_UNITPRICE_REFERENCE_UNRESOLVED'));
});
test('a wrong Plan A budget row is rejected despite a plausible cached code and title',async()=>{
 const f=budgetSourceFixtureParts(),first=f.rows[0];putBudgetCell(f.parts,PLAN_SHEET_PART,'A'+first.planRow,physicalNumericCell('A'+first.planRow,first.code,{attributes:' t="str"',formula:`'CyP Integral completo'!B${f.rows[1].budgetRow}`}));await assert.rejects(read(f.parts),{code:'PLAN_IMPORT_BUDGET_IDENTITY_LINK_REQUIRED',status:400});
});
test('a matching title cannot replace an unknown source code',async()=>{
 const f=budgetSourceFixtureParts(),first=f.rows[0];putBudgetCell(f.parts,PLAN_SHEET_PART,'A'+first.planRow,physicalNumericCell('A'+first.planRow,'A.1.1.99',{attributes:' t="str"',formula:`'CyP Integral completo'!B${first.budgetRow}`}));await assert.rejects(read(f.parts),{code:'PLAN_IMPORT_SPREADSHEET_PROFILE_REQUIRED'});
});
test('duplicate Plan or budget codes reject the entire observation without a first-match join',async()=>{
 for(const sheet of [PLAN_SHEET_PART,BUDGET_SHEET_PART]){const f=budgetSourceFixtureParts(),cell=(sheet===PLAN_SHEET_PART?'A'+f.rows[1].planRow:'B'+f.rows[1].budgetRow);putBudgetCell(f.parts,sheet,cell,physicalTextCell(cell,f.rows[0].code));await assert.rejects(read(f.parts),{code:'PLAN_IMPORT_MEASUREMENT_SOURCE_INVALID'});}
});
test('foreign sheet and external identity references cannot bind a budget row',async()=>{
 const f=budgetSourceFixtureParts(),first=f.rows[0],cell='A'+first.planRow;putBudgetCell(f.parts,PLAN_SHEET_PART,cell,physicalNumericCell(cell,first.code,{attributes:' t="str"',formula:"'Otra hoja'!B9"}));await assert.rejects(read(f.parts),{code:'PLAN_IMPORT_BUDGET_IDENTITY_LINK_REQUIRED'});
 putBudgetCell(f.parts,PLAN_SHEET_PART,cell,physicalNumericCell(cell,first.code,{attributes:' t="str"',formula:"'[remoto.xlsx]CyP Integral completo'!B9"}));await assert.rejects(read(f.parts),{code:'PLAN_IMPORT_MEASUREMENT_SOURCE_INVALID'});
});
test('XML row and cell coordinate mismatches are rejected by the existing provenance reader',async()=>{
 const f=budgetSourceFixtureParts();f.parts[BUDGET_SHEET_PART]=f.parts[BUDGET_SHEET_PART].replace(`<row r="${f.rows[0].budgetRow}">`,'<row r="999">');await assert.rejects(read(f.parts),{code:'PLAN_IMPORT_MEASUREMENT_SOURCE_INVALID'});
});
test('raw source units retain spelling case and trailing whitespace without conversion',async()=>{
 for(const unit of ['m2 ','M2','ml','Gl','meses ']){const{source}=await extraction({unit}),row=source.rows[0];assert.equal(row.originalRawUnit,unit);assert.equal(row.planRawUnit,unit);assert.equal(row.budget.cells.unit.value,unit);assert.equal(source.unitsConverted,false);}
});
test('a different Plan unit is an explicit mismatch rather than an automatic equivalence',async()=>{
 const f=budgetSourceFixtureParts({unit:'m2 '}),first=f.rows[0];putBudgetCell(f.parts,PLAN_SHEET_PART,'C'+first.planRow,physicalTextCell('C'+first.planRow,'m²'));const source=await read(f.parts);assert.equal(source.rows[0].originalRawUnit,'m2 ');assert.equal(source.rows[0].planRawUnit,'m²');assert.ok(source.rows[0].issues.includes('UNIT_LITERAL_MISMATCH'));
});
test('hidden columns merged cells and inherited numeric styles remain provenance facts',async()=>{
 const f=budgetSourceFixtureParts(),first=f.rows[0];f.parts[PLAN_SHEET_PART]=f.parts[PLAN_SHEET_PART].replace('<sheetData>','<cols><col min="4" max="6" hidden="1" style="0"/></cols><sheetData>');f.parts[BUDGET_SHEET_PART]=f.parts[BUDGET_SHEET_PART].replace('</worksheet>',`<mergeCells count="1"><mergeCell ref="H${first.budgetRow}:I${first.budgetRow}"/></mergeCells></worksheet>`);const source=await read(f.parts),row=source.rows[0];assert.equal(row.plan.cells.quantity.columnAttributes[0].hidden,'1');assert.equal(selectPlanBudgetSourceRow(source,binding(source)).plan.cells.quantity.style.source,'COLUMN');assert.deepEqual(row.budget.cells.unitPrice.mergedRanges,[`H${first.budgetRow}:I${first.budgetRow}`]);assert.equal(row.reviewRequired,true);
});
test('currency remains unknown despite a dollar symbol and an accounting number format',async()=>{
 const f=budgetSourceFixtureParts({priceBasis:'USD $ referencia sintética'}),cell='H'+f.rows[0].budgetRow;addPhysicalStyles(f.parts,{formatId:'164',formatCode:'$ #,##0.00'});putBudgetCell(f.parts,BUDGET_SHEET_PART,cell,physicalNumericCell(cell,'999.0000',{attributes:' s="1"',formula:'1+1'}));const source=await read(f.parts);assert.deepEqual(source.currency,{code:null,status:'UNKNOWN'});assert.equal(selectPlanBudgetSourceRow(source,binding(source)).budget.cells.unitPrice.style.formatCode,'$ #,##0.00');assert.equal(source.rows[0].observed.unitPrice.decimal,'999.0000');
});
test('month price basis and coefficient stay declared facts without calendar or price recalculation',async()=>{
 const f=budgetSourceFixtureParts({monthBase:'Marzo 2023',priceBasis:'$ Referencia sintética Enero 2023'});f.parts['xl/workbook.xml']=f.parts['xl/workbook.xml'].replace('<sheets>','<workbookPr date1904="1"/><sheets>');const source=await read(f.parts);assert.equal(source.monthBase.declaredText,'Marzo 2023');assert.equal(source.monthBase.interpretedDate,null);assert.equal(source.priceBasis.declaredText,'$ Referencia sintética Enero 2023');assert.equal(source.priceCoefficient.fact.rawValue,'1.0000');assert.equal(source.calendarDatesInferred,false);assert.equal(source.rows[0].observed.unitPrice.decimal,'999.0000');
});
test('a missing base month is explicit and never replaced with a current date',async()=>{
 const f=budgetSourceFixtureParts();putBudgetCell(f.parts,BUDGET_SHEET_PART,'N1','');const source=await read(f.parts);assert.equal(source.monthBase.declaredText,null);assert.ok(source.warnings.includes('BASE_MONTH_MISSING'));assert.equal(source.monthBase.interpretedDate,null);
});
test('stored physical amounts sum exactly while grouping and indirect controls remain separate',async()=>{
 const{source}=await extraction();assert.equal(source.sums.physicalLineAmounts.value,'6.2500');assert.equal(source.sums.physicalLineAmounts.count,2);assert.equal(source.sums.physicalLineAmounts.groupingAndControlCellsIncluded,false);assert.equal(source.sums.indirectStoredControls.value,'7.00');assert.equal(source.sums.indirectStoredControls.combinedWithPhysicalLines,false);assert.ok(source.controlCells.some(cell=>cell.address==='O300'&&cell.fact.rawValue==='9999.00'));assert.ok(source.rows.every(row=>row.observed.lineAmount.decimal!==row.observed.quantity.decimal));
});
test('nested indirect control amounts require review instead of being double counted',async()=>{
 const f=budgetSourceFixtureParts(),row=f.budgetCodes.get('H.1');putBudgetCell(f.parts,BUDGET_SHEET_PART,'L'+row,physicalNumericCell('L'+row,'1.00'));const source=await read(f.parts);assert.equal(source.sums.indirectStoredControls.value,null);assert.ok(source.sums.indirectStoredControls.issues.includes('NESTED_MONETARY_CONTROLS_REQUIRE_REVIEW'));assert.equal(source.sums.physicalLineAmounts.value,'6.2500');
});
test('an unresolved indirect control cache never becomes a zero amount',async()=>{
 const f=budgetSourceFixtureParts(),row=f.budgetCodes.get('H');putBudgetCell(f.parts,BUDGET_SHEET_PART,'L'+row,physicalNumericCell('L'+row,null,{formula:'1+1'}));const source=await read(f.parts);assert.equal(source.sums.indirectStoredControls.complete,false);assert.equal(source.sums.indirectStoredControls.value,null);
});
test('unsafe or unsupported source formulas remain data and are not executed',async()=>{
 const f=budgetSourceFixtureParts(),cell='H'+f.rows[0].budgetRow;putBudgetCell(f.parts,BUDGET_SHEET_PART,cell,physicalNumericCell(cell,'7.00',{formula:'WEBSERVICE("https://example.invalid/never")'}));const source=await read(f.parts);assert.match(source.rows[0].budget.cells.unitPrice.formulaText,/WEBSERVICE/);assert.equal(source.rows[0].observed.unitPrice.decimal,null);assert.equal(source.formulasEvaluated,false);assert.equal(source.macrosExecuted,false);
});
test('a supplied file hash mismatch fails before a budget projection can be returned',async()=>{
 const f=budgetSourceFixtureParts(),bytes=zipOoxmlFixture(f.parts);await assert.rejects(extractPlanBudgetSource(bytes,mime,{sourceSha256:'f'.repeat(64)}),{code:'PLAN_IMPORT_BUDGET_SOURCE_SHA_MISMATCH',status:400});
});
test('exact digest and code row sheet bindings reject tampered or foreign projections',async()=>{
 const{source}=await extraction(),expected=binding(source);assert.equal(selectPlanBudgetSourceRow(source,expected).code,source.rows[0].code);
 for(const change of [{budgetRow:'999'},{planRow:'999'},{budgetWorksheet:'Otra hoja'},{sourceSha256:'f'.repeat(64)},{sourceDigest:'f'.repeat(64)},{code:'B.1.99.99'}])assert.throws(()=>selectPlanBudgetSourceRow(source,{...expected,...change}),{code:'PLAN_IMPORT_BUDGET_BINDING_MISMATCH',status:409});
 const tampered=structuredClone(source);tampered.rows[0].budget.cells.unitPrice.rawValue='1';assert.notEqual(planBudgetSourceDigest(tampered),source.sourceDigest);assert.throws(()=>selectPlanBudgetSourceRow(tampered,expected),{code:'PLAN_IMPORT_BUDGET_BINDING_MISMATCH'});
});
test('the physical source contract and legacy CyP analysis stay identical after budget reading',async()=>{
 const f=budgetSourceFixtureParts(),bytes=zipOoxmlFixture(f.parts),before=await extractPlanMeasurementSource(bytes,mime),legacy=await extractCypPlanOoxml(bytes,mime),raw=await readPlanMeasurementOoxml(bytes,mime);const source=await extractPlanBudgetSource(bytes,mime);assert.deepEqual(await extractPlanMeasurementSource(bytes,mime),before);assert.deepEqual(await extractCypPlanOoxml(bytes,mime),legacy);assert.deepEqual(await readPlanMeasurementOoxml(bytes,mime),raw);assert.equal(source.measurementSourceDigest,planMeasurementSourceDigest(before));assert.ok(raw.worksheets[1].cells.every(cell=>/^[BC]\d+$/.test(cell.address)));assert.ok((await readPlanBudgetOoxml(bytes,mime)).worksheets[1].cells.some(cell=>/^H\d+$/.test(cell.address)));
});
test('two hundred items are complete and two hundred one are rejected without truncation',async()=>{
 assert.equal((await extraction({partidas:200})).source.rows.length,200);const f=budgetSourceFixtureParts({partidas:201});await assert.rejects(read(f.parts),{code:'PLAN_IMPORT_MEASUREMENT_SOURCE_TOO_LARGE',status:413});
});
test('oversized files and oversized provenance DTOs fail without returning partial items',async()=>{
 await assert.rejects(extractPlanBudgetSource(Buffer.alloc(PLAN_OOXML_LIMITS.fileBytes+1),mime),{code:'PLAN_IMPORT_BUDGET_SOURCE_INVALID'});const f=budgetSourceFixtureParts({partidas:190});for(const row of f.rows)putBudgetCell(f.parts,BUDGET_SHEET_PART,'H'+row.budgetRow,physicalNumericCell('H'+row.budgetRow,'1.00',{formula:'1+'.repeat(4000)+'1'}));await assert.rejects(read(f.parts),{code:'PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',status:413});
});
test('the complete DTO byte limit includes its digest field at the exact boundary',async()=>{
 const{source}=await extraction(),atLimit=structuredClone(source);atLimit.padding='';const existing=Buffer.byteLength(JSON.stringify(atLimit));atLimit.padding='x'.repeat(PLAN_BUDGET_SOURCE_LIMITS.proofBytes-existing);assert.equal(Buffer.byteLength(JSON.stringify(atLimit)),PLAN_BUDGET_SOURCE_LIMITS.proofBytes);assert.match(planBudgetSourceDigest(atLimit),/^[a-f0-9]{64}$/);
 atLimit.padding+='x';assert.equal(Buffer.byteLength(JSON.stringify(atLimit)),PLAN_BUDGET_SOURCE_LIMITS.proofBytes+1);assert.throws(()=>planBudgetSourceDigest(atLimit),{code:'PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',status:413});
});
test('budget observations are frozen and source bytes remain untouched',async()=>{
 const{source,bytes}=await extraction(),before=sha(bytes);assert.ok(Object.isFrozen(source));assert.ok(Object.isFrozen(source.rows[0].budget.cells.unitPrice));assert.throws(()=>{source.rows[0].observed.unitPrice.decimal='0';},TypeError);assert.equal(sha(bytes),before);assert.equal(source.sourceDigest,planBudgetSourceDigest(source));
});

// These helpers build adversarial data and independent byte/evidence oracles.
const canonicalTest=value=>Array.isArray(value)?value.map(canonicalTest):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalTest(value[key])])):value;
const styleHashTest=style=>sha(JSON.stringify(canonicalTest(style)));
function eachFactTest(value,visit){if(Array.isArray(value)){value.forEach(item=>eachFactTest(item,visit));return;}if(!value||typeof value!=='object')return;if(typeof value.address==='string'&&typeof value.present==='boolean'&&typeof value.cachePresent==='boolean')visit(value);Object.values(value).forEach(item=>eachFactTest(item,visit));}
const nodeCountTest=value=>1+(Array.isArray(value)?value.reduce((sum,item)=>sum+nodeCountTest(item),0):value&&typeof value==='object'?Object.values(value).reduce((sum,item)=>sum+nodeCountTest(item),0):0);

test('style references explicitly serialize under V2 and survive JSON round trips',async()=>{
 const{source}=await extraction(),decoded=JSON.parse(JSON.stringify(source));assert.equal(source.version,2);assert.equal(source.profile,'SOURCE_BUDGET_CYP_V2');assert.ok(Object.keys(source.styleTable).length);assert.equal(Object.hasOwn(source.rows[0].budget.cells.quantity,'style'),false);assert.match(source.rows[0].budget.cells.quantity.styleRef,/^[a-f0-9]{64}$/);assert.equal(planBudgetSourceDigest(decoded),source.sourceDigest);assert.deepEqual(selectPlanBudgetSourceRow(decoded,binding(source)),selectPlanBudgetSourceRow(source,binding(source)));
});
test('every selected cell reconstructs its complete original OOXML evidence',async()=>{
 const{source,bytes}=await extraction(),raw=await readPlanBudgetOoxml(bytes,mime),sheets=new Map(raw.worksheets.map(sheet=>[sheet.name,new Map(sheet.cells.map(cell=>[cell.address,cell]))]));
 for(const item of source.rows){const row=selectPlanBudgetSourceRow(source,binding(source,item));for(const side of ['budget','plan'])for(const fact of Object.values(row[side].cells)){assert.deepEqual(fact,sheets.get(row[side].worksheet).get(fact.address));assert.equal(Object.hasOwn(fact,'styleRef'),false);}}
});
test('style identity distinguishes DEFAULT CELL and COLUMN despite the same index',async()=>{
 const f=budgetSourceFixtureParts(),first=f.rows[0];putBudgetCell(f.parts,BUDGET_SHEET_PART,'H'+first.budgetRow,physicalNumericCell('H'+first.budgetRow,first.unitPrice,{attributes:' s="0"',formula:'1+1'}));f.parts[PLAN_SHEET_PART]=f.parts[PLAN_SHEET_PART].replace('<sheetData>','<cols><col min="4" max="6" hidden="1" style="0"/></cols><sheetData>');const source=await read(f.parts),row=source.rows[0],selected=selectPlanBudgetSourceRow(source,binding(source));const facts=[row.budget.cells.quantity,row.budget.cells.unitPrice,row.plan.cells.quantity];assert.equal(new Set(facts.map(fact=>fact.styleRef)).size,3);assert.deepEqual([selected.budget.cells.quantity.style.source,selected.budget.cells.unitPrice.style.source,selected.plan.cells.quantity.style.source],['DEFAULT','CELL','COLUMN']);assert.ok([selected.budget.cells.quantity,selected.budget.cells.unitPrice,selected.plan.cells.quantity].every(fact=>fact.style.index==='0'));assert.equal(selected.plan.cells.quantity.columnAttributes[0].hidden,'1');
});
test('only styles are interned and shared masters observed targets and hidden attrs remain exact',async()=>{
 const f=budgetSourceFixtureParts(),first=f.rows[0];sharedPlanReference(f.parts,f.rows);putBudgetCell(f.parts,PLAN_SHEET_PART,'D'+first.planRow,physicalNumericCell('D'+first.planRow,null,{formula:"'CyP Integral completo'!M76"}));putBudgetCell(f.parts,BUDGET_SHEET_PART,'M76',physicalNumericCell('M76',null,{attributes:' s="0"',formula:'1+1'}));const source=await read(f.parts),selected=selectPlanBudgetSourceRow(source,binding(source)),raw=await readPlanBudgetOoxml(zipOoxmlFixture(f.parts),mime),original=raw.worksheets.find(sheet=>sheet.name==='CyP Integral completo').cells.find(cell=>cell.address==='M76');assert.deepEqual(selected.plan.links.quantity.observedTarget,original);assert.equal(selected.plan.links.quantity.observation.decimal,null);assert.equal(selected.observed.quantity.decimal,first.quantity);const second=selectPlanBudgetSourceRow(source,binding(source,source.rows[1]));assert.equal(second.plan.cells.unitPrice.sharedFormulaMaster.address,'E'+first.planRow);assert.equal(second.plan.links.unitPrice.referenceMatches,true);assert.equal(source.formulasEvaluated,false);
});
test('style measurements match an independently serialized small raw envelope',async()=>{
 const{source}=await extraction(),raw=structuredClone(source);delete raw.styleTable;eachFactTest(raw,fact=>{fact.style=structuredClone(source.styleTable[fact.styleRef]);delete fact.styleRef;});const stats=planBudgetStyleEvidenceSize(source);assert.equal(stats.unpackedEnvelopeBytes,Buffer.byteLength(JSON.stringify(raw)));assert.equal(stats.packedEnvelopeBytes,Buffer.byteLength(JSON.stringify(source)));assert.equal(stats.savedBytes,stats.unpackedEnvelopeBytes-stats.packedEnvelopeBytes);let count=0;eachFactTest(source,()=>count++);assert.equal(stats.styleFactCount,count);assert.equal(stats.uniqueStyleCount,Object.keys(source.styleTable).length);assert.ok(Object.values(stats).every(Number.isSafeInteger));assert.ok(Object.isFrozen(stats));
});
test('repeated long style evidence saves bytes without shortening any format string',async()=>{
 const f=budgetSourceFixtureParts({partidas:190}),format='x'.repeat(490);addPhysicalStyles(f.parts,{formatId:'164',formatCode:format});for(const row of f.rows)putBudgetCell(f.parts,BUDGET_SHEET_PART,'H'+row.budgetRow,physicalNumericCell('H'+row.budgetRow,row.unitPrice,{attributes:' s="1"',formula:'1+1'}));const source=await read(f.parts),stats=planBudgetStyleEvidenceSize(source);assert.equal(source.rows.length,190);assert.ok(stats.styleFactCount>=2280);assert.ok(stats.savedBytes>55372);for(const row of source.rows)assert.equal(selectPlanBudgetSourceRow(source,binding(source,row)).budget.cells.unitPrice.style.formatCode,format);assert.ok(stats.packedEnvelopeBytes<=PLAN_BUDGET_SOURCE_LIMITS.proofBytes);
});
test('dangling style refs missing pool entries and unused entries are rejected',async()=>{
 const{source}=await extraction();for(const change of ['dangling','missing','unused']){const altered=structuredClone(source),id=altered.rows[0].budget.cells.quantity.styleRef;if(change==='dangling')altered.rows[0].budget.cells.quantity.styleRef='f'.repeat(64);if(change==='missing')delete altered.styleTable[id];if(change==='unused'){const style=structuredClone(altered.styleTable[id]);style.source='UNUSED_SYNTHETIC';altered.styleTable[styleHashTest(style)]=style;}assert.throws(()=>planBudgetSourceDigest(altered),{code:'PLAN_IMPORT_BUDGET_SOURCE_INVALID',status:400});}
});
test('style body tampering cannot retain its content id or trusted source digest',async()=>{
 const{source}=await extraction(),expected=binding(source),altered=structuredClone(source),id=altered.rows[0].budget.cells.quantity.styleRef;altered.styleTable[id].formatCode='tampered';assert.throws(()=>planBudgetSourceDigest(altered),{code:'PLAN_IMPORT_BUDGET_SOURCE_INVALID',status:400});assert.throws(()=>selectPlanBudgetSourceRow(altered,expected),{code:'PLAN_IMPORT_BUDGET_SOURCE_INVALID',status:400});
});
test('co-tampered styles refs and recomputed digest still fail a trusted caller binding',async()=>{
 const{source}=await extraction(),expected=binding(source),altered=structuredClone(source),old=altered.rows[0].budget.cells.quantity.styleRef,style=structuredClone(altered.styleTable[old]);style.formatCode='tampered';const id=styleHashTest(style);delete altered.styleTable[old];altered.styleTable[id]=style;eachFactTest(altered,fact=>{if(fact.styleRef===old)fact.styleRef=id;});altered.sourceDigest=planBudgetSourceDigest(altered);assert.notEqual(altered.sourceDigest,source.sourceDigest);assert.throws(()=>selectPlanBudgetSourceRow(altered,expected),{code:'PLAN_IMPORT_BUDGET_BINDING_MISMATCH',status:409});
});
test('cyclic compact input fails at the canonical depth guard before style traversal',async()=>{
 const{source}=await extraction(),altered=structuredClone(source);altered.cycle=altered;assert.throws(()=>planBudgetSourceDigest(altered),{code:'PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',status:413});
});
test('excessively deep compact input fails before unpacking styles',async()=>{
 const{source}=await extraction(),altered=structuredClone(source);let node=altered;for(let index=0;index<70;index++){node.padding={};node=node.padding;}assert.throws(()=>planBudgetSourceDigest(altered),{code:'PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',status:413});
});
test('a small style dictionary cannot amplify expansion beyond the original node cap',async()=>{
 const{source}=await extraction({partidas:190}),altered=structuredClone(source),style=structuredClone(Object.values(altered.styleTable)[0]);style.attributes=Object.fromEntries(Array.from({length:1000},(_,index)=>['synthetic'+index,'x']));const id=styleHashTest(style);altered.styleTable={[id]:style};let facts=0;eachFactTest(altered,fact=>{fact.styleRef=id;facts++;});assert.ok(Buffer.byteLength(JSON.stringify(altered))<PLAN_BUDGET_SOURCE_LIMITS.proofBytes);assert.ok(nodeCountTest(altered)<PLAN_OOXML_LIMITS.nodes);assert.ok(facts*Object.keys(style.attributes).length>PLAN_OOXML_LIMITS.nodes);assert.throws(()=>planBudgetSourceDigest(altered),{code:'PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE',status:413});
});
test('selected style evidence is copied and frozen without mutating dictionary or bytes',async()=>{
 const{source,bytes}=await extraction(),before=sha(bytes),row=selectPlanBudgetSourceRow(source,binding(source)),pool=source.styleTable[source.rows[0].budget.cells.quantity.styleRef];assert.notEqual(row.budget.cells.quantity.style,pool);assert.ok(Object.isFrozen(row.budget.cells.quantity.style));assert.throws(()=>{row.budget.cells.quantity.style.formatCode='changed';},TypeError);assert.equal(sha(bytes),before);assert.equal(source.sourceDigest,planBudgetSourceDigest(source));
});
