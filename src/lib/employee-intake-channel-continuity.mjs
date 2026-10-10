import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';

export const EMPLOYEE_INTAKE_MAX_ADDITIVE_REVISIONS=100;
const fail=()=>{throw new WorkspaceError('EMPLOYEE_INTAKE_REVOKED',409);};
const revision=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);

function assignments(channel,anchorProjectId,anchorAssignmentRevision){
 if(!Array.isArray(channel.assignments)||channel.assignments.length<1||channel.assignments.length>100)fail();
 const result=new Map();
 for(const value of channel.assignments){
  if(!object(value)||!workspaceId(value.projectId)||!['ACTIVE','REVOKED'].includes(value.status)||!revision(value.revision)||result.has(value.projectId))fail();
  result.set(value.projectId,{status:value.status,revision:value.revision});
 }
 const anchor=result.get(anchorProjectId);
 if(anchor?.status!=='ACTIVE'||anchor.revision!==anchorAssignmentRevision)fail();
 return result;
}

// ownerRevision remains the original consent/issuance checkpoint. This proof
// permits only recorded additions; it never updates that policy or its digest.
export function assertEmployeeIntakeAdditiveHistory({connectionId,organizationId,anchorProjectId,fromRevision,toRevision,anchorAssignmentRevision,receipts}){
 if(!workspaceId(connectionId)||!workspaceId(organizationId)||!workspaceId(anchorProjectId)||!revision(fromRevision)||!revision(toRevision)||!revision(anchorAssignmentRevision)||toRevision<fromRevision||toRevision-fromRevision>EMPLOYEE_INTAKE_MAX_ADDITIVE_REVISIONS||!Array.isArray(receipts)||receipts.length!==toRevision-fromRevision+1)fail();
 const byRevision=new Map();
 for(const row of receipts){
  const m=row?.metadata,c=m?.channel;
  if(row?.organizationId!==organizationId||row.entityType!=='WhatsAppConnection'||row.entityId!==connectionId||row.action!=='company.channel.recorded'||!workspaceId(row.actorId)||!object(m)||m.version!==1||m.state!=='RECORDED'||m.code!==null||!workspaceId(m.projectId)||!operationId(m.operationId)||m.operationId.toLowerCase()!==m.operationId||!['PREPARE','ASSIGN','REVOKE','ACTIVATE','SUSPEND'].includes(m.action)||!/^[a-f0-9]{64}$/.test(m.requestDigest||'')||row.id!=='company_channel_'+digest([organizationId,row.actorId,m.projectId,m.operationId])||!object(c)||c.id!==connectionId||c.anchorProjectId!==anchorProjectId||c.mode!=='COMPANY'||!revision(c.revision)||c.revision<fromRevision||c.revision>toRevision||byRevision.has(c.revision))fail();
  byRevision.set(c.revision,{action:m.action,assignments:assignments(c,anchorProjectId,anchorAssignmentRevision)});
 }
 let previous=byRevision.get(fromRevision)?.assignments;
 if(!previous)fail();
 for(let nextRevision=fromRevision+1;nextRevision<=toRevision;nextRevision++){
  const next=byRevision.get(nextRevision);
  if(!next||next.action!=='ASSIGN'||next.assignments.size!==previous.size+1)fail();
  for(const [projectId,value] of previous){const current=next.assignments.get(projectId);if(!current||current.status!==value.status||current.revision!==value.revision)fail();}
  const added=[...next.assignments].filter(([projectId])=>!previous.has(projectId));
  if(added.length!==1||added[0][0]===anchorProjectId||added[0][1].status!=='ACTIVE'||added[0][1].revision!==1)fail();
  previous=next.assignments;
 }
 return true;
}

export async function assertEmployeeIntakeChannelContinuity(client,connection,policy,{lock=true}={}){
 const owner=connection.company;
 if(!revision(policy.ownerRevision)||!revision(owner?.revision)||owner.revision<policy.ownerRevision||owner.revision-policy.ownerRevision>EMPLOYEE_INTAKE_MAX_ADDITIVE_REVISIONS)fail();
 // An admission may target another assigned worksite. Its assignment is not
 // proof that the credential/intake anchor is still active.
 const anchor=(await client.query(`SELECT revision FROM public."WhatsAppChannelProjectAssignment" WHERE "connectionId"=$1 AND "organizationId"=$2 AND "projectId"=$3 AND status='ACTIVE' ${lock?'FOR SHARE':''}`,[connection.id,connection.organizationId,connection.projectId])).rows;
 if(anchor.length!==1||!revision(anchor[0].revision))fail();
 if(owner.revision===policy.ownerRevision)return true;
 // The channel/owner locks already held by the caller precede audit locks.
 // Malformed revisions cannot be cast, and the extra row detects excess proof.
 const receipts=(await client.query(`SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='WhatsAppConnection' AND "entityId"=$2 AND action='company.channel.recorded' AND metadata->>'state'='RECORDED' AND CASE WHEN metadata->'channel'->>'revision' ~ '^[1-9][0-9]{0,9}$' THEN (metadata->'channel'->>'revision')::bigint ELSE NULL END BETWEEN $3 AND $4 ORDER BY id LIMIT 102 ${lock?'FOR SHARE':''}`,[connection.organizationId,connection.id,policy.ownerRevision,owner.revision])).rows;
 return assertEmployeeIntakeAdditiveHistory({connectionId:connection.id,organizationId:connection.organizationId,anchorProjectId:connection.projectId,fromRevision:policy.ownerRevision,toRevision:owner.revision,anchorAssignmentRevision:anchor[0].revision,receipts});
}
