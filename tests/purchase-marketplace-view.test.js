import assert from 'node:assert/strict';
import test from 'node:test';
import { filterPurchaseOrders, purchaseMarketplaceSummary, purchaseOrderPresentation, PURCHASE_ORDER_FILTERS } from '../src/lib/purchase-marketplace-view.js';
const order = (id, patch={}) => ({ id, number:id.toUpperCase(), status:'DRAFT', currency:'ARS', total:'1000', revision:0, supplier:{legalName:'Corralón Álamo'}, lines:[{description:'Cemento Portland',unit:'bolsa'}], ...patch });

test('summary uses only supplied real rows and separates open from approved', () => {
  const result=purchaseMarketplaceSummary({orders:[order('a'),order('b',{status:'APPROVED'}),order('c',{status:'CANCELLED'})],suppliers:[{id:'s1'},{id:'s2'}],receipts:[1,2],commitments:[1]});
  assert.deepEqual(result,{suppliers:2,openOrders:2,approvedOrders:1,receipts:2,commitments:1});
});
test('invalid collections fail closed to zero instead of demo values',()=>{
  assert.deepEqual(purchaseMarketplaceSummary({orders:{},suppliers:null,receipts:'x',commitments:7}),{suppliers:0,openOrders:0,approvedOrders:0,receipts:0,commitments:0});
});
for(const query of ['alamo cemento','ÁLAMO','portland','corralon']){
  test('literal accent-insensitive order search: '+query,()=>{
    const rows=filterPurchaseOrders([order('a'),order('b',{supplier:{legalName:'Metal Norte'},lines:[{description:'Perfil UPN',unit:'barra'}]})],{query});
    assert.deepEqual(rows.map(row=>row.id),['a']);
  });
}
test('status and query compose without mutating source order',()=>{
  const rows=[order('a'),order('b',{status:'APPROVED'}),order('c',{status:'SUBMITTED'})],before=structuredClone(rows);
  assert.deepEqual(filterPurchaseOrders(rows,{status:'APPROVED'}).map(row=>row.id),['b']);
  assert.deepEqual(filterPurchaseOrders(rows,{status:'SUBMITTED',query:'corralon'}).map(row=>row.id),['c']);
  assert.deepEqual(rows,before);
});
test('search treats regex and markup as literal text',()=>{
  const rows=[order('a')];
  for(const query of ['.*','[a-z]','<script>']) assert.equal(filterPurchaseOrders(rows,{query}).length,0);
});
test('unknown order status is presented explicitly',()=>{
  assert.deepEqual(purchaseOrderPresentation('DRAFT'),{label:'Borrador',tone:'neutral'});
  assert.deepEqual(purchaseOrderPresentation('APPROVED'),{label:'Aprobada',tone:'success'});
  assert.deepEqual(purchaseOrderPresentation('WHATEVER'),{label:'Estado no clasificado',tone:'warning'});
});
test('filter catalog is stable and contains every persisted order state used by UI',()=>{
  assert.deepEqual(PURCHASE_ORDER_FILTERS.map(row=>row.value),['ALL','DRAFT','SUBMITTED','APPROVED','CANCELLED']);
});
