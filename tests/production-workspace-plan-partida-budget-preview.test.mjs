import './helpers/field-hours-network-guard.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parse} from '@babel/parser';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {extractPlanBudgetSource,planBudgetSourceDigest} from '../src/lib/plan-budget-source.mjs';
import {extractCypPlanOoxml} from '../src/lib/plan-import-ooxml.mjs';
import {budgetSourceFixtureParts,putBudgetCell,physicalNumericCell,sharedPlanReference,zipOoxmlFixture,PLAN_SHEET_PART} from './fixtures/plan-budget-source-synthetic.mjs';
import {planPartidaSourcePreview} from '../src/app/(identity)/cuenta/plan-partida-source-preview.mjs';
import {PLAN_BUDGET_SOURCE_PROFILE,PLAN_BUDGET_SOURCE_CONSENT,PLAN_BUDGET_SOURCE_PURPOSE,planPartidaBudgetDigest,planPartidaBudgetDescriptor,planPartidaBudgetCatalog,planPartidaBudgetCandidate,validatePlanPartidaBudgetDetail,resolvePlanPartidaBudgetRow} from '../src/app/(identity)/cuenta/plan-partida-budget-preview.mjs';
import {planImportUploadDigest} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {planImportUsageView} from '../src/app/(identity)/cuenta/plan-import-usage-view.mjs';
import {planDocumentDraftView,planInvestmentDraftView} from '../src/app/(identity)/cuenta/plan-source-curve.mjs';

const context={projectId:'project-synthetic',scope:'a'.repeat(64)},mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const sha=value=>createHash('sha256').update(value).digest('hex');
async function fixture({conflict=false,shared=false,hidden=false,unit='m2 '}={}){
 const {parts,rows}=budgetSourceFixtureParts({partidas:22,unit});
 if(shared)sharedPlanReference(parts,rows);
 if(hidden){parts[PLAN_SHEET_PART]=parts[PLAN_SHEET_PART].replace('<row r="'+rows[0].planRow+'">','<row r="'+rows[0].planRow+'" hidden="1">');parts['xl/worksheets/sheet2.xml']=parts['xl/worksheets/sheet2.xml'].replace('<row r="'+rows[0].budgetRow+'">','<row r="'+rows[0].budgetRow+'" hidden="1">');}
 if(conflict)putBudgetCell(parts,PLAN_SHEET_PART,'D'+rows[0].planRow,physicalNumericCell('D'+rows[0].planRow,'',{formula:"'CyP Integral completo'!M76"}));
 const bytes=zipOoxmlFixture(parts),source=await extractPlanBudgetSource(bytes,mime),physical=await extractCypPlanOoxml(bytes,mime);
 const descriptor={version:2,profile:PLAN_BUDGET_SOURCE_PROFILE,purpose:PLAN_BUDGET_SOURCE_PURPOSE,projectId:context.projectId,sourceSha256:source.sourceSha256,sourceDigest:source.sourceDigest,measurementSourceDigest:source.measurementSourceDigest,rowCount:source.rows.length,currency:{code:null,status:'UNKNOWN'}};
 const draft={id:'budget-synthetic',revision:3,status:'READY',budgetImport:true,financialSource:true,rows:[],source:{sha256:sha(bytes),contentType:mime},budgetDescriptor:descriptor,budgetSource:source};
 const {budgetSource:ignored,...small}=draft;void ignored;
 const owner={},listing={...context,canApprove:true,truncated:false,drafts:[small]},catalog=planPartidaBudgetCatalog(listing,{...context,owner,canonicalAccess:true});
 const view=planPartidaSourcePreview({id:'physical-synthetic',revision:2,status:'READY',source:draft.source,rows:physical.rows,spreadsheet:physical.spreadsheet},context);
 return {source,draft,descriptor,owner,listing,catalog,view,selected:view.items[0]};
}
const validate=f=>validatePlanPartidaBudgetDetail(f.draft,{...context,descriptor:f.descriptor,expectedId:f.draft.id,expectedRevision:f.draft.revision});

test('browser digest and exact DTO binding agree with the canonical V2 extractor without changing literals',async()=>{
 const f=await fixture(),before=structuredClone(f.source),result=await validate(f);
 assert.equal(result.status,'BOUND');assert.equal(await planPartidaBudgetDigest(f.source),planBudgetSourceDigest(f.source));
 const bound=resolvePlanPartidaBudgetRow(result.source,f);assert.equal(bound.status,'BOUND');assert.equal(bound.row.originalRawUnit,'m2 ');assert.equal(bound.row.observed.quantity.decimal,'17.25000');assert.equal(bound.row.observed.unitPrice.decimal,'999.0000');assert.equal(bound.row.observed.lineAmount.decimal,'2.5000');assert.deepEqual(f.source,before);assert.equal(result.source.currency.code,null);assert.equal(result.source.monthBase.interpretedDate,null);
});
test('catalogue contains a small descriptor and never keeps complete budget source or private review text',async()=>{
 const f=await fixture();f.listing.drafts[0].review={reason:'PRIVATE SYNTHETIC REVIEW'};const catalog=planPartidaBudgetCatalog(f.listing,{...context,owner:f.owner,canonicalAccess:true});assert.equal(catalog.owner,f.owner);assert.deepEqual(catalog.entries[0].budgetDescriptor,f.descriptor);assert.doesNotMatch(JSON.stringify(catalog),/17\.25000|PRIVATE SYNTHETIC REVIEW|budgetSource/);
 assert.throws(()=>planPartidaBudgetCatalog({...f.listing,drafts:[f.draft]},{...context,owner:f.owner,canonicalAccess:true}),/no solicitado/);
});
test('only a complete authorized catalogue may select one exact source SHA',async()=>{
 const f=await fixture();assert.equal(planPartidaBudgetCandidate(f).status,'MATCH');
 assert.equal(planPartidaBudgetCatalog({...f.listing,canApprove:false},{...context,owner:f.owner,canonicalAccess:true}),null);assert.equal(planPartidaBudgetCatalog(f.listing,{...context,owner:f.owner,canonicalAccess:false}),null);
 assert.equal(planPartidaBudgetCandidate({...f,catalog:{...f.catalog,truncated:true}}).status,'INCOMPLETE_LIST');assert.equal(planPartidaBudgetCandidate({...f,catalog:null}).status,'NO_ACCESS_OR_LIST');
});
test('two matching budget drafts are ambiguous and a different-file decoy cannot replace the exact source',async()=>{
 const f=await fixture();f.catalog.entries.push({...f.catalog.entries[0],id:'second-synthetic'});assert.equal(planPartidaBudgetCandidate(f).status,'AMBIGUOUS');f.catalog.entries[1].source={...f.draft.source,sha256:'b'.repeat(64)};assert.equal(planPartidaBudgetCandidate(f).status,'MATCH');f.catalog.entries.shift();assert.equal(planPartidaBudgetCandidate(f).status,'NO_MATCH');
});
test('wrong project scope file status revision and descriptor fail before monetary details are shown',async()=>{
 const f=await fixture();for(const patch of [{projectId:'other-project'},{scope:'b'.repeat(64)}])assert.equal(planPartidaBudgetCandidate({...f,catalog:{...f.catalog,...patch}}).status,'CONTEXT_MISMATCH');
 for(const patch of [{status:'PROCESSING'},{revision:0},{budgetDescriptor:{...f.descriptor,currency:{code:'ARS',status:'CONFIRMED'}}}])assert.equal(planPartidaBudgetCandidate({...f,catalog:{...f.catalog,entries:[{...f.catalog.entries[0],...patch}]}}).status,'SOURCE_UNAVAILABLE');
 for(const patch of [{projectId:'other-project'},{revision:4},{id:'other-draft'},{source:{...f.draft.source,sha256:'b'.repeat(64)}}])assert.notEqual((await validatePlanPartidaBudgetDetail({...f.draft,...patch},{...context,descriptor:f.descriptor,expectedId:f.draft.id,expectedRevision:3})).status,'BOUND');
 assert.equal(planPartidaBudgetDescriptor({...f.descriptor,extra:true},{...context,sourceSha256:f.source.sourceSha256}),false);
});
test('detail source and descriptor co-tampering cannot reuse the listed digest',async()=>{
 const f=await fixture(),changed=structuredClone(f.draft);changed.budgetSource.rows[0].observed.unitPrice.decimal='0.01';changed.budgetSource.sourceDigest=await planPartidaBudgetDigest(changed.budgetSource);changed.budgetDescriptor.sourceDigest=changed.budgetSource.sourceDigest;
 assert.equal((await validatePlanPartidaBudgetDetail(changed,{...context,descriptor:f.descriptor,expectedId:f.draft.id,expectedRevision:3})).status,'SOURCE_MISMATCH');
 changed.budgetDescriptor=f.descriptor;changed.budgetSource.sourceDigest=f.descriptor.sourceDigest;assert.equal((await validate({...f,draft:changed})).status,'DIGEST_MISMATCH');
});
test('exact code parent and Plan row identity never fall back to matching titles or offsets',async()=>{
 const f=await fixture(),bound=await validate(f);assert.equal(bound.status,'BOUND');
 for(const patch of [{sourceRange:'Plan de trabajo!A999:BE999'},{parentCode:'B.1.9'},{code:'A.1.1.999'}]){const selected={...f.selected,...patch},view={...f.view,items:[selected]};assert.equal(resolvePlanPartidaBudgetRow(bound.source,{view,selected}).status,'SOURCE_MISMATCH');}
 const changed=structuredClone(f.draft);changed.budgetSource.rows[0].plan.identityReference.address='B999';changed.budgetSource.sourceDigest=await planPartidaBudgetDigest(changed.budgetSource);changed.budgetDescriptor={...f.descriptor,sourceDigest:changed.budgetSource.sourceDigest};assert.equal((await validate({...f,draft:changed,descriptor:changed.budgetDescriptor})).status,'SOURCE_MISMATCH');
});
test('a duplicate code or physical row remains invalid even with a fresh matching digest',async()=>{
 const f=await fixture();for(const field of ['code','physicalSourceRowId']){const changed=structuredClone(f.draft);changed.budgetSource.rows[1][field]=changed.budgetSource.rows[0][field];changed.budgetSource.sourceDigest=await planPartidaBudgetDigest(changed.budgetSource);changed.budgetDescriptor.sourceDigest=changed.budgetSource.sourceDigest;assert.equal((await validate({...f,draft:changed,descriptor:changed.budgetDescriptor})).status,'SOURCE_MISMATCH');}
});
test('empty formula cache and M76 reference conflict stay bound observations without adopting the original quantity',async()=>{
 const f=await fixture({conflict:true}),bound=await validate(f),row=resolvePlanPartidaBudgetRow(bound.source,f).row;
 assert.equal(bound.status,'BOUND');assert.equal(row.plan.links.quantity.reference.address,'M76');assert.equal(row.plan.links.quantity.referenceMatches,false);assert.equal(row.plan.links.quantity.observation.formulaCachePresent,true);assert.equal(row.plan.links.quantity.observation.decimal,null);assert.equal(row.plan.cells.quantity.rawValue,'');assert.equal(row.observed.quantity.decimal,'17.25000');assert.equal(row.automaticUseAllowed,false);
});
test('shared formula masters hidden attributes and observed target evidence survive browser validation',async()=>{
 const f=await fixture({shared:true,hidden:true}),bound=await validate(f);assert.equal(bound.status,'BOUND');assert.deepEqual(bound.source,f.source);assert.equal(bound.source.rows[0].budget.cells.quantity.rowAttributes.hidden,'1');assert.equal(bound.source.rows[0].plan.cells.quantity.rowAttributes.hidden,'1');assert.equal(bound.source.rows[1].plan.cells.unitPrice.sharedFormulaMaster.address,f.source.rows[0].plan.cells.unitPrice.address);assert.equal(bound.source.rows[1].plan.links.unitPrice.reference.shared,true);
});
test('style mutation dangling reference and unused style are rejected even after outer digest recomputation',async()=>{
 const f=await fixture();for(const kind of ['mutation','dangling','unused']){const changed=structuredClone(f.draft),source=changed.budgetSource,key=Object.keys(source.styleTable)[0];if(kind==='mutation')source.styleTable[key].formatCode='CHANGED';if(kind==='dangling')source.rows[0].budget.cells.quantity.styleRef='b'.repeat(64);if(kind==='unused')source.styleTable[sha('unused')]=source.styleTable[key];source.sourceDigest=await planPartidaBudgetDigest(source);changed.budgetDescriptor.sourceDigest=source.sourceDigest;assert.equal((await validate({...f,draft:changed,descriptor:changed.budgetDescriptor})).status,'DIGEST_MISMATCH');}
});
test('cycles depth and oversized private details fail closed under the existing source limits',async()=>{
 const f=await fixture(),cycle=structuredClone(f.draft);cycle.budgetSource.loop=cycle.budgetSource;assert.equal((await validate({...f,draft:cycle})).status,'UNCONFIRMED');
 const deep=structuredClone(f.draft);let cursor=deep.budgetSource;for(let i=0;i<66;i++)cursor=cursor.extra={};assert.equal((await validate({...f,draft:deep})).status,'UNCONFIRMED');
 const large=structuredClone(f.draft);large.budgetSource.extra='x'.repeat(2*1024*1024);assert.equal((await validate({...f,draft:large})).status,'UNCONFIRMED');
});
test('budget upload digest preserves the existing command namespace and exact consent without monetary values',async()=>{
 const source={bytes:100,sha256:'b'.repeat(64),contentType:mime},input={...context,operationId:'abcdefab-1234-4abc-9abc-abcdef123456',source,consent:PLAN_BUDGET_SOURCE_CONSENT};const expected=sha(JSON.stringify(['plan-import-upload-command-v1',{action:'UPLOAD',consent:input.consent,operationId:input.operationId,projectId:input.projectId,scope:input.scope,source:{bytes:source.bytes,contentType:source.contentType,sha256:source.sha256}}]));assert.equal(await planImportUploadDigest(input),expected);assert.notEqual(await planImportUploadDigest({...input,consent:'plan-spreadsheet-cyp-partidas-v2'}),expected);await assert.rejects(()=>planImportUploadDigest({...input,source:{...source,contentType:'application/pdf'}}));
});

// Execute the actual JSX with controlled hook scheduling and explicit onRead.
// This exercises local privacy and events, not browser layout or production authorization.
const account=new URL('../src/app/(identity)/cuenta/',import.meta.url),componentSource=readFileSync(new URL('plan-partida-budget-preview.js',account),'utf8').replace(/^import .*;\r?\n/gm,'');
const hooks=`let states=[],refs=[],memos=[],effects=[],pending=[],s=0,r=0,m=0,e=0;const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));const useState=initial=>{const i=s++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];};const useRef=initial=>{const i=r++;return refs[i]??(refs[i]={current:initial});};const useMemo=(factory,deps)=>{const i=m++,old=memos[i];if(!old||!same(old.deps,deps))memos[i]={deps,value:factory()};return memos[i].value;};const useEffect=(factory,deps)=>{const i=e++,old=effects[i];if(!old||!same(old.deps,deps)){old?.cleanup?.();effects[i]={deps,cleanup:null};pending.push(()=>{effects[i].cleanup=factory();});}};const useLayoutEffect=useEffect;const styles=new Proxy({},{get:(_,key)=>key});export function reset(){for(const effect of effects)effect?.cleanup?.();states=[];refs=[];memos=[];effects=[];pending=[];}export function render(props){s=r=m=e=0;pending=[];const tree=BudgetReading(props);for(const commit of pending)commit();return tree;}export function wrapper(props){return PlanPartidaBudgetPreview(props);}export function snapshot(){return states[0];}`;
await loadBindings();const compiled=await transform(`import React from ${JSON.stringify(import.meta.resolve('react'))};import {planPartidaBudgetCandidate,validatePlanPartidaBudgetDetail,resolvePlanPartidaBudgetRow,planPartidaBudgetNotices} from ${JSON.stringify(new URL('plan-partida-budget-preview.mjs',account).href)};${hooks}${componentSource}`,{filename:'actual-plan-partida-budget-preview.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}}),ui=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
function nodes(tree,predicate,result=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,result);return result;}
const html=props=>renderToStaticMarkup(ui.render(props));
const consult=tree=>{const buttons=nodes(tree,node=>node.type==='button'&&Object.hasOwn(node.props,'data-budget-consult'));assert.equal(buttons.length,1);return buttons[0].props.onClick();};
const props=f=>({entry:f.catalog.entries[0],owner:f.owner,...context,view:f.view,selected:f.selected,mayConsult:true,onRead:async()=>f.draft});

test('real component waits for explicit detail GET and renders literal original values with no decision controls',async()=>{
 const f=await fixture();let reads=0;const p={...props(f),onRead:async()=>{reads++;return f.draft;}};ui.reset();let tree=ui.render(p);assert.doesNotMatch(renderToStaticMarkup(tree),/999\.0000|17\.25000|2\.5000/);assert.equal(reads,0);await consult(tree);const markup=html(p);assert.equal(reads,1);assert.match(markup,/999\.0000/);assert.match(markup,/m2 /);assert.match(markup,/Moneda sin confirmar/);assert.match(markup,/2023/);assert.doesNotMatch(markup,/<input|type="submit"|>Aplicar|>Aprobar|>Guardar correcciones/);assert.match(markup,/Celdas, fórmulas y procedencia/);assert.doesNotMatch(markup,/<details[^>]*\bopen[=> ]/);
});
test('real component shows the empty-cache quantity conflict and keeps controls outside approved totals',async()=>{
 const f=await fixture({conflict:true}),p=props(f);ui.reset();await consult(ui.render(p));const markup=html(p);assert.match(markup,/data-budget-quantity-conflict/);assert.match(markup,/M76/);assert.match(markup,/sin valor numérico guardado/);assert.match(markup,/No sustituimos ni adoptamos cantidades/);assert.match(markup,/Agrupadores, indirectos y controles separados/);assert.match(markup,/No se suman a las partidas/);assert.equal(ui.snapshot().result.source.stockWrites,false);
});
test('common selected code changes resolve the already checked source without fetching another detail',async()=>{
 const f=await fixture(),p=props(f);let calls=0;p.onRead=async()=>{calls++;return f.draft;};ui.reset();await consult(ui.render(p));const first=html(p),next=html({...p,selected:f.view.items[1]});assert.match(first,new RegExp(f.selected.code.replaceAll('.','\\.')));assert.match(next,new RegExp(f.view.items[1].code.replaceAll('.','\\.')));assert.equal(calls,1);assert.match(next,/3\.7500/);
});
test('late detail response cannot restore amounts after role loss in the same owner',async()=>{
 const f=await fixture();let release;const p={...props(f),onRead:()=>new Promise(resolve=>{release=resolve;})};ui.reset();const running=consult(ui.render(p));const revoked={...p,mayConsult:false};assert.doesNotMatch(html(revoked),/999\.0000/);release(f.draft);await running;assert.doesNotMatch(html(revoked),/999\.0000/);assert.equal(ui.snapshot(),null);
});
test('late detail from an A to B to A owner cannot restore private content or replace the next owner',async()=>{
 const f=await fixture();let release;const p={...props(f),onRead:()=>new Promise(resolve=>{release=resolve;})};ui.reset();const running=consult(ui.render(p));html({...p,owner:{},projectId:'project-other'});const next={...p,owner:{},onRead:async()=>f.draft};html(next);release(f.draft);await running;assert.doesNotMatch(html(next),/999\.0000/);assert.equal(ui.snapshot(),null);
});
test('current rejected detail clears the previous observation and keeps an actionable message',async()=>{
 const f=await fixture(),p=props(f);ui.reset();await consult(ui.render(p));assert.match(html(p),/999\.0000/);p.onRead=async()=>{throw Object.assign(new Error('denied'),{status:403});};await consult(ui.render(p));const markup=html(p);assert.doesNotMatch(markup,/999\.0000/);assert.match(markup,/No pudimos comprobar este presupuesto/);
});
test('unauthorized empty and ambiguous wrapper states do not mount private budget rows',async()=>{
 const f=await fixture();assert.equal(ui.wrapper({...f,mayConsult:false}),null);assert.equal(ui.wrapper({...f,catalog:{...f.catalog,entries:[]},mayConsult:true}),null);const catalog={...f.catalog,entries:[...f.catalog.entries,...f.catalog.entries]},markup=renderToStaticMarkup(ui.wrapper({...f,catalog,mayConsult:true}));assert.match(markup,/más de una lectura/);assert.doesNotMatch(markup,/999\.0000|17\.25000/);
});
test('the actual shared request validator rejects missing or false detail authority before selection or linked display',async()=>{
 const f=await fixture(),panel=readFileSync(new URL('plan-import-panel.js',account),'utf8'),ast=parse(panel,{sourceType:'module',plugins:['jsx']});let declaration;
 const visit=value=>{if(!value||typeof value!=='object')return;if(value.type==='VariableDeclarator'&&value.id?.name==='validateDraft')declaration=value.init;for(const child of Object.values(value))if(Array.isArray(child))child.forEach(visit);else if(child&&typeof child==='object')visit(child);};visit(ast);assert.equal(declaration.type,'ArrowFunctionExpression');
 for(const canApprove of [false,undefined,true]){let cleared=0;const validator=Function('planImportUsageView','planDocumentDraftView','planInvestmentDraftView','measurementOwner','projectId','extra','result','requestAuthority','invalidatePrivate','planPartidaBudgetDescriptor','return ('+panel.slice(declaration.start,declaration.end)+');')(planImportUsageView,planDocumentDraftView,planInvestmentDraftView,{canonicalAccess:true},context.projectId,{draftId:f.draft.id},{canApprove},()=>true,()=>cleared++,planPartidaBudgetDescriptor);
  if(canApprove===true){assert.doesNotThrow(()=>validator(f.draft));assert.equal(cleared,0);}else{assert.throws(()=>validator(f.draft),error=>error.code==='WORKSPACE_CONTEXT_CHANGED');assert.equal(cleared,1);}
 }
});
test('real panel keeps budget upload explicit and clears private catalogues before an early denial return',()=>{
 const panel=readFileSync(new URL('plan-import-panel.js',account),'utf8'),preview=readFileSync(new URL('plan-partida-source-preview.js',account),'utf8');parse(panel,{sourceType:'module',plugins:['jsx']});parse(preview,{sourceType:'module',plugins:['jsx']});
 const invalidate=panel.slice(panel.indexOf('const invalidatePrivate='),panel.indexOf('const request='));assert.ok(invalidate.indexOf('setBudgetCatalog(null)')<invalidate.indexOf('if(!active'));assert.ok(invalidate.indexOf('setSelectedBudgetOwner(null)')<invalidate.indexOf('if(!active'));assert.match(panel,/if\(selectedBudgetOwner&&selectedBudgetOwner!==measurementOwner\)\{setSelectedBudgetOwner\(null\);if\(draft\?\.budgetImport===true\)setDraft\(null\)/);assert.match(panel,/setFile\(null\);setConsent\(false\);setSpreadsheetSelection\(''\);setFileInputEpoch\(value=>value\+1\)/);assert.match(panel,/draft\.budgetImport===true\|\|action==='APPLY'/);assert.match(panel,/reviewable=draft\?\.status==='READY'&&draft\?\.budgetImport!==true/);assert.match(panel,/value=\{PLAN_BUDGET_SOURCE_PROFILE\} disabled=\{!canApprove\|\|canonicalAccess!==true\}/);assert.match(panel,/data\.canApprove!==true\)\{invalidatePrivate\(\)/);assert.match(panel,/<input key=\{fileInputEpoch\} ref=\{fileRef\} type="file"/);
 assert.match(preview,/\['DIAGRAM','Diagrama'\],\['CURVE','Curva'\],\['QUANTITIES','Cómputo'\]/);assert.match(preview,/current\.tab==='QUANTITIES'&&<PlanPartidaBudgetPreview/);assert.doesNotMatch(componentSource,/fetch\(|localStorage|sessionStorage|node:crypto|onApplied/);assert.match(panel,/La lectura se realiza localmente, sin recalcular fórmulas ni ejecutar macros\./);const consentCopy=panel.slice(panel.indexOf("?'Autorizo guardar este Excel privado y leer localmente su cómputo"),panel.indexOf(":investmentSelected?'Autorizo"));assert.ok(consentCopy.length>0);assert.doesNotMatch(consentCopy,/OpenAI|API/);
});
test('the local focal process keeps the network guard active without outbound attempts',()=>{
 assert.equal(globalThis.__hoursExportNetworkGuard?.active,true);assert.deepEqual(globalThis.__hoursExportNetworkGuard.attempts,[]);
});
