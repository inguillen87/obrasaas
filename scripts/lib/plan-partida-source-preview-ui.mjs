import assert from 'node:assert/strict';

// Called by the existing local-only importer harness after its real synthetic
// extraction/recovery has reached READY. This helper does not create a page,
// intercept an API, inject a component, or send a command.
export async function verifyPlanPartidaSourcePreview({page,spreadsheet,width,mode,measurement,readEffects}){
 const root='[data-plan-partida-preview]',before=structuredClone(readEffects()),last=spreadsheet.items.at(-1);
 await page.waitForSelector(root);assert.equal(await page.$$eval(root+' [data-partida-selection] option',rows=>rows.length),spreadsheet.rowCount);
 assert.equal(await page.$eval(root,element=>element.dataset.sourceSha.length),64);
 await page.select(root+' [data-partida-selection]',last.code);
 for(const tab of ['DIAGRAM','CURVE','QUANTITIES']){
  await page.click(root+' [data-partida-view="'+tab+'"]');
  await page.waitForFunction(({root,tab})=>document.querySelector(root+' [data-partida-view="'+tab+'"]')?.getAttribute('aria-pressed')==='true',{}, {root,tab});
  assert.equal(await page.$eval(root,element=>element.dataset.selectedCode),last.code);
 }
 await page.waitForFunction(({root,status})=>document.querySelector(root+' [data-partida-measurement-status]')?.dataset.partidaMeasurementStatus===status,{}, {root,status:measurement.status});
 if(measurement.status==='BOUND'){
  const row=measurement.source.rows.find(row=>row.code===last.code),literal=cell=>['s','inlineStr','str'].includes(cell.type)&&typeof cell.value==='string'?cell.value:cell.rawValue;
  assert.equal(await page.$eval(root+' [data-partida-quantity]',element=>element.textContent),literal(row.quantity)??'Sin cantidad legible');assert.equal(await page.$eval(root+' [data-partida-unit]',element=>element.textContent),row.unit.value??row.unit.rawValue??'Sin unidad legible');
  assert.equal(await page.$eval(root+' [data-partida-measurement-range]',element=>element.textContent),row.sourceRowId);assert.deepEqual(await page.$$eval(root+' [data-measurement-issue]',nodes=>nodes.map(node=>node.dataset.measurementIssue)),row.candidate.issues);
 }else{assert.ok(await page.$(root+' [data-partida-measurement-unavailable]'));assert.equal(await page.$(root+' [data-partida-quantity]'),null);}
 assert.equal(await page.$eval(root+' [data-measurement-flow]',element=>element.getAttribute('href')),'#plan-measurement');
 assert.equal(await page.$(root+' input'),null);assert.equal(await page.$(root+' textarea'),null);
 await page.click(root+' [data-partida-view="DIAGRAM"]');
 const cells=await page.$$eval(root+' [data-source-week]',nodes=>nodes.map(node=>({ordinal:Number(node.dataset.sourceWeek),label:node.querySelector('span').textContent})));
 assert.equal(cells.length,48);assert.deepEqual(cells.map(cell=>cell.ordinal),Array.from({length:48},(_,index)=>index+1));
 for(let index=0;index<48;index++){
  const value=last.ordinalDistribution[index],expected=value===null?'Sin dato':new Intl.NumberFormat('es-AR',{style:'percent',maximumFractionDigits:10}).format(value);assert.equal(cells[index].label,expected);
 }
 await page.select(root+' [data-partida-group]',last.parentCode);
 await page.waitForFunction(({root,count})=>document.querySelectorAll(root+' [data-partida-selection] option').length===count,{}, {root,count:spreadsheet.items.filter(row=>row.code.startsWith(last.parentCode+'.')).length});
 assert.equal(await page.$eval(root,element=>element.dataset.selectedCode),last.code);
 assert.equal(await page.$$eval(root+' [data-partida-selection] option',nodes=>nodes.length),spreadsheet.items.filter(row=>row.code.startsWith(last.parentCode+'.')).length);
 await page.click(root+' [data-partida-view="CURVE"]');
 if(spreadsheet.version===4){
  assert.equal(await page.$$eval(root+' [aria-label="Tabla completa de inversión prevista"] tbody tr',rows=>rows.length),12);
  const evidence=root+' [data-source-curve-evidence]';assert.equal(await page.$eval(evidence,node=>node.open),false);await page.click(evidence+' summary');
  assert.match(await page.$eval(root,element=>element.innerText),new RegExp('Fuente original: '+spreadsheet.rowCount+' partidas físicas'));
  await page.click(evidence+' summary');assert.equal(await page.$eval(evidence,node=>node.open),false);
 }else assert.ok(await page.$(root+' [data-partida-curve-unavailable]'));
 await page.select(root+' [data-partida-group]','');
 await page.waitForFunction(({root,count})=>document.querySelectorAll(root+' [data-partida-selection] option').length===count,{}, {root,count:spreadsheet.rowCount});
 await page.select(root+' [data-partida-selection]',spreadsheet.items[0].code);
 await page.waitForFunction(({root,code})=>document.querySelector(root)?.dataset.selectedCode===code,{}, {root,code:spreadsheet.items[0].code});
 await page.click(root+' [data-partida-view="'+(spreadsheet.version===4?'CURVE':'DIAGRAM')+'"]');
 assert.deepEqual(readEffects(),before,'Read-only navigation must not POST, analyze, apply or recover an operation');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Source preview must not overflow the page');
 const hitTargets=await page.$$eval(root+' button:not(:disabled),'+root+' select:not(:disabled)',nodes=>nodes.map(node=>node.getBoundingClientRect().height));assert.ok(hitTargets.every(height=>height>=44));
 return {width,mode,profile:spreadsheet.profile,partidas:spreadsheet.rowCount,commonSelectionAcrossThreeViews:true,ordinal48Preserved:true,measurementBindingStatus:measurement.status,literalQuantityUnitChecked:measurement.status==='BOUND',ambiguityAndMissingExplicit:measurement.status!=='BOUND',fullCurveScopePreserved:true,groupDoesNotChangeSource:true,noNavigationEffects:true,horizontalOverflow:false,minimumTargetHeight:44};
}
