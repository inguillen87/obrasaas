import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createOrganizationUsage} from '../src/lib/organization-usage-store.mjs';
import {createPilotMediaAnalyzer} from '../src/lib/pilot-media.mjs';
import {PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE} from '../src/lib/participant-policy.mjs';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';

// Real participant/usage stores and HTTP adapter, with synthetic SQL, images and
// provider responses. No credential, real identity, Blob, database or network.
// This verifies state transitions; it does not certify PostgreSQL lock behavior.
const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
const sourceHash=createHash('sha256').update(picture).digest('hex');
const fields={isDni:true,nombreCompleto:'Persona OCR sintética',dni:'12345678',cuil:null};
const units={prompt_tokens:123,completion_tokens:17,total_tokens:140,prompt_tokens_details:{cached_tokens:20},completion_tokens_details:{reasoning_tokens:2}};
const providerResponse=(patch={})=>Response.json({id:'chatcmpl_synthetic',model:'gpt-4o-2024-08-06',usage:units,choices:[{finish_reason:'stop',message:{content:JSON.stringify(fields)}}],...patch},{headers:{'x-request-id':'req_synthetic'}});

function fixture({response=()=>providerResponse(),configured=true,consent=true,expired=false,role='DIRECTOR',beforeGet}={}){
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Reviewer',organizationId:'org_Synthetic',organizationRole:'org:member'},scope='a'.repeat(64),projectId='project-synthetic';
 const member={actorId:'actor-synthetic',organizationId:'company-synthetic',role},calls={get:0,provider:0,biometrics:0},sqls=[],audits=new Map();
 let now=new Date('2026-10-12T12:00:00.000Z'),revision=1,revoked=false,technicalSnapshot=null;
 const company={id:member.organizationId,name:'Empresa sintética',metadata:{},subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',trialEndsAt:new Date(now.getTime()+(expired?-1:15)*86400000)};
 const images=['document-front','selfie'].map((id,index)=>({id,kind:index?'SELFIE':'DOCUMENT_FRONT',url:'https://synthetic.private.blob.vercel-storage.com/obrasaas/legacy-images/v1/'+(index?'b':'a').repeat(64)+'/image.png',contentType:'image/png',bytes:picture.length,sha256:sourceHash}));
 const row={id:'worker-synthetic',name:'Participante sintético',active:true,revision:'2026-10-12T00:00:00.000001',metadata:{unrelated:{retain:true},participant:{version:1,status:'ACTIVE',clerkUserId:'user_Participant',permissions:{attendance:false,report:false},kyc:{version:1,status:'PENDING_REVIEW',submissionId:'kyc-synthetic',contentHash:digest(images.map(image=>[image.kind,image.sha256,image.bytes,image.contentType])),images,ocrConsent:{allowed:consent,noticeVersion:PARTICIPANT_OCR_NOTICE_VERSION,noticeSha256:digest(PARTICIPANT_OCR_NOTICE)}}}}};
 audits.set('participant_'+ 'f'.repeat(64),{id:'participant_'+ 'f'.repeat(64),organizationId:member.organizationId,actorId:'participant-synthetic',entityType:'Worker',entityId:row.id,action:'participant.operation.recorded',metadata:{version:1,kind:'KYC_SUBMITTED',projectId,submissionId:row.metadata.participant.kyc.submissionId,noticeVersion:PARTICIPANT_NOTICE_VERSION,contentHash:row.metadata.participant.kyc.contentHash}});
 const snapshot=()=>({row:structuredClone(row),audits:structuredClone([...audits]),revision});
 const restore=value=>{Object.assign(row,value.row);audits.clear();for(const [id,audit] of value.audits)audits.set(id,audit);revision=value.revision;};
 const usageRows=()=>[...audits.values()].filter(audit=>audit.action.startsWith('organization.usage.'));
 const client={release(){},async query(sql,values=[]){
  sqls.push(sql);
  if(sql.startsWith('BEGIN')){technicalSnapshot=snapshot();return {rows:[]};}
  if(sql==='ROLLBACK'){if(technicalSnapshot)restore(technicalSnapshot);technicalSnapshot=null;return {rows:[]};}
  if(sql==='COMMIT'){technicalSnapshot=null;return {rows:[]};}
  if(sql.startsWith('SET LOCAL')||sql.includes('pg_advisory_xact_lock'))return {rows:[]};
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(now)}]};
  if(sql.includes('FROM public."Organization"'))return {rows:values[0]===company.id?[sql.startsWith('SELECT id FROM')?{id:company.id}:{...company,observedAt:new Date(now)}]:[]};
  if(sql.startsWith('UPDATE public."Worker"')){assert.equal(values[0],row.id);assert.equal(values[1],projectId);row.metadata=JSON.parse(values[2]);row.revision='2026-10-12T00:00:00.'+String(++revision).padStart(6,'0');return {rows:[]};}
  if(sql.includes('FROM public."Worker"')){
   if(sql.includes("'processing'->>'operationId'")){const claim=row.metadata.participant.kyc.processing;return {rows:claim?.operationId===values[1]&&claim.actorId===values[2]?[structuredClone(row)]:[]};}
   if(sql.includes("'invitation'->>'operationId'"))return {rows:[]};
   return {rows:values[0]===row.id&&values[1]===projectId?[structuredClone(row)]:[]};
  }
  if(sql.startsWith('INSERT INTO public."AuditLog"')){
   const columns=/"AuditLog"\(([^)]+)\)/.exec(sql)?.[1].split(',').map(value=>value.trim().replaceAll('"',''));
   const tokens=/VALUES\(([^)]+)\)/.exec(sql)?.[1].split(',');assert.ok(columns&&tokens&&columns.length===tokens.length);
   const audit={};columns.forEach((key,index)=>{const token=tokens[index].trim(),parameter=/^\$(\d+)/.exec(token);let value=parameter?values[Number(parameter[1])-1]:/^'([^']*)'$/.exec(token)?.[1];if(key==='metadata')value=JSON.parse(value);audit[key]=value;});assert.equal(audits.has(audit.id),false);audits.set(audit.id,audit);return {rows:[]};
  }
  if(sql.startsWith('UPDATE public."AuditLog"')){const audit=audits.get(values[0]);assert.ok(audit);audit.metadata=JSON.parse(values[1]);return {rows:[{id:audit.id}]};}
  if(sql.includes('count(*)::text')){
   const action=/action='([^']+)'/.exec(sql)?.[1],entries=usageRows().filter(audit=>audit.organizationId===values[0]&&(!action||audit.action===action)),summary={total:String(entries.length),reserved:'0',pending:'0',observed:'0',unmeasured:'0',inputTokens:'0',outputTokens:'0',totalTokens:'0',audioSeconds:'0'};
   for(const audit of entries){const key={RESERVED:'reserved',DISPATCHED:'pending',UNKNOWN:'pending',OBSERVED:'observed',UNMEASURED:'unmeasured'}[audit.metadata.state];assert.ok(key);summary[key]=String(Number(summary[key])+1);if(key==='observed'&&audit.metadata.observation.usage)for(const key of ['inputTokens','outputTokens','totalTokens'])summary[key]=String(BigInt(summary[key])+BigInt(audit.metadata.observation.usage[key]));}
   return {rows:[summary]};
  }
  if(sql.includes('FROM public."AuditLog"')){
   let entries=[...audits.values()];
   const action=/action='([^']+)'/.exec(sql)?.[1];if(action)entries=entries.filter(audit=>audit.action===action);
   const actions=/action IN \(([^)]+)\)/.exec(sql)?.[1];if(actions){const list=[...actions.matchAll(/'([^']+)'/g)].map(match=>match[1]);entries=entries.filter(audit=>list.includes(audit.action));}
   for(const match of sql.matchAll(/(?:WHERE |AND )(?:"(organizationId|actorId|entityId)"|(id))=\$(\d+)/g)){const key=match[1]||match[2],value=values[Number(match[3])-1];entries=entries.filter(audit=>audit[key]===value);}
   for(const match of sql.matchAll(/metadata->'binding'->>'([^']+)'=\$(\d+)/g))entries=entries.filter(audit=>audit.metadata.binding?.[match[1]]===values[Number(match[2])-1]);
   for(const match of sql.matchAll(/metadata->>'pendingKey'=\$(\d+)/g))entries=entries.filter(audit=>audit.metadata.pendingKey===values[Number(match[1])-1]);
   for(const match of sql.matchAll(/metadata->>'(kind|submissionId)'=(?:'([^']+)'|\$(\d+))/g)){const value=match[2]??values[Number(match[3])-1];entries=entries.filter(audit=>audit.metadata[match[1]]===value);}
   const states=/metadata->>'state' IN \(([^)]+)\)/.exec(sql)?.[1];if(states){const list=[...states.matchAll(/'([^']+)'/g)].map(match=>match[1]);entries=entries.filter(audit=>list.includes(audit.metadata.state));}
   return {rows:structuredClone(entries)};
  }
  assert.fail('Unexpected synthetic SQL: '+sql);
 }};
 const workspace={async companyRead(_session,context,callback){assert.equal(context.scope,scope);if(revoked)throw new WorkspaceError('WORKSPACE_MEMBERSHIP_REQUIRED',403);return callback(client,member,scope);},async projectOperation(active,context,writable,callback,beforeProject){
  if(revoked)throw new WorkspaceError('WORKSPACE_MEMBERSHIP_REQUIRED',403);if(active.organizationId!==session.organizationId||context.projectId!==projectId||context.scope!==scope)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
  assert.ok(!beforeProject||writable,'organization usage locks must not run in READ ONLY checks');const original=snapshot();try{if(beforeProject)await beforeProject(client,member,scope);return await callback(client,member,scope);}catch(error){if(writable)restore(original);throw error;}
 }};
 const usage=createOrganizationUsage({workspace,connect:async()=>client});
 const analyzer=createPilotMediaAnalyzer({environment:()=>configured?{OPENAI_API_KEY:'synthetic-test-only'}:{},fetchImpl:async(url,options)=>{
  calls.provider++;assert.equal(url,'https://api.openai.com/v1/chat/completions');const request=JSON.parse(options.body),content=request.messages[1].content;assert.equal(request.model,'gpt-4o');assert.equal(content.filter(item=>item.type==='image_url').length,1);assert.equal(content.find(item=>item.type==='image_url').image_url.url,'data:image/png;base64,'+picture.toString('base64'));
  assert.equal(usageRows().filter(audit=>audit.metadata.state==='DISPATCHED').length,1);return response({row,member,usage,audits,company,calls,advance:ms=>{now=new Date(now.getTime()+ms);},revoke:()=>{revoked=true;}});
 }});
 const store=createParticipantStore({workspace,usage,analyzer,assessBiometrics:async()=>{calls.biometrics++;return {success:false,code:'BIOMETRIC_SERVICE_NOT_CONFIGURED'};},get:async path=>{
  calls.get++;if(beforeGet)await beforeGet({row,member,company});return {statusCode:200,blob:{url:'https://synthetic.private.blob.vercel-storage.com/'+path,size:picture.length,contentType:'image/png'},stream:new Response(picture).body};
 }});
 const command=()=>({operationId:randomUUID(),projectId,scope,action:'PROCESS_KYC',payload:{workerId:row.id,revision:row.revision,submissionId:row.metadata.participant.kyc.submissionId}});
 return {session,scope,projectId,member,row,store,usage,calls,sqls,audits,company,command,usageRows,advance:ms=>{now=new Date(now.getTime()+ms);},revoke:()=>{revoked=true;}};
}

test('actual OCR store binds one private front to a company receipt, exact usage and independent human review',async()=>{
 const f=fixture(),command=f.command(),result=await f.store.save(f.session,command);
 assert.equal(result.participant.kyc.processing.status,'EXTRACTED_UNVERIFIED');assert.equal(result.participant.kyc.status,'PENDING_REVIEW');assert.equal(result.participant.identityCertified,false);assert.deepEqual(result.participant.permissions,{attendance:false,report:false});assert.equal(f.calls.get,1);assert.equal(f.calls.biometrics,0);
 const audit=f.usageRows()[0];assert.equal(audit.metadata.binding.version,2);assert.equal(audit.metadata.binding.resourceType,'Worker');assert.equal(audit.metadata.binding.resourceId,f.row.id);assert.equal(audit.metadata.binding.stage,'IDENTITY_OPENAI_OCR');assert.equal(audit.metadata.binding.consentVersion,PARTICIPANT_OCR_NOTICE_VERSION);assert.equal(audit.metadata.binding.sourceSha256,sourceHash);assert.equal(audit.metadata.state,'OBSERVED');assert.equal(audit.metadata.observation.usage.totalTokens,'140');
 const view=await f.usage.read(f.session,{scope:f.scope});assert.equal(view.summary.total,1);assert.equal(view.summary.totalTokens,'140');assert.equal(view.capacity.cost,null);assert.doesNotMatch(JSON.stringify(view),/12345678|Persona OCR|user_Participant|private\.blob|sourceSha256|chatcmpl_synthetic|req_synthetic/);
 assert.doesNotMatch(JSON.stringify(f.usageRows()),/12345678|Persona OCR|base64|private\.blob/);assert.equal((await f.store.save(f.session,command)).replayed,true);assert.equal(f.calls.provider,1);assert.equal((await f.usage.read(f.session,{scope:f.scope})).summary.total,1);
});

for(const [name,patch] of [['refusal',{choices:[{finish_reason:'stop',message:{refusal:'Synthetic refusal'}}]}],['malformed fields',{choices:[{finish_reason:'stop',message:{content:JSON.stringify({isDni:true,dni:null})}}]}],['truncated output',{choices:[{finish_reason:'length',message:{content:JSON.stringify(fields)}}]}]])test(name+' retains actual observed tokens before rejecting OCR output',async()=>{
 const f=fixture({response:()=>providerResponse(patch)}),result=await f.store.save(f.session,f.command());assert.equal(result.participant.kyc.processing.status,'FAILED_RETRYABLE');assert.equal(result.participant.kyc.processing.fields,undefined);assert.equal(f.usageRows()[0].metadata.state,'OBSERVED');assert.equal((await f.usage.read(f.session,{scope:f.scope})).summary.totalTokens,'140');
});

for(const response of [()=>providerResponse({usage:null}),()=>new Response(null,{status:429,headers:{'x-request-id':'req_rejected'}})])test('unmeasured/rejected provider response keeps unknown cost without inventing token zeros',async()=>{
 const f=fixture({response});await f.store.save(f.session,f.command());assert.equal(f.usageRows()[0].metadata.state,'UNMEASURED');assert.equal(f.usageRows()[0].metadata.observation.usage,null);const view=await f.usage.read(f.session,{scope:f.scope});assert.equal(view.summary.observed,0);assert.equal(view.capacity.cost,null);
});

test('unknown dispatch survives a retry receipt and a new operation cannot repeat the same identity source',async()=>{
 const f=fixture({response:()=>{throw Error('Synthetic transport uncertainty');}}),command=f.command();await f.store.save(f.session,command);assert.equal(f.usageRows()[0].metadata.state,'UNKNOWN');await f.store.save(f.session,command);f.advance(200000);const retry=await f.store.save(f.session,f.command());assert.equal(retry.state,'USAGE_HELD');assert.equal(retry.retryAfterExpiration,false);assert.equal(f.calls.provider,1);assert.equal(f.calls.get,1);assert.equal((await f.usage.read(f.session,{scope:f.scope})).summary.pending,1);
});

test('a changed submission and reviewer cannot release unknown consumption for the same Worker and front',async()=>{
 const f=fixture({response:()=>{throw Error('Synthetic transport uncertainty');}});await f.store.save(f.session,f.command());
 f.member.actorId='reviewer-replacement';f.row.metadata.participant.kyc.submissionId='kyc-replacement';delete f.row.metadata.participant.kyc.processing;
 const original=[...f.audits.values()].find(audit=>audit.metadata.kind==='KYC_SUBMITTED'),id='participant_'+ 'e'.repeat(64);f.audits.set(id,{...structuredClone(original),id,metadata:{...original.metadata,submissionId:'kyc-replacement'}});
 const result=await f.store.save(f.session,f.command());assert.equal(result.state,'USAGE_HELD');assert.equal(result.code,'ORGANIZATION_USAGE_RESULT_PENDING');assert.equal(f.calls.provider,1);assert.equal(f.calls.get,1);assert.equal(f.usageRows().length,1);
});

test('expiration while an OCR dispatch is outstanding cannot start a replacement, and late usage remains recorded',async()=>{
 let finish,started;const ready=new Promise(resolve=>{started=resolve;}),f=fixture({response:()=>{started();return new Promise(resolve=>{finish=resolve;});}}),command=f.command(),first=f.store.save(f.session,command);await ready;f.advance(91000);
 const pending=await f.store.save(f.session,command);assert.equal(pending.state,'USAGE_HELD');assert.equal((await f.store.status(f.session,{projectId:f.projectId,scope:f.scope,operationId:command.operationId})).retryAfterExpiration,false);assert.equal(f.calls.provider,1);assert.equal(f.calls.get,1);
 finish(providerResponse());await assert.rejects(first,{code:'PARTICIPANT_OCR_PROCESSING_CHANGED'});assert.equal(f.usageRows()[0].metadata.state,'OBSERVED');assert.equal(f.row.metadata.participant.kyc.processing.fields,undefined);assert.equal((await f.store.save(f.session,command)).state,'USAGE_HELD');assert.equal(f.calls.provider,1);
});

for(const mode of ['reviewer membership','reviewer role','participant access','current consent','current submission'])test(mode+' changes after dispatch retain technical usage and prevent private finalization',async()=>{
 const f=fixture({response:({revoke,row,member})=>{if(mode==='reviewer membership')revoke();if(mode==='reviewer role')member.role='AUDITOR';if(mode==='participant access')row.metadata.participant.status='REVOKED';if(mode==='current consent')row.metadata.participant.kyc.ocrConsent.allowed=false;if(mode==='current submission')row.metadata.participant.kyc.submissionId='kyc-replacement';return providerResponse();}});
 await assert.rejects(f.store.save(f.session,f.command()));assert.equal(f.usageRows()[0].metadata.state,'OBSERVED');assert.equal(f.usageRows()[0].metadata.observation.usage.totalTokens,'140');assert.equal(f.row.metadata.participant.kyc.processing.fields,undefined);assert.equal(f.calls.provider,1);
});

for(const mode of ['consent','role','submission','document hash'])test('current '+mode+' fence rejects the transfer after Blob read and before paid reservation',async()=>{
 const f=fixture({beforeGet:({row,member})=>{if(mode==='consent')row.metadata.participant.kyc.ocrConsent.allowed=false;if(mode==='role')member.role='AUDITOR';if(mode==='submission')row.metadata.participant.kyc.submissionId='kyc-replacement';if(mode==='document hash')row.metadata.participant.kyc.images[0].sha256='e'.repeat(64);}});
 await assert.rejects(f.store.save(f.session,f.command()));assert.equal(f.calls.provider,0);assert.equal(f.usageRows().length,0);assert.equal(f.row.metadata.participant.kyc.processing.fields,undefined);
});

test('current submission receipt proof is checked again after reading the private source',async()=>{
 const f=fixture({beforeGet:()=>{for(const audit of f.audits.values())if(audit.metadata.kind==='KYC_SUBMITTED')audit.metadata.contentHash='e'.repeat(64);}});await assert.rejects(f.store.save(f.session,f.command()),{code:'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED'});assert.equal(f.calls.provider,0);assert.equal(f.usageRows().length,0);
});

test('unconfigured existing provider does not reserve consumption and preserves manual review',async()=>{
 const f=fixture({configured:false}),result=await f.store.save(f.session,f.command());assert.equal(result.participant.kyc.status,'PENDING_REVIEW');assert.equal(result.participant.kyc.processing.code,'AI_PROVIDER_NOT_CONFIGURED');assert.equal(f.usageRows().length,0);assert.equal(f.calls.provider,0);
});

test('literal expired coverage is fenced without transfer or a paid reservation',async()=>{
 const f=fixture({expired:true});await assert.rejects(f.store.save(f.session,f.command()),{code:'ORGANIZATION_USAGE_COVERAGE_EXPIRED'});assert.equal(f.calls.provider,0);assert.equal(f.usageRows().length,0);assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');
});

test('separate private biometric consent causes no OpenAI calls or organization OCR receipt',async()=>{
 const f=fixture({consent:false});f.row.metadata.participant.kyc.biometricConsent={allowed:true,noticeVersion:PARTICIPANT_BIOMETRIC_NOTICE_VERSION,noticeSha256:digest(PARTICIPANT_BIOMETRIC_NOTICE)};await f.store.save(f.session,f.command());assert.equal(f.calls.biometrics,1);assert.equal(f.calls.provider,0);assert.equal(f.usageRows().length,0);
});

test('self review and unauthorized roles stop before private source reads or paid usage',async()=>{
 for(const role of ['SITE_MANAGER','FINANCE','AUDITOR']){const f=fixture({role});await assert.rejects(f.store.save(f.session,f.command()),{code:'PARTICIPANT_MANAGE_REQUIRED'});assert.equal(f.calls.get,0);assert.equal(f.usageRows().length,0);}
 const f=fixture();f.session.userId='user_Participant';await assert.rejects(f.store.save(f.session,f.command()),{code:'PARTICIPANT_SELF_REVIEW_REJECTED'});assert.equal(f.calls.get,0);assert.equal(f.usageRows().length,0);
});
