import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { database, scope, context } from './helpers/message-report-fixture.js';
import { prepareWhatsAppProgressReport, createWhatsAppProgressReport } from '../src/lib/whatsapp/progress-report.js';
import { messageReportSourceId, messageReportFingerprint, confirmedMessageReport, messageReportPreparationMatches, messageReportRecovery } from '../src/lib/whatsapp/progress-report-policy.js';
const sourceContext = { ...scope, conversationId: context.conversationId, messageId: context.messageId };
async function prepared(f) {
  const p = await prepareWhatsAppProgressReport(f.prisma, context);
  const input = {taskId:'task-a',title:'Parte revisado',summary:'Revisar el material faltante.',sourceVersion:p.source.version};
  const expected = {...sourceContext,reportId:await messageReportSourceId(sourceContext),taskId:input.taskId,sourceVersion:input.sourceVersion,requestFingerprint:await messageReportFingerprint(input)};
  return {p,input,expected,options:{...context,input,operationKey:'report-recovery-000001'}};
}
test('browser hashes are identical to persisted deterministic identities and normalized input hashes', async()=>{
  const f=database(),r=await prepared(f);
  assert.equal(r.expected.reportId,r.p.reportId);
  assert.equal(r.expected.requestFingerprint,createHash('sha256').update(JSON.stringify(r.input)).digest('hex'));
  assert.equal(messageReportPreparationMatches(r.p,r.expected),true);
  assert.equal(f.state.audits.length,0);
});
for(const [name,patch] of [
 ['unrelated record',r=>{r.report.id='wa_report_'+'b'.repeat(64)}],['malformed id',r=>{r.report.id='../other'}],['empty id',r=>{r.report.id=''}],['blank id',r=>{r.report.id=' '}],
 ['missing origin',r=>{delete r.context}],['foreign conversation',r=>{r.context.conversationId='other'}],['foreign tenant',r=>{r.context.organizationId='other'}],
 ['wrong version',r=>{r.sourceVersion='b'.repeat(64)}],['wrong intent',r=>{r.requestFingerprint='c'.repeat(64)}],['wrong task',r=>{r.report.taskId='other'}],['missing replay',r=>{delete r.replayed}],['unsafe extra',r=>{r.token='private'}],
])test('invalid receipt fails closed: '+name,async()=>{
 const f=database(),r=await prepared(f),result=await createWhatsAppProgressReport(f.prisma,r.options);patch(result);
 assert.throws(()=>confirmedMessageReport(result,r.expected),{code:'WHATSAPP_REPORT_UNCONFIRMED'});
});
test('lost write response recovers by GET alone and preserves a later approval',async()=>{
 const f=database(),r=await prepared(f);await createWhatsAppProgressReport(f.prisma,r.options);
 f.state.logs[0].status='APPROVED';f.state.logs[0].revision=2;
 const before=JSON.stringify(f.state),p=await prepareWhatsAppProgressReport(f.prisma,context);
 assert.equal(messageReportPreparationMatches(p,r.expected),true);
 const recovered=confirmedMessageReport({context:p.context,...p.existingReceipt,report:p.existing,replayed:true},r.expected);
 assert.equal(recovered.status,'APPROVED');assert.equal(recovered.revision,2);assert.equal(JSON.stringify(f.state),before);
});
test('source changes after commit do not rewrite original receipt returned by read recovery',async()=>{
 const f=database(),r=await prepared(f);await createWhatsAppProgressReport(f.prisma,r.options);f.state.message.body+=' Nueva precisión';
 const p=await prepareWhatsAppProgressReport(f.prisma,context);assert.notEqual(p.source.version,r.expected.sourceVersion);
 assert.equal(p.existingReceipt.sourceVersion,r.expected.sourceVersion);
 assert.equal(confirmedMessageReport({context:p.context,...p.existingReceipt,report:p.existing,replayed:true},r.expected).id,r.expected.reportId);
});
for(const [name,patch] of [
 ['record id',p=>{p.existing.id='wa_report_'+'c'.repeat(64)}],['expected id',p=>{p.reportId='wa_report_'+'c'.repeat(64)}],['missing audit receipt',p=>{p.existingReceipt=null}],['wrong conversation',p=>{p.context.conversationId='other'}],['missing source',p=>{p.source=null}],['invalid receipt',p=>{p.existingReceipt.requestFingerprint=''}]
])test('initial existing record is not trusted without complete preparation: '+name,async()=>{
 const f=database(),r=await prepared(f);await createWhatsAppProgressReport(f.prisma,r.options);const p=await prepareWhatsAppProgressReport(f.prisma,context);patch(p);assert.equal(messageReportPreparationMatches(p,r.expected),false);
});
for(const [field,value] of [['source','foreign'],['projectId','other'],['messageId','other'],['conversationId','other'],['workerId','other'],['taskId',null],['sourceVersion',''],['requestFingerprint','']])test('persisted audit mismatch cannot corroborate existing part: '+field,async()=>{
 const f=database(),r=await prepared(f);await createWhatsAppProgressReport(f.prisma,r.options);f.state.audits[0].metadata[field]=value;const before=JSON.stringify(f.state);
 await assert.rejects(prepareWhatsAppProgressReport(f.prisma,context),{code:'WHATSAPP_REPORT_INTEGRITY'});assert.equal(JSON.stringify(f.state),before);
});
test('record without audit and audit without record never link or recreate',async()=>{
 const f=database(),r=await prepared(f);await createWhatsAppProgressReport(f.prisma,r.options);const saved=f.state.audits.pop();
 await assert.rejects(prepareWhatsAppProgressReport(f.prisma,context),{code:'WHATSAPP_REPORT_INTEGRITY'});f.state.logs=[];f.state.audits=[saved];
 await assert.rejects(prepareWhatsAppProgressReport(f.prisma,context),{code:'WHATSAPP_REPORT_GONE'});
});
test('unknown 400/409/422 are uncertain, not authority to clear a saved attempt',()=>{
 for(const status of [400,409,422,500,502])assert.equal(messageReportRecovery({status,code:'UNKNOWN'}),'uncertain');
 assert.equal(messageReportRecovery({status:409,code:'WHATSAPP_REPORT_SOURCE_CHANGED'}),'refresh');
 assert.equal(messageReportRecovery({status:422,code:'WHATSAPP_REPORT_INVALID'}),'revise');
 assert.equal(messageReportRecovery({status:403}),'blocked');
});
