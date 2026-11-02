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
