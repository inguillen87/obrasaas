import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,realpathSync,lstatSync} from 'node:fs';
import path from 'node:path';

const account='src/app/(identity)/cuenta/';
const liveFiles=Object.freeze(['workspace-live-read.mjs','workspace-live-refresh.js','workspace-live-refresh-controller.mjs']);
export const WORKSITE_LIVE_HOURS_FIXTURE_HELPER='scripts/lib/worksite-live-hours-fixture-copy.mjs';
const inside=(directory,target)=>{const relative=path.relative(directory,target);return relative!==''&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// A bounded addition to the two manual fixtures. These modules only use sibling
// account imports, existing CSS/lifecycle/overtime dependencies, and React.
// No source rewriting is needed in either the nested or flattened fixture.
export function copyWorksiteLiveHoursFixture({root,fixture,components,sourceManifest,includeHours}){
 assert.ok(Array.isArray(sourceManifest),'Explicit original-source manifest required');
 assert.equal(typeof includeHours,'boolean','The fixture must explicitly select its field or inventory profile');
 const owned=realpathSync(fixture),directory=realpathSync(components);
 assert.ok(inside(owned,directory),'Only the owned fixture component directory may be changed');
 assert.ok(!lstatSync(components).isSymbolicLink(),'Fixture component directory must not be a link');
 const filenames=[...liveFiles,...(includeHours?['field-hours-report-panel.js']:[])],copied=[];
 const record=file=>{const bytes=readFileSync(path.join(root,file)),entry={path:file,sha256:sha(bytes)},prior=sourceManifest.find(row=>row.path===file);if(prior)assert.equal(prior.sha256,entry.sha256,'Original-source hash may not be replaced: '+file);else sourceManifest.push(entry);return bytes;};
 for(const filename of filenames){
  const file=account+filename,target=path.join(directory,filename);
  assert.ok(inside(owned,target),'Module destination stays in the owned fixture');
  try{const info=lstatSync(target);assert.ok(info.isFile()&&!info.isSymbolicLink(),'Fixture module destination must be a regular file');}catch(error){if(error.code!=='ENOENT')throw error;}
  const bytes=record(file);writeFileSync(target,bytes);assert.deepEqual(readFileSync(target),bytes,'Fixture module must match actual source bytes');
  copied.push({sourcePath:file,fixtureRelativePath:path.relative(owned,target).split(path.sep).join('/'),sha256:sha(bytes),copiedExactly:true});
 }
 record(WORKSITE_LIVE_HOURS_FIXTURE_HELPER);
 assert.equal(new Set(sourceManifest.map(row=>row.path)).size,sourceManifest.length,'Manifest paths remain unique');
 return {copied,fixtureTransforms:[]};
}
