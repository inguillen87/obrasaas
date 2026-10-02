import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {customerTemplateMessage,createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {validateCustomerTemplateSend,publicCustomerTemplateSend,customerOpenAttendance,customerTemplateSendId,CUSTOMER_MANUAL_TEMPLATE} from '../src/lib/meta-customer-template-send.mjs';
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
 for(const templateKey of ['participant_invitation','field_evidence_request','progress_review_notification'])assert.throws(()=>validateCustomerTemplateSend({...body,templateKey}),{code:'META_CUSTOMER_TEMPLATE_SEND_INVALID'});
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
 const environment={NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-app-secret-only',META_CONFIG_ID:'12345678901',META_GRAPH_API_VERSION:'v25.0',META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,7).toString('base64'),META_CUSTOMER_VERIFY_TOKEN:'synthetic-verify-token-'.repeat(2),OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1'};
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
