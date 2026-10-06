import {WorkspaceError,workspaceId,operationId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
export function createMetaCustomerHandlers({verify,service}){
 async function handle(request){
  try{const session=await verify(request.headers);if(!session.authenticated&&['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);requireWorkspaceIdentity(session);
   if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
   const params=new URL(request.url).searchParams;
   if(request.method==='POST'){if(request.headers.get('origin')!=='https://obrasaas.com'||params.size)throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
    return Response.json(await service.command(session,await boundedBody(request)),{headers});}
   if(request.method!=='GET')return Response.json({code:'METHOD_NOT_ALLOWED'},{status:405,headers});
   for(const name of params.keys())if(!['projectId','scope','after','operationId','eventId','action','signupId'].includes(name)||params.getAll(name).length!==1)throw new WorkspaceError('META_CUSTOMER_INPUT_INVALID');
   const projectId=params.get('projectId'),scope=params.get('scope');if(!workspaceId(projectId)||!/^[a-f0-9]{64}$/.test(scope||''))throw new WorkspaceError('META_CUSTOMER_INPUT_INVALID');
   const event=value=>/^customer_webhook_[a-f0-9]{64}$/.test(value||'');
   if(params.get('action')==='reconcile'){if(params.has('after')||params.has('eventId')||!operationId(params.get('signupId'))||!operationId(params.get('operationId')))throw new WorkspaceError('META_CUSTOMER_INPUT_INVALID');return Response.json(await service.read(session,{projectId,scope,action:'reconcile',signupId:params.get('signupId'),operationId:params.get('operationId')}),{headers});}
   if(params.has('signupId'))throw new WorkspaceError('META_CUSTOMER_INPUT_INVALID');
   const receipt=params.has('operationId')||params.has('eventId')||params.has('action');
   if(params.has('after')&&(!event(params.get('after'))||receipt)||receipt&&(!operationId(params.get('operationId'))||!event(params.get('eventId'))||!['process_inbox','review_inbox'].includes(params.get('action'))))throw new WorkspaceError('META_CUSTOMER_INBOX_INPUT_INVALID');
   return Response.json(await service.read(session,{projectId,scope,...(params.has('after')?{after:params.get('after')}:{}) ,...(receipt?{operationId:params.get('operationId'),eventId:params.get('eventId'),action:params.get('action')}:{})}),{headers});
  }catch(error){return Response.json({saved:false,code:error instanceof WorkspaceError?error.code:'META_CUSTOMER_OPERATION_UNCONFIRMED'},{status:error instanceof WorkspaceError?error.status:503,headers});}
 }
 return {GET:handle,POST:handle};
}
