import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

// Compile the actual client file in memory. No browser, provider or storage runs.
await loadBindings();
const source=readFileSync(new URL('../src/app/(identity)/cuenta/participant-panel.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const compiled=await transform(source,{filename:'participant-panel.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const capabilitiesUrl=new URL('../src/app/(identity)/cuenta/participant-onboarding-next-step.mjs',import.meta.url).href;
const loaded=await import('data:text/javascript;base64,'+Buffer.from('import {participantKycChatCapabilities} from '+JSON.stringify(capabilitiesUrl)+';\n'+compiled.code).toString('base64'));
const {participantKycChatDate,participantKycChatPreparationValid,participantKycChatCodeMatches,participantKycChatCodeAfterSnapshot}=loaded;

const scope='a'.repeat(64),projectId='project-a',workerId='worker-a',challengeId='kyc_chat_'+'a'.repeat(32),otherChallengeId='kyc_chat_'+'b'.repeat(32),expiresAt='2026-10-10T21:06:00.000Z';
const code='IDENTIDAD '+'x'.repeat(43);
function fixture(){
 const challenge={projectId,scope,workerId,challengeId,code,codeUnavailable:false,expiresAt};
 const current={id:challengeId,status:'PENDING',expiresAt,conversationExpiresAt:null,expired:false,canPrepare:false,canCancel:false,blockedCode:'PARTICIPANT_KYC_CHAT_NOT_CANCELLABLE',step:null,recoveryRequired:false,claimedAt:null,closedAt:null};
 const snapshot={projectId,scope,canManage:true,records:[{id:workerId,active:true,status:'ACTIVE',kyc:{status:'NOT_SUBMITTED'},kycChatChallenge:current}]};
 return {challenge,current,snapshot,context:{projectId,scope,workerId,snapshot}};
}

test('only a fresh preparation with its exact challenge ID can carry a copyable code',()=>{
 const fresh={kind:'PREPARE_KYC_CHAT',challengeId,code,codeUnavailable:false,expiresAt};
 assert.equal(participantKycChatPreparationValid(fresh),true);
 for(const change of [{challengeId:undefined},{challengeId:null},{challengeId:'worker-a'},{challengeId:'kyc_chat_'+'A'.repeat(32)},{challengeId:[challengeId]},{codeUnavailable:'false'},{code:'IDENTIDAD short'},{code:[code]},{expiresAt:'invalid'},{expiresAt:[expiresAt]},{kind:'CANCEL_KYC_CHAT'}])assert.equal(participantKycChatPreparationValid({...fresh,...change}),false);
});

test('legacy recovery consumes a secretless receipt even without a challenge ID and never makes it copyable',()=>{
 const recovery={kind:'PREPARE_KYC_CHAT',codeUnavailable:true,expiresAt};
 for(const id of [undefined,null,challengeId])assert.equal(participantKycChatPreparationValid({...recovery,challengeId:id}),true);
 assert.equal(participantKycChatPreparationValid({...recovery,code}),false);
 assert.equal(participantKycChatPreparationValid({...recovery,challengeId:'worker-other'}),false);
 const f=fixture();for(const id of [undefined,null])assert.equal(participantKycChatCodeMatches({...f.challenge,challengeId:id,code:undefined,codeUnavailable:true},f.context),false);
});

test('same challenge snapshot preserves the exact one-time string without altering either object',()=>{
 const f=fixture(),before=JSON.stringify(f);
 assert.equal(participantKycChatCodeMatches(f.challenge,f.context),true);
 assert.equal(participantKycChatCodeAfterSnapshot(f.challenge,f.snapshot,{projectId,scope}),f.challenge);
 assert.equal(JSON.stringify(f),before);assert.equal(f.challenge.code,code);
});

test('a new challenge on the same worker and even the same expiry discards the old code permanently',()=>{
 const f=fixture(),original=JSON.stringify(f.challenge);f.current.id=otherChallengeId;
 assert.equal(participantKycChatCodeMatches(f.challenge,f.context),false);
 const discarded=participantKycChatCodeAfterSnapshot(f.challenge,f.snapshot,{projectId,scope});assert.equal(discarded,null);
 f.current.id=challengeId;assert.equal(participantKycChatCodeAfterSnapshot(discarded,f.snapshot,{projectId,scope}),null);
 assert.equal(JSON.stringify(f.challenge),original,'The old value is rejected, not mutated into the new challenge');
});

test('copy-time revalidation rejects a previously accepted value against the newest context',()=>{
 const f=fixture(),latest={current:f.context},isCurrent=()=>participantKycChatCodeMatches(f.challenge,latest.current||{});
 assert.equal(isCurrent(),true);latest.current={...f.context,snapshot:{...f.snapshot,records:[{...f.snapshot.records[0],kycChatChallenge:{...f.current,id:otherChallengeId}}]}};
 assert.equal(isCurrent(),false);latest.current=null;assert.equal(isCurrent(),false);
});

for(const [name,change]of [
 ['missing projection',f=>{delete f.snapshot.records[0].kycChatChallenge;}],
 ['malformed projection',f=>{f.current.expired='false';}],
 ['malformed local challenge ID',f=>{f.challenge.challengeId=[challengeId];}],
 ['malformed local code',f=>{f.challenge.code=[code];}],
 ['missing worker',f=>{f.snapshot.records=[];}],
 ['malformed worker',f=>{f.snapshot.records=[null];}],
 ['ambiguous worker',f=>{f.snapshot.records.push(structuredClone(f.snapshot.records[0]));}],
 ['inactive worker',f=>{f.snapshot.records[0].active=false;}],
 ['revoked participant',f=>{f.snapshot.records[0].status='REVOKED';}],
 ['missing manager permission',f=>{f.snapshot.canManage=false;}],
 ['different snapshot scope',f=>{f.snapshot.scope='b'.repeat(64);}],
 ['different snapshot project',f=>{f.snapshot.projectId='project-other';}],
 ['different selected worker',f=>{f.context.workerId='worker-other';}],
 ['different local scope',f=>{f.challenge.scope='b'.repeat(64);}],
 ['different local project',f=>{f.challenge.projectId='project-other';}],
 ['different expiry',f=>{f.current.expiresAt='2026-10-10T22:06:00.000Z';}],
 ['identity already submitted',f=>{f.snapshot.records[0].kyc.status='PENDING_REVIEW';}],
])test('unknown or changed '+name+' cannot expose a one-time code',()=>{
 const f=fixture();change(f);assert.equal(participantKycChatCodeMatches(f.challenge,f.context),false);
});

for(const status of ['CLAIMED','COMPLETED','CANCELLED','CLOSED','INVALID'])test('current '+status+' challenge cannot reuse its initiation code',()=>{
 const f=fixture();f.current.status=status;if(status==='CLAIMED')f.current.conversationExpiresAt='2026-10-10T20:36:00.000Z';
 assert.equal(participantKycChatCodeMatches(f.challenge,f.context),false);assert.equal(participantKycChatCodeAfterSnapshot(f.challenge,f.snapshot,{projectId,scope}),null);
});

test('expiry preserves only the matching presentation guidance and does not extend its deadline',()=>{
 const f=fixture();f.challenge={...f.challenge,code:undefined,expired:true};f.current.expired=true;
 assert.equal(participantKycChatCodeMatches(f.challenge,f.context),true);assert.equal(f.challenge.expiresAt,expiresAt);
 f.current.id=otherChallengeId;assert.equal(participantKycChatCodeMatches(f.challenge,f.context),false);
});

test('KYC expiry displays Argentina explicitly without changing timestamps or depending on process zone',()=>{
 const previous=process.env.TZ;try{
  for(const zone of ['UTC','America/Argentina/Buenos_Aires','Pacific/Kiritimati']){process.env.TZ=zone;assert.match(participantKycChatDate(expiresAt),/10\/10\/2026.*18:06:00 \(hora de Argentina\)/);}
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
 assert.equal(participantKycChatDate('invalid'),'Plazo sin confirmar');assert.equal(expiresAt,'2026-10-10T21:06:00.000Z');
});
