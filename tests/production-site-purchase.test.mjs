import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {normalizePurchase,applyPurchase,purchaseTotal,purchaseDigest,purchaseReceiptId} from '../src/lib/site-purchase-policy.mjs';
import {createSitePurchaseHandlers} from '../src/lib/site-purchase-http.mjs';
const scope='a'.repeat(64),revision='2026-10-01T12:00:00.123456';
const request={keep:{untouched:true},siteRegister:{version:1,type:'MATERIAL_REQUEST',state:'OPEN',quantity:'12.5',unit:'bolsa',stockChanged:false}};
const command=(action,payload)=>normalizePurchase({operationId:randomUUID(),projectId:'project-a',scope,action,payload:{requestId:'request-a',revision,...payload}});
const draft=()=>command('DRAFT_ORDER',{supplier:'Proveedor de prueba',quantity:'12.500',unitPrice:'123.45',currency:'ARS',reference:'Cotización 1',reason:'Cotización documentada para la etapa inicial.'});
const review=decision=>command('REVIEW_ORDER',{decision,reason:'Decisión autorizada documentada para la prueba.'});
const receive=(quantity,deliveryReference)=>command('RECEIVE_MATERIAL',{quantity,deliveryReference,reason:'Entrega comprobada contra el remito de ensayo.'});
test('purchase totals reuse enterprise exact-decimal half-up and reject overflow',()=>{
 assert.equal(purchaseTotal('12.5','123.45'),'1543.13');assert.equal(purchaseTotal('0.005','1'),'0.01');
 assert.throws(()=>purchaseTotal('99999999999.999','999999999999.99'),{code:'PURCHASE_TOTAL_INVALID'});
});
test('draft never authorizes spending; decision then partial delivery closes only at exact balance',()=>{
 const a=applyPurchase(request,draft(),'actor','server-time');
 assert.equal(a.procurement.state,'DRAFT');assert.equal(a.siteRegister.purchaseAuthorized,undefined);
 const b=applyPurchase(a,review('APPROVED'),'reviewer','server-time');
 assert.equal(b.siteRegister.purchaseAuthorized,true);
 const c=applyPurchase(b,receive('4.250','Remito 1'),'actor','server-time');
 assert.equal(c.procurement.state,'PARTIAL');assert.equal(c.procurement.received,'4.250');assert.equal(c.siteRegister.state,'OPEN');
 const d=applyPurchase(c,receive('8.250','Remito 2'),'actor','server-time');
 assert.equal(d.procurement.state,'RECEIVED');assert.equal(d.siteRegister.state,'RESOLVED');
 assert.deepEqual(d.keep,request.keep);assert.equal(d.siteRegister.stockChanged,false);
});
test('unapproved, duplicate delivery and excess receipt fail without changing the order',()=>{
 const a=applyPurchase(request,draft(),'actor','now');
 assert.throws(()=>applyPurchase(a,receive('1','Remito 1'),'actor','now'),{code:'PURCHASE_APPROVAL_REQUIRED'});
 const b=applyPurchase(a,review('APPROVED'),'reviewer','now'),c=applyPurchase(b,receive('1','Remito 1'),'actor','now');
 assert.throws(()=>applyPurchase(c,receive('1','remito 1'),'actor','now'),{code:'PURCHASE_DELIVERY_ALREADY_RECORDED'});
 assert.throws(()=>applyPurchase(c,receive('12','Remito 2'),'actor','now'),{code:'PURCHASE_RECEIPT_EXCEEDS_ORDER'});
 assert.equal(c.procurement.received,'1.000');
});
test('cancel preserves documented deliveries and prevents further receipt',()=>{
 const a=applyPurchase(request,draft(),'actor','now'),b=applyPurchase(a,review('APPROVED'),'reviewer','now'),c=applyPurchase(b,receive('1','Remito 1'),'actor','now');
 const d=applyPurchase(c,command('CANCEL_ORDER',{reason:'No se entregará el saldo de esta compra.'}),'reviewer','now');
 assert.equal(d.procurement.received,'1.000');assert.equal(d.procurement.receipts.length,1);assert.equal(d.siteRegister.purchaseAuthorized,false);
 assert.throws(()=>applyPurchase(d,receive('1','Remito 2'),'actor','now'),{code:'PURCHASE_APPROVAL_REQUIRED'});
});
test('closed material request cannot be approved or received and cancellation preserves rejection',()=>{
 const a=applyPurchase(request,draft(),'actor','now'),closed={...a,siteRegister:{...a.siteRegister,state:'REJECTED'}};
 assert.throws(()=>applyPurchase(closed,review('APPROVED'),'reviewer','now'),{code:'PURCHASE_REQUEST_CLOSED'});
 const approved=applyPurchase(a,review('APPROVED'),'reviewer','now');
 assert.throws(()=>applyPurchase({...approved,siteRegister:{...approved.siteRegister,state:'RESOLVED'}},receive('1','Remito 1'),'actor','now'),{code:'PURCHASE_REQUEST_CLOSED'});
 assert.equal(applyPurchase(closed,command('CANCEL_ORDER',{reason:'Se cancela la compra de un pedido rechazado.'}),'reviewer','now').siteRegister.state,'REJECTED');
});
test('approved purchase cannot be silently repriced or ordered beyond its request',()=>{
 const a=applyPurchase(request,draft(),'actor','now'),b=applyPurchase(a,review('APPROVED'),'reviewer','now');
 assert.throws(()=>applyPurchase(b,draft(),'actor','now'),{code:'PURCHASE_STATE_CHANGED'});
 assert.throws(()=>applyPurchase(request,{...draft(),payload:{...draft().payload,quantity:'13.000'}},'actor','now'),{code:'PURCHASE_REQUEST_QUANTITY_EXCEEDED'});
});
for(const amount of [1,'-1','1e5','1,5','NaN','0','1.234',' '.repeat(25),'1'.repeat(10000)])test('invalid price cannot enter a purchase: '+String(amount).slice(0,30),()=>{
 assert.throws(()=>normalizePurchase({...draft(),payload:{...draft().payload,unitPrice:amount}}),{code:'PURCHASE_PRICE_INVALID'});
});
test('operation digest binds approved amount, request, actor scope and decision',()=>{
 const a=draft();assert.notEqual(purchaseDigest(a),purchaseDigest({...a,payload:{...a.payload,unitPrice:'1.00'}}));
 assert.notEqual(purchaseDigest(a),purchaseDigest({...a,scope:'b'.repeat(64)}));
});
test('HTTP rejects cross-origin and duplicate queries before touching the store',async()=>{
 let calls=0;const store={save:()=>{calls++;},list:()=>{calls++;}};
 const verify=async()=>({authenticated:true,verification:'clerk-production-jwt',userId:'user_Test',organizationId:'org_Test',organizationRole:'org:admin'});
 const h=createSitePurchaseHandlers({verify,store});
 const post=await h.POST(new Request('https://obrasaas.com/api/identity/site-purchases',{method:'POST',headers:{origin:'https://attacker.test','Content-Type':'application/json'},body:JSON.stringify(draft())}));
 assert.equal(post.status,403);
 const get=await h.GET(new Request('https://obrasaas.com/api/identity/site-purchases?scope='+scope+'&projectId=p&projectId=p'));
 assert.equal(get.status,400);assert.equal(calls,0);assert.match(get.headers.get('cache-control'),/no-store/);
});

import {createSitePurchases} from '../src/lib/site-purchase-store.mjs';
import {purchaseRecord,purchaseSnapshot,purchaseOutcome,purchaseRecordedOutcome,purchaseCanContinue} from '../src/app/(identity)/cuenta/site-purchase-view.mjs';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
function purchaseResultFixture(input=draft()){
 const metadata=applyPurchase(request,input,'actor','2026-10-05T04:00:00Z'),order=metadata.procurement;
 const record={id:'request-a',material:'Material de ensayo',requestedQuantity:'12.5',unit:'bolsa',sector:'Sector de ensayo',requestState:'OPEN',revision,order:{state:order.state,supplier:order.supplier,quantity:order.quantity,unitPrice:order.unitPrice,total:order.total,currency:order.currency,reference:order.reference,received:order.received,decision:null,receipts:[]}};
 const id=purchaseReceiptId('actor',input);return {scope,projectId:input.projectId,state:'RECORDED',saved:true,definitive:true,replayed:true,receiptId:id,receipt:{id,operationId:input.operationId,requestId:input.payload.requestId,action:input.action},record};
}
test('purchase receipt is current-operation correlated and supports later record revisions',()=>{
 const input=draft(),value=purchaseResultFixture(input);assert.equal(purchaseOutcome(value,input),value);value.record.revision='2026-10-05T04:10:00.123456';assert.equal(purchaseOutcome(value,input),value);
 assert.equal(purchaseOutcome({scope,projectId:input.projectId,state:'NOT_OBSERVED',saved:false,definitive:false},input).state,'NOT_OBSERVED');
});
test('purchase POST requires a RECORDED outcome while GET may explicitly remain NOT_OBSERVED',()=>{
 const input=draft(),pending={scope,projectId:input.projectId,state:'NOT_OBSERVED',saved:false,definitive:false};assert.equal(purchaseOutcome(pending,input),pending);assert.throws(()=>purchaseRecordedOutcome(pending,input),{code:'PURCHASE_RESULT_UNCONFIRMED'});const recorded=purchaseResultFixture(input);assert.equal(purchaseRecordedOutcome(recorded,input),recorded);
});
test('purchase POST NOT_OBSERVED keeps its exact reference until a later receipt GET without another POST',async()=>{
 const values=new Map(),storage={get length(){return values.size;},key:i=>[...values.keys()][i]||null,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,withLock:(_name,_signal,callback)=>callback()}),input=draft(),recorded=purchaseResultFixture(input),methods=[];
 const lifecycle=createWorkspaceRequestLifecycle(async()=>'synthetic-token',{journal,fetchImpl:async(_url,options)=>{methods.push(options.method||'GET');return Response.json(options.method==='POST'?{scope,projectId:input.projectId,state:'NOT_OBSERVED',saved:false,definitive:false}:recorded);}});
 await assert.rejects(lifecycle.request('/api/identity/site-purchases',{method:'POST',body:JSON.stringify(input)},async response=>purchaseRecordedOutcome(await response.json(),input)),{code:'PURCHASE_RESULT_UNCONFIRMED'});
 const [entry]=await journal.list(scope);assert.equal(entry.operationId,input.operationId);assert.equal(entry.projectId,input.projectId);assert.deepEqual(Object.keys(entry).sort(),['createdAt','operationId','projectId','resource','scope','version']);assert.deepEqual(methods,['POST']);
 assert.equal((await lifecycle.request(recoveryQuery(entry),{},async response=>purchaseOutcome(await response.json(),entry))).receipt.id,recorded.receipt.id);assert.deepEqual(methods,['POST','GET']);assert.equal((await journal.list(scope)).length,0);lifecycle.abort();
});
for(const [name,change] of [
 ['missing-record',v=>{delete v.record;}],['crossed-request',v=>{v.record.id='request-other';}],['missing-receipt',v=>{delete v.receipt;}],['bad-receipt-id',v=>{v.receiptId='not-a-receipt';v.receipt.id=v.receiptId;}],['crossed-operation',v=>{v.receipt.operationId=randomUUID();}],['crossed-action',v=>{v.receipt.action='CANCEL_ORDER';}],['malformed-action',v=>{v.receipt.action='APPROVE_TASK';}],['crossed-project',v=>{v.projectId='project-other';}],['crossed-scope',v=>{v.scope='b'.repeat(64);}],['malformed-order',v=>{v.record.order.receipts=null;}],
])test('purchase consumer rejects '+name+' before durable ACK',()=>{const input=draft(),value=purchaseResultFixture(input);change(value);assert.throws(()=>purchaseOutcome(value,input));});
test('purchase snapshot rejects duplicates and a targeted response cannot substitute another request',()=>{
 const input=draft(),row=purchaseResultFixture(input).record,value={scope,projectId:input.projectId,records:[row],total:1,nextCursor:null};assert.equal(purchaseSnapshot(value,{...input,requestId:row.id}),value);
 assert.throws(()=>purchaseSnapshot({...value,records:[row,row],total:2},input));assert.throws(()=>purchaseSnapshot(value,{...input,requestId:'request-other'}));
 const tiny={...row,order:{...row.order,quantity:'0.001',unitPrice:'0.01',total:purchaseTotal('0.001','0.01')}};assert.equal(purchaseRecord(tiny),tiny);
});
test('purchase conflict review respects action, unit and current state without rewriting draft fields',()=>{
 const input=draft(),row=purchaseResultFixture(input).record,editor={action:input.action,payload:input.payload,material:row.material,unit:row.unit};assert.equal(purchaseCanContinue(row,editor),true);
 assert.equal(purchaseCanContinue({...row,order:{...row.order,state:'APPROVED'}},editor),false);assert.equal(purchaseCanContinue({...row,unit:'otra unidad'},editor),false);assert.equal(purchaseCanContinue({...row,requestState:'REJECTED'},editor),false);assert.equal(editor.payload.unitPrice,'123.45');
});
test('purchase journal keeps malformed POST and GET then retires only the valid global receipt',async()=>{
 const values=new Map(),storage={get length(){return values.size;},key:i=>[...values.keys()][i]||null,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,withLock:(_name,_signal,callback)=>callback()}),input=draft(),valid=purchaseResultFixture(input);let calls=0;
 const lifecycle=createWorkspaceRequestLifecycle(async()=>'synthetic-token',{journal,fetchImpl:async()=>{calls++;return Response.json({...valid,record:null});}});
 await assert.rejects(lifecycle.request('/api/identity/site-purchases',{method:'POST',body:JSON.stringify(input)},async response=>purchaseOutcome(await response.json(),input)));
 const [entry]=await journal.list(scope);assert.ok(entry);assert.deepEqual(Object.keys(entry).sort(),['createdAt','operationId','projectId','resource','scope','version']);assert.equal(recoveryResult(entry,{...valid,record:null}),null);
 await journal.observe(recoveryQuery(entry),{...valid,record:null});assert.equal((await journal.list(scope)).length,1);
 await journal.observe(recoveryQuery(entry),valid);assert.equal((await journal.list(scope)).length,0);assert.equal(calls,1);lifecycle.abort();
});
function purchaseStoreFixture(input=draft(),alter=()=>{}){
 const result=purchaseResultFixture(input),row={id:result.record.id,title:result.record.material,revision,metadata:{siteRegister:{...request.siteRegister,sector:result.record.sector},procurement:applyPurchase(request,input,'actor','2026-10-05T04:00:00Z').procurement}},found={id:result.receiptId,entityType:'Incident',entityId:row.id,metadata:{version:1,projectId:input.projectId,requestDigest:purchaseDigest(input),command:input.action,before:null,after:row.metadata.procurement}};
 alter(found,row);const calls=[];
 const client={query:async(sql,params)=>{calls.push({sql,params});if(sql.includes('FROM public."AuditLog"'))return {rows:[found]};if(sql.includes('FROM public."Incident"'))return {rows:params[0]===row.id&&params[1]===input.projectId?[row]:[]};throw new Error('Unexpected or mutating fixture query');}};
 const workspace={integrationProject:async(_session,context,writable,callback)=>{assert.equal(writable,false);return callback(client,{actorId:'actor',organizationId:'company-a'},context.scope);}};
 return {store:createSitePurchases({workspace}),input,calls,found};
}
test('purchase legacy version-one AuditLog produces minimal receipt without inventing stored operation metadata',async()=>{
 const fixture=purchaseStoreFixture(),result=await fixture.store.status({},fixture.input);assert.equal(result.state,'RECORDED');assert.equal(result.receipt.operationId,fixture.input.operationId);assert.equal(fixture.found.metadata.operationId,undefined);assert.deepEqual(Object.keys(result.receipt).sort(),['action','id','operationId','requestId']);assert.ok(!JSON.stringify(result.receipt).includes('supplier'));purchaseOutcome(result,fixture.input);
});
for(const [name,alter] of [
 ['wrong-entity-type',found=>{found.entityType='Worker';}],['malformed-entity-id',found=>{found.entityId='../other';}],['crossed-entity-id',found=>{found.entityId='request-other';}],['wrong-version',found=>{found.metadata.version=2;}],['wrong-project',found=>{found.metadata.projectId='project-other';}],['malformed-action',found=>{found.metadata.command='OTHER_ENGINE';}],['crossed-valid-action',found=>{found.metadata.command='CANCEL_ORDER';}],['malformed-digest',found=>{found.metadata.requestDigest='not-a-digest';}],['wrong-receipt-id',found=>{found.id='purchase_'+'b'.repeat(64);}]
])test('purchase AuditLog fails closed for '+name,async()=>{const fixture=purchaseStoreFixture(draft(),alter);await assert.rejects(fixture.store.status({},fixture.input),{code:'PURCHASE_RECEIPT_INTEGRITY'});assert.ok(!fixture.calls.some(call=>/^(UPDATE|INSERT|DELETE)/.test(call.sql)));});
test('purchase directed GET rejects ambiguous or invalid keys before the canonical store',async()=>{
 let calls=0;const h=createSitePurchaseHandlers({verify:async()=>({authenticated:true,verification:'clerk-production-jwt',userId:'user_Test',organizationId:'org_Test',organizationRole:'org:admin'}),store:{list:async(_session,context)=>{calls++;assert.equal(context.requestId,'request-a');return {scope,projectId:context.projectId,records:[],total:0,nextCursor:null};},status:()=>{throw new Error('Unexpected receipt read');}}});
 for(const extra of ['requestId=../x','requestId=request-a&after=request-b','requestId=request-a&operationId='+randomUUID(),'requestId=request-a&requestId=request-a']){const response=await h.GET(new Request('https://obrasaas.com/api/identity/site-purchases?'+new URLSearchParams({scope,projectId:'project-a'})+'&'+extra));assert.equal(response.status,400);assert.match(response.headers.get('cache-control'),/no-store/);}
 assert.equal(calls,0);const response=await h.GET(new Request('https://obrasaas.com/api/identity/site-purchases?'+new URLSearchParams({scope,projectId:'project-a',requestId:'request-a'})));assert.equal(response.status,200);assert.equal(calls,1);
});
