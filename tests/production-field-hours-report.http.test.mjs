import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldHandlers} from '../src/lib/field-operations-http.mjs';
import {reportFixture,shift,queryFor,csvRows,addReview} from './helpers/field-hours-fixture.mjs';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_HoursHttp',organizationId:'org_HoursHttp',organizationRole:'org:admin'};
function transport(){
 const f=reportFixture(),calls=[],operations={hoursReport:async(current,context)=>{calls.push({kind:'hours',current,context});return f.read(context.period);},read:async()=>{calls.push({kind:'read'});return {ordinary:true};},save:async(current,body)=>{calls.push({kind:'save',current,body});return {saved:true};}},handlers=createFieldHandlers({verify:async()=>session,operations});
 const request=(params=queryFor(f),options={})=>new Request('https://obrasaas.com/api/identity/field-operations?'+params,options);
 return {...f,calls,operations,handlers,request};
}
test('GET preview and exact CSV share one checked source and preserve private response headers',async()=>{
 const f=transport();f.add(shift());const preview=await f.handlers.GET(f.request());assert.equal(preview.status,200);const body=await preview.json();assert.equal(body.complete,true);assert.equal(body.totals.closedObservedNetMs,28800000);assert.equal(f.calls[0].current,session);assert.equal(f.calls[0].context.projectId,'project-a');
 const response=await f.handlers.GET(f.request(queryFor(f,{hoursFormat:'csv',expectedHoursDigest:body.reportDigest})));assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/csv/);assert.equal(response.headers.get('x-obrasaas-hours-digest'),body.reportDigest);assert.match(response.headers.get('content-disposition'),/^attachment; filename="jornadas-2026-10-01-2026-11-01-hasta-exclusivo.csv"$/);assert.equal(csvRows(await response.text())[0].observed_net_ms,'28800000');
 for(const result of [preview,response]){assert.equal(result.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(result.headers.get('vary'),'Cookie, Authorization');assert.equal(result.headers.get('referrer-policy'),'no-referrer');assert.equal(result.headers.get('x-content-type-options'),'nosniff');assert.equal(result.headers.get('x-robots-tag'),'noindex, nofollow');}
 assert.ok(f.calls.every(call=>call.kind==='hours'));
});
test('a changed review after preview returns a JSON 409 without issuing a changed CSV',async()=>{
 const f=transport(),rows=f.add(shift({verificationStatus:'REVIEW_REQUIRED'})),before=await (await f.handlers.GET(f.request())).json();for(const row of rows)addReview(f,row,'APPROVE');const response=await f.handlers.GET(f.request(queryFor(f,{hoursFormat:'csv',expectedHoursDigest:before.reportDigest})));assert.equal(response.status,409);assert.match(response.headers.get('content-type'),/application\/json/);assert.equal(response.headers.get('content-disposition'),null);assert.deepEqual(await response.json(),{saved:false,code:'FIELD_HOURS_SOURCE_CHANGED'});
});
test('an incomplete source cannot be exported even with the old preview digest',async()=>{
 const f=transport();f.add(shift());const before=await (await f.handlers.GET(f.request())).json();f.state.ledger.push({id:'legacy',projectId:'project-a',workerId:'legacy-person',metadata:{legacy:true}});const response=await f.handlers.GET(f.request(queryFor(f,{hoursFormat:'csv',expectedHoursDigest:before.reportDigest})));assert.equal(response.status,409);assert.deepEqual(await response.json(),{saved:false,code:'FIELD_HOURS_INCOMPLETE'});assert.equal(response.headers.get('content-disposition'),null);
});
const invalidQueries=[
 ['duplicate project',params=>params.append('projectId','foreign')],['duplicate scope',params=>params.append('scope','b'.repeat(64))],['duplicate period',params=>params.append('hoursFrom','2026-10-02')],['missing from',params=>params.delete('hoursFrom')],['missing until',params=>params.delete('hoursUntil')],['missing zone',params=>params.delete('hoursTimeZone')],['missing format',params=>params.delete('hoursFormat')],['unknown format',params=>params.set('hoursFormat','xlsx')],['unexpected role',params=>params.set('role','ADMIN')],['digest with JSON',params=>params.set('expectedHoursDigest','a'.repeat(64))],['CSV without digest',params=>params.set('hoursFormat','csv')],['CSV with invalid digest',params=>{params.set('hoursFormat','csv');params.set('expectedHoursDigest','invented');}],['receipt mixture',params=>params.set('operationId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')],['evidence mixture',params=>params.set('proposalId','proposal-other')],['journey page mixture',params=>params.set('journeyCursor','fake')],['review mixture',params=>params.set('reviewFilter','ALL')]
];
for(const [name,change]of invalidQueries)test('strict hours query refuses '+name+' before any report or ordinary dispatch',async()=>{
 const f=transport(),params=queryFor(f);change(params);const response=await f.handlers.GET(f.request(params));assert.equal(response.status,400);assert.deepEqual(f.calls,[]);assert.deepEqual(await response.json(),{saved:false,code:'FIELD_QUERY_INVALID'});
});
for(const [name,verify,headers,status]of [
 ['anonymous',async()=>({authenticated:false}),{},401],['decoded token',async()=>({...session,verification:'decoded-jwt'}),{},401],['personal account',async()=>({...session,organizationId:null}),{},403],['unavailable issuer',async()=>({authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'}),{},503],['cross-site request',async()=>session,{'Sec-Fetch-Site':'cross-site'},403]
])test(name+' cannot reach the hours source reader',async()=>{
 const f=transport(),handlers=createFieldHandlers({verify,operations:f.operations}),response=await handlers.GET(f.request(queryFor(f),{headers}));assert.equal(response.status,status);assert.deepEqual(f.calls,[]);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
});
test('ordinary GET and POST retain their own dispatch; hours parameters never enter POST',async()=>{
 const f=transport(),ordinary=new URLSearchParams({projectId:'project-a',scope:'a'.repeat(64)});const response=await f.handlers.GET(f.request(ordinary));assert.deepEqual(await response.json(),{ordinary:true});
 const body={synthetic:'unmodified command'};const saved=await f.handlers.POST(new Request('https://obrasaas.com/api/identity/field-operations',{method:'POST',headers:{Origin:'https://obrasaas.com','Content-Type':'application/json'},body:JSON.stringify(body)}));assert.equal(saved.status,200);assert.deepEqual(f.calls.map(call=>call.kind),['read','save']);assert.deepEqual(f.calls[1].body,body);
 const denied=await f.handlers.POST(f.request(queryFor(f),{method:'POST',headers:{Origin:'https://obrasaas.com','Content-Type':'application/json'},body:'{}'}));assert.equal(denied.status,400);assert.equal(f.calls.length,2);
});
test('unexpected reader errors are private 503 JSON, never an accidental CSV download',async()=>{
 const f=transport();f.operations.hoursReport=async()=>{throw new Error('PRIVATE_DATABASE_DETAIL_MUST_NOT_ESCAPE');};const response=await f.handlers.GET(f.request(queryFor(f,{hoursFormat:'csv',expectedHoursDigest:'a'.repeat(64)})));assert.equal(response.status,503);assert.deepEqual(await response.json(),{saved:false,code:'FIELD_OPERATION_UNCONFIRMED'});assert.equal(response.headers.get('content-disposition'),null);
});