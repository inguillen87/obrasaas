import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {planBaselineHarness,session} from './fixtures/plan-baseline-synthetic.mjs';
const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href,helper=new URL('../src/app/(identity)/cuenta/plan-source-curve.mjs',import.meta.url).href;
const source=readFileSync(new URL('../src/app/(identity)/cuenta/plan-source-curve.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
await loadBindings();
const output=await transform(`import React,{useId,useRef,useState} from ${JSON.stringify(reactUrl)};import {formatSourceCurveDecimal,planSourceCurveView,sourceCurveKeyboardIndex,planDocumentCurveView,documentCurveKeyboardIndex,DOCUMENT_CURVE_PROFILE} from ${JSON.stringify(helper)};const styles={};`+source,{filename:'plan-source-curve.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const {PlanSourceCurve}=await import('data:text/javascript;base64,'+Buffer.from(output.code).toString('base64'));
async function html(presentation){const h=await planBaselineHarness(),value=(await h.baselines.read(session,h.context())).candidates[0];return renderToStaticMarkup(React.createElement(PlanSourceCurve,{...value,status:'APPLIED',presentation}));}
test('compact baseline preserves complete cached-value tables, SVG and keyboard controls from the import presentation',async()=>{
 const normal=await html('import'),compact=await html('baseline'),tables=value=>value.match(/<table[^>]*>[\s\S]*?<\/table>/g),svg=value=>value.match(/<svg[^>]*>[\s\S]*?<\/svg>/)?.[0],controls=value=>value.match(/<button[^>]*>[\s\S]*?<\/button>/g);
 assert.deepEqual(tables(compact),tables(normal));assert.equal(svg(compact),svg(normal));assert.deepEqual(controls(compact),controls(normal));assert.ok(compact.includes('12.345.678.901.234.567.890,1234500'));
});
test('compact baseline moves source-processing detail below the graph while preserving its full-scope explanation',async()=>{
 const normal=await html('import'),compact=await html('baseline'),beforeSvg=value=>value.split('<svg')[0];
 assert.ok(beforeSvg(compact).length<beforeSvg(normal).length);assert.match(beforeSvg(compact),/12 meses ordinales/);assert.match(beforeSvg(compact),/calendario por confirmar/);assert.match(beforeSvg(compact),/Moneda por confirmar/);
 const detail=compact.match(/<details[\s\S]*?<\/details>/g)?.find(value=>value.includes('Valores y referencias originales del archivo'));assert.match(detail,/sin recalcular fórmulas/);assert.match(detail,/costos adicionales/);assert.match(detail,/no se interpreta como cero/);
});
