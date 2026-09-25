import assert from 'node:assert/strict';
import test from 'node:test';
import { budgetControlSummary, budgetLedgerGroups, budgetLineCurrencyMap, budgetStatusPresentation, budgetVersionTotal, enrichBudgetEntriesWithCurrency } from '../src/lib/budget-control-view.js';

const budget=(id,patch={})=>({id,version:Number(id.slice(1)),status:'DRAFT',currency:'ARS',revision:0,lines:[{id:id+'-l1',amount:'1000'},{id:id+'-l2',amount:'250.50'}],...patch});

test('budget total uses persisted line amounts only',()=>{
  assert.equal(budgetVersionTotal(budget('v1')),1250.5);
  assert.equal(budgetVersionTotal({lines:[{amount:'bad'},{amount:-4},{amount:10}]}),10);
  assert.equal(budgetVersionTotal(null),0);
});
test('summary identifies active version and draft count without inventing values',()=>{
  const rows=[budget('v3'),budget('v2',{status:'ACTIVE',currency:'USD'}),budget('v1',{status:'SUPERSEDED'})];
  const result=budgetControlSummary(rows);
  assert.equal(result.versions,3);assert.equal(result.drafts,1);assert.equal(result.active.id,'v2');assert.equal(result.activeCurrency,'USD');assert.equal(result.activeTotal,1250.5);assert.equal(result.latest.id,'v3');
});
test('line currency map comes from each immutable budget version',()=>{
  const map=budgetLineCurrencyMap([budget('v1',{currency:'ARS'}),budget('v2',{currency:'USD'})]);
  assert.equal(map.get('v1-l1'),'ARS');assert.equal(map.get('v2-l2'),'USD');
});
test('entries are enriched by line id and unknown lines stay unresolved',()=>{
  const source=[{id:'e1',budgetLineId:'v1-l1',amount:'10',kind:'ACTUAL'},{id:'e2',budgetLineId:'missing',amount:'5',kind:'COMMITMENT'}];
  const result=enrichBudgetEntriesWithCurrency(source,[budget('v1',{currency:'ARS'})]);
  assert.deepEqual(result.map(row=>row.currency),['ARS',null]);assert.equal(source[0].currency,undefined);
});
test('ledger groups never sum ARS, USD and unresolved rows together',()=>{
  const groups=budgetLedgerGroups([
    {currency:'ARS',kind:'ACTUAL',amount:'100'},{currency:'ARS',kind:'COMMITMENT',amount:'200'},
    {currency:'USD',kind:'ACTUAL',amount:'3'},{currency:null,kind:'FORECAST',amount:'9'},
  ]);
  assert.deepEqual(groups,[
    {currency:'ARS',COMMITMENT:200,ACTUAL:100,FORECAST:0,count:2},
    {currency:'SIN_MONEDA',COMMITMENT:0,ACTUAL:0,FORECAST:9,count:1},
    {currency:'USD',COMMITMENT:0,ACTUAL:3,FORECAST:0,count:1},
  ]);
});
test('unknown and malformed kinds do not enter monetary buckets',()=>{
  assert.deepEqual(budgetLedgerGroups([{currency:'ARS',kind:'OTHER',amount:'999'}]),[{currency:'ARS',COMMITMENT:0,ACTUAL:0,FORECAST:0,count:1}]);
});
test('status presentation distinguishes active history and unknown state',()=>{
  assert.deepEqual(budgetStatusPresentation('ACTIVE'),{label:'Vigente',tone:'success'});
  assert.deepEqual(budgetStatusPresentation('SUPERSEDED'),{label:'Reemplazado',tone:'muted'});
  assert.deepEqual(budgetStatusPresentation('UNKNOWN'),{label:'Estado no clasificado',tone:'warning'});
});
