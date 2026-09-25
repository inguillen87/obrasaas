import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){
  if(specifier==='@clerk/nextjs/server')return {url:'mock:attendance-clerk',shortCircuit:true};
  if(specifier==='next/headers')return {url:'mock:attendance-headers',shortCircuit:true};
  if(specifier.startsWith('@/'))return next(new URL('../src/'+specifier.slice(2)+(specifier.startsWith('@/generated/')?'.ts':'.js'),import.meta.url).href,context);
  return next(specifier,context);
},load(url,context,next){
  if(url==='mock:attendance-clerk')return{format:'module',shortCircuit:true,source:"export async function auth(){throw Error('Unexpected Clerk')} export async function clerkClient(){throw Error('Unexpected Clerk')}"};
  if(url==='mock:attendance-headers')return{format:'module',shortCircuit:true,source:"export async function cookies(){throw Error('Unexpected cookies')}"};return next(url,context);
}});
const {ATTENDANCE_GEO_WINDOW_MS}=await import('../src/lib/attendance.js');
const {readProactiveFlowAttendance}=await import('../src/lib/whatsapp/flow-attendance.js');
const {readProactiveFlowReply}=await import('../src/lib/whatsapp/proactive-flow-reply.js');
const {buildFlowAttendanceReceipt,flowAttendanceReceiptMatches,flowAttendanceMatches,flowAttendancePresentation}=await import('../src/lib/whatsapp/flow-attendance-policy.js');
const {createWhatsAppProactiveFlowHandlers}=await import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js');
const {AccessError}=await import('../src/lib/access.js');
const {createFlowAttendanceFixture,attendanceScope:scope,attendanceAccess:access,ATTENDANCE_NOW:now}=await import('./helpers/flow-attendance-fixture.js');
const read=(f,extra={})=>readProactiveFlowAttendance({prisma:f.prisma,access,conversationId:scope.conversationId,messageId:f.source.id,clock:()=>now,...extra});
const request=(extra='',headers={})=>new Request('https://obra.test/api/whatsapp/inbox/'+scope.conversationId+'/proactive-flows?'+new URLSearchParams({projectId:scope.projectId,mode:'attendance',messageId:'message-attendance'})+extra,{headers:{'X-ObraSaaS-Organization':scope.organizationId,'X-ObraSaaS-Project':scope.projectId,...headers}});
const context={params:Promise.resolve({conversationId:scope.conversationId})};
test('exact receipt reaches the existing attendance entry with no private fields or writes',async()=>{
 const f=createFlowAttendanceFixture(),before=structuredClone(f.state),result=await read(f);assert.equal(result.state,'available');assert.equal(result.entry.id,'entry-a');assert.equal(result.entry.verificationStatus,'PENDING');assert.equal(flowAttendanceMatches(result,scope,f.source.id),true);assert.deepEqual(f.state,before);
 for(const text of ['PRIVATE_','latitude','longitude','recipient','worker-a','wamid.','token','body'])assert.equal(JSON.stringify(result).includes(text),false);
 assert.ok(f.calls.some(call=>call.transaction?.isolationLevel==='RepeatableRead'));assert.deepEqual(Object.keys(f.calls.find(call=>call.model==='entry').args.select).sort(),['id','occurredAt','shiftId','verificationStatus']);
});
test('reused pending entry can predate the issued form: the stored receipt, not time proximity, selects it',async()=>{
 const f=createFlowAttendanceFixture();f.entry.occurredAt=new Date(now.getTime()-ATTENDANCE_GEO_WINDOW_MS-60000);const result=await read(f);assert.equal(result.entry.id,f.entry.id);assert.equal(flowAttendancePresentation(result.entry,result.observedAt).label,'Plazo de ubicación vencido');assert.equal(f.entry.verificationStatus,'PENDING');
});
test('current shift is read by exact project and worker rather than inferred from the latest shift',async()=>{
 const f=createFlowAttendanceFixture();f.entry.shiftId='shift-a';f.entry.verificationStatus='VERIFIED';f.state.shift={id:'shift-a',projectId:scope.projectId,workerId:f.session.workerId,status:'CLOSED',revision:4,workDate:new Date('2026-09-24T00:00:00.000Z')};
 const result=await read(f);assert.equal(result.state,'available');assert.deepEqual(result.entry.shift,{id:'shift-a',status:'CLOSED',revision:4,workDate:'2026-09-24'});assert.equal(flowAttendancePresentation(result.entry,result.observedAt).label,'Ubicación verificada');
 f.state.shift.workerId='other';assert.equal((await read(f)).state,'unavailable');
});
test('legacy processed reply without a backend receipt is unlinked, not a guessed attendance record',async()=>{const f=createFlowAttendanceFixture();delete f.inbound.metadata.flowAttendanceReceipt;assert.equal((await read(f)).state,'unlinked');assert.equal(f.calls.some(c=>c.model==='entry'),false);});
for(const patch of [{entryId:'../other'},{entryId:''},{workerId:'other'},{projectId:'other'},{sessionId:'other'},{version:2},{latitude:12}])test('malformed or foreign stored receipt '+JSON.stringify(patch),async()=>{
 const f=createFlowAttendanceFixture();Object.assign(f.inbound.metadata.flowAttendanceReceipt,patch);assert.equal((await read(f)).state,'unavailable');assert.equal(f.calls.some(c=>c.model==='entry'),false);
});
for(const patch of [{id:'other'},{projectId:'other'},{workerId:'other'},{eventType:'CHECK_OUT'},{verificationStatus:'UNKNOWN'},{verificationStatus:'VERIFIED'},{occurredAt:new Date('2030-01-01')}])test('unusable or cross-scope domain entry '+JSON.stringify(patch),async()=>{const f=createFlowAttendanceFixture();Object.assign(f.entry,patch);assert.equal((await read(f)).state,'unavailable');});
for(const key of ['redacted','simulated'])test(key+' message does not disclose attendance',async()=>{const f=createFlowAttendanceFixture();f.inbound.metadata[key]=true;assert.equal((await read(f)).state,'unavailable');assert.equal(f.calls.some(c=>c.model==='entry'),false);});
test('medical message does not broaden access even with an exact receipt',async()=>{const f=createFlowAttendanceFixture();f.inbound.metadata.sensitivity='medical';assert.equal((await read(f)).state,'unavailable');});
test('wrong session or missing inbound does not reach the attendance table',async()=>{const f=createFlowAttendanceFixture();f.inbound.metadata.whatsappFlowSessionId='other';assert.equal((await read(f)).state,'unavailable');assert.equal(f.calls.some(c=>c.model==='entry'),false);});
test('absence of consumption differs from absence of a legacy link',async()=>{const f=createFlowAttendanceFixture();f.session.consumedAt=null;f.session.consumedExternalId=null;assert.equal((await read(f)).state,'not_recorded');});
test('an incident form does not guess an attendance relation',async()=>{const f=createFlowAttendanceFixture();f.source.metadata.blueprintKey='incident-report';f.session.blueprintKey='incident-report';f.inbound.metadata.whatsappFlowBlueprintKey='incident-report';assert.equal((await read(f)).state,'unsupported');});
test('engine receipt builder rejects foreign/invalid results without admitting request-supplied ids',()=>{
 const f=createFlowAttendanceFixture();assert.equal(flowAttendanceReceiptMatches(buildFlowAttendanceReceipt(f.entry,f.session),f.session),true);
 for(const patch of [{id:'../x'},{projectId:'other'},{workerId:'other'},{eventType:'CHECK_OUT'}])assert.throws(()=>buildFlowAttendanceReceipt({...f.entry,...patch},f.session),{code:'WHATSAPP_FLOW_ATTENDANCE_BINDING_INVALID'});
});
test('attendance affordance is absent by default and enabled only for eligible verified replies',async()=>{
 const f=createFlowAttendanceFixture(),args={prisma:f.prisma,access,conversationId:scope.conversationId,messageId:f.source.id,clock:()=>now};
 assert.equal((await readProactiveFlowReply(args)).attendanceAvailable,undefined);assert.equal((await readProactiveFlowReply({...args,canReadAttendance:true})).attendanceAvailable,true);
});
test('response envelope rejects foreign scope, extra private data and malformed states',async()=>{
 const f=createFlowAttendanceFixture(),good=await read(f);
 for(const bad of [{...good,sourceMessageId:'other'},{...good,context:{...scope,projectId:'other'}},{...good,entry:{...good.entry,latitude:12}},{...good,entry:{...good.entry,verificationStatus:'VERIFIED'}},{...good,state:'unlinked'},{...good,observedAt:'bad'}])assert.equal(flowAttendanceMatches(bad,scope,f.source.id),false);
});
test('route authorizes conversations AND attendance before reading any database',async()=>{
 const f=createFlowAttendanceFixture(),permissions=[];const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:(a,p)=>permissions.push(p),prismaFactory:()=>f.prisma,clock:()=>now});
 const response=await h.GET(request(),context);assert.equal(response.status,200);assert.deepEqual(permissions,['org:conversations:read','org:attendance:read']);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal((await response.json()).entry.id,'entry-a');
});
for(const permission of ['org:conversations:read','org:attendance:read'])test('revoked '+permission+' cannot query the receipt',async()=>{
 let reads=0;const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:(a,p)=>{if(p===permission)throw new AccessError('Denied',{status:403});},prismaFactory:()=>{reads++;}});assert.equal((await h.GET(request(),context)).status,403);assert.equal(reads,0);
});
for(const suffix of ['&entryId=other','&messageId=other','&workerId=other','&mode=reply'])test('query cannot choose a record directly '+suffix,async()=>{let reads=0;const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{},prismaFactory:()=>{reads++;}});assert.equal((await h.GET(request(suffix),context)).status,400);assert.equal(reads,0);});
test('another tenant is rejected in the reader and changed page context before the database',async()=>{
 const f=createFlowAttendanceFixture();await assert.rejects(read(f,{access:{...access,organization:{id:'foreign'}}}),{status:404});let reads=0;const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{},prismaFactory:()=>{reads++;}});assert.equal((await h.GET(request('',{'X-ObraSaaS-Project':'other'}),context)).status,409);assert.equal(reads,0);
});
test('empty injected service result never becomes an accepted attendance response',async()=>{const f=createFlowAttendanceFixture();const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{},prismaFactory:()=>f.prisma,readAttendance:async()=>({})});assert.equal((await h.GET(request(),context)).status,503);});
