import {WorkspaceError,workspaceId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {META_CUSTOMER_PROOF_REVIEW_CODES} from './meta-customer-processing.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
export function createOperationsStatus({workspace}) {
 return {read:(session,context)=>workspace.integrationProject(session,context,false,async(client,member,scope)=>{
  const people=(await client.query(`WITH people AS (
    SELECT w.active,w.metadata,EXISTS(SELECT 1 FROM public."PlatformUser" u
      JOIN public."TenantMembership" m ON m."userId"=u.id AND m.status='ACTIVE'
      JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=m.id AND pm.status='ACTIVE'
      JOIN public."Project" p ON p.id=pm."projectId" AND p."organizationId"=m."organizationId"
      WHERE pm."projectId"=w."projectId" AND u."clerkUserId"=w.metadata->'participant'->>'clerkUserId') AS assigned
    FROM public."Worker" w WHERE w."projectId"=$1)
    SELECT count(*) FILTER(WHERE metadata->'participant'->>'status'='ACTIVE' AND active=true AND assigned)::int AS active,
    count(*) FILTER(WHERE metadata->'participant'->>'status'='ACTIVE' AND metadata->'participant'->'kyc'->>'status'='PENDING_REVIEW' AND active=true AND assigned)::int AS "kycPending",
    count(*) FILTER(WHERE metadata->'participant'->'invitation'->>'state' IN ('ATTEMPTED','UNCERTAIN'))::int AS "invitationUncertain"
    FROM people`,[context.projectId])).rows[0];
  const attendance=(await client.query(`SELECT count(*)::int AS pending FROM public."AttendanceEntry" WHERE "projectId"=$1 AND metadata->'fieldOperations'->>'verificationStatus'='REVIEW_REQUIRED' AND (metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb)`,[context.projectId])).rows[0];
  const reports=(await client.query(`SELECT count(*) FILTER(WHERE metadata->'fieldOperations'->>'version'='1' AND metadata->'fieldOperations'->>'kind'='EVIDENCE' AND (metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb))::int AS "evidencePending",
    count(*) FILTER(WHERE metadata->'fieldOperations'->>'version'='1' AND metadata->'fieldOperations'->>'kind'='EVIDENCE' AND metadata->'fieldOperations'->'processing'->>'status'='QUEUED' AND (metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb))::int AS "processingQueued",
    count(*) FILTER(WHERE metadata->'fieldOperations'->>'version'='1' AND metadata->'fieldOperations'->>'kind'='EVIDENCE' AND metadata->'fieldOperations'->'processing'->>'status'='RUNNING' AND (metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb))::int AS "processingRunning",
    count(*) FILTER(WHERE metadata->'fieldOperations'->>'version'='1' AND metadata->'fieldOperations'->>'kind'='EVIDENCE' AND metadata->'fieldOperations'->'processing'->>'status'='FAILED_RETRYABLE' AND (metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb))::int AS "processingFailed",
    count(*) FILTER(WHERE metadata->'fieldOperations'->>'version'='1' AND metadata->'fieldOperations'->>'kind'='EVIDENCE' AND metadata->'fieldOperations'->'processing'->>'status'='MANUAL_REVIEW_REQUIRED' AND (metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb))::int AS "manualReviewPending",
    count(*) FILTER(WHERE metadata->'procurement'->>'state'='DRAFT')::int AS "purchasesPending",
    count(*) FILTER(WHERE metadata->'siteRegister'->>'version'='1' AND metadata->'siteRegister'->>'type'='MATERIAL_REQUEST' AND metadata->'siteRegister'->>'state' IN ('OPEN','ACKNOWLEDGED'))::int AS "requestsOpen",
    count(*) FILTER(WHERE metadata->'siteRegister'->>'version'='1' AND metadata->'siteRegister'->>'type'='ISSUE' AND metadata->'siteRegister'->>'state' IN ('OPEN','ACKNOWLEDGED'))::int AS "issuesOpen"
    FROM public."Incident" WHERE "projectId"=$1`,[context.projectId])).rows[0];
  const proposals=(await client.query(`SELECT count(*)::int AS pending FROM public."OperationalProposal" WHERE "projectId"=$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND status='PENDING' AND "expiresAt">clock_timestamp() AND action->>'fieldOperationsVersion'='1'`,[context.projectId])).rows[0];
  // Inbox completion and outbound delivery are different durable namespaces.
  // Only aggregate authorized company/project counts; encrypted payloads and
  // provider errors never leave this read model.
  const inbox=(await client.query(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE status='PENDING')::int AS pending,
    count(*) FILTER(WHERE status='PENDING' AND "leaseToken" IS NOT NULL AND "leaseExpiresAt">clock_timestamp())::int AS processing,
    count(*) FILTER(WHERE status='PENDING' AND "leaseToken" IS NOT NULL AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt"<=clock_timestamp()))::int AS "staleLease",
    count(*) FILTER(WHERE status='PENDING' AND "lastError" IS NOT NULL AND NOT ("lastError"=ANY($3::text[])))::int AS "retryableErrors",
    count(*) FILTER(WHERE status='PENDING' AND "lastError"=ANY($3::text[]))::int AS "proofReviewRequired",
    count(*) FILTER(WHERE status='PROCESSED')::int AS processed,
    count(*) FILTER(WHERE outcome->>'version'='1' AND outcome->>'businessApplied'='true')::int AS "businessApplied"
    FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-v1' AND payload->>'organizationId'=$2`,[context.projectId,member.organizationId,META_CUSTOMER_PROOF_REVIEW_CODES])).rows[0];
  const outbound=(await client.query(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE status='PENDING')::int AS pending,
    count(*) FILTER(WHERE status='PENDING' AND "leaseToken" IS NOT NULL AND "leaseExpiresAt">clock_timestamp())::int AS processing,
    count(*) FILTER(WHERE status='PENDING' AND "leaseToken" IS NOT NULL AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt"<=clock_timestamp()))::int AS "staleLease",
    count(*) FILTER(WHERE outcome->>'state'='SEND_UNKNOWN' OR outcome->>'state'='SEND_STARTED' AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt"<=clock_timestamp()))::int AS unknown,
    count(*) FILTER(WHERE outcome->>'state'='SENT' OR outcome->>'state'='STATUS_OBSERVED' AND outcome->>'providerStatus'='sent')::int AS sent,
    count(*) FILTER(WHERE outcome->>'state'='STATUS_OBSERVED' AND outcome->>'providerStatus'='delivered')::int AS delivered,
    count(*) FILTER(WHERE outcome->>'state'='STATUS_OBSERVED' AND outcome->>'providerStatus'='read')::int AS "read",
    count(*) FILTER(WHERE outcome->>'state'='REJECTED' OR outcome->>'state'='STATUS_OBSERVED' AND outcome->>'providerStatus' IN ('failed','deleted'))::int AS rejected
    FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND payload->>'organizationId'=$2`,[context.projectId,member.organizationId])).rows[0];
  const webhooks=(await client.query(`SELECT status::text AS state,count(*)::int AS count FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-v1' AND payload->>'organizationId'=$2 GROUP BY status ORDER BY status`,[context.projectId,member.organizationId])).rows;
  const history=(await client.query(`SELECT id,action,"entityType",to_char("createdAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "recordedAt" FROM public."AuditLog" WHERE "organizationId"=(SELECT "organizationId" FROM public."Project" WHERE id=$1) AND ("entityId"=$1 OR metadata->>'projectId'=$1) ORDER BY "createdAt" DESC,id DESC LIMIT 20`,[context.projectId])).rows;
  return {scope,projectId:context.projectId,observedAt:new Date().toISOString(),people,reports,attendance,proposals,channel:{inbox,outbound},webhooks,history,acceptance:'NOT_VERIFIED'};
 })};
}
export function createOperationsStatusHandler({verify,store}) {
 return async request=>{
  try {
   const session=await verify(request.headers);requireWorkspaceIdentity(session);
   if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
   if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
   const params=new URL(request.url).searchParams;
   if(params.size!==2||[...params.keys()].some(k=>!['projectId','scope'].includes(k)||params.getAll(k).length!==1))throw new WorkspaceError('OPERATIONS_STATUS_QUERY_INVALID');
   const context={projectId:params.get('projectId'),scope:params.get('scope')};
   if(!workspaceId(context.projectId)||!/^[a-f0-9]{64}$/.test(context.scope||''))throw new WorkspaceError('OPERATIONS_STATUS_QUERY_INVALID');
   return reply(await store.read(session,context));
  }catch(e){return reply({code:e instanceof WorkspaceError?e.code:'OPERATIONS_STATUS_UNAVAILABLE'},e instanceof WorkspaceError?e.status:503);}
 };
}
