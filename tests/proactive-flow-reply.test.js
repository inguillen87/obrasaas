import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){
  if(specifier==='@clerk/nextjs/server')return {url:'mock:reply-clerk',shortCircuit:true};
  if(specifier==='next/headers')return {url:'mock:reply-headers',shortCircuit:true};
  if(specifier.startsWith('@/'))return next(new URL('../src/'+specifier.slice(2)+(specifier.startsWith('@/generated/')?'.ts':'.js'),import.meta.url).href,context);
  return next(specifier,context);
},load(url,context,next){
  if(url==='mock:reply-clerk')return{format:'module',shortCircuit:true,source:"export async function auth(){throw Error('Unexpected Clerk call')} export async function clerkClient(){throw Error('Unexpected Clerk call')}"};
  if(url==='mock:reply-headers')return{format:'module',shortCircuit:true,source:"export async function cookies(){throw Error('Unexpected cookie call')}"};return next(url,context);
}});
const {readProactiveFlowReply}=await import('../src/lib/whatsapp/proactive-flow-reply.js');
const {flowReplyMatches,normalizeFlowReplyQuery}=await import('../src/lib/whatsapp/proactive-flow-reply-policy.js');
const {createWhatsAppProactiveFlowHandlers}=await import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js');
const {AccessError}=await import('../src/lib/access.js');
const {createFlowReplyFixture}=await import('./helpers/flow-reply-fixture.js');
const {historyScope:scope,historyAccess:access,HISTORY_NOW}=await import('./helpers/flow-history-fixture.js');
const read=(f,extra={})=>readProactiveFlowReply({prisma:f.prisma,access,conversationId:scope.conversationId,messageId:f.source.id,clock:()=>HISTORY_NOW,...extra});
const request=(query='',headers={})=>new Request('https://obra.test/api/whatsapp/inbox/'+scope.conversationId+'/proactive-flows?projectId='+scope.projectId+'&mode=reply&messageId=message-0000'+query,{headers:{'X-ObraSaaS-Organization':scope.organizationId,'X-ObraSaaS-Project':scope.projectId,...headers}});
const context={params:Promise.resolve({conversationId:scope.conversationId})};

test('exact outbound-session-inbound chain returns a least-privilege excerpt without writes',async()=>{
 const f=createFlowReplyFixture(),before=structuredClone({messages:f.messages,sessions:f.sessions});
 const result=await read(f);assert.equal(result.state,'available');assert.equal(result.reply.messageId,'reply-a');assert.equal(result.reply.body,f.reply.body);assert.equal(flowReplyMatches(result,scope,f.source.id),true);
 assert.deepEqual({messages:f.messages,sessions:f.sessions},before);
 for(const secret of ['PRIVATE_PHONE_CANARY','PRIVATE_TOKEN_CANARY','wamid.','tokenSha256','recipientPhone','worker-a'])assert.equal(JSON.stringify(result).includes(secret),false);
 assert.ok(f.calls.some(call=>call.transaction?.isolationLevel==='RepeatableRead'));
 for(const call of f.calls.filter(call=>call.args?.select)){assert.equal(call.args.select.recipientPhone,undefined);assert.equal(call.args.select.tokenSha256,undefined);assert.equal(call.args.select.encryptedAccessToken,undefined);}
});
test('same names never select a message with another consumed id or conversation',async()=>{
 const f=createFlowReplyFixture();f.reply.conversationId='foreign';f.messages.push({...f.reply,id:'nearby',externalId:'other-reference',conversationId:scope.conversationId});
 const result=await read(f);assert.equal(result.state,'unavailable');assert.equal(result.reply,null);
});
for(const field of ['organizationId','projectId','blueprintKey','sourceExternalId'])test('mismatched session '+field+' cannot disclose a reply',async()=>{
 const f=createFlowReplyFixture();f.session[field]='other';assert.equal((await read(f)).state,'unavailable');assert.equal(f.calls.some(call=>call.args?.where?.direction==='INBOUND'),false);
});
for(const [field,value] of [['provider','other'],['authorized',false],['quarantined',true],['workerId','other'],['whatsappFlowSessionId','other'],['whatsappFlowBlueprintKey','shift-check-in'],['whatsappFlowSessionExpired',true]])test('reply metadata '+field+' cannot be substituted',async()=>{
 const f=createFlowReplyFixture();f.reply.metadata[field]=value;const result=await read(f);assert.equal(result.state,'unavailable');assert.equal(result.reply,null);
});
for(const patch of [{kind:'TEXT'},{direction:'OUTBOUND'},{externalId:'other'},{createdAt:new Date('2030-01-01')},{createdAt:new Date('2020-01-01')}])test('noncorrelated inbound envelope '+JSON.stringify(patch),async()=>{
 const f=createFlowReplyFixture();Object.assign(f.reply,patch);assert.equal((await read(f)).state,'unavailable');
});
for(const patch of [{providerMessageId:'other'},{deliveryRejectedAt:HISTORY_NOW},{sentAt:null},{consumedAt:new Date('2030-01-01')},{consumedExternalId:''},{consumedExternalId:'  '},{consumedExternalId:'x'.repeat(513)},{consumedAt:new Date('2020-01-01')},{createdAt:null}])test('incoherent consumed session fails closed '+JSON.stringify(patch),async()=>{
 const f=createFlowReplyFixture();Object.assign(f.session,patch);assert.equal((await read(f)).state,'unavailable');
});
test('unconsumed session does not search other messages or infer a response',async()=>{
 const f=createFlowReplyFixture();f.session.consumedAt=null;f.session.consumedExternalId=null;
 assert.equal((await read(f)).state,'not_recorded');assert.equal(f.calls.some(call=>call.args?.where?.direction==='INBOUND'),false);
});
test('a processed session without its original message stays unavailable, not not-recorded',async()=>{
 const f=createFlowReplyFixture();f.messages.pop();assert.equal((await read(f)).state,'unavailable');
});
test('medical text remains redacted even though its technical correlation is valid',async()=>{
 const f=createFlowReplyFixture();f.reply.body='PRIVATE_MEDICAL_CANARY';f.reply.metadata.sensitivity='medical';
 const result=await read(f);assert.equal(result.state,'available');assert.ok(!result.reply.body.includes('PRIVATE_MEDICAL_CANARY'));
});
test('attachment-backed contents are not broadened by the reply route',async()=>{
 const f=createFlowReplyFixture();f.reply.body='PRIVATE_ATTACHMENT_CANARY';f.reply.metadata.media={kind:'document',url:'https://private.example/file'};
 const result=await read(f);assert.equal(result.state,'available');assert.ok(!result.reply.body.includes('PRIVATE_ATTACHMENT_CANARY'));assert.ok(!JSON.stringify(result).includes('https://private.example'));
});
test('foreign conversation and source ids return the existing opaque unavailable boundary',async()=>{
 const f=createFlowReplyFixture();await assert.rejects(read(f,{conversationId:'foreign'}),{status:404});await assert.rejects(read(f,{messageId:'other'}),{status:404,code:'WHATSAPP_FLOW_SOURCE_NOT_FOUND'});
});
test('private payment blueprints are not offered by operational history reply',async()=>{
 const f=createFlowReplyFixture();f.source.metadata.blueprintKey='worker-payment-details';await assert.rejects(read(f),{status:404});
});
test('invalid database time cannot become a verified response',async()=>{
 await assert.rejects(read(createFlowReplyFixture(),{clock:()=>new Date('invalid')}),{status:503});
});
test('reply result validator rejects extra fields and wrong message/context',async()=>{
 const f=createFlowReplyFixture(),good=await read(f);
 for(const bad of [{...good,context:{...scope,projectId:'other'}},{...good,sourceMessageId:'other'},{...good,reply:{...good.reply,messageId:good.sourceMessageId}},{...good,reply:{...good.reply,token:'x'}},{...good,reply:{...good.reply,body:'x'.repeat(4097)}},{...good,reply:{...good.reply,processedAt:'2030-01-01T00:00:00.000Z'}},{...good,state:'not_recorded'},{...good,observedAt:'invalid'},{...good,href:'https://other'}])assert.equal(flowReplyMatches(bad,scope,f.source.id),false);
});
test('route rechecks conversation permission and current scope before lookup',async()=>{
 const f=createFlowReplyFixture(),permissions=[];
 const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:(a,p)=>permissions.push(p),prismaFactory:()=>f.prisma,clock:()=>HISTORY_NOW});
 const response=await handlers.GET(request(),context);assert.equal(response.status,200);assert.equal((await response.json()).reply.messageId,'reply-a');assert.deepEqual(permissions,['org:conversations:read']);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
});
for(const headers of [{'X-ObraSaaS-Organization':'foreign'},{'X-ObraSaaS-Project':'other'},{'X-ObraSaaS-Project':''},{Origin:'https://other.test'},{'Sec-Fetch-Site':'cross-site'}])test('request context cannot widen reply scope '+JSON.stringify(headers),async()=>{
 let reads=0;const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{},prismaFactory:()=>{reads++;throw Error('Unexpected read');}});
 const response=await handlers.GET(request('',headers),context);assert.ok([403,409].includes(response.status));assert.equal(reads,0);
});
test('revoked reader cannot query by a previously known message id',async()=>{
 let reads=0;const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{throw new AccessError('Denied',{status:403});},prismaFactory:()=>{reads++;}});
 assert.equal((await handlers.GET(request(),context)).status,403);assert.equal(reads,0);
});
for(const suffix of ['&messageId=other','&replyMessageId=reply-a','&recipient=other','&cursor=other'])test('duplicate or extra query does not reach the lookup '+suffix,async()=>{
 let reads=0;const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{},prismaFactory:()=>{reads++;}});assert.equal((await handlers.GET(request(suffix),context)).status,400);assert.equal(reads,0);
});
test('route does not bless empty or mismatched injected results',async()=>{
 const f=createFlowReplyFixture();for(const returned of [{},null,{context:scope,state:'available',reply:{messageId:'reply-a'}}]){
  const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{},prismaFactory:()=>f.prisma,readReply:async()=>returned});assert.equal((await handlers.GET(request(),context)).status,503);
 }
 assert.throws(()=>normalizeFlowReplyQuery(new URLSearchParams({projectId:scope.projectId,mode:'reply',messageId:'../x'})));
});
