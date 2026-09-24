import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyFlowFollowup, summarizeFlowFollowup, FLOW_FOLLOWUP_FILTERS, flowFollowupFilter } from '../src/lib/whatsapp/proactive-flow-followup.js';
import { listProactiveFlowHistory } from '../src/lib/whatsapp/proactive-flow-history.js';
import { createHistoryFixture, historyScope, historyAccess, HISTORY_NOW } from './helpers/flow-history-fixture.js';
const now=HISTORY_NOW.toISOString();
const record=(patch={})=>({messageId:'message-a',blueprintKey:'incident-report',body:'Mensaje operativo',recordedAt:'2026-09-24T11:00:00.000Z',status:'accepted',correlation:'verified',reply:{state:'not_recorded',recordedAt:null},expiresAt:'2026-09-24T13:00:00.000Z',riskDecision:false,...patch});
const load=(fixture,changes={})=>listProactiveFlowHistory({prisma:fixture.prisma,access:historyAccess,conversationId:historyScope.conversationId,clock:()=>HISTORY_NOW,...changes});
for(const status of ['accepted','sent','delivered','read'])test(status+' is not a response: classify by recorded reply and link validity',()=>{
 const item=record({status});assert.equal(classifyFlowFollowup(item,now),'waiting');
 assert.equal(classifyFlowFollowup({...item,expiresAt:now},now),'expired');
 assert.equal(classifyFlowFollowup({...item,reply:{state:'recorded',recordedAt:'2026-09-24T11:30:00.000Z'}},now),'responded');
});
for(const status of ['sending','unknown','failed','APPROVED',null,'delivered '])test('unsettled or invalid status requires review '+String(status),()=>{
 assert.equal(classifyFlowFollowup(record({status}),now),'attention');
 assert.equal(classifyFlowFollowup(record({status,reply:{state:'recorded',recordedAt:now}}),now),'attention');
});
for(const correlation of ['conflict','unavailable',null,'forged'])test('unverified correlation never counts as a business response '+String(correlation),()=>{
 assert.equal(classifyFlowFollowup(record({correlation,reply:{state:'recorded',recordedAt:now}}),now),'attention');
});
for(const expiresAt of [null,'','wrong','2026-09-24T10:00:00.000Z','2026-09-24T11:00:00.000Z',42])test('invalid expiry is reviewable, not a fabricated expiration '+String(expiresAt),()=>{
 assert.equal(classifyFlowFollowup(record({expiresAt}),now),'attention');
});
for(const received of [null,'invalid','2026-09-24T10:00:00.000Z','2026-09-24T12:00:00.001Z'])test('invalid or impossible reply time does not claim response '+String(received),()=>{
 assert.equal(classifyFlowFollowup(record({reply:{state:'recorded',recordedAt:received}}),now),'attention');
});
test('the exact observation instant is an inclusive expiry boundary',()=>{
 const before='2026-09-24T11:59:59.999Z',at=now,after='2026-09-24T12:00:00.001Z';
 assert.equal(classifyFlowFollowup(record({expiresAt:before}),now),'expired');
 assert.equal(classifyFlowFollowup(record({expiresAt:at}),now),'expired');
 assert.equal(classifyFlowFollowup(record({expiresAt:after}),now),'waiting');
});
test('a recorded reply is independent from whether the link is now expired',()=>{
 const item=record({expiresAt:'2026-09-24T11:45:00.000Z',reply:{state:'recorded',recordedAt:'2026-09-24T11:30:00.000Z'}});
 assert.equal(classifyFlowFollowup(item,now),'responded');
 assert.equal(classifyFlowFollowup({...item,riskDecision:true},now),'attention');
});
test('missing observation and future registration cannot be counted as verified pending work',()=>{
 for(const observed of [null,'',false,'invalid'])assert.equal(classifyFlowFollowup(record(),observed),'attention');
 assert.equal(classifyFlowFollowup(record({recordedAt:'2026-09-24T12:01:00.000Z'}),now),'attention');
 assert.equal(classifyFlowFollowup(record({reply:{state:'not_recorded',recordedAt:now}}),now),'attention');
});
test('each of the 20 observed rows contributes to exactly one independent bucket',async()=>{
 const f=createHistoryFixture();f.messages[0].status='delivered';f.sessions[0].consumedAt=HISTORY_NOW;
 f.messages[1].status='unknown';f.messages[1].providerMessageId=null;
 f.sessions[2].expiresAt=new Date(HISTORY_NOW.getTime()-60000);
 f.messages[3].status='failed';
 const page=await load(f),before=structuredClone(page),summary=summarizeFlowFollowup(page);
 assert.equal(summary.available,true);assert.deepEqual(summary.counts,{all:20,waiting:16,expired:1,attention:2,responded:1});
 assert.equal(Object.entries(summary.counts).filter(([key])=>key!=='all').reduce((sum,[,value])=>sum+value,0),20);
 assert.deepEqual(page,before);assert.equal(summary.items.length,20);
 assert.equal(summary.items[2].category,'expired');assert.equal(summary.items[0].category,'responded');
});
test('counts are page-local, not extrapolated to all stored records',async()=>{
 const f=createHistoryFixture(),first=await load(f),second=await load(f,{cursor:first.nextCursor}),last=await load(f,{cursor:second.nextCursor});
 assert.equal(summarizeFlowFollowup(first).counts.all,20);assert.equal(summarizeFlowFollowup(second).counts.all,20);assert.equal(summarizeFlowFollowup(last).counts.all,6);
 assert.equal(first.nextCursor!==null,true);assert.equal(last.nextCursor,null);
});
test('no query or mutable clock is used to classify the same observed page',async()=>{
 const f=createHistoryFixture(1),page=await load(f),before=f.calls.length;
 const first=summarizeFlowFollowup(page);f.sessions[0].expiresAt=new Date(HISTORY_NOW.getTime()-1);
 assert.deepEqual(summarizeFlowFollowup(page),first);assert.equal(f.calls.length,before);
 assert.equal(summarizeFlowFollowup(await load(f)).counts.expired,1);
});
test('a later explicit observation can change counts without changing message or session rows',async()=>{
 const f=createHistoryFixture(1),before=structuredClone([f.messages,f.sessions]);
 const first=await load(f),later=await load(f,{clock:()=>new Date(HISTORY_NOW.getTime()+7200000)});
 assert.equal(summarizeFlowFollowup(first).counts.waiting,1);assert.equal(summarizeFlowFollowup(later).counts.expired,1);
 assert.deepEqual([f.messages,f.sessions],before);
});
test('malformed pages are unavailable rather than an empty successful result',async()=>{
 const f=createHistoryFixture(1),good=await load(f);
 for(const page of [null,{}, {...good,context:null},{...good,observedAt:'wrong'},{...good,items:null},{...good,items:[...good.items,...good.items]}]){
  const value=summarizeFlowFollowup(page);assert.equal(value.available,false);assert.equal(value.counts,null);assert.deepEqual(value.items,[]);
 }
});
test('a verified empty page has explicit zero counts',async()=>{
 const page=await load(createHistoryFixture(0)),value=summarizeFlowFollowup(page);
 assert.equal(value.available,true);assert.deepEqual(value.counts,{all:0,waiting:0,expired:0,attention:0,responded:0});
});
test('filter catalog has unique keys, safe fallback and no outcome claiming an approval',()=>{
 assert.equal(new Set(FLOW_FOLLOWUP_FILTERS.map(item=>item.key)).size,5);
 for(const option of FLOW_FOLLOWUP_FILTERS)assert.equal(flowFollowupFilter(option.key),option);
 assert.equal(flowFollowupFilter('invalid').key,'all');assert.match(flowFollowupFilter('responded').detail,/No equivale/);
 assert.match(flowFollowupFilter('expired').detail,/no autoriza reenviar/);assert.match(flowFollowupFilter('all').detail,/No representan el total/);
});
