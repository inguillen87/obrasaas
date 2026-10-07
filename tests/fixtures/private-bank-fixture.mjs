import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createWorkspaceStore} from '../../src/lib/workspace-store.mjs';
import {createParticipantStore} from '../../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../../src/lib/participant-http.mjs';
import {scopeStamp} from '../../src/lib/workspace-policy.mjs';
import {PRIVATE_BANK_NOTICE_VERSION} from '../../src/lib/participant-bank-format.mjs';
export const bankEnvironment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,83).toString('base64')};
export const syntheticBankNumber='0000000000000000000001';
export function bankFixture(){
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_BankFixture',organizationId:'org_BankFixture',organizationRole:'org:member'},member={actorId:'bank-actor',membershipId:'bank-membership',organizationId:'bank-company',organizationName:'Synthetic bank company',role:'SITE_MANAGER'},projectId='bank-project',scope=scopeStamp(session,member),audits=new Map(),counts={writes:0,remote:0,sql:[]};
 let assigned=true,membership=true,revisionCounter=1;
 const row={id:'bank-worker',projectId,name:'Synthetic own participant',phone:null,active:true,revision:'2026-10-01T00:00:00.000001',metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:session.userId,permissions:{attendance:false,report:false},kyc:{version:1,status:'APPROVED',submissionId:'bank-submission',contentHash:'a'.repeat(64),review:{decision:'APPROVED',actorId:'bank-reviewer',recordedAt:'2026-10-01T01:00:00.000Z',reason:'Synthetic human review.'},images:[{id:'bank-front'},{id:'bank-selfie'}]}}}};
 const reviews=[{id:'review-bank',metadata:{}}],submissions=[{id:'submit-bank',metadata:{contentHash:row.metadata.participant.kyc.contentHash}}];
 const query=async(sql,args=[])=>{
  counts.sql.push(sql);
  if(/^(BEGIN|SET LOCAL|ROLLBACK|COMMIT)/.test(sql))return {rows:[]};
  if(sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership" m'))return {rows:membership&&args[0]===session.userId&&args[1]===session.organizationId?[member]:[]};
  if(sql.includes('SELECT id,name,status::text AS status FROM public."Project"'))return {rows:args[0]===projectId&&args[1]===member.organizationId?[{id:projectId,name:'Synthetic bank project',status:'ACTIVE'}]:[]};
  if(sql.includes('SELECT p.id,p.name,p.metadata,o.metadata'))return {rows:[{id:projectId,metadata:{},organizationMetadata:{}}]};
  if(sql.includes('FROM public."ProjectMembership"'))return {rows:assigned?[{id:'bank-assignment'}]:[]};
  if(sql.includes('SELECT m.id FROM public."TenantMembership"'))return {rows:assigned&&membership?[{id:member.membershipId}]:[]};
  if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};
  if(sql.includes('clock_timestamp() AS now'))return {rows:[{now:new Date('2026-10-06T12:00:00.000Z')}]};
  if(sql.startsWith('UPDATE public."Worker"')){assert.deepEqual(args.slice(0,2),[row.id,projectId]);row.metadata=JSON.parse(args[2]);row.revision='2026-10-01T00:00:00.'+String(++revisionCounter).padStart(6,'0');counts.writes++;return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){const [id,organizationId,actorId,entityId,raw]=args;assert.equal(organizationId,member.organizationId);assert.equal(actorId,member.actorId);audits.set(id,{id,organizationId,actorId,entityId,entityType:'Worker',metadata:JSON.parse(raw)});return {rows:[],rowCount:1};}
  if(sql.includes('FROM public."AuditLog"')){
   if(sql.includes("metadata->>'kind'='REVIEW_KYC'"))return {rows:reviews};
   if(sql.includes("metadata->>'kind'='KYC_SUBMITTED'"))return {rows:submissions};
   const found=audits.get(args[0]);return {rows:found&&args[1]===found.organizationId&&args[2]===found.actorId?[found]:[]};
  }
  if(sql.includes('FROM public."Worker"'))return {rows:args[0]===row.id&&args[1]===projectId?[structuredClone(row)]:sql.includes('LIMIT 101')?[structuredClone(row)]:[]};
  assert.fail('Unexpected synthetic SQL boundary: '+sql);
 };
 const connect=async()=>({query,release(){}}),forbidden=()=>{counts.remote++;assert.fail('No identity/Graph/Blob/AI request is part of private bank storage');};
 const store=createParticipantStore({workspace:createWorkspaceStore({connect}),connect,environment:bankEnvironment,identity:{createInvitation:forbidden,verifyMembership:forbidden},get:forbidden,upload:forbidden,analyzer:forbidden}),handlers=createParticipantHandlers({verify:async()=>session,store});
 const command=(action='SAVE_PRIVATE_BANK_ACCOUNT',changes={})=>({operationId:randomUUID(),projectId,scope,action,payload:action==='SAVE_PRIVATE_BANK_ACCOUNT'?{workerId:row.id,revision:row.revision,expectedBankRevision:row.metadata.participant.privateBankAccount?.revision||0,type:'CBU',number:syntheticBankNumber,noticeVersion:PRIVATE_BANK_NOTICE_VERSION,consent:true}:{workerId:row.id,revision:row.revision,expectedBankRevision:row.metadata.participant.privateBankAccount?.revision||0},...changes});
 const request=(params,options)=>new Request('https://obrasaas.com/api/identity/participants'+(params?'?'+new URLSearchParams(params):''),options);
 const post=body=>handlers.POST(request(null,{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:JSON.stringify(body)}));
 const read=(changes={})=>handlers.GET(request({projectId,scope,workerId:row.id,detail:'private-bank-account',...changes}));
 const status=body=>handlers.GET(request({projectId,scope,workerId:body.payload.workerId,detail:'private-bank-account',operationId:body.operationId,action:body.action==='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT'?body.payload.originalAction:body.action}));
 return {session,member,scope,projectId,row,reviews,submissions,audits,counts,store,handlers,command,post,read,status,request,setAssigned:value=>{assigned=value;},setMembership:value=>{membership=value;}};
}
