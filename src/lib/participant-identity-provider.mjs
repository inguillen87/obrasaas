import {WorkspaceError} from './workspace-policy.mjs';
import {identityConfig} from './production-identity-config.mjs';
const unavailable=()=>new WorkspaceError('PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE',503);
function normalizedInvitation(row,organizationId){
 if(!row||row.organizationId!==organizationId||!/^orginv_[A-Za-z0-9]+$/.test(row.id||'')||row.role!=='org:member'||typeof row.emailAddress!=='string'||!Number.isSafeInteger(row.expiresAt))throw unavailable();
 return {id:row.id,email:row.emailAddress.toLowerCase(),role:row.role,state:row.status,expiresAt:new Date(row.expiresAt).toISOString(),invitationId:row.publicMetadata?.obrasaasInvitationId};
}
// Uses the existing production identity instance. No key provisioning, metadata
// supplied by a browser, or provider exception text enters the public response.
export function createParticipantIdentityProvider({client,environment=()=>process.env}){
 const trustedClient=async()=>{if(!identityConfig(environment()).configured)throw unavailable();try{return await client();}catch{throw unavailable();}};
 return {
  async createInvitation({organizationId,inviterUserId,email,invitationId}){
   const api=await trustedClient();try{return normalizedInvitation(await api.organizations.createOrganizationInvitation({organizationId,inviterUserId,emailAddress:email,role:'org:member',expiresInDays:7,redirectUrl:'https://obrasaas.com/cuenta?participar='+invitationId,publicMetadata:{obrasaasInvitationId:invitationId}}),organizationId);}catch{throw unavailable();}
  },
  async findInvitation({organizationId,invitationId}){
   const api=await trustedClient();try{
    let matches=[];for(let offset=0;offset<5000;offset+=100){const page=await api.organizations.getOrganizationInvitationList({organizationId,status:['pending','accepted','revoked','expired'],limit:100,offset});
     if(!Array.isArray(page?.data)||!Number.isSafeInteger(page.totalCount)||page.totalCount>5000)throw unavailable();
     matches.push(...page.data.filter(row=>row.publicMetadata?.obrasaasInvitationId===invitationId));if(offset+page.data.length>=page.totalCount)break;if(page.data.length!==100)throw unavailable();}
    if(matches.length>1)throw new WorkspaceError('PARTICIPANT_INVITATION_AMBIGUOUS',409);return matches.length===1?normalizedInvitation(matches[0],organizationId):null;
   }catch(error){if(error instanceof WorkspaceError)throw error;throw unavailable();}
  },
  async verifiedEmail(userId){const api=await trustedClient();try{const user=await api.users.getUser(userId);if(user.id!==userId||!Array.isArray(user.emailAddresses))throw unavailable();const address=user.emailAddresses.find(item=>item.id===user.primaryEmailAddressId);if(address?.verification?.status!=='verified'||typeof address.emailAddress!=='string')throw new WorkspaceError('PARTICIPANT_VERIFIED_EMAIL_REQUIRED',403);return address.emailAddress.toLowerCase();}catch(error){if(error instanceof WorkspaceError)throw error;throw unavailable();}},
  async verifyMembership({userId,organizationId,invitationId=null}){const api=await trustedClient();try{const page=await api.organizations.getOrganizationMembershipList({organizationId,userId:[userId],limit:2});if(page?.totalCount!==1||page.data?.length!==1)throw new WorkspaceError('PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED',403);const member=page.data[0];if(member.organization?.id!==organizationId||member.publicUserData?.userId!==userId||! /^org:[a-z][a-z0-9_]{0,63}$/.test(member.role||'')||(invitationId&&member.publicMetadata?.obrasaasInvitationId!==invitationId))throw new WorkspaceError('PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED',403);return {userId,organizationId,role:member.role};}catch(error){if(error instanceof WorkspaceError)throw error;throw unavailable();}},
 };
}
