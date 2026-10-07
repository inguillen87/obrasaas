import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCustomerTemplate,buildParticipantOnboardingMessage,customerTemplateBlueprint,customerRemoteTemplateMatches,publicCustomerTemplateWorkbench} from '../src/lib/meta-customer-templates.mjs';
import {customerTemplateMessage,createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';

const connection={id:'connection-a',whatsappBusinessId:'98765432101234'};
const input={organizationName:'Constructora de prueba',invitationId:'invite_'+'a'.repeat(32),code:'IDENTIDAD '+Buffer.alloc(32,29).toString('base64url')};
const invalid={code:'META_CUSTOMER_TEMPLATE_MESSAGE_INVALID'};
const legacy=[
 ['open_attendance_reminder','1f696c6e38e2b8855dfb6a26d66eec064d0f3802452c5cd59bc81fd674765d95','Obra de ejemplo','Tu jornada en {{1}} sigue abierta. Cuando termines, registrá la salida en ObraSaaS: https://obrasaas.com/cuenta'],
 ['participant_invitation','00a5b22f91f93519b1bbd00adfaa9b8d8a11797710900401e5623ac808437693','Constructora de ejemplo','Tenés una invitación para participar en una obra de {{1}}. Abrí tu cuenta de ObraSaaS para consultar la invitación y decidir si querés aceptarla: https://obrasaas.com/cuenta'],
 ['field_evidence_request','dcbc075bbff135eef644f0bfb663c0840d34254661f870d1b6175c570e5ec037','Obra de ejemplo','Tenés un pedido de información pendiente en {{1}}. Abrí tu cuenta de ObraSaaS para consultar el detalle y aportar la evidencia solicitada: https://obrasaas.com/cuenta'],
 ['progress_review_notification','558d9bffe33fb8af36591fe0b7a05425c574b7cc19f8ca19b36ef7405caaa8b0','Obra de ejemplo','Hay una propuesta de avance pendiente de revisión en {{1}}. Abrí tu cuenta de ObraSaaS para consultar la evidencia y registrar tu decisión: https://obrasaas.com/cuenta'],
];
for(const [key,hash,example,bodyText] of legacy)test('legacy template bytes and one-parameter serializer remain stable: '+key,()=>{
 const definition=buildCustomerTemplate(connection,key);
 assert.equal(definition.name,'obrasaas_'+key+'_13c0cc7537_'+hash.slice(0,10));
 assert.equal(definition.contentSha256,hash);
 assert.deepEqual(definition.components,[{type:'BODY',text:bodyText,example:{body_text:[[example]]}}]);
 const message={name:definition.name,language:'es_AR',bodyParameters:['Obra real']};
 assert.deepEqual(customerTemplateMessage(message),{type:'template',template:{name:definition.name,language:{code:'es_AR'},components:[{type:'body',parameters:[{type:'text',text:'Obra real'}]}]}});
 assert.throws(()=>customerTemplateMessage({...message,bodyParameters:['Obra real','otro']}),invalid);
});

test('new fixed UTILITY es_AR definition explains email acceptance, chat code and human review',()=>{
 const definition=buildCustomerTemplate(connection,'participant_onboarding_v1');
 assert.equal(definition.category,'UTILITY');assert.equal(definition.language,'es_AR');
 assert.match(definition.name,/^obrasaas_participant_onboarding_v1_[a-f0-9]{10}_[a-f0-9]{10}$/);
 assert.deepEqual(definition.bodyText.match(/\{\{\d+\}\}/g),['{{1}}','{{2}}','{{3}}']);
 assert.match(definition.bodyText,/invitación que recibiste por correo electrónico/);
 assert.match(definition.bodyText,/copiá y enviá \{\{3\}\} en este chat/);
 assert.match(definition.bodyText,/Un responsable revisará tu identidad/);
 assert.deepEqual(customerTemplateBlueprint('participant_onboarding_v1'),{title:definition.title,bodyText:definition.bodyText});
 const examples=definition.components[0].example.body_text;
 assert.equal(examples.length,1);assert.equal(examples[0].length,3);
 assert.match(examples[0][1],/^https:\/\/obrasaas\.com\/cuenta\?participar=invite_[a-f0-9]{32}$/);
 assert.match(examples[0][2],/^IDENTIDAD [A-Za-z0-9_-]{43}$/);
});

test('owned message builder emits only the canonical invitation URL and preserves typed parameter order',()=>{
 const definition=buildCustomerTemplate(connection,'participant_onboarding_v1'),message=buildParticipantOnboardingMessage(connection,input);
 assert.deepEqual(message,{name:definition.name,language:'es_AR',bodyParameters:[input.organizationName,'https://obrasaas.com/cuenta?participar='+input.invitationId,input.code]});
 assert.deepEqual(customerTemplateMessage(message),{type:'template',template:{name:definition.name,language:{code:'es_AR'},components:[{type:'body',parameters:message.bodyParameters.map(text=>({type:'text',text}))}]}});
 assert.equal(Object.hasOwn(message,'approved'),false);assert.equal(Object.hasOwn(message,'permissionsGranted'),false);
});

test('connection id and WABA each change the owned message identity without changing its text',()=>{
 const first=buildParticipantOnboardingMessage(connection,input);
 for(const changed of [{...connection,id:'connection-b'},{...connection,whatsappBusinessId:'98765432109876'}]){
  const next=buildParticipantOnboardingMessage(changed,input);assert.notEqual(next.name,first.name);assert.deepEqual(next.bodyParameters,first.bodyParameters);
 }
});

test('builder rejects invalid connection identifiers and arbitrary URL/message overrides',()=>{
 for(const candidate of [null,{}, {...connection,id:''},{...connection,id:'../connection'},{...connection,whatsappBusinessId:98765432101234},{...connection,whatsappBusinessId:'00001'},{...connection,whatsappBusinessId:'1'.repeat(33)}])assert.throws(()=>buildParticipantOnboardingMessage(candidate,input),invalid);
 for(const candidate of [null,[],{}, {...input,url:'https://example.com'},{...input,name:'arbitrary-template'},{...input,invitationId:undefined},{...input,invitationId:'invite_'+'A'.repeat(32)},{...input,invitationId:'invite_'+'a'.repeat(33)},{...input,invitationId:input.invitationId+'&ticket=arbitrary'}])assert.throws(()=>buildParticipantOnboardingMessage(connection,candidate),invalid);
});

test('company parameter enforces its fixed bound and rejects control characters and markup',()=>{
 const definition=buildCustomerTemplate(connection,'participant_onboarding_v1');
 assert.equal(buildParticipantOnboardingMessage(connection,{...input,organizationName:'x'.repeat(160)}).bodyParameters[0].length,160);
 for(const name of ['', ' ', 'x'.repeat(161),null,21,{},'<img src=x>','Empresa\nInstrucción','Empresa\r','Empresa\t','Empresa\u0000','Empresa\u007f']){
  assert.throws(()=>buildParticipantOnboardingMessage(connection,{...input,organizationName:name}),invalid);
  assert.throws(()=>customerTemplateMessage({name:definition.name,language:'es_AR',bodyParameters:[name,'https://obrasaas.com/cuenta?participar='+input.invitationId,input.code]}),invalid);
 }
});

test('IDENTIDAD is a complete typed challenge and never a free-form template parameter',()=>{
 const message=buildParticipantOnboardingMessage(connection,input);
 for(const code of [null,{},['IDENTIDAD'], 'identidad '+'a'.repeat(43),'IDENTIDAD '+'a'.repeat(42),'IDENTIDAD '+'a'.repeat(44),'IDENTIDAD '+'a'.repeat(42)+'+','IDENTIDAD '+'a'.repeat(42)+'/',input.code+'\n',input.code+' texto','IDENTIDAD  '+'a'.repeat(43)]){
  assert.throws(()=>buildParticipantOnboardingMessage(connection,{...input,code}),invalid);
  assert.throws(()=>customerTemplateMessage({...message,bodyParameters:[...message.bodyParameters.slice(0,2),code]}),invalid);
 }
});

test('serializer rejects noncanonical links, invitation tickets and encoded URL bypasses',()=>{
 const message=buildParticipantOnboardingMessage(connection,input),link=message.bodyParameters[1];
 for(const url of [null,{},['url'],link.replace('https:','http:'),link.replace('obrasaas.com','www.obrasaas.com'),link.replace('obrasaas.com','obrasaas.com.evil.example'),link.replace('/cuenta?','/cuenta/?'),link+'&token=secret',link+'#fragment',link+'\n',link.replace('invite_','invite%5F'),link.replace('https://','https://user:pass@'),'https://accounts.clerk.dev/accept?ticket=synthetic','https://obrasaas.com/cuenta?participar=invite_'+'A'.repeat(32)])assert.throws(()=>customerTemplateMessage({...message,bodyParameters:[message.bodyParameters[0],url,message.bodyParameters[2]]}),invalid);
});

test('only the exact versioned owned name accepts three parameters and the new name never accepts legacy arity',()=>{
 const message=buildParticipantOnboardingMessage(connection,input);
 for(const name of ['obrasaas_participant_invitation_13c0cc7537_00a5b22f91','obrasaas_participant_onboarding_v2_13c0cc7537_1234567890','obrasaas_participant_onboarding_v1_13c0cc753_1234567890','obrasaas_participant_onboarding_v1_13c0cc7537_12345678901','obrasaas_participant_onboarding_v1_13C0CC7537_1234567890',message.name+'_extra','unowned_template',null,{}])assert.throws(()=>customerTemplateMessage({...message,name}),invalid);
 for(const parameters of [[],message.bodyParameters.slice(0,1),message.bodyParameters.slice(0,2),[...message.bodyParameters,'extra']])assert.throws(()=>customerTemplateMessage({...message,bodyParameters:parameters}),invalid);
 for(const candidate of [{...message,language:'es-AR'},{...message,language:'en_US'},{...message,components:[]},{...message,bodyParameters:null}])assert.throws(()=>customerTemplateMessage(candidate),invalid);
});

test('example arrays are fresh data and cannot mutate the fixed catalogue',()=>{
 const definition=buildCustomerTemplate(connection,'participant_onboarding_v1');
 definition.components[0].example.body_text[0][0]='changed';
 assert.equal(buildCustomerTemplate(connection,'participant_onboarding_v1').components[0].example.body_text[0][0],'Constructora de ejemplo');
});

test('remote definition matching requires exact owned body and name while pending never establishes approval',()=>{
 const definition=buildCustomerTemplate(connection,'participant_onboarding_v1'),remote={id:'12345678',name:definition.name,language:'es_AR',category:'UTILITY',status:'PENDING',components:definition.components};
 assert.equal(customerRemoteTemplateMatches(remote,definition),true);
 assert.equal(remote.status==='APPROVED'&&remote.category==='UTILITY',false);
 const workbench=publicCustomerTemplateWorkbench({...connection,metadata:{customerTemplateDrafts:{participant_onboarding_v1:{definition,state:'SUBMITTED',providerId:remote.id,providerStatus:'PENDING',providerCategory:'UTILITY',updatedAt:'2026-10-07T00:00:00.000Z'}}}});
 assert.equal(workbench.drafts[0].canSend,false);assert.equal(workbench.sendingAccepted,false);
 for(const changed of [{...remote,name:buildCustomerTemplate({...connection,whatsappBusinessId:'98765432109876'},'participant_onboarding_v1').name},{...remote,language:'en_US'},{...remote,id:'bad-id'},{...remote,components:[...remote.components,{type:'BUTTONS'}]},{...remote,components:[{type:'BODY',text:definition.bodyText.replace('{{3}}','aprobado')}]},{...remote,category:'utility'},{...remote,status:'approved'}])assert.equal(customerRemoteTemplateMatches(changed,definition),false);
 assert.equal(customerRemoteTemplateMatches({...remote,status:'APPROVED',category:'MARKETING'},definition),true,'matching is structural; caller must separately require UTILITY approval');
});

test('scoped provider adapter serializes three BODY parameters and the existing exact correlation without external network',async()=>{
 const environment={NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-app-secret-only',META_CONFIG_ID:'12345678901',META_GRAPH_API_VERSION:'v25.0',META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,7).toString('base64'),META_CUSTOMER_VERIFY_TOKEN:'synthetic-verify-token-'.repeat(2),META_EMBEDDED_SIGNUP_VERSION:'4',OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1'};
 const requests=[],provider=createMetaCustomerProvider({environment,fetchImpl:async(url,options)=>{requests.push({url,options});return Response.json({messages:[{id:'wamid.syntheticonboarding123'}]});}});
 const params={token:'synthetic-customer-token-only',phoneNumberId:'120000001',to:'5491100001111',correlationId:'customer_outbound_'+'b'.repeat(64),message:buildParticipantOnboardingMessage(connection,input)};
 assert.deepEqual(await provider.sendTemplate(params),{messageId:'wamid.syntheticonboarding123'});
 assert.equal(requests.length,1);assert.equal(requests[0].url.hostname,'graph.facebook.com');assert.equal(requests[0].url.pathname,'/v25.0/120000001/messages');
 assert.equal(requests[0].options.headers.Authorization,'Bearer '+params.token);
 const body=JSON.parse(requests[0].options.body);
 assert.equal(body.biz_opaque_callback_data,params.correlationId);assert.equal(body.to,params.to);assert.equal(body.context,undefined);
 assert.deepEqual(body.template,customerTemplateMessage(params.message).template);
 await assert.rejects(provider.sendTemplate({...params,message:{...params.message,bodyParameters:[input.organizationName,'https://evil.example',input.code]}}),invalid);
 assert.equal(requests.length,1,'invalid message cannot reach the provider request');
});
