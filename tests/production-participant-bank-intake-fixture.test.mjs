import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {applyBankIntakeDeadlockControl,applyCivilBankIntakeDeadlockControl} from '../scripts/lib/participant-bank-intake-fixture.mjs';

const source=fileURLToPath(new URL('../src/app/(identity)/cuenta/participant-panel.js',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

function fixture(t,{legacy=true}={}){
 const app=mkdtempSync(path.join(os.tmpdir(),'obrasaas-bank-intake-causal-'));
 t.after(()=>rmSync(app,{recursive:true,force:true}));
 copyFileSync(source,path.join(app,'participant-panel.js'));
 if(legacy){
  const target=path.join(app,'participant-panel.js'),text=readFileSync(target,'utf8');
  const current='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||civilPending}';
  const prior='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending}';
  assert.equal(text.split(current).length,2);writeFileSync(target,text.replace(current,prior));
 }
 return app;
}

test('causal control mutates the copied ParticipantPanel once and preserves the runtime source and OCR view',t=>{
 const app=fixture(t),runtime=readFileSync(source),original=readFileSync(path.join(app,'participant-panel.js')),ocrView=Buffer.from('export const untouched=true;\n');
 writeFileSync(path.join(app,'participant-ocr-usage-view.mjs'),ocrView);
 const control=applyBankIntakeDeadlockControl(app),mutated=readFileSync(path.join(app,'participant-panel.js'));
 assert.equal(control.source,'src/app/(identity)/cuenta/participant-panel.js');
 assert.equal(control.runtimeSourceEdited,false);
 assert.equal(control.originalSha256,sha(original));
 assert.equal(control.fixtureSha256,sha(mutated));
 assert.notEqual(control.fixtureSha256,control.originalSha256);
 assert.equal(mutated.toString('utf8'),original.toString('utf8').replace(control.needle,control.replacement));
 assert.ok(control.replacement.includes('||intakePending||hasBankPending}'));
 assert.deepEqual(readFileSync(source),runtime);
 assert.deepEqual(readFileSync(path.join(app,'participant-ocr-usage-view.mjs')),ocrView);
 assert.throws(()=>applyBankIntakeDeadlockControl(app),/exactly one private-bank sibling lock/);
 assert.deepEqual(readFileSync(path.join(app,'participant-panel.js')),mutated);
});

test('current civil-aware causal control mutates the actual copied panel once and preserves all sibling modules',t=>{
 const app=fixture(t,{legacy:false}),original=readFileSync(source),siblings=['participant-ocr-usage-view.mjs','participant-civil-data-panel.js','participant-civil-data-view.mjs'];
 for(const file of siblings)writeFileSync(path.join(app,file),'export const untouched=true;\n');
 const control=applyCivilBankIntakeDeadlockControl(app),mutated=readFileSync(path.join(app,'participant-panel.js'));
 assert.equal(control.source,'src/app/(identity)/cuenta/participant-panel.js');assert.equal(control.runtimeSourceEdited,false);
 assert.equal(control.originalSha256,sha(original));assert.equal(control.fixtureSha256,sha(mutated));assert.notEqual(control.fixtureSha256,control.originalSha256);
 assert.equal(mutated.toString('utf8'),original.toString('utf8').replace(control.needle,control.replacement));
 assert.ok(control.replacement.endsWith('||intakePending||civilPending||hasBankPending}'));
 for(const file of siblings)assert.equal(readFileSync(path.join(app,file),'utf8'),'export const untouched=true;\n');
 assert.deepEqual(readFileSync(source),original);assert.throws(()=>applyCivilBankIntakeDeadlockControl(app),/exactly one private-bank sibling lock/);
 assert.deepEqual(readFileSync(path.join(app,'participant-panel.js')),mutated);
});

test('historical and current causal transforms cannot certify each other\'s panel boundary',t=>{
 const current=fixture(t,{legacy:false}),currentBytes=readFileSync(path.join(current,'participant-panel.js'));
 assert.throws(()=>applyBankIntakeDeadlockControl(current),/exactly one private-bank sibling lock/);assert.deepEqual(readFileSync(path.join(current,'participant-panel.js')),currentBytes);
 const historical=fixture(t),historicalBytes=readFileSync(path.join(historical,'participant-panel.js'));
 assert.throws(()=>applyCivilBankIntakeDeadlockControl(historical),/exactly one private-bank sibling lock/);assert.deepEqual(readFileSync(path.join(historical,'participant-panel.js')),historicalBytes);
});

test('current civil causal control rejects absent and duplicate locks without fixture edits',t=>{
 const app=fixture(t,{legacy:false}),target=path.join(app,'participant-panel.js'),original=readFileSync(target);
 for(const invalid of [Buffer.from('export const unrelated=true;\n'),Buffer.concat([original,original])]){
  writeFileSync(target,invalid);assert.throws(()=>applyCivilBankIntakeDeadlockControl(app),/exactly one private-bank sibling lock/);assert.deepEqual(readFileSync(target),invalid);
 }
});

test('causal control refuses a missing lock without editing the fixture',t=>{
 const app=fixture(t),target=path.join(app,'participant-panel.js'),original=Buffer.from('export const unrelated=true;\n');
 writeFileSync(target,original);
 assert.throws(()=>applyBankIntakeDeadlockControl(app),/exactly one private-bank sibling lock/);
 assert.deepEqual(readFileSync(target),original);
});

test('causal control refuses multiple matching locks without editing the fixture',t=>{
 const app=fixture(t),target=path.join(app,'participant-panel.js'),original=readFileSync(target);
 const duplicated=Buffer.concat([original,original]);
 writeFileSync(target,duplicated);
 assert.throws(()=>applyBankIntakeDeadlockControl(app),/exactly one private-bank sibling lock/);
 assert.deepEqual(readFileSync(target),duplicated);
});
