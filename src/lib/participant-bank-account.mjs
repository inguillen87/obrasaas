import {WorkspaceError,workspaceId,operationId} from './workspace-policy.mjs';
import {assertOwnParticipant,participantReceiptId} from './participant-policy.mjs';
import {assertApprovedParticipantKyc} from './participant-approved-identity.mjs';
import {PRIVATE_BANK_ACTIONS,PRIVATE_BANK_NOTICE,PRIVATE_BANK_NOTICE_VERSION} from './participant-bank-format.mjs';
import {sealPrivateBankAccount,openPrivateBankAccount,privateBankRequestCommitment} from './participant-bank-vault.mjs';
export const PRIVATE_BANK_RECEIPT_KIND='PRIVATE_BANK_ACCOUNT';
const cancelled='PARTICIPANT_BANK_ACCOUNT_CANCELLED',stale='PARTICIPANT_BANK_REVISION_CHANGED';
const bankRevision=value=>Number.isSafeInteger(value)&&value>=0&&value<2147483647;
export async function assertPrivateBankOwner(client,member,session,projectId,workerId,{lock=false}={}){
 if(lock){const assigned=(await client.query(`SELECT m.id FROM public."TenantMembership" m JOIN public."PlatformUser" u ON u.id=m."userId" JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=m.id WHERE m.id=$1 AND m."organizationId"=$2 AND u."clerkUserId"=$3 AND m.status='ACTIVE' AND pm."projectId"=$4 AND pm.status='ACTIVE' FOR SHARE OF m,u,pm`,[member.membershipId,member.organizationId,session.userId,projectId])).rows;if(assigned.length!==1)throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);}
 const row=await assertOwnParticipant(client,member,session,projectId,workerId,{lock});
 await assertApprovedParticipantKyc(client,{...row,projectId},{...member,clerkUserId:session.userId});
 return row;
}
const ownerOf=(member,session,projectId,workerId)=>({organizationId:member.organizationId,projectId,workerId,actorId:member.actorId,clerkUserId:session.userId});
function storedBank(row,owner){
 const bank=row.metadata.participant.privateBankAccount;if(bank===undefined)return null;
 if(!bank||bank.version!==1||!bankRevision(bank.revision)||bank.revision<1||!['DECLARED','REMOVED'].includes(bank.state)||!Number.isFinite(Date.parse(bank.recordedAt))||Object.keys(owner).some(key=>bank.owner?.[key]!==owner[key])||(bank.state==='DECLARED'?typeof bank.envelope!=='string':bank.envelope!==null))throw new WorkspaceError('PARTICIPANT_BANK_SCOPE_REJECTED',409);
 return bank;
}
function receiptShape(found,member,input){
 const m=found?.metadata;
 if(found?.entityType!=='Worker'||found.entityId!==input.workerId||m?.version!==1||m.kind!==PRIVATE_BANK_RECEIPT_KIND||m.projectId!==input.projectId||m.operationId!==input.operationId||m.workerId!==input.workerId||m.actorId!==member.actorId||m.organizationId!==member.organizationId||!PRIVATE_BANK_ACTIONS.includes(m.bankAction)||!['RECORDED','REJECTED','CANCELLED'].includes(m.state)||!bankRevision(m.bankRevision)||(m.state==='RECORDED'?m.code!==null||m.bankRevision<1:m.code!==(m.state==='CANCELLED'?cancelled:stale))||!/^[a-f0-9]{64}$/.test(m.requestCommitment||''))throw new WorkspaceError('PARTICIPANT_RECEIPT_INVALID',409);
 return m;
}
export function privateBankOutcome(found,member,input,scope,{replayed=true}={}){
 const m=receiptShape(found,member,input);
 if(input.action&&input.action!==m.bankAction)throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);
 return {scope,organizationId:member.organizationId,actorId:member.actorId,projectId:input.projectId,operationId:input.operationId,action:m.bankAction,workerId:input.workerId,state:m.state,saved:m.state==='RECORDED',definitive:true,replayed,
  receipt:{id:found.id,organizationId:member.organizationId,actorId:member.actorId,projectId:input.projectId,workerId:input.workerId,operationId:input.operationId,action:m.bankAction,state:m.state,bankRevision:m.bankRevision,code:m.code}};
}
async function findReceipt(client,member,key){return (await client.query(`SELECT id,"entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.operation.recorded'`,[key,member.organizationId,member.actorId])).rows[0];}
async function record(client,member,key,input,details){
 const m={version:1,kind:PRIVATE_BANK_RECEIPT_KIND,organizationId:member.organizationId,actorId:member.actorId,projectId:input.projectId,workerId:input.payload.workerId,operationId:input.operationId,...details};
 await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.operation.recorded','Worker',$4,$5::jsonb)`,[key,member.organizationId,member.actorId,input.payload.workerId,JSON.stringify(m)]);
 return {id:key,entityType:'Worker',entityId:input.payload.workerId,metadata:m};
}
export async function readPrivateBankAccount(client,member,session,input,scope,{environment=process.env}={}){
 const row=await assertPrivateBankOwner(client,member,session,input.projectId,input.workerId),owner=ownerOf(member,session,input.projectId,row.id),bank=storedBank(row,owner);
 const value=bank?.state==='DECLARED'?openPrivateBankAccount(bank.envelope,owner,bank.revision,environment):null;
 return {scope,organizationId:member.organizationId,actorId:member.actorId,projectId:input.projectId,workerId:row.id,revision:row.revision,bankRevision:bank?.revision||0,state:bank?.state||'NOT_DECLARED',type:value?.type||null,last4:value?.number.slice(-4)||null,recordedAt:bank?.recordedAt||null,
  notice:{version:PRIVATE_BANK_NOTICE_VERSION,text:PRIVATE_BANK_NOTICE},formatOnly:true,ownershipVerified:false,paymentEnabled:false};
}
export async function privateBankStatus(client,member,session,input,scope){
 if(!workspaceId(input.workerId)||!PRIVATE_BANK_ACTIONS.includes(input.action)||!operationId(input.operationId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
 await assertPrivateBankOwner(client,member,session,input.projectId,input.workerId);
 const found=await findReceipt(client,member,participantReceiptId(member.actorId,input.projectId,input.operationId));
 return found?privateBankOutcome(found,member,input,scope):{scope,organizationId:member.organizationId,actorId:member.actorId,projectId:input.projectId,workerId:input.workerId,action:input.action,operationId:input.operationId,state:'NOT_OBSERVED',saved:false,definitive:false};
}
export async function savePrivateBankAccount(client,member,session,input,scope,{environment=process.env}={}){
 const p=input.payload,key=participantReceiptId(member.actorId,input.projectId,input.operationId),action=input.action==='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT'?p.originalAction:input.action;
 // The canonical workspace transaction already holds Project/assignment locks.
 // The operation fence is durable before a delayed producer may mutate Worker.
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
 const row=await assertPrivateBankOwner(client,member,session,input.projectId,p.workerId,{lock:true}),owner=ownerOf(member,session,input.projectId,row.id),bank=storedBank(row,owner),context={projectId:input.projectId,workerId:row.id,operationId:input.operationId,action};
 const prior=await findReceipt(client,member,key);
 if(prior){
  const m=receiptShape(prior,member,context);
  if(m.bankAction!==action)throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);
  if(input.action!=='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT'&&m.state!=='CANCELLED'&&m.requestCommitment!==privateBankRequestCommitment(input,owner,environment))throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);
  return privateBankOutcome(prior,member,context,scope);
 }
 const commitment=privateBankRequestCommitment(input,owner,environment),currentRevision=bank?.revision||0;
 let state='RECORDED',code=null,nextRevision=currentRevision+1;
 if(input.action==='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT'){state='CANCELLED';code=cancelled;nextRevision=currentRevision;}
 else if(row.revision!==p.revision||currentRevision!==p.expectedBankRevision){state='REJECTED';code=stale;nextRevision=currentRevision;}
 else {
  const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  if(!(now instanceof Date)||!Number.isFinite(now.getTime())||!bankRevision(nextRevision))throw new WorkspaceError('PARTICIPANT_BANK_SCOPE_REJECTED',409);
  const next=structuredClone(row.metadata),isSave=input.action==='SAVE_PRIVATE_BANK_ACCOUNT';
  next.participant.privateBankAccount={version:1,owner,revision:nextRevision,state:isSave?'DECLARED':'REMOVED',recordedAt:now.toISOString(),envelope:isSave?sealPrivateBankAccount(p,owner,nextRevision,environment):null};
  await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,input.projectId,JSON.stringify(next)]);
 }
 const found=await record(client,member,key,input,{bankAction:action,state,code,bankRevision:nextRevision,requestCommitment:commitment,...(state==='RECORDED'&&action==='SAVE_PRIVATE_BANK_ACCOUNT'?{noticeVersion:PRIVATE_BANK_NOTICE_VERSION,consent:true}:{})});
 return privateBankOutcome(found,member,context,scope,{replayed:false});
}
