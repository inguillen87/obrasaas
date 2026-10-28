import './helpers/field-hours-network-guard.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parse} from '@babel/parser';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {extractPlanBudgetCsvSource,PLAN_BUDGET_CSV_PROFILE,PLAN_BUDGET_CSV_CONSENT} from '../src/lib/plan-budget-csv-source.mjs';
import {syntheticBudgetCsv} from './fixtures/plan-budget-csv-synthetic.mjs';
import {PLAN_CSV_BUDGET_PROFILE,PLAN_CSV_BUDGET_CONSENT,PLAN_CSV_BUDGET_HEADERS,planCsvBudgetDescriptor,validatePlanCsvBudgetDetail} from '../src/app/(identity)/cuenta/plan-import-csv-budget-view.mjs';
import {PLAN_BUDGET_SOURCE_PROFILE,planPartidaBudgetDescriptor,planPartidaBudgetCatalog,validatePlanPartidaBudgetDetail} from '../src/app/(identity)/cuenta/plan-partida-budget-preview.mjs';
import {planImportUsageView} from '../src/app/(identity)/cuenta/plan-import-usage-view.mjs';
import {planDocumentDraftView,planInvestmentDraftView} from '../src/app/(identity)/cuenta/plan-source-curve.mjs';

const account=new URL('../src/app/(identity)/cuenta/',import.meta.url),context={projectId:'synthetic-project-csv',scope:'b'.repeat(64)},id='plan_draft_'+'c'.repeat(64);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function resign(draft){const {sourceDigest:ignored,...payload}=draft.budgetSource;void ignored;draft.budgetSource.sourceDigest=createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');draft.budgetDescriptor.sourceDigest=draft.budgetSource.sourceDigest;return draft;}
function fixture(options={}){
 const bytes=syntheticBudgetCsv(options),source=extractPlanBudgetCsvSource(bytes,'text/csv'),descriptor={version:1,profile:PLAN_BUDGET_CSV_PROFILE,purpose:'READ_ONLY_BUDGET_SOURCE',projectId:context.projectId,sourceSha256:source.sourceSha256,sourceDigest:source.sourceDigest,rowCount:source.rows.length,currency:{code:null,status:'UNKNOWN'}};
 const draft={id,revision:1,status:'READY',budgetImport:true,financialSource:true,rows:[],source:{contentType:'text/csv',bytes:bytes.length,sha256:source.sourceSha256},budgetDescriptor:descriptor,budgetSource:source};
 return {draft,descriptor,source,owner:{},entry:{id,revision:1,status:'READY',source:draft.source,budgetDescriptor:descriptor}};
}
const validate=draft=>validatePlanCsvBudgetDetail(draft,{projectId:context.projectId,descriptor:draft.budgetDescriptor,expectedId:id,expectedRevision:1});

test('CSV browser contract binds all original rows independently of the CyP contract',async()=>{
 assert.equal(PLAN_CSV_BUDGET_PROFILE,PLAN_BUDGET_CSV_PROFILE);assert.equal(PLAN_CSV_BUDGET_CONSENT,PLAN_BUDGET_CSV_CONSENT);
 for(const count of [1,68,200]){const f=fixture({count});assert.deepEqual(f.source.headers,PLAN_CSV_BUDGET_HEADERS);assert.equal(planCsvBudgetDescriptor(f.descriptor,{...context,sourceSha256:f.source.sourceSha256}),true);assert.equal(planPartidaBudgetDescriptor(f.descriptor,{...context,sourceSha256:f.source.sourceSha256}),true);const result=await validatePlanPartidaBudgetDetail(f.draft,{...context,descriptor:f.descriptor,expectedId:id,expectedRevision:1});assert.equal(result.status,'BOUND');assert.equal(result.source.rows.length,count);assert.deepEqual(result.source.rows,f.source.rows);assert.equal(Object.hasOwn(result.source,'measurementSourceDigest'),false);}
});

test('literal commas, zero, empty values, Unicode and multiline provenance survive browser verification',async()=>{
 const rows=[['2','7.1','Synthetic áé\r\nsecond line',' m² ','0','999999999999999999999,000000','0,00'],['','7.2','Another synthetic item','','','+2,0000','=NOT_A_CALCULATION']];
 const f=fixture({rows,ending:'\r\n'}),result=await validate(f.draft);assert.equal(result.status,'BOUND');assert.equal(result.source.rows[0].sourceTitle,rows[0][2]);assert.equal(result.source.rows[0].rawUnitPrice,rows[0][5]);assert.equal(result.source.rows[0].provenance.lineEnd,3);assert.equal(result.source.rows[1].provenance.lineStart,4);assert.deepEqual(result.source.rows[1].issues,['FORMULA_LIKE_TEXT']);assert.equal(result.source.rows[1].rawQuantity,'');
});

test('CSV descriptor denies wrong project, profile, digest, row count and currency',()=>{
 const f=fixture();for(const change of [{projectId:'other'},{profile:PLAN_BUDGET_SOURCE_PROFILE},{sourceDigest:'invalid'},{rowCount:0},{rowCount:201},{currency:{code:'ARS',status:'KNOWN'}},{measurementSourceDigest:'d'.repeat(64)}])assert.equal(planCsvBudgetDescriptor({...f.descriptor,...change},{...context,sourceSha256:f.source.sourceSha256}),false);
});

test('detail binding rejects cross-context, wrong source or revision and tampered literal values',async()=>{
 const f=fixture();for(const mutate of [d=>{d.id='other';},d=>{d.revision=2;},d=>{d.status='APPLIED';},d=>{d.financialSource=false;},d=>{d.source.contentType='application/pdf';},d=>{d.source.sha256='a'.repeat(64);},d=>{d.budgetSource.rows[0].rawUnitPrice='changed';}]){const d=structuredClone(f.draft);mutate(d);assert.notEqual((await validate(d)).status,'BOUND');}
});

test('even a fresh digest cannot authorize missing rows, extra fields, inferred currency or financial writes',async()=>{
 const f=fixture();for(const mutate of [d=>{d.budgetSource.rows.pop();},d=>{d.budgetSource.rows[0].extra='unexpected';},d=>{d.budgetSource.stockWrites=true;},d=>{d.budgetSource.paymentWrites=true;},d=>{d.budgetSource.amountsCalculated=true;},d=>{d.budgetSource.currency={code:'ARS',status:'KNOWN'};},d=>{d.budgetSource.headers.reverse();},d=>{d.budgetSource.rows[1].code=d.budgetSource.rows[0].code;},d=>{d.budgetSource.rows[0].provenance.pageLiteral=null;},d=>{d.budgetSource.rows[0].provenance.lineStart=0;},d=>{d.budgetSource.rows[1].provenance.lineStart+=1;},d=>{d.budgetSource.rows[0].rawQuantity='=TEXT';},d=>{d.budgetSource.rows[0].rawUnit='\u0000';},d=>{d.budgetSource.encoding='UTF-16';},d=>{d.budgetSource.delimiter='\t';},d=>{delete d.budgetSource.delimiter;}]){const d=structuredClone(f.draft);mutate(d);resign(d);assert.notEqual((await validate(d)).status,'BOUND');}
});

test('catalogues contain only descriptors and require current financial authority',()=>{
 const f=fixture(),{budgetSource:ignored,...listed}=f.draft;void ignored;const listing={...context,canApprove:true,drafts:[listed],truncated:false};assert.equal(planPartidaBudgetCatalog(listing,{...context,owner:f.owner,canonicalAccess:true}).entries.length,1);assert.equal(planPartidaBudgetCatalog({...listing,canApprove:false},{...context,owner:f.owner,canonicalAccess:true}),null);assert.throws(()=>planPartidaBudgetCatalog({...listing,drafts:[f.draft]},{...context,owner:f.owner,canonicalAccess:true}));
});

// Evaluate the actual component with committed hook effects. This verifies
// privacy/event behavior; it does not claim a physical mobile/browser run.
const componentSource=readFileSync(new URL('plan-partida-budget-preview.js',account),'utf8').replace(/^import .*;\r?\n/gm,'');
const hooks=`let states=[],refs=[],memos=[],effects=[],pending=[],s=0,r=0,m=0,e=0;const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));const useState=initial=>{const i=s++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];};const useRef=initial=>{const i=r++;return refs[i]??(refs[i]={current:initial});};const useMemo=(factory,deps)=>{const i=m++,old=memos[i];if(!old||!same(old.deps,deps))memos[i]={deps,value:factory()};return memos[i].value;};const useEffect=(factory,deps)=>{const i=e++,old=effects[i];if(!old||!same(old.deps,deps)){old?.cleanup?.();effects[i]={deps,cleanup:null};pending.push(()=>{effects[i].cleanup=factory();});}};const useLayoutEffect=useEffect;const styles=new Proxy({},{get:(_,key)=>key});export function reset(){for(const effect of effects)effect?.cleanup?.();states=[];refs=[];memos=[];effects=[];pending=[];}export function render(props){s=r=m=e=0;pending=[];const tree=BudgetReading(props);for(const commit of pending)commit();return tree;}export function snapshot(){return states[0];}`;
await loadBindings();const compiled=await transform(`import React from ${JSON.stringify(import.meta.resolve('react'))};import {planPartidaBudgetCandidate,validatePlanPartidaBudgetDetail,resolvePlanPartidaBudgetRow,planPartidaBudgetNotices} from ${JSON.stringify(new URL('plan-partida-budget-preview.mjs',account).href)};${hooks}${componentSource}`,{filename:'actual-csv-budget-reading.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}}),ui=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
function nodes(tree,predicate,result=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,result);return result;}
const text=tree=>!tree?'':typeof tree==='string'?tree:React.Children.toArray(tree.props?.children).map(text).join('');
const button=(tree,label)=>{const found=nodes(tree,node=>node.type==='button'&&text(node)===label);assert.equal(found.length,1);return found[0];};
const consult=tree=>{const found=nodes(tree,node=>node.type==='button'&&Object.hasOwn(node.props,'data-budget-consult'));assert.equal(found.length,1);return found[0].props.onClick();};
const props=f=>({entry:f.entry,owner:f.owner,...context,mayConsult:true,onRead:async()=>f.draft});
const html=p=>renderToStaticMarkup(ui.render(p));

test('actual CSV reading renders original price/amount/page and all 68 options without decision controls',async()=>{
 const f=fixture({count:68}),p=props(f);let reads=0;p.onRead=async()=>{reads++;return f.draft;};ui.reset();const initial=ui.render(p);assert.doesNotMatch(renderToStaticMarkup(initial),/999999999999999999999/);await consult(initial);const markup=html(p);assert.equal(reads,1);assert.match(markup,/Presupuesto de obra \(lectura\)/);assert.match(markup,/data-csv-budget-quantity[^>]*>0,0000</);assert.match(markup,/data-csv-budget-unit-price[^>]*>999999999999999999999,000000</);assert.match(markup,/data-csv-budget-line-amount[^>]*>0,00</);assert.match(markup,/Página declarada en la fuente/);assert.match(markup,/Partida 1 de 68/);assert.equal((markup.match(/<option /g)||[]).length,68);assert.doesNotMatch(markup,/<input|type="submit"|>Aplicar|>Aprobar|>Guardar correcciones|CyP Integral|measurementSourceDigest|OpenAI/);
});

test('long CSV description is progressively disclosed with its complete original text unchanged',async()=>{
 const original=('Synthetic long description & details\r\n').repeat(45)+'👷🏽 Final literal text',f=fixture({rows:[['2','9.7',original,'un.','0','1,00','0,00']]}),snapshot=structuredClone(f.draft),p=props(f);ui.reset();await consult(ui.render(p));const markup=html(p),summary=/data-csv-budget-title-summary[^>]*>([^<]*)<\/p>/.exec(markup);assert.ok(summary);assert.ok(Array.from(summary[1].replaceAll('&amp;','&')).length<=145);assert.match(summary[1],/…$/);assert.match(markup,/data-csv-budget-original-code[^>]*>9\.7<\/code>/);
 const disclosure=/<details[^>]*data-csv-budget-description[^>]*>([\s\S]*?)<\/details>/.exec(markup);assert.ok(disclosure);assert.match(disclosure[1],/<summary>Ver descripción completa<\/summary>/);assert.doesNotMatch(disclosure[0],/\bopen[=> ]/);const expected=renderToStaticMarkup(React.createElement('p',null,original)).replace(/^<p>|<\/p>$/g,'');assert.ok(disclosure[1].includes(expected));assert.match(disclosure[1],/👷🏽 Final literal text/);assert.deepEqual(f.draft,snapshot);assert.equal(ui.snapshot().result.source.rows[0].sourceTitle,original);
 const css=readFileSync(new URL('plan-partida-source-preview.module.css',account),'utf8');assert.match(css,/\.measurementHeading h6\{[^}]*font-size:1rem/);assert.match(css,/\.csvTitleSummary\{[^}]*font-size:1rem/);assert.match(css,/\.csvDescription\{[^}]*white-space:pre-wrap/);
});

test('next and original-code selection reach the complete CSV without another extraction or detail request',async()=>{
 const f=fixture({count:68}),p=props(f);let reads=0;p.onRead=async()=>{reads++;return f.draft;};ui.reset();await consult(ui.render(p));button(ui.render(p),'Siguiente').props.onClick();assert.match(html(p),/Partida 2 de 68/);const select=nodes(ui.render(p),node=>node.type==='select')[0];select.props.onChange({target:{value:f.source.rows.at(-1).code}});assert.match(html(p),/Partida 68 de 68/);assert.equal(button(ui.render(p),'Siguiente').props.disabled,true);button(ui.render(p),'Anterior').props.onClick();assert.match(html(p),/Partida 67 de 68/);assert.equal(reads,1);
});

test('revocation and A to B to A contexts remove prices and prevent a late CSV response from restoring them',async()=>{
 const f=fixture(),p=props(f);ui.reset();await consult(ui.render(p));assert.match(html(p),/999999999999999999999/);assert.doesNotMatch(html({...p,mayConsult:false}),/999999999999999999999|data-csv-budget-reading/);assert.equal(ui.snapshot(),null);
 ui.reset();let release;const waiting={...p,onRead:()=>new Promise(resolve=>{release=resolve;})};const running=consult(ui.render(waiting));html({...p,owner:{},projectId:'other-project'});const returned={...p,owner:{}};html(returned);release(f.draft);await running;assert.doesNotMatch(html(returned),/999999999999999999999/);assert.equal(ui.snapshot(),null);
});

const panel=readFileSync(new URL('plan-import-panel.js',account),'utf8'),ast=parse(panel,{sourceType:'module',plugins:['jsx']});
function astNode(predicate){let found;const visit=value=>{if(!value||typeof value!=='object')return;if(predicate(value))found=value;for(const child of Object.values(value))if(Array.isArray(child))child.forEach(visit);else if(child&&typeof child==='object')visit(child);};visit(ast);assert.ok(found);return found;}
const uploadNode=astNode(node=>node.type==='FunctionDeclaration'&&node.id?.name==='upload');
async function upload(overrides={}){
 const owner={},calls=[],messages=[],file=new File(['synthetic,not,parsed,here'],'synthetic.csv',{type:'text/csv'}),environment={locked:false,busy:false,recoveryReady:true,attempt:null,file,consent:true,spreadsheetSelection:PLAN_CSV_BUDGET_PROFILE,PLAN_BUDGET_SOURCE_PROFILE,csvBudgetProfile:PLAN_CSV_BUDGET_PROFILE,csvBudgetConsent:PLAN_CSV_BUDGET_CONSENT,canApprove:true,canonicalAccess:true,selectedBudgetOwner:owner,measurementOwner:owner,documentPurpose:'TASKS',spreadsheetTypes:{},spreadsheetProfiles:[],setMessage:value=>messages.push(value),explain:code=>code,projectId:context.projectId,scope:context.scope,dispatch:value=>calls.push(value),...overrides};
 const run=Function(...Object.keys(environment),'return ('+panel.slice(uploadNode.start,uploadNode.end)+');')(...Object.values(environment));await run({preventDefault(){}});return {calls,messages};
}

test('actual upload command sends deterministic CSV consent with intact file and no AI fields',async()=>{
 const {calls}=await upload();assert.equal(calls.length,1);const form=calls[0].form;assert.equal(form.get('consent'),PLAN_BUDGET_CSV_CONSENT);assert.equal(form.get('file').type,'text/csv');assert.deepEqual([...form.keys()].sort(),['consent','file','operationId','projectId','scope']);assert.equal(calls[0].kind,'UPLOAD');
});

test('CSV upload cannot dispatch without consent, canonical current owner, authority, capacity or settled recovery',async()=>{
 for(const overrides of [{consent:false},{canonicalAccess:false},{canApprove:false},{selectedBudgetOwner:{}},{spreadsheetSelection:''},{spreadsheetSelection:PLAN_BUDGET_SOURCE_PROFILE},{attempt:{operationId:'pending'}},{recoveryReady:false},{locked:true},{busy:true}])assert.equal((await upload(overrides)).calls.length,0);
 const oversized=new File([new Uint8Array(3*1024*1024+1)],'large.csv',{type:'text/csv'}),result=await upload({file:oversized});assert.equal(result.calls.length,0);assert.deepEqual(result.messages,['PLAN_IMPORT_FILE_TOO_LARGE']);
});

test('CSV extension is normalized independently of browser MIME and private draft validation rejects absent authority',()=>{
 const n=astNode(node=>node.type==='VariableDeclarator'&&node.id?.name==='selectedFile'),select=Function('return ('+panel.slice(n.init.start,n.init.end)+');')();for(const type of ['', 'application/vnd.ms-excel','text/plain','text/csv']){const file=new File(['synthetic'],'SYNTHETIC.CSV',{type}),normalized=select(file);assert.equal(normalized.type,'text/csv');assert.equal(normalized.name,file.name);assert.equal(normalized.size,file.size);}
 const f=fixture(),v=astNode(node=>node.type==='VariableDeclarator'&&node.id?.name==='validateDraft');for(const canApprove of [true,false,undefined]){let cleared=0;const check=Function('planImportUsageView','planDocumentDraftView','planInvestmentDraftView','measurementOwner','projectId','extra','result','requestAuthority','invalidatePrivate','planPartidaBudgetDescriptor','return ('+panel.slice(v.init.start,v.init.end)+');')(planImportUsageView,planDocumentDraftView,planInvestmentDraftView,{canonicalAccess:true},context.projectId,{draftId:id},{canApprove},()=>true,()=>cleared++,planPartidaBudgetDescriptor);if(canApprove===true)assert.doesNotThrow(()=>check(f.draft));else{assert.throws(()=>check(f.draft),error=>error.code==='WORKSPACE_CONTEXT_CHANGED');assert.equal(cleared,1);}}
});

test('CSV-specific UI copy offers read-only scope and retains the standard private recovery path',()=>{
 const start=panel.indexOf("{csvBudgetFile?'Autorizo"),end=panel.indexOf(":documentPurpose===",start),copy=panel.slice(start,end);assert.ok(copy.length>0);assert.doesNotMatch(copy,/OpenAI|API|IA\b/);assert.match(copy,/códigos, cantidades, unidades, precios, importes y procedencia/);assert.match(panel,/\.csv,text\/csv/);assert.match(panel,/csvBudgetConsent\]\.includes/);assert.match(panel,/busy\?'Consultando…'/);assert.match(panel,/draft\?\.budgetImport!==true/);assert.match(panel,/draft\.budgetImport===true\|\|action==='APPLY'/);assert.match(panel,/Comprobar resultado/);assert.deepEqual(globalThis.__hoursExportNetworkGuard.attempts,[]);
});
