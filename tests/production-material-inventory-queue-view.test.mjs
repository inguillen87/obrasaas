import test from 'node:test';
import assert from 'node:assert/strict';
import {inventorySnapshot,inventoryPendingCounts,inventoryQuery,mergeInventoryPage,inventoryAfterRecorded,inventoryVisiblePage} from '../src/app/(identity)/cuenta/material-inventory-view.mjs';
const scope='a'.repeat(64),catalogHash='b'.repeat(64),projectId='project-synthetic',revision='2026-10-17T12:00:00.000001';
const consumption=(id,state='PENDING')=>({id,revision,materialId:'material-a',workerId:'worker-a',unit:'bolsa',quantity:'1.001',state,canDecide:true,canReverse:false,catalogHash,reason:'Informe sintético.'});
const adjustment=(id,state='PENDING')=>({id,revision,materialId:'material-a',unit:'bolsa',quantity:'1.001',expectedBalance:'4.000',state,direction:'IN',source:{type:'COUNT',reference:'REC-SYNTHETIC'},submittedBy:'manager-other',catalogHash,reason:'Recuento sintético.',canDecide:true});
function fixture(filter='PENDING',query={}){return {scope,projectId,projectRevision:revision,selfWorkers:[],sectors:[],inventory:{version:1,catalogVersion:1,catalogHash,catalogLimit:200,canManage:true,materials:[{id:'material-a',name:'Cemento sintético',unit:'bolsa',active:true,balance:'4.000'}],consumptions:[consumption('consumption-a')],consumptionsTruncated:false,nextConsumptionCursor:null,adjustments:[adjustment('adjustment-a')],nextAdjustmentCursor:null,movements:[],nextMovementCursor:null,priorReceipts:[],priorReceiptsTruncated:false,inventoryFilter:filter,pendingCounts:{consumptions:1,adjustments:1},inventoryQuery:inventoryQuery(query)}};}
test('pending totals are complete server facts; absent and partial values never become zero',()=>{
 const value=fixture();assert.deepEqual(inventoryPendingCounts(value.inventory),{consumptions:1,adjustments:1});
 for(const patch of [{pendingCounts:undefined},{pendingCounts:{consumptions:0}},{pendingCounts:{consumptions:-1,adjustments:0}},{pendingCounts:{consumptions:0,adjustments:0,other:0}},{canManage:false},{inventoryFilter:'OTHER'}])assert.equal(inventoryPendingCounts({...value.inventory,...patch}),null);
 assert.throws(()=>inventorySnapshot({...value,inventory:{...value.inventory,pendingCounts:undefined}},{scope,projectId,inventoryFilter:'PENDING'}));
});
test('snapshot binds scope project filter and every cursor echo, including absent parameters',()=>{
 const value=fixture('ALL',{afterConsumption:'consumption-anchor'}),expected={scope,projectId,inventoryFilter:'ALL',afterConsumption:'consumption-anchor'};
 assert.equal(inventorySnapshot(value,expected,{history:true}),value);
 for(const patch of [{scope:'c'.repeat(64)},{projectId:'other-project'},{inventoryFilter:'PENDING'},{afterConsumption:'other-anchor'},{adjustmentId:'unexpected-adjustment'}])assert.throws(()=>inventorySnapshot(value,{...expected,...patch},{history:true}));
 assert.throws(()=>inventorySnapshot(value,{scope,projectId},{history:true}));
 assert.throws(()=>inventorySnapshot({...value,inventory:{...value.inventory,inventoryQuery:{...value.inventory.inventoryQuery,unexpected:null}}},expected,{history:true}));
});
test('pending response cannot contain history or a directed record and legacy remains available separately',()=>{
 const value=fixture();for(const row of [consumption('consumption-a','APPROVED'),consumption('consumption-a','REJECTED')])assert.throws(()=>inventorySnapshot({...value,inventory:{...value.inventory,consumptions:[row]}},{scope,projectId,inventoryFilter:'PENDING'}));
 assert.throws(()=>inventorySnapshot(fixture('PENDING',{consumptionId:'consumption-a'}),{scope,projectId,inventoryFilter:'PENDING',consumptionId:'consumption-a'},{history:true}));
 const legacy=fixture();delete legacy.inventory.inventoryFilter;delete legacy.inventory.pendingCounts;delete legacy.inventory.inventoryQuery;assert.equal(inventorySnapshot(legacy,{scope,projectId}),legacy);assert.throws(()=>inventorySnapshot(legacy,{scope,projectId,inventoryFilter:'PENDING'}));
});
test('pagination appends only the requested queue and never joins another filter or cursor',()=>{
 const previous=fixture();previous.inventory.nextConsumptionCursor='consumption-a';previous.inventory.pendingCounts.consumptions=2;
 const incoming=fixture('PENDING',{afterConsumption:'consumption-a'});incoming.inventory.consumptions=[consumption('consumption-b')];incoming.inventory.pendingCounts.consumptions=2;
 const expected={scope,projectId,inventoryFilter:'PENDING',afterConsumption:'consumption-a'},before=structuredClone(previous),merged=mergeInventoryPage(previous,incoming,expected,'consumptions');
 assert.deepEqual(merged.inventory.consumptions.map(row=>row.id),['consumption-a','consumption-b']);assert.deepEqual(merged.inventory.adjustments,previous.inventory.adjustments);assert.equal(merged.inventory.nextConsumptionCursor,null);assert.deepEqual(previous,before);
 assert.throws(()=>mergeInventoryPage(previous,fixture('ALL',{afterConsumption:'consumption-a'}),{...expected,inventoryFilter:'ALL'},'consumptions'));
 assert.throws(()=>mergeInventoryPage(previous,incoming,{...expected,afterConsumption:'other'},'consumptions'));
 incoming.inventory.pendingCounts.consumptions=1;assert.throws(()=>mergeInventoryPage(previous,incoming,expected,'consumptions'));
});
test('confirmed decisions retire only the decided pending row without fabricating new totals',()=>{
 const previous=fixture(),before=structuredClone(previous),result={consumption:consumption('consumption-a','APPROVED')},updated=inventoryAfterRecorded(previous,result);
 assert.equal(updated.inventory.consumptions.length,0);assert.equal(updated.inventory.adjustments.length,1);assert.deepEqual(updated.inventory.pendingCounts,previous.inventory.pendingCounts);assert.deepEqual(previous,before);
 const history=fixture('ALL');assert.equal(inventoryAfterRecorded(history,result).inventory.consumptions[0].state,'APPROVED');
 assert.equal(inventoryAfterRecorded(previous,{adjustment:adjustment('adjustment-a','REJECTED')}).inventory.adjustments.length,0);
});
test('pending pagination restarts when either retained proposal kind exceeds refreshed totals',()=>{
 for(const kind of ['consumptions','adjustments','movements']){
  const previous=fixture(),queryKey={consumptions:'afterConsumption',adjustments:'afterAdjustment',movements:'afterMovement'}[kind],cursorKey={consumptions:'nextConsumptionCursor',adjustments:'nextAdjustmentCursor',movements:'nextMovementCursor'}[kind],anchor=kind==='movements'?'movement-a':previous.inventory[kind][0].id;
  previous.inventory[cursorKey]=anchor;const incoming=fixture('PENDING',{[queryKey]:anchor});incoming.inventory[kind]=[];incoming.inventory.pendingCounts[kind==='adjustments'?'consumptions':'adjustments']=0;
  assert.throws(()=>mergeInventoryPage(previous,incoming,{scope,projectId,inventoryFilter:'PENDING',[queryKey]:anchor},kind),error=>error.code==='INVENTORY_QUEUE_CHANGED');
 }
});
test('visible inventory pages retain every row while bounding and clamping ten-row views',()=>{
 const rows=Array.from({length:203},(_,index)=>({id:'row-'+index})),seen=[];
 for(let page=0;page<21;page++){const view=inventoryVisiblePage(rows,page);assert.ok(view.rows.length<=10);assert.equal(view.from,page*10+1);seen.push(...view.rows);}
 assert.deepEqual(seen,rows);assert.equal(inventoryVisiblePage(rows,100).index,20);assert.equal(inventoryVisiblePage(rows,-1).index,0);assert.deepEqual(inventoryVisiblePage([],100),{rows:[],index:0,from:0,to:0,hasPrevious:false,hasNext:false});
});
test('pending pages restart on retained-head replacement order or revision even when complete totals stay equal',()=>{
 for(const [kind,retained]of [['consumptions','adjustments'],['adjustments','consumptions'],['movements','consumptions'],['movements','adjustments']])for(const change of ['replacement','revision','order']){
  const previous=fixture(),queryKey={consumptions:'afterConsumption',adjustments:'afterAdjustment',movements:'afterMovement'}[kind],cursorKey={consumptions:'nextConsumptionCursor',adjustments:'nextAdjustmentCursor',movements:'nextMovementCursor'}[kind],anchor=kind==='movements'?'movement-anchor':previous.inventory[kind][0].id;
  previous.inventory[cursorKey]=anchor;previous.inventory[retained].push({...previous.inventory[retained][0],id:retained+'-second'});previous.inventory.pendingCounts[retained]=2;
  const incoming=structuredClone(previous);incoming.inventory.inventoryQuery=inventoryQuery({[queryKey]:anchor});incoming.inventory[kind]=[];incoming.inventory[cursorKey]=null;
  if(change==='replacement')incoming.inventory[retained][0].id=retained+'-replacement';
  else if(change==='revision')incoming.inventory[retained][0].revision='2026-10-17T12:00:00.000002';else incoming.inventory[retained].reverse();
  assert.deepEqual(incoming.inventory.pendingCounts,previous.inventory.pendingCounts);
  assert.throws(()=>mergeInventoryPage(previous,incoming,{scope,projectId,inventoryFilter:'PENDING',[queryKey]:anchor},kind),error=>error.code==='INVENTORY_QUEUE_CHANGED');
  const historyPrevious=structuredClone(previous),historyIncoming=structuredClone(incoming);historyPrevious.inventory.inventoryFilter='ALL';historyIncoming.inventory.inventoryFilter='ALL';assert.doesNotThrow(()=>mergeInventoryPage(historyPrevious,historyIncoming,{scope,projectId,inventoryFilter:'ALL',[queryKey]:anchor},kind));
 }
});
test('retained heads stay bounded to the fresh first hundred while the requested continuation is appended',()=>{
 const previous=fixture();previous.inventory.adjustments=Array.from({length:132},(_,i)=>adjustment('adjustment-'+i));previous.inventory.pendingCounts.adjustments=132;previous.inventory.pendingCounts.consumptions=2;previous.inventory.nextConsumptionCursor='consumption-a';
 const incoming=fixture('PENDING',{afterConsumption:'consumption-a'});incoming.inventory.adjustments=previous.inventory.adjustments.slice(0,100);incoming.inventory.pendingCounts={...previous.inventory.pendingCounts};incoming.inventory.consumptions=[consumption('consumption-b')];
 const result=mergeInventoryPage(previous,incoming,{scope,projectId,inventoryFilter:'PENDING',afterConsumption:'consumption-a'},'consumptions');assert.equal(result.inventory.consumptions.length,2);assert.equal(result.inventory.adjustments.length,132);
});
