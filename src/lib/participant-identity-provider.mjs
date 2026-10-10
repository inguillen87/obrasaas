import {WorkspaceError} from './workspace-policy.mjs';
import {identityConfig} from './production-identity-config.mjs';
import {participantVerifiedOfficeEmail} from './participant-verified-office.mjs';
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
  async findVerifiedOfficeAccount({organizationId,email}){
   email=participantVerifiedOfficeEmail(email);if(! /^org_[A-Za-z0-9]+$/.test(organizationId||''))throw unavailable();
   const notReady=code=>({state:'NOT_READY',code,account:null}),blocked=code=>({state:'BLOCKED',code,account:null});
   const api=await trustedClient();try{
    // Exact filters are observations only. Neither names, partial queries nor
    // client metadata can select a canonical account or grant membership.
    const page=await api.users.getUserList({emailAddress:[email],organizationId:[organizationId],limit:2,offset:0});
    if(!Array.isArray(page?.data)||!Number.isSafeInteger(page.totalCount)||page.totalCount<0||page.data.length!==Math.min(page.totalCount,2))throw unavailable();
    if(!page.totalCount)return notReady('PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED');
    if(page.totalCount!==1)return blocked('PARTICIPANT_OFFICE_ACCOUNT_AMBIGUOUS');
    const userId=page.data[0]?.id;if(! /^user_[A-Za-z0-9]+$/.test(userId||''))throw unavailable();
    const user=await api.users.getUser(userId);
    if(user.id!==userId||!Array.isArray(user.emailAddresses)||!Number.isSafeInteger(user.updatedAt)||typeof user.banned!=='boolean'||typeof user.locked!=='boolean')throw unavailable();
    if(user.banned||user.locked)return blocked('PARTICIPANT_OFFICE_TARGET_PROTECTED');
    const selected=user.emailAddresses.filter(address=>typeof address?.emailAddress==='string'&&address.emailAddress.toLowerCase()===email),primary=user.emailAddresses.filter(address=>address?.id===user.primaryEmailAddressId);
    if(selected.length>1||primary.length>1)return blocked('PARTICIPANT_OFFICE_ACCOUNT_AMBIGUOUS');
    if(selected.length!==1||primary.length!==1||selected[0].verification?.status!=='verified'||primary[0].verification?.status!=='verified')return notReady('PARTICIPANT_VERIFIED_EMAIL_REQUIRED');
    const membership=await api.organizations.getOrganizationMembershipList({organizationId,userId:[userId],limit:2,offset:0});
    if(!Array.isArray(membership?.data)||!Number.isSafeInteger(membership.totalCount)||membership.totalCount<0||membership.data.length!==Math.min(membership.totalCount,2))throw unavailable();
    if(!membership.totalCount)return notReady('PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED');
    if(membership.totalCount!==1)return blocked('PARTICIPANT_OFFICE_ACCOUNT_AMBIGUOUS');
    const row=membership.data[0];
    if(row.organization?.id!==organizationId||row.publicUserData?.userId!==userId||! /^orgmem_[A-Za-z0-9]+$/.test(row.id||'')||!Number.isSafeInteger(row.updatedAt))throw unavailable();
    if(row.role!=='org:member')return blocked('PARTICIPANT_OFFICE_TARGET_PROTECTED');
    const primaryEmail=participantVerifiedOfficeEmail(primary[0].emailAddress);
    const name=[user.firstName,user.lastName].filter(value=>typeof value==='string'&&value.trim()).join(' ').normalize('NFC').trim();
    return {state:'READY',code:null,account:{clerkUserId:userId,name:name.length>0&&name.length<=200&&!/[\u0000-\u001f\u007f-\u009f]/.test(name)?name:email,email,primaryEmail,clerkRole:row.role,providerMembershipId:row.id,providerMembershipUpdatedAt:row.updatedAt,userUpdatedAt:user.updatedAt,emailAddressId:selected[0].id,primaryEmailAddressId:primary[0].id}};
   }catch(error){if(error instanceof WorkspaceError&&error.code==='PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE')throw error;throw unavailable();}
  },
  async createInvitation({organizationId,inviterUserId,email,invitationId}){
   const office=/^office_invite_[a-f0-9]{32}$/.test(invitationId||'');
   const api=await trustedClient();try{return normalizedInvitation(await api.organizations.createOrganizationInvitation({organizationId,inviterUserId,emailAddress:email,role:'org:member',expiresInDays:7,redirectUrl:'https://obrasaas.com/cuenta?'+(office?'oficina=':'participar=')+invitationId,publicMetadata:{obrasaasInvitationId:invitationId}}),organizationId);}catch{throw unavailable();}
  },
  async findInvitation({organizationId,invitationId}){
   const api=await trustedClient();try{
    let matches=[];for(let offset=0;offset<5000;offset+=100){const page=await api.organizations.getOrganizationInvitationList({organizationId,status:['pending','accepted','revoked','expired'],limit:100,offset});
     if(!Array.isArray(page?.data)||!Number.isSafeInteger(page.totalCount)||page.totalCount>5000)throw unavailable();
     matches.push(...page.data.filter(row=>row.publicMetadata?.obrasaasInvitationId===invitationId));if(offset+page.data.length>=page.totalCount)break;if(page.data.length!==100)throw unavailable();}
    if(matches.length>1)throw new WorkspaceError('PARTICIPANT_INVITATION_AMBIGUOUS',409);return matches.length===1?normalizedInvitation(matches[0],organizationId):null;
   }catch(error){if(error instanceof WorkspaceError)throw error;throw unavailable();}
  },
   async verifiedEmail(userId,expectedEmail){
    const selected=expectedEmail!==undefined;
    if(selected&&(typeof expectedEmail!=='string'||expectedEmail.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expectedEmail)))throw new WorkspaceError('PARTICIPANT_EMAIL_MISMATCH',403);
    const api=await trustedClient();try{
     const user=await api.users.getUser(userId);if(user.id!==userId||!Array.isArray(user.emailAddresses))throw unavailable();
     // The caller may select an exact canonical invitation address, never an
     // alias or a client-writable profile field. Without a selector, preserve
     // the verified primary address used by canonical account/role operations.
     const addresses=user.emailAddresses.filter(item=>selected?typeof item?.emailAddress==='string'&&item.emailAddress.toLowerCase()===expectedEmail.toLowerCase():item?.id===user.primaryEmailAddressId);
     if(addresses.length>1)throw unavailable();
     if(selected&&!addresses.length)throw new WorkspaceError('PARTICIPANT_EMAIL_MISMATCH',403);
     const address=addresses[0];if(address?.verification?.status!=='verified'||typeof address.emailAddress!=='string')throw new WorkspaceError('PARTICIPANT_VERIFIED_EMAIL_REQUIRED',403);
     return address.emailAddress.toLowerCase();
    }catch(error){if(error instanceof WorkspaceError)throw error;throw unavailable();}
   },
  async verifyMembership({userId,organizationId,invitationId=null}){const api=await trustedClient();try{const page=await api.organizations.getOrganizationMembershipList({organizationId,userId:[userId],limit:2});if(page?.totalCount!==1||page.data?.length!==1)throw new WorkspaceError('PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED',403);const member=page.data[0];if(member.organization?.id!==organizationId||member.publicUserData?.userId!==userId||! /^org:[a-z][a-z0-9_]{0,63}$/.test(member.role||'')||(invitationId&&member.publicMetadata?.obrasaasInvitationId!==invitationId))throw new WorkspaceError('PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED',403);return {userId,organizationId,role:member.role};}catch(error){if(error instanceof WorkspaceError)throw error;throw unavailable();}},
 };
}
