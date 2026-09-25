import { AccessError,accessErrorResponse,getPlatformAccess,requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext,evidenceContextErrorResponse } from '@/lib/evidence-context';
import { RequestBodyError,readJsonRequest,requestBodyErrorResponse } from '@/lib/request-body';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { assignmentFailure,assignmentId,TaskAssignmentError } from '@/lib/task-assignment-policy';
import { getAssignmentReschedule,reviewAssignmentReschedule,commitAssignmentReschedule } from '@/lib/assignment-reschedule';
const headers={'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project','X-Content-Type-Options':'nosniff'};
export function createAssignmentRescheduleHandlers({resolveAccess=getPlatformAccess,authorize=requireTenantPermission,database=getPrisma,
  read=getAssignmentReschedule,review=reviewAssignmentReschedule,save=commitAssignmentReschedule,parse=request=>readJsonRequest(request,{maxBytes:8192})}={}) {
  async function context(request,params) {
    const access=await resolveAccess(),write=request.method==='PATCH',prepare=request.method==='POST';
    authorize(access,write||prepare?'org:execution:manage':'org:execution:read',{subscriptionMode:write?'write':'read'});
    authorize(access,'org:tasks:read',{subscriptionMode:'read'});
    if(!request.headers.get('x-obrasaas-organization')||!request.headers.get('x-obrasaas-project'))throw new TaskAssignmentError('Actualizá el contexto de la empresa y obra.','ASSIGNMENT_CONTEXT_REQUIRED',409);
    assertEvidenceRequestContext(request,access);const url=new URL(request.url);
    if(url.search)throw new TaskAssignmentError('La reprogramación no admite parámetros que cambien su alcance.');
    if((write||prepare)&&((request.headers.get('origin')&&request.headers.get('origin')!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site'))throw new TaskAssignmentError('Origen no autorizado.','ASSIGNMENT_ORIGIN',403);
    return {scope:{organizationId:access.organization.id,projectId:access.project.id},actorId:access.databaseUserId,assignmentId:assignmentId((await params).assignmentId)};
  }
  function failure(error){
    const response=(error instanceof AccessError?accessErrorResponse(error):error instanceof RequestBodyError?requestBodyErrorResponse(error):evidenceContextErrorResponse(error)||assignmentFailure(error)||projectWritePolicyErrorResponse(error))
      ||Response.json({error:'No se confirmó la operación. Conservá las fechas y consultá el estado antes de repetir.',code:'ASSIGNMENT_REPLAN_UNCONFIRMED'},{status:503});
    Object.entries(headers).forEach(([key,value])=>response.headers.set(key,value));return response;
  }
  return {
    async GET(request,{params}){try{const c=await context(request,params);return Response.json(await read(database(),c),{headers});}catch(error){return failure(error);}},
    async POST(request,{params}){try{const c=await context(request,params),input=await parse(request);return Response.json(await review(database(),{...c,input}),{headers});}catch(error){return failure(error);}},
    async PATCH(request,{params}){try{const c=await context(request,params),input=await parse(request);return Response.json(await save(database(),{...c,input}),{headers});}catch(error){return failure(error);}},
  };
}
