import {WorkspaceError,workspaceId,operationId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
export function createMetaDemoPilotHandlers({verify,service}){
 async function handle(request){try{
  const session=await verify(request.headers);if(!session.authenticated&&['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);requireWorkspaceIdentity(session);
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  const params=new URL(request.url).searchParams;
  if(request.method==='POST'){if(request.headers.get('origin')!=='https://obrasaas.com'||params.size)throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);return Response.json(await service.command(session,await boundedBody(request)),{headers});}
  if(request.method!=='GET')return Response.json({code:'METHOD_NOT_ALLOWED'},{status:405,headers});
  for(const name of params.keys())if(!['projectId','scope','operationId'].includes(name)||params.getAll(name).length!==1)throw new WorkspaceError('META_DEMO_INPUT_INVALID');
  const projectId=params.get('projectId'),scope=params.get('scope');if(!workspaceId(projectId)||!/^[a-f0-9]{64}$/.test(scope||'')||params.has('operationId')&&!operationId(params.get('operationId')))throw new WorkspaceError('META_DEMO_INPUT_INVALID');
  return Response.json(await service.read(session,{projectId,scope,...(params.has('operationId')?{operationId:params.get('operationId')}:{})}),{headers});
 }catch(error){return Response.json({saved:false,code:error instanceof WorkspaceError?error.code:'META_DEMO_OPERATION_UNCONFIRMED'},{status:error instanceof WorkspaceError?error.status:503,headers});}}
 return {GET:handle,POST:handle};
}
