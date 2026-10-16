import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

let fixtureDirectory,WorkspaceToolsNavigation;
before(async()=>{
 await loadBindings();
 const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href,lucideUrl=pathToFileURL(require.resolve('lucide-react')).href;
 const source=readFileSync(new URL('../src/app/(identity)/cuenta/workspace-tools-navigation.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 // Preserve the real hook, icons, navigation policy and JSX. Only CSS class names are stubbed.
 const routingUrl=new URL('../src/app/(identity)/cuenta/workspace-view-routing.mjs',import.meta.url).href;
 const imports=`import React from ${JSON.stringify(reactUrl)};\nimport lucide from ${JSON.stringify(lucideUrl)};\nimport {workspaceDestination,workspaceViewAllowed} from ${JSON.stringify(routingUrl)};\nconst {House,CalendarDays,UsersRound,HardHat,Package,ShoppingBag,BriefcaseBusiness,MessageCircle,Settings2,Clock3,CreditCard}=lucide;\nconst styles=new Proxy({}, {get:(_target,key)=>String(key)});\n`;
 const compiled=await transform(imports+source,{filename:'workspace-tools-navigation.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
 fixtureDirectory=mkdtempSync(path.join(tmpdir(),'obrasaas-workspace-tools-navigation-'));
 const compiledPath=path.join(fixtureDirectory,'workspace-tools-navigation.mjs');writeFileSync(compiledPath,compiled.code);
 ({WorkspaceToolsNavigation}=await import(pathToFileURL(compiledPath).href));
});

after(()=>{
 if(!fixtureDirectory)return;
 const parent=path.resolve(tmpdir()),resolved=path.resolve(fixtureDirectory);
 assert.equal(path.dirname(resolved),parent);
 assert.ok(path.basename(resolved).startsWith('obrasaas-workspace-tools-navigation-'));
 rmSync(resolved,{recursive:true,force:true});
});
const render=props=>renderToStaticMarkup(React.createElement(WorkspaceToolsNavigation,props));
const pendingHrefs=html=>{
 const status=html.match(/<div[^>]*role="status"[^>]*>([\s\S]*?)<\/div>/)?.[1]??'';
 return [...status.matchAll(/<a[^>]*href="([^"]+)"/g)].map(match=>match[1]).sort();
};

test('ADMIN can return to each own WhatsApp action, alone or among other pending work',()=>{
 for(const {pending,expected} of [
  {pending:{ownCompanyNumber:true},expected:['#own-company-number-title']},
  {pending:{ownCompanyTemplates:true},expected:['#own-company-templates-title']},
  {pending:{ownCompanyNumber:true,ownCompanyTemplates:true,companyChannel:true},expected:['#company-channel-title','#own-company-number-title','#own-company-templates-title']},
 ]){
  const html=render({role:'ADMIN',pending});
  assert.match(html,/href="#own-company-number-title"/);
  assert.match(html,/href="#own-company-templates-title"/);
  assert.match(html,/role="status" aria-live="polite"/);
  assert.deepEqual(pendingHrefs(html),expected);
 }
});

test('DIRECTOR integration capability keeps permitted work without exposing ADMIN destinations',()=>{
 for(const {pending,expected} of [
  {pending:{ownCompanyNumber:true,ownCompanyTemplates:true},expected:[]},
  {pending:{ownCompanyNumber:true,ownCompanyTemplates:true,companyChannel:true},expected:['#company-channel-title']},
 ]){
  const html=render({role:'DIRECTOR',canManageIntegrations:true,pending});
  assert.doesNotMatch(html,/href="#(?:own-company-number-title|own-company-templates-title|constructor-crm-title|demo-pilot-title)"/);
  assert.match(html,/href="#customer-whatsapp-title"/);
  assert.deepEqual(pendingHrefs(html),expected);
  if(expected.length===0)assert.doesNotMatch(html,/role="status"/);
 }
});

test('a pending physical quantity review has a direct return link for both authorized planning roles',()=>{
 for(const role of ['ADMIN','DIRECTOR']){
  const html=render({role,canImportPlan:true,canManageIntegrations:true,pending:{planMeasurement:true}});
  assert.deepEqual(pendingHrefs(html),['#plan-measurement-title']);
  assert.match(html,/Metrados por revisar/);
  assert.match(html,/role="status" aria-live="polite"/);
 }
});

test('a stale measurement flag cannot expose the return link without both canonical capabilities',()=>{
 for(const props of [
  {role:'WORKER',canImportPlan:false,canManageIntegrations:false},
  {role:'DIRECTOR',canImportPlan:true,canManageIntegrations:false},
  {role:'ADMIN',canImportPlan:false,canManageIntegrations:true},
 ]){
  const html=render({...props,pending:{planMeasurement:true,field:true}});
  assert.deepEqual(pendingHrefs(html),['#field-title']);
  assert.doesNotMatch(html,/href="#plan-measurement-title"/);
 }
});

test('quantity and schedule reviews keep independent return destinations and completed reviews disappear',()=>{
 const props={role:'ADMIN',canImportPlan:true,canManageIntegrations:true};
 assert.deepEqual(pendingHrefs(render({...props,pending:{plan:true,planMeasurement:true}})),['#plan-import-title','#plan-measurement-title']);
 assert.deepEqual(pendingHrefs(render({...props,pending:{planMeasurement:false}})),[]);
 assert.doesNotMatch(render({...props,pending:{planMeasurement:false}}),/role="status"/);
});
