import test from 'node:test';
import assert from 'node:assert/strict';
import {reportFixture,shift} from './helpers/field-hours-fixture.mjs';
import {createHoursUiHarness,text,one,configure,json} from './helpers/field-hours-ui-harness.mjs';
const {panel}=await createHoursUiHarness(),props={projectId:'project-a',scope:'a'.repeat(64),disabled:false,getSessionToken:async()=> 'synthetic-ui-token'};
test('actual hours JSX keeps observed diagnostics while explicitly withholding uncertified effective totals',async()=>{
 const f=reportFixture(),events=shift();events[1].metadata.fieldOperations.recordedBy='actor-other';f.add(events);const report=await f.read();assert.equal(report.totals.closedEffectiveNetMs,null);
 panel.reset({},[json(report)]);await one(configure(panel,props),node=>node.type==='form').props.onSubmit({preventDefault(){}});const tree=panel.render(props);
 assert.equal(panel.state().result.rows.length,1);assert.match(text(tree),/Netas observadas/);assert.match(text(tree),/Netas efectivasSin confirmar/);assert.match(text(tree),/1 jornadas necesitan revisar su respaldo efectivo/);assert.match(text(tree),/Integridad por revisar/);assert.equal(panel.requests().length,1);panel.unmount();
});

async function renderShift(report){
 panel.reset({},[json(report)]);
 await one(configure(panel,props),node=>node.type==='form').props.onSubmit({preventDefault(){}});
 return text(one(panel.render(props),node=>node.type==='article'));
}

test('overnight shift shows both local dates and the registered break in the report zone',async()=>{
 const fixture=reportFixture();
 fixture.add(shift({
  types:['CHECK_IN','BREAK_START','BREAK_END','CHECK_OUT'],
  times:['2026-10-05T23:00:00.000Z','2026-10-06T02:30:00.000Z','2026-10-06T03:00:00.000Z','2026-10-06T07:30:00.000Z']
 }));
 const detail=await renderShift(await fixture.read());
 assert.match(detail,/Entrada registrada: 05\/10\/2026,? 20:00:00 GMT-3/);
 assert.match(detail,/Salida registrada: 06\/10\/2026,? 04:30:00 GMT-3/);
 assert.match(detail,/Pausas registradas: 0 h 30 min/);
 assert.match(detail,/neto observado 8 h 0 min/);
 panel.unmount();
});

test('the last recorded event remains distinct from an actual check-out on an open shift',async()=>{
 const fixture=reportFixture();
 fixture.add(shift({types:['CHECK_IN'],times:['2026-10-05T11:00:00.000Z']}));
 const detail=await renderShift(await fixture.read());
 assert.match(detail,/Salida registrada: Sin registro/);
 assert.match(detail,/último fichaje 05\/10\/2026,? 08:00:00 GMT-3/);
 panel.unmount();
});

test('an unfinished break shows a bounded subtotal and leaves final hours pending',async()=>{
 const fixture=reportFixture();
 fixture.add(shift({
  types:['CHECK_IN','BREAK_START'],
  times:['2026-10-05T11:00:00.000Z','2026-10-05T15:00:00.000Z']
 }));
 const report=await fixture.read();
 assert.equal(report.rows[0].effective.netMs,null);
 const detail=await renderShift(report);
 assert.match(detail,/neto observado 4 h 0 min/);
 assert.match(detail,/Pausa en curso\. Falta registrar la salida\. Neto definitivo pendiente/);
 panel.unmount();
});
