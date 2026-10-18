import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';
import {extractPlanMeasurementSource,normalizePlanMeasurementSource,planMeasurementSourceDigest} from '../src/lib/plan-measurement-source.mjs';
import {extractCypPlanOoxml} from '../src/lib/plan-import-ooxml.mjs';
import {measurementCypFixtureParts,physicalNumericCell,replacePhysicalCell,zipOoxmlFixture} from './fixtures/plan-measurement-source-synthetic.mjs';
import {planPartidaSourcePreview} from '../src/app/(identity)/cuenta/plan-partida-source-preview.mjs';
import {planPartidaMeasurementCatalog,planPartidaNormalizedMeasurementDigest,resolvePlanPartidaMeasurement,planPartidaMeasurementResultCurrent,planPartidaMeasurementRequestCurrent} from '../src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs';

const context={projectId:'project-synthetic',scope:'a'.repeat(64)},mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture({unit='U',formula=false,hidden=false}={}){
 const {parts,row}=measurementCypFixtureParts({partidas:22,unit,quantity:'12.34000'});
 if(formula)replacePhysicalCell(parts,'xl/worksheets/sheet1.xml','D'+row,physicalNumericCell('D'+row,'12.34000',{formula:'6.17*2'}));
 if(hidden)parts['xl/worksheets/sheet1.xml']=parts['xl/worksheets/sheet1.xml'].replace('<row r="'+row+'">','<row r="'+row+'" hidden="1">');
 const bytes=zipOoxmlFixture(parts),sourceSha256=sha(bytes),source=await extractPlanMeasurementSource(bytes,mime,{sourceSha256}),physical=await extractCypPlanOoxml(bytes,mime);
 const draft={id:'plan-physical-synthetic',revision:2,status:'READY',source:{sha256:sourceSha256,contentType:mime},rows:physical.rows,spreadsheet:physical.spreadsheet};
 const measurement={id:'plan-measurement-synthetic',revision:4,status:'READY',measurementImport:true,source:{sha256:sourceSha256,contentType:mime},sourceDigest:planMeasurementSourceDigest(source),measurementSource:source,rows:[],review:{reason:'Private review reason must not be retained in source preview'}};
 const owner={},listing={...context,canApprove:true,truncated:false,drafts:[draft,measurement]},catalog=planPartidaMeasurementCatalog(listing,{...context,owner,canonicalAccess:true}),view=planPartidaSourcePreview(draft,context);
 return {draft,measurement,source,owner,listing,catalog,view,selected:view.items[0]};
}
const resolve=fixture=>resolvePlanPartidaMeasurement(fixture);

test('real canonical extractor DTO binds exact file, code and row and preserves revision/digest',async()=>{
 const f=await fixture(),before=structuredClone(f.source),bound=await resolve(f);
 assert.equal(bound.status,'BOUND');assert.equal(bound.quantity,'12.34000');assert.equal(bound.unit,'U');assert.equal(bound.code,f.selected.code);assert.equal(bound.draftId,f.measurement.id);assert.equal(bound.revision,4);assert.equal(bound.sourceDigest,planMeasurementSourceDigest(normalizePlanMeasurementSource(f.source)));assert.equal(bound.sourceRowId,f.source.rows[0].sourceRowId);assert.deepEqual(f.source,before);
 for(const key of ['baseline','approved','decision','taskId','startsOn','progress','stock'])assert.equal(Object.hasOwn(bound,key),false);
 assert.equal(Object.hasOwn(f.catalog.entries[0],'review'),false);
});
test('browser serializer agrees with canonical normalized source digest, including object key order',async()=>{
 const f=await fixture();assert.equal(await planPartidaNormalizedMeasurementDigest(f.source),f.measurement.sourceDigest);
 const reversed=Object.fromEntries(Object.entries(f.source).reverse());assert.equal(await planPartidaNormalizedMeasurementDigest(reversed),f.measurement.sourceDigest);
});
for(const unit of ['U','ml','Gl','meses','meses '])test('quantity preview preserves literal unit '+JSON.stringify(unit)+' without converting it',async()=>{
 const bound=await resolve(await fixture({unit}));assert.equal(bound.status,'BOUND');assert.equal(bound.unit,unit);assert.equal(bound.quantity,'12.34000');assert.ok(bound.issues.includes('UNIT_REQUIRES_CORRECTION'));
});
test('formula cache and hidden row remain visible issues, never treated as accepted values',async()=>{
 const f=await fixture({formula:true,hidden:true}),bound=await resolve(f);assert.equal(bound.status,'BOUND');assert.equal(bound.quantity,'12.34000');assert.equal(bound.quantityCell.formulaText,'6.17*2');assert.equal(bound.quantityCell.cachePresent,true);assert.ok(bound.issues.includes('FORMULA_CACHE_REVIEW_REQUIRED'));assert.ok(bound.issues.includes('HIDDEN_SOURCE_CELL'));assert.equal(bound.quantityCell.rowAttributes.hidden,'1');
});
test('same title and same code from a different file do not bind',async()=>{
 const f=await fixture(),other=await fixture({unit:'ml'});f.catalog.entries=[other.catalog.entries[0]];assert.equal(other.source.rows[0].sourceTitle,f.source.rows[0].sourceTitle);assert.equal((await resolve(f)).status,'NO_MATCH');
});
test('a different-file decoy cannot override the one exact source',async()=>{
 const f=await fixture(),other=await fixture({unit:'Gl'});f.catalog.entries.unshift(other.catalog.entries[0]);assert.equal((await resolve(f)).status,'BOUND');
});
test('two drafts with the exact SHA remain ambiguous even with identical digest',async()=>{
 const f=await fixture();f.catalog.entries.push({...f.catalog.entries[0],id:'plan-measurement-second',revision:5});assert.equal((await resolve(f)).status,'AMBIGUOUS');
});
test('truncated listing never claims uniqueness or reveals a quantity',async()=>{
 const f=await fixture();f.catalog.truncated=true;assert.deepEqual(await resolve(f),{status:'INCOMPLETE_LIST'});
});
for(const key of ['projectId','scope'])test('a foreign '+key+' cannot reuse a matching file and title',async()=>{
 const f=await fixture();f.catalog[key]=key==='projectId'?'project-other':'b'.repeat(64);assert.deepEqual(await resolve(f),{status:'CONTEXT_MISMATCH'});
});
test('a supplied foreign project inside a draft fails closed although publicDraft normally omits it',async()=>{
 const f=await fixture();f.catalog.entries[0].projectId='project-other';assert.equal((await resolve(f)).status,'SOURCE_UNAVAILABLE');
});
test('a tampered normalized DTO cannot reuse the original digest',async()=>{
 const f=await fixture();f.catalog.entries[0].measurementSource=structuredClone(f.source);f.catalog.entries[0].measurementSource.rows[0].quantity.rawValue='999';assert.deepEqual(await resolve(f),{status:'DIGEST_MISMATCH'});
});
test('matching code in a different physical row never falls back to title',async()=>{
 const f=await fixture();f.selected={...f.selected,sourceRange:'Plan de trabajo!A999:BE999'};f.view={...f.view,items:[f.selected]};assert.deepEqual(await resolve(f),{status:'SOURCE_MISMATCH'});
});
for(const status of ['UPLOADING','PROCESSING','FAILED','REJECTED'])test('a '+status+' source never exposes its cached quantity',async()=>{
 const f=await fixture();f.catalog.entries[0].status=status;assert.deepEqual(await resolve(f),{status:'SOURCE_UNAVAILABLE'});
});
test('APPLIED still means original observation, not approval of a rendered quantity',async()=>{
 const f=await fixture();f.catalog.entries[0].status='APPLIED';const bound=await resolve(f);assert.equal(bound.status,'BOUND');assert.equal(bound.draftStatus,'APPLIED');assert.equal(Object.hasOwn(bound,'approved'),false);
});
for(const denial of [{canApprove:false},{canonicalAccess:false}])test('permission loss does not retain a measurement catalog: '+JSON.stringify(denial),async()=>{
 const f=await fixture(),listing={...f.listing,...('canApprove' in denial?denial:{})};assert.equal(planPartidaMeasurementCatalog(listing,{...context,owner:f.owner,canonicalAccess:true,...('canonicalAccess' in denial?denial:{})}),null);assert.deepEqual(await resolve({...f,catalog:null}),{status:'NO_ACCESS_OR_LIST'});
});
test('late digest results are unusable after catalog replacement, revocation or context/partida changes',async()=>{
 const f=await fixture(),result=await resolve(f),answer={catalog:f.catalog,contextKey:f.view.contextKey,code:f.selected.code,sourceRange:f.selected.sourceRange,result};
 assert.equal(planPartidaMeasurementResultCurrent(answer,f),true);
 for(const next of [{...f,catalog:null},{...f,catalog:{...f.catalog,owner:{}}},{...f,view:{...f.view,contextKey:'other-scope'}},{...f,selected:f.view.items[1]},{...f,selected:{...f.selected,sourceRange:'Plan de trabajo!A999:BE999'}}])assert.equal(planPartidaMeasurementResultCurrent(answer,next),false);
});
test('catalog listing binds envelope and rejects a response from another project',async()=>{
 const f=await fixture();assert.throws(()=>planPartidaMeasurementCatalog({...f.listing,projectId:'project-other'},{...context,owner:f.owner,canonicalAccess:true}));
});
test('late old-context 401 cannot clear the new authorized catalog, even on A to B to A',async()=>{
 const old=await fixture(),next=await fixture(),stamp={owner:old.owner,generation:1,sequence:1},accepted={owner:next.owner,generation:1,sequence:2};let catalog=next.catalog;
 if(planPartidaMeasurementRequestCurrent(stamp,{owner:next.owner,generation:1,accepted}))catalog=null;
 assert.equal(catalog,next.catalog);assert.equal((await resolve({...next,catalog})).status,'BOUND');
 // Equal scope/project strings do not give the previous owner object authority.
 assert.deepEqual(old.view.contextKey,next.view.contextKey);assert.notEqual(old.owner,next.owner);
});
test('a current-context 401 clears the current catalog and invalidates later digest display',async()=>{
 const f=await fixture(),stamp={owner:f.owner,generation:1,sequence:2},answer={catalog:f.catalog,contextKey:f.view.contextKey,code:f.selected.code,sourceRange:f.selected.sourceRange,result:await resolve(f)};let catalog=f.catalog,generation=1;
 if(planPartidaMeasurementRequestCurrent(stamp,{owner:f.owner,generation,accepted:{owner:f.owner,generation:1,sequence:1}})){catalog=null;generation++;}
 assert.equal(catalog,null);assert.equal(planPartidaMeasurementResultCurrent(answer,{...f,catalog}),false);assert.equal(planPartidaMeasurementRequestCurrent(stamp,{owner:f.owner,generation,accepted:null}),false);
});
test('an older denial or list cannot replace a newer accepted listing in the same owner',async()=>{
 const f=await fixture(),accepted={owner:f.owner,generation:3,sequence:9},older={owner:f.owner,generation:3,sequence:8},context={owner:f.owner,generation:3,accepted};assert.equal(planPartidaMeasurementRequestCurrent(older,context),false);assert.equal(planPartidaMeasurementRequestCurrent({...older,sequence:10},context),true);
});
test('component and panel privacy fences are on real parsed source, before private early return',()=>{
 const panel=readFileSync(new URL('../src/app/(identity)/cuenta/plan-import-panel.js',import.meta.url),'utf8'),component=readFileSync(new URL('../src/app/(identity)/cuenta/plan-partida-measurement-preview.js',import.meta.url),'utf8');
 const ast=parse(panel,{sourceType:'module',plugins:['jsx']}),source=panel.slice(ast.program.body.find(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.id?.name==='PlanImportPanel').start);
 assert.match(source,/measurementCatalog\?\.owner===measurementOwner\?measurementCatalog:null/);assert.match(source,/activeMeasurementOwner\.current===owner&&generation===privateGeneration\.current/);
 const invalidate=source.slice(source.indexOf('const invalidatePrivate='),source.indexOf('const request='));assert.ok(invalidate.indexOf('setMeasurementCatalog(null)')<invalidate.indexOf('if(!active'));assert.ok(invalidate.indexOf('setCanApprove(false)')<invalidate.indexOf('if(!active'));
 assert.match(source,/if\(!mounted.current\|\|activeMeasurementOwner.current!==owner\|\|!owner.canonicalAccess\|\|!canApprove\|\|busy\|\|locked\)return/);
 assert.match(source,/if\(requestAuthority\(\)&&\[401,403\]\.includes\(response.status\)\)invalidatePrivate\(\)/);assert.match(source,/activeMeasurementOwner.current!==requestStamp.owner/);assert.match(source,/measurementAcceptedRead.current=stamp/);
 assert.match(component,/return\(\)=>\{active=false;\}/);assert.match(component,/mayConsult&&planPartidaMeasurementResultCurrent/);assert.doesNotMatch(component,/fetch\(|sessionStorage|localStorage|onApplied|type="checkbox"/);
});
