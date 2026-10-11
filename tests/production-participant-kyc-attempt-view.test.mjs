import test from 'node:test';
import assert from 'node:assert/strict';
import {participantKycChatAttemptView,participantKycChatAttemptDate} from '../src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs';
const context={scope:'a'.repeat(64),projectId:'project-a',workerId:'worker-a',challengeId:'kyc_chat_'+'a'.repeat(32)};
const result=(attempt={})=>({detail:'kyc-chat-attempt',...context,kycChatAttempt:{version:1,state:'OBSERVED',receivedAt:'2026-10-10T21:25:15.000Z',processingState:'PROCESSED',rejected:true,reason:'CODE_MISMATCH',codeSyntax:true,codeMatch:false,senderMatch:true,preparationReceiptMatch:true,sameSecond:false,...attempt}});
test('diagnostic copy describes current code and registered sender without displaying private material',()=>{
 const view=participantKycChatAttemptView({...result(),phone:'+5491199999999',code:'IDENTIDAD private',payload:'private'},context);
 assert.match(view.description,/código no coincide con el vigente/);
 assert.deepEqual(view.checks,{codeSyntax:true,codeMatch:false,senderMatch:true,preparationReceiptMatch:true});
 assert.doesNotMatch(JSON.stringify(view),/IDENTIDAD private|5491199999999|payload|private/);
 const wrongSender=participantKycChatAttemptView(result({reason:'SENDER_MISMATCH',codeMatch:true,senderMatch:false}),context);
 assert.match(wrongSender.description,/teléfono distinto del registrado/);
 assert.doesNotMatch(wrongSender.description,/reenvi|aprobad|verificad|permiso/i);
});
test('absence is bounded and inconclusive; unavailable does not invent a cause',()=>{
 const absent=participantKycChatAttemptView(result({state:'NOT_OBSERVED'}),context);
 assert.match(absent.description,/últimos 20 mensajes/);assert.match(absent.description,/intentos anteriores/);
 assert.equal(absent.checks,undefined);assert.equal(absent.receivedAt,undefined);
 const unavailable=participantKycChatAttemptView(result({state:'UNAVAILABLE'}),context);
 assert.match(unavailable.description,/No se pudo comprobar/);assert.equal(unavailable.checks,undefined);
});
test('receipt failure and another guard remain distinct from code or sender failure',()=>{
 assert.match(participantKycChatAttemptView(result({reason:'PREPARATION_RECEIPT_UNCONFIRMED',codeMatch:true,preparationReceiptMatch:false}),context).description,/recibo de preparación/);
 assert.match(participantKycChatAttemptView(result({reason:'CHALLENGE_REJECTED',codeMatch:true}),context).description,/Otra comprobación/);
 assert.match(participantKycChatAttemptView(result({reason:'SAME_SECOND_UNCONFIRMED',sameSecond:true}),context).description,/requiere revisión/);
 for(const reason of ['CODE_FORMAT','CODE_MISMATCH','OTHER_RESULT']){
  const ambiguous=participantKycChatAttemptView(result({reason,sameSecond:true}),context);
  assert.match(ambiguous.description,/No pudimos separar la preparación/);
  assert.doesNotMatch(ambiguous.description,/su código no coincide|no conserva el formato|sigue pendiente/);
 }
});
test('processing completion never asserts WhatsApp delivery',()=>{
 const processed=participantKycChatAttemptView(result({reason:'OTHER_RESULT',rejected:false}),context);
 assert.match(processed.description,/comprobación independiente/);
 assert.match(participantKycChatAttemptView(result({reason:'OTHER_RESULT',rejected:false,processingState:'PENDING'}),context).description,/pendiente de procesamiento/);
});
test('stale participant, tenant scope or project and invalid observations fail closed',()=>{
 for(const change of [{workerId:'worker-b'},{projectId:'project-b'},{scope:'b'.repeat(64)},{challengeId:'kyc_chat_'+'b'.repeat(32)},{challengeId:undefined},{detail:'private-bank-account'}])assert.throws(()=>participantKycChatAttemptView({...result(),...change},context),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
 assert.throws(()=>participantKycChatAttemptView(result(),{...context,challengeId:undefined}),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
 for(const change of [{state:'DELIVERED'},{version:2},{receivedAt:'invalid'},{processingState:'SENT'},{reason:'provider-secret'},{codeMatch:'true'},{senderMatch:null},{rejected:undefined},{sameSecond:0}])assert.throws(()=>participantKycChatAttemptView(result(change),context));
});
test('signed UTC time renders Argentina consistently across process zones',()=>{
 const previous=process.env.TZ;try{
  for(const tz of ['UTC','America/Argentina/Buenos_Aires','Pacific/Kiritimati']){process.env.TZ=tz;assert.match(participantKycChatAttemptDate('2026-10-10T21:25:15.000Z'),/10\/10\/2026.*18:25:15 \(hora de Argentina\)/);}
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
