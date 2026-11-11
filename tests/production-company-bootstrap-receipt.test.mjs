import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parse} from '@babel/parser';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

const source=readFileSync(new URL('../src/app/(identity)/cuenta/company-bootstrap-panel.js',import.meta.url),'utf8');
const tree=parse(source,{sourceType:'module',plugins:['jsx']});
const component=tree.program.body.find(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.id?.name==='CompanyBootstrapPanel').declaration;
const ready=component.body.body.find(node=>node.type==='IfStatement'&&node.test.type==='BinaryExpression'&&node.test.operator==='==='&&node.test.left.name==='stage'&&node.test.right.value==='ready');
assert.equal(ready.consequent.type,'ReturnStatement');
const readyJsx=source.slice(ready.consequent.argument.start,ready.consequent.argument.end);
const acceptNode=component.body.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='accept');
assert.ok(acceptNode);
const acceptSource=source.slice(acceptNode.start,acceptNode.end);
const enterNode=component.body.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='enterFirstProject');
assert.ok(enterNode);
const enterSource=source.slice(enterNode.start,enterNode.end);
const alreadyConfiguredBodies=[];
function collectConfigured(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='IfStatement'&&node.test.type==='BinaryExpression'&&node.test.operator==='==='&&node.test.left.type==='MemberExpression'&&node.test.left.object.name==='value'&&node.test.left.property.name==='state'&&node.test.right.value==='ALREADY_CONFIGURED')alreadyConfiguredBodies.push(source.slice(node.consequent.start,node.consequent.end));
 for(const value of Object.values(node))if(Array.isArray(value))value.forEach(collectConfigured);else if(value&&typeof value==='object')collectConfigured(value);
}
collectConfigured(component.body);assert.equal(alreadyConfiguredBodies.length,3);
// Render the exact ready JSX with real React and the actual trial component.
// The exact accept function and ALREADY_CONFIGURED blocks are also extracted
// from the production AST and invoked with recording setters. No hooks are
// replaced and no transport is run. This does not test browser/effect scheduling.
await loadBindings();
const compiled=await transform(`import React,{useCallback,useEffect,useRef,useState} from ${JSON.stringify(import.meta.resolve('react'))};
const styles={created:'created',caption:'caption',notice:'notice'};
${source.replace(/^import .*;\r?\n/gm,'')}
export const renderReady=({receipt,currentCompany,children,notice='',onEnterFirstProject,firstProjectNavigationBlocked=false,locked=false,setStage=()=>{}})=>{
 ${enterSource}
 return ${readyJsx};
};
export function acceptTransition(value,openWorkspace,bindings){
 const {version,retainedProfileProof,setCurrentCompany,setBusy,setReceipt,setAttempt,setCanRetry,setStage,setNotice}=bindings;
 ${acceptSource}
 return accept(value,openWorkspace);
}
export const alreadyConfiguredTransitions=[${alreadyConfiguredBodies.map(body=>`(value,bindings)=>{const {setCurrentCompany,setNotice,retainedProfileProof,setAttempt,setStage}=bindings;${body}}`).join(',')}];`,{filename:'actual-company-ready-receipt.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const {renderReady,CompanyTrialExpiry,acceptTransition,alreadyConfiguredTransitions}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const receipt=Object.freeze({state:'CREATED',created:true,organizationId:'company-synthetic',projectId:'project-synthetic',companyName:'Empresa sintética',projectName:'Obra sintética',initialTaskCount:3,receiptId:'company_bootstrap_'+'a'.repeat(64)});
const currentCompany=Object.freeze({trial:{endsOn:'2026-11-05',endsAt:'2026-11-05T18:00:00.000Z'}});
const daily=React.createElement('main',{id:'daily-workspace'},'Panel diario sintético');
const readyNotice='Alta confirmada. Podés consultar el recibo original y continuar en tu espacio.';
const render=(value=receipt,company=currentCompany,notice=readyNotice)=>renderReady({receipt:value,currentCompany:company,children:daily,notice});
const children=node=>React.Children.toArray(node.props?.children);
function descendants(node,predicate,result=[]){if(!node||typeof node!=='object')return result;if(predicate(node))result.push(node);for(const child of children(node))descendants(child,predicate,result);return result;}
const text=node=>typeof node==='string'||typeof node==='number'?String(node):children(node).map(text).join('');

test('ready receipt is one native disclosure closed by default with a clear accessible summary',()=>{
 const fragment=render(),details=descendants(fragment,node=>node.type==='details');assert.equal(details.length,1);
 const disclosure=details[0],summary=children(disclosure)[0];assert.equal(Object.hasOwn(disclosure.props,'open'),false);assert.equal(Object.hasOwn(disclosure.props,'onToggle'),false);assert.equal(summary.type,'summary');assert.equal(text(summary),'Ver recibo original del alta');assert.equal(summary.props['aria-hidden'],undefined);assert.equal(summary.props.tabIndex,undefined);
 const html=renderToStaticMarkup(fragment);assert.match(html,/<details class="created"><summary>Ver recibo original del alta<\/summary>/);assert.doesNotMatch(html,/<details[^>]*\bopen(?:[\s=>])/);
});

test('all original headings source values warnings and receipt identifier remain inside the collapsed receipt',()=>{
 const disclosure=descendants(render(),node=>node.type==='details')[0],section=children(disclosure)[1];assert.equal(section.type,'section');assert.equal(section.props['aria-labelledby'],'company-receipt-heading');
 const heading=descendants(disclosure,node=>node.type==='h2')[0];assert.equal(heading.props.id,'company-receipt-heading');assert.equal(text(heading),'Alta confirmada');assert.equal(text(descendants(disclosure,node=>node.type==='h3')[0]),'Datos del alta');
 const body=text(disclosure);for(const value of ['Este recibo confirma el alta original. Tu espacio de trabajo muestra el estado vigente.','Empresa declarada al crear el espacio',receipt.companyName,'Primera obra registrada',receipt.projectName,'Tareas cargadas en el plan inicial','3','La confirmación del alta no acredita una conexión de WhatsApp ni la aprobación de identidades.','Recibo: '+receipt.receiptId])assert.ok(body.includes(value),value);
 assert.deepEqual(descendants(disclosure,node=>node.type==='dd').map(text),[receipt.companyName,receipt.projectName,'3']);assert.equal(descendants(disclosure,node=>node.type==='small').length,1);assert.equal(descendants(disclosure,node=>node.type==='button'||node.type==='form'||node.type==='input').length,0);
});

test('the recovered receipt offers explicit opening of its exact project only while navigation is unlocked',()=>{
 const opened=[],stages=[],onEnterFirstProject=id=>{opened.push(id);return true;},setStage=stage=>stages.push(stage);
 const renderAction=firstProjectNavigationBlocked=>descendants(renderReady({receipt,currentCompany,children:daily,onEnterFirstProject,firstProjectNavigationBlocked,setStage}),node=>node.type==='button')[0];
 const blocked=renderAction(true);assert.equal(blocked.props.disabled,true);blocked.props.onClick();assert.deepEqual(opened,[]);assert.deepEqual(stages,[]);
 const active=renderAction(false);assert.equal(active.props.disabled,false);assert.equal(text(active),'Abrir primera obra');assert.deepEqual(opened,[]);
 active.props.onClick();assert.deepEqual(opened,[receipt.projectId]);assert.deepEqual(stages,['ready']);
});

test('trial information and the daily workspace stay outside the receipt and retain their existing order',()=>{
 const fragment=render(),parts=children(fragment);assert.equal(parts.length,4);assert.equal(parts[0].type,CompanyTrialExpiry);assert.equal(parts[0].props.company,currentCompany);assert.equal(parts[1].type,'p');assert.equal(parts[1].props.role,'status');assert.equal(parts[2].type,'details');assert.equal(parts[3].type,'main');assert.equal(parts[3].props.id,'daily-workspace');
 const html=renderToStaticMarkup(fragment);assert.ok(html.indexOf('Prueba: vencimiento registrado')<html.indexOf('<details'));assert.ok(html.indexOf('Esta fecha no confirma un plan pago.')<html.indexOf('<details'));assert.ok(html.indexOf('</details>')<html.indexOf('<main id="daily-workspace">'));
});

test('an already configured workspace without an original receipt has no empty disclosure or hidden daily panel',()=>{
 const fragment=render(null),parts=children(fragment);assert.equal(parts.length,2);assert.equal(parts[0].type,CompanyTrialExpiry);assert.equal(parts[1].type,'main');assert.equal(descendants(fragment,node=>node.type==='details').length,0);assert.equal(descendants(fragment,node=>node.props?.role==='status').length,0);
 const html=renderToStaticMarkup(fragment);assert.doesNotMatch(html,/Ver recibo original del alta|Alta confirmada|Recibo:/);assert.match(html,/<main id="daily-workspace">Panel diario sintético<\/main>/);assert.match(html,/Esta fecha no confirma un plan pago\./);
});

test('the confirmed nonempty notice is one polite status outside the still-collapsed original receipt',()=>{
 const fragment=render(),statuses=descendants(fragment,node=>node.props?.role==='status'),disclosure=descendants(fragment,node=>node.type==='details')[0];
 assert.equal(statuses.length,1);assert.equal(text(statuses[0]),readyNotice);assert.equal(statuses[0].props['aria-live'],'polite');assert.equal(statuses[0].props.className,'notice');const directStatuses=children(fragment).filter(node=>node.props?.role==='status');assert.equal(directStatuses.length,1);assert.equal(text(directStatuses[0]),readyNotice);assert.equal(descendants(disclosure,node=>node.props?.role==='status').length,0);
 const html=renderToStaticMarkup(fragment);assert.equal(html.split(readyNotice).length-1,1);assert.equal(html.split('Recibo: '+receipt.receiptId).length-1,1);assert.ok(html.indexOf('role="status"')<html.indexOf('<details'));assert.doesNotMatch(html,/<details[^>]*\bopen(?:[\s=>])/);
});

test('an empty whitespace or non-string notice never creates an empty live region or removes the receipt',()=>{
 for(const notice of ['', '   ', '\n\t', null, undefined, 0, false, {}]){
  const fragment=renderReady({receipt,currentCompany,children:daily,notice});assert.equal(descendants(fragment,node=>node.props?.role==='status').length,0);assert.equal(descendants(fragment,node=>node.type==='details').length,1);assert.equal(descendants(fragment,node=>node.type==='main').length,1);assert.match(renderToStaticMarkup(fragment),/Ver recibo original del alta/);
 }
});

function transitionFixture(seed={}){
 const state={currentCompany:null,busy:true,receipt:null,attempt:{operationId:'00000000-0000-4000-8000-000000000424'},canRetry:true,stage:'new',notice:'Aviso anterior sin confirmación',...seed};
 const bindings={version:{current:7},retainedProfileProof:{current:'synthetic-profile-proof'}};
 for(const name of ['currentCompany','busy','receipt','attempt','canRetry','stage','notice'])bindings['set'+name[0].toUpperCase()+name.slice(1)]=value=>{state[name]=value;};
 return {state,bindings};
}

test('the exact accept function replaces prior notices only after a valid receipt on creation or reload',()=>{
 const value={...receipt,currentCompany};
 for(const openWorkspace of [false,true]){
  const {state,bindings}=transitionFixture();acceptTransition(value,openWorkspace,bindings);
  assert.equal(state.receipt,value);assert.equal(state.currentCompany,currentCompany);assert.equal(state.stage,openWorkspace?'ready':'created');assert.equal(state.notice,openWorkspace?readyNotice:'Empresa y primera obra creadas. WhatsApp todavía no quedó conectado.');assert.equal(state.attempt,null);assert.equal(state.busy,false);assert.equal(state.canRetry,false);assert.equal(bindings.version.current,8);assert.equal(bindings.retainedProfileProof.current,null);
  const fragment=render(state.receipt,state.currentCompany,state.notice);assert.equal(descendants(fragment,node=>node.props?.role==='status').length,1);
 }
});

test('the exact receipt acceptance guard rejects incomplete or unconfirmed responses without replacing any prior state',()=>{
 for(const change of [{created:false},{state:'ALREADY_CONFIGURED'},{receiptId:''},{projectId:''},{organizationId:''}]){
  const {state,bindings}=transitionFixture(),prior={...state};
  assert.throws(()=>acceptTransition({...receipt,...change},true,bindings),/Falta el recibo confirmado del alta/);assert.deepEqual(state,prior);assert.equal(bindings.version.current,7);assert.equal(bindings.retainedProfileProof.current,'synthetic-profile-proof');
 }
});

test('all three exact ALREADY_CONFIGURED branches clear only the notice and retain the verified audit receipt',()=>{
 for(const transition of alreadyConfiguredTransitions)for(const retained of [null,receipt]){
  const {state,bindings}=transitionFixture({receipt:retained,notice:readyNotice});transition({state:'ALREADY_CONFIGURED',currentCompany},bindings);
  assert.equal(state.stage,'ready');assert.equal(state.currentCompany,currentCompany);assert.equal(state.notice,'');assert.equal(state.receipt,retained);assert.equal(bindings.version.current,7);
  const fragment=render(state.receipt,state.currentCompany,state.notice);assert.equal(descendants(fragment,node=>node.props?.role==='status').length,0);assert.equal(descendants(fragment,node=>node.type==='details').length,retained?1:0);assert.equal(descendants(fragment,node=>node.type==='main').length,1);
 }
});
