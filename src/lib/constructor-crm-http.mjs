import {WorkspaceError,workspaceId,operationId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
export function createConstructorCrmHandlers({verify,store}){
 async function handle(request){
  try{
   const session=await verify(request.headers);
   if(!session?.authenticated&&['IDENTITY_CONFIGURATION_PENDING','IDENTITY_PROVIDER_UNAVAILABLE'].includes(session?.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
   requireWorkspaceIdentity(session);
   if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
   const params=new URL(request.url).searchParams;
   if(request.method==='POST'){
    if(params.size||request.headers.get('origin')!=='https://obrasaas.com')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
    let body;try{body=await boundedBody(request);}catch(error){if(error instanceof WorkspaceError)throw new WorkspaceError('CONSTRUCTOR_CRM_INPUT_INVALID',error.status);throw error;}
    return reply(await store.save(session,body));
   }
   if(request.method!=='GET')return reply({saved:false,code:'METHOD_NOT_ALLOWED'},405);
   for(const key of params.keys())if(!['projectId','scope','after','accountId','operationId'].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('CONSTRUCTOR_CRM_QUERY_INVALID');
   const context={projectId:params.get('projectId'),scope:params.get('scope')};
   if(!workspaceId(context.projectId)||!/^[a-f0-9]{64}$/.test(context.scope||''))throw new WorkspaceError('CONSTRUCTOR_CRM_QUERY_INVALID');
   if(params.has('operationId')){if(params.has('after')||params.has('accountId')||!operationId(params.get('operationId')))throw new WorkspaceError('CONSTRUCTOR_CRM_QUERY_INVALID');return reply(await store.status(session,{...context,operationId:params.get('operationId')}));}
   if(params.has('after')&&params.has('accountId')||params.has('after')&&!workspaceId(params.get('after'))||params.has('accountId')&&!workspaceId(params.get('accountId')))throw new WorkspaceError('CONSTRUCTOR_CRM_QUERY_INVALID');
   return reply(await store.list(session,{...context,...(params.has('after')?{after:params.get('after')}:{}),...(params.has('accountId')?{accountId:params.get('accountId')}:{})}));
  }catch(error){return reply({saved:false,code:error instanceof WorkspaceError?error.code:'CONSTRUCTOR_CRM_OPERATION_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}
 }
 return {GET:handle,POST:handle};
}
