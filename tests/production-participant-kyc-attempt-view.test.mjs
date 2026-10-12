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
const reply=(state,recordedAt='2026-10-10T21:25:18.000Z')=>({version:1,state,recordedAt});
test('Meta API acceptance is separate from delivery and cannot approve participant identity',()=>{
 const view=participantKycChatAttemptView(result({replyDelivery:reply('API_ACCEPTED')}),context);
 assert.equal(view.replyDelivery.state,'API_ACCEPTED');
 assert.equal(view.replyDelivery.response.description,'Meta aceptó la respuesta; todavía no hay comprobación de entrega.');
 assert.equal(view.replyDelivery.delivery.confirmed,false);assert.equal(view.replyDelivery.delivery.label,'Entrega sin comprobar');
 assert.equal(view.replyDelivery.dateSource,'SERVER');assert.equal(view.replyDelivery.recordedAt,'2026-10-10T21:25:18.000Z');
 assert.doesNotMatch(view.replyDelivery.response.description,/identidad aprobada|permiso concedido|entrega comprobada/i);
});
test('only correlated DELIVERED and READ states assert receipt or reading with WhatsApp-reported time',()=>{
 for(const [state,label] of [['DELIVERED','Entrega comprobada'],['READ','Lectura comprobada']]){
  const view=participantKycChatAttemptView(result({replyDelivery:reply(state,'2026-10-10T21:26:20.000Z')}),context);
  assert.equal(view.replyDelivery.delivery.confirmed,true);assert.equal(view.replyDelivery.delivery.label,label);
  assert.equal(view.replyDelivery.dateSource,'WHATSAPP');assert.equal(view.replyDelivery.recordedAt,'2026-10-10T21:26:20.000Z');
  assert.notEqual(view.replyDelivery.recordedAt,view.receivedAt);
 }
});
test('pending, unknown, rejected, failed and closed states remain distinct without a resend action',()=>{
 const labels=new Set();
 for(const state of ['RESERVED','SEND_UNKNOWN','API_REJECTED','FAILED','WINDOW_CLOSED','UNAVAILABLE','NOT_OBSERVED']){
  const value=reply(state,['WINDOW_CLOSED','UNAVAILABLE','NOT_OBSERVED'].includes(state)?null:undefined),view=participantKycChatAttemptView(result({replyDelivery:value}),context);
  labels.add(view.replyDelivery.response.label);assert.equal(view.replyDelivery.delivery.confirmed,false);
  assert.doesNotMatch(JSON.stringify(view.replyDelivery),/reenviar|consentimiento|identidad aprobada|permiso concedido/i);
  assert.equal(Object.hasOwn(view.replyDelivery,'canResend'),false);assert.equal(Object.hasOwn(view.replyDelivery,'canSend'),false);
  if(state==='FAILED'){assert.equal(view.replyDelivery.delivery.label,'Fallo de entrega comprobado');assert.equal(view.replyDelivery.dateSource,'WHATSAPP');}
  if(['WINDOW_CLOSED','UNAVAILABLE','NOT_OBSERVED'].includes(state))assert.equal(view.replyDelivery.recordedAt,null);
 }
 assert.equal(labels.size,7);
});
test('legacy absence never derives reply or delivery from processing completion or replySent fields',()=>{
 for(const processingState of ['PENDING','PROCESSED']){
  const view=participantKycChatAttemptView(result({processingState,replySent:true,replyState:'DELIVERED',messageId:'private-provider-id'}),context);
  assert.equal(view.replyDelivery.state,'NOT_OBSERVED');assert.equal(view.replyDelivery.delivery.confirmed,false);assert.equal(view.replyDelivery.recordedAt,null);
  assert.doesNotMatch(JSON.stringify(view),/private-provider-id|replySent|replyState|messageId/);
 }
 for(const state of ['NOT_OBSERVED','UNAVAILABLE']){
  const view=participantKycChatAttemptView(result({state}),context);assert.equal(view.replyDelivery.delivery.confirmed,false);assert.equal(view.replyDelivery.recordedAt,null);
  assert.throws(()=>participantKycChatAttemptView(result({state,replyDelivery:reply('READ')}),context),{code:'WORKSPACE_CONTEXT_CHANGED'});
 }
});
test('ambiguous same-second attempts cannot claim an identified outbound response',()=>{
 const view=participantKycChatAttemptView(result({sameSecond:true,replyDelivery:reply('UNAVAILABLE',null)}),context);
 assert.match(view.description,/No pudimos separar/);assert.equal(view.replyDelivery.state,'UNAVAILABLE');assert.equal(view.replyDelivery.delivery.confirmed,false);
 for(const state of ['RESERVED','API_ACCEPTED','DELIVERED','READ','FAILED'])assert.throws(()=>participantKycChatAttemptView(result({sameSecond:true,replyDelivery:reply(state)}),context),{code:'WORKSPACE_CONTEXT_CHANGED'});
});
test('malformed outbound state, timestamp, version and private extensions fail closed',()=>{
 for(const value of [null,[],reply('SENT'),reply('STATUS_OBSERVED'),{...reply('READ'),version:2},{...reply('READ'),code:'IDENTIDAD private'}, {...reply('API_ACCEPTED'),phone:'+5491199999999'}, {version:1,state:'READ'},reply('READ','invalid'),reply('READ','2026-02-31T12:00:00.000Z'),reply('READ','2026-10-10T18:26:20-03:00'),reply('READ','2026-10-10T21:26:20Z'),reply('READ',null),reply('UNAVAILABLE','2026-10-10T21:26:20.000Z')])assert.throws(()=>participantKycChatAttemptView(result({replyDelivery:value}),context),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
});
test('matching absent scope or participant IDs cannot substitute for an authorized diagnostic context',()=>{
 for(const [key,value] of [['scope',undefined],['scope','bad'],['projectId',undefined],['workerId',undefined],['workerId','../worker']]){
  assert.throws(()=>participantKycChatAttemptView({...result(),[key]:value},{...context,[key]:value}),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
 }
 for(const receivedAt of ['2026-02-31T12:00:00.000Z','2026-10-10T18:25:15-03:00'])assert.throws(()=>participantKycChatAttemptView(result({receivedAt}),context),{code:'WORKSPACE_CONTEXT_CHANGED'});
});
