import './helpers/field-hours-network-guard.mjs';
import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {ownRuntimeDiagnosticFixture,assertDiagnosticNoEffects} from './fixtures/own-runtime-diagnostic.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {ownCompanyRuntimeDiagnostic,ownCompanyRuntimeBusinessEvidence} from '../src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs';

let BusinessCheck;
after(()=>assert.deepEqual(globalThis.__hoursExportNetworkGuard.attempts,[],'The business observation tests must never attempt real network or database access.'));
before(async()=>{
 await loadBindings();
 const account=new URL('../src/app/(identity)/cuenta/',import.meta.url);
 // Compile the actual component and formatter. Only imports unused by this
 // named presentation component are removed; no markup is reimplemented.
 const source=readFileSync(new URL('own-company-number-panel.js',account),'utf8').replace(/^import .*;\r?\n/gm,'');
 const imports=`import React from ${JSON.stringify(import.meta.resolve('react'))};\nimport {ownCompanyRuntimeBusinessEvidence} from ${JSON.stringify(new URL('own-company-runtime-diagnostic-view.mjs',account).href)};\nconst styles={};\n`;
 const compiled=await transform(imports+source,{filename:'actual-own-company-business-check.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
 ({OwnCompanyBusinessCheck:BusinessCheck}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64')));
});
const render=(diagnostic,now)=>renderToStaticMarkup(React.createElement(BusinessCheck,{diagnostic,now}));

test('fresh server business evidence follows all real audited GETs and contains only booleans and its observation time',async()=>{
 const f=await ownRuntimeDiagnosticFixture(),value=await f.diagnose();
 assert.deepEqual(value.businessAssets,{systemUserAssigned:true,appOwned:true,wabaOwned:true,phoneInWaba:true,checkedAt:value.observedAt});
 const expected=['system_users','owned_apps','owned_whatsapp_business_accounts'].map(edge=>f.policy.businessId+'/'+edge);
 assert.deepEqual(f.calls.filter(call=>expected.includes(call.path)).map(call=>call.path),expected);
 assert.ok(f.calls.some(call=>call.path===f.policy.wabaId+'/phone_numbers'));
 assert.ok(f.calls.some(call=>call.path===f.policy.wabaId+'/subscribed_apps'));
 assert.ok(Object.isFrozen(value.businessAssets));
 const evidence=ownCompanyRuntimeBusinessEvidence(value,{now:f.time});assert.deepEqual(evidence,value.businessAssets);assert.ok(Object.isFrozen(evidence));
 const encoded=JSON.stringify(value);for(const secret of [f.token,f.connection.encryptedAccessToken,f.policy.appId,f.policy.businessId,f.policy.wabaId,f.policy.phoneNumberId,f.debug.user_id])assert.ok(!encoded.includes(secret));
 assert.equal(value.canManage,false);assert.equal(value.accepted,false);assert.equal(value.roundTrip,'NOT_VERIFIED');assertDiagnosticNoEffects(f);
});

for(const edge of ['system_users','owned_apps','owned_whatsapp_business_accounts'])for(const failure of ['missing','partial'])test(edge+' '+failure+' never produces business evidence or proceeds to phone inspection',async()=>{
 const f=await ownRuntimeDiagnosticFixture();f.state[failure==='missing'?'missingEdge':'pagingEdge']=edge;
 await assert.rejects(f.diagnose(),{code:'META_OWN_COMPANY_OWNER_UNVERIFIED'});
 assert.ok(!f.calls.some(call=>call.path===f.policy.wabaId+'/phone_numbers'));assertDiagnosticNoEffects(f);
});

test('a different owned app cannot substitute for the exact app even with a valid current stored connection',async()=>{
 const f=await ownRuntimeDiagnosticFixture();
 const provider=createMetaCustomerProvider({environment:f.environment,now:()=>f.time,fetchImpl:async(url,options)=>{
  const response=await f.fetchImpl(url,options);
  return new URL(url).pathname.endsWith('/owned_apps')?Response.json({data:[{id:'999000001'}]}):response;
 }});
 await assert.rejects(f.makeService(provider).diagnoseRuntime(f.session,f.request),{code:'META_OWN_COMPANY_OWNER_UNVERIFIED'});
 assertDiagnosticNoEffects(f);
});

for(const mutate of [f=>{f.debug.type='USER';},f=>{f.debug.app_id='999000001';},f=>{f.debug.scopes=f.debug.scopes.filter(scope=>scope!=='business_management');}])test('current exact app SYSTEM_USER and business permission remain mandatory before any ownership claim',async()=>{
 const f=await ownRuntimeDiagnosticFixture();mutate(f);await assert.rejects(f.diagnose(),{code:'META_OWN_COMPANY_TOKEN_REJECTED'});
 assert.ok(!f.calls.some(call=>call.path.endsWith('/owned_apps')));assertDiagnosticNoEffects(f);
});

test('the exact phone must occur in the audited WABA, independently of the stored ACTIVE flag',async()=>{
 const f=await ownRuntimeDiagnosticFixture();f.phone.id='999000001';
 await assert.rejects(f.diagnose(),{code:'META_CUSTOMER_PHONE_WABA_MISMATCH'});assertDiagnosticNoEffects(f);
});

for(const stage of ['owned_apps','phone_numbers','subscribed_apps'])test('provider failure at '+stage+' cannot become a completed business observation',async()=>{
 const f=await ownRuntimeDiagnosticFixture();f.state.failRead=stage==='owned_apps'?f.policy.businessId+'/'+stage:f.policy.wabaId+'/'+stage;
 await assert.rejects(f.diagnose());assertDiagnosticNoEffects(f);
});

test('scope or membership change prevents the evidence from leaving the current canonical context',async()=>{
 for(const mutate of [f=>{f.request.scope='b'.repeat(64);},f=>{f.member.role='DIRECTOR';},f=>{f.session.userId='user_Foreign';}]){
  const f=await ownRuntimeDiagnosticFixture();mutate(f);await assert.rejects(f.diagnose());assert.equal(f.calls.length,0);assertDiagnosticNoEffects(f);
 }
 const f=await ownRuntimeDiagnosticFixture();f.state.afterRead=path=>{if(path===f.policy.wabaId+'/phone_numbers')f.controls.issuerActive=false;};
 await assert.rejects(f.diagnose(),{code:'META_OWN_COMPANY_UNAVAILABLE'});assertDiagnosticNoEffects(f);
});

test('an adapter cannot manufacture evidence by returning stored flags or a copied diagnostic DTO',async()=>{
 const f=await ownRuntimeDiagnosticFixture(),fake={version:1,kind:'OWN_COMPANY_RUNTIME_DIAGNOSTIC',businessAssets:{systemUserAssigned:true,appOwned:true,wabaOwned:true,phoneInWaba:true,checkedAt:new Date(f.time).toISOString()}};
 await assert.rejects(f.makeService({async diagnoseOwnConnection(){return fake;}}).diagnoseRuntime(f.session,f.request),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 assert.equal(f.calls.length,0);assertDiagnosticNoEffects(f);
});

test('real JSX shows the concise business result and expandable admin detail only for a fresh successful observation',async()=>{
 const f=await ownRuntimeDiagnosticFixture(),value=await f.diagnose(),html=render(value,f.time);
 assert.match(html,/Empresa y número comprobados/);assert.match(html,/<details><summary>Ver comprobaciones de la empresa<\/summary>/);
 assert.match(html,/Aplicación perteneciente al negocio/);assert.match(html,/Cuenta de WhatsApp perteneciente al negocio/);assert.match(html,/Número incluido en esa cuenta/);assert.ok(html.includes(value.businessAssets.checkedAt));
 assert.doesNotMatch(html,/SYSTEM_USER|business_management|API|token|Tech Provider|aprobado por Meta|identidad verificada/i);
 assert.match(html,/no cambia la conexión ni confirma la entrega de mensajes/);assertDiagnosticNoEffects(f);
});

test('stored ACTIVE legacy missing partial failed future and expired observations render no verified business result',async()=>{
 const f=await ownRuntimeDiagnosticFixture(),value=await f.diagnose(),legacy={...value};delete legacy.businessAssets;
 const rejected={...value,operationalCheck:'REJECTED',denialStage:'DISPLAY_PHONE_MATCH',displayMatchesExpected:false};
 const invalid=[null,{kind:'OWN_COMPANY_STORED_RUNTIME',operationalGrant:{state:'ACTIVE'},channel:{enabled:true}},legacy,rejected,{...value,businessAssets:{...value.businessAssets,appOwned:false}},{...value,businessAssets:{...value.businessAssets,wabaOwned:undefined}},{...value,businessAssets:{...value.businessAssets,phoneNumberId:f.policy.phoneNumberId}},{...value,businessAssets:{...value.businessAssets,checkedAt:new Date(f.time+1).toISOString()}}];
 for(const item of invalid){assert.equal(ownCompanyRuntimeBusinessEvidence(item,{now:f.time}),null);assert.equal(render(item,f.time),'');}
 assert.equal(render(value,f.time-1),'');assert.match(render(value,f.time+59999),/Empresa y número comprobados/);assert.equal(render(value,f.time+60000),'');
 assert.equal(ownCompanyRuntimeBusinessEvidence(value,{now:NaN}),null);assert.equal(ownCompanyRuntimeBusinessEvidence(value,{now:Number.MAX_SAFE_INTEGER+1}),null);assertDiagnosticNoEffects(f);
});

test('the optional observation is strict deep-frozen and cannot add credentials or authorization to the client DTO',async()=>{
 const f=await ownRuntimeDiagnosticFixture(),value=await f.diagnose(),copy=ownCompanyRuntimeDiagnostic(value);
 assert.ok(Object.isFrozen(copy));assert.ok(Object.isFrozen(copy.businessAssets));assert.notEqual(copy.businessAssets,value.businessAssets);
 for(const patch of [{token:'private'},{businessId:f.policy.businessId},{canManage:true},{checkedAt:'not-a-date'},{systemUserAssigned:'true'}])assert.throws(()=>ownCompanyRuntimeDiagnostic({...value,businessAssets:{...value.businessAssets,...patch}}),{code:'META_OWN_COMPANY_DIAGNOSTIC_UNCONFIRMED'});
 assert.equal(copy.canManage,false);assert.equal(copy.accepted,false);assert.equal(copy.roundTrip,'NOT_VERIFIED');assertDiagnosticNoEffects(f);
});
