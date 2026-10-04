import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldQrHandler} from '../src/lib/field-operations-http.mjs';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';

const scope='a'.repeat(64),projectId='p-a',sectorId='sector-main',configRevision='config-current';
const token='b'.repeat(64),otherToken='c'.repeat(64),configuredAt='2026-10-03T12:00:00.123Z';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Director',organizationId:'org_A',organizationRole:'org:member'};
const configuration=()=>({version:1,configRevision,configuredBy:'owner',configuredAt,sectors:[
  {id:sectorId,qrHash:digest([projectId,sectorId,configRevision,token])},
  {id:'sector-other',qrHash:digest([projectId,'sector-other',configRevision,otherToken])},
]});
const receipt=()=>({id:'field_'+'d'.repeat(64),organizationId:'company-a',actorId:'owner',action:'field.operation.recorded',entityType:'Project',entityId:projectId,
  metadata:{version:1,projectId,command:'CONFIGURE_SITE',requestDigest:'e'.repeat(64),outcome:{kind:'CONFIGURATION',recordedAt:configuredAt,qrTokens:[{sectorId,token},{sectorId:'sector-other',token:otherToken}]}}});
function fixture({role='DIRECTOR',config=configuration(),rows=[receipt()],gateError,svgError}={}) {
  const queries=[],transactions=[],payloads=[];
  const handler=createFieldQrHandler({verify:async()=>session,workspace:{async projectOperation(actor,input,writable,callback){
    transactions.push({actor,input,writable});if(gateError)throw gateError;
    return callback({async query(sql,args){
      queries.push({sql,args});assert.match(sql,/^SELECT /);assert.match(sql,/LIMIT 3/);assert.doesNotMatch(sql,/FOR UPDATE|INSERT|UPDATE |DELETE/);
      return {rows};
    }},{role,actorId:'director',organizationId:'company-a'},scope,{id:projectId,metadata:{fieldOperations:config}});
  }},toSvg:async payload=>{payloads.push(JSON.parse(payload));if(svgError)throw svgError;return '<svg data-fixture="synthetic"/>';}});
  return {handler,queries,transactions,payloads};
}
const baseUrl='https://obrasaas.com/api/identity/field-qr?projectId='+projectId+'&scope='+scope+'&sectorId='+sectorId;
const request=(suffix='&expectedConfigRevision='+configRevision)=>new Request(baseUrl+suffix);
async function unavailable(f,code='FIELD_QR_RECEIPT_UNAVAILABLE',status=409,suffix) {
  const response=await f.handler(request(suffix));assert.equal(response.status,status);assert.deepEqual(await response.json(),{saved:false,code});
  assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(f.payloads.length,0);
}
test('current administrator or director reprints the exact durable configuration token in an authorized read-only transaction',async()=>{
  for(const role of ['ADMIN','DIRECTOR']) {
    const f=fixture({role}),response=await f.handler(request());assert.equal(response.status,200);assert.equal(await response.text(),'<svg data-fixture="synthetic"/>');
    assert.deepEqual(f.transactions,[{actor:session,input:{projectId,scope},writable:false}]);
    assert.deepEqual(f.payloads,[{version:1,projectId,sectorId,token}]);
    assert.deepEqual(f.queries[0].args,['company-a',projectId,'owner',configuredAt]);
    for(const clause of ['"organizationId"=$1','"entityId"=$2','"actorId"=$3',"action='field.operation.recorded'","\"entityType\"='Project'","metadata->>'projectId'=$2","metadata->>'command'='CONFIGURE_SITE'","metadata->'outcome'->>'recordedAt'=$4"])assert.ok(f.queries[0].sql.includes(clause));
    assert.equal(response.headers.get('content-type'),'image/svg+xml');assert.equal(response.headers.get('content-disposition'),'attachment; filename="qr-sector.svg"');
    assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(response.headers.get('vary'),'Cookie, Authorization');
    assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('content-security-policy'),"default-src 'none'; sandbox");
  }
});
test('legacy explicit-token QR remains compatible without looking up any receipt',async()=>{
  const f=fixture({rows:[]}),response=await f.handler(request('&token='+token));assert.equal(response.status,200);assert.equal(f.queries.length,0);assert.deepEqual(f.payloads,[{version:1,projectId,sectorId,token}]);
  const stale=fixture();await unavailable(stale,'FIELD_QR_INVALID',422,'&token='+'f'.repeat(64));assert.equal(stale.queries.length,0);
});
test('observed configuration revision is required and checked before lookup, preventing an implicit newly rotated QR',async()=>{
  for(const suffix of ['', '&expectedConfigRevision=', '&expectedConfigRevision=bad%2Fid', '&token='+token+'&expectedConfigRevision='+configRevision]){
    const f=fixture();await unavailable(f,'FIELD_QUERY_INVALID',400,suffix);assert.equal(f.transactions.length,0);
  }
  const f=fixture();await unavailable(f,'FIELD_REVISION_CHANGED',409,'&expectedConfigRevision=config-old');assert.equal(f.queries.length,0);
  const removed=configuration();removed.configRevision='config-new';removed.sectors=[];
  const missing=fixture({config:removed});await unavailable(missing,'FIELD_REVISION_CHANGED',409);assert.equal(missing.queries.length,0);
});
test('participants and revoked, foreign or stale project scopes never reach token lookup or SVG conversion',async()=>{
  for(const role of ['SITE_MANAGER','FINANCE','AUDITOR','WORKER',null]){
    const f=fixture({role});await unavailable(f,'FIELD_PERMISSION_REQUIRED',403);assert.equal(f.queries.length,0);
  }
  for(const [code,status] of [['WORKSPACE_PROJECT_UNAVAILABLE',404],['WORKSPACE_MEMBERSHIP_REQUIRED',403],['WORKSPACE_CONTEXT_CHANGED',409]]){
    const f=fixture({gateError:new WorkspaceError(code,status)});await unavailable(f,code,status);assert.equal(f.queries.length,0);
  }
});
test('absent, ambiguous or bounded-out receipt sets fail closed without regenerating tokens',async()=>{
  const row=receipt();
  for(const rows of [[],[row,structuredClone(row)],[row,structuredClone(row),structuredClone(row)]])await unavailable(fixture({rows}));
});
test('two same-millisecond configurations are distinguished by the complete current token hashes',async()=>{
  const old=receipt();old.id='field_'+'f'.repeat(64);old.metadata.outcome.qrTokens=[{sectorId:'sector-old',token:'0'.repeat(64)}];
  const f=fixture({rows:[old,receipt()]}),response=await f.handler(request());assert.equal(response.status,200);assert.deepEqual(f.payloads,[{version:1,projectId,sectorId,token}]);
  old.metadata.outcome.qrTokens[0].token='corrupt';await unavailable(fixture({rows:[old,receipt()]}));
});
test('receipt actor, organization, project, namespace and metadata integrity are independently required',async()=>{
  const edits=[r=>{r.id='bad';},r=>{r.organizationId='company-b';},r=>{r.actorId='foreign';},r=>{r.entityId='p-b';},r=>{r.entityType='Other';},r=>{r.action='other.recorded';},
    r=>{r.metadata.version='1';},r=>{r.metadata.projectId='p-b';},r=>{r.metadata.command='ATTENDANCE';},r=>{r.metadata.requestDigest='bad';},r=>{r.metadata.outcome.kind='OTHER';},r=>{r.metadata.outcome.recordedAt='2026-10-03T12:00:00.124Z';}];
  for(const edit of edits){const row=receipt();edit(row);await unavailable(fixture({rows:[row]}));}
});
test('receipt token maps cannot omit, duplicate, substitute, overflow or mismatch any configured sector',async()=>{
  const edits=[r=>{r.metadata.outcome.qrTokens=null;},r=>{r.metadata.outcome.qrTokens=[];},r=>{r.metadata.outcome.qrTokens.pop();},
    r=>{r.metadata.outcome.qrTokens[1].sectorId=sectorId;},r=>{r.metadata.outcome.qrTokens[1].token='f'.repeat(64);},
    r=>{r.metadata.outcome.qrTokens[1].sectorId='sector-foreign';},r=>{r.metadata.outcome.qrTokens[0].extra='not-canonical';},
    r=>{r.metadata.outcome.qrTokens=Array.from({length:21},(_,i)=>({sectorId:'s-'+i,token}));}];
  for(const edit of edits){const row=receipt();edit(row);await unavailable(fixture({rows:[row]}));}
});
test('malformed current configuration never broadens the audit lookup',async()=>{
  const edits=[c=>{c.version=2;},c=>{c.configuredBy=null;},c=>{c.configuredAt='2026-02-30T12:00:00.123Z';},c=>{c.configuredAt='not-a-date';},
    c=>{c.sectors[1].id=sectorId;},c=>{c.sectors[1].qrHash='bad';},c=>{c.sectors.push(...Array.from({length:20},(_,i)=>({id:'s-'+i,qrHash:token})));}];
  for(const edit of edits){const config=configuration();edit(config);const f=fixture({config});await unavailable(f);assert.equal(f.queries.length,0);}
  const f=fixture({config:null});await unavailable(f,'FIELD_REVISION_CHANGED',409);assert.equal(f.queries.length,0);
});
test('duplicate, extra and malformed QR query values are rejected before the project transaction',async()=>{
  for(const suffix of ['&expectedConfigRevision='+configRevision+'&expectedConfigRevision=other','&expectedConfigRevision='+configRevision+'&projectId=p-b','&expectedConfigRevision='+configRevision+'&token=&token='+token,'&expectedConfigRevision='+configRevision+'&actorId=owner','&token=bad']){
    const f=fixture();const response=await f.handler(request(suffix));assert.equal(response.status,400);assert.equal(f.transactions.length,0);assert.equal(f.payloads.length,0);
  }
});
test('anonymous, cross-site and non-GET requests never expose a QR',async()=>{
  let operations=0;
  const services={workspace:{projectOperation:async()=>{operations++;throw new Error('Must not run');}},toSvg:async()=>{throw new Error('Must not render');}};
  const anonymous=createFieldQrHandler({...services,verify:async()=>({authenticated:false})});assert.equal((await anonymous(request())).status,401);
  const signed=createFieldQrHandler({...services,verify:async()=>session});assert.equal((await signed(new Request(request().url,{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
  assert.equal((await signed(new Request(request().url,{method:'POST',headers:{Origin:'https://obrasaas.com'}}))).status,405);assert.equal(operations,0);
});
test('rendering failure returns only the bounded private error, never the token or receipt',async()=>{
  const f=fixture({svgError:new Error('private '+token)}),response=await f.handler(request());assert.equal(response.status,503);assert.deepEqual(await response.json(),{saved:false,code:'FIELD_OPERATION_UNCONFIRMED'});
});
