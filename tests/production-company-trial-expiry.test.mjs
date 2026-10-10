import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {createCompanyOnboardingStore} from '../src/lib/company-onboarding-store.mjs';
import {createCompanyBilling} from '../src/lib/company-billing.mjs';
import {companyBillingView} from '../src/app/(identity)/cuenta/company-billing-view.mjs';

await loadBindings();
const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href;
const source=readFileSync(new URL('../src/app/(identity)/cuenta/company-bootstrap-panel.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const compile=async(initialForm=false)=>{
 const imports=`import React,{useCallback,useEffect,useRef${initialForm?'':',useState'}} from ${JSON.stringify(reactUrl)};\n${initialForm?"const useState=value=>React.useState(value==='checking'?'new':value);":''}\nconst styles={};\n`;
 const output=await transform(imports+source,{filename:'company-bootstrap-panel.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
 return import('data:text/javascript;base64,'+Buffer.from(output.code).toString('base64'));
};
const {CompanyTrialExpiry}=await compile();
// SSR does not run the initial GET. Select only its resulting "new" phase in
// this fixture to render the real form; all other hooks and JSX remain actual.
const {CompanyBootstrapPanel}=await compile(true);
const expiry=company=>renderToStaticMarkup(React.createElement(CompanyTrialExpiry,{company}));
const company=(endsAt,endsOn='2026-10-20')=>({organizationId:'org_trial_fixture',trial:{endsOn,endsAt}});
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_TrialFixture',organizationId:'org_TrialFixture',organizationRole:'org:admin'};
const scope='a'.repeat(64);
function readFixture(value,endsOn='2026-10-20'){
 const queries=[],row={id:'org_trial_fixture',name:'Synthetic company',metadata:{},trialEndsOn:endsOn,trialEndsAtUtc:value,trialEndsAt:value,subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',observedAt:new Date('2026-10-07T00:00:00.000Z')};
 const client={query:async(sql,params=[])=>{
  queries.push({sql,params});
  if(sql.startsWith('SELECT id,name'))return {rows:[row]};
  if(sql.startsWith('SELECT u.id'))return {rows:[{actorId:'user_trial_fixture',membershipId:'member_trial_fixture',role:'ADMIN'}]};
  if(/^(BEGIN |ROLLBACK$|SET LOCAL )/.test(sql))return {rows:[]};
  assert.fail('Unexpected SQL in read-only fixture: '+sql);
 },release:()=>{}};
 return {queries,row,onboarding:createCompanyOnboardingStore({connect:async()=>client}),billing:createCompanyBilling({workspace:{companyRead:async(_session,_input,run)=>run(client,{organizationId:row.id},scope)}})};
}

test('existing company read exposes the stored UTC instant exactly as canonical billing without writes',async()=>{
 const stored=new Date('2026-10-20T16:57:51.718Z'),f=readFixture(stored),before=stored.toISOString();
 const onboarding=await f.onboarding.status(session),billing=await f.billing.read(session,{scope});
 assert.equal(onboarding.state,'ALREADY_CONFIGURED');
 assert.equal(onboarding.currentCompany.trial.endsOn,'2026-10-20');
 assert.equal(onboarding.currentCompany.trial.endsAt,before);
 assert.equal(onboarding.currentCompany.trial.endsAt,billing.subscription.trialEndsAt);
 assert.equal(stored.toISOString(),before);
 assert.equal(typeof onboarding.currentCompany.trial.endsAt,'string');
 assert.ok(f.queries.some(({sql})=>sql.includes('"trialEndsAt" AT TIME ZONE \'UTC\' AS "trialEndsAtUtc"')));
 assert.ok(f.queries.some(({sql})=>sql.startsWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')));
 assert.equal(f.queries.filter(({sql})=>/\b(?:INSERT|UPDATE|DELETE|COMMIT)\b/.test(sql)).length,0);
});

test('null malformed or non-Date canonical values cannot be serialized as a confirmed trial instant',async()=>{
 for(const value of [null,undefined,new Date(NaN),'2026-10-20T16:57:51.718Z',1234,{},[]]){
  const f=readFixture(value),result=await f.onboarding.status(session);
  assert.deepEqual(result.currentCompany.trial,{endsOn:'2026-10-20',endsAt:null});
  assert.equal(f.queries.filter(({sql})=>/\b(?:INSERT|UPDATE|DELETE|COMMIT)\b/.test(sql)).length,0);
 }
});

test('actual expiry banner prioritizes the exact Argentine instant and matches the billing date label',()=>{
 const input=company('2026-10-25T01:00:00.000Z','2026-10-25'),before=structuredClone(input),html=expiry(input);
 const billing={version:1,scope,organization:{id:input.organizationId,name:'Synthetic company'},observedAt:'2026-10-07T00:00:00.000Z',subscription:{plan:'TRIAL',status:'TRIALING',trialEndsAt:input.trial.endsAt,entitlement:{allowed:true,basis:'CURRENT_TRIAL',reasonCode:null}},billing:{state:'CONFIGURATION_PENDING',checkoutAvailable:false,paymentEvidence:'UNOBSERVED'}};
 assert.ok(html.includes(companyBillingView(billing,{scope}).trialExpiryLabel));
 assert.match(html,/24\/10\/2026.*22:00:00 \(hora de Argentina\)/);
 assert.doesNotMatch(html,/25\/10\/2026|hora exacta no está confirmada/);
 assert.match(html,/Esta fecha no confirma un plan pago/);
 assert.deepEqual(input,before);
});

test('historical expiry remains unchanged even after browser clock moves beyond its stored deadline',t=>{
 const input=company('2026-10-20T16:57:51.718Z'),before=structuredClone(input);
 let now=Date.parse('2026-10-06T16:57:51.718Z');
 t.mock.method(Date,'now',()=>now);
 const original=expiry(input);now=Date.parse('2027-01-01T00:00:00.000Z');
 assert.equal(expiry(input),original);
 assert.match(original,/20\/10\/2026.*13:57:51 \(hora de Argentina\)/);
 assert.doesNotMatch(original,/21\/10\/2026|15 días|vigente|activo|renovado|pagado/i);
 assert.deepEqual(input,before);
});

test('missing invalid or normalized UTC instants retain only a valid legacy date without invented midnight',()=>{
 const invalid=[undefined,null,'2026-10-20','2026-10-20T16:57:51','2026-10-20T13:57:51.718-03:00','2026-10-20T16:57:51Z','2026-10-20T16:57:51.7180Z','2026-02-29T00:00:00.000Z','2026-04-31T00:00:00.000Z','2026-10-20T24:00:00.000Z','2026-10-20T16:57:60.000Z',new Date('2026-10-20T16:57:51.718Z'),1234,{},[]];
 for(const value of invalid){
  const html=expiry(company(value));
  assert.match(html,/vencimiento registrado 20\/10\/2026; la hora exacta no está confirmada/);
  assert.doesNotMatch(html,/00:00:00|hora de Argentina/);
 }
 const legacyOnly={trial:{endsOn:'2026-10-20'}};
 assert.match(expiry(legacyOnly),/la hora exacta no está confirmada/);
});

test('invalid legacy dates cannot become a confirmed expiry while valid leap days remain dates only',()=>{
 for(const value of [undefined,null,'2026-02-29','2026-04-31','2026-13-01','2026-00-10','2026-10-00','2026-10-32','20/10/2026','2026-10-20T00:00:00.000Z',1234,{},[]]){
  const html=expiry({trial:{endsAt:null,endsOn:value}});
  assert.match(html,/sin vencimiento exacto confirmado/);
  assert.doesNotMatch(html,/fecha registrada|vencimiento registrado|00:00:00/);
 }
 assert.match(expiry(company(null,'2028-02-29')),/vencimiento registrado 29\/02\/2028; la hora exacta no está confirmada/);
});

test('no company produces no expiry or payment statement',()=>{
 assert.equal(expiry(null),'');assert.equal(expiry(undefined),'');
});

test('real new-company form announces the trial before confirmation and describes both checkbox and submit',()=>{
 const forbidden=()=>assert.fail('SSR cannot request credentials, read providers or create a company');
 const html=renderToStaticMarkup(React.createElement(CompanyBootstrapPanel,{organizationId:session.organizationId,organizationName:'Synthetic company',getSessionToken:forbidden,getProfileToken:forbidden}));
 const notice=html.indexOf('<p id="company-trial-notice"'),checkbox=html.indexOf('type="checkbox"'),submit=html.indexOf('type="submit"');
 assert.ok(notice>=0&&checkbox>notice&&submit>checkbox);
 assert.match(html,/Al crear la empresa empieza una prueba de 15 días desde el alta/);
 assert.match(html,/Recuperar un alta existente no reinicia la prueba/);
 assert.equal((html.match(/id="company-trial-notice"/g)||[]).length,1);
 assert.equal((html.match(/aria-describedby="company-trial-notice"/g)||[]).length,2);
 assert.match(html,/<input[^>]*type="checkbox"[^>]*aria-describedby="company-trial-notice"/);
 assert.match(html,/<button[^>]*type="submit"[^>]*disabled=""[^>]*aria-describedby="company-trial-notice">Crear empresa y primera obra<\/button>/);
 assert.doesNotMatch(html,/vencimiento registrado|hora exacta no está confirmada|plan pago|renovación automática/);
});
