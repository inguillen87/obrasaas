import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTICIPANT_OFFICE_ASSIGN_ACTION,participantOfficeEmail,participantOfficeSnapshot,participantOfficeSelectionStamp,participantOfficeStateMessage,participantOfficeReceiptOutcome,participantOfficePrecommitRejected} from '../src/app/(identity)/cuenta/participant-office-account-view.mjs';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';

const scope='a'.repeat(64),projectId='project-a',email='office@example.invalid',operationId='12345678-1234-4234-8234-123456789012',receiptId='participant_'+'b'.repeat(64),proofDigest='c'.repeat(64);
const account={clerkUserId:'user_Office',name:'Cuenta de oficina sintética',email,clerkRole:'org:member',proofDigest};
const context={scope,projectId,email},ready=()=>({scope,projectId,verifiedOfficeAccount:{version:1,email,state:'READY',code:null,account:{...account}}});
const reference={scope,projectId,operationId,action:PARTICIPANT_OFFICE_ASSIGN_ACTION},command={...reference,payload:{email,clerkUserId:account.clerkUserId,expectedProofDigest:proofDigest,role:'DIRECTOR',reason:'El administrador revisó el alcance.',confirmOfficePermissions:true}};
const outcome=()=>({scope,saved:true,replayed:false,receiptId,account:{membershipId:'office-member',name:account.name,email,role:'DIRECTOR',roleLabel:'Dirección',roleScope:'Todas las obras de la empresa.',revision:'2026-10-10T18:00:00.000001',status:'ACTIVE',self:false,canChangeRole:true},officeAssignmentReceipt:{version:1,...reference,receiptId,membershipId:'office-member',clerkUserId:account.clerkUserId,email,role:'DIRECTOR',assignedProjectId:null,recordedAt:'2026-10-10T18:00:00.000Z',proofDigest,identityCertified:false,fieldPermissionsGranted:false}});

test('exact email consultation validates the accepted Clerk member and current context',()=>{
 assert.equal(participantOfficeEmail(' Office@Example.Invalid '),email);
 const row=participantOfficeSnapshot(ready(),context);assert.equal(row.state,'READY');assert.match(participantOfficeStateMessage(row),/Clerk/);
 for(const mutate of [v=>{v.scope='d'.repeat(64);},v=>{v.projectId='foreign';},v=>{v.verifiedOfficeAccount.email='foreign@example.invalid';},v=>{v.verifiedOfficeAccount.account.clerkRole='org:admin';},v=>{v.verifiedOfficeAccount.account.proofDigest='bad';},v=>{v.verifiedOfficeAccount.permissionsGranted=true;}]){const value=ready();mutate(value);assert.throws(()=>participantOfficeSnapshot(value,context),{code:'PARTICIPANT_OFFICE_PROJECTION_INVALID'});}
});

test('pending or blocked consultation provides no identity selection or permission proof',()=>{
 for(const state of ['NOT_READY','BLOCKED']){const value={scope,projectId,verifiedOfficeAccount:{version:1,email,state,code:state==='NOT_READY'?'PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED':'PARTICIPANT_OFFICE_ACCOUNT_RESTRICTED',account:null}},row=participantOfficeSnapshot(value,context);assert.equal(participantOfficeSelectionStamp(row),null);assert.doesNotMatch(participantOfficeStateMessage(row),/incorporada/);value.verifiedOfficeAccount.account=account;assert.throws(()=>participantOfficeSnapshot(value,context));}
});

test('a changed email, identity, name or provider proof invalidates the selection stamp',()=>{
 const row=participantOfficeSnapshot(ready(),context),stamp=participantOfficeSelectionStamp(row);
 for(const [key,value] of [['email','other@example.invalid'],['clerkUserId','user_Other'],['name','Otra identidad'],['proofDigest','d'.repeat(64)]]){const changed=structuredClone(row);if(key==='email')changed.email=value;changed.account[key]=value;assert.notEqual(participantOfficeSelectionStamp(changed),stamp);}
});

test('the immutable assignment receipt is matched to the operation and selected identity',()=>{
 assert.equal(participantOfficeReceiptOutcome(outcome(),reference,command).state,'RECORDED');
 for(const mutate of [v=>{v.officeAssignmentReceipt.operationId='22345678-1234-4234-8234-123456789012';},v=>{v.officeAssignmentReceipt.email='other@example.invalid';},v=>{v.officeAssignmentReceipt.clerkUserId='user_Other';},v=>{v.officeAssignmentReceipt.proofDigest='d'.repeat(64);},v=>{v.officeAssignmentReceipt.role='AUDITOR';v.officeAssignmentReceipt.assignedProjectId=projectId;},v=>{v.officeAssignmentReceipt.assignedProjectId=projectId;},v=>{v.officeAssignmentReceipt.identityCertified=true;},v=>{v.officeAssignmentReceipt.fieldPermissionsGranted=true;},v=>{v.account.membershipId='foreign';},v=>{v.officeAssignmentReceipt.officeReviewOnly=true;}]){const value=outcome();mutate(value);assert.equal(participantOfficeReceiptOutcome(value,reference,command),null);}
 assert.equal(participantOfficeReceiptOutcome({...outcome(),state:'RECORDED'},reference,command).state,'RECORDED');
});

test('later role or account status does not rewrite the original assignment decision',()=>{
 const value=outcome();value.account.role='FINANCE';value.account.roleLabel='Finanzas';value.account.status='DISABLED';value.account.canChangeRole=false;
 assert.equal(participantOfficeReceiptOutcome(value,reference,command).state,'RECORDED');assert.equal(value.officeAssignmentReceipt.role,'DIRECTOR');
});

test('office journal keeps only coordinates and action and requires its exact status contract',async()=>{
 const entries=new Map(),storage={getItem:key=>entries.get(key)||null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key),key:index=>[...entries.keys()][index],get length(){return entries.size;}};
 const journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>1234}),ticket=await journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify(command)});
 assert.deepEqual(Object.keys(ticket.entry).sort(),['action','createdAt','operationId','projectId','resource','scope','version']);assert.doesNotMatch([...entries.values()].join(''),/office@example|user_Office|proofDigest|DIRECTOR|payload|confirmOfficePermissions/);
 const url=new URL('https://example.invalid'+recoveryQuery(ticket.entry));assert.equal(url.searchParams.get('action'),PARTICIPANT_OFFICE_ASSIGN_ACTION);assert.equal(url.searchParams.get('operationId'),operationId);assert.equal(url.searchParams.has('email'),false);
 assert.equal(recoveryResult(ticket.entry,{scope,state:'NOT_OBSERVED',definitive:false}).state,'NOT_OBSERVED');assert.equal(recoveryResult(ticket.entry,{...outcome(),state:'RECORDED'}).state,'RECORDED');assert.equal(recoveryResult(ticket.entry,{scope,state:'RECORDED',saved:true,receiptId:'other'}),null);
 await journal.settle(ticket,null,Object.assign(new Error('Unknown dispatch'),{status:503}));assert.equal((await journal.list(scope)).length,1);
 await journal.settle(ticket,{...outcome(),state:'RECORDED'});assert.equal((await journal.list(scope)).length,0);
});

test('office journal retains dispatched, malformed and crossed results until the exact receipt is observed',async()=>{
 const entries=new Map(),storage={getItem:key=>entries.get(key)||null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key),key:index=>[...entries.keys()][index],get length(){return entries.size;}};
 const journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>1234}),ticket=await journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify(command)});
 const otherCommand={...command,projectId:'project-other',operationId:'22345678-1234-4234-8234-123456789012'};
 const other=await journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify(otherCommand)});
 for(const status of [400,403,409,503]){await journal.settle(ticket,null,Object.assign(new Error('Dispatched without a receipt'),{status,requestDispatched:true}));assert.equal((await journal.list(scope)).length,2);}
 for(const value of [{scope,saved:true,receiptId:'wrong-receipt'},{scope,state:'NOT_OBSERVED',definitive:false},...[
  v=>{v.officeAssignmentReceipt.operationId='invalid';},v=>{v.receiptId='wrong-receipt';},v=>{v.officeAssignmentReceipt.proofDigest='invalid';},v=>{v.scope='d'.repeat(64);},v=>{delete v.officeAssignmentReceipt.membershipId;},v=>{v.officeAssignmentReceipt.operationId=other.entry.operationId;},v=>{v.account=null;}
 ].map(mutate=>{const value=outcome();mutate(value);return value;})]){await journal.settle(ticket,value);assert.equal((await journal.list(scope)).length,2);}
 const status={...outcome(),state:'RECORDED'};status.account.role='FINANCE';status.account.roleLabel='Finanzas';status.account.status='DISABLED';status.account.canChangeRole=false;
 const query=recoveryQuery(ticket.entry);await journal.observe(query.replace('action=ASSIGN_VERIFIED_OFFICE','action=SET_OFFICE_ROLE'),status);assert.equal((await journal.list(scope)).length,2);
 await journal.observe(query.replace('&action=ASSIGN_VERIFIED_OFFICE',''),status);assert.equal((await journal.list(scope)).length,2);
 await journal.observe(query,{scope,state:'NOT_OBSERVED',definitive:false});assert.equal((await journal.list(scope)).length,2);
 await journal.observe(query,status);assert.deepEqual((await journal.list(scope)).map(row=>row.operationId),[other.entry.operationId]);
 await journal.settle(ticket,status);assert.deepEqual((await journal.list(scope)).map(row=>row.operationId),[other.entry.operationId]);
 await journal.settle(other,null,Object.assign(new Error('Cancelled before dispatch'),{status:409,requestDispatched:false}));assert.equal((await journal.list(scope)).length,0);
});

test('only the exact six received precommit rejections are classified as safe first-POST failures',()=>{
 const rejected=code=>({status:409,code,result:{saved:false,identityCertified:false,code}});
 for(const code of ['PARTICIPANT_OFFICE_PROOF_CHANGED','PARTICIPANT_OFFICE_ACCOUNT_EXISTS','PARTICIPANT_OFFICE_HISTORY_UNCONFIRMED','PARTICIPANT_OFFICE_ACCOUNT_FIELD_BOUND','PARTICIPANT_OFFICE_ACCOUNT_RESTRICTED','PARTICIPANT_IDENTITY_CONFLICT'])assert.equal(participantOfficePrecommitRejected(rejected(code)),true);
 for(const code of ['PARTICIPANT_INPUT_INVALID','PARTICIPANT_OFFICE_TARGET_PROTECTED','PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED','PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE','PARTICIPANT_OPERATION_CONFLICT','PARTICIPANT_OFFICE_RECEIPT_INVALID','PARTICIPANT_OFFICE_PROJECTION_INVALID','WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE','UNKNOWN'])assert.equal(participantOfficePrecommitRejected(rejected(code)),false);
 for(const mutate of [e=>{e.status=403;},e=>{e.status=503;},e=>{e.code='PARTICIPANT_IDENTITY_CONFLICT';},e=>{e.retainAttempt=true;},e=>{e.result.saved=true;},e=>{e.result.identityCertified=true;},e=>{e.result.extra=true;},e=>{delete e.result.identityCertified;},e=>{e.result=null;},e=>{e.result='<html>Denied</html>';},e=>{delete e.result;}]){const error=rejected('PARTICIPANT_OFFICE_PROOF_CHANGED');mutate(error);assert.equal(participantOfficePrecommitRejected(error),false);}
 assert.equal(participantOfficePrecommitRejected(undefined),false);
});

test('known precommit rejection releases only the first reservation and never an earlier uncertain attempt',async()=>{
 const entries=new Map(),storage={getItem:key=>entries.get(key)||null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key),key:index=>[...entries.keys()][index],get length(){return entries.size;}};
 const journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>1234}),options={method:'POST',body:JSON.stringify(command)},ticket=await journal.prepare('/api/identity/participants',options);
 const other=await journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify({...command,projectId:'project-other',operationId:'22345678-1234-4234-8234-123456789012'})});
 const error={status:409,code:'PARTICIPANT_OFFICE_PROOF_CHANGED',result:{saved:false,identityCertified:false,code:'PARTICIPANT_OFFICE_PROOF_CHANGED'}};
 for(const code of ['PARTICIPANT_INPUT_INVALID','PARTICIPANT_OFFICE_TARGET_PROTECTED','PARTICIPANT_OPERATION_CONFLICT','PARTICIPANT_OFFICE_RECEIPT_INVALID','PARTICIPANT_OFFICE_PROJECTION_INVALID','WORKSPACE_CONTEXT_CHANGED']){await journal.settle(ticket,null,{status:409,code,result:{saved:false,identityCertified:false,code}});assert.equal((await journal.list(scope)).length,2);}
 await journal.settle(ticket,null,{...error,result:{...error.result,scope}});assert.equal((await journal.list(scope)).length,2);
 await journal.settle(ticket,null,error);assert.deepEqual((await journal.list(scope)).map(row=>row.operationId),[other.entry.operationId]);
 const pending=await journal.prepare('/api/identity/participants',options),retry=await journal.prepare('/api/identity/participants',options);assert.equal(retry.existed,true);
 await journal.settle(retry,null,error);assert.equal((await journal.list(scope)).length,2);
 await journal.settle(retry,null,{requestDispatched:false,status:401});assert.equal((await journal.list(scope)).length,2);
 await journal.settle(pending,{...outcome(),state:'RECORDED'});assert.deepEqual((await journal.list(scope)).map(row=>row.operationId),[other.entry.operationId]);
});
