import test from 'node:test';
import assert from 'node:assert/strict';
import {metaCustomerReadiness} from '../src/lib/meta-customer-provider.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {publicCustomerCoexistence} from '../src/lib/meta-customer-coexistence.mjs';
import {metaOnboardingSnapshot,metaOnboardingReadinessView,metaOnboardingCanAuthorize,metaOnboardingFlow,metaOnboardingPilotReason} from '../src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs';
const context={scope:'a'.repeat(64),projectId:'p-a'};
const environment={NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-secret-only-12345678',META_CONFIG_ID:'123456789012345',META_GRAPH_API_VERSION:'v25.0',META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,24).toString('base64'),META_EMBEDDED_SIGNUP_VERSION:'4',OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1',META_CUSTOMER_VERIFY_TOKEN:'synthetic-verify-token-only-'.repeat(2)};
const snapshot=(overrides={})=>({...context,companyName:'Empresa de ensayo',projectName:'Obra de ensayo',prepared:true,numberMode:'DEDICATED',readiness:metaCustomerReadiness(environment),signup:null,connection:null,...overrides});
const state=(result,key)=>metaOnboardingReadinessView(result).steps.find(step=>step.key===key);
const recovering=(recoveryState='PAUSED')=>snapshot({numberMode:'BUSINESS_APP',connection:{enabled:recoveryState==='RESTORED',storedStatus:recoveryState==='RESTORED'?'CONNECTED':'DISABLED'},activation:{state:recoveryState==='RESTORED'?'ACTIVE':'REVIEW_REQUIRED',operational:recoveryState==='RESTORED',canActivate:false,canDeactivate:['PAUSED','VERIFYING','REVIEW_REQUIRED','RESTORED'].includes(recoveryState),lastCode:recoveryState==='RESTORED'?null:'META_CUSTOMER_ACTIVATION_RECONNECTION_REQUIRED'},coexistence:publicCustomerCoexistence({metadata:{coexistence:{verified:true,verifiedAt:'2026-10-05T00:00:00Z',syncDeadlineAt:'2026-10-06T00:00:00Z'},customerLifecycle:{event:recoveryState==='PAUSED'?'account_offboarded':'account_reconnected',reason:'ACCOUNT_DISCONNECTED',initiatedBy:'SYSTEM',observedAt:'2026-10-05T12:00:00Z',recovery:{state:recoveryState,previouslyEnabled:true,pausedAt:'2026-10-05T12:00:00Z',reconnectedAt:recoveryState==='PAUSED'?null:'2026-10-05T12:01:00Z',verifiedAt:recoveryState==='RESTORED'?'2026-10-05T12:02:00Z':null,reason:'ACCOUNT_DISCONNECTED',initiatedBy:'SYSTEM',lastCode:null}}}},snapshot().readiness,Date.parse('2026-10-07T00:00:00Z'))});

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
 assert.match(metaOnboardingReadinessView(snapshot({numberMode:'BUSINESS_APP'})).next,/configuración v4/);
 assert.match(metaOnboardingReadinessView(snapshot({numberMode:'EXISTING_API'})).next,/No se transfiere ni desconecta/);
});
test('an existing operational channel keeps its next step when v4 authorization is pending, without claiming a new signup is ready',()=>{
 const result=snapshot({readiness:metaCustomerReadiness({...environment,META_EMBEDDED_SIGNUP_VERSION:undefined}),activation:{operational:true}});metaOnboardingSnapshot(result,context);assert.match(metaOnboardingReadinessView(result).next,/canal existente sigue habilitado/);assert.equal(result.readiness.canLaunchMeta,false);assert.equal(result.readiness.canUseCustomerTransport,true);
 assert.throws(()=>metaOnboardingSnapshot({...result,readiness:{...result.readiness,canUseCustomerTransport:false}},context),{code:'META_CUSTOMER_READINESS_RESPONSE_INVALID'});
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
test('actual public lifecycle/recovery contract stays compatible with older snapshots',()=>{
 const result=recovering();metaOnboardingSnapshot(result,context);
 assert.equal(result.coexistence.canSelectImport,false);assert.equal(result.coexistence.canContinueImport,false);
 for(const key of ['lifecycle','recovery'])delete result.coexistence[key];metaOnboardingSnapshot(result,context);
 assert.equal(metaOnboardingReadinessView(result).channel.recovery,null);
 assert.equal(metaOnboardingSnapshot(snapshot({activation:{operational:false}}),context).activation.operational,false);
});
test('paused and uncertain reconnections never advise activation or treat GET as a new registration/import',()=>{
 const labels={PAUSED:'Canal pausado',VERIFYING:'Verificando reconexión',REVIEW_REQUIRED:'Reconexión pendiente de revisión',MANUAL_REVIEW_REQUIRED:'Revisión manual necesaria'};
 for(const [recoveryState,label] of Object.entries(labels)){
  const result=recovering(recoveryState);metaOnboardingSnapshot(result,context);const view=metaOnboardingReadinessView(result);
  assert.equal(state(result,'activation').state,label);assert.match(view.next,/estado/);assert.doesNotMatch(view.next,/habilitarlo|Elegí Preparar|PIN/);
  assert.equal(view.channel.canKeepDisabled,['PAUSED','VERIFYING','REVIEW_REQUIRED'].includes(recoveryState));
  assert.equal(view.channel.recovery.pausedAt,'2026-10-05T12:00:00Z');assert.equal(state(result,'acceptance').state,'Sin aceptar');
 }
});
test('restoration does not certify field acceptance and manual deactivation takes precedence over a stale recovery snapshot',()=>{
 const restored=recovering('RESTORED');metaOnboardingSnapshot(restored,context);assert.equal(state(restored,'activation').state,'Canal restaurado');assert.match(state(restored,'activation').detail,/prueba real/);assert.equal(state(restored,'acceptance').state,'Sin aceptar');
 for(const recoveryState of ['PAUSED','RESTORED','KEPT_DISABLED']){
  const result=recovering(recoveryState);result.activation={state:'DEACTIVATED',operational:false,canActivate:false,canDeactivate:false,lastCode:null};result.connection.enabled=false;metaOnboardingSnapshot(result,context);
  assert.equal(state(result,'activation').state,'Desactivado por el administrador');assert.match(metaOnboardingReadinessView(result).next,/decisión del administrador/);assert.equal(metaOnboardingReadinessView(result).channel.canKeepDisabled,false);
 }
});
test('dedicated channels expose lifecycle guard without fabricated coexistence or activation advice',()=>{
 for(const lastCode of ['META_CUSTOMER_ACTIVATION_RECONNECTION_REQUIRED','META_CUSTOMER_LIFECYCLE_ORDER_UNCONFIRMED','META_CUSTOMER_LEGACY_LIFECYCLE_REVIEW_REQUIRED']){
  const result=snapshot({connection:{enabled:false},activation:{state:'REVIEW_REQUIRED',operational:false,canActivate:false,canDeactivate:true,lastCode}});metaOnboardingSnapshot(result,context);
  assert.equal(result.coexistence,undefined);assert.equal(metaOnboardingReadinessView(result).channel.showRecovery,true);assert.equal(metaOnboardingReadinessView(result).channel.canKeepDisabled,true);assert.match(metaOnboardingReadinessView(result).next,/revisá|Revisá/);assert.doesNotMatch(metaOnboardingReadinessView(result).next,/habilitarlo|Elegí Preparar/);
 }
 const unavailable=snapshot({connection:{enabled:false},activation:{operational:false,canActivate:false}});metaOnboardingSnapshot(unavailable,context);assert.equal(state(unavailable,'activation').state,'Habilitación no disponible');assert.doesNotMatch(metaOnboardingReadinessView(unavailable).next,/habilitarlo/);
});
test('fresh reconnection review can offer ADMIN revalidation only when the public backend predicate permits it',()=>{
 const result=recovering('REVIEW_REQUIRED');result.activation.canActivate=true;metaOnboardingSnapshot(result,context);assert.match(metaOnboardingReadinessView(result).next,/administrador puede comprobar y habilitar/);assert.equal(result.coexistence.canSelectImport,false);assert.equal(result.coexistence.canContinueImport,false);
 result.activation.canActivate=false;metaOnboardingSnapshot(result,context);assert.doesNotMatch(metaOnboardingReadinessView(result).next,/habilitar/);
});
test('malformed recovery, impossible dates, internal metadata and optimistic actions are rejected before render',()=>{
 const mutations=[r=>{r.coexistence.recovery.state='ACTIVE';},r=>{r.coexistence.recovery.previouslyEnabled='true';},r=>{r.coexistence.recovery.pausedAt='2026-02-30T12:00:00Z';},r=>{r.coexistence.recovery.reconnectedAt='yesterday';},r=>{delete r.coexistence.recovery.reason;},r=>{r.coexistence.recovery.leaseToken='private';},r=>{r.coexistence.recovery.reason='<img>';},r=>{r.coexistence.recovery.lastCode='unbounded unknown';},r=>{r.coexistence.recovery.initiatedBy='ADMIN';},r=>{r.coexistence.lifecycle.event='offboard<script>';},r=>{r.coexistence.lifecycle.reason='wrong';},r=>{r.coexistence.lifecycle.observedAt='2026-10-05';},r=>{r.coexistence.lifecycle.digest='private';},r=>{r.coexistence.canSelectImport=true;},r=>{r.activation.operational=true;},r=>{r.activation.canActivate='true';},r=>{r.activation.canDeactivate='false';},r=>{r.activation.lastCode='wrong';},r=>{r.activation.roundTrip='VERIFIED';},r=>{r.activation.leaseToken='private';}];
 for(const mutate of mutations){const result=recovering();mutate(result);assert.throws(()=>metaOnboardingSnapshot(result,context),{code:'META_CUSTOMER_READINESS_RESPONSE_INVALID'});}
});

const pilotSnapshot=(available=true)=>{const readiness=metaCustomerReadiness({...environment,OBRASAAS_META_SIGNUP_RELEASE:undefined});return snapshot({readiness:{...readiness,mode:'DEVELOPMENT_PILOT',pilot:{canLaunch:available,canUseAttendanceTransport:available,expiresAt:new Date(Date.now()+3600000).toISOString(),ownBusinessOnly:true,ownerReadbackReady:available,code:available?'META_DEVELOPMENT_PILOT_AVAILABLE':'META_DEVELOPMENT_PILOT_OWNER_UNVERIFIED',capabilities:{attendance:available,binding:available,kyc:false,media:false,flows:false,templates:false,progress:false,stock:false,company:false}}},activation:{state:'NOT_ACCEPTED',operational:false,attendanceOperational:false,canActivate:false,canDeactivate:false}});};
test('pilot DTO authorizes only dedicated own-business mode while global gates stay false',()=>{const r=pilotSnapshot();metaOnboardingSnapshot(r,context);assert.equal(r.readiness.gates.review,false);assert.equal(r.readiness.canLaunchMeta,false);assert.equal(r.readiness.canUseCustomerTransport,false);assert.equal(r.readiness.flows.DEDICATED.available,false);assert.equal(metaOnboardingCanAuthorize(r.readiness),true);assert.equal(metaOnboardingFlow(r.readiness,'DEDICATED').available,true);assert.equal(metaOnboardingFlow(r.readiness,'BUSINESS_APP').available,false);assert.match(state(r,'platform').title,/negocio propio/);assert.match(state(r,'platform').detail,/WABA y el número.*después/);assert.equal(state(r,'templates').state,'Fuera del piloto');assert.equal(state(r,'business').state,'No comprobada aquí');});
test('unavailable and expired pilot never authorize a Meta popup but preserve read-only attempt',()=>{const r=pilotSnapshot(false);r.signup={state:'EXCHANGE_UNKNOWN'};metaOnboardingSnapshot(r,context);assert.equal(metaOnboardingCanAuthorize(r.readiness),false);r.readiness.pilot.expiresAt=new Date(Date.now()-1).toISOString();metaOnboardingSnapshot(r,context);assert.equal(metaOnboardingCanAuthorize(r.readiness),false);const live=pilotSnapshot();assert.equal(metaOnboardingCanAuthorize(live.readiness,Date.parse(live.readiness.pilot.expiresAt)),false);assert.equal(metaOnboardingFlow(live.readiness,'DEDICATED',Date.parse(live.readiness.pilot.expiresAt)).available,false);});
for(const [suffix,reason] of [
 ['AUDITOR_UNAVAILABLE',/credencial de consulta/],['AUDIT_CONFIGURATION_PENDING',/configuración privada/],
 ['DEBUG_REQUEST_FAILED',/consultar la autorización/],['DEBUG_RESPONSE_INVALID',/comprobación válida/],
 ['AUDITOR_INVALID',/confirmó como válida/],['AUDITOR_APP_MISMATCH',/no corresponde a la aplicación/],
 ['AUDITOR_TYPE_UNVERIFIED',/tipo de autorización/],['AUDITOR_SCOPES_UNVERIFIED',/todos los permisos/],
 ['AUDITOR_EXPIRY_UNVERIFIED',/vigencia/],['BUSINESS_READ_FAILED',/no confirma que falten permisos/],
 ['BUSINESS_RESPONSE_INVALID',/lista válida/],['BUSINESS_PAGINATION_UNVERIFIED',/quedó incompleta/],
 ['UNAVAILABLE',/ya no está vigente/],
])test('safe audit reason '+suffix+' preserves unknown attempt without authorizing',()=>{const r=pilotSnapshot(false);r.readiness.pilot.code='META_DEVELOPMENT_PILOT_'+suffix;r.signup={state:'EXCHANGE_UNKNOWN',id:'synthetic-attempt'};const before=structuredClone(r);metaOnboardingSnapshot(r,context);assert.match(metaOnboardingPilotReason(r.readiness.pilot.code),reason);assert.match(metaOnboardingReadinessView(r).next,reason);assert.match(metaOnboardingReadinessView(r).next,/Conservamos el intento/);assert.equal(metaOnboardingCanAuthorize(r.readiness),false);assert.equal(metaOnboardingFlow(r.readiness,'DEDICATED').available,false);assert.deepEqual(r,before);});
test('unknown or hostile diagnostic never appears in public Spanish reason',()=>{for(const value of ['META_DEVELOPMENT_PILOT_OWNER_UNVERIFIED','MALICIOUS_CODE','private-token / foreign-business','__proto__','toString',null,undefined]){const reason=metaOnboardingPilotReason(value);assert.match(reason,/No se pudo comprobar.*equipo de ObraSaaS/);assert.doesNotMatch(reason,/MALICIOUS|private-token|foreign-business|__proto__|toString/);}});
test('pilot activation distinguishes attendance from full operation and human acceptance',()=>{const r=pilotSnapshot();r.connection={enabled:true};r.activation={state:'ACTIVE',operational:false,attendanceOperational:true,canActivate:true,canDeactivate:true};metaOnboardingSnapshot(r,context);const v=metaOnboardingReadinessView(r);assert.equal(v.channel.state,'Asistencia limitada habilitada');assert.equal(v.channel.canKeepDisabled,false);assert.match(v.channel.detail,/otras obras siguen pendientes/);assert.equal(state(r,'acceptance').state,'Sin aceptar');r.activation.operational=true;assert.throws(()=>metaOnboardingSnapshot(r,context),{code:'META_CUSTOMER_READINESS_RESPONSE_INVALID'});});
test('forged, broadened or contradictory pilot DTO cannot replace the current snapshot',()=>{const mutations=[r=>{r.readiness.mode='CUSTOMER';},r=>{r.readiness.pilot.ready=true;},r=>{r.readiness.pilot.capabilities.media=true;},r=>{r.readiness.pilot.capabilities.company=true;},r=>{r.readiness.pilot.ownBusinessOnly=false;},r=>{r.readiness.pilot.ownerReadbackReady=false;},r=>{r.readiness.pilot.canUseAttendanceTransport=false;},r=>{r.readiness.pilot.expiresAt='not-a-date';},r=>{r.readiness.canLaunchMeta=true;},r=>{r.readiness.gates.review=true;},r=>{r.readiness.gates.secret=false;},r=>{r.numberMode='BUSINESS_APP';},r=>{r.companyRouting={};},r=>{r.activation.attendanceOperational=true;}];for(const mutate of mutations){const r=pilotSnapshot();mutate(r);assert.throws(()=>metaOnboardingSnapshot(r,context),{code:'META_CUSTOMER_READINESS_RESPONSE_INVALID'});}const ordinary=snapshot({activation:{operational:false,attendanceOperational:true}});assert.throws(()=>metaOnboardingSnapshot(ordinary,context),{code:'META_CUSTOMER_READINESS_RESPONSE_INVALID'});});

test('a stale ACTIVE pilot snapshot is projected as expired without renewing or dropping closure actions',()=>{const r=pilotSnapshot();r.connection={enabled:true};r.activation={state:'ACTIVE',operational:false,attendanceOperational:true,canActivate:true,canDeactivate:true};metaOnboardingSnapshot(r,context);const now=Date.parse(r.readiness.pilot.expiresAt),v=metaOnboardingReadinessView(r,now);assert.equal(v.channel.state,'Autorización limitada vencida');assert.match(v.next,/no está disponible/);assert.equal(v.channel.canKeepDisabled,true);assert.equal(v.steps.find(step=>step.key==='platform').state,'Autorización limitada no disponible');assert.equal(r.activation.state,'ACTIVE');assert.equal(r.activation.canDeactivate,true);assert.equal(r.readiness.pilot.canLaunch,true);});
