import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {metaPlanImportTransportFixture} from './fixtures/meta-plan-import-transport-synthetic.mjs';
import {documentCurveFixture} from './fixtures/plan-import-document-curve-synthetic.mjs';
import {PLAN_IMPORT_DOCUMENT_CURVE_CONSENT} from '../src/lib/plan-import-policy.mjs';

function fixture(role='ADMIN'){
 let f;
 f=metaPlanImportTransportFixture({role,profile:'DOC_CURVE',planAnalyzer:{async analyze(source,options){
  f.calls.analyze++;
  assert.equal(options.profile,'DOCUMENT_MONTHLY_CURVE_V1');
  assert.equal(options.consent,PLAN_IMPORT_DOCUMENT_CURVE_CONSENT);
  await f.controls.hooks.analyzer?.();
  const sourceSha256=createHash('sha256').update(source.bytes).digest('hex');
  return {success:true,provider:'openai',model:'gpt-4o',requestedModel:'gpt-4o',rows:[],warnings:[],documentCurve:documentCurveFixture({sourceSha256})};
 }}});
 return f;
}
const effects=f=>Object.fromEntries(['graph','attachment','get','put','analyze','taskWrites'].map(key=>[key,f.calls[key]]));

for(const role of ['ADMIN','DIRECTOR'])test('document curve WhatsApp draft uses the real canonical engine without reading or writing Tasks for '+role,async()=>{
 const f=fixture(role),prepared=await f.prepare();
 assert.equal(f.calls.graph,0);assert.equal(f.calls.put,0);
 const result=await f.transport.execute(f.context,prepared),draft=f.planDrafts()[0];
 assert.equal(f.planDrafts().length,1);assert.equal(draft.metadata.status,'READY');
 assert.deepEqual(draft.metadata.rows,[]);assert.deepEqual(draft.metadata.extractedRows,[]);
 assert.equal(draft.metadata.existingTaskCount,null);assert.equal(draft.metadata.baseline,null);
 assert.equal(draft.metadata.analysis.documentCurve.profile,'DOCUMENT_MONTHLY_CURVE_V1');
 assert.equal(draft.metadata.analysis.documentCurve.sourceSha256,f.sha256);
 assert.equal(draft.metadata.analysis.reviewed,false);
 assert.equal(f.calls.sql.some(sql=>sql.includes('public."Task"')),false);
 assert.equal(f.calls.taskWrites,0);assert.equal(f.calls.analyze,1);
 assert.match(result.reply.body,/curva de inversión mensual.*revisión/);
 assert.match(result.reply.body,/no crea tareas ni elige la línea base/);
 assert.doesNotMatch(result.reply.body,/monthlyAmount|cumulativeAmount|25\.00|75\.00|100\.00/);
 assert.match(result.reply.body,/https:\/\/obrasaas\.com\/cuenta\?obra=project-plan-synthetic&plan=plan_draft_[a-f0-9]{64}#plan-import-title/);
 const before=effects(f),recovered=await f.recover();
 assert.deepEqual(await f.transport.execute(f.context,recovered),result);assert.deepEqual(effects(f),before);
});

test('document curve final ACK loss recovers the private draft without another extraction',async()=>{
 const f=fixture(),prepared=await f.prepare();f.controls.failRecordOnce=true;
 await assert.rejects(f.transport.execute(f.context,prepared),/Synthetic final response loss/);
 assert.equal(f.planDrafts()[0].metadata.status,'READY');const before=effects(f);
 const recovered=await f.recover(),result=await f.transport.execute(f.context,recovered);
 assert.equal(result.receiptId,f.planDrafts()[0].id);assert.deepEqual(effects(f),before);
});

test('revoked financial role stops an existing WhatsApp preparation before download or Blob',async()=>{
 const f=fixture(),prepared=await f.prepare();f.r.member.role='SITE_MANAGER';
 await assert.rejects(f.transport.execute(f.context,prepared),error=>error.code==='META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED'||error.code==='PLAN_IMPORT_PERMISSION_REQUIRED');
 assert.deepEqual(effects(f),{graph:0,attachment:0,get:0,put:0,analyze:0,taskWrites:0});
 assert.equal(f.planDrafts().length,0);
});

test('revoked financial role cannot recover a historical READY WhatsApp document',async()=>{
 const f=fixture(),prepared=await f.prepare();f.controls.failRecordOnce=true;
 await assert.rejects(f.transport.execute(f.context,prepared));const before=effects(f);
 f.r.member.role='SITE_MANAGER';await assert.rejects(f.recover());assert.deepEqual(effects(f),before);
 assert.equal(f.calls.records,0);
});

test('an import-capable role that loses financial authority after media metadata cannot download the private attachment',async()=>{
 const f=fixture(),prepared=await f.prepare();f.controls.hooks.graph=()=>{f.r.member.role='SITE_MANAGER';};
 await assert.rejects(f.transport.execute(f.context,prepared),error=>error.code==='META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED'||error.code==='PLAN_IMPORT_PERMISSION_REQUIRED');
 assert.deepEqual(effects(f),{graph:1,attachment:0,get:0,put:0,analyze:0,taskWrites:0});
 assert.equal(f.planDrafts().length,0);
});
