import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createMetaFieldBridge,readMetaFieldConversation} from '../src/lib/meta-field-bridge.mjs';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {fieldMediaAnalysisConsent} from '../src/lib/field-media-privacy.mjs';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {createCompanyChannelBridge} from '../src/lib/company-channel-routing.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../src/lib/company-channel-schema.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {companyChannelOperationalCapabilities,createCompanyChannelStore} from '../src/lib/company-channel-store.mjs';

// These controlled adapter tests exercise the real field media store. Current
// canonical SQL identity/locks are separately exercised by the PG verifier.
const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,19).toString('base64'),PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-private-storage-only'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64');
const rows=value=>({rows:value,rowCount:value.length});
function mediaFixture({target='project-b',corporate=true,analyze=false,mediaId='media-fixture',providerFactory=null,beforeQuery=()=>{},afterQuery=()=>{},beforeResolve=()=>{},onIO=()=>{}}={}){
 const member={organizationId:'organization-a',actorId:'actor-a',membershipId:'membership-a',clerkUserId:'user_Fixture',role:'ADMIN'};
 const project={id:target,name:'Target '+target,metadata:{fieldOperations:{sectors:[{id:'sector-a',name:'Sector A'}]}}};
 const kycImages=[{id:'document-front',kind:'DOCUMENT_FRONT',sha256:'a'.repeat(64),bytes:png.length,contentType:'image/png'},{id:'selfie',kind:'SELFIE',sha256:'b'.repeat(64),bytes:png.length,contentType:'image/png'}];
 const kyc={version:1,status:'APPROVED',submissionId:'kyc-'+target,contentHash:digest(kycImages.map(image=>[image.kind,image.sha256,image.bytes,image.contentType])),images:kycImages,review:{decision:'APPROVED',actorId:'independent-reviewer',recordedAt:'2026-10-06T10:00:00.000Z'}};
 const worker={id:'worker-'+target,projectId:target,name:'Fixture',active:true,metadata:{preserve:true,participant:{version:1,status:'ACTIVE',clerkUserId:member.clerkUserId,permissions:{attendance:false,report:true},kyc}}};
 // Identity proofs are pre-existing fixture data, separate from receipts written
 // by the operation so the original I/O, dispatch and lease counters stay exact.
 const kycProofs=[{id:'review-'+target,actorId:kyc.review.actorId,entityId:worker.id,metadata:{version:1,kind:'REVIEW_KYC',projectId:target,submissionId:kyc.submissionId,decision:'APPROVED'}},{id:'submit-'+target,actorId:member.actorId,entityId:worker.id,metadata:{version:1,kind:'KYC_SUBMITTED',projectId:target,submissionId:kyc.submissionId,contentHash:kyc.contentHash}}];
 const connection={id:'connection-a',projectId:'project-a',phoneNumberId:'120000001',whatsappBusinessId:'130000001',metadata:{},encryptedAccessToken:encryptCustomerSecret('synthetic-anchor-token',{organizationId:member.organizationId,projectId:'project-a',purpose:'access-token',resourceId:'120000001'},environment)};
 const event={id:'customer_webhook_'+digest(['fixture',target]),projectId:'project-a',status:'PENDING',leaseToken:'fixture-source-lease',leaseExpiresAt:new Date(Date.now()+120000),createdAt:new Date(),payload:{payloadDigest:digest('signed-source-fixture')}};
 const context={eventId:event.id,projectId:event.projectId,channelId:connection.id,payloadDigest:event.payload.payloadDigest,leaseToken:event.leaseToken};
 const binding={id:'binding-'+target},projection=corporate?{projectId:target,workerId:worker.id,assignmentRevision:2,bindingId:binding.id,routeId:'route-a',routeEpoch:3}:null;
 const state={purpose:'MEDIA',step:'MEDIA',taskId:'task-'+target,sectorId:'sector-a'};
 const media={...state,mediaId,kind:'image',contentType:'image/png',caption:'Synthetic site evidence',analysisConsent:fieldMediaAnalysisConsent(analyze)};
 let open=0,checkpoint,resolutions=0;const audits=new Map(),incidents=new Map(),storage=new Map(),io=[],attendance=[];
 const seed={version:1,projectId:target,eventId:event.id,payloadDigest:event.payload.payloadDigest,channelBindingId:binding.id,encryptedInput:encryptCustomerSecret(JSON.stringify({media,state}),{organizationId:member.organizationId,projectId:target,purpose:'field-media-prepared',resourceId:'meta_field_media_'+digest(event.id)},environment)};
 audits.set('meta_field_media_'+digest(event.id),{metadata:seed,action:'meta.field.media.prepared',entityId:worker.id});
 const message={type:'image',timestamp:String(Math.floor(Date.now()/1000))};
 const r=()=>({kind:'CHANNEL_VERIFIED',member,project,worker,connection,event,proof:{value:message},sourceProjectId:event.projectId,companyProjection:projection,channelBinding:binding});
 const query=async(sql,args=[])=>{
  await beforeQuery(sql,args,{event,worker,connection,projection,audits,incidents});
  let value;
  if(sql==='BEGIN'){assert.equal(open,0);open++;checkpoint={worker:structuredClone(worker.metadata),audits:structuredClone(audits),incidents:structuredClone(incidents)};value=rows([]);}
  else if(sql==='COMMIT'){open--;value=rows([]);}
  else if(sql==='ROLLBACK'){open--;worker.metadata=checkpoint.worker;audits.clear();for(const entry of checkpoint.audits)audits.set(...entry);incidents.clear();for(const entry of checkpoint.incidents)incidents.set(...entry);value=rows([]);}
  else if(sql.startsWith('SET LOCAL'))value=rows([]);
  else if(sql==='SELECT clock_timestamp() AS now')value=rows([{now:new Date()}]);
  else if(sql.includes('SELECT "eventType"'))value=rows([{eventType:'message'}]);
  else if(sql.startsWith('UPDATE public."WebhookEvent" SET "leaseExpiresAt"')){const valid=event.status==='PENDING'&&Date.parse(event.leaseExpiresAt)>Date.now();if(valid)event.leaseExpiresAt=new Date(Date.now()+180000);value={rows:[],rowCount:valid?1:0};}
  else if(sql.startsWith('UPDATE public."WebhookEvent" SET "appliedAt"'))value={rows:[],rowCount:Date.parse(event.leaseExpiresAt)>Date.now()?1:0};
  else if(sql.includes('FROM public."WebhookEvent"')&&sql.includes('"leaseExpiresAt">clock_timestamp()'))value=rows(Date.parse(event.leaseExpiresAt)>Date.now()?[{id:event.id}]:[]);
  else if(sql.includes('FROM public."AuditLog"')&&(sql.includes("'REVIEW_KYC'")||sql.includes("'KYC_SUBMITTED'"))){
   const kind=sql.includes("'REVIEW_KYC'")?'REVIEW_KYC':'KYC_SUBMITTED';
   value=rows(kycProofs.filter(proof=>args[0]===member.organizationId&&proof.actorId===args[1]&&proof.entityId===args[2]&&proof.metadata.projectId===args[3]&&proof.metadata.submissionId===args[4]&&proof.metadata.kind===kind&&(kind!=='REVIEW_KYC'||proof.metadata.decision==='APPROVED')));
  }
  else if(sql.includes('FROM public."AuditLog"')){const found=audits.get(args[0]);value=rows(found&&sql.includes("'"+found.action+"'")?[found]:[]);}
  else if(sql.startsWith('INSERT INTO public."AuditLog"')){const action=/VALUES\(\$1,\$2,\$3,'([^']+)'/.exec(sql)[1];assert.ok(!audits.has(args[0]),'Unique receipt');audits.set(args[0],{id:args[0],action,entityId:args[3],metadata:JSON.parse(args[4])});value={rows:[],rowCount:1};}
  else if(sql.startsWith('UPDATE public."Worker"')){assert.equal(args[1],target);worker.metadata=JSON.parse(args[2]);value={rows:[],rowCount:1};}
  else if(sql.includes('FROM public."Worker"')){assert.equal(sql.includes('"projectId"=$1')?args[0]:args[1],target);value=rows([worker]);}
  else if(sql.includes('FROM public."Task"')){assert.equal(sql.includes('"projectId"=$1')?args[0]:args[1],target);value=rows([{id:'task-'+target,title:'Task '+target,progress:0,revision:'2026-10-06T10:00:00.000001',metadata:{}}]);}
  else if(sql.includes('FROM public."Project"')){assert.equal(args[0],target);value=rows([{revision:'2026-10-06T10:00:00.000001'}]);}
  else if(sql.includes('FROM public."AttendanceEntry"')){assert.equal(args[0],target);value=rows(attendance);}
  else if(sql.includes('FROM public."OperationalProposal"')){assert.equal(args[0],target);value=rows([]);}
  else if(sql.startsWith('INSERT INTO public."Incident"')){assert.equal(args[1],target);incidents.set(args[0],{id:args[0],projectId:args[1],title:args[2],description:args[3],metadata:JSON.parse(args[5]),revision:'2026-10-06T10:00:00.000001'});value={rows:[],rowCount:1};}
  else if(sql.startsWith('UPDATE public."Incident"')){
   assert.equal(args[1],target);const incident=incidents.get(args[0]),guarded=sql.includes('RETURNING id');let matched=Boolean(incident&&incident.projectId===args[1]);
   if(guarded){
    assert.equal(args.length,7);
    for(const predicate of ['id=$1 AND "projectId"=$2',"metadata->'fieldOperations'->'processing'->>'status'='RUNNING'","metadata->'fieldOperations'->'processing'->>'actorId'=$4","metadata->'fieldOperations'->'processing'->>'operationId'=$5","metadata->'fieldOperations'->'processing'->>'requestDigest'=$6","metadata->'fieldOperations'->'processing'->>'leaseId'=$7","(metadata->'fieldOperations'->'processing'->>'expiresAt')::timestamptz>clock_timestamp()","(metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb)"])assert.ok(sql.includes(predicate),'Controlled DB requires the actual conditional SQL: '+predicate);
    const evidence=incident?.metadata.fieldOperations,processing=evidence?.processing,expiresAt=Date.parse(processing?.expiresAt),databaseNow=new Date().getTime();
    matched=matched&&processing?.status==='RUNNING'&&processing.actorId===args[3]&&processing.operationId===args[4]&&processing.requestDigest===args[5]&&processing.leaseId===args[6]&&Number.isFinite(expiresAt)&&expiresAt>databaseNow&&(evidence.review===undefined||evidence.review===null);
   }
   if(matched)incident.metadata=JSON.parse(args[2]);value=guarded?rows(matched?[{id:incident.id}]:[]):{rows:[],rowCount:matched?1:0};
  }
  else if(sql.includes('FROM public."Incident"')){if(sql.includes('"projectId"=$1')){assert.equal(args[0],target);value=rows(sql.includes("kind'='EVIDENCE'")?[...incidents.values()]:[]);}else{assert.equal(args[1],target);value=rows(incidents.has(args[0])?[incidents.get(args[0])]:[]);}}
  else throw Error('Unexpected controlled SQL: '+sql);
  await afterQuery(sql,args,{event,worker,connection,projection,audits,incidents});
  return value;
 };
 const resolveIdentity=async(_client,{permission})=>{resolutions++;await beforeResolve(resolutions,{event,worker,connection,projection,member,project,binding});if(permission&&worker.metadata.participant.permissions[permission]!==true)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);return r();};
 const call=async(kind)=>{assert.equal(open,0,'No transaction spans external I/O');io.push(kind);await onIO(kind,{event,worker,connection,projection});};
 const provider={downloadMedia:async input=>{await call('download');assert.equal(input.token,'synthetic-anchor-token');assert.equal(input.phoneNumberId,connection.phoneNumberId);return {bytes:png,contentType:'image/png'};}};
 const get=async pathname=>{await call('get');const saved=storage.get(pathname);return saved?{statusCode:200,blob:{pathname,url:'https://fixture.private.blob.vercel-storage.com/'+pathname,size:saved.bytes.length,contentType:saved.contentType},stream:new ReadableStream({start(c){c.enqueue(saved.bytes);c.close();}})}:null;};
 const put=async(pathname,bytes,options)=>{await call('put');assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);storage.set(pathname,{bytes:Buffer.from(bytes),contentType:options.contentType});return {pathname,url:'https://fixture.private.blob.vercel-storage.com/'+pathname};};
 const analyzer={analyzePhoto:async()=>{await call('analyze');return {success:true,status:'ANALYZED_UNREVIEWED',observations:[]};}};
 const bridge=createMetaFieldBridge({connect:async()=>({query,release:()=>assert.equal(open,0)}),resolveIdentity,provider:providerFactory?providerFactory({call}):provider,put,get,analyzer,environment});
 return {bridge,context,event,message,worker,project,connection,projection,audits,incidents,storage,io,attendance,seed,resolutions:()=>resolutions};
}
const providerEnvironment={...environment,NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-customer-secret-only',META_CONFIG_ID:'123456789012345',META_GRAPH_API_VERSION:'v25.0',META_EMBEDDED_SIGNUP_VERSION:'4',OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1',META_CUSTOMER_VERIFY_TOKEN:'synthetic-customer-verification-only-'.repeat(2)};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
function realMediaProvider(fetchImpl){return createMetaCustomerProvider({environment:providerEnvironment,fetchImpl});}
const graphMedia=()=>({id:'140000001',url:'https://lookaside.fbsbx.com/whatsapp_business/attachments/synthetic-only',mime_type:'image/png',file_size:png.length,sha256:createHash('sha256').update(png).digest('hex')});
for(const [name,code]of [['current project membership','WORKER_CHANNEL_BINDING_UNAVAILABLE'],['source lease','META_CUSTOMER_INBOX_LEASE_CHANGED']])test('real provider suspends Graph then revalidates '+name+' before CDN GET',async()=>{
 const started=deferred(),release=deferred();let membershipActive=true,guardDenied=false;
 const f=mediaFixture({mediaId:'140000001',beforeResolve:()=>{if(!membershipActive){guardDenied=true;throw new WorkspaceError(code,403);}},providerFactory:({call})=>realMediaProvider(async url=>{
  const parsed=new URL(url);if(parsed.hostname==='graph.facebook.com'){await call('graph');started.resolve();await release.promise;return Response.json(graphMedia());}
  await call('cdn');return new Response(png,{headers:{'content-type':'image/png','content-length':String(png.length)}});
 })});
 const pending=f.bridge.execute(f.context);await started.promise;
 if(name==='current project membership')membershipActive=false;else f.event.leaseExpiresAt=new Date(0);
 release.resolve();await assert.rejects(pending,{code});
 if(name==='current project membership')assert.equal(guardDenied,true);
 assert.deepEqual(f.io,['graph']);assert.equal(f.storage.size,0);assert.equal(f.incidents.size,0);assert.equal([...f.audits.values()].filter(row=>row.action==='meta.field.dispatched'||row.action==='field.media.recorded').length,0);
});
test('real provider validates both Graph and CDN with corporate closure and records one private evidence',async()=>{
 const resolutionsAtFetch=[];
 const f=mediaFixture({mediaId:'140000001',providerFactory:({call})=>realMediaProvider(async url=>{
  resolutionsAtFetch.push(f.resolutions());const parsed=new URL(url);
  assert.equal(parsed.protocol,'https:');if(parsed.hostname==='graph.facebook.com'){assert.equal(parsed.searchParams.get('phone_number_id'),'120000001');await call('graph');return Response.json(graphMedia());}
  assert.equal(parsed.hostname,'lookaside.fbsbx.com');await call('cdn');return new Response(png,{headers:{'content-type':'image/png','content-length':String(png.length)}});
 })});
 const outcome=await f.bridge.execute(f.context);assert.equal(outcome.kind,'EVIDENCE');assert.equal(outcome.businessApplied,true);assert.equal(resolutionsAtFetch.length,2);assert.ok(resolutionsAtFetch[1]>resolutionsAtFetch[0],'Fresh canonical resolve separates external GETs');assert.deepEqual(f.io,['graph','cdn','get','put','get']);assert.equal(f.incidents.size,1);assert.equal([...f.audits.values()].filter(r=>r.action==='meta.field.dispatched').length,1);
 const before=f.io.length;assert.deepEqual(await f.bridge.execute(f.context),outcome);assert.equal(f.io.length,before);
});
for(const stage of ['Graph','CDN'])test('real provider preserves canonical WorkspaceError from '+stage+' guard and performs no later fetch',async()=>{
 let guards=0,fetches=0;const denied=new WorkspaceError('WORKER_CHANNEL_BINDING_UNAVAILABLE',403),provider=realMediaProvider(async()=>{fetches++;return Response.json(graphMedia());});
 await assert.rejects(provider.downloadMedia({token:'synthetic-anchor-token',phoneNumberId:'120000001',mediaId:'140000001',beforeExternal:async()=>{if(++guards===(stage==='Graph'?1:2))throw denied;}}),error=>error===denied);
 assert.equal(guards,stage==='Graph'?1:2);assert.equal(fetches,stage==='Graph'?0:1);
});
for(const invalid of [false,true,'callback',{},[]])test('real media provider rejects non-function internal guard '+JSON.stringify(invalid)+' before network',async()=>{
 let calls=0;const provider=realMediaProvider(async()=>{calls++;return Response.json(graphMedia());});await assert.rejects(provider.downloadMedia({token:'synthetic-anchor-token',phoneNumberId:'120000001',mediaId:'140000001',beforeExternal:invalid}),{code:'META_CUSTOMER_MEDIA_INVALID'});assert.equal(calls,0);
});
for(const target of ['project-a','project-b'])test('media keeps anchor credential AAD and frozen evidence destination '+target,async()=>{
 const f=mediaFixture({target}),outcome=await f.bridge.execute(f.context);
 assert.equal(outcome.kind,'EVIDENCE');assert.equal(outcome.businessApplied,true);assert.equal(f.incidents.size,1);
 const evidence=[...f.incidents.values()][0];assert.equal(evidence.projectId,target);assert.equal(evidence.metadata.fieldOperations.workerId,f.worker.id);assert.equal(evidence.metadata.fieldOperations.taskId,'task-'+target);assert.equal(evidence.metadata.fieldOperations.review,null);
 assert.deepEqual(f.io,['download','get','put','get']);assert.ok(f.resolutions()>=7);const count=f.io.length;
 assert.deepEqual(await f.bridge.execute(f.context),outcome);assert.equal(f.incidents.size,1);assert.equal(f.io.length,count,'Lost acknowledgement replay never downloads or uploads twice');
 assert.equal([...f.audits.values()].filter(row=>row.action==='field.media.recorded').length,1);
});
test('explicit analysis consent permits one assisted analysis without approving evidence',async()=>{
 const f=mediaFixture({analyze:true}),outcome=await f.bridge.execute(f.context);assert.equal(outcome.kind,'EVIDENCE');assert.equal(f.io.filter(k=>k==='analyze').length,1);
 const evidence=[...f.incidents.values()][0].metadata.fieldOperations;assert.equal(evidence.processing.status,'ANALYZED_UNREVIEWED');assert.equal(evidence.review,null);assert.equal(evidence.processing.analysisConsent.allowed,true);
});
for(const stage of ['download','get','put','analyze'])test('fresh revoked participant denies corporate I/O before '+stage,async()=>{
 let armed=false;
 const f=mediaFixture({analyze:true,onIO:kind=>{if(stage==='get'&&kind==='download'||stage==='put'&&kind==='get'||stage==='analyze'&&kind==='get'&&armed)f.worker.metadata.participant.permissions.report=false;if(kind==='put')armed=true;},beforeResolve:(count,{worker})=>{if(stage==='download'&&count===2)worker.metadata.participant.permissions.report=false;}});
 await assert.rejects(f.bridge.execute(f.context),{code:'WORKER_CHANNEL_PERMISSION_REQUIRED'});
 assert.equal(f.io.includes(stage),false);assert.equal([...f.audits.values()].filter(row=>row.action==='meta.field.dispatched').length,0);
});
for(const [label,change] of [
 ['report permission',r=>{r.worker.metadata.participant.permissions.report=false;}],
 ['actor',r=>{r.member.actorId='actor-other';}],
 ['membership',r=>{r.member.membershipId='membership-other';}],
 ['individual Clerk account',r=>{r.member.clerkUserId='user_Other';}],
 ['canonical target',r=>{r.project.id='project-other';}],
 ['canonical worker',r=>{r.worker.id='worker-other';}],
 ['current binding',r=>{r.binding.id='binding-other';}],
 ['frozen project',r=>{r.projection.projectId='project-other';}],
 ['assignment revision',r=>{r.projection.assignmentRevision++;}],
 ['binding',r=>{r.projection.bindingId='binding-other';}],
 ['route epoch',r=>{r.projection.routeEpoch++;}],
 ['credential anchor',r=>{r.connection.projectId='project-other';}],
 ['credential token',r=>{r.connection.encryptedAccessToken+='tampered';}],
 ['expired lease',r=>{r.event.leaseExpiresAt=new Date(0);}],
 ['malformed lease',r=>{r.event.leaseExpiresAt='invalid';}],
])test('prepared media cannot cross a changed '+label+' before provider GET',async()=>{
 const f=mediaFixture({beforeResolve:(count,r)=>{if(count===2)change(r);}});
 await assert.rejects(f.bridge.execute(f.context));assert.deepEqual(f.io,[]);assert.equal(f.incidents.size,0);assert.equal(f.storage.size,0);
});
test('source lease expiring after evidence INSERT rolls back the business row and receipt',async()=>{
 let expired=false;
 const f=mediaFixture({afterQuery:(sql,_args,{event})=>{if(sql.startsWith('INSERT INTO public."Incident"')){expired=true;event.leaseExpiresAt=new Date(0);}}});
 await assert.rejects(f.bridge.execute(f.context),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});assert.equal(expired,true);assert.equal(f.incidents.size,0);
 assert.equal([...f.audits.values()].filter(r=>r.action==='field.media.recorded'||r.action==='meta.field.dispatched').length,0);
 assert.equal(f.storage.size,1,'A private deterministic object is not a business receipt');
});
test('media preparation cannot renew a source lease that expired while its transaction was open',async()=>{
 const f=mediaFixture({beforeQuery:(sql,_args,{event})=>{if(sql.startsWith('UPDATE public."WebhookEvent" SET "leaseExpiresAt"'))event.leaseExpiresAt=new Date(0);}});
 await assert.rejects(f.bridge.execute(f.context),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});assert.deepEqual(f.io,[]);assert.equal(f.incidents.size,0);assert.equal(f.storage.size,0);
});
for(const [name,change] of [['project',s=>{s.projectId='project-other';}],['event',s=>{s.eventId='source-other';}],['binding',s=>{s.channelBindingId='binding-other';}],['payload',s=>{s.payloadDigest='0'.repeat(64);}]])test('durable media preparation rejects wrong '+name+' before I/O',async()=>{
 const f=mediaFixture();change(f.seed);await assert.rejects(f.bridge.execute(f.context),{code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'});assert.deepEqual(f.io,[]);
});
test('development pilot cannot reuse corporate full-media dispatch',async()=>{
 const f=mediaFixture();f.connection.metadata.developmentPilot={version:1};
 await assert.rejects(f.bridge.execute(f.context));assert.deepEqual(f.io,[]);assert.equal(f.incidents.size,0);
});
test('report-only menus expose full reports and never attendance or office review',()=>{
 const facts={projectName:'Obra B',workerId:'worker-b',permissions:{attendance:false,report:true},attendanceOnly:false,latest:null,tasks:[{id:'task-b',title:'Task B',progress:0}],sectors:[{id:'sector-b',name:'Sector B'}],inventory:{materials:[{id:'material-b',active:true}]},evidence:[],proposals:[]};
 const menu=planMetaFieldConversation({message:{type:'text',text:{body:'MENU'}},facts,eventId:'menu'}),titles=menu.reply.sections[0].rows.map(r=>r.title);
 for(const title of ['Mis tareas','Enviar evidencia','Informar incidencia','Pedir material','Proponer consumo','Proponer avance','Consultar estado'])assert.ok(titles.includes(title));
 assert.ok(!titles.includes('Entrada'));assert.ok(!titles.some(t=>/aprobar|roles|banco|KYC/i.test(t)));assert.ok(titles.length<=10);
 const denied=planMetaFieldConversation({message:{type:'text',text:{body:'ENTRADA'}},facts,eventId:'denied'});assert.equal(denied.command,undefined);assert.match(denied.reply.body,/no tiene habilitado el registro de jornada/);
 const limited=planMetaFieldConversation({message:{type:'text',text:{body:'MENU'}},facts:{...facts,attendanceOnly:true,permissions:{attendance:true,report:false}},eventId:'pilot'});assert.ok(!limited.reply.sections[0].rows.some(r=>/evidencia|incidencia|consumo|avance|material/i.test(r.title)));
});
test('corporate full operations ESTADO records current ledger without replacing encrypted draft',async()=>{
 const f=mediaFixture(),draft={purpose:'INCIDENT',step:'INCIDENT_DESCRIPTION',title:'Fixture incident',lastEventId:'previous-field-event',lastMessageTimestamp:'1',lastReceivedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),bindingId:'binding-project-b'};
 f.worker.metadata.fieldChannelConversation={version:1,...draft,encryptedState:encryptCustomerSecret(JSON.stringify(draft),{organizationId:'organization-a',projectId:'project-b',purpose:'field-conversation',resourceId:f.worker.id},environment)};
 assert.deepEqual(readMetaFieldConversation({worker:f.worker,project:f.project,member:{organizationId:'organization-a'},channelBinding:{id:draft.bindingId}},environment),draft);
 const before=structuredClone(f.worker.metadata);f.audits.clear();f.message.type='text';f.message.text={body:'ESTADO'};
 f.attendance.push({id:'attendance-fixture',workerId:f.worker.id,recordedAt:new Date().toISOString(),metadata:{fieldOperations:{sequence:1,eventType:'CHECK_IN',phase:'ON_BREAK'}}});
 const outcome=await f.bridge.execute(f.context);assert.equal(outcome.kind,'CONVERSATION');assert.match(outcome.reply.body,/en pausa/);assert.equal(outcome.businessApplied,false);
 assert.deepEqual(f.worker.metadata,before);assert.deepEqual(f.io,[]);assert.equal([...f.audits.values()].filter(r=>r.action==='meta.field.dispatched').length,1);
});

test('stale corporate reply preserves the current prompt without inviting a reply to the rejection',async()=>{
 const f=mediaFixture(),draft={purpose:'INCIDENT',step:'INCIDENT_DESCRIPTION',title:'Fixture incident',lastEventId:'newer-field-event',lastMessageTimestamp:String(Math.floor(Date.now()/1000)+1),lastReceivedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),bindingId:'binding-project-b'};
 f.worker.metadata.fieldChannelConversation={version:1,...draft,encryptedState:encryptCustomerSecret(JSON.stringify(draft),{organizationId:'organization-a',projectId:'project-b',purpose:'field-conversation',resourceId:f.worker.id},environment)};
 const before=structuredClone(f.worker.metadata);f.audits.clear();f.message.type='text';f.message.text={body:'Detalle del paso anterior'};
 const outcome=await f.bridge.execute(f.context);assert.equal(outcome.kind,'STALE_CONVERSATION');assert.doesNotMatch(outcome.reply.body,/mantené presionado este mensaje|respondé a este mismo mensaje/);assert.deepEqual(f.worker.metadata,before);assert.deepEqual(f.io,[]);
});
// Real encrypted signed envelopes, canonical KYC/binding checks and selector
// correlation. Stop at delegation, before any field engine/provider operation.
function routingFixture(message,{promptChange=()=>{},workerChange=()=>{},requestChange=()=>{},membership=true,assigned=true,routeExpiresIn=120000,fieldExpiresIn=120000,fieldPurpose='MEDIA',routePhase='SELECTED'}={}){
 const member={actorId:'actor-a',membershipId:'membership-a',organizationId:'organization-a',clerkUserId:'user_Fixture',role:'AUDITOR',clerkRole:'org:member',organizationMetadata:{}};
 const connection={id:'connection-a',projectId:'project-a',organizationId:member.organizationId,phoneNumberId:'120000001',whatsappBusinessId:'130000001',enabled:true,connectionStatus:'CONNECTED',encryptedAccessToken:'v2.synthetic-not-used',metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:member.organizationId,customerSubscribed:true,customerVerification:{registered:true,expiresAt:null,scopes:['whatsapp_business_management','whatsapp_business_messaging']},customerActivation:{version:1,state:'ACTIVE',actorId:'other-admin'}}};
 const seal=(value,purpose,id,projectId='project-a')=>encryptCustomerSecret(JSON.stringify(value),{organizationId:member.organizationId,projectId,purpose,resourceId:id},environment);
 function event(id,body){
  const payload={wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,field:'messages',type:'message',value:{id:'wamid.'+id,from:'5491100001111',timestamp:String(Math.floor(Date.now()/1000)),...body}},externalId=digest([payload.wabaId,payload.phoneNumberId,'message',payload.value.id]),key='customer_webhook_'+externalId,payloadDigest=metaCustomerContentDigest(payload),companyRouting={mode:'COMPANY',revision:7,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT};
  return {id:key,projectId:'project-a',provider:'meta-customer-v1',externalId,eventType:'message',status:'PENDING',createdAt:new Date(),leaseToken:'source-lease',leaseExpiresAt:new Date(Date.now()+120000),payload:{version:1,organizationId:member.organizationId,channelId:connection.id,payloadDigest,companyRouting,encryptedPayload:seal(payload,'webhook',key),encryptedProof:seal({scheme:'meta-hmac-sha256-v1',appId:OBRASAAS_META_CHANNEL.appId,payloadDigest,channelId:connection.id,organizationId:member.organizationId,companyRouting},'webhook-proof',key)}};
 }
 const origin=event('origin12345678',{type:'text',text:{body:'VINCULAR '+'a'.repeat(43)}}),current=event('current12345678',message),binding={version:1,id:'binding-b',status:'VERIFIED',workerId:'worker-b',projectId:'project-b',organizationId:member.organizationId,actorId:member.actorId,membershipId:member.membershipId,clerkUserId:member.clerkUserId,senderE164:'+5491100001111',connectionId:connection.id,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,kycSubmissionId:'kyc-b',kycReviewedAt:'2026-10-01T10:00:00Z',proofEventId:origin.id,proofExternalId:origin.externalId,proofPayloadDigest:origin.payload.payloadDigest};
 const worker={id:'worker-b',projectId:'project-b',phone:binding.senderE164,active:true,actorId:member.actorId,membershipId:member.membershipId,clerkUserId:member.clerkUserId,organizationId:member.organizationId,assignmentRevision:2,projectName:'Obra B',metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:member.clerkUserId,permissions:{attendance:false,report:true},kyc:{version:1,status:'APPROVED',submissionId:'kyc-b',contentHash:'fixture-kyc-content',images:[{id:'document-front'},{id:'selfie'}],review:{decision:'APPROVED',actorId:'other-reviewer',recordedAt:binding.kycReviewedAt}},channelIdentity:{binding}}}};
 const routeId='company_route_'+digest([member.organizationId,connection.id,importSenderHmac(connection)]),promptId='customer_webhook_'+digest('durable-field-prompt'),nonce='1'.repeat(20);
 const route={id:routeId,epoch:4,actorId:member.actorId,membershipId:member.membershipId,projectId:worker.projectId,workerId:worker.id,assignmentRevision:2,bindingId:binding.id,encryptedState:seal({phase:routePhase,expiresAt:new Date(Date.now()+routeExpiresIn).toISOString()},'company-route',routeId)};
 const state={purpose:fieldPurpose,step:'MEDIA',taskId:'task-b',sectorId:'sector-b',nonce,choices:[{value:'MEDIA',title:'Enviar evidencia'}],lastEventId:promptId,lastMessageTimestamp:'1',lastReceivedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+fieldExpiresIn).toISOString(),bindingId:binding.id};
 worker.metadata.fieldChannelConversation={version:1,...state,encryptedState:seal(state,'field-conversation',worker.id,worker.projectId)};
 workerChange(worker);
 const prompt={routeId,routeEpoch:route.epoch,workerId:worker.id,projectId:worker.projectId,bindingId:binding.id,actorId:member.actorId,membershipId:member.membershipId};promptChange(prompt);
 const outboundId=customerOutboundId(promptId),request={organizationId:member.organizationId,channelId:connection.id,targetProjectId:worker.projectId,sourceRouteId:promptId};requestChange(request);
 const outbound={id:outboundId,payload:{requestDigest:digest(request),encryptedPayload:seal(request,'outbound',outboundId)},outcome:{messageId:'wamid.currentprompt123456'}},projections=new Map(),queries=[];let io=0;
 async function query(sql,args=[]){
  queries.push(sql);
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL')||sql.startsWith('SELECT pg_advisory'))return rows([]);
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date()}]);
  if(sql.includes('to_regclass'))return rows([{present:true}]);
  if(sql.includes('count(*)::int AS count FROM information_schema.columns'))return rows([{count:1}]);
  if(sql.includes('FROM public."WhatsAppCompanySchema"'))return rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]})}]);
  if(sql.includes('SELECT conname,convalidated'))return rows(args[0].map(conname=>({conname,convalidated:true})));
  if(sql.includes('SELECT c.relname,i.indisvalid,i.indisready,i.indisunique FROM pg_index'))return rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));
  if(sql.includes('SELECT tgname,tgenabled FROM pg_trigger'))return rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));
  if(sql.includes('information_schema.columns')||sql.includes('pg_get_constraintdef')||sql.includes('pg_get_indexdef')||sql.includes('pg_get_triggerdef'))return rows([]);
  if(sql.includes('SELECT "eventType"'))throw Object.assign(new Error('Controlled field delegation boundary'),{code:'CONTROLLED_FIELD_DELEGATION'});
  if(sql.includes('FROM public."WebhookEvent"'))return rows(args[0]===current.id?[current]:args[0]===origin.id?[origin]:args[0]===outboundId?[outbound]:[]);
  if(sql.includes('FROM public."WhatsAppConnection"'))return rows([connection]);
  if(sql.includes('SELECT w.*'))return rows([worker]);
  if(sql.includes('FROM public."PlatformUser"'))return rows([{id:member.actorId,clerkUserId:member.clerkUserId}]);
  if(sql.includes('FROM public."TenantMembership"'))return rows(membership?[member]:[]);
  if(sql.includes('FROM public."ProjectMembership"'))return rows(assigned?[{id:'pm-b'}]:[]);
  if(sql.includes('FROM public."Project"'))return rows([{id:args[0],organizationId:member.organizationId,name:'Project '+args[0],status:'ACTIVE',metadata:{}}]);
  if(sql.includes('FROM public."Worker"'))return rows([worker]);
  if(sql.includes('FROM public."AuditLog"'))return rows(sql.includes("kind'='REVIEW_KYC'")?[{id:'review-kyc',metadata:{}}]:sql.includes("kind'='KYC_SUBMITTED'")?[{id:'submit-kyc',metadata:{contentHash:worker.metadata.participant.kyc.contentHash}}]:[{metadata:{projectId:worker.projectId,bindingId:binding.id,proofPayloadDigest:binding.proofPayloadDigest}}]);
  if(sql.includes('FROM public."WhatsAppCompanyChannel"'))return rows([{connectionId:connection.id,anchorProjectId:connection.projectId,mode:'COMPANY',revision:7}]);
  if(sql.includes('FROM public."WhatsAppChannelProjectAssignment"'))return rows([{revision:2}]);
  if(sql.includes('FROM public."WhatsAppCompanyRoute"'))return rows([route]);
  if(sql.includes('FROM public."WhatsAppCompanyEventRoute"'))return rows(sql.includes('SELECT "routeId"')?[prompt]:projections.has(args[0])?[projections.get(args[0])]:[]);
  if(sql.startsWith('INSERT INTO public."WhatsAppCompanyEventRoute"')){projections.set(args[0],{kind:args[4],projectId:args[9],workerId:args[10]});return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."WhatsAppCompanyEventRoute"')){projections.get(args[0]).encryptedResult=args[1];return {rows:[],rowCount:1};}
  throw Error('Unexpected selector SQL: '+sql);
 }
 const bridge=createCompanyChannelBridge({connect:async()=>({query,release:()=>{}}),environment,provider:{downloadMedia:async()=>{io++;throw Error('No provider I/O authorized');}}});
 return {bridge,context:{eventId:current.id,projectId:current.projectId,channelId:connection.id,payloadDigest:current.payload.payloadDigest,leaseToken:current.leaseToken},projection:()=>projections.get(current.id),io:()=>io,queries,worker,nonce};
}
// Same HMAC as the existing selector, from a synthetic key and synthetic sender.
function importSenderHmac(connection){return createHmac('sha256',Buffer.from(environment.META_CUSTOMER_CREDENTIALS_KEY,'base64')).update(JSON.stringify(['company-sender-v1',connection.organizationId,connection.id,'+5491100001111'])).digest('hex');}
for(const [name,message,options] of [
 ['missing reply',{type:'image',image:{id:'fixture-media',mime_type:'image/png'}},{}],
 ['nested asset context is not Meta message context',{type:'image',image:{id:'fixture-media',mime_type:'image/png',context:{id:'wamid.currentprompt123456'}}},{}],
 ['other prompt',{type:'audio',context:{id:'wamid.otherprompt123456'},audio:{id:'fixture-media',mime_type:'audio/ogg'}},{}],
 ['late route epoch',{type:'video',context:{id:'wamid.currentprompt123456'},video:{id:'fixture-media',mime_type:'video/mp4'}},{promptChange:p=>p.routeEpoch--}],
 ['other worksite prompt',{type:'image',context:{id:'wamid.currentprompt123456'},image:{id:'fixture-media',mime_type:'image/png'}},{promptChange:p=>p.projectId='project-a'}],
 ['other actor prompt',{type:'text',context:{id:'wamid.currentprompt123456'},text:{body:'INCIDENCIA'}},{promptChange:p=>p.actorId='other-actor'}],
 ['other membership prompt',{type:'location',context:{id:'wamid.currentprompt123456'},location:{latitude:0,longitude:0}},{promptChange:p=>p.membershipId='other-membership'}],
 ['other binding prompt',{type:'image',context:{id:'wamid.currentprompt123456'},image:{id:'fixture-media',mime_type:'image/png'}},{promptChange:p=>p.bindingId='binding-other'}],
 ['outbound from anchor instead of target',{type:'image',context:{id:'wamid.currentprompt123456'},image:{id:'fixture-media',mime_type:'image/png'}},{requestChange:p=>p.targetProjectId='project-a'}],
 ['old B to A to B interactive nonce',{type:'interactive',interactive:{list_reply:{id:'obra:'+'1'.repeat(20)+':0'}}},{promptChange:p=>p.routeEpoch-=2}],
])test('signed corporate '+name+' denies before download or FIELD reservation',async()=>{
 const f=routingFixture(message,options),outcome=await f.bridge.execute(f.context);assert.equal(outcome.kind,'WORKSITE_INPUT_CONTEXT_REQUIRED');assert.equal(outcome.businessApplied,false);assert.equal(f.projection().kind,'SELECTION');assert.equal(f.projection().projectId,null);assert.equal(f.io(),0);
});
for(const type of ['image','audio','video','location','text','interactive'])test('signed corporate current '+type+' delegates only frozen B source',async()=>{
 const message={type,context:{id:'wamid.currentprompt123456'},...(type==='text'?{text:{body:'INCIDENCIA'}}:type==='interactive'?{interactive:{list_reply:{id:'obra:'+'1'.repeat(20)+':0'}}}:{[type]:{id:'fixture-media',mime_type:type==='image'?'image/png':type==='audio'?'audio/ogg':'video/mp4',latitude:0,longitude:0}})},f=routingFixture(message);
 await assert.rejects(f.bridge.execute(f.context),{code:'CONTROLLED_FIELD_DELEGATION'});assert.equal(f.projection().kind,'FIELD');assert.equal(f.projection().projectId,'project-b');assert.equal(f.projection().workerId,'worker-b');assert.equal(f.io(),0);
});
for(const type of ['image','audio','video','location','text','interactive'])test('live correlated corporate '+type+' draft continues after worksite selection expires',async()=>{
 const message={type,context:{id:'wamid.currentprompt123456'},...(type==='text'?{text:{body:'Detalle del paso actual'}}:type==='interactive'?{interactive:{list_reply:{id:'obra:'+'1'.repeat(20)+':0'}}}:{[type]:{id:'fixture-media',mime_type:type==='image'?'image/png':type==='audio'?'audio/ogg':'video/mp4',latitude:0,longitude:0}})},f=routingFixture(message,{routeExpiresIn:-1000});
 const before=structuredClone(f.worker.metadata);
 await assert.rejects(f.bridge.execute(f.context),{code:'CONTROLLED_FIELD_DELEGATION'});
 assert.equal(f.projection().kind,'FIELD');assert.equal(f.projection().projectId,'project-b');assert.equal(f.projection().workerId,'worker-b');assert.deepEqual(f.worker.metadata,before);assert.equal(f.io(),0);
});
for(const [name,options] of [
 ['expired field draft',{fieldExpiresIn:-1000}],['menu rather than active draft',{fieldPurpose:'MENU'}],['unknown purpose',{fieldPurpose:'UNKNOWN'}],['unconfirmed worksite',{routePhase:'CONFIRM'}],['changed prompt epoch',{promptChange:p=>p.routeEpoch--}],
])test('expired worksite cannot be renewed from '+name,async()=>{
 const f=routingFixture({type:'image',context:{id:'wamid.currentprompt123456'},image:{id:'fixture-media',mime_type:'image/png'}},{routeExpiresIn:-1000,...options}),before=structuredClone(f.worker.metadata),outcome=await f.bridge.execute(f.context);
 assert.equal(outcome.kind,'WORKSITE_SELECTION_REQUIRED');assert.equal(outcome.businessApplied,false);assert.equal(f.projection().kind,'SELECTION');assert.equal(f.projection().projectId,null);assert.deepEqual(f.worker.metadata,before);assert.equal(f.io(),0);
});
for(const body of ['ENTRADA','PAUSA','VOLVER','SALIDA','TAREAS','EVIDENCIA','INCIDENCIA','MATERIALES','CONSUMO','AVANCE'])test('expired selection preserves live draft rather than starting '+body,async()=>{
 const f=routingFixture({type:'text',context:{id:'wamid.currentprompt123456'},text:{body}},{routeExpiresIn:-1000}),before=structuredClone(f.worker.metadata),outcome=await f.bridge.execute(f.context);
 assert.equal(outcome.kind,'WORKSITE_DRAFT_PENDING');assert.equal(outcome.businessApplied,false);assert.equal(f.projection().kind,'SELECTION');assert.deepEqual(f.worker.metadata,before);assert.equal(f.io(),0);
});
for(const message of [{type:'image',image:{id:'fixture-media',mime_type:'image/png'}},{type:'audio',context:{id:'wamid.otherprompt123456'},audio:{id:'fixture-media',mime_type:'audio/ogg'}},{type:'interactive',interactive:{list_reply:{id:'obra:'+'2'.repeat(20)+':0'}}}])test('live draft does not renew expired worksite for uncorrelated '+message.type,async()=>{
 const f=routingFixture(message,{routeExpiresIn:-1000}),before=structuredClone(f.worker.metadata),outcome=await f.bridge.execute(f.context);
 assert.equal(outcome.kind,'WORKSITE_INPUT_CONTEXT_REQUIRED');assert.equal(outcome.businessApplied,false);assert.equal(f.projection().kind,'SELECTION');assert.equal(f.projection().projectId,null);assert.deepEqual(f.worker.metadata,before);assert.equal(f.io(),0);
});
for(const [name,options] of [
 ['membership revoked',{membership:false}],['project assignment revoked',{assigned:false}],['worker inactive',{workerChange:w=>w.active=false}],
 ['KYC not approved',{workerChange:w=>w.metadata.participant.kyc.status='PENDING_REVIEW'}],['self-review',{workerChange:w=>w.metadata.participant.kyc.review.actorId='actor-a'}],
 ['binding revoked',{workerChange:w=>w.metadata.participant.channelIdentity.binding.status='REVOKED'}],['no operation permission',{workerChange:w=>w.metadata.participant.permissions.report=false}],
])test('corporate current '+name+' fails before source projection and I/O',async()=>{
 const f=routingFixture({type:'image',context:{id:'wamid.currentprompt123456'},image:{id:'fixture-media',mime_type:'image/png'}},options);await assert.rejects(f.bridge.execute(f.context));assert.equal(f.projection(),undefined);assert.equal(f.io(),0);
});
for(const message of [{type:'document',document:{id:'fixture-document'}},{type:'nfm_reply',nfm_reply:{}},{type:'interactive',interactive:{type:'nfm_reply',nfm_reply:{response_json:'{"flow_token":"fixture"}'}},context:{id:'wamid.currentprompt123456'}},{type:'text',text:{body:'KYC'}},{type:'text',text:{body:'VERIFICAR'}}])test('corporate unsupported identity document or Flow remains closed: '+message.type+':'+(message.text?.body||''),async()=>{
 const f=routingFixture(message),outcome=await f.bridge.execute(f.context);assert.equal(outcome.kind,'COMPANY_ADAPTER_DISABLED');assert.equal(outcome.businessApplied,false);assert.equal(f.projection().kind,'SELECTION');assert.equal(f.io(),0);
});
const closedSupport=()=>({attendance:false,kyc:false,media:false,flows:false,templates:false});
function activeCustomer(){return {enabled:true,connectionStatus:'CONNECTED',metadata:{customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE',actorId:'owner'},customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null}}};}
const supportClock=Date.parse('2026-10-06T12:00:00.000Z');
test('company operational support requires canonical activation, COMPANY, valid database time and no development pilot',()=>{
 const c=activeCustomer(),options={schemaReady:true,mode:'COMPANY',now:supportClock};assert.deepEqual(companyChannelOperationalCapabilities(c,options),{...closedSupport(),attendance:true,kyc:true,media:true});
 for(const change of [{schemaReady:false},{mode:'PROJECT_ONLY'},{mode:'PREPARED'},{mode:'SUSPENDED'},{now:NaN},{now:undefined}])assert.deepEqual(companyChannelOperationalCapabilities(c,{...options,...change}),closedSupport());
 for(const mutate of [r=>r.enabled=false,r=>r.connectionStatus='DISCONNECTED',r=>r.metadata.developmentPilot={},r=>r.metadata.customerSubscribed=false,r=>r.metadata.customerActivation.state='DEACTIVATED',r=>r.metadata.customerVerification.registered=false,r=>r.metadata.customerVerification.scopes=[],r=>r.metadata.customerVerification.expiresAt=new Date(supportClock+60000).toISOString(),r=>r.metadata.customerVerification.expiresAt='malformed',r=>r.metadata.customerLifecycle={recovery:{version:1,state:'VERIFYING'}}]){const copy=structuredClone(c);mutate(copy);assert.deepEqual(companyChannelOperationalCapabilities(copy,options),closedSupport());}
});
function companyReadFixture({ready=true,connections=[]}={}){
 const member={organizationId:'org_Test',organizationName:'Synthetic company',actorId:'user_AdminA',role:'ADMIN'},queries=[];
 const query=async(sql,args=[])=>{
  queries.push({sql,args});if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(supportClock)}]);
  if(sql.includes('to_regclass'))return rows([{present:ready}]);
  if(sql.includes('count(*)::int AS count FROM information_schema.columns'))return rows([{count:1}]);
  if(sql.includes('FROM public."WhatsAppCompanySchema"'))return rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]})}]);
  if(sql.includes('SELECT conname,convalidated'))return rows(args[0].map(conname=>({conname,convalidated:true})));
  if(sql.includes('SELECT c.relname,i.indisvalid,i.indisready,i.indisunique FROM pg_index'))return rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));
  if(sql.includes('SELECT tgname,tgenabled FROM pg_trigger'))return rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));
  if(sql.includes('information_schema.columns')||sql.includes('pg_get_constraintdef')||sql.includes('pg_get_indexdef')||sql.includes('pg_get_triggerdef'))return rows([]);
  if(sql.includes('FROM public."WhatsAppConnection"')){assert.equal(args[0],member.organizationId);return rows(connections.map(r=>ready?r:{...r,mode:undefined,revision:undefined}));}
  if(sql.includes('FROM public."WhatsAppChannelProjectAssignment"'))return rows([{connectionId:'connection-a',projectId:'project-a',projectName:'Obra A',status:'ACTIVE',revision:1,metadata:'private-assignment'}]);
  if(sql.includes('FROM public."Project"'))return rows([{id:'project-a',name:'Obra A'}]);
  throw Error('Unexpected company snapshot SQL: '+sql);
 };
 const store=createCompanyChannelStore({workspace:{organizationOperation:async(_session,context,write,run)=>{assert.equal(write,false);return run({query},member,context.scope);}}});
 return {store,queries};
}
test('canonical company snapshot whitelists channel and assignments while summarizing only visible operational support',async()=>{
 const base={...activeCustomer(),id:'connection-a',anchorProjectId:'project-a',anchorName:'Obra A',displayPhoneNumber:'+54 11 0000 0000',mode:'COMPANY',revision:3,encryptedAccessToken:'private-cipher',actorId:'private-actor',phone:'private-individual',metadata:{...activeCustomer().metadata,token:'private-token'}},closed={...base,id:'connection-b',mode:'SUSPENDED'};
 const f=companyReadFixture({connections:[closed,base]}),value=await f.store.read({}, {scope:'a'.repeat(64),projectId:'project-a'});
 assert.deepEqual(value.capabilities,{...closedSupport(),attendance:true,kyc:true,media:true});assert.deepEqual(value.channels[0].capabilities,closedSupport());assert.equal(value.channels[1].capabilities.media,true);
 assert.deepEqual(Object.keys(value.channels[1]).sort(),['activationRequirement','anchorName','anchorProjectId','assignments','capabilities','displayPhoneNumber','id','mode','revision']);assert.equal(value.channels[1].activationRequirement,null);assert.deepEqual(Object.keys(value.channels[1].assignments[0]).sort(),['projectId','projectName','revision','status']);
 for(const marker of ['private-cipher','private-actor','private-individual','private-token','private-assignment'])assert.equal(JSON.stringify(value).includes(marker),false);
 assert.equal(f.queries.filter(r=>r.sql==='SELECT clock_timestamp() AS now').length,1);
 for(const connections of [[],[{...base,enabled:false}],[{...base,metadata:{...base.metadata,developmentPilot:{}}}],[{...base,metadata:{...base.metadata,customerVerification:{...base.metadata.customerVerification,expiresAt:new Date(supportClock+30000).toISOString()}}}]])assert.deepEqual((await companyReadFixture({connections}).store.read({}, {scope:'a'.repeat(64),projectId:'project-a'})).capabilities,closedSupport());
 const missing=await companyReadFixture({ready:false,connections:[base]}).store.read({}, {scope:'a'.repeat(64),projectId:'project-a'});assert.equal(missing.schemaReady,false);assert.deepEqual(missing.capabilities,closedSupport());assert.equal(missing.channels[0].mode,'PROJECT_ONLY');assert.deepEqual(missing.channels[0].capabilities,closedSupport());assert.deepEqual(missing.channels[0].assignments,[]);
});
