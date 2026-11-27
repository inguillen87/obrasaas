import test from 'node:test';
import assert from 'node:assert/strict';
import {readAttendanceClosureLedger} from '../src/lib/attendance-closure-store.mjs';
import {readScopedAttendanceAnnotations} from '../src/lib/attendance-effective-store.mjs';
for(const selected of [true,false])test((selected?'directed checkpoint':'global person')+' reader rejects an extra author in any retained ancestor before certifying audit evidence',async()=>{
 const old={id:'old-mark',projectId:'project-a',workerId:'worker-a',metadata:{fieldOperations:{recordedBy:'actor-a',shiftId:'old-shift'}}},next={id:'new-mark',projectId:'project-a',workerId:'worker-a',metadata:{fieldOperations:{recordedBy:'actor-a',shiftId:'new-shift',previousClosureCheckpoint:{sourceProjectId:'project-a',sourceWorkerId:'worker-a',sourceShiftId:'old-shift'}}}},foreign={...structuredClone(old),id:'foreign-mark'};foreign.metadata.fieldOperations.recordedBy='actor-b';let sourceChecks=0;
 const client={async query(sql,args){if(sql.startsWith('WITH RECURSIVE ')||sql.includes("recordedBy'=$2 ORDER BY"))return {rows:[old,next]};if(sql.startsWith('SELECT id FROM public."AuditLog"'))return {rows:[]};if(sql.includes('jsonb_to_recordset($2::jsonb)')){sourceChecks++;assert.deepEqual(JSON.parse(args[1]).map(key=>key.shiftId).sort(),['new-shift','old-shift']);return {rows:[old,next,foreign]};}throw new Error('No certification query may follow the incomplete source-set proof: '+sql);}};
 await assert.rejects(readAttendanceClosureLedger(client,{organizationId:'company-a',actorId:'actor-a',observedAt:'2026-11-02T12:00:00.000Z',...(selected?{journeyKeys:[{projectId:'project-a',workerId:'worker-a',shiftId:'new-shift'}]}:{})}),{code:'ATTENDANCE_SOURCE_SET_MISMATCH'});assert.equal(sourceChecks,1);
});
for(const value of [null,42,'bad worker id'])test('a present '+JSON.stringify(value)+' correction key remains ambiguous to navigation',async()=>{
 const client={async query(sql){return {rows:sql.includes('public."AuditLog"')?[{id:'unlocatable',metadata:{workerId:value,shiftId:'shift-a'}}]:[]};}},out=await readScopedAttendanceAnnotations(client,{organizationId:'company-a',projectId:'project-a',shifts:[{workerId:'worker-a',shiftId:'shift-a'}]});assert.equal(out.ambiguous,true);
});
