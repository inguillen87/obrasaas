import test from 'node:test';
import assert from 'node:assert/strict';
import {companyUsageView,companyUsageErrorMessage} from '../src/app/(identity)/cuenta/company-usage-view.mjs';
const scope='a'.repeat(64),organizationId='org-synthetic',now='2026-10-12T12:00:00.000Z';
function fixture(){return {version:1,scope,organization:{id:organizationId,name:'Empresa sintética'},observedAt:now,capacity:{state:'CONTRACT_PENDING',cost:null},funding:{state:'UNCONFIRMED'},coverage:{state:'TRIAL_CURRENT',startsAt:null,endsAt:'2026-10-20T12:00:00.000Z'},summary:{total:1,reserved:0,pending:0,observed:1,unmeasured:0,inputTokens:'9007199254740993',outputTokens:'7',totalTokens:'9007199254741000'},recent:[{receiptId:'organization_usage_'+'b'.repeat(64),state:'OBSERVED',recordedAt:'2026-10-12T11:00:00.000Z',coverageState:'TRIAL_CURRENT',model:'gpt-synthetic',usage:{inputTokens:'9007199254740993',outputTokens:'7',totalTokens:'9007199254741000',cachedInputTokens:'3',reasoningOutputTokens:null}}],truncated:false};}
const view=value=>companyUsageView(value,{scope,organizationId});
const rejects=mutate=>{const value=fixture();mutate(value);assert.throws(()=>view(value),{code:'COMPANY_USAGE_RESULT_UNCONFIRMED'});};
test('independent usage read preserves exact large token quantities without claiming cost capacity or funding',()=>{
 const value=fixture(),before=JSON.stringify(value),result=view(value);assert.equal(JSON.stringify(value),before);assert.equal(result.summary.totalTokens,'9007199254741000');assert.equal(result.recent[0].usage.totalTokens,'9007199254741000');assert.equal(result.capacityLabel,'Límites de uso pendientes de aprobación');assert.equal(result.costLabel,'Costo no determinado');assert.equal(result.fundingLabel,'Financiación de proveedores sin confirmar');assert.equal(result.coverage.label,'Prueba vigente');
});
test('empty ledger is represented as absence of tracked records rather than historical consumption proof',()=>{
 const value=fixture();Object.assign(value.summary,{total:0,observed:0,inputTokens:'0',outputTokens:'0',totalTokens:'0'});value.recent=[];const result=view(value);assert.equal(result.summary.total,0);assert.deepEqual(result.recent,[]);assert.equal(result.costLabel,'Costo no determinado');
});
test('scope and canonical company are both required and never adopted from the response',()=>{
 rejects(value=>{value.scope='c'.repeat(64);});rejects(value=>{value.organization.id='foreign';});assert.throws(()=>companyUsageView(fixture(),{scope:'bad',organizationId}),{code:'COMPANY_USAGE_RESULT_UNCONFIRMED'});assert.throws(()=>companyUsageView(fixture(),{scope}),{code:'COMPANY_USAGE_RESULT_UNCONFIRMED'});
});
test('financial quotas funding or extra private provider fields cannot enter the read view',()=>{
 rejects(value=>{value.capacity.cost=0;});rejects(value=>{value.capacity.state='READY';});rejects(value=>{value.capacity.limit=500;});rejects(value=>{value.funding.state='CONFIRMED';});rejects(value=>{value.providerUrl='https://example.invalid';});rejects(value=>{value.recent[0].prompt='private';});
});
test('coverage uses server instants and enforces trial paid expiration and unconfirmed boundaries',()=>{
 const value=fixture();value.coverage={state:'PAID_PERIOD_OBSERVED',startsAt:'2026-10-01T00:00:00.000Z',endsAt:'2026-11-01T00:00:00.000Z'};assert.equal(view(value).coverage.label,'Período pagado observado');value.coverage={state:'EXPIRED',startsAt:null,endsAt:now};assert.equal(view(value).coverage.label,'Cobertura finalizada');value.coverage={state:'UNCONFIRMED',startsAt:null,endsAt:null};assert.equal(view(value).coverage.endsLabel,null);
 rejects(v=>{v.coverage.endsAt=now;});rejects(v=>{v.coverage={state:'PAID_PERIOD_OBSERVED',startsAt:'2026-10-13T00:00:00.000Z',endsAt:'2026-11-01T00:00:00.000Z'};});rejects(v=>{v.coverage={state:'UNCONFIRMED',startsAt:null,endsAt:now};});
});
test('malformed noncanonical or future observation dates are rejected',()=>{
 for(const time of ['2026-02-31T12:00:00.000Z','2026-10-12T12:00:00Z','2026-10-12T09:00:00.000-03:00','invalid'])rejects(v=>{v.observedAt=time;});rejects(v=>{v.recent[0].recordedAt='2026-10-12T12:00:00.001Z';});
});
test('every nonobserved dispatch state remains a distinct unmeasured or pending record',()=>{
 for(const state of ['RESERVED','DISPATCHED','UNKNOWN','UNMEASURED']){const value=fixture();value.recent[0]={...value.recent[0],state,usage:null};Object.assign(value.summary,{reserved:state==='RESERVED'?1:0,pending:['DISPATCHED','UNKNOWN'].includes(state)?1:0,observed:0,unmeasured:state==='UNMEASURED'?1:0,inputTokens:'0',outputTokens:'0',totalTokens:'0'});assert.equal(view(value).recent[0].state,state);assert.equal(view(value).recent[0].usage,null);}
});
test('historical coverage snapshots are not rewritten using the current coverage date',()=>{
 const value=fixture();value.coverage={state:'EXPIRED',startsAt:null,endsAt:now};assert.equal(view(value).recent[0].coverageState,'TRIAL_CURRENT');
});
test('invalid counts unsafe integers and inconsistent aggregate sums cannot imply available capacity',()=>{
 for(const quantity of [-1,0.5,Number.MAX_SAFE_INTEGER+1,'1'])rejects(value=>{value.summary.total=quantity;});rejects(value=>{value.summary.pending=1;});rejects(value=>{value.summary.totalTokens='1';});
});
test('token details are exact canonical quantities and never added twice',()=>{
 for(const quantity of ['01','-1','1.2','1e3','9'.repeat(31),1])rejects(value=>{value.recent[0].usage.inputTokens=quantity;});rejects(value=>{value.recent[0].usage.totalTokens='1';});rejects(value=>{value.recent[0].usage.cachedInputTokens='9007199254740994';});rejects(value=>{value.recent[0].usage.reasoningOutputTokens='8';});
});
test('receipt identities duplicate records and usage on an unknown attempt fail closed',()=>{
 rejects(value=>{value.recent[0].receiptId='foreign';});rejects(value=>{value.recent.push({...value.recent[0]});value.summary.total=2;value.summary.observed=2;});rejects(value=>{value.recent[0].state='UNKNOWN';});rejects(value=>{value.recent[0].usage=null;});rejects(value=>{value.recent[0].model='https://example.invalid';});
});
test('the bounded recent list and public strings reject overflow malformed and private shapes',()=>{
 rejects(value=>{value.recent=Array.from({length:21},()=>value.recent[0]);});rejects(value=>{value.organization.name='<script>';});rejects(value=>{value.recent[0].usage.cost='149';});rejects(value=>{delete value.summary.unmeasured;});rejects(value=>{value.truncated='false';});
});
test('authorization failures show fixed recovery guidance without exposing server payloads',()=>{
 assert.match(companyUsageErrorMessage({status:403,message:'private'}),/permisos actuales/);assert.match(companyUsageErrorMessage({code:'WORKSPACE_CONTEXT_CHANGED'}),/acceso/);assert.match(companyUsageErrorMessage({status:503}),/no procesa archivos/);assert.ok(!companyUsageErrorMessage({status:503,message:'private'}).includes('private'));
});
