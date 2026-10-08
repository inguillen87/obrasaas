import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {cypFixture,cypFixtureParts,zipOoxmlFixture,ooxmlFixture} from './fixtures/plan-import-ooxml-synthetic.mjs';
import {extractCypPlanOoxml,safePlanOoxmlAnalysis} from '../src/lib/plan-import-ooxml.mjs';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {decodePlanSource,normalizePlanRows,validatePlanSourceRows,PLAN_IMPORT_CYP_CONSENT,PLAN_IMPORT_SPREADSHEET_CONSENT,boundedPlanMultipart,planDecisionDigest} from '../src/lib/plan-import-policy.mjs';
import {createPlanImportHandlers} from '../src/lib/plan-import-http.mjs';
import {createPlanImport} from '../src/lib/plan-import-store.mjs';
import {planImportUploadFormDigest,planImportCommandDigest} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',scope='a'.repeat(64),projectId='p-synthetic';
const source=()=>decodePlanSource(cypFixture(),mime);
const extract=()=>extractCypPlanOoxml(cypFixture(),mime);
const reviewed=rows=>rows.map(row=>({...row,title:row.title.slice(0,160),startsOn:'2026-11-01',endsOn:'2026-11-02',uncertainty:'',sourceIssueReviewed:true}));
const form=(consent=PLAN_IMPORT_CYP_CONSENT)=>{const f=new FormData();for(const [k,v] of Object.entries({scope,projectId,operationId:randomUUID(),consent}))f.set(k,v);f.set('file',new Blob([cypFixture()],{type:mime}),'synthetic-cyp.xlsx');return f;};
const request=body=>new Request('https://obrasaas.com/api/identity/plan-import',{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body});
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Fixture',organizationId:'org_Fixture',organizationRole:'org:admin'};
test('v2 extracts all 190 partidas and 26 A/B grouping nodes once; seven costs are excluded',async()=>{
 const result=await extract(),s=result.spreadsheet;assert.equal(result.rows.length,190);assert.equal(s.groups.length,26);assert.equal(s.budgetCodeCount,225);assert.equal(s.excludedBudgetLeafCount,7);assert.equal(s.excludedBudgetGroupingCount,2);assert.equal(s.items.length,190);assert.equal(new Set(result.rows.map(r=>r.code)).size,190);assert.ok(result.rows.every(r=>r.startsOn===null&&r.endsOn===null&&r.uncertainty));assert.ok(result.rows.every(r=>/^[AB]\.1\.\d+\.\d+$/.test(r.code)));assert.deepEqual(s.periodOrdinals,Array.from({length:12},(_,i)=>i+1));assert.equal(s.weeksPerPeriod,4);assert.equal(s.progressImported,false);
});
test('explicit profile is mandatory; v2 source is not guessed by legacy profile',async()=>{
 let calls=0;const analyzer=createPlanImportAnalyzer({environment:()=>{calls++;throw Error('forbidden');},fetchImpl:()=>{calls++;throw Error('forbidden');}});
 assert.equal((await analyzer.analyze(source())).success,false);const result=await analyzer.analyze(source(),{profile:'CYP_PARTIDAS'});assert.equal(result.success,true);assert.equal(result.rows.length,190);assert.equal(result.provider,'local-ooxml');assert.equal(calls,0);
 assert.equal((await analyzer.analyze(decodePlanSource(ooxmlFixture(),'application/vnd.ms-excel.sheet.macroenabled.12'),{profile:'CYP_PARTIDAS'})).success,false);
});
test('v2 consent and browser fingerprint bind exact profile and original bytes',async()=>{
 const f=form(),input=await boundedPlanMultipart(new Request('https://obrasaas.com/api/identity/plan-import',{method:'POST',body:f}));assert.equal(input.consent,PLAN_IMPORT_CYP_CONSENT);
 const expected=createHash('sha256').update(JSON.stringify(['plan-import-upload-command-v1',{action:'UPLOAD',consent:input.consent,operationId:input.operationId,projectId,scope,source:{bytes:input.source.bytes.length,contentType:mime,sha256:input.source.sha256}}])).digest('hex');
 assert.equal(await planImportUploadFormDigest(f),expected);assert.notEqual(await planImportUploadFormDigest(form(PLAN_IMPORT_SPREADSHEET_CONSENT)),expected);
});
test('200 partidas are accepted completely; 201 fail completely and PDF/v1 still stop at 50',async()=>{
 assert.equal((await extractCypPlanOoxml(cypFixture({partidas:200}),mime)).rows.length,200);
 await assert.rejects(extractCypPlanOoxml(cypFixture({partidas:201}),mime),{code:'PLAN_IMPORT_ROWS_LIMIT'});
 const plain={title:'Synthetic',startsOn:null,endsOn:null,evidence:'Synthetic source',uncertainty:'Dates pending'};assert.throws(()=>normalizePlanRows(Array.from({length:51},(_,i)=>({...plain,title:'Synthetic '+i}))),{code:'PLAN_IMPORT_ROWS_LIMIT'});
});
test('cached blank, explicit zero and allocation remain distinct without calendar inference',async()=>{
 const r=await extract();assert.deepEqual(r.spreadsheet.items[0].ordinalDistribution.slice(0,4),[null,0.5,0.5,0]);assert.equal(r.rows[0].startsOn,null);assert.throws(()=>normalizePlanRows(r.rows,{complete:true}),{code:'PLAN_IMPORT_REVIEW_REQUIRED'});
});
test('original descriptions up to 500 survive draft but human Task titles must fit 160',async()=>{
 const r=await extract();assert.ok(r.rows[1].title.length>160);assert.equal(normalizePlanRows(r.rows)[1].title,r.rows[1].title);
 const complete=reviewed(r.rows);assert.equal(normalizePlanRows(complete,{complete:true}).length,190);assert.throws(()=>normalizePlanRows(complete.map((row,i)=>i===1?{...row,title:r.rows[1].title}:row),{complete:true}),{code:'PLAN_IMPORT_ROWS_INVALID'});
});
test('same titles are valid for distinct source codes; duplicate codes never are',async()=>{
 const r=await extract(),same=r.rows.map(row=>({...row,title:'Descripción compartida'}));assert.equal(normalizePlanRows(same).length,190);assert.throws(()=>normalizePlanRows([same[0],same[0]]),{code:'PLAN_IMPORT_DUPLICATE_ROWS'});
});
test('missing quantity remains missing and requires explicit review or exclusion',async()=>{
 const r=await extract(),rows=reviewed(r.rows);assert.equal(r.spreadsheet.items.filter(i=>i.missingQuantity).length,1);rows[0].sourceIssueReviewed=false;
 assert.throws(()=>validatePlanSourceRows(rows,r.spreadsheet,r.rows,{complete:true}),{code:'PLAN_IMPORT_REVIEW_REQUIRED'});
 assert.equal(validatePlanSourceRows(rows.slice(1),r.spreadsheet,r.rows,{complete:true}).length,189);rows[0].sourceIssueReviewed=true;assert.equal(validatePlanSourceRows(rows,r.spreadsheet,r.rows,{complete:true}).length,190);
});
test('EDIT cannot forge original code, parent or source reference, nor promote v1 into v2',async()=>{
 const r=await extract(),rows=reviewed(r.rows);
 for(const changed of [{code:'A.1.1.999'},{parentCode:'B.1.1'},{evidence:'Invented source'}])assert.throws(()=>validatePlanSourceRows([{...rows[0],...changed}],r.spreadsheet,r.rows),{code:'PLAN_IMPORT_ROWS_INVALID'});
 assert.throws(()=>validatePlanSourceRows(rows,null,r.rows),{code:'PLAN_IMPORT_ROWS_INVALID'});
 assert.equal(validatePlanSourceRows(rows,r.spreadsheet,r.rows).length,190);
});
test('strict v2 public declaration rejects extra grants, mutated hierarchy, distributions and truncated source',async()=>{
 const r=await extract(),s=r.spreadsheet;assert.deepEqual(safePlanOoxmlAnalysis(s),s);
 for(const bad of [{...s,grant:true},{...s,progressImported:true},{...s,rowCount:189},{...s,groups:s.groups.map((g,i)=>i===1?{...g,parentCode:'I'}:g)},{...s,items:s.items.map((item,i)=>i?item:{...item,ordinalDistribution:[1]})}])assert.equal(safePlanOoxmlAnalysis(bad),null);
});
test('hidden invalid XML, external reference file and duplicate physical view are never evaluated',async()=>{
 const r=await extract();assert.equal(r.spreadsheet.hiddenSheetsIgnored,true);assert.equal(r.spreadsheet.externalReferencesIgnored,true);assert.equal(r.spreadsheet.duplicateViewExcluded,true);assert.equal(r.spreadsheet.formulasRecalculated,false);assert.equal(r.spreadsheet.macrosExecuted,false);
});
test('visible header, code/description cross-check and selected formula errors fail the complete v2 source',async()=>{
 const changes=[s=>s.replace('MES 12','MES 13'),s=>s.replace('Partida sintética A.1.1.1','Different source title'),s=>s.replace(/<c r="B9".*?<\/c>/,'<c r="B9" t="e"><f>#REF!</f><v>#REF!</v></c>')];
 for(const change of changes){const parts=cypFixtureParts();parts['xl/worksheets/sheet1.xml']=change(parts['xl/worksheets/sheet1.xml']);await assert.rejects(extractCypPlanOoxml(zipOoxmlFixture(parts),mime));}
});
test('v2 decision fingerprint binds code, parent and review flag while preserving legacy fingerprint',async()=>{
 const r=await extract(),body={action:'EDIT',draftId:'draft-synthetic',expectedRevision:3,operationId:randomUUID(),projectId,scope,reason:'Synthetic source reviewed',rows:r.rows};
 const first=await planImportCommandDigest(body);assert.notEqual(first,await planImportCommandDigest({...body,rows:r.rows.map((row,i)=>i?row:{...row,sourceIssueReviewed:true})}));
 assert.notEqual(planDecisionDigest(body),planDecisionDigest({...body,rows:reviewed(r.rows)}));
 const legacy={...body,rows:[{title:'Synthetic',startsOn:null,endsOn:null,evidence:'Synthetic source',uncertainty:'Dates pending'}]};
 const expected=createHash('sha256').update(JSON.stringify(['plan-import-decision-v1',projectId,scope,legacy.operationId,legacy.draftId,legacy.expectedRevision,legacy.action,legacy.reason,legacy.rows.map(row=>[row.title,row.startsOn,row.endsOn,row.evidence,row.uncertainty])])).digest('hex');assert.equal(planDecisionDigest(legacy),expected);
});
test('HTTP bounded JSON preserves 256 KiB legacy limit and caps v2 candidate at 1 MiB',async()=>{
 let calls=0,size=0;const h=createPlanImportHandlers({verify:async()=>session,imports:{decide:async(s,b,o)=>{calls++;size=o.requestBytes;return {saved:false};}}});
 assert.equal((await h.POST(request(JSON.stringify({rows:[{title:'x'.repeat(270000)}]})))).status,413);assert.equal(calls,0);
 const large=JSON.stringify({rows:Array.from({length:190},()=>({code:'A.1.1.1',parentCode:'A.1.1',title:'x'.repeat(500),evidence:'x'.repeat(500),uncertainty:'x'.repeat(500)}))});assert.ok(Buffer.byteLength(large)>256*1024);assert.equal((await h.POST(request(large))).status,200);assert.equal(calls,1);assert.equal(size,Buffer.byteLength(large));
 assert.equal((await h.POST(request(JSON.stringify({rows:[{code:'A.1.1.1',parentCode:'A.1.1',title:'x'.repeat(1024*1024)}]})))).status,413);assert.equal(calls,1);
});
test('canonical store denies large JSON against a legacy draft before any receipt or Task writes',async()=>{
 let writes=0;const imports=createPlanImport({workspace:{projectOperation:async(s,c,w,fn)=>fn({query:async sql=>{if(sql.startsWith('SELECT id,metadata'))return {rows:[{id:'draft-synthetic',metadata:{version:1,projectId,consent:{version:PLAN_IMPORT_SPREADSHEET_CONSENT}}}]};writes++;throw Error('unexpected mutation');}},{role:'ADMIN',organizationId:'synthetic',actorId:'synthetic'},scope)},put:()=>{},get:()=>{},analyzer:{analyze:()=>{}}});
 const r=await extract();await assert.rejects(imports.decide(session,{action:'EDIT',draftId:'draft-synthetic',expectedRevision:3,operationId:randomUUID(),projectId,scope,reason:'Synthetic source reviewed',rows:r.rows},{requestBytes:300000}),{code:'PLAN_IMPORT_INPUT_INVALID',status:413});assert.equal(writes,0);
});
