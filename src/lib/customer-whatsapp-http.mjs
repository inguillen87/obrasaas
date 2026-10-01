import {WorkspaceError,workspaceId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export function createCustomerWhatsAppHandlers({verify,service}){
  async function handle(request){
    try{
      const session=await verify(request.headers);
      if(!session.authenticated&&['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
      requireWorkspaceIdentity(session);
      if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
      const params=new URL(request.url).searchParams;
      if(request.method==='POST'){
        if(request.headers.get('origin')!=='https://obrasaas.com'||params.size)throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
        return response(await service.save(session,await boundedBody(request)));
      }
      if(request.method!=='GET')return response({code:'METHOD_NOT_ALLOWED'},405);
      for(const key of params.keys())if(!['projectId','scope','operationId'].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('WHATSAPP_PREPARATION_INVALID');
      const projectId=params.get('projectId'),scope=params.get('scope');
      if(!workspaceId(projectId)||!/^[a-f0-9]{64}$/.test(scope||''))throw new WorkspaceError('WHATSAPP_PREPARATION_INVALID');
      return response(params.has('operationId')?await service.status(session,{projectId,scope,operationId:params.get('operationId')}):await service.read(session,{projectId,scope}));
    }catch(error){return response({saved:false,code:error instanceof WorkspaceError?error.code:'WHATSAPP_PREPARATION_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}
  }
  return {GET:handle,POST:handle};
}
