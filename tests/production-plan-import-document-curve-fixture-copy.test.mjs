import test from 'node:test';
import {parse} from '@babel/parser';
import {runInNewContext} from 'node:vm';
import * as fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {copyPlanDocumentCurveFixture,DOCUMENT_CURVE_FIXTURE_SOURCES} from '../scripts/lib/plan-document-curve-fixture-copy.mjs';
const root=process.cwd(),sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(flat=false){const owned=mkdtempSync(path.join(tmpdir(),'document-copy-owned-')),components=flat?path.join(owned,'app'):path.join(owned,'src/app/(identity)/cuenta');mkdirSync(components,{recursive:true});writeFileSync(path.join(components,'plan-source-curve.mjs'),readFileSync(path.join(root,DOCUMENT_CURVE_FIXTURE_SOURCES[0])));return {root,fixture:owned,components,sourceManifest:[]};}
test('hierarchical fixture copies actual pure module and original view without rewriting either',()=>{
 const f=fixture();try{const result=copyPlanDocumentCurveFixture(f);assert.equal(result.sourceCurveCopiedExactly,true);assert.deepEqual(result.fixtureTransforms,[]);assert.deepEqual(readFileSync(result.moduleFixturePath),readFileSync(path.join(root,DOCUMENT_CURVE_FIXTURE_SOURCES[1])));assert.deepEqual(readFileSync(path.join(f.components,'plan-source-curve.mjs')),readFileSync(path.join(root,DOCUMENT_CURVE_FIXTURE_SOURCES[0])));assert.deepEqual(f.sourceManifest.map(r=>r.path),[...DOCUMENT_CURVE_FIXTURE_SOURCES]);}finally{rmSync(f.fixture,{recursive:true,force:true});}
});
test('flat fixture records original and relocated hashes and changes only the exact approved import',()=>{
 const f=fixture(true);try{const result=copyPlanDocumentCurveFixture(f),source=readFileSync(path.join(root,DOCUMENT_CURVE_FIXTURE_SOURCES[0])),target=readFileSync(path.join(f.components,'plan-source-curve.mjs')),transform=result.fixtureTransforms[0];assert.equal(result.sourceCurveCopiedExactly,false);assert.equal(result.fixtureTransforms.length,1);assert.deepEqual(target,Buffer.from(source.toString('utf8').replace('../../../lib/plan-import-document-curve.mjs','./plan-import-document-curve.mjs')));assert.equal(transform.sourceSha256,sha(source));assert.equal(transform.copiedBeforeSha256,sha(source));assert.equal(transform.fixtureSha256,sha(target));assert.notEqual(transform.sourceSha256,transform.fixtureSha256);assert.equal(f.sourceManifest.find(r=>r.path===DOCUMENT_CURVE_FIXTURE_SOURCES[0]).sha256,sha(source));assert.equal(transform.dependencyFixturePath,'app/plan-import-document-curve.mjs');assert.ok(existsSync(result.moduleFixturePath));}finally{rmSync(f.fixture,{recursive:true,force:true});}
});
test('changed copied source or a fixture digest substituted for source digest is rejected',()=>{
 const f=fixture(true);try{writeFileSync(path.join(f.components,'plan-source-curve.mjs'),readFileSync(path.join(root,DOCUMENT_CURVE_FIXTURE_SOURCES[0]))+'\n// changed fixture');assert.throws(()=>copyPlanDocumentCurveFixture(f),/Verify copied source/);assert.equal(f.sourceManifest.length,0);assert.equal(existsSync(path.join(f.components,'plan-import-document-curve.mjs')),false);}finally{rmSync(f.fixture,{recursive:true,force:true});}
 const g=fixture(true);try{g.sourceManifest.push({path:DOCUMENT_CURVE_FIXTURE_SOURCES[0],sha256:'f'.repeat(64)});assert.throws(()=>copyPlanDocumentCurveFixture(g),/Manifest always binds original/);}finally{rmSync(g.fixture,{recursive:true,force:true});}
});
test('the helper will not write through a symlink or to another fixture root',()=>{
 const f=fixture(),outside=mkdtempSync(path.join(tmpdir(),'document-copy-other-'));try{mkdirSync(path.join(outside,'app'));writeFileSync(path.join(outside,'app/plan-source-curve.mjs'),readFileSync(path.join(root,DOCUMENT_CURVE_FIXTURE_SOURCES[0])));assert.throws(()=>copyPlanDocumentCurveFixture({...f,components:path.join(outside,'app')}),/Only the owned fixture/);const lib=path.join(f.fixture,'src/lib');symlinkSync(outside,lib,process.platform==='win32'?'junction':'dir');assert.throws(()=>copyPlanDocumentCurveFixture(f),/Module destination stays/);assert.equal(existsSync(path.join(outside,'plan-import-document-curve.mjs')),false);}finally{rmSync(f.fixture,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
test('omitting actual module copy cannot produce a valid exact-copy receipt',async()=>{
 const f=fixture(),mutantDir=mkdtempSync(path.join(tmpdir(),'document-copy-mutant-'));try{const source=readFileSync(new URL('../scripts/lib/plan-document-curve-fixture-copy.mjs',import.meta.url),'utf8'),needle='writeFileSync(moduleTarget,moduleBytes);';assert.equal(source.split(needle).length,2);const mutantFile=path.join(mutantDir,'mutant.mjs');writeFileSync(mutantFile,source.replace(needle,'// Actual module copy deliberately omitted.'));const mutant=await import(pathToFileURL(mutantFile));assert.throws(()=>mutant.copyPlanDocumentCurveFixture(f),{code:'ENOENT'});assert.equal(f.sourceManifest.length,0);}finally{rmSync(f.fixture,{recursive:true,force:true});rmSync(mutantDir,{recursive:true,force:true});}
});

test('actual typed manual producers emit their complete source manifest after real fixture copying',()=>{
 const contract=JSON.parse(readFileSync(path.join(root,'.github/workspace-acceptance-contract.json'),'utf8'));
 for(const kind of ['UI_INTAKE','UI_PREPARATION','UI_PORTFOLIO']){
  const spec=contract.extension.proofs.find(row=>row.kind===kind),source=readFileSync(path.join(root,spec.producer),'utf8'),ast=parse(source,{sourceType:'module'}),calls=[];
  function visit(node){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee.name==='writeFileSync'&&source.slice(node.start,node.end).includes("'package.json'"))calls.push(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
  visit(ast.program);assert.ok(calls.length>0);let preamble=source.slice(0,calls[0].start);for(const node of ast.program.body.filter(node=>node.type==='ImportDeclaration').reverse())if(node.end<=preamble.length)preamble=preamble.slice(0,node.start)+' '.repeat(node.end-node.start)+preamble.slice(node.end);
  // Only the actual pre-browser copier/emitter executes. Git identity inputs are
  // controlled values, and no native/browser execution receipt is produced.
  function execute(omit){
   const owned=[];
   const context={...fs,assert,path,createHash,Buffer,process:{cwd:()=>root,env:{},argv:[],platform:process.platform},execFileSync:(_command,args)=>args[0]==='rev-parse'?'a'.repeat(40)+'\n':'',mkdtempSync:()=>{const value=mkdtempSync(path.join(tmpdir(),'document-emitter-owned-'));owned.push(value);return value;},copyPlanDocumentCurveFixture:args=>{const result=copyPlanDocumentCurveFixture(args);if(omit)args.sourceManifest.splice(0,args.sourceManifest.length);return result;}};
   try{const result=runInNewContext(preamble+'\nJSON.stringify({sourceManifest:typeof sourceManifest!=="undefined"?sourceManifest:sourceProof.sourceManifest,fixtureTransforms:documentCurveFixtureTransforms});',context,{timeout:10000}),emitted=JSON.parse(result);return emitted;}finally{for(const directory of owned){assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(directory).startsWith('document-emitter-owned-'));rmSync(directory,{recursive:true,force:true});}}
  }
  const actual=execute(false),names=actual.sourceManifest.map(ref=>ref.path).sort();assert.deepEqual(names,[...spec.sourceFiles].sort());assert.equal(new Set(names).size,names.length);for(const ref of actual.sourceManifest)assert.equal(ref.sha256,sha(readFileSync(path.join(root,ref.path))));
  assert.equal(actual.fixtureTransforms.length,1);const transform=actual.fixtureTransforms[0],original=readFileSync(path.join(root,DOCUMENT_CURVE_FIXTURE_SOURCES[0]));assert.equal(transform.sourceSha256,sha(original));assert.equal(transform.copiedBeforeSha256,sha(original));assert.equal(transform.fixtureSha256,sha(Buffer.from(original.toString().replace('../../../lib/plan-import-document-curve.mjs','./plan-import-document-curve.mjs'))));
  const mutant=execute(true),mutantNames=mutant.sourceManifest.map(ref=>ref.path).sort();assert.deepEqual(names.filter(file=>!mutantNames.includes(file)),[DOCUMENT_CURVE_FIXTURE_SOURCES[2],DOCUMENT_CURVE_FIXTURE_SOURCES[1]].sort());assert.throws(()=>assert.deepEqual(mutantNames,names));
 }
});
