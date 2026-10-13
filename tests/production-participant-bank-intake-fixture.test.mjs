import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {applyBankIntakeDeadlockControl} from '../scripts/lib/participant-bank-intake-fixture.mjs';

const source=fileURLToPath(new URL('../src/app/(identity)/cuenta/participant-panel.js',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

function fixture(t){
 const app=mkdtempSync(path.join(os.tmpdir(),'obrasaas-bank-intake-causal-'));
 t.after(()=>rmSync(app,{recursive:true,force:true}));
 copyFileSync(source,path.join(app,'participant-panel.js'));
 return app;
}

test('causal control mutates the copied ParticipantPanel once and preserves the runtime source and OCR view',t=>{
 const app=fixture(t),original=readFileSync(source),ocrView=Buffer.from('export const untouched=true;\n');
 writeFileSync(path.join(app,'participant-ocr-usage-view.mjs'),ocrView);
 const control=applyBankIntakeDeadlockControl(app),mutated=readFileSync(path.join(app,'participant-panel.js'));
 assert.equal(control.source,'src/app/(identity)/cuenta/participant-panel.js');
 assert.equal(control.runtimeSourceEdited,false);
 assert.equal(control.originalSha256,sha(original));
 assert.equal(control.fixtureSha256,sha(mutated));
 assert.notEqual(control.fixtureSha256,control.originalSha256);
 assert.equal(mutated.toString('utf8'),original.toString('utf8').replace(control.needle,control.replacement));
 assert.ok(control.replacement.includes('||intakePending||hasBankPending}'));
 assert.deepEqual(readFileSync(source),original);
 assert.deepEqual(readFileSync(path.join(app,'participant-ocr-usage-view.mjs')),ocrView);
 assert.throws(()=>applyBankIntakeDeadlockControl(app),/exactly one private-bank sibling lock/);
 assert.deepEqual(readFileSync(path.join(app,'participant-panel.js')),mutated);
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
