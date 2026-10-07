import {WorkspaceError,workspaceId,operationId} from './workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret,customerContextCommitment} from './meta-customer-credentials.mjs';
import {privateBankNumber,privateBankType} from './participant-bank-format.mjs';
function context(owner,revision){
 if(![owner.organizationId,owner.projectId,owner.workerId,owner.actorId].every(workspaceId)||!/^user_[A-Za-z0-9]+$/.test(owner.clerkUserId||'')||!Number.isSafeInteger(revision)||revision<1)throw new WorkspaceError('PARTICIPANT_BANK_SCOPE_REJECTED',409);
 return {organizationId:owner.organizationId,projectId:owner.projectId,purpose:'participant-private-bank-account-v1',resourceId:JSON.stringify([owner.workerId,owner.actorId,owner.clerkUserId,revision])};
}
export function sealPrivateBankAccount(value,owner,revision,environment=process.env){
 if(!privateBankType(value?.type)||!privateBankNumber(value?.number))throw new WorkspaceError('PARTICIPANT_BANK_FORMAT_INVALID');
 return encryptCustomerSecret(JSON.stringify({version:1,type:value.type,number:value.number}),context(owner,revision),environment);
}
export function openPrivateBankAccount(envelope,owner,revision,environment=process.env){
 try{const value=JSON.parse(decryptCustomerSecret(envelope,context(owner,revision),environment));if(Object.keys(value).sort().join('|')!=='number|type|version'||value.version!==1||!privateBankType(value.type)||!privateBankNumber(value.number))throw new Error();return value;}catch{throw new WorkspaceError('PARTICIPANT_BANK_SCOPE_REJECTED',409);}
}
export function privateBankRequestCommitment(input,owner,environment=process.env){
 if(!operationId(input.operationId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
 const p=input.payload,base=['participant-private-bank-request-v1',input.action,input.operationId.toLowerCase(),input.scope,input.projectId,p?.workerId];let tuple;
 if(input.action==='SAVE_PRIVATE_BANK_ACCOUNT')tuple=[...base,p.revision,p.expectedBankRevision,p.type,p.number,p.noticeVersion,p.consent];
 else if(input.action==='REMOVE_PRIVATE_BANK_ACCOUNT')tuple=[...base,p.revision,p.expectedBankRevision];
 else if(input.action==='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT')tuple=[...base,p.originalAction,p.confirmed];
 else throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
 return customerContextCommitment(JSON.stringify(tuple),{...context(owner,1),purpose:'participant-private-bank-request-v1',resourceId:JSON.stringify([owner.workerId,owner.actorId,owner.clerkUserId,input.operationId.toLowerCase()])},environment);
}
