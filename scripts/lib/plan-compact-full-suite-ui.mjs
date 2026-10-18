import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {formatSourceCurveDecimal,planSourceCurveView} from '../../src/app/(identity)/cuenta/plan-source-curve.mjs';

const root='[data-plan-partida-preview]',curve=root+' [data-source-curve-compact="true"]',evidence=curve+' [data-source-curve-evidence]';
const fields=['monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage'];
const label=(cell,percentage=false)=>formatSourceCurveDecimal(cell.cachedValue,{percentage});

// Same source-count assertion as the original CyP case, through its actual
// disclosure. Restore the initial state; do not inject markup or reveal via JS.
export async function assertCompactCypCounts(page,sourceCount,selectedCount){
 const initialTab=await page.$eval(root+' [data-partida-view][aria-pressed="true"]',node=>node.dataset.partidaView);
 if(initialTab!=='CURVE')await page.click(root+' [data-partida-view="CURVE"]');
 const wasOpen=await page.$eval(evidence,node=>node.open);
 if(!wasOpen)await page.click(evidence+' > summary');
 assert.equal(await page.$eval(evidence,node=>node.open),true);
 const text=await page.$eval(evidence,node=>node.innerText);
 assert.ok(text.includes('Fuente original: '+sourceCount+' partidas físicas. Tareas elegidas: '+selectedCount+'.'));
 assert.ok(text.includes('sin recalcular fórmulas ni ajustar la curva por las tareas elegidas'));
 if(!wasOpen)await page.click(evidence+' > summary');
 assert.equal(await page.$eval(evidence,node=>node.open),wasOpen);
 if(initialTab!=='CURVE')await page.click(root+' [data-partida-view="'+initialTab+'"]');
}

// The compact product deliberately replaced SVG/button interactions with a
// native select. Exercise keyboard input, then correlate all three views of
// the selected month: selector, rendered detail/summary and SVG selected point.
export async function verifyCompactCypKeyboard(page,source){
 const selector=curve+' [data-source-curve-month]',view=planSourceCurveView(source,{profile:'CYP_PARTIDAS_CURVE'});
 const initial=await page.$eval(root,node=>({code:node.dataset.selectedCode,sha:node.dataset.sourceSha}));
 assert.equal(await page.$$eval(selector+' option',nodes=>nodes.length),12);
 const check=async index=>{
  await page.waitForFunction(({selector,index})=>document.querySelector(selector)?.value===String(index),{}, {selector,index});
  const period=view.periods[index],point=view.points[index];
  assert.equal(await page.$eval(selector,node=>node.value),String(index));
  const detail=await page.$eval(curve+' [aria-label="Valores previstos del mes '+(index+1)+'"]',node=>node.innerText);
  assert.ok(detail.includes('Acumulado al mes '+(index+1)+':'));
  assert.ok(detail.includes(label(period.cumulativePercentage,true)));
  assert.deepEqual(await page.$$eval(curve+' dl > div',nodes=>nodes.map(node=>[node.querySelector('dt').textContent,node.querySelector('dd').textContent])),[['Total del archivo',label(view.total)],['Mes '+(index+1)+' · previsto',label(period.monthlyAmount)]]);
  const selected=await page.$$eval(curve+' svg circle[r="7"]',nodes=>nodes.map(node=>({x:Number(node.getAttribute('cx')),y:Number(node.getAttribute('cy'))})));
  assert.deepEqual(selected,point.y===null?[]:[{x:point.x,y:point.y}]);
  const row=await page.$$eval(curve+' [aria-label="Tabla completa de inversión prevista"] tbody tr',(nodes,index)=>[...nodes[index].querySelectorAll('td')].map(node=>node.textContent),index);
  assert.deepEqual(row,fields.map(field=>label(period[field],field.endsWith('Percentage'))));
  assert.deepEqual(await page.$eval(root,node=>({code:node.dataset.selectedCode,sha:node.dataset.sourceSha})),initial);
 };
 await page.focus(selector);
 for(const [key,index] of [['End',11],['ArrowUp',10],['Home',0],['ArrowDown',1]]){await page.keyboard.press(key);await check(index);}
 await page.keyboard.press('Home');await check(0);
 for(let index=1;index<=7;index++){await page.keyboard.press('ArrowDown');await check(index);}
 assert.ok(await page.$eval(selector,node=>node.getBoundingClientRect().height>=44));
 return {interaction:'NATIVE_SELECT_KEYBOARD',monthsChecked:[12,11,1,2,1,2,3,4,5,6,7,8],detailSummaryPointAndTableAssociated:true,sourceAndSelectionPreserved:true,svgPointerInteraction:false};
}

// Supplementary evidence, outside the original180 count. All twelve formatted
// rows are checked against the same real extractor output. Open/read/scroll/
// capture/close via actual controls, retaining the draft/partida and no effects.
export async function verifyOpenCypMonthlyTable({page,source,width,mode,readEffects,captureDirectory}){
 const before=structuredClone(readEffects()),initial=await page.$eval(root,node=>({code:node.dataset.selectedCode,sha:node.dataset.sourceSha})),detail=curve+' [data-source-curve-month-table]',region=detail+' [aria-label="Tabla completa de inversión prevista"]';
 assert.equal(mode,'cyp-curve-review');assert.equal(await page.$eval(detail,node=>node.open),false);
 const sourceSha=initial.sha,summary=await page.$(detail+' > summary');assert.ok(summary);await summary.click();await summary.dispose();
 assert.equal(await page.$eval(detail,node=>node.open),true);
 const view=planSourceCurveView(source,{profile:'CYP_PARTIDAS_CURVE'}),expected=view.periods.map(period=>['Mes '+period.ordinal,...fields.map(field=>label(period[field],field.endsWith('Percentage')))]);
 assert.deepEqual(await page.$$eval(region+' tbody tr',nodes=>nodes.map(node=>[...node.querySelectorAll('th,td')].map(cell=>cell.innerText))),expected);
 assert.equal(await page.$$eval(region+' thead th',nodes=>nodes.length),5);
 const metrics=await page.$eval(region,node=>{
  const rect=node.getBoundingClientRect(),style=getComputedStyle(node),cells=[...node.querySelectorAll('caption,th,td')];
  return {left:rect.left,right:rect.right,width:rect.width,height:rect.height,overflowX:style.overflowX,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,minFont:Math.min(...cells.map(cell=>Number.parseFloat(getComputedStyle(cell).fontSize))),allCellsNonzero:cells.every(cell=>{const box=cell.getBoundingClientRect();return box.width>0&&box.height>0;}),summaryHeight:node.parentElement.querySelector('summary').getBoundingClientRect().height};
 });
 assert.ok(metrics.width>0&&metrics.height>0&&metrics.left>=0&&metrics.right<=width+1);
 assert.ok(['auto','scroll'].includes(metrics.overflowX));assert.ok(metrics.minFont>=12&&metrics.allCellsNonzero&&metrics.summaryHeight>=44);
 const scroll=await page.$eval(region,node=>{node.scrollLeft=node.scrollWidth;const last=node.querySelector('thead th:last-child').getBoundingClientRect(),box=node.getBoundingClientRect();return {left:node.scrollLeft,maximum:node.scrollWidth-node.clientWidth,lastVisible:last.left<box.right&&last.right>box.left};});
 assert.ok(scroll.maximum<=1||scroll.left>0);assert.equal(scroll.lastVisible,true);
 await page.$eval(region,node=>{node.scrollLeft=0;});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 fs.mkdirSync(captureDirectory,{recursive:true});const file=path.join(captureDirectory,'curve-table-open-'+width+'.png'),element=await page.$(detail);await element.screenshot({path:file});await element.dispose();
 const bytes=fs.readFileSync(file);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 await page.click(detail+' > summary');assert.equal(await page.$eval(detail,node=>node.open),false);
 assert.deepEqual(await page.$eval(root,node=>({code:node.dataset.selectedCode,sha:node.dataset.sourceSha})),initial);assert.deepEqual(readEffects(),before);
 return {width,mode,rows:12,columns:5,exactSourceValues:true,sourceSha256:sourceSha,selectedCode:initial.code,minimumFontSize:metrics.minFont,localScroller:true,scrollRightChecked:true,lastColumnVisibleAtRight:scroll.lastVisible,externalOverflow:false,disclosureOpenedAndClosed:true,sourceAndSelectionPreserved:true,noNavigationEffects:true,metrics,screenshot:{path:file,sha256:createHash('sha256').update(bytes).digest('hex'),pngWidth:bytes.readUInt32BE(16),pngHeight:bytes.readUInt32BE(20)},captureLimit:'One unscaled open disclosure at its left scroll position; right edge verified by geometry, not separately captured.'};
}
