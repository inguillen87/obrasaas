import test from 'node:test';
import assert from 'node:assert/strict';
import {officeChatFixture} from './fixtures/office-chat-memory.mjs';
import {createOfficeChatHandlers} from '../src/lib/office-chat-http.mjs';
import {createOfficeChatBridge} from '../src/lib/office-chat-store.mjs';
import {OFFICE_CHAT_TTL_MS,officeChatCodeHash,officeChatReply} from '../src/lib/office-chat-policy.mjs';
import {identityAccountReturnPath,identitySignInPath} from '../src/lib/identity-return-path.mjs';
import {createMetaCustomerProductionProcessor} from '../src/lib/meta-customer-processing.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {NextRequest,NextResponse} from 'next/server.js';
import {authorizeLegacyService,legacyBoundaryKind,privateLegacyHeaders,unauthorizedLegacyResponse} from '../src/lib/legacy-access-boundary.js';
import {identityRoute,IDENTITY_ORIGIN} from '../src/lib/production-identity-config.mjs';
import {companySubscriptionRoute} from '../src/lib/company-subscription-routing.mjs';
import {createMetaCustomerOutbound,customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';

async function prepared(f){const input=f.command(),result=await f.store.command(f.session,input);return {input,result,context:f.receive(result.message)};}
async function bound(f){const p=await prepared(f),result=await f.bridge.execute(p.context);return {...p,result};}
for(const role of ['ADMIN','DIRECTOR'])test('signed '+role+' prepares hash-only 256-bit code and binds account navigation without Worker/KYC',async()=>{
 const f=officeChatFixture({role}),p=await prepared(f),code=p.result.message.slice(7);
 assert.equal(Buffer.from(code,'base64url').length,32);assert.equal(f.slot().pending.hash,officeChatCodeHash(code));assert.equal(Date.parse(f.slot().pending.expiresAt)-f.controls.clock,OFFICE_CHAT_TTL_MS);assert(!JSON.stringify([...f.audits.values()]).includes(code));
 const reply=await f.bridge.execute(p.context);assert.equal(reply.identityStatus,'OFFICE_NAVIGATION_ONLY');assert.equal(reply.businessApplied,false);assert.equal(f.slot().pending,null);assert.equal(f.slot().binding.sourceEventId,p.context.eventId);
 assert.deepEqual(reply.reply.sections[0].rows.map(r=>r.title),['Mis obras','Equipo','Mi WhatsApp','Mi cuenta','Volver a obra']);assert.equal(f.controls.posts,0);assert(!f.queries.some(q=>/INSERT INTO public."(Worker|AttendanceEntry|TenantMembership|ProjectMembership)"/.test(q.sql)));
});
test('response loss never recovers plaintext or regenerates the same operation; explicit replacement invalidates old code',async()=>{
 const f=officeChatFixture(),p=await prepared(f),generation=f.slot().generation,again=await f.store.command(f.session,p.input);
 assert.equal(again.replayed,true);assert.equal(again.codeAvailable,false);assert(!Object.hasOwn(again,'message'));assert.equal(f.slot().generation,generation);assert.equal((await f.store.read(f.session,f.context())).codeAvailable,false);
 const replacement=await f.store.command(f.session,f.command());assert.equal(f.slot().generation,generation+1);assert.notEqual(replacement.message,p.result.message);await assert.rejects(f.bridge.execute(p.context),{code:'OFFICE_CHAT_CODE_REJECTED'});assert.equal(f.slot().binding,null);
});
test('explicit replacement from another assigned worksite moves the mutable slot while preserving historical receipts',async()=>{
 const f=officeChatFixture();f.controls.projects.push('project_b');const a=await prepared(f),bInput=f.command('PREPARE',{projectId:'project_b'}),b=await f.store.command(f.session,bInput);
 const slot=[...f.audits.values()].find(row=>row.action==='office.chat.continuity');assert.equal(slot.entityId,'project_b');assert.equal(slot.metadata.projectId,'project_b');assert.equal(f.audits.get(a.result.receiptId).entityId,'project_a');assert.equal(f.audits.get(b.receiptId).entityId,'project_b');
 assert.equal((await f.store.read(f.session,{...f.context(),projectId:'project_b'})).state,'PREPARED');await assert.rejects(f.bridge.execute(a.context),{code:'OFFICE_CHAT_CODE_REJECTED'});
 const applied=await f.bridge.execute(f.receive(b.message));assert.equal(applied.identityStatus,'OFFICE_NAVIGATION_ONLY');assert.equal((await f.store.read(f.session,{...f.context(),projectId:'project_b'})).state,'BOUND');await f.store.command(f.session,f.command('REVOKE',{projectId:'project_a'}));assert.equal(f.slot().binding,null);assert.equal((await f.store.read(f.session,f.context())).state,'NOT_BOUND');
});
test('the original canonical event replays its receipt; a new event cannot consume the same code again',async()=>{
 const f=officeChatFixture(),p=await bound(f),count=f.audits.size;
 assert.deepEqual(await f.bridge.execute(p.context),p.result);assert.equal(f.audits.size,count);
});
test('same code in a second signed source event is rejected, even for exact sender and channel',async()=>{
 const f=officeChatFixture(),p=await prepared(f);await f.bridge.execute(p.context);const before=JSON.stringify([...f.audits.values()]);await assert.rejects(f.bridge.execute(f.receive(p.result.message)),{code:'OFFICE_CHAT_CODE_REJECTED'});assert.equal(JSON.stringify([...f.audits.values()]),before);
});
test('wrong exact sender cannot consume a prepared challenge',async()=>{const f=officeChatFixture(),p=await prepared(f);await assert.rejects(f.bridge.execute(f.receive(p.result.message,{sender:'5493333333333'})),{code:'OFFICE_CHAT_CODE_REJECTED'});assert.equal(f.slot().binding,null);});
test('five-minute expiry is checked against database time and leaves pending attempt unconsumed',async()=>{const f=officeChatFixture(),p=await prepared(f);f.controls.clock+=OFFICE_CHAT_TTL_MS;await assert.rejects(f.bridge.execute(f.receive(p.result.message)),{code:'OFFICE_CHAT_CODE_EXPIRED'});assert(f.slot().pending);assert.equal(f.slot().binding,null);});
test('expiry after receipt SQL rolls back the binding and retains the original pending challenge',async()=>{const f=officeChatFixture(),p=await prepared(f),before=JSON.stringify([...f.audits.values()]);f.controls.clock+=OFFICE_CHAT_TTL_MS-500;const context=f.receive(p.result.message);f.controls.afterAuditWrite=action=>{if(action==='office.chat.dispatched')f.controls.clock+=500;};await assert.rejects(f.bridge.execute(context),{code:'OFFICE_CHAT_CODE_EXPIRED'});assert.equal(JSON.stringify([...f.audits.values()]),before);assert.equal(f.slot().binding,null);assert.equal(f.controls.posts,0);});
for(const mutation of [f=>{f.controls.active=false;},f=>{f.member.role='SITE_MANAGER';},f=>{f.member.memberRevision+='changed';},f=>{f.member.actorRevision+='changed';},f=>{f.controls.ownerRevision++;},f=>{f.controls.assignmentRevision++;},f=>{f.connection.enabled=false;},f=>{f.controls.projectAccess=false;}])test('current role, membership, project and channel changes deny challenge without resurrection: '+mutation.toString(),async()=>{const f=officeChatFixture(),p=await prepared(f);mutation(f);await assert.rejects(f.bridge.execute(p.context),{code:'OFFICE_CHAT_ACCESS_REVOKED'});assert.equal(f.slot().binding,null);});
test('role A-B-A with changed canonical revision does not resurrect bound navigation',async()=>{const f=officeChatFixture(),p=await bound(f);f.member.role='AUDITOR';f.member.memberRevision='revoked';await assert.rejects(f.bridge.execute(f.receive('CUENTA')),{code:'OFFICE_CHAT_ACCESS_REVOKED'});f.member.role='ADMIN';f.member.memberRevision='restored';await assert.rejects(f.bridge.execute(f.receive('CUENTA')),{code:'OFFICE_CHAT_ACCESS_REVOKED'});assert.equal(f.controls.posts,0);assert(p.result.reply);});
test('cross-actor slot mutation cannot adopt another canonical account',async()=>{const f=officeChatFixture(),p=await prepared(f);f.slot().actorId='another_actor';await assert.rejects(f.bridge.execute(p.context),{code:'OFFICE_CHAT_CONTEXT_CHANGED'});assert.equal(f.slot().binding,null);});
test('foreign signed web organization or stale Clerk role cannot prepare account continuity',async()=>{for(const change of [s=>({...s,organizationId:'org_Foreign'}),s=>({...s,organizationRole:'org:member'}),s=>({...s,userId:'user_Foreign'})]){const f=officeChatFixture();await assert.rejects(f.store.command(change(f.session),f.command()),{code:'OFFICE_CHAT_ACCESS_REVOKED'});assert.equal(f.audits.size,0);}});
test('corporate channel revision and WABA changes invalidate a bound account before navigation or send',async()=>{for(const change of [f=>{f.controls.ownerRevision++;},f=>{f.connection.whatsappBusinessId='999999999999999';}]){const f=officeChatFixture(),p=await bound(f);change(f);await assert.rejects(f.bridge.send(p.context,p.result.reply));assert.equal(f.controls.posts,0);}});
for(const mutate of [e=>{e.payload.organizationId='company_foreign';},e=>{e.payload.signatureVerified=false;},e=>{e.payload.signatureScheme='unsigned';},e=>{e.leaseExpiresAt=new Date(0);},e=>{e.payload.channelId='foreign_channel';}])test('only canonical signed envelope and live exact lease may consume: '+mutate.toString(),async()=>{const f=officeChatFixture(),p=await prepared(f),context=f.receive(p.result.message,{mutate});await assert.rejects(f.bridge.execute(context));assert.equal(f.slot().binding,null);assert.equal(f.controls.posts,0);});
test('a different processing lease cannot consume the current signed event',async()=>{const f=officeChatFixture(),p=await prepared(f);await assert.rejects(f.bridge.execute({...p.context,leaseToken:'foreign_lease'}));assert.equal(f.slot().binding,null);});
for(const lease of [null,'invalid'])test('missing or invalid database lease is never live: '+String(lease),async()=>{const f=officeChatFixture(),p=await prepared(f);f.events.get(p.context.eventId).leaseExpiresAt=lease;await assert.rejects(f.bridge.execute(p.context),{code:'OFFICE_CHAT_CONTEXT_CHANGED'});assert.equal(f.slot().binding,null);});
test('invalid challenge expiry fails closed rather than treating NaN as an unexpired code',async()=>{const f=officeChatFixture(),p=await prepared(f);f.slot().pending.expiresAt='invalid';await assert.rejects(f.bridge.execute(p.context),{code:'OFFICE_CHAT_CODE_EXPIRED'});assert.equal(f.slot().binding,null);});
test('the locked sealed source is checked again after authority discovery',async()=>{const f=officeChatFixture(),p=await prepared(f);f.controls.onAuthorityRead=()=>{f.events.get(p.context.eventId).payload.signatureVerified=false;};await assert.rejects(f.bridge.execute(p.context),{code:'META_CUSTOMER_EVENT_PROOF_REQUIRED'});assert.equal(f.slot().binding,null);assert.equal(f.controls.posts,0);});
test('lost encryption key rejects the sealed source without consuming or exposing the code',async()=>{const f=officeChatFixture(),p=await prepared(f),bridge=createOfficeChatBridge({connect:f.connect,provider:f.provider,environment:{META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,9).toString('base64')}});await assert.rejects(bridge.execute(p.context),{code:'META_CUSTOMER_EVENT_PROOF_REQUIRED'});assert.equal(f.slot().binding,null);});
test('revoking account continuity cannot grant or revoke worker permissions and prevents prepared reply send',async()=>{const f=officeChatFixture(),p=await bound(f);await f.store.command(f.session,f.command('REVOKE'));await assert.rejects(f.bridge.send(p.context,p.result.reply));assert.equal(f.controls.posts,0);assert.equal(f.slot().binding,null);assert(!f.queries.some(q=>/UPDATE public."Worker"/.test(q.sql)));});
test('ordinary pending challenge does not capture HOLA or any FIELD/identity/report input',async()=>{const f=officeChatFixture();await prepared(f);for(const text of ['HOLA','MENU','ENTRADA','IDENTIDAD abc','ESTADO IDENTIDAD','Avancé 5 m2'])assert.equal(await f.bridge.execute(f.receive(text)),null);assert.equal(f.slot().binding,null);});
test('bound office navigation leaves field commands, private notes and foreign interactive choices to their existing adapters',async()=>{const f=officeChatFixture();await bound(f);for(const body of ['MENU','ENTRADA','IDENTIDAD abc','ESTADO IDENTIDAD','Avancé 5 m2',{type:'interactive',interactive:{list_reply:{id:'field:original-choice'}},context:{id:'wamid.originalfieldprompt'}}])assert.equal(await f.bridge.execute(f.receive(body)),null);});
test('unowned messages do not inherit office reply-window policy; recognized account navigation still does',async()=>{for(const bind of [false,true]){const f=officeChatFixture();if(bind)await bound(f);const timestamp=String(Math.floor(f.controls.clock/1000)-24*60*60),context=f.receive({type:'text',text:{body:'ENTRADA'},timestamp});assert.equal(await f.bridge.execute(context),null);if(bind)await assert.rejects(f.bridge.execute(f.receive({type:'text',text:{body:'CUENTA'},timestamp})),{code:'META_CUSTOMER_REPLY_WINDOW_CLOSED'});}});
test('an explicitly selected navigation area can return to FIELD, preserving bound account for CUENTA',async()=>{const f=officeChatFixture();await bound(f);assert((await f.bridge.execute(f.receive('Hola!'))).reply);await f.bridge.execute(f.receive('CAMPO'));for(const body of ['HOLA','MENU','ENTRADA','EVIDENCIA'])assert.equal(await f.bridge.execute(f.receive(body)),null);assert((await f.bridge.execute(f.receive('CUENTA'))).reply);});
test('menu selection requires the exact delivered prompt and never returns private lists or magic links',async()=>{
 const f=officeChatFixture(),p=await bound(f);await f.bridge.send(p.context,p.result.reply);
 const row=p.result.reply.sections[0].rows.find(r=>r.title==='Equipo'),replyTo=[...f.events.values()].find(e=>e.provider==='meta-customer-outbound-v1').outcome.messageId;
 const stale=f.receive({type:'interactive',interactive:{list_reply:{id:row.id}},context:{id:'wamid.foreignprompt'}});await assert.rejects(f.bridge.execute(stale),{code:'OFFICE_CHAT_REPLY_CONTEXT_REQUIRED'});
 const good=await f.bridge.execute(f.receive({type:'interactive',interactive:{list_reply:{id:row.id}},context:{id:replyTo}}));assert.match(good.reply.body,/https:\/\/obrasaas.com\/cuenta\?seccion=identidad/);assert.doesNotMatch(good.reply.body,/office_actor|company_a|project_a|JWT|token|ticket=/);assert.equal(f.controls.posts,1);
});
test('durable outbound reservation sends once; lost provider acknowledgment cannot cause another POST',async()=>{const f=officeChatFixture(),p=await bound(f);f.controls.loseAck=true;const first=await f.bridge.send(p.context,p.result.reply);assert.equal(first.state,'SEND_UNKNOWN');assert.equal(f.controls.posts,1);await f.bridge.send(p.context,p.result.reply);assert.equal(f.controls.posts,1);});
test('caller-supplied private text cannot use the account navigation outbound resolver',async()=>{const f=officeChatFixture(),p=await bound(f);await assert.rejects(f.bridge.send(p.context,{type:'text',body:'Unapproved private account information'}),{code:'OFFICE_CHAT_CONTEXT_CHANGED'});assert.equal(f.controls.posts,0);assert.equal([...f.events.values()].filter(e=>e.provider==='meta-customer-outbound-v1').length,0);});
test('role revocation at the final provider fence prevents POST of an already prepared reply',async()=>{const f=officeChatFixture(),p=await bound(f);f.controls.beforePost=()=>{f.controls.active=false;};await assert.rejects(f.bridge.send(p.context,p.result.reply),{code:'OFFICE_CHAT_ACCESS_REVOKED'});assert.equal(f.controls.posts,0);});
test('no corporate channel gives connect guidance without preparing challenge or using another tenant channel',async()=>{const f=officeChatFixture();f.controls.channel=false;assert.equal((await f.store.read(f.session,f.context())).state,'CONNECT_WHATSAPP');assert.equal((await f.store.command(f.session,f.command())).state,'CONNECT_WHATSAPP');assert.equal(f.audits.size,0);});
test('HTTP session, exact Origin, closed input and no-store boundaries protect ephemeral code',async()=>{
 const f=officeChatFixture(),h=createOfficeChatHandlers({verify:async()=>f.session,store:f.store}),input=f.command();
 const req=(body,origin='https://obrasaas.com')=>new Request('https://obrasaas.com/api/identity/office-chat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await h.POST(req(input,'https://evil.invalid'))).status,403);assert.equal(f.audits.size,0);assert.equal((await h.POST(req({...input,role:'ADMIN'}))).status,400);
 const response=await h.POST(req(input));assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.match((await response.json()).message,/^CUENTA /);
 const denied=createOfficeChatHandlers({verify:async()=>({authenticated:false}),store:f.store});assert.equal((await denied.POST(req(input))).status,401);
});
test('office links remain ordinary bounded account paths through sign-in, without invitation override',()=>{assert.equal(identitySignInPath(new URLSearchParams({seccion:'canal'})),'/sign-in?seccion=canal');assert.equal(identityAccountReturnPath(new URLSearchParams({seccion:'canal',obra:'project_a'})),'/cuenta?seccion=canal&obra=project_a');assert.equal(identitySignInPath(new URLSearchParams({seccion:'canal',participar:'invalid'})),'/sign-in');assert.equal(identitySignInPath(new URLSearchParams({seccion:'mi-whatsapp'})),'/sign-in?seccion=mi-whatsapp');assert.equal(identitySignInPath(new URLSearchParams({seccion:'mi-whatsapp',oficina:'invalid'})),'/sign-in');assert.match(officeChatReply('event','SETTINGS').body,/https:\/\/obrasaas.com\/cuenta\?seccion=mi-whatsapp/);assert.equal(officeChatReply('event').sections[0].rows.length,5);});
test('exact Next proxy entry reaches the signed handler while sibling paths and methods retain the legacy boundary',async()=>{
 const source=readFileSync(new URL('../src/proxy.js',import.meta.url),'utf8'),context={URL,NextResponse,authorizeLegacyService:request=>authorizeLegacyService(request,{}),legacyBoundaryKind,privateLegacyHeaders,unauthorizedLegacyResponse,identityRoute,IDENTITY_ORIGIN,companySubscriptionRoute,process:{env:{VERCEL_ENV:'production'}}};
 // Preserve the actual function bodies; supply only their real import bindings.
 vm.runInNewContext(source.replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function|const)/g,'')+'\nglobalThis.entry=proxy;',context,{filename:'src/proxy.js'});
 const h=createOfficeChatHandlers({verify:async()=>({authenticated:false}),store:{command(){assert.fail('Anonymous store write');},read(){assert.fail('Anonymous store read');}}});
 for(const method of ['GET','POST']){const request=new NextRequest(IDENTITY_ORIGIN+'/api/identity/office-chat',{method}),gateway=await context.entry(request);assert.equal(gateway.headers.get('x-middleware-next'),'1');assert.equal((await h[method](request)).status,401);}
 for(const [path,method]of [['/api/identity/office-chat-extra','GET'],['/api/identity/office-chat','DELETE']])assert.equal((await context.entry(new NextRequest(IDENTITY_ORIGIN+path,{method}))).status,401);
 const alias=await context.entry(new NextRequest('https://preview.invalid/api/identity/office-chat'));assert.equal(alias.status,307);assert.equal(alias.headers.get('location'),IDENTITY_ORIGIN+'/api/identity/office-chat');
});
test('production composition routes only office-owned input to office outbound; other messages retain original adapters',async()=>{
 const f=officeChatFixture(),p=await prepared(f),trace=[],noop=async()=>null,send=async()=>{throw new Error('Wrong outbound');},feedback={send,rejection:noop,feedback:noop};
 const processor=createMetaCustomerProductionProcessor({connect:f.connect,environment:f.environment,officeBridge:f.bridge,fieldBridge:{execute:async()=>{trace.push('FIELD');return {kind:'FIELD_UNCHANGED',businessApplied:false};}},kycBridge:{execute:noop,executeIntake:async()=>{trace.push('INTAKE');return null;}},kycOutbound:{send},appProjection:{execute:noop},companyBridge:{execute:noop},fieldOutbound:{send},companyOutbound:{send},isCompany:async()=>false,rejectedKyc:feedback,expiredKyc:feedback,contextKyc:feedback,deferAuthorization:async()=>false,authorizationCodes:[]});
 f.events.get(p.context.eventId).leaseToken=null;const result=await processor.process(p.context.eventId);assert.equal(result.kind,'OFFICE_CHAT');assert.equal(result.processed,true);assert.equal(f.controls.posts,1);assert.deepEqual(trace,[]);
 await f.bridge.execute(f.receive('CAMPO'));const next=f.receive('MENU');f.events.get(next.eventId).leaseToken=null;assert.equal((await processor.process(next.eventId)).kind,'FIELD_UNCHANGED');assert.deepEqual(trace,['INTAKE','FIELD']);
});
for(const status of ['sent','delivered','read','failed','deleted'])test('production processor preserves canonical '+status+' observations without an office slot',async()=>{
 const f=officeChatFixture(),p=await bound(f),sent=await f.bridge.send(p.context,p.result.reply),outboundId=customerOutboundId(p.context.eventId);f.audits.clear();
 const context=f.receive({id:sent.messageId,status,biz_opaque_callback_data:outboundId},{payloadType:'message_status'});f.events.get(context.eventId).leaseToken=null;
 const noop=async()=>null,send=async()=>{assert.fail('A status cannot send a reply');},feedback={send,rejection:noop,feedback:noop},transport=createMetaCustomerOutbound({connect:f.connect,environment:f.environment,provider:f.provider,resolveIdentity:async()=>{assert.fail('Status observation must not resolve a new recipient');}});let observations=0;
 const processor=createMetaCustomerProductionProcessor({connect:f.connect,environment:f.environment,officeBridge:f.bridge,fieldBridge:{execute:noop},kycBridge:{execute:noop,executeIntake:noop},kycOutbound:{send},appProjection:{execute:noop},companyBridge:{execute:noop},fieldOutbound:{send,observeStatus:async(...args)=>{observations++;return transport.observeStatus(...args);}},companyOutbound:{send},isCompany:async()=>false,rejectedKyc:feedback,expiredKyc:feedback,contextKyc:feedback,deferAuthorization:async()=>false,authorizationCodes:[]});
 const result=await processor.process(context.eventId);assert.equal(result.kind,'message_status');assert.equal(result.processed,true);assert.equal(observations,1);assert.equal(f.events.get(outboundId).outcome.state,'STATUS_OBSERVED');assert.equal(f.events.get(outboundId).outcome.providerStatus,status);assert.equal(f.events.get(context.eventId).status,'PROCESSED');assert.equal(f.controls.posts,1);assert.equal(f.audits.size,0);
});

// PostgreSQL JSONB can legally reorder object keys, including nested reply
// objects. This adapter changes key order only; array order and values survive.
function persistedJsonbObjectOrder(value){
 if(Array.isArray(value))return value.map(persistedJsonbObjectOrder);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort((a,b)=>Buffer.byteLength(a)-Buffer.byteLength(b)||Buffer.compare(Buffer.from(a),Buffer.from(b))).map(key=>[key,persistedJsonbObjectOrder(value[key])]));
 return value;
}
test('JSONB reply key order permits exact event replay and preserves canonical outbound request order',async()=>{
 const f=officeChatFixture(),p=await bound(f),row=f.audits.get(p.result.receiptId),beforeOrder=JSON.stringify(row.metadata.reply),count=f.audits.size;
 row.metadata=persistedJsonbObjectOrder(row.metadata);assert.notEqual(JSON.stringify(row.metadata.reply),beforeOrder,'The fixture must actually change persisted reply key order');
 const replay=await f.bridge.execute(p.context);assert.deepEqual(replay,p.result);assert.equal(JSON.stringify(replay.reply),JSON.stringify(p.result.reply),'The returned reply uses the original factory order');assert.equal(f.audits.size,count);
 await f.bridge.send(p.context,replay.reply);await f.bridge.send(p.context,(await f.bridge.execute(p.context)).reply);assert.equal(f.controls.posts,1);assert.equal([...f.events.values()].filter(event=>event.provider==='meta-customer-outbound-v1').length,1);
});
for(const [label,mutate] of [
 ['extra key',reply=>{reply.privateText='not approved';}],
 ['missing key',reply=>{delete reply.button;}],
 ['wrong value type',reply=>{reply.body=123;}],
 ['changed body',reply=>{reply.body+=' changed';}],
 ['changed array order',reply=>{reply.sections[0].rows.reverse();}]
])test('JSONB reply validation still rejects '+label+' before replay or outbound',async()=>{
 const f=officeChatFixture(),p=await bound(f),row=f.audits.get(p.result.receiptId);
 row.metadata=persistedJsonbObjectOrder(row.metadata);mutate(row.metadata.reply);const before=structuredClone([...f.audits.values()]);
 await assert.rejects(f.bridge.execute(p.context),{code:'OFFICE_CHAT_CONTEXT_CHANGED'});await assert.rejects(f.bridge.send(p.context,p.result.reply),{code:'OFFICE_CHAT_CONTEXT_CHANGED'});
 assert.deepEqual([...f.audits.values()],before);assert.equal(f.controls.posts,0);assert.equal([...f.events.values()].filter(event=>event.provider==='meta-customer-outbound-v1').length,0);
});
test('JSONB persisted navigation URL alteration cannot be replayed or sent',async()=>{
 const f=officeChatFixture(),p=await bound(f);await f.bridge.send(p.context,p.result.reply);
 const prompt=[...f.events.values()].find(event=>event.provider==='meta-customer-outbound-v1').outcome.messageId,choice=p.result.reply.sections[0].rows.find(row=>row.title==='Mis obras');
 const context=f.receive({type:'interactive',interactive:{list_reply:{id:choice.id}},context:{id:prompt}}),selected=await f.bridge.execute(context),row=f.audits.get(selected.receiptId);
 assert.equal(selected.reply.type,'text');
 row.metadata=persistedJsonbObjectOrder(row.metadata);assert.match(row.metadata.reply.body,/^https:\/\/obrasaas\.com\/cuenta/);
 row.metadata.reply.body=row.metadata.reply.body.replace('https://obrasaas.com','https://foreign.invalid');const before=structuredClone([...f.audits.values()]);
 await assert.rejects(f.bridge.execute(context),{code:'OFFICE_CHAT_CONTEXT_CHANGED'});await assert.rejects(f.bridge.send(context,selected.reply),{code:'OFFICE_CHAT_CONTEXT_CHANGED'});
 assert.deepEqual([...f.audits.values()],before);assert.equal(f.controls.posts,1);assert.equal([...f.events.values()].filter(event=>event.provider==='meta-customer-outbound-v1').length,1);
});

// Real office-review receipts are Project-scoped. This bounded SQL model
// covers their effect on every office boundary; native SQL is a separate gate.
function restrictedOfficeReview(f,overrides={}){
 const row={id:'synthetic_office_review',organizationId:f.member.organizationId,actorId:f.member.actorId,action:'office.review.accepted',entityType:'Project',entityId:'project_a',metadata:{version:1,membershipId:f.member.membershipId},...overrides};
 f.audits.set(row.id,row);return row;
}
test('a restricted review origin remains restricted after AUDITOR becomes DIRECTOR',async()=>{
 const f=officeChatFixture({role:'AUDITOR'});restrictedOfficeReview(f);f.member.role='DIRECTOR';f.member.memberRevision='2026-11-03T00:00:00.000001';
 const before=structuredClone([...f.audits]);for(const call of [()=>f.store.read(f.session,f.context()),()=>f.store.command(f.session,f.command()),()=>f.store.command(f.session,f.command('REVOKE'))])await assert.rejects(call(),{code:'OFFICE_CHAT_ACCESS_REVOKED'});
 assert.deepEqual([...f.audits],before);assert.equal(f.controls.posts,0);assert.equal(f.events.size,0);
});
for(const phase of ['consume','menu','send','final-provider-fence'])test('current Project-scoped review restriction stops '+phase,async()=>{
 const f=officeChatFixture({role:'DIRECTOR'}),p=phase==='consume'?await prepared(f):await bound(f);
 if(phase==='final-provider-fence')f.controls.beforePost=()=>restrictedOfficeReview(f);else restrictedOfficeReview(f);
 const before=structuredClone([...f.audits]);
 await assert.rejects(phase==='consume'?f.bridge.execute(p.context):phase==='menu'?f.bridge.execute(f.receive('CUENTA')):f.bridge.send(p.context,p.result.reply),{code:'OFFICE_CHAT_ACCESS_REVOKED'});
 assert.equal(f.controls.posts,0);
 if(phase==='consume'){assert.equal(f.slot().binding,null);assert.deepEqual([...f.audits],before);}
 if(phase==='menu')assert.deepEqual([...f.audits],before);
});
for(const changed of [{organizationId:'foreign_company'},{actorId:'foreign_actor'},{metadata:{version:1,membershipId:'foreign_membership'}}])test('foreign office-review origin does not restrict current office account '+JSON.stringify(changed),async()=>{
 const f=officeChatFixture({role:'DIRECTOR'});restrictedOfficeReview(f,changed);const p=await bound(f);assert.equal(p.result.identityStatus,'OFFICE_NAVIGATION_ONLY');
});
