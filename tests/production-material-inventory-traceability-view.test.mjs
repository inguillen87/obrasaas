import test from 'node:test';
import assert from 'node:assert/strict';
import {consumptionTraceability,inventoryRecordedInstant,inventoryReceiptPresentation} from '../src/app/(identity)/cuenta/material-inventory-view.mjs';
const receipt='field_'+'a'.repeat(64),otherReceipt='field_'+'b'.repeat(64),movement='inventory_move_'+'c'.repeat(64);
const decision={decision:'APPROVE',actorId:'responsible-original',reason:'Cantidad comprobada en el registro original.',recordedAt:'2026-10-12T12:00:00.000Z',receiptId:receipt,movementId:movement};
const record={id:'consumption-original',state:'APPROVED',submittedBy:'reporter-original',workerId:'worker-current',materialId:'material-original',quantity:'2.001',unit:'bolsa',decision,reversal:null};
test('canonical approval and reversal keep their separate actor date reason and receipts',()=>{
 const reversed={...record,state:'REVERSED',reversal:{actorId:'responsible-reversal',reason:'Devolución física comprobada por otra cuenta.',recordedAt:'2026-10-12T15:00:00Z',receiptId:otherReceipt,movementId:'inventory_move_'+'d'.repeat(64)}},before=structuredClone(reversed),trace=consumptionTraceability(reversed);
 assert.equal(trace.state,'REVERSED');assert.equal(trace.events.length,2);assert.equal(trace.events[0].receiptId,receipt);assert.equal(trace.events[1].receiptId,otherReceipt);assert.equal(trace.events[0].actorId,'responsible-original');assert.equal(trace.events[1].actorId,'responsible-reversal');assert.equal(trace.events[0].recordedAt,decision.recordedAt);assert.equal(trace.events[1].recordedAt,reversed.reversal.recordedAt);assert.deepEqual(reversed,before);
});
test('proposal and rejection never present creation as an approved stock deduction',()=>{
 const pending=consumptionTraceability({...record,state:'PENDING',decision:null});assert.deepEqual(pending.events,[]);assert.match(pending.explanation,/todavía no descuenta stock/);
 const rejected=consumptionTraceability({...record,state:'REJECTED',decision:{...decision,decision:'REJECT'}});assert.match(rejected.explanation,/No registró una salida/);assert.equal(rejected.events[0].title,'Rechazo registrado');
});
test('dates require an actual canonical UTC instant and impossible historical dates remain unavailable',()=>{
 for(const value of [null,undefined,'2026-02-31T12:00:00.000Z','2026-10-12','2026-10-12T12:00:00','2026-10-12T12:00:00-03:00','12/10/2026 12:00','2026-10-12T24:00:00.000Z'])assert.equal(inventoryRecordedInstant(value),null);
 for(const value of ['2024-02-29T12:00:00.000Z','2026-10-12T12:00:00Z'])assert.equal(inventoryRecordedInstant(value),value);
 const legacy=consumptionTraceability({...record,decision:{reason:'Motivo conservado.',recordedAt:'2026-02-31T12:00:00.000Z',actorId:null,receiptId:'invented'}});assert.equal(legacy.events[0].recordedAt,null);assert.equal(legacy.events[0].receiptId,null);assert.equal(legacy.events[0].actorId,null);assert.equal(legacy.events[0].actorName,null);
});
test('only a server actor name accompanying its actor reference can be presented with no email fallback',()=>{
 const named=consumptionTraceability({...record,decision:{...decision,actorName:'  Cuenta sintética de prueba  '}});assert.equal(named.events[0].actorName,'Cuenta sintética de prueba');
 for(const actorName of ['', 'ab', 'x'.repeat(161),'<Nombre>', 'contact@example.invalid','Nombre\nno válido'])assert.equal(consumptionTraceability({...record,decision:{...decision,actorName}}).events[0].actorName,null);
 assert.equal(consumptionTraceability({...record,decision:{...decision,actorId:null,actorName:'Cuenta sintética'}}).events[0].actorName,null);
 assert.equal(consumptionTraceability({...record,decision:{...decision,email:'contact@example.invalid'}}).events[0].actorName,null);
});
test('the current worker profile never replaces the immutable reporting account',()=>{
 const trace=consumptionTraceability({...record,workerId:'worker-reassigned',workerName:'Perfil vigente',actorName:'Cuenta original sintética'});
 assert.deepEqual(trace.reporter,{actorId:'reporter-original',actorName:'Cuenta original sintética'});assert.equal(consumptionTraceability({...record,submittedBy:null,actorName:'Perfil vigente'}).reporter.actorName,null);
});
test('a recovered creation receipt stays creation even when the current consumption was later approved',()=>{
 const value={state:'RECORDED',saved:true,receiptId:receipt,action:'PROPOSE_CONSUMPTION',kind:'CONSUMPTION_PROPOSAL',stockChanged:false,consumption:record,recordedConsumptionSnapshot:{...record,state:'PENDING',decision:null}};
 const view=inventoryReceiptPresentation(value);assert.equal(view.title,'Propuesta de consumo registrada');assert.equal(view.recordedState,'PENDING');assert.match(view.explanation,/confirma la creación/);assert.match(view.explanation,/estado vigente se consulta por separado/);assert.equal(view.consumptionId,record.id);assert.equal(view.receiptId,receipt);
 for(const patch of [{saved:false},{state:'NOT_OBSERVED'},{action:'UNKNOWN'},{receiptId:'field_bad'}])assert.equal(inventoryReceiptPresentation({...value,...patch}),null);
});
test('missing legacy event fields show absence and never invent actor or receipt',()=>{
 for(const decision of [null,[],true,'approved',{}]){const view=consumptionTraceability({...record,decision});assert.equal(view.events.length,1);assert.equal(view.events[0].recordedAt,null);assert.equal(view.events[0].actorId,null);assert.equal(view.events[0].receiptId,null);assert.equal(view.events[0].confirmed,false);assert.equal(view.events[0].title,'Revisión por comprobar');}
 const view=consumptionTraceability({...record,state:'REVERSED',decision:null,reversal:null});assert.equal(view.events.length,2);assert.equal(view.events[1].recordedAt,null);assert.equal(view.events[1].title,'Reversión por comprobar');
});

test('the immutable proposal receipt is separate from later decisions and legacy reports keep their actual reference',()=>{
 const value=consumptionTraceability({...record,proposalReceiptId:otherReceipt});assert.equal(value.proposalReceiptId,otherReceipt);assert.equal(value.events[0].receiptId,receipt);assert.equal(value.reference,record.id);
 assert.equal(consumptionTraceability({...record,proposalReceiptId:'invented'}).proposalReceiptId,null);assert.equal(consumptionTraceability(record).proposalReceiptId,null);
});

test('an unrelated original snapshot cannot supply the historical state of the receipt',()=>{
 const value={state:'RECORDED',saved:true,receiptId:receipt,action:'PROPOSE_CONSUMPTION',kind:'CONSUMPTION_PROPOSAL',consumption:record,recordedConsumptionSnapshot:{...record,state:'PENDING',decision:null}};
 for(const patch of [{id:'other-consumption'},{materialId:'other-material'},{workerId:'other-worker'},{quantity:'3.001'},{unit:'kg'}])assert.equal(inventoryReceiptPresentation({...value,recordedConsumptionSnapshot:{...value.recordedConsumptionSnapshot,...patch}}).recordedState,null);
 assert.equal(inventoryReceiptPresentation({...value,kind:'PROGRESS_PROPOSAL'}),null);
});
