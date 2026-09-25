import assert from 'node:assert/strict';
import { seedFlowIncidentFixture,flowIncidentFixtureSnapshot } from './flow-incident-fixture.mjs';
import { readProactiveFlowIncident } from '../../src/lib/whatsapp/flow-incident.js';
import { historyScope,historyAccess,HISTORY_NOW } from '../../tests/helpers/flow-history-fixture.js';
export async function verifyFlowIncidentRead(db){
 const scope={organizationId:historyScope.organizationId,projectId:historyScope.projectId},cases=[];
 const f=await db.$transaction(tx=>seedFlowIncidentFixture(tx,{scope,prefix:'sql_incident',now:HISTORY_NOW}),{timeout:15000});
 const read=changes=>readProactiveFlowIncident({prisma:db,access:historyAccess,conversationId:f.conversationId,messageId:f.rows[0].sourceId,clock:()=>HISTORY_NOW,...changes});
 const snap=()=>flowIncidentFixtureSnapshot(db,f),check=async(name,fn)=>{await fn();cases.push({name,status:'PASS'});console.log('PASS '+name);};
 await check('incident: engine-produced receipt and current snapshot read without mutations',async()=>{const before=await snap(),r=await read({});assert.equal(r.state,'available');assert.equal(r.incident.id,f.rows[0].incidentId);assert.equal(r.incident.status,'unclassified');assert.equal(JSON.stringify(r).includes('PRIVATE_INCIDENT_CANARY'),false);assert.deepEqual(await snap(),before);});
 await check('incident: legacy reply cannot infer a link even with its incident present',async()=>{const before=await snap();assert.equal((await read({messageId:f.rows[1].sourceId})).state,'unlinked');assert.deepEqual(await snap(),before);});
 const inbound=await db.message.findUnique({where:{id:f.rows[0].replyId}});
 await check('incident: another event receipt cannot substitute a valid snapshot row',async()=>{await db.message.update({where:{id:inbound.id},data:{metadata:{...inbound.metadata,flowIncidentReceipt:{...inbound.metadata.flowIncidentReceipt,incidentId:f.rows[1].incidentId}}}});const before=await snap();assert.equal((await read({})).state,'unavailable');assert.deepEqual(await snap(),before);});
 await db.message.update({where:{id:inbound.id},data:{metadata:inbound.metadata}});
 const snapshot=await db.projectSnapshot.findUnique({where:{projectId:scope.projectId}});
 await check('incident: current resolution state is observed, no inferred resolution timestamp',async()=>{const state=structuredClone(snapshot.state);state.incidents.find(row=>row.id===f.rows[0].incidentId).status='resolved';await db.projectSnapshot.update({where:{projectId:scope.projectId},data:{state,version:{increment:1},updatedAt:HISTORY_NOW}});const before=await snap(),r=await read({});assert.equal(r.incident.status,'resolved');assert.equal(Object.hasOwn(r.incident,'resolvedAt'),false);assert.deepEqual(await snap(),before);});
 await check('incident: removed source record remains unavailable, never replaced by a recent incident',async()=>{const state=structuredClone(snapshot.state);state.incidents=state.incidents.filter(row=>row.id!==f.rows[0].incidentId);await db.projectSnapshot.update({where:{projectId:scope.projectId},data:{state,updatedAt:HISTORY_NOW}});const before=await snap();assert.equal((await read({})).state,'unavailable');assert.deepEqual(await snap(),before);});
 await db.projectSnapshot.update({where:{projectId:scope.projectId},data:{state:snapshot.state,updatedAt:HISTORY_NOW}});
 await check('incident: other tenant cannot read the exact known identifier',async()=>{const before=await snap();await assert.rejects(read({access:{...historyAccess,organization:{id:'organization-a-foreign'}}}),{code:'INBOX_CONVERSATION_NOT_FOUND'});assert.deepEqual(await snap(),before);});
 await check('incident: duplicate synthetic preparation rolls back without altering existing state',async()=>{const before=await snap();await assert.rejects(db.$transaction(tx=>seedFlowIncidentFixture(tx,{scope,prefix:'sql_incident',now:HISTORY_NOW}),{timeout:15000}));assert.deepEqual(await snap(),before);assert.equal(await db.whatsAppConnection.count(),0);});
 return cases;
}
