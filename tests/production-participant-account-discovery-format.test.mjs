import test from 'node:test';
import assert from 'node:assert/strict';
import {participantAccountSearch,participantAccount,participantAccountPage,participantAccountStamp,participantAccountSelectionAllowed,participantAccountReadDenied} from '../src/app/(identity)/cuenta/participant-account-discovery-format.mjs';

const context={scope:'a'.repeat(64),projectId:'project-a'};
const account=(n=1,extra={})=>({membershipId:'member-'+n,name:'Synthetic employee '+n,email:'employee'+n+'@example.invalid',role:'AUDITOR',roleLabel:'Consulta',roleScope:'Consulta solamente las obras asignadas.',revision:'2026-10-07T09:00:00.000001',status:'ACTIVE',self:false,canChangeRole:true,...extra});
const page=extra=>({detail:'existing-accounts',...context,accountQuery:'',accountId:null,existingAccounts:[],existingAccountsTruncated:false,nextAccountCursor:null,canManage:true,canInvite:false,canManageOfficeRoles:true,...extra});
const rejected=operation=>assert.throws(operation,{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
// The client keeps the cursor opaque; canonical anchor validation stays in the store.
const cursor='YW5jaG9y~'+'b'.repeat(64);

test('an empty current-company page uses the default query and permits role management without invitation rights',()=>{
 const value=page(),before=structuredClone(value);assert.equal(participantAccountSearch(),'');assert.equal(participantAccountPage(value,context),value);assert.deepEqual(value,before);
 assert.equal(participantAccountSelectionAllowed('SET_OFFICE_ROLE',account(),value),true);assert.equal(participantAccountSelectionAllowed('ASSIGN_EXISTING',account(),value),false);
});

test('a full page can continue with an opaque cursor and does not accumulate or mutate rows',()=>{
 const value=page({existingAccounts:Array.from({length:100},(_,i)=>account(i+1)),existingAccountsTruncated:true,nextAccountCursor:cursor}),before=structuredClone(value);
 assert.equal(participantAccountPage(value,context),value);assert.deepEqual(value,before);
 const maximum=page({...value,nextAccountCursor:'x'.repeat(959)+'~'+'b'.repeat(64)});assert.equal(maximum.nextAccountCursor.length,1024);assert.equal(participantAccountPage(maximum,context),maximum);
});

test('exact selected-account readback requires one matching current row with no continuation',()=>{
 const value=page({accountId:'member-101',existingAccounts:[account(101,{email:null,role:'FINANCE',roleLabel:'Finanzas'})]});
 assert.equal(participantAccountPage(value,{...context,accountId:'member-101'}),value);assert.equal(participantAccount(value.existingAccounts[0]).email,null);
 for(const changed of [{accountId:null},{accountId:'member-102'},{existingAccounts:[]},{existingAccounts:[account(101),account(102)]},{existingAccounts:[account(102)]},{existingAccountsTruncated:true,nextAccountCursor:cursor}])rejected(()=>participantAccountPage({...value,...changed},{...context,accountId:'member-101'}));
 rejected(()=>participantAccountPage(value,context));
});

test('responses from another company context, project or query cannot become the current directory',()=>{
 for(const changed of [{scope:'b'.repeat(64)},{projectId:'project-b'},{detail:'private-bank-account'},{accountQuery:'other employee'},{accountId:'member-1'},{canManage:false},{canManageOfficeRoles:false},{canInvite:'true'}])rejected(()=>participantAccountPage(page(changed),context));
 const value=page({accountQuery:'Álvaro %_\\'});assert.equal(participantAccountPage(value,{...context,query:' A\u0301lvaro %_\\ '}),value);rejected(()=>participantAccountPage(value,{...context,query:'Álvaro'}));
});

test('private identifiers and sensitive fields reject the entire page rather than getting silently stripped',()=>{
 for(const [key,value] of Object.entries({phone:'+5491100000000',bankAccount:'synthetic-private-bank',clerkUserId:'user_Private',userId:'actor-private',kyc:{document:'synthetic-private-document'},metadata:{private:true},organizationId:'company-other'})){
  rejected(()=>participantAccountPage(page({[key]:value}),context));
  rejected(()=>participantAccountPage(page({existingAccounts:[{...account(),[key]:value}]}),context));
 }
});

test('an oversized or duplicate page cannot produce ambiguous account choices',()=>{
 rejected(()=>participantAccountPage(page({existingAccounts:Array.from({length:101},(_,i)=>account(i+1))}),context));
 rejected(()=>participantAccountPage(page({existingAccounts:[account(1),account(1,{email:'different@example.invalid',name:'Different person'})]}),context));
 rejected(()=>participantAccountPage(page({existingAccounts:{0:account(),length:1}}),context));
 rejected(()=>participantAccountPage(page({existingAccounts:[null]}),context));
});

test('continuation flags and cursor must agree with each other and the complete page size',()=>{
 const rows=Array.from({length:100},(_,i)=>account(i+1));
 for(const changed of [{existingAccountsTruncated:true,nextAccountCursor:null},{existingAccountsTruncated:false,nextAccountCursor:cursor},{existingAccountsTruncated:true,nextAccountCursor:cursor,existingAccounts:rows.slice(0,99)},{existingAccountsTruncated:true,nextAccountCursor:cursor,existingAccounts:[]},{existingAccountsTruncated:1,nextAccountCursor:null}])rejected(()=>participantAccountPage(page({existingAccounts:rows,...changed}),context));
 for(const nextAccountCursor of ['','anchor','YW5jaG9y=~'+'b'.repeat(64),cursor+' ',cursor.toUpperCase(),'x'.repeat(960)+'~'+'b'.repeat(64),42,undefined])rejected(()=>participantAccountPage(page({existingAccounts:rows,existingAccountsTruncated:true,nextAccountCursor}),context));
});

test('inactive or malformed accounts cannot survive a directory refresh or exact readback',()=>{
 for(const changed of [{status:'INACTIVE'},{status:'REVOKED'},{status:'INVITED'},{role:'org:admin'},{membershipId:'member/foreign'},{revision:'2026-10-07'},{name:''},{email:{private:'value'}},{self:1},{canChangeRole:'true'},{roleLabel:null},{roleScope:undefined}])rejected(()=>participantAccountPage(page({existingAccounts:[account(1,changed)]}),context));
 const missing=account();delete missing.revision;rejected(()=>participantAccount(missing));
});

test('self and administrator accounts remain discoverable while company-role changes stay protected',()=>{
 const own=account(1,{self:true,canChangeRole:false}),admin=account(2,{role:'ADMIN',roleLabel:'Administrador',canChangeRole:false});
 for(const value of [own,admin]){assert.equal(participantAccount(value),value);assert.equal(participantAccountSelectionAllowed('SET_OFFICE_ROLE',value,page()),false);}
 rejected(()=>participantAccount({...own,canChangeRole:true}));rejected(()=>participantAccount({...admin,canChangeRole:true}));
 for(const role of ['DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR'])assert.equal(participantAccount(account(1,{role})).role,role);
});

test('a changed revision, role or person fingerprint invalidates an earlier account confirmation',()=>{
 const selected=account(),stamp=participantAccountStamp(selected);
 for(const changed of [{membershipId:'member-other'},{name:'Changed employee name'},{email:'changed@example.invalid'},{role:'FINANCE',roleLabel:'Finanzas'},{roleLabel:'Updated role explanation'},{roleScope:'Changed scope explanation'},{revision:'2026-10-07T09:00:00.000002'},{self:true,canChangeRole:false},{canChangeRole:false}])assert.notEqual(participantAccountStamp({...selected,...changed}),stamp);
 rejected(()=>participantAccountStamp({...selected,status:'INACTIVE'}));rejected(()=>participantAccountStamp({...selected,phone:'synthetic-private'}));
 const reordered=Object.fromEntries(Object.entries(selected).reverse());assert.equal(participantAccountStamp(reordered),stamp);assert.deepEqual(selected,account());
});

test('two clients cannot reuse earlier selection capabilities after the exact account changes',()=>{
 const selected=account(),clientA=participantAccountStamp(selected),clientB=participantAccountStamp(structuredClone(selected));assert.equal(clientA,clientB);
 const current=account(1,{revision:'2026-10-07T09:00:00.000002',role:'ADMIN',roleLabel:'Administrador',canChangeRole:false});participantAccountPage(page({accountId:current.membershipId,existingAccounts:[current]}),{...context,accountId:current.membershipId});
 assert.notEqual(participantAccountStamp(current),clientA);assert.notEqual(participantAccountStamp(current),clientB);assert.equal(participantAccountSelectionAllowed('SET_OFFICE_ROLE',current,page()),false);
 assert.equal(participantAccountSelectionAllowed('ASSIGN_EXISTING',current,page({canInvite:false})),false);
});

test('selection requires explicit current capability booleans and cannot authorize other actions',()=>{
 const selected=account();
 assert.equal(participantAccountSelectionAllowed('ASSIGN_EXISTING',selected,page({canInvite:true})),true);
 for(const snapshot of [undefined,{},page({canInvite:false,canManageOfficeRoles:false}),{canInvite:'true',canManageOfficeRoles:'true'},{canInvite:1,canManageOfficeRoles:1}])for(const action of ['ASSIGN_EXISTING','SET_OFFICE_ROLE'])assert.equal(Boolean(participantAccountSelectionAllowed(action,selected,snapshot)),false);
 for(const action of ['INVITE','REVIEW_KYC','DECIDE_PROGRESS','ASSIGN_BY_PHONE',''])assert.equal(Boolean(participantAccountSelectionAllowed(action,selected,page({canInvite:true}))),false);
 for(const changed of [{status:'INACTIVE'},{status:'REVOKED'}])for(const action of ['ASSIGN_EXISTING','SET_OFFICE_ROLE'])assert.equal(Boolean(participantAccountSelectionAllowed(action,{...selected,...changed},page({canInvite:true}))),false);
 assert.equal(Boolean(participantAccountSelectionAllowed('ASSIGN_EXISTING',null,page({canInvite:true}))),false);
});

test('loss of identity, current authority or context requires clearing private results; uncertainty does not claim denial',()=>{
 for(const error of [{status:401},{status:403},{status:409},{status:404,code:'WORKSPACE_PROJECT_UNAVAILABLE'},{status:503,code:'WORKSPACE_CONTEXT_CHANGED'}])assert.equal(participantAccountReadDenied(error),true);
 for(const error of [undefined,{}, {status:503,code:'PARTICIPANT_OPERATION_UNCONFIRMED'},{status:404,code:'PARTICIPANT_ACCOUNT_CURSOR_UNAVAILABLE'},{status:404,code:'PARTICIPANT_ACCOUNT_UNAVAILABLE'},{status:400,code:'PARTICIPANT_ACCOUNT_QUERY_INVALID'}])assert.equal(participantAccountReadDenied(error),false);
});

test('search keeps wildcard-looking input literal and normalizes healthy Unicode within the raw 80-character boundary',()=>{
 for(const value of [' 100%_\\ quoted\' value ','A\u0301lvaro Ñandú',' employee@example.invalid ','\u{1f477}'.repeat(40),'x'.repeat(80),' '.repeat(80)])assert.equal(participantAccountSearch(value),value.normalize('NFC').trim());
 assert.equal(participantAccountSearch('100%_\\'),'100%_\\');
 for(const value of ['x'.repeat(81),' '.repeat(81),'bad\u0000text','bad\ntext','bad\ttext','bad\u007ftext','bad\u0085text','\ud800','\udc00',null,80,[],{}])assert.throws(()=>participantAccountSearch(value),/hasta 80 caracteres/);
});
