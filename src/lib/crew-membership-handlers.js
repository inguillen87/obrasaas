import { AccessError,accessErrorResponse,getPlatformAccess,requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext,evidenceContextErrorResponse } from '@/lib/evidence-context';
import { RequestBodyError,readJsonRequest,requestBodyErrorResponse } from '@/lib/request-body';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { projectExecutionErrorResponse } from '@/lib/project-execution';
import { CrewMembershipError,crewFailure,crewId,crewQuery } from '@/lib/crew-membership-policy';
import { readCrewRoster,addCrewMember,getCrewMember,decideCrewMember } from '@/lib/crew-memberships';
const headers={'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie, Authorization, X-ObraSaaS-Project, X-ObraSaaS-Organization','X-Content-Type-Options':'nosniff'};
export function createCrewMembershipHandlers({resolveAccess=getPlatformAccess,authorize=requireTenantPermission,database=getPrisma,list=readCrewRoster,add=addCrewMember,read=getCrewMember,decide=decideCrewMember,parse=request=>readJsonRequest(request,{maxBytes:8192})}={}){
  async function context(request,params,write,listRequest=false){
    const access=await resolveAccess();authorize(access,write?'org:execution:manage':'org:execution:read',{subscriptionMode:write?'write':'read'});
    if(!request.headers.get('x-obrasaas-organization')||!request.headers.get('x-obrasaas-project'))throw new CrewMembershipError('Actualizá el contexto de empresa y obra.','CREW_CONTEXT_REQUIRED',409);
    assertEvidenceRequestContext(request,access);const url=new URL(request.url);
    if(write&&((request.headers.get('origin')&&request.headers.get('origin')!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site'))throw new CrewMembershipError('Origen no autorizado.','CREW_ORIGIN',403);
    if(!listRequest&&url.search)throw new CrewMembershipError('La operación no admite parámetros de consulta.');
    const path=await params;
    return {scope:{organizationId:access.organization.id,projectId:access.project.id},actorId:access.databaseUserId,teamId:crewId(path.teamId),...(path.memberId?{memberId:crewId(path.memberId)}:{}),...(listRequest?{query:crewQuery(url.searchParams)}:{})};
  }
  function failure(error){
    const result=(error instanceof AccessError?accessErrorResponse(error):error instanceof RequestBodyError?requestBodyErrorResponse(error):evidenceContextErrorResponse(error)||crewFailure(error)||projectWritePolicyErrorResponse(error)||projectExecutionErrorResponse(error))||Response.json({error:'No se confirmó la operación. Conservá el intento y consultá su estado.',code:'CREW_UNCONFIRMED'},{status:503});
    Object.entries(headers).forEach(([key,value])=>result.headers.set(key,value));return result;
  }
  return {
    async listGET(request,{params}){try{const c=await context(request,params,false,true);return Response.json(await list(database(),c),{headers});}catch(error){return failure(error);}},
    async addPOST(request,{params}){try{const c=await context(request,params,true);const input=await parse(request);const data=await add(database(),{...c,input,operationKey:request.headers.get('idempotency-key')});return Response.json(data,{status:data.replayed?200:201,headers});}catch(error){return failure(error);}},
    async memberGET(request,{params}){try{const c=await context(request,params,false);return Response.json(await read(database(),c),{headers});}catch(error){return failure(error);}},
    async memberPATCH(request,{params}){try{const c=await context(request,params,true);const input=await parse(request);return Response.json(await decide(database(),{...c,input}),{headers});}catch(error){return failure(error);}},
  };
}
