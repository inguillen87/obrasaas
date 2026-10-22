import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,realpathSync,lstatSync,existsSync} from 'node:fs';
import path from 'node:path';

export const DOCUMENT_CURVE_FIXTURE_SOURCES=Object.freeze(['src/app/(identity)/cuenta/plan-source-curve.mjs','src/lib/plan-import-document-curve.mjs','scripts/lib/plan-document-curve-fixture-copy.mjs','src/lib/plan-import-cyp-curve.mjs']);
export const CAPTURE_QUALITY_FIXTURE_SOURCES=Object.freeze(['src/lib/capture-quality-policy.mjs','src/app/(identity)/cuenta/participant-panel.js','src/app/(identity)/cuenta/participant-kyc-capture.js']);
const dependencies=Object.freeze([DOCUMENT_CURVE_FIXTURE_SOURCES[1],DOCUMENT_CURVE_FIXTURE_SOURCES[3]]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(directory,target)=>{const relative=path.relative(directory,target);return relative!==''&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep);};

function copyCaptureQualityFixture({root,owned,components}){
 const dependency='../../../lib/capture-quality-policy.mjs',sourcePath=CAPTURE_QUALITY_FIXTURE_SOURCES[0],entries=[];
 for(const file of CAPTURE_QUALITY_FIXTURE_SOURCES.slice(1)){
  const target=path.resolve(components,path.basename(file));if(!existsSync(target))continue;
  assert.ok(inside(owned,target)&&lstatSync(target).isFile()&&!lstatSync(target).isSymbolicLink(),'Capture component stays inside owned fixture');
  assert.ok(inside(owned,realpathSync(target)),'Capture component must not escape through a link');
  const original=readFileSync(path.join(root,file)),source=original.toString('utf8');
  assert.ok(original.equals(Buffer.from(source)),'UTF-8 capture source bytes required');
  if(!source.includes(dependency))continue;
  assert.equal(source.split(dependency).length,2,'One exact approved capture quality import: '+file);
  assert.match(source,/\bfrom\s+['"]\.\.\/\.\.\/\.\.\/lib\/capture-quality-policy\.mjs['"]/,'Capture quality dependency must be a literal import');
  assert.deepEqual(readFileSync(target),original,'Verify copied capture source before any relocation');
  const hierarchical=path.resolve(path.dirname(target),dependency),preservesTree=inside(owned,hierarchical),moduleTarget=preservesTree?hierarchical:path.join(path.dirname(target),path.basename(sourcePath));
  entries.push({file,target,original,moduleTarget,preservesTree});
 }
 const fixtureTransforms=[],moduleFixturePaths=[],copiedModules=new Set();
 for(const {file,target,original,moduleTarget,preservesTree} of entries){
  mkdirSync(path.dirname(moduleTarget),{recursive:true});assert.ok(inside(owned,realpathSync(path.dirname(moduleTarget))),'Capture quality module destination stays inside owned fixture');
  try{assert.ok(!lstatSync(moduleTarget).isSymbolicLink(),'Capture quality module destination must not be a link');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!copiedModules.has(moduleTarget)){
   const bytes=readFileSync(path.join(root,sourcePath));writeFileSync(moduleTarget,bytes);assert.deepEqual(readFileSync(moduleTarget),bytes,'Actual copied capture quality module must match source');
   moduleFixturePaths.push({sourcePath,fixturePath:moduleTarget,copiedExactly:true});copiedModules.add(moduleTarget);
  }
  if(!preservesTree){
   const rewritten=Buffer.from(original.toString('utf8').replace(dependency,'./'+path.basename(sourcePath)));writeFileSync(target,rewritten);assert.deepEqual(readFileSync(target),rewritten);
   fixtureTransforms.push({path:file,kind:'FLATTENED_FIXTURE_RELATIVE_IMPORT',sourceSha256:sha(original),copiedBeforeSha256:sha(original),fixtureSha256:sha(rewritten),fixtureRelativePath:path.relative(owned,target).split(path.sep).join('/'),dependencySourcePath:sourcePath,dependencyFixturePath:path.relative(owned,moduleTarget).split(path.sep).join('/')});
  }
 }
 return {fixtureTransforms,moduleFixturePaths,sourceFiles:entries.length?[sourcePath,...entries.map(entry=>entry.file)]:[]};
}

// Original source and generated fixture are different provenance objects when
// a flattened account fixture needs its approved imports relocated. Separate
// transforms retain each dependency and the exact sequential fixture bytes.
export function copyPlanDocumentCurveFixture({root,fixture,components,sourceManifest}){
 assert.ok(Array.isArray(sourceManifest),'Explicit source manifest required');
 const owned=realpathSync(fixture),target=path.resolve(components,'plan-source-curve.mjs');
 assert.ok(inside(owned,target),'Only the owned fixture may be changed');
 assert.ok(lstatSync(target).isFile()&&!lstatSync(target).isSymbolicLink());
 assert.ok(inside(owned,realpathSync(target)),'Fixture source must not escape through a link');
 const original=readFileSync(path.join(root,DOCUMENT_CURVE_FIXTURE_SOURCES[0])),copied=readFileSync(target),source=original.toString('utf8');
 assert.ok(original.equals(Buffer.from(source)),'UTF-8 source bytes required');
 assert.deepEqual(copied,original,'Verify copied source before any relocation');
 for(const file of dependencies)assert.equal(source.split('../../../lib/'+path.basename(file)).length,2,'One exact approved pure-module import: '+file);
 const fixtureTransforms=[],moduleFixturePaths=[];let generated=copied;
 for(const file of dependencies){
  const dependency='../../../lib/'+path.basename(file),hierarchical=path.resolve(path.dirname(target),dependency),preservesTree=inside(owned,hierarchical),moduleTarget=preservesTree?hierarchical:path.join(path.dirname(target),path.basename(file));
  mkdirSync(path.dirname(moduleTarget),{recursive:true});
  assert.ok(inside(owned,realpathSync(path.dirname(moduleTarget))),'Module destination stays inside owned fixture');
  try{assert.ok(!lstatSync(moduleTarget).isSymbolicLink(),'Module destination must not be a link');}catch(error){if(error.code!=='ENOENT')throw error;}
  const moduleBytes=readFileSync(path.join(root,file));
  writeFileSync(moduleTarget,moduleBytes);
  assert.deepEqual(readFileSync(moduleTarget),moduleBytes,'Actual copied pure module must match source');
  moduleFixturePaths.push({sourcePath:file,fixturePath:moduleTarget,copiedExactly:true});
  if(!preservesTree){
   const before=generated,rewritten=Buffer.from(before.toString('utf8').replace(dependency,'./'+path.basename(file)));
   writeFileSync(target,rewritten);assert.deepEqual(readFileSync(target),rewritten);generated=rewritten;
   fixtureTransforms.push({path:DOCUMENT_CURVE_FIXTURE_SOURCES[0],kind:'FLATTENED_FIXTURE_RELATIVE_IMPORT',sourceSha256:sha(original),copiedBeforeSha256:sha(before),fixtureSha256:sha(rewritten),fixtureRelativePath:path.relative(owned,target).split(path.sep).join('/'),dependencySourcePath:file,dependencyFixturePath:path.relative(owned,moduleTarget).split(path.sep).join('/')});
  }
 }
 const captureQuality=copyCaptureQualityFixture({root,owned,components});fixtureTransforms.push(...captureQuality.fixtureTransforms);moduleFixturePaths.push(...captureQuality.moduleFixturePaths);
 for(const file of [...DOCUMENT_CURVE_FIXTURE_SOURCES,...captureQuality.sourceFiles]){
  const entry={path:file,sha256:sha(readFileSync(path.join(root,file)))},existing=sourceManifest.find(row=>row.path===file);
  if(existing)assert.equal(existing.sha256,entry.sha256,'Manifest always binds original source, never relocated fixture bytes');else sourceManifest.push(entry);
 }
 return {fixtureTransforms,moduleFixturePath:moduleFixturePaths[0].fixturePath,moduleFixturePaths,moduleCopiedExactly:true,sourceCurveCopiedExactly:!fixtureTransforms.some(row=>row.path===DOCUMENT_CURVE_FIXTURE_SOURCES[0])};
}
