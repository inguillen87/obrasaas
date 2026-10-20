import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {renderToStaticMarkup} from 'react-dom/server';
import {consumptionEvidenceSnapshot} from '../src/app/(identity)/cuenta/consumption-evidence-view.mjs';

const context={projectId:'project-a',scope:'a'.repeat(64),workerId:'worker-a',taskId:'task-a',sectorId:'sector-a'},digest='b'.repeat(64);
const row=(n,changes={})=>({id:'evidence-'+n,title:'Archivo '+n,taskId:context.taskId,workerId:context.workerId,sectorId:context.sectorId,revision:'2026-10-20T12:00:00.000001',status:'PENDING',media:{kind:n%2?'image':'audio',contentType:n%2?'image/png':'audio/ogg',bytes:100,sha256:'c'.repeat(64)},...changes});
const page=(entries,{hasPrevious=false,hasNext=false}={})=>({contextDigest:digest,first:entries.length?{id:entries[0].id,createdAt:'2026-10-20T12:00:00.000006'}:null,last:entries.length?{id:entries.at(-1).id,createdAt:'2026-10-20T12:00:00.000001'}:null,hasPrevious,hasNext});
function snapshot(entries=[row(3),row(2)],selected=[],options={}){return {...context,entries,evidence:[...entries,...selected.filter(r=>!entries.some(e=>e.id===r.id))],page:page(entries,options)};}

test('catalog DTO admits six entries and ten retained own attachments beyond that page',()=>{
 const entries=Array.from({length:6},(_,i)=>row(20-i)),selected=Array.from({length:10},(_,i)=>row(i));
 const value=snapshot(entries,selected,{hasNext:true});assert.equal(consumptionEvidenceSnapshot(value,{...context,selectedIds:selected.map(row=>row.id)}),value);
 assert.equal(value.evidence.length,16);assert.equal(consumptionEvidenceSnapshot(snapshot([]),{...context,selectedIds:[]}).entries.length,0);
});
test('catalog DTO rejects private processing paths URLs wrong ownership malformed cursors and repeated rows',()=>{
 const changes=[v=>{v.scope='d'.repeat(64);},v=>{v.workerId='other-worker';},v=>{v.entries[0].workerId='other-worker';},v=>{v.entries[0].taskId=null;},v=>{v.entries[0].sectorId='other-sector';},v=>{v.entries[0].processing={result:{text:'private'}};},v=>{v.evidence[0].pathname='private/path';},v=>{v.entries[0].media.url='https://example.invalid';},v=>{v.entries[0].media.bytes=0;},v=>{v.entries[0].status='REJECTED';},v=>{v.entries[0].revision='2026-02-31T12:00:00.000001';},v=>{v.page.first.createdAt='2026-02-31T12:00:00.000001';},v=>{v.page.last.id='another-evidence';},v=>{v.page.hasNext='true';},v=>{v.page.extra=true;},v=>{v.entries.push(v.entries[0]);},v=>{v.evidence.push(row(9));},v=>{v.entries=Array.from({length:7},(_,i)=>row(20-i));v.evidence=v.entries;v.page=page(v.entries);},v=>{v.evidence=v.evidence.filter(e=>e.id!==v.entries[0].id);}];
 for(const mutate of changes){const value=snapshot();mutate(value);assert.throws(()=>consumptionEvidenceSnapshot(value,{...context,selectedIds:[]}));}
 const value=snapshot();assert.throws(()=>consumptionEvidenceSnapshot(value,{...context,selectedIds:[],page:{contextDigest:'d'.repeat(64)}}));
});

const source=readFileSync(new URL('../src/app/(identity)/cuenta/consumption-evidence-picker.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const harness=`let states=[],refs=[],effects=[],stateCursor=0,refCursor=0,effectCursor=0;const useState=initial=>{const i=stateCursor++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];};const useRef=initial=>refs[refCursor++]??(refs[refCursor-1]={current:initial});const useEffect=(callback,deps)=>{const i=effectCursor++,old=effects[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j]))){old?.cleanup?.();effects[i]={deps,cleanup:callback()};}};const useLayoutEffect=useEffect;const styles=new Proxy({},{get:(_,key)=>key});export function reset(){for(const e of effects)e?.cleanup?.();states=[];refs=[];effects=[];}export function render(props){stateCursor=0;refCursor=0;effectCursor=0;return EvidencePickerInner(props);}export function unmount(){for(const e of effects)e?.cleanup?.();effects=[];}`;
await loadBindings();
const compiled=await transform(`import React from ${JSON.stringify(import.meta.resolve('react'))};import {consumptionEvidenceSnapshot} from ${JSON.stringify(new URL('../src/app/(identity)/cuenta/consumption-evidence-view.mjs',import.meta.url).href)};${harness}${source}`,{filename:'consumption-evidence-picker-real-component.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const component=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const text=element=>[element?.props?.children].flat(Infinity).filter(value=>typeof value==='string').join('');
function nodes(tree,predicate){const found=[];function walk(value){if(!value||typeof value!=='object')return;if(predicate(value))found.push(value);for(const child of [value.props?.children].flat(Infinity))walk(child);}walk(tree);return found;}
function setup(){
 component.reset();const state={calls:[],busy:[],denied:[],selected:[],reply:snapshot([row(13),row(12)],[],{hasNext:true})};
 state.props={...context,selectedIds:state.selected,onChange(ids){state.selected=ids;state.props.selectedIds=ids;},onBusyChange(value){state.busy.push(value);},onAccessDenied(error){state.denied.push(error);},request:async(url,options,decode)=>{state.calls.push({url,options,query:Object.fromEntries(new URL(url,'https://example.invalid').searchParams)});if(state.wait)await state.wait;return decode(new Response(JSON.stringify(state.reply),{status:state.status||200}));}};
 state.render=()=>component.render(state.props);state.html=()=>renderToStaticMarkup(state.render());state.button=title=>{const value=nodes(state.render(),node=>node.type==='button'&&text(node)===title)[0];assert.ok(value,'Missing button '+title);return value;};state.choose=(id,checked=true)=>{const label=nodes(state.render(),node=>node.type==='label'&&nodes(node,n=>n.type==='span'&&text(n)==='Archivo '+id).length)[0];assert.ok(label);nodes(label,n=>n.type==='input')[0].props.onChange({target:{checked}});};state.render();return state;
}

test('picker only reads on explicit request and retains a selected older original while paging',async()=>{
 const s=setup();assert.equal(s.calls.length,0);await s.button('Buscar fotos y audios guardados').props.onClick();assert.equal(s.calls[0].query.direction,'FIRST');assert.deepEqual(s.busy,[true,false]);s.choose(12);assert.deepEqual(s.selected,['evidence-12']);
 s.reply=snapshot([row(7),row(6)],[row(12)],{hasPrevious:true,hasNext:true});await s.button('Ver más antiguos').props.onClick();assert.equal(s.calls.at(-1).query.direction,'NEXT');assert.deepEqual(JSON.parse(s.calls.at(-1).query.selectedIds),['evidence-12']);assert.equal(JSON.parse(s.calls.at(-1).query.page).last.id,'evidence-12');assert.match(s.html(),/Seleccionados/);assert.match(s.html(),/Archivo 12/);assert.match(s.html(),/Archivo 7/);assert.deepEqual(s.selected,['evidence-12']);assert.ok(s.calls.every(call=>!call.options.method||call.options.method==='GET'));
});
test('picker reaches earlier pages and refreshes exact page without modifying material or quantity',async()=>{
 const s=setup();await s.button('Buscar fotos y audios guardados').props.onClick();s.reply=snapshot([row(7),row(6)],[],{hasPrevious:true});await s.button('Ver más antiguos').props.onClick();await s.button('Actualizar esta página').props.onClick();assert.equal(s.calls.at(-1).query.direction,'REFRESH');s.reply=snapshot([row(13),row(12)],[],{hasNext:true});await s.button('Ver más recientes').props.onClick();assert.equal(s.calls.at(-1).query.direction,'PREVIOUS');assert.deepEqual(s.selected,[]);
});
test('picker preserves ten selections across pages and blocks an eleventh',async()=>{
 const s=setup(),selected=Array.from({length:10},(_,i)=>row(i));s.props.selectedIds=selected.map(row=>row.id);s.selected=s.props.selectedIds;s.reply=snapshot([row(13)],selected);await s.button('Buscar fotos y audios guardados').props.onClick();const input=nodes(s.render(),node=>node.type==='label'&&nodes(node,n=>n.type==='span'&&text(n)==='Archivo 13').length).flatMap(label=>nodes(label,node=>node.type==='input'))[0];assert.equal(input.props.disabled,true);input.props.onChange({target:{checked:true}});assert.equal(s.selected.length,10);s.choose(1,false);assert.equal(s.selected.length,9);
});
test('failed or malformed read preserves selections and allows explicit removal without deleting originals',async()=>{
 const s=setup();await s.button('Buscar fotos y audios guardados').props.onClick();s.choose(12);s.status=404;s.reply={code:'FIELD_EVIDENCE_UNAVAILABLE'};await s.button('Actualizar esta página').props.onClick();assert.deepEqual(s.selected,['evidence-12']);assert.match(s.html(),/La lista cambió/);s.button('Quitar todos los adjuntos').props.onClick();assert.deepEqual(s.selected,[]);assert.match(s.html(),/archivos guardados se conservan/);s.status=200;s.reply=snapshot([row(3)]);await s.button('Reintentar consulta').props.onClick();assert.equal(s.calls.at(-1).query.direction,'FIRST');assert.equal(s.calls.at(-1).query.page,undefined);assert.match(s.html(),/Archivo 3/);
});
test('authority denial purges catalog and forwards revocation to the parent',async()=>{
 for(const status of [401,403]){const s=setup();await s.button('Buscar fotos y audios guardados').props.onClick();s.status=status;s.reply={code:'FIELD_PARTICIPANT_REQUIRED'};await s.button('Actualizar esta página').props.onClick();assert.equal(s.denied.length,1);assert.equal(s.denied[0].status,status);assert.doesNotMatch(s.html(),/Archivo 13/);}
 const s=setup();s.reply={...snapshot(),projectId:'foreign-project'};await s.button('Buscar fotos y audios guardados').props.onClick();assert.equal(s.denied[0].code,'WORKSPACE_CONTEXT_CHANGED');assert.doesNotMatch(s.html(),/Archivo 3/);
});
test('pending read locks duplicate requests and reports busy until it drains',async()=>{
 const s=setup();let release;s.wait=new Promise(resolve=>{release=resolve;});const pending=s.button('Buscar fotos y audios guardados').props.onClick();assert.equal(s.button('Consultando archivos…').props.disabled,true);await s.button('Consultando archivos…').props.onClick();assert.equal(s.calls.length,1);assert.deepEqual(s.busy,[true]);release();await pending;assert.deepEqual(s.busy,[true,false]);
});
test('late response from an unmounted context cannot restore a catalog or alter selections',async()=>{
 const s=setup();let release;s.wait=new Promise(resolve=>{release=resolve;});const pending=s.button('Buscar fotos y audios guardados').props.onClick(),signal=s.calls[0].options.signal;component.unmount();assert.equal(signal.aborted,true);const before=s.busy.length;release();await pending;assert.equal(s.busy.length,before);assert.deepEqual(s.selected,[]);assert.deepEqual(s.denied,[]);
});
test('disabled picker issues no request and exposes a named optional attachment fieldset',async()=>{
 const s=setup();s.props.disabled=true;await s.button('Buscar fotos y audios guardados').props.onClick();assert.equal(s.calls.length,0);assert.match(s.html(),/<legend>Fotos y audios guardados/);assert.match(s.html(),/0 de 10 archivos seleccionados/);
});
