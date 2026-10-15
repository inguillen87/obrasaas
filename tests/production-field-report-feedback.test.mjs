import test from 'node:test';
import assert from 'node:assert/strict';
import {readOwnFieldReports} from '../src/lib/field-report-feedback.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
import {customerReplyMessage} from '../src/lib/meta-customer-provider.mjs';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {createMetaFieldBridge,readMetaFieldConversation} from '../src/lib/meta-field-bridge.mjs';

const member={organizationId:'company-a',actorId:'actor-a',membershipId:'membership-a',clerkUserId:'user_Synthetic',role:'ADMIN'},project={id:'project-a',name:'Obra sintética'},workerId='worker-a',now=new Date('2026-10-14T12:00:00.000Z'),scope='a'.repeat(64);
const rows=values=>({rows:values,rowCount:values.length});
const review=decision=>({decision,actorId:'reviewer-a',reason:'Revisión humana independiente del informe original.',recordedAt:'2026-10-14T13:00:00.000Z',taskUpdated:decision==='APPROVE'});
function report(section,index,changes={}){
 const status=['PENDING',section==='EVIDENCE'?'APPROVED':'APPLIED','REJECTED','EXPIRED'][index%4],decision=status==='APPROVED'||status==='APPLIED'?'APPROVE':status==='REJECTED'?'REJECT':null;
 const common={id:section.toLowerCase()+'-'+index,section,organizationId:member.organizationId,projectId:project.id,createdAt:2000-index};
 if(section==='EVIDENCE')return {...common,title:'Evidencia sintética '+index,description:'Descripción del archivo enviado por la cuenta original.',metadata:{fieldOperations:{version:1,kind:'EVIDENCE',workerId,recordedBy:member.actorId,taskId:'task-a',capturedAt:now.toISOString(),media:{kind:'audio'},review:decision?review(decision):null,...changes}}};
 return {...common,summary:'Avance sintético '+index,status,expired:status==='EXPIRED',proposedByWorkerId:workerId,expiresAt:new Date('2026-10-21T12:00:00.000Z'),action:{fieldOperationsVersion:1,submittedBy:member.actorId,submittedAt:now.toISOString(),taskId:'task-a',progress:25,quantity:'2.5000',baseline:'10.0000',unit:'M2',reason:'Medición declarada para revisión independiente.',...changes},result:decision?{fieldOperations:review(decision)}:null};
}
function database(records,{proof=true,ambiguous=false}={}){
 const queries=[];return {queries,async query(sql,args=[]){queries.push({sql,args});assert.match(sql,/^SELECT /,'Reads cannot execute a business mutation');
  if(sql.includes('FROM public."AuditLog"')){
   if(!proof)return rows([]);const row=records.find(r=>r.id===args[5]);if(!row)return rows([]);
   const snapshot=row.section==='EVIDENCE'?{id:row.id,workerId:row.metadata.fieldOperations.workerId,taskId:row.metadata.fieldOperations.taskId,capturedAt:row.metadata.fieldOperations.capturedAt,review:row.metadata.fieldOperations.review}:{id:row.id,workerId:row.proposedByWorkerId,taskId:row.action.taskId,reason:row.action.reason,result:row.result?.fieldOperations};
   const result={id:(args[1]===member.actorId?'original-':'decision-')+row.id,metadata:{outcome:{[args[4]]:snapshot}}};return rows(ambiguous?[result,{...result,id:'duplicate-'+row.id}]:[result]);
  }
  assert.ok(sql.includes('JOIN public."Project" p'));assert.ok(sql.includes('p."organizationId"=$2'));
  const evidence=sql.includes('public."Incident"'),source=r=>evidence?r.metadata.fieldOperations:r.action;
  assert.ok(sql.includes("->>'"+(evidence?'recordedBy':'submittedBy')+"'=$4"));assert.ok(sql.includes(evidence?"->>'workerId'=$3":'"proposedByWorkerId"=$3'));
  const visible=records.filter(r=>r.section===(evidence?'EVIDENCE':'PROGRESS')&&r.projectId===args[0]&&r.organizationId===args[1]&&(evidence?source(r).workerId:r.proposedByWorkerId)===args[2]&&source(r)[evidence?'recordedBy':'submittedBy']===args[3]);
  if(sql.startsWith('SELECT r.id FROM'))return rows(visible.filter(r=>r.id===args[4]).map(r=>({id:r.id})));
  assert.match(sql,/LIMIT 6$/);const anchor=visible.find(r=>r.id===args[4]);return rows(visible.filter(r=>(!args[4]||r.createdAt<anchor?.createdAt)&&(args[5]===null||r.id===args[5])).sort((a,b)=>b.createdAt-a.createdAt).slice(0,6));
 }};
}
const read=(db,section,extra={})=>readOwnFieldReports(db,member,project,{workerId,section,...extra});
test('both own histories page beyond 100 with original author and current worker, all states and exact receipt correlation',async()=>{
 for(const section of ['EVIDENCE','PROGRESS']){
  const records=Array.from({length:130},(_,i)=>report(section,i)),foreign=report(section,500,section==='EVIDENCE'?{recordedBy:'previous-actor'}:{submittedBy:'previous-actor'}),other=report(section,501);if(section==='EVIDENCE')other.metadata.fieldOperations.workerId='other-worker';else other.proposedByWorkerId='other-worker';
  const db=database([...records,foreign,other,{...report(section,502),organizationId:'other-company'},{...report(section,503),projectId:'other-project'}]),ids=[];let afterReport=null;
  do{const page=await read(db,section,{afterReport});assert.ok(page.records.length<=5);for(const item of page.records){ids.push(item.id);assert.equal(item.receiptId,'original-'+item.id);if(item.review)assert.equal(item.review.receiptId,'decision-'+item.id);for(const key of ['metadata','actorId','canReview','canDecide','media','processing','result'])assert.equal(item[key],undefined);}afterReport=page.nextCursor;}while(afterReport);
  assert.equal(ids.length,130);assert.equal(new Set(ids).size,130);assert.equal((await read(db,section,{reportId:records[129].id})).records[0].id,records[129].id);
 }
});
test('foreign company/project/worker/original author and wrong section cursors deny before page or proof reads even for office roles',async()=>{
 for(const section of ['EVIDENCE','PROGRESS'])for(const role of ['ADMIN','DIRECTOR','AUDITOR'])for(const key of ['afterReport','reportId']){
  const original=report(section,1,section==='EVIDENCE'?{recordedBy:'old-actor'}:{submittedBy:'old-actor'}),db=database([original]);await assert.rejects(readOwnFieldReports(db,{...member,role},project,{workerId,section,[key]:original.id}),{code:'FIELD_REPORT_CURSOR_UNAVAILABLE'});assert.equal(db.queries.length,1);
  await assert.rejects(readOwnFieldReports(database([report(section,1)]),member,project,{workerId,section:section==='EVIDENCE'?'PROGRESS':'EVIDENCE',[key]:section.toLowerCase()+'-1'}),{code:'FIELD_REPORT_CURSOR_UNAVAILABLE'});
 }
});
test('malformed selectors and ambiguous or missing historical receipts never manufacture a proof',async()=>{
 for(const section of ['EVIDENCE','PROGRESS']){
  const db=database([report(section,1)]);await assert.rejects(read(db,section,{afterReport:'evidence-1',reportId:'evidence-1'}),{code:'FIELD_REPORT_QUERY_INVALID'});assert.equal(db.queries.length,0);
  for(const options of [{proof:false},{ambiguous:true}]){const item=(await read(database([report(section,1)],options),section)).records[0];assert.equal(item.receiptId,null);assert.equal(item.review.receiptId,null);}
  const invalid=report(section,1);if(section==='EVIDENCE')invalid.metadata.fieldOperations.review.actorId=member.actorId;else invalid.result.fieldOperations.actorId=member.actorId;await assert.rejects(read(database([invalid]),section),{code:'FIELD_REPORT_INTEGRITY'});
 }
});
test('service locks/proves current participant report and canonical KYC before every page or directed read',async()=>{
 const db=database([report('PROGRESS',1)]);let allowed=true,authority=0;const service=createFieldOperations({workspace:{projectOperation:async(_s,_c,writable,callback)=>{assert.equal(writable,true);return callback(db,member,scope,project);}},assertParticipant:async(_db,_member,session,id,worker,options)=>{authority++;assert.equal(session.userId,member.clerkUserId);assert.equal(id,project.id);assert.equal(worker,workerId);assert.deepEqual(options,{permission:'report',requireKyc:true});if(!allowed)throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);return {id:workerId};}}),session={userId:member.clerkUserId};
 await service.ownReports(session,{projectId:project.id,scope,workerId,section:'PROGRESS'});const previous=db.queries.length;allowed=false;for(const extra of [{},{reportId:'progress-1'},{afterReport:'progress-1'}])await assert.rejects(service.ownReports(session,{projectId:project.id,scope,workerId,section:'PROGRESS',...extra}),{code:'FIELD_PARTICIPANT_REQUIRED'});assert.equal(db.queries.length,previous);assert.equal(authority,4);
});

const base={projectName:project.name,projectId:project.id,workerId,permissions:{attendance:true,report:true},latest:null,sectors:[],tasks:[],evidence:[],proposals:[],inventory:{materials:[]},ownConsumptions:{records:[],nextCursor:null}};let serial=0;
function plan(message,state=null,page=null,extra={}){const result=planMetaFieldConversation({message,state,facts:{...base,ownReports:page,...extra},eventId:'report-event-'+(++serial),now});if(result.state&&!result.preserveConversation)result.state={...result.state,version:1,expiresAt:'2026-10-14T12:15:00.000Z'};customerReplyMessage(result.reply);assert.equal(result.command,undefined);assert.equal(result.media,undefined);return result;}
const say=(body,state,page,extra)=>plan({type:'text',text:{body}},state,page,extra);
const select=(result,value,page,extra)=>{const i=result.state.choices.findIndex(row=>row.value===value);assert.ok(i>=0,value);return plan({type:'interactive',interactive:{type:'list_reply',list_reply:{id:result.reply.sections[0].rows[i].id}}},result.state,page,extra);};
test('ESTADO offers own evidence/progress and five-record pages/direct detail with outcomes, reasons and separate receipts',async()=>{
 const status=say('ESTADO');assert.match(status.reply.body,/EVIDENCIAS.*AVANCES/);assert.doesNotMatch(status.reply.body,/Mi cuenta/);assert.match(status.reply.body,/^Obra: [^\n]+\nJornada: [^\n]+\n/);assert.match(status.reply.body,/\nConsumos informados por tu cuenta \(últimos 0\): ninguno\./);
 for(const [section,purpose] of [['EVIDENCE','OWN_EVIDENCE'],['PROGRESS','OWN_PROGRESS']]){
  const db=database(Array.from({length:7},(_,i)=>report(section,i))),first=await read(db,section),list=select(status,purpose,first),second=await read(db,section,{afterReport:first.nextCursor}),next=select(list,'NEXT_REPORTS',second),directed=await read(db,section,{reportId:second.records[0].id}),detail=select(next,second.records[0].id,directed);
  assert.equal(list.reportRead,true);assert.equal(next.reportRead,true);assert.equal(detail.state,next.state);assert.equal(detail.preserveConversation,true);for(const value of [directed.records[0].receiptId,directed.records[0].review?.receiptId,directed.records[0].review?.reason].filter(Boolean))assert.ok(detail.reply.body.includes(value));assert.equal(select(next,'FIRST_REPORTS',first).state.reportAfter,null);
 }
});
test('history aliases and ESTADO preserve every open business draft, original nonce and expiry until explicit cancellation',()=>{
 for(const purpose of ['ATTENDANCE','MEDIA','MATERIAL','PROGRESS','CONSUMPTION','PLAN_IMPORT'])for(const command of ['EVIDENCIAS','AVANCES','ESTADO']){
  const draft={version:1,purpose,step:'REASON',nonce:'b'.repeat(20),choices:[{value:'CONFIRM',title:'Guardar'}],expiresAt:'2026-10-14T12:15:00.000Z'};const result=say(command,draft);assert.equal(result.state,draft);assert.equal(result.preserveConversation,true);assert.match(result.reply.body,/Conservamos el borrador/);
 }
});
test('expired or stale prompt, missing directed facts and revoked report capability do not disclose report detail',async()=>{
 const page=await read(database([report('PROGRESS',1)]),'PROGRESS'),list=say('AVANCES',null,page),message={type:'interactive',interactive:{type:'list_reply',list_reply:{id:list.reply.sections[0].rows[0].id}}};
 const stale=plan(message,{...list.state,nonce:'c'.repeat(20)},page);assert.doesNotMatch(stale.reply.body,/progress-1|original-/);const expired=plan(message,{...list.state,expiresAt:now.toISOString()},page);assert.doesNotMatch(expired.reply.body,/progress-1|original-/);
 const denied=plan(message,list.state,page,{permissions:{attendance:true,report:false}});assert.equal(denied.state,null);assert.doesNotMatch(denied.reply.body,/progress-1|original-/);assert.throws(()=>plan(message,list.state,{...page,records:[]}),{code:'FIELD_REPORT_CURSOR_UNAVAILABLE'});
});
test('current decision replaces a previous pending projection while original receipt stays distinct and expiry is never an approval',async()=>{
 const item=report('PROGRESS',0),db=database([item]),page=await read(db,'PROGRESS'),list=say('AVANCES',null,page);item.status='REJECTED';item.result={fieldOperations:review('REJECT')};const detail=select(list,item.id,await read(db,'PROGRESS',{reportId:item.id}));assert.match(detail.reply.body,/Rechazado/);assert.match(detail.reply.body,/Revisión humana independiente/);
 item.status='PENDING';item.expired=true;item.result=null;const expired=select(list,item.id,await read(db,'PROGRESS',{reportId:item.id}));assert.match(expired.reply.body,/venció sin una decisión autorizada/);assert.doesNotMatch(expired.reply.body,/Revisión humana registrada: Aprobado/);
});
test('maximum-length names, reasons and receipts preserve WhatsApp message/list bounds and no elevated actions',async()=>{
 const records=Array.from({length:6},(_,i)=>report('PROGRESS',i)),db=database(records);for(const row of records){row.summary='😀'.repeat(250);row.action.reason='R'.repeat(1000);if(row.result)row.result.fieldOperations.reason='D'.repeat(1000);}
 const page=await read(db,'PROGRESS'),prefix='Obra: '+'O'.repeat(160)+'\n',facts={projectName:'O'.repeat(160),replyBodyLimit:1024-prefix.length};const status=say('ESTADO',null,null,facts),list=say('AVANCES',null,page,facts);assert.ok(prefix.length+status.reply.body.length<=1024);assert.ok(prefix.length+list.reply.body.length<=1024);assert.ok(list.reply.sections[0].rows.length<=10);
 const detail=select(list,page.records[1].id,await read(db,'PROGRESS',{reportId:page.records[1].id}),facts);assert.ok(prefix.length+detail.reply.body.length<=4096);assert.doesNotMatch(list.reply.sections[0].rows.map(r=>r.title).join(' '),/Aprobar|Rechazar/);
});

function bridgeFixture(records){
 const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,43).toString('base64')},data=database(records),audits=new Map(),images=[{id:'document-front',kind:'DOCUMENT_FRONT',sha256:'a'.repeat(64),bytes:8,contentType:'image/png'},{id:'selfie',kind:'SELFIE',sha256:'b'.repeat(64),bytes:8,contentType:'image/png'}],kyc={version:1,status:'APPROVED',submissionId:'kyc-a',contentHash:digest(images.map(i=>[i.kind,i.sha256,i.bytes,i.contentType])),images,review:{decision:'APPROVED',actorId:'reviewer-a',recordedAt:now.toISOString()}};
 const worker={id:workerId,name:'Ficha propia',active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:member.clerkUserId,permissions:{attendance:true,report:true},kyc}}},connection={id:'channel-a',projectId:project.id,metadata:{}},binding={id:'binding-a'};let event,message,serial=0,open=0,externalCalls=0,ownQueries=0;
 const query=async(sql,args=[])=>{
  if(sql==='BEGIN'){open++;return rows([]);}if(sql==='COMMIT'||sql==='ROLLBACK'){open--;return rows([]);}if(sql.startsWith('SET LOCAL')||sql.startsWith('SAVEPOINT'))return rows([]);
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(Date.now()+serial+20)}]);if(sql.includes('SELECT "eventType"'))return rows([{eventType:'message'}]);
  if(sql.includes("'REVIEW_KYC'"))return rows([{id:'kyc-review',metadata:{}}]);if(sql.includes("'KYC_SUBMITTED'"))return rows([{id:'kyc-submission',metadata:{contentHash:kyc.contentHash}}]);
  if(sql.startsWith('SELECT r.id')){ownQueries++;return data.query(sql,args);}if(sql.includes('FROM public."AuditLog"')&&sql.includes("metadata->'outcome'->$5"))return data.query(sql,args);
  if(sql.includes('FROM public."AuditLog"')){const prior=audits.get(args[0]);return rows(prior?[prior]:[]);}if(sql.startsWith('INSERT INTO public."AuditLog"')){audits.set(args[0],{id:args[0],metadata:JSON.parse(args[4])});return rows([]);}
  if(sql.startsWith('UPDATE public."Worker"')){worker.metadata=JSON.parse(args[2]);return rows([]);}if(sql.includes('FROM public."Worker"'))return rows([worker]);if(sql.includes('FROM public."Project"')&&!sql.includes('JOIN'))return rows([{revision:'2026-10-14T12:00:00.123456'}]);
  if(['Incident','Task','OperationalProposal','AttendanceEntry'].some(table=>sql.includes('FROM public."'+table+'"')))return rows([]);
  throw Error('Unexpected synthetic field report bridge query: '+sql);
 };
 const resolveIdentity=async()=>{if(!worker.active||worker.metadata.participant.kyc.status!=='APPROVED')throw new WorkspaceError('WORKER_CHANNEL_IDENTITY_REQUIRED',403);return {kind:'CHANNEL_VERIFIED',member,project,worker,connection,event,proof:{value:message},channelBinding:binding};};
 const noExternal=async()=>{externalCalls++;throw Error('Own report reads cannot contact a provider');},bridge=createMetaFieldBridge({connect:async()=>({query,release:()=>assert.equal(open,0)}),resolveIdentity,environment,provider:{downloadMedia:noExternal,sendReply:noExternal}});
 function inbound(body){serial++;message=typeof body==='string'?{type:'text',text:{body},timestamp:String(Math.floor(Date.now()/1000))}:{...body,timestamp:String(Math.floor(Date.now()/1000))};event={id:'report-bridge-'+serial,status:'PENDING',projectId:project.id,createdAt:new Date(Date.now()+serial),leaseToken:'lease-'+serial,leaseExpiresAt:new Date(Date.now()+120000),payload:{payloadDigest:digest(message)}};return {eventId:event.id,projectId:project.id,channelId:connection.id,payloadDigest:event.payload.payloadDigest,leaseToken:event.leaseToken};}
 return {bridge,inbound,worker,audits,externalCalls:()=>externalCalls,ownQueries:()=>ownQueries,conversation:()=>readMetaFieldConversation({worker,member,project,channelBinding:binding},environment)};
}
test('actual bridge handles a lost own cursor/author with a generic reply, preserved nonce and no private disclosure or retryable throw',async()=>{
 for(const section of ['EVIDENCE','PROGRESS']){
  const records=[report(section,1)],f=bridgeFixture(records),list=await f.bridge.execute(f.inbound(section==='EVIDENCE'?'EVIDENCIAS':'AVANCES')),before=f.worker.metadata.fieldChannelConversation;
  if(section==='EVIDENCE')records[0].metadata.fieldOperations.recordedBy='old-actor';else records[0].action.submittedBy='old-actor';
  const value=await f.bridge.execute(f.inbound({type:'interactive',interactive:{type:'list_reply',list_reply:{id:list.reply.sections[0].rows[0].id}}}));assert.equal(value.kind,'FIELD_REPORT_READ');assert.equal(value.code,'FIELD_REPORT_READ_UNAVAILABLE');assert.equal(value.businessApplied,false);assert.equal(value.replySent,false);assert.deepEqual(f.worker.metadata.fieldChannelConversation,before);assert.doesNotMatch(value.reply.body,/old-actor|original-|evidence-1|progress-1/);assert.equal(f.externalCalls(),0);customerReplyMessage(value.reply);
 }
});
test('actual bridge caches an exact report reply and denies revoked reporting or canonical identity before decrypting it',async()=>{
 for(const revoke of [f=>{f.worker.metadata.participant.permissions.report=false;},f=>{f.worker.metadata.participant.kyc.status='REVOKED';},f=>{f.worker.active=false;}]){
  const f=bridgeFixture([report('PROGRESS',1)]),context=f.inbound('AVANCES'),first=await f.bridge.execute(context),count=f.ownQueries();assert.equal(first.kind,'FIELD_REPORT_READ');assert.deepEqual(await f.bridge.execute(context),first);assert.equal(f.ownQueries(),count);revoke(f);await assert.rejects(f.bridge.execute(context));assert.equal(f.ownQueries(),count);assert.equal(f.audits.size,1);assert.equal(f.externalCalls(),0);
 }
});
