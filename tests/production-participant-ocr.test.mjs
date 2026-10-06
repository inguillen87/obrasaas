import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {participantKycInput,participantCommand,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';

// No network, real JWT, Blob, database, document, or identity provider is used.
const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fields={isDni:true,nombreCompleto:'Persona OCR sintética',dni:'12345678',cuil:null};
function fixture({role='DIRECTOR',consent=true,analyze,corrupt=false,assessBiometrics}={}){
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Reviewer',organizationId:'org_Fixture',organizationRole:'org:member'};
 const member={actorId:'actor-fixture',organizationId:'company-fixture',role};
 const projectId='project-fixture',scope='a'.repeat(64),images=['document-front','selfie'].map((imageId,index)=>({id:imageId,kind:index?'SELFIE':'DOCUMENT_FRONT',url:'https://fixture.private.blob.vercel-storage.com/obrasaas/legacy-images/v1/'+(index?'b':'a').repeat(64)+'/image.png',contentType:'image/png',bytes:picture.length,sha256:hash(picture)}));
 const row={id:'worker-fixture',name:'Participante sintético',active:true,revision:'2026-10-01T00:00:00.000001',metadata:{unrelated:{retain:true},participant:{version:1,status:'ACTIVE',clerkUserId:'user_Participant',permissions:{attendance:false,report:false},kyc:{version:1,status:'PENDING_REVIEW',submissionId:'kyc-fixture',contentHash:digest(images.map(image=>[image.kind,image.sha256,image.bytes,image.contentType])),images,ocrConsent:{allowed:consent,noticeVersion:PARTICIPANT_OCR_NOTICE_VERSION,noticeSha256:digest(PARTICIPANT_OCR_NOTICE)}}}}};
 let revision=1,now=new Date('2026-10-05T02:00:00.000Z');
 const receipts=new Map(),counts={get:0,analyze:0,sql:[],requests:[]};
 const client={query:async(sql,args)=>{
  counts.sql.push(sql);
  if(sql.startsWith('SELECT pg_advisory'))return {rows:[]};
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(now)}]};
  if(sql.startsWith('SELECT metadata FROM public."AuditLog"'))return {rows:[{metadata:{contentHash:row.metadata.participant.kyc.contentHash}}]};
  if(sql.includes('FROM public."AuditLog"'))return {rows:receipts.has(args[0])?[structuredClone(receipts.get(args[0]))]:[]};
  if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.equal(receipts.has(args[0]),false);receipts.set(args[0],{id:args[0],organizationId:args[1],entityType:args[3],entityId:args[4],metadata:JSON.parse(args[5])});return {rows:[]};}
  if(sql.startsWith('UPDATE public."Worker"')){row.metadata=JSON.parse(args[2]);row.revision='2026-10-01T00:00:00.'+String(++revision).padStart(6,'0');return {rows:[]};}
  if(sql.includes('FROM public."Worker"')){
   if(sql.includes("'processing'->>'operationId'")){const p=row.metadata.participant.kyc.processing;return {rows:p?.operationId===args[1]&&p.actorId===args[2]?[structuredClone(row)]:[]};}
   if(sql.includes("'invitation'->>'operationId'"))return {rows:[]};
   return {rows:[structuredClone(row)]};
  }
  if(sql.includes('FROM public."TenantMembership"'))return {rows:[]};
  assert.fail('Unexpected SQL: '+sql);
 }};
 const workspace={projectOperation:async(active,context,_write,callback)=>{if(active.organizationId!==session.organizationId||context.projectId!==projectId||context.scope!==scope)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);return callback(client,member,scope);}};
 const store=createParticipantStore({workspace,get:async(path)=>{counts.get++;assert.ok(path.endsWith('/image.png'));return {statusCode:200,blob:{url:'https://fixture.private.blob.vercel-storage.com/'+path,size:picture.length,contentType:'image/png'},stream:new Response(corrupt?Buffer.from('corrupt'):picture).body};},analyzer:{analyzeDni:async input=>{counts.analyze++;counts.requests.push(input);return analyze?analyze(input,counts.analyze):{success:true,...fields,verified:true,identityVerified:true};}},assessBiometrics});
 const command=()=>({operationId:randomUUID(),projectId,scope,action:'PROCESS_KYC',payload:{workerId:row.id,revision:row.revision,submissionId:row.metadata.participant.kyc.submissionId}});
 return {session,member,row,store,command,counts,receipts,context:{projectId,scope},advance:ms=>{now=new Date(now.getTime()+ms);}};
}
const submission={operationId:randomUUID(),projectId:'project-fixture',scope:'a'.repeat(64),workerId:'worker-fixture',revision:'2026-10-01T00:00:00.000001',noticeVersion:PARTICIPANT_NOTICE_VERSION,consent:true,front:picture.toString('base64'),selfie:picture.toString('base64')};
const biometricConsent={allowed:true,noticeVersion:PARTICIPANT_BIOMETRIC_NOTICE_VERSION,noticeSha256:digest(PARTICIPANT_BIOMETRIC_NOTICE)};
const advisory={provider:'private-opencv-onnx',modelManifestSha256:'c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860',frontSha256:hash(picture),selfieSha256:hash(picture),success:true,status:'ADVISORY_UNREVIEWED',faceSimilarity:0.61,captureRiskSignal:0.15,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true};
test('biometric choice is independently optional and versioned',()=>{
 assert.equal(participantKycInput(submission).biometricConsent,false);assert.equal(participantKycInput({...submission,biometricConsent:true,biometricNoticeVersion:PARTICIPANT_BIOMETRIC_NOTICE_VERSION}).biometricConsent,true);
 for(const extra of [{biometricConsent:true},{biometricConsent:'true',biometricNoticeVersion:PARTICIPANT_BIOMETRIC_NOTICE_VERSION},{biometricConsent:true,biometricNoticeVersion:'arbitrary'}])assert.throws(()=>participantKycInput({...submission,...extra}));
});
test('generic review/OCR consent never permits selfie transfer or biometrics',async()=>{
 let calls=0;const f=fixture({assessBiometrics:async()=>{calls++;return advisory;}});await f.store.save(f.session,f.command());assert.equal(calls,0);assert.equal(f.counts.get,1);assert.equal(f.row.metadata.participant.kyc.processing.biometrics,undefined);
});
test('private biometric consent works independently with zero OpenAI text extraction calls',async()=>{let calls=0;const f=fixture({consent:false,assessBiometrics:async()=>{calls++;return advisory;}});f.row.metadata.participant.kyc.biometricConsent=biometricConsent;const command=f.command(),result=await f.store.save(f.session,command);assert.equal(calls,1);assert.equal(f.counts.analyze,0);assert.equal(f.counts.get,2);assert.equal(result.participant.kyc.status,'PENDING_REVIEW');assert.equal(result.participant.kyc.processing.status,'ADVISORY_UNREVIEWED');assert.equal(result.participant.kyc.processing.fields,undefined);assert.equal(f.row.metadata.participant.kyc.processing.provider,undefined);assert.equal(result.participant.identityCertified,false);await f.store.save(f.session,command);assert.equal(calls,1);assert.equal(f.counts.analyze,0);});
test('independent private biometric failure keeps manual review available and never calls OpenAI',async()=>{const f=fixture({consent:false,assessBiometrics:async()=>({success:false,code:'BIOMETRIC_DISTINCT_CAPTURES_REQUIRED'})});f.row.metadata.participant.kyc.biometricConsent=biometricConsent;const result=await f.store.save(f.session,f.command());assert.equal(f.counts.analyze,0);assert.equal(result.participant.kyc.status,'PENDING_REVIEW');assert.equal(result.participant.kyc.processing.status,'FAILED_RETRYABLE');assert.equal(result.participant.kyc.processing.biometrics.code,'BIOMETRIC_DISTINCT_CAPTURES_REQUIRED');assert.equal(result.participant.kyc.images.length,2);});
test('separate biometric consent yields only private uncalibrated advisory signals with a fenced 150-second lease',async()=>{
 let calls=0;const f=fixture({assessBiometrics:async input=>{calls++;assert.equal(input.consentVersion,PARTICIPANT_BIOMETRIC_NOTICE_VERSION);assert.deepEqual(input.front.buffer,picture);assert.deepEqual(input.selfie.buffer,picture);assert.equal(Date.parse(f.row.metadata.participant.kyc.processing.expiresAt)-Date.parse(f.row.metadata.participant.kyc.processing.startedAt),150000);return {...advisory,embedding:[12345]};}});f.row.metadata.participant.kyc.biometricConsent=biometricConsent;const command=f.command(),result=await f.store.save(f.session,command);assert.equal(calls,1);assert.equal(f.counts.get,2);assert.equal(result.participant.kyc.status,'PENDING_REVIEW');assert.equal(result.participant.kyc.processing.biometrics.status,'ADVISORY_UNREVIEWED');assert.equal(result.participant.kyc.processing.biometrics.livenessVerified,false);assert.equal(result.participant.kyc.processing.biometrics.embedding,undefined);assert.doesNotMatch(JSON.stringify([...f.receipts.values()]),/faceSimilarity|captureRiskSignal|embedding|12345/);
 await f.store.save(f.session,command);assert.equal(calls,1);f.member.role='AUDITOR';f.session.userId='user_Participant';assert.equal((await f.store.read(f.session,f.context)).records[0].kyc.processing.biometrics,undefined);
});
for(const mode of ['forged-result','exception','unconfigured'])test('biometrics '+mode+' preserves OCR and human review without a certification',async()=>{
 const f=fixture({assessBiometrics:mode==='unconfigured'?undefined:async()=>{if(mode==='exception')throw new Error('PRIVATE_DNI_12345678');return {...advisory,livenessVerified:true,identityCertified:true};}});f.row.metadata.participant.kyc.biometricConsent=biometricConsent;await f.store.save(f.session,f.command());const k=f.row.metadata.participant.kyc;assert.equal(k.status,'PENDING_REVIEW');assert.equal(k.processing.status,'EXTRACTED_UNVERIFIED');assert.equal(k.processing.biometrics.status,'UNAVAILABLE');assert.equal(k.processing.biometrics.identityCertified,false);assert.doesNotMatch(JSON.stringify([...f.receipts.values()]),/PRIVATE_DNI|12345678|embedding/);
});
test('revocation while biometric I/O is pending rejects persistence',async()=>{
 let finish,started;const ready=new Promise(resolve=>{started=resolve;}),f=fixture({assessBiometrics:()=>{started();return new Promise(resolve=>{finish=resolve;});}});f.row.metadata.participant.kyc.biometricConsent=biometricConsent;const result=f.store.save(f.session,f.command());await ready;f.row.metadata.participant.status='REVOKED';finish(advisory);await assert.rejects(result,{code:'PARTICIPANT_ACCESS_REQUIRED'});assert.equal(f.receipts.size,0);
});
for(const patch of [{frontSha256:'f'.repeat(64)},{selfieSha256:'f'.repeat(64)},{provider:'untrusted'},{modelManifestSha256:'f'.repeat(64)},{faceSimilarity:1.1},{captureRiskSignal:'0.3'}])test('biometric provenance/score fails closed: '+Object.keys(patch)[0],async()=>{const f=fixture({assessBiometrics:async()=>({...advisory,...patch})});f.row.metadata.participant.kyc.biometricConsent=biometricConsent;await f.store.save(f.session,f.command());assert.equal(f.row.metadata.participant.kyc.processing.biometrics.status,'UNAVAILABLE');assert.equal(f.row.metadata.participant.kyc.processing.biometrics.faceSimilarity,undefined);});
test('late biometric result cannot finalize an expired claim',async()=>{const f=fixture({assessBiometrics:async()=>{f.advance(151000);return advisory;}});f.row.metadata.participant.kyc.biometricConsent=biometricConsent;await assert.rejects(f.store.save(f.session,f.command()),{code:'PARTICIPANT_OCR_PROCESSING_CHANGED'});assert.equal(f.receipts.size,0);assert.equal(f.row.metadata.participant.kyc.processing.status,'RUNNING');});
test('altered saved descriptor cannot preserve the old receipt content hash',async()=>{const f=fixture();f.row.metadata.participant.kyc.images[0].sha256='f'.repeat(64);await assert.rejects(f.store.save(f.session,f.command()),{code:'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED'});assert.equal(f.counts.get,0);});
test('observed OCR provider/model provenance exists only after validated successful output',async()=>{for(const success of [false,true]){const f=fixture({analyze:async()=>success?{success:true,...fields,provider:'openai',providerModel:'gpt-4o'}:{success:false,code:'AI_PROVIDER_NOT_CONFIGURED'}});await f.store.save(f.session,f.command());assert.equal(f.row.metadata.participant.kyc.processing.provider,success?'openai':undefined);assert.equal(f.row.metadata.participant.kyc.processing.providerModel,success?'gpt-4o':undefined);}});
test('external OCR consent is separate, optional, versioned and cannot be forged',()=>{
 assert.equal(participantKycInput(submission).ocrConsent,false);
 for(const ocrConsent of [false,true])assert.equal(participantKycInput({...submission,ocrConsent,ocrNoticeVersion:PARTICIPANT_OCR_NOTICE_VERSION}).ocrConsent,ocrConsent);
 for(const extra of [{ocrConsent:true},{ocrConsent:'true',ocrNoticeVersion:PARTICIPANT_OCR_NOTICE_VERSION},{ocrConsent:true,ocrNoticeVersion:'client-version'}])assert.throws(()=>participantKycInput({...submission,...extra}));
 const f=fixture(),command=f.command();assert.equal(participantCommand(command).action,'PROCESS_KYC');assert.throws(()=>participantCommand({...command,payload:{...command.payload,verified:true}}),{code:'PARTICIPANT_INPUT_INVALID'});
});
for(const role of ['SITE_MANAGER','FINANCE','AUDITOR'])test('OCR refuses role before private storage: '+role,async()=>{const f=fixture({role});await assert.rejects(f.store.save(f.session,f.command()),{code:'PARTICIPANT_MANAGE_REQUIRED'});assert.equal(f.counts.get,0);assert.equal(f.counts.analyze,0);});
test('old or declined consent preserves manual review and refuses any provider transfer',async()=>{
 for(const old of [false,true]){const f=fixture({consent:false});if(old)delete f.row.metadata.participant.kyc.ocrConsent;await assert.rejects(f.store.save(f.session,f.command()),{code:'PARTICIPANT_OCR_CONSENT_REQUIRED'});assert.equal(f.counts.get,0);assert.equal(f.counts.analyze,0);assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');}
});
for(const mode of ['inactive','revoked','self','foreign-scope','stale','different-submission'])test('OCR rejects current scope/presentation: '+mode,async()=>{
 const f=fixture(),command=f.command();if(mode==='inactive')f.row.active=false;if(mode==='revoked')f.row.metadata.participant.status='REVOKED';if(mode==='self')f.row.metadata.participant.clerkUserId=f.session.userId;if(mode==='foreign-scope')command.scope='b'.repeat(64);if(mode==='stale')command.payload.revision='2026-10-01T00:00:00.999999';if(mode==='different-submission')command.payload.submissionId='kyc-other';
 await assert.rejects(f.store.save(f.session,command));assert.equal(f.counts.get,0);assert.equal(f.counts.analyze,0);
});
test('successful OCR reads only the front, remains private/unverified, and receipt contains no extracted PII',async()=>{
 const f=fixture(),command=f.command(),result=await f.store.save(f.session,command),k=f.row.metadata.participant.kyc;
 assert.equal(f.counts.get,1);assert.equal(f.counts.analyze,1);assert.equal(f.counts.requests[0].base64,picture.toString('base64'));assert.equal(f.counts.requests[0].mimeType,'image/png');
 assert.equal(k.status,'PENDING_REVIEW');assert.equal(result.identityCertified,undefined);assert.equal(result.participant.identityCertified,false);assert.equal(k.processing.status,'EXTRACTED_UNVERIFIED');assert.equal(k.processing.identityVerified,false);assert.deepEqual(k.processing.fields,{nombreCompleto:fields.nombreCompleto,dni:fields.dni,cuil:null});assert.deepEqual(f.row.metadata.unrelated,{retain:true});assert.deepEqual(f.row.metadata.participant.permissions,{attendance:false,report:false});
 assert.doesNotMatch(JSON.stringify([...f.receipts.values()]),/Persona OCR|12345678|nombreCompleto|data:image|\.private\.blob/);assert.equal(f.counts.sql.some(sql=>/UPDATE public\."(?:Task|Attendance|ProjectMembership)"/.test(sql)),false);
 const replay=await f.store.save(f.session,command);assert.equal(replay.replayed,true);assert.equal(replay.receiptId,result.receiptId);assert.equal(f.counts.analyze,1);
 const status=await f.store.status(f.session,{...f.context,operationId:command.operationId});assert.equal(status.state,'RECORDED');assert.equal(status.participant.kyc.status,'PENDING_REVIEW');
 const manager=await f.store.read(f.session,f.context);assert.equal(manager.records[0].kyc.processing.fields.dni,'12345678');f.member.role='AUDITOR';f.session.userId='user_Participant';const own=await f.store.read(f.session,f.context);assert.equal(own.records[0].kyc.processing.fields,undefined);
});
for(const mode of ['revoked','inactive','role-changed','new-submission'])test('recorded OCR replay rechecks authority and exact current evidence: '+mode,async()=>{
 const f=fixture(),command=f.command();await f.store.save(f.session,command);if(mode==='revoked')f.row.metadata.participant.status='REVOKED';if(mode==='inactive')f.row.active=false;if(mode==='role-changed')f.member.role='AUDITOR';if(mode==='new-submission')f.row.metadata.participant.kyc.submissionId='kyc-other';await assert.rejects(f.store.save(f.session,command));await assert.rejects(f.store.status(f.session,{...f.context,operationId:command.operationId}));assert.equal(f.counts.analyze,1);
});
for(const mode of ['provider','malformed','exception','integrity'])test('durable OCR failure is safe and exact replay does not repeat provider: '+mode,async()=>{
 const f=fixture({corrupt:mode==='integrity',analyze:async()=>{if(mode==='exception')throw new Error('PRIVATE_DNI_12345678');return mode==='malformed'?{success:true,verified:true,isDni:true,dni:null}: {success:false,code:'PRIVATE_DNI_12345678'};}}),command=f.command(),result=await f.store.save(f.session,command);
 assert.equal(result.saved,true);assert.equal(f.row.metadata.participant.kyc.processing.status,'FAILED_RETRYABLE');assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');assert.doesNotMatch(JSON.stringify([...f.receipts.values()]),/PRIVATE_DNI|12345678|fields/);const before=f.counts.analyze;await f.store.save(f.session,command);assert.equal(f.counts.analyze,before);
 const retry=await f.store.save(f.session,f.command());assert.equal(retry.saved,true);assert.equal(f.receipts.size,2);
});
test('running OCR exposes recovery without a second provider request',async()=>{
 let finish,started;const ready=new Promise(resolve=>{started=resolve;}),f=fixture({analyze:()=>{started();return new Promise(resolve=>{finish=resolve;});}}),command=f.command(),first=f.store.save(f.session,command);await ready;
 const pending=await f.store.save(f.session,command);assert.equal(pending.state,'PROCESSING');assert.equal(pending.retryAfterExpiration,false);const status=await f.store.status(f.session,{...f.context,operationId:command.operationId});assert.equal(status.state,'PROCESSING');assert.equal(status.retryAfterExpiration,false);assert.equal(f.counts.analyze,1);
 finish({success:true,...fields});assert.equal((await first).saved,true);
});
test('an expired attempt uses a new claim and rejects the first late response',async()=>{
 let finish,started;const ready=new Promise(resolve=>{started=resolve;}),f=fixture({analyze:(_input,count)=>count===1?(started(),new Promise(resolve=>{finish=resolve;})):{success:true,...fields}}),command=f.command(),first=f.store.save(f.session,command);await ready;const firstClaim=f.row.metadata.participant.kyc.processing.claimId;f.advance(91000);
 const status=await f.store.status(f.session,{...f.context,operationId:command.operationId});assert.equal(status.retryAfterExpiration,true);
 const second=await f.store.save(f.session,command);assert.equal(second.saved,true);assert.notEqual(f.row.metadata.participant.kyc.processing.claimId,firstClaim);finish({success:true,...fields,nombreCompleto:'Respuesta vieja'});
 // The settled receipt wins; the old attempt cannot replace its fields.
 const replay=await first;assert.equal(replay.replayed,true);assert.equal(f.row.metadata.participant.kyc.processing.fields.nombreCompleto,fields.nombreCompleto);assert.equal(f.counts.analyze,2);
});
test('revocation during provider I/O prevents persistence and result exposure',async()=>{
 const f=fixture({analyze:async()=>{f.row.metadata.participant.status='REVOKED';return {success:true,...fields};}});await assert.rejects(f.store.save(f.session,f.command()),{code:'PARTICIPANT_ACCESS_REQUIRED'});assert.equal(f.receipts.size,0);assert.equal(f.row.metadata.participant.kyc.processing.status,'RUNNING');
});
test('HTTP retains no-store and never reflects provider exception details',async()=>{
 const f=fixture({analyze:async()=>{throw new Error('PRIVATE_DNI_12345678');}}),handlers=createParticipantHandlers({verify:async()=>f.session,store:f.store}),response=await handlers.POST(new Request('https://obrasaas.com/api/identity/participants',{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:JSON.stringify(f.command())}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.doesNotMatch(await response.text(),/PRIVATE_DNI|12345678/);
});
