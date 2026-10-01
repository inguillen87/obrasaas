import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fieldTransition,evaluateFieldLocation,normalizeFieldCommand} from '../src/lib/field-operations-policy.mjs';
import {decodeFieldMedia,boundedFieldMultipart} from '../src/lib/field-media.mjs';
import {createFieldHandlers,createFieldMediaHandlers} from '../src/lib/field-operations-http.mjs';
const context={projectId:'p-a',scope:'a'.repeat(64),operationId:randomUUID()},session={authenticated:true,verification:'clerk-production-jwt',userId:'user_A',organizationId:'org_A',organizationRole:'org:member'};
test('enterprise attendance transitions require a current open shift and closed break',()=>{
 assert.deepEqual(fieldTransition('CHECK_IN',null),{phase:'WORKING',closed:false});
 assert.throws(()=>fieldTransition('CHECK_IN',{eventType:'CHECK_IN',phase:'WORKING'}),{code:'ATTENDANCE_SHIFT_ALREADY_OPEN'});
 assert.throws(()=>fieldTransition('BREAK_END',{eventType:'CHECK_IN',phase:'WORKING'}),{code:'ATTENDANCE_BREAK_NOT_OPEN'});
 assert.throws(()=>fieldTransition('CHECK_OUT',{eventType:'BREAK_START',phase:'ON_BREAK'}),{code:'ATTENDANCE_BREAK_OPEN'});
 assert.throws(()=>fieldTransition('CHECK_OUT',null),{code:'ATTENDANCE_SHIFT_NOT_OPEN'});
 assert.equal(fieldTransition('BREAK_END',{eventType:'BREAK_START',phase:'ON_BREAK'}).phase,'WORKING');
});
test('location accuracy, freshness and conservative geofence are independently evaluated',()=>{
 const now=new Date('2026-10-01T14:00:00Z'),sector={latitude:0,longitude:0,radius:30},point={latitude:0,longitude:0,accuracy:20,capturedAt:now.toISOString(),noticeVersion:'field-location-v1'};
 assert.equal(evaluateFieldLocation(point,sector,now).verificationStatus,'VERIFIED');
 assert.equal(evaluateFieldLocation({...point,accuracy:40},sector,now).verificationStatus,'REVIEW_REQUIRED');
 assert.throws(()=>evaluateFieldLocation({...point,accuracy:101},sector,now),{code:'ATTENDANCE_LOCATION_ACCURACY_INVALID'});
 assert.throws(()=>evaluateFieldLocation({...point,capturedAt:'2026-10-01T13:55:00Z'},sector,now),{code:'ATTENDANCE_LOCATION_STALE'});
 assert.throws(()=>evaluateFieldLocation({...point,noticeVersion:null},sector,now),{code:'ATTENDANCE_PRIVACY_NOTICE_REQUIRED'});
});
test('quantitative progress preserves enterprise exact decimals and does not accept inconsistent percentages',()=>{
 const input={...context,action:'PROPOSE_PROGRESS',payload:{workerId:'w-a',taskId:'t-a',revision:'2026-10-01T14:00:00.123456',progress:25,quantity:'2.5',baseline:'10',unit:'M2',reason:'Measured area at the worksite.',evidenceIds:['e-a']}};
 assert.equal(normalizeFieldCommand(input).payload.quantity,'2.5000');
 assert.throws(()=>normalizeFieldCommand({...input,payload:{...input.payload,progress:26}}),{code:'FIELD_QUANTITY_PROGRESS_MISMATCH'});
 assert.throws(()=>normalizeFieldCommand({...input,payload:{...input.payload,quantity:'1e3'}}),{code:'FIELD_QUANTITY_INVALID'});
 assert.throws(()=>normalizeFieldCommand({...input,payload:{...input.payload,evidenceIds:['e-a','e-a']}}),{code:'FIELD_PROGRESS_INVALID'});
});
test('media boundaries reject MIME substitutions, unsupported formats and bodies over limit',async()=>{
 assert.throws(()=>decodeFieldMedia(Buffer.from('arbitrary'),'video/mp4'),{code:'FIELD_MEDIA_INVALID'});
 assert.throws(()=>decodeFieldMedia(Buffer.alloc(3*1024*1024+1),'audio/wav'),{code:'FIELD_MEDIA_TOO_LARGE'});
 const wav=Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(40)]);assert.equal(decodeFieldMedia(wav,'audio/wav').kind,'audio');
 assert.throws(()=>decodeFieldMedia(wav,'audio/mpeg'),{code:'FIELD_MEDIA_INVALID'});
 await assert.rejects(boundedFieldMultipart(new Request('https://obrasaas.com',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=test','Content-Length':String(4*1024*1024)},body:'x'})),{code:'FIELD_MEDIA_TOO_LARGE'});
});
test('HTTP verifies production identity and origin before writing or reading media',async()=>{
 let writes=0;const h=createFieldHandlers({verify:async()=>session,operations:{save:async()=>{writes++;return {saved:true};},read:async()=>({})}});
 const req=origin=>new Request('https://obrasaas.com/api/identity/field-operations',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal((await h.POST(req('https://evil.invalid'))).status,403);assert.equal(writes,0);
 const denied=createFieldMediaHandlers({verify:async()=>({authenticated:false}),media:{download:async()=>{throw new Error('Must not run');}}});
 const response=await denied.GET(new Request('https://obrasaas.com/api/identity/field-media?projectId=p-a&scope='+context.scope+'&evidenceId=e-a'));assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
});
