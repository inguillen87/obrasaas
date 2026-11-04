import test from 'node:test';
import assert from 'node:assert/strict';
import {planMetaFieldConversation,metaFieldPlanDisclosure} from '../src/lib/meta-field-conversation.mjs';
import {identityAccountReturnPath,identitySignInPath,identitySignUpPath,identityWorkspaceProjectHint} from '../src/lib/identity-return-path.mjs';
import {workspaceLocationView,workspaceViewAllowed} from '../src/app/(identity)/cuenta/workspace-view-routing.mjs';
import {decodeWorkerChannelProof,resolveWorkerChannelIdentity} from '../src/lib/worker-channel-identity.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';

const now=new Date('2026-10-28T12:00:00Z');
const facts={projectName:'Synthetic worksite',projectId:'project-a',workerId:'worker-a',permissions:{attendance:true,report:true},sectors:[{id:'sector-a',name:'Synthetic sector'}],tasks:[],evidence:[],proposals:[],latest:null};
let sequence=0;
function run(message,state=null,current=facts){
 const result=planMetaFieldConversation({message,state,eventId:'guidance-'+(++sequence),facts:current,now});
 if(result.state)result.state={...result.state,version:1,expiresAt:new Date(now.getTime()+900000).toISOString()};
 return result;
}
const say=(body,current=facts,state=null)=>run({type:'text',text:{body}},state,current);
const pick=plan=>run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[0].id}}},plan.state);
function links(body){return body.match(/https:\/\/[^\s]+/g)||[];}
function expected(projectId){return 'https://obrasaas.com'+identityAccountReturnPath(new URLSearchParams({seccion:'actividad',obra:projectId}))+'#field-title';}
function noEffect(value){assert.equal(value.command,undefined);assert.equal(value.media,undefined);assert.equal(value.planImport,undefined);}

test('menu points to the current worksite activity screen without an attendance command or extra list action',()=>{
 const before=structuredClone(facts),result=say('MENU');
 assert.deepEqual(links(result.reply.body),[expected('project-a')]);
 assert.match(result.reply.body,/GPS y QR/);assert.match(result.reply.body,/Abrir operaciones.*Entrada o Salida/);
 assert.match(result.reply.body,/el enlace no registra fichajes/);
 assert.deepEqual(workspaceLocationView(links(result.reply.body)[0]),{section:'actividad',target:'field-title'});
 assert.equal(result.state.step,'MENU');assert.ok(result.state.choices.every(c=>c.value!=='WEB_ATTENDANCE'));
 assert.deepEqual(result.state.choices.filter(c=>c.value.startsWith('ATTEND_')).map(c=>c.value),['ATTEND_IN']);
 assert.equal(metaFieldPlanDisclosure(result),'MIXED');noEffect(result);assert.deepEqual(facts,before);
});

test('the worksite comes only from bridge facts, never a sender-selected audience, role or URL',()=>{
 const result=run({type:'text',text:{body:'MENU'},projectId:'foreign-worksite',role:'ADMIN',url:'https://foreign.example',token:'synthetic-token'},null,{...facts,projectId:'project-b'});
 assert.deepEqual(links(result.reply.body),[expected('project-b')]);
 assert.doesNotMatch(result.reply.body,/foreign-worksite|foreign\.example|synthetic-token|worker-a/);noEffect(result);
});

test('current attendance permission, not the office role, determines whether the navigation hint is offered',()=>{
 for(const role of ['ADMIN','DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR']){
  const allowed=say('MENU',{...facts,planImportRole:role,permissions:{attendance:true,report:false}});assert.deepEqual(links(allowed.reply.body),[expected('project-a')]);noEffect(allowed);
  const denied=say('MENU',{...facts,planImportRole:role,permissions:{attendance:false,report:true}});assert.deepEqual(links(denied.reply.body),[]);assert.ok(denied.state.choices.every(c=>!c.value.startsWith('ATTEND_')));noEffect(denied);
 }
 for(const attendance of [false,undefined,'true',1])assert.deepEqual(links(say('ESTADO',{...facts,permissions:{attendance,report:true}}).reply.body),[]);
});

test('limited pilot, missing and malformed worksite facts cannot expose an alternate web route',()=>{
 for(const changed of [{attendanceOnly:true},...['',undefined,'//foreign.example','project-a&scope=admin','project-a#other','project-a\n','a'.repeat(129)].map(projectId=>({projectId}))]){
  for(const body of ['MENU','ESTADO']){const result=say(body,{...facts,...changed});assert.deepEqual(links(result.reply.body),[]);noEffect(result);}
 }
 const denied=say('ENTRADA',{...facts,permissions:{attendance:false,report:true}});assert.match(denied.reply.body,/permisos/);assert.deepEqual(links(denied.reply.body),[]);noEffect(denied);
});

test('status offers the same complete link within its existing body budget without taking another attendance action',()=>{
 const current={...facts,permissions:{attendance:true,report:false},latest:{id:'entry-a',eventType:'CHECK_IN',phase:'WORKING'}};
 const result=say('ESTADO',current);assert.deepEqual(links(result.reply.body),[expected('project-a')]);assert.match(result.reply.body,/Jornada: en curso/);assert.equal(metaFieldPlanDisclosure(result),'ATTENDANCE');assert.ok(result.reply.body.length<=1024);noEffect(result);
 const tight=say('MENU',{...facts,replyBodyLimit:150});assert.deepEqual(links(tight.reply.body),[]);assert.doesNotMatch(tight.reply.body,/https:|field-title/);noEffect(tight);
 const long=say('ESTADO',{...facts,replyBodyLimit:1024,ownConsumptions:{records:Array.from({length:15},()=>({materialName:'Synthetic material '.repeat(10),quantity:'1.000',unit:'bolsa',state:'PENDING'}))}});assert.ok(long.reply.body.length<=1024);assert.deepEqual(links(long.reply.body),[]);noEffect(long);
});

test('reading the menu hint does not accept the native location notice and a live attendance draft remains intact',()=>{
 const sector=say('ENTRADA'),notice=pick(sector),snapshot=structuredClone(notice.state);
 assert.equal(notice.state.step,'LOCATION_NOTICE');assert.equal(notice.state.noticeVersion,undefined);noEffect(notice);
 const greeting=say('HOLA',facts,notice.state);assert.deepEqual(greeting.state,snapshot);assert.deepEqual(notice.state,snapshot);assert.equal(greeting.preserveConversation,true);noEffect(greeting);
});

test('native WhatsApp attendance still requires explicit consent and confirmation, with unknown accuracy and no QR',()=>{
 const notice=pick(say('ENTRADA')),location=pick(notice);
 assert.equal(location.state.step,'LOCATION');assert.equal(location.state.noticeVersion,'field-location-v1');noEffect(location);
 const confirmation=run({type:'location',timestamp:String(now.getTime()/1000),location:{latitude:0,longitude:0}},location.state);noEffect(confirmation);
 const saved=pick(confirmation);assert.equal(saved.command.action,'ATTENDANCE');assert.equal(saved.command.payload.location.accuracy,null);assert.equal(saved.command.payload.qrToken,null);assert.equal(saved.command.payload.expectedEventId,null);
});

test('activity and worksite survive ordinary login, signup and account return without external or sensitive query data',()=>{
 const start=new URL(expected('project-a'));
 start.searchParams.set('redirect_url','https://foreign.example');start.searchParams.set('scope','synthetic-admin');start.searchParams.set('token','synthetic-token');
 const login=new URL(identitySignInPath(start.searchParams),start.origin),signup=new URL(identitySignUpPath(login.searchParams),start.origin),after=new URL(identityAccountReturnPath(signup.searchParams),start.origin);
 for(const url of [login,signup,after]){assert.equal(url.origin,'https://obrasaas.com');assert.deepEqual([...url.searchParams.entries()],[['seccion','actividad'],['obra','project-a']]);}
 assert.deepEqual(workspaceLocationView(after.href),{section:'actividad',target:'field-title'});
 assert.equal(identityWorkspaceProjectHint(after.searchParams),'project-a');
});

test('already-authenticated routing preserves the exact worksite hint but never supplies private access',()=>{
 const url=new URL(expected('project-b'));assert.equal(identityWorkspaceProjectHint(url.searchParams),'project-b');
 assert.deepEqual(workspaceLocationView(url.href),{section:'actividad',target:'field-title'});
 for(const role of ['ADMIN','DIRECTOR','SITE_MANAGER','AUDITOR'])assert.equal(workspaceViewAllowed('actividad',{role,projectAvailable:false}),false);
 assert.equal(workspaceViewAllowed('actividad',{role:'AUDITOR',projectAvailable:false,privatePresentationAvailable:true}),false);
});

test('activity requires one valid worksite and one closed section value; malformed destinations do not survive authentication',()=>{
 const routes=[identityAccountReturnPath,identitySignInPath,identitySignUpPath],paths=['/cuenta','/sign-in','/sign-up'];
 for(const query of [{seccion:'actividad'}, {seccion:'actividad',obra:''},{seccion:['actividad','actividad'],obra:'project-a'},{seccion:'actividad',obra:['project-a','project-b']},{seccion:'actividad',obra:'https://foreign.example'},{seccion:'actividad',obra:'project-a&role=ADMIN'},{seccion:'actividad\n',obra:'project-a'},{seccion:'https://foreign.example',obra:'project-a'},new URLSearchParams('seccion=actividad&obra=project-a&obra=project-a')])routes.forEach((route,i)=>assert.equal(route(query),paths[i]));
});

test('participant/office invitations and plan navigation retain priority, including malformed pending intent',()=>{
 const routes=[identityAccountReturnPath,identitySignInPath,identitySignUpPath],paths=['/cuenta','/sign-in','/sign-up'],invitation='invite_'+'a'.repeat(32),office='office_invite_'+'b'.repeat(32),plan='plan_draft_'+'c'.repeat(64);
 for(const [extra,tail] of [[{participar:invitation},'?participar='+invitation],[{oficina:office},'?oficina='+office],[{plan},'?obra=project-a&plan='+plan]])routes.forEach((route,i)=>assert.equal(route({seccion:'actividad',obra:'project-a',...extra}),paths[i]+tail));
 for(const extra of [{participar:''},{oficina:'bad'},{plan:'bad'},{participar:[invitation,invitation]},{plan:[plan,plan]}])routes.forEach((route,i)=>assert.equal(route({seccion:'actividad',obra:'project-a',...extra}),paths[i]));
 assert.equal(identityAccountReturnPath({seccion:'identidad'}),'/cuenta?seccion=identidad');
});

function signedSource(appId=OBRASAAS_META_CHANNEL.appId){
 const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,9).toString('base64')};
 const connection={id:'connection-synthetic',organizationId:'company-synthetic',projectId:'project-a',phoneNumberId:'12025550001',whatsappBusinessId:'12025550002',enabled:false,connectionStatus:'PENDING',encryptedAccessToken:'v2.synthetic',metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:'company-synthetic',customerVerification:{registered:true,expiresAt:null}}};
 const value={id:'wamid.syntheticGuidance',type:'text',text:{body:'MENU'},from:'12025550123',timestamp:String(now.getTime()/1000)},payload={wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,field:'messages',type:'message',value},externalId=digest([payload.wabaId,payload.phoneNumberId,'message',value.id]),id='customer_webhook_'+externalId,payloadDigest=metaCustomerContentDigest(payload),aad={organizationId:connection.organizationId,projectId:connection.projectId,resourceId:id};
 const row={id,projectId:connection.projectId,provider:'meta-customer-v1',externalId,eventType:'message',payload:{version:1,organizationId:connection.organizationId,channelId:connection.id,payloadDigest,encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',appId,payloadDigest,channelId:connection.id,organizationId:connection.organizationId}),{...aad,purpose:'webhook-proof'},environment)}};
 return {row,connection,environment};
}

test('knowing the navigation URL does not turn a foreign app/company/asset proof into signed channel authority',()=>{
 const f=signedSource();assert.equal(decodeWorkerChannelProof(f.row,f.connection,f.environment).senderE164,'+12025550123');
 const foreign=signedSource('foreign-app');assert.throws(()=>decodeWorkerChannelProof(foreign.row,foreign.connection,foreign.environment),{code:'WORKER_CHANNEL_SIGNED_PROOF_REQUIRED'});
 for(const change of [{organizationId:'foreign-company'},{projectId:'foreign-worksite'},{phoneNumberId:'12025550999'}])assert.throws(()=>decodeWorkerChannelProof(f.row,{...f.connection,...change},f.environment));
});

test('a valid signed source without a personal verified binding stops in the real resolver before planning or any write',async()=>{
 const f=signedSource(),before=structuredClone(f),queries=[];
 const client={query:async(sql,args=[])=>{queries.push({sql,args});
  if(sql.includes('FROM public."WebhookEvent"'))return {rows:[f.row]};
  if(sql.includes('to_regclass'))return {rows:[{present:false,count:0}]};
  if(sql.includes('FROM public."WhatsAppConnection"'))return {rows:[f.connection]};
  if(sql.includes('FROM public."Worker" w JOIN'))return {rows:[]};
  throw Error('Unexpected unbound resolver query: '+sql);
 }};
 await assert.rejects(resolveWorkerChannelIdentity(client,{eventId:f.row.id,environment:f.environment}),{code:'WORKER_CHANNEL_BINDING_REQUIRED'});
 assert.ok(queries.some(q=>q.sql.includes("binding'->>'status'='VERIFIED'")));
 assert.ok(queries.every(q=>q.sql.startsWith('SELECT ')));
 assert.deepEqual(f,before);
});
