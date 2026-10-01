import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {normalizePurchase,applyPurchase,purchaseTotal,purchaseDigest} from '../src/lib/site-purchase-policy.mjs';
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
