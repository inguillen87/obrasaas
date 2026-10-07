import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createFieldMedia} from '../src/lib/field-media.mjs';
import {createFieldMediaHandlers} from '../src/lib/field-operations-http.mjs';
import {fieldMediaAnalysisConsent,FIELD_MEDIA_PRIVACY_NOTICE,FIELD_MEDIA_PRIVACY_NOTICE_SHA256} from '../src/lib/field-media-privacy.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

const scope='a'.repeat(64),revision='2026-10-05T12:00:00.000001';
const command={operationId:'abcdefab-1234-4abc-9abc-abcdef123456',projectId:'project-a',scope,evidenceId:'evidence-a',revision,analysisConsent:fieldMediaAnalysisConsent(true)};
test('versioned media consent digest identifies the exact UTF-8 privacy notice',()=>{
 assert.equal(createHash('sha256').update(FIELD_MEDIA_PRIVACY_NOTICE,'utf8').digest('hex'),FIELD_MEDIA_PRIVACY_NOTICE_SHA256);
 assert.equal(fieldMediaAnalysisConsent(true).noticeSha256,FIELD_MEDIA_PRIVACY_NOTICE_SHA256);
});
function fixture(kind,{revokeDuringRead=false,transcript='Synthetic unreviewed audio transcript',changeTaskDuringRead=false,kycDenied=false}={}){
 const bytes=kind==='image'?Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64'):Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(40)]),contentType=kind==='image'?'image/png':'audio/wav',extension=kind==='image'?'png':'wav',pathname='obrasaas/field/v1/'+'b'.repeat(64)+'/evidence.'+extension,metadata={kind,contentType,pathname,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),url:'https://fixture.private.blob.vercel-storage.com/'+pathname};
 const row={id:'evidence-a',title:'Synthetic '+kind,description:'Synthetic private evidence, no identity or field acceptance.',revision,metadata:{unrelated:{retain:true},fieldOperations:{version:1,kind:'EVIDENCE',taskId:'task-a',workerId:'worker-a',sectorId:'sector-a',capturedAt:'2026-10-05T12:00:00Z',recordedBy:'uploader-a',media:metadata,processing:{status:'QUEUED'},review:null}}};
 const receipts=new Map(),queries=[],counts={get:0,provider:0,put:0,transactions:0};let revoked=false,version=1;
 const client={query:async(sql,args)=>{queries.push(sql);
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date()}]};
  if(sql.startsWith('SELECT id,metadata FROM public."AuditLog"'))return {rows:receipts.has(args[0])?[{id:args[0],metadata:receipts.get(args[0])}]:[]};
  if(sql.startsWith('UPDATE public."Incident"')){row.metadata=JSON.parse(args[2]);row.revision='2026-10-05T12:00:00.'+String(++version).padStart(6,'0');return {rows:sql.includes('RETURNING id')?[{id:row.id}]:[]};}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.equal(receipts.has(args[0]),false);receipts.set(args[0],JSON.parse(args[4]));return {rows:[]};}
  assert.fail('Unexpected SQL: '+sql);
 }};
 const task={id:'task-a',title:'Revoque sintético',revision};
 const operations={mediaTransaction:async(_session,_input,_writable,callback)=>{counts.transactions++;return callback(client,{role:'AUDITOR',actorId:'uploader-a',organizationId:'company-a'},scope,{});},readTask:async()=>structuredClone(task),readEvidence:async()=>structuredClone(row),assertWorker:async()=>{if(kycDenied)throw new WorkspaceError('FIELD_KYC_REVIEW_REQUIRED',403);if(revoked)throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);}};
 const analyze=async()=>{counts.provider++;return kind==='image'?{success:true,status:'ANALYZED_UNREVIEWED',aiAnalysis:'Synthetic unreviewed photo analysis'}:{success:true,status:'TRANSCRIBED_UNREVIEWED',text:transcript};};
 const media=createFieldMedia({operations,get:async()=>{counts.get++;if(revokeDuringRead)revoked=true;if(changeTaskDuringRead)task.revision='2026-10-06T12:00:00.000001';return {statusCode:200,blob:{url:metadata.url,pathname,size:bytes.length,contentType},stream:new Response(bytes).body};},put:async()=>{counts.put++;assert.fail('PROCESS must not upload another original');},analyzer:{analyzePhoto:analyze,transcribeAudio:analyze,analyzeVideo:async()=>assert.fail('Photo/audio PROCESS cannot analyze video')}});
 return {media,row,receipts,queries,counts};
}
test('audio processing persists a grounded unreviewed draft and original task context, never a progress proposal',async()=>{
 const f=fixture('audio',{transcript:'Ejecutamos en total 12,5 metros cuadrados de revoque.',changeTaskDuringRead:true}),result=await f.media.process({},command),draft=result.evidence.processing.result.progressDraft;
 assert.equal(draft.quantity,'12.5000');assert.equal(draft.unit,'M2');assert.equal(draft.quantitySemantics,'ACUMULADA');assert.equal(draft.progress,null);assert.equal(draft.baseline,null);assert.equal(draft.task.id,'task-a');assert.equal(draft.task.revision,revision);assert.equal(draft.source.evidenceRevision,revision);assert.equal(draft.source.transcriptSha256,createHash('sha256').update('Ejecutamos en total 12,5 metros cuadrados de revoque.').digest('hex'));assert.equal(result.evidence.status,'PENDING');assert.equal(f.counts.provider,1);assert.ok(f.queries.every(sql=>!sql.includes('public."Task"')&&!sql.includes('public."OperationalProposal"')));
});
test('audio transcription and draft remain unavailable until canonical KYC guard passes',async()=>{
 const f=fixture('audio',{kycDenied:true});await assert.rejects(f.media.process({},command),{code:'FIELD_KYC_REVIEW_REQUIRED'});assert.equal(f.counts.provider,0);assert.equal(f.counts.get,0);assert.equal(f.receipts.size,0);assert.equal(f.row.metadata.fieldOperations.processing.status,'QUEUED');
});
for(const kind of ['image','audio']){
 for(const mode of ['missing','declined','stale-version','invalid-hash','unknown-field'])test('queued '+kind+' without current explicit consent refuses all disclosure: '+mode,async()=>{
  const f=fixture(kind),input={...command};if(mode==='missing')delete input.analysisConsent;if(mode==='declined')input.analysisConsent=fieldMediaAnalysisConsent(false);if(mode==='stale-version')input.analysisConsent={...fieldMediaAnalysisConsent(true),noticeVersion:'old-media-v0'};if(mode==='invalid-hash')input.analysisConsent={...fieldMediaAnalysisConsent(true),noticeSha256:'f'.repeat(64)};if(mode==='unknown-field')input.analysisConsent={...fieldMediaAnalysisConsent(true),inferredFromUpload:true};
  await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_ANALYSIS_CONSENT_REQUIRED'});assert.deepEqual(f.counts,{get:0,provider:0,put:0,transactions:0});assert.equal(f.receipts.size,0);assert.equal(f.row.metadata.fieldOperations.processing.status,'QUEUED');assert.equal(f.queries.some(sql=>/^(?:UPDATE|INSERT)/.test(sql)),false);
 });
 test('explicitly consented '+kind+' processing keeps a private pending result and idempotent receipt without Task/proposal writes',async()=>{
  const f=fixture(kind),result=await f.media.process({},command);assert.equal(result.saved,true);assert.equal(result.evidence.status,'PENDING');assert.equal(result.evidence.processing.status,kind==='image'?'ANALYZED_UNREVIEWED':'TRANSCRIBED_UNREVIEWED');assert.deepEqual(result.evidence.processing.analysisConsent,fieldMediaAnalysisConsent(true));assert.equal(f.counts.provider,1);assert.equal(f.counts.get,1);assert.equal(f.counts.put,0);assert.deepEqual(f.row.metadata.unrelated,{retain:true});assert.ok(f.queries.every(sql=>!sql.includes('public."Task"')&&!sql.includes('public."OperationalProposal"')));const replay=await f.media.process({},command);assert.equal(replay.replayed,true);assert.equal(replay.receiptId,result.receiptId);assert.equal(f.counts.provider,1);assert.equal(f.receipts.size,1);
 });
 test('current '+kind+' ownership is rechecked after private read before provider transfer',async()=>{const f=fixture(kind,{revokeDuringRead:true});await assert.rejects(f.media.process({},command),{code:'FIELD_PARTICIPANT_REQUIRED'});assert.equal(f.counts.provider,0);assert.equal(f.receipts.size,0);});
 test('public PROCESS HTTP cannot bypass '+kind+' consent and keeps private no-store denial',async()=>{
  const f=fixture(kind),handlers=createFieldMediaHandlers({media:f.media,verify:async()=>({authenticated:true,verification:'clerk-production-jwt',userId:'user_Participant',organizationId:'org_A',organizationRole:'org:member'})}),input={...command};delete input.analysisConsent;
  const response=await handlers.POST(new Request('https://obrasaas.com/api/identity/field-media',{method:'POST',headers:{Origin:'https://obrasaas.com','Content-Type':'application/json'},body:JSON.stringify(input)}));assert.equal(response.status,400);assert.equal((await response.json()).code,'FIELD_MEDIA_ANALYSIS_CONSENT_REQUIRED');assert.match(response.headers.get('Cache-Control'),/private.*no-store/);assert.deepEqual(f.counts,{get:0,provider:0,put:0,transactions:0});
 });
}
