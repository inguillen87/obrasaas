import { reviewTaskAssignment, planReviewedTaskAssignment } from '@/lib/assignment-overlap-review';
import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { projectExecutionErrorResponse } from '@/lib/project-execution';
import { TaskAssignmentError, assignmentFailure, assignmentId } from '@/lib/task-assignment-policy';
import { prepareTaskAssignment, getTaskAssignment, decideTaskAssignment } from '@/lib/task-assignments';
const headers={'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project','X-Content-Type-Options':'nosniff'};
export function createTaskAssignmentHandlers({resolveAccess=getPlatformAccess,authorize=requireTenantPermission,database=getPrisma,
  prepare=prepareTaskAssignment,plan=planReviewedTaskAssignment,review=reviewTaskAssignment,read=getTaskAssignment,decide=decideTaskAssignment,parse=request=>readJsonRequest(request,{maxBytes:8192})}={}) {
  async function context(request,write,withTask=false){
    const access=await resolveAccess();authorize(access,write?'org:execution:manage':'org:execution:read',{subscriptionMode:write?'write':'read'});authorize(access,'org:tasks:read',{subscriptionMode:'read'});
    if(!request.headers.get('x-obrasaas-organization')||!request.headers.get('x-obrasaas-project'))throw new TaskAssignmentError('Actualizá la empresa y obra de esta pantalla.','ASSIGNMENT_CONTEXT_REQUIRED',409);
    assertEvidenceRequestContext(request,access);
    const url=new URL(request.url);
    if((write||request.method==='POST')&&((request.headers.get('origin')&&request.headers.get('origin')!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site'))throw new TaskAssignmentError('Origen no autorizado.','ASSIGNMENT_ORIGIN',403);
    for(const key of url.searchParams.keys())if(!withTask||key!=='taskId'||url.searchParams.getAll(key).length!==1)throw new TaskAssignmentError('Consulta no admitida.');
    return {scope:{organizationId:access.organization.id,projectId:access.project.id},actorId:access.databaseUserId,...(withTask?{taskId:assignmentId(url.searchParams.get('taskId'))}:{})};
  }
  function failure(error){
    const response=error instanceof AccessError?accessErrorResponse(error):error instanceof RequestBodyError?requestBodyErrorResponse(error):evidenceContextErrorResponse(error)||assignmentFailure(error)||projectWritePolicyErrorResponse(error)||projectExecutionErrorResponse(error);
    const result=response||Response.json({error:'La operación no quedó confirmada. Conservá el intento y consultá su estado.',code:'ASSIGNMENT_UNCONFIRMED'},{status:503});
    Object.entries(headers).forEach(([key,value])=>result.headers.set(key,value));return result;
  }
  return {
    async reviewPOST(request){try{const c=await context(request,false);const input=await parse(request);return Response.json(await review(database(),{...c,input}),{headers});}catch(error){return failure(error);}},
    async prepareGET(request){try{const c=await context(request,false,true);return Response.json(await prepare(database(),c),{headers});}catch(error){return failure(error);}},
    async planPOST(request){try{const c=await context(request,true);const input=await parse(request);const result=await plan(database(),{...c,input,operationKey:request.headers.get('idempotency-key')});return Response.json(result,{status:result.replayed?200:201,headers});}catch(error){return failure(error);}},
    async detailGET(request,{params}){try{const c=await context(request,false);return Response.json(await read(database(),{...c,assignmentId:(await params).assignmentId}),{headers});}catch(error){return failure(error);}},
    async detailPATCH(request,{params}){try{const c=await context(request,true);const input=await parse(request);return Response.json(await decide(database(),{...c,assignmentId:(await params).assignmentId,input}),{headers});}catch(error){return failure(error);}},
  };
}
