import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
await loadBindings();
const src=fs.readFileSync(new URL('../src/app/(identity)/cuenta/field-overtime-view.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''),code=(await transform(`import React from '${import.meta.resolve('react')}';const styles={};\n`+src,{filename:'actual-overtime-unconfirmed-view.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}})).code,{FieldOvertimeJourney}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const text=tree=>typeof tree==='string'?tree:typeof tree==='number'?String(tree):tree?.props?React.Children.toArray(tree.props.children).map(text).join(''):'';
const nodes=(tree,predicate)=>{if(!tree||typeof tree!=='object')return [];return [...(predicate(tree)?[tree]:[]),...React.Children.toArray(tree.props?.children).flatMap(child=>nodes(child,predicate))];};
test('actual overtime JSX labels unconfirmed times as observed and presents a clear blocked review state',()=>{
 const configuration={mode:'OFF',timeZone:null},selected={worker:{name:'Synthetic participant'},summary:{shiftId:'shift-a',status:'CLOSED',complete:true,startedAt:'2026-10-01T10:00:00.000Z',endedAt:'2026-10-01T11:00:00.000Z',elapsedMs:3600000,breakMs:0,netMs:3600000,evidenceStatus:'READY'},configuration,effectiveSourceStatus:'UNCONFIRMED',overlapSourceStatus:'UNCONFIRMED',overlapDetected:null,canPropose:false,canApprove:false,canReject:false,events:[],history:[]};
 const tree=FieldOvertimeJourney({data:{configuration,journeys:[],canConfigure:false},selected,disabled:false});assert.match(text(tree),/Tiempo neto observado/);assert.doesNotMatch(text(tree),/Tiempo neto efectivo/);assert.match(text(tree),/Conservamos los fichajes observados/);assert.match(text(tree),/solicitar y decidir horas extra están bloqueados/);assert.equal(nodes(tree,node=>node.type==='button'&&/Solicitar revisión|Revisar solicitud/.test(text(node))).length,0);
});
