import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {renderToStaticMarkup} from 'react-dom/server';
import {inventoryQuery,INVENTORY_PENDING_EVENT} from '../src/app/(identity)/cuenta/material-inventory-view.mjs';
const helperUrl=new URL('../src/app/(identity)/cuenta/material-inventory-view.mjs',import.meta.url).href,reactUrl=import.meta.resolve('react');
const source=readFileSync(new URL('../src/app/(identity)/cuenta/material-inventory-panel.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const harness=`let states=[],refs=[],effects=[],stateCursor=0,refCursor=0,effectCursor=0,bridge;const useState=initial=>{const index=stateCursor++;if(!(index in states))states[index]=initial;return[states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];};const useRef=initial=>refs[refCursor++]??(refs[refCursor-1]={current:initial});const useEffect=(callback,deps)=>{const index=effectCursor++,old=effects[index];if(!old||deps.some((value,i)=>!Object.is(value,old.deps[i]))){old?.cleanup?.();effects[index]={deps,cleanup:callback()};}};const useLayoutEffect=useEffect;const styles=new Proxy({},{get:(_,key)=>key});const WorksiteTaskSelector=()=>null;const useWorkspaceRequest=()=>bridge.request;const window={addEventListener:(name,fn)=>bridge.listeners.set(name,fn),removeEventListener:(name)=>bridge.listeners.delete(name)};export function reset(value){for(const effect of effects)effect?.cleanup?.();states=[];refs=[];effects=[];bridge=value;}export function render(props){stateCursor=0;refCursor=0;effectCursor=0;return InventoryInner(props);}`;
await loadBindings();
const compiled=await transform(`import React from ${JSON.stringify(reactUrl)};import {inventoryAccessDenied,inventorySnapshot,inventoryOutcome,mergeInventoryRows,mergeInventoryPage,inventoryAfterRecorded,inventoryPendingCounts,inventoryVisiblePage,INVENTORY_PENDING_EVENT,consumptionTraceability,inventoryReceiptPresentation} from ${JSON.stringify(helperUrl)};${harness.replaceAll('states','hookStates')}${source}`,{filename:'inventory-queue-real-component.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const component=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const projectId='project-synthetic',scope='a'.repeat(64),catalogHash='b'.repeat(64),revision='2026-10-17T12:00:00.000001',receiptId='field_'+'c'.repeat(64);
const props={projectId,scope,getSessionToken:()=>assert.fail('No provider permitted')};
function nodes(tree,predicate){const found=[];function walk(value){if(!value||typeof value!=='object')return;if(predicate(value))found.push(value);for(const child of [value.props?.children].flat(Infinity))walk(child);}walk(tree);return found;}
const label=tree=>[tree?.props?.children].flat(Infinity).filter(value=>typeof value==='string').join('');
const button=(tree,title)=>{const value=nodes(tree,node=>node.type==='button'&&label(node)===title)[0];assert.ok(value,'Missing button '+title);return value;};
const html=()=>renderToStaticMarkup(component.render(props));
function setup(){
 const state={listeners:new Map(),calls:[],consumptions:[{id:'consumption-a',revision,materialId:'material-a',workerId:'worker-a',unit:'bolsa',quantity:'1.001',state:'PENDING',canDecide:true,canReverse:false,catalogHash,reason:'Consumo pendiente sintético.',submittedBy:'other-manager'}],adjustments:[],failReads:false,wrongScope:false};
 state.request=async(url,options,decode)=>{
  const parsed=new URL(url,'https://example.invalid');state.calls.push({method:options.method||'GET',params:Object.fromEntries(parsed.searchParams),body:options.body});
  if(options.method==='POST'){const command=JSON.parse(options.body),row=state.consumptions.find(row=>row.id===command.payload.proposalId);row.state=command.payload.decision==='APPROVE'?'APPROVED':'REJECTED';row.canDecide=false;const {canDecide,canReverse,...result}=row;state.afterPost?.();return decode(new Response(JSON.stringify({scope,projectId,operationId:command.operationId,action:command.action,state:'RECORDED',saved:true,replayed:false,receiptId,kind:'CONSUMPTION_DECISION',consumption:result})));}
  if(state.failReads)throw Error('Consulta sintética interrumpida.');
  const query=Object.fromEntries(parsed.searchParams),filter=query.inventoryFilter;
  let consumptions=state.consumptions.filter(row=>filter!=='PENDING'||row.state==='PENDING'),adjustments=state.adjustments.filter(row=>filter!=='PENDING'||row.state==='PENDING');
  if(query.consumptionId)consumptions=state.consumptions.filter(row=>row.id===query.consumptionId);
  if(query.adjustmentId)adjustments=state.adjustments.filter(row=>row.id===query.adjustmentId);
  if(query.afterConsumption)consumptions=consumptions.slice(consumptions.findIndex(row=>row.id===query.afterConsumption)+1);
  const pendingCounts={consumptions:state.consumptions.filter(row=>row.state==='PENDING').length,adjustments:state.adjustments.filter(row=>row.state==='PENDING').length};
  const inventory={version:1,catalogVersion:1,catalogHash,catalogLimit:200,canManage:true,materials:[{id:'material-a',name:'Cemento sintético',unit:'bolsa',active:true,balance:'4.000'}],consumptions:consumptions.slice(0,100).map(row=>({...row})),consumptionsTruncated:consumptions.length>100,nextConsumptionCursor:consumptions.length>100?consumptions[99].id:null,adjustments:adjustments.slice(0,100).map(row=>({...row})),nextAdjustmentCursor:null,movements:[],nextMovementCursor:null,priorReceipts:[],priorReceiptsTruncated:false,...(filter?{inventoryFilter:filter,inventoryQuery:inventoryQuery(query),pendingCounts}:{})};
  const body={projectId,scope:state.wrongScope?'d'.repeat(64):scope,inventory,...(!filter?{projectRevision:revision,selfWorkers:[],sectors:[],workers:[]}:{} )};
  return decode(new Response(JSON.stringify(body)));
 };
 component.reset(state);component.render(props);return state;
}
test('manager opens the complete pending queue from a history-only DTO and switches to a separate history',async()=>{
 const state=setup();state.consumptions.unshift({...state.consumptions[0],id:'consumption-approved',state:'APPROVED',canDecide:false,reason:'Decidido sintético.'});
 await button(component.render(props),'Abrir inventario').props.onClick();let text=html();assert.match(text,/Consumo pendiente sintético/);assert.doesNotMatch(text,/Decidido sintético/);assert.deepEqual(state.calls.map(call=>call.params.inventoryFilter||'BASE'),['BASE','PENDING']);
 await button(component.render(props),'Historial de propuestas').props.onClick();text=html();assert.match(text,/Decidido sintético/);assert.match(text,/Consumo pendiente sintético/);assert.equal(state.calls.at(-1).params.inventoryFilter,'ALL');assert.ok(state.calls.every(call=>call.method==='GET'));
 await button(component.render(props),'Por revisar').props.onClick();assert.doesNotMatch(html(),/Decidido sintético/);
});
test('summary navigation preserves the active draft without issuing a read or a write',async()=>{
 const state=setup();await button(component.render(props),'Abrir inventario').props.onClick();button(component.render(props),'Aprobar consumo').props.onClick();let tree=component.render(props);const reason=nodes(tree,node=>node.type==='textarea')[0];reason.props.onChange({target:{value:'Motivo sintético conservado.'}});tree=component.render(props);const before=state.calls.length;
 state.listeners.get(INVENTORY_PENDING_EVENT)({detail:{projectId,scope}});tree=component.render(props);assert.equal(state.calls.length,before);assert.equal(nodes(tree,node=>node.type==='textarea')[0].props.value,'Motivo sintético conservado.');assert.match(renderToStaticMarkup(tree),/Materiales por revisar espera/);
 state.listeners.get(INVENTORY_PENDING_EVENT)({detail:{projectId:'other-project',scope}});assert.equal(state.calls.length,before);
});
test('successful decision retires its pending row and refreshes full counts without repeating the POST',async()=>{
 const state=setup();await button(component.render(props),'Abrir inventario').props.onClick();button(component.render(props),'Aprobar consumo').props.onClick();let tree=component.render(props);nodes(tree,node=>node.type==='textarea')[0].props.onChange({target:{value:'Cantidad comprobada sintéticamente.'}});tree=component.render(props);await nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});
 const text=html();assert.match(text,/Revisión de consumo registrada/);assert.doesNotMatch(text,/Consumo pendiente sintético/);assert.match(text,/No hay propuestas de materiales pendientes/);assert.equal(state.calls.filter(call=>call.method==='POST').length,1);assert.equal(state.calls.at(-1).params.inventoryFilter,'PENDING');
});
test('confirmed receipt survives failed readback with unknown totals and no stale decision authority',async()=>{
 const state=setup();await button(component.render(props),'Abrir inventario').props.onClick();await button(component.render(props),'Historial de propuestas').props.onClick();button(component.render(props),'Aprobar consumo').props.onClick();let tree=component.render(props);nodes(tree,node=>node.type==='textarea')[0].props.onChange({target:{value:'Cantidad comprobada sintéticamente.'}});tree=component.render(props);state.afterPost=()=>{state.failReads=true;};await nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});tree=component.render(props);
 assert.match(renderToStaticMarkup(tree),/Revisión de consumo registrada/);assert.match(renderToStaticMarkup(tree),/Por actualizar/);assert.equal(nodes(tree,node=>node.type==='button'&&label(node)==='Aprobar consumo').length,0);assert.equal(state.calls.filter(call=>call.method==='POST').length,1);
});
test('foreign-context read cannot replace the visible queue or fabricate a zero count',async()=>{
 const state=setup();await button(component.render(props),'Abrir inventario').props.onClick();state.wrongScope=true;await button(component.render(props),'Historial de propuestas').props.onClick();assert.match(html(),/Cambió el contexto de esta obra/);assert.doesNotMatch(html(),/No hay propuestas de materiales pendientes/);assert.equal(nodes(component.render(props),node=>node.type==='article').length,0);assert.ok(state.calls.every(call=>call.method==='GET'));
});
test('a self proposal stays visible for another reviewer without presenting decision actions',async()=>{
 const state=setup();state.consumptions[0].canDecide=false;await button(component.render(props),'Abrir inventario').props.onClick();const tree=component.render(props);assert.match(renderToStaticMarkup(tree),/Esperando la revisión de otro responsable/);assert.equal(nodes(tree,node=>node.type==='button'&&['Aprobar consumo','Rechazar consumo'].includes(label(node))).length,0);assert.ok(state.calls.every(call=>call.method==='GET'));
});
test('manager renders only ten rows of one kind and loading another server page advances visibly',async()=>{
 const state=setup();state.consumptions=Array.from({length:103},(_,i)=>({...state.consumptions[0],id:'consumption-'+i,reason:'Consumo '+i}));await button(component.render(props),'Abrir inventario').props.onClick();
 const proposals=()=>nodes(component.render(props),node=>node.props?.['data-inventory-proposal']);assert.equal(proposals().length,10);assert.equal(proposals()[0].props['data-proposal-id'],'consumption-0');const before=state.calls.length;
 button(component.render(props),'Siguiente').props.onClick();assert.equal(proposals()[0].props['data-proposal-id'],'consumption-10');assert.equal(state.calls.length,before);
 await button(component.render(props),'Consultar más consumos por revisar').props.onClick();assert.equal(proposals().length,3);assert.equal(proposals()[0].props['data-proposal-id'],'consumption-100');assert.match(html(),/101–103 de 103 por revisar/);
 button(component.render(props),'Anterior').props.onClick();assert.equal(proposals()[0].props['data-proposal-id'],'consumption-90');button(component.render(props),'Existencias').props.onClick();assert.equal(proposals().length,0);assert.ok(state.calls.every(call=>call.method==='GET'));
});
test('paging consumptions discards retained stale adjustment authority after another reviewer decides it',async()=>{
 const state=setup();state.consumptions=Array.from({length:103},(_,i)=>({...state.consumptions[0],id:'consumption-'+i}));state.adjustments=[{id:'adjustment-stale',revision,materialId:'material-a',unit:'bolsa',quantity:'1.001',expectedBalance:'4.000',state:'PENDING',direction:'IN',source:{type:'COUNT',reference:'REC-SYNTHETIC'},submittedBy:'other-manager',catalogHash,reason:'Recuento sintético.',canDecide:true}];
 await button(component.render(props),'Abrir inventario').props.onClick();state.adjustments[0].state='REJECTED';state.adjustments[0].canDecide=false;
 await button(component.render(props),'Consultar más consumos por revisar').props.onClick();assert.match(html(),/Cambió la cola mientras la recorrías/);assert.equal(state.calls.at(-1).params.afterConsumption,undefined);button(component.render(props),'Existencias').props.onClick();assert.doesNotMatch(html(),/Recuento sintético/);assert.equal(nodes(component.render(props),node=>node.type==='button'&&label(node)==='Aprobar existencias').length,0);assert.ok(state.calls.every(call=>call.method==='GET'));
});
test('same-count replacement of a retained queue restarts its read without keeping the decided row or posting',async()=>{
 const state=setup();state.consumptions=Array.from({length:103},(_,i)=>({...state.consumptions[0],id:'consumption-'+i}));state.adjustments=[{id:'adjustment-old',revision,materialId:'material-a',unit:'bolsa',quantity:'1.001',expectedBalance:'4.000',state:'PENDING',direction:'IN',source:{type:'COUNT',reference:'REC-SYNTHETIC'},submittedBy:'other-manager',catalogHash,reason:'Existencia anterior.',canDecide:true}];
 await button(component.render(props),'Abrir inventario').props.onClick();state.adjustments=[{...state.adjustments[0],id:'adjustment-replacement',revision:'2026-10-17T12:00:00.000002',reason:'Existencia vigente con igual total.'}];
 await button(component.render(props),'Consultar más consumos por revisar').props.onClick();assert.match(html(),/Cambió la cola mientras la recorrías/);assert.equal(state.calls.at(-1).params.afterConsumption,undefined);button(component.render(props),'Existencias').props.onClick();
 const rows=nodes(component.render(props),node=>node.props?.['data-inventory-proposal']);assert.equal(rows.length,1);assert.equal(rows[0].props['data-proposal-id'],'adjustment-replacement');assert.doesNotMatch(html(),/Existencia anterior/);assert.match(html(),/1–1 de 1 por revisar/);assert.ok(state.calls.every(call=>call.method==='GET'));
});
