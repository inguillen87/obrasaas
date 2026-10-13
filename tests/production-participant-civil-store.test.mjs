import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import test from 'node:test';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createBindxCivilDataClient,BINDX_CIVIL_CONSENT_VERSION,BINDX_CIVIL_CONFIGURATION_VERSION,BINDX_CIVIL_RESPONSE_SCHEMA} from '../src/lib/bindx-civil-data-client.mjs';
import {civilSha,CIVIL_BOUNDARY,civilObservation} from '../src/lib/participant-civil-policy.mjs';
import {readCivilDocumentSource} from '../src/lib/participant-civil-store.mjs';
import {digest,scopeStamp,WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {PARTICIPANT_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';

// Actual workspace/participant/civil stores and civil HTTP transport, synthetic
// SQL/Blob/provider responses only. The adapter serializes transactions; these
// units do not certify PostgreSQL's lock implementation or a real identity.
const picture=Buffer.from('synthetic-private-document-bytes'),sourceHash=createHash('sha256').update(picture).digest('hex');
const facts={nombres:'Persona',apellido:'Sintética',ejemplar:'A',fecha_nacimiento:'01/01/1990',emision:'01/01/2024',vencimiento:'01/01/2034',codigo_fallecido:0};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

function fixture({configured=true,clientFactory=null,response=()=>Response.json(facts),afterQuery=null,corruptBlob=false,observerTimeoutMs=6000,clientTimeoutMs=15000,afterTechnicalCommit=null,onLookupResult=null}={}){
 let now=new Date('2026-10-13T12:00:00.000Z'),revision=1,commits=0,transactionCount=0;
 const project={id:'project-civil',organizationId:'company-civil',name:'Obra sintética',status:'ACTIVE'};
 const users=new Map([
  ['user_Manager',{actorId:'actor-manager',membershipId:'membership-manager',organizationId:project.organizationId,organizationName:'Empresa sintética',role:'ADMIN',clerkRole:'org:admin',status:'ACTIVE'}],
  ['user_Holder',{actorId:'actor-holder',membershipId:'membership-holder',organizationId:project.organizationId,organizationName:'Empresa sintética',role:'AUDITOR',clerkRole:'org:member',status:'ACTIVE'}],
  ['user_OtherManager',{actorId:'actor-other',membershipId:'membership-other',organizationId:project.organizationId,organizationName:'Empresa sintética',role:'DIRECTOR',clerkRole:'org:member',status:'ACTIVE'}]
 ]);
 const sessionFor=key=>({authenticated:true,verification:'clerk-production-jwt',userId:key,organizationId:'org_Civil',organizationRole:users.get(key).clerkRole});
 const manager=sessionFor('user_Manager'),holder=sessionFor('user_Holder'),other=sessionFor('user_OtherManager');
 const images=['document-front','selfie'].map((id,index)=>({id,kind:index?'SELFIE':'DOCUMENT_FRONT',url:'https://synthetic.private.blob.vercel-storage.com/obrasaas/legacy-images/v1/'+(index?'b':'a').repeat(64)+'/image.png',contentType:'image/png',bytes:picture.length,sha256:sourceHash}));
 const row={id:'worker-civil',projectId:project.id,name:'Titular sintético',active:true,revision:'2026-10-13T00:00:00.000001',metadata:{unrelated:{retained:true},participant:{version:1,status:'ACTIVE',clerkUserId:holder.userId,permissions:{attendance:false,report:false},kyc:{version:1,status:'PENDING_REVIEW',submissionId:'submission-civil',contentHash:digest(images.map(image=>[image.kind,image.sha256,image.bytes,image.contentType])),images,ocrConsent:{allowed:true,noticeVersion:'participant-external-ocr-v1'}}}}};
 const audits=new Map(),sqls=[],calls={login:0,query:0,blob:0,factory:0},controls={settlementGate:null};
 const submission=()=>audits.set('submission-receipt-'+row.metadata.participant.kyc.submissionId,{id:'submission-receipt-'+row.metadata.participant.kyc.submissionId,organizationId:project.organizationId,actorId:users.get(holder.userId).actorId,action:'participant.operation.recorded',entityType:'Worker',entityId:row.id,metadata:{version:1,kind:'KYC_SUBMITTED',projectId:project.id,submissionId:row.metadata.participant.kyc.submissionId,noticeVersion:PARTICIPANT_NOTICE_VERSION,contentHash:row.metadata.participant.kyc.contentHash}});
 submission();
 const reference={reference:'synthetic-contract-only',confirmedAt:'2026-10-12T12:00:00.000Z',confirmed:true},notice={version:BINDX_CIVIL_CONSENT_VERSION,text:'Aviso exclusivamente sintético para prueba de consentimiento civil.',sha256:null};notice.sha256=civilSha(notice.text);
 let configuration=configured?{version:BINDX_CIVIL_CONFIGURATION_VERSION,state:'CONFIRMED',product:'RENAPER_CIVIL_DATA',origin:'https://apistore.pcnt.io',authentication:'JWT',credentials:{username:'synthetic-only',password:'synthetic-only'},providerEvidence:{...reference,origin:'https://apistore.pcnt.io',product:'RENAPER_CIVIL_DATA',authentication:'JWT',responseSchema:BINDX_CIVIL_RESPONSE_SCHEMA,environmentConfirmed:true},renaperAgreement:{...reference},notice}:null;
 let queue=Promise.resolve();
 async function acquire(){const gate=deferred(),prior=queue;queue=prior.then(()=>gate.promise);await prior;return gate.resolve;}
 const state=()=>({row:structuredClone(row),audits:structuredClone([...audits]),revision});
 const restore=value=>{Object.assign(row,value.row);audits.clear();for(const [id,audit]of value.audits)audits.set(id,audit);revision=value.revision;};
 const connect=async()=>{
  let unlock=null,before=null,writable=false;
  return {release(){assert.equal(unlock,null,'connection must close its transaction');},async query(sql,values=[]){
   sqls.push(sql);
   const result=entries=>({rows:structuredClone(entries),rowCount:entries.length});
   if(sql.startsWith('BEGIN')){unlock=await acquire();transactionCount++;before=state();writable=!sql.includes('READ ONLY');return result([]);}
   if(sql==='COMMIT'||sql==='ROLLBACK'){const technicalCommit=sql==='COMMIT'&&writable&&[...audits.values()].some(audit=>audit.action==='participant.civil.observation'&&!before.audits.some(([id])=>id===audit.id));if(sql==='ROLLBACK'&&writable)restore(before);if(sql==='COMMIT')commits++;before=null;transactionCount--;unlock?.();unlock=null;if(technicalCommit)await afterTechnicalCommit?.(f);return result([]);}
   if(sql.startsWith('SET LOCAL')||sql.includes('pg_advisory'))return result([]);
   if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(now)}]};
   if(sql.startsWith('SELECT u.id AS "actorId"')){
    const user=users.get(values[0]);return result(user?.status==='ACTIVE'&&values[1]==='org_Civil'&&values[2]===user.clerkRole?[{...user,clerkUserId:values[0],officeReviewOnly:false}]:[]);
   }
   if(sql.startsWith('SELECT id,name,status::text'))return result(values[0]===project.id&&values[1]===project.organizationId?[project]:[]);
   if(sql.startsWith('SELECT p.id,p.name,p.metadata,o.metadata AS'))return result(values[0]===project.id&&values[1]===project.organizationId?[{...project,metadata:{},organizationMetadata:{}}]:[]);
   if(sql.includes('SELECT w.id FROM public."Worker"'))return result(values[0]===project.organizationId&&row.metadata.participant.clerkUserId===values[1]?[{id:row.id}]:[]);
   if(sql.startsWith('SELECT id,"projectId",active,metadata FROM public."Worker"'))return result(values[0]===project.id&&row.metadata.participant.clerkUserId===values[1]?[row]:[]);
   if(sql.includes('FROM public."ProjectMembership"'))return result([...users.values()].some(user=>user.status==='ACTIVE'&&user.membershipId===values[1])&&values[0]===project.id?[{id:'project-membership'}]:[]);
   if(sql.startsWith('SELECT m.id FROM public."TenantMembership"'))return result(values[0]===users.get(holder.userId).membershipId&&values[1]===project.organizationId&&(values.length===5?values[2]===users.get(holder.userId).actorId&&values[3]===holder.userId&&values[4]===project.id:values[2]===holder.userId&&values[3]===project.id)&&users.get(holder.userId).status==='ACTIVE'?[{id:values[0]}]:[]);
   if(sql.startsWith('SELECT')&&sql.includes('FROM public."Worker"'))return result(values[0]===row.id&&values[1]===project.id?[row]:[]);
   if(sql.startsWith('UPDATE public."Worker"')){assert.ok(writable);assert.equal(values[0],row.id);assert.equal(values[1],project.id);row.metadata=JSON.parse(values[2]);row.revision='2026-10-13T00:00:00.'+String(++revision).padStart(6,'0');return {rows:[],rowCount:1};}
   if(sql.startsWith('UPDATE public."AuditLog"')){assert.ok(writable);const audit=audits.get(values[0]);if(!audit||audit.organizationId!==values[2]||audit.action!==values[3])return {rows:[],rowCount:0};audit.metadata=JSON.parse(values[1]);return {rows:[],rowCount:1};}
   if(sql.startsWith('INSERT INTO public."AuditLog"')){
    assert.ok(writable);const columns=/"AuditLog"\(([^)]+)\)/.exec(sql)[1].split(',').map(key=>key.trim().replaceAll('"','')),tokens=/VALUES\(([^)]+)\)/.exec(sql)[1].split(','),audit={};
    columns.forEach((key,index)=>{const token=tokens[index].trim(),parameter=/^\$(\d+)/.exec(token);const value=parameter?values[Number(parameter[1])-1]:/^'([^']*)'$/.exec(token)?.[1];audit[key]=key==='metadata'?JSON.parse(value):value;});assert.ok(!audits.has(audit.id));audits.set(audit.id,audit);return {rows:[],rowCount:1};
   }
   if(sql.startsWith('SELECT')&&sql.includes('FROM public."AuditLog"')){
    let entries=[...audits.values()];
    for(const match of sql.matchAll(/(?:WHERE |AND )(?:"(organizationId|actorId|entityId|entityType)"|(id|action))=\$(\d+)/g)){const key=match[1]||match[2];entries=entries.filter(audit=>audit[key]===values[Number(match[3])-1]);}
    const action=/action='([^']+)'/.exec(sql)?.[1];if(action)entries=entries.filter(audit=>audit.action===action);
    for(const match of sql.matchAll(/metadata->>'([^']+)'=(?:'([^']+)'|\$(\d+))/g)){const value=match[2]??values[Number(match[3])-1];entries=entries.filter(audit=>audit.metadata[match[1]]===value);}
    if(sql.includes('LIMIT 2'))entries=entries.slice(0,2);return result(entries);
   }
   assert.fail('Uncontrolled synthetic SQL: '+sql);
  }};
 };
 const workspace=createWorkspaceStore({connect});
 const build=()=>createParticipantStore({workspace,connect:async()=>{if(controls.settlementGate)await controls.settlementGate.promise;return connect();},civilConfiguration:()=>configuration,civilClientFactory:options=>{
  calls.factory++;if(clientFactory)return clientFactory(options);
  const client=createBindxCivilDataClient({...options,technicalObservationTimeoutMs:observerTimeoutMs,timeoutMs:clientTimeoutMs,clock:()=>now.getTime(),fetchImpl:async(url,request)=>{
   assert.equal(transactionCount,0,'reservation and consent must commit before any provider request');assert.ok(commits>=3);assert.equal(attempts()[0].metadata.state,'DISPATCHING');
   if(request.method==='POST'){calls.login++;assert.equal(url,'https://apistore.pcnt.io/v1/login/jwt');return Response.json({token:'synthetic.jwt.token'});}
   calls.query++;assert.equal(request.method,'GET');assert.equal(url,'https://apistore.pcnt.io/v1/information/person-renaper/00012345/gender/F');if(afterQuery)await afterQuery(f);return response(f);
  }});return onLookupResult?{lookup:async()=>{const value=await client.lookup();onLookupResult(value);return value;}}:client;
 },get:async pathname=>{calls.blob++;assert.equal(transactionCount,0);assert.equal(pathname,'obrasaas/legacy-images/v1/'+'a'.repeat(64)+'/image.png');return {statusCode:200,blob:{url:images[0].url,size:picture.length,contentType:'image/png'},stream:new Response(corruptBlob?Buffer.from('corrupt-document'):picture).body};}});
 const scope=session=>scopeStamp(session,users.get(session.userId)),context=(session=manager,operation)=>({projectId:project.id,scope:scope(session),workerId:row.id,submissionId:row.metadata.participant.kyc.submissionId,...(operation?{operationId:operation}:{})});
 const prepare=(store=build(),session=manager,operation=randomUUID())=>store.civilPrepare(session,{...context(session,operation),revision:row.revision});
 const consentInput=(prepared,patch={})=>({...context(holder,prepared.civil.attempt.operationId),attemptDigest:prepared.civil.attempt.attemptDigest,noticeVersion:notice.version,noticeSha256:notice.sha256,consent:true,dni:'00012345',gender:'F',...patch});
 const authorize=async(store=build(),operator=manager)=>{const prepared=await prepare(store,operator);await store.civilConsent(holder,consentInput(prepared));return {store,prepared,input:context(operator,prepared.civil.attempt.operationId)};};
 const attempts=()=>[...audits.values()].filter(audit=>audit.action==='participant.civil.attempt'),observations=()=>[...audits.values()].filter(audit=>audit.action==='participant.civil.observation');
 const f={manager,holder,other,users,row,audits,sqls,calls,controls,build,context,prepare,consentInput,authorize,attempts,observations,submission,state,notice,configure:value=>{configuration=value;},getConfiguration:()=>configuration,advance:milliseconds=>{now=new Date(now.getTime()+milliseconds);}};
 return f;
}

test('closed canonical civil state and prepare have no provider requests, no consent and no durable write',async()=>{
 const f=fixture({configured:false}),store=f.build(),before=f.state(),read=await store.civilRead(f.holder,f.context(f.holder)),prepared=await f.prepare(store);
 for(const value of [read,prepared]){assert.equal(value.civil.state,'CONTRACT_PENDING');assert.equal(value.civil.available,false);assert.equal(value.civil.notice,null);for(const key of ['canPrepare','canConsent','canQuery','canRevokeConsent'])assert.equal(value.civil[key],false);assert.equal(value.civil.attempt,null);}
 assert.deepEqual(f.state(),before);assert.deepEqual(f.calls,{login:0,query:0,blob:0,factory:0});
});

test('holder alone grants dedicated exact consent; actual transport commits one civil result and leaves human review pending',async()=>{
 const f=fixture(),{store,prepared,input}=await f.authorize();
 assert.equal(prepared.civil.state,'CONSENT_PENDING');assert.equal(prepared.civil.canConsent,false);assert.equal((await store.civilRead(f.holder,f.context(f.holder,input.operationId))).civil.canConsent,false,'recorded consent has no second consent action');
 const result=await store.civilDispatch(f.manager,input);assert.equal(result.civil.state,'OBSERVED');assert.deepEqual(result.civil.attempt.data,facts);assert.equal(result.civil.attempt.queryAttempted,true);for(const [key,value]of Object.entries(CIVIL_BOUNDARY))assert.equal(result.civil[key],value);
 assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');assert.deepEqual(f.row.metadata.participant.permissions,{attendance:false,report:false});assert.deepEqual(f.row.metadata.unrelated,{retained:true});assert.equal(f.calls.login,1);assert.equal(f.calls.query,1);assert.equal(f.observations().length,1);
 assert.doesNotMatch(JSON.stringify([...f.audits.values()]),/00012345|synthetic\.jwt|synthetic-only|private\.blob/);
 assert.doesNotMatch(JSON.stringify(result),/00012345|documentSha256|bindingDigest|consentReference|private\.blob/);
 const command={operationId:input.operationId,projectId:input.projectId,scope:input.scope,action:'QUERY_CIVIL_DATA',payload:{workerId:input.workerId,submissionId:input.submissionId}};
 assert.equal((await f.build().save(f.manager,command)).civil.state,'OBSERVED');assert.equal(f.calls.query,1);
});

test('a technical COMMIT with late ACK preserves OBSERVED but an unconfirmed POST needs explicit GET for private facts',async()=>{
 const committed=deferred(),acknowledge=deferred();let lookupResult;
 const f=fixture({observerTimeoutMs:5,afterTechnicalCommit:async()=>{committed.resolve();await acknowledge.promise;},onLookupResult:value=>{lookupResult=value;}}),{store,input}=await f.authorize(),running=store.civilDispatch(f.manager,input);
 try{
  await committed.promise;const result=await running;assert.equal(lookupResult.state,'UNKNOWN');assert.equal(lookupResult.code,'BINDX_CIVIL_TECHNICAL_OBSERVATION_UNCONFIRMED');assert.equal(lookupResult.data,null);assert.equal(result.civil.state,'OBSERVED');assert.equal(result.civil.code,'PARTICIPANT_CIVIL_RESULT_UNCONFIRMED');assert.equal(result.civil.attempt.data,null);assert.equal(f.attempts()[0].metadata.state,'OBSERVED');assert.equal(f.observations().length,1);assert.deepEqual(f.observations()[0].metadata.observation.data,facts);
  assert.deepEqual((await f.build().civilRead(f.manager,input)).civil.attempt.data,facts);await assert.rejects(f.prepare(f.build()),{code:'PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED'});assert.equal(f.calls.query,1);assert.equal(f.calls.factory,1);
 }finally{acknowledge.resolve();await running;}
});

test('an expired wire deadline after committed observation withholds this POST data while GET recovers without paid replay',async()=>{
 const original=Object.getOwnPropertyDescriptor(performance,'now');let elapsed=0,lookupResult;Object.defineProperty(performance,'now',{configurable:true,value:()=>elapsed});
 try{
  const f=fixture({clientTimeoutMs:25,afterTechnicalCommit:()=>{elapsed=26;},onLookupResult:value=>{lookupResult=value;}}),{store,input}=await f.authorize(),result=await store.civilDispatch(f.manager,input);
  assert.equal(lookupResult.state,'UNKNOWN');assert.equal(lookupResult.code,'BINDX_CIVIL_TIMEOUT');assert.equal(lookupResult.data,null);assert.equal(result.civil.state,'OBSERVED');assert.equal(result.civil.code,'PARTICIPANT_CIVIL_RESULT_UNCONFIRMED');assert.equal(result.civil.attempt.data,null);assert.equal(f.observations().length,1);assert.equal(f.observations()[0].metadata.observation.state,'OBSERVED');assert.deepEqual((await f.build().civilRead(f.manager,input)).civil.attempt.data,facts);assert.equal(f.calls.login,1);assert.equal(f.calls.query,1);assert.equal(f.calls.factory,1);await assert.rejects(f.prepare(f.build()),{code:'PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED'});
 }finally{if(original)Object.defineProperty(performance,'now',original);else delete performance.now;}
});

test('the POST requires the lookup result binding to match its captured context even after a valid technical receipt',async()=>{
 const f=fixture({clientFactory:options=>({lookup:async()=>{const value={version:1,provider:'BINDX_APISTORE',state:'OBSERVED',code:null,bindingDigest:options.configuration.consent.contextDigest,observedAt:'2026-10-13T12:00:00.000Z',queryAttempted:true,httpStatus:200,data:facts,...CIVIL_BOUNDARY};await options.onTechnicalObservation(value);return {...value,bindingDigest:'f'.repeat(64)};}})}),{store,input}=await f.authorize(),result=await store.civilDispatch(f.manager,input);
 assert.equal(result.civil.state,'OBSERVED');assert.equal(result.civil.code,'PARTICIPANT_CIVIL_RESULT_UNCONFIRMED');assert.equal(result.civil.attempt.data,null);assert.equal(f.observations().length,1);assert.deepEqual((await f.build().civilRead(f.manager,input)).civil.attempt.data,facts);assert.equal(f.calls.factory,1);assert.equal(f.calls.query,0);
});

test('another manager cannot consent for the holder or adopt the original operator attempt',async()=>{
 const f=fixture(),store=f.build(),prepared=await f.prepare(store),input=f.consentInput(prepared);
 await assert.rejects(store.civilConsent(f.manager,{...input,scope:f.context().scope}),{code:'PARTICIPANT_CIVIL_HOLDER_CONSENT_REQUIRED'});
 await store.civilConsent(f.holder,input);await assert.rejects(store.civilDispatch(f.other,f.context(f.other,input.operationId)),{code:'PARTICIPANT_CIVIL_OPERATOR_REQUIRED'});assert.equal(f.calls.query,0);
});

test('consent rejects substituted operator tuple, notice or declared sex and never reuses the OCR checkbox',async()=>{
 const f=fixture(),store=f.build(),prepared=await f.prepare(store);
 for(const patch of [{attemptDigest:'f'.repeat(64)},{noticeSha256:'f'.repeat(64)},{noticeVersion:'participant-external-ocr-v1'},{gender:'AUTO'},{consent:false},{dni:' 00012345'}])await assert.rejects(store.civilConsent(f.holder,f.consentInput(prepared,patch)),WorkspaceError);
 await assert.rejects(store.civilDispatch(f.manager,f.context(f.manager,prepared.civil.attempt.operationId)),{code:'PARTICIPANT_CIVIL_CONSENT_REQUIRED'});assert.equal(f.calls.login,0);assert.equal(f.row.metadata.participant.kyc.civilConsent,undefined);
});

test('two actual store instances competing for a source reserve one durable operation',async()=>{
 const f=fixture(),operations=[randomUUID(),randomUUID()],results=await Promise.allSettled(operations.map(operation=>f.prepare(f.build(),f.manager,operation)));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.code==='PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED').length,1);assert.equal(f.attempts().length,1);assert.equal(f.calls.login,0);
});

test('concurrent instances query once; a second query sees committed DISPATCHING without another client',async()=>{
 const entered=deferred(),resume=deferred(),f=fixture({afterQuery:async()=>{entered.resolve();await resume.promise;}}),{store,input}=await f.authorize(),running=store.civilDispatch(f.manager,input);await entered.promise;
 const held=await f.build().civilDispatch(f.manager,input);assert.equal(held.civil.state,'DISPATCHING');assert.equal(held.civil.canQuery,false);assert.equal(f.calls.factory,1);assert.equal(f.calls.query,1);resume.resolve();assert.equal((await running).civil.state,'OBSERVED');assert.equal(f.calls.query,1);
});

test('provider schema or transport failure remains UNKNOWN across UUID, operator, instance and clock changes',async()=>{
 const f=fixture({response:()=>Response.json({verified:true})}),{store,input}=await f.authorize(),result=await store.civilDispatch(f.manager,input);assert.equal(result.civil.state,'UNKNOWN');assert.equal(result.civil.attempt.data,null);assert.equal(result.civil.attempt.queryAttempted,true);assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');
 f.advance(365*86400000);await f.build().civilDispatch(f.manager,input);for(const operator of [f.manager,f.other])await assert.rejects(f.prepare(f.build(),operator),{code:'PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED'});assert.equal(f.calls.query,1);assert.equal(f.observations().length,1);
});

test('a reconstructed client after a crash cannot release or repeat the dispatched source',async()=>{
 const f=fixture({clientFactory:()=>({lookup:async()=>{throw Error('synthetic process interruption');}})}),{store,input}=await f.authorize(),result=await store.civilDispatch(f.manager,input);assert.equal(result.civil.state,'UNKNOWN');assert.equal(result.civil.attempt.queryAttempted,false);await f.build().civilDispatch(f.manager,input);await assert.rejects(f.prepare(f.build()),{code:'PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED'});assert.equal(f.calls.factory,1);
});

test('technical observation survives a revoked operator after GET while private output is denied',async()=>{
 const f=fixture({afterQuery:context=>{context.users.get(context.manager.userId).status='DISABLED';}}),{store,input}=await f.authorize();
 await assert.rejects(store.civilDispatch(f.manager,input),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});assert.equal(f.attempts()[0].metadata.state,'OBSERVED');assert.deepEqual(f.observations()[0].metadata.observation.data,facts);assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');
 f.users.get(f.manager.userId).status='ACTIVE';assert.deepEqual((await f.build().civilRead(f.manager,input)).civil.attempt.data,facts);assert.equal(f.calls.query,1);
});

test('technical observation survives withdrawn holder consent but neither actor can read its private facts',async()=>{
 const f=fixture({afterQuery:context=>{context.row.metadata.participant.kyc.civilConsent.allowed=false;}}),{store,input}=await f.authorize();
 await assert.rejects(store.civilDispatch(f.manager,input),{code:'PARTICIPANT_CIVIL_CONSENT_REQUIRED'});assert.equal(f.attempts()[0].metadata.state,'OBSERVED');assert.deepEqual(f.observations()[0].metadata.observation.data,facts);
 for(const actor of [f.manager,f.holder]){const result=await f.build().civilRead(actor,f.context(actor,input.operationId));assert.equal(result.civil.attempt.data,null);assert.equal(result.civil.attempt.consentRecorded,false);assert.equal(result.civil.canQuery,false);}assert.equal(f.calls.query,1);
});

test('consent data substitution and an absent durable consent receipt block before Blob or provider',async()=>{
 for(const mutate of [f=>{f.row.metadata.participant.kyc.civilConsent.dni='99999999';},f=>{f.row.metadata.participant.kyc.civilConsent.actorId='another-holder';},f=>{f.audits.delete(f.attempts()[0].metadata.consentReference);}]){
  const f=fixture(),{store,input}=await f.authorize();mutate(f);await assert.rejects(store.civilDispatch(f.manager,input),{code:'PARTICIPANT_CIVIL_CONSENT_REQUIRED'});assert.equal(f.calls.blob,0);assert.equal(f.calls.login,0);
 }
});

test('wrong tenant, worker and replaced presentation cannot read or dispatch the earlier receipt',async()=>{
 const f=fixture(),{store,input}=await f.authorize();await store.civilDispatch(f.manager,input);
 await assert.rejects(store.civilRead({...f.manager,organizationId:'org_Foreign'},input),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});await assert.rejects(store.civilRead(f.manager,{...input,workerId:'worker-foreign'}),{code:'PARTICIPANT_UNAVAILABLE'});
 f.row.metadata.participant.kyc.submissionId='submission-replacement';f.submission();await assert.rejects(store.civilRead(f.manager,input),{code:'PARTICIPANT_CIVIL_PRESENTATION_REQUIRED'});const current=await store.civilRead(f.manager,f.context());assert.equal(current.civil.attempt.data,null);assert.equal(current.civil.code,'PARTICIPANT_CIVIL_PRESENTATION_CHANGED');await assert.rejects(f.prepare(store),{code:'PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED'});assert.equal(f.calls.query,1);
});

test('canonical status is READ ONLY and a corrupt exact Blob source never contacts the provider',async()=>{
 const f=fixture({corruptBlob:true}),{store,input}=await f.authorize();assert.equal((await store.civilDispatch(f.manager,input)).civil.state,'UNKNOWN');assert.equal(f.calls.login,0);assert.equal(f.calls.blob,1);
 const before=f.state(),from=f.sqls.length;await store.civilRead(f.manager,input);await store.civilRead(f.holder,f.context(f.holder,input.operationId));assert.deepEqual(f.state(),before);assert.ok(f.sqls.slice(from).filter(sql=>sql.startsWith('BEGIN')).every(sql=>sql.includes('READ ONLY')));assert.equal(f.sqls.slice(from).some(sql=>/^(INSERT|UPDATE|DELETE)/.test(sql)),false);
});

test('dedicated consent withdrawal preserves uncertainty and blocks hidden requery',async()=>{
 const f=fixture({response:()=>Response.json({error:'synthetic-error'})}),{store,input}=await f.authorize();await store.civilDispatch(f.manager,input);const before=f.observations().length,retracted=await store.civilRevokeConsent(f.holder,f.context(f.holder,input.operationId));assert.equal(retracted.civil.state,'UNKNOWN');assert.equal(retracted.civil.canQuery,false);assert.equal(retracted.civil.attempt.consentRecorded,false);assert.equal(f.observations().length,before);assert.equal(f.calls.query,1);
});

test('forged civil certification, excess private fields and displaced binding are rejected',()=>{
 const value={version:1,provider:'BINDX_APISTORE',state:'OBSERVED',code:null,bindingDigest:'a'.repeat(64),observedAt:'2026-10-13T12:00:00.000Z',queryAttempted:true,httpStatus:200,data:facts,...CIVIL_BOUNDARY};
 for(const patch of [{identityCertified:true},{livenessVerified:true},{permissionsGranted:true},{data:{...facts,dni:'00012345'}},{bindingDigest:'b'.repeat(64)},{data:{...facts,vencimiento:'31/02/2034'}}])assert.throws(()=>civilObservation({...value,...patch},value.bindingDigest),{code:'PARTICIPANT_CIVIL_OBSERVATION_INVALID'});
});

test('a holder with pending human KYC can consent and query their own civil data through the identity purpose only',async()=>{
 const f=fixture(),{store,input}=await f.authorize(f.build(),f.holder),result=await store.civilDispatch(f.holder,input);
 assert.equal(result.civil.state,'OBSERVED');assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');
 await assert.rejects(store.save(f.holder,{projectId:input.projectId,scope:input.scope,operationId:randomUUID(),action:'REVIEW_KYC',payload:{workerId:input.workerId,revision:f.row.revision,submissionId:input.submissionId,decision:'APPROVED',reason:'Revisión sintética propia prohibida'}}),WorkspaceError);
 assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');assert.equal(f.calls.query,1);
});

test('unconfirmed contract evidence, notice, credentials or financial product stay closed without a reservation',async()=>{
 for(const mutate of [value=>{value.renaperAgreement.confirmed=false;},value=>{value.providerEvidence.environmentConfirmed=false;},value=>{value.notice.sha256='f'.repeat(64);},value=>{value.credentials.password='';},value=>{value.product='PSP_ACCOUNT';}]){
  const f=fixture(),configuration=structuredClone(f.getConfiguration());mutate(configuration);f.configure(configuration);const prepared=await f.prepare();assert.equal(prepared.civil.state,'CONTRACT_PENDING');assert.equal(prepared.civil.notice,null);assert.equal(f.attempts().length,0);assert.equal(f.calls.factory,0);
 }
});

test('a failed actual provider GET preserves queryAttempted and cannot become invalid identity or authorize a retry',async()=>{
 const f=fixture({response:()=>{throw Error('synthetic lost network response');}}),{store,input}=await f.authorize(),result=await store.civilDispatch(f.manager,input);
 assert.equal(result.civil.state,'UNKNOWN');assert.equal(result.civil.attempt.queryAttempted,true);assert.equal(result.civil.attempt.code,'BINDX_CIVIL_TRANSPORT_UNCONFIRMED');assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');await f.build().civilDispatch(f.manager,input);assert.equal(f.calls.query,1);
});

test('an OBSERVED marker without its exact durable technical receipt cannot disclose civil facts',async()=>{
 const f=fixture(),{store,input}=await f.authorize();await store.civilDispatch(f.manager,input);f.audits.delete(f.attempts()[0].metadata.observationId);
 await assert.rejects(store.civilRead(f.manager,input),{code:'PARTICIPANT_CIVIL_RECEIPT_INVALID'});assert.equal(f.calls.query,1);
});

test('changing the holder account over the same document submission invalidates the earlier consent before dispatch',async()=>{
 const f=fixture(),{store,input}=await f.authorize();f.row.metadata.participant.clerkUserId='user_ReplacedHolder';
 await assert.rejects(store.civilDispatch(f.manager,input),{code:'PARTICIPANT_CIVIL_PRESENTATION_CHANGED'});const view=await store.civilRead(f.manager,input);assert.equal(view.civil.attempt.data,null);assert.equal(view.civil.attempt.consentRecorded,false);assert.equal(view.civil.canQuery,false);assert.equal(f.calls.blob,0);assert.equal(f.calls.login,0);
});

test('exact Blob verification independently bounds a stalled getter or reader and cancels late content',async()=>{
 const image={url:'https://synthetic.private.blob.vercel-storage.com/obrasaas/legacy-images/v1/'+'a'.repeat(64)+'/image.png',bytes:picture.length,contentType:'image/png',sha256:sourceHash};
 let signal,cancelled=0;await assert.rejects(readCivilDocumentSource(image,async(_path,options)=>{signal=options.abortSignal;return new Promise(()=>{});},5),{code:'PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED'});assert.equal(signal.aborted,true);
 await assert.rejects(readCivilDocumentSource(image,async()=>({statusCode:200,blob:{url:image.url,size:image.bytes,contentType:image.contentType},stream:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{cancelled++;}})}}),5),{code:'PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED'});assert.ok(cancelled>0);
 const late=deferred(),running=readCivilDocumentSource(image,()=>late.promise,5);await assert.rejects(running,{code:'PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED'});late.resolve({stream:{cancel:async()=>{cancelled++;}}});await new Promise(resolve=>setImmediate(resolve));assert.ok(cancelled>1);
});

test('the holder current membership is rechecked before dispatch and after the provider response',async()=>{
 const before=fixture(),reserved=await before.authorize();before.users.get(before.holder.userId).status='DISABLED';await assert.rejects(reserved.store.civilDispatch(before.manager,reserved.input),{code:'PARTICIPANT_CIVIL_CONSENT_REQUIRED'});assert.equal(before.calls.blob,0);assert.equal(before.calls.login,0);
 const after=fixture({afterQuery:f=>{f.users.get(f.holder.userId).status='DISABLED';}}),running=await after.authorize();await assert.rejects(running.store.civilDispatch(after.manager,running.input),{code:'PARTICIPANT_CIVIL_CONSENT_REQUIRED'});assert.equal(after.attempts()[0].metadata.state,'OBSERVED');assert.deepEqual(after.observations()[0].metadata.observation.data,facts);assert.equal((await after.build().civilRead(after.manager,running.input)).civil.attempt.data,null);assert.equal(after.calls.query,1);
});

test('a timed-out observer keeps DISPATCHING and its single late OBSERVED receipt cannot be overwritten by UNKNOWN',async()=>{
 const f=fixture({observerTimeoutMs:5}),{store,input}=await f.authorize(),gate=deferred();f.controls.settlementGate=gate;let timer;
 const running=store.civilDispatch(f.manager,input);running.catch(()=>{});
 try{
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('durable action must not await an observer after its ACK deadline')),500);});
  const held=await Promise.race([running,deadline]);assert.equal(held.civil.state,'DISPATCHING');assert.equal(held.civil.canQuery,false);assert.equal(held.civil.attempt.data,null);assert.equal(f.observations().length,0);assert.equal(f.calls.query,1);
  assert.equal((await f.build().civilDispatch(f.manager,input)).civil.state,'DISPATCHING');await assert.rejects(f.prepare(f.build()),{code:'PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED'});
 }finally{clearTimeout(timer);gate.resolve();}
 for(let index=0;index<50&&f.observations().length===0;index++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.observations().length,1);assert.equal(f.observations()[0].metadata.observation.state,'OBSERVED');assert.equal(f.attempts()[0].metadata.state,'OBSERVED');assert.deepEqual((await f.build().civilRead(f.manager,input)).civil.attempt.data,facts);assert.equal(f.calls.query,1);
});

test('canonical HTTP GET mounts the closed civil state without writing and refuses extra status coordinates',async()=>{
 const f=fixture({configured:false}),handlers=createParticipantHandlers({verify:async()=>f.holder,store:f.build()}),url=new URL('https://obrasaas.com/api/identity/participants');
 for(const [key,value]of Object.entries({...f.context(f.holder),detail:'civil-data'}))url.searchParams.set(key,value);
 const before=f.state(),response=await handlers.GET(new Request(url));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal((await response.json()).civil.state,'CONTRACT_PENDING');assert.deepEqual(f.state(),before);assert.equal(f.calls.factory,0);
 url.searchParams.set('documentSha256',sourceHash);assert.equal((await handlers.GET(new Request(url))).status,400);assert.deepEqual(f.state(),before);
});

test('canonical HTTP commands compose prepare, own consent, query and exact recovery without changing KYC approval',async()=>{
 const f=fixture(),store=f.build();let active=f.manager;const handlers=createParticipantHandlers({verify:async()=>active,store}),operation=randomUUID(),endpoint='https://obrasaas.com/api/identity/participants';
 const post=body=>handlers.POST(new Request(endpoint,{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:JSON.stringify(body)}));
 const command=(actor,action,payload)=>({operationId:operation,projectId:f.context(actor).projectId,scope:f.context(actor).scope,action,payload});
 const preparedResponse=await post(command(f.manager,'PREPARE_CIVIL_DATA',{workerId:f.row.id,revision:f.row.revision,submissionId:f.row.metadata.participant.kyc.submissionId}));assert.equal(preparedResponse.status,200);const prepared=await preparedResponse.json();
 const input=f.consentInput(prepared),payload={...input};for(const key of ['operationId','projectId','scope'])delete payload[key];active=f.holder;assert.equal((await post(command(f.holder,'CONSENT_CIVIL_DATA',payload))).status,200);
 active=f.manager;const query=command(f.manager,'QUERY_CIVIL_DATA',{workerId:f.row.id,submissionId:f.row.metadata.participant.kyc.submissionId}),response=await post(query);assert.equal(response.status,200);assert.equal((await response.json()).civil.state,'OBSERVED');assert.equal((await post(query)).status,200);assert.equal(f.calls.query,1);assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');
 const invalid=await post({...query,payload:{...query.payload,dni:'00012345',gender:'F'}});assert.equal(invalid.status,400);assert.equal(f.calls.query,1);
});

test('an approved notice or contract change disables consent for the existing reserved context without creating a new attempt',async()=>{
 const f=fixture(),store=f.build(),prepared=await f.prepare(store),configuration=structuredClone(f.getConfiguration());configuration.notice.text+=' Aviso sintético actualizado.';configuration.notice.sha256=civilSha(configuration.notice.text);f.configure(configuration);
 const read=await store.civilRead(f.holder,f.context(f.holder,prepared.civil.attempt.operationId));assert.equal(read.civil.state,'CONSENT_PENDING');assert.equal(read.civil.canConsent,false);assert.equal(read.civil.canPrepare,false);assert.equal(read.civil.canQuery,false);assert.equal(read.civil.code,'PARTICIPANT_CIVIL_CONFIGURATION_CHANGED');assert.notEqual(read.civil.notice.sha256,read.civil.attempt.noticeSha256);
 await assert.rejects(store.civilConsent(f.holder,{...f.consentInput(prepared),noticeSha256:configuration.notice.sha256}),{code:'PARTICIPANT_CIVIL_CONFIGURATION_CHANGED'});assert.equal(f.attempts().length,1);assert.equal(f.calls.factory,0);assert.equal(f.calls.blob,0);
});
