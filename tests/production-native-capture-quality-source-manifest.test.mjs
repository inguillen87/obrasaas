import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {currentProducerSourceFiles,validateExtensionProof} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';

// Source-binding unit controls only. These synthetic decoder inputs never
// represent a native execution, database cleanup, CI or release acceptance.
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),parent='731565e11ce8d67e6a4310f491273626fe73c6f9',sha=value=>createHash('sha256').update(value).digest('hex'),readSource=file=>readFileSync(path.join(root,file)),contract=JSON.parse(readSource('.github/workspace-acceptance-contract.json'));
const quality=['src/lib/capture-quality-gate.mjs','src/lib/capture-quality-policy.mjs','src/lib/private-capture-quality.mjs'];
// Ordered array digests were read from literal Git731565. CI does not need a
// historical checkout or network fetch to retain that immutable baseline.
const producers=[{kind:'PG_BANK',path:'scripts/verify-private-bank-account-postgres.mjs',array:'sourceFiles',previousCount:18,previousArraySha256:'94518495e17cda1d83e55b67c329e17f21ce9dd7c09b4ee04ca31e8fb6d4cf3a'},{kind:'PG_INTAKE',path:'scripts/verify-employee-intake-postgres.mjs',array:'sourcePaths',previousCount:32,previousArraySha256:'d929c0b46246250fbcde650c0226cecf2f3ad1f3cbbef33f30ffd91690e12e23'}];
function literalArray(source,name){const tree=parse(source,{sourceType:'module'}),rows=[];const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&node.id?.name===name)rows.push(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);};walk(tree.program);assert.equal(rows.length,1,'One exact native manifest array');assert.equal(rows[0].init.type,'ArrayExpression');return rows[0].init.elements.map(row=>{assert.equal(row.type,'StringLiteral','Native manifest sources stay explicit');return row.value;});}
for(const producer of producers)test(producer.kind+' retains every reviewed source and emits the complete three-module quality dependency delta',()=>{
 const actual=literalArray(readSource(producer.path).toString('utf8'),producer.array),previous=actual.slice(0,producer.previousCount);assert.equal(sha(JSON.stringify(previous)),producer.previousArraySha256);assert.equal(actual.length,producer.previousCount+quality.length);assert.deepEqual(actual.slice(producer.previousCount),quality);assert.equal(new Set(actual).size,actual.length);
 const spec=contract.extension.proofs.find(row=>row.kind===producer.kind);assert.deepEqual(currentProducerSourceFiles(spec,root),[...actual].sort());for(const file of quality)assert.ok(readSource(file).length>0,file);
 const store=parse(readSource('src/lib/participant-store.mjs').toString('utf8'),{sourceType:'module'}),gate=parse(readSource(quality[0]).toString('utf8'),{sourceType:'module'}),conversation=parse(readSource('src/lib/meta-kyc-conversation.mjs').toString('utf8'),{sourceType:'module'});assert.equal(store.program.body.filter(row=>row.type==='ImportDeclaration'&&row.source.value==='./capture-quality-gate.mjs').length,1);assert.equal(gate.program.body.filter(row=>row.type==='ImportDeclaration'&&row.source.value==='./private-capture-quality.mjs').length,1);assert.equal(conversation.program.body.filter(row=>row.type==='ImportDeclaration'&&row.source.value==='./capture-quality-policy.mjs').length,1);
});
function nativeBinding(kind){const producer=producers.find(row=>row.kind===kind),original=contract.extension.proofs.find(row=>row.kind===kind),files=literalArray(readSource(original.producer).toString('utf8'),producer.array).sort(),spec={...original,sourceFiles:files,producerSha256:sha(readSource(original.producer))},proof={status:'PASS',productionDataWritten:false,schemaRemoved:true,realProviderCalls:0,checks:[...spec.checkNames],sourceManifest:files.map(file=>({path:file,sha256:sha(readSource(file))})),harnessSha256:spec.producerSha256};return{spec,proof};}
test('existing raw-source decoder binds every newly emitted bank quality row to actual bytes',()=>{const{spec,proof}=nativeBinding('PG_BANK'),result=validateExtensionProof(spec,Buffer.from(JSON.stringify(proof)),{expectedHead:parent,readSource});assert.equal(result.sourceReferences,21);assert.equal(result.result,'PASS');});
test('existing bank and intake raw-source decoders deny omitted forged duplicate or changed quality bytes and stale producer hashes',()=>{
 for(const{kind}of producers)for(const file of quality){
  const{spec,proof}=nativeBinding(kind);for(const mode of ['omitted','forged','duplicate']){const bad=structuredClone(proof);if(mode==='omitted')bad.sourceManifest=bad.sourceManifest.filter(row=>row.path!==file);if(mode==='forged')bad.sourceManifest.find(row=>row.path===file).sha256='f'.repeat(64);if(mode==='duplicate')bad.sourceManifest.push({...bad.sourceManifest.find(row=>row.path===file)});assert.throws(()=>validateExtensionProof(spec,Buffer.from(JSON.stringify(bad)),{expectedHead:parent,readSource}),error=>['PROOF_SOURCE_MANIFEST','PROOF_SOURCE_HASH'].includes(error.code),kind+' '+file+' '+mode);}
  assert.throws(()=>validateExtensionProof(spec,Buffer.from(JSON.stringify(proof)),{expectedHead:parent,readSource:target=>target===file?Buffer.concat([readSource(target),Buffer.from('\n// controlled source mutation\n')]):readSource(target)}),{code:'PROOF_SOURCE_HASH'});
 }
 for(const{kind}of producers){const{spec,proof}=nativeBinding(kind);proof.harnessSha256='f'.repeat(64);assert.throws(()=>validateExtensionProof(spec,Buffer.from(JSON.stringify(proof)),{expectedHead:parent,readSource}),{code:'PROOF_HARNESS_SOURCE'});}
});
