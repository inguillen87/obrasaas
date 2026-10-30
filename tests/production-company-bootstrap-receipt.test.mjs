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
// Render the exact ready-branch JSX with real React, including the actual trial
// component. No hooks are replaced and the onboarding transport is never run.
// SSR verifies native disclosure markup, not browser layout or keyboard behavior.
await loadBindings();
const compiled=await transform(`import React,{useCallback,useEffect,useRef,useState} from ${JSON.stringify(import.meta.resolve('react'))};
const styles={created:'created',caption:'caption',notice:'notice'};
${source.replace(/^import .*;\r?\n/gm,'')}
export const renderReady=({receipt,currentCompany,children,notice=''})=>${readyJsx};`,{filename:'actual-company-ready-receipt.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const {renderReady,CompanyTrialExpiry}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const receipt=Object.freeze({companyName:'Empresa sintética',projectName:'Obra sintética',initialTaskCount:3,receiptId:'company_bootstrap_'+'a'.repeat(64)});
const currentCompany=Object.freeze({trial:{endsOn:'2026-11-05',endsAt:'2026-11-05T18:00:00.000Z'}});
const daily=React.createElement('main',{id:'daily-workspace'},'Panel diario sintético');
const render=(value=receipt,company=currentCompany,notice='')=>renderReady({receipt:value,currentCompany:company,children:daily,notice});
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

test('trial information and the daily workspace stay outside the receipt and retain their existing order',()=>{
 const fragment=render(),parts=children(fragment);assert.equal(parts.length,3);assert.equal(parts[0].type,CompanyTrialExpiry);assert.equal(parts[0].props.company,currentCompany);assert.equal(parts[1].type,'details');assert.equal(parts[2].type,'main');assert.equal(parts[2].props.id,'daily-workspace');
 const html=renderToStaticMarkup(fragment);assert.ok(html.indexOf('Prueba: vencimiento registrado')<html.indexOf('<details'));assert.ok(html.indexOf('Esta fecha no confirma un plan pago.')<html.indexOf('<details'));assert.ok(html.indexOf('</details>')<html.indexOf('<main id="daily-workspace">'));
});

test('a confirmed alta shows its status notice outside and before the collapsed receipt, and never without a receipt',()=>{
 const notice='Alta confirmada. Podés consultar el recibo original y continuar en tu espacio.';
 const fragment=render(receipt,currentCompany,notice),parts=children(fragment);assert.equal(parts.length,4);assert.equal(parts[0].type,CompanyTrialExpiry);assert.equal(parts[1].type,'p');assert.equal(parts[1].props.role,'status');assert.equal(parts[1].props['aria-live'],'polite');assert.equal(text(parts[1]),notice);assert.equal(parts[2].type,'details');assert.equal(parts[3].type,'main');
 const html=renderToStaticMarkup(fragment);assert.ok(html.indexOf('Esta fecha no confirma un plan pago.')<html.indexOf('<p role="status"'));assert.ok(html.indexOf('<p role="status"')<html.indexOf('<details'));assert.equal(descendants(parts[2],node=>node.type==='p'&&node.props.role==='status').length,0);
 assert.equal(children(render(null,currentCompany,notice)).length,2);assert.doesNotMatch(renderToStaticMarkup(render(null,currentCompany,notice)),/role="status"|Alta confirmada/);
});

test('an already configured workspace without an original receipt has no empty disclosure or hidden daily panel',()=>{
 const fragment=render(null),parts=children(fragment);assert.equal(parts.length,2);assert.equal(parts[0].type,CompanyTrialExpiry);assert.equal(parts[1].type,'main');assert.equal(descendants(fragment,node=>node.type==='details').length,0);
 const html=renderToStaticMarkup(fragment);assert.doesNotMatch(html,/Ver recibo original del alta|Alta confirmada|Recibo:/);assert.match(html,/<main id="daily-workspace">Panel diario sintético<\/main>/);assert.match(html,/Esta fecha no confirma un plan pago\./);
});
