import assert from 'node:assert/strict';
import { createFlowAttendanceFixture, attendanceScope, attendanceAccess, ATTENDANCE_NOW } from '../../tests/helpers/flow-attendance-fixture.js';
import { ensurePendingGeoAttendance, ATTENDANCE_GEO_WINDOW_MS } from '../../src/lib/attendance.js';
import { buildFlowAttendanceReceipt, flowAttendancePresentation } from '../../src/lib/whatsapp/flow-attendance-policy.js';
import { getWhatsAppFlowBlueprint } from '../../src/lib/whatsapp/flows.js';
import { readProactiveFlowAttendance } from '../../src/lib/whatsapp/flow-attendance.js';

// Called only by the existing loopback/disposable history verifier, after its own cases.
export async function verifyFlowAttendanceRead(db) {
  const f=createFlowAttendanceFixture(),scope=attendanceScope,cases=[];
  const check=async(name,fn)=>{await fn();cases.push({name,status:'PASS'});console.log('PASS '+name);};
  const snap=async()=>JSON.stringify({entries:await db.attendanceEntry.findMany({orderBy:{id:'asc'}}),shifts:await db.attendanceShift.findMany({orderBy:{id:'asc'}}),messages:await db.message.findMany({orderBy:{id:'asc'}}),sessions:await db.whatsAppFlowSession.findMany({orderBy:{id:'asc'}}),audits:await db.auditLog.count()});
  const read=changes=>readProactiveFlowAttendance({prisma:db,access:attendanceAccess,conversationId:scope.conversationId,messageId:f.source.id,clock:()=>ATTENDANCE_NOW,...changes});
  await db.worker.create({data:{id:f.session.workerId,projectId:scope.projectId,organizationId:scope.organizationId,name:'Persona sintética de ingreso',active:true}});
  const entry=await ensurePendingGeoAttendance(db,{projectId:scope.projectId,workerId:f.session.workerId,now:f.session.consumedAt,source:'meta',idempotencyKey:'synthetic-attendance-link',timezone:'America/Argentina/Buenos_Aires'});
  const blueprint=getWhatsAppFlowBlueprint('shift-check-in');
  await db.message.create({data:{...f.source,body:'Formulario de ingreso de ensayo'}});
  await db.whatsAppFlowSession.create({data:{...f.session,phoneNumberId:'555555555555555',recipientPhone:'5495555555555',flowId:'666666666666666',screenId:blueprint.screenId,flowType:'attendance',tokenSha256:'d'.repeat(64),expiresAt:new Date(ATTENDANCE_NOW.getTime()+3600000),deliveryAttemptedAt:f.session.sentAt}});
  f.inbound.metadata.flowAttendanceReceipt=buildFlowAttendanceReceipt(entry,f.session);
  await db.message.create({data:f.inbound});
  await check('attendance: exact stored entry and privacy on real PostgreSQL',async()=>{const before=await snap(),result=await read({});assert.equal(result.state,'available');assert.equal(result.entry.id,entry.id);assert.equal(result.entry.verificationStatus,'PENDING');for(const text of ['latitude','longitude','recipient','worker-a','wamid.','PRIVATE_','evidence'])assert.equal(JSON.stringify(result).includes(text),false);assert.equal(await snap(),before);});
  await check('attendance: an expired deadline is observed without writing to the ledger',async()=>{const before=await snap(),result=await read({clock:()=>new Date(new Date(entry.occurredAt).getTime()+ATTENDANCE_GEO_WINDOW_MS+1000)});assert.equal(flowAttendancePresentation(result.entry,result.observedAt).label,'Plazo de ubicación vencido');assert.equal(await snap(),before);});
  await check('attendance: receipt cannot substitute a foreign or absent entry',async()=>{await db.message.update({where:{id:f.inbound.id},data:{metadata:{...f.inbound.metadata,flowAttendanceReceipt:{...f.inbound.metadata.flowAttendanceReceipt,entryId:'other-entry'}}}});const before=await snap();assert.equal((await read({})).state,'unavailable');assert.equal(await snap(),before);});
  await check('attendance: legacy inbound without link is not backfilled from same worker/date',async()=>{const metadata={...f.inbound.metadata};delete metadata.flowAttendanceReceipt;await db.message.update({where:{id:f.inbound.id},data:{metadata}});const before=await snap();assert.equal((await read({})).state,'unlinked');assert.equal(await snap(),before);});
  await db.message.update({where:{id:f.inbound.id},data:{metadata:f.inbound.metadata}});
  await check('attendance: tenant denial uses the existing opaque conversation boundary',async()=>{const before=await snap();await assert.rejects(read({access:{...attendanceAccess,organization:{id:'organization-a-foreign'}}}),{code:'INBOX_CONVERSATION_NOT_FOUND'});assert.equal(await snap(),before);});
  await check('attendance: repeated reads leave messages, sessions and attendance unchanged',async()=>{const before=await snap();await read({});await read({});assert.equal(await db.whatsAppConnection.count(),0);assert.equal(await snap(),before);});
  return cases;
}
