import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,realpathSync,lstatSync} from 'node:fs';
import path from 'node:path';

export const DOCUMENT_CURVE_FIXTURE_SOURCES=Object.freeze(['src/app/(identity)/cuenta/plan-source-curve.mjs','src/lib/plan-import-document-curve.mjs','scripts/lib/plan-document-curve-fixture-copy.mjs','src/lib/plan-import-cyp-curve.mjs']);
const dependencies=Object.freeze([DOCUMENT_CURVE_FIXTURE_SOURCES[1],DOCUMENT_CURVE_FIXTURE_SOURCES[3]]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(directory,target)=>{const relative=path.relative(directory,target);return relative!==''&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep);};

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
 for(const file of DOCUMENT_CURVE_FIXTURE_SOURCES){
  const entry={path:file,sha256:sha(readFileSync(path.join(root,file)))},existing=sourceManifest.find(row=>row.path===file);
  if(existing)assert.equal(existing.sha256,entry.sha256,'Manifest always binds original source, never relocated fixture bytes');else sourceManifest.push(entry);
 }
 return {fixtureTransforms,moduleFixturePath:moduleFixturePaths[0].fixturePath,moduleFixturePaths,moduleCopiedExactly:true,sourceCurveCopiedExactly:fixtureTransforms.length===0};
}
