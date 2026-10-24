import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {usageDigest} from '../src/lib/organization-usage-policy.mjs';
import {createPilotKycCoverage,PILOT_KYC_PRESET,pilotCoverageRequest} from '../src/lib/organization-pilot-coverage.mjs';
import {createOrganizationResourceUsage} from '../src/lib/organization-resource-usage-store.mjs';
import {createPlatformOperatorAuthority} from '../src/lib/platform-operator-authority.mjs';
import {createPlatformPilotCoverageHandlers} from '../src/lib/platform-pilot-coverage-http.mjs';
import {preanalysisMemoryFixture} from './fixtures/participant-preanalysis-memory.mjs';
import {companyUsageView,companyPilotCoverageView} from '../src/app/(identity)/cuenta/company-usage-view.mjs';

function fixture({empty=false}={}){
  const seed=preanalysisMemoryFixture({expired:true}),worker=structuredClone(seed.row),rows=new Map([[seed.receipt.id,structuredClone(seed.receipt)]]),queries=[];
  let now=new Date('2026-10-16T12:00:00.000Z'),role=true,internal=false;
  const source=worker.metadata.participant.kyc;
  if(empty)delete worker.metadata.participant.kyc;
  const member={organizationId:seed.receipt.organizationId,actorId:seed.receipt.actorId};
  const company={id:member.organizationId,subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',trialEndsAt:'2026-10-15T12:00:00.000Z',metadata:{keep:true}};
  const client={release(){},async query(sql,args=[]){
    queries.push({sql,args});
    if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL)/.test(sql)||sql.includes('pg_advisory_xact_lock'))return {rows:[]};
    if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(now)}]};
    if(sql.includes('FROM public."PlatformUser"'))return {rows:role&&args[0]==='user_Operator'&&(!args[1]||args[1]==='platform-operator')?[{id:'platform-operator',clerkUserId:'user_Operator',systemRole:'SUPERADMIN'}]:[]};
    if(sql.includes('FROM public."Organization"'))return {rows:!internal&&args[0]===member.organizationId?[{id:member.organizationId}]:[]};
    if(sql.includes('FROM public."Project"'))return {rows:args[0]===worker.projectId&&args[1]===member.organizationId?[{id:worker.projectId}]:[]};
    if(sql.includes('FROM public."Worker"'))return {rows:args[0]===worker.id&&args[1]===worker.projectId?[structuredClone(worker)]:[]};
    const action=/action='([^']+)'/.exec(sql)?.[1];
    if(sql.startsWith('INSERT INTO public."AuditLog"')){
      const resource=sql.includes("'organization.usage.resource'"),action=/VALUES\(\$1,\$2,\$3,'([^']+)'/.exec(sql)[1];
      assert.equal(rows.has(args[0]),false);rows.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],action,entityType:resource?args[3]:'Worker',entityId:resource?args[4]:args[3],metadata:JSON.parse(resource?args[5]:args[4])});return {rows:[]};
    }
    if(sql.startsWith('UPDATE public."AuditLog"')){if(args[2]&&now.getTime()>=Date.parse(args[2]))return {rows:[],rowCount:0};rows.get(args[0]).metadata=JSON.parse(args[1]);return {rows:[{id:args[0]}],rowCount:1};}
    if(sql.includes('FROM public."AuditLog"')){
      let selected=[...rows.values()].filter(row=>!action||row.action===action);
      if(sql.includes('WHERE id=$1'))selected=selected.filter(row=>row.id===args[0]&&row.organizationId===args[1]);
      else selected=selected.filter(row=>row.organizationId===args[0]);
      if(sql.includes("metadata->'pilotCoverage'->>'grantId'=$2"))selected=selected.filter(row=>row.metadata.pilotCoverage?.grantId===args[1]);
      if(sql.includes("metadata->>'pendingKey'=$2"))selected=selected.filter(row=>row.metadata.pendingKey===args[1]&&['DISPATCHED','UNKNOWN'].includes(row.metadata.state));
      return {rows:structuredClone(selected.slice(0,sql.includes('LIMIT 1')?1:2))};
    }
    assert.fail('Unexpected pilot coverage SQL: '+sql);
  }};
  const authority=createPlatformOperatorAuthority({now:()=>new Date(now),verifySession:async()=>({authenticated:true,userId:'user_Operator',sessionId:'sess_Operator',verification:'clerk-production-jwt',impersonationRejected:true,expiresAt:Math.floor(now.getTime()/1000)+300})});
  const store=createPilotKycCoverage({connect:async()=>client,authority});
  const usage=createOrganizationResourceUsage({connect:async()=>client,lock:async()=>{},company:async()=>({...company,observedAt:new Date(now)}),coverage:async()=>({state:'EXPIRED',startsAt:null,endsAt:company.trialEndsAt}),pilotCoverage:store});
  const request={preset:PILOT_KYC_PRESET,operationId:randomUUID(),organizationId:member.organizationId,projectId:worker.projectId,workerId:worker.id,expectedSubmissionId:empty?null:source.submissionId,expectedContentHash:empty?null:source.contentHash};
  const a=source.processing.auto,binding={version:2,projectId:a.projectId,resourceType:'Worker',resourceId:a.workerId,resourceRevision:digest(['participant-ocr-resource-v1',a.submissionId,a.contentHash]),operationId:a.operationId,stage:'IDENTITY_OPENAI_OCR',sourceSha256:source.images[0].sha256,requestDigest:usageDigest(a),consentVersion:'participant-external-ocr-v2',requestedModel:'gpt-4o'};
  return {store,authority,usage,client,worker,rows,queries,company,member,request,binding,source,cap:()=>authority.authenticate(new Headers()),advance:ms=>{now=new Date(now.getTime()+ms);},revokeIssuer:()=>{role=false;},setInternal:()=>{internal=true;}};
}
const grant=async f=>f.store.create(await f.cap(),f.request);
const reserve=f=>f.usage.reserveResource(f.client,f.member,f.binding);
const dispatched=f=>[...f.rows.values()].filter(row=>row.action==='organization.usage.resource'&&row.metadata.state==='DISPATCHED');

test('one explicit grant covers the exact authorized v2 OCR and preserves expired commercial data',async()=>{
  const f=fixture(),before=structuredClone(f.company),created=await grant(f);
  assert.equal(created.state,'AVAILABLE');assert.equal(created.limit,1);assert.equal(Date.parse(created.expiresAt)-Date.parse(created.issuedAt),86400000);
  const reserved=await reserve(f);assert.ok(reserved.capability);assert.equal(reserved.usage.coverageState,'EXPIRED');
  const row=f.rows.get(reserved.usage.receiptId);assert.equal(row.metadata.pilotCoverage.grantId,created.grantId);
  assert.equal((await f.usage.fence(f.client,f.member,reserved.capability)).dispatched,true);assert.equal(dispatched(f).length,1);
  const read=await f.store.read(await f.cap(),{organizationId:f.member.organizationId});assert.equal(read.state,'CONSUMED');assert.equal(read.remaining,0);assert.deepEqual(f.company,before);
  assert.ok(f.queries.every(({sql})=>!/^UPDATE public\."(Organization|Worker|PlatformUser)"/.test(sql)));
});

test('expired trial remains held until an explicit operator grant exists',async()=>{
  const f=fixture();assert.equal((await reserve(f)).code,'ORGANIZATION_USAGE_COVERAGE_EXPIRED');assert.equal(dispatched(f).length,0);assert.equal([...f.rows.values()].filter(row=>row.action==='organization.usage.resource').length,0);
});

test('grant replay is exact and a new UUID, target or issuer cannot renew the one company preset',async()=>{
  const f=fixture(),first=await grant(f),replay=await grant(f);assert.equal(replay.recovered,true);assert.equal(replay.grantId,first.grantId);
  for(const patch of [{operationId:randomUUID()},{workerId:'different-worker'},{projectId:'different-project'}])await assert.rejects(f.store.create(await f.cap(),{...f.request,...patch}),{code:'PILOT_COVERAGE_ALREADY_ISSUED'});
  assert.equal([...f.rows.values()].filter(row=>row.action==='organization.usage.pilot-granted').length,1);
});

for(const mode of ['expiry','revocation','issuer','source','consent','internal'])test('a reserved slot cannot dispatch after '+mode+' changes, and is not refunded',async()=>{
  const f=fixture(),created=await grant(f),reserved=await reserve(f);assert.ok(reserved.capability);
  if(mode==='expiry')f.advance(86400000);
  if(mode==='revocation')await f.store.revoke(await f.cap(),{organizationId:f.member.organizationId,grantId:created.grantId,operationId:randomUUID()});
  if(mode==='issuer')f.revokeIssuer();
  if(mode==='source')f.worker.metadata.participant.kyc.contentHash='f'.repeat(64);
  if(mode==='consent')f.worker.metadata.participant.kyc.ocrConsent.allowed=false;
  if(mode==='internal')f.setInternal();
  if(mode==='internal')await assert.rejects(f.usage.fence(f.client,f.member,reserved.capability),{code:'PILOT_COVERAGE_TARGET_UNAVAILABLE'});
  else assert.equal((await f.usage.fence(f.client,f.member,reserved.capability)).deferred,true);
  assert.equal(dispatched(f).length,0);assert.equal(f.rows.get(reserved.usage.receiptId).metadata.state,'RESERVED');
  await assert.rejects(f.store.create(await f.cap(),{...f.request,operationId:randomUUID()}),error=>error instanceof WorkspaceError);
});

test('a stored reservation is not switched to a second grant or a different source on replay',async()=>{
  const f=fixture(),created=await grant(f),reserved=await reserve(f),row=f.rows.get(reserved.usage.receiptId);
  row.metadata.pilotCoverage.grantDigest='f'.repeat(64);
  await assert.rejects(f.usage.fence(f.client,f.member,reserved.capability),{code:'PILOT_COVERAGE_BINDING_REJECTED'});assert.equal(dispatched(f).length,0);
  assert.equal(created.limit,1);
});

test('a second reservation or changed canonical source cannot take a consumed slot',async()=>{
  const f=fixture();await grant(f);const first=await reserve(f);assert.ok(first.capability);
  const next=await f.usage.reserveResource(f.client,f.member,{...f.binding,operationId:randomUUID(),sourceSha256:'f'.repeat(64)});assert.equal(next.code,'ORGANIZATION_USAGE_COVERAGE_EXPIRED');assert.equal(next.capability,undefined);
  const replay=await reserve(f);assert.equal(replay.recovered,true);assert.equal(replay.usage.receiptId,first.usage.receiptId);assert.equal((await f.usage.fence(f.client,f.member,replay.capability)).dispatched,true);
  await f.usage.unknown(replay.capability);assert.equal((await reserve(f)).code,'ORGANIZATION_USAGE_ALREADY_DISPATCHED');assert.equal(dispatched(f).length,0);assert.equal(f.rows.get(first.usage.receiptId).metadata.state,'UNKNOWN');
});

for(const patch of [{projectId:'foreign-project'},{resourceId:'foreign-worker'},{stage:'FIELD_OPENAI_VISION',resourceType:'Incident',consentVersion:'field-media-analysis-v1'},{consentVersion:'participant-external-ocr-v1'}])test('the grant does not cover another project, person, stage or historical consent '+JSON.stringify(patch),async()=>{
  const f=fixture();await grant(f);const result=await f.usage.reserveResource(f.client,f.member,{...f.binding,...patch});assert.equal(result.code,'ORGANIZATION_USAGE_COVERAGE_EXPIRED');assert.equal(result.capability,undefined);
});

test('a first-submission grant is consumed only by a later canonical authorized source',async()=>{
  const f=fixture({empty:true});await grant(f);assert.equal((await reserve(f)).deferred,true);
  f.worker.metadata.participant.kyc=f.source;const reserved=await reserve(f);assert.ok(reserved.capability);assert.equal((await f.usage.fence(f.client,f.member,reserved.capability)).dispatched,true);
});

test('an already-held source resumes in place and retains completed independent facial analysis',async()=>{
  const f=fixture(),k=f.worker.metadata.participant.kyc;
  k.processing.status='USAGE_HELD';k.processing.stages.ocr={state:'HELD',code:'ORGANIZATION_USAGE_COVERAGE_EXPIRED'};k.processing.stages.biometric={state:'COMPLETE'};k.processing.biometrics={status:'ADVISORY_UNREVIEWED'};
  const before=structuredClone(k);await grant(f);const reserved=await reserve(f);assert.ok(reserved.capability);assert.equal((await f.usage.fence(f.client,f.member,reserved.capability)).dispatched,true);assert.deepEqual(k,before);
});

for(const state of ['COMPLETE','DISPATCHED','NOT_AUTHORIZED','FAILED'])test('the one grant cannot be consumed by an OCR stage that is already '+state,async()=>{
  const f=fixture();f.worker.metadata.participant.kyc.processing.stages.ocr={state};await assert.rejects(grant(f),{code:'PILOT_COVERAGE_SOURCE_CHANGED'});assert.equal([...f.rows.values()].some(row=>row.action==='organization.usage.pilot-granted'),false);
});

test('a different actor cannot spend the grant for the original automatic source',async()=>{
  const f=fixture();await grant(f);const result=await f.usage.reserveResource(f.client,{...f.member,actorId:'different-actor'},f.binding);assert.equal(result.deferred,true);assert.equal(result.capability,undefined);
});

test('expiration while awaiting canonical source is rechecked before dispatch',async()=>{
  const f=fixture();await grant(f);const reserved=await reserve(f),query=f.client.query;
  f.client.query=async function(sql,args){const result=await query.call(this,sql,args);if(sql.includes('FROM public."Worker"'))f.advance(86400000);return result;};
  assert.equal((await f.usage.fence(f.client,f.member,reserved.capability)).deferred,true);assert.equal(dispatched(f).length,0);
});

test('the final database update also fences expiry after every preceding source check passed',async()=>{
  const f=fixture();await grant(f);const reserved=await reserve(f),query=f.client.query;
  f.client.query=async function(sql,args){if(sql.startsWith('UPDATE public."AuditLog"')){assert.match(sql,/clock_timestamp\(\)<\$3::timestamptz RETURNING id/);f.advance(86400000);}return query.call(this,sql,args);};
  assert.equal((await f.usage.fence(f.client,f.member,reserved.capability)).deferred,true);assert.equal(dispatched(f).length,0);assert.equal(f.rows.get(reserved.usage.receiptId).metadata.state,'RESERVED');
});

test('customer projection is read only, non-nominal and keeps expired commercial coverage distinct',async()=>{
  const f=fixture();await grant(f);const before=f.queries.length,pilot=await f.store.companyProjection(f.client,f.member.organizationId),queries=f.queries.slice(before);
  assert.ok(queries.every(({sql})=>!/(FOR SHARE|FOR UPDATE|INSERT|UPDATE|DELETE|pg_advisory)/.test(sql)));assert.doesNotMatch(JSON.stringify(pilot),/actorId|clerkUserId|workerId|projectId|grantId|submissionId|contentHash/);
  const scope='a'.repeat(64),body={version:3,scope,organization:{id:f.member.organizationId,name:'Empresa sintética'},observedAt:pilot.observedAt,capacity:{state:'CONTRACT_PENDING',cost:null},funding:{state:'UNCONFIRMED'},coverage:{state:'EXPIRED',startsAt:null,endsAt:f.company.trialEndsAt},summary:{total:0,reserved:0,pending:0,observed:0,unmeasured:0,inputTokens:'0',outputTokens:'0',totalTokens:'0',audioSeconds:'0'},recent:[],truncated:false,pilotCoverage:pilot};
  const view=companyUsageView(body,{scope,organizationId:f.member.organizationId});assert.equal(view.coverage.label,'Cobertura finalizada');assert.match(view.pilotCoverage.label,/Una lectura/);assert.equal(view.costLabel,'Costo no determinado');assert.equal(view.fundingLabel,'Financiación de proveedores sin confirmar');
  for(const patch of [{remaining:2},{limit:2},{state:'PAID'},{grantId:'private'},{expiresAt:pilot.issuedAt},{state:'CONSUMED',remaining:1}])assert.throws(()=>companyPilotCoverageView({...pilot,...patch}),{code:'COMPANY_USAGE_RESULT_UNCONFIRMED'});
});

test('revocation is immutable, exact replay is readable and another operation cannot rewrite it',async()=>{
  const f=fixture(),created=await grant(f),input={organizationId:f.member.organizationId,grantId:created.grantId,operationId:randomUUID()};
  assert.equal((await f.store.revoke(await f.cap(),input)).state,'REVOKED');assert.equal((await f.store.revoke(await f.cap(),input)).recovered,true);
  await assert.rejects(f.store.revoke(await f.cap(),{...input,operationId:randomUUID()}),{code:'PILOT_COVERAGE_REVOCATION_CONFLICT'});
  assert.equal((await reserve(f)).deferred,true);await assert.rejects(f.store.create(await f.cap(),{...f.request,operationId:randomUUID()}),{code:'PILOT_COVERAGE_ALREADY_ISSUED'});
});

test('strict request validation rejects additional scope, arbitrary limits and incomplete source pins',()=>{
  const f=fixture();for(const patch of [{limit:20},{expiresAt:'2028-01-01T00:00:00.000Z'},{expectedContentHash:null},{preset:'UNLIMITED'},{operationId:'bad'}])assert.throws(()=>pilotCoverageRequest({...f.request,...patch}),{code:'PILOT_COVERAGE_INPUT_INVALID'});
});

test('forged operator DTO and a revoked issuer cannot create or read a grant',async()=>{
  const f=fixture();await assert.rejects(f.store.create({actorId:'platform-operator'},f.request),{code:'PLATFORM_OPERATOR_PROOF_REQUIRED'});f.revokeIssuer();await assert.rejects(grant(f),{code:'PLATFORM_OPERATOR_REQUIRED'});assert.equal([...f.rows.values()].some(row=>row.action==='organization.usage.pilot-granted'),false);
});

test('operator HTTP rejects cross-origin mutation and only POST explicitly creates or revokes',async()=>{
  const calls=[],authority={authenticate:async()=>({opaque:true})},store=Object.fromEntries(['read','create','revoke'].map(key=>[key,async(_cap,input)=>{calls.push({key,input});return {state:key};}])),handlers=createPlatformPilotCoverageHandlers({authority,store});
  const req=(action='CREATE',origin='https://obrasaas.com')=>new Request('https://obrasaas.com/api/platform/usage-pilot-grants',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action,input:{synthetic:true}})});
  assert.equal((await handlers.POST(req('CREATE','https://evil.invalid'))).status,403);assert.equal(calls.length,0);
  for(const action of ['CREATE','REVOKE']){const response=await handlers.POST(req(action));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);}
  const get=await handlers.GET(new Request('https://obrasaas.com/api/platform/usage-pilot-grants?organizationId=synthetic'));assert.equal(get.status,200);assert.deepEqual(calls.map(c=>c.key),['create','revoke','read']);
  assert.equal((await handlers.GET(new Request('https://obrasaas.com/api/platform/usage-pilot-grants?organizationId=a&organizationId=b'))).status,400);
  assert.equal((await handlers.POST(req('UNKNOWN'))).status,400);assert.equal(calls.length,3);
});
