import {WorkspaceError,operationId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {projectCreationContext} from './project-creation-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
export function createProjectCreationHandlers({verify,store}){
 async function handle(request){try{
  const session=await verify(request.headers);if(!session.authenticated&&['IDENTITY_CONFIGURATION_PENDING','IDENTITY_PROVIDER_UNAVAILABLE'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);requireWorkspaceIdentity(session);
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  const params=new URL(request.url).searchParams;
  if(request.method==='POST'){
   if(params.size||request.headers.get('origin')!=='https://obrasaas.com')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
   let body;try{body=await boundedBody(request);}catch(error){if(error instanceof WorkspaceError)throw new WorkspaceError('PROJECT_CREATION_INPUT_INVALID',error.status);throw error;}
   return reply(await store.save(session,body));
  }
  if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
  for(const key of params.keys())if(!['projectId','scope','operationId'].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('PROJECT_CREATION_QUERY_INVALID',400);
  const context=projectCreationContext({projectId:params.get('projectId'),scope:params.get('scope')});
  if(params.has('operationId')){if(!operationId(params.get('operationId')))throw new WorkspaceError('PROJECT_CREATION_QUERY_INVALID',400);return reply(await store.status(session,{...context,operationId:params.get('operationId')}));}
  return reply(await store.read(session,context));
 }catch(error){return reply({saved:false,created:false,code:error instanceof WorkspaceError?error.code:'PROJECT_CREATION_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}}
 return {GET:handle,POST:handle};
}
