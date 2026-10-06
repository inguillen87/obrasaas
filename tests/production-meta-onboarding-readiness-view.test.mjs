import test from 'node:test';
import assert from 'node:assert/strict';
import {metaCustomerReadiness} from '../src/lib/meta-customer-provider.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {metaOnboardingSnapshot,metaOnboardingReadinessView} from '../src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs';
const context={scope:'a'.repeat(64),projectId:'p-a'};
const environment={NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-secret-only-12345678',META_CONFIG_ID:'123456789012345',META_GRAPH_API_VERSION:'v25.0',META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,24).toString('base64'),OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1',META_CUSTOMER_VERIFY_TOKEN:'synthetic-verify-token-only-'.repeat(2)};
const snapshot=(overrides={})=>({...context,companyName:'Empresa de ensayo',projectName:'Obra de ensayo',prepared:true,numberMode:'DEDICATED',readiness:metaCustomerReadiness(environment),signup:null,connection:null,...overrides});
const state=(result,key)=>metaOnboardingReadinessView(result).steps.find(step=>step.key===key);

test('actual public readiness is accepted without attesting to business review or field acceptance',()=>{
 const result=snapshot();assert.equal(metaOnboardingSnapshot(result,context),result);
 const view=metaOnboardingReadinessView(result);assert.equal(state(result,'platform').state,'Disponible para autorizar');assert.equal(state(result,'business').state,'No comprobada aquí');assert.equal(state(result,'acceptance').state,'Sin aceptar');assert.ok(view.prerequisites.every(row=>row.state==='Configurada'));assert.match(view.next,/Preparar autorización/);
 assert.doesNotMatch(JSON.stringify(view),/synthetic-secret|verify-token|123456789012345/);
});
test('each absent platform prerequisite yields a specific pending item without falsely approving Meta',()=>{
 for(const key of Object.keys(environment)){
  const missing={...environment};delete missing[key];const result=snapshot({readiness:metaCustomerReadiness(missing)});metaOnboardingSnapshot(result,context);
  const view=metaOnboardingReadinessView(result);assert.equal(state(result,'platform').state,'Pendiente de plataforma');assert.ok(view.prerequisites.some(row=>row.state==='Pendiente'));assert.match(view.next,/equipo de ObraSaaS/);assert.equal(state(result,'business').state,'No comprobada aquí');
 }
});
test('malformed, optimistic or unscoped readiness cannot replace a displayed snapshot',()=>{
 const mutations=[r=>{delete r.readiness.gates;},r=>{delete r.readiness.gates.review;},r=>{r.readiness.gates.review='true';},r=>{r.readiness.gates.extra=true;},r=>{r.readiness.gates.review=false;},r=>{r.readiness.operational=true;},r=>{r.readiness.recovery.productionVerified=true;},r=>{delete r.readiness.recovery;},r=>{r.readiness.humanAcceptance='ACCEPTED';},r=>{r.prepared='true';},r=>{r.numberMode='OTHER';}];
 for(const mutate of mutations){const result=snapshot();mutate(result);assert.throws(()=>metaOnboardingSnapshot(result,context),{code:'META_CUSTOMER_READINESS_RESPONSE_INVALID'});}
 for(const patch of [{projectId:'p-b'},{scope:'b'.repeat(64)}])assert.throws(()=>metaOnboardingSnapshot(snapshot(patch),context),{code:'WORKSPACE_CONTEXT_CHANGED'});
});
test('preparation and assisted number modes preserve their distinct next actions',()=>{
 assert.match(metaOnboardingReadinessView(snapshot({prepared:false,numberMode:null})).next,/Guardá la preparación/);
 for(const numberMode of ['BUSINESS_APP','EXISTING_API'])assert.match(metaOnboardingReadinessView(snapshot({numberMode})).next,/revisión específica/);
});
test('uncertain authorization and registration point to inspection before another effect',()=>{
 for(const current of ['EXCHANGE_STARTED','EXCHANGE_UNKNOWN','VERIFYING','REGISTRATION_VERIFYING','REGISTRATION_STARTED','REGISTRATION_UNKNOWN'])assert.match(metaOnboardingReadinessView(snapshot({signup:{state:current,canReconcile:true}})).next,/mismo intento/);
 assert.match(metaOnboardingReadinessView(snapshot({signup:{state:'REGISTRATION_REQUIRED',registrationRequired:true,canReconcile:true}})).next,/PIN de seguridad/);
 assert.match(metaOnboardingReadinessView(snapshot({signup:{state:'REVIEW_REQUIRED',canReconcile:true}})).next,/Recuperar conexión/);
});
test('registered, enabled and approved templates still cannot certify message delivery or acceptance',()=>{
 const result=snapshot({signup:{state:'LINKED_PENDING_ACCEPTANCE',canReconcile:true},connection:{storedStatus:'CONNECTED',enabled:true},activation:{state:'ACTIVE',operational:true},templates:{observedAt:'2026-10-05T12:00:00Z',items:[{status:'APPROVED'},{status:'PENDING'}]}});
 const view=metaOnboardingReadinessView(result);assert.match(state(result,'number').state,/Registro confirmado/);assert.equal(state(result,'activation').state,'Canal habilitado');assert.match(state(result,'templates').detail,/1 plantilla aprobada/);assert.match(state(result,'templates').detail,/no acredita/);assert.equal(state(result,'acceptance').state,'Sin aceptar');assert.match(view.next,/prueba real/);
 assert.match(metaOnboardingReadinessView({...result,activation:null}).next,/Operación del canal/);
 const stored=snapshot({connection:{storedStatus:'CONNECTED',enabled:true}});assert.match(state(stored,'number').state,/comprobar registro/);assert.equal(state(stored,'activation').state,'Pendiente de habilitación');
});
test('a recovery secret and scheduler configuration show configuration only, never execution',()=>{
 const result=snapshot({readiness:metaCustomerReadiness({...environment,META_CUSTOMER_JOB_SECRET:'synthetic-job-'.repeat(4),CRON_SECRET:'synthetic-cron-'.repeat(4)})});metaOnboardingSnapshot(result,context);
 assert.equal(metaOnboardingReadinessView(result).recovery.state,'Configurada · ejecución por comprobar');assert.equal(metaOnboardingReadinessView(snapshot()).recovery.state,'Configuración pendiente');assert.match(metaOnboardingReadinessView(result).recovery.detail,/por separado/);
});
