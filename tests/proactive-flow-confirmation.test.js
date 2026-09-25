import assert from 'node:assert/strict';
import test from 'node:test';
import { flowResultMatches, flowReceiptMatches, flowResolutionMatches, flowCatalogMatches, flowOutcomePresentation } from '../src/lib/whatsapp/proactive-flow-confirmation.js';
const scope = { organizationId: 'org-a', projectId: 'project-a', conversationId: 'conversation-a' };
const operation = { key: 'inbox-flow-stable-a', blueprintKey: 'incident-report', reviewVersion: 'a'.repeat(64) };
const message = { id: 'message-a', direction: 'OUTBOUND', kind: 'interactive', body: 'Mensaje de ensayo', status: 'accepted', sentAt: '2026-09-24T01:00:00.000Z', recordedAt: '2026-09-24T01:00:00.000Z' };
const valid = () => ({ context: { ...scope }, conversationId: scope.conversationId, operationKey: operation.key, reviewVersion: operation.reviewVersion, flow: { key: operation.blueprintKey }, message: { ...message }, idempotent: false });

test('an empty 200 or a different conversation/flow can never confirm acceptance', () => {
  for (const payload of [{}, null, { conversationId: 'conversation-other', flow: { key: 'shift-check-in' }, message }, { message }]) assert.equal(flowResultMatches(payload, operation, scope), false);
});
for (const patch of [{ context: { ...scope, organizationId: 'other' } }, { context: { ...scope, projectId: 'other' } }, { context: { ...scope, conversationId: 'other' } }, { conversationId: 'other' }, { operationKey: 'inbox-flow-other' }, { reviewVersion: 'b'.repeat(64) }, { flow: { key: 'shift-check-in' } }, { idempotent: 'true' }]) test('result refuses changed identity ' + JSON.stringify(patch), () => {
  assert.equal(flowResultMatches({ ...valid(), ...patch }, operation, scope), false);
});
for (const patch of [{ id: '' }, { id: '../bad' }, { status: '' }, { status: 'SUCCESS' }, { direction: 'INBOUND' }, { kind: 'text' }, { body: null }, { recordedAt: 'invalid' }]) test('incomplete receipt is uncertain '+JSON.stringify(patch), () => {
  assert.equal(flowResultMatches({ ...valid(), message: { ...message, ...patch } }, operation, scope), false);
});
for (const status of ['accepted','sent','delivered','read','failed','sending','unknown']) test('explicit '+status+' is recognized without conflating delivery stages', () => {
  assert.equal(flowResultMatches({ ...valid(), message: { ...message, status } }, operation, scope), true);
  const outcome=flowOutcomePresentation(status);assert.equal(outcome.uncertain,['sending','unknown'].includes(status));
  if(status==='accepted')assert.match(outcome.detail,/no hay confirmación de entrega/);
  if(status==='delivered')assert.match(outcome.detail,/No acredita lectura/);
});
test('absent receipt is a recognized absence, not confirmation of failure', () => {
  assert.equal(flowReceiptMatches({ ...valid(), found: false, message: null }, operation, scope), true);
  assert.equal(flowReceiptMatches({ ...valid(), found: false }, operation, scope), false);
  assert.equal(flowReceiptMatches({ ...valid(), found: true, message: null }, operation, scope), false);
  assert.equal(flowReceiptMatches({ ...valid(), found: true }, operation, scope), true);
});
test('resolution must identify the exact failed attempt, not just return 200', () => {
  const request={blueprintKey:operation.blueprintKey,messageId:message.id};
  const result={...valid(),resolvedAttempt:{...message,status:'failed'}};
  assert.equal(flowResolutionMatches(result,request,scope),true);
  for(const bad of [{},{...result,resolvedAttempt:message},{...result,resolvedAttempt:{...result.resolvedAttempt,id:'other'}},{...result,conversationId:'other'}])assert.equal(flowResolutionMatches(bad,request,scope),false);
});
test('catalog requires same scope, explicit state and preview before offering send', () => {
  const row={key:operation.blueprintKey,title:'Incidencia',description:'Ensayo',capabilities:[],expiresInMinutes:30,canSend:true,unresolvedAttempt:null,reviewVersion:operation.reviewVersion,preview:{bodyText:'Mensaje exacto',buttonText:'Abrir',language:'es_AR'},template:{status:'APPROVED',statusLabel:'Aprobada por Meta',rejectionReason:null}};
  const catalog={context:scope,conversationId:scope.conversationId,capability:{allowed:true,code:'READY',reason:null},recipient:{name:'Persona de ensayo',phone:'+5491111111111'},catalog:[row]};
  assert.equal(flowCatalogMatches(catalog,scope),true);
  for(const bad of [{...catalog,context:{...scope,projectId:'other'}},{...catalog,recipient:null},{...catalog,catalog:[{...row,preview:null}]},{...catalog,catalog:[{...row,reviewVersion:null}]},{...catalog,catalog:[row,row]},{...catalog,capability:{...catalog.capability,allowed:false}}])assert.equal(flowCatalogMatches(bad,scope),false);
});

test('client operation keeps the exact reviewed message body',()=>{
  const command={...operation,bodyText:message.body};assert.equal(flowResultMatches(valid(),command,scope),true);
  assert.equal(flowResultMatches({...valid(),message:{...message,body:'Contenido diferente'}},command,scope),false);
});
