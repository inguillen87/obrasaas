import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {digest} from '../src/lib/workspace-policy.mjs';
import {ownCompanyPolicySourceDigest,readOwnCompanyPolicy} from '../src/lib/meta-own-company-policy.mjs';
import {normalizeOwnCompanyConnectRecovery} from '../src/lib/meta-own-company-connection.mjs';
import {ownCompanyNumberOutcome,ownCompanyNumberRecoveryCommand} from '../src/app/(identity)/cuenta/own-company-number-view.mjs';
import {createWorkspaceRecoveryJournal,recoveryResult} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {ownCompanyFixture} from './fixtures/own-company-meta.mjs';

const time=Date.parse('2026-10-09T19:00:00.000Z'),scope='a'.repeat(64),operationId=randomUUID(),reservationId=randomUUID(),sourceHead='a'.repeat(40);
const payload={connectionId:null,revision:0,companyPhoneRevision:1,wabaId:'230000001',phoneNumberId:'220000001',confirmOwnBusiness:true,confirmReplacement:false};
// Exact command shape emitted by ownCompanyNumberCommand + UI UUID assignment.
const original={scope,projectId:'project-a',action:'CONNECT_OWN_NUMBER',payload,operationId};
const requestDigest=digest(original),receiptId='company_own_'+digest(['org-a','owner','project-a',operationId]);
const expected={scope,projectId:'project-a',operationId,action:'CONNECT_OWN_NUMBER',connectionId:null,organizationId:'org-a',actorId:'owner'};
const pending={organization:{id:'org-a',name:'Synthetic company'},actor:{id:'owner',role:'ADMIN'},scope,projectId:'project-a',operationId,action:'CONNECT_OWN_NUMBER',state:'VERIFYING',saved:false,definitive:false,receiptId,replayed:true,channel:null,accepted:false,roundTrip:'NOT_VERIFIED',connectRecovery:{version:1,receiptId,requestDigest,reservationId,policySourceHead:null,companyPhoneRevision:1,wabaId:payload.wabaId,phoneNumberId:payload.phoneNumberId,expiresAt:new Date(time+3600000).toISOString()}};
const command=()=>ownCompanyNumberRecoveryCommand(pending,{originalSourceHead:sourceHead,confirmRecovery:true},expected,{now:time});

test('source-only policy reconstruction is ordered and preserves all original authority and time bounds',()=>{
 const f=ownCompanyFixture({time}),current={...f.policy,sourceHead:'b'.repeat(40)},reversed=Object.fromEntries(Object.entries(current).reverse());
 const environment={...f.environment,VERCEL_GIT_COMMIT_SHA:current.sourceHead,OBRASAAS_META_OWN_COMPANY_POLICY:JSON.stringify(reversed),OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256:ownCompanyPolicySourceDigest(current,current.sourceHead)},validated=readOwnCompanyPolicy(environment,time);
 assert.ok(validated);assert.equal(ownCompanyPolicySourceDigest(validated,f.policy.sourceHead),digest(f.policy));
 for(const [key,value] of Object.entries({organizationId:'other',actorId:'other',clerkUserId:'user_Other',clerkOrganizationId:'org_Other',projectId:'other',appId:'111111111',businessId:'111111111',wabaId:'111111111',phoneNumberId:'111111111',expectedPhoneE164:'+5491100001111',companyPhoneRevision:2,issuedAt:new Date(time-2000).toISOString(),expiresAt:new Date(time+3600001).toISOString()}))assert.notEqual(ownCompanyPolicySourceDigest({...validated,[key]:value},f.policy.sourceHead),digest(f.policy),key);
 assert.throws(()=>ownCompanyPolicySourceDigest(validated,'wrong'));
});

test('explicit recovery reconstructs the original UI digest regardless of recovery JSON property order',()=>{
 const body=command(),reordered={payload:Object.fromEntries(Object.entries(body.payload).reverse()),scope:body.scope,action:body.action,projectId:body.projectId,operationId:body.operationId},normalized=normalizeOwnCompanyConnectRecovery(reordered);
 assert.deepEqual(normalized.input,original);assert.equal(digest(normalized.input),requestDigest);assert.equal(normalized.recovery.originalRequestDigest,requestDigest);assert.equal(normalized.recovery.reservationId,reservationId);assert.equal(normalized.recovery.originalReceiptId,receiptId);
});

test('recovery cannot encode activation, replacement, another connection, missing consent or malformed bindings',()=>{
 for(const patch of [{connectionId:'old-channel'},{revision:1},{confirmReplacement:true},{confirmRecovery:false},{confirmOwnBusiness:false},{originalSourceHead:'wrong'},{originalRequestDigest:'wrong'},{reservationId:'wrong'},{originalReceiptId:'wrong'},{securityPin:'123456'}])assert.throws(()=>normalizeOwnCompanyConnectRecovery({...command(),payload:{...command().payload,...patch}}));
 assert.throws(()=>normalizeOwnCompanyConnectRecovery({...command(),action:'ACTIVATE_OWN_NUMBER'}));
});

test('GET recovery descriptor is bounded and a current explicit confirmation is required before POST',()=>{
 assert.equal(ownCompanyNumberOutcome(pending,expected).state,'VERIFYING');assert.throws(()=>ownCompanyNumberOutcome(pending,expected,{post:true}));
 for(const patch of [{policySourceHead:'wrong'},{requestDigest:'wrong'},{reservationId:'wrong'},{receiptId:'company_own_'+'c'.repeat(64)},{rawToken:'private'}])assert.throws(()=>ownCompanyNumberOutcome({...pending,connectRecovery:{...pending.connectRecovery,...patch}},expected));
 assert.throws(()=>ownCompanyNumberRecoveryCommand(pending,{originalSourceHead:sourceHead,confirmRecovery:false},expected,{now:time}));
 assert.throws(()=>ownCompanyNumberRecoveryCommand(pending,{originalSourceHead:sourceHead,confirmRecovery:true},expected,{now:time+3600000}));
 assert.throws(()=>ownCompanyNumberRecoveryCommand({...pending,connectRecovery:{...pending.connectRecovery,policySourceHead:'b'.repeat(40)}},{originalSourceHead:sourceHead,confirmRecovery:true},expected,{now:time}));
});

test('recovery dispatch reuses the original journal UUID, action and createdAt; uncertainty preserves it',async()=>{
 const map=new Map(),storage={get length(){return map.size;},key:index=>[...map.keys()][index]??null,getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};let clock=time;
 const journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>clock}),options=body=>({method:'POST',body:JSON.stringify(body)}),first=await journal.prepare('/api/identity/company-channel',options(original));clock+=10000;
 const recovered=await journal.prepare('/api/identity/company-channel',options(command()));assert.equal(recovered.existed,true);assert.deepEqual(recovered.entry,first.entry);assert.equal(recovered.entry.createdAt,time);assert.equal(recovered.entry.operationId,operationId);assert.equal(recovered.entry.action,'CONNECT_OWN_NUMBER');
 assert.equal(JSON.stringify(recovered.entry).includes(requestDigest),false);assert.deepEqual(Object.keys(recovered.entry).sort(),['version','resource','scope','projectId','operationId','createdAt','action','connectionId'].sort());
 assert.deepEqual(recoveryResult(first.entry,pending),{state:'VERIFYING'});await journal.settle(recovered,pending);assert.deepEqual(await journal.list(scope),[first.entry]);
 await assert.rejects(journal.prepare('/api/identity/company-channel',options({...command(),operationId:randomUUID()})));
 const {connectRecovery,...result}=pending,final={...result,state:'RECORDED',saved:true,definitive:true,channel:{id:'channel-recovered',anchorProjectId:'project-a',revision:1,mode:'PREPARED',displayPhoneNumber:'+5491100009999',connectionStatus:'PENDING',enabled:false}};await journal.settle(recovered,final);assert.deepEqual(await journal.list(scope),[]);
});
