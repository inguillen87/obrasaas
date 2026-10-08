import {WorkspaceError} from './workspace-policy.mjs';
import {assertApprovedParticipantKyc} from './participant-approved-identity.mjs';

const administrator = member => member.role==='ADMIN' && member.clerkRole==='org:admin';

// Participation follows the canonical account across its organization. Keeping
// the origin receipt prevents a deleted/revoked record becoming an office bypass.
export async function participantAccountBound(client,member) {
  if(administrator(member))return false;
  const linked=await client.query(`SELECT w.id FROM public."Worker" w
    JOIN public."Project" p ON p.id=w."projectId"
    WHERE p."organizationId"=$1 AND w.metadata->'participant'->>'clerkUserId'=$2 LIMIT 1`,[member.organizationId,member.clerkUserId]);
  if(linked.rows.length)return true;
  const origins=await client.query(`SELECT id FROM public."AuditLog"
    WHERE "organizationId"=$1 AND action='participant.operation.recorded' AND
      (("actorId"=$2 AND metadata->>'kind'='INVITATION_ACCEPTED') OR
       (metadata->>'kind'='EXISTING_ACCOUNT_ASSIGNED' AND metadata->>'membershipId'=$3)) LIMIT 1`,[member.organizationId,member.actorId,member.membershipId]);
  return origins.rows.length>0;
}

export async function participantProjectAdmitted(client,member,projectId,{lock=false}={}) {
  if(administrator(member))return true;
  const rows=(await client.query(`SELECT id,"projectId",active,metadata FROM public."Worker"
    WHERE "projectId"=$1 AND metadata->'participant'->>'clerkUserId'=$2
    ${lock?'FOR SHARE':''}`,[projectId,member.clerkUserId])).rows;
  if(!rows.length)return member.participantBound!==true;
  const current=rows.filter(row=>row.active===true && row.metadata?.participant?.version===1 && row.metadata.participant.status==='ACTIVE');
  if(current.length!==1)return false;
  try {await assertApprovedParticipantKyc(client,current[0],member);return true;}
  catch(error) {if(error instanceof WorkspaceError && error.code==='PARTICIPANT_KYC_REVIEW_REQUIRED')return false;throw error;}
}
