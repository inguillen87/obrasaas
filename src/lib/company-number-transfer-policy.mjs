import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
export const TRANSFER_RELEASE='single-phone-waba-v1';
export const transferEnabled=environment=>environment.VERCEL_ENV==='production'&&environment.OBRASAAS_COMPANY_NUMBER_TRANSFER_RELEASE===TRANSFER_RELEASE&&/^\d{5,32}$/.test(environment.META_COMPANY_TRANSFER_CONFIG_ID||'');
export const transferFailure=(code='COMPANY_TRANSFER_CONTEXT_CHANGED',status=409)=>{throw new WorkspaceError(code,status);};
export const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const transferDigest=value=>digest(stable(value));
export function transferInput(input){
 const fields=input?.action==='PREPARE'?['action','operationId','projectId','scope','sourceConnectionId','sourceRevision','companyPhoneRevision']:input?.action==='AUTHORIZE'?['action','operationId','projectId','scope','transferId','code','stateToken']:input?.action==='COMMIT'?['action','operationId','projectId','scope','transferId','revision','confirmTransfer']:input?.action==='CLOSE'?['action','operationId','projectId','scope','transferId','revision']:null;
 if(!fields||!input||Object.keys(input).sort().join('|')!==fields.sort().join('|')||!operationId(input.operationId)||!workspaceId(input.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||''))transferFailure('COMPANY_TRANSFER_INPUT_INVALID',400);
 if(input.action==='PREPARE'&&(!workspaceId(input.sourceConnectionId)||!Number.isSafeInteger(input.sourceRevision)||input.sourceRevision<1||!Number.isSafeInteger(input.companyPhoneRevision)||input.companyPhoneRevision<1))transferFailure('COMPANY_TRANSFER_INPUT_INVALID',400);
 if(input.action!=='PREPARE'&&!/^asset_transfer_[a-f0-9]{64}$/.test(input.transferId||''))transferFailure('COMPANY_TRANSFER_INPUT_INVALID',400);
 if(input.action==='AUTHORIZE'&&(typeof input.code!=='string'||input.code.length<8||input.code.length>4096||typeof input.stateToken!=='string'||!/^[a-f0-9]{64}$/.test(input.stateToken)))transferFailure('COMPANY_TRANSFER_INPUT_INVALID',400);
 if(['COMMIT','CLOSE'].includes(input.action)&&(!Number.isSafeInteger(input.revision)||input.revision<1)||input.action==='COMMIT'&&input.confirmTransfer!==true)transferFailure('COMPANY_TRANSFER_INPUT_INVALID',400);
 return {...input,operationId:input.operationId.toLowerCase()};
}
export function assertSinglePhoneGrant(grant,plan,observed){
 const v=grant?.verification,inventory=grant?.inventory;
 if(!grant||typeof grant.token!=='string'||grant.token.length<20||grant.token.length>4096||grant.origin!=='fresh-customer-oauth'||grant.subscribed!==true||!Number.isFinite(Date.parse(grant.checkedAt))||Date.parse(grant.checkedAt)>observed||Date.parse(grant.checkedAt)<observed-60000||!Array.isArray(inventory)||inventory.length!==1||inventory[0]!==plan.phoneNumberId||grant.wabaId!==plan.wabaId||grant.phoneNumberId!==plan.phoneNumberId||v?.registered!==true||v.platformType!=='CLOUD_API'||v.isOnBizApp!==false||v.phoneNumberId!==plan.phoneNumberId||v.displayPhoneNumber!==plan.displayPhoneNumber||!Array.isArray(v.scopes)||!['whatsapp_business_management','whatsapp_business_messaging'].every(scope=>v.scopes.includes(scope))||v.expiresAt!==null&&(!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=observed+300000))transferFailure('COMPANY_TRANSFER_PROVIDER_GRANT_REJECTED',403);
 return grant;
}
export function assertTransferSnapshot(actual,prepared){if(transferDigest(actual)!==transferDigest(prepared))transferFailure();}
export function transferPublic(row){return {transferId:row.id,state:row.state,revision:row.revision,projectId:row.destinationProjectId,sourceConnectionId:row.sourceConnectionId,expiresAt:new Date(row.expiresAt).toISOString(),receiptId:row.state==='COMMITTED'?row.id:null,connected:row.state==='COMMITTED',dataMoved:false,identitiesCopied:false,providerMigrated:false,roundTrip:'NOT_VERIFIED'};}
