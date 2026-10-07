import test from 'node:test';
import assert from 'node:assert/strict';
import {publicFieldEvidence} from '../src/lib/field-operations-store.mjs';
const row=(processing,readAt)=>({id:'evidence-a',title:'Evidencia privada',description:'Detalle',revision:'2026-10-07T12:00:00.000001',readAt,metadata:{fieldOperations:{version:1,kind:'EVIDENCE',taskId:'task-a',workerId:'worker-a',sectorId:'sector-a',capturedAt:'2026-10-07T12:00:00Z',media:{kind:'audio',contentType:'audio/wav',bytes:4096,sha256:'a'.repeat(64),pathname:'private-original',url:'https://private-original'},processing,review:null}}});
test('public media projection uses the database observation for expired leases and withholds internal claim authority',()=>{
 const processing={status:'RUNNING',startedAt:'2026-10-07T12:00:00.000Z',expiresAt:'2026-10-07T12:01:30.000Z',actorId:'private-actor',operationId:'private-operation',requestDigest:'private-digest',leaseId:'private-lease',unknown:'private-extra'};
 const live=publicFieldEvidence(row(processing,new Date('2026-10-07T12:01:29.999Z'))),expired=publicFieldEvidence(row(processing,new Date('2026-10-07T12:01:30.000Z')));
 assert.equal(live.processing.leaseExpired,false);assert.equal(expired.processing.leaseExpired,true);
 for(const evidence of [live,expired]){for(const key of ['actorId','operationId','requestDigest','leaseId','unknown'])assert.equal(Object.hasOwn(evidence.processing,key),false);assert.equal(Object.hasOwn(evidence.media,'url'),false);assert.equal(Object.hasOwn(evidence.media,'pathname'),false);}
});
test('unknown observation or malformed lease cannot present a retry as confirmed expired',()=>{
 for(const [expiresAt,readAt]of [['2026-10-07T12:01:30.000Z',undefined],['2026-10-07T12:01:30.000Z','2026-10-07T12:01:31.000Z'],['invalid',new Date('2026-10-07T12:01:31Z')],['2026-10-07T12:01:30.000Z',new Date('invalid')]])assert.equal(publicFieldEvidence(row({status:'RUNNING',expiresAt},readAt)).processing.leaseExpired,false);
});
test('finished analysis and private human review keep their public result while dropping obsolete lease fields',()=>{
 const result={success:true,status:'TRANSCRIBED_UNREVIEWED',text:'Texto por revisar'},analysisConsent={allowed:true,noticeVersion:'version',noticeSha256:'b'.repeat(64)};
 const input=row({status:'TRANSCRIBED_UNREVIEWED',result,humanReviewRequired:true,analysisConsent,completedAt:'2026-10-07T12:00:30Z',leaseId:'old-secret'});input.metadata.fieldOperations.review={decision:'APPROVE',reason:'Revisado contra el original',recordedAt:'2026-10-07T12:02:00Z',actorId:'reviewer-private'};
 const value=publicFieldEvidence(input);assert.equal(value.status,'APPROVED');assert.deepEqual(value.processing.result,result);assert.deepEqual(value.processing.analysisConsent,analysisConsent);assert.equal(Object.hasOwn(value.processing,'leaseId'),false);assert.equal(Object.hasOwn(value.processing,'leaseExpired'),false);assert.equal(Object.hasOwn(value.review,'actorId'),false);
});
