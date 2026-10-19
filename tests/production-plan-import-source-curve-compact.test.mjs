import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {extractCypCurveOoxml} from '../src/lib/plan-import-ooxml.mjs';
import {cypCurveFixture} from './fixtures/plan-import-cyp-curve-synthetic.mjs';
import {formatSourceCurveDecimal} from '../src/app/(identity)/cuenta/plan-source-curve.mjs';

// Local component regression, not a browser, authorization or acceptance proof.
await loadBindings();
const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href;
const sourcePath=new URL('../src/app/(identity)/cuenta/plan-source-curve.js',import.meta.url);
const source=readFileSync(sourcePath,'utf8').replace(/^import .*;\r?\n/gm,'');
const helper=new URL('../src/app/(identity)/cuenta/plan-source-curve.mjs',import.meta.url).href;
const imports=`import React from ${JSON.stringify(reactUrl)};import {formatSourceCurveDecimal,planSourceCurveView,sourceCurveKeyboardIndex,planDocumentCurveView,documentCurveKeyboardIndex,documentCurvePlot,DOCUMENT_CURVE_PROFILE,PLAN_CYP_INVESTMENT_PROFILE,planInvestmentCurveView,investmentWeeklyPlot,investmentWeekKeyboardIndex} from ${JSON.stringify(helper)};const styles=new Proxy({},{get:(_target,key)=>String(key)});`;
const compile=async(prefix,suffix='')=>{const output=await transform(imports+prefix+source+suffix,{filename:'plan-source-curve.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});return import('data:text/javascript;base64,'+Buffer.from(output.code).toString('base64'));};
const {PlanSourceCurve}=await compile(`import {useEffect,useId,useRef,useState} from ${JSON.stringify(reactUrl)};`);
const hooks=await compile('let selected=0;const useEffect=()=>{},useId=()=>"compact-unit",useRef=()=>({current:[]}),useState=()=>[selected,value=>{selected=value;}];','export const render=props=>PlanSourceCurve(props);export const reset=()=>{selected=0;};');
const sourceValue=(await extractCypCurveOoxml(cypCurveFixture({initial:'0.0000'}),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).spreadsheet.curve;
const render=(props={})=>renderToStaticMarkup(React.createElement(PlanSourceCurve,{curve:sourceValue,status:'READY',profile:'CYP_PARTIDAS_CURVE',sourceRowCount:190,selectedRowCount:190,...props}));
const tables=html=>html.match(/<table[^>]*>[\s\S]*?<\/table>/g);
const controls=html=>html.match(/<button[^>]*>[\s\S]*?<\/button>/g);
const points=html=>[...html.matchAll(/<polyline[^>]+points="([^"]+)"/g)].map(match=>match[1]);
const elements=(node,predicate,result=[])=>{if(!node||typeof node!=='object')return result;if(Array.isArray(node)){for(const child of node)elements(child,predicate,result);return result;}if(predicate(node))result.push(node);elements(node.props?.children,predicate,result);return result;};

test('compact omitted and explicit false retain identical default CYP rendering',()=>{
 const omitted=render(),explicit=render({compact:false});assert.equal(omitted,explicit);assert.equal((omitted.match(/>Mes \d+<\/button>/g)||[]).length,12);assert.doesNotMatch(omitted,/data-source-curve-compact="true"/);assert.equal(tables(omitted).length,2);
});
test('baseline remains folded without becoming the new compact layout',()=>{
 const normal=render(),baseline=render({presentation:'baseline'}),explicit=render({presentation:'baseline',compact:false});assert.equal(baseline,explicit);assert.deepEqual(tables(baseline),tables(normal));assert.deepEqual(controls(baseline),controls(normal));assert.deepEqual(points(baseline),points(normal));assert.match(baseline,/Tabla de inversión de todos los meses/);assert.doesNotMatch(baseline,/data-source-curve-compact="true"/);
});
test('CYP compact renders native twelve-month selector and initially closed complete tables',()=>{
 const html=render({compact:true});assert.match(html,/data-source-curve-compact="true"/);assert.equal((html.match(/<option /g)||[]).length,12);assert.equal((html.match(/>Mes \d+<\/button>/g)||[]).length,0);assert.match(html,/<details[^>]*data-source-curve-month-table="true"[^>]*><summary>Ver los 12 meses originales/);assert.match(html,/<details[^>]*data-source-curve-evidence="true"/);assert.doesNotMatch(html,/<details[^>]*\bopen(?:=|\s|>)/);assert.equal(tables(html).length,2);
});
test('compact preserves all twelve monthly rows and fifty literal provenance references',()=>{
 const before=structuredClone(sourceValue),html=render({compact:true}),normal=render();assert.deepEqual(tables(html),tables(normal));assert.equal((tables(html)[0].match(/<th scope="row">Mes \d+<\/th>/g)||[]).length,12);assert.equal((tables(html)[1].match(/<tr>/g)||[]).length,51);assert.deepEqual(sourceValue,before);
 for(const month of sourceValue.periods)for(const field of ['monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage']){const cell=month[field];assert.ok(html.includes(cell.sourceCell));assert.ok(html.includes(cell.cachedValue??'Sin dato'));}
});
test('compact keeps total and current month exact instead of deriving a partida amount',()=>{
 const html=render({compact:true});assert.ok(html.includes(formatSourceCurveDecimal(sourceValue.total.cachedValue)));assert.ok(html.includes(formatSourceCurveDecimal(sourceValue.periods[0].monthlyAmount.cachedValue)));assert.ok(html.includes(formatSourceCurveDecimal(sourceValue.periods[0].cumulativePercentage.cachedValue,{percentage:true})));assert.match(html,/Total del archivo/);assert.match(html,/Mes 1 · previsto/);assert.match(html,/Moneda por confirmar/);assert.match(html,/no acredita gastos ni avance ejecutado/);assert.doesNotMatch(html,/ARS|USD|precio por partida|avance real/i);
});
test('real compact select handler reaches month twelve without mutating the source',()=>{
 hooks.reset();const before=structuredClone(sourceValue);let tree=hooks.render({curve:sourceValue,profile:'CYP_PARTIDAS_CURVE',compact:true});const select=elements(tree,node=>node.type==='select')[0];assert.ok(select);select.props.onChange({target:{value:'11'}});tree=hooks.render({curve:sourceValue,profile:'CYP_PARTIDAS_CURVE',compact:true});assert.equal(elements(tree,node=>node.props?.['aria-label']==='Valores previstos del mes 12').length,1);assert.equal(elements(tree,node=>node.type==='select')[0].props.value,11);assert.deepEqual(sourceValue,before);
});
test('compact plot preserves missing data breaks and explicit zero exactly like normal view',()=>{
 const value=structuredClone(sourceValue);value.periods[0].cumulativePercentage.cachedValue='0';value.periods[1].cumulativePercentage.cachedValue=null;value.periods[1].cumulativePercentage.hasFormula=false;const normal=render({curve:value}),compact=render({curve:value,compact:true});assert.deepEqual(points(compact),points(normal));assert.equal((compact.match(/<circle /g)||[]).length,(normal.match(/<circle /g)||[]).length);assert.match(compact,/Sin dato/);assert.deepEqual(tables(compact),tables(normal));
});
test('compact has no sub-44-pixel SVG actions and leaves native month control accessible',()=>{
 const html=render({compact:true});assert.doesNotMatch(html,/<g[^>]*role="button"/);assert.match(html,/<label[^>]*>Mes ordinal<select[^>]*data-source-curve-month/);const css=readFileSync(new URL('../src/app/(identity)/cuenta/plan-source-curve.module.css',import.meta.url),'utf8');assert.match(css,/\.compactMonth select\{[^}]*min-height:44px/);assert.match(css,/\.compactMonth select:focus-visible/);
});
test('document and weekly Investment implementations remain byte identical to the pinned preimage',()=>{
 const before=readFileSync(new URL('./fixtures/plan-source-curve-compact-preimage.txt',import.meta.url),'utf8').replaceAll('\r\n','\n'),actual=readFileSync(sourcePath,'utf8').replaceAll('\r\n','\n'),marker='export function InvestmentSourceCurves(';assert.equal(actual.slice(actual.indexOf(marker)),before.slice(before.indexOf(marker)));
});
test('compact CSS is a scoped append and preserves every previous shared rule',()=>{
 const previous=readFileSync(new URL('./fixtures/plan-source-curve-compact-preimage.css.txt',import.meta.url),'utf8').replaceAll('\r\n','\n'),actual=readFileSync(new URL('../src/app/(identity)/cuenta/plan-source-curve.module.css',import.meta.url),'utf8').replaceAll('\r\n','\n');assert.ok(actual.startsWith(previous));const appended=actual.slice(previous.length);assert.match(appended,/\.panel\.compact/);assert.doesNotMatch(appended,/(?:^|\})\s*(?:html|body|\*|:root)\b/);assert.doesNotMatch(appended,/position:fixed|100vw/);
});
