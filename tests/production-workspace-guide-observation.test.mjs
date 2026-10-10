import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

await loadBindings();

// Compile the actual JSX modules; only their read-only projection exports run.
async function actualModule(file,imports=''){
 const source=readFileSync(new URL('../src/app/(identity)/cuenta/'+file,import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const result=await transform(imports+source,{filename:file,jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
 return import('data:text/javascript;base64,'+Buffer.from(result.code).toString('base64'));
}
const {onboardingGuideSummary:summary}=await actualModule('onboarding-guide.js');
const scheduleUrl=new URL('../src/app/(identity)/cuenta/schedule-workbench.mjs',import.meta.url).href;
const {workspaceGuideObservation:observe,workspaceGuideAccessReason:reason}=await actualModule('workspace-client.js',`import {loadedScheduleOverview} from ${JSON.stringify(scheduleUrl)};\n`);
const scope='a'.repeat(64),projectId='p-a';
const account=()=>({scope,role:'ADMIN',projects:[{id:projectId},{id:'p-b'}],projectsTruncated:false});
const view=()=>({scope,project:{id:projectId},tasks:[{id:'t1',startsOn:null,endsOn:null},{id:'t2',startsOn:'2026-10-10',endsOn:'2026-10-09'}],totalTasks:3,nextCursor:'t2'});
const snapshot=()=>({scope,projectId,observedGeneration:2,channelReady:true,truncated:false,records:[{eligible:true,state:'VERIFIED',binding:{id:'binding-a',verifiedAt:'2026-10-01T12:00:00Z',revokedAt:null}}]});
const input=extra=>({account:account(),view:view(),loading:false,generation:2,channelSnapshot:snapshot(),...extra});

test('current canonical response produces partial schedule and personal binding without sensitive data',()=>{
 const observed=observe(input()),labels=summary(observed);
 assert.equal(labels.state,'OBSERVED');assert.match(labels.company,/Empresa consultada.*Administrador.*2 obras asignadas/);
 assert.match(labels.schedule,/2 tareas cargadas de 3/);assert.match(labels.schedule,/Vista parcial/);assert.match(labels.schedule,/1 sin fechas; 1 con fechas por revisar/);
 assert.match(labels.whatsapp,/Tu vínculo personal está vigente/);assert.match(labels.whatsapp,/no confirma envío ni entrega real/);
 assert.ok(!JSON.stringify(observed).includes('binding-a'));assert.ok(!JSON.stringify(observed).includes('verifiedAt'));
 assert.deepEqual(Object.keys(observed).sort(),['version','state','generation','scope','projectId','role','projectCount','projectsPartial','schedulePending','schedule','channel'].sort());
});
for(const flag of ['unavailable','loading','readFailed'])test(flag+' suppresses all earlier company/project/channel facts',()=>{
 const observed=observe(input({[flag]:true})),labels=summary(observed);
 assert.equal(observed.state,{unavailable:'UNAVAILABLE',loading:'CONSULTING',readFailed:'UNOBSERVED'}[flag]);
 assert.deepEqual(Object.keys(observed).sort(),['version','state','generation'].sort());assert.ok(!labels.whatsapp.includes('Tu vínculo personal está vigente'));assert.ok(!labels.schedule.includes('2 tareas'));
});
for(const [error,code,text] of [
 [{status:401,code:'WORKSPACE_MEMBERSHIP_REQUIRED'},'SESSION_REQUIRED',/sesión/],
 [{status:403,code:'WORKSPACE_MEMBERSHIP_REQUIRED'},'WORKSPACE_MEMBERSHIP_REQUIRED',/responsable ya lo habilitó/],
 [{status:403,code:'WORKSPACE_PROJECT_UNAVAILABLE'},'WORKSPACE_PROJECT_UNAVAILABLE',/obras disponibles/],
 [{status:409,code:'WORKSPACE_CONTEXT_CHANGED'},'WORKSPACE_CONTEXT_CHANGED',/organización o el acceso/],
 [{status:403,code:'PARTICIPANT_KYC_REVIEW_REQUIRED'},'PARTICIPANT_KYC_REVIEW_REQUIRED',/rol de oficina/]
])test('safe denied guide reason '+code+' never carries prior private facts',()=>{
 const observed=observe(input({unavailable:true,accessReason:reason({...error,message:'private-backend-sentinel',email:'private@example.test'})})),labels=summary(observed);
 assert.equal(observed.accessReason,code);assert.equal(labels.accessReason,code);assert.match(labels.company,text);
 assert.deepEqual(Object.keys(observed).sort(),['version','state','generation','accessReason'].sort());
 assert.ok(!JSON.stringify(observed).includes('private'));assert.ok(!JSON.stringify(labels).includes('private-backend-sentinel'));assert.ok(!labels.schedule.includes('2 tareas'));
});
test('unknown reason and provider failures cannot leak backend text or become permission facts',()=>{
 assert.equal(reason({status:503,code:'private-backend-sentinel'}),null);assert.equal(reason(null),null);
 assert.equal(reason({status:403,code:'private-backend-sentinel'}),'WORKSPACE_PROJECT_UNAVAILABLE');
 for(const accessReason of ['private-backend-sentinel','__proto__',{toString(){throw Error('Untrusted reason must not be coerced');}}]){
  const observed=observe(input({unavailable:true,accessReason}));assert.deepEqual(Object.keys(observed).sort(),['version','state','generation'].sort());
  const labels=summary({...observed,accessReason});assert.equal(labels.accessReason,null);assert.ok(!labels.company.includes('private-backend-sentinel'));
 }
});
test('explicit revalidation suppresses the previous denial and every earlier authorized fact',()=>{
 const observed=observe(input({loading:true,unavailable:true,accessReason:'WORKSPACE_MEMBERSHIP_REQUIRED'}));
 assert.deepEqual(observed,{version:1,state:'CONSULTING',generation:2});assert.equal(summary(observed).state,'CONSULTING');
 assert.ok(!JSON.stringify(summary(observed)).includes('habilitó'));assert.ok(!summary(observed).whatsapp.includes('vigente'));
});
test('rejected invited member becomes canonical Director only after the fresh observed account',()=>{
 const denied=observe(input({unavailable:true,accessReason:'WORKSPACE_MEMBERSHIP_REQUIRED'}));assert.equal(summary(denied).state,'UNAVAILABLE');
 assert.ok(!summary(denied).company.includes('Director'));
 const current=observe(input({account:{scope:'b'.repeat(64),role:'DIRECTOR',projects:[{id:'current-project'}]},view:null,channelSnapshot:null,generation:3,clerkRole:'org:member'}));
 assert.match(summary(current).company,/Director de obra.*1 obra asignada/);assert.equal(current.projectId,null);assert.equal(current.channel,null);assert.equal(current.schedule,null);
 assert.equal(current.scope,'b'.repeat(64));assert.equal(current.accessReason,undefined);assert.ok(!JSON.stringify(current).includes('org:member'));
});
test('field identity review keeps only its own safe reason without an operational view',()=>{
 const current=observe(input({account:{...account(),role:'AUDITOR'},view:null,channelSnapshot:null,accessReason:'PARTICIPANT_KYC_REVIEW_REQUIRED'}));
 assert.equal(current.accessReason,'PARTICIPANT_KYC_REVIEW_REQUIRED');assert.equal(summary(current).accessReason,current.accessReason);
 assert.equal(current.projectId,null);assert.equal(current.channel,null);assert.equal(current.schedule,null);
 assert.equal(observe(input({view:null,accessReason:'SESSION_REQUIRED'})).accessReason,undefined);
});
for(const mismatch of ['scope','projectId','observedGeneration'])test('channel '+mismatch+' mismatch cannot confirm a personal binding',()=>{
 const channel=snapshot();channel[mismatch]={scope:'b'.repeat(64),projectId:'p-b',observedGeneration:1}[mismatch];
 const observed=observe(input({channelSnapshot:channel}));assert.equal(observed.channel,null);assert.match(summary(observed).whatsapp,/todavía no consultado/);
});
for(const bad of ['ineligible','state','revoked','invalid-date','missing-binding','channel-not-ready'])test('personal link is not confirmed for '+bad,()=>{
 const channel=snapshot(),row=channel.records[0];
 if(bad==='ineligible')row.eligible=false;if(bad==='state')row.state='PENDING';if(bad==='revoked')row.binding.revokedAt='2026-10-02T00:00:00Z';if(bad==='invalid-date')row.binding.verifiedAt='invalid';if(bad==='missing-binding')row.binding=null;if(bad==='channel-not-ready')channel.channelReady=false;
 const observed=observe(input({channelSnapshot:channel}));assert.equal(observed.channel.ownLinked,false);assert.ok(!summary(observed).whatsapp.includes('Tu vínculo personal está vigente'));
});
test('pending schedule mutation or canonical readback has no old total',()=>{
 const observed=observe(input({schedulePending:true}));assert.equal(observed.schedule,null);assert.match(summary(observed).schedule,/operación o consulta pendiente/);assert.ok(!summary(observed).schedule.includes('2 tareas'));
});
test('different scope, unassigned project and no selected project keep schedule and channel unobserved',()=>{
 for(const changed of [null,{...view(),scope:'b'.repeat(64)},{...view(),project:{id:'p-c'}}]){
  const observed=observe(input({view:changed}));assert.equal(observed.projectId,null);assert.equal(observed.schedule,null);assert.equal(observed.channel,null);assert.match(summary(observed).schedule,/abrí una obra/);
 }
});
test('empty preconstruction schedule and no assigned works do not claim work started or company creation',()=>{
 const observed=observe(input({view:{...view(),tasks:[],totalTasks:0,nextCursor:null},channelSnapshot:null}));
 assert.match(summary(observed).schedule,/0 tareas cargadas de 0/);assert.match(summary(observed).schedule,/no confirma inicio ni avance/);
 const empty=observe(input({account:{...account(),projects:[]},view:null,channelSnapshot:null}));assert.match(summary(empty).company,/0 obras asignadas; pedile al responsable/);assert.match(summary(empty).company,/no es un comprobante de alta/);
});
test('unknown canonical role and malformed projection fail closed',()=>{
 const valid=observe(input());
 for(const extra of [{version:2},{generation:-1},{scope:'invalid'},{scope:{toString:null}},{role:'org:admin'},{role:'WORKER'},{role:'constructor'},{role:'__proto__'},{projectId:'../p-a'},{projectCount:-1},{projectCount:0},{projectsPartial:null},{schedulePending:'yes'},{projectId:null},{schedule:undefined},{schedule:false},{channel:undefined},{channel:[]},{schedule:{...valid.schedule,loaded:1}},{schedule:{...valid.schedule,total:1}},{schedule:{...valid.schedule,partial:false}},{channel:{...valid.channel,ready:false}},{channel:{...valid.channel,ownLinked:'yes'}}])assert.equal(summary({...valid,...extra}).state,'UNOBSERVED',JSON.stringify(extra));
});
test('valid complete and partial unknown-total summaries remain distinct',()=>{
 const full=observe(input({view:{...view(),totalTasks:2,nextCursor:null}}));assert.match(summary(full).schedule,/Vista completa/);
 const unknown=observe(input({view:{...view(),totalTasks:null,nextCursor:null}}));assert.match(summary(unknown).schedule,/total sin confirmar/);assert.match(summary(unknown).schedule,/Vista parcial/);
});
