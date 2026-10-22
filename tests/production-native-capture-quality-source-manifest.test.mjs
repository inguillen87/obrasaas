import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {currentProducerSourceFiles,validateExtensionProof} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
import {INTAKE_WITHDRAWAL_CHECK_NAMES} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';

// Source-binding unit controls only. These synthetic decoder inputs never
// represent a native execution, database cleanup, CI or release acceptance.
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),parent='731565e11ce8d67e6a4310f491273626fe73c6f9',sha=value=>createHash('sha256').update(value).digest('hex'),readSource=file=>readFileSync(path.join(root,file)),contract=JSON.parse(readSource('.github/workspace-acceptance-contract.json'));
const quality=['src/lib/capture-quality-gate.mjs','src/lib/capture-quality-policy.mjs','src/lib/private-capture-quality.mjs'];
const facial=['src/lib/participant-facial-attempt.mjs','src/lib/participant-facial-policy.mjs','src/lib/participant-facial-precommit.mjs'];
// Ordered array digests were read from literal Git731565. CI does not need a
// historical checkout or network fetch to retain that immutable baseline.
const producers=[{kind:'PG_BANK',path:'scripts/verify-private-bank-account-postgres.mjs',array:'sourceFiles',previousCount:18,previousArraySha256:'94518495e17cda1d83e55b67c329e17f21ce9dd7c09b4ee04ca31e8fb6d4cf3a'},{kind:'PG_INTAKE',path:'scripts/verify-employee-intake-postgres.mjs',array:'sourcePaths',previousCount:32,previousArraySha256:'d929c0b46246250fbcde650c0226cecf2f3ad1f3cbbef33f30ffd91690e12e23'}];
function literalArray(source,name){const tree=parse(source,{sourceType:'module'}),rows=[];const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&node.id?.name===name)rows.push(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);};walk(tree.program);assert.equal(rows.length,1,'One exact native manifest array');assert.equal(rows[0].init.type,'ArrayExpression');return rows[0].init.elements.map(row=>{assert.equal(row.type,'StringLiteral','Native manifest sources stay explicit');return row.value;});}
for(const producer of producers)test(producer.kind+' retains every reviewed source and emits the complete three-module quality dependency delta',()=>{
 const actual=literalArray(readSource(producer.path).toString('utf8'),producer.array),previous=actual.slice(0,producer.previousCount);assert.equal(sha(JSON.stringify(previous)),producer.previousArraySha256);assert.equal(actual.length,producer.previousCount+quality.length+facial.length);assert.deepEqual(actual.slice(producer.previousCount,producer.previousCount+quality.length),quality);assert.deepEqual(actual.slice(producer.previousCount+quality.length),facial);assert.equal(new Set(actual).size,actual.length);
 const spec=contract.extension.proofs.find(row=>row.kind===producer.kind);assert.deepEqual(currentProducerSourceFiles(spec,root),[...actual].sort());for(const file of [...quality,...facial])assert.ok(readSource(file).length>0,file);
 const store=parse(readSource('src/lib/participant-store.mjs').toString('utf8'),{sourceType:'module'}),gate=parse(readSource(quality[0]).toString('utf8'),{sourceType:'module'}),conversation=parse(readSource('src/lib/meta-kyc-conversation.mjs').toString('utf8'),{sourceType:'module'}),precommit=parse(readSource(facial[2]).toString('utf8'),{sourceType:'module'});assert.equal(store.program.body.filter(row=>row.type==='ImportDeclaration'&&row.source.value==='./participant-facial-precommit.mjs').length,1);assert.equal(precommit.program.body.filter(row=>row.type==='ImportDeclaration'&&row.source.value==='./capture-quality-gate.mjs').length,1);for(const name of ['./participant-facial-attempt.mjs','./participant-facial-policy.mjs'])assert.equal(precommit.program.body.filter(row=>row.type==='ImportDeclaration'&&row.source.value===name).length,1);assert.equal(gate.program.body.filter(row=>row.type==='ImportDeclaration'&&row.source.value==='./private-capture-quality.mjs').length,1);assert.equal(conversation.program.body.filter(row=>row.type==='ImportDeclaration'&&row.source.value==='./capture-quality-policy.mjs').length,1);
});
function nativeBinding(kind){
 const producer=producers.find(row=>row.kind===kind),original=contract.extension.proofs.find(row=>row.kind===kind),files=literalArray(readSource(original.producer).toString('utf8'),producer.array).sort(),spec=structuredClone(original),producerRaw=readSource(spec.producer);
 assert.deepEqual(files,spec.sourceFiles,'The current spec is exact; fixture inputs cannot reseal its producer pin');
 assert.equal(spec.producerSha256,sha(Buffer.from(producerRaw.toString('utf8').replaceAll('\r\n','\n'))),'Declared producer is the LF source pin');
 const proof={status:'PASS',productionDataWritten:false,schemaRemoved:true,realProviderCalls:0,providerCalls:0,unexpectedNetworkCalls:0,sqlFailures:[],checks:[...spec.checkNames,...(kind==='PG_INTAKE'?INTAKE_WITHDRAWAL_CHECK_NAMES:[])],sourceManifest:files.map(file=>({path:file,sha256:sha(readSource(file))})),harnessSha256:sha(producerRaw)};
 return{spec,proof};
}
function validateSynthetic(spec,proof,ports={}){const raw=Buffer.from(JSON.stringify(proof));return validateExtensionProof(spec,raw,{expectedHead:parent,readSource,readEvidence:file=>{assert.equal(file,spec.path);return Buffer.from(raw);},...ports});}
const lineageDenied=reason=>error=>error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'&&error.reason===reason;

test('existing raw-source decoder binds every newly emitted bank quality row to actual bytes',()=>{
 const{spec,proof}=nativeBinding('PG_BANK'),before=JSON.stringify(proof),raw=Buffer.from(before);let evidenceReads=0;
 const result=validateSynthetic(spec,proof,{readEvidence:file=>{assert.equal(file,spec.path);evidenceReads++;return Buffer.from(raw);}});
 assert.equal(result.sourceReferences,24);assert.equal(spec.sourceFiles.length,24);assert.equal(result.result,'PASS');assert.equal(result.harnessSha256,spec.producerSha256);assert.equal(proof.harnessSha256,sha(readSource(spec.producer)));assert.equal(JSON.stringify(proof),before);assert.ok(evidenceReads>=4,'The public guard and adapter retain independent fresh RAW reads');
});

test('existing bank and intake raw-source decoders deny omitted forged duplicate or changed quality bytes and stale producer hashes',()=>{
 for(const{kind}of producers){
  const nominal=nativeBinding(kind);assert.equal(validateSynthetic(nominal.spec,nominal.proof).result,'PASS','Each mutation starts from an accepted synthetic decoder fixture');
  for(const file of [...quality,...facial]){
   const{spec,proof}=nativeBinding(kind);
   for(const mode of ['omitted','forged','duplicate']){const bad=structuredClone(proof);if(mode==='omitted')bad.sourceManifest=bad.sourceManifest.filter(row=>row.path!==file);if(mode==='forged')bad.sourceManifest.find(row=>row.path===file).sha256='f'.repeat(64);if(mode==='duplicate')bad.sourceManifest.push({...bad.sourceManifest.find(row=>row.path===file)});const reason=mode==='omitted'?'EXACT_NATIVE_SOURCE_SET':mode==='forged'?'ACTUAL_NATIVE_RAW_SOURCE_'+file:'NATIVE_SOURCE_ROW';assert.throws(()=>validateSynthetic(spec,bad),lineageDenied(reason),kind+' '+file+' '+mode);}
   assert.throws(()=>validateSynthetic(spec,proof,{readSource:target=>target===file?Buffer.concat([readSource(target),Buffer.from('\n// controlled source mutation\n')]):readSource(target)}),lineageDenied('CURRENT_REFERENCE_'+file));
  }
  const{spec,proof}=nativeBinding(kind);proof.harnessSha256='f'.repeat(64);assert.throws(()=>validateSynthetic(spec,proof),lineageDenied('ACTUAL_NATIVE_RAW_PRODUCER_AND_MANIFEST'));
 }
});

test('current native decoder fixtures require the exact spec and every fresh RAW evidence read',()=>{
 const{spec,proof}=nativeBinding('PG_BANK'),raw=Buffer.from(JSON.stringify(proof)),spaced=Buffer.from(JSON.stringify(proof,null,2));assert.deepEqual(JSON.parse(spaced),proof);assert.equal(spaced.equals(raw),false);
 assert.throws(()=>validateSynthetic(spec,proof,{readEvidence:undefined}),{code:'PROOF_NATIVE_RAW_BINDING'});
 assert.throws(()=>validateSynthetic(spec,proof,{readEvidence:file=>{assert.equal(file,spec.path);return Buffer.from(spaced);}}),{code:'PROOF_NATIVE_RAW_BINDING'});
 let reads=0;assert.throws(()=>validateSynthetic(spec,proof,{readEvidence:file=>{assert.equal(file,spec.path);reads++;return Buffer.from(reads===2||reads===3?spaced:raw);}}),{code:'PROOF_NATIVE_RAW_BINDING'});assert.ok(reads>=2,'A differing intermediate RAW read must be observed and denied');
 const altered={...spec,producerSha256:'f'.repeat(64)};assert.throws(()=>validateSynthetic(altered,proof),lineageDenied('EXACT_EXTENSION_NATIVE_SPEC'));
});
