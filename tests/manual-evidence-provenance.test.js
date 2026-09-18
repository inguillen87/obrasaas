import assert from 'node:assert/strict';
import test from 'node:test';
import { createProgressJournalRecord } from '../src/lib/progress-journal.js';
import { PROTECTED_UPLOAD_PURPOSE } from '../src/lib/protected-uploads.js';
const scope = { organizationId: 'org-a', projectId: 'project-a' };
const request = extra => ({ scope, actorId: 'actor-a', includeSourceEvidence: true, input: { kind:'EVIDENCE', taskId:'task-a', uploadId:'upload-a', operationKey:'manual-request-0001', capturedAt:'2026-09-18T12:00:00.000Z', caption:'Ensayo', ...extra } });
function database() {
  const pathname = 'obrasaas/projects/project-a/progress/object.jpg';
  const state = { evidence: [], audits: [], failAudit:false, upload: {
    id:'upload-a', organizationId:'org-a', projectId:'project-a', actorId:'actor-a', purpose:PROTECTED_UPLOAD_PURPOSE.PROGRESS,
    status:'AVAILABLE', storageProvider:'vercel-blob', storage:{provider:'vercel-blob',publicId:pathname,pathname,bytes:4,resourceType:'image',format:'jpg'},
    size:4,mimeType:'image/jpeg',filename:'object.jpg',sha256:'a'.repeat(64),requestFingerprint:'b'.repeat(64), expiresAt:new Date(Date.now()+86400000),
  } };
  const matches = (row, where) => Object.entries(where).every(([key,value]) => value && typeof value==='object' && 'gt' in value ? row[key]>value.gt : row[key]===value);
  const tx = {
    $executeRawUnsafe: async () => 1,
    project:{findFirst:async ({where}) => where.id===scope.projectId && where.organizationId===scope.organizationId ? {id:scope.projectId,...scope,status:'ACTIVE'} : null},
    task:{findFirst:async ({where}) => where.id==='task-a' && where.projectId===scope.projectId ? {id:'task-a'}:null},
    worker:{findFirst:async () => null},
    protectedUpload:{
      findFirst:async ({where}) => matches(state.upload,where) ? structuredClone(state.upload):null,
      updateMany:async ({where,data}) => {if(!matches(state.upload,where)) return {count:0}; Object.assign(state.upload,data); return {count:1};},
    },
    progressEvidence:{
      findFirst:async ({where}) => structuredClone(state.evidence.find(row=>matches(row,where))||null),
      create:async ({data}) => {
        const row={id:'evidence-a',sourceConversationId:null,sourceMessageId:null,sourceOperationKeyHash:null,sourceRequestFingerprint:null,createdAt:new Date(),status:'PENDING',revision:0,...data};
        const bundle=[row.sourceConversationId,row.sourceMessageId,row.sourceOperationKeyHash,row.sourceRequestFingerprint];
        assert.ok(bundle.every(value=>value===null)||bundle.every(value=>value!==null), 'Match the PostgreSQL source_bundle_check, rather than silently accepting a partial source bundle');
        state.evidence.push(row); return structuredClone(row);
      },
    },
    auditLog:{create:async ({data})=>{if(state.failAudit)throw new Error('AUDIT_FAILED');state.audits.push(data);return data;}},
  };
  return {state,prisma:{$transaction:async action=>{const before=structuredClone(state);try{return await action(tx);}catch(error){Object.assign(state,before);throw error;}}}};
}
test('manual upload is claimed without fabricating WhatsApp provenance',async()=>{
  const {state,prisma}=database();const result=await createProgressJournalRecord(prisma,request());
  assert.equal(result.evidence.source.channel,'dashboard');assert.equal(state.upload.status,'CLAIMED');
  assert.equal(state.upload.claimedEntityId,result.evidence.id);assert.equal(state.audits.length,1);
  for(const key of ['sourceConversationId','sourceMessageId','sourceOperationKeyHash','sourceRequestFingerprint'])assert.equal(state.evidence[0][key],null);
});
test('same operation replays the owned reservation without duplicating evidence or audit',async()=>{
  const {state,prisma}=database();const a=await createProgressJournalRecord(prisma,request());const b=await createProgressJournalRecord(prisma,request());
  assert.equal(b.replayed,true);assert.equal(b.evidence.id,a.evidence.id);assert.equal(state.evidence.length,1);assert.equal(state.audits.length,1);
});
for(const change of [{caption:'Otro contenido'},{operationKey:'another-operation-0002'},{capturedAt:'2026-09-18T13:00:00.000Z'}])test('changed replay rejected: '+Object.keys(change)[0],async()=>{
  const {state,prisma}=database();await createProgressJournalRecord(prisma,request());
  await assert.rejects(createProgressJournalRecord(prisma,request(change)),{code:'IDEMPOTENCY_REPLAY_MUTATED'});
  assert.equal(state.evidence.length,1);assert.equal(state.audits.length,1);
});
test('a different actor cannot claim the file',async()=>{
  const {state,prisma}=database();const options=request();options.actorId='other-actor';
  await assert.rejects(createProgressJournalRecord(prisma,options));assert.equal(state.evidence.length,0);assert.equal(state.upload.status,'AVAILABLE');
});
test('a different project cannot claim this upload',async()=>{
  const {state,prisma}=database();const options=request();options.scope={...scope,projectId:'other-project'};
  await assert.rejects(createProgressJournalRecord(prisma,options));assert.equal(state.evidence.length,0);
});
test('audit failure rolls back both record and claim',async()=>{
  const {state,prisma}=database();state.failAudit=true;
  await assert.rejects(createProgressJournalRecord(prisma,request()),/AUDIT_FAILED/);
  assert.equal(state.evidence.length,0);assert.equal(state.upload.status,'AVAILABLE');
});
