import {WorkspaceError,requireWorkspaceIdentity} from './workspace-policy.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
export function createCompanyBillingHandlers({verifySession,store}){
  async function handle(request){
    try{
      const session=await verifySession(request.headers);
      if(!session.authenticated&&['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
      requireWorkspaceIdentity(session);
      if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
      if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
      const query=new URL(request.url).searchParams;
      if(query.size!==1||query.getAll('scope').length!==1||!/^[a-f0-9]{64}$/.test(query.get('scope')||''))throw new WorkspaceError('COMPANY_BILLING_INPUT_INVALID');
      return reply(await store.read(session,{scope:query.get('scope')}));
    }catch(error){return reply({code:error instanceof WorkspaceError?error.code:'COMPANY_BILLING_UNOBSERVED'},error instanceof WorkspaceError?error.status:503);}
  }
  return {GET:handle,POST:handle};
}
