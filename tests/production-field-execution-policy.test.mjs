import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {EXECUTION_ACTIONS,normalizeExecutionPayload,executionFactDigest} from '../src/lib/field-execution-policy.mjs';

const issue='ISSUE_EXECUTION_MANDATE',revoke='REVOKE_EXECUTION_MANDATE',report='REPORT_EXECUTION';
const taskRevision='2026-10-24T12:00:00.123456',hash='a'.repeat(64);
const mandate=()=>({workerId:'worker-a',taskId:'task-a',taskRevision,sectorId:'sector-a',catalogHash:hash,validUntil:'2040-01-02T03:04:05.000Z',materials:[{materialId:'material-z',unit:'kg',limit:'20',maxPerReport:'2'},{materialId:'material-a',unit:'bolsa',limit:'00010.001',maxPerReport:'0001.001'}],progress:null,reason:'  Material aplicado\r\nbajo mandato.  '});
const progress=()=>({definitionId:'_measure:v1.2',baseline:'10',unit:'M2',limit:'4',maxPerReport:'1'});
const execution=()=>({reportId:'A1111111-B222-4C33-8D44-E55555555555',mandateId:'mandate-a',mandateRevision:1,workerId:'worker-a',taskId:'task-a',taskRevision,sectorId:'sector-a',catalogHash:hash,lines:[{lineId:'line-z',materialId:'material-a',unit:'bolsa',quantity:'0002.000'},{lineId:'line-a',materialId:'material-a',unit:'bolsa',quantity:'0001.001'}],progress:null,evidenceIds:['evidence-z','evidence-a'],reason:'  Material aplicado\r\nbajo mandato.  '});
const reportedProgress=()=>({definitionId:'_measure:v1.2',baseline:'10',unit:'M2',mode:'DELTA',quantity:'2.5'});
const denied=(action,p,code)=>assert.throws(()=>normalizeExecutionPayload(action,p),error=>error instanceof WorkspaceError&&error.status===400&&error.code===(code?'FIELD_EXECUTION_'+code:error.code)&&error.code.startsWith('FIELD_EXECUTION_'));

test('the execution policy exports only its three frozen additive actions',()=>{
 assert.deepEqual(EXECUTION_ACTIONS,[issue,revoke,report]);assert.equal(Object.isFrozen(EXECUTION_ACTIONS),true);
 for(const action of [undefined,null,'PROPOSE_CONSUMPTION','DECIDE_PROGRESS','report_execution'])denied(action,execution(),'ACTION_INVALID');
});

test('mandates retain exact three-decimal allowances, sorted material IDs and independent input objects',()=>{
 const input=mandate(),before=structuredClone(input),out=normalizeExecutionPayload(issue,input);
 assert.deepEqual(out,{workerId:'worker-a',taskId:'task-a',taskRevision,sectorId:'sector-a',catalogHash:hash,validUntil:'2040-01-02T03:04:05.000Z',materials:[{materialId:'material-a',unit:'bolsa',limit:'10.001',maxPerReport:'1.001'},{materialId:'material-z',unit:'kg',limit:'20.000',maxPerReport:'2.000'}],progress:null,reason:'Material aplicado\nbajo mandato.'});
 assert.deepEqual(input,before);assert.notEqual(out.materials,input.materials);assert.notEqual(out.materials[0],input.materials[1]);
 const maximum=mandate();maximum.materials=[{materialId:'maximum',unit:'unidad',limit:'99999999999.999',maxPerReport:'99999999999.998'}];assert.equal(normalizeExecutionPayload(issue,maximum).materials[0].limit,'99999999999.999');
});

test('mandate measurement limits use exact four-decimal arithmetic and the existing measurement ID and unit contract',()=>{
 const input=mandate();input.progress=progress();const before=structuredClone(input),out=normalizeExecutionPayload(issue,input);
 assert.deepEqual(out.progress,{definitionId:'_measure:v1.2',baseline:'10.0000',unit:'M2',limit:'4.0000',maxPerReport:'1.0000'});assert.deepEqual(input,before);assert.notEqual(out.progress,input.progress);
 input.progress={...progress(),baseline:'99999999999999.9999',limit:'99999999999999.9999',maxPerReport:'99999999999999.9998'};assert.equal(normalizeExecutionPayload(issue,input).progress.maxPerReport,'99999999999999.9998');
 for(const edit of [p=>p.limit='10.0001',p=>p.maxPerReport='4.0001']){const bad=mandate();bad.progress=progress();edit(bad.progress);denied(issue,bad,'LIMIT_INVALID');}
});

test('all action payloads and nested records require their complete exact own keys',()=>{
 const cases=[[issue,mandate()],[revoke,{mandateId:'mandate-a',revision:1,reason:'Revocación autorizada.'}],[report,execution()]];
 for(const[action,p]of cases){for(const key of Object.keys(p)){const missing=structuredClone(p);delete missing[key];denied(action,missing);}for(const key of ['actorId','scope','operationId','approved','extra'])denied(action,{...p,[key]:'foreign'});denied(action,Object.assign(Object.create({inherited:true}),p));denied(action,{...p,[Symbol('extra')]:true});denied(action,null);denied(action,[]);}
 for(const path of ['materials','progress']){const p=mandate();p.progress=progress();const target=path==='materials'?p.materials[0]:p.progress;for(const key of Object.keys(target)){const bad=structuredClone(p),row=path==='materials'?bad.materials[0]:bad.progress;delete row[key];denied(issue,bad);}target.unreviewed=true;denied(issue,p,'INPUT_INVALID');}
 for(const path of ['lines','progress']){const p=execution();p.progress=reportedProgress();const target=path==='lines'?p.lines[0]:p.progress;for(const key of Object.keys(target)){const bad=structuredClone(p),row=path==='lines'?bad.lines[0]:bad.progress;delete row[key];denied(report,bad);}target.unreviewed=true;denied(report,p,'INPUT_INVALID');}
});

test('inventory quantities reject numeric, lossy, signed, exponential, zero and overflowing values',()=>{
 for(const value of [1,1.001,NaN,Infinity,null,'','0','0.000','-1','+1','1e3','1,5','.5','1.','1.0001','100000000000',' 1','1 ','0'.repeat(21)]){
  const p=mandate();p.materials[0].limit=value;denied(issue,p,'QUANTITY_INVALID');const q=execution();q.lines[0].quantity=value;denied(report,q,'QUANTITY_INVALID');
 }
 const p=mandate();p.materials[0]={...p.materials[0],limit:'9.999',maxPerReport:'10.000'};denied(issue,p,'LIMIT_INVALID');
 p.materials[0]={...p.materials[0],limit:'10.000',maxPerReport:'9.999'};assert.equal(normalizeExecutionPayload(issue,p).materials[1].maxPerReport,'9.999');
});

test('measurement quantities reject coercions and precision loss while cumulative zero stays a store-level transition decision',()=>{
 for(const value of [1,null,'01','-1','+1','1e3','1,5','.5','1.','1.00001','100000000000000',' 1','1 ']){const p=mandate();p.progress={...progress(),baseline:value};denied(issue,p,'QUANTITY_INVALID');const q=execution();q.progress={...reportedProgress(),quantity:value};denied(report,q,'QUANTITY_INVALID');}
 for(const field of ['baseline','limit','maxPerReport']){const p=mandate();p.progress={...progress(),[field]:'0'};denied(issue,p,'QUANTITY_INVALID');}
 const p=execution();p.progress={...reportedProgress(),quantity:'0'};denied(report,p,'QUANTITY_INVALID');p.progress.mode='CUMULATIVE';assert.equal(normalizeExecutionPayload(report,p).progress.quantity,'0.0000');
 p.progress.quantity='10.0001';denied(report,p,'LIMIT_INVALID');p.progress.quantity='10';assert.equal(normalizeExecutionPayload(report,p).progress.quantity,'10.0000');p.progress.mode='AUTOMATIC';denied(report,p,'INPUT_INVALID');
});

test('bounded material and line matrices reject duplicate identities without collapsing legitimate repeated materials',()=>{
 const p=mandate();p.materials=Array.from({length:20},(_,n)=>({materialId:'material-'+String(n).padStart(2,'0'),unit:'bolsa',limit:'10',maxPerReport:'1'})).reverse();assert.equal(normalizeExecutionPayload(issue,p).materials.length,20);p.materials.push({...p.materials[0],materialId:'overflow'});denied(issue,p);p.materials=[];denied(issue,p);p.materials=Array(1);denied(issue,p);
 const duplicate=mandate();duplicate.materials[1].materialId=duplicate.materials[0].materialId;denied(issue,duplicate,'INPUT_INVALID');
 const q=execution(),out=normalizeExecutionPayload(report,q);assert.deepEqual(out.lines.map(row=>row.lineId),['line-a','line-z']);assert.deepEqual(out.lines.map(row=>row.materialId),['material-a','material-a']);assert.equal(out.lines.length,2);
 q.lines[1].lineId=q.lines[0].lineId;denied(report,q,'INPUT_INVALID');q.lines=[];denied(report,q);q.lines=Array(1);denied(report,q);q.lines=Array.from({length:21},(_,n)=>({lineId:'line-'+n,materialId:'material-a',unit:'bolsa',quantity:'1'}));denied(report,q);
});

test('inventory and measurement units remain distinct and each repeated material keeps one physical unit',()=>{
 for(const value of ['KG','UNIT','Bolsa','',null]){const p=mandate();p.materials[0].unit=value;denied(issue,p,'UNIT_INVALID');const q=execution();q.lines[0].unit=value;denied(report,q,'UNIT_INVALID');}
 const q=execution();q.lines[0].unit='kg';denied(report,q,'UNIT_INVALID');q.lines[0].materialId='another-material';assert.equal(normalizeExecutionPayload(report,q).lines.length,2);
 for(const value of ['kg','m2','unidad','',null]){const p=mandate();p.progress={...progress(),unit:value};denied(issue,p,'UNIT_INVALID');const r=execution();r.progress={...reportedProgress(),unit:value};denied(report,r,'UNIT_INVALID');}
});

test('report evidence is a distinct bounded sorted set and measurement requires at least one reference',()=>{
 const p=execution();p.evidenceIds=[];assert.deepEqual(normalizeExecutionPayload(report,p).evidenceIds,[]);p.progress=reportedProgress();denied(report,p,'EVIDENCE_INVALID');
 p.evidenceIds=Array.from({length:10},(_,n)=>'evidence-'+n).reverse();assert.deepEqual(normalizeExecutionPayload(report,p).evidenceIds,[...p.evidenceIds].sort());p.evidenceIds.push('overflow');denied(report,p,'EVIDENCE_INVALID');p.evidenceIds=['same','same'];denied(report,p,'EVIDENCE_INVALID');p.evidenceIds='evidence-a';denied(report,p,'EVIDENCE_INVALID');p.evidenceIds=['bad/id'];denied(report,p,'ID_INVALID');
});

test('IDs, positive safe mandate revisions and existing task revisions cannot be coerced',()=>{
 for(const value of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1',null]){denied(revoke,{mandateId:'mandate-a',revision:value,reason:'Revocación autorizada.'},'REVISION_INVALID');const p=execution();p.mandateRevision=value;denied(report,p,'REVISION_INVALID');}
 assert.deepEqual(normalizeExecutionPayload(revoke,{mandateId:'mandate-a',revision:2,reason:' Revocación autorizada. '}),{mandateId:'mandate-a',revision:2,reason:'Revocación autorizada.'});
 for(const value of ['bad/id','',null,1]){for(const field of ['workerId','taskId','sectorId']){const p=mandate();p[field]=value;denied(issue,p,'ID_INVALID');const q=execution();q[field]=value;denied(report,q,'ID_INVALID');}denied(revoke,{mandateId:value,revision:1,reason:'Revocación autorizada.'},'ID_INVALID');}
 for(const value of ['not-a-uuid','a1111111-b222-5c33-8d44-e55555555555',null]){const p=execution();p.reportId=value;denied(report,p,'ID_INVALID');}
 for(const value of [null,1,'2026-10-24T12:00:00.123Z','2026-10-24T12:00:00.123456Z']){const p=mandate();p.taskRevision=value;denied(issue,p,'REVISION_INVALID');const q=execution();q.taskRevision=value;denied(report,q,'REVISION_INVALID');}
 for(const value of ['A'.repeat(64),'a'.repeat(63),'foreign',null]){const p=mandate();p.catalogHash=value;denied(issue,p,'INPUT_INVALID');const q=execution();q.catalogHash=value;denied(report,q,'INPUT_INVALID');}
});

test('expiry uses exact canonical UTC instants without accepting calendar rollover or deciding database-time validity',()=>{
 for(const value of [null,new Date('2040-01-02T03:04:05Z'),'2040-01-02T03:04:05Z','2040-01-02T03:04:05.000+00:00','2040-02-30T03:04:05.000Z','2040-13-02T03:04:05.000Z','2040-01-02T03:04:05.0000Z']){const p=mandate();p.validUntil=value;denied(issue,p,'VALID_UNTIL_INVALID');}
 const p=mandate();p.validUntil='2000-01-02T03:04:05.000Z';assert.equal(normalizeExecutionPayload(issue,p).validUntil,p.validUntil);
});

test('reasons preserve normalized site text while rejecting missing, oversized, HTML and control input',()=>{
 for(const value of [null,123,'short','x'.repeat(1001),'Motivo <script>','Motivo\u0000inválido']){for(const[action,p]of [[issue,mandate()],[report,execution()],[revoke,{mandateId:'mandate-a',revision:1,reason:'Motivo autorizado.'}]]){p.reason=value;denied(action,p,'REASON_INVALID');}}
});

test('the report fact digest is canonical across object, decimal and collection order without mutating the supplied report',()=>{
 const p=execution(),before=structuredClone(p),out=normalizeExecutionPayload(report,p),alternate=Object.fromEntries(Object.entries(p).reverse());alternate.reportId=p.reportId.toLowerCase();alternate.lines=[...p.lines].reverse().map(row=>Object.fromEntries(Object.entries({...row,quantity:row.lineId==='line-z'?'2':'1.001'}).reverse()));alternate.evidenceIds=[...p.evidenceIds].reverse();alternate.reason='Material aplicado\nbajo mandato.';
 assert.equal(out.reportId,'a1111111-b222-4c33-8d44-e55555555555');assert.equal(executionFactDigest(p),executionFactDigest(alternate));assert.equal(executionFactDigest(p),createHash('sha256').update(JSON.stringify(['field-execution-request-v1',out])).digest('hex'));assert.deepEqual(p,before);assert.notEqual(out.lines,p.lines);assert.notEqual(out.evidenceIds,p.evidenceIds);assert.notEqual(out.lines[0],p.lines[1]);
 const measured=execution();measured.progress=reportedProgress();const same=structuredClone(measured);same.progress={quantity:'2.5000',mode:'DELTA',unit:'M2',baseline:'10.0000',definitionId:'_measure:v1.2'};assert.equal(executionFactDigest(measured),executionFactDigest(same));
});

test('every changed report fact changes its digest and command authority fields cannot be silently hashed or ignored',()=>{
 const p=execution();p.progress=reportedProgress();const before=executionFactDigest(p);
 for(const edit of [q=>q.reportId='b1111111-b222-4c33-8d44-e55555555555',q=>q.mandateId='mandate-b',q=>q.mandateRevision=2,q=>q.workerId='worker-b',q=>q.taskId='task-b',q=>q.taskRevision='2026-10-24T12:00:00.123457',q=>q.sectorId='sector-b',q=>q.catalogHash='b'.repeat(64),q=>q.lines[0].lineId='line-y',q=>q.lines[0].materialId='material-b',q=>{q.lines[0].unit='kg';q.lines[1].unit='kg';},q=>q.lines[0].quantity='2.001',q=>q.progress.definitionId='measure-b',q=>q.progress.baseline='11',q=>q.progress.unit='M3',q=>q.progress.mode='CUMULATIVE',q=>q.progress.quantity='2.5001',q=>q.evidenceIds=['evidence-b'],q=>q.reason='Otro hecho informado.']){const changed=structuredClone(p);edit(changed);assert.notEqual(executionFactDigest(changed),before);}
 for(const key of ['operationId','scope','actorId'])assert.throws(()=>executionFactDigest({...p,[key]:'foreign'}),{code:'FIELD_EXECUTION_INPUT_INVALID',status:400});
});
