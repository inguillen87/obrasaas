import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {customerTemplateMessage,createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {validateCustomerTemplateSend,publicCustomerTemplateSend,customerOpenAttendance,customerProgressReviewSubject,customerProgressNoticeSubjectKey,customerTemplateSendId,CUSTOMER_MANUAL_TEMPLATE,CUSTOMER_PROGRESS_TEMPLATE} from '../src/lib/meta-customer-template-send.mjs';
import {createMetaCustomerTemplateSendHandlers} from '../src/lib/meta-customer-template-send-http.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {scopeStamp} from '../src/lib/workspace-policy.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
const scope='a'.repeat(64),body={projectId:'project-a',scope,operationId:randomUUID(),workerId:'worker-a',templateKey:CUSTOMER_MANUAL_TEMPLATE};
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Admin',organizationId:'org_A',organizationRole:'org:admin'};
test('manual send accepts only canonical identifiers, never recipient, credential, WABA, plaintext variables or unsupported assertions',()=>{
 assert.deepEqual(validateCustomerTemplateSend(body),body);
 assert.equal(validateCustomerTemplateSend({...body,operationId:body.operationId.toUpperCase()}).operationId,body.operationId);
 for(const extra of [{to:'5491100001111'},{token:'secret'},{wabaId:'120000001'},{parameters:{projectName:'invented'}},{confirmed:true}])assert.throws(()=>validateCustomerTemplateSend({...body,...extra}),{code:'META_CUSTOMER_TEMPLATE_SEND_INVALID'});
 for(const templateKey of ['participant_invitation','field_evidence_request',CUSTOMER_PROGRESS_TEMPLATE])assert.throws(()=>validateCustomerTemplateSend({...body,templateKey}),{code:'META_CUSTOMER_TEMPLATE_SEND_INVALID'});
});

const progressReference={proposalId:'proposal-a',revision:'2026-10-01T10:00:00.000001'};
test('progress notice requires an exact proposal reference without relaxing the five-key manual contract',()=>{
 const command={...body,templateKey:CUSTOMER_PROGRESS_TEMPLATE,actionReference:progressReference};assert.deepEqual(validateCustomerTemplateSend(command),command);
 for(const actionReference of [null,[],{},'proposal-a',{proposalId:'proposal-a'},{...progressReference,revision:'2026-10-01T10:00:00Z'},{...progressReference,revision:123},{...progressReference,confirmed:true},{...progressReference,proposalId:'other/<id>'}])assert.throws(()=>validateCustomerTemplateSend({...command,actionReference}),{code:'META_CUSTOMER_TEMPLATE_SEND_INVALID'});
 assert.throws(()=>validateCustomerTemplateSend({...body,actionReference:progressReference}),{code:'META_CUSTOMER_TEMPLATE_SEND_INVALID'});
 for(const extra of [{to:'5491100001111'},{token:'private'},{wabaId:'120000001'},{progress:80},{reason:'approve it'},{parameters:['invented']}])assert.throws(()=>validateCustomerTemplateSend({...command,...extra}),{code:'META_CUSTOMER_TEMPLATE_SEND_INVALID'});
});

test('progress notification subject isolates company, project, recipient, proposal and version independently of sender operation',()=>{
 const subject={organizationId:'company-a',projectId:'project-a',workerId:'worker-a',actionReference:progressReference},key=customerProgressNoticeSubjectKey(subject);assert.match(key,/^[a-f0-9]{64}$/);
 assert.equal(customerProgressNoticeSubjectKey({...subject,actorId:'another-admin',operationId:randomUUID()}),key);
 for(const changed of [{organizationId:'company-b'},{projectId:'project-b'},{workerId:'worker-b'},{actionReference:{...progressReference,proposalId:'proposal-b'}},{actionReference:{...progressReference,revision:'2026-10-01T10:00:00.000002'}}])assert.notEqual(customerProgressNoticeSubjectKey({...subject,...changed}),key);
});

function progressFixture(){
 const task={id:'task-a',title:'Foundation',progress:20,status:'IN_PROGRESS',metadata:{},revision:'2026-10-01T10:00:00.000000'},proposal={id:'proposal-a',summary:'Foundation · 30%',status:'PENDING',action:{fieldOperationsVersion:1,taskId:'task-a',workerId:'maker-worker',submittedBy:'maker',progress:30,quantity:null,baseline:null,unit:null,evidenceIds:['evidence-a']},precondition:{taskRevision:task.revision,progress:20},proposedByWorkerId:'maker-worker',expiresAt:new Date('2037-10-01T10:00:00Z'),expired:false,revision:progressReference.revision},evidence={id:'evidence-a',revision:'2026-10-01T10:00:00.000000',metadata:{fieldOperations:{version:1,kind:'EVIDENCE',taskId:'task-a',review:{decision:'APPROVE',actorId:'checker'},media:{sha256:'a'.repeat(64)}}}};
 const client={query:async(sql,args)=>{if(sql.includes('public."OperationalProposal"')){assert.deepEqual(args,['proposal-a','project-a']);assert.match(sql,/type='TASK_PROGRESS'.*"sourceProvider"='account-field'/);return {rows:proposal.missing?[]:[proposal]};}if(sql.includes('public."Task"')){assert.deepEqual(args,['task-a','project-a']);return {rows:task.missing?[]:[task]};}assert.ok(sql.includes('public."Incident"'));assert.deepEqual(args,['project-a',['evidence-a']]);return {rows:evidence.missing?[]:[evidence]};}};
 return {client,proposal,task,evidence};
}
test('progress subject requires a pending unexpired canonical proposal, current task and approved same-task evidence',async()=>{
 const current=progressFixture(),subject=await customerProgressReviewSubject(current.client,'project-a',progressReference,{actorId:'checker',role:'DIRECTOR'});assert.equal(subject.kind,'PROGRESS_REVIEW');assert.equal(subject.submittedBy,'maker');assert.equal(subject.proposalId,progressReference.proposalId);assert.match(subject.proposalDigest,/^[a-f0-9]{64}$/);assert.match(subject.taskDigest,/^[a-f0-9]{64}$/);assert.equal(subject.evidenceClaims.length,1);
 for(const [change,code] of [
  [f=>{f.proposal.missing=true;},'FIELD_PROPOSAL_UNAVAILABLE'],
  [f=>{f.proposal.action.fieldOperationsVersion=2;},'FIELD_PROPOSAL_UNAVAILABLE'],
  [f=>{f.proposal.proposedByWorkerId='foreign-worker';},'FIELD_PROPOSAL_UNAVAILABLE'],
  [f=>{f.proposal.revision='2026-10-01T10:00:00.000002';},'FIELD_REVISION_CHANGED'],
  [f=>{f.proposal.expired=true;},'FIELD_PROPOSAL_EXPIRED'],
  [f=>{f.proposal.expiresAt=null;},'FIELD_PROPOSAL_EXPIRED'],
  [f=>{f.proposal.status='APPLIED';},'FIELD_ALREADY_REVIEWED'],
  [f=>{f.task.missing=true;},'WORKSPACE_TASK_UNAVAILABLE'],
  [f=>{f.task.revision='2026-10-01T11:00:00.000000';},'FIELD_REVISION_CHANGED'],
  [f=>{f.task.progress=40;},'FIELD_PROGRESS_REGRESSION'],
  [f=>{f.proposal.action.evidenceIds=[];},'FIELD_PROPOSAL_UNAVAILABLE'],
  [f=>{f.proposal.action.evidenceIds=['evidence-a','evidence-a'];},'FIELD_PROPOSAL_UNAVAILABLE'],
  [f=>{f.evidence.missing=true;},'FIELD_EVIDENCE_UNAVAILABLE'],
  [f=>{f.evidence.metadata.fieldOperations.kind='MATERIAL_REQUEST';},'FIELD_EVIDENCE_UNAVAILABLE'],
  [f=>{f.evidence.metadata.fieldOperations.taskId='foreign-task';},'FIELD_EVIDENCE_NOT_APPROVED'],
  [f=>{f.evidence.metadata.fieldOperations.review.decision='REJECT';},'FIELD_EVIDENCE_NOT_APPROVED'],
 ]){const fixture=progressFixture();change(fixture);await assert.rejects(customerProgressReviewSubject(fixture.client,'project-a',progressReference,{actorId:'checker',role:'ADMIN'}),{code});}
 await assert.rejects(customerProgressReviewSubject(current.client,'project-a',progressReference,{actorId:'maker',role:'ADMIN'}),{code:'FIELD_MAKER_CHECKER_REQUIRED'});
 for(const role of ['SITE_MANAGER','FINANCE','AUDITOR',undefined])await assert.rejects(customerProgressReviewSubject(current.client,'project-a',progressReference,{actorId:'checker',role}),{code:'FIELD_PROGRESS_PERMISSION_REQUIRED'});
 current.evidence.metadata.fieldOperations.media.sha256='b'.repeat(64);assert.notEqual((await customerProgressReviewSubject(current.client,'project-a',progressReference)).evidenceClaims[0].contentDigest,subject.evidenceClaims[0].contentDigest);
});

test('progress subject shares the existing exact quantity continuity rules',async()=>{
 const fixture=progressFixture();fixture.task.metadata.fieldOperations={quantity:{executed:'2.5900',baseline:'10.0000',unit:'M2'}};Object.assign(fixture.proposal.action,{quantity:'2.5000',baseline:'10.0000',unit:'M2',progress:25});fixture.task.progress=25;
 await assert.rejects(customerProgressReviewSubject(fixture.client,'project-a',progressReference,{actorId:'checker',role:'ADMIN'}),{code:'FIELD_PROGRESS_REGRESSION'});
 fixture.proposal.action.quantity='2.6000';fixture.proposal.action.baseline='20.0000';await assert.rejects(customerProgressReviewSubject(fixture.client,'project-a',progressReference,{actorId:'checker',role:'ADMIN'}),{code:'FIELD_BASELINE_CHANGED'});
});
test('template adapter emits exactly the adopted Meta BODY text shape and rejects arbitrary components',()=>{
 const message={name:'obrasaas_open_attendance_reminder_test',language:'es_AR',bodyParameters:['Obra real']};
 assert.deepEqual(customerTemplateMessage(message),{type:'template',template:{name:message.name,language:{code:'es_AR'},components:[{type:'body',parameters:[{type:'text',text:'Obra real'}]}]}});
 for(const invalid of [{...message,language:'en_US'},{...message,bodyParameters:[]},{...message,bodyParameters:['one','two']},{...message,bodyParameters:['<script>']},{...message,components:[]},{...message,name:'unowned_template'}])assert.throws(()=>customerTemplateMessage(invalid),{code:'META_CUSTOMER_TEMPLATE_MESSAGE_INVALID'});
});
test('manual outbound reference isolates the same operation across actors and projects',()=>{
 const id=customerTemplateSendId('actor-a','project-a',body.operationId);assert.match(id,/^customer_outbound_[a-f0-9]{64}$/);assert.equal(customerTemplateSendId('actor-a','project-a',body.operationId),id);assert.notEqual(customerTemplateSendId('actor-b','project-a',body.operationId),id);assert.notEqual(customerTemplateSendId('actor-a','project-b',body.operationId),id);
});
test('provider uses only scoped credential/phone, no reply context or global demo and correlates the exact outbound reservation',async()=>{
 const environment={NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-app-secret-only',META_CONFIG_ID:'12345678901',META_GRAPH_API_VERSION:'v25.0',META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,7).toString('base64'),META_CUSTOMER_VERIFY_TOKEN:'synthetic-verify-token-'.repeat(2),META_EMBEDDED_SIGNUP_VERSION:'4',OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1'};
 const requests=[],provider=createMetaCustomerProvider({environment,fetchImpl:async(url,options)=>{requests.push({url,options});return Response.json({messages:[{id:'wamid.syntheticmessage123'}]});}});
 const params={token:'synthetic-customer-token-only',phoneNumberId:'120000001',to:'5491100001111',correlationId:'customer_outbound_'+scope,message:{name:'obrasaas_open_attendance_reminder_test',language:'es_AR',bodyParameters:['Obra privada']}};
 assert.deepEqual(await provider.sendTemplate(params),{messageId:'wamid.syntheticmessage123'});
 assert.equal(requests.length,1);assert.equal(requests[0].url.pathname,'/v25.0/120000001/messages');assert.equal(requests[0].options.headers.Authorization,'Bearer '+params.token);assert.ok(requests[0].url.searchParams.get('appsecret_proof'));
 const sent=JSON.parse(requests[0].options.body);assert.equal(sent.biz_opaque_callback_data,params.correlationId);assert.equal(sent.to,params.to);assert.equal(sent.type,'template');assert.equal(sent.context,undefined);assert.equal(sent.template.components[0].parameters[0].text,'Obra privada');
 await assert.rejects(provider.sendTemplate({...params,to:'+5491100001111'}),{code:'META_CUSTOMER_TEMPLATE_MESSAGE_INVALID'});assert.equal(requests.length,1);
});
test('an open canonical attendance fact is required and sealed by exact entry revision',async()=>{
 const details={version:1,eventType:'CHECK_IN',phase:'WORKING',sequence:1,shiftId:'shift-a',recordedBy:'person-a'},client={query:async()=>({rows:[{id:'attendance-a',metadata:{fieldOperations:details}}]})};
 const fact=await customerOpenAttendance(client,'project-a','worker-a');assert.equal(fact.id,'attendance-a');assert.match(fact.revision,/^[a-f0-9]{64}$/);
 details.eventType='CHECK_OUT';await assert.rejects(customerOpenAttendance(client,'project-a','worker-a'),{code:'META_CUSTOMER_ATTENDANCE_REMINDER_NOT_APPLICABLE'});
 details.eventType='BREAK_START';details.phase='ON_BREAK';assert.notEqual((await customerOpenAttendance(client,'project-a','worker-a')).revision,fact.revision);
 await assert.rejects(customerOpenAttendance({query:async()=>({rows:[]})},'project-a','worker-a'),{code:'META_CUSTOMER_ATTENDANCE_REMINDER_NOT_APPLICABLE'});
});
test('reservation, provider acceptance and signed delivery remain separate without exposing private payload',()=>{
 const row={id:'outbound',payload:{operationId:body.operationId,workerId:body.workerId,templateKey:body.templateKey,encryptedPayload:'v2.private',to:'private'},outcome:{state:'SEND_STARTED',actorId:'actor'}};
 for(const state of ['SEND_STARTED','SEND_UNKNOWN']){row.outcome.state=state;const result=publicCustomerTemplateSend(row,body);assert.equal(result.saved,false);assert.equal(result.definitive,false);assert.equal(result.providerAccepted,false);assert.equal(result.deliveryConfirmed,false);assert.ok(!JSON.stringify(result).includes('private'));}
 row.outcome.state='SENT';let result=publicCustomerTemplateSend(row,body);assert.equal(result.state,'ACCEPTED');assert.equal(result.providerAccepted,true);assert.equal(result.deliveryConfirmed,false);
 row.outcome={state:'STATUS_OBSERVED',providerStatus:'delivered'};assert.equal(publicCustomerTemplateSend(row,body).deliveryConfirmed,true);
 row.outcome={state:'STATUS_OBSERVED',providerStatus:'failed'};result=publicCustomerTemplateSend(row,body);assert.equal(result.deliveryConfirmed,false);assert.equal(result.providerAccepted,false);assert.equal(result.definitive,true);
 assert.equal(publicCustomerTemplateSend(null,body).definitive,false);
});

test('progress public receipt preserves only the exact proposal/version and caller operation for recovery',()=>{
 const row={id:'outbound-progress',payload:{operationId:body.operationId,workerId:body.workerId,templateKey:CUSTOMER_PROGRESS_TEMPLATE,actionReference:progressReference,subjectKey:'a'.repeat(64),encryptedPayload:'v2.private-subject'},outcome:{state:'SEND_UNKNOWN'}};
 const result=publicCustomerTemplateSend(row,body);assert.deepEqual(result.receipt,{id:row.id,operationId:body.operationId,workerId:body.workerId,templateKey:CUSTOMER_PROGRESS_TEMPLATE,actionReference:progressReference});assert.equal(result.definitive,false);assert.equal(result.deliveryConfirmed,false);assert.ok(!JSON.stringify(result).includes('private-subject'));assert.equal(result.receipt.subjectKey,undefined);
});

test('HTTP snapshot permits only adopted template discriminators and keeps recovery references server-owned',async()=>{
 const seen=[],handlers=createMetaCustomerTemplateSendHandlers({verify:async()=>session,service:{read:async(_s,context)=>{seen.push(context);return {state:'NOT_OBSERVED'};}}}),path='https://obrasaas.com/api/identity/template-send?projectId=project-a&scope='+scope;
 assert.equal((await handlers.GET(new Request(path+'&templateKey='+CUSTOMER_PROGRESS_TEMPLATE))).status,200);assert.deepEqual(seen[0],{projectId:'project-a',scope,templateKey:CUSTOMER_PROGRESS_TEMPLATE});
 assert.equal((await handlers.GET(new Request(path+'&templateKey='+CUSTOMER_MANUAL_TEMPLATE+'&operationId='+body.operationId))).status,200);assert.deepEqual(seen[1],{projectId:'project-a',scope,templateKey:CUSTOMER_MANUAL_TEMPLATE,operationId:body.operationId});
 for(const query of ['&templateKey=','&templateKey=participant_invitation','&templateKey=field_evidence_request','&templateKey='+CUSTOMER_PROGRESS_TEMPLATE+'&templateKey='+CUSTOMER_MANUAL_TEMPLATE,'&proposalId=proposal-a','&actionReference=private'])assert.equal((await handlers.GET(new Request(path+query))).status,400);
 assert.equal(seen.length,2);
});
test('template HTTP boundary verifies session and rejects foreign origin and duplicate/query/body overrides before service',async()=>{
 const seen=[],handlers=createMetaCustomerTemplateSendHandlers({verify:async()=>session,service:{read:async(s,c)=>{seen.push([s,c]);return {state:'NOT_OBSERVED'};},send:async(s,b)=>{seen.push([s,b]);return {state:'ACCEPTED'};}}});
 const path='https://obrasaas.com/api/identity/template-send?projectId=project-a&scope='+scope;
 const read=await handlers.GET(new Request(path+'&operationId='+body.operationId));assert.equal(read.status,200);assert.match(read.headers.get('cache-control'),/no-store/);assert.equal(seen[0][0],session);
 for(const query of ['&operationId=x','&projectId=other','&to=5491111111111'])assert.equal((await handlers.GET(new Request(path+query))).status,400);
 assert.equal((await handlers.POST(new Request(path,{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:JSON.stringify(body)}))).status,403);
 assert.equal((await handlers.POST(new Request(path.split('?')[0],{method:'POST',headers:{origin:'https://foreign.invalid','content-type':'application/json'},body:JSON.stringify(body)}))).status,403);assert.equal(seen.length,1);
 assert.equal((await handlers.POST(new Request(path.split('?')[0],{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json','content-encoding':'gzip'},body:JSON.stringify(body)}))).status,403);assert.equal(seen.length,1);
 const unavailable=createMetaCustomerTemplateSendHandlers({verify:async()=>({authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'}),service:{read:()=>assert.fail('No service on provider outage')}});assert.equal((await unavailable.GET(new Request(path))).status,503);
});
test('actual route imports its production dependencies and rejects anonymous access before database or provider work',async()=>{
 const route=await import('../src/app/api/identity/template-send/route.js');
 assert.equal(typeof route.GET,'function');assert.equal(typeof route.POST,'function');
 const response=await route.GET(new Request('https://obrasaas.com/api/identity/template-send?projectId=project-a&scope='+scope));
 assert.ok([401,503].includes(response.status));assert.match(response.headers.get('cache-control'),/private.*no-store/);
 const result=await response.json();assert.equal(result.saved,false);assert.ok(['SESSION_REQUIRED','IDENTITY_PROVIDER_UNAVAILABLE'].includes(result.code));
});
test('internal recipient prelock runs only after canonical actor authorization and cannot replace actor, scope or project',async()=>{
 const member={actorId:'admin-a',membershipId:'member-a',organizationId:'company-a',organizationName:'Company A',role:'ADMIN'},queries=[];
 const client={release(){},query:async(sql)=>{queries.push(sql);if(sql.includes('FROM public."PlatformUser"'))return {rows:[member]};if(sql.includes('SELECT id,name,status'))return {rows:[{id:'project-a',name:'Canonical',status:'ACTIVE'}]};if(sql.includes('SELECT p.id,p.name'))return {rows:[{id:'project-a',name:'Canonical',metadata:{}}]};return {rows:[]};}};
 const store=createWorkspaceStore({connect:async()=>client}),canonicalScope=scopeStamp(session,member);let hookCalls=0;
 await store.integrationProject(session,{projectId:'project-a',scope:canonicalScope},true,(_c,actor,actualScope,project)=>{assert.equal(actor.actorId,'admin-a');assert.equal(actualScope,canonicalScope);assert.equal(project.id,'project-a');},async(_c,actor)=>{hookCalls++;assert.ok(!queries.some(sql=>sql.includes('SELECT id,name,status')));assert.throws(()=>{actor.actorId='spoofed';},TypeError);return {actorId:'spoofed',scope:'spoofed',projectId:'other'};});
 assert.equal(hookCalls,1);
 await assert.rejects(store.integrationProject(session,{projectId:'project-a',scope},true,()=>assert.fail('stale scope cannot call'),()=>assert.fail('stale scope cannot prelock')),{code:'WORKSPACE_CONTEXT_CHANGED'});
 member.role='AUDITOR';await assert.rejects(store.integrationProject(session,{projectId:'project-a',scope:scopeStamp(session,member)},true,()=>assert.fail(),()=>assert.fail()),{code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'});
});
