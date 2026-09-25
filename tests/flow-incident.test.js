import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){
 if(specifier==='@clerk/nextjs/server')return{url:'mock:incident-clerk',shortCircuit:true};
 if(specifier==='next/headers')return{url:'mock:incident-headers',shortCircuit:true};
 if(specifier.startsWith('@/'))return next(new URL('../src/'+specifier.slice(2)+(specifier.startsWith('@/generated/')?'.ts':'.js'),import.meta.url).href,context);return next(specifier,context);
},load(url,context,next){
 if(url==='mock:incident-clerk')return{format:'module',shortCircuit:true,source:"export async function auth(){throw Error('Unexpected auth')} export async function clerkClient(){throw Error('Unexpected auth')}"};
 if(url==='mock:incident-headers')return{format:'module',shortCircuit:true,source:"export async function cookies(){throw Error('Unexpected cookies')}"};return next(url,context);
}});
const {readProactiveFlowIncident}=await import('../src/lib/whatsapp/flow-incident.js');
const {flowIncidentMatches,flowIncidentReceiptMatches,normalizeFlowIncidentQuery}=await import('../src/lib/whatsapp/flow-incident-policy.js');
const {operationalIncidentIdForEvent,prependUniqueEventIncident}=await import('../src/lib/whatsapp/obra-policy.js');
const {buildFlowIncidentReceipt}=await import('../src/lib/whatsapp/flow-incident-receipt.js');
const {createFlowIncidentFixture}=await import('./helpers/flow-incident-fixture.js');
const {createWhatsAppProactiveFlowHandlers}=await import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js');
const {historyScope:scope,historyAccess:access,HISTORY_NOW}=await import('./helpers/flow-history-fixture.js');
const {AccessError}=await import('../src/lib/access.js');
const read=(f,changes={})=>readProactiveFlowIncident({prisma:f.prisma,access,conversationId:scope.conversationId,messageId:f.source.id,clock:()=>HISTORY_NOW,...changes});
const snap=f=>JSON.stringify({messages:f.messages,sessions:f.sessions,snapshot:f.snapshot});
const request=(suffix='',headers={})=>new Request('https://obra.test/api/whatsapp/inbox/'+scope.conversationId+'/proactive-flows?projectId='+scope.projectId+'&mode=incident&messageId=message-0000'+suffix,{headers:{'X-ObraSaaS-Organization':scope.organizationId,'X-ObraSaaS-Project':scope.projectId,...headers}});
const context={params:Promise.resolve({conversationId:scope.conversationId})};
test('exact incident receipt reads the existing snapshot with no raw text or writes',async()=>{
 const f=createFlowIncidentFixture(),before=snap(f),result=await read(f);assert.equal(result.state,'available');assert.equal(result.incident.id,f.incident.id);assert.equal(result.incident.status,'unclassified');assert.equal(flowIncidentMatches(result,scope,f.source.id),true);assert.equal(snap(f),before);
 for(const secret of ['PRIVATE_','wamid.','worker-a','flowToken','sourceContentRestricted','https://private'])assert.equal(JSON.stringify(result).includes(secret),false);
 assert.ok(f.calls.some(call=>call.transaction?.isolationLevel==='RepeatableRead'));assert.ok(f.calls.some(call=>call.model==='snapshot'&&call.args.where.project.organizationId===scope.organizationId));
});
test('event helper is identical to the existing writer and does not replace deduplication',()=>{
 const rows=[];prependUniqueEventIncident(rows,'wamid.fixture',{id:'fallback',metadata:{kind:'whatsapp-flow-incident'}});assert.equal(rows[0].id,operationalIncidentIdForEvent('wamid.fixture'));assert.equal(prependUniqueEventIncident(rows,'wamid.fixture',{id:'fallback'}),false);
});
for(const value of ['',null,'  ','bad reference','a'.repeat(513)])test('invalid event identity rejected '+String(value).slice(0,20),()=>assert.throws(()=>operationalIncidentIdForEvent(value)));
for(const field of ['incidentId','projectId','workerId','sessionId'])test('receipt '+field+' cannot select another record',async()=>{
 const f=createFlowIncidentFixture();f.reply.metadata.flowIncidentReceipt[field]='other';assert.equal((await read(f)).state,'unavailable');assert.equal(f.calls.some(call=>call.model==='snapshot'),false);
});
test('even another syntactically valid event id cannot replace the source identity',async()=>{
 const f=createFlowIncidentFixture();f.reply.metadata.flowIncidentReceipt.incidentId=operationalIncidentIdForEvent('wamid.other');assert.equal((await read(f)).state,'unavailable');
});
test('legacy reply without receipt stays unlinked even when exact-looking incident exists',async()=>{
 const f=createFlowIncidentFixture();delete f.reply.metadata.flowIncidentReceipt;assert.equal((await read(f)).state,'unlinked');assert.equal(f.calls.some(call=>call.model==='snapshot'),false);
});
for(const patch of [{sensitivity:'medical'},{redacted:true},{simulated:true}])test('restricted source condition '+JSON.stringify(patch)+' hides the domain link data',async()=>{
 const f=createFlowIncidentFixture();Object.assign(f.reply.metadata,patch);assert.equal((await read(f)).state,'unavailable');
});
for(const change of ['missing','duplicate','wrong-kind','medical','invalid-status','invalid-severity','future-snapshot','invalid-version'])test('snapshot integrity '+change+' cannot be announced as available',async()=>{
 const f=createFlowIncidentFixture();if(change==='missing')f.snapshot.state.incidents=[];
 if(change==='duplicate')f.snapshot.state.incidents.push({...f.incident});if(change==='wrong-kind')f.incident.metadata.kind='medical-leave';
 if(change==='medical')f.incident.sensitivity='medical';if(change==='invalid-status')f.incident.status='invented';if(change==='invalid-severity')f.incident.type='UNKNOWN';
 if(change==='future-snapshot')f.snapshot.updatedAt=new Date('2030-01-01');if(change==='invalid-version')f.snapshot.version=-1;
 assert.equal((await read(f)).state,'unavailable');
});
test('current state changes are observed without inventing an incident resolution date',async()=>{
 const f=createFlowIncidentFixture();f.incident.status='resolved';f.snapshot.version=4;const before=snap(f),result=await read(f);assert.equal(result.incident.status,'resolved');assert.equal(result.incident.snapshotVersion,4);assert.equal(Object.hasOwn(result.incident,'resolvedAt'),false);assert.equal(snap(f),before);
});
test('builder accepts only server-created incident with the original event and session',()=>{
 const f=createFlowIncidentFixture();assert.equal(flowIncidentReceiptMatches(f.reply.metadata.flowIncidentReceipt,f.session),true);
 for(const row of [null,{...f.incident,id:'other'},{...f.incident,metadata:{kind:'other'}}])assert.throws(()=>buildFlowIncidentReceipt(row,f.session.consumedExternalId,f.session));
 assert.equal(flowIncidentReceiptMatches({...f.reply.metadata.flowIncidentReceipt,token:'x'},f.session),false);
});
test('unknown and unconsumed origins remain distinct without querying the snapshot',async()=>{
 const f=createFlowIncidentFixture();f.session.consumedAt=null;f.session.consumedExternalId=null;assert.equal((await read(f)).state,'not_recorded');assert.equal(f.calls.some(call=>call.model==='snapshot'),false);
});
test('another tenant cannot read a valid incident id',async()=>{
 const f=createFlowIncidentFixture();await assert.rejects(read(f,{access:{...access,organization:{id:'other'}}}),{code:'INBOX_CONVERSATION_NOT_FOUND'});
});
test('DTO rejects context and original message substitution, malformed fields or private data',async()=>{
 const f=createFlowIncidentFixture(),good=await read(f);
 for(const bad of [{...good,context:{...scope,projectId:'other'}},{...good,sourceMessageId:'other'},{...good,incident:{...good.incident,description:'private'}},{...good,incident:{...good.incident,id:'../other'}},{...good,incident:{...good.incident,status:'constructor'}},{...good,state:'unlinked'}])assert.equal(flowIncidentMatches(bad,scope,f.source.id),false);
});
test('route requires conversations and project read then validates the exact response',async()=>{
 const f=createFlowIncidentFixture(),permissions=[];const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:(a,p)=>permissions.push(p),prismaFactory:()=>f.prisma,clock:()=>HISTORY_NOW});
 const r=await h.GET(request(),context);assert.equal(r.status,200);assert.deepEqual(permissions,['org:conversations:read','org:projects:read']);assert.equal((await r.json()).incident.id,f.incident.id);assert.match(r.headers.get('cache-control'),/private, no-store/);
});
for(const denied of ['org:conversations:read','org:projects:read'])test('denied '+denied+' prevents all database access',async()=>{
 let calls=0;const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:(a,p)=>{if(p===denied)throw new AccessError('Denied',{status:403});},prismaFactory:()=>{calls++;}});assert.equal((await h.GET(request(),context)).status,403);assert.equal(calls,0);
});
for(const suffix of ['&incidentId=other','&workerId=other','&messageId=other','&cursor=other'])test('no direct incident selector '+suffix,async()=>{
 let calls=0;const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{},prismaFactory:()=>{calls++;}});assert.equal((await h.GET(request(suffix),context)).status,400);assert.equal(calls,0);
});
test('wrong context or cross-site request rejected before storage',async()=>{
 let calls=0;const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{},prismaFactory:()=>{calls++;}});
 for(const hdr of [{'X-ObraSaaS-Project':'other'},{'X-ObraSaaS-Organization':'other'},{'X-ObraSaaS-Project':''},{Origin:'https://other.test'}])assert.ok([403,409].includes((await h.GET(request('',hdr),context)).status));assert.equal(calls,0);
});
test('malformed successful service response is rejected by the route',async()=>{
 const f=createFlowIncidentFixture();for(const result of [null,{}, {context:scope,state:'available',incident:{id:f.incident.id}}]){
 const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{},prismaFactory:()=>f.prisma,readIncident:async()=>result});assert.equal((await h.GET(request(),context)).status,503);}
 assert.throws(()=>normalizeFlowIncidentQuery(new URLSearchParams({mode:'incident',messageId:'../other'})));
});

test('status and severity arrays cannot coerce a valid DTO property name',async()=>{
 const f=createFlowIncidentFixture(),good=await read(f);
 for(const field of ['status','severity'])assert.equal(flowIncidentMatches({...good,incident:{...good.incident,[field]:[good.incident[field]]}},scope,f.source.id),false);
});
