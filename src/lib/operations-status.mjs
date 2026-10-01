import {WorkspaceError,workspaceId,requireWorkspaceIdentity} from './workspace-policy.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
export function createOperationsStatus({workspace}) {
 return {read:(session,context)=>workspace.integrationProject(session,context,false,async(client,_member,scope)=>{
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
  const reports=(await client.query(`SELECT count(*) FILTER(WHERE metadata->'fieldOperations'->>'kind'='EVIDENCE' AND (metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb))::int AS "evidencePending",
    count(*) FILTER(WHERE metadata->'procurement'->>'state'='DRAFT')::int AS "purchasesPending",
    count(*) FILTER(WHERE metadata->'siteRegister'->>'type'='ISSUE' AND metadata->'siteRegister'->>'state' IN ('OPEN','ACKNOWLEDGED'))::int AS "issuesOpen"
    FROM public."Incident" WHERE "projectId"=$1`,[context.projectId])).rows[0];
  const proposals=(await client.query(`SELECT count(*)::int AS pending FROM public."OperationalProposal" WHERE "projectId"=$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND status='PENDING' AND "expiresAt">clock_timestamp() AND action->>'fieldOperationsVersion'='1'`,[context.projectId])).rows[0];
  const webhooks=(await client.query(`SELECT status::text AS state,count(*)::int AS count FROM public."WebhookEvent" WHERE "projectId"=$1 GROUP BY status ORDER BY status`,[context.projectId])).rows;
  const history=(await client.query(`SELECT id,action,"entityType",to_char("createdAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "recordedAt" FROM public."AuditLog" WHERE "organizationId"=(SELECT "organizationId" FROM public."Project" WHERE id=$1) AND ("entityId"=$1 OR metadata->>'projectId'=$1) ORDER BY "createdAt" DESC,id DESC LIMIT 20`,[context.projectId])).rows;
  return {scope,projectId:context.projectId,observedAt:new Date().toISOString(),people,reports,attendance,proposals,webhooks,history,acceptance:'NOT_VERIFIED'};
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
