import { WorkspaceError, workspaceId, requireWorkspaceIdentity } from './workspace-policy.mjs';
import { boundedBody } from './workspace-http.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
export function createSiteRegisterHandlers({verify,store}) {
  async function handle(request) {
    try {
      const session=await verify(request.headers);
      if(!session.authenticated&&['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
      requireWorkspaceIdentity(session);
      if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
      const params=new URL(request.url).searchParams;
      if(request.method==='POST'){
        if(params.size||request.headers.get('origin')!=='https://obrasaas.com')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
        return reply(await store.save(session,await boundedBody(request)));
      }
      if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
      for(const key of params.keys())if(!['projectId','scope','section','after','operationId'].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('SITE_QUERY_INVALID');
      const context={projectId:params.get('projectId'),scope:params.get('scope')};
      if(!workspaceId(context.projectId)||!/^[a-f0-9]{64}$/.test(context.scope||''))throw new WorkspaceError('SITE_QUERY_INVALID');
      if(params.has('operationId')){
        if(params.has('section')||params.has('after'))throw new WorkspaceError('SITE_QUERY_INVALID');
        return reply(await store.status(session,{...context,operationId:params.get('operationId')}));
      }
      return reply(await store.read(session,{...context,section:params.get('section'),after:params.get('after')}));
    }catch(error){return reply({saved:false,code:error instanceof WorkspaceError?error.code:'SITE_OPERATION_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}
  }
  return {GET:handle,POST:handle};
}
