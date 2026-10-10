import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {formatSourceCurveDecimal,planSourceCurveView,sourceCurveKeyboardIndex} from '../src/app/(identity)/cuenta/plan-source-curve.mjs';
import {extractCypCurveOoxml} from '../src/lib/plan-import-ooxml.mjs';
import {cypCurveFixture} from './fixtures/plan-import-cyp-curve-synthetic.mjs';

await loadBindings();
const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href;
const helperUrl=new URL('../src/app/(identity)/cuenta/plan-source-curve.mjs',import.meta.url).href;
const source=readFileSync(new URL('../src/app/(identity)/cuenta/plan-source-curve.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const baseImports=`import React from ${JSON.stringify(reactUrl)};\nimport {formatSourceCurveDecimal,planSourceCurveView,sourceCurveKeyboardIndex} from ${JSON.stringify(helperUrl)};\nconst styles={};\n`;
async function compile(imports,extra=''){
 const result=await transform(imports+source+extra,{filename:'plan-source-curve.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
 return import('data:text/javascript;base64,'+Buffer.from(result.code).toString('base64'));
}
const {PlanSourceCurve}=await compile(`import {useId,useRef,useState} from ${JSON.stringify(reactUrl)};\n`+baseImports);
// This controlled hook harness invokes the real compiled component's handlers; it is not browser acceptance.
const interactive=await compile(baseImports+`let selected=0;const controls={current:[]};const useId=()=>"curve-test",useRef=()=>controls,useState=()=>[selected,value=>{selected=value;}];\n`,`\nexport const render=props=>PlanSourceCurve(props);export const reset=()=>{selected=0;controls.current=[];};export const selection=()=>selected;`);

const cell=(column,row,cachedValue,hasFormula=false)=>({sourceCell:`Plan y curva Meses!${column}${row}`,cachedValue,hasFormula});
function curve(){
 const percentages=['0.125000','0.500000','1.000000'],amounts=['12345678901234567890.123456789000','0','999.9900'];
 return {kind:'PLANNED_MONETARY_INVESTMENT',currency:null,calendarStart:null,total:cell('E',59,'12345678901234568890.113456789000'),initialCumulative:cell('F',62,'0.0000'),periods:['G','H','I'].map((column,i)=>({ordinal:i+1,headerCell:`Plan y curva Meses!${column}9`,monthlyAmount:cell(column,60,amounts[i],i!==1),cumulativeAmount:cell(column,62,i===0?amounts[0]:i===1?null:'12345678901234568890.113456789000',i!==1),monthlyPercentage:cell(column,64,i===1?null:'0.125000',i!==1),cumulativePercentage:cell(column,66,percentages[i],true)}))};
}
const html=(value,props={})=>renderToStaticMarkup(React.createElement(PlanSourceCurve,{curve:value,status:'READY',...props}));
function elements(node,predicate,found=[]){
 if(node===null||node===undefined||typeof node!=='object')return found;
 if(Array.isArray(node)){for(const child of node)elements(child,predicate,found);return found;}
 if(predicate(node))found.push(node);
 elements(node.props?.children,predicate,found);return found;
}
const polyline=markup=>[...markup.matchAll(/<polyline[^>]+points="([^"]+)"/g)].map(match=>match[1]);

test('cached monetary decimals and source ratios display exactly beyond floating point precision',()=>{
 assert.equal(formatSourceCurveDecimal('12345678901234567890.123456789000'),'12.345.678.901.234.567.890,123456789000');
 assert.equal(formatSourceCurveDecimal('1.234567890123456789000e+4'),'12.345,67890123456789000');
 assert.equal(formatSourceCurveDecimal('1.2500e-3',{percentage:true}),'0,12500%');
 assert.equal(formatSourceCurveDecimal('0.125000',{percentage:true}),'12,5000%');
 assert.equal(formatSourceCurveDecimal('0.0000'),'0,0000');assert.equal(formatSourceCurveDecimal(null),'Sin dato');
 assert.equal(formatSourceCurveDecimal('0'),'0');assert.equal(formatSourceCurveDecimal('-0.00'),'-0,00');
});

test('complete cached source values and provenance survive a detached display model without mutation',()=>{
 const value=curve(),before=structuredClone(value),view=planSourceCurveView(value);
 assert.deepEqual(value,before);assert.deepEqual(view.periods,value.periods);assert.deepEqual(view.total,value.total);assert.deepEqual(view.initialCumulative,value.initialCumulative);
 view.periods[0].monthlyAmount.cachedValue='0';assert.deepEqual(value,before);
 assert.equal(planSourceCurveView(undefined),null);assert.equal(planSourceCurveView(null),null);
});

test('unknown cumulative percentages break the line while an explicit cached zero remains a data point',()=>{
 const value=curve();value.periods[0].cumulativePercentage=cell('G',66,'0');value.periods[1].cumulativePercentage=cell('H',66,null);
 const view=planSourceCurveView(value);assert.equal(view.points[0].y,254);assert.equal(view.points[1].y,null);assert.equal(view.points[2].y,34);
 assert.deepEqual(view.segments.map(segment=>segment.map(point=>point.ordinal)),[[1],[3]]);
 const markup=html(value);assert.deepEqual(polyline(markup),[]);assert.equal((markup.match(/<circle/g)??[]).length,2);assert.match(markup,/Sin dato/);
});

test('invalid curve semantics, provenance, ordinal continuity and unsafe numeric flags fail closed',()=>{
 const mutate=[value=>{value.currency='ARS';},value=>{value.calendarStart='2026-01-01';},value=>{value.kind='EXECUTED';},value=>{value.periods[1].ordinal=3;},value=>{value.periods[0].monthlyAmount.cachedValue=12;},value=>{value.periods[0].monthlyAmount.hasFormula='true';},value=>{value.periods[0].monthlyAmount.cachedValue=null;},value=>{value.total.cachedValue=null;},value=>{value.periods[0].cumulativePercentage.cachedValue='1.000000000000000000000001';},value=>{value.periods[0].cumulativePercentage.cachedValue='-0.00000000000000000000001';},value=>{value.periods[0].monthlyAmount.cachedValue='-0.00000000000000000000001';},value=>{value.periods[0].cumulativePercentage.cachedValue='Infinity';},value=>{value.periods[0].monthlyAmount.cachedValue='1e101';},value=>{value.periods[0].monthlyAmount.sourceCell='Other source!G60';},value=>{value.periods[1].monthlyAmount.sourceCell='Plan y curva Meses!G60';},value=>{value.periods[0].cumulativePercentage.sourceCell='Plan y curva Meses!G61';},value=>{value.periods[0].actualProgress='0';}];
 for(const change of mutate){const value=curve();change(value);assert.throws(()=>planSourceCurveView(value));const markup=html(value);assert.match(markup,/No se puede mostrar la curva prevista/);assert.doesNotMatch(markup,/<svg|<table|<circle|<polyline/);}
});

test('actual component presents source investment, currency uncertainty, exact values and ordinal months',()=>{
 const value=curve(),before=structuredClone(value),markup=html(value);
 assert.match(markup,/Inversión prevista del archivo/);assert.match(markup,/Moneda por confirmar/);assert.match(markup,/sin recalcular fórmulas/);assert.match(markup,/meses son ordinales, sin fechas calendario/);
 assert.match(markup,/12\.345\.678\.901\.234\.567\.890,123456789000/);assert.match(markup,/<code>12345678901234567890\.123456789000<\/code>/);assert.match(markup,/Plan y curva Meses!G60/);
 assert.match(markup,/No se importaron datos de inversión ejecutada para comparar/);assert.match(markup,/no acredita gastos, certificaciones ni avance físico/);
 assert.doesNotMatch(markup,/ARS|USD|\$|2026-|enero|febrero|data-executed|executedCurve/i);assert.deepEqual(value,before);
});

test('task exclusions change only the visible counts and never subset or recalculate the complete source curve',()=>{
 const value=curve(),whole=html(value,{sourceRowCount:5,selectedRowCount:5}),subset=html(value,{sourceRowCount:5,selectedRowCount:1});
 assert.match(subset,/Fuente original: 5 rubros\. Tareas elegidas: 1/);assert.match(subset,/La selección de tareas no recalcula esta curva/);
 assert.deepEqual(polyline(whole),polyline(subset));assert.equal((subset.match(/<th scope="row">Mes [123]<\/th>/g)??[]).length,3);
 assert.match(subset,/<code>999\.9900<\/code>/);assert.match(subset,/<code>12345678901234568890\.113456789000<\/code>/);
 assert.doesNotMatch(html(value,{sourceRowCount:5,selectedRowCount:6}),/Fuente original: 5/);
});

test('applied and draft views preserve the same cached curve and applied status is only explanatory copy',()=>{
 const value=curve(),draft=html(value),applied=html(value,{status:'APPLIED'});
 assert.deepEqual(polyline(applied),polyline(draft));assert.match(applied,/previsión del archivo original del plan aplicado/);
 assert.doesNotMatch(draft,/previsión del archivo original del plan aplicado/);assert.doesNotMatch(applied,/<input|<form|type="submit"/);
});

test('all missing cached percentages produce no plotted line or invented zero markers',()=>{
 const value=curve();for(const period of value.periods){period.cumulativePercentage.cachedValue=null;period.cumulativePercentage.hasFormula=false;}
 const markup=html(value);assert.doesNotMatch(markup,/<circle|<polyline/);assert.match(markup,/Los datos ausentes interrumpen la línea/);
 assert.equal((markup.match(/<button[^>]*>Mes [123]<\/button>/g)??[]).length,3);assert.match(markup,/Sin dato/);
});

test('accessible source tables, chart description and native month controls remain usable without financial inference',()=>{
 const markup=html(curve());assert.match(markup,/viewBox="0 0 900 310" role="group" aria-labelledby=/);
 assert.match(markup,/<title[^>]*>Porcentaje acumulado previsto del archivo<\/title>/);assert.match(markup,/Usá las flechas, Inicio o Fin/);
 assert.equal((markup.match(/<table/g)??[]).length,2);assert.equal((markup.match(/<caption>/g)??[]).length,2);assert.match(markup,/scope="col"/);assert.match(markup,/scope="row"/);
 assert.match(markup,/<button[^>]*type="button"[^>]*aria-pressed="true"[^>]*tabindex="0"[^>]*>Mes 1/);
 assert.match(markup,/Valores y referencias originales del archivo/);assert.match(markup,/Una celda sin dato no se interpreta como cero/);
});

test('legacy absent curves render nothing and malformed present curves never become an empty investment chart',()=>{
 assert.equal(html(undefined),'');assert.equal(html(null),'');
 assert.match(html({...curve(),periods:[]}),/No se puede mostrar la curva prevista/);
});

test('actual month keyboard handlers move and focus the ordinal controls within the complete source bounds',()=>{
 interactive.reset();let focused=null;
 const render=()=>{const tree=interactive.render({curve:curve(),status:'READY'}),buttons=elements(tree,node=>node.type==='button');buttons.forEach((button,i)=>button.props.ref({focus:()=>{focused=i;}}));return buttons;};
 let buttons=render(),prevented=false;buttons[0].props.onKeyDown({key:'ArrowRight',preventDefault:()=>{prevented=true;}});
 assert.equal(prevented,true);assert.equal(interactive.selection(),1);assert.equal(focused,1);
 buttons=render();assert.equal(buttons[1].props['aria-pressed'],true);assert.equal(buttons[1].props.tabIndex,0);assert.equal(buttons[0].props.tabIndex,-1);
 buttons[1].props.onKeyDown({key:'End',preventDefault:()=>{}});assert.equal(interactive.selection(),2);assert.equal(focused,2);
 buttons=render();buttons[2].props.onKeyDown({key:'ArrowRight',preventDefault:()=>{}});assert.equal(interactive.selection(),2);
 buttons[2].props.onKeyDown({key:'Home',preventDefault:()=>{}});assert.equal(interactive.selection(),0);assert.equal(focused,0);
 assert.equal(sourceCurveKeyboardIndex('Tab',0,3),null);assert.equal(sourceCurveKeyboardIndex('End',0,0),null);
});

test('actual hover and click handlers select cached source months including an unknown amount without writing the source',()=>{
 interactive.reset();const value=curve(),before=structuredClone(value);let tree=interactive.render({curve:value,status:'READY'});
 const chartMonths=elements(tree,node=>node.type==='g'&&node.props.role==='button');chartMonths[1].props.onPointerEnter();assert.equal(interactive.selection(),1);
 tree=interactive.render({curve:value,status:'READY'});const selected=elements(tree,node=>node.props?.['aria-label']==='Valores previstos del mes 2')[0];
 const text=renderToStaticMarkup(selected);assert.match(text,/Importe mensual previsto/);assert.match(text,/>0<\/dd>/);assert.match(text,/Sin dato/);
 elements(tree,node=>node.type==='button')[2].props.onClick();assert.equal(interactive.selection(),2);assert.deepEqual(value,before);
});

test('responsive chart motion has an explicit reduced motion override and scroll is confined to source tables',()=>{
 const css=readFileSync(new URL('../src/app/(identity)/cuenta/plan-source-curve.module.css',import.meta.url),'utf8');
 assert.match(css,/\.chart svg\{[^}]*width:100%[^}]*height:auto/);assert.match(css,/\.tableScroll\{[^}]*max-width:100%[^}]*overflow:auto/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.curve\{animation:none\}\.point,\.selectedPoint\{transition:none\}\}/);
 assert.match(css,/min-height:44px/);assert.match(css,/:focus-visible/);
});

const panelSource=readFileSync(new URL('../src/app/(identity)/cuenta/plan-import-panel.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const stateNames=[...panelSource.matchAll(/\[([A-Za-z]+),set[A-Za-z]+\]=useState/g)].map(match=>match[1]);
const panelHooks=`import React from ${JSON.stringify(reactUrl)};
const styles={},stateNames=${JSON.stringify(stateNames)};
let states=[],refs=[],stateCursor=0,refCursor=0,queue=[];
const useState=initial=>{const index=stateCursor++;if(!(index in states))states[index]=initial;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];};
const useRef=initial=>{const index=refCursor++;return refs[index]??(refs[index]={current:initial});};
const useEffect=()=>{},useCallback=value=>value;
const FileUp=()=>null,FileCheck2=()=>null,Download=()=>null,TriangleAlert=()=>null,PlanSourceCurve=()=>React.createElement('div',{'data-source-curve':true});
const useWorkspaceRequest=()=>async(url,options,consume)=>{const next=queue.shift();if(!next)throw new Error('Unexpected request in private panel test');if(next.error)throw next.error;return consume({ok:(next.status??200)<400,status:next.status??200,json:async()=>{if(next.jsonError)throw next.jsonError;return next.wait?await next.wait:next.data;},blob:async()=>next.blobWait?await next.blobWait:new Blob(['synthetic'])});};
const browserRecoveryJournal={list:async()=>[],migratePlanImportAttempt:async()=>{}},RECOVERY_EVENT='synthetic-recovery',recoveryResult=(reference,data)=>data?.draft?{state:'RECORDED'}:null,planImportCommandDigest=async()=>"a".repeat(64),planImportUploadFormDigest=async()=>"b".repeat(64);
`;
const panelCompiled=await transform(panelHooks+panelSource+`
export const reset=()=>{states=[];refs=[];queue=[];};export const respond=value=>queue.push(value);export const seed=value=>{for(const [key,item] of Object.entries(value)){const index=stateNames.indexOf(key);if(index<0)throw new Error('Unknown panel state');states[index]=item;}};
export const snapshot=()=>Object.fromEntries(stateNames.map((name,index)=>[name,states[index]]));export const references=()=>refs;
export const render=props=>{stateCursor=0;refCursor=0;return PlanImportPanel(props);};
`,{filename:'plan-import-panel.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const panel=await import('data:text/javascript;base64,'+Buffer.from(panelCompiled.code).toString('base64'));
const panelContext={projectId:'project-synthetic',scope:'c'.repeat(64),getSessionToken:async()=>assert.fail('No provider call is permitted')};
const privateDraft=()=>({id:'draft-synthetic',revision:1,status:'READY',createdAt:'2026-01-01T00:00:00Z',sourceAvailable:true,source:{sha256:'d'.repeat(64),contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},warnings:[],rows:[{sourceRowId:'Plan y curva Meses!A10',title:'Rubro sintético',startsOn:'2026-01-01',endsOn:'2026-01-02',evidence:'Fuente sintética',uncertainty:''}],spreadsheet:{version:3,rowCount:1,worksheet:'Plan y curva Meses',detailRowsExcluded:0,periodOrdinals:[1,2,3],items:[],curve:curve(),reviewed:true}});
const textContent=node=>node===null||node===undefined||typeof node==='boolean'?'':typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(textContent).join(''):textContent(node.props?.children);
const buttonText=node=>elements(node,element=>element.type==='button').map(element=>[element,textContent(element)]);
function panelButton(tree,text){const value=buttonText(tree).find(([,label])=>label===text)?.[0];assert.ok(value,`Expected visible ${text} control`);return value;}
async function openPanel(value,{canApprove=true,drafts=[value]}={}){
 panel.reset();let tree=panel.render(panelContext);panel.respond({data:{...panelContext,canApprove,drafts,truncated:false}});await panelButton(tree,'Importar PDF, imagen o Excel').props.onClick();
 tree=panel.render(panelContext);panel.respond({data:{...panelContext,draft:value}});await elements(tree,node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children.includes(' tareas'))[0].props.onClick();
 panel.seed({recoveryReady:true,reason:'Revisión sintética del archivo',receipt:'receipt-synthetic',file:new File(['synthetic'],'source-synthetic.xlsx',{type:value.source.contentType}),consent:true,approved:true});
 tree=panel.render(panelContext);elements(tree,node=>node.type==='input'&&node.props.type==='file')[0].props.ref.current={value:'source-synthetic.xlsx'};
 return tree;
}
const assertPrivateCleared=()=>{
 const current=panel.snapshot();assert.equal(current.draft,null);assert.deepEqual(current.rows,[]);assert.equal(current.file,null);assert.equal(current.receipt,null);assert.equal(current.reason,'');assert.equal(current.consent,false);assert.equal(current.approved,false);assert.equal(current.spreadsheetSelection,'');assert.equal(current.retryAllowed,false);
 const tree=panel.render(panelContext);assert.equal(elements(tree,node=>node.type==='fieldset').length,0);assert.equal(elements(tree,node=>typeof node.type==='function'&&node.type.name==='PlanSourceCurve').length,0);
 return current;
};

let cypSourcePromise;
async function cypPrivateDraft(){
 cypSourcePromise??=extractCypCurveOoxml(cypCurveFixture(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 const extraction=structuredClone(await cypSourcePromise);return {...privateDraft(),rows:extraction.rows,spreadsheet:{...extraction.spreadsheet,reviewed:false}};
}

test('CyP component preserves exact source decimals and empty initial base under an explicit profile, with physical-task counts',async()=>{
 const draft=await cypPrivateDraft(),value=draft.spreadsheet.curve,before=structuredClone(value),props={profile:'CYP_PARTIDAS_CURVE',sourceRowCount:190,selectedRowCount:3};
 const view=planSourceCurveView(value,{profile:props.profile});assert.deepEqual(view.periods,value.periods);assert.deepEqual(view.initialCumulative,{sourceCell:'Plan de trabajo!I236',cachedValue:null,hasFormula:false});assert.throws(()=>planSourceCurveView(value));
 const markup=html(value,props);assert.match(markup,/190 partidas físicas/);assert.match(markup,/Tareas elegidas: 3/);assert.match(markup,/costos adicionales/);assert.match(markup,/Plan de trabajo!I233/);assert.match(markup,/Curva de Inversion!L34/);assert.match(markup,/12\.345\.678\.901\.234\.567\.890,1234500/);assert.match(markup,/Acumulado inicial[^<]*<\/dt><dd>Sin dato/);
 assert.deepEqual(polyline(markup),polyline(html(value,{...props,selectedRowCount:190})));assert.deepEqual(value,before);
 const mixed=structuredClone(value);mixed.periods[0].monthlyAmount.sourceCell='Curva de Inversion!A32';assert.throws(()=>planSourceCurveView(mixed,{profile:props.profile}));assert.match(html(mixed,props),/No se puede mostrar/);
});

test('CyP profile remains a separate ADMIN/DIRECTOR opt-in with explicit financial consent and physical row review',async()=>{
 panel.reset();panel.render(panelContext);panel.seed({open:true,file:new File(['synthetic'],'source.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),canApprove:false,recoveryReady:true});
 let tree=panel.render(panelContext),option=elements(tree,node=>node.type==='option'&&node.props.value==='CYP_PARTIDAS_CURVE')[0];assert.equal(option.props.disabled,true);
 panel.seed({canApprove:true});tree=panel.render(panelContext);option=elements(tree,node=>node.type==='option'&&node.props.value==='CYP_PARTIDAS_CURVE')[0];assert.equal(option.props.disabled,false);
 const select=elements(tree,node=>node.type==='select')[0];select.props.onChange({target:{value:'CYP_PARTIDAS_CURVE'}});tree=panel.render(panelContext);const text=textContent(tree);assert.match(text,/curva completa de inversión prevista de CyP/);assert.match(text,/no se recalculan fórmulas/);assert.equal(panel.snapshot().consent,false);
 const draft=await cypPrivateDraft();tree=await openPanel(draft);const component=elements(tree,node=>typeof node.type==='function'&&node.type.name==='PlanSourceCurve')[0];assert.equal(component.props.profile,'CYP_PARTIDAS_CURVE');assert.equal(elements(tree,node=>node.type==='fieldset').length,20);assert.match(textContent(tree),/Código original: A\.1\.1\.1/);assert.doesNotMatch(textContent(tree),/Rubro original: /);
});

test('CyP panel purges financial RAM and listings on downgrade and blocks late private results while preserving recovery references',async()=>{
 const value=await cypPrivateDraft();let tree=await openPanel(value);panel.respond({error:new Error('Synthetic lost confirmation')});await panelButton(tree,'Guardar correcciones').props.onClick();const pending=structuredClone(panel.snapshot().attempt);
 tree=panel.render(panelContext);let resolve;const wait=new Promise(done=>{resolve=done;});panel.respond({wait});const late=elements(tree,node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children.includes(' tareas'))[0].props.onClick();
 panel.respond({data:{...panelContext,canApprove:false,drafts:[value],truncated:false}});await panelButton(tree,'Consultar borradores registrados').props.onClick();assertPrivateCleared();assert.deepEqual(panel.snapshot().drafts,[]);
 resolve({...panelContext,draft:value});await late;const current=assertPrivateCleared();assert.deepEqual(current.attempt,pending);assert.deepEqual(panel.references()[2].current,pending);assert.equal(panel.references()[4].current,null);
});

test('financial pending/failed drafts remain private after reload, reject stale reads and remove private file/listings on downgrade',async()=>{
 for(const status of ['UPLOADING','PROCESSING','FAILED']){
  const value={...privateDraft(),status,rows:[],financialSource:true};delete value.spreadsheet;let tree=await openPanel(value);assert.equal(panel.references()[5].current,true);assert.equal(elements(tree,node=>typeof node.type==='function'&&node.type.name==='PlanSourceCurve').length,0);
  const reference={version:1,resource:'plan-import',scope:panelContext.scope,projectId:panelContext.projectId,operationId:'01234567-89ab-4cde-8fab-0123456789ab',createdAt:Date.now(),action:'UPLOAD',inputDigest:'a'.repeat(64)};panel.seed({attempt:reference});panel.references()[2].current=reference;tree=panel.render(panelContext);
  let resolve;const wait=new Promise(done=>{resolve=done;});panel.respond({wait});const late=elements(tree,node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children.includes(' tareas'))[0].props.onClick();
  panel.respond({data:{...panelContext,canApprove:false,drafts:[value],truncated:false}});await panelButton(tree,'Consultar borradores registrados').props.onClick();assertPrivateCleared();assert.deepEqual(panel.snapshot().drafts,[]);
  resolve({...panelContext,draft:value});await late;assertPrivateCleared();
 }
});

test('a failed financial source download cannot create a file URL after a current permission denial',async()=>{
 const value={...privateDraft(),status:'FAILED',rows:[],financialSource:true};delete value.spreadsheet;const tree=await openPanel(value);let resolve;const blobWait=new Promise(done=>{resolve=done;});panel.respond({blobWait});const late=panelButton(tree,'Descargar fuente').props.onClick();
 panel.respond({status:403,data:{code:'PLAN_IMPORT_PERMISSION_REQUIRED'}});await elements(tree,node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children.includes(' tareas'))[0].props.onClick();assertPrivateCleared();
 let urls=0;const original=URL.createObjectURL;URL.createObjectURL=()=>{urls++;throw new Error('No stale file URL may be created');};try{resolve(new Blob(['synthetic financial source']));await late;assert.equal(urls,0);assertPrivateCleared();}finally{URL.createObjectURL=original;}
});

test('real private panel download denial drops private data and exact retry RAM while retaining pending receipt references',async()=>{
 let tree=await openPanel(privateDraft());panel.respond({error:Object.assign(new Error('Synthetic lost confirmation'),{status:503})});await panelButton(tree,'Guardar correcciones').props.onClick();
 const pending=structuredClone(panel.snapshot().attempt),reference=structuredClone(panel.references()[2].current);assert.ok(pending);assert.equal(panel.references()[4].current.privateCurve,true);
 tree=panel.render(panelContext);panel.respond({status:403,data:{code:'PLAN_IMPORT_PERMISSION_REQUIRED'}});await panelButton(tree,'Descargar fuente').props.onClick();
 const current=assertPrivateCleared();assert.deepEqual(current.attempt,pending);assert.deepEqual(panel.references()[2].current,reference);assert.equal(panel.references()[4].current,null);assert.equal(panel.references()[1].current.value,'');assert.equal(current.canApprove,false);
});

test('real private panel role downgrade removes open source and private listings without erasing a pending reference',async()=>{
 const value=privateDraft();let tree=await openPanel(value);panel.respond({error:Object.assign(new Error('Synthetic lost confirmation'),{status:503})});await panelButton(tree,'Guardar correcciones').props.onClick();
 const pending=structuredClone(panel.snapshot().attempt);tree=panel.render(panelContext);panel.respond({data:{...panelContext,canApprove:false,drafts:[value],truncated:false}});await panelButton(tree,'Consultar borradores registrados').props.onClick();
 const current=assertPrivateCleared();assert.deepEqual(current.attempt,pending);assert.deepEqual(current.drafts,[]);assert.equal(current.canApprove,false);
});

test('real legacy panel preserves its source and corrections on denial while private listing entries are removed',async()=>{
 const value=privateDraft();value.spreadsheet={version:1,rowCount:1,worksheet:'Plan y curva Meses',detailRowsExcluded:0,periodOrdinals:[1,2,3],reviewed:true};
 const tree=await openPanel(value,{drafts:[value,{...privateDraft(),id:'draft-private-other'}]}),before=panel.snapshot();panel.respond({status:403,data:{code:'PLAN_IMPORT_PERMISSION_REQUIRED'}});await panelButton(tree,'Descargar fuente').props.onClick();
 const current=panel.snapshot();for(const field of ['draft','rows','file','reason','receipt','consent','approved'])assert.equal(current[field],before[field]);
 assert.equal(elements(panel.render(panelContext),node=>node.type==='fieldset').length,1);
 assert.deepEqual(current.drafts,[value]);
});

test('real private panel rejects crossed response context and clears monetary draft without accepting the response',async()=>{
 const tree=await openPanel(privateDraft());panel.respond({data:{...panelContext,scope:'e'.repeat(64),draft:privateDraft()}});
 const saved=elements(tree,node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children.includes(' tareas'))[0];await saved.props.onClick();
 assertPrivateCleared();assert.match(panel.snapshot().message,/La respuesta no corresponde a esta obra/);
});

test('late private draft response cannot repopulate the panel after a known permission denial',async()=>{
 const tree=await openPanel(privateDraft());let resolve;const wait=new Promise(done=>{resolve=done;});panel.respond({wait});
 const saved=elements(tree,node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children.includes(' tareas'))[0],late=saved.props.onClick();
 panel.respond({status:403,data:{code:'PLAN_IMPORT_PERMISSION_REQUIRED'}});await panelButton(tree,'Descargar fuente').props.onClick();assertPrivateCleared();
 resolve({...panelContext,draft:privateDraft()});await late;assertPrivateCleared();
});

test('pending reload with no private RAM rejects a late private recovery after a current authorization denial',async()=>{
 panel.reset();panel.render(panelContext);
 const reference={version:1,resource:'plan-import',scope:panelContext.scope,projectId:panelContext.projectId,operationId:'c28fbf00-8d59-43c9-af90-4c350b127857',createdAt:0};
 panel.seed({open:true,recoveryReady:true,attempt:reference});panel.references()[2].current=reference;
 const tree=panel.render(panelContext);let resolve;const wait=new Promise(done=>{resolve=done;});panel.respond({wait});const late=panelButton(tree,'Comprobar resultado').props.onClick();
 panel.respond({status:403,data:{code:'WORKSPACE_CONTEXT_CHANGED'}});await panelButton(tree,'Consultar borradores registrados').props.onClick();
 resolve({...panelContext,operationId:reference.operationId,action:'EDIT',draft:privateDraft(),receiptId:'receipt-synthetic'});await late;
 const current=assertPrivateCleared();assert.deepEqual(current.attempt,reference);assert.deepEqual(panel.references()[2].current,reference);assert.match(current.message,/Cambió tu organización o tu permiso/);
});

test('private download clears monetary content on a 403 with an unreadable denial body and retains the pending reference',async()=>{
 let tree=await openPanel(privateDraft());panel.respond({error:new Error('Synthetic lost confirmation')});await panelButton(tree,'Guardar correcciones').props.onClick();const pending=structuredClone(panel.snapshot().attempt);
 tree=panel.render(panelContext);panel.respond({status:403,jsonError:new SyntaxError('Synthetic HTML instead of JSON')});await panelButton(tree,'Descargar fuente').props.onClick();
 const current=assertPrivateCleared();assert.deepEqual(current.attempt,pending);assert.deepEqual(panel.references()[2].current,pending);assert.match(current.message,/Tu permiso actual no autoriza esta acción/);assert.doesNotMatch(current.message,/SyntaxError|HTML|JSON/);
});

test('private draft read clears monetary content on a 401 with an unreadable body without treating it as a receipt',async()=>{
 let tree=await openPanel(privateDraft());panel.respond({error:new Error('Synthetic lost confirmation')});await panelButton(tree,'Guardar correcciones').props.onClick();const pending=structuredClone(panel.snapshot().attempt);
 tree=panel.render(panelContext);panel.respond({status:401,jsonError:new SyntaxError('Synthetic empty authentication response')});const saved=elements(tree,node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children.includes(' tareas'))[0];await saved.props.onClick();
 const current=assertPrivateCleared();assert.deepEqual(current.attempt,pending);assert.deepEqual(panel.references()[2].current,pending);assert.match(current.message,/Tu sesión terminó\. Volvé a ingresar/);assert.doesNotMatch(current.message,/SyntaxError|authentication/);
});
