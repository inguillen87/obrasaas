import test from 'node:test';
import assert from 'node:assert/strict';
import {readInventory,readInventoryPendingCounts,inventoryCatalogHash,applyInventoryFieldAction} from '../src/lib/material-inventory.mjs';
import {createFieldHandlers} from '../src/lib/field-operations-http.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';

const context={projectId:'project-a',scope:'a'.repeat(64)},session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Director',organizationId:'org_A',organizationRole:'org:member'};
const member={role:'DIRECTOR',actorId:'director-a',organizationId:'company-a',clerkUserId:session.userId};
const project={id:context.projectId,metadata:{materialInventory:{version:1,catalogVersion:1,materials:[{id:'material-a',name:'Cemento sintético',unit:'bolsa',active:true,balance:'25.001'}]}}};
const catalogHash=inventoryCatalogHash(project.metadata.materialInventory),revision='2026-10-17T12:00:00.123456';
const queryKeys=['afterMovement','afterConsumption','consumptionId','afterAdjustment','adjustmentId'];
function record(kind,index,state='PENDING',patch={}){
 const metadata={version:1,kind,state,materialId:'material-a',unit:'bolsa',quantity:'0.001',catalogHash,submittedBy:'worker-a',reason:'Registro sintético conservado para revisión.',submittedAt:'2026-10-17T12:00:00.000Z',decision:null,...(kind==='CONSUMPTION'?{workerId:'worker-a',sectorId:'sector-a',taskId:null,reversal:null}:{expectedBalance:'25.001',direction:'IN',source:{type:'COUNT',reference:'REC-'+index}}),...patch};
 return {id:kind.toLowerCase()+'-'+String(index).padStart(4,'0'),projectId:context.projectId,organizationId:'company-a',createdAt:Math.floor(index/2),revision,title:'Registro sintético',metadata:{materialInventory:metadata}};
}
const order=(left,right)=>right.createdAt-left.createdAt||right.id.localeCompare(left.id);
function database(records,{countResult}={}){
 const calls=[],rows=value=>({rows:structuredClone(value)}),visible=(entry,projectId)=>entry.projectId===projectId&&entry.metadata.materialInventory.version===1;
 const page=(kind,args,sql)=>{
  const consumption=kind==='CONSUMPTION',projectId=args[0],after=consumption?args[3]:args[1],target=consumption?args[4]:args[2],anchor=records.find(entry=>entry.id===after);
  return records.filter(entry=>visible(entry,projectId)&&entry.metadata.materialInventory.kind===kind&&(!consumption||args[1]||args[2].includes(entry.metadata.materialInventory.workerId)&&entry.metadata.materialInventory.submittedBy===args[5])&&(!sql.includes("AND metadata->'materialInventory'->>'state'='PENDING'")||entry.metadata.materialInventory.state==='PENDING')&&(!after||entry.createdAt<anchor.createdAt||entry.createdAt===anchor.createdAt&&entry.id<anchor.id)&&(!target||entry.id===target)).sort(order).slice(0,101);
 };
 return {calls,query:async(sql,args)=>{
  calls.push({sql,args});assert.match(sql,/^SELECT /,'A queue read cannot write business records');
  if(sql.startsWith('SELECT count(*) FILTER')){
   assert.match(sql,/p\."organizationId"=\$2/);assert.deepEqual(args,[context.projectId,member.organizationId]);
   if(countResult!==undefined)return rows(countResult);
   const selected=records.filter(entry=>visible(entry,args[0])&&entry.organizationId===args[1]&&entry.metadata.materialInventory.state==='PENDING');
   return rows([{consumptions:selected.filter(entry=>entry.metadata.materialInventory.kind==='CONSUMPTION').length,adjustments:selected.filter(entry=>entry.metadata.materialInventory.kind==='STOCK_ADJUSTMENT').length}]);
  }
  if(sql.startsWith('SELECT i.id FROM public."Incident"'))return rows(records.filter(entry=>entry.id===args[0]&&visible(entry,args[2])&&entry.organizationId===args[1]&&entry.metadata.materialInventory.kind==='CONSUMPTION'&&(args[3]||args[4].includes(entry.metadata.materialInventory.workerId)&&entry.metadata.materialInventory.submittedBy===args[5])).map(({id})=>({id})));
  if(sql.startsWith('SELECT id FROM public."Incident"'))return rows(records.filter(entry=>entry.id===args[0]&&visible(entry,args[1])&&entry.metadata.materialInventory.kind==='STOCK_ADJUSTMENT').map(({id})=>({id})));
  if(sql.startsWith('SELECT id,title,metadata'))return rows(page('CONSUMPTION',args,sql));
  if(sql.startsWith('SELECT id,metadata,to_char')&&sql.includes("->>'kind'='STOCK_ADJUSTMENT'"))return rows(page('STOCK_ADJUSTMENT',args,sql));
  if(sql.startsWith('SELECT id,metadata,to_char')&&sql.includes('WHERE id=$1'))return rows(records.filter(entry=>entry.id===args[0]&&entry.projectId===args[1]));
  if(sql.includes('FROM public."AuditLog"')||sql.includes('CROSS JOIN LATERAL'))return rows([]);
  assert.fail('Unexpected inventory query: '+sql);
 }};
}

test('pending review finds both old queues behind more than 100 closed records and counts the complete persisted backlog without writes',async()=>{
 const records=[];
 for(const kind of ['CONSUMPTION','STOCK_ADJUSTMENT']){
  for(let index=0;index<203;index++)records.push(record(kind,index,'PENDING',index===0?{submittedBy:member.actorId}:{}));
  for(let index=203;index<380;index++)records.push(record(kind,index,index%2?'APPROVED':'REJECTED'));
 }
 records.push({...record('CONSUMPTION',999),projectId:'project-other'},{...record('STOCK_ADJUSTMENT',999),projectId:'project-other'},record('UNRELATED',999));
 const before=structuredClone({records,project}),db=database(records),first=await readInventory(db,member,project,{reviewer:true,inventoryFilter:'PENDING'});
 assert.deepEqual(first.pendingCounts,{consumptions:203,adjustments:203});assert.equal(first.consumptions.length,100);assert.equal(first.adjustments.length,100);
 assert.equal(first.inventoryFilter,'PENDING');assert.deepEqual(first.inventoryQuery,Object.fromEntries(queryKeys.map(key=>[key,null])));
 for(const [key,cursorKey,option] of [['consumptions','nextConsumptionCursor','afterConsumption'],['adjustments','nextAdjustmentCursor','afterAdjustment']]){
  const seen=[...first[key]];let page=first;
  while(page[cursorKey]){page=await readInventory(db,member,project,{reviewer:true,inventoryFilter:'PENDING',[option]:page[cursorKey]});assert.equal(page.inventoryQuery[option],seen.at(-1).id);seen.push(...page[key]);assert.deepEqual(page.pendingCounts,{consumptions:203,adjustments:203});}
  assert.equal(seen.length,203);assert.equal(new Set(seen.map(value=>value.id)).size,203);assert.ok(seen.every(value=>value.state==='PENDING'));assert.equal(seen.find(value=>value.submittedBy===member.actorId).canDecide,false);
 }
 assert.deepEqual({records,project},before);assert.equal(first.materials[0].balance,'25.001');
 assert.ok(db.calls.filter(call=>call.sql.includes('ORDER BY "createdAt" DESC,id DESC')).every(call=>!call.sql.includes('OFFSET')));
});

test('a decided cursor remains a canonical anchor while the next pending page excludes that decision and full counts decrease',async()=>{
 for(const [kind,cursorKey,option,key] of [['CONSUMPTION','nextConsumptionCursor','afterConsumption','consumptions'],['STOCK_ADJUSTMENT','nextAdjustmentCursor','afterAdjustment','adjustments']]){
  const records=Array.from({length:102},(_,index)=>record(kind,index)),db=database(records),first=await readInventory(db,member,project,{reviewer:true,inventoryFilter:'PENDING'}),anchor=records.find(value=>value.id===first[cursorKey]);
  anchor.metadata.materialInventory.state='APPROVED';anchor.revision='2026-10-17T12:01:00.123456';
  const next=await readInventory(db,member,project,{reviewer:true,inventoryFilter:'PENDING',[option]:anchor.id});
  assert.equal(next[key].length,2);assert.equal(next[cursorKey],null);assert.equal(next.pendingCounts[key],101);assert.ok(next[key].every(value=>value.state==='PENDING'&&value.id!==anchor.id));
  const targetKey=kind==='CONSUMPTION'?'consumptionId':'adjustmentId',target=await readInventory(db,member,project,{reviewer:true,inventoryFilter:'ALL',[targetKey]:anchor.id});assert.equal(target[key][0].state,'APPROVED');assert.equal(target[key][0].revision,anchor.revision);assert.equal(target.pendingCounts[key],101);
 }
});

test('legacy history is unchanged and opt-in ALL has independent history cursors with complete pending totals',async()=>{
 const records=Array.from({length:105},(_,index)=>record('CONSUMPTION',index,index<2?'PENDING':'REJECTED')),db=database(records),legacy=await readInventory(db,member,project,{reviewer:true});
 assert.equal(legacy.consumptions.length,100);assert.ok(legacy.consumptions.every(value=>value.state==='REJECTED'));assert.equal(Object.hasOwn(legacy,'inventoryFilter'),false);assert.equal(Object.hasOwn(legacy,'pendingCounts'),false);assert.equal(db.calls.some(call=>call.sql.startsWith('SELECT count(*) FILTER')),false);
 const all=await readInventory(db,member,project,{reviewer:true,inventoryFilter:'ALL'});assert.deepEqual(all.consumptions,legacy.consumptions);assert.deepEqual(all.pendingCounts,{consumptions:2,adjustments:0});
 const pending=await readInventory(db,member,project,{reviewer:true,inventoryFilter:'PENDING'});assert.equal(pending.consumptions.length,2);assert.equal(pending.nextConsumptionCursor,null);assert.notEqual(all.nextConsumptionCursor,pending.nextConsumptionCursor);
});

test('review mode rejects unauthorized roles, malformed filters, foreign and wrong-kind cursors without exposing other rows',async()=>{
 const own=record('CONSUMPTION',0),adjustment=record('STOCK_ADJUSTMENT',0),foreign={...record('CONSUMPTION',999),projectId:'project-other'},db=database([own,adjustment,foreign]);
 for(const role of ['SITE_MANAGER','AUDITOR','WORKER']){await assert.rejects(readInventory(db,{...member,role},project,{reviewer:true,inventoryFilter:'PENDING'}),{code:'INVENTORY_MANAGE_REQUIRED'});await assert.rejects(readInventoryPendingCounts(db,{...member,role},project),{code:'INVENTORY_MANAGE_REQUIRED'});}
 assert.equal(db.calls.length,0);
 for(const inventoryFilter of [null,'OPEN','pending',true,{}])await assert.rejects(readInventory(db,member,project,{reviewer:true,inventoryFilter}),{code:'INVENTORY_QUERY_INVALID'});
 for(const selector of [{consumptionId:own.id},{adjustmentId:adjustment.id}])await assert.rejects(readInventory(db,member,project,{reviewer:true,inventoryFilter:'PENDING',...selector}),{code:'INVENTORY_QUERY_INVALID'});
 for(const selector of [{afterConsumption:foreign.id},{afterConsumption:adjustment.id},{afterAdjustment:own.id},{consumptionId:foreign.id}])await assert.rejects(readInventory(db,member,project,{reviewer:true,inventoryFilter:'ALL',...selector}),{code:'INVENTORY_CURSOR_UNAVAILABLE'});
 const workerDb=database([own]);await assert.rejects(readInventory(workerDb,{...member,role:'AUDITOR',actorId:'other-author'},project,{workerIds:[own.metadata.materialInventory.workerId],afterConsumption:own.id}),{code:'INVENTORY_CURSOR_UNAVAILABLE'});
});

test('pending counts fail closed on missing, invalid or failed database results while zero is an explicit result',async()=>{
 for(const countResult of [[],[{}],[{consumptions:0}],[{consumptions:0,adjustments:'0'}],[{consumptions:-1,adjustments:0}],[{consumptions:0,adjustments:NaN}]])await assert.rejects(readInventoryPendingCounts(database([],{countResult}),member,project),{code:'INVENTORY_READ_UNCONFIRMED'});
 assert.deepEqual(await readInventoryPendingCounts(database([]),member,project),{consumptions:0,adjustments:0});
 const fault=new Error('Synthetic private SQL failure');await assert.rejects(readInventoryPendingCounts({query:async()=>{throw fault;}},member,project),error=>error===fault);
});

test('own pending proposal remains visible but cannot be decided by its informing responsible',async()=>{
 const own=record('CONSUMPTION',0,'PENDING',{submittedBy:member.actorId}),db=database([own]),before=structuredClone({own,project}),view=await readInventory(db,member,project,{reviewer:true,inventoryFilter:'PENDING'});
 assert.equal(view.consumptions[0].canDecide,false);assert.deepEqual(view.pendingCounts,{consumptions:1,adjustments:0});
 await assert.rejects(applyInventoryFieldAction({client:db,member,session,project,command:{action:'DECIDE_CONSUMPTION',payload:{proposalId:own.id,revision:own.revision,catalogHash,decision:'APPROVE',reason:'No puede revisar su propio consumo.'}},receiptId:'field_'+'b'.repeat(64),at:'2026-10-17T12:00:00.000Z'}),{code:'FIELD_MAKER_CHECKER_REQUIRED'});
 assert.deepEqual({own,project},before);
});

test('HTTP opt-in binds one exact filter and cursor, keeps directed recovery in ALL and rejects mixed or repeated selectors before dispatch',async()=>{
 const calls=[],handlers=createFieldHandlers({verify:async()=>session,operations:{inventoryHistory:async(actor,input)=>{calls.push({actor,input});return {scope:input.scope,projectId:input.projectId};}}}),request=input=>new Request('https://obrasaas.com/api/identity/field-operations?'+new URLSearchParams(input));
 for(const inventoryFilter of ['PENDING','ALL'])for(const selector of [{},{afterConsumption:'consumption-a'},{afterAdjustment:'adjustment-a'},...(inventoryFilter==='ALL'?[{consumptionId:'consumption-a'},{adjustmentId:'adjustment-a'}]:[])]){
  const input={...context,inventoryFilter,...selector},response=await handlers.GET(request(input));assert.equal(response.status,200);assert.deepEqual(calls.at(-1),{actor:session,input});assert.match(response.headers.get('cache-control'),/private.*no-store/);
 }
 const count=calls.length,base={...context,inventoryFilter:'PENDING'},invalid=[{...base,inventoryFilter:'OPEN'},{...base,inventoryFilter:''},{...base,consumptionId:'consumption-a'},{...base,adjustmentId:'adjustment-a'},{...base,afterConsumption:'a',afterAdjustment:'b'},{...base,afterConsumption:'bad/id'},...['operationId','proposalId','reviewSection','journeyCursor','workerId'].map(key=>({...base,[key]:'other'})),[...Object.entries(base),['inventoryFilter','ALL']],[...Object.entries(base),['afterConsumption','a'],['afterConsumption','b']]];
 for(const input of invalid)assert.equal((await handlers.GET(request(input))).status,400);assert.equal(calls.length,count);
});

test('opt-in review runs in the canonical read-only project snapshot with unchanged session and scope; legacy keeps its existing transaction mode',async()=>{
 const calls=[],db=database([record('CONSUMPTION',0)]),operations=createFieldOperations({workspace:{projectOperation:async(actor,input,writable,callback,beforeProject)=>{calls.push({actor,input,writable,beforeProject});return callback(db,member,context.scope,project);}}});
 const input={...context,inventoryFilter:'PENDING'},view=await operations.inventoryHistory(session,input);assert.equal(view.scope,context.scope);assert.equal(view.projectId,context.projectId);assert.deepEqual(calls[0],{actor:session,input,writable:false,beforeProject:undefined});
 await operations.inventoryHistory(session,context);assert.equal(calls[1].writable,true);
 for(const role of ['SITE_MANAGER','AUDITOR']){const denied=createFieldOperations({workspace:{projectOperation:async(actor,input,writable,callback)=>{assert.equal(writable,false);return callback(database([]),{...member,role},context.scope,project);}}});await assert.rejects(denied.inventoryHistory(session,input),{code:'INVENTORY_MANAGE_REQUIRED'});}
});
