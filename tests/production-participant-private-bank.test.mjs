import test from 'node:test';
import assert from 'node:assert/strict';
import {participantCommand} from '../src/lib/participant-policy.mjs';
import {scopeStamp} from '../src/lib/workspace-policy.mjs';
import {privateBankNumber,PRIVATE_BANK_NOTICE_VERSION,validatePrivateBankSnapshot,validatePrivateBankOutcome} from '../src/lib/participant-bank-format.mjs';
import {sealPrivateBankAccount,openPrivateBankAccount,privateBankRequestCommitment} from '../src/lib/participant-bank-vault.mjs';
import {bankFixture,bankEnvironment,syntheticBankNumber} from './fixtures/private-bank-fixture.mjs';
const owner={organizationId:'bank-company',projectId:'bank-project',workerId:'bank-worker',actorId:'bank-actor',clerkUserId:'user_BankFixture'};
test('only exact ASCII22 syntax and separate explicit purpose are accepted',()=>{
 const f=bankFixture(),good=f.command();assert.deepEqual(participantCommand(good),good);
 for(const value of [' '+syntheticBankNumber,syntheticBankNumber+' ',syntheticBankNumber.slice(1),syntheticBankNumber+'0','０'.repeat(22),'1e21',null,Number(syntheticBankNumber)]){assert.equal(privateBankNumber(value),null);assert.throws(()=>participantCommand({...good,payload:{...good.payload,number:value}}));}
 for(const payload of [{...good.payload,consent:false},{...good.payload,noticeVersion:'participant-kyc-v1'},{...good.payload,actorId:'another'},{...good.payload,type:'ALIAS'}])assert.throws(()=>participantCommand({...good,payload}));
});
test('vault uses fresh nonce and binds company/worksite/worker/actor/Clerk/revision',()=>{
 const value={type:'CVU',number:syntheticBankNumber},a=sealPrivateBankAccount(value,owner,1,bankEnvironment),b=sealPrivateBankAccount(value,owner,1,bankEnvironment);assert.notEqual(a,b);assert.deepEqual(openPrivateBankAccount(a,owner,1,bankEnvironment),{version:1,...value});
 for(const field of ['organizationId','projectId','workerId','actorId','clerkUserId'])assert.throws(()=>openPrivateBankAccount(a,{...owner,[field]:field==='clerkUserId'?'user_Other':'other-valid-id'},1,bankEnvironment));assert.throws(()=>openPrivateBankAccount(a,owner,2,bankEnvironment));assert.throws(()=>openPrivateBankAccount(a.replace(/.$/,'!'),owner,1,bankEnvironment));
});
test('HMAC commitments cannot be public low-entropy hashes and differ by operation/owner/key',()=>{
 const input=bankFixture().command(),a=privateBankRequestCommitment(input,owner,bankEnvironment);assert.match(a,/^[a-f0-9]{64}$/);assert.equal(a,privateBankRequestCommitment(input,owner,bankEnvironment));assert.notEqual(a,privateBankRequestCommitment({...input,payload:{...input.payload,number:'0'.repeat(22)}},owner,bankEnvironment));assert.notEqual(a,privateBankRequestCommitment(input,{...owner,actorId:'other-actor'},bankEnvironment));assert.notEqual(a,privateBankRequestCommitment(input,owner,{META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,84).toString('base64')}));
});
test('canonical HTTP save/read/replay/remove never exposes raw number or cipher in receipts/roster',async()=>{
 const f=bankFixture(),body=f.command(),saved=await f.post(body),value=await saved.json();assert.equal(saved.status,200);validatePrivateBankOutcome(value,{...body,workerId:f.row.id});assert.equal(value.state,'RECORDED');assert.equal(f.counts.writes,1);
 const read=await f.read(),snapshot=await read.json();validatePrivateBankSnapshot(snapshot,{...body,workerId:f.row.id});assert.equal(snapshot.last4,'0001');assert.equal(snapshot.ownershipVerified,false);assert.match(read.headers.get('cache-control'),/no-store/);assert.equal(read.headers.get('referrer-policy'),'no-referrer');
 const replay=await (await f.post(body)).json();assert.equal(replay.replayed,true);assert.equal(f.counts.writes,1);assert.equal((await (await f.status(body)).json()).receipt.id,value.receipt.id);
 for(const exposed of [value,replay,[...f.audits.values()]]){const raw=JSON.stringify(exposed);assert.equal(raw.includes(syntheticBankNumber),false);assert.equal(raw.includes('"last4"'),false);assert.equal(raw.includes('v2.'),false);}
 const roster=await f.store.read(f.session,{scope:f.scope,projectId:f.projectId});assert.equal(JSON.stringify(roster).includes('privateBankAccount'),false);assert.equal(JSON.stringify(roster).includes('0001'),false);
 const removed=await (await f.post(f.command('REMOVE_PRIVATE_BANK_ACCOUNT'))).json();assert.equal(removed.state,'RECORDED');assert.equal(f.row.metadata.participant.privateBankAccount.envelope,null);const empty=await (await f.read()).json();assert.equal(empty.state,'REMOVED');assert.equal(empty.last4,null);assert.equal(empty.type,null);assert.equal(f.counts.remote,0);
});
test('stale CAS produces exact durable REJECTED before any write; changed digest cannot reuse it',async()=>{
 const f=bankFixture(),body=f.command();body.payload.expectedBankRevision=2;const value=await (await f.post(body)).json();assert.equal(value.state,'REJECTED');assert.equal(value.receipt.code,'PARTICIPANT_BANK_REVISION_CHANGED');assert.equal(f.counts.writes,0);assert.equal(f.audits.size,1);assert.equal((await (await f.status(body)).json()).state,'REJECTED');assert.equal((await (await f.post(body)).json()).replayed,true);
 const other=await f.post({...body,payload:{...body.payload,expectedBankRevision:0}});assert.equal(other.status,409);assert.equal((await other.json()).code,'PARTICIPANT_OPERATION_CONFLICT');assert.equal(f.counts.writes,0);
});
test('same canonical values in a different JSON key order recover one HMAC receipt',async()=>{
 const f=bankFixture(),body=f.command(),first=await (await f.post(body)).json();
 const reordered=Object.fromEntries(Object.entries(body).reverse());reordered.payload=Object.fromEntries(Object.entries(body.payload).reverse());
 const replay=await (await f.post(reordered)).json();assert.equal(replay.state,'RECORDED');assert.equal(replay.replayed,true);assert.equal(replay.receipt.id,first.receipt.id);assert.equal(f.counts.writes,1);
 const changed={...reordered,payload:{...reordered.payload,number:'0'.repeat(22)}};assert.equal((await f.post(changed)).status,409);assert.equal(f.counts.writes,1);assert.equal(f.audits.size,1);
});
test('cancel exact pending UUID fences delayed producer and cannot cancel a different worker/action',async()=>{
 const f=bankFixture(),body=f.command(),cancel={...body,action:'CANCEL_PENDING_PRIVATE_BANK_ACCOUNT',payload:{workerId:f.row.id,originalAction:body.action,confirmed:true}};assert.equal((await (await f.status(body)).json()).state,'NOT_OBSERVED');const terminal=await (await f.post(cancel)).json();assert.equal(terminal.state,'CANCELLED');assert.equal(terminal.operationId,body.operationId);assert.equal(terminal.action,body.action);assert.equal(f.counts.writes,0);
 assert.equal((await (await f.post(body)).json()).state,'CANCELLED');assert.equal((await (await f.status(body)).json()).state,'CANCELLED');assert.equal(f.counts.writes,0);
 assert.equal((await f.post({...cancel,payload:{...cancel.payload,originalAction:'REMOVE_PRIVATE_BANK_ACCOUNT'}})).status,409);assert.equal((await f.post({...cancel,payload:{...cancel.payload,workerId:'foreign-worker'}})).status,403);
 const newBody=f.command();assert.equal((await (await f.post(newBody)).json()).state,'RECORDED');assert.equal(f.counts.writes,1);
});
test('cancelling an already recorded operation returns its exact receipt without deleting account',async()=>{
 const f=bankFixture(),body=f.command(),first=await (await f.post(body)).json(),cancel={...body,action:'CANCEL_PENDING_PRIVATE_BANK_ACCOUNT',payload:{workerId:f.row.id,originalAction:body.action,confirmed:true}};const last=await (await f.post(cancel)).json();assert.equal(last.state,'RECORDED');assert.equal(last.receipt.id,first.receipt.id);assert.equal(f.counts.writes,1);assert.equal((await (await f.read()).json()).state,'DECLARED');
});
for(const change of ['worker-revoked','inactive','assignment','tenant','kyc','self-review','review-receipt','submission-receipt','foreign-owner'])test(`private bank read and replay require current approved own identity: ${change}`,async()=>{
 const f=bankFixture(),body=f.command();await f.post(body);const before=f.counts.writes;
 if(change==='worker-revoked')f.row.metadata.participant.status='REVOKED';if(change==='inactive')f.row.active=false;if(change==='assignment')f.setAssigned(false);if(change==='tenant')f.setMembership(false);if(change==='kyc')f.row.metadata.participant.kyc.status='REJECTED';if(change==='self-review')f.row.metadata.participant.kyc.review.actorId=f.member.actorId;if(change==='review-receipt')f.reviews.pop();if(change==='submission-receipt')f.submissions.pop();if(change==='foreign-owner')f.row.metadata.participant.clerkUserId='user_Foreign';
 for(const call of [()=>f.read(),()=>f.status(body),()=>f.post(body)]){const response=await call();assert.ok([403,404].includes(response.status));const denied=await response.json();assert.equal(denied.receipt,undefined);assert.equal(denied.last4,undefined);}
 assert.equal(f.counts.writes,before);assert.equal(f.counts.remote,0);
});
test('ADMIN cannot obtain another participant bank by office privilege and Clerk role spoof does not grant it',async()=>{
 const f=bankFixture();f.member.role='ADMIN';f.session.organizationRole='org:admin';f.row.metadata.participant.clerkUserId='user_Other';const response=await f.read({scope:scopeStamp(f.session,f.member)});assert.equal(response.status,403);assert.equal((await response.json()).last4,undefined);assert.equal(f.audits.size,0);
});
test('HTTP exact detail contract rejects untrusted fields and wrong origin before bank write',async()=>{
 const f=bankFixture(),base={projectId:f.projectId,scope:f.scope,detail:'private-bank-account',workerId:f.row.id};for(const params of [{...base,imageId:'bank'},{...base,number:syntheticBankNumber},{...base,detail:'bank'},{...base,action:'SAVE_PRIVATE_BANK_ACCOUNT'}])assert.equal((await f.handlers.GET(f.request(params))).status,400);
 const response=await f.handlers.POST(f.request(null,{method:'POST',headers:{origin:'https://foreign.invalid','content-type':'application/json'},body:JSON.stringify(f.command())}));assert.equal(response.status,403);assert.equal(f.counts.writes,0);assert.equal(f.audits.size,0);assert.equal(f.counts.remote,0);
});
test('strict browser DTO refuses foreign/forged generic saved rejection and accidental sensitive fields',async()=>{
 const f=bankFixture(),body=f.command(),good=await (await f.post(body)).json(),reference={...body,workerId:f.row.id};validatePrivateBankOutcome(good,reference);
 for(const value of [{...good,scope:'f'.repeat(64)},{...good,action:'REMOVE_PRIVATE_BANK_ACCOUNT'},{...good,receipt:{...good.receipt,workerId:'foreign-worker'}},{...good,receipt:{...good.receipt,actorId:'foreign-actor'}},{...good,receipt:{...good.receipt,organizationId:'foreign-company'}},{...good,state:'REJECTED',saved:false,receipt:{...good.receipt,state:'REJECTED',code:null}},{...good,number:syntheticBankNumber},{scope:f.scope,saved:true,receiptId:good.receipt.id}])assert.throws(()=>validatePrivateBankOutcome(value,reference));
 assert.equal(PRIVATE_BANK_NOTICE_VERSION,'participant-private-bank-v1');
});
