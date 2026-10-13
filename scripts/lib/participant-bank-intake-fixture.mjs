import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const source='src/app/(identity)/cuenta/participant-panel.js';
const needle='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending}';
const replacement='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||hasBankPending}';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export function applyBankIntakeDeadlockControl(app){
 const target=path.join(app,'participant-panel.js'),before=readFileSync(target);
 const text=before.toString('utf8');
 assert.equal(text.split(needle).length,2,'The causal fixture must replace exactly one private-bank sibling lock');
 writeFileSync(target,text.replace(needle,replacement));
 return {source,originalSha256:sha(before),fixtureSha256:sha(readFileSync(target)),needle,replacement,runtimeSourceEdited:false};
}

// CURRENT civil-aware panel only. The earlier transform above remains explicit
// for historical fixture tests and cannot certify this different lock boundary.
export function applyCivilBankIntakeDeadlockControl(app){
 const needle='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||civilPending}';
 const replacement='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||civilPending||hasBankPending}';
 const target=path.join(app,'participant-panel.js'),before=readFileSync(target),text=before.toString('utf8');
 assert.equal(text.split(needle).length,2,'The current civil causal fixture must replace exactly one private-bank sibling lock');
 writeFileSync(target,text.replace(needle,replacement));
 return {source,originalSha256:sha(before),fixtureSha256:sha(readFileSync(target)),needle,replacement,runtimeSourceEdited:false};
}
